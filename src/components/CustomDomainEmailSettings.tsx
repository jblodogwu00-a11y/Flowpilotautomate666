import React, { useState, useEffect } from 'react';
import {
  Mail,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Send,
  Users,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Globe,
  Info,
} from 'lucide-react';

export interface ResendDnsRecord {
  id?: string;
  record: string;
  name: string;
  type: string;
  ttl?: string;
  status?: string;
  value: string;
  priority?: number;
}

export interface EmailUserConfig {
  userId: string;
  fromName: string;
  fromEmail: string;
  domain: string;
}

export interface CustomDomainEmailSettingsProps {
  onBack?: () => void;
  onNavigateToAutomations?: () => void;
}

export const CustomDomainEmailSettings: React.FC<CustomDomainEmailSettingsProps> = ({
  onBack,
  onNavigateToAutomations,
}) => {
  // Current Active User editing: 'me' | 'brother'
  const [selectedUser, setSelectedUser] = useState<'me' | 'brother'>('me');

  // Input states for 'me' and 'brother'
  const [fromNames, setFromNames] = useState<{ me: string; brother: string }>({
    me: 'Musa Store',
    brother: 'Brother Store',
  });
  const [fromEmails, setFromEmails] = useState<{ me: string; brother: string }>({
    me: 'hello@passiveincome.work.gd',
    brother: 'support@passiveincome.work.gd',
  });

  // Domain & DNS state returned from backend
  const [sharedDomain, setSharedDomain] = useState<string>('passiveincome.work.gd');
  const [sharedDomainId, setSharedDomainId] = useState<string>('');
  const [dnsRecords, setDnsRecords] = useState<ResendDnsRecord[]>([]);
  const [isDomainVerified, setIsDomainVerified] = useState<boolean>(false);
  const [domainStatus, setDomainStatus] = useState<string>('pending');

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Test send drawer
  const [testRecipient, setTestRecipient] = useState<string>('');
  const [testSubject, setTestSubject] = useState<string>('Test Email from Custom Domain');
  const [testSenderChoice, setTestSenderChoice] = useState<'me' | 'brother'>('me');
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Fetch current email settings on mount
  const fetchSettings = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/email/settings');
      if (res.ok) {
        const text = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = {};
        }
        if (data.domain) {
          setSharedDomain(data.domain);
        }
        if (data.domainId) {
          setSharedDomainId(data.domainId);
        }
        if (Array.isArray(data.records) && data.records.length > 0) {
          setDnsRecords(data.records);
        }
        setIsDomainVerified(Boolean(data.verified));
        setDomainStatus(data.status || 'pending');

        // Populate users if saved
        if (data.users) {
          if (data.users.me) {
            setFromNames((prev) => ({ ...prev, me: data.users.me.fromName || prev.me }));
            setFromEmails((prev) => ({ ...prev, me: data.users.me.fromEmail || prev.me }));
          }
          if (data.users.brother) {
            setFromNames((prev) => ({ ...prev, brother: data.users.brother.fromName || prev.brother }));
            setFromEmails((prev) => ({ ...prev, brother: data.users.brother.fromEmail || prev.brother }));
          }
        }
      }
    } catch (err: any) {
      console.warn('[Custom Domain Email] Fetch error:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Save current user settings & create/link domain
  const handleSaveDomainConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessBanner(null);

    const activeEmail = fromEmails[selectedUser].trim().toLowerCase();
    const activeName = fromNames[selectedUser].trim();

    if (!activeEmail || !activeEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address (e.g. hello@passiveincome.work.gd).');
      return;
    }

    const domainPart = activeEmail.split('@')[1];
    if (!domainPart || !domainPart.includes('.')) {
      setErrorMessage('Invalid domain name in email address.');
      return;
    }

    // FREE PLAN DOMAIN SYNC: Ensure both users share the SAME domain
    const otherUser = selectedUser === 'me' ? 'brother' : 'me';
    const otherPrefix = otherUser === 'brother' ? 'support' : 'hello';
    const otherEmail = fromEmails[otherUser].trim().toLowerCase();
    if (otherEmail && otherEmail.includes('@')) {
      const otherDomain = otherEmail.split('@')[1];
      if (otherDomain && otherDomain !== domainPart) {
        // Keep both accounts synchronized with the shared custom domain
        setFromEmails((prev) => ({
          ...prev,
          [otherUser]: `${otherPrefix}@${domainPart}`,
        }));
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/email/add-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser,
          fromName: activeName,
          fromEmail: activeEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to save domain configuration.');
      }

      setSharedDomain(data.domain);
      setSharedDomainId(data.domainId);
      if (Array.isArray(data.records) && data.records.length > 0) {
        setDnsRecords(data.records);
      }
      setIsDomainVerified(Boolean(data.verified));
      setDomainStatus(data.status || 'not_started');

      setSuccessBanner(
        `Saved sender settings for ${selectedUser === 'me' ? 'Me' : 'Brother'} (${activeEmail}). Shared domain: ${data.domain}`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Error configuring custom domain.');
    } finally {
      setIsSaving(false);
    }
  };

  // Verify domain DNS records
  const handleVerifyDns = async () => {
    setIsVerifying(true);
    setErrorMessage(null);
    setSuccessBanner(null);
    try {
      const res = await fetch('/api/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainId: sharedDomainId }),
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        // If server returns HTML or proxy error, format cleanly instead of throwing syntax error
        throw new Error(
          res.ok
            ? 'Server returned non-JSON response. Please try again.'
            : `Verification service returned status ${res.status}. Please check your connection.`
        );
      }

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to verify DNS records.');
      }

      const verified = Boolean(data.verified);
      setIsDomainVerified(verified);
      setDomainStatus(data.status);
      if (Array.isArray(data.records) && data.records.length > 0) {
        setDnsRecords(data.records);
      }

      if (verified) {
        setSuccessBanner(`✅ Domain ${data.domain || sharedDomain || 'passiveincome.work.gd'} verified. Both emails ready`);
      } else {
        setSuccessBanner(
          `Domain status: "${data.status}". DNS changes can take a few minutes to propagate across global DNS servers. Please retry in a moment.`
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error verifying domain DNS.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Dispatch live test email
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient || !testRecipient.includes('@')) {
      setTestResult({ success: false, message: 'Please enter a valid recipient email.' });
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);
    try {
      const senderObj = {
        userId: testSenderChoice,
        to: testRecipient.trim(),
        subject: testSubject.trim() || 'FlowPilot Test Email',
        html: `
          <div style="font-family: sans-serif; padding: 24px; background: #f8fafc; border-radius: 12px; color: #0f172a;">
            <h2 style="color: #2563eb; margin-top: 0;">Test Email Verified!</h2>
            <p>Hi there,</p>
            <p>This is a live test email sent from FlowPilot Custom Domain Automation.</p>
            <div style="padding: 12px 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; margin: 16px 0;">
              <strong>Sender:</strong> ${fromNames[testSenderChoice]} &lt;${fromEmails[testSenderChoice]}&gt;<br/>
              <strong>User Persona:</strong> ${testSenderChoice === 'me' ? 'Me' : 'Brother'}<br/>
              <strong>Domain:</strong> ${sharedDomain}
            </div>
            <p>Both your account and your brother's account are linked to this shared domain on the free Resend plan.</p>
            <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">Sent automatically by FlowPilot Automation Engine</p>
          </div>
        `,
        text: `Test Email from ${fromNames[testSenderChoice]} <${fromEmails[testSenderChoice]}>. Both users share the verified domain ${sharedDomain}.`,
      };

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(senderObj),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to dispatch email.');
      }

      setTestResult({
        success: true,
        message: `✅ Test email successfully sent to ${testRecipient}! (Message ID: ${data.id || 'ok'})`,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to send test email.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Derive active domain name
  const effectiveDomain =
    sharedDomain ||
    (fromEmails.me.includes('@') ? fromEmails.me.split('@')[1] : 'passiveincome.work.gd');

  // Fallback 3 DNS records if not yet returned by Resend
  const displayRecords: ResendDnsRecord[] =
    dnsRecords.length > 0
      ? dnsRecords
      : [
          {
            record: 'TXT record 1: send',
            name: `send.${effectiveDomain}`,
            type: 'TXT',
            value: 'v=spf1 include:amazonses.com ~all',
            status: isDomainVerified ? 'verified' : 'pending',
          },
          {
            record: 'TXT record 2: resend._domainkey',
            name: `resend._domainkey.${effectiveDomain}`,
            type: 'TXT',
            value: 'k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3...',
            status: isDomainVerified ? 'verified' : 'pending',
          },
          {
            record: 'TXT record 3: _dmarc',
            name: `_dmarc.${effectiveDomain}`,
            type: 'TXT',
            value: `v=DMARC1; p=none; rua=mailto:dmarc@${effectiveDomain}`,
            status: isDomainVerified ? 'verified' : 'pending',
          },
        ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="hover:text-blue-600 transition-colors cursor-pointer"
              >
                Settings
              </button>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-blue-600 font-semibold">Email Automation</span>
            <span className="text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-medium">Free Resend Plan · 1 Shared Domain</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Custom Domain Email Automation
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Configure 2 users (<strong>Me</strong> & <strong>Brother</strong>) sharing the same
            custom domain on the free Resend tier without creating duplicate domains.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchSettings}
            disabled={isLoading}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
          {onNavigateToAutomations && (
            <button
              type="button"
              onClick={onNavigateToAutomations}
              className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Go to Workflow Builder</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Verification Status Banner (If verified: Green banner) */}
      {isDomainVerified ? (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-950">
                ✅ Domain {effectiveDomain} verified. Both emails ready
              </h3>
              <p className="text-xs text-emerald-800">
                Both <strong>{fromEmails.me}</strong> and <strong>{fromEmails.brother}</strong> are
                fully verified and authorized to send automated sequences and broadcasts.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg shrink-0">
            Active
          </span>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <strong className="font-bold">DNS Verification Pending:</strong> Add the 3 DNS records
            below to your domain DNS provider (Cloudflare, Namecheap, GoDaddy, etc.) and click{' '}
            <strong>"We have added DNS - Verify Domain"</strong>.
          </div>
        </div>
      )}

      {/* Error / Alert notification */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-900 rounded-2xl flex items-start gap-2.5 font-medium shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success notification */}
      {successBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-950 rounded-2xl flex items-start gap-2.5 font-medium shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* CARD 1: SENDER IDENTITY & USER SELECTOR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-[0_4px_12px_rgba(0,0,0,0.05)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
              Step 1 · User Persona & Sender Profiles
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              Configure Send Identities (Same Shared Domain)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Switch between users to configure their From Name and From Email.
            </p>
          </div>

          {/* User Selector Dropdown / Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setSelectedUser('me')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedUser === 'me'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Me (Musa Store)</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedUser('brother')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedUser === 'brother'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Brother (Brother Store)</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveDomainConfig} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* User Selector Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Active User Selector *
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value as 'me' | 'brother')}
                className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="me">Me (hello@{effectiveDomain})</option>
                <option value="brother">Brother (support@{effectiveDomain})</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Currently editing configuration for <strong>{selectedUser === 'me' ? 'Me' : 'Brother'}</strong>.
              </p>
            </div>

            {/* From Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                From Name (Display Name) *
              </label>
              <input
                type="text"
                required
                value={fromNames[selectedUser]}
                onChange={(e) => {
                  const val = e.target.value;
                  setFromNames((prev) => ({ ...prev, [selectedUser]: val }));
                }}
                placeholder={selectedUser === 'me' ? 'Musa Store' : 'Brother Store'}
                className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                E.g. "Musa Store" for you, "Brother Store" for your brother.
              </p>
            </div>

            {/* From Email */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                From Email Address (Must Share Same Domain) *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={fromEmails[selectedUser]}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFromEmails((prev) => ({ ...prev, [selectedUser]: val }));
                  }}
                  placeholder={
                    selectedUser === 'me'
                      ? 'hello@passiveincome.work.gd'
                      : 'support@passiveincome.work.gd'
                  }
                  className="w-full pl-10 pr-4 py-2.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Real-Time Domain Sync Notice */}
              <div className="mt-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  Shared Custom Domain: <strong className="text-blue-600 font-mono">{effectiveDomain}</strong>
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  Me: <span className="font-mono text-slate-800">{fromEmails.me}</span> · Brother:{' '}
                  <span className="font-mono text-slate-800">{fromEmails.brother}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-slate-500">
              * Note: The Resend API key is stored securely in your server <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">.env</code> file. No API keys are exposed to the client.
            </p>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {isSaving ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{isSaving ? 'Saving...' : 'Save Sender Configuration'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* CARD 2: DNS INSTRUCTIONS BOX (SHOWN ONCE FOR THE SHARED DOMAIN) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-[0_4px_12px_rgba(0,0,0,0.05)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
              Step 2 · One-Time DNS Setup
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              Add these 3 DNS records for {effectiveDomain} (Add once for both users)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Copy and paste these 3 TXT records into your DNS provider. Because both users share{' '}
              <strong className="text-slate-800">{effectiveDomain}</strong>, you only configure this once!
            </p>
          </div>

          <button
            type="button"
            onClick={handleVerifyDns}
            disabled={isVerifying}
            className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60 inline-flex items-center gap-2 shrink-0"
          >
            {isVerifying ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>We have added DNS - Verify Domain</span>
          </button>
        </div>

        {/* 3 DNS Records Display Table/Cards */}
        <div className="space-y-3">
          {displayRecords.slice(0, 3).map((rec, index) => {
            const rowLabel =
              index === 0
                ? 'TXT record 1: send (SPF)'
                : index === 1
                ? 'TXT record 2: resend._domainkey (DKIM)'
                : 'TXT record 3: _dmarc (DMARC)';

            const hostVal = rec.name;
            const recordVal = rec.value;

            return (
              <div
                key={index}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-colors space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono font-bold text-[11px]">
                      {rec.type || 'TXT'}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{rowLabel}</span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isDomainVerified || rec.status === 'verified'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isDomainVerified || rec.status === 'verified' ? 'Verified' : 'Pending DNS'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Host / Name Field */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500">Host / Name:</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(hostVal, `host_${index}`)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === `host_${index}` ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-xs font-semibold text-slate-800 break-all select-all">
                      {hostVal}
                    </div>
                  </div>

                  {/* Value / Content Field */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500">Value / Target:</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(recordVal, `val_${index}`)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === `val_${index}` ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-xs font-semibold text-slate-800 break-all select-all">
                      {recordVal}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* DNS Action Button Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Once saved at your DNS registrar, verification takes between 30 seconds and 5 minutes.
          </p>
          <button
            type="button"
            onClick={handleVerifyDns}
            disabled={isVerifying}
            className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>We have added DNS - Verify Domain</span>
          </button>
        </div>
      </div>

      {/* CARD 3: SEND LIVE TEST EMAIL (TEST AS ME OR BROTHER) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-[0_4px_12px_rgba(0,0,0,0.05)] space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
              Step 3 · Live Send Verification
            </span>
            <h2 className="text-base font-bold text-slate-900">
              Send a Test Email from Your Custom Domain
            </h2>
          </div>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200">
            Resend API Live
          </span>
        </div>

        <form onSubmit={handleSendTestEmail} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Test As Sender:
              </label>
              <select
                value={testSenderChoice}
                onChange={(e) => setTestSenderChoice(e.target.value as 'me' | 'brother')}
                className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="me">
                  Me: {fromNames.me} ({fromEmails.me})
                </option>
                <option value="brother">
                  Brother: {fromNames.brother} ({fromEmails.brother})
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Recipient Email:
              </label>
              <input
                type="email"
                required
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="your.email@gmail.com"
                className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Subject Line:
              </label>
              <input
                type="text"
                required
                value={testSubject}
                onChange={(e) => setTestSubject(e.target.value)}
                placeholder="FlowPilot Test Email"
                className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              Dispatches via <code className="font-mono text-slate-700">POST /api/email/send</code> with Resend SDK.
            </span>
            <button
              type="submit"
              disabled={isSendingTest}
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {isSendingTest ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{isSendingTest ? 'Sending...' : 'Send Live Test Email'}</span>
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-medium ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {testResult.message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
