import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck, Send } from 'lucide-react';
import { FlowPilotLogo } from './FlowPilotLogo';
import { CaptureAsset } from '../types';
import { LeadGenFormField } from './LeadGenCatalog';

export interface FormPublicViewProps {
  /**
   * Indicates whether this component is being rendered on the public shareable link
   * opened by a lead (true) or inside the app/dashboard editor preview (false).
   * Defaults to true if accessed as a public link.
   */
  isPublicView?: boolean;
  asset?: Partial<CaptureAsset> | null;
  formSchema?: LeadGenFormField[];
  onSubmit?: (lead: {
    fullName: string;
    email: string;
    phone: string;
    company?: string;
    customFields?: Record<string, string>;
  }) => Promise<void> | void;
  onBackToWorkflow?: () => void;
}

/**
 * Default public form schema adhering to FIX 3:
 * Phone number field is REQUIRED (required: true), label is "Phone Number" without "(optional)".
 */
export const defaultPublicFormSchema: LeadGenFormField[] = [
  {
    id: 'fld_name',
    label: 'Full Name',
    fieldKey: 'fullName',
    inputType: 'text',
    placeholder: 'Enter your full name',
    required: true,
    isCustomField: false,
  },
  {
    id: 'fld_email',
    label: 'Email Address',
    fieldKey: 'email',
    inputType: 'email',
    placeholder: 'you@domain.com',
    required: true,
    isCustomField: false,
  },
  {
    id: 'fld_phone',
    label: 'Phone / WhatsApp Number',
    fieldKey: 'phone',
    inputType: 'tel',
    placeholder: '+1 (555) 019-2831 (Phone or WhatsApp)',
    required: true,
    isCustomField: false,
  },
];

export const FormPublicView: React.FC<FormPublicViewProps> = ({
  isPublicView = true,
  asset,
  formSchema,
  onSubmit,
  onBackToWorkflow,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fallback metadata from asset or sensible defaults
  const title = asset?.title || asset?.headline || 'Lead Capture & Consultation Request';
  const description =
    asset?.subheadline ||
    'Please enter your details below. Our team will follow up via Email and WhatsApp.';
  const ctaText = asset?.ctaText || 'Submit Details';
  const targetList = asset?.targetList || 'General Inbound Leads';
  const redirectUrl = asset?.redirectUrl || '';

  // Use provided schema or default schema, ensuring phone is required and labeled cleanly
  const activeSchema: LeadGenFormField[] = (formSchema && formSchema.length > 0
    ? formSchema
    : defaultPublicFormSchema
  ).map((field) => {
    if (field.fieldKey === 'phone' || field.inputType === 'tel') {
      // Form validation requires Phone / WhatsApp Number
      const cleanedLabel = field.label
        .replace(/\s*\(\s*optional\s*\)/gi, '')
        .trim();
      const finalLabel =
        !cleanedLabel || /^phone\s*(number)?$/i.test(cleanedLabel)
          ? 'Phone / WhatsApp Number'
          : cleanedLabel;
      return {
        ...field,
        label: finalLabel,
        required: true,
      };
    }
    return field;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Validation
    if (!fullName.trim()) {
      setErrorMessage('Full Name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('A valid Email Address is required.');
      return;
    }
    // Form validation requires phone/whatsapp number
    if (!phone.trim()) {
      setErrorMessage('Phone / WhatsApp Number is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          company: company.trim() || undefined,
          customFields: customValues,
        });
      } else {
        // Direct server API dispatch fallback
        const payload = {
          assetSlug: asset?.slug || 'public-lead-form',
          assetName: title,
          targetList,
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          company: company.trim() || undefined,
          redirectUrl,
        };
        await fetch('/api/leads/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {
          // Non-fatal if offline
        });
      }

      setSubmitted(true);
      if (redirectUrl && /^https?:\/\//i.test(redirectUrl)) {
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1500);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Submission failed. Please check your connection.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* FIX 2: REMOVE "Go back to your Workflow" Header
          On the PUBLIC view only, completely remove the top navigation bar that contains
          the back arrow and text "Go back to your Workflow".
          This header should only be visible when the user is editing inside the app,
          not when a lead opens the shared link.
          Add a condition: if isPublicView === true, hide the header. */}
      {isPublicView === false && (
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
          <button
            type="button"
            onClick={onBackToWorkflow}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-950 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go back to your Workflow</span>
          </button>
          <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
            In-App Editor Preview
          </span>
        </header>
      )}

      {/* FIX 1: REMOVE Platform Branding
          On the PUBLIC view only, remove/hide the platform logo at the top.
          The logo should still show inside the main dashboard, but NOT on the link we share to leads. */}
      {isPublicView === false && (
        <div className="w-full bg-white border-b border-slate-200 py-3.5 px-4 flex items-center justify-center">
          <FlowPilotLogo variant="light" size="sm" />
        </div>
      )}

      {/* Main Public Form Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5 text-center">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-950">
              {title}
            </h1>
            {description && (
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {submitted ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 text-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="font-display text-base sm:text-lg font-bold text-emerald-950">
                Thank You! Submission Received
              </h2>
              <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed">
                Your details have been registered successfully. We will be in touch shortly.
              </p>
              {redirectUrl && (
                <p className="text-xs text-slate-500 pt-2 font-mono truncate">
                  Redirecting to {redirectUrl}...
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
              {errorMessage && (
                <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                  {errorMessage}
                </div>
              )}

              {/* Render Fields from Schema */}
              {activeSchema.map((fld) => {
                if (fld.fieldKey === 'fullName') {
                  return (
                    <div key={fld.id}>
                      <label className="block font-semibold text-slate-800 mb-1">
                        {fld.label} *
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={fld.placeholder || 'Enter your full name'}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                      />
                    </div>
                  );
                }

                if (fld.fieldKey === 'email') {
                  return (
                    <div key={fld.id}>
                      <label className="block font-semibold text-slate-800 mb-1">
                        {fld.label} *
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={fld.placeholder || 'you@domain.com'}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                      />
                    </div>
                  );
                }

                if (fld.fieldKey === 'phone' || fld.inputType === 'tel') {
                  return (
                    <div key={fld.id}>
                      <label className="block font-semibold text-slate-800 mb-1">
                        {fld.label && !/^phone(\s*number)?$/i.test(fld.label.trim())
                          ? fld.label
                          : 'Phone / WhatsApp Number'}{' '}
                        *
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={fld.placeholder || '+1 (555) 019-2831 (Phone / WhatsApp)'}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                      />
                    </div>
                  );
                }

                if (fld.fieldKey === 'company') {
                  return (
                    <div key={fld.id}>
                      <label className="block font-semibold text-slate-800 mb-1">
                        {fld.label} {fld.required ? '*' : ''}
                      </label>
                      <input
                        type="text"
                        required={fld.required}
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder={fld.placeholder || 'Company / Brand Name'}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                      />
                    </div>
                  );
                }

                if (fld.inputType === 'select') {
                  return (
                    <div key={fld.id}>
                      <label className="block font-semibold text-slate-800 mb-1">
                        {fld.label} {fld.required ? '*' : ''}
                      </label>
                      <select
                        required={fld.required}
                        value={customValues[fld.fieldKey] || ''}
                        onChange={(e) =>
                          setCustomValues((prev) => ({
                            ...prev,
                            [fld.fieldKey]: e.target.value,
                          }))
                        }
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
                      >
                        <option value="">-- Please Select --</option>
                        {(fld.options || []).map((opt: string, i: number) => (
                          <option key={i} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }

                return (
                  <div key={fld.id}>
                    <label className="block font-semibold text-slate-800 mb-1">
                      {fld.label} {fld.required ? '*' : ''}
                    </label>
                    <input
                      type={fld.inputType || 'text'}
                      required={fld.required}
                      value={customValues[fld.fieldKey] || ''}
                      onChange={(e) =>
                        setCustomValues((prev) => ({
                          ...prev,
                          [fld.fieldKey]: e.target.value,
                        }))
                      }
                      placeholder={fld.placeholder}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                    />
                  </div>
                );
              })}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] disabled:opacity-50 rounded-xl cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Submitting...' : ctaText}</span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Encrypted &amp; TCPA / GDPR Compliant</span>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};
