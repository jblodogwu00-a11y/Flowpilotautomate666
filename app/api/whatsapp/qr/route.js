import { getOrStartWhatsAppSession } from '../../../../src/services/whatsappBaileysService.js';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'default_workspace';
    const refresh = searchParams.get('refresh') === 'true';

    const session = await getOrStartWhatsAppSession(userId, refresh);

    return Response.json({
      ok: true,
      connected: session.connected,
      number: session.number || '',
      connectedAt: session.connectedAt || '',
      qr: session.qr || '',
      qrExpiresAt: session.qrExpiresAt || 0,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err.message || 'Failed to start WhatsApp QR session' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId || 'default_workspace';
    const refresh = Boolean(body.refresh);

    const session = await getOrStartWhatsAppSession(userId, refresh);

    return Response.json({
      ok: true,
      connected: session.connected,
      number: session.number || '',
      connectedAt: session.connectedAt || '',
      qr: session.qr || '',
      qrExpiresAt: session.qrExpiresAt || 0,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err.message || 'Failed to start WhatsApp QR session' },
      { status: 500 }
    );
  }
}
