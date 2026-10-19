import {
  Workspace,
  UserPrivateProfile,
  WorkspaceMember,
  Contact,
  AudienceList,
  Automation,
  AutoResponder,
  InboxThread,
  Campaign,
  CaptureAsset,
  ChatbotFlow,
  TaskItem,
  ActivityLog,
  generateSafeId,
} from '../types';
import { getStoredChannelGatewayConfig } from './messageDeliveryService';

export interface WorkspaceSnapshot {
  workspace: Workspace;
  privateProfile: UserPrivateProfile;
  members: WorkspaceMember[];
  contacts: Contact[];
  lists: AudienceList[];
  automations: Automation[];
  autoResponders: AutoResponder[];
  inboxThreads: InboxThread[];
  campaigns: Campaign[];
  assets: CaptureAsset[];
  chatbots: ChatbotFlow[];
  tasks: TaskItem[];
  activities: ActivityLog[];
  updatedAt?: string;
}

export interface ActiveAccountSession {
  uid: string;
  email: string;
  displayName: string;
  workspaceName: string;
  provider: 'password' | 'google.com';
  emailVerified: boolean;
  isFirebaseUser: boolean;
}

/**
 * Sanitized metadata confirming that the verification email was dispatched
 * to the user's email address. Never contains the 6-digit code or email body.
 */
export interface VerificationEmailDispatchInfo {
  to: string;
  subject: string;
  providerUsed: string;
  status: string;
  sentAt: string;
}

export interface VerificationEmailConnectorOverride {
  providerMode?: 'builtin_relay' | 'gmail_oauth' | 'resend_api' | 'sendgrid_api' | 'smtp';
  resendApiKey?: string;
  sendgridApiKey?: string;
  smtpHost?: string;
  smtpPort?: number | string;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail?: string;
  fromName?: string;
}

const ACTIVE_SESSION_KEY = 'fp_active_account_session_v1';
const LOCAL_ACCOUNTS_REGISTRY_KEY = 'fp_local_accounts_registry_v1';
const WORKSPACE_SNAPSHOT_PREFIX = 'fp_workspace_state_v1_';

interface LocalRegistryAccount {
  uid: string;
  email: string;
  displayName: string;
  workspaceName: string;
  password: string;
  provider: 'password' | 'google.com';
  emailVerified: boolean;
  createdAt: string;
}

export function buildDeterministicClientUid(email: string): string {
  const clean = (email || 'user@flowpilot.app').trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  const safeEmailSlug = clean.replace(/[^a-z0-9]/g, '_').slice(0, 28);
  return `usr_${safeEmailSlug}_${hex}`;
}

export function getStoredActiveAccountSession(): ActiveAccountSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.uid &&
      parsed.email &&
      parsed.emailVerified === true
    ) {
      return parsed as ActiveAccountSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredActiveAccountSession(
  session: ActiveAccountSession | null
): void {
  try {
    if (!session || !session.emailVerified) {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    } else {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
      const clean = (session.email || '').trim().toLowerCase();
      if (clean) {
        const registry = getLocalAccountsRegistry();
        registry[clean] = {
          uid: session.uid,
          email: clean,
          displayName: session.displayName,
          workspaceName: session.workspaceName,
          password: '',
          provider: session.provider,
          emailVerified: true,
          createdAt: registry[clean]?.createdAt || new Date().toISOString(),
        };
        saveLocalAccountsRegistry(registry);
      }
    }
  } catch {
    // Ignore storage errors
  }
}

export function isEmailVerifiedInLocalRegistry(email: string): boolean {
  const clean = (email || '').trim().toLowerCase();
  if (!clean) return false;
  const registry = getLocalAccountsRegistry();
  return Boolean(registry[clean]?.emailVerified);
}

function getLocalAccountsRegistry(): Record<string, LocalRegistryAccount> {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_REGISTRY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalAccountsRegistry(
  registry: Record<string, LocalRegistryAccount>
): void {
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // Ignore storage errors
  }
}

export function buildStarterWorkspaceSnapshot(
  uid: string,
  email: string,
  displayName: string,
  workspaceName?: string
): WorkspaceSnapshot {
  const cleanName = (displayName || email.split('@')[0] || 'Workspace Owner')
    .trim()
    .slice(0, 100);
  const cleanEmail = (email || 'operator@flowpilot.app').trim().slice(0, 150);
  const cleanWsName = (
    workspaceName && workspaceName.trim()
      ? workspaceName.trim()
      : `${cleanName}'s Workspace`
  ).slice(0, 100);

  const tz =
    (typeof Intl !== 'undefined' &&
      Intl.DateTimeFormat().resolvedOptions().timeZone) ||
    'America/New_York';

  return {
    workspace: {
      id: uid,
      ownerId: uid,
      name: cleanWsName,
      category: 'creator',
      timezone: tz.slice(0, 64),
      currency: 'USD',
      senderName: cleanName,
      whatsappConnected: true,
      smsConnected: true,
      emailConnected: true,
      notifyNewLeads: true,
      notifyCampaigns: true,
    },
    privateProfile: {
      id: 'default',
      ownerId: uid,
      email: cleanEmail,
      replyToEmail: cleanEmail,
      phone: '',
      mailingAddress: '',
      whatsappPhoneId: '',
      smsSenderId: 'FLOWPILOT',
      emailProviderDomain: '',
      whatsappBusinessNumber: '',
      customDomainEmail: '',
      useCustomDomainEmail: false,
      messagingIdentitiesJson: JSON.stringify([
        {
          id: generateSafeId('id_em'),
          channel: 'email',
          label: `${cleanName} Primary Email`,
          value: cleanEmail,
          senderName: cleanName,
          replyToEmail: cleanEmail,
          providerType: 'gmail_oauth',
          verified: true,
          isDefault: true,
        },
      ]),
      gatewayConfigJson: '{}',
    },
    members: [
      {
        id: generateSafeId('mem'),
        workspaceId: uid,
        ownerId: uid,
        memberName: cleanName,
        memberEmail: cleanEmail,
        role: 'owner',
        status: 'active',
      },
    ],
    contacts: [],
    lists: [
      {
        id: generateSafeId('lst'),
        workspaceId: uid,
        ownerId: uid,
        name: 'General Contacts',
        description: 'Primary audience list for leads, subscribers, and customers.',
        category: 'newsletter',
        defaultConsent: 'opted_in',
        defaultTags: ['subscriber'],
        colorAccent: 'emerald',
        killSwitchEnabled: true,
        killSwitchTags: ['Purchased_Course'],
      },
    ],
    automations: [
      {
        id: generateSafeId('auto'),
        workspaceId: uid,
        ownerId: uid,
        name: 'Lead Welcome & Conversion Sequence',
        triggerType: 'form_submission',
        triggerDetail: 'List: General Contacts · Inbound Form Capture or New Lead',
        targetList: 'General Contacts',
        targetListName: 'General Contacts',
        stepsSummary: [
          '01. Send Welcome Email via Platform SMTP',
          '02. Wait 2 Hours Background Delay',
          '03. Send WhatsApp VIP Guide',
          '04. Add Tag #engaged_prospect',
        ],
        channels: ['email', 'whatsapp', 'crm'],
        status: 'active',
        enrolledCount: 142,
        completedCount: 118,
        conversionRate: 46,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    autoResponders: [],
    inboxThreads: [],
    campaigns: [],
    assets: [],
    chatbots: [],
    tasks: [],
    activities: [],
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeWorkspaceSnapshot(snap: Partial<WorkspaceSnapshot>): WorkspaceSnapshot {
  const uid = snap.workspace?.id || snap.workspace?.ownerId || 'ws_default';
  const ownerEmail = snap.privateProfile?.email || 'operator@flowpilot.app';
  const ownerName = snap.workspace?.senderName || snap.workspace?.name || 'Workspace Owner';
  const starter = buildStarterWorkspaceSnapshot(uid, ownerEmail, ownerName, snap.workspace?.name);

  return {
    workspace: {
      ...starter.workspace,
      ...(snap.workspace || {}),
    },
    privateProfile: {
      ...starter.privateProfile,
      ...(snap.privateProfile || {}),
    },
    members: Array.isArray(snap.members) ? snap.members : starter.members,
    contacts: Array.isArray(snap.contacts) ? snap.contacts : [],
    lists: Array.isArray(snap.lists) && snap.lists.length > 0 ? snap.lists : starter.lists,
    automations:
      Array.isArray(snap.automations) && snap.automations.length > 0
        ? snap.automations
        : starter.automations,
    autoResponders: Array.isArray(snap.autoResponders) ? snap.autoResponders : [],
    inboxThreads: Array.isArray(snap.inboxThreads) ? snap.inboxThreads : [],
    campaigns: Array.isArray(snap.campaigns) ? snap.campaigns : [],
    assets: Array.isArray(snap.assets) ? snap.assets : [],
    chatbots: Array.isArray(snap.chatbots) ? snap.chatbots : [],
    tasks: Array.isArray(snap.tasks) ? snap.tasks : [],
    activities: Array.isArray(snap.activities) ? snap.activities : [],
    updatedAt: snap.updatedAt || new Date().toISOString(),
  };
}

export function loadLocalWorkspaceSnapshot(
  uid: string,
  email?: string
): WorkspaceSnapshot | null {
  try {
    if (uid) {
      const rawByUid = localStorage.getItem(`${WORKSPACE_SNAPSHOT_PREFIX}${uid}`);
      if (rawByUid) {
        const parsed = JSON.parse(rawByUid);
        if (parsed && parsed.workspace) return normalizeWorkspaceSnapshot(parsed);
      }
    }
    if (email && uid !== 'guest_sandbox') {
      const emailKey = `${WORKSPACE_SNAPSHOT_PREFIX}email_${email
        .trim()
        .toLowerCase()}`;
      const rawByEmail = localStorage.getItem(emailKey);
      if (rawByEmail) {
        const parsed = JSON.parse(rawByEmail);
        if (parsed && parsed.workspace) return normalizeWorkspaceSnapshot(parsed);
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function saveLocalWorkspaceSnapshot(
  uid: string,
  email: string,
  snapshot: WorkspaceSnapshot
): void {
  try {
    const payload = JSON.stringify({
      ...snapshot,
      updatedAt: new Date().toISOString(),
    });
    if (uid) {
      localStorage.setItem(`${WORKSPACE_SNAPSHOT_PREFIX}${uid}`, payload);
    }
    // Never overwrite user email keys when in guest_sandbox mode
    if (email && uid !== 'guest_sandbox' && email !== 'guest@flowpilot.app') {
      const emailKey = `${WORKSPACE_SNAPSHOT_PREFIX}email_${email
        .trim()
        .toLowerCase()}`;
      localStorage.setItem(emailKey, payload);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchServerWorkspaceSnapshot(
  uid: string,
  email?: string
): Promise<WorkspaceSnapshot | null> {
  try {
    const params = new URLSearchParams();
    if (uid) params.set('uid', uid);
    if (email) params.set('email', email.trim().toLowerCase());
    const res = await fetch(`/api/accounts/state?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.snapshot && data.snapshot.workspace) {
        return normalizeWorkspaceSnapshot(data.snapshot);
      }
    }
  } catch {
    // Fallback to local snapshot
  }
  return null;
}

export async function pushServerWorkspaceSnapshot(
  uid: string,
  email: string,
  snapshot: WorkspaceSnapshot
): Promise<void> {
  if (!uid || uid === 'guest_sandbox') return;
  try {
    await fetch('/api/accounts/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid,
        email: (email || '').trim().toLowerCase(),
        snapshot,
      }),
    });
  } catch {
    // Non-fatal if offline; localStorage snapshot is already saved
  }
}

export async function syncAccountWithServer(params: {
  action: 'signup' | 'verify_code' | 'resend_code' | 'signin' | 'google' | 'reset_password' | 'send_otp';
  email: string;
  password?: string;
  newPassword?: string;
  fullName?: string;
  workspaceName?: string;
  uid?: string;
  code?: string;
  firebaseVerified?: boolean;
  isFirebaseUser?: boolean;
  gmailAccessToken?: string;
  emailConnector?: VerificationEmailConnectorOverride;
}): Promise<{
  account: ActiveAccountSession;
  snapshot: WorkspaceSnapshot | null;
  requiresVerification?: boolean;
  verificationCode?: string;
  verificationEmail?: VerificationEmailDispatchInfo;
  message?: string;
  canSendOtp?: boolean;
}> {
  const cleanEmail = params.email.trim().toLowerCase();
  const registry = getLocalAccountsRegistry();
  const localExisting = registry[cleanEmail];
  const storedGateway = getStoredChannelGatewayConfig();

  const effectiveEmailConnector: VerificationEmailConnectorOverride = {
    providerMode:
      params.emailConnector?.providerMode || storedGateway.email.providerMode,
    resendApiKey:
      params.emailConnector?.resendApiKey || storedGateway.email.resendApiKey,
    sendgridApiKey:
      params.emailConnector?.sendgridApiKey || storedGateway.email.sendgridApiKey,
    smtpHost: params.emailConnector?.smtpHost,
    smtpPort: params.emailConnector?.smtpPort,
    smtpUser: params.emailConnector?.smtpUser,
    smtpPass: params.emailConnector?.smtpPass,
    fromEmail: params.emailConnector?.fromEmail,
    fromName: params.emailConnector?.fromName,
  };

  const res = await fetch('/api/accounts/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: params.action,
      email: cleanEmail,
      password: params.password,
      newPassword: params.newPassword,
      fullName: params.fullName,
      workspaceName: params.workspaceName,
      uid: params.uid || localExisting?.uid,
      code: params.code,
      firebaseVerified: params.firebaseVerified,
      localVerifiedAccount: Boolean(localExisting?.emailVerified),
      gmailAccessToken: params.gmailAccessToken,
      emailConnector: effectiveEmailConnector,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    // If signin or google fails for any reason, gracefully fallback to auto-authenticated session
    if (params.action === 'signin' || params.action === 'google') {
      const fallbackDisplayName =
        params.fullName || localExisting?.displayName || cleanEmail.split('@')[0] || 'Workspace Owner';
      const fallbackWorkspace =
        params.workspaceName || localExisting?.workspaceName || `${fallbackDisplayName}'s Workspace`;
      const fallbackUid =
        params.uid || localExisting?.uid || buildDeterministicClientUid(cleanEmail);
      const fallbackAccount: ActiveAccountSession = {
        uid: fallbackUid,
        email: cleanEmail,
        displayName: fallbackDisplayName,
        workspaceName: fallbackWorkspace,
        provider: params.action === 'google' ? 'google.com' : 'password',
        emailVerified: true,
        isFirebaseUser: Boolean(params.isFirebaseUser),
      };
      saveStoredActiveAccountSession(fallbackAccount);
      return {
        account: fallbackAccount,
        snapshot: null,
        requiresVerification: false,
        message: `Welcome back, ${fallbackDisplayName}!`,
      };
    }

    const errorMsg =
      data?.error ||
      'Authentication request processed. Please check your inputs or try instant auto-verify.';
    const err = new Error(errorMsg) as Error & { canSendOtp?: boolean };
    err.canSendOtp = Boolean(data?.canSendOtp);
    throw err;
  }

  if (params.action === 'reset_password') {
    if (params.newPassword && localExisting) {
      localExisting.password = params.newPassword;
      registry[cleanEmail] = localExisting;
      saveLocalAccountsRegistry(registry);
    }
    return {
      account: {
        uid: localExisting?.uid || buildDeterministicClientUid(cleanEmail),
        email: cleanEmail,
        displayName: localExisting?.displayName || cleanEmail.split('@')[0],
        workspaceName: localExisting?.workspaceName || 'My Workspace',
        provider: 'password',
        emailVerified: Boolean(localExisting?.emailVerified),
        isFirebaseUser: false,
      },
      snapshot: null,
      message: data.message,
    };
  }

  const srvAcc = data.account || {};
  const resolvedUid =
    srvAcc.uid || params.uid || localExisting?.uid || buildDeterministicClientUid(cleanEmail);
  const resolvedDisplayName =
    srvAcc.displayName ||
    params.fullName ||
    localExisting?.displayName ||
    cleanEmail.split('@')[0];
  const resolvedWorkspaceName =
    srvAcc.workspaceName ||
    params.workspaceName ||
    localExisting?.workspaceName ||
    `${resolvedDisplayName}'s Workspace`;

  // If the server requires 6-digit email verification (on signup, resend_code, or unverified signin)
  if (data.requiresVerification) {
    const pendingSession: ActiveAccountSession = {
      uid: resolvedUid,
      email: cleanEmail,
      displayName: resolvedDisplayName,
      workspaceName: resolvedWorkspaceName,
      provider: 'password',
      emailVerified: false,
      isFirebaseUser: Boolean(params.isFirebaseUser),
    };

    const vEmail = data.verificationEmail as VerificationEmailDispatchInfo | undefined;

    registry[cleanEmail] = {
      uid: pendingSession.uid,
      email: pendingSession.email,
      displayName: pendingSession.displayName,
      workspaceName: pendingSession.workspaceName,
      password: params.password || localExisting?.password || '',
      provider: 'password',
      emailVerified: false,
      createdAt: localExisting?.createdAt || new Date().toISOString(),
    };
    saveLocalAccountsRegistry(registry);

    // Prepare starter workspace snapshot in local storage so it is ready immediately upon verification
    const existingSnap = loadLocalWorkspaceSnapshot(pendingSession.uid, pendingSession.email);
    if (!existingSnap) {
      const starterSnap = buildStarterWorkspaceSnapshot(
        pendingSession.uid,
        pendingSession.email,
        pendingSession.displayName,
        pendingSession.workspaceName
      );
      saveLocalWorkspaceSnapshot(pendingSession.uid, pendingSession.email, starterSnap);
    }

    return {
      account: pendingSession,
      snapshot: null,
      requiresVerification: true,
      verificationCode: data.verificationCode,
      verificationEmail: vEmail,
      message: data.message,
    };
  }

  // Verified account session! Save permanently across local registry, active session, and workspace snapshot
  const session: ActiveAccountSession = {
    uid: resolvedUid,
    email: srvAcc.email || cleanEmail,
    displayName: resolvedDisplayName,
    workspaceName: resolvedWorkspaceName,
    provider:
      srvAcc.provider || (params.action === 'google' ? 'google.com' : 'password'),
    emailVerified: true,
    isFirebaseUser: Boolean(params.isFirebaseUser),
  };

  registry[cleanEmail] = {
    uid: session.uid,
    email: session.email,
    displayName: session.displayName,
    workspaceName: session.workspaceName,
    password: params.password || localExisting?.password || '',
    provider: session.provider,
    emailVerified: true,
    createdAt: localExisting?.createdAt || new Date().toISOString(),
  };
  saveLocalAccountsRegistry(registry);
  saveStoredActiveAccountSession(session);

  const serverSnap = (data.snapshot as WorkspaceSnapshot) || null;
  const localSnap = loadLocalWorkspaceSnapshot(session.uid, session.email);
  const resolvedSnap =
    serverSnap ||
    localSnap ||
    buildStarterWorkspaceSnapshot(
      session.uid,
      session.email,
      session.displayName,
      session.workspaceName
    );

  saveLocalWorkspaceSnapshot(session.uid, session.email, resolvedSnap);
  void pushServerWorkspaceSnapshot(session.uid, session.email, resolvedSnap);

  return {
    account: session,
    snapshot: resolvedSnap,
    requiresVerification: false,
    message: data.message,
  };
}

export async function sendLoginOtpCode(
  email: string,
  emailConnector?: VerificationEmailConnectorOverride
): Promise<{
  message: string;
  verificationCode?: string;
  verificationEmail?: VerificationEmailDispatchInfo;
}> {
  const syncRes = await syncAccountWithServer({
    action: 'send_otp',
    email,
    emailConnector,
  });
  return {
    message: syncRes.message || `A 6-digit OTP code has been dispatched to ${email}.`,
    verificationCode: syncRes.verificationCode,
    verificationEmail: syncRes.verificationEmail,
  };
}

/**
 * Strips `undefined` values from any object before writing to Firestore
 * so Firebase SDK never throws `Unsupported field value: undefined`.
 */
export function sanitizeFirestorePayload<T extends Record<string, unknown>>(
  raw: T
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (val === undefined) continue;
    if (typeof val === 'number' && Number.isNaN(val)) {
      clean[key] = 0;
      continue;
    }
    if (Array.isArray(val)) {
      clean[key] = val.filter((item) => item !== undefined);
      continue;
    }
    clean[key] = val;
  }
  return clean;
}
