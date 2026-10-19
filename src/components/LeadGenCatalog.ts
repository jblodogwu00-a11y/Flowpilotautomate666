import { CaptureAsset, CaptureAssetType } from '../types';

export type LeadGenToolFormat =
  | 'landing_page'
  | 'squeeze_page'
  | 'opt_in_form'
  | 'contact_form'
  | 'survey_form'
  | 'link_in_bio'
  | 'thank_you_page'
  | 'lead_magnet'
  | 'popup_embedded';

export interface LeadGenToolFormatSpec {
  id: LeadGenToolFormat;
  label: string;
  shortLabel: string;
  firestoreAssetType: CaptureAssetType;
  categoryBadge: string;
  description: string;
  defaultHeadline: string;
  defaultSubheadline: string;
  defaultCta: string;
  defaultTags: string[];
  defaultRedirectMode: 'inline_thank_you' | 'custom_url' | 'thank_you_page' | 'lead_magnet_download';
}

export const LEAD_GEN_TOOL_FORMATS: LeadGenToolFormatSpec[] = [
  {
    id: 'landing_page',
    label: 'Landing Page',
    shortLabel: 'Landing Page',
    firestoreAssetType: 'landing_page',
    categoryBadge: 'Full-Page Conversion',
    description:
      'Complete conversion page with hero section, value bullets, social proof, FAQ, and list-connected opt-in form.',
    defaultHeadline: 'Build & Automate Your Client Pipeline in 15 Minutes a Week',
    defaultSubheadline:
      'Join 4,200+ creators, coaches, and agencies using our step-by-step system to capture and convert warm leads automatically.',
    defaultCta: 'Get Instant Access',
    defaultTags: ['landing-page', 'website-lead'],
    defaultRedirectMode: 'thank_you_page',
  },
  {
    id: 'squeeze_page',
    label: 'Squeeze Page',
    shortLabel: 'Squeeze Page',
    firestoreAssetType: 'landing_page',
    categoryBadge: 'High-Velocity Email Capture',
    description:
      'Distraction-free, above-the-fold capture page engineered for maximum email & WhatsApp opt-in conversion.',
    defaultHeadline: 'Free 7-Page Blueprint: The 38% Conversion Squeeze System',
    defaultSubheadline:
      'Enter your best email below and we will send the annotated template directly to your inbox in 30 seconds.',
    defaultCta: 'Send Me the Blueprint →',
    defaultTags: ['squeeze-page', 'fast-opt-in'],
    defaultRedirectMode: 'lead_magnet_download',
  },
  {
    id: 'opt_in_form',
    label: 'Opt-In Form',
    shortLabel: 'Opt-In Form',
    firestoreAssetType: 'inline_form',
    categoryBadge: 'Newsletter & Waitlist',
    description:
      'Clean newsletter, waitlist, and VIP update signup form with GDPR/TCPA consent checkbox and instant list routing.',
    defaultHeadline: 'Join the Weekly Growth Dispatch',
    defaultSubheadline:
      'One actionable automation teardown every Tuesday morning. Zero spam, unsubscribe in one click.',
    defaultCta: 'Subscribe Free',
    defaultTags: ['opt-in-form', 'newsletter'],
    defaultRedirectMode: 'inline_thank_you',
  },
  {
    id: 'contact_form',
    label: 'Contact Form',
    shortLabel: 'Contact Form',
    firestoreAssetType: 'inline_form',
    categoryBadge: 'Sales & Inquiry Routing',
    description:
      'Structured inquiry & consultation request form with company, project scope, and automatic CRM task/automation trigger.',
    defaultHeadline: 'Speak With Our Advisory Team',
    defaultSubheadline:
      'Tell us about your team and goals below. Your inquiry routes directly into our priority CRM pipeline.',
    defaultCta: 'Request Consultation',
    defaultTags: ['contact-form', 'inbound-inquiry'],
    defaultRedirectMode: 'inline_thank_you',
  },
  {
    id: 'survey_form',
    label: 'Survey & Qualification Form',
    shortLabel: 'Survey Form',
    firestoreAssetType: 'inline_form',
    categoryBadge: 'Lead Scoring & Segmentation',
    description:
      'Multi-question qualification survey that maps responses directly into CRM custom fields and applies segment tags.',
    defaultHeadline: '2-Minute Growth & Automation Diagnostic Survey',
    defaultSubheadline:
      'Answer 3 quick questions so we can tailor your onboarding recommendations and assign your segment.',
    defaultCta: 'Submit Survey & See Results',
    defaultTags: ['survey-completed', 'qualified-lead'],
    defaultRedirectMode: 'thank_you_page',
  },
  {
    id: 'link_in_bio',
    label: 'Link-in-Bio Page',
    shortLabel: 'Link-in-Bio',
    firestoreAssetType: 'landing_page',
    categoryBadge: 'Social Profile Hub',
    description:
      'Mobile-first creator & brand hub combining featured resource links, booking buttons, and direct list opt-in capture.',
    defaultHeadline: '@flowpilot · Official Creator Resources & Links',
    defaultSubheadline:
      'Grab free playbooks, book a 1-on-1 strategy session, or join our private WhatsApp & email insiders list.',
    defaultCta: 'Join VIP Insiders List',
    defaultTags: ['link-in-bio', 'social-traffic'],
    defaultRedirectMode: 'inline_thank_you',
  },
  {
    id: 'thank_you_page',
    label: 'Thank-You Page',
    shortLabel: 'Thank-You Page',
    firestoreAssetType: 'landing_page',
    categoryBadge: 'Post-Opt-In Conversion',
    description:
      'Confirmation page displayed after form submission with resource download links, calendar booking CTA, and WhatsApp opt-in.',
    defaultHeadline: 'You’re In! Your Resource Is on Its Way to Your Inbox',
    defaultSubheadline:
      'While your email arrives, complete Step 2 below to claim your bonus strategy session or download the file directly.',
    defaultCta: 'Book Bonus Strategy Call',
    defaultTags: ['thank-you-confirmed', 'step-2-engaged'],
    defaultRedirectMode: 'custom_url',
  },
  {
    id: 'lead_magnet',
    label: 'Lead Magnet Funnel',
    shortLabel: 'Lead Magnet',
    firestoreAssetType: 'lead_magnet_funnel',
    categoryBadge: 'Digital Asset Delivery',
    description:
      '2-step gated resource delivery funnel (PDF guide, checklist, Notion template, or video training) with instant download & automation.',
    defaultHeadline: 'Download the 2026 Omnichannel Automation Kit (PDF + Templates)',
    defaultSubheadline:
      'Includes 12 pre-built Email, SMS, and Official WhatsApp sequences ready to deploy in your workspace.',
    defaultCta: 'Unlock & Download Kit Now',
    defaultTags: ['lead-magnet', 'kit-downloaded'],
    defaultRedirectMode: 'lead_magnet_download',
  },
  {
    id: 'popup_embedded',
    label: 'Popup / Embedded Form',
    shortLabel: 'Popup / Embed',
    firestoreAssetType: 'popup_form',
    categoryBadge: 'Modal & Script Widget',
    description:
      'Exit-intent, scroll-triggered, or timed modal popup and copy-paste HTML/JS embed widget for external websites.',
    defaultHeadline: 'Wait — Before You Go, Grab the Free Launch Checklist',
    defaultSubheadline:
      'Get our 14-point campaign pre-flight checklist and join our subscriber list in one click.',
    defaultCta: 'Send Me the Checklist',
    defaultTags: ['popup-capture', 'web-embed'],
    defaultRedirectMode: 'inline_thank_you',
  },
];

export type FormFieldInputType = 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'checkbox';

export interface LeadGenFormField {
  id: string;
  label: string;
  fieldKey: string; // e.g. 'fullName', 'email', 'phone', 'company', or custom key
  inputType: FormFieldInputType;
  placeholder: string;
  required: boolean;
  isCustomField: boolean;
  options?: string[]; // For 'select' survey dropdowns
}

export type CanvasBlockType =
  | 'hero_header'
  | 'video_embed'
  | 'pricing_tiers'
  | 'countdown_timer'
  | 'faq_section'
  | 'value_bullets'
  | 'lead_magnet_card'
  | 'link_in_bio_stack'
  | 'capture_form'
  | 'social_proof'
  | 'thank_you_card';

export type PageVisualTheme =
  | 'classic_ivory'
  | 'obsidian_gold'
  | 'emerald_executive'
  | 'classic_ivory_brass'
  | 'obsidian_gold_editorial'
  | 'executive_emerald';

export interface FaqPairItem {
  question: string;
  answer: string;
}

export interface CanvasBlockItem {
  id: string;
  type: CanvasBlockType;
  title: string;
  content: string;
  items?: string[];
  accentNote?: string;
  ctaButtonLabel?: string;
  // Video / VSL Player fields
  videoUrl?: string;
  videoDuration?: string;
  // Pricing & Offer fields
  priceAmount?: string;
  originalPrice?: string;
  billingCadence?: string;
  guaranteeNote?: string;
  pricingTiers?: {
    name: string;
    price: string;
    badge?: string;
    billingPeriod?: string;
    highlighted?: boolean;
    features: string[];
    ctaLabel: string;
  }[];
  // Urgency Countdown Timer fields
  countdownDays?: number;
  countdownHours?: number;
  countdownMinutes?: number;
  countdownSeconds?: number;
  timerHours?: string | number;
  timerMinutes?: string | number;
  timerSeconds?: string | number;
  timerLabel?: string;
  // Interactive FAQ Accordion items
  faqItems?: FaqPairItem[];
}

export interface ElementPaletteSpec {
  type: CanvasBlockType;
  label: string;
  shortLabel: string;
  badge?: string;
  category: 'Core Layout' | 'Conversion & Media' | 'Offer & Proof' | 'Lead Capture';
  description: string;
}

export const ELEMENT_PALETTE_CATALOG: ElementPaletteSpec[] = [
  {
    type: 'hero_header',
    label: 'Hero Banner & Headline',
    shortLabel: '+ Hero Banner',
    category: 'Core Layout',
    description: 'High-impact editorial headline, subheadline, and classic authority kicker.',
  },
  {
    type: 'video_embed',
    label: 'Video / VSL Showcase Player',
    shortLabel: '+ Video / VSL',
    category: 'Conversion & Media',
    description: '16:9 widescreen video player or YouTube/Vimeo embed with duration badge and caption.',
  },
  {
    type: 'pricing_tiers',
    label: 'Pricing & Offer Box',
    shortLabel: '+ Pricing / Offer',
    category: 'Offer & Proof',
    description: 'Structured pricing card with anchor price, feature checklist, and guarantee seal.',
  },
  {
    type: 'countdown_timer',
    label: 'Urgency Countdown Timer',
    shortLabel: '+ Countdown Timer',
    category: 'Conversion & Media',
    description: 'Live tabular countdown timer (Days, Hours, Minutes, Seconds) for launches and webinars.',
  },
  {
    type: 'faq_section',
    label: 'Interactive FAQ Accordion',
    shortLabel: '+ FAQ Section',
    category: 'Offer & Proof',
    description: 'Expandable question-and-answer pairs to overcome buyer objections before opt-in.',
  },
  {
    type: 'capture_form',
    label: 'Opt-In / Survey Form',
    shortLabel: '+ Opt-In Form',
    category: 'Lead Capture',
    description: 'Customizable lead capture form with CRM custom fields, tags, and instant redirect.',
  },
  {
    type: 'value_bullets',
    label: 'Value & Benefit Bullets',
    shortLabel: '+ Value Bullets',
    category: 'Core Layout',
    description: 'Scannable benefit checklist highlighting key takeaways or curriculum modules.',
  },
  {
    type: 'social_proof',
    label: 'Testimonials & Case Proof',
    shortLabel: '+ Social Proof',
    category: 'Offer & Proof',
    description: 'Verified client outcomes, revenue metrics, and attributable operator quotes.',
  },
  {
    type: 'lead_magnet_card',
    label: 'Lead Magnet Resource Box',
    shortLabel: '+ Lead Magnet',
    category: 'Lead Capture',
    description: 'Downloadable PDF/resource preview card with included asset breakdown.',
  },
  {
    type: 'link_in_bio_stack',
    label: 'Link-in-Bio Action Stack',
    shortLabel: '+ Bio Links',
    category: 'Lead Capture',
    description: 'Stack of clickable resource, booking, and WhatsApp channel buttons.',
  },
  {
    type: 'thank_you_card',
    label: 'Confirmation & Next Steps',
    shortLabel: '+ Confirmation',
    category: 'Core Layout',
    description: 'Post-submission onboarding checklist and calendar/resource action card.',
  },
];

export function createDefaultElementBlock(type: CanvasBlockType): CanvasBlockItem {
  const uid = `blk_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  switch (type) {
    case 'hero_header':
      return {
        id: uid,
        type: 'hero_header',
        accentNote: 'Classic Executive Edition · Verified Opt-In',
        title: 'The Sovereign Client Acquisition & Automation Architecture',
        content:
          'How modern creators, educators, and advisory practices build predictable inbound pipelines without software bloat.',
      };
    case 'video_embed':
      return {
        id: uid,
        type: 'video_embed',
        accentNote: 'Featured Masterclass Briefing',
        title: 'Watch the 8-Minute Executive Walkthrough',
        content:
          'See how every landing page submission routes into segmented CRM lists and triggers instant WhatsApp, SMS, and Email follow-ups.',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        videoDuration: '08:42 HD Briefing',
      };
    case 'pricing_tiers':
      return {
        id: uid,
        type: 'pricing_tiers',
        accentNote: 'Complete Implementation Charter',
        title: 'Executive Growth & Automation Blueprint Bundle',
        content:
          'Everything required to launch high-converting pages, automated follow-up sequences, and multi-channel broadcasts.',
        priceAmount: '$197',
        originalPrice: '$497',
        billingCadence: 'One-Time Enrollment · Lifetime Updates',
        guaranteeNote: '30-Day Unconditional Performance Guarantee',
        items: [
          'Full 6-Module Video Masterclass & Annotated SOP Library',
          'Done-For-You Course, Affiliate, Squeeze & Webinar Page Templates',
          'Pre-Built WhatsApp, SMS & Email Follow-Up Sequences',
          'Direct 1-on-1 Onboarding Implementation Review',
        ],
      };
    case 'countdown_timer':
      return {
        id: uid,
        type: 'countdown_timer',
        accentNote: 'Limited Enrollment Window',
        title: 'Charter Bonus Access & Live Seat Reservation Closes In:',
        content: 'Lock in your spot before the timer reaches zero to claim the bonus template vault.',
        countdownDays: 2,
        countdownHours: 14,
        countdownMinutes: 38,
        countdownSeconds: 45,
      };
    case 'faq_section':
      return {
        id: uid,
        type: 'faq_section',
        accentNote: 'Clarity & Transparency',
        title: 'Frequently Asked Questions',
        content: 'Everything you need to know before registering or claiming your access.',
        faqItems: [
          {
            question: 'How quickly do I receive access after submitting the form?',
            answer:
              'Immediately. Your profile is added to our priority list and your welcome email and WhatsApp confirmation are dispatched within seconds.',
          },
          {
            question: 'Can I customize every section, form field, and redirect link?',
            answer:
              'Yes. Every headline, video player, pricing tier, countdown timer, FAQ item, and custom CRM form field can be tailored to your exact brand.',
          },
          {
            question: 'Is my contact information kept private and compliant?',
            answer:
              '100%. All submissions follow strict opt-in consent standards and you can unsubscribe with a single click at any time.',
          },
        ],
      };
    case 'value_bullets':
      return {
        id: uid,
        type: 'value_bullets',
        accentNote: 'Core Curriculum & Pillars',
        title: 'What You Will Master & Implement Inside',
        content: 'Engineered for immediate execution and measurable conversion lift:',
        items: [
          'Pillar 01: High-converting page architecture with zero developer bottlenecks',
          'Pillar 02: Automated CRM list segmentation and instant tag routing',
          'Pillar 03: Synchronized Email, Official WhatsApp & SMS follow-up sequences',
        ],
      };
    case 'social_proof':
      return {
        id: uid,
        type: 'social_proof',
        accentNote: 'Verified Operator Outcomes',
        title: '+142% Qualified Conversions Across 4,200+ Operators',
        content:
          '“Switching our course launches and squeeze pages to this classic layout lifted our opt-in rate from 24% to 43.6% in two weeks.” — Elena Vance, Creative Director',
        items: [
          '$48,600 Cohort Launch Revenue in 14 Days · Kinetic Growth Agency',
          '43.6% Squeeze Page Opt-In Conversion · Sovereign Media Atelier',
        ],
      };
    case 'lead_magnet_card':
      return {
        id: uid,
        type: 'lead_magnet_card',
        accentNote: 'Instant Digital Delivery',
        title: 'Included in Your Free Downloadable Resource Pack',
        content: 'Unlocked immediately upon completing the form:',
        items: [
          '28-Page Annotated Conversion & Copywriting Manual (PDF)',
          '12 High-Converting Email, WhatsApp & SMS Swipe Files',
          'Launch Pre-Flight & Deliverability Verification Checklist',
        ],
      };
    case 'link_in_bio_stack':
      return {
        id: uid,
        type: 'link_in_bio_stack',
        accentNote: 'Curated Directory',
        title: 'Featured Resources, Bookings & Channels',
        content: 'Select any destination below:',
        items: [
          '📘 Download the 2026 Growth & Funnel Playbook (Free PDF)',
          '📅 Reserve a 1-on-1 Executive Strategy Consultation',
          '💬 Join the Official WhatsApp VIP Broadcast Channel',
        ],
      };
    case 'thank_you_card':
      return {
        id: uid,
        type: 'thank_you_card',
        accentNote: 'Registration Verified',
        title: 'Your Spot Is Confirmed — Complete Your 3 Next Steps',
        content: 'We have dispatched your access link to your inbox and WhatsApp.',
        items: [
          'Step 1: Check your email inbox for your welcome credentials',
          'Step 2: Reply "READY" on WhatsApp to unlock your bonus workbook',
          'Step 3: Click the primary button below to access your destination now',
        ],
      };
    case 'capture_form':
    default:
      return {
        id: uid,
        type: 'capture_form',
        accentNote: 'Secure Direct Registration',
        title: 'Complete Your Details Below for Instant Access',
        content: 'Enter your best contact details below. 100% privacy-protected.',
      };
  }
}

export interface ReadyMadePageTemplate {
  id: string;
  name: string;
  badge: string;
  toolFormat: LeadGenToolFormat;
  visualTheme: PageVisualTheme;
  description: string;
  summary?: string;
  defaultTitle: string;
  defaultSlug: string;
  defaultHeadline: string;
  defaultSubheadline: string;
  defaultCtaText: string;
  defaultRedirectUrl: string;
  defaultRedirectMode: 'inline_thank_you' | 'custom_url' | 'thank_you_page' | 'lead_magnet_download';
  defaultTags: string[];
  blocks: CanvasBlockItem[];
  formFields: LeadGenFormField[];
}

export const READY_MADE_PAGE_TEMPLATES: ReadyMadePageTemplate[] = [
  {
    id: 'course_affiliate_sales',
    name: 'Course & Affiliate Sales Page',
    badge: 'Flagship Sales Template',
    toolFormat: 'landing_page',
    visualTheme: 'obsidian_gold',
    description:
      'Complete long-form Course & Affiliate Offer Sales Page featuring Hero, VSL Video Player, Urgency Countdown Timer, Curriculum Bullets, Pricing & Offer Box, Social Proof, FAQ Accordion, and Enrollment Form.',
    defaultTitle: 'Sovereign Creator Academy & Affiliate Masterclass Sales Page',
    defaultSlug: 'sovereign-academy-sales',
    defaultHeadline: 'Master the Architecture of High-Converting Digital Offers & Automated Funnels',
    defaultSubheadline:
      'A complete step-by-step curriculum and ready-to-deploy funnel system for course creators, affiliate marketers, and modern digital businesses.',
    defaultCtaText: 'Enroll Now & Unlock Instant Access →',
    defaultRedirectUrl: 'https://flowpilot.app/checkout/sovereign-academy',
    defaultRedirectMode: 'custom_url',
    defaultTags: ['course-sales-page', 'affiliate-offer', 'vip-buyer-intent'],
    blocks: [
      {
        id: 'tpl_sales_hero',
        type: 'hero_header',
        accentNote: 'Executive Masterclass & Affiliate Partner Edition',
        title: 'Master the Architecture of High-Converting Digital Offers & Automated Funnels',
        content:
          'Stop stitching together disconnected tools. Deploy our proven sales page, multi-channel follow-up engine, and high-ticket conversion blueprint in one afternoon.',
      },
      {
        id: 'tpl_sales_video',
        type: 'video_embed',
        accentNote: 'Official Video Sales Letter (VSL)',
        title: 'Watch Inside the Academy: How Operators Scale to $50k/Mo',
        content:
          'Press play for a full 11-minute tour of the course modules, affiliate commission structure, and live automation templates.',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        videoDuration: '11:24 Masterclass Preview',
      },
      {
        id: 'tpl_sales_timer',
        type: 'countdown_timer',
        accentNote: 'Charter Enrollment & Bonus Window',
        title: 'Founding Member Pricing & Affiliate Swipe Vault Closes In:',
        content: 'Enroll before the countdown expires to lock in 60% off plus all 3 fast-action bonuses.',
        countdownDays: 1,
        countdownHours: 18,
        countdownMinutes: 45,
        countdownSeconds: 20,
      },
      {
        id: 'tpl_sales_bullets',
        type: 'value_bullets',
        accentNote: 'Complete 5-Module Curriculum Breakdown',
        title: 'Everything Included Inside Your Enrollment Today',
        content: 'Every module includes HD video lessons, annotated workbooks, and 1-click templates:',
        items: [
          'Module 01: Classic High-Trust Offer Positioning & Copywriting Architecture',
          'Module 02: High-Velocity Squeeze Pages & Lead Magnet Funnel Engineering',
          'Module 03: Automated Email, Official WhatsApp & SMS Follow-Up Sequences',
          'Module 04: Affiliate Traffic Scaling, Bridge Pages & Bonus Stack Design',
          'Module 05: Live CRM Pipeline Scoring, Tagging & List Kill-Switch Automation',
        ],
      },
      {
        id: 'tpl_sales_pricing',
        type: 'pricing_tiers',
        accentNote: 'Charter Member Offer',
        title: 'Full Academy Access + Done-For-You Funnel & Affiliate Pack',
        content:
          'Immediate lifetime access to all training modules, swipe files, and workspace templates.',
        priceAmount: '$197',
        originalPrice: '$497',
        billingCadence: 'One-Time Payment · Zero Monthly Fees · Instant Access',
        guaranteeNote: '30-Day 100% Money-Back Performance Guarantee',
        items: [
          'Full 5-Module Sovereign Creator & Affiliate Video Curriculum ($497 Value)',
          '15 Ready-to-Send Email, WhatsApp & SMS Promotion Sequences ($297 Value)',
          'Complete Course, Squeeze & Webinar Page Template Vault ($197 Value)',
          'Private VIP Community & Weekly Office Hours Coaching ($197 Value)',
        ],
      },
      {
        id: 'tpl_sales_proof',
        type: 'social_proof',
        accentNote: 'Verified Student & Affiliate Results',
        title: 'Over $1.8M in Tracked Creator & Affiliate Launches',
        content:
          '“Within 21 days of launching this exact Course & Affiliate Sales Page template and connecting our WhatsApp + Email follow-up sequence, we closed 94 new enrollments.” — Marcus Okafor, Kinetic Growth',
        items: [
          '94 Course Enrollments in 21 Days · 41.2% Opt-In-to-Sale Follow-Up Rate',
          '$18,400 Affiliate Commission Sprint · Automated Bridge Page + WhatsApp Sequence',
        ],
      },
      {
        id: 'tpl_sales_form',
        type: 'capture_form',
        accentNote: 'Step 1 of 2 · Instant Account & Bonus Registration',
        title: 'Enter Your Details to Claim Charter Pricing & Instant Access',
        content:
          'Your credentials and bonus bundle will be sent to your email and WhatsApp immediately before redirecting to checkout.',
      },
      {
        id: 'tpl_sales_faq',
        type: 'faq_section',
        accentNote: 'Enrollment FAQ',
        title: 'Frequently Asked Questions',
        content: 'Clear answers to common questions about the Academy and Affiliate Program:',
        faqItems: [
          {
            question: 'Do I get immediate access to all modules and templates?',
            answer:
              'Yes! As soon as you complete the registration form below, your profile is tagged in our CRM and your instant access link is delivered via Email and WhatsApp.',
          },
          {
            question: 'Can I use this template for both my own digital course and affiliate offers?',
            answer:
              'Absolutely. You can edit the headline, video URL, pricing box, countdown timer, and CTA redirect link to point to your checkout page or any affiliate offer link.',
          },
          {
            question: 'What if I want to customize the colors, blocks, or form questions?',
            answer:
              'Every single block on this page is 100% editable in the visual builder—reorder sections, add or remove blocks, or switch visual themes anytime.',
          },
        ],
      },
    ],
    formFields: [
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
        label: 'Best Email Address (For Login & Bonus Delivery)',
        fieldKey: 'email',
        inputType: 'email',
        placeholder: 'you@domain.com',
        required: true,
        isCustomField: false,
      },
      {
        id: 'fld_phone',
        label: 'Phone Number',
        fieldKey: 'phone',
        inputType: 'tel',
        placeholder: '+1 (555) 019-2831',
        required: true,
        isCustomField: false,
      },
      {
        id: 'fld_track',
        label: 'Primary Focus Track',
        fieldKey: 'Primary Focus Track',
        inputType: 'select',
        placeholder: 'Select your focus',
        required: true,
        isCustomField: true,
        options: [
          'Launching / Scaling My Own Course or Coaching Offer',
          'Promoting High-Ticket Affiliate Offers',
          'Building Client Funnels as an Agency / Consultant',
        ],
      },
    ],
  },
  {
    id: 'squeeze_page_classic',
    name: 'High-Converting Squeeze Page',
    badge: '43.8% Avg Opt-In',
    toolFormat: 'squeeze_page',
    visualTheme: 'classic_ivory',
    description:
      'Focused, distraction-free Squeeze Page with Classic Editorial Header, Urgency Timer, 3 High-Impact Value Bullets, Lead Magnet Preview Card, and Instant Opt-In Form.',
    defaultTitle: 'The 7-Figure Omnichannel Squeeze Blueprint (Free PDF)',
    defaultSlug: 'omnichannel-squeeze-blueprint',
    defaultHeadline: 'Free 28-Page Blueprint: How We Convert 43.8% of Cold Traffic Into Warm Buyers',
    defaultSubheadline:
      'Enter your best email and WhatsApp number below to receive the annotated PDF playbook and 5 swipeable follow-up sequences in 30 seconds.',
    defaultCtaText: 'Send Me the Free Blueprint Now →',
    defaultRedirectUrl: 'https://flowpilot.app/assets/omnichannel-squeeze-blueprint.pdf',
    defaultRedirectMode: 'lead_magnet_download',
    defaultTags: ['squeeze-page', 'blueprint-download', 'warm-lead'],
    blocks: [
      {
        id: 'tpl_sqz_hero',
        type: 'hero_header',
        accentNote: 'Complimentary Executive Briefing · Instant PDF Delivery',
        title: 'Free 28-Page Blueprint: How We Convert 43.8% of Cold Traffic Into Warm Buyers',
        content:
          'Discover the exact above-the-fold page structure and 3-channel follow-up sequence used by top digital creators and advisory firms.',
      },
      {
        id: 'tpl_sqz_timer',
        type: 'countdown_timer',
        accentNote: 'Complimentary Edition Availability',
        title: 'Free Public Download + Bonus Swipe File Access Ends In:',
        content: 'Download your copy now before this edition moves into our private member vault.',
        countdownDays: 0,
        countdownHours: 6,
        countdownMinutes: 24,
        countdownSeconds: 15,
      },
      {
        id: 'tpl_sqz_magnet',
        type: 'lead_magnet_card',
        accentNote: 'Inside Your Instant Download Pack',
        title: 'What You Receive Immediately Upon Opting In:',
        content: 'Delivered straight to your inbox and WhatsApp in under 30 seconds:',
        items: [
          'The 5-Point Above-the-Fold Squeeze Page Wireframe (Annotated PDF)',
          '7 High-Converting Headline Formulas for Courses, Coaching & Affiliates',
          'Ready-to-Activate 3-Day Email + WhatsApp Nurture Sequence',
        ],
      },
      {
        id: 'tpl_sqz_form',
        type: 'capture_form',
        accentNote: '100% Free · Zero Spam Guarantee',
        title: 'Where Should We Send Your Free Blueprint?',
        content: 'Enter your name and best email below for instant access:',
      },
      {
        id: 'tpl_sqz_proof',
        type: 'social_proof',
        accentNote: 'Reader Feedback',
        title: 'Downloaded by 11,400+ Marketers & Founders',
        content:
          '“This single 28-page PDF replaced three courses I bought last year. We deployed the squeeze layout in 10 minutes and doubled our daily email signups.” — David Sterling',
      },
    ],
    formFields: [
      {
        id: 'fld_name',
        label: 'First & Last Name',
        fieldKey: 'fullName',
        inputType: 'text',
        placeholder: 'Enter your name',
        required: true,
        isCustomField: false,
      },
      {
        id: 'fld_email',
        label: 'Best Email Address',
        fieldKey: 'email',
        inputType: 'email',
        placeholder: 'you@company.com',
        required: true,
        isCustomField: false,
      },
      {
        id: 'fld_phone',
        label: 'Phone Number',
        fieldKey: 'phone',
        inputType: 'tel',
        placeholder: '+1 (555) 019-2831',
        required: true,
        isCustomField: false,
      },
    ],
  },
  {
    id: 'webinar_registration',
    name: 'Webinar & Masterclass Page',
    badge: 'Live Event Template',
    toolFormat: 'landing_page',
    visualTheme: 'emerald_executive',
    description:
      'High-converting Live Webinar & Masterclass Registration Page with Event Hero, Speaker Video Preview, Live Session Countdown Timer, Key Takeaways, Seat Reservation Form, and Event FAQ.',
    defaultTitle: 'Live Executive Masterclass: Automated Client Acquisition in 2026',
    defaultSlug: 'live-automation-masterclass',
    defaultHeadline: 'Free Live Masterclass: How to Automate Lead Capture, WhatsApp & Email Closing',
    defaultSubheadline:
      'Reserve your complimentary seat for Thursday’s live 60-minute executive workshop—includes live Q&A and our complete automation template pack for attendees.',
    defaultCtaText: 'Reserve My Free Masterclass Seat →',
    defaultRedirectUrl: 'https://flowpilot.app/webinar/live-room-access',
    defaultRedirectMode: 'thank_you_page',
    defaultTags: ['webinar-registered', 'masterclass-attendee', 'hot-prospect'],
    blocks: [
      {
        id: 'tpl_web_hero',
        type: 'hero_header',
        accentNote: 'Live Interactive Workshop · Thursday 2:00 PM EST',
        title: 'Free Live Masterclass: How to Automate Lead Capture, WhatsApp & Email Closing',
        content:
          'Join our live 60-minute architectural breakdown and walk away with a fully wired lead generation and multi-channel follow-up system.',
      },
      {
        id: 'tpl_web_timer',
        type: 'countdown_timer',
        accentNote: 'Live Broadcast Countdown',
        title: 'Next Live Masterclass Session Begins In:',
        content: 'Seats are capped at 250 live attendees to ensure every question is answered on the call.',
        countdownDays: 3,
        countdownHours: 9,
        countdownMinutes: 15,
        countdownSeconds: 0,
      },
      {
        id: 'tpl_web_video',
        type: 'video_embed',
        accentNote: '60-Second Host Invitation',
        title: 'Watch a Quick Preview of What We Will Build Together Live',
        content:
          'See the exact 3-channel automation workflow and conversion pages we will hand over to all live attendees.',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        videoDuration: '01:15 Host Trailer',
      },
      {
        id: 'tpl_web_bullets',
        type: 'value_bullets',
        accentNote: 'Masterclass Agenda',
        title: '3 Breakthroughs You Will Learn on This Live Session',
        content: 'Bring a notebook—this is a zero-fluff, live implementation session:',
        items: [
          'Minute 00–20: Building high-trust Squeeze & Sales Pages that convert cold clicks at 35%+',
          'Minute 20–40: Connecting instant Gmail OAuth, Official WhatsApp & SMS auto-responders',
          'Minute 40–60: Live List Kill-Switch rules that stop promos the moment a prospect buys',
        ],
      },
      {
        id: 'tpl_web_form',
        type: 'capture_form',
        accentNote: 'Instant Calendar & WhatsApp Reminder Included',
        title: 'Reserve Your Complimentary Seat Below',
        content:
          'We will send your private Zoom/Broadcast room link via Email and SMS/WhatsApp 15 minutes before we go live.',
      },
      {
        id: 'tpl_web_faq',
        type: 'faq_section',
        accentNote: 'Event Details',
        title: 'Masterclass Frequently Asked Questions',
        content: 'Common questions before registering:',
        faqItems: [
          {
            question: 'Will there be a replay if I cannot attend live?',
            answer:
              'Yes, registered attendees receive a 48-hour replay link via email, though the downloadable template bundle is reserved exclusively for live participants.',
          },
          {
            question: 'How will I receive my room link and reminders?',
            answer:
              'Immediately upon registration, you will receive an email confirmation plus an optional WhatsApp/SMS reminder 15 minutes before kickoff.',
          },
        ],
      },
    ],
    formFields: [
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
        label: 'Email Address (For Room Link & Replay)',
        fieldKey: 'email',
        inputType: 'email',
        placeholder: 'you@company.com',
        required: true,
        isCustomField: false,
      },
      {
        id: 'fld_phone',
        label: 'Phone Number',
        fieldKey: 'phone',
        inputType: 'tel',
        placeholder: '+1 (555) 019-2831',
        required: true,
        isCustomField: false,
      },
      {
        id: 'fld_question',
        label: 'What is your #1 question for the live Q&A?',
        fieldKey: 'Webinar Q&A Question',
        inputType: 'text',
        placeholder: 'e.g. How to connect WhatsApp & Email sequences to my offer',
        required: false,
        isCustomField: true,
      },
    ],
  },
  {
    id: 'vsl_consultation_page',
    name: 'VSL & Strategy Call Funnel Page',
    badge: 'High-Ticket Booking',
    toolFormat: 'contact_form',
    visualTheme: 'obsidian_gold',
    description:
      'Executive Video Sales Letter (VSL) + Case Study Proof + Qualification Application Form for agencies, coaches, and B2B consultants.',
    defaultTitle: 'Executive Pipeline Architecture — Strategy Session Application',
    defaultSlug: 'executive-strategy-application',
    defaultHeadline: 'Watch the 6-Minute Case Study: How We Install Turnkey Inbound Funnels in 14 Days',
    defaultSubheadline:
      'After watching the short briefing below, complete the 60-second qualification form to schedule your 1-on-1 architecture review.',
    defaultCtaText: 'Submit Application & Proceed to Calendar →',
    defaultRedirectUrl: 'https://flowpilot.app/book-strategy-call',
    defaultRedirectMode: 'custom_url',
    defaultTags: ['vsl-application', 'strategy-call', 'high-ticket-lead'],
    blocks: [
      {
        id: 'tpl_vsl_hero',
        type: 'hero_header',
        accentNote: 'For Established Creators, Coaches & B2B Agencies',
        title: 'Watch the 6-Minute Case Study: How We Install Turnkey Inbound Funnels in 14 Days',
        content:
          'See the exact architecture behind $48,600+ cohort launches and automated discovery bookings.',
      },
      {
        id: 'tpl_vsl_video',
        type: 'video_embed',
        accentNote: 'Step 1 · Watch Executive Briefing',
        title: 'The 3-Pillar Autonomous Pipeline System',
        content: 'Watch this 6-minute overview before submitting your application below.',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        videoDuration: '06:18 Case Study',
      },
      {
        id: 'tpl_vsl_proof',
        type: 'social_proof',
        accentNote: 'Verified Client Case Studies',
        title: '+142% Discovery Calls Booked in 90 Days',
        content:
          '“Connecting our VSL application directly to CRM lead scoring and instant WhatsApp follow-up cut our no-show rate to under 8%.” — Elena Vance',
      },
      {
        id: 'tpl_vsl_form',
        type: 'capture_form',
        accentNote: 'Step 2 · Qualification & Calendar Routing',
        title: 'Apply for Your 1-on-1 Strategy & Architecture Session',
        content: 'Complete your details below to unlock our private booking calendar:',
      },
    ],
    formFields: [
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
        label: 'Work Email',
        fieldKey: 'email',
        inputType: 'email',
        placeholder: 'you@company.com',
        required: true,
        isCustomField: false,
      },
      {
        id: 'fld_phone',
        label: 'Phone Number',
        fieldKey: 'phone',
        inputType: 'tel',
        placeholder: '+1 (555) 019-2831',
        required: true,
        isCustomField: false,
      },
      {
        id: 'fld_rev',
        label: 'Current Monthly Revenue Tier',
        fieldKey: 'Monthly Revenue Tier',
        inputType: 'select',
        placeholder: 'Select revenue tier',
        required: true,
        isCustomField: true,
        options: ['Launching ($0 – $5k/mo)', 'Growing ($5k – $25k/mo)', 'Scaling ($25k – $100k+/mo)'],
      },
    ],
  },
  {
    id: 'standalone_custom_form',
    name: 'Standalone Multi-Field Opt-In & Survey Form',
    badge: 'Embeddable Form',
    toolFormat: 'opt_in_form',
    visualTheme: 'classic_ivory',
    description:
      'Clean, embeddable standalone Opt-In & Qualification Form with custom fields, automatic CRM tagging, and instant redirect.',
    defaultTitle: 'VIP Insider & Qualification Opt-In Form',
    defaultSlug: 'vip-insider-opt-in-form',
    defaultHeadline: 'Join the Executive Growth & Automation Dispatch',
    defaultSubheadline:
      'Complete the form below to receive weekly conversion teardowns and instant access to our template vault.',
    defaultCtaText: 'Complete Signup & Unlock Access →',
    defaultRedirectUrl: 'https://flowpilot.app/thank-you',
    defaultRedirectMode: 'inline_thank_you',
    defaultTags: ['standalone-form', 'vip-subscriber'],
    blocks: [
      {
        id: 'tpl_frm_hero',
        type: 'hero_header',
        accentNote: 'Direct CRM List & Tag Integration',
        title: 'Join the Executive Growth & Automation Dispatch',
        content: 'Customize or embed this form anywhere—every field maps straight into your Contact List.',
      },
      {
        id: 'tpl_frm_capture',
        type: 'capture_form',
        accentNote: 'Verified Consent · Instant Delivery',
        title: 'Subscriber & Profile Details',
        content: 'Fill in your details below:',
      },
    ],
    formFields: [
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
        label: 'Phone Number',
        fieldKey: 'phone',
        inputType: 'tel',
        placeholder: '+1 (555) 019-2831',
        required: true,
        isCustomField: false,
      },
    ],
  },
];

export interface LeadGenAssetExtendedMetadata {
  assetIdOrSlug: string;
  toolFormat: LeadGenToolFormat;
  visualTheme?: PageVisualTheme;
  templateId?: string;
  // Drag-and-drop canvas blocks
  blocks: CanvasBlockItem[];
  // Standard & Custom Form Fields
  formFields: LeadGenFormField[];
  // Tags applied on submission
  submissionTags: string[];
  // Linked Automation ID or Name
  linkedAutomationName: string;
  // Redirect / Post-submission behavior
  redirectMode: 'inline_thank_you' | 'custom_url' | 'thank_you_page' | 'lead_magnet_download';
  redirectUrl: string;
  thankYouMessage: string;
  // Lead Magnet file settings
  leadMagnetTitle: string;
  leadMagnetFileUrl: string;
  leadMagnetFileType: 'PDF Guide' | 'Notion Template' | 'Spreadsheet / CSV' | 'Video Masterclass';
  // Link-in-Bio links
  bioLinks: { label: string; url: string; tagOnClick: string }[];
  // Popup & Embed settings
  popupTrigger: 'exit_intent' | 'scroll_50' | 'delay_5s' | 'inline_embed';
  // Basic SEO Metadata
  seoTitle: string;
  seoDescription: string;
  ogImageLabel: string;
  noIndex: boolean;
  // Custom Domain mapping
  customDomain: string;
}

export interface CustomDomainConfig {
  id: string;
  domain: string;
  mappedSlug: string;
  cnameTarget: string;
  txtVerification: string;
  sslStatus: 'Active (Let’s Encrypt TLS 1.3)' | 'Pending DNS Propagation';
  status: 'verified' | 'pending_dns';
  lastChecked: string;
}

export const INITIAL_CUSTOM_DOMAINS: CustomDomainConfig[] = [
  {
    id: 'dom_1',
    domain: 'pages.flowpilotstudio.io',
    mappedSlug: 'creator-playbook',
    cnameTarget: 'edge.flowpilot-hosting.app',
    txtVerification: 'fp-verify=8f92a1c4e7b09d12',
    sslStatus: 'Active (Let’s Encrypt TLS 1.3)',
    status: 'verified',
    lastChecked: 'Verified 6 mins ago',
  },
  {
    id: 'dom_2',
    domain: 'links.rostovastudio.com',
    mappedSlug: 'creator-bio-hub',
    cnameTarget: 'edge.flowpilot-hosting.app',
    txtVerification: 'fp-verify=3c71d9e0a42b8810',
    sslStatus: 'Active (Let’s Encrypt TLS 1.3)',
    status: 'verified',
    lastChecked: 'Verified 1 hour ago',
  },
];

export function buildDefaultFormFieldsForFormat(format: LeadGenToolFormat): LeadGenFormField[] {
  const baseFields: LeadGenFormField[] = [
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
      placeholder: 'you@company.com',
      required: true,
      isCustomField: false,
    },
  ];

  if (format === 'squeeze_page' || format === 'opt_in_form' || format === 'popup_embedded') {
    return [
      ...baseFields,
      {
        id: 'fld_phone',
        label: 'Phone Number',
        fieldKey: 'phone',
        inputType: 'tel',
        placeholder: '+1 (555) 019-2831',
        required: true,
        isCustomField: false,
      },
    ];
  }

  if (format === 'contact_form') {
    return [
      ...baseFields,
      {
        id: 'fld_phone',
        label: 'Phone Number',
        fieldKey: 'phone',
        inputType: 'tel',
        placeholder: '+1 (555) 019-2831',
        required: true,
        isCustomField: false,
      },
      {
        id: 'fld_company',
        label: 'Company / Brand Name',
        fieldKey: 'company',
        inputType: 'text',
        placeholder: 'Acme Studio LLC',
        required: false,
        isCustomField: false,
      },
      {
        id: 'fld_inquiry',
        label: 'How can our team help you?',
        fieldKey: 'Project Scope',
        inputType: 'textarea',
        placeholder: 'Share your timeline, goals, or questions...',
        required: true,
        isCustomField: true,
      },
    ];
  }

  if (format === 'survey_form') {
    return [
      ...baseFields,
      {
        id: 'fld_role',
        label: '1. What best describes your business model?',
        fieldKey: 'Business Model',
        inputType: 'select',
        placeholder: 'Select business model',
        required: true,
        isCustomField: true,
        options: [
          'Creator / Digital Products',
          'Coach / Consultant',
          'Agency / Service Provider',
          'SaaS / E-Commerce Brand',
        ],
      },
      {
        id: 'fld_list_size',
        label: '2. Current audience or contact list size?',
        fieldKey: 'Audience Size',
        inputType: 'select',
        placeholder: 'Select list tier',
        required: true,
        isCustomField: true,
        options: ['Under 500 contacts', '500 – 5,000 contacts', '5,000 – 25,000 contacts', '25,000+ contacts'],
      },
      {
        id: 'fld_goal',
        label: '3. Biggest #1 priority for the next 90 days?',
        fieldKey: 'Primary 90-Day Goal',
        inputType: 'text',
        placeholder: 'e.g. Automate lead magnet follow-up via Email & WhatsApp',
        required: true,
        isCustomField: true,
      },
    ];
  }

  return [
    ...baseFields,
    {
      id: 'fld_phone',
      label: 'WhatsApp / SMS Phone',
      fieldKey: 'phone',
      inputType: 'tel',
      placeholder: '+1 (555) 019-2831',
      required: false,
      isCustomField: false,
    },
  ];
}

export function buildDefaultBlocksForFormat(
  format: LeadGenToolFormat,
  headline: string,
  subheadline: string
): CanvasBlockItem[] {
  const heroBlock: CanvasBlockItem = {
    id: 'blk_hero',
    type: 'hero_header',
    title: headline,
    content: subheadline,
    accentNote: 'Verified Opt-In · Direct CRM & List Routing',
  };

  if (format === 'link_in_bio') {
    return [
      heroBlock,
      {
        id: 'blk_bio_links',
        type: 'link_in_bio_stack',
        title: 'Featured Creator Resources & Booking Links',
        content: 'Tap any resource below or join the VIP subscriber list directly:',
        items: [
          '📘 Download the 2026 Omnichannel Growth Playbook (Free PDF)',
          '📅 Book a 15-Minute Funnel & CRM Strategy Audit',
          '💬 Join Our Official WhatsApp Insider Broadcast Channel',
          '🎥 Watch the 12-Minute Automation Masterclass',
        ],
      },
      {
        id: 'blk_form',
        type: 'capture_form',
        title: 'Join the VIP Insiders List',
        content: 'Get weekly playbooks delivered straight to your inbox.',
      },
    ];
  }

  if (format === 'thank_you_page') {
    return [
      heroBlock,
      {
        id: 'blk_ty_card',
        type: 'thank_you_card',
        title: 'Your Submission Is Confirmed — Next Steps',
        content:
          'We have added your profile to our priority list and dispatched your welcome email.',
        items: [
          'Step 1: Check your email inbox (and promotions tab) for your welcome link',
          'Step 2: Save our official WhatsApp Business number for instant updates',
          'Step 3: Use the button below to access your resource or schedule a call',
        ],
      },
      {
        id: 'blk_proof',
        type: 'social_proof',
        title: 'What Members Say After Joining',
        content:
          '“Connecting our landing pages directly to Contact Lists and automated Email + WhatsApp follow-ups doubled our consultation bookings in 3 weeks.” — Elena Rostova',
      },
    ];
  }

  if (format === 'lead_magnet') {
    return [
      heroBlock,
      {
        id: 'blk_magnet_box',
        type: 'lead_magnet_card',
        title: 'Inside the Downloadable Resource Bundle',
        content: 'Instant digital access unlocked immediately upon form submission:',
        items: [
          'Complete 28-Page Annotated Funnel & List Segmentation Guide (PDF)',
          '5 Ready-to-Send Email & Official WhatsApp Welcome Templates',
          'Deliverability & Consent Checklist (SPF/DKIM/DMARC + TCPA/Meta)',
        ],
      },
      {
        id: 'blk_form',
        type: 'capture_form',
        title: 'Where Should We Send Your Download Link?',
        content: 'Enter your details below for immediate access:',
      },
    ];
  }

  if (format === 'squeeze_page' || format === 'opt_in_form' || format === 'popup_embedded') {
    return [
      heroBlock,
      {
        id: 'blk_form',
        type: 'capture_form',
        title: 'Instant Opt-In Form',
        content: 'Zero spam. Unsubscribe anytime in one click.',
      },
    ];
  }

  return [
    heroBlock,
    {
      id: 'blk_bullets',
      type: 'value_bullets',
      title: 'What You Will Unlock Inside',
      content: 'Designed for creators, consultants, and lean teams:',
      items: [
        'Direct Contact List routing with automatic segmentation tags on submission',
        'Instant multi-channel follow-up via Email, SMS, and Official WhatsApp API',
        'Full GDPR & double opt-in compliance built into every form',
      ],
    },
    {
      id: 'blk_form',
      type: 'capture_form',
      title: 'Complete Your Details Below',
      content: 'Your information is stored securely in our CRM.',
    },
    {
      id: 'blk_proof',
      type: 'social_proof',
      title: 'Trusted by 4,200+ High-Growth Operators',
      content:
        '“Our lead capture conversion jumped to 41.8% after switching to clean, fast-loading FlowPilot pages.”',
    },
  ];
}

export function inferToolFormatFromAsset(asset: CaptureAsset): LeadGenToolFormat {
  if (
    asset.toolFormat &&
    LEAD_GEN_TOOL_FORMATS.some((f) => f.id === (asset.toolFormat as LeadGenToolFormat))
  ) {
    return asset.toolFormat as LeadGenToolFormat;
  }
  const titleLower = asset.title.toLowerCase();
  const slugLower = asset.slug.toLowerCase();
  if (titleLower.includes('squeeze') || slugLower.includes('squeeze')) return 'squeeze_page';
  if (titleLower.includes('survey') || slugLower.includes('survey') || titleLower.includes('quiz'))
    return 'survey_form';
  if (titleLower.includes('contact') || slugLower.includes('contact') || titleLower.includes('inquiry'))
    return 'contact_form';
  if (titleLower.includes('bio') || slugLower.includes('bio') || slugLower.includes('links'))
    return 'link_in_bio';
  if (titleLower.includes('thank') || slugLower.includes('thank')) return 'thank_you_page';
  if (asset.assetType === 'lead_magnet_funnel') return 'lead_magnet';
  if (asset.assetType === 'popup_form') return 'popup_embedded';
  if (asset.assetType === 'inline_form') return 'opt_in_form';
  return 'landing_page';
}

export function buildDefaultExtendedMetadata(asset: CaptureAsset): LeadGenAssetExtendedMetadata {
  const format = inferToolFormatFromAsset(asset);
  const spec =
    LEAD_GEN_TOOL_FORMATS.find((f) => f.id === format) || LEAD_GEN_TOOL_FORMATS[0];

  return {
    assetIdOrSlug: asset.slug,
    toolFormat: format,
    blocks: buildDefaultBlocksForFormat(format, asset.headline, asset.subheadline),
    formFields: buildDefaultFormFieldsForFormat(format),
    submissionTags: [...spec.defaultTags, asset.slug.slice(0, 24)],
    linkedAutomationName: 'Auto-Match Destination List Workflows',
    redirectMode: asset.redirectUrl ? 'custom_url' : spec.defaultRedirectMode,
    redirectUrl: asset.redirectUrl || `https://flowpilot.app/p/${asset.slug}/thank-you`,
    thankYouMessage:
      'Thank you! Your submission has been saved to our list and your welcome sequence is on the way.',
    leadMagnetTitle: `${asset.title} — Resource Pack.pdf`,
    leadMagnetFileUrl: `https://flowpilot.app/assets/${asset.slug}-bundle.pdf`,
    leadMagnetFileType: 'PDF Guide',
    bioLinks: [
      {
        label: '📘 Free 2026 Growth & Automation Playbook',
        url: 'https://flowpilot.app/p/creator-playbook',
        tagOnClick: 'clicked-playbook',
      },
      {
        label: '📅 Book a 1-on-1 Discovery Strategy Call',
        url: 'https://flowpilot.app/p/strategy-call',
        tagOnClick: 'clicked-booking',
      },
      {
        label: '💬 Join Official WhatsApp VIP Channel',
        url: 'https://wa.me/18445550199',
        tagOnClick: 'clicked-whatsapp',
      },
    ],
    popupTrigger: asset.assetType === 'popup_form' ? 'exit_intent' : 'inline_embed',
    seoTitle: `${asset.title} | Official Resource & Signup`,
    seoDescription: asset.subheadline || spec.description,
    ogImageLabel: `${asset.title} — Social Share Card (1200×630)`,
    noIndex: false,
    customDomain: 'pages.flowpilotstudio.io',
  };
}
