import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Zap,
  Phone,
  RefreshCw,
  Send,
  AlertTriangle,
  ArrowLeft,
  Copy,
  Check,
  Lock,
  Sparkles,
} from 'lucide-react';

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

export interface WhatsAppConnectedAccount {
  id: string;
  userId: string;
  phone_number_id: string;
  display_phone_number?: string;
  verified_name?: string;
  waba_id?: string;
  status: 'connected' | 'disconnected';
  connectedAt?: string;
  updatedAt?: string;
}

interface WhatsAppEmbeddedSignupPageProps {
  userId?: string;
  userEmail?: string;
  onBackToDashboard?: () => void;
  onAccountConnected?: (account: WhatsAppConnectedAccount) => void;
}

export const WhatsAppEmbeddedSignupPage: React.FC<WhatsAppEmbeddedSignupPageProps> = ({
  userId = 'admin_user',
  userEmail = 'jonajukej777@gmail.com',
  onBackToDashboard,
  onAccountConnected,
}) => {
  const [metaAppId, setMetaAppId] = useState<string>(
    import.meta.env.VITE_META_APP_ID || '1109730181566504'
  );
  const [sdkLoaded, setSdkLoaded] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [statusLoading, setStatusLoading] = useState<boolean>(true);
  const [account, setAccount] = useState<WhatsAppConnectedAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Manual fallback connect state for testing / iframe resilience
  const [showManualFallback, setShowManualFallback] = useState<boolean>(false);
  const [manualCodeOrToken, setManualCodeOrToken] = useState<string>('');
  const [manualPhoneId, setManualPhoneId] = useState<string>('');
  const [manualWabaId, setManualWabaId] = useState<string>('');

  // Live test dispatch state
  const [testRecipient, setTestRecipient] = useState<string>('');
  const [testMessage, setTestMessage] = useState<string>(
    'Hello! This is a live verification message from FlowPilot WhatsApp Embedded Signup.'
  );
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testReceipt, setTestReceipt] = useState<any>(null);

  // 1. Fetch current status & config from backend
  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/auth/whatsapp/status?userId=${encodeURIComponent(userId)}`, {
        headers: { 'x-user-id': userId },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.appId) {
          setMetaAppId(data.appId);
        }
        if (data.connected && data.account) {
          setAccount(data.account);
        } else {
          setAccount(null);
        }
      }
    } catch (err: any) {
      console.warn('Could not fetch WhatsApp account status:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [userId]);

  // 2. Initialize Facebook JavaScript SDK for Embedded Signup
  useEffect(() => {
    const initializeFacebookSdk = () => {
      if (window.FB) {
        setSdkLoaded(true);
        return;
      }

      window.fbAsyncInit = function () {
        window.FB.init({
          appId: metaAppId,
          cookie: true,
          xfbml: true,
          version: 'v21.0',
        });
        setSdkLoaded(true);
      };

      if (!document.getElementById('facebook-jssdk')) {
        const js = document.createElement('script');
        js.id = 'facebook-jssdk';
        js.src = 'https://connect.facebook.net/en_US/sdk.js';
        js.async = true;
        js.defer = true;
        document.body.appendChild(js);
      }
    };

    initializeFacebookSdk();
  }, [metaAppId]);

  // 3. Listen to Meta window message events (WA_EMBEDDED_SIGNUP)
  useEffect(() => {
    const handleMetaWindowMessage = (event: MessageEvent) => {
      // Validate Meta origin
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      ) {
        return;
      }

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data.type === 'WA_EMBEDDED_SIGNUP') {
          console.log('[Meta Embedded Signup] Event received:', data);
          if (data.event === 'FINISH' && data.data) {
            const { phone_number_id, waba_id } = data.data;
            if (phone_number_id) setManualPhoneId(phone_number_id);
            if (waba_id) setManualWabaId(waba_id);
          }
        }
      } catch {
        // Non-JSON message from other extensions; safely ignore
      }
    };

    window.addEventListener('message', handleMetaWindowMessage);
    return () => window.removeEventListener('message', handleMetaWindowMessage);
  }, []);

  // 4. Send exchanged code / credentials to backend callback
  const submitCallback = async (params: {
    code: string;
    phoneNumberId?: string;
    wabaId?: string;
  }) => {
    setIsConnecting(true);
    setError(null);
    setSuccessNotice(null);

    try {
      const res = await fetch('/api/auth/whatsapp/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          code: params.code,
          phoneNumberId: params.phoneNumberId || manualPhoneId || undefined,
          wabaId: params.wabaId || manualWabaId || undefined,
          userId,
          userEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to exchange Meta code for WhatsApp access token.');
      }

      setAccount(data.account);
      setSuccessNotice(
        `WhatsApp Embedded Signup connected successfully! Phone Number ID: ${data.account.phone_number_id}. Your visual automations and auto-responders are now live and active.`
      );
      if (onAccountConnected) {
        onAccountConnected(data.account);
      }
    } catch (err: any) {
      console.error('WhatsApp callback error:', err);
      setError(err.message || 'Error completing Meta WhatsApp Embedded Signup.');
    } finally {
      setIsConnecting(false);
    }
  };

  // 5. 1-Click Launch Button using Facebook SDK
  const launchEmbeddedSignup = () => {
    setError(null);
    setSuccessNotice(null);

    if (!window.FB) {
      setError(
        'Meta JavaScript SDK is still initializing or blocked by an ad-blocker. Please allow Facebook scripts or use the Direct Connect option below.'
      );
      setShowManualFallback(true);
      return;
    }

    setIsConnecting(true);

    try {
      window.FB.login(
        function (response: any) {
          if (response && response.authResponse && response.authResponse.code) {
            const authCode = response.authResponse.code;
            submitCallback({
              code: authCode,
            });
          } else {
            console.log('[Meta FB.login] Result response:', response);
            setIsConnecting(false);
            if (response?.status === 'not_authorized' || response?.error) {
              setError(
                response?.error?.message ||
                  'Meta login was not completed. You can try again or use the Direct Connect option below.'
              );
            }
          }
        },
        {
          config_id: '', // Optional Meta config id
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            feature: 'whatsapp_embedded_signup',
            version: 2,
            sessionInfoVersion: 2,
          },
        }
      );
    } catch (e: any) {
      setIsConnecting(false);
      setError(
        `Could not open Meta Login popup: ${e.message || 'Popup blocked'}. Use the Direct Connect option below.`
      );
      setShowManualFallback(true);
    }
  };

  // 6. Disconnect Account
  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect this WhatsApp Business account?')) {
      return;
    }
    setIsConnecting(true);
    try {
      await fetch('/api/auth/whatsapp/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ userId }),
      });
      setAccount(null);
      setSuccessNotice('WhatsApp Business account has been disconnected.');
    } catch (err: any) {
      setError(err.message || 'Error disconnecting account');
    } finally {
      setIsConnecting(false);
    }
  };

  // 7. Live Test Message Dispatcher
  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient.trim()) {
      setError('Please provide a destination phone number for the test message.');
      return;
    }

    setIsSendingTest(true);
    setError(null);
    setTestReceipt(null);

    try {
      const res = await fetch('/api/auth/whatsapp/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          to: testRecipient.trim(),
          message: testMessage.trim(),
          userId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Test message dispatch failed.');
      }

      setTestReceipt(data.result);
      setSuccessNotice(`Test message dispatched! Status: ${data.result.detail}`);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch test message.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Header / Breadcrumb */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Dashboard</span>
              </button>
            )}
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>Settings</span>
              <span>/</span>
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                WhatsApp Embedded Signup
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Meta Graph API v21.0
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Page Hero Banner */}
        <div className="rounded-3xl bg-gradient-to-br from-emerald-900 via-slate-950 to-slate-900 text-white p-7 sm:p-9 relative overflow-hidden shadow-xl border border-emerald-800/40">
          <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-400/30">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>1-Click Meta Integration</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
              WhatsApp Business Embedded Signup
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Connect your official WhatsApp Business number with 1 click using the Meta Facebook
              SDK. Once connected, all your lead sequences, appointment triggers, and automations
              start sending instantly through your own business line.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Zero manual webhook setup</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Token linked to your Admin account</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Automations run immediately</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Notices */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">Connection Notice</div>
              <p>{error}</p>
            </div>
          </div>
        )}

        {successNotice && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">WhatsApp Account Active</div>
              <p>{successNotice}</p>
            </div>
          </div>
        )}

        {/* Main Grid: Connection Controls & Account Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (7 Cols): Embedded Signup Action */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <h2 className="font-display text-lg font-bold text-slate-950">
                    Connect WhatsApp via Facebook SDK
                  </h2>
                  <p className="text-xs text-slate-500">
                    Launches the official Meta Embedded Signup flow to authorize your WhatsApp
                    Business Account.
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
                  <MessageSquare className="w-5 h-5" />
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      account && account.status === 'connected'
                        ? 'bg-emerald-500 ring-4 ring-emerald-100'
                        : 'bg-amber-400'
                    }`}
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {account && account.status === 'connected'
                        ? `Connected: ${account.display_phone_number || account.phone_number_id}`
                        : 'No WhatsApp Account Connected'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {account && account.status === 'connected'
                        ? `Linked to user ${account.userId} (${account.verified_name || 'Verified Business'})`
                        : 'Click below to launch 1-Click Embedded Signup'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fetchStatus}
                  disabled={statusLoading}
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200 cursor-pointer transition-colors"
                  title="Refresh Connection Status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${statusLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* 1-Click Facebook SDK Button */}
              <div className="space-y-3">
                <button
                  type="button"
                  disabled={isConnecting}
                  onClick={launchEmbeddedSignup}
                  className="w-full py-3.5 px-6 rounded-xl font-bold text-white text-sm bg-[#1877F2] hover:bg-[#166fe5] active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
                >
                  {/* Meta Facebook F Logo */}
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  <span>
                    {isConnecting
                      ? 'Connecting to Meta WhatsApp...'
                      : account && account.status === 'connected'
                      ? 'Reconnect / Update WhatsApp with Meta SDK'
                      : 'Launch WhatsApp 1-Click Embedded Signup'}
                  </span>
                </button>

                <p className="text-[11px] text-slate-500 text-center">
                  Uses Meta App ID: <code className="font-mono font-bold text-slate-700">{metaAppId}</code>{' '}
                  · Direct OAuth authorization with Meta Graph API
                </p>
              </div>

              {/* Step Flow Checklist */}
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2.5 text-xs">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  What happens when you click:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                    <div className="font-bold text-emerald-800 flex items-center gap-1">
                      <span>1.</span> Meta Popup
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Log in to your Facebook profile and choose your Business Portfolio.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                    <div className="font-bold text-emerald-800 flex items-center gap-1">
                      <span>2.</span> Phone ID
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Pick your WhatsApp number and generate a verified Phone ID.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                    <div className="font-bold text-emerald-800 flex items-center gap-1">
                      <span>3.</span> Auto-Active
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Token is saved to <code className="font-mono">whatsapp_accounts</code> and
                      automations start immediately.
                    </p>
                  </div>
                </div>
              </div>

              {/* Toggle Direct / Manual Fallback */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setShowManualFallback(!showManualFallback)}
                  className="text-slate-600 hover:text-slate-900 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {showManualFallback ? 'Hide' : 'Need direct code / token input? (Click here)'}
                  </span>
                </button>
                {account && account.status === 'connected' && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                  >
                    Disconnect Account
                  </button>
                )}
              </div>

              {/* Direct Token / Code Exchange Input Form */}
              {showManualFallback && (
                <div className="p-4 rounded-xl bg-slate-100 border border-slate-300/80 space-y-3.5 text-xs animate-in fade-in duration-200">
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900">
                      Direct Meta Code or System Access Token Exchange
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      If Facebook popup is blocked in this browser, paste the authorization code or
                      permanent System User Token directly.
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Meta Authorization Code or Access Token *
                    </label>
                    <input
                      type="text"
                      value={manualCodeOrToken}
                      onChange={(e) => setManualCodeOrToken(e.target.value)}
                      placeholder="e.g. AQD... or EAAP..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Phone Number ID (Optional)
                      </label>
                      <input
                        type="text"
                        value={manualPhoneId}
                        onChange={(e) => setManualPhoneId(e.target.value)}
                        placeholder="e.g. 109283746501928"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        WABA ID (Optional)
                      </label>
                      <input
                        type="text"
                        value={manualWabaId}
                        onChange={(e) => setManualWabaId(e.target.value)}
                        placeholder="e.g. 592837461029384"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!manualCodeOrToken.trim() || isConnecting}
                    onClick={() =>
                      submitCallback({
                        code: manualCodeOrToken.trim(),
                        phoneNumberId: manualPhoneId.trim() || undefined,
                        wabaId: manualWabaId.trim() || undefined,
                      })
                    }
                    className="w-full py-2.5 px-4 font-bold text-white bg-slate-900 hover:bg-black rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {isConnecting ? 'Linking Account...' : 'Exchange & Save to Database'}
                  </button>
                </div>
              )}
            </div>

            {/* Test WhatsApp Dispatcher Form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <span>Send Live WhatsApp Verification Message</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verify that your connected Meta token dispatches live messages to real phone
                    numbers.
                  </p>
                </div>
                {account && account.status === 'connected' && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Ready to Send
                  </span>
                )}
              </div>

              <form onSubmit={handleSendTestMessage} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Destination Phone Number (WhatsApp To:) *
                  </label>
                  <input
                    type="tel"
                    required
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="+1 (555) 019-2834 or international format"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Message Body Content
                  </label>
                  <textarea
                    rows={3}
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500">
                    Dispatches using token from <code className="font-mono">whatsapp_accounts</code>
                  </span>
                  <button
                    type="submit"
                    disabled={isSendingTest || !testRecipient.trim()}
                    className="py-2.5 px-5 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingTest ? 'Sending...' : 'Send Live WhatsApp Now'}</span>
                  </button>
                </div>
              </form>

              {testReceipt && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{testReceipt.provider}</span>
                  </div>
                  <p className="text-slate-600 font-mono text-[11px]">{testReceipt.detail}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 Cols): Account Specs & Live Automation Status */}
          <div className="lg:col-span-5 space-y-6">
            {/* Live Account Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-display text-sm font-bold text-slate-950 uppercase tracking-wider">
                  Database Account Record
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  whatsapp_accounts
                </span>
              </div>

              {account && account.status === 'connected' ? (
                <div className="space-y-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-900 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Connected &amp; Active</span>
                      </span>
                      <span className="text-[10px] text-emerald-700 font-mono font-semibold">
                        v21.0
                      </span>
                    </div>
                    <div className="text-sm font-bold text-emerald-950">
                      {account.verified_name || 'Official WhatsApp Business'}
                    </div>
                    <div className="font-mono text-emerald-800 font-bold">
                      {account.display_phone_number || account.phone_number_id}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">
                          Phone Number ID
                        </div>
                        <div className="font-mono font-bold text-slate-900">
                          {account.phone_number_id}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(account.phone_number_id, 'phone_id')}
                        className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                        title="Copy Phone ID"
                      >
                        {copiedKey === 'phone_id' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {account.waba_id && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-500">
                            WABA ID
                          </div>
                          <div className="font-mono font-bold text-slate-900">{account.waba_id}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(account.waba_id!, 'waba_id')}
                          className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                          title="Copy WABA ID"
                        >
                          {copiedKey === 'waba_id' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-[10px] uppercase font-bold text-slate-500">
                        Linked Admin User
                      </div>
                      <div className="font-medium text-slate-900 truncate">
                        {userEmail || account.userId}
                      </div>
                    </div>

                    {account.connectedAt && (
                      <div className="text-[11px] text-slate-500 text-right">
                        Connected: {new Date(account.connectedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-300 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-xs text-slate-800">
                    No WhatsApp Account Connected Yet
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Click "Launch WhatsApp 1-Click Embedded Signup" to link your official Meta
                    credentials.
                  </p>
                </div>
              )}
            </div>

            {/* Automation Readiness Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Instant Automation Engine</span>
              </div>
              <h4 className="font-display text-sm font-bold text-slate-950">
                Automations Activate Immediately
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                As soon as your WhatsApp Business Account is connected here, every automated flow
                triggers seamlessly:
              </p>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100 flex items-start gap-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700">
                    <strong>Lead Welcome Sequence:</strong> New leads from public forms receive
                    instant WhatsApp onboarding messages.
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100 flex items-start gap-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700">
                    <strong>Booking &amp; Consultation Reminders:</strong> Automated reminder alerts
                    route through your verified Phone ID.
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100 flex items-start gap-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700">
                    <strong>Interactive Inbound Webhooks:</strong> Customer replies are delivered
                    directly to your Unified CRM Inbox.
                  </span>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-500">
                Token is stored securely per-user in database table{' '}
                <code className="font-mono font-semibold text-slate-800">whatsapp_accounts</code>.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
