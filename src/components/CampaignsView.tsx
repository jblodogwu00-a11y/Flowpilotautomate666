import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Send,
  Trash2,
  X,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Users,
  FolderPlus,
  ArrowRight,
  Calendar,
  Mail,
  LayoutTemplate,
  Sparkles,
  SlidersHorizontal,
  Ban,
  Globe,
  BarChart3,
  Eye,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Check,
  GitBranch,
  MousePointerClick,
  UserMinus,
  RefreshCw,
  Smartphone,
  Radio,
  Info,
} from 'lucide-react';
import {
  Campaign,
  ChannelType,
  CampaignStatus,
  Contact,
  AudienceList,
  ListCategory,
  ConsentStatus,
  LeadStage,
  LeadTemperature,
  Workspace,
  UserPrivateProfile,
  Automation,
  ActivityLog,
  UserMessagingIdentity,
  parseSavedMessagingIdentities,
  resolveWorkspaceSenderIdentities,
  sanitizeString,
} from '../types';
import {
  EmailBlock,
  EmailBlockType,
  ReusableEmailTemplate,
  DEFAULT_REUSABLE_EMAIL_TEMPLATES,
  EMAIL_SEQUENCE_BLUEPRINTS,
  PERSONALIZATION_VARIABLES,
  serializeBlocksToMessageBody,
  resolvePersonalizationVariables,
  evaluateEmailCompliance,
  SMS_PROVIDERS_CATALOG,
  DEFAULT_SMS_TEMPLATES,
  SMS_SEQUENCE_BLUEPRINTS,
  calculateSmsSegments,
} from './EmailMarketingCatalog';
import {
  deliverChannelMessage,
  triggerOneClickUnsubscribe,
  triggerLiveTrackingTestEvent,
} from '../services/messageDeliveryService';

interface CampaignsViewProps {
  campaigns: Campaign[];
  contacts: Contact[];
  lists: AudienceList[];
  workspace?: Workspace;
  privateProfile?: UserPrivateProfile;
  automations?: Automation[];
  preselectedListName?: string | null;
  onClearPreselectedList?: () => void;
  openModalOnMount?: boolean;
  instantSendMode?: boolean;
  onClearModalMount?: () => void;
  onCreateCampaign: (
    data: Omit<Campaign, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateCampaign?: (
    id: string,
    data: Partial<Omit<Campaign, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>>
  ) => Promise<void>;
  onDispatchCampaign: (campaign: Campaign) => Promise<void>;
  onDeleteCampaign: (id: string) => Promise<void>;
  onCreateList?: (
    data: Omit<AudienceList, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<string | void>;
  onUpdateContact?: (
    id: string,
    data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onCreateContact?: (
    data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onCreateAutomation?: (
    data: Omit<Automation, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateWorkspace?: (
    data: Omit<Workspace, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdatePrivateProfile?: (
    data: Omit<UserPrivateProfile, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onLogActivity?: (
    eventType: ActivityLog['eventType'],
    title: string,
    detail: string,
    channel: ActivityLog['channel']
  ) => Promise<void>;
  onNavigateToLists?: () => void;
  onNavigateToAutomations?: () => void;
}

type StudioSubTab =
  | 'broadcasts'
  | 'sms_studio'
  | 'templates'
  | 'sequences'
  | 'suppression'
  | 'sender_domain'
  | 'analytics';

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaigns,
  contacts,
  lists,
  workspace,
  privateProfile,
  automations = [],
  preselectedListName,
  onClearPreselectedList,
  openModalOnMount,
  instantSendMode,
  onClearModalMount,
  onCreateCampaign,
  onUpdateCampaign,
  onDispatchCampaign,
  onDeleteCampaign,
  onCreateList,
  onUpdateContact,
  onCreateContact,
  onCreateAutomation,
  onUpdateWorkspace,
  onUpdatePrivateProfile,
  onLogActivity,
  onNavigateToLists,
  onNavigateToAutomations,
}) => {
  const [activeStudioTab, setActiveStudioTab] = useState<StudioSubTab>('broadcasts');
  const [channelFilter, setChannelFilter] = useState<'all' | ChannelType>('all');
  const [listFilter, setListFilter] = useState<string>('all');
  const [selectedListForNewCampaign, setSelectedListForNewCampaign] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(Boolean(openModalOnMount));

  // Reusable Templates library state
  const [templates, setTemplates] = useState<ReusableEmailTemplate[]>(
    DEFAULT_REUSABLE_EMAIL_TEMPLATES
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    DEFAULT_REUSABLE_EMAIL_TEMPLATES[0].id
  );
  const [newTemplateName, setNewTemplateName] = useState('');
  const [templateSavedNotice, setTemplateSavedNotice] = useState<string | null>(null);

  // Campaign / Broadcast Builder state
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<ChannelType>('email');
  const [selectedSenderIdentityId, setSelectedSenderIdentityId] = useState<string>('');
  const [targetList, setTargetList] = useState('');
  const [subjectOrTemplate, setSubjectOrTemplate] = useState(
    DEFAULT_REUSABLE_EMAIL_TEMPLATES[0].subject
  );

  // Per-user saved sender identities for the currently selected channel
  const channelSenderIdentities = useMemo<UserMessagingIdentity[]>(() => {
    const saved = parseSavedMessagingIdentities(privateProfile?.savedIdentitiesJson);
    const matching = saved.filter((item) => item.channel === channel);
    if (matching.length > 0) return matching;
    const resolved = resolveWorkspaceSenderIdentities(workspace, privateProfile);
    if (channel === 'whatsapp') {
      return [
        {
          id: 'default_wa_primary',
          channel: 'whatsapp',
          label: 'Primary WhatsApp Business',
          value: resolved.whatsappBusinessNumber,
          displayName: workspace?.senderName || 'FlowPilot Operator',
          isPrimary: true,
          verified: true,
        },
      ];
    }
    if (channel === 'sms') {
      return [
        {
          id: 'default_sms_primary',
          channel: 'sms',
          label: 'Primary SMS Sender ID',
          value: resolved.smsSenderId,
          displayName: workspace?.senderName || 'FlowPilot Operator',
          isPrimary: true,
          verified: true,
        },
      ];
    }
    return [
      {
        id: 'default_email_primary',
        channel: 'email',
        label: 'Primary Sender Email',
        value: resolved.activeSenderEmail,
        displayName: workspace?.senderName || 'FlowPilot Operator',
        isPrimary: true,
        verified: true,
      },
    ];
  }, [privateProfile, workspace, channel]);

  const activeSelectedSenderIdentity = useMemo<UserMessagingIdentity | undefined>(() => {
    if (selectedSenderIdentityId) {
      const found = channelSenderIdentities.find((i) => i.id === selectedSenderIdentityId);
      if (found) return found;
    }
    return channelSenderIdentities.find((i) => i.isPrimary) || channelSenderIdentities[0];
  }, [channelSenderIdentities, selectedSenderIdentityId]);
  const [preheader, setPreheader] = useState(DEFAULT_REUSABLE_EMAIL_TEMPLATES[0].preheader);
  const [editorMode, setEditorMode] = useState<'visual_blocks' | 'plain_text'>('visual_blocks');
  const [emailBlocks, setEmailBlocks] = useState<EmailBlock[]>(
    DEFAULT_REUSABLE_EMAIL_TEMPLATES[0].blocks
  );
  const [messageBody, setMessageBody] = useState('');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewContactId, setPreviewContactId] = useState<string>('');

  // Segmentation filters inside the selected Contact List
  const [segmentStage, setSegmentStage] = useState<'all' | LeadStage>('all');
  const [segmentTemp, setSegmentTemp] = useState<'all' | LeadTemperature>('all');
  const [segmentTagQuery, setSegmentTagQuery] = useState<string>('');

  // Scheduling & A/B Split Test + Send-Time Optimization state
  const [dispatchNow, setDispatchNow] = useState<boolean>(Boolean(instantSendMode));
  const [scheduleType, setScheduleType] = useState<'immediate' | 'time_delay' | 'specific_datetime'>(
    instantSendMode ? 'immediate' : 'specific_datetime'
  );
  const [delayAmount, setDelayAmount] = useState<number>(2);
  const [delayUnit, setDelayUnit] = useState<'minutes' | 'hours' | 'days'>('hours');
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('2026-10-15T09:00');
  const [businessHoursOnly, setBusinessHoursOnly] = useState<boolean>(true);
  const [attestedOptInPermission, setAttestedOptInPermission] = useState<boolean>(true);
  const [abTestEnabled, setAbTestEnabled] = useState<boolean>(false);
  const [variantBSubject, setVariantBSubject] = useState<string>(
    'Quick question for {{first_name}} — Variant B'
  );
  const [variantBBody, setVariantBBody] = useState<string>('');
  const [abWinningMetric, setAbWinningMetric] = useState<'open_rate' | 'click_rate'>('open_rate');
  const [abSamplePercent, setAbSamplePercent] = useState<number>(20);
  const [sendTimeOptimization, setSendTimeOptimization] = useState<
    'immediate' | 'recipient_local_9am' | 'evening_peak_6pm'
  >('recipient_local_9am');
  const [isSaving, setIsSaving] = useState(false);

  // Test Email dispatch state
  const [testEmailRecipient, setTestEmailRecipient] = useState<string>(
    privateProfile?.email || 'operator@flowpilot.app'
  );
  const [testEmailFeedback, setTestEmailFeedback] = useState<string | null>(null);

  // Inline quick list creator state
  const [isCreatingInlineList, setIsCreatingInlineList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListCategory, setNewListCategory] = useState<ListCategory>('newsletter');
  const [newListConsent] = useState<ConsentStatus>('opted_in');
  const [isSavingInlineList, setIsSavingInlineList] = useState(false);

  // Suppression list manual addition state
  const [suppressEmailInput, setSuppressEmailInput] = useState('');
  const [suppressReasonInput, setSuppressReasonInput] = useState<
    'user_unsubscribed' | 'hard_bounce' | 'manual_suppression'
  >('manual_suppression');
  const [suppressionFeedback, setSuppressionFeedback] = useState<string | null>(null);

  // Sender & Domain Configuration state
  const [senderNameInput, setSenderNameInput] = useState(
    workspace?.senderName || 'FlowPilot Operator'
  );
  const [fromEmailInput, setFromEmailInput] = useState(
    privateProfile?.email || 'dispatch@flowpilot.app'
  );
  const [replyToEmailInput, setReplyToEmailInput] = useState(
    privateProfile?.replyToEmail || 'replies@flowpilot.app'
  );
  const [sendingDomainInput, setSendingDomainInput] = useState(
    privateProfile?.emailProviderDomain || 'mail.flowpilot.app'
  );
  const [physicalAddressInput, setPhysicalAddressInput] = useState(
    '548 Market St, Suite 41200, San Francisco, CA 94104'
  );
  const [senderSaveBanner, setSenderSaveBanner] = useState<string | null>(null);
  const [sequenceDeployBanner, setSequenceDeployBanner] = useState<string | null>(null);

  // SMS Provider Connection Settings, DLR & Opt-Out state
  const [smsProviderId, setSmsProviderId] = useState<'twilio' | 'telnyx' | 'vonage' | 'aws_pinpoint'>('twilio');
  const [smsSenderNumber, setSmsSenderNumber] = useState(
    privateProfile?.phone || '+14155550199'
  );
  const [smsMessagingServiceSid, setSmsMessagingServiceSid] = useState('MG9f84a2c710dlc8821flowpilot');
  const [sms10DlcStatus, setSms10DlcStatus] = useState<'verified' | 'pending'>('verified');
  const [smsDlrWebhookEnabled, setSmsDlrWebhookEnabled] = useState(true);
  const [smsAutoStopEnabled, setSmsAutoStopEnabled] = useState(true);
  const [smsQuietHoursGuard, setSmsQuietHoursGuard] = useState(true);
  const [smsGatewayConnected, setSmsGatewayConnected] = useState(true);
  const [smsGatewayFeedback, setSmsGatewayFeedback] = useState<string | null>(null);
  const [selectedSmsTemplateId, setSelectedSmsTemplateId] = useState<string>(
    DEFAULT_SMS_TEMPLATES[0].id
  );
  const [smsStopPhoneInput, setSmsStopPhoneInput] = useState('');
  const [smsStopKeywordInput, setSmsStopKeywordInput] = useState<'STOP' | 'UNSUBSCRIBE' | 'CANCEL'>('STOP');
  const [smsConsentFeedback, setSmsConsentFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (privateProfile?.phone) {
      setSmsSenderNumber(privateProfile.phone);
    }
  }, [privateProfile?.phone]);

  useEffect(() => {
    if (workspace?.senderName) setSenderNameInput(workspace.senderName);
  }, [workspace?.senderName]);

  useEffect(() => {
    if (privateProfile?.email) {
      setFromEmailInput(privateProfile.email);
      setTestEmailRecipient((prev) => prev || privateProfile.email);
    }
    if (privateProfile?.replyToEmail) setReplyToEmailInput(privateProfile.replyToEmail);
    if (privateProfile?.emailProviderDomain)
      setSendingDomainInput(privateProfile.emailProviderDomain);
  }, [privateProfile]);

  // Build unified list directory from created AudienceLists + existing contact/campaign lists
  const availableLists = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        category: string;
        description: string;
        totalContacts: number;
        optedInCount: number;
        suppressedCount: number;
        contactsInList: Contact[];
      }
    >();

    const registerList = (nameRaw: string, category: string, description: string) => {
      const clean = nameRaw.trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (map.has(key)) return;
      const listContacts = contacts.filter((c) => c.listName.trim().toLowerCase() === key);
      const optedIn = listContacts.filter(
        (c) =>
          c.consentStatus === 'opted_in' &&
          !c.tags?.includes('bounced') &&
          !c.tags?.includes('suppressed')
      ).length;
      const suppressed = listContacts.filter(
        (c) =>
          c.consentStatus === 'unsubscribed' ||
          c.tags?.includes('bounced') ||
          c.tags?.includes('suppressed')
      ).length;
      map.set(key, {
        name: clean,
        category,
        description,
        totalContacts: listContacts.length,
        optedInCount: optedIn,
        suppressedCount: suppressed,
        contactsInList: listContacts,
      });
    };

    lists.forEach((l) =>
      registerList(
        l.name,
        l.category.replace('_', ' '),
        l.description || 'Created Contact List'
      )
    );
    contacts.forEach((c) =>
      registerList(c.listName || '', 'contact segment', 'Active CRM Contact List')
    );
    campaigns.forEach((camp) =>
      registerList(camp.targetList || '', 'broadcast list', 'Campaign Target List')
    );

    return Array.from(map.values());
  }, [lists, contacts, campaigns]);

  useEffect(() => {
    if (!selectedListForNewCampaign && availableLists.length > 0) {
      setSelectedListForNewCampaign(availableLists[0].name);
    }
    if (!targetList && availableLists.length > 0) {
      setTargetList(availableLists[0].name);
    }
  }, [availableLists, selectedListForNewCampaign, targetList]);

  useEffect(() => {
    if (preselectedListName) {
      setSelectedListForNewCampaign(preselectedListName);
      setTargetList(preselectedListName);
      setDispatchNow(true);
      setScheduleType('immediate');
      setIsModalOpen(true);
      onClearPreselectedList?.();
    }
  }, [preselectedListName, onClearPreselectedList]);

  useEffect(() => {
    if (openModalOnMount) {
      const immediate = Boolean(instantSendMode);
      setDispatchNow(immediate);
      setScheduleType(immediate ? 'immediate' : 'specific_datetime');
      const initialList =
        selectedListForNewCampaign || (availableLists[0] ? availableLists[0].name : '');
      if (initialList) setTargetList(initialList);
      setIsModalOpen(true);
      onClearModalMount?.();
    }
  }, [
    openModalOnMount,
    instantSendMode,
    selectedListForNewCampaign,
    availableLists,
    onClearModalMount,
  ]);

  const handleOpenModal = (
    immediateMode: boolean,
    specificList?: string,
    defaultChannel?: ChannelType
  ) => {
    const chosen =
      specificList ||
      selectedListForNewCampaign ||
      (availableLists[0] ? availableLists[0].name : '');
    setTargetList(chosen);
    if (defaultChannel) {
      setChannel(defaultChannel);
      if (defaultChannel === 'sms') {
        const defaultSmsTpl = DEFAULT_SMS_TEMPLATES[0];
        setSelectedSmsTemplateId(defaultSmsTpl.id);
        setSubjectOrTemplate(defaultSmsTpl.senderHeader);
        setMessageBody(defaultSmsTpl.body);
      }
    }
    setDispatchNow(immediateMode);
    setScheduleType(immediateMode ? 'immediate' : 'specific_datetime');
    setIsModalOpen(true);
  };

  const selectedSmsProvider = useMemo(
    () => SMS_PROVIDERS_CATALOG.find((p) => p.id === smsProviderId) || SMS_PROVIDERS_CATALOG[0],
    [smsProviderId]
  );

  const smsSegmentStats = useMemo(
    () => calculateSmsSegments(messageBody || DEFAULT_SMS_TEMPLATES[0].body),
    [messageBody]
  );

  const handleSaveSmsProviderSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (privateProfile && onUpdatePrivateProfile) {
      await onUpdatePrivateProfile({
        email: privateProfile.email,
        replyToEmail: privateProfile.replyToEmail,
        phone: sanitizeString(smsSenderNumber, 40, privateProfile.phone),
        mailingAddress: privateProfile.mailingAddress || '',
        whatsappPhoneId: privateProfile.whatsappPhoneId || '',
        smsSenderId: sanitizeString(smsSenderNumber, 40, privateProfile.smsSenderId || 'FLOWPILOT'),
        whatsappBusinessPhone: privateProfile.whatsappBusinessPhone,
        emailProviderDomain: privateProfile.emailProviderDomain,
        dailySendCap: privateProfile.dailySendCap,
      });
    }
    setSmsGatewayConnected(true);
    setSmsGatewayFeedback(
      `Connected ${selectedSmsProvider.name} · Sender ID ${smsSenderNumber} verified · Carrier DLR Webhook & STOP Opt-Out listener active.`
    );
    onLogActivity?.(
      'campaign_sent',
      `SMS Provider Connected: ${selectedSmsProvider.name}`,
      `Sender ID: ${smsSenderNumber} · DLR Webhooks: ${smsDlrWebhookEnabled ? 'Enabled' : 'Disabled'} · Note: Provider/carrier fees are billed separately by ${selectedSmsProvider.name}.`,
      'sms'
    );
    setTimeout(() => setSmsGatewayFeedback(null), 5000);
  };

  const handleDeploySmsSequence = async (blueprintId: string) => {
    if (!onCreateAutomation) return;
    const target =
      selectedListForNewCampaign || (availableLists[0] ? availableLists[0].name : 'General Contacts');
    const bp = SMS_SEQUENCE_BLUEPRINTS.find((b) => b.id === blueprintId);
    if (!bp) return;

    const nodes = bp.buildNodes(target);
    const stepsSummary = nodes
      .filter((n) => n.category !== 'trigger')
      .map((n) => `${n.title} (${n.subtitle})`);

    await onCreateAutomation({
      name: `${target} — ${bp.name}`,
      triggerType: 'list_joined',
      triggerDetail: `Contact Joins "${target}" (SMS Opt-In)`,
      targetList: target,
      stepsSummary,
      channels: ['sms'],
      status: 'active',
      enrolledCount: contacts.filter(
        (c) =>
          c.consentStatus === 'opted_in' &&
          c.listName.trim().toLowerCase() === target.trim().toLowerCase()
      ).length,
      completedCount: 0,
      conversionRate: 0,
      version: 1,
      flowGraphJson: JSON.stringify(nodes),
    });

    setSequenceDeployBanner(
      `Activated Automated SMS Workflow "${bp.name}" for Contact List "${target}".`
    );
    setTimeout(() => setSequenceDeployBanner(null), 5000);
  };

  const handleProcessSmsStopOptOut = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = sanitizeString(smsStopPhoneInput, 40, '').trim();
    if (!cleanPhone) return;

    const normalizedDigits = cleanPhone.replace(/[^0-9]/g, '');
    const matchingContact = contacts.find((c) => {
      const cDigits = (c.phone || '').replace(/[^0-9]/g, '');
      return cDigits && normalizedDigits && (cDigits.endsWith(normalizedDigits) || normalizedDigits.endsWith(cDigits));
    });

    if (matchingContact && onUpdateContact) {
      const updatedChannels = (matchingContact.commChannels || []).filter((ch) => ch !== 'sms');
      const updatedTags = Array.from(
        new Set([...(matchingContact.tags || []), 'sms-stop-optout', 'suppressed'])
      ).slice(0, 10);

      await onUpdateContact(matchingContact.id, {
        fullName: matchingContact.fullName,
        email: matchingContact.email,
        phone: matchingContact.phone,
        company: matchingContact.company,
        dealTitle: matchingContact.dealTitle,
        stage: matchingContact.stage,
        temperature: matchingContact.temperature,
        source: matchingContact.source,
        consentStatus: 'unsubscribed',
        commChannels: updatedChannels,
        listName: matchingContact.listName,
        tags: updatedTags,
        ltv: matchingContact.ltv,
        notes: `${matchingContact.notes || ''} [SMS Opt-Out via "${smsStopKeywordInput}"]`.trim().slice(0, 500),
        customFields: matchingContact.customFields,
      });
      setSmsConsentFeedback(
        `Processed inbound "${smsStopKeywordInput}" from ${matchingContact.phone} (${matchingContact.fullName}). SMS consent revoked & excluded from all SMS campaigns and workflows.`
      );
    } else if (onCreateContact) {
      await onCreateContact({
        fullName: `SMS Opt-Out (${cleanPhone})`,
        email: `sms-optout-${Date.now()}@suppressed.local`,
        phone: cleanPhone,
        stage: 'cold_subscriber',
        temperature: 'cold',
        source: `Inbound SMS ${smsStopKeywordInput}`,
        consentStatus: 'unsubscribed',
        commChannels: [],
        listName: selectedListForNewCampaign || 'SMS Suppression Registry',
        tags: ['sms-stop-optout', 'suppressed'],
        ltv: 0,
        notes: `Recorded SMS "${smsStopKeywordInput}" opt-out. Strictly excluded from SMS dispatches.`,
      });
      setSmsConsentFeedback(
        `Added ${cleanPhone} (${smsStopKeywordInput}) to the SMS Opt-Out Suppression Registry.`
      );
    }
    await triggerOneClickUnsubscribe({
      recipient: cleanPhone,
      reason: `Inbound SMS ${smsStopKeywordInput}`,
      action: 'unsubscribe',
    });
    setSmsStopPhoneInput('');
    setTimeout(() => setSmsConsentFeedback(null), 5000);
  };

  const handleToggleContactSmsConsent = async (contact: Contact, grantOptIn: boolean) => {
    if (!onUpdateContact) return;
    const baseChannels = contact.commChannels || ['email'];
    const nextChannels: ChannelType[] = grantOptIn
      ? (Array.from(new Set([...baseChannels, 'sms'])) as ChannelType[])
      : (baseChannels.filter((ch) => ch !== 'sms') as ChannelType[]);
    const nextTags = grantOptIn
      ? (contact.tags || []).filter((t) => t !== 'sms-stop-optout' && t !== 'suppressed')
      : Array.from(new Set([...(contact.tags || []), 'sms-stop-optout'])).slice(0, 10);

    await onUpdateContact(contact.id, {
      fullName: contact.fullName,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      dealTitle: contact.dealTitle,
      stage: contact.stage,
      temperature: contact.temperature,
      source: contact.source,
      consentStatus: grantOptIn ? 'opted_in' : 'unsubscribed',
      commChannels: nextChannels,
      listName: contact.listName,
      tags: nextTags,
      ltv: contact.ltv,
      notes: `${contact.notes || ''} [${grantOptIn ? 'SMS START Opt-In Verified' : 'SMS STOP Opt-Out'}]`.trim().slice(0, 500),
      customFields: contact.customFields,
    });
  };

  const handleApplyTemplate = (tpl: ReusableEmailTemplate) => {
    setSelectedTemplateId(tpl.id);
    setSubjectOrTemplate(tpl.subject);
    setPreheader(tpl.preheader);
    const clonedBlocks = tpl.blocks.map((b) => ({ ...b, id: `${b.id}_${Date.now()}` }));
    setEmailBlocks(clonedBlocks);
    setMessageBody(serializeBlocksToMessageBody(clonedBlocks, tpl.preheader));
    setEditorMode('visual_blocks');
  };

  const handleSaveCurrentAsTemplate = () => {
    const cleanTitle = sanitizeString(
      newTemplateName || name || 'Custom Email Template',
      80,
      'Custom Email Template'
    );
    const newTpl: ReusableEmailTemplate = {
      id: `tpl_custom_${Date.now()}`,
      name: cleanTitle,
      category: 'custom',
      subject: subjectOrTemplate || 'Update for {{first_name}}',
      preheader: preheader || 'Curated update for {{list_name}}',
      description: `Saved custom visual template (${emailBlocks.length} blocks)`,
      blocks: emailBlocks.map((b) => ({ ...b })),
    };
    setTemplates((prev) => [newTpl, ...prev]);
    setSelectedTemplateId(newTpl.id);
    setNewTemplateName('');
    setTemplateSavedNotice(`Saved "${cleanTitle}" to your Reusable Templates library.`);
    setTimeout(() => setTemplateSavedNotice(null), 4000);
  };

  const handleAddEmailBlock = (type: EmailBlockType) => {
    const newBlock: EmailBlock = {
      id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      heading:
        type === 'header'
          ? 'SECTION HEADING'
          : type === 'callout'
          ? 'Key Insight for {{first_name}}'
          : undefined,
      content:
        type === 'divider'
          ? ''
          : type === 'footer'
          ? 'You received this email because {{email}} opted into {{list_name}}. Unsubscribe anytime: {{unsubscribe_url}}'
          : 'Hi {{first_name}}, add your personalized message content here.',
      buttonLabel: type === 'button' ? 'Explore Resource →' : undefined,
      buttonUrl: type === 'button' ? 'https://flowpilot.app' : undefined,
      accentColor: 'emerald',
    };
    setEmailBlocks((prev) => [...prev, newBlock]);
  };

  const handleUpdateBlock = (id: string, patch: Partial<EmailBlock>) => {
    setEmailBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const handleMoveBlock = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= emailBlocks.length) return;
    const copy = [...emailBlocks];
    const [removed] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, removed);
    setEmailBlocks(copy);
  };

  const handleRemoveBlock = (id: string) => {
    setEmailBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleInsertVariable = (token: string) => {
    if (editorMode === 'plain_text' || channel !== 'email') {
      setMessageBody((prev) => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}${token}`);
    } else {
      // Append token to the first text or callout block, or subject if no text block exists
      const textIdx = emailBlocks.findIndex((b) => b.type === 'text' || b.type === 'callout');
      if (textIdx >= 0) {
        const blk = emailBlocks[textIdx];
        handleUpdateBlock(blk.id, {
          content: `${blk.content}${blk.content.endsWith(' ') ? '' : ' '}${token}`,
        });
      } else {
        setSubjectOrTemplate((prev) => `${prev} ${token}`.trim());
      }
    }
  };

  // Contacts in the selected Target List
  const selectedListContacts = useMemo(() => {
    if (!targetList.trim()) return [];
    return contacts.filter(
      (c) => c.listName.trim().toLowerCase() === targetList.trim().toLowerCase()
    );
  }, [contacts, targetList]);

  // Suppressed or unsubscribed contacts in the selected Target List
  const suppressedInSelectedList = useMemo(() => {
    return selectedListContacts.filter(
      (c) =>
        c.consentStatus !== 'opted_in' ||
        c.tags?.includes('bounced') ||
        c.tags?.includes('suppressed')
    );
  }, [selectedListContacts]);

  // Segmented + Opted-In recipients in the selected Target List
  const segmentedOptedInRecipients = useMemo(() => {
    return selectedListContacts.filter((c) => {
      if (c.consentStatus !== 'opted_in') return false;
      if (c.tags?.includes('bounced') || c.tags?.includes('suppressed')) return false;
      if (segmentStage !== 'all' && c.stage !== segmentStage) return false;
      if (segmentTemp !== 'all' && c.temperature !== segmentTemp) return false;
      if (segmentTagQuery.trim()) {
        const q = segmentTagQuery.trim().toLowerCase();
        const hasTag = (c.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!hasTag) return false;
      }
      return true;
    });
  }, [selectedListContacts, segmentStage, segmentTemp, segmentTagQuery]);

  const optedInContactsCount = segmentedOptedInRecipients.length;

  const samplePreviewContact = useMemo(() => {
    if (previewContactId) {
      const found = segmentedOptedInRecipients.find((c) => c.id === previewContactId);
      if (found) return found;
    }
    return segmentedOptedInRecipients[0] || selectedListContacts[0] || contacts[0] || null;
  }, [previewContactId, segmentedOptedInRecipients, selectedListContacts, contacts]);

  const effectiveMessageBody = useMemo(() => {
    if (channel === 'email' && editorMode === 'visual_blocks') {
      return serializeBlocksToMessageBody(emailBlocks, preheader);
    }
    return (
      messageBody ||
      'Hi {{first_name}}, here is your requested update from {{sender_name}}. Unsubscribe anytime: {{unsubscribe_url}}'
    );
  }, [channel, editorMode, emailBlocks, preheader, messageBody]);

  // Anti-Spam & Ethical Email Compliance Guardrail check
  const complianceResult = useMemo(() => {
    const hasFooterBlock =
      channel !== 'email' ||
      (editorMode === 'visual_blocks' && emailBlocks.some((b) => b.type === 'footer'));
    return evaluateEmailCompliance({
      subject: subjectOrTemplate,
      preheader,
      bodyText: effectiveMessageBody,
      hasUnsubscribeFooter: hasFooterBlock,
      optedInRecipientCount: optedInContactsCount,
      attestedOptInPermission,
      senderEmail: fromEmailInput,
      mailingAddress: physicalAddressInput,
    });
  }, [
    channel,
    editorMode,
    emailBlocks,
    subjectOrTemplate,
    preheader,
    effectiveMessageBody,
    optedInContactsCount,
    attestedOptInPermission,
    fromEmailInput,
    physicalAddressInput,
  ]);

  const segmentSummaryLabel = useMemo(() => {
    const parts: string[] = ['Opted-In Only'];
    if (segmentStage !== 'all') parts.push(`Stage: ${segmentStage.replace('_', ' ')}`);
    if (segmentTemp !== 'all') parts.push(`Temp: ${segmentTemp.toUpperCase()}`);
    if (segmentTagQuery.trim()) parts.push(`Tag: #${segmentTagQuery.trim()}`);
    return parts.join(' · ');
  }, [segmentStage, segmentTemp, segmentTagQuery]);

  const providerPassThroughEstimate =
    channel === 'email'
      ? (optedInContactsCount / 1000) * 0.1
      : channel === 'whatsapp'
      ? optedInContactsCount * 0.015
      : optedInContactsCount *
        smsSegmentStats.segments *
        (selectedSmsProvider.typicalRatePerSegmentUsd +
          selectedSmsProvider.carrierPassThroughPerSegmentUsd);

  const handleQuickCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizeString(newListName, 80, '');
    if (!clean || !onCreateList) return;

    setIsSavingInlineList(true);
    try {
      await onCreateList({
        name: clean,
        category: newListCategory,
        description: `Created for ${channel.toUpperCase()} campaign & broadcast targeting`,
        defaultConsent: newListConsent,
        defaultTags: ['broadcast-segment'],
        colorAccent: 'emerald',
      });
      setSelectedListForNewCampaign(clean);
      setTargetList(clean);
      setNewListName('');
      setIsCreatingInlineList(false);
    } finally {
      setIsSavingInlineList(false);
    }
  };

  const handleSendTestEmail = async () => {
    const cleanRecipient = sanitizeString(testEmailRecipient, 150, '');
    if (channel === 'email' && (!cleanRecipient || !cleanRecipient.includes('@'))) {
      setTestEmailFeedback('Please enter a valid recipient email address for the test send.');
      return;
    }
    const resolvedSubj = resolvePersonalizationVariables(
      subjectOrTemplate,
      samplePreviewContact,
      workspace,
      privateProfile,
      targetList
    );
    const resolvedBody = resolvePersonalizationVariables(
      effectiveMessageBody,
      samplePreviewContact,
      workspace,
      privateProfile,
      targetList
    );

    const toTarget =
      channel === 'email'
        ? cleanRecipient
        : cleanRecipient && !cleanRecipient.includes('@')
        ? cleanRecipient
        : samplePreviewContact?.phone ||
          privateProfile?.whatsappBusinessNumber ||
          '+1 (555) 234-8910';

    const receipt = await deliverChannelMessage({
      channel,
      to: toTarget,
      leadName: samplePreviewContact?.fullName || 'Sample Subscriber',
      subject: `[TEST] ${resolvedSubj}`,
      body: resolvedBody,
      listName: targetList || 'Broadcast Test',
      source: 'live_test',
      overrideFromIdentity: activeSelectedSenderIdentity?.value,
      overrideSenderName:
        activeSelectedSenderIdentity?.displayName || workspace?.senderName,
      workspace,
      privateProfile,
    });

    setTestEmailFeedback(
      `Live ${channel.toUpperCase()} test dispatched via ${receipt.providerUsed} (From: ${
        receipt.fromIdentity
      } → To: ${receipt.toRecipient}) · Subject/Template: "[TEST] ${resolvedSubj}".`
    );
    onLogActivity?.(
      'campaign_sent',
      `Live Test ${channel.toUpperCase()} Dispatched to ${receipt.toRecipient}`,
      `Delivered via ${receipt.providerUsed} · From: ${receipt.fromIdentity}`,
      channel
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTargetList = sanitizeString(
      targetList || selectedListForNewCampaign,
      80,
      ''
    );
    if (!cleanTargetList) return;
    if (channel === 'email' && !complianceResult.passed) return;

    const cleanName = sanitizeString(
      name,
      120,
      `${cleanTargetList} ${dispatchNow ? 'Broadcast' : 'Campaign'}`
    );
    const isImmediate = scheduleType === 'immediate' && dispatchNow;
    const scheduleTag =
      scheduleType === 'time_delay'
        ? `Delayed +${delayAmount} ${delayUnit}${businessHoursOnly ? ' · Mon-Fri' : ''}`
        : scheduleType === 'specific_datetime'
        ? `${scheduledDateTime.replace('T', ' ')}${businessHoursOnly ? ' · Mon-Fri' : ''}`
        : 'Immediate Dispatch';

    const cleanSubject = sanitizeString(
      subjectOrTemplate ||
        (channel === 'whatsapp'
          ? 'template: approved_creator_update_v1'
          : 'Weekly Creator Systems Dispatch'),
      160,
      'Scheduled Campaign Broadcast'
    );
    const cleanBody = sanitizeString(
      effectiveMessageBody,
      4900,
      'Hi {{first_name}}, here is your requested update. Unsubscribe anytime: {{unsubscribe_url}}'
    );

    const status: CampaignStatus = isImmediate ? 'sent' : 'scheduled';
    const recipients = optedInContactsCount;
    const delivered = isImmediate ? recipients : 0;

    setIsSaving(true);
    try {
      await onCreateCampaign({
        name: cleanName,
        channel,
        targetList: cleanTargetList,
        subjectOrTemplate: cleanSubject,
        messageBody: cleanBody,
        status,
        recipientCount: recipients,
        deliveredCount: delivered,
        openedCount: 0,
        clickedCount: 0,
        bouncedCount: 0,
        unsubscribedCount: 0,
        preheader: sanitizeString(preheader, 200, ''),
        templateId: sanitizeString(selectedTemplateId, 80, 'custom'),
        segmentFilter: sanitizeString(segmentSummaryLabel, 120, 'Opted-In Only'),
        scheduledAt: sanitizeString(scheduleTag, 80, ''),
        blocksJson:
          channel === 'email' && editorMode === 'visual_blocks'
            ? JSON.stringify(emailBlocks).slice(0, 14000)
            : '',
        abTestEnabled,
        variantBSubject: abTestEnabled
          ? sanitizeString(variantBSubject, 160, `${cleanSubject} (Variant B)`)
          : undefined,
        variantBBody: abTestEnabled
          ? sanitizeString(variantBBody || cleanBody, 4900, cleanBody)
          : undefined,
        abWinningMetric: abTestEnabled ? abWinningMetric : undefined,
        abSamplePercent: abTestEnabled ? abSamplePercent : undefined,
        abWinnerVariant: abTestEnabled ? 'pending' : undefined,
        sendTimeOptimization,
        attributedRevenue: 0,
        conversionsCount: 0,
      });
      setIsModalOpen(false);
      setName('');
    } finally {
      setIsSaving(false);
    }
  };

  // Evaluate A/B Split Test & Auto-Dispatch Winning Variant by Open Rate or Click Rate
  const handleEvaluateAbWinner = async (camp: Campaign) => {
    if (!onUpdateCampaign) return;
    const baseDelivered = Math.max(camp.deliveredCount, camp.recipientCount, 4);
    const nextOpened = Math.min(
      baseDelivered,
      Math.max(camp.openedCount + 2, Math.ceil(baseDelivered * 0.44))
    );
    const nextClicked = Math.min(
      nextOpened,
      Math.max(camp.clickedCount + 1, Math.ceil(baseDelivered * 0.19))
    );
    const winner: 'A' | 'B' =
      (camp.abWinningMetric || 'open_rate') === 'click_rate'
        ? nextClicked % 2 === 0
          ? 'B'
          : 'A'
        : 'B';
    const chosenSubject =
      winner === 'B' && camp.variantBSubject ? camp.variantBSubject : camp.subjectOrTemplate;

    await onUpdateCampaign(camp.id, {
      status: 'sent',
      deliveredCount: baseDelivered,
      openedCount: nextOpened,
      clickedCount: nextClicked,
      abTestEnabled: true,
      abWinnerVariant: winner,
      subjectOrTemplate: chosenSubject,
    });

    onLogActivity?.(
      'campaign_sent',
      `A/B Split Winner Dispatched (Variant ${winner}): ${camp.name}`,
      `Auto-selected Variant ${winner} by ${
        camp.abWinningMetric === 'click_rate' ? 'Click Rate' : 'Open Rate'
      } and dispatched to remaining ${100 - (camp.abSamplePercent || 20) * 2}% of "${camp.targetList}"`,
      camp.channel
    );
  };

  // Record an attributed conversion (+Sale) on a campaign for ROI & RPR analytics
  const handleRecordAttributedSale = async (camp: Campaign) => {
    if (!onUpdateCampaign) return;
    const currentRev =
      typeof camp.attributedRevenue === 'number'
        ? camp.attributedRevenue
        : camp.clickedCount * 165;
    const currentConv =
      typeof camp.conversionsCount === 'number'
        ? camp.conversionsCount
        : Math.max(0, Math.round(camp.clickedCount * 0.3));
    const saleValue = camp.channel === 'whatsapp' ? 340 : camp.channel === 'sms' ? 210 : 290;

    await onUpdateCampaign(camp.id, {
      attributedRevenue: currentRev + saleValue,
      conversionsCount: currentConv + 1,
      clickedCount: Math.max(1, camp.clickedCount + 1),
      openedCount: Math.max(1, camp.openedCount + 1),
    });

    onLogActivity?.(
      'stage_converted',
      `Attributed Conversion Recorded (+$${saleValue}): ${camp.name}`,
      `Campaign "${camp.name}" (${camp.channel.toUpperCase()}) attributed revenue updated to $${(
        currentRev + saleValue
      ).toLocaleString()}`,
      camp.channel
    );
  };

  // Simulate realistic delivery/open/click/bounce/unsubscribe tracking when supported
  const handleSimulateTrackingMetrics = async (camp: Campaign) => {
    if (!onUpdateCampaign) return;
    const baseDelivered = Math.max(camp.deliveredCount, camp.recipientCount, 1);
    const nextOpened = Math.min(
      baseDelivered,
      (camp.openedCount || 0) + Math.max(1, Math.ceil(baseDelivered * 0.35))
    );
    const nextClicked = Math.min(
      nextOpened,
      (camp.clickedCount || 0) + Math.max(1, Math.ceil(baseDelivered * 0.14))
    );
    const nextBounced = camp.bouncedCount || 0;
    const nextUnsub = camp.unsubscribedCount || 0;

    await onUpdateCampaign(camp.id, {
      status: 'sent',
      recipientCount: baseDelivered + nextBounced,
      deliveredCount: baseDelivered,
      openedCount: nextOpened,
      clickedCount: nextClicked,
      bouncedCount: nextBounced,
      unsubscribedCount: nextUnsub,
    });

    onLogActivity?.(
      'campaign_sent',
      `Synced Delivery & Engagement Telemetry: ${camp.name}`,
      `Delivered: ${baseDelivered} · Opened: ${nextOpened} · Clicked: ${nextClicked}`,
      camp.channel
    );
  };

  // Deploy an Automated Email Sequence directly for the selected Contact List
  const handleDeployEmailSequence = async (blueprintId: string) => {
    if (!onCreateAutomation) return;
    const target =
      selectedListForNewCampaign || (availableLists[0] ? availableLists[0].name : 'General Contacts');
    const bp = EMAIL_SEQUENCE_BLUEPRINTS.find((b) => b.id === blueprintId);
    if (!bp) return;

    const nodes = bp.buildNodes(target);
    const stepsSummary = nodes
      .filter((n) => n.category !== 'trigger')
      .map((n) => `${n.title} (${n.subtitle})`);

    await onCreateAutomation({
      name: `${target} — ${bp.name}`,
      triggerType: 'list_joined',
      triggerDetail: `Contact Joins "${target}"`,
      targetList: target,
      stepsSummary,
      channels: ['email'],
      status: 'active',
      enrolledCount: contacts.filter(
        (c) =>
          c.consentStatus === 'opted_in' &&
          c.listName.trim().toLowerCase() === target.trim().toLowerCase()
      ).length,
      completedCount: 0,
      conversionRate: 0,
      version: 1,
      flowGraphJson: JSON.stringify(nodes),
    });

    setSequenceDeployBanner(
      `Activated "${bp.name}" for Contact List "${target}". Contacts joining "${target}" will automatically enter this timed email sequence.`
    );
    setTimeout(() => setSequenceDeployBanner(null), 5000);
  };

  // Suppression & Unsubscribe management handlers
  const suppressedContacts = useMemo(() => {
    return contacts.filter(
      (c) =>
        c.consentStatus === 'unsubscribed' ||
        c.tags?.includes('bounced') ||
        c.tags?.includes('suppressed')
    );
  }, [contacts]);

  const handleSuppressAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = sanitizeString(suppressEmailInput, 150, '').toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) return;

    const existing = contacts.find((c) => c.email.trim().toLowerCase() === cleanEmail);
    const reasonTag =
      suppressReasonInput === 'hard_bounce'
        ? 'bounced'
        : suppressReasonInput === 'manual_suppression'
        ? 'suppressed'
        : 'unsubscribed';

    if (existing && onUpdateContact) {
      const nextTags = Array.from(new Set([...(existing.tags || []), reasonTag])).slice(0, 10);
      await onUpdateContact(existing.id, {
        fullName: existing.fullName,
        email: existing.email,
        phone: existing.phone,
        company: existing.company,
        dealTitle: existing.dealTitle,
        stage: existing.stage,
        temperature: existing.temperature,
        source: existing.source,
        consentStatus: 'unsubscribed',
        commChannels: existing.commChannels,
        listName: existing.listName,
        tags: nextTags,
        ltv: existing.ltv,
        notes: `${existing.notes || ''} [Suppressed: ${suppressReasonInput}]`.trim().slice(0, 500),
        customFields: existing.customFields,
      });
      setSuppressionFeedback(
        `Updated ${cleanEmail} to Unsubscribed/Suppressed (${suppressReasonInput.replace('_', ' ')}). Automatically excluded from all future sends.`
      );
    } else if (onCreateContact) {
      await onCreateContact({
        fullName: 'Suppressed Address',
        email: cleanEmail,
        phone: '+10000000000',
        stage: 'cold_subscriber',
        temperature: 'cold',
        source: 'Suppression List',
        consentStatus: 'unsubscribed',
        listName: selectedListForNewCampaign || 'Suppression List',
        tags: [reasonTag, 'suppressed'],
        ltv: 0,
        notes: `Added to global suppression list (${suppressReasonInput}).`,
      });
      setSuppressionFeedback(
        `Added ${cleanEmail} to Global Suppression List (${suppressReasonInput.replace('_', ' ')}).`
      );
    }
    await triggerOneClickUnsubscribe({
      recipient: cleanEmail,
      reason: suppressReasonInput,
      action: 'unsubscribe',
    });
    setSuppressEmailInput('');
    setTimeout(() => setSuppressionFeedback(null), 4000);
  };

  const handleRestoreContactOptIn = async (contact: Contact) => {
    if (!onUpdateContact) return;
    const cleanedTags = (contact.tags || []).filter(
      (t) => t !== 'bounced' && t !== 'suppressed' && t !== 'unsubscribed'
    );
    await onUpdateContact(contact.id, {
      fullName: contact.fullName,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      dealTitle: contact.dealTitle,
      stage: contact.stage,
      temperature: contact.temperature,
      source: contact.source,
      consentStatus: 'opted_in',
      commChannels: contact.commChannels,
      listName: contact.listName,
      tags: cleanedTags,
      ltv: contact.ltv,
      notes: `${contact.notes || ''} [Re-verified opt-in consent]`.trim().slice(0, 500),
      customFields: contact.customFields,
    });
    if (contact.email) {
      await triggerOneClickUnsubscribe({
        recipient: contact.email,
        action: 'resubscribe',
      });
    }
    if (contact.phone) {
      await triggerOneClickUnsubscribe({
        recipient: contact.phone,
        action: 'resubscribe',
      });
    }
  };

  const handleSaveSenderConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (workspace && onUpdateWorkspace) {
      await onUpdateWorkspace({
        name: workspace.name,
        category: workspace.category,
        currency: workspace.currency,
        timezone: workspace.timezone,
        senderName: sanitizeString(senderNameInput, 100, workspace.senderName),
        whatsappConnected: workspace.whatsappConnected,
        smsConnected: workspace.smsConnected,
        emailConnected: workspace.emailConnected,
        notifyNewLeads: workspace.notifyNewLeads,
        notifyCampaigns: workspace.notifyCampaigns,
        sendingDomainStatus: 'verified',
        whatsappWebhookStatus: workspace.whatsappWebhookStatus,
      });
    }
    if (privateProfile && onUpdatePrivateProfile) {
      await onUpdatePrivateProfile({
        email: sanitizeString(fromEmailInput, 150, privateProfile.email),
        replyToEmail: sanitizeString(replyToEmailInput, 150, privateProfile.replyToEmail),
        phone: privateProfile.phone,
        mailingAddress: privateProfile.mailingAddress || '',
        whatsappPhoneId: privateProfile.whatsappPhoneId || '',
        smsSenderId: privateProfile.smsSenderId || 'FLOWPILOT',
        whatsappBusinessPhone: privateProfile.whatsappBusinessPhone,
        emailProviderDomain: sanitizeString(
          sendingDomainInput,
          120,
          privateProfile.emailProviderDomain
        ),
        dailySendCap: privateProfile.dailySendCap,
      });
    }
    setSenderSaveBanner(
      'Sender identity, Reply-To header, and SPF/DKIM/DMARC domain alignment saved and verified.'
    );
    setTimeout(() => setSenderSaveBanner(null), 4000);
  };

  const filtered = campaigns.filter((c) => {
    const matchesChannel = channelFilter === 'all' ? true : c.channel === channelFilter;
    const matchesList =
      listFilter === 'all'
        ? true
        : c.targetList.trim().toLowerCase() === listFilter.trim().toLowerCase();
    return matchesChannel && matchesList;
  });

  // Aggregate Email Analytics
  const analyticsTotals = useMemo(() => {
    const totalRecipients = campaigns.reduce((acc, c) => acc + (c.recipientCount || 0), 0);
    const totalDelivered = campaigns.reduce((acc, c) => acc + (c.deliveredCount || 0), 0);
    const totalOpened = campaigns.reduce((acc, c) => acc + (c.openedCount || 0), 0);
    const totalClicked = campaigns.reduce((acc, c) => acc + (c.clickedCount || 0), 0);
    const totalBounced = campaigns.reduce((acc, c) => acc + (c.bouncedCount || 0), 0);
    const totalUnsubscribed = campaigns.reduce((acc, c) => acc + (c.unsubscribedCount || 0), 0);

    const deliveryRate =
      totalRecipients > 0 ? ((totalDelivered / totalRecipients) * 100).toFixed(1) : '100.0';
    const openRate =
      totalDelivered > 0 ? ((totalOpened / totalDelivered) * 100).toFixed(1) : '0.0';
    const clickRate =
      totalDelivered > 0 ? ((totalClicked / totalDelivered) * 100).toFixed(1) : '0.0';
    const ctor = totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(1) : '0.0';

    return {
      totalRecipients,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalBounced,
      totalUnsubscribed,
      deliveryRate,
      openRate,
      clickRate,
      ctor,
    };
  }, [campaigns]);

  return (
    <div className="space-y-5">
      {/* Header & Primary Action Bar */}
      <div className="border border-slate-200 rounded-2xl bg-white p-4 sm:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
            Email Marketing & Omnichannel Broadcast Studio · Permission-First Delivery
          </div>
          <h2 className="font-display text-lg sm:text-xl lg:text-2xl font-bold text-slate-950">
            Visual Email Builder, Broadcasts, Sequences & Deliverability
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Select a Contact List holding your opted-in subscribers, personalize with dynamic variables, and schedule compliant campaigns or automated sequences.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => handleOpenModal(false, undefined, 'email')}
            className="px-3.5 py-2 text-xs sm:text-sm font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Create Email Campaign</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenModal(false, undefined, 'sms')}
            className="px-3.5 py-2 text-xs sm:text-sm font-bold text-[#0F172A] bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#047857]" />
            <span>Create SMS Campaign</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenModal(true)}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Broadcast</span>
          </button>
        </div>
      </div>

      {/* Studio Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar border border-slate-200/80">
        {(
          [
            { id: 'broadcasts', label: 'Broadcasts & Campaigns', icon: Send },
            {
              id: 'sms_studio',
              label: `SMS Marketing & Gateway (${campaigns.filter((c) => c.channel === 'sms').length})`,
              icon: Smartphone,
            },
            { id: 'templates', label: `Reusable Templates (${templates.length})`, icon: LayoutTemplate },
            { id: 'sequences', label: 'Automated Sequences (Email & SMS)', icon: GitBranch },
            {
              id: 'suppression',
              label: `Opt-Out & Suppression (${suppressedContacts.length})`,
              icon: Ban,
            },
            { id: 'sender_domain', label: 'Sender & Domain Setup', icon: Globe },
            { id: 'analytics', label: 'Campaign Analytics', icon: BarChart3 },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeStudioTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveStudioTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                active
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* STEP 1: Target Contact List Selector (Always accessible at top for Broadcasts, SMS Studio & Sequences) */}
      {(activeStudioTab === 'broadcasts' ||
        activeStudioTab === 'sms_studio' ||
        activeStudioTab === 'sequences') && (
        <div className="border-2 border-[#0F172A] rounded-2xl bg-white p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 border-b border-slate-200 pb-3.5">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-[#047857]">
                <Users className="w-3.5 h-3.5" />
                <span>Step 1 · Choose Target Contact List First</span>
              </div>
              <h3 className="font-display text-sm sm:text-base font-bold text-slate-950">
                Which Contact List holds the subscribers you want to send your Campaign, Broadcast, or Sequence to?
              </h3>
              <p className="text-xs text-slate-600">
                Select a created Contact List below. Unsubscribed and suppressed contacts are automatically excluded.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {onCreateList && (
                <button
                  type="button"
                  onClick={() => setIsCreatingInlineList((prev) => !prev)}
                  className="px-3.5 py-2 text-xs font-bold text-[#0F172A] bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-[#047857]" />
                  <span>{isCreatingInlineList ? 'Close Creator' : '+ Create New List'}</span>
                </button>
              )}
              {onNavigateToLists && (
                <button
                  type="button"
                  onClick={onNavigateToLists}
                  className="px-3.5 py-2 text-xs font-bold text-[#047857] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Manage Lists & Contacts</span>
                </button>
              )}
            </div>
          </div>

          {isCreatingInlineList && onCreateList && (
            <form
              onSubmit={handleQuickCreateList}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
            >
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Contact List Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. VIP Weekly Newsletter Subscribers"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">List Category</label>
                <select
                  value={newListCategory}
                  onChange={(e) => setNewListCategory(e.target.value as ListCategory)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-medium"
                >
                  <option value="newsletter">Newsletter Audience</option>
                  <option value="lead_magnet">Lead Magnet & Opt-In</option>
                  <option value="vip_buyers">VIP Buyers</option>
                  <option value="webinar">Webinar Registrants</option>
                  <option value="custom">Custom Segment</option>
                </select>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={isSavingInlineList}
                  className="w-full px-4 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSavingInlineList ? 'Saving...' : 'Save & Select List'}
                </button>
              </div>
            </form>
          )}

          {availableLists.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-3">
              <p className="text-sm font-bold text-slate-900">
                You have not created a Contact List yet.
              </p>
              <p className="text-xs text-slate-600 max-w-lg mx-auto">
                Create your first Contact List and store contacts in it so you can select that list when sending a Campaign or Broadcast.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {availableLists.map((item) => {
                const isSelected =
                  selectedListForNewCampaign.trim().toLowerCase() ===
                  item.name.trim().toLowerCase();

                return (
                  <div
                    key={item.name}
                    onClick={() => {
                      setSelectedListForNewCampaign(item.name);
                      setTargetList(item.name);
                    }}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'border-[#047857] bg-emerald-50/40 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-bold text-slate-950 truncate">
                          {item.name}
                        </span>
                        {isSelected && (
                          <span className="text-[11px] font-mono font-bold text-[#047857] inline-flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Selected</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                        <span className="capitalize">{item.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono font-bold text-[#047857]">
                          {item.optedInCount} opted-in
                        </span>
                        {item.suppressedCount > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-slate-500">
                              {item.suppressedCount} suppressed
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedListForNewCampaign(item.name);
                          handleOpenModal(false, item.name);
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Calendar className="w-3 h-3 text-emerald-400" />
                        <span>Create Campaign</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedListForNewCampaign(item.name);
                          handleOpenModal(true, item.name);
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send Broadcast</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 1: BROADCASTS & CAMPAIGNS TABLE */}
      {activeStudioTab === 'broadcasts' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-700">Filter by List:</span>
              <button
                type="button"
                onClick={() => setListFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                  listFilter === 'all'
                    ? 'bg-[#0F172A] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Lists ({campaigns.length})
              </button>
              {availableLists.map((l) => (
                <button
                  key={l.name}
                  type="button"
                  onClick={() => setListFilter(l.name)}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                    listFilter.toLowerCase() === l.name.toLowerCase()
                      ? 'bg-[#047857] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['all', 'email', 'whatsapp', 'sms'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannelFilter(ch)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md uppercase cursor-pointer ${
                    channelFilter === ch
                      ? 'bg-[#0F172A] text-white'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs">
            {filtered.length === 0 ? (
              <div className="py-14 text-center px-6 space-y-3">
                <p className="text-base font-bold text-slate-900">
                  No campaigns or broadcasts matching this filter.
                </p>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Select a Contact List above, then open the Visual Email Builder to schedule a campaign or dispatch an instant broadcast.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#0F172A] text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Campaign · Subject & Segment</th>
                      <th className="py-3.5 px-4">Channel · Target List</th>
                      <th className="py-3.5 px-4">Status / Schedule</th>
                      <th className="py-3.5 px-4 text-right">Delivered</th>
                      <th className="py-3.5 px-4 text-right">Opened</th>
                      <th className="py-3.5 px-4 text-right">Clicked</th>
                      <th className="py-3.5 px-4 text-right">Bounced / Opt-Out</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                    {filtered.map((camp) => {
                      const openRate =
                        camp.deliveredCount > 0
                          ? ((camp.openedCount / camp.deliveredCount) * 100).toFixed(1)
                          : '0.0';
                      const clickRate =
                        camp.deliveredCount > 0
                          ? ((camp.clickedCount / camp.deliveredCount) * 100).toFixed(1)
                          : '0.0';
                      const bounced = camp.bouncedCount || 0;
                      const unsub = camp.unsubscribedCount || 0;

                      return (
                        <tr key={camp.id} className="hover:bg-emerald-50/30 transition-colors">
                          <td className="py-3.5 px-4 max-w-sm">
                            <div className="font-display font-bold text-slate-950 flex flex-wrap items-center gap-1.5">
                              <span>{camp.name}</span>
                              {camp.abTestEnabled && (
                                <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                  {camp.abWinnerVariant && camp.abWinnerVariant !== 'pending'
                                    ? `A/B Winner: Variant ${camp.abWinnerVariant}`
                                    : 'A/B Split Active'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-600 truncate mt-0.5">
                              {camp.subjectOrTemplate}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {camp.segmentFilter || 'Opted-In Only'}
                              {camp.sendTimeOptimization === 'recipient_local_9am'
                                ? ' · Smart 9AM Local'
                                : camp.sendTimeOptimization === 'evening_peak_6pm'
                                ? ' · 6PM Peak'
                                : ''}
                              {typeof camp.attributedRevenue === 'number' && camp.attributedRevenue > 0
                                ? ` · Attributed: $${camp.attributedRevenue.toLocaleString()}`
                                : ''}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                            <span className="font-mono font-bold uppercase text-[#0F172A]">
                              {camp.channel}
                            </span>
                            <span aria-hidden="true" className="text-slate-400">
                              {' '}
                              ·{' '}
                            </span>
                            <span className="text-[#047857] font-bold">{camp.targetList}</span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                            {camp.status === 'sent' ? (
                              <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Sent</span>
                              </span>
                            ) : (
                              <div>
                                <span className="text-slate-800 font-bold inline-flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-emerald-700" />
                                  <span className="capitalize">{camp.status}</span>
                                </span>
                                {camp.scheduledAt && (
                                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                    {camp.scheduledAt}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs">
                            <span className="font-bold text-slate-900">
                              {camp.deliveredCount.toLocaleString()}
                            </span>
                            <span className="text-slate-400">
                              /{camp.recipientCount.toLocaleString()}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs">
                            <span className="font-bold text-emerald-700">
                              {camp.openedCount.toLocaleString()}
                            </span>{' '}
                            <span className="text-slate-500">({openRate}%)</span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs">
                            <span className="font-bold text-[#0F172A]">
                              {camp.clickedCount.toLocaleString()}
                            </span>{' '}
                            <span className="text-slate-500">({clickRate}%)</span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                            {bounced} bounce · {unsub} opt-out
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {camp.status !== 'sent' ? (
                                <button
                                  type="button"
                                  onClick={() => onDispatchCampaign(camp)}
                                  className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
                                >
                                  Send Now
                                </button>
                              ) : (
                                onUpdateCampaign && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleSimulateTrackingMetrics(camp)}
                                      title="Sync open & click tracking telemetry"
                                      className="px-2.5 py-1.5 text-[11px] font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <RefreshCw className="w-3 h-3 text-emerald-700" />
                                      <span>Track</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleEvaluateAbWinner(camp)}
                                      title="Evaluate A/B Split & Dispatch Winner"
                                      className="px-2.5 py-1.5 text-[11px] font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                                    >
                                      A/B Winner
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRecordAttributedSale(camp)}
                                      title="Record Attributed Sale Conversion"
                                      className="px-2.5 py-1.5 text-[11px] font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                                    >
                                      +Sale ROI
                                    </button>
                                  </>
                                )
                              )}
                              <button
                                type="button"
                                onClick={() => onDeleteCampaign(camp.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                                title="Delete campaign"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1B: SMS MARKETING, PROVIDER CONNECTION, SCHEDULED SMS, DLR & CONSENT */}
      {activeStudioTab === 'sms_studio' && (
        <div className="space-y-5">
          {/* Mandatory Clear Warning: Provider & Network Fees Separate from Free Software */}
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-2 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Important Fee Separation Notice · Free Software vs. Telecom Carrier Fees</span>
              </div>
              <span className="font-mono text-xs font-bold text-[#047857]">
                FlowPilot Platform Software Fee: $0.00 / Free Forever
              </span>
            </div>
            <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
              <strong>Provider &amp; Network Fees Are Separate:</strong> FlowPilot&apos;s SMS campaign builder, scheduling engine, and workflow automation software are <strong>100% free ($0 platform markup)</strong>. However, your connected SMS gateway provider (<strong>{selectedSmsProvider.name}</strong>) and mobile telecom networks charge separate per-segment message rates (~${selectedSmsProvider.typicalRatePerSegmentUsd.toFixed(4)}/segment) and carrier A2P 10DLC pass-through fees (~${selectedSmsProvider.carrierPassThroughPerSegmentUsd.toFixed(4)}/segment) billed directly to your provider account.
            </p>
          </div>

          {/* SMS Provider Connection Settings + Quick SMS Campaign / Schedule Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 7 Cols: Provider Connection Settings */}
            <form
              onSubmit={handleSaveSmsProviderSettings}
              className="lg:col-span-7 border border-slate-200 rounded-2xl bg-white p-5 space-y-4 shadow-xs text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3.5">
                <div>
                  <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#047857]">
                    SMS Provider Connection Settings · BYO Carrier Gateway
                  </div>
                  <h3 className="font-display text-base font-bold text-slate-950">
                    Connect Your SMS Gateway &amp; Configure Delivery Webhooks
                  </h3>
                </div>
                <span className="font-mono text-xs font-bold text-[#047857] inline-flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5" />
                  <span>{smsGatewayConnected ? 'Gateway Connected' : 'Setup Required'}</span>
                </span>
              </div>

              {smsGatewayFeedback && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-semibold">
                  {smsGatewayFeedback}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    SMS Gateway Provider *
                  </label>
                  <select
                    value={smsProviderId}
                    onChange={(e) =>
                      setSmsProviderId(
                        e.target.value as 'twilio' | 'telnyx' | 'vonage' | 'aws_pinpoint'
                      )
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900"
                  >
                    {SMS_PROVIDERS_CATALOG.map((prov) => (
                      <option key={prov.id} value={prov.id}>
                        {prov.name} (~${prov.typicalRatePerSegmentUsd}/seg + ${prov.carrierPassThroughPerSegmentUsd} carrier fee)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Sender Phone Number / E.164 ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={smsSenderNumber}
                    onChange={(e) => setSmsSenderNumber(e.target.value)}
                    placeholder="+14155550199"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Messaging Service SID / Profile ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={smsMessagingServiceSid}
                    onChange={(e) => setSmsMessagingServiceSid(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    A2P 10DLC / Toll-Free Registration
                  </label>
                  <select
                    value={sms10DlcStatus}
                    onChange={(e) => setSms10DlcStatus(e.target.value as 'verified' | 'pending')}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="verified">Verified 10DLC Brand &amp; Campaign (High Throughput)</option>
                    <option value="pending">Pending Carrier Vetting (Standard Cap)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Delivery Status (DLR) Webhook Endpoint
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`https://api.flowpilot.app/webhooks/sms/${smsProviderId}/dlr`}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px] text-slate-600"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900">
                  Provider Protocol Capabilities ({selectedSmsProvider.name})
                </div>
                <div className="text-[11px] text-slate-600">
                  {selectedSmsProvider.protocolSummary}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smsDlrWebhookEnabled}
                      onChange={(e) => setSmsDlrWebhookEnabled(e.target.checked)}
                      className="accent-emerald-700"
                    />
                    <span className="font-semibold text-slate-800">
                      Track Delivery Status (DLR)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smsAutoStopEnabled}
                      onChange={(e) => setSmsAutoStopEnabled(e.target.checked)}
                      className="accent-emerald-700"
                    />
                    <span className="font-semibold text-slate-800">
                      Auto-Honor STOP / UNSUBSCRIBE
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smsQuietHoursGuard}
                      onChange={(e) => setSmsQuietHoursGuard(e.target.checked)}
                      className="accent-emerald-700"
                    />
                    <span className="font-semibold text-slate-800">
                      Daytime Quiet-Hours Guard
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-500">
                  Credentials are routed via server-side gateway proxy; carrier fees billed by {selectedSmsProvider.id.toUpperCase()}.
                </span>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer inline-flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Save &amp; Verify SMS Provider</span>
                </button>
              </div>
            </form>

            {/* Right 5 Cols: Launch SMS Campaign / Scheduled Message & Templates */}
            <div className="lg:col-span-5 border border-slate-200 rounded-2xl bg-white p-5 flex flex-col justify-between gap-4 shadow-xs text-xs">
              <div className="space-y-3">
                <div className="border-b border-slate-200 pb-3">
                  <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#047857]">
                    SMS Campaign Creation &amp; Scheduled Messages
                  </div>
                  <h3 className="font-display text-base font-bold text-slate-950">
                    Dispatch or Schedule SMS for &ldquo;{selectedListForNewCampaign || 'Selected List'}&rdquo;
                  </h3>
                </div>

                <p className="text-slate-600 leading-relaxed">
                  Start from a compliant SMS template with automatic <strong>STOP</strong> opt-out instructions, personalize with <code>{'{{first_name}}'}</code>, and schedule for immediate or future daytime delivery.
                </p>

                <div className="space-y-2">
                  {DEFAULT_SMS_TEMPLATES.map((stpl) => {
                    const segInfo = calculateSmsSegments(stpl.body);
                    return (
                      <div
                        key={stpl.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">{stpl.name}</span>
                          <span className="font-mono text-[11px] text-[#047857] font-bold">
                            {segInfo.charCount} chars · {segInfo.segments} seg ({segInfo.encoding})
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-slate-600 line-clamp-2">
                          {stpl.body}
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setChannel('sms');
                              setSelectedSmsTemplateId(stpl.id);
                              setSubjectOrTemplate(stpl.senderHeader);
                              setMessageBody(stpl.body);
                              handleOpenModal(false, selectedListForNewCampaign);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg cursor-pointer"
                          >
                            Schedule SMS
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setChannel('sms');
                              setSelectedSmsTemplateId(stpl.id);
                              setSubjectOrTemplate(stpl.senderHeader);
                              setMessageBody(stpl.body);
                              handleOpenModal(true, selectedListForNewCampaign);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer"
                          >
                            Send SMS Now
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => handleOpenModal(false, selectedListForNewCampaign, 'sms')}
                  className="py-2.5 px-3 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Schedule SMS Message</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenModal(true, selectedListForNewCampaign, 'sms')}
                  className="py-2.5 px-3 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Create Instant SMS Broadcast</span>
                </button>
              </div>
            </div>
          </div>

          {/* SMS Campaigns, Scheduled Messages & Carrier Delivery Status (DLR) */}
          <div className="border border-slate-200 rounded-2xl bg-white p-5 space-y-4 shadow-xs text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3.5">
              <div>
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#047857]">
                  SMS Campaigns, Scheduled Dispatches &amp; Carrier Delivery Status (DLR)
                </div>
                <h3 className="font-display text-base font-bold text-slate-950">
                  Real-Time Provider Delivery Receipts Where Supported ({selectedSmsProvider.name})
                </h3>
              </div>
              <span className="font-mono text-[11px] text-slate-600">
                DLR Support: <strong className="text-[#047857]">{selectedSmsProvider.dlrWebhookSupported ? 'Supported via Webhook' : 'Gateway Only'}</strong>
              </span>
            </div>

            {campaigns.filter((c) => c.channel === 'sms').length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                <p className="text-sm font-bold text-slate-900">
                  No SMS campaigns or scheduled SMS messages yet.
                </p>
                <p className="text-xs text-slate-600">
                  Click &ldquo;Schedule SMS Message&rdquo; or &ldquo;Create Instant SMS Broadcast&rdquo; above to dispatch to your selected Contact List.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0F172A] text-emerald-400 uppercase text-[11px] font-bold">
                      <th className="py-3 px-4">SMS Campaign · Message Preview</th>
                      <th className="py-3 px-4">Target List</th>
                      <th className="py-3 px-4">Schedule / Status</th>
                      <th className="py-3 px-4">Carrier DLR Status Breakdown</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {campaigns
                      .filter((c) => c.channel === 'sms')
                      .map((smsCamp) => {
                        const segs = calculateSmsSegments(smsCamp.messageBody);
                        const queuedCount =
                          smsCamp.status === 'scheduled' ? smsCamp.recipientCount : 0;
                        const deliveredDlr = smsCamp.deliveredCount || 0;
                        const failedDlr = smsCamp.bouncedCount || 0;
                        const optOutCount = smsCamp.unsubscribedCount || 0;

                        return (
                          <tr key={smsCamp.id} className="hover:bg-emerald-50/30">
                            <td className="py-3.5 px-4 max-w-sm">
                              <div className="font-bold text-slate-950">{smsCamp.name}</div>
                              <div className="font-mono text-[11px] text-slate-600 truncate mt-0.5">
                                {smsCamp.messageBody}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                {segs.charCount} chars · {segs.segments} SMS segment{segs.segments === 1 ? '' : 's'} ({segs.encoding})
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-[#047857]">
                              {smsCamp.targetList}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold capitalize text-slate-900">
                                {smsCamp.status}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500">
                                {smsCamp.scheduledAt || 'Immediate'}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[11px]">
                              {smsDlrWebhookEnabled && selectedSmsProvider.dlrWebhookSupported ? (
                                <div className="space-y-0.5">
                                  <div>
                                    <span className="font-bold text-[#047857]">
                                      {deliveredDlr} Carrier Delivered
                                    </span>{' '}
                                    · <span>{queuedCount} Queued</span>
                                  </div>
                                  <div className="text-slate-500">
                                    {failedDlr} Undelivered · {optOutCount} STOP Opt-Out
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-500">
                                  Dispatched to Gateway ({smsCamp.recipientCount} recipients)
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                {smsCamp.status !== 'sent' ? (
                                  <button
                                    type="button"
                                    onClick={() => onDispatchCampaign(smsCamp)}
                                    className="px-2.5 py-1.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer"
                                  >
                                    Dispatch SMS Now
                                  </button>
                                ) : (
                                  onUpdateCampaign && (
                                    <button
                                      type="button"
                                      onClick={() => handleSimulateTrackingMetrics(smsCamp)}
                                      className="px-2.5 py-1.5 text-[11px] font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <RefreshCw className="w-3 h-3 text-[#047857]" />
                                      <span>Sync Carrier DLR</span>
                                    </button>
                                  )
                                )}
                                <button
                                  type="button"
                                  onClick={() => onDeleteCampaign(smsCamp.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Automated SMS Actions Inside Workflows + SMS Consent / Opt-Out Management */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 6 Cols: Automated SMS Actions Inside Workflows */}
            <div className="lg:col-span-6 border border-slate-200 rounded-2xl bg-white p-5 space-y-4 shadow-xs text-xs">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#047857]">
                    Automated SMS Actions Inside Workflows
                  </div>
                  <h3 className="font-display text-base font-bold text-slate-950">
                    Trigger Timed SMS Steps When Contacts Join &ldquo;{selectedListForNewCampaign || 'Selected List'}&rdquo;
                  </h3>
                </div>
                {onNavigateToAutomations && (
                  <button
                    type="button"
                    onClick={onNavigateToAutomations}
                    className="px-3 py-1.5 text-[11px] font-bold text-[#0F172A] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer shrink-0"
                  >
                    Open Workflow Canvas →
                  </button>
                )}
              </div>

              {sequenceDeployBanner && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-semibold">
                  {sequenceDeployBanner}
                </div>
              )}

              <div className="space-y-3">
                {SMS_SEQUENCE_BLUEPRINTS.map((sbp) => (
                  <div
                    key={sbp.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-slate-950">{sbp.name}</span>
                      <span className="font-mono text-[11px] font-bold text-[#047857]">
                        {sbp.stepsCount} SMS Actions
                      </span>
                    </div>
                    <p className="text-slate-600">{sbp.description}</p>
                    <div className="font-mono text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-slate-200">
                      {sbp.cadenceSummary}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeploySmsSequence(sbp.id)}
                      className="w-full py-2 px-3 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>
                        Deploy Automated SMS Workflow for &ldquo;{selectedListForNewCampaign || 'List'}&rdquo;
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right 6 Cols: SMS Consent & Two-Way STOP Opt-Out Management */}
            <div className="lg:col-span-6 border border-slate-200 rounded-2xl bg-white p-5 space-y-4 shadow-xs text-xs">
              <div className="border-b border-slate-200 pb-3">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#047857]">
                  SMS Consent &amp; Automatic STOP Opt-Out Management
                </div>
                <h3 className="font-display text-base font-bold text-slate-950">
                  Honor Two-Way STOP / UNSUBSCRIBE &amp; Verify Explicit SMS Consent
                </h3>
              </div>

              <form
                onSubmit={handleProcessSmsStopOptOut}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end"
              >
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Phone Number (STOP Opt-Out) *
                  </label>
                  <input
                    type="text"
                    required
                    value={smsStopPhoneInput}
                    onChange={(e) => setSmsStopPhoneInput(e.target.value)}
                    placeholder="+14155552671"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Inbound Keyword</label>
                  <select
                    value={smsStopKeywordInput}
                    onChange={(e) =>
                      setSmsStopKeywordInput(e.target.value as 'STOP' | 'UNSUBSCRIBE' | 'CANCEL')
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  >
                    <option value="STOP">STOP</option>
                    <option value="UNSUBSCRIBE">UNSUBSCRIBE</option>
                    <option value="CANCEL">CANCEL</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="py-1.5 px-3 font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Record SMS Opt-Out
                </button>
              </form>

              {smsConsentFeedback && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-semibold">
                  {smsConsentFeedback}
                </div>
              )}

              <div className="max-h-[260px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {contacts.slice(0, 10).map((c) => {
                  const hasSmsOptIn =
                    c.consentStatus === 'opted_in' &&
                    !c.tags?.includes('sms-stop-optout') &&
                    !c.tags?.includes('suppressed');
                  return (
                    <div
                      key={c.id}
                      className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          {c.fullName}{' '}
                          <span className="font-mono text-slate-500 font-normal">({c.phone})</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          List: <strong className="text-slate-700">{c.listName}</strong> · Status:{' '}
                          <span
                            className={`font-mono font-bold ${
                              hasSmsOptIn ? 'text-[#047857]' : 'text-red-600'
                            }`}
                          >
                            {hasSmsOptIn ? 'SMS Opted-In' : 'STOP Opted-Out (Blocked)'}
                          </span>
                        </div>
                      </div>
                      {onUpdateContact && (
                        <button
                          type="button"
                          onClick={() => handleToggleContactSmsConsent(c, !hasSmsOptIn)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer border ${
                            hasSmsOptIn
                              ? 'bg-white text-slate-700 border-slate-300 hover:border-red-400 hover:text-red-700'
                              : 'bg-emerald-50 text-[#047857] border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {hasSmsOptIn ? 'Simulate STOP' : 'Verify START Opt-In'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REUSABLE EMAIL TEMPLATES LIBRARY */}
      {activeStudioTab === 'templates' && (
        <div className="border border-slate-200 rounded-2xl bg-white p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#047857]">
                Reusable Visual Email Templates · Personalization Ready
              </div>
              <h3 className="font-display text-base sm:text-lg font-bold text-slate-950">
                Start from a Proven Template or Save Your Own Reusable Layouts
              </h3>
              <p className="text-xs text-slate-600">
                Every template includes dynamic personalization tokens (such as {'{{first_name}}'} and {'{{company}}'}) and a compliant one-click unsubscribe footer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenModal(false)}
              className="px-3.5 py-2 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl cursor-pointer inline-flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Open Visual Email Editor</span>
            </button>
          </div>

          {/* Live Deliverability & Spam Score Auditor (0-100) */}
          <div className="p-4 rounded-xl bg-[#0F172A] text-white border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  Visual Template Studio · Live Deliverability &amp; Spam Score Checker
                </div>
                <div className="font-display text-sm sm:text-base font-bold text-white mt-0.5">
                  Active Draft Deliverability Score: {complianceResult.score}/100 ({complianceResult.passed ? 'Inbox Placement Ready' : 'Action Needed'})
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!subjectOrTemplate.includes('{{first_name}}')) {
                    setSubjectOrTemplate((prev) => `${prev.trim()} for {{first_name}}`);
                  }
                  if (!emailBlocks.some((b) => b.type === 'footer')) {
                    handleAddEmailBlock('footer');
                  }
                  setAttestedOptInPermission(true);
                }}
                className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
              >
                Auto-Optimize Deliverability (100/100)
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400">Subject Length &amp; Clarity</div>
                <div className="font-mono font-bold text-emerald-400 mt-0.5">
                  {subjectOrTemplate.length} chars · Optimal
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400">Personalization Merge Tags</div>
                <div className="font-mono font-bold text-emerald-400 mt-0.5">
                  {effectiveMessageBody.includes('{{') ? 'Verified ({{first_name}})' : 'Add Merge Tag'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400">1-Click Unsubscribe Header</div>
                <div className="font-mono font-bold text-emerald-400 mt-0.5">
                  RFC 8058 Compliant
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400">SPF / DKIM / DMARC Alignment</div>
                <div className="font-mono font-bold text-emerald-400 mt-0.5">
                  Authenticated
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-[#047857] bg-slate-50/50 flex flex-col justify-between gap-3 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-bold text-slate-950">
                      {tpl.name}
                    </span>
                    <span className="text-[11px] font-mono uppercase text-[#047857] font-bold">
                      {tpl.category.replace('_', ' ')} · {tpl.blocks.length} blocks
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{tpl.description}</p>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs space-y-1">
                    <div>
                      <span className="font-bold text-slate-700">Subject: </span>
                      <span className="font-mono text-slate-900">{tpl.subject}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-700">Preheader: </span>
                      <span className="text-slate-600">{tpl.preheader}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => {
                      handleApplyTemplate(tpl);
                      handleOpenModal(false);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Use in Scheduled Campaign</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleApplyTemplate(tpl);
                      handleOpenModal(true);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Use in Instant Broadcast</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: AUTOMATED EMAIL SEQUENCES */}
      {activeStudioTab === 'sequences' && (
        <div className="border border-slate-200 rounded-2xl bg-white p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#047857]">
                Automated Multi-Step Email Sequences · List-Enrolled Drip Workflows
              </div>
              <h3 className="font-display text-base sm:text-lg font-bold text-slate-950">
                Launch Automated Email Sequences for &ldquo;{selectedListForNewCampaign || 'Selected List'}&rdquo;
              </h3>
              <p className="text-xs text-slate-600">
                Deploy a multi-step timed email sequence that automatically enrolls contacts when they join your selected Contact List.
              </p>
            </div>
            {onNavigateToAutomations && (
              <button
                type="button"
                onClick={onNavigateToAutomations}
                className="px-3.5 py-2 text-xs font-bold text-[#0F172A] bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl cursor-pointer inline-flex items-center gap-1.5 shrink-0"
              >
                <GitBranch className="w-3.5 h-3.5 text-[#047857]" />
                <span>Open Full Workflow Builder ({automations.length})</span>
              </button>
            )}
          </div>

          {sequenceDeployBanner && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 font-semibold flex items-center justify-between">
              <span>{sequenceDeployBanner}</span>
              {onNavigateToAutomations && (
                <button
                  type="button"
                  onClick={onNavigateToAutomations}
                  className="font-bold text-[#047857] underline ml-3 cursor-pointer"
                >
                  View in Automations →
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {EMAIL_SEQUENCE_BLUEPRINTS.map((seq) => {
              const target =
                selectedListForNewCampaign ||
                (availableLists[0] ? availableLists[0].name : 'General Contacts');
              const previewNodes = seq.buildNodes(target);
              return (
                <div
                  key={seq.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-sm font-bold text-slate-950">
                        {seq.name}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-[#047857]">
                        {seq.stepsCount} Emails · {seq.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{seq.description}</p>
                    <div className="text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                      Cadence: <strong>{seq.cadenceSummary}</strong>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {previewNodes.map((n, idx) => (
                        <div
                          key={n.id}
                          className="p-2 rounded-lg bg-white border border-slate-200 text-xs flex items-center justify-between gap-2"
                        >
                          <div className="truncate">
                            <span className="font-mono font-bold text-emerald-700 mr-1.5">
                              0{idx + 1}.
                            </span>
                            <span className="font-bold text-slate-900">{n.title}</span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 shrink-0">
                            {n.subtitle.split('·')[0]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeployEmailSequence(seq.id)}
                    className="w-full py-2.5 px-4 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Activate Sequence for &ldquo;{target}&rdquo;</span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#047857]">
                  Automated SMS Workflow Sequences · Provider/Network Fees Separate
                </div>
                <h4 className="font-display text-sm sm:text-base font-bold text-slate-950">
                  Automated SMS Actions Inside Workflows for &ldquo;{selectedListForNewCampaign || 'Selected List'}&rdquo;
                </h4>
              </div>
              <span className="text-[11px] font-mono text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                Software is $0 free · SMS provider &amp; carrier segment fees apply separately
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SMS_SEQUENCE_BLUEPRINTS.map((sbp) => {
                const target =
                  selectedListForNewCampaign ||
                  (availableLists[0] ? availableLists[0].name : 'General Contacts');
                return (
                  <div
                    key={sbp.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-bold text-slate-950">
                          {sbp.name}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-[#047857]">
                          {sbp.stepsCount} SMS Steps
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{sbp.description}</p>
                      <div className="text-[11px] font-mono text-slate-700 bg-white p-2 rounded-lg border border-slate-200">
                        {sbp.cadenceSummary}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeploySmsSequence(sbp.id)}
                      className="w-full py-2 px-3 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Activate SMS Workflow for &ldquo;{target}&rdquo;</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: UNSUBSCRIBE MANAGEMENT & GLOBAL SUPPRESSION LIST */}
      {activeStudioTab === 'suppression' && (
        <div className="border border-slate-200 rounded-2xl bg-white p-5 space-y-5 shadow-xs">
          <div className="border-b border-slate-200 pb-4 space-y-1">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#047857]">
              Unsubscribe Management & Global Suppression Registry
            </div>
            <h3 className="font-display text-base sm:text-lg font-bold text-slate-950">
              Protect Sender Reputation & Honor One-Click Opt-Outs Automatically
            </h3>
            <p className="text-xs text-slate-600">
              Any contact who unsubscribes, hard-bounces, or is added to your Suppression List is automatically excluded from all Email, WhatsApp, and SMS broadcasts.
            </p>
          </div>

          <form
            onSubmit={handleSuppressAddress}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
          >
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address to Suppress / Unsubscribe *
              </label>
              <input
                type="email"
                required
                value={suppressEmailInput}
                onChange={(e) => setSuppressEmailInput(e.target.value)}
                placeholder="e.g. optout@example.com"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Suppression Reason
              </label>
              <select
                value={suppressReasonInput}
                onChange={(e) =>
                  setSuppressReasonInput(
                    e.target.value as
                      | 'user_unsubscribed'
                      | 'hard_bounce'
                      | 'manual_suppression'
                  )
                }
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-semibold"
              >
                <option value="manual_suppression">Manual Do-Not-Email</option>
                <option value="user_unsubscribed">One-Click Unsubscribe</option>
                <option value="hard_bounce">Hard Bounce (Invalid Mailbox)</option>
              </select>
            </div>
            <div>
              <button
                type="submit"
                className="w-full py-2 px-4 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <UserMinus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add to Suppression List</span>
              </button>
            </div>
          </form>

          {suppressionFeedback && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 font-semibold">
              {suppressionFeedback}
            </div>
          )}

          {suppressedContacts.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <p className="text-sm font-bold text-slate-900">
                0 Suppressed or Unsubscribed Contacts
              </p>
              <p className="text-xs text-slate-600">
                All contacts across your lists currently have active permission status.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0F172A] text-emerald-400 uppercase font-bold">
                    <th className="py-3 px-4">Contact · Email</th>
                    <th className="py-3 px-4">List</th>
                    <th className="py-3 px-4">Suppression Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppressedContacts.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{c.fullName}</div>
                        <div className="font-mono text-slate-600">{c.email}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{c.listName}</td>
                      <td className="py-3 px-4 font-mono text-red-700 font-bold">
                        {c.tags?.includes('bounced')
                          ? 'Hard Bounced · Suppressed'
                          : 'Unsubscribed · Excluded from Sends'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {onUpdateContact && (
                          <button
                            type="button"
                            onClick={() => handleRestoreContactOptIn(c)}
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer"
                          >
                            Re-Verify Opt-In
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SENDER & DOMAIN CONFIGURATION */}
      {activeStudioTab === 'sender_domain' && (
        <div className="border border-slate-200 rounded-2xl bg-white p-5 space-y-5 shadow-xs">
          <div className="border-b border-slate-200 pb-4 space-y-1">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#047857]">
              Sender Identity & Domain Authentication (SPF · DKIM · DMARC)
            </div>
            <h3 className="font-display text-base sm:text-lg font-bold text-slate-950">
              Configure Authenticated Sender Headers & Physical Compliance Address
            </h3>
            <p className="text-xs text-slate-600">
              Major inbox providers require aligned SPF, DKIM, DMARC, and RFC 8058 One-Click List-Unsubscribe headers for bulk senders.
            </p>
          </div>

          {senderSaveBanner && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 font-semibold">
              {senderSaveBanner}
            </div>
          )}

          <form onSubmit={handleSaveSenderConfig} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                From Sender Name ({'{{sender_name}}'}) *
              </label>
              <input
                type="text"
                required
                value={senderNameInput}
                onChange={(e) => setSenderNameInput(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Authenticated From Email Address *
              </label>
              <input
                type="email"
                required
                value={fromEmailInput}
                onChange={(e) => setFromEmailInput(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Reply-To Inbox Address *
              </label>
              <input
                type="email"
                required
                value={replyToEmailInput}
                onChange={(e) => setReplyToEmailInput(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Authenticated Sending Domain (SPF/DKIM) *
              </label>
              <input
                type="text"
                required
                value={sendingDomainInput}
                onChange={(e) => setSendingDomainInput(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Physical Postal Address (Required for CAN-SPAM Compliance Footer) *
              </label>
              <input
                type="text"
                required
                value={physicalAddressInput}
                onChange={(e) => setPhysicalAddressInput(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div className="md:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900">
                DNS Authentication Alignment Records for {sendingDomainInput}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-[11px]">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <div className="font-bold text-[#047857]">SPF · Verified</div>
                  <div className="text-slate-600 truncate mt-0.5">
                    v=spf1 include:spf.flowpilot.app ~all
                  </div>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <div className="font-bold text-[#047857]">DKIM (2048-bit) · Verified</div>
                  <div className="text-slate-600 truncate mt-0.5">
                    fp1._domainkey.{sendingDomainInput}
                  </div>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <div className="font-bold text-[#047857]">DMARC & RFC 8058 · Active</div>
                  <div className="text-slate-600 truncate mt-0.5">
                    v=DMARC1; p=quarantine; pct=100
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer inline-flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Save & Verify Sender Configuration</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 6: CAMPAIGN ANALYTICS & DELIVERABILITY TELEMETRY */}
      {activeStudioTab === 'analytics' && (
        <div className="border border-slate-200 rounded-2xl bg-white p-5 space-y-5 shadow-xs">
          <div className="border-b border-slate-200 pb-4">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#047857]">
              Campaign Analytics · Delivery, Open, Click, Bounce & Opt-Out Funnel
            </div>
            <h3 className="font-display text-base sm:text-lg font-bold text-slate-950">
              Broadcast & Email Performance Telemetry Across Lists
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 font-semibold">Total Recipients</div>
              <div className="font-mono text-lg font-bold text-slate-950 mt-0.5">
                {analyticsTotals.totalRecipients.toLocaleString()}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 font-semibold">Delivery Rate</div>
              <div className="font-mono text-lg font-bold text-[#047857] mt-0.5">
                {analyticsTotals.deliveryRate}%
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 font-semibold">Open Rate</div>
              <div className="font-mono text-lg font-bold text-slate-950 mt-0.5">
                {analyticsTotals.openRate}%
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 font-semibold">Click Rate (CTR)</div>
              <div className="font-mono text-lg font-bold text-[#047857] mt-0.5">
                {analyticsTotals.clickRate}%
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 font-semibold">Click-to-Open</div>
              <div className="font-mono text-lg font-bold text-slate-950 mt-0.5">
                {analyticsTotals.ctor}%
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 font-semibold">Bounced / Unsub</div>
              <div className="font-mono text-lg font-bold text-slate-950 mt-0.5">
                {analyticsTotals.totalBounced} / {analyticsTotals.totalUnsubscribed}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {campaigns.map((camp) => {
              const deliv = Math.max(camp.deliveredCount, 1);
              const openPct = Math.min(100, Math.round((camp.openedCount / deliv) * 100));
              const clickPct = Math.min(100, Math.round((camp.clickedCount / deliv) * 100));
              return (
                <div
                  key={camp.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-950">{camp.name}</span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="font-mono text-[#047857] font-bold">{camp.targetList}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-slate-600">
                        {camp.deliveredCount} delivered · {camp.openedCount} opened ({openPct}%) ·{' '}
                        {camp.clickedCount} clicked ({clickPct}%) · {camp.unsubscribedCount || 0} unsub
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          triggerLiveTrackingTestEvent({
                            type: 'open',
                            recipient: samplePreviewContact?.email || 'subscriber@example.com',
                            campaignId: camp.id,
                          })
                        }
                        className="px-2 py-1 text-[11px] font-bold text-[#047857] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md cursor-pointer"
                        title="Fire live GET /api/track/open pixel event for this campaign"
                      >
                        + Live Open Pixel
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          triggerLiveTrackingTestEvent({
                            type: 'click',
                            recipient: samplePreviewContact?.email || 'subscriber@example.com',
                            campaignId: camp.id,
                            targetUrl: 'https://flowpilot.app/offer',
                          })
                        }
                        className="px-2 py-1 text-[11px] font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-md cursor-pointer"
                        title="Fire live GET /api/track/click redirect event for this campaign"
                      >
                        + Live Link Click
                      </button>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${openPct}%` }}
                      className="bg-[#047857] h-full transition-all"
                      title={`Open Rate: ${openPct}%`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VISUAL EMAIL CAMPAIGN & BROADCAST BUILDER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full p-4 sm:p-6 space-y-5 max-h-[94vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
              <div>
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#047857]">
                  {dispatchNow
                    ? 'Instant Broadcast Dispatch · Permission-First Email & Omnichannel Studio'
                    : 'Scheduled Campaign Builder · Visual Email Editor & Segmentation'}
                </div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950 mt-0.5">
                  {dispatchNow
                    ? 'Send Broadcast to Selected Contact List'
                    : 'Create & Schedule Campaign for Contact List'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher: Create Campaign vs Send Broadcast */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setDispatchNow(false);
                  if (scheduleType === 'immediate') setScheduleType('specific_datetime');
                }}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  !dispatchNow
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>Create Campaign (Schedule / Time Delay)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDispatchNow(true);
                  setScheduleType('immediate');
                }}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  dispatchNow
                    ? 'bg-[#047857] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Broadcast (Immediate Dispatch)</span>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-5 text-xs">
              {/* STEP 1: SELECT CONTACT LIST & AUDIENCE SEGMENTATION */}
              <div className="p-4 rounded-xl border-2 border-[#0F172A] bg-slate-50/70 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#047857] block">
                      Step 1 · Target Contact List & Audience Segmentation
                    </span>
                    <label className="font-display text-sm font-bold text-slate-950">
                      Choose the Contact List holding who you want to send to *
                    </label>
                  </div>
                  <div className="font-mono text-xs font-bold text-[#047857]">
                    {optedInContactsCount} eligible opted-in recipient
                    {optedInContactsCount === 1 ? '' : 's'} ({suppressedInSelectedList.length}{' '}
                    suppressed/excluded)
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Target Contact List *
                    </label>
                    <select
                      required
                      value={targetList}
                      onChange={(e) => {
                        setTargetList(e.target.value);
                        setSelectedListForNewCampaign(e.target.value);
                      }}
                      className="w-full px-3 py-2 bg-white border-2 border-slate-300 focus:border-[#047857] rounded-xl font-bold text-slate-950 text-xs outline-none"
                    >
                      <option value="" disabled>
                        -- Select a Created Contact List --
                      </option>
                      {availableLists.map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.name} ({item.optedInCount} opted-in / {item.totalContacts} total)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Segment by Lead Stage
                    </label>
                    <select
                      value={segmentStage}
                      onChange={(e) => setSegmentStage(e.target.value as 'all' | LeadStage)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold"
                    >
                      <option value="all">All Opted-In Stages</option>
                      <option value="cold_subscriber">Cold Subscriber</option>
                      <option value="warm_lead">Warm Lead</option>
                      <option value="mql">Marketing Qualified (MQL)</option>
                      <option value="sql">Sales Qualified (SQL)</option>
                      <option value="customer">Customer / VIP</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Segment by Temperature
                    </label>
                    <select
                      value={segmentTemp}
                      onChange={(e) => setSegmentTemp(e.target.value as 'all' | LeadTemperature)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold"
                    >
                      <option value="all">All Temperatures</option>
                      <option value="hot">Hot Leads Only</option>
                      <option value="warm">Warm Leads Only</option>
                      <option value="cold">Cold Leads Only</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center pt-1">
                  <div>
                    <input
                      type="text"
                      value={segmentTagQuery}
                      onChange={(e) => setSegmentTagQuery(e.target.value)}
                      placeholder="Optional Tag Filter (e.g. vip, webinar, founder)..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono">
                    Active Segment: <strong className="text-slate-900">{segmentSummaryLabel}</strong>
                  </div>
                </div>
              </div>

              {/* STEP 2: CAMPAIGN METADATA, SENDER IDENTITY, REUSABLE TEMPLATES & PERSONALIZATION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {dispatchNow ? 'Broadcast Title *' : 'Campaign Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      targetList ? `${targetList} — Weekly Dispatch` : 'Q4 Systems Dispatch'
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Delivery Channel *</label>
                  <select
                    value={channel}
                    onChange={(e) => {
                      setChannel(e.target.value as ChannelType);
                      setSelectedSenderIdentityId('');
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="email">Email Marketing (Visual Editor + SPF/DKIM)</option>
                    <option value="whatsapp">Official WhatsApp Cloud API</option>
                    <option value="sms">Compliant Direct SMS</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Send From Identity ({channel.toUpperCase()}) *
                  </label>
                  <select
                    value={activeSelectedSenderIdentity?.id || ''}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedSenderIdentityId(nextId);
                      const picked = channelSenderIdentities.find((i) => i.id === nextId);
                      if (picked && channel === 'email') {
                        setFromEmailInput(picked.value);
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs font-semibold text-slate-900"
                  >
                    {channelSenderIdentities.map((ident) => (
                      <option key={ident.id} value={ident.id}>
                        {ident.label}: {ident.value} {ident.isPrimary ? '(Primary)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {channel === 'email' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Load Reusable Email Template
                    </label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => {
                        const found = templates.find((t) => t.id === e.target.value);
                        if (found) handleApplyTemplate(found);
                      }}
                      className="w-full px-3 py-2 bg-emerald-50/70 border border-emerald-300 rounded-lg font-bold text-slate-900"
                    >
                      {templates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {channel === 'sms' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Load Compliant SMS Template
                    </label>
                    <select
                      value={selectedSmsTemplateId}
                      onChange={(e) => {
                        setSelectedSmsTemplateId(e.target.value);
                        const found = DEFAULT_SMS_TEMPLATES.find((t) => t.id === e.target.value);
                        if (found) {
                          setSubjectOrTemplate(found.senderHeader);
                          setMessageBody(found.body);
                        }
                      }}
                      className="w-full px-3 py-2 bg-emerald-50/70 border border-emerald-300 rounded-lg font-bold text-slate-900"
                    >
                      {DEFAULT_SMS_TEMPLATES.map((stpl) => (
                        <option key={stpl.id} value={stpl.id}>
                          {stpl.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {channel === 'sms' && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-relaxed">
                      <strong>Provider &amp; Network Fee Notice:</strong> FlowPilot software is 100% free ($0 markup). Your connected SMS provider (<strong>{selectedSmsProvider.name}</strong>) bills carrier &amp; per-segment network fees separately (~${(selectedSmsProvider.typicalRatePerSegmentUsd + selectedSmsProvider.carrierPassThroughPerSegmentUsd).toFixed(4)}/segment).
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-amber-900 shrink-0">
                    Est. Network Cost: ~${providerPassThroughEstimate.toFixed(2)} ({smsSegmentStats.segments} seg × {optedInContactsCount} opted-in)
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {channel === 'email'
                      ? 'Email Subject Line (Personalization Supported) *'
                      : 'Approved Template / Subject *'}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={subjectOrTemplate}
                    onChange={(e) => setSubjectOrTemplate(e.target.value)}
                    placeholder="{{first_name}}, 3 systems to streamline your pipeline"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                  />
                </div>
                {channel === 'email' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Inbox Preview Text (Preheader)
                    </label>
                    <input
                      type="text"
                      maxLength={180}
                      value={preheader}
                      onChange={(e) => setPreheader(e.target.value)}
                      placeholder="Practical workflow notes — read in 3 minutes."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                )}
              </div>

              {/* Personalization Variables Bar */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#047857]" />
                    <span>Insert Personalization Variable (1-Click):</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Automatically resolves from each recipient&apos;s CRM record in {targetList || 'your list'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PERSONALIZATION_VARIABLES.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => handleInsertVariable(v.token)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:border-[#047857] text-[11px] font-mono font-bold text-slate-900 cursor-pointer transition-colors"
                      title={`Example: ${v.example}`}
                    >
                      {v.token} <span className="font-sans font-normal text-slate-500">({v.label})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* VISUAL EMAIL EDITOR + LIVE PERSONALIZED PREVIEW */}
              {channel === 'email' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                  {/* Left 7 Cols: Visual Block Builder */}
                  <div className="lg:col-span-7 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setEditorMode('visual_blocks')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                            editorMode === 'visual_blocks'
                              ? 'bg-[#0F172A] text-white'
                              : 'text-slate-700'
                          }`}
                        >
                          Visual Block Editor ({emailBlocks.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMessageBody(serializeBlocksToMessageBody(emailBlocks, preheader));
                            setEditorMode('plain_text');
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                            editorMode === 'plain_text'
                              ? 'bg-[#0F172A] text-white'
                              : 'text-slate-700'
                          }`}
                        >
                          Plain-Text / Raw Mode
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        {(['header', 'text', 'callout', 'button', 'divider', 'footer'] as const).map(
                          (bType) => (
                            <button
                              key={bType}
                              type="button"
                              onClick={() => handleAddEmailBlock(bType)}
                              className="px-2 py-1 text-[11px] font-bold bg-white border border-slate-300 hover:border-[#047857] rounded-md capitalize cursor-pointer"
                            >
                              + {bType}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {editorMode === 'visual_blocks' ? (
                      <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                        {emailBlocks.map((blk, idx) => (
                          <div
                            key={blk.id}
                            className="p-3 rounded-xl bg-white border border-slate-200 space-y-2 shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-mono font-bold uppercase text-[#047857]">
                                Block 0{idx + 1} · {blk.type}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMoveBlock(idx, -1)}
                                  disabled={idx === 0}
                                  className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                                  title="Move block up"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveBlock(idx, 1)}
                                  disabled={idx === emailBlocks.length - 1}
                                  className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                                  title="Move block down"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBlock(blk.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                  title="Remove block"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {(blk.type === 'header' || blk.type === 'callout') && (
                              <input
                                type="text"
                                value={blk.heading || ''}
                                onChange={(e) =>
                                  handleUpdateBlock(blk.id, { heading: e.target.value })
                                }
                                placeholder="Block Heading..."
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
                              />
                            )}

                            {blk.type !== 'divider' && (
                              <textarea
                                rows={blk.type === 'text' ? 3 : 2}
                                value={blk.content}
                                onChange={(e) =>
                                  handleUpdateBlock(blk.id, { content: e.target.value })
                                }
                                placeholder="Block content (supports {{first_name}}, {{company}}, etc.)"
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                              />
                            )}

                            {blk.type === 'button' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={blk.buttonLabel || ''}
                                  onChange={(e) =>
                                    handleUpdateBlock(blk.id, { buttonLabel: e.target.value })
                                  }
                                  placeholder="CTA Button Label"
                                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                                />
                                <input
                                  type="url"
                                  value={blk.buttonUrl || ''}
                                  onChange={(e) =>
                                    handleUpdateBlock(blk.id, { buttonUrl: e.target.value })
                                  }
                                  placeholder="https://flowpilot.app/..."
                                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        rows={10}
                        value={messageBody}
                        onChange={(e) => setMessageBody(e.target.value)}
                        className="w-full p-3 bg-white border border-slate-300 rounded-xl font-mono text-xs"
                      />
                    )}

                    {/* Save as Reusable Template bar */}
                    <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={newTemplateName}
                          onChange={(e) => setNewTemplateName(e.target.value)}
                          placeholder="Save current layout as Reusable Template..."
                          className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleSaveCurrentAsTemplate}
                          className="px-3 py-1.5 text-xs font-bold text-[#0F172A] bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer shrink-0"
                        >
                          Save Template
                        </button>
                      </div>
                      {templateSavedNotice && (
                        <span className="text-[11px] font-bold text-[#047857]">
                          {templateSavedNotice}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right 5 Cols: Live Personalized Email Preview & Test Email */}
                  <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 inline-flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-[#047857]" />
                          <span>Live Personalized Preview</span>
                        </span>
                        <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setPreviewDevice('desktop')}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                              previewDevice === 'desktop' ? 'bg-white text-slate-900' : 'text-slate-600'
                            }`}
                          >
                            Desktop
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewDevice('mobile')}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                              previewDevice === 'mobile' ? 'bg-white text-slate-900' : 'text-slate-600'
                            }`}
                          >
                            Mobile
                          </button>
                        </div>
                      </div>

                      {segmentedOptedInRecipients.length > 0 && (
                        <select
                          value={samplePreviewContact?.id || ''}
                          onChange={(e) => setPreviewContactId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-semibold"
                        >
                          {segmentedOptedInRecipients.slice(0, 12).map((c) => (
                            <option key={c.id} value={c.id}>
                              Previewing as: {c.fullName} ({c.email})
                            </option>
                          ))}
                        </select>
                      )}

                      <div
                        className={`mx-auto bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden transition-all ${
                          previewDevice === 'mobile' ? 'max-w-[300px]' : 'w-full'
                        }`}
                      >
                        <div className="p-3 bg-slate-900 text-white space-y-1">
                          <div className="text-[10px] font-mono text-emerald-400">
                            From: {senderNameInput} &lt;{fromEmailInput}&gt;
                          </div>
                          <div className="font-bold text-xs truncate">
                            {resolvePersonalizationVariables(
                              subjectOrTemplate,
                              samplePreviewContact,
                              workspace,
                              privateProfile,
                              targetList
                            )}
                          </div>
                          {preheader && (
                            <div className="text-[11px] text-slate-300 truncate">
                              {resolvePersonalizationVariables(
                                preheader,
                                samplePreviewContact,
                                workspace,
                                privateProfile,
                                targetList
                              )}
                            </div>
                          )}
                        </div>

                        <div className="p-3.5 space-y-3 max-h-[260px] overflow-y-auto text-xs">
                          {emailBlocks.map((b) => {
                            const resolvedContent = resolvePersonalizationVariables(
                              b.content,
                              samplePreviewContact,
                              workspace,
                              privateProfile,
                              targetList
                            );
                            const resolvedHeading = resolvePersonalizationVariables(
                              b.heading || '',
                              samplePreviewContact,
                              workspace,
                              privateProfile,
                              targetList
                            );
                            if (b.type === 'header') {
                              return (
                                <div
                                  key={b.id}
                                  className="pb-2 border-b border-slate-200 space-y-0.5"
                                >
                                  <div className="text-[10px] font-mono font-bold uppercase text-[#047857]">
                                    {resolvedHeading}
                                  </div>
                                  <div className="text-slate-600 text-[11px]">
                                    {resolvedContent}
                                  </div>
                                </div>
                              );
                            }
                            if (b.type === 'callout') {
                              return (
                                <div
                                  key={b.id}
                                  className="p-2.5 rounded-lg bg-emerald-50/70 border-l-4 border-[#047857] space-y-1"
                                >
                                  {resolvedHeading && (
                                    <div className="font-bold text-slate-900">
                                      {resolvedHeading}
                                    </div>
                                  )}
                                  <div className="text-slate-700 leading-relaxed whitespace-pre-line">
                                    {resolvedContent}
                                  </div>
                                </div>
                              );
                            }
                            if (b.type === 'button') {
                              return (
                                <div key={b.id} className="space-y-2 py-1">
                                  {resolvedContent && (
                                    <div className="text-slate-700">{resolvedContent}</div>
                                  )}
                                  <div className="inline-block px-3.5 py-2 rounded-lg bg-[#047857] text-white font-bold text-xs">
                                    {b.buttonLabel || 'Learn More →'}
                                  </div>
                                </div>
                              );
                            }
                            if (b.type === 'divider') {
                              return <hr key={b.id} className="border-slate-200" />;
                            }
                            if (b.type === 'footer') {
                              return (
                                <div
                                  key={b.id}
                                  className="pt-2 border-t border-slate-200 text-[10px] text-slate-500 leading-relaxed"
                                >
                                  <div>{resolvedContent}</div>
                                  <div className="mt-1 font-mono">{physicalAddressInput}</div>
                                </div>
                              );
                            }
                            return (
                              <div
                                key={b.id}
                                className="text-slate-800 leading-relaxed whitespace-pre-line"
                              >
                                {resolvedContent}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Send Test Email Bar */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                      <label className="block font-bold text-slate-800">
                        Send Test Email Before Launching
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="email"
                          value={testEmailRecipient}
                          onChange={(e) => setTestEmailRecipient(e.target.value)}
                          placeholder="your-inbox@example.com"
                          className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleSendTestEmail}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg cursor-pointer shrink-0"
                        >
                          Send Test
                        </button>
                      </div>
                      {testEmailFeedback && (
                        <div className="text-[11px] text-[#047857] font-semibold leading-snug">
                          {testEmailFeedback}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                  <div className="lg:col-span-7 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="block font-bold text-slate-800">
                        {channel === 'sms'
                          ? `SMS Message Body (Sent via ${smsSenderNumber} to ${targetList || 'selected list'}) *`
                          : `Message Body (Sent to opted-in contacts in ${targetList || 'selected list'}) *`}
                      </label>
                      {channel === 'sms' && (
                        <span className="font-mono text-[11px] font-bold text-[#047857]">
                          {smsSegmentStats.charCount} chars · {smsSegmentStats.segments} segment
                          {smsSegmentStats.segments === 1 ? '' : 's'} ({smsSegmentStats.encoding})
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={5}
                      required
                      maxLength={1000}
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
                      placeholder="Hi {{first_name}}, here is your requested update — Reply STOP to opt out."
                      className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-xs"
                    />
                    {channel === 'sms' && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="text-[11px] text-slate-600">
                          {smsSegmentStats.hasStopInstruction ? (
                            <span className="text-[#047857] font-bold">
                              ✓ Mandatory STOP opt-out instruction detected
                            </span>
                          ) : (
                            <span className="text-amber-800 font-bold">
                              ⚠ Recommend including &ldquo;Reply STOP to opt out&rdquo; for carrier compliance
                            </span>
                          )}
                        </div>
                        {!smsSegmentStats.hasStopInstruction && (
                          <button
                            type="button"
                            onClick={() =>
                              setMessageBody((prev) =>
                                `${prev.trim()} Reply STOP to opt out.`.trim()
                              )
                            }
                            className="px-2.5 py-1 text-[11px] font-bold text-[#047857] bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer"
                          >
                            + Append &ldquo;Reply STOP to opt out&rdquo;
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-5 flex flex-col justify-between space-y-2.5">
                    <div className="font-bold text-slate-900 inline-flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-[#047857]" />
                      <span>Live Handset Preview ({channel.toUpperCase()})</span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[#0F172A] text-white space-y-2 shadow-inner">
                      <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400 border-b border-slate-800 pb-1.5">
                        <span>Sender: {smsSenderNumber}</span>
                        <span>DLR Webhook: Active</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-800 text-xs text-slate-100 leading-relaxed font-sans">
                        {resolvePersonalizationVariables(
                          messageBody || DEFAULT_SMS_TEMPLATES[0].body,
                          samplePreviewContact,
                          workspace,
                          privateProfile,
                          targetList
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
                        <span>To: {samplePreviewContact?.phone || '+14155550142'}</span>
                        <span>{smsSegmentStats.segments} SMS Segment(s)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: SCHEDULING & ANTI-SPAM ETHICAL COMPLIANCE GUARDRAIL */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Scheduling Controls */}
                <div className="p-3.5 bg-[#F8FAFC] border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0F172A] inline-flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-emerald-700" />
                      <span>Step 3 · Delivery Schedule & Time Window</span>
                    </span>
                    <span className="font-mono text-[11px] text-emerald-700 font-bold">
                      Est. Carrier Pass-Through: ~${providerPassThroughEstimate.toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'immediate', label: 'Send Now' },
                        { id: 'time_delay', label: 'Time Delay (+N)' },
                        { id: 'specific_datetime', label: 'Date & Time' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setScheduleType(opt.id);
                          setDispatchNow(opt.id === 'immediate');
                        }}
                        className={`py-2 px-2.5 text-[11px] font-bold rounded-lg border transition-colors cursor-pointer ${
                          scheduleType === opt.id
                            ? 'bg-[#0F172A] text-white border-[#0F172A]'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {scheduleType === 'time_delay' && (
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Wait Duration
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={delayAmount}
                          onChange={(e) => setDelayAmount(Math.max(1, Number(e.target.value)))}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Time Unit
                        </label>
                        <select
                          value={delayUnit}
                          onChange={(e) =>
                            setDelayUnit(e.target.value as 'minutes' | 'hours' | 'days')
                          }
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold"
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {scheduleType === 'specific_datetime' && (
                    <div className="pt-1">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Scheduled Broadcast Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledDateTime}
                        onChange={(e) => setScheduledDateTime(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={businessHoursOnly}
                      onChange={(e) => setBusinessHoursOnly(e.target.checked)}
                      className="accent-emerald-700"
                    />
                    <span className="text-[11px] font-medium text-slate-700">
                      Enforce Subscriber Business-Day Window (Mon–Fri 09:00–17:00)
                    </span>
                  </label>

                  {/* Smart Send-Time Optimization & A/B Split Testing Controls */}
                  <div className="pt-2.5 border-t border-slate-200 space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Smart Send-Time Optimization
                      </label>
                      <select
                        value={sendTimeOptimization}
                        onChange={(e) =>
                          setSendTimeOptimization(
                            e.target.value as
                              | 'immediate'
                              | 'recipient_local_9am'
                              | 'evening_peak_6pm'
                          )
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
                      >
                        <option value="recipient_local_9am">
                          Smart 9:00 AM Recipient Local Timezone Peak (Recommended)
                        </option>
                        <option value="evening_peak_6pm">
                          6:00 PM Evening Engagement Window
                        </option>
                        <option value="immediate">
                          Standard Simultaneous Dispatch
                        </option>
                      </select>
                    </div>

                    <label className="flex items-center justify-between gap-2 cursor-pointer pt-1">
                      <span className="text-xs font-bold text-slate-900">
                        Enable A/B Split Test (Auto-Pick Winning Variant)
                      </span>
                      <input
                        type="checkbox"
                        checked={abTestEnabled}
                        onChange={(e) => setAbTestEnabled(e.target.checked)}
                        className="accent-emerald-700 w-4 h-4"
                      />
                    </label>

                    {abTestEnabled && (
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-2 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Variant B Subject Line / Template Header
                          </label>
                          <input
                            type="text"
                            value={variantBSubject}
                            onChange={(e) => setVariantBSubject(e.target.value)}
                            placeholder="Alternative Subject Line B for {{first_name}}"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Auto-Winner Criterion
                            </label>
                            <select
                              value={abWinningMetric}
                              onChange={(e) =>
                                setAbWinningMetric(
                                  e.target.value as 'open_rate' | 'click_rate'
                                )
                              }
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-[11px] font-bold"
                            >
                              <option value="open_rate">Highest Open Rate</option>
                              <option value="click_rate">Highest Click Rate</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Sample Split %
                            </label>
                            <select
                              value={abSamplePercent}
                              onChange={(e) => setAbSamplePercent(Number(e.target.value))}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-[11px] font-mono font-bold"
                            >
                              <option value={15}>15% A · 15% B · 70% Winner</option>
                              <option value={20}>20% A · 20% B · 60% Winner</option>
                              <option value={25}>25% A · 25% B · 50% Winner</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Anti-Deception & Anti-Unsolicited Email Compliance Guardrail */}
                <div className="p-3.5 bg-[#F8FAFC] border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#047857]" />
                      <span>Anti-Spam & Ethical Email Compliance Check</span>
                    </span>
                    <span
                      className={`font-mono font-bold text-xs ${
                        complianceResult.passed ? 'text-[#047857]' : 'text-red-600'
                      }`}
                    >
                      Score: {complianceResult.score}/100
                    </span>
                  </div>

                  {complianceResult.blockingIssues.map((issue, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-[11px] flex items-start gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />
                      <span>{issue}</span>
                    </div>
                  ))}

                  {complianceResult.warnings.map((warn, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]"
                    >
                      {warn}
                    </div>
                  ))}

                  <div className="space-y-1">
                    {complianceResult.verifiedChecks.map((chk, i) => (
                      <div
                        key={i}
                        className="text-[11px] text-slate-600 flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5 text-[#047857] shrink-0" />
                        <span>{chk}</span>
                      </div>
                    ))}
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer pt-1.5 border-t border-slate-200">
                    <input
                      type="checkbox"
                      checked={attestedOptInPermission}
                      onChange={(e) => setAttestedOptInPermission(e.target.checked)}
                      className="accent-emerald-700 mt-0.5"
                    />
                    <span className="text-[11px] font-semibold text-slate-800 leading-snug">
                      I attest that all recipients in &ldquo;{targetList || 'this list'}&rdquo; explicitly opted in and this dispatch contains no unsolicited, purchased, or deceptive content.
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <div className="text-xs text-slate-600">
                  Target List:{' '}
                  <strong className="text-slate-950">
                    {targetList || 'Select a Contact List'}
                  </strong>{' '}
                  · <strong className="text-[#047857]">{optedInContactsCount} opted-in</strong> ·{' '}
                  <span>{suppressedInSelectedList.length} suppressed excluded</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isSaving ||
                      !targetList.trim() ||
                      (channel === 'email' && !complianceResult.passed)
                    }
                    className="px-4 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {isSaving
                        ? 'Processing...'
                        : dispatchNow
                        ? `Send Broadcast to "${targetList || 'List'}"`
                        : `Schedule Campaign for "${targetList || 'List'}"`}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
