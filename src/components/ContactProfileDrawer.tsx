import React, { useState } from 'react';
import {
  X,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Tag,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  GitBranch,
  MessageSquare,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  Flame,
  Sparkles,
  CheckSquare,
  Activity,
  Send,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import {
  Contact,
  ContactStage,
  LeadTemperature,
  ConsentStatus,
  CurrencyCode,
  Automation,
  TaskItem,
  TaskCategory,
  TaskPriority,
  ActivityLog,
  formatCurrency,
  sanitizeString,
  sanitizeStringArray,
} from '../types';

interface ContactProfileDrawerProps {
  contact: Contact;
  automations: Automation[];
  tasks: TaskItem[];
  activities: ActivityLog[];
  currency: CurrencyCode;
  onClose: () => void;
  onUpdateContact: (
    id: string,
    data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onDeleteContact: (id: string) => Promise<void>;
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

type ProfileTab = 'overview' | 'timeline' | 'automations' | 'tasks' | 'consent';

export const ContactProfileDrawer: React.FC<ContactProfileDrawerProps> = ({
  contact,
  automations,
  tasks,
  activities,
  currency,
  onClose,
  onUpdateContact,
  onDeleteContact,
  onCreateTask,
  onCompleteTask,
  onDeleteTask,
  onLogActivity,
  onSimulateAutomationRun,
}) => {
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');

  // Inline states for Overview tab
  const [newTag, setNewTag] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customVal, setCustomVal] = useState('');
  const [notesDraft, setNotesDraft] = useState(contact.notes || '');
  const [notesSavedBanner, setNotesSavedBanner] = useState(false);

  // Inline state for logging interaction
  const [interactionTitle, setInteractionTitle] = useState('');
  const [interactionDetail, setInteractionDetail] = useState('');
  const [interactionChannel, setInteractionChannel] =
    useState<ActivityLog['channel']>('whatsapp');
  const [interactionType, setInteractionType] =
    useState<ActivityLog['eventType']>('whatsapp_replied');
  const [loggingInteraction, setLoggingInteraction] = useState(false);

  // Inline state for creating a contact task/reminder
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('Tomorrow · 2:00 PM');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('high');
  const [taskCategory, setTaskCategory] = useState<TaskCategory>('follow_up');
  const [creatingTask, setCreatingTask] = useState(false);

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState(false);

  const buildPayload = (
    overrides: Partial<
      Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
    >
  ): Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'> => ({
    fullName: contact.fullName,
    email: contact.email,
    phone: contact.phone,
    company: contact.company || '',
    dealTitle: contact.dealTitle || '',
    stage: contact.stage,
    temperature: contact.temperature,
    source: contact.source,
    consentStatus: contact.consentStatus,
    commChannels: contact.commChannels || ['email'],
    listName: contact.listName,
    tags: contact.tags || [],
    ltv: contact.ltv || 0,
    notes: contact.notes || '',
    customFields: contact.customFields || [],
    ...overrides,
  });

  const handleStageChange = async (newStage: ContactStage) => {
    await onUpdateContact(contact.id, buildPayload({ stage: newStage }));
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeString(newTag.toLowerCase(), 32);
    if (!cleaned || contact.tags.includes(cleaned) || contact.tags.length >= 10) return;
    const updatedTags = sanitizeStringArray([...contact.tags, cleaned], 10, 32);
    await onUpdateContact(contact.id, buildPayload({ tags: updatedTags }));
    setNewTag('');
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updatedTags = contact.tags.filter((t) => t !== tagToRemove);
    await onUpdateContact(contact.id, buildPayload({ tags: updatedTags }));
  };

  const handleAddCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    const k = sanitizeString(customKey, 40);
    const v = sanitizeString(customVal, 75);
    if (!k || !v) return;
    const currentFields = contact.customFields || [];
    if (currentFields.length >= 15) return;
    const entry = `${k}: ${v}`.slice(0, 120);
    await onUpdateContact(
      contact.id,
      buildPayload({ customFields: [...currentFields, entry] })
    );
    setCustomKey('');
    setCustomVal('');
  };

  const handleRemoveCustomField = async (entryToRemove: string) => {
    const currentFields = contact.customFields || [];
    await onUpdateContact(
      contact.id,
      buildPayload({ customFields: currentFields.filter((f) => f !== entryToRemove) })
    );
  };

  const handleSaveNotes = async () => {
    await onUpdateContact(
      contact.id,
      buildPayload({ notes: sanitizeString(notesDraft, 500) })
    );
    setNotesSavedBanner(true);
    setTimeout(() => setNotesSavedBanner(false), 2500);
  };

  const handleLogInteractionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interactionTitle.trim()) return;
    setLoggingInteraction(true);
    try {
      await onLogActivity(
        interactionType,
        `${contact.fullName}: ${interactionTitle.trim()}`.slice(0, 160),
        (interactionDetail.trim() || `Logged on ${contact.fullName}'s CRM record`).slice(
          0,
          280
        ),
        interactionChannel
      );
      setInteractionTitle('');
      setInteractionDetail('');
    } finally {
      setLoggingInteraction(false);
    }
  };

  const handleAddTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setCreatingTask(true);
    try {
      await onCreateTask({
        title: sanitizeString(taskTitle, 160),
        category: taskCategory,
        priority: taskPriority,
        dueDate: sanitizeString(taskDueDate, 40, 'Tomorrow'),
        relatedEntity: `${contact.fullName} (${contact.company || contact.email})`.slice(
          0,
          100
        ),
        status: 'pending',
      });
      setTaskTitle('');
    } finally {
      setCreatingTask(false);
    }
  };

  const handleToggleCommChannel = async (channel: string) => {
    const current = contact.commChannels || ['email'];
    const exists = current.includes(channel);
    const updated = exists
      ? current.filter((c) => c !== channel)
      : [...current, channel].slice(0, 5);
    await onUpdateContact(contact.id, buildPayload({ commChannels: updated }));
  };

  const handleConsentChange = async (status: ConsentStatus) => {
    await onUpdateContact(contact.id, buildPayload({ consentStatus: status }));
  };

  // Filter tasks & activities related to this contact
  const contactTasks = tasks.filter(
    (t) =>
      t.relatedEntity.toLowerCase().includes(contact.fullName.toLowerCase()) ||
      t.relatedEntity.toLowerCase().includes(contact.email.toLowerCase()) ||
      t.title.toLowerCase().includes(contact.fullName.toLowerCase())
  );

  const contactActivities = activities.filter(
    (a) =>
      a.title.toLowerCase().includes(contact.fullName.toLowerCase()) ||
      a.detail.toLowerCase().includes(contact.fullName.toLowerCase()) ||
      a.detail.toLowerCase().includes(contact.listName.toLowerCase()) ||
      a.title.toLowerCase().includes(contact.source.toLowerCase())
  );

  // Export single contact GDPR JSON portability dossier
  const handleExportContactJson = () => {
    const dossier = {
      exportedAt: new Date().toISOString(),
      platform: 'FlowPilot CRM — Data Portability Export (GDPR/CCPA)',
      contactRecord: contact,
      consentAndPreferences: {
        consentStatus: contact.consentStatus,
        consentedChannels: contact.commChannels || ['email'],
        acquisitionSource: contact.source,
        segmentList: contact.listName,
      },
      customFields: contact.customFields || [],
      linkedTasks: contactTasks,
      interactionTimeline: contactActivities,
    };
    const blob = new Blob([JSON.stringify(dossier, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowpilot-contact-${contact.fullName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportContactCsv = () => {
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
    const row = [
      contact.fullName,
      contact.email,
      contact.phone,
      contact.company || '',
      contact.dealTitle || '',
      contact.stage,
      contact.temperature,
      String(contact.ltv || 0),
      contact.source,
      contact.consentStatus,
      (contact.commChannels || ['email']).join('; '),
      contact.listName,
      (contact.tags || []).join('; '),
      (contact.customFields || []).join(' | '),
      contact.notes || '',
    ].map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`);

    const csv = [headers.join(','), row.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowpilot-contact-${contact.fullName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stagesOrder: { id: ContactStage; label: string }[] = [
    { id: 'lead', label: 'Lead' },
    { id: 'warm_lead', label: 'Warm Lead' },
    { id: 'qualified', label: 'Qualified' },
    { id: 'customer', label: 'Customer' },
    { id: 'churned', label: 'Churned' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex justify-end">
      <div className="bg-[#F8FAFC] w-full max-w-3xl h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden">
        {/* Two-Color Slate Ink & Emerald Header */}
        <div className="bg-[#0F172A] text-white p-6 lg:p-7 shrink-0 border-b border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-display font-bold text-2xl shadow-md shrink-0">
                {contact.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5 mb-1">
                  <h2 className="font-display text-2xl font-bold text-white tracking-tight">
                    {contact.fullName}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                      contact.temperature === 'hot'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                        : contact.temperature === 'warm'
                        ? 'bg-slate-800 text-slate-200 border border-slate-700'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5 text-emerald-400" />
                    {contact.temperature}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                      contact.consentStatus === 'opted_in'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {contact.consentStatus.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
                  {contact.company && (
                    <span className="inline-flex items-center gap-1.5 font-medium text-emerald-300">
                      <Building2 className="w-4 h-4 text-emerald-400" />
                      {contact.company}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {contact.email}
                  </span>
                  {contact.phone && (
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      {contact.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right mr-2 hidden sm:block">
                <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">
                  Deal / LTV Value
                </div>
                <div className="font-display text-2xl font-bold text-white">
                  {formatCurrency(contact.ltv || 0, currency)}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                title="Close 360° Profile"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Interactive Pipeline Stage Stepper inside Header */}
          <div className="mt-5 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
              <span className="font-bold uppercase tracking-wider text-emerald-400">
                Lead Pipeline Stage (Click to Move)
              </span>
              {contact.dealTitle && (
                <span className="inline-flex items-center gap-1.5 text-slate-200 font-medium">
                  <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                  Active Deal: {contact.dealTitle}
                </span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {stagesOrder.map((st) => {
                const isCurrent = contact.stage === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleStageChange(st.id)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
                      isCurrent
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-1 overflow-x-auto shrink-0">
          {[
            { id: 'overview', label: 'Overview & Custom Fields', icon: Sliders },
            {
              id: 'timeline',
              label: `Interactions (${contactActivities.length})`,
              icon: Activity,
            },
            {
              id: 'automations',
              label: `Automations (${automations.length})`,
              icon: GitBranch,
            },
            {
              id: 'tasks',
              label: `Tasks & Reminders (${contactTasks.length})`,
              icon: CheckSquare,
            },
            { id: 'consent', label: 'Consent & Data Export', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as ProfileTab)}
                className={`inline-flex items-center gap-2 px-4 py-3.5 text-sm font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-[#047857] text-[#047857] bg-emerald-50/40'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-7 space-y-6">
          {/* TAB 1: OVERVIEW, DEAL FIELDS, TAGS, CUSTOM FIELDS, NOTES */}
          {activeTab === 'overview' && (
            <>
              {/* Key CRM Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Company / Organization
                  </div>
                  <div className="text-base font-bold text-slate-900">
                    {contact.company || 'Independent / Creator'}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Deal / Opportunity Title
                  </div>
                  <div className="text-base font-bold text-slate-900">
                    {contact.dealTitle || 'General Funnel Lead'}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Primary Audience List / Segment
                  </div>
                  <div className="text-base font-bold text-emerald-800">
                    {contact.listName}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Acquisition Source
                  </div>
                  <div className="text-base font-bold text-slate-900">
                    {contact.source}
                  </div>
                </div>
              </div>

              {/* Segmentation Tags Manager */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[#047857]" />
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Audience Tags ({contact.tags.length}/10)
                    </h3>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {contact.tags.length === 0 ? (
                    <span className="text-sm text-slate-400">No tags assigned yet.</span>
                  ) : (
                    contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-200"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-emerald-700 hover:text-rose-600 cursor-pointer"
                          title="Remove tag"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <form onSubmit={handleAddTag} className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add segmentation tag (e.g. vip-cohort, webinar-attended)..."
                    className="flex-1 px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Add Tag
                  </button>
                </form>
              </div>

              {/* Custom CRM Fields Manager */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#047857]" />
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Custom Fields ({(contact.customFields || []).length}/15)
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    Dynamic key-value attributes for personalization
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                  {(contact.customFields || []).length === 0 ? (
                    <div className="col-span-2 text-sm text-slate-400 py-2">
                      No custom fields recorded for this contact yet. Add attributes like Role,
                      Industry, Instagram Handle, or Contract Renewal below.
                    </div>
                  ) : (
                    (contact.customFields || []).map((field) => {
                      const [k, ...rest] = field.split(':');
                      const v = rest.join(':').trim();
                      return (
                        <div
                          key={field}
                          className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                        >
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
                              {k}
                            </div>
                            <div className="text-sm font-bold text-slate-900 truncate">
                              {v || field}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomField(field)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                            title="Remove custom field"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <form
                  onSubmit={handleAddCustomField}
                  className="grid grid-cols-1 sm:grid-cols-5 gap-2"
                >
                  <input
                    type="text"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    placeholder="Field Name (e.g. Role)"
                    className="sm:col-span-2 px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                  />
                  <input
                    type="text"
                    value={customVal}
                    onChange={(e) => setCustomVal(e.target.value)}
                    placeholder="Field Value (e.g. Founder & CEO)"
                    className="sm:col-span-2 px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Add Field
                  </button>
                </form>
              </div>

              {/* Contact Notes */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    CRM Dossier & Call Notes
                  </h3>
                  {notesSavedBanner && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                      Notes Saved!
                    </span>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Record qualification notes, discovery call takeaways, or deal context..."
                  className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#047857] mb-3"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    className="px-4 py-2 text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer"
                  >
                    Save CRM Notes
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: INTERACTION HISTORY & TIMELINE */}
          {activeTab === 'timeline' && (
            <>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-1">
                  Log New Touchpoint or Interaction
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Record an outbound call, WhatsApp reply, email touchpoint, or discovery meeting
                  directly onto {contact.fullName}’s customer journey timeline.
                </p>
                <form onSubmit={handleLogInteractionSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Channel
                      </label>
                      <select
                        value={interactionChannel}
                        onChange={(e) =>
                          setInteractionChannel(e.target.value as ActivityLog['channel'])
                        }
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                      >
                        <option value="whatsapp">Official WhatsApp Cloud API</option>
                        <option value="email">Email Touchpoint</option>
                        <option value="sms">Direct SMS</option>
                        <option value="crm">CRM Call / Meeting Note</option>
                        <option value="web">Landing Page / Web Event</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Event Category
                      </label>
                      <select
                        value={interactionType}
                        onChange={(e) =>
                          setInteractionType(e.target.value as ActivityLog['eventType'])
                        }
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                      >
                        <option value="whatsapp_replied">WhatsApp / Direct Reply</option>
                        <option value="stage_converted">Pipeline / Discovery Call</option>
                        <option value="campaign_sent">Direct Broadcast / Email Sent</option>
                        <option value="lead_captured">Form / Asset Interaction</option>
                      </select>
                    </div>
                  </div>
                  <input
                    type="text"
                    required
                    value={interactionTitle}
                    onChange={(e) => setInteractionTitle(e.target.value)}
                    placeholder="Interaction summary (e.g. Completed 20-min Q4 Strategy Call)"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                  />
                  <input
                    type="text"
                    value={interactionDetail}
                    onChange={(e) => setInteractionDetail(e.target.value)}
                    placeholder="Outcome / Next steps (e.g. Sent custom retainer proposal via WhatsApp)"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={loggingInteraction}
                      className="px-4 py-2.5 text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer inline-flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      {loggingInteraction ? 'Recording...' : 'Record Interaction to Timeline'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-4">
                  Chronological Customer Journey ({contactActivities.length + 1} Events)
                </h3>
                <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {contactActivities.map((act) => (
                    <div key={act.id} className="relative pl-10">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center absolute left-0 top-0.5">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-bold text-slate-900">{act.title}</span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase bg-white border border-slate-200 text-slate-600">
                            {act.channel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{act.detail}</p>
                      </div>
                    </div>
                  ))}

                  {/* Initial Acquisition Anchor Event */}
                  <div className="relative pl-10">
                    <div className="w-8 h-8 rounded-lg bg-[#0F172A] text-emerald-400 flex items-center justify-center absolute left-0 top-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-900">
                          Contact Created & Opt-In Recorded ({contact.consentStatus})
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase bg-emerald-50 border border-emerald-200 text-emerald-800">
                          Origin
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Captured via {contact.source} · Assigned to list &ldquo;{contact.listName}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 3: AUTOMATION HISTORY & WORKFLOW ENROLLMENT */}
          {activeTab === 'automations' && (
            <div className="space-y-4">
              <div className="bg-emerald-950 text-white rounded-2xl p-5">
                <h3 className="font-display text-lg font-bold mb-1">
                  Visual Automation Enrollment & Execution History
                </h3>
                <p className="text-sm text-emerald-200">
                  View workflows matching {contact.fullName}’s tags and segment, or trigger an
                  immediate multi-channel automation run for this contact.
                </p>
              </div>

              {automations.map((auto) => {
                const isEnrolled =
                  auto.status === 'active' &&
                  (contact.stage === 'customer' ||
                    contact.temperature === 'hot' ||
                    contact.tags.length > 0);
                return (
                  <div
                    key={auto.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-display text-lg font-bold text-slate-900">
                            {auto.name}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase ${
                              isEnrolled
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isEnrolled ? 'Enrolled & Completed' : 'Available'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Trigger: {auto.triggerDetail} · Channels:{' '}
                          {auto.channels.map((c) => c.toUpperCase()).join(' + ')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await onSimulateAutomationRun(auto);
                          await onLogActivity(
                            'automation_triggered',
                            `${contact.fullName} enrolled in "${auto.name}"`,
                            `Executed ${auto.stepsSummary.length} steps across ${auto.channels.join(
                              ' + '
                            )}`,
                            (auto.channels[0] as ActivityLog['channel']) || 'email'
                          );
                        }}
                        className="px-4 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer shrink-0 inline-flex items-center gap-1.5"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                        Run Workflow for Contact
                      </button>
                    </div>
                    <div className="space-y-1.5 pt-3 border-t border-slate-100">
                      {auto.stepsSummary.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-lg"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: TASKS & REMINDERS */}
          {activeTab === 'tasks' && (
            <>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-1">
                  Schedule Task or Follow-Up Reminder
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Assign a follow-up call, proposal review, or onboarding check-in linked directly
                  to {contact.fullName}.
                </p>
                <form onSubmit={handleAddTaskSubmit} className="space-y-3">
                  <input
                    type="text"
                    required
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder={`e.g. Send Q4 Retainer Contract to ${contact.fullName}`}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Due Date / Reminder
                      </label>
                      <input
                        type="text"
                        value={taskDueDate}
                        onChange={(e) => setTaskDueDate(e.target.value)}
                        placeholder="Tomorrow · 2:00 PM"
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Priority
                      </label>
                      <select
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                      >
                        <option value="high">High Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="low">Low Priority</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Category
                      </label>
                      <select
                        value={taskCategory}
                        onChange={(e) => setTaskCategory(e.target.value as TaskCategory)}
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                      >
                        <option value="follow_up">Follow-Up Call</option>
                        <option value="onboarding">Client Onboarding</option>
                        <option value="campaign_review">Campaign / Deal Review</option>
                        <option value="compliance_check">Compliance Verification</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={creatingTask}
                      className="px-4 py-2.5 text-sm font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      {creatingTask ? 'Saving Reminder...' : 'Add CRM Reminder'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-3">
                  Linked Tasks & Reminders ({contactTasks.length})
                </h3>
                {contactTasks.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">
                    No tasks currently linked to {contact.fullName}. Add a reminder above!
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {contactTasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => onCompleteTask(t)}
                            className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer ${
                              t.status === 'completed'
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'bg-white border-slate-300 hover:border-emerald-600'
                            }`}
                          >
                            {t.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                          <div>
                            <div
                              className={`text-sm font-bold ${
                                t.status === 'completed'
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-900'
                              }`}
                            >
                              {t.title}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{t.dueDate}</span>
                              <span>·</span>
                              <span className="uppercase font-bold text-emerald-700">
                                {t.priority}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteTask(t.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Delete task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 5: CONSENT, COMMUNICATION PREFERENCES & GDPR DATA EXPORT / DELETION */}
          {activeTab === 'consent' && (
            <>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-5">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900 mb-1">
                    Explicit Consent & Opt-In Governance
                  </h3>
                  <p className="text-sm text-slate-600 mb-3">
                    FlowPilot enforces strict opt-in compliance before dispatching any Email,
                    Official WhatsApp Cloud API, or SMS message.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {(
                      [
                        {
                          id: 'opted_in',
                          label: 'Verified Opt-In',
                          desc: 'Eligible for broadcasts & workflows',
                        },
                        {
                          id: 'pending_double_opt_in',
                          label: 'Pending Double Opt-In',
                          desc: 'Awaiting confirmation click',
                        },
                        {
                          id: 'unsubscribed',
                          label: 'Unsubscribed',
                          desc: 'Suppressed from all outbound sends',
                        },
                      ] as { id: ConsentStatus; label: string; desc: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleConsentChange(opt.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          contact.consentStatus === opt.id
                            ? 'bg-emerald-50 border-[#047857] ring-1 ring-[#047857]'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-sm font-bold text-slate-900">{opt.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">
                    Granular Communication Channel Preferences
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'email', label: 'Email Dispatches', sub: 'Transactional & Newsletters' },
                      {
                        id: 'whatsapp',
                        label: 'Official WhatsApp API',
                        sub: 'Approved Template Messages',
                      },
                      { id: 'sms', label: 'Direct SMS Alerts', sub: 'Time-sensitive notifications' },
                    ].map((ch) => {
                      const active = (contact.commChannels || ['email']).includes(ch.id);
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => handleToggleCommChannel(ch.id)}
                          className={`p-3.5 rounded-xl border text-left flex items-start justify-between gap-2 cursor-pointer ${
                            active
                              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                              : 'bg-slate-50 border-slate-200 text-slate-500'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-bold">{ch.label}</div>
                            <div className="text-xs opacity-75 mt-0.5">{ch.sub}</div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
                              active ? 'bg-[#047857] text-white' : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {active ? '✓' : ''}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Data Portability & Export Tools */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-1">
                  Contact Data Portability & Export Tools (GDPR / CCPA)
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Download a complete machine-readable archive of {contact.fullName}’s personal
                  data, custom attributes, consent status, tasks, and timeline logs.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleExportContactJson}
                    className="px-4 py-2.5 text-sm font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl cursor-pointer inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4 text-[#047857]" />
                    Export Full GDPR Dossier (.JSON)
                  </button>
                  <button
                    type="button"
                    onClick={handleExportContactCsv}
                    className="px-4 py-2.5 text-sm font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl cursor-pointer inline-flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#047857]" />
                    Export Contact Sheet (.CSV)
                  </button>
                </div>
              </div>

              {/* Right to Erasure / Contact Deletion */}
              <div className="bg-slate-100 border border-slate-300 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-slate-700" />
                      Right to Erasure & Permanent Contact Deletion
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Permanently purge {contact.fullName} ({contact.email}) from your workspace CRM
                      database.
                    </p>
                  </div>
                  {!confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="px-4 py-2.5 text-sm font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl cursor-pointer shrink-0"
                    >
                      Delete Contact
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await onDeleteContact(contact.id);
                          onClose();
                        }}
                        className="px-4 py-2 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg cursor-pointer"
                      >
                        Confirm Erase
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
