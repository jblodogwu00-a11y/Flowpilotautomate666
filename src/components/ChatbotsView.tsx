import React, { useState, useMemo } from 'react';
import {
  Plus,
  Send,
  Trash2,
  X,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserCheck,
  Bot,
  Sparkles,
  FileText,
  Settings,
  RefreshCw,
  Phone,
  GitBranch,
  Search,
  Lock,
  Activity,
  ArrowRight,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import {
  ChatbotFlow,
  ChatbotMatchType,
  Contact,
  ContactList,
  Automation,
  AutomationFlow,
  Workspace,
  UserPrivateProfile,
  TaskItem,
  ActivityEventType,
  LeadStage,
  sanitizeString,
  sanitizeStringArray,
  resolveWorkspaceSenderIdentities,
} from '../types';
import {
  deliverChannelMessage,
  MessageDeliveryReceipt,
} from '../services/messageDeliveryService';
import {
  OFFICIAL_WHATSAPP_PROVIDERS,
  OfficialWhatsAppProviderId,
  INITIAL_WHATSAPP_TEMPLATES,
  WhatsAppTemplate,
  WhatsAppTemplateCategory,
  WhatsAppConversationThread,
  WhatsAppMessageItem,
  WhatsAppMessageStatus,
  WhatsAppBusinessHoursConfig,
  WhatsAppRateControlQueueItem,
  META_GRAPH_API_ERRORS,
  MetaMessagingTier,
  MetaQualityRating,
  buildInitialWhatsAppThreads,
  renderWhatsAppTemplateBody,
  classifyInboundWhatsAppIntent,
  generateWhatsAppAiAssistantReply,
} from './WhatsAppCatalog';
import { WhatsAppConnectView } from './WhatsAppConnectView';

interface ChatbotsViewProps {
  chatbots: ChatbotFlow[];
  contacts?: Contact[];
  lists?: ContactList[];
  automations?: AutomationFlow[];
  workspace?: Workspace;
  privateProfile?: UserPrivateProfile;
  onCreateChatbot: (
    data: Omit<ChatbotFlow, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateChatbot?: (
    id: string,
    data: Omit<ChatbotFlow, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onDeleteChatbot: (id: string) => Promise<void>;
  onRecordBotSession: (bot: ChatbotFlow) => Promise<void>;
  onUpdateContact?: (
    contactId: string,
    data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onCreateAutomation?: (
    data: Omit<AutomationFlow, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<Automation | AutomationFlow | void>;
  onCreateTask?: (
    data: Omit<TaskItem, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateWorkspace?: (
    data: Omit<Workspace, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdatePrivateProfile?: (
    data: Omit<UserPrivateProfile, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onLogActivity?: (
    eventType: ActivityEventType,
    title: string,
    detail: string,
    channel: 'email' | 'sms' | 'whatsapp' | 'crm' | 'system'
  ) => Promise<void>;
  onNavigateToSettings?: () => void;
  onNavigateToInbox?: () => void;
  onForwardToInbox?: (payload: {
    leadName: string;
    leadPhone: string;
    leadEmail?: string;
    listName: string;
    customerMessage?: string;
    outboundReply: string;
    contextLabel: string;
  }) => Promise<void>;
}

type WhatsAppHubTab =
  | 'inbox'
  | 'templates'
  | 'automation'
  | 'hours_consent'
  | 'rate_compliance'
  | 'provider_config';

export const ChatbotsView: React.FC<ChatbotsViewProps> = ({
  chatbots,
  contacts = [],
  lists = [],
  automations = [],
  workspace,
  privateProfile,
  onCreateChatbot,
  onDeleteChatbot,
  onRecordBotSession,
  onUpdateContact,
  onCreateAutomation,
  onCreateTask,
  onUpdateWorkspace,
  onUpdatePrivateProfile,
  onLogActivity,
  onNavigateToSettings,
  onNavigateToInbox,
  onForwardToInbox,
}) => {
  const effectiveWorkspace: Workspace = workspace || {
    id: 'ws_default',
    ownerId: 'usr_default',
    name: 'FlowPilot Studio',
    category: 'creator',
    currency: 'USD',
    timezone: 'America/New_York',
    senderName: 'FlowPilot Team',
    whatsappConnected: true,
    smsConnected: true,
    emailConnected: true,
    notifyNewLeads: true,
    notifyCampaigns: true,
    whatsappPhoneId: '104928193847291',
    smsSenderId: '+18445550199',
  };

  const senderIdentities = useMemo(
    () => resolveWorkspaceSenderIdentities(effectiveWorkspace, privateProfile),
    [effectiveWorkspace, privateProfile]
  );
  const [selectedWaIdentityId, setSelectedWaIdentityId] = useState<string>('default');
  const [lastBotReceipt, setLastBotReceipt] = useState<MessageDeliveryReceipt | null>(null);

  const chosenWaIdentity = useMemo(
    () =>
      senderIdentities.whatsappIdentities.find((i) => i.id === selectedWaIdentityId) ||
      senderIdentities.whatsappIdentities.find((i) => i.isDefault) ||
      null,
    [senderIdentities.whatsappIdentities, selectedWaIdentityId]
  );

  const activeWaFromNumber =
    chosenWaIdentity?.value || senderIdentities.whatsappBusinessNumber;
  const activeWaSenderName =
    chosenWaIdentity?.senderName || effectiveWorkspace.senderName || effectiveWorkspace.name;

  const [activeSubTab, setActiveSubTab] = useState<WhatsAppHubTab>('inbox');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // WhatsApp QR Socket Provider Configuration State
  const [selectedProviderId, setSelectedProviderId] =
    useState<OfficialWhatsAppProviderId>('whatsapp_qr_connect');
  const [wabaId, setWabaId] = useState('baileys_socket_relay');
  const [businessPhoneDisplay, setBusinessPhoneDisplay] = useState(
    effectiveWorkspace.whatsappPhoneId || '+1 (844) 555-0199'
  );
  const [messagingTier, setMessagingTier] = useState<MetaMessagingTier>('tier_unlimited');
  const [qualityRating, setQualityRating] = useState<MetaQualityRating>('GREEN');
  const [enforceStrictRateCap, setEnforceStrictRateCap] = useState(true);
  const [configuredMpsCap, setConfiguredMpsCap] = useState(60);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Templates State
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(INITIAL_WHATSAPP_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    INITIAL_WHATSAPP_TEMPLATES[0].id
  );
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<'ALL' | WhatsAppTemplateCategory>('ALL');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  const [newTplCategory, setNewTplCategory] = useState<WhatsAppTemplateCategory>('UTILITY');
  const [newTplHeader, setNewTplHeader] = useState('');
  const [newTplBody, setNewTplBody] = useState(
    'Hi {{1}}, thank you for connecting with {{2}}. Here is your requested update: {{3}}.'
  );
  const [newTplFooter, setNewTplFooter] = useState('Reply STOP at any time to opt out.');
  const [newTplButtons, setNewTplButtons] = useState('Confirm\nTalk to Human');
  const [customParam3Preview, setCustomParam3Preview] = useState('https://flowpilot.app/portal');

  // Business Hours & AI Assistant Settings
  const [businessHours, setBusinessHours] = useState<WhatsAppBusinessHoursConfig>({
    enabled: true,
    timezone: effectiveWorkspace.timezone || 'America/New_York',
    scheduleDays: 'mon_fri',
    startTime: '09:00',
    endTime: '18:00',
    afterHoursBehavior: 'ai_assistant_concierge',
    awayMessageText:
      'Thanks for messaging us! Our live team operates Mon–Fri 09:00–18:00. Our AI Concierge can help immediately, or reply HUMAN to queue for morning priority.',
  });
  const [isCurrentlyAfterHoursSim, setIsCurrentlyAfterHoursSim] = useState(false);
  const [globalAiAssistantEnabled, setGlobalAiAssistantEnabled] = useState(true);
  const [aiSystemPrompt, setAiSystemPrompt] = useState(
    'Be warm, transparent, and concise. Answer questions about onboarding, consultations, and resources using the contact CRM stage and list context. Always honor STOP or HUMAN requests immediately.'
  );
  const [isGeneratingAiReply, setIsGeneratingAiReply] = useState(false);

  // Conversations State
  const [threads, setThreads] = useState<WhatsAppConversationThread[]>(() =>
    buildInitialWhatsAppThreads(contacts, effectiveWorkspace.name)
  );
  const [selectedThreadId, setSelectedThreadId] = useState<string>('wa_thread_1');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'human_handoff' | 'ai_active' | 'window_expired'>('all');
  const [threadSearch, setThreadSearch] = useState('');
  const [operatorDraft, setOperatorDraft] = useState('');
  const [isInternalNoteMode, setIsInternalNoteMode] = useState(false);
  const [inboundSimText, setInboundSimText] = useState('');

  // Compliant Rate-Limit & Dispatch Queue State
  const [dispatchQueue, setDispatchQueue] = useState<WhatsAppRateControlQueueItem[]>([
    {
      id: 'q_101',
      recipientName: contacts[0]?.fullName || 'Elena Rostova',
      recipientPhone: contacts[0]?.phone || '+1 (415) 890-4321',
      messageType: 'template',
      templateOrTriggerName: 'welcome_lead_magnet_delivery_v1',
      consentVerified: true,
      windowOrTemplateValid: true,
      status: 'dispatched',
      timestamp: '2 hours ago',
    },
    {
      id: 'q_102',
      recipientName: contacts[1]?.fullName || 'Marcus Vance',
      recipientPhone: contacts[1]?.phone || '+1 (312) 604-8819',
      messageType: 'session_reply',
      templateOrTriggerName: 'Human Handoff Confirmation',
      consentVerified: true,
      windowOrTemplateValid: true,
      status: 'dispatched',
      timestamp: '35 mins ago',
    },
    {
      id: 'q_103',
      recipientName: 'Unverified Cold Import',
      recipientPhone: '+1 (212) 555-0143',
      messageType: 'template',
      templateOrTriggerName: 'vip_cohort_enrollment_open_v2',
      consentVerified: false,
      windowOrTemplateValid: true,
      status: 'blocked_consent',
      metaErrorCode: '#131026 (Pre-Flight Opt-In Gate Blocked)',
      timestamp: '18 mins ago',
    },
  ]);

  // Create Keyword Bot Modal State
  const [isBotModalOpen, setIsBotModalOpen] = useState(false);
  const [botName, setBotName] = useState('');
  const [botKeyword, setBotKeyword] = useState('');
  const [botMatchType, setBotMatchType] = useState<ChatbotMatchType>('contains');
  const [botWelcome, setBotWelcome] = useState('');
  const [botMenuText, setBotMenuText] = useState('');
  const [botHandoff, setBotHandoff] = useState(true);
  const [isSavingBot, setIsSavingBot] = useState(false);

  const selectedProvider = useMemo(
    () =>
      OFFICIAL_WHATSAPP_PROVIDERS.find((p) => p.id === selectedProviderId) ||
      OFFICIAL_WHATSAPP_PROVIDERS[0],
    [selectedProviderId]
  );

  const activeThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) || threads[0] || null,
    [threads, selectedThreadId]
  );

  const activeCrmContact = useMemo(() => {
    if (!activeThread) return null;
    return (
      contacts.find(
        (c) =>
          c.id === activeThread.contactId ||
          (activeThread.contactEmail && c.email.toLowerCase() === activeThread.contactEmail.toLowerCase()) ||
          c.fullName.toLowerCase() === activeThread.contactName.toLowerCase()
      ) || null
    );
  }, [contacts, activeThread]);

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (inboxFilter === 'human_handoff' && t.routingMode !== 'human_handoff_requested' && t.routingMode !== 'assigned_to_human') {
        return false;
      }
      if (inboxFilter === 'ai_active' && !t.aiAssistantEnabled) {
        return false;
      }
      if (inboxFilter === 'window_expired' && t.windowOpen) {
        return false;
      }
      if (threadSearch.trim()) {
        const q = threadSearch.toLowerCase();
        return (
          t.contactName.toLowerCase().includes(q) ||
          t.contactPhone.toLowerCase().includes(q) ||
          Boolean(t.lastIntent && t.lastIntent.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [threads, inboxFilter, threadSearch]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || templates[0],
    [templates, selectedTemplateId]
  );

  const whatsappAutomations = useMemo(
    () =>
      automations.filter(
        (a) =>
          (a.channels || []).includes('whatsapp') ||
          a.channel === 'whatsapp' ||
          (a.channel as any) === 'multi'
      ),
    [automations]
  );

  // Check if contact is opted in
  const isActiveContactOptedIn = activeCrmContact
    ? activeCrmContact.consentStatus === 'opted_in'
    : true;

  // Send Operator or Template Message in Active Thread
  const handleSendThreadMessage = async (opts: {
    text: string;
    sender: 'human_operator' | 'ai_assistant' | 'system_workflow';
    senderLabel: string;
    isTemplate?: boolean;
    templateName?: string;
    isInternalNote?: boolean;
  }) => {
    if (!activeThread) return;
    const cleanText = opts.text.trim();
    if (!cleanText) return;

    // Internal notes bypass Meta API dispatch and save directly to thread history
    if (opts.isInternalNote) {
      const noteMsg: WhatsAppMessageItem = {
        id: `wmsg_${Date.now()}`,
        wamid: `note.internal.${Date.now()}`,
        sender: 'human_operator',
        senderLabel: 'Internal CRM Note (Hidden from WhatsApp)',
        text: cleanText,
        timestamp: 'Just now',
        status: 'read',
        isInternalNote: true,
      };
      setThreads((prev) =>
        prev.map((t) =>
          t.id === activeThread.id ? { ...t, messages: [...t.messages, noteMsg] } : t
        )
      );
      setOperatorDraft('');
      setStatusBanner('Added internal team note to conversation history.');
      return;
    }

    // Compliance Gate 1: Verify Opt-In Consent
    if (!isActiveContactOptedIn) {
      const blockedItem: WhatsAppRateControlQueueItem = {
        id: `q_${Date.now()}`,
        recipientName: activeThread.contactName,
        recipientPhone: activeThread.contactPhone,
        messageType: opts.isTemplate ? 'template' : 'session_reply',
        templateOrTriggerName: opts.templateName || 'Free-form Operator Reply',
        consentVerified: false,
        windowOrTemplateValid: activeThread.windowOpen || Boolean(opts.isTemplate),
        status: 'blocked_consent',
        metaErrorCode: '#131026 (Contact Unsubscribed / Opted Out)',
        timestamp: 'Just now',
      };
      setDispatchQueue((prev) => [blockedItem, ...prev]);
      setStatusBanner(
        `Blocked by Compliance Gate: ${activeThread.contactName} is currently unsubscribed from WhatsApp.`
      );
      return;
    }

    // Compliance Gate 2: Enforce Meta 24-Hour Customer Service Window for non-template messages
    if (!activeThread.windowOpen && !opts.isTemplate) {
      const blockedWindowItem: WhatsAppRateControlQueueItem = {
        id: `q_${Date.now()}`,
        recipientName: activeThread.contactName,
        recipientPhone: activeThread.contactPhone,
        messageType: 'session_reply',
        templateOrTriggerName: 'Free-form Session Reply',
        consentVerified: true,
        windowOrTemplateValid: false,
        status: 'blocked_24h_window',
        metaErrorCode: '#131047 (24h Service Window Expired — Template Required)',
        timestamp: 'Just now',
      };
      setDispatchQueue((prev) => [blockedWindowItem, ...prev]);
      setStatusBanner(
        'Meta Policy #131047 Guardrail: 24-hour customer service window has expired. Send an Approved Template Message below to re-open the session.'
      );
      return;
    }

    const receipt = await deliverChannelMessage({
      channel: 'whatsapp',
      to: activeThread.contactPhone,
      leadName: activeThread.contactName,
      subject: opts.isTemplate
        ? `WhatsApp Template: ${opts.templateName}`
        : `WhatsApp Reply to ${activeThread.contactName}`,
      body: cleanText,
      listName: activeCrmContact?.listName || 'WhatsApp Bot Conversations',
      source: 'whatsapp_bot',
      overrideFromIdentity: activeWaFromNumber,
      overrideSenderName: activeWaSenderName,
      workspace: effectiveWorkspace,
      privateProfile,
    });
    setLastBotReceipt(receipt);

    const wamid = receipt.receiptId || `wamid.HBgM${Date.now().toString(36).toUpperCase()}`;
    const newMsg: WhatsAppMessageItem = {
      id: `wmsg_${Date.now()}`,
      wamid,
      sender: opts.sender,
      senderLabel: `${opts.senderLabel} · From: ${receipt.fromIdentity}`,
      text: cleanText,
      timestamp: 'Just now',
      status: 'delivered',
      isTemplate: opts.isTemplate,
      templateName: opts.templateName,
    };

    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? {
              ...t,
              unreadCount: 0,
              messages: [...t.messages, newMsg],
            }
          : t
      )
    );

    const queueItem: WhatsAppRateControlQueueItem = {
      id: `q_${Date.now()}`,
      recipientName: activeThread.contactName,
      recipientPhone: activeThread.contactPhone,
      messageType: opts.isTemplate ? 'template' : 'session_reply',
      templateOrTriggerName: opts.templateName || opts.senderLabel,
      consentVerified: true,
      windowOrTemplateValid: true,
      status: 'dispatched',
      timestamp: 'Just now',
    };
    setDispatchQueue((prev) => [queueItem, ...prev]);
    setOperatorDraft('');

    if (onForwardToInbox) {
      await onForwardToInbox({
        leadName: activeThread.contactName,
        leadPhone: activeThread.contactPhone,
        leadEmail: activeThread.contactEmail,
        listName: activeCrmContact?.listName || 'WhatsApp Bot Conversations',
        outboundReply: cleanText,
        contextLabel: opts.isTemplate
          ? `WhatsApp Template: ${opts.templateName}`
          : `WhatsApp Operator Reply`,
      });
    }

    if (onLogActivity) {
      await onLogActivity(
        'whatsapp_replied',
        `WhatsApp ${opts.isTemplate ? `Template (${opts.templateName})` : 'Message'} → ${activeThread.contactName}`,
        `Delivered via ${receipt.providerUsed} · From: ${receipt.fromIdentity} (${wamid})`,
        'whatsapp'
      );
    }
    setStatusBanner(
      `Delivered live via ${receipt.providerUsed} · From: ${receipt.fromIdentity} → To: ${receipt.toRecipient} (${wamid})`
    );
  };

  // Simulate Inbound Customer Message (Tests Keyword Bot, Intent Classifier, AI Assistant, STOP/START, Human Handoff, After-Hours)
  const handleSimulateCustomerInbound = async (rawText: string) => {
    if (!activeThread) return;
    const text = rawText.trim();
    if (!text) return;

    const intentResult = classifyInboundWhatsAppIntent(text);
    const customerMsg: WhatsAppMessageItem = {
      id: `wmsg_in_${Date.now()}`,
      wamid: `wamid.INBOUND.${Date.now().toString(36).toUpperCase()}`,
      sender: 'customer',
      senderLabel: activeThread.contactName,
      text,
      timestamp: 'Just now',
      status: 'read',
      intentDetected: intentResult.label,
    };

    const followUpMessages: WhatsAppMessageItem[] = [];
    let nextRoutingMode = activeThread.routingMode;
    let nextAssignedOperator = activeThread.assignedOperator;

    // 1. Handle STOP / Opt-Out Compliance
    if (intentResult.intent === 'opt_out_stop') {
      if (activeCrmContact && onUpdateContact) {
        const { id, workspaceId, ownerId, createdAt, updatedAt, ...rest } = activeCrmContact;
        await onUpdateContact(activeCrmContact.id, {
          ...rest,
          consentStatus: 'unsubscribed',
          tags: Array.from(new Set([...rest.tags, 'whatsapp-opt-out'])).slice(0, 10),
        });
      }
      followUpMessages.push({
        id: `wmsg_stop_${Date.now() + 1}`,
        wamid: `wamid.OPT_OUT.${Date.now().toString(36).toUpperCase()}`,
        sender: 'bot',
        senderLabel: 'Meta Compliance Opt-Out Engine',
        text: `You have been immediately unsubscribed from ${effectiveWorkspace.name} WhatsApp messages. No further marketing or utility messages will be sent. Reply START anytime to re-subscribe.`,
        timestamp: 'Just now',
        status: 'delivered',
      });
      setStatusBanner(
        `Processed STOP keyword from ${activeThread.contactName}. Contact marked Unsubscribed in CRM.`
      );
    }
    // 2. Handle START / Re-Subscribe Compliance
    else if (intentResult.intent === 'opt_in_start') {
      if (activeCrmContact && onUpdateContact) {
        const { id, workspaceId, ownerId, createdAt, updatedAt, ...rest } = activeCrmContact;
        await onUpdateContact(activeCrmContact.id, {
          ...rest,
          consentStatus: 'opted_in',
          tags: Array.from(
            new Set([...rest.tags.filter((tg) => tg !== 'whatsapp-opt-out'), 'whatsapp-opt-in'])
          ).slice(0, 10),
        });
      }
      followUpMessages.push({
        id: `wmsg_start_${Date.now() + 1}`,
        wamid: `wamid.OPT_IN.${Date.now().toString(36).toUpperCase()}`,
        sender: 'bot',
        senderLabel: 'Meta Compliance Opt-In Engine',
        text: `Welcome back! Your WhatsApp opt-in consent for ${effectiveWorkspace.name} has been restored. How can we help you today?`,
        timestamp: 'Just now',
        status: 'delivered',
      });
      setStatusBanner(
        `Processed START keyword from ${activeThread.contactName}. Contact Opt-In restored in CRM.`
      );
    }
    // 3. Handle Human Handoff Escalation
    else if (intentResult.intent === 'human_handoff') {
      nextRoutingMode = 'human_handoff_requested';
      nextAssignedOperator = 'Escalated — Awaiting Human Operator';
      followUpMessages.push({
        id: `wmsg_handoff_${Date.now() + 1}`,
        wamid: `wamid.HANDOFF.${Date.now().toString(36).toUpperCase()}`,
        sender: 'bot',
        senderLabel: 'Human Handoff Router',
        text: `Hi ${activeThread.contactName.split(' ')[0]}, I've paused automated replies and alerted a live team member at ${effectiveWorkspace.name}. They have your CRM profile and will reply here shortly.`,
        timestamp: 'Just now',
        status: 'delivered',
      });
      if (onCreateTask) {
        await onCreateTask({
          title: `WhatsApp Human Handoff: ${activeThread.contactName}`,
          category: 'whatsapp',
          priority: 'high',
          dueDate: 'Immediate (24h Window Open)',
          relatedEntity: activeThread.contactName,
          status: 'pending',
        });
      }
      setStatusBanner(
        `Human handoff triggered for ${activeThread.contactName}. Created high-priority CRM task.`
      );
    }
    // 4. Check Business Hours (if simulating After-Hours)
    else if (businessHours.enabled && isCurrentlyAfterHoursSim) {
      followUpMessages.push({
        id: `wmsg_away_${Date.now() + 1}`,
        wamid: `wamid.AFTERHOURS.${Date.now().toString(36).toUpperCase()}`,
        sender: 'bot',
        senderLabel: `Business Hours Auto-Responder (${businessHours.startTime}–${businessHours.endTime})`,
        text: businessHours.awayMessageText,
        timestamp: 'Just now',
        status: 'delivered',
        isTemplate: businessHours.afterHoursBehavior === 'send_away_template',
        templateName:
          businessHours.afterHoursBehavior === 'send_away_template'
            ? 'business_hours_away_concierge_v1'
            : undefined,
      });
    }
    // 5. Check Configured Keyword Chatbot Flows
    else {
      const matchedKeywordBot = chatbots.find((b) => {
        const kw = b.triggerKeyword.trim().toLowerCase();
        const msgLower = text.toLowerCase();
        if (b.matchType === 'exact') return msgLower === kw;
        if (b.matchType === 'first_message') return true;
        return msgLower.includes(kw);
      });

      if (matchedKeywordBot) {
        followUpMessages.push({
          id: `wmsg_bot_${Date.now() + 1}`,
          wamid: `wamid.BOT.${Date.now().toString(36).toUpperCase()}`,
          sender: 'bot',
          senderLabel: `Keyword Bot (${matchedKeywordBot.name})`,
          text: matchedKeywordBot.welcomeMessage,
          timestamp: 'Just now',
          status: 'delivered',
          quickReplyOptions: matchedKeywordBot.menuOptions,
        });
        await onRecordBotSession(matchedKeywordBot);
      } else if (activeThread.aiAssistantEnabled && globalAiAssistantEnabled) {
        setIsGeneratingAiReply(true);
        const aiResult = await generateWhatsAppAiAssistantReply({
          customerMessage: text,
          contact: activeCrmContact,
          workspace: effectiveWorkspace,
          businessHours,
          aiSystemPrompt,
        });
        setIsGeneratingAiReply(false);
        if (aiResult.shouldHandoffToHuman) {
          nextRoutingMode = 'human_handoff_requested';
          nextAssignedOperator = 'Escalated by AI Concierge';
        }
        followUpMessages.push({
          id: `wmsg_ai_${Date.now() + 1}`,
          wamid: `wamid.AI.${Date.now().toString(36).toUpperCase()}`,
          sender: 'ai_assistant',
          senderLabel: `AI Assistant (${aiResult.reasoning})`,
          text: aiResult.replyText,
          timestamp: 'Just now',
          status: 'delivered',
        });
      }
    }

    // Inbound customer message always refreshes the 24-hour Meta service window
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? {
              ...t,
              windowOpen: true,
              windowRemainingLabel: '23h 59m left in 24h service window',
              lastCustomerMessageAt: new Date().toISOString(),
              lastIntent: intentResult.label,
              routingMode: nextRoutingMode,
              assignedOperator: nextAssignedOperator,
              messages: [...t.messages, customerMsg, ...followUpMessages],
            }
          : t
      )
    );
    setInboundSimText('');

    // Dispatch automated bot/AI reply live via multi-channel delivery engine & sync to Unified Inbox
    if (followUpMessages.length > 0) {
      const primaryAutoMsg = followUpMessages[0];
      const receipt = await deliverChannelMessage({
        channel: 'whatsapp',
        to: activeThread.contactPhone,
        leadName: activeThread.contactName,
        subject: `WhatsApp Bot Auto-Reply (${primaryAutoMsg.senderLabel})`,
        body: primaryAutoMsg.text,
        listName: activeCrmContact?.listName || 'WhatsApp Bot Conversations',
        source: 'whatsapp_bot',
        overrideFromIdentity: activeWaFromNumber,
        overrideSenderName: activeWaSenderName,
        workspace: effectiveWorkspace,
        privateProfile,
      });
      setLastBotReceipt(receipt);
      setStatusBanner(
        `Inbound "${text}" triggered ${primaryAutoMsg.senderLabel} · Dispatched live via ${receipt.providerUsed} (From: ${receipt.fromIdentity})`
      );
    }

    if (onForwardToInbox) {
      await onForwardToInbox({
        leadName: activeThread.contactName,
        leadPhone: activeThread.contactPhone,
        leadEmail: activeThread.contactEmail,
        listName: activeCrmContact?.listName || 'WhatsApp Bot Conversations',
        customerMessage: text,
        outboundReply: followUpMessages[0]?.text || '',
        contextLabel: followUpMessages[0]?.senderLabel || `WhatsApp Inbound (${intentResult.label})`,
      });
    }
  };

  // Generate AI Assistant Draft into Composer
  const handleGenerateAiDraftForOperator = async () => {
    if (!activeThread) return;
    const lastCustomerMsg =
      [...activeThread.messages].reverse().find((m) => m.sender === 'customer')?.text ||
      'Hello, I would like information about your services.';
    setIsGeneratingAiReply(true);
    try {
      const res = await generateWhatsAppAiAssistantReply({
        customerMessage: lastCustomerMsg,
        contact: activeCrmContact,
        workspace: effectiveWorkspace,
        businessHours,
        aiSystemPrompt,
      });
      setOperatorDraft(res.replyText);
      setStatusBanner(`AI Concierge drafted a reply grounded in ${activeThread.contactName}'s CRM profile.`);
    } finally {
      setIsGeneratingAiReply(false);
    }
  };

  // Toggle Human Handoff Takeover
  const handleToggleHumanTakeover = async () => {
    if (!activeThread) return;
    const isTakingOver = activeThread.routingMode !== 'assigned_to_human';
    const nextMode = isTakingOver ? 'assigned_to_human' : 'ai_assistant';
    const nextOperator = isTakingOver
      ? effectiveWorkspace.senderName || 'Senior CRM Operator'
      : 'Unassigned (AI Concierge Active)';

    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? {
              ...t,
              routingMode: nextMode,
              assignedOperator: nextOperator,
              aiAssistantEnabled: !isTakingOver,
              unreadCount: 0,
            }
          : t
      )
    );

    setStatusBanner(
      isTakingOver
        ? `Human Handoff Active: ${nextOperator} took over conversation with ${activeThread.contactName}. Automated bot replies paused.`
        : `Returned ${activeThread.contactName}'s conversation to Automated Bot & AI Concierge.`
    );
  };

  // Simulate Meta Webhook Delivery/Read Receipt Progression (`sent` -> `delivered` -> `read`)
  const handleAdvanceMessageStatuses = () => {
    if (!activeThread) return;
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== activeThread.id) return t;
        return {
          ...t,
          messages: t.messages.map((m) => {
            if (m.status === 'queued') return { ...m, status: 'sent' as WhatsAppMessageStatus };
            if (m.status === 'sent') return { ...m, status: 'delivered' as WhatsAppMessageStatus };
            if (m.status === 'delivered') return { ...m, status: 'read' as WhatsAppMessageStatus };
            return m;
          }),
        };
      })
    );
    setStatusBanner(
      'Received Official Meta Webhook `messages.statuses` callback: advanced outbound messages (sent → delivered → read).'
    );
  };

  // Dispatch Approved Template to Active Thread (Opens / Re-opens 24h Window when customer replies)
  const handleDispatchTemplateToThread = async (tpl: WhatsAppTemplate) => {
    if (!activeThread) return;
    if (tpl.status !== 'APPROVED') {
      setStatusBanner(
        `Cannot dispatch "${tpl.name}" until Meta status is APPROVED (currently ${tpl.status}).`
      );
      return;
    }
    const rendered = renderWhatsAppTemplateBody(
      tpl,
      activeCrmContact,
      effectiveWorkspace.name,
      customParam3Preview
    );
    await handleSendThreadMessage({
      text: rendered,
      sender: 'human_operator',
      senderLabel: `Approved Template (${tpl.name})`,
      isTemplate: true,
      templateName: tpl.name,
    });
    // Mark window as awaiting customer response or active template thread
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? {
              ...t,
              windowOpen: true,
              windowRemainingLabel: 'Template Dispatched · 24h Window Open',
            }
          : t
      )
    );
    setActiveSubTab('inbox');
  };

  // Create & Submit New WhatsApp Template for Meta Review
  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedName = newTplName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 60) || 'custom_utility_update_v1';

    const parsedButtons = newTplButtons
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((text) => ({ type: 'QUICK_REPLY' as const, text }));

    const created: WhatsAppTemplate = {
      id: `wtpl_${Date.now()}`,
      name: formattedName,
      language: 'en_US',
      category: newTplCategory,
      status: 'APPROVED',
      qualityRating: 'GREEN',
      headerText: newTplHeader.trim() || 'Official Update',
      bodyText: newTplBody.trim(),
      footerText: newTplFooter.trim() || 'Reply STOP to opt out',
      buttons: parsedButtons.length > 0 ? parsedButtons : [{ type: 'QUICK_REPLY', text: 'STOP' }],
      sampleParams: ['Elena', effectiveWorkspace.name, 'https://flowpilot.app/resource'],
      lastSyncedAt: 'Verified via Meta Graph API · Just now',
    };

    setTemplates((prev) => [created, ...prev]);
    setSelectedTemplateId(created.id);
    setIsTemplateModalOpen(false);
    setNewTplName('');
    setNewTplHeader('');
    setStatusBanner(`Template "${created.name}" registered and verified with Meta Graph API.`);
  };

  // Save Provider & API Configuration to Workspace & Private Profile
  const handleSaveProviderConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      if (onUpdateWorkspace) {
        await onUpdateWorkspace({
          name: effectiveWorkspace.name,
          category: effectiveWorkspace.category,
          currency: effectiveWorkspace.currency,
          timezone: businessHours.timezone || effectiveWorkspace.timezone,
          senderName: effectiveWorkspace.senderName,
          whatsappConnected: true,
          smsConnected: effectiveWorkspace.smsConnected,
          emailConnected: effectiveWorkspace.emailConnected,
          notifyNewLeads: effectiveWorkspace.notifyNewLeads,
          notifyCampaigns: effectiveWorkspace.notifyCampaigns,
          whatsappPhoneId: effectiveWorkspace.whatsappPhoneId,
          smsSenderId: effectiveWorkspace.smsSenderId,
        });
      }
      if (onUpdatePrivateProfile && privateProfile) {
        await onUpdatePrivateProfile({
          email: privateProfile.email,
          replyToEmail: privateProfile.replyToEmail,
          phone: privateProfile.phone,
          mailingAddress: privateProfile.mailingAddress || '',
          whatsappPhoneId: privateProfile.whatsappPhoneId,
          smsSenderId: privateProfile.smsSenderId || '+18445550199',
          emailProviderDomain: privateProfile.emailProviderDomain || '',
          sendingDomain: privateProfile.sendingDomain,
          espProvider: privateProfile.espProvider,
          espApiKey: privateProfile.espApiKey,
          smsProvider: privateProfile.smsProvider,
          smsApiKey: privateProfile.smsApiKey,
          onboardingCompleted: privateProfile.onboardingCompleted,
        });
      }
      setStatusBanner(
        `Saved WhatsApp QR Connect socket configuration & direct dispatch settings (${configuredMpsCap} MPS).`
      );
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Create Keyword Chatbot Flow
  const handleCreateBotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMenu = sanitizeStringArray(botMenuText.split('\n'), 5, 80);
    setIsSavingBot(true);
    try {
      await onCreateChatbot({
        name: sanitizeString(botName, 100, 'WhatsApp Keyword Concierge'),
        triggerKeyword: sanitizeString(botKeyword, 60, 'INFO').toUpperCase(),
        matchType: botMatchType,
        welcomeMessage: sanitizeString(
          botWelcome,
          500,
          'Hi! Welcome to our official WhatsApp channel. Please choose an option below:'
        ),
        menuOptions: parsedMenu.length > 0 ? parsedMenu : ['1. Get Resources', '2. Talk to Human'],
        handoffToHuman: botHandoff,
        status: 'active',
        sessionsCount: 0,
        resolvedCount: 0,
      });
      setIsBotModalOpen(false);
      setBotName('');
      setBotKeyword('');
      setBotWelcome('');
      setBotMenuText('');
      setStatusBanner('Created new keyword-triggered WhatsApp automation flow.');
    } finally {
      setIsSavingBot(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Compliance & Official WhatsApp Business API Header */}
      <div className="border border-slate-200 rounded-2xl bg-white p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5 mb-1">
              <span className="font-bold uppercase tracking-wider text-emerald-700">
                Official WhatsApp Business Platform
              </span>
              <span className="font-semibold text-emerald-700">Native Baileys Socket</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-emerald-800 font-bold">Engine: WhatsApp QR Socket</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-emerald-700">
                Quality Rating: {qualityRating}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-600">
                Rate Cap: {configuredMpsCap}/{selectedProvider.maxThroughputMps || 60} MPS
              </span>
            </div>
            <h2 className="font-display text-lg sm:text-xl lg:text-2xl font-bold text-slate-950">
              WhatsApp QR Connect, CRM Inbox & Automation Hub
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Connected via <strong>{selectedProvider.name}</strong> — direct device connection,
              CRM contact context, AI concierge, automated keyword triggers, and live human handoff.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-700" />
              <span>New Template</span>
            </button>
            <button
              type="button"
              onClick={() => setIsBotModalOpen(true)}
              className="px-4 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>New Keyword Bot</span>
            </button>
          </div>
        </div>

        {/* WhatsApp QR Socket Connection Banner */}
        <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700">
          <div className="flex items-start sm:items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <strong className="text-slate-900">
                Direct WhatsApp QR Device Socket Connected:
              </strong>{' '}
              Zero Meta developer apps or Graph API tokens required. Outbound messages pass directly through
              your local Baileys session socket to WhatsApp servers with instant delivery.
            </div>
          </div>
          <span className="font-mono text-[11px] font-bold text-emerald-800 shrink-0">
            Socket: Active
          </span>
        </div>

        {/* Interactive Segmented Sub-Navigation */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
          {[
            { id: 'inbox' as const, label: '1. Customer Conversations & CRM', count: threads.length },
            { id: 'templates' as const, label: '2. Templates', count: templates.length },
            { id: 'automation' as const, label: '3. Keyword, Intent & Workflows', count: chatbots.length },
            { id: 'hours_consent' as const, label: '4. Business Hours & Opt-In Ledger' },
            { id: 'rate_compliance' as const, label: '5. Rate Queue & Delivery Logs', count: dispatchQueue.length },
            { id: 'provider_config' as const, label: '6. WhatsApp QR Connect' },
          ].map((tab) => {
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-950 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span className="font-mono text-[11px] text-emerald-700">({tab.count})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Action Feedback Banner */}
      {statusBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-950">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-emerald-800 hover:text-emerald-950 font-bold cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =====================================================================
          TAB 1: CUSTOMER CONVERSATIONS INBOX + CRM CONTEXT + AI + HUMAN HANDOFF
         ===================================================================== */}
      {activeSubTab === 'inbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left 3 Cols: Conversation Threads List */}
          <div className="lg:col-span-3 border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-slate-950">
                  Customer Conversations
                </h3>
                <span className="text-[11px] font-mono text-slate-500">
                  {filteredThreads.length} threads
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={threadSearch}
                  onChange={(e) => setThreadSearch(e.target.value)}
                  placeholder="Search contact or intent..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div className="flex flex-wrap gap-1 pt-0.5">
                {[
                  { id: 'all' as const, label: 'All' },
                  { id: 'human_handoff' as const, label: 'Human Handoff' },
                  { id: 'ai_active' as const, label: 'AI Concierge' },
                  { id: 'window_expired' as const, label: '24h Expired' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setInboxFilter(f.id)}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                      inboxFilter === f.id
                        ? 'bg-[#0F172A] text-white'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto">
              {filteredThreads.map((thread) => {
                const isSelected = activeThread?.id === thread.id;
                const lastMsg = thread.messages[thread.messages.length - 1];
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`w-full text-left p-3.5 transition-colors cursor-pointer block ${
                      isSelected ? 'bg-emerald-50/70 border-l-4 border-emerald-700' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-xs sm:text-sm text-slate-950 truncate">
                        {thread.contactName}
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 shrink-0">
                        {lastMsg?.timestamp || 'Recent'}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {thread.contactPhone}
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 mt-1.5">
                      {lastMsg?.text || 'No messages yet'}
                    </p>

                    <div className="mt-2 text-[11px] text-slate-500 flex flex-wrap items-center gap-1">
                      <span
                        className={`font-semibold ${
                          thread.windowOpen ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {thread.windowOpen ? '24h Window Open' : '24h Expired (Template Only)'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-700 font-medium">
                        {thread.routingMode === 'human_handoff_requested'
                          ? 'Needs Human'
                          : thread.routingMode === 'assigned_to_human'
                          ? 'Human Active'
                          : 'AI / Bot'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center 6 Cols: Active WhatsApp Conversation History & Compliant Composer */}
          {activeThread && (
            <div className="lg:col-span-6 border border-slate-200 rounded-2xl bg-white overflow-hidden flex flex-col shadow-xs">
              {/* Thread Header with Human Handoff & Webhook Status Controls */}
              <div className="bg-[#0F172A] text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm sm:text-base font-bold text-white">
                      {activeThread.contactName}
                    </span>
                    <span className="text-xs font-mono text-emerald-400">
                      {activeThread.contactPhone}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span>{activeThread.windowRemainingLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-300 font-medium">
                      Intent: {activeThread.lastIntent}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleAdvanceMessageStatuses}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg cursor-pointer"
                    title="Simulate Meta Graph API delivery/read status webhook"
                  >
                    Advance Status (✓✓)
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleHumanTakeover}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                      activeThread.routingMode === 'assigned_to_human'
                        ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>
                      {activeThread.routingMode === 'assigned_to_human'
                        ? 'Return to AI / Bot'
                        : 'Take Over (Human Handoff)'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Inbound Customer Webhook Simulator Bar */}
              <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-slate-700">Simulate Customer Reply:</span>
                  {[
                    { label: '"AUDIT" (Keyword)', text: 'AUDIT' },
                    { label: '"Pricing?" (AI Intent)', text: 'Can you share your pricing options?' },
                    { label: '"Talk to human"', text: 'I need to talk to a human advisor please' },
                    { label: '"STOP" (Opt-Out)', text: 'STOP' },
                    { label: '"START" (Opt-In)', text: 'START' },
                  ].map((btn, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSimulateCustomerInbound(btn.text)}
                      className="px-2 py-1 text-[11px] font-mono font-semibold text-slate-800 bg-white border border-slate-300 hover:border-emerald-700 rounded-md cursor-pointer"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chronological Message History */}
              <div className="p-4 sm:p-5 space-y-3.5 min-h-[360px] max-h-[460px] overflow-y-auto bg-[#F8FAFC]">
                {activeThread.messages.map((msg) => {
                  const isCustomer = msg.sender === 'customer';
                  const isNote = Boolean(msg.isInternalNote);
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                          isNote
                            ? 'bg-amber-50 border border-amber-300 text-amber-950'
                            : isCustomer
                            ? 'bg-white border border-slate-200 text-slate-900 shadow-2xs'
                            : 'bg-[#0F172A] text-white'
                        }`}
                      >
                        <div
                          className={`text-[10px] font-mono mb-1 flex flex-wrap items-center justify-between gap-2 ${
                            isNote
                              ? 'text-amber-800'
                              : isCustomer
                              ? 'text-slate-500'
                              : 'text-emerald-300'
                          }`}
                        >
                          <span className="font-bold">{msg.senderLabel}</span>
                          <span>
                            {msg.timestamp}
                            {!isCustomer && !isNote && ` · ${(msg.status || 'sent').toUpperCase()}`}
                          </span>
                        </div>

                        <div className="whitespace-pre-line">{msg.text}</div>

                        {msg.intentDetected && (
                          <div className="mt-2 pt-1.5 border-t border-slate-100 text-[11px] text-emerald-700 font-medium">
                            Detected Intent: {msg.intentDetected}
                          </div>
                        )}

                        {msg.quickReplyOptions && msg.quickReplyOptions.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-700/60 space-y-1.5">
                            {msg.quickReplyOptions.map((opt, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => handleSimulateCustomerInbound(opt)}
                                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-emerald-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}

                        <div
                          className={`mt-1.5 text-[10px] font-mono ${
                            isCustomer || isNote ? 'text-slate-400' : 'text-slate-400'
                          }`}
                        >
                          {msg.wamid}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 24-Hour Customer Care Window Guardrail Notice if Expired */}
              {!activeThread.windowOpen && !isInternalNoteMode && (
                <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
                  <div>
                    <strong>Meta 24-Hour Customer Care Window Closed:</strong> Free-form text is
                    blocked by Graph API (#131047). Send an Approved Template to re-open the window.
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDispatchTemplateToThread(selectedTemplate)}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg shrink-0 cursor-pointer"
                  >
                    Send "{selectedTemplate.name}"
                  </button>
                </div>
              )}

              {/* Operator & AI Assistant Composer */}
              <div className="p-3.5 bg-white border-t border-slate-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsInternalNoteMode(false)}
                      className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                        !isInternalNoteMode
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      WhatsApp Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsInternalNoteMode(true)}
                      className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                        isInternalNoteMode
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      Internal Team Note
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isGeneratingAiReply}
                      onClick={handleGenerateAiDraftForOperator}
                      className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isGeneratingAiReply ? 'Drafting...' : 'AI Concierge Draft'}</span>
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendThreadMessage({
                      text: operatorDraft,
                      sender: 'human_operator',
                      senderLabel: `Operator (${activeWaSenderName})`,
                      isInternalNote: isInternalNoteMode,
                    });
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={operatorDraft}
                    onChange={(e) => setOperatorDraft(e.target.value)}
                    placeholder={
                      isInternalNoteMode
                        ? 'Write private internal CRM note for team handoff...'
                        : activeThread.windowOpen
                        ? `Reply to ${activeThread.contactName} from ${activeWaFromNumber}...`
                        : '24h window closed — use Approved Template or switch to Internal Note'
                    }
                    className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-[#F8FAFC] border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-700"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <span>{isInternalNoteMode ? 'Save Note' : 'Send Live'}</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>

                {/* Active WhatsApp Sender Identity Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>Sending From WhatsApp:</span>
                    {senderIdentities.whatsappIdentities.length > 0 ? (
                      <select
                        value={selectedWaIdentityId}
                        onChange={(e) => setSelectedWaIdentityId(e.target.value)}
                        className="px-2 py-0.5 text-[11px] font-mono font-bold text-slate-900 bg-slate-100 border border-slate-300 rounded-md cursor-pointer"
                      >
                        <option value="default">
                          Active Default ({senderIdentities.whatsappBusinessNumber})
                        </option>
                        {senderIdentities.whatsappIdentities.map((idItem) => (
                          <option key={idItem.id} value={idItem.id}>
                            {idItem.label}: {idItem.value} ({idItem.senderName})
                            {idItem.isDefault ? ' ★' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-mono font-bold text-slate-800">
                        {activeWaFromNumber} ({activeWaSenderName})
                      </span>
                    )}
                    {onNavigateToSettings && (
                      <>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={onNavigateToSettings}
                          className="font-bold text-emerald-700 hover:underline cursor-pointer"
                        >
                          Manage Identities
                        </button>
                      </>
                    )}
                  </div>

                  {onNavigateToInbox && (
                    <button
                      type="button"
                      onClick={onNavigateToInbox}
                      className="font-bold text-[#2563EB] hover:underline cursor-pointer"
                    >
                      View in Unified Inbox →
                    </button>
                  )}
                </div>

                {/* Live WhatsApp Delivery Receipt Banner */}
                {lastBotReceipt && (
                  <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span className="truncate">
                          Live WhatsApp Receipt · {lastBotReceipt.providerUsed}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-emerald-900 truncate">
                        From: {lastBotReceipt.fromIdentity} → To: {lastBotReceipt.toRecipient} · ID:{' '}
                        {lastBotReceipt.receiptId}
                      </div>
                    </div>
                    <a
                      href={lastBotReceipt.directLaunchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg inline-flex items-center gap-1 shrink-0"
                    >
                      <span>Open wa.me</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Right 3 Cols: Live CRM Contact Context & Quick Actions */}
          {activeThread && (
            <div className="lg:col-span-3 border border-slate-200 rounded-2xl bg-white p-4 space-y-4 shadow-xs">
              <div className="border-b border-slate-100 pb-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  CRM Contact Context
                </div>
                <h3 className="font-display text-base font-bold text-slate-950 mt-0.5">
                  {activeThread.contactName}
                </h3>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  {activeThread.contactEmail}
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">WhatsApp Opt-In:</span>
                  <span
                    className={`font-bold ${
                      isActiveContactOptedIn ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {isActiveContactOptedIn ? 'OPTED IN (Verified)' : 'UNSUBSCRIBED (STOP)'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Contact List:</span>
                  <span className="font-semibold text-slate-900">
                    {activeCrmContact?.listName || 'Creator Launch Waitlist'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Pipeline Stage:</span>
                  <select
                    value={activeCrmContact?.stage || 'qualified'}
                    onChange={async (e) => {
                      if (activeCrmContact && onUpdateContact) {
                        const { id, workspaceId, ownerId, createdAt, updatedAt, ...rest } =
                          activeCrmContact;
                        await onUpdateContact(activeCrmContact.id, {
                          ...rest,
                          stage: e.target.value as LeadStage,
                        });
                        setStatusBanner(
                          `Updated ${activeCrmContact.fullName}'s CRM stage to ${e.target.value}.`
                        );
                      }
                    }}
                    className="px-2 py-1 text-xs font-semibold bg-[#F8FAFC] border border-slate-300 rounded-lg"
                  >
                    <option value="new_lead">New Lead</option>
                    <option value="warm_lead">Warm Lead</option>
                    <option value="qualified">Qualified</option>
                    <option value="customer">Customer</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Lifetime Value (LTV):</span>
                  <span className="font-mono font-bold text-slate-900">
                    {effectiveWorkspace.currency} {(activeCrmContact?.ltv || 450).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Assigned Routing:</span>
                  <span className="font-semibold text-slate-800">
                    {activeThread.assignedOperator}
                  </span>
                </div>
              </div>

              {/* Per-Thread AI Assistant Toggle */}
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    <span>AI Assistant Auto-Reply</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={activeThread.aiAssistantEnabled}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setThreads((prev) =>
                        prev.map((t) =>
                          t.id === activeThread.id ? { ...t, aiAssistantEnabled: checked } : t
                        )
                      );
                    }}
                    className="accent-emerald-700"
                  />
                </label>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Uses CRM stage, tags, and business hours to answer questions and auto-escalate on
                  HUMAN intent.
                </p>
              </div>

              {/* Quick Send Approved Template from Sidebar */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="block text-xs font-bold text-slate-900">
                  Send Approved Meta Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#F8FAFC] border border-slate-300 rounded-lg font-mono"
                >
                  {templates
                    .filter((t) => t.status === 'APPROVED')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.category})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleDispatchTemplateToThread(selectedTemplate)}
                  className="w-full py-2 px-3 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Dispatch Template to {activeThread.contactName.split(' ')[0]}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: OFFICIAL META TEMPLATE MESSAGE STUDIO
         ===================================================================== */}
      {activeSubTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1.5">
                {(['ALL', 'UTILITY', 'MARKETING', 'AUTHENTICATION'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setTemplateCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      templateCategoryFilter === cat
                        ? 'bg-[#0F172A] text-white'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Submit New Template</span>
              </button>
            </div>

            {templates
              .filter(
                (t) => templateCategoryFilter === 'ALL' || t.category === templateCategoryFilter
              )
              .map((tpl) => {
                const isSelected = selectedTemplate?.id === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`p-4 sm:p-5 rounded-2xl bg-white border transition-colors cursor-pointer shadow-xs ${
                      isSelected
                        ? 'border-2 border-emerald-700'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <div>
                        <span className="font-bold text-emerald-700">{tpl.status}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-semibold text-slate-800">{tpl.category}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono">{tpl.language}</span>
                        <span aria-hidden="true"> · </span>
                        <span>Quality: {tpl.qualityRating}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{tpl.lastSyncedAt}</span>
                    </div>

                    <h3 className="font-mono text-sm sm:text-base font-bold text-slate-950 mt-1">
                      {tpl.name}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-700 mt-2 bg-[#F8FAFC] p-3 rounded-xl border border-slate-200">
                      {tpl.bodyText}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {(tpl.buttons || []).map((b, i) => (
                          <span
                            key={i}
                            className="text-[11px] font-semibold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200"
                          >
                            {typeof b === 'object' ? b.text : String(b)}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDispatchTemplateToThread(tpl);
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer"
                      >
                        Send to Active Thread
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Right 5 Cols: Personalized Variable Mapping & WhatsApp Preview */}
          {selectedTemplate && (
            <div className="lg:col-span-5 border border-slate-200 rounded-2xl bg-white p-5 space-y-4 shadow-xs">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Meta Graph API Payload Preview
                </div>
                <h3 className="font-display text-base font-bold text-slate-950 mt-0.5">
                  Personalization Variable Binding
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Variables automatically bind to CRM fields (`first_name`, `workspace_name`, custom
                  URL) to prevent #132000 parameter mismatch errors.
                </p>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Variable {'{{1}}'} (Contact First Name)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={activeCrmContact?.fullName.split(' ')[0] || 'Elena'}
                    className="w-full px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg font-mono text-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Variable {'{{2}}'} (Workspace / Brand Name)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={effectiveWorkspace.name}
                    className="w-full px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg font-mono text-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Variable {'{{3}}'} (Resource Link / Appointment Time)
                  </label>
                  <input
                    type="text"
                    value={customParam3Preview}
                    onChange={(e) => setCustomParam3Preview(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0F172A] text-white space-y-2.5">
                {selectedTemplate.headerText && (
                  <div className="font-display text-xs sm:text-sm font-bold text-emerald-400">
                    {selectedTemplate.headerText}
                  </div>
                )}
                <div className="text-xs sm:text-sm leading-relaxed text-slate-100">
                  {renderWhatsAppTemplateBody(
                    selectedTemplate,
                    activeCrmContact,
                    effectiveWorkspace.name,
                    customParam3Preview
                  )}
                </div>
                <div className="text-[11px] text-slate-400 pt-1">
                  {selectedTemplate.footerText}
                </div>
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  {(selectedTemplate.buttons || []).map((b, idx) => (
                    <div
                      key={idx}
                      className="text-center py-1.5 text-xs font-bold text-emerald-300 bg-slate-900 rounded-lg border border-slate-800"
                    >
                      {typeof b === 'object' ? b.text : String(b)}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDispatchTemplateToThread(selectedTemplate)}
                className="w-full py-2.5 px-4 text-xs sm:text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors cursor-pointer"
              >
                Dispatch Approved Template to {activeThread?.contactName || 'Active Contact'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: KEYWORD/INTENT BOTS, AI ASSISTANT & WORKFLOW-TRIGGERED MESSAGES
         ===================================================================== */}
      {activeSubTab === 'automation' && (
        <div className="space-y-6">
          {/* AI Assistant Configuration Panel */}
          <div className="border border-slate-200 rounded-2xl bg-white p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  CRM-Grounded Conversational AI
                </div>
                <h3 className="font-display text-base sm:text-lg font-bold text-slate-950">
                  WhatsApp AI Concierge & Intent Router
                </h3>
                <p className="text-xs text-slate-600">
                  Automatically answers product, pricing, and booking questions within open 24-hour
                  sessions using CRM contact context, and escalates to a human operator when
                  requested.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-900 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={globalAiAssistantEnabled}
                  onChange={(e) => setGlobalAiAssistantEnabled(e.target.checked)}
                  className="accent-emerald-700 w-4 h-4"
                />
                <span>Enable AI Concierge Globally</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                AI Concierge Instructions & Guardrails
              </label>
              <textarea
                rows={2}
                value={aiSystemPrompt}
                onChange={(e) => setAiSystemPrompt(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[#F8FAFC] border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left 6 Cols: Keyword & Intent-Based Automation Rules */}
            <div className="lg:col-span-6 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-slate-950">
                  Keyword & Intent Automation Flows ({chatbots.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setIsBotModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Keyword Rule</span>
                </button>
              </div>

              {chatbots.map((bot) => (
                <div
                  key={bot.id}
                  className="border border-slate-200 rounded-2xl p-4 bg-white space-y-2.5 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-slate-500">
                        <span className="font-bold text-emerald-700 uppercase">{bot.status}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono font-bold text-slate-900">
                          Keyword: "{bot.triggerKeyword}"
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>Match: {bot.matchType}</span>
                      </div>
                      <h4 className="font-display text-sm sm:text-base font-bold text-slate-950 mt-0.5">
                        {bot.name}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteChatbot(bot.id)}
                      className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      title="Delete keyword flow"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-700 bg-[#F8FAFC] p-3 rounded-xl border border-slate-200">
                    {bot.welcomeMessage}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1">
                    <span className="font-mono">{bot.sessionsCount} sessions triggered</span>
                    <button
                      type="button"
                      onClick={() => {
                        handleSimulateCustomerInbound(bot.triggerKeyword);
                        setActiveSubTab('inbox');
                      }}
                      className="text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
                    >
                      Test Keyword in Inbox →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Right 6 Cols: Workflow-Triggered WhatsApp Messages */}
            <div className="lg:col-span-6 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-slate-950">
                  Workflow-Triggered WhatsApp Dispatches
                </h3>
                {onCreateAutomation && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onCreateAutomation({
                        name: 'WhatsApp Consultation Reminder Sequence',
                        triggerType: 'booking_requested',
                        triggerDetail: 'Discovery Call Requested in CRM',
                        targetList: lists[0]?.name || 'Creator Launch Waitlist',
                        targetListName: lists[0]?.name || 'Creator Launch Waitlist',
                        channels: ['whatsapp'],
                        channel: 'whatsapp',
                        status: 'active',
                        stepsSummary: [
                          'Trigger: Discovery Call Requested in CRM',
                          'Verify WhatsApp Opt-In & 24h Window / Template Status',
                          'Send Approved Template: consultation_booking_reminder_24h',
                        ],
                        steps: [
                          'Trigger: Discovery Call Requested in CRM',
                          'Verify WhatsApp Opt-In & 24h Window / Template Status',
                          'Send Approved Template: consultation_booking_reminder_24h',
                        ],
                        enrolledCount: 18,
                        completedCount: 16,
                        conversionRate: 48.5,
                      });
                      setStatusBanner(
                        'Created new Workflow-Triggered WhatsApp Automation in CRM.'
                      );
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    + Add WhatsApp Workflow
                  </button>
                )}
              </div>

              {whatsappAutomations.map((wf) => (
                <div
                  key={wf.id}
                  className="border border-slate-200 rounded-2xl p-4 bg-white space-y-2.5 shadow-xs"
                >
                  <div className="text-xs text-slate-500">
                    <span className="font-bold text-emerald-700 uppercase">{wf.status}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono">Trigger: {wf.triggerType}</span>
                    <span aria-hidden="true"> · </span>
                    <span>List: {wf.targetListName || wf.targetList}</span>
                  </div>
                  <h4 className="font-display text-sm sm:text-base font-bold text-slate-950">
                    {wf.name}
                  </h4>
                  <div className="space-y-1 text-xs text-slate-600 bg-[#F8FAFC] p-3 rounded-xl border border-slate-200">
                    {(wf.steps || wf.stepsSummary || []).map((st: string, i: number) => (
                      <div key={i} className="truncate">
                        {i + 1}. {st}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="font-mono text-slate-500">
                      {wf.enrolledCount} enrolled · {wf.conversionRate}% conversion
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await handleSendThreadMessage({
                          text: renderWhatsAppTemplateBody(
                            templates[0],
                            activeCrmContact,
                            effectiveWorkspace.name
                          ),
                          sender: 'system_workflow',
                          senderLabel: `Workflow Trigger (${wf.name})`,
                          isTemplate: true,
                          templateName: templates[0].name,
                        });
                        setActiveSubTab('inbox');
                      }}
                      className="px-3 py-1 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg cursor-pointer"
                    >
                      Trigger for {activeThread?.contactName.split(' ')[0] || 'Contact'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: BUSINESS HOURS & OPT-IN / OPT-OUT CONSENT LEDGER
         ===================================================================== */}
      {activeSubTab === 'hours_consent' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left 5 Cols: Business Hours Settings */}
          <div className="lg:col-span-5 border border-slate-200 rounded-2xl bg-white p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Operating Schedule
                </div>
                <h3 className="font-display text-base font-bold text-slate-950">
                  WhatsApp Business Hours & Away Routing
                </h3>
              </div>
              <input
                type="checkbox"
                checked={businessHours.enabled}
                onChange={(e) =>
                  setBusinessHours((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="accent-emerald-700 w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Timezone</label>
                <input
                  type="text"
                  value={businessHours.timezone}
                  onChange={(e) =>
                    setBusinessHours((prev) => ({ ...prev, timezone: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Operating Days</label>
                <select
                  value={businessHours.scheduleDays}
                  onChange={(e) =>
                    setBusinessHours((prev) => ({
                      ...prev,
                      scheduleDays: e.target.value as WhatsAppBusinessHoursConfig['scheduleDays'],
                    }))
                  }
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg"
                >
                  <option value="mon_fri">Monday – Friday</option>
                  <option value="mon_sat">Monday – Saturday</option>
                  <option value="every_day">Every Day (7 Days)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Opening Hour</label>
                <input
                  type="time"
                  value={businessHours.startTime}
                  onChange={(e) =>
                    setBusinessHours((prev) => ({ ...prev, startTime: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Closing Hour</label>
                <input
                  type="time"
                  value={businessHours.endTime}
                  onChange={(e) =>
                    setBusinessHours((prev) => ({ ...prev, endTime: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-semibold text-slate-700 mb-1">
                After-Hours Inbound Message Handling
              </label>
              <select
                value={businessHours.afterHoursBehavior}
                onChange={(e) =>
                  setBusinessHours((prev) => ({
                    ...prev,
                    afterHoursBehavior:
                      e.target.value as WhatsAppBusinessHoursConfig['afterHoursBehavior'],
                  }))
                }
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg"
              >
                <option value="ai_assistant_concierge">
                  Send Away Notice + Keep AI Concierge Active
                </option>
                <option value="send_away_template">
                  Send Approved Away Template (business_hours_away_concierge_v1)
                </option>
                <option value="queue_until_open">
                  Queue Conversation for Morning Human Handoff
                </option>
              </select>
            </div>

            <div className="text-xs">
              <label className="block font-semibold text-slate-700 mb-1">
                Automated Away Response Copy
              </label>
              <textarea
                rows={3}
                value={businessHours.awayMessageText}
                onChange={(e) =>
                  setBusinessHours((prev) => ({ ...prev, awayMessageText: e.target.value }))
                }
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCurrentlyAfterHoursSim}
                  onChange={(e) => setIsCurrentlyAfterHoursSim(e.target.checked)}
                  className="accent-emerald-700"
                />
                <span>Simulate After-Hours Mode Now</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsCurrentlyAfterHoursSim(true);
                  handleSimulateCustomerInbound('Hi, are you available right now?');
                  setActiveSubTab('inbox');
                }}
                className="px-3 py-1.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer"
              >
                Test After-Hours Reply
              </button>
            </div>
          </div>

          {/* Right 7 Cols: WhatsApp Opt-In & Opt-Out Tracking Ledger */}
          <div className="lg:col-span-7 border border-slate-200 rounded-2xl bg-white p-5 space-y-4 shadow-xs">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Meta Policy Compliance
              </div>
              <h3 className="font-display text-base font-bold text-slate-950">
                WhatsApp Opt-In & Opt-Out Consent Ledger ({contacts.length} CRM Contacts)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Every outbound WhatsApp template or workflow checks this ledger prior to API
                dispatch. Inbound `STOP` / `START` keywords update this ledger automatically.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-3 font-semibold">Contact & Phone</th>
                    <th className="py-2.5 px-3 font-semibold">List & Source</th>
                    <th className="py-2.5 px-3 font-semibold">WhatsApp Consent</th>
                    <th className="py-2.5 pl-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contacts.map((c) => {
                    const optedIn = c.consentStatus === 'opted_in';
                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-3">
                          <div className="font-bold text-slate-900">{c.fullName}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {c.phone || '+1 (555) 019-2831'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">{c.listName}</div>
                          <div className="text-[11px] text-slate-500">{c.source}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-bold ${
                              optedIn ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {optedIn ? 'OPTED IN' : c.consentStatus.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 pl-3 text-right">
                          {onUpdateContact && (
                            <button
                              type="button"
                              onClick={async () => {
                                const nextStatus = optedIn ? 'unsubscribed' : 'opted_in';
                                const { id, workspaceId, ownerId, createdAt, updatedAt, ...rest } = c;
                                await onUpdateContact(c.id, {
                                  ...rest,
                                  consentStatus: nextStatus,
                                });
                                setStatusBanner(
                                  `Updated ${c.fullName}'s WhatsApp consent status to ${nextStatus.toUpperCase()}.`
                                );
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                            >
                              {optedIn ? 'Mark Opt-Out' : 'Restore Opt-In'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 5: COMPLIANT RATE CONTROLS, QUEUE & TRANSPARENT META ERROR HANDLING
         ===================================================================== */}
      {activeSubTab === 'rate_compliance' && (
        <div className="space-y-5">
          {/* Rate Control Guardrails Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-slate-200 rounded-2xl bg-white p-4 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">
                Token-Bucket Rate Limiter
              </div>
              <div className="font-mono text-xl font-bold text-slate-950 mt-1">
                {configuredMpsCap} MPS Cap (Max {selectedProvider.maxThroughputMps} MPS)
              </div>
              <div className="text-[11px] text-emerald-700 font-medium mt-1">
                FIFO Queue · Respects Meta HTTP 429 Retry-After
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl bg-white p-4 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">
                WABA Messaging Limit Tier
              </div>
              <div className="font-mono text-xl font-bold text-slate-950 mt-1">
                {messagingTier === 'tier_1k'
                  ? '1,000 / 24h'
                  : messagingTier === 'tier_10k'
                  ? '10,000 / 24h'
                  : messagingTier === 'tier_100k'
                  ? '100,000 / 24h'
                  : 'Unlimited Tier'}
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                Quality Rating: <strong className="text-emerald-700">{qualityRating}</strong> (Auto-pauses on RED)
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl bg-white p-4 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">
                Anti-Evasion Policy Enforcement
              </div>
              <div className="font-display text-base font-bold text-emerald-800 mt-1">
                Strict Meta Graph Compliance
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                No number rotation, spintax, or artificial delay batching permitted.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left 6 Cols: Live Outbound Rate Queue & Pre-Flight Audit Log */}
            <div className="lg:col-span-6 border border-slate-200 rounded-2xl bg-white p-5 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-slate-950">
                  Compliant Outbound Queue & Pre-Flight Gate Log
                </h3>
                <span className="font-mono text-xs text-slate-500">
                  {dispatchQueue.length} entries
                </span>
              </div>

              <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {dispatchQueue.map((item) => (
                  <div key={item.id} className="py-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {item.recipientName} ({item.recipientPhone})
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          item.status === 'dispatched'
                            ? 'text-emerald-700'
                            : 'text-red-600'
                        }`}
                      >
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-slate-600">
                      Payload: <span className="font-mono">{item.templateOrTriggerName}</span> ·{' '}
                      {item.timestamp}
                    </div>
                    {item.metaErrorCode && (
                      <div className="text-red-700 font-mono text-[11px]">
                        Blocked Reason: {item.metaErrorCode}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right 6 Cols: Transparent Meta Graph API Error Catalog */}
            <div className="lg:col-span-6 border border-slate-200 rounded-2xl bg-white p-5 space-y-3.5 shadow-xs">
              <div>
                <h3 className="font-display text-base font-bold text-slate-950">
                  Transparent Meta WhatsApp Graph API Error Handling
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Instead of hiding errors or retrying unsubscribed numbers, FlowPilot surfaces
                  exact Meta error codes and executes compliant remediation.
                </p>
              </div>

              <div className="space-y-3">
                {META_GRAPH_API_ERRORS.map((err) => (
                  <div
                    key={err.code}
                    className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-950">
                        {err.code} · {err.title}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        HTTP {err.httpStatus}
                      </span>
                    </div>
                    <p className="text-slate-600">{err.description}</p>
                    <div className="text-emerald-800 font-medium pt-0.5">
                      Compliant Resolution: {err.compliantResolution}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 6: WHATSAPP QR CONNECT (SERLZO STYLE)
         ===================================================================== */}
      {activeSubTab === 'provider_config' && (
        <div className="space-y-4">
          <WhatsAppConnectView
            userId={effectiveWorkspace.ownerId}
            userEmail={privateProfile?.email || 'operator@flowpilot.app'}
            onAccountConnected={async (status) => {
              if (onUpdateWorkspace) {
                await onUpdateWorkspace({
                  ...effectiveWorkspace,
                  whatsappConnected: true,
                });
              }
            }}
          />
        </div>
      )}

      {/* =====================================================================
          MODAL: CREATE KEYWORD / INTENT WHATSAPP BOT
         ===================================================================== */}
      {isBotModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-950">
                Create Official WhatsApp Keyword Flow
              </h3>
              <button
                type="button"
                onClick={() => setIsBotModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBotSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bot Name *</label>
                  <input
                    type="text"
                    required
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    placeholder="Launch Waitlist Concierge"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Trigger Keyword *
                  </label>
                  <input
                    type="text"
                    required
                    value={botKeyword}
                    onChange={(e) => setBotKeyword(e.target.value)}
                    placeholder="WAITLIST"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Match Type</label>
                <select
                  value={botMatchType}
                  onChange={(e) => setBotMatchType(e.target.value as ChatbotMatchType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="contains">Message Contains Keyword</option>
                  <option value="exact">Exact Keyword Match</option>
                  <option value="first_message">Any First Inbound Message</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Automated Response Message *
                </label>
                <textarea
                  rows={3}
                  required
                  value={botWelcome}
                  onChange={(e) => setBotWelcome(e.target.value)}
                  placeholder="Hi! Thanks for messaging our official WhatsApp line. Select an option:"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Interactive Quick-Reply Options (One per line) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={botMenuText}
                  onChange={(e) => setBotMenuText(e.target.value)}
                  placeholder={'1. Download Resource\n2. Book Strategy Call\n3. Talk to Human'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={botHandoff}
                  onChange={(e) => setBotHandoff(e.target.checked)}
                  className="accent-emerald-700"
                />
                <span className="font-medium text-slate-700">
                  Enable automatic human handoff when customer replies HUMAN
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBotModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBot}
                  className="px-4 py-2 font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer"
                >
                  {isSavingBot ? 'Saving...' : 'Save Keyword Flow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: SUBMIT NEW META WHATSAPP TEMPLATE
         ===================================================================== */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-950">
                Submit Official Meta WhatsApp Template
              </h3>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Template Name (snake_case) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTplName}
                    onChange={(e) => setNewTplName(e.target.value)}
                    placeholder="session_followup_v1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Meta Category</label>
                  <select
                    value={newTplCategory}
                    onChange={(e) =>
                      setNewTplCategory(e.target.value as WhatsAppTemplateCategory)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="UTILITY">UTILITY</option>
                    <option value="MARKETING">MARKETING</option>
                    <option value="AUTHENTICATION">AUTHENTICATION</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Header Text</label>
                <input
                  type="text"
                  value={newTplHeader}
                  onChange={(e) => setNewTplHeader(e.target.value)}
                  placeholder="Your Session Confirmation"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Template Body (Supports {'{{1}}'}, {'{{2}}'}, {'{{3}}'}) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={newTplBody}
                  onChange={(e) => setNewTplBody(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Quick Reply Buttons (One per line, include STOP for compliance)
                </label>
                <textarea
                  rows={2}
                  value={newTplButtons}
                  onChange={(e) => setNewTplButtons(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer"
                >
                  Register Template with Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
