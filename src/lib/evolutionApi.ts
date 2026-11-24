import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import {
  hasFirebaseServiceAccount,
  getFirestoreDoc,
  setFirestoreDoc,
} from './firebaseAdmin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_FILE_PATH = path.join(__dirname, '../../.env');

export type EvolutionConnectionStatus = 'open' | 'close' | 'connecting';

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
}

export interface EvolutionInitResult {
  ok: boolean;
  instanceName: string;
  userId: string;
  status: EvolutionConnectionStatus;
  qrCode: string | null;
  pairingCode: string | null;
  qrPending: boolean;
  upstreamCount: number | null;
  ownerJid: string | null;
  profileName: string | null;
  disconnectionReasonCode: number | null;
  detail: string;
  checkedAt: string;
  error?: string;
}

export interface SendWhatsAppResult {
  ok: boolean;
  messageId?: string;
  instanceName: string;
  to: string;
  detail: string;
  error?: string;
}

function readEnvFallback(key: string): string {
  const fromProcess = (process.env[key] || '').trim();
  if (fromProcess) return fromProcess;

  if (fs.existsSync(ENV_FILE_PATH)) {
    try {
      const content = fs.readFileSync(ENV_FILE_PATH, 'utf-8');
      const regex = new RegExp(`^${key}\\s*=\\s*([^\\r\\n]+)`, 'm');
      const match = content.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch {
      // Ignore read errors
    }
  }
  return '';
}

export function getEvolutionConfig(): EvolutionConfig {
  const rawUrl =
    readEnvFallback('EVOLUTION_URL') ||
    readEnvFallback('EVOLUTION_API_URL') ||
    'https://incomestream.duckdns.org';
  const baseUrl = rawUrl
    .replace(/\/manager\/?$/i, '')
    .replace(/\/+$/, '');
  const apiKey =
    readEnvFallback('EVOLUTION_API_KEY') || 'stakecut-secret-12345';
  return { baseUrl, apiKey };
}

export function sanitizeEvolutionId(raw: string, fallback = 'workspace'): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (cleaned || fallback).slice(0, 128);
}

export function buildEvolutionInstanceName(
  userId: string,
  requestedInstanceName?: string
): string {
  const cleanUid = sanitizeEvolutionId(userId, 'user');
  const defaultName = `flowpilot-${cleanUid}`;
  if (requestedInstanceName && requestedInstanceName.trim()) {
    const cleanedReq = sanitizeEvolutionId(requestedInstanceName, defaultName);
    if (cleanedReq.startsWith('flowpilot-')) {
      return cleanedReq.slice(0, 160);
    }
  }
  return defaultName.slice(0, 160);
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

export async function evolutionFetch(
  endpointPath: string,
  init: { method?: string; body?: Record<string, unknown> } = {}
): Promise<{
  ok: boolean;
  status: number;
  data: any;
  rawText: string;
}> {
  const { baseUrl, apiKey } = getEvolutionConfig();
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      data: { error: 'EVOLUTION_API_KEY is not configured on the server.' },
      rawText: 'EVOLUTION_API_KEY is not configured on the server.',
    };
  }

  const targetUrl = `${baseUrl}${endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(targetUrl, {
      method: init.method || 'GET',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let parsed: any = null;
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
  } catch (err: any) {
    const message =
      err?.name === 'AbortError'
        ? 'Evolution API request timed out after 12 seconds.'
        : err?.message || 'Failed to reach Evolution API server.';
    return {
      ok: false,
      status: 502,
      data: { error: message },
      rawText: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function extractQrCodeDataUrl(payload: any): Promise<{
  qrCode: string | null;
  pairingCode: string | null;
}> {
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

async function syncAdminWhatsAppConnectionDoc(
  userId: string,
  instanceName: string,
  status: EvolutionConnectionStatus
): Promise<void> {
  if (!hasFirebaseServiceAccount()) return;
  try {
    const existing = await getFirestoreDoc('whatsapp_connections', userId);
    const nowIso = new Date().toISOString();
    await setFirestoreDoc(
      'whatsapp_connections',
      userId,
      {
        userId,
        instanceName,
        status,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      },
      true
    );
  } catch (err) {
    console.warn('[Evolution API] Admin Firestore sync notice:', err);
  }
}

export async function inspectInstanceSummary(instanceName: string): Promise<{
  status: EvolutionConnectionStatus;
  ownerJid: string | null;
  profileName: string | null;
  disconnectionReasonCode: number | null;
  exists: boolean;
}> {
  const [stateRes, listRes] = await Promise.all([
    evolutionFetch(`/instance/connectionState/${encodeURIComponent(instanceName)}`),
    evolutionFetch(`/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`),
  ]);

  let rawState: string | undefined =
    stateRes.data?.instance?.state || stateRes.data?.state;
  let ownerJid: string | null = null;
  let profileName: string | null = null;
  let disconnectionReasonCode: number | null = null;
  let exists = stateRes.ok;

  if (listRes.ok && Array.isArray(listRes.data)) {
    const found =
      listRes.data.find(
        (item: any) =>
          item?.name === instanceName || item?.instance?.instanceName === instanceName
      ) || listRes.data[0];
    if (found) {
      exists = true;
      if (!rawState) {
        rawState = found.connectionStatus || found.instance?.status;
      }
      ownerJid = found.ownerJid || found.instance?.owner || null;
      profileName = found.profileName || found.instance?.profileName || null;
      if (typeof found.disconnectionReasonCode === 'number') {
        disconnectionReasonCode = found.disconnectionReasonCode;
      }
    }
  }

  return {
    status: normalizeEvolutionStatus(rawState),
    ownerJid,
    profileName,
    disconnectionReasonCode,
    exists,
  };
}

const WHATSAPP_INSTANCES_STORE_PATH = path.join(__dirname, '../../.data/whatsapp_instances_store.json');

function registerInstanceOwner(instanceName: string, userId: string): void {
  try {
    const dir = path.dirname(WHATSAPP_INSTANCES_STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    let store: { instances: Record<string, string> } = { instances: {} };
    if (fs.existsSync(WHATSAPP_INSTANCES_STORE_PATH)) {
      const raw = fs.readFileSync(WHATSAPP_INSTANCES_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.instances) {
        store.instances = parsed.instances;
      }
    }
    store.instances[instanceName] = userId;
    fs.writeFileSync(WHATSAPP_INSTANCES_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Evolution API] Register instance owner notice:', err);
  }
}

export function resolveUserIdForInstance(instanceName: string): string {
  const cleanInstance = String(instanceName || '').trim();
  if (!cleanInstance) return 'default_workspace';

  try {
    if (fs.existsSync(WHATSAPP_INSTANCES_STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(WHATSAPP_INSTANCES_STORE_PATH, 'utf-8'));
      if (parsed && parsed.instances && parsed.instances[cleanInstance]) {
        return String(parsed.instances[cleanInstance]);
      }
    }
  } catch {
    // Non-fatal
  }

  if (cleanInstance.startsWith('flowpilot-')) {
    return cleanInstance.slice('flowpilot-'.length);
  }
  if (cleanInstance.startsWith('user_')) {
    const parts = cleanInstance.split('_');
    if (parts.length >= 2 && parts[1]) {
      return parts[1];
    }
  }

  return cleanInstance;
}

/**
 * Configure webhook URL on the Evolution instance so messages.upsert events
 * are routed directly to FlowPilot's global POST /api/webhooks/evolution
 */
export async function configureInstanceWebhook(
  instanceName: string,
  webhookUrl?: string
): Promise<boolean> {
  const envVal =
    typeof process !== 'undefined'
      ? process.env?.APP_URL || process.env?.NEXT_PUBLIC_APP_URL || ''
      : '';
  const appUrl = envVal ? envVal.replace(/\/+$/, '') : 'https://flowpilotautomate666-4js9.vercel.app';
  const targetUrl =
    webhookUrl ||
    `${appUrl}/api/webhooks/evolution`;

  const payload = {
    enabled: true,
    url: targetUrl,
    byEvents: false,
    events: ['MESSAGES_UPSERT'],
    webhook: {
      enabled: true,
      url: targetUrl,
      byEvents: false,
      events: ['MESSAGES_UPSERT'],
    },
  };

  const res = await evolutionFetch(`/webhook/set/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    body: payload,
  });

  console.log(`[Evolution] Set webhook for instance "${instanceName}" to "${targetUrl}": status ${res.status}`);
  return res.ok || res.status === 200 || res.status === 201;
}

export async function initializeEvolutionConnection(params: {
  userId: string;
  instanceName?: string;
  forceRestart?: boolean;
  webhookUrl?: string;
}): Promise<EvolutionInitResult> {
  const userId = sanitizeEvolutionId(params.userId, 'user');
  const instanceName = buildEvolutionInstanceName(userId, params.instanceName);
  const nowIso = new Date().toISOString();

  const { apiKey } = getEvolutionConfig();
  if (!apiKey) {
    return {
      ok: false,
      instanceName,
      userId,
      status: 'close',
      qrCode: null,
      pairingCode: null,
      qrPending: false,
      upstreamCount: null,
      ownerJid: null,
      profileName: null,
      disconnectionReasonCode: null,
      detail: 'Evolution API key is not configured on the server.',
      error: 'Evolution API key (EVOLUTION_API_KEY) is not configured on the server.',
      checkedAt: nowIso,
    };
  }

  // 1. Create or ensure instance on Evolution API (v2.3.5 requires integration: WHATSAPP-BAILEYS)
  const createRes = await evolutionFetch('/instance/create', {
    method: 'POST',
    body: {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    },
  });

  let qrCode: string | null = null;
  let pairingCode: string | null = null;

  if (createRes.ok) {
    const extracted = await extractQrCodeDataUrl(createRes.data);
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
      return {
        ok: false,
        instanceName,
        userId,
        status: 'close',
        qrCode: null,
        pairingCode: null,
        qrPending: false,
        upstreamCount: null,
        ownerJid: null,
        profileName: null,
        disconnectionReasonCode: null,
        detail: String(upstreamMsg),
        error: String(upstreamMsg),
        checkedAt: nowIso,
      };
    }
  }

  // Register instance owner mapping
  registerInstanceOwner(instanceName, userId);

  // Automatically ensure the instance is subscribed to our webhook
  configureInstanceWebhook(instanceName, params.webhookUrl).catch(() => {});

  if (params.forceRestart) {
    await evolutionFetch(`/instance/restart/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
    });
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  // 2. Inspect live connection state
  let summary = await inspectInstanceSummary(instanceName);
  let upstreamCount: number | null = null;

  // 3. Retrieve QR code if not already connected ('open') and no QR extracted yet
  if (summary.status !== 'open' && !qrCode) {
    let connectRes = await evolutionFetch(
      `/instance/connect/${encodeURIComponent(instanceName)}`
    );

    if (connectRes.ok && connectRes.data) {
      if (typeof connectRes.data.count === 'number') {
        upstreamCount = connectRes.data.count;
      }
      const extracted = await extractQrCodeDataUrl(connectRes.data);
      qrCode = extracted.qrCode;
      pairingCode = extracted.pairingCode || pairingCode;

      if (!qrCode && (connectRes.data.count === 0 || !connectRes.data.base64)) {
        await new Promise((resolve) => setTimeout(resolve, 850));
        connectRes = await evolutionFetch(
          `/instance/connect/${encodeURIComponent(instanceName)}`
        );
        if (connectRes.ok && connectRes.data) {
          if (typeof connectRes.data.count === 'number') {
            upstreamCount = connectRes.data.count;
          }
          const retryExtracted = await extractQrCodeDataUrl(connectRes.data);
          qrCode = retryExtracted.qrCode;
          pairingCode = retryExtracted.pairingCode || pairingCode;
        }
      }
    }

    summary = await inspectInstanceSummary(instanceName);
  }

  await syncAdminWhatsAppConnectionDoc(userId, instanceName, summary.status);

  const detail =
    summary.status === 'open'
      ? 'WhatsApp Connected'
      : qrCode
      ? 'Scan with your WhatsApp'
      : `Instance initialized (${instanceName}). Awaiting QR code payload from Evolution API (count: ${upstreamCount ?? 0}).`;

  return {
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
  };
}

export async function getEvolutionConnectionStatus(params: {
  userId: string;
  instanceName?: string;
}): Promise<EvolutionInitResult> {
  const userId = sanitizeEvolutionId(params.userId, 'user');
  const instanceName = buildEvolutionInstanceName(userId, params.instanceName);
  const nowIso = new Date().toISOString();

  const { apiKey } = getEvolutionConfig();
  if (!apiKey) {
    return {
      ok: false,
      instanceName,
      userId,
      status: 'close',
      qrCode: null,
      pairingCode: null,
      qrPending: false,
      upstreamCount: null,
      ownerJid: null,
      profileName: null,
      disconnectionReasonCode: null,
      detail: 'Evolution API key is not configured on the server.',
      error: 'Evolution API key (EVOLUTION_API_KEY) is not configured on the server.',
      checkedAt: nowIso,
    };
  }

  const summary = await inspectInstanceSummary(instanceName);

  // If instance does not exist yet on Evolution API, initialize it seamlessly
  if (!summary.exists) {
    return initializeEvolutionConnection({ userId, instanceName });
  }

  let qrCode: string | null = null;
  let pairingCode: string | null = null;
  let upstreamCount: number | null = null;

  if (summary.status !== 'open') {
    const connectRes = await evolutionFetch(
      `/instance/connect/${encodeURIComponent(instanceName)}`
    );
    if (connectRes.ok && connectRes.data) {
      if (typeof connectRes.data.count === 'number') {
        upstreamCount = connectRes.data.count;
      }
      const extracted = await extractQrCodeDataUrl(connectRes.data);
      qrCode = extracted.qrCode;
      pairingCode = extracted.pairingCode;
    }
  }

  await syncAdminWhatsAppConnectionDoc(userId, instanceName, summary.status);

  const detail =
    summary.status === 'open'
      ? 'WhatsApp Connected'
      : qrCode
      ? 'Scan with your WhatsApp'
      : `Session status is "${summary.status}". Still awaiting QR image from Evolution API (count: ${upstreamCount ?? 0}).`;

  return {
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
  };
}

export async function disconnectEvolutionConnection(params: {
  userId: string;
  instanceName?: string;
}): Promise<{ ok: boolean; instanceName: string; status: EvolutionConnectionStatus; error?: string }> {
  const userId = sanitizeEvolutionId(params.userId, 'user');
  const instanceName = buildEvolutionInstanceName(userId, params.instanceName);

  const logoutRes = await evolutionFetch(
    `/instance/logout/${encodeURIComponent(instanceName)}`,
    { method: 'DELETE' }
  );

  await syncAdminWhatsAppConnectionDoc(userId, instanceName, 'close');

  if (!logoutRes.ok && logoutRes.status !== 404 && logoutRes.status !== 400) {
    return {
      ok: false,
      instanceName,
      status: 'close',
      error:
        logoutRes.data?.message ||
        logoutRes.data?.error ||
        `Failed to log out instance (HTTP ${logoutRes.status})`,
    };
  }

  return {
    ok: true,
    instanceName,
    status: 'close',
  };
}

/**
 * TASK 3 - SEND MESSAGE:
 * Calls POST /message/sendText/{instanceName} on Evolution with {number: leadPhone, text}.
 * Used for all automation replies, replacing old send functions.
 */
export async function sendWhatsAppViaEvolution(
  instanceName: string,
  leadPhone: string,
  text: string
): Promise<SendWhatsAppResult> {
  const cleanPhone = String(leadPhone || '').replace(/[^0-9]/g, '');
  const cleanText = String(text || '').trim();

  if (!cleanPhone || !cleanText) {
    return {
      ok: false,
      instanceName,
      to: cleanPhone,
      detail: 'Recipient phone number and non-empty message text are required.',
      error: 'Recipient phone number and non-empty message text are required.',
    };
  }

  // Pre-check instance connection state to fail fast if disconnected instead of hanging on Baileys socket
  try {
    const summary = await inspectInstanceSummary(instanceName);
    if (summary.status !== 'open') {
      return {
        ok: false,
        instanceName,
        to: cleanPhone,
        detail: `Instance "${instanceName}" is currently "${summary.status}". Scan QR code in Connect WhatsApp to connect before sending.`,
        error: `WhatsApp instance "${instanceName}" is disconnected. Please scan the QR code to connect first.`,
      };
    }
  } catch (inspectErr: any) {
    console.warn(`[sendWhatsAppViaEvolution] Could not pre-check status for ${instanceName}:`, inspectErr?.message || inspectErr);
  }

  const endpoint = `/message/sendText/${encodeURIComponent(instanceName)}`;
  const res = await evolutionFetch(endpoint, {
    method: 'POST',
    body: {
      number: cleanPhone,
      text: cleanText,
    },
  });

  if (!res.ok) {
    const errorMsg =
      res.data?.response?.message?.[0] ||
      res.data?.message ||
      res.data?.error ||
      `Evolution sendText failed (HTTP ${res.status})`;
    return {
      ok: false,
      instanceName,
      to: cleanPhone,
      detail: String(errorMsg),
      error: String(errorMsg),
    };
  }

  const messageId =
    res.data?.key?.id ||
    res.data?.messageId ||
    `evo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    ok: true,
    messageId,
    instanceName,
    to: cleanPhone,
    detail: `Sent via Evolution API (${instanceName}) to +${cleanPhone}`,
  };
}
