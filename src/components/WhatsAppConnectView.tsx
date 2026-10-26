import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  RefreshCw,
  Send,
  Smartphone,
  Check,
  AlertTriangle,
  ArrowLeft,
  LogOut,
  QrCode,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react';

export interface WhatsAppConnectedStatus {
  connected: boolean;
  number?: string;
  connectedAt?: string;
  qr?: string;
  qrExpiresAt?: number;
}

interface WhatsAppConnectViewProps {
  userId?: string;
  userEmail?: string;
  onBackToDashboard?: () => void;
  onAccountConnected?: (status: WhatsAppConnectedStatus) => void;
  onAccountDisconnected?: () => void;
}

export const WhatsAppConnectView: React.FC<WhatsAppConnectViewProps> = ({
  userId = 'default_workspace',
  userEmail = 'operator@flowpilot.app',
  onBackToDashboard,
  onAccountConnected,
  onAccountDisconnected,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshingQr, setRefreshingQr] = useState<boolean>(false);
  const [status, setStatus] = useState<WhatsAppConnectedStatus>({
    connected: false,
    number: '',
    qr: '',
  });

  // Countdown timer for QR refresh (60 seconds)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [disconnecting, setDisconnecting] = useState<boolean>(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Test Message Form State
  const [testNumber, setTestNumber] = useState<string>('');
  const [testMessage, setTestMessage] = useState<string>(
    'Hello! This is an automated test message from FlowPilot WhatsApp QR.'
  );
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testSuccessNotice, setTestSuccessNotice] = useState<string | null>(null);
  const [testErrorNotice, setTestErrorNotice] = useState<string | null>(null);

  // Polling ref
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch QR & Status from backend with graceful fallback
  const fetchQrAndStatus = async (forceRefresh: boolean = false, retryCount: number = 0) => {
    if (forceRefresh) setRefreshingQr(true);
    try {
      const url = forceRefresh
        ? `/api/whatsapp/qr?userId=${encodeURIComponent(userId)}&refresh=true`
        : `/api/whatsapp/qr?userId=${encodeURIComponent(userId)}`;

      const res = await fetch(url);
      if (!res.ok) {
        // Fallback: check status endpoint in case QR generation is processing in background
        const statusRes = await fetch(`/api/whatsapp/status?userId=${encodeURIComponent(userId)}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.connected) {
            setStatus({
              connected: true,
              number: statusData.number || '',
              connectedAt: statusData.connectedAt || '',
              qr: '',
            });
            setErrorNotice(null);
            return;
          }
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data && data.ok) {
        setStatus({
          connected: Boolean(data.connected),
          number: data.number || '',
          connectedAt: data.connectedAt || '',
          qr: data.qr || '',
          qrExpiresAt: data.qrExpiresAt || 0,
        });

        if (data.connected && onAccountConnected) {
          onAccountConnected(data);
        }
        setSecondsRemaining(60);
        setErrorNotice(null);

        // If the socket is initializing and QR has not arrived yet, poll again in 1.5s
        if (!data.connected && !data.qr && retryCount < 5) {
          setTimeout(() => fetchQrAndStatus(false, retryCount + 1), 1500);
        }
      } else if (data?.error) {
        if (retryCount < 2) {
          setTimeout(() => fetchQrAndStatus(false, retryCount + 1), 2000);
        } else {
          setErrorNotice(data.error);
        }
      }
    } catch (err: any) {
      console.warn('[WhatsApp QR] Failed to fetch session state:', err);
      if (retryCount < 2) {
        // Transient error - retry automatically before alarming user
        setTimeout(() => fetchQrAndStatus(false, retryCount + 1), 2000);
      } else {
        setErrorNotice('Unable to reach WhatsApp QR backend. Retrying...');
      }
    } finally {
      setLoading(false);
      setRefreshingQr(false);
    }
  };

  // 2. Poll status to detect when user scans the QR on their phone
  const checkStatusOnly = async () => {
    try {
      const res = await fetch(`/api/whatsapp/status?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.connected && !status.connected) {
          setStatus((prev) => ({
            ...prev,
            connected: true,
            number: data.number || prev.number,
            connectedAt: data.connectedAt || new Date().toISOString(),
            qr: '',
          }));
          if (onAccountConnected) {
            onAccountConnected(data);
          }
        } else if (!data.connected && status.connected) {
          setStatus((prev) => ({
            ...prev,
            connected: false,
          }));
        }
      }
    } catch {
      // Ignore background poll errors
    }
  };

  // Initial load
  useEffect(() => {
    fetchQrAndStatus(false);
  }, [userId]);

  // Periodic poll while awaiting scan
  useEffect(() => {
    if (status.connected) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    pollingRef.current = setInterval(() => {
      checkStatusOnly();
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [status.connected, userId]);

  // Countdown timer for QR expiration (auto-refresh every 60s)
  useEffect(() => {
    if (status.connected) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          fetchQrAndStatus(true);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status.connected]);

  // Disconnect handler
  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect this WhatsApp account? Automated workflows will be paused.')) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setStatus({
          connected: false,
          number: '',
          qr: '',
        });
        if (onAccountDisconnected) onAccountDisconnected();
        fetchQrAndStatus(true);
      }
    } catch (err: any) {
      alert(`Failed to disconnect: ${err.message || 'Server error'}`);
    } finally {
      setDisconnecting(false);
    }
  };

  // Test Message Sender
  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testNumber.trim()) {
      setTestErrorNotice('Please enter a destination phone number.');
      return;
    }
    if (!testMessage.trim()) {
      setTestErrorNotice('Please enter a message body.');
      return;
    }

    setIsSendingTest(true);
    setTestSuccessNotice(null);
    setTestErrorNotice(null);

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          to: testNumber.trim(),
          message: testMessage.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setTestSuccessNotice(`Message sent successfully to +${data.to}! (ID: ${data.messageId})`);
        setTestErrorNotice(null);
      } else {
        setTestErrorNotice(data.error || 'Failed to send test message.');
      }
    } catch (err: any) {
      setTestErrorNotice(err.message || 'Network error connecting to Baileys send endpoint.');
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Banner Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="p-1.5 -ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <MessageSquare className="w-6 h-6" />
              </span>
              Connect Your WhatsApp (Normal Business)
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Link your personal or business WhatsApp in seconds via native QR Code. Zero Facebook verification or tokens required.
          </p>
        </div>

        {status.connected && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Automation Active
          </span>
        )}
      </div>

      {errorNotice && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Connection Notice</p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">{errorNotice}</p>
          </div>
          <button
            onClick={() => fetchQrAndStatus(true)}
            className="text-xs font-semibold underline hover:text-amber-950 dark:hover:text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CARD 1: STATUS & QR SCANNER                                          */}
      {/* ==================================================================== */}
      <div className="bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${status.connected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'}`}>
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                WhatsApp Connection Status
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {status.connected
                  ? 'Your mobile device is actively paired with FlowPilot automation'
                  : 'Scan the live QR code with your phone to link your WhatsApp'}
              </p>
            </div>
          </div>

          {!status.connected && (
            <button
              onClick={() => fetchQrAndStatus(true)}
              disabled={refreshingQr}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingQr ? 'animate-spin text-blue-600' : ''}`} />
              Refresh QR
            </button>
          )}
        </div>

        <div className="p-6 sm:p-8">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Starting Baileys WhatsApp engine...
              </p>
            </div>
          ) : status.connected ? (
            /* CONNECTED VIEW */
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 text-center sm:text-left">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Connected as +{status.number} ✅ Automation Active
                    </h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 flex items-center gap-2 justify-center sm:justify-start">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Session authenticated and persistent across server restarts
                    </p>
                    {status.connectedAt && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 justify-center sm:justify-start">
                        <Clock className="w-3 h-3" />
                        Linked on {new Date(status.connectedAt).toLocaleDateString()} at {new Date(status.connectedAt).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {disconnecting ? 'Disconnecting...' : 'Disconnect WhatsApp'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Channel Mode</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">Baileys Native Socket</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Multi-tenant session</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Auto-Number Format</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">0 → 234 Normalization</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Automated international JID</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Workflow Triggers</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">Day 1, 3, 5 Active</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Live background scheduler</p>
                </div>
              </div>
            </div>
          ) : (
            /* NOT CONNECTED: QR SCANNER */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* QR Image Box */}
              <div className="lg:col-span-5 flex flex-col items-center text-center">
                <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 shadow-md inline-block relative group">
                  {status.qr ? (
                    <img
                      src={status.qr}
                      alt="WhatsApp QR Code"
                      className="w-64 h-64 sm:w-72 sm:h-72 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-64 h-64 sm:w-72 sm:h-72 flex flex-col items-center justify-center space-y-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg">
                      <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                      <p className="text-xs text-slate-500">Generating live QR code...</p>
                    </div>
                  )}

                  {refreshingQr && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center rounded-2xl">
                      <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-pulse" />
                  <span>QR refreshes in <strong className="text-blue-600 dark:text-blue-400 font-mono">{secondsRemaining}s</strong></span>
                </div>
              </div>

              {/* Instructions Box */}
              <div className="lg:col-span-7 space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-emerald-600" />
                    Scan with WhatsApp on Your Phone
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Follow these 4 simple steps to connect in 10 seconds:
                  </p>
                </div>

                <ol className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">Open WhatsApp on phone</p>
                      <p className="text-xs text-slate-500">Works with standard WhatsApp or WhatsApp Business.</p>
                    </div>
                  </li>

                  <li className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">Settings &gt; Linked Devices</p>
                      <p className="text-xs text-slate-500">On Android tap 3 dots (top right) &gt; Linked devices. On iPhone tap Settings (bottom right) &gt; Linked Devices.</p>
                    </div>
                  </li>

                  <li className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">Link a Device</p>
                      <p className="text-xs text-slate-500">Tap the green "Link a device" button and unlock phone if prompted.</p>
                    </div>
                  </li>

                  <li className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">Scan this QR Code</p>
                      <p className="text-xs text-slate-500">Point your camera at the QR code on the left. The screen will automatically refresh once linked.</p>
                    </div>
                  </li>
                </ol>

                <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 flex items-center gap-2.5 text-xs text-blue-700 dark:text-blue-300">
                  <Sparkles className="w-4 h-4 shrink-0 text-blue-600" />
                  <span>No credit card, no business registration, and zero API approvals needed.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* CARD 2: TEST MESSAGE DISPATCH                                        */}
      {/* ==================================================================== */}
      <div className="bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Send Test WhatsApp Message
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verify your connected socket by sending a live message to any phone number
            </p>
          </div>
        </div>

        {testSuccessNotice && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-xs font-semibold">{testSuccessNotice}</p>
          </div>
        )}

        {testErrorNotice && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <p className="text-xs font-semibold">{testErrorNotice}</p>
          </div>
        )}

        <form onSubmit={handleSendTestMessage} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Enter Destination Phone Number
            </label>
            <input
              type="text"
              placeholder="e.g. 08012345678 or +234 801 234 5678"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Automatic normalization: Numbers starting with <code>0</code> will be automatically converted to <code>234</code>.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Enter Test Message Body
            </label>
            <textarea
              rows={3}
              placeholder="Enter message text..."
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              Sends immediately using your live linked WhatsApp device.
            </span>

            <button
              type="submit"
              disabled={isSendingTest || !status.connected}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className={`w-4 h-4 ${isSendingTest ? 'animate-pulse' : ''}`} />
              {isSendingTest ? 'Sending...' : 'Send Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
