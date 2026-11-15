import QRCode from 'qrcode';

export function getEvolutionEnv() {
  const rawUrl =
    process.env.EVOLUTION_URL ||
    process.env.EVOLUTION_API_URL ||
    'https://incomestream.duckdns.org';
  const baseUrl = String(rawUrl)
    .trim()
    .replace(/\/manager\/?$/i, '')
    .replace(/\/+$/, '');
  const apiKey = String(
    process.env.EVOLUTION_API_KEY || 'stakecut-secret-12345'
  ).trim();

  return { baseUrl, apiKey };
}

export function sanitizeId(raw, fallback = 'user') {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (cleaned || fallback).slice(0, 128);
}

export function buildInstanceName(userId, requestedName) {
  const cleanUid = sanitizeId(userId, 'user');
  const defaultName = `flowpilot-${cleanUid}`;
  if (requestedName && String(requestedName).trim()) {
    const cleanedReq = sanitizeId(requestedName, defaultName);
    if (cleanedReq.startsWith('flowpilot-')) {
      return cleanedReq.slice(0, 160);
    }
  }
  return defaultName.slice(0, 160);
}

export function normalizeStatus(raw) {
  const normalized = String(raw || '').trim().toLowerCase();
  if (normalized === 'open' || normalized === 'connected' || normalized === 'online') {
    return 'open';
  }
  if (
    normalized === 'connecting' ||
    normalized === 'qr' ||
    normalized === 'pairing' ||
    normalized === 'initializing'
  ) {
    return 'connecting';
  }
  return 'close';
}

export function parseJsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export async function evolutionRequest(endpointPath, { method = 'GET', body } = {}) {
  const { baseUrl, apiKey } = getEvolutionEnv();
  const targetUrl = `${baseUrl}${endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(targetUrl, {
      method,
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let parsed = {};
    try {
      parsed = rawText ? JSON.parse(rawText) : {};
    } catch {
      parsed = { message: rawText.slice(0, 300) };
    }

    return {
      ok: response.ok,
      status: response.status,
      data: parsed,
      rawText,
    };
  } catch (err) {
    const msg =
      err?.name === 'AbortError'
        ? 'Evolution API request timed out after 12 seconds.'
        : err?.message || 'Failed to reach Evolution API server.';
    return {
      ok: false,
      status: 502,
      data: { error: msg },
      rawText: msg,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractQrCode(payload) {
  if (!payload || typeof payload !== 'object') {
    return { qrCode: null, pairingCode: null };
  }

  const pairingCodeRaw =
    payload.pairingCode ||
    payload.qrcode?.pairingCode ||
    payload.data?.pairingCode ||
    null;
  const pairingCode = pairingCodeRaw ? String(pairingCodeRaw).trim() : null;

  const base64Candidate =
    payload.base64 ||
    payload.qrcode?.base64 ||
    payload.data?.base64 ||
    '';

  if (typeof base64Candidate === 'string' && base64Candidate.trim().length > 20) {
    const trimmed = base64Candidate.trim();
    return {
      qrCode: trimmed.startsWith('data:image/')
        ? trimmed
        : `data:image/png;base64,${trimmed}`,
      pairingCode,
    };
  }

  const rawCode =
    payload.code ||
    payload.qrcode?.code ||
    payload.qr ||
    payload.data?.code ||
    '';

  if (typeof rawCode === 'string' && rawCode.trim().length > 10) {
    try {
      const dataUrl = await QRCode.toDataURL(rawCode.trim(), {
        width: 320,
        margin: 2,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
      });
      return { qrCode: dataUrl, pairingCode };
    } catch {
      return { qrCode: null, pairingCode };
    }
  }

  return { qrCode: null, pairingCode };
}

export async function inspectConnectionSummary(instanceName) {
  const [stateRes, listRes] = await Promise.all([
    evolutionRequest(`/instance/connectionState/${encodeURIComponent(instanceName)}`),
    evolutionRequest(`/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`),
  ]);

  let rawState = stateRes.data?.instance?.state || stateRes.data?.state;
  let ownerJid = null;
  let profileName = null;
  let disconnectionReasonCode = null;
  let exists = stateRes.ok;

  if (listRes.ok && Array.isArray(listRes.data)) {
    const found =
      listRes.data.find(
        (item) =>
          item?.name === instanceName || item?.instance?.instanceName === instanceName
      ) || listRes.data[0];

    if (found) {
      exists = true;
      rawState = rawState || found.connectionStatus || found.state || found.instance?.status;
      ownerJid = found.ownerJid || found.instance?.owner || null;
      profileName = found.profileName || found.instance?.profileName || null;
      if (typeof found.disconnectionReasonCode === 'number') {
        disconnectionReasonCode = found.disconnectionReasonCode;
      }
    }
  }

  return {
    status: normalizeStatus(rawState),
    ownerJid,
    profileName,
    disconnectionReasonCode,
    exists,
  };
}
