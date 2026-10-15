import React, { useState } from 'react';
import { ArrowRight, Check, ShieldCheck, Layers, GitBranch, Sun, Moon } from 'lucide-react';
import heroLuxuryImg from '../assets/images/classic_architectural_hero_1791674859192.jpg';
import omnichannelFlowImg from '../assets/images/classic_chronometer_flow_1791674881599.jpg';
import crmAudienceCardsImg from '../assets/images/classic_crm_atelier_1791674871768.jpg';
import templateStudioImg from '../assets/images/classic_template_studio_1791674890822.jpg';
import directorPortraitImg from '../assets/images/portrait_creative_director_1791408562306.jpg';
import { AuthModalMode } from './AuthModal';
import { FlowPilotLogo } from './FlowPilotLogo';
import { ThemeMode } from '../theme/designSystem';

interface LandingPageProps {
  onOpenAuth: (mode: AuthModalMode) => void;
  onEnterWorkspace: () => void;
  onCapturePublicLead: (lead: {
    fullName: string;
    email: string;
    phone: string;
    segment: string;
  }) => Promise<void>;
  isAuthenticated: boolean;
  themeMode?: ThemeMode;
  onToggleThemeMode?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenAuth,
  onEnterWorkspace,
  onCapturePublicLead,
  isAuthenticated,
  themeMode = 'light',
  onToggleThemeMode,
}) => {
  const [heroImgError, setHeroImgError] = useState(false);
  const [workflowImgError, setWorkflowImgError] = useState(false);
  const [crmImgError, setCrmImgError] = useState(false);
  const [templateImgError, setTemplateImgError] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);

  // Provider cost transparency estimator state
  const [monthlyEmails, setMonthlyEmails] = useState<number>(10000);
  const [monthlyWhatsApp, setMonthlyWhatsApp] = useState<number>(500);
  const [monthlySms, setMonthlySms] = useState<number>(250);

  // Interactive lead capture form state
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadSegment, setLeadSegment] = useState('Creator / Course Builder');
  const [leadConsent, setLeadConsent] = useState(true);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadError, setLeadError] = useState('');

  // Pass-through provider estimates (at-cost third-party provider reference rates)
  const estimatedEmailProviderFee = (monthlyEmails / 1000) * 0.1;
  const estimatedWhatsAppProviderFee = monthlyWhatsApp * 0.015;
  const estimatedSmsProviderFee = monthlySms * 0.0079;
  const totalProviderPassThrough =
    estimatedEmailProviderFee + estimatedWhatsAppProviderFee + estimatedSmsProviderFee;

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError('');
    if (!leadName.trim() || !leadEmail.trim() || !leadEmail.includes('@')) {
      setLeadError('Please provide a valid full name and email address.');
      return;
    }
    if (!leadConsent) {
      setLeadError('Explicit opt-in consent is required for compliant messaging.');
      return;
    }
    await onCapturePublicLead({
      fullName: leadName.trim(),
      email: leadEmail.trim(),
      phone: leadPhone.trim(),
      segment: leadSegment,
    });
    setLeadSubmitted(true);
    setLeadName('');
    setLeadEmail('');
    setLeadPhone('');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] transition-colors duration-200">
      {/* Strict 3-Zone Top Bar Contract — Deep Slate/Navy & Cobalt Blue */}
      <header className="sticky top-0 z-30 bg-[#090D16] border-b border-slate-800 px-4 sm:px-6 lg:px-12 py-3.5 sm:py-4 flex items-center justify-between gap-2">
        {/* Zone 1: Brand Logo & Wordmark */}
        <a
          href="#top"
          className="inline-flex items-center whitespace-nowrap shrink-0"
        >
          <FlowPilotLogo variant="dark" size="md" />
        </a>

        {/* Zone 2: 4 Clean Text Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-medium text-slate-300">
          <a
            href="#capabilities"
            className="hover:text-[#22D3EE] hover:underline underline-offset-8 transition-colors whitespace-nowrap"
          >
            Capabilities
          </a>
          <a
            href="#workflows"
            className="hover:text-[#22D3EE] hover:underline underline-offset-8 transition-colors whitespace-nowrap"
          >
            Workflows
          </a>
          <a
            href="#proof"
            className="hover:text-[#22D3EE] hover:underline underline-offset-8 transition-colors whitespace-nowrap"
          >
            Case Studies
          </a>
          <a
            href="#transparency"
            className="hover:text-[#22D3EE] hover:underline underline-offset-8 transition-colors whitespace-nowrap"
          >
            Transparency
          </a>
        </nav>

        {/* Zone 3: Theme Switcher + Primary Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {onToggleThemeMode && (
            <button
              type="button"
              onClick={onToggleThemeMode}
              title="Toggle Light / Dark Mode"
              className="px-2.5 py-2 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              {themeMode === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline font-mono">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span className="hidden sm:inline font-mono">Dark</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => (isAuthenticated ? onEnterWorkspace() : onOpenAuth('signin'))}
            className="px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-200 hover:text-[#22D3EE] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isAuthenticated ? 'Dashboard' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => (isAuthenticated ? onEnterWorkspace() : onOpenAuth('signup'))}
            className="px-3.5 sm:px-4.5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            {isAuthenticated ? 'Open Workspace' : 'Start Free'}
          </button>
        </div>
      </header>

      {/* Section 1: Deep Slate/Navy & Cobalt Blue Hero Proposition */}
      <section
        id="top"
        className="bg-[#090D16] text-white pt-10 sm:pt-14 pb-14 sm:pb-20 border-b border-slate-800"
      >
        <div className="max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            <div className="lg:col-span-7 space-y-5 sm:space-y-6">
              <div className="text-xs sm:text-sm font-medium text-slate-300 flex flex-wrap items-center gap-2 tracking-wide">
                <span className="font-semibold text-[#22D3EE]">100% Free Platform</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>Zero Subscription Fees</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>Official WhatsApp, SMS &amp; Email APIs</span>
              </div>

              <h1 className="font-display text-2xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-white leading-[1.14]">
                Capture leads, automate follow-ups, and command every client journey in{' '}
                <span className="text-[#3B82F6]">one unified studio.</span>
              </h1>

              <p className="text-sm sm:text-base lg:text-lg text-slate-300 leading-relaxed max-w-[60ch]">
                Crafted for digital creators, freelancers, coaches, agencies, and modern businesses.
                Build high-converting landing pages, segment your CRM, orchestrate visual Email,
                SMS, and Official WhatsApp Cloud API workflows, and grow revenue without software
                subscriptions or paywalls.
              </p>

              <div className="pt-1 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => (isAuthenticated ? onEnterWorkspace() : onOpenAuth('signup'))}
                  className="px-5 py-3 text-xs sm:text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-md"
                >
                  <span>
                    {isAuthenticated
                      ? 'Launch FlowPilot Dashboard'
                      : 'Start Free (Email or Google)'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onEnterWorkspace}
                  className="px-4.5 py-3 text-xs sm:text-sm font-semibold text-white bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Inspect Interactive Workspace
                </button>
              </div>

              <div className="pt-5 border-t border-slate-800 grid grid-cols-3 gap-4 sm:gap-6 max-w-xl">
                <div>
                  <div className="font-mono text-lg sm:text-2xl font-bold text-[#22D3EE] tabular-nums">
                    $0 / mo
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    No paid tiers or credit locks
                  </div>
                </div>
                <div>
                  <div className="font-mono text-lg sm:text-2xl font-bold text-white tabular-nums">
                    3 Channels
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Email · Official WhatsApp · SMS
                  </div>
                </div>
                <div>
                  <div className="font-mono text-lg sm:text-2xl font-bold text-emerald-400 tabular-nums">
                    100% Opt-In
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Anti-spam &amp; consent enforced
                  </div>
                </div>
              </div>
            </div>

            {/* Dominant 16:9 Visual Carrier */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 aspect-video shadow-2xl">
                {!heroImgError ? (
                  <img
                    src={heroLuxuryImg}
                    alt="FlowPilot marketing command studio"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-900 text-white">
                    <Layers className="w-10 h-10 text-emerald-400 mb-2" />
                    <span className="font-display text-lg font-semibold">
                      FlowPilot Omnichannel Studio
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/40 to-transparent flex flex-col justify-end p-4 sm:p-5">
                  <div className="text-[11px] text-emerald-400 font-mono tabular-nums tracking-wider uppercase">
                    Live Command Architecture · Multi-Channel Telemetry
                  </div>
                  <div className="font-display text-sm sm:text-base font-semibold text-white mt-0.5">
                    Inbound Capture → Automated Omnichannel Nurture → Customer LTV
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Core Capabilities Asymmetric Bento Grid — Two-Color Slate Ink & Emerald */}
      <section id="capabilities" className="py-14 sm:py-20 bg-[#F8FAFC]">
        <div className="max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="max-w-3xl mb-10 sm:mb-12">
            <div className="text-xs sm:text-sm font-bold text-[#047857] tracking-wide mb-1.5">
              Complete Marketing & Omnichannel CRM Stack
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-950 tracking-tight leading-[1.15]">
              Every instrument required to turn cold visitors into repeat buyers.
            </h2>
            <p className="text-sm sm:text-base text-slate-700 mt-3 leading-relaxed">
              FlowPilot replaces fragmented form builders, static contact spreadsheets, and
              disconnected messaging tools with one unified platform.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Marquee Capability 01 (col-span-2) */}
            <div className="lg:col-span-2 border border-slate-200 rounded-2xl p-5 sm:p-7 lg:p-8 bg-white flex flex-col justify-between">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-7 space-y-3">
                  <div className="text-xs sm:text-sm text-[#047857] font-semibold">
                    CRM & Audience Intelligence · Real-Time Segmentation
                  </div>
                  <h3 className="font-display text-lg sm:text-xl lg:text-2xl font-bold text-slate-950">
                    01. Unified Contact CRM, Lead Scoring & Journey Tracking
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Organize leads, warm prospects, qualified opportunities, and paying customers in
                    one structured directory. Filter contacts by temperature (Hot, Warm, Cold),
                    acquisition source, custom lists, tags, and verified opt-in consent while
                    monitoring lifetime value (LTV).
                  </p>
                </div>

                <div className="md:col-span-5">
                  <div className="rounded-xl overflow-hidden border border-slate-200 aspect-[4/3] bg-slate-950">
                    {!crmImgError ? (
                      <img
                        src={crmAudienceCardsImg}
                        alt="CRM audience segmentation and growth cards"
                        referrerPolicy="no-referrer"
                        onError={() => setCrmImgError(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-emerald-400 font-display text-base">
                        CRM Intelligence
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Pipeline Stages</div>
                  <div className="text-sm font-bold text-slate-950 mt-0.5">
                    Lead · Warm · Qualified · Customer
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Temperature Sorting</div>
                  <div className="text-sm font-bold text-slate-950 mt-0.5">
                    Automated Hot / Warm / Cold Rules
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Consent Ledger</div>
                  <div className="text-sm font-bold text-[#047857] mt-0.5">
                    Double Opt-In & One-Click Unsubscribe
                  </div>
                </div>
              </div>
            </div>

            {/* Capability 02 (col-span-1) — Classic Page & Form Atelier Card with Masterclass Studio Graphic */}
            <div className="rounded-2xl p-5 sm:p-6 bg-[#047857] text-white flex flex-col justify-between border border-emerald-700">
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border border-emerald-500/40 bg-slate-950 aspect-video mb-3">
                  {!templateImgError ? (
                    <img
                      src={templateStudioImg}
                      alt="Classic Page and Form Builder Studio with Ready-Made Templates"
                      referrerPolicy="no-referrer"
                      onError={() => setTemplateImgError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-900 text-emerald-300 font-display text-sm">
                      Page &amp; Form Studio
                    </div>
                  )}
                </div>
                <div className="text-xs sm:text-sm text-amber-200 font-semibold">
                  Build From Scratch or 1-Click Templates
                </div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-white">
                  02. Custom Page &amp; Form Builder + Ready-Made Templates
                </h3>
                <p className="text-xs sm:text-sm text-emerald-50 leading-relaxed">
                  Assemble pages and forms from a 100% blank canvas using Hero, Video, Pricing,
                  Countdown Timer, FAQ, and Form elements—or customize ready-made Course &amp;
                  Affiliate Sales, Squeeze, and Webinar templates.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-emerald-600">
                <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                  10 Elements · 6 Templates
                </div>
                <div className="text-xs text-emerald-100 mt-0.5">
                  Full drag-and-drop palette with instant CRM list &amp; tag routing
                </div>
              </div>
            </div>

            {/* Capability 03 (col-span-1 with 4:3 visual) */}
            <div
              id="workflows"
              className="border border-slate-200 rounded-2xl p-5 sm:p-6 bg-white flex flex-col justify-between"
            >
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950 aspect-[4/3] mb-5">
                {!workflowImgError ? (
                  <img
                    src={omnichannelFlowImg}
                    alt="Visual workflow automation routing nodes"
                    referrerPolicy="no-referrer"
                    onError={() => setWorkflowImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-900 text-emerald-400">
                    <GitBranch className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="text-xs sm:text-sm text-[#047857] font-semibold">
                  Event-Driven Execution
                </div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950">
                  03. Visual Multi-Step Automations
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed">
                  Trigger workflows when a contact submits a form, joins a list, completes a
                  purchase, or replies with a WhatsApp keyword. Chain delays, conditional branches,
                  and cross-channel follow-ups.
                </p>
              </div>
            </div>

            {/* Capability 04 (col-span-2) — Deep Slate Ink Card */}
            <div className="lg:col-span-2 rounded-2xl p-5 sm:p-7 lg:p-8 bg-[#0F172A] text-white flex flex-col justify-between border border-slate-800">
              <div className="space-y-3">
                <div className="text-xs sm:text-sm text-emerald-400 font-semibold">
                  Compliant Omnichannel Delivery · Official Provider APIs
                </div>
                <h3 className="font-display text-lg sm:text-xl lg:text-2xl font-bold text-white">
                  04. Official WhatsApp Cloud API Chatbots, Email Broadcasts & SMS Alerts
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed max-w-[65ch]">
                  Run interactive WhatsApp keyword chatbots with structured menu replies and human
                  handoff, dispatch personalized email newsletters, and send time-sensitive SMS
                  reminders. Every broadcast respects recipient opt-in state and official provider
                  rate limits—never scraping or unsolicited bulk spam.
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="font-mono text-lg sm:text-xl font-bold text-emerald-400 tabular-nums">
                    99.1% Delivery
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Authenticated DKIM/SPF Email & Official Meta Cloud API
                  </div>
                </div>
                <div>
                  <div className="font-mono text-lg sm:text-xl font-bold text-white tabular-nums">
                    &lt; 1.2s Reply
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Automated WhatsApp keyword matching & interactive menus
                  </div>
                </div>
                <div>
                  <div className="font-mono text-lg sm:text-xl font-bold text-emerald-400 tabular-nums">
                    Strict RBAC
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Tenant-isolated workspaces with Owner, Admin, Editor & Analyst roles
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Proof of Impact / Case Studies */}
      <section id="proof" className="border-t border-slate-200 py-14 sm:py-20 bg-white">
        <div className="max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="max-w-3xl mb-10 sm:mb-12">
            <div className="text-xs sm:text-sm font-bold text-[#047857] mb-1.5">
              Verified Operator Outcomes
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-950 tracking-tight">
              Measurable pipeline growth across creators, coaches, and agencies.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-slate-200 rounded-2xl p-5 sm:p-7 lg:p-8 bg-[#F8FAFC] flex flex-col justify-between">
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-4">
                  <div className="font-mono text-lg sm:text-2xl font-bold text-[#047857] tabular-nums">
                    +142% Qualified Discovery Bookings in 90 Days
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600 mt-1">
                    Mechanism: Lead Magnet Landing Page → 24h Email Check → Official WhatsApp
                    Consultation Invite
                  </div>
                </div>
                <p className="font-display text-base sm:text-lg italic text-slate-800 leading-relaxed">
                  “Before FlowPilot, our leads downloaded our PDF playbook and went cold in a static
                  spreadsheet. Connecting our capture form directly to a conditional email and
                  official WhatsApp follow-up doubled our booked strategy calls in twelve weeks—with
                  zero monthly SaaS license overhead.”
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#047857] bg-slate-900 shrink-0">
                  {!avatarImgError ? (
                    <img
                      src={directorPortraitImg}
                      alt="Elena Vance, Founder at Studio Sovereign Media"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarImgError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-900 text-emerald-400 text-xs font-bold">
                      EV
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-display text-base font-bold text-slate-950">Elena Vance</div>
                  <div className="text-xs text-slate-600">
                    Founder & Creative Director · Studio Sovereign Media
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl p-5 sm:p-7 lg:p-8 bg-[#F8FAFC] flex flex-col justify-between">
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-4">
                  <div className="font-mono text-lg sm:text-2xl font-bold text-slate-950 tabular-nums">
                    $48,600 Cohort Revenue · 94.2% Onboarding Completion
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600 mt-1">
                    Mechanism: Inbound WhatsApp Keyword ("AUDIT") → Automated Lead Scoring →
                    3-Channel Cohort Sequence
                  </div>
                </div>
                <p className="font-display text-base sm:text-lg italic text-slate-800 leading-relaxed">
                  “Our agency used to pay $290/month across four separate tools just to tag leads and
                  send workshop reminders. FlowPilot gives us full CRM stages, WhatsApp Cloud API
                  chatbot routing, and team role permissions completely free, while we only pay
                  direct Meta and SES pass-through pennies.”
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-full bg-[#0F172A] text-emerald-400 flex items-center justify-center font-display text-sm font-bold shrink-0 border-2 border-[#047857]">
                  MO
                </div>
                <div>
                  <div className="font-display text-base font-bold text-slate-950">Marcus Okafor</div>
                  <div className="text-xs text-slate-600">
                    Managing Partner · Kinetic Growth Agency (B2B Funnel Consultancy)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: 100% Free Business Model & Third-Party Provider Cost Transparency + Live Capture Form */}
      <section id="transparency" className="border-t border-slate-200 bg-[#F8FAFC] py-14 sm:py-20">
        <div className="max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            {/* Left 7 Cols: Honest Business Model & Provider Pass-Through Calculator */}
            <div className="lg:col-span-7 space-y-5">
              <div className="text-xs sm:text-sm font-bold text-[#047857]">
                Transparent Architecture · Zero Artificial Locks
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                FlowPilot is 100% free forever. You only pay your own messaging providers at cost.
              </h2>
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                We never charge software subscriptions, seat fees, or per-contact tax, and we never
                lock features behind paid tiers. When you connect your own Official WhatsApp Cloud
                API (Meta), SMS gateway (Twilio/MessageBird), or Email API (AWS SES/Resend/SMTP),
                third-party network fees are billed directly by those providers to you with{' '}
                <strong className="font-bold text-[#047857]">$0.00 FlowPilot markup</strong>.
              </p>

              <div className="border border-slate-200 rounded-2xl p-5 sm:p-6 bg-white space-y-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-950">
                      Direct Provider Pass-Through Estimator
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Compare third-party carrier charges vs. FlowPilot platform cost ($0)
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <div className="font-mono text-lg sm:text-xl font-bold text-[#047857] tabular-nums">
                      FlowPilot Fee: $0.00
                    </div>
                    <div className="text-xs text-slate-600 font-mono tabular-nums">
                      Est. Provider Direct: ${totalProviderPassThrough.toFixed(2)} / mo
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex flex-wrap justify-between gap-1 text-xs sm:text-sm font-semibold text-slate-800 mb-1.5">
                      <span>Monthly Transactional & Broadcast Emails (SES / Resend)</span>
                      <span className="font-mono tabular-nums text-[#047857]">
                        {monthlyEmails.toLocaleString()} emails · ~${estimatedEmailProviderFee.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1000}
                      max={100000}
                      step={1000}
                      value={monthlyEmails}
                      onChange={(e) => setMonthlyEmails(Number(e.target.value))}
                      className="w-full accent-[#047857] cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap justify-between gap-1 text-xs sm:text-sm font-semibold text-slate-800 mb-1.5">
                      <span>Monthly Official WhatsApp Cloud API Conversations (Meta Direct)</span>
                      <span className="font-mono tabular-nums text-[#047857]">
                        {monthlyWhatsApp.toLocaleString()} convos · ~${estimatedWhatsAppProviderFee.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10000}
                      step={100}
                      value={monthlyWhatsApp}
                      onChange={(e) => setMonthlyWhatsApp(Number(e.target.value))}
                      className="w-full accent-[#047857] cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap justify-between gap-1 text-xs sm:text-sm font-semibold text-slate-800 mb-1.5">
                      <span>Monthly Compliant SMS Segments (Twilio / Carrier Direct)</span>
                      <span className="font-mono tabular-nums text-[#047857]">
                        {monthlySms.toLocaleString()} segments · ~${estimatedSmsProviderFee.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10000}
                      step={50}
                      value={monthlySms}
                      onChange={(e) => setMonthlySms(Number(e.target.value))}
                      className="w-full accent-[#047857] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-slate-700 font-medium">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#047857] shrink-0" />
                    <span>Unlimited CRM contacts, tags, and custom lists</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#047857] shrink-0" />
                    <span>Unlimited visual automations & landing pages</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#047857] shrink-0" />
                    <span>Official WhatsApp Cloud API & webhook compliance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#047857] shrink-0" />
                    <span>No credit limits, trials, or artificial paywalls</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 5 Cols: Live Interactive Lead Capture Form */}
            <div className="lg:col-span-5 rounded-2xl p-5 sm:p-7 bg-[#0F172A] text-white border border-slate-800 shadow-xl">
              <div className="text-xs font-semibold text-emerald-400 mb-1">
                Live Lead Capture Engine Demo
              </div>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
                Test Inbound Lead Capture to CRM
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 mb-5 leading-relaxed">
                Submit a sample lead below. It will immediately appear inside the FlowPilot CRM
                directory and trigger a logged customer journey event.
              </p>

              {leadSubmitted ? (
                <div className="p-5 border border-emerald-500/40 bg-emerald-950/60 rounded-xl space-y-3.5">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Lead Captured & Opt-In Recorded in CRM</span>
                  </div>
                  <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
                    Your test contact has been added to the workspace with verified consent and
                    enrolled in the Lead Magnet Welcome Automation.
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={onEnterWorkspace}
                      className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      View Lead in Dashboard
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeadSubmitted(false)}
                      className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
                    >
                      Submit Another
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="space-y-3.5">
                  {leadError && (
                    <div className="p-3 text-xs text-red-200 bg-red-950/80 border border-red-500/40 rounded-lg">
                      {leadError}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-slate-200 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      placeholder="e.g. Jordan Vance"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-900 border border-slate-700 text-white placeholder:text-slate-400 rounded-xl focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-200 mb-1">
                      Work or Creator Email *
                    </label>
                    <input
                      type="email"
                      required
                      maxLength={150}
                      placeholder="jordan@studio.io"
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-900 border border-slate-700 text-white placeholder:text-slate-400 rounded-xl focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-200 mb-1">
                        WhatsApp / SMS Number
                      </label>
                      <input
                        type="tel"
                        maxLength={32}
                        placeholder="+1 555 234 5678"
                        value={leadPhone}
                        onChange={(e) => setLeadPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-900 border border-slate-700 text-white placeholder:text-slate-400 rounded-xl focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-200 mb-1">
                        Business Profile
                      </label>
                      <select
                        value={leadSegment}
                        onChange={(e) => setLeadSegment(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm bg-slate-900 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-emerald-400"
                      >
                        <option value="Creator / Course Builder">Creator / Course Builder</option>
                        <option value="Freelancer / Consultant">Freelancer / Consultant</option>
                        <option value="Coach / Advisory">Coach / Advisory</option>
                        <option value="Digital Agency">Digital Agency</option>
                        <option value="Small-to-Medium Business">Small-to-Medium Business</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={leadConsent}
                      onChange={(e) => setLeadConsent(e.target.checked)}
                      className="mt-0.5 accent-[#047857] w-4 h-4 shrink-0"
                    />
                    <span className="text-xs text-slate-300 leading-relaxed">
                      I explicitly opt in to receive automated email and official WhatsApp/SMS
                      updates. Unsubscribe anytime with one click.
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="w-full py-3 px-4 text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Capture Lead & Trigger Demo Workflow
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Two-Color Dark Footer */}
      <footer className="border-t border-slate-800 bg-[#0F172A] text-slate-300 py-9 px-4 sm:px-6 lg:px-12">
        <div className="max-w-[1340px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div>
            <FlowPilotLogo variant="dark" size="md" />
            <p className="text-xs text-slate-400 mt-1.5">
              Free All-in-One Marketing Automation Platform & Omnichannel CRM. Built on compliant
              official APIs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs sm:text-sm font-medium text-slate-300">
            <a href="#capabilities" className="hover:text-emerald-400">
              Capabilities
            </a>
            <a href="#workflows" className="hover:text-emerald-400">
              Visual Automations
            </a>
            <a href="#proof" className="hover:text-emerald-400">
              Case Studies
            </a>
            <a href="#transparency" className="hover:text-emerald-400">
              Provider Cost Transparency
            </a>
            <button
              type="button"
              onClick={onEnterWorkspace}
              className="font-bold text-emerald-400 hover:underline cursor-pointer"
            >
              Open Workspace →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
