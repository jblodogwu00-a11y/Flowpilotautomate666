import { sendWhatsAppMessage } from '../../../../src/services/whatsappBaileysService.js';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { to, message, userId = 'default_workspace' } = body;

    if (!to || !message) {
      return Response.json(
        { ok: false, error: 'Recipient phone number (to) and message text are required.' },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppMessage(userId, to, message);

    return Response.json({
      ok: true,
      messageId: result.messageId,
      to: result.to,
      detail: result.detail,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err.message || 'Failed to dispatch WhatsApp message via Baileys socket' },
      { status: 500 }
    );
  }
}
