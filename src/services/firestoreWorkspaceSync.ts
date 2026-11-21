import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  ActivityChannel,
  ActivityEventType,
  ActivityLog,
  AssetStatus,
  AudienceList,
  Automation,
  AutomationStatus,
  AutoResponder,
  AutoResponderMatchType,
  AutoResponderStatus,
  BusinessCategory,
  Campaign,
  CampaignStatus,
  CaptureAsset,
  CaptureAssetType,
  ChannelType,
  ChatbotFlow,
  ChatbotMatchType,
  ChatbotStatus,
  ConsentStatus,
  Contact,
  ContactStage,
  CurrencyCode,
  InboxThread,
  InboxThreadStatus,
  LeadTemperature,
  ListCategory,
  ListColorAccent,
  MAX_ID_LENGTH,
  MemberRole,
  MemberStatus,
  TaskCategory,
  TaskItem,
  TaskPriority,
  TaskStatus,
  TriggerType,
  UserPrivateProfile,
  VALID_ID_PATTERN,
  Workspace,
  WorkspaceMember,
  generateSafeId,
  sanitizeString,
  sanitizeStringArray,
} from '../types';
import {
  WorkspaceSnapshot,
  buildStarterWorkspaceSnapshot,
  clearLocalWorkspaceSnapshot,
  mergeActivities,
  normalizeWorkspaceSnapshot,
} from './accountPersistenceService';

export type CloudSyncState = 'synced' | 'syncing' | 'local_only' | 'error';

export type TrackableCategory =
  | 'automations'
  | 'lists'
  | 'contacts'
  | 'campaigns'
  | 'assets'
  | 'chatbots'
  | 'autoResponders'
  | 'inboxThreads'
  | 'tasks'
  | 'activities'
  | 'members'
  | 'workspace'
  | 'privateProfile';

const GUEST_DIRTY_KEY = 'fp_guest_dirty_ids_v1';

export interface GuestDirtyBucket {
  workspaceDirty?: boolean;
  privateProfileDirty?: boolean;
  automations: string[];
  lists: string[];
  contacts: string[];
  campaigns: string[];
  assets: string[];
  chatbots: string[];
  autoResponders: string[];
  inboxThreads: string[];
  tasks: string[];
  activities: string[];
  members: string[];
}

function emptyGuestBucket(): GuestDirtyBucket {
  return {
    workspaceDirty: false,
    privateProfileDirty: false,
    automations: [],
    lists: [],
    contacts: [],
    campaigns: [],
    assets: [],
    chatbots: [],
    autoResponders: [],
    inboxThreads: [],
    tasks: [],
    activities: [],
    members: [],
  };
}

export function getGuestDirtyBucket(): GuestDirtyBucket {
  try {
    const raw = localStorage.getItem(GUEST_DIRTY_KEY);
    if (!raw) return emptyGuestBucket();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyGuestBucket();
    return {
      ...emptyGuestBucket(),
      ...parsed,
    };
  } catch {
    return emptyGuestBucket();
  }
}

export function trackGuestDirtyItem(category: TrackableCategory, id?: string): void {
  try {
    const bucket = getGuestDirtyBucket();
    if (category === 'workspace') {
      bucket.workspaceDirty = true;
    } else if (category === 'privateProfile') {
      bucket.privateProfileDirty = true;
    } else if (id) {
      const list = Array.isArray(bucket[category]) ? bucket[category] : [];
      if (!list.includes(id)) {
        bucket[category] = [...list, id].slice(-200);
      }
    }
    localStorage.setItem(GUEST_DIRTY_KEY, JSON.stringify(bucket));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearGuestDirtyBucket(): void {
  try {
    localStorage.removeItem(GUEST_DIRTY_KEY);
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// ID & TIMESTAMP UTILITIES
// ============================================================================

export function toValidDocId(rawId: string | undefined, prefix: string): string {
  const cleaned = (rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, MAX_ID_LENGTH);
  if (cleaned && VALID_ID_PATTERN.test(cleaned)) {
    return cleaned;
  }
  return generateSafeId(prefix);
}

export function timestampToIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Date) return val.toISOString();
  if (val instanceof Timestamp || typeof (val as any)?.toDate === 'function') {
    return (val as any).toDate().toISOString();
  }
  if (typeof (val as any)?.seconds === 'number') {
    return new Date((val as any).seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}

function parseTimestampMs(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const ms = new Date(val).getTime();
    return isNaN(ms) ? 0 : ms;
  }
  if (typeof (val as any)?.toDate === 'function') {
    return (val as any).toDate().getTime();
  }
  if (typeof (val as any)?.seconds === 'number') {
    return (val as any).seconds * 1000;
  }
  return 0;
}

function sortByRecent<T extends { updatedAt?: unknown; createdAt?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const tA = parseTimestampMs(a.updatedAt) || parseTimestampMs(a.createdAt);
    const tB = parseTimestampMs(b.updatedAt) || parseTimestampMs(b.createdAt);
    return tB - tA;
  });
}

function stripUndefinedShallow<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

// ============================================================================
// STRICT FIRESTORE SERIALIZERS (100% MATCH TO firestore.rules)
// ============================================================================

const VALID_BUSINESS_CATEGORIES = new Set<BusinessCategory>([
  'creator',
  'freelancer',
  'coach',
  'agency',
  'smb',
]);
const VALID_CURRENCIES = new Set<CurrencyCode>(['USD', 'EUR', 'GBP', 'NGN', 'CAD']);
const VALID_CONTACT_STAGES = new Set<ContactStage>([
  'lead',
  'warm_lead',
  'qualified',
  'customer',
  'churned',
  'cold_subscriber',
]);
const VALID_TEMPS = new Set<LeadTemperature>(['hot', 'warm', 'cold']);
const VALID_CONSENT = new Set<ConsentStatus>([
  'opted_in',
  'pending_double_opt_in',
  'unsubscribed',
]);
const VALID_TRIGGER_TYPES = new Set<TriggerType>([
  'form_submission',
  'contact_added',
  'tag_added',
  'tag_removed',
  'list_joined',
  'list_removed',
  'link_clicked',
  'email_opened',
  'specific_datetime',
  'field_updated',
  'webhook_received',
  'manual_enrollment',
  'purchase_completed',
  'whatsapp_keyword',
  'booking_requested',
]);
const VALID_AUTO_STATUS = new Set<AutomationStatus>(['active', 'paused', 'draft', 'archived']);
const VALID_CHANNELS = new Set<ChannelType>(['email', 'whatsapp', 'sms']);
const VALID_CAMPAIGN_STATUS = new Set<CampaignStatus>(['draft', 'scheduled', 'sending', 'sent']);
const VALID_ASSET_TYPES = new Set<CaptureAssetType>([
  'landing_page',
  'inline_form',
  'popup_form',
  'lead_magnet_funnel',
]);
const VALID_ASSET_STATUS = new Set<AssetStatus>(['published', 'draft', 'archived']);
const VALID_BOT_MATCH = new Set<ChatbotMatchType>(['exact', 'contains', 'first_message']);
const VALID_BOT_STATUS = new Set<ChatbotStatus>(['active', 'paused', 'archived']);
const VALID_TASK_CATS = new Set<TaskCategory>([
  'follow_up',
  'campaign_review',
  'compliance_check',
  'onboarding',
  'whatsapp',
]);
const VALID_TASK_PRIORITIES = new Set<TaskPriority>(['high', 'medium', 'low']);
const VALID_TASK_STATUS = new Set<TaskStatus>(['pending', 'in_progress', 'completed']);
const VALID_ACTIVITY_EVENTS = new Set<ActivityEventType>([
  'lead_captured',
  'form_captured',
  'automation_triggered',
  'workflow_saved',
  'workflow_published',
  'campaign_sent',
  'whatsapp_replied',
  'stage_converted',
  'asset_published',
]);
const VALID_ACTIVITY_CHANNELS = new Set<ActivityChannel>([
  'email',
  'whatsapp',
  'sms',
  'web',
  'crm',
  'system',
]);
const VALID_LIST_CATS = new Set<ListCategory>([
  'newsletter',
  'vip_buyers',
  'lead_magnet',
  'webinar',
  'custom',
]);
const VALID_LIST_COLORS = new Set<ListColorAccent>(['emerald', 'amber', 'indigo', 'rose']);
const VALID_RESPONDER_MATCH = new Set<AutoResponderMatchType>([
  'contains',
  'exact',
  'any_inbound',
]);
const VALID_RESPONDER_STATUS = new Set<AutoResponderStatus>(['live', 'paused', 'draft']);
const VALID_INBOX_STATUS = new Set<InboxThreadStatus>(['unread', 'replied', 'archived']);

export function serializeWorkspaceForFirestore(uid: string, ws: Partial<Workspace>) {
  const category = VALID_BUSINESS_CATEGORIES.has(ws.category as BusinessCategory)
    ? (ws.category as BusinessCategory)
    : 'creator';
  const currency = VALID_CURRENCIES.has(ws.currency as CurrencyCode)
    ? (ws.currency as CurrencyCode)
    : 'USD';

  return {
    ownerId: uid,
    name: sanitizeString(ws.name || '', 100, 'My Sovereign Workspace'),
    category,
    timezone: sanitizeString(ws.timezone || '', 64, 'America/New_York'),
    currency,
    senderName: sanitizeString(ws.senderName || '', 100, 'Workspace Operator'),
    whatsappConnected: Boolean(ws.whatsappConnected),
    smsConnected: Boolean(ws.smsConnected),
    emailConnected: Boolean(ws.emailConnected),
    notifyNewLeads: ws.notifyNewLeads !== undefined ? Boolean(ws.notifyNewLeads) : true,
    notifyCampaigns: ws.notifyCampaigns !== undefined ? Boolean(ws.notifyCampaigns) : true,
  };
}

export function serializePrivateProfileForFirestore(
  uid: string,
  fallbackEmail: string,
  p: Partial<UserPrivateProfile>
) {
  const rawEmail = sanitizeString(p.email || fallbackEmail || '', 150, 'operator@flowpilot.app');
  const validEmail = rawEmail.length >= 3 ? rawEmail : 'operator@flowpilot.app';
  const rawReply = sanitizeString(p.replyToEmail || validEmail, 150, validEmail);
  const validReply = rawReply.length >= 3 ? rawReply : validEmail;

  const base: Record<string, unknown> = {
    ownerId: uid,
    email: validEmail,
    replyToEmail: validReply,
    phone: sanitizeString(p.phone || '', 32, ''),
    mailingAddress: sanitizeString(p.mailingAddress || '', 250, ''),
    whatsappPhoneId: sanitizeString(p.whatsappPhoneId || '', 64, ''),
    smsSenderId: sanitizeString(p.smsSenderId || '', 32, 'FLOWPILOT'),
    emailProviderDomain: sanitizeString(p.emailProviderDomain || '', 120, ''),
  };

  if (p.whatsappBusinessNumber !== undefined) {
    base.whatsappBusinessNumber = sanitizeString(p.whatsappBusinessNumber, 64, '');
  }
  if (p.customDomainEmail !== undefined) {
    base.customDomainEmail = sanitizeString(p.customDomainEmail, 150, '');
  }
  if (p.useCustomDomainEmail !== undefined) {
    base.useCustomDomainEmail = Boolean(p.useCustomDomainEmail);
  }
  const identitiesRaw = p.messagingIdentitiesJson || p.savedIdentitiesJson;
  if (identitiesRaw !== undefined) {
    base.messagingIdentitiesJson = String(identitiesRaw).slice(0, 10000);
  }
  if (p.gatewayConfigJson !== undefined) {
    base.gatewayConfigJson = String(p.gatewayConfigJson).slice(0, 8000);
  }

  return base;
}

export function serializeMemberForFirestore(uid: string, m: Partial<WorkspaceMember>) {
  const validRoles: MemberRole[] = ['owner', 'admin', 'editor', 'analyst'];
  const validStatuses: MemberStatus[] = ['active', 'invited', 'revoked'];
  const rawEmail = sanitizeString(m.memberEmail || '', 150, 'member@flowpilot.app');

  return {
    workspaceId: uid,
    ownerId: uid,
    memberName: sanitizeString(m.memberName || '', 100, 'Team Member'),
    memberEmail: rawEmail.length >= 3 ? rawEmail : 'member@flowpilot.app',
    role: validRoles.includes(m.role as MemberRole) ? (m.role as MemberRole) : 'editor',
    status: validStatuses.includes(m.status as MemberStatus)
      ? (m.status as MemberStatus)
      : 'active',
  };
}

export function serializeContactForFirestore(uid: string, c: Partial<Contact>) {
  const stage = VALID_CONTACT_STAGES.has(c.stage as ContactStage)
    ? (c.stage as ContactStage)
    : 'lead';
  const temperature = VALID_TEMPS.has(c.temperature as LeadTemperature)
    ? (c.temperature as LeadTemperature)
    : 'warm';
  const consentStatus = VALID_CONSENT.has(c.consentStatus as ConsentStatus)
    ? (c.consentStatus as ConsentStatus)
    : 'opted_in';

  return stripUndefinedShallow({
    workspaceId: uid,
    ownerId: uid,
    fullName: sanitizeString(c.fullName || '', 100, 'Unnamed Contact'),
    email: sanitizeString(c.email || '', 150, ''),
    phone: sanitizeString(c.phone || '', 32, ''),
    stage,
    temperature,
    source: sanitizeString(c.source || '', 80, 'Manual Entry'),
    consentStatus,
    listName: sanitizeString(c.listName || '', 80, 'General Contacts'),
    tags: sanitizeStringArray(c.tags || [], 10, 32),
    ltv: Math.max(0, Number(c.ltv) || 0),
    notes: sanitizeString(c.notes || '', 500, ''),
    ...(c.company !== undefined ? { company: sanitizeString(c.company, 100, '') } : {}),
    ...(c.dealTitle !== undefined ? { dealTitle: sanitizeString(c.dealTitle, 120, '') } : {}),
    ...(c.commChannels !== undefined
      ? { commChannels: sanitizeStringArray(c.commChannels, 5, 24) }
      : {}),
    ...(c.customFields !== undefined
      ? { customFields: sanitizeStringArray(c.customFields, 15, 120) }
      : {}),
  });
}

export function serializeAutomationForFirestore(uid: string, a: Partial<Automation>) {
  const triggerType = VALID_TRIGGER_TYPES.has(a.triggerType as TriggerType)
    ? (a.triggerType as TriggerType)
    : 'list_joined';
  const status = VALID_AUTO_STATUS.has(a.status as AutomationStatus)
    ? (a.status as AutomationStatus)
    : 'draft';

  const rawSteps =
    Array.isArray(a.stepsSummary) && a.stepsSummary.length > 0
      ? a.stepsSummary
      : Array.isArray(a.steps) && a.steps.length > 0
      ? a.steps
      : ['Automated sequence step'];
  const stepsSummary = sanitizeStringArray(rawSteps, 20, 200);
  if (stepsSummary.length === 0) stepsSummary.push('Automated sequence step');

  const rawChannels =
    Array.isArray(a.channels) && a.channels.length > 0
      ? a.channels
      : a.channel
      ? [a.channel]
      : ['whatsapp'];
  const channels = sanitizeStringArray(rawChannels, 5, 32);
  if (channels.length === 0) channels.push('whatsapp');

  const targetList = a.targetList || a.targetListName;

  return stripUndefinedShallow({
    workspaceId: uid,
    ownerId: uid,
    name: sanitizeString(a.name || '', 120, 'Untitled Workflow'),
    triggerType,
    triggerDetail: sanitizeString(a.triggerDetail || '', 120, 'List trigger configured'),
    ...(targetList ? { targetList: sanitizeString(targetList, 80, 'General Contacts') } : {}),
    stepsSummary,
    channels,
    status,
    enrolledCount: Math.max(0, Math.round(Number(a.enrolledCount) || 0)),
    completedCount: Math.max(0, Math.round(Number(a.completedCount) || 0)),
    conversionRate: Math.min(100, Math.max(0, Number(a.conversionRate) || 0)),
    ...(a.version !== undefined ? { version: Math.max(1, Math.round(Number(a.version) || 1)) } : {}),
    ...(a.flowGraphJson ? { flowGraphJson: String(a.flowGraphJson).slice(0, 15000) } : {}),
  });
}

export function serializeCampaignForFirestore(uid: string, c: Partial<Campaign>) {
  const channel = VALID_CHANNELS.has(c.channel as ChannelType)
    ? (c.channel as ChannelType)
    : 'email';
  const status = VALID_CAMPAIGN_STATUS.has(c.status as CampaignStatus)
    ? (c.status as CampaignStatus)
    : 'draft';

  return stripUndefinedShallow({
    workspaceId: uid,
    ownerId: uid,
    name: sanitizeString(c.name || '', 120, 'Untitled Campaign'),
    channel,
    targetList: sanitizeString(c.targetList || '', 80, 'General Contacts'),
    subjectOrTemplate: sanitizeString(c.subjectOrTemplate || '', 160, 'Campaign Update'),
    messageBody: sanitizeString(c.messageBody || '', 5000, 'Hello {{first_name}}'),
    status,
    recipientCount: Math.max(0, Math.round(Number(c.recipientCount) || 0)),
    deliveredCount: Math.max(0, Math.round(Number(c.deliveredCount) || 0)),
    openedCount: Math.max(0, Math.round(Number(c.openedCount) || 0)),
    clickedCount: Math.max(0, Math.round(Number(c.clickedCount) || 0)),
    ...(c.bouncedCount !== undefined
      ? { bouncedCount: Math.max(0, Math.round(Number(c.bouncedCount) || 0)) }
      : {}),
    ...(c.unsubscribedCount !== undefined
      ? { unsubscribedCount: Math.max(0, Math.round(Number(c.unsubscribedCount) || 0)) }
      : {}),
    ...(c.preheader !== undefined ? { preheader: sanitizeString(c.preheader, 200, '') } : {}),
    ...(c.templateId !== undefined ? { templateId: sanitizeString(c.templateId, 80, '') } : {}),
    ...(c.segmentFilter !== undefined
      ? { segmentFilter: sanitizeString(c.segmentFilter, 200, '') }
      : {}),
    ...(c.scheduledAt !== undefined
      ? { scheduledAt: sanitizeString(c.scheduledAt, 120, '') }
      : {}),
    ...(c.blocksJson !== undefined ? { blocksJson: String(c.blocksJson).slice(0, 12000) } : {}),
    ...(c.overrideFromIdentity !== undefined
      ? { overrideFromIdentity: sanitizeString(c.overrideFromIdentity, 150, '') }
      : {}),
  });
}

export function serializeAssetForFirestore(uid: string, a: Partial<CaptureAsset>) {
  const assetType = VALID_ASSET_TYPES.has(a.assetType as CaptureAssetType)
    ? (a.assetType as CaptureAssetType)
    : 'inline_form';
  const status = VALID_ASSET_STATUS.has(a.status as AssetStatus)
    ? (a.status as AssetStatus)
    : 'published';

  return stripUndefinedShallow({
    workspaceId: uid,
    ownerId: uid,
    title: sanitizeString(a.title || '', 120, 'Lead Capture Form'),
    assetType,
    slug: sanitizeString(a.slug || '', 80, generateSafeId('form')),
    headline: sanitizeString(a.headline || '', 160, 'Get Started Today'),
    subheadline: sanitizeString(a.subheadline || '', 280, ''),
    ctaText: sanitizeString(a.ctaText || '', 60, 'Submit'),
    ...(a.redirectUrl !== undefined
      ? { redirectUrl: sanitizeString(a.redirectUrl, 500, '') }
      : {}),
    ...(a.toolFormat !== undefined ? { toolFormat: sanitizeString(a.toolFormat, 32, '') } : {}),
    targetList: sanitizeString(a.targetList || '', 80, 'General Contacts'),
    requireDoubleOptIn: Boolean(a.requireDoubleOptIn),
    status,
    viewsCount: Math.max(0, Math.round(Number(a.viewsCount) || 0)),
    submissionsCount: Math.max(0, Math.round(Number(a.submissionsCount) || 0)),
  });
}

export function serializeChatbotForFirestore(uid: string, b: Partial<ChatbotFlow>) {
  const matchType = VALID_BOT_MATCH.has(b.matchType as ChatbotMatchType)
    ? (b.matchType as ChatbotMatchType)
    : 'contains';
  const status = VALID_BOT_STATUS.has(b.status as ChatbotStatus)
    ? (b.status as ChatbotStatus)
    : 'active';
  const menuOptions = sanitizeStringArray(b.menuOptions || ['Talk to support'], 5, 80);
  if (menuOptions.length === 0) menuOptions.push('Talk to support');

  return {
    workspaceId: uid,
    ownerId: uid,
    name: sanitizeString(b.name || '', 100, 'WhatsApp Assistant'),
    triggerKeyword: sanitizeString(b.triggerKeyword || '', 60, 'start'),
    matchType,
    welcomeMessage: sanitizeString(
      b.welcomeMessage || '',
      500,
      'Hello! How can we help you today?'
    ),
    menuOptions,
    handoffToHuman: Boolean(b.handoffToHuman),
    status,
    sessionsCount: Math.max(0, Math.round(Number(b.sessionsCount) || 0)),
    resolvedCount: Math.max(0, Math.round(Number(b.resolvedCount) || 0)),
  };
}

export function serializeTaskForFirestore(uid: string, t: Partial<TaskItem>) {
  const category = VALID_TASK_CATS.has(t.category as TaskCategory)
    ? (t.category as TaskCategory)
    : 'follow_up';
  const priority = VALID_TASK_PRIORITIES.has(t.priority as TaskPriority)
    ? (t.priority as TaskPriority)
    : 'medium';
  const status = VALID_TASK_STATUS.has(t.status as TaskStatus)
    ? (t.status as TaskStatus)
    : 'pending';

  return {
    workspaceId: uid,
    ownerId: uid,
    title: sanitizeString(t.title || '', 160, 'Follow up with lead'),
    category,
    priority,
    dueDate: sanitizeString(t.dueDate || '', 40, new Date().toISOString().slice(0, 10)),
    relatedEntity: sanitizeString(t.relatedEntity || '', 100, ''),
    status,
  };
}

export function serializeActivityForFirestore(uid: string, act: Partial<ActivityLog>) {
  const eventType = VALID_ACTIVITY_EVENTS.has(act.eventType as ActivityEventType)
    ? (act.eventType as ActivityEventType)
    : 'automation_triggered';
  const channel = VALID_ACTIVITY_CHANNELS.has(act.channel as ActivityChannel)
    ? (act.channel as ActivityChannel)
    : 'system';

  return {
    workspaceId: uid,
    ownerId: uid,
    eventType,
    title: sanitizeString(act.title || '', 160, 'Activity recorded'),
    detail: sanitizeString(act.detail || '', 280, 'Workspace event recorded'),
    channel,
  };
}

export function serializeListForFirestore(uid: string, l: Partial<AudienceList>) {
  const category = VALID_LIST_CATS.has(l.category as ListCategory)
    ? (l.category as ListCategory)
    : 'custom';
  const defaultConsent = VALID_CONSENT.has(l.defaultConsent as ConsentStatus)
    ? (l.defaultConsent as ConsentStatus)
    : 'opted_in';
  const colorAccent = VALID_LIST_COLORS.has(l.colorAccent as ListColorAccent)
    ? (l.colorAccent as ListColorAccent)
    : 'emerald';

  return stripUndefinedShallow({
    workspaceId: uid,
    ownerId: uid,
    name: sanitizeString(l.name || '', 100, 'Untitled List'),
    description: sanitizeString(l.description || '', 300, ''),
    category,
    defaultConsent,
    defaultTags: sanitizeStringArray(l.defaultTags || [], 10, 32),
    colorAccent,
    ...(l.killSwitchEnabled !== undefined
      ? { killSwitchEnabled: Boolean(l.killSwitchEnabled) }
      : {}),
    ...(l.killSwitchTags !== undefined
      ? { killSwitchTags: sanitizeStringArray(l.killSwitchTags, 10, 32) }
      : {}),
  });
}

export function serializeAutoResponderForFirestore(uid: string, r: Partial<AutoResponder>) {
  const channel = VALID_CHANNELS.has(r.channel as ChannelType)
    ? (r.channel as ChannelType)
    : 'whatsapp';
  const status = VALID_RESPONDER_STATUS.has(r.status as AutoResponderStatus)
    ? (r.status as AutoResponderStatus)
    : 'live';
  const matchType =
    r.matchType && VALID_RESPONDER_MATCH.has(r.matchType) ? r.matchType : undefined;

  return stripUndefinedShallow({
    workspaceId: uid,
    ownerId: uid,
    name: sanitizeString(r.name || '', 120, 'Auto Responder'),
    targetList: sanitizeString(r.targetList || '', 100, 'General Contacts'),
    triggerMessage: sanitizeString(r.triggerMessage || '', 500, 'hello'),
    responseMessage: sanitizeString(
      r.responseMessage || '',
      15000,
      'Thanks for reaching out! We will reply shortly.'
    ),
    channel,
    ...(matchType ? { matchType } : {}),
    ...(r.subjectLine !== undefined
      ? { subjectLine: sanitizeString(r.subjectLine, 160, '') }
      : {}),
    status,
    triggeredCount: Math.max(0, Math.round(Number(r.triggeredCount) || 0)),
    sentCount: Math.max(0, Math.round(Number(r.sentCount) || 0)),
  });
}

export function serializeInboxThreadForFirestore(uid: string, t: Partial<InboxThread>) {
  const channel = VALID_CHANNELS.has(t.channel as ChannelType)
    ? (t.channel as ChannelType)
    : 'whatsapp';
  const status = VALID_INBOX_STATUS.has(t.status as InboxThreadStatus)
    ? (t.status as InboxThreadStatus)
    : 'unread';
  const lastSender =
    t.lastSender === 'operator' || t.lastSender === 'autoresponder'
      ? t.lastSender
      : 'lead';

  const rawJson = String(t.messagesJson || '[]').slice(0, 20000);
  const messagesJson = rawJson.length >= 2 ? rawJson : '[]';

  return {
    workspaceId: uid,
    ownerId: uid,
    leadName: sanitizeString(t.leadName || '', 120, 'Lead Contact'),
    leadEmail: sanitizeString(t.leadEmail || '', 150, ''),
    leadPhone: sanitizeString(t.leadPhone || '', 40, ''),
    listName: sanitizeString(t.listName || '', 100, 'General Contacts'),
    channel,
    subjectOrContext: sanitizeString(t.subjectOrContext || '', 160, 'Direct Conversation'),
    lastLeadMessage: sanitizeString(t.lastLeadMessage || '', 2000, 'Message received'),
    lastMessagePreview: sanitizeString(t.lastMessagePreview || '', 500, 'New conversation'),
    lastSender,
    status,
    unreadCount: Math.max(0, Math.round(Number(t.unreadCount) || 0)),
    messagesJson,
  };
}

// ============================================================================
// CORE FIRESTORE WRITE PRIMITIVES
// ============================================================================

function requireAuthenticatedUid(uid: string): boolean {
  return Boolean(uid && auth.currentUser && auth.currentUser.uid === uid);
}

export async function ensureWorkspaceRootAndProfile(
  uid: string,
  workspace: Partial<Workspace>,
  privateProfile: Partial<UserPrivateProfile>,
  fallbackEmail: string
): Promise<boolean> {
  if (!requireAuthenticatedUid(uid)) return false;

  const wsRef = doc(db, 'workspaces', uid);
  try {
    const wsSnap = await getDoc(wsRef);
    if (!wsSnap.exists()) {
      await setDoc(wsRef, {
        ...serializeWorkspaceForFirestore(uid, workspace),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${uid}`);
  }

  const profileRef = doc(db, 'users', uid, 'private', 'default');
  try {
    const profSnap = await getDoc(profileRef);
    if (!profSnap.exists()) {
      await setDoc(profileRef, {
        ...serializePrivateProfileForFirestore(uid, fallbackEmail, privateProfile),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/private/default`);
  }

  return true;
}

export async function upsertWorkspaceRoot(
  uid: string,
  workspace: Partial<Workspace>
): Promise<void> {
  if (!requireAuthenticatedUid(uid)) return;
  const wsRef = doc(db, 'workspaces', uid);
  try {
    const snap = await getDoc(wsRef);
    const data = serializeWorkspaceForFirestore(uid, workspace);
    if (!snap.exists()) {
      await setDoc(wsRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const { ownerId: _ignoredOwner, ...updatable } = data;
      await updateDoc(wsRef, {
        ...updatable,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${uid}`);
  }
}

export async function upsertPrivateProfile(
  uid: string,
  fallbackEmail: string,
  profile: Partial<UserPrivateProfile>
): Promise<void> {
  if (!requireAuthenticatedUid(uid)) return;
  const profileRef = doc(db, 'users', uid, 'private', 'default');
  try {
    const snap = await getDoc(profileRef);
    const data = serializePrivateProfileForFirestore(uid, fallbackEmail, profile);
    if (!snap.exists()) {
      await setDoc(profileRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const { ownerId: _ignoredOwner, ...updatable } = data;
      await updateDoc(profileRef, {
        ...updatable,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/private/default`);
  }
}

export type FirestoreCollectionName =
  | 'automations'
  | 'lists'
  | 'contacts'
  | 'campaigns'
  | 'assets'
  | 'chatbots'
  | 'autoresponders'
  | 'inbox_threads'
  | 'tasks';

function serializeByCollection(
  collectionName: FirestoreCollectionName,
  uid: string,
  item: Record<string, any>
): Record<string, unknown> {
  switch (collectionName) {
    case 'automations':
      return serializeAutomationForFirestore(uid, item);
    case 'lists':
      return serializeListForFirestore(uid, item);
    case 'contacts':
      return serializeContactForFirestore(uid, item);
    case 'campaigns':
      return serializeCampaignForFirestore(uid, item);
    case 'assets':
      return serializeAssetForFirestore(uid, item);
    case 'chatbots':
      return serializeChatbotForFirestore(uid, item);
    case 'autoresponders':
      return serializeAutoResponderForFirestore(uid, item);
    case 'inbox_threads':
      return serializeInboxThreadForFirestore(uid, item);
    case 'tasks':
      return serializeTaskForFirestore(uid, item);
  }
}

export async function upsertCollectionDoc(
  collectionName: FirestoreCollectionName,
  uid: string,
  docId: string,
  item: Record<string, any>
): Promise<void> {
  if (!requireAuthenticatedUid(uid)) return;
  const validId = toValidDocId(docId, collectionName.slice(0, 3));
  const ref = doc(db, collectionName, validId);
  try {
    const snap = await getDoc(ref);
    const serialized = serializeByCollection(collectionName, uid, item);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...serialized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const { ownerId: _o, workspaceId: _w, ...updatable } = serialized;
      await updateDoc(ref, {
        ...updatable,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${validId}`);
  }
}

export async function deleteCollectionDoc(
  collectionName: FirestoreCollectionName | 'activities',
  uid: string,
  docId: string
): Promise<void> {
  if (!requireAuthenticatedUid(uid)) return;
  const validId = toValidDocId(docId, collectionName.slice(0, 3));
  const ref = doc(db, collectionName, validId);
  try {
    await deleteDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${validId}`);
  }
}

export async function upsertMemberDoc(
  uid: string,
  memberId: string,
  member: Partial<WorkspaceMember>
): Promise<void> {
  if (!requireAuthenticatedUid(uid)) return;
  const validId = toValidDocId(memberId, 'mbr');
  const ref = doc(db, 'workspaces', uid, 'members', validId);
  try {
    const snap = await getDoc(ref);
    const serialized = serializeMemberForFirestore(uid, member);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...serialized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const { ownerId: _o, workspaceId: _w, memberEmail: _e, ...updatable } = serialized;
      await updateDoc(ref, {
        ...updatable,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.WRITE,
      `workspaces/${uid}/members/${validId}`
    );
  }
}

export async function deleteMemberDoc(uid: string, memberId: string): Promise<void> {
  if (!requireAuthenticatedUid(uid)) return;
  const validId = toValidDocId(memberId, 'mbr');
  const ref = doc(db, 'workspaces', uid, 'members', validId);
  try {
    await deleteDoc(ref);
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.DELETE,
      `workspaces/${uid}/members/${validId}`
    );
  }
}

export async function appendActivityDoc(
  uid: string,
  activity: Partial<ActivityLog> & { id?: string }
): Promise<void> {
  if (!requireAuthenticatedUid(uid)) return;
  const validId = toValidDocId(activity.id, 'act');
  const ref = doc(db, 'activities', validId);
  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) return; // activities are append-only (update disallowed)
    await setDoc(ref, {
      ...serializeActivityForFirestore(uid, activity),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `activities/${validId}`);
  }
}

// ============================================================================
// HYDRATE & AUTO-MERGE GUEST DRAFTS ON SIGN-IN
// ============================================================================

async function fetchOwnedCollection<
  T extends { id: string; createdAt?: unknown; updatedAt?: unknown }
>(colName: string, uid: string): Promise<T[]> {
  try {
    const q = query(collection(db, colName), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => docToEntity<T>(d.id, d.data()));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, colName);
  }
}

function docToEntity<T extends { id: string; createdAt?: unknown; updatedAt?: unknown }>(
  id: string,
  data: Record<string, any>
): T {
  return {
    ...data,
    id,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  } as T;
}

function shouldMergeGuestEntity(
  id: string,
  dirtyIds: string[],
  customPrefixes: string[]
): boolean {
  if (dirtyIds.includes(id)) return true;
  return customPrefixes.some((pfx) => id.startsWith(pfx));
}

function mergeByIdNewest<T extends { id: string; updatedAt?: unknown; createdAt?: unknown }>(
  cloudItems: T[],
  guestItems: T[]
): T[] {
  const map = new Map<string, T>();
  cloudItems.forEach((item) => map.set(item.id, item));
  guestItems.forEach((g) => {
    const existing = map.get(g.id);
    if (!existing) {
      map.set(g.id, g);
    } else {
      const gTime = parseTimestampMs(g.updatedAt) || parseTimestampMs(g.createdAt);
      const cTime =
        parseTimestampMs(existing.updatedAt) || parseTimestampMs(existing.createdAt);
      if (gTime > cTime) {
        map.set(g.id, g);
      }
    }
  });
  return sortByRecent(Array.from(map.values()));
}

export async function hydrateAndMergeWorkspaceFromFirestore(params: {
  uid: string;
  email: string;
  displayName: string;
  localGuestSnapshot?: WorkspaceSnapshot | null;
}): Promise<{ snapshot: WorkspaceSnapshot; mergedGuestCount: number }> {
  const { uid, email, displayName, localGuestSnapshot } = params;
  if (!requireAuthenticatedUid(uid)) {
    throw new Error('Cannot hydrate Firestore workspace without active Firebase Auth session.');
  }

  const starter = buildStarterWorkspaceSnapshot(uid, email, displayName);
  const bucket = getGuestDirtyBucket();

  // 1. Check / create root workspace & private profile FIRST (required by isWorkspaceOwner rules!)
  const wsRef = doc(db, 'workspaces', uid);
  const profRef = doc(db, 'users', uid, 'private', 'default');

  let wsSnapData: Workspace | null = null;
  let hadExistingWorkspace = false;
  try {
    const wsSnap = await getDoc(wsRef);
    if (wsSnap.exists()) {
      hadExistingWorkspace = true;
      wsSnapData = docToEntity<Workspace>(wsSnap.id, wsSnap.data());
    } else {
      const seedWs =
        bucket.workspaceDirty && localGuestSnapshot?.workspace
          ? { ...localGuestSnapshot.workspace, id: uid, ownerId: uid }
          : starter.workspace;
      await setDoc(wsRef, {
        ...serializeWorkspaceForFirestore(uid, seedWs),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      wsSnapData = { ...seedWs, id: uid, ownerId: uid };
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `workspaces/${uid}`);
  }

  let profSnapData: UserPrivateProfile = starter.privateProfile;
  try {
    const profSnap = await getDoc(profRef);
    if (profSnap.exists()) {
      profSnapData = docToEntity<UserPrivateProfile>(profSnap.id, profSnap.data());
    } else {
      const seedProf =
        bucket.privateProfileDirty && localGuestSnapshot?.privateProfile
          ? { ...localGuestSnapshot.privateProfile, id: 'default', ownerId: uid }
          : starter.privateProfile;
      await setDoc(profRef, {
        ...serializePrivateProfileForFirestore(uid, email, seedProf),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      profSnapData = { ...seedProf, id: 'default', ownerId: uid };
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${uid}/private/default`);
  }

  // 2. Fetch all collections in parallel using ownerId == uid
  let cloudMembers: WorkspaceMember[] = [];
  try {
    const mQ = query(
      collection(db, 'workspaces', uid, 'members'),
      where('ownerId', '==', uid)
    );
    const mSnap = await getDocs(mQ);
    cloudMembers = mSnap.docs.map((d) => docToEntity<WorkspaceMember>(d.id, d.data()));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `workspaces/${uid}/members`);
  }

  const [
    cloudAutomations,
    cloudLists,
    cloudContacts,
    cloudCampaigns,
    cloudAssets,
    cloudChatbots,
    cloudAutoResponders,
    cloudInboxThreads,
    cloudTasks,
    cloudActivities,
  ] = await Promise.all([
    fetchOwnedCollection<Automation>('automations', uid),
    fetchOwnedCollection<AudienceList>('lists', uid),
    fetchOwnedCollection<Contact>('contacts', uid),
    fetchOwnedCollection<Campaign>('campaigns', uid),
    fetchOwnedCollection<CaptureAsset>('assets', uid),
    fetchOwnedCollection<ChatbotFlow>('chatbots', uid),
    fetchOwnedCollection<AutoResponder>('autoresponders', uid),
    fetchOwnedCollection<InboxThread>('inbox_threads', uid),
    fetchOwnedCollection<TaskItem>('tasks', uid),
    fetchOwnedCollection<ActivityLog>('activities', uid),
  ]);

  // 3. Identify guest items to auto-merge into cloud
  let mergedGuestCount = 0;
  const writes: Promise<void>[] = [];

  const guestAutomations = (localGuestSnapshot?.automations || [])
    .filter((a) => shouldMergeGuestEntity(a.id, bucket.automations, ['aut_']))
    .map((a) => ({ ...a, workspaceId: uid, ownerId: uid }));

  const guestLists = (localGuestSnapshot?.lists || [])
    .filter((l) => shouldMergeGuestEntity(l.id, bucket.lists, ['lst_']))
    .map((l) => ({ ...l, workspaceId: uid, ownerId: uid }));

  const guestContacts = (localGuestSnapshot?.contacts || [])
    .filter((c) => shouldMergeGuestEntity(c.id, bucket.contacts, ['cnt_']))
    .map((c) => ({ ...c, workspaceId: uid, ownerId: uid }));

  const guestCampaigns = (localGuestSnapshot?.campaigns || [])
    .filter((c) => shouldMergeGuestEntity(c.id, bucket.campaigns, ['cmp_']))
    .map((c) => ({ ...c, workspaceId: uid, ownerId: uid }));

  const guestAssets = (localGuestSnapshot?.assets || [])
    .filter((a) => shouldMergeGuestEntity(a.id, bucket.assets, ['ast_']))
    .map((a) => ({ ...a, workspaceId: uid, ownerId: uid }));

  const guestChatbots = (localGuestSnapshot?.chatbots || [])
    .filter((b) => shouldMergeGuestEntity(b.id, bucket.chatbots, ['bot_']))
    .map((b) => ({ ...b, workspaceId: uid, ownerId: uid }));

  const guestResponders = (localGuestSnapshot?.autoResponders || [])
    .filter((r) => shouldMergeGuestEntity(r.id, bucket.autoResponders, ['rsp_']))
    .map((r) => ({ ...r, workspaceId: uid, ownerId: uid }));

  const guestThreads = (localGuestSnapshot?.inboxThreads || [])
    .filter((t) => shouldMergeGuestEntity(t.id, bucket.inboxThreads, ['thr_']))
    .map((t) => ({ ...t, workspaceId: uid, ownerId: uid }));

  const guestTasks = (localGuestSnapshot?.tasks || [])
    .filter((t) => shouldMergeGuestEntity(t.id, bucket.tasks, ['tsk_']))
    .map((t) => ({ ...t, workspaceId: uid, ownerId: uid }));

  const guestActivities = (localGuestSnapshot?.activities || [])
    .filter((a) => shouldMergeGuestEntity(a.id, bucket.activities, ['act_']))
    .map((a) => ({ ...a, workspaceId: uid, ownerId: uid }));

  const guestMembers = (localGuestSnapshot?.members || [])
    .filter((m) => shouldMergeGuestEntity(m.id, bucket.members, ['mbr_']))
    .map((m) => ({ ...m, workspaceId: uid, ownerId: uid }));

  const pushGuestDocs = <T extends { id: string }>(
    colName: FirestoreCollectionName,
    items: T[]
  ) => {
    items.forEach((item) => {
      mergedGuestCount += 1;
      writes.push(upsertCollectionDoc(colName, uid, item.id, item));
    });
  };

  pushGuestDocs('automations', guestAutomations);
  pushGuestDocs('lists', guestLists);
  pushGuestDocs('contacts', guestContacts);
  pushGuestDocs('campaigns', guestCampaigns);
  pushGuestDocs('assets', guestAssets);
  pushGuestDocs('chatbots', guestChatbots);
  pushGuestDocs('autoresponders', guestResponders);
  pushGuestDocs('inbox_threads', guestThreads);
  pushGuestDocs('tasks', guestTasks);
  guestMembers.forEach((m) => {
    mergedGuestCount += 1;
    writes.push(upsertMemberDoc(uid, m.id, m));
  });
  guestActivities.forEach((act) => {
    mergedGuestCount += 1;
    writes.push(appendActivityDoc(uid, act));
  });

  // 4. Seed starter defaults ONLY if brand-new cloud workspace has zero items
  let finalLists = mergeByIdNewest(cloudLists, guestLists);
  if (!hadExistingWorkspace && finalLists.length === 0) {
    finalLists = starter.lists;
    starter.lists.forEach((l) => {
      writes.push(upsertCollectionDoc('lists', uid, l.id, l));
    });
  }

  let finalAutomations = mergeByIdNewest(cloudAutomations, guestAutomations);
  if (!hadExistingWorkspace && finalAutomations.length === 0) {
    finalAutomations = starter.automations;
    starter.automations.forEach((a) => {
      writes.push(upsertCollectionDoc('automations', uid, a.id, a));
    });
  }

  let finalMembers = mergeByIdNewest(cloudMembers, guestMembers);
  if (!hadExistingWorkspace && finalMembers.length === 0) {
    finalMembers = starter.members;
    starter.members.forEach((m) => {
      writes.push(upsertMemberDoc(uid, m.id, m));
    });
  }

  if (writes.length > 0) {
    await Promise.all(writes);
  }

  if (mergedGuestCount > 0) {
    clearGuestDirtyBucket();
    clearLocalWorkspaceSnapshot('default_workspace');
  }

  const finalSnapshot = normalizeWorkspaceSnapshot({
    workspace: wsSnapData || starter.workspace,
    privateProfile: profSnapData,
    members: finalMembers,
    contacts: mergeByIdNewest(cloudContacts, guestContacts),
    lists: finalLists,
    automations: finalAutomations,
    autoResponders: mergeByIdNewest(cloudAutoResponders, guestResponders),
    inboxThreads: mergeByIdNewest(cloudInboxThreads, guestThreads),
    campaigns: mergeByIdNewest(cloudCampaigns, guestCampaigns),
    assets: mergeByIdNewest(cloudAssets, guestAssets),
    chatbots: mergeByIdNewest(cloudChatbots, guestChatbots),
    tasks: mergeByIdNewest(cloudTasks, guestTasks),
    activities: mergeActivities(cloudActivities, guestActivities).slice(0, 150),
    updatedAt: new Date().toISOString(),
  });

  return {
    snapshot: finalSnapshot,
    mergedGuestCount,
  };
}

// ============================================================================
// REALTIME CROSS-DEVICE SYNC SUBSCRIPTIONS
// ============================================================================

export function subscribeToWorkspaceCollections(
  uid: string,
  onPatchSnapshot: (patch: (prev: WorkspaceSnapshot) => WorkspaceSnapshot) => void,
  onSyncError?: (err: Error) => void
): () => void {
  if (!requireAuthenticatedUid(uid)) {
    return () => {};
  }

  const unsubs: Array<() => void> = [];

  const listenCollection = <
    T extends { id: string; createdAt?: unknown; updatedAt?: unknown }
  >(
    colName: string,
    snapshotKey: keyof Pick<
      WorkspaceSnapshot,
      | 'automations'
      | 'lists'
      | 'contacts'
      | 'campaigns'
      | 'assets'
      | 'chatbots'
      | 'autoResponders'
      | 'inboxThreads'
      | 'tasks'
      | 'activities'
    >
  ) => {
    const q = query(collection(db, colName), where('ownerId', '==', uid));
    let skippedInitial = false;
    const unsub = onSnapshot(
      q,
      (snap) => {
        // Initial hydration was already executed before subscribing; avoid clobbering optimistic writes on first emit
        if (!skippedInitial) {
          skippedInitial = true;
          if (snap.empty) return;
        }
        if (snap.metadata.hasPendingWrites) return;
        const docs = sortByRecent(
          snap.docs.map((d) => docToEntity<T>(d.id, d.data()))
        );
        onPatchSnapshot((prev) => ({
          ...prev,
          [snapshotKey]:
            snapshotKey === 'activities'
              ? (mergeActivities(docs as unknown as ActivityLog[], []).slice(0, 150) as any)
              : docs,
          updatedAt: new Date().toISOString(),
        }));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, colName);
        } catch (wrapped) {
          onSyncError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );
    unsubs.push(unsub);
  };

  // Root workspace doc listener
  unsubs.push(
    onSnapshot(
      doc(db, 'workspaces', uid),
      (snap) => {
        if (!snap.exists() || snap.metadata.hasPendingWrites) return;
        const remoteWs = docToEntity<Workspace>(snap.id, snap.data());
        onPatchSnapshot((prev) => ({
          ...prev,
          workspace: {
            ...prev.workspace,
            ...remoteWs,
          },
        }));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, `workspaces/${uid}`);
        } catch (wrapped) {
          onSyncError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    )
  );

  // Private profile listener
  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid, 'private', 'default'),
      (snap) => {
        if (!snap.exists() || snap.metadata.hasPendingWrites) return;
        const remoteProf = docToEntity<UserPrivateProfile>(snap.id, snap.data());
        onPatchSnapshot((prev) => ({
          ...prev,
          privateProfile: {
            ...prev.privateProfile,
            ...remoteProf,
          },
        }));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, `users/${uid}/private/default`);
        } catch (wrapped) {
          onSyncError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    )
  );

  listenCollection<Automation>('automations', 'automations');
  listenCollection<AudienceList>('lists', 'lists');
  listenCollection<Contact>('contacts', 'contacts');
  listenCollection<Campaign>('campaigns', 'campaigns');
  listenCollection<CaptureAsset>('assets', 'assets');
  listenCollection<ChatbotFlow>('chatbots', 'chatbots');
  listenCollection<AutoResponder>('autoresponders', 'autoResponders');
  listenCollection<InboxThread>('inbox_threads', 'inboxThreads');
  listenCollection<TaskItem>('tasks', 'tasks');
  listenCollection<ActivityLog>('activities', 'activities');

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {
        // Ignore teardown errors
      }
    });
  };
}
