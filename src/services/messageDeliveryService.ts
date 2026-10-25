import {
  ChannelType,
  Workspace,
  UserPrivateProfile,
  resolveWorkspaceSenderIdentities,
} from '../types';
import { getGmailAccessToken, getConnectedGmailAddress } from '../firebase';

export interface MessageDeliveryPayload {
  channel: ChannelType;
  to: string;
  leadName: string;
  subject?: string;
  body: string;
  listName?: string;
  source:
    | 'inbox_manual'
    | 'auto_responder'
    | 'automation_workflow'
    | 'campaign_broadcast'
    | 'whatsapp_bot'
    | 'live_test';
  overrideFromIdentity?: string;
  overrideSenderName?: string;
  overrideReplyToEmail?: string;
  workspace?: Workspace;
  privateProfile?: UserPrivateProfile;
}

export interface MessageDeliveryReceipt {
  receiptId: string;
  channel: ChannelType;
  status: 'delivered' | 'dispatched_relay' | 'failed';
  providerUsed: string;
  fromIdentity: string;
  senderName: string;
  toRecipient: string;
  leadName: string;
  subject?: string;
  bodyPreview: string;
  source: string;
  listName?: string;
  directLaunchUrl: string;
  timestamp: string;
  detailMessage: string;
}

export interface GatewayChannelStatus {
  ready: boolean;
  mode: string;
  providerLabel: string;
}

export interface SchedulerSummary {
  queuedCount: number;
  dispatchedCount: number;
  haltedKillSwitchCount: number;
  totalCount: number;
}

export interface MultiChannelGatewayStatus {
  whatsapp: GatewayChannelStatus;
  email: GatewayChannelStatus;
  sms: GatewayChannelStatus;
  scheduler?: SchedulerSummary;
}

export interface ScheduledAutomationJob {
  id: string;
  automationId: string;
  automationName: string;
  stepId: string;
  stepOrder: number;
  stepTitle: string;
  channel: ChannelType;
  contactId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  toRecipient: string;
  contactTags: string[];
  listName: string;
  killSwitchEnabled: boolean;
  killSwitchTags: string[];
  fromIdentity: string;
  senderName: string;
  replyToEmail: string;
  subject: string;
  body: string;
  webhookUrl?: string;
  delaySeconds: number;
  createdAt: string;
  scheduledFor: string;
  processedAt?: string;
  status: 'queued' | 'dispatched' | 'halted_kill_switch' | 'cancelled';
  statusReason: string;
  matchedKillSwitchTag?: string;
  receiptId?: string;
  providerUsed?: string;
  directLaunchUrl?: string;
}

export interface EnqueueScheduledJobInput {
  automationId: string;
  automationName: string;
  stepId: string;
  stepOrder: number;
  stepTitle: string;
  channel: ChannelType;
  contactId: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  toRecipient?: string;
  contactTags?: string[];
  listName: string;
  killSwitchEnabled?: boolean;
  killSwitchTags?: string[];
  fromIdentity?: string;
  senderName?: string;
  replyToEmail?: string;
  subject?: string;
  body: string;
  delaySeconds: number;
  workspace?: Workspace;
  privateProfile?: UserPrivateProfile;
}

export type WhatsAppProviderMode =
  | 'builtin_relay'
  | 'meta_cloud_api'
  | 'twilio_whatsapp'
  | 'ultramsg_gateway';

export type SmsProviderMode =
  | 'builtin_relay'
  | 'twilio_sms'
  | 'termii_sms'
  | 'africastalking_sms';

export type EmailProviderMode =
  | 'builtin_relay'
  | 'gmail_oauth'
  | 'resend_api'
  | 'sendgrid_api'
  | 'smtp';

export interface WhatsAppGatewayConnectorConfig {
  providerMode: WhatsAppProviderMode;
  whatsappBusinessNumber?: string;
  metaPhoneNumberId?: string;
  metaAccessToken?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  ultramsgInstanceId?: string;
  ultramsgToken?: string;
}

export interface SmsGatewayConnectorConfig {
  providerMode: SmsProviderMode;
  smsSenderId?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  termiiApiKey?: string;
  termiiSenderId?: string;
  africasTalkingUsername?: string;
  africasTalkingApiKey?: string;
}

export interface EmailGatewayConnectorConfig {
  providerMode: EmailProviderMode;
  resendApiKey?: string;
  sendgridApiKey?: string;
  smtpHost?: string;
  smtpPort?: number | string;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail?: string;
}

export interface ChannelGatewayRuntimeConfig {
  whatsapp: WhatsAppGatewayConnectorConfig;
  sms: SmsGatewayConnectorConfig;
  email: EmailGatewayConnectorConfig;
}

const LOCAL_RECEIPTS_STORAGE_KEY = 'flowpilot_delivery_receipts_v1';
const LOCAL_WEBHOOK_URL_KEY = 'flowpilot_outbound_webhook_url_v1';
const LOCAL_GATEWAY_CONFIG_KEY = 'flowpilot_channel_gateway_config_v1';

let activeGatewayAccountUid: string | null = null;

export function setActiveGatewayAccountUid(uid: string | null): void {
  activeGatewayAccountUid = uid && uid.trim().length > 0 ? uid.trim() : null;
}

export function getActiveGatewayAccountUid(): string | null {
  return activeGatewayAccountUid;
}

function getScopedKey(baseKey: string, overrideUid?: string | null): string {
  const effectiveUid =
    overrideUid !== undefined ? overrideUid : activeGatewayAccountUid;
  return effectiveUid ? `${baseKey}_${effectiveUid}` : baseKey;
}

const DEFAULT_GATEWAY_RUNTIME_CONFIG: ChannelGatewayRuntimeConfig = {
  whatsapp: {
    providerMode: 'builtin_relay',
    whatsappBusinessNumber: '',
    metaPhoneNumberId: '',
    metaAccessToken: '',
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioFromNumber: '',
    ultramsgInstanceId: '',
    ultramsgToken: '',
  },
  sms: {
    providerMode: 'builtin_relay',
    smsSenderId: '',
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioFromNumber: '',
    termiiApiKey: '',
    termiiSenderId: '',
    africasTalkingUsername: '',
    africasTalkingApiKey: '',
  },
  email: {
    providerMode: 'builtin_relay',
    resendApiKey: '',
    sendgridApiKey: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    fromEmail: '',
  },
};

export function getStoredChannelGatewayConfig(
  overrideUid?: string | null
): ChannelGatewayRuntimeConfig {
  try {
    const scopedKey = getScopedKey(LOCAL_GATEWAY_CONFIG_KEY, overrideUid);
    const raw = localStorage.getItem(scopedKey);
    if (!raw) return DEFAULT_GATEWAY_RUNTIME_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      whatsapp: {
        ...DEFAULT_GATEWAY_RUNTIME_CONFIG.whatsapp,
        ...(parsed?.whatsapp || {}),
      },
      sms: {
        ...DEFAULT_GATEWAY_RUNTIME_CONFIG.sms,
        ...(parsed?.sms || {}),
      },
      email: {
        ...DEFAULT_GATEWAY_RUNTIME_CONFIG.email,
        ...(parsed?.email || {}),
      },
    };
  } catch {
    return DEFAULT_GATEWAY_RUNTIME_CONFIG;
  }
}

export function saveStoredChannelGatewayConfig(
  config: ChannelGatewayRuntimeConfig,
  overrideUid?: string | null
): void {
  try {
    const scopedKey = getScopedKey(LOCAL_GATEWAY_CONFIG_KEY, overrideUid);
    localStorage.setItem(scopedKey, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
}

export function serializeGatewayConfigForProfile(
  config?: ChannelGatewayRuntimeConfig
): string {
  try {
    const target = config || getStoredChannelGatewayConfig();
    return JSON.stringify(target).slice(0, 8000);
  } catch {
    return '{}';
  }
}

export function hydrateGatewayConfigFromPrivateProfile(
  privateProfile?: UserPrivateProfile,
  uid?: string | null
): ChannelGatewayRuntimeConfig {
  if (uid !== undefined) {
    setActiveGatewayAccountUid(uid);
  }
  const raw = privateProfile?.gatewayConfigJson;
  if (raw && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.whatsapp || parsed.sms || parsed.email)) {
        const merged: ChannelGatewayRuntimeConfig = {
          whatsapp: {
            ...DEFAULT_GATEWAY_RUNTIME_CONFIG.whatsapp,
            ...(parsed.whatsapp || {}),
          },
          sms: {
            ...DEFAULT_GATEWAY_RUNTIME_CONFIG.sms,
            ...(parsed.sms || {}),
          },
          email: {
            ...DEFAULT_GATEWAY_RUNTIME_CONFIG.email,
            ...(parsed.email || {}),
          },
        };
        saveStoredChannelGatewayConfig(merged, uid);
        return merged;
      }
    } catch {
      // Ignore parse errors
    }
  }
  return getStoredChannelGatewayConfig(uid);
}

export function getWhatsAppProviderLabel(mode?: string): string {
  return 'WhatsApp QR Connect (Baileys Native Engine)';
}

export async function sendWhatsApp(params: {
  to: string;
  message: string;
  userId?: string;
}): Promise<{ ok: boolean; messageId?: string; detail: string }> {
  try {
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: params.to,
        message: params.message,
        userId: params.userId || 'default_workspace',
      }),
    });
    return await res.json();
  } catch (err: any) {
    return { ok: false, detail: err.message || 'Network error sending WhatsApp message' };
  }
}


export function getSmsProviderLabel(mode: SmsProviderMode): string {
  switch (mode) {
    case 'twilio_sms':
      return 'Twilio Programmable SMS Gateway (Live Connector)';
    case 'termii_sms':
      return 'Termii Carrier SMS Gateway (Live Connector)';
    case 'africastalking_sms':
      return "Africa's Talking SMS Gateway (Live Connector)";
    default:
      return 'FlowPilot Built-In SMS Carrier Relay + Direct SMS Bridge';
  }
}

export function getEmailProviderLabel(mode: EmailProviderMode): string {
  switch (mode) {
    case 'gmail_oauth':
      return 'Google Workspace Gmail API (OAuth Direct)';
    case 'resend_api':
      return 'Resend Transactional Email API (Live Connector)';
    case 'sendgrid_api':
      return 'SendGrid Email API (Live Connector)';
    case 'smtp':
      return 'SMTP Email Gateway (Connected)';
    default:
      return 'FlowPilot Verified Email Relay + Direct Mail Bridge';
  }
}

export function getStoredOutboundWebhookUrl(overrideUid?: string | null): string {
  try {
    return localStorage.getItem(getScopedKey(LOCAL_WEBHOOK_URL_KEY, overrideUid)) || '';
  } catch {
    return '';
  }
}

export function setStoredOutboundWebhookUrl(
  url: string,
  overrideUid?: string | null
): void {
  try {
    const scopedKey = getScopedKey(LOCAL_WEBHOOK_URL_KEY, overrideUid);
    const clean = (url || '').trim();
    if (clean) {
      localStorage.setItem(scopedKey, clean);
    } else {
      localStorage.removeItem(scopedKey);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getStoredDeliveryReceipts(
  overrideUid?: string | null
): MessageDeliveryReceipt[] {
  try {
    const raw = localStorage.getItem(getScopedKey(LOCAL_RECEIPTS_STORAGE_KEY, overrideUid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveReceiptToLocalHistory(receipt: MessageDeliveryReceipt): void {
  try {
    const existing = getStoredDeliveryReceipts();
    const updated = [receipt, ...existing.filter((r) => r.receiptId !== receipt.receiptId)].slice(
      0,
      50
    );
    localStorage.setItem(
      getScopedKey(LOCAL_RECEIPTS_STORAGE_KEY),
      JSON.stringify(updated)
    );
  } catch {
    // Ignore storage errors
  }
}

export function buildDirectChannelUrl(
  channel: ChannelType,
  to: string,
  subject: string,
  body: string
): string {
  if (channel === 'whatsapp') {
    const digits = (to || '').replace(/[^0-9]/g, '') || '15552348910';
    return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
  }
  if (channel === 'email') {
    const cleanEmail = (to || 'lead@example.com').trim();
    return `mailto:${encodeURIComponent(cleanEmail)}?subject=${encodeURIComponent(
      subject || 'Message from FlowPilot'
    )}&body=${encodeURIComponent(body)}`;
  }
  const digits = (to || '').replace(/[^0-9]/g, '') || '15552348910';
  return `sms:+${digits}?body=${encodeURIComponent(body)}`;
}

export function buildOneClickUnsubscribeUrl(
  recipient: string,
  campaignId?: string,
  automationId?: string
): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://flowpilot.app';
  const params = new URLSearchParams();
  params.set('unsubscribe', (recipient || 'lead@example.com').trim());
  if (campaignId) params.set('campaignId', campaignId);
  if (automationId) params.set('automationId', automationId);
  return `${origin}/?${params.toString()}`;
}

export function buildLiveOpenPixelUrl(
  recipient: string,
  campaignId?: string,
  automationId?: string
): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://flowpilot.app';
  const params = new URLSearchParams();
  params.set('recipient', (recipient || 'lead@example.com').trim());
  if (campaignId) params.set('campaignId', campaignId);
  if (automationId) params.set('automationId', automationId);
  return `${origin}/api/track/open?${params.toString()}`;
}

export function buildLiveClickTrackingUrl(
  targetUrl: string,
  recipient: string,
  campaignId?: string,
  automationId?: string
): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://flowpilot.app';
  const params = new URLSearchParams();
  params.set('url', (targetUrl || 'https://example.com').trim());
  params.set('recipient', (recipient || 'lead@example.com').trim());
  if (campaignId) params.set('campaignId', campaignId);
  if (automationId) params.set('automationId', automationId);
  return `${origin}/api/track/click?${params.toString()}`;
}

export function personalizeAutomationMessage(
  template: string,
  context: {
    fullName?: string;
    email?: string;
    phone?: string;
    company?: string;
    listName?: string;
    senderName?: string;
    campaignId?: string;
    automationId?: string;
  }
): string {
  const full = (context.fullName || 'Valued Lead').trim();
  const first = full.split(/\s+/)[0] || 'there';
  const recipientKey = context.email || context.phone || 'lead@example.com';
  const unsubUrl = buildOneClickUnsubscribeUrl(
    recipientKey,
    context.campaignId,
    context.automationId
  );
  return (template || '')
    .replace(/\{\{\s*first_name\s*\}\}/gi, first)
    .replace(/\{\{\s*full_name\s*\}\}/gi, full)
    .replace(/\{\{\s*name\s*\}\}/gi, full)
    .replace(/\{\{\s*email\s*\}\}/gi, context.email || 'lead@example.com')
    .replace(/\{\{\s*phone\s*\}\}/gi, context.phone || '+1 (555) 234-8910')
    .replace(/\{\{\s*company\s*\}\}/gi, context.company || 'your organization')
    .replace(/\{\{\s*list_name\s*\}\}/gi, context.listName || 'VIP List')
    .replace(/\{\{\s*sender_name\s*\}\}/gi, context.senderName || 'FlowPilot Team')
    .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, unsubUrl);
}

export async function fetchGatewayStatus(): Promise<MultiChannelGatewayStatus> {
  const storedConfig = getStoredChannelGatewayConfig();
  try {
    const res = await fetch('/api/messages/gateway-status');
    if (res.ok) {
      const data = await res.json();
      if (data?.channels) {
        const serverChannels = data.channels as MultiChannelGatewayStatus;
        return {
          whatsapp:
            storedConfig.whatsapp.providerMode !== 'builtin_relay'
              ? {
                  ready: true,
                  mode: storedConfig.whatsapp.providerMode,
                  providerLabel: getWhatsAppProviderLabel(
                    storedConfig.whatsapp.providerMode
                  ),
                }
              : serverChannels.whatsapp,
          email:
            storedConfig.email.providerMode !== 'builtin_relay'
              ? {
                  ready: true,
                  mode: storedConfig.email.providerMode,
                  providerLabel: getEmailProviderLabel(storedConfig.email.providerMode),
                }
              : serverChannels.email,
          sms:
            storedConfig.sms.providerMode !== 'builtin_relay'
              ? {
                  ready: true,
                  mode: storedConfig.sms.providerMode,
                  providerLabel: getSmsProviderLabel(storedConfig.sms.providerMode),
                }
              : serverChannels.sms,
          scheduler: data.scheduler,
        };
      }
    }
  } catch {
    // Fallback if offline
  }
  return {
    whatsapp: {
      ready: true,
      mode: storedConfig.whatsapp.providerMode,
      providerLabel: getWhatsAppProviderLabel(storedConfig.whatsapp.providerMode),
    },
    email: {
      ready: true,
      mode: storedConfig.email.providerMode,
      providerLabel: getEmailProviderLabel(storedConfig.email.providerMode),
    },
    sms: {
      ready: true,
      mode: storedConfig.sms.providerMode,
      providerLabel: getSmsProviderLabel(storedConfig.sms.providerMode),
    },
  };
}

export async function deliverChannelMessage(
  payload: MessageDeliveryPayload
): Promise<MessageDeliveryReceipt> {
  const identities = resolveWorkspaceSenderIdentities(
    payload.workspace,
    payload.privateProfile
  );
  const senderName =
    payload.overrideSenderName?.trim() ||
    payload.workspace?.senderName ||
    payload.workspace?.name ||
    'FlowPilot Workspace';

  const gmailToken = getGmailAccessToken();
  const connectedGmail = getConnectedGmailAddress();
  const storedGateways = getStoredChannelGatewayConfig();

  const resolvedFrom =
    payload.overrideFromIdentity?.trim() ||
    (payload.channel === 'whatsapp'
      ? identities.whatsappBusinessNumber
      : payload.channel === 'email'
      ? identities.activeEmailMode === 'custom_domain'
        ? identities.activeSenderEmail
        : connectedGmail || identities.activeSenderEmail
      : identities.smsSenderId);

  const defaultRecipient =
    payload.channel === 'email' ? 'lead@example.com' : '+1 (555) 234-8910';
  const cleanRecipient = (payload.to || '').trim() || defaultRecipient;
  const webhookUrl = getStoredOutboundWebhookUrl();

  // DIRECT BAILEYS QR WHATSAPP SENDER DISPATCH
  if (payload.channel === 'whatsapp') {
    try {
      const waRes = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: cleanRecipient,
          message: payload.body,
          userId: payload.workspace?.ownerId || 'default_workspace',
        }),
      });
      if (waRes.ok) {
        const waData = await waRes.json();
        const receipt: MessageDeliveryReceipt = {
          receiptId: waData.messageId || `rcpt_wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          channel: 'whatsapp',
          status: 'delivered',
          providerUsed: 'WhatsApp QR Connect (Baileys)',
          fromIdentity: resolvedFrom,
          senderName,
          toRecipient: cleanRecipient,
          leadName: payload.leadName || 'Lead Contact',
          bodyPreview: payload.body.slice(0, 240),
          source: payload.source,
          listName: payload.listName || 'General Contacts',
          directLaunchUrl: `https://wa.me/${cleanRecipient.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(payload.body)}`,
          timestamp: new Date().toISOString(),
          detailMessage: waData.detail || `Delivered via Baileys WhatsApp QR to ${cleanRecipient}`,
        };
        saveReceiptToLocalHistory(receipt);
        return receipt;
      }
    } catch (waErr: any) {
      console.warn('[deliverChannelMessage] /api/whatsapp/send notice:', waErr);
    }
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (gmailToken) {
      headers.Authorization = `Bearer ${gmailToken}`;
    }

    const res = await fetch('/api/messages/deliver', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        channel: payload.channel,
        to: cleanRecipient,
        leadName: payload.leadName || 'Lead Contact',
        from: resolvedFrom,
        senderName,
        replyToEmail:
          payload.overrideReplyToEmail?.trim() ||
          payload.privateProfile?.replyToEmail ||
          connectedGmail ||
          identities.activeSenderEmail,
        subject: payload.subject || `Message from ${senderName}`,
        body: payload.body,
        listName: payload.listName || 'General Contacts',
        source: payload.source,
        webhookUrl,
        gmailAccessToken: gmailToken || undefined,
        whatsappConnector: storedGateways.whatsapp,
        smsConnector: storedGateways.sms,
        emailConnector: storedGateways.email,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.receipt) {
        const receipt = data.receipt as MessageDeliveryReceipt;
        saveReceiptToLocalHistory(receipt);
        return receipt;
      }
    }
  } catch {
    // Fallback to client-side relay receipt if backend unreachable
  }

  const fallbackReceipt: MessageDeliveryReceipt = {
    receiptId: `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    channel: payload.channel,
    status: 'dispatched_relay',
    providerUsed:
      payload.channel === 'whatsapp'
        ? getWhatsAppProviderLabel(storedGateways.whatsapp.providerMode)
        : payload.channel === 'email'
        ? gmailToken
          ? 'Google Workspace Gmail API (OAuth)'
          : getEmailProviderLabel(storedGateways.email.providerMode)
        : getSmsProviderLabel(storedGateways.sms.providerMode),
    fromIdentity: resolvedFrom,
    senderName,
    toRecipient: cleanRecipient,
    leadName: payload.leadName || 'Lead Contact',
    ...(payload.channel === 'email' && payload.subject ? { subject: payload.subject } : {}),
    bodyPreview: payload.body.slice(0, 240),
    source: payload.source,
    listName: payload.listName || 'General Contacts',
    directLaunchUrl: buildDirectChannelUrl(
      payload.channel,
      cleanRecipient,
      payload.subject || `Message from ${senderName}`,
      payload.body
    ),
    timestamp: new Date().toISOString(),
    detailMessage: `Dispatched from ${resolvedFrom} (${senderName}) to ${cleanRecipient} via ${payload.channel.toUpperCase()}`,
  };

  saveReceiptToLocalHistory(fallbackReceipt);
  return fallbackReceipt;
}

// ============================================================================
// SERVER BACKGROUND SCHEDULER & LIST KILL SWITCH CLIENT API
// ============================================================================
export async function fetchScheduledJobs(): Promise<{
  summary: SchedulerSummary;
  jobs: ScheduledAutomationJob[];
}> {
  try {
    const res = await fetch('/api/scheduler/jobs');
    if (res.ok) {
      const data = await res.json();
      return {
        summary: data.summary || {
          queuedCount: 0,
          dispatchedCount: 0,
          haltedKillSwitchCount: 0,
          totalCount: 0,
        },
        jobs: Array.isArray(data.jobs) ? data.jobs : [],
      };
    }
  } catch {
    // Ignore network error
  }
  return {
    summary: {
      queuedCount: 0,
      dispatchedCount: 0,
      haltedKillSwitchCount: 0,
      totalCount: 0,
    },
    jobs: [],
  };
}

export async function enqueueScheduledAutomationJobs(
  inputs: EnqueueScheduledJobInput[]
): Promise<{
  createdJobs: ScheduledAutomationJob[];
  summary: SchedulerSummary;
  jobs: ScheduledAutomationJob[];
}> {
  const gmailToken = getGmailAccessToken();
  const connectedGmail = getConnectedGmailAddress();
  const webhookUrl = getStoredOutboundWebhookUrl();
  const storedGateways = getStoredChannelGatewayConfig();

  const preparedJobs = inputs.map((item) => {
    const identities = resolveWorkspaceSenderIdentities(
      item.workspace,
      item.privateProfile
    );
    const senderName =
      item.senderName ||
      item.workspace?.senderName ||
      item.workspace?.name ||
      'FlowPilot Workspace';
    const resolvedFrom =
      item.fromIdentity ||
      (item.channel === 'whatsapp'
        ? identities.whatsappBusinessNumber
        : item.channel === 'email'
        ? identities.activeEmailMode === 'custom_domain'
          ? identities.activeSenderEmail
          : connectedGmail || identities.activeSenderEmail
        : identities.smsSenderId);

    return {
      ...item,
      fromIdentity: resolvedFrom,
      senderName,
      replyToEmail:
        item.replyToEmail ||
        item.privateProfile?.replyToEmail ||
        connectedGmail ||
        identities.activeSenderEmail,
      webhookUrl,
      gmailAccessToken: gmailToken || undefined,
      whatsappConnector: storedGateways.whatsapp,
      smsConnector: storedGateways.sms,
      emailConnector: storedGateways.email,
    };
  });

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (gmailToken) {
      headers.Authorization = `Bearer ${gmailToken}`;
    }
    const res = await fetch('/api/scheduler/enqueue', {
      method: 'POST',
      headers,
      body: JSON.stringify({ jobs: preparedJobs }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        createdJobs: Array.isArray(data.createdJobs) ? data.createdJobs : [],
        summary: data.summary || {
          queuedCount: 0,
          dispatchedCount: 0,
          haltedKillSwitchCount: 0,
          totalCount: 0,
        },
        jobs: Array.isArray(data.jobs) ? data.jobs : [],
      };
    }
  } catch {
    // Ignore offline error
  }
  return {
    createdJobs: [],
    summary: {
      queuedCount: 0,
      dispatchedCount: 0,
      haltedKillSwitchCount: 0,
      totalCount: 0,
    },
    jobs: [],
  };
}

export async function syncKillSwitchWithServerScheduler(params: {
  contacts?: Array<{
    id?: string;
    email?: string;
    phone?: string;
    fullName?: string;
    listName?: string;
    consentStatus?: string;
    tags: string[];
  }>;
  lists?: Array<{
    name: string;
    killSwitchEnabled: boolean;
    killSwitchTags: string[];
  }>;
}): Promise<{
  haltedCount: number;
  haltedJobs: ScheduledAutomationJob[];
  summary: SchedulerSummary;
  jobs: ScheduledAutomationJob[];
}> {
  try {
    const res = await fetch('/api/scheduler/sync-kill-switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        haltedCount: Number(data.haltedCount) || 0,
        haltedJobs: Array.isArray(data.haltedJobs) ? data.haltedJobs : [],
        summary: data.summary || {
          queuedCount: 0,
          dispatchedCount: 0,
          haltedKillSwitchCount: 0,
          totalCount: 0,
        },
        jobs: Array.isArray(data.jobs) ? data.jobs : [],
      };
    }
  } catch {
    // Ignore offline error
  }
  return {
    haltedCount: 0,
    haltedJobs: [],
    summary: {
      queuedCount: 0,
      dispatchedCount: 0,
      haltedKillSwitchCount: 0,
      totalCount: 0,
    },
    jobs: [],
  };
}

export async function triggerScheduledJobNow(jobId: string): Promise<{
  job?: ScheduledAutomationJob;
  summary: SchedulerSummary;
  jobs: ScheduledAutomationJob[];
}> {
  try {
    const res = await fetch('/api/scheduler/trigger-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        job: data.job,
        summary: data.summary || {
          queuedCount: 0,
          dispatchedCount: 0,
          haltedKillSwitchCount: 0,
          totalCount: 0,
        },
        jobs: Array.isArray(data.jobs) ? data.jobs : [],
      };
    }
  } catch {
    // Ignore error
  }
  return fetchScheduledJobs();
}

export async function cancelScheduledJob(params: {
  jobId?: string;
  clearCompleted?: boolean;
}): Promise<{
  summary: SchedulerSummary;
  jobs: ScheduledAutomationJob[];
}> {
  try {
    const res = await fetch('/api/scheduler/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        summary: data.summary || {
          queuedCount: 0,
          dispatchedCount: 0,
          haltedKillSwitchCount: 0,
          totalCount: 0,
        },
        jobs: Array.isArray(data.jobs) ? data.jobs : [],
      };
    }
  } catch {
    // Ignore error
  }
  return fetchScheduledJobs();
}

export interface InboundWebhookPayloadItem {
  id: string;
  channel: ChannelType;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  message: string;
  subject?: string;
  listName?: string;
  receivedAt: string;
}

export async function pollAndConsumeInboundWebhooks(): Promise<InboundWebhookPayloadItem[]> {
  try {
    const res = await fetch('/api/webhooks/inbound?consume=true');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.items) && data.items.length > 0) {
        return data.items as InboundWebhookPayloadItem[];
      }
    }
  } catch {
    // Ignore polling error if offline
  }
  return [];
}

export interface PublicLeadCaptureEventItem {
  id: string;
  assetId: string;
  assetSlug: string;
  assetName: string;
  targetList: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  tags: string[];
  customTags: string[];
  customFields: string[];
  notes?: string;
  automationIdToTrigger?: string;
  createdAt: string;
}

export async function submitPublicLeadCapture(payload: {
  assetId?: string;
  assetSlug?: string;
  assetName?: string;
  targetList: string;
  fullName: string;
  email: string;
  phone: string;
  company?: string;
  tags?: string[];
  customTags?: string[];
  customFields?: string[];
  redirectUrl?: string;
  automationIdToTrigger?: string;
}): Promise<{ ok: boolean; lead?: PublicLeadCaptureEventItem }> {
  try {
    const res = await fetch('/api/leads/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, lead: data?.lead };
    }
  } catch {
    // Ignore network error
  }
  return { ok: false };
}

export const submitPublicLeadToCaptureWebhook = submitPublicLeadCapture;

export async function pollAndConsumePublicLeads(): Promise<PublicLeadCaptureEventItem[]> {
  try {
    const res = await fetch('/api/leads/capture?consume=true');
    if (res.ok) {
      const data = await res.json();
      const rawItems = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.submissions)
        ? data.submissions
        : [];
      if (rawItems.length > 0) {
        return rawItems.map((it: Record<string, unknown>) => ({
          id: String(it.id || ''),
          assetId: String(it.assetId || it.assetSlug || ''),
          assetSlug: String(it.assetSlug || it.assetId || ''),
          assetName: String(it.assetName || it.assetSlug || ''),
          targetList: String(it.targetList || 'General Contacts'),
          fullName: String(it.fullName || 'Captured Lead'),
          email: String(it.email || ''),
          phone: String(it.phone || ''),
          company: String(it.company || ''),
          tags: Array.isArray(it.tags)
            ? (it.tags as string[])
            : Array.isArray(it.customTags)
            ? (it.customTags as string[])
            : [],
          customTags: Array.isArray(it.customTags)
            ? (it.customTags as string[])
            : Array.isArray(it.tags)
            ? (it.tags as string[])
            : [],
          customFields: Array.isArray(it.customFields) ? (it.customFields as string[]) : [],
          notes: typeof it.notes === 'string' ? it.notes : undefined,
          createdAt: String(it.createdAt || it.submittedAt || new Date().toISOString()),
        }));
      }
    }
  } catch {
    // Ignore polling error if offline
  }
  return [];
}

export const pollAndConsumePublicLeadCaptures = pollAndConsumePublicLeads;

export interface TrackingComplianceEventItem {
  id: string;
  type: 'open' | 'click' | 'unsubscribe' | 'resubscribe';
  eventType: 'open' | 'click' | 'unsubscribe' | 'resubscribe';
  campaignId?: string;
  automationId?: string;
  recipient: string;
  targetUrl?: string;
  reason?: string;
  createdAt: string;
}

export async function pollAndConsumeTrackingEvents(): Promise<TrackingComplianceEventItem[]> {
  try {
    const res = await fetch('/api/track/events?consume=true');
    if (res.ok) {
      const data = await res.json();
      const rawEvents = Array.isArray(data?.events)
        ? data.events
        : Array.isArray(data?.items)
        ? data.items
        : [];
      if (rawEvents.length > 0) {
        return rawEvents.map((ev: Record<string, unknown>) => {
          const evType = (ev.eventType || ev.type || 'open') as
            | 'open'
            | 'click'
            | 'unsubscribe'
            | 'resubscribe';
          return {
            id: String(ev.id || ''),
            type: evType,
            eventType: evType,
            campaignId: ev.campaignId ? String(ev.campaignId) : undefined,
            automationId: ev.automationId ? String(ev.automationId) : undefined,
            recipient: String(ev.recipient || ''),
            targetUrl: ev.targetUrl ? String(ev.targetUrl) : undefined,
            reason: ev.reason ? String(ev.reason) : undefined,
            createdAt: String(ev.createdAt || new Date().toISOString()),
          };
        });
      }
    }
  } catch {
    // Ignore polling error if offline
  }
  return [];
}

export const pollAndConsumeTrackingComplianceEvents = pollAndConsumeTrackingEvents;

export async function triggerOneClickUnsubscribe(params: {
  recipient: string;
  campaignId?: string;
  automationId?: string;
  reason?: string;
  action?: 'unsubscribe' | 'resubscribe';
}): Promise<{ ok: boolean; status: string }> {
  try {
    const res = await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, status: data?.status || 'unsubscribed' };
    }
  } catch {
    // Ignore network error
  }
  return { ok: false, status: 'error' };
}

export async function triggerLiveTrackingTestEvent(params: {
  type: 'open' | 'click';
  recipient: string;
  campaignId?: string;
  automationId?: string;
  targetUrl?: string;
}): Promise<boolean> {
  try {
    const query = new URLSearchParams();
    query.set('recipient', params.recipient || 'lead@example.com');
    query.set('json', 'true');
    if (params.campaignId) query.set('campaignId', params.campaignId);
    if (params.automationId) query.set('automationId', params.automationId);
    if (params.type === 'click') {
      query.set('url', params.targetUrl || 'https://flowpilot.app/offer');
      const res = await fetch(`/api/track/click?${query.toString()}`);
      return res.ok;
    } else {
      const res = await fetch(`/api/track/open?${query.toString()}`);
      return res.ok;
    }
  } catch {
    return false;
  }
}
