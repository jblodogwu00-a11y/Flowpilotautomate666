import { CaptureAssetType } from '../types';

export type FunnelStepType =
  | 'landing_page'
  | 'opt_in_page'
  | 'thank_you_page'
  | 'bridge_page'
  | 'confirmation_page';

export type FunnelSectionBlockType =
  | 'hero_banner'
  | 'video_briefing'
  | 'value_stack'
  | 'opt_in_form'
  | 'next_steps_checklist'
  | 'testimonials_proof'
  | 'faq_section';

export interface FunnelSectionBlock {
  id: string;
  blockType: FunnelSectionBlockType;
  title: string;
  content: string;
  accentNote?: string;
}

export interface FunnelStepDefinition {
  id: string;
  stepType: FunnelStepType;
  name: string;
  slug: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  // CRM & Automation integration per step
  tagsOnAction: string[];
  seoTitle: string;
  seoDescription: string;
  blocks: FunnelSectionBlock[];
  // Step-level Funnel Analytics
  visitors: number;
  completions: number; // Leads on opt-in steps, advances/conversions on other steps
}

export interface ConversionFunnel {
  id: string;
  name: string;
  slug: string;
  category: 'lead_magnet' | 'webinar_registration' | 'consultation_booking' | 'custom_funnel';
  description: string;
  status: 'active' | 'draft' | 'archived';
  targetList: string;
  linkedAutomationName?: string;
  customDomain: string;
  steps: FunnelStepDefinition[];
  updatedAt: string;
}

export interface FunnelStepTypeMeta {
  type: FunnelStepType;
  label: string;
  shortLabel: string;
  stageBadge: string;
  description: string;
  mapsToAssetType: CaptureAssetType;
  isLeadCaptureStep: boolean;
  defaultHeadline: string;
  defaultSubheadline: string;
  defaultCta: string;
}

export const FUNNEL_STEP_TYPES: FunnelStepTypeMeta[] = [
  {
    type: 'landing_page',
    label: 'Landing Page',
    shortLabel: '1. Landing Page',
    stageBadge: 'Top of Funnel · Awareness',
    description:
      'High-impact entry page with hero hook, value pillars, social proof, and call-to-action routing visitors into the opt-in flow.',
    mapsToAssetType: 'landing_page',
    isLeadCaptureStep: false,
    defaultHeadline: 'Build an Automated Growth Engine Without Enterprise Software Bloat',
    defaultSubheadline:
      'Discover the step-by-step system 4,200+ creators and agencies use to capture and nurture leads across Email, SMS, and WhatsApp.',
    defaultCta: 'Continue to Free Blueprint →',
  },
  {
    type: 'opt_in_page',
    label: 'Opt-In Page',
    shortLabel: '2. Opt-In Page',
    stageBadge: 'Lead Capture · CRM List Sync',
    description:
      'Focused squeeze/opt-in step that captures Name, Email, and WhatsApp/Phone, assigns the contact to a CRM List, and applies tags.',
    mapsToAssetType: 'inline_form',
    isLeadCaptureStep: true,
    defaultHeadline: 'Where Should We Send Your 2026 Conversion Playbook & Templates?',
    defaultSubheadline:
      'Enter your best email and WhatsApp number below for instant access plus our 5-day implementation sequence.',
    defaultCta: 'Unlock Instant Access Now',
  },
  {
    type: 'thank_you_page',
    label: 'Thank-You Page',
    shortLabel: '3. Thank-You Page',
    stageBadge: 'Lead Confirmation & Download',
    description:
      'Confirms opt-in delivery, provides the lead magnet download link, and guides warm leads to the next step.',
    mapsToAssetType: 'landing_page',
    isLeadCaptureStep: false,
    defaultHeadline: 'Success! Your Playbook Is in Your Inbox — Watch This 3-Minute Walkthrough',
    defaultSubheadline:
      'While your guide downloads, watch this short walkthrough showing how to automate your follow-up workflows.',
    defaultCta: 'Continue to Next Step →',
  },
  {
    type: 'bridge_page',
    label: 'Bridge / Action Page',
    shortLabel: '4. Bridge Page',
    stageBadge: 'Mid-Funnel Engagement',
    description:
      'Video walkthrough, case study breakdown, or qualification step that deepens prospect engagement before final confirmation.',
    mapsToAssetType: 'landing_page',
    isLeadCaptureStep: false,
    defaultHeadline: 'How to Launch Multi-Channel Automations in Under 15 Minutes',
    defaultSubheadline:
      'Review the implementation checklist below and confirm your onboarding preferences.',
    defaultCta: 'Confirm & Complete Onboarding →',
  },
  {
    type: 'confirmation_page',
    label: 'Confirmation Page',
    shortLabel: '5. Confirmation Page',
    stageBadge: 'Final Completion & Next Steps',
    description:
      'Final confirmation page summarizing access links, community resources, and triggered onboarding workflows.',
    mapsToAssetType: 'landing_page',
    isLeadCaptureStep: false,
    defaultHeadline: 'You Are All Set! Welcome Aboard — Here Are Your Access Links',
    defaultSubheadline:
      'Your resources and onboarding details have been dispatched via Email and WhatsApp. Use the links below to get started.',
    defaultCta: 'Access Resource Hub',
  },
];

export function buildDefaultBlocksForStep(stepType: FunnelStepType): FunnelSectionBlock[] {
  switch (stepType) {
    case 'landing_page':
      return [
        {
          id: 'blk_lp_1',
          blockType: 'hero_banner',
          title: 'Above-the-Fold Value Hook',
          content:
            'Attention Creators, Coaches & Lean Agencies: Unify your lead capture, lists, and automated follow-ups.',
          accentNote: 'Primary CTA advances to Opt-In Step',
        },
        {
          id: 'blk_lp_2',
          blockType: 'value_stack',
          title: '3 Core Conversion Pillars',
          content:
            '1. Multi-Channel Capture (Email, SMS & Official WhatsApp) · 2. Visual Automated Sequences · 3. Unified CRM Lists',
        },
        {
          id: 'blk_lp_3',
          blockType: 'testimonials_proof',
          title: 'Verified Community Feedback',
          content:
            '"We simplified our entire lead generation stack and doubled our opt-in rate to 38.4% in 14 days." — Elena Rostova',
        },
      ];
    case 'opt_in_page':
      return [
        {
          id: 'blk_opt_1',
          blockType: 'hero_banner',
          title: 'Squeeze Headline & Lead Magnet Preview',
          content:
            'Free 42-Page Blueprint + 12 Copy-Paste Automation Templates (Instant PDF + Workspace Link).',
        },
        {
          id: 'blk_opt_2',
          blockType: 'opt_in_form',
          title: 'High-Converting Opt-In Form',
          content:
            'Captures Full Name, Email Address, and WhatsApp Phone + syncs directly to target Contact List.',
          accentNote: 'Applies step tags & triggers Welcome Automation',
        },
      ];
    case 'thank_you_page':
      return [
        {
          id: 'blk_ty_1',
          blockType: 'hero_banner',
          title: 'Opt-In Confirmation & Download Box',
          content:
            'Your playbook is on its way! Click to download the PDF directly or watch the walkthrough video below.',
        },
        {
          id: 'blk_ty_2',
          blockType: 'video_briefing',
          title: '3-Minute Implementation Video',
          content:
            'Explains how to set up your contact lists and automated follow-up sequences in 15 minutes.',
        },
      ];
    case 'bridge_page':
      return [
        {
          id: 'blk_br_1',
          blockType: 'video_briefing',
          title: 'Step-by-Step Case Study Walkthrough',
          content:
            'Full walkthrough of the multi-channel lead nurture system with live CRM & workflow demonstrations.',
        },
        {
          id: 'blk_br_2',
          blockType: 'value_stack',
          title: 'Key Implementation Highlights',
          content:
            '• Automated Email & WhatsApp Welcome Flows\n• Tag-Based Audience Segmentation\n• Compliant Opt-In & Consent Tracking',
        },
      ];
    case 'confirmation_page':
      return [
        {
          id: 'blk_cnf_1',
          blockType: 'next_steps_checklist',
          title: 'Confirmed Access & Onboarding Checklist',
          content:
            '1. Check your inbox for the resource link · 2. Reply START on WhatsApp for updates · 3. Review your starter guide.',
        },
        {
          id: 'blk_cnf_2',
          blockType: 'faq_section',
          title: 'Quick Start FAQ',
          content:
            'Everything you need to know about accessing your downloads and managing your communication preferences.',
        },
      ];
  }
}

export const INITIAL_CONVERSION_FUNNELS: ConversionFunnel[] = [
  {
    id: 'funnel_creator_blueprint',
    name: 'Creator Growth Blueprint Lead Funnel',
    slug: 'creator-blueprint-funnel',
    category: 'lead_magnet',
    description:
      'Multi-step lead generation funnel: Landing Page → Opt-In Squeeze Page → Thank-You Download Page → Bridge Walkthrough → Final Confirmation.',
    status: 'active',
    targetList: 'Creator Blueprint Leads',
    linkedAutomationName: 'Creator Playbook 5-Day Nurture',
    customDomain: 'go.flowpilot.app',
    updatedAt: 'Updated 10 mins ago',
    steps: [
      {
        id: 'step_1_landing',
        stepType: 'landing_page',
        name: 'Landing Page (Traffic Entry)',
        slug: 'blueprint-landing',
        headline: 'Build an Automated Growth Engine Without Enterprise Software Bloat',
        subheadline:
          'See how 4,200+ creators and lean agencies capture, segment, and nurture leads from one unified workspace.',
        ctaText: 'Get the Free 2026 Blueprint →',
        tagsOnAction: ['funnel-visitor', 'landing-engaged'],
        seoTitle: '2026 Creator Growth Blueprint | FlowPilot Funnels',
        seoDescription: 'Step-by-step multi-channel marketing and CRM blueprint for creators and agencies.',
        blocks: buildDefaultBlocksForStep('landing_page'),
        visitors: 8420,
        completions: 5640,
      },
      {
        id: 'step_2_optin',
        stepType: 'opt_in_page',
        name: 'Opt-In Squeeze Page',
        slug: 'blueprint-opt-in',
        headline: 'Where Should We Send Your Free 42-Page Growth Playbook?',
        subheadline:
          'Enter your name, email, and WhatsApp number to unlock the PDF + 12 copy-paste automation sequences.',
        ctaText: 'Send My Free Playbook Now',
        tagsOnAction: ['funnel-lead', 'playbook-opt-in'],
        seoTitle: 'Download the Free Playbook | FlowPilot',
        seoDescription: 'Unlock the 42-page creator automation playbook and template vault.',
        blocks: buildDefaultBlocksForStep('opt_in_page'),
        visitors: 5640,
        completions: 2890,
      },
      {
        id: 'step_3_thankyou',
        stepType: 'thank_you_page',
        name: 'Thank-You & Download Page',
        slug: 'blueprint-thank-you',
        headline: 'Check Your Inbox! Watch This 3-Minute Video While Your PDF Downloads',
        subheadline:
          'Follow our quick-start walkthrough below to organize your contact lists and launch your first sequence.',
        ctaText: 'Watch Implementation Walkthrough →',
        tagsOnAction: ['downloaded-playbook'],
        seoTitle: 'Thank You — Your Playbook Is Ready',
        seoDescription: 'Download your playbook and watch the 3-minute implementation video.',
        blocks: buildDefaultBlocksForStep('thank_you_page'),
        visitors: 2890,
        completions: 1840,
      },
      {
        id: 'step_4_bridge',
        stepType: 'bridge_page',
        name: 'Bridge Walkthrough Page',
        slug: 'automation-walkthrough',
        headline: 'How to Connect Your Capture Forms, Lists & Automated Workflows',
        subheadline:
          'Review the 3-step checklist below and confirm your onboarding sequence preferences.',
        ctaText: 'Complete Funnel & Confirm Setup →',
        tagsOnAction: ['watched-walkthrough', 'qualified-lead'],
        seoTitle: 'Implementation Walkthrough | FlowPilot',
        seoDescription: 'Learn how to connect forms, lists, and automated sequences.',
        blocks: buildDefaultBlocksForStep('bridge_page'),
        visitors: 1840,
        completions: 1120,
      },
      {
        id: 'step_5_confirmation',
        stepType: 'confirmation_page',
        name: 'Final Confirmation Page',
        slug: 'setup-confirmed',
        headline: 'You Are All Set! Your Playbook & Starter Sequences Are Ready',
        subheadline:
          'We have sent your resource links via Email and WhatsApp. Click below to open your resource hub.',
        ctaText: 'Open Resource Hub',
        tagsOnAction: ['funnel-completed'],
        seoTitle: 'Confirmation & Resources | FlowPilot',
        seoDescription: 'Access your downloaded resources and onboarding checklist.',
        blocks: buildDefaultBlocksForStep('confirmation_page'),
        visitors: 1120,
        completions: 1120,
      },
    ],
  },
  {
    id: 'funnel_executive_webinar',
    name: 'Executive Masterclass Registration Funnel',
    slug: 'executive-masterclass-funnel',
    category: 'webinar_registration',
    description:
      '4-step event registration funnel: Landing Page → Seat Opt-In Page → Thank-You & Workbook Page → Final Confirmation.',
    status: 'active',
    targetList: 'VIP Executive Workshop',
    linkedAutomationName: 'VIP Workshop Attendance & Follow-Up',
    customDomain: 'masterclass.flowpilot.app',
    updatedAt: 'Updated 2 hours ago',
    steps: [
      {
        id: 'web_1_landing',
        stepType: 'landing_page',
        name: 'Masterclass Registration Landing Page',
        slug: 'masterclass-overview',
        headline: 'Live Executive Briefing: Scaling Client Acquisition With Automated Funnels',
        subheadline: 'Join 1,500+ founders for a 45-minute tactical breakdown with zero fluff.',
        ctaText: 'Reserve My Free Seat Now →',
        tagsOnAction: ['webinar-visitor'],
        seoTitle: 'Executive Masterclass | Client Acquisition Funnels',
        seoDescription: 'Register for the live 45-minute tactical masterclass.',
        blocks: buildDefaultBlocksForStep('landing_page'),
        visitors: 4120,
        completions: 2740,
      },
      {
        id: 'web_2_optin',
        stepType: 'opt_in_page',
        name: 'Seat Registration Opt-In Page',
        slug: 'masterclass-register',
        headline: 'Confirm Your Seat & WhatsApp SMS Reminder Preference',
        subheadline: 'Enter your work email and mobile number to receive the calendar invite and workbook.',
        ctaText: 'Complete Seat Registration',
        tagsOnAction: ['webinar-registrant', 'vip-lead'],
        seoTitle: 'Confirm Masterclass Seat',
        seoDescription: 'Get instant calendar invite and pre-session workbook.',
        blocks: buildDefaultBlocksForStep('opt_in_page'),
        visitors: 2740,
        completions: 1490,
      },
      {
        id: 'web_3_thankyou',
        stepType: 'thank_you_page',
        name: 'Thank-You & Workbook Page',
        slug: 'masterclass-thank-you',
        headline: 'Seat Reserved! Download Your Executive Workbook Before We Go Live',
        subheadline: 'Save the calendar invite and download your pre-session worksheet below.',
        ctaText: 'Confirm Attendance & Access Workbook →',
        tagsOnAction: ['workbook-downloaded'],
        seoTitle: 'Registration Confirmed | Executive Masterclass',
        seoDescription: 'Download your pre-session workbook.',
        blocks: buildDefaultBlocksForStep('thank_you_page'),
        visitors: 1490,
        completions: 980,
      },
      {
        id: 'web_4_confirmation',
        stepType: 'confirmation_page',
        name: 'Attendance Confirmation Page',
        slug: 'masterclass-confirmed',
        headline: 'Attendance Confirmed! See You at the Live Executive Briefing',
        subheadline: 'Your calendar link and WhatsApp reminder are active.',
        ctaText: 'Add to Calendar & View Prep Guide',
        tagsOnAction: ['attendance-confirmed'],
        seoTitle: 'Attendance Confirmed | Executive Masterclass',
        seoDescription: 'Access your live briefing link and prep guide.',
        blocks: buildDefaultBlocksForStep('confirmation_page'),
        visitors: 980,
        completions: 980,
      },
    ],
  },
];

export interface FunnelComputedAnalytics {
  topVisitors: number;
  totalLeads: number;
  leadConversionRate: number; // % of top visitors who became leads
  finalCompletions: number; // Visitors who completed the entire funnel
  fullFunnelCompletionRate: number; // % of top visitors who completed the final step
  stepRows: {
    step: FunnelStepDefinition;
    index: number;
    stepMeta: FunnelStepTypeMeta;
    visitorsIn: number;
    completionsOut: number;
    stepConversionRate: number;
    dropOffCount: number;
    dropOffRate: number;
  }[];
}

export function computeFunnelAnalytics(funnel: ConversionFunnel): FunnelComputedAnalytics {
  const steps = funnel.steps || [];
  const topVisitors = steps.length > 0 ? Math.max(steps[0].visitors, 1) : 0;

  // Leads are captured on opt_in_page steps (or if no opt_in_page, completions of first step)
  const optInSteps = steps.filter((s) => s.stepType === 'opt_in_page');
  const totalLeads =
    optInSteps.length > 0
      ? optInSteps.reduce((acc, s) => acc + s.completions, 0)
      : steps[0]?.completions || 0;

  const lastStep = steps[steps.length - 1];
  const finalCompletions = lastStep ? lastStep.completions : 0;

  const leadConversionRate =
    topVisitors > 0 ? Number(((totalLeads / topVisitors) * 100).toFixed(1)) : 0;
  const fullFunnelCompletionRate =
    topVisitors > 0 ? Number(((finalCompletions / topVisitors) * 100).toFixed(1)) : 0;

  const stepRows = steps.map((step, index) => {
    const stepMeta =
      FUNNEL_STEP_TYPES.find((m) => m.type === step.stepType) || FUNNEL_STEP_TYPES[0];
    const visitorsIn = Math.max(step.visitors || 0, 0);
    const completionsOut = Math.min(Math.max(step.completions || 0, 0), visitorsIn);
    const dropOffCount = Math.max(visitorsIn - completionsOut, 0);
    const stepConversionRate =
      visitorsIn > 0 ? Number(((completionsOut / visitorsIn) * 100).toFixed(1)) : 0;
    const dropOffRate =
      visitorsIn > 0 ? Number(((dropOffCount / visitorsIn) * 100).toFixed(1)) : 0;

    return {
      step,
      index,
      stepMeta,
      visitorsIn,
      completionsOut,
      stepConversionRate,
      dropOffCount,
      dropOffRate,
    };
  });

  return {
    topVisitors,
    totalLeads,
    leadConversionRate,
    finalCompletions,
    fullFunnelCompletionRate,
    stepRows,
  };
}
