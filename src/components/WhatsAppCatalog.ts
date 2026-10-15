import { GoogleGenAI } from '@google/genai';
import { Contact, Workspace } from '../types';

export type OfficialWhatsAppProviderId =
  | 'meta_cloud_api'
  | 'twilio_whatsapp'
  | 'dialog360_bsp'
  | 'vonage_whatsapp';

export type MetaMessagingTier = 'tier_1k' | 'tier_10k' | 'tier_100k' | 'tier_unlimited';
export type MetaQualityRating = 'GREEN' | 'YELLOW' | 'RED';

export interface OfficialWhatsAppProviderSpec {
  id: OfficialWhatsAppProviderId;
  name: string;
  badge: string;
  apiEndpoint: string;
  webhookVersion: string;
  maxThroughputMps: number;
  supportsReadReceipts: boolean;
  supportsTemplateSync: boolean;
  supportsInteractiveButtons: boolean;
  pricingModelNote: string;
}

export const OFFICIAL_WHATSAPP_PROVIDERS: OfficialWhatsAppProviderSpec[] = [
  {
    id: 'meta_cloud_api',
    name: 'Meta WhatsApp Cloud API (Direct Graph API v21.0)',
    badge: 'Official Meta Hosted',
    apiEndpoint: 'https://graph.facebook.com/v21.0/{phone_number_id}/messages',
    webhookVersion: 'Graph API Webhooks v21.0 (X-Hub-Signature-256)',
    maxThroughputMps: 80,
    supportsReadReceipts: true,
    supportsTemplateSync: true,
    supportsInteractiveButtons: true,
    pricingModelNote:
      'Direct Meta conversation-based pricing (Marketing, Utility, Authentication, Service). Zero BSP markup; $0.00 FlowPilot software fee.',
  },
  {
    id: 'twilio_whatsapp',
    name: 'Twilio Official WhatsApp Business API',
    badge: 'Official Meta BSP',
    apiEndpoint: 'https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json',
    webhookVersion: 'Twilio StatusCallback X-Twilio-Signature',
    maxThroughputMps: 80,
    supportsReadReceipts: true,
    supportsTemplateSync: true,
    supportsInteractiveButtons: true,
    pricingModelNote:
      'Meta conversation rate + Twilio per-message pass-through fee billed by Twilio. $0.00 FlowPilot software fee.',
  },
  {
    id: 'dialog360_bsp',
    name: '360dialog Official WhatsApp Business Solution Provider',
    badge: 'Official Meta BSP',
    apiEndpoint: 'https://waba-v2.360dialog.io/messages',
    webhookVersion: '360dialog Cloud Webhook v2 (HMAC-SHA256)',
    maxThroughputMps: 80,
    supportsReadReceipts: true,
    supportsTemplateSync: true,
    supportsInteractiveButtons: true,
    pricingModelNote:
      'Flat BSP license + direct Meta conversation rates billed by 360dialog. $0.00 FlowPilot software fee.',
  },
  {
    id: 'vonage_whatsapp',
    name: 'Vonage Messages API for WhatsApp Business',
    badge: 'Official Meta Partner',
    apiEndpoint: 'https://api.nexmo.com/v1/messages',
    webhookVersion: 'Vonage Signed JWT Webhook',
    maxThroughputMps: 80,
    supportsReadReceipts: true,
    supportsTemplateSync: true,
    supportsInteractiveButtons: true,
    pricingModelNote:
      'Meta conversation fees + Vonage gateway pass-through billed by Vonage. $0.00 FlowPilot software fee.',
  },
];

export type WhatsAppTemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
export type WhatsAppTemplateStatus =
  | 'APPROVED'
  | 'PENDING_META_REVIEW'
  | 'PAUSED_LOW_QUALITY'
  | 'REJECTED';

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  status: WhatsAppTemplateStatus;
  qualityRating: MetaQualityRating;
  headerText?: string;
  bodyText: string;
  footerText: string;
  buttons: {
    type: 'QUICK_REPLY' | 'URL';
    text: string;
    url?: string;
  }[];
  sampleParams: string[];
  lastSyncedAt: string;
  rejectionReason?: string;
}

export const INITIAL_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'wtpl_welcome_optin',
    name: 'welcome_lead_magnet_delivery_v1',
    language: 'en_US',
    category: 'UTILITY',
    status: 'APPROVED',
    qualityRating: 'GREEN',
    headerText: 'Your Requested Resource is Ready',
    bodyText:
      'Hi {{1}}, thank you for opting in to {{2}} updates on WhatsApp! Here is direct access to your resource: {{3}}. Reply with any questions or type HUMAN to speak with an advisor.',
    footerText: 'Reply STOP at any time to opt out of WhatsApp messages.',
    buttons: [
      { type: 'QUICK_REPLY', text: '1. Book Strategy Call' },
      { type: 'QUICK_REPLY', text: '2. Ask a Question' },
      { type: 'QUICK_REPLY', text: 'STOP' },
    ],
    sampleParams: ['Elena', 'FlowPilot Studio', 'https://flowpilot.app/guide'],
    lastSyncedAt: 'Synced via Meta Graph API · 4 mins ago',
  },
  {
    id: 'wtpl_appointment_reminder',
    name: 'consultation_booking_reminder_24h',
    language: 'en_US',
    category: 'UTILITY',
    status: 'APPROVED',
    qualityRating: 'GREEN',
    headerText: 'Upcoming Session Reminder',
    bodyText:
      'Hello {{1}}, this is a confirmation from {{2}} for your scheduled consultation on {{3}}. Please confirm if this time still works for you.',
    footerText: 'Official WhatsApp Business Notification · Reply STOP to opt out',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confirm Attendance' },
      { type: 'QUICK_REPLY', text: 'Reschedule' },
    ],
    sampleParams: ['Marcus', 'FlowPilot Advisory', 'Tomorrow at 2:00 PM EST'],
    lastSyncedAt: 'Synced via Meta Graph API · 12 mins ago',
  },
  {
    id: 'wtpl_vip_launch_offer',
    name: 'vip_cohort_enrollment_open_v2',
    language: 'en_US',
    category: 'MARKETING',
    status: 'APPROVED',
    qualityRating: 'GREEN',
    headerText: 'VIP Enrollment Window Now Open',
    bodyText:
      'Hi {{1}}, because you joined our VIP waitlist at {{2}}, you have early access to the new cohort before public registration opens. View curriculum details: {{3}}.',
    footerText: 'Sent to opted-in VIP subscribers · Reply STOP to unsubscribe',
    buttons: [
      { type: 'QUICK_REPLY', text: 'View Curriculum' },
      { type: 'QUICK_REPLY', text: 'Talk to Admissions' },
      { type: 'QUICK_REPLY', text: 'STOP' },
    ],
    sampleParams: ['Amara', 'FlowPilot Academy', 'https://flowpilot.app/cohort'],
    lastSyncedAt: 'Synced via Meta Graph API · 1 hour ago',
  },
  {
    id: 'wtpl_after_hours_away',
    name: 'business_hours_away_concierge_v1',
    language: 'en_US',
    category: 'UTILITY',
    status: 'APPROVED',
    qualityRating: 'GREEN',
    headerText: 'Outside Standard Operating Hours',
    bodyText:
      'Hi {{1}}, thanks for messaging {{2}}. Our live team is currently offline (Business Hours: {{3}}). Your message is queued for priority review, or you can use our automated menu below.',
    footerText: 'Official WhatsApp Cloud API · Reply STOP to opt out',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Leave Urgent Note' },
      { type: 'QUICK_REPLY', text: 'Get Self-Serve FAQ' },
    ],
    sampleParams: ['Devon', 'FlowPilot Support', 'Mon-Fri 09:00-18:00 EST'],
    lastSyncedAt: 'Synced via Meta Graph API · 2 hours ago',
  },
  {
    id: 'wtpl_order_invoice_receipt',
    name: 'payment_invoice_confirmation_v1',
    language: 'en_US',
    category: 'UTILITY',
    status: 'PENDING_META_REVIEW',
    qualityRating: 'GREEN',
    headerText: 'Payment & Invoice Confirmation',
    bodyText:
      'Hi {{1}}, we have received your payment for {{2}}. Your receipt and onboarding portal link are available at {{3}}.',
    footerText: 'Transactional Receipt · Reply STOP to opt out',
    buttons: [{ type: 'QUICK_REPLY', text: 'Access Onboarding Portal' }],
    sampleParams: ['Chloe', 'Annual Growth Retainer', 'https://flowpilot.app/invoice'],
    lastSyncedAt: 'Submitted to Meta Graph API · Pending Review',
  },
];

export type WhatsAppMessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
export type WhatsAppSenderType = 'customer' | 'bot' | 'ai_assistant' | 'human_operator' | 'system_workflow';

export interface WhatsAppMessageItem {
  id: string;
  wamid: string;
  sender: WhatsAppSenderType;
  senderLabel: string;
  text: string;
  timestamp: string;
  status: WhatsAppMessageStatus;
  isTemplate?: boolean;
  templateName?: string;
  intentDetected?: string;
  quickReplyOptions?: string[];
  errorCode?: string;
  errorDetail?: string;
  isInternalNote?: boolean;
}

export type ConversationRoutingMode =
  | 'bot_automation'
  | 'ai_assistant'
  | 'human_handoff_requested'
  | 'assigned_to_human'
  | 'resolved';

export interface WhatsAppConversationThread {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  unreadCount: number;
  lastCustomerMessageAt: string; // ISO string to compute 24-hour customer care window
  windowOpen: boolean; // Whether within 24h of last customer message
  windowRemainingLabel: string;
  routingMode: ConversationRoutingMode;
  assignedOperator: string;
  aiAssistantEnabled: boolean;
  lastIntent: string;
  messages: WhatsAppMessageItem[];
}

export interface WhatsAppBusinessHoursConfig {
  enabled: boolean;
  timezone: string;
  scheduleDays: 'mon_fri' | 'mon_sat' | 'every_day';
  startTime: string; // e.g. "09:00"
  endTime: string; // e.g. "18:00"
  afterHoursBehavior: 'send_away_template' | 'ai_assistant_concierge' | 'queue_until_open';
  awayMessageText: string;
}

export interface WhatsAppRateControlQueueItem {
  id: string;
  recipientName: string;
  recipientPhone: string;
  messageType: 'template' | 'session_reply' | 'workflow_trigger';
  templateOrTriggerName: string;
  consentVerified: boolean;
  windowOrTemplateValid: boolean;
  status: 'queued_token_bucket' | 'dispatched' | 'blocked_consent' | 'blocked_24h_window' | 'rate_limited_retry';
  metaErrorCode?: string;
  timestamp: string;
}

export interface MetaGraphErrorSpec {
  code: string;
  title: string;
  httpStatus: number;
  category: 'Rate Limit' | '24h Policy Window' | 'Consent / Undeliverable' | 'Template Validation';
  description: string;
  compliantResolution: string;
}

export const META_GRAPH_API_ERRORS: MetaGraphErrorSpec[] = [
  {
    code: '#131047',
    title: 'Re-engagement Message Outside 24h Customer Service Window',
    httpStatus: 400,
    category: '24h Policy Window',
    description:
      'More than 24 hours have elapsed since the recipient last replied. Free-form text messages are rejected by Meta.',
    compliantResolution:
      'Switch to an APPROVED WhatsApp Template Message (Utility or Marketing) to re-open a conversation compliantly.',
  },
  {
    code: '#130429',
    title: 'Cloud API Throughput Rate Limit Reached (80 MPS)',
    httpStatus: 429,
    category: 'Rate Limit',
    description:
      'Outbound dispatch rate exceeded the official Phone Number ID throughput limit (80 messages/second).',
    compliantResolution:
      'Hold messages in the FIFO token-bucket queue and respect Retry-After headers. Never rotate numbers to evade limits.',
  },
  {
    code: '#131056',
    title: 'Pair Rate Limit Hit (Same Recipient Frequency Cap)',
    httpStatus: 429,
    category: 'Rate Limit',
    description:
      'Too many messages sent to the same WhatsApp user phone number within a short interval.',
    compliantResolution:
      'Enforce per-contact cooldown window and consolidate updates into a single structured message.',
  },
  {
    code: '#131026',
    title: 'Message Undeliverable or Recipient Blocked / Opted Out',
    httpStatus: 400,
    category: 'Consent / Undeliverable',
    description:
      'Recipient is not on WhatsApp, has blocked the business number, or has not accepted latest WhatsApp terms.',
    compliantResolution:
      'Automatically mark contact WhatsApp status as suppressed/unsubscribed and halt further outbound retries.',
  },
  {
    code: '#132000',
    title: 'Template Parameter Count Mismatch',
    httpStatus: 400,
    category: 'Template Validation',
    description:
      'Number of variable parameters supplied in payload does not match the approved Meta template definition.',
    compliantResolution:
      'Validate {{1}}, {{2}}, {{3}} fallback variables against contact CRM fields prior to API dispatch.',
  },
];

export function renderWhatsAppTemplateBody(
  template: WhatsAppTemplate,
  contact: Contact | null,
  workspaceName: string,
  customParam3?: string
): string {
  const firstName = contact?.fullName?.split(' ')[0] || template.sampleParams[0] || 'there';
  const param2 = contact?.company || workspaceName || template.sampleParams[1] || 'FlowPilot';
  const param3 = customParam3 || template.sampleParams[2] || 'https://flowpilot.app';

  return template.bodyText
    .replace(/\{\{1\}\}/g, firstName)
    .replace(/\{\{2\}\}/g, param2)
    .replace(/\{\{3\}\}/g, param3);
}

export function classifyInboundWhatsAppIntent(text: string): {
  intent:
    | 'opt_out_stop'
    | 'opt_in_start'
    | 'human_handoff'
    | 'pricing_inquiry'
    | 'booking_request'
    | 'support_help'
    | 'menu_selection'
    | 'general_inquiry';
  label: string;
  confidence: number;
} {
  const clean = text.trim().toLowerCase();

  if (
    clean === 'stop' ||
    clean === 'unsubscribe' ||
    clean === 'opt out' ||
    clean === 'optout' ||
    clean === 'cancel'
  ) {
    return { intent: 'opt_out_stop', label: 'Compliance Opt-Out (STOP)', confidence: 0.99 };
  }
  if (clean === 'start' || clean === 'subscribe' || clean === 'unstop' || clean === 'opt in') {
    return { intent: 'opt_in_start', label: 'Compliance Opt-In (START)', confidence: 0.99 };
  }
  if (
    clean.includes('human') ||
    clean.includes('agent') ||
    clean.includes('operator') ||
    clean.includes('person') ||
    clean.includes('representative') ||
    clean.includes('talk to team')
  ) {
    return { intent: 'human_handoff', label: 'Human Handoff Escalation', confidence: 0.96 };
  }
  if (/^[1-5](\.|\s|$)/.test(clean)) {
    return { intent: 'menu_selection', label: 'Interactive Menu Option', confidence: 0.95 };
  }
  if (
    clean.includes('price') ||
    clean.includes('pricing') ||
    clean.includes('cost') ||
    clean.includes('plan') ||
    clean.includes('quote') ||
    clean.includes('invoice')
  ) {
    return { intent: 'pricing_inquiry', label: 'Pricing & Plan Inquiry', confidence: 0.91 };
  }
  if (
    clean.includes('book') ||
    clean.includes('call') ||
    clean.includes('schedule') ||
    clean.includes('demo') ||
    clean.includes('meeting') ||
    clean.includes('calendar') ||
    clean.includes('audit')
  ) {
    return { intent: 'booking_request', label: 'Discovery Call / Booking Intent', confidence: 0.92 };
  }
  if (
    clean.includes('help') ||
    clean.includes('support') ||
    clean.includes('issue') ||
    clean.includes('broken') ||
    clean.includes('error')
  ) {
    return { intent: 'support_help', label: 'Customer Support Request', confidence: 0.89 };
  }

  return { intent: 'general_inquiry', label: 'General Customer Question', confidence: 0.82 };
}

export async function generateWhatsAppAiAssistantReply(params: {
  customerMessage: string;
  contact: Contact | null;
  workspace: Workspace;
  businessHours: WhatsAppBusinessHoursConfig;
  aiSystemPrompt: string;
}): Promise<{ replyText: string; shouldHandoffToHuman: boolean; reasoning: string }> {
  const { customerMessage, contact, workspace, businessHours, aiSystemPrompt } = params;
  const intentInfo = classifyInboundWhatsAppIntent(customerMessage);

  // Automatic human handoff check
  if (intentInfo.intent === 'human_handoff') {
    return {
      replyText: `Hi ${contact?.fullName.split(' ')[0] || 'there'}, I've escalated your conversation directly to a human operator at ${workspace.name}. A team member has your CRM context (${contact?.stage || 'Lead'}) and will reply shortly.`,
      shouldHandoffToHuman: true,
      reasoning: 'Customer explicitly requested a human representative.',
    };
  }

  const apiKey = typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : '';
  if (apiKey && apiKey.trim().length > 5) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are the official WhatsApp Business AI Concierge for "${workspace.name}" (${workspace.category}).
Additional operator instructions: ${aiSystemPrompt}
CRM Contact Context:
- Name: ${contact?.fullName || 'Customer'}
- Stage: ${contact?.stage || 'lead'}
- Lifetime Value: $${contact?.ltv || 0}
- List: ${contact?.listName || 'General'}
- Tags: ${contact?.tags?.join(', ') || 'none'}
- Business Hours: ${businessHours.scheduleDays} ${businessHours.startTime}-${businessHours.endTime} (${businessHours.timezone})

Customer WhatsApp Message: "${customerMessage}"

Write a concise, helpful, compliant WhatsApp reply (2-3 short sentences max, suitable for mobile reading). Do not use markdown headers. Mention that they can type HUMAN anytime to speak with a team member.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      const generated = response.text?.trim();
      if (generated) {
        return {
          replyText: generated,
          shouldHandoffToHuman: false,
          reasoning: `Generated via Gemini 3.8 Flash with CRM context (${intentInfo.label})`,
        };
      }
    } catch {
      // Fall through to deterministic CRM-grounded assistant if API key/network unavailable
    }
  }

  const firstName = contact?.fullName?.split(' ')[0] || 'there';
  if (intentInfo.intent === 'pricing_inquiry') {
    return {
      replyText: `Hi ${firstName}! Thanks for asking about ${workspace.name}. Since you're in our ${contact?.listName || 'VIP'} group, we offer flexible packages tailored to your stage. Would you like me to share the pricing breakdown link or connect you with an advisor (type HUMAN)?`,
      shouldHandoffToHuman: false,
      reasoning: `CRM-Grounded AI Concierge matched "${intentInfo.label}" for ${contact?.fullName || 'Contact'}`,
    };
  }

  if (intentInfo.intent === 'booking_request') {
    return {
      replyText: `Hi ${firstName}, I'd be happy to help you schedule a strategy session with ${workspace.name}! Our operating hours are ${businessHours.startTime}–${businessHours.endTime} (${businessHours.timezone}). Reply "1" for our instant calendar link or type "HUMAN" to coordinate a custom time.`,
      shouldHandoffToHuman: false,
      reasoning: `CRM-Grounded AI Concierge matched "${intentInfo.label}"`,
    };
  }

  return {
    replyText: `Hi ${firstName}! Thanks for messaging ${workspace.name}'s official WhatsApp line. I see your profile in our ${contact?.listName || 'CRM'} list. How can I help you today—would you like resources, session scheduling, or to speak directly with a human operator (type HUMAN)?`,
    shouldHandoffToHuman: false,
    reasoning: `CRM-Grounded AI Concierge response (${intentInfo.label})`,
  };
}

export function buildInitialWhatsAppThreads(
  contacts: Contact[],
  workspaceName: string
): WhatsAppConversationThread[] {
  const c1 = contacts[0] || {
    id: 'cnt_1',
    fullName: 'Elena Rostova',
    phone: '+1 (415) 890-4321',
    email: 'elena@rostovastudio.io',
    stage: 'qualified',
    listName: 'Creator Launch Waitlist',
    tags: ['vip-waitlist', 'whatsapp-opt-in'],
  };
  const c2 = contacts[1] || {
    id: 'cnt_2',
    fullName: 'Marcus Vance',
    phone: '+1 (312) 604-8819',
    email: 'mvance@vanceadvisory.com',
    stage: 'warm_lead',
    listName: 'Discovery Call Funnel',
    tags: ['agency-lead', 'audit-requested'],
  };
  const c3 = contacts[2] || {
    id: 'cnt_3',
    fullName: 'Amara Okafor',
    phone: '+234 803 555 0192',
    email: 'amara@okaforventures.ng',
    stage: 'customer',
    listName: 'VIP Cohort Buyers',
    tags: ['customer', 'vip-buyer'],
  };

  return [
    {
      id: 'wa_thread_1',
      contactId: c1.id,
      contactName: c1.fullName,
      contactPhone: c1.phone || '+1 (415) 890-4321',
      contactEmail: c1.email,
      unreadCount: 1,
      lastCustomerMessageAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      windowOpen: true,
      windowRemainingLabel: '21h 58m left in 24h service window',
      routingMode: 'ai_assistant',
      assignedOperator: 'Unassigned (AI Concierge Active)',
      aiAssistantEnabled: true,
      lastIntent: 'Discovery Call / Booking Intent',
      messages: [
        {
          id: 'wmsg_101',
          wamid: 'wamid.HBgLMTQxNTg5MDQzMjEVAgARGBI5QTND',
          sender: 'system_workflow',
          senderLabel: 'Workflow Trigger (welcome_lead_magnet_delivery_v1)',
          text: `Hi ${c1.fullName.split(' ')[0]}, thank you for opting in to ${workspaceName} updates on WhatsApp! Here is direct access to your resource: https://flowpilot.app/guide. Reply with any questions or type HUMAN to speak with an advisor.`,
          timestamp: '2 hours ago',
          status: 'read',
          isTemplate: true,
          templateName: 'welcome_lead_magnet_delivery_v1',
          quickReplyOptions: ['1. Book Strategy Call', '2. Ask a Question', 'STOP'],
        },
        {
          id: 'wmsg_102',
          wamid: 'wamid.HBgLMTQxNTg5MDQzMjEVAgASGBI4RkE1',
          sender: 'customer',
          senderLabel: c1.fullName,
          text: 'AUDIT — Hi! I downloaded the guide and would love to book a strategy call for my Q4 launch.',
          timestamp: '1 hour ago',
          status: 'read',
          intentDetected: 'Discovery Call / Booking Intent',
        },
        {
          id: 'wmsg_103',
          wamid: 'wamid.HBgLMTQxNTg5MDQzMjEVAgARGBI3Qzky',
          sender: 'bot',
          senderLabel: 'Keyword Bot ("AUDIT")',
          text: 'Welcome! Choose an option below to book your Q4 launch audit or connect with our team:',
          timestamp: '1 hour ago',
          status: 'read',
          quickReplyOptions: ['1. Book 15-Min Audit Call', '2. Share Funnel Metrics', '3. Talk to Human Advisor'],
        },
      ],
    },
    {
      id: 'wa_thread_2',
      contactId: c2.id,
      contactName: c2.fullName,
      contactPhone: c2.phone || '+1 (312) 604-8819',
      contactEmail: c2.email,
      unreadCount: 2,
      lastCustomerMessageAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      windowOpen: true,
      windowRemainingLabel: '23h 25m left in 24h service window',
      routingMode: 'human_handoff_requested',
      assignedOperator: 'Awaiting Operator Takeover',
      aiAssistantEnabled: false,
      lastIntent: 'Human Handoff Escalation',
      messages: [
        {
          id: 'wmsg_201',
          wamid: 'wamid.HBgLMTMxMjYwNDg4MTkVAgASGBI1RTEw',
          sender: 'customer',
          senderLabel: c2.fullName,
          text: 'Hi team, we have 4 agency seats we want to migrate. Can I speak with a human specialist about custom onboarding?',
          timestamp: '35 mins ago',
          status: 'read',
          intentDetected: 'Human Handoff Escalation',
        },
        {
          id: 'wmsg_202',
          wamid: 'wamid.HBgLMTMxMjYwNDg4MTkVAgARGBI2QjAx',
          sender: 'bot',
          senderLabel: 'Compliance & Handoff Router',
          text: `Hi ${c2.fullName.split(' ')[0]}, I have paused automated replies and flagged your conversation for immediate Human Handoff. An operator with your CRM profile is joining shortly.`,
          timestamp: '35 mins ago',
          status: 'delivered',
        },
      ],
    },
    {
      id: 'wa_thread_3',
      contactId: c3.id,
      contactName: c3.fullName,
      contactPhone: c3.phone || '+234 803 555 0192',
      contactEmail: c3.email,
      unreadCount: 0,
      lastCustomerMessageAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      windowOpen: false,
      windowRemainingLabel: '24h Customer Care Window Expired (36h ago) — Approved Template Required',
      routingMode: 'bot_automation',
      assignedOperator: 'Automated Flow',
      aiAssistantEnabled: true,
      lastIntent: 'VIP Cohort Onboarding',
      messages: [
        {
          id: 'wmsg_301',
          wamid: 'wamid.HBgNMjM0ODAzNTU1MDE5MgUCABEYEjhD',
          sender: 'customer',
          senderLabel: c3.fullName,
          text: 'Thank you! I completed the VIP cohort registration yesterday.',
          timestamp: '36 hours ago',
          status: 'read',
          intentDetected: 'General Customer Question',
        },
        {
          id: 'wmsg_302',
          wamid: 'wamid.HBgNMjM0ODAzNTU1MDE5MgUCABEYEjk5',
          sender: 'human_operator',
          senderLabel: 'Operator (CRM Inbox)',
          text: 'Awesome to have you onboard Amara! Let us know anytime you need help.',
          timestamp: '35 hours ago',
          status: 'read',
        },
      ],
    },
  ];
}
