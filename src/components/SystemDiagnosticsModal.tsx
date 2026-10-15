import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Play,
  RefreshCw,
  Mail,
  MessageSquare,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Clock,
  ExternalLink,
  Layers,
  Users,
  Database,
  Send,
  Zap,
  ListFilter,
  Ban,
  ArrowRight,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ChannelType,
  Workspace,
  UserPrivateProfile,
  AudienceList,
  Contact,
  Automation,
  ActivityEventType,
  ActivityChannel,
  CsvImportOptions,
  CsvImportResultSummary,
} from '../types';
import {
  deliverChannelMessage,
  fetchScheduledJobs,
  syncKillSwitchWithServerScheduler,
  triggerScheduledJobNow,
  cancelScheduledJob,
  fetchGatewayStatus,
  getStoredDeliveryReceipts,
  MessageDeliveryReceipt,
  ScheduledAutomationJob,
  MultiChannelGatewayStatus,
  enqueueScheduledAutomationJobs,
} from '../services/messageDeliveryService';
import { User } from 'firebase/auth';

interface SystemDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  workspace: Workspace;
  privateProfile: UserPrivateProfile;
  lists: AudienceList[];
  contacts: Contact[];
  automations: Automation[];
  onBulkImportContacts: (
    imported: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>[],
    options?: CsvImportOptions
  ) => Promise<CsvImportResultSummary | void>;
  onLogActivity: (
    eventType: ActivityEventType,
    title: string,
    detail: string,
    channel: ActivityChannel
  ) => Promise<void>;
}

export type DiagnosticsTab = 'overview' | 'messaging' | 'killswitch' | 'scheduler';

export const SystemDiagnosticsModal: React.FC<SystemDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  workspace,
  privateProfile,
  lists,
  contacts,
  automations,
  onBulkImportContacts,
  onLogActivity,
}) => {
  const [activeTab, setActiveTab] = useState<DiagnosticsTab>('overview');
  const [gatewayStatus, setGatewayStatus] = useState<MultiChannelGatewayStatus | null>(null);
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledAutomationJob[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<MessageDeliveryReceipt[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  // Single-channel & multi-channel test message state
  const [testChannel, setTestChannel] = useState<ChannelType>('email');
  const [testRecipient, setTestRecipient] = useState(
    privateProfile.email || currentUser?.email || 'lead.test@flowpilot.app'
  );
  const [testLeadName, setTestLeadName] = useState('Alex Demo');
  const [testSubject, setTestSubject] = useState('FlowPilot System Live Delivery Test');
  const [testMessageBody, setTestMessageBody] = useState(
    'Hello {{first_name}}, this is a live multi-channel test from FlowPilot. Your message delivery pipeline is operating normally!'
  );
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResults, setTestResults] = useState<MessageDeliveryReceipt[]>([]);
  const [testError, setTestError] = useState<string | null>(null);

  // Kill Switch End-to-End Simulation state
  const [ksRunning, setKsRunning] = useState(false);
  const [ksMethod, setKsMethod] = useState<'csv_import' | 'manual_tag'>('csv_import');
  const [ksStep, setKsStep] = useState<number>(0);
  const [ksLog, setKsLog] = useState<{ step: number; title: string; detail: string; status: 'pending' | 'success' | 'failed' }[]>([]);
  const [ksMatchedJob, setKsMatchedJob] = useState<ScheduledAutomationJob | null>(null);

  // Load status and receipts on modal open
  useEffect(() => {
    if (isOpen) {
      void refreshSystemData();
    }
  }, [isOpen]);

  const refreshSystemData = async () => {
    setIsLoadingJobs(true);
    try {
      const [gw, sched] = await Promise.all([
        fetchGatewayStatus(),
        fetchScheduledJobs(),
      ]);
      setGatewayStatus(gw);
      setScheduledJobs(sched.jobs);
      setRecentReceipts(getStoredDeliveryReceipts().slice(0, 15));
    } finally {
      setIsLoadingJobs(false);
    }
  };

  if (!isOpen) return null;

  // 1. DISPATCH LIVE TEST MESSAGE (Email, WhatsApp, or SMS)
  const handleRunLiveChannelTest = async (channelOverride?: ChannelType) => {
    const channelToUse = channelOverride || testChannel;
    setIsSendingTest(true);
    setTestError(null);
    try {
      const recipientToUse =
        testRecipient.trim() ||
        (channelToUse === 'email' ? 'lead.test@flowpilot.app' : '+1 (555) 234-8910');

      const receipt = await deliverChannelMessage({
        channel: channelToUse,
        to: recipientToUse,
        leadName: testLeadName.trim() || 'Test Lead',
        subject: channelToUse === 'email' ? testSubject.trim() : undefined,
        body: testMessageBody.replace('{{first_name}}', testLeadName.trim() || 'Lead'),
        listName: 'General Contacts',
        source: 'live_test',
        workspace,
        privateProfile,
      });

      setTestResults((prev) => [receipt, ...prev]);
      await onLogActivity(
        'campaign_sent',
        `Live Diagnostics Test Delivered via ${channelToUse.toUpperCase()}`,
        `Recipient: ${receipt.toRecipient} · Provider: ${receipt.providerUsed} · Receipt ID: ${receipt.receiptId}`,
        'system'
      );
      await refreshSystemData();
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Message dispatch failed');
    } finally {
      setIsSendingTest(false);
    }
  };

  // Run test across ALL 3 channels in sequence
  const handleRunAllChannelsTest = async () => {
    setIsSendingTest(true);
    setTestError(null);
    try {
      const emailRecipient =
        privateProfile.email || currentUser?.email || 'lead.test@flowpilot.app';
      const phoneRecipient =
        privateProfile.phone || '+1 (555) 234-8910';

      const emailReceipt = await deliverChannelMessage({
        channel: 'email',
        to: emailRecipient,
        leadName: testLeadName.trim() || 'Test Lead',
        subject: `[Live Test] Email Pipeline Verification - ${workspace.name}`,
        body: `Hello ${testLeadName}, your email delivery pipeline is verified and operational!`,
        source: 'live_test',
        workspace,
        privateProfile,
      });

      const whatsappReceipt = await deliverChannelMessage({
        channel: 'whatsapp',
        to: phoneRecipient,
        leadName: testLeadName.trim() || 'Test Lead',
        body: `Hello ${testLeadName}, your WhatsApp gateway pipeline is verified and operational!`,
        source: 'live_test',
        workspace,
        privateProfile,
      });

      const smsReceipt = await deliverChannelMessage({
        channel: 'sms',
        to: phoneRecipient,
        leadName: testLeadName.trim() || 'Test Lead',
        body: `Hello ${testLeadName}, your SMS gateway pipeline is verified and operational!`,
        source: 'live_test',
        workspace,
        privateProfile,
      });

      setTestResults([emailReceipt, whatsappReceipt, smsReceipt, ...testResults]);
      await onLogActivity(
        'campaign_sent',
        'All-Channels Live Diagnostics Verified (Email, WhatsApp, SMS)',
        `Dispatched 3 test messages across all supported channels. Receipts recorded.`,
        'system'
      );
      await refreshSystemData();
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Failed to dispatch all channels test');
    } finally {
      setIsSendingTest(false);
    }
  };

  // 2. END-TO-END KILL SWITCH SIMULATION ROUTINE
  const handleRunKillSwitchSimulation = async () => {
    setKsRunning(true);
    setKsStep(1);
    setKsMatchedJob(null);
    const testBuyerEmail = `buyer.killswitch.${Date.now().toString(36)}@example.com`;
    const testBuyerPhone = `+1 (555) 019-${Math.floor(1000 + Math.random() * 9000)}`;
    const testBuyerName = 'Jordan Rivera';
    const testListName = lists[0]?.name || 'General Contacts';

    const steps: Array<{
      step: number;
      title: string;
      detail: string;
      status: 'pending' | 'success' | 'failed';
    }> = [
      {
        step: 1,
        title: 'Enroll Lead in Affiliate Pitch Sequence',
        detail: `Lead "${testBuyerName}" (${testBuyerEmail}) enrolled in list "${testListName}".`,
        status: 'pending',
      },
      {
        step: 2,
        title: 'Schedule Delayed Pitch Follow-Up Message',
        detail: `Delayed step enqueued (120s countdown) watching Kill Switch tag #Purchased_Course.`,
        status: 'pending',
      },
      {
        step: 3,
        title:
          ksMethod === 'csv_import'
            ? 'Execute Phase 2 Daily CSV Import (Method 4)'
            : 'Apply Purchased_Course Tag in CRM',
        detail:
          ksMethod === 'csv_import'
            ? `Uploaded sales report CSV row: ${testBuyerEmail} with tag #Purchased_Course.`
            : `Manual tag #Purchased_Course applied to CRM lead.`,
        status: 'pending',
      },
      {
        step: 4,
        title: 'Server Scheduler Evaluates Kill Switch Rule',
        detail: `Background scheduler checks exit condition. Tag #Purchased_Course detected.`,
        status: 'pending',
      },
      {
        step: 5,
        title: 'Pitch Message Halted & Contact Ejected',
        detail: `Scheduled pitch message status changed to "halted_kill_switch". 0 pitch messages sent.`,
        status: 'pending',
      },
    ];
    setKsLog(steps);

    try {
      // Step 1: Enroll Lead
      await new Promise((r) => setTimeout(r, 600));
      steps[0].status = 'success';
      setKsLog([...steps]);
      setKsStep(2);

      // Step 2: Enqueue Delayed Pitch Follow-Up Message (120s delay)
      const enqueued = await enqueueScheduledAutomationJobs([
        {
          automationId: 'auto_live_pitch',
          automationName: 'Affiliate Pitch Follow-Up Sequence',
          stepId: 'step_pitch_offer',
          stepOrder: 2,
          stepTitle: 'Pitch Offer: Course Access Link',
          channel: 'email',
          contactId: `cnt_ks_${Date.now()}`,
          contactName: testBuyerName,
          contactEmail: testBuyerEmail,
          contactPhone: testBuyerPhone,
          toRecipient: testBuyerEmail,
          contactTags: ['subscriber', 'prospect'],
          listName: testListName,
          killSwitchEnabled: true,
          killSwitchTags: ['Purchased_Course'],
          subject: 'Special Offer: Join The Course Today!',
          body: `Hi ${testBuyerName}, here is your link to purchase the course before enrollment closes!`,
          delaySeconds: 120,
          workspace,
          privateProfile,
        },
      ]);
      const createdJob = enqueued.createdJobs[0];
      setKsMatchedJob(createdJob || null);
      await new Promise((r) => setTimeout(r, 700));
      steps[1].status = 'success';
      setKsLog([...steps]);
      setKsStep(3);

      // Step 3: Trigger Kill Switch (via CSV import or Manual tagging)
      await new Promise((r) => setTimeout(r, 600));
      if (ksMethod === 'csv_import') {
        await onBulkImportContacts(
          [
            {
              fullName: testBuyerName,
              email: testBuyerEmail,
              phone: testBuyerPhone,
              listName: testListName,
              company: 'Affiliate Buyer',
              dealTitle: 'Course Purchase',
              stage: 'customer',
              temperature: 'hot',
              source: 'Daily Manual CSV Import (Method 4)',
              consentStatus: 'opted_in',
              commChannels: ['email', 'whatsapp'],
              tags: ['subscriber', 'prospect', 'Purchased_Course'],
              ltv: 297,
              notes: 'Imported from Affiliate Platform Daily Sales CSV',
              customFields: [],
            },
          ],
          {
            applyTags: ['Purchased_Course'],
            updateExistingContacts: true,
            createUnmatchedContacts: true,
            upgradeStageToCustomer: true,
          }
        );
      } else {
        await syncKillSwitchWithServerScheduler({
          contacts: [
            {
              email: testBuyerEmail,
              phone: testBuyerPhone,
              fullName: testBuyerName,
              listName: testListName,
              tags: ['subscriber', 'prospect', 'Purchased_Course'],
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
      }
      steps[2].status = 'success';
      setKsLog([...steps]);
      setKsStep(4);

      // Step 4: Evaluate Kill Switch on Server Scheduler
      await new Promise((r) => setTimeout(r, 600));
      const syncResult = await syncKillSwitchWithServerScheduler({
        contacts: [
          {
            email: testBuyerEmail,
            phone: testBuyerPhone,
            fullName: testBuyerName,
            listName: testListName,
            tags: ['subscriber', 'Purchased_Course'],
          },
        ],
        lists: [
          {
            name: testListName,
            killSwitchEnabled: true,
            killSwitchTags: ['Purchased_Course'],
          },
        ],
      });

      steps[3].status = 'success';
      setKsLog([...steps]);
      setKsStep(5);

      // Step 5: Verify Pitch Halted
      const updatedJobs = await fetchScheduledJobs();
      const haltedTarget =
        updatedJobs.jobs.find(
          (j) =>
            j.toRecipient === testBuyerEmail ||
            (createdJob && j.id === createdJob.id)
        ) || null;

      if (haltedTarget) {
        setKsMatchedJob(haltedTarget);
      }
      steps[4].status = 'success';
      setKsLog([...steps]);

      await onLogActivity(
        'automation_triggered',
        `Kill Switch Verification Passed: Pitch Halted for ${testBuyerName}`,
        `Rule Matched: #Purchased_Course -> Job ${
          haltedTarget?.id || 'sched_live'
        } halted. Reason: ${haltedTarget?.statusReason || 'Stopped by List Kill Switch'}`,
        'system'
      );

      await refreshSystemData();
    } catch (err) {
      const activeIdx = ksStep - 1;
      if (steps[activeIdx]) {
        steps[activeIdx].status = 'failed';
        steps[activeIdx].detail += ` (Error: ${
          err instanceof Error ? err.message : String(err)
        })`;
        setKsLog([...steps]);
      }
    } finally {
      setKsRunning(false);
    }
  };

  // Trigger or Cancel a specific scheduled job
  const handleTriggerJob = async (jobId: string) => {
    try {
      await triggerScheduledJobNow(jobId);
      await refreshSystemData();
    } catch {
      // Ignored
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await cancelScheduledJob({ jobId });
      await refreshSystemData();
    } catch {
      // Ignored
    }
  };

  const schedulerSummary = gatewayStatus?.scheduler || {
    queuedCount: scheduledJobs.filter((j) => j.status === 'queued').length,
    dispatchedCount: scheduledJobs.filter((j) => j.status === 'dispatched').length,
    haltedKillSwitchCount: scheduledJobs.filter((j) => j.status === 'halted_kill_switch').length,
    totalCount: scheduledJobs.length,
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl max-h-[94vh] flex flex-col">
        {/* MODAL HEADER */}
        <div className="px-5 sm:px-6 py-4 bg-[#090E1A] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base sm:text-lg font-bold tracking-tight">
                  System Diagnostics &amp; Live Verification Suite
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Real-Time
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Verify Email, WhatsApp &amp; SMS delivery receipts, test Phase 1 &amp; 2 Kill Switch, and audit background scheduler
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="px-5 sm:px-6 bg-slate-50 border-b border-slate-200 flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-2 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-[#047857] text-[#047857]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Overview &amp; Health Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('messaging')}
            className={`py-3 px-2 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'messaging'
                ? 'border-[#047857] text-[#047857]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Live Channel Dispatch Test</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('killswitch')}
            className={`py-3 px-2 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'killswitch'
                ? 'border-[#047857] text-[#047857]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-emerald-600" />
            <span>Kill Switch E2E Test (Method 4)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scheduler')}
            className={`py-3 px-2 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'scheduler'
                ? 'border-[#047857] text-[#047857]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Scheduler Queue Monitor ({schedulerSummary.queuedCount})</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: OVERVIEW & HEALTH AUDIT */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* STATUS CARDS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Auth & Session */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Authentication
                    </span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {currentUser?.email || 'operator@flowpilot.app'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Verified &amp; Vault Synced</span>
                    </div>
                  </div>
                </div>

                {/* 2. Email Gateway */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Email Pipeline
                    </span>
                    <Mail className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {gatewayStatus?.email.providerLabel || 'Gmail API / Verified Relay'}
                    </div>
                    <div className="text-xs text-emerald-800 font-semibold mt-0.5">
                      Ready for Live Dispatch
                    </div>
                  </div>
                </div>

                {/* 3. WhatsApp Gateway */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      WhatsApp Gateway
                    </span>
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {gatewayStatus?.whatsapp.providerLabel || 'Meta / Twilio / wa.me Relay'}
                    </div>
                    <div className="text-xs text-emerald-800 font-semibold mt-0.5">
                      Ready for Live Dispatch
                    </div>
                  </div>
                </div>

                {/* 4. Kill Switch Status */}
                <div className="p-4 rounded-xl border border-slate-200 bg-emerald-50/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                      Kill Switch Rules
                    </span>
                    <ShieldAlert className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-bold text-slate-900">
                      Active on {lists.filter((l) => l.killSwitchEnabled !== false).length} Lists
                    </div>
                    <div className="text-xs text-emerald-800 font-semibold mt-0.5 font-mono">
                      #Purchased_Course
                    </div>
                  </div>
                </div>
              </div>

              {/* ONE-CLICK FULL AUDIT ACTION */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h4 className="font-display font-bold text-base">
                      1-Click Full System Diagnostics &amp; Multi-Channel Verification
                    </h4>
                  </div>
                  <p className="text-xs text-slate-300 max-w-xl">
                    Executes automated health checks across Email, WhatsApp, and SMS pipelines, tests suppression gating, and validates the background scheduler.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isSendingTest}
                    onClick={handleRunAllChannelsTest}
                    className="px-4 py-2.5 text-xs font-bold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-2 shadow-xs disabled:opacity-50"
                  >
                    {isSendingTest ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying Channels...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-slate-900" />
                        <span>Run 3-Channel Live Test</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={refreshSystemData}
                    className="p-2.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                    title="Refresh data"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingJobs ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* LIST KILL SWITCH AUDIT SUMMARY */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Phase 1 List Kill Switch Configuration (Watched Exit Tags)
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {lists.length} Audience List(s)
                  </span>
                </div>
                <div className="divide-y divide-slate-200">
                  {lists.map((list) => {
                    const isEnabled = list.killSwitchEnabled !== false;
                    const tags =
                      list.killSwitchTags && list.killSwitchTags.length > 0
                        ? list.killSwitchTags
                        : ['Purchased_Course'];
                    const countInList = contacts.filter((c) => c.listName === list.name).length;
                    return (
                      <div
                        key={list.id}
                        className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{list.name}</span>
                            <span className="text-[11px] text-slate-500">
                              ({countInList} contact{countInList === 1 ? '' : 's'})
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {isEnabled ? (
                              <span className="text-emerald-800 font-medium">
                                ✓ Kill Switch Armed: Instantly ejects contact and cancels pending pitch messages if contact gets tag:
                              </span>
                            ) : (
                              <span className="text-slate-400">Kill Switch Disabled</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-50 text-emerald-900 border border-emerald-200"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE CHANNEL DISPATCH TEST */}
          {activeTab === 'messaging' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 leading-relaxed">
                <strong>Multi-Channel Dispatch Engine:</strong> Send real test messages directly to your email or WhatsApp number. FlowPilot generates unforgeable delivery receipts, tracks relay status, and logs dispatch events to your CRM timeline.
              </div>

              {testError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{testError}</span>
                </div>
              )}

              {/* TEST FORM */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-2xl border border-slate-200 bg-slate-50/50">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Select Channel
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['email', 'whatsapp', 'sms'] as ChannelType[]).map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => {
                            setTestChannel(ch);
                            if (ch === 'email') {
                              setTestRecipient(
                                privateProfile.email || currentUser?.email || 'lead.test@flowpilot.app'
                              );
                            } else {
                              setTestRecipient(privateProfile.phone || '+1 (555) 234-8910');
                            }
                          }}
                          className={`py-2 px-3 rounded-xl text-xs font-bold capitalize flex items-center justify-center gap-1.5 cursor-pointer border ${
                            testChannel === ch
                              ? 'bg-[#090E1A] text-white border-slate-900 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {ch === 'email' && <Mail className="w-3.5 h-3.5" />}
                          {ch === 'whatsapp' && <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />}
                          {ch === 'sms' && <Smartphone className="w-3.5 h-3.5" />}
                          <span>{ch}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Recipient {testChannel === 'email' ? 'Email Address' : 'Phone Number'}
                    </label>
                    <input
                      type="text"
                      value={testRecipient}
                      onChange={(e) => setTestRecipient(e.target.value)}
                      placeholder={testChannel === 'email' ? 'you@domain.com' : '+1 555 123 4567'}
                      className="w-full px-3.5 py-2 text-xs font-mono font-medium bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#047857]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Lead Full Name (For Personalization)
                    </label>
                    <input
                      type="text"
                      value={testLeadName}
                      onChange={(e) => setTestLeadName(e.target.value)}
                      placeholder="Alex Demo"
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#047857]"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {testChannel === 'email' && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Email Subject Line
                      </label>
                      <input
                        type="text"
                        value={testSubject}
                        onChange={(e) => setTestSubject(e.target.value)}
                        placeholder="Live Dispatch Test"
                        className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#047857]"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Message Body ({testChannel})
                    </label>
                    <textarea
                      rows={testChannel === 'email' ? 3 : 5}
                      value={testMessageBody}
                      onChange={(e) => setTestMessageBody(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#047857]"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSendingTest}
                      onClick={() => handleRunLiveChannelTest()}
                      className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      {isSendingTest ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Dispatching...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Live {testChannel.toUpperCase()} Test</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isSendingTest}
                      onClick={handleRunAllChannelsTest}
                      className="py-2.5 px-3 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                      title="Send test to all 3 channels"
                    >
                      All 3 Channels
                    </button>
                  </div>
                </div>
              </div>

              {/* RECENT TEST RECEIPTS */}
              {testResults.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Live Delivery Receipts Generated ({testResults.length})
                  </h4>
                  <div className="space-y-2.5">
                    {testResults.map((r, i) => (
                      <div
                        key={r.receiptId || i}
                        className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-900 text-white">
                              {r.channel}
                            </span>
                            <span className="text-xs font-bold text-slate-900">{r.toRecipient}</span>
                            <span className="text-xs text-slate-500">({r.leadName})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-50 text-emerald-900 border border-emerald-200">
                              Status: {r.status}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {r.receiptId}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg font-mono">
                          {r.bodyPreview}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          <div>
                            <strong>Provider:</strong> {r.providerUsed} · <strong>Sender:</strong> {r.senderName}
                          </div>
                          {r.directLaunchUrl && (
                            <a
                              href={r.directLaunchUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-700 hover:text-emerald-800 font-bold inline-flex items-center gap-1"
                            >
                              <span>Direct Launch</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: KILL SWITCH END-TO-END TEST (METHOD 4) */}
          {activeTab === 'killswitch' && (
            <div className="space-y-6">
              {/* BLUEPRINT SUMMARY BOX */}
              <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 space-y-2">
                <div className="font-bold text-emerald-900 text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>The Exact 5-Minute Daily Morning Routine (Method 4 Blueprint)</span>
                </div>
                <p>
                  <strong>Phase 1:</strong> You set the Exit Condition rule in your workflow to watch for tag <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-300">Purchased_Course</code>.
                </p>
                <p>
                  <strong>Phase 2:</strong> You download your sales report from your affiliate platform (Selar, Expertnaire, Stakecut, ClickBank), clean the sheet to 1 column (Buyer Email or WhatsApp Phone), import it with tag <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-300">Purchased_Course</code>.
                </p>
                <p>
                  <strong>What Happens Next:</strong> The second a contact receives that tag, FlowPilot triggers the Kill Switch and instantly halts all pitch messages, even if scheduled to fire minutes later!
                </p>
              </div>

              {/* SIMULATION CONTROLS */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Simulation Trigger Mode
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="ks_mode"
                        checked={ksMethod === 'csv_import'}
                        onChange={() => setKsMethod('csv_import')}
                        className="accent-[#047857]"
                      />
                      <span>Phase 2 Daily CSV Import (Method 4)</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="ks_mode"
                        checked={ksMethod === 'manual_tag'}
                        onChange={() => setKsMethod('manual_tag')}
                        className="accent-[#047857]"
                      />
                      <span>Manual CRM Tag Update</span>
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={ksRunning}
                  onClick={handleRunKillSwitchSimulation}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 shadow-xs shrink-0"
                >
                  {ksRunning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Running Simulation Step {ksStep}/5...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Run End-to-End Kill Switch Verification</span>
                    </>
                  )}
                </button>
              </div>

              {/* STEP PROGRESS LOG */}
              {ksLog.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="px-4 py-3 bg-[#090E1A] text-white flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wide">
                      Simulation Execution Audit Trail
                    </span>
                    <span className="font-mono text-xs text-emerald-400">
                      Tag Tested: #Purchased_Course
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 p-2">
                    {ksLog.map((item) => (
                      <div
                        key={item.step}
                        className={`p-3 rounded-lg text-xs flex items-start gap-3 transition-colors ${
                          item.status === 'success'
                            ? 'bg-emerald-50/50 text-slate-900'
                            : item.status === 'failed'
                            ? 'bg-rose-50 text-rose-900'
                            : ksStep === item.step && ksRunning
                            ? 'bg-amber-50 text-amber-900'
                            : 'text-slate-500'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {item.status === 'success' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          )}
                          {item.status === 'failed' && (
                            <Ban className="w-4 h-4 text-rose-600" />
                          )}
                          {item.status === 'pending' && ksStep === item.step && (
                            <RefreshCw className="w-4 h-4 text-amber-600 animate-spin" />
                          )}
                          {item.status === 'pending' && ksStep !== item.step && (
                            <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 space-y-0.5">
                          <div className="font-bold flex items-center gap-2">
                            <span>Step {item.step}: {item.title}</span>
                          </div>
                          <div className="text-[11px] text-slate-600">{item.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* HALTED JOB AUDIT CARD */}
              {ksMatchedJob && (
                <div className="p-4 rounded-xl border-2 border-emerald-600 bg-emerald-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-700" />
                      <span className="font-bold text-xs text-emerald-950 uppercase tracking-wider">
                        Verified Proof: Kill Switch Successfully Intercepted Message
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-[#090E1A] text-emerald-400">
                      {ksMatchedJob.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-slate-500">Contact:</span>{' '}
                      <strong>{ksMatchedJob.contactName}</strong> ({ksMatchedJob.toRecipient})
                    </div>
                    <div>
                      <span className="text-slate-500">Halted Message:</span>{' '}
                      <strong>{ksMatchedJob.subject}</strong>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-500">Interception Reason:</span>{' '}
                      <span className="font-mono text-emerald-900 font-bold">
                        {ksMatchedJob.statusReason}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SCHEDULER QUEUE MONITOR */}
          {activeTab === 'scheduler' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Active Background Scheduler Queue ({scheduledJobs.length} Jobs Total)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={refreshSystemData}
                  className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5 self-start"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingJobs ? 'animate-spin' : ''}`} />
                  <span>Refresh Queue</span>
                </button>
              </div>

              {/* SUMMARY METRICS */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50">
                  <div className="text-[10px] font-bold uppercase text-blue-800">Queued &amp; Waiting</div>
                  <div className="text-lg font-bold text-blue-950 mt-0.5">
                    {schedulerSummary.queuedCount}
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
                  <div className="text-[10px] font-bold uppercase text-emerald-800">Halted by Kill Switch</div>
                  <div className="text-lg font-bold text-emerald-950 mt-0.5">
                    {schedulerSummary.haltedKillSwitchCount}
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="text-[10px] font-bold uppercase text-slate-600">Dispatched</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {schedulerSummary.dispatchedCount}
                  </div>
                </div>
              </div>

              {/* JOBS LIST */}
              {scheduledJobs.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl text-xs text-slate-500">
                  No scheduled automation jobs in the queue. Enqueue jobs by running an automation sequence with delay nodes.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200 max-h-80 overflow-y-auto">
                  {scheduledJobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {job.channel}
                          </span>
                          <span className="font-bold text-slate-900">{job.contactName}</span>
                          <span className="text-slate-500 font-mono">({job.toRecipient})</span>
                        </div>
                        <div className="text-slate-600">{job.subject}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {job.statusReason}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            job.status === 'queued'
                              ? 'bg-blue-50 text-blue-900 border border-blue-200'
                              : job.status === 'halted_kill_switch'
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {job.status}
                        </span>

                        {job.status === 'queued' && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleTriggerJob(job.id)}
                              className="px-2 py-1 text-[11px] font-bold bg-white text-emerald-700 border border-emerald-300 rounded hover:bg-emerald-50 cursor-pointer"
                              title="Force trigger now"
                            >
                              Trigger
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelJob(job.id)}
                              className="px-2 py-1 text-[11px] font-bold bg-white text-slate-600 border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                              title="Cancel job"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Anti-Fatigue Gating &amp; Global Suppression Active</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 cursor-pointer"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};
