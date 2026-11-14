import {
  buildInstanceName,
  evolutionRequest,
  extractQrCode,
  inspectConnectionSummary,
  sanitizeId,
} from './_evolution.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true, ok: true });
  }

  try {
    const rawUserId = String(
      req.query?.userId || req.headers['x-user-id'] || ''
    ).trim();
    const rawInstance = String(req.query?.instanceName || '').trim();
    const derivedUid =
      rawUserId ||
      (rawInstance && rawInstance.startsWith('flowpilot-')
        ? rawInstance.slice('flowpilot-'.length)
        : '');

    if (!derivedUid || derivedUid === 'default_workspace') {
      return res.status(200).json({
        success: false,
        ok: false,
        status: 'close',
        connected: false,
        error: 'Authenticated userId or flowpilot instanceName is required.',
      });
    }

    const userId = sanitizeId(derivedUid, 'user');
    const instanceName = buildInstanceName(userId, rawInstance);
    const summary = await inspectConnectionSummary(instanceName);

    let qrCode = null;
    let pairingCode = null;
    let upstreamCount = null;

    if (summary.status !== 'open') {
      const connectRes = await evolutionRequest(
        `/instance/connect/${encodeURIComponent(instanceName)}`
      );
      if (connectRes.ok && connectRes.data) {
        if (typeof connectRes.data.count === 'number') {
          upstreamCount = connectRes.data.count;
        }
        const extracted = await extractQrCode(connectRes.data);
        qrCode = extracted.qrCode;
        pairingCode = extracted.pairingCode;
      }
    }

    const phone = summary.ownerJid
      ? summary.ownerJid.split('@')[0].replace(/[^0-9+]/g, '')
      : '';

    return res.status(200).json({
      success: true,
      ok: true,
      connected: summary.status === 'open',
      instanceName,
      userId,
      status: summary.status,
      qrCode,
      pairingCode,
      qrPending: summary.status !== 'open' && !qrCode,
      upstreamCount,
      ownerJid: summary.ownerJid,
      profileName: summary.profileName,
      phoneNumber: phone,
      number: phone,
      disconnectionReasonCode: summary.disconnectionReasonCode,
      detail:
        summary.status === 'open'
          ? 'WhatsApp Connected'
          : qrCode
          ? 'Scan with your WhatsApp'
          : `Session status is "${summary.status}".`,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      ok: false,
      connected: false,
      status: 'close',
      error: err?.message || 'Failed to poll Evolution WhatsApp status.',
    });
  }
}
