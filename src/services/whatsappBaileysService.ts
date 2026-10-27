import makeWASocket, {
  DisconnectReason,
  makeCacheableSignalKeyStore,
  WASocket,
  ConnectionState,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { startAutoResponder } from '../lib/whatsapp/listener.js';
import { startAutoResponderWorkflowListener } from '../lib/whatsapp/autoResponder.js';
import { useFirestoreAuthState, saveAuthState, getSessionConnectionStatus } from '../lib/whatsapp/session.js';
import { getFirestoreDoc, setFirestoreDoc } from '../lib/firebaseAdmin.js';

export interface WhatsAppSessionState {
  userId: string;
  connected: boolean;
  number: string;
  connectedAt?: string;
  qr: string; // Base64 data URL
  qrRaw?: string; // Raw QR string for Canvas rendering
  qrExpiresAt?: number;
  lastDisconnectReason?: string;
  reconnectAttempts: number;
}

const logger = pino({ level: 'silent' });
const SESSIONS_DIR = path.join(process.cwd(), 'whatsapp-sessions');

if (!fs.existsSync(SESSIONS_DIR)) {
  try {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create whatsapp-sessions directory:', err);
  }
}

// In-memory registry of active Baileys sockets
export const activeSockets = new Map<string, WASocket>();
export const sessionStates = new Map<string, WhatsAppSessionState>();
const qrGenerationPromises = new Map<string, Promise<WhatsAppSessionState>>();

/**
 * Returns active Baileys WASocket for a user
 */
export function getWhatsAppSock(userId: string = 'default_workspace'): WASocket | undefined {
  return activeSockets.get((userId || 'default_workspace').trim());
}

/**
 * Format phone numbers according to WhatsApp international standard.
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
 * Metadata file path for persisting connected status across server restarts
 */
function getMetaFilePath(userId: string): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(SESSIONS_DIR, `${safeUser}.json`);
}

function getUserSessionDir(userId: string): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(SESSIONS_DIR, safeUser);
}

function loadSessionMeta(userId: string): Partial<WhatsAppSessionState> | null {
  try {
    const metaFile = getMetaFilePath(userId);
    if (fs.existsSync(metaFile)) {
      const raw = fs.readFileSync(metaFile, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn(`[Baileys] Error reading meta file for ${userId}:`, err);
  }
  return null;
}

function saveSessionMeta(userId: string, data: Partial<WhatsAppSessionState>): void {
  try {
    const metaFile = getMetaFilePath(userId);
    const existing = loadSessionMeta(userId) || {};
    const updated = {
      ...existing,
      ...data,
      userId,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(metaFile, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[Baileys] Error saving meta file for ${userId}:`, err);
  }
}

/**
 * Starts or retrieves an active Baileys session for a given user.
 * Generates QR code as base64 if not connected.
 */
export async function getOrStartWhatsAppSession(
  userId: string = 'default_workspace',
  forceRefreshQr: boolean = false
): Promise<WhatsAppSessionState> {
  const cleanUserId = (userId || 'default_workspace').trim();

  // If already connected and active, or if a valid QR code is already alive and fresh, return immediately
  const existingSocket = activeSockets.get(cleanUserId);
  const existingState = sessionStates.get(cleanUserId);

  if (existingSocket && !forceRefreshQr) {
    if (existingState?.connected) {
      return existingState;
    }
    // Return existing valid QR code if it has not expired yet
    if (existingState?.qr && (existingState.qrExpiresAt || 0) > Date.now()) {
      return existingState;
    }
  }

  // If a QR request is already pending, reuse promise to avoid multiple simultaneous socket creates
  if (qrGenerationPromises.has(cleanUserId) && !forceRefreshQr) {
    return qrGenerationPromises.get(cleanUserId)!;
  }

  const promise = (async () => {
    try {
      // Custom Firebase Admin Firestore auth state (Vercel serverless compatible)
      const { state, saveCreds } = await useFirestoreAuthState(cleanUserId);

      let currentState: WhatsAppSessionState = sessionStates.get(cleanUserId) || {
        userId: cleanUserId,
        connected: false,
        number: '',
        qr: '',
        reconnectAttempts: 0,
      };

      // Load persisted meta from Firestore or local fallback
      try {
        const firestoreStatus = await getSessionConnectionStatus(cleanUserId);
        if (firestoreStatus?.connected) {
          currentState.connected = true;
          if (firestoreStatus.number) currentState.number = firestoreStatus.number;
          if (firestoreStatus.updatedAt) currentState.connectedAt = firestoreStatus.updatedAt;
        }
      } catch {
        // Fallback to local meta if Firestore check fails
        const savedMeta = loadSessionMeta(cleanUserId);
        if (savedMeta?.number) currentState.number = savedMeta.number;
        if (savedMeta?.connectedAt) currentState.connectedAt = savedMeta.connectedAt;
      }

      sessionStates.set(cleanUserId, currentState);

      // If an existing socket is in error or needs refresh, close it gracefully
      if (existingSocket) {
        try {
          existingSocket.end(undefined);
          await new Promise((r) => setTimeout(r, 200));
        } catch {
          // Ignore close error
        }
        activeSockets.delete(cleanUserId);
      }

      const sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false,
        logger,
        syncFullHistory: false,
        browser: ['FlowPilot CRM', 'Chrome', '124.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

      activeSockets.set(cleanUserId, sock);
      (sock as any)._flowpilot_userId = cleanUserId;

      // Automatically register WhatsApp Auto-Responder Listener & Workflow Engine
      startAutoResponder(sock, { userId: cleanUserId });
      startAutoResponderWorkflowListener(sock, { userId: cleanUserId });

      // Save credentials on updates to Firestore
      sock.ev.on('creds.update', async () => {
        try {
          await saveCreds();
        } catch (err: any) {
          console.warn(`[Baileys] Error saving creds to Firestore:`, err.message);
        }
      });

      // Handle connection updates (QR code & connected status)
      sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            currentState.qrRaw = qr;
            // 1. Save QR string to Firestore collection whatsapp_qr doc userId
            setFirestoreDoc('whatsapp_qr', cleanUserId, {
              userId: cleanUserId,
              qrCode: qr,
              status: 'pending',
              createdAt: new Date().toISOString(),
            }).catch((err) => console.warn('[Baileys] Firestore whatsapp_qr save error:', err.message));

            // 2. Also generate base64 data URL for fast direct image display
            const qrDataUrl = await QRCode.toDataURL(qr, {
              width: 320,
              margin: 2,
              color: {
                dark: '#0f172a',
                light: '#ffffff',
              },
            });
            currentState.qr = qrDataUrl;
            currentState.qrExpiresAt = Date.now() + 60000;
            currentState.connected = false;
            sessionStates.set(cleanUserId, { ...currentState });
            console.log(`[Baileys] Generated new QR code for user ${cleanUserId}`);
          } catch (qrErr) {
            console.error('[Baileys] QR Data URL generation error:', qrErr);
          }
        }

        if (connection === 'open') {
          const rawId = sock.user?.id || '';
          const phoneDigits = rawId.split(':')[0] || rawId.split('@')[0] || '';
          const formatted = phoneDigits ? formatWhatsAppNumber(phoneDigits) : '';
          const nowIso = new Date().toISOString();

          currentState.connected = true;
          currentState.number = formatted;
          currentState.connectedAt = currentState.connectedAt || nowIso;
          currentState.qr = '';
          currentState.qrRaw = '';
          currentState.qrExpiresAt = undefined;
          currentState.reconnectAttempts = 0;

          sessionStates.set(cleanUserId, { ...currentState });

          // Update Firestore collection whatsapp_sessions and whatsapp_qr
          setFirestoreDoc('whatsapp_sessions', cleanUserId, {
            userId: cleanUserId,
            connected: true,
            number: formatted,
            updatedAt: nowIso,
          }, true).catch((e) => console.warn('[Baileys] Firestore session status error:', e.message));

          setFirestoreDoc('whatsapp_qr', cleanUserId, {
            userId: cleanUserId,
            qrCode: '',
            status: 'connected',
            updatedAt: nowIso,
          }, true).catch(() => {});

          saveSessionMeta(cleanUserId, {
            connected: true,
            number: formatted,
            connectedAt: currentState.connectedAt,
          });

          console.log(`[Baileys] WhatsApp connected successfully for user ${cleanUserId} as +${formatted}`);
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(
            `[Baileys] Connection closed for user ${cleanUserId}. Status: ${statusCode}, Reconnect: ${shouldReconnect}`
          );

          currentState.connected = false;
          currentState.lastDisconnectReason = lastDisconnect?.error?.message || `Status: ${statusCode}`;
          sessionStates.set(cleanUserId, { ...currentState });

          if (shouldReconnect) {
            // Auto-reconnect with backoff
            currentState.reconnectAttempts = (currentState.reconnectAttempts || 0) + 1;
            const delay = Math.min(currentState.reconnectAttempts * 3000, 15000);
            setTimeout(() => {
              getOrStartWhatsAppSession(cleanUserId, false).catch((err) =>
                console.error(`[Baileys] Auto-reconnect failed for ${cleanUserId}:`, err)
              );
            }, delay);
          } else {
            // Logged out by user: clean up session
            disconnectWhatsAppSession(cleanUserId);
          }
        }
      });

      // Wait up to 3 seconds for QR or connection to arrive, breaking immediately once generated
      if (!state.creds?.registered && !currentState.connected && !currentState.qr) {
        const start = Date.now();
        while (Date.now() - start < 3000) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const updated = sessionStates.get(cleanUserId);
          if (updated && (updated.qr || updated.connected)) {
            currentState = updated;
            break;
          }
        }
      }

      return sessionStates.get(cleanUserId) || currentState;
    } finally {
      qrGenerationPromises.delete(cleanUserId);
    }
  })();

  qrGenerationPromises.set(cleanUserId, promise);
  return promise;
}

/**
 * Returns current session status for a user.
 */
export function getWhatsAppSessionStatus(userId: string = 'default_workspace'): WhatsAppSessionState {
  const cleanUserId = (userId || 'default_workspace').trim();
  const current = sessionStates.get(cleanUserId);

  if (current) {
    return current;
  }

  const meta = loadSessionMeta(cleanUserId);
  if (meta && meta.connected && meta.number) {
    const recovered: WhatsAppSessionState = {
      userId: cleanUserId,
      connected: true,
      number: meta.number,
      connectedAt: meta.connectedAt,
      qr: '',
      reconnectAttempts: 0,
    };
    sessionStates.set(cleanUserId, recovered);
    return recovered;
  }

  return {
    userId: cleanUserId,
    connected: false,
    number: '',
    qr: '',
    reconnectAttempts: 0,
  };
}

/**
 * Disconnects the WhatsApp session and deletes stored authentication files.
 */
export function disconnectWhatsAppSession(userId: string = 'default_workspace'): { ok: boolean; message: string } {
  const cleanUserId = (userId || 'default_workspace').trim();
  const sock = activeSockets.get(cleanUserId);

  if (sock) {
    try {
      sock.logout().catch(() => {});
      sock.end(undefined);
    } catch {
      // Ignore cleanup error
    }
    activeSockets.delete(cleanUserId);
  }

  sessionStates.delete(cleanUserId);

  // Update Firestore collections
  setFirestoreDoc('whatsapp_sessions', cleanUserId, {
    userId: cleanUserId,
    connected: false,
    updatedAt: new Date().toISOString(),
  }, true).catch(() => {});

  setFirestoreDoc('whatsapp_qr', cleanUserId, {
    userId: cleanUserId,
    qrCode: '',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
  }, true).catch(() => {});

  // Remove local session folder and metadata if present
  try {
    const sessionDir = getUserSessionDir(cleanUserId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    const metaFile = getMetaFilePath(cleanUserId);
    if (fs.existsSync(metaFile)) {
      fs.unlinkSync(metaFile);
    }
  } catch (err) {
    console.error(`[Baileys] Error deleting session files for ${cleanUserId}:`, err);
  }

  console.log(`[Baileys] Session disconnected and Firestore updated for ${cleanUserId}`);
  return { ok: true, message: 'WhatsApp session disconnected successfully' };
}

/**
 * Sends a message using the active Baileys socket.
 * Enforces destination number formatting (0 -> 234) and standard JID.
 */
export async function sendWhatsAppMessage(
  userId: string = 'default_workspace',
  to: string,
  message: string
): Promise<{ ok: boolean; messageId: string; to: string; detail: string }> {
  const cleanUserId = (userId || 'default_workspace').trim();
  let sock = activeSockets.get(cleanUserId);

  // If socket is not active in memory, attempt auto-reconnect from saved session
  if (!sock) {
    const meta = loadSessionMeta(cleanUserId);
    if (meta && meta.connected) {
      await getOrStartWhatsAppSession(cleanUserId, false);
      sock = activeSockets.get(cleanUserId);
    }
  }

  if (!sock) {
    throw new Error(
      'WhatsApp is not connected. Please scan the QR code first in WhatsApp QR Connect.'
    );
  }

  const formattedTo = formatWhatsAppNumber(to);
  if (!formattedTo || formattedTo.length < 7) {
    throw new Error(`Invalid destination WhatsApp number: "${to}". Must contain at least 7 digits.`);
  }

  const jid = `${formattedTo}@s.whatsapp.net`;
  const cleanText = String(message || '').trim();

  if (!cleanText) {
    throw new Error('Message body cannot be empty.');
  }

  console.log(`[Baileys] Sending WhatsApp message to ${jid} via user ${cleanUserId}...`);
  const result = await sock.sendMessage(jid, { text: cleanText });

  const messageId = result?.key?.id || `wa_msg_${Date.now()}`;
  return {
    ok: true,
    messageId,
    to: formattedTo,
    detail: `Message delivered via Baileys WhatsApp QR Socket to +${formattedTo}`,
  };
}

/**
 * Auto-restore all saved sessions on server startup
 */
export async function autoRestoreSavedWhatsAppSessions(): Promise<void> {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) return;
    const entries = fs.readdirSync(SESSIONS_DIR);

    for (const entry of entries) {
      if (entry.endsWith('.json')) {
        const userId = entry.replace(/\.json$/, '');
        const meta = loadSessionMeta(userId);
        if (meta?.connected) {
          console.log(`[Baileys] Auto-restoring saved WhatsApp session for user: ${userId}`);
          getOrStartWhatsAppSession(userId, false).catch((err) =>
            console.warn(`[Baileys] Failed to auto-restore session for ${userId}:`, err)
          );
        }
      }
    }
  } catch (err) {
    console.error('[Baileys] Error auto-restoring sessions:', err);
  }
}
