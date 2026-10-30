import React, { useEffect } from 'react';
import {
  Shield,
  Lock,
  Eye,
  Server,
  FileText,
  CheckCircle2,
  ArrowLeft,
  Mail,
  Building,
  Globe,
  Database,
  UserCheck,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface PrivacyPolicyPageProps {
  onBack?: () => void;
}

export const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({ onBack }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Privacy Policy — FlowPilot';
  }, []);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    }
  };

  const lastUpdated = 'October 24, 2026';
  const effectiveDate = 'October 24, 2026';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-emerald-600 transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to FlowPilot</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              Meta Compliant
            </span>
            <a
              href="/"
              className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              flowpilot.app
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* Document Title Header */}
        <div className="border-b border-slate-200 pb-8 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-4">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            Official Platform Compliance & Data Protection
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
            FlowPilot (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy details how FlowPilot collects, uses, stores, and safeguards data when you access our marketing automation platform, omnichannel CRM, landing page generator, and our WhatsApp Cloud API webhook services.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-500">
            <div>
              <span className="font-semibold text-slate-700">Effective Date:</span> {effectiveDate}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Last Revised:</span> {lastUpdated}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Jurisdiction:</span> GDPR (EU), CCPA (California), Meta Platform Terms
            </div>
          </div>
        </div>

        {/* Quick Highlights / Trust Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">Zero Unsolicited Spam</h2>
            <p className="text-xs text-slate-600 mt-1">
              We only dispatch automated WhatsApp and email messages to leads who explicitly opted in or initiated conversation.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">End-to-End Meta Cloud</h2>
            <p className="text-xs text-slate-600 mt-1">
              Direct webhook processing via Meta&apos;s official Graph API (v20.0). No unauthorized scrapers or third-party credential reselling.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
              <UserCheck className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">Full Data Sovereignty</h2>
            <p className="text-xs text-slate-600 mt-1">
              You own your audience data. Export or delete contacts, conversation history, and workflow logs at any time.
            </p>
          </div>
        </div>

        {/* Policy Sections */}
        <div className="space-y-12 text-slate-700 text-sm sm:text-base leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-emerald-600 font-mono text-lg">01.</span>
              Information We Collect
            </h2>
            <p className="mb-4">
              When you use FlowPilot or interact with a FlowPilot-powered communication channel, we collect information necessary to facilitate automated marketing, CRM workflows, and customer support:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li>
                <strong className="text-slate-800">Account & Workspace Information:</strong> Name, business email address, company name, workspace settings, role assignments, and authentication credentials.
              </li>
              <li>
                <strong className="text-slate-800">Lead & Audience Data:</strong> Contact records you import, upload, or collect via FlowPilot capture forms, including names, email addresses, phone numbers, audience tags, and opt-in consent records.
              </li>
              <li>
                <strong className="text-slate-800">WhatsApp & Messaging Metadata:</strong> Sender phone numbers, inbound message text, message timestamps, webhook delivery receipts, and interaction metadata transmitted via Meta WhatsApp Cloud API webhooks.
              </li>
              <li>
                <strong className="text-slate-800">Automated Workflow Execution Logs:</strong> State history of visual automation nodes (triggers, delays, condition evaluations, and dispatched messages).
              </li>
              <li>
                <strong className="text-slate-800">Technical Device Data:</strong> IP addresses, browser types, and access timestamps collected automatically for operational stability and security auditing.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-emerald-600 font-mono text-lg">02.</span>
              How We Use Your Information
            </h2>
            <p className="mb-4">We process collected data solely for lawful business purposes:</p>
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-1 shrink-0" />
                <span>
                  <strong>Executing Inbound Webhooks & Auto-Replies:</strong> Processing incoming WhatsApp messages via <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs">/webhook/whatsapp</code> to trigger configured keyword responses (e.g. video links, confirmation prompts).
                </span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-1 shrink-0" />
                <span>
                  <strong>Drip & Scheduled Follow-ups:</strong> Calculating scheduled delay intervals (minutes, hours, days) and executing scheduled follow-up jobs.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-1 shrink-0" />
                <span>
                  <strong>CRM & Lead Segmentation:</strong> Organizing contacts into audience lists, assigning custom tags, and maintaining unified omnichannel conversation threads.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-1 shrink-0" />
                <span>
                  <strong>Platform Reliability & Abuse Prevention:</strong> Monitoring rate limits, validating incoming webhook authenticity via secure verification tokens, and preventing spam.
                </span>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-emerald-600 font-mono text-lg">03.</span>
              WhatsApp Cloud API & Meta Platform Compliance
            </h2>
            <p className="mb-4">
              FlowPilot integrates with the official <strong>Meta WhatsApp Cloud API</strong> (Graph API v20.0). In compliance with Meta Developer Policies and the WhatsApp Business Terms of Service:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li>
                <strong>Strict Opt-In Requirement:</strong> FlowPilot operators must ensure that all recipients have provided unambiguous opt-in consent before receiving outbound marketing templates or automated drip sequences.
              </li>
              <li>
                <strong>Immediate Opt-Out Honoring:</strong> If a contact replies with standard opt-out keywords (such as &ldquo;STOP&rdquo;, &ldquo;UNSUBSCRIBE&rdquo;, or &ldquo;CANCEL&rdquo;), the platform automatically updates their consent status to opted-out.
              </li>
              <li>
                <strong>Data Minimization:</strong> We only store message fields required to deliver the conversation service and trigger configured workflows. We do not sell or monetize personal message contents or recipient phone numbers.
              </li>
              <li>
                <strong>Secure Webhook Verification:</strong> All incoming webhook transmissions from Meta servers are verified using HMAC verification tokens and secure challenge-response protocols before processing.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-emerald-600 font-mono text-lg">04.</span>
              Data Storage, Hosting & Security
            </h2>
            <p className="mb-4">
              We employ enterprise-grade administrative, technical, and physical security measures to protect your data:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 font-bold text-slate-900 mb-2">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  Encryption Standards
                </div>
                <p className="text-xs text-slate-600">
                  All data in transit is encrypted using modern TLS 1.3 / HTTPS protocols. Data at rest in our Google Cloud Firestore database is encrypted using AES-256 encryption.
                </p>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 font-bold text-slate-900 mb-2">
                  <Server className="w-4 h-4 text-blue-600" />
                  Token & Key Isolation
                </div>
                <p className="text-xs text-slate-600">
                  WhatsApp Access Tokens, verify tokens, and webhook secrets are stored securely in protected server environment variables and never exposed to public client bundles.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-emerald-600 font-mono text-lg">05.</span>
              Third-Party Sub-processors & Services
            </h2>
            <p className="mb-4">
              To deliver our unified automation services, FlowPilot interacts with trusted sub-processors under strict data processing agreements:
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs sm:text-sm bg-white rounded-xl border border-slate-200 overflow-hidden">
                <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Purpose</th>
                    <th className="py-3 px-4">Data Transferred</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-600">
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-900">Meta Platforms, Inc.</td>
                    <td className="py-3 px-4">WhatsApp Cloud API messaging & webhook routing</td>
                    <td className="py-3 px-4">Phone numbers, message text, delivery statuses</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-900">Google Cloud / Firebase</td>
                    <td className="py-3 px-4">Encrypted database storage & secure backend hosting</td>
                    <td className="py-3 px-4">Encrypted contact records, workflow configurations</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-900">SendGrid / Resend</td>
                    <td className="py-3 px-4">Transactional & broadcast email delivery</td>
                    <td className="py-3 px-4">Recipient email address, name, email subject/body</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-emerald-600 font-mono text-lg">06.</span>
              Your Rights (GDPR & CCPA Compliance)
            </h2>
            <p className="mb-4">
              Depending on your location, you have statutory rights concerning your personal information:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li>
                <strong>Right to Access:</strong> You may request a copy of all personal data held in your workspace.
              </li>
              <li>
                <strong>Right to Rectification:</strong> You can correct or update inaccurate contact information via your CRM dashboard.
              </li>
              <li>
                <strong>Right to Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> You may delete any contact, inbox thread, or entire workspace. Upon confirmation, data is permanently expunged.
              </li>
              <li>
                <strong>Right to Data Portability:</strong> You may export your contact lists and audience records in CSV or JSON format at any time.
              </li>
              <li>
                <strong>Non-Discrimination:</strong> We do not discriminate against any user or contact for exercising their privacy rights.
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-emerald-600 font-mono text-lg">07.</span>
              Data Retention Policy
            </h2>
            <p>
              We retain contact information and workflow logs only as long as necessary to provide the FlowPilot service or fulfill legal obligations. Inbound webhook message logs are retained for operational debugging and CRM inbox history until manually deleted by the workspace administrator or after account termination.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-emerald-600 font-mono text-lg">08.</span>
              Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy periodically to reflect enhancements in our product, regulatory updates, or changes to Meta platform policies. When changes are made, we will update the &ldquo;Last Revised&rdquo; date at the top of this page.
            </p>
          </section>

          {/* Section 9 */}
          <section className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-200">
            <h2 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-600" />
              Contact Our Data Protection Team
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              If you have any questions about this Privacy Policy, wish to exercise your data subject rights, or require compliance verification for Meta App Review, please contact us:
            </p>
            <div className="space-y-1.5 text-xs sm:text-sm text-slate-700">
              <p>
                <strong>Platform:</strong> FlowPilot Automation & Omnichannel CRM
              </p>
              <p>
                <strong>Email:</strong>{' '}
                <a
                  href="mailto:privacy@flowpilot.app"
                  className="text-emerald-700 underline font-medium"
                >
                  privacy@flowpilot.app
                </a>{' '}
                / support@flowpilot.app
              </p>
              <p>
                <strong>Official Webhook Endpoint:</strong>{' '}
                <code className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-slate-800">
                  /webhook/whatsapp
                </code>
              </p>
            </div>
          </section>
        </div>

        {/* Footer in Privacy Page */}
        <div className="mt-16 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} FlowPilot. All rights reserved.</p>
          <button
            type="button"
            onClick={handleBack}
            className="text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
          >
            ← Back to Application
          </button>
        </div>
      </main>
    </div>
  );
};
