export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'fp_ui_theme_mode';

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return 'light';
}

export function applyThemeModeToDocument(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}

export interface SemanticStatusToken {
  id: 'success' | 'warning' | 'failure';
  label: string;
  roleDescription: string;
  lightHex: string;
  darkHex: string;
  surfaceLight: string;
  surfaceDark: string;
  borderLight: string;
  borderDark: string;
  tailwindClasses: string;
  sampleLogPayload: string;
}

export const ENTERPRISE_DESIGN_SYSTEM = {
  archetype: 'Enterprise & Developer Trust Automation System',
  typography: {
    heading: {
      name: 'Inter',
      role: 'Primary UI & Headings (600/700 weight, -0.022em tracking)',
      cssVar: 'var(--font-display)',
      fontStack: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      sampleText: 'Autonomous Omnichannel Workflow Execution Engine',
    },
    body: {
      name: 'DM Sans',
      role: 'Body & UI Labels (Optimized for micro-copy, form controls, and dense tables)',
      cssVar: 'var(--font-sans)',
      fontStack: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      sampleText: 'Configure rate-limit thresholds, webhook retries, and list-level Kill Switch triggers with zero cognitive clutter.',
    },
    mono: {
      name: 'JetBrains Mono',
      role: 'Code blocks, JSON trees, execution logs, and tabular data metrics',
      cssVar: 'var(--font-mono)',
      fontStack: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      sampleText: '{"node_id":"act_wa_dispatch","latency_ms":142,"status":200,"credits_used":1}',
    },
  },
  palette60_30_10: {
    dominantBase60: {
      ratio: '60% Dominant Base',
      description: 'Deeply premium slate/navy dark tone for Dark Mode OR crisp, anti-glare off-white for Light Mode.',
      lightTokens: [
        { token: '--bg-canvas', hex: '#F8FAFC', usage: 'Primary anti-glare application background' },
        { token: '--bg-surface', hex: '#FFFFFF', usage: 'Elevated cards, inspector panels, and data tables' },
        { token: '--bg-elevated', hex: '#F1F5F9', usage: 'Nested wells, filter bars, and secondary containers' },
      ],
      darkTokens: [
        { token: '--bg-canvas', hex: '#090D16', usage: 'Deep obsidian navy canvas (zero eye strain)' },
        { token: '--bg-surface', hex: '#0F172A', usage: 'Elevated slate/navy cards and workflow drawers' },
        { token: '--bg-elevated', hex: '#1E293B', usage: 'Interactive node surfaces and nested code blocks' },
      ],
    },
    structuralNeutrals30: {
      ratio: '30% Structural Neutrals',
      description: 'High-contrast ink text, soft 1px borders for layout grids, and muted sub-text.',
      lightTokens: [
        { token: '--text-primary', hex: '#0F172A', usage: 'High-contrast primary ink headings & values' },
        { token: '--text-secondary', hex: '#334155', usage: 'Balanced body copy & table rows' },
        { token: '--text-muted', hex: '#64748B', usage: 'Muted sub-text, timestamps & field hints' },
        { token: '--border-grid', hex: '#E2E8F0', usage: 'Hairline structural grid & card borders' },
      ],
      darkTokens: [
        { token: '--text-primary', hex: '#F8FAFC', usage: 'Crisp alabaster primary ink on dark navy' },
        { token: '--text-secondary', hex: '#CBD5E1', usage: 'Readable secondary labels & descriptions' },
        { token: '--text-muted', hex: '#94A3B8', usage: 'Muted metadata, axis labels & inactive icons' },
        { token: '--border-grid', hex: '#1E293B', usage: 'Subtle slate structural grid dividers' },
      ],
    },
    actionAccent10: {
      ratio: '10% Action Accent (Cobalt Blue & Electric Cyan)',
      description: 'Sharp, professional vibrant Cobalt Blue and Cyan for active nodes, primary triggers, and active toggle states.',
      tokens: [
        { token: '--accent-primary', hex: '#2563EB', darkHex: '#3B82F6', usage: 'Primary CTA triggers, active tabs & focused inputs (Cobalt Blue)' },
        { token: '--accent-primary-hover', hex: '#1D4ED8', darkHex: '#2563EB', usage: 'High-intent button hover & pressed state' },
        { token: '--accent-cyan', hex: '#06B6D4', darkHex: '#22D3EE', usage: 'Active workflow nodes, live data connectors & webhook signals (Cyan)' },
      ],
    },
  },
  semanticStatuses: [
    {
      id: 'success',
      label: 'Success State · Emerald Green',
      roleDescription: 'Passing automated workflows, verified OAuth/API integrations, and 200 OK webhook deliveries.',
      lightHex: '#047857',
      darkHex: '#34D399',
      surfaceLight: '#ECFDF5',
      surfaceDark: 'rgba(16, 185, 129, 0.14)',
      borderLight: '#A7F3D0',
      borderDark: 'rgba(16, 185, 129, 0.35)',
      tailwindClasses: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30',
      sampleLogPayload: '[PASS] Workflow #wf_902 -> Gmail OAuth + WhatsApp Cloud API dispatched (142ms)',
    },
    {
      id: 'warning',
      label: 'Warning State · Amber / Orange',
      roleDescription: 'Minor exceptions, paused automation tasks, rate-limit backoff, or low API credit alerts.',
      lightHex: '#B45309',
      darkHex: '#FBBF24',
      surfaceLight: '#FFFBEB',
      surfaceDark: 'rgba(245, 158, 11, 0.14)',
      borderLight: '#FDE68A',
      borderDark: 'rgba(245, 158, 11, 0.35)',
      tailwindClasses: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30',
      sampleLogPayload: '[WARN] Node #wait_24h -> Paused in queue (Rate-limit window 85% utilized)',
    },
    {
      id: 'failure',
      label: 'Failure State · Vivid Ruby Red',
      roleDescription: 'Immediate visibility on broken workflow paths, Kill Switch halts, or webhook timeout errors.',
      lightHex: '#BE123C',
      darkHex: '#FB7185',
      surfaceLight: '#FFF1F2',
      surfaceDark: 'rgba(225, 29, 72, 0.16)',
      borderLight: '#FECDD3',
      borderDark: 'rgba(225, 29, 72, 0.40)',
      tailwindClasses: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/35',
      sampleLogPayload: '[ERR!] Node #webhook_bridge -> Connection timeout after 5000ms (HTTP 504)',
    },
  ] as SemanticStatusToken[],
};

/* ============================================================================
   EXPORTABLE PRODUCTION CODE CONFIGURATIONS FOR DEVELOPER HANDOFF
   ============================================================================ */

export const EXPORTABLE_TAILWIND_CONFIG_CODE = `// FILE: tailwind.config.js (Drop in project root alongside package.json)
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      /* 1. TYPOGRAPHY SYSTEM */
      fontFamily: {
        // Primary UI & Headings: Clean geometric sans-serif
        display: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        // Body & UI Labels: Optimized for micro-copy & dense layouts
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'sans-serif'],
        // Code blocks, JSON trees, logs & variables: Horizontal tabular alignment
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      /* 2. 60-30-10 ENTERPRISE & DEVELOPER TRUST COLOR PALETTE */
      colors: {
        // 60% Dominant Base (Dynamic Light Anti-Glare / Dark Slate-Navy)
        canvas: {
          DEFAULT: 'var(--bg-canvas)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
        },
        // 30% Structural Neutrals (High-Contrast Ink & Grid Borders)
        ink: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        grid: {
          subtle: 'var(--border-grid)',
          strong: 'var(--border-strong)',
        },
        // 10% Action Accent (Cobalt Blue & Electric Cyan)
        action: {
          cobalt: 'var(--accent-primary)',
          cobaltHover: 'var(--accent-primary-hover)',
          cobaltSoft: 'var(--accent-primary-soft)',
          cyan: 'var(--accent-cyan)',
          cyanSoft: 'var(--accent-cyan-soft)',
        },
        // 3. Semantic Status Mapping
        status: {
          success: {
            fg: 'var(--status-success-fg)',
            bg: 'var(--status-success-bg)',
            border: 'var(--status-success-border)',
            dot: '#10B981', // Emerald Green
          },
          warning: {
            fg: 'var(--status-warning-fg)',
            bg: 'var(--status-warning-bg)',
            border: 'var(--status-warning-border)',
            dot: '#F59E0B', // Amber / Orange
          },
          failure: {
            fg: 'var(--status-failure-fg)',
            bg: 'var(--status-failure-bg)',
            border: 'var(--status-failure-border)',
            dot: '#E11D48', // Vivid Ruby Red
          },
        },
      },
    },
  },
  plugins: [],
};`;

export const EXPORTABLE_GLOBAL_CSS_CODE = `/* FILE: src/index.css (Imported once at top of src/main.tsx or src/App.tsx) */
@import "tailwindcss";

@layer base {
  /* LIGHT MODE (60% Anti-Glare Off-White Base) */
  :root {
    --font-display: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-sans: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, monospace;

    /* 60% Dominant Base */
    --bg-canvas: #F8FAFC;
    --bg-surface: #FFFFFF;
    --bg-elevated: #F1F5F9;

    /* 30% Structural Neutrals */
    --text-primary: #0F172A;
    --text-secondary: #334155;
    --text-muted: #64748B;
    --border-grid: #E2E8F0;
    --border-strong: #CBD5E1;

    /* 10% Action Accent (Cobalt Blue & Cyan) */
    --accent-primary: #2563EB;
    --accent-primary-hover: #1D4ED8;
    --accent-primary-soft: rgba(37, 99, 235, 0.10);
    --accent-cyan: #06B6D4;
    --accent-cyan-soft: rgba(6, 182, 212, 0.12);

    /* Semantic Status Mapping */
    --status-success-fg: #047857;
    --status-success-bg: #ECFDF5;
    --status-success-border: #A7F3D0;

    --status-warning-fg: #B45309;
    --status-warning-bg: #FFFBEB;
    --status-warning-border: #FDE68A;

    --status-failure-fg: #BE123C;
    --status-failure-bg: #FFF1F2;
    --status-failure-border: #FECDD3;
  }

  /* DARK MODE (60% Deep Slate/Navy Base) */
  html.dark,
  html[data-theme="dark"] {
    color-scheme: dark;

    --bg-canvas: #090D16;
    --bg-surface: #0F172A;
    --bg-elevated: #1E293B;

    --text-primary: #F8FAFC;
    --text-secondary: #CBD5E1;
    --text-muted: #94A3B8;
    --border-grid: #1E293B;
    --border-strong: #334155;

    --accent-primary: #3B82F6;
    --accent-primary-hover: #2563EB;
    --accent-primary-soft: rgba(59, 130, 246, 0.16);
    --accent-cyan: #22D3EE;
    --accent-cyan-soft: rgba(34, 211, 238, 0.14);

    --status-success-fg: #34D399;
    --status-success-bg: rgba(16, 185, 129, 0.14);
    --status-success-border: rgba(16, 185, 129, 0.35);

    --status-warning-fg: #FBBF24;
    --status-warning-bg: rgba(245, 158, 11, 0.14);
    --status-warning-border: rgba(245, 158, 11, 0.35);

    --status-failure-fg: #FB7185;
    --status-failure-bg: rgba(225, 29, 72, 0.16);
    --status-failure-border: rgba(225, 29, 72, 0.40);
  }

  body {
    font-family: var(--font-sans);
    background-color: var(--bg-canvas);
    color: var(--text-primary);
    line-height: 1.55;
  }

  h1, h2, h3, h4, .font-display {
    font-family: var(--font-display);
    letter-spacing: -0.022em;
    line-height: 1.22;
  }

  code, pre, .font-mono, .tabular-nums {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
}`;

export const EXPORTABLE_THEME_OBJECT_CODE = `// FILE: src/theme/designSystem.ts (Import into React components & workflow nodes)
export type WorkflowStatusState = 'success' | 'warning' | 'failure' | 'active_node';

export const AUTOMATION_STATUS_STYLES: Record<WorkflowStatusState, {
  badgeClass: string;
  dotColor: string;
  borderClass: string;
  label: string;
}> = {
  // Active Node / Primary Trigger (10% Action Accent: Cobalt Blue / Cyan)
  active_node: {
    badgeClass: 'bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/30',
    dotColor: '#2563EB',
    borderClass: 'border-blue-600 dark:border-blue-400 ring-2 ring-blue-500/20',
    label: 'ACTIVE TRIGGER',
  },
  // Success State: Emerald Green (Passing workflows & green-lit integrations)
  success: {
    badgeClass: 'status-pill-success',
    dotColor: '#10B981',
    borderClass: 'border-emerald-500/40',
    label: 'PASSING · 200 OK',
  },
  // Warning State: Amber/Orange (Paused tasks, rate limits, low API credits)
  warning: {
    badgeClass: 'status-pill-warning',
    dotColor: '#F59E0B',
    borderClass: 'border-amber-500/40',
    label: 'WARNING · PAUSED',
  },
  // Failure State: Vivid Ruby Red (Broken paths, Kill Switch halt, timeouts)
  failure: {
    badgeClass: 'status-pill-failure',
    dotColor: '#E11D48',
    borderClass: 'border-rose-500/50',
    label: 'FAILURE · TIMEOUT',
  },
};`;
