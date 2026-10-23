import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  ExternalLink,
  Trash2,
  X,
  CheckCircle2,
  FileText,
  Layers,
  GitBranch,
  FolderPlus,
  Smartphone,
  Monitor,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Globe,
  Code,
  Copy,
  Sparkles,
  Search,
  Download,
  Sliders,
  Link2,
  ShieldCheck,
  Edit3,
  Share2,
  Check,
  Clock,
  Play,
  HelpCircle,
  Palette,
  RotateCcw,
} from 'lucide-react';
import {
  CaptureAsset,
  CaptureAssetType,
  AudienceList,
  Contact,
  Automation,
  ListCategory,
  sanitizeString,
  sanitizeStringArray,
} from '../types';
import { resolveAutomationTargetList } from './AutomationEngineCatalog';
import {
  LEAD_GEN_TOOL_FORMATS,
  LeadGenToolFormat,
  LeadGenAssetExtendedMetadata,
  LeadGenFormField,
  FormFieldInputType,
  CanvasBlockItem,
  CanvasBlockType,
  PageVisualTheme,
  ELEMENT_PALETTE_CATALOG,
  READY_MADE_PAGE_TEMPLATES,
  ReadyMadePageTemplate,
  createDefaultElementBlock,
  INITIAL_CUSTOM_DOMAINS,
  CustomDomainConfig,
  buildDefaultExtendedMetadata,
  buildDefaultBlocksForFormat,
  buildDefaultFormFieldsForFormat,
  inferToolFormatFromAsset,
} from './LeadGenCatalog';
import templateStudioImg from '../assets/images/classic_template_studio_1791674890822.jpg';
import classicHeroImg from '../assets/images/classic_architectural_hero_1791674859192.jpg';

export interface AssetLeadSubmissionExtra {
  customTags?: string[];
  customFields?: string[];
  company?: string;
  notes?: string;
  automationIdToTrigger?: string;
}

interface CaptureAssetsViewProps {
  assets: CaptureAsset[];
  lists?: AudienceList[];
  contacts?: Contact[];
  automations?: Automation[];
  preselectedListName?: string | null;
  onClearPreselectedList?: () => void;
  openModalMode?: 'landing_page' | 'inline_form' | null;
  onClearModalMode?: () => void;
  onCreateAsset: (
    data: Omit<CaptureAsset, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateAsset?: (
    id: string,
    data: Omit<CaptureAsset, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onDeleteAsset: (id: string) => Promise<void>;
  onSubmitAssetLead: (
    asset: CaptureAsset,
    lead: { fullName: string; email: string; phone: string },
    extra?: AssetLeadSubmissionExtra
  ) => Promise<void>;
  onCreateList?: (
    data: Omit<AudienceList, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onNavigateToLists?: () => void;
  onCreateAutomationForList?: (listName: string) => void;
}

type StudioSubTab = 'gallery' | 'visual_builder' | 'embed_popups' | 'custom_domains';

export const CaptureAssetsView: React.FC<CaptureAssetsViewProps> = ({
  assets,
  lists = [],
  contacts = [],
  automations = [],
  preselectedListName,
  onClearPreselectedList,
  openModalMode,
  onClearModalMode,
  onCreateAsset,
  onUpdateAsset,
  onDeleteAsset,
  onSubmitAssetLead,
  onCreateList,
  onNavigateToLists,
  onCreateAutomationForList,
}) => {
  const [activeStudioTab, setActiveStudioTab] = useState<StudioSubTab>('gallery');
  const [formatFilter, setFormatFilter] = useState<'all' | LeadGenToolFormat>('all');
  const [listFilter, setListFilter] = useState<string>('all');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Extended No-Code Metadata Map keyed by asset.slug (persisted in localStorage for instant rich studio state)
  const [extendedMap, setExtendedMap] = useState<Record<string, LeadGenAssetExtendedMetadata>>(() => {
    try {
      const saved = localStorage.getItem('fp_leadgen_extended_v1');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore storage errors
    }
    return {};
  });

  const publishFormAssetToServer = (asset: CaptureAsset, meta?: LeadGenAssetExtendedMetadata) => {
    try {
      const ext = meta || getExtendedForAsset(asset);
      fetch('/api/forms/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: {
            ...asset,
            headline: asset.headline || asset.title,
            subheadline: asset.subheadline,
            ctaText: asset.ctaText,
            redirectUrl: asset.redirectUrl,
            toolFormat: asset.toolFormat || ext.toolFormat,
            targetList: asset.targetList,
          },
          extendedMeta: ext,
        }),
      }).catch(() => {});
    } catch {
      // non-fatal
    }
  };

  // Synchronize all assets to server public forms store so incognito links display exact custom copy
  useEffect(() => {
    if (assets.length > 0) {
      assets.forEach((a) => {
        publishFormAssetToServer(a);
      });
    }
  }, [assets]);

  const saveExtendedMeta = (slug: string, meta: LeadGenAssetExtendedMetadata) => {
    setExtendedMap((prev) => {
      const next = { ...prev, [slug]: meta };
      try {
        localStorage.setItem('fp_leadgen_extended_v1', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const getExtendedForAsset = (asset: CaptureAsset): LeadGenAssetExtendedMetadata => {
    const base = extendedMap[asset.slug] || buildDefaultExtendedMetadata(asset);
    return {
      ...base,
      toolFormat:
        (asset.toolFormat as LeadGenToolFormat) || base.toolFormat || inferToolFormatFromAsset(asset),
      redirectUrl:
        asset.redirectUrl || base.redirectUrl || `https://flowpilot.app/p/${asset.slug}/thank-you`,
    };
  };

  const getShareablePublicUrl = (slugVal: string): string => {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://flowpilot.app';
    return `${origin}/?capture=${encodeURIComponent(slugVal)}`;
  };

  // Merge explicit user-created lists with any listName referenced on contacts
  const allAvailableLists = useMemo(() => {
    const map = new Map<string, AudienceList>();
    lists.forEach((l) => {
      if (l.name && l.name.trim()) {
        map.set(l.name.trim().toLowerCase(), l);
      }
    });
    contacts.forEach((c) => {
      const name = (c.listName || '').trim();
      if (name && !map.has(name.toLowerCase())) {
        map.set(name.toLowerCase(), {
          id: `virtual_${name}`,
          workspaceId: c.workspaceId,
          ownerId: c.ownerId,
          name,
          description: `Contacts stored in "${name}"`,
          category: 'custom',
          defaultConsent: 'opted_in',
          defaultTags: ['segmented'],
          colorAccent: 'emerald',
        });
      }
    });
    return Array.from(map.values());
  }, [lists, contacts]);

  // Selected Asset for the Drag-and-Drop Visual Editor & Preview
  const defaultDraftAsset: CaptureAsset = useMemo(
    () => ({
      id: 'draft_starter_asset',
      workspaceId: 'ws_starter',
      ownerId: 'owner_starter',
      title: 'Sovereign Creator Academy & Offer Page (Starter Canvas)',
      assetType: 'landing_page',
      slug: 'sovereign-starter-canvas',
      headline: 'Master the Architecture of High-Converting Digital Offers & Automated Funnels',
      subheadline:
        'Customize every block on this page or create a new page from scratch or ready-made template.',
      ctaText: 'Unlock Instant Access →',
      redirectUrl: 'https://flowpilot.app/thank-you',
      toolFormat: 'landing_page',
      targetList: allAvailableLists[0]?.name || 'General Contacts',
      requireDoubleOptIn: false,
      status: 'published',
      viewsCount: 0,
      submissionsCount: 0,
    }),
    [allAvailableLists]
  );

  const [selectedAssetId, setSelectedAssetId] = useState<string>(assets[0]?.id || 'draft_starter_asset');
  const activeBuilderAsset = useMemo(
    () => assets.find((a) => a.id === selectedAssetId) || assets[0] || defaultDraftAsset,
    [assets, selectedAssetId, defaultDraftAsset]
  );

  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>('desktop');
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [builderInspectorTab, setBuilderInspectorTab] = useState<
    'blocks' | 'fields' | 'routing_tags' | 'seo_url'
  >('blocks');

  // Custom field creation state inside Visual Builder
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FormFieldInputType>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Custom Domains State
  const [customDomains, setCustomDomains] = useState<CustomDomainConfig[]>(INITIAL_CUSTOM_DOMAINS);
  const [newDomainInput, setNewDomainInput] = useState('');
  const [newDomainSlug, setNewDomainSlug] = useState(assets[0]?.slug || 'creator-playbook');

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(Boolean(openModalMode));
  const [editingAsset, setEditingAsset] = useState<CaptureAsset | null>(null);
  const [justPublishedAsset, setJustPublishedAsset] = useState<CaptureAsset | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedToolFormat, setSelectedToolFormat] = useState<LeadGenToolFormat>(
    openModalMode === 'inline_form' ? 'opt_in_form' : 'landing_page'
  );
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [headline, setHeadline] = useState('');
  const [subheadline, setSubheadline] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [targetList, setTargetList] = useState<string>(
    preselectedListName || allAvailableLists[0]?.name || ''
  );
  const [modalTagsInput, setModalTagsInput] = useState('website-lead, opt-in');
  const [modalRedirectMode, setModalRedirectMode] = useState<
    'inline_thank_you' | 'custom_url' | 'thank_you_page' | 'lead_magnet_download'
  >('custom_url');
  const [modalRedirectUrl, setModalRedirectUrl] = useState('https://flowpilot.app/thank-you');
  const [modalSeoTitle, setModalSeoTitle] = useState('');
  const [modalSeoDesc, setModalSeoDesc] = useState('');
  const [requireDoubleOptIn, setRequireDoubleOptIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Build-From-Scratch vs Ready-Made Template Mode State
  const [modalBuildMode, setModalBuildMode] = useState<'scratch' | 'template'>('scratch');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('course_affiliate_sales');
  const [modalVisualTheme, setModalVisualTheme] = useState<PageVisualTheme>('classic_ivory');
  const [scratchSelectedElements, setScratchSelectedElements] = useState<CanvasBlockType[]>([
    'hero_header',
    'video_embed',
    'pricing_tiers',
    'countdown_timer',
    'faq_section',
    'capture_form',
  ]);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [openFaqIndices, setOpenFaqIndices] = useState<Record<string, number>>({});
  const [studioBannerImgError, setStudioBannerImgError] = useState(false);

  // Inline Quick-Create List state inside Modal
  const [showInlineListCreator, setShowInlineListCreator] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListCategory, setNewListCategory] = useState<ListCategory>('lead_magnet');
  const [isCreatingInlineList, setIsCreatingInlineList] = useState(false);

  // Live Shareable URL & Interactive Test Capture Modal
  const [previewAsset, setPreviewAsset] = useState<CaptureAsset | null>(null);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [testName, setTestName] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testCompany, setTestCompany] = useState('');
  const [testCustomValues, setTestCustomValues] = useState<Record<string, string>>({});
  const [testSuccess, setTestSuccess] = useState(false);
  const [lastCapturedLeadName, setLastCapturedLeadName] = useState('');

  useEffect(() => {
    if (preselectedListName) {
      setTargetList(preselectedListName);
      setIsModalOpen(true);
      onClearPreselectedList?.();
    } else if (!targetList && allAvailableLists.length > 0) {
      setTargetList(allAvailableLists[0].name);
    }
  }, [preselectedListName, allAvailableLists]);

  useEffect(() => {
    if (openModalMode) {
      const fmt: LeadGenToolFormat =
        openModalMode === 'inline_form' ? 'opt_in_form' : 'landing_page';
      handleSelectModalToolFormat(fmt);
      if (!targetList && allAvailableLists.length > 0) {
        setTargetList(allAvailableLists[0].name);
      }
      setIsModalOpen(true);
      onClearModalMode?.();
    }
  }, [openModalMode, allAvailableLists]);

  const handleSelectModalToolFormat = (fmt: LeadGenToolFormat) => {
    setSelectedToolFormat(fmt);
    const spec = LEAD_GEN_TOOL_FORMATS.find((f) => f.id === fmt) || LEAD_GEN_TOOL_FORMATS[0];
    if (!editingAsset) {
      setHeadline(spec.defaultHeadline);
      setSubheadline(spec.defaultSubheadline);
      setCtaText(spec.defaultCta);
      setModalTagsInput(spec.defaultTags.join(', '));
      setModalRedirectMode(spec.defaultRedirectMode);
      if (!modalRedirectUrl.trim()) {
        setModalRedirectUrl('https://flowpilot.app/thank-you');
      }
    }
  };

  const handleOpenCreateModal = (
    fmt: LeadGenToolFormat = 'landing_page',
    mode: 'scratch' | 'template' = 'scratch',
    presetTemplateId?: string
  ) => {
    setEditingAsset(null);
    setModalBuildMode(mode);
    if (mode === 'template') {
      const tpl =
        READY_MADE_PAGE_TEMPLATES.find((t) => t.id === (presetTemplateId || selectedTemplateId)) ||
        READY_MADE_PAGE_TEMPLATES[0];
      setSelectedTemplateId(tpl.id);
      setSelectedToolFormat(tpl.toolFormat);
      setModalVisualTheme(tpl.visualTheme);
      setTitle(tpl.defaultTitle);
      setSlug(tpl.defaultSlug);
      setHeadline(tpl.defaultHeadline);
      setSubheadline(tpl.defaultSubheadline);
      setCtaText(tpl.defaultCtaText);
      setModalTagsInput(tpl.defaultTags.join(', '));
      setModalRedirectMode(tpl.defaultRedirectMode);
      setModalRedirectUrl(tpl.defaultRedirectUrl);
      setModalSeoTitle(`${tpl.defaultTitle} | Official Page`);
      setModalSeoDesc(tpl.defaultSubheadline);
    } else {
      const spec = LEAD_GEN_TOOL_FORMATS.find((f) => f.id === fmt) || LEAD_GEN_TOOL_FORMATS[0];
      setSelectedToolFormat(fmt);
      setModalVisualTheme('classic_ivory');
      setTitle('');
      setSlug('');
      setHeadline(spec.defaultHeadline);
      setSubheadline(spec.defaultSubheadline);
      setCtaText(spec.defaultCta);
      setModalTagsInput(spec.defaultTags.join(', '));
      setModalRedirectMode(spec.defaultRedirectMode);
      setModalRedirectUrl('https://flowpilot.app/thank-you');
      setModalSeoTitle('');
      setModalSeoDesc('');
    }
    setRequireDoubleOptIn(false);
    if (!targetList && allAvailableLists.length > 0) {
      setTargetList(allAvailableLists[0].name);
    }
    setIsModalOpen(true);
  };

  const handleSelectReadyMadeTemplateInModal = (tpl: ReadyMadePageTemplate) => {
    setModalBuildMode('template');
    setSelectedTemplateId(tpl.id);
    setSelectedToolFormat(tpl.toolFormat);
    setModalVisualTheme(tpl.visualTheme);
    setTitle(tpl.defaultTitle);
    setSlug(tpl.defaultSlug);
    setHeadline(tpl.defaultHeadline);
    setSubheadline(tpl.defaultSubheadline);
    setCtaText(tpl.defaultCtaText);
    setModalTagsInput(tpl.defaultTags.join(', '));
    setModalRedirectMode(tpl.defaultRedirectMode);
    setModalRedirectUrl(tpl.defaultRedirectUrl);
    setModalSeoTitle(`${tpl.defaultTitle} | Official Page`);
    setModalSeoDesc(tpl.defaultSubheadline);
  };

  const builderStartMode = modalBuildMode === 'scratch' ? 'from_scratch' : 'ready_template';
  const setBuilderStartMode = (mode: 'from_scratch' | 'ready_template') => {
    setModalBuildMode(mode === 'from_scratch' ? 'scratch' : 'template');
  };
  const selectedReadyTemplateId = selectedTemplateId;
  const handleSelectModalReadyTemplate = (tpl: ReadyMadePageTemplate) => {
    handleSelectReadyMadeTemplateInModal(tpl);
  };

  const handleUpdateBlockField = (
    asset: CaptureAsset,
    blockId: string,
    patch: Partial<CanvasBlockItem>
  ) => {
    const meta = getExtendedForAsset(asset);
    saveExtendedMeta(asset.slug, {
      ...meta,
      blocks: meta.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
    });
  };

  const handleLoadTemplateIntoActiveBuilder = async (tpl: ReadyMadePageTemplate) => {
    if (!activeBuilderAsset) {
      handleOpenCreateModal(tpl.toolFormat, 'template', tpl.id);
      return;
    }
    const currentMeta = getExtendedForAsset(activeBuilderAsset);
    const clonedBlocks: CanvasBlockItem[] = tpl.blocks.map((b, idx) => ({
      ...b,
      id: `${b.id}_${Date.now()}_${idx}`,
      items: b.items ? [...b.items] : undefined,
      faqItems: b.faqItems ? b.faqItems.map((fq) => ({ ...fq })) : undefined,
    }));
    const clonedFields: LeadGenFormField[] = tpl.formFields.map((f, idx) => ({
      ...f,
      id: `${f.id}_${Date.now()}_${idx}`,
      options: f.options ? [...f.options] : undefined,
    }));

    const nextMeta: LeadGenAssetExtendedMetadata = {
      ...currentMeta,
      toolFormat: tpl.toolFormat,
      visualTheme: tpl.visualTheme,
      templateId: tpl.id,
      blocks: clonedBlocks,
      formFields: clonedFields,
      submissionTags: [...tpl.defaultTags],
      redirectMode: tpl.defaultRedirectMode,
      redirectUrl: tpl.defaultRedirectUrl,
      seoTitle: `${tpl.defaultTitle} | Official Page`,
      seoDescription: tpl.defaultSubheadline,
    };
    saveExtendedMeta(activeBuilderAsset.slug, nextMeta);

    if (onUpdateAsset) {
      await onUpdateAsset(activeBuilderAsset.id, {
        title: activeBuilderAsset.title,
        assetType: activeBuilderAsset.assetType,
        slug: activeBuilderAsset.slug,
        headline: tpl.defaultHeadline,
        subheadline: tpl.defaultSubheadline,
        ctaText: tpl.defaultCtaText,
        redirectUrl: tpl.defaultRedirectUrl,
        toolFormat: tpl.toolFormat,
        targetList: activeBuilderAsset.targetList,
        requireDoubleOptIn: activeBuilderAsset.requireDoubleOptIn,
        status: activeBuilderAsset.status,
        viewsCount: activeBuilderAsset.viewsCount,
        submissionsCount: activeBuilderAsset.submissionsCount,
      });
    }

    setExpandedBlockId(clonedBlocks[0]?.id || null);
    setActiveStudioTab('visual_builder');
    setStatusBanner(
      `Loaded ready-made "${tpl.name}" template into "${activeBuilderAsset.title}" — customize every block, video, price, timer, FAQ & form field below!`
    );
  };

  const handleResetActiveCanvasToScratch = () => {
    if (!activeBuilderAsset) return;
    const currentMeta = getExtendedForAsset(activeBuilderAsset);
    const heroStarter = createDefaultElementBlock('hero_header');
    heroStarter.title = activeBuilderAsset.headline || 'Build Your Custom Page From Total Scratch';
    heroStarter.content =
      activeBuilderAsset.subheadline ||
      'Use the Element Palette on the left to add Video, Pricing, Countdown Timer, FAQ, Value Bullets, and Custom Form blocks.';
    const formStarter = createDefaultElementBlock('capture_form');
    saveExtendedMeta(activeBuilderAsset.slug, {
      ...currentMeta,
      templateId: 'scratch_custom',
      blocks: [heroStarter, formStarter],
    });
    setExpandedBlockId(heroStarter.id);
    setStatusBanner(
      `Reset "${activeBuilderAsset.title}" to a clean Build-From-Scratch canvas. Click any element in the palette to assemble your layout.`
    );
  };

  const handleSelectVisualTheme = (
    assetOrTheme: CaptureAsset | PageVisualTheme,
    maybeTheme?: PageVisualTheme
  ) => {
    const theme = (typeof assetOrTheme === 'string' ? assetOrTheme : maybeTheme) || 'classic_ivory';
    const target = typeof assetOrTheme === 'object' && assetOrTheme ? assetOrTheme : activeBuilderAsset;
    setModalVisualTheme(theme);
    if (target) {
      const meta = getExtendedForAsset(target);
      saveExtendedMeta(target.slug, { ...meta, visualTheme: theme });
    }
  };

  const handleApplyTemplateToActiveAsset = async (
    assetOrTpl: CaptureAsset | ReadyMadePageTemplate,
    maybeTpl?: ReadyMadePageTemplate
  ) => {
    const tpl = (maybeTpl || assetOrTpl) as ReadyMadePageTemplate;
    await handleLoadTemplateIntoActiveBuilder(tpl);
  };

  const handleResetAssetToScratch = (_asset?: CaptureAsset) => {
    handleResetActiveCanvasToScratch();
  };

  const handleOpenEditModal = (asset: CaptureAsset) => {
    const meta = getExtendedForAsset(asset);
    setEditingAsset(asset);
    setModalBuildMode(meta.templateId && meta.templateId !== 'scratch_custom' ? 'template' : 'scratch');
    setSelectedToolFormat(meta.toolFormat);
    setModalVisualTheme(meta.visualTheme || 'classic_ivory');
    setTitle(asset.title);
    setSlug(asset.slug);
    setHeadline(asset.headline);
    setSubheadline(asset.subheadline);
    setCtaText(asset.ctaText);
    setTargetList(asset.targetList);
    setModalTagsInput(meta.submissionTags.join(', '));
    setModalRedirectMode(meta.redirectMode);
    setModalRedirectUrl(
      asset.redirectUrl || meta.redirectUrl || `https://flowpilot.app/p/${asset.slug}/thank-you`
    );
    setModalSeoTitle(meta.seoTitle);
    setModalSeoDesc(meta.seoDescription);
    setRequireDoubleOptIn(asset.requireDoubleOptIn);
    setIsModalOpen(true);
  };

  const handleCopyShareLink = (asset: CaptureAsset) => {
    const url = getShareablePublicUrl(asset.slug);
    navigator.clipboard?.writeText(url);
    setCopiedSlug(asset.slug);
    setStatusBanner(`Copied shareable link for "${asset.title}": ${url}`);
    setTimeout(() => {
      setCopiedSlug((prev) => (prev === asset.slug ? null : prev));
    }, 2500);
  };

  const handleNativeShareAsset = async (asset: CaptureAsset) => {
    const url = getShareablePublicUrl(asset.slug);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: asset.title,
          text: `${asset.headline} — ${asset.subheadline}`,
          url,
        });
        setStatusBanner(`Shared "${asset.title}" link.`);
        return;
      } catch {
        // Fallback to clipboard copy if user cancels share dialog
      }
    }
    handleCopyShareLink(asset);
  };

  const getAutomationsForList = (listName: string): Automation[] => {
    const clean = (listName || '').trim().toLowerCase();
    if (!clean) return [];
    return automations.filter((a) => {
      const autoList = resolveAutomationTargetList(a).toLowerCase();
      return autoList === clean || a.triggerDetail.toLowerCase().includes(clean);
    });
  };

  const getContactsCountForList = (listName: string): number => {
    const clean = (listName || '').trim().toLowerCase();
    if (!clean) return 0;
    return contacts.filter((c) => c.listName.trim().toLowerCase() === clean).length;
  };

  const handleQuickCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim() || !onCreateList) return;
    const cleanName = sanitizeString(newListName, 80, 'Lead Capture List');
    setIsCreatingInlineList(true);
    try {
      await onCreateList({
        name: cleanName,
        description: `Created from No-Code Lead Gen Studio to store captured leads and trigger automations.`,
        category: newListCategory,
        defaultConsent: 'opted_in',
        defaultTags: ['form-capture'],
        colorAccent: 'emerald',
      });
      setTargetList(cleanName);
      setNewListName('');
      setShowInlineListCreator(false);
    } finally {
      setIsCreatingInlineList(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetList.trim()) return;

    const spec =
      LEAD_GEN_TOOL_FORMATS.find((f) => f.id === selectedToolFormat) || LEAD_GEN_TOOL_FORMATS[0];
    const cleanTitle = sanitizeString(title, 120, `Official ${spec.label}`);
    const autoSlug = cleanTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const finalSlug = sanitizeString(slug || autoSlug, 80, 'lead-capture');
    const finalHeadline = sanitizeString(headline, 160, spec.defaultHeadline);
    const finalSubheadline = sanitizeString(subheadline, 280, spec.defaultSubheadline);
    const finalCta = sanitizeString(ctaText, 60, spec.defaultCta);
    const finalRedirectUrl = sanitizeString(
      modalRedirectUrl,
      500,
      `https://flowpilot.app/p/${finalSlug}/thank-you`
    );
    const cleanTargetList = sanitizeString(targetList, 80, 'General Contacts');

    setIsSaving(true);
    try {
      const payload: Omit<
        CaptureAsset,
        'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'
      > = {
        title: cleanTitle,
        assetType: spec.firestoreAssetType,
        slug: finalSlug,
        headline: finalHeadline,
        subheadline: finalSubheadline,
        ctaText: finalCta,
        redirectUrl: finalRedirectUrl,
        toolFormat: selectedToolFormat,
        targetList: cleanTargetList,
        requireDoubleOptIn,
        status: editingAsset ? editingAsset.status : 'published',
        viewsCount: editingAsset ? editingAsset.viewsCount : 1,
        submissionsCount: editingAsset ? editingAsset.submissionsCount : 0,
      };

      if (editingAsset && onUpdateAsset) {
        await onUpdateAsset(editingAsset.id, payload);
      } else {
        await onCreateAsset(payload);
      }

      const existingMeta = editingAsset ? getExtendedForAsset(editingAsset) : null;
      const parsedTags = sanitizeStringArray(modalTagsInput.split(','), 8, 30);
      const chosenTemplate =
        modalBuildMode === 'template'
          ? READY_MADE_PAGE_TEMPLATES.find((t) => t.id === selectedTemplateId) ||
            READY_MADE_PAGE_TEMPLATES[0]
          : null;

      let initialBlocks: CanvasBlockItem[];
      let initialFormFields: LeadGenFormField[];

      if (editingAsset && existingMeta) {
        initialBlocks = existingMeta.blocks.map((b) =>
          b.type === 'hero_header'
            ? { ...b, title: finalHeadline, content: finalSubheadline }
            : b
        );
        initialFormFields = existingMeta.formFields;
      } else if (chosenTemplate) {
        initialBlocks = chosenTemplate.blocks.map((b, idx) =>
          b.type === 'hero_header' && idx === 0
            ? {
                ...b,
                id: `${b.id}_${Date.now()}_${idx}`,
                title: finalHeadline,
                content: finalSubheadline,
              }
            : {
                ...b,
                id: `${b.id}_${Date.now()}_${idx}`,
                items: b.items ? [...b.items] : undefined,
                faqItems: b.faqItems ? b.faqItems.map((fq) => ({ ...fq })) : undefined,
              }
        );
        initialFormFields = chosenTemplate.formFields.map((f, idx) => ({
          ...f,
          id: `${f.id}_${Date.now()}_${idx}`,
          options: f.options ? [...f.options] : undefined,
        }));
      } else {
        const typesToBuild: CanvasBlockType[] =
          scratchSelectedElements.length > 0
            ? scratchSelectedElements
            : ['hero_header', 'capture_form'];
        initialBlocks = typesToBuild.map((bType, idx) => {
          const blk = createDefaultElementBlock(bType);
          if (bType === 'hero_header' && idx === 0) {
            return { ...blk, title: finalHeadline, content: finalSubheadline };
          }
          return blk;
        });
        initialFormFields = buildDefaultFormFieldsForFormat(selectedToolFormat);
      }

      const extMeta: LeadGenAssetExtendedMetadata = {
        assetIdOrSlug: finalSlug,
        toolFormat: selectedToolFormat,
        visualTheme: modalVisualTheme,
        templateId: chosenTemplate ? chosenTemplate.id : 'scratch_custom',
        blocks: initialBlocks,
        formFields: initialFormFields,
        submissionTags: parsedTags.length > 0 ? parsedTags : spec.defaultTags,
        linkedAutomationName: 'Auto-Match Destination List Workflows',
        redirectMode: modalRedirectMode,
        redirectUrl: finalRedirectUrl,
        thankYouMessage:
          existingMeta?.thankYouMessage ||
          'Confirmed! Your submission has been saved to our list and your resource is on the way.',
        leadMagnetTitle: existingMeta?.leadMagnetTitle || `${cleanTitle} — Resource Bundle.pdf`,
        leadMagnetFileUrl: finalRedirectUrl || `https://flowpilot.app/assets/${finalSlug}.pdf`,
        leadMagnetFileType: existingMeta?.leadMagnetFileType || 'PDF Guide',
        bioLinks: existingMeta?.bioLinks || [
          {
            label: '📘 Download Free Growth Playbook',
            url: 'https://flowpilot.app/p/creator-playbook',
            tagOnClick: 'clicked-playbook',
          },
          {
            label: '📅 Book 1-on-1 Strategy Session',
            url: 'https://flowpilot.app/p/strategy-call',
            tagOnClick: 'clicked-booking',
          },
          {
            label: '💬 Official WhatsApp VIP Channel',
            url: 'https://wa.me/18445550199',
            tagOnClick: 'clicked-whatsapp',
          },
        ],
        popupTrigger: spec.firestoreAssetType === 'popup_form' ? 'exit_intent' : 'inline_embed',
        seoTitle: modalSeoTitle.trim() || `${cleanTitle} | Official Signup`,
        seoDescription: modalSeoDesc.trim() || finalSubheadline,
        ogImageLabel: `${cleanTitle} — Social Card (1200×630)`,
        noIndex: false,
        customDomain:
          existingMeta?.customDomain || customDomains[0]?.domain || 'pages.flowpilotstudio.io',
      };
      saveExtendedMeta(finalSlug, extMeta);

      const savedSnapshot: CaptureAsset = {
        id: editingAsset ? editingAsset.id : `published_${finalSlug}`,
        workspaceId: editingAsset?.workspaceId || 'ws',
        ownerId: editingAsset?.ownerId || 'owner',
        ...payload,
      };
      publishFormAssetToServer(savedSnapshot, extMeta);
      setJustPublishedAsset(savedSnapshot);
      setIsModalOpen(false);
      setEditingAsset(null);
      setTitle('');
      setSlug('');
      setModalSeoTitle('');
      setModalSeoDesc('');
      setStatusBanner(
        editingAsset
          ? `Updated "${cleanTitle}" — Shareable link & CTA redirect URL saved.`
          : modalBuildMode === 'template' && chosenTemplate
          ? `Created "${cleanTitle}" from "${chosenTemplate.name}" template — open the Drag & Drop Editor anytime to customize every block!`
          : `Created "${cleanTitle}" from scratch (${initialBlocks.length} custom elements) — your shareable link is ready!`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAssetTargetList = async (asset: CaptureAsset, newTargetListName: string) => {
    if (!onUpdateAsset || !newTargetListName.trim()) return;
    await onUpdateAsset(asset.id, {
      title: asset.title,
      assetType: asset.assetType,
      slug: asset.slug,
      headline: asset.headline,
      subheadline: asset.subheadline,
      ctaText: asset.ctaText,
      ...(asset.redirectUrl ? { redirectUrl: asset.redirectUrl } : {}),
      ...(asset.toolFormat ? { toolFormat: asset.toolFormat } : {}),
      targetList: sanitizeString(newTargetListName, 80, asset.targetList),
      requireDoubleOptIn: asset.requireDoubleOptIn,
      status: asset.status,
      viewsCount: asset.viewsCount,
      submissionsCount: asset.submissionsCount,
    });
    setStatusBanner(`Updated "${asset.title}" destination list to "${newTargetListName}".`);
  };

  // Drag-and-Drop & Reorder Blocks in Visual Editor
  const handleMoveBlock = (asset: CaptureAsset, index: number, direction: -1 | 1) => {
    const meta = getExtendedForAsset(asset);
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= meta.blocks.length) return;
    const nextBlocks = [...meta.blocks];
    const [moved] = nextBlocks.splice(index, 1);
    nextBlocks.splice(targetIdx, 0, moved);
    saveExtendedMeta(asset.slug, { ...meta, blocks: nextBlocks });
  };

  const handleDropBlock = (asset: CaptureAsset, targetIndex: number) => {
    if (draggedBlockIndex === null || draggedBlockIndex === targetIndex) return;
    const meta = getExtendedForAsset(asset);
    const nextBlocks = [...meta.blocks];
    const [moved] = nextBlocks.splice(draggedBlockIndex, 1);
    nextBlocks.splice(targetIndex, 0, moved);
    saveExtendedMeta(asset.slug, { ...meta, blocks: nextBlocks });
    setDraggedBlockIndex(null);
  };

  const handleAddBlockToAsset = (asset: CaptureAsset, type: CanvasBlockType) => {
    const meta = getExtendedForAsset(asset);
    const newBlock = createDefaultElementBlock(type);
    saveExtendedMeta(asset.slug, { ...meta, blocks: [...meta.blocks, newBlock] });
    setExpandedBlockId(newBlock.id);
    setStatusBanner(`Added "${newBlock.title}" (${type.replace(/_/g, ' ')}) element to "${asset.title}".`);
  };

  const handleRemoveBlockFromAsset = (asset: CaptureAsset, blockId: string) => {
    const meta = getExtendedForAsset(asset);
    if (meta.blocks.length <= 1) return;
    saveExtendedMeta(asset.slug, {
      ...meta,
      blocks: meta.blocks.filter((b) => b.id !== blockId),
    });
  };

  const handleAddCustomFieldToAsset = (asset: CaptureAsset, e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel.trim()) return;
    const meta = getExtendedForAsset(asset);
    const parsedOptions =
      newFieldType === 'select'
        ? newFieldOptions
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;

    const newField: LeadGenFormField = {
      id: `cf_${Date.now()}`,
      label: newFieldLabel.trim(),
      fieldKey: newFieldLabel.trim().slice(0, 40),
      inputType: newFieldType,
      placeholder: `Enter ${newFieldLabel.trim().toLowerCase()}`,
      required: newFieldRequired,
      isCustomField: true,
      options:
        parsedOptions && parsedOptions.length > 0
          ? parsedOptions
          : ['Option A', 'Option B', 'Option C'],
    };

    saveExtendedMeta(asset.slug, {
      ...meta,
      formFields: [...meta.formFields, newField],
    });
    setNewFieldLabel('');
    setNewFieldOptions('');
    setStatusBanner(`Added custom field "${newField.label}" — maps directly to CRM customFields.`);
  };

  // Submit Lead from Interactive Preview Modal (Includes Custom Fields, Survey Answers, Submission Tags & Redirect)
  const handleTestLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewAsset || !testName.trim() || !testEmail.trim() || !testPhone.trim()) return;

    const meta = getExtendedForAsset(previewAsset);
    const formattedCustomFields = Object.entries(testCustomValues)
      .filter(([, val]) => val && val.trim().length > 0)
      .map(([k, val]) => `${k}: ${val.trim()}`.slice(0, 120));

    const capturedName = testName.trim();
    await onSubmitAssetLead(
      previewAsset,
      {
        fullName: capturedName,
        email: testEmail.trim(),
        phone: testPhone.trim(),
      },
      {
        customTags: meta.submissionTags,
        customFields: formattedCustomFields,
        company: testCompany.trim() || undefined,
        notes: `Captured via ${meta.toolFormat.replace(/_/g, ' ')} "${previewAsset.title}" (/p/${
          previewAsset.slug
        }) → List "${previewAsset.targetList}". ${
          formattedCustomFields.length > 0 ? `Responses: ${formattedCustomFields.join(' | ')}` : ''
        }`.slice(0, 500),
      }
    );

    setLastCapturedLeadName(capturedName);
    setTestSuccess(true);
    setTestName('');
    setTestEmail('');
    setTestPhone('');
    setTestCompany('');
    setTestCustomValues({});
  };

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const meta = getExtendedForAsset(a);
      const matchesFormat = formatFilter === 'all' ? true : meta.toolFormat === formatFilter;
      const matchesList =
        listFilter === 'all'
          ? true
          : a.targetList.trim().toLowerCase() === listFilter.trim().toLowerCase();
      return matchesFormat && matchesList;
    });
  }, [assets, extendedMap, formatFilter, listFilter]);

  const activeBuilderMeta = activeBuilderAsset
    ? getExtendedForAsset(activeBuilderAsset)
    : null;

  return (
    <div className="space-y-5">
      {/* Top Studio Header — Classic Architectural & Editorial Atelier */}
      <div className="border border-slate-200 rounded-2xl bg-white p-4 sm:p-6 shadow-xs space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-8 space-y-2">
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
              <span className="font-bold uppercase tracking-wider text-[#047857]">
                Classic Page &amp; Form Atelier
              </span>
              <span aria-hidden="true">·</span>
              <span>Build From Total Scratch</span>
              <span aria-hidden="true">·</span>
              <span>Ready-Made Editable Templates</span>
              <span aria-hidden="true">·</span>
              <span>Direct Contact List &amp; Automation Routing</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl lg:text-2xl font-bold text-[#0F172A]">
              Build Pages &amp; Forms From Total Scratch or Customize Ready-Made Templates
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Assemble custom pages and forms block-by-block with our full element palette (
              <strong>Hero, Video/VSL, Pricing Tiers, Countdown Timer, FAQ Accordion, Benefits &amp; Form</strong>
              ), or load a ready-made <strong>Course &amp; Affiliate Sales Page</strong>,{' '}
              <strong>Squeeze Page</strong>, or <strong>Webinar Page</strong> and edit every detail to your choice.
            </p>

            <div className="pt-1.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenCreateModal('landing_page', 'scratch')}
                className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Build From Total Scratch</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleOpenCreateModal('landing_page', 'template', 'course_affiliate_sales')
                }
                className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Use Ready-Made Template</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveStudioTab('visual_builder')}
                className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-700" />
                <span>Open Drag &amp; Drop Element Editor</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="relative rounded-xl overflow-hidden border border-amber-500/30 bg-[#0F172A] aspect-video shadow-md">
              {!studioBannerImgError ? (
                <img
                  src={templateStudioImg}
                  alt="Classic Page and Form Builder Studio"
                  referrerPolicy="no-referrer"
                  onError={() => setStudioBannerImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#0F172A] text-amber-300 font-display text-sm">
                  Classic Page &amp; Form Studio
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/35 to-transparent flex flex-col justify-end p-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300">
                  10 Drag-and-Drop Elements · 3 Classic Themes
                </div>
                <div className="font-display text-xs sm:text-sm font-bold text-white">
                  Hero · Video · Pricing · Timer · FAQ · Form
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Studio Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
          {[
            { id: 'gallery' as const, label: '1. Templates & Pages/Forms Library', count: assets.length },
            { id: 'visual_builder' as const, label: '2. Scratch & Template Visual Editor (Hero, Video, Pricing, Timer, FAQ, Form)' },
            { id: 'embed_popups' as const, label: '3. Popups, Embed Code & Shareable URLs' },
            { id: 'custom_domains' as const, label: '4. Custom Domains & SEO', count: customDomains.length },
          ].map((tab) => {
            const active = activeStudioTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveStudioTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-950 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span className="font-mono text-[11px] text-emerald-700">({tab.count})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback Banner */}
      {statusBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-950">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-emerald-800 hover:text-emerald-950 font-bold cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Newly Created / Updated Lead Capture Shareable Link & Quick Actions Banner */}
      {justPublishedAsset && (() => {
        const liveMatch =
          assets.find((a) => a.slug === justPublishedAsset.slug || a.id === justPublishedAsset.id) ||
          justPublishedAsset;
        const pubMeta = getExtendedForAsset(liveMatch);
        const shareUrl = getShareablePublicUrl(liveMatch.slug);
        return (
          <div className="border-2 border-emerald-600 rounded-2xl bg-emerald-50/70 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Lead Capture Ready · Shareable Link & CTA Redirect Active</span>
                </div>
                <h3 className="font-display text-base sm:text-lg font-bold text-[#0F172A]">
                  {liveMatch.title}{' '}
                  <span className="text-xs font-mono font-normal text-slate-600">
                    ({pubMeta.toolFormat.replace(/_/g, ' ')})
                  </span>
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(liveMatch)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const targetToDelete = assets.find(
                      (a) => a.id === liveMatch.id || a.slug === liveMatch.slug
                    );
                    if (targetToDelete) {
                      await onDeleteAsset(targetToDelete.id);
                    }
                    setJustPublishedAsset(null);
                    setStatusBanner(`Deleted lead capture "${liveMatch.title}".`);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => setJustPublishedAsset(null)}
                  className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
                  title="Close share panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center bg-white p-3.5 rounded-xl border border-emerald-200">
              <div className="lg:col-span-7 space-y-1">
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Shareable Lead Capture Link (Copy or Share Anywhere):</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  CTA Button <strong className="text-slate-800">&ldquo;{liveMatch.ctaText}&rdquo;</strong>{' '}
                  redirects to:{' '}
                  <span className="font-mono text-emerald-800">{pubMeta.redirectUrl}</span>
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyShareLink(liveMatch)}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSlug === liveMatch.slug ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied Link!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Shareable Link</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleNativeShareAsset(liveMatch)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Share</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTestSuccess(false);
                    setPreviewAsset(liveMatch);
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Test Page</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =====================================================================
          TAB 1: READY-MADE EDITABLE TEMPLATES + BUILD FROM SCRATCH + PAGES/FORMS GALLERY
         ===================================================================== */}
      {activeStudioTab === 'gallery' && (
        <div className="space-y-5">
          {/* Ready-Made Editable Templates & Build-From-Scratch Showcase */}
          <div className="border border-slate-200 rounded-2xl bg-[#0F172A] text-white p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400">
                  Start From Total Scratch or Load a Ready-Made Editable Template
                </div>
                <h3 className="font-display text-base sm:text-xl font-bold text-white mt-0.5">
                  Course &amp; Affiliate Sales Page, Squeeze Page, Webinar Page &amp; Blank Canvas Builder
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Every template below is 100% editable—change headlines, video embeds, pricing tiers,
                  countdown timers, FAQs, and custom CRM form fields, or start from a blank canvas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenCreateModal('landing_page', 'scratch')}
                className="px-4 py-2.5 text-xs font-bold text-[#0F172A] bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Start From Total Scratch (Blank Canvas)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Card 0: Build From Total Scratch Card */}
              <div className="p-4 rounded-xl bg-slate-900/90 border-2 border-dashed border-amber-400/50 flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold uppercase text-amber-300">
                      100% Blank Canvas Mode
                    </span>
                    <span className="font-mono text-emerald-400">All 11 Elements</span>
                  </div>
                  <h4 className="font-display text-base font-bold text-white">
                    Build Page or Form From Total Scratch
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Start with a clean slate and pick exact elements to stack: Hero Banner, Video/VSL
                    Player, Pricing Tiers, Countdown Timer, FAQ Accordion, Value Bullets, Social Proof,
                    and Custom Form.
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1 text-[10px] font-mono text-slate-300">
                    {['Hero', 'Video', 'Pricing', 'Timer', 'FAQ', 'Form'].map((el) => (
                      <span
                        key={el}
                        className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-200"
                      >
                        + {el}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal('landing_page', 'scratch')}
                    className="py-2 px-3 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer"
                  >
                    + New From Scratch
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleResetActiveCanvasToScratch();
                      setActiveStudioTab('visual_builder');
                    }}
                    className="py-2 px-3 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
                  >
                    Clear Active Canvas
                  </button>
                </div>
              </div>

              {/* Ready-Made Editable Template Cards (Course/Affiliate Sales, Squeeze, Webinar, VSL, Form) */}
              {READY_MADE_PAGE_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition-colors flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono font-bold uppercase text-emerald-400">
                        {tpl.badge}
                      </span>
                      <span className="font-mono text-slate-400">
                        {tpl.blocks.length} Editable Blocks
                      </span>
                    </div>
                    <h4 className="font-display text-base font-bold text-white">{tpl.name}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                      {tpl.description}
                    </p>
                    <div className="text-[11px] font-mono text-slate-400 pt-0.5 truncate">
                      Elements:{' '}
                      {tpl.blocks.map((b) => b.type.replace(/_/g, ' ')).join(' → ')}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleOpenCreateModal(tpl.toolFormat, 'template', tpl.id)}
                      className="py-2 px-2.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer"
                    >
                      Use Template
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadTemplateIntoActiveBuilder(tpl)}
                      className="py-2 px-2.5 text-xs font-bold text-amber-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg cursor-pointer"
                    >
                      Load in Builder
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick-Launch Strip for All 9 Lead Generation Tool Formats */}
          <div className="border border-slate-200 rounded-2xl bg-white p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  No-Code Formats · All 9 Lead Generation Formats
                </div>
                <h3 className="font-display text-sm sm:text-base font-bold text-slate-950">
                  Choose a Lead Capture Tool Format to Launch or Filter
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={listFilter}
                  onChange={(e) => setListFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#F8FAFC] border border-slate-300 rounded-lg text-slate-800"
                >
                  <option value="all">All Contact Lists ({assets.length})</option>
                  {allAvailableLists.map((lst) => (
                    <option key={lst.id} value={lst.name}>
                      List: {lst.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setFormatFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                  formatFilter === 'all'
                    ? 'bg-[#0F172A] text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                All Formats ({assets.length})
              </button>
              {LEAD_GEN_TOOL_FORMATS.map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setFormatFilter(fmt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    formatFilter === fmt.id
                      ? 'bg-[#047857] text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {fmt.shortLabel}
                </button>
              ))}
            </div>

            {/* 9 Format Quick-Launch Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {LEAD_GEN_TOOL_FORMATS.map((fmt) => (
                <div
                  key={fmt.id}
                  className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <div className="text-[11px] text-slate-500">
                      <span className="font-bold text-emerald-700">{fmt.categoryBadge}</span>
                      <span aria-hidden="true"> · </span>
                      <span>Tags: {fmt.defaultTags.join(', ')}</span>
                    </div>
                    <h4 className="font-display text-sm font-bold text-slate-950 mt-0.5">
                      {fmt.label}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{fmt.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal(fmt.id)}
                    className="w-full py-1.5 px-3 text-xs font-bold text-slate-900 bg-white hover:bg-emerald-700 hover:text-white border border-slate-300 rounded-lg transition-colors cursor-pointer"
                  >
                    + Build {fmt.shortLabel}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Published Assets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredAssets.map((asset) => {
              const meta = getExtendedForAsset(asset);
              const fmtSpec =
                LEAD_GEN_TOOL_FORMATS.find((f) => f.id === meta.toolFormat) ||
                LEAD_GEN_TOOL_FORMATS[0];
              const convRate =
                asset.viewsCount > 0
                  ? ((asset.submissionsCount / asset.viewsCount) * 100).toFixed(1)
                  : '0.0';
              const linkedAutomations = getAutomationsForList(asset.targetList);
              const storedContactsInList = getContactsCountForList(asset.targetList);

              return (
                <div
                  key={asset.id}
                  className="border border-slate-200 border-t-4 border-t-emerald-700 rounded-2xl bg-white p-4 sm:p-5 flex flex-col justify-between shadow-xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div>
                        <span className="text-[#0F172A] font-bold uppercase">
                          {fmtSpec.shortLabel}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span className="text-emerald-700 font-bold capitalize">
                          {asset.status}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>{meta.formFields.length} fields</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(asset)}
                          className="p-1 text-slate-500 hover:text-emerald-700 cursor-pointer"
                          title="Edit lead capture settings & redirect link"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDeleteId((prev) => (prev === asset.id ? null : asset.id))
                          }
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          title="Delete lead capture"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {confirmDeleteId === asset.id && (
                      <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-red-900">Delete this lead capture?</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteAsset(asset.id);
                              setConfirmDeleteId(null);
                              if (justPublishedAsset?.id === asset.id) {
                                setJustPublishedAsset(null);
                              }
                              setStatusBanner(`Deleted "${asset.title}".`);
                            }}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg cursor-pointer"
                          >
                            Yes, Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <h3 className="font-display text-base sm:text-lg font-bold text-slate-950">
                      {asset.title}
                    </h3>

                    {/* Shareable Link Box (Copy & Share) */}
                    <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-emerald-950 flex items-center gap-1">
                          <Link2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Shareable Capture Link</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyShareLink(asset)}
                            className="text-emerald-800 hover:text-emerald-950 font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            {copiedSlug === asset.slug ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                          <span aria-hidden="true" className="text-slate-300">
                            |
                          </span>
                          <button
                            type="button"
                            onClick={() => handleNativeShareAsset(asset)}
                            className="text-slate-700 hover:text-slate-950 font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Share</span>
                          </button>
                        </div>
                      </div>
                      <div className="text-[11px] font-mono text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200/80 truncate">
                        {getShareablePublicUrl(asset.slug)}
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed font-display italic">
                      “{asset.headline}”
                    </p>

                    {/* CTA Button & Redirect Link Metadata */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-[11px] text-slate-600 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          <strong className="text-slate-800">CTA Button:</strong> &ldquo;
                          {asset.ctaText}&rdquo;
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(asset)}
                          className="text-emerald-700 hover:underline font-bold shrink-0 cursor-pointer"
                        >
                          Edit Link
                        </button>
                      </div>
                      <div className="truncate">
                        <strong className="text-slate-800">CTA Redirect Link:</strong>{' '}
                        <span className="font-mono text-emerald-800">{meta.redirectUrl}</span>
                      </div>
                      <div className="truncate">
                        <strong className="text-slate-800">Tags on Submit:</strong>{' '}
                        <span className="font-mono text-slate-700">
                          {meta.submissionTags.join(', ')}
                        </span>
                      </div>
                    </div>

                    {/* Direct List Assignment & Automation Trigger Box */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Assigned List</span>
                        </span>
                        <span className="text-[11px] font-mono font-bold text-emerald-800">
                          {storedContactsInList} contacts
                        </span>
                      </div>

                      {onUpdateAsset && allAvailableLists.length > 0 ? (
                        <select
                          value={asset.targetList}
                          onChange={(e) => handleUpdateAssetTargetList(asset, e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg text-[#0F172A]"
                        >
                          {!allAvailableLists.some(
                            (l) => l.name.toLowerCase() === asset.targetList.toLowerCase()
                          ) && <option value={asset.targetList}>{asset.targetList}</option>}
                          {allAvailableLists.map((lst) => (
                            <option key={lst.id} value={lst.name}>
                              {lst.name} ({getContactsCountForList(lst.name)} contacts)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-xs font-bold text-[#0F172A]">{asset.targetList}</div>
                      )}

                      <div className="pt-1.5 border-t border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                        {linkedAutomations.length > 0 ? (
                          <div className="flex items-center gap-1.5 text-emerald-800 font-semibold truncate">
                            <GitBranch className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span className="truncate">
                              Triggers: {linkedAutomations.map((a) => a.name).join(', ')}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full gap-2">
                            <span className="text-[11px] text-slate-500">No workflow linked</span>
                            {onCreateAutomationForList && (
                              <button
                                type="button"
                                onClick={() => onCreateAutomationForList(asset.targetList)}
                                className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer shrink-0"
                              >
                                + Add Trigger →
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-3">
                    <div className="grid grid-cols-3 gap-2 font-mono text-xs tabular-nums">
                      <div>
                        <div className="text-slate-500 text-[11px]">Views</div>
                        <div className="font-bold text-slate-950">
                          {asset.viewsCount.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[11px]">Submissions</div>
                        <div className="font-bold text-[#0F172A]">
                          {asset.submissionsCount.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[11px]">Conversion</div>
                        <div className="font-bold text-emerald-700">{convRate}%</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(asset)}
                        className="py-2 px-2.5 text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAssetId(asset.id);
                          setActiveStudioTab('visual_builder');
                        }}
                        className="py-2 px-2.5 text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                      >
                        Builder
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTestSuccess(false);
                          setPreviewAsset(asset);
                        }}
                        className="py-2 px-2.5 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDeleteId((prev) => (prev === asset.id ? null : asset.id))
                        }
                        className="py-2 px-2.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: DRAG-AND-DROP EDITOR + RESPONSIVE MOBILE/DESKTOP PREVIEW
         ===================================================================== */}
      {activeStudioTab === 'visual_builder' && activeBuilderAsset && activeBuilderMeta && (
        <div className="space-y-4">
          {/* Builder Top Bar: Asset Selector + 1-Click Template / Scratch Switcher + Theme + Viewport */}
          <div className="border border-slate-200 rounded-2xl bg-white p-4 space-y-3 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-bold text-slate-700">Editing Page / Form:</span>
                <select
                  value={activeBuilderAsset.id}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold bg-[#F8FAFC] border border-slate-300 rounded-xl text-slate-950"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} (/p/{a.slug})
                    </option>
                  ))}
                </select>

                {/* Page Visual Theme Selector */}
                <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-amber-300/80 rounded-xl px-2.5 py-1">
                  <Palette className="w-3.5 h-3.5 text-amber-700" />
                  <span className="text-[11px] font-bold text-slate-700">Theme:</span>
                  <select
                    value={activeBuilderMeta.visualTheme || 'classic_ivory_brass'}
                    onChange={(e) =>
                      handleSelectVisualTheme(
                        activeBuilderAsset,
                        e.target.value as PageVisualTheme
                      )
                    }
                    className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="classic_ivory_brass">Classic Ivory &amp; Brass</option>
                    <option value="obsidian_gold_editorial">Obsidian Slate &amp; Gold</option>
                    <option value="executive_emerald">Executive Emerald Atelier</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setViewportMode('desktop')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                      viewportMode === 'desktop'
                        ? 'bg-white text-slate-950 font-bold shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewportMode('mobile')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                      viewportMode === 'mobile'
                        ? 'bg-white text-slate-950 font-bold shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile (375px)</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenEditModal(activeBuilderAsset)}
                  className="px-3 py-2 text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Edit Details &amp; Redirect</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyShareLink(activeBuilderAsset)}
                  className="px-3 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    {copiedSlug === activeBuilderAsset.slug ? 'Copied Link!' : 'Copy Share Link'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTestSuccess(false);
                    setPreviewAsset(activeBuilderAsset);
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Test Live Page</span>
                </button>
              </div>
            </div>

            {/* Quick Template Loader Bar + Reset to Total Scratch Bar */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-slate-700 inline-flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>1-Click Load Ready-Made Template:</span>
                </span>
                {READY_MADE_PAGE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleApplyTemplateToActiveAsset(activeBuilderAsset, tpl)}
                    className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] hover:bg-amber-50 text-slate-900 border border-amber-300/80 font-semibold transition-colors cursor-pointer"
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleResetAssetToScratch(activeBuilderAsset)}
                className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Total Scratch (Blank Canvas)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left 5 Cols: Inspector Controls (Element Palette & Drag Blocks, Custom Fields, Tags/Redirect, SEO) */}
            <div className="lg:col-span-5 border border-slate-200 rounded-2xl bg-white p-4 sm:p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
                {[
                  { id: 'blocks' as const, label: 'Elements & Blocks' },
                  { id: 'fields' as const, label: 'Form & Custom Fields' },
                  { id: 'routing_tags' as const, label: 'Tags, List & Redirect' },
                  { id: 'seo_url' as const, label: 'SEO & Public URL' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setBuilderInspectorTab(t.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                      builderInspectorTab === t.id
                        ? 'bg-white text-slate-950 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* INSPECTOR 1: FULL ELEMENT PALETTE + DRAG-AND-DROP BLOCKS & DEEP CUSTOMIZATION */}
              {builderInspectorTab === 'blocks' && (
                <div className="space-y-4 text-xs">
                  {/* Full Element Palette to Build From Scratch */}
                  <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-amber-200/90 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-950 uppercase tracking-wider text-[11px]">
                        Element Palette · Click to Add to Canvas
                      </span>
                      <span className="text-[11px] font-mono text-amber-800">
                        {ELEMENT_PALETTE_CATALOG.length} Elements
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ELEMENT_PALETTE_CATALOG.map((el) => (
                        <button
                          key={el.type}
                          type="button"
                          onClick={() => handleAddBlockToAsset(activeBuilderAsset, el.type)}
                          className="p-2 rounded-lg bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-500 text-left transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-900 group-hover:text-emerald-950 truncate">
                              + {el.label}
                            </span>
                            <span className="text-[10px] font-mono text-amber-700 shrink-0">
                              {el.badge}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">
                            {el.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Canvas Elements List (Drag to reorder + click to customize deeply) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900">
                        Active Page Elements ({activeBuilderMeta.blocks.length})
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Drag to reorder · Click any element to customize
                      </span>
                    </div>

                    {activeBuilderMeta.blocks.map((blk, idx) => {
                      const isExpanded = expandedBlockId === blk.id;
                      return (
                        <div
                          key={blk.id}
                          draggable
                          onDragStart={() => setDraggedBlockIndex(idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDropBlock(activeBuilderAsset, idx)}
                          className={`p-3 rounded-xl border transition-colors space-y-2.5 ${
                            isExpanded
                              ? 'bg-emerald-50/40 border-emerald-600 shadow-2xs'
                              : 'bg-[#F8FAFC] border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBlockId((prev) => (prev === blk.id ? null : blk.id))
                              }
                              className="flex items-center gap-2 font-bold text-slate-900 text-left cursor-pointer"
                            >
                              <GripVertical className="w-4 h-4 text-slate-400 shrink-0 cursor-move" />
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-[10px]">
                                #{idx + 1}
                              </span>
                              <span>{blk.type.replace(/_/g, ' ').toUpperCase()}</span>
                            </button>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedBlockId((prev) => (prev === blk.id ? null : blk.id))
                                }
                                className="px-2 py-0.5 text-[11px] font-semibold bg-white border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 cursor-pointer"
                              >
                                {isExpanded ? 'Done' : 'Customize'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveBlock(activeBuilderAsset, idx, -1)}
                                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                                title="Move block up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveBlock(activeBuilderAsset, idx, 1)}
                                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                                title="Move block down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveBlockFromAsset(activeBuilderAsset, blk.id)
                                }
                                className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                title="Remove block"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Always-visible Section Heading Input */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                              Element Headline / Title
                            </label>
                            <input
                              type="text"
                              value={blk.title}
                              onChange={(e) =>
                                handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                  title: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900"
                            />
                          </div>

                          {/* Expanded Deep Element Customization Drawer */}
                          {isExpanded && (
                            <div className="pt-2 border-t border-slate-200/80 space-y-2.5">
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                  Eyebrow Badge / Accent Note
                                </label>
                                <input
                                  type="text"
                                  value={blk.accentNote || ''}
                                  onChange={(e) =>
                                    handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                      accentNote: e.target.value,
                                    })
                                  }
                                  placeholder="e.g. Executive Masterclass · Verified Proof"
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                  Subheadline / Body Copy
                                </label>
                                <textarea
                                  rows={2}
                                  value={blk.content}
                                  onChange={(e) =>
                                    handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                      content: e.target.value,
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                                />
                              </div>

                              {/* HERO SPECIFIC: Primary CTA Button Label */}
                              {blk.type === 'hero_header' && (
                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                    Hero Primary Button Text
                                  </label>
                                  <input
                                    type="text"
                                    value={blk.ctaButtonLabel || ''}
                                    onChange={(e) =>
                                      handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                        ctaButtonLabel: e.target.value,
                                      })
                                    }
                                    placeholder="e.g. Claim Instant Access Now →"
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                                  />
                                </div>
                              )}

                              {/* VIDEO EMBED SPECIFIC: Video URL & Duration */}
                              {blk.type === 'video_embed' && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                      Video Embed URL (YouTube / Vimeo / Optional)
                                    </label>
                                    <input
                                      type="text"
                                      value={blk.videoUrl || ''}
                                      onChange={(e) =>
                                        handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                          videoUrl: e.target.value,
                                        })
                                      }
                                      placeholder="https://www.youtube.com/embed/..."
                                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                      Duration Badge
                                    </label>
                                    <input
                                      type="text"
                                      value={blk.videoDuration || '14:20'}
                                      onChange={(e) =>
                                        handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                          videoDuration: e.target.value,
                                        })
                                      }
                                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* COUNTDOWN TIMER SPECIFIC: Hours, Minutes, Seconds, Label */}
                              {blk.type === 'countdown_timer' && (
                                <div className="space-y-2">
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                      Timer Urgency Banner Label
                                    </label>
                                    <input
                                      type="text"
                                      value={blk.timerLabel || ''}
                                      onChange={(e) =>
                                        handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                          timerLabel: e.target.value,
                                        })
                                      }
                                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                                    />
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                        Hours
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={999}
                                        value={blk.timerHours ?? 4}
                                        onChange={(e) =>
                                          handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                            timerHours: Number(e.target.value),
                                          })
                                        }
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                        Minutes
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={59}
                                        value={blk.timerMinutes ?? 42}
                                        onChange={(e) =>
                                          handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                            timerMinutes: Number(e.target.value),
                                          })
                                        }
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                        Seconds
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={59}
                                        value={blk.timerSeconds ?? 19}
                                        onChange={(e) =>
                                          handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                            timerSeconds: Number(e.target.value),
                                          })
                                        }
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* PRICING TIERS SPECIFIC: Edit Tiers */}
                              {blk.type === 'pricing_tiers' && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase text-slate-600">
                                      Pricing Packages ({(blk.pricingTiers || []).length})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const current = blk.pricingTiers || [];
                                        handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                          pricingTiers: [
                                            ...current,
                                            {
                                              name: 'VIP Advisory Tier',
                                              price: '$997',
                                              billingPeriod: 'one-time',
                                              badge: 'Limited Seats',
                                              features: [
                                                'Full Masterclass & Automation Suite',
                                                '1-on-1 Funnel Architecture Audit',
                                              ],
                                              ctaLabel: 'Enroll in VIP Advisory',
                                              highlighted: false,
                                            },
                                          ],
                                        });
                                      }}
                                      className="px-2 py-0.5 text-[10px] font-bold bg-emerald-700 text-white rounded cursor-pointer"
                                    >
                                      + Add Tier
                                    </button>
                                  </div>
                                  {(blk.pricingTiers || []).map((tier, tIdx) => (
                                    <div
                                      key={tIdx}
                                      className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <input
                                          type="text"
                                          value={tier.name}
                                          onChange={(e) => {
                                            const next = [...(blk.pricingTiers || [])];
                                            next[tIdx] = { ...tier, name: e.target.value };
                                            handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                              pricingTiers: next,
                                            });
                                          }}
                                          className="flex-1 px-2 py-1 border border-slate-300 rounded font-bold text-slate-900"
                                        />
                                        <input
                                          type="text"
                                          value={tier.price}
                                          onChange={(e) => {
                                            const next = [...(blk.pricingTiers || [])];
                                            next[tIdx] = { ...tier, price: e.target.value };
                                            handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                              pricingTiers: next,
                                            });
                                          }}
                                          className="w-20 px-2 py-1 border border-slate-300 rounded font-mono font-bold text-emerald-800"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next = (blk.pricingTiers || []).filter(
                                              (_, i) => i !== tIdx
                                            );
                                            handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                              pricingTiers: next,
                                            });
                                          }}
                                          className="text-slate-400 hover:text-red-600 cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                      <textarea
                                        rows={2}
                                        value={(tier.features || []).join('\n')}
                                        onChange={(e) => {
                                          const next = [...(blk.pricingTiers || [])];
                                          next[tIdx] = {
                                            ...tier,
                                            features: e.target.value
                                              .split('\n')
                                              .filter((line) => line.trim().length > 0),
                                          };
                                          handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                            pricingTiers: next,
                                          });
                                        }}
                                        placeholder="One feature per line"
                                        className="w-full px-2 py-1 border border-slate-200 rounded text-[11px] font-mono"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* FAQ SECTION SPECIFIC: Edit Q&A Pairs */}
                              {blk.type === 'faq_section' && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase text-slate-600">
                                      FAQ Questions ({(blk.faqItems || []).length})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const current = blk.faqItems || [];
                                        handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                          faqItems: [
                                            ...current,
                                            {
                                              question: 'Can I customize every section after loading?',
                                              answer:
                                                'Yes. Every headline, video, pricing tier, countdown timer, and form field is 100% editable.',
                                            },
                                          ],
                                        });
                                      }}
                                      className="px-2 py-0.5 text-[10px] font-bold bg-emerald-700 text-white rounded cursor-pointer"
                                    >
                                      + Add FAQ
                                    </button>
                                  </div>
                                  {(blk.faqItems || []).map((fq, fIdx) => (
                                    <div
                                      key={fIdx}
                                      className="p-2 rounded-lg bg-white border border-slate-200 space-y-1"
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <input
                                          type="text"
                                          value={fq.question}
                                          onChange={(e) => {
                                            const next = [...(blk.faqItems || [])];
                                            next[fIdx] = { ...fq, question: e.target.value };
                                            handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                              faqItems: next,
                                            });
                                          }}
                                          className="flex-1 px-2 py-1 border border-slate-300 rounded font-bold"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next = (blk.faqItems || []).filter(
                                              (_, i) => i !== fIdx
                                            );
                                            handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                              faqItems: next,
                                            });
                                          }}
                                          className="text-slate-400 hover:text-red-600 cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                      <textarea
                                        rows={2}
                                        value={fq.answer}
                                        onChange={(e) => {
                                          const next = [...(blk.faqItems || [])];
                                          next[fIdx] = { ...fq, answer: e.target.value };
                                          handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                            faqItems: next,
                                          });
                                        }}
                                        className="w-full px-2 py-1 border border-slate-200 rounded text-[11px]"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* BULLETS / SOCIAL PROOF / LEAD MAGNET / BIO LINKS ITEMS */}
                              {(blk.type === 'value_bullets' ||
                                blk.type === 'social_proof' ||
                                blk.type === 'lead_magnet_card' ||
                                blk.type === 'link_in_bio_stack') && (
                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                    Bullet Items / Proof Quotes (One per line)
                                  </label>
                                  <textarea
                                    rows={3}
                                    value={(blk.items || []).join('\n')}
                                    onChange={(e) =>
                                      handleUpdateBlockField(activeBuilderAsset, blk.id, {
                                        items: e.target.value
                                          .split('\n')
                                          .filter((line) => line.trim().length > 0),
                                      })
                                    }
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* INSPECTOR 2: FORM FIELDS & CUSTOM FIELDS */}
              {builderInspectorTab === 'fields' && (
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="font-bold text-slate-900">
                      Form Fields &amp; Custom CRM / Survey Fields ({activeBuilderMeta.formFields.length})
                    </div>
                    <p className="text-slate-500 mt-0.5">
                      Standard fields map to Contact Name/Email/Phone. Custom fields &amp; survey
                      questions save automatically to the contact’s CRM record.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {activeBuilderMeta.formFields.map((fld) => (
                      <div
                        key={fld.id}
                        className="p-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{fld.label}</div>
                          <div className="text-[11px] font-mono text-slate-500">
                            Type: {fld.inputType} · {fld.required ? 'Required' : 'Optional'} ·{' '}
                            {fld.isCustomField ? 'Custom CRM Field' : 'Core Field'}
                          </div>
                        </div>
                        {fld.isCustomField && (
                          <button
                            type="button"
                            onClick={() => {
                              saveExtendedMeta(activeBuilderAsset.slug, {
                                ...activeBuilderMeta,
                                formFields: activeBuilderMeta.formFields.filter(
                                  (f) => f.id !== fld.id
                                ),
                              });
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={(e) => handleAddCustomFieldToAsset(activeBuilderAsset, e)}
                    className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2.5"
                  >
                    <div className="font-bold text-emerald-950">
                      + Add Custom Field or Survey Question
                    </div>
                    <input
                      type="text"
                      required
                      value={newFieldLabel}
                      onChange={(e) => setNewFieldLabel(e.target.value)}
                      placeholder="e.g. Monthly Revenue Tier or Biggest Challenge"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newFieldType}
                        onChange={(e) => setNewFieldType(e.target.value as FormFieldInputType)}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                      >
                        <option value="text">Short Text Input</option>
                        <option value="select">Dropdown Select</option>
                        <option value="textarea">Long Answer / Inquiry</option>
                        <option value="checkbox">Consent Checkbox</option>
                      </select>
                      <label className="flex items-center gap-1.5 font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={newFieldRequired}
                          onChange={(e) => setNewFieldRequired(e.target.checked)}
                          className="accent-emerald-700"
                        />
                        <span>Required field</span>
                      </label>
                    </div>
                    {newFieldType === 'select' && (
                      <input
                        type="text"
                        value={newFieldOptions}
                        onChange={(e) => setNewFieldOptions(e.target.value)}
                        placeholder="Comma-separated options (e.g. Starter, Pro, Enterprise)"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                      />
                    )}
                    <button
                      type="submit"
                      className="w-full py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer"
                    >
                      Add Custom Field to Form
                    </button>
                  </form>
                </div>
              )}

              {/* INSPECTOR 3: SUBMISSION TAGS, LIST ASSIGNMENT, AUTOMATION TRIGGER & REDIRECT */}
              {builderInspectorTab === 'routing_tags' && (
                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      1. Destination Contact List Assignment
                    </label>
                    <select
                      value={activeBuilderAsset.targetList}
                      onChange={(e) =>
                        handleUpdateAssetTargetList(activeBuilderAsset, e.target.value)
                      }
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg font-bold"
                    >
                      {allAvailableLists.map((lst) => (
                        <option key={lst.id} value={lst.name}>
                          {lst.name} ({getContactsCountForList(lst.name)} contacts)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      2. Tags Applied Automatically on Submission
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {activeBuilderMeta.submissionTags.map((tg, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md font-mono text-[11px] text-emerald-900 inline-flex items-center gap-1.5"
                        >
                          <span>#{tg}</span>
                          <button
                            type="button"
                            onClick={() => {
                              saveExtendedMeta(activeBuilderAsset.slug, {
                                ...activeBuilderMeta,
                                submissionTags: activeBuilderMeta.submissionTags.filter(
                                  (_, idx) => idx !== i
                                ),
                              });
                            }}
                            className="text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        placeholder="Add submission tag (e.g. vip-lead)"
                        className="flex-1 px-3 py-1.5 bg-[#F8FAFC] border border-slate-300 rounded-lg font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const clean = newTagInput.trim().toLowerCase().replace(/\s+/g, '-');
                          if (!clean) return;
                          saveExtendedMeta(activeBuilderAsset.slug, {
                            ...activeBuilderMeta,
                            submissionTags: Array.from(
                              new Set([...activeBuilderMeta.submissionTags, clean])
                            ).slice(0, 8),
                          });
                          setNewTagInput('');
                        }}
                        className="px-3 py-1.5 font-bold text-white bg-[#0F172A] rounded-lg cursor-pointer"
                      >
                        Add Tag
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      3. CTA Button Redirect Link (Destination URL)
                    </label>
                    <input
                      type="text"
                      value={activeBuilderMeta.redirectUrl}
                      onChange={(e) => {
                        const nextUrl = e.target.value;
                        saveExtendedMeta(activeBuilderAsset.slug, {
                          ...activeBuilderMeta,
                          redirectUrl: nextUrl,
                        });
                        if (onUpdateAsset) {
                          onUpdateAsset(activeBuilderAsset.id, {
                            title: activeBuilderAsset.title,
                            assetType: activeBuilderAsset.assetType,
                            slug: activeBuilderAsset.slug,
                            headline: activeBuilderAsset.headline,
                            subheadline: activeBuilderAsset.subheadline,
                            ctaText: activeBuilderAsset.ctaText,
                            redirectUrl: sanitizeString(nextUrl, 500, ''),
                            toolFormat: activeBuilderMeta.toolFormat,
                            targetList: activeBuilderAsset.targetList,
                            requireDoubleOptIn: activeBuilderAsset.requireDoubleOptIn,
                            status: activeBuilderAsset.status,
                            viewsCount: activeBuilderAsset.viewsCount,
                            submissionsCount: activeBuilderAsset.submissionsCount,
                          });
                        }
                      }}
                      placeholder="https://yourwebsite.com/thank-you"
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg font-mono"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Where leads are sent when they click the &ldquo;{activeBuilderAsset.ctaText}&rdquo; CTA button.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      4. Post-Submission Behavior
                    </label>
                    <select
                      value={activeBuilderMeta.redirectMode}
                      onChange={(e) =>
                        saveExtendedMeta(activeBuilderAsset.slug, {
                          ...activeBuilderMeta,
                          redirectMode:
                            e.target.value as LeadGenAssetExtendedMetadata['redirectMode'],
                        })
                      }
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg font-semibold"
                    >
                      <option value="custom_url">Redirect to CTA Destination Link</option>
                      <option value="thank_you_page">Redirect to Dedicated Thank-You Page</option>
                      <option value="inline_thank_you">
                        Show Confirmation + CTA Redirect Button
                      </option>
                      <option value="lead_magnet_download">
                        Unlock Instant Lead Magnet File Download
                      </option>
                    </select>
                  </div>

                  {activeBuilderMeta.redirectMode === 'lead_magnet_download' && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Lead Magnet Download File URL
                      </label>
                      <input
                        type="text"
                        value={activeBuilderMeta.leadMagnetFileUrl}
                        onChange={(e) =>
                          saveExtendedMeta(activeBuilderAsset.slug, {
                            ...activeBuilderMeta,
                            leadMagnetFileUrl: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* INSPECTOR 4: BASIC SEO METADATA & SHAREABLE PUBLIC URL */}
              {builderInspectorTab === 'seo_url' && (
                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      SEO Page Title (`&lt;title&gt;` &amp; `og:title`)
                    </label>
                    <input
                      type="text"
                      value={activeBuilderMeta.seoTitle}
                      onChange={(e) =>
                        saveExtendedMeta(activeBuilderAsset.slug, {
                          ...activeBuilderMeta,
                          seoTitle: e.target.value,
                        })
                      }
                      className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      SEO Meta Description (`&lt;meta name=&quot;description&quot;&gt;`)
                    </label>
                    <textarea
                      rows={2}
                      value={activeBuilderMeta.seoDescription}
                      onChange={(e) =>
                        saveExtendedMeta(activeBuilderAsset.slug, {
                          ...activeBuilderMeta,
                          seoDescription: e.target.value,
                        })
                      }
                      className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-slate-300 rounded-lg"
                    />
                  </div>

                  {/* Live Google Search Snippet Preview */}
                  <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Search Engine &amp; OpenGraph Card Preview
                    </div>
                    <div className="text-[11px] font-mono text-emerald-700 truncate">
                      https://{activeBuilderMeta.customDomain}/p/{activeBuilderAsset.slug}
                    </div>
                    <div className="text-sm font-bold text-blue-800 truncate">
                      {activeBuilderMeta.seoTitle}
                    </div>
                    <div className="text-xs text-slate-600 line-clamp-2">
                      {activeBuilderMeta.seoDescription}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right 7 Cols: Live Responsive Desktop / Mobile Preview Canvas */}
            <div className="lg:col-span-7 border border-slate-200 rounded-2xl bg-slate-100 p-4 sm:p-6 flex flex-col items-center justify-center shadow-inner">
              {(() => {
                const visualTheme = activeBuilderMeta.visualTheme || 'classic_ivory_brass';
                const isDarkObsidian = visualTheme === 'obsidian_gold_editorial';
                const isEmeraldAtelier = visualTheme === 'executive_emerald';

                const canvasBgClass = isDarkObsidian
                  ? 'bg-[#0B0F17] text-white border-amber-500/40'
                  : isEmeraldAtelier
                  ? 'bg-[#F2F7F5] text-slate-950 border-emerald-300'
                  : 'bg-[#FAF8F5] text-slate-950 border-amber-300/70';

                return (
                  <div
                    className={`border rounded-2xl overflow-hidden shadow-lg transition-all duration-200 w-full ${canvasBgClass} ${
                      viewportMode === 'mobile' ? 'max-w-[375px]' : 'max-w-full'
                    }`}
                  >
                    {/* Browser / Mobile Address Bar */}
                    <div className="bg-[#0F172A] text-white px-4 py-2.5 flex items-center justify-between text-[11px] font-mono border-b border-slate-800">
                      <span className="truncate">
                        https://{activeBuilderMeta.customDomain}/p/{activeBuilderAsset.slug}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-amber-300">
                          {visualTheme.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className="text-emerald-400">
                          · {viewportMode === 'mobile' ? '375px' : 'Desktop'}
                        </span>
                      </div>
                    </div>

                    {/* Rendered Drag-and-Drop Blocks */}
                    <div className="p-5 sm:p-7 space-y-6">
                      {activeBuilderMeta.blocks.map((blk) => {
                        /* 1. HERO HEADER ELEMENT */
                        if (blk.type === 'hero_header') {
                          return (
                            <div
                              key={blk.id}
                              className={`space-y-3 border-b pb-5 ${
                                isDarkObsidian ? 'border-slate-800' : 'border-amber-200/80'
                              }`}
                            >
                              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-amber-600">
                                <span>{blk.accentNote || 'Executive Edition'}</span>
                              </div>
                              <h3
                                className={`font-display text-xl sm:text-3xl font-bold leading-tight tracking-tight ${
                                  isDarkObsidian ? 'text-white' : 'text-slate-950'
                                }`}
                              >
                                {blk.title}
                              </h3>
                              <p
                                className={`text-xs sm:text-sm leading-relaxed ${
                                  isDarkObsidian ? 'text-slate-300' : 'text-slate-600'
                                }`}
                              >
                                {blk.content}
                              </p>
                              {blk.ctaButtonLabel && (
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTestSuccess(false);
                                      setPreviewAsset(activeBuilderAsset);
                                    }}
                                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#047857] hover:bg-[#065F46] text-white shadow-xs cursor-pointer"
                                  >
                                    {blk.ctaButtonLabel}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        }

                        /* 2. COUNTDOWN TIMER ELEMENT */
                        if (blk.type === 'countdown_timer') {
                          const hrs = String(blk.timerHours ?? 4).padStart(2, '0');
                          const mins = String(blk.timerMinutes ?? 42).padStart(2, '0');
                          const secs = String(blk.timerSeconds ?? 19).padStart(2, '0');
                          return (
                            <div
                              key={blk.id}
                              className="p-4 rounded-2xl bg-[#0F172A] text-white border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-0.5">
                                <div className="text-[10px] font-mono uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                  <span>{blk.accentNote || 'Urgency Chronometer'}</span>
                                </div>
                                <div className="font-display text-sm font-bold text-white">
                                  {blk.title}
                                </div>
                                <div className="text-[11px] text-slate-300">
                                  {blk.timerLabel || blk.content}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {[
                                  { val: hrs, unit: 'HRS' },
                                  { val: mins, unit: 'MIN' },
                                  { val: secs, unit: 'SEC' },
                                ].map((t, i) => (
                                  <div
                                    key={i}
                                    className="px-3 py-2 rounded-xl bg-slate-900 border border-amber-500/30 text-center min-w-[54px]"
                                  >
                                    <div className="font-mono text-base font-bold text-amber-300">
                                      {t.val}
                                    </div>
                                    <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                                      {t.unit}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        /* 3. VIDEO / VSL PLAYER ELEMENT */
                        if (blk.type === 'video_embed') {
                          return (
                            <div
                              key={blk.id}
                              className={`p-4 rounded-2xl border space-y-3 ${
                                isDarkObsidian
                                  ? 'bg-slate-900/90 border-slate-800'
                                  : 'bg-white border-slate-200 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-600 block">
                                    {blk.accentNote || 'Video Presentation'}
                                  </span>
                                  <h4
                                    className={`font-display text-sm sm:text-base font-bold ${
                                      isDarkObsidian ? 'text-white' : 'text-slate-950'
                                    }`}
                                  >
                                    {blk.title}
                                  </h4>
                                </div>
                                <span className="px-2.5 py-1 rounded-md bg-slate-900 text-amber-300 font-mono text-[11px] shrink-0">
                                  {blk.videoDuration || '14:20'}
                                </span>
                              </div>

                              {blk.videoUrl && blk.videoUrl.startsWith('http') ? (
                                <div className="aspect-video w-full rounded-xl overflow-hidden border border-slate-800 bg-black">
                                  <iframe
                                    src={blk.videoUrl}
                                    title={blk.title}
                                    className="w-full h-full"
                                    allowFullScreen
                                  />
                                </div>
                              ) : (
                                <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-amber-500/30 bg-[#0F172A] group">
                                  <img
                                    src={templateStudioImg}
                                    alt={blk.title}
                                    className="w-full h-full object-cover opacity-70"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent flex flex-col items-center justify-center p-4 text-center">
                                    <div className="w-14 h-14 rounded-full bg-amber-500/90 text-slate-950 flex items-center justify-center shadow-lg mb-2">
                                      <Play className="w-6 h-6 fill-current ml-0.5" />
                                    </div>
                                    <span className="text-xs font-bold text-white">
                                      Click to Watch Key Briefing ({blk.videoDuration || '14:20'})
                                    </span>
                                  </div>
                                </div>
                              )}
                              <p
                                className={`text-xs ${
                                  isDarkObsidian ? 'text-slate-300' : 'text-slate-600'
                                }`}
                              >
                                {blk.content}
                              </p>
                            </div>
                          );
                        }

                        /* 4. PRICING TIERS TABLE ELEMENT */
                        if (blk.type === 'pricing_tiers') {
                          const tiers = blk.pricingTiers || [];
                          return (
                            <div key={blk.id} className="space-y-3">
                              <div>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-600">
                                  {blk.accentNote || 'Enrollment Packages'}
                                </span>
                                <h4
                                  className={`font-display text-base sm:text-lg font-bold ${
                                    isDarkObsidian ? 'text-white' : 'text-slate-950'
                                  }`}
                                >
                                  {blk.title}
                                </h4>
                                <p
                                  className={`text-xs ${
                                    isDarkObsidian ? 'text-slate-300' : 'text-slate-600'
                                  }`}
                                >
                                  {blk.content}
                                </p>
                              </div>

                              <div
                                className={`grid grid-cols-1 ${
                                  viewportMode === 'desktop' && tiers.length > 1
                                    ? 'sm:grid-cols-2'
                                    : 'grid-cols-1'
                                } gap-3`}
                              >
                                {tiers.map((tier, tIdx) => (
                                  <div
                                    key={tIdx}
                                    className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 ${
                                      tier.highlighted
                                        ? 'bg-[#0F172A] text-white border-amber-400 shadow-md'
                                        : isDarkObsidian
                                        ? 'bg-slate-900 text-white border-slate-700'
                                        : 'bg-white text-slate-950 border-slate-200'
                                    }`}
                                  >
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-display text-sm font-bold">
                                          {tier.name}
                                        </span>
                                        {tier.badge && (
                                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 font-mono text-[10px]">
                                            {tier.badge}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-baseline gap-1.5">
                                        <span className="font-display text-2xl font-bold text-emerald-400">
                                          {tier.price}
                                        </span>
                                        <span className="text-[11px] opacity-75">
                                          / {tier.billingPeriod}
                                        </span>
                                      </div>
                                      <ul className="space-y-1.5 pt-1 text-xs">
                                        {(tier.features || []).map((feat, fIdx) => (
                                          <li key={fIdx} className="flex items-start gap-2">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                            <span>{feat}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTestSuccess(false);
                                        setPreviewAsset(activeBuilderAsset);
                                      }}
                                      className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold cursor-pointer ${
                                        tier.highlighted
                                          ? 'bg-[#047857] hover:bg-[#065F46] text-white'
                                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                                      }`}
                                    >
                                      {tier.ctaLabel || 'Select Package'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        /* 5. FAQ ACCORDION ELEMENT */
                        if (blk.type === 'faq_section') {
                          const faqs = blk.faqItems || [];
                          return (
                            <div
                              key={blk.id}
                              className={`p-4 rounded-2xl border space-y-3 ${
                                isDarkObsidian
                                  ? 'bg-slate-900/90 border-slate-800'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <HelpCircle className="w-4 h-4 text-amber-600" />
                                <h4
                                  className={`font-display text-sm sm:text-base font-bold ${
                                    isDarkObsidian ? 'text-white' : 'text-slate-950'
                                  }`}
                                >
                                  {blk.title}
                                </h4>
                              </div>
                              <div className="space-y-2">
                                {faqs.map((fq, fIdx) => (
                                  <div
                                    key={fIdx}
                                    className={`p-3 rounded-xl border ${
                                      isDarkObsidian
                                        ? 'bg-slate-950/70 border-slate-800'
                                        : 'bg-[#FAF8F5] border-slate-200/90'
                                    }`}
                                  >
                                    <div
                                      className={`text-xs font-bold ${
                                        isDarkObsidian ? 'text-amber-300' : 'text-slate-950'
                                      }`}
                                    >
                                      Q: {fq.question}
                                    </div>
                                    <div
                                      className={`text-xs mt-1 leading-relaxed ${
                                        isDarkObsidian ? 'text-slate-300' : 'text-slate-600'
                                      }`}
                                    >
                                      {fq.answer}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        /* 6. SOCIAL PROOF / TESTIMONIALS ELEMENT */
                        if (blk.type === 'social_proof') {
                          return (
                            <div
                              key={blk.id}
                              className={`p-4 rounded-2xl border space-y-2.5 ${
                                isDarkObsidian
                                  ? 'bg-slate-900/90 border-slate-800'
                                  : 'bg-white border-amber-200/90'
                              }`}
                            >
                              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-600">
                                ★★★★★ {blk.accentNote || 'Verified Executive Endorsements'}
                              </div>
                              <div
                                className={`font-display text-sm font-bold ${
                                  isDarkObsidian ? 'text-white' : 'text-slate-950'
                                }`}
                              >
                                {blk.title}
                              </div>
                              <div className="space-y-2 pt-1">
                                {(blk.items || [blk.content]).map((quote, qIdx) => (
                                  <div
                                    key={qIdx}
                                    className={`p-3 rounded-xl border text-xs italic ${
                                      isDarkObsidian
                                        ? 'bg-slate-950 border-slate-800 text-slate-300'
                                        : 'bg-[#FAF8F5] border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {quote}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        /* 7. VALUE BULLETS / LEAD MAGNET / THANK YOU CARD */
                        if (
                          blk.type === 'value_bullets' ||
                          blk.type === 'lead_magnet_card' ||
                          blk.type === 'thank_you_card'
                        ) {
                          return (
                            <div
                              key={blk.id}
                              className={`p-4 rounded-2xl border space-y-2 ${
                                isDarkObsidian
                                  ? 'bg-slate-900/90 border-slate-800'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div
                                className={`font-display text-sm font-bold ${
                                  isDarkObsidian ? 'text-white' : 'text-slate-950'
                                }`}
                              >
                                {blk.title}
                              </div>
                              <p
                                className={`text-xs ${
                                  isDarkObsidian ? 'text-slate-300' : 'text-slate-600'
                                }`}
                              >
                                {blk.content}
                              </p>
                              {blk.items && (
                                <ul
                                  className={`space-y-1.5 pt-1 text-xs ${
                                    isDarkObsidian ? 'text-slate-200' : 'text-slate-800'
                                  }`}
                                >
                                  {blk.items.map((it, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                      <span>{it}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        }

                        /* 8. LINK IN BIO STACK */
                        if (blk.type === 'link_in_bio_stack') {
                          return (
                            <div key={blk.id} className="space-y-2">
                              <div
                                className={`text-xs font-bold ${
                                  isDarkObsidian ? 'text-white' : 'text-slate-800'
                                }`}
                              >
                                {blk.title}
                              </div>
                              {(blk.items || []).map((linkLabel, idx) => (
                                <div
                                  key={idx}
                                  className="w-full p-3 rounded-xl bg-[#0F172A] border border-amber-500/30 text-white text-xs font-bold flex items-center justify-between"
                                >
                                  <span>{linkLabel}</span>
                                  <span className="text-amber-300">→</span>
                                </div>
                              ))}
                            </div>
                          );
                        }

                        /* 9. OPT-IN / LEAD CAPTURE FORM ELEMENT */
                        if (blk.type === 'capture_form') {
                          return (
                            <div
                              key={blk.id}
                              className={`p-5 rounded-2xl border-2 space-y-3.5 shadow-sm ${
                                isDarkObsidian
                                  ? 'bg-slate-900 border-emerald-500/60 text-white'
                                  : 'bg-white border-emerald-700/40 text-slate-950'
                              }`}
                            >
                              <div>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600">
                                  {blk.accentNote || 'Instant CRM & Multi-Channel Automation Sync'}
                                </span>
                                <div className="font-display text-base font-bold mt-0.5">
                                  {blk.title}
                                </div>
                                {blk.content && (
                                  <p
                                    className={`text-xs mt-0.5 ${
                                      isDarkObsidian ? 'text-slate-300' : 'text-slate-600'
                                    }`}
                                  >
                                    {blk.content}
                                  </p>
                                )}
                              </div>
                              <div className="space-y-2.5 text-xs">
                                {activeBuilderMeta.formFields.map((fld) => (
                                  <div key={fld.id}>
                                    <label
                                      className={`block font-semibold mb-1 ${
                                        isDarkObsidian ? 'text-slate-200' : 'text-slate-700'
                                      }`}
                                    >
                                      {fld.label} {fld.required ? '*' : ''}
                                    </label>
                                    {fld.inputType === 'select' ? (
                                      <select
                                        className={`w-full px-3 py-2 border rounded-lg ${
                                          isDarkObsidian
                                            ? 'bg-slate-950 border-slate-700 text-white'
                                            : 'bg-[#F8FAFC] border-slate-300 text-slate-900'
                                        }`}
                                      >
                                        {(fld.options || ['Option 1', 'Option 2']).map((opt, i) => (
                                          <option key={i}>{opt}</option>
                                        ))}
                                      </select>
                                    ) : fld.inputType === 'textarea' ? (
                                      <textarea
                                        rows={2}
                                        placeholder={fld.placeholder}
                                        readOnly
                                        className={`w-full px-3 py-2 border rounded-lg ${
                                          isDarkObsidian
                                            ? 'bg-slate-950 border-slate-700 text-white'
                                            : 'bg-[#F8FAFC] border-slate-300 text-slate-900'
                                        }`}
                                      />
                                    ) : (
                                      <input
                                        type={fld.inputType}
                                        placeholder={fld.placeholder}
                                        readOnly
                                        className={`w-full px-3 py-2 border rounded-lg ${
                                          isDarkObsidian
                                            ? 'bg-slate-950 border-slate-700 text-white'
                                            : 'bg-[#F8FAFC] border-slate-300 text-slate-900'
                                        }`}
                                      />
                                    )}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTestSuccess(false);
                                    setPreviewAsset(activeBuilderAsset);
                                  }}
                                  className="w-full py-3 px-4 text-xs sm:text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer shadow-xs"
                                >
                                  {activeBuilderAsset.ctaText}
                                </button>
                              </div>
                              <div className="text-[11px] opacity-75 flex flex-wrap items-center justify-between gap-1 pt-1">
                                <span>Routes to List: {activeBuilderAsset.targetList}</span>
                                <span>Tags: #{activeBuilderMeta.submissionTags.join(' #')}</span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={blk.id}
                            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 italic"
                          >
                            {blk.content}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: POPUPS, EMBEDDED FORMS & SHAREABLE PUBLIC URLS
         ===================================================================== */}
      {activeStudioTab === 'embed_popups' && activeBuilderAsset && activeBuilderMeta && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-6 border border-slate-200 rounded-2xl bg-white p-5 space-y-4 shadow-xs">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Website Widget & Popup Configuration
              </div>
              <h3 className="font-display text-base sm:text-lg font-bold text-slate-950">
                Popup Behaviour & Embedded Form Script
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Embed any opt-in, contact, or survey form on external sites or trigger as a
                compliant popup modal.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Asset to Embed</label>
                <select
                  value={activeBuilderAsset.id}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg font-bold"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} (/p/{a.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Display & Trigger Rule
                </label>
                <select
                  value={activeBuilderMeta.popupTrigger}
                  onChange={(e) =>
                    saveExtendedMeta(activeBuilderAsset.slug, {
                      ...activeBuilderMeta,
                      popupTrigger:
                        e.target.value as LeadGenAssetExtendedMetadata['popupTrigger'],
                    })
                  }
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="inline_embed">Inline Embedded Form (Responsive Iframe/DOM)</option>
                  <option value="exit_intent">Exit-Intent Popup Modal (Once per session)</option>
                  <option value="scroll_50">Scroll-Depth Trigger (50% Page Scroll)</option>
                  <option value="delay_5s">Timed Welcome Popup (After 5 Seconds)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Shareable Direct Public Link
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getShareablePublicUrl(activeBuilderAsset.slug)}
                    className="flex-1 min-w-[200px] px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyShareLink(activeBuilderAsset)}
                    className="px-3.5 py-2 font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedSlug === activeBuilderAsset.slug ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNativeShareAsset(activeBuilderAsset)}
                    className="px-3.5 py-2 font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Share</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(activeBuilderAsset)}
                    className="px-3.5 py-2 font-bold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 border border-slate-200 rounded-2xl bg-white p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-slate-950">
                Copy-Paste HTML Form &amp; Iframe Embed Snippet
              </h3>
              <button
                type="button"
                onClick={() => {
                  const originUrl =
                    typeof window !== 'undefined' && window.location?.origin
                      ? window.location.origin
                      : `https://${activeBuilderMeta.customDomain}`;
                  const snippet = `<!-- FlowPilot Direct Webhook Form (${activeBuilderAsset.title}) -->
<form action="${originUrl}/api/leads/capture" method="POST" style="max-width:480px;font-family:sans-serif;">
  <input type="hidden" name="assetSlug" value="${activeBuilderAsset.slug}" />
  <input type="hidden" name="targetList" value="${activeBuilderAsset.targetList}" />
  <input type="hidden" name="tags" value="${activeBuilderMeta.submissionTags.join(',')}" />
  <input type="hidden" name="redirectUrl" value="${activeBuilderAsset.redirectUrl || ''}" />
  <input type="text" name="fullName" placeholder="Full Name" required style="width:100%;padding:10px;margin-bottom:8px;" />
  <input type="email" name="email" placeholder="Email Address" required style="width:100%;padding:10px;margin-bottom:8px;" />
  <input type="tel" name="phone" placeholder="WhatsApp / Mobile Number" style="width:100%;padding:10px;margin-bottom:12px;" />
  <button type="submit" style="width:100%;padding:12px;background:#047857;color:#fff;border:0;border-radius:8px;font-weight:bold;">${activeBuilderAsset.ctaText}</button>
</form>
<!-- Or Responsive Iframe Embed -->
<iframe src="${originUrl}/?capture=${activeBuilderAsset.slug}" width="100%" height="520" style="border:0;border-radius:16px;" loading="lazy"></iframe>`;
                  navigator.clipboard?.writeText(snippet);
                  setStatusBanner('Copied live HTML POST form & iframe embed snippet to clipboard.');
                }}
                className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer"
              >
                Copy Embed Code
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-[#0F172A] text-emerald-300 font-mono text-[11px] overflow-x-auto leading-relaxed">
{`<!-- FlowPilot Direct Webhook Form (${activeBuilderAsset.title}) -->
<form action="${
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : `https://${activeBuilderMeta.customDomain}`
}/api/leads/capture" method="POST">
  <input type="hidden" name="assetSlug" value="${activeBuilderAsset.slug}" />
  <input type="hidden" name="targetList" value="${activeBuilderAsset.targetList}" />
  <input type="hidden" name="tags" value="${activeBuilderMeta.submissionTags.join(',')}" />
  <input type="hidden" name="redirectUrl" value="${activeBuilderAsset.redirectUrl || ''}" />
  <input type="text" name="fullName" placeholder="Full Name" required />
  <input type="email" name="email" placeholder="Email Address" required />
  <input type="tel" name="phone" placeholder="WhatsApp / Mobile Number" />
  <button type="submit">${activeBuilderAsset.ctaText}</button>
</form>

<!-- Or Standalone Shareable / Iframe Embed -->
<iframe
  src="${
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : `https://${activeBuilderMeta.customDomain}`
  }/?capture=${activeBuilderAsset.slug}"
  width="100%"
  height="520"
  style="border:none;border-radius:16px;max-width:640px;"
  title="${activeBuilderAsset.title}">
</iframe>`}
            </pre>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: CUSTOM DOMAIN SUPPORT & DNS ROUTING
         ===================================================================== */}
      {activeStudioTab === 'custom_domains' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 border border-slate-200 rounded-2xl bg-white p-5 space-y-4 shadow-xs">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Custom Domain Hosting Architecture
              </div>
              <h3 className="font-display text-base font-bold text-slate-950">
                Connect Custom Subdomain or Brand Domain
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Point a CNAME record to `edge.flowpilot-hosting.app` to serve landing pages,
                link-in-bio hubs, and lead magnets on your own branded domain.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newDomainInput.trim()) return;
                const cleanDom = newDomainInput
                  .trim()
                  .toLowerCase()
                  .replace(/^https?:\/\//, '')
                  .replace(/\/.*$/, '');
                const added: CustomDomainConfig = {
                  id: `dom_${Date.now()}`,
                  domain: cleanDom,
                  mappedSlug: newDomainSlug,
                  cnameTarget: 'edge.flowpilot-hosting.app',
                  txtVerification: `fp-verify=${Math.random().toString(16).slice(2, 14)}`,
                  sslStatus: 'Active (Let’s Encrypt TLS 1.3)',
                  status: 'verified',
                  lastChecked: 'Verified just now',
                };
                setCustomDomains((prev) => [added, ...prev]);
                setNewDomainInput('');
                setStatusBanner(`Connected and verified custom domain "${cleanDom}".`);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Custom Domain or Subdomain *
                </label>
                <input
                  type="text"
                  required
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  placeholder="pages.yourbrand.com or links.yourbrand.io"
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Default Root Page Slug
                </label>
                <select
                  value={newDomainSlug}
                  onChange={(e) => setNewDomainSlug(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg font-mono"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.slug}>
                      /p/{a.slug} ({a.title})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer"
              >
                Verify DNS & Connect Custom Domain
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 border border-slate-200 rounded-2xl bg-white p-5 space-y-3.5 shadow-xs">
            <h3 className="font-display text-base font-bold text-slate-950">
              Connected Custom Domains & CNAME Records ({customDomains.length})
            </h3>
            <div className="space-y-3">
              {customDomains.map((dom) => (
                <div
                  key={dom.id}
                  className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-slate-950">
                      https://{dom.domain}
                    </span>
                    <span className="font-bold text-emerald-700 uppercase">
                      {dom.status} · {dom.sslStatus}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-600">
                    CNAME → {dom.cnameTarget} · TXT → {dom.txtVerification}
                  </div>
                  <div className="text-slate-500">
                    Root Page Mapping: <span className="font-mono">/p/{dom.mappedSlug}</span> ·{' '}
                    {dom.lastChecked}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          INTERACTIVE LIVE PREVIEW & TEST LEAD CAPTURE MODAL (WITH CUSTOM FIELDS & REDIRECT)
         ===================================================================== */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`bg-white border border-slate-200 rounded-2xl w-full overflow-hidden shadow-xl my-8 transition-all ${
              previewViewport === 'mobile' ? 'max-w-[390px]' : 'max-w-xl'
            }`}
          >
            <div className="bg-[#0F172A] text-white px-4 py-3 flex items-center justify-between text-xs gap-2">
              <span className="font-mono font-bold truncate">
                https://{getExtendedForAsset(previewAsset).customDomain}/p/{previewAsset.slug}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewViewport((v) => (v === 'desktop' ? 'mobile' : 'desktop'))
                  }
                  className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 rounded-md cursor-pointer"
                >
                  {previewViewport === 'desktop' ? 'Mobile View' : 'Desktop View'}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewAsset(null)}
                  className="text-slate-400 hover:text-white cursor-pointer ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {(() => {
                const meta = getExtendedForAsset(previewAsset);
                return (
                  <>
                    <div className="space-y-1.5">
                      <div className="text-xs text-slate-500">
                        <span className="font-bold text-emerald-700 uppercase">
                          {meta.toolFormat.replace(/_/g, ' ')}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>Assigned List: {previewAsset.targetList}</span>
                      </div>
                      <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950">
                        {previewAsset.headline}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {previewAsset.subheadline}
                      </p>
                    </div>

                    {/* If Link-in-Bio, render interactive bio links above form */}
                    {meta.toolFormat === 'link_in_bio' && (
                      <div className="space-y-2">
                        {meta.bioLinks.map((lnk, i) => (
                          <a
                            key={i}
                            href={lnk.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => {
                              e.preventDefault();
                              setStatusBanner(
                                `Link-in-Bio click recorded ("${lnk.label}") · Tag #${lnk.tagOnClick} ready.`
                              );
                            }}
                            className="w-full p-3 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-between cursor-pointer"
                          >
                            <span>{lnk.label}</span>
                            <span>→</span>
                          </a>
                        ))}
                      </div>
                    )}

                    {testSuccess ? (
                      <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                        <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          <span>
                            Contact &ldquo;{lastCapturedLeadName}&rdquo; Saved to List &ldquo;
                            {previewAsset.targetList}&rdquo;!
                          </span>
                        </div>
                        <div className="text-xs text-emerald-900 space-y-1.5">
                          <p>
                            <strong>1. Tags Applied on Submission:</strong>{' '}
                            <span className="font-mono">
                              #{meta.submissionTags.join(' #')}
                            </span>
                          </p>
                          <p>
                            <strong>2. CTA Button Redirect Link:</strong>{' '}
                            <span className="font-mono underline">{meta.redirectUrl}</span>
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {meta.redirectUrl && (
                            <a
                              href={meta.redirectUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-4 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>Open CTA Redirect Link</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setPreviewAsset(null)}
                            className="px-4 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
                          >
                            Done
                          </button>
                          {onNavigateToLists && (
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewAsset(null);
                                onNavigateToLists();
                              }}
                              className="px-4 py-2 text-xs font-bold text-[#0F172A] bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                              View Contact in &ldquo;{previewAsset.targetList}&rdquo; →
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleTestLeadSubmit} className="space-y-3 text-xs">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                          <input
                            type="text"
                            required
                            value={testName}
                            onChange={(e) => setTestName(e.target.value)}
                            placeholder="Enter full name"
                            className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Email Address *
                          </label>
                          <input
                            type="email"
                            required
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            placeholder="you@domain.com"
                            className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Phone / WhatsApp Number *
                          </label>
                          <input
                            type="tel"
                            required
                            value={testPhone}
                            onChange={(e) => setTestPhone(e.target.value)}
                            placeholder="+1 (555) 019-2831 (Phone / WhatsApp)"
                            className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                          />
                        </div>

                        {/* Render Custom & Survey Fields Dynamically */}
                        {meta.formFields
                          .filter((f) => f.isCustomField || f.fieldKey === 'company')
                          .map((fld) => (
                            <div key={fld.id}>
                              <label className="block font-bold text-slate-700 mb-1">
                                {fld.label} {fld.required ? '*' : ''}
                              </label>
                              {fld.fieldKey === 'company' ? (
                                <input
                                  type="text"
                                  value={testCompany}
                                  onChange={(e) => setTestCompany(e.target.value)}
                                  placeholder={fld.placeholder}
                                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                                />
                              ) : fld.inputType === 'select' ? (
                                <select
                                  value={testCustomValues[fld.fieldKey] || ''}
                                  onChange={(e) =>
                                    setTestCustomValues((prev) => ({
                                      ...prev,
                                      [fld.fieldKey]: e.target.value,
                                    }))
                                  }
                                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl bg-white"
                                >
                                  <option value="">-- Select option --</option>
                                  {(fld.options || []).map((opt, idx) => (
                                    <option key={idx} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  required={fld.required}
                                  value={testCustomValues[fld.fieldKey] || ''}
                                  onChange={(e) =>
                                    setTestCustomValues((prev) => ({
                                      ...prev,
                                      [fld.fieldKey]: e.target.value,
                                    }))
                                  }
                                  placeholder={fld.placeholder}
                                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                                />
                              )}
                            </div>
                          ))}

                        <button
                          type="submit"
                          className="w-full py-3 px-4 text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors cursor-pointer"
                        >
                          {previewAsset.ctaText}
                        </button>
                      </form>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          CREATE PAGE / FORM / SURVEY / BIO / LEAD MAGNET MODAL
         ===================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  {editingAsset
                    ? 'Edit Lead Capture Page & Redirect Settings'
                    : 'No-Code Lead Generation Builder (All 9 Formats)'}
                </span>
                <h3 className="font-display text-xl font-bold text-[#0F172A]">
                  {editingAsset
                    ? `Edit "${editingAsset.title}"`
                    : 'Create Page, Form, Survey, Link-in-Bio or Lead Magnet'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingAsset(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              {/* CREATION MODE SELECTOR: BUILD FROM TOTAL SCRATCH VS READY-MADE TEMPLATE */}
              {!editingAsset && (
                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-amber-300/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
                        Creation Mode · Scratch or Ready-Made Template
                      </span>
                      <p className="text-xs text-slate-600">
                        Start with a blank canvas and pick your own elements, or load a ready-made
                        template to edit.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl shrink-0">
                      <button
                        type="button"
                        onClick={() => setBuilderStartMode('from_scratch')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                          builderStartMode === 'from_scratch'
                            ? 'bg-[#0F172A] text-amber-300'
                            : 'text-slate-600'
                        }`}
                      >
                        Build From Total Scratch
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBuilderStartMode('ready_template');
                          if (!selectedReadyTemplateId && READY_MADE_PAGE_TEMPLATES[0]) {
                            handleSelectModalReadyTemplate(READY_MADE_PAGE_TEMPLATES[0]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                          builderStartMode === 'ready_template'
                            ? 'bg-[#047857] text-white'
                            : 'text-slate-600'
                        }`}
                      >
                        Ready-Made Template
                      </button>
                    </div>
                  </div>

                  {builderStartMode === 'from_scratch' ? (
                    <div className="space-y-2 pt-1">
                      <div className="font-bold text-slate-800">
                        Select Elements to Include on Your Blank Canvas (Click to toggle):
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {ELEMENT_PALETTE_CATALOG.map((el) => {
                          const checked = scratchSelectedElements.includes(el.type);
                          return (
                            <button
                              key={el.type}
                              type="button"
                              onClick={() =>
                                setScratchSelectedElements((prev) =>
                                  prev.includes(el.type)
                                    ? prev.filter((item) => item !== el.type)
                                    : [...prev, el.type]
                                )
                              }
                              className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                                checked
                                  ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-bold'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate">{el.label}</span>
                                <span>{checked ? '✓' : '+'}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <div className="font-bold text-slate-800">
                        Choose a Ready-Made Editable Template to Load &amp; Customize:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {READY_MADE_PAGE_TEMPLATES.map((tpl) => {
                          const isSelected = selectedReadyTemplateId === tpl.id;
                          return (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => handleSelectModalReadyTemplate(tpl)}
                              className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-50 border-2 border-emerald-700 text-slate-950'
                                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs">{tpl.name}</span>
                                <span className="text-[10px] font-mono text-amber-800">
                                  {tpl.blocks.length} Elements
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                {tpl.summary}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 1: SELECT CREATED CONTACT LIST */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-600/30 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                      Step 1 · Select Destination Contact List *
                    </span>
                    <p className="text-xs text-slate-600">
                      Captured leads store directly in this list and trigger its linked workflows.
                    </p>
                  </div>
                  {onCreateList && (
                    <button
                      type="button"
                      onClick={() => setShowInlineListCreator((prev) => !prev)}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-[#0F172A] rounded-xl cursor-pointer"
                    >
                      {showInlineListCreator ? 'Cancel' : '+ New List'}
                    </button>
                  )}
                </div>

                {showInlineListCreator && onCreateList && (
                  <div className="p-3 rounded-xl bg-white border border-emerald-300 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="New list name (e.g. Survey Qualified Leads)"
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      disabled={!newListName.trim() || isCreatingInlineList}
                      onClick={handleQuickCreateList}
                      className="px-3.5 py-1.5 font-bold text-white bg-emerald-700 rounded-lg cursor-pointer"
                    >
                      Save &amp; Select
                    </button>
                  </div>
                )}

                <select
                  required
                  value={targetList}
                  onChange={(e) => setTargetList(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm font-bold bg-white border border-slate-300 rounded-xl text-[#0F172A]"
                >
                  {allAvailableLists.map((lst) => (
                    <option key={lst.id} value={lst.name}>
                      {lst.name} ({getContactsCountForList(lst.name)} contacts ·{' '}
                      {getAutomationsForList(lst.name).length} automations)
                    </option>
                  ))}
                </select>
              </div>

              {/* STEP 2: SELECT FROM ALL 9 LEAD GEN TOOL FORMATS */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Step 2 · Choose No-Code Tool Format (9 Types)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {LEAD_GEN_TOOL_FORMATS.map((fmt) => {
                    const active = selectedToolFormat === fmt.id;
                    return (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => handleSelectModalToolFormat(fmt.id)}
                        className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-2 border-emerald-700 bg-emerald-50/50 font-bold text-slate-950'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{fmt.shortLabel}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {fmt.categoryBadge}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Asset Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="2026 Creator Growth Squeeze Page"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Shareable Public URL Slug
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="creator-growth-blueprint"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Headline *</label>
                  <input
                    type="text"
                    required
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">CTA Button Text *</label>
                  <input
                    type="text"
                    required
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Subheadline & Value Copy
                </label>
                <textarea
                  rows={2}
                  value={subheadline}
                  onChange={(e) => setSubheadline(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              {/* DEDICATED CTA BUTTON REDIRECT LINK BOX FOR ALL 9 LEAD CAPTURE TYPES */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-300 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-emerald-700" />
                    <span>CTA Button Redirect Link / Destination URL *</span>
                  </label>
                  <span className="text-[11px] text-emerald-800 font-semibold">
                    Applies to any of the 9 lead capture formats
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={modalRedirectUrl}
                  onChange={(e) => setModalRedirectUrl(e.target.value)}
                  placeholder="https://yourwebsite.com/thank-you or https://wa.me/15550192831"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] text-slate-500">Quick presets:</span>
                  {[
                    ['Thank-You URL', 'https://flowpilot.app/thank-you'],
                    ['WhatsApp Chat', 'https://wa.me/18445550199'],
                    ['Booking Calendar', 'https://flowpilot.app/book-strategy-call'],
                    ['PDF Resource', 'https://flowpilot.app/assets/growth-kit.pdf'],
                  ].map(([label, presetUrl]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setModalRedirectUrl(presetUrl)}
                      className="px-2 py-1 text-[11px] font-semibold bg-white hover:bg-emerald-50 text-slate-700 border border-slate-200 rounded-md cursor-pointer"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tags on Submission (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={modalTagsInput}
                    onChange={(e) => setModalTagsInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Post-Submission Redirect Mode
                  </label>
                  <select
                    value={modalRedirectMode}
                    onChange={(e) =>
                      setModalRedirectMode(
                        e.target.value as LeadGenAssetExtendedMetadata['redirectMode']
                      )
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
                  >
                    <option value="custom_url">Redirect to CTA Link Immediately</option>
                    <option value="thank_you_page">Redirect to Thank-You Page Link</option>
                    <option value="inline_thank_you">
                      Show Confirmation + CTA Redirect Button
                    </option>
                    <option value="lead_magnet_download">Instant Lead Magnet Download</option>
                  </select>
                </div>
              </div>

              {/* Live Shareable Link Preview Inside Modal */}
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="truncate">
                  <span className="text-[11px] font-bold text-emerald-950 block">
                    Shareable Link Generated on Save:
                  </span>
                  <span className="font-mono text-[11px] text-emerald-800 truncate">
                    {getShareablePublicUrl(
                      slug ||
                        title
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-|-$/g, '') ||
                        'lead-capture'
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingAsset(null);
                  }}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {isSaving
                    ? 'Saving...'
                    : editingAsset
                    ? 'Save Changes & Update Link'
                    : 'Publish & Get Shareable Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
