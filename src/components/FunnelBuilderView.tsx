import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  X,
  CheckCircle2,
  Layers,
  GitBranch,
  Smartphone,
  Monitor,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Copy,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  Play,
  FileText,
} from 'lucide-react';
import {
  CaptureAsset,
  AudienceList,
  Contact,
  Automation,
  CurrencyCode,
  ListCategory,
  ActivityEventType,
  ActivityChannel,
  sanitizeString,
  sanitizeStringArray,
} from '../types';
import { resolveAutomationTargetList } from './AutomationEngineCatalog';
import {
  FUNNEL_STEP_TYPES,
  FunnelStepType,
  FunnelStepDefinition,
  FunnelSectionBlock,
  ConversionFunnel,
  INITIAL_CONVERSION_FUNNELS,
  buildDefaultBlocksForStep,
  computeFunnelAnalytics,
} from './FunnelCatalog';

interface FunnelBuilderViewProps {
  assets: CaptureAsset[];
  lists: AudienceList[];
  contacts: Contact[];
  automations: Automation[];
  currency?: CurrencyCode;
  onCreateAsset: (
    data: Omit<CaptureAsset, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onCreateContact: (
    data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateContact: (
    id: string,
    data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onCreateList?: (
    data: Omit<AudienceList, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onLogActivity?: (
    eventType: ActivityEventType,
    title: string,
    detail: string,
    channel: ActivityChannel
  ) => Promise<void>;
  onNavigateToLists?: () => void;
  onNavigateToAutomations?: () => void;
}

type FunnelWorkspaceTab = 'visual_builder' | 'analytics_dropoff' | 'funnels_directory';

export const FunnelBuilderView: React.FC<FunnelBuilderViewProps> = ({
  lists,
  contacts,
  automations,
  onCreateAsset,
  onCreateContact,
  onUpdateContact,
  onCreateList,
  onLogActivity,
}) => {
  const [funnels, setFunnels] = useState<ConversionFunnel[]>(() => {
    try {
      const saved = localStorage.getItem('fp_lead_funnels_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_CONVERSION_FUNNELS;
  });

  const persistFunnels = (updater: (prev: ConversionFunnel[]) => ConversionFunnel[]) => {
    setFunnels((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem('fp_lead_funnels_v2', JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  };

  const [activeFunnelId, setActiveFunnelId] = useState<string>(funnels[0]?.id || '');
  const activeFunnel = useMemo(
    () => funnels.find((f) => f.id === activeFunnelId) || funnels[0] || INITIAL_CONVERSION_FUNNELS[0],
    [funnels, activeFunnelId]
  );

  const [activeTab, setActiveTab] = useState<FunnelWorkspaceTab>('visual_builder');
  const [selectedStepId, setSelectedStepId] = useState<string>(
    activeFunnel?.steps[0]?.id || ''
  );

  const activeStep = useMemo(() => {
    if (!activeFunnel) return null;
    return (
      activeFunnel.steps.find((s) => s.id === selectedStepId) ||
      activeFunnel.steps[0] ||
      null
    );
  }, [activeFunnel, selectedStepId]);

  const activeStepIndex = useMemo(() => {
    if (!activeFunnel || !activeStep) return 0;
    return Math.max(
      activeFunnel.steps.findIndex((s) => s.id === activeStep.id),
      0
    );
  }, [activeFunnel, activeStep]);

  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>('desktop');
  const [inspectorTab, setInspectorTab] = useState<'step_copy' | 'blocks' | 'seo'>('step_copy');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);

  // Interactive Live Funnel Journey Simulator State
  const [simLeadName, setSimLeadName] = useState('Jordan Vance');
  const [simLeadEmail, setSimLeadEmail] = useState('jordan.vance@agencyflow.io');
  const [simLeadPhone, setSimLeadPhone] = useState('+15550194820');
  const [isSimulatingAction, setIsSimulatingAction] = useState(false);

  // Add Step Modal State
  const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);
  const [newStepType, setNewStepType] = useState<FunnelStepType>('thank_you_page');
  const [newStepName, setNewStepName] = useState('');

  // Create New Funnel Modal State
  const [isCreateFunnelModalOpen, setIsCreateFunnelModalOpen] = useState(false);
  const [newFunnelName, setNewFunnelName] = useState('');
  const [newFunnelList, setNewFunnelList] = useState(lists[0]?.name || 'General Contacts');
  const [showInlineListCreator, setShowInlineListCreator] = useState(false);
  const [inlineListName, setInlineListName] = useState('');

  // Merge available lists
  const allAvailableLists = useMemo(() => {
    const map = new Map<string, AudienceList>();
    lists.forEach((l) => {
      if (l.name?.trim()) map.set(l.name.trim().toLowerCase(), l);
    });
    contacts.forEach((c) => {
      const name = (c.listName || '').trim();
      if (name && !map.has(name.toLowerCase())) {
        map.set(name.toLowerCase(), {
          id: `virt_${name}`,
          workspaceId: c.workspaceId,
          ownerId: c.ownerId,
          name,
          description: `Contacts in ${name}`,
          category: 'custom',
          defaultConsent: 'opted_in',
          defaultTags: ['funnel-lead'],
          colorAccent: 'emerald',
        });
      }
    });
    return Array.from(map.values());
  }, [lists, contacts]);

  // Compute live funnel analytics for the active funnel
  const funnelAnalytics = useMemo(() => {
    if (!activeFunnel) return null;
    return computeFunnelAnalytics(activeFunnel);
  }, [activeFunnel]);

  // Update a specific step on the active funnel
  const updateActiveStep = (updater: (step: FunnelStepDefinition) => FunnelStepDefinition) => {
    if (!activeFunnel || !activeStep) return;
    persistFunnels((prev) =>
      prev.map((f) => {
        if (f.id !== activeFunnel.id) return f;
        return {
          ...f,
          updatedAt: 'Updated just now',
          steps: f.steps.map((s) => (s.id === activeStep.id ? updater(s) : s)),
        };
      })
    );
  };

  // Reorder steps in the active funnel
  const moveStepOrder = (index: number, direction: 'up' | 'down') => {
    if (!activeFunnel) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= activeFunnel.steps.length) return;
    persistFunnels((prev) =>
      prev.map((f) => {
        if (f.id !== activeFunnel.id) return f;
        const copy = [...f.steps];
        const [moved] = copy.splice(index, 1);
        copy.splice(targetIdx, 0, moved);
        return { ...f, updatedAt: 'Updated just now', steps: copy };
      })
    );
  };

  const handleStepDrop = (targetIndex: number) => {
    if (draggedStepIndex === null || draggedStepIndex === targetIndex || !activeFunnel) {
      setDraggedStepIndex(null);
      return;
    }
    persistFunnels((prev) =>
      prev.map((f) => {
        if (f.id !== activeFunnel.id) return f;
        const copy = [...f.steps];
        const [moved] = copy.splice(draggedStepIndex, 1);
        copy.splice(targetIndex, 0, moved);
        return { ...f, updatedAt: 'Updated just now', steps: copy };
      })
    );
    setDraggedStepIndex(null);
  };

  // Add a new step to the active funnel
  const handleAddStepToFunnel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFunnel) return;
    const meta = FUNNEL_STEP_TYPES.find((m) => m.type === newStepType) || FUNNEL_STEP_TYPES[0];
    const cleanName = sanitizeString(newStepName || meta.label, 80, meta.label);
    const stepSlug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);

    const createdStep: FunnelStepDefinition = {
      id: `step_${Date.now()}`,
      stepType: newStepType,
      name: cleanName,
      slug: stepSlug || newStepType.replace(/_/g, '-'),
      headline: meta.defaultHeadline,
      subheadline: meta.defaultSubheadline,
      ctaText: meta.defaultCta,
      tagsOnAction: [`funnel-${newStepType.replace(/_/g, '-')}`],
      seoTitle: `${cleanName} | ${activeFunnel.name}`,
      seoDescription: meta.defaultSubheadline,
      blocks: buildDefaultBlocksForStep(newStepType),
      visitors: 250,
      completions: 140,
    };

    persistFunnels((prev) =>
      prev.map((f) =>
        f.id === activeFunnel.id
          ? { ...f, updatedAt: 'Updated just now', steps: [...f.steps, createdStep] }
          : f
      )
    );
    setSelectedStepId(createdStep.id);
    setIsAddStepModalOpen(false);
    setNewStepName('');
    setStatusBanner(`Added "${cleanName}" (${meta.label}) to "${activeFunnel.name}".`);
  };

  // Delete a step from the funnel
  const handleDeleteStep = (stepId: string) => {
    if (!activeFunnel || activeFunnel.steps.length <= 1) return;
    const remaining = activeFunnel.steps.filter((s) => s.id !== stepId);
    persistFunnels((prev) =>
      prev.map((f) =>
        f.id === activeFunnel.id ? { ...f, updatedAt: 'Updated just now', steps: remaining } : f
      )
    );
    if (selectedStepId === stepId && remaining[0]) {
      setSelectedStepId(remaining[0].id);
    }
    setStatusBanner('Removed step from funnel.');
  };

  // Create a new multi-step lead conversion funnel
  const handleCreateFunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFunnelName.trim()) return;
    const cleanName = sanitizeString(newFunnelName, 90, 'New Lead Funnel');
    const cleanSlug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);

    const baseSteps: FunnelStepDefinition[] = [
      {
        id: `s_lp_${Date.now()}`,
        stepType: 'landing_page',
        name: '1. Landing Page',
        slug: `${cleanSlug}-landing`,
        headline: FUNNEL_STEP_TYPES[0].defaultHeadline,
        subheadline: FUNNEL_STEP_TYPES[0].defaultSubheadline,
        ctaText: FUNNEL_STEP_TYPES[0].defaultCta,
        tagsOnAction: ['funnel-landing-visitor'],
        seoTitle: `${cleanName} — Official Landing Page`,
        seoDescription: FUNNEL_STEP_TYPES[0].defaultSubheadline,
        blocks: buildDefaultBlocksForStep('landing_page'),
        visitors: 1200,
        completions: 780,
      },
      {
        id: `s_opt_${Date.now() + 1}`,
        stepType: 'opt_in_page',
        name: '2. Opt-In Page',
        slug: `${cleanSlug}-opt-in`,
        headline: FUNNEL_STEP_TYPES[1].defaultHeadline,
        subheadline: FUNNEL_STEP_TYPES[1].defaultSubheadline,
        ctaText: FUNNEL_STEP_TYPES[1].defaultCta,
        tagsOnAction: ['funnel-opt-in-lead'],
        seoTitle: `${cleanName} — Free Opt-In`,
        seoDescription: FUNNEL_STEP_TYPES[1].defaultSubheadline,
        blocks: buildDefaultBlocksForStep('opt_in_page'),
        visitors: 780,
        completions: 410,
      },
      {
        id: `s_ty_${Date.now() + 2}`,
        stepType: 'thank_you_page',
        name: '3. Thank-You Page',
        slug: `${cleanSlug}-thank-you`,
        headline: FUNNEL_STEP_TYPES[2].defaultHeadline,
        subheadline: FUNNEL_STEP_TYPES[2].defaultSubheadline,
        ctaText: FUNNEL_STEP_TYPES[2].defaultCta,
        tagsOnAction: ['funnel-thank-you'],
        seoTitle: `${cleanName} — Thank You`,
        seoDescription: FUNNEL_STEP_TYPES[2].defaultSubheadline,
        blocks: buildDefaultBlocksForStep('thank_you_page'),
        visitors: 410,
        completions: 280,
      },
      {
        id: `s_cnf_${Date.now() + 3}`,
        stepType: 'confirmation_page',
        name: '4. Confirmation Page',
        slug: `${cleanSlug}-confirmation`,
        headline: FUNNEL_STEP_TYPES[4].defaultHeadline,
        subheadline: FUNNEL_STEP_TYPES[4].defaultSubheadline,
        ctaText: FUNNEL_STEP_TYPES[4].defaultCta,
        tagsOnAction: ['funnel-completed'],
        seoTitle: `${cleanName} — Confirmed`,
        seoDescription: FUNNEL_STEP_TYPES[4].defaultSubheadline,
        blocks: buildDefaultBlocksForStep('confirmation_page'),
        visitors: 280,
        completions: 280,
      },
    ];

    const newFunnel: ConversionFunnel = {
      id: `funnel_${Date.now()}`,
      name: cleanName,
      slug: cleanSlug || 'custom-funnel',
      category: 'custom_funnel',
      description: `Multi-step conversion funnel routing leads into "${newFunnelList}".`,
      status: 'active',
      targetList: newFunnelList || 'General Contacts',
      customDomain: 'go.flowpilot.app',
      steps: baseSteps,
      updatedAt: 'Created just now',
    };

    persistFunnels((prev) => [newFunnel, ...prev]);
    setActiveFunnelId(newFunnel.id);
    setSelectedStepId(newFunnel.steps[0].id);
    setIsCreateFunnelModalOpen(false);
    setNewFunnelName('');
    setActiveTab('visual_builder');
    setStatusBanner(
      `Created "${cleanName}" with ${baseSteps.length} visual steps connected to list "${newFunnel.targetList}".`
    );
  };

  // Interactive Live Funnel Journey Simulation: Advances through the funnel & syncs leads to CRM!
  const handleSimulateStepAction = async () => {
    if (!activeFunnel || !activeStep || isSimulatingAction) return;
    setIsSimulatingAction(true);

    try {
      const steps = activeFunnel.steps;
      const currentIdx = steps.findIndex((s) => s.id === activeStep.id);
      const nextStep: FunnelStepDefinition | undefined = steps[currentIdx + 1];

      // If Opt-In Page: Create or update real Contact in CRM list
      if (activeStep.stepType === 'opt_in_page') {
        const existing = contacts.find(
          (c) => c.email.toLowerCase() === simLeadEmail.trim().toLowerCase()
        );
        const mergedTags = sanitizeStringArray(
          [
            ...(existing?.tags || []),
            ...activeStep.tagsOnAction,
            `funnel:${activeFunnel.slug}`,
          ],
          15,
          40
        );

        if (existing) {
          await onUpdateContact(existing.id, {
            fullName: simLeadName || existing.fullName,
            email: existing.email,
            phone: simLeadPhone || existing.phone,
            company: existing.company,
            dealTitle: existing.dealTitle,
            stage: existing.stage === 'customer' ? 'customer' : 'warm_lead',
            temperature: 'hot',
            source: `Funnel: ${activeFunnel.name}`,
            consentStatus: 'opted_in',
            commChannels: existing.commChannels || ['email', 'whatsapp'],
            listName: activeFunnel.targetList || existing.listName,
            tags: mergedTags,
            ltv: existing.ltv,
            notes: `${existing.notes}\n• Opted in via Funnel step "${activeStep.name}"`,
            customFields: existing.customFields,
          });
        } else {
          await onCreateContact({
            fullName: sanitizeString(simLeadName, 100, 'Funnel Lead'),
            email: sanitizeString(simLeadEmail, 160, 'lead@example.com'),
            phone: sanitizeString(simLeadPhone, 40, '+15550190000'),
            stage: 'warm_lead',
            temperature: 'hot',
            source: `Funnel: ${activeFunnel.name}`,
            consentStatus: 'opted_in',
            commChannels: ['email', 'whatsapp'],
            listName: activeFunnel.targetList || 'General Contacts',
            tags: mergedTags,
            ltv: 0,
            notes: `Captured on Opt-In Step "${activeStep.name}" in "${activeFunnel.name}".`,
          });
        }

        if (onLogActivity) {
          await onLogActivity(
            'form_captured',
            `Funnel Opt-In: ${simLeadName}`,
            `Captured on "${activeStep.name}" (${activeFunnel.name}) → Added to list "${activeFunnel.targetList}"`,
            'web'
          );
        }
      }

      // Update Funnel Step Visitors & Completions
      persistFunnels((prev) =>
        prev.map((f) => {
          if (f.id !== activeFunnel.id) return f;
          return {
            ...f,
            updatedAt: 'Updated just now',
            steps: f.steps.map((s) => {
              if (s.id === activeStep.id) {
                return {
                  ...s,
                  visitors: s.visitors + (currentIdx === 0 ? 1 : 0),
                  completions: s.completions + 1,
                };
              }
              if (nextStep && s.id === nextStep.id) {
                return {
                  ...s,
                  visitors: s.visitors + 1,
                  completions:
                    s.stepType === 'confirmation_page' ? s.completions + 1 : s.completions,
                };
              }
              return s;
            }),
          };
        })
      );

      if (nextStep) {
        setSelectedStepId(nextStep.id);
        setStatusBanner(
          `Completed "${activeStep.name}" → Advanced prospect to "${nextStep.name}".`
        );
      } else {
        setStatusBanner(`Completed final funnel step "${activeStep.name}"!`);
      }
    } finally {
      setIsSimulatingAction(false);
    }
  };

  // Sync the active funnel step to the Firestore `assets` collection so it appears in Pages & Forms too
  const handleSyncStepToAssets = async () => {
    if (!activeFunnel || !activeStep) return;
    const stepMeta =
      FUNNEL_STEP_TYPES.find((m) => m.type === activeStep.stepType) || FUNNEL_STEP_TYPES[0];
    await onCreateAsset({
      title: sanitizeString(`${activeFunnel.name} · ${activeStep.name}`, 120, activeStep.name),
      assetType: stepMeta.mapsToAssetType,
      slug: sanitizeString(activeStep.slug, 80, 'funnel-step'),
      headline: sanitizeString(activeStep.headline, 160, activeStep.name),
      subheadline: sanitizeString(activeStep.subheadline, 300, ''),
      ctaText: sanitizeString(activeStep.ctaText, 60, 'Continue'),
      targetList: sanitizeString(activeFunnel.targetList, 80, 'General Contacts'),
      requireDoubleOptIn: false,
      status: 'published',
      viewsCount: activeStep.visitors,
      submissionsCount: activeStep.completions,
    });
    setStatusBanner(
      `Published funnel step "${activeStep.name}" (/f/${activeFunnel.slug}/${activeStep.slug}) to Pages & Forms.`
    );
  };

  if (!activeFunnel || !funnelAnalytics) return null;

  const linkedAutomationsForFunnel = automations.filter(
    (a) =>
      resolveAutomationTargetList(a).toLowerCase() === activeFunnel.targetList.toLowerCase()
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Funnel Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
            <span>Multi-Step Lead Generation Funnel Builder</span>
            <span>·</span>
            <span className="font-mono">Visual Steps & Drop-Off Analytics</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight mt-1">
            Visual Funnel Builder & Step Analytics
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Visually build and connect <strong>Landing Pages</strong>, <strong>Opt-In Pages</strong>,{' '}
            <strong>Thank-You Pages</strong>, <strong>Bridge Walkthrough Pages</strong>, and{' '}
            <strong>Confirmation Pages</strong> with real-time step conversion and drop-off tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            value={activeFunnel.id}
            onChange={(e) => {
              const nextF = funnels.find((f) => f.id === e.target.value);
              setActiveFunnelId(e.target.value);
              if (nextF?.steps[0]) setSelectedStepId(nextF.steps[0].id);
            }}
            className="px-3.5 py-2.5 text-xs font-bold bg-white border border-slate-300 rounded-xl text-[#0F172A] cursor-pointer shadow-2xs"
          >
            {funnels.map((f) => (
              <option key={f.id} value={f.id}>
                Funnel: {f.name} ({f.steps.length} steps)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setIsAddStepModalOpen(true)}
            className="px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-700" />
            <span>Add Funnel Step</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateFunnelModalOpen(true)}
            className="px-4 py-2.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Funnel</span>
          </button>
        </div>
      </div>

      {/* Status Notice Banner */}
      {statusBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-950">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="font-bold text-emerald-800 hover:text-emerald-950 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =====================================================================
          FUNNEL ANALYTICS KPI STRIP (VISITORS, LEADS, CONVERSION RATE, COMPLETIONS, DROP-OFF BY STEP)
         ===================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>1. Visitors</span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-[#0F172A] mt-1 tabular-nums">
            {funnelAnalytics.topVisitors.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Unique entry visitors
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>2. Leads Captured</span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {funnelAnalytics.totalLeads.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
            List: {activeFunnel.targetList}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>3. Conversion Rate</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-[#0F172A] mt-1 tabular-nums">
            {funnelAnalytics.leadConversionRate}%
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
            Opt-In Lead Conversion Rate
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>4. Completed Funnel</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-[#0F172A] mt-1 tabular-nums">
            {funnelAnalytics.finalCompletions.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {funnelAnalytics.fullFunnelCompletionRate}% end-to-end completion
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>5. Drop-Off by Step</span>
            <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
          </div>
          {(() => {
            const highestDropStep = [...funnelAnalytics.stepRows]
              .filter((r) => r.step.stepType !== 'confirmation_page')
              .sort((a, b) => b.dropOffRate - a.dropOffRate)[0];
            return highestDropStep ? (
              <>
                <div className="font-mono text-xl sm:text-2xl font-bold text-amber-700 mt-1 tabular-nums">
                  {highestDropStep.dropOffRate}%
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Peak drop: {highestDropStep.stepMeta.label}
                </div>
              </>
            ) : (
              <div className="font-mono text-xl font-bold text-slate-900 mt-1">0%</div>
            );
          })()}
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            {
              id: 'visual_builder' as FunnelWorkspaceTab,
              label: 'Visual Funnel Flow & Page Builder',
              badge: `${activeFunnel.steps.length} Steps`,
            },
            {
              id: 'analytics_dropoff' as FunnelWorkspaceTab,
              label: 'Funnel Analytics & Drop-Off by Step',
              badge: 'Step Retention',
            },
            {
              id: 'funnels_directory' as FunnelWorkspaceTab,
              label: 'All Funnels & Blueprints',
              badge: String(funnels.length),
            },
          ].map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer ${
                  active
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded-md ${
                    active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {t.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Linked List & Automation Context Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <Layers className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span className="text-slate-600">Target List:</span>
          <select
            value={activeFunnel.targetList}
            onChange={(e) => {
              const nextList = e.target.value;
              persistFunnels((prev) =>
                prev.map((f) => (f.id === activeFunnel.id ? { ...f, targetList: nextList } : f))
              );
              setStatusBanner(`Linked funnel "${activeFunnel.name}" to list "${nextList}".`);
            }}
            className="font-bold text-slate-950 bg-transparent cursor-pointer"
          >
            {allAvailableLists.map((l) => (
              <option key={l.id} value={l.name}>
                {l.name}
              </option>
            ))}
          </select>
          <span className="text-slate-300">|</span>
          <GitBranch className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span className="text-slate-600">
            {linkedAutomationsForFunnel.length} active workflow(s)
          </span>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: VISUAL FUNNEL ARCHITECTURE, STEP PIPELINE & INTERACTIVE PAGE BUILDER
         ===================================================================== */}
      {activeTab === 'visual_builder' && activeStep && (
        <div className="space-y-5">
          {/* Horizontal Visual Funnel Step Flow Map with Live Conversion & Drop-Off Connectors */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Interactive Visual Funnel Map (Drag or Click Any Step to Edit)
                </span>
                <p className="text-xs text-slate-500">
                  Shows real-time step visitors, conversion rate, and step-to-step drop-off.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (activeFunnel.steps[0]) {
                      setSelectedStepId(activeFunnel.steps[0].id);
                      setStatusBanner(
                        'Reset live funnel journey simulator to Step 1 (Landing Page).'
                      );
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Step-by-Step Test From Step 1</span>
                </button>
              </div>
            </div>

            <div className="flex items-stretch gap-2 overflow-x-auto pb-2 pt-1">
              {funnelAnalytics.stepRows.map((row, idx) => {
                const isSelected = row.step.id === activeStep.id;
                const isLast = idx === funnelAnalytics.stepRows.length - 1;
                return (
                  <React.Fragment key={row.step.id}>
                    <div
                      draggable
                      onDragStart={() => setDraggedStepIndex(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleStepDrop(idx)}
                      onClick={() => setSelectedStepId(row.step.id)}
                      className={`min-w-[205px] max-w-[225px] p-3.5 rounded-xl border text-left transition-all cursor-pointer shrink-0 flex flex-col justify-between ${
                        isSelected
                          ? 'border-2 border-[#047857] bg-emerald-50/40 shadow-xs'
                          : 'border-slate-200 bg-[#F8FAFC] hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 text-[10px] font-bold uppercase tracking-wider">
                          <span className="text-emerald-800 truncate">
                            Step {idx + 1} · {row.stepMeta.label}
                          </span>
                          <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </div>
                        <div className="font-display text-xs font-bold text-slate-950 mt-1 truncate">
                          {row.step.name}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500 truncate mt-0.5">
                          /f/{activeFunnel.slug}/{row.step.slug}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-1 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Visitors:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {row.visitorsIn.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">
                            {row.step.stepType === 'opt_in_page' ? 'Leads:' : 'Advanced:'}
                          </span>
                          <span className="font-mono font-bold text-emerald-700">
                            {row.completionsOut.toLocaleString()} ({row.stepConversionRate}%)
                          </span>
                        </div>
                        {row.step.stepType !== 'confirmation_page' && (
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-500">Drop-Off:</span>
                            <span className="font-mono font-bold text-amber-700">
                              -{row.dropOffCount.toLocaleString()} ({row.dropOffRate}%)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {!isLast && (
                      <div className="flex flex-col items-center justify-center px-1 shrink-0 text-slate-400">
                        <ArrowRight className="w-4 h-4 text-emerald-600" />
                        <span className="font-mono text-[10px] font-bold text-slate-500 mt-0.5">
                          {row.stepConversionRate}%
                        </span>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* 3-Column Visual Step Editor & Interactive Page Canvas */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT COLUMN (3 cols): Step List & Ordering Controls */}
            <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Funnel Steps ({activeFunnel.steps.length})
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddStepModalOpen(true)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                >
                  + Add Step
                </button>
              </div>

              <div className="space-y-2">
                {activeFunnel.steps.map((st, idx) => {
                  const meta =
                    FUNNEL_STEP_TYPES.find((m) => m.type === st.stepType) || FUNNEL_STEP_TYPES[0];
                  const active = st.id === activeStep.id;
                  return (
                    <div
                      key={st.id}
                      onClick={() => setSelectedStepId(st.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        active
                          ? 'border-2 border-[#047857] bg-emerald-50/40'
                          : 'border-slate-200 bg-[#F8FAFC] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                          Step {idx + 1} · {meta.label}
                        </span>
                        <div
                          className="flex items-center gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => moveStepOrder(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                            title="Move Step Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveStepOrder(idx, 'down')}
                            disabled={idx === activeFunnel.steps.length - 1}
                            className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                            title="Move Step Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          {activeFunnel.steps.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteStep(st.id)}
                              className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                              title="Remove Step"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-slate-950 mt-0.5 truncate">
                        {st.name}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-2">
                <button
                  type="button"
                  onClick={handleSyncStepToAssets}
                  className="w-full py-2 px-3 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Sync Step to Pages & Forms</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = `https://${activeFunnel.customDomain}/f/${activeFunnel.slug}/${activeStep.slug}`;
                    navigator.clipboard?.writeText(url);
                    setStatusBanner(`Copied step public URL: ${url}`);
                  }}
                  className="w-full py-2 px-3 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Public Step URL</span>
                </button>
              </div>
            </div>

            {/* CENTER COLUMN (5 cols): Live Responsive Page Canvas & Interactive Funnel Simulator */}
            <div className="lg:col-span-5 space-y-3">
              <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-mono text-xs text-slate-700 truncate">
                    https://{activeFunnel.customDomain}/f/{activeFunnel.slug}/{activeStep.slug}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewportMode('desktop')}
                    className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                      viewportMode === 'desktop'
                        ? 'bg-[#0F172A] text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                    title="Desktop Preview"
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewportMode('mobile')}
                    className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                      viewportMode === 'mobile'
                        ? 'bg-[#0F172A] text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                    title="Mobile Preview"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Visual Step Page Preview Canvas */}
              <div
                className={`mx-auto bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all ${
                  viewportMode === 'mobile' ? 'max-w-[375px]' : 'w-full'
                }`}
              >
                {/* Step Progress Bar Header */}
                <div className="bg-[#0F172A] text-white px-5 py-3 flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-400 uppercase tracking-wider">
                    Step {activeStepIndex + 1} of {activeFunnel.steps.length} ·{' '}
                    {FUNNEL_STEP_TYPES.find((m) => m.type === activeStep.stepType)?.label}
                  </span>
                  <span className="font-mono text-[11px] text-slate-300">
                    {activeFunnel.name}
                  </span>
                </div>

                <div className="p-5 sm:p-6 space-y-5">
                  {/* Hero Headline & Subheadline */}
                  <div className="space-y-2 text-center border-b border-slate-100 pb-4">
                    <h2 className="font-display text-lg sm:text-xl font-bold text-[#0F172A] leading-snug">
                      {activeStep.headline}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {activeStep.subheadline}
                    </p>
                  </div>

                  {/* Step Section Blocks */}
                  <div className="space-y-3">
                    {activeStep.blocks.map((blk) => (
                      <div
                        key={blk.id}
                        className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/90 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          <span>{blk.blockType.replace(/_/g, ' ')}</span>
                          {blk.accentNote && (
                            <span className="text-slate-500">{blk.accentNote}</span>
                          )}
                        </div>
                        <div className="text-xs font-bold text-slate-900">{blk.title}</div>
                        <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                          {blk.content}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* STEP-SPECIFIC INTERACTIVE COMPONENTS */}
                  {activeStep.stepType === 'opt_in_page' && (
                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3 text-xs">
                      <div className="font-bold text-emerald-950">
                        Live Opt-In Form (Saves Lead to &ldquo;{activeFunnel.targetList}&rdquo;)
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={simLeadName}
                          onChange={(e) => setSimLeadName(e.target.value)}
                          placeholder="Full Name"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                        />
                        <input
                          type="email"
                          value={simLeadEmail}
                          onChange={(e) => setSimLeadEmail(e.target.value)}
                          placeholder="Email Address"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                        />
                        <input
                          type="tel"
                          value={simLeadPhone}
                          onChange={(e) => setSimLeadPhone(e.target.value)}
                          placeholder="WhatsApp / Mobile Number"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  {activeStep.stepType === 'confirmation_page' && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 text-xs">
                      <div className="flex items-center gap-2 font-bold text-emerald-950">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span>Funnel Journey Confirmed for {simLeadName}</span>
                      </div>
                      <p className="text-emerald-900">
                        Assigned to Contact List <strong>{activeFunnel.targetList}</strong> with tags{' '}
                        <span className="font-mono">
                          #{activeStep.tagsOnAction.join(' #')}
                        </span>
                        .
                      </p>
                    </div>
                  )}

                  {/* Primary Action CTA Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={isSimulatingAction}
                      onClick={handleSimulateStepAction}
                      className="w-full py-3 px-4 text-xs sm:text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      {activeStep.ctaText}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN (4 cols): Step Inspector (Copy, Blocks, Tags & SEO) */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Step Inspector · Step {activeStepIndex + 1}
                  </span>
                  <h3 className="font-display text-sm font-bold text-slate-950">
                    {activeStep.name}
                  </h3>
                </div>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  {activeStep.stepType.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Inspector Sub-Tabs */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                {[
                  { id: 'step_copy' as const, label: 'Copy & CTA' },
                  { id: 'blocks' as const, label: `Blocks (${activeStep.blocks.length})` },
                  { id: 'seo' as const, label: 'Tags & SEO' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setInspectorTab(tab.id)}
                    className={`py-1.5 px-2 rounded-lg transition-colors cursor-pointer truncate ${
                      inspectorTab === tab.id
                        ? 'bg-white text-slate-950 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* SUB-TAB 1: STEP COPY & CTA */}
              {inspectorTab === 'step_copy' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Step Name</label>
                    <input
                      type="text"
                      value={activeStep.name}
                      onChange={(e) =>
                        updateActiveStep((s) => ({ ...s, name: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-xl font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Funnel Step Type
                    </label>
                    <select
                      value={activeStep.stepType}
                      onChange={(e) => {
                        const nextType = e.target.value as FunnelStepType;
                        updateActiveStep((s) => ({
                          ...s,
                          stepType: nextType,
                          blocks: buildDefaultBlocksForStep(nextType),
                        }));
                      }}
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-xl font-bold"
                    >
                      {FUNNEL_STEP_TYPES.map((m) => (
                        <option key={m.type} value={m.type}>
                          {m.shortLabel} — {m.stageBadge}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Step URL Slug</label>
                    <input
                      type="text"
                      value={activeStep.slug}
                      onChange={(e) =>
                        updateActiveStep((s) => ({
                          ...s,
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
                        }))
                      }
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Headline</label>
                    <textarea
                      rows={2}
                      value={activeStep.headline}
                      onChange={(e) =>
                        updateActiveStep((s) => ({ ...s, headline: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Subheadline</label>
                    <textarea
                      rows={3}
                      value={activeStep.subheadline}
                      onChange={(e) =>
                        updateActiveStep((s) => ({ ...s, subheadline: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Primary CTA Button Text
                    </label>
                    <input
                      type="text"
                      value={activeStep.ctaText}
                      onChange={(e) =>
                        updateActiveStep((s) => ({ ...s, ctaText: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-xl font-bold text-emerald-800"
                    />
                  </div>

                  {/* Step Traffic & Conversion Counters */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-bold text-slate-800">
                      Step Traffic & Conversion Counters
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-500">Step Visitors</label>
                        <input
                          type="number"
                          min={0}
                          value={activeStep.visitors}
                          onChange={(e) =>
                            updateActiveStep((s) => ({
                              ...s,
                              visitors: Math.max(Number(e.target.value) || 0, 0),
                            }))
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500">
                          Step Completions
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={activeStep.completions}
                          onChange={(e) =>
                            updateActiveStep((s) => ({
                              ...s,
                              completions: Math.max(Number(e.target.value) || 0, 0),
                            }))
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 2: DRAG-AND-DROP SECTION BLOCKS */}
              {inspectorTab === 'blocks' && (
                <div className="space-y-3 text-xs">
                  <div className="space-y-2">
                    {activeStep.blocks.map((blk, bIdx) => (
                      <div
                        key={blk.id}
                        className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-emerald-700">
                            {blk.blockType.replace(/_/g, ' ')}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateActiveStep((s) => ({
                                ...s,
                                blocks: s.blocks.filter((b) => b.id !== blk.id),
                              }))
                            }
                            className="text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={blk.title}
                          onChange={(e) =>
                            updateActiveStep((s) => ({
                              ...s,
                              blocks: s.blocks.map((b, i) =>
                                i === bIdx ? { ...b, title: e.target.value } : b
                              ),
                            }))
                          }
                          className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-bold"
                        />
                        <textarea
                          rows={2}
                          value={blk.content}
                          onChange={(e) =>
                            updateActiveStep((s) => ({
                              ...s,
                              blocks: s.blocks.map((b, i) =>
                                i === bIdx ? { ...b, content: e.target.value } : b
                              ),
                            }))
                          }
                          className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const added: FunnelSectionBlock = {
                        id: `blk_${Date.now()}`,
                        blockType: 'value_stack',
                        title: 'New Value Stack / Proof Block',
                        content: 'Highlight key customer transformation, resource item, or FAQ answer.',
                      };
                      updateActiveStep((s) => ({ ...s, blocks: [...s.blocks, added] }));
                    }}
                    className="w-full py-2 px-3 font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl cursor-pointer"
                  >
                    + Add Section Block to Step
                  </button>
                </div>
              )}

              {/* SUB-TAB 3: CRM TAGS & SEO METADATA */}
              {inspectorTab === 'seo' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      CRM Tags Applied on Step Completion (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={activeStep.tagsOnAction.join(', ')}
                      onChange={(e) =>
                        updateActiveStep((s) => ({
                          ...s,
                          tagsOnAction: e.target.value
                            .split(',')
                            .map((t) => t.trim())
                            .filter(Boolean),
                        }))
                      }
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Step SEO Title (&lt;title&gt;)
                    </label>
                    <input
                      type="text"
                      value={activeStep.seoTitle}
                      onChange={(e) =>
                        updateActiveStep((s) => ({ ...s, seoTitle: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Step Meta Description
                    </label>
                    <textarea
                      rows={2}
                      value={activeStep.seoDescription}
                      onChange={(e) =>
                        updateActiveStep((s) => ({ ...s, seoDescription: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: FUNNEL ANALYTICS & STEP-BY-STEP DROP-OFF DIAGNOSTICS
         ===================================================================== */}
      {activeTab === 'analytics_dropoff' && (
        <div className="space-y-6">
          {/* Waterfall & Step Drop-Off Visual Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Step-by-Step Conversion & Drop-Off Waterfall
                </span>
                <h2 className="font-display text-lg sm:text-xl font-bold text-slate-950">
                  {activeFunnel.name} — Visitors, Leads, Conversion Rate & Drop-Off by Step
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 font-bold border border-emerald-200">
                  Opt-In Lead CVR: {funnelAnalytics.leadConversionRate}%
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold">
                  Full Completion: {funnelAnalytics.fullFunnelCompletionRate}%
                </span>
              </div>
            </div>

            {/* Visual Horizontal Retention & Drop-Off Bars */}
            <div className="space-y-4">
              {funnelAnalytics.stepRows.map((row) => {
                const pctOfTopVisitors =
                  funnelAnalytics.topVisitors > 0
                    ? Math.min(
                        Math.round((row.visitorsIn / funnelAnalytics.topVisitors) * 100),
                        100
                      )
                    : 0;
                const isHighFriction =
                  row.step.stepType !== 'confirmation_page' && row.dropOffRate >= 50;

                return (
                  <div
                    key={row.step.id}
                    className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-[#0F172A] text-white font-mono text-xs font-bold">
                          Step {row.index + 1}
                        </span>
                        <div>
                          <div className="font-display text-sm font-bold text-slate-950">
                            {row.step.name}{' '}
                            <span className="text-xs font-normal text-slate-500">
                              ({row.stepMeta.label})
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">
                            /f/{activeFunnel.slug}/{row.step.slug}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <div>
                          <span className="text-slate-500">Visitors In: </span>
                          <span className="font-mono font-bold text-slate-950">
                            {row.visitorsIn.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Advanced / Converted: </span>
                          <span className="font-mono font-bold text-emerald-700">
                            {row.completionsOut.toLocaleString()} ({row.stepConversionRate}%)
                          </span>
                        </div>
                        {row.step.stepType !== 'confirmation_page' && (
                          <div className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-mono font-bold">
                            Drop-Off: -{row.dropOffCount.toLocaleString()} ({row.dropOffRate}%)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dual Progress Bar: Visitors Retained vs Step Drop-Off */}
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${Math.max(row.stepConversionRate, 4)}%` }}
                        className="bg-[#047857] h-full transition-all"
                        title={`Step Conversion: ${row.stepConversionRate}%`}
                      />
                      {row.step.stepType !== 'confirmation_page' && row.dropOffRate > 0 && (
                        <div
                          style={{ width: `${row.dropOffRate}%` }}
                          className="bg-amber-400/80 h-full transition-all"
                          title={`Step Drop-Off: ${row.dropOffRate}%`}
                        />
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        Traffic Reach: <strong>{pctOfTopVisitors}%</strong> of top-of-funnel
                        visitors reached this step
                      </span>
                      {isHighFriction ? (
                        <span className="inline-flex items-center gap-1 text-amber-800 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>
                            High Drop-Off Step ({row.dropOffRate}%) — Test headline & CTA clarity
                          </span>
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">
                          Healthy step retention ({row.stepConversionRate}% advance rate)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Complete Tabular Step-by-Step Analytics Ledger */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-950">
                Funnel Step Attribution & Drop-Off Ledger
              </h3>
              <span className="text-xs text-slate-500">
                Real-time conversion breakdown across all {activeFunnel.steps.length} steps
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Step & Page Type</th>
                    <th className="py-3 px-4 text-right">Visitors</th>
                    <th className="py-3 px-4 text-right">Leads / Advances</th>
                    <th className="py-3 px-4 text-right">Conversion Rate</th>
                    <th className="py-3 px-4 text-right">Drop-Off Count</th>
                    <th className="py-3 px-4 text-right">Drop-Off %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {funnelAnalytics.stepRows.map((r) => (
                    <tr key={r.step.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-950">
                          {r.index + 1}. {r.step.name}
                        </div>
                        <div className="text-[11px] text-emerald-700 font-semibold">
                          {r.stepMeta.label}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {r.visitorsIn.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                        {r.completionsOut.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {r.stepConversionRate}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-amber-800">
                        {r.step.stepType === 'confirmation_page'
                          ? '0'
                          : `-${r.dropOffCount.toLocaleString()}`}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-700">
                        {r.step.stepType === 'confirmation_page' ? '0.0%' : `${r.dropOffRate}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: ALL FUNNELS DIRECTORY & MULTI-STEP BLUEPRINTS
         ===================================================================== */}
      {activeTab === 'funnels_directory' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {funnels.map((fn) => {
            const stats = computeFunnelAnalytics(fn);
            const isSelected = fn.id === activeFunnel.id;
            return (
              <div
                key={fn.id}
                className={`p-5 rounded-2xl bg-white border transition-all space-y-4 ${
                  isSelected
                    ? 'border-2 border-[#047857] shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      {fn.steps.length}-Step Lead Funnel · Target List: {fn.targetList}
                    </span>
                    <h3 className="font-display text-lg font-bold text-slate-950 mt-0.5">
                      {fn.name}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">{fn.description}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-mono text-[11px] font-bold shrink-0">
                    {fn.status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500">Visitors</div>
                    <div className="font-mono font-bold text-slate-950">
                      {stats.topVisitors.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">
                      Leads ({stats.leadConversionRate}%)
                    </div>
                    <div className="font-mono font-bold text-emerald-700">
                      {stats.totalLeads.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Completed</div>
                    <div className="font-mono font-bold text-slate-950">
                      {stats.finalCompletions.toLocaleString()} ({stats.fullFunnelCompletionRate}%)
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {fn.steps.map((s, idx) => (
                    <span
                      key={s.id}
                      className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px]"
                    >
                      {idx + 1}. {s.stepType.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">{fn.updatedAt}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFunnelId(fn.id);
                        if (fn.steps[0]) setSelectedStepId(fn.steps[0].id);
                        setActiveTab('analytics_dropoff');
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      View Step Drop-Off
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFunnelId(fn.id);
                        if (fn.steps[0]) setSelectedStepId(fn.steps[0].id);
                        setActiveTab('visual_builder');
                      }}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer"
                    >
                      Open Visual Builder →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =====================================================================
          MODAL 1: ADD STEP TO FUNNEL
         ===================================================================== */}
      {isAddStepModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Add Step to {activeFunnel.name}
                </span>
                <h3 className="font-display text-lg font-bold text-slate-950">
                  Choose Funnel Page Type
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStepModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStepToFunnel} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                {FUNNEL_STEP_TYPES.map((meta) => {
                  const active = newStepType === meta.type;
                  return (
                    <button
                      key={meta.type}
                      type="button"
                      onClick={() => {
                        setNewStepType(meta.type);
                        setNewStepName(meta.label);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'border-2 border-[#047857] bg-emerald-50/50 font-bold text-slate-950'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{meta.shortLabel}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{meta.stageBadge}</div>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Step Page Title *</label>
                <input
                  type="text"
                  required
                  value={newStepName}
                  onChange={(e) => setNewStepName(e.target.value)}
                  placeholder="e.g. Thank-You & Download Page"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddStepModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer"
                >
                  Add Step to Funnel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: CREATE NEW MULTI-STEP LEAD FUNNEL
         ===================================================================== */}
      {isCreateFunnelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Visual Funnel Architect
                </span>
                <h3 className="font-display text-lg font-bold text-slate-950">
                  Create Multi-Step Lead Generation Funnel
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateFunnelModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFunnel} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Funnel Name *</label>
                <input
                  type="text"
                  required
                  value={newFunnelName}
                  onChange={(e) => setNewFunnelName(e.target.value)}
                  placeholder="e.g. Creator Playbook Lead Funnel"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-emerald-950">
                    Destination Contact List for Captured Leads *
                  </label>
                  {onCreateList && (
                    <button
                      type="button"
                      onClick={() => setShowInlineListCreator((p) => !p)}
                      className="text-[11px] font-bold text-emerald-800 underline cursor-pointer"
                    >
                      {showInlineListCreator ? 'Cancel' : '+ New List'}
                    </button>
                  )}
                </div>

                {showInlineListCreator && onCreateList && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inlineListName}
                      onChange={(e) => setInlineListName(e.target.value)}
                      placeholder="New list name..."
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!inlineListName.trim()) return;
                        const clean = sanitizeString(inlineListName, 80, 'Funnel Leads');
                        await onCreateList({
                          name: clean,
                          description: 'Created inside Funnel Builder',
                          category: 'lead_magnet' as ListCategory,
                          defaultConsent: 'opted_in',
                          defaultTags: ['funnel-lead'],
                          colorAccent: 'emerald',
                        });
                        setNewFunnelList(clean);
                        setInlineListName('');
                        setShowInlineListCreator(false);
                      }}
                      className="px-3 py-1.5 font-bold text-white bg-emerald-700 rounded-lg cursor-pointer"
                    >
                      Save List
                    </button>
                  </div>
                )}

                <select
                  value={newFunnelList}
                  onChange={(e) => setNewFunnelList(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold"
                >
                  {allAvailableLists.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateFunnelModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer"
                >
                  Create Visual Funnel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
