import { getFirestoreDoc } from '../../../../src/lib/firebaseAdmin.js';
import { getWhatsAppSessionStatus } from '../../../../src/services/whatsappBaileysService.js';

/**
 * 4. STATUS ENDPOINT app/api/whatsapp/status/route.ts:
 * - Check if whatsapp_sessions/{userId} exists and connected
 * - Return connected true/false
 */
export async function GET(req: any) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = (searchParams.get('userId') || 'default_workspace').trim();

    // 1. Check if whatsapp_sessions/{userId} exists and connected in Firestore
    const sessionDoc = await getFirestoreDoc('whatsapp_sessions', userId);
    if (sessionDoc) {
      return Response.json({
        connected: Boolean(sessionDoc.connected),
        number: sessionDoc.number || '',
        updatedAt: sessionDoc.updatedAt || null,
      });
    }

    // 2. Fallback to active in-memory socket / session state
    const localStatus = getWhatsAppSessionStatus(userId);
    return Response.json({
      connected: Boolean(localStatus.connected),
      number: localStatus.number || '',
      updatedAt: localStatus.connectedAt || null,
    });
  } catch (err: any) {
    return Response.json(
      { connected: false, number: '', error: err.message },
      { status: 500 }
    );
  }
}
