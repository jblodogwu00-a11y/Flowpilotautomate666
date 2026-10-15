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
};
