import makeWASocket, {
  DisconnectReason,
  makeCacheableSignalKeyStore,
  WASocket,
  ConnectionState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { useFirestoreAuthState, getAuthState, saveAuthState, getSessionConnectionStatus } from './session.js';
import { activeSockets } from '../../src/services/whatsappBaileysService.js';

const logger = pino({ level: 'silent' });

/**
 * Format phone numbers to WhatsApp international standard.
 * Nigerian standard conversion: 08012345678 -> 2348012345678
 */
export function formatWhatsAppNumber(phone: string): string {
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '234' + clean.slice(1);
  } else if (clean.length === 10 && (clean.startsWith('7') || clean.startsWith('8') || clean.startsWith('9'))) {
    clean = '234' + clean;
  }
  return clean;
}

/**
 * Returns the active WhatsApp Baileys socket for the given user/session if available in memory.
 */
export function getWhatsAppSock(userId: string = 'default_workspace'): WASocket | undefined {
  return activeSockets.get((userId || 'default_workspace').trim());
}

export { getAuthState, saveAuthState, getSessionConnectionStatus };

/**
 * 6. CLIENT lib/whatsapp/client.ts:
 * When sending message, load creds from Firestore and create makeWASocket with auth from DB, send then close
 */
export async function sendWhatsAppMessage(
  userId: string = 'default_workspace',
  to: string,
  message: string
): Promise<{ ok: boolean; messageId: string; to: string; detail: string }> {
  const cleanUser = String(userId || 'default_workspace').trim();
  const formattedTo = formatWhatsAppNumber(to);

  if (!formattedTo || formattedTo.length < 7) {
    throw new Error(`Invalid destination WhatsApp number: "${to}". Must contain at least 7 digits.`);
  }

  const cleanText = String(message || '').trim();
  if (!cleanText) {
    throw new Error('Message body cannot be empty.');
  }

  const jid = `${formattedTo}@s.whatsapp.net`;

  // 1. If an active socket is already connected in memory (e.g. running background daemon), use it directly
  const existingSock = activeSockets.get(cleanUser);
  if (existingSock) {
    try {
      console.log(`[Baileys Client] Using active in-memory socket for ${cleanUser} to send to ${jid}`);
      const res = await existingSock.sendMessage(jid, { text: cleanText });
      const messageId = res?.key?.id || `msg_${Date.now()}`;
      return {
        ok: true,
        messageId,
        to: formattedTo,
        detail: `Message sent via active WhatsApp socket to +${formattedTo}`,
      };
    } catch (err: any) {
      console.warn(`[Baileys Client] Active socket send failed, falling back to Firestore session:`, err.message);
    }
  }

  // 2. Load creds from Firestore and create makeWASocket with auth from DB, send then close
  console.log(`[Baileys Client] Loading credentials from Firestore for user ${cleanUser}...`);
  const { state, saveCreds } = await useFirestoreAuthState(cleanUser);

  if (!state.creds?.registered) {
    throw new Error(
      `WhatsApp is not connected for user "${cleanUser}". Please scan the QR code first in FlowPilot WhatsApp QR.`
    );
  }

  return new Promise<{ ok: boolean; messageId: string; to: string; detail: string }>((resolve, reject) => {
    let resolved = false;
    let ephemeralSock: WASocket | null = null;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (ephemeralSock) {
          try {
            ephemeralSock.end(undefined);
          } catch {
            // ignore
          }
        }
        reject(new Error('WhatsApp connection timed out while sending message. Please re-scan QR code.'));
      }
    }, 25000);

    try {
      ephemeralSock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false,
        logger,
        browser: ['FlowPilot CRM', 'Chrome', '124.0.0'],
        connectTimeoutMs: 20000,
        syncFullHistory: false,
      });

      ephemeralSock.ev.on('creds.update', saveCreds);

      ephemeralSock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
          try {
            console.log(`[Baileys Client] Ephemeral socket connected. Sending message to ${jid}...`);
            const sendResult = await ephemeralSock!.sendMessage(jid, { text: cleanText });
            const messageId = sendResult?.key?.id || `msg_${Date.now()}`;

            // Save creds before closing
            await saveCreds();

            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              // Cleanly close ephemeral socket as requested: "send then close"
              setTimeout(() => {
                try {
                  ephemeralSock?.end(undefined);
                } catch {
                  // ignore
                }
              }, 500);

              resolve({
                ok: true,
                messageId,
                to: formattedTo,
                detail: `Message delivered via Firebase Firestore WhatsApp session to +${formattedTo}`,
              });
            }
          } catch (sendErr: any) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              try {
                ephemeralSock?.end(undefined);
              } catch {
                // ignore
              }
              reject(sendErr);
            }
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          if (statusCode === DisconnectReason.loggedOut) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              reject(new Error('WhatsApp logged out. Please reconnect by scanning the QR code again.'));
            }
          }
        }
      });
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}
