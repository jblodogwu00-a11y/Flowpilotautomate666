import {
  buildInstanceName,
  evolutionRequest,
  extractQrCode,
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
      status: 'close',
      error: 'Method not allowed. Use POST /api/whatsapp/connect.',
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
        error: 'Please sign in before connecting WhatsApp.',
      });
    }

    const userId = sanitizeId(rawUserId, 'user');
    const instanceName = buildInstanceName(userId, body?.instanceName);
    const forceRestart = Boolean(body?.forceRestart || body?.reconnect);

    // 1. Create or ensure instance on Evolution API
    const createRes = await evolutionRequest('/instance/create', {
      method: 'POST',
      body: {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      },
    });

    let qrCode = null;
    let pairingCode = null;

    if (createRes.ok) {
      const extracted = await extractQrCode(createRes.data);
      qrCode = extracted.qrCode;
      pairingCode = extracted.pairingCode;
    } else {
      const errText = JSON.stringify(createRes.data || createRes.rawText || '').toLowerCase();
      const alreadyExists =
        createRes.status === 403 ||
        createRes.status === 409 ||
        errText.includes('already in use') ||
        errText.includes('already exists');

      if (!alreadyExists && createRes.status !== 200 && createRes.status !== 201) {
        const upstreamMsg =
          createRes.data?.response?.message?.[0] ||
          createRes.data?.message ||
          createRes.data?.error ||
          `Evolution API returned HTTP ${createRes.status}`;
        return res.status(200).json({
          success: false,
          ok: false,
          instanceName,
          userId,
          status: 'close',
          qrCode: null,
          error: String(upstreamMsg),
        });
      }
    }

    // Best-effort webhook configuration pointing back to this deployment
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
      evolutionRequest(`/webhook/set/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        body: {
          webhook: {
            enabled: true,
            url: `${proto}://${host}/api/whatsapp/evolution-webhook`,
            byEvents: false,
            events: ['MESSAGES_UPSERT'],
          },
        },
      }).catch(() => {});
    }

    if (forceRestart) {
      await evolutionRequest(`/instance/restart/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
      });
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    // 2. Inspect live connection state
    let summary = await inspectConnectionSummary(instanceName);
    let upstreamCount = null;

    // 3. Call GET /instance/connect/{instanceName} to fetch base64 QR
    if (summary.status !== 'open' && !qrCode) {
      let connectRes = await evolutionRequest(
        `/instance/connect/${encodeURIComponent(instanceName)}`
      );

      if (connectRes.ok && connectRes.data) {
        if (typeof connectRes.data.count === 'number') {
          upstreamCount = connectRes.data.count;
        }
        const extracted = await extractQrCode(connectRes.data);
        qrCode = extracted.qrCode;
        pairingCode = extracted.pairingCode || pairingCode;

        if (!qrCode && (connectRes.data.count === 0 || !connectRes.data.base64)) {
          await new Promise((resolve) => setTimeout(resolve, 850));
          connectRes = await evolutionRequest(
            `/instance/connect/${encodeURIComponent(instanceName)}`
          );
          if (connectRes.ok && connectRes.data) {
            if (typeof connectRes.data.count === 'number') {
              upstreamCount = connectRes.data.count;
            }
            const retryExtracted = await extractQrCode(connectRes.data);
            qrCode = retryExtracted.qrCode;
            pairingCode = retryExtracted.pairingCode || pairingCode;
          }
        }
      }

      summary = await inspectConnectionSummary(instanceName);
    }

    const detail =
      summary.status === 'open'
        ? 'WhatsApp Connected'
        : qrCode
        ? 'Scan with your WhatsApp'
        : `Instance initialized (${instanceName}). Awaiting QR code payload from Evolution API.`;

    return res.status(200).json({
      success: true,
      ok: true,
      instanceName,
      userId,
      status: summary.status,
      qrCode,
      pairingCode,
      qrPending: summary.status !== 'open' && !qrCode,
      upstreamCount,
      ownerJid: summary.ownerJid,
      profileName: summary.profileName,
      disconnectionReasonCode: summary.disconnectionReasonCode,
      detail,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      ok: false,
      status: 'close',
      error: err?.message || 'Failed to connect WhatsApp instance.',
    });
  }
}
