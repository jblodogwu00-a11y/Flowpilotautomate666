import { parseJsonBody } from './_evolution.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      ok: true,
      service: 'FlowPilot Evolution Webhook Endpoint',
      status: 'listening',
    });
  }

  try {
    const body = parseJsonBody(req);
    const event = String(body?.event || body?.type || '').toUpperCase();
    const instance = String(body?.instance || body?.instanceName || '').trim();
    const data = body?.data || body || {};
    const key = data?.key || data?.message?.key || {};

    if (key?.fromMe === true) {
      return res.status(200).json({ success: true, ok: true, ignored: 'fromMe' });
    }

    const remoteJid = String(key?.remoteJid || '').trim();
    const leadPhone = remoteJid.split('@')[0].replace(/[^0-9]/g, '');
    const msg = data?.message || {};
    const text =
      msg?.conversation ||
      msg?.extendedTextMessage?.text ||
      msg?.imageMessage?.caption ||
      msg?.videoMessage?.caption ||
      '';

    return res.status(200).json({
      success: true,
      ok: true,
      received: true,
      event,
      instance,
      leadPhone,
      text: String(text || '').trim(),
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      ok: false,
      error: err?.message || 'Webhook processing error',
    });
  }
}
