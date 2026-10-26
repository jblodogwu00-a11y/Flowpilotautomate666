import { Timestamp } from 'firebase/firestore';

// Verbatim constants synchronized with firebase-blueprint.json & firestore.rules
export const VALID_ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;
export const MAX_ID_LENGTH = 128;

export type BusinessCategory = 'creator' | 'freelancer' | 'coach' | 'agency' | 'smb';
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'NGN' | 'CAD';
export type MemberRole = 'owner' | 'admin' | 'editor' | 'analyst';
export type MemberStatus = 'active' | 'invited' | 'revoked';

export type ContactStage = 'lead' | 'warm_lead' | 'qualified' | 'customer' | 'churned' | 'cold_subscriber';
export type LeadTemperature = 'hot' | 'warm' | 'cold';
export type ConsentStatus = 'opted_in' | 'pending_double_opt_in' | 'unsubscribed';

export type TriggerType =
  | 'form_submission'
  | 'contact_added'
  | 'tag_added'
  | 'tag_removed'
  | 'list_joined'
  | 'list_removed'
  | 'link_clicked'
  | 'email_opened'
  | 'specific_datetime'
  | 'field_updated'
  | 'webhook_received'
  | 'manual_enrollment'
  | 'purchase_completed'
  | 'whatsapp_keyword'
  | 'booking_requested';

export type WorkflowNodeCategory = 'trigger' | 'action' | 'condition' | 'delay';

export type ActionNodeType =
  | 'send_email'
  | 'send_sms'
  | 'send_whatsapp'
  | 'add_tag'
  | 'remove_tag'
  | 'add_to_list'
  | 'remove_from_list'
  | 'update_contact_field'
  | 'create_task'
  | 'notify_team'
  | 'move_deal_stage'
  | 'wait_delay'
  | 'send_webhook'
  | 'enroll_workflow'
  | 'stop_workflow'
  | 'add_internal_note';

export type ConditionNodeType =
  | 'if_else'
  | 'yes_no'
  | 'contact_field_condition'
  | 'tag_list_condition'
  | 'engagement_condition'
  | 'datetime_condition'
  | 'multi_path';

export type DelayUnit = 'minutes' | 'hours' | 'days' | 'specific_datetime';

export type BranchPathType = 'main' | 'yes' | 'no' | 'path_a' | 'path_b' | 'path_c';

export interface WorkflowNode {
  id: string;
  category: WorkflowNodeCategory;
  subType: TriggerType | ActionNodeType | ConditionNodeType | DelayUnit;
  title: string;
  subtitle: string;
  branchPath: BranchPathType;
  stepOrder?: number;
  config: {
    // Messaging / Action parameters
    channel?: 'email' | 'whatsapp' | 'sms' | 'crm' | 'webhook';
    senderIdentityId?: string;
    overrideFromIdentity?: string;
    subjectOrTemplate?: string;
    messagePreview?: string;
    targetTag?: string;
    targetList?: string;
    fieldName?: string;
    fieldValue?: string;
    dealStage?: ContactStage;
    taskTitle?: string;
    teamRecipient?: string;
    webhookUrl?: string;
    webhookMethod?: 'POST' | 'PUT';
    targetWorkflowName?: string;
    internalNoteText?: string;
    // Conditional Logic parameters
    conditionField?: string;
    conditionOperator?: 'equals' | 'contains' | 'greater_than' | 'has_tag' | 'in_list' | 'opened_email' | 'clicked_link' | 'is_weekday';
    conditionValue?: string;
    branchLabels?: string[];
    // Delay & Per-Message Scheduling parameters
    messageScheduleMode?: 'immediate' | 'delay' | 'specific_datetime' | 'time_window';
    scheduledSendTime?: string;
    delayAmount?: number;
    delayUnit?: DelayUnit;
    waitDurationAmount?: number;
    waitDurationUnit?: DelayUnit;
    specificDateTime?: string;
    businessDaysOnly?: boolean;
    businessWindowStart?: string;
    businessWindowEnd?: string;
  };
}

export interface WorkflowVersionSnapshot {
  version: number;
  savedAt: string;
  author: string;
  changeNote: string;
  nodeCount: number;
  nodes: WorkflowNode[];
}

export interface WorkflowEngineConfig {
  maxRetries: number;
  retryBackoffSec: number;
  idempotencyWindowHours: number;
  businessDaysOnlyDefault: boolean;
  errorHandlingPolicy: 'retry_then_continue' | 'retry_then_pause' | 'halt_immediately';
  concurrencyLimit: number;
  scheduleMode?: 'instant_event' | 'delayed_entry' | 'scheduled_datetime' | 'recurring_cadence';
  entryDelayAmount?: number;
  entryDelayUnit?: 'minutes' | 'hours' | 'days';
  scheduledStartAt?: string;
  recurringCadence?: 'daily_9am' | 'weekdays_9am' | 'weekly_monday' | 'monthly_first';
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
  // Phase 1: Kill Switch / Goals & Exit Conditions
  killSwitchEnabled?: boolean;
  exitConditionField?: 'tag' | 'stage';
  exitConditionTag?: string;
  exitAction?: 'eject_immediately' | 'move_to_customer_and_eject';
}

export interface CsvImportOptions {
  applyTags: string[];
  updateExistingContacts?: boolean;
  createUnmatchedContacts?: boolean;
  matchColumnType?: 'auto' | 'email' | 'phone' | 'full_csv';
  columnMapping?: 'auto' | 'email' | 'phone' | 'full_csv';
  upgradeStageToCustomer?: boolean;
  targetListName?: string;
}

export type ContactList = AudienceList;
export type AutomationFlow = Automation;
export type LeadStage = ContactStage;

export interface CsvImportResultSummary {
  updatedCount: number;
  createdCount: number;
  skippedCount: number;
  killSwitchEjectedCount: number;
  affectedWorkflowNames: string[];
  appliedTags: string[];
  matchedContactNames: string[];
}

export interface WorkflowJobExecutionLog {
  id: string;
  workflowId: string;
  workflowName: string;
  workflowVersion: number;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  idempotencyKey: string;
  status: 'queued' | 'running' | 'retrying' | 'waiting_delay' | 'completed' | 'paused' | 'failed';
  currentNodeTitle: string;
  attempt: number;
  maxRetries: number;
  startedAt: string;
  updatedAt: string;
  scheduledResumeAt?: string;
  remainingSeconds?: number;
  branchTaken?: string;
  errorDetail?: string;
  stepTrace: {
    nodeId: string;
    nodeTitle: string;
    category: WorkflowNodeCategory;
    status: 'success' | 'skipped' | 'retrying' | 'failed' | 'waiting';
    timestamp: string;
    detail: string;
    channel?: ChannelType;
    receiptId?: string;
    senderIdentity?: string;
    recipient?: string;
    messageBody?: string;
    directLaunchUrl?: string;
    provider?: string;
  }[];
}

export interface SerializedFlowGraph {
  nodes: WorkflowNode[];
  version: number;
  versionHistory: WorkflowVersionSnapshot[];
  engineConfig: WorkflowEngineConfig;
}

export type AutomationStatus = 'active' | 'paused' | 'draft' | 'archived';
export type ChannelType = 'email' | 'whatsapp' | 'sms';
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent';

export type CaptureAssetType =
  | 'landing_page'
  | 'inline_form'
  | 'popup_form'
  | 'lead_magnet_funnel';
export type AssetStatus = 'published' | 'draft' | 'archived';

export type ChatbotMatchType = 'exact' | 'contains' | 'first_message';
export type ChatbotStatus = 'active' | 'paused' | 'archived';

export type TaskCategory =
  | 'follow_up'
  | 'campaign_review'
  | 'compliance_check'
  | 'onboarding'
  | 'whatsapp';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export type ActivityEventType =
  | 'lead_captured'
  | 'form_captured'
  | 'automation_triggered'
  | 'campaign_sent'
  | 'whatsapp_replied'
  | 'stage_converted'
  | 'asset_published';
export type ActivityChannel = 'email' | 'whatsapp' | 'sms' | 'web' | 'crm' | 'system';

export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  category: BusinessCategory;
  timezone: string;
  currency: CurrencyCode;
  senderName: string;
  whatsappConnected: boolean;
  smsConnected: boolean;
  emailConnected: boolean;
  notifyNewLeads: boolean;
  notifyCampaigns: boolean;
  whatsappPhoneId?: string;
  smsSenderId?: string;
  sendingDomainStatus?: string;
  whatsappWebhookStatus?: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface UserMessagingIdentity {
  id: string;
  channel: ChannelType;
  label: string;
  value: string;
  senderName?: string;
  displayName?: string;
  replyToEmail?: string;
  providerMode?: string;
  providerType?: string;
  isDefault?: boolean;
  isPrimary?: boolean;
  verified: boolean;
  createdAt?: string;
}

export interface UserPrivateProfile {
  id: string;
  ownerId: string;
  email: string;
  replyToEmail: string;
  phone: string;
  mailingAddress: string;
  whatsappPhoneId: string;
  smsSenderId: string;
  emailProviderDomain: string;
  whatsappBusinessNumber?: string;
  whatsappBusinessPhone?: string;
  sendingDomain?: string;
  espProvider?: string;
  espApiKey?: string;
  smsProvider?: string;
  smsApiKey?: string;
  onboardingCompleted?: boolean;
  dailySendCap?: number;
  customDomainEmail?: string;
  useCustomDomainEmail?: boolean;
  messagingIdentitiesJson?: string;
  savedIdentitiesJson?: string;
  gatewayConfigJson?: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  ownerId: string;
  memberName: string;
  memberEmail: string;
  role: MemberRole;
  status: MemberStatus;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface Contact {
  id: string;
  workspaceId: string;
  ownerId: string;
  fullName: string;
  email: string;
  phone: string;
  company?: string;
  dealTitle?: string;
  stage: ContactStage;
  temperature: LeadTemperature;
  source: string;
  consentStatus: ConsentStatus;
  commChannels?: string[];
  listName: string;
  tags: string[];
  ltv: number;
  notes: string;
  customFields?: string[];
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface Automation {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  triggerType: TriggerType;
  triggerDetail: string;
  targetList?: string;
  targetListName?: string;
  stepsSummary: string[];
  steps?: string[];
  channels: string[];
  channel?: ChannelType;
  status: AutomationStatus;
  enrolledCount: number;
  completedCount: number;
  conversionRate: number;
  version?: number;
  flowGraphJson?: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface Campaign {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  channel: ChannelType;
  targetList: string;
  subjectOrTemplate: string;
  messageBody: string;
  status: CampaignStatus;
  recipientCount: number;
  sentCount?: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount?: number;
  unsubscribedCount?: number;
  preheader?: string;
  templateId?: string;
  overrideFromIdentity?: string;
  segmentFilter?: string;
  scheduledAt?: string;
  blocksJson?: string;
  abTestEnabled?: boolean;
  variantBSubject?: string;
  variantBBody?: string;
  abWinningMetric?: 'open_rate' | 'click_rate';
  abSamplePercent?: number;
  abWinnerVariant?: 'A' | 'B' | 'pending';
  sendTimeOptimization?: 'immediate' | 'recipient_local_9am' | 'evening_peak_6pm';
  attributedRevenue?: number;
  conversionsCount?: number;
  campaignCost?: number;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface CaptureAsset {
  id: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  assetType: CaptureAssetType;
  slug: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  redirectUrl?: string;
  toolFormat?: string;
  targetList: string;
  requireDoubleOptIn: boolean;
  status: AssetStatus;
  viewsCount: number;
  submissionsCount: number;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface ChatbotFlow {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  triggerKeyword: string;
  matchType: ChatbotMatchType;
  welcomeMessage: string;
  menuOptions: string[];
  handoffToHuman: boolean;
  status: ChatbotStatus;
  sessionsCount: number;
  resolvedCount: number;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface TaskItem {
  id: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  category: TaskCategory;
  priority: TaskPriority;
  dueDate: string;
  relatedEntity: string;
  status: TaskStatus;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface ActivityLog {
  id: string;
  workspaceId: string;
  ownerId: string;
  eventType: ActivityEventType;
  title: string;
  detail: string;
  channel: ActivityChannel;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export type ListCategory = 'newsletter' | 'vip_buyers' | 'lead_magnet' | 'webinar' | 'custom';
export type ListColorAccent = 'emerald' | 'amber' | 'indigo' | 'rose';

export interface AudienceList {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  description: string;
  category: ListCategory;
  defaultConsent: ConsentStatus;
  defaultTags: string[];
  colorAccent: ListColorAccent;
  /** List-level Kill Switch: When enabled, if any tag on a contact in this list matches killSwitchTags, automation stops for that contact */
  killSwitchEnabled?: boolean;
  killSwitchTags?: string[];
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export type AutoResponderMatchType = 'contains' | 'exact' | 'any_inbound';
export type AutoResponderStatus = 'live' | 'paused' | 'draft';

export interface AutoResponder {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  targetList: string;
  triggerMessage: string;
  responseMessage: string;
  channel: ChannelType;
  matchType?: AutoResponderMatchType;
  subjectLine?: string;
  status: AutoResponderStatus;
  triggeredCount: number;
  sentCount: number;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export type InboxSenderType = 'lead' | 'operator' | 'autoresponder' | 'outbound_original';
export type InboxThreadStatus = 'unread' | 'replied' | 'archived';

export interface InboxMessageItem {
  id: string;
  sender: InboxSenderType;
  senderName: string;
  channel: ChannelType;
  subject?: string;
  body: string;
  timestamp: string;
}

export interface InboxThread {
  id: string;
  workspaceId: string;
  ownerId: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  listName: string;
  channel: ChannelType;
  subjectOrContext: string;
  lastLeadMessage: string;
  lastMessagePreview: string;
  lastSender: 'lead' | 'operator' | 'autoresponder';
  status: InboxThreadStatus;
  unreadCount: number;
  messagesJson: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export type ActiveTab =
  | 'dashboard'
  | 'inbox'
  | 'contacts'
  | 'lists'
  | 'automations'
  | 'autoresponders'
  | 'campaigns'
  | 'assets'
  | 'funnels'
  | 'chatbots'
  | 'whatsapp_connect'
  | 'workflow_builder'
  | 'settings';

// Defensive payload sanitization helpers matching firebase-blueprint.json
export function generateSafeId(prefix: string): string {
  const randomPart = Math.random().toString(36).substring(2, 10);
  const raw = `${prefix}_${Date.now()}_${randomPart}`.replace(/[^a-zA-Z0-9_\-]/g, '');
  return raw.slice(0, MAX_ID_LENGTH);
}

export function sanitizeString(val: string, maxLength: number, fallback = ''): string {
  const trimmed = (val ?? '').trim();
  const result = trimmed.length > 0 ? trimmed : fallback;
  return result.slice(0, maxLength);
}

export function sanitizeStringArray(
  items: string[],
  maxItems: number,
  maxItemLength: number
): string[] {
  return (items || [])
    .map((item) => item.trim().slice(0, maxItemLength))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

export function formatCurrency(amount: number, currency: CurrencyCode = 'USD'): string {
  const symbols: Record<CurrencyCode, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    NGN: '₦',
    CAD: 'CA$',
  };
  const sym = symbols[currency] || '$';
  return `${sym}${Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function parseUserMessagingIdentities(
  privateProfile?: UserPrivateProfile | string
): UserMessagingIdentity[] {
  const raw =
    typeof privateProfile === 'string'
      ? privateProfile
      : privateProfile?.messagingIdentitiesJson || privateProfile?.savedIdentitiesJson;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          (item.channel === 'whatsapp' || item.channel === 'email' || item.channel === 'sms') &&
          typeof item.value === 'string' &&
          item.value.trim().length > 0
      )
      .map((item) => {
        const nameLabel = String(item.senderName || item.displayName || 'Workspace Operator').slice(
          0,
          100
        );
        const isDef = Boolean(item.isDefault || item.isPrimary);
        return {
          id: String(item.id || generateSafeId(`id_${item.channel}`)),
          channel: item.channel as ChannelType,
          label: String(item.label || 'Primary Identity').slice(0, 80),
          value: String(item.value).trim().slice(0, 150),
          senderName: nameLabel,
          displayName: nameLabel,
          replyToEmail: item.replyToEmail
            ? String(item.replyToEmail).trim().slice(0, 150)
            : undefined,
          providerMode: String(item.providerMode || 'builtin_relay').slice(0, 40),
          isDefault: isDef,
          isPrimary: isDef,
          verified: item.verified !== undefined ? Boolean(item.verified) : true,
          createdAt: String(item.createdAt || new Date().toISOString()),
        };
      });
  } catch {
    return [];
  }
}

export const parseSavedMessagingIdentities = parseUserMessagingIdentities;

export function serializeUserMessagingIdentities(
  identities: UserMessagingIdentity[]
): string {
  try {
    const cleaned = (identities || []).slice(0, 25).map((item) => ({
      id: String(item.id || generateSafeId(`id_${item.channel}`)).slice(0, 64),
      channel: item.channel,
      label: String(item.label || 'Sender Identity').slice(0, 80),
      value: String(item.value || '').trim().slice(0, 150),
      senderName: String(item.senderName || 'Workspace Operator').slice(0, 100),
      ...(item.replyToEmail ? { replyToEmail: String(item.replyToEmail).trim().slice(0, 150) } : {}),
      providerMode: String(item.providerMode || 'builtin_relay').slice(0, 40),
      isDefault: Boolean(item.isDefault),
      verified: Boolean(item.verified),
      createdAt: String(item.createdAt || new Date().toISOString()).slice(0, 40),
    }));
    return JSON.stringify(cleaned).slice(0, 10000);
  } catch {
    return '[]';
  }
}

export interface ResolvedSenderIdentities {
  whatsappBusinessNumber: string;
  hasCustomWhatsappNumber: boolean;
  whatsappDisplaySender: string;
  platformDefaultEmail: string;
  customDomainEmail: string;
  hasCustomDomainEmail: boolean;
  useCustomDomainEmail: boolean;
  activeSenderEmail: string;
  activeEmailMode: 'custom_domain' | 'platform_default';
  emailDisplaySender: string;
  smsSenderId: string;
  savedIdentities: UserMessagingIdentity[];
  allIdentities: UserMessagingIdentity[];
  whatsappIdentities: UserMessagingIdentity[];
  emailIdentities: UserMessagingIdentity[];
  smsIdentities: UserMessagingIdentity[];
  activeWhatsappIdentity?: UserMessagingIdentity;
  activeEmailIdentity?: UserMessagingIdentity;
  activeSmsIdentity?: UserMessagingIdentity;
  hasAnyCustomIdentity: boolean;
}

export function resolveWorkspaceSenderIdentities(
  workspace?: Workspace,
  privateProfile?: UserPrivateProfile
): ResolvedSenderIdentities {
  const senderName = (workspace?.senderName || workspace?.name || 'Workspace Operator').trim();
  const wsSlug =
    (workspace?.name || 'workspace')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'workspace';

  const platformDefaultEmail = `${wsSlug}@send.flowpilot.app`;

  const parsedIdentities = parseUserMessagingIdentities(privateProfile);
  const whatsappIdentities = parsedIdentities.filter((i) => i.channel === 'whatsapp');
  const emailIdentities = parsedIdentities.filter((i) => i.channel === 'email');
  const smsIdentities = parsedIdentities.filter((i) => i.channel === 'sms');

  const activeWhatsappIdentity =
    whatsappIdentities.find((i) => i.isDefault) || whatsappIdentities[0];
  const activeEmailIdentity =
    emailIdentities.find((i) => i.isDefault) || emailIdentities[0];
  const activeSmsIdentity =
    smsIdentities.find((i) => i.isDefault) || smsIdentities[0];

  // WhatsApp Business Number resolution (prefers active default from vault or top-level field)
  const rawWaNumber = (
    activeWhatsappIdentity?.value ||
    privateProfile?.whatsappBusinessNumber ||
    privateProfile?.whatsappPhoneId ||
    privateProfile?.phone ||
    ''
  ).trim();
  const hasCustomWhatsappNumber = rawWaNumber.length > 0;
  const whatsappBusinessNumber = hasCustomWhatsappNumber ? rawWaNumber : '+1 (555) 019-2834';
  const waSenderLabel = activeWhatsappIdentity?.senderName || senderName;
  const whatsappDisplaySender = `${whatsappBusinessNumber} (${waSenderLabel})`;

  // Custom Domain Email vs Platform-Provided Email resolution
  const rawCustomEmail = (
    (activeEmailIdentity && activeEmailIdentity.providerMode !== 'platform_default'
      ? activeEmailIdentity.value
      : '') ||
    privateProfile?.customDomainEmail ||
    ''
  ).trim();
  const rawDomain = (privateProfile?.emailProviderDomain || '').trim();
  const derivedCustomEmail = rawCustomEmail.includes('@')
    ? rawCustomEmail
    : rawDomain && rawDomain.includes('.')
    ? `hello@${rawDomain.replace(/^https?:\/\//i, '').replace(/^@/, '')}`
    : '';

  const hasCustomDomainEmail = derivedCustomEmail.length > 3 && derivedCustomEmail.includes('@');
  const wantsCustomDomain =
    activeEmailIdentity !== undefined
      ? activeEmailIdentity.providerMode !== 'platform_default' && hasCustomDomainEmail
      : privateProfile?.useCustomDomainEmail !== undefined
      ? Boolean(privateProfile.useCustomDomainEmail)
      : hasCustomDomainEmail;

  const activeEmailMode: 'custom_domain' | 'platform_default' =
    wantsCustomDomain && hasCustomDomainEmail ? 'custom_domain' : 'platform_default';

  const activeSenderEmail =
    activeEmailMode === 'custom_domain' ? derivedCustomEmail : platformDefaultEmail;

  const emailSenderLabel = activeEmailIdentity?.senderName || senderName;
  const emailDisplaySender = `${emailSenderLabel} <${activeSenderEmail}>`;

  const rawSmsId = (activeSmsIdentity?.value || privateProfile?.smsSenderId || '').trim();
  const smsSenderId = (rawSmsId || rawWaNumber || 'FLOWPILOT').trim();

  const hasAnyCustomIdentity =
    parsedIdentities.length > 0 ||
    hasCustomWhatsappNumber ||
    hasCustomDomainEmail ||
    rawSmsId.length > 0;

  return {
    whatsappBusinessNumber,
    hasCustomWhatsappNumber,
    whatsappDisplaySender,
    platformDefaultEmail,
    customDomainEmail: derivedCustomEmail,
    hasCustomDomainEmail,
    useCustomDomainEmail: wantsCustomDomain,
    activeSenderEmail,
    activeEmailMode,
    emailDisplaySender,
    smsSenderId,
    savedIdentities: parsedIdentities,
    allIdentities: parsedIdentities,
    whatsappIdentities,
    emailIdentities,
    smsIdentities,
    activeWhatsappIdentity,
    activeEmailIdentity,
    activeSmsIdentity,
    hasAnyCustomIdentity,
  };
}

