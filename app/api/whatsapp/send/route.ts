import { sendWhatsAppMessage } from '../../../../src/lib/whatsapp/client.js';

export async function POST(req: any) {
  try {
    const body = await req.json().catch(() => ({}));
    const { to, message, text, body: bodyText, userId = 'default_workspace' } = body;
    const recipient = String(to || '').trim();
    const messageContent = String(message || text || bodyText || '').trim();

    if (!recipient || !messageContent) {
      return Response.json(
        { ok: false, error: 'Recipient phone number (to) and message text are required.' },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppMessage(userId, recipient, messageContent);

    return Response.json({
      ok: true,
      messageId: result.messageId,
      to: result.to,
      detail: result.detail,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err.message || 'Failed to dispatch WhatsApp message via Baileys socket' },
      { status: 500 }
    );
  }
}
