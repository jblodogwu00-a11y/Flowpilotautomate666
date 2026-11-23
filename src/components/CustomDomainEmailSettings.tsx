import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Mail,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Send,
  ArrowRight,
  ChevronRight,
  Globe,
  Clock,
  Trash2,
  Lock,
  Info,
  XCircle,
} from 'lucide-react';
import {
  EmailDeliveryLog,
  EmailDnsRecord,
  EmailDomainStatusSummary,
  extractDomainFromEmail,
  validateCustomDomainEmailInput,
} from '../utils/emailDomainValidation';
import {
  connectCustomDomain,
  EMPTY_EMAIL_DOMAIN_STATUS,
  fetchCustomDomainDeliveryLogs,
  fetchCustomDomainStatus,
  removeCustomDomain,
  sendCustomDomainTestEmail,
  updateCustomEmailSender,
  verifyCustomDomainDns,
} from '../services/customDomainEmailClient';

export interface CustomDomainEmailSettingsProps {
  onBack?: () => void;
  onNavigateToAutomations?: () => void;
  isAuthenticated?: boolean;
  onOpenAuth?: () => void;
  initialStatus?: EmailDomainStatusSummary | null;
  onStatusChanged?: (summary: EmailDomainStatusSummary) => void;
  defaultSenderName?: string;
}

function getDnsStatusVisual(statusRaw?: string) {
  const s = String(statusRaw || 'pending').toLowerCase();
  if (s === 'verified') {
    return {
      label: 'Verified',
      icon: CheckCircle2,
      textClass: 'text-emerald-700',
      bgClass: 'bg-emerald-50 border-emerald-200',
    };
  }
  if (s === 'failed' || s === 'temporary_failure') {
    return {
      label: s === 'temporary_failure' ? 'Temporary Failure' : 'Failed',
      icon: XCircle,
      textClass: 'text-rose-700',
      bgClass: 'bg-rose-50 border-rose-200',
    };
  }
  return {
    label: 'Pending DNS',
    icon: Clock,
    textClass: 'text-amber-700',
    bgClass: 'bg-amber-50 border-amber-200',
  };
}

export const CustomDomainEmailSettings: React.FC<CustomDomainEmailSettingsProps> = ({
  onBack,
  onNavigateToAutomations,
  isAuthenticated = true,
  onOpenAuth,
  initialStatus,
  onStatusChanged,
  defaultSenderName,
}) => {
  const [statusData, setStatusData] = useState<EmailDomainStatusSummary>(
    initialStatus || EMPTY_EMAIL_DOMAIN_STATUS
  );
  const [fromName, setFromName] = useState<string>(
    initialStatus?.sender?.fromName || defaultSenderName || ''
  );
  const [fromEmail, setFromEmail] = useState<string>(
    initialStatus?.sender?.fromEmail || ''
  );
  const [replyToEmail, setReplyToEmail] = useState<string>(
    initialStatus?.sender?.replyToEmail || ''
  );

  const [deliveryLogs, setDeliveryLogs] = useState<EmailDeliveryLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isRemoving, setIsRemoving] = useState<boolean>(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState<boolean>(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Test Email form
  const [testRecipient, setTestRecipient] = useState<string>('');
  const [testSubject, setTestSubject] = useState<string>('Custom Domain Verification Test');
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const detectedDomain = useMemo(() => extractDomainFromEmail(fromEmail), [fromEmail]);

  const liveInputValidation = useMemo(() => {
    if (!fromEmail.trim() && !fromName.trim()) return null;
    return validateCustomDomainEmailInput({ fromName: fromName || 'Preview', fromEmail });
  }, [fromEmail, fromName]);

  const applySummary = useCallback(
    (next: EmailDomainStatusSummary) => {
      setStatusData(next);
      if (next.sender) {
        setFromName(next.sender.fromName || '');
        setFromEmail(next.sender.fromEmail || '');
        setReplyToEmail(next.sender.replyToEmail || '');
      } else if (!fromName && defaultSenderName) {
        setFromName(defaultSenderName);
      }
      onStatusChanged?.(next);
    },
    [defaultSenderName, fromName, onStatusChanged]
  );

  const loadDomainStatus = useCallback(
    async (refresh = false) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const next = await fetchCustomDomainStatus({ refresh });
        applySummary(next);
        const logs = await fetchCustomDomainDeliveryLogs();
        setDeliveryLogs(logs);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Unable to load custom domain settings.');
      } finally {
        setIsLoading(false);
      }
    },
    [applySummary]
  );

  useEffect(() => {
    void loadDomainStatus(false);
  }, [isAuthenticated, loadDomainStatus]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      // Clipboard blocked
    }
  };

  const handleConnectOrSaveSender = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessBanner(null);

    if (!isAuthenticated) {
      setErrorMessage('Please sign in to connect a custom email domain to your account.');
      onOpenAuth?.();
      return;
    }

    const validation = validateCustomDomainEmailInput({ fromName, fromEmail });
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid sender name or custom domain email.');
      return;
    }

    setIsSaving(true);
    try {
      const sameConnectedDomain =
        Boolean(statusData.domain) &&
        statusData.domain.toLowerCase() === validation.domain.toLowerCase();

      if (sameConnectedDomain) {
        const res = await updateCustomEmailSender({
          fromName: validation.cleanName,
          fromEmail: validation.cleanEmail,
          replyToEmail: replyToEmail.trim() || undefined,
        });
        const nextSummary: EmailDomainStatusSummary = {
          ...statusData,
          sender: res.sender,
          senders: res.senders,
        };
        applySummary(nextSummary);
        setSuccessBanner(res.message);
      } else {
        const res = await connectCustomDomain({
          fromName: validation.cleanName,
          fromEmail: validation.cleanEmail,
          replyToEmail: replyToEmail.trim() || undefined,
        });
        applySummary(res.summary);
        setSuccessBanner(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to connect custom domain.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyDomain = async () => {
    if (!statusData.domain) return;
    setIsVerifying(true);
    setErrorMessage(null);
    setSuccessBanner(null);
    try {
      const res = await verifyCustomDomainDns();
      const nextSummary: EmailDomainStatusSummary = {
        ...statusData,
        domain: res.domain || statusData.domain,
        status: res.status,
        verified: res.verified,
        records: res.records.length > 0 ? res.records : statusData.records,
        domainRecord: res.domainRecord || statusData.domainRecord,
      };
      applySummary(nextSummary);
      setSuccessBanner(res.message);
      const logs = await fetchCustomDomainDeliveryLogs();
      setDeliveryLogs(logs);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to verify DNS records right now.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConfirmRemoveDomain = async () => {
    setIsRemoving(true);
    setErrorMessage(null);
    setSuccessBanner(null);
    try {
      const res = await removeCustomDomain();
      setConfirmRemoveOpen(false);
      setFromEmail('');
      setReplyToEmail('');
      applySummary({
        ...EMPTY_EMAIL_DOMAIN_STATUS,
        loaded: true,
        resendConfigured: statusData.resendConfigured,
      });
      setDeliveryLogs([]);
      setSuccessBanner(res.message);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to remove custom domain.');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestResult(null);
    if (!statusData.verified || statusData.status !== 'verified') {
      setTestResult({
        success: false,
        message: 'Verify your custom domain DNS records before sending test emails.',
      });
      return;
    }
    if (!testRecipient.trim() || !testRecipient.includes('@')) {
      setTestResult({
        success: false,
        message: 'Enter a valid recipient email address.',
      });
      return;
    }

    setIsSendingTest(true);
    try {
      const senderLabel = statusData.sender?.fromName || fromName || statusData.domain;
      const senderAddress = statusData.sender?.fromEmail || fromEmail;
      const result = await sendCustomDomainTestEmail({
        to: testRecipient.trim(),
        subject: testSubject.trim() || 'FlowPilot Custom Domain Test',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; background: #f8fafc; border-radius: 12px; color: #0f172a;">
            <h2 style="color: #2563eb; margin-top: 0;">Custom Domain Verified &amp; Active</h2>
            <p>This live test email was sent through FlowPilot's centralized Resend infrastructure using your verified custom domain.</p>
            <div style="padding: 12px 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; margin: 16px 0;">
              <strong>From:</strong> ${senderLabel} &lt;${senderAddress}&gt;<br/>
              <strong>Domain:</strong> ${statusData.domain}
            </div>
            <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">Automated campaigns and workflow emails for your account are now enabled.</p>
          </div>
        `,
        text: `Custom Domain Verified & Active. Sent from ${senderLabel} <${senderAddress}> (${statusData.domain}).`,
        replyTo: replyToEmail.trim() || undefined,
      });

      setTestResult({
        success: true,
        message: `${result.message}${result.id ? ` (Message ID: ${result.id})` : ''}`,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Test email failed.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const hasDomain = Boolean(statusData.domain);
  const isVerified = Boolean(statusData.verified && statusData.status === 'verified');
  const records: EmailDnsRecord[] = statusData.records || [];
  const hasDmarcRecord = records.some(
    (r) =>
      String(r.name || '').toLowerCase().includes('_dmarc') ||
      String(r.value || '').toLowerCase().includes('v=dmarc1')
  );
  const domainStatusVisual = getDnsStatusVisual(statusData.status);
  const DomainStatusIcon = domainStatusVisual.icon;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
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
            <span className="text-blue-600 font-semibold">Custom Domain Email Automation</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Custom Domain Email Settings
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Connect your business domain to send automated campaigns and workflow emails under your
            own brand—managed securely on FlowPilot’s email infrastructure.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void loadDomainStatus(true)}
            disabled={isLoading || !isAuthenticated}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
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
              <span>Workflow Builder</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Sign-in guard */}
      {!isAuthenticated && (
        <div className="p-5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">Sign in required to manage custom email domains</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Custom domains are isolated per FlowPilot account. Sign in to connect and verify
                your domain.
              </p>
            </div>
          </div>
          {onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      )}

      {/* Server configuration notice if RESEND_API_KEY missing */}
      {isAuthenticated && statusData.loaded && !statusData.resendConfigured && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-900">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong>Platform Email Infrastructure Notice:</strong> The server environment variable{' '}
            <code className="font-mono bg-rose-100 px-1 rounded">RESEND_API_KEY</code> is not
            configured yet. Contact your platform administrator to enable live domain registration
            and sending.
          </div>
        </div>
      )}

      {/* Domain Status Summary Banner */}
      {isAuthenticated && hasDomain && (
        <div
          className={`p-4 rounded-2xl border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isVerified
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white ${
                isVerified ? 'bg-emerald-600' : 'bg-amber-600'
              }`}
            >
              <DomainStatusIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  className={`text-sm font-bold ${
                    isVerified ? 'text-emerald-950' : 'text-amber-950'
                  }`}
                >
                  {isVerified
                    ? `Domain ${statusData.domain} verified — automated sending active`
                    : `Domain ${statusData.domain} pending DNS verification`}
                </h3>
              </div>
              <p
                className={`text-xs mt-0.5 ${
                  isVerified ? 'text-emerald-800' : 'text-amber-900'
                }`}
              >
                {isVerified
                  ? `Outbound emails send as ${statusData.sender?.fromName || fromName} <${
                      statusData.sender?.fromEmail || fromEmail
                    }>.`
                  : 'Automated campaign and workflow email sends are blocked until your DNS records verify.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold ${domainStatusVisual.bgClass} ${domainStatusVisual.textClass}`}
            >
              <DomainStatusIcon className="w-3.5 h-3.5" />
              <span>{domainStatusVisual.label}</span>
            </span>
            <button
              type="button"
              onClick={() => setConfirmRemoveOpen(true)}
              className="p-2 text-slate-500 hover:text-rose-600 bg-white/80 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Disconnect & remove custom domain"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Alerts */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-900 rounded-2xl flex items-start gap-2.5 font-medium">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-950 rounded-2xl flex items-start gap-2.5 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* STEP 1: SENDER IDENTITY & CUSTOM DOMAIN CONNECTION */}
      <div className="bg-white dark:bg-[#0D1322] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
            Step 1 · Sender Identity &amp; Custom Domain
          </span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
            Configure Your From Name &amp; Business Email
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Enter the sender name and custom domain email address your recipients will see. Free
            webmail addresses (Gmail, Yahoo, Outlook, etc.) cannot be verified as custom domains.
          </p>
        </div>

        <form onSubmit={handleConnectOrSaveSender} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                From Name *
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Musa Store"
                disabled={!isAuthenticated}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Display name recipients see in their inbox (e.g., Musa Store).
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                From Email *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  maxLength={150}
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="hello@musa.com"
                  disabled={!isAuthenticated}
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm font-mono font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Must belong to your own custom domain (e.g., hello@musa.com).
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Reply-To Email (Optional)
              </label>
              <input
                type="email"
                maxLength={150}
                value={replyToEmail}
                onChange={(e) => setReplyToEmail(e.target.value)}
                placeholder="support@musa.com (defaults to From Email)"
                disabled={!isAuthenticated}
                className="w-full px-3.5 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Automatic Domain Detection Display */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-slate-600 dark:text-slate-300">
                Detected Domain:{' '}
                <strong className="font-mono text-slate-900 dark:text-white">
                  {detectedDomain || 'Enter a custom domain email above'}
                </strong>
              </span>
            </div>
            {liveInputValidation && fromEmail.includes('@') && !liveInputValidation.valid && (
              <span className="text-rose-600 font-semibold">{liveInputValidation.error}</span>
            )}
            {liveInputValidation?.valid && (
              <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Valid custom domain
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-slate-500">
              No API keys required. FlowPilot handles Resend domain provisioning centrally.
            </span>
            <button
              type="submit"
              disabled={isSaving || !isAuthenticated}
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {isSaving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>
                {isSaving
                  ? 'Saving...'
                  : hasDomain && statusData.domain.toLowerCase() === detectedDomain
                  ? 'Save Sender Identity'
                  : hasDomain
                  ? 'Connect New Domain'
                  : 'Connect Domain & Generate DNS Records'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* STEP 2: DYNAMIC DNS RECORDS RETURNED BY RESEND */}
      {hasDomain && (
        <div className="bg-white dark:bg-[#0D1322] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
                Step 2 · DNS Verification
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                Add These DNS Records to Your Domain
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                To activate your custom email address, add the DNS records below to your domain
                provider, such as Namecheap, GoDaddy or Cloudflare.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleVerifyDomain()}
              disabled={isVerifying}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2 shrink-0"
            >
              {isVerifying ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>{isVerifying ? 'Checking DNS...' : 'Verify Domain'}</span>
            </button>
          </div>

          {records.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                No DNS records were returned yet for <strong>{statusData.domain}</strong>. Click{' '}
                <strong>Refresh Status</strong> or <strong>Verify Domain</strong> to fetch records
                from Resend.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((rec, index) => {
                const recVisual = getDnsStatusVisual(rec.status || statusData.status);
                const RecIcon = recVisual.icon;
                const recRole = rec.record || `Record ${index + 1}`;
                return (
                  <div
                    key={`${rec.type}_${rec.name}_${index}`}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono font-bold text-[11px]">
                          {rec.type}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {recRole}
                        </span>
                        {rec.priority !== undefined && rec.priority !== null && (
                          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                            Priority: {rec.priority}
                          </span>
                        )}
                        {rec.ttl && (
                          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                            TTL: {String(rec.ttl)}
                          </span>
                        )}
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-[11px] font-bold ${recVisual.bgClass} ${recVisual.textClass}`}
                      >
                        <RecIcon className="w-3 h-3" />
                        <span>{recVisual.label}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-500">
                            Host / Name
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleCopy(rec.name, `host_${index}`)}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey === `host_${index}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-600">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="p-2.5 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 break-all select-all">
                          {rec.name}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-500">Value</span>
                          <button
                            type="button"
                            onClick={() => void handleCopy(rec.value, `val_${index}`)}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey === `val_${index}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-600">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="p-2.5 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 break-all select-all">
                          {rec.value}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Optional DMARC Guidance when Resend does not return a DMARC record */}
          {!hasDmarcRecord && (
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-950">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Recommended DMARC Record (Optional Deliverability Boost)</span>
              </div>
              <p className="text-xs text-blue-900">
                Adding a DMARC TXT record improves inbox placement at Gmail and Yahoo even though
                Resend only requires the SPF/DKIM records above for verification:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono">
                <div className="p-2 bg-white rounded-lg border border-blue-200 flex items-center justify-between gap-2">
                  <span className="truncate">_dmarc.{statusData.domain}</span>
                  <button
                    type="button"
                    onClick={() => void handleCopy(`_dmarc.${statusData.domain}`, 'dmarc_host')}
                    className="text-[11px] font-sans font-bold text-blue-600 cursor-pointer shrink-0"
                  >
                    {copiedKey === 'dmarc_host' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="p-2 bg-white rounded-lg border border-blue-200 flex items-center justify-between gap-2">
                  <span className="truncate">v=DMARC1; p=none;</span>
                  <button
                    type="button"
                    onClick={() => void handleCopy('v=DMARC1; p=none;', 'dmarc_val')}
                    className="text-[11px] font-sans font-bold text-blue-600 cursor-pointer shrink-0"
                  >
                    {copiedKey === 'dmarc_val' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 3: SEND TEST EMAIL & RECENT LOGS */}
      {hasDomain && (
        <div className="bg-white dark:bg-[#0D1322] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
                Step 3 · Test Verified Email Delivery
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Send a Test Email from {statusData.sender?.fromEmail || `hello@${statusData.domain}`}
              </h2>
            </div>
            <span className="text-[11px] font-mono font-semibold text-slate-500">
              {isVerified ? 'Verified · Ready to Send' : 'Blocked Until Verified'}
            </span>
          </div>

          {!isVerified && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Test sending and automated campaign/workflow emails are locked while{' '}
                <strong>{statusData.domain}</strong> is <strong>{statusData.status}</strong>. Add
                your DNS records and click <strong>Verify Domain</strong> above first.
              </span>
            </div>
          )}

          <form onSubmit={handleSendTest} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Recipient Email *
                </label>
                <input
                  type="email"
                  required
                  disabled={!isVerified}
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Subject Line *
                </label>
                <input
                  type="text"
                  required
                  disabled={!isVerified}
                  value={testSubject}
                  onChange={(e) => setTestSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={!isVerified || isSendingTest}
                className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                {isSendingTest ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isSendingTest ? 'Sending...' : 'Send Test Email'}</span>
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

          {deliveryLogs.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recent Resend Webhook &amp; Delivery Events
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {deliveryLogs.slice(0, 8).map((log) => (
                  <div
                    key={log.id}
                    className="px-3.5 py-2.5 bg-slate-50/70 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {log.eventType}
                      </span>
                      {log.to && (
                        <span className="text-slate-500 ml-2 truncate">→ {log.to}</span>
                      )}
                      {log.detail && log.detail !== log.eventType && (
                        <span className="text-slate-500 ml-2">· {log.detail}</span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0 tabular-nums">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* In-App Confirmation Modal for Domain Removal */}
      {confirmRemoveOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Remove {statusData.domain}?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  This removes the custom domain from your FlowPilot account and Resend. Automated
                  emails will be paused until you connect and verify a new custom domain.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRemoveOpen(false)}
                disabled={isRemoving}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmRemoveDomain()}
                disabled={isRemoving}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isRemoving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isRemoving ? 'Removing...' : 'Remove Domain'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
