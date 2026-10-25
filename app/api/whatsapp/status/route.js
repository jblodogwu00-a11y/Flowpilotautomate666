import { getWhatsAppSessionStatus } from '../../../../src/services/whatsappBaileysService.js';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'default_workspace';

    const status = getWhatsAppSessionStatus(userId);

    return Response.json({
      connected: Boolean(status.connected),
      number: status.number || '',
      connectedAt: status.connectedAt || null,
    });
  } catch (err) {
    return Response.json(
      { connected: false, number: '', error: err.message },
      { status: 500 }
    );
  }
}
