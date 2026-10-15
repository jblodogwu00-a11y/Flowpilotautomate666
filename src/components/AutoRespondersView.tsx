import React, { useState, useMemo, useEffect } from 'react';
import {
  Zap,
  Plus,
  Search,
  Layers,
  MessageSquare,
  Mail,
  Phone,
  CheckCircle2,
  Play,
  Pause,
  Edit3,
  Trash2,
  Send,
  ArrowRight,
  FolderPlus,
  Check,
  X,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  AutoResponder,
  AutoResponderMatchType,
  AutoResponderStatus,
  AudienceList,
  Contact,
  ChannelType,
  ActivityLog,
  Workspace,
  UserPrivateProfile,
  sanitizeString,
  resolveWorkspaceSenderIdentities,
} from '../types';
import { evaluateListKillSwitchForContact } from './AutomationEngineCatalog';
import {
  deliverChannelMessage,
  MessageDeliveryReceipt,
} from '../services/messageDeliveryService';

interface AutoRespondersViewProps {
  autoResponders: AutoResponder[];
  lists: AudienceList[];
  contacts: Contact[];
  workspace?: Workspace;
  privateProfile?: UserPrivateProfile;
  preselectedListName?: string | null;
  onClearPreselectedList?: () => void;
  onNavigateToSettings?: () => void;
  onCreateAutoResponder: (
    data: Omit<AutoResponder, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateAutoResponder: (
    id: string,
    data: Omit<AutoResponder, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onDeleteAutoResponder: (id: string) => Promise<void>;
  onCreateList: (
    data: Omit<AudienceList, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onLogActivity: (
    eventType: ActivityLog['eventType'],
    title: string,
    detail: string,
    channel: ActivityLog['channel']
  ) => Promise<void>;
  onNavigateToLists: () => void;
  onForwardToInbox?: (payload: {
    leadName: string;
    listName: string;
    channel: ChannelType;
    leadMessage: string;
    autoResponseSent?: string;
    responderName: string;
  }) => Promise<void>;
  onNavigateToInbox?: () => void;
}

const CHANNEL_LABELS: Record<ChannelType, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
};

const QUICK_TRIGGER_EXAMPLES = [
  'Hi, I want more details',
  'INFO',
  'PRICE',
  'Send me the link',
  'BOOK CALL',
  'YES',
];

export const AutoRespondersView: React.FC<AutoRespondersViewProps> = ({
  autoResponders,
  lists,
  contacts,
  workspace,
  privateProfile,
  preselectedListName,
  onClearPreselectedList,
  onNavigateToSettings,
  onCreateAutoResponder,
  onUpdateAutoResponder,
  onDeleteAutoResponder,
  onCreateList,
  onLogActivity,
  onNavigateToLists,
  onForwardToInbox,
  onNavigateToInbox,
}) => {
  const senderIdentities = useMemo(
    () => resolveWorkspaceSenderIdentities(workspace, privateProfile),
    [workspace, privateProfile]
  );

  const getChannelFromDisplay = (ch: ChannelType): string => {
    if (ch === 'whatsapp') {
      return `WhatsApp Business: ${senderIdentities.whatsappBusinessNumber} (${
        workspace?.senderName || workspace?.name || 'Workspace'
      })`;
    }
    if (ch === 'email') {
      return `${senderIdentities.emailDisplaySender} (${
        senderIdentities.activeEmailMode === 'custom_domain'
          ? 'Custom Domain Email'
          : 'Platform-Provided Email'
      })`;
    }
    return `SMS Sender ID: ${senderIdentities.smsSenderId}`;
  };
  // Combine explicit lists + any listName referenced on contacts or existing autoResponders
  const allAvailableLists = useMemo(() => {
    const known = new Set(lists.map((l) => l.name.toLowerCase()));
    const dynamicLists: AudienceList[] = [];

    contacts.forEach((c) => {
      if (c.listName && !known.has(c.listName.toLowerCase())) {
        known.add(c.listName.toLowerCase());
        dynamicLists.push({
          id: `dyn_${c.listName}`,
          workspaceId: c.workspaceId,
          ownerId: c.ownerId,
          name: c.listName,
          description: `Contacts grouped in "${c.listName}".`,
          category: 'custom',
          defaultConsent: 'opted_in',
          defaultTags: ['segmented'],
          colorAccent: 'emerald',
        });
      }
    });

    autoResponders.forEach((ar) => {
      if (ar.targetList && !known.has(ar.targetList.toLowerCase())) {
        known.add(ar.targetList.toLowerCase());
        dynamicLists.push({
          id: `dyn_ar_${ar.targetList}`,
          workspaceId: ar.workspaceId,
          ownerId: ar.ownerId,
          name: ar.targetList,
          description: `Special list assigned to Auto Responder.`,
          category: 'custom',
          defaultConsent: 'opted_in',
          defaultTags: ['auto-responder'],
          colorAccent: 'emerald',
        });
      }
    });

    return [...lists, ...dynamicLists];
  }, [lists, contacts, autoResponders]);

  // Step 1: Search & Choose Special List state
  const [listKeywordSearch, setListKeywordSearch] = useState('');
  const [selectedListName, setSelectedListName] = useState<string>('');

  // Inline Quick Create Special List state
  const [showQuickCreateList, setShowQuickCreateList] = useState(false);
  const [newSpecialListName, setNewSpecialListName] = useState('');
  const [newSpecialListDesc, setNewSpecialListDesc] = useState('');
  const [creatingList, setCreatingList] = useState(false);

  // Step 2: Two Message Boxes + Channel Dropdown state
  const [editingResponder, setEditingResponder] = useState<AutoResponder | null>(null);
  const [responderName, setResponderName] = useState('');
  const [triggerMessage, setTriggerMessage] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>('whatsapp');
  const [matchType, setMatchType] = useState<AutoResponderMatchType>('contains');
  const [subjectLine, setSubjectLine] = useState('');
  const [savingResponder, setSavingResponder] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Library Filter & Search state
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [libraryChannelFilter, setLibraryChannelFilter] = useState<'all' | ChannelType>('all');
  const [libraryListFilter, setLibraryListFilter] = useState<string>('all');

  // Auto-Pilot Simulator Modal / Drawer state
  const [testingResponder, setTestingResponder] = useState<AutoResponder | null>(null);
  const [simulatedInboundText, setSimulatedInboundText] = useState('');
  const [selectedTestLeadName, setSelectedTestLeadName] = useState('Jordan Vance');
  const [selectedTestRecipient, setSelectedTestRecipient] = useState('');
  const [simulationResult, setSimulationResult] = useState<{
    matched: boolean;
    replySent: string;
    channel: ChannelType;
    timestamp: string;
    receipt?: MessageDeliveryReceipt;
  } | null>(null);

  // Handle preselected list from Contact Lists view
  useEffect(() => {
    if (preselectedListName) {
      setSelectedListName(preselectedListName);
      if (onClearPreselectedList) onClearPreselectedList();
    }
  }, [preselectedListName, onClearPreselectedList]);

  // Filter special lists by keyword
  const filteredSpecialLists = useMemo(() => {
    const q = listKeywordSearch.trim().toLowerCase();
    if (!q) return allAvailableLists;
    return allAvailableLists.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        (l.defaultTags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [allAvailableLists, listKeywordSearch]);

  // Count contacts per list
  const getLeadCountForList = (listName: string) => {
    const clean = listName.trim().toLowerCase();
    return contacts.filter((c) => c.listName.trim().toLowerCase() === clean).length;
  };

  // Filtered saved Auto Responders
  const filteredAutoResponders = useMemo(() => {
    const q = librarySearchQuery.trim().toLowerCase();
    return autoResponders.filter((ar) => {
      if (libraryChannelFilter !== 'all' && ar.channel !== libraryChannelFilter) {
        return false;
      }
      if (
        libraryListFilter !== 'all' &&
        ar.targetList.trim().toLowerCase() !== libraryListFilter.trim().toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      return (
        ar.name.toLowerCase().includes(q) ||
        ar.targetList.toLowerCase().includes(q) ||
        ar.triggerMessage.toLowerCase().includes(q) ||
        ar.responseMessage.toLowerCase().includes(q) ||
        ar.channel.toLowerCase().includes(q)
      );
    });
  }, [autoResponders, librarySearchQuery, libraryChannelFilter, libraryListFilter]);

  // Summary metrics
  const liveCount = useMemo(
    () => autoResponders.filter((a) => a.status === 'live').length,
    [autoResponders]
  );
  const totalTriggered = useMemo(
    () => autoResponders.reduce((acc, a) => acc + (a.triggeredCount || 0), 0),
    [autoResponders]
  );
  const totalSent = useMemo(
    () => autoResponders.reduce((acc, a) => acc + (a.sentCount || 0), 0),
    [autoResponders]
  );
  const uniqueListsCovered = useMemo(
    () => new Set(autoResponders.map((a) => a.targetList.toLowerCase())).size,
    [autoResponders]
  );

  const handleQuickCreateSpecialList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpecialListName.trim()) return;
    setCreatingList(true);
    try {
      const cleanName = sanitizeString(newSpecialListName, 100, 'Special Auto-Responder List');
      await onCreateList({
        name: cleanName,
        description: sanitizeString(
          newSpecialListDesc,
          300,
          `Special list created for Auto Responder campaigns.`
        ),
        category: 'custom',
        defaultConsent: 'opted_in',
        defaultTags: ['auto-responder', 'special-list'],
        colorAccent: 'emerald',
      });
      setSelectedListName(cleanName);
      setNewSpecialListName('');
      setNewSpecialListDesc('');
      setShowQuickCreateList(false);
      setFeedbackBanner(
        `Special List "${cleanName}" created and selected! Now enter your Trigger Message and Auto-Response Message below.`
      );
    } finally {
      setCreatingList(false);
    }
  };

  const handleResetBuilder = () => {
    setEditingResponder(null);
    setResponderName('');
    setTriggerMessage('');
    setResponseMessage('');
    setSelectedChannel('whatsapp');
    setMatchType('contains');
    setSubjectLine('');
  };

  const handleEditResponder = (ar: AutoResponder) => {
    setEditingResponder(ar);
    setSelectedListName(ar.targetList);
    setResponderName(ar.name);
    setTriggerMessage(ar.triggerMessage);
    setResponseMessage(ar.responseMessage);
    setSelectedChannel(ar.channel);
    setMatchType(ar.matchType || 'contains');
    setSubjectLine(ar.subjectLine || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveAndGoLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListName.trim()) {
      setFeedbackBanner('Please choose or search a Special List in Step 1 before saving.');
      return;
    }
    if (!triggerMessage.trim() || !responseMessage.trim()) {
      setFeedbackBanner(
        'Please fill in both Message Box 1 (Trigger Message) and Message Box 2 (Auto-Response Message).'
      );
      return;
    }

    setSavingResponder(true);
    try {
      const cleanList = sanitizeString(selectedListName, 100, 'General Contacts');
      const cleanTrigger = sanitizeString(triggerMessage, 500, 'INFO');
      const cleanResponse = sanitizeString(responseMessage, 2000, 'Thank you for reaching out!');
      const autoGeneratedTitle =
        responderName.trim() ||
        `${CHANNEL_LABELS[selectedChannel]} Auto-Reply for ${cleanList} ("${cleanTrigger.slice(0, 28)}")`;
      const cleanTitle = sanitizeString(autoGeneratedTitle, 120, 'Auto Responder Rule');
      const cleanSubject =
        selectedChannel === 'email'
          ? sanitizeString(subjectLine, 160, `Re: ${cleanTrigger.slice(0, 50)}`)
          : '';

      if (editingResponder) {
        await onUpdateAutoResponder(editingResponder.id, {
          name: cleanTitle,
          targetList: cleanList,
          triggerMessage: cleanTrigger,
          responseMessage: cleanResponse,
          channel: selectedChannel,
          matchType,
          ...(cleanSubject ? { subjectLine: cleanSubject } : {}),
          status: 'live',
          triggeredCount: editingResponder.triggeredCount,
          sentCount: editingResponder.sentCount,
        });
        setFeedbackBanner(
          `Auto Responder "${cleanTitle}" updated and is LIVE on Auto-Pilot (${CHANNEL_LABELS[selectedChannel]}) for list "${cleanList}".`
        );
      } else {
        await onCreateAutoResponder({
          name: cleanTitle,
          targetList: cleanList,
          triggerMessage: cleanTrigger,
          responseMessage: cleanResponse,
          channel: selectedChannel,
          matchType,
          ...(cleanSubject ? { subjectLine: cleanSubject } : {}),
          status: 'live',
          triggeredCount: 0,
          sentCount: 0,
        });
        setFeedbackBanner(
          `Auto Responder "${cleanTitle}" is now LIVE on Auto-Pilot! Whenever a lead in "${cleanList}" sends "${cleanTrigger}", they will automatically receive your ${CHANNEL_LABELS[selectedChannel]} response.`
        );
      }

      handleResetBuilder();
    } finally {
      setSavingResponder(false);
    }
  };

  const handleToggleStatus = async (ar: AutoResponder) => {
    const nextStatus: AutoResponderStatus = ar.status === 'live' ? 'paused' : 'live';
    await onUpdateAutoResponder(ar.id, {
      name: ar.name,
      targetList: ar.targetList,
      triggerMessage: ar.triggerMessage,
      responseMessage: ar.responseMessage,
      channel: ar.channel,
      matchType: ar.matchType || 'contains',
      ...(ar.subjectLine ? { subjectLine: ar.subjectLine } : {}),
      status: nextStatus,
      triggeredCount: ar.triggeredCount,
      sentCount: ar.sentCount,
    });
    setFeedbackBanner(
      nextStatus === 'live'
        ? `Auto Responder "${ar.name}" is now LIVE on Auto-Pilot.`
        : `Auto Responder "${ar.name}" has been paused.`
    );
  };

  const handleOpenSimulator = (ar: AutoResponder) => {
    const listLeads = contacts.filter(
      (c) => c.listName.trim().toLowerCase() === ar.targetList.trim().toLowerCase()
    );
    const firstLead = listLeads[0] || contacts[0];
    setTestingResponder(ar);
    setSimulatedInboundText(ar.triggerMessage);
    setSelectedTestLeadName(firstLead?.fullName || 'Sample Lead');
    setSelectedTestRecipient(
      ar.channel === 'email'
        ? firstLead?.email || privateProfile?.email || 'lead@example.com'
        : firstLead?.phone ||
          privateProfile?.whatsappBusinessNumber ||
          '+1 (555) 234-8910'
    );
    setSimulationResult(null);
  };

  const handleQuickLiveSendResponder = async (ar: AutoResponder) => {
    const listLeads = contacts.filter(
      (c) => c.listName.trim().toLowerCase() === ar.targetList.trim().toLowerCase()
    );
    const eligibleLead =
      listLeads.find(
        (c) =>
          !evaluateListKillSwitchForContact(
            { tags: c.tags, listName: c.listName, stage: c.stage },
            lists,
            ar.targetList
          ).triggered
      ) ||
      listLeads[0] ||
      contacts[0];

    if (eligibleLead) {
      const ksCheck = evaluateListKillSwitchForContact(
        {
          tags: eligibleLead.tags,
          listName: eligibleLead.listName,
          stage: eligibleLead.stage,
        },
        lists,
        ar.targetList
      );
      if (ksCheck.triggered) {
        setFeedbackBanner(
          `List Kill Switch Halted Auto-Send for ${eligibleLead.fullName}: Contact has tag #${ksCheck.matchedTag} in "${ar.targetList}".`
        );
        return;
      }
    }

    const leadName = eligibleLead?.fullName || 'Sample Lead';
    const firstName = leadName.split(' ')[0] || 'Friend';
    const personalizedReply = ar.responseMessage
      .replace(/\{\{first_name\}\}/gi, firstName)
      .replace(/\{\{full_name\}\}/gi, leadName)
      .replace(/\{\{list_name\}\}/gi, ar.targetList);

    const toRecipient =
      ar.channel === 'email'
        ? eligibleLead?.email || privateProfile?.email || 'lead@example.com'
        : eligibleLead?.phone ||
          privateProfile?.whatsappBusinessNumber ||
          '+1 (555) 234-8910';

    const receipt = await deliverChannelMessage({
      channel: ar.channel,
      to: toRecipient,
      leadName,
      subject: ar.subjectLine || `Re: ${ar.triggerMessage.slice(0, 50)}`,
      body: personalizedReply,
      listName: ar.targetList,
      source: 'auto_responder',
      workspace,
      privateProfile,
    });

    await onUpdateAutoResponder(ar.id, {
      name: ar.name,
      targetList: ar.targetList,
      triggerMessage: ar.triggerMessage,
      responseMessage: ar.responseMessage,
      channel: ar.channel,
      matchType: ar.matchType || 'contains',
      ...(ar.subjectLine ? { subjectLine: ar.subjectLine } : {}),
      status: ar.status,
      triggeredCount: (ar.triggeredCount || 0) + 1,
      sentCount: (ar.sentCount || 0) + 1,
    });

    await onLogActivity(
      ar.channel === 'whatsapp' ? 'whatsapp_replied' : 'automation_triggered',
      `Live Auto-Responder Dispatched (${CHANNEL_LABELS[ar.channel]}): ${ar.name}`,
      `Sent to ${leadName} (${receipt.toRecipient}) via ${receipt.providerUsed} · From: ${receipt.fromIdentity}`,
      ar.channel
    );

    setFeedbackBanner(
      `Live ${CHANNEL_LABELS[ar.channel]} Auto-Reply Sent to ${leadName} (${receipt.toRecipient}) via ${receipt.providerUsed} (From: ${receipt.fromIdentity})!`
    );
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testingResponder || !simulatedInboundText.trim()) return;

    const matchedLeadObj = contacts.find(
      (c) =>
        c.fullName.trim().toLowerCase() === selectedTestLeadName.trim().toLowerCase()
    );
    if (matchedLeadObj) {
      const ksEval = evaluateListKillSwitchForContact(
        {
          tags: matchedLeadObj.tags,
          listName: matchedLeadObj.listName,
          stage: matchedLeadObj.stage,
        },
        lists,
        testingResponder.targetList
      );
      if (ksEval.triggered) {
        setFeedbackBanner(
          `List Kill Switch Stopped Auto-Responder for ${matchedLeadObj.fullName} (Tag #${ksEval.matchedTag}).`
        );
        return;
      }
    }

    const inboundClean = simulatedInboundText.trim().toLowerCase();
    const triggerClean = testingResponder.triggerMessage.trim().toLowerCase();
    const mode = testingResponder.matchType || 'contains';

    const isMatch =
      mode === 'any_inbound'
        ? true
        : mode === 'exact'
        ? inboundClean === triggerClean
        : inboundClean.includes(triggerClean) || triggerClean.includes(inboundClean);

    const firstName = selectedTestLeadName.split(' ')[0] || 'Friend';
    const personalizedReply = testingResponder.responseMessage
      .replace(/\{\{first_name\}\}/gi, firstName)
      .replace(/\{\{full_name\}\}/gi, selectedTestLeadName)
      .replace(/\{\{list_name\}\}/gi, testingResponder.targetList);

    let deliveryReceipt: MessageDeliveryReceipt | undefined;

    if (isMatch) {
      deliveryReceipt = await deliverChannelMessage({
        channel: testingResponder.channel,
        to:
          selectedTestRecipient.trim() ||
          (testingResponder.channel === 'email' ? 'lead@example.com' : '+1 (555) 234-8910'),
        leadName: selectedTestLeadName || 'Lead Contact',
        subject:
          testingResponder.subjectLine ||
          `Re: ${testingResponder.triggerMessage.slice(0, 50)}`,
        body: personalizedReply,
        listName: testingResponder.targetList,
        source: 'auto_responder',
        workspace,
        privateProfile,
      });

      await onUpdateAutoResponder(testingResponder.id, {
        name: testingResponder.name,
        targetList: testingResponder.targetList,
        triggerMessage: testingResponder.triggerMessage,
        responseMessage: testingResponder.responseMessage,
        channel: testingResponder.channel,
        matchType: testingResponder.matchType || 'contains',
        ...(testingResponder.subjectLine ? { subjectLine: testingResponder.subjectLine } : {}),
        status: testingResponder.status,
        triggeredCount: (testingResponder.triggeredCount || 0) + 1,
        sentCount: (testingResponder.sentCount || 0) + 1,
      });

      await onLogActivity(
        testingResponder.channel === 'whatsapp'
          ? 'whatsapp_replied'
          : 'automation_triggered',
        `Auto-Pilot Reply Sent (${CHANNEL_LABELS[testingResponder.channel]}): ${testingResponder.name}`,
        `Lead "${selectedTestLeadName}" (${deliveryReceipt.toRecipient}) in list "${testingResponder.targetList}" sent "${simulatedInboundText.slice(0, 60)}" → Delivered via ${deliveryReceipt.providerUsed} from ${deliveryReceipt.fromIdentity}.`,
        testingResponder.channel
      );

      setTestingResponder((prev) =>
        prev
          ? {
              ...prev,
              triggeredCount: (prev.triggeredCount || 0) + 1,
              sentCount: (prev.sentCount || 0) + 1,
            }
          : null
      );
    }

    if (onForwardToInbox) {
      await onForwardToInbox({
        leadName: selectedTestLeadName || 'Lead Contact',
        listName: testingResponder.targetList,
        channel: testingResponder.channel,
        leadMessage: simulatedInboundText.trim(),
        autoResponseSent: isMatch ? personalizedReply : undefined,
        responderName: testingResponder.name,
      });
    }

    setSimulationResult({
      matched: isMatch,
      replySent: personalizedReply,
      channel: testingResponder.channel,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      receipt: deliveryReceipt,
    });
  };

  const insertMergeTag = (tag: string) => {
    setResponseMessage((prev) => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}${tag}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Section Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>Auto-Pilot Lead Responder Engine</span>
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-950">
              Auto Responder
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
              Choose a special list you created or search by keyword, set the{' '}
              <strong className="text-slate-900">Trigger Message</strong> your lead will send and
              the <strong className="text-slate-900">Auto-Response Message</strong> that replies on
              auto-pilot, pick your delivery channel (WhatsApp, Email, or SMS), and save to go live.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onNavigateToLists}
              className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-700" />
              <span>Manage Special Lists ({allAvailableLists.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowQuickCreateList(true);
              }}
              className="px-3.5 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>+ New Special List</span>
            </button>
          </div>
        </div>

        {/* Clean Unboxed KPI Strip */}
        <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-slate-500 font-medium">Live Auto Responders</div>
            <div className="font-display text-xl font-bold text-slate-950 mt-0.5 tabular-nums">
              {liveCount}{' '}
              <span className="text-xs font-normal text-slate-500">
                / {autoResponders.length} total
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Special Lists Covered</div>
            <div className="font-display text-xl font-bold text-slate-950 mt-0.5 tabular-nums">
              {uniqueListsCovered}{' '}
              <span className="text-xs font-normal text-slate-500">active lists</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Lead Triggers Matched</div>
            <div className="font-display text-xl font-bold text-slate-950 mt-0.5 tabular-nums">
              {totalTriggered.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Auto-Pilot Replies Sent</div>
            <div className="font-display text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
              {totalSent.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Active Auto-Pilot Sender Identities Bar (WhatsApp, Email & SMS) */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-700">
            <span className="font-bold uppercase tracking-wider text-emerald-800">
              Active 3-Channel Auto-Pilot Identities:
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-900">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
              <span>WhatsApp From: {senderIdentities.whatsappBusinessNumber}</span>
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-900">
              <Mail className="w-3.5 h-3.5 text-emerald-700" />
              <span>
                Email From: {senderIdentities.activeSenderEmail} (
                {senderIdentities.activeEmailMode === 'custom_domain'
                  ? 'Custom Domain'
                  : 'Platform Default'}
                )
              </span>
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-900">
              <Phone className="w-3.5 h-3.5 text-amber-700" />
              <span>SMS From: {senderIdentities.smsSenderId}</span>
            </span>
          </div>

          {onNavigateToSettings && (
            <button
              type="button"
              onClick={onNavigateToSettings}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer self-start lg:self-auto shrink-0"
            >
              Configure WhatsApp, Email & SMS Connectors in Settings →
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs sm:text-sm text-emerald-950">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="font-medium">{feedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* AUTO RESPONDER BUILDER (STEP 1: SELECT LIST -> STEP 2: 2 BOXES + CHANNEL) */}
      {/* ===================================================================== */}
      <form
        onSubmit={handleSaveAndGoLive}
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-950">
              {editingResponder
                ? `Edit Auto Responder: ${editingResponder.name}`
                : 'Create New Auto Responder'}
            </h2>
            <p className="text-xs text-slate-500">
              Complete Step 1 (Choose Special List) and Step 2 (Trigger Message Box, Auto-Response
              Message Box & Channel Dropdown) then click Save & Go Live.
            </p>
          </div>
          {editingResponder && (
            <button
              type="button"
              onClick={handleResetBuilder}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer self-start"
            >
              Cancel Edit
            </button>
          )}
        </div>

        {/* STEP 1: CHOOSE A SPECIAL LIST OR SEARCH BY KEYWORD */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Step 1 · Select Special List First
              </span>
              <h3 className="font-display text-sm sm:text-base font-bold text-slate-950 mt-0.5">
                Choose a Special List You Created or Search by Keyword
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowQuickCreateList(!showQuickCreateList)}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 cursor-pointer self-start"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showQuickCreateList ? 'Close List Creator' : 'Create a New Special List'}</span>
            </button>
          </div>

          {/* Optional Inline Special List Creator */}
          {showQuickCreateList && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-900">
                Create a New Special List for Your Auto Responder
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Special List Name *
                  </label>
                  <input
                    type="text"
                    value={newSpecialListName}
                    onChange={(e) => setNewSpecialListName(e.target.value)}
                    placeholder="e.g., VIP WhatsApp Leads, Coaching Waitlist..."
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description / Keyword Notes
                  </label>
                  <input
                    type="text"
                    value={newSpecialListDesc}
                    onChange={(e) => setNewSpecialListDesc(e.target.value)}
                    placeholder="Optional notes for searching this list"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={creatingList || !newSpecialListName.trim()}
                  onClick={handleQuickCreateSpecialList}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] disabled:opacity-50 rounded-xl cursor-pointer"
                >
                  {creatingList ? 'Creating Special List...' : 'Save & Select This Special List'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickCreateList(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Search by Keyword + Direct Special List Dropdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Search Special Lists by Keyword
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={listKeywordSearch}
                  onChange={(e) => setListKeywordSearch(e.target.value)}
                  placeholder="Type keyword to search your lists (e.g. VIP, webinar, buyers)..."
                  className="w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
                {listKeywordSearch && (
                  <button
                    type="button"
                    onClick={() => setListKeywordSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Or Choose Directly from Your Special Lists Dropdown *
              </label>
              <select
                value={selectedListName}
                onChange={(e) => setSelectedListName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="">-- Select a Special List ({filteredSpecialLists.length} available) --</option>
                {filteredSpecialLists.map((lst) => (
                  <option key={lst.id} value={lst.name}>
                    {lst.name} ({getLeadCountForList(lst.name)} leads · {lst.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clickable Special List Cards (Filtered by Keyword Search) */}
          {filteredSpecialLists.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
              {filteredSpecialLists.map((lst) => {
                const isSelected =
                  selectedListName.trim().toLowerCase() === lst.name.trim().toLowerCase();
                const count = getLeadCountForList(lst.name);
                return (
                  <button
                    key={lst.id}
                    type="button"
                    onClick={() => setSelectedListName(lst.name)}
                    className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-emerald-50/90 border-emerald-600 ring-2 ring-emerald-600/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-bold text-xs sm:text-sm text-slate-950 truncate flex items-center gap-1.5">
                        <Layers
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{lst.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {count} {count === 1 ? 'lead' : 'leads'} · {lst.category.replace('_', ' ')}
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-emerald-700 text-white'
                          : 'border border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                {listKeywordSearch ? (
                  <span>
                    No special lists matched keyword <strong>"{listKeywordSearch}"</strong>.
                  </span>
                ) : (
                  <span>
                    You haven't created a special contact list yet. Create one right now to attach
                    your Auto Responder.
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewSpecialListName(listKeywordSearch || 'VIP Auto-Responder Leads');
                  setShowQuickCreateList(true);
                }}
                className="px-3.5 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer shrink-0"
              >
                + Create "{listKeywordSearch || 'New Special List'}"
              </button>
            </div>
          )}

          {/* Active Selected List Status Pill Bar */}
          {selectedListName && (
            <div className="p-3 rounded-xl bg-emerald-950 text-white flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Target Special List Selected:{' '}
                  <strong className="text-emerald-300">{selectedListName}</strong> (
                  {getLeadCountForList(selectedListName)} leads in list)
                </span>
              </div>
              <span className="text-emerald-300 font-semibold">
                Ready for Step 2: Configure Trigger & Auto-Pilot Response ↓
              </span>
            </div>
          )}
        </div>

        {/* STEP 2: TWO MESSAGE BOXES + CHANNEL DROPDOWN + SAVE TO GO LIVE */}
        <div
          className={`space-y-5 pt-5 border-t border-slate-200 transition-opacity ${
            !selectedListName ? 'opacity-75' : 'opacity-100'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Step 2 · Trigger Message, Auto-Response Message & Channel
              </span>
              <h3 className="font-display text-sm sm:text-base font-bold text-slate-950 mt-0.5">
                Configure Your Two Message Boxes & Delivery Channel
              </h3>
            </div>
            {!selectedListName && (
              <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
                Select a Special List in Step 1 above first
              </span>
            )}
          </div>

          {/* Two Message Boxes Side-by-Side on Desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* MESSAGE BOX 1: TRIGGER MESSAGE THAT LEAD WILL SEND */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs sm:text-sm font-bold text-slate-950 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-slate-900 text-white text-[11px] font-bold inline-flex items-center justify-center">
                      1
                    </span>
                    <span>Trigger Message (Message Lead Will Send) *</span>
                  </label>
                  <select
                    value={matchType}
                    onChange={(e) => setMatchType(e.target.value as AutoResponderMatchType)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded-lg text-slate-700"
                    title="How to match the lead's message"
                  >
                    <option value="contains">Contains Keyword / Phrase</option>
                    <option value="exact">Exact Message Match</option>
                    <option value="any_inbound">Any Message From Lead</option>
                  </select>
                </div>
                <p className="text-xs text-slate-600">
                  Input the message or keyword that a lead in{' '}
                  <strong>{selectedListName || 'your selected list'}</strong> will send to trigger
                  this Auto Response:
                </p>
                <textarea
                  rows={5}
                  required
                  value={triggerMessage}
                  onChange={(e) => setTriggerMessage(e.target.value)}
                  placeholder='Example: "Hi, please send me the blueprint" or "INFO" or "PRICE"'
                  className="w-full p-3.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-emerald-600 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Quick sample triggers */}
              <div className="pt-1">
                <div className="text-[11px] font-semibold text-slate-500 mb-1.5">
                  Quick Trigger Examples (Click to insert):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TRIGGER_EXAMPLES.map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => setTriggerMessage(sample)}
                      className="px-2.5 py-1 text-[11px] font-medium bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      "{sample}"
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* MESSAGE BOX 2: AUTO-RESPONSE MESSAGE SENT TO LEAD ON AUTO-PILOT */}
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs sm:text-sm font-bold text-slate-950 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-[#047857] text-white text-[11px] font-bold inline-flex items-center justify-center">
                      2
                    </span>
                    <span>Auto-Response Message (Sent on Auto-Pilot) *</span>
                  </label>
                  <span className="text-[11px] font-bold text-emerald-800">
                    Auto-Pilot Reply
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Input the automated response message that will immediately go out to the lead on
                  auto-pilot when their message matches Box 1:
                </p>
                <textarea
                  rows={5}
                  required
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  placeholder='Example: "Hey {{first_name}}! Thanks for messaging us. Here is your direct access link: https://flowpilot.app/?capture=vip-access"'
                  className="w-full p-3.5 text-xs sm:text-sm bg-white border border-emerald-300 rounded-xl text-slate-900 focus:border-emerald-700 focus:outline-none leading-relaxed"
                />

                {/* Outgoing Sender Identity Preview inside Box 2 */}
                <div className="p-2.5 rounded-xl bg-white border border-emerald-200/90 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="text-slate-700">
                    <span className="font-bold text-emerald-900">
                      Lead Sees Auto-Pilot Message Coming From:{' '}
                    </span>
                    <span className="font-mono font-semibold text-slate-950">
                      {getChannelFromDisplay(selectedChannel)}
                    </span>
                  </div>
                  {onNavigateToSettings && (
                    <button
                      type="button"
                      onClick={onNavigateToSettings}
                      className="font-bold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Change in Settings
                    </button>
                  )}
                </div>
              </div>

              {/* Personalization variables */}
              <div className="pt-1">
                <div className="text-[11px] font-semibold text-slate-600 mb-1.5">
                  Insert Lead Personalization Tag:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['{{first_name}}', '{{full_name}}', '{{list_name}}'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertMergeTag(tag)}
                      className="px-2.5 py-1 text-[11px] font-mono font-semibold bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CHANNEL DROPDOWN (WHATSAPP / EMAIL / SMS) + OPTIONAL NAME + SAVE & GO LIVE */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Channel Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Auto-Response Message Channel (Dropdown) *
                </label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value as ChannelType)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold bg-white border-2 border-emerald-600 rounded-xl text-slate-950 focus:outline-none cursor-pointer"
                >
                  <option value="whatsapp">WhatsApp (Auto-Pilot WhatsApp Reply)</option>
                  <option value="email">Email (Auto-Pilot Email Reply)</option>
                  <option value="sms">SMS (Auto-Pilot Text Message Reply)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Choose whether the auto response goes via WhatsApp, Email, or SMS.
                </p>
              </div>

              {/* Optional Rule Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Auto Responder Label (Optional)
                </label>
                <input
                  type="text"
                  value={responderName}
                  onChange={(e) => setResponderName(e.target.value)}
                  placeholder={
                    selectedListName
                      ? `e.g., ${selectedListName} ${CHANNEL_LABELS[selectedChannel]} Auto-Reply`
                      : 'e.g., VIP Pricing Inquiry Auto-Responder'
                  }
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl text-slate-900"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Auto-named from your list & trigger if left blank.
                </p>
              </div>

              {/* Email Subject Line if Email channel is selected, otherwise Summary Preview */}
              {selectedChannel === 'email' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Auto-Response Email Subject Line
                  </label>
                  <input
                    type="text"
                    value={subjectLine}
                    onChange={(e) => setSubjectLine(e.target.value)}
                    placeholder="e.g., Re: Here is the information you requested"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Subject line used when sending the Email auto-response.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col justify-center p-3 rounded-xl bg-white border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-500">
                    Active Configuration Summary
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                    List: {selectedListName || 'None selected yet'}
                  </div>
                  <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                    Channel: {CHANNEL_LABELS[selectedChannel]} · Goes Live Immediately
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                {selectedListName ? (
                  <span>
                    Ready to activate for{' '}
                    <strong className="text-slate-900">{selectedListName}</strong> via{' '}
                    <strong className="text-emerald-700">{CHANNEL_LABELS[selectedChannel]}</strong>.
                  </span>
                ) : (
                  <span className="text-amber-800 font-medium">
                    Please select a Special List in Step 1 above before saving.
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  savingResponder ||
                  !selectedListName.trim() ||
                  !triggerMessage.trim() ||
                  !responseMessage.trim()
                }
                className="px-6 py-3 text-xs sm:text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] disabled:opacity-50 rounded-xl transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Zap className="w-4 h-4" />
                <span>
                  {savingResponder
                    ? 'Saving & Going Live...'
                    : editingResponder
                    ? 'Save Changes & Go Live'
                    : 'Save & Go Live on Auto-Pilot'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* ===================================================================== */}
      {/* LIVE & SAVED AUTO RESPONDERS DIRECTORY                                */}
      {/* ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-950">
              Your Live & Saved Auto Responders ({filteredAutoResponders.length})
            </h2>
            <p className="text-xs text-slate-500">
              Test any Auto Responder on auto-pilot, edit the trigger or response messages, pause,
              or delete.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={librarySearchQuery}
                onChange={(e) => setLibrarySearchQuery(e.target.value)}
                placeholder="Search by keyword, list, or trigger..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <select
              value={libraryListFilter}
              onChange={(e) => setLibraryListFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
            >
              <option value="all">All Special Lists</option>
              {allAvailableLists.map((lst) => (
                <option key={lst.id} value={lst.name}>
                  List: {lst.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['all', 'whatsapp', 'email', 'sms'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setLibraryChannelFilter(ch)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    libraryChannelFilter === ch
                      ? 'bg-white text-slate-950 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {ch === 'all' ? 'All Channels' : CHANNEL_LABELS[ch]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredAutoResponders.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-300 space-y-2">
            <div className="font-display text-sm font-bold text-slate-900">
              No Auto Responders Created Yet
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Use the builder above: first choose or search a Special List in Step 1, enter your
              Trigger Message and Auto-Response Message in Step 2, select WhatsApp, Email, or SMS
              from the dropdown, and click Save & Go Live.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAutoResponders.map((ar) => {
              const isLive = ar.status === 'live';
              const ChannelIcon =
                ar.channel === 'whatsapp'
                  ? MessageSquare
                  : ar.channel === 'email'
                  ? Mail
                  : Phone;

              return (
                <div
                  key={ar.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all space-y-4"
                >
                  {/* Top Metadata & Action Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span
                          className={`font-bold uppercase tracking-wider ${
                            isLive ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {isLive ? '● LIVE ON AUTO-PILOT' : '○ PAUSED'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-slate-800 inline-flex items-center gap-1">
                          <ChannelIcon className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{CHANNEL_LABELS[ar.channel]} Channel</span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-slate-800 inline-flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-slate-500" />
                          <span>Special List: {ar.targetList}</span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {ar.triggeredCount} triggered / {ar.sentCount} auto-sent
                        </span>
                      </div>
                      <h3 className="font-display text-base font-bold text-slate-950 truncate">
                        {ar.name}
                      </h3>
                    </div>

                    {/* Card Controls: Live Send Now, Test Auto-Pilot, Edit, Pause/Go Live, Delete */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleQuickLiveSendResponder(ar)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Live Send {CHANNEL_LABELS[ar.channel]}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenSimulator(ar)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Zap className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Test Trigger</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEditResponder(ar)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(ar)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        {isLive ? (
                          <>
                            <Pause className="w-3.5 h-3.5 text-amber-700" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Go Live</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteAutoResponder(ar.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                        title="Delete Auto Responder"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Two Message Boxes Preview: Trigger Message -> Auto-Response Message */}
                  <div className="grid grid-cols-1 lg:grid-cols-11 gap-3 items-stretch">
                    <div className="lg:col-span-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        1. Lead Trigger Message ({ar.matchType || 'contains'})
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-slate-900 whitespace-pre-wrap">
                        "{ar.triggerMessage}"
                      </p>
                    </div>

                    <div className="lg:col-span-1 flex items-center justify-center text-emerald-700">
                      <ArrowRight className="w-5 h-5 rotate-90 lg:rotate-0" />
                    </div>

                    <div className="lg:col-span-5 p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                        2. Auto-Pilot Response via {CHANNEL_LABELS[ar.channel]}
                      </div>
                      <div className="text-[11px] font-mono font-semibold text-emerald-950 bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-200/70">
                        From: {getChannelFromDisplay(ar.channel)}
                      </div>
                      {ar.channel === 'email' && ar.subjectLine && (
                        <div className="text-xs font-bold text-slate-800">
                          Subject: {ar.subjectLine}
                        </div>
                      )}
                      <p className="text-xs sm:text-sm text-slate-900 whitespace-pre-wrap">
                        {ar.responseMessage}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* INTERACTIVE AUTO-PILOT TEST SIMULATOR MODAL                           */}
      {/* ===================================================================== */}
      {testingResponder && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Live Auto-Pilot Simulator · {CHANNEL_LABELS[testingResponder.channel]}
                </div>
                <h3 className="font-display text-lg font-bold text-slate-950 mt-0.5">
                  {testingResponder.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Special List: <strong>{testingResponder.targetList}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTestingResponder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRunSimulation} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lead Name in "{testingResponder.targetList}"
                  </label>
                  <input
                    type="text"
                    value={selectedTestLeadName}
                    onChange={(e) => setSelectedTestLeadName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {testingResponder.channel === 'email'
                      ? 'Lead Email Address (To:)'
                      : `Lead ${CHANNEL_LABELS[testingResponder.channel]} Phone (To:)`}
                  </label>
                  <input
                    type={testingResponder.channel === 'email' ? 'email' : 'tel'}
                    value={selectedTestRecipient}
                    onChange={(e) => setSelectedTestRecipient(e.target.value)}
                    placeholder={
                      testingResponder.channel === 'email'
                        ? 'lead@example.com'
                        : '+1 (555) 234-8910'
                    }
                    className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Inbound Message Sent by Lead (Expected Trigger: "{testingResponder.triggerMessage}")
                </label>
                <textarea
                  rows={3}
                  value={simulatedInboundText}
                  onChange={(e) => setSimulatedInboundText(e.target.value)}
                  className="w-full p-3 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSimulatedInboundText(testingResponder.triggerMessage);
                    setSimulationResult(null);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Trigger</span>
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Lead Message & Deliver Auto-Response</span>
                </button>
              </div>
            </form>

            {simulationResult && (
              <div
                className={`p-4 rounded-xl border space-y-2.5 ${
                  simulationResult.matched
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span
                    className={
                      simulationResult.matched ? 'text-emerald-900' : 'text-amber-900'
                    }
                  >
                    {simulationResult.matched
                      ? `✓ Trigger Matched! Auto-Response Delivered via ${CHANNEL_LABELS[simulationResult.channel]}`
                      : '✕ Message Did Not Match Trigger Phrase'}
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    {simulationResult.timestamp}
                  </span>
                </div>
                {simulationResult.matched ? (
                  <div className="p-3 rounded-lg bg-white border border-emerald-200 text-xs sm:text-sm text-slate-900 space-y-2">
                    <div className="text-[11px] font-mono font-bold text-emerald-800 border-b border-slate-100 pb-1.5 space-y-0.5">
                      <div>From: {getChannelFromDisplay(simulationResult.channel)}</div>
                      {simulationResult.receipt && (
                        <div className="text-slate-600">
                          To: {simulationResult.receipt.toRecipient} · Gateway:{' '}
                          {simulationResult.receipt.providerUsed} · Receipt:{' '}
                          {simulationResult.receipt.receiptId}
                        </div>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap">{simulationResult.replySent}</div>
                    {simulationResult.receipt && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-emerald-800 font-semibold">
                          ✓ Dispatched through multi-channel gateway
                        </span>
                        <a
                          href={simulationResult.receipt.directLaunchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-[11px] font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg inline-flex items-center gap-1"
                        >
                          <span>
                            Launch in {CHANNEL_LABELS[simulationResult.channel]} App
                          </span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-800">
                    Try including the trigger phrase{' '}
                    <strong>"{testingResponder.triggerMessage}"</strong> to fire the auto-response.
                  </p>
                )}
                {onNavigateToInbox && (
                  <div className="pt-2 flex items-center justify-between border-t border-emerald-200/70">
                    <span className="text-[11px] text-slate-600">
                      This lead reply has also been delivered to your <strong>Inbox</strong>.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTestingResponder(null);
                        onNavigateToInbox();
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg cursor-pointer"
                    >
                      Reply Manually in Inbox →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
