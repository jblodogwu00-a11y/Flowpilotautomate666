import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
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
  Workspace,
  UserPrivateProfile,
  WorkspaceMember,
  generateSafeId,
} from './types';

export const DEMO_WORKSPACE: Workspace = {
  id: 'default_workspace',
  ownerId: 'default_workspace',
  name: 'My Workspace',
  category: 'creator',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  currency: 'USD',
  senderName: 'Workspace Operator',
  whatsappConnected: false,
  smsConnected: false,
  emailConnected: false,
  notifyNewLeads: true,
  notifyCampaigns: true,
};

export const DEMO_PRIVATE_PROFILE: UserPrivateProfile = {
  id: 'default',
  ownerId: 'default_workspace',
  email: 'user@example.com',
  replyToEmail: 'user@example.com',
  phone: '',
  mailingAddress: '',
  whatsappPhoneId: '',
  smsSenderId: '',
  emailProviderDomain: '',
  whatsappBusinessNumber: '',
  customDomainEmail: '',
  useCustomDomainEmail: false,
  messagingIdentitiesJson: '[]',
  gatewayConfigJson: '{}',
};

export const DEMO_MEMBERS: WorkspaceMember[] = [];
export const DEMO_CONTACTS: Contact[] = [];
export const DEMO_LISTS: AudienceList[] = [];
export const DEMO_AUTOMATIONS: Automation[] = [];
export const DEMO_AUTORESPONDERS: AutoResponder[] = [];
export const DEMO_INBOX_THREADS: InboxThread[] = [];
export const DEMO_CAMPAIGNS: Campaign[] = [];
export const DEMO_ASSETS: CaptureAsset[] = [];
export const DEMO_CHATBOTS: ChatbotFlow[] = [];
export const DEMO_TASKS: TaskItem[] = [];
export const DEMO_ACTIVITIES: ActivityLog[] = [];

// Signatures of previously seeded sample records so they can be automatically purged
const LEGACY_DEMO_CONTACT_EMAILS = new Set([
  'amara@kineticdesign.co',
  'j.thorne@northstaradvisory.uk',
  'sora@ateliermono.jp',
  'devon@brookscapital.io',
  'nadia@lumina-studio.ae',
  'lucas@meyerphoto.de',
  'camille@maisonlaurent.fr',
]);

const LEGACY_DEMO_LIST_NAMES = new Set([
  'Weekly Dispatch Subscribers',
  'Creator Accelerator Buyers',
  'High-Intent Coaching Leads',
  'Retainer Clients',
]);

const LEGACY_DEMO_AUTOMATION_NAMES = new Set([
  'Lead Magnet to High-Ticket Discovery Flow',
  'Post-Purchase Onboarding & VIP Tagging',
  'Inbound WhatsApp Keyword Router ("AUDIT")',
]);

const LEGACY_DEMO_CAMPAIGN_NAMES = new Set([
  'October Creator Systems Deep-Dive',
  'Live Workshop 15-Minute Starting Alert',
  'VIP Q4 Strategy Call Slot Notification',
]);

const LEGACY_DEMO_ASSET_SLUGS = new Set([
  'creator-growth-blueprint',
  'agency-funnel-audit',
  'inline-dispatch-form',
]);

const LEGACY_DEMO_BOT_NAMES = new Set([
  'Inbound Lead Qualification Concierge',
  'Customer Support & Cohort Access Helper',
]);

const LEGACY_DEMO_TASK_TITLES = new Set([
  'Follow up with Julian Thorne prior to Thursday discovery call',
  'Review WhatsApp Utility Template approval for Q4 Cohort',
  'Verify SPF/DKIM DNS alignment on mail.studiosovereign.io',
]);

const LEGACY_DEMO_ACTIVITY_TITLES = new Set([
  'Julian Thorne completed WhatsApp Qualification Flow ("AUDIT")',
  'Amara Nwosu upgraded to Customer ($1,450 LTV)',
  'Broadcast Dispatched: October Creator Systems Deep-Dive',
  'New Lead Captured via Creator Growth Blueprint LP',
]);

export async function purgeLegacyDemoDataFromFirestore(uid: string): Promise<void> {
  try {
    // 1. Purge legacy demo contacts
    const contactsSnap = await getDocs(
      query(collection(db, 'contacts'), where('ownerId', '==', uid))
    );
    for (const d of contactsSnap.docs) {
      const data = d.data();
      if (LEGACY_DEMO_CONTACT_EMAILS.has(String(data.email || '').toLowerCase())) {
        await deleteDoc(doc(db, 'contacts', d.id));
      }
    }

    // 2. Purge legacy demo lists
    const listsSnap = await getDocs(
      query(collection(db, 'lists'), where('ownerId', '==', uid))
    );
    for (const d of listsSnap.docs) {
      const data = d.data();
      if (LEGACY_DEMO_LIST_NAMES.has(String(data.name || ''))) {
        await deleteDoc(doc(db, 'lists', d.id));
      }
    }

    // 3. Purge legacy demo automations
    const autoSnap = await getDocs(
      query(collection(db, 'automations'), where('ownerId', '==', uid))
    );
    for (const d of autoSnap.docs) {
      const data = d.data();
      if (LEGACY_DEMO_AUTOMATION_NAMES.has(String(data.name || ''))) {
        await deleteDoc(doc(db, 'automations', d.id));
      }
    }

    // 4. Purge legacy demo campaigns
    const campSnap = await getDocs(
      query(collection(db, 'campaigns'), where('ownerId', '==', uid))
    );
    for (const d of campSnap.docs) {
      const data = d.data();
      if (LEGACY_DEMO_CAMPAIGN_NAMES.has(String(data.name || ''))) {
        await deleteDoc(doc(db, 'campaigns', d.id));
      }
    }

    // 5. Purge legacy demo capture assets
    const assetSnap = await getDocs(
      query(collection(db, 'assets'), where('ownerId', '==', uid))
    );
    for (const d of assetSnap.docs) {
      const data = d.data();
      if (LEGACY_DEMO_ASSET_SLUGS.has(String(data.slug || ''))) {
        await deleteDoc(doc(db, 'assets', d.id));
      }
    }

    // 6. Purge legacy demo chatbots
    const botSnap = await getDocs(
      query(collection(db, 'chatbots'), where('ownerId', '==', uid))
    );
    for (const d of botSnap.docs) {
      const data = d.data();
      if (LEGACY_DEMO_BOT_NAMES.has(String(data.name || ''))) {
        await deleteDoc(doc(db, 'chatbots', d.id));
      }
    }

    // 7. Purge legacy demo tasks
    const taskSnap = await getDocs(
      query(collection(db, 'tasks'), where('ownerId', '==', uid))
    );
    for (const d of taskSnap.docs) {
      const data = d.data();
      if (LEGACY_DEMO_TASK_TITLES.has(String(data.title || ''))) {
        await deleteDoc(doc(db, 'tasks', d.id));
      }
    }

    // 8. Purge legacy demo activities
    const actSnap = await getDocs(
      query(collection(db, 'activities'), where('ownerId', '==', uid))
    );
    for (const d of actSnap.docs) {
      const data = d.data();
      if (LEGACY_DEMO_ACTIVITY_TITLES.has(String(data.title || ''))) {
        await deleteDoc(doc(db, 'activities', d.id));
      }
    }
  } catch (err) {
    console.warn('Cleanup check completed:', err);
  }
}

export async function seedStarterWorkspaceInFirestore(
  uid: string,
  userEmail: string,
  displayName: string,
  workspaceName?: string
): Promise<void> {
  const workspacePath = `workspaces/${uid}`;
  const wsRef = doc(db, 'workspaces', uid);
  const cleanName = (displayName || 'Workspace Owner').slice(0, 100);
  const cleanEmail = (userEmail || 'operator@flowpilot.app').slice(0, 150);
  const cleanWsName = (
    workspaceName && workspaceName.trim()
      ? workspaceName.trim()
      : displayName
      ? `${displayName}'s Workspace`
      : 'My Workspace'
  ).slice(0, 100);

  try {
    const existingWs = await getDoc(wsRef);
    if (!existingWs.exists()) {
      await setDoc(wsRef, {
        ownerId: uid,
        name: cleanWsName,
        category: 'creator',
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone.slice(0, 64) || 'America/New_York',
        currency: 'USD',
        senderName: cleanName,
        whatsappConnected: true,
        smsConnected: true,
        emailConnected: true,
        notifyNewLeads: true,
        notifyCampaigns: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, workspacePath);
  }

  const privateProfilePath = `users/${uid}/private/default`;
  const privRef = doc(db, 'users', uid, 'private', 'default');
  try {
    const existingPriv = await getDoc(privRef);
    if (!existingPriv.exists()) {
      const defaultIdentities = [
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
      ];
      await setDoc(privRef, {
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
        messagingIdentitiesJson: JSON.stringify(defaultIdentities).slice(0, 10000),
        gatewayConfigJson: '{}',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, privateProfilePath);
  }

  // Ensure owner member record exists if members subcollection is empty
  try {
    const existingMembers = await getDocs(
      query(collection(db, 'workspaces', uid, 'members'), where('ownerId', '==', uid))
    );
    if (existingMembers.empty) {
      const memberId = generateSafeId('mem');
      await setDoc(doc(db, 'workspaces', uid, 'members', memberId), {
        workspaceId: uid,
        ownerId: uid,
        memberName: cleanName,
        memberEmail: cleanEmail,
        role: 'owner',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `workspaces/${uid}/members`);
  }

  // Purge any previously seeded sample records so only the user's true created data is shown
  await purgeLegacyDemoDataFromFirestore(uid);
}

