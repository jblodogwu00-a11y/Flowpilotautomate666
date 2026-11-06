import React, { useState, useEffect, useMemo } from 'react';
import {
  Radio,
  Copy,
  Check,
  RefreshCw,
  Play,
  RotateCcw,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Eye,
  EyeOff,
  Code2,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Terminal,
  Activity,
  Layers,
  Search,
  Filter,
  Send,
  X,
  FileCode,
  Zap,
} from 'lucide-react';
import { Automation } from '../types';

export interface WebhookLogItem {
  id: string;
  timestamp: string;
  source: string;
  event: string;
  status: number;
  latencyMs: number;
  method: string;
  ip: string;
  userAgent: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: any;
  parsedFields: {
    fullName?: string;
    email?: string;
    phone?: string;
    company?: string;
    amount?: number;
    tags?: string[];
    stage?: string;
    listName?: string;
  };
  actionTaken: string;
  isSimulated?: boolean;
}

export interface WebhookMappingConfig {
  emailPath: string;
  namePath: string;
  phonePath: string;
  companyPath: string;
  amountPath: string;
  tagsPath: string;
  targetList: string;
  autoTriggerWorkflowId?: string;
}

interface WebhookGatewayViewProps {
  automations?: Automation[];
  onBack?: () => void;
  onNavigateToAutomations?: () => void;
}

type GatewaySubTab = 'logs' | 'simulator' | 'mapper' | 'docs';

const PRESET_PAYLOADS: Record<string, { label: string; icon: string; payload: any }> = {
  stripe: {
    label: 'Stripe (Payment Success)',
    icon: '💳',
    payload: {
      id: 'evt_3MtwLwLkdIwHu7ix28a3tqPa',
      object: 'event',
      type: 'payment_intent.succeeded',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'pi_3MtwLwLkdIwHu7ix28a3tqPa',
          amount: 9900,
          currency: 'usd',
          amount_received: 9900,
          customer_details: {
            name: 'Alex Johnson',
            email: 'alex.johnson@example.com',
            phone: '+14155552671',
          },
          status: 'succeeded',
        },
      },
    },
  },
  shopify: {
    label: 'Shopify (New Order)',
    icon: '🛍️',
    payload: {
      id: 820982911946154500,
      order_number: 1042,
      total_price: '149.00',
      currency: 'USD',
      financial_status: 'paid',
      customer: {
        first_name: 'Sophia',
        last_name: 'Miller',
        email: 'sophia.miller@shopifycustomer.com',
        phone: '+16505550198',
        company: 'Miller Design Studio',
      },
      line_items: [
        { title: 'FlowPilot Automation Pro Bundle', quantity: 1, price: '149.00' },
      ],
    },
  },
  zapier: {
    label: 'Zapier / Make (New Lead)',
    icon: '⚡',
    payload: {
      event: 'lead.created',
      source: 'Facebook Lead Ads',
      fullName: 'Marcus Vance',
      email: 'marcus.vance@agencygrow.io',
      phone: '+447911123456',
      company: 'Vance Growth Partners',
      tags: ['Facebook_Ads', 'High_Intent'],
      amount: 450,
    },
  },
  typeform: {
    label: 'Typeform (Form Submission)',
    icon: '📝',
    payload: {
      event_id: '01HBK882710Z',
      event_type: 'form_response',
      form_response: {
        form_id: 'FLOWPILOT01',
        submitted_at: new Date().toISOString(),
        answers: [
          { type: 'text', text: 'Daniel Rivera', field: { id: 'name' } },
          { type: 'email', email: 'daniel.rivera@enterprisecorp.com', field: { id: 'email' } },
          { type: 'phone_number', phone_number: '+13125550143', field: { id: 'phone' } },
        ],
      },
    },
  },
  custom: {
    label: 'Custom Inbound JSON',
    icon: '⚙️',
    payload: {
      event: 'custom.event_signup',
      email: 'founder@nextgen.co',
      name: 'Elena Rostova',
      phone: '+12125550199',
      company: 'NextGen Ventures',
      amount: 299,
      tags: ['VIP_Beta', 'SaaS_Owner'],
    },
  },
};

export const WebhookGatewayView: React.FC<WebhookGatewayViewProps> = ({
  automations = [],
  onBack,
  onNavigateToAutomations,
}) => {
  const [activeTab, setActiveTab] = useState<GatewaySubTab>('logs');

  // Gateway credentials & state
  const [token, setToken] = useState<string>('flowpilot_sec_7x9q2m1k8p4w');
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [logs, setLogs] = useState<WebhookLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(true);
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Field mapper state
  const [mappings, setMappings] = useState<WebhookMappingConfig>({
    emailPath: 'email',
    namePath: 'name',
    phonePath: 'phone',
    companyPath: 'company',
    amountPath: 'amount',
    tagsPath: 'tags',
    targetList: 'General Contacts',
    autoTriggerWorkflowId: '',
  });
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [configBanner, setConfigBanner] = useState<string | null>(null);

  // Simulator state
  const [selectedPreset, setSelectedPreset] = useState<string>('stripe');
  const [simulatorJson, setSimulatorJson] = useState<string>(
    JSON.stringify(PRESET_PAYLOADS.stripe.payload, null, 2)
  );
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

  // Inspector Drawer
  const [inspectingLog, setInspectingLog] = useState<WebhookLogItem | null>(null);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replaySuccess, setReplaySuccess] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | '200' | '400'>('all');

  // Derive origin & production URL
  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://flowpilot.app';
  const webhookEndpointUrl = `${originUrl}/api/webhook/gateway?token=${token}`;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  // Fetch logs & config
  const fetchGatewayData = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/webhook/gateway/logs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setLogs(data.logs);
        }
        if (data.config) {
          if (data.config.token) setToken(data.config.token);
          if (data.config.isEnabled !== undefined) setIsEnabled(data.config.isEnabled);
          if (data.config.mappings) setMappings((prev) => ({ ...prev, ...data.config.mappings }));
        }
      }
    } catch (err) {
      console.warn('[Webhook Gateway] Error fetching logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchGatewayData();
    const interval = setInterval(fetchGatewayData, 10000); // 10s polling for live logs
    return () => clearInterval(interval);
  }, []);

  // Update preset JSON
  const handleSelectPreset = (key: string) => {
    setSelectedPreset(key);
    if (PRESET_PAYLOADS[key]) {
      setSimulatorJson(JSON.stringify(PRESET_PAYLOADS[key].payload, null, 2));
      setSimulationResult(null);
    }
  };

  // Dispatch Simulator test
  const handleRunSimulator = async () => {
    setIsSimulating(true);
    setSimulationResult(null);
    try {
      let parsedBody: any;
      try {
        parsedBody = JSON.parse(simulatorJson);
      } catch {
        alert('Invalid JSON syntax in simulator payload editor.');
        setIsSimulating(false);
        return;
      }

      const res = await fetch('/api/webhook/gateway/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: parsedBody,
          preset: selectedPreset,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to simulate webhook');
      }

      setSimulationResult(data);
      // Prepend to logs
      if (data.log) {
        setLogs((prev) => [data.log, ...prev].slice(0, 100));
      }
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  // Replay a recorded log
  const handleReplayLog = async (logId: string) => {
    setIsReplaying(true);
    setReplaySuccess(null);
    try {
      const res = await fetch(`/api/webhook/gateway/replay/${logId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to replay webhook');
      }
      setReplaySuccess(`Successfully replayed payload! Result ID: ${data.newLogId || 'ok'}`);
      await fetchGatewayData();
      setTimeout(() => setReplaySuccess(null), 4000);
    } catch (err: any) {
      alert(`Replay error: ${err.message}`);
    } finally {
      setIsReplaying(false);
    }
  };

  // Clear all logs
  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all webhook request history?')) return;
    try {
      await fetch('/api/webhook/gateway/logs', { method: 'DELETE' });
      setLogs([]);
      setInspectingLog(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Regenerate secret token
  const handleRegenerateToken = async () => {
    if (!confirm('Regenerating this secret token will require updating your webhook settings in Stripe, Zapier, etc. Proceed?')) return;
    try {
      const res = await fetch('/api/webhook/gateway/token', { method: 'POST' });
      const data = await res.json();
      if (data.ok && data.token) {
        setToken(data.token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Field Mappings
  const handleSaveMappings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setConfigBanner(null);
    try {
      const res = await fetch('/api/webhook/gateway/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings, isEnabled }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to save mappings');
      }
      setConfigBanner('Field mappings and trigger preferences successfully updated!');
      setTimeout(() => setConfigBanner(null), 4000);
    } catch (err: any) {
      alert(`Error saving mappings: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === '200'
          ? log.status >= 200 && log.status < 300
          : log.status >= 400;

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        log.source.toLowerCase().includes(q) ||
        log.event.toLowerCase().includes(q) ||
        log.parsedFields.email?.toLowerCase().includes(q) ||
        log.parsedFields.fullName?.toLowerCase().includes(q) ||
        log.id.toLowerCase().includes(q);

      return matchStatus && matchSearch;
    });
  }, [logs, searchQuery, statusFilter]);

  // Generated cURL Command Snippet
  const curlSnippet = `curl -X POST "${originUrl}/api/webhook/gateway" \\
  -H "Content-Type: application/json" \\
  -H "X-FlowPilot-Secret: ${token}" \\
  -d '{"event":"customer.created","email":"lead@example.com","name":"Taylor Swift","amount":120}'`;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 animate-in fade-in duration-300">
      {/* ------------------------------------------------------------------ */}
      {/* TOP HEADER & BREADCRUMB */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="hover:text-blue-600 transition-colors cursor-pointer"
              >
                Dashboard
              </button>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-blue-600 font-semibold">Integrations</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500 font-medium">Universal Inbound Webhook Gateway</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Radio className="w-6 h-6 text-[#2563EB]" />
            <span>Universal Inbound Webhook Gateway</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Accept real-time payloads from Stripe, Shopify, Zapier, Make, Typeform, or custom cURL
            calls. Map incoming fields to CRM contacts and trigger marketing sequences instantly.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchGatewayData}
            disabled={isLoadingLogs}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-[#0D1322] hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg shadow-xs shadow-blue-500/20 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Test In Sandbox</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* GATEWAY CREDENTIALS & CONNECTION HUB */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 8 Cols: Webhook Endpoint URL & Authentication */}
        <div className="lg:col-span-8 p-5 sm:p-6 rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-600">
                Live Ingestion Endpoint
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                Your Unique Production Webhook URL
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
                {isEnabled ? 'Active & Listening' : 'Gateway Paused'}
              </span>
            </div>
          </div>

          {/* URL Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Webhook URL (with auto-embedded token):
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#090D16] border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 truncate select-all">
                {webhookEndpointUrl}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(webhookEndpointUrl, 'url')}
                className="px-3.5 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copiedKey === 'url' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'url' ? 'Copied!' : 'Copy URL'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Paste this URL into your Stripe Dashboard, Shopify Webhooks, Zapier Webhook trigger, or Typeform webhook setting.
            </p>
          </div>

          {/* Secret Token & cURL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090D16] border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Secret Token (X-FlowPilot-Secret)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowSecret((p) => !p)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title={showSecret ? 'Hide Secret' : 'Show Secret'}
                  >
                    {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(token, 'token')}
                    className="p-1 text-slate-400 hover:text-blue-600"
                    title="Copy Token"
                  >
                    {copiedKey === 'token' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white truncate">
                {showSecret ? token : '••••••••••••••••••••••••••••'}
              </div>
              <div className="pt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleRegenerateToken}
                  className="text-[10px] text-blue-600 hover:underline font-medium cursor-pointer"
                >
                  Regenerate Token
                </button>
                <span className="text-[10px] text-slate-400">Permanent Token</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090D16] border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Terminal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Terminal cURL Command</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(curlSnippet, 'curl')}
                  className="p-1 text-slate-400 hover:text-blue-600"
                  title="Copy cURL Command"
                >
                  {copiedKey === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate">
                curl -X POST "{originUrl}/api/webhook/gateway" ...
              </div>
              <div className="pt-1">
                <span className="text-[10px] text-emerald-600 font-medium">Ready for command-line testing</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Telemetry & Activity KPI */}
        <div className="lg:col-span-4 p-5 sm:p-6 rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
              Gateway Metrics
            </span>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090D16] border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500">Total Inbound</span>
                <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5 tabular-nums">
                  {logs.length}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090D16] border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500">Success Rate</span>
                <div className="text-xl font-bold tracking-tight text-emerald-600 mt-0.5 tabular-nums">
                  {logs.length > 0
                    ? `${Math.round((logs.filter((l) => l.status < 400).length / logs.length) * 100)}%`
                    : '100%'}
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <p className="flex items-center justify-between">
                <span>Avg Latency:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {logs.length > 0
                    ? `${Math.round(logs.reduce((s, l) => s + l.latencyMs, 0) / logs.length)} ms`
                    : '8 ms'}
                </span>
              </p>
              <p className="flex items-center justify-between">
                <span>Auto-Contact Sync:</span>
                <span className="font-semibold text-emerald-600">Active (Instant)</span>
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500">Authentication:</span>
            <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
              Bearer / X-Header / Query
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SECONDARY VIEW TABS */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'logs'
              ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/40 dark:bg-blue-950/20'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Request Inspector ({logs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'simulator'
              ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/40 dark:bg-blue-950/20'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Interactive Sandbox Simulator</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('mapper')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'mapper'
              ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/40 dark:bg-blue-950/20'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>JSON Field Mapper & Triggers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('docs')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'docs'
              ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/40 dark:bg-blue-950/20'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Setup Guides (Stripe / Shopify / Zapier)</span>
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB 1: LIVE REQUEST INSPECTOR */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by source, email, or event type..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="200">200 OK Only</option>
                <option value="400">Errors (4xx)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear History</span>
                </button>
              )}
            </div>
          </div>

          {/* Logs Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#0D1322] overflow-hidden shadow-xs">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mx-auto">
                  <Radio className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  No Inbound Webhook Requests Yet
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  The gateway is waiting for incoming POST requests. Use our interactive simulator or send a test payload via cURL.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('simulator')}
                  className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Open Sandbox Simulator</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs divide-y divide-slate-100 dark:divide-slate-800">
                  <thead className="bg-slate-50/80 dark:bg-[#090D16]/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Status & Method</th>
                      <th className="py-3 px-4">Event & Source</th>
                      <th className="py-3 px-4">Extracted Contact</th>
                      <th className="py-3 px-4">Latency</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                    {filteredLogs.map((log) => {
                      const isOk = log.status >= 200 && log.status < 300;
                      return (
                        <tr
                          key={log.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isOk ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                              <span
                                className={`font-mono font-bold text-xs ${
                                  isOk ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'
                                }`}
                              >
                                {log.status}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                {log.method}
                              </span>
                              {log.isSimulated && (
                                <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-1 rounded">
                                  SIM
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 min-w-[180px]">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {log.event}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span>{log.source}</span>
                              <span>·</span>
                              <span className="font-mono text-[10px]">{log.ip}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 min-w-[200px]">
                            {log.parsedFields.email || log.parsedFields.fullName ? (
                              <div>
                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                  {log.parsedFields.fullName || 'Lead'}
                                </div>
                                <div className="font-mono text-[11px] text-slate-500 truncate">
                                  {log.parsedFields.email || log.parsedFields.phone}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">No contact extracted</span>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                            {log.latencyMs} ms
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                            {new Date(log.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleReplayLog(log.id)}
                                disabled={isReplaying}
                                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-blue-600 transition-colors"
                                title="Replay this payload"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setInspectingLog(log)}
                                className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-300 hover:text-blue-600 text-xs font-semibold transition-colors"
                              >
                                Inspect
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

      {/* ------------------------------------------------------------------ */}
      {/* TAB 2: INTERACTIVE SANDBOX SIMULATOR */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left 7 Cols: Payload Code Editor */}
          <div className="lg:col-span-7 p-5 sm:p-6 rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-600">
                  Testing Console
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Dispatch Simulated Webhook Payload
                </h3>
              </div>
              <button
                type="button"
                onClick={handleRunSimulator}
                disabled={isSimulating}
                className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs shadow-blue-500/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSimulating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isSimulating ? 'Dispatching...' : 'Dispatch Simulation'}</span>
              </button>
            </div>

            {/* Template Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Choose a Platform Preset:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(PRESET_PAYLOADS).map(([key, item]) => {
                  const isSel = selectedPreset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectPreset(key)}
                      className={`p-2.5 rounded-lg border text-left text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                        isSel
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-[#2563EB] text-[#2563EB] shadow-xs'
                          : 'bg-slate-50 dark:bg-[#090D16] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* JSON Code Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono">Request Body (application/json)</span>
                <span className="text-[11px]">Edit payload values directly</span>
              </div>
              <textarea
                value={simulatorJson}
                onChange={(e) => setSimulatorJson(e.target.value)}
                rows={14}
                className="w-full p-3 rounded-lg bg-[#0F172A] text-slate-200 font-mono text-xs border border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed resize-y"
              />
            </div>
          </div>

          {/* Right 5 Cols: Trace & Execution Output */}
          <div className="lg:col-span-5 p-5 sm:p-6 rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
              Execution Output & Parser Trace
            </span>

            {simulationResult ? (
              <div className="space-y-4 animate-in fade-in">
                <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      Webhook Processed (HTTP 200 OK)
                    </h4>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                      {simulationResult.message}
                    </p>
                  </div>
                </div>

                {/* Extracted Fields Summary */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Parsed Contact Record
                  </span>
                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#090D16] border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Full Name:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {simulationResult.extracted?.fullName || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Email:</span>
                      <span className="font-mono font-semibold text-blue-600">
                        {simulationResult.extracted?.email || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phone:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {simulationResult.extracted?.phone || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">LTV / Deal Value:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        ${simulationResult.extracted?.amount || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Audience List:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {simulationResult.extracted?.listName || 'General Contacts'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500">Tags Applied:</span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {(simulationResult.extracted?.tags || []).map((t: string) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-[10px]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500">
                  Contact synced to FlowPilot CRM directory. Check the "Live Request Inspector" tab to see the logged event.
                </div>
              </div>
            ) : (
              <div className="p-8 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                <Code2 className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Select a template and click <strong>"Dispatch Simulation"</strong> to inspect how FlowPilot extracts contact data and calculates deal value.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 3: FIELD MAPPER & TRIGGERS */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'mapper' && (
        <form onSubmit={handleSaveMappings} className="max-w-4xl space-y-6">
          {configBanner && (
            <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{configBanner}</span>
            </div>
          )}

          <div className="p-6 rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-600">
                JSON Path Extractor
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                Map Incoming Payload Keys to CRM Fields
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Enter dot-notation paths (e.g. <code>customer.email</code> or <code>data.object.amount</code>). FlowPilot will automatically fall back to standard heuristics if these fields are absent.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email Path *
                </label>
                <input
                  type="text"
                  value={mappings.emailPath}
                  onChange={(e) => setMappings({ ...mappings, emailPath: e.target.value })}
                  placeholder="e.g. email or customer.email"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090D16] font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name Path
                </label>
                <input
                  type="text"
                  value={mappings.namePath}
                  onChange={(e) => setMappings({ ...mappings, namePath: e.target.value })}
                  placeholder="e.g. name or customer.name"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090D16] font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Phone / WhatsApp Path
                </label>
                <input
                  type="text"
                  value={mappings.phonePath}
                  onChange={(e) => setMappings({ ...mappings, phonePath: e.target.value })}
                  placeholder="e.g. phone or customer.phone"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090D16] font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Deal Amount / LTV Path
                </label>
                <input
                  type="text"
                  value={mappings.amountPath}
                  onChange={(e) => setMappings({ ...mappings, amountPath: e.target.value })}
                  placeholder="e.g. amount or total_price"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090D16] font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Default Target Audience List
                </label>
                <input
                  type="text"
                  value={mappings.targetList}
                  onChange={(e) => setMappings({ ...mappings, targetList: e.target.value })}
                  placeholder="General Contacts"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090D16] text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Auto-Trigger Workflow Sequence
                </label>
                <select
                  value={mappings.autoTriggerWorkflowId || ''}
                  onChange={(e) => setMappings({ ...mappings, autoTriggerWorkflowId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090D16] text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">None (Log & Sync Contact Only)</option>
                  {automations.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Gateway Enabled (Accept Inbound Requests)
                </span>
              </label>

              <button
                type="submit"
                disabled={isSavingConfig}
                className="px-5 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs shadow-blue-500/20 transition-colors cursor-pointer"
              >
                {isSavingConfig ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 4: SETUP GUIDES & DOCS */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'docs' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💳</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Stripe Setup</h3>
            </div>
            <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside leading-relaxed">
              <li>Open your <strong>Stripe Dashboard &gt; Developers &gt; Webhooks</strong>.</li>
              <li>Click <strong>Add Endpoint</strong>.</li>
              <li>Paste your FlowPilot URL: <code>{webhookEndpointUrl}</code></li>
              <li>Select events: <code>payment_intent.succeeded</code>, <code>charge.succeeded</code>.</li>
              <li>Save. FlowPilot will automatically record the buyer as a customer.</li>
            </ol>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Zapier / Make Setup</h3>
            </div>
            <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside leading-relaxed">
              <li>Create a new Zap or Scenario.</li>
              <li>Add an action: <strong>Webhooks by Zapier &gt; POST</strong>.</li>
              <li>Set URL to your FlowPilot Webhook URL.</li>
              <li>Payload Type: <strong>JSON</strong>.</li>
              <li>Include keys for <code>email</code>, <code>name</code>, and <code>tags</code>.</li>
            </ol>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛍️</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Shopify Setup</h3>
            </div>
            <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside leading-relaxed">
              <li>Go to <strong>Shopify Admin &gt; Settings &gt; Notifications &gt; Webhooks</strong>.</li>
              <li>Click <strong>Create Webhook</strong>.</li>
              <li>Event: <strong>Order Creation</strong>.</li>
              <li>Format: <strong>JSON</strong>.</li>
              <li>Paste your FlowPilot Webhook URL and save.</li>
            </ol>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* INSPECTOR SLIDE-OVER MODAL / DRAWER */}
      {/* ------------------------------------------------------------------ */}
      {inspectingLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-[#0D1322] h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-[#090D16]/50">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    inspectingLog.status < 300 ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                  HTTP {inspectingLog.status} · {inspectingLog.source}
                </span>
                <span className="text-xs text-slate-400">({inspectingLog.event})</span>
              </div>
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {replaySuccess && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
                  {replaySuccess}
                </div>
              )}

              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090D16] border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500">Request ID</span>
                  <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                    {inspectingLog.id}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090D16] border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500">Processing Time</span>
                  <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {inspectingLog.latencyMs} ms
                  </div>
                </div>
              </div>

              {/* Parsed Fields */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Extracted Contact Data
                </span>
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#090D16] border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <p><span className="text-slate-500">Name:</span> <strong className="text-slate-800 dark:text-slate-200">{inspectingLog.parsedFields.fullName || '—'}</strong></p>
                  <p><span className="text-slate-500">Email:</span> <span className="font-mono text-blue-600">{inspectingLog.parsedFields.email || '—'}</span></p>
                  <p><span className="text-slate-500">Phone:</span> <span className="font-mono text-slate-700 dark:text-slate-300">{inspectingLog.parsedFields.phone || '—'}</span></p>
                  <p><span className="text-slate-500">LTV Value:</span> <strong className="text-emerald-600">${inspectingLog.parsedFields.amount || 0}</strong></p>
                  <p><span className="text-slate-500">Action:</span> <span className="text-slate-700 dark:text-slate-300">{inspectingLog.actionTaken}</span></p>
                </div>
              </div>

              {/* JSON Payload Viewer */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-bold text-slate-900 dark:text-white">Raw Request Body</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(JSON.stringify(inspectingLog.body, null, 2), 'body')}
                    className="text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedKey === 'body' ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-lg bg-[#0F172A] text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed max-h-72 border border-slate-800">
                  {JSON.stringify(inspectingLog.body, null, 2)}
                </pre>
              </div>

              {/* Request Headers */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  HTTP Request Headers
                </span>
                <pre className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#090D16] text-slate-700 dark:text-slate-300 font-mono text-[10px] overflow-x-auto max-h-40 border border-slate-200 dark:border-slate-800">
                  {JSON.stringify(inspectingLog.headers, null, 2)}
                </pre>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-[#090D16]/50">
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => handleReplayLog(inspectingLog.id)}
                disabled={isReplaying}
                className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs shadow-blue-500/20 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isReplaying ? 'animate-spin' : ''}`} />
                <span>{isReplaying ? 'Replaying...' : 'Replay This Payload'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
