import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Zap,
  HelpCircle,
  Eye,
  Sliders,
  Sparkles,
} from 'lucide-react';

export interface WhatsAppTemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
}

export interface WhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO';
  text?: string;
  buttons?: WhatsAppTemplateButton[];
}

export interface WhatsAppTemplateItem {
  id?: string;
  waba_id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  rejected_reason?: string;
  components: WhatsAppTemplateComponent[];
  createdAt?: string;
  updatedAt?: string;
}

interface WhatsAppTemplatesViewProps {
  userId?: string;
  userEmail?: string;
  onBackToDashboard?: () => void;
  onNavigateToConnect?: () => void;
}

export const WhatsAppTemplatesView: React.FC<WhatsAppTemplatesViewProps> = ({
  userId = 'admin_user',
  userEmail = 'jonajukej777@gmail.com',
  onBackToDashboard,
  onNavigateToConnect,
}) => {
  // Account Status State
  const [checkingAccount, setCheckingAccount] = useState<boolean>(true);
  const [wabaId, setWabaId] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [isAccountConnected, setIsAccountConnected] = useState<boolean>(false);

  // Templates State
  const [templates, setTemplates] = useState<WhatsAppTemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'>('ALL');

  // Form State
  const [showCreateForm, setShowCreateForm] = useState<boolean>(true);
  const [templateName, setTemplateName] = useState<string>('lead_welcome_gift');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY'>('MARKETING');
  const [language, setLanguage] = useState<string>('en_US');
  const [headerText, setHeaderText] = useState<string>('Exclusive Flowpilot Offer');
  const [bodyText, setBodyText] = useState<string>(
    'Hello {{1}}, thanks for checking out Flowpilot! Here is your access link: {{2}}. Let us know if you have any questions.'
  );
  const [footerText, setFooterText] = useState<string>('Reply STOP to unsubscribe');
  const [buttonType, setButtonType] = useState<'NONE' | 'QUICK_REPLY' | 'URL'>('QUICK_REPLY');
  const [buttonText, setButtonText] = useState<string>('Claim Offer');
  const [buttonUrl, setButtonUrl] = useState<string>('https://flowpilot.app/offer');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [deletingTemplateName, setDeletingTemplateName] = useState<string | null>(null);

  // Live Preview Variable Replacements
  const [previewVar1, setPreviewVar1] = useState<string>('Alex');
  const [previewVar2, setPreviewVar2] = useState<string>('https://flowpilot.app/vip');

  // 1. Fetch WhatsApp Account connection status & WABA_ID
  const checkStatus = async () => {
    setCheckingAccount(true);
    try {
      const res = await fetch(`/api/whatsapp/status?userId=${encodeURIComponent(userId)}`, {
        headers: { 'x-user-id': userId },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.connected && data.account && data.account.waba_id) {
          setIsAccountConnected(true);
          setWabaId(data.account.waba_id);
          setPhoneNumberId(data.account.phone_number_id || null);
          setWhatsappNumber(data.account.whatsapp_number || data.account.display_phone_number || null);
          // Fetch templates
          loadTemplates(data.account.waba_id);
        } else {
          setIsAccountConnected(false);
          setWabaId(null);
        }
      }
    } catch (err: any) {
      console.warn('Could not verify WhatsApp connection:', err);
    } finally {
      setCheckingAccount(false);
    }
  };

  // 2. Fetch list of templates for this WABA
  const loadTemplates = async (targetWabaId?: string) => {
    setLoadingTemplates(true);
    setError(null);
    try {
      const res = await fetch(`/api/whatsapp/templates?userId=${encodeURIComponent(userId)}`, {
        headers: { 'x-user-id': userId },
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTemplates(data.templates || []);
      } else {
        setError(data.error || 'Failed to retrieve WhatsApp templates.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching templates.');
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [userId]);

  // Template Name validation & sanitizer helper
  const handleTemplateNameChange = (val: string) => {
    // lowercase letters, numbers, and underscores only
    const sanitized = val
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');
    setTemplateName(sanitized);
  };

  // Insert variable tag into body text
  const insertVariableTag = (varNum: number) => {
    const tag = `{{${varNum}}}`;
    setBodyText((prev) => `${prev} ${tag}`);
  };

  // 3. Create Template (POST /api/whatsapp/templates)
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    const cleanName = templateName.trim().toLowerCase();
    if (!cleanName || !/^[a-z0-9_]+$/.test(cleanName)) {
      setError('Template Name must contain only lowercase letters, numbers, and underscores (e.g. welcome_offer_1).');
      return;
    }

    if (!bodyText.trim()) {
      setError('Template Body is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const buttonsList: WhatsAppTemplateButton[] = [];
      if (buttonType === 'QUICK_REPLY' && buttonText.trim()) {
        buttonsList.push({ type: 'QUICK_REPLY', text: buttonText.trim() });
      } else if (buttonType === 'URL' && buttonText.trim() && buttonUrl.trim()) {
        buttonsList.push({ type: 'URL', text: buttonText.trim(), url: buttonUrl.trim() });
      }

      const res = await fetch('/api/whatsapp/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          name: cleanName,
          category,
          language,
          header: headerText.trim() || undefined,
          body: bodyText.trim(),
          footer: footerText.trim() || undefined,
          buttons: buttonsList.length > 0 ? buttonsList : undefined,
          userId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to create WhatsApp template on Meta.');
      }

      setSuccessNotice(data.message || `Template "${cleanName}" created successfully!`);
      // Reload templates list
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Error creating template');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Delete Template (DELETE /api/whatsapp/templates/:name)
  const handleDeleteTemplate = async (name: string) => {
    if (!window.confirm(`Are you sure you want to delete template "${name}" from your WhatsApp Business Account?`)) {
      return;
    }

    setDeletingTemplateName(name);
    setError(null);
    setSuccessNotice(null);

    try {
      const res = await fetch(`/api/whatsapp/templates/${encodeURIComponent(name)}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': userId,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Failed to delete template "${name}".`);
      }

      setSuccessNotice(data.message || `Template "${name}" deleted successfully.`);
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Error deleting template');
    } finally {
      setDeletingTemplateName(null);
    }
  };

  // Compute live preview text with variables replaced
  const renderedPreviewBody = React.useMemo(() => {
    let result = bodyText;
    result = result.replace(/\{\{1\}\}/g, previewVar1 || '{{1}}');
    result = result.replace(/\{\{2\}\}/g, previewVar2 || '{{2}}');
    return result;
  }, [bodyText, previewVar1, previewVar2]);

  // Filtered templates list
  const filteredTemplates = templates.filter((t) => {
    if (statusFilter === 'ALL') return true;
    return t.status === statusFilter;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
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
              <span>WhatsApp</span>
              <span>/</span>
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                Template Creator
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onNavigateToConnect && (
              <button
                type="button"
                onClick={onNavigateToConnect}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>Connection Status</span>
              </button>
            )}

            {wabaId && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-mono text-[11px] font-bold border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                WABA: {wabaId}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Banner */}
        <div className="rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white p-7 sm:p-9 relative overflow-hidden shadow-xl border border-emerald-800/40">
          <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-400/30">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>PART 2 · WhatsApp Cloud API Message Templates</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
              WhatsApp Template Creator
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Design and submit official Meta WhatsApp message templates with dynamic <code className="font-mono text-emerald-300 bg-emerald-950/80 px-1 py-0.5 rounded">{'{{1}}'}</code> variable
              personalization. Only <span className="font-bold text-emerald-300">APPROVED</span> templates can be used in automations.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Meta Graph API v21.0 Message Templates</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Only APPROVED templates allowed in automations</span>
              </div>
            </div>
          </div>
        </div>

        {/* CONDITION: ONLY SHOW IF USER HAS WABA_ID */}
        {!checkingAccount && !isAccountConnected ? (
          <div className="bg-white rounded-3xl border border-amber-300 p-8 sm:p-12 shadow-sm text-center space-y-5 max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">
                WhatsApp Business Account Not Connected
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                To create and manage official WhatsApp message templates, you must first connect your
                WhatsApp Business Account (WABA) via Facebook Embedded Signup.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={onNavigateToConnect}
                className="px-6 py-3 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-md cursor-pointer transition-colors inline-flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Connect WhatsApp with Facebook</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Notifications */}
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">Notice</div>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {successNotice && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">Template Sync Complete</div>
                  <p>{successNotice}</p>
                </div>
              </div>
            )}

            {/* Template Creator Form & Live Preview Simulator */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (7 cols): Creation Form */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-emerald-600" />
                        <span>Create New Message Template</span>
                      </h2>
                      <p className="text-xs text-slate-500">
                        Submitted directly to Meta Graph API for review and instant approval.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                      POST /{'{WABA_ID}'}/message_templates
                    </span>
                  </div>

                  <form onSubmit={handleCreateTemplate} className="space-y-4 text-xs">
                    {/* Template Name */}
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Template Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => handleTemplateNameChange(e.target.value)}
                        placeholder="e.g. welcome_offer_1 or lead_confirmation"
                        className="w-full px-3.5 py-2 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600"
                        required
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Only lowercase alphanumeric characters and underscores allowed (<code className="font-mono text-slate-700">^[a-z0-9_]+$</code>).
                      </p>
                    </div>

                    {/* Category & Language Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-800 mb-1">
                          Category <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value as any)}
                          className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                        >
                          <option value="MARKETING">MARKETING (Offers, Promotions, Follow-ups)</option>
                          <option value="UTILITY">UTILITY (Confirmations, Account Updates, Alerts)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-800 mb-1">
                          Language <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                        >
                          <option value="en_US">en_US (English US)</option>
                          <option value="en_GB">en_GB (English UK)</option>
                          <option value="es_ES">es_ES (Spanish)</option>
                          <option value="pt_BR">pt_BR (Portuguese Brazil)</option>
                          <option value="fr_FR">fr_FR (French)</option>
                          <option value="de_DE">de_DE (German)</option>
                          <option value="ar">ar (Arabic)</option>
                        </select>
                      </div>
                    </div>

                    {/* Optional Header */}
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Header (Optional text banner)
                      </label>
                      <input
                        type="text"
                        value={headerText}
                        onChange={(e) => setHeaderText(e.target.value)}
                        placeholder="e.g. Flowpilot Account Update"
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                      />
                    </div>

                    {/* Body Textarea with Variable Helpers */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-slate-800">
                          Body Text <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-500">Insert Variable:</span>
                          <button
                            type="button"
                            onClick={() => insertVariableTag(1)}
                            className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-mono font-bold text-[10px] cursor-pointer"
                          >
                            + {'{{1}}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => insertVariableTag(2)}
                            className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-mono font-bold text-[10px] cursor-pointer"
                          >
                            + {'{{2}}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => insertVariableTag(3)}
                            className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-mono font-bold text-[10px] cursor-pointer"
                          >
                            + {'{{3}}'}
                          </button>
                        </div>
                      </div>
                      <textarea
                        rows={4}
                        value={bodyText}
                        onChange={(e) => setBodyText(e.target.value)}
                        placeholder="Type message body with variables like {{1}} and {{2}}..."
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 leading-relaxed"
                        required
                      />
                    </div>

                    {/* Optional Footer */}
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Footer (Optional small text)
                      </label>
                      <input
                        type="text"
                        value={footerText}
                        onChange={(e) => setFooterText(e.target.value)}
                        placeholder="e.g. Reply STOP to opt out"
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                      />
                    </div>

                    {/* Buttons Section */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">Interactive Buttons</span>
                        <div className="flex items-center gap-1">
                          {(['NONE', 'QUICK_REPLY', 'URL'] as const).map((bType) => (
                            <button
                              key={bType}
                              type="button"
                              onClick={() => setButtonType(bType)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                buttonType === bType
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {bType === 'NONE' ? 'None' : bType === 'QUICK_REPLY' ? 'Quick Reply' : 'Website URL'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {buttonType !== 'NONE' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Button Label Text
                            </label>
                            <input
                              type="text"
                              value={buttonText}
                              onChange={(e) => setButtonText(e.target.value)}
                              placeholder="e.g. Claim Offer"
                              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                            />
                          </div>
                          {buttonType === 'URL' && (
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Destination URL
                              </label>
                              <input
                                type="url"
                                value={buttonUrl}
                                onChange={(e) => setButtonUrl(e.target.value)}
                                placeholder="https://flowpilot.app/offer"
                                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Submit Action */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 px-5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                      >
                        <Zap className="w-4 h-4" />
                        <span>{isSubmitting ? 'Submitting to Meta Graph API...' : 'Create & Submit Template'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Right Column (5 cols): Live WhatsApp Phone Simulator Preview */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-bold text-slate-900">Live WhatsApp Chat Bubble</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">Real-time Render</span>
                  </div>

                  {/* Sample Variable Inputs */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <span className="font-bold text-slate-700 text-[11px]">Preview Sample Variables:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500">{'{{1}}'} value:</span>
                        <input
                          type="text"
                          value={previewVar1}
                          onChange={(e) => setPreviewVar1(e.target.value)}
                          className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded font-semibold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-slate-500">{'{{2}}'} value:</span>
                        <input
                          type="text"
                          value={previewVar2}
                          onChange={(e) => setPreviewVar2(e.target.value)}
                          className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Phone Mockup Screen */}
                  <div className="rounded-3xl bg-[#0b141a] p-3 sm:p-4 text-white shadow-lg border-4 border-slate-800 relative">
                    {/* Chat Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-xs">
                          FP
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-100 flex items-center gap-1">
                            <span>Flowpilot</span>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 fill-emerald-400/20" />
                          </div>
                          <div className="text-[9px] text-emerald-400 font-mono">Official Business Account</div>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">v21.0</span>
                    </div>

                    {/* WhatsApp Speech Bubble */}
                    <div className="bg-[#202c33] rounded-2xl p-3.5 space-y-2 max-w-[95%] shadow-md border border-slate-700/40 text-slate-200 text-xs">
                      {headerText && (
                        <div className="font-bold text-emerald-400 text-xs pb-1 border-b border-slate-700/60">
                          {headerText}
                        </div>
                      )}

                      <div className="text-[12px] leading-relaxed whitespace-pre-wrap text-slate-100">
                        {renderedPreviewBody || 'Your message body will appear here...'}
                      </div>

                      {footerText && (
                        <div className="text-[10px] text-slate-400 pt-1">
                          {footerText}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 font-mono pt-1">
                        <span>12:45 PM</span>
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                      </div>
                    </div>

                    {/* Interactive Buttons */}
                    {buttonType !== 'NONE' && buttonText && (
                      <div className="mt-2 space-y-1.5 max-w-[95%]">
                        <div className="py-2 px-3 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-emerald-400 font-semibold text-center text-xs border border-slate-700/60 cursor-pointer flex items-center justify-center gap-1.5">
                          {buttonType === 'URL' && <ExternalLink className="w-3 h-3" />}
                          <span>{buttonText}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Table of Existing Templates (PART 2 Requirement) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>WhatsApp Templates ({templates.length})</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Live templates registered under WABA ID <code className="font-mono font-bold text-slate-700">{wabaId}</code>.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                    {(['ALL', 'APPROVED', 'PENDING', 'REJECTED'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setStatusFilter(tab)}
                        className={`px-3 py-1 rounded-md cursor-pointer transition-colors ${
                          statusFilter === tab
                            ? 'bg-white text-slate-900 shadow-xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => loadTemplates()}
                    disabled={loadingTemplates}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
                    title="Refresh Meta Graph API Templates"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingTemplates ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Requirement: Only APPROVED templates can be used in automation notice */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center gap-2.5 text-xs text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  <strong>Automation Rule:</strong> Only templates with <span className="font-bold underline">APPROVED</span> status can be selected and dispatched in your Flowpilot sequences and lead auto-responders.
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Template Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Language</th>
                      <th className="py-3 px-4">Body Preview</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {filteredTemplates.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          {loadingTemplates ? 'Fetching templates from Meta Graph API...' : 'No templates found in this view.'}
                        </td>
                      </tr>
                    ) : (
                      filteredTemplates.map((item) => {
                        const bodyComp = item.components?.find((c) => c.type === 'BODY');
                        const isApproved = item.status === 'APPROVED';
                        const isPending = item.status === 'PENDING';
                        const isRejected = item.status === 'REJECTED';

                        return (
                          <tr key={item.name} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{item.name}</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {item.category}
                              </span>
                            </td>

                            {/* Status (PENDING yellow, APPROVED green, REJECTED red with reason) */}
                            <td className="py-3.5 px-4">
                              {isApproved && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>APPROVED</span>
                                </span>
                              )}

                              {isPending && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>PENDING</span>
                                </span>
                              )}

                              {isRejected && (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                    <span>REJECTED</span>
                                  </span>
                                  {item.rejected_reason && (
                                    <div className="text-[10px] text-rose-700 font-normal max-w-xs leading-snug">
                                      {item.rejected_reason}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 font-mono text-slate-600">
                              {item.language}
                            </td>

                            <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 text-[11px]">
                              {bodyComp?.text || '—'}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                disabled={deletingTemplateName === item.name}
                                onClick={() => handleDeleteTemplate(item.name)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors disabled:opacity-40"
                                title="Delete Template from Meta"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
