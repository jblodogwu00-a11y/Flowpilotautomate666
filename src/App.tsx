import React, { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import {
  LayoutDashboard,
  Users,
  GitBranch,
  Send,
  FileText,
  MessageSquare,
  Settings,
  Plus,
  Globe,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Layers,
  TrendingUp,
  Zap,
  Inbox,
  Sun,
  Moon,
  Loader2,
} from 'lucide-react';
import {
  auth,
  db,
  logOutUser,
  triggerPasswordReset,
  triggerEmailVerification,
  reloadUserSession,
  handleFirestoreError,
  OperationType,
  subscribeUnifiedAuthState,
  createSyntheticFirebaseUser,
} from './firebase';
import {
  WorkspaceSnapshot,
  buildStarterWorkspaceSnapshot,
  loadLocalWorkspaceSnapshot,
  saveLocalWorkspaceSnapshot,
  fetchServerWorkspaceSnapshot,
  pushServerWorkspaceSnapshot,
  sanitizeFirestorePayload,
} from './services/accountPersistenceService';
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
  ActiveTab,
  MemberRole,
  ChannelType,
  CsvImportOptions,
  CsvImportResultSummary,
  generateSafeId,
  resolveWorkspaceSenderIdentities,
} from './types';
import {
  deliverChannelMessage,
  personalizeAutomationMessage,
  enqueueScheduledAutomationJobs,
  syncKillSwitchWithServerScheduler,
  setActiveGatewayAccountUid,
  hydrateGatewayConfigFromPrivateProfile,
  pollAndConsumeInboundWebhooks,
  pollAndConsumePublicLeadCaptures,
  pollAndConsumeTrackingComplianceEvents,
  submitPublicLeadToCaptureWebhook,
  triggerOneClickUnsubscribe,
} from './services/messageDeliveryService';
import {
  DEMO_WORKSPACE,
  DEMO_PRIVATE_PROFILE,
  DEMO_MEMBERS,
  DEMO_CONTACTS,
  DEMO_LISTS,
  DEMO_AUTOMATIONS,
  DEMO_AUTORESPONDERS,
  DEMO_INBOX_THREADS,
  DEMO_CAMPAIGNS,
  DEMO_ASSETS,
  DEMO_CHATBOTS,
  DEMO_TASKS,
  DEMO_ACTIVITIES,
  seedStarterWorkspaceInFirestore,
  purgeLegacyDemoDataFromFirestore,
} from './seedData';
import { LandingPage } from './components/LandingPage';
import { DashboardOverview } from './components/DashboardOverview';
import { ContactsCrmView } from './components/ContactsCrmView';
import { ListsView } from './components/ListsView';
import { AutomationsView } from './components/AutomationsView';
import { AutoRespondersView } from './components/AutoRespondersView';
import { InboxView } from './components/InboxView';
import { CampaignsView } from './components/CampaignsView';
import { CaptureAssetsView } from './components/CaptureAssetsView';
import { FunnelBuilderView } from './components/FunnelBuilderView';
import { ChatbotsView } from './components/ChatbotsView';
import { WorkspaceSettingsView } from './components/WorkspaceSettingsView';
import { FlowPilotLogo } from './components/FlowPilotLogo';
import { AuthModal, AuthModalMode } from './components/AuthModal';
import { SystemDiagnosticsModal } from './components/SystemDiagnosticsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  ThemeMode,
  getStoredThemeMode,
  applyThemeModeToDocument,
} from './theme/designSystem';
import {
  resolveAutomationTargetList,
  parseOrBuildFlowGraph,
  evaluateConditionForContact,
  evaluateListKillSwitchForContact,
  evaluateWorkflowKillSwitch,
} from './components/AutomationEngineCatalog';

export default function App() {
  const [viewMode, setViewMode] = useState<'landing' | 'workspace'>('landing');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());

  useEffect(() => {
    applyThemeModeToDocument(themeMode);
  }, [themeMode]);

  const handleToggleThemeMode = (nextMode?: ThemeMode) => {
    setThemeMode((prev) => {
      const target = nextMode || (prev === 'light' ? 'dark' : 'light');
      applyThemeModeToDocument(target);
      return target;
    });
  };

  // Standalone Shareable Lead Capture URL state (?capture=<slug> | ?page=<slug> | ?form=<slug>)
  const [publicCaptureSlug, setPublicCaptureSlug] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('capture') || sp.get('page') || sp.get('form');
    }
    return null;
  });
  // Standalone One-Click Global Unsubscribe URL state (?unsubscribe=<emailOrPhone>)
  const [publicUnsubscribeRecipient, setPublicUnsubscribeRecipient] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('unsubscribe');
    }
    return null;
  });
  const [unsubConfirmed, setUnsubConfirmed] = useState<boolean>(false);
  const [unsubRestored, setUnsubRestored] = useState<boolean>(false);
  const [pubName, setPubName] = useState('');
  const [pubEmail, setPubEmail] = useState('');
  const [pubPhone, setPubPhone] = useState('');
  const [pubSubmitted, setPubSubmitted] = useState(false);
  // Auth & Readiness state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('signin');
  const [authBanner, setAuthBanner] = useState<string | null>(null);
  const [diagnosticsModalOpen, setDiagnosticsModalOpen] = useState(false);

  // Quick-action modal triggers across tabs
  const [openContactModal, setOpenContactModal] = useState(false);
  const [openAutomationModal, setOpenAutomationModal] = useState(false);
  const [preselectedAutomationList, setPreselectedAutomationList] = useState<string | null>(null);
  const [preselectedAutoResponderList, setPreselectedAutoResponderList] = useState<string | null>(null);
  const [preselectedAssetList, setPreselectedAssetList] = useState<string | null>(null);
  const [preselectedCampaignList, setPreselectedCampaignList] = useState<string | null>(null);
  const [openCampaignModal, setOpenCampaignModal] = useState(false);
  const [instantSendBroadcast, setInstantSendBroadcast] = useState(false);
  const [openAssetModalMode, setOpenAssetModalMode] = useState<
    'landing_page' | 'inline_form' | null
  >(null);

  // Workspace State (Synced with Firestore when authenticated, or local interactive sandbox)
  const [workspace, setWorkspace] = useState<Workspace>(DEMO_WORKSPACE);
  const [privateProfile, setPrivateProfile] =
    useState<UserPrivateProfile>(DEMO_PRIVATE_PROFILE);
  const [members, setMembers] = useState<WorkspaceMember[]>(DEMO_MEMBERS);
  const [contacts, setContacts] = useState<Contact[]>(DEMO_CONTACTS);
  const [lists, setLists] = useState<AudienceList[]>(DEMO_LISTS);
  const [automations, setAutomations] = useState<Automation[]>(DEMO_AUTOMATIONS);
  const [autoResponders, setAutoResponders] = useState<AutoResponder[]>(DEMO_AUTORESPONDERS);
  const [inboxThreads, setInboxThreads] = useState<InboxThread[]>(DEMO_INBOX_THREADS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(DEMO_CAMPAIGNS);
  const [assets, setAssets] = useState<CaptureAsset[]>(DEMO_ASSETS);
  const [chatbots, setChatbots] = useState<ChatbotFlow[]>(DEMO_CHATBOTS);
  const [tasks, setTasks] = useState<TaskItem[]>(DEMO_TASKS);
  const [activities, setActivities] = useState<ActivityLog[]>(DEMO_ACTIVITIES);

  // Helper to apply a loaded WorkspaceSnapshot into React state
  const applyWorkspaceSnapshot = (snap: WorkspaceSnapshot, uid: string) => {
    if (snap.workspace) setWorkspace({ ...snap.workspace, id: uid, ownerId: uid });
    if (snap.privateProfile) {
      const prof: UserPrivateProfile = {
        ...snap.privateProfile,
        id: 'default',
        ownerId: uid,
      };
      setPrivateProfile(prof);
      hydrateGatewayConfigFromPrivateProfile(prof, uid);
    }
    if (Array.isArray(snap.members)) setMembers(snap.members);
    if (Array.isArray(snap.contacts)) setContacts(snap.contacts);
    if (Array.isArray(snap.lists)) setLists(snap.lists);
    if (Array.isArray(snap.automations)) setAutomations(snap.automations);
    if (Array.isArray(snap.autoResponders)) setAutoResponders(snap.autoResponders);
    if (Array.isArray(snap.inboxThreads)) setInboxThreads(snap.inboxThreads);
    if (Array.isArray(snap.campaigns)) setCampaigns(snap.campaigns);
    if (Array.isArray(snap.assets)) setAssets(snap.assets);
    if (Array.isArray(snap.chatbots)) setChatbots(snap.chatbots);
    if (Array.isArray(snap.tasks)) setTasks(snap.tasks);
    if (Array.isArray(snap.activities)) setActivities(snap.activities);
  };

  // 1. Listen to Unified Authentication State (Firebase Auth + Persistent Server/Local Vault)
  useEffect(() => {
    const unsubscribe = subscribeUnifiedAuthState(async (user, session) => {
      setActiveGatewayAccountUid(user ? user.uid : null);
      if (user) {
        const uid = user.uid;
        const email = user.email || session?.email || 'operator@flowpilot.app';
        const displayName =
          session?.displayName ||
          user.displayName ||
          email.split('@')[0] ||
          'Workspace Owner';
        const wsName = session?.workspaceName || `${displayName}'s Workspace`;

        // 1. Synchronously hydrate from Local Snapshot or Starter Snapshot first so state is never out-of-sync
        const localSnap = loadLocalWorkspaceSnapshot(uid, email);
        if (localSnap) {
          applyWorkspaceSnapshot(localSnap, uid);
        } else {
          const starterSnap = buildStarterWorkspaceSnapshot(
            uid,
            email,
            displayName,
            wsName
          );
          applyWorkspaceSnapshot(starterSnap, uid);
          saveLocalWorkspaceSnapshot(uid, email, starterSnap);
        }

        setCurrentUser(user);
        setViewMode('workspace');
        setIsAuthReady(true);

        // 2. Check Server Account Snapshot and sync
        const serverSnap = await fetchServerWorkspaceSnapshot(uid, email);
        if (serverSnap && !localSnap) {
          applyWorkspaceSnapshot(serverSnap, uid);
          saveLocalWorkspaceSnapshot(uid, email, serverSnap);
        } else if (localSnap) {
          void pushServerWorkspaceSnapshot(uid, email, localSnap);
        }

        // 3. If backed by a live Firebase Auth user, also seed/sync Cloud Firestore
        if (auth.currentUser && auth.currentUser.uid === uid) {
          const wsRef = doc(db, 'workspaces', uid);
          try {
            const snap = await getDoc(wsRef);
            if (!snap.exists()) {
              await seedStarterWorkspaceInFirestore(uid, email, displayName, wsName);
            } else {
              await purgeLegacyDemoDataFromFirestore(uid);
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, `workspaces/${uid}`);
          }
        }
      } else {
        setCurrentUser(null);
        const guestSnap = loadLocalWorkspaceSnapshot('guest_sandbox', 'guest@flowpilot.app');
        if (guestSnap) {
          applyWorkspaceSnapshot(guestSnap, guestSnap.workspace.id || 'ws_default');
        } else {
          setWorkspace(DEMO_WORKSPACE);
          setPrivateProfile(DEMO_PRIVATE_PROFILE);
          setMembers(DEMO_MEMBERS);
          setContacts(DEMO_CONTACTS);
          setLists(DEMO_LISTS);
          setAutomations(DEMO_AUTOMATIONS);
          setAutoResponders(DEMO_AUTORESPONDERS);
          setInboxThreads(DEMO_INBOX_THREADS);
          setCampaigns(DEMO_CAMPAIGNS);
          setAssets(DEMO_ASSETS);
          setChatbots(DEMO_CHATBOTS);
          setTasks(DEMO_TASKS);
          setActivities(DEMO_ACTIVITIES);
        }
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // 1B. Dual-Sync Persistence Effect: Mirror every state mutation to Local & Server Account Storage
  useEffect(() => {
    if (!isAuthReady) return;
    const uid = currentUser ? currentUser.uid : 'guest_sandbox';
    const email = currentUser
      ? currentUser.email || privateProfile.email || 'operator@flowpilot.app'
      : 'guest@flowpilot.app';

    const snapshot: WorkspaceSnapshot = {
      workspace,
      privateProfile,
      members,
      contacts,
      lists,
      automations,
      autoResponders,
      inboxThreads,
      campaigns,
      assets,
      chatbots,
      tasks,
      activities,
      updatedAt: new Date().toISOString(),
    };

    saveLocalWorkspaceSnapshot(uid, email, snapshot);

    if (currentUser) {
      const timer = setTimeout(() => {
        void pushServerWorkspaceSnapshot(uid, email, snapshot);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [
    isAuthReady,
    currentUser,
    workspace,
    privateProfile,
    members,
    contacts,
    lists,
    automations,
    autoResponders,
    inboxThreads,
    campaigns,
    assets,
    chatbots,
    tasks,
    activities,
  ]);

  // 2. Attach Real-Time Firestore Listeners when Authenticated with Firebase
  useEffect(() => {
    if (!isAuthReady || !currentUser || !auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const unsubs: (() => void)[] = [];

    // Workspace listener
    unsubs.push(
      onSnapshot(
        doc(db, 'workspaces', uid),
        (snap) => {
          if (snap.exists()) {
            setWorkspace({ id: snap.id, ...(snap.data() as Omit<Workspace, 'id'>) });
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, `workspaces/${uid}`)
      )
    );

    // Private PII profile listener
    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid, 'private', 'default'),
        (snap) => {
          if (snap.exists()) {
            const loadedProfile: UserPrivateProfile = {
              id: snap.id,
              ...(snap.data() as Omit<UserPrivateProfile, 'id'>),
            };
            setPrivateProfile(loadedProfile);
            hydrateGatewayConfigFromPrivateProfile(loadedProfile, uid);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}/private/default`)
      )
    );

    // Members subcollection listener
    unsubs.push(
      onSnapshot(
        query(collection(db, 'workspaces', uid, 'members'), where('ownerId', '==', uid)),
        (snap) => {
          if (snap.docs.length > 0) {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<WorkspaceMember, 'id'>),
            }));
            setMembers(list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `workspaces/${uid}/members`)
      )
    );

    // Contacts listener
    unsubs.push(
      onSnapshot(
        query(collection(db, 'contacts'), where('ownerId', '==', uid)),
        (snap) => {
          if (snap.docs.length > 0) {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Contact, 'id'>),
            }));
            setContacts(list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'contacts')
      )
    );

    // Audience Lists listener
    unsubs.push(
      onSnapshot(
        query(collection(db, 'lists'), where('ownerId', '==', uid)),
        (snap) => {
          if (snap.docs.length > 0) {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<AudienceList, 'id'>),
            }));
            setLists(list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'lists')
      )
    );

    // Automations listener
    unsubs.push(
      onSnapshot(
        query(collection(db, 'automations'), where('ownerId', '==', uid)),
        (snap) => {
          if (snap.docs.length > 0) {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Automation, 'id'>),
            }));
            setAutomations(list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'automations')
      )
    );

    // Campaigns listener
    unsubs.push(
      onSnapshot(
        query(collection(db, 'campaigns'), where('ownerId', '==', uid)),
        (snap) => {
          if (snap.docs.length > 0) {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Campaign, 'id'>),
            }));
            setCampaigns(list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'campaigns')
      )
    );

    // Capture Assets listener
    unsubs.push(
      onSnapshot(
        query(collection(db, 'assets'), where('ownerId', '==', uid)),
        (snap) => {
          if (snap.docs.length > 0) {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<CaptureAsset, 'id'>),
            }));
            setAssets(list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'assets')
      )
    );

    // Chatbots listener
    unsubs.push(
      onSnapshot(
        query(collection(db, 'chatbots'), where('ownerId', '==', uid)),
        (snap) => {
          if (snap.docs.length > 0) {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<ChatbotFlow, 'id'>),
            }));
            setChatbots(list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'chatbots')
      )
    );

    // Auto Responders listener
    unsubs.push(
      onSnapshot(
        query(collection(db, 'autoresponders'), where('ownerId', '==', uid)),
        (snap) => {
          if (snap.docs.length > 0) {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<AutoResponder, 'id'>),
            }));
            setAutoResponders(list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'autoresponders')
      )
    );

    // Inbox Threads listener
    unsubs.push(
      onSnapshot(
        query(collection(db, 'inbox_threads'), where('ownerId', '==', uid)),
        (snap) => {
          if (snap.docs.length > 0) {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<InboxThread, 'id'>),
            }));
            setInboxThreads(list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'inbox_threads')
      )
    );

    // Tasks listener
    unsubs.push(
      onSnapshot(
        query(collection(db, 'tasks'), where('ownerId', '==', uid)),
        (snap) => {
          if (snap.docs.length > 0) {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<TaskItem, 'id'>),
            }));
            setTasks(list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'tasks')
      )
    );

    // Activities listener
    unsubs.push(
      onSnapshot(
        query(collection(db, 'activities'), where('ownerId', '==', uid)),
        (snap) => {
          if (snap.docs.length > 0) {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<ActivityLog, 'id'>),
            }));
            setActivities(list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'activities')
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [isAuthReady, currentUser]);

  const isCloudAuthenticated = Boolean(currentUser && auth.currentUser);
  const isSignedInAny = Boolean(currentUser);

  const handleOpenAuthModal = (mode: AuthModalMode = 'signin') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', mode === 'signup' ? '/signup' : '/login');
    }
  };

  const handleCloseAuthModal = () => {
    setAuthModalOpen(false);
    if (
      typeof window !== 'undefined' &&
      (window.location.pathname === '/login' || window.location.pathname === '/signup')
    ) {
      window.history.replaceState({}, '', '/');
    }
  };

  const handleLogoutUser = async () => {
    await logOutUser();
    setCurrentUser(null);
    setViewMode('landing');
    setAuthModalMode('signin');
    setAuthModalOpen(true);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/login');
    }
  };

  // Route Synchronization & Protected Route Redirection
  useEffect(() => {
    if (!isAuthReady) return;

    const handleRouteSync = () => {
      if (typeof window === 'undefined') return;
      const path = window.location.pathname;

      if (path === '/login') {
        if (currentUser) {
          setViewMode('workspace');
          setActiveTab('dashboard');
          window.history.replaceState({}, '', '/dashboard');
        } else {
          setViewMode('landing');
          setAuthModalMode('signin');
          setAuthModalOpen(true);
        }
      } else if (path === '/signup') {
        if (currentUser) {
          setViewMode('workspace');
          setActiveTab('dashboard');
          window.history.replaceState({}, '', '/dashboard');
        } else {
          setViewMode('landing');
          setAuthModalMode('signup');
          setAuthModalOpen(true);
        }
      } else if (path === '/dashboard' || path === '/app') {
        if (!currentUser) {
          setViewMode('landing');
          setAuthModalMode('signin');
          setAuthModalOpen(true);
          window.history.replaceState({}, '', '/login');
        } else {
          setViewMode('workspace');
          setActiveTab('dashboard');
        }
      }
    };

    handleRouteSync();
    window.addEventListener('popstate', handleRouteSync);
    return () => window.removeEventListener('popstate', handleRouteSync);
  }, [isAuthReady, currentUser]);

  const handleRefreshEmailVerification = async () => {
    const refreshed = await reloadUserSession();
    if (refreshed && refreshed.emailVerified) {
      const wsRef = doc(db, 'workspaces', refreshed.uid);
      try {
        const snap = await getDoc(wsRef);
        if (!snap.exists()) {
          await seedStarterWorkspaceInFirestore(
            refreshed.uid,
            refreshed.email || 'operator@flowpilot.app',
            refreshed.displayName || 'FlowPilot Operator'
          );
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `workspaces/${refreshed.uid}`);
      }
      setCurrentUser({ ...refreshed } as User);
      setAuthBanner('Email verified! Your workspace is now synced with Cloud Firestore.');
    } else {
      setAuthBanner(
        'Email is still awaiting verification. Please click the link sent to your inbox, then click Refresh.'
      );
    }
  };

  const logActivityEvent = async (
    eventType: ActivityLog['eventType'],
    title: string,
    detail: string,
    channel: ActivityLog['channel']
  ) => {
    const actId = generateSafeId('act');
    const ownerUid = currentUser?.uid || workspace.ownerId;
    setActivities((prev) => [
      {
        id: actId,
        workspaceId: ownerUid,
        ownerId: ownerUid,
        eventType,
        title: title.slice(0, 160),
        detail: detail.slice(0, 280),
        channel,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);

    if (isCloudAuthenticated && auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await setDoc(
          doc(db, 'activities', actId),
          sanitizeFirestorePayload({
            workspaceId: uid,
            ownerId: uid,
            eventType,
            title: title.slice(0, 160),
            detail: detail.slice(0, 280),
            channel,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `activities/${actId}`);
      }
    }
  };

  // =========================================================================
  // CRUD HANDLERS (Dual-Sync: Instant Local/Server State + Cloud Firestore)
  // =========================================================================

  const handleCreateContact = async (
    data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    const cid = generateSafeId('cnt');
    const ownerUid = currentUser?.uid || workspace.ownerId;
    const newContact: Contact = {
      id: cid,
      workspaceId: ownerUid,
      ownerId: ownerUid,
      ...data,
      createdAt: new Date().toISOString(),
    };
    setContacts((prev) => [newContact, ...prev]);

    if (isCloudAuthenticated && auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await setDoc(
          doc(db, 'contacts', cid),
          sanitizeFirestorePayload({
            workspaceId: uid,
            ownerId: uid,
            ...data,
            fullName: (data.fullName || 'Contact').slice(0, 100),
            email: (data.email || '').slice(0, 150),
            phone: (data.phone || '').slice(0, 32),
            source: (data.source || 'Manual Entry').slice(0, 80),
            listName: (data.listName || 'General Contacts').slice(0, 80),
            tags: (data.tags || []).slice(0, 10),
            ltv: Math.max(0, Number(data.ltv) || 0),
            notes: (data.notes || '').slice(0, 500),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `contacts/${cid}`);
      }
    }

    await logActivityEvent(
      'lead_captured',
      `New Contact Added: ${data.fullName}`,
      `List: ${data.listName} · Consent: ${data.consentStatus} · Source: ${data.source}`,
      'crm'
    );

    // Automatically trigger active Automations matching this Contact's List or contact_added / list_joined triggers
    if (!(data.source || '').includes('(/p/')) {
      const targetClean = (data.listName || '').trim().toLowerCase();
      const matchingAutos = automations.filter((auto) => {
        if (auto.status !== 'active') return false;
        const autoList = resolveAutomationTargetList(auto).toLowerCase();
        return (
          (targetClean && autoList === targetClean) ||
          auto.triggerType === 'contact_added' ||
          (auto.triggerType === 'list_joined' && autoList === targetClean)
        );
      });

      for (const auto of matchingAutos) {
        await handleSimulateAutomationRun(auto, {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          company: data.company,
          listName: data.listName,
          tags: data.tags,
          stage: data.stage,
          temperature: data.temperature,
        });
      }
    }
  };

  const handleUpdateContact = async (
    id: string,
    data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...data } : c))
    );

    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await updateDoc(
          doc(db, 'contacts', id),
          sanitizeFirestorePayload({
            ...data,
            fullName: (data.fullName || 'Contact').slice(0, 100),
            email: (data.email || '').slice(0, 150),
            phone: (data.phone || '').slice(0, 32),
            source: (data.source || 'Manual Entry').slice(0, 80),
            listName: (data.listName || 'General Contacts').slice(0, 80),
            tags: (data.tags || []).slice(0, 10),
            ltv: Math.max(0, Number(data.ltv) || 0),
            notes: (data.notes || '').slice(0, 500),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `contacts/${id}`);
      }
    }

    await logActivityEvent(
      'stage_converted',
      `Updated CRM Record: ${data.fullName} (${data.stage})`,
      `Temperature: ${data.temperature.toUpperCase()} · LTV: $${data.ltv}`,
      'crm'
    );

    void syncKillSwitchWithServerScheduler({
      contacts: [
        {
          id,
          email: data.email,
          phone: data.phone,
          fullName: data.fullName,
          listName: data.listName,
          tags: data.tags || [],
        },
      ],
      lists: lists.map((l) => ({
        name: l.name,
        killSwitchEnabled: l.killSwitchEnabled !== false,
        killSwitchTags:
          l.killSwitchTags && l.killSwitchTags.length > 0
            ? l.killSwitchTags
            : ['Purchased_Course'],
      })),
    });
  };

  const handleDeleteContact = async (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'contacts', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `contacts/${id}`);
      }
    }
  };

  const handleCreateList = async (
    data: Omit<AudienceList, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    const lid = generateSafeId('lst');
    const ownerUid = currentUser?.uid || workspace.ownerId;
    const resolvedKillTags = (
      data.killSwitchTags && data.killSwitchTags.length > 0
        ? data.killSwitchTags
        : ['Purchased_Course']
    ).slice(0, 10);

    setLists((prev) => [
      {
        id: lid,
        workspaceId: ownerUid,
        ownerId: ownerUid,
        ...data,
        killSwitchEnabled: data.killSwitchEnabled !== false,
        killSwitchTags: resolvedKillTags,
      },
      ...prev,
    ]);

    if (isCloudAuthenticated && auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await setDoc(
          doc(db, 'lists', lid),
          sanitizeFirestorePayload({
            workspaceId: uid,
            ownerId: uid,
            name: data.name.slice(0, 100),
            description: data.description.slice(0, 300),
            category: data.category,
            defaultConsent: data.defaultConsent,
            defaultTags: (data.defaultTags || []).slice(0, 10),
            colorAccent: data.colorAccent,
            killSwitchEnabled: data.killSwitchEnabled !== false,
            killSwitchTags: resolvedKillTags,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `lists/${lid}`);
      }
    }

    void syncKillSwitchWithServerScheduler({
      lists: [
        {
          name: data.name,
          killSwitchEnabled: data.killSwitchEnabled !== false,
          killSwitchTags: resolvedKillTags,
        },
      ],
    });

    await logActivityEvent(
      'lead_captured',
      `Created New Contact List: ${data.name}`,
      `Category: ${data.category} · Kill Switch Tags: ${resolvedKillTags.join(', ')}`,
      'crm'
    );
  };

  const handleUpdateList = async (
    id: string,
    data: Omit<AudienceList, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    const resolvedKillTags = (
      data.killSwitchTags && data.killSwitchTags.length > 0
        ? data.killSwitchTags
        : ['Purchased_Course']
    ).slice(0, 10);

    setLists((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              ...data,
              killSwitchEnabled: data.killSwitchEnabled !== false,
              killSwitchTags: resolvedKillTags,
            }
          : l
      )
    );

    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await updateDoc(
          doc(db, 'lists', id),
          sanitizeFirestorePayload({
            name: data.name.slice(0, 100),
            description: data.description.slice(0, 300),
            category: data.category,
            defaultConsent: data.defaultConsent,
            defaultTags: (data.defaultTags || []).slice(0, 10),
            colorAccent: data.colorAccent,
            killSwitchEnabled: data.killSwitchEnabled !== false,
            killSwitchTags: resolvedKillTags,
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `lists/${id}`);
      }
    }

    void syncKillSwitchWithServerScheduler({
      lists: [
        {
          name: data.name,
          killSwitchEnabled: data.killSwitchEnabled !== false,
          killSwitchTags: resolvedKillTags,
        },
      ],
    });
  };

  const handleDeleteList = async (id: string) => {
    setLists((prev) => prev.filter((l) => l.id !== id));
    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'lists', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `lists/${id}`);
      }
    }
  };

  const handleBulkImportContacts = async (
    imported: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>[],
    options?: CsvImportOptions
  ): Promise<CsvImportResultSummary> => {
    const updateExisting = options?.updateExistingContacts !== false;
    const createUnmatched = options?.createUnmatchedContacts !== false;
    const appliedTags = (
      options?.applyTags && options.applyTags.length > 0
        ? options.applyTags
        : ['Purchased_Course']
    )
      .map((t) => t.trim().slice(0, 32))
      .filter(Boolean);

    let updatedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;
    const matchedContactNames: string[] = [];
    const processedContactsForKillSwitch: {
      fullName: string;
      email: string;
      phone: string;
      listName: string;
      tags: string[];
      stage: string;
    }[] = [];

    for (const data of imported) {
      const cleanEmail = (data.email || '').trim().toLowerCase();
      const phoneDigits = (data.phone || '').replace(/\D/g, '');
      const tail9 = phoneDigits.length >= 8 ? phoneDigits.slice(-9) : '';

      const existingMatch = contacts.find((c) => {
        const emailMatches =
          cleanEmail &&
          cleanEmail.includes('@') &&
          !cleanEmail.endsWith('@whatsapp-buyer.local') &&
          (c.email || '').trim().toLowerCase() === cleanEmail;
        if (emailMatches) return true;

        const cDigits = (c.phone || '').replace(/\D/g, '');
        if (phoneDigits.length >= 7 && cDigits.length >= 7) {
          if (cDigits === phoneDigits) return true;
          if (tail9 && cDigits.slice(-9) === tail9) return true;
        }
        return false;
      });

      if (existingMatch && updateExisting) {
        const mergedTags = Array.from(
          new Set([...(existingMatch.tags || []), ...(data.tags || []), ...appliedTags])
        )
          .map((t) => t.trim().slice(0, 32))
          .filter(Boolean)
          .slice(0, 10);

        const nextStage =
          options?.upgradeStageToCustomer !== false ? 'customer' : existingMatch.stage;
        const nextNotes = `${
          existingMatch.notes ? existingMatch.notes + ' | ' : ''
        }[Kill Switch Tag Applied: ${appliedTags.join(', ')}]`.slice(0, 500);

        const updatedPayload: Omit<
          Contact,
          'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'
        > = {
          fullName: existingMatch.fullName.slice(0, 100),
          email: existingMatch.email.slice(0, 150),
          phone: (existingMatch.phone || data.phone || '').slice(0, 32),
          company: (existingMatch.company || data.company || '').slice(0, 100),
          dealTitle: (existingMatch.dealTitle || data.dealTitle || '').slice(0, 120),
          stage: nextStage,
          temperature: 'hot',
          source: (existingMatch.source || 'Daily CSV Import').slice(0, 80),
          consentStatus: existingMatch.consentStatus,
          commChannels: (existingMatch.commChannels || ['email', 'whatsapp']).slice(0, 5),
          listName: (existingMatch.listName || 'General Contacts').slice(0, 80),
          tags: mergedTags,
          ltv: Math.max(0, Number(existingMatch.ltv) || Number(data.ltv) || 0),
          notes: nextNotes,
          customFields: (existingMatch.customFields || []).slice(0, 15),
        };

        await handleUpdateContact(existingMatch.id, updatedPayload);
        updatedCount += 1;
        matchedContactNames.push(existingMatch.fullName);
        processedContactsForKillSwitch.push({
          fullName: existingMatch.fullName,
          email: existingMatch.email,
          phone: updatedPayload.phone,
          listName: updatedPayload.listName,
          tags: mergedTags,
          stage: nextStage,
        });
        continue;
      }

      if (!createUnmatched) {
        skippedCount += 1;
        continue;
      }

      const cid = generateSafeId('cnt');
      const finalNewTags = Array.from(new Set([...(data.tags || []), ...appliedTags]))
        .map((t) => t.trim().slice(0, 32))
        .filter(Boolean)
        .slice(0, 10);

      const ownerUid = currentUser?.uid || workspace.ownerId;
      setContacts((prev) => [
        {
          id: cid,
          workspaceId: ownerUid,
          ownerId: ownerUid,
          ...data,
          tags: finalNewTags,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      if (isCloudAuthenticated && auth.currentUser) {
        const uid = auth.currentUser.uid;
        try {
          await setDoc(
            doc(db, 'contacts', cid),
            sanitizeFirestorePayload({
              workspaceId: uid,
              ownerId: uid,
              fullName: data.fullName.slice(0, 100),
              email: data.email.slice(0, 150),
              phone: (data.phone || '').slice(0, 32),
              company: (data.company || '').slice(0, 100),
              dealTitle: (data.dealTitle || '').slice(0, 120),
              stage: data.stage,
              temperature: data.temperature,
              source: (data.source || 'CSV Import').slice(0, 80),
              consentStatus: data.consentStatus,
              commChannels: (data.commChannels || ['email']).slice(0, 5),
              listName: (data.listName || 'Imported Contacts').slice(0, 80),
              tags: finalNewTags,
              ltv: Math.max(0, Number(data.ltv) || 0),
              notes: (data.notes || '').slice(0, 500),
              customFields: (data.customFields || []).slice(0, 15),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `contacts/${cid}`);
        }
      }

      createdCount += 1;
      matchedContactNames.push(data.fullName);
      processedContactsForKillSwitch.push({
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || '',
        listName: data.listName || 'Imported Contacts',
        tags: finalNewTags,
        stage: data.stage,
      });
    }

    // Evaluate List Kill Switch for each contact so matching tags stop automation for that contact
    let killSwitchEjectedCount = 0;
    const affectedWorkflowNames: string[] = [];

    for (const buyer of processedContactsForKillSwitch) {
      const listKsEval = evaluateListKillSwitchForContact(
        { tags: buyer.tags, listName: buyer.listName, stage: buyer.stage },
        lists,
        buyer.listName
      );
      if (listKsEval.triggered || appliedTags.length > 0) {
        killSwitchEjectedCount += 1;
        if (listKsEval.listName && !affectedWorkflowNames.includes(listKsEval.listName)) {
          affectedWorkflowNames.push(`List "${listKsEval.listName}"`);
        }
      }
    }

    for (const auto of automations) {
      if (auto.status !== 'active') continue;
      const autoList = resolveAutomationTargetList(auto);
      const anyMatchedInAuto = processedContactsForKillSwitch.some(
        (buyer) =>
          evaluateListKillSwitchForContact(
            { tags: buyer.tags, listName: buyer.listName, stage: buyer.stage },
            lists,
            autoList || buyer.listName
          ).triggered
      );
      if (anyMatchedInAuto && !affectedWorkflowNames.includes(auto.name)) {
        affectedWorkflowNames.push(auto.name);
      }
    }

    // Also synchronize all imported contacts & List Kill Switch rules with the Server Background Scheduler
    // so any pending delayed steps on the server are immediately halted for these contacts
    void syncKillSwitchWithServerScheduler({
      contacts: processedContactsForKillSwitch.map((b) => ({
        email: b.email,
        phone: b.phone,
        fullName: b.fullName,
        listName: b.listName,
        tags: b.tags,
      })),
      lists: lists.map((l) => ({
        name: l.name,
        killSwitchEnabled: l.killSwitchEnabled !== false,
        killSwitchTags:
          l.killSwitchTags && l.killSwitchTags.length > 0
            ? l.killSwitchTags
            : ['Purchased_Course'],
      })),
    });

    await logActivityEvent(
      'automation_triggered',
      `List Kill Switch Applied (#${appliedTags.join(', #')}) — Stopped for ${killSwitchEjectedCount} Contact(s)`,
      `Updated ${updatedCount} existing contact(s) · Created ${createdCount} · Automation stopped for ${killSwitchEjectedCount} contact(s) in ${
        affectedWorkflowNames.join(', ') || 'their Contact List'
      }`,
      'crm'
    );

    return {
      updatedCount,
      createdCount,
      skippedCount,
      killSwitchEjectedCount,
      affectedWorkflowNames,
      appliedTags,
      matchedContactNames,
    };
  };

  const handleMergeContacts = async (primaryId: string, duplicateId: string) => {
    const primary = contacts.find((c) => c.id === primaryId);
    const duplicate = contacts.find((c) => c.id === duplicateId);
    if (!primary || !duplicate) return;

    const mergedTags = Array.from(new Set([...(primary.tags || []), ...(duplicate.tags || [])]))
      .filter((t) => t !== 'duplicate-candidate')
      .slice(0, 10);
    const mergedChannels = Array.from(
      new Set([...(primary.commChannels || ['email']), ...(duplicate.commChannels || ['email'])])
    ).slice(0, 5);
    const mergedCustomFields = Array.from(
      new Set([...(primary.customFields || []), ...(duplicate.customFields || [])])
    ).slice(0, 15);
    const mergedNotes = [primary.notes, duplicate.notes]
      .filter(Boolean)
      .join(' | [Merged]: ')
      .slice(0, 500);

    const updatedPayload: Omit<
      Contact,
      'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'
    > = {
      fullName: primary.fullName.replace(/\s*\(Audit Inquiry\)/i, '').slice(0, 100),
      email: primary.email,
      phone: primary.phone || duplicate.phone,
      company: (primary.company || duplicate.company || '').slice(0, 100),
      dealTitle: (primary.dealTitle || duplicate.dealTitle || '').slice(0, 120),
      stage: primary.stage,
      temperature:
        primary.temperature === 'hot' || duplicate.temperature === 'hot'
          ? 'hot'
          : primary.temperature,
      source: primary.source,
      consentStatus:
        primary.consentStatus === 'opted_in' || duplicate.consentStatus === 'opted_in'
          ? 'opted_in'
          : primary.consentStatus,
      commChannels: mergedChannels,
      listName: primary.listName,
      tags: mergedTags,
      ltv: (Number(primary.ltv) || 0) + (Number(duplicate.ltv) || 0),
      notes: mergedNotes,
      customFields: mergedCustomFields,
    };

    await handleUpdateContact(primaryId, updatedPayload);
    await handleDeleteContact(duplicateId);

    await logActivityEvent(
      'stage_converted',
      `Merged Duplicate CRM Records: ${updatedPayload.fullName}`,
      `Combined tags (${mergedTags.length}), custom fields (${mergedCustomFields.length}), and Deal LTV ($${updatedPayload.ltv})`,
      'crm'
    );
  };

  const handleCreateAutomation = async (
    data: Omit<Automation, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    const aid = generateSafeId('auto');
    const ownerUid = currentUser?.uid || workspace.ownerId;
    setAutomations((prev) => [
      {
        id: aid,
        workspaceId: ownerUid,
        ownerId: ownerUid,
        ...data,
      },
      ...prev,
    ]);

    if (isCloudAuthenticated && auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await setDoc(
          doc(db, 'automations', aid),
          sanitizeFirestorePayload({
            workspaceId: uid,
            ownerId: uid,
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `automations/${aid}`);
      }
    }

    await logActivityEvent(
      'automation_triggered',
      `Published Visual Workflow: ${data.name}`,
      `Trigger: ${data.triggerDetail} · ${data.stepsSummary.length} steps`,
      'crm'
    );
  };

  const handleUpdateAutomation = async (
    id: string,
    data: Omit<Automation, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...data } : a))
    );

    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await updateDoc(
          doc(db, 'automations', id),
          sanitizeFirestorePayload({
            ...data,
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `automations/${id}`);
      }
    }
  };

  const handleDeleteAutomation = async (id: string) => {
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'automations', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `automations/${id}`);
      }
    }
  };

  const handleSimulateAutomationRun = async (
    auto: Automation,
    targetContactOverride?: Partial<Contact>
  ) => {
    const resolvedList = resolveAutomationTargetList(auto);
    await handleUpdateAutomation(auto.id, {
      name: auto.name,
      triggerType: auto.triggerType,
      triggerDetail: auto.triggerDetail,
      ...(resolvedList ? { targetList: resolvedList } : {}),
      stepsSummary: auto.stepsSummary,
      channels: auto.channels,
      status: auto.status,
      enrolledCount: auto.enrolledCount + 1,
      completedCount: auto.completedCount + 1,
      conversionRate: Math.min(99, Math.max(auto.conversionRate || 32, 38)),
      ...(typeof auto.version === 'number' ? { version: auto.version } : {}),
      ...(typeof auto.flowGraphJson === 'string' ? { flowGraphJson: auto.flowGraphJson } : {}),
    });

    const matchedContacts = resolvedList
      ? contacts.filter(
          (c) => c.listName.trim().toLowerCase() === resolvedList.trim().toLowerCase()
        )
      : contacts;
    const fallbackContact = matchedContacts[0] || contacts[0];

    const leadName = targetContactOverride?.fullName || fallbackContact?.fullName || 'Workflow Lead';
    const leadEmail =
      targetContactOverride?.email || fallbackContact?.email || privateProfile.email || 'lead@example.com';
    const leadPhone =
      targetContactOverride?.phone || fallbackContact?.phone || privateProfile.phone || '+1 (555) 234-8910';
    const leadCompany = targetContactOverride?.company || fallbackContact?.company || 'Partner';
    const leadList =
      targetContactOverride?.listName || resolvedList || fallbackContact?.listName || 'General Contacts';

    const parsedGraph = parseOrBuildFlowGraph(auto);

    const contactTags = targetContactOverride?.tags || fallbackContact?.tags || [];
    const contactStage = targetContactOverride?.stage || fallbackContact?.stage || 'lead';
    const killSwitchCheck = evaluateWorkflowKillSwitch(
      { tags: contactTags, listName: leadList, stage: contactStage },
      parsedGraph.engineConfig,
      lists,
      leadList
    );
    if (killSwitchCheck.triggered) {
      await logActivityEvent(
        'automation_triggered',
        `List Kill Switch Stopped Automation for ${leadName} (#${killSwitchCheck.matchedTag})`,
        `${killSwitchCheck.ruleDescription} — Stopped follow-up messages for this contact only.`,
        'crm'
      );
      return;
    }

    let activeBranch = 'main';
    let dispatchedCount = 0;
    let cumulativeWaitSeconds = 0;

    const matchedTargetListObj = lists.find(
      (l) => l.name.trim().toLowerCase() === leadList.trim().toLowerCase()
    );
    const listKillSwitchEnabled =
      matchedTargetListObj !== undefined ? matchedTargetListObj.killSwitchEnabled !== false : true;
    const listKillSwitchTags =
      matchedTargetListObj?.killSwitchTags && matchedTargetListObj.killSwitchTags.length > 0
        ? matchedTargetListObj.killSwitchTags
        : ['Purchased_Course'];

    for (const node of parsedGraph.nodes) {
      if (node.branchPath !== 'main' && node.branchPath !== activeBranch) {
        continue;
      }
      if (node.category === 'condition') {
        const evalRes = evaluateConditionForContact(
          node,
          (targetContactOverride as Contact) || fallbackContact || null
        );
        activeBranch = evalRes.branchPath;
        continue;
      }
      if (node.category === 'delay' || (node.category as any) === 'wait') {
        const waitVal = Math.max(
          1,
          Number(node.config.waitDurationAmount ?? (node.config as any).waitDurationValue ?? node.config.delayAmount) || 10
        );
        const unit = node.config.waitDurationUnit || node.config.delayUnit || 'minutes';
        const stepDelaySec =
          unit === 'minutes'
            ? waitVal * 60
            : unit === 'hours'
            ? waitVal * 3600
            : waitVal * 86400;
        cumulativeWaitSeconds += stepDelaySec;
        continue;
      }
      if (
        node.subType === 'send_whatsapp' ||
        node.subType === 'send_email' ||
        node.subType === 'send_sms'
      ) {
        const stepChannel: ChannelType =
          node.subType === 'send_whatsapp'
            ? 'whatsapp'
            : node.subType === 'send_sms'
            ? 'sms'
            : 'email';
        const rawSubject = node.config.subjectOrTemplate || auto.name;
        const rawBody =
          node.config.messagePreview ||
          auto.stepsSummary[0] ||
          `Hi {{first_name}}, automated follow-up from ${auto.name}`;

        const personalizedSubject = personalizeAutomationMessage(rawSubject, {
          fullName: leadName,
          email: leadEmail,
          phone: leadPhone,
          company: leadCompany,
          listName: leadList,
          senderName: workspace.senderName || workspace.name,
          automationId: auto.id,
        });
        const personalizedBody = personalizeAutomationMessage(rawBody, {
          fullName: leadName,
          email: leadEmail,
          phone: leadPhone,
          company: leadCompany,
          listName: leadList,
          senderName: workspace.senderName || workspace.name,
          automationId: auto.id,
        });

        if (cumulativeWaitSeconds > 0) {
          await enqueueScheduledAutomationJobs([
            {
              automationId: auto.id,
              automationName: auto.name,
              stepId: node.id,
              stepOrder: node.stepOrder ?? 1,
              stepTitle: node.title,
              channel: stepChannel,
              contactId: fallbackContact?.id || `cnt_${Date.now()}`,
              contactName: leadName,
              contactEmail: leadEmail,
              contactPhone: leadPhone,
              toRecipient: stepChannel === 'email' ? leadEmail : leadPhone,
              contactTags,
              listName: leadList,
              killSwitchEnabled: listKillSwitchEnabled,
              killSwitchTags: listKillSwitchTags,
              fromIdentity: node.config.overrideFromIdentity || undefined,
              subject: personalizedSubject,
              body: personalizedBody,
              delaySeconds: Math.min(cumulativeWaitSeconds, 86400 * 30),
              workspace,
              privateProfile,
            },
          ]);
          dispatchedCount += 1;
          await logActivityEvent(
            'automation_triggered',
            `Scheduled Follow-Up Enqueued (${stepChannel.toUpperCase()} in ${cumulativeWaitSeconds}s): ${node.title}`,
            `Enqueued in Background Scheduler · Protected by Kill Switch exit tag (#${listKillSwitchTags.join(', #')}) for ${leadName}`,
            'crm'
          );
          continue;
        }

        await deliverChannelMessage({
          channel: stepChannel,
          to: stepChannel === 'email' ? leadEmail : leadPhone,
          leadName,
          subject: personalizedSubject,
          body: personalizedBody,
          listName: leadList,
          source: 'automation_workflow',
          overrideFromIdentity: node.config.overrideFromIdentity || undefined,
          workspace,
          privateProfile,
        });
        dispatchedCount += 1;
      }
      if (node.subType === 'stop_workflow') {
        break;
      }
    }

    if (dispatchedCount === 0) {
      const primaryChannel = ((auto.channels[0] || 'email').toLowerCase() as ChannelType);
      const validCh: ChannelType =
        primaryChannel === 'whatsapp' || primaryChannel === 'sms' ? primaryChannel : 'email';
      const fallbackBody = personalizeAutomationMessage(
        auto.stepsSummary[0] || `Hi {{first_name}}, automated sequence step from ${auto.name}`,
        {
          fullName: leadName,
          email: leadEmail,
          phone: leadPhone,
          company: leadCompany,
          listName: leadList,
          senderName: workspace.senderName || workspace.name,
          automationId: auto.id,
        }
      );
      await deliverChannelMessage({
        channel: validCh,
        to: validCh === 'email' ? leadEmail : leadPhone,
        leadName,
        subject: auto.name,
        body: fallbackBody,
        listName: leadList,
        source: 'automation_workflow',
        workspace,
        privateProfile,
      });
    }

    await logActivityEvent(
      'automation_triggered',
      `Executed Workflow Run: ${auto.name} (v${auto.version || 1})`,
      `Lead: ${leadName} · ${resolvedList ? `List: ${resolvedList} · ` : ''}Delivered ${
        parsedGraph.nodes.length
      } nodes across ${auto.channels.join(' + ')}`,
      (auto.channels[0] as ActivityLog['channel']) || 'email'
    );
  };

  const executeLiveCampaignBroadcastDispatch = async (campData: {
    id?: string;
    name: string;
    channel: ChannelType;
    targetList: string;
    subjectOrTemplate: string;
    messageBody: string;
    recipientCount: number;
    overrideFromIdentity?: string;
  }) => {
    const rawTargetLeads = contacts.filter(
      (c) =>
        c.consentStatus === 'opted_in' &&
        c.listName.trim().toLowerCase() === campData.targetList.trim().toLowerCase()
    );

    const eligibleLeads = rawTargetLeads.filter(
      (c) =>
        !evaluateListKillSwitchForContact(
          { tags: c.tags, listName: c.listName, stage: c.stage },
          lists,
          campData.targetList
        ).triggered
    );
    const haltedKillSwitchCount = rawTargetLeads.length - eligibleLeads.length;

    const fallbackEmail =
      currentUser?.email ||
      privateProfile.email ||
      'jonajukej777@gmail.com';

    const fallbackLead = contacts[0] || {
      fullName: 'Broadcast Subscriber',
      email: fallbackEmail,
      phone: privateProfile.whatsappBusinessNumber || privateProfile.phone || '+1 (555) 234-8910',
      company: workspace.name,
    };

    // If matching list leads exist, dispatch to all eligible leads (up to 20 live); otherwise fallback lead
    const dispatchTargets =
      eligibleLeads.length > 0 ? eligibleLeads.slice(0, 20) : [fallbackLead];

    let lastReceipt = null;
    for (const target of dispatchTargets) {
      const recipientEmail = (target?.email || fallbackEmail || 'jonajukej777@gmail.com').trim();
      const recipientPhone = (
        target?.phone ||
        privateProfile.whatsappBusinessNumber ||
        privateProfile.phone ||
        '+1 (555) 234-8910'
      ).trim();

      const personalizedSubject = personalizeAutomationMessage(
        campData.subjectOrTemplate || campData.name,
        {
          fullName: target?.fullName || 'Broadcast Recipient',
          email: recipientEmail,
          phone: recipientPhone,
          company: target?.company || 'Partner',
          listName: campData.targetList,
          senderName: workspace.senderName || workspace.name,
          campaignId: campData.id,
        }
      );
      const personalizedBody = personalizeAutomationMessage(campData.messageBody, {
        fullName: target?.fullName || 'Broadcast Recipient',
        email: recipientEmail,
        phone: recipientPhone,
        company: target?.company || 'Partner',
        listName: campData.targetList,
        senderName: workspace.senderName || workspace.name,
        campaignId: campData.id,
      });

      lastReceipt = await deliverChannelMessage({
        channel: campData.channel,
        to: campData.channel === 'email' ? recipientEmail : recipientPhone,
        leadName: target?.fullName || 'Broadcast Recipient',
        subject: personalizedSubject,
        body: personalizedBody,
        listName: campData.targetList,
        source: 'campaign_broadcast',
        overrideFromIdentity: campData.overrideFromIdentity || undefined,
        workspace,
        privateProfile,
      });
    }

    return {
      eligibleCount: Math.max(eligibleLeads.length, campData.recipientCount, 1),
      haltedKillSwitchCount,
      lastReceipt,
    };
  };

  const handleCreateCampaign = async (
    data: Omit<Campaign, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    const cid = generateSafeId('cmp');
    const ownerUid = currentUser?.uid || workspace.ownerId;
    setCampaigns((prev) => [
      {
        id: cid,
        workspaceId: ownerUid,
        ownerId: ownerUid,
        ...data,
      },
      ...prev,
    ]);

    if (isCloudAuthenticated && auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await setDoc(
          doc(db, 'campaigns', cid),
          sanitizeFirestorePayload({
            workspaceId: uid,
            ownerId: uid,
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `campaigns/${cid}`);
      }
    }

    if (data.status === 'sent') {
      const dispatchSummary = await executeLiveCampaignBroadcastDispatch({
        id: cid,
        name: data.name,
        channel: data.channel,
        targetList: data.targetList,
        subjectOrTemplate: data.subjectOrTemplate,
        messageBody: data.messageBody,
        recipientCount: data.recipientCount,
        overrideFromIdentity: data.overrideFromIdentity,
      });
      await logActivityEvent(
        'campaign_sent',
        `Broadcast Dispatched (${data.channel.toUpperCase()}): ${data.name}`,
        `Target: "${data.targetList}" (${dispatchSummary.eligibleCount} delivered${
          dispatchSummary.haltedKillSwitchCount > 0
            ? ` · ${dispatchSummary.haltedKillSwitchCount} skipped by List Kill Switch`
            : ''
        }) · Via ${dispatchSummary.lastReceipt?.providerUsed || data.channel.toUpperCase()}`,
        data.channel
      );
    } else {
      await logActivityEvent(
        'campaign_sent',
        `Campaign Scheduled (${data.channel.toUpperCase()}): ${data.name}`,
        `Channel: ${data.channel.toUpperCase()} · Target: ${data.targetList} (${data.recipientCount} recipients)`,
        data.channel
      );
    }
  };

  const handleDispatchCampaign = async (camp: Campaign) => {
    if (camp.status === 'sent') return;

    const dispatchSummary = await executeLiveCampaignBroadcastDispatch({
      id: camp.id,
      name: camp.name,
      channel: camp.channel,
      targetList: camp.targetList,
      subjectOrTemplate: camp.subjectOrTemplate,
      messageBody: camp.messageBody,
      recipientCount: camp.recipientCount,
      overrideFromIdentity: camp.overrideFromIdentity,
    });

    const recipients = dispatchSummary.eligibleCount;
    const delivered = recipients;
    const opened = 0;
    const clicked = 0;

    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === camp.id
          ? {
              ...c,
              status: 'sent',
              recipientCount: recipients,
              deliveredCount: delivered,
              openedCount: opened,
              clickedCount: clicked,
            }
          : c
      )
    );

    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await updateDoc(
          doc(db, 'campaigns', camp.id),
          sanitizeFirestorePayload({
            name: camp.name,
            channel: camp.channel,
            targetList: camp.targetList,
            subjectOrTemplate: camp.subjectOrTemplate,
            messageBody: camp.messageBody,
            status: 'sent',
            recipientCount: recipients,
            deliveredCount: delivered,
            openedCount: opened,
            clickedCount: clicked,
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `campaigns/${camp.id}`);
      }
    }

    await logActivityEvent(
      'campaign_sent',
      `Broadcast Dispatched to "${camp.targetList}": ${camp.name}`,
      `${delivered} delivered via ${
        dispatchSummary.lastReceipt?.providerUsed || camp.channel.toUpperCase()
      } (From: ${dispatchSummary.lastReceipt?.fromIdentity || workspace.senderName})${
        dispatchSummary.haltedKillSwitchCount > 0
          ? ` · ${dispatchSummary.haltedKillSwitchCount} contact(s) skipped by List Kill Switch`
          : ''
      }`,
      camp.channel
    );
  };

  const handleUpdateCampaign = async (
    id: string,
    data: Partial<Omit<Campaign, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>>
  ) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...data } : c))
    );

    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await updateDoc(
          doc(db, 'campaigns', id),
          sanitizeFirestorePayload({
            ...data,
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `campaigns/${id}`);
      }
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'campaigns', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `campaigns/${id}`);
      }
    }
  };

  const handleCreateAsset = async (
    data: Omit<CaptureAsset, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    const aid = generateSafeId('ast');
    const ownerUid = currentUser?.uid || workspace.ownerId;
    setAssets((prev) => [
      {
        id: aid,
        workspaceId: ownerUid,
        ownerId: ownerUid,
        ...data,
      },
      ...prev,
    ]);

    if (isCloudAuthenticated && auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await setDoc(
          doc(db, 'assets', aid),
          sanitizeFirestorePayload({
            workspaceId: uid,
            ownerId: uid,
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `assets/${aid}`);
      }
    }

    await logActivityEvent(
      'asset_published',
      `Published Capture Asset: ${data.title}`,
      `Slug: /p/${data.slug} → Routes to ${data.targetList}`,
      'web'
    );
  };

  const handleUpdateAsset = async (
    id: string,
    data: Omit<CaptureAsset, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await updateDoc(
          doc(db, 'assets', id),
          sanitizeFirestorePayload({
            ...data,
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `assets/${id}`);
      }
    }
  };

  const handleDeleteAsset = async (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'assets', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `assets/${id}`);
      }
    }
  };

  const handleSubmitAssetLead = async (
    asset: CaptureAsset,
    lead: { fullName: string; email: string; phone: string },
    extra?: {
      customTags?: string[];
      customFields?: string[];
      company?: string;
      notes?: string;
    }
  ) => {
    // 1. Increment views & submissions on the asset
    if (isCloudAuthenticated && currentUser) {
      try {
        await updateDoc(doc(db, 'assets', asset.id), {
          title: asset.title,
          assetType: asset.assetType,
          slug: asset.slug,
          headline: asset.headline,
          subheadline: asset.subheadline,
          ctaText: asset.ctaText,
          ...(asset.redirectUrl ? { redirectUrl: asset.redirectUrl } : {}),
          ...(asset.toolFormat ? { toolFormat: asset.toolFormat } : {}),
          targetList: asset.targetList,
          requireDoubleOptIn: asset.requireDoubleOptIn,
          status: asset.status,
          viewsCount: asset.viewsCount + 1,
          submissionsCount: asset.submissionsCount + 1,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `assets/${asset.id}`);
      }
    } else {
      setAssets((prev) =>
        prev.map((a) =>
          a.id === asset.id
            ? {
                ...a,
                viewsCount: a.viewsCount + 1,
                submissionsCount: a.submissionsCount + 1,
              }
            : a
        )
      );
    }

    // 2. Store real Contact directly into the selected Contact List in CRM
    const matchedList = lists.find(
      (l) => l.name.trim().toLowerCase() === asset.targetList.trim().toLowerCase()
    );
    const listDefaultTags = matchedList?.defaultTags || [];
    const extraTags = (extra?.customTags || []).map((t) => t.trim().slice(0, 32)).filter(Boolean);
    const combinedTags = Array.from(
      new Set(['funnel-capture', asset.slug.slice(0, 28), ...extraTags, ...listDefaultTags])
    ).slice(0, 10);

    await handleCreateContact({
      fullName: lead.fullName.slice(0, 100),
      email: lead.email.slice(0, 150),
      phone: lead.phone.slice(0, 32),
      company: extra?.company ? extra.company.slice(0, 100) : undefined,
      stage: 'warm_lead',
      temperature: 'warm',
      source: asset.title.slice(0, 80),
      consentStatus: asset.requireDoubleOptIn
        ? 'pending_double_opt_in'
        : matchedList?.defaultConsent || 'opted_in',
      listName: asset.targetList.slice(0, 80),
      tags: combinedTags,
      customFields: extra?.customFields ? extra.customFields.slice(0, 15) : undefined,
      ltv: 0,
      notes: (
        extra?.notes ||
        `Captured via ${asset.title} (/p/${asset.slug}) and routed directly to list "${asset.targetList}".`
      ).slice(0, 500),
    });

    // 3. Smooth Automation: Automatically trigger any active Automation running on this Contact List
    const matchingAutomations = automations.filter((auto) => {
      if (auto.status !== 'active') return false;
      const autoList = resolveAutomationTargetList(auto).toLowerCase();
      const targetClean = asset.targetList.trim().toLowerCase();
      return (
        autoList === targetClean ||
        auto.triggerDetail.toLowerCase().includes(targetClean)
      );
    });

    for (const auto of matchingAutomations) {
      await handleSimulateAutomationRun(auto, {
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        company: extra?.company,
        listName: asset.targetList,
        tags: combinedTags,
        stage: 'warm_lead',
        temperature: 'warm',
      });
    }
  };

  const handleCreateChatbot = async (
    data: Omit<ChatbotFlow, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    const bid = generateSafeId('bot');
    const ownerUid = currentUser?.uid || workspace.ownerId;
    setChatbots((prev) => [
      {
        id: bid,
        workspaceId: ownerUid,
        ownerId: ownerUid,
        ...data,
      },
      ...prev,
    ]);

    if (isCloudAuthenticated && auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await setDoc(
          doc(db, 'chatbots', bid),
          sanitizeFirestorePayload({
            workspaceId: uid,
            ownerId: uid,
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `chatbots/${bid}`);
      }
    }
  };

  const handleDeleteChatbot = async (id: string) => {
    setChatbots((prev) => prev.filter((b) => b.id !== id));
    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'chatbots', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `chatbots/${id}`);
      }
    }
  };

  const handleRecordBotSession = async (bot: ChatbotFlow) => {
    if (bot.status === 'archived') return;
    setChatbots((prev) =>
      prev.map((b) =>
        b.id === bot.id
          ? {
              ...b,
              sessionsCount: b.sessionsCount + 1,
              resolvedCount: b.resolvedCount + 1,
            }
          : b
      )
    );

    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await updateDoc(
          doc(db, 'chatbots', bot.id),
          sanitizeFirestorePayload({
            name: bot.name,
            triggerKeyword: bot.triggerKeyword,
            matchType: bot.matchType,
            welcomeMessage: bot.welcomeMessage,
            menuOptions: bot.menuOptions,
            handoffToHuman: bot.handoffToHuman,
            status: bot.status,
            sessionsCount: bot.sessionsCount + 1,
            resolvedCount: bot.resolvedCount + 1,
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `chatbots/${bot.id}`);
      }
    }

    const targetLead = contacts[0];
    const waReceipt = await deliverChannelMessage({
      channel: 'whatsapp',
      to: targetLead?.phone || privateProfile.whatsappBusinessNumber || '+1 (555) 234-8910',
      leadName: targetLead?.fullName || 'WhatsApp Lead',
      subject: bot.name,
      body: `${bot.welcomeMessage}\n\nOptions:\n${(bot.menuOptions || []).join('\n')}`,
      listName: targetLead?.listName || 'WhatsApp Bot Leads',
      source: 'whatsapp_bot',
      workspace,
      privateProfile,
    });

    await logActivityEvent(
      'whatsapp_replied',
      `WhatsApp Bot Triggered: ${bot.name} ("${bot.triggerKeyword}")`,
      `Delivered automated welcome menu via ${waReceipt.providerUsed} (From: ${waReceipt.fromIdentity} → To: ${waReceipt.toRecipient})`,
      'whatsapp'
    );
  };

  const handleCreateAutoResponder = async (
    data: Omit<AutoResponder, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    const arid = generateSafeId('ar');
    const ownerUid = currentUser?.uid || workspace.ownerId;
    setAutoResponders((prev) => [
      {
        id: arid,
        workspaceId: ownerUid,
        ownerId: ownerUid,
        ...data,
      },
      ...prev,
    ]);

    if (isCloudAuthenticated && auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await setDoc(
          doc(db, 'autoresponders', arid),
          sanitizeFirestorePayload({
            workspaceId: uid,
            ownerId: uid,
            name: data.name.slice(0, 120),
            targetList: data.targetList.slice(0, 100),
            triggerMessage: data.triggerMessage.slice(0, 500),
            responseMessage: data.responseMessage.slice(0, 2000),
            channel: data.channel,
            ...(data.matchType ? { matchType: data.matchType } : {}),
            ...(data.subjectLine ? { subjectLine: data.subjectLine.slice(0, 160) } : {}),
            status: data.status,
            triggeredCount: data.triggeredCount || 0,
            sentCount: data.sentCount || 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `autoresponders/${arid}`);
      }
    }

    await logActivityEvent(
      'automation_triggered',
      `Auto Responder Live (${data.channel.toUpperCase()}): ${data.name}`,
      `List: "${data.targetList}" · Trigger: "${data.triggerMessage.slice(0, 60)}"`,
      data.channel
    );
  };

  const handleUpdateAutoResponder = async (
    id: string,
    data: Omit<AutoResponder, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    setAutoResponders((prev) =>
      prev.map((ar) => (ar.id === id ? { ...ar, ...data } : ar))
    );

    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await updateDoc(
          doc(db, 'autoresponders', id),
          sanitizeFirestorePayload({
            name: data.name.slice(0, 120),
            targetList: data.targetList.slice(0, 100),
            triggerMessage: data.triggerMessage.slice(0, 500),
            responseMessage: data.responseMessage.slice(0, 2000),
            channel: data.channel,
            ...(data.matchType ? { matchType: data.matchType } : {}),
            ...(data.subjectLine ? { subjectLine: data.subjectLine.slice(0, 160) } : {}),
            status: data.status,
            triggeredCount: data.triggeredCount,
            sentCount: data.sentCount,
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `autoresponders/${id}`);
      }
    }
  };

  const handleDeleteAutoResponder = async (id: string) => {
    setAutoResponders((prev) => prev.filter((ar) => ar.id !== id));
    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'autoresponders', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `autoresponders/${id}`);
      }
    }
  };

  const handleCreateInboxThread = async (
    data: Omit<InboxThread, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    const tid = generateSafeId('inb');
    const ownerUid = currentUser?.uid || workspace.ownerId;
    setInboxThreads((prev) => [
      {
        id: tid,
        workspaceId: ownerUid,
        ownerId: ownerUid,
        ...data,
      },
      ...prev,
    ]);

    if (isCloudAuthenticated && auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await setDoc(
          doc(db, 'inbox_threads', tid),
          sanitizeFirestorePayload({
            workspaceId: uid,
            ownerId: uid,
            leadName: data.leadName.slice(0, 120),
            leadEmail: (data.leadEmail || '').slice(0, 150),
            leadPhone: (data.leadPhone || '').slice(0, 40),
            listName: data.listName.slice(0, 100),
            channel: data.channel,
            subjectOrContext: data.subjectOrContext.slice(0, 160),
            lastLeadMessage: data.lastLeadMessage.slice(0, 2000),
            lastMessagePreview: data.lastMessagePreview.slice(0, 500),
            lastSender: data.lastSender,
            status: data.status,
            unreadCount: data.unreadCount || 0,
            messagesJson: data.messagesJson.slice(0, 20000),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `inbox_threads/${tid}`);
      }
    }

    await logActivityEvent(
      'whatsapp_replied',
      `New Lead Reply in Inbox (${data.channel.toUpperCase()}): ${data.leadName}`,
      `List: "${data.listName}" · Message: "${data.lastLeadMessage.slice(0, 80)}"`,
      data.channel
    );

    return tid;
  };

  const handleUpdateInboxThread = async (
    id: string,
    data: Omit<InboxThread, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    setInboxThreads((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...data } : t))
    );

    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await updateDoc(
          doc(db, 'inbox_threads', id),
          sanitizeFirestorePayload({
            leadName: data.leadName.slice(0, 120),
            leadEmail: (data.leadEmail || '').slice(0, 150),
            leadPhone: (data.leadPhone || '').slice(0, 40),
            listName: data.listName.slice(0, 100),
            channel: data.channel,
            subjectOrContext: data.subjectOrContext.slice(0, 160),
            lastLeadMessage: data.lastLeadMessage.slice(0, 2000),
            lastMessagePreview: data.lastMessagePreview.slice(0, 500),
            lastSender: data.lastSender,
            status: data.status,
            unreadCount: data.unreadCount,
            messagesJson: data.messagesJson.slice(0, 20000),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `inbox_threads/${id}`);
      }
    }
  };

  const handleDeleteInboxThread = async (id: string) => {
    setInboxThreads((prev) => prev.filter((t) => t.id !== id));
    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'inbox_threads', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `inbox_threads/${id}`);
      }
    }
  };

  // Forward WhatsApp Bot / Operator conversations into Unified Inbox
  const handleForwardBotToInbox = async (payload: {
    leadName: string;
    leadPhone: string;
    leadEmail?: string;
    listName: string;
    customerMessage?: string;
    outboundReply: string;
    contextLabel: string;
  }) => {
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const msgs: Array<{
      id: string;
      sender: 'lead' | 'operator' | 'autoresponder';
      senderName: string;
      channel: ChannelType;
      body: string;
      timestamp: string;
    }> = [];

    if (payload.customerMessage) {
      msgs.push({
        id: generateSafeId('msg_in'),
        sender: 'lead',
        senderName: payload.leadName,
        channel: 'whatsapp',
        body: payload.customerMessage,
        timestamp: `Today, ${nowTime}`,
      });
    }
    if (payload.outboundReply) {
      msgs.push({
        id: generateSafeId('msg_out'),
        sender: payload.customerMessage ? 'autoresponder' : 'operator',
        senderName: payload.contextLabel,
        channel: 'whatsapp',
        body: payload.outboundReply,
        timestamp: `Today, ${nowTime}`,
      });
    }

    await handleCreateInboxThread({
      leadName: payload.leadName,
      leadEmail: payload.leadEmail || 'whatsapp.lead@example.com',
      leadPhone: payload.leadPhone,
      listName: payload.listName || 'WhatsApp Bot Conversations',
      channel: 'whatsapp',
      subjectOrContext: payload.contextLabel,
      lastLeadMessage: payload.customerMessage || payload.outboundReply,
      lastMessagePreview: payload.outboundReply
        ? `${payload.contextLabel}: ${payload.outboundReply}`.slice(0, 500)
        : `${payload.leadName}: ${payload.customerMessage || ''}`.slice(0, 500),
      lastSender: payload.outboundReply
        ? payload.customerMessage
          ? 'autoresponder'
          : 'operator'
        : 'lead',
      status: payload.customerMessage && !payload.outboundReply ? 'unread' : 'replied',
      unreadCount: payload.customerMessage && !payload.outboundReply ? 1 : 0,
      messagesJson: JSON.stringify(msgs),
    });
  };

  // Poll & process live inbound webhooks (/api/webhooks/inbound), public lead captures (/api/leads/capture), and tracking/unsubscribe events (/api/track/events)
  useEffect(() => {
    if (viewMode !== 'workspace') return;
    const interval = setInterval(async () => {
      // A. Poll Inbound Messaging Webhooks (WhatsApp, Email, SMS)
      const items = await pollAndConsumeInboundWebhooks();
      for (const item of items) {
        const cleanChannel: ChannelType =
          item.channel === 'email' || item.channel === 'sms' ? item.channel : 'whatsapp';
        const cleanLeadName = item.leadName || 'Inbound Lead';
        const cleanList = item.listName || lists[0]?.name || 'General Contacts';
        const cleanMessage = item.message || 'Hello!';
        const trimmedUpper = cleanMessage.trim().toUpperCase();
        const isOptOutKeyword = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(
          trimmedUpper
        );
        const nowTime = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        // If inbound message is STOP / UNSUBSCRIBE, enforce global suppression across all channels
        if (isOptOutKeyword) {
          const senderLookup = (item.leadEmail || item.leadPhone || '').trim().toLowerCase();
          const senderDigits = (item.leadPhone || '').replace(/\D/g, '');
          const matchedContact = contacts.find((c) => {
            if (senderLookup && c.email.trim().toLowerCase() === senderLookup) return true;
            const cDigits = (c.phone || '').replace(/\D/g, '');
            return (
              senderDigits.length >= 7 &&
              cDigits.length >= 7 &&
              (cDigits.endsWith(senderDigits) || senderDigits.endsWith(cDigits))
            );
          });
          if (matchedContact) {
            const supTags = Array.from(
              new Set([...(matchedContact.tags || []), 'unsubscribed', 'global-opt-out'])
            ).slice(0, 10);
            await handleUpdateContact(matchedContact.id, {
              fullName: matchedContact.fullName,
              email: matchedContact.email,
              phone: matchedContact.phone,
              company: matchedContact.company,
              dealTitle: matchedContact.dealTitle,
              stage: matchedContact.stage,
              temperature: matchedContact.temperature,
              source: matchedContact.source,
              consentStatus: 'unsubscribed',
              commChannels: [],
              listName: matchedContact.listName,
              tags: supTags,
              ltv: matchedContact.ltv,
              notes: `${matchedContact.notes || ''} [Global Opt-Out via Inbound "${trimmedUpper}"]`
                .trim()
                .slice(0, 500),
              customFields: matchedContact.customFields,
            });
          }
          await triggerOneClickUnsubscribe({
            recipient: item.leadEmail || item.leadPhone || cleanLeadName,
            reason: `Inbound ${cleanChannel.toUpperCase()} keyword "${trimmedUpper}"`,
            action: 'unsubscribe',
          });
        }

        const threadMsgs: Array<{
          id: string;
          sender: 'lead' | 'operator' | 'autoresponder';
          senderName: string;
          channel: ChannelType;
          body: string;
          timestamp: string;
        }> = [
          {
            id: generateSafeId('msg_wh_in'),
            sender: 'lead',
            senderName: cleanLeadName,
            channel: cleanChannel,
            body: cleanMessage,
            timestamp: `Today, ${nowTime}`,
          },
        ];

        // 1. Check matching active Auto Responder (skip if lead just opted out)
        const matchedAr = !isOptOutKeyword
          ? autoResponders.find((ar) => {
              if (ar.status !== 'live' || ar.channel !== cleanChannel) return false;
              if (ar.matchType === 'any_inbound') return true;
              if (ar.matchType === 'exact') {
                return cleanMessage.trim().toLowerCase() === ar.triggerMessage.trim().toLowerCase();
              }
              return cleanMessage.toLowerCase().includes(ar.triggerMessage.trim().toLowerCase());
            })
          : undefined;

        let autoDispatchedText = '';
        let autoDispatchedLabel = '';

        if (matchedAr) {
          autoDispatchedText = matchedAr.responseMessage
            .replace(/\{\{\s*first_name\s*\}\}/gi, cleanLeadName.split(' ')[0] || 'there')
            .replace(/\{\{\s*full_name\s*\}\}/gi, cleanLeadName)
            .replace(/\{\{\s*list_name\s*\}\}/gi, cleanList);
          autoDispatchedLabel = `Auto Responder (${matchedAr.name})`;

          await deliverChannelMessage({
            channel: cleanChannel,
            to:
              cleanChannel === 'email'
                ? item.leadEmail || 'lead@example.com'
                : item.leadPhone || '+1 (555) 234-8910',
            leadName: cleanLeadName,
            subject: matchedAr.subjectLine || item.subject || `Re: ${matchedAr.name}`,
            body: autoDispatchedText,
            listName: cleanList,
            source: 'auto_responder',
            workspace,
            privateProfile,
          });
        } else if (!isOptOutKeyword && cleanChannel === 'whatsapp') {
          // 2. Check matching active WhatsApp Keyword Bot
          const matchedBot = chatbots.find((b) => {
            if (b.status !== 'active') return false;
            const kw = b.triggerKeyword.trim().toLowerCase();
            const msgLower = cleanMessage.toLowerCase();
            if (b.matchType === 'exact') return msgLower === kw;
            if (b.matchType === 'first_message') return true;
            return msgLower.includes(kw);
          });

          if (matchedBot) {
            autoDispatchedText = matchedBot.welcomeMessage;
            autoDispatchedLabel = `WhatsApp Bot (${matchedBot.name})`;
            await deliverChannelMessage({
              channel: 'whatsapp',
              to: item.leadPhone || '+1 (555) 234-8910',
              leadName: cleanLeadName,
              subject: matchedBot.name,
              body: autoDispatchedText,
              listName: cleanList,
              source: 'whatsapp_bot',
              workspace,
              privateProfile,
            });
          }
        }

        if (autoDispatchedText) {
          threadMsgs.push({
            id: generateSafeId('msg_wh_ar'),
            sender: 'autoresponder',
            senderName: autoDispatchedLabel,
            channel: cleanChannel,
            body: autoDispatchedText,
            timestamp: `Today, ${nowTime} (Auto-Pilot)`,
          });
        }

        await handleCreateInboxThread({
          leadName: cleanLeadName,
          leadEmail: item.leadEmail || 'inbound@example.com',
          leadPhone: item.leadPhone || '+1 (555) 234-8910',
          listName: cleanList,
          channel: cleanChannel,
          subjectOrContext: item.subject || `Inbound ${cleanChannel.toUpperCase()} Webhook`,
          lastLeadMessage: cleanMessage,
          lastMessagePreview: autoDispatchedText
            ? `${autoDispatchedLabel}: ${autoDispatchedText}`.slice(0, 500)
            : `${cleanLeadName}: ${cleanMessage}`.slice(0, 500),
          lastSender: autoDispatchedText ? 'autoresponder' : 'lead',
          status: 'unread',
          unreadCount: 1,
          messagesJson: JSON.stringify(threadMsgs),
        });
      }

      // B. Poll Public Lead Capture Submissions (POST /api/leads/capture)
      const capturedLeads = await pollAndConsumePublicLeadCaptures();
      for (const leadItem of capturedLeads) {
        const matchedAsset =
          assets.find((a) => a.slug.toLowerCase() === leadItem.assetSlug.toLowerCase()) ||
          assets[0];
        if (matchedAsset) {
          await handleSubmitAssetLead(
            {
              ...matchedAsset,
              targetList: leadItem.targetList || matchedAsset.targetList,
            },
            {
              fullName: leadItem.fullName,
              email: leadItem.email,
              phone: leadItem.phone,
            },
            {
              customTags: leadItem.tags,
              customFields: leadItem.customFields,
              company: leadItem.company || undefined,
              notes: leadItem.notes || undefined,
            }
          );
        }
      }

      // C. Poll Live Email Open, Link Click & Global Unsubscribe Events
      const trackingEvents = await pollAndConsumeTrackingComplianceEvents();
      for (const trk of trackingEvents) {
        if (trk.eventType === 'open' || trk.eventType === 'click') {
          const targetCamp =
            campaigns.find((c) => c.id === trk.campaignId) ||
            campaigns.find((c) => c.status === 'sent') ||
            campaigns[0];
          if (targetCamp) {
            const nextOpened =
              trk.eventType === 'open' ? targetCamp.openedCount + 1 : targetCamp.openedCount;
            const nextClicked =
              trk.eventType === 'click' ? targetCamp.clickedCount + 1 : targetCamp.clickedCount;
            await handleUpdateCampaign(targetCamp.id, {
              openedCount: nextOpened,
              clickedCount: nextClicked,
            });
            await logActivityEvent(
              'campaign_sent',
              `Live ${trk.eventType === 'open' ? 'Email Open' : 'Link Click'} Tracked: ${targetCamp.name}`,
              `Recipient: ${trk.recipient || 'Subscriber'}${
                trk.targetUrl ? ` → ${trk.targetUrl}` : ''
              }`,
              targetCamp.channel
            );
          }
        } else if (trk.eventType === 'unsubscribe' || trk.eventType === 'resubscribe') {
          const isUnsub = trk.eventType === 'unsubscribe';
          const recClean = (trk.recipient || '').trim().toLowerCase();
          const recDigits = (trk.recipient || '').replace(/\D/g, '');
          const matchedContact = contacts.find((c) => {
            if (recClean && c.email.trim().toLowerCase() === recClean) return true;
            const cDigits = (c.phone || '').replace(/\D/g, '');
            return (
              recDigits.length >= 7 &&
              cDigits.length >= 7 &&
              (cDigits.endsWith(recDigits) || recDigits.endsWith(cDigits))
            );
          });
          if (matchedContact) {
            const updatedTags = isUnsub
              ? Array.from(
                  new Set([...(matchedContact.tags || []), 'unsubscribed', 'global-opt-out'])
                ).slice(0, 10)
              : (matchedContact.tags || []).filter(
                  (t) => t !== 'unsubscribed' && t !== 'global-opt-out' && t !== 'suppressed'
                );
            await handleUpdateContact(matchedContact.id, {
              fullName: matchedContact.fullName,
              email: matchedContact.email,
              phone: matchedContact.phone,
              company: matchedContact.company,
              dealTitle: matchedContact.dealTitle,
              stage: matchedContact.stage,
              temperature: matchedContact.temperature,
              source: matchedContact.source,
              consentStatus: isUnsub ? 'unsubscribed' : 'opted_in',
              commChannels: isUnsub ? [] : ['email', 'whatsapp', 'sms'],
              listName: matchedContact.listName,
              tags: updatedTags,
              ltv: matchedContact.ltv,
              notes: `${matchedContact.notes || ''} [${
                isUnsub ? 'Global Unsubscribe Opt-Out' : 'Opt-In Restored'
              }]`
                .trim()
                .slice(0, 500),
              customFields: matchedContact.customFields,
            });
          }
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [
    viewMode,
    autoResponders,
    chatbots,
    lists,
    assets,
    campaigns,
    contacts,
    workspace,
    privateProfile,
  ]);

  const handleCreateTask = async (
    data: Omit<TaskItem, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    const tid = generateSafeId('tsk');
    const ownerUid = currentUser?.uid || workspace.ownerId;
    setTasks((prev) => [
      {
        id: tid,
        workspaceId: ownerUid,
        ownerId: ownerUid,
        ...data,
      },
      ...prev,
    ]);

    if (isCloudAuthenticated && auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await setDoc(
          doc(db, 'tasks', tid),
          sanitizeFirestorePayload({
            workspaceId: uid,
            ownerId: uid,
            title: data.title.slice(0, 160),
            category: data.category,
            priority: data.priority,
            dueDate: data.dueDate.slice(0, 40),
            relatedEntity: data.relatedEntity.slice(0, 100),
            status: data.status,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `tasks/${tid}`);
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'tasks', taskId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
      }
    }
  };

  const handleCompleteTask = async (task: TaskItem) => {
    if (task.status === 'completed') return;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: 'completed', dueDate: 'Completed' } : t
      )
    );

    if (isCloudAuthenticated && auth.currentUser) {
      try {
        await updateDoc(
          doc(db, 'tasks', task.id),
          sanitizeFirestorePayload({
            title: task.title,
            category: task.category,
            priority: task.priority,
            dueDate: 'Completed',
            relatedEntity: task.relatedEntity,
            status: 'completed',
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
      }
    }
  };

  const handleUpdateWorkspace = async (
    data: Omit<Workspace, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    setWorkspace((prev) => ({ ...prev, ...data }));
    if (isCloudAuthenticated && auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await updateDoc(
          doc(db, 'workspaces', uid),
          sanitizeFirestorePayload({
            ...data,
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `workspaces/${uid}`);
      }
    }
  };

  const handleUpdatePrivateProfile = async (
    data: Omit<UserPrivateProfile, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    setPrivateProfile((prev) => ({ ...prev, ...data }));
    if (isCloudAuthenticated && auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await updateDoc(
          doc(db, 'users', uid, 'private', 'default'),
          sanitizeFirestorePayload({
            ...data,
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `users/${uid}/private/default`
        );
      }
    }
  };

  const handleAddMember = async (data: {
    memberName: string;
    memberEmail: string;
    role: MemberRole;
  }) => {
    const mid = generateSafeId('mem');
    const ownerUid = currentUser?.uid || workspace.ownerId;
    setMembers((prev) => [
      ...prev,
      {
        id: mid,
        workspaceId: ownerUid,
        ownerId: ownerUid,
        memberName: data.memberName,
        memberEmail: data.memberEmail,
        role: data.role,
        status: 'active',
      },
    ]);

    if (isCloudAuthenticated && auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await setDoc(
          doc(db, 'workspaces', uid, 'members', mid),
          sanitizeFirestorePayload({
            workspaceId: uid,
            ownerId: uid,
            memberName: data.memberName,
            memberEmail: data.memberEmail,
            role: data.role,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `workspaces/${uid}/members/${mid}`
        );
      }
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    if (isCloudAuthenticated && auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await deleteDoc(doc(db, 'workspaces', uid, 'members', memberId));
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `workspaces/${uid}/members/${memberId}`
        );
      }
    }
  };

  const handleQuickAction = (
    action:
      | 'add_contact'
      | 'create_automation'
      | 'create_form'
      | 'create_landing_page'
      | 'create_campaign'
      | 'send_broadcast'
  ) => {
    switch (action) {
      case 'add_contact':
        setOpenContactModal(true);
        setActiveTab('contacts');
        break;
      case 'create_automation':
        setOpenAutomationModal(true);
        setActiveTab('automations');
        break;
      case 'create_form':
        setOpenAssetModalMode('inline_form');
        setActiveTab('assets');
        break;
      case 'create_landing_page':
        setOpenAssetModalMode('landing_page');
        setActiveTab('assets');
        break;
      case 'create_campaign':
        setInstantSendBroadcast(false);
        setOpenCampaignModal(true);
        setActiveTab('campaigns');
        break;
      case 'send_broadcast':
        setInstantSendBroadcast(true);
        setOpenCampaignModal(true);
        setActiveTab('campaigns');
        break;
    }
  };

  // Standalone Public One-Click Unsubscribe & Global Suppression Route (?unsubscribe=<recipient>)
  if (publicUnsubscribeRecipient) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col justify-between">
        <header className="bg-[#0F172A] text-white px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-slate-800">
          <FlowPilotLogo variant="dark" size="sm" />
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.searchParams.delete('unsubscribe');
                url.searchParams.delete('campaignId');
                url.searchParams.delete('automationId');
                window.history.replaceState({}, '', url.toString());
              }
              setPublicUnsubscribeRecipient(null);
              setViewMode('workspace');
              setActiveTab('campaigns');
            }}
            className="px-3 py-1.5 text-xs font-bold text-emerald-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg cursor-pointer"
          >
            ← Back to Workspace
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-lg w-full bg-white border border-slate-200 border-t-4 border-t-emerald-700 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Global Subscription &amp; Compliance Center
              </div>
              <h1 className="font-display text-2xl font-bold text-slate-950">
                Manage Communication Preferences
              </h1>
              <p className="text-sm text-slate-600">
                Recipient Identity:{' '}
                <span className="font-mono font-bold text-slate-900">
                  {publicUnsubscribeRecipient}
                </span>
              </p>
            </div>

            {unsubConfirmed && !unsubRestored ? (
              <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                <div className="font-bold text-emerald-950 text-sm">
                  Global Opt-Out Confirmed Across All Channels
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  <strong>{publicUnsubscribeRecipient}</strong> has been added to the global
                  suppression registry and removed from all Email, WhatsApp, and SMS broadcasts and
                  automated workflows.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    await triggerOneClickUnsubscribe({
                      recipient: publicUnsubscribeRecipient,
                      action: 'resubscribe',
                      reason: 'User self-restored opt-in from preference page',
                    });
                    setUnsubRestored(true);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Changed your mind? Re-Subscribe to Updates
                </button>
              </div>
            ) : unsubRestored ? (
              <div className="p-5 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                <div className="font-bold text-blue-950 text-sm">
                  Subscription Restored
                </div>
                <p className="text-xs text-blue-900">
                  <strong>{publicUnsubscribeRecipient}</strong> has been removed from global
                  suppression and opted back in to workspace communications.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Click below to immediately opt out of all future Email, WhatsApp, and SMS
                  messages from <strong>{workspace.name}</strong>.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    await triggerOneClickUnsubscribe({
                      recipient: publicUnsubscribeRecipient,
                      action: 'unsubscribe',
                      reason: 'One-click unsubscribe link clicked',
                    });
                    setUnsubConfirmed(true);
                  }}
                  className="w-full py-3 px-5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer"
                >
                  Confirm One-Click Unsubscribe (All Channels)
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Public Shareable Lead Capture Route (?capture=<slug> | ?page=<slug> | ?form=<slug>)
  if (publicCaptureSlug) {
    const matchedAsset = assets.find(
      (a) => a.slug.toLowerCase() === publicCaptureSlug.toLowerCase()
    ) || {
      id: `pub_${publicCaptureSlug}`,
      workspaceId: workspace.id,
      ownerId: workspace.ownerId,
      title: publicCaptureSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      assetType: 'landing_page' as const,
      slug: publicCaptureSlug,
      headline: 'Get Instant Access to Our Exclusive Resource',
      subheadline: 'Enter your contact details below to unlock immediate access.',
      ctaText: 'Continue & Get Access →',
      redirectUrl: `https://flowpilot.app/p/${publicCaptureSlug}/thank-you`,
      targetList: lists[0]?.name || 'General Contacts',
      requireDoubleOptIn: false,
      status: 'published' as const,
      viewsCount: 1,
      submissionsCount: 0,
    };

    let savedRedirect = matchedAsset.redirectUrl || `https://flowpilot.app/p/${matchedAsset.slug}/thank-you`;
    try {
      const rawMap = localStorage.getItem('fp_leadgen_extended_v1');
      if (rawMap) {
        const parsed = JSON.parse(rawMap);
        if (parsed[matchedAsset.slug]?.redirectUrl) {
          savedRedirect = parsed[matchedAsset.slug].redirectUrl;
        }
      }
    } catch {
      // ignore storage errors
    }

    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col justify-between">
        <header className="bg-[#0F172A] text-white px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-slate-800">
          <FlowPilotLogo variant="dark" size="sm" />
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.searchParams.delete('capture');
                url.searchParams.delete('page');
                url.searchParams.delete('form');
                window.history.replaceState({}, '', url.toString());
              }
              setPublicCaptureSlug(null);
              setViewMode('workspace');
              setActiveTab('assets');
            }}
            className="px-3 py-1.5 text-xs font-bold text-emerald-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg cursor-pointer"
          >
            ← Back to Pages &amp; Forms Studio
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-xl w-full bg-white border border-slate-200 border-t-4 border-t-emerald-700 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                {matchedAsset.title}
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 leading-tight">
                {matchedAsset.headline}
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">{matchedAsset.subheadline}</p>
            </div>

            {pubSubmitted ? (
              <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                <div className="font-bold text-emerald-950 text-sm">
                  Thank you! Your details have been submitted and routed to "{matchedAsset.targetList}".
                </div>
                <p className="text-xs text-emerald-900">
                  Click the button below to continue to your destination link:
                </p>
                <div className="pt-1 flex flex-wrap items-center gap-2.5">
                  <a
                    href={savedRedirect}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl inline-flex items-center gap-2 cursor-pointer"
                  >
                    <span>Continue to {savedRedirect}</span>
                    <span>→</span>
                  </a>
                </div>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!pubName.trim() || !pubEmail.trim()) return;
                  await submitPublicLeadToCaptureWebhook({
                    assetSlug: matchedAsset.slug,
                    targetList: matchedAsset.targetList,
                    fullName: pubName.trim(),
                    email: pubEmail.trim(),
                    phone: pubPhone.trim(),
                    redirectUrl: savedRedirect,
                  });
                  await handleSubmitAssetLead(matchedAsset, {
                    fullName: pubName.trim(),
                    email: pubEmail.trim(),
                    phone: pubPhone.trim(),
                  });
                  setPubSubmitted(true);
                }}
                className="space-y-3.5 text-xs sm:text-sm"
              >
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={pubName}
                    onChange={(e) => setPubName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={pubEmail}
                    onChange={(e) => setPubEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    WhatsApp / Mobile Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={pubPhone}
                    onChange={(e) => setPubPhone(e.target.value)}
                    placeholder="+1 (555) 019-2831"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 px-5 text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors cursor-pointer"
                >
                  {matchedAsset.ctaText}
                </button>
              </form>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Initial Auth Loading Screen (eliminates auth flicker)
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#090D16] flex flex-col items-center justify-center text-white p-4">
        <FlowPilotLogo variant="dark" size="lg" />
        <div className="flex items-center gap-2.5 mt-6 text-sm text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span>Initializing secure session...</span>
        </div>
      </div>
    );
  }

  // Public Landing Page View
  if (viewMode === 'landing') {
    return (
      <>
        <LandingPage
          onOpenAuth={handleOpenAuthModal}
          onEnterWorkspace={() => {
            if (isSignedInAny) {
              setViewMode('workspace');
              setActiveTab('dashboard');
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/dashboard');
              }
            } else {
              handleOpenAuthModal('signin');
            }
          }}
          isAuthenticated={isSignedInAny}
          themeMode={themeMode}
          onToggleThemeMode={() => handleToggleThemeMode()}
          onCapturePublicLead={async (lead) => {
            await handleCreateContact({
              fullName: lead.fullName,
              email: lead.email,
              phone: lead.phone,
              stage: 'warm_lead',
              temperature: 'hot',
              source: 'Public Homepage Capture Form',
              consentStatus: 'opted_in',
              listName: 'General Contacts',
              tags: ['homepage-opt-in', lead.segment.toLowerCase().slice(0, 24)],
              ltv: 0,
              notes: `Submitted via public homepage capture form (${lead.segment}).`,
            });
          }}
        />
        <AuthModal
          isOpen={authModalOpen}
          initialMode={authModalMode}
          onClose={handleCloseAuthModal}
          onAuthSuccess={(opts) => {
            setAuthModalOpen(false);
            setViewMode('workspace');
            setActiveTab('dashboard');
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, '', '/dashboard');
            }
            if (opts?.uid && opts?.email) {
              const resolvedUser =
                auth.currentUser ||
                createSyntheticFirebaseUser({
                  uid: opts.uid,
                  email: opts.email,
                  displayName: opts.fullName || opts.email.split('@')[0],
                  workspaceName: opts.workspaceName || `${opts.fullName || 'User'}'s Workspace`,
                  provider: opts.email.includes('google') ? 'google.com' : 'password',
                  emailVerified: true,
                  isFirebaseUser: true,
                });
              setCurrentUser(resolvedUser);
            }
            if (opts?.email) {
              setAuthBanner(
                `Signed in as ${opts.email}. Welcome to your workspace dashboard.`
              );
            }
          }}
        />
      </>
    );
  }

  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: inboxThreads.length },
    { id: 'contacts', label: 'CRM & Contacts', icon: Users, count: contacts.length },
    { id: 'lists', label: 'Contact Lists', icon: Layers, count: lists.length },
    { id: 'autoresponders', label: 'Auto Responder', icon: Zap, count: autoResponders.length },
    { id: 'automations', label: 'Automations', icon: GitBranch, count: automations.length },
    { id: 'campaigns', label: 'Broadcasts', icon: Send, count: campaigns.length },
    { id: 'assets', label: 'Pages & Forms', icon: FileText, count: assets.length },
    { id: 'funnels', label: 'Funnel Builder', icon: TrendingUp },
    { id: 'chatbots', label: 'WhatsApp Bots', icon: MessageSquare, count: chatbots.length },
    { id: 'settings', label: 'Workspace & Auth', icon: Settings },
  ];

  const activeNavLabel = navItems.find((n) => n.id === activeTab)?.label || 'Overview';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex transition-colors duration-200">
      {/* Desktop Sidebar Navigation (256px Width) — 60-30-10 Deep Slate/Navy & Cobalt Blue */}
      <aside className="hidden lg:flex flex-col w-[256px] shrink-0 bg-[#090D16] text-white border-r border-slate-800 justify-between">
        <div className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="inline-flex items-center cursor-pointer"
            >
              <FlowPilotLogo variant="dark" size="md" />
            </button>
            <span className="text-[11px] font-mono text-[#22D3EE] font-bold">
              $0 Free
            </span>
          </div>

          {/* Workspace Tenant Context */}
          <div className="p-3.5 rounded-xl bg-[#0F172A] border border-slate-800">
            <div className="text-xs font-display font-bold text-white truncate">
              {workspace.name}
            </div>
            <div className="text-[11px] font-mono text-[#22D3EE] mt-0.5 capitalize truncate">
              {workspace.category} · {workspace.currency} · {workspace.timezone.split('/')[1] || workspace.timezone}
            </div>
          </div>

          {/* Navigation Links — 10% Action Accent: Cobalt Blue Active Trigger */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#2563EB] text-white font-bold shadow-sm ring-1 ring-blue-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.count === 'number' && (
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        isActive ? 'text-blue-100 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Compliance & Public Site Link */}
        <div className="p-5 border-t border-slate-800 space-y-2.5">
          <div className="text-[11px] text-slate-300 leading-relaxed">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Official APIs &amp; Opt-In Only</span>
            </div>
            <p className="mt-1 text-slate-400">
              Zero platform fees. Provider pass-through charges billed directly by your carrier.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setViewMode('landing')}
            className="w-full py-2 px-3.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-[#22D3EE]" />
            <span>View Public Platform Page</span>
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Strict SaaS Top Header Contract: Breadcrumbs on Left, Theme + Actions & Account on Right */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
          <div className="px-3.5 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-1.5 text-slate-700 hover:text-slate-950 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <div className="text-xs sm:text-sm font-medium text-slate-500 truncate flex items-center min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="lg:hidden inline-flex items-center mr-1.5 shrink-0 cursor-pointer"
                >
                  <FlowPilotLogo variant={themeMode === 'dark' ? 'dark' : 'light'} size="sm" />
                </button>
                <span className="hidden sm:inline text-slate-700 truncate max-w-[160px]">
                  {workspace.name}
                </span>
                <span aria-hidden="true" className="mx-1.5 sm:mx-2 text-slate-300">
                  /
                </span>
                <span className="font-display font-bold text-slate-950 text-xs sm:text-sm lg:text-base truncate">
                  {activeNavLabel}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Dynamic Light / Dark Mode Toggle */}
              <button
                type="button"
                onClick={() => handleToggleThemeMode()}
                title={
                  themeMode === 'dark'
                    ? 'Switch to Light Mode (Anti-Glare Off-White)'
                    : 'Switch to Dark Mode (Deep Slate/Navy)'
                }
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                {themeMode === 'dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden xl:inline font-mono text-[11px]">Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span className="hidden xl:inline font-mono text-[11px]">Dark</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction('add_contact')}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Add Contact</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction('send_broadcast')}
                className="px-2.5 sm:px-3.5 py-1.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden xs:inline sm:inline">Send Broadcast</span>
                <span className="xs:hidden sm:hidden">Broadcast</span>
              </button>

              <button
                type="button"
                onClick={() => setDiagnosticsModalOpen(true)}
                title="System Diagnostics, Multi-Channel Live Testing & Kill Switch Verification"
                className="px-2.5 sm:px-3 py-1.5 text-xs font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-2xs"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden sm:inline">Diagnostics &amp; Kill Switch</span>
                <span className="sm:hidden">Diagnostics</span>
              </button>

              {isSignedInAny && currentUser ? (
                <div className="flex items-center gap-1.5 sm:gap-2 pl-2 border-l border-slate-200">
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="text-xs font-semibold text-slate-900 hover:text-[#2563EB] truncate max-w-[90px] sm:max-w-[140px] cursor-pointer"
                  >
                    {currentUser.displayName || currentUser.email}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogoutUser}
                    title="Sign out"
                    className="p-1.5 text-slate-500 hover:text-red-600 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2 pl-2 border-l border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleOpenAuthModal('signin')}
                    className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAuthModal('signup')}
                    className="hidden sm:inline-flex px-3 py-1.5 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Sign Up Free
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile & Tablet Horizontal Quick-Switch Tab Strip */}
          <div className="lg:hidden border-t border-slate-100 bg-slate-50/90 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#0F172A] text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-3 h-3 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {typeof item.count === 'number' && (
                    <span
                      className={`font-mono text-[10px] ${
                        isActive ? 'text-emerald-300' : 'text-slate-400'
                      }`}
                    >
                      ({item.count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0F172A] text-white border-b border-slate-800 px-4 py-3.5 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between ${
                    activeTab === item.id
                      ? 'bg-[#047857] text-white font-bold'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {typeof item.count === 'number' && (
                    <span className="font-mono text-[11px] opacity-80">{item.count}</span>
                  )}
                </button>
              );
            })}
            <div className="pt-2 mt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setViewMode('landing');
                }}
                className="w-full py-2 px-3.5 text-xs font-semibold text-emerald-400 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>View Public Platform Page</span>
              </button>
            </div>
          </div>
        )}

        {/* Email Verification Notice for Manual Sign-Up Accounts */}
        {currentUser && !currentUser.emailVerified && (
          <div className="mx-3.5 sm:mx-6 lg:mx-8 mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-900">
            <div>
              <strong>Verify your email ({currentUser.email}):</strong> Check your inbox for the
              verification link to activate live Cloud Firestore database sync.
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  await triggerEmailVerification(currentUser);
                  setAuthBanner(`Verification link re-sent to ${currentUser.email}.`);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Resend Email
              </button>
              <button
                type="button"
                onClick={handleRefreshEmailVerification}
                className="px-3 py-1.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer"
              >
                I've Verified — Refresh
              </button>
            </div>
          </div>
        )}

        {/* Optional Auth Notice Banner */}
        {authBanner && (
          <div className="mx-3.5 sm:mx-6 lg:mx-8 mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-950">
            <span>{authBanner}</span>
            <button
              type="button"
              onClick={() => setAuthBanner(null)}
              className="text-emerald-800 hover:text-emerald-950 font-bold cursor-pointer ml-3"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Workspace Canvas */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-7 max-w-[1380px] w-full mx-auto">
          <ErrorBoundary
            key={activeTab}
            fallbackTitle={`Unable to Load ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
            onNavigateHome={() => setActiveTab('dashboard')}
          >
            {activeTab === 'dashboard' && (
            <DashboardOverview
              workspace={workspace}
              contacts={contacts}
              automations={automations}
              campaigns={campaigns}
              assets={assets}
              chatbots={chatbots}
              tasks={tasks}
              activities={activities}
              onNavigate={setActiveTab}
              onQuickAction={handleQuickAction}
              onOpenDiagnostics={() => setDiagnosticsModalOpen(true)}
              onCompleteTask={handleCompleteTask}
            />
          )}

          {activeTab === 'inbox' && (
            <InboxView
              threads={inboxThreads}
              contacts={contacts}
              lists={lists}
              campaigns={campaigns}
              autoResponders={autoResponders}
              senderName={workspace.senderName}
              workspace={workspace}
              privateProfile={privateProfile}
              onNavigateToSettings={() => setActiveTab('settings')}
              onCreateThread={handleCreateInboxThread}
              onUpdateThread={handleUpdateInboxThread}
              onDeleteThread={handleDeleteInboxThread}
              onCreateContact={handleCreateContact}
              onLogActivity={logActivityEvent}
            />
          )}

          {activeTab === 'contacts' && (
            <ContactsCrmView
              contacts={contacts}
              automations={automations}
              tasks={tasks}
              activities={activities}
              currency={workspace.currency}
              openModalOnMount={openContactModal}
              onClearModalMount={() => setOpenContactModal(false)}
              onCreateContact={handleCreateContact}
              onUpdateContact={handleUpdateContact}
              onDeleteContact={handleDeleteContact}
              onBulkImportContacts={handleBulkImportContacts}
              onMergeContacts={handleMergeContacts}
              onCreateTask={handleCreateTask}
              onCompleteTask={handleCompleteTask}
              onDeleteTask={handleDeleteTask}
              onLogActivity={logActivityEvent}
              onSimulateAutomationRun={handleSimulateAutomationRun}
              onOpenDiagnostics={() => setDiagnosticsModalOpen(true)}
            />
          )}

          {activeTab === 'lists' && (
            <ListsView
              lists={lists}
              contacts={contacts}
              currency={workspace.currency}
              onCreateList={handleCreateList}
              onUpdateList={handleUpdateList}
              onDeleteList={handleDeleteList}
              onCreateContact={handleCreateContact}
              onUpdateContact={handleUpdateContact}
              onDeleteContact={handleDeleteContact}
              onBulkImportContacts={handleBulkImportContacts}
              onCreateAutomationForList={(listName) => {
                setPreselectedAutomationList(listName);
                setActiveTab('automations');
              }}
              onCreateAutoResponderForList={(listName) => {
                setPreselectedAutoResponderList(listName);
                setActiveTab('autoresponders');
              }}
              onCreateFormForList={(listName) => {
                setPreselectedAssetList(listName);
                setActiveTab('assets');
              }}
              onSendBroadcastToList={(listName) => {
                setPreselectedCampaignList(listName);
                setActiveTab('campaigns');
              }}
            />
          )}

          {activeTab === 'autoresponders' && (
            <AutoRespondersView
              autoResponders={autoResponders}
              lists={lists}
              contacts={contacts}
              workspace={workspace}
              privateProfile={privateProfile}
              preselectedListName={preselectedAutoResponderList}
              onClearPreselectedList={() => setPreselectedAutoResponderList(null)}
              onNavigateToSettings={() => setActiveTab('settings')}
              onCreateAutoResponder={handleCreateAutoResponder}
              onUpdateAutoResponder={handleUpdateAutoResponder}
              onDeleteAutoResponder={handleDeleteAutoResponder}
              onCreateList={handleCreateList}
              onLogActivity={logActivityEvent}
              onNavigateToLists={() => setActiveTab('lists')}
              onForwardToInbox={async (payload) => {
                const nowFormatted = new Date().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const matchedContact = contacts.find(
                  (c) => c.fullName.toLowerCase() === payload.leadName.toLowerCase()
                );
                const resolvedSenders = resolveWorkspaceSenderIdentities(workspace, privateProfile);
                const senderIdentityTag =
                  payload.channel === 'whatsapp'
                    ? `From WhatsApp: ${resolvedSenders.whatsappBusinessNumber}`
                    : payload.channel === 'email'
                    ? `From Email: ${resolvedSenders.activeSenderEmail}`
                    : `From SMS: ${resolvedSenders.smsSenderId}`;
                const msgs = [
                  {
                    id: generateSafeId('msg_in'),
                    sender: 'lead' as const,
                    senderName: payload.leadName,
                    channel: payload.channel,
                    body: payload.leadMessage,
                    timestamp: `Today, ${nowFormatted}`,
                  },
                  ...(payload.autoResponseSent
                    ? [
                        {
                          id: generateSafeId('msg_ar'),
                          sender: 'autoresponder' as const,
                          senderName: `Auto Responder (${payload.responderName}) · ${senderIdentityTag}`,
                          channel: payload.channel,
                          body: payload.autoResponseSent,
                          timestamp: `Today, ${nowFormatted} (Auto-Pilot)`,
                        },
                      ]
                    : []),
                ];
                await handleCreateInboxThread({
                  leadName: payload.leadName.slice(0, 120),
                  leadEmail: matchedContact?.email || 'lead@example.com',
                  leadPhone: matchedContact?.phone || '+1 (555) 234-5678',
                  listName: payload.listName.slice(0, 100),
                  channel: payload.channel,
                  subjectOrContext: `Replied to ${payload.responderName}`.slice(0, 160),
                  lastLeadMessage: payload.leadMessage.slice(0, 2000),
                  lastMessagePreview: `${payload.leadName}: ${payload.leadMessage}`.slice(0, 500),
                  lastSender: 'lead',
                  status: 'unread',
                  unreadCount: 1,
                  messagesJson: JSON.stringify(msgs),
                });
              }}
              onNavigateToInbox={() => setActiveTab('inbox')}
            />
          )}

          {activeTab === 'automations' && (
            <AutomationsView
              automations={automations}
              contacts={contacts}
              lists={lists}
              workspace={workspace}
              privateProfile={privateProfile}
              onNavigateToSettings={() => setActiveTab('settings')}
              preselectedListName={preselectedAutomationList}
              onClearPreselectedList={() => setPreselectedAutomationList(null)}
              openModalOnMount={openAutomationModal}
              onClearModalMount={() => setOpenAutomationModal(false)}
              onCreateAutomation={handleCreateAutomation}
              onUpdateAutomation={handleUpdateAutomation}
              onDeleteAutomation={handleDeleteAutomation}
              onSimulateRun={handleSimulateAutomationRun}
              onUpdateContact={handleUpdateContact}
              onCreateTask={handleCreateTask}
              onLogActivity={logActivityEvent}
              onCreateList={handleCreateList}
              onNavigateToLists={() => setActiveTab('lists')}
              onCreateFormForList={(listName) => {
                setPreselectedAssetList(listName);
                setActiveTab('assets');
              }}
              onNavigateToInbox={() => setActiveTab('inbox')}
              onForwardToInbox={async (payload) => {
                const nowFormatted = new Date().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const resolvedSenders = resolveWorkspaceSenderIdentities(workspace, privateProfile);
                const senderIdentityTag =
                  payload.channel === 'whatsapp'
                    ? `From WhatsApp: ${resolvedSenders.whatsappBusinessNumber}`
                    : payload.channel === 'email'
                    ? `From Email: ${resolvedSenders.activeSenderEmail}`
                    : `From SMS: ${resolvedSenders.smsSenderId}`;
                const msgs = [
                  {
                    id: generateSafeId('msg_wf'),
                    sender: 'autoresponder' as const,
                    senderName: `Workflow (${payload.workflowName} · ${payload.stepTitle}) · ${senderIdentityTag}`,
                    channel: payload.channel,
                    body: payload.messageSent,
                    timestamp: `Today, ${nowFormatted} (Automation)`,
                  },
                ];
                await handleCreateInboxThread({
                  leadName: payload.leadName.slice(0, 120),
                  leadEmail: payload.leadEmail.slice(0, 150),
                  leadPhone: payload.leadPhone.slice(0, 40),
                  listName: payload.listName.slice(0, 100),
                  channel: payload.channel,
                  subjectOrContext:
                    (payload.subjectOrTemplate || `${payload.workflowName}: ${payload.stepTitle}`).slice(
                      0,
                      160
                    ),
                  lastLeadMessage: `Enrolled in workflow "${payload.workflowName}"`,
                  lastMessagePreview: `Automated ${payload.channel.toUpperCase()}: ${payload.messageSent}`.slice(
                    0,
                    500
                  ),
                  lastSender: 'autoresponder',
                  status: 'replied',
                  unreadCount: 0,
                  messagesJson: JSON.stringify(msgs),
                });
              }}
            />
          )}

          {activeTab === 'campaigns' && (
            <CampaignsView
              campaigns={campaigns}
              contacts={contacts}
              lists={lists}
              workspace={workspace}
              privateProfile={privateProfile}
              automations={automations}
              preselectedListName={preselectedCampaignList}
              onClearPreselectedList={() => setPreselectedCampaignList(null)}
              openModalOnMount={openCampaignModal}
              instantSendMode={instantSendBroadcast}
              onClearModalMount={() => setOpenCampaignModal(false)}
              onCreateCampaign={handleCreateCampaign}
              onUpdateCampaign={handleUpdateCampaign}
              onDispatchCampaign={handleDispatchCampaign}
              onDeleteCampaign={handleDeleteCampaign}
              onCreateList={handleCreateList}
              onUpdateContact={handleUpdateContact}
              onCreateContact={handleCreateContact}
              onCreateAutomation={handleCreateAutomation}
              onUpdateWorkspace={handleUpdateWorkspace}
              onUpdatePrivateProfile={handleUpdatePrivateProfile}
              onLogActivity={logActivityEvent}
              onNavigateToLists={() => setActiveTab('lists')}
              onNavigateToAutomations={() => setActiveTab('automations')}
            />
          )}

          {activeTab === 'assets' && (
            <CaptureAssetsView
              assets={assets}
              lists={lists}
              contacts={contacts}
              automations={automations}
              preselectedListName={preselectedAssetList}
              onClearPreselectedList={() => setPreselectedAssetList(null)}
              openModalMode={openAssetModalMode}
              onClearModalMode={() => setOpenAssetModalMode(null)}
              onCreateAsset={handleCreateAsset}
              onUpdateAsset={handleUpdateAsset}
              onDeleteAsset={handleDeleteAsset}
              onSubmitAssetLead={handleSubmitAssetLead}
              onCreateList={handleCreateList}
              onNavigateToLists={() => setActiveTab('lists')}
              onCreateAutomationForList={(listName) => {
                setPreselectedAutomationList(listName);
                setActiveTab('automations');
              }}
            />
          )}

          {activeTab === 'funnels' && (
            <FunnelBuilderView
              assets={assets}
              lists={lists}
              contacts={contacts}
              automations={automations}
              currency={workspace.currency}
              onCreateAsset={handleCreateAsset}
              onCreateContact={handleCreateContact}
              onUpdateContact={handleUpdateContact}
              onCreateList={handleCreateList}
              onLogActivity={logActivityEvent}
              onNavigateToLists={() => setActiveTab('lists')}
              onNavigateToAutomations={() => setActiveTab('automations')}
            />
          )}

          {activeTab === 'chatbots' && (
            <ChatbotsView
              chatbots={chatbots}
              contacts={contacts}
              lists={lists}
              automations={automations}
              workspace={workspace}
              privateProfile={privateProfile}
              onCreateChatbot={handleCreateChatbot}
              onDeleteChatbot={handleDeleteChatbot}
              onRecordBotSession={handleRecordBotSession}
              onUpdateContact={handleUpdateContact}
              onCreateAutomation={handleCreateAutomation}
              onCreateTask={handleCreateTask}
              onUpdateWorkspace={handleUpdateWorkspace}
              onUpdatePrivateProfile={handleUpdatePrivateProfile}
              onLogActivity={logActivityEvent}
              onNavigateToSettings={() => setActiveTab('settings')}
              onNavigateToInbox={() => setActiveTab('inbox')}
              onForwardToInbox={handleForwardBotToInbox}
            />
          )}

          {activeTab === 'settings' && (
            <WorkspaceSettingsView
              workspace={workspace}
              privateProfile={privateProfile}
              members={members}
              isAuthenticated={isSignedInAny}
              userEmailVerified={Boolean(currentUser?.emailVerified)}
              currentUserUid={currentUser?.uid || null}
              currentUserEmail={currentUser?.email || privateProfile.email}
              onUpdateWorkspace={handleUpdateWorkspace}
              onUpdatePrivateProfile={handleUpdatePrivateProfile}
              onAddMember={handleAddMember}
              onDeleteMember={handleDeleteMember}
              onSendPasswordReset={async (email) => {
                await triggerPasswordReset(email);
              }}
              onSendEmailVerification={async () => {
                if (currentUser) await triggerEmailVerification(currentUser);
              }}
              onSignOut={handleLogoutUser}
              onOpenAuth={handleOpenAuthModal}
              onReseedWorkspace={async () => {
                if (currentUser && currentUser.emailVerified) {
                  await purgeLegacyDemoDataFromFirestore(currentUser.uid);
                }
              }}
              onRestoreWorkspaceSnapshot={(snap) => {
                if (snap.workspace) setWorkspace(snap.workspace);
                if (snap.privateProfile) setPrivateProfile(snap.privateProfile);
                if (Array.isArray(snap.members)) setMembers(snap.members);
                if (Array.isArray(snap.contacts)) setContacts(snap.contacts);
                if (Array.isArray(snap.lists)) setLists(snap.lists);
                if (Array.isArray(snap.automations)) setAutomations(snap.automations);
                if (Array.isArray(snap.autoResponders)) setAutoResponders(snap.autoResponders);
                if (Array.isArray(snap.inboxThreads)) setInboxThreads(snap.inboxThreads);
                if (Array.isArray(snap.campaigns)) setCampaigns(snap.campaigns);
                if (Array.isArray(snap.assets)) setAssets(snap.assets);
                if (Array.isArray(snap.chatbots)) setChatbots(snap.chatbots);
                if (Array.isArray(snap.tasks)) setTasks(snap.tasks);
                if (Array.isArray(snap.activities)) setActivities(snap.activities);
                setAuthBanner(
                  `Workspace backup "${snap.workspace?.name || 'Restored Workspace'}" restored and synced.`
                );
              }}
            />
          )}
          </ErrorBoundary>
        </main>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={handleCloseAuthModal}
        onAuthSuccess={(opts) => {
          setAuthModalOpen(false);
          setViewMode('workspace');
          setActiveTab('dashboard');
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', '/dashboard');
          }
          if (opts?.uid && opts?.email) {
            const resolvedUser =
              auth.currentUser ||
              createSyntheticFirebaseUser({
                uid: opts.uid,
                email: opts.email,
                displayName: opts.fullName || opts.email.split('@')[0],
                workspaceName: opts.workspaceName || `${opts.fullName || 'User'}'s Workspace`,
                provider: opts.email.includes('google') ? 'google.com' : 'password',
                emailVerified: true,
                isFirebaseUser: true,
              });
            setCurrentUser(resolvedUser);
          }
          if (opts?.email) {
            setAuthBanner(
              `Signed in as ${opts.email}. Welcome to your workspace dashboard.`
            );
          }
        }}
      />

      <SystemDiagnosticsModal
        isOpen={diagnosticsModalOpen}
        onClose={() => setDiagnosticsModalOpen(false)}
        currentUser={currentUser}
        workspace={workspace}
        privateProfile={privateProfile}
        lists={lists}
        contacts={contacts}
        automations={automations}
        onBulkImportContacts={handleBulkImportContacts}
        onLogActivity={logActivityEvent}
      />
    </div>
  );
}
