import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard,
  Inbox,
  Users,
  Layers,
  GitBranch,
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
  pushServerWorkspaceSnapshot,
  buildStarterWorkspaceSnapshot,
  normalizeWorkspaceSnapshot,
} from './services/accountPersistenceService';

import { FlowPilotLogo } from './components/FlowPilotLogo';
import { LandingPage } from './components/LandingPage';
import { DashboardOverview } from './components/DashboardOverview';
import { InboxView } from './components/InboxView';
import { ContactsCrmView } from './components/ContactsCrmView';
import { ListsView } from './components/ListsView';
import { AutomationsView } from './components/AutomationsView';
import { AutoRespondersView } from './components/AutoRespondersView';
import { CampaignsView } from './components/CampaignsView';
import { CaptureAssetsView, AssetLeadSubmissionExtra } from './components/CaptureAssetsView';
import { FunnelBuilderView } from './components/FunnelBuilderView';
import { ChatbotsView } from './components/ChatbotsView';
import { WorkspaceSettingsView } from './components/WorkspaceSettingsView';
import { WhatsAppEmbeddedSignupPage } from './components/WhatsAppEmbeddedSignupPage';
import { WhatsAppConnectView } from './components/WhatsAppConnectView';
import { WhatsAppTemplatesView } from './components/WhatsAppTemplatesView';
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
  const { user, userProfile, logout } = useAuth();

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

  // View state: Public Landing Page vs In-App Workspace
  const [isPublicLanding, setIsPublicLanding] = useState<boolean>(() => {
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

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const path = window.location.pathname.toLowerCase();
      setIsWhatsAppSettingsRoute(
        path === "/dashboard/settings/whatsapp" ||
        path === "/dashboard/settings/whatsapp/" ||
        path === "/settings/whatsapp" ||
        path === "/settings/whatsapp/"
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

  // When user signs in, smoothly transition to workspace
  useEffect(() => {
    if (user && isPublicLanding) {
      setIsPublicLanding(false);
    }
  }, [user, isPublicLanding]);

  // Active Workspace Navigation Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active User UID for multi-tenant isolation
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

  // Reload snapshot when activeUid changes
  useEffect(() => {
    const loaded = loadLocalWorkspaceSnapshot(activeUid, user?.email || undefined);
    if (loaded) {
      setSnapshot(loaded);
    }
  }, [activeUid, user?.email]);

  // Fetch published form from server when opened in Incognito or unauthenticated visitor session
  useEffect(() => {
    if (!isFormRoute || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const cap = params.get('capture') || params.get('form') || '';
    const pathPart = window.location.pathname.replace(/^\/(form|public\/form|p)\/?/i, '');
    const requestedIdentifier = (cap || pathPart).trim();

    // Check if we already have a local asset with custom headline/cta
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

  // Persist snapshot to localStorage and sync to server
  const updateSnapshot = useCallback(
    (updater: (prev: WorkspaceSnapshot) => WorkspaceSnapshot) => {
      setSnapshot((prev) => {
        const next = normalizeWorkspaceSnapshot(updater(prev));
        const activeEmail = user?.email || 'operator@flowpilot.app';
        saveLocalWorkspaceSnapshot(activeUid, activeEmail, next);
        pushServerWorkspaceSnapshot(activeUid, activeEmail, next).catch(() => {});
        return next;
      });
    },
    [activeUid, user?.email]
  );

  // Activity Logger
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
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        eventType,
        title: sanitizeString(title, 140, 'Activity logged'),
        detail: sanitizeString(detail, 500, ''),
        channel,
        createdAt: now,
        updatedAt: now,
      };
      updateSnapshot((prev) => ({
        ...prev,
        activities: [newActivity, ...prev.activities].slice(0, 100),
      }));
    },
    [activeUid, snapshot.workspace.id, updateSnapshot]
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
      await handleLogActivity(
        'lead_captured',
        `New contact added: ${newContact.fullName}`,
        `Email: ${newContact.email} | List: ${newContact.listName || 'General'}`,
        'crm'
      );
    },
    [activeUid, handleLogActivity, snapshot.workspace.id, updateSnapshot]
  );

  const handleUpdateContact = useCallback(
    async (
      id: string,
      data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      updateSnapshot((prev) => ({
        ...prev,
        contacts: prev.contacts.map((c) =>
          c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c
        ),
      }));
    },
    [updateSnapshot]
  );

  const handleDeleteContact = useCallback(
    async (id: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        contacts: prev.contacts.filter((c) => c.id !== id),
      }));
    },
    [updateSnapshot]
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
                newContactsList[existingIndex] = {
                  ...existing,
                  ...raw,
                  tags: mergedTags,
                  updatedAt: now,
                };
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
            if (emailKey) contactMap.set(emailKey, freshContact);
            createdCount++;
          }
        }

        return {
          ...prev,
          contacts: newContactsList,
        };
      });

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
    [activeUid, handleLogActivity, updateSnapshot]
  );

  const handleMergeContacts = useCallback(
    async (primaryId: string, duplicateId: string) => {
      updateSnapshot((prev) => {
        const primary = prev.contacts.find((c) => c.id === primaryId);
        const duplicate = prev.contacts.find((c) => c.id === duplicateId);
        if (!primary || !duplicate) return prev;

        const merged: Contact = {
          ...primary,
          phone: primary.phone || duplicate.phone,
          company: primary.company || duplicate.company,
          notes: `${primary.notes || ''}\n${duplicate.notes || ''}`.trim(),
          tags: Array.from(new Set([...(primary.tags || []), ...(duplicate.tags || [])])),
          ltv: (primary.ltv || 0) + (duplicate.ltv || 0),
          updatedAt: new Date().toISOString(),
        };

        return {
          ...prev,
          contacts: prev.contacts
            .filter((c) => c.id !== duplicateId)
            .map((c) => (c.id === primaryId ? merged : c)),
        };
      });
    },
    [updateSnapshot]
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
    },
    [activeUid, snapshot.workspace.id, updateSnapshot]
  );

  const handleUpdateList = useCallback(
    async (
      id: string,
      data: Omit<AudienceList, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      updateSnapshot((prev) => ({
        ...prev,
        lists: prev.lists.map((l) =>
          l.id === id ? { ...l, ...data, updatedAt: new Date().toISOString() } : l
        ),
      }));
    },
    [updateSnapshot]
  );

  const handleDeleteList = useCallback(
    async (id: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        lists: prev.lists.filter((l) => l.id !== id),
      }));
    },
    [updateSnapshot]
  );

  // --------------------------------------------------------------------------
  // AUTOMATIONS HANDLERS
  // --------------------------------------------------------------------------
  const handleCreateAutomation = useCallback(
    async (
      data: Omit<Automation, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ): Promise<Automation> => {
      const newAuto: Automation = {
        ...data,
        id: generateSafeId('aut'),
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updateSnapshot((prev) => ({
        ...prev,
        automations: [newAuto, ...prev.automations],
      }));
      await handleLogActivity(
        'automation_triggered',
        `Automation created: ${newAuto.name}`,
        `Trigger: ${newAuto.triggerType} | Status: ${newAuto.status}`,
        'system'
      );
      return newAuto;
    },
    [activeUid, handleLogActivity, snapshot.workspace.id, updateSnapshot]
  );

  const handleUpdateAutomation = useCallback(
    async (
      id: string,
      data: Omit<Automation, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      updateSnapshot((prev) => ({
        ...prev,
        automations: prev.automations.map((a) =>
          a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a
        ),
      }));
    },
    [updateSnapshot]
  );

  const handleDeleteAutomation = useCallback(
    async (id: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        automations: prev.automations.filter((a) => a.id !== id),
      }));
    },
    [updateSnapshot]
  );

  const handleSimulateAutomationRun = useCallback(
    async (auto: Automation) => {
      updateSnapshot((prev) => ({
        ...prev,
        automations: prev.automations.map((a) =>
          a.id === auto.id
            ? {
                ...a,
                enrolledCount: (a.enrolledCount || 0) + 1,
                completedCount: (a.completedCount || 0) + 1,
                updatedAt: new Date().toISOString(),
              }
            : a
        ),
      }));
      await handleLogActivity(
        'automation_triggered',
        `Live Run Executed: ${auto.name}`,
        `Step count: ${auto.stepsSummary?.length || 1} | Enrolled contacts: +1`,
        'system'
      );
    },
    [handleLogActivity, updateSnapshot]
  );

  // --------------------------------------------------------------------------
  // AUTO-RESPONDERS HANDLERS
  // --------------------------------------------------------------------------
  const handleCreateAutoResponder = useCallback(
    async (
      data: Omit<AutoResponder, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      const newResponder: AutoResponder = {
        ...data,
        id: generateSafeId('rsp'),
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updateSnapshot((prev) => ({
        ...prev,
        autoResponders: [newResponder, ...prev.autoResponders],
      }));
    },
    [activeUid, snapshot.workspace.id, updateSnapshot]
  );

  const handleUpdateAutoResponder = useCallback(
    async (
      id: string,
      data: Omit<AutoResponder, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      updateSnapshot((prev) => ({
        ...prev,
        autoResponders: prev.autoResponders.map((r) =>
          r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r
        ),
      }));
    },
    [updateSnapshot]
  );

  const handleDeleteAutoResponder = useCallback(
    async (id: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        autoResponders: prev.autoResponders.filter((r) => r.id !== id),
      }));
    },
    [updateSnapshot]
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
      return newId;
    },
    [activeUid, snapshot.workspace.id, updateSnapshot]
  );

  const handleUpdateThread = useCallback(
    async (
      id: string,
      data: Omit<InboxThread, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      updateSnapshot((prev) => ({
        ...prev,
        inboxThreads: prev.inboxThreads.map((t) =>
          t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t
        ),
      }));
    },
    [updateSnapshot]
  );

  const handleDeleteThread = useCallback(
    async (id: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        inboxThreads: prev.inboxThreads.filter((t) => t.id !== id),
      }));
    },
    [updateSnapshot]
  );

  const handleForwardToInboxFromAutomation = useCallback(
    async (payload: {
      leadName: string;
      leadEmail: string;
      leadPhone: string;
      listName: string;
      channel: ChannelType;
      workflowName: string;
      stepTitle: string;
      subjectOrTemplate?: string;
      messageSent: string;
    }) => {
      const threadId = generateSafeId('thr');
      const now = new Date().toISOString();
      const initialMessage = {
        id: generateSafeId('msg'),
        sender: 'system' as const,
        senderIdentity: 'FlowPilot Workflow Gateway',
        recipient: payload.leadEmail || payload.leadPhone || payload.leadName,
        channel: payload.channel,
        subject: payload.subjectOrTemplate || payload.workflowName || 'Automated Outreach',
        body: payload.messageSent,
        timestamp: now,
        status: 'delivered' as const,
      };

      const newThread: InboxThread = {
        id: threadId,
        workspaceId: snapshot.workspace.id,
        ownerId: activeUid,
        leadName: payload.leadName,
        leadEmail: payload.leadEmail,
        leadPhone: payload.leadPhone,
        listName: payload.listName,
        channel: payload.channel,
        subjectOrContext: payload.subjectOrTemplate || `Outreach: ${payload.workflowName}`,
        lastLeadMessage: '',
        lastMessagePreview: payload.messageSent.slice(0, 100),
        lastSender: 'operator',
        status: 'replied',
        unreadCount: 0,
        messagesJson: JSON.stringify([initialMessage]),
        createdAt: now,
        updatedAt: now,
      };

      updateSnapshot((prev) => ({
        ...prev,
        inboxThreads: [newThread, ...prev.inboxThreads],
      }));
    },
    [activeUid, snapshot.workspace.id, updateSnapshot]
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
        lastLeadMessage: payload.customerMessage || '',
        lastMessagePreview: payload.outboundReply.slice(0, 100),
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
    },
    [activeUid, snapshot.workspace.id, updateSnapshot]
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
      await handleLogActivity(
        'campaign_sent',
        `Campaign created: ${newCampaign.name}`,
        `Target: ${newCampaign.targetList} | Channel: ${newCampaign.channel}`,
        newCampaign.channel === 'whatsapp' ? 'whatsapp' : newCampaign.channel === 'sms' ? 'sms' : 'email'
      );
    },
    [activeUid, handleLogActivity, snapshot.workspace.id, updateSnapshot]
  );

  const handleUpdateCampaign = useCallback(
    async (
      id: string,
      data: Partial<Omit<Campaign, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>>
    ) => {
      updateSnapshot((prev) => ({
        ...prev,
        campaigns: prev.campaigns.map((c) =>
          c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c
        ),
      }));
    },
    [updateSnapshot]
  );

  const handleDispatchCampaign = useCallback(
    async (campaign: Campaign) => {
      updateSnapshot((prev) => ({
        ...prev,
        campaigns: prev.campaigns.map((c) =>
          c.id === campaign.id
            ? {
                ...c,
                status: 'sent',
                sentCount: c.recipientCount || 1,
                deliveredCount: c.recipientCount || 1,
                openedCount: Math.round((c.recipientCount || 1) * 0.45),
                clickedCount: Math.round((c.recipientCount || 1) * 0.18),
                updatedAt: new Date().toISOString(),
              }
            : c
        ),
      }));
      await handleLogActivity(
        'campaign_sent',
        `Broadcast Dispatched: ${campaign.name}`,
        `Channel: ${campaign.channel} | Recipients: ${campaign.recipientCount || 1}`,
        campaign.channel === 'whatsapp' ? 'whatsapp' : campaign.channel === 'sms' ? 'sms' : 'email'
      );
    },
    [handleLogActivity, updateSnapshot]
  );

  const handleDeleteCampaign = useCallback(
    async (id: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        campaigns: prev.campaigns.filter((c) => c.id !== id),
      }));
    },
    [updateSnapshot]
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
      await handleLogActivity(
        'asset_published',
        `Asset Published: ${newAsset.title}`,
        `Format: ${newAsset.assetType} | Target List: ${newAsset.targetList}`,
        'web'
      );
    },
    [activeUid, handleLogActivity, snapshot.workspace.id, updateSnapshot]
  );

  const handleUpdateAsset = useCallback(
    async (
      id: string,
      data: Omit<CaptureAsset, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      updateSnapshot((prev) => ({
        ...prev,
        assets: prev.assets.map((a) =>
          a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a
        ),
      }));
    },
    [updateSnapshot]
  );

  const handleDeleteAsset = useCallback(
    async (id: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        assets: prev.assets.filter((a) => a.id !== id),
      }));
    },
    [updateSnapshot]
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

      updateSnapshot((prev) => ({
        ...prev,
        contacts: [newContact, ...prev.contacts],
        assets: prev.assets.map((a) =>
          a.id === asset.id
            ? {
                ...a,
                submissionsCount: (a.submissionsCount || 0) + 1,
                viewsCount: (a.viewsCount || 0) + 1,
                updatedAt: now,
              }
            : a
        ),
      }));

      await handleLogActivity(
        'form_captured',
        `Lead captured via ${asset.title}: ${lead.fullName}`,
        `Email: ${lead.email} | Target list: ${asset.targetList || 'General'}`,
        'web'
      );

      // Persist lead to server public capture endpoint so incognito submissions trigger server automations
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
    [activeUid, handleLogActivity, snapshot.workspace.id, updateSnapshot]
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
    },
    [activeUid, snapshot.workspace.id, updateSnapshot]
  );

  const handleUpdateChatbot = useCallback(
    async (
      id: string,
      data: Omit<ChatbotFlow, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      updateSnapshot((prev) => ({
        ...prev,
        chatbots: prev.chatbots.map((b) =>
          b.id === id ? { ...b, ...data, updatedAt: new Date().toISOString() } : b
        ),
      }));
    },
    [updateSnapshot]
  );

  const handleDeleteChatbot = useCallback(
    async (id: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        chatbots: prev.chatbots.filter((b) => b.id !== id),
      }));
    },
    [updateSnapshot]
  );

  const handleRecordBotSession = useCallback(
    async (bot: ChatbotFlow) => {
      updateSnapshot((prev) => ({
        ...prev,
        chatbots: prev.chatbots.map((b) =>
          b.id === bot.id
            ? {
                ...b,
                sessionsCount: (b.sessionsCount || 0) + 1,
                resolvedCount: (b.resolvedCount || 0) + 1,
                updatedAt: new Date().toISOString(),
              }
            : b
        ),
      }));
      await handleLogActivity(
        'whatsapp_replied',
        `Bot session completed: ${bot.name}`,
        `Keyword: ${bot.triggerKeyword} | Match: ${bot.matchType}`,
        'whatsapp'
      );
    },
    [handleLogActivity, updateSnapshot]
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
    },
    [activeUid, snapshot.workspace.id, updateSnapshot]
  );

  const handleCompleteTask = useCallback(
    async (task: TaskItem) => {
      updateSnapshot((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: t.status === 'completed' ? 'pending' : 'completed',
                updatedAt: new Date().toISOString(),
              }
            : t
        ),
      }));
    },
    [updateSnapshot]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== taskId),
      }));
    },
    [updateSnapshot]
  );

  // --------------------------------------------------------------------------
  // WORKSPACE SETTINGS & PROFILE HANDLERS
  // --------------------------------------------------------------------------
  const handleUpdateWorkspace = useCallback(
    async (data: Omit<Workspace, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => {
      updateSnapshot((prev) => ({
        ...prev,
        workspace: {
          ...prev.workspace,
          ...data,
          updatedAt: new Date().toISOString(),
        },
      }));
    },
    [updateSnapshot]
  );

  const handleUpdatePrivateProfile = useCallback(
    async (
      data: Omit<UserPrivateProfile, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
    ) => {
      updateSnapshot((prev) => ({
        ...prev,
        privateProfile: {
          ...prev.privateProfile,
          ...data,
          updatedAt: new Date().toISOString(),
        },
      }));
    },
    [updateSnapshot]
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
    },
    [activeUid, snapshot.workspace.id, updateSnapshot]
  );

  const handleDeleteMember = useCallback(
    async (memberId: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        members: prev.members.filter((m) => m.id !== memberId),
      }));
    },
    [updateSnapshot]
  );

  const handleReseedWorkspace = useCallback(async () => {
    const starter = buildStarterWorkspaceSnapshot(
      activeUid,
      user?.email || 'user@example.com',
      userProfile?.displayName || 'Workspace Operator',
      snapshot.workspace.name || 'My Sovereign Workspace'
    );
    updateSnapshot(() => starter);
  }, [activeUid, snapshot.workspace.name, updateSnapshot, user?.email, userProfile?.displayName]);

  const handleRestoreWorkspaceSnapshot = useCallback(
    (snap: WorkspaceSnapshot) => {
      updateSnapshot(() => snap);
    },
    [updateSnapshot]
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

      await handleLogActivity(
        'lead_captured',
        `Public portal lead captured: ${lead.fullName}`,
        `Email: ${lead.email} | Phone: ${lead.phone || 'N/A'} | Segment: ${lead.segment}`,
        'web'
      );
    },
    [activeUid, handleLogActivity, snapshot.workspace.id, updateSnapshot]
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
          setActiveTab('automations');
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
    { id: 'inbox', label: 'Omnichannel Inbox', icon: Inbox, badge: unreadCount > 0 ? unreadCount : undefined },
    { id: 'contacts', label: 'CRM & Audiences', icon: Users },
    { id: 'lists', label: 'Segments & Lists', icon: Layers },
    { id: 'automations', label: 'Workflows & Logic', icon: GitBranch },
    { id: 'autoresponders', label: 'Auto-Responders', icon: Zap },
    { id: 'campaigns', label: 'Campaigns & SMS', icon: Send },
    { id: 'assets', label: 'Lead Gen & Forms', icon: FileText },
    { id: 'funnels', label: 'Conversion Funnels', icon: Sliders },
    { id: 'chatbots', label: 'WhatsApp & Bots', icon: Bot },
    { id: 'settings', label: 'Workspace & Gateway', icon: Settings },
  ];

  if (isWhatsAppSettingsRoute) {
    return (
      <ErrorBoundary fallbackTitle="WhatsApp Embedded Signup" onReset={() => (window.location.href = "/")}>
        <WhatsAppEmbeddedSignupPage
          userId={activeUid}
          userEmail={user?.email || "jonajukej777@gmail.com"}
          onBackToDashboard={navigateBackFromWhatsAppEmbeddedSignup}
          onAccountConnected={(acc) => {
            updateSnapshot((prev) => ({
              ...prev,
              workspace: {
                ...prev.workspace,
                whatsappConnected: true,
              },
              privateProfile: prev.privateProfile ? {
                ...prev.privateProfile,
                whatsappConnected: true,
                whatsappBusinessNumber: acc.display_phone_number || prev.privateProfile.whatsappBusinessNumber,
              } : prev.privateProfile,
            }));
          }}
        />
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
            setActiveTab('automations');
          }}
        />
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] text-[#0F172A] dark:text-[#F1F5F9] font-sans antialiased flex flex-col selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* ------------------------------------------------------------------ */}
      {/* GLOBAL HEADER / NAVIGATION BAR                                     */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0D1322]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo & Portal Switcher */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (isPublicLanding) {
                  setIsPublicLanding(false);
                  setActiveTab('dashboard');
                } else {
                  setActiveTab('dashboard');
                }
              }}
              className="flex items-center gap-2.5 focus:outline-hidden group"
              title="Return to FlowPilot Dashboard"
            >
              <FlowPilotLogo variant={themeMode === 'dark' ? 'dark' : 'light'} size="sm" />
            </button>

            {/* Public vs Workspace Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setIsPublicLanding((prev) => !prev)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  isPublicLanding
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {isPublicLanding ? (
                  <>
                    <ExternalLink className="w-3.5 h-3.5" />
                    Public Portal Mode
                  </>
                ) : (
                  <>
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    {snapshot.workspace.name || 'Workspace'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Utility Tools (Right side) */}
          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <button
              onClick={() => setIsPublicLanding((prev) => !prev)}
              className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors hidden md:inline-flex items-center gap-1.5"
            >
              {isPublicLanding ? (
                <>
                  <LayoutDashboard className="w-3.5 h-3.5 text-blue-500" />
                  Enter Workspace
                </>
              ) : (
                <>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  View Public Landing
                </>
              )}
            </button>

            {/* System Diagnostics Trigger */}
            <button
              onClick={() => setDiagnosticsModalOpen(true)}
              className="p-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
              title="Open System Diagnostics & Delivery Gateway Monitor"
            >
              <Activity className="w-4 h-4" />
            </button>

            {/* Design System Reference Trigger */}
            <button
              onClick={() => setDesignSystemModalOpen(true)}
              className="p-2 text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg transition-colors border border-transparent hover:border-purple-200 dark:hover:border-purple-800"
              title="Design System & Theme Export"
            >
              <Palette className="w-4 h-4" />
            </button>

            {/* Light / Dark Theme Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-colors border border-transparent hover:border-amber-200 dark:hover:border-amber-800"
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
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-blue-500/20">
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
                  className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
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
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setAuthModalMode('signup');
                    setAuthModalOpen(true);
                  }}
                  className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg shadow-xs shadow-blue-500/20 transition-all flex items-center gap-1.5"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  Create Account
                </button>
              </div>
            )}

            {/* Mobile Navigation Menu Toggle */}
            {!isPublicLanding && (
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="xl:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg ml-1"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* SECONDARY NAVIGATION BAR (WORKSPACE TABS)                          */}
        {/* ------------------------------------------------------------------ */}
        {!isPublicLanding && (
          <div className="hidden xl:block border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/70 dark:bg-[#0B101D]/70 overflow-x-auto scrollbar-none">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center space-x-1 py-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap relative ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/30'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full leading-tight ${
                          isActive
                            ? 'bg-white text-blue-600'
                            : 'bg-rose-500 text-white animate-pulse'
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
        )}

        {/* Mobile Flyout Navigation Menu */}
        {!isPublicLanding && mobileMenuOpen && (
          <div className="xl:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] px-4 py-3 space-y-1 shadow-lg animate-in slide-in-from-top-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
              Workspace Navigation
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </header>

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
                    setActiveTab('automations');
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

              {activeTab === 'automations' && (
                <AutomationsView
                  automations={snapshot.automations}
                  contacts={snapshot.contacts}
                  lists={snapshot.lists}
                  workspace={snapshot.workspace}
                  privateProfile={snapshot.privateProfile}
                  onNavigateToSettings={() => setActiveTab('settings')}
                  preselectedListName={preselectedListName}
                  onClearPreselectedList={() => setPreselectedListName(null)}
                  openModalOnMount={automationModalOpenOnMount}
                  onClearModalMount={() => setAutomationModalOpenOnMount(false)}
                  onCreateAutomation={handleCreateAutomation}
                  onUpdateAutomation={handleUpdateAutomation}
                  onDeleteAutomation={handleDeleteAutomation}
                  onSimulateRun={handleSimulateAutomationRun}
                  onUpdateContact={handleUpdateContact}
                  onCreateTask={handleCreateTask}
                  onLogActivity={handleLogActivity}
                  onCreateList={handleCreateList}
                  onNavigateToLists={() => setActiveTab('lists')}
                  onCreateFormForList={(listName) => {
                    setPreselectedListName(listName);
                    setActiveTab('assets');
                  }}
                  onNavigateToInbox={() => setActiveTab('inbox')}
                  onForwardToInbox={handleForwardToInboxFromAutomation}
                />
              )}

              {activeTab === 'autoresponders' && (
                <AutoRespondersView
                  autoResponders={snapshot.autoResponders}
                  lists={snapshot.lists}
                  contacts={snapshot.contacts}
                  workspace={snapshot.workspace}
                  privateProfile={snapshot.privateProfile}
                  preselectedListName={preselectedListName}
                  onClearPreselectedList={() => setPreselectedListName(null)}
                  onNavigateToSettings={() => setActiveTab('settings')}
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
                    setActiveTab('automations');
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
                  onNavigateToAutomations={() => setActiveTab('automations')}
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
