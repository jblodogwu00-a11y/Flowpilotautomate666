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
  ArrowRight,
  Sliders,
  FileText,
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
  waba_id?: string;
  business_id?: string;
  access_token?: string;
  whatsapp_number?: string;
  display_phone_number?: string;
  verified_name?: string;
  status: 'connected' | 'disconnected';
  connectedAt?: string;
  updatedAt?: string;
}

interface WhatsAppConnectViewProps {
  userId?: string;
  userEmail?: string;
  onBackToDashboard?: () => void;
  onNavigateToTemplates?: () => void;
  onAccountConnected?: (account: WhatsAppConnectedAccount) => void;
}

export const WhatsAppConnectView: React.FC<WhatsAppConnectViewProps> = ({
  userId = 'admin_user',
  userEmail = 'jonajukej777@gmail.com',
  onBackToDashboard,
  onNavigateToTemplates,
  onAccountConnected,
}) => {
  const [appId, setAppId] = useState<string>(
    import.meta.env.VITE_FACEBOOK_APP_ID || import.meta.env.VITE_META_APP_ID || '1109730181566504'
  );
  const [sdkLoaded, setSdkLoaded] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [statusLoading, setStatusLoading] = useState<boolean>(true);
  const [account, setAccount] = useState<WhatsAppConnectedAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Manual fallback connect for local test/preview resilience
  const [showManualFallback, setShowManualFallback] = useState<boolean>(false);
  const [manualCodeOrToken, setManualCodeOrToken] = useState<string>('');
  const [manualPhoneId, setManualPhoneId] = useState<string>('');
  const [manualWabaId, setManualWabaId] = useState<string>('');
  const [manualBusinessId, setManualBusinessId] = useState<string>('');
  const [manualWhatsappNumber, setManualWhatsappNumber] = useState<string>('+234 812 345 6789');

  // Live test dispatch state
  const [testRecipient, setTestRecipient] = useState<string>('');
  const [testMessage, setTestMessage] = useState<string>(
    'Hello! This is a verified test message from FlowPilot WhatsApp Cloud API.'
  );
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testReceipt, setTestReceipt] = useState<any>(null);

  // 1. Fetch current status & config from backend
  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/status?userId=${encodeURIComponent(userId)}`, {
        headers: { 'x-user-id': userId },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.appId) {
          setAppId(data.appId);
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
          appId,
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
  }, [appId]);

  // 3. Listen to Meta window message events (WA_EMBEDDED_SIGNUP)
  useEffect(() => {
    const handleMetaWindowMessage = (event: MessageEvent) => {
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      ) {
        return;
      }

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data.type === 'WA_EMBEDDED_SIGNUP') {
          console.log('[Meta Embedded Signup] Window message received:', data);
          if (data.event === 'FINISH' && data.data) {
            const { phone_number_id, waba_id, business_id } = data.data;
            if (phone_number_id) setManualPhoneId(phone_number_id);
            if (waba_id) setManualWabaId(waba_id);
            if (business_id) setManualBusinessId(business_id);
          }
        }
      } catch {
        // Safe ignore
      }
    };

    window.addEventListener('message', handleMetaWindowMessage);
    return () => window.removeEventListener('message', handleMetaWindowMessage);
  }, []);

  // 4. Send exchanged code / credentials to backend /api/whatsapp/callback
  const submitCallback = async (params: {
    code: string;
    phoneNumberId?: string;
    wabaId?: string;
    businessId?: string;
    whatsappNumber?: string;
  }) => {
    setIsConnecting(true);
    setError(null);
    setSuccessNotice(null);

    try {
      const res = await fetch('/api/whatsapp/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          code: params.code,
          phoneNumberId: params.phoneNumberId || manualPhoneId || undefined,
          wabaId: params.wabaId || manualWabaId || undefined,
          businessId: params.businessId || manualBusinessId || undefined,
          whatsappNumber: params.whatsappNumber || manualWhatsappNumber || undefined,
          userId,
          userEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to exchange Facebook authorization code for access token.');
      }

      setAccount(data.account);
      const connectedNumber = data.account.whatsapp_number || data.account.display_phone_number || '+234...';
      setSuccessNotice(`Connected: ${connectedNumber}! Credentials saved to database. Your automations and templates are now active.`);
      if (onAccountConnected) {
        onAccountConnected(data.account);
      }
    } catch (err: any) {
      console.error('WhatsApp callback error:', err);
      setError(err.message || 'Error completing WhatsApp Facebook Embedded Signup.');
    } finally {
      setIsConnecting(false);
    }
  };

  // 5. Button "Connect WhatsApp with Facebook" Click Handler
  const launchEmbeddedSignup = () => {
    setError(null);
    setSuccessNotice(null);

    if (!window.FB) {
      setError(
        'Facebook JavaScript SDK is still initializing or blocked by an ad-blocker. Please allow Facebook scripts or use the Direct Connect input below.'
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
            console.log('[Facebook FB.login] Result response:', response);
            setIsConnecting(false);
            if (response?.status === 'not_authorized' || response?.error) {
              setError(
                response?.error?.message ||
                  'Facebook Embedded Signup was not completed. You can try again or use the Direct Connect option.'
              );
            }
          }
        },
        {
          config_id: '',
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
        `Could not open Facebook popup: ${e.message || 'Popup blocked'}. Use Direct Connect below.`
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
      await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ userId }),
      });
      setAccount(null);
      setSuccessNotice('WhatsApp Business account disconnected.');
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
      setError('Please provide a recipient phone number (e.g. +2348123456789).');
      return;
    }

    setIsSendingTest(true);
    setError(null);
    setTestReceipt(null);

    try {
      const res = await fetch('/api/whatsapp/test', {
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
        throw new Error(data.error || 'Failed to dispatch test WhatsApp message.');
      }

      setTestReceipt(data.result);
      setSuccessNotice(`Test message sent! Detail: ${data.result.detail}`);
    } catch (err: any) {
      setError(err.message || 'Failed to send test message.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isConnected = Boolean(account && account.status === 'connected');
  const connectedNumber = account?.whatsapp_number || account?.display_phone_number || '+234 812 345 6789';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Header / Breadcrumbs */}
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
                <span>Dashboard</span>
              </button>
            )}
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>Integrations</span>
              <span>/</span>
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                WhatsApp Connection
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onNavigateToTemplates && (
              <button
                type="button"
                onClick={onNavigateToTemplates}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Message Templates</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-mono text-[11px] font-bold border border-slate-200">
              API v21.0
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Page Hero */}
        <div className="rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white p-7 sm:p-9 relative overflow-hidden shadow-xl border border-emerald-800/40">
          <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-400/30">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Embedded Signup · Meta Graph API v21.0</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
              Connect WhatsApp with Facebook
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Authenticate via the official Meta Embedded Signup flow to save your WABA ID, Phone Number ID,
              Business ID, and access token. Automations and message templates link directly to your verified business number.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Real OAuth access token exchange</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Persistent credentials vault</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Automations dispatch immediately</span>
              </div>
            </div>
          </div>
        </div>

        {/* GREEN STATUS BANNER WHEN CONNECTED (Requirement: "Show Green 'Connected: +234...' if connected") */}
        {isConnected && (
          <div className="p-5 sm:p-6 rounded-2xl bg-emerald-50 border-2 border-emerald-500 shadow-sm text-emerald-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-bold tracking-wider uppercase text-emerald-800">
                    Live Status
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight">
                  Connected: {connectedNumber}
                </div>
                <div className="text-xs text-emerald-800 mt-0.5">
                  Verified Business: <span className="font-semibold">{account?.verified_name || 'Flowpilot Account'}</span> · WABA ID: <span className="font-mono font-bold">{account?.waba_id}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {onNavigateToTemplates && (
                <button
                  type="button"
                  onClick={onNavigateToTemplates}
                  className="px-4 py-2 text-xs font-bold rounded-xl text-white bg-emerald-700 hover:bg-emerald-800 shadow-sm cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Create Templates</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isConnecting}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl text-rose-700 hover:text-rose-800 hover:bg-rose-100/60 border border-rose-300 cursor-pointer transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">Notice</div>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Success Notice */}
        {successNotice && !isConnected && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">Success</div>
              <p>{successNotice}</p>
            </div>
          </div>
        )}

        {/* Main Grid: Signup Action + Saved Credentials Vault */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (7 cols): Connect Button & Flow */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <h2 className="font-display text-lg font-bold text-slate-950">
                    Facebook Embedded Signup
                  </h2>
                  <p className="text-xs text-slate-500">
                    Click the button below to launch Meta's secure embedded popup and authorize your WhatsApp business number.
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
                  <MessageSquare className="w-5 h-5" />
                </div>
              </div>

              {/* Requirement: Button "Connect WhatsApp with Facebook" */}
              <div className="space-y-3">
                <button
                  type="button"
                  disabled={isConnecting}
                  onClick={launchEmbeddedSignup}
                  className="w-full py-4 px-6 rounded-xl font-bold text-white text-base bg-[#1877F2] hover:bg-[#166fe5] active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
                >
                  {/* Facebook F Icon */}
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  <span>
                    {isConnecting
                      ? 'Exchanging Code & Connecting...'
                      : isConnected
                      ? 'Reconnect WhatsApp with Facebook'
                      : 'Connect WhatsApp with Facebook'}
                  </span>
                </button>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>
                    Facebook App ID: <code className="font-mono font-bold text-slate-800">{appId}</code>
                  </span>
                  <button
                    type="button"
                    onClick={fetchStatus}
                    disabled={statusLoading}
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${statusLoading ? 'animate-spin' : ''}`} />
                    <span>Check Status</span>
                  </button>
                </div>
              </div>

              {/* 3-Step Meta Flow Info */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2 text-xs">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  Connection Protocol:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                    <div className="font-bold text-emerald-800">1. Popup Dialog</div>
                    <p className="text-[11px] text-slate-600">
                      User completes Meta Embedded Signup popup and grants permissions.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                    <div className="font-bold text-emerald-800">2. Code Exchange</div>
                    <p className="text-[11px] text-slate-600">
                      Backend exchanges code for permanent access token via Graph API v21.0.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                    <div className="font-bold text-emerald-800">3. Save &amp; Automate</div>
                    <p className="text-[11px] text-slate-600">
                      Saves WABA ID, Phone ID, Business ID, and token to database.
                    </p>
                  </div>
                </div>
              </div>

              {/* Manual Direct Input Fallback (Iframe resilience) */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowManualFallback(!showManualFallback)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{showManualFallback ? 'Hide Direct Connect Options' : 'Direct Connect / Iframe Test Option'}</span>
                </button>

                {showManualFallback && (
                  <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                    <p className="text-slate-600 text-[11px]">
                      If Facebook popup is blocked in preview iframes, paste your authorization code or token and credentials here:
                    </p>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={manualCodeOrToken}
                        onChange={(e) => setManualCodeOrToken(e.target.value)}
                        placeholder="Meta Authorization Code (or Access Token)"
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={manualPhoneId}
                          onChange={(e) => setManualPhoneId(e.target.value)}
                          placeholder="Phone Number ID (e.g. 523910284719283)"
                          className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                        <input
                          type="text"
                          value={manualWabaId}
                          onChange={(e) => setManualWabaId(e.target.value)}
                          placeholder="WABA ID (e.g. 109283746192834)"
                          className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={manualBusinessId}
                          onChange={(e) => setManualBusinessId(e.target.value)}
                          placeholder="Business ID (e.g. 981726354819203)"
                          className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                        <input
                          type="text"
                          value={manualWhatsappNumber}
                          onChange={(e) => setManualWhatsappNumber(e.target.value)}
                          placeholder="WhatsApp Number (e.g. +234 812 345 6789)"
                          className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={isConnecting || !manualCodeOrToken.trim()}
                        onClick={() =>
                          submitCallback({
                            code: manualCodeOrToken.trim(),
                            phoneNumberId: manualPhoneId.trim(),
                            wabaId: manualWabaId.trim(),
                            businessId: manualBusinessId.trim(),
                            whatsappNumber: manualWhatsappNumber.trim(),
                          })
                        }
                        className="w-full py-2.5 px-4 font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        Submit Credentials to Backend
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Test Message Dispatcher */}
            {isConnected && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Send Live Test WhatsApp Message</h3>
                    <p className="text-[11px] text-slate-500">
                      Dispatches directly through your connected Phone ID via Meta Cloud API.
                    </p>
                  </div>
                  <Send className="w-4 h-4 text-emerald-600" />
                </div>

                <form onSubmit={handleSendTestMessage} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Recipient Mobile Number (E.164 format with country code)
                    </label>
                    <input
                      type="text"
                      value={testRecipient}
                      onChange={(e) => setTestRecipient(e.target.value)}
                      placeholder="+2348012345678 or +12125550198"
                      className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Test Message Body</label>
                    <textarea
                      rows={2}
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSendingTest || !testRecipient.trim()}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {isSendingTest ? 'Sending via Meta API...' : 'Dispatch Verification WhatsApp'}
                  </button>
                </form>

                {testReceipt && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                    <div className="font-bold">Receipt Log:</div>
                    <div className="font-mono text-[11px]">{testReceipt.detail}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column (5 cols): Saved DB Credentials Breakdown */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Database Credentials Record</h3>
                  <p className="text-[11px] text-slate-500">Stored in DB table <code className="font-mono">whatsapp_accounts</code></p>
                </div>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>

              <div className="space-y-3">
                {/* WABA ID */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>WABA ID (WhatsApp Business Account ID)</span>
                    {account?.waba_id && (
                      <button
                        type="button"
                        onClick={() => handleCopy(account.waba_id!, 'waba')}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {copiedKey === 'waba' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-900">
                    {account?.waba_id || (isConnected ? 'waba_synced_default' : 'Not Connected')}
                  </div>
                </div>

                {/* Phone Number ID */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>Phone Number ID</span>
                    {account?.phone_number_id && (
                      <button
                        type="button"
                        onClick={() => handleCopy(account.phone_number_id, 'phone_id')}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {copiedKey === 'phone_id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-900">
                    {account?.phone_number_id || (isConnected ? 'phone_synced_default' : 'Not Connected')}
                  </div>
                </div>

                {/* Business ID */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>Business ID</span>
                    {account?.business_id && (
                      <button
                        type="button"
                        onClick={() => handleCopy(account.business_id!, 'biz_id')}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {copiedKey === 'biz_id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-900">
                    {account?.business_id || (isConnected ? 'biz_portfolio_default' : 'Not Connected')}
                  </div>
                </div>

                {/* WhatsApp Number */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>WhatsApp Number</span>
                    {connectedNumber && (
                      <button
                        type="button"
                        onClick={() => handleCopy(connectedNumber, 'num')}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {copiedKey === 'num' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  <div className="font-mono text-xs font-bold text-emerald-800">
                    {isConnected ? connectedNumber : 'Not Connected'}
                  </div>
                </div>

                {/* Access Token Status */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Access Token Vault
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    {isConnected ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>Saved to user DB (Bearer token secured)</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                        <span>Awaiting connection code exchange</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Link to Part 2 Templates */}
              {onNavigateToTemplates && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onNavigateToTemplates}
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 shadow-xs flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-700" />
                      <span>WhatsApp Message Templates</span>
                    </span>
                    <ArrowRight className="w-4 h-4 text-emerald-700" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
