import QRCode from 'qrcode';
import { formatWhatsAppPhoneFromJid, htmlToWhatsAppText } from '../utils/richMessageFormat';

export const EVOLUTION_URL = 'https://incomestream.duckdns.org';
export const API_KEY = 'stakecut-secret-12345';
export const EVOLUTION_API_KEY = API_KEY;

export type EvolutionConnectionStatus = 'open' | 'close' | 'connecting';

export interface EvolutionClientSessionResult {
  ok: boolean;
  instanceName: string;
  userId: string;
  status: EvolutionConnectionStatus;
  qrCode: string | null;
  pairingCode: string | null;
  upstreamCount: number | null;
  ownerJid: string | null;
  phoneNumber: string | null;
  profileName: string | null;
  disconnectionReasonCode: number | null;
  detail: string;
  checkedAt: string;
  error?: string;
}

export interface EvolutionSendTextResult {
  ok: boolean;
  messageId?: string;
  instanceName: string;
  to: string;
  provider: string;
  detail: string;
  error?: string;
}

export function sanitizeEvolutionId(raw: string, fallback = 'user'): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (cleaned || fallback).slice(0, 128);
}

export function buildEvolutionInstanceName(userId: string): string {
  const cleanUid = sanitizeEvolutionId(userId, 'user');
  return `flowpilot-${cleanUid}`.slice(0, 160);
}

export function normalizeEvolutionStatus(raw: unknown): EvolutionConnectionStatus {
  const normalized = String(raw || '')
    .trim()
    .toLowerCase();
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

function formatBrowserFetchError(err: unknown, endpoint: string): string {
  const rawMessage = err instanceof Error ? err.message : String(err || 'Network error');
  return `${rawMessage} (${EVOLUTION_URL}${endpoint})`;
}

async function parseEvolutionResponse(res: Response): Promise<any> {
  const rawText = await res.text();
  try {
    return rawText ? JSON.parse(rawText) : {};
  } catch {
    return { rawText };
  }
}

export async function extractQrFromEvolutionPayload(payload: any): Promise<{
  qrCode: string | null;
  pairingCode: string | null;
}> {
  if (!payload || typeof payload !== 'object') {
    return { qrCode: null, pairingCode: null };
  }

  const pairingRaw =
    payload.pairingCode ||
    payload.qrcode?.pairingCode ||
    payload.data?.pairingCode ||
    null;
  const pairingCode = pairingRaw ? String(pairingRaw).trim() : null;

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

async function fetchInstanceMetadata(instanceName: string): Promise<{
  stateRaw: string | null;
  ownerJid: string | null;
  profileName: string | null;
  disconnectionReasonCode: number | null;
  stateStatusCode: number;
  exists: boolean;
}> {
  const stateEndpoint = `/instance/connectionState/${encodeURIComponent(instanceName)}`;
  const stateRes = await fetch(`${EVOLUTION_URL}${stateEndpoint}`, {
    method: 'GET',
    headers: { apikey: EVOLUTION_API_KEY },
  });
  const stateData = await parseEvolutionResponse(stateRes);
  console.log(`[Evolution] GET ${stateEndpoint} (${stateRes.status}):`, stateData);

  let stateRaw: string | null =
    stateData?.instance?.state || stateData?.state || null;
  let ownerJid: string | null = null;
  let profileName: string | null = null;
  let disconnectionReasonCode: number | null = null;
  let exists = stateRes.ok;

  try {
    const listEndpoint = `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`;
    const listRes = await fetch(`${EVOLUTION_URL}${listEndpoint}`, {
      method: 'GET',
      headers: { apikey: EVOLUTION_API_KEY },
    });
    const listData = await parseEvolutionResponse(listRes);
    console.log(`[Evolution] GET ${listEndpoint} (${listRes.status}):`, listData);

    if (listRes.ok && Array.isArray(listData) && listData.length > 0) {
      const found =
        listData.find(
          (item: any) =>
            item?.name === instanceName || item?.instance?.instanceName === instanceName
        ) || listData[0];

      if (found) {
        exists = true;
        if (!stateRaw) {
          stateRaw = found.connectionStatus || found.instance?.status || null;
        }
        ownerJid =
          found.ownerJid ||
          found.owner ||
          found.instance?.owner ||
          found.number ||
          stateData?.instance?.owner ||
          null;
        profileName =
          found.profileName ||
          found.instance?.profileName ||
          found.pushName ||
          null;
        if (typeof found.disconnectionReasonCode === 'number') {
          disconnectionReasonCode = found.disconnectionReasonCode;
        }
      }
    }
  } catch (listErr) {
    console.warn('[Evolution] fetchInstances notice:', listErr);
  }

  return {
    stateRaw,
    ownerJid,
    profileName,
    disconnectionReasonCode,
    stateStatusCode: stateRes.status,
    exists,
  };
}

/**
 * Direct Browser -> Evolution API Connect Flow (No Backend /api calls):
 * 1. instanceName = "flowpilot-" + userId
 * 2. POST ${EVOLUTION_URL}/instance/create with { instanceName, integration: "WHATSAPP-BAILEYS", qrcode: true }
 * 3. GET ${EVOLUTION_URL}/instance/connect/${instanceName}
 * 4. Returns base64 QR code and live connection state
 */
export async function createAndConnectEvolutionInstance(
  userId: string,
  forceRestart = false
): Promise<EvolutionClientSessionResult> {
  const cleanUid = sanitizeEvolutionId(userId, 'user');
  const instanceName = buildEvolutionInstanceName(cleanUid);
  const nowIso = new Date().toISOString();

  let qrCode: string | null = null;
  let pairingCode: string | null = null;
  let upstreamCount: number | null = null;

  try {
    // 1. Create instance directly on Evolution API
    const createRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      }),
    });
    const createData = await parseEvolutionResponse(createRes);
    console.log(`[Evolution] POST /instance/create (${createRes.status}):`, createData);

    if (createRes.ok) {
      const extracted = await extractQrFromEvolutionPayload(createData);
      qrCode = extracted.qrCode;
      pairingCode = extracted.pairingCode;
    } else {
      const errText = JSON.stringify(createData || '').toLowerCase();
      const alreadyExists =
        createRes.status === 403 ||
        createRes.status === 409 ||
        errText.includes('already in use') ||
        errText.includes('already exists');

      if (!alreadyExists) {
        const msg =
          createData?.response?.message?.[0] ||
          createData?.message ||
          createData?.error ||
          `Evolution API /instance/create returned HTTP ${createRes.status}`;
        return {
          ok: false,
          instanceName,
          userId: cleanUid,
          status: 'close',
          qrCode: null,
          pairingCode: null,
          upstreamCount: null,
          ownerJid: null,
          phoneNumber: null,
          profileName: null,
          disconnectionReasonCode: null,
          detail: String(msg),
          error: String(msg),
          checkedAt: nowIso,
        };
      }
    }

    // Optional restart if user clicked Reconnect on an existing instance
    if (forceRestart) {
      try {
        const restartEndpoint = `/instance/restart/${encodeURIComponent(instanceName)}`;
        const restartRes = await fetch(`${EVOLUTION_URL}${restartEndpoint}`, {
          method: 'POST',
          headers: { apikey: EVOLUTION_API_KEY },
        });
        const restartData = await parseEvolutionResponse(restartRes);
        console.log(`[Evolution] POST ${restartEndpoint} (${restartRes.status}):`, restartData);
        qrCode = null;
        pairingCode = null;
        await new Promise((r) => setTimeout(r, 600));
      } catch (restartErr) {
        console.warn('[Evolution] instance restart notice:', restartErr);
      }
    }

    // 2. Check state first to see if already open
    let meta = await fetchInstanceMetadata(instanceName);
    let status = normalizeEvolutionStatus(meta.stateRaw);

    // 3. Call GET /instance/connect/${instanceName} directly to get base64 QR
    let connectErrorMessage: string | null = null;
    if (status !== 'open' && !qrCode) {
      const connectEndpoint = `/instance/connect/${encodeURIComponent(instanceName)}`;
      const connectRes = await fetch(`${EVOLUTION_URL}${connectEndpoint}`, {
        method: 'GET',
        headers: { apikey: EVOLUTION_API_KEY },
      });
      const connectData = await parseEvolutionResponse(connectRes);
      console.log(`[Evolution] GET ${connectEndpoint} (${connectRes.status}):`, connectData);

      if (!connectRes.ok) {
        connectErrorMessage =
          connectData?.response?.message?.[0] ||
          connectData?.message ||
          connectData?.error ||
          `Evolution /instance/connect returned HTTP ${connectRes.status}`;
        console.error(`[Evolution] GET ${connectEndpoint} error:`, connectRes.status, connectData);
      }

      if (typeof connectData?.count === 'number') {
        upstreamCount = connectData.count;
      }

      const extracted = await extractQrFromEvolutionPayload(connectData);
      qrCode = extracted.qrCode;
      pairingCode = extracted.pairingCode || pairingCode;

      // Retry once if Baileys is still warming up count: 0 without base64 yet
      if (connectRes.ok && !qrCode && (connectData?.count === 0 || !connectData?.base64)) {
        await new Promise((r) => setTimeout(r, 850));
        const retryRes = await fetch(`${EVOLUTION_URL}${connectEndpoint}`, {
          method: 'GET',
          headers: { apikey: EVOLUTION_API_KEY },
        });
        const retryData = await parseEvolutionResponse(retryRes);
        console.log(`[Evolution] GET ${connectEndpoint} retry (${retryRes.status}):`, retryData);

        if (!retryRes.ok) {
          connectErrorMessage =
            retryData?.response?.message?.[0] ||
            retryData?.message ||
            retryData?.error ||
            `Evolution /instance/connect retry returned HTTP ${retryRes.status}`;
          console.error(`[Evolution] GET ${connectEndpoint} retry error:`, retryRes.status, retryData);
        }

        if (typeof retryData?.count === 'number') {
          upstreamCount = retryData.count;
        }
        const retryExtracted = await extractQrFromEvolutionPayload(retryData);
        qrCode = retryExtracted.qrCode;
        pairingCode = retryExtracted.pairingCode || pairingCode;
      }

      meta = await fetchInstanceMetadata(instanceName);
      status = normalizeEvolutionStatus(meta.stateRaw);
    }

    if (status !== 'open' && !qrCode && connectErrorMessage) {
      return {
        ok: false,
        instanceName,
        userId: cleanUid,
        status,
        qrCode: null,
        pairingCode,
        upstreamCount,
        ownerJid: meta.ownerJid,
        phoneNumber: formatWhatsAppPhoneFromJid(meta.ownerJid) || null,
        profileName: meta.profileName,
        disconnectionReasonCode: meta.disconnectionReasonCode,
        detail: String(connectErrorMessage),
        error: String(connectErrorMessage),
        checkedAt: new Date().toISOString(),
      };
    }

    const detail =
      status === 'open'
        ? 'WhatsApp Connected'
        : qrCode
        ? 'Scan with your WhatsApp'
        : `Instance ready (${instanceName}). Awaiting QR image from Evolution API (count: ${upstreamCount ?? 0}).`;

    return {
      ok: true,
      instanceName,
      userId: cleanUid,
      status,
      qrCode,
      pairingCode,
      upstreamCount,
      ownerJid: meta.ownerJid,
      phoneNumber: formatWhatsAppPhoneFromJid(meta.ownerJid) || null,
      profileName: meta.profileName,
      disconnectionReasonCode: meta.disconnectionReasonCode,
      detail,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    const errMsg = formatBrowserFetchError(err, '/instance/create');
    console.error('[Evolution] createAndConnect error:', err);
    return {
      ok: false,
      instanceName,
      userId: cleanUid,
      status: 'close',
      qrCode: null,
      pairingCode: null,
      upstreamCount: null,
      ownerJid: null,
      phoneNumber: null,
      profileName: null,
      disconnectionReasonCode: null,
      detail: errMsg,
      error: errMsg,
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * Direct Browser -> Evolution API Status Poll:
 * Calls GET ${EVOLUTION_URL}/instance/connectionState/${instanceName}
 */
export async function checkEvolutionConnectionState(
  userId: string,
  includeQrIfClosed = true
): Promise<EvolutionClientSessionResult> {
  const cleanUid = sanitizeEvolutionId(userId, 'user');
  const instanceName = buildEvolutionInstanceName(cleanUid);

  try {
    const meta = await fetchInstanceMetadata(instanceName);

    if (!meta.exists && meta.stateStatusCode === 404) {
      if (!includeQrIfClosed) {
        return {
          ok: true,
          instanceName,
          userId: cleanUid,
          status: 'close',
          qrCode: null,
          pairingCode: null,
          upstreamCount: null,
          ownerJid: null,
          phoneNumber: null,
          profileName: null,
          disconnectionReasonCode: null,
          detail: 'WhatsApp instance has not been initialized yet.',
          checkedAt: new Date().toISOString(),
        };
      }
      return createAndConnectEvolutionInstance(cleanUid, false);
    }

    const status = normalizeEvolutionStatus(meta.stateRaw);
    let qrCode: string | null = null;
    let pairingCode: string | null = null;
    let upstreamCount: number | null = null;

    if (status !== 'open' && includeQrIfClosed) {
      const connectEndpoint = `/instance/connect/${encodeURIComponent(instanceName)}`;
      const connectRes = await fetch(`${EVOLUTION_URL}${connectEndpoint}`, {
        method: 'GET',
        headers: { apikey: EVOLUTION_API_KEY },
      });
      const connectData = await parseEvolutionResponse(connectRes);
      console.log(`[Evolution] GET ${connectEndpoint} (poll, ${connectRes.status}):`, connectData);

      if (typeof connectData?.count === 'number') {
        upstreamCount = connectData.count;
      }
      const extracted = await extractQrFromEvolutionPayload(connectData);
      qrCode = extracted.qrCode;
      pairingCode = extracted.pairingCode;
    }

    const detail =
      status === 'open'
        ? 'WhatsApp Connected'
        : qrCode
        ? 'Scan with your WhatsApp'
        : `Session state is "${meta.stateRaw || 'close'}".`;

    return {
      ok: true,
      instanceName,
      userId: cleanUid,
      status,
      qrCode,
      pairingCode,
      upstreamCount,
      ownerJid: meta.ownerJid,
      phoneNumber: formatWhatsAppPhoneFromJid(meta.ownerJid) || null,
      profileName: meta.profileName,
      disconnectionReasonCode: meta.disconnectionReasonCode,
      detail,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    const errMsg = formatBrowserFetchError(err, `/instance/connectionState/${instanceName}`);
    console.error('[Evolution] checkConnectionState error:', err);
    return {
      ok: false,
      instanceName,
      userId: cleanUid,
      status: 'close',
      qrCode: null,
      pairingCode: null,
      upstreamCount: null,
      ownerJid: null,
      phoneNumber: null,
      profileName: null,
      disconnectionReasonCode: null,
      detail: errMsg,
      error: errMsg,
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * Direct Browser -> Evolution API Disconnect:
 * DELETE ${EVOLUTION_URL}/instance/logout/${instanceName}
 */
export async function disconnectEvolutionInstance(
  userId: string
): Promise<{ ok: boolean; instanceName: string; error?: string }> {
  const cleanUid = sanitizeEvolutionId(userId, 'user');
  const instanceName = buildEvolutionInstanceName(cleanUid);
  const endpoint = `/instance/logout/${encodeURIComponent(instanceName)}`;

  try {
    const res = await fetch(`${EVOLUTION_URL}${endpoint}`, {
      method: 'DELETE',
      headers: { apikey: EVOLUTION_API_KEY },
    });
    const data = await parseEvolutionResponse(res);
    console.log(`[Evolution] DELETE ${endpoint} (${res.status}):`, data);

    if (!res.ok && res.status !== 404 && res.status !== 400) {
      return {
        ok: false,
        instanceName,
        error: data?.message || data?.error || `Failed to logout instance (HTTP ${res.status})`,
      };
    }

    return { ok: true, instanceName };
  } catch (err) {
    const errMsg = formatBrowserFetchError(err, endpoint);
    console.error('[Evolution] disconnect error:', err);
    return { ok: false, instanceName, error: errMsg };
  }
}

/**
 * Direct Browser -> Evolution API Send Text Message:
 * POST ${EVOLUTION_URL}/message/sendText/${instanceName}
 */
export async function sendEvolutionTextMessage(params: {
  userId?: string;
  instanceName?: string;
  to: string;
  text: string;
}): Promise<EvolutionSendTextResult> {
  const cleanUid = sanitizeEvolutionId(params.userId || 'user', 'user');
  const instanceName = params.instanceName || buildEvolutionInstanceName(cleanUid);
  const cleanPhone = String(params.to || '').replace(/[^0-9]/g, '');
  const cleanText = htmlToWhatsAppText(String(params.text || '')).trim();

  if (!cleanPhone || !cleanText) {
    return {
      ok: false,
      instanceName,
      to: cleanPhone,
      provider: 'Evolution API (Direct)',
      detail: 'Recipient phone number and non-empty message text are required.',
      error: 'Recipient phone number and non-empty message text are required.',
    };
  }

  try {
    const stateRes = await fetch(
      `${EVOLUTION_URL}/instance/connectionState/${encodeURIComponent(instanceName)}`,
      {
        method: 'GET',
        headers: { apikey: EVOLUTION_API_KEY },
      }
    );
    const stateData = await parseEvolutionResponse(stateRes);
    console.log(
      `[Evolution] GET /instance/connectionState/${instanceName} pre-send (${stateRes.status}):`,
      stateData
    );

    const state = normalizeEvolutionStatus(stateData?.instance?.state || stateData?.state);
    if (state !== 'open') {
      const msg = `WhatsApp instance "${instanceName}" is disconnected (state: ${state}). Please scan the QR code first.`;
      return {
        ok: false,
        instanceName,
        to: cleanPhone,
        provider: 'Evolution API (Direct)',
        detail: msg,
        error: msg,
      };
    }

    const sendEndpoint = `/message/sendText/${encodeURIComponent(instanceName)}`;
    const sendRes = await fetch(`${EVOLUTION_URL}${sendEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: cleanText,
      }),
    });
    const sendData = await parseEvolutionResponse(sendRes);
    console.log(`[Evolution] POST ${sendEndpoint} (${sendRes.status}):`, sendData);

    if (!sendRes.ok) {
      const errMsg =
        sendData?.response?.message?.[0] ||
        sendData?.message ||
        sendData?.error ||
        `Evolution sendText returned HTTP ${sendRes.status}`;
      return {
        ok: false,
        instanceName,
        to: cleanPhone,
        provider: 'Evolution API (Direct)',
        detail: String(errMsg),
        error: String(errMsg),
      };
    }

    const messageId =
      sendData?.key?.id ||
      sendData?.messageId ||
      `evo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    return {
      ok: true,
      messageId,
      instanceName,
      to: cleanPhone,
      provider: 'Evolution API v2.3.5 (Direct)',
      detail: `Sent via Evolution API (${instanceName}) to +${cleanPhone}`,
    };
  } catch (err) {
    const errMsg = formatBrowserFetchError(err, `/message/sendText/${instanceName}`);
    console.error('[Evolution] sendText error:', err);
    return {
      ok: false,
      instanceName,
      to: cleanPhone,
      provider: 'Evolution API (Direct)',
      detail: errMsg,
      error: errMsg,
    };
  }
}

/**
 * Direct Browser -> Evolution API Phone Pairing Code Request:
 * POST ${EVOLUTION_URL}/instance/create + GET ${EVOLUTION_URL}/instance/connect/${instanceName}?number=${phone}
 */
export async function requestEvolutionPairingCode(
  userId: string,
  phoneNumber: string
): Promise<{
  ok: boolean;
  connected?: boolean;
  pairingCode?: string;
  phoneNumber?: string;
  error?: string;
}> {
  const cleanUid = sanitizeEvolutionId(userId, 'user');
  const instanceName = buildEvolutionInstanceName(cleanUid);
  const cleanPhone = String(phoneNumber || '').replace(/[^0-9]/g, '');

  try {
    const createRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: false,
        number: cleanPhone,
      }),
    });
    const createData = await parseEvolutionResponse(createRes);
    console.log(`[Evolution] POST /instance/create (pairing, ${createRes.status}):`, createData);

    const stateCheck = await checkEvolutionConnectionState(cleanUid, false);
    if (stateCheck.status === 'open') {
      return {
        ok: true,
        connected: true,
        phoneNumber: cleanPhone,
      };
    }

    const connectEndpoint = `/instance/connect/${encodeURIComponent(instanceName)}?number=${encodeURIComponent(cleanPhone)}`;
    const connectRes = await fetch(`${EVOLUTION_URL}${connectEndpoint}`, {
      method: 'GET',
      headers: { apikey: EVOLUTION_API_KEY },
    });
    const connectData = await parseEvolutionResponse(connectRes);
    console.log(`[Evolution] GET ${connectEndpoint} (${connectRes.status}):`, connectData);

    const code =
      connectData?.pairingCode ||
      connectData?.qrcode?.pairingCode ||
      createData?.qrcode?.pairingCode ||
      '';

    if (!code) {
      return {
        ok: false,
        error:
          connectData?.message ||
          connectData?.error ||
          'Evolution did not return a pairing code for this number. Try QR scanning instead.',
      };
    }

    return {
      ok: true,
      connected: false,
      pairingCode: String(code),
      phoneNumber: cleanPhone,
    };
  } catch (err) {
    const errMsg = formatBrowserFetchError(err, `/instance/connect/${instanceName}`);
    console.error('[Evolution] pairingCode error:', err);
    return {
      ok: false,
      error: errMsg,
    };
  }
}
