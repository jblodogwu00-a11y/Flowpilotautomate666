import { getFirestoreDoc } from '../../../../src/lib/firebaseAdmin.js';
import { getWhatsAppSessionStatus } from '../../../../src/services/whatsappBaileysService.js';

/**
 * 3. STATUS ENDPOINT:
 * File app/api/whatsapp/status/route.ts
 * - GET ?userId=xxx check Firestore whatsapp_sessions if creds exist and connected
 * - Return { connected, phoneNumber }
 */
export async function GET(req: any) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = (searchParams.get('userId') || 'default_workspace').trim();

    // 1. Check if whatsapp_sessions/{userId} exists and connected in Firestore
    const sessionDoc = await getFirestoreDoc('whatsapp_sessions', userId);
    if (sessionDoc) {
      const phone = sessionDoc.number || sessionDoc.phoneNumber || '';
      return Response.json({
        connected: Boolean(sessionDoc.connected),
        phoneNumber: phone,
        number: phone,
        pairingCode: sessionDoc.pairingCode || '',
        updatedAt: sessionDoc.updatedAt || null,
      });
    }

    // 2. Fallback to active in-memory socket / session state
    const localStatus = getWhatsAppSessionStatus(userId);
    return Response.json({
      connected: Boolean(localStatus.connected),
      phoneNumber: localStatus.number || '',
      number: localStatus.number || '',
      updatedAt: localStatus.connectedAt || null,
    });
  } catch (err: any) {
    return Response.json(
      { connected: false, phoneNumber: '', number: '', error: err.message },
      { status: 500 }
    );
  }
}
