import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard,
  Inbox,
  Users,
  Layers,
  Zap,
  Send,
  FileText,
  Sliders,
  Bot,
  Settings,
  Activity,
  Palette,
  Sun,
  Moon,
  ExternalLink,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  Smartphone,
  Split,
  Globe,
  ChevronRight,
  Plus,
  Sparkles,
  Radio,
  QrCode,
} from 'lucide-react';


import { useAuth } from './contexts/AuthContext';
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
  ChannelType,
  ActivityEventType,
  ActivityChannel,
  CsvImportOptions,
  CsvImportResultSummary,
  MemberRole,
  LiveWhatsAppSessionInfo,
  parseUserMessagingIdentities,
  UserMessagingIdentity,
  generateSafeId,
  sanitizeString,
} from './types';

import {
  ThemeMode,
  getStoredThemeMode,
  applyThemeModeToDocument,
} from './theme/designSystem';

import {
  WorkspaceSnapshot,
  loadLocalWorkspaceSnapshot,
  saveLocalWorkspaceSnapshot,
  buildStarterWorkspaceSnapshot,
  normalizeWorkspaceSnapshot,
} from './services/accountPersistenceService';
import {
  CloudSyncState,
  appendActivityDoc,
  deleteCollectionDoc,
  deleteMemberDoc,
  hydrateAndMergeWorkspaceFromFirestore,
  subscribeToWorkspaceCollections,
  trackGuestDirtyItem,
  upsertCollectionDoc,
  upsertMemberDoc,
  upsertPrivateProfile,
  upsertWorkspaceRoot,
} from './services/firestoreWorkspaceSync';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { checkEvolutionConnectionState } from './lib/evolutionClient';
import { formatWhatsAppPhoneFromJid } from './utils/richMessageFormat';
import {
  deliverChannelMessage,
  personalizeAutomationMessage,
} from './services/messageDeliveryService';
import { EmailDomainStatusSummary } from './utils/emailDomainValidation';
import {
  EMPTY_EMAIL_DOMAIN_STATUS,
  fetchCustomDomainStatus,
} from './services/customDomainEmailClient';

import { FlowPilotLogo } from './components/FlowPilotLogo';
import { LandingPage } from './components/LandingPage';
import { DashboardOverview } from './components/DashboardOverview';
import { InboxView } from './components/InboxView';
import { ContactsCrmView } from './components/ContactsCrmView';
import { ListsView } from './components/ListsView';
import { AutoRespondersView } from './components/AutoRespondersView';
import { CampaignsView } from './components/CampaignsView';
import { CaptureAssetsView, AssetLeadSubmissionExtra } from './components/CaptureAssetsView';
import { FunnelBuilderView } from './components/FunnelBuilderView';
import { ChatbotsView } from './components/ChatbotsView';
import { WorkspaceSettingsView } from './components/WorkspaceSettingsView';
import { WhatsAppEmbeddedSignupPage } from './components/WhatsAppEmbeddedSignupPage';
import { WhatsAppConnectView } from './components/WhatsAppConnectView';
import { ConnectWhatsAppPage } from './components/ConnectWhatsAppPage';
import { WhatsAppTemplatesView } from './components/WhatsAppTemplatesView';
import { AutomationBuilderUI } from './components/AutomationBuilderUI';
import { PrivacyPolicyPage } from './components/PrivacyPolicyPage';
import { CustomDomainEmailSettings } from './components/CustomDomainEmailSettings';
import { WebhookGatewayView } from './components/WebhookGatewayView';


import { AuthModal, AuthModalMode } from './components/AuthModal';
import { DesignSystemModal } from './components/DesignSystemModal';
import { SystemDiagnosticsModal } from './components/SystemDiagnosticsModal';
import { FormPublicView } from './components/FormPublicView';
import { ErrorBoundary } from './components/ErrorBoundary';

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export default function App() {
  const { user, userProfile, loading: authLoading, logout } = useAuth();
  const [cloudSyncState, setCloudSyncState] = useState<CloudSyncState>('local_only');
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [emailDomainStatus, setEmailDomainStatus] =
    useState<EmailDomainStatusSummary>(EMPTY_EMAIL_DOMAIN_STATUS);

  // Active UI Theme
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredThemeMode);

  useEffect(() => {
    applyThemeModeToDocument(themeMode);
  }, [themeMode]);

  const toggleTheme = () => {
    const next = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(next);
    applyThemeModeToDocument(next);
  };

  // Deep link detection for /connect-whatsapp
  const isDirectConnectWhatsAppRoute =
    typeof window !== 'undefined' &&
    (() => {
      const p = window.location.pathname.toLowerCase();
      const s = new URLSearchParams(window.location.search);
      return (
        p === '/connect-whatsapp' ||
        p === '/connect-whatsapp/' ||
        s.get('page') === 'connect-whatsapp' ||
        s.get('tab') === 'connect_whatsapp'
      );
    })();

  // View state: Public Landing Page vs In-App Workspace
  const [isPublicLanding, setIsPublicLanding] = useState<boolean>(() => {
    if (isDirectConnectWhatsAppRoute) return false;
    return !user;
  });

  // Public Form Page route detection (e.g. /form/[id], /public/form, /p/[slug], /form, ?form=, ?capture=)
  const [isFormRoute, setIsFormRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    return (
      path.startsWith('/form') ||
      path.startsWith('/public/form') ||
      path.startsWith('/p/') ||
      params.has('form') ||
      params.has('capture')
    );
  });

  const [publicFetchedAsset, setPublicFetchedAsset] = useState<Partial<CaptureAsset> | null>(null);
  const [isLoadingPublicForm, setIsLoadingPublicForm] = useState<boolean>(false);

  // WhatsApp Embedded Signup Page Route (/dashboard/settings/whatsapp or /settings/whatsapp)
  const [isWhatsAppSettingsRoute, setIsWhatsAppSettingsRoute] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const path = window.location.pathname.toLowerCase();
    return (
      path === "/dashboard/settings/whatsapp" ||
      path === "/dashboard/settings/whatsapp/" ||
      path === "/settings/whatsapp" ||
      path === "/settings/whatsapp/"
    );
  });

  // Privacy Policy Page Route (/privacy, /privacy-policy, ?page=privacy)
  const [isPrivacyRoute, setIsPrivacyRoute] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const path = window.location.pathname.toLowerCase();
    const search = new URLSearchParams(window.location.search);
    return (
      path === "/privacy" ||
      path === "/privacy/" ||
      path === "/privacy-policy" ||
      path === "/privacy-policy/" ||
      search.get("page") === "privacy" ||
      search.get("view") === "privacy"
    );
  });

  // Custom Domain Email Settings Route (/dashboard/settings/email, /settings/email, ?page=email-settings)
  const [isEmailSettingsRoute, setIsEmailSettingsRoute] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const path = window.location.pathname.toLowerCase();
    const search = new URLSearchParams(window.location.search);
    return (
      path === "/dashboard/settings/email" ||
      path === "/dashboard/settings/email/" ||
      path === "/settings/email" ||
      path === "/settings/email/" ||
      search.get("page") === "email-settings" ||
      search.get("tab") === "email-settings"
    );
  });

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const path = window.location.pathname.toLowerCase();
      const search = new URLSearchParams(window.location.search);
      setIsWhatsAppSettingsRoute(
        path === "/dashboard/settings/whatsapp" ||
        path === "/dashboard/settings/whatsapp/" ||
        path === "/settings/whatsapp" ||
        path === "/settings/whatsapp/"
      );
      setIsPrivacyRoute(
        path === "/privacy" ||
        path === "/privacy/" ||
        path === "/privacy-policy" ||
        path === "/privacy-policy/" ||
        search.get("page") === "privacy" ||
        search.get("view") === "privacy"
      );
      setIsEmailSettingsRoute(
        path === "/dashboard/settings/email" ||
        path === "/dashboard/settings/email/" ||
        path === "/settings/email" ||
        path === "/settings/email/" ||
        search.get("page") === "email-settings" ||
        search.get("tab") === "email-settings"
      );
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateToWhatsAppEmbeddedSignup = () => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/dashboard/settings/whatsapp");
      setIsWhatsAppSettingsRoute(true);
    }
  };

  const navigateBackFromWhatsAppEmbeddedSignup = () => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/");
      setIsWhatsAppSettingsRoute(false);
      setActiveTab("settings");
    }
  };

  const navigateToEmailSettings = () => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/dashboard/settings/email");
      setIsEmailSettingsRoute(true);
    }
  };

  const navigateBackFromEmailSettings = () => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/");
      setIsEmailSettingsRoute(false);
      setActiveTab("settings");
    }
  };

  const navigateBackFromPrivacy = () => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/");
      setIsPrivacyRoute(false);
    }
  };


  // When user signs in, smoothly transition to workspace
  useEffect(() => {
    if (user && isPublicLanding) {
      setIsPublicLanding(false);
    }
  }, [user, isPublicLanding]);

  // Fetch authenticated user's custom domain email status
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setEmailDomainStatus(EMPTY_EMAIL_DOMAIN_STATUS);
      return;
    }
    let cancelled = false;
    fetchCustomDomainStatus({ refresh: false })
      .then((summary) => {
        if (!cancelled) setEmailDomainStatus(summary);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  // Active Workspace Navigation Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    isDirectConnectWhatsAppRoute ? 'connect_whatsapp' : 'dashboard'
  );

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('signin');
  const [diagnosticsModalOpen, setDiagnosticsModalOpen] = useState(false);
  const [designSystemModalOpen, setDesignSystemModalOpen] = useState(false);

  // Cross-tab deep links & modal triggers
  const [preselectedListName, setPreselectedListName] = useState<string | null>(null);
  const [contactModalOpenOnMount, setContactModalOpenOnMount] = useState(false);
  const [automationModalOpenOnMount, setAutomationModalOpenOnMount] = useState(false);
  const [campaignModalOpenOnMount, setCampaignModalOpenOnMount] = useState(false);
  const [assetModalMode, setAssetModalMode] = useState<'landing_page' | 'inline_form' | null>(null);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);

  useEffect(() => {
    if (!navDrawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navDrawerOpen]);

  // Active User UID for multi-tenant isolation
  const isRealFirebaseUser = Boolean(!authLoading && user && auth.currentUser?.uid === user.uid);
  const activeUid = user?.uid || 'default_workspace';

  // Workspace Data State
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(() => {
    const loaded = loadLocalWorkspaceSnapshot(activeUid, user?.email || undefined);
    if (loaded) return loaded;
    return buildStarterWorkspaceSnapshot(
      activeUid,
      user?.email || 'user@example.com',
      userProfile?.displayName || 'Workspace Operator',
      'My Sovereign Workspace'
    );
  });

  // Helper to execute Firestore cloud persistence safely without crashing UI
  const syncCloudWrite = useCallback(
    async (op: () => Promise<void>) => {
      if (!auth.currentUser) {
        setCloudSyncState('local_only');
        return;
      }
      setCloudSyncState('syncing');
      try {
        await op();
        setCloudSyncState('synced');
      } catch (err) {
        setCloudSyncState('error');
        console.warn('[FirestoreSync] Write deferred to local storage:', err);
      }
    },
    []
  );

  // Hydrate entire workspace from Firestore + auto-merge pre-login guest drafts + live cross-device listener
  useEffect(() => {
    if (authLoading) return;
    let isCancelled = false;
    let unsubscribeRemote: (() => void) | undefined;

    if (!isRealFirebaseUser || !user) {
      // Signed-out mode: load dedicated guest workspace or fresh starter
      const guestLoaded = loadLocalWorkspaceSnapshot('default_workspace');
      setSnapshot(
        guestLoaded ||
          buildStarterWorkspaceSnapshot(
            'default_workspace',
            'operator@flowpilot.app',
            'Workspace Operator',
            'My Sovereign Workspace'
          )
      );
      setCloudSyncState('local_only');
      return () => {
        isCancelled = true;
      };
    }

    const syncFromFirestore = async () => {
      const cachedForUser = loadLocalWorkspaceSnapshot(user.uid, user.email || undefined);
      if (cachedForUser && !isCancelled) {
        setSnapshot(cachedForUser);
      }
      setCloudSyncState('syncing');

      try {
        const guestSnapshot = loadLocalWorkspaceSnapshot('default_workspace');
        const { snapshot: hydrated, mergedGuestCount } =
          await hydrateAndMergeWorkspaceFromFirestore({
            uid: user.uid,
            email: user.email || 'operator@flowpilot.app',
            displayName:
              userProfile?.displayName ||
              user.displayName ||
              user.email?.split('@')[0] ||
              'Workspace Owner',
            localGuestSnapshot: guestSnapshot,
          });

        if (isCancelled) return;
        setSnapshot(hydrated);
        saveLocalWorkspaceSnapshot(
          user.uid,
          user.email || 'operator@flowpilot.app',
          hydrated
        );
        setCloudSyncState('synced');

        if (mergedGuestCount > 0) {
          setSyncNotice(
            `Synced ${mergedGuestCount} pre-login draft${mergedGuestCount === 1 ? '' : 's'} to your cloud account.`
          );
          setTimeout(() => setSyncNotice(null), 5000);
        }

        unsubscribeRemote = subscribeToWorkspaceCollections(
          user.uid,
          (patchFn) => {
            if (isCancelled) return;
            setSnapshot((prev) => {
              const updated = normalizeWorkspaceSnapshot(patchFn(prev));
              saveLocalWorkspaceSnapshot(
                user.uid,
                user.email || 'operator@flowpilot.app',
                updated
              );
              return updated;
            });
          },
          () => {
            if (!isCancelled) setCloudSyncState('error');
          }
        );
      } catch (err) {
        if (!isCancelled) {
          setCloudSyncState('error');
          console.warn('[FirestoreSync] Error hydrating workspace:', err);
        }
      }
    };

    syncFromFirestore();

    return () => {
      isCancelled = true;
      if (unsubscribeRemote) unsubscribeRemote();
    };
  }, [authLoading, isRealFirebaseUser, user, userProfile?.displayName]);

  // Fetch published form from server when opened in Incognito or unauthenticated visitor session
  useEffect(() => {
    if (!isFormRoute || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const cap = params.get('capture') || params.get('form') || '';
    const pathPart = window.location.pathname.replace(/^\/(form|public\/form|p)\/?/i, '');
    const requestedIdentifier = (cap || pathPart).trim();

    const localMatch = (snapshot?.assets || []).find(
      (a) => a.slug === requestedIdentifier || a.id === requestedIdentifier
    );
    if (localMatch && (localMatch.headline || localMatch.ctaText)) {
      setPublicFetchedAsset(localMatch);
      return;
    }

    setIsLoadingPublicForm(true);
    const queryUrl = requestedIdentifier
      ? `/api/forms/public?slug=${encodeURIComponent(requestedIdentifier)}`
      : '/api/forms/public';

    fetch(queryUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok && data?.asset) {
          setPublicFetchedAsset(data.asset);
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoadingPublicForm(false);
      });
  }, [isFormRoute, snapshot?.assets]);

  // Live connected WhatsApp account state (synced from whatsapp_connections + Evolution API)
  const [liveWhatsappSession, setLiveWhatsappSession] =
    useState<LiveWhatsAppSessionInfo | null>(null);

  const applyConnectedWhatsappIdentityToSnapshot = useCallback(
    (phone: string, profileName?: string | null) => {
      const cleanPhone = (phone || '').trim();
      const cleanProfile = (profileName || '').trim();
      if (!cleanPhone && !cleanProfile) return;

      updateSnapshot((prev) => {
        const currentProf = prev.privateProfile;
        let nextProfile = currentProf;
        if (currentProf) {
          const existingIdentities = parseUserMessagingIdentities(currentProf);
          const nextIdentities: UserMessagingIdentity[] = existingIdentities.map((id) =>
            id.channel === 'whatsapp' ? { ...id, isDefault: false } : id
          );
          if (cleanPhone) {
            const matchIdx = nextIdentities.findIndex(
              (i) =>
                i.channel === 'whatsapp' &&
                i.value.replace(/[^0-9]/g, '') === cleanPhone.replace(/[^0-9]/g, '')
            );
            const waLabel = cleanProfile
              ? `${cleanProfile} (WhatsApp)`
              : 'Connected WhatsApp';
            if (matchIdx >= 0) {
              nextIdentities[matchIdx] = {
                ...nextIdentities[matchIdx],
                label: waLabel,
                senderName: cleanProfile || nextIdentities[matchIdx].senderName,
                value: cleanPhone,
                isDefault: true,
                verified: true,
              };
            } else {
              nextIdentities.unshift({
                id: 'wa_connected_live',
                channel: 'whatsapp',
                label: waLabel,
                senderName:
                  cleanProfile ||
                  prev.workspace.senderName ||
                  prev.workspace.name ||
                  'WhatsApp Business',
                value: cleanPhone,
                providerMode: 'evolution_qr',
                isDefault: true,
                verified: true,
                createdAt: new Date().toISOString(),
              });
            }
          }
          nextProfile = {
            ...currentProf,
            whatsappBusinessNumber: cleanPhone || currentProf.whatsappBusinessNumber,
            whatsappPhoneId: cleanPhone || currentProf.whatsappPhoneId,
            messagingIdentitiesJson: JSON.stringify(nextIdentities).slice(0, 10000),
          };
        }

        return {
          ...prev,
          workspace: {
            ...prev.workspace,
            whatsappConnected: true,
          },
          privateProfile: nextProfile,
        };
      });
    },
    []
  );

  const refreshLiveWhatsappSession = useCallback(async () => {
    if (!activeUid) return null;
    try {
      const res = await checkEvolutionConnectionState(activeUid, false);
      const formattedPhone =
        res.phoneNumber || formatWhatsAppPhoneFromJid(res.ownerJid) || '';
      const nextSession: LiveWhatsAppSessionInfo = {
        status: res.status,
        instanceName: res.instanceName,
        ownerJid: res.ownerJid,
        phoneNumber: formattedPhone || undefined,
        profileName: res.profileName,
        checkedAt: res.checkedAt,
      };
      setLiveWhatsappSession(nextSession);

      if (res.status === 'open') {
        applyConnectedWhatsappIdentityToSnapshot(formattedPhone, res.profileName);

        if (auth.currentUser && auth.currentUser.uid === activeUid) {
          const uid = auth.currentUser.uid;
          const connRef = doc(db, 'whatsapp_connections', uid);
          const payloadFields: Record<string, string> = {};
          if (res.ownerJid) payloadFields.ownerJid = res.ownerJid.slice(0, 128);
          if (formattedPhone) payloadFields.phoneNumber = formattedPhone.slice(0, 64);
          if (res.profileName) payloadFields.profileName = res.profileName.slice(0, 120);
          getDoc(connRef)
            .then((snap) => {
              if (!snap.exists()) {
                return setDoc(connRef, {
                  userId: uid,
                  instanceName: res.instanceName,
                  status: res.status,
                  ...payloadFields,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }
              return updateDoc(connRef, {
                instanceName: res.instanceName,
                status: res.status,
                ...payloadFields,
                updatedAt: serverTimestamp(),
              });
            })
            .catch(() => {});
        }
      }
      return nextSession;
    } catch {
      return null;
    }
  }, [activeUid, applyConnectedWhatsappIdentityToSnapshot]);

  // Listen to whatsapp_connections/{uid} & probe Evolution status on load/login
  useEffect(() => {
    if (authLoading) return;
    let unsubConn: (() => void) | undefined;

    if (isRealFirebaseUser && user) {
      unsubConn = onSnapshot(
        doc(db, 'whatsapp_connections', user.uid),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as {
            status?: 'open' | 'close' | 'connecting';
            instanceName?: string;
            ownerJid?: string;
            phoneNumber?: string;
            profileName?: string;
          };
          const resolvedPhone =
            data.phoneNumber || formatWhatsAppPhoneFromJid(data.ownerJid) || '';
          setLiveWhatsappSession({
            status: data.status || 'close',
            instanceName: data.instanceName,
            ownerJid: data.ownerJid || null,
            phoneNumber: resolvedPhone || undefined,
            profileName: data.profileName || null,
            checkedAt: new Date().toISOString(),
          });
          if (data.status === 'open' && (resolvedPhone || data.profileName)) {
            applyConnectedWhatsappIdentityToSnapshot(resolvedPhone, data.profileName);
          }
        },
        () => {}
      );
    } else {
      setLiveWhatsappSession(null);
    }

    void refreshLiveWhatsappSession();

    return () => {
      if (unsubConn) unsubConn();
    };
  }, [
    authLoading,
    isRealFirebaseUser,
    user,
    refreshLiveWhatsappSession,
    applyConnectedWhatsappIdentityToSnapshot,
  ]);

  // Persist snapshot to localStorage immediately
  const updateSnapshot = useCallback(
    (updater: (prev: WorkspaceSnapshot) => WorkspaceSnapshot) => {
      setSnapshot((prev) => {
        const next = normalizeWorkspaceSnapshot(updater(prev));
        const activeEmail = user?.email || 'operator@flowpilot.app';
        saveLocalWorkspaceSnapshot(activeUid, activeEmail, next);
        return next;
      });
    },
    [activeUid, user?.email]
  );

  // Activity Logger - Persists per user to local storage AND Firestore
  const handleLogActivity = useCallback(
    async (
      eventType: ActivityEventType,
      title: string,
      detail: string,
      channel: ActivityChannel
    ) => {
      const now = new Date().toISOString();
      const newActivity: ActivityLog = {
        id: generateSafeId('act'),
        workspaceId: snapshot.workspace.id || activeUid,
        ownerId: activeUid,
        eventType,
        title: sanitizeString(title, 160, 'Activity logged'),
        detail: sanitizeString(detail, 280, 'Workspace event recorded'),
        channel,
        createdAt: now,
        updatedAt: now,
      };

      updateSnapshot((prev) => ({
        ...prev,
        activities: [newActivity, ...prev.activities.filter((a) => a.id !== newActivity.id)].slice(0, 150),
      }));

      if (auth.currentUser) {
        await syncCloudWrite(() => appendActivityDoc(auth.currentUser!.uid, newActivity));
      } else {
        trackGuestDirtyItem('activities', newActivity.id);
      }
    },
    [activeUid, snapshot.workspace.id, syncCloudWrite, updateSnapshot]
  );

  // --------------------------------------------------------------------------
  // CONTACTS HANDLERS
  // --------------------------------------------------------------------------
  const handleCreateContact = useCallback(
    async (
      data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      const now = new Date().toISOString();
      const newContact: Contact = {
        ...data,
        id: generateSafeId('cnt'),
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        createdAt: now,
        updatedAt: now,
      };
      updateSnapshot((prev) => ({
        ...prev,
        contacts: [newContact, ...prev.contacts],
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('contacts', auth.currentUser!.uid, newContact.id, newContact)
        );
      } else {
        trackGuestDirtyItem('contacts', newContact.id);
      }
      await handleLogActivity(
        'lead_captured',
        `New contact added: ${newContact.fullName}`,
        `Email: ${newContact.email} | List: ${newContact.listName || 'General'}`,
        'crm'
      );
    },
    [activeUid, handleLogActivity, snapshot.workspace.id, syncCloudWrite, updateSnapshot]
  );

  const handleUpdateContact = useCallback(
    async (
      id: string,
      data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      const now = new Date().toISOString();
      updateSnapshot((prev) => ({
        ...prev,
        contacts: prev.contacts.map((c) =>
          c.id === id ? { ...c, ...data, updatedAt: now } : c
        ),
      }));
      if (auth.currentUser) {
        const existing = snapshot.contacts.find((c) => c.id === id);
        await syncCloudWrite(() =>
          upsertCollectionDoc('contacts', auth.currentUser!.uid, id, {
            ...(existing || {}),
            ...data,
            id,
          })
        );
      } else {
        trackGuestDirtyItem('contacts', id);
      }
    },
    [snapshot.contacts, syncCloudWrite, updateSnapshot]
  );

  const handleDeleteContact = useCallback(
    async (id: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        contacts: prev.contacts.filter((c) => c.id !== id),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          deleteCollectionDoc('contacts', auth.currentUser!.uid, id)
        );
      }
    },
    [syncCloudWrite, updateSnapshot]
  );

  const handleBulkImportContacts = useCallback(
    async (
      imported: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>[],
      options?: CsvImportOptions
    ): Promise<CsvImportResultSummary> => {
      const now = new Date().toISOString();
      let updatedCount = 0;
      let createdCount = 0;
      let skippedCount = 0;
      const toPersist: Contact[] = [];

      updateSnapshot((prev) => {
        const contactMap = new Map<string, Contact>();
        prev.contacts.forEach((c) => {
          if (c.email) contactMap.set(c.email.toLowerCase().trim(), c);
        });

        const newContactsList = [...prev.contacts];

        for (const raw of imported) {
          const emailKey = (raw.email || '').toLowerCase().trim();
          if (emailKey && contactMap.has(emailKey)) {
            if (options?.updateExistingContacts) {
              const existingIndex = newContactsList.findIndex(
                (c) => (c.email || '').toLowerCase().trim() === emailKey
              );
              if (existingIndex >= 0) {
                const existing = newContactsList[existingIndex];
                const mergedTags = Array.from(
                  new Set([...(existing.tags || []), ...(raw.tags || []), ...(options?.applyTags || [])])
                );
                const updatedContact: Contact = {
                  ...existing,
                  ...raw,
                  tags: mergedTags,
                  updatedAt: now,
                };
                newContactsList[existingIndex] = updatedContact;
                toPersist.push(updatedContact);
                updatedCount++;
              }
            } else {
              skippedCount++;
            }
          } else {
            const freshContact: Contact = {
              ...raw,
              id: generateSafeId('cnt'),
              workspaceId: prev.workspace.id,
              ownerId: activeUid,
              tags: Array.from(new Set([...(raw.tags || []), ...(options?.applyTags || [])])),
              createdAt: now,
              updatedAt: now,
            };
            newContactsList.push(freshContact);
            toPersist.push(freshContact);
            if (emailKey) contactMap.set(emailKey, freshContact);
            createdCount++;
          }
        }

        return {
          ...prev,
          contacts: newContactsList,
        };
      });

      if (toPersist.length > 0) {
        if (auth.currentUser) {
          await syncCloudWrite(async () => {
            await Promise.all(
              toPersist.map((c) =>
                upsertCollectionDoc('contacts', auth.currentUser!.uid, c.id, c)
              )
            );
          });
        } else {
          toPersist.forEach((c) => trackGuestDirtyItem('contacts', c.id));
        }
      }

      await handleLogActivity(
        'form_captured',
        `Bulk CSV import processed (${createdCount} created, ${updatedCount} updated)`,
        `Total rows parsed: ${imported.length}`,
        'crm'
      );

      return {
        updatedCount,
        createdCount,
        skippedCount,
        killSwitchEjectedCount: 0,
        affectedWorkflowNames: [],
        appliedTags: options?.applyTags || [],
        matchedContactNames: [],
      };
    },
    [activeUid, handleLogActivity, syncCloudWrite, updateSnapshot]
  );

  const handleMergeContacts = useCallback(
    async (primaryId: string, duplicateId: string) => {
      const primary = snapshot.contacts.find((c) => c.id === primaryId);
      const duplicate = snapshot.contacts.find((c) => c.id === duplicateId);
      if (!primary || !duplicate) return;

      const merged: Contact = {
        ...primary,
        phone: primary.phone || duplicate.phone,
        company: primary.company || duplicate.company,
        notes: `${primary.notes || ''}\n${duplicate.notes || ''}`.trim(),
        tags: Array.from(new Set([...(primary.tags || []), ...(duplicate.tags || [])])),
        ltv: (primary.ltv || 0) + (duplicate.ltv || 0),
        updatedAt: new Date().toISOString(),
      };

      updateSnapshot((prev) => ({
        ...prev,
        contacts: prev.contacts
          .filter((c) => c.id !== duplicateId)
          .map((c) => (c.id === primaryId ? merged : c)),
      }));

      if (auth.currentUser) {
        await syncCloudWrite(async () => {
          await upsertCollectionDoc('contacts', auth.currentUser!.uid, primaryId, merged);
          await deleteCollectionDoc('contacts', auth.currentUser!.uid, duplicateId);
        });
      } else {
        trackGuestDirtyItem('contacts', primaryId);
      }
    },
    [snapshot.contacts, syncCloudWrite, updateSnapshot]
  );

  // --------------------------------------------------------------------------
  // LISTS HANDLERS
  // --------------------------------------------------------------------------
  const handleCreateList = useCallback(
    async (
      data: Omit<AudienceList, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      const newList: AudienceList = {
        ...data,
        id: generateSafeId('lst'),
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updateSnapshot((prev) => ({
        ...prev,
        lists: [newList, ...prev.lists],
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('lists', auth.currentUser!.uid, newList.id, newList)
        );
      } else {
        trackGuestDirtyItem('lists', newList.id);
      }
    },
    [activeUid, snapshot.workspace.id, syncCloudWrite, updateSnapshot]
  );

  const handleUpdateList = useCallback(
    async (
      id: string,
      data: Omit<AudienceList, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      const now = new Date().toISOString();
      updateSnapshot((prev) => ({
        ...prev,
        lists: prev.lists.map((l) =>
          l.id === id ? { ...l, ...data, updatedAt: now } : l
        ),
      }));
      if (auth.currentUser) {
        const existing = snapshot.lists.find((l) => l.id === id);
        await syncCloudWrite(() =>
          upsertCollectionDoc('lists', auth.currentUser!.uid, id, {
            ...(existing || {}),
            ...data,
            id,
          })
        );
      } else {
        trackGuestDirtyItem('lists', id);
      }
    },
    [snapshot.lists, syncCloudWrite, updateSnapshot]
  );

  const handleDeleteList = useCallback(
    async (id: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        lists: prev.lists.filter((l) => l.id !== id),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() => deleteCollectionDoc('lists', auth.currentUser!.uid, id));
      }
    },
    [syncCloudWrite, updateSnapshot]
  );

  // --------------------------------------------------------------------------
  // AUTOMATIONS HANDLERS
  // --------------------------------------------------------------------------
  const handleCreateAutomation = useCallback(
    async (
      data: Omit<Automation, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>,
      options?: { logAction?: 'saved_draft' | 'published' | 'silent' }
    ): Promise<Automation> => {
      const now = new Date().toISOString();
      const newAuto: Automation = {
        ...data,
        id: generateSafeId('aut'),
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        createdAt: now,
        updatedAt: now,
      };
      updateSnapshot((prev) => ({
        ...prev,
        automations: [newAuto, ...prev.automations],
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('automations', auth.currentUser!.uid, newAuto.id, newAuto)
        );
      } else {
        trackGuestDirtyItem('automations', newAuto.id);
      }

      if (options?.logAction !== 'silent') {
        const isPublished = options?.logAction === 'published' || newAuto.status === 'active';
        await handleLogActivity(
          isPublished ? 'workflow_published' : 'workflow_saved',
          isPublished
            ? `Workflow published: ${newAuto.name}`
            : `Workflow draft saved: ${newAuto.name}`,
          `List: ${newAuto.targetList || 'General Contacts'} | Status: ${newAuto.status}`,
          'system'
        );
      }
      return newAuto;
    },
    [activeUid, handleLogActivity, snapshot.workspace.id, syncCloudWrite, updateSnapshot]
  );

  const handleUpdateAutomation = useCallback(
    async (
      id: string,
      data: Omit<Automation, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>,
      options?: { logAction?: 'saved_draft' | 'published' | 'silent' }
    ) => {
      const now = new Date().toISOString();
      const existing = snapshot.automations.find((a) => a.id === id);
      const merged: Automation = {
        ...(existing || ({ id, workspaceId: snapshot.workspace.id, ownerId: activeUid } as Automation)),
        ...data,
        id,
        updatedAt: now,
      };
      updateSnapshot((prev) => ({
        ...prev,
        automations: prev.automations.map((a) => (a.id === id ? merged : a)),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('automations', auth.currentUser!.uid, id, merged)
        );
      } else {
        trackGuestDirtyItem('automations', id);
      }

      if (options?.logAction === 'published') {
        await handleLogActivity(
          'workflow_published',
          `Workflow published: ${merged.name}`,
          `List: ${merged.targetList || 'General Contacts'} | Live v${merged.version || 1}`,
          'system'
        );
      } else if (options?.logAction === 'saved_draft') {
        await handleLogActivity(
          'workflow_saved',
          `Workflow draft saved: ${merged.name}`,
          `List: ${merged.targetList || 'General Contacts'} | Draft saved`,
          'system'
        );
      }
    },
    [activeUid, handleLogActivity, snapshot.automations, snapshot.workspace.id, syncCloudWrite, updateSnapshot]
  );

  const handleDeleteAutomation = useCallback(
    async (id: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        automations: prev.automations.filter((a) => a.id !== id),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() => deleteCollectionDoc('automations', auth.currentUser!.uid, id));
      }
    },
    [syncCloudWrite, updateSnapshot]
  );

  const handleSimulateAutomationRun = useCallback(
    async (auto: Automation) => {
      const updatedAuto: Automation = {
        ...auto,
        enrolledCount: (auto.enrolledCount || 0) + 1,
        completedCount: (auto.completedCount || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      updateSnapshot((prev) => ({
        ...prev,
        automations: prev.automations.map((a) => (a.id === auto.id ? updatedAuto : a)),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('automations', auth.currentUser!.uid, auto.id, updatedAuto)
        );
      } else {
        trackGuestDirtyItem('automations', auto.id);
      }
      await handleLogActivity(
        'automation_triggered',
        `Live Run Executed: ${auto.name}`,
        `Step count: ${auto.stepsSummary?.length || 1} | Enrolled contacts: +1`,
        'system'
      );
    },
    [handleLogActivity, syncCloudWrite, updateSnapshot]
  );

  // --------------------------------------------------------------------------
  // AUTO-RESPONDERS HANDLERS
  // --------------------------------------------------------------------------
  const handleCreateAutoResponder = useCallback(
    async (
      data: Omit<AutoResponder, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      const now = new Date().toISOString();
      const newResponder: AutoResponder = {
        ...data,
        id: generateSafeId('rsp'),
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        createdAt: now,
        updatedAt: now,
      };
      updateSnapshot((prev) => ({
        ...prev,
        autoResponders: [newResponder, ...prev.autoResponders],
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('autoresponders', auth.currentUser!.uid, newResponder.id, newResponder)
        );
      } else {
        trackGuestDirtyItem('autoResponders', newResponder.id);
      }
    },
    [activeUid, snapshot.workspace.id, syncCloudWrite, updateSnapshot]
  );

  const handleUpdateAutoResponder = useCallback(
    async (
      id: string,
      data: Omit<AutoResponder, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      const existing = snapshot.autoResponders.find((r) => r.id === id);
      const updated = { ...(existing || {}), ...data, id, updatedAt: new Date().toISOString() };
      updateSnapshot((prev) => ({
        ...prev,
        autoResponders: prev.autoResponders.map((r) => (r.id === id ? { ...r, ...data, updatedAt: updated.updatedAt } : r)),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('autoresponders', auth.currentUser!.uid, id, updated)
        );
      } else {
        trackGuestDirtyItem('autoResponders', id);
      }
    },
    [snapshot.autoResponders, syncCloudWrite, updateSnapshot]
  );

  const handleDeleteAutoResponder = useCallback(
    async (id: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        autoResponders: prev.autoResponders.filter((r) => r.id !== id),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          deleteCollectionDoc('autoresponders', auth.currentUser!.uid, id)
        );
      }
    },
    [syncCloudWrite, updateSnapshot]
  );

  // --------------------------------------------------------------------------
  // INBOX THREADS HANDLERS
  // --------------------------------------------------------------------------
  const handleCreateThread = useCallback(
    async (
      data: Omit<InboxThread, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ): Promise<string> => {
      const newId = generateSafeId('thr');
      const now = new Date().toISOString();
      const newThread: InboxThread = {
        ...data,
        id: newId,
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        createdAt: now,
        updatedAt: now,
      };
      updateSnapshot((prev) => ({
        ...prev,
        inboxThreads: [newThread, ...prev.inboxThreads],
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('inbox_threads', auth.currentUser!.uid, newThread.id, newThread)
        );
      } else {
        trackGuestDirtyItem('inboxThreads', newThread.id);
      }
      return newId;
    },
    [activeUid, snapshot.workspace.id, syncCloudWrite, updateSnapshot]
  );

  const handleUpdateThread = useCallback(
    async (
      id: string,
      data: Omit<InboxThread, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      const existing = snapshot.inboxThreads.find((t) => t.id === id);
      const updated = { ...(existing || {}), ...data, id, updatedAt: new Date().toISOString() };
      updateSnapshot((prev) => ({
        ...prev,
        inboxThreads: prev.inboxThreads.map((t) =>
          t.id === id ? { ...t, ...data, updatedAt: updated.updatedAt } : t
        ),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('inbox_threads', auth.currentUser!.uid, id, updated)
        );
      } else {
        trackGuestDirtyItem('inboxThreads', id);
      }
    },
    [snapshot.inboxThreads, syncCloudWrite, updateSnapshot]
  );

  const handleDeleteThread = useCallback(
    async (id: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        inboxThreads: prev.inboxThreads.filter((t) => t.id !== id),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          deleteCollectionDoc('inbox_threads', auth.currentUser!.uid, id)
        );
      }
    },
    [syncCloudWrite, updateSnapshot]
  );

  const handleForwardToInboxFromChatbot = useCallback(
    async (payload: {
      leadName: string;
      leadPhone: string;
      leadEmail?: string;
      listName: string;
      customerMessage?: string;
      outboundReply: string;
      contextLabel: string;
    }) => {
      const threadId = generateSafeId('thr');
      const now = new Date().toISOString();
      const initialMessage = {
        id: generateSafeId('msg'),
        sender: 'system' as const,
        senderIdentity: 'FlowPilot WhatsApp Bot',
        recipient: payload.leadPhone || payload.leadName,
        channel: 'whatsapp' as ChannelType,
        subject: payload.contextLabel,
        body: payload.outboundReply,
        timestamp: now,
        status: 'delivered' as const,
      };

      const newThread: InboxThread = {
        id: threadId,
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        leadName: payload.leadName,
        leadEmail: payload.leadEmail || '',
        leadPhone: payload.leadPhone,
        listName: payload.listName,
        channel: 'whatsapp',
        subjectOrContext: payload.contextLabel,
        lastLeadMessage: payload.customerMessage || payload.outboundReply || 'Inbound bot message',
        lastMessagePreview: (payload.outboundReply || 'Forwarded from chatbot').slice(0, 100),
        lastSender: 'autoresponder',
        status: 'replied',
        unreadCount: 1,
        messagesJson: JSON.stringify([initialMessage]),
        createdAt: now,
        updatedAt: now,
      };

      updateSnapshot((prev) => ({
        ...prev,
        inboxThreads: [newThread, ...prev.inboxThreads],
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('inbox_threads', auth.currentUser!.uid, newThread.id, newThread)
        );
      } else {
        trackGuestDirtyItem('inboxThreads', newThread.id);
      }
    },
    [activeUid, snapshot.workspace.id, syncCloudWrite, updateSnapshot]
  );

  // --------------------------------------------------------------------------
  // CAMPAIGNS HANDLERS
  // --------------------------------------------------------------------------
  const handleCreateCampaign = useCallback(
    async (
      data: Omit<Campaign, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      const now = new Date().toISOString();
      const newCampaign: Campaign = {
        ...data,
        id: generateSafeId('cmp'),
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        createdAt: now,
        updatedAt: now,
      };
      updateSnapshot((prev) => ({
        ...prev,
        campaigns: [newCampaign, ...prev.campaigns],
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('campaigns', auth.currentUser!.uid, newCampaign.id, newCampaign)
        );
      } else {
        trackGuestDirtyItem('campaigns', newCampaign.id);
      }
      await handleLogActivity(
        'campaign_sent',
        `Campaign created: ${newCampaign.name}`,
        `Target: ${newCampaign.targetList} | Channel: ${newCampaign.channel}`,
        newCampaign.channel === 'whatsapp' ? 'whatsapp' : newCampaign.channel === 'sms' ? 'sms' : 'email'
      );
    },
    [activeUid, handleLogActivity, snapshot.workspace.id, syncCloudWrite, updateSnapshot]
  );

  const handleUpdateCampaign = useCallback(
    async (
      id: string,
      data: Partial<Omit<Campaign, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>>
    ) => {
      const existing = snapshot.campaigns.find((c) => c.id === id);
      const updated = { ...(existing || {}), ...data, id, updatedAt: new Date().toISOString() };
      updateSnapshot((prev) => ({
        ...prev,
        campaigns: prev.campaigns.map((c) =>
          c.id === id ? { ...c, ...data, updatedAt: updated.updatedAt } : c
        ),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('campaigns', auth.currentUser!.uid, id, updated)
        );
      } else {
        trackGuestDirtyItem('campaigns', id);
      }
    },
    [snapshot.campaigns, syncCloudWrite, updateSnapshot]
  );

  const handleDispatchCampaign = useCallback(
    async (campaign: Campaign) => {
      const updatedCampaign: Campaign = {
        ...campaign,
        status: 'sent',
        sentCount: campaign.recipientCount || 1,
        deliveredCount: campaign.recipientCount || 1,
        openedCount: Math.round((campaign.recipientCount || 1) * 0.45),
        clickedCount: Math.round((campaign.recipientCount || 1) * 0.18),
        updatedAt: new Date().toISOString(),
      };
      updateSnapshot((prev) => ({
        ...prev,
        campaigns: prev.campaigns.map((c) => (c.id === campaign.id ? updatedCampaign : c)),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('campaigns', auth.currentUser!.uid, campaign.id, updatedCampaign)
        );
      } else {
        trackGuestDirtyItem('campaigns', campaign.id);
      }
      await handleLogActivity(
        'campaign_sent',
        `Broadcast Dispatched: ${campaign.name}`,
        `Channel: ${campaign.channel} | Recipients: ${campaign.recipientCount || 1}`,
        campaign.channel === 'whatsapp' ? 'whatsapp' : campaign.channel === 'sms' ? 'sms' : 'email'
      );
    },
    [handleLogActivity, syncCloudWrite, updateSnapshot]
  );

  const handleDeleteCampaign = useCallback(
    async (id: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        campaigns: prev.campaigns.filter((c) => c.id !== id),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          deleteCollectionDoc('campaigns', auth.currentUser!.uid, id)
        );
      }
    },
    [syncCloudWrite, updateSnapshot]
  );

  // --------------------------------------------------------------------------
  // ASSETS & PAGES HANDLERS
  // --------------------------------------------------------------------------
  const handleCreateAsset = useCallback(
    async (
      data: Omit<CaptureAsset, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      const now = new Date().toISOString();
      const newAsset: CaptureAsset = {
        ...data,
        id: generateSafeId('ast'),
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        createdAt: now,
        updatedAt: now,
      };
      updateSnapshot((prev) => ({
        ...prev,
        assets: [newAsset, ...prev.assets],
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('assets', auth.currentUser!.uid, newAsset.id, newAsset)
        );
      } else {
        trackGuestDirtyItem('assets', newAsset.id);
      }
      await handleLogActivity(
        'asset_published',
        `Asset Published: ${newAsset.title}`,
        `Format: ${newAsset.assetType} | Target List: ${newAsset.targetList}`,
        'web'
      );
    },
    [activeUid, handleLogActivity, snapshot.workspace.id, syncCloudWrite, updateSnapshot]
  );

  const handleUpdateAsset = useCallback(
    async (
      id: string,
      data: Omit<CaptureAsset, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      const existing = snapshot.assets.find((a) => a.id === id);
      const updated = { ...(existing || {}), ...data, id, updatedAt: new Date().toISOString() };
      updateSnapshot((prev) => ({
        ...prev,
        assets: prev.assets.map((a) =>
          a.id === id ? { ...a, ...data, updatedAt: updated.updatedAt } : a
        ),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('assets', auth.currentUser!.uid, id, updated)
        );
      } else {
        trackGuestDirtyItem('assets', id);
      }
    },
    [snapshot.assets, syncCloudWrite, updateSnapshot]
  );

  const handleDeleteAsset = useCallback(
    async (id: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        assets: prev.assets.filter((a) => a.id !== id),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() => deleteCollectionDoc('assets', auth.currentUser!.uid, id));
      }
    },
    [syncCloudWrite, updateSnapshot]
  );

  const handleSubmitAssetLead = useCallback(
    async (
      asset: CaptureAsset,
      lead: { fullName: string; email: string; phone: string },
      extra?: AssetLeadSubmissionExtra
    ) => {
      const now = new Date().toISOString();
      const newContact: Contact = {
        id: generateSafeId('cnt'),
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        company: extra?.company || '',
        stage: 'lead',
        temperature: 'warm',
        source: asset.title || 'Capture Page',
        consentStatus: 'opted_in',
        listName: asset.targetList || 'General',
        tags: Array.from(new Set(['lead_captured', ...(extra?.customTags || [])])),
        ltv: 0,
        notes: extra?.notes || `Opted in through ${asset.title}`,
        createdAt: now,
        updatedAt: now,
      };

      const submittedListNormalized = (asset.targetList || 'General').trim().toLowerCase();
      const submittedFormTitleNormalized = (asset.title || '').trim().toLowerCase();

      // Match active automations configured for form submission or joining this target list
      const matchedAutomations = (snapshot.automations || []).filter((auto) => {
        if (auto.status !== 'active') return false;
        if (auto.triggerType !== 'form_submission' && auto.triggerType !== 'list_joined') {
          return false;
        }
        let triggerData: Record<string, any> | undefined;
        if (auto.flowGraphJson) {
          try {
            const parsed = JSON.parse(auto.flowGraphJson);
            if (Array.isArray(parsed?.nodes)) {
              const trig = parsed.nodes.find((n: any) => n.type === 'trigger');
              triggerData = trig?.data;
            }
          } catch {
            // Ignore malformed JSON
          }
        }

        if (triggerData?.formScope === 'specific_form') {
          const matchesId = !!triggerData.targetFormId && triggerData.targetFormId === asset.id;
          const matchesTitle =
            !!triggerData.targetFormTitle &&
            triggerData.targetFormTitle.trim().toLowerCase() === submittedFormTitleNormalized;
          return matchesId || matchesTitle;
        }

        const autoListNormalized = (auto.targetList || auto.targetListName || '').trim().toLowerCase();
        if (!autoListNormalized || autoListNormalized === 'general' || autoListNormalized === 'general contacts') {
          return (
            auto.triggerType === 'form_submission' ||
            submittedListNormalized === 'general' ||
            submittedListNormalized === 'general contacts'
          );
        }
        return autoListNormalized === submittedListNormalized;
      });

      const matchedIds = new Set(matchedAutomations.map((m) => m.id));

      const updatedAsset = {
        ...asset,
        submissionsCount: (asset.submissionsCount || 0) + 1,
        viewsCount: (asset.viewsCount || 0) + 1,
        updatedAt: now,
      };

      const updatedMatchedAutos = matchedAutomations.map((auto) => ({
        ...auto,
        enrolledCount: (auto.enrolledCount || 0) + 1,
        completedCount: (auto.completedCount || 0) + 1,
        updatedAt: now,
      }));

      updateSnapshot((prev) => ({
        ...prev,
        contacts: [newContact, ...prev.contacts],
        assets: prev.assets.map((a) => (a.id === asset.id ? updatedAsset : a)),
        automations:
          matchedIds.size > 0
            ? prev.automations.map((auto) => {
                const hit = updatedMatchedAutos.find((u) => u.id === auto.id);
                return hit || auto;
              })
            : prev.automations,
      }));

      if (auth.currentUser) {
        await syncCloudWrite(async () => {
          const ops: Promise<void>[] = [
            upsertCollectionDoc('contacts', auth.currentUser!.uid, newContact.id, newContact),
            upsertCollectionDoc('assets', auth.currentUser!.uid, asset.id, updatedAsset),
            ...updatedMatchedAutos.map((auto) =>
              upsertCollectionDoc('automations', auth.currentUser!.uid, auto.id, auto)
            ),
          ];
          await Promise.all(ops);
        });
      } else {
        trackGuestDirtyItem('contacts', newContact.id);
        trackGuestDirtyItem('assets', asset.id);
        updatedMatchedAutos.forEach((a) => trackGuestDirtyItem('automations', a.id));
      }

      await handleLogActivity(
        'form_captured',
        `Lead captured via ${asset.title}: ${lead.fullName}`,
        `Email: ${lead.email} | Target list: ${asset.targetList || 'General'}`,
        'web'
      );

      // Evaluate immediate opening workflow actions after form submission
      for (const auto of matchedAutomations) {
        await handleLogActivity(
          'automation_triggered',
          `Workflow started after form submission: ${auto.name}`,
          `Lead ${lead.fullName} matched trigger (${auto.triggerDetail || auto.triggerType})`,
          'system'
        );

        if (auto.flowGraphJson) {
          try {
            const parsed = JSON.parse(auto.flowGraphJson);
            const gNodes: any[] = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
            const gEdges: any[] = Array.isArray(parsed?.edges) ? parsed.edges : [];
            const visited = new Set<string>();
            let cursor = gNodes.find((n) => n.type === 'trigger');
            let stepsWalked = 0;

            while (cursor && !visited.has(cursor.id) && stepsWalked < 5) {
              visited.add(cursor.id);
              stepsWalked += 1;

              if (cursor.type === 'delay') {
                // Stop immediate execution at first wait timer
                break;
              }

              if (cursor.type === 'action') {
                const rawMsg =
                  cursor.data?.message ||
                  `Hi {{first_name}}! Thanks for submitting ${asset.title}.`;
                const personalizedBody = personalizeAutomationMessage(rawMsg, {
                  fullName: lead.fullName,
                  email: lead.email,
                  phone: lead.phone,
                  company: extra?.company,
                  listName: asset.targetList || 'General',
                  senderName: snapshot.workspace.senderName,
                  automationId: auto.id,
                });

                if (cursor.data?.nodeType === 'action_send_whatsapp' && lead.phone) {
                  deliverChannelMessage({
                    channel: 'whatsapp',
                    to: lead.phone,
                    leadName: lead.fullName,
                    body: personalizedBody,
                    listName: asset.targetList || 'General',
                    source: 'automation_workflow',
                    workspace: snapshot.workspace,
                    privateProfile: snapshot.privateProfile,
                  }).catch(() => {});
                } else if (cursor.data?.nodeType === 'action_send_email' && lead.email) {
                  deliverChannelMessage({
                    channel: 'email',
                    to: lead.email,
                    leadName: lead.fullName,
                    subject: cursor.data?.emailSubject || auto.name,
                    body: personalizedBody,
                    listName: asset.targetList || 'General',
                    source: 'automation_workflow',
                    workspace: snapshot.workspace,
                    privateProfile: snapshot.privateProfile,
                  }).catch(() => {});
                }
              }

              const nextEdge = gEdges.find((e) => e.source === cursor.id);
              cursor = nextEdge ? gNodes.find((n) => n.id === nextEdge.target) : undefined;
            }
          } catch {
            // Safe guard against non-canvas legacy graphs
          }
        }
      }

      // Best-effort optional webhook capture sync (never blocks static frontend workflows)
      fetch('/api/leads/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          assetName: asset.title || asset.headline,
          targetList: asset.targetList || 'General Contacts',
          fullName: lead.fullName,
          email: lead.email,
          phone: lead.phone,
          company: extra?.company || '',
          customTags: extra?.customTags,
          redirectUrl: asset.redirectUrl,
        }),
      }).catch(() => {});
    },
    [
      activeUid,
      handleLogActivity,
      snapshot.automations,
      snapshot.privateProfile,
      snapshot.workspace,
      syncCloudWrite,
      updateSnapshot,
    ]
  );

  // --------------------------------------------------------------------------
  // CHATBOTS HANDLERS
  // --------------------------------------------------------------------------
  const handleCreateChatbot = useCallback(
    async (
      data: Omit<ChatbotFlow, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      const now = new Date().toISOString();
      const newBot: ChatbotFlow = {
        ...data,
        id: generateSafeId('bot'),
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        createdAt: now,
        updatedAt: now,
      };
      updateSnapshot((prev) => ({
        ...prev,
        chatbots: [newBot, ...prev.chatbots],
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('chatbots', auth.currentUser!.uid, newBot.id, newBot)
        );
      } else {
        trackGuestDirtyItem('chatbots', newBot.id);
      }
    },
    [activeUid, snapshot.workspace.id, syncCloudWrite, updateSnapshot]
  );

  const handleUpdateChatbot = useCallback(
    async (
      id: string,
      data: Omit<ChatbotFlow, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      const existing = snapshot.chatbots.find((b) => b.id === id);
      const updated = { ...(existing || {}), ...data, id, updatedAt: new Date().toISOString() };
      updateSnapshot((prev) => ({
        ...prev,
        chatbots: prev.chatbots.map((b) =>
          b.id === id ? { ...b, ...data, updatedAt: updated.updatedAt } : b
        ),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('chatbots', auth.currentUser!.uid, id, updated)
        );
      } else {
        trackGuestDirtyItem('chatbots', id);
      }
    },
    [snapshot.chatbots, syncCloudWrite, updateSnapshot]
  );

  const handleDeleteChatbot = useCallback(
    async (id: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        chatbots: prev.chatbots.filter((b) => b.id !== id),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          deleteCollectionDoc('chatbots', auth.currentUser!.uid, id)
        );
      }
    },
    [syncCloudWrite, updateSnapshot]
  );

  const handleRecordBotSession = useCallback(
    async (bot: ChatbotFlow) => {
      const updatedBot: ChatbotFlow = {
        ...bot,
        sessionsCount: (bot.sessionsCount || 0) + 1,
        resolvedCount: (bot.resolvedCount || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      updateSnapshot((prev) => ({
        ...prev,
        chatbots: prev.chatbots.map((b) => (b.id === bot.id ? updatedBot : b)),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('chatbots', auth.currentUser!.uid, bot.id, updatedBot)
        );
      } else {
        trackGuestDirtyItem('chatbots', bot.id);
      }
      await handleLogActivity(
        'whatsapp_replied',
        `Bot session completed: ${bot.name}`,
        `Keyword: ${bot.triggerKeyword} | Match: ${bot.matchType}`,
        'whatsapp'
      );
    },
    [handleLogActivity, syncCloudWrite, updateSnapshot]
  );

  // --------------------------------------------------------------------------
  // TASKS HANDLERS
  // --------------------------------------------------------------------------
  const handleCreateTask = useCallback(
    async (
      data: Omit<TaskItem, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      const now = new Date().toISOString();
      const newTask: TaskItem = {
        ...data,
        id: generateSafeId('tsk'),
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        createdAt: now,
        updatedAt: now,
      };
      updateSnapshot((prev) => ({
        ...prev,
        tasks: [newTask, ...prev.tasks],
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('tasks', auth.currentUser!.uid, newTask.id, newTask)
        );
      } else {
        trackGuestDirtyItem('tasks', newTask.id);
      }
    },
    [activeUid, snapshot.workspace.id, syncCloudWrite, updateSnapshot]
  );

  const handleCompleteTask = useCallback(
    async (task: TaskItem) => {
      const updatedTask: TaskItem = {
        ...task,
        status: task.status === 'completed' ? 'pending' : 'completed',
        updatedAt: new Date().toISOString(),
      };
      updateSnapshot((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === task.id ? updatedTask : t)),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('tasks', auth.currentUser!.uid, task.id, updatedTask)
        );
      } else {
        trackGuestDirtyItem('tasks', task.id);
      }
    },
    [syncCloudWrite, updateSnapshot]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== taskId),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() => deleteCollectionDoc('tasks', auth.currentUser!.uid, taskId));
      }
    },
    [syncCloudWrite, updateSnapshot]
  );

  // --------------------------------------------------------------------------
  // WORKSPACE SETTINGS & PROFILE HANDLERS
  // --------------------------------------------------------------------------
  const handleUpdateWorkspace = useCallback(
    async (data: Omit<Workspace, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => {
      const mergedWorkspace = {
        ...snapshot.workspace,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      updateSnapshot((prev) => ({
        ...prev,
        workspace: mergedWorkspace,
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() => upsertWorkspaceRoot(auth.currentUser!.uid, mergedWorkspace));
      } else {
        trackGuestDirtyItem('workspace');
      }
    },
    [snapshot.workspace, syncCloudWrite, updateSnapshot]
  );

  const handleUpdatePrivateProfile = useCallback(
    async (
      data: Omit<UserPrivateProfile, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      const mergedProfile = {
        ...snapshot.privateProfile,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      updateSnapshot((prev) => ({
        ...prev,
        privateProfile: mergedProfile,
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertPrivateProfile(
            auth.currentUser!.uid,
            user?.email || mergedProfile.email || 'operator@flowpilot.app',
            mergedProfile
          )
        );
      } else {
        trackGuestDirtyItem('privateProfile');
      }
    },
    [snapshot.privateProfile, syncCloudWrite, updateSnapshot, user?.email]
  );

  const handleAddMember = useCallback(
    async (data: { memberName: string; memberEmail: string; role: MemberRole }) => {
      const now = new Date().toISOString();
      const newMember: WorkspaceMember = {
        id: generateSafeId('mbr'),
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        memberName: data.memberName,
        memberEmail: data.memberEmail,
        role: data.role,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      updateSnapshot((prev) => ({
        ...prev,
        members: [...prev.members, newMember],
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertMemberDoc(auth.currentUser!.uid, newMember.id, newMember)
        );
      } else {
        trackGuestDirtyItem('members', newMember.id);
      }
    },
    [activeUid, snapshot.workspace.id, syncCloudWrite, updateSnapshot]
  );

  const handleDeleteMember = useCallback(
    async (memberId: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        members: prev.members.filter((m) => m.id !== memberId),
      }));
      if (auth.currentUser) {
        await syncCloudWrite(() => deleteMemberDoc(auth.currentUser!.uid, memberId));
      }
    },
    [syncCloudWrite, updateSnapshot]
  );

  const handleReseedWorkspace = useCallback(async () => {
    const starter = buildStarterWorkspaceSnapshot(
      activeUid,
      user?.email || 'user@example.com',
      userProfile?.displayName || 'Workspace Operator',
      snapshot.workspace.name || 'My Sovereign Workspace'
    );
    updateSnapshot(() => starter);
    if (auth.currentUser) {
      await syncCloudWrite(async () => {
        const uid = auth.currentUser!.uid;
        await upsertWorkspaceRoot(uid, starter.workspace);
        await Promise.all([
          ...starter.lists.map((l) => upsertCollectionDoc('lists', uid, l.id, l)),
          ...starter.automations.map((a) => upsertCollectionDoc('automations', uid, a.id, a)),
          ...starter.members.map((m) => upsertMemberDoc(uid, m.id, m)),
        ]);
      });
    }
  }, [activeUid, snapshot.workspace.name, syncCloudWrite, updateSnapshot, user?.email, userProfile?.displayName]);

  const handleRestoreWorkspaceSnapshot = useCallback(
    (snap: WorkspaceSnapshot) => {
      updateSnapshot(() => snap);
      if (auth.currentUser) {
        const uid = auth.currentUser.uid;
        void syncCloudWrite(async () => {
          await upsertWorkspaceRoot(uid, snap.workspace);
          await upsertPrivateProfile(
            uid,
            user?.email || snap.privateProfile?.email || 'operator@flowpilot.app',
            snap.privateProfile
          );
          await Promise.all([
            ...snap.lists.map((l) => upsertCollectionDoc('lists', uid, l.id, l)),
            ...snap.automations.map((a) => upsertCollectionDoc('automations', uid, a.id, a)),
            ...snap.contacts.map((c) => upsertCollectionDoc('contacts', uid, c.id, c)),
            ...snap.campaigns.map((c) => upsertCollectionDoc('campaigns', uid, c.id, c)),
            ...snap.assets.map((a) => upsertCollectionDoc('assets', uid, a.id, a)),
            ...snap.chatbots.map((b) => upsertCollectionDoc('chatbots', uid, b.id, b)),
            ...snap.autoResponders.map((r) => upsertCollectionDoc('autoresponders', uid, r.id, r)),
            ...snap.inboxThreads.map((t) => upsertCollectionDoc('inbox_threads', uid, t.id, t)),
            ...snap.tasks.map((t) => upsertCollectionDoc('tasks', uid, t.id, t)),
          ]);
        });
      }
    },
    [syncCloudWrite, updateSnapshot, user?.email]
  );

  // Public Landing Page Lead Capture
  const handleCapturePublicLead = useCallback(
    async (lead: {
      fullName: string;
      email: string;
      phone: string;
      segment: string;
    }) => {
      const now = new Date().toISOString();
      const newContact: Contact = {
        id: generateSafeId('cnt'),
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        stage: 'lead',
        temperature: 'hot',
        source: 'FlowPilot Public Portal',
        consentStatus: 'opted_in',
        listName: 'Public Leads',
        tags: ['public_portal', lead.segment.toLowerCase().replace(/[^a-z0-9]/g, '_')],
        ltv: 0,
        notes: `Registered interest via Public Portal. Segment: ${lead.segment}`,
        createdAt: now,
        updatedAt: now,
      };

      updateSnapshot((prev) => ({
        ...prev,
        contacts: [newContact, ...prev.contacts],
      }));

      if (auth.currentUser) {
        await syncCloudWrite(() =>
          upsertCollectionDoc('contacts', auth.currentUser!.uid, newContact.id, newContact)
        );
      } else {
        trackGuestDirtyItem('contacts', newContact.id);
      }

      await handleLogActivity(
        'lead_captured',
        `Public portal lead captured: ${lead.fullName}`,
        `Email: ${lead.email} | Phone: ${lead.phone || 'N/A'} | Segment: ${lead.segment}`,
        'web'
      );
    },
    [activeUid, handleLogActivity, snapshot.workspace.id, syncCloudWrite, updateSnapshot]
  );

  // Quick Action Navigator from Dashboard
  const handleQuickAction = useCallback(
    (
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
          setActiveTab('contacts');
          setContactModalOpenOnMount(true);
          break;
        case 'create_automation':
          setActiveTab('workflow_builder');
          setAutomationModalOpenOnMount(true);
          break;
        case 'create_form':
          setActiveTab('assets');
          setAssetModalMode('inline_form');
          break;
        case 'create_landing_page':
          setActiveTab('assets');
          setAssetModalMode('landing_page');
          break;
        case 'create_campaign':
        case 'send_broadcast':
          setActiveTab('campaigns');
          setCampaignModalOpenOnMount(true);
          break;
        default:
          break;
      }
    },
    []
  );

  // Unread inbox threads counter
  const unreadCount = useMemo(() => {
    return snapshot.inboxThreads.reduce((acc, t) => acc + (t.unreadCount || 0), 0);
  }, [snapshot.inboxThreads]);

  // Navigation Items Catalog
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
    { id: 'workflow_builder', label: 'Workflow Builder', icon: Split },
    { id: 'email_domain', label: 'Domain & DNS', icon: Globe },
    { id: 'webhooks', label: 'Webhook Gateway', icon: Radio },
    { id: 'connect_whatsapp', label: 'Connect WhatsApp', icon: QrCode },
    { id: 'whatsapp_connect', label: 'WhatsApp Connect', icon: Smartphone },
    { id: 'inbox', label: 'Omnichannel Inbox', icon: Inbox, badge: unreadCount > 0 ? unreadCount : undefined },
    { id: 'contacts', label: 'CRM & Audiences', icon: Users },
    { id: 'lists', label: 'Segments & Lists', icon: Layers },
    { id: 'autoresponders', label: 'Auto-Responders', icon: Zap },
    { id: 'campaigns', label: 'Campaigns & Broadcasts', icon: Send },
    { id: 'assets', label: 'Lead Gen & Forms', icon: FileText },
    { id: 'funnels', label: 'Conversion Funnels', icon: Sliders },
    { id: 'chatbots', label: 'WhatsApp & Bots', icon: Bot },
    { id: 'settings', label: 'Workspace & Gateway', icon: Settings },
  ];


  if (isPrivacyRoute) {
    return (
      <ErrorBoundary fallbackTitle="Privacy Policy" onReset={() => (window.location.href = "/")}>
        <PrivacyPolicyPage onBack={navigateBackFromPrivacy} />
      </ErrorBoundary>
    );
  }

  if (isWhatsAppSettingsRoute) {
    return (

      <ErrorBoundary fallbackTitle="WhatsApp Embedded Signup" onReset={() => (window.location.href = "/")}>
        <WhatsAppEmbeddedSignupPage
          userId={activeUid}
          userEmail={user?.email || "jonajukej777@gmail.com"}
          onBackToDashboard={navigateBackFromWhatsAppEmbeddedSignup}
          onAccountConnected={(acc) => {
            const nextWs = { ...snapshot.workspace, whatsappConnected: true };
            const nextProf = snapshot.privateProfile
              ? {
                  ...snapshot.privateProfile,
                  whatsappBusinessNumber: acc.number || snapshot.privateProfile.whatsappBusinessNumber,
                }
              : snapshot.privateProfile;
            updateSnapshot((prev) => ({
              ...prev,
              workspace: { ...prev.workspace, whatsappConnected: true },
              privateProfile: prev.privateProfile
                ? {
                    ...prev.privateProfile,
                    whatsappBusinessNumber: acc.number || prev.privateProfile.whatsappBusinessNumber,
                  }
                : prev.privateProfile,
            }));
            if (auth.currentUser) {
              void syncCloudWrite(async () => {
                await upsertWorkspaceRoot(auth.currentUser!.uid, nextWs);
                if (nextProf) {
                  await upsertPrivateProfile(
                    auth.currentUser!.uid,
                    user?.email || nextProf.email || 'operator@flowpilot.app',
                    nextProf
                  );
                }
              });
            }
          }}
        />
      </ErrorBoundary>
    );
  }

  if (isEmailSettingsRoute) {
    return (
      <ErrorBoundary fallbackTitle="Custom Domain Email Automation" onReset={() => (window.location.href = "/")}>
        <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-8">
          <CustomDomainEmailSettings
            onBack={navigateBackFromEmailSettings}
            onNavigateToAutomations={() => {
              navigateBackFromEmailSettings();
              setActiveTab('workflow_builder');
            }}
            isAuthenticated={Boolean(user)}
            onOpenAuth={() => {
              setAuthModalMode('signin');
              setAuthModalOpen(true);
            }}
            initialStatus={emailDomainStatus}
            onStatusChanged={setEmailDomainStatus}
            defaultSenderName={snapshot.workspace.senderName || snapshot.workspace.name}
          />
        </div>
      </ErrorBoundary>
    );
  }

  if (isFormRoute) {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const cap = params?.get('capture') || params?.get('form') || '';
    const pathPart = typeof window !== 'undefined'
      ? window.location.pathname.replace(/^\/(form|public\/form|p)\/?/i, '')
      : '';
    const requestedSlug = (cap || pathPart).trim();

    // Prefer local match if it has custom content, otherwise use server-fetched asset (for incognito sessions)
    const localMatch = snapshot.assets.find(
      (a) => a.slug === requestedSlug || a.id === requestedSlug
    );
    const activeDisplayAsset =
      localMatch && (localMatch.headline || localMatch.ctaText)
        ? localMatch
        : publicFetchedAsset || localMatch || snapshot.assets[0];

    const activeFormSchema = (activeDisplayAsset as any)?.formFields || undefined;

    return (
      <ErrorBoundary fallbackTitle="Public Lead Form" onReset={() => (window.location.href = '/')}>
        <FormPublicView
          isPublicView={true}
          isLoading={isLoadingPublicForm && !activeDisplayAsset}
          asset={activeDisplayAsset}
          formSchema={activeFormSchema}
          onSubmit={async (lead) => {
            await handleSubmitAssetLead(
              (activeDisplayAsset as CaptureAsset) || {
                id: 'pub_form',
                workspaceId: activeUid,
                ownerId: activeUid,
                title: 'Public Lead Capture Form',
                assetType: 'inline_form',
                slug: requestedSlug || 'public-lead-form',
                headline: 'Public Lead Capture Form',
                subheadline: 'Captured via public shareable form link',
                ctaText: 'Submit Details',
                targetList: snapshot.lists[0]?.name || 'Public Leads',
                redirectUrl: '',
                viewsCount: 1,
                conversionsCount: 1,
                conversionRate: 100,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              lead
            );
          }}
          onBackToWorkflow={() => {
            setIsFormRoute(false);
            setActiveTab('workflow_builder');
          }}
        />
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] text-[#0F172A] dark:text-[#F1F5F9] font-sans antialiased flex flex-col selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* ------------------------------------------------------------------ */}
      {/* GLOBAL HEADER BAR (HAMBURGER DRAWER TRIGGER ACROSS ALL VIEWPORTS)  */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0D1322]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Left: Hamburger Trigger, Brand Logo & Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            {!isPublicLanding && (
              <button
                type="button"
                onClick={() => setNavDrawerOpen((prev) => !prev)}
                className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                aria-label="Open workspace navigation menu"
                aria-expanded={navDrawerOpen}
                title="Open Workspace Navigation"
              >
                {navDrawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}

            <button
              onClick={() => {
                setNavDrawerOpen(false);
                if (isPublicLanding) {
                  setIsPublicLanding(false);
                  setActiveTab('dashboard');
                } else {
                  setActiveTab('dashboard');
                }
              }}
              className="flex items-center gap-2.5 focus:outline-hidden group shrink-0 cursor-pointer"
              title="Return to FlowPilot Dashboard"
            >
              <FlowPilotLogo variant={themeMode === 'dark' ? 'dark' : 'light'} size="sm" />
            </button>

            {/* Breadcrumb Hierarchy */}
            {!isPublicLanding && (
              <div className="hidden md:flex items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                <span className="font-medium text-slate-600 dark:text-slate-300 truncate max-w-[140px]">
                  {snapshot.workspace.name || 'FlowPilot'}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                  {navItems.find((n) => n.id === activeTab)?.label || 'Dashboard'}
                </span>
              </div>
            )}
          </div>

          {/* Center Domain Status */}
          {!isPublicLanding && (
            <div className="hidden lg:flex items-center gap-2">
              <button
                onClick={() => navigateToEmailSettings()}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 transition-colors text-xs cursor-pointer whitespace-nowrap"
                title="Manage Custom Domain Email Settings"
              >
                <span
                  className={`inline-flex rounded-full h-2 w-2 shrink-0 ${
                    emailDomainStatus.verified
                      ? 'bg-emerald-500'
                      : emailDomainStatus.domain
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                />
                <span className="font-mono text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {emailDomainStatus.domain || 'Setup Custom Domain'}
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    emailDomainStatus.verified
                      ? 'text-emerald-600'
                      : emailDomainStatus.domain
                      ? 'text-amber-600'
                      : 'text-blue-600'
                  }`}
                >
                  {emailDomainStatus.verified
                    ? 'Verified'
                    : emailDomainStatus.domain
                    ? 'Pending DNS'
                    : 'Connect'}
                </span>
              </button>
            </div>
          )}

          {/* Quick Utility Tools (Right side) */}
          <div className="flex items-center gap-2 shrink-0">
            {!isPublicLanding && (
              <button
                onClick={() => {
                  setNavDrawerOpen(false);
                  setActiveTab('workflow_builder');
                  setAutomationModalOpenOnMount(true);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs shadow-blue-500/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Workflow</span>
              </button>
            )}

            {/* View Mode Switcher */}
            <button
              onClick={() => {
                setNavDrawerOpen(false);
                setIsPublicLanding((prev) => !prev);
              }}
              className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors hidden md:inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isPublicLanding ? (
                <>
                  <LayoutDashboard className="w-3.5 h-3.5 text-blue-500" />
                  Enter Workspace
                </>
              ) : (
                <>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  Public Landing
                </>
              )}
            </button>

            {/* System Diagnostics Trigger */}
            <button
              onClick={() => setDiagnosticsModalOpen(true)}
              className="p-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-800 cursor-pointer"
              title="Open System Diagnostics & Delivery Gateway Monitor"
            >
              <Activity className="w-4 h-4" />
            </button>

            {/* Design System Reference Trigger */}
            <button
              onClick={() => setDesignSystemModalOpen(true)}
              className="p-2 text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg transition-colors border border-transparent hover:border-purple-200 dark:hover:border-purple-800 cursor-pointer"
              title="Design System & Theme Export"
            >
              <Palette className="w-4 h-4" />
            </button>

            {/* Light / Dark Theme Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-colors border border-transparent hover:border-amber-200 dark:hover:border-amber-800 cursor-pointer"
              title={themeMode === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            >
              {themeMode === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* User Session Profile / Sign In */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setActiveTab('settings')}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs ring-2 ring-blue-500/20">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden lg:block">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-none truncate max-w-[110px]">
                      {user.displayName || user.email?.split('@')[0]}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-none mt-0.5 truncate max-w-[110px]">
                      {snapshot.workspace.name || 'Workspace'}
                    </p>
                  </div>
                </button>
                <button
                  onClick={async () => {
                    await logout();
                    setIsPublicLanding(true);
                  }}
                  className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => {
                    setAuthModalMode('signin');
                    setAuthModalOpen(true);
                  }}
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setAuthModalMode('signup');
                    setAuthModalOpen(true);
                  }}
                  className="text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-3.5 py-1.5 rounded-lg shadow-xs shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  Create Account
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* SLIDE-OUT WORKSPACE NAVIGATION DRAWER (DESKTOP & MOBILE)           */}
      {/* ------------------------------------------------------------------ */}
      {!isPublicLanding && (
        <>
          {navDrawerOpen && (
            <div
              className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs transition-opacity"
              onClick={() => setNavDrawerOpen(false)}
              aria-hidden="true"
            />
          )}

          <aside
            className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 bg-white dark:bg-[#0D1322] border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transform transition-transform duration-200 ease-out ${
              navDrawerOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
            }`}
            aria-label="Workspace Navigation"
            aria-hidden={!navDrawerOpen}
          >
            {/* Drawer Header */}
            <div className="h-16 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <FlowPilotLogo variant={themeMode === 'dark' ? 'dark' : 'light'} size="sm" />
              </div>
              <button
                type="button"
                onClick={() => setNavDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grouped Navigation Items */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
              {[
                {
                  groupTitle: 'Core Workspace',
                  ids: ['dashboard', 'workflow_builder', 'lists', 'contacts'] as ActiveTab[],
                },
                {
                  groupTitle: 'Messaging & Channels',
                  ids: ['inbox', 'campaigns', 'autoresponders', 'chatbots'] as ActiveTab[],
                },
                {
                  groupTitle: 'Lead Capture & Funnels',
                  ids: ['assets', 'funnels'] as ActiveTab[],
                },
                {
                  groupTitle: 'Connections & Settings',
                  ids: [
                    'connect_whatsapp',
                    'whatsapp_connect',
                    'email_domain',
                    'webhooks',
                    'settings',
                  ] as ActiveTab[],
                },
              ].map((group) => {
                const items = group.ids
                  .map((id) => navItems.find((n) => n.id === id))
                  .filter((n): n is NavItem => Boolean(n));

                return (
                  <div key={group.groupTitle} className="space-y-1">
                    <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {group.groupTitle}
                    </p>
                    <div className="space-y-0.5">
                      {items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setActiveTab(item.id);
                              setNavDrawerOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                              isActive
                                ? 'bg-[#2563EB] text-white shadow-xs shadow-blue-500/20'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon
                                className={`w-4 h-4 shrink-0 ${
                                  isActive
                                    ? 'text-white'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                              />
                              <span className="truncate">{item.label}</span>
                            </div>
                            {item.badge !== undefined && (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md tabular-nums ${
                                  isActive
                                    ? 'bg-white text-blue-600'
                                    : 'bg-rose-500 text-white'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>

            {/* Drawer Footer CTA */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0 bg-slate-50/70 dark:bg-[#0A0F1D]">
              <button
                type="button"
                onClick={() => {
                  setNavDrawerOpen(false);
                  setActiveTab('workflow_builder');
                  setAutomationModalOpenOnMount(true);
                }}
                className="w-full py-2.5 px-3.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Workflow</span>
              </button>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                <span className="truncate">{snapshot.workspace.name || 'Workspace'}</span>
                <span className="font-mono text-emerald-600 font-semibold">Live</span>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MAIN CONTENT VIEW CONTROLLER                                       */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1">
        {isPublicLanding ? (
          <ErrorBoundary
            fallbackTitle="Public Landing Portal"
            onReset={() => setIsPublicLanding(false)}
          >
            <LandingPage
              onOpenAuth={(mode) => {
                setAuthModalMode(mode);
                setAuthModalOpen(true);
              }}
              onEnterWorkspace={() => setIsPublicLanding(false)}
              onCapturePublicLead={handleCapturePublicLead}
              isAuthenticated={!!user}
              themeMode={themeMode}
              onToggleThemeMode={toggleTheme}
            />
          </ErrorBoundary>
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {syncNotice && (
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-3">
                <span>{syncNotice}</span>
                <button
                  type="button"
                  onClick={() => setSyncNotice(null)}
                  className="text-emerald-700 dark:text-emerald-300 hover:underline font-semibold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}
            <ErrorBoundary
              fallbackTitle={`Module Error: ${activeTab}`}
              onReset={() => setActiveTab('dashboard')}
            >
              {activeTab === 'dashboard' && (
                <DashboardOverview
                  workspace={snapshot.workspace}
                  contacts={snapshot.contacts}
                  automations={snapshot.automations}
                  campaigns={snapshot.campaigns}
                  assets={snapshot.assets}
                  chatbots={snapshot.chatbots}
                  tasks={snapshot.tasks}
                  activities={snapshot.activities}
                  emailDomainStatus={emailDomainStatus}
                  onNavigate={(tab) => setActiveTab(tab)}
                  onQuickAction={handleQuickAction}
                  onOpenDiagnostics={() => setDiagnosticsModalOpen(true)}
                  onCompleteTask={handleCompleteTask}
                />
              )}

              {activeTab === 'inbox' && (
                <InboxView
                  threads={snapshot.inboxThreads}
                  contacts={snapshot.contacts}
                  lists={snapshot.lists}
                  campaigns={snapshot.campaigns}
                  autoResponders={snapshot.autoResponders}
                  senderName={snapshot.workspace.senderName || user?.displayName || 'Workspace Operator'}
                  workspace={snapshot.workspace}
                  privateProfile={snapshot.privateProfile}
                  onNavigateToSettings={() => setActiveTab('settings')}
                  onCreateThread={handleCreateThread}
                  onUpdateThread={handleUpdateThread}
                  onDeleteThread={handleDeleteThread}
                  onCreateContact={handleCreateContact}
                  onLogActivity={handleLogActivity}
                />
              )}

              {activeTab === 'contacts' && (
                <ContactsCrmView
                  contacts={snapshot.contacts}
                  automations={snapshot.automations}
                  tasks={snapshot.tasks}
                  activities={snapshot.activities}
                  currency={snapshot.workspace.currency}
                  openModalOnMount={contactModalOpenOnMount}
                  onClearModalMount={() => setContactModalOpenOnMount(false)}
                  onCreateContact={handleCreateContact}
                  onUpdateContact={handleUpdateContact}
                  onDeleteContact={handleDeleteContact}
                  onBulkImportContacts={handleBulkImportContacts}
                  onMergeContacts={handleMergeContacts}
                  onCreateTask={handleCreateTask}
                  onCompleteTask={handleCompleteTask}
                  onDeleteTask={handleDeleteTask}
                  onLogActivity={handleLogActivity}
                  onSimulateAutomationRun={handleSimulateAutomationRun}
                  onOpenDiagnostics={() => setDiagnosticsModalOpen(true)}
                />
              )}

              {activeTab === 'lists' && (
                <ListsView
                  lists={snapshot.lists}
                  contacts={snapshot.contacts}
                  currency={snapshot.workspace.currency}
                  onCreateList={handleCreateList}
                  onUpdateList={handleUpdateList}
                  onDeleteList={handleDeleteList}
                  onCreateContact={handleCreateContact}
                  onUpdateContact={handleUpdateContact}
                  onDeleteContact={handleDeleteContact}
                  onBulkImportContacts={handleBulkImportContacts}
                  onCreateAutomationForList={(listName) => {
                    setPreselectedListName(listName);
                    setActiveTab('workflow_builder');
                  }}
                  onCreateAutoResponderForList={(listName) => {
                    setPreselectedListName(listName);
                    setActiveTab('autoresponders');
                  }}
                  onCreateFormForList={(listName) => {
                    setPreselectedListName(listName);
                    setAssetModalMode('inline_form');
                    setActiveTab('assets');
                  }}
                  onSendBroadcastToList={(listName) => {
                    setPreselectedListName(listName);
                    setActiveTab('campaigns');
                  }}
                />
              )}

              {activeTab === 'workflow_builder' && (
                <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-6">
                  <AutomationBuilderUI
                    userId={activeUid}
                    isAuthenticated={isRealFirebaseUser}
                    cloudSyncState={cloudSyncState}
                    onOpenAuth={() => {
                      setAuthModalMode('signin');
                      setAuthModalOpen(true);
                    }}
                    automations={snapshot.automations}
                    lists={snapshot.lists}
                    contacts={snapshot.contacts}
                    assets={snapshot.assets}
                    preselectedListName={preselectedListName}
                    onClearPreselectedList={() => setPreselectedListName(null)}
                    openCreateModalOnMount={automationModalOpenOnMount}
                    onClearCreateModalMount={() => setAutomationModalOpenOnMount(false)}
                    onCreateAutomation={handleCreateAutomation}
                    onUpdateAutomation={handleUpdateAutomation}
                    onDeleteAutomation={handleDeleteAutomation}
                    onCreateList={handleCreateList}
                    onNavigateToLists={() => setActiveTab('lists')}
                    onBackToDashboard={() => setActiveTab('dashboard')}
                    emailDomainStatus={emailDomainStatus}
                    onNavigateToEmailSettings={() => navigateToEmailSettings()}
                  />
                </div>
              )}

              {activeTab === 'email_domain' && (
                <div className="py-2">
                  <CustomDomainEmailSettings
                    onBack={() => setActiveTab('dashboard')}
                    onNavigateToAutomations={() => setActiveTab('workflow_builder')}
                    isAuthenticated={Boolean(user)}
                    onOpenAuth={() => {
                      setAuthModalMode('signin');
                      setAuthModalOpen(true);
                    }}
                    initialStatus={emailDomainStatus}
                    onStatusChanged={setEmailDomainStatus}
                    defaultSenderName={snapshot.workspace.senderName || snapshot.workspace.name}
                  />
                </div>
              )}

              {activeTab === 'webhooks' && (
                <div className="py-2">
                  <WebhookGatewayView
                    automations={snapshot.automations}
                    onBack={() => setActiveTab('dashboard')}
                    onNavigateToAutomations={() => setActiveTab('workflow_builder')}
                  />
                </div>
              )}


              {activeTab === 'autoresponders' && (
                <AutoRespondersView
                  autoResponders={snapshot.autoResponders}
                  lists={snapshot.lists}
                  contacts={snapshot.contacts}
                  workspace={snapshot.workspace}
                  privateProfile={snapshot.privateProfile}
                  userId={activeUid}
                  liveWhatsappSession={liveWhatsappSession}
                  onRefreshWhatsappSession={refreshLiveWhatsappSession}
                  preselectedListName={preselectedListName}
                  onClearPreselectedList={() => setPreselectedListName(null)}
                  onNavigateToSettings={() => setActiveTab('settings')}
                  onNavigateToConnectWhatsApp={() => setActiveTab('connect_whatsapp')}
                  onCreateAutoResponder={handleCreateAutoResponder}
                  onUpdateAutoResponder={handleUpdateAutoResponder}
                  onDeleteAutoResponder={handleDeleteAutoResponder}
                  onCreateList={handleCreateList}
                  onLogActivity={handleLogActivity}
                  onNavigateToLists={() => setActiveTab('lists')}
                />
              )}

              {activeTab === 'campaigns' && (
                <CampaignsView
                  campaigns={snapshot.campaigns}
                  contacts={snapshot.contacts}
                  lists={snapshot.lists}
                  workspace={snapshot.workspace}
                  privateProfile={snapshot.privateProfile}
                  automations={snapshot.automations}
                  preselectedListName={preselectedListName}
                  onClearPreselectedList={() => setPreselectedListName(null)}
                  openModalOnMount={campaignModalOpenOnMount}
                  onClearModalMount={() => setCampaignModalOpenOnMount(false)}
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
                  onLogActivity={handleLogActivity}
                  onNavigateToLists={() => setActiveTab('lists')}
                />
              )}

              {activeTab === 'assets' && (
                <CaptureAssetsView
                  assets={snapshot.assets}
                  lists={snapshot.lists}
                  contacts={snapshot.contacts}
                  automations={snapshot.automations}
                  preselectedListName={preselectedListName}
                  onClearPreselectedList={() => setPreselectedListName(null)}
                  openModalMode={assetModalMode}
                  onClearModalMode={() => setAssetModalMode(null)}
                  onCreateAsset={handleCreateAsset}
                  onUpdateAsset={handleUpdateAsset}
                  onDeleteAsset={handleDeleteAsset}
                  onSubmitAssetLead={handleSubmitAssetLead}
                  onCreateList={handleCreateList}
                  onNavigateToLists={() => setActiveTab('lists')}
                  onCreateAutomationForList={(listName) => {
                    setPreselectedListName(listName);
                    setActiveTab('workflow_builder');
                  }}
                />
              )}

              {activeTab === 'funnels' && (
                <FunnelBuilderView
                  assets={snapshot.assets}
                  lists={snapshot.lists}
                  contacts={snapshot.contacts}
                  automations={snapshot.automations}
                  currency={snapshot.workspace.currency}
                  onCreateAsset={handleCreateAsset}
                  onCreateContact={handleCreateContact}
                  onUpdateContact={handleUpdateContact}
                  onCreateList={handleCreateList}
                  onLogActivity={handleLogActivity}
                  onNavigateToLists={() => setActiveTab('lists')}
                  onNavigateToAutomations={() => setActiveTab('workflow_builder')}
                />
              )}

              {activeTab === 'chatbots' && (
                <ChatbotsView
                  chatbots={snapshot.chatbots}
                  contacts={snapshot.contacts}
                  lists={snapshot.lists}
                  automations={snapshot.automations}
                  workspace={snapshot.workspace}
                  privateProfile={snapshot.privateProfile}
                  onCreateChatbot={handleCreateChatbot}
                  onUpdateChatbot={handleUpdateChatbot}
                  onDeleteChatbot={handleDeleteChatbot}
                  onRecordBotSession={handleRecordBotSession}
                  onUpdateContact={handleUpdateContact}
                  onCreateAutomation={handleCreateAutomation}
                  onCreateTask={handleCreateTask}
                  onUpdateWorkspace={handleUpdateWorkspace}
                  onUpdatePrivateProfile={handleUpdatePrivateProfile}
                  onLogActivity={handleLogActivity}
                  onNavigateToSettings={() => setActiveTab('settings')}
                  onNavigateToInbox={() => setActiveTab('inbox')}
                  onForwardToInbox={handleForwardToInboxFromChatbot}
                />
              )}

              {activeTab === 'settings' && (
                <WorkspaceSettingsView
                  workspace={snapshot.workspace}
                  privateProfile={snapshot.privateProfile}
                  members={snapshot.members}
                  isAuthenticated={!!user}
                  userEmailVerified={user?.emailVerified ?? false}
                  currentUserUid={user?.uid}
                  currentUserEmail={user?.email || undefined}
                  onUpdateWorkspace={handleUpdateWorkspace}
                  onUpdatePrivateProfile={handleUpdatePrivateProfile}
                  onAddMember={handleAddMember}
                  onDeleteMember={handleDeleteMember}
                  onSendPasswordReset={async () => {}}
                  onSendEmailVerification={async () => {}}
                  onSignOut={async () => {
                    await logout();
                    setIsPublicLanding(true);
                  }}
                  onOpenAuth={(mode) => {
                    setAuthModalMode(mode);
                    setAuthModalOpen(true);
                  }}
                  onReseedWorkspace={handleReseedWorkspace}
                  onRestoreWorkspaceSnapshot={handleRestoreWorkspaceSnapshot}
                  onNavigateToWhatsAppEmbeddedSignup={navigateToWhatsAppEmbeddedSignup}
                  onNavigateToEmailSettings={navigateToEmailSettings}
                  emailDomainStatus={emailDomainStatus}
                />
              )}

              {activeTab === 'connect_whatsapp' && (
                <ConnectWhatsAppPage
                  onBackToDashboard={() => setActiveTab('dashboard')}
                  onNavigateToPhonePairing={() => setActiveTab('whatsapp_connect')}
                  onOpenAuth={() => {
                    setAuthModalMode('signin');
                    setAuthModalOpen(true);
                  }}
                  onAccountConnected={(details) => {
                    const phoneFromJid = formatWhatsAppPhoneFromJid(details.ownerJid);
                    setLiveWhatsappSession({
                      status: details.status || 'open',
                      instanceName: details.instanceName,
                      ownerJid: details.ownerJid || null,
                      phoneNumber: phoneFromJid || undefined,
                      profileName: details.profileName || null,
                      checkedAt: new Date().toISOString(),
                    });
                    applyConnectedWhatsappIdentityToSnapshot(
                      phoneFromJid,
                      details.profileName
                    );

                    const nextWs = { ...snapshot.workspace, whatsappConnected: true };
                    const existingIdentities = snapshot.privateProfile
                      ? parseUserMessagingIdentities(snapshot.privateProfile)
                      : [];
                    const updatedIdentities = existingIdentities.map((id) =>
                      id.channel === 'whatsapp' ? { ...id, isDefault: false } : id
                    );
                    if (phoneFromJid) {
                      const waLabel = details.profileName
                        ? `${details.profileName} (WhatsApp)`
                        : 'Connected WhatsApp';
                      const idx = updatedIdentities.findIndex(
                        (i) =>
                          i.channel === 'whatsapp' &&
                          i.value.replace(/[^0-9]/g, '') ===
                            phoneFromJid.replace(/[^0-9]/g, '')
                      );
                      if (idx >= 0) {
                        updatedIdentities[idx] = {
                          ...updatedIdentities[idx],
                          label: waLabel,
                          senderName:
                            details.profileName || updatedIdentities[idx].senderName,
                          value: phoneFromJid,
                          isDefault: true,
                          verified: true,
                        };
                      } else {
                        updatedIdentities.unshift({
                          id: 'wa_connected_live',
                          channel: 'whatsapp',
                          label: waLabel,
                          senderName:
                            details.profileName ||
                            snapshot.workspace.senderName ||
                            snapshot.workspace.name ||
                            'WhatsApp Business',
                          value: phoneFromJid,
                          providerMode: 'evolution_qr',
                          isDefault: true,
                          verified: true,
                          createdAt: new Date().toISOString(),
                        });
                      }
                    }

                    const nextProf = snapshot.privateProfile
                      ? {
                          ...snapshot.privateProfile,
                          whatsappBusinessNumber:
                            phoneFromJid || snapshot.privateProfile.whatsappBusinessNumber,
                          whatsappPhoneId:
                            phoneFromJid || snapshot.privateProfile.whatsappPhoneId,
                          messagingIdentitiesJson:
                            JSON.stringify(updatedIdentities).slice(0, 10000),
                        }
                      : snapshot.privateProfile;

                    if (auth.currentUser) {
                      void syncCloudWrite(async () => {
                        await upsertWorkspaceRoot(auth.currentUser!.uid, nextWs);
                        if (nextProf) {
                          await upsertPrivateProfile(
                            auth.currentUser!.uid,
                            user?.email || nextProf.email || 'operator@flowpilot.app',
                            nextProf
                          );
                        }
                      });
                    }
                  }}
                  onAccountDisconnected={() => {
                    setLiveWhatsappSession((prev) =>
                      prev ? { ...prev, status: 'close' } : { status: 'close' }
                    );
                    const nextWs = { ...snapshot.workspace, whatsappConnected: false };
                    updateSnapshot((prev) => ({
                      ...prev,
                      workspace: { ...prev.workspace, whatsappConnected: false },
                    }));
                    if (auth.currentUser) {
                      void syncCloudWrite(() => upsertWorkspaceRoot(auth.currentUser!.uid, nextWs));
                    }
                  }}
                />
              )}

              {activeTab === 'whatsapp_connect' && (
                <WhatsAppConnectView
                  userId={activeUid}
                  userEmail={user?.email || undefined}
                  onBackToDashboard={() => setActiveTab('dashboard')}
                  onAccountConnected={(acc) => {
                    const nextWs = { ...snapshot.workspace, whatsappConnected: true };
                    const nextProf = snapshot.privateProfile
                      ? {
                          ...snapshot.privateProfile,
                          whatsappBusinessNumber:
                            acc.number || snapshot.privateProfile.whatsappBusinessNumber,
                        }
                      : snapshot.privateProfile;
                    updateSnapshot((prev) => ({
                      ...prev,
                      workspace: { ...prev.workspace, whatsappConnected: true },
                      privateProfile: prev.privateProfile
                        ? {
                            ...prev.privateProfile,
                            whatsappBusinessNumber:
                              acc.number || prev.privateProfile.whatsappBusinessNumber,
                          }
                        : prev.privateProfile,
                    }));
                    if (auth.currentUser) {
                      void syncCloudWrite(async () => {
                        await upsertWorkspaceRoot(auth.currentUser!.uid, nextWs);
                        if (nextProf) {
                          await upsertPrivateProfile(
                            auth.currentUser!.uid,
                            user?.email || nextProf.email || 'operator@flowpilot.app',
                            nextProf
                          );
                        }
                      });
                    }
                  }}
                />
              )}

            </ErrorBoundary>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* MODALS                                                             */}
      {/* ------------------------------------------------------------------ */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(_options) => {
          setAuthModalOpen(false);
          setIsPublicLanding(false);
        }}
      />

      <SystemDiagnosticsModal
        isOpen={diagnosticsModalOpen}
        onClose={() => setDiagnosticsModalOpen(false)}
        currentUser={user}
        workspace={snapshot.workspace}
        privateProfile={snapshot.privateProfile}
        lists={snapshot.lists}
        contacts={snapshot.contacts}
        automations={snapshot.automations}
        onBulkImportContacts={handleBulkImportContacts}
        onLogActivity={handleLogActivity}
      />

      <DesignSystemModal
        isOpen={designSystemModalOpen}
        onClose={() => setDesignSystemModalOpen(false)}
        themeMode={themeMode}
        onToggleThemeMode={(m) => {
          setThemeMode(m);
          applyThemeModeToDocument(m);
        }}
      />
    </div>
  );
}
