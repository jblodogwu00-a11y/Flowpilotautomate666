import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  Node,
  Edge,
  Connection,
  NodeProps,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Zap,
  Clock,
  MessageSquare,
  Mail,
  Split,
  Save,
  CheckCircle2,
  Play,
  Trash2,
  Plus,
  ArrowLeft,
  X,
  Layers,
  Sparkles,
  Send,
  Check,
  ChevronRight,
  Settings2,
  Sliders,
  PanelLeftClose,
  PanelLeft,
  FileCode,
  Search,
  Pause,
  FolderPlus,
  ArrowRight,
  FileText,
  UserPlus,
  Tag,
  ShoppingBag,
  MousePointerClick,
  Calendar,
  Webhook,
  Cloud,
  CloudOff,
  UploadCloud,
  LogIn,
} from 'lucide-react';
import { DelayUnit, WorkflowNodeType } from '../lib/automation/types';
import {
  ActivityChannel,
  ActivityEventType,
  AudienceList,
  Automation,
  AutomationStatus,
  CaptureAsset,
  ConsentStatus,
  Contact,
  ListCategory,
  TriggerType,
  UserPrivateProfile,
  Workspace,
  sanitizeString,
  sanitizeStringArray,
} from '../types';
import { EmailEditor } from './EmailEditor';
import { executeClientWorkflowGraph } from '../utils/workflowClientExecutor';

// ============================================================================
// TRIGGER METADATA CATALOG
// ============================================================================

interface TriggerCatalogItem {
  nodeType: WorkflowNodeType;
  firestoreTriggerType: TriggerType;
  title: string;
  shortLabel: string;
  subtitle: string;
  defaultLabel: string;
}

const TRIGGER_CATALOG: TriggerCatalogItem[] = [
  {
    nodeType: 'trigger_form_submission',
    firestoreTriggerType: 'form_submission',
    title: 'Form Submitted',
    shortLabel: 'Form Submitted (After Lead Fills Form)',
    subtitle: 'Starts actions immediately after lead submits a form',
    defaultLabel: 'Lead Fills Out a Form',
  },
  {
    nodeType: 'trigger_list_joined',
    firestoreTriggerType: 'list_joined',
    title: 'Contact Joins List',
    shortLabel: 'Contact Joins List',
    subtitle: 'Fires when a contact is added to the list',
    defaultLabel: 'Contact Joins List',
  },
  {
    nodeType: 'trigger_contact_added',
    firestoreTriggerType: 'contact_added',
    title: 'Contact Added to CRM',
    shortLabel: 'Contact Added to CRM',
    subtitle: 'New contact created manually or imported',
    defaultLabel: 'New Contact Added',
  },
  {
    nodeType: 'trigger_tag_added',
    firestoreTriggerType: 'tag_added',
    title: 'Tag Added',
    shortLabel: 'Tag Added to Contact',
    subtitle: 'Starts when a segment tag is applied',
    defaultLabel: 'Tag Added to Contact',
  },
  {
    nodeType: 'trigger_tag_removed',
    firestoreTriggerType: 'tag_removed',
    title: 'Tag Removed',
    shortLabel: 'Tag Removed from Contact',
    subtitle: 'Starts when a tag is removed from contact',
    defaultLabel: 'Tag Removed from Contact',
  },
  {
    nodeType: 'trigger_purchase_completed',
    firestoreTriggerType: 'purchase_completed',
    title: 'Purchase Completed',
    shortLabel: 'Purchase Completed',
    subtitle: 'Checkout or payment confirmation event',
    defaultLabel: 'Purchase Completed',
  },
  {
    nodeType: 'trigger_link_clicked',
    firestoreTriggerType: 'link_clicked',
    title: 'Link Clicked',
    shortLabel: 'Link Clicked',
    subtitle: 'Lead clicks a tracked campaign or SMS link',
    defaultLabel: 'Tracked Link Clicked',
  },
  {
    nodeType: 'trigger_email_opened',
    firestoreTriggerType: 'email_opened',
    title: 'Email Opened',
    shortLabel: 'Email Opened',
    subtitle: 'Lead opens a broadcast or drip email',
    defaultLabel: 'Campaign Email Opened',
  },
  {
    nodeType: 'trigger_keyword',
    firestoreTriggerType: 'whatsapp_keyword',
    title: 'WhatsApp Keyword',
    shortLabel: 'WhatsApp Inbound Keyword',
    subtitle: 'e.g. "price", "start", "info"',
    defaultLabel: 'WhatsApp Keyword Match',
  },
  {
    nodeType: 'trigger_whatsapp_reply',
    firestoreTriggerType: 'list_joined',
    title: 'WhatsApp Inbound / List',
    shortLabel: 'WhatsApp Reply / List Event',
    subtitle: 'When lead enters list or replies on WhatsApp',
    defaultLabel: 'List / WhatsApp Event',
  },
  {
    nodeType: 'trigger_email_reply',
    firestoreTriggerType: 'email_opened',
    title: 'Email Reply',
    shortLabel: 'Email Inbound Message',
    subtitle: 'When an inbound email reply arrives',
    defaultLabel: 'Email Inbound Message',
  },
  {
    nodeType: 'trigger_webhook_received',
    firestoreTriggerType: 'webhook_received',
    title: 'Webhook Received',
    shortLabel: 'Webhook Received (API / Zapier)',
    subtitle: 'External app POST event trigger',
    defaultLabel: 'External Webhook Event',
  },
  {
    nodeType: 'trigger_specific_datetime',
    firestoreTriggerType: 'specific_datetime',
    title: 'Specific Date & Time',
    shortLabel: 'Specific Date & Time',
    subtitle: 'Runs sequence at scheduled date & time',
    defaultLabel: 'Scheduled Date & Time',
  },
];

const getTriggerMeta = (nodeType?: string): TriggerCatalogItem => {
  return (
    TRIGGER_CATALOG.find((item) => item.nodeType === nodeType) ||
    TRIGGER_CATALOG.find((item) => item.nodeType === 'trigger_whatsapp_reply')!
  );
};

const renderTriggerIcon = (nodeType?: string, className = 'w-4 h-4') => {
  switch (nodeType) {
    case 'trigger_form_submission':
      return <FileText className={className} />;
    case 'trigger_list_joined':
      return <Layers className={className} />;
    case 'trigger_contact_added':
      return <UserPlus className={className} />;
    case 'trigger_tag_added':
    case 'trigger_tag_removed':
      return <Tag className={className} />;
    case 'trigger_purchase_completed':
      return <ShoppingBag className={className} />;
    case 'trigger_link_clicked':
      return <MousePointerClick className={className} />;
    case 'trigger_email_opened':
    case 'trigger_email_reply':
      return <Mail className={className} />;
    case 'trigger_webhook_received':
      return <Webhook className={className} />;
    case 'trigger_specific_datetime':
      return <Calendar className={className} />;
    case 'trigger_keyword':
      return <Zap className={className} />;
    default:
      return <MessageSquare className={className} />;
  }
};

// ============================================================================
// CUSTOM REACT FLOW NODE COMPONENTS
// ============================================================================

export type FlowCustomNode = Node<Record<string, any>>;

const TriggerNodeComponent = ({ data, selected }: NodeProps<FlowCustomNode>) => {
  const nodeType = (data.nodeType as string) || 'trigger_whatsapp_reply';
  const meta = getTriggerMeta(nodeType);
  const isForm = nodeType === 'trigger_form_submission';
  const isKeyword = nodeType === 'trigger_keyword';
  const isTag = nodeType === 'trigger_tag_added' || nodeType === 'trigger_tag_removed';
  const isScheduled = nodeType === 'trigger_specific_datetime';

  return (
    <div
      className={`min-w-[260px] max-w-[280px] rounded-2xl bg-white border transition-all duration-200 shadow-xs ${
        selected
          ? 'border-emerald-500 ring-4 ring-emerald-500/10 shadow-md'
          : 'border-slate-200 hover:border-emerald-400'
      }`}
    >
      <div className="px-4 py-2.5 bg-emerald-50/80 border-b border-emerald-100 rounded-t-2xl flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-emerald-600" />
          Trigger
        </span>
        <span className="text-[10px] font-semibold text-emerald-800">Start Node</span>
      </div>

      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
            {renderTriggerIcon(nodeType, 'w-4 h-4')}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-900 truncate">
              {data.label || meta.defaultLabel}
            </h4>
            <p className="text-[11px] text-slate-500 truncate">{meta.subtitle}</p>
          </div>
        </div>

        {isForm && (
          <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-emerald-50/60 border border-emerald-200/70 text-[11px] flex items-center justify-between gap-2">
            <span className="text-slate-600 shrink-0">Target:</span>
            <span className="font-semibold text-emerald-800 truncate">
              {data.formScope === 'specific_form' && data.targetFormTitle
                ? data.targetFormTitle
                : 'All list capture forms'}
            </span>
          </div>
        )}

        {isKeyword && (
          <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] flex items-center justify-between">
            <span className="text-slate-500">Keyword:</span>
            <span className="font-mono font-bold text-emerald-700">
              "{data.triggerKeyword || 'start'}"
            </span>
          </div>
        )}

        {isTag && (
          <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] flex items-center justify-between gap-2">
            <span className="text-slate-500 shrink-0">Tag:</span>
            <span className="font-mono font-bold text-emerald-700 truncate">
              {data.tagName || 'VIP_Lead'}
            </span>
          </div>
        )}

        {isScheduled && (
          <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] flex items-center justify-between gap-2">
            <span className="text-slate-500 shrink-0">Schedule:</span>
            <span className="font-mono font-bold text-emerald-700 truncate tabular-nums">
              {data.scheduledAt ? data.scheduledAt.replace('T', ' ') : 'Next Schedule'}
            </span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3.5 h-3.5 !bg-emerald-600 !border-2 !border-white !rounded-full shadow-xs"
      />
    </div>
  );
};

const ConditionNodeComponent = ({ data, selected }: NodeProps<FlowCustomNode>) => {
  return (
    <div
      className={`min-w-[270px] max-w-[290px] rounded-2xl bg-white border transition-all duration-200 shadow-xs ${
        selected
          ? 'border-indigo-500 ring-4 ring-indigo-500/10 shadow-md'
          : 'border-slate-200 hover:border-indigo-400'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3.5 h-3.5 !bg-indigo-600 !border-2 !border-white !rounded-full shadow-xs"
      />

      <div className="px-4 py-2.5 bg-indigo-50/80 border-b border-indigo-100 rounded-t-2xl flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
          <Split className="w-3.5 h-3.5 text-indigo-600" />
          Condition
        </span>
        <span className="text-[10px] font-semibold text-indigo-800">Branch Logic</span>
      </div>

      <div className="p-4 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-100/70 text-indigo-700 flex items-center justify-center shrink-0">
            <Split className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Message Evaluation</h4>
            <p className="text-[11px] text-slate-500">Case-insensitive keyword check</p>
          </div>
        </div>

        <div className="px-2.5 py-1.5 rounded-lg bg-indigo-50/50 border border-indigo-100 text-xs flex items-center justify-between">
          <span className="text-slate-600">Contains:</span>
          <span className="font-mono font-bold text-indigo-700">
            "{data.keyword || 'price'}"
          </span>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold">
          <span className="text-emerald-700">Yes (Match)</span>
          <span className="text-rose-600">No (Else)</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: '25%' }}
        className="w-3.5 h-3.5 !bg-emerald-600 !border-2 !border-white !rounded-full shadow-xs"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: '75%' }}
        className="w-3.5 h-3.5 !bg-rose-500 !border-2 !border-white !rounded-full shadow-xs"
      />
    </div>
  );
};

const ActionNodeComponent = ({ data, selected }: NodeProps<FlowCustomNode>) => {
  const isEnd = data.nodeType === 'action_end' || data.nodeType === 'action_end_flow';
  const isEmail = data.nodeType === 'action_send_email';

  return (
    <div
      className={`min-w-[270px] max-w-[290px] rounded-2xl bg-white border transition-all duration-200 shadow-xs ${
        selected
          ? isEnd
            ? 'border-slate-500 ring-4 ring-slate-500/10'
            : 'border-blue-500 ring-4 ring-blue-500/10 shadow-md'
          : 'border-slate-200 hover:border-blue-400'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3.5 h-3.5 !bg-blue-600 !border-2 !border-white !rounded-full shadow-xs"
      />

      <div
        className={`px-4 py-2.5 border-b rounded-t-2xl flex items-center justify-between ${
          isEnd
            ? 'bg-slate-100 border-slate-200 text-slate-700'
            : 'bg-blue-50/80 border-blue-100 text-blue-900'
        }`}
      >
        <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
          {isEnd ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
          ) : (
            <Send className="w-3.5 h-3.5 text-blue-600" />
          )}
          {isEnd ? 'Completion' : isEmail ? 'Email Action' : 'WhatsApp Action'}
        </span>
        <span className="text-[10px] font-semibold">
          {isEnd ? 'End' : 'Outbound'}
        </span>
      </div>

      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isEnd
                ? 'bg-slate-100 text-slate-600'
                : isEmail
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {isEnd ? (
              <Check className="w-4 h-4" />
            ) : isEmail ? (
              <Mail className="w-4 h-4" />
            ) : (
              <MessageSquare className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-900 truncate">
              {isEnd
                ? 'Terminate Workflow'
                : isEmail
                ? 'Send Formatted Email'
                : 'Send WhatsApp Message'}
            </h4>
            <p className="text-[11px] text-slate-500 truncate">
              {isEnd
                ? 'No further follow-up'
                : isEmail
                ? data.senderEmailPreview || 'From: Verified Custom Domain'
                : 'Delivered via WhatsApp'}
            </p>
          </div>
        </div>

        {!isEnd && (
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 line-clamp-2 italic leading-relaxed">
            "{data.message || 'Thank you for joining! How can we help you get started?'}"
          </div>
        )}
      </div>

      {!isEnd && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3.5 h-3.5 !bg-blue-600 !border-2 !border-white !rounded-full shadow-xs"
        />
      )}
    </div>
  );
};

const DelayNodeComponent = ({ data, selected }: NodeProps<FlowCustomNode>) => {
  const value = data.delayValue || 5;
  const unit = data.delayUnit || 'Minutes';

  return (
    <div
      className={`min-w-[270px] max-w-[290px] rounded-2xl bg-white border transition-all duration-200 shadow-xs ${
        selected
          ? 'border-amber-500 ring-4 ring-amber-500/10 shadow-md'
          : 'border-slate-200 hover:border-amber-400'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3.5 h-3.5 !bg-amber-500 !border-2 !border-white !rounded-full shadow-xs"
      />

      <div className="px-4 py-2.5 bg-amber-50/80 border-b border-amber-100 rounded-t-2xl flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Delay Timer
        </span>
        <span className="text-[10px] font-semibold text-amber-900">Async Queue</span>
      </div>

      <div className="p-4 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-100/70 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Wait Duration</h4>
            <p className="text-[11px] text-slate-500">Pauses before next action</p>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200/60 flex items-center justify-between">
          <span className="text-xs text-amber-900 font-medium">Wait Time:</span>
          <span className="font-mono text-sm font-bold text-amber-900 bg-white px-2.5 py-0.5 rounded-md border border-amber-200 tabular-nums">
            {value} {unit}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3.5 h-3.5 !bg-amber-500 !border-2 !border-white !rounded-full shadow-xs"
      />
    </div>
  );
};

const nodeTypes = {
  trigger: TriggerNodeComponent,
  condition: ConditionNodeComponent,
  action: ActionNodeComponent,
  delay: DelayNodeComponent,
};

// ============================================================================
// PRESET BLUEPRINTS & GRAPH HELPERS
// ============================================================================

const WORKFLOW_BLUEPRINTS = [
  {
    id: 'nurture_drip',
    title: '3-Day Email & WhatsApp Nurture Drip',
    description: 'Welcomes lead, waits 2 hours, sends follow-up, waits 1 day, sends booking email.',
    nodes: [
      {
        id: 'node_trigger',
        type: 'trigger',
        position: { x: 250, y: 50 },
        data: { nodeType: 'trigger_whatsapp_reply', label: 'Lead Joined List / Inbound' },
      },
      {
        id: 'node_welcome',
        type: 'action',
        position: { x: 250, y: 220 },
        data: {
          nodeType: 'action_send_whatsapp',
          message: 'Hi {{first_name}}! Welcome aboard. Your starter resource is ready.',
        },
      },
      {
        id: 'node_delay1',
        type: 'delay',
        position: { x: 250, y: 390 },
        data: { delayValue: 2, delayUnit: 'Hours' },
      },
      {
        id: 'node_followup1',
        type: 'action',
        position: { x: 250, y: 560 },
        data: {
          nodeType: 'action_send_whatsapp',
          message: 'Did you get a chance to review the guide? Reply YES if you have questions!',
        },
      },
      {
        id: 'node_delay2',
        type: 'delay',
        position: { x: 250, y: 730 },
        data: { delayValue: 1, delayUnit: 'Days' },
      },
      {
        id: 'node_final_cta',
        type: 'action',
        position: { x: 250, y: 900 },
        data: {
          nodeType: 'action_send_email',
          message: 'Special invitation: Book your strategy session with our team today.',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'node_trigger', target: 'node_welcome', animated: true },
      { id: 'e2', source: 'node_welcome', target: 'node_delay1', animated: true },
      { id: 'e3', source: 'node_delay1', target: 'node_followup1', animated: true },
      { id: 'e4', source: 'node_followup1', target: 'node_delay2', animated: true },
      { id: 'e5', source: 'node_delay2', target: 'node_final_cta', animated: true },
    ],
  },
  {
    id: 'keyword_qualifier',
    title: 'Instant Keyword Qualifier & Branch',
    description: 'Inspects if incoming message contains "price" or "quote" and routes replies.',
    nodes: [
      {
        id: 't1',
        type: 'trigger',
        position: { x: 300, y: 50 },
        data: { nodeType: 'trigger_keyword', label: 'Keyword Inbound', triggerKeyword: 'info' },
      },
      {
        id: 'c1',
        type: 'condition',
        position: { x: 300, y: 220 },
        data: { nodeType: 'condition_message_contains', keyword: 'price' },
      },
      {
        id: 'a_yes',
        type: 'action',
        position: { x: 120, y: 420 },
        data: {
          nodeType: 'action_send_whatsapp',
          message: 'Our starter plan is $99/mo including unlimited workflows. Ready to upgrade?',
        },
      },
      {
        id: 'a_no',
        type: 'action',
        position: { x: 480, y: 420 },
        data: {
          nodeType: 'action_send_whatsapp',
          message: 'Thanks for reaching out! A specialist will assist you shortly.',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 't1', target: 'c1', animated: true },
      { id: 'e2', source: 'c1', target: 'a_yes', sourceHandle: 'true', animated: true },
      { id: 'e3', source: 'c1', target: 'a_no', sourceHandle: 'false', animated: true },
    ],
  },
  {
    id: 'form_submitted_instant',
    title: 'Form Submitted → Instant Welcome & Follow-Up',
    description: 'Starts right after a lead fills out a form, sends WhatsApp welcome, waits 2 hours, then emails guide.',
    nodes: [
      {
        id: 't_form',
        type: 'trigger',
        position: { x: 250, y: 50 },
        data: {
          nodeType: 'trigger_form_submission',
          label: 'Lead Fills Out a Form',
          formScope: 'all_list_forms',
        },
      },
      {
        id: 'a_wa',
        type: 'action',
        position: { x: 250, y: 230 },
        data: {
          nodeType: 'action_send_whatsapp',
          message: 'Hi {{first_name}}! Thanks for submitting the form. Here is your requested access link!',
        },
      },
      {
        id: 'd_wait',
        type: 'delay',
        position: { x: 250, y: 410 },
        data: { delayValue: 2, delayUnit: 'Hours' },
      },
      {
        id: 'a_email',
        type: 'action',
        position: { x: 250, y: 580 },
        data: {
          nodeType: 'action_send_email',
          message: 'Quick follow-up on your form submission — reply anytime if you want help getting started.',
        },
      },
    ],
    edges: [
      { id: 'ef1', source: 't_form', target: 'a_wa', animated: true },
      { id: 'ef2', source: 'a_wa', target: 'd_wait', animated: true },
      { id: 'ef3', source: 'd_wait', target: 'a_email', animated: true },
    ],
  },
];

function buildStarterGraphForList(listName: string): {
  nodes: FlowCustomNode[];
  edges: Edge[];
} {
  const safeList = listName || 'Selected List';
  return {
    nodes: [
      {
        id: 'node-trigger-1',
        type: 'trigger',
        position: { x: 300, y: 40 },
        data: {
          nodeType: 'trigger_whatsapp_reply',
          label: `Contact Joins "${safeList}"`,
        },
      },
      {
        id: 'node-delay-1',
        type: 'delay',
        position: { x: 300, y: 220 },
        data: {
          delayValue: 5,
          delayUnit: 'Minutes',
        },
      },
      {
        id: 'node-action-1',
        type: 'action',
        position: { x: 300, y: 400 },
        data: {
          nodeType: 'action_send_whatsapp',
          message: `Hi {{first_name}}! Welcome to ${safeList}. Reply DONE if you need anything.`,
        },
      },
    ],
    edges: [
      {
        id: 'e-1',
        source: 'node-trigger-1',
        target: 'node-delay-1',
        animated: true,
        style: { stroke: '#10b981', strokeWidth: 2 },
      },
      {
        id: 'e-2',
        source: 'node-delay-1',
        target: 'node-action-1',
        animated: true,
        style: { stroke: '#f59e0b', strokeWidth: 2 },
      },
    ],
  };
}

function rehydrateAutomationToCanvas(auto: Automation): {
  nodes: FlowCustomNode[];
  edges: Edge[];
} {
  if (auto.flowGraphJson) {
    try {
      const parsed = JSON.parse(auto.flowGraphJson);
      // Format A: React Flow graph ({ nodes, edges })
      if (
        parsed &&
        Array.isArray(parsed.nodes) &&
        Array.isArray(parsed.edges) &&
        parsed.nodes.length > 0 &&
        parsed.nodes[0].position
      ) {
        return {
          nodes: parsed.nodes as FlowCustomNode[],
          edges: parsed.edges.map((e: any) => ({
            ...e,
            animated: true,
            style: e.style || { stroke: '#2563eb', strokeWidth: 2 },
          })),
        };
      }

      // Format B: Legacy SerializedFlowGraph ({ nodes: WorkflowNode[] }) from older saved automations
      if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
        const legacyNodes = parsed.nodes as any[];
        const rfNodes: FlowCustomNode[] = [];
        const rfEdges: Edge[] = [];
        legacyNodes.forEach((ln, idx) => {
          const y = 40 + idx * 180;
          const x = ln.branchPath === 'no' ? 520 : ln.branchPath === 'yes' ? 120 : 300;
          const cat = ln.category;
          const id = ln.id || `legacy_${idx}`;

          if (cat === 'trigger') {
            const legacySubToNodeType: Record<string, WorkflowNodeType> = {
              form_submission: 'trigger_form_submission',
              list_joined: 'trigger_list_joined',
              contact_added: 'trigger_contact_added',
              tag_added: 'trigger_tag_added',
              tag_removed: 'trigger_tag_removed',
              purchase_completed: 'trigger_purchase_completed',
              link_clicked: 'trigger_link_clicked',
              email_opened: 'trigger_email_opened',
              webhook_received: 'trigger_webhook_received',
              specific_datetime: 'trigger_specific_datetime',
              whatsapp_keyword: 'trigger_keyword',
            };
            const mappedNodeType = legacySubToNodeType[ln.subType] || 'trigger_whatsapp_reply';
            rfNodes.push({
              id,
              type: 'trigger',
              position: { x, y },
              data: {
                nodeType: mappedNodeType,
                label: ln.title || auto.triggerDetail || 'Workflow Trigger',
                triggerKeyword: ln.config?.conditionValue || 'start',
                ...(mappedNodeType === 'trigger_form_submission'
                  ? { formScope: 'all_list_forms' }
                  : {}),
              },
            });
          } else if (cat === 'delay') {
            const rawUnit = String(ln.config?.waitDurationUnit || ln.config?.delayUnit || 'hours').toLowerCase();
            const unit: DelayUnit = rawUnit.includes('day')
              ? 'Days'
              : rawUnit.includes('min')
              ? 'Minutes'
              : 'Hours';
            rfNodes.push({
              id,
              type: 'delay',
              position: { x, y },
              data: {
                delayValue: ln.config?.waitDurationAmount || ln.config?.delayAmount || 1,
                delayUnit: unit,
              },
            });
          } else if (cat === 'condition') {
            rfNodes.push({
              id,
              type: 'condition',
              position: { x, y },
              data: {
                nodeType: 'condition_message_contains',
                keyword: ln.config?.conditionValue || 'yes',
              },
            });
          } else {
            const ch = ln.config?.channel;
            const nodeType: WorkflowNodeType =
              ln.subType === 'stop_workflow'
                ? 'action_end_flow'
                : ch === 'email' || ln.subType === 'send_email'
                ? 'action_send_email'
                : 'action_send_whatsapp';
            rfNodes.push({
              id,
              type: 'action',
              position: { x, y },
              data: {
                nodeType,
                message:
                  ln.config?.messagePreview ||
                  ln.subtitle ||
                  ln.title ||
                  'Automated follow-up message',
              },
            });
          }

          if (idx > 0) {
            rfEdges.push({
              id: `e-legacy-${idx}`,
              source: rfNodes[idx - 1].id,
              target: id,
              animated: true,
              style: { stroke: '#2563eb', strokeWidth: 2 },
            });
          }
        });
        if (rfNodes.length > 0) {
          return { nodes: rfNodes, edges: rfEdges };
        }
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback synthesis from Automation summary fields
  const triggerTypeToNodeMap: Record<string, WorkflowNodeType> = {
    form_submission: 'trigger_form_submission',
    list_joined: 'trigger_list_joined',
    contact_added: 'trigger_contact_added',
    tag_added: 'trigger_tag_added',
    tag_removed: 'trigger_tag_removed',
    purchase_completed: 'trigger_purchase_completed',
    link_clicked: 'trigger_link_clicked',
    email_opened: 'trigger_email_opened',
    webhook_received: 'trigger_webhook_received',
    specific_datetime: 'trigger_specific_datetime',
    whatsapp_keyword: 'trigger_keyword',
  };
  const fallbackNodeType = triggerTypeToNodeMap[auto.triggerType] || 'trigger_whatsapp_reply';

  const synthNodes: FlowCustomNode[] = [
    {
      id: 'node-trigger-1',
      type: 'trigger',
      position: { x: 300, y: 40 },
      data: {
        nodeType: fallbackNodeType,
        label: auto.triggerDetail || `List: ${auto.targetList || 'General Contacts'}`,
        ...(fallbackNodeType === 'trigger_form_submission'
          ? { formScope: 'all_list_forms' }
          : {}),
      },
    },
  ];
  const synthEdges: Edge[] = [];
  const steps = auto.stepsSummary && auto.stepsSummary.length > 0 ? auto.stepsSummary : ['Send Welcome Message'];
  const defaultActionType: WorkflowNodeType = (auto.channels || []).includes('email') && !(auto.channels || []).includes('whatsapp')
    ? 'action_send_email'
    : 'action_send_whatsapp';

  steps.forEach((stepText, idx) => {
    const id = `node-step-${idx + 1}`;
    const isWait = /wait|delay|hour|day|minute/i.test(stepText);
    synthNodes.push({
      id,
      type: isWait ? 'delay' : 'action',
      position: { x: 300, y: 220 + idx * 180 },
      data: isWait
        ? { delayValue: 2, delayUnit: 'Hours' }
        : { nodeType: defaultActionType, message: stepText },
    });
    synthEdges.push({
      id: `e-synth-${idx + 1}`,
      source: synthNodes[synthNodes.length - 2].id,
      target: id,
      animated: true,
      style: { stroke: '#2563eb', strokeWidth: 2 },
    });
  });

  return { nodes: synthNodes, edges: synthEdges };
}

function serializeCompactGraph(nodes: FlowCustomNode[], edges: Edge[]): string {
  const payload = JSON.stringify({
    v: 2,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      data: n.data,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
    })),
  });
  if (payload.length <= 14800) return payload;
  // Trim message previews slightly if a huge graph approaches the 15,000 char Firestore rule bound
  return JSON.stringify({
    v: 2,
    nodes: nodes.slice(0, 20).map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      data: {
        ...n.data,
        ...(typeof n.data?.message === 'string'
          ? { message: n.data.message.slice(0, 300) }
          : {}),
      },
    })),
    edges: edges.slice(0, 30).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
    })),
  }).slice(0, 14900);
}

// ============================================================================
// MAIN COMPONENT: AutomationBuilderUI (Unified Workflow Builder)
// ============================================================================

export interface AutomationBuilderUIProps {
  userId?: string;
  isAuthenticated?: boolean;
  cloudSyncState?: 'synced' | 'syncing' | 'local_only' | 'error';
  onOpenAuth?: () => void;
  initialWorkflowId?: string;
  automations: Automation[];
  lists: AudienceList[];
  contacts: Contact[];
  assets?: CaptureAsset[];
  preselectedListName?: string | null;
  onClearPreselectedList?: () => void;
  openCreateModalOnMount?: boolean;
  onClearCreateModalMount?: () => void;
  onCreateAutomation: (
    data: Omit<Automation, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    options?: { logAction?: 'saved_draft' | 'published' | 'silent' }
  ) => Promise<Automation>;
  onUpdateAutomation: (
    id: string,
    data: Omit<Automation, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    options?: { logAction?: 'saved_draft' | 'published' | 'silent' }
  ) => Promise<void>;
  onDeleteAutomation: (id: string) => Promise<void>;
  onCreateList: (
    data: Omit<AudienceList, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onNavigateToLists?: () => void;
  onBackToDashboard?: () => void;
  emailDomainStatus?: import('../utils/emailDomainValidation').EmailDomainStatusSummary | null;
  onNavigateToEmailSettings?: () => void;
  workspace?: Workspace;
  privateProfile?: UserPrivateProfile;
  onLogActivity?: (
    eventType: ActivityEventType,
    title: string,
    detail: string,
    channel: ActivityChannel
  ) => Promise<void>;
}

export const AutomationBuilderUI: React.FC<AutomationBuilderUIProps> = ({
  userId,
  isAuthenticated = false,
  cloudSyncState = 'local_only',
  onOpenAuth,
  automations = [],
  lists = [],
  contacts = [],
  assets = [],
  preselectedListName,
  onClearPreselectedList,
  openCreateModalOnMount,
  onClearCreateModalMount,
  onCreateAutomation,
  onUpdateAutomation,
  onDeleteAutomation,
  onCreateList,
  onNavigateToLists,
  onBackToDashboard,
  emailDomainStatus,
  onNavigateToEmailSettings,
  workspace,
  privateProfile,
  onLogActivity,
}) => {
  // Mode: 'list' (Saved Workflows Hub) or 'canvas' (Visual Drag-and-Drop Builder)
  const [viewMode, setViewMode] = useState<'list' | 'canvas'>('list');

  // Saved Workflows Hub Filters
  const [hubSearch, setHubSearch] = useState('');
  const [hubStatusFilter, setHubStatusFilter] = useState<'all' | 'active' | 'paused' | 'draft'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Create Workflow -> List Selection / Inline Creation Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'pick' | 'create_list'>('pick');
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [chosenListName, setChosenListName] = useState('');
  const [draftWorkflowName, setDraftWorkflowName] = useState('');
  const [newListName, setNewListName] = useState('');
  const [newListCategory, setNewListCategory] = useState<ListCategory>('lead_magnet');
  const [newListConsent, setNewListConsent] = useState<ConsentStatus>('opted_in');
  const [newListKillTag, setNewListKillTag] = useState('Purchased_Course');
  const [creatingListAndFlow, setCreatingListAndFlow] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Active Canvas Workflow Metadata
  const [editingAutomationId, setEditingAutomationId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState('New Drip Automation');
  const [targetList, setTargetList] = useState('General Contacts');
  const [workflowStatus, setWorkflowStatus] = useState<AutomationStatus>('draft');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const lastSavedKeyRef = useRef<string>('');
  const isInitialDraftCreatingRef = useRef<boolean>(false);

  // Sidebar & Inspector
  const [sidebarTab, setSidebarTab] = useState<'nodes' | 'blueprints'>('nodes');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedNode, setSelectedNode] = useState<FlowCustomNode | null>(null);

  // Email Editor Modal
  const [emailEditorModalOpen, setEmailEditorModalOpen] = useState(false);
  const [editingEmailNodeId, setEditingEmailNodeId] = useState<string | null>(null);
  const [emailEditorContent, setEmailEditorContent] = useState('');

  // Test Simulation Modal
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testLeadName, setTestLeadName] = useState('Alex Morgan');
  const [testPhone, setTestPhone] = useState('2348012345678');
  const [testEmail, setTestEmail] = useState('lead@example.com');
  const [testMessage, setTestMessage] = useState('Hey, what is the price for this service?');
  const [deliverLiveTest, setDeliverLiveTest] = useState(true);
  const [testResult, setTestResult] = useState<any>(null);
  const [isRunningTest, setIsRunningTest] = useState(false);

  const starterGraph = useMemo(() => buildStarterGraphForList('General Contacts'), []);
  const [nodes, setNodes, onNodesChange] = useNodesState(starterGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(starterGraph.edges);

  // Merge explicit AudienceLists + implicit contact listNames
  const combinedLists = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; category: string; count: number }
    >();
    lists.forEach((l) => {
      const key = l.name.trim().toLowerCase();
      map.set(key, {
        id: l.id,
        name: l.name,
        category: l.category || 'custom',
        count: 0,
      });
    });
    contacts.forEach((c) => {
      const listLabel = (c.listName || '').trim();
      if (!listLabel) return;
      const key = listLabel.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          id: `implicit_${key}`,
          name: listLabel,
          category: 'custom',
          count: 1,
        });
      }
    });
    if (map.size === 0) {
      map.set('general contacts', {
        id: 'default_general',
        name: 'General Contacts',
        category: 'newsletter',
        count: 0,
      });
    }
    return Array.from(map.values());
  }, [lists, contacts]);

  // Build Firestore-safe workflow payload from canvas state
  const buildWorkflowPayload = useCallback(
    (
      statusToSave: AutomationStatus,
      nameInput: string,
      listInput: string,
      nodesInput: FlowCustomNode[],
      edgesInput: Edge[],
      existingAuto?: Automation
    ): Omit<Automation, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'> => {
      const cleanName = sanitizeString(nameInput, 120, 'Untitled Workflow');
      const cleanList = sanitizeString(listInput, 80, 'General Contacts');

      const triggerNode =
        nodesInput.find(
          (n) => n.type === 'trigger' && edgesInput.some((e) => e.source === n.id)
        ) || nodesInput.find((n) => n.type === 'trigger');
      const triggerNodeType =
        (triggerNode?.data?.nodeType as WorkflowNodeType) || 'trigger_list_joined';
      const triggerMeta = getTriggerMeta(triggerNodeType);
      const triggerType: TriggerType = triggerMeta.firestoreTriggerType;

      let rawTriggerDetail = `List: ${cleanList}`;
      if (triggerNodeType === 'trigger_form_submission') {
        if (
          triggerNode?.data?.formScope === 'specific_form' &&
          triggerNode?.data?.targetFormTitle
        ) {
          rawTriggerDetail = `Form: ${triggerNode.data.targetFormTitle} · List: ${cleanList}`;
        } else {
          rawTriggerDetail = `Any Form on "${cleanList}"`;
        }
      } else if (
        triggerNodeType === 'trigger_keyword' &&
        triggerNode?.data?.triggerKeyword
      ) {
        rawTriggerDetail = `List: ${cleanList} · Keyword "${triggerNode.data.triggerKeyword}"`;
      } else if (
        (triggerNodeType === 'trigger_tag_added' ||
          triggerNodeType === 'trigger_tag_removed') &&
        triggerNode?.data?.tagName
      ) {
        rawTriggerDetail = `${triggerMeta.title}: "${triggerNode.data.tagName}" · List: ${cleanList}`;
      } else if (triggerNode?.data?.label) {
        rawTriggerDetail = `List: ${cleanList} · ${triggerNode.data.label}`;
      }

      const triggerDetail = sanitizeString(rawTriggerDetail, 120, `List: ${cleanList}`);

      const derivedSteps = nodesInput.map((n) => {
        if (n.type === 'trigger') {
          const m = getTriggerMeta(n.data?.nodeType);
          return sanitizeString(
            `Trigger: ${n.data?.label || m.defaultLabel}`,
            200,
            'Trigger'
          );
        }
        if (n.type === 'delay') {
          return sanitizeString(
            `Wait ${n.data?.delayValue || 5} ${n.data?.delayUnit || 'Minutes'}`,
            200,
            'Wait Delay'
          );
        }
        if (n.type === 'condition') {
          return sanitizeString(
            `If message contains "${n.data?.keyword || 'price'}"`,
            200,
            'Condition Check'
          );
        }
        if (n.data?.nodeType === 'action_send_email') {
          return sanitizeString(
            `Send Email: ${(n.data?.message || '').replace(/<[^>]+>/g, '').slice(0, 120) || 'Email reply'}`,
            200,
            'Send Email'
          );
        }
        if (n.data?.nodeType === 'action_end_flow' || n.data?.nodeType === 'action_end') {
          return 'End Workflow';
        }
        return sanitizeString(
          `Send WhatsApp: ${(n.data?.message || '').slice(0, 120) || 'WhatsApp reply'}`,
          200,
          'Send WhatsApp'
        );
      });

      const stepsSummary = sanitizeStringArray(
        derivedSteps.length > 0 ? derivedSteps : [`Trigger for ${cleanList}`],
        20,
        200
      );
      if (stepsSummary.length === 0) stepsSummary.push(`Trigger for ${cleanList}`);

      const channelSet = new Set<string>();
      nodesInput.forEach((n) => {
        if (
          n.data?.nodeType === 'action_send_email' ||
          n.data?.nodeType === 'trigger_email_reply' ||
          n.data?.nodeType === 'trigger_email_opened'
        ) {
          channelSet.add('email');
        } else if (
          n.data?.nodeType === 'action_send_whatsapp' ||
          n.data?.nodeType === 'trigger_whatsapp_reply' ||
          n.data?.nodeType === 'trigger_keyword'
        ) {
          channelSet.add('whatsapp');
        }
      });
      if (channelSet.size === 0) channelSet.add('whatsapp');
      const channels = Array.from(channelSet).slice(0, 5);

      const flowGraphJson = serializeCompactGraph(nodesInput, edgesInput);

      return {
        name: cleanName,
        triggerType,
        triggerDetail,
        targetList: cleanList,
        stepsSummary,
        channels,
        status: statusToSave,
        enrolledCount: existingAuto?.enrolledCount || 0,
        completedCount: existingAuto?.completedCount || 0,
        conversionRate: existingAuto?.conversionRate || 0,
        version: (existingAuto?.version || 0) + 1,
        flowGraphJson,
      };
    },
    []
  );

  // Immediately create & persist a brand-new Draft workflow when entering canvas
  const initializeNewDraftOnCanvas = useCallback(
    async (cleanList: string, customWorkflowName?: string, bannerNotice?: string) => {
      const starter = buildStarterGraphForList(cleanList);
      const resolvedName = customWorkflowName?.trim() || `${cleanList} Automation Flow`;
      const initialKey = JSON.stringify({
        name: resolvedName,
        targetList: cleanList,
        graph: serializeCompactGraph(starter.nodes, starter.edges),
      });

      lastSavedKeyRef.current = initialKey;
      setEditingAutomationId(null);
      setTargetList(cleanList);
      setWorkflowName(resolvedName);
      setWorkflowStatus('draft');
      setNodes(starter.nodes);
      setEdges(starter.edges);
      setSelectedNode(null);
      setSaveStatus('saving');
      setSaveBanner(bannerNotice || null);
      setViewMode('canvas');

      isInitialDraftCreatingRef.current = true;
      try {
        const draftPayload = buildWorkflowPayload(
          'draft',
          resolvedName,
          cleanList,
          starter.nodes,
          starter.edges
        );
        const created = await onCreateAutomation(draftPayload, { logAction: 'saved_draft' });
        setEditingAutomationId(created.id);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      } finally {
        isInitialDraftCreatingRef.current = false;
      }
    },
    [buildWorkflowPayload, onCreateAutomation, setEdges, setNodes]
  );

  // Launch Canvas directly as Draft if invoked via Segments & Lists / Forms preselectedListName
  useEffect(() => {
    if (preselectedListName && preselectedListName.trim()) {
      const cleanList = preselectedListName.trim();
      onClearPreselectedList?.();
      void initializeNewDraftOnCanvas(
        cleanList,
        `${cleanList} Automation Flow`,
        `Draft started for list "${cleanList}". Edit steps anytime and click Publish when ready.`
      );
    }
  }, [preselectedListName, onClearPreselectedList, initializeNewDraftOnCanvas]);

  // Open Create Workflow modal on mount if triggered from Dashboard/Header Quick Action
  useEffect(() => {
    if (openCreateModalOnMount) {
      onClearCreateModalMount?.();
      setModalMode(combinedLists.length > 0 ? 'pick' : 'create_list');
      setChosenListName(combinedLists[0]?.name || '');
      setDraftWorkflowName('');
      setModalError(null);
      setCreateModalOpen(true);
    }
  }, [openCreateModalOnMount, onClearCreateModalMount, combinedLists]);

  // Hub filtering & stats
  const filteredAutomations = useMemo(() => {
    const q = hubSearch.trim().toLowerCase();
    return automations.filter((a) => {
      if (hubStatusFilter !== 'all' && a.status !== hubStatusFilter) return false;
      if (!q) return true;
      const target = (a.targetList || a.targetListName || '').toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        target.includes(q) ||
        (a.triggerDetail || '').toLowerCase().includes(q) ||
        (a.channels || []).some((ch) => ch.toLowerCase().includes(q))
      );
    });
  }, [automations, hubSearch, hubStatusFilter]);

  const hubStats = useMemo(() => {
    const total = automations.length;
    const active = automations.filter((a) => a.status === 'active').length;
    const drafts = automations.filter((a) => a.status === 'draft').length;
    const paused = automations.filter((a) => a.status === 'paused').length;
    const enrolled = automations.reduce((s, a) => s + (a.enrolledCount || 0), 0);
    const avgConv =
      total > 0
        ? Math.round(
            automations.reduce((s, a) => s + (a.conversionRate || 0), 0) / total
          )
        : 0;
    return { total, active, drafts, paused, enrolled, avgConv };
  }, [automations]);

  // Open Create Workflow Modal
  const handleOpenCreateModal = () => {
    setModalMode(combinedLists.length > 0 ? 'pick' : 'create_list');
    setChosenListName(combinedLists[0]?.name || '');
    setDraftWorkflowName('');
    setNewListName('');
    setNewListCategory('lead_magnet');
    setNewListConsent('opted_in');
    setNewListKillTag('Purchased_Course');
    setListSearchQuery('');
    setModalError(null);
    setCreateModalOpen(true);
  };

  // Confirm Existing List Selection -> Create Draft & Enter Canvas
  const handleStartWithSelectedList = async () => {
    if (!chosenListName.trim()) {
      setModalError('Please choose a contact list first, or create a new list.');
      return;
    }
    const cleanList = chosenListName.trim();
    const customTitle = draftWorkflowName.trim();
    setCreateModalOpen(false);
    await initializeNewDraftOnCanvas(cleanList, customTitle);
  };

  // Create New List Inline -> Persist & Create Draft on Canvas
  const handleCreateNewListAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeString(newListName, 100, '');
    if (!cleanName) {
      setModalError('Enter a name for the new contact list.');
      return;
    }
    setModalError(null);
    setCreatingListAndFlow(true);
    try {
      const killTags = sanitizeStringArray(newListKillTag.split(','), 10, 32);
      await onCreateList({
        name: cleanName,
        description: `Audience list created from Workflow Builder for automated sequences.`,
        category: newListCategory,
        defaultConsent: newListConsent,
        defaultTags: [],
        colorAccent: 'emerald',
        killSwitchEnabled: killTags.length > 0,
        killSwitchTags: killTags.length > 0 ? killTags : ['Purchased_Course'],
      });
      const customTitle = draftWorkflowName.trim();
      setCreateModalOpen(false);
      await initializeNewDraftOnCanvas(
        cleanName,
        customTitle,
        `Created list "${cleanName}" and saved initial workflow draft.`
      );
    } finally {
      setCreatingListAndFlow(false);
    }
  };

  // Open an existing saved automation in Canvas
  const handleOpenSavedWorkflow = (auto: Automation) => {
    const resolvedList =
      auto.targetList ||
      auto.targetListName ||
      combinedLists[0]?.name ||
      'General Contacts';
    const rehydrated = rehydrateAutomationToCanvas(auto);
    const loadedStatus: AutomationStatus =
      auto.status === 'active'
        ? 'active'
        : auto.status === 'paused'
        ? 'paused'
        : 'draft';

    lastSavedKeyRef.current = JSON.stringify({
      name: auto.name,
      targetList: resolvedList,
      graph: serializeCompactGraph(rehydrated.nodes, rehydrated.edges),
    });

    setEditingAutomationId(auto.id);
    setWorkflowName(auto.name);
    setTargetList(resolvedList);
    setWorkflowStatus(loadedStatus);
    setNodes(rehydrated.nodes);
    setEdges(rehydrated.edges);
    setSelectedNode(null);
    setSaveBanner(null);
    setSaveStatus('saved');
    setViewMode('canvas');
  };

  // Publish or Toggle Active / Paused directly from Saved Workflows Hub
  const handleHubStatusChange = async (
    auto: Automation,
    nextStatus: AutomationStatus,
    logAction: 'published' | 'saved_draft' | 'silent'
  ) => {
    await onUpdateAutomation(
      auto.id,
      {
        name: auto.name,
        triggerType: auto.triggerType,
        triggerDetail: auto.triggerDetail,
        targetList: auto.targetList || auto.targetListName || 'General Contacts',
        stepsSummary:
          auto.stepsSummary && auto.stepsSummary.length > 0
            ? auto.stepsSummary
            : ['Automated workflow sequence'],
        channels:
          auto.channels && auto.channels.length > 0 ? auto.channels : ['whatsapp'],
        status: nextStatus,
        enrolledCount: auto.enrolledCount || 0,
        completedCount: auto.completedCount || 0,
        conversionRate: auto.conversionRate || 0,
        version: (auto.version || 0) + 1,
        ...(auto.flowGraphJson ? { flowGraphJson: auto.flowGraphJson } : {}),
      },
      { logAction }
    );
  };

  // Canvas Connect Handler
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: '#2563eb', strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node as FlowCustomNode);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleAddNode = useCallback(
    (nodeType: WorkflowNodeType, label?: string) => {
      const id = `node-${Date.now().toString(36)}`;
      const position = {
        x: 250 + Math.random() * 80,
        y: 120 + nodes.length * 90,
      };

      let category: 'trigger' | 'condition' | 'action' | 'delay' = 'action';
      const data: Record<string, any> = { nodeType, label };

      if (nodeType.startsWith('trigger')) {
        category = 'trigger';
        const meta = getTriggerMeta(nodeType);
        data.label = label || meta.defaultLabel;
        if (nodeType === 'trigger_keyword') data.triggerKeyword = 'price';
        if (nodeType === 'trigger_form_submission') {
          data.formScope = 'all_list_forms';
        }
        if (nodeType === 'trigger_tag_added' || nodeType === 'trigger_tag_removed') {
          data.tagName = 'VIP_Lead';
        }
      } else if (nodeType.startsWith('condition')) {
        category = 'condition';
        data.keyword = 'price';
      } else if (nodeType === 'delay_wait') {
        category = 'delay';
        data.delayValue = 30;
        data.delayUnit = 'Minutes';
      } else {
        category = 'action';
        data.message = 'Hello! Thank you for reaching out.';
      }

      const newNode: FlowCustomNode = {
        id,
        type: category,
        position,
        data,
      };

      setNodes((nds) => [...nds, newNode]);
      setSelectedNode(newNode);
    },
    [nodes.length, setNodes]
  );

  const handleLoadBlueprint = useCallback(
    (blueprint: (typeof WORKFLOW_BLUEPRINTS)[0]) => {
      setWorkflowName(`${targetList} — ${blueprint.title}`);
      setNodes(blueprint.nodes as any);
      setEdges(
        blueprint.edges.map((e) => ({
          ...e,
          style: { stroke: '#2563eb', strokeWidth: 2 },
        }))
      );
      setSelectedNode(null);
      setSaveBanner(`Loaded blueprint "${blueprint.title}" for list "${targetList}".`);
      setTimeout(() => setSaveBanner(null), 3500);
    },
    [setNodes, setEdges, targetList]
  );

  const handleUpdateNodeFields = useCallback(
    (patch: Record<string, any>) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === selectedNode.id) {
            const updated = {
              ...n,
              data: {
                ...n.data,
                ...patch,
              },
            };
            setSelectedNode(updated as FlowCustomNode);
            return updated;
          }
          return n;
        })
      );
    },
    [selectedNode, setNodes]
  );

  const handleUpdateNodeData = useCallback(
    (field: string, val: any) => {
      handleUpdateNodeFields({ [field]: val });
    },
    [handleUpdateNodeFields]
  );

  const handleDeleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      if (selectedNode?.id === id) {
        setSelectedNode(null);
      }
    },
    [selectedNode, setNodes, setEdges]
  );

  // Stable dirty-check key excluding transient ReactFlow selection/measurement flags
  const currentGraphKey = useMemo(() => {
    if (viewMode !== 'canvas') return '';
    return JSON.stringify({
      name: workflowName,
      targetList,
      graph: serializeCompactGraph(nodes, edges),
    });
  }, [viewMode, workflowName, targetList, nodes, edges]);

  // Unified Persist Handler (Auto-save draft, Explicit Save Draft, Explicit Publish)
  const persistWorkflow = useCallback(
    async (opts: {
      targetStatus: AutomationStatus;
      logAction: 'saved_draft' | 'published' | 'silent';
      showBanner?: boolean;
    }) => {
      setIsSaving(true);
      setSaveStatus('saving');
      if (opts.showBanner) setSaveBanner(null);

      try {
        const existingAuto = editingAutomationId
          ? automations.find((a) => a.id === editingAutomationId)
          : undefined;
        const payload = buildWorkflowPayload(
          opts.targetStatus,
          workflowName,
          targetList,
          nodes,
          edges,
          existingAuto
        );

        lastSavedKeyRef.current = JSON.stringify({
          name: workflowName,
          targetList,
          graph: serializeCompactGraph(nodes, edges),
        });

        setWorkflowStatus(opts.targetStatus);

        if (existingAuto || editingAutomationId) {
          const targetId = existingAuto?.id || editingAutomationId!;
          await onUpdateAutomation(targetId, payload, { logAction: opts.logAction });
        } else {
          const created = await onCreateAutomation(payload, {
            logAction: opts.logAction,
          });
          setEditingAutomationId(created.id);
        }

        setSaveStatus('saved');

        if (opts.showBanner) {
          if (opts.targetStatus === 'active') {
            setSaveBanner(
              isAuthenticated
                ? `Published "${payload.name}" — workflow is live & synced across all your devices.`
                : `Published "${payload.name}" locally. Sign in to sync live across mobile & desktop.`
            );
          } else {
            setSaveBanner(
              isAuthenticated
                ? `Saved draft "${payload.name}" to cloud database.`
                : `Saved draft "${payload.name}" locally. Sign in to sync across devices.`
            );
          }
          setTimeout(() => setSaveBanner(null), 4000);
        }
      } catch {
        setSaveStatus('error');
      } finally {
        setIsSaving(false);
      }
    },
    [
      automations,
      buildWorkflowPayload,
      edges,
      editingAutomationId,
      isAuthenticated,
      nodes,
      onCreateAutomation,
      onUpdateAutomation,
      targetList,
      workflowName,
    ]
  );

  // Debounced auto-save draft (1200ms after edits while in Canvas view)
  useEffect(() => {
    if (viewMode !== 'canvas') return;
    if (!currentGraphKey || currentGraphKey === lastSavedKeyRef.current) return;
    if (isInitialDraftCreatingRef.current) return;

    setSaveStatus('dirty');
    const timer = setTimeout(() => {
      if (isInitialDraftCreatingRef.current) return;
      const autoSaveStatus: AutomationStatus =
        workflowStatus === 'active'
          ? 'active'
          : workflowStatus === 'paused'
          ? 'paused'
          : 'draft';
      void persistWorkflow({
        targetStatus: autoSaveStatus,
        logAction: 'silent',
        showBanner: false,
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [currentGraphKey, persistWorkflow, viewMode, workflowStatus]);

  const handleSaveDraftClick = () => {
    void persistWorkflow({
      targetStatus: 'draft',
      logAction: 'saved_draft',
      showBanner: true,
    });
  };

  const handlePublishClick = () => {
    void persistWorkflow({
      targetStatus: 'active',
      logAction: 'published',
      showBanner: true,
    });
  };

  const handleReturnToHub = async () => {
    if (
      viewMode === 'canvas' &&
      currentGraphKey &&
      currentGraphKey !== lastSavedKeyRef.current &&
      !isInitialDraftCreatingRef.current
    ) {
      await persistWorkflow({
        targetStatus:
          workflowStatus === 'active'
            ? 'active'
            : workflowStatus === 'paused'
            ? 'paused'
            : 'draft',
        logAction: 'silent',
        showBanner: false,
      });
    }
    setSelectedNode(null);
    setViewMode('list');
  };

  // Rich Email Editor helpers
  const handleOpenRichEmailEditor = (nodeId: string, currentText: string) => {
    setEditingEmailNodeId(nodeId);
    setEmailEditorContent(currentText);
    setEmailEditorModalOpen(true);
  };

  const handleSaveRichEmail = (html: string) => {
    if (editingEmailNodeId) {
      handleUpdateNodeData('message', html);
    }
    setEmailEditorModalOpen(false);
    setEditingEmailNodeId(null);
  };

  // Workflow Execution Simulator + Live Channel Dispatch
  const handleExecuteTest = async () => {
    setIsRunningTest(true);
    setTestResult(null);
    try {
      const result = await executeClientWorkflowGraph({
        automationName: workflowName,
        automationId: editingAutomationId || undefined,
        nodes,
        edges,
        inboundText: testMessage,
        bypassKeywordTriggerCheck: false,
        deliverLive: deliverLiveTest,
        lead: {
          fullName: testLeadName.trim() || 'Alex Morgan',
          email: testEmail.trim(),
          phone: testPhone.trim(),
          listName: targetList,
        },
        workspace,
        privateProfile,
        userId,
      });

      if (deliverLiveTest && result.receipts.length > 0 && onLogActivity) {
        for (const r of result.receipts) {
          await onLogActivity(
            'automation_triggered',
            r.status === 'failed'
              ? `Workflow Test Blocked (${r.channel.toUpperCase()}): ${workflowName}`
              : `Workflow Test Dispatched (${r.channel.toUpperCase()}): ${workflowName}`,
            r.detailMessage || r.bodyPreview,
            r.channel
          );
        }
      }

      setTestResult({
        ok: result.executed,
        reason: result.reason,
        workflow: workflowName,
        targetList,
        liveDeliveryEnabled: deliverLiveTest,
        stepsExecuted: result.stepsExecuted,
        trace: result.trace,
        receipts: result.receipts.map((r) => ({
          channel: r.channel,
          status: r.status,
          to: r.toRecipient,
          provider: r.providerUsed,
          detail: r.detailMessage,
        })),
      });
    } finally {
      setIsRunningTest(false);
    }
  };

  // ============================================================================
  // SHARED MODAL: CHOOSE EXISTING LIST OR CREATE NEW LIST
  // ============================================================================
  const filteredModalLists = useMemo(() => {
    const q = listSearchQuery.trim().toLowerCase();
    if (!q) return combinedLists;
    return combinedLists.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q)
    );
  }, [combinedLists, listSearchQuery]);

  const renderCreateWorkflowModal = () => {
    if (!createModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Select Audience List for New Workflow
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Choose an existing contact list or create a new list to automate.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Segmented Switcher */}
          <div className="px-6 pt-4">
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setModalMode('pick');
                  setModalError(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  modalMode === 'pick'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Choose Existing List ({combinedLists.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalMode('create_list');
                  setModalError(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-1.5 ${
                  modalMode === 'create_list'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Create New List</span>
              </button>
            </div>
          </div>

          {modalError && (
            <div className="mx-6 mt-3 px-3.5 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
              {modalError}
            </div>
          )}

          {modalMode === 'pick' ? (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Search &amp; Pick Target Contact List *
                </label>
                <div className="relative mb-2.5">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={listSearchQuery}
                    onChange={(e) => setListSearchQuery(e.target.value)}
                    placeholder="Filter lists by name..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredModalLists.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No matching lists found. Switch to Create New List above.
                    </div>
                  ) : (
                    filteredModalLists.map((lst) => {
                      const isSelected = chosenListName === lst.name;
                      return (
                        <button
                          key={lst.id}
                          type="button"
                          onClick={() => setChosenListName(lst.name)}
                          className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-950/40'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {lst.name}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {lst.category.replace('_', ' ')} ·{' '}
                              <span className="tabular-nums font-medium">{lst.count}</span> contacts
                            </p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Workflow Name (optional)
                </label>
                <input
                  type="text"
                  value={draftWorkflowName}
                  onChange={(e) => setDraftWorkflowName(e.target.value)}
                  placeholder={
                    chosenListName
                      ? `${chosenListName} Automation Flow`
                      : 'e.g. Welcome Drip Sequence'
                  }
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartWithSelectedList}
                  disabled={!chosenListName.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span>Build Workflow for List</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateNewListAndStart} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  New List Name *
                </label>
                <input
                  type="text"
                  required
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. Webinar Registrants May"
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    List Category
                  </label>
                  <select
                    value={newListCategory}
                    onChange={(e) => setNewListCategory(e.target.value as ListCategory)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="lead_magnet">Lead Magnet Funnel</option>
                    <option value="newsletter">Newsletter Subscribers</option>
                    <option value="vip_buyers">VIP Buyers &amp; Clients</option>
                    <option value="webinar">Webinar / Live Event</option>
                    <option value="custom">Custom Segment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Default Consent
                  </label>
                  <select
                    value={newListConsent}
                    onChange={(e) => setNewListConsent(e.target.value as ConsentStatus)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="opted_in">Verified Opt-In</option>
                    <option value="pending_double_opt_in">Pending Double Opt-In</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Kill Switch Tag (optional)
                  </label>
                  <input
                    type="text"
                    value={newListKillTag}
                    onChange={(e) => setNewListKillTag(e.target.value)}
                    placeholder="Purchased_Course"
                    className="w-full px-3.5 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Workflow Name (optional)
                  </label>
                  <input
                    type="text"
                    value={draftWorkflowName}
                    onChange={(e) => setDraftWorkflowName(e.target.value)}
                    placeholder={
                      newListName.trim()
                        ? `${newListName.trim()} Automation Flow`
                        : 'Auto-named from list'
                    }
                    className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingListAndFlow || !newListName.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] disabled:opacity-50 rounded-xl cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>
                    {creatingListAndFlow
                      ? 'Creating List...'
                      : 'Create List & Build Workflow'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // VIEW 1: SAVED WORKFLOWS HUB
  // ============================================================================
  if (viewMode === 'list') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Workflow Builder
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Build and manage automated WhatsApp and Email sequences. New workflows auto-save as Drafts until you publish.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {onNavigateToLists && (
              <button
                type="button"
                onClick={onNavigateToLists}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>Segments &amp; Lists</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer inline-flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create Workflow</span>
            </button>
          </div>
        </div>

        {/* Cross-Device Cloud Sync Notice when Signed Out */}
        {!isAuthenticated && (
          <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <CloudOff className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                You are currently working in local preview mode. Sign in so your drafts, published workflows, and activity sync across phone and desktop.
              </span>
            </div>
            {onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In to Sync</span>
              </button>
            )}
          </div>
        )}

        {/* Metrics Strip (Single-Elevation, Tabular Numerals) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Saved Workflows
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {hubStats.total}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Published &amp; Live
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              {hubStats.active}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Saved Drafts
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {hubStats.drafts}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Enrolled
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {hubStats.enrolled.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Search & Segmented Status Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={hubSearch}
              onChange={(e) => setHubSearch(e.target.value)}
              placeholder="Search workflows by name, list, or channel..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 self-start sm:self-auto">
            {(
              [
                { key: 'all', label: `All (${hubStats.total})` },
                { key: 'active', label: `Live (${hubStats.active})` },
                { key: 'draft', label: `Drafts (${hubStats.drafts})` },
                { key: 'paused', label: `Paused (${hubStats.paused})` },
              ] as const
            ).map((tab) => {
              const active = hubStatusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setHubStatusFilter(tab.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                    active
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Saved Workflows List */}
        {filteredAutomations.length === 0 ? (
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#0D1322] p-10 text-center">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Split className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {automations.length === 0
                ? 'No Workflows Created Yet'
                : 'No Matching Workflows'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-5">
              {automations.length === 0
                ? 'Create your first visual automation workflow and choose the contact list it belongs to.'
                : 'Adjust your search term or status filter, or create a new workflow.'}
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Create Workflow</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAutomations.map((auto) => {
              const target =
                auto.targetList || auto.targetListName || 'General Contacts';
              const isActive = auto.status === 'active';
              const isPaused = auto.status === 'paused';
              const isDraft = auto.status === 'draft';
              const channelLabel =
                (auto.channels || ['whatsapp']).join(', ') || 'whatsapp';
              const stepsCount = auto.stepsSummary?.length || 1;

              return (
                <div
                  key={auto.id}
                  className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#0D1322] p-5 flex flex-col justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                          {auto.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            List: {target}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{channelLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{stepsCount} steps</span>
                        </p>
                      </div>

                      <span
                        className={`text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 ${
                          isActive
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : isPaused
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isActive ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : isPaused ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <FileText className="w-3.5 h-3.5" />
                        )}
                        <span>{isActive ? 'Published' : isPaused ? 'Paused' : 'Draft'}</span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                      {auto.triggerDetail || 'Triggered when contact joins list'}
                    </p>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                      <span>
                        <strong className="text-slate-900 dark:text-white font-semibold">
                          {(auto.enrolledCount || 0).toLocaleString()}
                        </strong>{' '}
                        enrolled
                      </span>
                      <span>
                        <strong className="text-slate-900 dark:text-white font-semibold">
                          {(auto.completedCount || 0).toLocaleString()}
                        </strong>{' '}
                        completed
                      </span>
                      <span>
                        <strong className="text-slate-900 dark:text-white font-semibold">
                          {auto.conversionRate || 0}%
                        </strong>{' '}
                        conversion
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleOpenSavedWorkflow(auto)}
                      className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 rounded-lg cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <span>Open Canvas</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1.5">
                      {isDraft ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleHubStatusChange(auto, 'active', 'published')
                          }
                          className="px-3 py-2 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Publish</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleHubStatusChange(
                              auto,
                              isActive ? 'paused' : 'active',
                              isActive ? 'saved_draft' : 'published'
                            )
                          }
                          className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          {isActive ? 'Pause' : 'Publish Live'}
                        </button>
                      )}

                      {confirmDeleteId === auto.id ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteAutomation(auto.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-3 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          Confirm Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(auto.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                          title="Delete workflow"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {onBackToDashboard && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onBackToDashboard}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Command Center</span>
            </button>
          </div>
        )}

        {renderCreateWorkflowModal()}
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: VISUAL DRAG-AND-DROP WORKFLOW CANVAS
  // ============================================================================
  const syncStatusLabel = (() => {
    if (saveStatus === 'saving') return 'Saving draft…';
    if (saveStatus === 'dirty') return 'Unsaved changes…';
    if (saveStatus === 'error') return 'Sync error · Saved locally';
    if (workflowStatus === 'active') {
      return isAuthenticated && cloudSyncState === 'synced'
        ? 'Published · Cloud synced'
        : 'Published · Live';
    }
    if (workflowStatus === 'paused') return 'Paused';
    return isAuthenticated
      ? 'Draft · Auto-saved'
      : 'Local draft · Sign in to sync';
  })();

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] min-h-[640px] bg-[#f8fafc] text-slate-900 font-sans antialiased overflow-hidden">
      {/* TOP BAR */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 z-20 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => void handleReturnToHub()}
            className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="Back to Saved Workflows"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Workflows</span>
          </button>

          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 font-medium shrink-0">
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span>List:</span>
          </div>

          {/* Target List Selector */}
          <select
            value={targetList}
            onChange={(e) => setTargetList(e.target.value)}
            className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 max-w-[160px] truncate cursor-pointer"
            title="Target Contact List"
          >
            {!combinedLists.some((l) => l.name === targetList) && targetList && (
              <option value={targetList}>{targetList}</option>
            )}
            {combinedLists.map((l) => (
              <option key={l.id} value={l.name}>
                {l.name}
              </option>
            ))}
          </select>

          <div className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:block" />

          {/* Workflow Name Input */}
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="text-sm font-bold text-slate-900 bg-transparent hover:bg-slate-50 focus:bg-white px-2.5 py-1 rounded-lg border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-all w-36 sm:w-56 truncate"
            placeholder="Workflow Name..."
          />
        </div>

        {/* Right Controls: Sync State + Simulate + Save Draft + Publish */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden xl:flex items-center gap-1.5 text-xs font-medium text-slate-500 pr-1 whitespace-nowrap">
            {isAuthenticated ? (
              <Cloud
                className={`w-3.5 h-3.5 ${
                  workflowStatus === 'active'
                    ? 'text-emerald-600'
                    : saveStatus === 'error'
                    ? 'text-rose-500'
                    : 'text-slate-400'
                }`}
              />
            ) : (
              <CloudOff className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span
              className={
                workflowStatus === 'active'
                  ? 'text-emerald-700 font-semibold'
                  : saveStatus === 'error'
                  ? 'text-rose-600 font-semibold'
                  : 'text-slate-600'
              }
            >
              {syncStatusLabel}
            </span>
            {!isAuthenticated && onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="ml-1 text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setTestModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Simulate</span>
          </button>

          <button
            type="button"
            onClick={handleSaveDraftClick}
            disabled={isSaving}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            title="Save changes as Draft without making live"
          >
            <Save className="w-3.5 h-3.5 text-slate-600" />
            <span>{isSaving && workflowStatus === 'draft' ? 'Saving...' : 'Save Draft'}</span>
          </button>

          <button
            type="button"
            onClick={handlePublishClick}
            disabled={isSaving}
            className={`px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 ${
              workflowStatus === 'active'
                ? 'bg-[#047857] hover:bg-[#065F46]'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            title="Publish workflow live and sync to database"
          >
            {isSaving && workflowStatus === 'active' ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <UploadCloud className="w-3.5 h-3.5" />
            )}
            <span>{workflowStatus === 'active' ? 'Update Live' : 'Publish'}</span>
          </button>
        </div>
      </header>

      {saveBanner && (
        <div className="bg-emerald-600 text-white px-6 py-2 text-xs font-semibold flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{saveBanner}</span>
          </div>
          <button type="button" onClick={() => setSaveBanner(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5 text-emerald-200 hover:text-white" />
          </button>
        </div>
      )}

      {/* WORKSPACE BODY */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* LEFT SIDEBAR: Node Blocks & Blueprints */}
        <aside
          className={`bg-white border-r border-slate-200 transition-all duration-300 z-10 flex flex-col shrink-0 ${
            sidebarOpen ? 'w-72' : 'w-12'
          }`}
        >
          <div className="h-12 border-b border-slate-200 px-3 flex items-center justify-between">
            {sidebarOpen ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSidebarTab('nodes')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    sidebarTab === 'nodes'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Node Blocks
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('blueprints')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    sidebarTab === 'blueprints'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Blueprints
                </button>
              </div>
            ) : (
              <div className="w-full flex justify-center">
                <Layers className="w-4 h-4 text-slate-500" />
              </div>
            )}

            <button
              type="button"
              onClick={() => setSidebarOpen((p) => !p)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              title={sidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {sidebarOpen && (
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {sidebarTab === 'nodes' ? (
                <>
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      1. Entry Triggers
                    </span>
                    <div className="space-y-1.5">
                      {TRIGGER_CATALOG.map((trig) => {
                        const isPrimaryForm = trig.nodeType === 'trigger_form_submission';
                        return (
                          <button
                            key={trig.nodeType}
                            type="button"
                            onClick={() =>
                              handleAddNode(
                                trig.nodeType,
                                trig.nodeType === 'trigger_list_joined' ||
                                  trig.nodeType === 'trigger_whatsapp_reply'
                                  ? `Contact Joins "${targetList}"`
                                  : trig.defaultLabel
                              )
                            }
                            className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer group ${
                              isPrimaryForm
                                ? 'border-emerald-300 bg-emerald-50/40 hover:border-emerald-500 hover:bg-emerald-50'
                                : 'border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/40'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                {renderTriggerIcon(trig.nodeType, 'w-3.5 h-3.5')}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 truncate">
                                  {trig.title}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {trig.subtitle}
                                </div>
                              </div>
                            </div>
                            <Plus className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      2. Smart Branching
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleAddNode('condition_message_contains', 'Message Contains')
                      }
                      className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-indigo-500 bg-white hover:bg-indigo-50/40 text-left transition-all flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                          <Split className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">
                            Message Contains
                          </div>
                          <div className="text-[10px] text-slate-500">Branch Yes / No</div>
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-slate-300 group-hover:text-indigo-600" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      3. Drip &amp; Wait Timers
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddNode('delay_wait', 'Delay Node')}
                      className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-amber-500 bg-white hover:bg-amber-50/40 text-left transition-all flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-bold text-slate-900 group-hover:text-amber-700">
                            Wait / Delay Node
                          </div>
                          <div className="text-[10px] text-slate-500">Minutes, Hours, Days</div>
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-slate-300 group-hover:text-amber-600" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      4. Outbound Actions
                    </span>
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleAddNode('action_send_whatsapp', 'Send WhatsApp Message')
                        }
                        className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 bg-white hover:bg-blue-50/40 text-left transition-all flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                              Send WhatsApp
                            </div>
                            <div className="text-[10px] text-slate-500">Automated WhatsApp step</div>
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-slate-300 group-hover:text-blue-600" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddNode('action_send_email', 'Send Rich Email')}
                        className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 bg-white hover:bg-blue-50/40 text-left transition-all flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                            <Mail className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">
                              Send Email
                            </div>
                            <div className="text-[10px] text-slate-500">With rich formatting</div>
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-slate-300 group-hover:text-indigo-600" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddNode('action_end_flow', 'End Flow')}
                        className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-slate-500 bg-white hover:bg-slate-50 text-left transition-all flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-900">End Flow</div>
                            <div className="text-[10px] text-slate-500">Stop sequence</div>
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-slate-300" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500">
                    Load a ready-to-customize automation template:
                  </div>
                  {WORKFLOW_BLUEPRINTS.map((bp) => (
                    <div
                      key={bp.id}
                      className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 space-y-2 transition-all"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-semibold text-blue-700">Template</span>
                        <span className="font-mono tabular-nums">{bp.nodes.length} nodes</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">{bp.title}</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {bp.description}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleLoadBlueprint(bp)}
                        className="w-full mt-1 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        <span>Load Blueprint</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* CENTER: React Flow Canvas */}
        <main className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-[#f8fafc]"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={18}
              size={1.2}
              color="#cbd5e1"
            />
            <Controls className="!bg-white !border !border-slate-200 !shadow-md !rounded-xl !overflow-hidden" />
            <MiniMap
              className="!bg-white !border !border-slate-200 !shadow-md !rounded-xl !overflow-hidden"
              nodeColor={(n) => {
                if (n.type === 'trigger') return '#10b981';
                if (n.type === 'condition') return '#6366f1';
                if (n.type === 'delay') return '#f59e0b';
                return '#2563eb';
              }}
            />
          </ReactFlow>

          {/* Floating Legend */}
          <div className="absolute top-4 left-4 z-10 bg-white/95 border border-slate-200 rounded-xl px-3 py-2 shadow-xs hidden md:flex items-center gap-3 text-xs font-medium text-slate-600">
            <span className="text-emerald-700 font-semibold">Trigger</span>
            <span aria-hidden="true">·</span>
            <span className="text-indigo-700 font-semibold">Condition</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-700 font-semibold">Delay</span>
            <span aria-hidden="true">·</span>
            <span className="text-blue-700 font-semibold">Action</span>
          </div>
        </main>

        {/* RIGHT INSPECTOR */}
        {selectedNode ? (
          <aside className="w-80 sm:w-96 bg-white border-l border-slate-200 shadow-lg z-20 flex flex-col shrink-0">
            <div className="h-14 border-b border-slate-200 px-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Node Configuration
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                  title="Delete this node"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Node ID:</span>
                  <span className="font-mono text-[11px] font-bold text-slate-700">
                    {selectedNode.id}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Category:</span>
                  <span className="font-bold text-blue-600 capitalize">{selectedNode.type}</span>
                </div>
              </div>

              {selectedNode.type === 'delay' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-900 text-sm">Drip Delay Interval</h4>
                    <p className="text-[11px] text-slate-500">
                      Configure how long the contact waits before the next step.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      Delay Value *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={selectedNode.data.delayValue || 5}
                      onChange={(e) =>
                        handleUpdateNodeData('delayValue', parseInt(e.target.value, 10) || 1)
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      Time Unit *
                    </label>
                    <select
                      value={selectedNode.data.delayUnit || 'Minutes'}
                      onChange={(e) =>
                        handleUpdateNodeData('delayUnit', e.target.value as DelayUnit)
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Minutes">Minutes</option>
                      <option value="Hours">Hours</option>
                      <option value="Days">Days</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedNode.type === 'condition' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-900 text-sm">
                      Message Keyword Condition
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Evaluates inbound text and splits execution Yes / No.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      Required Keyword *
                    </label>
                    <input
                      type="text"
                      value={selectedNode.data.keyword || ''}
                      onChange={(e) => handleUpdateNodeData('keyword', e.target.value)}
                      placeholder="e.g. price, yes, info"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {selectedNode.type === 'action' &&
                selectedNode.data.nodeType !== 'action_end' &&
                selectedNode.data.nodeType !== 'action_end_flow' && (
                  <div className="space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                      <h4 className="font-bold text-slate-900 text-sm">
                        Message Content &amp; Channel
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Write your reply or open the Rich Email Editor.
                      </p>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">
                        Channel Type
                      </label>
                      <select
                        value={selectedNode.data.nodeType}
                        onChange={(e) => handleUpdateNodeData('nodeType', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold"
                      >
                        <option value="action_send_whatsapp">WhatsApp Message</option>
                        <option value="action_send_email">Email Marketing</option>
                      </select>
                    </div>

                    {selectedNode.data.nodeType === 'action_send_email' && (
                      <div
                        className={`p-3 rounded-xl border space-y-2 ${
                          emailDomainStatus?.verified
                            ? 'bg-emerald-50/70 border-emerald-200/80'
                            : 'bg-amber-50/80 border-amber-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            Custom Domain Sender
                          </span>
                          <span
                            className={`text-[11px] font-bold ${
                              emailDomainStatus?.verified
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {emailDomainStatus?.verified
                              ? 'Verified'
                              : emailDomainStatus?.domain
                              ? 'Pending DNS'
                              : 'Not Connected'}
                          </span>
                        </div>

                        {emailDomainStatus?.sender ? (
                          <p className="text-[11px] font-mono text-slate-700 break-all">
                            {emailDomainStatus.sender.fromName} &lt;
                            {emailDomainStatus.sender.fromEmail}&gt;
                          </p>
                        ) : (
                          <p className="text-[11px] text-amber-900">
                            Automated workflow emails are blocked until you connect and verify your
                            custom domain.
                          </p>
                        )}

                        {!emailDomainStatus?.verified && onNavigateToEmailSettings && (
                          <button
                            type="button"
                            onClick={onNavigateToEmailSettings}
                            className="w-full py-1.5 px-3 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                          >
                            {emailDomainStatus?.domain
                              ? 'Complete DNS Verification'
                              : 'Connect Custom Email Domain'}
                          </button>
                        )}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-bold text-slate-700">Message Body</label>
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenRichEmailEditor(
                              selectedNode.id,
                              selectedNode.data.message || ''
                            )
                          }
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          <span>Rich Editor</span>
                        </button>
                      </div>

                      <textarea
                        rows={5}
                        value={selectedNode.data.message || ''}
                        onChange={(e) => handleUpdateNodeData('message', e.target.value)}
                        placeholder="Type your message... supports {{first_name}}, {{company}}"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-sans text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-500">
                        Insert Token:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {['{{first_name}}', '{{company}}', '{{phone}}'].map((tok) => (
                          <button
                            key={tok}
                            type="button"
                            onClick={() => {
                              const cur = selectedNode.data.message || '';
                              handleUpdateNodeData('message', `${cur} ${tok}`.trim());
                            }}
                            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[10px] font-mono font-bold text-slate-700 cursor-pointer"
                          >
                            {tok}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              {selectedNode.type === 'trigger' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-900 text-sm">Trigger Settings</h4>
                    <p className="text-[11px] text-slate-500">
                      Bound to audience list: <strong>{targetList}</strong>
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      Trigger Label
                    </label>
                    <input
                      type="text"
                      value={selectedNode.data.label || ''}
                      onChange={(e) => handleUpdateNodeData('label', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      Trigger Event
                    </label>
                    <select
                      value={selectedNode.data.nodeType}
                      onChange={(e) => {
                        const nextType = e.target.value as WorkflowNodeType;
                        const meta = getTriggerMeta(nextType);
                        const patch: Record<string, any> = {
                          nodeType: nextType,
                          label: meta.defaultLabel,
                        };
                        if (nextType === 'trigger_form_submission' && !selectedNode.data.formScope) {
                          patch.formScope = 'all_list_forms';
                        }
                        if (nextType === 'trigger_keyword' && !selectedNode.data.triggerKeyword) {
                          patch.triggerKeyword = 'price';
                        }
                        if (
                          (nextType === 'trigger_tag_added' || nextType === 'trigger_tag_removed') &&
                          !selectedNode.data.tagName
                        ) {
                          patch.tagName = 'VIP_Lead';
                        }
                        handleUpdateNodeFields(patch);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold"
                    >
                      {TRIGGER_CATALOG.map((trig) => (
                        <option key={trig.nodeType} value={trig.nodeType}>
                          {trig.shortLabel}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedNode.data.nodeType === 'trigger_form_submission' && (
                    <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-emerald-950 mb-1">
                          Form Matching Scope
                        </label>
                        <p className="text-[11px] text-emerald-800/80">
                          Choose whether any form for <strong>{targetList}</strong> starts this workflow, or pick one specific capture form.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateNodeFields({
                              formScope: 'all_list_forms',
                              targetFormId: '',
                              targetFormTitle: '',
                            })
                          }
                          className={`px-3 py-2 rounded-lg text-left text-xs font-semibold border transition-colors cursor-pointer ${
                            selectedNode.data.formScope !== 'specific_form'
                              ? 'bg-white border-emerald-500 text-emerald-900 shadow-2xs'
                              : 'bg-emerald-50/40 border-emerald-200 text-slate-600 hover:bg-white'
                          }`}
                        >
                          All forms targeting "{targetList}"
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const firstForm =
                              assets.find(
                                (a) =>
                                  (a.targetList || '').trim().toLowerCase() ===
                                  targetList.trim().toLowerCase()
                              ) || assets[0];
                            handleUpdateNodeFields({
                              formScope: 'specific_form',
                              targetFormId: firstForm?.id || '',
                              targetFormTitle: firstForm?.title || '',
                            });
                          }}
                          className={`px-3 py-2 rounded-lg text-left text-xs font-semibold border transition-colors cursor-pointer ${
                            selectedNode.data.formScope === 'specific_form'
                              ? 'bg-white border-emerald-500 text-emerald-900 shadow-2xs'
                              : 'bg-emerald-50/40 border-emerald-200 text-slate-600 hover:bg-white'
                          }`}
                        >
                          Pick one specific capture form
                        </button>
                      </div>

                      {selectedNode.data.formScope === 'specific_form' && (
                        <div>
                          <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                            Select Capture Form *
                          </label>
                          {assets.length === 0 ? (
                            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                              No capture forms created yet. Create a form in Lead Gen &amp; Forms, or keep matching all list forms.
                            </p>
                          ) : (
                            <select
                              value={selectedNode.data.targetFormId || ''}
                              onChange={(e) => {
                                const picked = assets.find((a) => a.id === e.target.value);
                                handleUpdateNodeFields({
                                  formScope: 'specific_form',
                                  targetFormId: picked?.id || '',
                                  targetFormTitle: picked?.title || '',
                                });
                              }}
                              className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-slate-900"
                            >
                              <option value="">-- Choose a capture form --</option>
                              {assets.map((asset) => (
                                <option key={asset.id} value={asset.id}>
                                  {asset.title} ({asset.targetList || 'General'})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {(selectedNode.data.nodeType === 'trigger_tag_added' ||
                    selectedNode.data.nodeType === 'trigger_tag_removed') && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">
                        Segment Tag Name *
                      </label>
                      <input
                        type="text"
                        value={selectedNode.data.tagName || ''}
                        onChange={(e) => handleUpdateNodeData('tagName', e.target.value)}
                        placeholder="e.g. VIP_Buyer, Purchased_Course"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold"
                      />
                    </div>
                  )}

                  {selectedNode.data.nodeType === 'trigger_specific_datetime' && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">
                        Scheduled Date &amp; Time *
                      </label>
                      <input
                        type="datetime-local"
                        value={selectedNode.data.scheduledAt || ''}
                        onChange={(e) => handleUpdateNodeData('scheduledAt', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold"
                      />
                    </div>
                  )}

                  {selectedNode.data.nodeType === 'trigger_keyword' && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">
                        Trigger Keyword *
                      </label>
                      <input
                        type="text"
                        value={selectedNode.data.triggerKeyword || ''}
                        onChange={(e) =>
                          handleUpdateNodeData('triggerKeyword', e.target.value)
                        }
                        placeholder="e.g. price, start, vip"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        ) : (
          <aside className="w-72 bg-white border-l border-slate-200 p-6 hidden lg:flex flex-col items-center justify-center text-center text-slate-400 shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3 text-slate-400">
              <Sliders className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-bold text-slate-700 mb-1">No Node Selected</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-[200px]">
              Click any node card on the canvas to edit wait timers, messages, or branch conditions.
            </p>
          </aside>
        )}
      </div>

      {/* EMBEDDED RICH EMAIL EDITOR */}
      {emailEditorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 sm:p-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Rich Email Editor for Workflow Action
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Visual formatting, custom CTA buttons, and inline styles
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailEditorModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
              <EmailEditor
                initialContent={emailEditorContent}
                onChange={(html) => setEmailEditorContent(html)}
                onSave={handleSaveRichEmail}
                subject={workflowName}
              />
            </div>
          </div>
        </div>
      )}

      {/* TEST RUN SIMULATOR */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Simulate Workflow Execution
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTestModalOpen(false);
                  setTestResult(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Test Lead Name
                  </label>
                  <input
                    type="text"
                    value={testLeadName}
                    onChange={(e) => setTestLeadName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Simulated Lead Phone
                  </label>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Simulated Lead Email (for Email Actions)
                </label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="lead@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Incoming Message Payload (Tested Against Trigger &amp; Condition Keywords)
                </label>
                <input
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="e.g. Yes, I want pricing"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deliverLiveTest}
                  onChange={(e) => setDeliverLiveTest(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-semibold text-slate-700">
                  Deliver real messages via connected WhatsApp / Resend Email channels
                </span>
              </label>

              {testResult && (
                <div
                  className={`p-3 rounded-xl font-mono text-[11px] max-h-56 overflow-y-auto ${
                    testResult.ok === false ||
                    (Array.isArray(testResult.receipts) &&
                      testResult.receipts.some((r: any) => r.status === 'failed'))
                      ? 'bg-slate-900 text-amber-300'
                      : 'bg-slate-900 text-emerald-400'
                  }`}
                >
                  <pre>{JSON.stringify(testResult, null, 2)}</pre>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setTestModalOpen(false);
                  setTestResult(null);
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleExecuteTest}
                disabled={isRunningTest}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                {isRunningTest ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                <span>Run Simulation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {renderCreateWorkflowModal()}
    </div>
  );
};

export default AutomationBuilderUI;
