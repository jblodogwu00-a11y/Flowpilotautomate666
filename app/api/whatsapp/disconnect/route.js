import { disconnectWhatsAppSession } from '../../../../src/services/whatsappBaileysService.js';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId || 'default_workspace';

    const result = disconnectWhatsAppSession(userId);
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { ok: false, error: err.message || 'Failed to disconnect WhatsApp session' },
      { status: 500 }
    );
  }
}
