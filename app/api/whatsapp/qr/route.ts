import { getFirestoreDoc, setFirestoreDoc } from '../../../../src/lib/firebaseAdmin.js';
import { getOrStartWhatsAppSession } from '../../../../src/services/whatsappBaileysService.js';

/**
 * 3. QR ENDPOINT app/api/whatsapp/qr/route.ts:
 * - Generate QR with Baileys
 * - Save QR string to Firestore collection whatsapp_qr doc userId
 * - Return JSON { qr: qrString }
 * - Polling method not websocket because Vercel serverless cannot keep socket alive
 */
export async function GET(req: any) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = (searchParams.get('userId') || 'default_workspace').trim();
    const refresh = searchParams.get('refresh') === 'true';

    // 1. Check if user is already connected in Firestore whatsapp_sessions
    const sessionDoc = await getFirestoreDoc('whatsapp_sessions', userId);
    if (sessionDoc && sessionDoc.connected) {
      return Response.json({
        ok: true,
        connected: true,
        number: sessionDoc.number || '',
        qr: '',
      });
    }

    // 2. Check existing pending QR in Firestore whatsapp_qr doc userId
    if (!refresh) {
      const qrDoc = await getFirestoreDoc('whatsapp_qr', userId);
      if (qrDoc && qrDoc.status === 'pending' && qrDoc.qrCode) {
        const ageMs = Date.now() - new Date(qrDoc.createdAt || 0).getTime();
        // If generated within last 50 seconds, reuse QR string
        if (ageMs < 50000) {
          return Response.json({
            ok: true,
            connected: false,
            qr: qrDoc.qrCode,
            number: '',
          });
        }
      }
    }

    // 3. Generate QR with Baileys
    const session = await getOrStartWhatsAppSession(userId, refresh);
    const qrString = session.qrRaw || session.qr || '';

    // 4. Save QR string to Firestore collection whatsapp_qr doc userId
    if (qrString && !session.connected) {
      await setFirestoreDoc(
        'whatsapp_qr',
        userId,
        {
          userId,
          qrCode: qrString,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        true
      );
    }

    return Response.json({
      ok: true,
      connected: Boolean(session.connected),
      number: session.number || '',
      qr: qrString,
    });
  } catch (err: any) {
    console.error('[API /api/whatsapp/qr] Error:', err);
    return Response.json(
      { ok: false, error: err.message || 'Failed to generate WhatsApp QR' },
      { status: 500 }
    );
  }
}

export async function POST(req: any) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = (body.userId || 'default_workspace').trim();
    const refresh = Boolean(body.refresh);

    const sessionDoc = await getFirestoreDoc('whatsapp_sessions', userId);
    if (sessionDoc && sessionDoc.connected) {
      return Response.json({
        ok: true,
        connected: true,
        number: sessionDoc.number || '',
        qr: '',
      });
    }

    const session = await getOrStartWhatsAppSession(userId, refresh);
    const qrString = session.qrRaw || session.qr || '';

    if (qrString && !session.connected) {
      await setFirestoreDoc(
        'whatsapp_qr',
        userId,
        {
          userId,
          qrCode: qrString,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        true
      );
    }

    return Response.json({
      ok: true,
      connected: Boolean(session.connected),
      number: session.number || '',
      qr: qrString,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err.message || 'Failed to generate WhatsApp QR' },
      { status: 500 }
    );
  }
}
