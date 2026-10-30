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
  ShieldCheck,
  Clock,
  Sparkles,
  Copy,
} from 'lucide-react';

export interface WhatsAppConnectedStatus {
  connected: boolean;
  number?: string;
  connectedAt?: string;
  pairingCode?: string;
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
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [pairingCode, setPairingCode] = useState<string>('');
  const [isLoadingCode, setIsLoadingCode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [status, setStatus] = useState<WhatsAppConnectedStatus>({
    connected: false,
    number: '',
  });

  // Countdown timer for pairing code (60 seconds)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [disconnecting, setDisconnecting] = useState<boolean>(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Test Message Form State
  const [testNumber, setTestNumber] = useState<string>('');
  const [testMessage, setTestMessage] = useState<string>(
    'Hello! This is an automated test message from FlowPilot WhatsApp Pairing.'
  );
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testSuccessNotice, setTestSuccessNotice] = useState<string | null>(null);
  const [testErrorNotice, setTestErrorNotice] = useState<string | null>(null);

  // Polling ref for connection status
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch connection status from backend
  const checkStatus = async () => {
    try {
      const res = await fetch(`/api/whatsapp/status?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.connected && !status.connected) {
          const newStatus = {
            connected: true,
            number: data.phoneNumber || data.number || phoneNumber,
            connectedAt: data.updatedAt || new Date().toISOString(),
          };
          setStatus(newStatus);
          setPairingCode('');
          setTimerActive(false);
          setErrorNotice(null);
          if (onAccountConnected) {
            onAccountConnected(newStatus);
          }
        } else if (!data.connected && status.connected) {
          setStatus({
            connected: false,
            number: '',
          });
        }
      }
    } catch {
      // background poll silently
    }
  };

  useEffect(() => {
    checkStatus();
    pollingRef.current = setInterval(checkStatus, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [userId, phoneNumber, status.connected]);

  // Countdown timer for pairing code expiration
  useEffect(() => {
    if (!timerActive || secondsRemaining <= 0) {
      if (secondsRemaining <= 0) {
        setTimerActive(false);
      }
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timerActive, secondsRemaining]);

  // Request 8-digit pairing code from Baileys
  const handleGetPairingCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const clean = phoneNumber.replace(/[^0-9]/g, '');
    if (!clean || clean.length < 8) {
      setErrorNotice('Please enter a valid phone number with country code (e.g. 2348012345678).');
      return;
    }

    setIsLoadingCode(true);
    setErrorNotice(null);
    setCopied(false);

    try {
      const res = await fetch('/api/whatsapp/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          phoneNumber: clean,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to request pairing code.');
      }

      if (data.connected) {
        const newStatus = {
          connected: true,
          number: data.phoneNumber || clean,
          connectedAt: new Date().toISOString(),
        };
        setStatus(newStatus);
        setPairingCode('');
        if (onAccountConnected) onAccountConnected(newStatus);
        return;
      }

      setPairingCode(data.pairingCode);
      setSecondsRemaining(60);
      setTimerActive(true);
    } catch (err: any) {
      setErrorNotice(err.message || 'Error generating pairing code. Please check the phone number.');
    } finally {
      setIsLoadingCode(false);
    }
  };

  const handleCopyCode = async () => {
    if (!pairingCode) return;
    try {
      await navigator.clipboard.writeText(pairingCode.replace('-', ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
    }
  };

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
        });
        setPairingCode('');
        setTimerActive(false);
        if (onAccountDisconnected) {
          onAccountDisconnected();
        }
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to disconnect session.');
    } finally {
      setDisconnecting(false);
    }
  };

  // Send Test Message
  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testNumber.trim() || !testMessage.trim()) {
      setTestErrorNotice('Please provide recipient phone number and message.');
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
                <Smartphone className="w-6 h-6" />
              </span>
              Connect WhatsApp with Phone Number
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Link your phone with an 8-digit pairing code. 100% reliable on Vercel serverless without QR timeouts.
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
            <p className="font-semibold">Notice</p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">{errorNotice}</p>
          </div>
          <button
            onClick={() => setErrorNotice(null)}
            className="text-xs font-semibold underline hover:text-amber-950 dark:hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Connection Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {status.connected ? (
          /* CONNECTED STATE */
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Connected as +{status.number} ✅ Automation Active
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 flex items-center gap-2 justify-center sm:justify-start">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Session authenticated and stored in Firebase Firestore
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
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Connection Method</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">8-Digit Pairing Code</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Vercel serverless verified</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Session Storage</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">Firebase Firestore</p>
                <p className="text-[11px] text-slate-500 mt-0.5">whatsapp_sessions/{userId}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Workflow Triggers</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">Auto-Responders Active</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Inbound listener enabled</p>
              </div>
            </div>

            {/* Test Send Message Form */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Send Test WhatsApp Message
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Verify message delivery through your connected WhatsApp number.
              </p>

              {testSuccessNotice && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{testSuccessNotice}</span>
                </div>
              )}

              {testErrorNotice && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{testErrorNotice}</span>
                </div>
              )}

              <form onSubmit={handleSendTestMessage} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Recipient WhatsApp Number
                    </label>
                    <input
                      type="text"
                      value={testNumber}
                      onChange={(e) => setTestNumber(e.target.value)}
                      placeholder="e.g. 2348012345678"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Message Content
                    </label>
                    <input
                      type="text"
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      placeholder="Enter test message..."
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSendingTest ? 'Sending via Baileys...' : 'Send Live Test Message'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* NOT CONNECTED: PAIRING CODE GENERATOR */
          <div className="p-6 sm:p-8 space-y-8">
            {/* Input Phone Form */}
            <div className="max-w-xl">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                Your WhatsApp Phone Number (with country code, no + or spaces)
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="2348012345678"
                  className="flex-1 px-4 py-3 text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  disabled={isLoadingCode}
                />
                <button
                  onClick={handleGetPairingCode}
                  disabled={isLoadingCode || !phoneNumber.trim()}
                  className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
                >
                  {isLoadingCode ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Generating Code...
                    </>
                  ) : (
                    'Get Pairing Code'
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Example: For Nigeria (+234) enter <code>2348012345678</code>. For US (+1) enter <code>12345678901</code>.
              </p>
            </div>

            {/* BIG BOLD 8-DIGIT PAIRING CODE DISPLAY */}
            {pairingCode && (
              <div className="p-6 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 text-center space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Your WhatsApp Pairing Code
                </p>

                <div className="inline-flex items-center justify-center gap-3">
                  <div className="text-4xl sm:text-5xl font-mono font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-950 px-6 py-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-sm select-all">
                    {pairingCode}
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800 transition"
                    title="Copy code"
                  >
                    {copied ? (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Copied!</span>
                    ) : (
                      <Copy className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                  {secondsRemaining > 0 ? (
                    <span>Code expires in <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{secondsRemaining}s</strong></span>
                  ) : (
                    <span className="text-rose-500 font-medium">Code expired</span>
                  )}
                  <button
                    onClick={() => handleGetPairingCode()}
                    disabled={isLoadingCode}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 underline hover:text-emerald-700 ml-1"
                  >
                    Resend Code
                  </button>
                </div>

                <div className="pt-2 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Waiting for you to enter the code on WhatsApp...</span>
                </div>
              </div>
            )}

            {/* Step-by-Step Instructions */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                How to Link with Phone Number:
              </h3>
              <ol className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-3 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                    1
                  </span>
                  <span className="pt-0.5">Open <strong>WhatsApp</strong> on your phone.</span>
                </li>
                <li className="flex items-start gap-3 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                    2
                  </span>
                  <span className="pt-0.5">Go to <strong>Settings</strong> &gt; <strong>Linked Devices</strong>.</span>
                </li>
                <li className="flex items-start gap-3 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                    3
                  </span>
                  <span className="pt-0.5">Tap <strong>Link a Device</strong> &gt; <strong>Link with phone number instead</strong>.</span>
                </li>
                <li className="flex items-start gap-3 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                    4
                  </span>
                  <span className="pt-0.5">Enter the <strong>8-digit code</strong> above into your phone.</span>
                </li>
              </ol>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Why Pairing Code replaces QR on Vercel:</p>
                <p>
                  On Vercel serverless deployments, WebSocket connections cannot remain open across requests to show a live scanning camera stream. Pairing codes generate cleanly via HTTP request, are typed on the mobile app, and WhatsApp instantly authorizes the Firestore session.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
