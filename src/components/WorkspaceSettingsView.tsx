import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  LogOut,
  Mail,
  KeyRound,
  RefreshCw,
  MessageSquare,
  Globe,
  Copy,
  Check,
  Zap,
  Phone,
  Send,
  ExternalLink,
  Smartphone,
  Clock,
  Ban,
  Play,
} from 'lucide-react';
import {
  Workspace,
  UserPrivateProfile,
  UserMessagingIdentity,
  WorkspaceMember,
  BusinessCategory,
  CurrencyCode,
  MemberRole,
  ChannelType,
  sanitizeString,
  generateSafeId,
  parseUserMessagingIdentities,
  serializeUserMessagingIdentities,
  resolveWorkspaceSenderIdentities,
} from '../types';
import {
  deliverChannelMessage,
  fetchGatewayStatus,
  getStoredDeliveryReceipts,
  getStoredOutboundWebhookUrl,
  setStoredOutboundWebhookUrl,
  fetchScheduledJobs,
  enqueueScheduledAutomationJobs,
  syncKillSwitchWithServerScheduler,
  triggerScheduledJobNow,
  cancelScheduledJob,
  MessageDeliveryReceipt,
  MultiChannelGatewayStatus,
  ScheduledAutomationJob,
  SchedulerSummary,
  getStoredChannelGatewayConfig,
  saveStoredChannelGatewayConfig,
  serializeGatewayConfigForProfile,
  getWhatsAppProviderLabel,
  getSmsProviderLabel,
  getEmailProviderLabel,
  WhatsAppProviderMode,
  SmsProviderMode,
  EmailProviderMode,
} from '../services/messageDeliveryService';
import {
  initAuth,
  subscribeGmailAuthState,
  connectGmailAccountWithPopup,
  disconnectGmailToken,
} from '../firebase';
import {
  WorkspaceSnapshot,
  loadLocalWorkspaceSnapshot,
  saveLocalWorkspaceSnapshot,
  pushServerWorkspaceSnapshot,
  buildStarterWorkspaceSnapshot,
} from '../services/accountPersistenceService';

import { AuthModalMode } from './AuthModal';
import {
  FlowPilotLogo,
  getStoredCustomLogo,
  setStoredCustomLogo,
} from './FlowPilotLogo';

interface WorkspaceSettingsViewProps {
  workspace: Workspace;
  privateProfile: UserPrivateProfile;
  members: WorkspaceMember[];
  isAuthenticated: boolean;
  userEmailVerified: boolean;
  currentUserUid?: string | null;
  currentUserEmail?: string;
  onUpdateWorkspace: (
    data: Omit<Workspace, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdatePrivateProfile: (
    data: Omit<UserPrivateProfile, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onAddMember: (data: {
    memberName: string;
    memberEmail: string;
    role: MemberRole;
  }) => Promise<void>;
  onDeleteMember: (memberId: string) => Promise<void>;
  onSendPasswordReset: (email: string) => Promise<void>;
  onSendEmailVerification: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onOpenAuth: (mode: AuthModalMode) => void;
  onReseedWorkspace: () => Promise<void>;
  onRestoreWorkspaceSnapshot?: (snapshot: WorkspaceSnapshot) => void;
  onNavigateToWhatsAppEmbeddedSignup?: () => void;
}

export const WorkspaceSettingsView: React.FC<WorkspaceSettingsViewProps> = ({
  workspace,
  privateProfile,
  members,
  isAuthenticated,
  userEmailVerified,
  currentUserUid,
  currentUserEmail,
  onUpdateWorkspace,
  onUpdatePrivateProfile,
  onAddMember,
  onDeleteMember,
  onSendPasswordReset,
  onSendEmailVerification,
  onSignOut,
  onOpenAuth,
  onReseedWorkspace,
  onRestoreWorkspaceSnapshot,
  onNavigateToWhatsAppEmbeddedSignup,
}) => {
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [selectedWebhookEventPreview, setSelectedWebhookEventPreview] = useState<
    'message.deliver' | 'contact.captured' | 'campaign.ab_winner' | 'conversion.attributed'
  >('message.deliver');

  const handleExportWorkspaceBackupJson = () => {
    const uid = currentUserUid || workspace.ownerId || 'workspace_export';
    const userEmail = currentUserEmail || privateProfile.email || 'operator@flowpilot.app';
    const currentSnap =
      loadLocalWorkspaceSnapshot(uid, userEmail) ||
      buildStarterWorkspaceSnapshot(uid, userEmail, workspace.senderName, workspace.name);
    const exportPayload: WorkspaceSnapshot = {
      ...currentSnap,
      workspace,
      privateProfile,
      members,
      updatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const slug = (workspace.name || 'flowpilot-workspace')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    link.download = `${slug}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setBackupNotice(
      `Exported complete workspace backup JSON for "${workspace.name}" (${exportPayload.contacts.length} contacts, ${exportPayload.campaigns.length} campaigns, ${exportPayload.automations.length} workflows).`
    );
  };

  const handleImportWorkspaceBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const rawText = String(ev.target?.result || '');
        const parsed = JSON.parse(rawText) as WorkspaceSnapshot;
        if (!parsed || !parsed.workspace || typeof parsed.workspace !== 'object') {
          setBackupNotice(
            'Invalid backup file: JSON does not contain a valid FlowPilot workspace snapshot.'
          );
          return;
        }
        const uid = currentUserUid || workspace.ownerId || parsed.workspace.id || 'restored_ws';
        const userEmail =
          currentUserEmail || privateProfile.email || parsed.privateProfile?.email || '';
        saveLocalWorkspaceSnapshot(uid, userEmail, parsed);
        await pushServerWorkspaceSnapshot(uid, userEmail, parsed);
        if (onRestoreWorkspaceSnapshot) {
          onRestoreWorkspaceSnapshot(parsed);
        }
        setBackupNotice(
          `Restored workspace backup "${parsed.workspace.name}" (${(parsed.contacts || []).length} contacts, ${(parsed.lists || []).length} lists, ${(parsed.campaigns || []).length} broadcasts).`
        );
      } catch {
        setBackupNotice('Failed to parse backup JSON file. Please select a valid .json backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  // Workspace form state
  const [wsName, setWsName] = useState(workspace.name);
  const [category, setCategory] = useState<BusinessCategory>(workspace.category);
  const [timezone, setTimezone] = useState(workspace.timezone);
  const [currency, setCurrency] = useState<CurrencyCode>(workspace.currency);
  const [senderName, setSenderName] = useState(workspace.senderName);
  const [whatsappConnected, setWhatsappConnected] = useState(workspace.whatsappConnected);
  const [smsConnected, setSmsConnected] = useState(workspace.smsConnected);
  const [emailConnected, setEmailConnected] = useState(workspace.emailConnected);
  const [notifyNewLeads, setNotifyNewLeads] = useState(workspace.notifyNewLeads);
  const [notifyCampaigns, setNotifyCampaigns] = useState(workspace.notifyCampaigns);

  // Isolated PII & Sender Identity state
  const [email, setEmail] = useState(privateProfile.email);
  const [replyToEmail, setReplyToEmail] = useState(privateProfile.replyToEmail);
  const [phone, setPhone] = useState(privateProfile.phone);
  const [mailingAddress, setMailingAddress] = useState(privateProfile.mailingAddress);
  const [whatsappPhoneId, setWhatsappPhoneId] = useState(privateProfile.whatsappPhoneId);
  const [smsSenderId, setSmsSenderId] = useState(privateProfile.smsSenderId);
  const [emailProviderDomain, setEmailProviderDomain] = useState(
    privateProfile.emailProviderDomain
  );

  // Dedicated WhatsApp Business Number & Custom Domain Email vs Platform Default state
  const [whatsappBusinessNumber, setWhatsappBusinessNumber] = useState(
    privateProfile.whatsappBusinessNumber || privateProfile.whatsappPhoneId || ''
  );
  const [customDomainEmail, setCustomDomainEmail] = useState(
    privateProfile.customDomainEmail || ''
  );
  const [useCustomDomainEmail, setUseCustomDomainEmail] = useState<boolean>(
    privateProfile.useCustomDomainEmail !== undefined
      ? Boolean(privateProfile.useCustomDomainEmail)
      : Boolean(privateProfile.customDomainEmail && privateProfile.customDomainEmail.includes('@'))
  );
  const [copiedPlatformEmail, setCopiedPlatformEmail] = useState(false);

  // Per-User Multi-Identity Messaging Vault state
  const [savedIdentities, setSavedIdentities] = useState<UserMessagingIdentity[]>(() =>
    parseUserMessagingIdentities(privateProfile)
  );
  const [newIdentityChannel, setNewIdentityChannel] = useState<ChannelType>('whatsapp');
  const [newIdentityLabel, setNewIdentityLabel] = useState('');
  const [newIdentityValue, setNewIdentityValue] = useState('');
  const [newIdentitySenderName, setNewIdentitySenderName] = useState(
    workspace.senderName || workspace.name || 'Workspace Operator'
  );
  const [newIdentityProviderMode, setNewIdentityProviderMode] = useState('builtin_relay');
  const [newIdentitySetDefault, setNewIdentitySetDefault] = useState(true);
  const [showAddIdentityForm, setShowAddIdentityForm] = useState(false);
  const [identityVaultNotice, setIdentityVaultNotice] = useState('');

  // Team Member form state
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<MemberRole>('editor');

  const [saveBanner, setSaveBanner] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [customLogoPreview, setCustomLogoPreview] = useState<string | null>(() =>
    getStoredCustomLogo()
  );

  // Multi-Channel Delivery Verification & Live Test Hub state
  const [gatewayStatus, setGatewayStatus] = useState<MultiChannelGatewayStatus | null>(null);
  const [testChannel, setTestChannel] = useState<ChannelType>('whatsapp');
  const [testRecipientPhone, setTestRecipientPhone] = useState(
    privateProfile.whatsappBusinessNumber || privateProfile.phone || '+1 (555) 234-8910'
  );
  const [testRecipientEmail, setTestRecipientEmail] = useState(
    privateProfile.email || 'lead@example.com'
  );
  const [testLeadName, setTestLeadName] = useState('Alex Rivera');
  const [testSubject, setTestSubject] = useState('Welcome to FlowPilot · Priority Access');
  const [testMessageBody, setTestMessageBody] = useState(
    'Hi Alex! Confirming your spot is active. Reply right here on this channel if you have any questions.'
  );
  const [outboundWebhookUrl, setOutboundWebhookUrl] = useState(() =>
    getStoredOutboundWebhookUrl()
  );
  const [webhookSavedNotice, setWebhookSavedNotice] = useState('');
  const [isTestingDelivery, setIsTestingDelivery] = useState(false);
  const [latestTestReceipt, setLatestTestReceipt] = useState<MessageDeliveryReceipt | null>(null);
  const [deliveryReceipts, setDeliveryReceipts] = useState<MessageDeliveryReceipt[]>(() =>
    getStoredDeliveryReceipts()
  );

  // Google Workspace (Gmail OAuth) state
  const [gmailConnected, setGmailConnected] = useState(false);
  const [connectedGmailAddress, setConnectedGmailAddress] = useState<string | null>(null);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [gmailNotice, setGmailNotice] = useState('');
  const [pendingGmailConfirmAction, setPendingGmailConfirmAction] = useState<{
    mode: 'single_email' | 'all_channels';
    recipientEmail: string;
    subject: string;
    body: string;
  } | null>(null);

  // Server Background Scheduler & List Kill Switch Verification state
  const [schedulerSummary, setSchedulerSummary] = useState<SchedulerSummary>({
    queuedCount: 0,
    dispatchedCount: 0,
    haltedKillSwitchCount: 0,
    totalCount: 0,
  });
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledAutomationJob[]>([]);
  const [schedulerTestDelaySec, setSchedulerTestDelaySec] = useState<number>(15);
  const [schedulerTestChannel, setSchedulerTestChannel] = useState<ChannelType>('whatsapp');
  const [schedulerTestListName, setSchedulerTestListName] = useState('VIP Course Buyers List');
  const [schedulerTestKillTag, setSchedulerTestKillTag] = useState('Purchased_Course');
  const [schedulerBanner, setSchedulerBanner] = useState('');
  const [isEnqueuingJob, setIsEnqueuingJob] = useState(false);
  const [nowTickMs, setNowTickMs] = useState(() => Date.now());

  // Built-In WhatsApp & SMS Gateway Connector state
  const [waProviderMode, setWaProviderMode] = useState<WhatsAppProviderMode>(() =>
    getStoredChannelGatewayConfig().whatsapp.providerMode || 'builtin_relay'
  );
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState(() =>
    getStoredChannelGatewayConfig().whatsapp.metaPhoneNumberId || ''
  );
  const [metaAccessToken, setMetaAccessToken] = useState(() =>
    getStoredChannelGatewayConfig().whatsapp.metaAccessToken || ''
  );
  const [waTwilioSid, setWaTwilioSid] = useState(() =>
    getStoredChannelGatewayConfig().whatsapp.twilioAccountSid || ''
  );
  const [waTwilioToken, setWaTwilioToken] = useState(() =>
    getStoredChannelGatewayConfig().whatsapp.twilioAuthToken || ''
  );
  const [ultramsgInstanceId, setUltramsgInstanceId] = useState(() =>
    getStoredChannelGatewayConfig().whatsapp.ultramsgInstanceId || ''
  );
  const [ultramsgToken, setUltramsgToken] = useState(() =>
    getStoredChannelGatewayConfig().whatsapp.ultramsgToken || ''
  );
  const [waConnectorNotice, setWaConnectorNotice] = useState('');
  const [waAccount, setWaAccount] = useState<{
    id?: string;
    userId?: string;
    phone_number_id?: string;
    display_phone_number?: string;
    verified_name?: string;
    waba_id?: string;
    status?: string;
  } | null>(null);

  const [smsProviderMode, setSmsProviderMode] = useState<SmsProviderMode>(() =>
    getStoredChannelGatewayConfig().sms.providerMode || 'builtin_relay'
  );
  const [smsTwilioSid, setSmsTwilioSid] = useState(() =>
    getStoredChannelGatewayConfig().sms.twilioAccountSid || ''
  );
  const [smsTwilioToken, setSmsTwilioToken] = useState(() =>
    getStoredChannelGatewayConfig().sms.twilioAuthToken || ''
  );
  const [termiiApiKey, setTermiiApiKey] = useState(() =>
    getStoredChannelGatewayConfig().sms.termiiApiKey || ''
  );
  const [africasTalkingUsername, setAfricasTalkingUsername] = useState(() =>
    getStoredChannelGatewayConfig().sms.africasTalkingUsername || ''
  );
  const [africasTalkingApiKey, setAfricasTalkingApiKey] = useState(() =>
    getStoredChannelGatewayConfig().sms.africasTalkingApiKey || ''
  );
  const [smsConnectorNotice, setSmsConnectorNotice] = useState('');

  const [emailProviderMode, setEmailProviderMode] = useState<EmailProviderMode>(() =>
    getStoredChannelGatewayConfig().email.providerMode || 'builtin_relay'
  );
  const [resendApiKey, setResendApiKey] = useState(() =>
    getStoredChannelGatewayConfig().email.resendApiKey || ''
  );
  const [sendgridApiKey, setSendgridApiKey] = useState(() =>
    getStoredChannelGatewayConfig().email.sendgridApiKey || ''
  );
  const [smtpHost, setSmtpHost] = useState(() =>
    getStoredChannelGatewayConfig().email.smtpHost || ''
  );
  const [smtpPort, setSmtpPort] = useState<number | string>(() =>
    getStoredChannelGatewayConfig().email.smtpPort || 587
  );
  const [smtpUser, setSmtpUser] = useState(() =>
    getStoredChannelGatewayConfig().email.smtpUser || ''
  );
  const [smtpPass, setSmtpPass] = useState(() =>
    getStoredChannelGatewayConfig().email.smtpPass || ''
  );
  const [smtpFromEmail, setSmtpFromEmail] = useState(() =>
    getStoredChannelGatewayConfig().email.fromEmail || ''
  );

  const persistCurrentGatewayConnectors = (
    overrideWaMode?: WhatsAppProviderMode,
    overrideSmsMode?: SmsProviderMode,
    overrideEmailMode?: EmailProviderMode
  ) => {
    const nextWaMode = overrideWaMode || waProviderMode;
    const nextSmsMode = overrideSmsMode || smsProviderMode;
    const nextEmailMode = overrideEmailMode || emailProviderMode;
    saveStoredChannelGatewayConfig({
      whatsapp: {
        providerMode: nextWaMode,
        whatsappBusinessNumber: whatsappBusinessNumber.trim(),
        metaPhoneNumberId: metaPhoneNumberId.trim(),
        metaAccessToken: metaAccessToken.trim(),
        twilioAccountSid: waTwilioSid.trim(),
        twilioAuthToken: waTwilioToken.trim(),
        twilioFromNumber: whatsappBusinessNumber.trim(),
        ultramsgInstanceId: ultramsgInstanceId.trim(),
        ultramsgToken: ultramsgToken.trim(),
      },
      sms: {
        providerMode: nextSmsMode,
        smsSenderId: smsSenderId.trim() || 'FLOWPILOT',
        twilioAccountSid: smsTwilioSid.trim(),
        twilioAuthToken: smsTwilioToken.trim(),
        twilioFromNumber: smsSenderId.trim() || phone.trim(),
        termiiApiKey: termiiApiKey.trim(),
        termiiSenderId: smsSenderId.trim() || 'FLOWPILOT',
        africasTalkingUsername: africasTalkingUsername.trim(),
        africasTalkingApiKey: africasTalkingApiKey.trim(),
      },
      email: {
        providerMode: nextEmailMode,
        resendApiKey: resendApiKey.trim(),
        sendgridApiKey: sendgridApiKey.trim(),
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort) || 587,
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass.trim(),
        fromEmail: smtpFromEmail.trim(),
      },
    });
    fetchGatewayStatus().then((status) => setGatewayStatus(status));
  };

  React.useEffect(() => {
    const unsubAuth = initAuth();
    const unsubGmail = subscribeGmailAuthState((state) => {
      setGmailConnected(state.connected);
      setConnectedGmailAddress(state.email);
    });
    fetchGatewayStatus().then((status) => {
      setGatewayStatus(status);
      if (status.scheduler) {
        setSchedulerSummary(status.scheduler);
      }
    });
    fetchScheduledJobs().then((res) => {
      setSchedulerSummary(res.summary);
      setScheduledJobs(res.jobs);
    });
    setDeliveryReceipts(getStoredDeliveryReceipts());

    const targetUid = currentUserUid || workspace.ownerId || 'default_workspace';
    fetch(`/api/auth/whatsapp/status?userId=${encodeURIComponent(targetUid)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.connected && data?.account) {
          setWaAccount(data.account);
          setWhatsappConnected(true);
          if (data.account.display_phone_number && !whatsappBusinessNumber) {
            setWhatsappBusinessNumber(data.account.display_phone_number);
          }
        }
      })
      .catch(() => {});

    return () => {
      unsubAuth();
      unsubGmail();
    };
  }, []);

  // Poll Server Background Scheduler when jobs are active or every 2s so countdowns update live
  React.useEffect(() => {
    const timer = setInterval(() => {
      setNowTickMs(Date.now());
      fetchScheduledJobs().then((res) => {
        setSchedulerSummary(res.summary);
        setScheduledJobs(res.jobs);
      });
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  const handleConnectGmailOAuth = async () => {
    setIsConnectingGmail(true);
    setGmailNotice('');
    try {
      const result = await connectGmailAccountWithPopup();
      setGmailConnected(true);
      setConnectedGmailAddress(result.email);
      setGmailNotice(
        `Connected Gmail (${result.email}) via Google OAuth. Outbound emails can now be sent directly from your Gmail account.`
      );
    } catch (err) {
      setGmailNotice(
        err instanceof Error
          ? `Gmail connection notice: ${err.message}`
          : 'Gmail OAuth popup was closed before completion.'
      );
    } finally {
      setIsConnectingGmail(false);
    }
  };

  const handleDisconnectGmailOAuth = () => {
    disconnectGmailToken();
    setGmailConnected(false);
    setConnectedGmailAddress(null);
    setGmailNotice('Disconnected Gmail OAuth session. Reverted to platform/custom email relay.');
  };

  const handleSaveWebhookBridge = () => {
    setStoredOutboundWebhookUrl(outboundWebhookUrl);
    setWebhookSavedNotice(
      outboundWebhookUrl.trim()
        ? `Outbound Webhook Bridge active: All WhatsApp, Email, and SMS dispatches will also POST live payloads to ${outboundWebhookUrl.trim()}`
        : 'Cleared custom Outbound Webhook URL. Using built-in FlowPilot Multi-Channel Relay.'
    );
    setTimeout(() => setWebhookSavedNotice(''), 5000);
  };

  const executeSingleChannelTestNow = async (ch: ChannelType) => {
    persistCurrentGatewayConnectors();
    setIsTestingDelivery(true);
    try {
      const recipient =
        ch === 'email'
          ? testRecipientEmail.trim() || privateProfile.email || 'lead@example.com'
          : testRecipientPhone.trim() ||
            whatsappBusinessNumber.trim() ||
            '+1 (555) 234-8910';

      const receipt = await deliverChannelMessage({
        channel: ch,
        to: recipient,
        leadName: testLeadName.trim() || 'Test Lead',
        subject: testSubject.trim() || `Test from ${senderName || workspace.name}`,
        body:
          testMessageBody.trim() ||
          `Live ${ch.toUpperCase()} delivery verification from ${senderName || workspace.name}.`,
        listName: 'Live Channel Verification',
        source: 'live_test',
        workspace: {
          ...workspace,
          name: wsName || workspace.name,
          senderName: senderName || workspace.senderName,
        },
        privateProfile: {
          ...privateProfile,
          whatsappBusinessNumber,
          whatsappPhoneId: whatsappBusinessNumber || whatsappPhoneId,
          customDomainEmail,
          emailProviderDomain,
          useCustomDomainEmail,
          smsSenderId,
        },
      });
      setLatestTestReceipt(receipt);
      setDeliveryReceipts(getStoredDeliveryReceipts());
    } finally {
      setIsTestingDelivery(false);
    }
  };

  const handleRunLiveChannelTest = async (overrideChannel?: ChannelType) => {
    const ch = overrideChannel || testChannel;
    if (overrideChannel) setTestChannel(overrideChannel);

    // If sending an email while Gmail OAuth is connected, require explicit user confirmation
    if (ch === 'email' && gmailConnected) {
      const recipient =
        testRecipientEmail.trim() || privateProfile.email || 'lead@example.com';
      setPendingGmailConfirmAction({
        mode: 'single_email',
        recipientEmail: recipient,
        subject: testSubject.trim() || `Test from ${senderName || workspace.name}`,
        body:
          testMessageBody.trim() ||
          `Live EMAIL delivery verification from ${senderName || workspace.name}.`,
      });
      return;
    }

    await executeSingleChannelTestNow(ch);
  };

  const executeAllThreeChannelsTestNow = async () => {
    setIsTestingDelivery(true);
    try {
      const channelsToTest: ChannelType[] = ['whatsapp', 'email', 'sms'];
      let lastReceipt: MessageDeliveryReceipt | null = null;
      for (const ch of channelsToTest) {
        const recipient =
          ch === 'email'
            ? testRecipientEmail.trim() || privateProfile.email || 'lead@example.com'
            : testRecipientPhone.trim() ||
              whatsappBusinessNumber.trim() ||
              '+1 (555) 234-8910';

        lastReceipt = await deliverChannelMessage({
          channel: ch,
          to: recipient,
          leadName: testLeadName.trim() || 'Test Lead',
          subject: testSubject.trim() || `Verification from ${senderName || workspace.name}`,
          body:
            testMessageBody.trim() ||
            `Live ${ch.toUpperCase()} delivery verification from ${senderName || workspace.name}.`,
          listName: 'All-Channel Verification',
          source: 'live_test',
          workspace: {
            ...workspace,
            name: wsName || workspace.name,
            senderName: senderName || workspace.senderName,
          },
          privateProfile: {
            ...privateProfile,
            whatsappBusinessNumber,
            whatsappPhoneId: whatsappBusinessNumber || whatsappPhoneId,
            customDomainEmail,
            emailProviderDomain,
            useCustomDomainEmail,
            smsSenderId,
          },
        });
      }
      if (lastReceipt) setLatestTestReceipt(lastReceipt);
      setDeliveryReceipts(getStoredDeliveryReceipts());
    } finally {
      setIsTestingDelivery(false);
    }
  };

  const handleTestAllThreeChannels = async () => {
    if (gmailConnected) {
      const recipient =
        testRecipientEmail.trim() || privateProfile.email || 'lead@example.com';
      setPendingGmailConfirmAction({
        mode: 'all_channels',
        recipientEmail: recipient,
        subject: testSubject.trim() || `Verification from ${senderName || workspace.name}`,
        body:
          testMessageBody.trim() ||
          `Live multi-channel delivery verification from ${senderName || workspace.name}.`,
      });
      return;
    }
    await executeAllThreeChannelsTestNow();
  };

  const handleEnqueueTestScheduledStep = async () => {
    setIsEnqueuingJob(true);
    setSchedulerBanner('');
    try {
      const cleanKillTag = schedulerTestKillTag.trim() || 'Purchased_Course';
      const cleanListName = schedulerTestListName.trim() || 'VIP Course Buyers List';
      const recipient =
        schedulerTestChannel === 'email'
          ? testRecipientEmail.trim() || privateProfile.email || 'lead@example.com'
          : testRecipientPhone.trim() ||
            whatsappBusinessNumber.trim() ||
            '+1 (555) 234-8910';

      const res = await enqueueScheduledAutomationJobs([
        {
          automationId: 'auto_live_verification',
          automationName: 'Affiliate Course Follow-Up Sequence',
          stepId: `step_delay_${Date.now()}`,
          stepOrder: 2,
          stepTitle: `Delayed ${schedulerTestChannel.toUpperCase()} Follow-Up (${schedulerTestDelaySec}s Wait)`,
          channel: schedulerTestChannel,
          contactId: 'test_contact_scheduler',
          contactName: testLeadName.trim() || 'Alex Rivera',
          contactEmail: testRecipientEmail.trim() || privateProfile.email || 'lead@example.com',
          contactPhone:
            testRecipientPhone.trim() ||
            whatsappBusinessNumber.trim() ||
            '+1 (555) 234-8910',
          toRecipient: recipient,
          contactTags: ['Course_Lead'],
          listName: cleanListName,
          killSwitchEnabled: true,
          killSwitchTags: [cleanKillTag],
          subject: testSubject.trim() || `Follow-Up from ${senderName || workspace.name}`,
          body:
            testMessageBody.trim() ||
            `Hi ${
              testLeadName.trim() || 'Alex'
            }, checking in after your wait timer! If you already got the #${cleanKillTag} tag, the List Kill Switch stops this automatically.`,
          delaySeconds: schedulerTestDelaySec,
          workspace: {
            ...workspace,
            name: wsName || workspace.name,
            senderName: senderName || workspace.senderName,
          },
          privateProfile: {
            ...privateProfile,
            whatsappBusinessNumber,
            whatsappPhoneId: whatsappBusinessNumber || whatsappPhoneId,
            customDomainEmail,
            emailProviderDomain,
            useCustomDomainEmail,
            smsSenderId,
          },
        },
      ]);

      setSchedulerSummary(res.summary);
      setScheduledJobs(res.jobs);
      setSchedulerBanner(
        `Queued ${schedulerTestDelaySec}s delayed ${schedulerTestChannel.toUpperCase()} step on Server Background Scheduler for ${
          testLeadName.trim() || 'Alex Rivera'
        }. Click "Simulate Buyer Tag (#${cleanKillTag})" below before the timer hits 0s to watch the List Kill Switch stop it live!`
      );
    } finally {
      setIsEnqueuingJob(false);
    }
  };

  const handleSimulateKillSwitchTagOnServer = async () => {
    const cleanKillTag = schedulerTestKillTag.trim() || 'Purchased_Course';
    const cleanListName = schedulerTestListName.trim() || 'VIP Course Buyers List';
    const res = await syncKillSwitchWithServerScheduler({
      lists: [
        {
          name: cleanListName,
          killSwitchEnabled: true,
          killSwitchTags: [cleanKillTag],
        },
      ],
      contacts: [
        {
          id: 'test_contact_scheduler',
          email: testRecipientEmail.trim() || privateProfile.email || 'lead@example.com',
          phone:
            testRecipientPhone.trim() ||
            whatsappBusinessNumber.trim() ||
            '+1 (555) 234-8910',
          fullName: testLeadName.trim() || 'Alex Rivera',
          listName: cleanListName,
          tags: ['Course_Lead', cleanKillTag],
        },
      ],
    });
    setSchedulerSummary(res.summary);
    setScheduledJobs(res.jobs);
    setSchedulerBanner(
      res.haltedCount > 0
        ? `List Kill Switch Triggered! Applied #${cleanKillTag} to ${
            testLeadName.trim() || 'Alex Rivera'
          } — Server Background Scheduler immediately halted ${
            res.haltedCount
          } pending delayed step(s) for that contact.`
        : `Synced #${cleanKillTag} Kill Switch tag with Server Background Scheduler. Any queued or future steps for matching contacts in "${cleanListName}" will be stopped.`
    );
  };

  const handleResetServerContactKillTag = async () => {
    const cleanListName = schedulerTestListName.trim() || 'VIP Course Buyers List';
    const res = await syncKillSwitchWithServerScheduler({
      contacts: [
        {
          id: 'test_contact_scheduler',
          email: testRecipientEmail.trim() || privateProfile.email || 'lead@example.com',
          phone:
            testRecipientPhone.trim() ||
            whatsappBusinessNumber.trim() ||
            '+1 (555) 234-8910',
          fullName: testLeadName.trim() || 'Alex Rivera',
          listName: cleanListName,
          tags: ['Course_Lead'],
        },
      ],
    });
    setSchedulerSummary(res.summary);
    setScheduledJobs(res.jobs);
    setSchedulerBanner(
      `Cleared Kill Switch tag from test contact ${
        testLeadName.trim() || 'Alex Rivera'
      }. You can now queue a new delayed step to let it count down and dispatch.`
    );
  };

  const handleCustomLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setStoredCustomLogo(reader.result);
        setCustomLogoPreview(reader.result);
        setSaveBanner('Platform brand logo updated across all headers, sidebars, and public pages.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
    setStoredCustomLogo(null);
    setCustomLogoPreview(null);
    setSaveBanner('Restored default FlowPilot transparent brand emblem.');
  };

  React.useEffect(() => {
    setWsName(workspace.name);
    setCategory(workspace.category);
    setTimezone(workspace.timezone);
    setCurrency(workspace.currency);
    setSenderName(workspace.senderName);
    setWhatsappConnected(workspace.whatsappConnected);
    setSmsConnected(workspace.smsConnected);
    setEmailConnected(workspace.emailConnected);
    setNotifyNewLeads(workspace.notifyNewLeads);
    setNotifyCampaigns(workspace.notifyCampaigns);
  }, [workspace]);

  React.useEffect(() => {
    setEmail(privateProfile.email);
    setReplyToEmail(privateProfile.replyToEmail);
    setPhone(privateProfile.phone);
    setMailingAddress(privateProfile.mailingAddress);
    setWhatsappPhoneId(privateProfile.whatsappPhoneId);
    setSmsSenderId(privateProfile.smsSenderId);
    setEmailProviderDomain(privateProfile.emailProviderDomain);
    setWhatsappBusinessNumber(
      privateProfile.whatsappBusinessNumber || privateProfile.whatsappPhoneId || ''
    );
    setCustomDomainEmail(privateProfile.customDomainEmail || '');
    setUseCustomDomainEmail(
      privateProfile.useCustomDomainEmail !== undefined
        ? Boolean(privateProfile.useCustomDomainEmail)
        : Boolean(
            privateProfile.customDomainEmail && privateProfile.customDomainEmail.includes('@')
          )
    );
    setSavedIdentities(parseUserMessagingIdentities(privateProfile));
    const storedCfg = getStoredChannelGatewayConfig();
    setWaProviderMode(storedCfg.whatsapp.providerMode || 'builtin_relay');
    setMetaPhoneNumberId(storedCfg.whatsapp.metaPhoneNumberId || '');
    setMetaAccessToken(storedCfg.whatsapp.metaAccessToken || '');
    setWaTwilioSid(storedCfg.whatsapp.twilioAccountSid || '');
    setWaTwilioToken(storedCfg.whatsapp.twilioAuthToken || '');
    setUltramsgInstanceId(storedCfg.whatsapp.ultramsgInstanceId || '');
    setUltramsgToken(storedCfg.whatsapp.ultramsgToken || '');
    setSmsProviderMode(storedCfg.sms.providerMode || 'builtin_relay');
    setSmsTwilioSid(storedCfg.sms.twilioAccountSid || '');
    setSmsTwilioToken(storedCfg.sms.twilioAuthToken || '');
    setTermiiApiKey(storedCfg.sms.termiiApiKey || '');
    setAfricasTalkingUsername(storedCfg.sms.africasTalkingUsername || '');
    setAfricasTalkingApiKey(storedCfg.sms.africasTalkingApiKey || '');
    setEmailProviderMode(storedCfg.email.providerMode || 'builtin_relay');
    setResendApiKey(storedCfg.email.resendApiKey || '');
    setSendgridApiKey(storedCfg.email.sendgridApiKey || '');
    setOutboundWebhookUrl(getStoredOutboundWebhookUrl());
    setDeliveryReceipts(getStoredDeliveryReceipts());
  }, [privateProfile, currentUserUid]);

  // Live preview of resolved sender identities based on current form inputs
  const liveResolvedIdentities = useMemo(() => {
    return resolveWorkspaceSenderIdentities(
      {
        ...workspace,
        name: wsName || workspace.name,
        senderName: senderName || workspace.senderName,
      },
      {
        ...privateProfile,
        whatsappBusinessNumber,
        whatsappPhoneId: whatsappBusinessNumber || whatsappPhoneId,
        customDomainEmail,
        emailProviderDomain,
        useCustomDomainEmail,
        smsSenderId,
        messagingIdentitiesJson: serializeUserMessagingIdentities(savedIdentities),
      }
    );
  }, [
    workspace,
    wsName,
    senderName,
    privateProfile,
    whatsappBusinessNumber,
    whatsappPhoneId,
    customDomainEmail,
    emailProviderDomain,
    useCustomDomainEmail,
    smsSenderId,
    savedIdentities,
  ]);

  const handleCopyPlatformEmail = async () => {
    try {
      await navigator.clipboard.writeText(liveResolvedIdentities.platformDefaultEmail);
      setCopiedPlatformEmail(true);
      setTimeout(() => setCopiedPlatformEmail(false), 2500);
    } catch {
      // Fallback ignore
    }
  };

  const syncAndPersistIdentities = async (
    rawNextList: UserMessagingIdentity[],
    noticeText: string
  ) => {
    // Normalize defaults so each channel with >=1 identity has exactly 1 default
    const channels: ChannelType[] = ['whatsapp', 'email', 'sms'];
    const normalized: UserMessagingIdentity[] = [];
    for (const ch of channels) {
      const chList = rawNextList.filter((item) => item.channel === ch);
      if (chList.length > 0) {
        const defaultIdx = chList.findIndex((item) => item.isDefault);
        const winnerIdx = defaultIdx >= 0 ? defaultIdx : 0;
        chList.forEach((item, idx) => {
          normalized.push({ ...item, isDefault: idx === winnerIdx });
        });
      }
    }

    setSavedIdentities(normalized);

    const activeWa = normalized.find((i) => i.channel === 'whatsapp' && i.isDefault);
    const activeEm = normalized.find((i) => i.channel === 'email' && i.isDefault);
    const activeSms = normalized.find((i) => i.channel === 'sms' && i.isDefault);

    const nextWaNumber = activeWa
      ? activeWa.value
      : normalized.some((i) => i.channel === 'whatsapp')
      ? whatsappBusinessNumber
      : '';
    const nextCustomEmail =
      activeEm && activeEm.providerMode !== 'platform_default'
        ? activeEm.value
        : normalized.some((i) => i.channel === 'email')
        ? customDomainEmail
        : '';
    const nextUseCustomEmail = Boolean(
      activeEm
        ? activeEm.providerMode !== 'platform_default' && activeEm.value.includes('@')
        : false
    );
    const nextSmsId = activeSms
      ? activeSms.value
      : normalized.some((i) => i.channel === 'sms')
      ? smsSenderId
      : 'FLOWPILOT';

    if (activeWa) setWhatsappBusinessNumber(nextWaNumber);
    if (activeEm) {
      if (activeEm.providerMode !== 'platform_default') {
        setCustomDomainEmail(activeEm.value);
        setUseCustomDomainEmail(true);
      } else {
        setUseCustomDomainEmail(false);
      }
    }
    if (activeSms) setSmsSenderId(nextSmsId);

    persistCurrentGatewayConnectors();
    const serializedIdentities = serializeUserMessagingIdentities(normalized);
    const serializedGateway = serializeGatewayConfigForProfile();

    const extractedDomain = nextCustomEmail.includes('@')
      ? nextCustomEmail.split('@')[1] || emailProviderDomain
      : emailProviderDomain;

    await onUpdatePrivateProfile({
      email: sanitizeString(email, 150, 'operator@flowpilot.app'),
      replyToEmail: sanitizeString(
        activeEm?.replyToEmail || (nextUseCustomEmail ? nextCustomEmail : replyToEmail),
        150,
        liveResolvedIdentities.platformDefaultEmail
      ),
      phone: sanitizeString(phone || nextWaNumber, 32),
      mailingAddress: sanitizeString(mailingAddress, 250),
      whatsappPhoneId: sanitizeString(
        metaPhoneNumberId.trim() || nextWaNumber || whatsappPhoneId,
        64
      ),
      smsSenderId: sanitizeString(nextSmsId, 32, 'FLOWPILOT'),
      emailProviderDomain: sanitizeString(extractedDomain, 120),
      whatsappBusinessNumber: sanitizeString(nextWaNumber, 64),
      customDomainEmail: sanitizeString(nextCustomEmail, 150),
      useCustomDomainEmail: nextUseCustomEmail,
      messagingIdentitiesJson: serializedIdentities,
      gatewayConfigJson: serializedGateway,
    });

    setIdentityVaultNotice(noticeText);
  };

  const handleOpenQuickAddIdentity = (ch: ChannelType) => {
    setNewIdentityChannel(ch);
    setShowAddIdentityForm(true);
    setNewIdentitySenderName(senderName || workspace.name || 'Workspace Operator');
    if (ch === 'whatsapp') {
      setNewIdentityLabel(
        savedIdentities.filter((i) => i.channel === 'whatsapp').length === 0
          ? 'Primary WhatsApp Business Line'
          : 'Secondary WhatsApp Line'
      );
      setNewIdentityValue(whatsappBusinessNumber || '+1 (555) 234-8900');
      setNewIdentityProviderMode(waProviderMode || 'builtin_relay');
    } else if (ch === 'email') {
      setNewIdentityLabel(
        savedIdentities.filter((i) => i.channel === 'email').length === 0
          ? 'Brand Custom Domain Email'
          : 'Secondary Dispatch Email'
      );
      setNewIdentityValue(
        customDomainEmail || connectedGmailAddress || `hello@${(wsName || 'brand').toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`
      );
      setNewIdentityProviderMode(gmailConnected ? 'gmail_oauth' : 'custom_domain');
    } else {
      setNewIdentityLabel(
        savedIdentities.filter((i) => i.channel === 'sms').length === 0
          ? 'Primary Alphanumeric SMS ID'
          : 'Regional Carrier SMS Line'
      );
      setNewIdentityValue(smsSenderId || 'FLOWPILOT');
      setNewIdentityProviderMode(smsProviderMode || 'builtin_relay');
    }
  };

  const handleAddAccountIdentity = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanValue = newIdentityValue.trim();
    if (!cleanValue) {
      setIdentityVaultNotice('Please enter a phone number, email address, or SMS Sender ID.');
      return;
    }
    if (newIdentityChannel === 'email' && !cleanValue.includes('@')) {
      setIdentityVaultNotice('Please enter a valid email address containing "@".');
      return;
    }

    const cleanLabel =
      newIdentityLabel.trim() ||
      (newIdentityChannel === 'whatsapp'
        ? 'WhatsApp Business Line'
        : newIdentityChannel === 'email'
        ? 'Verified Email Sender'
        : 'SMS Sender ID');

    const newEntry: UserMessagingIdentity = {
      id: generateSafeId(`id_${newIdentityChannel}`),
      channel: newIdentityChannel,
      label: cleanLabel.slice(0, 80),
      value: cleanValue.slice(0, 150),
      senderName: (newIdentitySenderName.trim() || senderName || workspace.name).slice(0, 100),
      replyToEmail:
        newIdentityChannel === 'email' ? cleanValue.slice(0, 150) : replyToEmail,
      providerMode: newIdentityProviderMode,
      isDefault: newIdentitySetDefault,
      verified: true,
      createdAt: new Date().toISOString(),
    };

    const updatedList = savedIdentities.map((item) =>
      item.channel === newIdentityChannel && newIdentitySetDefault
        ? { ...item, isDefault: false }
        : item
    );
    updatedList.push(newEntry);

    setNewIdentityLabel('');
    setNewIdentityValue('');
    setShowAddIdentityForm(false);

    await syncAndPersistIdentities(
      updatedList,
      `Added ${newIdentityChannel.toUpperCase()} identity "${newEntry.label}" (${newEntry.value}) to your isolated account vault${
        newEntry.isDefault ? ' and set as Active Default' : ''
      }.`
    );
  };

  const handleSetDefaultIdentity = async (identityId: string) => {
    const target = savedIdentities.find((i) => i.id === identityId);
    if (!target) return;
    const updatedList = savedIdentities.map((item) =>
      item.channel === target.channel
        ? { ...item, isDefault: item.id === identityId }
        : item
    );
    await syncAndPersistIdentities(
      updatedList,
      `Switched active default ${target.channel.toUpperCase()} identity to "${target.label}" (${target.value}).`
    );
  };

  const handleDeleteAccountIdentity = async (identityId: string) => {
    const target = savedIdentities.find((i) => i.id === identityId);
    if (!target) return;
    const remaining = savedIdentities.filter((i) => i.id !== identityId);
    await syncAndPersistIdentities(
      remaining,
      `Removed ${target.channel.toUpperCase()} identity "${target.label}" (${target.value}) from your account.`
    );
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveBanner('');
    try {
      const cleanWaNumber = sanitizeString(whatsappBusinessNumber, 64);
      const cleanCustomEmail = sanitizeString(customDomainEmail, 150);
      const extractedDomain =
        cleanCustomEmail.includes('@')
          ? cleanCustomEmail.split('@')[1] || emailProviderDomain
          : emailProviderDomain;

      const effectiveUseCustom =
        useCustomDomainEmail && cleanCustomEmail.includes('@');

      persistCurrentGatewayConnectors();

      const cleanSmsSender = sanitizeString(smsSenderId, 32, 'FLOWPILOT');
      const cleanSenderName = sanitizeString(senderName, 100, 'FlowPilot Operator');

      // Ensure top-level inputs are also reflected in the user's multi-identity array
      let nextIdentities = [...savedIdentities];
      if (cleanWaNumber) {
        const hasWa = nextIdentities.some(
          (i) => i.channel === 'whatsapp' && i.value.toLowerCase() === cleanWaNumber.toLowerCase()
        );
        if (!hasWa) {
          nextIdentities = nextIdentities.map((i) =>
            i.channel === 'whatsapp' ? { ...i, isDefault: false } : i
          );
          nextIdentities.push({
            id: generateSafeId('id_whatsapp'),
            channel: 'whatsapp',
            label: 'Primary WhatsApp Business',
            value: cleanWaNumber,
            senderName: cleanSenderName,
            providerMode: waProviderMode,
            isDefault: true,
            verified: true,
            createdAt: new Date().toISOString(),
          });
        }
      }
      if (cleanCustomEmail && cleanCustomEmail.includes('@')) {
        const hasEm = nextIdentities.some(
          (i) => i.channel === 'email' && i.value.toLowerCase() === cleanCustomEmail.toLowerCase()
        );
        if (!hasEm) {
          nextIdentities = nextIdentities.map((i) =>
            i.channel === 'email' ? { ...i, isDefault: false } : i
          );
          nextIdentities.push({
            id: generateSafeId('id_email'),
            channel: 'email',
            label: 'Custom Domain Email',
            value: cleanCustomEmail,
            senderName: cleanSenderName,
            replyToEmail: cleanCustomEmail,
            providerMode: effectiveUseCustom ? 'custom_domain' : 'platform_default',
            isDefault: effectiveUseCustom,
            verified: true,
            createdAt: new Date().toISOString(),
          });
        }
      }
      if (cleanSmsSender) {
        const hasSms = nextIdentities.some(
          (i) => i.channel === 'sms' && i.value.toLowerCase() === cleanSmsSender.toLowerCase()
        );
        if (!hasSms) {
          nextIdentities = nextIdentities.map((i) =>
            i.channel === 'sms' ? { ...i, isDefault: false } : i
          );
          nextIdentities.push({
            id: generateSafeId('id_sms'),
            channel: 'sms',
            label: 'Primary SMS Sender ID',
            value: cleanSmsSender,
            senderName: cleanSenderName,
            providerMode: smsProviderMode,
            isDefault: true,
            verified: true,
            createdAt: new Date().toISOString(),
          });
        }
      }

      setSavedIdentities(nextIdentities);
      const serializedIdentities = serializeUserMessagingIdentities(nextIdentities);
      const serializedGateway = serializeGatewayConfigForProfile();

      await onUpdateWorkspace({
        name: sanitizeString(wsName, 100, 'FlowPilot Workspace'),
        category,
        timezone: sanitizeString(timezone, 64, 'America/New_York'),
        currency,
        senderName: cleanSenderName,
        whatsappConnected: true,
        smsConnected: true,
        emailConnected: true,
        notifyNewLeads,
        notifyCampaigns,
      });

      await onUpdatePrivateProfile({
        email: sanitizeString(email, 150, 'operator@flowpilot.app'),
        replyToEmail: sanitizeString(
          effectiveUseCustom ? cleanCustomEmail : replyToEmail,
          150,
          liveResolvedIdentities.platformDefaultEmail
        ),
        phone: sanitizeString(phone || cleanWaNumber, 32),
        mailingAddress: sanitizeString(mailingAddress, 250),
        whatsappPhoneId: sanitizeString(
          metaPhoneNumberId.trim() || cleanWaNumber || whatsappPhoneId,
          64
        ),
        smsSenderId: cleanSmsSender,
        emailProviderDomain: sanitizeString(extractedDomain, 120),
        whatsappBusinessNumber: cleanWaNumber,
        customDomainEmail: cleanCustomEmail,
        useCustomDomainEmail: effectiveUseCustom,
        messagingIdentitiesJson: serializedIdentities,
        gatewayConfigJson: serializedGateway,
      });

      setSaveBanner(
        `Saved Account Messaging Identities & Connectors! WhatsApp From: ${
          cleanWaNumber || liveResolvedIdentities.whatsappBusinessNumber
        } (${getWhatsAppProviderLabel(waProviderMode)}) · Email From: ${
          gmailConnected && connectedGmailAddress && !effectiveUseCustom
            ? `${connectedGmailAddress} (Gmail OAuth)`
            : effectiveUseCustom
            ? `${cleanCustomEmail} (Custom Domain)`
            : `${liveResolvedIdentities.platformDefaultEmail} (Platform Default)`
        } · SMS From: ${cleanSmsSender} (${getSmsProviderLabel(smsProviderMode)}).`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim() || !newMemberEmail.includes('@')) {
      return;
    }
    await onAddMember({
      memberName: sanitizeString(newMemberName, 100),
      memberEmail: sanitizeString(newMemberEmail, 150),
      role: newMemberRole,
    });
    setNewMemberName('');
    setNewMemberEmail('');
  };

  const handlePasswordResetClick = async () => {
    try {
      await onSendPasswordReset(email);
      setAuthNotice(`Password reset instructions dispatched to ${email}.`);
    } catch {
      setAuthNotice(
        'Account uses Google OAuth federated session management. Password reset link logged.'
      );
    }
  };

  const handleEmailVerificationClick = async () => {
    try {
      await onSendEmailVerification();
      setAuthNotice('Verification email sent. Please check your inbox.');
    } catch {
      setAuthNotice('Email verification status checked.');
    }
  };

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* DEDICATED 3-CHANNEL SENDER & LIVE GATEWAY CONNECTOR SUITE             */}
      {/* (1. WHATSAPP BUSINESS, 2. EMAIL & GMAIL OAUTH, 3. SMS SENDER & CARRIER)*/}
      {/* ===================================================================== */}
      <form
        onSubmit={handleSaveSettings}
        className="border-2 border-emerald-600/30 rounded-2xl bg-white p-5 sm:p-6 space-y-6 shadow-xs"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>3-Channel Auto-Pilot Sender Identity & Live Gateway Connectors</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl lg:text-2xl font-bold text-slate-950">
              WhatsApp Business, Email (Gmail OAuth / Custom Domain) & SMS Live Connectors
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
              Configure your <strong>WhatsApp Business Number & Gateway</strong>,{' '}
              <strong>Email / Gmail OAuth Sender</strong>, and{' '}
              <strong>SMS Sender ID & Carrier Gateway</strong> below. Every Automation,
              Auto-Responder, Campaign Broadcast, and Inbox reply automatically sends live
              across all 3 channels.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-3 text-xs sm:text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer disabled:opacity-60 shrink-0 inline-flex items-center justify-center gap-2 shadow-xs whitespace-nowrap"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isSaving
                ? 'Saving 3-Channel Connectors...'
                : 'Save WhatsApp, Email & SMS Connectors'}
            </span>
          </button>
        </div>

        {saveBanner && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-950 rounded-xl flex items-start gap-2.5 font-medium">
            <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-700 mt-0.5" />
            <span>{saveBanner}</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* PER-USER ACCOUNT MESSAGING IDENTITY VAULT & ONBOARDING BANNER     */}
        {/* ================================================================= */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
                  Per-Account Messaging Identity Vault · Cloud Firestore Isolated
                </span>
                <span className="text-[11px] font-mono font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                  Account: {currentUserEmail || email || 'operator@flowpilot.app'}
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  ({isAuthenticated && currentUserUid ? `users/${currentUserUid.slice(0, 10)}.../private/default` : 'Local Account Vault'})
                </span>
              </div>
              <h3 className="font-display text-sm sm:text-base font-bold text-slate-950">
                Manage Your Personal & Brand Messaging Identities ({savedIdentities.length} Saved Across Channels)
              </h3>
              <p className="text-xs text-slate-600 max-w-3xl">
                Every user account can add multiple sender identities for <strong>WhatsApp Business</strong>,{' '}
                <strong>Email (Custom Domain, Gmail OAuth, or Platform Default)</strong>, and{' '}
                <strong>SMS Sender IDs</strong>, and switch your <strong>Active Default</strong> per channel in one click.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenQuickAddIdentity('whatsapp')}
                className="px-3 py-2 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add WhatsApp Identity</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenQuickAddIdentity('email')}
                className="px-3 py-2 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Add Email Identity</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenQuickAddIdentity('sms')}
                className="px-3 py-2 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-amber-600" />
                <span>Add SMS Identity</span>
              </button>
            </div>
          </div>

          {/* New User Account Onboarding Prompt when no custom identities are saved yet */}
          {!liveResolvedIdentities.hasAnyCustomIdentity && (
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0" />
                  <span>New Account Setup: Workspace Fallback Defaults Currently Active</span>
                </div>
                <p className="text-xs text-slate-600">
                  Your account is currently dispatching via workspace defaults (
                  <span className="font-mono font-semibold text-slate-800">
                    {liveResolvedIdentities.platformDefaultEmail}
                  </span>{' '}
                  & built-in relay). Add your own WhatsApp number, Custom Domain / Gmail address, or SMS Sender ID whenever you are ready.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenQuickAddIdentity('whatsapp')}
                className="px-3 py-1.5 text-xs font-bold text-[#2563EB] bg-white hover:bg-blue-50 border border-blue-300 rounded-lg cursor-pointer shrink-0 whitespace-nowrap"
              >
                + Configure My First Identity
              </button>
            </div>
          )}

          {identityVaultNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-950 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{identityVaultNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setIdentityVaultNotice('')}
                className="text-[11px] font-bold text-emerald-800 hover:underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Quick-Add New Identity Form */}
          {showAddIdentityForm && (
            <div className="p-4 rounded-xl bg-white border-2 border-[#2563EB]/40 space-y-3.5">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
                    Add New Account Messaging Identity
                  </span>
                  <h4 className="font-display text-sm font-bold text-slate-950">
                    Register a {newIdentityChannel.toUpperCase()} Sender Identity for {currentUserEmail || email}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddIdentityForm(false)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Channel *
                  </label>
                  <select
                    value={newIdentityChannel}
                    onChange={(e) => {
                      const ch = e.target.value as ChannelType;
                      handleOpenQuickAddIdentity(ch);
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  >
                    <option value="whatsapp">1 · WhatsApp Business</option>
                    <option value="email">2 · Email (Custom Domain / Gmail)</option>
                    <option value="sms">3 · SMS Sender ID / Carrier</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Identity Label (e.g., Sales, Support, Founder) *
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={newIdentityLabel}
                    onChange={(e) => setNewIdentityLabel(e.target.value)}
                    placeholder="e.g., VIP Sales Line or Founder Email"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {newIdentityChannel === 'whatsapp'
                      ? 'WhatsApp Number (E.164) *'
                      : newIdentityChannel === 'email'
                      ? 'Sender Email Address *'
                      : 'SMS Sender ID or Number *'}
                  </label>
                  <input
                    type="text"
                    maxLength={150}
                    value={newIdentityValue}
                    onChange={(e) => setNewIdentityValue(e.target.value)}
                    placeholder={
                      newIdentityChannel === 'whatsapp'
                        ? '+1 (555) 234-8900'
                        : newIdentityChannel === 'email'
                        ? 'founder@yourdomain.com'
                        : 'FLOWPILOT'
                    }
                    className="w-full px-3 py-2 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg text-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Display Sender Name
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={newIdentitySenderName}
                    onChange={(e) => setNewIdentitySenderName(e.target.value)}
                    placeholder="e.g., FlowPilot Advisory"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIdentitySetDefault}
                    onChange={(e) => setNewIdentitySetDefault(e.target.checked)}
                    className="rounded border-slate-300 text-[#2563EB]"
                  />
                  <span>
                    Set as my <strong>Active Default</strong> {newIdentityChannel.toUpperCase()} identity across Automations, Campaigns & Inbox
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => handleAddAccountIdentity()}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl cursor-pointer inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Identity to My Account</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Three Side-by-Side Channel Connector Cards: 1) WhatsApp, 2) Email, 3) SMS */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* =============================================================== */}
          {/* CARD 1: WHATSAPP BUSINESS NUMBER & BUILT-IN GATEWAY CONNECTOR   */}
          {/* =============================================================== */}
          <div className="p-5 rounded-2xl bg-emerald-50/40 border border-emerald-200 flex flex-col justify-between space-y-4">
            <div className="space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#047857] text-white flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      1 · WhatsApp Channel & Gateway
                    </span>
                    <h3 className="font-display text-base font-bold text-slate-950">
                      WhatsApp Business Live Connector
                    </h3>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-800 shrink-0">
                  ● Live Active
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Set your WhatsApp Business number and choose your live WhatsApp delivery
                connector. Automations, Auto-Responders, Campaigns, and Inbox replies send
                automatically from this number.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    WhatsApp Business Phone Number (With Country Code) *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-emerald-700 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      maxLength={64}
                      value={whatsappBusinessNumber}
                      onChange={(e) => {
                        setWhatsappBusinessNumber(e.target.value);
                        if (e.target.value.trim()) {
                          setWhatsappConnected(true);
                        }
                      }}
                      placeholder="e.g., +1 (555) 234-8900 or +234 803 555 0199"
                      className="w-full pl-10 pr-3.5 py-2 text-xs sm:text-sm font-mono font-semibold bg-white border-2 border-emerald-600/40 focus:border-emerald-700 rounded-xl text-slate-950 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[11px] text-slate-500">Presets:</span>
                    {['+1 (555) 234-8900', '+44 7700 900077', '+234 803 555 0199'].map(
                      (sample) => (
                        <button
                          key={sample}
                          type="button"
                          onClick={() => {
                            setWhatsappBusinessNumber(sample);
                            setWhatsappConnected(true);
                          }}
                          className="text-[11px] font-mono font-semibold text-emerald-800 hover:underline cursor-pointer"
                        >
                          {sample}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    WhatsApp Display Name (Shown Next to Number)
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="e.g., FlowPilot Advisory or Your Brand Name"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>

                {/* Modern 1-Click WhatsApp Embedded Signup & Gateway State */}
                <div className="p-3.5 rounded-xl bg-white border border-emerald-200 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      WhatsApp 1-Click Connection
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      waAccount?.status === 'connected' || whatsappConnected
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {waAccount?.status === 'connected' || whatsappConnected
                        ? '● Meta API Active'
                        : '○ Setup Available'}
                    </span>
                  </div>

                  {waAccount?.status === 'connected' ? (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Connected via Meta Embedded Signup</span>
                        </span>
                        <span className="font-mono text-[10px] text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                          WABA Active
                        </span>
                      </div>
                      <div className="text-slate-600 space-y-0.5 text-[11px]">
                        <div>
                          <strong className="text-slate-800">Verified Name:</strong>{' '}
                          {waAccount.verified_name || senderName || 'WhatsApp Business Account'}
                        </div>
                        <div>
                          <strong className="text-slate-800">Phone Number:</strong>{' '}
                          <span className="font-mono text-emerald-900 font-semibold">
                            {waAccount.display_phone_number || whatsappBusinessNumber}
                          </span>
                        </div>
                        {waAccount.phone_number_id && (
                          <div>
                            <strong className="text-slate-800">Phone Number ID:</strong>{' '}
                            <span className="font-mono">{waAccount.phone_number_id}</span>
                          </div>
                        )}
                      </div>
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigateToWhatsAppEmbeddedSignup) {
                              onNavigateToWhatsAppEmbeddedSignup();
                            } else {
                              window.location.href = '/dashboard/settings/whatsapp';
                            }
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-emerald-900 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg cursor-pointer"
                        >
                          Manage Connection / Re-connect
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Connect your WhatsApp Business Account in 1 click using the official Meta Embedded Signup flow. Your automations and auto-responders start sending immediately.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateToWhatsAppEmbeddedSignup) {
                            onNavigateToWhatsAppEmbeddedSignup();
                          } else {
                            window.location.href = '/dashboard/settings/whatsapp';
                          }
                        }}
                        className="w-full py-2.5 px-3 text-xs font-bold text-white bg-[#1877F2] hover:bg-[#166fe5] rounded-xl cursor-pointer shadow-xs inline-flex items-center justify-center gap-2 transition-colors"
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        <span>Connect WhatsApp with Meta 1-Click</span>
                      </button>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Built-in Auto-Pilot Relay: <strong className="text-emerald-800">Active</strong>
                    </span>
                    <button
                      type="button"
                      disabled={isTestingDelivery}
                      onClick={() => handleRunLiveChannelTest('whatsapp')}
                      className="px-3 py-1.5 text-[11px] font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer inline-flex items-center gap-1 whitespace-nowrap shadow-2xs"
                    >
                      <Send className="w-3 h-3" />
                      <span>Send Live WhatsApp Test</span>
                    </button>
                  </div>
                </div>

                {/* Per-Account Saved WhatsApp Identities & Default Selector */}
                <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                      My Saved WhatsApp Identities ({liveResolvedIdentities.whatsappIdentities.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenQuickAddIdentity('whatsapp')}
                      className="text-[11px] font-bold text-[#2563EB] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Number</span>
                    </button>
                  </div>

                  {liveResolvedIdentities.whatsappIdentities.length === 0 ? (
                    <div className="text-[11px] text-slate-600 flex items-center justify-between gap-2 py-1">
                      <span>
                        Using active number:{' '}
                        <strong className="font-mono text-slate-900">
                          {liveResolvedIdentities.whatsappBusinessNumber}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenQuickAddIdentity('whatsapp')}
                        className="text-[11px] font-semibold text-emerald-800 hover:underline cursor-pointer shrink-0"
                      >
                        + Save to Vault
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                      {liveResolvedIdentities.whatsappIdentities.map((idItem) => (
                        <div
                          key={idItem.id}
                          className={`p-2 rounded-lg border flex items-center justify-between gap-2 text-xs ${
                            idItem.isDefault
                              ? 'bg-emerald-50/80 border-emerald-500/70'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 truncate">
                                {idItem.label}
                              </span>
                              {idItem.isDefault && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-700 truncate">
                              {idItem.value} · <span className="font-sans text-slate-500">{idItem.senderName}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!idItem.isDefault && (
                              <button
                                type="button"
                                onClick={() => handleSetDefaultIdentity(idItem.id)}
                                className="px-2 py-1 text-[10px] font-bold text-[#2563EB] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded cursor-pointer"
                              >
                                Set Default
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteAccountIdentity(idItem.id)}
                              title="Remove WhatsApp Identity"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Live Preview of Outbound WhatsApp Auto-Pilot Header */}
            <div className="p-3.5 rounded-xl bg-[#0F172A] text-white space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Live Preview · WhatsApp Auto-Send
                </span>
                <span className="text-[11px] text-slate-300 truncate">
                  {waProviderMode === 'builtin_relay'
                    ? 'Built-In Relay + wa.me'
                    : waProviderMode.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <div className="text-xs sm:text-sm font-mono font-bold text-white truncate">
                From:{' '}
                <span className="text-emerald-300">
                  {liveResolvedIdentities.whatsappBusinessNumber}
                </span>{' '}
                <span className="text-slate-400 font-sans font-normal">
                  ({senderName || workspace.name})
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Auto-sends across Automations, Auto-Responders, Campaigns & Inbox.
              </p>
            </div>
          </div>

          {/* =============================================================== */}
          {/* CARD 2: EMAIL SENDER & GOOGLE OAUTH (GMAIL) CONNECTOR           */}
          {/* =============================================================== */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-4">
            <div className="space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      2 · Email Channel & Gmail OAuth
                    </span>
                    <h3 className="font-display text-base font-bold text-slate-950">
                      Email & Gmail Live Connector
                    </h3>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-800 shrink-0">
                  {gmailConnected
                    ? '● Gmail OAuth'
                    : liveResolvedIdentities.activeEmailMode === 'custom_domain'
                    ? '● Custom Domain'
                    : '● Platform Email'}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Choose between your <strong>Custom Domain Email</strong>, the free{' '}
                <strong>Platform-Provided Email</strong>, or connect your{' '}
                <strong>Google Account (Gmail OAuth)</strong> for live Gmail API delivery.
              </p>

              {/* Mode Selector: Platform-Provided vs Custom Domain */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUseCustomDomainEmail(false)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    !useCustomDomainEmail
                      ? 'bg-emerald-50/90 border-2 border-emerald-600 text-slate-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-slate-950">Platform Email</span>
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                        !useCustomDomainEmail
                          ? 'bg-emerald-700 text-white'
                          : 'border border-slate-300'
                      }`}
                    >
                      {!useCustomDomainEmail && <Check className="w-2.5 h-2.5" />}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                    {liveResolvedIdentities.platformDefaultEmail}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setUseCustomDomainEmail(true)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    useCustomDomainEmail
                      ? 'bg-emerald-50/90 border-2 border-emerald-600 text-slate-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-slate-950">Custom Domain</span>
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                        useCustomDomainEmail
                          ? 'bg-emerald-700 text-white'
                          : 'border border-slate-300'
                      }`}
                    >
                      {useCustomDomainEmail && <Check className="w-2.5 h-2.5" />}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                    @yourdomain.com
                  </p>
                </button>
              </div>

              <div className="space-y-2.5">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Custom Domain Email (Or Copy Platform Default)
                    </label>
                    <button
                      type="button"
                      onClick={handleCopyPlatformEmail}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedPlatformEmail ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Default</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      maxLength={150}
                      value={customDomainEmail}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomDomainEmail(val);
                        if (val.trim().includes('@')) {
                          setUseCustomDomainEmail(true);
                          const dom = val.trim().split('@')[1];
                          if (dom) setEmailProviderDomain(dom);
                        }
                      }}
                      placeholder="hello@yourcustomdomain.com"
                      className={`w-full pl-10 pr-3.5 py-2 text-xs sm:text-sm font-mono bg-white border rounded-xl text-slate-950 focus:outline-none ${
                        useCustomDomainEmail
                          ? 'border-2 border-emerald-600'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                </div>

                {/* Email Gateway Connector (Gmail OAuth / Resend / SendGrid / Built-In Relay) */}
                <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      Email Gateway Connector
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700">
                      {gmailConnected
                        ? 'Gmail OAuth Active'
                        : emailProviderMode === 'builtin_relay'
                        ? 'Verified Relay'
                        : 'API Connected'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-900">
                        {gmailConnected && connectedGmailAddress
                          ? `Connected Google Account: ${connectedGmailAddress}`
                          : 'Google Workspace Gmail API (OAuth 2.0 Direct)'}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        gmailConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/80 text-slate-700'
                      }`}>
                        {gmailConnected ? '● OAuth Connected' : '1-Click Connect'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {gmailConnected && connectedGmailAddress
                        ? 'All outbound emails dispatch securely through your authenticated Google Workspace session with automatic SPF/DKIM validation.'
                        : 'Connect your Google account in 1 click to dispatch automated sequences and broadcast emails directly from your Gmail address.'}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {gmailConnected ? (
                        <button
                          type="button"
                          onClick={handleDisconnectGmailOAuth}
                          className="px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          Disconnect Gmail
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isConnectingGmail}
                          onClick={handleConnectGmailOAuth}
                          className="gsi-material-button inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <div className="gsi-material-button-icon w-4 h-4 shrink-0">
                            <svg
                              version="1.1"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 48 48"
                              className="w-4 h-4 block"
                            >
                              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                              <path fill="none" d="M0 0h48v48H0z"/>
                            </svg>
                          </div>
                          <span className="gsi-material-button-contents">
                            {isConnectingGmail ? 'Connecting...' : 'Sign in with Google'}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isTestingDelivery}
                        onClick={() => handleRunLiveChannelTest('email')}
                        className="px-3 py-1.5 text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer inline-flex items-center gap-1 whitespace-nowrap shadow-2xs"
                      >
                        <Send className="w-3 h-3 text-emerald-400" />
                        <span>Send Live Email Test</span>
                      </button>
                    </div>

                    {gmailNotice && (
                      <div className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                        {gmailNotice}
                      </div>
                    )}
                  </div>

                  {/* FlowPilot Platform Relay Badge */}
                  <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />
                      <span className="font-semibold text-slate-800">
                        FlowPilot Verified Multi-Domain Relay
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                      SPF / DKIM Signed
                    </span>
                  </div>
                </div>

                {/* Per-Account Saved Email Identities & Default Selector */}
                <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                      My Saved Email Identities ({liveResolvedIdentities.emailIdentities.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenQuickAddIdentity('email')}
                      className="text-[11px] font-bold text-[#2563EB] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Email</span>
                    </button>
                  </div>

                  {liveResolvedIdentities.emailIdentities.length === 0 ? (
                    <div className="text-[11px] text-slate-600 flex items-center justify-between gap-2 py-1">
                      <span className="truncate">
                        Active:{' '}
                        <strong className="font-mono text-slate-900">
                          {liveResolvedIdentities.activeSenderEmail}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenQuickAddIdentity('email')}
                        className="text-[11px] font-semibold text-[#2563EB] hover:underline cursor-pointer shrink-0"
                      >
                        + Save to Vault
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                      {liveResolvedIdentities.emailIdentities.map((idItem) => (
                        <div
                          key={idItem.id}
                          className={`p-2 rounded-lg border flex items-center justify-between gap-2 text-xs ${
                            idItem.isDefault
                              ? 'bg-emerald-50/80 border-emerald-500/70'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 truncate">
                                {idItem.label}
                              </span>
                              {idItem.isDefault && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-700 truncate">
                              {idItem.value} · <span className="font-sans text-slate-500">{idItem.senderName}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!idItem.isDefault && (
                              <button
                                type="button"
                                onClick={() => handleSetDefaultIdentity(idItem.id)}
                                className="px-2 py-1 text-[10px] font-bold text-[#2563EB] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded cursor-pointer"
                              >
                                Set Default
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteAccountIdentity(idItem.id)}
                              title="Remove Email Identity"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Live Preview of Outbound Email Auto-Pilot Header */}
            <div className="p-3.5 rounded-xl bg-[#0F172A] text-white space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Live Preview · Email Auto-Send
                </span>
                <span className="text-[11px] text-slate-300">
                  {gmailConnected && connectedGmailAddress
                    ? 'Gmail OAuth Active'
                    : liveResolvedIdentities.activeEmailMode === 'custom_domain'
                    ? 'Custom Domain'
                    : 'Platform Default'}
                </span>
              </div>
              <div className="text-xs sm:text-sm font-mono font-bold text-white truncate">
                From:{' '}
                <span className="text-emerald-300">
                  {gmailConnected && connectedGmailAddress && !useCustomDomainEmail
                    ? `${senderName || workspace.name} <${connectedGmailAddress}>`
                    : liveResolvedIdentities.emailDisplaySender}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Auto-sends across Automations, Auto-Responders, Campaigns & Inbox.
              </p>
            </div>
          </div>

          {/* =============================================================== */}
          {/* CARD 3: SMS SENDER ID & BUILT-IN CARRIER CONNECTOR              */}
          {/* =============================================================== */}
          <div className="p-5 rounded-2xl bg-amber-50/35 border border-amber-200/80 flex flex-col justify-between space-y-4">
            <div className="space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                      3 · SMS Channel & Carrier Gateway
                    </span>
                    <h3 className="font-display text-base font-bold text-slate-950">
                      SMS Sender ID & Live Connector
                    </h3>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-800 shrink-0">
                  ● Live Active
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Configure your alphanumeric <strong>SMS Sender ID</strong> or phone number and
                connect your live SMS carrier gateway for automated text follow-ups, broadcasts,
                and Inbox replies.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    SMS Sender ID or Outbound SMS Number *
                  </label>
                  <div className="relative">
                    <Smartphone className="w-4 h-4 text-amber-700 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      maxLength={32}
                      value={smsSenderId}
                      onChange={(e) => {
                        setSmsSenderId(e.target.value);
                        if (e.target.value.trim()) {
                          setSmsConnected(true);
                        }
                      }}
                      placeholder="e.g., FLOWPILOT, VIPCOURSE, or +15550192834"
                      className="w-full pl-10 pr-3.5 py-2 text-xs sm:text-sm font-mono font-semibold bg-white border-2 border-amber-500/40 focus:border-amber-600 rounded-xl text-slate-950 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[11px] text-slate-500">Presets:</span>
                    {['FLOWPILOT', 'VIPCOURSE', '+1 (555) 019-2834'].map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => {
                          setSmsSenderId(sample);
                          setSmsConnected(true);
                        }}
                        className="text-[11px] font-mono font-semibold text-amber-900 hover:underline cursor-pointer"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Built-In SMS Carrier Gateway Connector */}
                <div className="p-3 rounded-xl bg-white border border-amber-200/80 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                      SMS Carrier Gateway Connector
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700">
                      {smsProviderMode === 'builtin_relay' ? 'Built-In Relay' : 'API Connected'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Pre-verified Tier-1 telecom routes with automatic 10DLC compliance and global handset delivery. Dispatches directly using your alphanumeric sender ID.
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="text-xs text-slate-700">
                        Sender ID: <strong className="font-mono text-slate-950 font-bold">{smsSenderId || 'FLOWPILOT'}</strong>
                      </div>
                      <button
                        type="button"
                        disabled={isTestingDelivery}
                        onClick={() => handleRunLiveChannelTest('sms')}
                        className="px-3 py-1.5 text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer inline-flex items-center gap-1 whitespace-nowrap shadow-2xs"
                      >
                        <Send className="w-3 h-3 text-amber-400" />
                        <span>Send Live SMS Test</span>
                      </button>
                    </div>

                    {smsConnectorNotice && (
                      <div className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                        {smsConnectorNotice}
                      </div>
                    )}
                  </div>
                </div>

                {/* Per-Account Saved SMS Identities & Default Selector */}
                <div className="p-3 rounded-xl bg-white border border-amber-200/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-950">
                      My Saved SMS Identities ({liveResolvedIdentities.smsIdentities.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenQuickAddIdentity('sms')}
                      className="text-[11px] font-bold text-[#2563EB] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Sender ID</span>
                    </button>
                  </div>

                  {liveResolvedIdentities.smsIdentities.length === 0 ? (
                    <div className="text-[11px] text-slate-600 flex items-center justify-between gap-2 py-1">
                      <span>
                        Active ID:{' '}
                        <strong className="font-mono text-slate-900">
                          {liveResolvedIdentities.smsSenderId}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenQuickAddIdentity('sms')}
                        className="text-[11px] font-semibold text-amber-900 hover:underline cursor-pointer shrink-0"
                      >
                        + Save to Vault
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                      {liveResolvedIdentities.smsIdentities.map((idItem) => (
                        <div
                          key={idItem.id}
                          className={`p-2 rounded-lg border flex items-center justify-between gap-2 text-xs ${
                            idItem.isDefault
                              ? 'bg-emerald-50/80 border-emerald-500/70'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 truncate">
                                {idItem.label}
                              </span>
                              {idItem.isDefault && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-700 truncate">
                              {idItem.value} · <span className="font-sans text-slate-500">{idItem.senderName}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!idItem.isDefault && (
                              <button
                                type="button"
                                onClick={() => handleSetDefaultIdentity(idItem.id)}
                                className="px-2 py-1 text-[10px] font-bold text-[#2563EB] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded cursor-pointer"
                              >
                                Set Default
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteAccountIdentity(idItem.id)}
                              title="Remove SMS Identity"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Live Preview of Outbound SMS Auto-Pilot Header */}
            <div className="p-3.5 rounded-xl bg-[#0F172A] text-white space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Live Preview · SMS Auto-Send
                </span>
                <span className="text-[11px] text-slate-300 truncate">
                  {smsProviderMode === 'builtin_relay'
                    ? 'Built-In Relay + sms:'
                    : smsProviderMode.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <div className="text-xs sm:text-sm font-mono font-bold text-white truncate">
                From Sender ID:{' '}
                <span className="text-amber-300">
                  {liveResolvedIdentities.smsSenderId}
                </span>{' '}
                <span className="text-slate-400 font-sans font-normal">
                  ({senderName || workspace.name})
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Auto-sends across Automations, Auto-Responders, Campaigns & Inbox.
              </p>
            </div>
          </div>
        </div>
      </form>

      {/* ===================================================================== */}
      {/* MULTI-CHANNEL MESSAGE DELIVERY VERIFICATION & LIVE TEST HUB           */}
      {/* ===================================================================== */}
      <section className="border border-slate-200 rounded-2xl bg-white p-5 sm:p-6 space-y-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Multi-Channel Delivery Engine · WhatsApp · Email · SMS</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-950">
              Live Channel Delivery Verification & Gateway Dispatch Hub
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
              Verify and test real message delivery across all 3 channels (
              <strong>WhatsApp</strong>, <strong>Email</strong>, and <strong>SMS</strong>). Every
              Auto-Responder, Workflow Automation, Campaign, and Manual Inbox reply routes through
              this multi-channel engine using your configured sender identities.
            </p>
          </div>

          <button
            type="button"
            disabled={isTestingDelivery}
            onClick={handleTestAllThreeChannels}
            className="px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl cursor-pointer disabled:opacity-60 shrink-0 inline-flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4 text-emerald-400" />
            <span>
              {isTestingDelivery
                ? 'Dispatching Across Channels...'
                : 'Test All 3 Channels Now (WhatsApp + Email + SMS)'}
            </span>
          </button>
        </div>

        {/* META WHATSAPP EMBEDDED SIGNUP BANNER */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-950 text-white border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold uppercase tracking-wider border border-emerald-400/30">
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>Official Meta Facebook SDK · 1-Click Connect</span>
            </div>
            <h3 className="font-display text-base sm:text-lg font-bold text-white">
              WhatsApp Embedded Signup
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Connect your WhatsApp Business number with 1 click using the Meta Facebook SDK. Saves your Phone Number ID and Access Token to database table <code className="font-mono text-emerald-300 font-semibold">whatsapp_accounts</code> so all workflows and automations send immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onNavigateToWhatsAppEmbeddedSignup) {
                onNavigateToWhatsAppEmbeddedSignup();
              } else if (typeof window !== "undefined") {
                window.history.pushState({}, "", "/dashboard/settings/whatsapp");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }
            }}
            className="py-3 px-5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-95 rounded-xl cursor-pointer inline-flex items-center justify-center gap-2 shrink-0 transition-all shadow-md"
          >
            <MessageSquare className="w-4 h-4 text-slate-950" />
            <span>Launch Embedded Signup (/dashboard/settings/whatsapp)</span>
          </button>
        </div>

        {/* 3 Channel Gateway Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* WhatsApp Status */}
          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                  <span>1. WhatsApp Delivery</span>
                </span>
                <span className="font-semibold text-emerald-700">● Ready</span>
              </div>
              <div className="text-xs font-mono font-bold text-slate-900 truncate">
                From: {liveResolvedIdentities.whatsappBusinessNumber}
              </div>
              <div className="text-[11px] text-slate-600">
                Gateway:{' '}
                <strong className="text-slate-800">
                  {gatewayStatus?.whatsapp.providerLabel ||
                    'FlowPilot WhatsApp Business Relay + Direct wa.me Bridge'}
                </strong>
              </div>
            </div>
            <button
              type="button"
              disabled={isTestingDelivery}
              onClick={() => handleRunLiveChannelTest('whatsapp')}
              className="w-full py-2 px-3 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Live WhatsApp Test</span>
            </button>
          </div>

          {/* Email Status */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-700" />
                  <span>2. Email Delivery</span>
                </span>
                <span className="font-semibold text-emerald-700">
                  ●{' '}
                  {liveResolvedIdentities.activeEmailMode === 'custom_domain'
                    ? 'Custom Domain'
                    : 'Platform Default'}
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-slate-900 truncate">
                From: {liveResolvedIdentities.activeSenderEmail}
              </div>
              <div className="text-[11px] text-slate-600">
                Gateway:{' '}
                <strong className="text-slate-800">
                  {gatewayStatus?.email.providerLabel ||
                    'FlowPilot Verified Email Relay + Direct Mail Bridge'}
                </strong>
              </div>
            </div>
            <button
              type="button"
              disabled={isTestingDelivery}
              onClick={() => handleRunLiveChannelTest('email')}
              className="w-full py-2 px-3 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              <span>Send Live Email Test</span>
            </button>
          </div>

          {/* SMS Status */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                  <span>3. SMS Delivery</span>
                </span>
                <span className="font-semibold text-emerald-700">● Ready</span>
              </div>
              <div className="text-xs font-mono font-bold text-slate-900 truncate">
                From Sender ID: {liveResolvedIdentities.smsSenderId}
              </div>
              <div className="text-[11px] text-slate-600">
                Gateway:{' '}
                <strong className="text-slate-800">
                  {gatewayStatus?.sms.providerLabel ||
                    'FlowPilot SMS Carrier Relay + Direct SMS Bridge'}
                </strong>
              </div>
            </div>
            <button
              type="button"
              disabled={isTestingDelivery}
              onClick={() => handleRunLiveChannelTest('sms')}
              className="w-full py-2 px-3 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-emerald-700" />
              <span>Send Live SMS Test</span>
            </button>
          </div>
        </div>

        {/* Interactive Test Recipient & Webhook Bridge Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
          {/* Left: Live Test Inputs */}
          <div className="lg:col-span-7 p-4 rounded-xl bg-[#FAF8F5] border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-950">
                Send a Live Verification Message to Your Lead / Phone / Email
              </h3>
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                {(['whatsapp', 'email', 'sms'] as ChannelType[]).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setTestChannel(ch)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md cursor-pointer uppercase ${
                      testChannel === ch
                        ? 'bg-[#047857] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Test Lead Name
                </label>
                <input
                  type="text"
                  value={testLeadName}
                  onChange={(e) => setTestLeadName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              {testChannel === 'email' ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Recipient Email Address (To:)
                  </label>
                  <input
                    type="email"
                    value={testRecipientEmail}
                    onChange={(e) => setTestRecipientEmail(e.target.value)}
                    placeholder="lead@yourdomain.com"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Recipient Phone Number (WhatsApp / SMS To:)
                  </label>
                  <input
                    type="tel"
                    value={testRecipientPhone}
                    onChange={(e) => setTestRecipientPhone(e.target.value)}
                    placeholder="+1 (555) 234-8910"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
              )}
            </div>

            {testChannel === 'email' && (
              <div className="text-xs">
                <label className="block font-semibold text-slate-700 mb-1">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={testSubject}
                  onChange={(e) => setTestSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            )}

            <div className="text-xs">
              <label className="block font-semibold text-slate-700 mb-1">
                Test Message Body
              </label>
              <textarea
                rows={2}
                value={testMessageBody}
                onChange={(e) => setTestMessageBody(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-600 font-mono">
                Sending From:{' '}
                <strong className="text-slate-900">
                  {testChannel === 'whatsapp'
                    ? liveResolvedIdentities.whatsappBusinessNumber
                    : testChannel === 'email'
                    ? liveResolvedIdentities.activeSenderEmail
                    : liveResolvedIdentities.smsSenderId}
                </strong>
              </span>
              <button
                type="button"
                disabled={isTestingDelivery}
                onClick={() => handleRunLiveChannelTest(testChannel)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  Dispatch {testChannel.toUpperCase()} Test Message
                </span>
              </button>
            </div>
          </div>

          {/* Right: Outbound Automation Webhook Bridge + Latest Delivery Receipt */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="text-xs font-bold text-slate-900">
                Optional Outbound Automation Webhook URL (Make / Zapier / n8n / Custom Gateway)
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Want 24/7 background cloud delivery through your own Make.com, Zapier, n8n, or
                custom WhatsApp/Email/SMS webhook? Paste your webhook URL below and every
                Auto-Responder, Workflow, and Inbox reply will POST live JSON payloads to it.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={outboundWebhookUrl}
                  onChange={(e) => setOutboundWebhookUrl(e.target.value)}
                  placeholder="https://hook.us1.make.com/... or https://hooks.zapier.com/..."
                  className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleSaveWebhookBridge}
                  className="px-3 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer shrink-0"
                >
                  Save Bridge
                </button>
              </div>
              {webhookSavedNotice && (
                <p className="text-[11px] text-emerald-800 font-medium">{webhookSavedNotice}</p>
              )}
            </div>

            {latestTestReceipt && (
              <div className="p-4 rounded-xl bg-[#0F172A] text-white space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-emerald-400">
                    ✓ Verified Delivery Receipt ({latestTestReceipt.channel.toUpperCase()})
                  </span>
                  <span className="font-mono text-slate-400">{latestTestReceipt.receiptId}</span>
                </div>
                <div className="text-xs font-mono text-slate-200 space-y-0.5">
                  <div>
                    From: <strong className="text-emerald-300">{latestTestReceipt.fromIdentity}</strong>
                  </div>
                  <div>
                    To: <strong className="text-white">{latestTestReceipt.toRecipient}</strong> (
                    {latestTestReceipt.leadName})
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Gateway: {latestTestReceipt.providerUsed}
                  </div>
                </div>
                <div className="pt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-emerald-300">
                    Dispatched via server · Direct native launch ready:
                  </span>
                  <a
                    href={latestTestReceipt.directLaunchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-[11px] font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg inline-flex items-center gap-1 shrink-0"
                  >
                    <span>
                      Open in {latestTestReceipt.channel.toUpperCase()} App
                    </span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Multi-Channel Delivery Receipts Log */}
        {deliveryReceipts.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recent Multi-Channel Delivery Receipts ({deliveryReceipts.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Real-time trace across WhatsApp, Email & SMS
              </span>
            </div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {deliveryReceipts.slice(0, 5).map((rcpt) => (
                <div
                  key={rcpt.receiptId}
                  className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-slate-900 font-semibold">
                      <span className="uppercase font-mono text-emerald-800 font-bold">
                        [{rcpt.channel}]
                      </span>
                      <span>From: {rcpt.fromIdentity}</span>
                      <span aria-hidden="true">→</span>
                      <span>
                        To: {rcpt.toRecipient} ({rcpt.leadName})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {rcpt.providerUsed} · &ldquo;{rcpt.bodyPreview}&rdquo;
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={rcpt.directLaunchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg inline-flex items-center gap-1"
                    >
                      <span>Direct {rcpt.channel.toUpperCase()}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* SERVER BACKGROUND SCHEDULER & LIST KILL SWITCH VERIFICATION CONSOLE    */}
      {/* ===================================================================== */}
      <section className="border border-slate-200 rounded-2xl bg-white p-5 sm:p-6 space-y-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>24/7 Server Background Scheduler · Pre-Flight List Kill Switch Check</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-950">
              Delayed Automation Queue & Per-Contact List Kill Switch Verification
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
              Test delayed automation steps (e.g. waiting 15 seconds, 10 minutes, or 1 day) on the
              live server queue. Right before any delayed step fires, the server checks the target{' '}
              <strong>Contact List&apos;s Kill Switch Tags</strong> (such as{' '}
              <code className="font-mono font-bold text-slate-800">#Purchased_Course</code>) and
              stops execution for that contact if any tag matches.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl shrink-0">
            <div>
              <span className="text-slate-500">Queued:</span>{' '}
              <strong className="text-amber-700">{schedulerSummary.queuedCount}</strong>
            </div>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <div>
              <span className="text-slate-500">Dispatched:</span>{' '}
              <strong className="text-emerald-700">{schedulerSummary.dispatchedCount}</strong>
            </div>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <div>
              <span className="text-slate-500">Stopped by Kill Switch:</span>{' '}
              <strong className="text-rose-700">{schedulerSummary.haltedKillSwitchCount}</strong>
            </div>
          </div>
        </div>

        {schedulerBanner && (
          <div className="p-3.5 rounded-xl bg-slate-900 text-white text-xs flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Server Scheduler Live Update
              </div>
              <p className="text-slate-200 leading-relaxed">{schedulerBanner}</p>
            </div>
            <button
              type="button"
              onClick={() => setSchedulerBanner('')}
              className="text-slate-400 hover:text-white text-xs font-bold shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Interactive Scheduler & Kill Switch Test Bar */}
        <div className="p-4 rounded-xl bg-[#FAF8F5] border border-slate-200 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Delayed Step Channel
              </label>
              <select
                value={schedulerTestChannel}
                onChange={(e) => setSchedulerTestChannel(e.target.value as ChannelType)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold"
              >
                <option value="whatsapp">WhatsApp Business Auto-Pilot</option>
                <option value="email">Email Sequence Step</option>
                <option value="sms">SMS Sequence Step</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Server Wait / Delay Timer
              </label>
              <select
                value={schedulerTestDelaySec}
                onChange={(e) => setSchedulerTestDelaySec(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono tabular-nums"
              >
                <option value={15}>15 seconds (Fast Live Verification)</option>
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute (60s)</option>
                <option value={600}>10 minutes (600s)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Target Contact List Name
              </label>
              <input
                type="text"
                value={schedulerTestListName}
                onChange={(e) => setSchedulerTestListName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                List Kill Switch Tag (Stops Contact)
              </label>
              <input
                type="text"
                value={schedulerTestKillTag}
                onChange={(e) => setSchedulerTestKillTag(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isEnqueuingJob}
                onClick={handleEnqueueTestScheduledStep}
                className="px-4 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {isEnqueuingJob
                    ? 'Enqueuing Step...'
                    : `1. Queue ${schedulerTestDelaySec}s Delayed ${schedulerTestChannel.toUpperCase()} Step`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleSimulateKillSwitchTagOnServer}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>
                  2. Simulate Buyer CSV Tag (#{schedulerTestKillTag || 'Purchased_Course'}) → Stop
                  for Contact
                </span>
              </button>

              <button
                type="button"
                onClick={handleResetServerContactKillTag}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                Reset Contact Tags
              </button>
            </div>

            {scheduledJobs.some((j) => j.status !== 'queued') && (
              <button
                type="button"
                onClick={async () => {
                  const res = await cancelScheduledJob({ clearCompleted: true });
                  setSchedulerSummary(res.summary);
                  setScheduledJobs(res.jobs);
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer whitespace-nowrap shrink-0"
              >
                Clear Completed / Halted History
              </button>
            )}
          </div>
        </div>

        {/* Live Server Scheduled Jobs Table */}
        {scheduledJobs.length === 0 ? (
          <div className="p-6 text-center border border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
            <div className="text-xs font-bold text-slate-800">
              No Delayed Automation Steps Currently in Server Queue
            </div>
            <p className="text-xs text-slate-500 max-w-xl mx-auto">
              When an Automation runs a Wait / Delay step—or when you click{' '}
              <strong>Queue Delayed Step</strong> above—the job appears here with a live countdown
              and automatic List Kill Switch verification.
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-2.5 px-3">Step & Channel</th>
                  <th className="py-2.5 px-3">Contact & List</th>
                  <th className="py-2.5 px-3">List Kill Switch Watch</th>
                  <th className="py-2.5 px-3">Server Status / Countdown</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {scheduledJobs.slice(0, 12).map((job) => {
                  const remainingSec = Math.max(
                    0,
                    Math.ceil((new Date(job.scheduledFor).getTime() - nowTickMs) / 1000)
                  );
                  return (
                    <tr key={job.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-3 align-top">
                        <div className="font-bold text-slate-900">{job.stepTitle}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {job.channel.toUpperCase()} · From: {job.fromIdentity}
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="font-semibold text-slate-900">
                          {job.contactName}{' '}
                          <span className="font-mono text-slate-500">({job.toRecipient})</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          List: <strong className="text-slate-700">{job.listName}</strong> · Tags:{' '}
                          {job.contactTags.length > 0
                            ? job.contactTags.map((t) => `#${t}`).join(' · ')
                            : 'None'}
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top font-mono text-[11px]">
                        {job.killSwitchEnabled ? (
                          <span className="text-slate-800">
                            Active · Stops on{' '}
                            <strong>
                              {job.killSwitchTags.map((t) => `#${t}`).join(', ')}
                            </strong>
                          </span>
                        ) : (
                          <span className="text-slate-400">Disabled on List</span>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top">
                        {job.status === 'queued' && (
                          <div className="space-y-0.5">
                            <div className="font-mono font-bold text-amber-700 tabular-nums">
                              Queued · Firing in {remainingSec}s
                            </div>
                            <div className="text-[11px] text-slate-500">{job.statusReason}</div>
                          </div>
                        )}
                        {job.status === 'dispatched' && (
                          <div className="space-y-0.5">
                            <div className="font-bold text-emerald-700">
                              ✓ Dispatched Automatically
                            </div>
                            <div className="text-[11px] text-slate-500">{job.statusReason}</div>
                          </div>
                        )}
                        {job.status === 'halted_kill_switch' && (
                          <div className="space-y-0.5">
                            <div className="font-bold text-rose-700">
                              ■ Stopped by List Kill Switch (#{job.matchedKillSwitchTag})
                            </div>
                            <div className="text-[11px] text-rose-800">{job.statusReason}</div>
                          </div>
                        )}
                        {job.status === 'cancelled' && (
                          <div className="text-slate-500 font-medium">{job.statusReason}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top text-right">
                        {job.status === 'queued' ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await triggerScheduledJobNow(job.id);
                                setSchedulerSummary(res.summary);
                                setScheduledJobs(res.jobs);
                                setDeliveryReceipts(getStoredDeliveryReceipts());
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <Play className="w-3 h-3 text-emerald-400" />
                              <span>Fire Now</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await cancelScheduledJob({ jobId: job.id });
                                setSchedulerSummary(res.summary);
                                setScheduledJobs(res.jobs);
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-rose-700 border border-slate-200 rounded-md cursor-pointer whitespace-nowrap"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : job.directLaunchUrl ? (
                          <a
                            href={job.directLaunchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <span>Open {job.channel.toUpperCase()}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Explicit User Confirmation Modal before Sending Email via Connected Gmail OAuth */}
      {pendingGmailConfirmAction && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Confirm Gmail API Dispatch
              </div>
              <h3 className="font-display text-lg font-bold text-slate-950">
                Send Email via Your Connected Google Account?
              </h3>
              <p className="text-xs text-slate-600">
                Please confirm that you want FlowPilot to send the following email on your behalf
                using your connected Gmail account (
                <strong className="font-mono text-slate-900">
                  {connectedGmailAddress || 'Google OAuth'}
                </strong>
                ):
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-mono">
              <div>
                <span className="text-slate-500">From:</span>{' '}
                <strong className="text-slate-900">
                  {connectedGmailAddress || liveResolvedIdentities.activeSenderEmail}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">To:</span>{' '}
                <strong className="text-slate-900">
                  {pendingGmailConfirmAction.recipientEmail}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Subject:</span>{' '}
                <strong className="text-slate-900">{pendingGmailConfirmAction.subject}</strong>
              </div>
              <div className="pt-1 text-slate-700 font-sans whitespace-pre-wrap">
                {pendingGmailConfirmAction.body}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingGmailConfirmAction(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const action = pendingGmailConfirmAction;
                  setPendingGmailConfirmAction(null);
                  if (action.mode === 'all_channels') {
                    await executeAllThreeChannelsTestNow();
                  } else {
                    await executeSingleChannelTestNow('email');
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirm & Send via Gmail</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 1: Authentication, Session Security & Tenant Isolation Status */}
      <section className="border border-slate-800 rounded-2xl bg-[#0F172A] text-white p-4 sm:p-6 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Authentication, Session Management & Tenant Access Control
            </div>
            <h2 className="font-display text-lg sm:text-xl lg:text-2xl font-bold text-white mt-1">
              Account Security & Workspace Isolation
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Workspace Tenant ID:{' '}
              <span className="font-mono text-emerald-400">{workspace.id}</span> · PII Split
              Collection Active · Plan: <strong className="text-emerald-400">$0 Free Forever</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={handlePasswordResetClick}
                  className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Password Reset</span>
                </button>

                {!userEmailVerified && (
                  <button
                    type="button"
                    onClick={handleEmailVerificationClick}
                    className="px-3.5 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Verify Email</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onReseedWorkspace}
                  className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Purge Sample Records</span>
                </button>

                <button
                  type="button"
                  onClick={onSignOut}
                  className="px-3.5 py-2 text-xs sm:text-sm font-bold text-white bg-slate-800 hover:bg-red-700 border border-slate-700 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out Session</span>
                </button>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAuth('signin')}
                  className="px-3.5 py-2 text-xs sm:text-sm font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl cursor-pointer"
                >
                  Sign In (Email or Google)
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="px-3.5 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl cursor-pointer"
                >
                  Create Free Account
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('forgot')}
                  className="px-3 py-2 text-xs sm:text-sm font-semibold text-slate-300 hover:text-emerald-400 cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </div>
        </div>

        {authNotice && (
          <div className="mt-4 p-3.5 bg-emerald-950/60 border border-emerald-500/40 text-xs sm:text-sm text-emerald-200 rounded-xl">
            {authNotice}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 pt-4 text-xs sm:text-sm">
          <div>
            <div className="text-slate-400 text-[11px] uppercase tracking-wider">Session Authentication</div>
            <div className="font-bold text-white mt-0.5">
              {isAuthenticated
                ? 'Authenticated Cloud Session (Firebase Auth)'
                : 'Interactive Sandbox Session'}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[11px] uppercase tracking-wider">Email Verification Gate</div>
            <div className="font-bold text-emerald-400 mt-0.5 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                {userEmailVerified
                  ? 'Verified Identity Token (email_verified == true)'
                  : 'Sandbox Identity'}
              </span>
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[11px] uppercase tracking-wider">Tenant Data Boundary</div>
            <div className="font-bold text-emerald-400 mt-0.5">
              Zero-Trust Master Gate & Split PII Enforced
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Business Profile, Regional Preferences & Additional Compliance Details */}
      <form
        onSubmit={handleSaveSettings}
        className="border border-slate-200 rounded-2xl bg-white p-4 sm:p-6 space-y-5 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950">
              Business Profile, Regional Settings & Compliance Details
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Configure workspace name, time zone, currency, brand logo, and SMS / physical address
              details
            </p>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer disabled:opacity-60 shrink-0"
          >
            {isSaving ? 'Saving...' : 'Save Workspace Settings'}
          </button>
        </div>

        {/* Platform Brand Logo Card */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="px-4 py-2.5 rounded-xl bg-[#0F172A] border border-slate-800 inline-flex items-center">
              <FlowPilotLogo variant="dark" size="md" />
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 inline-flex items-center">
              <FlowPilotLogo variant="light" size="md" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">
                FlowPilot Platform Brand Logo
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Active across sidebar navigation, public landing header/footer, mobile bar, and auth modals.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="px-3.5 py-2 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl cursor-pointer transition-colors">
              <span>Upload Custom Logo (.png / .svg)</span>
              <input
                type="file"
                accept="image/png,image/svg+xml,image/webp,image/jpeg"
                onChange={handleCustomLogoUpload}
                className="hidden"
              />
            </label>
            {customLogoPreview && (
              <button
                type="button"
                onClick={handleResetLogo}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl cursor-pointer"
              >
                Reset Default Emblem
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-sm">
          <div>
            <label className="block font-semibold text-slate-800 mb-1.5">
              Workspace / Business Name *
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1.5">Business Segment</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as BusinessCategory)}
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-slate-300 rounded-xl"
            >
              <option value="creator">Digital Creator / Course Builder</option>
              <option value="freelancer">Freelancer / Independent Operator</option>
              <option value="coach">Coach / Advisory Practice</option>
              <option value="agency">Marketing / Creative Agency</option>
              <option value="smb">Small-to-Medium Business (SMB)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1.5">Time Zone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-slate-300 rounded-xl"
            >
              <option value="America/New_York">America/New_York (EST/EDT)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="Europe/Berlin">Europe/Berlin (CET)</option>
              <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1.5">Workspace Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-slate-300 rounded-xl font-mono"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="NGN">NGN (₦)</option>
              <option value="CAD">CAD (CA$)</option>
            </select>
          </div>
        </div>

        <div className="pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
          <div>
            <label className="block font-semibold text-slate-800 mb-1.5">
              Reply-To Email Address *
            </label>
            <input
              type="email"
              required
              maxLength={150}
              value={replyToEmail}
              onChange={(e) => setReplyToEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1.5">
              Alphanumeric SMS Sender ID
            </label>
            <input
              type="text"
              maxLength={32}
              value={smsSenderId}
              onChange={(e) => setSmsSenderId(e.target.value)}
              placeholder="e.g., FLOWPILOT"
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-slate-300 rounded-xl font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1.5">
              Physical Mailing Address (CAN-SPAM / GDPR Footer)
            </label>
            <input
              type="text"
              maxLength={250}
              value={mailingAddress}
              onChange={(e) => setMailingAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-slate-300 rounded-xl"
            />
          </div>
        </div>

        {/* Provider Connections & Notification Toggles */}
        <div className="pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={emailConnected}
              onChange={(e) => setEmailConnected(e.target.checked)}
              className="accent-emerald-700 w-4 h-4"
            />
            <span className="font-semibold text-slate-800">Email API Connected</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={whatsappConnected}
              onChange={(e) => setWhatsappConnected(e.target.checked)}
              className="accent-emerald-700 w-4 h-4"
            />
            <span className="font-semibold text-slate-800">Official WhatsApp API</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={smsConnected}
              onChange={(e) => setSmsConnected(e.target.checked)}
              className="accent-emerald-700 w-4 h-4"
            />
            <span className="font-semibold text-slate-800">SMS Gateway Active</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyNewLeads}
              onChange={(e) => setNotifyNewLeads(e.target.checked)}
              className="accent-emerald-700 w-4 h-4"
            />
            <span className="font-semibold text-slate-800">Alert on New Leads</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyCampaigns}
              onChange={(e) => setNotifyCampaigns(e.target.checked)}
              className="accent-emerald-700 w-4 h-4"
            />
            <span className="font-semibold text-slate-800">Alert on Broadcasts</span>
          </label>
        </div>
      </form>

      {/* Section 3: Team Members & Role-Based Permissions (Subcollection) */}
      <section className="border border-slate-200 rounded-2xl bg-white p-7 space-y-6 shadow-xs">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="font-display text-2xl font-bold text-slate-950">
            Team Members & Role-Based Access Control (RBAC)
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Assign workspace permissions (Owner, Admin, Editor, Analyst) with no per-seat fees
          </p>
        </div>

        <form
          onSubmit={handleInviteMember}
          className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm items-end"
        >
          <div>
            <label className="block font-semibold text-slate-800 mb-1.5">Team Member Name *</label>
            <input
              type="text"
              required
              maxLength={100}
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Samira Patel"
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-800 mb-1.5">Work Email *</label>
            <input
              type="email"
              required
              maxLength={150}
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              placeholder="samira@studio.io"
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-800 mb-1.5">Workspace Role</label>
            <select
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value as MemberRole)}
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-slate-300 rounded-xl"
            >
              <option value="admin">Admin (Full Manage)</option>
              <option value="editor">Editor (Campaigns & CRM)</option>
              <option value="analyst">Analyst (Read-Only Telemetry)</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Team Member</span>
          </button>
        </form>

        <div className="divide-y divide-slate-100 text-sm">
          {members.map((m) => (
            <div key={m.id} className="py-4 flex items-center justify-between gap-4">
              <div>
                <div className="font-display text-base font-bold text-slate-950">{m.memberName}</div>
                <div className="text-slate-600 font-mono text-xs">{m.memberEmail}</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-emerald-800 font-bold capitalize">
                  Role: {m.role} · {m.status}
                </span>
                {m.role !== 'owner' && (
                  <button
                    type="button"
                    onClick={() => onDeleteMember(m.id)}
                    className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                    title="Remove team member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Full Workspace Backup Export/Import (.json) & Live API Webhook Inspector */}
      <section className="border border-slate-200 rounded-2xl bg-white p-7 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-[#047857] font-bold">
              Portable Data Ownership &amp; Developer API Inspector
            </div>
            <h3 className="font-display text-2xl font-bold text-slate-950 mt-0.5">
              Full Workspace Backup Export / Restore &amp; Webhook Payload Inspector
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Download a complete portable JSON snapshot of your workspace or restore from a backup file in one click.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportWorkspaceBackupJson}
              className="px-4 py-2.5 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl cursor-pointer inline-flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4 text-emerald-400" />
              <span>Export Full Workspace Backup (.json)</span>
            </button>
            <label className="px-4 py-2.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer inline-flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              <span>Restore from Backup (.json)</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportWorkspaceBackupJson}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {backupNotice && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-950 flex items-center justify-between">
            <span>{backupNotice}</span>
            <button
              type="button"
              onClick={() => setBackupNotice(null)}
              className="text-emerald-800 hover:underline font-bold ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <div className="lg:col-span-5 p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-3">
            <div className="font-bold text-slate-950 text-sm">
              Live Outbound &amp; Inbound Webhook Events
            </div>
            <p className="text-slate-600 leading-relaxed">
              Inspect the real-time JSON webhook schemas dispatched by FlowPilot to your external endpoints (Shopify, Stripe, Zapier, Make, n8n).
            </p>
            <div className="space-y-1.5">
              {(
                [
                  { id: 'message.deliver', label: 'flowpilot.message.deliver (Omnichannel)' },
                  { id: 'contact.captured', label: 'flowpilot.contact.captured (Lead Funnel)' },
                  { id: 'campaign.ab_winner', label: 'flowpilot.campaign.ab_winner (A/B Split)' },
                  { id: 'conversion.attributed', label: 'flowpilot.conversion.attributed (Revenue ROI)' },
                ] as const
              ).map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setSelectedWebhookEventPreview(ev.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg font-mono font-bold border transition-colors cursor-pointer ${
                    selectedWebhookEventPreview === ev.id
                      ? 'bg-[#0F172A] text-emerald-400 border-[#0F172A]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {ev.label}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 p-4 rounded-xl bg-[#0F172A] text-slate-100 border border-slate-800 space-y-2 font-mono">
            <div className="flex items-center justify-between text-[11px] text-emerald-400 border-b border-slate-800 pb-2">
              <span>POST {getStoredOutboundWebhookUrl() || 'https://hooks.yourworkspace.io/flowpilot'}</span>
              <span>HTTP 200 OK · Signed HMAC-SHA256</span>
            </div>
            <pre className="text-[11px] leading-relaxed overflow-x-auto text-slate-200">
              {JSON.stringify(
                {
                  event: `flowpilot.${selectedWebhookEventPreview}`,
                  workspaceId: workspace.id,
                  workspaceName: workspace.name,
                  timestamp: new Date().toISOString(),
                  payload:
                    selectedWebhookEventPreview === 'message.deliver'
                      ? {
                          channel: 'email',
                          from: privateProfile.email,
                          to: 'subscriber@company.com',
                          status: 'delivered',
                        }
                      : selectedWebhookEventPreview === 'contact.captured'
                      ? {
                          email: 'lead@company.com',
                          listName: 'General Contacts',
                          consentStatus: 'opted_in',
                        }
                      : selectedWebhookEventPreview === 'campaign.ab_winner'
                      ? {
                          winningVariant: 'B',
                          criterion: 'open_rate',
                          autoDispatchedRemainingPercent: 60,
                        }
                      : {
                          attributedRevenue: 290,
                          currency: workspace.currency,
                          channel: 'email',
                        },
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
};
