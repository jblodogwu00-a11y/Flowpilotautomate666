import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Download,
  Upload,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  XCircle,
  Flame,
  Tag,
  Mail,
  Phone,
  X,
  Building2,
  Briefcase,
  Layers,
  Kanban,
  Users,
  GitMerge,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Eye,
  FileSpreadsheet,
  FileJson,
  Sparkles,
  CheckSquare,
  AlertCircle,
} from 'lucide-react';
import {
  Contact,
  ContactStage,
  LeadTemperature,
  ConsentStatus,
  CurrencyCode,
  Automation,
  TaskItem,
  ActivityLog,
  CsvImportOptions,
  CsvImportResultSummary,
  formatCurrency,
  sanitizeString,
  sanitizeStringArray,
} from '../types';
import { ContactProfileDrawer } from './ContactProfileDrawer';

interface ContactsCrmViewProps {
  contacts: Contact[];
  automations: Automation[];
  tasks: TaskItem[];
  activities: ActivityLog[];
  currency: CurrencyCode;
  openModalOnMount?: boolean;
  onClearModalMount?: () => void;
  onCreateContact: (
    data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateContact: (
    id: string,
    data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onDeleteContact: (id: string) => Promise<void>;
  onBulkImportContacts: (
    imported: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>[],
    options?: CsvImportOptions
  ) => Promise<CsvImportResultSummary | void>;
  onMergeContacts: (primaryId: string, duplicateId: string) => Promise<void>;
  onCreateTask: (
    data: Omit<TaskItem, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onCompleteTask: (task: TaskItem) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onLogActivity: (
    eventType: ActivityLog['eventType'],
    title: string,
    detail: string,
    channel: ActivityLog['channel']
  ) => Promise<void>;
  onSimulateAutomationRun: (auto: Automation) => Promise<void>;
}

type CrmSubView = 'directory' | 'pipeline' | 'segments' | 'duplicates';
type SortField = 'createdAt' | 'fullName' | 'ltv' | 'company' | 'stage';
type SortOrder = 'asc' | 'desc';

const SAMPLE_CSV_TEMPLATE = `Full Name,Email,Phone,Company,Deal Title,Stage,Temperature,Deal Value,Source,Consent Status,List Name,Tags,Custom Fields,Notes`;

export const ContactsCrmView: React.FC<ContactsCrmViewProps> = ({
  contacts,
  automations,
  tasks,
  activities,
  currency,
  openModalOnMount,
  onClearModalMount,
  onCreateContact,
  onUpdateContact,
  onDeleteContact,
  onBulkImportContacts,
  onMergeContacts,
  onCreateTask,
  onCompleteTask,
  onDeleteTask,
  onLogActivity,
  onSimulateAutomationRun,
}) => {
  const [subView, setSubView] = useState<CrmSubView>('directory');

  // Search, Filters, Sorting, Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [listFilter, setListFilter] = useState<string>('all');
  const [consentFilter, setConsentFilter] = useState<string>('all');
  const [tempFilter, setTempFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('ltv');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selected contact for 360° Profile Drawer
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  // Create/Edit Contact Modal
  const [modalOpen, setModalOpen] = useState(Boolean(openModalOnMount));
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // CSV Import Modal (Phase 2 Daily Buyer CSV Routine + Full CRM Import)
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvRawText, setCsvRawText] = useState(
    `Buyer Email or WhatsApp Phone\n${
      contacts[0]?.email || 'amara@kineticdesign.co'
    }\n${contacts[1]?.phone || '+1 415 890 3319'}`
  );
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvColumnMapping, setCsvColumnMapping] = useState<
    'auto' | 'email' | 'phone' | 'full_csv'
  >('auto');
  const [csvApplyTagInput, setCsvApplyTagInput] = useState('Purchased_Course');
  const [csvUpdateExisting, setCsvUpdateExisting] = useState(true);
  const [csvCreateUnmatched, setCsvCreateUnmatched] = useState(true);
  const [csvUpgradeStageToCustomer, setCsvUpgradeStageToCustomer] = useState(true);
  const [lastCsvImportSummary, setLastCsvImportSummary] =
    useState<CsvImportResultSummary | null>(null);

  // Form states for Create/Edit Contact
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [dealTitle, setDealTitle] = useState('');
  const [stage, setStage] = useState<ContactStage>('lead');
  const [temperature, setTemperature] = useState<LeadTemperature>('warm');
  const [source, setSource] = useState('');
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>('opted_in');
  const [commChannels, setCommChannels] = useState<string[]>(['email']);
  const [listName, setListName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [customFieldsInput, setCustomFieldsInput] = useState('');
  const [ltv, setLtv] = useState('0');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (openModalOnMount) {
      handleOpenCreate();
      onClearModalMount?.();
    }
  }, [openModalOnMount]);

  const uniqueLists = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.listName))).filter(Boolean),
    [contacts]
  );

  const uniqueTags = useMemo(
    () => Array.from(new Set(contacts.flatMap((c) => c.tags || []))).filter(Boolean),
    [contacts]
  );

  // Duplicate Detection Engine (matches normalized email, phone, or base full name)
  const duplicatePairs = useMemo(() => {
    const pairs: { primary: Contact; duplicate: Contact; reason: string }[] = [];
    const seenDuplicateIds = new Set<string>();

    for (let i = 0; i < contacts.length; i++) {
      for (let j = i + 1; j < contacts.length; j++) {
        const a = contacts[i];
        const b = contacts[j];
        if (seenDuplicateIds.has(b.id) || seenDuplicateIds.has(a.id)) continue;

        const emailMatch =
          a.email &&
          b.email &&
          a.email.trim().toLowerCase() === b.email.trim().toLowerCase();
        const phoneA = (a.phone || '').replace(/\D/g, '');
        const phoneB = (b.phone || '').replace(/\D/g, '');
        const phoneMatch = phoneA.length >= 7 && phoneA === phoneB;

        const nameA = a.fullName
          .replace(/\s*\(.*?\)/g, '')
          .trim()
          .toLowerCase();
        const nameB = b.fullName
          .replace(/\s*\(.*?\)/g, '')
          .trim()
          .toLowerCase();
        const nameMatch = nameA.length >= 4 && nameA === nameB;

        if (emailMatch || phoneMatch || nameMatch) {
          const reason = emailMatch
            ? `Identical Email (${a.email})`
            : phoneMatch
            ? `Identical Phone/WhatsApp (${a.phone})`
            : `Matching Name (${a.fullName})`;
          pairs.push({ primary: a, duplicate: b, reason });
          seenDuplicateIds.add(b.id);
        }
      }
    }
    return pairs;
  }, [contacts]);

  // Filtered + Sorted Contacts
  const filteredAndSortedContacts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = contacts.filter((c) => {
      const matchesSearch =
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.dealTitle || '').toLowerCase().includes(q) ||
        c.source.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)) ||
        (c.customFields || []).some((cf) => cf.toLowerCase().includes(q));

      const matchesStage = stageFilter === 'all' || c.stage === stageFilter;
      const matchesList = listFilter === 'all' || c.listName === listFilter;
      const matchesConsent =
        consentFilter === 'all' || c.consentStatus === consentFilter;
      const matchesTemp = tempFilter === 'all' || c.temperature === tempFilter;
      const matchesTag = tagFilter === 'all' || (c.tags || []).includes(tagFilter);

      return (
        matchesSearch &&
        matchesStage &&
        matchesList &&
        matchesConsent &&
        matchesTemp &&
        matchesTag
      );
    });

    const stageWeight: Record<ContactStage, number> = {
      customer: 5,
      qualified: 4,
      warm_lead: 3,
      lead: 2,
      cold_subscriber: 1,
      churned: 0,
    };

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'fullName') {
        cmp = a.fullName.localeCompare(b.fullName);
      } else if (sortField === 'ltv') {
        cmp = (Number(a.ltv) || 0) - (Number(b.ltv) || 0);
      } else if (sortField === 'company') {
        cmp = (a.company || '').localeCompare(b.company || '');
      } else if (sortField === 'stage') {
        cmp = (stageWeight[a.stage] || 0) - (stageWeight[b.stage] || 0);
      } else {
        const timeA =
          typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0;
        const timeB =
          typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0;
        cmp = timeA - timeB;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [
    contacts,
    searchQuery,
    stageFilter,
    listFilter,
    consentFilter,
    tempFilter,
    tagFilter,
    sortField,
    sortOrder,
  ]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedContacts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedContacts = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSortedContacts.slice(start, start + pageSize);
  }, [filteredAndSortedContacts, safePage, pageSize]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) || null,
    [contacts, selectedContactId]
  );

  // Summary KPIs
  const totalPipelineLtv = useMemo(
    () => contacts.reduce((sum, c) => sum + (Number(c.ltv) || 0), 0),
    [contacts]
  );
  const optedInCount = useMemo(
    () => contacts.filter((c) => c.consentStatus === 'opted_in').length,
    [contacts]
  );
  const hotLeadsCount = useMemo(
    () => contacts.filter((c) => c.temperature === 'hot').length,
    [contacts]
  );

  const handleOpenCreate = () => {
    setEditingContact(null);
    setFullName('');
    setEmail('');
    setPhone('');
    setCompany('');
    setDealTitle('');
    setStage('lead');
    setTemperature('warm');
    setSource('');
    setConsentStatus('opted_in');
    setCommChannels(['email']);
    setListName('');
    setTagsInput('');
    setCustomFieldsInput('');
    setLtv('0');
    setNotes('');
    setModalOpen(true);
  };

  const handleOpenEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFullName(contact.fullName);
    setEmail(contact.email);
    setPhone(contact.phone);
    setCompany(contact.company || '');
    setDealTitle(contact.dealTitle || '');
    setStage(contact.stage);
    setTemperature(contact.temperature);
    setSource(contact.source);
    setConsentStatus(contact.consentStatus);
    setCommChannels(contact.commChannels || ['email']);
    setListName(contact.listName);
    setTagsInput(contact.tags.join(', '));
    setCustomFieldsInput((contact.customFields || []).join(', '));
    setLtv(String(contact.ltv));
    setNotes(contact.notes);
    setModalOpen(true);
  };

  const handleToggleFormCommChannel = (ch: string) => {
    setCommChannels((prev) =>
      prev.includes(ch) ? prev.filter((item) => item !== ch) : [...prev, ch]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;
    setSubmitting(true);
    try {
      const parsedTags = sanitizeStringArray(tagsInput.split(','), 10, 32);
      const parsedCustomFields = sanitizeStringArray(
        customFieldsInput.split(','),
        15,
        120
      );
      const payload: Omit<
        Contact,
        'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'
      > = {
        fullName: sanitizeString(fullName, 100, 'Unnamed Contact'),
        email: sanitizeString(email, 150, 'contact@example.com'),
        phone: sanitizeString(phone, 32, ''),
        company: sanitizeString(company, 100, ''),
        dealTitle: sanitizeString(dealTitle, 120, ''),
        stage,
        temperature,
        source: sanitizeString(source, 80, 'Direct Entry'),
        consentStatus,
        commChannels: commChannels.length > 0 ? commChannels.slice(0, 5) : ['email'],
        listName: sanitizeString(listName, 80, 'General Contacts'),
        tags: parsedTags,
        ltv: Math.max(0, Number(ltv) || 0),
        notes: sanitizeString(notes, 500, ''),
        customFields: parsedCustomFields,
      };

      if (editingContact) {
        await onUpdateContact(editingContact.id, payload);
      } else {
        await onCreateContact(payload);
      }
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsv = (subset?: Contact[]) => {
    const rowsToExport = subset || filteredAndSortedContacts;
    const headers = [
      'Full Name',
      'Email',
      'Phone / WhatsApp',
      'Company',
      'Deal Title',
      'Stage',
      'Temperature',
      'Deal Value (LTV)',
      'Source',
      'Consent Status',
      'Preferred Channels',
      'List / Segment',
      'Tags',
      'Custom Fields',
      'Notes',
    ];
    const rows = rowsToExport.map((c) => [
      c.fullName,
      c.email,
      c.phone,
      c.company || '',
      c.dealTitle || '',
      c.stage,
      c.temperature,
      String(c.ltv || 0),
      c.source,
      c.consentStatus,
      (c.commChannels || ['email']).join('; '),
      c.listName,
      (c.tags || []).join('; '),
      (c.customFields || []).join(' | '),
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
    link.download = `flowpilot-crm-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJsonArchive = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      platform: 'FlowPilot CRM — Full Workspace Data Export',
      totalRecords: filteredAndSortedContacts.length,
      contacts: filteredAndSortedContacts,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowpilot-crm-archive-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper to match a CSV row against existing CRM contacts by Email Address or WhatsApp Phone Number
  const findExistingContactByEmailOrPhone = (
    emailCandidate: string,
    phoneCandidate: string
  ): { contact: Contact | null; matchedBy: 'email' | 'phone' | null } => {
    const cleanEmail = (emailCandidate || '').trim().toLowerCase();
    if (cleanEmail && cleanEmail.includes('@')) {
      const byEmail = contacts.find(
        (c) => (c.email || '').trim().toLowerCase() === cleanEmail
      );
      if (byEmail) return { contact: byEmail, matchedBy: 'email' };
    }

    const phoneDigits = (phoneCandidate || '').replace(/\D/g, '');
    if (phoneDigits.length >= 7) {
      const tail9 = phoneDigits.slice(-9);
      const byPhone = contacts.find((c) => {
        const cDigits = (c.phone || '').replace(/\D/g, '');
        if (cDigits.length < 7) return false;
        return cDigits === phoneDigits || (tail9.length >= 8 && cDigits.slice(-9) === tail9);
      });
      if (byPhone) return { contact: byPhone, matchedBy: 'phone' };
    }

    return { contact: null, matchedBy: null };
  };

  // Parse CSV lines into Contact payloads (supports 1-column Buyer Email, 1-column WhatsApp Phone, or Multi-Column CSV)
  const parsedCsvEntries = useMemo(() => {
    const lines = csvRawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];

    const parseCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };

    const appliedTagsList = sanitizeStringArray(
      csvApplyTagInput.split(/[;,]/),
      10,
      32
    );

    // Determine if line 0 is a header row or actual data (e.g., if user pasted a raw list of emails/phones without header)
    const firstCols = parseCsvLine(lines[0]);
    const firstCellLower = (firstCols[0] || '').toLowerCase();
    const firstRowHasEmailSymbol = firstCols.some((c) => c.includes('@'));
    const firstRowHasPhoneDigits = firstCols.some(
      (c) => !c.includes('@') && c.replace(/\D/g, '').length >= 7
    );
    const isHeaderRow =
      !firstRowHasEmailSymbol &&
      !firstRowHasPhoneDigits &&
      (firstCellLower.includes('name') ||
        firstCellLower.includes('email') ||
        firstCellLower.includes('phone') ||
        firstCellLower.includes('whatsapp') ||
        firstCellLower.includes('buyer') ||
        firstCellLower.includes('contact') ||
        lines.length > 1);

    const startIdx = isHeaderRow ? 1 : 0;

    const entries: {
      payload: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>;
      recognizedAs: 'Email Address' | 'WhatsApp / Phone Number' | 'Email + Phone';
      existingContact: Contact | null;
      matchedBy: 'email' | 'phone' | null;
    }[] = [];

    for (let i = startIdx; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]).filter((c) => c.length > 0);
      if (cols.length === 0) continue;

      let detectedEmail = '';
      let detectedPhone = '';
      let detectedName = '';
      let recognizedAs: 'Email Address' | 'WhatsApp / Phone Number' | 'Email + Phone' =
        'Email Address';

      if (csvColumnMapping === 'email') {
        detectedEmail = cols.find((c) => c.includes('@')) || cols[0] || '';
        recognizedAs = 'Email Address';
      } else if (csvColumnMapping === 'phone') {
        detectedPhone =
          cols.find((c) => c.replace(/\D/g, '').length >= 7) || cols[0] || '';
        recognizedAs = 'WhatsApp / Phone Number';
      } else if (cols.length >= 6 || csvColumnMapping === 'full_csv') {
        // Multi-column full CRM CSV
        detectedName = cols[0] || '';
        detectedEmail = cols[1] || '';
        detectedPhone = cols[2] || '';
        recognizedAs = detectedPhone ? 'Email + Phone' : 'Email Address';
      } else {
        // Auto-detect 1-column or 2-3 column clean buyer CSV (Email Address OR WhatsApp Phone Number)
        for (const cell of cols) {
          if (!detectedEmail && cell.includes('@')) {
            detectedEmail = cell.trim();
          } else if (
            !detectedPhone &&
            !cell.includes('@') &&
            cell.replace(/\D/g, '').length >= 7
          ) {
            detectedPhone = cell.trim();
          } else if (!detectedName && !cell.includes('@')) {
            detectedName = cell.trim();
          }
        }
        if (detectedEmail && detectedPhone) {
          recognizedAs = 'Email + Phone';
        } else if (detectedPhone && !detectedEmail) {
          recognizedAs = 'WhatsApp / Phone Number';
        } else {
          recognizedAs = 'Email Address';
          if (!detectedEmail && cols[0]) {
            detectedEmail = cols[0];
          }
        }
      }

      const matchRes = findExistingContactByEmailOrPhone(detectedEmail, detectedPhone);
      const existing = matchRes.contact;

      const rowInlineTags =
        cols.length >= 12 && cols[11]
          ? sanitizeStringArray(cols[11].split(/[;,]/), 10, 32)
          : [];
      const mergedTags = sanitizeStringArray(
        [...(existing?.tags || []), ...appliedTagsList, ...rowInlineTags],
        10,
        32
      );

      const finalEmail =
        existing?.email ||
        (detectedEmail && detectedEmail.includes('@')
          ? detectedEmail
          : detectedPhone
          ? `wa.${detectedPhone.replace(/\D/g, '').slice(-10)}@whatsapp-buyer.local`
          : 'buyer@example.com');

      const finalPhone = existing?.phone || detectedPhone || '';
      const finalName =
        existing?.fullName ||
        detectedName ||
        (detectedEmail && detectedEmail.includes('@')
          ? detectedEmail
              .split('@')[0]
              .replace(/[._\-]/g, ' ')
              .replace(/\b\w/g, (l) => l.toUpperCase())
          : finalPhone
          ? `WhatsApp Buyer (${finalPhone})`
          : 'Imported Buyer');

      const rawStage = (cols[5] || '').toLowerCase() as ContactStage;
      const validStages: ContactStage[] = [
        'lead',
        'warm_lead',
        'qualified',
        'customer',
        'churned',
      ];
      const finalStage: ContactStage = csvUpgradeStageToCustomer
        ? 'customer'
        : validStages.includes(rawStage)
        ? rawStage
        : existing?.stage || 'lead';

      entries.push({
        recognizedAs,
        existingContact: existing,
        matchedBy: matchRes.matchedBy,
        payload: {
          fullName: sanitizeString(finalName, 100, 'Imported Buyer'),
          email: sanitizeString(finalEmail, 150, 'buyer@example.com'),
          phone: sanitizeString(finalPhone, 32, ''),
          company: sanitizeString(cols[3] || existing?.company || '', 100, ''),
          dealTitle: sanitizeString(cols[4] || existing?.dealTitle || '', 120, ''),
          stage: finalStage,
          temperature: existing?.temperature || 'hot',
          ltv: Math.max(0, Number(cols[7]) || existing?.ltv || 0),
          source: sanitizeString(
            cols[8] || existing?.source || 'Daily Buyer CSV Import',
            80,
            'Daily Buyer CSV Import'
          ),
          consentStatus: existing?.consentStatus || 'opted_in',
          commChannels: existing?.commChannels || ['email', 'whatsapp'],
          listName: sanitizeString(
            cols[10] || existing?.listName || 'General Contacts',
            80,
            'General Contacts'
          ),
          tags: mergedTags.length > 0 ? mergedTags : ['Purchased_Course'],
          customFields: existing?.customFields || [],
          notes: sanitizeString(
            existing?.notes
              ? `${existing.notes} | [CSV Tag Applied: ${appliedTagsList.join(', ') || 'Purchased_Course'}]`
              : 'Updated via Daily Buyer CSV Import.',
            500,
            ''
          ),
        },
      });
    }

    return entries;
  }, [
    csvRawText,
    csvColumnMapping,
    csvApplyTagInput,
    csvUpgradeStageToCustomer,
    contacts,
  ]);

  const parsedCsvContacts = useMemo(
    () => parsedCsvEntries.map((e) => e.payload),
    [parsedCsvEntries]
  );

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      if (content) setCsvRawText(content);
    };
    reader.readAsText(file);
  };

  const handleLoadClean1ColumnSample = (mode: 'email' | 'phone') => {
    if (mode === 'email') {
      const sampleEmails =
        contacts.length > 0
          ? contacts.slice(0, 3).map((c) => c.email)
          : ['amara@kineticdesign.co', 'david.okafor@apexstudio.io'];
      setCsvColumnMapping('email');
      setCsvRawText(['Buyer Email Address', ...sampleEmails].join('\n'));
    } else {
      const samplePhones =
        contacts.filter((c) => c.phone).length > 0
          ? contacts
              .filter((c) => c.phone)
              .slice(0, 3)
              .map((c) => c.phone)
          : ['+1 415 890 3319', '+234 803 555 0192'];
      setCsvColumnMapping('phone');
      setCsvRawText(['WhatsApp Phone Number', ...samplePhones].join('\n'));
    }
  };

  const handleConfirmCsvImport = async () => {
    if (parsedCsvContacts.length === 0) return;
    setCsvImporting(true);
    try {
      const appliedTags = sanitizeStringArray(
        csvApplyTagInput.split(/[;,]/),
        10,
        32
      );
      const summary = await onBulkImportContacts(parsedCsvContacts, {
        applyTags: appliedTags.length > 0 ? appliedTags : ['Purchased_Course'],
        updateExistingContacts: csvUpdateExisting,
        createUnmatchedContacts: csvCreateUnmatched,
        matchColumnType: csvColumnMapping === 'full_csv' ? 'auto' : csvColumnMapping,
        upgradeStageToCustomer: csvUpgradeStageToCustomer,
      });
      if (summary) {
        setLastCsvImportSummary(summary);
      }
      setCsvModalOpen(false);
    } finally {
      setCsvImporting(false);
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const pipelineStages: {
    id: ContactStage;
    label: string;
    accent: string;
    badgeBg: string;
  }[] = [
    {
      id: 'lead',
      label: 'New Leads',
      accent: 'border-t-4 border-t-slate-400',
      badgeBg: 'bg-slate-100 text-slate-800 border border-slate-200',
    },
    {
      id: 'warm_lead',
      label: 'Warm Engaged',
      accent: 'border-t-4 border-t-emerald-500',
      badgeBg: 'bg-emerald-50 text-emerald-900 border border-emerald-200',
    },
    {
      id: 'qualified',
      label: 'Qualified Pipeline',
      accent: 'border-t-4 border-t-[#0F172A]',
      badgeBg: 'bg-slate-900 text-white border border-slate-900',
    },
    {
      id: 'customer',
      label: 'Customers Won',
      accent: 'border-t-4 border-t-[#047857]',
      badgeBg: 'bg-emerald-50 text-emerald-900 border border-emerald-200',
    },
    {
      id: 'churned',
      label: 'Churned / Dormant',
      accent: 'border-t-4 border-t-slate-300',
      badgeBg: 'bg-slate-100 text-slate-600 border border-slate-200',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top CRM Executive Summary Strip — Two-Color Slate Ink & Emerald */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 border-t-4 border-t-[#047857] rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total CRM Records
          </div>
          <div className="font-display text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            {contacts.length}
          </div>
          <div className="text-xs text-emerald-700 font-semibold mt-0.5">
            {optedInCount} verified opt-in (
            {contacts.length > 0 ? Math.round((optedInCount / contacts.length) * 100) : 0}%)
          </div>
        </div>

        <div className="bg-white border border-slate-200 border-t-4 border-t-[#0F172A] rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Pipeline & Deal Value
          </div>
          <div className="font-display text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            {formatCurrency(totalPipelineLtv, currency)}
          </div>
          <div className="text-xs text-slate-600 font-semibold mt-0.5">
            {hotLeadsCount} Hot high-intent deals active
          </div>
        </div>

        <div className="bg-white border border-slate-200 border-t-4 border-t-[#047857] rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Active Lists & Tags
          </div>
          <div className="font-display text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            {uniqueLists.length} Lists · {uniqueTags.length} Tags
          </div>
          <div className="text-xs text-emerald-700 font-semibold mt-0.5">
            Dynamic behavioral segmentation ready
          </div>
        </div>

        <div className="bg-white border border-slate-200 border-t-4 border-t-[#0F172A] rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Duplicate Hygiene Scan
          </div>
          <div className="font-display text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            {duplicatePairs.length}{' '}
            <span className="text-sm sm:text-base font-normal text-slate-500">Pairs</span>
          </div>
          <button
            type="button"
            onClick={() => setSubView('duplicates')}
            className="text-xs text-[#047857] hover:text-emerald-900 font-bold underline mt-0.5 cursor-pointer"
          >
            {duplicatePairs.length > 0
              ? 'Review & merge duplicates →'
              : 'Open duplicate detector →'}
          </button>
        </div>
      </div>

      {/* Main CRM Command Bar & Sub-View Navigation */}
      <div className="border border-slate-200 rounded-2xl bg-white p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 sm:pb-5 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-bold uppercase tracking-wider mb-1.5">
              360° Customer Relationship Management
            </div>
            <h2 className="font-display text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
              Audience CRM, Pipeline & Data Governance
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Click any contact to open their 360° Customer Timeline, Custom Fields, Tasks,
              Automation History, and GDPR Portability Tools.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCsvModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#090E1A] hover:bg-slate-800 border border-slate-900 rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              Import Contacts / Upload CSV (Kill Switch)
            </button>
            <button
              type="button"
              onClick={() => handleExportCsv()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#047857]" />
              Export CSV ({filteredAndSortedContacts.length})
            </button>
            <button
              type="button"
              onClick={handleExportJsonArchive}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              title="Export GDPR JSON Archive"
            >
              <FileJson className="w-3.5 h-3.5 text-[#047857]" />
              GDPR JSON
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Contact
            </button>
          </div>
        </div>

        {/* Sub-View Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'directory', label: 'Contact Directory', icon: Users },
              { id: 'pipeline', label: 'Deal Pipeline', icon: Kanban },
              {
                id: 'segments',
                label: `Lists & Segments (${uniqueLists.length})`,
                icon: Layers,
              },
              {
                id: 'duplicates',
                label: `Duplicate Merge (${duplicatePairs.length})`,
                icon: GitMerge,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = subView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubView(tab.id as CrmSubView)}
                  className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    active
                      ? 'bg-[#090E1A] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-emerald-400' : 'text-slate-500'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search & Filter Bar (Active in Directory & Pipeline views) */}
          {(subView === 'directory' || subView === 'pipeline') && (
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 pt-1">
              <div className="sm:col-span-2 md:col-span-4 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search name, email, WhatsApp, company, deal, tag..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                />
              </div>

              <div className="md:col-span-2">
                <select
                  value={stageFilter}
                  onChange={(e) => {
                    setStageFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                >
                  <option value="all">All Stages</option>
                  <option value="lead">Lead</option>
                  <option value="warm_lead">Warm Lead</option>
                  <option value="qualified">Qualified</option>
                  <option value="customer">Customer</option>
                  <option value="churned">Churned</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <select
                  value={listFilter}
                  onChange={(e) => {
                    setListFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                >
                  <option value="all">All Lists / Segments</option>
                  {uniqueLists.map((list) => (
                    <option key={list} value={list}>
                      {list}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <select
                  value={tagFilter}
                  onChange={(e) => {
                    setTagFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                >
                  <option value="all">All Tags ({uniqueTags.length})</option>
                  {uniqueTags.map((t) => (
                    <option key={t} value={t}>
                      #{t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <select
                  value={consentFilter}
                  onChange={(e) => {
                    setConsentFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                >
                  <option value="all">All Consent</option>
                  <option value="opted_in">Opted-In Verified</option>
                  <option value="pending_double_opt_in">Pending Double Opt-In</option>
                  <option value="unsubscribed">Unsubscribed</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live CSV Import & Kill Switch Ejection Confirmation Banner */}
      {lastCsvImportSummary && (
        <div className="border-2 border-emerald-600 bg-emerald-50/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-[#090E1A] text-emerald-400 font-mono text-[11px] font-bold uppercase">
                Daily CSV Import &amp; Kill Switch Complete
              </span>
              <span className="text-xs font-bold text-emerald-950">
                Applied Tag(s):{' '}
                {lastCsvImportSummary.appliedTags.map((t) => `#${t}`).join(', ')}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900">
              Updated {lastCsvImportSummary.updatedCount} existing contact(s) without duplicates ·
              Created {lastCsvImportSummary.createdCount} new record(s) ·{' '}
              <span className="text-[#047857]">
                Kill Switch Ejected {lastCsvImportSummary.killSwitchEjectedCount} buyer(s) from
                active Email &amp; WhatsApp pitch sequences!
              </span>
            </div>
            {lastCsvImportSummary.affectedWorkflowNames.length > 0 && (
              <div className="text-xs text-slate-600">
                Active Workflows Scanned &amp; Halted for Tagged Buyers:{' '}
                <strong className="text-slate-900">
                  {lastCsvImportSummary.affectedWorkflowNames.join(' · ')}
                </strong>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setLastCsvImportSummary(null)}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 cursor-pointer shrink-0"
          >
            Dismiss Report
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 1: CONTACT DIRECTORY TABLE WITH SORTING & PAGINATION         */}
      {/* ===================================================================== */}
      {subView === 'directory' && (
        <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-[#090E1A] text-white text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => toggleSort('fullName')}
                      className="inline-flex items-center gap-1.5 hover:text-emerald-300 cursor-pointer uppercase"
                    >
                      Contact & Company
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3.5">
                    <button
                      type="button"
                      onClick={() => toggleSort('stage')}
                      className="inline-flex items-center gap-1.5 hover:text-emerald-300 cursor-pointer uppercase"
                    >
                      Stage & Intent
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3.5">Segment, Source & Custom Fields</th>
                  <th className="py-3 px-3.5">Tags</th>
                  <th className="py-3 px-3.5">Consent & Channels</th>
                  <th className="py-3 px-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('ltv')}
                      className="inline-flex items-center gap-1.5 hover:text-emerald-300 cursor-pointer uppercase ml-auto"
                    >
                      Deal / LTV
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">360° & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                {paginatedContacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      No contacts match your active filters. Try clearing your search query or add a
                      new contact.
                    </td>
                  </tr>
                ) : (
                  paginatedContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      onClick={() => setSelectedContactId(contact.id)}
                      className="hover:bg-emerald-50/40 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          {contact.fullName}
                        </div>
                        {contact.company && (
                          <div className="text-xs font-semibold text-[#047857] flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3" />
                            {contact.company}
                            {contact.dealTitle ? ` · ${contact.dealTitle}` : ''}
                          </div>
                        )}
                        <div className="flex flex-col gap-0.5 mt-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {contact.email}
                          </span>
                          {contact.phone && (
                            <span className="inline-flex items-center gap-1.5 font-mono text-slate-600">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              {contact.phone}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                              contact.stage === 'customer'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : contact.stage === 'qualified'
                                ? 'bg-slate-900 text-white'
                                : contact.stage === 'warm_lead'
                                ? 'bg-emerald-50/70 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {contact.stage.replace('_', ' ')}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase ${
                              contact.temperature === 'hot'
                                ? 'text-[#047857]'
                                : contact.temperature === 'warm'
                                ? 'text-slate-700'
                                : 'text-slate-500'
                            }`}
                          >
                            <Flame className="w-3 h-3" />
                            {contact.temperature}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">{contact.listName}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Via: {contact.source}</div>
                        {(contact.customFields || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(contact.customFields || []).slice(0, 2).map((cf) => (
                              <span
                                key={cf}
                                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50/80 text-emerald-900 border border-emerald-200/70"
                              >
                                {cf}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {contact.tags.length === 0 ? (
                            <span className="text-xs text-slate-400">No tags</span>
                          ) : (
                            contact.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                <Tag className="w-2.5 h-2.5 text-slate-400" />
                                {tag}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3.5">
                        {contact.consentStatus === 'opted_in' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Opted-In
                          </span>
                        )}
                        {contact.consentStatus === 'pending_double_opt_in' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                            <Clock className="w-3 h-3 text-slate-500" />
                            Pending Opt-In
                          </span>
                        )}
                        {contact.consentStatus === 'unsubscribed' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-200 text-slate-800 border border-slate-300">
                            <XCircle className="w-3 h-3 text-slate-600" />
                            Unsubscribed
                          </span>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          {(contact.commChannels || ['email']).map((ch) => (
                            <span
                              key={ch}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600"
                            >
                              {ch}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(contact.ltv, currency)}
                      </td>

                      <td
                        className="py-3 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedContactId(contact.id)}
                            className="px-2 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                            title="Open 360° Contact Timeline & Dossier"
                          >
                            <Eye className="w-3 h-3" />
                            360°
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(contact)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Contact"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteContact(contact.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-slate-600">
              <span>
                Showing{' '}
                <strong className="text-slate-900">
                  {filteredAndSortedContacts.length === 0
                    ? 0
                    : (safePage - 1) * pageSize + 1}
                </strong>{' '}
                to{' '}
                <strong className="text-slate-900">
                  {Math.min(safePage * pageSize, filteredAndSortedContacts.length)}
                </strong>{' '}
                of <strong className="text-slate-900">{filteredAndSortedContacts.length}</strong>{' '}
                contacts
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 text-xs font-bold bg-white border border-slate-300 rounded-lg"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </button>
              <span className="text-xs font-bold text-slate-700 px-1.5">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 2: LEAD STAGES & DEAL PIPELINE KANBAN                        */}
      {/* ===================================================================== */}
      {subView === 'pipeline' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {pipelineStages.map((stageCol) => {
            const stageContacts = filteredAndSortedContacts.filter(
              (c) => c.stage === stageCol.id
            );
            const stageLtv = stageContacts.reduce(
              (sum, c) => sum + (Number(c.ltv) || 0),
              0
            );

            return (
              <div
                key={stageCol.id}
                className={`bg-white border border-slate-200 ${stageCol.accent} rounded-2xl p-4 flex flex-col min-h-[460px] shadow-2xs`}
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                  <div>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${stageCol.badgeBg}`}
                    >
                      {stageCol.label}
                    </span>
                    <div className="font-display text-lg font-bold text-slate-900 mt-1">
                      {formatCurrency(stageLtv, currency)}
                    </div>
                  </div>
                  <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 font-mono text-xs font-bold flex items-center justify-center">
                    {stageContacts.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  {stageContacts.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-8 border border-dashed border-slate-200 rounded-xl">
                      No records in {stageCol.label}
                    </div>
                  ) : (
                    stageContacts.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setSelectedContactId(c.id)}
                        className="p-3.5 rounded-xl bg-[#FAF8F5] hover:bg-emerald-50/50 border border-slate-200 transition-all cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-slate-900 text-sm">
                            {c.fullName}
                          </div>
                          <span className="font-mono text-xs font-bold text-[#047857]">
                            {formatCurrency(c.ltv, currency)}
                          </span>
                        </div>
                        {c.company && (
                          <div className="text-xs font-semibold text-slate-600 mt-0.5">
                            {c.company}
                          </div>
                        )}
                        {c.dealTitle && (
                          <div className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md mt-2 truncate">
                            Deal: {c.dealTitle}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200/70 text-[11px] text-slate-500">
                          <span className="uppercase font-bold text-slate-600">
                            {c.temperature}
                          </span>
                          <span className="text-emerald-700 font-bold">
                            Open 360° →
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 3: LISTS & SEGMENTS MANAGER                                  */}
      {/* ===================================================================== */}
      {subView === 'segments' && (
        uniqueLists.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
            <Layers className="w-10 h-10 text-[#047857] mx-auto mb-2" />
            <div className="font-display text-xl font-bold text-slate-900">
              No Audience Segments Yet
            </div>
            <p className="text-sm text-slate-600 max-w-md mx-auto mt-1 mb-4">
              Segments appear automatically as you create contacts and assign them to lists.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-5 py-2.5 text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Your First Contact
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {uniqueLists.map((listNameItem) => {
            const members = contacts.filter((c) => c.listName === listNameItem);
            const optedIn = members.filter((c) => c.consentStatus === 'opted_in').length;
            const segmentValue = members.reduce(
              (sum, c) => sum + (Number(c.ltv) || 0),
              0
            );
            const segmentTags = Array.from(
              new Set(members.flatMap((m) => m.tags || []))
            ).slice(0, 5);

            return (
              <div
                key={listNameItem}
                className="bg-white border border-slate-200 border-t-4 border-t-[#047857] rounded-2xl p-6 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Active Audience Segment
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-500">
                      {members.length} Contacts
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900">
                    {listNameItem}
                  </h3>

                  <div className="grid grid-cols-2 gap-3 my-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <div className="text-[11px] font-bold uppercase text-slate-400">
                        Verified Opt-In
                      </div>
                      <div className="font-display text-lg font-bold text-emerald-700">
                        {optedIn} / {members.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase text-slate-400">
                        Segment LTV
                      </div>
                      <div className="font-display text-lg font-bold text-slate-900">
                        {formatCurrency(segmentValue, currency)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {segmentTags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setListFilter(listNameItem);
                      setSubView('directory');
                    }}
                    className="flex-1 px-3.5 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer text-center"
                  >
                    View Segment Contacts
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCsv(members)}
                    className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer inline-flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        )
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 4: DUPLICATE DETECTION & SMART MERGE CENTER                  */}
      {/* ===================================================================== */}
      {subView === 'duplicates' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-7 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <h3 className="font-display text-2xl font-bold text-slate-900">
                Automated Duplicate Detection & Smart Record Merge
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Scans your CRM database for matching Email addresses, normalized WhatsApp/Phone
                numbers, or duplicate lead captures, and merges tags, custom fields, notes, and
                Deal LTV without losing history.
              </p>
            </div>
          </div>

          {duplicatePairs.length === 0 ? (
            <div className="py-12 text-center bg-emerald-50/50 border border-emerald-200 rounded-2xl p-6">
              <CheckCircle2 className="w-10 h-10 text-[#047857] mx-auto mb-2" />
              <div className="font-display text-xl font-bold text-slate-900">
                Zero Duplicate Records Detected
              </div>
              <p className="text-sm text-slate-600 max-w-md mx-auto mt-1">
                Every contact in your workspace has a unique email and phone identity. If duplicate
                records are ever added or imported, they will appear here for one-click merging.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {duplicatePairs.map(({ primary, duplicate, reason }) => (
                <div
                  key={`${primary.id}_${duplicate.id}`}
                  className="p-5 rounded-2xl bg-[#F8FAFC] border border-slate-300 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold uppercase bg-slate-900 text-white">
                      <AlertCircle className="w-4 h-4 text-emerald-400" />
                      Duplicate Match Reason: {reason}
                    </span>
                    <button
                      type="button"
                      onClick={() => onMergeContacts(primary.id, duplicate.id)}
                      className="px-5 py-2.5 text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer inline-flex items-center gap-2 shadow-xs"
                    >
                      <GitMerge className="w-4 h-4" />
                      Smart Merge Records (Combine LTV:{' '}
                      {formatCurrency((primary.ltv || 0) + (duplicate.ltv || 0), currency)})
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-emerald-300">
                      <div className="text-xs font-bold uppercase text-emerald-700 mb-1">
                        Primary Record (Retained)
                      </div>
                      <div className="font-bold text-base text-slate-900">
                        {primary.fullName}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {primary.email} · {primary.phone}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Stage: <strong>{primary.stage}</strong> · Deal Value:{' '}
                        <strong>{formatCurrency(primary.ltv, currency)}</strong>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {primary.tags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <div className="text-xs font-bold uppercase text-slate-600 mb-1">
                        Duplicate Record (Will Merge & Archive)
                      </div>
                      <div className="font-bold text-base text-slate-900">
                        {duplicate.fullName}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {duplicate.email} · {duplicate.phone}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Stage: <strong>{duplicate.stage}</strong> · Deal Value:{' '}
                        <strong>{formatCurrency(duplicate.ltv, currency)}</strong>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {duplicate.tags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 360° CONTACT PROFILE & CUSTOMER TIMELINE DRAWER                       */}
      {/* ===================================================================== */}
      {selectedContact && (
        <ContactProfileDrawer
          contact={selectedContact}
          automations={automations}
          tasks={tasks}
          activities={activities}
          currency={currency}
          onClose={() => setSelectedContactId(null)}
          onUpdateContact={onUpdateContact}
          onDeleteContact={onDeleteContact}
          onCreateTask={onCreateTask}
          onCompleteTask={onCompleteTask}
          onDeleteTask={onDeleteTask}
          onLogActivity={onLogActivity}
          onSimulateAutomationRun={onSimulateAutomationRun}
        />
      )}

      {/* ===================================================================== */}
      {/* CSV BULK IMPORT & PHASE 2 DAILY KILL-SWITCH ROUTINE MODAL             */}
      {/* ===================================================================== */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full overflow-hidden shadow-xl max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 bg-[#090E1A] text-white flex items-center justify-between shrink-0">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  Phase 2 · Daily 5-Minute Buyer CSV Import &amp; Kill Switch Scanner
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-display text-lg font-bold">
                    Import Contacts / Upload Clean Buyer CSV &amp; Apply Tag
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCsvModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* STEP 1: UPLOAD CLEAN CSV FILE */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Step 1 &amp; 2 · Upload Your Clean .CSV File (Selar, Expertnaire, Stakecut,
                    ClickBank, Excel)
                  </div>
                  <div className="text-xs text-emerald-950 mt-0.5">
                    You only need <strong>one column</strong>: either the{' '}
                    <strong>Buyer&rsquo;s Email Address</strong> or their{' '}
                    <strong>WhatsApp Phone Number</strong> (or upload a multi-column CSV).
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => handleLoadClean1ColumnSample('email')}
                      className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-800 border border-emerald-300 rounded-lg cursor-pointer"
                    >
                      Load 1-Column Buyer Emails (From CRM)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadClean1ColumnSample('phone')}
                      className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-800 border border-emerald-300 rounded-lg cursor-pointer"
                    >
                      Load 1-Column WhatsApp Numbers (From CRM)
                    </button>
                  </div>
                </div>
                <label className="px-4 py-2.5 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer shrink-0 inline-flex items-center gap-1.5 shadow-2xs">
                  <Upload className="w-4 h-4" />
                  Upload Clean .CSV File
                  <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    onChange={handleCsvFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* STEP 3: MAP THE DATA + CRITICAL STEP: APPLY TAG (Purchased_Course) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
                    Map the Data Column
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Ensure the software recognizes the column as Email Address or Phone Number:
                  </p>
                  <select
                    value={csvColumnMapping}
                    onChange={(e) =>
                      setCsvColumnMapping(
                        e.target.value as 'auto' | 'email' | 'phone' | 'full_csv'
                      )
                    }
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#047857]"
                  >
                    <option value="auto">
                      Auto-Detect Column (Email Address or WhatsApp Phone Number)
                    </option>
                    <option value="email">
                      Single Column: Buyer&rsquo;s Email Address
                    </option>
                    <option value="phone">
                      Single Column: Buyer&rsquo;s WhatsApp Phone Number
                    </option>
                    <option value="full_csv">
                      Multi-Column CRM Template (Name, Email, Phone, Stage...)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1">
                    CRITICAL STEP · What tags or labels do you want to apply? *
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Type the exact Kill Switch tag from Phase 1 (e.g.{' '}
                    <span className="font-mono font-bold text-slate-800">Purchased_Course</span>):
                  </p>
                  <input
                    type="text"
                    value={csvApplyTagInput}
                    onChange={(e) => setCsvApplyTagInput(e.target.value)}
                    placeholder="Purchased_Course"
                    className="w-full px-3.5 py-2 text-xs font-mono font-bold bg-white border-2 border-emerald-600 rounded-xl text-slate-900 focus:outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      Quick Tag:
                    </span>
                    {['Purchased_Course', 'VIP_Buyer', 'Purchased_Product'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCsvApplyTagInput(preset)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer ${
                          csvApplyTagInput.trim() === preset
                            ? 'bg-[#090E1A] text-emerald-400'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* UPDATE EXISTING CONTACTS CHECKBOX (NO DUPLICATES) */}
              <div className="p-4 rounded-xl bg-white border-2 border-slate-900 space-y-2.5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={csvUpdateExisting}
                    onChange={(e) => setCsvUpdateExisting(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-[#047857]"
                  />
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900">
                      Update existing contacts (Do not create duplicates — find matching Email or
                      WhatsApp Phone in your system and add the{' '}
                      <span className="font-mono text-[#047857]">
                        {csvApplyTagInput || 'Purchased_Course'}
                      </span>{' '}
                      tag to them)
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      The moment the import finishes, FlowPilot scans those email addresses and
                      WhatsApp phone numbers, notices they received{' '}
                      <strong className="font-mono text-slate-900">
                        {csvApplyTagInput || 'Purchased_Course'}
                      </strong>
                      , triggers the Kill Switch, and immediately stops sending them your affiliate
                      pitch.
                    </div>
                  </div>
                </label>

                <div className="flex flex-wrap items-center gap-5 pt-2 border-t border-slate-100 pl-7">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={csvUpgradeStageToCustomer}
                      onChange={(e) => setCsvUpgradeStageToCustomer(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#047857]"
                    />
                    <span>Also mark matched buyers as &ldquo;Customer&rdquo; stage in CRM</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={csvCreateUnmatched}
                      onChange={(e) => setCsvCreateUnmatched(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#047857]"
                    />
                    <span>Create new contact if buyer is not in CRM yet</span>
                  </label>
                </div>
              </div>

              {/* RAW CSV TEXTAREA */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Clean CSV Data ({parsedCsvEntries.length} buyer row(s) recognized ·{' '}
                  {parsedCsvEntries.filter((e) => e.existingContact).length} matched existing CRM
                  contact(s))
                </label>
                <textarea
                  rows={5}
                  value={csvRawText}
                  onChange={(e) => setCsvRawText(e.target.value)}
                  placeholder={`Buyer Email or WhatsApp Phone\namara@kineticdesign.co\n+1 415 890 3319`}
                  className="w-full px-3.5 py-2.5 font-mono text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                />
              </div>

              {/* LIVE COLUMN MAPPING & KILL SWITCH PREVIEW */}
              {parsedCsvEntries.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-[#090E1A] text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between">
                    <span>
                      Mapped Preview &amp; Kill Switch Verification ({parsedCsvEntries.length}{' '}
                      Contacts)
                    </span>
                    <span className="font-mono text-emerald-400">
                      Tag to Apply: #{csvApplyTagInput || 'Purchased_Course'}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-200 max-h-44 overflow-y-auto">
                    {parsedCsvEntries.map((entry, idx) => (
                      <div
                        key={idx}
                        className="px-4 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white"
                      >
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              Recognized: {entry.recognizedAs}
                            </span>
                            <span className="font-bold text-slate-900">
                              {entry.payload.fullName}
                            </span>
                            <span className="text-slate-500 font-mono">
                              {entry.payload.email}
                              {entry.payload.phone ? ` · ${entry.payload.phone}` : ''}
                            </span>
                          </div>
                          <div className="text-[11px]">
                            {entry.existingContact ? (
                              <span className="text-emerald-800 font-bold">
                                ✓ Matched Existing Contact in CRM by{' '}
                                {entry.matchedBy === 'phone'
                                  ? 'WhatsApp Phone Number'
                                  : 'Email Address'}{' '}
                                &rarr; Will update &amp; apply tag #
                                {csvApplyTagInput || 'Purchased_Course'} (No duplicate)
                              </span>
                            ) : (
                              <span className="text-slate-500">
                                {csvCreateUnmatched
                                  ? `+ Not in CRM yet -> Will create contact with tag #${
                                      csvApplyTagInput || 'Purchased_Course'
                                    }`
                                  : 'Skipped (Update existing contacts only)'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0">
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-emerald-50 text-emerald-900 border border-emerald-200">
                            Triggers Kill Switch
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCsvModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={csvImporting || parsedCsvEntries.length === 0}
                  onClick={handleConfirmCsvImport}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {csvImporting
                    ? 'Scanning & Applying Kill Switch...'
                    : `Finish Import & Apply "${
                        csvApplyTagInput || 'Purchased_Course'
                      }" (${parsedCsvEntries.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CREATE / EDIT CONTACT MODAL                                           */}
      {/* ===================================================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full overflow-hidden shadow-xl max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 bg-[#090E1A] text-white flex items-center justify-between shrink-0">
              <h3 className="font-display text-lg font-bold">
                {editingContact ? 'Edit CRM Contact Record' : 'Add Verified CRM Contact'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Amara Nwosu"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
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
                    placeholder="amara@company.com"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Phone / WhatsApp (E.164)
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 415 890 3319"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Company / Brand
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Kinetic Design Co."
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Deal / Opportunity Title
                  </label>
                  <input
                    type="text"
                    value={dealTitle}
                    onChange={(e) => setDealTitle(e.target.value)}
                    placeholder="Q4 Retainer Package"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Pipeline Stage
                  </label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value as ContactStage)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                  >
                    <option value="lead">Lead</option>
                    <option value="warm_lead">Warm Lead</option>
                    <option value="qualified">Qualified</option>
                    <option value="customer">Customer</option>
                    <option value="churned">Churned</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Lead Temperature
                  </label>
                  <select
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value as LeadTemperature)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                  >
                    <option value="hot">Hot</option>
                    <option value="warm">Warm</option>
                    <option value="cold">Cold</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Deal Value / LTV ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={ltv}
                    onChange={(e) => setLtv(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Target List / Segment
                  </label>
                  <input
                    type="text"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    placeholder="Weekly Dispatch Subscribers"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Acquisition Source
                  </label>
                  <input
                    type="text"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="Creator Growth Blueprint LP"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Consent Status
                  </label>
                  <select
                    value={consentStatus}
                    onChange={(e) => setConsentStatus(e.target.value as ConsentStatus)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                  >
                    <option value="opted_in">Opted-In (Verified)</option>
                    <option value="pending_double_opt_in">Pending Double Opt-In</option>
                    <option value="unsubscribed">Unsubscribed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Communication Channel Preferences
                </label>
                <div className="flex flex-wrap gap-2">
                  {['email', 'whatsapp', 'sms'].map((ch) => {
                    const active = commChannels.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => handleToggleFormCommChannel(ch)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase border cursor-pointer ${
                          active
                            ? 'bg-emerald-50 border-[#047857] text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}
                        {ch}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Tags (comma-separated, max 10)
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="vip-buyer, whatsapp-verified"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Custom Fields (Key: Value, comma-separated)
                  </label>
                  <input
                    type="text"
                    value={customFieldsInput}
                    onChange={(e) => setCustomFieldsInput(e.target.value)}
                    placeholder="Role: Founder, Team Size: 12"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  CRM Context Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Qualification context, discovery call notes, or product interest..."
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {submitting
                    ? 'Saving...'
                    : editingContact
                    ? 'Save Changes'
                    : 'Create Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
