import { Contact, Workspace, UserPrivateProfile, WorkflowNode } from '../types';

export type EmailBlockType =
  | 'header'
  | 'text'
  | 'callout'
  | 'button'
  | 'divider'
  | 'footer';

export interface EmailBlock {
  id: string;
  type: EmailBlockType;
  heading?: string;
  content: string;
  buttonLabel?: string;
  buttonUrl?: string;
  accentColor?: 'emerald' | 'slate';
}

export interface ReusableEmailTemplate {
  id: string;
  name: string;
  category: 'newsletter' | 'welcome' | 'promotion' | 'webinar' | 're_engagement' | 'custom';
  subject: string;
  preheader: string;
  description: string;
  blocks: EmailBlock[];
}

export interface EmailSequenceBlueprint {
  id: string;
  name: string;
  category: string;
  description: string;
  stepsCount: number;
  cadenceSummary: string;
  buildNodes: (targetListName: string) => WorkflowNode[];
}

export interface ComplianceScanResult {
  passed: boolean;
  score: number; // 0 to 100
  blockingIssues: string[];
  warnings: string[];
  verifiedChecks: string[];
}

export const PERSONALIZATION_VARIABLES: {
  token: string;
  label: string;
  example: string;
}[] = [
  { token: '{{first_name}}', label: 'First Name', example: 'Amara' },
  { token: '{{full_name}}', label: 'Full Name', example: 'Amara Nwosu' },
  { token: '{{email}}', label: 'Email Address', example: 'amara@example.com' },
  { token: '{{company}}', label: 'Company', example: 'Kinetic Studio' },
  { token: '{{list_name}}', label: 'Contact List', example: 'VIP Newsletter' },
  { token: '{{sender_name}}', label: 'Sender Name', example: 'FlowPilot Operator' },
  { token: '{{unsubscribe_url}}', label: 'Unsubscribe Link', example: 'https://flowpilot.app/unsubscribe' },
];

export const DEFAULT_REUSABLE_EMAIL_TEMPLATES: ReusableEmailTemplate[] = [
  {
    id: 'tpl_weekly_dispatch',
    name: 'Weekly Creator Systems Dispatch',
    category: 'newsletter',
    subject: '{{first_name}}, 3 systems to streamline your client pipeline this week',
    preheader: 'Practical workflow notes, zero fluff — read in 3 minutes.',
    description: 'Clean editorial newsletter layout with greeting, key insight callout, and resource CTA.',
    blocks: [
      {
        id: 'blk_1',
        type: 'header',
        heading: 'WEEKLY SYSTEMS DISPATCH',
        content: 'Curated operational playbooks for {{list_name}} members',
        accentColor: 'emerald',
      },
      {
        id: 'blk_2',
        type: 'text',
        content:
          'Hi {{first_name}},\n\nThank you for being part of {{list_name}}. This week we are breaking down how to connect lead capture forms directly to segmented contact lists and automated follow-up sequences.',
      },
      {
        id: 'blk_3',
        type: 'callout',
        heading: 'Key Takeaway for {{company}}',
        content:
          'Routing every form submission into a dedicated Contact List before triggering a sequence increases 48-hour reply rates while keeping your CRM cleanly segmented.',
        accentColor: 'emerald',
      },
      {
        id: 'blk_4',
        type: 'button',
        content: 'Explore the full step-by-step guide in your member workspace:',
        buttonLabel: 'Read the Full Playbook →',
        buttonUrl: 'https://flowpilot.app/playbooks/list-automation',
        accentColor: 'emerald',
      },
      {
        id: 'blk_5',
        type: 'divider',
        content: '',
      },
      {
        id: 'blk_6',
        type: 'footer',
        content:
          'Sent by {{sender_name}} to opted-in members of {{list_name}}. Manage preferences or opt out anytime via {{unsubscribe_url}}.',
      },
    ],
  },
  {
    id: 'tpl_welcome_magnet',
    name: 'Lead Magnet Delivery & Welcome',
    category: 'welcome',
    subject: 'Welcome {{first_name}} — here is your requested resource',
    preheader: 'Instant access link inside + what to expect next.',
    description: 'High-trust welcome email for new subscribers who opted in via a landing page or form.',
    blocks: [
      {
        id: 'blk_w1',
        type: 'header',
        heading: 'WELCOME TO THE INNER CIRCLE',
        content: 'Resource Delivery & Onboarding',
        accentColor: 'emerald',
      },
      {
        id: 'blk_w2',
        type: 'text',
        content:
          'Hi {{first_name}},\n\nWelcome! As promised when you joined {{list_name}}, your resource is ready for immediate access below.',
      },
      {
        id: 'blk_w3',
        type: 'button',
        content: 'Click below to access your requested toolkit:',
        buttonLabel: 'Download Your Resource Now',
        buttonUrl: 'https://flowpilot.app/resources/welcome-kit',
        accentColor: 'emerald',
      },
      {
        id: 'blk_w4',
        type: 'callout',
        heading: 'What happens next?',
        content:
          'We only send high-signal updates relevant to your work at {{company}}. You can reply directly to this email with any questions.',
        accentColor: 'slate',
      },
      {
        id: 'blk_w5',
        type: 'footer',
        content:
          'You received this email because {{email}} opted in to {{list_name}}. Unsubscribe with one click: {{unsubscribe_url}}.',
      },
    ],
  },
  {
    id: 'tpl_workshop_invite',
    name: 'Live Workshop & Session Invitation',
    category: 'webinar',
    subject: 'Invitation for {{first_name}}: Live Architecture Walkthrough',
    preheader: 'Reserve your seat for our upcoming interactive session.',
    description: 'Structured event invitation with agenda overview and calendar reservation CTA.',
    blocks: [
      {
        id: 'blk_e1',
        type: 'header',
        heading: 'LIVE INTERACTIVE BRIEFING',
        content: 'Exclusive invitation for {{list_name}}',
        accentColor: 'slate',
      },
      {
        id: 'blk_e2',
        type: 'text',
        content:
          'Hi {{first_name}},\n\nWe are hosting a 45-minute live technical walkthrough covering compliant email deliverability, segmentation, and automated multi-step sequences.',
      },
      {
        id: 'blk_e3',
        type: 'callout',
        heading: 'Session Agenda',
        content:
          '1. Designing high-converting visual emails\n2. Segmenting Contact Lists by stage and temperature\n3. Live Q&A and workflow diagnostics',
        accentColor: 'emerald',
      },
      {
        id: 'blk_e4',
        type: 'button',
        content: 'Save your spot (recording included for registrants):',
        buttonLabel: 'Reserve My Seat →',
        buttonUrl: 'https://flowpilot.app/events/live-walkthrough',
        accentColor: 'emerald',
      },
      {
        id: 'blk_e5',
        type: 'footer',
        content:
          'Sent by {{sender_name}}. Don’t want event invites? Opt out anytime: {{unsubscribe_url}}.',
      },
    ],
  },
  {
    id: 'tpl_reengagement',
    name: 'Permission-First Preferences Check-In',
    category: 're_engagement',
    subject: 'Quick check-in, {{first_name}} — still want updates from {{sender_name}}?',
    preheader: 'Keep your inbox clean: confirm your preferences in one click.',
    description: 'Ethical list-hygiene template that helps maintain high deliverability and low bounce rates.',
    blocks: [
      {
        id: 'blk_r1',
        type: 'header',
        heading: 'SUBSCRIBER PREFERENCES CHECK-IN',
        content: 'Keeping your inbox relevant and clutter-free',
        accentColor: 'slate',
      },
      {
        id: 'blk_r2',
        type: 'text',
        content:
          'Hi {{first_name}},\n\nWe respect your inbox and only want to send dispatches that are genuinely useful to you at {{company}}. Would you like to stay on {{list_name}}?',
      },
      {
        id: 'blk_r3',
        type: 'button',
        content: 'Click below to confirm you want to keep receiving our updates:',
        buttonLabel: 'Yes, Keep Me Subscribed',
        buttonUrl: 'https://flowpilot.app/preferences/confirm',
        accentColor: 'emerald',
      },
      {
        id: 'blk_r4',
        type: 'footer',
        content:
          'If you no longer wish to hear from {{sender_name}}, click here to unsubscribe immediately: {{unsubscribe_url}}.',
      },
    ],
  },
];

export const EMAIL_SEQUENCE_BLUEPRINTS: EmailSequenceBlueprint[] = [
  {
    id: 'seq_welcome_nurture',
    name: '3-Step Opt-In Welcome & Value Sequence',
    category: 'Onboarding & Trust',
    description:
      'Delivers immediate resource upon joining the selected Contact List, follows up 2 days later with a practical case study, and checks in on Day 5.',
    stepsCount: 3,
    cadenceSummary: 'Immediate → Wait 2 Days → Wait 3 Days (Mon–Fri 09:00–17:00)',
    buildNodes: (targetListName: string): WorkflowNode[] => [
      {
        id: 'node_trig_seq1',
        category: 'trigger',
        subType: 'list_joined',
        title: `Contact Joins "${targetListName}"`,
        subtitle: `List Enrolled: ${targetListName} (Opted-In Verification)`,
        branchPath: 'main',
        config: {
          targetList: targetListName,
        },
      },
      {
        id: 'node_act_seq1_1',
        category: 'action',
        subType: 'send_email',
        title: 'Email #1: Welcome & Resource Delivery',
        subtitle: 'Immediate Dispatch · Personalization: {{first_name}}',
        branchPath: 'main',
        config: {
          channel: 'email',
          targetList: targetListName,
          subjectOrTemplate: 'Welcome {{first_name}} — your requested resource is inside',
          messagePreview:
            'Hi {{first_name}}, thank you for joining {{list_name}}. Here is your direct access link...',
          messageScheduleMode: 'immediate',
        },
      },
      {
        id: 'node_act_seq1_2',
        category: 'action',
        subType: 'send_email',
        title: 'Email #2: Case Study & Practical Framework',
        subtitle: 'Delayed +2 Days · Window 09:00–17:00 Mon-Fri',
        branchPath: 'main',
        config: {
          channel: 'email',
          targetList: targetListName,
          subjectOrTemplate: '{{first_name}}, how operators cut manual follow-up by 60%',
          messagePreview:
            'Hi {{first_name}}, following up on the resource you downloaded—here is a real implementation breakdown...',
          messageScheduleMode: 'delay',
          delayAmount: 2,
          delayUnit: 'days',
          scheduledSendTime: '09:30',
          businessDaysOnly: true,
          businessWindowStart: '09:00',
          businessWindowEnd: '17:00',
        },
      },
      {
        id: 'node_act_seq1_3',
        category: 'action',
        subType: 'send_email',
        title: 'Email #3: Personal Check-In & Next Steps',
        subtitle: 'Delayed +3 Days · Window 09:00–17:00 Mon-Fri',
        branchPath: 'main',
        config: {
          channel: 'email',
          targetList: targetListName,
          subjectOrTemplate: 'Quick question about your workflow at {{company}}, {{first_name}}',
          messagePreview:
            'Hi {{first_name}}, have you had a chance to try the template yet? Reply and let me know...',
          messageScheduleMode: 'delay',
          delayAmount: 3,
          delayUnit: 'days',
          scheduledSendTime: '10:00',
          businessDaysOnly: true,
          businessWindowStart: '09:00',
          businessWindowEnd: '17:00',
        },
      },
    ],
  },
  {
    id: 'seq_educational_course',
    name: '4-Step Educational Email Mini-Course',
    category: 'Lead Nurture',
    description:
      'Structured 4-lesson automated email sequence with engagement check and automatic CRM qualification tagging.',
    stepsCount: 4,
    cadenceSummary: 'Immediate → +1 Day → +2 Days → +2 Days',
    buildNodes: (targetListName: string): WorkflowNode[] => [
      {
        id: 'node_trig_seq2',
        category: 'trigger',
        subType: 'list_joined',
        title: `Enrolled in "${targetListName}"`,
        subtitle: `List Enrolled: ${targetListName}`,
        branchPath: 'main',
        config: {
          targetList: targetListName,
        },
      },
      {
        id: 'node_act_seq2_1',
        category: 'action',
        subType: 'send_email',
        title: 'Lesson 1: Foundation & List Architecture',
        subtitle: 'Immediate Dispatch · {{first_name}}',
        branchPath: 'main',
        config: {
          channel: 'email',
          targetList: targetListName,
          subjectOrTemplate: '[Lesson 1/3] {{first_name}}, building a permission-first audience',
          messagePreview: 'Welcome to Lesson 1! Today we cover clean list segmentation...',
          messageScheduleMode: 'immediate',
        },
      },
      {
        id: 'node_act_seq2_2',
        category: 'action',
        subType: 'send_email',
        title: 'Lesson 2: Automated Sequences & Timing',
        subtitle: 'Delayed +1 Day at 09:00',
        branchPath: 'main',
        config: {
          channel: 'email',
          targetList: targetListName,
          subjectOrTemplate: '[Lesson 2/3] Timing your follow-ups without inbox fatigue',
          messagePreview: 'Hi {{first_name}}, in Lesson 2 we explore per-message scheduling...',
          messageScheduleMode: 'delay',
          delayAmount: 1,
          delayUnit: 'days',
          scheduledSendTime: '09:00',
          businessDaysOnly: true,
        },
      },
      {
        id: 'node_act_seq2_3',
        category: 'action',
        subType: 'send_email',
        title: 'Lesson 3: Deliverability & Domain Alignment',
        subtitle: 'Delayed +2 Days at 09:00',
        branchPath: 'main',
        config: {
          channel: 'email',
          targetList: targetListName,
          subjectOrTemplate: '[Lesson 3/3] SPF, DKIM, and keeping open rates above 45%',
          messagePreview: 'Hi {{first_name}}, our final lesson covers sender reputation...',
          messageScheduleMode: 'delay',
          delayAmount: 2,
          delayUnit: 'days',
          scheduledSendTime: '09:00',
          businessDaysOnly: true,
        },
      },
    ],
  },
];

export function serializeBlocksToMessageBody(blocks: EmailBlock[], preheader?: string): string {
  const parts: string[] = [];
  if (preheader && preheader.trim()) {
    parts.push(`[Preheader: ${preheader.trim()}]`);
  }
  blocks.forEach((b) => {
    if (b.type === 'header') {
      parts.push(`=== ${b.heading || 'HEADER'} ===\n${b.content}`);
    } else if (b.type === 'text') {
      parts.push(b.content);
    } else if (b.type === 'callout') {
      parts.push(`[${b.heading || 'Highlight'}]: ${b.content}`);
    } else if (b.type === 'button') {
      parts.push(`${b.content}\n[CTA: ${b.buttonLabel || 'Learn More'} -> ${b.buttonUrl || 'https://flowpilot.app'}]`);
    } else if (b.type === 'footer') {
      parts.push(`---\n${b.content}`);
    }
  });
  return parts.join('\n\n').slice(0, 4800);
}

export function resolvePersonalizationVariables(
  rawText: string,
  sampleContact?: Contact | null,
  workspace?: Workspace,
  privateProfile?: UserPrivateProfile,
  fallbackListName?: string,
  campaignId?: string
): string {
  if (!rawText) return '';
  const fullName = sampleContact?.fullName?.trim() || 'Amara Nwosu';
  const firstName = fullName.split(' ')[0] || 'there';
  const email = sampleContact?.email?.trim() || 'subscriber@example.com';
  const phone = sampleContact?.phone?.trim() || '+1 (555) 234-8910';
  const company = sampleContact?.company?.trim() || 'Your Organization';
  const listName = sampleContact?.listName?.trim() || fallbackListName || 'Subscribers List';
  const senderName = workspace?.senderName?.trim() || 'FlowPilot Operator';
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : `https://${privateProfile?.emailProviderDomain?.trim() || 'mail.flowpilot.app'}`;
  const unsubUrl = `${origin}/?unsubscribe=${encodeURIComponent(email || phone)}${
    campaignId ? `&campaignId=${encodeURIComponent(campaignId)}` : ''
  }`;

  return rawText
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*full_name\s*\}\}/gi, fullName)
    .replace(/\{\{\s*name\s*\}\}/gi, fullName)
    .replace(/\{\{\s*email\s*\}\}/gi, email)
    .replace(/\{\{\s*phone\s*\}\}/gi, phone)
    .replace(/\{\{\s*company\s*\}\}/gi, company)
    .replace(/\{\{\s*list_name\s*\}\}/gi, listName)
    .replace(/\{\{\s*sender_name\s*\}\}/gi, senderName)
    .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, unsubUrl);
}

const DECEPTIVE_SUBJECT_PATTERNS: { regex: RegExp; reason: string }[] = [
  {
    regex: /^(re:|fw:|fwd:)/i,
    reason: 'Deceptive "RE:" or "FWD:" prefix detected in broadcast subject line (violates anti-deception policy).',
  },
  {
    regex: /(100%\s*free\s*money|guaranteed\s*millions|urgent\s*wire\s*transfer|act\s*now\s*or\s*account\s*closed|winner\s*claim\s*prize|no\s*credit\s*check\s*loan)/i,
    reason: 'Deceptive or high-risk spam trigger phrase detected in subject or body.',
  },
];

export function evaluateEmailCompliance(params: {
  subject: string;
  preheader: string;
  bodyText: string;
  hasUnsubscribeFooter: boolean;
  optedInRecipientCount: number;
  attestedOptInPermission: boolean;
  senderEmail?: string;
  mailingAddress?: string;
}): ComplianceScanResult {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const verifiedChecks: string[] = [];

  const combined = `${params.subject} ${params.preheader} ${params.bodyText}`;

  // 1. Check deceptive subject / body patterns
  for (const rule of DECEPTIVE_SUBJECT_PATTERNS) {
    if (rule.regex.test(params.subject) || rule.regex.test(combined)) {
      blockingIssues.push(rule.reason);
    }
  }

  if (blockingIssues.length === 0) {
    verifiedChecks.push('Subject line & copy free of deceptive "RE:/FWD:" prefixes and spam-trap claims');
  }

  // 2. Check all-caps shouting in subject line
  const lettersOnly = params.subject.replace(/[^a-zA-Z]/g, '');
  if (lettersOnly.length > 10 && lettersOnly === lettersOnly.toUpperCase()) {
    warnings.push('Subject line is in ALL CAPS, which triggers spam filters. Use natural sentence case.');
  } else if (params.subject.trim().length > 0) {
    verifiedChecks.push('Subject line uses natural editorial casing');
  }

  // 3. Mandatory Unsubscribe mechanism
  const hasUnsubToken =
    params.hasUnsubscribeFooter ||
    /unsubscribe/i.test(params.bodyText) ||
    /\{\{\s*unsubscribe_url\s*\}\}/i.test(params.bodyText);

  if (!hasUnsubToken) {
    blockingIssues.push(
      'Missing mandatory Unsubscribe link/footer. Every commercial email must include a clear one-click unsubscribe mechanism.'
    );
  } else {
    verifiedChecks.push('One-click Unsubscribe footer & RFC 8058 List-Unsubscribe header active');
  }

  // 4. Explicit Opt-In Permission attestation (Anti-Unsolicited Email Policy)
  if (!params.attestedOptInPermission) {
    blockingIssues.push(
      'Opt-in permission attestation required: You must confirm recipients explicitly opted in (no purchased, scraped, or unsolicited lists).'
    );
  } else {
    verifiedChecks.push('Verified opt-in consent attestation (unsubscribed & suppressed contacts automatically excluded)');
  }

  // 5. Physical mailing address check
  if (!params.mailingAddress || params.mailingAddress.trim().length < 5) {
    warnings.push(
      'Physical mailing address not set in Sender Configuration (recommended for CAN-SPAM footer compliance).'
    );
  } else {
    verifiedChecks.push('Physical sender address attached to compliance footer');
  }

  const baseScore = 100 - blockingIssues.length * 35 - warnings.length * 10;
  const score = Math.max(0, Math.min(100, baseScore));

  return {
    passed: blockingIssues.length === 0,
    score,
    blockingIssues,
    warnings,
    verifiedChecks,
  };
}

// ============================================================================
// SMS MARKETING, CARRIER GATEWAY & SEGMENT CALCULATOR CATALOG
// ============================================================================

export interface SmsTemplateItem {
  id: string;
  name: string;
  category: 'reminder' | 'promo' | 'follow_up' | 'confirmation';
  senderHeader: string;
  body: string;
}

export interface SmsProviderOption {
  id: 'twilio' | 'telnyx' | 'vonage' | 'aws_pinpoint';
  name: string;
  typicalRatePerSegmentUsd: number;
  carrierPassThroughPerSegmentUsd: number;
  dlrWebhookSupported: boolean;
  autoStopSupported: boolean;
  protocolSummary: string;
}

export const SMS_PROVIDERS_CATALOG: SmsProviderOption[] = [
  {
    id: 'twilio',
    name: 'Twilio Programmable Messaging (A2P 10DLC / Toll-Free)',
    typicalRatePerSegmentUsd: 0.0079,
    carrierPassThroughPerSegmentUsd: 0.003,
    dlrWebhookSupported: true,
    autoStopSupported: true,
    protocolSummary: 'Real-time MessageStatus webhooks (queued, sent, delivered, undelivered, failed)',
  },
  {
    id: 'telnyx',
    name: 'Telnyx Carrier-Grade Messaging API',
    typicalRatePerSegmentUsd: 0.004,
    carrierPassThroughPerSegmentUsd: 0.0025,
    dlrWebhookSupported: true,
    autoStopSupported: true,
    protocolSummary: 'Direct Tier-1 carrier routing with per-recipient DLR webhook callbacks',
  },
  {
    id: 'vonage',
    name: 'Vonage (Nexmo) SMS API',
    typicalRatePerSegmentUsd: 0.0068,
    carrierPassThroughPerSegmentUsd: 0.003,
    dlrWebhookSupported: true,
    autoStopSupported: true,
    protocolSummary: 'Global alphanumeric sender ID & 10DLC delivery receipts',
  },
  {
    id: 'aws_pinpoint',
    name: 'AWS End User Messaging (Pinpoint SMS)',
    typicalRatePerSegmentUsd: 0.00645,
    carrierPassThroughPerSegmentUsd: 0.0028,
    dlrWebhookSupported: true,
    autoStopSupported: true,
    protocolSummary: 'SNS delivery status event streaming & Two-Way STOP opt-out sync',
  },
];

export const DEFAULT_SMS_TEMPLATES: SmsTemplateItem[] = [
  {
    id: 'sms_tpl_session_reminder',
    name: 'Live Session / Appointment Reminder',
    category: 'reminder',
    senderHeader: 'SMS Reminder: Live Session Starts in 15m',
    body: 'Hi {{first_name}}, friendly reminder from {{sender_name}}: our live session for {{list_name}} starts in 15 mins! Join here: https://flowpilot.app/live — Reply STOP to opt out.',
  },
  {
    id: 'sms_tpl_resource_delivery',
    name: 'Instant Opt-In Resource Link',
    category: 'confirmation',
    senderHeader: 'SMS Resource Delivery Confirmation',
    body: 'Hi {{first_name}}, thanks for joining {{list_name}}! Access your requested playbook here: https://flowpilot.app/kit — {{sender_name}}. Reply STOP to opt out.',
  },
  {
    id: 'sms_tpl_vip_followup',
    name: 'High-Intent Lead Personal Follow-Up',
    category: 'follow_up',
    senderHeader: 'SMS VIP Priority Follow-Up',
    body: 'Hi {{first_name}}, {{sender_name}} here. Did you have any questions about setting up your workflow for {{company}}? Reply YES or STOP to opt out.',
  },
  {
    id: 'sms_tpl_flash_alert',
    name: 'Time-Sensitive VIP Enrollment Alert',
    category: 'promo',
    senderHeader: 'SMS Early-Access Window Closing',
    body: '{{first_name}}, early enrollment for {{list_name}} closes tonight at 9 PM EST. Claim your spot: https://flowpilot.app/vip — Reply STOP to opt out.',
  },
];

export const SMS_SEQUENCE_BLUEPRINTS: EmailSequenceBlueprint[] = [
  {
    id: 'sms_seq_instant_welcome',
    name: '2-Step Opt-In SMS Confirmation & 24h Check-In',
    category: 'SMS Lead Nurture',
    description:
      'Sends an immediate SMS confirmation when a contact joins your selected Contact List, waits 24 hours (daytime window), and sends a personal check-in SMS.',
    stepsCount: 2,
    cadenceSummary: 'Immediate SMS → Wait 1 Day (09:00–17:00 Mon-Fri) → Follow-Up SMS',
    buildNodes: (targetListName: string): WorkflowNode[] => [
      {
        id: 'node_trig_sms1',
        category: 'trigger',
        subType: 'list_joined',
        title: `Contact Joins "${targetListName}" (SMS Opt-In)`,
        subtitle: `List: ${targetListName} · Verified SMS Consent`,
        branchPath: 'main',
        config: {
          targetList: targetListName,
        },
      },
      {
        id: 'node_act_sms1_1',
        category: 'action',
        subType: 'send_sms',
        title: 'SMS #1: Instant Welcome & Resource Link',
        subtitle: 'Scheduled: Send Immediately · 1 SMS Segment',
        branchPath: 'main',
        config: {
          channel: 'sms',
          targetList: targetListName,
          subjectOrTemplate: 'SMS Welcome Confirmation',
          messagePreview:
            'Hi {{first_name}}, welcome to {{list_name}}! Here is your direct access link: https://flowpilot.app/start — Reply STOP to opt out.',
          messageScheduleMode: 'immediate',
        },
      },
      {
        id: 'node_act_sms1_2',
        category: 'action',
        subType: 'send_sms',
        title: 'SMS #2: 24-Hour Daytime Check-In',
        subtitle: 'Scheduled: Wait 1 day · @10:00 (Mon–Fri)',
        branchPath: 'main',
        config: {
          channel: 'sms',
          targetList: targetListName,
          subjectOrTemplate: 'SMS 24h Follow-Up Check-In',
          messagePreview:
            'Hi {{first_name}}, quick check-in from {{sender_name}} — were you able to open the resource we sent yesterday? Reply STOP to opt out.',
          messageScheduleMode: 'delay',
          delayAmount: 1,
          delayUnit: 'days',
          scheduledSendTime: '10:00',
          businessDaysOnly: true,
          businessWindowStart: '09:00',
          businessWindowEnd: '17:00',
        },
      },
    ],
  },
  {
    id: 'sms_seq_event_countdown',
    name: '2-Step Event / Workshop SMS Reminder Workflow',
    category: 'SMS Event Attendance',
    description:
      'Confirms seat registration via SMS upon joining the Contact List, then dispatches a scheduled reminder before the session.',
    stepsCount: 2,
    cadenceSummary: 'Immediate Registration SMS → +2 Hours Timed Reminder SMS',
    buildNodes: (targetListName: string): WorkflowNode[] => [
      {
        id: 'node_trig_sms2',
        category: 'trigger',
        subType: 'list_joined',
        title: `Registered in "${targetListName}"`,
        subtitle: `List: ${targetListName} · Event Registrant`,
        branchPath: 'main',
        config: {
          targetList: targetListName,
        },
      },
      {
        id: 'node_act_sms2_1',
        category: 'action',
        subType: 'send_sms',
        title: 'SMS #1: Seat Reserved Confirmation',
        subtitle: 'Scheduled: Send Immediately',
        branchPath: 'main',
        config: {
          channel: 'sms',
          targetList: targetListName,
          subjectOrTemplate: 'SMS Seat Confirmation',
          messagePreview:
            'Hi {{first_name}}, your seat for the {{list_name}} live session is confirmed! We will text you a reminder before we go live. Reply STOP to opt out.',
          messageScheduleMode: 'immediate',
        },
      },
      {
        id: 'node_act_sms2_2',
        category: 'action',
        subType: 'send_sms',
        title: 'SMS #2: Session Starting Soon Reminder',
        subtitle: 'Scheduled: Wait 2 hours before sending',
        branchPath: 'main',
        config: {
          channel: 'sms',
          targetList: targetListName,
          subjectOrTemplate: 'SMS Starting Soon Alert',
          messagePreview:
            'Hi {{first_name}}, we are going live soon! Join from your phone or desktop here: https://flowpilot.app/live — Reply STOP to opt out.',
          messageScheduleMode: 'delay',
          delayAmount: 2,
          delayUnit: 'hours',
          scheduledSendTime: '11:00',
          businessDaysOnly: true,
        },
      },
    ],
  },
];

export function calculateSmsSegments(text: string): {
  charCount: number;
  encoding: 'GSM-7' | 'UCS-2 (Unicode)';
  charsPerSegment: number;
  segments: number;
  hasStopInstruction: boolean;
} {
  const clean = text || '';
  const charCount = clean.length;
  // Detect non-ASCII / Unicode characters outside basic GSM-7
  // eslint-disable-next-line no-control-regex
  const isUnicode = /[^\x00-\x7F]/.test(clean.replace(/→|—|’|“|”/g, '-'));
  const encoding = isUnicode ? 'UCS-2 (Unicode)' : 'GSM-7';
  const singleLimit = isUnicode ? 70 : 160;
  const multiLimit = isUnicode ? 67 : 153;

  const segments =
    charCount === 0
      ? 1
      : charCount <= singleLimit
      ? 1
      : Math.ceil(charCount / multiLimit);

  const hasStopInstruction = /\b(stop|unsubscribe|opt\s*out|arret)\b/i.test(clean);

  return {
    charCount,
    encoding,
    charsPerSegment: charCount <= singleLimit ? singleLimit : multiLimit,
    segments,
    hasStopInstruction,
  };
}

