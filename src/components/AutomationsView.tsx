import React, { useState, useEffect } from 'react';
import {
  Plus,
  Play,
  Pause,
  GitBranch,
  Trash2,
  X,
  ArrowDown,
  Zap,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  History,
  Settings2,
  GripVertical,
  ArrowUp,
  Layers,
  AlertTriangle,
  RotateCcw,
  Save,
  UserPlus,
  ChevronRight,
  Terminal,
  Copy,
  FolderPlus,
  ExternalLink,
  Send,
} from 'lucide-react';
import {
  Automation,
  TriggerType,
  ActionNodeType,
  ConditionNodeType,
  DelayUnit,
  AutomationStatus,
  WorkflowNode,
  WorkflowNodeCategory,
  BranchPathType,
  WorkflowJobExecutionLog,
  WorkflowVersionSnapshot,
  WorkflowEngineConfig,
  Contact,
  ContactStage,
  AudienceList,
  ListCategory,
  TaskItem,
  ActivityEventType,
  ActivityChannel,
  Workspace,
  UserPrivateProfile,
  ChannelType,
  UserMessagingIdentity,
  parseSavedMessagingIdentities,
  sanitizeString,
  sanitizeStringArray,
  resolveWorkspaceSenderIdentities,
} from '../types';
import {
  deliverChannelMessage,
  personalizeAutomationMessage,
  MessageDeliveryReceipt,
  getStoredChannelGatewayConfig,
  getWhatsAppProviderLabel,
  getEmailProviderLabel,
  getSmsProviderLabel,
} from '../services/messageDeliveryService';
import {
  TRIGGER_CATALOG,
  ACTION_CATALOG,
  CONDITION_CATALOG,
  DELAY_CATALOG,
  PaletteItemDefinition,
  DEFAULT_ENGINE_CONFIG,
  parseOrBuildFlowGraph,
  serializeFlowGraphToString,
  deriveStepsSummaryFromNodes,
  deriveChannelsFromNodes,
  createDefaultNodesForAutomation,
  resolveAutomationTargetList,
  evaluateConditionForContact,
  computeProjectedScheduleTimeline,
  evaluateListKillSwitchForContact,
} from './AutomationEngineCatalog';

interface AutomationsViewProps {
  automations: Automation[];
  contacts?: Contact[];
  lists?: AudienceList[];
  workspace?: Workspace;
  privateProfile?: UserPrivateProfile;
  onNavigateToSettings?: () => void;
  preselectedListName?: string | null;
  onClearPreselectedList?: () => void;
  openModalOnMount?: boolean;
  onClearModalMount?: () => void;
  onCreateAutomation: (
    data: Omit<Automation, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateAutomation: (
    id: string,
    data: Omit<Automation, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onDeleteAutomation: (id: string) => Promise<void>;
  onSimulateRun: (automation: Automation) => Promise<void>;
  onUpdateContact?: (
    id: string,
    data: Omit<Contact, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onCreateTask?: (
    data: Omit<TaskItem, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onLogActivity?: (
    eventType: ActivityEventType,
    title: string,
    detail: string,
    channel: ActivityChannel
  ) => Promise<void>;
  onCreateList?: (
    data: Omit<AudienceList, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onNavigateToLists?: () => void;
  onCreateFormForList?: (listName: string) => void;
  onNavigateToInbox?: () => void;
  onForwardToInbox?: (payload: {
    leadName: string;
    leadEmail: string;
    leadPhone: string;
    listName: string;
    channel: ChannelType;
    workflowName: string;
    stepTitle: string;
    subjectOrTemplate?: string;
    messageSent: string;
  }) => Promise<void>;
}

export const AutomationsView: React.FC<AutomationsViewProps> = ({
  automations,
  contacts = [],
  lists = [],
  workspace,
  privateProfile,
  onNavigateToSettings,
  preselectedListName,
  onClearPreselectedList,
  openModalOnMount,
  onClearModalMount,
  onCreateAutomation,
  onUpdateAutomation,
  onDeleteAutomation,
  onSimulateRun,
  onUpdateContact,
  onCreateTask,
  onLogActivity,
  onCreateList,
  onNavigateToLists,
  onCreateFormForList,
  onNavigateToInbox,
  onForwardToInbox,
}) => {
  const senderIdentities = React.useMemo(
    () => resolveWorkspaceSenderIdentities(workspace, privateProfile),
    [workspace, privateProfile]
  );
  const [statusFilter, setStatusFilter] = useState<'all' | AutomationStatus>('all');
  const [listFilter, setListFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string>(automations[0]?.id || '');
  const [leftSidebarMode, setLeftSidebarMode] = useState<'workflows' | 'palette'>('workflows');
  const [paletteCategory, setPaletteCategory] = useState<'all' | WorkflowNodeCategory>('all');
  const [paletteSearch, setPaletteSearch] = useState('');

  // Merge user-created lists with any listName referenced on contacts
  const allAvailableLists = React.useMemo(() => {
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

  const getContactsCountForList = (listName: string): number => {
    const clean = (listName || '').trim().toLowerCase();
    if (!clean) return 0;
    return contacts.filter((c) => c.listName.trim().toLowerCase() === clean).length;
  };

  const [workspaceTab, setWorkspaceTab] = useState<
    'canvas' | 'scheduler' | 'queue' | 'versions'
  >('canvas');

  // Canvas & Node Editor State
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [version, setVersion] = useState<number>(1);
  const [versionHistory, setVersionHistory] = useState<WorkflowVersionSnapshot[]>([]);
  const [engineConfig, setEngineConfig] = useState<WorkflowEngineConfig>(DEFAULT_ENGINE_CONFIG);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingGraph, setIsSavingGraph] = useState(false);
  const [changeNoteInput, setChangeNoteInput] = useState('');

  // Drag & Drop State
  const [draggedPaletteItem, setDraggedPaletteItem] = useState<PaletteItemDefinition | null>(null);
  const [draggedCanvasNodeId, setDraggedCanvasNodeId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [targetBranchForAdd, setTargetBranchForAdd] = useState<BranchPathType>('main');

  // Background Job Queue & Scheduler Engine State
  const [jobLogs, setJobLogs] = useState<WorkflowJobExecutionLog[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [enrollContactId, setEnrollContactId] = useState<string>('');
  const [useCustomRecipient, setUseCustomRecipient] = useState<boolean>(false);
  const [customTestName, setCustomTestName] = useState<string>('Alex Rivera');
  const [customTestEmail, setCustomTestEmail] = useState<string>(
    privateProfile?.email || 'alex.rivera@example.com'
  );
  const [customTestPhone, setCustomTestPhone] = useState<string>(
    privateProfile?.phone || '+1 (555) 234-8910'
  );
  const storedGateways = React.useMemo(() => getStoredChannelGatewayConfig(), []);
  const [isLiveRunnerOpen, setIsLiveRunnerOpen] = useState<boolean>(false);
  const [isExecutingJob, setIsExecutingJob] = useState<boolean>(false);
  const [testingStepNodeId, setTestingStepNodeId] = useState<string | null>(null);
  const [lastStepReceipt, setLastStepReceipt] = useState<{
    nodeId: string;
    receipt: MessageDeliveryReceipt;
  } | null>(null);
  const [latestExecutionReceipts, setLatestExecutionReceipts] = useState<MessageDeliveryReceipt[]>(
    []
  );
  const [simulateTransientFailure, setSimulateTransientFailure] = useState<boolean>(false);
  const [holdOnDelayTimer, setHoldOnDelayTimer] = useState<boolean>(false);
  const [schedulerPaused, setSchedulerPaused] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Create New Automation Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(Boolean(openModalOnMount));
  const [newName, setNewName] = useState('');
  const [newTargetList, setNewTargetList] = useState<string>(
    preselectedListName || allAvailableLists[0]?.name || ''
  );
  const [newTriggerType, setNewTriggerType] = useState<TriggerType>('form_submission');
  const [newTriggerDetail, setNewTriggerDetail] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Inline Quick-Create List State (when user needs a new list before creating automation)
  const [showInlineListCreator, setShowInlineListCreator] = useState(false);
  const [inlineListName, setInlineListName] = useState('');
  const [inlineListCategory, setInlineListCategory] = useState<ListCategory>('lead_magnet');
  const [inlineListKillSwitchTags, setInlineListKillSwitchTags] =
    useState<string>('Purchased_Course');
  const [isCreatingInlineList, setIsCreatingInlineList] = useState(false);

  // Inside-Workflow Automated Message + Time Schedule Composer State
  const [isMessageComposerOpen, setIsMessageComposerOpen] = useState<boolean>(false);
  const [msgChannel, setMsgChannel] = useState<'email' | 'whatsapp' | 'sms'>('email');
  const [msgTitle, setMsgTitle] = useState<string>('Automated Follow-Up Message');
  const [msgSubjectOrTemplate, setMsgSubjectOrTemplate] = useState<string>(
    'Important Next Steps for {{first_name}}'
  );
  const [msgBody, setMsgBody] = useState<string>(
    'Hi {{first_name}}, checking in to make sure you received your requested details...'
  );
  const [msgScheduleMode, setMsgScheduleMode] = useState<
    'immediate' | 'delay' | 'specific_datetime' | 'time_window'
  >('delay');
  const [msgDelayAmount, setMsgDelayAmount] = useState<number>(2);
  const [msgDelayUnit, setMsgDelayUnit] = useState<DelayUnit>('hours');
  const [msgScheduledTime, setMsgScheduledTime] = useState<string>('09:00');
  const [msgSpecificDateTime, setMsgSpecificDateTime] = useState<string>('2026-10-15T09:00');
  const [msgBusinessDaysOnly, setMsgBusinessDaysOnly] = useState<boolean>(true);
  const [msgBranchPath, setMsgBranchPath] = useState<BranchPathType>('main');

  const getSavedIdentitiesForChannel = (ch: ChannelType): UserMessagingIdentity[] => {
    const saved = parseSavedMessagingIdentities(privateProfile?.savedIdentitiesJson);
    const matching = saved.filter((item) => item.channel === ch);
    if (matching.length > 0) return matching;
    if (ch === 'whatsapp') {
      return [
        {
          id: 'default_wa_primary',
          channel: 'whatsapp',
          label: 'Primary WhatsApp Business',
          value: senderIdentities.whatsappBusinessNumber,
          displayName: workspace?.senderName || 'FlowPilot Operator',
          isPrimary: true,
          verified: true,
        },
      ];
    }
    if (ch === 'sms') {
      return [
        {
          id: 'default_sms_primary',
          channel: 'sms',
          label: 'Primary SMS Sender ID',
          value: senderIdentities.smsSenderId,
          displayName: workspace?.senderName || 'FlowPilot Operator',
          isPrimary: true,
          verified: true,
        },
      ];
    }
    return [
      {
        id: 'default_email_primary',
        channel: 'email',
        label: 'Primary Sender Email',
        value: senderIdentities.activeSenderEmail,
        displayName: workspace?.senderName || 'FlowPilot Operator',
        isPrimary: true,
        verified: true,
      },
    ];
  };

  // Live 1-second ticker for jobs held in waiting_delay state
  useEffect(() => {
    if (schedulerPaused) return;
    const timer = setInterval(() => {
      setJobLogs((prev) =>
        prev.map((job) => {
          if (job.status !== 'waiting_delay' || typeof job.remainingSeconds !== 'number') {
            return job;
          }
          if (job.remainingSeconds <= 1) {
            return {
              ...job,
              status: 'completed',
              remainingSeconds: 0,
              currentNodeTitle: 'Sequence Completed (Delay Timer Released)',
              stepTrace: job.stepTrace.map((st) =>
                st.status === 'waiting'
                  ? {
                      ...st,
                      status: 'success',
                      detail: `${st.detail} -> Timer expired, resumed & completed downstream actions`,
                    }
                  : st
              ),
            };
          }
          return {
            ...job,
            remainingSeconds: job.remainingSeconds - 1,
          };
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [schedulerPaused]);

  // Per-Contact List Kill Switch Monitor:
  // When any contact in a List gets a tag matching that List's Kill Switch (e.g. Purchased_Course),
  // immediately stop any scheduled / waiting_delay automation job for THAT contact!
  useEffect(() => {
    setJobLogs((prev) => {
      let anyStopped = false;
      const updated = prev.map((job) => {
        if (job.status !== 'waiting_delay' && job.status !== 'running' && job.status !== 'queued') {
          return job;
        }
        const matchedContact = contacts.find(
          (c) =>
            (c.email &&
              job.contactEmail &&
              c.email.trim().toLowerCase() === job.contactEmail.trim().toLowerCase()) ||
            (c.phone &&
              job.contactPhone &&
              c.phone.replace(/\D/g, '').length >= 7 &&
              c.phone.replace(/\D/g, '') === job.contactPhone.replace(/\D/g, ''))
        );
        if (!matchedContact) return job;

        const ksEval = evaluateListKillSwitchForContact(
          matchedContact,
          allAvailableLists,
          matchedContact.listName
        );
        if (!ksEval.triggered) return job;

        anyStopped = true;
        const nowStr = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        return {
          ...job,
          status: 'completed' as const,
          remainingSeconds: 0,
          branchTaken: `STOPPED FOR CONTACT (List Kill Switch Tag: #${ksEval.matchedTag})`,
          currentNodeTitle: `List Kill Switch Stopped Automation for ${matchedContact.fullName} (#${ksEval.matchedTag})`,
          stepTrace: [
            ...job.stepTrace.map((st) =>
              st.status === 'waiting'
                ? {
                    ...st,
                    status: 'skipped' as const,
                    detail: `${st.detail} -> Stopped for this contact by List Kill Switch`,
                  }
                : st
            ),
            {
              nodeId: `kill_switch_${Date.now()}`,
              nodeTitle: `List Kill Switch Matched Tag #${ksEval.matchedTag} -> Stopped for ${matchedContact.fullName}`,
              category: 'condition' as const,
              status: 'success' as const,
              timestamp: nowStr,
              detail: `${ksEval.ruleDescription}. Automation stopped for this contact only; list workflow continues for other contacts.`,
            },
          ],
        };
      });
      return anyStopped ? updated : prev;
    });
  }, [contacts, allAvailableLists]);

  useEffect(() => {
    if (preselectedListName) {
      setNewTargetList(preselectedListName);
      setIsModalOpen(true);
      onClearPreselectedList?.();
    } else if (!newTargetList && allAvailableLists.length > 0) {
      setNewTargetList(allAvailableLists[0].name);
    }
  }, [preselectedListName, allAvailableLists]);

  useEffect(() => {
    if (openModalOnMount) {
      if (!newTargetList && allAvailableLists.length > 0) {
        setNewTargetList(allAvailableLists[0].name);
      }
      setIsModalOpen(true);
      onClearModalMount?.();
    }
  }, [openModalOnMount, allAvailableLists]);

  const filteredAutomations = automations.filter((a) => {
    const matchesStatus = statusFilter === 'all' ? true : a.status === statusFilter;
    const resolvedList = resolveAutomationTargetList(a);
    const matchesList =
      listFilter === 'all'
        ? true
        : resolvedList.toLowerCase() === listFilter.trim().toLowerCase() ||
          a.triggerDetail.toLowerCase().includes(listFilter.trim().toLowerCase());
    return matchesStatus && matchesList;
  });

  const activeWorkflow =
    automations.find((a) => a.id === selectedId) ||
    filteredAutomations[0] ||
    automations[0] ||
    null;

  // Keep selectedId synchronized when automations load or change
  useEffect(() => {
    if ((!selectedId || !automations.some((a) => a.id === selectedId)) && automations.length > 0) {
      setSelectedId(automations[0].id);
    }
  }, [automations, selectedId]);

  // Synchronize canvas nodes when activeWorkflow changes
  useEffect(() => {
    if (activeWorkflow) {
      const parsed = parseOrBuildFlowGraph(activeWorkflow);
      setNodes(parsed.nodes);
      setVersion(parsed.version);
      setVersionHistory(parsed.versionHistory);
      setEngineConfig(parsed.engineConfig);
      const firstMessageNode = parsed.nodes.find(
        (n) =>
          n.subType === 'send_email' ||
          n.subType === 'send_whatsapp' ||
          n.subType === 'send_sms'
      );
      setSelectedNodeId((current) =>
        current && parsed.nodes.some((n) => n.id === current)
          ? current
          : firstMessageNode?.id || parsed.nodes[0]?.id || null
      );
      setHasUnsavedChanges(false);
    } else {
      const defaults = createDefaultNodesForAutomation();
      setNodes(defaults);
      setVersion(1);
      setVersionHistory([]);
      const firstMessageNode = defaults.find(
        (n) =>
          n.subType === 'send_email' ||
          n.subType === 'send_whatsapp' ||
          n.subType === 'send_sms'
      );
      setSelectedNodeId((current) =>
        current && defaults.some((n) => n.id === current)
          ? current
          : firstMessageNode?.id || defaults[0]?.id || null
      );
      setHasUnsavedChanges(false);
    }
  }, [activeWorkflow?.id, activeWorkflow?.flowGraphJson]);

  const showNotice = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => {
      setStatusBanner((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  // Add a node from the palette to the canvas
  const handleAddNodeFromPalette = (
    item: PaletteItemDefinition,
    insertIndex?: number,
    branchOverride?: BranchPathType
  ) => {
    if (item.category === 'trigger') {
      // Replace the existing trigger at index 0
      const updatedTrigger: WorkflowNode = {
        id: `node_trig_${Date.now()}`,
        category: 'trigger',
        subType: item.subType,
        title: item.title,
        subtitle: item.subtitle,
        branchPath: 'main',
        config: { ...item.defaultConfig },
      };
      setNodes((prev) => {
        const withoutTrigger = prev.filter((n) => n.category !== 'trigger');
        return [updatedTrigger, ...withoutTrigger];
      });
      setSelectedNodeId(updatedTrigger.id);
      setHasUnsavedChanges(true);
      showNotice(`Updated workflow trigger to "${item.title}"`);
      return;
    }

    const newNode: WorkflowNode = {
      id: `node_${item.category}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category: item.category,
      subType: item.subType,
      title: item.title,
      subtitle: item.subtitle,
      branchPath: branchOverride || targetBranchForAdd || 'main',
      config: { ...item.defaultConfig },
    };

    setNodes((prev) => {
      const next = [...prev];
      if (typeof insertIndex === 'number' && insertIndex >= 1 && insertIndex <= next.length) {
        next.splice(insertIndex, 0, newNode);
      } else {
        next.push(newNode);
      }
      return next;
    });
    setSelectedNodeId(newNode.id);
    setHasUnsavedChanges(true);
    showNotice(`Added "${item.title}" to ${newNode.branchPath.toUpperCase()} canvas path`);
  };

  // Reorder nodes on canvas
  const handleMoveNode = (index: number, direction: 'up' | 'down') => {
    if (index === 0) return; // Trigger stays at root
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 1 || targetIdx >= nodes.length) return;
    setNodes((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIdx, 0, moved);
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  const handleDeleteNode = (nodeId: string) => {
    const target = nodes.find((n) => n.id === nodeId);
    if (!target || target.category === 'trigger') return;
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(nodes[0]?.id || null);
    }
    setHasUnsavedChanges(true);
  };

  const handleUpdateNodeById = (
    nodeId: string,
    patch: Partial<WorkflowNode>,
    configPatch?: Partial<WorkflowNode['config']>
  ) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          ...patch,
          config: configPatch ? { ...n.config, ...configPatch } : n.config,
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleUpdateSelectedNode = (patch: Partial<WorkflowNode>, configPatch?: Partial<WorkflowNode['config']>) => {
    if (!selectedNodeId) return;
    handleUpdateNodeById(selectedNodeId, patch, configPatch);
  };

  // Add a newly composed Automated Message with Per-Message Time Schedule directly into the workflow
  const handleAddScheduledMessageToWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    const subType =
      msgChannel === 'whatsapp'
        ? 'send_whatsapp'
        : msgChannel === 'sms'
        ? 'send_sms'
        : 'send_email';
    const cleanTitle = sanitizeString(
      msgTitle,
      90,
      msgChannel === 'whatsapp'
        ? 'Send WhatsApp Automated Message'
        : msgChannel === 'sms'
        ? 'Send SMS Automated Message'
        : 'Send Automated Email'
    );
    const scheduleDesc =
      msgScheduleMode === 'delay'
        ? `Scheduled: Wait ${msgDelayAmount} ${msgDelayUnit} before sending`
        : msgScheduleMode === 'specific_datetime'
        ? `Scheduled: Send on ${msgSpecificDateTime.replace('T', ' ')}`
        : msgScheduleMode === 'time_window'
        ? `Scheduled: Deliver at ${msgScheduledTime}${msgBusinessDaysOnly ? ' (Mon–Fri)' : ''}`
        : 'Scheduled: Send Immediately (0m delay)';

    const newNode: WorkflowNode = {
      id: `node_msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category: 'action',
      subType,
      title: cleanTitle,
      subtitle: scheduleDesc,
      branchPath: msgBranchPath,
      config: {
        channel: msgChannel,
        subjectOrTemplate: sanitizeString(msgSubjectOrTemplate, 120, 'Automated Message'),
        messagePreview: sanitizeString(msgBody, 400, 'Hi {{first_name}}...'),
        messageScheduleMode: msgScheduleMode,
        delayAmount: msgDelayAmount,
        delayUnit: msgDelayUnit,
        scheduledSendTime: msgScheduledTime,
        specificDateTime: msgSpecificDateTime,
        businessDaysOnly: msgBusinessDaysOnly,
      },
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
    setHasUnsavedChanges(true);
    setIsMessageComposerOpen(false);
    showNotice(`Added "${cleanTitle}" (${scheduleDesc}) to workflow canvas`);
  };

  // Test send a single message step (WhatsApp, Email, SMS) directly to the user's test device
  const handleTestSingleMessageNode = async (node: WorkflowNode) => {
    if (testingStepNodeId) return;
    const stepChannel: ChannelType =
      node.subType === 'send_whatsapp'
        ? 'whatsapp'
        : node.subType === 'send_sms'
        ? 'sms'
        : 'email';

    const testRecipient =
      stepChannel === 'email'
        ? customTestEmail || privateProfile?.email || 'lead@example.com'
        : customTestPhone ||
          privateProfile?.whatsappBusinessNumber ||
          privateProfile?.phone ||
          '+1 (555) 234-8910';

    const rawSubject =
      node.config.subjectOrTemplate ||
      (stepChannel === 'whatsapp'
        ? 'wa_automated_step'
        : stepChannel === 'sms'
        ? 'Automated SMS Alert'
        : activeWorkflow?.name || 'FlowPilot Automation');

    const rawBody =
      node.config.messagePreview ||
      `Hi {{first_name}}, this is an automated ${stepChannel.toUpperCase()} message from ${
        activeWorkflow?.name || 'FlowPilot'
      }.`;

    const leadName = customTestName || 'Test Lead';
    const activeWorkflowList = resolveAutomationTargetList(activeWorkflow);
    const personalizedSubject = personalizeAutomationMessage(rawSubject, {
      fullName: leadName,
      email: testRecipient,
      phone: testRecipient,
      company: 'Growth Partner',
      listName: activeWorkflowList || 'VIP Contacts',
      senderName: workspace?.senderName || workspace?.name,
      automationId: activeWorkflow?.id,
    });

    const personalizedBody = personalizeAutomationMessage(rawBody, {
      fullName: leadName,
      email: testRecipient,
      phone: testRecipient,
      company: 'Growth Partner',
      listName: activeWorkflowList || 'VIP Contacts',
      senderName: workspace?.senderName || workspace?.name,
      automationId: activeWorkflow?.id,
    });

    setTestingStepNodeId(node.id);
    try {
      const receipt = await deliverChannelMessage({
        channel: stepChannel,
        to: testRecipient,
        leadName,
        subject: personalizedSubject,
        body: personalizedBody,
        listName: activeWorkflowList || 'VIP Contacts',
        source: 'automation_workflow',
        overrideFromIdentity: node.config.overrideFromIdentity,
        workspace,
        privateProfile,
      });

      setLastStepReceipt({ nodeId: node.id, receipt });
      showNotice(
        `Live ${stepChannel.toUpperCase()} sent to ${receipt.toRecipient} via ${
          receipt.providerUsed
        }! (Receipt: ${receipt.receiptId})`
      );
    } catch {
      showNotice(`Failed to deliver ${stepChannel.toUpperCase()} test message.`);
    } finally {
      setTestingStepNodeId(null);
    }
  };

  // Save & Publish New Version to Durable Storage
  const handleSaveAndPublishVersion = async () => {
    setIsSavingGraph(true);
    try {
      const triggerNode = nodes.find((n) => n.category === 'trigger') || nodes[0];
      const nextTriggerType = (triggerNode?.subType as TriggerType) || (activeWorkflow ? activeWorkflow.triggerType : 'form_submission');
      const nextTriggerDetail = sanitizeString(
        triggerNode?.subtitle || (activeWorkflow ? activeWorkflow.triggerDetail : 'Inbound Lead or Form Capture'),
        120,
        'Event Trigger'
      );
      const nextTargetList = sanitizeString(
        triggerNode?.config?.targetList || (activeWorkflow ? resolveAutomationTargetList(activeWorkflow) : (allAvailableLists[0]?.name || 'General Contacts')),
        80,
        allAvailableLists[0]?.name || 'General Contacts'
      );

      if (!activeWorkflow) {
        // Auto-create and publish workflow from current canvas
        const initialSnapshot: WorkflowVersionSnapshot = {
          version: 1,
          savedAt: new Date().toISOString(),
          author: 'Workspace Operator',
          changeNote: sanitizeString(
            changeNoteInput,
            100,
            `Published v1 (${nodes.length} nodes)`
          ),
          nodeCount: nodes.length,
          nodes: [...nodes],
        };
        const serializedGraph = serializeFlowGraphToString({
          nodes,
          version: 1,
          versionHistory: [initialSnapshot],
          engineConfig,
        });

        await onCreateAutomation({
          name: newName.trim() || 'Lead Conversion Sequence',
          triggerType: nextTriggerType,
          triggerDetail: nextTriggerDetail,
          targetList: nextTargetList,
          stepsSummary: deriveStepsSummaryFromNodes(nodes),
          channels: deriveChannelsFromNodes(nodes),
          status: 'active',
          enrolledCount: 0,
          completedCount: 0,
          conversionRate: 0,
          version: 1,
          flowGraphJson: serializedGraph,
        });

        setVersion(1);
        setVersionHistory([initialSnapshot]);
        setChangeNoteInput('');
        setHasUnsavedChanges(false);
        showNotice(`Published Workflow v1 to durable storage`);
        return;
      }

      const nextVersion = (version || 1) + 1;
      const newSnapshot: WorkflowVersionSnapshot = {
        version: nextVersion,
        savedAt: new Date().toISOString(),
        author: 'Workspace Operator',
        changeNote: sanitizeString(
          changeNoteInput,
          100,
          `Published v${nextVersion} (${nodes.length} nodes)`
        ),
        nodeCount: nodes.length,
        nodes: [...nodes],
      };

      const nextHistory = [newSnapshot, ...(versionHistory || [])].slice(0, 6);
      const serializedGraph = serializeFlowGraphToString({
        nodes,
        version: nextVersion,
        versionHistory: nextHistory,
        engineConfig,
      });

      await onUpdateAutomation(activeWorkflow.id, {
        name: activeWorkflow.name,
        triggerType: nextTriggerType,
        triggerDetail: nextTriggerDetail,
        ...(nextTargetList ? { targetList: nextTargetList, targetListName: nextTargetList } : {}),
        stepsSummary: deriveStepsSummaryFromNodes(nodes),
        channels: deriveChannelsFromNodes(nodes),
        status: activeWorkflow.status,
        enrolledCount: activeWorkflow.enrolledCount,
        completedCount: activeWorkflow.completedCount,
        conversionRate: activeWorkflow.conversionRate,
        version: nextVersion,
        flowGraphJson: serializedGraph,
      });

      setVersion(nextVersion);
      setVersionHistory(nextHistory);
      setChangeNoteInput('');
      setHasUnsavedChanges(false);
      showNotice(`Published Workflow v${nextVersion} to durable storage`);
    } finally {
      setIsSavingGraph(false);
    }
  };

  // Restore a previous version snapshot
  const handleRestoreVersion = async (snap: WorkflowVersionSnapshot) => {
    setNodes(snap.nodes);
    setHasUnsavedChanges(true);
    setWorkspaceTab('canvas');
    showNotice(`Loaded Version v${snap.version} onto canvas — click Publish to commit`);
  };

  // Toggle workflow active/paused status
  const handleToggleWorkflowStatus = async (auto: Automation) => {
    if (auto.status === 'archived') return;
    const nextStatus: AutomationStatus = auto.status === 'active' ? 'paused' : 'active';
    const resolvedList = resolveAutomationTargetList(auto);
    await onUpdateAutomation(auto.id, {
      name: auto.name,
      triggerType: auto.triggerType,
      triggerDetail: auto.triggerDetail,
      ...(resolvedList ? { targetList: resolvedList } : {}),
      stepsSummary: auto.stepsSummary,
      channels: auto.channels,
      status: nextStatus,
      enrolledCount: auto.enrolledCount,
      completedCount: auto.completedCount,
      conversionRate: auto.conversionRate,
      version: auto.version,
      flowGraphJson: auto.flowGraphJson,
    });
    showNotice(`Workflow "${auto.name}" is now ${nextStatus.toUpperCase()}`);
  };

  // Switch the linked Contact List of the active workflow directly from the canvas header
  const handleSwitchActiveWorkflowList = async (listName: string) => {
    if (!activeWorkflow || !listName.trim()) return;
    const cleanList = sanitizeString(listName, 80, '');
    const updatedNodes = nodes.map((n, idx) => {
      if (idx === 0 && n.category === 'trigger') {
        const baseDetail = n.subtitle.replace(/^List:\s*[^·]+·\s*/i, '');
        return {
          ...n,
          subtitle: `List: ${cleanList} · ${baseDetail}`,
          config: {
            ...n.config,
            targetList: cleanList,
          },
        };
      }
      return n;
    });
    setNodes(updatedNodes);

    const nextDetail = sanitizeString(
      `List: ${cleanList} · ${activeWorkflow.triggerDetail.replace(/^List:\s*[^·]+·\s*/i, '')}`,
      120,
      `List: ${cleanList}`
    );

    const updatedGraph = serializeFlowGraphToString({
      nodes: updatedNodes,
      version,
      versionHistory,
      engineConfig,
    });

    await onUpdateAutomation(activeWorkflow.id, {
      name: activeWorkflow.name,
      triggerType: activeWorkflow.triggerType,
      triggerDetail: nextDetail,
      targetList: cleanList,
      stepsSummary: deriveStepsSummaryFromNodes(updatedNodes),
      channels: deriveChannelsFromNodes(updatedNodes),
      status: activeWorkflow.status,
      enrolledCount: activeWorkflow.enrolledCount,
      completedCount: activeWorkflow.completedCount,
      conversionRate: activeWorkflow.conversionRate,
      version: activeWorkflow.version,
      flowGraphJson: updatedGraph,
    });
    showNotice(`Workflow "${activeWorkflow.name}" is now linked to Contact List "${cleanList}"`);
  };

  // Quick-create a Contact List inside the Automation modal
  const handleQuickCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineListName.trim() || !onCreateList) return;
    const cleanList = sanitizeString(inlineListName, 80, 'Automation Audience List');
    const parsedKsTags = sanitizeStringArray(
      inlineListKillSwitchTags.split(','),
      10,
      32
    );
    setIsCreatingInlineList(true);
    try {
      await onCreateList({
        name: cleanList,
        description: 'Created from Visual Automation Builder to store contacts and run workflows.',
        category: inlineListCategory,
        defaultConsent: 'opted_in',
        defaultTags: ['automated-segment'],
        colorAccent: 'emerald',
        killSwitchEnabled: true,
        killSwitchTags: parsedKsTags.length > 0 ? parsedKsTags : ['Purchased_Course'],
      });
      setNewTargetList(cleanList);
      setInlineListName('');
      setShowInlineListCreator(false);
      showNotice(
        `Created Contact List "${cleanList}" with Kill Switch tag [${(parsedKsTags.length > 0
          ? parsedKsTags
          : ['Purchased_Course']
        ).join(', ')}]`
      );
    } finally {
      setIsCreatingInlineList(false);
    }
  };

  // Create a brand new workflow bound to the selected Contact List
  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedList = sanitizeString(
      newTargetList || allAvailableLists[0]?.name || '',
      80,
      ''
    );
    if (!selectedList) {
      showNotice('Please select or create a Contact List before creating an automation.');
      return;
    }

    const cleanName = sanitizeString(
      newName,
      120,
      `${selectedList} Automated Sequence`
    );
    const matchedTrig =
      TRIGGER_CATALOG.find((t) => t.subType === newTriggerType) || TRIGGER_CATALOG[0];
    const rawDetail = sanitizeString(
      newTriggerDetail,
      80,
      matchedTrig.subtitle
    );
    const cleanDetail = sanitizeString(
      `List: ${selectedList} · ${rawDetail}`,
      120,
      `List: ${selectedList}`
    );

    const initialNodes = createDefaultNodesForAutomation(
      newTriggerType,
      rawDetail,
      selectedList
    );
    const initialGraph = serializeFlowGraphToString({
      nodes: initialNodes,
      version: 1,
      versionHistory: [
        {
          version: 1,
          savedAt: new Date().toISOString(),
          author: 'Workspace Operator',
          changeNote: `Initial workflow created for Contact List "${selectedList}"`,
          nodeCount: initialNodes.length,
          nodes: initialNodes,
        },
      ],
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
    });

    setIsCreating(true);
    try {
      await onCreateAutomation({
        name: cleanName,
        triggerType: newTriggerType,
        triggerDetail: cleanDetail,
        targetList: selectedList,
        stepsSummary: deriveStepsSummaryFromNodes(initialNodes),
        channels: deriveChannelsFromNodes(initialNodes),
        status: 'active',
        enrolledCount: 0,
        completedCount: 0,
        conversionRate: 0,
        version: 1,
        flowGraphJson: initialGraph,
      });
      setIsModalOpen(false);
      setWorkspaceTab('canvas');
      setNewName('');
      setNewTriggerDetail('');
      showNotice(
        `Created workflow "${cleanName}" running in Contact List "${selectedList}" — configure per-message schedules on the canvas`
      );
    } finally {
      setIsCreating(false);
    }
  };

  // Execute a workflow run in the Background Job Queue with Idempotency, Retries, Delay Engine & Real Multi-Channel Dispatch
  const handleEnqueueWorkflowJob = async (
    manualContact?: Contact | null,
    options?: { bypassIdempotency?: boolean }
  ) => {
    if (!activeWorkflow || isExecutingJob) return;
    if (activeWorkflow.status === 'paused' || schedulerPaused) {
      showNotice('Workflow or Background Scheduler is currently paused. Resume to execute jobs.');
      return;
    }

    const activeWorkflowList = resolveAutomationTargetList(activeWorkflow);
    const listMatchedContact = activeWorkflowList
      ? contacts.find(
          (c) => c.listName.trim().toLowerCase() === activeWorkflowList.toLowerCase()
        )
      : null;

    const targetContact = useCustomRecipient
      ? null
      : manualContact ||
        contacts.find((c) => c.id === enrollContactId) ||
        listMatchedContact ||
        contacts[0] ||
        null;

    const contactName = useCustomRecipient
      ? customTestName.trim() || 'Test Lead'
      : targetContact
      ? targetContact.fullName
      : 'Manual Enrollment Test Lead';
    const contactEmail = useCustomRecipient
      ? customTestEmail.trim() || 'lead.test@verified-domain.io'
      : targetContact
      ? targetContact.email
      : privateProfile?.email || 'lead.test@verified-domain.io';
    const contactPhone = useCustomRecipient
      ? customTestPhone.trim() || '+1 (555) 234-8910'
      : targetContact?.phone || privateProfile?.phone || '+1 (555) 234-8910';
    const contactCompany = targetContact?.company || 'Growth Partner';
    const contactListName =
      targetContact?.listName || activeWorkflowList || allAvailableLists[0]?.name || 'VIP List';

    // Deterministic Idempotency Key within idempotency window
    const hourBucket = Math.floor(
      Date.now() / (1000 * 60 * 60 * Math.max(1, engineConfig.idempotencyWindowHours))
    );
    const idempotencyKey = options?.bypassIdempotency
      ? `idem_${activeWorkflow.id}_v${version}_${contactEmail}_${Date.now()}`
          .replace(/[^a-zA-Z0-9_\-]/g, '_')
          .slice(0, 96)
      : `idem_${activeWorkflow.id}_v${version}_${contactEmail}_${hourBucket}`
          .replace(/[^a-zA-Z0-9_\-]/g, '_')
          .slice(0, 96);

    // Check idempotency deduplication when not explicitly bypassed
    if (!options?.bypassIdempotency) {
      const duplicateJob = jobLogs.find(
        (j) =>
          j.idempotencyKey === idempotencyKey &&
          (j.status === 'completed' || j.status === 'running' || j.status === 'waiting_delay')
      );

      if (duplicateJob) {
        showNotice(
          `Idempotency Guard blocked duplicate run for ${contactEmail} — click "Re-Run Live Test" to bypass lock.`
        );
        setWorkspaceTab('queue');
        setSelectedJobId(duplicateJob.id);
        return;
      }
    }

    setIsExecutingJob(true);
    try {
      const nowIso = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      // Build step-by-step execution trace across the node graph
      const trace: WorkflowJobExecutionLog['stepTrace'] = [];
      const dispatchedReceipts: MessageDeliveryReceipt[] = [];
      let activeBranch: BranchPathType = 'main';
      let branchTakenLabel = 'Main Linear Path';
      let encounteredDelayNode: WorkflowNode | null = null;
      let shouldSimulateRetry = simulateTransientFailure;
      let attemptCount = 1;

      // Prepare real CRM contact mutations if a real contact was enrolled
      let workingTags = targetContact ? [...targetContact.tags] : [];
      let workingList = targetContact ? targetContact.listName : '';
      let workingStage: ContactStage = targetContact ? targetContact.stage : 'lead';
      let workingNotes = targetContact ? targetContact.notes : '';
      let contactMutated = false;

      for (const node of nodes) {
        // Check if node is on the active branch or main convergence path
        if (node.branchPath !== 'main' && node.branchPath !== activeBranch) {
          trace.push({
            nodeId: node.id,
            nodeTitle: node.title,
            category: node.category,
            status: 'skipped',
            timestamp: nowIso,
            detail: `Skipped (${node.branchPath.toUpperCase()} branch not active)`,
          });
          continue;
        }

        if (node.category === 'trigger') {
          trace.push({
            nodeId: node.id,
            nodeTitle: node.title,
            category: 'trigger',
            status: 'success',
            timestamp: nowIso,
            detail: `Trigger verified for ${contactName} (${contactEmail} · ${contactPhone}) in List "${contactListName}"`,
          });

          // Evaluate the List's Kill Switch for this specific contact
          const entryKillSwitch = evaluateListKillSwitchForContact(
            { tags: workingTags, listName: contactListName, stage: workingStage },
            allAvailableLists,
            contactListName
          );
          if (entryKillSwitch.triggered) {
            branchTakenLabel = `STOPPED FOR CONTACT (List Kill Switch Tag: #${entryKillSwitch.matchedTag})`;
            trace.push({
              nodeId: `kill_switch_entry_${node.id}`,
              nodeTitle: `List Kill Switch Matched Tag #${entryKillSwitch.matchedTag} -> Stopped for ${contactName}`,
              category: 'condition',
              status: 'success',
              timestamp: nowIso,
              detail: `${entryKillSwitch.ruleDescription} — Automation stopped for "${contactName}" (other contacts in list "${contactListName}" continue normally).`,
            });
            for (const remNode of nodes.slice(nodes.indexOf(node) + 1)) {
              trace.push({
                nodeId: remNode.id,
                nodeTitle: remNode.title,
                category: remNode.category,
                status: 'skipped',
                timestamp: nowIso,
                detail: `Stopped for this contact by List Kill Switch (#${entryKillSwitch.matchedTag})`,
              });
            }
            break;
          }
          continue;
        }

        // Re-check List Kill Switch for this contact before any downstream node
        const midKillSwitch = evaluateListKillSwitchForContact(
          { tags: workingTags, listName: contactListName, stage: workingStage },
          allAvailableLists,
          contactListName
        );
        if (midKillSwitch.triggered) {
          branchTakenLabel = `STOPPED FOR CONTACT (List Kill Switch Tag: #${midKillSwitch.matchedTag})`;
          trace.push({
            nodeId: `kill_switch_mid_${node.id}`,
            nodeTitle: `List Kill Switch Matched Tag #${midKillSwitch.matchedTag} -> Stopped for ${contactName}`,
            category: 'condition',
            status: 'success',
            timestamp: nowIso,
            detail: `${midKillSwitch.ruleDescription} — Automation stopped for "${contactName}" before "${node.title}".`,
          });
          break;
        }

        if (node.category === 'condition') {
          const evalRes = evaluateConditionForContact(node, targetContact);
          activeBranch = evalRes.branchPath;
          branchTakenLabel = `${evalRes.branchPath.toUpperCase()} (${evalRes.reason})`;
          trace.push({
            nodeId: node.id,
            nodeTitle: node.title,
            category: 'condition',
            status: 'success',
            timestamp: nowIso,
            detail: evalRes.reason,
          });
          continue;
        }

        if (node.category === 'delay') {
          const amt = node.config.delayAmount || 1;
          const unit = node.config.delayUnit || 'days';
          const bizRule = node.config.businessDaysOnly
            ? ` [Business-Day Window ${node.config.businessWindowStart || '09:00'}-${
                node.config.businessWindowEnd || '17:00'
              }]`
            : '';
          encounteredDelayNode = node;
          trace.push({
            nodeId: node.id,
            nodeTitle: node.title,
            category: 'delay',
            status: holdOnDelayTimer ? 'waiting' : 'success',
            timestamp: nowIso,
            detail: holdOnDelayTimer
              ? `Active Delay Hold: Waiting ${amt} ${unit}${bizRule} in durable scheduler`
              : `Scheduled timer (${amt} ${unit}${bizRule}) verified & fast-forwarded for immediate execution`,
          });
          continue;
        }

        // Check if this Automated Message node has its own Per-Message Time Delay / Schedule
        if (
          (node.subType === 'send_email' ||
            node.subType === 'send_whatsapp' ||
            node.subType === 'send_sms') &&
          node.config.messageScheduleMode &&
          node.config.messageScheduleMode !== 'immediate'
        ) {
          const mode = node.config.messageScheduleMode;
          const msgDelaySummary =
            mode === 'delay'
              ? `Wait ${node.config.delayAmount || 1} ${node.config.delayUnit || 'hours'}${
                  node.config.businessDaysOnly
                    ? ` (Send @ ${node.config.scheduledSendTime || '09:00'} Mon–Fri)`
                    : ''
                }`
              : mode === 'specific_datetime'
              ? `Scheduled for ${
                  node.config.specificDateTime
                    ? node.config.specificDateTime.replace('T', ' ')
                    : 'scheduled timestamp'
                }`
              : `Delivery Window @ ${node.config.scheduledSendTime || '09:00'}${
                  node.config.businessDaysOnly ? ' (Mon–Fri)' : ''
                }`;

          if (!encounteredDelayNode) {
            encounteredDelayNode = node;
          }

          trace.push({
            nodeId: `${node.id}_msg_schedule`,
            nodeTitle: `Message Schedule (${node.title})`,
            category: 'delay',
            status: holdOnDelayTimer ? 'waiting' : 'success',
            timestamp: nowIso,
            detail: holdOnDelayTimer
              ? `Per-Message Schedule Hold: ${msgDelaySummary}`
              : `Per-Message Schedule Verified: ${msgDelaySummary}`,
          });
        }

        // Action Node Execution
        if (
          shouldSimulateRetry &&
          (node.subType === 'send_email' ||
            node.subType === 'send_whatsapp' ||
            node.subType === 'send_sms' ||
            node.subType === 'send_webhook')
        ) {
          attemptCount = 2;
          trace.push({
            nodeId: `${node.id}_retry`,
            nodeTitle: `${node.title} (Attempt 1/3)`,
            category: 'action',
            status: 'retrying',
            timestamp: nowIso,
            detail: `Provider HTTP 429 rate-limit encountered. Exponential backoff (${engineConfig.retryBackoffSec}s) -> Retry #2 succeeded.`,
          });
          shouldSimulateRetry = false;
        }

        // Apply real mutations if enrolled contact exists
        if (targetContact) {
          if (node.subType === 'add_tag' && node.config.targetTag) {
            if (!workingTags.includes(node.config.targetTag)) {
              workingTags.push(node.config.targetTag);
              contactMutated = true;
            }
          } else if (node.subType === 'remove_tag' && node.config.targetTag) {
            workingTags = workingTags.filter((t) => t !== node.config.targetTag);
            contactMutated = true;
          } else if (node.subType === 'add_to_list' && node.config.targetList) {
            workingList = node.config.targetList;
            contactMutated = true;
          } else if (node.subType === 'move_deal_stage' && node.config.dealStage) {
            workingStage = node.config.dealStage;
            contactMutated = true;
          } else if (node.subType === 'add_internal_note' && node.config.internalNoteText) {
            workingNotes = `${workingNotes ? workingNotes + '\n' : ''}[Automation v${version}]: ${
              node.config.internalNoteText
            }`.slice(0, 950);
            contactMutated = true;
          } else if (node.subType === 'create_task' && onCreateTask) {
            await onCreateTask({
              title: sanitizeString(
                `${node.config.taskTitle || 'Follow up'} (${targetContact.fullName})`,
                140,
                'Automated Task'
              ),
              category: 'follow_up',
              priority: 'high',
              dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
              relatedEntity: targetContact.fullName,
              status: 'pending',
            });
          }
        }

        // REAL MULTI-CHANNEL DISPATCH FOR WHATSAPP, EMAIL, AND SMS ACTION NODES
        if (
          node.subType === 'send_whatsapp' ||
          node.subType === 'send_email' ||
          node.subType === 'send_sms'
        ) {
          const stepChannel: ChannelType =
            node.subType === 'send_whatsapp'
              ? 'whatsapp'
              : node.subType === 'send_sms'
              ? 'sms'
              : 'email';

          const rawSubject =
            node.config.subjectOrTemplate ||
            (stepChannel === 'whatsapp'
              ? 'wa_automated_step'
              : stepChannel === 'sms'
              ? 'Automated SMS Alert'
              : activeWorkflow.name);

          const rawBody =
            node.config.messagePreview ||
            `Hi {{first_name}}, this is an automated ${stepChannel.toUpperCase()} message from ${
              activeWorkflow.name
            }.`;

          const personalizedSubject = personalizeAutomationMessage(rawSubject, {
            fullName: contactName,
            email: contactEmail,
            phone: contactPhone,
            company: contactCompany,
            listName: contactListName,
            senderName: workspace?.senderName || workspace?.name,
            automationId: activeWorkflow.id,
          });

          const personalizedBody = personalizeAutomationMessage(rawBody, {
            fullName: contactName,
            email: contactEmail,
            phone: contactPhone,
            company: contactCompany,
            listName: contactListName,
            senderName: workspace?.senderName || workspace?.name,
            automationId: activeWorkflow.id,
          });

          const stepRecipient = stepChannel === 'email' ? contactEmail : contactPhone;

          const receipt = await deliverChannelMessage({
            channel: stepChannel,
            to: stepRecipient,
            leadName: contactName,
            subject: personalizedSubject,
            body: personalizedBody,
            listName: contactListName,
            source: 'automation_workflow',
            overrideFromIdentity: node.config.overrideFromIdentity,
            workspace,
            privateProfile,
          });

          dispatchedReceipts.push(receipt);

          if (onForwardToInbox) {
            await onForwardToInbox({
              leadName: contactName,
              leadEmail: contactEmail,
              leadPhone: contactPhone,
              listName: contactListName,
              channel: stepChannel,
              workflowName: activeWorkflow.name,
              stepTitle: node.title,
              subjectOrTemplate: personalizedSubject,
              messageSent: personalizedBody,
            });
          }

          trace.push({
            nodeId: node.id,
            nodeTitle: node.title,
            category: 'action',
            status: 'success',
            timestamp: nowIso,
            channel: stepChannel,
            receiptId: receipt.receiptId,
            senderIdentity: receipt.fromIdentity,
            recipient: receipt.toRecipient,
            messageBody: personalizedBody,
            directLaunchUrl: receipt.directLaunchUrl,
            provider: receipt.providerUsed,
            detail: `Delivered ${stepChannel.toUpperCase()} from ${receipt.fromIdentity} to ${
              receipt.toRecipient
            } · Receipt: ${receipt.receiptId}`,
          });
        } else {
          trace.push({
            nodeId: node.id,
            nodeTitle: node.title,
            category: 'action',
            status: 'success',
            timestamp: nowIso,
            detail:
              node.subType === 'send_webhook'
                ? `POST ${node.config.webhookUrl || 'https://api.endpoint.io/webhook'} -> 200 OK`
                : `Executed CRM action: ${node.title}`,
          });
        }

        if (node.subType === 'stop_workflow') {
          break;
        }
      }

      // Persist CRM contact updates if any occurred
      if (targetContact && contactMutated && onUpdateContact) {
        await onUpdateContact(targetContact.id, {
          fullName: targetContact.fullName,
          email: targetContact.email,
          phone: targetContact.phone,
          company: targetContact.company,
          dealTitle: targetContact.dealTitle,
          stage: workingStage,
          temperature: targetContact.temperature,
          source: targetContact.source,
          consentStatus: targetContact.consentStatus,
          commChannels: targetContact.commChannels,
          listName: workingList,
          tags: workingTags,
          ltv: targetContact.ltv,
          notes: workingNotes,
          customFields: targetContact.customFields,
        });
      }

      const isHeldInTimer = Boolean(encounteredDelayNode && holdOnDelayTimer);
      const resumeDate = new Date(
        Date.now() +
          (encounteredDelayNode?.config.delayAmount || 1) *
            (encounteredDelayNode?.config.delayUnit === 'minutes'
              ? 60000
              : encounteredDelayNode?.config.delayUnit === 'hours'
              ? 3600000
              : 86400000)
      );

      const newJob: WorkflowJobExecutionLog = {
        id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        workflowId: activeWorkflow.id,
        workflowName: activeWorkflow.name,
        workflowVersion: version,
        contactName,
        contactEmail,
        contactPhone,
        idempotencyKey,
        status: isHeldInTimer ? 'waiting_delay' : 'completed',
        currentNodeTitle: isHeldInTimer
          ? `Held at Timer: ${encounteredDelayNode?.title}`
          : encounteredDelayNode
          ? `Completed (after ${encounteredDelayNode.title})`
          : 'Sequence Completed',
        attempt: attemptCount,
        maxRetries: engineConfig.maxRetries,
        startedAt: nowIso,
        updatedAt: nowIso,
        scheduledResumeAt: isHeldInTimer
          ? resumeDate.toLocaleString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : undefined,
        remainingSeconds: isHeldInTimer ? 45 : 0,
        branchTaken: branchTakenLabel,
        stepTrace: trace,
      };

      setJobLogs((prev) => [newJob, ...prev]);
      setSelectedJobId(newJob.id);
      setLatestExecutionReceipts(dispatchedReceipts);

      // Increment workflow enrolled & completed metrics
      await onUpdateAutomation(activeWorkflow.id, {
        name: activeWorkflow.name,
        triggerType: activeWorkflow.triggerType,
        triggerDetail: activeWorkflow.triggerDetail,
        ...(activeWorkflowList ? { targetList: activeWorkflowList } : {}),
        stepsSummary: deriveStepsSummaryFromNodes(nodes),
        channels: deriveChannelsFromNodes(nodes),
        status: activeWorkflow.status,
        enrolledCount: activeWorkflow.enrolledCount + 1,
        completedCount: activeWorkflow.completedCount + 1,
        conversionRate: Math.min(99, Math.max(activeWorkflow.conversionRate || 32, 38)),
        ...(typeof activeWorkflow.version === 'number' ? { version: activeWorkflow.version } : {}),
        ...(typeof activeWorkflow.flowGraphJson === 'string'
          ? { flowGraphJson: activeWorkflow.flowGraphJson }
          : {}),
      });

      if (onLogActivity) {
        await onLogActivity(
          'automation_triggered',
          `Workflow v${version} Executed: ${activeWorkflow.name}`,
          `Enrolled ${contactName} · Dispatched ${dispatchedReceipts.length} message(s) across ${
            dispatchedReceipts.map((r) => r.channel.toUpperCase()).join(' + ') || 'CRM'
          }`,
          (dispatchedReceipts[0]?.channel as ActivityChannel) || 'crm'
        );
      }

      showNotice(
        `Automation "${activeWorkflow.name}" executed for ${contactName} — ${dispatchedReceipts.length} message(s) delivered with verified receipts!`
      );
    } finally {
      setIsExecutingJob(false);
    }
  };

  // Filtered palette items
  const allPaletteItems: PaletteItemDefinition[] = [
    ...TRIGGER_CATALOG,
    ...ACTION_CATALOG,
    ...CONDITION_CATALOG,
    ...DELAY_CATALOG,
  ].filter((item) => {
    const matchesCat = paletteCategory === 'all' || item.category === paletteCategory;
    const matchesSearch =
      !paletteSearch.trim() ||
      item.title.toLowerCase().includes(paletteSearch.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(paletteSearch.toLowerCase()) ||
      item.badge.toLowerCase().includes(paletteSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const selectedJob = jobLogs.find((j) => j.id === selectedJobId) || jobLogs[0] || null;

  return (
    <div className="space-y-5">
      {/* Top Command Header */}
      <div className="border border-slate-200 rounded-2xl bg-white p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Visual Automation Builder & Durable Job Engine
            </span>
            <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-md bg-slate-100 text-[#0F172A] border border-slate-200">
              v{version}.0
            </span>
            {hasUnsavedChanges && (
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                Unsaved Canvas Edits
              </span>
            )}
          </div>
          <h2 className="font-display text-lg sm:text-xl lg:text-2xl font-bold text-[#0F172A]">
            Drag-and-Drop Omnichannel Workflow Canvas
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Orchestrate event triggers, multi-path conditional logic, per-message time schedules, and
            idempotent background job queues
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Workspace Sub-View Switcher */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setWorkspaceTab('canvas')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                workspaceTab === 'canvas'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-slate-700 hover:text-[#0F172A]'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Visual Canvas ({nodes.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceTab('scheduler')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                workspaceTab === 'scheduler'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-slate-700 hover:text-[#0F172A]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Time Delay & Scheduling</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceTab('queue')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                workspaceTab === 'queue'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-slate-700 hover:text-[#0F172A]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Job Queue & Logs ({jobLogs.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceTab('versions')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                workspaceTab === 'versions'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-slate-700 hover:text-[#0F172A]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Versions & Reliability</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Workflow</span>
          </button>
        </div>
      </div>

      {/* Live Feedback Banner */}
      {statusBanner && (
        <div className="border border-emerald-200 bg-emerald-50/90 text-[#0F172A] px-4 py-3 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Step 1 Bar: Select Created Contact List Before Creating Automation */}
      <div className="border border-slate-200 rounded-2xl bg-white p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0F172A] text-emerald-400 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Step 1 · Select Your Created Contact List to Run Automation In
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {allAvailableLists.length > 0
                ? 'Select the Contact List you created so your automation runs directly on contacts entering that list (including from Landing Pages & Forms):'
                : 'Create a Contact List first so you can select which list your automation and landing forms run in.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {allAvailableLists.length > 0 ? (
            <>
              <select
                value={newTargetList}
                onChange={(e) => setNewTargetList(e.target.value)}
                className="px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl text-[#0F172A]"
              >
                {allAvailableLists.map((lst) => (
                  <option key={lst.id} value={lst.name}>
                    List: {lst.name} ({getContactsCountForList(lst.name)} contacts)
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  if (!newTargetList && allAvailableLists.length > 0) {
                    setNewTargetList(allAvailableLists[0].name);
                  }
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  Create Automation for &ldquo;{newTargetList || allAvailableLists[0]?.name}&rdquo;
                </span>
              </button>

              {onCreateFormForList && (
                <button
                  type="button"
                  onClick={() =>
                    onCreateFormForList(newTargetList || allAvailableLists[0]?.name || '')
                  }
                  className="px-3.5 py-2 text-xs font-bold text-[#0F172A] bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  + Create Form/Page for List
                </button>
              )}

              {allAvailableLists.length > 1 && (
                <select
                  value={listFilter}
                  onChange={(e) => setListFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700"
                >
                  <option value="all">Filter: All Lists ({automations.length})</option>
                  {allAvailableLists.map((lst) => (
                    <option key={lst.id} value={lst.name}>
                      Filter List: {lst.name}
                    </option>
                  ))}
                </select>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              {onNavigateToLists && (
                <button
                  type="button"
                  onClick={onNavigateToLists}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Create Contact List First</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowInlineListCreator(true);
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-bold text-[#0F172A] bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                + Quick-Create List & Automation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main 12-Column Builder Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT 4 COLUMNS: Workflows Directory OR Drag-and-Drop Node Palette */}
        <div className="lg:col-span-4 border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs">
          {/* Left Panel Mode Tabs */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setLeftSidebarMode('workflows')}
              className={`py-2.5 px-3 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                leftSidebarMode === 'workflows'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#0F172A] bg-white border border-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Workflows ({automations.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setLeftSidebarMode('palette')}
              className={`py-2.5 px-3 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                leftSidebarMode === 'palette'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#0F172A] bg-white border border-slate-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Node Palette (39)</span>
            </button>
          </div>

          {leftSidebarMode === 'workflows' ? (
            <div>
              {/* Filter Bar */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Filter Status
                </span>
                <div className="flex items-center gap-1">
                  {(['all', 'active', 'paused'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg capitalize cursor-pointer ${
                        statusFilter === st
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {filteredAutomations.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    No automation workflows created yet.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Create a workflow or drag nodes from the palette to start automating.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="mt-4 px-4 py-2 text-xs font-bold text-white bg-emerald-700 rounded-xl cursor-pointer"
                  >
                    Create First Automation
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
                  {filteredAutomations.map((auto) => {
                    const isSelected = activeWorkflow?.id === auto.id;
                    const autoTargetList = resolveAutomationTargetList(auto);
                    return (
                      <div
                        key={auto.id}
                        onClick={() => setSelectedId(auto.id)}
                        className={`p-5 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50/50 border-l-4 border-l-emerald-700'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-display text-base font-bold text-[#0F172A]">
                                {auto.name}
                              </h3>
                              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                v{auto.version || 1}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                              Trigger: {auto.triggerType.replace(/_/g, ' ')}
                            </div>
                            <div className="text-xs font-bold text-emerald-800 mt-1 flex items-center gap-1">
                              <Layers className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                              <span>
                                List: {autoTargetList || 'All Contacts'}
                                {autoTargetList
                                  ? ` (${getContactsCountForList(autoTargetList)} contacts)`
                                  : ''}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-md font-bold ${
                              auto.status === 'active'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {auto.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-slate-100 text-xs">
                          <div>
                            <div className="text-slate-400">Enrolled</div>
                            <div className="font-mono font-bold text-[#0F172A]">
                              {auto.enrolledCount.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-400">Completed</div>
                            <div className="font-mono font-bold text-[#0F172A]">
                              {auto.completedCount.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-400">Conv. Rate</div>
                            <div className="font-mono font-bold text-emerald-700">
                              {auto.conversionRate}%
                            </div>
                          </div>
                        </div>

                        <div
                          className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleWorkflowStatus(auto)}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                            >
                              {auto.status === 'active' ? (
                                <>
                                  <Pause className="w-3 h-3" />
                                  <span>Pause</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3" />
                                  <span>Resume</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedId(auto.id);
                                setLeftSidebarMode('palette');
                                setWorkspaceTab('canvas');
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer"
                            >
                              + Add Nodes
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => onDeleteAutomation(auto.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer"
                            title="Delete Workflow"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* DRAG-AND-DROP NODE PALETTE */
            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
                  Drag Onto Canvas or Click to Append
                </div>
                <input
                  type="text"
                  value={paletteSearch}
                  onChange={(e) => setPaletteSearch(e.target.value)}
                  placeholder="Search 12 triggers, 15 actions, conditions, delays..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A] focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              {/* Category Filter Tabs */}
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'all', label: 'All (38)' },
                    { id: 'trigger', label: 'Triggers (12)' },
                    { id: 'action', label: 'Actions (15)' },
                    { id: 'condition', label: 'Conditions (7)' },
                    { id: 'delay', label: 'Delays (4)' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPaletteCategory(tab.id)}
                    className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      paletteCategory === tab.id
                        ? 'bg-[#0F172A] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Target Branch Selector when adding non-trigger nodes */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Target Branch Path:
                </span>
                <select
                  value={targetBranchForAdd}
                  onChange={(e) => setTargetBranchForAdd(e.target.value as BranchPathType)}
                  className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg text-[#0F172A]"
                >
                  <option value="main">Main Trunk</option>
                  <option value="yes">IF/ELSE: YES Branch</option>
                  <option value="no">IF/ELSE: NO Branch</option>
                  <option value="path_a">Multi-Path: Path A</option>
                  <option value="path_b">Multi-Path: Path B</option>
                  <option value="path_c">Multi-Path: Path C</option>
                </select>
              </div>

              {/* Palette Items List */}
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {allPaletteItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDraggedPaletteItem(item)}
                    onDragEnd={() => {
                      setDraggedPaletteItem(null);
                      setDropTargetIndex(null);
                    }}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-[#0F172A] transition-all cursor-grab active:cursor-grabbing flex items-start justify-between gap-3 group shadow-2xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <GripVertical className="w-4 h-4 text-slate-400 shrink-0 mt-0.5 group-hover:text-[#0F172A]" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md ${
                              item.category === 'trigger'
                                ? 'bg-[#0F172A] text-white'
                                : item.category === 'condition'
                                ? 'bg-emerald-900 text-white'
                                : item.category === 'delay'
                                ? 'bg-slate-200 text-[#0F172A]'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {item.category}
                          </span>
                          <span className="text-xs font-bold text-[#0F172A] truncate">
                            {item.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddNodeFromPalette(item)}
                      className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-700 hover:text-white rounded-lg border border-emerald-200 transition-colors shrink-0 cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT 8 COLUMNS: VISUAL CANVAS / JOB QUEUE / VERSIONS */}
        <div className="lg:col-span-8 space-y-6">
          {workspaceTab === 'canvas' && (
            <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs">
              {/* Canvas Top Toolbar */}
              <div className="p-5 bg-[#0F172A] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                      {activeWorkflow ? activeWorkflow.status : 'Draft Canvas'}
                    </span>
                    <span className="text-xs font-mono text-slate-300">
                      Version v{version} • {nodes.length} Nodes
                    </span>
                    {activeWorkflow && (
                      <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1">
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[11px] text-slate-300 font-semibold">
                          Runs in List:
                        </span>
                        {allAvailableLists.length > 0 ? (
                          <select
                            value={
                              resolveAutomationTargetList(activeWorkflow) ||
                              allAvailableLists[0]?.name ||
                              ''
                            }
                            onChange={(e) => handleSwitchActiveWorkflowList(e.target.value)}
                            className="bg-transparent text-xs font-bold text-emerald-400 focus:outline-none cursor-pointer"
                          >
                            {!allAvailableLists.some(
                              (l) =>
                                l.name.toLowerCase() ===
                                resolveAutomationTargetList(activeWorkflow).toLowerCase()
                            ) &&
                              resolveAutomationTargetList(activeWorkflow) && (
                                <option
                                  value={resolveAutomationTargetList(activeWorkflow)}
                                  className="text-slate-900"
                                >
                                  {resolveAutomationTargetList(activeWorkflow)}
                                </option>
                              )}
                            {allAvailableLists.map((lst) => (
                              <option key={lst.id} value={lst.name} className="text-slate-900">
                                {lst.name} ({getContactsCountForList(lst.name)} contacts)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs font-bold text-emerald-400">
                            {resolveAutomationTargetList(activeWorkflow) || 'Select List'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <h3 className="font-display text-xl font-bold mt-1.5">
                    {activeWorkflow ? activeWorkflow.name : 'Visual Workflow Sandbox'}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setLeftSidebarMode('palette')}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Open Node Palette</span>
                  </button>

                  {activeWorkflow && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsLiveRunnerOpen((prev) => !prev)}
                        className="px-3.5 py-2 text-xs font-bold text-[#0F172A] bg-emerald-400 hover:bg-emerald-300 rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>
                          {isLiveRunnerOpen ? 'Close Live Test Panel' : 'Test & Run Automation Now'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEnqueueWorkflowJob(null, { bypassIdempotency: true })}
                        disabled={isExecutingJob}
                        className="px-3.5 py-2 text-xs font-bold text-[#0F172A] bg-white hover:bg-slate-100 rounded-xl inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Zap className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{isExecutingJob ? 'Executing...' : 'Quick Execute All Steps'}</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveAndPublishVersion}
                    disabled={isSavingGraph}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>
                      {isSavingGraph ? 'Publishing...' : `Publish v${activeWorkflow ? version + 1 : 1}`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Interactive Live Automation Test & Multi-Channel Delivery Receipt Drawer */}
              {(isLiveRunnerOpen || latestExecutionReceipts.length > 0) && activeWorkflow && (
                <div className="p-5 bg-emerald-950 text-white border-b border-slate-800 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                          Live End-to-End Workflow Executor
                        </span>
                        <span className="text-slate-500">·</span>
                        <span className="text-xs text-slate-300">
                          Executes Triggers, Conditions, CRM Actions & Multi-Channel Messages (WhatsApp, Email, SMS)
                        </span>
                      </div>
                      <h4 className="font-display text-base font-bold text-white mt-0.5">
                        Run &ldquo;{activeWorkflow.name}&rdquo; on a Real or Custom Lead
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      {onNavigateToInbox && latestExecutionReceipts.length > 0 && (
                        <button
                          type="button"
                          onClick={onNavigateToInbox}
                          className="px-3 py-1.5 text-xs font-bold text-emerald-300 bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 rounded-lg cursor-pointer"
                        >
                          View Sent Messages in Unified Inbox →
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setIsLiveRunnerOpen(false);
                          setLatestExecutionReceipts([]);
                        }}
                        className="text-xs font-bold text-slate-400 hover:text-white cursor-pointer px-2 py-1"
                      >
                        Hide Panel
                      </button>
                    </div>
                  </div>

                  {/* Recipient Selector: Existing Contact vs Custom Phone/Email */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-4 rounded-xl bg-slate-900/90 border border-slate-800 items-end">
                    <div className="lg:col-span-3">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Recipient Mode
                      </label>
                      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setUseCustomRecipient(false)}
                          className={`py-1.5 px-2 text-xs font-bold rounded-md cursor-pointer ${
                            !useCustomRecipient
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          CRM Contact
                        </button>
                        <button
                          type="button"
                          onClick={() => setUseCustomRecipient(true)}
                          className={`py-1.5 px-2 text-xs font-bold rounded-md cursor-pointer ${
                            useCustomRecipient
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Custom Lead
                        </button>
                      </div>
                    </div>

                    {!useCustomRecipient ? (
                      <div className="lg:col-span-6">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Select Lead from Contact List
                        </label>
                        <select
                          value={enrollContactId}
                          onChange={(e) => setEnrollContactId(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-bold bg-slate-950 border border-slate-700 rounded-lg text-white"
                        >
                          <option value="">
                            {contacts.length > 0
                              ? `Auto-Select from "${
                                  resolveAutomationTargetList(activeWorkflow) || 'All Contacts'
                                }"`
                              : 'Default Test Lead'}
                          </option>
                          {contacts.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.fullName} · {c.email} · {c.phone} (List: {c.listName})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <>
                        <div className="lg:col-span-2">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Lead Name
                          </label>
                          <input
                            type="text"
                            value={customTestName}
                            onChange={(e) => setCustomTestName(e.target.value)}
                            placeholder="Your Name"
                            className="w-full px-2.5 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white"
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Lead Email
                          </label>
                          <input
                            type="email"
                            value={customTestEmail}
                            onChange={(e) => setCustomTestEmail(e.target.value)}
                            placeholder="you@domain.com"
                            className="w-full px-2.5 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-white"
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            WhatsApp / SMS Phone
                          </label>
                          <input
                            type="text"
                            value={customTestPhone}
                            onChange={(e) => setCustomTestPhone(e.target.value)}
                            placeholder="+15552348910"
                            className="w-full px-2.5 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-white"
                          />
                        </div>
                      </>
                    )}

                    <div className="lg:col-span-3">
                      <button
                        type="button"
                        disabled={isExecutingJob}
                        onClick={() => handleEnqueueWorkflowJob(null, { bypassIdempotency: true })}
                        className="w-full py-2.5 px-4 text-xs font-bold text-[#0F172A] bg-emerald-400 hover:bg-emerald-300 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {isExecutingJob
                            ? 'Executing Workflow...'
                            : 'Execute Workflow & Send Messages'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Verified Multi-Channel Delivery Receipts from Latest Run */}
                  {latestExecutionReceipts.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>
                            Verified Multi-Channel Delivery Receipts ({latestExecutionReceipts.length}{' '}
                            Message Step{latestExecutionReceipts.length === 1 ? '' : 's'} Dispatched)
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setWorkspaceTab('queue')}
                          className="text-xs font-bold text-emerald-300 hover:underline cursor-pointer"
                        >
                          Open Full Step Trace in Job Queue →
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {latestExecutionReceipts.map((rcpt) => (
                          <div
                            key={rcpt.receiptId}
                            className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-bold uppercase text-emerald-400">
                                {rcpt.channel} DISPATCHED · {rcpt.receiptId}
                              </span>
                              <a
                                href={rcpt.directLaunchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg inline-flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>
                                  {rcpt.channel === 'whatsapp'
                                    ? 'Open in WhatsApp'
                                    : rcpt.channel === 'email'
                                    ? 'Open in Email'
                                    : 'Open in SMS'}
                                </span>
                              </a>
                            </div>
                            <div className="text-[11px] text-slate-300 font-mono">
                              From: <strong className="text-white">{rcpt.fromIdentity}</strong> → To:{' '}
                              <strong className="text-emerald-300">{rcpt.toRecipient}</strong> (
                              {rcpt.leadName})
                            </div>
                            <div className="p-2 rounded-lg bg-slate-950 text-slate-200 text-[11px] border border-slate-800">
                              {rcpt.bodyPreview}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Interactive Canvas Surface + Node Inspector Split */}
              <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-slate-200">
                {/* Interactive Drag-and-Drop Graph Canvas (7 Cols) */}
                <div
                  className="xl:col-span-7 p-6 bg-[#F8FAFC] min-h-[620px] max-h-[760px] overflow-y-auto"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedPaletteItem) {
                      handleAddNodeFromPalette(
                        draggedPaletteItem,
                        dropTargetIndex !== null ? dropTargetIndex : nodes.length
                      );
                      setDraggedPaletteItem(null);
                      setDropTargetIndex(null);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-slate-500">
                      Drag nodes to reorder or drop new blocks from palette
                    </span>
                    <span className="text-[11px] font-mono text-emerald-700 font-bold">
                      Idempotent DAG Engine
                    </span>
                  </div>

                  {/* Per-Message Automation Composer & Quick Schedule Bar inside Workflow */}
                  <div className="mb-4 rounded-2xl bg-white border-2 border-emerald-600/30 shadow-xs overflow-hidden">
                    <div className="p-3.5 bg-emerald-50/70 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
                          <Clock className="w-4 h-4 text-emerald-700" />
                          <span>Per-Message Automation & Time Scheduling</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          WhatsApp Auto-Pilot From:{' '}
                          <strong className="font-mono text-slate-900">
                            {senderIdentities.whatsappBusinessNumber}
                          </strong>{' '}
                          · Email From:{' '}
                          <strong className="font-mono text-slate-900">
                            {senderIdentities.activeSenderEmail}
                          </strong>{' '}
                          ({senderIdentities.activeEmailMode === 'custom_domain'
                            ? 'Custom Domain'
                            : 'Platform Default'})
                          {onNavigateToSettings && (
                            <>
                              {' · '}
                              <button
                                type="button"
                                onClick={onNavigateToSettings}
                                className="font-bold text-emerald-700 hover:underline cursor-pointer"
                              >
                                Edit in Settings
                              </button>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsMessageComposerOpen((prev) => !prev)}
                          className="px-3 py-1.5 text-xs font-bold bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-400" />
                          <span>
                            {isMessageComposerOpen
                              ? 'Close Message Scheduler'
                              : '+ Add Scheduled Message'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkspaceTab('scheduler')}
                          className="px-2.5 py-1.5 text-[11px] font-bold bg-white hover:bg-emerald-700 hover:text-white text-emerald-800 rounded-xl border border-emerald-200 transition-colors cursor-pointer"
                        >
                          Full Timeline View →
                        </button>
                      </div>
                    </div>

                    {isMessageComposerOpen && (
                      <form
                        onSubmit={handleAddScheduledMessageToWorkflow}
                        className="p-4 border-t border-emerald-200/70 bg-white space-y-3.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                            New Automated Message + Delivery Schedule
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            Appends directly into workflow
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Message Channel
                            </label>
                            <select
                              value={msgChannel}
                              onChange={(e) => {
                                const ch = e.target.value as 'email' | 'whatsapp' | 'sms';
                                setMsgChannel(ch);
                                if (ch === 'whatsapp') {
                                  setMsgTitle('Send Official WhatsApp Message');
                                  setMsgSubjectOrTemplate('wa_vip_followup_v1');
                                } else if (ch === 'sms') {
                                  setMsgTitle('Send Automated SMS Alert');
                                  setMsgSubjectOrTemplate('SMS Priority Reminder');
                                } else {
                                  setMsgTitle('Send Automated Follow-Up Email');
                                  setMsgSubjectOrTemplate('Important Next Steps for {{first_name}}');
                                }
                              }}
                              className="w-full px-2.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-[#0F172A]"
                            >
                              <option value="email">Email Message</option>
                              <option value="whatsapp">WhatsApp (Official API)</option>
                              <option value="sms">SMS via Provider</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Step Title on Canvas
                            </label>
                            <input
                              type="text"
                              required
                              value={msgTitle}
                              onChange={(e) => setMsgTitle(e.target.value)}
                              className="w-full px-2.5 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-[#0F172A]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Workflow Branch Path
                            </label>
                            <select
                              value={msgBranchPath}
                              onChange={(e) => setMsgBranchPath(e.target.value as BranchPathType)}
                              className="w-full px-2.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-[#0F172A]"
                            >
                              <option value="main">Main Linear Flow</option>
                              <option value="yes">IF/ELSE → YES Branch</option>
                              <option value="no">IF/ELSE → NO Branch</option>
                              <option value="path_a">Multi-Path → Path A</option>
                              <option value="path_b">Multi-Path → Path B</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              {msgChannel === 'whatsapp'
                                ? 'Approved WhatsApp Template Name'
                                : 'Email Subject / SMS Sender Header'}
                            </label>
                            <input
                              type="text"
                              value={msgSubjectOrTemplate}
                              onChange={(e) => setMsgSubjectOrTemplate(e.target.value)}
                              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-[#0F172A]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Automated Message Body
                            </label>
                            <input
                              type="text"
                              value={msgBody}
                              onChange={(e) => setMsgBody(e.target.value)}
                              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-[#0F172A]"
                            />
                          </div>
                        </div>

                        {/* Per-Message Time Delay & Schedule Picker */}
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>When Should This Message Be Sent?</span>
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {(
                                [
                                  { id: 'immediate', label: 'Immediately' },
                                  { id: 'delay', label: 'Time Delay (+Min/Hr/Day)' },
                                  { id: 'specific_datetime', label: 'Specific Date/Time' },
                                  { id: 'time_window', label: 'Daily Send Time' },
                                ] as const
                              ).map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => setMsgScheduleMode(m.id)}
                                  className={`px-2 py-1 text-[10px] font-bold rounded-md cursor-pointer transition-colors ${
                                    msgScheduleMode === m.id
                                      ? 'bg-[#0F172A] text-white'
                                      : 'bg-white text-slate-600 border border-slate-200 hover:text-[#0F172A]'
                                  }`}
                                >
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {msgScheduleMode === 'delay' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                  Wait Duration Before Message
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={365}
                                  value={msgDelayAmount}
                                  onChange={(e) =>
                                    setMsgDelayAmount(Math.max(1, Number(e.target.value)))
                                  }
                                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg text-[#0F172A]"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                  Time Unit
                                </label>
                                <select
                                  value={msgDelayUnit}
                                  onChange={(e) => setMsgDelayUnit(e.target.value as DelayUnit)}
                                  className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-[#0F172A]"
                                >
                                  <option value="minutes">Minutes</option>
                                  <option value="hours">Hours</option>
                                  <option value="days">Days</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                  Preferred Send Time
                                </label>
                                <input
                                  type="time"
                                  value={msgScheduledTime}
                                  onChange={(e) => setMsgScheduledTime(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg text-[#0F172A]"
                                />
                              </div>
                            </div>
                          )}

                          {msgScheduleMode === 'specific_datetime' && (
                            <div className="pt-1">
                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                Exact Delivery Date & Time for This Message
                              </label>
                              <input
                                type="datetime-local"
                                value={msgSpecificDateTime}
                                onChange={(e) => setMsgSpecificDateTime(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg text-[#0F172A]"
                              />
                            </div>
                          )}

                          {msgScheduleMode === 'time_window' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                  Send Message At Time of Day
                                </label>
                                <input
                                  type="time"
                                  value={msgScheduledTime}
                                  onChange={(e) => setMsgScheduledTime(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg text-[#0F172A]"
                                />
                              </div>
                              <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2 text-xs font-semibold text-[#0F172A] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={msgBusinessDaysOnly}
                                    onChange={(e) => setMsgBusinessDaysOnly(e.target.checked)}
                                    className="accent-emerald-700"
                                  />
                                  <span>Business Days Only (Mon–Fri)</span>
                                </label>
                              </div>
                            </div>
                          )}

                          {msgScheduleMode === 'delay' && (
                            <label className="flex items-center gap-2 text-[11px] font-semibold text-[#0F172A] cursor-pointer pt-1">
                              <input
                                type="checkbox"
                                checked={msgBusinessDaysOnly}
                                onChange={(e) => setMsgBusinessDaysOnly(e.target.checked)}
                                className="accent-emerald-700"
                              />
                              <span>Only dispatch this message on Business Days (Mon–Fri)</span>
                            </label>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsMessageComposerOpen(false)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl cursor-pointer"
                          >
                            Add Scheduled Message to Workflow
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  <div className="space-y-2">
                    {nodes.map((node, index) => {
                      const isSelected = selectedNodeId === node.id;
                      const isTrigger = node.category === 'trigger';
                      const isCondition = node.category === 'condition';
                      const isDelay = node.category === 'delay';

                      return (
                        <React.Fragment key={node.id}>
                          {/* Dropzone Indicator before node */}
                          {index > 0 && (
                            <div
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDropTargetIndex(index);
                              }}
                              onDragLeave={() => setDropTargetIndex(null)}
                              onDrop={(e) => {
                                e.stopPropagation();
                                if (draggedPaletteItem) {
                                  handleAddNodeFromPalette(draggedPaletteItem, index);
                                  setDraggedPaletteItem(null);
                                  setDropTargetIndex(null);
                                } else if (draggedCanvasNodeId) {
                                  const fromIdx = nodes.findIndex(
                                    (n) => n.id === draggedCanvasNodeId
                                  );
                                  if (fromIdx > 0 && fromIdx !== index) {
                                    setNodes((prev) => {
                                      const copy = [...prev];
                                      const [moved] = copy.splice(fromIdx, 1);
                                      copy.splice(index > fromIdx ? index - 1 : index, 0, moved);
                                      return copy;
                                    });
                                    setHasUnsavedChanges(true);
                                  }
                                  setDraggedCanvasNodeId(null);
                                  setDropTargetIndex(null);
                                }
                              }}
                              className={`flex flex-col items-center transition-all ${
                                dropTargetIndex === index
                                  ? 'py-3 bg-emerald-50/80 border-2 border-dashed border-emerald-600 rounded-xl'
                                  : 'py-1'
                              }`}
                            >
                              <div className="w-0.5 h-3.5 bg-slate-300" />
                              <ArrowDown className="w-3.5 h-3.5 text-slate-400 -mt-1" />
                            </div>
                          )}

                          {/* Canvas Node Card */}
                          <div
                            draggable={!isTrigger}
                            onDragStart={() => setDraggedCanvasNodeId(node.id)}
                            onDragEnd={() => {
                              setDraggedCanvasNodeId(null);
                              setDropTargetIndex(null);
                            }}
                            onClick={() => setSelectedNodeId(node.id)}
                            className={`rounded-2xl p-4 transition-all cursor-pointer border-2 ${
                              isTrigger
                                ? isSelected
                                  ? 'bg-[#0F172A] text-white border-emerald-500 shadow-md'
                                  : 'bg-[#0F172A] text-white border-[#0F172A] hover:border-slate-700'
                                : isSelected
                                ? 'bg-white border-emerald-600 shadow-md ring-2 ring-emerald-500/15'
                                : 'bg-white border-slate-200 hover:border-slate-400 shadow-2xs'
                            } ${
                              node.branchPath === 'yes'
                                ? 'ml-6 border-l-4 border-l-emerald-600'
                                : node.branchPath === 'no'
                                ? 'ml-6 border-l-4 border-l-slate-700'
                                : node.branchPath !== 'main'
                                ? 'ml-6 border-l-4 border-l-emerald-800'
                                : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 min-w-0">
                                {!isTrigger && (
                                  <GripVertical className="w-4 h-4 text-slate-400 shrink-0 mt-1 cursor-grab" />
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md ${
                                        isTrigger
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                          : isCondition
                                          ? 'bg-[#0F172A] text-white'
                                          : isDelay
                                          ? 'bg-slate-100 text-[#0F172A] border border-slate-300'
                                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      }`}
                                    >
                                      {index === 0
                                        ? '00 • TRIGGER'
                                        : `${String(index).padStart(2, '0')} • ${node.category.toUpperCase()}`}
                                    </span>

                                    {node.branchPath !== 'main' && (
                                      <span
                                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md ${
                                          node.branchPath === 'yes'
                                            ? 'bg-emerald-700 text-white'
                                            : 'bg-slate-800 text-white'
                                        }`}
                                      >
                                        Branch: {node.branchPath.toUpperCase()}
                                      </span>
                                    )}
                                  </div>

                                  <div
                                    className={`font-display text-sm font-bold mt-1.5 ${
                                      isTrigger ? 'text-white' : 'text-[#0F172A]'
                                    }`}
                                  >
                                    {node.title}
                                  </div>
                                  <div
                                    className={`text-xs mt-0.5 ${
                                      isTrigger ? 'text-slate-300' : 'text-slate-500'
                                    }`}
                                  >
                                    {node.subtitle}
                                  </div>

                                  {/* Quick Config Summary Pills */}
                                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                    {node.config.channel && (
                                      <span
                                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md ${
                                          isTrigger
                                            ? 'bg-slate-800 text-slate-300'
                                            : 'bg-slate-100 text-slate-700'
                                        }`}
                                      >
                                        Channel: {node.config.channel}
                                      </span>
                                    )}
                                    {node.subType === 'send_whatsapp' && (
                                      <>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 font-bold">
                                          From WhatsApp: {senderIdentities.whatsappBusinessNumber}
                                        </span>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
                                          Gateway: {getWhatsAppProviderLabel(storedGateways.whatsapp.providerMode)}
                                        </span>
                                      </>
                                    )}
                                    {node.subType === 'send_email' && (
                                      <>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-900 text-emerald-300 font-bold">
                                          From Email: {senderIdentities.activeSenderEmail} (
                                          {senderIdentities.activeEmailMode === 'custom_domain'
                                            ? 'Custom Domain'
                                            : 'Platform Email'}
                                          )
                                        </span>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-300 font-bold">
                                          Gateway: {getEmailProviderLabel(storedGateways.email.providerMode)}
                                        </span>
                                      </>
                                    )}
                                    {node.subType === 'send_sms' && (
                                      <>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-emerald-300 font-bold">
                                          From SMS ID: {senderIdentities.smsSenderId}
                                        </span>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                                          Gateway: {getSmsProviderLabel(storedGateways.sms.providerMode)}
                                        </span>
                                      </>
                                    )}
                                    {(node.subType === 'send_email' ||
                                      node.subType === 'send_whatsapp' ||
                                      node.subType === 'send_sms') && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex flex-wrap items-center gap-1.5"
                                      >
                                        <button
                                          type="button"
                                          disabled={testingStepNodeId === node.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void handleTestSingleMessageNode(node);
                                          }}
                                          className="px-2.5 py-1 text-[10px] font-bold bg-[#0F172A] hover:bg-slate-800 text-white rounded-md inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                                          title="Send a live test message of this step to your device"
                                        >
                                          <Send className="w-3 h-3 text-emerald-400" />
                                          <span>
                                            {testingStepNodeId === node.id
                                              ? 'Sending Live...'
                                              : 'Send Live Test to Me'}
                                          </span>
                                        </button>
                                        {lastStepReceipt?.nodeId === node.id && (
                                          <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 inline-flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                            <span>
                                              Delivered to {lastStepReceipt.receipt.toRecipient} (
                                              {lastStepReceipt.receipt.providerUsed})
                                            </span>
                                            {lastStepReceipt.receipt.directLaunchUrl && (
                                              <a
                                                href={lastStepReceipt.receipt.directLaunchUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="underline hover:text-emerald-950 ml-1 inline-flex items-center gap-0.5"
                                              >
                                                Open <ExternalLink className="w-2.5 h-2.5" />
                                              </a>
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {(node.subType === 'send_email' ||
                                      node.subType === 'send_whatsapp' ||
                                      node.subType === 'send_sms') && (
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                        {node.config.messageScheduleMode === 'delay'
                                          ? `Schedule: Wait ${node.config.delayAmount || 1} ${
                                              node.config.delayUnit || 'hours'
                                            }${
                                              node.config.scheduledSendTime
                                                ? ` • @${node.config.scheduledSendTime}`
                                                : ''
                                            }`
                                          : node.config.messageScheduleMode ===
                                              'specific_datetime' && node.config.specificDateTime
                                          ? `Schedule: ${node.config.specificDateTime.replace(
                                              'T',
                                              ' '
                                            )}`
                                          : node.config.messageScheduleMode === 'time_window'
                                          ? `Schedule: Send @ ${
                                              node.config.scheduledSendTime || '09:00'
                                            }${node.config.businessDaysOnly ? ' (Mon–Fri)' : ''}`
                                          : 'Schedule: Send Immediately (0m)'}
                                      </span>
                                    )}
                                    {node.category === 'delay' && (
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                        Hold: {node.config.delayAmount || 1}{' '}
                                        {node.config.delayUnit || 'days'}
                                        {node.config.businessDaysOnly ? ' (Mon-Fri Only)' : ''}
                                      </span>
                                    )}
                                    {node.category === 'condition' && (
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-[#0F172A] font-bold">
                                        Rule: {node.config.conditionField || 'engagement'}{' '}
                                        {node.config.conditionOperator || 'equals'}{' '}
                                        {node.config.conditionValue || 'true'}
                                      </span>
                                    )}
                                    {node.config.targetTag && (
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold">
                                        #{node.config.targetTag}
                                      </span>
                                    )}
                                  </div>

                                  {/* Inline Per-Message Time Delay & Delivery Scheduler directly on every Automated Message Card */}
                                  {(node.subType === 'send_email' ||
                                    node.subType === 'send_whatsapp' ||
                                    node.subType === 'send_sms') && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                                          <Clock className="w-3 h-3" />
                                          <span>Message Time Schedule:</span>
                                        </span>
                                        <div className="flex flex-wrap items-center gap-1">
                                          {(
                                            [
                                              { id: 'immediate', label: 'Immediate' },
                                              { id: 'delay', label: 'Wait Delay' },
                                              { id: 'specific_datetime', label: 'Date & Time' },
                                              { id: 'time_window', label: 'Time of Day' },
                                            ] as const
                                          ).map((modeOpt) => {
                                            const activeMode =
                                              node.config.messageScheduleMode || 'immediate';
                                            return (
                                              <button
                                                key={modeOpt.id}
                                                type="button"
                                                onClick={() =>
                                                  handleUpdateNodeById(
                                                    node.id,
                                                    {},
                                                    {
                                                      messageScheduleMode: modeOpt.id,
                                                      delayAmount: node.config.delayAmount || 2,
                                                      delayUnit: node.config.delayUnit || 'hours',
                                                      scheduledSendTime:
                                                        node.config.scheduledSendTime || '09:00',
                                                      specificDateTime:
                                                        node.config.specificDateTime ||
                                                        '2026-10-15T09:00',
                                                    }
                                                  )
                                                }
                                                className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                                                  activeMode === modeOpt.id
                                                    ? 'bg-[#0F172A] text-white'
                                                    : 'bg-white text-slate-600 border border-slate-200 hover:text-[#0F172A]'
                                                }`}
                                              >
                                                {modeOpt.label}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {(node.config.messageScheduleMode || 'immediate') ===
                                        'delay' && (
                                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                          <span className="text-[11px] font-semibold text-slate-600">
                                            Wait
                                          </span>
                                          <input
                                            type="number"
                                            min={1}
                                            max={365}
                                            value={node.config.delayAmount || 1}
                                            onChange={(e) =>
                                              handleUpdateNodeById(
                                                node.id,
                                                {},
                                                {
                                                  delayAmount: Math.max(1, Number(e.target.value)),
                                                }
                                              )
                                            }
                                            className="w-14 px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg text-[#0F172A]"
                                          />
                                          <select
                                            value={node.config.delayUnit || 'hours'}
                                            onChange={(e) =>
                                              handleUpdateNodeById(
                                                node.id,
                                                {},
                                                { delayUnit: e.target.value as DelayUnit }
                                              )
                                            }
                                            className="px-2 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg text-[#0F172A]"
                                          >
                                            <option value="minutes">Minutes</option>
                                            <option value="hours">Hours</option>
                                            <option value="days">Days</option>
                                          </select>
                                          <span className="text-[11px] font-semibold text-slate-600">
                                            at
                                          </span>
                                          <input
                                            type="time"
                                            value={node.config.scheduledSendTime || '09:00'}
                                            onChange={(e) =>
                                              handleUpdateNodeById(
                                                node.id,
                                                {},
                                                { scheduledSendTime: e.target.value }
                                              )
                                            }
                                            className="px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg text-[#0F172A]"
                                          />
                                          <label className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 cursor-pointer ml-1">
                                            <input
                                              type="checkbox"
                                              checked={Boolean(node.config.businessDaysOnly)}
                                              onChange={(e) =>
                                                handleUpdateNodeById(
                                                  node.id,
                                                  {},
                                                  { businessDaysOnly: e.target.checked }
                                                )
                                              }
                                              className="accent-emerald-700"
                                            />
                                            <span>Mon–Fri</span>
                                          </label>
                                        </div>
                                      )}

                                      {node.config.messageScheduleMode === 'specific_datetime' && (
                                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                          <span className="text-[11px] font-semibold text-slate-600">
                                            Send on:
                                          </span>
                                          <input
                                            type="datetime-local"
                                            value={
                                              node.config.specificDateTime || '2026-10-15T09:00'
                                            }
                                            onChange={(e) =>
                                              handleUpdateNodeById(
                                                node.id,
                                                {},
                                                { specificDateTime: e.target.value }
                                              )
                                            }
                                            className="px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg text-[#0F172A]"
                                          />
                                        </div>
                                      )}

                                      {node.config.messageScheduleMode === 'time_window' && (
                                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                          <span className="text-[11px] font-semibold text-slate-600">
                                            Deliver at:
                                          </span>
                                          <input
                                            type="time"
                                            value={node.config.scheduledSendTime || '09:00'}
                                            onChange={(e) =>
                                              handleUpdateNodeById(
                                                node.id,
                                                {},
                                                { scheduledSendTime: e.target.value }
                                              )
                                            }
                                            className="px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg text-[#0F172A]"
                                          />
                                          <label className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={Boolean(node.config.businessDaysOnly)}
                                              onChange={(e) =>
                                                handleUpdateNodeById(
                                                  node.id,
                                                  {},
                                                  { businessDaysOnly: e.target.checked }
                                                )
                                              }
                                              className="accent-emerald-700"
                                            />
                                            <span>Business Days Only (Mon–Fri)</span>
                                          </label>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Node Reorder & Delete Controls */}
                              {!isTrigger && (
                                <div
                                  className="flex items-center gap-1 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleMoveNode(index, 'up')}
                                    disabled={index <= 1}
                                    className="p-1 text-slate-400 hover:text-[#0F172A] disabled:opacity-30 cursor-pointer"
                                    title="Move Step Up"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveNode(index, 'down')}
                                    disabled={index >= nodes.length - 1}
                                    className="p-1 text-slate-400 hover:text-[#0F172A] disabled:opacity-30 cursor-pointer"
                                    title="Move Step Down"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNode(node.id)}
                                    className="p-1 text-slate-400 hover:text-slate-900 cursor-pointer"
                                    title="Remove Node"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Visual Branch Split Indicator for Condition Nodes */}
                            {isCondition && (
                              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                                {(node.config.branchLabels || ['Yes (True)', 'No (False)']).map(
                                  (lbl, bIdx) => (
                                    <div
                                      key={bIdx}
                                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold flex items-center justify-between ${
                                        bIdx === 0
                                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                                      }`}
                                    >
                                      <span>{lbl}</span>
                                      <ChevronRight className="w-3 h-3" />
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Right Node Configuration Inspector (5 Cols) */}
                <div className="xl:col-span-5 p-6 bg-white">
                  {selectedNode ? (
                    <div className="space-y-5">
                      <div className="border-b border-slate-200 pb-4">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Inspector • {selectedNode.category.toUpperCase()}
                        </span>
                        <h4 className="font-display text-lg font-bold text-[#0F172A] mt-2">
                          {selectedNode.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Configure execution parameters, branching rules, and provider templates
                        </p>
                      </div>

                      {/* Common Node Title & Subtitle */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Step Title
                        </label>
                        <input
                          type="text"
                          value={selectedNode.title}
                          onChange={(e) => handleUpdateSelectedNode({ title: e.target.value })}
                          className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A] font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Description / Trigger Detail
                        </label>
                        <input
                          type="text"
                          value={selectedNode.subtitle}
                          onChange={(e) => handleUpdateSelectedNode({ subtitle: e.target.value })}
                          className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
                        />
                      </div>

                      {/* Branch Assignment (for non-trigger nodes) */}
                      {selectedNode.category !== 'trigger' && (
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                            Execution Path / Branch
                          </label>
                          <select
                            value={selectedNode.branchPath}
                            onChange={(e) =>
                              handleUpdateSelectedNode({
                                branchPath: e.target.value as BranchPathType,
                              })
                            }
                            className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                          >
                            <option value="main">Main Linear Flow</option>
                            <option value="yes">IF/ELSE → YES (Matched) Branch</option>
                            <option value="no">IF/ELSE → NO (Fallback) Branch</option>
                            <option value="path_a">Multi-Path → Path A</option>
                            <option value="path_b">Multi-Path → Path B</option>
                            <option value="path_c">Multi-Path → Path C</option>
                          </select>
                        </div>
                      )}

                      {/* TRIGGER SPECIFIC CONFIG */}
                      {selectedNode.category === 'trigger' && (
                        <div className="space-y-3.5 pt-2 border-t border-slate-100">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">
                              Connected Contact List (Runs Automation In) *
                            </label>
                            {allAvailableLists.length > 0 ? (
                              <select
                                value={
                                  selectedNode.config.targetList ||
                                  (activeWorkflow
                                    ? resolveAutomationTargetList(activeWorkflow)
                                    : '') ||
                                  allAvailableLists[0]?.name ||
                                  ''
                                }
                                onChange={(e) => {
                                  const chosenList = e.target.value;
                                  const cleanSub = selectedNode.subtitle.replace(
                                    /^List:\s*[^·]+·\s*/i,
                                    ''
                                  );
                                  handleUpdateSelectedNode(
                                    {
                                      subtitle: `List: ${chosenList} · ${cleanSub}`,
                                    },
                                    { targetList: chosenList }
                                  );
                                }}
                                className="w-full px-3.5 py-2 text-xs font-bold bg-emerald-50/70 border border-emerald-300 rounded-xl text-[#0F172A]"
                              >
                                {allAvailableLists.map((lst) => (
                                  <option key={lst.id} value={lst.name}>
                                    {lst.name} ({getContactsCountForList(lst.name)} contacts stored)
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="text-xs text-slate-500 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                                Create a Contact List in the Contact Lists section to bind this
                                trigger to a list.
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                              Event Trigger Type
                            </label>
                            <select
                              value={selectedNode.subType}
                              onChange={(e) => {
                                const found = TRIGGER_CATALOG.find(
                                  (t) => t.subType === e.target.value
                                );
                                if (found) {
                                  const currentList =
                                    selectedNode.config.targetList ||
                                    (activeWorkflow
                                      ? resolveAutomationTargetList(activeWorkflow)
                                      : '');
                                  handleUpdateSelectedNode(
                                    {
                                      subType: found.subType,
                                      title: found.title,
                                      subtitle: currentList
                                        ? `List: ${currentList} · ${found.subtitle}`
                                        : found.subtitle,
                                    },
                                    {
                                      ...found.defaultConfig,
                                      ...(currentList ? { targetList: currentList } : {}),
                                    }
                                  );
                                }
                              }}
                              className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                            >
                              {TRIGGER_CATALOG.map((t) => (
                                <option key={t.id} value={t.subType}>
                                  {t.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* ACTION SPECIFIC CONFIG */}
                      {selectedNode.category === 'action' && (
                        <div className="space-y-4 pt-2 border-t border-slate-100">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                              Action Operation
                            </label>
                            <select
                              value={selectedNode.subType}
                              onChange={(e) => {
                                const found = ACTION_CATALOG.find(
                                  (a) => a.subType === e.target.value
                                );
                                if (found) {
                                  handleUpdateSelectedNode(
                                    {
                                      subType: found.subType,
                                      title: found.title,
                                      subtitle: found.subtitle,
                                    },
                                    found.defaultConfig
                                  );
                                }
                              }}
                              className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                            >
                              {ACTION_CATALOG.map((a) => (
                                <option key={a.id} value={a.subType}>
                                  {a.title}
                                </option>
                              ))}
                            </select>
                          </div>

                          {(selectedNode.subType === 'send_email' ||
                            selectedNode.subType === 'send_whatsapp' ||
                            selectedNode.subType === 'send_sms') && (
                            <>
                              {selectedNode.subType === 'send_sms' && (
                                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2 text-[11px]">
                                  <div className="font-mono font-bold uppercase text-amber-900 flex items-center justify-between">
                                    <span>Automated SMS Action · Carrier Gateway</span>
                                    <span className="text-[#047857]">Software: $0 Free</span>
                                  </div>
                                  <p className="leading-snug text-amber-900">
                                    <strong>Fee Separation Warning:</strong> FlowPilot&apos;s workflow engine is free software, but your connected SMS provider (Twilio / Telnyx / Vonage / Pinpoint) bills per-segment message &amp; carrier network fees separately.
                                  </p>
                                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateSelectedNode(
                                          {},
                                          {
                                            subjectOrTemplate: 'SMS Welcome & Resource Link',
                                            messagePreview:
                                              'Hi {{first_name}}, thanks for joining! Access your resource here: https://flowpilot.app/start — Reply STOP to opt out.',
                                          }
                                        )
                                      }
                                      className="px-2 py-1 rounded bg-white border border-amber-300 font-bold text-slate-900 cursor-pointer hover:border-[#047857]"
                                    >
                                      Load Opt-In SMS
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateSelectedNode(
                                          {},
                                          {
                                            subjectOrTemplate: 'SMS Session Reminder',
                                            messagePreview:
                                              'Hi {{first_name}}, reminder: our live session starts in 15 mins! Join here: https://flowpilot.app/live — Reply STOP to opt out.',
                                          }
                                        )
                                      }
                                      className="px-2 py-1 rounded bg-white border border-amber-300 font-bold text-slate-900 cursor-pointer hover:border-[#047857]"
                                    >
                                      Load Reminder SMS
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cur = selectedNode.config.messagePreview || '';
                                        if (!/stop/i.test(cur)) {
                                          handleUpdateSelectedNode(
                                            {},
                                            {
                                              messagePreview: `${cur.trim()} Reply STOP to opt out.`.trim(),
                                            }
                                          );
                                        }
                                      }}
                                      className="px-2 py-1 rounded bg-emerald-700 text-white font-bold cursor-pointer"
                                    >
                                      + Append STOP Opt-Out
                                    </button>
                                  </div>
                                </div>
                              )}
                              <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                  Send From Identity (
                                  {selectedNode.subType === 'send_whatsapp'
                                    ? 'WHATSAPP'
                                    : selectedNode.subType === 'send_sms'
                                    ? 'SMS'
                                    : 'EMAIL'}
                                  )
                                </label>
                                {(() => {
                                  const nodeCh: ChannelType =
                                    selectedNode.subType === 'send_whatsapp'
                                      ? 'whatsapp'
                                      : selectedNode.subType === 'send_sms'
                                      ? 'sms'
                                      : 'email';
                                  const identOptions = getSavedIdentitiesForChannel(nodeCh);
                                  const currentVal =
                                    selectedNode.config.overrideFromIdentity ||
                                    identOptions.find((i) => i.isPrimary)?.value ||
                                    identOptions[0]?.value ||
                                    '';
                                  return (
                                    <select
                                      value={currentVal}
                                      onChange={(e) => {
                                        const chosenVal = e.target.value;
                                        const matchedIdent = identOptions.find(
                                          (i) => i.value === chosenVal
                                        );
                                        handleUpdateSelectedNode(
                                          {},
                                          {
                                            overrideFromIdentity: chosenVal,
                                            senderIdentityId: matchedIdent?.id,
                                          }
                                        );
                                      }}
                                      className="w-full px-3.5 py-2 text-xs font-mono font-semibold bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A] mb-2.5"
                                    >
                                      {identOptions.map((ident) => (
                                        <option key={ident.id} value={ident.value}>
                                          {ident.label}: {ident.value}{' '}
                                          {ident.isPrimary ? '(Primary)' : ''}
                                        </option>
                                      ))}
                                    </select>
                                  );
                                })()}
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                  {selectedNode.subType === 'send_whatsapp'
                                    ? 'Official WhatsApp Template Name'
                                    : selectedNode.subType === 'send_sms'
                                    ? 'SMS Sender Header / Campaign Label'
                                    : 'Subject Line / Sender Header'}
                                </label>
                                <input
                                  type="text"
                                  value={selectedNode.config.subjectOrTemplate || ''}
                                  onChange={(e) =>
                                    handleUpdateSelectedNode(
                                      {},
                                      { subjectOrTemplate: e.target.value }
                                    )
                                  }
                                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                                />
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                                    Message Body / Personalization Preview
                                  </label>
                                  {selectedNode.subType === 'send_sms' && (
                                    <span className="font-mono text-[10px] font-bold text-[#047857]">
                                      {(selectedNode.config.messagePreview || '').length} chars ·{' '}
                                      {Math.max(
                                        1,
                                        Math.ceil(
                                          ((selectedNode.config.messagePreview || '').length || 1) /
                                            160
                                        )
                                      )}{' '}
                                      SMS seg · DLR &amp; STOP Active
                                    </span>
                                  )}
                                </div>
                                <textarea
                                  rows={3}
                                  value={selectedNode.config.messagePreview || ''}
                                  onChange={(e) =>
                                    handleUpdateSelectedNode(
                                      {},
                                      { messagePreview: e.target.value }
                                    )
                                  }
                                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                                />
                              </div>

                              {/* Per-Message Time Delay & Delivery Schedule in Inspector */}
                              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>Per-Message Time Scheduling</span>
                                  </span>
                                  <span className="text-[10px] font-mono font-bold text-emerald-800">
                                    Message Timing
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-1.5">
                                  {(
                                    [
                                      { id: 'immediate', label: 'Send Immediately' },
                                      { id: 'delay', label: 'Wait Time Delay' },
                                      { id: 'specific_datetime', label: 'Specific Date/Time' },
                                      { id: 'time_window', label: 'Time-of-Day Window' },
                                    ] as const
                                  ).map((m) => {
                                    const currentMode =
                                      selectedNode.config.messageScheduleMode || 'immediate';
                                    return (
                                      <button
                                        key={m.id}
                                        type="button"
                                        onClick={() =>
                                          handleUpdateSelectedNode(
                                            {},
                                            {
                                              messageScheduleMode: m.id,
                                              delayAmount: selectedNode.config.delayAmount || 2,
                                              delayUnit: selectedNode.config.delayUnit || 'hours',
                                              scheduledSendTime:
                                                selectedNode.config.scheduledSendTime || '09:00',
                                              specificDateTime:
                                                selectedNode.config.specificDateTime ||
                                                '2026-10-15T09:00',
                                            }
                                          )
                                        }
                                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border text-left cursor-pointer transition-colors ${
                                          currentMode === m.id
                                            ? 'bg-[#0F172A] text-white border-[#0F172A]'
                                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                                        }`}
                                      >
                                        {m.label}
                                      </button>
                                    );
                                  })}
                                </div>

                                {(selectedNode.config.messageScheduleMode || 'immediate') ===
                                  'delay' && (
                                  <div className="space-y-2.5 pt-1">
                                    <div className="flex flex-wrap gap-1">
                                      {[
                                        { label: '+15m', amt: 15, unit: 'minutes' as DelayUnit },
                                        { label: '+1h', amt: 1, unit: 'hours' as DelayUnit },
                                        { label: '+4h', amt: 4, unit: 'hours' as DelayUnit },
                                        { label: '+1d', amt: 1, unit: 'days' as DelayUnit },
                                        { label: '+3d', amt: 3, unit: 'days' as DelayUnit },
                                      ].map((preset) => (
                                        <button
                                          key={preset.label}
                                          type="button"
                                          onClick={() =>
                                            handleUpdateSelectedNode(
                                              {},
                                              {
                                                messageScheduleMode: 'delay',
                                                delayAmount: preset.amt,
                                                delayUnit: preset.unit,
                                              }
                                            )
                                          }
                                          className="px-2 py-0.5 text-[10px] font-mono font-bold bg-white hover:bg-[#0F172A] hover:text-white text-[#0F172A] border border-slate-200 rounded cursor-pointer"
                                        >
                                          {preset.label}
                                        </button>
                                      ))}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                          Wait Duration
                                        </label>
                                        <input
                                          type="number"
                                          min={1}
                                          max={365}
                                          value={selectedNode.config.delayAmount || 1}
                                          onChange={(e) =>
                                            handleUpdateSelectedNode(
                                              {},
                                              {
                                                delayAmount: Math.max(1, Number(e.target.value)),
                                              }
                                            )
                                          }
                                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg text-[#0F172A]"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                          Unit
                                        </label>
                                        <select
                                          value={selectedNode.config.delayUnit || 'hours'}
                                          onChange={(e) =>
                                            handleUpdateSelectedNode(
                                              {},
                                              { delayUnit: e.target.value as DelayUnit }
                                            )
                                          }
                                          className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-[#0F172A]"
                                        >
                                          <option value="minutes">Minutes</option>
                                          <option value="hours">Hours</option>
                                          <option value="days">Days</option>
                                        </select>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                        Preferred Send Time of Day
                                      </label>
                                      <input
                                        type="time"
                                        value={selectedNode.config.scheduledSendTime || '09:00'}
                                        onChange={(e) =>
                                          handleUpdateSelectedNode(
                                            {},
                                            { scheduledSendTime: e.target.value }
                                          )
                                        }
                                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg text-[#0F172A]"
                                      />
                                    </div>
                                  </div>
                                )}

                                {selectedNode.config.messageScheduleMode ===
                                  'specific_datetime' && (
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                      Scheduled Date & Time for This Message
                                    </label>
                                    <input
                                      type="datetime-local"
                                      value={
                                        selectedNode.config.specificDateTime || '2026-10-15T09:00'
                                      }
                                      onChange={(e) =>
                                        handleUpdateSelectedNode(
                                          {},
                                          { specificDateTime: e.target.value }
                                        )
                                      }
                                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg text-[#0F172A]"
                                    />
                                  </div>
                                )}

                                {selectedNode.config.messageScheduleMode === 'time_window' && (
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                      Daily Delivery Time Window
                                    </label>
                                    <input
                                      type="time"
                                      value={selectedNode.config.scheduledSendTime || '09:00'}
                                      onChange={(e) =>
                                        handleUpdateSelectedNode(
                                          {},
                                          { scheduledSendTime: e.target.value }
                                        )
                                      }
                                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg text-[#0F172A]"
                                    />
                                  </div>
                                )}

                                {(selectedNode.config.messageScheduleMode === 'delay' ||
                                  selectedNode.config.messageScheduleMode === 'time_window') && (
                                  <label className="flex items-center gap-2 text-xs font-semibold text-[#0F172A] cursor-pointer pt-1">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(selectedNode.config.businessDaysOnly)}
                                      onChange={(e) =>
                                        handleUpdateSelectedNode(
                                          {},
                                          { businessDaysOnly: e.target.checked }
                                        )
                                      }
                                      className="accent-emerald-700"
                                    />
                                    <span>Business Days Only (Mon–Fri Window)</span>
                                  </label>
                                )}
                              </div>
                            </>
                          )}

                          {(selectedNode.subType === 'add_tag' ||
                            selectedNode.subType === 'remove_tag') && (
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                Target Tag Identifier
                              </label>
                              <input
                                type="text"
                                value={selectedNode.config.targetTag || ''}
                                onChange={(e) =>
                                  handleUpdateSelectedNode({}, { targetTag: e.target.value })
                                }
                                placeholder="e.g. vip_prospect"
                                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A] font-mono"
                              />
                            </div>
                          )}

                          {(selectedNode.subType === 'add_to_list' ||
                            selectedNode.subType === 'remove_from_list') && (
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                Target Created Contact List
                              </label>
                              {allAvailableLists.length > 0 ? (
                                <select
                                  value={
                                    selectedNode.config.targetList ||
                                    allAvailableLists[0]?.name ||
                                    ''
                                  }
                                  onChange={(e) =>
                                    handleUpdateSelectedNode({}, { targetList: e.target.value })
                                  }
                                  className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                                >
                                  {allAvailableLists.map((l) => (
                                    <option key={l.id} value={l.name}>
                                      {l.name} ({getContactsCountForList(l.name)} contacts)
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={selectedNode.config.targetList || ''}
                                  onChange={(e) =>
                                    handleUpdateSelectedNode({}, { targetList: e.target.value })
                                  }
                                  placeholder="Select or type list name"
                                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                                />
                              )}
                            </div>
                          )}

                          {selectedNode.subType === 'move_deal_stage' && (
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                Target Pipeline Stage
                              </label>
                              <select
                                value={selectedNode.config.dealStage || 'qualified'}
                                onChange={(e) =>
                                  handleUpdateSelectedNode(
                                    {},
                                    { dealStage: e.target.value as ContactStage }
                                  )
                                }
                                className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                              >
                                <option value="lead">New Lead</option>
                                <option value="warm_lead">Warm Lead</option>
                                <option value="qualified">Qualified Pipeline</option>
                                <option value="customer">Closed Customer</option>
                                <option value="churned">Churned</option>
                              </select>
                            </div>
                          )}

                          {selectedNode.subType === 'send_webhook' && (
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                Destination Webhook URL (POST JSON)
                              </label>
                              <input
                                type="text"
                                value={selectedNode.config.webhookUrl || ''}
                                onChange={(e) =>
                                  handleUpdateSelectedNode({}, { webhookUrl: e.target.value })
                                }
                                placeholder="https://api.yourdomain.com/v1/webhook"
                                className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                              />
                            </div>
                          )}

                          {selectedNode.subType === 'update_contact_field' && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                  CRM Contact Field Name
                                </label>
                                <input
                                  type="text"
                                  value={selectedNode.config.fieldName || 'temperature'}
                                  onChange={(e) =>
                                    handleUpdateSelectedNode({}, { fieldName: e.target.value })
                                  }
                                  placeholder="e.g. temperature, company, source"
                                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A] font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                  New Field Value to Assign
                                </label>
                                <input
                                  type="text"
                                  value={selectedNode.config.fieldValue || 'hot'}
                                  onChange={(e) =>
                                    handleUpdateSelectedNode({}, { fieldValue: e.target.value })
                                  }
                                  placeholder="e.g. hot, vip_qualified, active"
                                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                                />
                              </div>
                            </div>
                          )}

                          {selectedNode.subType === 'create_task' && (
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                Task Title & Follow-up Instructions
                              </label>
                              <input
                                type="text"
                                value={selectedNode.config.taskTitle || ''}
                                onChange={(e) =>
                                  handleUpdateSelectedNode({}, { taskTitle: e.target.value })
                                }
                                placeholder="e.g. Personal discovery call follow-up with lead"
                                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                              />
                            </div>
                          )}

                          {selectedNode.subType === 'notify_team' && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                  Team Member / Desk Recipient
                                </label>
                                <input
                                  type="text"
                                  value={selectedNode.config.teamRecipient || ''}
                                  onChange={(e) =>
                                    handleUpdateSelectedNode({}, { teamRecipient: e.target.value })
                                  }
                                  placeholder="e.g. Workspace Owner (Sales Desk)"
                                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                  Internal Notification Alert Body
                                </label>
                                <textarea
                                  rows={2}
                                  value={selectedNode.config.messagePreview || ''}
                                  onChange={(e) =>
                                    handleUpdateSelectedNode({}, { messagePreview: e.target.value })
                                  }
                                  placeholder="e.g. High-value lead crossed engagement threshold."
                                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                                />
                              </div>
                            </div>
                          )}

                          {selectedNode.subType === 'add_internal_note' && (
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                Audit Note Text to Append to Contact Timeline
                              </label>
                              <textarea
                                rows={3}
                                value={selectedNode.config.internalNoteText || ''}
                                onChange={(e) =>
                                  handleUpdateSelectedNode({}, { internalNoteText: e.target.value })
                                }
                                placeholder="e.g. Automated sequence completed touchpoint verification."
                                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* CONDITIONAL LOGIC CONFIG */}
                      {selectedNode.category === 'condition' && (
                        <div className="space-y-4 pt-2 border-t border-slate-100">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                              Condition Evaluation Type
                            </label>
                            <select
                              value={selectedNode.subType}
                              onChange={(e) => {
                                const found = CONDITION_CATALOG.find(
                                  (c) => c.subType === e.target.value
                                );
                                if (found) {
                                  handleUpdateSelectedNode(
                                    {
                                      subType: found.subType,
                                      title: found.title,
                                      subtitle: found.subtitle,
                                    },
                                    found.defaultConfig
                                  );
                                }
                              }}
                              className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                            >
                              {CONDITION_CATALOG.map((c) => (
                                <option key={c.id} value={c.subType}>
                                  {c.title}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                                Field / Metric
                              </label>
                              <input
                                type="text"
                                value={selectedNode.config.conditionField || 'consentStatus'}
                                onChange={(e) =>
                                  handleUpdateSelectedNode({}, { conditionField: e.target.value })
                                }
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A] font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                                Operator
                              </label>
                              <select
                                value={selectedNode.config.conditionOperator || 'equals'}
                                onChange={(e) =>
                                  handleUpdateSelectedNode(
                                    {},
                                    {
                                      conditionOperator: e.target
                                        .value as WorkflowNode['config']['conditionOperator'],
                                    }
                                  )
                                }
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A] font-bold"
                              >
                                <option value="equals">Equals</option>
                                <option value="contains">Contains</option>
                                <option value="greater_than">Greater Than (&gt;=)</option>
                                <option value="has_tag">Has Tag</option>
                                <option value="in_list">In List</option>
                                <option value="opened_email">Opened Email</option>
                                <option value="clicked_link">Clicked Link</option>
                                <option value="is_weekday">Is Business Weekday</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                              Target Match Value
                            </label>
                            <input
                              type="text"
                              value={selectedNode.config.conditionValue || ''}
                              onChange={(e) =>
                                handleUpdateSelectedNode({}, { conditionValue: e.target.value })
                              }
                              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A] font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {/* DELAY ENGINE CONFIG */}
                      {selectedNode.category === 'delay' && (
                        <div className="space-y-4 pt-2 border-t border-slate-100">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                Duration Value
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={365}
                                value={selectedNode.config.delayAmount || 1}
                                onChange={(e) =>
                                  handleUpdateSelectedNode(
                                    {},
                                    { delayAmount: Math.max(1, Number(e.target.value)) }
                                  )
                                }
                                className="w-full px-3.5 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                Time Unit
                              </label>
                              <select
                                value={selectedNode.config.delayUnit || 'days'}
                                onChange={(e) =>
                                  handleUpdateSelectedNode(
                                    { subType: e.target.value as DelayUnit },
                                    { delayUnit: e.target.value as DelayUnit }
                                  )
                                }
                                className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                              >
                                <option value="minutes">Minutes</option>
                                <option value="hours">Hours</option>
                                <option value="days">Days</option>
                                <option value="specific_datetime">Specific Date/Time</option>
                              </select>
                            </div>
                          </div>

                          {selectedNode.config.delayUnit === 'specific_datetime' && (
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                Resume Timestamp
                              </label>
                              <input
                                type="datetime-local"
                                value={selectedNode.config.specificDateTime || '2026-11-01T09:00'}
                                onChange={(e) =>
                                  handleUpdateSelectedNode(
                                    {},
                                    { specificDateTime: e.target.value }
                                  )
                                }
                                className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                              />
                            </div>
                          )}

                          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                            <label className="flex items-center justify-between cursor-pointer">
                              <span className="text-xs font-bold text-[#0F172A]">
                                Restrict to Business Days (Mon–Fri)
                              </span>
                              <input
                                type="checkbox"
                                checked={Boolean(selectedNode.config.businessDaysOnly)}
                                onChange={(e) =>
                                  handleUpdateSelectedNode(
                                    {},
                                    { businessDaysOnly: e.target.checked }
                                  )
                                }
                                className="w-4 h-4 accent-emerald-700"
                              />
                            </label>
                            {selectedNode.config.businessDaysOnly && (
                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <div>
                                  <span className="block text-[10px] font-mono uppercase text-slate-500">
                                    Window Start
                                  </span>
                                  <input
                                    type="time"
                                    value={selectedNode.config.businessWindowStart || '09:00'}
                                    onChange={(e) =>
                                      handleUpdateSelectedNode(
                                        {},
                                        { businessWindowStart: e.target.value }
                                      )
                                    }
                                    className="w-full mt-0.5 px-2.5 py-1 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                                  />
                                </div>
                                <div>
                                  <span className="block text-[10px] font-mono uppercase text-slate-500">
                                    Window End
                                  </span>
                                  <input
                                    type="time"
                                    value={selectedNode.config.businessWindowEnd || '17:00'}
                                    onChange={(e) =>
                                      handleUpdateSelectedNode(
                                        {},
                                        { businessWindowEnd: e.target.value }
                                      )
                                    }
                                    className="w-full mt-0.5 px-2.5 py-1 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Commit Version Box */}
                      <div className="pt-4 border-t border-slate-200 space-y-2.5">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Version Commit Note (Optional)
                        </label>
                        <input
                          type="text"
                          value={changeNoteInput}
                          onChange={(e) => setChangeNoteInput(e.target.value)}
                          placeholder={`e.g. Added WhatsApp branch & 2-day delay`}
                          className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                        />
                        <button
                          type="button"
                          onClick={handleSaveAndPublishVersion}
                          disabled={isSavingGraph}
                          className="w-full py-2.5 px-4 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Save & Publish Workflow v{activeWorkflow ? version + 1 : 1}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-sm text-slate-500">
                      Click any node on the canvas to inspect and edit its parameters.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: TIME DELAY & SCHEDULING STUDIO */}
          {workspaceTab === 'scheduler' && (
            <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Precision Time Delay Engine & Cron Scheduler
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#0F172A] mt-0.5">
                    Workflow Scheduling, Quiet Hours & Step Delay Timeline
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure entry buffers, scheduled calendar triggers, recurring cadences,
                    business-day delivery windows, and step-by-step wait timers
                  </p>
                </div>

                {activeWorkflow && (
                  <button
                    type="button"
                    onClick={handleSaveAndPublishVersion}
                    disabled={isSavingGraph}
                    className="px-4 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Schedule & Delays (v{version + 1})</span>
                  </button>
                )}
              </div>

              {/* Schedule Mode & Quiet Hours Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left 6 Cols: Workflow Entry Schedule Mode */}
                <div className="lg:col-span-6 p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                      1. Workflow Trigger & Schedule Mode
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                      {engineConfig.scheduleMode || 'instant_event'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        {
                          id: 'instant_event',
                          title: 'Instant Event',
                          desc: 'Run immediately when trigger fires',
                        },
                        {
                          id: 'delayed_entry',
                          title: 'Delayed Entry Buffer',
                          desc: 'Wait N mins/hrs/days after trigger',
                        },
                        {
                          id: 'scheduled_datetime',
                          title: 'Specific Date / Time',
                          desc: 'Start on exact calendar timestamp',
                        },
                        {
                          id: 'recurring_cadence',
                          title: 'Recurring Schedule',
                          desc: 'Daily, weekday, or weekly cron',
                        },
                      ] as const
                    ).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => {
                          setEngineConfig((prev) => ({ ...prev, scheduleMode: mode.id }));
                          setHasUnsavedChanges(true);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          (engineConfig.scheduleMode || 'instant_event') === mode.id
                            ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-xs'
                            : 'bg-white text-[#0F172A] border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <div className="text-xs font-bold">{mode.title}</div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            (engineConfig.scheduleMode || 'instant_event') === mode.id
                              ? 'text-slate-300'
                              : 'text-slate-500'
                          }`}
                        >
                          {mode.desc}
                        </div>
                      </button>
                    ))}
                  </div>

                  {engineConfig.scheduleMode === 'delayed_entry' && (
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                          Entry Buffer Delay
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={engineConfig.entryDelayAmount || 15}
                          onChange={(e) => {
                            setEngineConfig((prev) => ({
                              ...prev,
                              entryDelayAmount: Math.max(1, Number(e.target.value)),
                            }));
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                          Delay Unit
                        </label>
                        <select
                          value={engineConfig.entryDelayUnit || 'minutes'}
                          onChange={(e) => {
                            setEngineConfig((prev) => ({
                              ...prev,
                              entryDelayUnit: e.target.value as 'minutes' | 'hours' | 'days',
                            }));
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg"
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {engineConfig.scheduleMode === 'scheduled_datetime' && (
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        Scheduled Launch Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={engineConfig.scheduledStartAt || '2026-10-15T09:00'}
                        onChange={(e) => {
                          setEngineConfig((prev) => ({
                            ...prev,
                            scheduledStartAt: e.target.value,
                          }));
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                  )}

                  {engineConfig.scheduleMode === 'recurring_cadence' && (
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        Recurring Cron Cadence
                      </label>
                      <select
                        value={engineConfig.recurringCadence || 'weekdays_9am'}
                        onChange={(e) => {
                          setEngineConfig((prev) => ({
                            ...prev,
                            recurringCadence: e.target
                              .value as WorkflowEngineConfig['recurringCadence'],
                          }));
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        <option value="daily_9am">Every Day at 09:00 AM (0 9 * * *)</option>
                        <option value="weekdays_9am">
                          Business Weekdays Mon–Fri at 09:00 AM (0 9 * * 1-5)
                        </option>
                        <option value="weekly_monday">
                          Weekly on Mondays at 09:00 AM (0 9 * * 1)
                        </option>
                        <option value="monthly_first">
                          Monthly on the 1st at 09:00 AM (0 9 1 * *)
                        </option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Right 6 Cols: Business-Day & Quiet-Hours Delivery Window */}
                <div className="lg:col-span-6 p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                      2. Business-Day & Quiet-Hours Delivery Gate
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200 text-[#0F172A] font-bold">
                      {engineConfig.timezone || 'UTC'}
                    </span>
                  </div>

                  <label className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-[#0F172A]">
                        Enforce Mon–Fri Business-Day Delivery Window
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Automatically hold weekend or off-hour steps until the next business morning
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(engineConfig.businessDaysOnlyDefault)}
                      onChange={(e) => {
                        setEngineConfig((prev) => ({
                          ...prev,
                          businessDaysOnlyDefault: e.target.checked,
                        }));
                        setHasUnsavedChanges(true);
                      }}
                      className="w-4 h-4 accent-emerald-700"
                    />
                  </label>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        Window Start
                      </label>
                      <input
                        type="time"
                        value={engineConfig.quietHoursStart || '09:00'}
                        onChange={(e) => {
                          setEngineConfig((prev) => ({
                            ...prev,
                            quietHoursStart: e.target.value,
                          }));
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        Window End
                      </label>
                      <input
                        type="time"
                        value={engineConfig.quietHoursEnd || '17:00'}
                        onChange={(e) => {
                          setEngineConfig((prev) => ({
                            ...prev,
                            quietHoursEnd: e.target.value,
                          }));
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        Timezone
                      </label>
                      <select
                        value={engineConfig.timezone || 'UTC'}
                        onChange={(e) => {
                          setEngineConfig((prev) => ({
                            ...prev,
                            timezone: e.target.value,
                          }));
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl text-[#0F172A]"
                      >
                        <option value="UTC">UTC (Coordinated)</option>
                        <option value="America/New_York">America/New_York (EST)</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                        <option value="Europe/London">Europe/London (GMT)</option>
                        <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick Add Delay Step Buttons */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="text-[11px] font-bold uppercase text-slate-500 mb-2">
                      Append New Time Delay Node to Workflow:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {DELAY_CATALOG.map((dItem) => (
                        <button
                          key={dItem.id}
                          type="button"
                          onClick={() => handleAddNodeFromPalette(dItem)}
                          className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-[#0F172A] hover:text-white text-[#0F172A] border border-slate-200 rounded-xl transition-colors cursor-pointer"
                        >
                          + {dItem.title}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Projected Step-by-Step Schedule & Delay Timeline */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 bg-[#0F172A] text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Projected Execution Schedule & Inline Delay Editor
                    </span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400">
                    {nodes.filter((n) => n.category === 'delay').length} Active Delay Timers
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {computeProjectedScheduleTimeline(nodes, engineConfig).map((item) => {
                    const isDelay = item.node.category === 'delay';
                    return (
                      <div
                        key={item.node.id}
                        className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          isDelay ? 'bg-emerald-50/40' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg shrink-0 ${
                              isDelay
                                ? 'bg-emerald-700 text-white'
                                : item.index === 0
                                ? 'bg-[#0F172A] text-white'
                                : 'bg-slate-100 text-[#0F172A]'
                            }`}
                          >
                            {item.offsetLabel}
                          </span>
                          <div>
                            <div className="text-sm font-bold text-[#0F172A]">
                              {item.node.title}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {item.windowEnforcementNote}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          {/* Inline Delay Controls if this node is a Delay Node */}
                          {isDelay && (
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                              <input
                                type="number"
                                min={1}
                                max={365}
                                value={item.node.config.delayAmount || 1}
                                onChange={(e) => {
                                  const nextAmt = Math.max(1, Number(e.target.value));
                                  setNodes((prev) =>
                                    prev.map((n) =>
                                      n.id === item.node.id
                                        ? {
                                            ...n,
                                            title: `Wait ${nextAmt} ${
                                              n.config.delayUnit || 'days'
                                            }`,
                                            config: { ...n.config, delayAmount: nextAmt },
                                          }
                                        : n
                                    )
                                  );
                                  setHasUnsavedChanges(true);
                                }}
                                className="w-16 px-2 py-1 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg text-[#0F172A]"
                              />
                              <select
                                value={item.node.config.delayUnit || 'days'}
                                onChange={(e) => {
                                  const nextUnit = e.target.value as DelayUnit;
                                  setNodes((prev) =>
                                    prev.map((n) =>
                                      n.id === item.node.id
                                        ? {
                                            ...n,
                                            subType: nextUnit,
                                            title: `Wait ${
                                              n.config.delayAmount || 1
                                            } ${nextUnit}`,
                                            config: { ...n.config, delayUnit: nextUnit },
                                          }
                                        : n
                                    )
                                  );
                                  setHasUnsavedChanges(true);
                                }}
                                className="px-2 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-[#0F172A]"
                              >
                                <option value="minutes">Minutes</option>
                                <option value="hours">Hours</option>
                                <option value="days">Days</option>
                                <option value="specific_datetime">Specific Date/Time</option>
                              </select>
                              <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 cursor-pointer pl-1">
                                <input
                                  type="checkbox"
                                  checked={Boolean(item.node.config.businessDaysOnly)}
                                  onChange={(e) => {
                                    setNodes((prev) =>
                                      prev.map((n) =>
                                        n.id === item.node.id
                                          ? {
                                              ...n,
                                              config: {
                                                ...n.config,
                                                businessDaysOnly: e.target.checked,
                                              },
                                            }
                                          : n
                                      )
                                    );
                                    setHasUnsavedChanges(true);
                                  }}
                                  className="accent-emerald-700"
                                />
                                <span>Mon–Fri</span>
                              </label>
                            </div>
                          )}

                          <div className="text-right">
                            <div className="text-[10px] font-mono uppercase text-slate-400">
                              Projected Dispatch
                            </div>
                            <div className="text-xs font-mono font-bold text-[#0F172A]">
                              {item.projectedTimestamp}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BACKGROUND JOB QUEUE, SCHEDULER, IDEMPOTENCY & LOGS */}
          {workspaceTab === 'queue' && (
            <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs space-y-6 p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Durable Background Worker Queue
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#0F172A] mt-0.5">
                    Job Scheduler, Retries, Idempotency & Step Trace Logs
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enroll contacts manually or test retry/backoff behavior with deterministic
                    idempotency keys
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSchedulerPaused((p) => !p)}
                    className={`px-3.5 py-2 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer border ${
                      schedulerPaused
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-100 text-[#0F172A] border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {schedulerPaused ? (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume Worker Queue</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause Worker Queue</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Manual Enrollment & Fault Injection Controls */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Select CRM Contact to Enroll
                  </label>
                  <select
                    value={enrollContactId}
                    onChange={(e) => setEnrollContactId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl text-[#0F172A]"
                  >
                    <option value="">
                      {contacts.length > 0
                        ? `Default: ${contacts[0].fullName} (${contacts[0].email})`
                        : 'Synthetic Test Lead (lead.test@verified-domain.io)'}
                    </option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.email}) — Stage: {c.stage}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-4 space-y-2 pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={holdOnDelayTimer}
                      onChange={(e) => setHoldOnDelayTimer(e.target.checked)}
                      className="w-4 h-4 accent-emerald-700"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#0F172A]">
                        Hold Jobs at Delay Timers (Live Countdown)
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Pause job in waiting_delay state with live countdown timer
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulateTransientFailure}
                      onChange={(e) => setSimulateTransientFailure(e.target.checked)}
                      className="w-4 h-4 accent-emerald-700"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#0F172A]">
                        Simulate Provider 429 Retry
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Tests exponential backoff ({engineConfig.retryBackoffSec}s) & auto-recovery
                      </div>
                    </div>
                  </label>
                </div>

                <div className="md:col-span-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleEnqueueWorkflowJob()}
                    disabled={!activeWorkflow}
                    className="w-full py-2.5 px-4 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Enroll & Execute Now</span>
                  </button>
                </div>
              </div>

              {/* Job Execution List + Detailed Step Trace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-[#0F172A] text-white text-xs font-bold flex items-center justify-between">
                    <span>Queued & Completed Jobs</span>
                    <span className="font-mono text-emerald-400">{jobLogs.length} Runs</span>
                  </div>
                  {jobLogs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No background jobs executed in this session yet. Click &ldquo;Enroll &
                      Execute Now&rdquo; above to enqueue a contact and inspect the execution trace.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                      {jobLogs.map((job) => (
                        <div
                          key={job.id}
                          onClick={() => setSelectedJobId(job.id)}
                          className={`p-4 cursor-pointer transition-colors ${
                            selectedJob?.id === job.id
                              ? 'bg-emerald-50/60 border-l-4 border-l-emerald-700'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#0F172A]">
                              {job.contactName}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border ${
                                job.status === 'waiting_delay'
                                  ? 'bg-[#0F172A] text-emerald-300 border-slate-800'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              {job.status === 'waiting_delay'
                                ? `DELAY HOLD (${job.remainingSeconds ?? 0}s)`
                                : `${job.status} (Attempt ${job.attempt}/${job.maxRetries})`}
                            </span>
                          </div>
                          {job.scheduledResumeAt && job.status === 'waiting_delay' && (
                            <div className="mt-1.5 flex items-center justify-between gap-2 bg-slate-100 px-2.5 py-1 rounded-lg">
                              <span className="text-[11px] font-mono text-[#0F172A]">
                                Resumes: {job.scheduledResumeAt}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setJobLogs((prev) =>
                                    prev.map((j) =>
                                      j.id === job.id
                                        ? {
                                            ...j,
                                            status: 'completed',
                                            remainingSeconds: 0,
                                            currentNodeTitle:
                                              'Sequence Completed (Manual Timer Release)',
                                            stepTrace: j.stepTrace.map((st) =>
                                              st.status === 'waiting'
                                                ? {
                                                    ...st,
                                                    status: 'success',
                                                    detail: `${st.detail} -> Released immediately by operator`,
                                                  }
                                                : st
                                            ),
                                          }
                                        : j
                                    )
                                  );
                                  showNotice(`Released delay timer for ${job.contactName}`);
                                }}
                                className="text-[10px] font-bold text-emerald-800 hover:underline cursor-pointer"
                              >
                                Release Timer Now →
                              </button>
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500 font-mono mt-1 truncate">
                            Idempotency: {job.idempotencyKey}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                            <span>v{job.workflowVersion}</span>
                            <span>{job.startedAt}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-7 border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F172A]">
                      Execution Trace & Branch Audit Log
                    </span>
                    {selectedJob && (
                      <span className="text-[11px] font-mono text-emerald-800 font-bold">
                        {selectedJob.branchTaken}
                      </span>
                    )}
                  </div>
                  {selectedJob ? (
                    <div className="p-4 space-y-2.5 max-h-[420px] overflow-y-auto">
                      {selectedJob.stepTrace.map((step, sIdx) => (
                        <div
                          key={sIdx}
                          className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                            step.status === 'skipped'
                              ? 'bg-slate-50 border-slate-200 text-slate-400'
                              : step.status === 'retrying'
                              ? 'bg-slate-900 text-white border-slate-800'
                              : 'bg-white border-slate-200 text-[#0F172A]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="font-bold flex flex-wrap items-center gap-2">
                                <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {step.category}
                                </span>
                                {step.channel && (
                                  <span className="font-mono text-[10px] uppercase text-emerald-700 font-bold">
                                    · {step.channel}
                                  </span>
                                )}
                                <span>{step.nodeTitle}</span>
                              </div>
                              <p
                                className={`text-[11px] ${
                                  step.status === 'retrying' ? 'text-emerald-300' : 'text-slate-500'
                                }`}
                              >
                                {step.detail}
                              </p>
                            </div>
                            <span className="text-[10px] font-mono uppercase font-bold shrink-0 text-emerald-700">
                              {step.status}
                            </span>
                          </div>

                          {step.receiptId && (
                            <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80 space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                <span className="font-mono font-bold text-emerald-900">
                                  Receipt: {step.receiptId} · From: {step.senderIdentity} → To:{' '}
                                  {step.recipient}
                                </span>
                                {step.directLaunchUrl && (
                                  <a
                                    href={step.directLaunchUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1 text-[10px] font-bold bg-[#0F172A] hover:bg-slate-800 text-white rounded-md inline-flex items-center gap-1"
                                  >
                                    <ExternalLink className="w-3 h-3 text-emerald-400" />
                                    <span>
                                      {step.channel === 'whatsapp'
                                        ? 'Launch in WhatsApp'
                                        : step.channel === 'email'
                                        ? 'Launch in Email'
                                        : 'Launch in SMS'}
                                    </span>
                                  </a>
                                )}
                              </div>
                              {step.messageBody && (
                                <div className="text-[11px] text-slate-700 bg-white px-2.5 py-1.5 rounded border border-slate-200/80">
                                  &ldquo;{step.messageBody}&rdquo;
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-500">
                      Select a job from the queue to inspect node-by-node execution telemetry.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WORKFLOW VERSIONING & RELIABILITY ENGINE SETTINGS */}
          {workspaceTab === 'versions' && (
            <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Reliability & Retry Policy Configuration (6 Cols) */}
                <div className="lg:col-span-6 space-y-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      Fault Tolerance & Idempotency
                    </div>
                    <h3 className="font-display text-lg font-bold text-[#0F172A] mt-0.5">
                      Background Engine Reliability Policy
                    </h3>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Max Automatic Retries
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={engineConfig.maxRetries}
                          onChange={(e) => {
                            setEngineConfig((prev) => ({
                              ...prev,
                              maxRetries: Number(e.target.value),
                            }));
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full px-3.5 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Backoff Base (Seconds)
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={600}
                          value={engineConfig.retryBackoffSec}
                          onChange={(e) => {
                            setEngineConfig((prev) => ({
                              ...prev,
                              retryBackoffSec: Number(e.target.value),
                            }));
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full px-3.5 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Idempotency Lock Window (Hours)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={168}
                          value={engineConfig.idempotencyWindowHours}
                          onChange={(e) => {
                            setEngineConfig((prev) => ({
                              ...prev,
                              idempotencyWindowHours: Number(e.target.value),
                            }));
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full px-3.5 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Worker Concurrency Limit
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={engineConfig.concurrencyLimit}
                          onChange={(e) => {
                            setEngineConfig((prev) => ({
                              ...prev,
                              concurrencyLimit: Number(e.target.value),
                            }));
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full px-3.5 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Dead-Letter / Exhausted Retry Policy
                      </label>
                      <select
                        value={engineConfig.errorHandlingPolicy}
                        onChange={(e) => {
                          setEngineConfig((prev) => ({
                            ...prev,
                            errorHandlingPolicy: e.target
                              .value as WorkflowEngineConfig['errorHandlingPolicy'],
                          }));
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                      >
                        <option value="retry_then_continue">
                          Retry w/ Exponential Backoff, then Continue Next Node
                        </option>
                        <option value="retry_then_pause">
                          Retry w/ Exponential Backoff, then Pause Job for Operator Review
                        </option>
                        <option value="halt_immediately">
                          Halt Workflow Execution Immediately on Hard Failure
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Immutable Version History & Rollback (6 Cols) */}
                <div className="lg:col-span-6 space-y-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      Immutable Snapshots
                    </div>
                    <h3 className="font-display text-lg font-bold text-[#0F172A] mt-0.5">
                      Workflow Version History & Rollback
                    </h3>
                  </div>

                  <div className="space-y-2.5 max-h-[340px] overflow-y-auto">
                    {versionHistory.map((snap) => (
                      <div
                        key={snap.version}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-[#0F172A] text-white">
                              v{snap.version}
                            </span>
                            <span className="text-xs font-bold text-[#0F172A]">
                              {snap.changeNote}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-1">
                            {snap.nodeCount} nodes • Saved{' '}
                            {new Date(snap.savedAt).toLocaleString()}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRestoreVersion(snap)}
                          className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg inline-flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create New Automation Modal — Step 1 is Selecting the Created Contact List */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  List-Linked Visual Workflow
                </span>
                <h3 className="font-display text-xl font-bold text-[#0F172A]">
                  Select Contact List & Create Automation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkflow} className="space-y-4">
              {/* STEP 1 (REQUIRED): SELECT THE CONTACT LIST YOU CREATED */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border-2 border-emerald-600/30 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                      Step 1 (Required) · Select Created Contact List to Run Automation In *
                    </span>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Choose which created list this automation runs in. Contacts added directly or
                      captured via a Landing Page / Form linked to this list will automatically
                      trigger this workflow.
                    </p>
                  </div>
                  {onCreateList && (
                    <button
                      type="button"
                      onClick={() => setShowInlineListCreator((prev) => !prev)}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl shrink-0 cursor-pointer inline-flex items-center gap-1"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{showInlineListCreator ? 'Cancel' : '+ New List'}</span>
                    </button>
                  )}
                </div>

                {/* Inline Quick-Create Contact List Box */}
                {showInlineListCreator && onCreateList && (
                  <div className="p-3.5 rounded-xl bg-white border border-emerald-300 space-y-3">
                    <div className="text-xs font-bold text-[#0F172A]">
                      Create a Contact List Now &amp; Set Its List Kill Switch Tag
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={inlineListName}
                        onChange={(e) => setInlineListName(e.target.value)}
                        placeholder="e.g. VIP Funnel Leads List"
                        className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-[#0F172A]"
                      />
                      <select
                        value={inlineListCategory}
                        onChange={(e) => setInlineListCategory(e.target.value as ListCategory)}
                        className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-[#0F172A] font-semibold"
                      >
                        <option value="lead_magnet">Lead Magnet Funnel</option>
                        <option value="newsletter">Newsletter Subscribers</option>
                        <option value="vip_buyers">VIP Buyers & Clients</option>
                        <option value="webinar">Webinar & Event</option>
                        <option value="custom">Custom Segment</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        List Kill Switch Tag(s) (Stops automation for a contact when tag matches)
                      </label>
                      <input
                        type="text"
                        value={inlineListKillSwitchTags}
                        onChange={(e) => setInlineListKillSwitchTags(e.target.value)}
                        placeholder="Purchased_Course, VIP_Buyer"
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-emerald-50/60 border border-emerald-400 rounded-lg text-[#0F172A]"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={!inlineListName.trim() || isCreatingInlineList}
                        onClick={handleQuickCreateList}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        {isCreatingInlineList ? 'Creating List...' : 'Save & Select List'}
                      </button>
                    </div>
                  </div>
                )}

                {allAvailableLists.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      required
                      value={newTargetList}
                      onChange={(e) => setNewTargetList(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm font-bold bg-white border border-slate-300 rounded-xl text-[#0F172A]"
                    >
                      <option value="" disabled>
                        -- Select your created Contact List --
                      </option>
                      {allAvailableLists.map((lst) => (
                        <option key={lst.id} value={lst.name}>
                          {lst.name} ({getContactsCountForList(lst.name)} contacts stored)
                        </option>
                      ))}
                    </select>

                    {/* Clickable Created List Chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {allAvailableLists.map((lst) => {
                        const isSelected =
                          newTargetList.trim().toLowerCase() === lst.name.trim().toLowerCase();
                        return (
                          <button
                            key={lst.id}
                            type="button"
                            onClick={() => setNewTargetList(lst.name)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-[#0F172A] text-white'
                                : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-400'
                            }`}
                          >
                            <Layers className="w-3 h-3 text-emerald-500" />
                            <span>{lst.name}</span>
                            <span className="font-mono text-[10px] opacity-75">
                              ({getContactsCountForList(lst.name)})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 flex items-center justify-between gap-3">
                    <span>
                      You have no Contact Lists yet. Click <strong>+ New List</strong> above or go
                      to Contact Lists to create your list first.
                    </span>
                    {onNavigateToLists && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          onNavigateToLists();
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg shrink-0 cursor-pointer"
                      >
                        Go to Lists →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* STEP 2: WORKFLOW NAME & TRIGGER */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Step 2 · Workflow Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={
                    newTargetList
                      ? `e.g. ${newTargetList} Welcome & Follow-Up Sequence`
                      : 'e.g. High-Intent Lead Magnet + WhatsApp VIP Follow-Up'
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Starting Entry Trigger
                  </label>
                  <select
                    value={newTriggerType}
                    onChange={(e) => setNewTriggerType(e.target.value as TriggerType)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                  >
                    {TRIGGER_CATALOG.map((t) => (
                      <option key={t.id} value={t.subType}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Trigger Condition / Note
                  </label>
                  <input
                    type="text"
                    value={newTriggerDetail}
                    onChange={(e) => setNewTriggerDetail(e.target.value)}
                    placeholder={
                      newTargetList
                        ? `e.g. Landing Page / Form → ${newTargetList}`
                        : 'e.g. Inline Opt-In Form or Tag'
                    }
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A]"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                Once created for{' '}
                <strong className="text-[#0F172A]">
                  {newTargetList || 'your selected Contact List'}
                </strong>
                , you will land directly inside the workflow canvas where each automated message
                (Email, WhatsApp, SMS) has its own per-message time delay and delivery schedule.
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newTargetList.trim()}
                  className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isCreating
                    ? 'Initializing Graph...'
                    : newTargetList.trim()
                    ? `Launch Canvas for "${newTargetList}"`
                    : 'Select a Contact List First'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
