import { requestWhatsAppPairingCode } from '../../../../src/services/whatsappBaileysService.js';
import { getFirestoreDoc, setFirestoreDoc } from '../../../../src/lib/firebaseAdmin.js';

/**
 * 2. PAIRING CODE ENDPOINT app/api/whatsapp/pairing-code/route.ts:
 * - POST body { userId, phoneNumber } e.g phoneNumber = 2348012345678 (no + no space)
 * - Import makeWASocket from @whiskeysockets/baileys
 * - Create custom Firestore auth from Firebase Admin - collection whatsapp_sessions
 * - Create socket without printQRInTerminal
 * - After socket created, wait 3 seconds then call: sock.requestPairingCode(phoneNumber)
 * - Return JSON { pairingCode: code e.g "8HJK-QWER" } formatted as XXXX-XXXX
 * - Save session to Firestore
 * - Handle errors: if phoneNumber invalid return error
 */
export async function POST(req: any) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = (body.userId || 'default_workspace').trim();
    const rawPhone = String(body.phoneNumber || body.phone || '').trim();

    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

    if (!cleanPhone || cleanPhone.length < 8 || cleanPhone.length > 16) {
      return Response.json(
        {
          ok: false,
          error: `Invalid phone number: "${rawPhone}". Please provide a valid phone number with country code (e.g. 2348012345678, 8 to 16 digits).`,
        },
        { status: 400 }
      );
    }

    // Check if session is already connected
    const sessionDoc = await getFirestoreDoc('whatsapp_sessions', userId);
    if (sessionDoc && sessionDoc.connected) {
      return Response.json({
        ok: true,
        connected: true,
        phoneNumber: sessionDoc.number || cleanPhone,
        message: 'WhatsApp session is already connected!',
      });
    }

    // Request pairing code via Baileys & Firestore session
    const result = await requestWhatsAppPairingCode(userId, cleanPhone);

    if (!result.ok || !result.pairingCode) {
      throw new Error(result.error || 'Failed to retrieve WhatsApp pairing code.');
    }

    return Response.json({
      ok: true,
      pairingCode: result.pairingCode,
      phoneNumber: cleanPhone,
      expiresInSeconds: 60,
    });
  } catch (err: any) {
    console.error('[API /api/whatsapp/pairing-code] Error:', err);
    return Response.json(
      {
        ok: false,
        error: err.message || 'Failed to request WhatsApp pairing code.',
      },
      { status: 500 }
    );
  }
}
