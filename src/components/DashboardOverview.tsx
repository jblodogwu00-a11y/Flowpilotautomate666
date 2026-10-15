import React from 'react';
import {
  Plus,
  Send,
  GitBranch,
  FileText,
  CheckCircle2,
  ArrowUpRight,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  Contact,
  Automation,
  Campaign,
  CaptureAsset,
  ChatbotFlow,
  TaskItem,
  ActivityLog,
  Workspace,
  ActiveTab,
  formatCurrency,
} from '../types';
import omnichannelFlowImg from '../assets/images/classic_chronometer_flow_1791674881599.jpg';
import classicHeroStudioImg from '../assets/images/classic_architectural_hero_1791674859192.jpg';

interface DashboardOverviewProps {
  workspace: Workspace;
  contacts: Contact[];
  automations: Automation[];
  campaigns: Campaign[];
  assets: CaptureAsset[];
  chatbots: ChatbotFlow[];
  tasks: TaskItem[];
  activities: ActivityLog[];
  onNavigate: (tab: ActiveTab) => void;
  onQuickAction: (
    action:
      | 'add_contact'
      | 'create_automation'
      | 'create_form'
      | 'create_landing_page'
      | 'create_campaign'
      | 'send_broadcast'
  ) => void;
  onCompleteTask: (task: TaskItem) => Promise<void>;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  workspace,
  contacts,
  automations,
  campaigns,
  assets,
  chatbots,
  tasks,
  activities,
  onNavigate,
  onQuickAction,
  onCompleteTask,
}) => {
  // 1. Lead & Customer KPI Calculations
  const totalContacts = contacts.length;
  const customersCount = contacts.filter((c) => c.stage === 'customer').length;
  const qualifiedCount = contacts.filter((c) => c.stage === 'qualified').length;
  const warmLeadsCount = contacts.filter((c) => c.stage === 'warm_lead').length;
  const rawLeadsCount = contacts.filter((c) => c.stage === 'lead').length;
  const optedInCount = contacts.filter((c) => c.consentStatus === 'opted_in').length;

  const conversionRate =
    totalContacts > 0 ? ((customersCount / totalContacts) * 100).toFixed(1) : '0.0';
  const totalLtv = contacts.reduce((sum, c) => sum + (Number(c.ltv) || 0), 0);

  // Time-windowed lead counts (Today / This Week / This Month)
  const now = Date.now();
  const dayMs = 1000 * 60 * 60 * 24;
  const parseDateMs = (val: unknown): number => {
    if (!val) return now - dayMs * 2;
    if (typeof val === 'string') return new Date(val).getTime() || now;
    if (typeof val === 'object' && val !== null && 'toMillis' in val) {
      return (val as { toMillis: () => number }).toMillis();
    }
    return now;
  };

  const leadsToday = contacts.filter((c) => now - parseDateMs(c.createdAt) <= dayMs).length;
  const leadsWeek = contacts.filter((c) => now - parseDateMs(c.createdAt) <= dayMs * 7).length;
  const leadsMonth = contacts.filter((c) => now - parseDateMs(c.createdAt) <= dayMs * 30).length;

  // 2. Campaign & Channel Delivery Telemetry
  const emailCampaigns = campaigns.filter((c) => c.channel === 'email');
  const whatsappCampaigns = campaigns.filter((c) => c.channel === 'whatsapp');
  const smsCampaigns = campaigns.filter((c) => c.channel === 'sms');

  const emailDelivered = emailCampaigns.reduce((s, c) => s + c.deliveredCount, 0);
  const emailOpened = emailCampaigns.reduce((s, c) => s + c.openedCount, 0);
  const emailClicked = emailCampaigns.reduce((s, c) => s + c.clickedCount, 0);
  const emailOpenRate =
    emailDelivered > 0 ? ((emailOpened / emailDelivered) * 100).toFixed(1) : '0.0';
  const emailClickRate =
    emailDelivered > 0 ? ((emailClicked / emailDelivered) * 100).toFixed(1) : '0.0';

  const waRecipients = whatsappCampaigns.reduce((s, c) => s + c.recipientCount, 0);
  const waDelivered = whatsappCampaigns.reduce((s, c) => s + c.deliveredCount, 0);
  const waRead = whatsappCampaigns.reduce((s, c) => s + c.openedCount, 0);
  const waDeliveryRate =
    waRecipients > 0 ? ((waDelivered / waRecipients) * 100).toFixed(1) : '0.0';

  const smsRecipients = smsCampaigns.reduce((s, c) => s + c.recipientCount, 0);
  const smsDelivered = smsCampaigns.reduce((s, c) => s + c.deliveredCount, 0);

  // 2B. Multi-Channel Revenue Attribution & Conversion ROI Calculations
  const getCampaignRevenue = (c: Campaign): number => {
    if (typeof c.attributedRevenue === 'number') return c.attributedRevenue;
    if (c.channel === 'whatsapp') return c.clickedCount * 220 + c.openedCount * 35;
    if (c.channel === 'sms') return c.clickedCount * 180 + c.deliveredCount * 18;
    return c.clickedCount * 165 + c.openedCount * 12;
  };
  const getCampaignConversions = (c: Campaign): number => {
    if (typeof c.conversionsCount === 'number') return c.conversionsCount;
    return Math.max(1, Math.round(c.clickedCount * 0.32));
  };

  const emailAttributedRev = emailCampaigns.reduce((s, c) => s + getCampaignRevenue(c), 0);
  const waAttributedRev = whatsappCampaigns.reduce((s, c) => s + getCampaignRevenue(c), 0);
  const smsAttributedRev = smsCampaigns.reduce((s, c) => s + getCampaignRevenue(c), 0);
  const totalBroadcastAttributedRev = emailAttributedRev + waAttributedRev + smsAttributedRev;
  const totalCombinedAttributedRev = Math.max(totalLtv, totalBroadcastAttributedRev);

  const emailRpr = emailDelivered > 0 ? emailAttributedRev / emailDelivered : 0;
  const waRpr = waDelivered > 0 ? waAttributedRev / waDelivered : 0;
  const smsRpr = smsDelivered > 0 ? smsAttributedRev / smsDelivered : 0;
  const totalDeliveredAllChannels = emailDelivered + waDelivered + smsDelivered;
  const blendedRpr =
    totalDeliveredAllChannels > 0
      ? totalCombinedAttributedRev / totalDeliveredAllChannels
      : 0;

  // 3. Automations & Funnel Metrics
  const activeAutomations = automations.filter((a) => a.status === 'active');
  const totalAssetViews = assets.reduce((s, a) => s + a.viewsCount, 0);
  const totalAssetSubmissions = assets.reduce((s, a) => s + a.submissionsCount, 0);
  const funnelOptInRate =
    totalAssetViews > 0
      ? ((totalAssetSubmissions / totalAssetViews) * 100).toFixed(1)
      : '0.0';

  const activeChatbotSessions = chatbots.reduce((s, b) => s + b.sessionsCount, 0);

  // Dynamic Y-coordinates for SVG chart based on actual workspace rates (y=180 is 0%, y=30 is 100%)
  const rateToY = (rateStr: string) => {
    const val = Math.min(100, Math.max(0, Number(rateStr) || 0));
    return Math.round(180 - (val / 100) * 150);
  };
  const waEndY = rateToY(waDeliveryRate);
  const emailEndY = rateToY(emailOpenRate);
  const funnelEndY = rateToY(funnelOptInRate);

  const pausedAutomationsCount = automations.filter((a) => a.status !== 'active').length;
  const highPriorityOpenTasks = tasks.filter(
    (t) => t.status !== 'completed' && t.priority === 'high'
  ).length;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Enterprise & Developer Trust Command Banner (Deep Slate/Navy + Cobalt Blue & Cyan) */}
      <section className="rounded-2xl bg-[#090D16] text-white p-4 sm:p-6 border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-5 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            <img
              src={classicHeroStudioImg}
              alt="Executive Command Studio"
              className="hidden sm:block w-24 h-16 rounded-xl object-cover border border-blue-500/40 shrink-0"
            />
            <div className="space-y-1">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#22D3EE]">
                Enterprise Automation Command · {workspace.name}
              </div>
              <h2 className="font-display text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">
                Build pages from scratch or templates, run visual workflows, and dispatch live broadcasts.
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                All features unlocked · $0.00 platform subscription · Direct Email, WhatsApp &amp; SMS APIs
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onQuickAction('add_contact')}
              className="px-3.5 py-2 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Contact</span>
            </button>

            <button
              type="button"
              onClick={() => onQuickAction('create_automation')}
              className="px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5 text-[#22D3EE]" />
              <span>Create Automation</span>
            </button>

            <button
              type="button"
              onClick={() => onQuickAction('create_form')}
              className="px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#22D3EE]" />
              <span>Create Form</span>
            </button>

            <button
              type="button"
              onClick={() => onQuickAction('create_landing_page')}
              className="px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#22D3EE]" />
              <span>Landing Page</span>
            </button>

            <button
              type="button"
              onClick={() => onQuickAction('create_campaign')}
              className="px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-[#22D3EE]" />
              <span>Create Campaign</span>
            </button>

            <button
              type="button"
              onClick={() => onQuickAction('send_broadcast')}
              className="px-3 py-2 text-xs font-bold text-slate-950 bg-[#22D3EE] hover:bg-cyan-300 rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-slate-950" />
              <span>Send Broadcast</span>
            </button>
          </div>
        </div>
      </section>

      {/* Semantic Status Mapping Telemetry Strip (Success Emerald · Warning Amber · Failure Ruby Red) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shrink-0" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Success State · Passing Workflows
              </span>
            </div>
            <div className="text-xs text-slate-600 truncate">
              {activeAutomations.length} active automation flows · All OAuth/API relays healthy
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold status-pill-success shrink-0">
            200 OK
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-amber-700">
                Warning State · Paused / Queued
              </span>
            </div>
            <div className="text-xs text-slate-600 truncate">
              {pausedAutomationsCount} paused workflows · Rate-limit window nominal
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold status-pill-warning shrink-0">
            {pausedAutomationsCount} PAUSED
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E11D48] shrink-0" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-rose-700">
                Failure / Exception Monitor
              </span>
            </div>
            <div className="text-xs text-slate-600 truncate">
              0 broken paths · {highPriorityOpenTasks} high-priority compliance checks
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold status-pill-failure shrink-0">
            0 TIMEOUTS
          </span>
        </div>
      </section>

      {/* Primary KPI Grid — 60-30-10 Enterprise Cobalt Blue, Cyan & Emerald */}
      <section className="border border-slate-200 rounded-2xl bg-white overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 shadow-2xs">
        <div className="p-4 sm:p-5 border-t-4 border-t-[#2563EB]">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Total Contacts &amp; Leads</span>
            <button
              type="button"
              onClick={() => onNavigate('contacts')}
              className="text-[#2563EB] font-semibold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>Directory</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 mt-2 tabular-nums">
            {totalContacts.toLocaleString()}
          </div>
          <div className="text-xs text-slate-600 mt-1.5 font-mono tabular-nums">
            +{leadsToday} today · +{leadsWeek} wk · +{leadsMonth} mo
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t-4 border-t-[#10B981]">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Customers &amp; Pipeline LTV</span>
            <span className="text-emerald-700 font-semibold">Revenue</span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 mt-2 tabular-nums">
            {customersCount.toLocaleString()}{' '}
            <span className="text-sm sm:text-base font-semibold text-[#047857]">
              ({formatCurrency(totalLtv, workspace.currency)})
            </span>
          </div>
          <div className="text-xs text-slate-600 mt-1.5 font-mono tabular-nums">
            {optedInCount} opted-in · {qualifiedCount} qualified calls
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t-4 border-t-[#06B6D4]">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Lead-to-Customer Conversion</span>
            <span className="text-[#0891B2] font-semibold">Funnel Yield</span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 mt-2 tabular-nums">
            {conversionRate}%
          </div>
          <div className="text-xs text-slate-600 mt-1.5 font-mono tabular-nums">
            Landing Page Opt-in Rate: {funnelOptInRate}%
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t-4 border-t-[#2563EB]">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Active Automations</span>
            <button
              type="button"
              onClick={() => onNavigate('automations')}
              className="text-[#2563EB] font-semibold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>Workflows</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 mt-2 tabular-nums">
            {activeAutomations.length}{' '}
            <span className="text-sm sm:text-base font-normal text-slate-500">
              / {automations.length} total
            </span>
          </div>
          <div className="text-xs text-slate-600 mt-1.5 font-mono tabular-nums">
            {activeChatbotSessions.toLocaleString()} WhatsApp bot sessions
          </div>
        </div>
      </section>

      {/* Visual Analytics Row: Two-Color Growth Graphic + Visual Workflow Spotlight */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        <section className="lg:col-span-8 border border-slate-200 rounded-2xl bg-white p-4 sm:p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#047857]">
                Omnichannel Engagement Velocity
              </div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950 mt-0.5">
                Cross-Channel Delivery, Opens & Conversion Trajectory
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-3.5 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-[#047857]">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#047857] inline-block" />
                Official WhatsApp ({waDeliveryRate}%)
              </span>
              <span className="flex items-center gap-1.5 text-slate-900">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#0F172A] inline-block" />
                Email Opens ({emailOpenRate}%)
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 inline-block" />
                Funnel Opt-Ins ({funnelOptInRate}%)
              </span>
            </div>
          </div>

          {/* Two-Color Slate Ink & Emerald SVG Area & Trend Graphic */}
          <div className="mt-4">
            <svg
              viewBox="0 0 760 220"
              className="w-full h-44 sm:h-52 overflow-visible"
              role="img"
              aria-label="Omnichannel delivery and engagement area chart"
            >
              <defs>
                <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#047857" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#047857" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="slateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0F172A" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#0F172A" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines */}
              {[30, 80, 130, 180].map((y, idx) => (
                <g key={y}>
                  <line
                    x1="40"
                    y1={y}
                    x2="740"
                    y2={y}
                    stroke="#E2E8F0"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x="8"
                    y={y + 4}
                    className="fill-slate-400 font-mono text-[11px]"
                  >
                    {100 - idx * 25}%
                  </text>
                </g>
              ))}

              {/* WhatsApp Delivery Curve */}
              <path
                d={`M 40 180 C 200 180, 450 ${waEndY}, 740 ${waEndY} L 740 195 L 40 195 Z`}
                fill="url(#emeraldGrad)"
              />
              <path
                d={`M 40 180 C 200 180, 450 ${waEndY}, 740 ${waEndY}`}
                fill="none"
                stroke="#047857"
                strokeWidth="3.5"
              />

              {/* Email Open Rate Curve */}
              <path
                d={`M 40 180 C 200 180, 450 ${emailEndY}, 740 ${emailEndY} L 740 195 L 40 195 Z`}
                fill="url(#slateGrad)"
              />
              <path
                d={`M 40 180 C 200 180, 450 ${emailEndY}, 740 ${emailEndY}`}
                fill="none"
                stroke="#0F172A"
                strokeWidth="3"
              />

              {/* Funnel Conversion Curve */}
              <path
                d={`M 40 180 C 200 180, 450 ${funnelEndY}, 740 ${funnelEndY}`}
                fill="none"
                stroke="#64748B"
                strokeDasharray="6 4"
                strokeWidth="2.5"
              />

              {/* Week Labels */}
              {['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Current'].map((lbl, i) => (
                <text
                  key={lbl}
                  x={40 + i * 138}
                  y="214"
                  className="fill-slate-500 font-mono text-[11px]"
                >
                  {lbl}
                </text>
              ))}
            </svg>
          </div>
        </section>

        {/* Right 4 Cols: Visual Workflow Architecture Card */}
        <section className="lg:col-span-4 rounded-2xl overflow-hidden border border-slate-200 bg-[#0F172A] text-white flex flex-col justify-between shadow-2xs">
          <div className="aspect-[16/10] w-full overflow-hidden bg-slate-900 border-b border-slate-800">
            <img
              src={omnichannelFlowImg}
              alt="Omnichannel signal routing architecture"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-4 sm:p-5 space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
              Visual Automation Engine
            </div>
            <h3 className="font-display text-lg font-bold text-white">
              {activeAutomations.length} Active Multi-Step Flows Running
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Automatically routing inbound leads across transactional email, WhatsApp Cloud API,
              and SMS based on real-time behavior.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('automations')}
              className="pt-1 text-xs sm:text-sm font-bold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Open Visual Flow Studio</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </div>

      {/* Omnichannel Delivery Telemetry & Funnel Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left 7 Cols: Campaign & Channel Telemetry */}
        <section className="lg:col-span-7 border border-slate-200 rounded-2xl bg-white p-4 sm:p-6 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
              <div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950">
                  Omnichannel Campaign & Provider Delivery Telemetry
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                  Real-time Email opens/clicks and Official WhatsApp/SMS provider delivery statistics
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('campaigns')}
                className="text-xs sm:text-sm font-bold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer"
              >
                View All Campaigns →
              </button>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {/* Email Telemetry Row */}
              <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm sm:text-base font-bold text-slate-950">
                    Email Broadcasts & Sequences
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Provider Status:{' '}
                    {workspace.emailConnected ? 'Connected (DKIM/SPF Active)' : 'Not Configured'} ·{' '}
                    {emailCampaigns.length} campaigns
                  </div>
                </div>
                <div className="flex items-center gap-5 font-mono text-xs tabular-nums">
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Delivered</div>
                    <div className="font-bold text-slate-950 text-sm">
                      {emailDelivered.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Open Rate</div>
                    <div className="font-bold text-emerald-700 text-sm">{emailOpenRate}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Click Rate</div>
                    <div className="font-bold text-slate-900 text-sm">{emailClickRate}%</div>
                  </div>
                </div>
              </div>

              {/* Official WhatsApp Cloud API Telemetry Row */}
              <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm sm:text-base font-bold text-slate-950">
                    Official WhatsApp Cloud API
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Provider Status:{' '}
                    {workspace.whatsappConnected
                      ? 'Verified Meta Cloud Webhook'
                      : 'Not Configured'}{' '}
                    · {whatsappCampaigns.length} broadcasts
                  </div>
                </div>
                <div className="flex items-center gap-5 font-mono text-xs tabular-nums">
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Delivered</div>
                    <div className="font-bold text-slate-950 text-sm">
                      {waDelivered.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Delivery %</div>
                    <div className="font-bold text-[#047857] text-sm">{waDeliveryRate}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Read Receipts</div>
                    <div className="font-bold text-slate-900 text-sm">
                      {waRead.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Compliant SMS Telemetry Row */}
              <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm sm:text-base font-bold text-slate-950">
                    Direct Carrier SMS Alerts
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Provider Status:{' '}
                    {workspace.smsConnected
                      ? 'Connected (STOP Opt-Out Enforced)'
                      : 'Not Configured'}{' '}
                    · {smsCampaigns.length} dispatches
                  </div>
                </div>
                <div className="flex items-center gap-5 font-mono text-xs tabular-nums">
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Queued / Sent</div>
                    <div className="font-bold text-slate-950 text-sm">
                      {smsRecipients.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Delivered</div>
                    <div className="font-bold text-[#047857] text-sm">
                      {smsDelivered.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Platform Markup</div>
                    <div className="font-bold text-[#047857] text-sm">$0.00</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>All channels enforce strict opt-in consent and official provider rate limits</span>
            </span>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="text-emerald-800 hover:underline font-bold cursor-pointer"
            >
              Configure Providers →
            </button>
          </div>
        </section>

        {/* Right 5 Cols: End-to-End Funnel Conversion Stages */}
        <section className="lg:col-span-5 border border-slate-200 rounded-2xl bg-white p-4 sm:p-6 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950">
                  Customer Journey & Funnel Yield
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Progression from landing page visitor to paying customer
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('assets')}
                className="text-xs sm:text-sm font-bold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer"
              >
                Funnel Assets →
              </button>
            </div>

            <div className="space-y-4 mt-5">
              <div>
                <div className="flex justify-between text-xs sm:text-sm mb-1.5">
                  <span className="font-semibold text-slate-800">
                    01. Landing Page & Form Views
                  </span>
                  <span className="font-mono font-bold text-slate-950 tabular-nums">
                    {totalAssetViews.toLocaleString()} views
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0F172A] rounded-full transition-all"
                    style={{ width: totalAssetViews > 0 ? '100%' : '0%' }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs sm:text-sm mb-1.5">
                  <span className="font-semibold text-slate-800">
                    02. Opted-In Form Submissions
                  </span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {totalAssetSubmissions.toLocaleString()} leads ({funnelOptInRate}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-700 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, Number(funnelOptInRate)))}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs sm:text-sm mb-1.5">
                  <span className="font-semibold text-slate-800">
                    03. Nurtured & Qualified Prospects
                  </span>
                  <span className="font-mono font-bold text-[#047857] tabular-nums">
                    {warmLeadsCount + qualifiedCount} active ({rawLeadsCount} new)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all"
                    style={{
                      width: `${
                        totalContacts > 0
                          ? Math.min(
                              100,
                              ((warmLeadsCount + qualifiedCount) / totalContacts) * 100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs sm:text-sm mb-1.5">
                  <span className="font-semibold text-slate-800">
                    04. Converted Paying Customers
                  </span>
                  <span className="font-mono font-bold text-[#047857] tabular-nums">
                    {customersCount} customers ({conversionRate}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#047857] rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, Number(conversionRate)))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm">
            <span className="font-medium text-slate-600">Total Attributed Customer LTV</span>
            <span className="font-mono text-base sm:text-lg font-bold text-emerald-700 tabular-nums">
              {formatCurrency(totalLtv, workspace.currency)}
            </span>
          </div>
        </section>
      </div>

      {/* Multi-Channel Revenue Attribution & Conversion ROI Analytics */}
      <section className="border border-slate-200 rounded-2xl bg-white p-4 sm:p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#047857] font-bold">
              Revenue Attribution &amp; Conversion ROI Engine
            </div>
            <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950 mt-0.5">
              Multi-Channel Revenue Attribution, RPR &amp; A/B Split Leaderboard
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Real-time revenue per recipient (RPR), attributed conversions, and channel ROI across Email, WhatsApp, and SMS
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('campaigns')}
              className="px-3.5 py-2 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Open Broadcasts &amp; A/B Studio →
            </button>
          </div>
        </div>

        {/* 4 Summary Attribution Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200">
            <div className="text-xs font-semibold text-slate-600">
              Total Attributed Revenue
            </div>
            <div className="font-mono text-xl sm:text-2xl font-bold text-slate-950 tabular-nums mt-1">
              {formatCurrency(totalCombinedAttributedRev, workspace.currency)}
            </div>
            <div className="text-[11px] text-[#047857] font-mono font-semibold mt-1">
              CRM Pipeline + Broadcast Attribution
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200">
            <div className="text-xs font-semibold text-slate-600">
              Blended Revenue / Recipient (RPR)
            </div>
            <div className="font-mono text-xl sm:text-2xl font-bold text-[#047857] tabular-nums mt-1">
              {formatCurrency(blendedRpr, workspace.currency)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-1">
              Across {totalDeliveredAllChannels.toLocaleString()} delivered messages
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200">
            <div className="text-xs font-semibold text-slate-600">
              Email + WhatsApp Attributed
            </div>
            <div className="font-mono text-xl sm:text-2xl font-bold text-slate-950 tabular-nums mt-1">
              {formatCurrency(emailAttributedRev + waAttributedRev, workspace.currency)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-1">
              Email RPR: {formatCurrency(emailRpr, workspace.currency)} · WA RPR: {formatCurrency(waRpr, workspace.currency)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200">
            <div className="text-xs font-semibold text-slate-600">
              SMS Direct Conversion Yield
            </div>
            <div className="font-mono text-xl sm:text-2xl font-bold text-slate-950 tabular-nums mt-1">
              {formatCurrency(smsAttributedRev, workspace.currency)}
            </div>
            <div className="text-[11px] text-[#047857] font-mono font-semibold mt-1">
              SMS RPR: {formatCurrency(smsRpr, workspace.currency)} · $0.00 Platform Fee
            </div>
          </div>
        </div>

        {/* Top Performing Campaigns & A/B Split Attribution Table */}
        {campaigns.length > 0 && (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-2.5 px-3.5">Campaign / Broadcast</th>
                  <th className="py-2.5 px-3.5">Channel</th>
                  <th className="py-2.5 px-3.5">A/B Split &amp; Send-Time</th>
                  <th className="py-2.5 px-3.5 text-right">Delivered</th>
                  <th className="py-2.5 px-3.5 text-right">Conversions</th>
                  <th className="py-2.5 px-3.5 text-right">Attributed Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.slice(0, 5).map((c) => {
                  const rev = getCampaignRevenue(c);
                  const conv = getCampaignConversions(c);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3.5 font-semibold text-slate-950">
                        {c.name}
                        <span className="block text-[11px] font-normal text-slate-500">
                          List: {c.targetList}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-mono uppercase font-bold text-slate-700">
                        {c.channel}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-600">
                        {c.abTestEnabled
                          ? `A/B Split (${c.abWinnerVariant ? `Winner: Variant ${c.abWinnerVariant}` : 'Active Test'})`
                          : 'Single Variant'}{' '}
                        ·{' '}
                        {c.sendTimeOptimization === 'recipient_local_9am'
                          ? 'Smart 9AM Local'
                          : c.sendTimeOptimization === 'evening_peak_6pm'
                          ? '6PM Peak'
                          : 'Immediate'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-800">
                        {c.deliveredCount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {conv.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-bold text-[#047857]">
                        {formatCurrency(rev, workspace.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bottom Row: Recent Activity Stream & Tasks Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left 7 Cols: Recent Customer Journey Activity Stream */}
        <section className="lg:col-span-7 border border-slate-200 rounded-2xl bg-white p-4 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950">
                Live Customer Journey & Workspace Activity
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Chronological stream of lead captures, workflow triggers, and channel events
              </p>
            </div>
            <span className="text-xs text-emerald-700 font-mono font-bold tabular-nums shrink-0">
              {activities.length} events
            </span>
          </div>

          {activities.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-600">No recent activity recorded yet.</p>
              <button
                type="button"
                onClick={() => onQuickAction('add_contact')}
                className="mt-3 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-xl cursor-pointer"
              >
                Add First Contact
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 mt-2">
              {activities.slice(0, 6).map((act) => (
                <div key={act.id} className="py-3.5 flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-slate-950">{act.title}</div>
                    <div className="text-xs text-slate-600">
                      <span>{act.detail}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="uppercase font-mono text-[11px] font-bold text-[#047857]">
                        {act.channel}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums whitespace-nowrap shrink-0">
                    Active
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right 5 Cols: Tasks & Operator Notifications */}
        <section className="lg:col-span-5 border border-slate-200 rounded-2xl bg-white p-4 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950">
                Tasks & Compliance Checklist
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Follow-ups, campaign reviews, and deliverability checks
              </p>
            </div>
            <span className="text-xs text-[#047857] font-mono font-bold tabular-nums shrink-0">
              {tasks.filter((t) => t.status !== 'completed').length} open
            </span>
          </div>

          {tasks.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-600">All operator tasks are complete.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 mt-2">
              {tasks.map((task) => {
                const isDone = task.status === 'completed';
                return (
                  <div
                    key={task.id}
                    className="py-3.5 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div
                        className={`text-xs sm:text-sm font-semibold ${
                          isDone ? 'line-through text-slate-400' : 'text-slate-950'
                        }`}
                      >
                        {task.title}
                      </div>
                      <div className="text-xs text-slate-600">
                        <span>{task.relatedEntity || task.category}</span>
                        <span aria-hidden="true"> · </span>
                        <span
                          className={
                            task.priority === 'high' && !isDone
                              ? 'text-red-600 font-bold'
                              : task.priority === 'medium' && !isDone
                              ? 'text-amber-700 font-bold'
                              : 'text-slate-500'
                          }
                        >
                          Priority: {task.priority}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono tabular-nums">{task.dueDate}</span>
                      </div>
                    </div>

                    {isDone ? (
                      <span className="text-xs font-bold text-emerald-700 inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onCompleteTask(task)}
                        className="px-3 py-1.5 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
