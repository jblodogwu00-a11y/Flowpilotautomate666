import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Users,
  UserPlus,
  Download,
  Trash2,
  Edit3,
  Search,
  Mail,
  Phone,
  Building2,
  Tag,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowLeft,
  FolderPlus,
  Sparkles,
  X,
  Flame,
  GitBranch,
  FileText,
  Send,
   Zap,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  AudienceList,
  ListCategory,
  ListColorAccent,
  Contact,
  ContactStage,
  LeadTemperature,
  ConsentStatus,
  CurrencyCode,
  CsvImportOptions,
  CsvImportResultSummary,
  formatCurrency,
  sanitizeString,
  sanitizeStringArray,
} from '../types';
import { evaluateListKillSwitchForContact } from './AutomationEngineCatalog';

interface ListsViewProps {
  lists: AudienceList[];
  contacts: Contact[];
  currency: CurrencyCode;
  onCreateList: (
    data: Omit<AudienceList, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateList: (
    id: string,
    data: Omit<AudienceList, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onDeleteList: (id: string) => Promise<void>;
  onCreateContact: (
    data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateContact: (
    id: string,
    data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onDeleteContact: (id: string) => Promise<void>;
  onBulkImportContacts?: (
    contacts: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>[],
    options?: CsvImportOptions
  ) => Promise<CsvImportResultSummary | void>;
  onCreateAutomationForList?: (listName: string) => void;
  onCreateAutoResponderForList?: (listName: string) => void;
  onCreateFormForList?: (listName: string) => void;
  onSendBroadcastToList?: (listName: string) => void;
}

export const ListsView: React.FC<ListsViewProps> = ({
  lists,
  contacts,
  currency,
  onCreateList,
  onUpdateList,
  onDeleteList,
  onCreateContact,
  onUpdateContact,
  onDeleteContact,
  onBulkImportContacts,
  onCreateAutomationForList,
  onCreateAutoResponderForList,
  onCreateFormForList,
  onSendBroadcastToList,
}) => {
  // Currently opened list for storing & managing contacts inside it
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Create / Edit List Modal state
  const [listModalOpen, setListModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<AudienceList | null>(null);
  const [listName, setListName] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [listCategory, setListCategory] = useState<ListCategory>('newsletter');
  const [listDefaultConsent, setListDefaultConsent] =
    useState<ConsentStatus>('opted_in');
  const [listDefaultTags, setListDefaultTags] = useState('');
  const [listColorAccent, setListColorAccent] = useState<ListColorAccent>('emerald');
  const [listKillSwitchEnabled, setListKillSwitchEnabled] = useState<boolean>(true);
  const [listKillSwitchTags, setListKillSwitchTags] = useState<string>('Purchased_Course');
  const [savingList, setSavingList] = useState(false);

  // Inline List Kill Switch Quick-Editor & Buyer CSV Modal inside Active List
  const [inlineKillSwitchInput, setInlineKillSwitchInput] = useState<string>('Purchased_Course');
  const [listCsvModalOpen, setListCsvModalOpen] = useState<boolean>(false);
  const [listCsvRawText, setListCsvRawText] = useState<string>('');
  const [listCsvTagToApply, setListCsvTagToApply] = useState<string>('Purchased_Course');
  const [listCsvImporting, setListCsvImporting] = useState<boolean>(false);

  // Store New Contact inside Active List state
  const [storeContactOpen, setStoreContactOpen] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [dealTitle, setDealTitle] = useState('');
  const [stage, setStage] = useState<ContactStage>('warm_lead');
  const [temperature, setTemperature] = useState<LeadTemperature>('hot');
  const [ltv, setLtv] = useState('0');
  const [extraTags, setExtraTags] = useState('');
  const [notes, setNotes] = useState('');
  const [storingContact, setStoringContact] = useState(false);
  const [storedBanner, setStoredBanner] = useState<string | null>(null);

  // Assign Existing CRM Contact to Active List state
  const [selectedExistingContactId, setSelectedExistingContactId] = useState('');

  // Merge explicit `lists` with any implicit `listName` on contacts so no list is ever orphaned
  const allCombinedLists = useMemo(() => {
    const explicitNames = new Set(lists.map((l) => l.name.toLowerCase()));
    const virtualLists: AudienceList[] = [];
    contacts.forEach((c) => {
      if (c.listName && !explicitNames.has(c.listName.toLowerCase())) {
        explicitNames.add(c.listName.toLowerCase());
        virtualLists.push({
          id: `virtual_${c.listName}`,
          workspaceId: c.workspaceId,
          ownerId: c.ownerId,
          name: c.listName,
          description: `Contacts dynamically grouped under "${c.listName}".`,
          category: 'custom',
          defaultConsent: 'opted_in',
          defaultTags: ['segmented'],
          colorAccent: 'emerald',
          killSwitchEnabled: true,
          killSwitchTags: ['Purchased_Course'],
        });
      }
    });
    return [...lists, ...virtualLists];
  }, [lists, contacts]);

  const activeList = useMemo(
    () => allCombinedLists.find((l) => l.id === activeListId) || null,
    [allCombinedLists, activeListId]
  );

  // Contacts stored inside the currently active list
  const activeListContacts = useMemo(() => {
    if (!activeList) return [];
    const q = searchQuery.toLowerCase().trim();
    return contacts.filter((c) => {
      const inList =
        c.listName.trim().toLowerCase() === activeList.name.trim().toLowerCase();
      if (!inList) return false;
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [activeList, contacts, searchQuery]);

  // Contacts NOT in the currently active list (available to assign with 1 click)
  const contactsOutsideActiveList = useMemo(() => {
    if (!activeList) return [];
    return contacts.filter(
      (c) => c.listName.trim().toLowerCase() !== activeList.name.trim().toLowerCase()
    );
  }, [activeList, contacts]);

  const handleOpenCreateList = () => {
    setEditingList(null);
    setListName('');
    setListDescription('');
    setListCategory('newsletter');
    setListDefaultConsent('opted_in');
    setListDefaultTags('');
    setListColorAccent('emerald');
    setListKillSwitchEnabled(true);
    setListKillSwitchTags('Purchased_Course');
    setListModalOpen(true);
  };

  const handleOpenEditList = (lst: AudienceList) => {
    setEditingList(lst);
    setListName(lst.name);
    setListDescription(lst.description);
    setListCategory(lst.category);
    setListDefaultConsent(lst.defaultConsent);
    setListDefaultTags((lst.defaultTags || []).join(', '));
    setListColorAccent(lst.colorAccent || 'emerald');
    setListKillSwitchEnabled(lst.killSwitchEnabled !== false);
    setListKillSwitchTags(
      (lst.killSwitchTags && lst.killSwitchTags.length > 0
        ? lst.killSwitchTags
        : ['Purchased_Course']
      ).join(', ')
    );
    setListModalOpen(true);
  };

  const handleSaveListSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listName.trim()) return;
    setSavingList(true);
    try {
      const parsedKillSwitchTags = sanitizeStringArray(
        listKillSwitchTags.split(','),
        10,
        32
      );
      const payload: Omit<
        AudienceList,
        'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'
      > = {
        name: sanitizeString(listName, 100, 'New Audience List'),
        description: sanitizeString(
          listDescription,
          300,
          'Dedicated contact list for targeted broadcasts and automations.'
        ),
        category: listCategory,
        defaultConsent: listDefaultConsent,
        defaultTags: sanitizeStringArray(listDefaultTags.split(','), 10, 32),
        colorAccent: listColorAccent,
        killSwitchEnabled: listKillSwitchEnabled,
        killSwitchTags:
          parsedKillSwitchTags.length > 0 ? parsedKillSwitchTags : ['Purchased_Course'],
      };

      if (editingList && !editingList.id.startsWith('virtual_')) {
        await onUpdateList(editingList.id, payload);
      } else {
        await onCreateList(payload);
      }
      setListModalOpen(false);
    } finally {
      setSavingList(false);
    }
  };

  // Toggle or update Kill Switch tags on an active list
  const handleSaveActiveListKillSwitch = async (
    nextEnabled: boolean,
    rawTagsInput: string
  ) => {
    if (!activeList) return;
    const parsedKsTags = sanitizeStringArray(rawTagsInput.split(','), 10, 32);
    const finalKsTags =
      parsedKsTags.length > 0 ? parsedKsTags : ['Purchased_Course'];
    const payload: Omit<
      AudienceList,
      'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'
    > = {
      name: activeList.name,
      description: activeList.description,
      category: activeList.category,
      defaultConsent: activeList.defaultConsent,
      defaultTags: activeList.defaultTags || [],
      colorAccent: activeList.colorAccent || 'emerald',
      killSwitchEnabled: nextEnabled,
      killSwitchTags: finalKsTags,
    };

    if (!activeList.id.startsWith('virtual_')) {
      await onUpdateList(activeList.id, payload);
    } else {
      await onCreateList(payload);
    }
    setStoredBanner(
      nextEnabled
        ? `List Kill Switch updated for "${activeList.name}": When any contact matches tag [${finalKsTags.join(
            ', '
          )}], automation will immediately stop for that contact.`
        : `List Kill Switch paused for "${activeList.name}".`
    );
    setTimeout(() => setStoredBanner(null), 4500);
  };

  // Toggle Kill Switch tag on a specific contact inside the list (stops or resumes automation for that contact)
  const handleToggleContactKillSwitchTag = async (
    contact: Contact,
    primaryKillTag: string,
    isCurrentlyStopped: boolean,
    matchedTagToRemove?: string
  ) => {
    const cleanKillTag = (primaryKillTag || 'Purchased_Course').trim().slice(0, 32);
    const nextTags = isCurrentlyStopped
      ? (contact.tags || []).filter(
          (t) =>
            t.trim().toLowerCase() !== (matchedTagToRemove || cleanKillTag).toLowerCase()
        )
      : Array.from(new Set([...(contact.tags || []), cleanKillTag])).slice(0, 10);

    await onUpdateContact(contact.id, {
      fullName: contact.fullName,
      email: contact.email,
      phone: contact.phone,
      company: contact.company || '',
      dealTitle: contact.dealTitle || '',
      stage: isCurrentlyStopped ? contact.stage : 'customer',
      temperature: contact.temperature,
      source: contact.source,
      consentStatus: contact.consentStatus,
      commChannels: contact.commChannels || ['email', 'whatsapp'],
      listName: contact.listName,
      tags: nextTags,
      ltv: contact.ltv || 0,
      notes: contact.notes || '',
      customFields: contact.customFields || [],
    });

    setStoredBanner(
      isCurrentlyStopped
        ? `Removed Kill Switch tag #${matchedTagToRemove || cleanKillTag} from ${contact.fullName} — Automation resumed for this contact.`
        : `Applied Kill Switch tag #${cleanKillTag} to ${contact.fullName} — Automation immediately stopped for this contact!`
    );
    setTimeout(() => setStoredBanner(null), 4500);
  };

  // Store a brand new contact directly inside the Active List
  const handleStoreNewContactInList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList || !fullName.trim() || !email.trim()) return;
    setStoringContact(true);
    try {
      const mergedTags = sanitizeStringArray(
        [
          ...(activeList.defaultTags || []),
          ...extraTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        ],
        10,
        32
      );

      await onCreateContact({
        fullName: sanitizeString(fullName, 100, 'Unnamed Contact'),
        email: sanitizeString(email, 150, 'contact@example.com'),
        phone: sanitizeString(phone, 32, ''),
        company: sanitizeString(company, 100, ''),
        dealTitle: sanitizeString(dealTitle, 120, ''),
        stage,
        temperature,
        source: `Direct List Entry (${activeList.name})`.slice(0, 80),
        consentStatus: activeList.defaultConsent || 'opted_in',
        commChannels: ['email', 'whatsapp'],
        listName: activeList.name.slice(0, 80),
        tags: mergedTags,
        ltv: Math.max(0, Number(ltv) || 0),
        notes: sanitizeString(
          notes || `Stored directly in list "${activeList.name}".`,
          500,
          ''
        ),
        customFields: company ? [`Company: ${company}`] : [],
      });

      setStoredBanner(
        `${fullName.trim()} has been created and stored inside "${activeList.name}"!`
      );
      setFullName('');
      setEmail('');
      setPhone('');
      setCompany('');
      setDealTitle('');
      setLtv('0');
      setExtraTags('');
      setNotes('');
      setTimeout(() => setStoredBanner(null), 4000);
    } finally {
      setStoringContact(false);
    }
  };

  // Assign an existing CRM contact into the Active List
  const handleAssignExistingContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList || !selectedExistingContactId) return;
    const target = contacts.find((c) => c.id === selectedExistingContactId);
    if (!target) return;

    const combinedTags = sanitizeStringArray(
      Array.from(new Set([...(target.tags || []), ...(activeList.defaultTags || [])])),
      10,
      32
    );

    await onUpdateContact(target.id, {
      fullName: target.fullName,
      email: target.email,
      phone: target.phone,
      company: target.company || '',
      dealTitle: target.dealTitle || '',
      stage: target.stage,
      temperature: target.temperature,
      source: target.source,
      consentStatus: target.consentStatus,
      commChannels: target.commChannels || ['email'],
      listName: activeList.name.slice(0, 80),
      tags: combinedTags,
      ltv: target.ltv || 0,
      notes: target.notes || '',
      customFields: target.customFields || [],
    });

    setStoredBanner(
      `Moved existing contact "${target.fullName}" into "${activeList.name}"!`
    );
    setSelectedExistingContactId('');
    setTimeout(() => setStoredBanner(null), 4000);
  };

  const handleExportListCsv = (lst: AudienceList) => {
    const members = contacts.filter(
      (c) => c.listName.trim().toLowerCase() === lst.name.trim().toLowerCase()
    );
    const headers = [
      'Full Name',
      'Email',
      'Phone / WhatsApp',
      'Company',
      'Deal Title',
      'Stage',
      'Temperature',
      'Deal Value (LTV)',
      'Consent Status',
      'List Name',
      'Tags',
      'Notes',
    ];
    const rows = members.map((c) => [
      c.fullName,
      c.email,
      c.phone,
      c.company || '',
      c.dealTitle || '',
      c.stage,
      c.temperature,
      String(c.ltv || 0),
      c.consentStatus,
      c.listName,
      (c.tags || []).join('; '),
      (c.notes || '').replace(/"/g, '""'),
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowpilot-list-${lst.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const accentBorderMap: Record<ListColorAccent, string> = {
    emerald: 'border-t-4 border-t-[#047857]',
    amber: 'border-t-4 border-t-[#0F172A]',
    indigo: 'border-t-4 border-t-[#047857]',
    rose: 'border-t-4 border-t-[#0F172A]',
  };

  const categoryBadgeMap: Record<ListCategory, { label: string; style: string }> = {
    newsletter: {
      label: 'Newsletter Dispatch',
      style: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    },
    vip_buyers: {
      label: 'VIP Buyers & Clients',
      style: 'bg-slate-900 text-white border-slate-900',
    },
    lead_magnet: {
      label: 'Lead Magnet Funnel',
      style: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    },
    webinar: {
      label: 'Webinar & Event List',
      style: 'bg-slate-100 text-slate-800 border-slate-300',
    },
    custom: {
      label: 'Custom Contact List',
      style: 'bg-slate-100 text-slate-800 border-slate-300',
    },
  };

  // =========================================================================
  // VIEW A: INSIDE A SPECIFIC LIST (STORE & MANAGE CONTACTS IN THIS LIST)
  // =========================================================================
  if (activeList) {
    const listTotalLtv = activeListContacts.reduce(
      (sum, c) => sum + (Number(c.ltv) || 0),
      0
    );
    const listOptedIn = activeListContacts.filter(
      (c) => c.consentStatus === 'opted_in'
    ).length;
    const activeListKsEnabled = activeList.killSwitchEnabled !== false;
    const activeListKsTags =
      activeList.killSwitchTags && activeList.killSwitchTags.length > 0
        ? activeList.killSwitchTags
        : ['Purchased_Course'];
    const primaryListKsTag = activeListKsTags[0] || 'Purchased_Course';
    const stoppedContactsInListCount = activeListContacts.filter(
      (c) =>
        evaluateListKillSwitchForContact(c, allCombinedLists, activeList.name)
          .triggered
    ).length;

    return (
      <div className="space-y-5">
        {/* Top List Detail Header */}
        <div className="bg-[#0F172A] text-white rounded-2xl p-4 sm:p-6 shadow-md border border-slate-800">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={() => setActiveListId(null)}
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 hover:text-white mb-2 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to All Contact Lists
              </button>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {activeList.name}
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  {categoryBadgeMap[activeList.category]?.label || 'Contact List'}
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-800 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  {activeListKsEnabled
                    ? `List Kill Switch: #${activeListKsTags.join(', #')}`
                    : 'List Kill Switch: Off'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                {activeList.description}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="text-xs text-slate-400 font-semibold">
                  Auto-Applied List Tags:
                </span>
                {(activeList.defaultTags || []).map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-800 text-emerald-400 border border-slate-700"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Stored Contacts
                </div>
                <div className="font-display text-lg sm:text-xl font-bold text-white">
                  {activeListContacts.length}{' '}
                  <span className="text-xs font-normal text-slate-300">
                    ({listOptedIn} opted-in)
                  </span>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  List Deal Value
                </div>
                <div className="font-display text-lg sm:text-xl font-bold text-white">
                  {formatCurrency(listTotalLtv, currency)}
                </div>
              </div>
              {onSendBroadcastToList && (
                <button
                  type="button"
                  onClick={() => onSendBroadcastToList(activeList.name)}
                  className="px-3.5 py-2.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Campaign / Broadcast
                </button>
              )}
              <button
                type="button"
                onClick={() => handleExportListCsv(activeList)}
                className="px-3.5 py-2.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          {/* List-Level Kill Switch Rule Bar (Stop Automation for Contact When Tag Matches) */}
          <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono font-bold uppercase text-[10px] inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                List Kill Switch Rule
              </span>
              <span className="text-slate-200 font-semibold">
                When any contact in <strong className="text-white">{activeList.name}</strong> matches tag:
              </span>
              <input
                type="text"
                value={
                  inlineKillSwitchInput !== 'Purchased_Course' ||
                  activeListKsTags.join(', ') === 'Purchased_Course'
                    ? inlineKillSwitchInput
                    : activeListKsTags.join(', ')
                }
                onFocus={() => setInlineKillSwitchInput(activeListKsTags.join(', '))}
                onChange={(e) => setInlineKillSwitchInput(e.target.value)}
                placeholder="Purchased_Course, Buyer"
                className="px-2.5 py-1 text-xs font-mono font-bold bg-slate-900 border border-emerald-500/50 rounded-lg text-emerald-300 w-52 focus:outline-none focus:border-emerald-400"
              />
              <span className="text-slate-300">
                &rarr; Stop automation <strong className="text-emerald-300">for that contact</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="text-xs font-mono text-emerald-400 mr-1">
                {stoppedContactsInListCount} contact(s) stopped by Kill Switch
              </span>
              <button
                type="button"
                onClick={() =>
                  handleSaveActiveListKillSwitch(
                    true,
                    inlineKillSwitchInput || activeListKsTags.join(', ')
                  )
                }
                className="px-3 py-1.5 text-xs font-bold text-[#0F172A] bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer"
              >
                Save List Kill Switch Tag
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSaveActiveListKillSwitch(
                    !activeListKsEnabled,
                    activeListKsTags.join(', ')
                  )
                }
                className="px-2.5 py-1.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg cursor-pointer"
              >
                {activeListKsEnabled ? 'Pause Kill Switch' : 'Enable Kill Switch'}
              </button>
              {onBulkImportContacts && (
                <button
                  type="button"
                  onClick={() => {
                    setListCsvTagToApply(primaryListKsTag);
                    setListCsvModalOpen(true);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Daily Buyer CSV (Stop for Matched Contacts)
                </button>
              )}
            </div>
          </div>
        </div>

        {storedBanner && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-center justify-between text-sm font-bold">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#047857]" />
              {storedBanner}
            </span>
            <button
              type="button"
              onClick={() => setStoredBanner(null)}
              className="text-xs text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Dual Action Panel: 1) Store New Contact Directly Into List  2) Move Existing Contact Into List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 8 cols: Store a Brand-New Contact Directly in This List */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-[#047857] flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-slate-900">
                    Store a New Contact Directly in &ldquo;{activeList.name}&rdquo;
                  </h3>
                  <p className="text-xs text-slate-500">
                    Automatically assigns list membership, default consent (
                    {activeList.defaultConsent.replace(/_/g, ' ')}), and list tags.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStoreContactOpen((prev) => !prev)}
                className="text-xs font-bold text-[#047857] hover:underline cursor-pointer"
              >
                {storeContactOpen ? 'Collapse Form' : 'Expand Form'}
              </button>
            </div>

            {storeContactOpen && (
              <form onSubmit={handleStoreNewContactInList} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Tariq Al-Rashid"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tariq@company.io"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Phone / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 415 555 0199"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Company / Brand
                    </label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Apex Studio"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Deal / Opportunity
                    </label>
                    <input
                      type="text"
                      value={dealTitle}
                      onChange={(e) => setDealTitle(e.target.value)}
                      placeholder="Q4 Advisory Seat"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Stage
                    </label>
                    <select
                      value={stage}
                      onChange={(e) => setStage(e.target.value as ContactStage)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                    >
                      <option value="lead">Lead</option>
                      <option value="warm_lead">Warm Lead</option>
                      <option value="qualified">Qualified</option>
                      <option value="customer">Customer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Deal Value ({currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={ltv}
                      onChange={(e) => setLtv(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Additional Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={extraTags}
                      onChange={(e) => setExtraTags(e.target.value)}
                      placeholder="priority-prospect, q4-cohort"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      CRM Notes
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Context or follow-up notes..."
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={storingContact}
                    className="px-6 py-2.5 text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer inline-flex items-center gap-2 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    {storingContact
                      ? 'Storing Contact...'
                      : `Store Contact in "${activeList.name}"`}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right 4 cols: Add Existing CRM Contact to This List */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-[#0F172A] flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    Add Existing CRM Contact
                  </h3>
                  <p className="text-xs text-slate-500">
                    Assign an existing CRM lead or customer into this list
                  </p>
                </div>
              </div>

              <form onSubmit={handleAssignExistingContact} className="space-y-3 mt-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select CRM Contact ({contactsOutsideActiveList.length} available)
                </label>
                <select
                  value={selectedExistingContactId}
                  onChange={(e) => setSelectedExistingContactId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="">-- Choose a contact to store --</option>
                  {contactsOutsideActiveList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.email}) — currently in {c.listName}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!selectedExistingContactId}
                  className="w-full py-2.5 px-4 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-xl cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  Store Selected Contact in List
                </button>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
              Contacts stored in <strong>{activeList.name}</strong> can be targeted
              immediately in Email, Official WhatsApp, and SMS broadcasts or visual
              automations.
            </div>
          </div>
        </div>

        {/* Stored Contacts Table for Active List */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-xl font-bold text-slate-900">
                Contacts Stored in &ldquo;{activeList.name}&rdquo; ({activeListContacts.length})
              </h3>
              <p className="text-xs text-slate-500">
                All contacts below are actively stored in this list and inherit its broadcast
                targeting rules.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts in this list..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#090E1A] text-white text-xs font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-5">Contact & Company</th>
                  <th className="py-3.5 px-4">Email & WhatsApp</th>
                  <th className="py-3.5 px-4">Stage & Temperature</th>
                  <th className="py-3.5 px-4">Tags</th>
                  <th className="py-3.5 px-4">List Kill Switch (Per-Contact Status)</th>
                  <th className="py-3.5 px-4">Consent</th>
                  <th className="py-3.5 px-4 text-right">Deal / LTV</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {activeListContacts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No contacts stored in <strong>{activeList.name}</strong> yet. Use the form
                      above to store your first contact!
                    </td>
                  </tr>
                ) : (
                  activeListContacts.map((c) => {
                    const contactKs = evaluateListKillSwitchForContact(
                      c,
                      allCombinedLists,
                      activeList.name
                    );
                    return (
                      <tr key={c.id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="py-4 px-5">
                          <div className="font-bold text-slate-900 text-base">{c.fullName}</div>
                          {c.company && (
                            <div className="text-xs font-semibold text-[#047857] flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3.5 h-3.5" />
                              {c.company}
                              {c.dealTitle ? ` · ${c.dealTitle}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-600 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            {c.email}
                          </div>
                          {c.phone && (
                            <div className="flex items-center gap-1.5 font-mono">
                              <Phone className="w-3.5 h-3.5 text-emerald-600" />
                              {c.phone}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {c.stage.replace('_', ' ')}
                          </span>
                          <div className="text-xs font-bold uppercase text-slate-700 mt-1 inline-flex items-center gap-1 ml-2">
                            <Flame className="w-3.5 h-3.5 text-emerald-600" />
                            {c.temperature}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {(c.tags || []).map((t) => (
                              <span
                                key={t}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                  contactKs.triggered &&
                                  t.trim().toLowerCase() ===
                                    contactKs.matchedTag.trim().toLowerCase()
                                    ? 'bg-[#0F172A] text-emerald-300 border-slate-800 font-mono font-bold'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {contactKs.triggered ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-[#0F172A] text-emerald-300 border border-slate-800">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                STOPPED FOR CONTACT (#{contactKs.matchedTag})
                              </span>
                              <div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleContactKillSwitchTag(
                                      c,
                                      primaryListKsTag,
                                      true,
                                      contactKs.matchedTag
                                    )
                                  }
                                  className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                                >
                                  Remove #{contactKs.matchedTag} &amp; Resume
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Automation Active
                              </span>
                              <div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleContactKillSwitchTag(
                                      c,
                                      primaryListKsTag,
                                      false
                                    )
                                  }
                                  className="text-[11px] font-bold text-[#047857] hover:underline cursor-pointer"
                                >
                                  + Tag #{primaryListKsTag} (Stop for Contact)
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {c.consentStatus === 'opted_in' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Opted-In
                            </span>
                          ) : c.consentStatus === 'pending_double_opt_in' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-200 text-slate-800 border border-slate-300">
                              <XCircle className="w-3.5 h-3.5 text-slate-600" />
                              Unsubscribed
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(c.ltv, currency)}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => onDeleteContact(c.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Delete contact record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily Buyer CSV Import Modal for This List */}
        {listCsvModalOpen && onBulkImportContacts && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-xl">
              <div className="px-6 py-4 bg-[#090E1A] text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-display text-lg font-bold">
                    Daily Buyer CSV Import &middot; {activeList.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setListCsvModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-600">
                  Paste or upload your 1-column Buyer Email Addresses or WhatsApp Phone Numbers.
                  Matching contacts in <strong>{activeList.name}</strong> will receive the List Kill
                  Switch tag so automation immediately stops for those contacts.
                </p>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Kill Switch Tag to Apply (Stops Automation for Contact)
                  </label>
                  <input
                    type="text"
                    value={listCsvTagToApply}
                    onChange={(e) => setListCsvTagToApply(e.target.value)}
                    placeholder={primaryListKsTag}
                    className="w-full px-3.5 py-2 text-xs font-mono font-bold bg-emerald-50/60 border border-emerald-400 rounded-xl text-[#0F172A]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Buyer Emails or WhatsApp Numbers (1 per line or CSV)
                    </label>
                    <label className="text-xs font-bold text-[#047857] hover:underline cursor-pointer">
                      Upload .CSV File
                      <input
                        type="file"
                        accept=".csv,.txt"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setListCsvRawText(String(ev.target?.result || ''));
                          };
                          reader.readAsText(file);
                        }}
                      />
                    </label>
                  </div>
                  <textarea
                    rows={5}
                    value={listCsvRawText}
                    onChange={(e) => setListCsvRawText(e.target.value)}
                    placeholder={`Email\n${
                      activeListContacts[0]?.email || 'buyer1@example.com'
                    }\n+1 415 555 0199`}
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setListCsvModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={listCsvImporting || !listCsvRawText.trim()}
                    onClick={async () => {
                      const tagToUse = (listCsvTagToApply || primaryListKsTag).trim();
                      const lines = listCsvRawText
                        .split(/\r?\n/)
                        .map((l) => l.trim().replace(/^["']|["']$/g, ''))
                        .filter(Boolean);
                      const dataLines = lines.filter(
                        (l, i) =>
                          !(
                            i === 0 &&
                            /^(email|buyer|phone|whatsapp|contact)/i.test(l) &&
                            !l.includes('@') &&
                            l.replace(/\D/g, '').length < 7
                          )
                      );
                      if (dataLines.length === 0) return;
                      setListCsvImporting(true);
                      try {
                        const rows = dataLines.map((line) => {
                          const cell = line.split(',')[0].trim();
                          const isEmail = cell.includes('@');
                          return {
                            fullName: isEmail ? cell.split('@')[0] : `WhatsApp Buyer (${cell})`,
                            email: isEmail
                              ? cell.toLowerCase()
                              : `wa.${cell.replace(/\D/g, '')}@whatsapp-buyer.local`,
                            phone: isEmail ? '' : cell,
                            company: '',
                            dealTitle: '',
                            stage: 'customer' as ContactStage,
                            temperature: 'hot' as LeadTemperature,
                            source: `List Kill Switch CSV (${activeList.name})`.slice(0, 80),
                            consentStatus: 'opted_in' as ConsentStatus,
                            commChannels: ['email', 'whatsapp'],
                            listName: activeList.name.slice(0, 80),
                            tags: [tagToUse],
                            ltv: 0,
                            notes: `Kill Switch tag #${tagToUse} applied in list "${activeList.name}"`,
                            customFields: [],
                          };
                        });
                        await onBulkImportContacts(rows, {
                          columnMapping: 'auto',
                          applyTags: [tagToUse],
                          updateExistingContacts: true,
                          createUnmatchedContacts: true,
                          upgradeStageToCustomer: true,
                        });
                        setListCsvModalOpen(false);
                        setListCsvRawText('');
                        setStoredBanner(
                          `Applied Kill Switch tag #${tagToUse} to ${rows.length} contact(s) in "${activeList.name}" — Automation stopped for those contacts!`
                        );
                      } finally {
                        setListCsvImporting(false);
                      }
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {listCsvImporting
                      ? 'Applying Kill Switch...'
                      : `Update Contacts & Stop Automation (#${
                          listCsvTagToApply || primaryListKsTag
                        })`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW B: ALL CONTACT LISTS DIRECTORY & LIST CREATOR
  // =========================================================================
  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="border border-slate-200 rounded-2xl bg-white p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-bold uppercase tracking-wider mb-1.5">
            Dedicated Audience Lists & Contact Storage
          </div>
          <h2 className="font-display text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
            Contact Lists & Segment Containers ({allCombinedLists.length})
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Create dedicated lists, configure default opt-in and tag rules, and open any list to
            store and manage contacts directly inside it.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateList}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors cursor-pointer shrink-0 shadow-xs"
        >
          <FolderPlus className="w-4 h-4" />
          Create New List
        </button>
      </div>

      {/* Lists Grid */}
      {allCombinedLists.length === 0 ? (
        <div className="border border-slate-200 rounded-2xl bg-white p-8 sm:p-10 text-center shadow-xs">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#047857] flex items-center justify-center mx-auto mb-3">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="font-display text-xl font-bold text-slate-900">
            No Contact Lists Created Yet
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mt-1 mb-4">
            Create your first contact list to organize and store your leads and customers.
          </p>
          <button
            type="button"
            onClick={handleOpenCreateList}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            Create Your First List
          </button>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {allCombinedLists.map((lst) => {
          const storedContacts = contacts.filter(
            (c) => c.listName.trim().toLowerCase() === lst.name.trim().toLowerCase()
          );
          const optedInCount = storedContacts.filter(
            (c) => c.consentStatus === 'opted_in'
          ).length;
          const totalListLtv = storedContacts.reduce(
            (sum, c) => sum + (Number(c.ltv) || 0),
            0
          );
          const catInfo =
            categoryBadgeMap[lst.category] || categoryBadgeMap.custom;
          const borderAccent =
            accentBorderMap[lst.colorAccent] || accentBorderMap.emerald;

          return (
            <div
              key={lst.id}
              className={`bg-white border border-slate-200 ${borderAccent} rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-emerald-400 transition-all`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${catInfo.style}`}
                  >
                    {catInfo.label}
                  </span>
                  <div className="flex items-center gap-1">
                    {!lst.id.startsWith('virtual_') && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenEditList(lst)}
                          className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                          title="Edit List Settings"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteList(lst.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Delete List"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <h3 className="font-display text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  {lst.name}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 line-clamp-2">
                  {lst.description}
                </p>

                {/* Metrics Box */}
                <div className="grid grid-cols-3 gap-2 my-4 p-3 rounded-xl bg-[#FAF8F5] border border-slate-200">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Contacts
                    </div>
                    <div className="font-display text-lg font-bold text-slate-900 mt-0.5">
                      {storedContacts.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Opted-In
                    </div>
                    <div className="font-display text-lg font-bold text-[#047857] mt-0.5">
                      {optedInCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Deal LTV
                    </div>
                    <div className="font-display text-base font-bold text-slate-900 mt-0.5">
                      {formatCurrency(totalListLtv, currency)}
                    </div>
                  </div>
                </div>

                {/* Default Tags & List Kill Switch Rule Badge */}
                <div className="space-y-2 mb-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(lst.defaultTags || []).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                      >
                        <Tag className="w-2.5 h-2.5 text-slate-400" />
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* List Kill Switch Summary on Card */}
                  <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#047857] shrink-0" />
                      <span className="font-bold text-[#0F172A] truncate">
                        Kill Switch:{' '}
                        {lst.killSwitchEnabled === false
                          ? 'Off'
                          : `#${(lst.killSwitchTags && lst.killSwitchTags.length > 0
                              ? lst.killSwitchTags
                              : ['Purchased_Course']
                            ).join(', #')}`}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-emerald-800 shrink-0">
                      {
                        storedContacts.filter(
                          (c) =>
                            evaluateListKillSwitchForContact(c, allCombinedLists, lst.name)
                              .triggered
                        ).length
                      }{' '}
                      stopped
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveListId(lst.id)}
                    className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <UserPlus className="w-4 h-4" />
                    Open List & Store Contacts ({storedContacts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportListCsv(lst)}
                    className="py-2.5 px-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer inline-flex items-center gap-1"
                    title="Export List CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                </div>

                {(onCreateAutomationForList ||
                  onCreateAutoResponderForList ||
                  onCreateFormForList ||
                  onSendBroadcastToList) && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {onCreateAutoResponderForList && (
                      <button
                        type="button"
                        onClick={() => onCreateAutoResponderForList(lst.name)}
                        className="py-2 px-2 text-[11px] font-bold text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl cursor-pointer inline-flex items-center justify-center gap-1"
                      >
                        <Zap className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span className="truncate">Auto-Reply</span>
                      </button>
                    )}
                    {onCreateAutomationForList && (
                      <button
                        type="button"
                        onClick={() => onCreateAutomationForList(lst.name)}
                        className="py-2 px-2.5 text-[11px] font-bold text-[#0F172A] bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer inline-flex items-center justify-center gap-1"
                      >
                        <GitBranch className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span className="truncate">Automate</span>
                      </button>
                    )}
                    {onCreateFormForList && (
                      <button
                        type="button"
                        onClick={() => onCreateFormForList(lst.name)}
                        className="py-2 px-2.5 text-[11px] font-bold text-[#0F172A] bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer inline-flex items-center justify-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span className="truncate">Page/Form</span>
                      </button>
                    )}
                    {onSendBroadcastToList && (
                      <button
                        type="button"
                        onClick={() => onSendBroadcastToList(lst.name)}
                        className="py-2 px-2.5 text-[11px] font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl cursor-pointer inline-flex items-center justify-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">Broadcast</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Create / Edit List Modal */}
      {listModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-xl">
            <div className="px-6 py-4 bg-[#090E1A] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-emerald-400" />
                <h3 className="font-display text-lg font-bold">
                  {editingList ? 'Edit Contact List' : 'Create New Contact List'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setListModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveListSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  List Name *
                </label>
                <input
                  type="text"
                  required
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="e.g. Q4 Coaching Cohort Waitlist"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  List Description & Purpose
                </label>
                <textarea
                  rows={2}
                  value={listDescription}
                  onChange={(e) => setListDescription(e.target.value)}
                  placeholder="Describe who is stored in this list and what broadcasts/automations they receive..."
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    List Category
                  </label>
                  <select
                    value={listCategory}
                    onChange={(e) => setListCategory(e.target.value as ListCategory)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl"
                  >
                    <option value="newsletter">Newsletter Subscribers</option>
                    <option value="vip_buyers">VIP Buyers & Customers</option>
                    <option value="lead_magnet">Lead Magnet Funnel</option>
                    <option value="webinar">Webinar / Live Event</option>
                    <option value="custom">Custom Segment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Default Consent Status
                  </label>
                  <select
                    value={listDefaultConsent}
                    onChange={(e) =>
                      setListDefaultConsent(e.target.value as ConsentStatus)
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl"
                  >
                    <option value="opted_in">Verified Opt-In</option>
                    <option value="pending_double_opt_in">Pending Double Opt-In</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Auto-Applied Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={listDefaultTags}
                    onChange={(e) => setListDefaultTags(e.target.value)}
                    placeholder="vip-waitlist, whatsapp-ready"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Card Accent Style
                  </label>
                  <select
                    value={listColorAccent}
                    onChange={(e) =>
                      setListColorAccent(e.target.value as ListColorAccent)
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl"
                  >
                    <option value="emerald">Forest Emerald</option>
                    <option value="amber">Deep Slate Ink</option>
                  </select>
                </div>
              </div>

              {/* LIST KILL SWITCH RULE (STOP AUTOMATION FOR CONTACT WHEN TAG MATCHES) */}
              <div className="p-4 rounded-2xl bg-emerald-50/80 border-2 border-emerald-600/30 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#047857]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                      List Kill Switch Rule (Stop Automation for Contact)
                    </span>
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F172A] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={listKillSwitchEnabled}
                      onChange={(e) => setListKillSwitchEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#047857]"
                    />
                    <span>{listKillSwitchEnabled ? 'Active' : 'Off'}</span>
                  </label>
                </div>

                <p className="text-xs text-slate-600">
                  When any contact in this list receives any matching tag below (e.g. via Daily CSV
                  Import or CRM tag), automation will immediately stop{' '}
                  <strong>for that specific contact</strong>.
                </p>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Kill Switch Tag(s) (Comma-Separated — Any Match Stops Contact Automation) *
                  </label>
                  <input
                    type="text"
                    value={listKillSwitchTags}
                    onChange={(e) => {
                      setListKillSwitchTags(e.target.value);
                      if (!listKillSwitchEnabled) setListKillSwitchEnabled(true);
                    }}
                    placeholder="Purchased_Course, VIP_Buyer"
                    className="w-full px-3.5 py-2 text-sm font-mono font-bold bg-white border border-emerald-500 rounded-xl text-[#0F172A] focus:outline-none focus:border-[#047857]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    Quick Add Tag:
                  </span>
                  {['Purchased_Course', 'VIP_Buyer', 'Purchased_Product', 'Unsubscribed'].map(
                    (preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          const existing = listKillSwitchTags
                            .split(',')
                            .map((t) => t.trim())
                            .filter(Boolean);
                          if (!existing.includes(preset)) {
                            setListKillSwitchTags([...existing, preset].join(', '));
                          }
                          setListKillSwitchEnabled(true);
                        }}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 cursor-pointer"
                      >
                        +{preset}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setListModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingList}
                  className="px-5 py-2 text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {savingList
                    ? 'Saving List...'
                    : editingList
                    ? 'Save Changes'
                    : 'Create List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
