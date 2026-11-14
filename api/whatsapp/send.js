import {
  buildInstanceName,
  evolutionRequest,
  inspectConnectionSummary,
  parseJsonBody,
  sanitizeId,
} from './_evolution.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true, ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(200).json({
      success: false,
      ok: false,
      error: 'Method not allowed. Use POST /api/whatsapp/send.',
    });
  }

  try {
    const body = parseJsonBody(req);
    const rawUserId = String(
      body?.userId || req.headers['x-user-id'] || 'default_workspace'
    ).trim();
    const userId = sanitizeId(rawUserId, 'default_workspace');
    const instanceName = buildInstanceName(userId, body?.instanceName);
    const targetPhone = String(body?.to || body?.number || '').replace(/[^0-9]/g, '');
    const content = String(body?.message || body?.text || body?.body || '').trim();

    if (!targetPhone || !content) {
      return res.status(200).json({
        success: false,
        ok: false,
        error: 'Recipient phone number and non-empty message text are required.',
      });
    }

    const summary = await inspectConnectionSummary(instanceName);
    if (summary.status !== 'open') {
      return res.status(200).json({
        success: false,
        ok: false,
        provider: 'Evolution API (v2.3.5)',
        error: `WhatsApp instance "${instanceName}" is disconnected (${summary.status}). Scan QR code to connect first.`,
        detail: `Instance "${instanceName}" is currently "${summary.status}".`,
      });
    }

    const sendRes = await evolutionRequest(
      `/message/sendText/${encodeURIComponent(instanceName)}`,
      {
        method: 'POST',
        body: {
          number: targetPhone,
          text: content,
        },
      }
    );

    if (!sendRes.ok) {
      const errorMsg =
        sendRes.data?.response?.message?.[0] ||
        sendRes.data?.message ||
        sendRes.data?.error ||
        `Evolution sendText failed (HTTP ${sendRes.status})`;
      return res.status(200).json({
        success: false,
        ok: false,
        provider: 'Evolution API (v2.3.5)',
        error: String(errorMsg),
        detail: String(errorMsg),
      });
    }

    const messageId =
      sendRes.data?.key?.id ||
      sendRes.data?.messageId ||
      `evo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    return res.status(200).json({
      success: true,
      ok: true,
      deliveredViaApi: true,
      provider: 'Evolution API (v2.3.5)',
      messageId,
      to: targetPhone,
      detail: `Sent via Evolution instance ${instanceName} to +${targetPhone}`,
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      ok: false,
      error: err?.message || 'Failed to send WhatsApp message via Evolution API.',
    });
  }
}
