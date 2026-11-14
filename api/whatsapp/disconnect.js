import {
  buildInstanceName,
  evolutionRequest,
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
      status: 'close',
      error: 'Method not allowed. Use POST /api/whatsapp/disconnect.',
    });
  }

  try {
    const body = parseJsonBody(req);
    const rawUserId = String(
      body?.userId || req.query?.userId || req.headers['x-user-id'] || ''
    ).trim();

    if (!rawUserId || rawUserId === 'default_workspace') {
      return res.status(200).json({
        success: false,
        ok: false,
        status: 'close',
        error: 'Authentication required.',
      });
    }

    const userId = sanitizeId(rawUserId, 'user');
    const instanceName = buildInstanceName(userId, body?.instanceName);

    const logoutRes = await evolutionRequest(
      `/instance/logout/${encodeURIComponent(instanceName)}`,
      { method: 'DELETE' }
    );

    if (!logoutRes.ok && logoutRes.status !== 404 && logoutRes.status !== 400) {
      return res.status(200).json({
        success: false,
        ok: false,
        instanceName,
        status: 'close',
        error:
          logoutRes.data?.message ||
          logoutRes.data?.error ||
          `Failed to log out instance (HTTP ${logoutRes.status})`,
      });
    }

    return res.status(200).json({
      success: true,
      ok: true,
      instanceName,
      status: 'close',
      message: 'WhatsApp session disconnected successfully.',
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      ok: false,
      status: 'close',
      error: err?.message || 'Failed to disconnect WhatsApp session.',
    });
  }
}
