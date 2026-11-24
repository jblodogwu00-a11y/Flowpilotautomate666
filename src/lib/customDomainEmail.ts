import 'dotenv/config';
import { Resend } from 'resend';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFirestoreDoc, setFirestoreDoc } from './firebaseAdmin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../.data');
const EMAIL_STORE_PATH = path.join(DATA_DIR, 'email_domains_store.json');

export class CustomDomainEmailError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = 'CUSTOM_DOMAIN_ERROR') {
    super(message);
    this.name = 'CustomDomainEmailError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const FREE_EMAIL_PROVIDERS = new Set<string>([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.fr',
  'yahoo.ca',
  'yahoo.in',
  'yahoo.com.au',
  'ymail.com',
  'rocketmail.com',
  'outlook.com',
  'hotmail.com',
  'hotmail.co.uk',
  'hotmail.fr',
  'live.com',
  'live.co.uk',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'aim.com',
  'proton.me',
  'protonmail.com',
  'protonmail.ch',
  'pm.me',
  'zoho.com',
  'zohomail.com',
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'mail.com',
  'yandex.com',
  'yandex.ru',
  'tutanota.com',
  'tutanota.de',
  'tuta.io',
  'fastmail.com',
  'fastmail.fm',
  'hey.com',
  'inbox.com',
  'mail.ru',
  'rambler.ru',
  'qq.com',
  '163.com',
  '126.com',
  'rediffmail.com',
]);

const RESERVED_DOMAINS = new Set<string>([
  'localhost',
  'localhost.localdomain',
  'example.com',
  'example.org',
  'example.net',
  'resend.dev',
  'flowpilot.app',
  'send.flowpilot.app',
]);

export interface ResendDnsRecord {
  id?: string;
  record: string;
  name: string;
  type: string;
  ttl?: string | number;
  status?: string;
  value: string;
  priority?: number;
}

export type DomainVerificationStatus =
  | 'not_started'
  | 'pending'
  | 'verified'
  | 'failed'
  | 'temporary_failure';

export interface StoredEmailDomain {
  id: string;
  ownerId: string;
  domain: string;
  resendDomainId: string;
  status: DomainVerificationStatus;
  verified: boolean;
  region?: string;
  records: ResendDnsRecord[];
  capabilities?: {
    sending?: string;
    receiving?: string;
  };
  lastWebhookEvent?: string;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredEmailSender {
  id: string;
  ownerId: string;
  domain: string;
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailDeliveryLogEntry {
  id: string;
  ownerId?: string;
  resendEmailId?: string;
  eventType: string;
  from?: string;
  to?: string;
  subject?: string;
  domain?: string;
  detail?: string;
  createdAt: string;
}

interface EmailStoreStateV2 {
  version: 2;
  domainsByOwner: Record<string, StoredEmailDomain>;
  sendersByOwner: Record<string, StoredEmailSender[]>;
  webhookLogs: EmailDeliveryLogEntry[];
}

export function isResendConfigured(): boolean {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  return Boolean(
    apiKey &&
      apiKey !== 'your_resend_api_key_here' &&
      apiKey !== 'MY_RESEND_API_KEY' &&
      apiKey.startsWith('re_')
  );
}

export function getResendClient(): Resend | null {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey || apiKey === 'your_resend_api_key_here' || apiKey === 'MY_RESEND_API_KEY') {
    return null;
  }
  return new Resend(apiKey);
}

function requireResendClient(): Resend {
  const client = getResendClient();
  if (!client) {
    throw new CustomDomainEmailError(
      'Centralized Resend email infrastructure is not configured on this server. Please set RESEND_API_KEY in the server environment.',
      503,
      'RESEND_NOT_CONFIGURED'
    );
  }
  return client;
}

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Ignore
  }
}

function sanitizeOwnerId(ownerId: string): string {
  const clean = String(ownerId || '').trim();
  if (!clean || !/^[a-zA-Z0-9_.\-@]+$/.test(clean) || clean.length > 128) {
    throw new CustomDomainEmailError('Valid authenticated user ID is required.', 401, 'UNAUTHORIZED');
  }
  return clean;
}

function loadEmailStore(): EmailStoreStateV2 {
  try {
    if (fs.existsSync(EMAIL_STORE_PATH)) {
      const raw = fs.readFileSync(EMAIL_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 2) {
        return {
          version: 2,
          domainsByOwner: parsed.domainsByOwner || {},
          sendersByOwner: parsed.sendersByOwner || {},
          webhookLogs: Array.isArray(parsed.webhookLogs) ? parsed.webhookLogs : [],
        };
      }
      // Migrate or discard old v1 prototype state cleanly without exposing shared 'me'/'brother' prototype records
      return {
        version: 2,
        domainsByOwner: {},
        sendersByOwner: {},
        webhookLogs: [],
      };
    }
  } catch (err: any) {
    console.warn('[CustomDomainEmail] Read local store notice:', err?.message || err);
  }
  return {
    version: 2,
    domainsByOwner: {},
    sendersByOwner: {},
    webhookLogs: [],
  };
}

function saveEmailStore(state: EmailStoreStateV2): void {
  try {
    ensureDataDir();
    fs.writeFileSync(EMAIL_STORE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('[CustomDomainEmail] Write local store notice:', err?.message || err);
  }
}

export function normalizeDomain(rawDomain: string): string {
  let cleaned = String(rawDomain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.+$/, '');
  if (cleaned.startsWith('www.')) {
    cleaned = cleaned.slice(4);
  }
  return cleaned;
}

export function sanitizeHeaderString(value: string, maxLength = 100): string {
  return String(value || '')
    .replace(/[\r\n\0<>"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function validateCustomDomainSenderInput(params: {
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
}): {
  fromName: string;
  fromEmail: string;
  domain: string;
  replyToEmail?: string;
} {
  const cleanName = sanitizeHeaderString(params.fromName, 100);
  if (cleanName.length < 2) {
    throw new CustomDomainEmailError(
      'Please enter a From Name (at least 2 characters, e.g. Musa Store).',
      400,
      'INVALID_FROM_NAME'
    );
  }

  const rawEmail = String(params.fromEmail || '').trim();
  if (!rawEmail || /[\r\n\s<>]/.test(rawEmail)) {
    throw new CustomDomainEmailError(
      'Please enter a valid custom domain email address without spaces or brackets.',
      400,
      'INVALID_FROM_EMAIL'
    );
  }

  const cleanEmail = rawEmail.toLowerCase();
  const emailRegex = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
  if (!emailRegex.test(cleanEmail) || cleanEmail.length > 150) {
    throw new CustomDomainEmailError(
      'Please enter a valid email address (for example: hello@yourdomain.com).',
      400,
      'INVALID_FROM_EMAIL'
    );
  }

  const atIndex = cleanEmail.lastIndexOf('@');
  const rawDomain = cleanEmail.slice(atIndex + 1);
  const domain = normalizeDomain(rawDomain);

  if (
    !domain ||
    domain.length < 4 ||
    domain.length > 253 ||
    !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ||
    domain.includes('..') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(domain)
  ) {
    throw new CustomDomainEmailError(
      'Please enter an email address with a valid custom domain (for example: hello@yourdomain.com).',
      400,
      'INVALID_DOMAIN'
    );
  }

  if (FREE_EMAIL_PROVIDERS.has(domain)) {
    throw new CustomDomainEmailError(
      `Free email providers like ${domain} cannot be used as a custom sending domain. Enter an email address from your own domain (for example: hello@yourbrand.com).`,
      400,
      'FREE_EMAIL_PROVIDER_NOT_ALLOWED'
    );
  }

  if (
    RESERVED_DOMAINS.has(domain) ||
    domain.endsWith('.local') ||
    domain.endsWith('.internal') ||
    domain.endsWith('.test') ||
    domain.endsWith('.localhost')
  ) {
    throw new CustomDomainEmailError(
      `The domain "${domain}" is reserved and cannot be registered. Please use your own custom domain.`,
      400,
      'RESERVED_DOMAIN_NOT_ALLOWED'
    );
  }

  let cleanReplyTo: string | undefined;
  if (params.replyToEmail && params.replyToEmail.trim()) {
    const candidate = params.replyToEmail.trim().toLowerCase();
    if (!emailRegex.test(candidate) || /[\r\n\s<>]/.test(candidate)) {
      throw new CustomDomainEmailError(
        'Reply-To address must be a valid email address.',
        400,
        'INVALID_REPLY_TO'
      );
    }
    cleanReplyTo = candidate;
  }

  return {
    fromName: cleanName,
    fromEmail: cleanEmail,
    domain,
    replyToEmail: cleanReplyTo,
  };
}

export function normalizeResendStatus(rawStatus: unknown): DomainVerificationStatus {
  const s = String(rawStatus || 'not_started').toLowerCase().trim();
  if (s === 'verified') return 'verified';
  if (s === 'pending') return 'pending';
  if (s === 'failed') return 'failed';
  if (s === 'temporary_failure') return 'temporary_failure';
  return 'not_started';
}

export function mapResendRecords(records: unknown): ResendDnsRecord[] {
  if (!Array.isArray(records)) return [];
  return records
    .filter((r): r is Record<string, any> => Boolean(r && typeof r === 'object'))
    .map((r) => ({
      ...(r.id ? { id: String(r.id) } : {}),
      record: String(r.record || r.type || 'TXT'),
      name: String(r.name || ''),
      type: String(r.type || 'TXT').toUpperCase(),
      ttl: r.ttl !== undefined && r.ttl !== null ? r.ttl : 'Auto',
      status: String(r.status || 'not_started'),
      value: String(r.value || ''),
      ...(typeof r.priority === 'number' ? { priority: r.priority } : {}),
    }));
}

function buildSafeDomainDocId(ownerId: string, domain: string): string {
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const safeDomain = domain.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 56);
  return `${safeOwner}__${safeDomain}`.slice(0, 128);
}

async function syncDomainToFirestoreBestEffort(domainDoc: StoredEmailDomain): Promise<void> {
  try {
    const docId = buildSafeDomainDocId(domainDoc.ownerId, domainDoc.domain);
    await setFirestoreDoc('email_domains', docId, domainDoc, true);
  } catch {
    // Non-fatal fallback; authoritative local store remains intact
  }
}

async function syncSenderToFirestoreBestEffort(senderDoc: StoredEmailSender): Promise<void> {
  try {
    const safeId = senderDoc.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    await setFirestoreDoc('email_senders', safeId, senderDoc, true);
  } catch {
    // Non-fatal fallback
  }
}

export async function getUserEmailDomainStatus(
  ownerId: string,
  options: { refresh?: boolean } = {}
): Promise<{
  domain: StoredEmailDomain | null;
  sender: StoredEmailSender | null;
  senders: StoredEmailSender[];
  resendConfigured: boolean;
}> {
  const cleanOwnerId = sanitizeOwnerId(ownerId);
  const store = loadEmailStore();
  let domain = store.domainsByOwner[cleanOwnerId] || null;
  const senders = store.sendersByOwner[cleanOwnerId] || [];

  if (!domain) {
    // Best-effort check in Firestore cache if no local record
    try {
      const remoteSender = await getFirestoreDoc('email_users', cleanOwnerId);
      if (remoteSender && remoteSender.ownerId === cleanOwnerId && remoteSender.domain) {
        // Only surface if not owned by someone else
        const conflict = Object.values(store.domainsByOwner).find(
          (d) => d.domain === remoteSender.domain && d.ownerId !== cleanOwnerId
        );
        if (!conflict) {
          const docId = buildSafeDomainDocId(cleanOwnerId, String(remoteSender.domain));
          const remoteDomain = await getFirestoreDoc('email_domains', docId);
          if (remoteDomain && remoteDomain.ownerId === cleanOwnerId) {
            domain = remoteDomain as StoredEmailDomain;
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  if (options.refresh && domain && domain.resendDomainId) {
    const resend = getResendClient();
    if (resend) {
      try {
        const { data, error } = await resend.domains.get(domain.resendDomainId);
        if (!error && data) {
          const nextStatus = normalizeResendStatus(data.status);
          domain = {
            ...domain,
            status: nextStatus,
            verified: nextStatus === 'verified',
            region: data.region || domain.region,
            records: mapResendRecords(data.records),
            capabilities: (data as any).capabilities || domain.capabilities,
            updatedAt: new Date().toISOString(),
            ...(nextStatus === 'verified' && !domain.lastVerifiedAt
              ? { lastVerifiedAt: new Date().toISOString() }
              : {}),
          };
          store.domainsByOwner[cleanOwnerId] = domain;
          saveEmailStore(store);
          await syncDomainToFirestoreBestEffort(domain);
        }
      } catch (err: any) {
        console.warn('[Resend] Refresh domain status notice:', err?.message || err);
      }
    }
  }

  const defaultSender = senders.find((s) => s.isDefault) || senders[0] || null;
  return {
    domain,
    sender: defaultSender,
    senders,
    resendConfigured: isResendConfigured(),
  };
}

export async function connectUserCustomDomain(params: {
  ownerId: string;
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
  region?: string;
}): Promise<{
  domain: StoredEmailDomain;
  sender: StoredEmailSender;
  senders: StoredEmailSender[];
  reusedExisting: boolean;
}> {
  const cleanOwnerId = sanitizeOwnerId(params.ownerId);
  const { fromName, fromEmail, domain, replyToEmail } = validateCustomDomainSenderInput({
    fromName: params.fromName,
    fromEmail: params.fromEmail,
    replyToEmail: params.replyToEmail,
  });

  const store = loadEmailStore();

  // Check if another FlowPilot account already owns this normalized domain
  const conflictingOwnerDomain = Object.values(store.domainsByOwner).find(
    (entry) => entry.domain.toLowerCase() === domain && entry.ownerId !== cleanOwnerId
  );
  if (conflictingOwnerDomain) {
    throw new CustomDomainEmailError(
      `The domain "${domain}" is already registered to another FlowPilot account.`,
      409,
      'DOMAIN_OWNED_BY_OTHER_ACCOUNT'
    );
  }

  const resend = requireResendClient();
  const nowIso = new Date().toISOString();
  const currentUserDomain = store.domainsByOwner[cleanOwnerId] || null;
  let storedDomain: StoredEmailDomain;
  let reusedExisting = false;

  if (currentUserDomain && currentUserDomain.domain.toLowerCase() === domain) {
    // Domain already exists for this user — fetch latest DNS/status from Resend without creating duplicates
    reusedExisting = true;
    try {
      const { data, error } = await resend.domains.get(currentUserDomain.resendDomainId);
      if (!error && data) {
        const nextStatus = normalizeResendStatus(data.status);
        storedDomain = {
          ...currentUserDomain,
          status: nextStatus,
          verified: nextStatus === 'verified',
          region: data.region || currentUserDomain.region,
          records: mapResendRecords(data.records),
          capabilities: (data as any).capabilities || currentUserDomain.capabilities,
          updatedAt: nowIso,
        };
      } else {
        storedDomain = { ...currentUserDomain, updatedAt: nowIso };
      }
    } catch {
      storedDomain = { ...currentUserDomain, updatedAt: nowIso };
    }
  } else {
    // If the user is replacing a different previous domain on their account, remove the old one from Resend
    if (currentUserDomain && currentUserDomain.resendDomainId) {
      try {
        await resend.domains.remove(currentUserDomain.resendDomainId);
      } catch (remErr: any) {
        console.warn('[Resend] Remove previous domain notice:', remErr?.message || remErr);
      }
    }

    // Call official Resend Domains API: POST https://api.resend.com/domains
    let createdData: any = null;
    const createPayload: any = { name: domain };
    if (params.region) {
      createPayload.region = params.region;
    }

    const { data, error } = await resend.domains.create(createPayload);
    if (error) {
      const msgLower = String(error.message || '').toLowerCase();
      if (msgLower.includes('already exists') || msgLower.includes('already registered')) {
        // Check again if another account claimed it concurrently
        const recheckStore = loadEmailStore();
        const other = Object.values(recheckStore.domainsByOwner).find(
          (entry) => entry.domain.toLowerCase() === domain && entry.ownerId !== cleanOwnerId
        );
        if (other) {
          throw new CustomDomainEmailError(
            `The domain "${domain}" is already registered to another FlowPilot account.`,
            409,
            'DOMAIN_OWNED_BY_OTHER_ACCOUNT'
          );
        }

        // Orphaned domain present in Resend account but unowned in FlowPilot — attach safely
        const listRes = await resend.domains.list();
        const found = (listRes.data?.data || []).find(
          (d: any) => String(d.name || '').toLowerCase() === domain
        );
        if (!found) {
          throw new CustomDomainEmailError(
            `Resend reported domain "${domain}" already exists, but it could not be retrieved: ${error.message}`,
            409,
            'RESEND_DOMAIN_CONFLICT'
          );
        }
        const getRes = await resend.domains.get(found.id);
        if (getRes.error || !getRes.data) {
          throw new CustomDomainEmailError(
            getRes.error?.message || `Failed to retrieve existing Resend domain "${domain}".`,
            502,
            'RESEND_API_ERROR'
          );
        }
        createdData = getRes.data;
        reusedExisting = true;
      } else {
        throw new CustomDomainEmailError(
          error.message || `Failed to register domain "${domain}" with Resend.`,
          400,
          'RESEND_DOMAIN_CREATE_FAILED'
        );
      }
    } else {
      createdData = data;
    }

    if (!createdData || !createdData.id) {
      throw new CustomDomainEmailError(
        'Resend did not return a valid domain ID. Please verify your server configuration.',
        502,
        'RESEND_INVALID_RESPONSE'
      );
    }

    const mappedStatus = normalizeResendStatus(createdData.status);
    storedDomain = {
      id: buildSafeDomainDocId(cleanOwnerId, domain),
      ownerId: cleanOwnerId,
      domain,
      resendDomainId: String(createdData.id),
      status: mappedStatus,
      verified: mappedStatus === 'verified',
      region: createdData.region ? String(createdData.region) : 'us-east-1',
      records: mapResendRecords(createdData.records),
      capabilities: createdData.capabilities || undefined,
      createdAt: createdData.created_at || nowIso,
      updatedAt: nowIso,
      ...(mappedStatus === 'verified' ? { lastVerifiedAt: nowIso } : {}),
    };
  }

  // Upsert default sender profile for this user
  const existingSenders = store.sendersByOwner[cleanOwnerId] || [];
  const matchingIdx = existingSenders.findIndex(
    (s) => s.fromEmail.toLowerCase() === fromEmail && s.domain === domain
  );

  let savedSender: StoredEmailSender;
  let updatedSenders: StoredEmailSender[];
  if (matchingIdx >= 0) {
    savedSender = {
      ...existingSenders[matchingIdx],
      fromName,
      fromEmail,
      ...(replyToEmail ? { replyToEmail } : {}),
      isDefault: true,
      updatedAt: nowIso,
    };
    updatedSenders = existingSenders.map((s, idx) =>
      idx === matchingIdx ? savedSender : { ...s, isDefault: false }
    );
  } else {
    const senderId = `snd_${cleanOwnerId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}_${Date.now().toString(36)}`;
    savedSender = {
      id: senderId,
      ownerId: cleanOwnerId,
      domain,
      fromName,
      fromEmail,
      ...(replyToEmail ? { replyToEmail } : {}),
      isDefault: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    // Keep senders strictly aligned with the user's current domain
    const sameDomainOthers = existingSenders
      .filter((s) => s.domain === domain)
      .map((s) => ({ ...s, isDefault: false }));
    updatedSenders = [savedSender, ...sameDomainOthers].slice(0, 10);
  }

  store.domainsByOwner[cleanOwnerId] = storedDomain;
  store.sendersByOwner[cleanOwnerId] = updatedSenders;
  saveEmailStore(store);

  await syncDomainToFirestoreBestEffort(storedDomain);
  await syncSenderToFirestoreBestEffort(savedSender);

  return {
    domain: storedDomain,
    sender: savedSender,
    senders: updatedSenders,
    reusedExisting,
  };
}

export async function verifyUserEmailDomain(ownerId: string): Promise<{
  domain: StoredEmailDomain;
  verified: boolean;
  status: DomainVerificationStatus;
  records: ResendDnsRecord[];
}> {
  const cleanOwnerId = sanitizeOwnerId(ownerId);
  const store = loadEmailStore();
  const domainRecord = store.domainsByOwner[cleanOwnerId];

  if (!domainRecord || !domainRecord.resendDomainId) {
    throw new CustomDomainEmailError(
      'No custom domain is connected to your account yet. Save your From Name and From Email first.',
      404,
      'DOMAIN_NOT_FOUND'
    );
  }

  const resend = requireResendClient();
  const verifyRes = await resend.domains.verify(domainRecord.resendDomainId);
  if (verifyRes.error) {
    throw new CustomDomainEmailError(
      verifyRes.error.message || 'Resend failed to trigger DNS verification.',
      502,
      'RESEND_VERIFY_FAILED'
    );
  }

  const getRes = await resend.domains.get(domainRecord.resendDomainId);
  if (getRes.error || !getRes.data) {
    throw new CustomDomainEmailError(
      getRes.error?.message || 'Failed to retrieve updated domain verification state from Resend.',
      502,
      'RESEND_GET_FAILED'
    );
  }

  const nextStatus = normalizeResendStatus(getRes.data.status);
  const isVerified = nextStatus === 'verified';
  const nowIso = new Date().toISOString();

  const updatedDomain: StoredEmailDomain = {
    ...domainRecord,
    status: nextStatus,
    verified: isVerified,
    region: getRes.data.region || domainRecord.region,
    records: mapResendRecords(getRes.data.records),
    capabilities: (getRes.data as any).capabilities || domainRecord.capabilities,
    updatedAt: nowIso,
    ...(isVerified ? { lastVerifiedAt: nowIso } : {}),
  };

  store.domainsByOwner[cleanOwnerId] = updatedDomain;
  saveEmailStore(store);
  await syncDomainToFirestoreBestEffort(updatedDomain);

  return {
    domain: updatedDomain,
    verified: isVerified,
    status: nextStatus,
    records: updatedDomain.records,
  };
}

export async function updateUserEmailSender(params: {
  ownerId: string;
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
}): Promise<{
  domain: StoredEmailDomain;
  sender: StoredEmailSender;
  senders: StoredEmailSender[];
}> {
  const cleanOwnerId = sanitizeOwnerId(params.ownerId);
  const { fromName, fromEmail, domain, replyToEmail } = validateCustomDomainSenderInput({
    fromName: params.fromName,
    fromEmail: params.fromEmail,
    replyToEmail: params.replyToEmail,
  });

  const store = loadEmailStore();
  const existingDomain = store.domainsByOwner[cleanOwnerId];
  if (!existingDomain) {
    throw new CustomDomainEmailError(
      'Please connect a custom domain first before updating your sender identity.',
      400,
      'DOMAIN_NOT_CONFIGURED'
    );
  }

  if (existingDomain.domain.toLowerCase() !== domain) {
    throw new CustomDomainEmailError(
      `Sender email domain "${domain}" does not match your connected domain "${existingDomain.domain}". Register the new domain first if you want to switch domains.`,
      400,
      'SENDER_DOMAIN_MISMATCH'
    );
  }

  const nowIso = new Date().toISOString();
  const existingSenders = store.sendersByOwner[cleanOwnerId] || [];
  const primary = existingSenders.find((s) => s.isDefault) || existingSenders[0];

  const updatedSender: StoredEmailSender = primary
    ? {
        ...primary,
        fromName,
        fromEmail,
        replyToEmail,
        isDefault: true,
        updatedAt: nowIso,
      }
    : {
        id: `snd_${cleanOwnerId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}_${Date.now().toString(36)}`,
        ownerId: cleanOwnerId,
        domain,
        fromName,
        fromEmail,
        replyToEmail,
        isDefault: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

  const nextSenders = primary
    ? existingSenders.map((s) => (s.id === primary.id ? updatedSender : { ...s, isDefault: false }))
    : [updatedSender];

  store.sendersByOwner[cleanOwnerId] = nextSenders;
  saveEmailStore(store);
  await syncSenderToFirestoreBestEffort(updatedSender);

  return {
    domain: existingDomain,
    sender: updatedSender,
    senders: nextSenders,
  };
}

export async function deleteUserEmailDomain(ownerId: string): Promise<{ removedDomain: string | null }> {
  const cleanOwnerId = sanitizeOwnerId(ownerId);
  const store = loadEmailStore();
  const existingDomain = store.domainsByOwner[cleanOwnerId];

  if (!existingDomain) {
    delete store.sendersByOwner[cleanOwnerId];
    saveEmailStore(store);
    return { removedDomain: null };
  }

  const resend = getResendClient();
  if (resend && existingDomain.resendDomainId) {
    try {
      const { error } = await resend.domains.remove(existingDomain.resendDomainId);
      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (!msg.includes('not found') && !msg.includes('404')) {
          throw new CustomDomainEmailError(
            `Failed to remove domain from Resend: ${error.message}`,
            502,
            'RESEND_REMOVE_FAILED'
          );
        }
      }
    } catch (err: any) {
      if (err instanceof CustomDomainEmailError) throw err;
      throw new CustomDomainEmailError(
        err?.message || 'Failed to delete domain from Resend.',
        502,
        'RESEND_REMOVE_FAILED'
      );
    }
  }

  const removedName = existingDomain.domain;
  delete store.domainsByOwner[cleanOwnerId];
  delete store.sendersByOwner[cleanOwnerId];
  saveEmailStore(store);

  return { removedDomain: removedName };
}

export interface EmailAttachmentInput {
  filename: string;
  content: string; // base64 or UTF-8 string
  contentType?: string;
}

export async function sendCustomDomainEmail(params: {
  ownerId: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachmentInput[];
  fromEmailOverride?: string;
  fromNameOverride?: string;
}): Promise<{
  success: boolean;
  id?: string;
  from: string;
  to: string[];
  subject: string;
  provider: string;
  domain: string;
}> {
  const cleanOwnerId = sanitizeOwnerId(params.ownerId);
  const store = loadEmailStore();
  const domainRecord = store.domainsByOwner[cleanOwnerId];
  const senders = store.sendersByOwner[cleanOwnerId] || [];
  const defaultSender = senders.find((s) => s.isDefault) || senders[0];

  if (!domainRecord) {
    throw new CustomDomainEmailError(
      'No custom domain is connected to your account. Go to Settings → Email Automation to connect and verify your custom domain before sending emails.',
      400,
      'DOMAIN_NOT_CONFIGURED'
    );
  }

  if (!domainRecord.verified || domainRecord.status !== 'verified') {
    throw new CustomDomainEmailError(
      `Domain "${domainRecord.domain}" is not verified yet (status: ${domainRecord.status}). Please add all required DNS records and verify your domain before sending automated or test emails.`,
      403,
      'DOMAIN_NOT_VERIFIED'
    );
  }

  const recipients = (Array.isArray(params.to) ? params.to : [params.to])
    .map((r) => String(r || '').trim().toLowerCase())
    .filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r));

  if (recipients.length === 0) {
    throw new CustomDomainEmailError('A valid recipient email address is required.', 400, 'INVALID_RECIPIENT');
  }

  const cleanSubject = sanitizeHeaderString(params.subject, 200);
  if (!cleanSubject) {
    throw new CustomDomainEmailError('Email subject is required.', 400, 'MISSING_SUBJECT');
  }

  // Strictly bind sender email to the user's verified custom domain
  let activeFromEmail = defaultSender?.fromEmail || `hello@${domainRecord.domain}`;
  if (params.fromEmailOverride && params.fromEmailOverride.includes('@')) {
    const candidate = params.fromEmailOverride.trim().toLowerCase();
    const candidateDomain = normalizeDomain(candidate.split('@')[1] || '');
    if (candidateDomain === domainRecord.domain.toLowerCase()) {
      activeFromEmail = candidate;
    }
  }
  const activeFromName = sanitizeHeaderString(
    params.fromNameOverride || defaultSender?.fromName || domainRecord.domain,
    100
  );

  const formattedFrom = `${activeFromName} <${activeFromEmail}>`;
  const resend = requireResendClient();

  const htmlContent = params.html ? String(params.html) : undefined;
  const textContent = params.text
    ? String(params.text)
    : htmlContent
    ? htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : undefined;

  if (!htmlContent && !textContent) {
    throw new CustomDomainEmailError('Email body (html or text) is required.', 400, 'MISSING_BODY');
  }

  const resolvedText =
    textContent ||
    (htmlContent ? htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '') ||
    cleanSubject;

  const cleanAttachments = Array.isArray(params.attachments)
    ? params.attachments
        .filter((a) => a && a.filename && a.content)
        .slice(0, 10)
        .map((a) => ({
          filename: sanitizeHeaderString(a.filename, 140),
          content: Buffer.from(String(a.content), 'base64'),
          ...(a.contentType ? { contentType: sanitizeHeaderString(a.contentType, 80) } : {}),
        }))
    : undefined;

  const { data, error } = await resend.emails.send({
    from: formattedFrom,
    to: recipients,
    subject: cleanSubject,
    text: resolvedText,
    ...(htmlContent ? { html: htmlContent } : {}),
    ...(params.replyTo || defaultSender?.replyToEmail
      ? { replyTo: params.replyTo || defaultSender?.replyToEmail }
      : {}),
    ...(cleanAttachments && cleanAttachments.length > 0 ? { attachments: cleanAttachments } : {}),
  });

  if (error) {
    throw new CustomDomainEmailError(
      error.message || 'Resend failed to send email.',
      502,
      'RESEND_SEND_FAILED'
    );
  }

  return {
    success: true,
    id: data?.id,
    from: formattedFrom,
    to: recipients,
    subject: cleanSubject,
    provider: 'Resend Custom Domain API',
    domain: domainRecord.domain,
  };
}

export async function checkCustomDomainSendReadiness(ownerId: string): Promise<{
  allowed: boolean;
  reason?: string;
  domain?: string;
  status?: DomainVerificationStatus;
  fromEmail?: string;
  fromName?: string;
}> {
  if (!ownerId) {
    return {
      allowed: false,
      reason: 'Authenticated user required to send automated custom-domain emails.',
    };
  }
  const store = loadEmailStore();
  const domainRecord = store.domainsByOwner[ownerId];
  const senders = store.sendersByOwner[ownerId] || [];
  const defaultSender = senders.find((s) => s.isDefault) || senders[0];

  if (!domainRecord) {
    return {
      allowed: false,
      reason:
        'Custom sending domain not configured. Open Settings → Email Automation to connect and verify your domain before sending automated emails.',
    };
  }

  if (!domainRecord.verified || domainRecord.status !== 'verified') {
    return {
      allowed: false,
      domain: domainRecord.domain,
      status: domainRecord.status,
      reason: `Sending blocked: custom domain "${domainRecord.domain}" is currently "${domainRecord.status}". Add your DNS records and complete domain verification in Settings → Email Automation.`,
    };
  }

  return {
    allowed: true,
    domain: domainRecord.domain,
    status: domainRecord.status,
    fromEmail: defaultSender?.fromEmail || `hello@${domainRecord.domain}`,
    fromName: defaultSender?.fromName || domainRecord.domain,
  };
}

function parseEmailAddressHeader(raw: string): { name: string; email: string } {
  const str = String(raw || '').trim();
  const angleMatch = str.match(/^(.*)<([^>]+)>$/);
  if (angleMatch) {
    return {
      name: angleMatch[1].replace(/^["']|["']$/g, '').trim() || angleMatch[2].split('@')[0],
      email: angleMatch[2].trim().toLowerCase(),
    };
  }
  const emailOnly = str.replace(/^["']|["']$/g, '').trim().toLowerCase();
  return {
    name: emailOnly.split('@')[0] || 'Email Lead',
    email: emailOnly,
  };
}

export function resolveOwnerByRecipientEmail(
  recipients: string[]
): { ownerId: string; domain: string } | null {
  const store = loadEmailStore();
  for (const rawAddr of recipients) {
    const { email } = parseEmailAddressHeader(rawAddr);
    const domain = normalizeDomain(email.split('@')[1] || '');
    if (!domain) continue;
    for (const [ownerId, rec] of Object.entries(store.domainsByOwner)) {
      if (rec.domain.toLowerCase() === domain) {
        return { ownerId, domain: rec.domain };
      }
    }
  }
  return null;
}

export interface ResendInboundEmailPayload {
  ownerId?: string;
  domain?: string;
  resendEmailId?: string;
  fromEmail: string;
  fromName: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  receivedAt: string;
}

export async function handleResendWebhookEvent(params: {
  rawBody: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
}): Promise<{
  handled: boolean;
  eventType: string;
  domainUpdated?: string;
  bouncedRecipients?: string[];
  inboundEmail?: ResendInboundEmailPayload;
}> {
  const webhookSecret = (process.env.RESEND_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret || webhookSecret === 'your_resend_webhook_secret_here') {
    throw new CustomDomainEmailError(
      'RESEND_WEBHOOK_SECRET is not configured on this server.',
      503,
      'WEBHOOK_SECRET_NOT_CONFIGURED'
    );
  }

  if (!params.svixId || !params.svixTimestamp || !params.svixSignature) {
    throw new CustomDomainEmailError(
      'Missing Svix webhook signature headers.',
      400,
      'MISSING_WEBHOOK_HEADERS'
    );
  }

  const resend = requireResendClient();
  let event: any;
  try {
    event = resend.webhooks.verify({
      payload: params.rawBody,
      headers: {
        id: params.svixId,
        timestamp: params.svixTimestamp,
        signature: params.svixSignature,
      },
      webhookSecret,
    });
  } catch (err: any) {
    throw new CustomDomainEmailError(
      `Invalid Resend webhook signature: ${err?.message || 'Verification failed'}`,
      401,
      'INVALID_WEBHOOK_SIGNATURE'
    );
  }

  const eventType = String(event?.type || 'unknown');
  const eventData = event?.data || {};
  const nowIso = new Date().toISOString();
  const store = loadEmailStore();
  let domainUpdated: string | undefined;
  const bouncedRecipients: string[] = [];
  let inboundEmail: ResendInboundEmailPayload | undefined;

  if (eventType.startsWith('domain.')) {
    const resendId = String(eventData.id || '');
    const domainName = normalizeDomain(String(eventData.name || ''));

    for (const [ownerId, rec] of Object.entries(store.domainsByOwner)) {
      if (
        (resendId && rec.resendDomainId === resendId) ||
        (domainName && rec.domain.toLowerCase() === domainName)
      ) {
        const nextStatus = normalizeResendStatus(eventData.status);
        const updated: StoredEmailDomain = {
          ...rec,
          status: nextStatus,
          verified: nextStatus === 'verified',
          records: Array.isArray(eventData.records)
            ? mapResendRecords(eventData.records)
            : rec.records,
          lastWebhookEvent: `${eventType} (${nowIso})`,
          updatedAt: nowIso,
          ...(nextStatus === 'verified' ? { lastVerifiedAt: nowIso } : {}),
        };
        store.domainsByOwner[ownerId] = updated;
        domainUpdated = updated.domain;
        await syncDomainToFirestoreBestEffort(updated);
      }
    }
  } else if (eventType.startsWith('email.')) {
    const toList = Array.isArray(eventData.to)
      ? eventData.to.map((x: unknown) => String(x || '')).filter(Boolean)
      : eventData.to
      ? [String(eventData.to)]
      : [];

    if (eventType === 'email.bounced' || eventType === 'email.complained') {
      bouncedRecipients.push(...toList);
    }

    let resolvedOwner: { ownerId: string; domain: string } | null = null;
    if (eventType === 'email.received') {
      const emailId = String(eventData.email_id || eventData.id || '').trim();
      resolvedOwner = resolveOwnerByRecipientEmail(toList);
      const parsedFrom = parseEmailAddressHeader(String(eventData.from || ''));
      let textBody = typeof eventData.text === 'string' ? eventData.text : '';
      let htmlBody = typeof eventData.html === 'string' ? eventData.html : '';
      let subject = eventData.subject ? String(eventData.subject) : '(No Subject)';

      if (emailId && (!textBody || !htmlBody)) {
        try {
          const receivingApi = (resend as any).emails?.receiving;
          if (receivingApi && typeof receivingApi.get === 'function') {
            const fetched = await receivingApi.get(emailId);
            const full = fetched?.data || fetched;
            if (full) {
              if (!textBody && typeof full.text === 'string') textBody = full.text;
              if (!htmlBody && typeof full.html === 'string') htmlBody = full.html;
              if ((!subject || subject === '(No Subject)') && full.subject) {
                subject = String(full.subject);
              }
            }
          }
        } catch (fetchErr: any) {
          console.warn('[Resend Webhook] Could not fetch receiving email body:', fetchErr?.message || fetchErr);
        }
      }

      if (!textBody && htmlBody) {
        textBody = htmlBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }

      inboundEmail = {
        ownerId: resolvedOwner?.ownerId,
        domain: resolvedOwner?.domain,
        resendEmailId: emailId || undefined,
        fromEmail: parsedFrom.email,
        fromName: parsedFrom.name,
        to: toList,
        subject,
        text: textBody,
        html: htmlBody,
        receivedAt: event?.created_at || nowIso,
      };
    } else if (eventData.from) {
      resolvedOwner = resolveOwnerByRecipientEmail([String(eventData.from)]);
    }

    store.webhookLogs.unshift({
      id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ownerId: resolvedOwner?.ownerId,
      resendEmailId: eventData.email_id ? String(eventData.email_id) : undefined,
      eventType,
      from: eventData.from ? String(eventData.from) : undefined,
      to: toList.join(', '),
      subject: eventData.subject ? String(eventData.subject) : undefined,
      detail: eventData.bounce?.message || eventData.reason || eventType,
      createdAt: event?.created_at || nowIso,
    });
    if (store.webhookLogs.length > 150) {
      store.webhookLogs.length = 150;
    }
  }

  saveEmailStore(store);

  return {
    handled: true,
    eventType,
    domainUpdated,
    bouncedRecipients: bouncedRecipients.length > 0 ? bouncedRecipients : undefined,
    inboundEmail,
  };
}

export function getUserEmailDeliveryLogs(ownerId: string): EmailDeliveryLogEntry[] {
  const cleanOwnerId = sanitizeOwnerId(ownerId);
  const store = loadEmailStore();
  const domain = store.domainsByOwner[cleanOwnerId]?.domain?.toLowerCase();
  if (!domain) return [];
  return store.webhookLogs
    .filter((entry) => {
      if (entry.ownerId && entry.ownerId === cleanOwnerId) return true;
      if (entry.from && entry.from.toLowerCase().includes(`@${domain}`)) return true;
      if (entry.to && entry.to.toLowerCase().includes(`@${domain}`)) return true;
      return false;
    })
    .slice(0, 30);
}
