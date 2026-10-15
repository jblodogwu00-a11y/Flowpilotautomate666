import React, { useState, useMemo, useEffect } from 'react';
import {
  Inbox,
  Search,
  MessageSquare,
  Mail,
  Phone,
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  User,
  Layers,
  RefreshCw,
  ArrowRight,
  Clock,
  Check,
  X,
  CornerDownRight,
  ExternalLink,
} from 'lucide-react';
import {
  InboxThread,
  InboxMessageItem,
  Contact,
  AudienceList,
  Campaign,
  AutoResponder,
  ChannelType,
  ActivityLog,
  Workspace,
  UserPrivateProfile,
  generateSafeId,
  sanitizeString,
  resolveWorkspaceSenderIdentities,
} from '../types';
import {
  deliverChannelMessage,
  buildDirectChannelUrl,
  MessageDeliveryReceipt,
} from '../services/messageDeliveryService';

interface InboxViewProps {
  threads: InboxThread[];
  contacts: Contact[];
  lists: AudienceList[];
  campaigns: Campaign[];
  autoResponders: AutoResponder[];
  senderName: string;
  workspace?: Workspace;
  privateProfile?: UserPrivateProfile;
  onNavigateToSettings?: () => void;
  onCreateThread: (
    data: Omit<InboxThread, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<string>;
  onUpdateThread: (
    id: string,
    data: Omit<InboxThread, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onDeleteThread: (id: string) => Promise<void>;
  onCreateContact: (
    data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onLogActivity: (
    eventType: ActivityLog['eventType'],
    title: string,
    detail: string,
    channel: ActivityLog['channel']
  ) => Promise<void>;
}

const CHANNEL_LABELS: Record<ChannelType, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
};

const QUICK_MANUAL_REPLIES: { label: string; text: string }[] = [
  {
    label: 'Send Direct Link',
    text: 'Hi {{first_name}}, thanks for replying! Here is the direct link you requested: https://flowpilot.app/access — let me know if you have any questions.',
  },
  {
    label: 'Answer Pricing Question',
    text: 'Hi {{first_name}}, great hearing from you! I have shared our full breakdown below. Would you like to hop on a quick 10-minute call today?',
  },
  {
    label: 'Confirm Booking',
    text: 'Thank you for confirming, {{first_name}}! I have locked in your spot and sent the details to your inbox.',
  },
];

export function parseThreadMessages(messagesJson: string): InboxMessageItem[] {
  try {
    const parsed = JSON.parse(messagesJson);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // fallback if JSON is malformed
  }
  return [];
}

export const InboxView: React.FC<InboxViewProps> = ({
  threads,
  contacts,
  lists,
  campaigns,
  autoResponders,
  senderName,
  workspace,
  privateProfile,
  onNavigateToSettings,
  onCreateThread,
  onUpdateThread,
  onDeleteThread,
  onCreateContact,
  onLogActivity,
}) => {
  const senderIdentities = useMemo(
    () => resolveWorkspaceSenderIdentities(workspace, privateProfile),
    [workspace, privateProfile]
  );

  const getOutboundSenderLabel = (ch: ChannelType): string => {
    if (ch === 'whatsapp') {
      return `${senderIdentities.whatsappBusinessNumber} (${senderName || 'Workspace'})`;
    }
    if (ch === 'email') {
      return `${senderIdentities.emailDisplaySender} (${
        senderIdentities.activeEmailMode === 'custom_domain'
          ? 'Custom Domain'
          : 'Platform Default'
      })`;
    }
    return `${senderIdentities.smsSenderId} (${senderName || 'Workspace'})`;
  };
  // Left-pane filters
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | ChannelType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'replied'>('all');

  // Selected thread ID
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // Manual Reply Composer state
  const [replyChannel, setReplyChannel] = useState<ChannelType>('whatsapp');
  const [selectedSenderIdentityId, setSelectedSenderIdentityId] = useState<string>('default');
  const [replySubject, setReplySubject] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const channelSavedIdentities = useMemo(
    () => senderIdentities.allIdentities.filter((i) => i.channel === replyChannel),
    [senderIdentities.allIdentities, replyChannel]
  );

  const activeChosenIdentity = useMemo(
    () =>
      channelSavedIdentities.find((i) => i.id === selectedSenderIdentityId) ||
      channelSavedIdentities.find((i) => i.isDefault) ||
      null,
    [channelSavedIdentities, selectedSenderIdentityId]
  );

  // Feedback banner
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // "Receive / Log Incoming Lead Reply" Modal / Drawer state
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [incomingContactId, setIncomingContactId] = useState<string>('custom');
  const [incomingLeadName, setIncomingLeadName] = useState('');
  const [incomingLeadEmail, setIncomingLeadEmail] = useState('');
  const [incomingLeadPhone, setIncomingLeadPhone] = useState('');
  const [incomingListName, setIncomingListName] = useState('');
  const [incomingChannel, setIncomingChannel] = useState<ChannelType>('whatsapp');
  const [incomingContext, setIncomingContext] = useState('');
  const [incomingOutboundMsg, setIncomingOutboundMsg] = useState('');
  const [incomingLeadReply, setIncomingLeadReply] = useState('');
  const [submittingIncoming, setSubmittingIncoming] = useState(false);
  const [lastDeliveryReceipt, setLastDeliveryReceipt] = useState<MessageDeliveryReceipt | null>(
    null
  );

  // Available list names
  const availableListNames = useMemo(() => {
    const names = new Set<string>();
    lists.forEach((l) => {
      if (l.name.trim()) names.add(l.name.trim());
    });
    contacts.forEach((c) => {
      if (c.listName.trim()) names.add(c.listName.trim());
    });
    if (names.size === 0) names.add('General Contacts');
    return Array.from(names);
  }, [lists, contacts]);

  // Filtered threads sorted with unread & newest first
  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return threads
      .filter((t) => {
        if (channelFilter !== 'all' && t.channel !== channelFilter) return false;
        if (statusFilter === 'unread' && t.status !== 'unread' && t.unreadCount === 0) {
          return false;
        }
        if (statusFilter === 'replied' && t.status !== 'replied') return false;
        if (!q) return true;
        return (
          t.leadName.toLowerCase().includes(q) ||
          t.leadEmail.toLowerCase().includes(q) ||
          t.leadPhone.toLowerCase().includes(q) ||
          t.listName.toLowerCase().includes(q) ||
          t.subjectOrContext.toLowerCase().includes(q) ||
          t.lastLeadMessage.toLowerCase().includes(q) ||
          t.lastMessagePreview.toLowerCase().includes(q)
        );
      });
  }, [threads, searchQuery, channelFilter, statusFilter]);

  // Keep selectedThreadId valid
  useEffect(() => {
    if (threads.length === 0) {
      setSelectedThreadId(null);
      return;
    }
    if (!selectedThreadId || !threads.some((t) => t.id === selectedThreadId)) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  // Automatically sync the manual reply channel & subject whenever the user selects a thread
  // so that the user automatically replies in the exact message channel the lead used!
  useEffect(() => {
    if (activeThread) {
      setReplyChannel(activeThread.channel);
      setSelectedSenderIdentityId('default');
      const baseSubj = activeThread.subjectOrContext.startsWith('Re:')
        ? activeThread.subjectOrContext
        : `Re: ${activeThread.subjectOrContext}`;
      setReplySubject(baseSubj);
    }
  }, [activeThread?.id, activeThread?.channel, activeThread?.subjectOrContext]);

  const activeMessages = useMemo(
    () => (activeThread ? parseThreadMessages(activeThread.messagesJson) : []),
    [activeThread]
  );

  // Summary metrics
  const totalThreads = threads.length;
  const unreadThreadsCount = useMemo(
    () => threads.filter((t) => t.status === 'unread' || t.unreadCount > 0).length,
    [threads]
  );
  const repliedThreadsCount = useMemo(
    () => threads.filter((t) => t.status === 'replied').length,
    [threads]
  );
  const whatsappCount = useMemo(
    () => threads.filter((t) => t.channel === 'whatsapp').length,
    [threads]
  );
  const emailCount = useMemo(
    () => threads.filter((t) => t.channel === 'email').length,
    [threads]
  );
  const smsCount = useMemo(
    () => threads.filter((t) => t.channel === 'sms').length,
    [threads]
  );

  // Helper to personalize merge tags in manual reply
  const resolveMergeTags = (rawText: string, thread: InboxThread): string => {
    const firstName = thread.leadName.trim().split(' ')[0] || 'there';
    return rawText
      .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
      .replace(/\{\{\s*full_name\s*\}\}/gi, thread.leadName)
      .replace(/\{\{\s*list_name\s*\}\}/gi, thread.listName);
  };

  // Send Manual Reply in the Lead's Channel (WhatsApp, Email, or SMS)
  const handleSendManualReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || !replyMessage.trim()) return;

    setSendingReply(true);
    try {
      const personalizedBody = resolveMergeTags(replyMessage.trim(), activeThread);
      const nowFormatted = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const chosenFromValue =
        activeChosenIdentity?.value ||
        (replyChannel === 'whatsapp'
          ? senderIdentities.whatsappBusinessNumber
          : replyChannel === 'email'
          ? senderIdentities.activeSenderEmail
          : senderIdentities.smsSenderId);
      const chosenSenderDisplayName =
        activeChosenIdentity?.senderName || senderName || 'You';

      const newMsg: InboxMessageItem = {
        id: generateSafeId('msg'),
        sender: 'operator',
        senderName: `${chosenSenderDisplayName} · From: ${chosenFromValue}`,
        channel: replyChannel,
        ...(replyChannel === 'email' && replySubject.trim()
          ? { subject: replySubject.trim().slice(0, 160) }
          : {}),
        body: personalizedBody.slice(0, 2000),
        timestamp: `Today, ${nowFormatted}`,
      };

      const existingHistory = parseThreadMessages(activeThread.messagesJson);
      const updatedHistory = [...existingHistory, newMsg];
      let serializedHistory = JSON.stringify(updatedHistory);
      if (serializedHistory.length > 19500) {
        serializedHistory = JSON.stringify(updatedHistory.slice(-15));
      }

      const preview = `You (${CHANNEL_LABELS[replyChannel]}): ${personalizedBody}`.slice(0, 500);

      await onUpdateThread(activeThread.id, {
        leadName: activeThread.leadName,
        leadEmail: activeThread.leadEmail,
        leadPhone: activeThread.leadPhone,
        listName: activeThread.listName,
        channel: replyChannel,
        subjectOrContext:
          replyChannel === 'email' && replySubject.trim()
            ? sanitizeString(replySubject, 160, activeThread.subjectOrContext)
            : activeThread.subjectOrContext,
        lastLeadMessage: activeThread.lastLeadMessage,
        lastMessagePreview: preview,
        lastSender: 'operator',
        status: 'replied',
        unreadCount: 0,
        messagesJson: serializedHistory,
      });

      await onLogActivity(
        'whatsapp_replied',
        `Manual ${CHANNEL_LABELS[replyChannel]} Reply Sent to ${activeThread.leadName}`,
        `Channel: ${CHANNEL_LABELS[replyChannel]} · From: ${chosenFromValue} · List: "${activeThread.listName}" · Message: "${personalizedBody.slice(0, 90)}"`,
        replyChannel
      );

      // Dispatch through backend multi-channel delivery engine (WhatsApp / Email / SMS)
      const recipientAddress =
        replyChannel === 'email'
          ? activeThread.leadEmail || 'lead@example.com'
          : activeThread.leadPhone || '+1 (555) 234-8910';

      const receipt = await deliverChannelMessage({
        channel: replyChannel,
        to: recipientAddress,
        leadName: activeThread.leadName,
        subject:
          replyChannel === 'email'
            ? replySubject.trim() || activeThread.subjectOrContext
            : activeThread.subjectOrContext,
        body: personalizedBody,
        listName: activeThread.listName,
        source: 'inbox_manual',
        overrideFromIdentity: chosenFromValue,
        overrideSenderName: chosenSenderDisplayName,
        overrideReplyToEmail: activeChosenIdentity?.replyToEmail,
        workspace,
        privateProfile,
      });

      setLastDeliveryReceipt(receipt);
      setReplyMessage('');
      setFeedbackBanner(
        `Delivered via ${receipt.providerUsed}! From: ${receipt.fromIdentity} → To: ${receipt.toRecipient} (${activeThread.leadName}).`
      );
    } finally {
      setSendingReply(false);
    }
  };

  // Mark thread as read / unread
  const handleToggleReadStatus = async (thread: InboxThread) => {
    const isCurrentlyUnread = thread.status === 'unread' || thread.unreadCount > 0;
    await onUpdateThread(thread.id, {
      leadName: thread.leadName,
      leadEmail: thread.leadEmail,
      leadPhone: thread.leadPhone,
      listName: thread.listName,
      channel: thread.channel,
      subjectOrContext: thread.subjectOrContext,
      lastLeadMessage: thread.lastLeadMessage,
      lastMessagePreview: thread.lastMessagePreview,
      lastSender: thread.lastSender,
      status: isCurrentlyUnread ? 'replied' : 'unread',
      unreadCount: isCurrentlyUnread ? 0 : 1,
      messagesJson: thread.messagesJson,
    });
  };

  // Simulate or log a new follow-up reply from the lead inside the currently open thread
  const handleSimulateFollowUpFromLead = async (thread: InboxThread) => {
    const sampleFollowUps: Record<ChannelType, string> = {
      whatsapp:
        'Thank you for getting back to me on WhatsApp! Can you confirm what time works best for us to get started today?',
      email:
        'Thanks for your email reply! I reviewed the details you shared and I am ready to move forward. What is the next step?',
      sms:
        'Got your text message! Yes, please send over the link so I can complete it right now.',
    };

    const followUpBody = sampleFollowUps[thread.channel];
    const nowFormatted = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const leadMsg: InboxMessageItem = {
      id: generateSafeId('msg'),
      sender: 'lead',
      senderName: thread.leadName,
      channel: thread.channel,
      body: followUpBody,
      timestamp: `Today, ${nowFormatted}`,
    };

    const existingHistory = parseThreadMessages(thread.messagesJson);
    const updatedHistory = [...existingHistory, leadMsg];
    let serializedHistory = JSON.stringify(updatedHistory);
    if (serializedHistory.length > 19500) {
      serializedHistory = JSON.stringify(updatedHistory.slice(-15));
    }

    await onUpdateThread(thread.id, {
      leadName: thread.leadName,
      leadEmail: thread.leadEmail,
      leadPhone: thread.leadPhone,
      listName: thread.listName,
      channel: thread.channel,
      subjectOrContext: thread.subjectOrContext,
      lastLeadMessage: followUpBody,
      lastMessagePreview: `${thread.leadName}: ${followUpBody}`.slice(0, 500),
      lastSender: 'lead',
      status: 'unread',
      unreadCount: (thread.unreadCount || 0) + 1,
      messagesJson: serializedHistory,
    });

    setFeedbackBanner(
      `New incoming ${CHANNEL_LABELS[thread.channel]} reply received from ${thread.leadName}! You can reply manually below.`
    );
  };

  // 1-Click Quick Generator for testing incoming lead replies on WhatsApp, Email, or SMS
  const handleQuickReceiveChannelReply = async (channel: ChannelType) => {
    const matchedContact = contacts[0];
    const defaultList = matchedContact?.listName || lists[0]?.name || 'VIP Priority Leads';

    const presets: Record<
      ChannelType,
      {
        name: string;
        email: string;
        phone: string;
        subjectOrContext: string;
        outboundMsg: string;
        leadReply: string;
      }
    > = {
      whatsapp: {
        name: matchedContact?.fullName || 'Elena Rostova',
        email: matchedContact?.email || 'elena.rostova@atelier.co',
        phone: matchedContact?.phone || '+1 (555) 234-8910',
        subjectOrContext: campaigns[0]?.name || 'WhatsApp VIP Strategy Invitation',
        outboundMsg:
          'Hi! We just opened 3 priority onboarding spots for this week. Reply INFO on WhatsApp if you want the private link.',
        leadReply:
          'Hi! I just saw your WhatsApp message. Yes, please send me the details and the link to join!',
      },
      email: {
        name: matchedContact?.fullName || 'Marcus Vance',
        email: matchedContact?.email || 'marcus@vanceadvisory.io',
        phone: matchedContact?.phone || '+1 (555) 876-5412',
        subjectOrContext:
          campaigns.find((c) => c.channel === 'email')?.subjectOrTemplate ||
          'Re: Growth Blueprint & Onboarding Details',
        outboundMsg:
          'Here is your copy of the Growth Blueprint. Reply directly to this email if you have any questions about implementation.',
        leadReply:
          'Thanks for sending the blueprint over! I read through section 2 and had a quick question about how we can get started this week.',
      },
      sms: {
        name: matchedContact?.fullName || 'Sophia Chen',
        email: matchedContact?.email || 'sophia@luminalabs.ai',
        phone: matchedContact?.phone || '+1 (555) 390-1122',
        subjectOrContext: 'SMS Flash Reminder: Strategy Session',
        outboundMsg:
          'FlowPilot Reminder: Your exclusive access link is ready. Text YES or reply with any questions.',
        leadReply:
          'YES! I got your text message. Can you text me the direct registration link right here?',
      },
    };

    const chosen = presets[channel];
    const nowFormatted = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const initialMessages: InboxMessageItem[] = [
      {
        id: generateSafeId('msg_out'),
        sender: 'outbound_original',
        senderName: senderName || 'Your Outbound Message',
        channel,
        ...(channel === 'email' ? { subject: chosen.subjectOrContext } : {}),
        body: chosen.outboundMsg,
        timestamp: 'Earlier Today',
      },
      {
        id: generateSafeId('msg_in'),
        sender: 'lead',
        senderName: chosen.name,
        channel,
        ...(channel === 'email' ? { subject: chosen.subjectOrContext } : {}),
        body: chosen.leadReply,
        timestamp: `Today, ${nowFormatted}`,
      },
    ];

    // Check if an active Auto Responder matches this list + channel + trigger message
    const matchingAutoResponder = autoResponders.find((ar) => {
      if (ar.status !== 'live') return false;
      if (ar.channel !== channel) return false;
      const listMatches =
        ar.targetList.trim().toLowerCase() === defaultList.trim().toLowerCase();
      if (!listMatches) return false;
      if (ar.matchType === 'any_inbound') return true;
      if (ar.matchType === 'exact') {
        return chosen.leadReply.trim().toLowerCase() === ar.triggerMessage.trim().toLowerCase();
      }
      return chosen.leadReply
        .toLowerCase()
        .includes(ar.triggerMessage.trim().toLowerCase());
    });

    if (matchingAutoResponder) {
      const personalizedAutoReply = matchingAutoResponder.responseMessage
        .replace(/\{\{\s*first_name\s*\}\}/gi, chosen.name.split(' ')[0])
        .replace(/\{\{\s*full_name\s*\}\}/gi, chosen.name)
        .replace(/\{\{\s*list_name\s*\}\}/gi, defaultList);

      initialMessages.push({
        id: generateSafeId('msg_ar'),
        sender: 'autoresponder',
        senderName: `Auto Responder (${matchingAutoResponder.name})`,
        channel,
        body: personalizedAutoReply,
        timestamp: `Today, ${nowFormatted} (Auto-Pilot)`,
      });

      const autoReceipt = await deliverChannelMessage({
        channel,
        to: channel === 'email' ? chosen.email : chosen.phone,
        leadName: chosen.name,
        subject: matchingAutoResponder.subjectLine || chosen.subjectOrContext,
        body: personalizedAutoReply,
        listName: defaultList,
        source: 'auto_responder',
        workspace,
        privateProfile,
      });
      setLastDeliveryReceipt(autoReceipt);
    }

    const newId = await onCreateThread({
      leadName: sanitizeString(chosen.name, 120, 'Lead Contact'),
      leadEmail: sanitizeString(chosen.email, 150, 'lead@example.com'),
      leadPhone: sanitizeString(chosen.phone, 40, '+15550192831'),
      listName: sanitizeString(defaultList, 100, 'General Contacts'),
      channel,
      subjectOrContext: sanitizeString(chosen.subjectOrContext, 160, 'Replied to Message'),
      lastLeadMessage: sanitizeString(chosen.leadReply, 2000, 'Hello!'),
      lastMessagePreview: sanitizeString(
        `${chosen.name}: ${chosen.leadReply}`,
        500,
        chosen.leadReply
      ),
      lastSender: 'lead',
      status: 'unread',
      unreadCount: 1,
      messagesJson: JSON.stringify(initialMessages),
    });

    setSelectedThreadId(newId);
    setReplyChannel(channel);
    setFeedbackBanner(
      `New incoming ${CHANNEL_LABELS[channel]} reply received from ${chosen.name}! Reply manually below using ${CHANNEL_LABELS[channel]}.`
    );
  };

  // Handle Custom Incoming Lead Reply Modal Submission
  const handleCreateCustomIncomingReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomingLeadName.trim() || !incomingLeadReply.trim()) return;

    setSubmittingIncoming(true);
    try {
      const cleanName = sanitizeString(incomingLeadName, 120, 'New Lead');
      const cleanEmail = sanitizeString(incomingLeadEmail, 150, '');
      const cleanPhone = sanitizeString(incomingLeadPhone, 40, '');
      const cleanList = sanitizeString(
        incomingListName || availableListNames[0] || 'General Contacts',
        100,
        'General Contacts'
      );
      const cleanContext = sanitizeString(
        incomingContext || `Replied via ${CHANNEL_LABELS[incomingChannel]}`,
        160,
        `Replied via ${CHANNEL_LABELS[incomingChannel]}`
      );
      const cleanReply = sanitizeString(incomingLeadReply, 2000, 'Interested!');
      const nowFormatted = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const messages: InboxMessageItem[] = [];
      if (incomingOutboundMsg.trim()) {
        messages.push({
          id: generateSafeId('msg_out'),
          sender: 'outbound_original',
          senderName: senderName || 'Your Outbound Message',
          channel: incomingChannel,
          ...(incomingChannel === 'email' ? { subject: cleanContext } : {}),
          body: incomingOutboundMsg.trim().slice(0, 2000),
          timestamp: 'Earlier',
        });
      }

      messages.push({
        id: generateSafeId('msg_in'),
        sender: 'lead',
        senderName: cleanName,
        channel: incomingChannel,
        ...(incomingChannel === 'email' ? { subject: cleanContext } : {}),
        body: cleanReply,
        timestamp: `Today, ${nowFormatted}`,
      });

      // If this lead is not yet in Contacts CRM, optionally ensure they exist
      const existsInContacts = contacts.some(
        (c) =>
          (cleanEmail && c.email.toLowerCase() === cleanEmail.toLowerCase()) ||
          c.fullName.toLowerCase() === cleanName.toLowerCase()
      );
      if (!existsInContacts) {
        await onCreateContact({
          fullName: cleanName,
          email: cleanEmail || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@lead.io`,
          phone: cleanPhone || '+1 (555) 019-9900',
          stage: 'warm_lead',
          temperature: 'hot',
          source: `Inbound ${CHANNEL_LABELS[incomingChannel]} Reply`,
          consentStatus: 'opted_in',
          listName: cleanList,
          tags: ['replied-in-inbox', incomingChannel],
          ltv: 0,
          notes: `Replied via ${CHANNEL_LABELS[incomingChannel]}: "${cleanReply.slice(0, 120)}"`,
        });
      }

      // Check if an active Auto Responder matches this list + channel + trigger message
      const matchingAutoResponder = autoResponders.find((ar) => {
        if (ar.status !== 'live') return false;
        if (ar.channel !== incomingChannel) return false;
        const listMatches =
          ar.targetList.trim().toLowerCase() === cleanList.trim().toLowerCase();
        if (!listMatches) return false;
        if (ar.matchType === 'any_inbound') return true;
        if (ar.matchType === 'exact') {
          return cleanReply.trim().toLowerCase() === ar.triggerMessage.trim().toLowerCase();
        }
        return cleanReply.toLowerCase().includes(ar.triggerMessage.trim().toLowerCase());
      });

      if (matchingAutoResponder) {
        const personalizedAutoReply = matchingAutoResponder.responseMessage
          .replace(/\{\{\s*first_name\s*\}\}/gi, cleanName.split(' ')[0] || 'there')
          .replace(/\{\{\s*full_name\s*\}\}/gi, cleanName)
          .replace(/\{\{\s*list_name\s*\}\}/gi, cleanList);

        messages.push({
          id: generateSafeId('msg_ar'),
          sender: 'autoresponder',
          senderName: `Auto Responder (${matchingAutoResponder.name})`,
          channel: incomingChannel,
          body: personalizedAutoReply,
          timestamp: `Today, ${nowFormatted} (Auto-Pilot)`,
        });

        const autoReceipt = await deliverChannelMessage({
          channel: incomingChannel,
          to:
            incomingChannel === 'email'
              ? cleanEmail || 'lead@example.com'
              : cleanPhone || '+1 (555) 019-9900',
          leadName: cleanName,
          subject: matchingAutoResponder.subjectLine || cleanContext,
          body: personalizedAutoReply,
          listName: cleanList,
          source: 'auto_responder',
          workspace,
          privateProfile,
        });
        setLastDeliveryReceipt(autoReceipt);
      }

      const newId = await onCreateThread({
        leadName: cleanName,
        leadEmail: cleanEmail,
        leadPhone: cleanPhone,
        listName: cleanList,
        channel: incomingChannel,
        subjectOrContext: cleanContext,
        lastLeadMessage: cleanReply,
        lastMessagePreview: sanitizeString(`${cleanName}: ${cleanReply}`, 500, cleanReply),
        lastSender: matchingAutoResponder ? 'autoresponder' : 'lead',
        status: 'unread',
        unreadCount: 1,
        messagesJson: JSON.stringify(messages),
      });

      setSelectedThreadId(newId);
      setReplyChannel(incomingChannel);
      setShowIncomingModal(false);
      setIncomingLeadName('');
      setIncomingLeadEmail('');
      setIncomingLeadPhone('');
      setIncomingContext('');
      setIncomingOutboundMsg('');
      setIncomingLeadReply('');
      setFeedbackBanner(
        matchingAutoResponder
          ? `Received new ${CHANNEL_LABELS[incomingChannel]} reply from ${cleanName} and automatically dispatched Auto Responder "${matchingAutoResponder.name}"!`
          : `Received new ${CHANNEL_LABELS[incomingChannel]} reply from ${cleanName}. You can now reply manually via ${CHANNEL_LABELS[incomingChannel]}!`
      );
    } finally {
      setSubmittingIncoming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Unified Multi-Channel Messaging Inbox
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 mt-1">
            Lead Reply Inbox (WhatsApp, Email & SMS)
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Receive new messages from leads who replied to your campaigns or auto-responders, and
            reply to them manually in the exact channel they used (
            <strong className="text-slate-900">WhatsApp</strong>,{' '}
            <strong className="text-slate-900">Email</strong>, or{' '}
            <strong className="text-slate-900">SMS</strong>).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setIncomingListName(availableListNames[0] || 'General Contacts');
              setShowIncomingModal(true);
            }}
            className="px-4 py-2.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Receive / Log Lead Reply</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs sm:text-sm text-emerald-950">
          <div className="flex items-center gap-2.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{feedbackBanner}</span>
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

      {/* 4-Column Summary Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Total Lead Conversations</div>
          <div className="font-display text-2xl sm:text-3xl font-bold text-slate-950 font-mono tabular-nums mt-1">
            {totalThreads}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            WhatsApp ({whatsappCount}) · Email ({emailCount}) · SMS ({smsCount})
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">New Replies Awaiting You</div>
          <div className="font-display text-2xl sm:text-3xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {unreadThreadsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Leads who replied & need a manual response
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Replied Manually</div>
          <div className="font-display text-2xl sm:text-3xl font-bold text-slate-950 font-mono tabular-nums mt-1">
            {repliedThreadsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Answered in the lead&apos;s reply channel
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Supported Reply Channels</div>
          <div className="font-display text-lg sm:text-xl font-bold text-slate-950 mt-1.5">
            WhatsApp · Email · SMS
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            Auto-matches lead&apos;s inbound channel
          </div>
        </div>
      </div>

      {/* Quick Test Bar: Receive Instant Sample Replies on Any of the 3 Channels */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-slate-700">
          <span className="font-bold text-slate-950">Test Incoming Lead Replies:</span> Click any
          channel below to simulate a lead replying to your message on{' '}
          <strong className="text-slate-900">WhatsApp</strong>,{' '}
          <strong className="text-slate-900">Email</strong>, or{' '}
          <strong className="text-slate-900">SMS</strong>, then reply back manually:
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleQuickReceiveChannelReply('whatsapp')}
            className="px-3 py-1.5 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
            <span>+ WhatsApp Lead Reply</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickReceiveChannelReply('email')}
            className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Mail className="w-3.5 h-3.5 text-slate-700" />
            <span>+ Email Lead Reply</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickReceiveChannelReply('sms')}
            className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-slate-700" />
            <span>+ SMS Lead Reply</span>
          </button>
        </div>
      </div>

      {/* Main Two-Pane Unified Inbox Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANE (5 Columns): Incoming Lead Replies List & Filters */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
          {/* Search & Filter Header */}
          <div className="p-4 border-b border-slate-200 space-y-3 bg-slate-50/60">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search lead name, message, list, or channel..."
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-700"
              />
            </div>

            {/* Channel Filter Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
              {(['all', 'whatsapp', 'email', 'sms'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannelFilter(ch)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    channelFilter === ch
                      ? 'bg-[#0F172A] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {ch === 'all' ? 'All Channels' : CHANNEL_LABELS[ch]}
                </button>
              ))}
            </div>

            {/* Status Filter Bar */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <div className="flex items-center gap-2">
                {(
                  [
                    { id: 'all', label: `All (${threads.length})` },
                    { id: 'unread', label: `New Replies (${unreadThreadsCount})` },
                    { id: 'replied', label: `Replied (${repliedThreadsCount})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`text-[11px] font-bold pb-1 border-b-2 transition-colors cursor-pointer ${
                      statusFilter === tab.id
                        ? 'border-emerald-700 text-emerald-800'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Thread List */}
          {filteredThreads.length === 0 ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                <Inbox className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  {threads.length === 0
                    ? 'No Lead Replies in Your Inbox Yet'
                    : 'No Conversations Match Your Filter'}
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  {threads.length === 0
                    ? 'When leads reply to your WhatsApp, Email, or SMS messages, their replies appear right here so you can respond manually in that same channel.'
                    : 'Try clearing your search query or switching the channel filter above.'}
                </p>
              </div>
              <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickReceiveChannelReply('whatsapp')}
                  className="px-3 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer"
                >
                  Simulate WhatsApp Lead Reply
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickReceiveChannelReply('email')}
                  className="px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Simulate Email Reply
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickReceiveChannelReply('sms')}
                  className="px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Simulate SMS Reply
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[680px] overflow-y-auto">
              {filteredThreads.map((thread) => {
                const isSelected = activeThread?.id === thread.id;
                const isUnread = thread.status === 'unread' || thread.unreadCount > 0;
                return (
                  <div
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`p-4 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/70 border-l-4 border-l-[#047857]'
                        : isUnread
                        ? 'bg-white hover:bg-slate-50 border-l-4 border-l-amber-500'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {isUnread && (
                            <span
                              className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"
                              title="New unread lead reply"
                            />
                          )}
                          <span className="font-bold text-sm text-slate-950 truncate">
                            {thread.leadName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-emerald-800 inline-flex items-center gap-1">
                            {thread.channel === 'whatsapp' && (
                              <MessageSquare className="w-3 h-3 text-emerald-700" />
                            )}
                            {thread.channel === 'email' && (
                              <Mail className="w-3 h-3 text-slate-700" />
                            )}
                            {thread.channel === 'sms' && (
                              <Phone className="w-3 h-3 text-slate-700" />
                            )}
                            <span>Replied via {CHANNEL_LABELS[thread.channel]}</span>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">List: {thread.listName}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-[11px] font-bold ${
                            isUnread ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {isUnread ? 'New Reply' : 'Replied'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-slate-600 font-medium truncate">
                      {thread.subjectOrContext}
                    </div>

                    <p
                      className={`mt-1 text-xs line-clamp-2 leading-relaxed ${
                        isUnread ? 'text-slate-900 font-semibold' : 'text-slate-600'
                      }`}
                    >
                      {thread.lastMessagePreview}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT PANE (7 Columns): Active Conversation Stream & Manual Reply Box */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
          {!activeThread ? (
            <div className="p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h2 className="font-display text-lg font-bold text-slate-950">
                  Select a Lead Conversation to Reply Manually
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Choose any lead message on the left—or click{' '}
                  <strong className="text-slate-900">Receive / Log Lead Reply</strong>—to view what
                  the lead replied and respond manually using their exact channel (WhatsApp, Email,
                  or SMS).
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Active Thread Header */}
              <div className="p-4 sm:p-5 bg-[#0F172A] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-400 font-bold">
                    <span className="inline-flex items-center gap-1">
                      {activeThread.channel === 'whatsapp' && (
                        <MessageSquare className="w-3.5 h-3.5" />
                      )}
                      {activeThread.channel === 'email' && <Mail className="w-3.5 h-3.5" />}
                      {activeThread.channel === 'sms' && <Phone className="w-3.5 h-3.5" />}
                      <span>Lead Replied via {CHANNEL_LABELS[activeThread.channel]}</span>
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="text-slate-300 font-normal">
                      Special List: <strong className="text-white">{activeThread.listName}</strong>
                    </span>
                  </div>

                  <h2 className="font-display text-lg sm:text-xl font-bold text-white truncate">
                    {activeThread.leadName}
                  </h2>

                  <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2">
                    {activeThread.leadEmail && <span>{activeThread.leadEmail}</span>}
                    {activeThread.leadEmail && activeThread.leadPhone && (
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                    )}
                    {activeThread.leadPhone && <span>{activeThread.leadPhone}</span>}
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="text-emerald-300">{activeThread.subjectOrContext}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSimulateFollowUpFromLead(activeThread)}
                    className="px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                    title="Simulate another incoming reply from this lead"
                  >
                    <CornerDownRight className="w-3.5 h-3.5" />
                    <span>Simulate Lead Follow-Up</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleReadStatus(activeThread)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl cursor-pointer"
                  >
                    {activeThread.status === 'unread' || activeThread.unreadCount > 0
                      ? 'Mark Replied'
                      : 'Mark Unread'}
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteThread(activeThread.id);
                      setFeedbackBanner(
                        `Deleted inbox conversation with ${activeThread.leadName}.`
                      );
                    }}
                    className="p-2 text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl cursor-pointer"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Conversation Message Stream */}
              <div className="p-4 sm:p-6 bg-slate-50/70 space-y-4 max-h-[420px] overflow-y-auto border-b border-slate-200">
                {activeMessages.map((msg) => {
                  const isLead = msg.sender === 'lead';
                  const isManualOperator = msg.sender === 'operator';
                  const isAutoResponder = msg.sender === 'autoresponder';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isLead ? 'items-start' : 'items-end'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1 px-1">
                        <span className="font-bold text-slate-700">
                          {isLead
                            ? `${msg.senderName} (Lead Reply)`
                            : isManualOperator
                            ? `${msg.senderName} (Manual Reply)`
                            : isAutoResponder
                            ? msg.senderName
                            : 'Your Original Message'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-emerald-800">
                          via {CHANNEL_LABELS[msg.channel]}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{msg.timestamp}</span>
                      </div>

                      <div
                        className={`max-w-xl rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                          isLead
                            ? 'bg-white border-2 border-emerald-600/30 text-slate-900 shadow-xs'
                            : isManualOperator
                            ? 'bg-[#047857] text-white shadow-xs'
                            : isAutoResponder
                            ? 'bg-slate-800 text-slate-100'
                            : 'bg-slate-200/80 text-slate-800'
                        }`}
                      >
                        {msg.subject && (
                          <div
                            className={`text-xs font-bold mb-1.5 pb-1.5 border-b ${
                              isManualOperator
                                ? 'border-emerald-600 text-emerald-100'
                                : 'border-slate-200 text-slate-700'
                            }`}
                          >
                            Subject: {msg.subject}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap">{msg.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Manual Reply Composer Form */}
              <form onSubmit={handleSendManualReply} className="p-4 sm:p-6 space-y-4 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      Manual Reply Composer
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {activeThread.leadName} replied via{' '}
                      <strong className="text-slate-900">
                        {CHANNEL_LABELS[activeThread.channel]}
                      </strong>
                      . Your manual reply channel is set to{' '}
                      <strong className="text-emerald-800">
                        {CHANNEL_LABELS[replyChannel]}
                      </strong>
                      .
                    </p>
                  </div>

                  {/* Channel Dropdown + Segmented Selector (WhatsApp, Email, SMS) */}
                  <div className="flex items-center gap-2 shrink-0">
                    <label
                      htmlFor="inbox-reply-channel-select"
                      className="text-xs font-bold text-slate-700"
                    >
                      Reply Channel:
                    </label>
                    <select
                      id="inbox-reply-channel-select"
                      value={replyChannel}
                      onChange={(e) => setReplyChannel(e.target.value as ChannelType)}
                      className="px-3 py-2 text-xs font-bold text-slate-900 bg-emerald-50 border border-emerald-300 rounded-xl focus:outline-none focus:border-emerald-700 cursor-pointer"
                    >
                      <option value="whatsapp">
                        WhatsApp {activeThread.channel === 'whatsapp' ? '(Lead Used This)' : ''}
                      </option>
                      <option value="email">
                        Email {activeThread.channel === 'email' ? '(Lead Used This)' : ''}
                      </option>
                      <option value="sms">
                        SMS {activeThread.channel === 'sms' ? '(Lead Used This)' : ''}
                      </option>
                    </select>
                  </div>
                </div>

                {/* Email Subject Line if replying via Email */}
                {replyChannel === 'email' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Reply Subject Line
                    </label>
                    <input
                      type="text"
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                      placeholder="Re: Your inquiry"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                )}

                {/* Quick Reply Templates & Merge Tags */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 mr-1">
                      Quick Replies:
                    </span>
                    {QUICK_MANUAL_REPLIES.map((tpl) => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => setReplyMessage(tpl.text)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {['{{first_name}}', '{{full_name}}', '{{list_name}}'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setReplyMessage((prev) =>
                            prev ? `${prev} ${tag}` : tag
                          )
                        }
                        className="px-2 py-0.5 text-[11px] font-mono text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md cursor-pointer"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual Reply Textarea */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Your Manual Reply to {activeThread.leadName} via{' '}
                    {CHANNEL_LABELS[replyChannel]} *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder={`Write your manual ${CHANNEL_LABELS[replyChannel]} reply to ${activeThread.leadName}...`}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-700 leading-relaxed"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="text-xs text-slate-600 space-y-0.5">
                    <div>
                      Replying to{' '}
                      <strong className="text-slate-800">
                        {replyChannel === 'email'
                          ? activeThread.leadEmail || activeThread.leadName
                          : activeThread.leadPhone || activeThread.leadName}
                      </strong>{' '}
                      on <strong className="text-emerald-800">{CHANNEL_LABELS[replyChannel]}</strong>
                    </div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5">
                      <span>Sending From:</span>
                      {channelSavedIdentities.length > 0 ? (
                        <select
                          value={selectedSenderIdentityId}
                          onChange={(e) => setSelectedSenderIdentityId(e.target.value)}
                          className="px-2 py-0.5 text-[11px] font-mono font-bold text-slate-900 bg-slate-100 border border-slate-300 rounded-md cursor-pointer"
                        >
                          <option value="default">
                            Active Default ({getOutboundSenderLabel(replyChannel)})
                          </option>
                          {channelSavedIdentities.map((idItem) => (
                            <option key={idItem.id} value={idItem.id}>
                              {idItem.label}: {idItem.value} ({idItem.senderName})
                              {idItem.isDefault ? ' ★' : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-mono font-bold text-slate-800">
                          {getOutboundSenderLabel(replyChannel)}
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
                            Manage Identities in Settings
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={buildDirectChannelUrl(
                        replyChannel,
                        replyChannel === 'email'
                          ? activeThread.leadEmail || 'lead@example.com'
                          : activeThread.leadPhone || '+15552348910',
                        replySubject || activeThread.subjectOrContext,
                        resolveMergeTags(
                          replyMessage.trim() ||
                            `Hi ${activeThread.leadName.split(' ')[0] || 'there'}, following up on your message!`,
                          activeThread
                        )
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl inline-flex items-center gap-1.5 transition-colors"
                      title={`Open directly in your device's ${CHANNEL_LABELS[replyChannel]} app`}
                    >
                      <span>Open in {CHANNEL_LABELS[replyChannel]} App</span>
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                    </a>

                    <button
                      type="submit"
                      disabled={sendingReply || !replyMessage.trim()}
                      className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] disabled:opacity-50 rounded-xl transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {sendingReply
                          ? `Delivering via ${CHANNEL_LABELS[replyChannel]}...`
                          : `Send Manual Reply via ${CHANNEL_LABELS[replyChannel]}`}
                      </span>
                    </button>
                  </div>
                </div>

                {lastDeliveryReceipt && (
                  <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>
                          Verified {lastDeliveryReceipt.channel.toUpperCase()} Delivery Receipt ·{' '}
                          {lastDeliveryReceipt.providerUsed}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-emerald-900">
                        From: {lastDeliveryReceipt.fromIdentity} → To:{' '}
                        {lastDeliveryReceipt.toRecipient} ({lastDeliveryReceipt.leadName}) · ID:{' '}
                        {lastDeliveryReceipt.receiptId}
                      </div>
                    </div>
                    <a
                      href={lastDeliveryReceipt.directLaunchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-[11px] font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg inline-flex items-center gap-1 shrink-0"
                    >
                      <span>Launch {lastDeliveryReceipt.channel.toUpperCase()} Directly</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </form>
            </>
          )}
        </div>
      </div>

      {/* Modal: Receive / Log Incoming Lead Reply */}
      {showIncomingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Inbound Lead Message
                </div>
                <h2 className="font-display text-xl font-bold text-slate-950 mt-0.5">
                  Receive New Lead Reply in Inbox
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Choose a lead from your Contact Lists (or enter a new lead), select the channel
                  they used to reply (WhatsApp, Email, or SMS), and enter their message.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIncomingModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomIncomingReply} className="space-y-4 text-xs sm:text-sm">
              {/* Optional: Select existing Contact from CRM */}
              {contacts.length > 0 && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Select Lead from Your Contacts (or Enter New Lead Below)
                  </label>
                  <select
                    value={incomingContactId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIncomingContactId(val);
                      const found = contacts.find((c) => c.id === val);
                      if (found) {
                        setIncomingLeadName(found.fullName);
                        setIncomingLeadEmail(found.email);
                        setIncomingLeadPhone(found.phone);
                        setIncomingListName(found.listName);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="custom">-- Enter New or Custom Lead Details --</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.email || c.phone}) — List: {c.listName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lead Full Name *</label>
                  <input
                    type="text"
                    required
                    value={incomingLeadName}
                    onChange={(e) => setIncomingLeadName(e.target.value)}
                    placeholder="e.g. Jordan Taylor"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Special Contact List *</label>
                  <input
                    type="text"
                    required
                    list="inbox-available-lists"
                    value={incomingListName}
                    onChange={(e) => setIncomingListName(e.target.value)}
                    placeholder="e.g. VIP Priority Leads"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                  />
                  <datalist id="inbox-available-lists">
                    {availableListNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lead Email Address</label>
                  <input
                    type="email"
                    value={incomingLeadEmail}
                    onChange={(e) => setIncomingLeadEmail(e.target.value)}
                    placeholder="jordan@company.com"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    WhatsApp / SMS Phone Number
                  </label>
                  <input
                    type="tel"
                    value={incomingLeadPhone}
                    onChange={(e) => setIncomingLeadPhone(e.target.value)}
                    placeholder="+1 (555) 234-5678"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Channel Lead Used to Reply *
                  </label>
                  <select
                    value={incomingChannel}
                    onChange={(e) => setIncomingChannel(e.target.value as ChannelType)}
                    className="w-full px-3.5 py-2 font-bold text-slate-900 bg-emerald-50 border border-emerald-300 rounded-xl"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Subject / Campaign Replied To
                  </label>
                  <input
                    type="text"
                    value={incomingContext}
                    onChange={(e) => setIncomingContext(e.target.value)}
                    placeholder="e.g. Re: Special Offer Broadcast"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Your Original Message (Optional Context)
                </label>
                <input
                  type="text"
                  value={incomingOutboundMsg}
                  onChange={(e) => setIncomingOutboundMsg(e.target.value)}
                  placeholder="e.g. Hi! Reply INFO if you would like the onboarding link."
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Message Received from Lead (Lead&apos;s Reply) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={incomingLeadReply}
                  onChange={(e) => setIncomingLeadReply(e.target.value)}
                  placeholder="Enter the message the lead sent in reply to your message..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowIncomingModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingIncoming}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer"
                >
                  {submittingIncoming
                    ? 'Receiving...'
                    : `Receive ${CHANNEL_LABELS[incomingChannel]} Reply in Inbox`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
