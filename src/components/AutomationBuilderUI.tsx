import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { DelayUnit, WorkflowNodeType } from '../lib/automation/types';
import {
  AudienceList,
  Automation,
  AutomationStatus,
  ConsentStatus,
  Contact,
  ListCategory,
  TriggerType,
  sanitizeString,
  sanitizeStringArray,
} from '../types';
import { EmailEditor } from './EmailEditor';

// ============================================================================
// CUSTOM REACT FLOW NODE COMPONENTS
// ============================================================================

export type FlowCustomNode = Node<Record<string, any>>;

const TriggerNodeComponent = ({ data, selected }: NodeProps<FlowCustomNode>) => {
  const isEmail = data.nodeType === 'trigger_email_reply';
  const isKeyword = data.nodeType === 'trigger_keyword';

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
            {isEmail ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-900 truncate">
              {data.label || 'List Join / Inbound Trigger'}
            </h4>
            <p className="text-[11px] text-slate-500 truncate">
              {isEmail ? 'Inbound email event' : 'List & WhatsApp Event'}
            </p>
          </div>
        </div>

        {isKeyword && (
          <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] flex items-center justify-between">
            <span className="text-slate-500">Keyword:</span>
            <span className="font-mono font-bold text-emerald-700">
              "{data.triggerKeyword || 'start'}"
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
                ? data.emailSenderPersona === 'brother'
                  ? 'From: support@passiveincome.work.gd'
                  : 'From: hello@passiveincome.work.gd'
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
        data: { keyword: 'price' },
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
            rfNodes.push({
              id,
              type: 'trigger',
              position: { x, y },
              data: {
                nodeType:
                  ln.subType === 'whatsapp_keyword'
                    ? 'trigger_keyword'
                    : ln.subType === 'email_opened'
                    ? 'trigger_email_reply'
                    : 'trigger_whatsapp_reply',
                label: ln.title || auto.triggerDetail || 'Workflow Trigger',
                triggerKeyword: ln.config?.conditionValue || 'start',
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
  const synthNodes: FlowCustomNode[] = [
    {
      id: 'node-trigger-1',
      type: 'trigger',
      position: { x: 300, y: 40 },
      data: {
        nodeType:
          auto.triggerType === 'whatsapp_keyword'
            ? 'trigger_keyword'
            : 'trigger_whatsapp_reply',
        label: auto.triggerDetail || `List: ${auto.targetList || 'General Contacts'}`,
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
  initialWorkflowId?: string;
  automations: Automation[];
  lists: AudienceList[];
  contacts: Contact[];
  preselectedListName?: string | null;
  onClearPreselectedList?: () => void;
  openCreateModalOnMount?: boolean;
  onClearCreateModalMount?: () => void;
  onCreateAutomation: (
    data: Omit<Automation, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<Automation>;
  onUpdateAutomation: (
    id: string,
    data: Omit<Automation, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onDeleteAutomation: (id: string) => Promise<void>;
  onCreateList: (
    data: Omit<AudienceList, 'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onNavigateToLists?: () => void;
  onBackToDashboard?: () => void;
}

export const AutomationBuilderUI: React.FC<AutomationBuilderUIProps> = ({
  automations = [],
  lists = [],
  contacts = [],
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
  const [workflowEnabled, setWorkflowEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

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
  const [testPhone, setTestPhone] = useState('2348012345678');
  const [testMessage, setTestMessage] = useState('Hey, what is the price for this service?');
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

  // Launch Canvas directly if invoked via Segments & Lists / Forms preselectedListName
  useEffect(() => {
    if (preselectedListName && preselectedListName.trim()) {
      const cleanList = preselectedListName.trim();
      const starter = buildStarterGraphForList(cleanList);
      setEditingAutomationId(null);
      setTargetList(cleanList);
      setWorkflowName(`${cleanList} Automation Flow`);
      setWorkflowEnabled(true);
      setNodes(starter.nodes);
      setEdges(starter.edges);
      setSelectedNode(null);
      setSaveBanner(`Creating automation workflow for list "${cleanList}".`);
      setViewMode('canvas');
      onClearPreselectedList?.();
    }
  }, [preselectedListName, onClearPreselectedList, setNodes, setEdges]);

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
    const enrolled = automations.reduce((s, a) => s + (a.enrolledCount || 0), 0);
    const avgConv =
      total > 0
        ? Math.round(
            automations.reduce((s, a) => s + (a.conversionRate || 0), 0) / total
          )
        : 0;
    return { total, active, enrolled, avgConv };
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

  // Confirm Existing List Selection -> Enter Canvas
  const handleStartWithSelectedList = () => {
    if (!chosenListName.trim()) {
      setModalError('Please choose a contact list first, or create a new list.');
      return;
    }
    const cleanList = chosenListName.trim();
    const starter = buildStarterGraphForList(cleanList);
    setEditingAutomationId(null);
    setTargetList(cleanList);
    setWorkflowName(
      draftWorkflowName.trim() || `${cleanList} Automation Flow`
    );
    setWorkflowEnabled(true);
    setNodes(starter.nodes);
    setEdges(starter.edges);
    setSelectedNode(null);
    setCreateModalOpen(false);
    setViewMode('canvas');
  };

  // Create New List Inline -> Persist & Enter Canvas
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
      const starter = buildStarterGraphForList(cleanName);
      setEditingAutomationId(null);
      setTargetList(cleanName);
      setWorkflowName(
        draftWorkflowName.trim() || `${cleanName} Automation Flow`
      );
      setWorkflowEnabled(true);
      setNodes(starter.nodes);
      setEdges(starter.edges);
      setSelectedNode(null);
      setCreateModalOpen(false);
      setSaveBanner(`Created list "${cleanName}" and launched Workflow Canvas.`);
      setViewMode('canvas');
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
    setEditingAutomationId(auto.id);
    setWorkflowName(auto.name);
    setTargetList(resolvedList);
    setWorkflowEnabled(auto.status === 'active');
    setNodes(rehydrated.nodes);
    setEdges(rehydrated.edges);
    setSelectedNode(null);
    setSaveBanner(null);
    setViewMode('canvas');
  };

  // Toggle Active / Paused directly from Saved Workflows Hub
  const handleToggleAutomationStatus = async (auto: Automation) => {
    const nextStatus: AutomationStatus =
      auto.status === 'active' ? 'paused' : 'active';
    await onUpdateAutomation(auto.id, {
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
      version: auto.version || 1,
      ...(auto.flowGraphJson ? { flowGraphJson: auto.flowGraphJson } : {}),
    });
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
        data.label = label || 'New Inbound Trigger';
        if (nodeType === 'trigger_keyword') data.triggerKeyword = 'price';
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

  const handleUpdateNodeData = useCallback(
    (field: string, val: any) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === selectedNode.id) {
            const updated = {
              ...n,
              data: {
                ...n.data,
                [field]: val,
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

  // Persist workflow directly to Workspace Snapshot & Firestore schema
  const handleSaveWorkflow = async () => {
    setIsSaving(true);
    setSaveBanner(null);

    try {
      const cleanName = sanitizeString(workflowName, 120, 'Untitled Workflow');
      const cleanList = sanitizeString(targetList, 80, 'General Contacts');
      const triggerNode = nodes.find((n) => n.type === 'trigger');
      const triggerNodeType = triggerNode?.data?.nodeType;

      const triggerType: TriggerType =
        triggerNodeType === 'trigger_keyword'
          ? 'whatsapp_keyword'
          : triggerNodeType === 'trigger_email_reply'
          ? 'email_opened'
          : 'list_joined';

      const triggerDetail = sanitizeString(
        `List: ${cleanList}${
          triggerNode?.data?.triggerKeyword
            ? ` · Keyword "${triggerNode.data.triggerKeyword}"`
            : triggerNode?.data?.label
            ? ` · ${triggerNode.data.label}`
            : ''
        }`,
        120,
        `List: ${cleanList}`
      );

      const derivedSteps = nodes.map((n) => {
        if (n.type === 'trigger') {
          return sanitizeString(
            `Trigger: ${n.data?.label || 'List Join Event'}`,
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

      const channelSet = new Set<string>();
      nodes.forEach((n) => {
        if (n.data?.nodeType === 'action_send_email' || n.data?.nodeType === 'trigger_email_reply') {
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

      const flowGraphJson = serializeCompactGraph(nodes, edges);
      const existingAuto = editingAutomationId
        ? automations.find((a) => a.id === editingAutomationId)
        : undefined;

      const payload: Omit<
        Automation,
        'id' | 'workspaceId' | 'ownerId' | 'createdAt' | 'updatedAt'
      > = {
        name: cleanName,
        triggerType,
        triggerDetail,
        targetList: cleanList,
        stepsSummary,
        channels,
        status: workflowEnabled ? 'active' : 'paused',
        enrolledCount: existingAuto?.enrolledCount || 0,
        completedCount: existingAuto?.completedCount || 0,
        conversionRate: existingAuto?.conversionRate || 0,
        version: (existingAuto?.version || 0) + 1,
        flowGraphJson,
      };

      if (existingAuto) {
        await onUpdateAutomation(existingAuto.id, payload);
        setSaveBanner(`Updated workflow "${cleanName}" for list "${cleanList}".`);
      } else {
        const created = await onCreateAutomation(payload);
        setEditingAutomationId(created.id);
        setSaveBanner(`Saved & activated workflow "${cleanName}" for list "${cleanList}".`);
      }
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveBanner(null), 4000);
    }
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

  // Client-side Workflow Execution Simulator (zero /api dependency)
  const handleExecuteTest = async () => {
    setIsRunningTest(true);
    setTestResult(null);
    try {
      const trace: any[] = [];
      const visited = new Set<string>();
      let current: FlowCustomNode | undefined =
        nodes.find((n) => n.type === 'trigger') || nodes[0];

      while (current && !visited.has(current.id) && trace.length < 25) {
        visited.add(current.id);
        if (current.type === 'trigger') {
          trace.push({
            step: trace.length + 1,
            type: 'trigger',
            label: current.data?.label || 'Trigger Fired',
            targetList,
            leadPhone: testPhone,
          });
          const nextEdge = edges.find((e) => e.source === current?.id);
          current = nextEdge ? nodes.find((n) => n.id === nextEdge.target) : undefined;
        } else if (current.type === 'condition') {
          const kw = String(current.data?.keyword || 'price').toLowerCase();
          const matched = testMessage.toLowerCase().includes(kw);
          trace.push({
            step: trace.length + 1,
            type: 'condition',
            keyword: kw,
            matched,
            branchTaken: matched ? 'true (Yes)' : 'false (No)',
          });
          const branchEdge =
            edges.find(
              (e) =>
                e.source === current?.id &&
                e.sourceHandle === (matched ? 'true' : 'false')
            ) || edges.find((e) => e.source === current?.id);
          current = branchEdge ? nodes.find((n) => n.id === branchEdge.target) : undefined;
        } else if (current.type === 'delay') {
          trace.push({
            step: trace.length + 1,
            type: 'delay',
            wait: `${current.data?.delayValue || 5} ${current.data?.delayUnit || 'Minutes'}`,
            status: 'scheduled_in_queue',
          });
          const nextEdge = edges.find((e) => e.source === current?.id);
          current = nextEdge ? nodes.find((n) => n.id === nextEdge.target) : undefined;
        } else {
          trace.push({
            step: trace.length + 1,
            type: current.data?.nodeType || 'action',
            recipient: testPhone,
            messagePreview: (current.data?.message || '').replace(
              /\{\{first_name\}\}/gi,
              'Alex'
            ),
          });
          const nextEdge = edges.find((e) => e.source === current?.id);
          current = nextEdge ? nodes.find((n) => n.id === nextEdge.target) : undefined;
        }
      }

      setTestResult({
        ok: true,
        workflow: workflowName,
        targetList,
        stepsExecuted: trace.length,
        trace,
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
              Build and manage automated WhatsApp and Email drip sequences bound to your audience lists.
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
              Active Flows
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              {hubStats.active}
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
          <div className="p-4 rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Avg Conversion
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {hubStats.avgConv}%
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
            {(['all', 'active', 'paused', 'draft'] as const).map((statusKey) => {
              const active = hubStatusFilter === statusKey;
              return (
                <button
                  key={statusKey}
                  type="button"
                  onClick={() => setHubStatusFilter(statusKey)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {statusKey}
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
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {isActive ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Pause className="w-3.5 h-3.5" />
                        )}
                        <span className="capitalize">{auto.status}</span>
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
                      <button
                        type="button"
                        onClick={() => handleToggleAutomationStatus(auto)}
                        className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        {isActive ? 'Pause' : 'Activate'}
                      </button>

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
  return (
    <div className="flex flex-col h-[calc(100vh-116px)] min-h-[640px] bg-[#f8fafc] text-slate-900 font-sans antialiased overflow-hidden">
      {/* TOP BAR */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 z-20 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              setSelectedNode(null);
              setViewMode('list');
            }}
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
            className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 max-w-[170px] truncate cursor-pointer"
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
            className="text-sm font-bold text-slate-900 bg-transparent hover:bg-slate-50 focus:bg-white px-2.5 py-1 rounded-lg border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-all w-44 sm:w-64 truncate"
            placeholder="Workflow Name..."
          />
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setWorkflowEnabled((p) => !p)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              workflowEnabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-300'
            }`}
          >
            {workflowEnabled ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Pause className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>{workflowEnabled ? 'Active' : 'Paused'}</span>
          </button>

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
            onClick={handleSaveWorkflow}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {isSaving ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? 'Saving...' : 'Save Workflow'}</span>
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
                      1. Inbound Triggers
                    </span>
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleAddNode('trigger_whatsapp_reply', `Contact Joins "${targetList}"`)
                        }
                        className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/40 text-left transition-all flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">
                              List / WhatsApp Event
                            </div>
                            <div className="text-[10px] text-slate-500">When lead enters or replies</div>
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-slate-300 group-hover:text-emerald-600" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleAddNode('trigger_email_reply', 'Email Inbound Message')
                        }
                        className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/40 text-left transition-all flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <Mail className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">
                              Email Reply
                            </div>
                            <div className="text-[10px] text-slate-500">When email arrives</div>
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-slate-300 group-hover:text-emerald-600" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddNode('trigger_keyword', 'Keyword Trigger')}
                        className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/40 text-left transition-all flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <Zap className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">
                              Keyword Trigger
                            </div>
                            <div className="text-[10px] text-slate-500">e.g. "price", "start"</div>
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-slate-300 group-hover:text-emerald-600" />
                      </button>
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
                      <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 space-y-2">
                        <label className="block text-xs font-bold text-blue-900">
                          Sender Persona
                        </label>
                        <select
                          value={selectedNode.data.emailSenderPersona || 'me'}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleUpdateNodeData('emailSenderPersona', val);
                          }}
                          className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-semibold text-slate-900"
                        >
                          <option value="me">Primary (hello@passiveincome.work.gd)</option>
                          <option value="brother">Support (support@passiveincome.work.gd)</option>
                        </select>
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
                      onChange={(e) => handleUpdateNodeData('nodeType', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold"
                    >
                      <option value="trigger_whatsapp_reply">
                        List Join / WhatsApp Inbound
                      </option>
                      <option value="trigger_email_reply">Email Inbound Message</option>
                      <option value="trigger_keyword">Specific Inbound Keyword</option>
                    </select>
                  </div>

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

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Incoming Message Payload
                </label>
                <input
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="e.g. Yes, I want pricing"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              {testResult && (
                <div className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] max-h-48 overflow-y-auto">
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
