import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../.data');
const STORE_PATH = path.join(DATA_DIR, 'webhook_gateway_store.json');

export interface WebhookExtractedContact {
  fullName?: string;
  email?: string;
  phone?: string;
  company?: string;
  amount?: number;
  tags?: string[];
  stage?: string;
  listName?: string;
}

export interface WebhookGatewayLog {
  id: string;
  timestamp: string;
  url?: string;
  source: string;
  event: string;
  status: number;
  latencyMs: number;
  method: string;
  ip: string;
  userAgent: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: any;
  parsedFields: WebhookExtractedContact;
  actionTaken: string;
  isSimulated?: boolean;
}

export interface WebhookFieldMappingConfig {
  emailPath: string;
  namePath: string;
  phonePath: string;
  companyPath: string;
  amountPath: string;
  tagsPath: string;
  targetList: string;
  autoTriggerWorkflowId?: string;
}

export interface WebhookGatewayStore {
  token: string;
  isEnabled: boolean;
  mappings: WebhookFieldMappingConfig;
  logs: WebhookGatewayLog[];
}

const DEFAULT_MAPPINGS: WebhookFieldMappingConfig = {
  emailPath: 'email',
  namePath: 'name',
  phonePath: 'phone',
  companyPath: 'company',
  amountPath: 'amount',
  tagsPath: 'tags',
  targetList: 'General Contacts',
};

const DEFAULT_TOKEN = 'flowpilot_sec_7x9q2m1k8p4w';

let cachedStore: WebhookGatewayStore | null = null;

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Ignore
  }
}

function loadStore(): WebhookGatewayStore {
  if (cachedStore) return cachedStore;
  ensureDataDir();

  const fallback: WebhookGatewayStore = {
    token: process.env.FLOWPILOT_WEBHOOK_SECRET || DEFAULT_TOKEN,
    isEnabled: true,
    mappings: DEFAULT_MAPPINGS,
    logs: [],
  };

  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      cachedStore = {
        token: parsed.token || fallback.token,
        isEnabled: parsed.isEnabled !== undefined ? parsed.isEnabled : true,
        mappings: { ...DEFAULT_MAPPINGS, ...(parsed.mappings || {}) },
        logs: Array.isArray(parsed.logs) ? parsed.logs.slice(0, 100) : [],
      };
      return cachedStore;
    } catch {
      // Use fallback
    }
  }

  cachedStore = fallback;
  return cachedStore;
}

function saveStore(): void {
  if (!cachedStore) return;
  ensureDataDir();
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(cachedStore, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Webhook Gateway] Notice: Could not flush store to disk:', err);
  }
}

/**
 * Extract nested property from an object using dot notation (e.g. 'data.object.customer.email')
 */
export function getNestedValue(obj: any, pathStr: string): any {
  if (!obj || typeof obj !== 'object' || !pathStr) return undefined;
  const parts = pathStr.split('.');
  let current: any = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Intelligent source detector based on headers, query params, and body signatures
 */
export function detectWebhookSource(headers: Record<string, string>, body: any): { source: string; event: string } {
  const ua = String(headers['user-agent'] || '').toLowerCase();
  const stripeSig = headers['stripe-signature'];
  const shopifyTopic = headers['x-shopify-topic'];
  const githubEvent = headers['x-github-event'];
  const typeformSig = headers['typeform-signature'];

  if (stripeSig || ua.includes('stripe') || (body && body.object === 'event' && body.data)) {
    const ev = body?.type || 'stripe.event';
    return { source: 'Stripe', event: ev };
  }

  if (shopifyTopic || ua.includes('shopify') || (body && (body.line_items || body.order_number))) {
    const ev = shopifyTopic || (body?.id ? 'orders/create' : 'shopify.webhook');
    return { source: 'Shopify', event: String(ev) };
  }

  if (ua.includes('zapier')) {
    const ev = body?.event || body?.action || body?.type || 'zapier.trigger';
    return { source: 'Zapier', event: String(ev) };
  }

  if (ua.includes('make.com') || ua.includes('integromat')) {
    const ev = body?.event || body?.scenario || 'make.scenario';
    return { source: 'Make (Integromat)', event: String(ev) };
  }

  if (typeformSig || ua.includes('typeform') || body?.form_response) {
    return { source: 'Typeform', event: body?.form_response?.form_id ? `form_${body.form_response.form_id}` : 'form_submission' };
  }

  if (body && (body.event_type || body.resource_type === 'sale')) {
    return { source: 'PayPal', event: String(body.event_type || 'paypal.payment') };
  }

  if (githubEvent) {
    return { source: 'GitHub', event: String(githubEvent) };
  }

  if (ua.includes('curl')) {
    return { source: 'cURL / Terminal', event: body?.event || body?.type || 'custom_request' };
  }

  const genericEv = body?.event || body?.type || body?.action || body?.topic || 'inbound_payload';
  return { source: 'Custom / API', event: String(genericEv) };
}

/**
 * Intelligent field parser that extracts contact details from arbitrary payloads
 */
export function extractFieldsFromPayload(body: any, mappings: WebhookFieldMappingConfig): WebhookExtractedContact {
  if (!body || typeof body !== 'object') {
    return {};
  }

  // 1. Try configured mapping paths first
  let email = getNestedValue(body, mappings.emailPath);
  let name = getNestedValue(body, mappings.namePath);
  let phone = getNestedValue(body, mappings.phonePath);
  let company = getNestedValue(body, mappings.companyPath);
  let amount = getNestedValue(body, mappings.amountPath);
  let rawTags = getNestedValue(body, mappings.tagsPath);

  // 2. Intelligent heuristic fallback if mapping path didn't yield a value
  if (!email) {
    email =
      body.email ||
      body.customer_email ||
      body.client_email ||
      body.user_email ||
      body.customer?.email ||
      body.lead?.email ||
      body.data?.object?.customer_details?.email ||
      body.data?.object?.email ||
      body.data?.object?.receipt_email ||
      body.data?.customer?.email ||
      body.order?.customer?.email ||
      body.payer?.payer_info?.email;
  }

  if (!name) {
    const shopifyName = body.order?.customer?.first_name
      ? `${body.order.customer.first_name} ${body.order.customer.last_name || ''}`.trim()
      : undefined;

    name =
      body.fullName ||
      body.full_name ||
      body.name ||
      body.customer_name ||
      body.customer?.name ||
      body.lead?.name ||
      body.data?.object?.customer_details?.name ||
      shopifyName ||
      (body.firstName ? `${body.firstName} ${body.lastName || ''}`.trim() : undefined) ||
      (body.first_name ? `${body.first_name} ${body.last_name || ''}`.trim() : undefined);
  }

  if (!phone) {
    phone =
      body.phone ||
      body.phoneNumber ||
      body.phone_number ||
      body.whatsapp ||
      body.mobile ||
      body.customer?.phone ||
      body.data?.object?.customer_details?.phone ||
      body.order?.customer?.phone ||
      body.order?.billing_address?.phone;
  }

  if (!company) {
    company =
      body.company ||
      body.organization ||
      body.org_name ||
      body.customer?.company ||
      body.order?.billing_address?.company;
  }

  if (amount === undefined || amount === null) {
    const rawAmt =
      body.amount ||
      body.total ||
      body.total_price ||
      body.amount_total ||
      body.data?.object?.amount_total ||
      body.data?.object?.amount;

    if (rawAmt !== undefined && rawAmt !== null) {
      const num = Number(rawAmt);
      if (!isNaN(num)) {
        // Stripe cents conversion
        amount = num > 500 && (body.data?.object?.currency || body.currency) ? num / 100 : num;
      }
    }
  }

  // Tags assembly
  const tags: string[] = [];
  if (Array.isArray(rawTags)) {
    tags.push(...rawTags.map(String));
  } else if (typeof rawTags === 'string' && rawTags.trim()) {
    tags.push(...rawTags.split(/[;,]/).map((t) => t.trim()).filter(Boolean));
  }

  // Auto-tag with event type if available
  const detectedEvent = body.event || body.type || body.action;
  if (detectedEvent && typeof detectedEvent === 'string') {
    tags.push(detectedEvent.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 32));
  }

  return {
    fullName: typeof name === 'string' ? name.trim().slice(0, 100) : undefined,
    email: typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase().slice(0, 150) : undefined,
    phone: typeof phone === 'string' ? phone.trim().slice(0, 40) : undefined,
    company: typeof company === 'string' ? company.trim().slice(0, 100) : undefined,
    amount: typeof amount === 'number' && !isNaN(amount) ? amount : undefined,
    tags: Array.from(new Set(tags)).filter(Boolean),
    listName: mappings.targetList || 'General Contacts',
    stage: amount && amount > 0 ? 'customer' : 'lead',
  };
}

/**
 * Get current gateway settings & verification token
 */
export function getWebhookGatewayConfig(): {
  token: string;
  isEnabled: boolean;
  mappings: WebhookFieldMappingConfig;
  totalLogs: number;
} {
  const store = loadStore();
  return {
    token: store.token,
    isEnabled: store.isEnabled,
    mappings: store.mappings,
    totalLogs: store.logs.length,
  };
}

/**
 * Update gateway configuration
 */
export function updateWebhookGatewayConfig(updates: Partial<WebhookGatewayStore>): WebhookGatewayStore {
  const store = loadStore();
  if (updates.token) store.token = String(updates.token).trim();
  if (updates.isEnabled !== undefined) store.isEnabled = Boolean(updates.isEnabled);
  if (updates.mappings) store.mappings = { ...store.mappings, ...updates.mappings };
  saveStore();
  return store;
}

/**
 * Regenerate a secure random permanent secret token
 */
export function generateNewWebhookToken(): string {
  const store = loadStore();
  const rand = Math.random().toString(36).substring(2, 14);
  const newToken = `flowpilot_sec_${rand}`;
  store.token = newToken;
  saveStore();
  return newToken;
}

/**
 * Retrieve recent log entries
 */
export function getWebhookLogs(limit: number = 50): WebhookGatewayLog[] {
  const store = loadStore();
  return store.logs.slice(0, limit);
}

/**
 * Clear log history
 */
export function clearWebhookLogs(): void {
  const store = loadStore();
  store.logs = [];
  saveStore();
}

/**
 * Ingest and record an inbound webhook request
 */
export function recordAndProcessWebhook(params: {
  method: string;
  url?: string;
  ip: string;
  userAgent: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: any;
  startTimeMs: number;
  statusCode?: number;
  isSimulated?: boolean;
}): {
  success: boolean;
  status: number;
  log: WebhookGatewayLog;
  extracted: WebhookExtractedContact;
} {
  const store = loadStore();
  const { source, event } = detectWebhookSource(params.headers, params.body);
  const extracted = extractFieldsFromPayload(params.body, store.mappings);
  const latencyMs = Math.max(1, Math.round(Date.now() - params.startTimeMs));

  let actionTaken = 'Payload parsed and queued for CRM sync.';
  if (extracted.email || extracted.phone) {
    actionTaken = `Extracted contact ${extracted.fullName || extracted.email || extracted.phone} (${extracted.tags?.join(', ') || 'no tags'})`;
  } else {
    actionTaken = 'Payload recorded; no contact email or phone identified.';
  }

  const logEntry: WebhookGatewayLog = {
    id: `whlog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    url: params.url || '/api/webhook/gateway',
    source,
    event,
    status: params.statusCode || 200,
    latencyMs,
    method: params.method || 'POST',
    ip: params.ip || '127.0.0.1',
    userAgent: params.userAgent || 'Unknown Agent',
    headers: params.headers,
    query: params.query,
    body: params.body,
    parsedFields: extracted,
    actionTaken,
    isSimulated: Boolean(params.isSimulated),
  };

  store.logs.unshift(logEntry);
  if (store.logs.length > 100) {
    store.logs.pop();
  }
  saveStore();

  return {
    success: true,
    status: logEntry.status,
    log: logEntry,
    extracted,
  };
}

/**
 * Find log by ID for replay
 */
export function getWebhookLogById(id: string): WebhookGatewayLog | undefined {
  const store = loadStore();
  return store.logs.find((l) => l.id === id);
}
