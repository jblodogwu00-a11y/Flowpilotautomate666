import {
  TriggerType,
  ActionNodeType,
  ConditionNodeType,
  DelayUnit,
  WorkflowNode,
  WorkflowNodeCategory,
  WorkflowEngineConfig,
  SerializedFlowGraph,
  Automation,
  AudienceList,
  Contact,
  BranchPathType,
  sanitizeString,
  sanitizeStringArray,
} from '../types';

export interface PaletteItemDefinition {
  id: string;
  category: WorkflowNodeCategory;
  subType: TriggerType | ActionNodeType | ConditionNodeType | DelayUnit;
  title: string;
  subtitle: string;
  badge: string;
  defaultConfig: WorkflowNode['config'];
}

export const TRIGGER_CATALOG: PaletteItemDefinition[] = [
  {
    id: 'trig_form_submission',
    category: 'trigger',
    subType: 'form_submission',
    title: 'Form Submitted',
    subtitle: 'Fires when a lead submits an inline, popup, or funnel form',
    badge: 'Capture',
    defaultConfig: { channel: 'crm', targetList: 'Master Subscribers' },
  },
  {
    id: 'trig_contact_added',
    category: 'trigger',
    subType: 'contact_added',
    title: 'Contact Added',
    subtitle: 'Fires when a new contact record is created in the CRM',
    badge: 'CRM',
    defaultConfig: { channel: 'crm' },
  },
  {
    id: 'trig_tag_added',
    category: 'trigger',
    subType: 'tag_added',
    title: 'Tag Added',
    subtitle: 'Fires when a specific tag is applied to a contact profile',
    badge: 'Segment',
    defaultConfig: { channel: 'crm', targetTag: 'vip_prospect' },
  },
  {
    id: 'trig_tag_removed',
    category: 'trigger',
    subType: 'tag_removed',
    title: 'Tag Removed',
    subtitle: 'Fires when a specific tag is removed from a contact profile',
    badge: 'Segment',
    defaultConfig: { channel: 'crm', targetTag: 'trial_active' },
  },
  {
    id: 'trig_list_joined',
    category: 'trigger',
    subType: 'list_joined',
    title: 'Added to List (List Membership Changed)',
    subtitle: 'Fires when a contact joins a designated audience list',
    badge: 'List',
    defaultConfig: { channel: 'crm', targetList: 'VIP Buyers' },
  },
  {
    id: 'trig_list_removed',
    category: 'trigger',
    subType: 'list_removed',
    title: 'Removed from List (List Membership Changed)',
    subtitle: 'Fires when a contact exits or is removed from an audience list',
    badge: 'List',
    defaultConfig: { channel: 'crm', targetList: 'Newsletter' },
  },
  {
    id: 'trig_link_clicked',
    category: 'trigger',
    subType: 'link_clicked',
    title: 'Link Clicked',
    subtitle: 'Fires when a tracked CTA link is clicked in Email, SMS, or WhatsApp',
    badge: 'Engagement',
    defaultConfig: { channel: 'email', webhookUrl: 'https://yourbrand.com/checkout' },
  },
  {
    id: 'trig_email_opened',
    category: 'trigger',
    subType: 'email_opened',
    title: 'Email Opened / Clicked',
    subtitle: 'Fires when provider tracking detects an email open or click event',
    badge: 'Email',
    defaultConfig: { channel: 'email', subjectOrTemplate: 'Welcome Onboarding Sequence #1' },
  },
  {
    id: 'trig_specific_datetime',
    category: 'trigger',
    subType: 'specific_datetime',
    title: 'Specific Date / Time',
    subtitle: 'Fires on a scheduled calendar date, anniversary, or cohort window',
    badge: 'Schedule',
    defaultConfig: {
      channel: 'crm',
      specificDateTime: '2026-11-01T09:00',
      businessDaysOnly: true,
    },
  },
  {
    id: 'trig_field_updated',
    category: 'trigger',
    subType: 'field_updated',
    title: 'Contact Field Updated',
    subtitle: 'Fires when a CRM field (e.g. stage, LTV, temperature) changes value',
    badge: 'CRM',
    defaultConfig: { channel: 'crm', fieldName: 'temperature', fieldValue: 'hot' },
  },
  {
    id: 'trig_webhook_received',
    category: 'trigger',
    subType: 'webhook_received',
    title: 'Inbound Webhook Received',
    subtitle: 'Fires when an external checkout, calendar, or app posts JSON payload',
    badge: 'API',
    defaultConfig: {
      channel: 'webhook',
      webhookUrl: 'https://api.ompcrm.io/v1/hooks/inbound',
      webhookMethod: 'POST',
    },
  },
  {
    id: 'trig_manual_enrollment',
    category: 'trigger',
    subType: 'manual_enrollment',
    title: 'Manual Workflow Enrollment',
    subtitle: 'Enrolled directly by an operator from the CRM drawer or bulk action',
    badge: 'Manual',
    defaultConfig: { channel: 'crm' },
  },
];

export const ACTION_CATALOG: PaletteItemDefinition[] = [
  {
    id: 'act_send_email',
    category: 'action',
    subType: 'send_email',
    title: 'Send Email',
    subtitle: 'Dispatch personalized transactional or marketing email via SMTP/API',
    badge: 'Email',
    defaultConfig: {
      channel: 'email',
      subjectOrTemplate: 'Welcome to our inner circle — next steps inside',
      messagePreview: 'Hi {{first_name}}, thank you for requesting access...',
      messageScheduleMode: 'immediate',
      delayAmount: 15,
      delayUnit: 'minutes',
      scheduledSendTime: '09:00',
      specificDateTime: '2026-10-15T09:00',
      businessDaysOnly: true,
    },
  },
  {
    id: 'act_send_whatsapp',
    category: 'action',
    subType: 'send_whatsapp',
    title: 'Send WhatsApp (Official Business API)',
    subtitle: 'Deliver approved Meta Cloud API template message with interactive CTA',
    badge: 'WhatsApp',
    defaultConfig: {
      channel: 'whatsapp',
      subjectOrTemplate: 'wa_approved_onboarding_v2',
      messagePreview: 'Hello {{first_name}}, your VIP onboarding guide is ready on WhatsApp.',
      messageScheduleMode: 'delay',
      delayAmount: 2,
      delayUnit: 'hours',
      scheduledSendTime: '10:00',
      specificDateTime: '2026-10-15T10:00',
      businessDaysOnly: true,
    },
  },
  {
    id: 'act_send_sms',
    category: 'action',
    subType: 'send_sms',
    title: 'Send SMS via Connected Provider',
    subtitle: 'Send concise high-priority SMS alert through registered Sender ID',
    badge: 'SMS',
    defaultConfig: {
      channel: 'sms',
      subjectOrTemplate: 'SMS Reminder Alert',
      messagePreview: 'Hi {{first_name}}, quick reminder your consultation starts in 1 hour.',
      messageScheduleMode: 'delay',
      delayAmount: 1,
      delayUnit: 'days',
      scheduledSendTime: '09:30',
      specificDateTime: '2026-10-16T09:30',
      businessDaysOnly: true,
    },
  },
  {
    id: 'act_add_tag',
    category: 'action',
    subType: 'add_tag',
    title: 'Add Tag',
    subtitle: 'Attach segmentation tag to contact profile in real time',
    badge: 'CRM',
    defaultConfig: { channel: 'crm', targetTag: 'engaged_lead' },
  },
  {
    id: 'act_remove_tag',
    category: 'action',
    subType: 'remove_tag',
    title: 'Remove Tag',
    subtitle: 'Strip an existing tag from contact profile',
    badge: 'CRM',
    defaultConfig: { channel: 'crm', targetTag: 'cold_prospect' },
  },
  {
    id: 'act_add_to_list',
    category: 'action',
    subType: 'add_to_list',
    title: 'Add to List',
    subtitle: 'Assign contact to a dedicated audience list or segment',
    badge: 'List',
    defaultConfig: { channel: 'crm', targetList: 'High-Intent Leads' },
  },
  {
    id: 'act_remove_from_list',
    category: 'action',
    subType: 'remove_from_list',
    title: 'Remove from List',
    subtitle: 'Unassign contact from a specific audience list',
    badge: 'List',
    defaultConfig: { channel: 'crm', targetList: 'General Prospects' },
  },
  {
    id: 'act_update_field',
    category: 'action',
    subType: 'update_contact_field',
    title: 'Update Contact Field',
    subtitle: 'Mutate standard or custom field on the CRM contact record',
    badge: 'CRM',
    defaultConfig: { channel: 'crm', fieldName: 'temperature', fieldValue: 'hot' },
  },
  {
    id: 'act_move_stage',
    category: 'action',
    subType: 'move_deal_stage',
    title: 'Move Deal Stage',
    subtitle: 'Advance or transition contact across the revenue pipeline',
    badge: 'Pipeline',
    defaultConfig: { channel: 'crm', dealStage: 'qualified' },
  },
  {
    id: 'act_create_task',
    category: 'action',
    subType: 'create_task',
    title: 'Create Task',
    subtitle: 'Schedule a follow-up task and reminder for sales/account owner',
    badge: 'Task',
    defaultConfig: {
      channel: 'crm',
      taskTitle: 'Personal discovery call follow-up with lead',
    },
  },
  {
    id: 'act_notify_team',
    category: 'action',
    subType: 'notify_team',
    title: 'Notify Team Member',
    subtitle: 'Send internal alert to workspace owner or assigned rep',
    badge: 'Internal',
    defaultConfig: {
      channel: 'crm',
      teamRecipient: 'Workspace Owner (Sales Desk)',
      messagePreview: 'High-value lead crossed engagement threshold.',
    },
  },
  {
    id: 'act_add_note',
    category: 'action',
    subType: 'add_internal_note',
    title: 'Add Internal Note',
    subtitle: 'Append timestamped audit note to the contact timeline',
    badge: 'Timeline',
    defaultConfig: {
      channel: 'crm',
      internalNoteText: 'Automated sequence completed touchpoint verification.',
    },
  },
  {
    id: 'act_send_webhook',
    category: 'action',
    subType: 'send_webhook',
    title: 'Send Outbound Webhook',
    subtitle: 'POST signed JSON contact & event payload to external endpoint',
    badge: 'Webhook',
    defaultConfig: {
      channel: 'webhook',
      webhookUrl: 'https://hooks.external-service.com/v1/events',
      webhookMethod: 'POST',
    },
  },
  {
    id: 'act_enroll_workflow',
    category: 'action',
    subType: 'enroll_workflow',
    title: 'Enroll in Another Workflow',
    subtitle: 'Hand off contact into a downstream automation sequence',
    badge: 'Handoff',
    defaultConfig: {
      channel: 'crm',
      targetWorkflowName: 'Post-Purchase VIP Onboarding',
    },
  },
  {
    id: 'act_stop_workflow',
    category: 'action',
    subType: 'stop_workflow',
    title: 'Stop Workflow',
    subtitle: 'Gracefully terminate current execution path for this contact',
    badge: 'Exit',
    defaultConfig: { channel: 'crm' },
  },
];

export const CONDITION_CATALOG: PaletteItemDefinition[] = [
  {
    id: 'cond_if_else',
    category: 'condition',
    subType: 'if_else',
    title: 'If / Else Branch',
    subtitle: 'Split workflow execution into TRUE (Yes) and FALSE (No) paths',
    badge: 'Logic',
    defaultConfig: {
      conditionField: 'consentStatus',
      conditionOperator: 'equals',
      conditionValue: 'opted_in',
      branchLabels: ['Yes (Matched)', 'No (Fallback)'],
    },
  },
  {
    id: 'cond_yes_no',
    category: 'condition',
    subType: 'yes_no',
    title: 'Yes / No Condition',
    subtitle: 'Boolean verification gate before sending high-cost messages',
    badge: 'Boolean',
    defaultConfig: {
      conditionField: 'whatsapp_opt_in',
      conditionOperator: 'equals',
      conditionValue: 'true',
      branchLabels: ['Yes', 'No'],
    },
  },
  {
    id: 'cond_contact_field',
    category: 'condition',
    subType: 'contact_field_condition',
    title: 'Contact Field Condition',
    subtitle: 'Evaluate LTV, Deal Stage, Lead Temperature, or Custom Field',
    badge: 'Field',
    defaultConfig: {
      conditionField: 'ltv',
      conditionOperator: 'greater_than',
      conditionValue: '500',
      branchLabels: ['High Value (> $500)', 'Standard Tier'],
    },
  },
  {
    id: 'cond_tag_list',
    category: 'condition',
    subType: 'tag_list_condition',
    title: 'Tag / List Membership Condition',
    subtitle: 'Check whether contact possesses a tag or belongs to a segment',
    badge: 'Segment',
    defaultConfig: {
      conditionField: 'tags',
      conditionOperator: 'has_tag',
      conditionValue: 'vip_buyer',
      branchLabels: ['Has Tag', 'Missing Tag'],
    },
  },
  {
    id: 'cond_engagement',
    category: 'condition',
    subType: 'engagement_condition',
    title: 'Engagement Condition (Opened / Clicked)',
    subtitle: 'Branch based on prior email open or tracked link click activity',
    badge: 'Engagement',
    defaultConfig: {
      conditionField: 'engagement',
      conditionOperator: 'opened_email',
      conditionValue: 'Welcome Onboarding Sequence #1',
      branchLabels: ['Engaged', 'Did Not Open'],
    },
  },
  {
    id: 'cond_datetime',
    category: 'condition',
    subType: 'datetime_condition',
    title: 'Date / Time Window Condition',
    subtitle: 'Check if current execution falls within business hours or target date',
    badge: 'Time Gate',
    defaultConfig: {
      conditionField: 'current_day',
      conditionOperator: 'is_weekday',
      conditionValue: 'Mon-Fri 09:00-18:00',
      branchLabels: ['During Business Hours', 'Off-Hours'],
    },
  },
  {
    id: 'cond_multi_path',
    category: 'condition',
    subType: 'multi_path',
    title: 'Multi-Path Split (Path A / B / C)',
    subtitle: 'Route contact across 3 distinct omni-channel paths by preference',
    badge: '3-Way Split',
    defaultConfig: {
      conditionField: 'preferred_channel',
      conditionOperator: 'contains',
      conditionValue: 'email | whatsapp | sms',
      branchLabels: ['Path A: Email Priority', 'Path B: WhatsApp Cloud', 'Path C: SMS Direct'],
    },
  },
];

export const DELAY_CATALOG: PaletteItemDefinition[] = [
  {
    id: 'delay_minutes',
    category: 'delay',
    subType: 'minutes',
    title: 'Wait Minutes',
    subtitle: 'Pause execution in background scheduler for N minutes',
    badge: 'Delay',
    defaultConfig: {
      delayAmount: 15,
      delayUnit: 'minutes',
      businessDaysOnly: false,
    },
  },
  {
    id: 'delay_hours',
    category: 'delay',
    subType: 'hours',
    title: 'Wait Hours',
    subtitle: 'Pause execution for N hours with optional business hours window',
    badge: 'Delay',
    defaultConfig: {
      delayAmount: 4,
      delayUnit: 'hours',
      businessDaysOnly: true,
      businessWindowStart: '09:00',
      businessWindowEnd: '17:00',
    },
  },
  {
    id: 'delay_days',
    category: 'delay',
    subType: 'days',
    title: 'Wait Days (Business-Day Aware)',
    subtitle: 'Hold job in durable queue for N calendar or Mon-Fri business days',
    badge: 'Delay',
    defaultConfig: {
      delayAmount: 2,
      delayUnit: 'days',
      businessDaysOnly: true,
      businessWindowStart: '09:00',
      businessWindowEnd: '17:00',
    },
  },
  {
    id: 'delay_specific_datetime',
    category: 'delay',
    subType: 'specific_datetime',
    title: 'Wait Until Specific Date / Time',
    subtitle: 'Resume workflow at an exact timestamp in workspace timezone',
    badge: 'Calendar',
    defaultConfig: {
      delayAmount: 1,
      delayUnit: 'specific_datetime',
      specificDateTime: '2026-10-15T10:00',
      businessDaysOnly: false,
    },
  },
];

export const DEFAULT_ENGINE_CONFIG: WorkflowEngineConfig = {
  maxRetries: 3,
  retryBackoffSec: 30,
  idempotencyWindowHours: 24,
  businessDaysOnlyDefault: true,
  errorHandlingPolicy: 'retry_then_continue',
  concurrencyLimit: 25,
  scheduleMode: 'instant_event',
  entryDelayAmount: 15,
  entryDelayUnit: 'minutes',
  scheduledStartAt: '2026-10-15T09:00',
  recurringCadence: 'weekdays_9am',
  quietHoursStart: '09:00',
  quietHoursEnd: '17:00',
  timezone: 'UTC',
  killSwitchEnabled: true,
  exitConditionField: 'tag',
  exitConditionTag: 'Purchased_Course',
  exitAction: 'eject_immediately',
};

export function evaluateListKillSwitchForContact(
  contact: { tags?: string[]; listName?: string; stage?: string },
  lists?: AudienceList[],
  targetListName?: string
): { triggered: boolean; matchedTag: string; listName: string; ruleDescription: string } {
  const resolvedListName = (targetListName || contact.listName || '').trim();
  const matchedList = (lists || []).find(
    (l) => l.name.trim().toLowerCase() === resolvedListName.toLowerCase()
  );

  if (matchedList && matchedList.killSwitchEnabled === false) {
    return {
      triggered: false,
      matchedTag: '',
      listName: matchedList.name,
      ruleDescription: `List Kill Switch disabled for "${matchedList.name}"`,
    };
  }

  const activeKillSwitchTags =
    matchedList && Array.isArray(matchedList.killSwitchTags) && matchedList.killSwitchTags.length > 0
      ? matchedList.killSwitchTags
      : ['Purchased_Course'];

  const normalizeTag = (t: string) =>
    t
      .trim()
      .toLowerCase()
      .replace(/[\s\-_]+/g, '_');

  const normalizedTargets = activeKillSwitchTags.map((t) => normalizeTag(t)).filter(Boolean);
  const contactTags = Array.isArray(contact.tags) ? contact.tags : [];

  for (const cTag of contactTags) {
    const normContactTag = normalizeTag(cTag);
    if (!normContactTag) continue;
    const idx = normalizedTargets.indexOf(normContactTag);
    if (idx !== -1) {
      const canonicalTag = activeKillSwitchTags[idx] || cTag.trim();
      const dispList = matchedList?.name || resolvedListName || 'Contact List';
      return {
        triggered: true,
        matchedTag: canonicalTag,
        listName: dispList,
        ruleDescription: `List "${dispList}" Kill Switch matched tag #${canonicalTag} -> Automation stopped for this contact`,
      };
    }
  }

  return {
    triggered: false,
    matchedTag: '',
    listName: matchedList?.name || resolvedListName || 'Contact List',
    ruleDescription: `List Kill Switch watching for tag(s): ${activeKillSwitchTags.join(', ')}`,
  };
}

export function evaluateWorkflowKillSwitch(
  contact: { tags?: string[]; listName?: string; stage?: string },
  engineConfig?: WorkflowEngineConfig,
  lists?: AudienceList[],
  targetListName?: string
): { triggered: boolean; matchedTag: string; ruleDescription: string } {
  // First evaluate the List-level Kill Switch (set on the Contact List when created/edited)
  const listEval = evaluateListKillSwitchForContact(contact, lists, targetListName);
  if (listEval.triggered) {
    return {
      triggered: true,
      matchedTag: listEval.matchedTag,
      ruleDescription: listEval.ruleDescription,
    };
  }
  // If the matched list explicitly disabled Kill Switch, respect that list's setting
  if (lists && lists.length > 0) {
    const resolvedListName = (targetListName || contact.listName || '').trim().toLowerCase();
    const matchedList = lists.find((l) => l.name.trim().toLowerCase() === resolvedListName);
    if (matchedList && matchedList.killSwitchEnabled === false) {
      return {
        triggered: false,
        matchedTag: '',
        ruleDescription: listEval.ruleDescription,
      };
    }
  }

  const cfg = { ...DEFAULT_ENGINE_CONFIG, ...(engineConfig || {}) };
  if (cfg.killSwitchEnabled === false) {
    return {
      triggered: false,
      matchedTag: '',
      ruleDescription: 'Kill Switch disabled',
    };
  }

  const rawTargetTags = (cfg.exitConditionTag || 'Purchased_Course')
    .split(/[;,]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const targetTagsLower = rawTargetTags.map((t) =>
    t.toLowerCase().replace(/[\s\-_]+/g, '_')
  );
  const contactTags = Array.isArray(contact.tags) ? contact.tags : [];

  for (const cTag of contactTags) {
    const clean = cTag.trim().toLowerCase().replace(/[\s\-_]+/g, '_');
    const matchIdx = targetTagsLower.indexOf(clean);
    if (matchIdx !== -1) {
      const canonicalTag = rawTargetTags[matchIdx] || cTag.trim();
      return {
        triggered: true,
        matchedTag: canonicalTag,
        ruleDescription: `List Kill Switch matched tag #${canonicalTag} -> Automation stopped for this contact`,
      };
    }
  }

  return {
    triggered: false,
    matchedTag: '',
    ruleDescription: `List Kill Switch watching for tag(s): ${rawTargetTags.join(', ') || 'Purchased_Course'}`,
  };
}

export function resolveAutomationTargetList(auto: Automation): string {
  if (auto.targetList && auto.targetList.trim()) {
    return auto.targetList.trim();
  }
  if (auto.flowGraphJson) {
    try {
      const parsed = JSON.parse(auto.flowGraphJson);
      const firstTrig = Array.isArray(parsed?.nodes)
        ? parsed.nodes.find((n: WorkflowNode) => n.category === 'trigger')
        : null;
      if (firstTrig?.config?.targetList && String(firstTrig.config.targetList).trim()) {
        return String(firstTrig.config.targetList).trim();
      }
    } catch {
      // ignore json parse errors
    }
  }
  if (auto.triggerDetail && auto.triggerDetail.startsWith('List: ')) {
    const parts = auto.triggerDetail.replace(/^List:\s*/i, '').split('·');
    if (parts[0] && parts[0].trim()) {
      return parts[0].trim();
    }
  }
  return '';
}

export function createDefaultNodesForAutomation(
  triggerType: TriggerType = 'form_submission',
  triggerDetail = 'Lead Magnet Opt-In Form',
  targetList = ''
): WorkflowNode[] {
  const matchedTrig =
    TRIGGER_CATALOG.find((t) => t.subType === triggerType) || TRIGGER_CATALOG[0];
  const cleanList = targetList.trim();
  const triggerSubtitle = cleanList
    ? `List: ${cleanList} · ${triggerDetail || matchedTrig.subtitle}`
    : triggerDetail || matchedTrig.subtitle;

  return [
    {
      id: 'node_trig_1',
      category: 'trigger',
      subType: matchedTrig.subType,
      title: matchedTrig.title,
      subtitle: triggerSubtitle,
      branchPath: 'main',
      config: {
        ...matchedTrig.defaultConfig,
        ...(cleanList ? { targetList: cleanList } : {}),
      },
    },
    {
      id: 'node_act_email_1',
      category: 'action',
      subType: 'send_email',
      title: 'Send Welcome Email',
      subtitle: 'Dispatch welcome guide & resource link via verified domain',
      branchPath: 'main',
      config: {
        channel: 'email',
        subjectOrTemplate: 'Your Requested Resource + Next Steps',
        messagePreview:
          'Hi {{first_name}}, welcome aboard! Here is direct access to your resource...',
        messageScheduleMode: 'immediate',
        delayAmount: 15,
        delayUnit: 'minutes',
        scheduledSendTime: '09:00',
        specificDateTime: '2026-10-15T09:00',
        businessDaysOnly: true,
      },
    },
    {
      id: 'node_delay_1',
      category: 'delay',
      subType: 'days',
      title: 'Wait 1 Business Day',
      subtitle: 'Hold in queue for 1 day (Mon–Fri 09:00–17:00 window)',
      branchPath: 'main',
      config: {
        delayAmount: 1,
        delayUnit: 'days',
        businessDaysOnly: true,
        businessWindowStart: '09:00',
        businessWindowEnd: '17:00',
      },
    },
    {
      id: 'node_cond_1',
      category: 'condition',
      subType: 'engagement_condition',
      title: 'Engagement Check: Opened Welcome Email?',
      subtitle: 'If/Else split on provider open/click telemetry',
      branchPath: 'main',
      config: {
        conditionField: 'engagement',
        conditionOperator: 'opened_email',
        conditionValue: 'Your Requested Resource + Next Steps',
        branchLabels: ['Yes (Opened)', 'No (Unopened)'],
      },
    },
    {
      id: 'node_act_wa_yes',
      category: 'action',
      subType: 'send_whatsapp',
      title: 'Send Official WhatsApp VIP Invite',
      subtitle: 'Meta Cloud API Template: wa_vip_consultation_invite',
      branchPath: 'yes',
      config: {
        channel: 'whatsapp',
        subjectOrTemplate: 'wa_vip_consultation_invite',
        messagePreview:
          'Hi {{first_name}}, saw you checked out the guide! Reply YES to book a 1-on-1 strategy session.',
        messageScheduleMode: 'delay',
        delayAmount: 2,
        delayUnit: 'hours',
        scheduledSendTime: '10:00',
        specificDateTime: '2026-10-15T10:00',
        businessDaysOnly: true,
      },
    },
    {
      id: 'node_act_sms_no',
      category: 'action',
      subType: 'send_sms',
      title: 'Send SMS Nudge via Connected Provider',
      subtitle: 'Fallback SMS reminder for unopened email branch',
      branchPath: 'no',
      config: {
        channel: 'sms',
        subjectOrTemplate: 'SMS Fallback Follow-Up',
        messagePreview:
          'Hi {{first_name}}, we sent your guide to your email earlier — check your inbox!',
        messageScheduleMode: 'time_window',
        delayAmount: 4,
        delayUnit: 'hours',
        scheduledSendTime: '14:00',
        specificDateTime: '2026-10-16T14:00',
        businessDaysOnly: true,
      },
    },
    {
      id: 'node_act_tag_final',
      category: 'action',
      subType: 'add_tag',
      title: 'Add Tag: sequence_completed',
      subtitle: 'Apply completion tag and log CRM attribution',
      branchPath: 'main',
      config: {
        channel: 'crm',
        targetTag: 'sequence_completed',
      },
    },
  ];
}

export function parseOrBuildFlowGraph(automation: Automation | null): SerializedFlowGraph {
  if (!automation) {
    const defaultNodes = createDefaultNodesForAutomation();
    return {
      nodes: defaultNodes,
      version: 1,
      versionHistory: [
        {
          version: 1,
          savedAt: new Date().toISOString(),
          author: 'Workspace Operator',
          changeNote: 'Initial workflow architecture',
          nodeCount: defaultNodes.length,
          nodes: defaultNodes,
        },
      ],
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
    };
  }

  if (automation.flowGraphJson) {
    try {
      const parsed = JSON.parse(automation.flowGraphJson) as SerializedFlowGraph;
      if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
        return {
          nodes: parsed.nodes,
          version: parsed.version || automation.version || 1,
          versionHistory: Array.isArray(parsed.versionHistory) ? parsed.versionHistory : [],
          engineConfig: { ...DEFAULT_ENGINE_CONFIG, ...(parsed.engineConfig || {}) },
        };
      }
    } catch {
      // Fall back to synthesizing nodes from stepsSummary
    }
  }

  // Synthesize rich visual nodes from existing stepsSummary if legacy automation
  const baseTrigger =
    TRIGGER_CATALOG.find((t) => t.subType === automation.triggerType) || TRIGGER_CATALOG[0];

  const synthesizedNodes: WorkflowNode[] = [
    {
      id: `trig_${automation.id}`,
      category: 'trigger',
      subType: automation.triggerType,
      title: baseTrigger.title,
      subtitle: automation.triggerDetail || baseTrigger.subtitle,
      branchPath: 'main',
      config: { ...baseTrigger.defaultConfig },
    },
  ];

  (automation.stepsSummary || []).forEach((stepText, idx) => {
    const lower = stepText.toLowerCase();
    let category: WorkflowNodeCategory = 'action';
    let subType: TriggerType | ActionNodeType | ConditionNodeType | DelayUnit = 'send_email';
    let branchPath: BranchPathType = 'main';

    if (lower.includes('[yes]')) branchPath = 'yes';
    else if (lower.includes('[no]')) branchPath = 'no';
    else if (lower.includes('[path a]')) branchPath = 'path_a';
    else if (lower.includes('[path b]')) branchPath = 'path_b';

    if (lower.includes('wait') || lower.includes('delay') || lower.includes('hour') || lower.includes('day')) {
      category = 'delay';
      subType = lower.includes('hour') ? 'hours' : lower.includes('min') ? 'minutes' : 'days';
    } else if (lower.includes('if') || lower.includes('condition') || lower.includes('branch') || lower.includes('check')) {
      category = 'condition';
      subType = 'if_else';
    } else if (lower.includes('whatsapp')) {
      subType = 'send_whatsapp';
    } else if (lower.includes('sms')) {
      subType = 'send_sms';
    } else if (lower.includes('tag')) {
      subType = lower.includes('remove') ? 'remove_tag' : 'add_tag';
    } else if (lower.includes('list')) {
      subType = lower.includes('remove') ? 'remove_from_list' : 'add_to_list';
    } else if (lower.includes('task')) {
      subType = 'create_task';
    } else if (lower.includes('stage') || lower.includes('pipeline')) {
      subType = 'move_deal_stage';
    } else if (lower.includes('webhook')) {
      subType = 'send_webhook';
    } else if (lower.includes('note')) {
      subType = 'add_internal_note';
    }

    synthesizedNodes.push({
      id: `step_${idx + 1}`,
      category,
      subType,
      title: stepText.replace(/^\d+\.\s*/, ''),
      subtitle:
        category === 'delay'
          ? 'Scheduled background timer hold'
          : category === 'condition'
          ? 'Dynamic rule evaluation'
          : 'Automated execution step',
      branchPath,
      config: {
        channel:
          subType === 'send_whatsapp'
            ? 'whatsapp'
            : subType === 'send_sms'
            ? 'sms'
            : subType === 'send_email'
            ? 'email'
            : 'crm',
        delayAmount: 1,
        delayUnit: 'days',
        businessDaysOnly: true,
        targetTag: 'automation_processed',
      },
    });
  });

  const ver = automation.version || 1;
  return {
    nodes: synthesizedNodes,
    version: ver,
    versionHistory: [
      {
        version: ver,
        savedAt: new Date().toISOString(),
        author: 'Workspace Operator',
        changeNote: 'Loaded workflow snapshot',
        nodeCount: synthesizedNodes.length,
        nodes: synthesizedNodes,
      },
    ],
    engineConfig: { ...DEFAULT_ENGINE_CONFIG },
  };
}

export function serializeFlowGraphToString(graph: SerializedFlowGraph): string {
  // Trim history to max 6 snapshots so we stay strictly under Firestore 24,000 char limit
  const compactHistory = (graph.versionHistory || []).slice(0, 5).map((snap) => ({
    ...snap,
    nodes: snap.nodes.slice(0, 20),
  }));
  const payload: SerializedFlowGraph = {
    nodes: graph.nodes.slice(0, 25),
    version: graph.version,
    versionHistory: compactHistory,
    engineConfig: graph.engineConfig,
  };
  const raw = JSON.stringify(payload);
  return raw.slice(0, 23500);
}

export function deriveStepsSummaryFromNodes(nodes: WorkflowNode[]): string[] {
  const nonTrigger = nodes.filter((n) => n.category !== 'trigger');
  if (nonTrigger.length === 0) {
    return ['01. Initialize workflow execution'];
  }
  const lines = nonTrigger.slice(0, 10).map((node, idx) => {
    const num = String(idx + 1).padStart(2, '0');
    const branchPrefix =
      node.branchPath === 'yes'
        ? '[YES] '
        : node.branchPath === 'no'
        ? '[NO] '
        : node.branchPath === 'path_a'
        ? '[PATH A] '
        : node.branchPath === 'path_b'
        ? '[PATH B] '
        : node.branchPath === 'path_c'
        ? '[PATH C] '
        : '';
    const scheduleSuffix =
      node.config.messageScheduleMode === 'delay'
        ? ` [Wait ${node.config.delayAmount || 1} ${node.config.delayUnit || 'hours'}]`
        : node.config.messageScheduleMode === 'specific_datetime' && node.config.specificDateTime
        ? ` [Scheduled ${node.config.specificDateTime.replace('T', ' ')}]`
        : node.config.messageScheduleMode === 'time_window'
        ? ` [Send @ ${node.config.scheduledSendTime || '09:00'}]`
        : '';
    return sanitizeString(
      `${num}. ${branchPrefix}${node.title}${scheduleSuffix}`,
      160,
      `${num}. Workflow Step`
    );
  });
  return sanitizeStringArray(lines, 10, 160);
}

export function deriveChannelsFromNodes(nodes: WorkflowNode[]): string[] {
  const set = new Set<string>();
  nodes.forEach((n) => {
    if (n.subType === 'send_email' || n.config.channel === 'email') set.add('email');
    if (n.subType === 'send_whatsapp' || n.config.channel === 'whatsapp') set.add('whatsapp');
    if (n.subType === 'send_sms' || n.config.channel === 'sms') set.add('sms');
    if (n.subType === 'send_webhook' || n.config.channel === 'webhook') set.add('webhook');
  });
  if (set.size === 0) set.add('crm');
  return sanitizeStringArray(Array.from(set), 5, 32);
}

export function evaluateConditionForContact(
  node: WorkflowNode,
  contact?: Contact | null
): { passed: boolean; branchPath: BranchPathType; reason: string } {
  if (!contact) {
    return {
      passed: true,
      branchPath: 'yes',
      reason: 'Synthetic test contact matched condition criteria (TRUE -> Yes branch)',
    };
  }

  const op = node.config.conditionOperator || 'equals';
  const val = (node.config.conditionValue || '').toLowerCase();

  if (node.subType === 'multi_path') {
    const channels = contact.commChannels || [];
    if (channels.includes('whatsapp')) {
      return {
        passed: true,
        branchPath: 'path_b',
        reason: `Contact prefers WhatsApp (${contact.phone || 'verified'}) -> Routed to Path B`,
      };
    }
    if (channels.includes('sms')) {
      return {
        passed: true,
        branchPath: 'path_c',
        reason: `Contact prefers SMS -> Routed to Path C`,
      };
    }
    return {
      passed: true,
      branchPath: 'path_a',
      reason: `Contact routed to Path A (Email Priority: ${contact.email})`,
    };
  }

  if (op === 'has_tag' || node.subType === 'tag_list_condition') {
    const target = val || (node.config.targetTag || 'vip').toLowerCase();
    const hasTag =
      contact.tags.some((t) => t.toLowerCase().includes(target)) ||
      contact.listName.toLowerCase().includes(target);
    return {
      passed: hasTag,
      branchPath: hasTag ? 'yes' : 'no',
      reason: hasTag
        ? `Contact has tag/segment matching "${target}" -> YES path`
        : `Contact does not have tag "${target}" -> NO path`,
    };
  }

  if (op === 'greater_than' || node.config.conditionField === 'ltv') {
    const threshold = Number(node.config.conditionValue || 100);
    const passed = (contact.ltv || 0) >= threshold;
    return {
      passed,
      branchPath: passed ? 'yes' : 'no',
      reason: `Contact LTV ($${contact.ltv || 0}) ${
        passed ? '>=' : '<'
      } $${threshold} threshold -> ${passed ? 'YES' : 'NO'} path`,
    };
  }

  const passed = contact.consentStatus === 'opted_in' || contact.temperature === 'hot';
  return {
    passed,
    branchPath: passed ? 'yes' : 'no',
    reason: passed
      ? `Condition verified (${contact.consentStatus}, ${contact.temperature}) -> YES path`
      : `Condition evaluated false -> NO fallback path`,
  };
}

export interface ProjectedTimelineStep {
  node: WorkflowNode;
  index: number;
  offsetLabel: string;
  projectedTimestamp: string;
  windowEnforcementNote: string;
}

export function computeProjectedScheduleTimeline(
  nodes: WorkflowNode[],
  engineConfig: WorkflowEngineConfig
): ProjectedTimelineStep[] {
  let cursorMs = Date.now();

  if (engineConfig.scheduleMode === 'scheduled_datetime' && engineConfig.scheduledStartAt) {
    const parsed = Date.parse(engineConfig.scheduledStartAt);
    if (!Number.isNaN(parsed)) {
      cursorMs = parsed;
    }
  } else if (engineConfig.scheduleMode === 'delayed_entry') {
    const amt = engineConfig.entryDelayAmount || 15;
    const unit = engineConfig.entryDelayUnit || 'minutes';
    const mult = unit === 'days' ? 86400000 : unit === 'hours' ? 3600000 : 60000;
    cursorMs += amt * mult;
  }

  let cumulativeMinutes = 0;

  return nodes.map((node, index) => {
    let offsetLabel = 'T+0m (Immediate)';
    let windowNote = 'Executes immediately on trigger';

    if (index === 0 && engineConfig.scheduleMode === 'delayed_entry') {
      offsetLabel = `Entry Buffer: +${engineConfig.entryDelayAmount || 15} ${
        engineConfig.entryDelayUnit || 'minutes'
      }`;
      windowNote = 'Held in entry buffer before workflow starts';
    } else if (index === 0 && engineConfig.scheduleMode === 'scheduled_datetime') {
      offsetLabel = `Scheduled Calendar Start`;
      windowNote = `Starts at ${engineConfig.scheduledStartAt || 'scheduled date/time'}`;
    } else if (index === 0 && engineConfig.scheduleMode === 'recurring_cadence') {
      offsetLabel = `Recurring: ${(engineConfig.recurringCadence || 'weekdays_9am').replace(
        /_/g,
        ' '
      )}`;
      windowNote = `Cron Schedule (${engineConfig.timezone || 'UTC'})`;
    }

    if (node.category === 'delay') {
      const amt = node.config.delayAmount || 1;
      const unit = node.config.delayUnit || 'days';
      if (unit === 'specific_datetime' && node.config.specificDateTime) {
        const targetMs = Date.parse(node.config.specificDateTime);
        if (!Number.isNaN(targetMs)) {
          cursorMs = targetMs;
        }
        offsetLabel = `Wait Until ${node.config.specificDateTime.replace('T', ' ')}`;
      } else {
        const addMins =
          unit === 'days' ? amt * 1440 : unit === 'hours' ? amt * 60 : amt;
        cumulativeMinutes += addMins;
        cursorMs += addMins * 60000;
        offsetLabel = `+${amt} ${unit} (Cumulative: ${
          cumulativeMinutes >= 1440
            ? `${(cumulativeMinutes / 1440).toFixed(1)}d`
            : cumulativeMinutes >= 60
            ? `${(cumulativeMinutes / 60).toFixed(1)}h`
            : `${cumulativeMinutes}m`
        })`;
      }

      if (node.config.businessDaysOnly) {
        const dayOfWeek = new Date(cursorMs).getDay();
        if (dayOfWeek === 6) cursorMs += 2 * 86400000; // Saturday -> Monday
        if (dayOfWeek === 0) cursorMs += 1 * 86400000; // Sunday -> Monday
        windowNote = `Mon–Fri Business Window (${node.config.businessWindowStart || '09:00'}–${
          node.config.businessWindowEnd || '17:00'
        })`;
      } else {
        windowNote = '24/7 Calendar Timer (Unrestricted)';
      }
    } else if (index > 0) {
      if (node.config.messageScheduleMode === 'delay') {
        const amt = node.config.delayAmount || 1;
        const unit = node.config.delayUnit || 'hours';
        const addMins = unit === 'days' ? amt * 1440 : unit === 'hours' ? amt * 60 : amt;
        cumulativeMinutes += addMins;
        cursorMs += addMins * 60000;
        offsetLabel = `Msg Delay: +${amt} ${unit}`;
        windowNote = node.config.businessDaysOnly
          ? `Wait ${amt} ${unit} • Send @ ${node.config.scheduledSendTime || '09:00'} (Mon–Fri)`
          : `Wait ${amt} ${unit} before message dispatch`;
      } else if (
        node.config.messageScheduleMode === 'specific_datetime' &&
        node.config.specificDateTime
      ) {
        const targetMs = Date.parse(node.config.specificDateTime);
        if (!Number.isNaN(targetMs)) {
          cursorMs = targetMs;
        }
        offsetLabel = `Scheduled: ${node.config.specificDateTime.replace('T', ' ')}`;
        windowNote = `Exact per-message calendar schedule`;
      } else if (node.config.messageScheduleMode === 'time_window') {
        offsetLabel = `Send Window @ ${node.config.scheduledSendTime || '09:00'}`;
        windowNote = node.config.businessDaysOnly
          ? `Deliver at ${node.config.scheduledSendTime || '09:00'} (Business Days Mon–Fri)`
          : `Deliver at ${node.config.scheduledSendTime || '09:00'} daily`;
      } else {
        offsetLabel =
          cumulativeMinutes === 0
            ? 'T+0m (Send Immediately)'
            : `T+${
                cumulativeMinutes >= 1440
                  ? `${(cumulativeMinutes / 1440).toFixed(1)}d`
                  : cumulativeMinutes >= 60
                  ? `${(cumulativeMinutes / 60).toFixed(1)}h`
                  : `${cumulativeMinutes}m`
              }`;
        windowNote = engineConfig.businessDaysOnlyDefault
          ? `Respects Quiet Hours (${engineConfig.quietHoursStart || '09:00'}–${
              engineConfig.quietHoursEnd || '17:00'
            })`
          : 'Immediate dispatch after prior node';
      }
    }

    const projectedDate = new Date(cursorMs);
    const projectedTimestamp = projectedDate.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return {
      node,
      index,
      offsetLabel,
      projectedTimestamp,
      windowEnforcementNote: windowNote,
    };
  });
}
