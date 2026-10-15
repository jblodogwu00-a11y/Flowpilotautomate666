import React, { useState } from 'react';
import {
  X,
  Sun,
  Moon,
  Copy,
  Check,
  Code2,
  Palette,
  Type,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  FolderTree,
  Zap,
} from 'lucide-react';
import {
  ThemeMode,
  ENTERPRISE_DESIGN_SYSTEM,
  EXPORTABLE_TAILWIND_CONFIG_CODE,
  EXPORTABLE_GLOBAL_CSS_CODE,
  EXPORTABLE_THEME_OBJECT_CODE,
} from '../theme/designSystem';

interface DesignSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
  onToggleThemeMode: (mode: ThemeMode) => void;
}

type SpecTab = 'tokens_overview' | 'tailwind_config' | 'global_css' | 'theme_object' | 'project_structure';

export const DesignSystemModal: React.FC<DesignSystemModalProps> = ({
  isOpen,
  onClose,
  themeMode,
  onToggleThemeMode,
}) => {
  const [activeTab, setActiveTab] = useState<SpecTab>('tokens_overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full overflow-hidden shadow-2xl my-6">
        {/* Top Principal Architecture Header */}
        <div className="bg-[#090D16] text-white px-5 sm:px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-[#22D3EE]">
              <Zap className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Principal Frontend Architecture · Design System &amp; Theme Tokens</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-white tracking-tight">
              Enterprise &amp; Developer Trust UI Specification (60-30-10 Cobalt &amp; Slate)
            </h2>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Live Dynamic Light / Dark Mode Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-700">
              <button
                type="button"
                onClick={() => onToggleThemeMode('light')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  themeMode === 'light'
                    ? 'bg-[#2563EB] text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light (Off-White)</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleThemeMode('dark')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  themeMode === 'dark'
                    ? 'bg-[#3B82F6] text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark (Slate/Navy)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
              aria-label="Close Design System Modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs: Visual Spec vs Exportable Code Files */}
        <div className="px-5 sm:px-6 py-3 bg-[#F8FAFC] dark:bg-[#090D16] border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              {
                id: 'tokens_overview' as const,
                label: '1. Live Tokens & Status Spec',
                icon: Palette,
              },
              {
                id: 'tailwind_config' as const,
                label: '2. tailwind.config.js',
                icon: Code2,
              },
              {
                id: 'global_css' as const,
                label: '3. src/index.css (Variables)',
                icon: Type,
              },
              {
                id: 'theme_object' as const,
                label: '4. src/theme/designSystem.ts',
                icon: ShieldCheck,
              },
              {
                id: 'project_structure' as const,
                label: '5. Where to Drop in Project',
                icon: FolderTree,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#2563EB] text-white font-bold shadow-2xs'
                      : 'bg-white dark:bg-[#0F172A] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-blue-500'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <span className="text-[11px] font-mono text-slate-500">
            Active Mode: <strong className="text-[#2563EB] uppercase">{themeMode}</strong>
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {/* TAB 1: LIVE DESIGN TOKENS, TYPOGRAPHY & SEMANTIC STATUS SPEC */}
          {activeTab === 'tokens_overview' && (
            <div className="space-y-6">
              {/* SECTION 1: TYPOGRAPHY SYSTEM */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#2563EB] font-bold">
                      1. Typography Hierarchy
                    </span>
                    <h3 className="font-display text-base sm:text-lg font-bold text-slate-950">
                      Inter (Headings) + DM Sans (Body/Labels) + JetBrains Mono (Logs/Metrics)
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    Loaded in index.html &amp; src/index.css
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Heading Font Card */}
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-[#2563EB]/10 text-[#2563EB] font-mono text-[11px] font-bold">
                        --font-display
                      </span>
                      <span className="text-xs font-mono text-slate-500">Inter (600/700)</span>
                    </div>
                    <div className="font-display text-lg font-bold text-slate-950 tracking-tight">
                      {ENTERPRISE_DESIGN_SYSTEM.typography.heading.sampleText}
                    </div>
                    <p className="text-xs text-slate-600">
                      {ENTERPRISE_DESIGN_SYSTEM.typography.heading.role}
                    </p>
                  </div>

                  {/* Body & UI Label Font Card */}
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-[#06B6D4]/15 text-[#0891B2] font-mono text-[11px] font-bold">
                        --font-sans
                      </span>
                      <span className="text-xs font-mono text-slate-500">DM Sans (400/500/600)</span>
                    </div>
                    <div className="font-sans text-sm font-medium text-slate-900 leading-relaxed">
                      {ENTERPRISE_DESIGN_SYSTEM.typography.body.sampleText}
                    </div>
                    <p className="text-xs text-slate-600">
                      {ENTERPRISE_DESIGN_SYSTEM.typography.body.role}
                    </p>
                  </div>

                  {/* Monospace Code & Metrics Font Card */}
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 font-mono text-[11px] font-bold">
                        --font-mono
                      </span>
                      <span className="text-xs font-mono text-slate-500">JetBrains Mono</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#090D16] text-[#22D3EE] font-mono text-[11px] leading-relaxed overflow-x-auto">
                      {ENTERPRISE_DESIGN_SYSTEM.typography.mono.sampleText}
                    </div>
                    <p className="text-xs text-slate-600">
                      {ENTERPRISE_DESIGN_SYSTEM.typography.mono.role}
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 2: 60-30-10 COLOR PALETTE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#2563EB] font-bold">
                      2. Enterprise &amp; Developer Trust Color Palette (60-30-10 Rule)
                    </span>
                    <h3 className="font-display text-base sm:text-lg font-bold text-slate-950">
                      60% Slate/Off-White Base · 30% Structural Neutrals · 10% Cobalt Blue &amp; Cyan Accent
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* 60% Dominant Base */}
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-3">
                    <div>
                      <div className="font-display text-sm font-bold text-slate-950">
                        60% Dominant Base
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Anti-glare off-white for Light Mode; deep slate/navy for Dark Mode.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {(themeMode === 'dark'
                        ? ENTERPRISE_DESIGN_SYSTEM.palette60_30_10.dominantBase60.darkTokens
                        : ENTERPRISE_DESIGN_SYSTEM.palette60_30_10.dominantBase60.lightTokens
                      ).map((tk) => (
                        <div
                          key={tk.token}
                          className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-6 h-6 rounded-md border border-slate-300 shrink-0"
                              style={{ backgroundColor: tk.hex }}
                            />
                            <div>
                              <div className="font-mono text-xs font-bold text-slate-900">
                                {tk.token}
                              </div>
                              <div className="text-[11px] text-slate-500">{tk.usage}</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(tk.token, tk.hex)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 font-mono text-[11px] text-slate-800 cursor-pointer"
                          >
                            {copiedKey === tk.token ? 'Copied' : tk.hex}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 30% Structural Neutrals */}
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-3">
                    <div>
                      <div className="font-display text-sm font-bold text-slate-950">
                        30% Structural Neutrals
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        High-contrast ink text, soft 1px layout borders, and muted sub-text.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {(themeMode === 'dark'
                        ? ENTERPRISE_DESIGN_SYSTEM.palette60_30_10.structuralNeutrals30.darkTokens
                        : ENTERPRISE_DESIGN_SYSTEM.palette60_30_10.structuralNeutrals30.lightTokens
                      ).map((tk) => (
                        <div
                          key={tk.token}
                          className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-6 h-6 rounded-md border border-slate-300 shrink-0"
                              style={{ backgroundColor: tk.hex }}
                            />
                            <div>
                              <div className="font-mono text-xs font-bold text-slate-900">
                                {tk.token}
                              </div>
                              <div className="text-[11px] text-slate-500">{tk.usage}</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(tk.token, tk.hex)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 font-mono text-[11px] text-slate-800 cursor-pointer"
                          >
                            {copiedKey === tk.token ? 'Copied' : tk.hex}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 10% Action Accent: Cobalt Blue & Cyan */}
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-3">
                    <div>
                      <div className="font-display text-sm font-bold text-slate-950">
                        10% Action Accent (Cobalt &amp; Cyan)
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Active workflow nodes, primary triggers, and active toggle states.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {ENTERPRISE_DESIGN_SYSTEM.palette60_30_10.actionAccent10.tokens.map((tk) => {
                        const activeHex = themeMode === 'dark' ? tk.darkHex : tk.hex;
                        return (
                          <div
                            key={tk.token}
                            className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-6 h-6 rounded-md border border-slate-300 shrink-0"
                                style={{ backgroundColor: activeHex }}
                              />
                              <div>
                                <div className="font-mono text-xs font-bold text-slate-900">
                                  {tk.token}
                                </div>
                                <div className="text-[11px] text-slate-500">{tk.usage}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopy(tk.token, activeHex)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 font-mono text-[11px] text-slate-800 cursor-pointer"
                            >
                              {copiedKey === tk.token ? 'Copied' : activeHex}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: SEMANTIC STATUS MAPPING */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#2563EB] font-bold">
                      3. Semantic Status Mapping
                    </span>
                    <h3 className="font-display text-base sm:text-lg font-bold text-slate-950">
                      Emerald Green (Success) · Amber/Orange (Warning) · Vivid Ruby Red (Failure)
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {ENTERPRISE_DESIGN_SYSTEM.semanticStatuses.map((st) => {
                    const Icon =
                      st.id === 'success'
                        ? ShieldCheck
                        : st.id === 'warning'
                        ? AlertTriangle
                        : XCircle;
                    const pillClass =
                      st.id === 'success'
                        ? 'status-pill-success'
                        : st.id === 'warning'
                        ? 'status-pill-warning'
                        : 'status-pill-failure';
                    return (
                      <div
                        key={st.id}
                        className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${pillClass}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span>{st.label}</span>
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-600">
                              {themeMode === 'dark' ? st.darkHex : st.lightHex}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {st.roleDescription}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#090D16] text-slate-200 font-mono text-[11px] border border-slate-800">
                          {st.sampleLogPayload}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXPORTABLE tailwind.config.js */}
          {activeTab === 'tailwind_config' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-950">
                    tailwind.config.js — Complete Typography, 60-30-10 Palette &amp; Semantic Status Config
                  </h3>
                  <p className="text-xs text-slate-600">
                    Drop this file into the root of your project alongside <code className="font-mono">package.json</code>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('tailwind', EXPORTABLE_TAILWIND_CONFIG_CODE)}
                  className="px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'tailwind' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied tailwind.config.js!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy tailwind.config.js</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-[#090D16] text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                {EXPORTABLE_TAILWIND_CONFIG_CODE}
              </pre>
            </div>
          )}

          {/* TAB 3: EXPORTABLE src/index.css */}
          {activeTab === 'global_css' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-950">
                    src/index.css — Global CSS Variables (Light Anti-Glare &amp; Dark Slate/Navy)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Import once at the top of <code className="font-mono">src/main.tsx</code> or <code className="font-mono">app/layout.tsx</code>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('css', EXPORTABLE_GLOBAL_CSS_CODE)}
                  className="px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'css' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied src/index.css!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy src/index.css</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-[#090D16] text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                {EXPORTABLE_GLOBAL_CSS_CODE}
              </pre>
            </div>
          )}

          {/* TAB 4: EXPORTABLE src/theme/designSystem.ts */}
          {activeTab === 'theme_object' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-950">
                    src/theme/designSystem.ts — TypeScript Theme Object &amp; Semantic Node States
                  </h3>
                  <p className="text-xs text-slate-600">
                    Import into workflow nodes, status badges, and header theme toggles.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('ts_theme', EXPORTABLE_THEME_OBJECT_CODE)}
                  className="px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'ts_theme' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied designSystem.ts!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy designSystem.ts</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-[#090D16] text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                {EXPORTABLE_THEME_OBJECT_CODE}
              </pre>
            </div>
          )}

          {/* TAB 5: PROJECT STRUCTURE & INTEGRATION GUIDE */}
          {activeTab === 'project_structure' && (
            <div className="space-y-4 text-xs">
              <div>
                <h3 className="font-display text-base font-bold text-slate-950">
                  Where to Drop the Code in Your Project Structure
                </h3>
                <p className="text-slate-600 mt-0.5">
                  All four files below are already live and active in this project. Here is how they map to your repository:
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#090D16] text-slate-200 font-mono text-xs leading-relaxed border border-slate-800">
{`project-root/
├── index.html                      # 1. Loads Google Fonts: Inter, DM Sans & JetBrains Mono
├── tailwind.config.js              # 2. Maps font-display, font-sans, font-mono, 60-30-10 & status colors
└── src/
    ├── index.css                   # 3. Defines :root (Light Off-White) & html.dark (Slate/Navy) CSS variables
    ├── main.tsx                    # 4. Imports './index.css' once at application entry
    ├── theme/
    │   └── designSystem.ts         # 5. TypeScript theme object, semantic status tokens & dark-mode helper
    └── components/
        └── DesignSystemModal.tsx   # 6. Interactive token inspector & code exporter`}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-1.5">
                  <div className="font-display font-bold text-slate-950">
                    Step 1 · Load Fonts in <code className="font-mono text-[#2563EB]">index.html</code>
                  </div>
                  <p className="text-slate-600">
                    Place the Google Fonts <code className="font-mono">&lt;link&gt;</code> for{' '}
                    <strong>Inter</strong>, <strong>DM Sans</strong>, and{' '}
                    <strong>JetBrains Mono</strong> inside <code className="font-mono">&lt;head&gt;</code> so metrics and code logs align with zero layout shift.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-1.5">
                  <div className="font-display font-bold text-slate-950">
                    Step 2 · CSS Variables in <code className="font-mono text-[#2563EB]">src/index.css</code>
                  </div>
                  <p className="text-slate-600">
                    Define the 60% base (<code className="font-mono">--bg-canvas</code>), 30% neutrals (<code className="font-mono">--text-primary</code>, <code className="font-mono">--border-grid</code>), and 10% Cobalt/Cyan accents (<code className="font-mono">--accent-primary</code>) under <code className="font-mono">:root</code> and <code className="font-mono">html.dark</code>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
