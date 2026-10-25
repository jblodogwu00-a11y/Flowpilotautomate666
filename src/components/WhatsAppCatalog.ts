import { GoogleGenAI } from '@google/genai';
import { Contact, Workspace } from '../types';

export type OfficialWhatsAppProviderId = 'whatsapp_qr_connect' | 'meta_cloud_api';
export type MetaMessagingTier = 'tier_1k' | 'tier_10k' | 'tier_100k' | 'tier_unlimited';
export type MetaQualityRating = 'GREEN' | 'YELLOW' | 'RED';
export type WhatsAppTemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
export type WhatsAppMessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export interface OfficialWhatsAppProviderSpec {
  id: OfficialWhatsAppProviderId;
  name: string;
  badge: string;
  apiEndpoint: string;
  supportsReadReceipts: boolean;
  supportsTemplateSync: boolean;
  supportsInteractiveButtons: boolean;
  pricingModelNote: string;
  maxThroughputMps?: number;
}

export const OFFICIAL_WHATSAPP_PROVIDERS: OfficialWhatsAppProviderSpec[] = [
  {
    id: 'whatsapp_qr_connect',
    name: 'WhatsApp QR Connect (Baileys Native Socket)',
    badge: 'Direct Device Link',
    apiEndpoint: '/api/whatsapp/send',
    supportsReadReceipts: true,
    supportsTemplateSync: true,
    supportsInteractiveButtons: true,
    maxThroughputMps: 60,
    pricingModelNote: '100% Free & Unlimited. Zero Meta conversation fees, zero API tokens, direct device socket.',
  },
];

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language?: string;
  category: WhatsAppTemplateCategory;
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttons?: Array<{ type?: string; text: string }>;
  sampleParams?: string[];
  qualityRating?: string;
  lastSyncedAt?: string;
  status?: 'APPROVED' | 'PENDING' | 'REJECTED';
}

export const INITIAL_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tpl_welcome_vip',
    name: 'vip_welcome_onboarding_v1',
    language: 'en_US',
    category: 'UTILITY',
    headerText: 'Welcome to VIP Priority Access',
    bodyText: 'Hi {{1}}, thank you for connecting with {{2}}. Here is your access pass: {{3}}.',
    footerText: 'Reply STOP anytime to opt out.',
    buttons: [{ type: 'QUICK_REPLY', text: 'Access Portal' }, { type: 'QUICK_REPLY', text: 'Chat with Specialist' }],
    qualityRating: 'GREEN',
    lastSyncedAt: 'Live verified · Just now',
    status: 'APPROVED',
  },
  {
    id: 'tpl_session_reminder',
    name: 'consultation_session_reminder_v2',
    language: 'en_US',
    category: 'UTILITY',
    headerText: 'Upcoming Consultation Reminder',
    bodyText: 'Hello {{1}}, confirming your scheduled strategy call with {{2}} at {{3}}.',
    footerText: 'Reply 1 to confirm, 2 to reschedule.',
    buttons: [{ type: 'QUICK_REPLY', text: 'Confirm 100%' }, { type: 'QUICK_REPLY', text: 'Reschedule Time' }],
    qualityRating: 'GREEN',
    lastSyncedAt: 'Live verified · Just now',
    status: 'APPROVED',
  },
  {
    id: 'tpl_cart_recovery',
    name: 'priority_order_recovery_v1',
    language: 'en_US',
    category: 'MARKETING',
    headerText: 'Complete Your Enrollment',
    bodyText: 'Hi {{1}}, your reserved spot with {{2}} expires in 2 hours: {{3}}.',
    footerText: 'Standard messaging rates apply. Reply STOP to cancel.',
    buttons: [{ type: 'QUICK_REPLY', text: 'Claim Spot' }, { type: 'QUICK_REPLY', text: 'Ask a Question' }],
    qualityRating: 'GREEN',
    lastSyncedAt: 'Live verified · Just now',
    status: 'APPROVED',
  },
];

export interface WhatsAppTemplateLibraryItem {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'WELCOME';
  label: string;
  body: string;
}

export const POPULAR_WHATSAPP_TEMPLATES: WhatsAppTemplateLibraryItem[] = [
  {
    id: 'tpl_welcome_vip',
    name: 'welcome_vip_access',
    category: 'WELCOME',
    label: 'VIP Welcome & Onboarding',
    body: 'Hello {{name}}! Welcome to {{business}}. Your priority account is active. Reply YES to get your member starter guide right away!',
  },
  {
    id: 'tpl_abandoned_cart',
    name: 'cart_recovery_offer',
    category: 'MARKETING',
    label: 'Cart Recovery & Instant Discount',
    body: 'Hi {{name}}, we noticed you left some items in your cart at {{business}}. Use promo code FLASH10 in the next 2 hours for 10% off: {{link}}',
  },
  {
    id: 'tpl_order_confirmed',
    name: 'order_status_update',
    category: 'UTILITY',
    label: 'Order Confirmation & Receipt',
    body: 'Hi {{name}}, your order #{{order_id}} has been received and is being prepared! Track progress here: {{link}}',
  },
  {
    id: 'tpl_appointment_reminder',
    name: 'appointment_scheduled',
    category: 'UTILITY',
    label: 'Appointment & Consultation Reminder',
    body: 'Hi {{name}}, confirming your scheduled session with {{business}} tomorrow at {{time}}. Reply 1 to confirm or 2 to reschedule.',
  },
];

export interface WhatsAppMessageItem {
  id: string;
  wamid?: string;
  sender: 'user' | 'contact' | 'customer' | 'bot' | 'agent' | 'human_operator' | 'ai_assistant' | 'system' | 'system_workflow';
  senderLabel?: string;
  text: string;
  timestamp: string;
  status?: WhatsAppMessageStatus;
  templateName?: string;
  isTemplate?: boolean;
  isInternalNote?: boolean;
  intentDetected?: string;
  quickReplyOptions?: any[];
}

export interface WhatsAppConversationThread {
  id: string;
  contactId?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  assignedOperator?: string;
  routingMode?: string;
  windowOpen?: boolean;
  windowRemainingLabel?: string;
  lastIntent?: string;
  aiAssistantEnabled?: boolean;
  lastMessageTime: string;
  unreadCount?: number;
  status: 'active' | 'archived' | 'human_handoff' | 'ai_active' | 'window_expired';
  messages: WhatsAppMessageItem[];
  windowExpiresAt?: string;
}

export interface WhatsAppBusinessHoursConfig {
  enabled: boolean;
  timezone: string;
  scheduleDays: string;
  startTime: string;
  endTime: string;
  afterHoursBehavior: string;
  awayMessageText: string;
}

export interface WhatsAppRateControlQueueItem {
  id: string;
  recipientName: string;
  recipientPhone: string;
  messageType: string;
  templateOrTriggerName: string;
  consentVerified: boolean;
  windowOrTemplateValid: boolean;
  status: string;
  metaErrorCode?: string;
  timestamp: string;
}

export const META_GRAPH_API_ERRORS = [
  {
    code: '#131030',
    title: 'Customer Care 24-Hour Window Expired',
    httpStatus: 400,
    description: 'Free-form session text cannot be dispatched more than 24 hours after customer inbound message.',
    compliantResolution: 'Pre-approved Utility or Marketing template must be selected.',
  },
  {
    code: '#131026',
    title: 'Explicit CRM Opt-In Missing',
    httpStatus: 403,
    description: 'Recipient has not provided verified verifiable opt-in consent.',
    compliantResolution: 'Lead quarantined into Pending Consent list before queue release.',
  },
  {
    code: '#130429',
    title: 'Throughput Rate Limit Exceeded',
    httpStatus: 429,
    description: 'Outbound dispatch exceeded current MPS (Messages Per Second) tier allowance.',
    compliantResolution: 'Enqueued into FIFO token bucket with exponential jitter backoff.',
  },
];

export function buildInitialWhatsAppThreads(
  contacts: Contact[] = [],
  workspaceName = 'FlowPilot'
): WhatsAppConversationThread[] {
  const contact1 = contacts[0] || { id: 'c1', fullName: 'Elena Rostova', phone: '+1 (415) 890-4321', email: 'elena@example.com' };
  const contact2 = contacts[1] || { id: 'c2', fullName: 'Marcus Vance', phone: '+1 (312) 604-8819', email: 'marcus@example.com' };
  return [
    {
      id: 'wa_thread_1',
      contactId: contact1.id,
      contactName: contact1.fullName,
      contactPhone: contact1.phone || '+1 (415) 890-4321',
      contactEmail: (contact1 as any).email || 'elena@example.com',
      lastMessageTime: '12 mins ago',
      unreadCount: 1,
      status: 'active',
      windowOpen: true,
      windowRemainingLabel: '22h remaining',
      routingMode: 'ai_assistant',
      aiAssistantEnabled: true,
      windowExpiresAt: new Date(Date.now() + 22 * 3600 * 1000).toISOString(),
      messages: [
        {
          id: 'm1',
          sender: 'contact',
          senderLabel: contact1.fullName,
          text: 'Hi, I saw your masterclass update. Does it include the private community access?',
          timestamp: '12 mins ago',
          status: 'read',
        },
        {
          id: 'm2',
          sender: 'user',
          senderLabel: `${workspaceName} Team`,
          text: `Hello Elena! Yes, all VIP enrollments at ${workspaceName} include full private community access.`,
          timestamp: '10 mins ago',
          status: 'read',
        },
      ],
    },
    {
      id: 'wa_thread_2',
      contactId: contact2.id,
      contactName: contact2.fullName,
      contactPhone: contact2.phone || '+1 (312) 604-8819',
      contactEmail: (contact2 as any).email || 'marcus@example.com',
      lastMessageTime: '45 mins ago',
      unreadCount: 0,
      status: 'human_handoff',
      windowOpen: true,
      windowRemainingLabel: '18h remaining',
      routingMode: 'human_agent',
      assignedOperator: 'Human Specialist Queue',
      windowExpiresAt: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
      messages: [
        {
          id: 'm3',
          sender: 'contact',
          senderLabel: contact2.fullName,
          text: 'HUMAN. I need to talk to someone regarding custom enterprise billing.',
          timestamp: '45 mins ago',
          status: 'delivered',
        },
      ],
    },
  ];
}

export function renderWhatsAppTemplateBody(
  templateOrBody: WhatsAppTemplate | string,
  contact?: any,
  workspaceName?: string,
  param3?: string
): string {
  const body = typeof templateOrBody === 'string' ? templateOrBody : templateOrBody.bodyText || '';
  const contactName = typeof contact === 'object' ? contact?.fullName || 'there' : contact || 'there';
  const bizName = workspaceName || 'FlowPilot';
  const p3 = param3 || 'https://flowpilot.app';

  return body
    .replace(/\{\{1\}\}/g, contactName)
    .replace(/\{\{2\}\}/g, bizName)
    .replace(/\{\{3\}\}/g, p3)
    .replace(/\{\{\s*name\s*\}\}/gi, contactName)
    .replace(/\{\{\s*business\s*\}\}/gi, bizName);
}

export function classifyInboundWhatsAppIntent(
  text: string
): { intent: string; label: string; confidence: number } {
  const clean = (text || '').trim().toUpperCase();
  if (clean === 'STOP' || clean === 'CANCEL' || clean === 'UNSUBSCRIBE') {
    return { intent: 'opt_out_stop', label: 'Opt-Out (STOP)', confidence: 0.99 };
  }
  if (clean === 'START' || clean === 'UNSTOP' || clean === 'SUBSCRIBE') {
    return { intent: 'opt_in_start', label: 'Opt-In (START)', confidence: 0.99 };
  }
  if (clean === 'HUMAN' || clean === 'AGENT' || clean === 'OPERATOR' || clean === 'HELP') {
    return { intent: 'human_handoff', label: 'Human Handoff Request', confidence: 0.95 };
  }
  if (clean === 'YES' || clean === '1' || clean === 'CONFIRM') {
    return { intent: 'CONFIRM', label: 'Confirmation', confidence: 0.9 };
  }
  return { intent: 'INQUIRY', label: 'General Inquiry', confidence: 0.8 };
}

export async function generateWhatsAppAiAssistantReply(options: {
  customerMessage?: string;
  text?: string;
  contact?: any;
  contactName?: string;
  workspace?: any;
  businessName?: string;
  businessHours?: any;
  aiSystemPrompt?: string;
  systemPrompt?: string;
}): Promise<{
  reply: string;
  replyText: string;
  reasoning: string;
  shouldHandoffToHuman: boolean;
  actionTaken?: string;
}> {
  const text = options.customerMessage || options.text || '';
  const contactName = options.contact?.fullName || options.contactName || 'Customer';
  const businessName = options.workspace?.name || options.businessName || 'FlowPilot';
  const intent = classifyInboundWhatsAppIntent(text);

  if (intent.intent === 'human_handoff') {
    const replyText = `Understood! Connecting you directly with a member of the ${businessName} live team. We will be right with you.`;
    return {
      reply: replyText,
      replyText,
      reasoning: 'Customer requested human agent',
      shouldHandoffToHuman: true,
      actionTaken: 'human_handoff',
    };
  }

  if (intent.intent === 'opt_out_stop') {
    const replyText = `You have been opted out of automated WhatsApp messages from ${businessName}. Reply START anytime to re-subscribe.`;
    return {
      reply: replyText,
      replyText,
      reasoning: 'Customer requested unsubscribe',
      shouldHandoffToHuman: false,
      actionTaken: 'opt_out',
    };
  }

  const replyText = `Hi ${contactName}! Thanks for reaching out to ${businessName}. How can our team assist you today?`;
  return {
    reply: replyText,
    replyText,
    reasoning: 'General customer assistance concierge',
    shouldHandoffToHuman: false,
    actionTaken: 'ai_reply',
  };
}

export function replaceTemplatePlaceholders(
  templateBody: string,
  contact?: Partial<Contact>,
  workspace?: Partial<Workspace>,
  extraVariables?: Record<string, string>
): string {
  let result = templateBody;
  const firstName = contact?.fullName ? contact.fullName.split(' ')[0] : 'there';
  const fullName = contact?.fullName || 'Valued Customer';
  const business = workspace?.name || 'Our Team';

  result = result.replace(/\{\{\s*name\s*\}\}/gi, firstName);
  result = result.replace(/\{\{\s*full_name\s*\}\}/gi, fullName);
  result = result.replace(/\{\{\s*business\s*\}\}/gi, business);
  result = result.replace(/\{\{\s*company\s*\}\}/gi, business);

  if (extraVariables) {
    Object.entries(extraVariables).forEach(([k, v]) => {
      const reg = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'gi');
      result = result.replace(reg, v);
    });
  }

  return result;
}

export async function generateAiWhatsAppTemplateWithGemini(prompt: {
  topic: string;
  category: string;
  businessName?: string;
  tone?: string;
}): Promise<{ name: string; body: string }> {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  if (!geminiApiKey) {
    return {
      name: `${prompt.category.toLowerCase()}_message_${Date.now().toString().slice(-4)}`,
      body: `Hi {{name}}, thank you for connecting with ${prompt.businessName || 'us'}. Let us know if you need assistance with ${prompt.topic}!`,
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert WhatsApp marketing copywriter. Create a concise, high-converting WhatsApp message for:
Topic: ${prompt.topic}
Category: ${prompt.category}
Tone: ${prompt.tone || 'Professional & Friendly'}
Business: ${prompt.businessName || 'Our Business'}

Rules:
1. Keep under 160 words.
2. Use variables like {{name}} and {{business}}.
3. Provide a clear call to action.
4. Output valid JSON: {"name": "slug_name", "body": "message text"}`,
    });

    const text = response.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        name: parsed.name?.toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'custom_template',
        body: parsed.body || text,
      };
    }
  } catch (err) {
    console.warn('Gemini template generation fallback:', err);
  }

  return {
    name: `${prompt.category.toLowerCase()}_${Date.now().toString().slice(-4)}`,
    body: `Hello {{name}}! Message regarding ${prompt.topic} from ${prompt.businessName || 'FlowPilot'}.`,
  };
}
