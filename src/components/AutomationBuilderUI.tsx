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
  AlertCircle,
  Play,
  RotateCcw,
  Trash2,
  Plus,
  ArrowLeft,
  X,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ListFilter,
  Eye,
  Send,
  Calendar,
  Check,
  Smartphone,
  ChevronRight,
  Settings2,
  ExternalLink,
  BookOpen,
  ArrowRight,
  Sliders,
  PanelLeftClose,
  PanelLeft,
  FileCode,
} from 'lucide-react';
import { DelayUnit, WorkflowNodeType, WorkflowRecord, FollowUpJobRecord } from '../lib/automation/types';
import { EmailEditor } from './EmailEditor';

// ============================================================================
// PREMIUM CUSTOM NODE COMPONENTS (Systeme.io / GoHighLevel Style)
// ============================================================================

export type FlowCustomNode = Node<Record<string, any>>;

// 1. TRIGGER NODE
const TriggerNodeComponent = ({ data, selected }: NodeProps<FlowCustomNode>) => {
  const isEmail = data.nodeType === 'trigger_email_reply';
  const isKeyword = data.nodeType === 'trigger_keyword';

  return (
    <div
      className={`min-w-[260px] max-w-[280px] rounded-2xl bg-white border transition-all duration-200 shadow-[0_4px_12px_rgba(0,0,0,0.05)] ${
        selected
          ? 'border-emerald-500 ring-4 ring-emerald-500/10 shadow-lg'
          : 'border-slate-200 hover:border-emerald-400'
      }`}
    >
      <div className="px-4 py-2.5 bg-emerald-50/80 border-b border-emerald-100 rounded-t-2xl flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-emerald-600" />
          Trigger
        </span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900">
          Start Node
        </span>
      </div>

      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
            {isEmail ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-900 truncate">
              {data.label || 'WhatsApp Inbound Message'}
            </h4>
            <p className="text-[11px] text-slate-500 truncate">
              {isEmail ? 'Inbound email received' : 'Baileys / Cloud API Event'}
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

// 2. CONDITION NODE (BRANCHING YES/NO)
const ConditionNodeComponent = ({ data, selected }: NodeProps<FlowCustomNode>) => {
  return (
    <div
      className={`min-w-[270px] max-w-[290px] rounded-2xl bg-white border transition-all duration-200 shadow-[0_4px_12px_rgba(0,0,0,0.05)] ${
        selected
          ? 'border-indigo-500 ring-4 ring-indigo-500/10 shadow-lg'
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
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-200/70 text-indigo-900">
          Smart Filter
        </span>
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
          <span className="text-emerald-700 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Yes (Match)
          </span>
          <span className="text-rose-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            No (Else)
          </span>
        </div>
      </div>

      {/* Dual Handles: Left for True, Right for False */}
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

// 3. ACTION NODE (WHATSAPP / EMAIL / END)
const ActionNodeComponent = ({ data, selected }: NodeProps<FlowCustomNode>) => {
  const isEnd = data.nodeType === 'action_end' || data.nodeType === 'action_end_flow';
  const isEmail = data.nodeType === 'action_send_email';


  return (
    <div
      className={`min-w-[270px] max-w-[290px] rounded-2xl bg-white border transition-all duration-200 shadow-[0_4px_12px_rgba(0,0,0,0.05)] ${
        selected
          ? isEnd
            ? 'border-slate-500 ring-4 ring-slate-500/10'
            : 'border-blue-500 ring-4 ring-blue-500/10 shadow-lg'
          : isEnd
          ? 'border-slate-200'
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
          isEnd ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-blue-50/80 border-blue-100 text-blue-900'
        }`}
      >
        <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
          {isEnd ? <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" /> : <Send className="w-3.5 h-3.5 text-blue-600" />}
          {isEnd ? 'Completion' : isEmail ? 'Email Action' : 'WhatsApp Action'}
        </span>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            isEnd ? 'bg-slate-200 text-slate-800' : 'bg-blue-200/70 text-blue-950'
          }`}
        >
          {isEnd ? 'End' : 'Outbound'}
        </span>
      </div>

      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isEnd ? 'bg-slate-100 text-slate-600' : isEmail ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
            }`}
          >
            {isEnd ? <Check className="w-4 h-4" /> : isEmail ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-900 truncate">
              {isEnd ? 'Terminate Workflow' : isEmail ? 'Send Formatted Email' : 'Send WhatsApp Message'}
            </h4>
            <p className="text-[11px] text-slate-500 truncate">
              {isEnd
                ? 'No further follow-up'
                : isEmail
                ? data.emailSenderPersona === 'brother'
                  ? 'From: Brother (support@passiveincome.work.gd)'
                  : 'From: Musa (hello@passiveincome.work.gd)'
                : 'Delivered via WhatsApp API'}
            </p>
          </div>
        </div>

        {!isEnd && (
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 line-clamp-2 italic leading-relaxed">
            "{data.message || 'Thank you for contacting us! How can we help?'}"
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

// 4. DELAY / DRIP WAIT NODE
const DelayNodeComponent = ({ data, selected }: NodeProps<FlowCustomNode>) => {
  const value = data.delayValue || 5;
  const unit = data.delayUnit || 'Minutes';

  return (
    <div
      className={`min-w-[270px] max-w-[290px] rounded-2xl bg-white border transition-all duration-200 shadow-[0_4px_12px_rgba(0,0,0,0.05)] ${
        selected
          ? 'border-amber-500 ring-4 ring-amber-500/10 shadow-lg'
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
          Delay · Drip Timer
        </span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900">
          Async Queue
        </span>
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
          <span className="font-mono text-sm font-bold text-amber-900 bg-white px-2.5 py-0.5 rounded-md border border-amber-200 shadow-2xs">
            {value} {unit}
          </span>
        </div>

        <p className="text-[10px] text-slate-400 leading-tight">
          Saves to followUpJobs table; background cron will resume when time expires.
        </p>
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
// PRESET BLUEPRINTS FOR INSTANT WORKFLOW DEPLOYMENT
// ============================================================================

const WORKFLOW_BLUEPRINTS = [
  {
    id: 'nurture_drip',
    title: '3-Day Email & WhatsApp Nurture Drip',
    description: 'Welcomes lead, waits 2 hours, sends video, waits 1 day, sends booking CTA.',
    badge: 'High Conversion',
    nodes: [
      {
        id: 'node_trigger',
        type: 'trigger',
        position: { x: 250, y: 50 },
        data: { nodeType: 'trigger_whatsapp_reply', label: 'Lead Inbound Message' },
      },
      {
        id: 'node_welcome',
        type: 'action',
        position: { x: 250, y: 220 },
        data: {
          nodeType: 'action_send_whatsapp',
          message: 'Hi {{first_name}}! Welcome to FlowPilot. Your masterclass is ready.',
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
          message: 'Did you get a chance to watch the video? Reply YES if ready to get started!',
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
          message: 'Special invitation: Book your VIP strategy session with our team today.',
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
    description: 'Inspects if incoming message contains "price" or "quote", routes accordingly.',
    badge: 'Sales Qualifier',
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
          message: 'Thanks for reaching out! A specialist will assist you in 5 minutes.',
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

// ============================================================================
// MAIN COMPONENT: AutomationBuilderUI
// ============================================================================

export interface AutomationBuilderUIProps {
  userId?: string;
  initialWorkflowId?: string;
  onBackToDashboard?: () => void;
}

export const AutomationBuilderUI: React.FC<AutomationBuilderUIProps> = ({
  userId = 'default_workspace',
  initialWorkflowId,
  onBackToDashboard,
}) => {
  const [workflowName, setWorkflowName] = useState('New Drip Automation');
  const [workflowId, setWorkflowId] = useState(initialWorkflowId || '');
  const [workflowEnabled, setWorkflowEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // Sidebar controls
  const [sidebarTab, setSidebarTab] = useState<'nodes' | 'blueprints' | 'jobs'>('nodes');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Selected Node for Settings Panel
  const [selectedNode, setSelectedNode] = useState<FlowCustomNode | null>(null);

  // Email Editor Modal Integration
  const [emailEditorModalOpen, setEmailEditorModalOpen] = useState(false);
  const [editingEmailNodeId, setEditingEmailNodeId] = useState<string | null>(null);
  const [emailEditorContent, setEmailEditorContent] = useState('');

  // Test Run Modal
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('2348012345678');
  const [testMessage, setTestMessage] = useState('Hey, what is the price for this service?');
  const [testResult, setTestResult] = useState<any>(null);
  const [isRunningTest, setIsRunningTest] = useState(false);

  // Initial nodes & edges
  const initialNodes: FlowCustomNode[] = useMemo(
    () => [
      {
        id: 'node-trigger-1',
        type: 'trigger',
        position: { x: 300, y: 40 },
        data: {
          nodeType: 'trigger_whatsapp_reply',
          label: 'WhatsApp Inbound Message',
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
          message: 'Hi {{first_name}}! Here is your requested link: https://flowpilot.app/vip. Watch and reply DONE.',
        },
      },
    ],
    []
  );

  const initialEdges: Edge[] = useMemo(
    () => [
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
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Connect handler
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

  // Node selection handler
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node as FlowCustomNode);
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Add new node to canvas
  const handleAddNode = useCallback(
    (nodeType: WorkflowNodeType, label?: string) => {
      const id = `node-${Date.now().toString(36)}`;
      const position = {
        x: 250 + Math.random() * 80,
        y: 120 + nodes.length * 90,
      };

      let category: 'trigger' | 'condition' | 'action' | 'delay' = 'action';
      let data: Record<string, any> = { nodeType, label };

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
        data.message = 'Hello! Thank you for contacting us.';
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

  // Load blueprint
  const handleLoadBlueprint = useCallback(
    (blueprint: (typeof WORKFLOW_BLUEPRINTS)[0]) => {
      setWorkflowName(blueprint.title);
      setNodes(blueprint.nodes as any);
      setEdges(
        blueprint.edges.map((e) => ({
          ...e,
          style: { stroke: '#2563eb', strokeWidth: 2 },
        }))
      );
      setSelectedNode(null);
      setSaveBanner(`Loaded template: ${blueprint.title}`);
      setTimeout(() => setSaveBanner(null), 3500);
    },
    [setNodes, setEdges]
  );

  // Update selected node data
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

  // Delete selected node
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

  // Save workflow to backend DB
  const handleSaveWorkflow = async () => {
    setIsSaving(true);
    setSaveBanner(null);

    const payload = {
      id: workflowId || undefined,
      userId,
      name: workflowName.trim() || 'Untitled Automation',
      nodesJson: JSON.stringify(nodes),
      edgesJson: JSON.stringify(edges),
      enabled: workflowEnabled,
    };

    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok && data.workflow) {
        setWorkflowId(data.workflow.id);
        setSaveBanner(`Workflow "${data.workflow.name}" successfully saved & deployed!`);
      } else {
        setSaveBanner(`Workflow saved locally. (${nodes.length} nodes active)`);
      }
    } catch {
      setSaveBanner(`Workflow saved in local state. (${nodes.length} nodes active)`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveBanner(null), 4000);
    }
  };

  // Open rich email editor for action node
  const handleOpenRichEmailEditor = (nodeId: string, currentText: string) => {
    setEditingEmailNodeId(nodeId);
    setEmailEditorContent(currentText);
    setEmailEditorModalOpen(true);
  };

  // Save rich email back to action node
  const handleSaveRichEmail = (html: string) => {
    if (editingEmailNodeId) {
      handleUpdateNodeData('message', html);
    }
    setEmailEditorModalOpen(false);
    setEditingEmailNodeId(null);
  };

  // Run test simulation
  const handleExecuteTest = async () => {
    setIsRunningTest(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/workflows/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: workflowId || 'test_preview',
          leadPhone: testPhone,
          leadMessage: testMessage,
          userId,
          workflow: {
            id: workflowId || 'temp_workflow',
            userId,
            name: workflowName,
            nodesJson: JSON.stringify(nodes),
            edgesJson: JSON.stringify(edges),
            enabled: true,
          },
        }),
      });
      const data = await res.json();
      setTestResult(data.result || data);
    } catch (err: any) {
      setTestResult({ error: err.message || 'Execution error' });
    } finally {
      setIsRunningTest(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-[#f8fafc] text-slate-900 font-sans antialiased overflow-hidden">
      {/* TOP BAR: Modern SaaS Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4 z-20 shrink-0 shadow-2xs">
        {/* Left: Breadcrumbs & Workflow Name Input */}
        <div className="flex items-center gap-3 min-w-0">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Back to Automations"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span>Automations</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-600 font-semibold">Visual Drip Canvas</span>
          </div>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Workflow Name Editable Input */}
          <div className="relative">
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="text-sm sm:text-base font-bold text-slate-900 bg-transparent hover:bg-slate-50 focus:bg-white px-2.5 py-1 rounded-lg border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-all w-52 sm:w-72 truncate"
              placeholder="Workflow Name..."
            />
          </div>
        </div>

        {/* Right: Status Toggle, Test Button, and Save */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Active / Draft Toggle */}
          <button
            type="button"
            onClick={() => setWorkflowEnabled((p) => !p)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              workflowEnabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-2xs'
                : 'bg-slate-100 text-slate-600 border-slate-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                workflowEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span>{workflowEnabled ? 'Live & Listening' : 'Draft / Paused'}</span>
          </button>

          {/* Test Run Trigger */}
          <button
            type="button"
            onClick={() => setTestModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
          >
            <Play className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Simulate Run</span>
          </button>

          {/* Save Workflow CTA */}
          <button
            type="button"
            onClick={handleSaveWorkflow}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
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

      {/* BANNER NOTIFICATION */}
      {saveBanner && (
        <div className="bg-emerald-600 text-white px-6 py-2 text-xs font-semibold flex items-center justify-between shrink-0 transition-all">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{saveBanner}</span>
          </div>
          <button type="button" onClick={() => setSaveBanner(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5 text-emerald-200 hover:text-white" />
          </button>
        </div>
      )}

      {/* WORKSPACE BODY: Left Sidebar + Central Flow Canvas + Right Settings Drawer */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* ------------------------------------------------------------------ */}
        {/* LEFT SIDEBAR: Node Catalog & Blueprints */}
        {/* ------------------------------------------------------------------ */}
        <aside
          className={`bg-white border-r border-slate-200 transition-all duration-300 z-10 flex flex-col shrink-0 ${
            sidebarOpen ? 'w-72' : 'w-12'
          }`}
        >
          {/* Sidebar Header */}
          <div className="h-12 border-b border-slate-200 px-3 flex items-center justify-between">
            {sidebarOpen ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSidebarTab('nodes')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
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
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
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
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Sidebar Content */}
          {sidebarOpen && (
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {sidebarTab === 'nodes' ? (
                <>
                  {/* Triggers Group */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      1. Inbound Triggers
                    </span>
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => handleAddNode('trigger_whatsapp_reply', 'WhatsApp Inbound Reply')}
                        className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/40 text-left transition-all flex items-center justify-between cursor-pointer group shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">
                              WhatsApp Reply
                            </div>
                            <div className="text-[10px] text-slate-500">When lead texts you</div>
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-slate-300 group-hover:text-emerald-600" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddNode('trigger_email_reply', 'Email Inbound Message')}
                        className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/40 text-left transition-all flex items-center justify-between cursor-pointer group shadow-2xs"
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
                        className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/40 text-left transition-all flex items-center justify-between cursor-pointer group shadow-2xs"
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

                  {/* Conditions Group */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      2. Smart Branching
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddNode('condition_message_contains', 'Message Contains')}
                      className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-indigo-500 bg-white hover:bg-indigo-50/40 text-left transition-all flex items-center justify-between cursor-pointer group shadow-2xs"
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

                  {/* Drip Delays Group */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      3. Drip & Wait Timers
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddNode('delay_wait', 'Delay Node')}
                      className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-amber-500 bg-white hover:bg-amber-50/40 text-left transition-all flex items-center justify-between cursor-pointer group shadow-2xs"
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

                  {/* Actions Group */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      4. Outbound Actions
                    </span>
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => handleAddNode('action_send_whatsapp', 'Send WhatsApp Message')}
                        className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 bg-white hover:bg-blue-50/40 text-left transition-all flex items-center justify-between cursor-pointer group shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                              Send WhatsApp
                            </div>
                            <div className="text-[10px] text-slate-500">Direct reply via Baileys</div>
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-slate-300 group-hover:text-blue-600" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddNode('action_send_email', 'Send Rich Email')}
                        className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 bg-white hover:bg-blue-50/40 text-left transition-all flex items-center justify-between cursor-pointer group shadow-2xs"
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
                        className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-slate-500 bg-white hover:bg-slate-50 text-left transition-all flex items-center justify-between cursor-pointer group shadow-2xs"
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
                /* Blueprints Tab */
                <div className="space-y-3">
                  <div className="text-xs text-slate-500">
                    Deploy battle-tested automated funnels in one click:
                  </div>
                  {WORKFLOW_BLUEPRINTS.map((bp) => (
                    <div
                      key={bp.id}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 space-y-2 transition-all shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                          {bp.badge}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {bp.nodes.length} nodes
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">{bp.title}</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{bp.description}</p>
                      <button
                        type="button"
                        onClick={() => handleLoadBlueprint(bp)}
                        className="w-full mt-2 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
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

        {/* ------------------------------------------------------------------ */}
        {/* CENTER: React Flow Canvas Viewport */}
        {/* ------------------------------------------------------------------ */}
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
            <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="#cbd5e1" />
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

          {/* Canvas Floating Quick Legend */}
          <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-xs border border-slate-200 rounded-xl px-3 py-2 shadow-xs hidden md:flex items-center gap-4 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Trigger
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              Condition
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Drip Delay
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Action
            </span>
          </div>
        </main>

        {/* ------------------------------------------------------------------ */}
        {/* RIGHT SETTINGS PANEL: Contextual Inspector when a node is clicked */}
        {/* ------------------------------------------------------------------ */}
        {selectedNode ? (
          <aside className="w-80 sm:w-96 bg-white border-l border-slate-200 shadow-lg z-20 flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-200">
            {/* Panel Header */}
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

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Node Identifier:</span>
                  <span className="font-mono text-[11px] font-bold text-slate-700">
                    {selectedNode.id}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Category:</span>
                  <span className="font-bold text-blue-600 capitalize">{selectedNode.type}</span>
                </div>
              </div>

              {/* 1. DELAY NODE SETTINGS */}
              {selectedNode.type === 'delay' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-900 text-sm">Drip Delay Interval</h4>
                    <p className="text-[11px] text-slate-500">
                      Configure how long the lead will pause before proceeding.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      Delay Value (Number) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={selectedNode.data.delayValue || 5}
                      onChange={(e) => handleUpdateNodeData('delayValue', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      Delay Unit (Time Scale) *
                    </label>
                    <select
                      value={selectedNode.data.delayUnit || 'Minutes'}
                      onChange={(e) => handleUpdateNodeData('delayUnit', e.target.value as DelayUnit)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Minutes">Minutes (e.g. 5, 15, 30 Minutes)</option>
                      <option value="Hours">Hours (e.g. 2, 4, 12 Hours)</option>
                      <option value="Days">Days (e.g. 1, 3, 7 Days)</option>
                    </select>
                  </div>

                  <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Calculated Runner Formula:
                    </div>
                    <div className="text-[11px] font-mono leading-relaxed">
                      nextActionAt = Now + ({selectedNode.data.delayValue || 5} ×{' '}
                      {selectedNode.data.delayUnit === 'Days'
                        ? '86,400,000 ms'
                        : selectedNode.data.delayUnit === 'Hours'
                        ? '3,600,000 ms'
                        : '60,000 ms'}
                      )
                    </div>
                  </div>
                </div>
              )}

              {/* 2. CONDITION NODE SETTINGS */}
              {selectedNode.type === 'condition' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-900 text-sm">Message Keyword Condition</h4>
                    <p className="text-[11px] text-slate-500">
                      Evaluates inbound text and splits workflow execution.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      Required Keyword (e.g. price, yes, ready) *
                    </label>
                    <input
                      type="text"
                      value={selectedNode.data.keyword || ''}
                      onChange={(e) => handleUpdateNodeData('keyword', e.target.value)}
                      placeholder="e.g. price, yes, info"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="p-3.5 bg-indigo-50 rounded-xl border border-indigo-200 text-indigo-900 space-y-2">
                    <div className="font-bold text-xs">Branch Logic:</div>
                    <div className="space-y-1 text-[11px]">
                      <div>
                        &bull; <strong className="text-emerald-700">True (Left):</strong> If message contains "
                        {selectedNode.data.keyword || 'price'}"
                      </div>
                      <div>
                        &bull; <strong className="text-rose-600">False (Right):</strong> If keyword is absent
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. ACTION NODE SETTINGS */}
              {selectedNode.type === 'action' &&
                selectedNode.data.nodeType !== 'action_end' &&
                selectedNode.data.nodeType !== 'action_end_flow' && (

                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-900 text-sm">Message Content & Dispatch</h4>
                    <p className="text-[11px] text-slate-500">
                      Write your reply or launch our ConvertKit-grade Rich Text Editor.
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
                      <option value="action_send_whatsapp">WhatsApp (Baileys / Cloud API)</option>
                      <option value="action_send_email">Email Marketing (Custom Domain / Resend)</option>
                    </select>
                  </div>

                  {/* Custom Domain Email Sender Selector (Me vs Brother on shared domain) */}
                  {selectedNode.data.nodeType === 'action_send_email' && (
                    <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-blue-900">
                          Sender Persona (Shared Domain)
                        </label>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                          Resend API
                        </span>
                      </div>
                      <select
                        value={selectedNode.data.emailSenderPersona || 'me'}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleUpdateNodeData('emailSenderPersona', val);
                          if (val === 'me') {
                            handleUpdateNodeData('fromEmail', 'hello@musa.com');
                            handleUpdateNodeData('fromName', 'Musa Store');
                          } else if (val === 'brother') {
                            handleUpdateNodeData('fromEmail', 'support@musa.com');
                            handleUpdateNodeData('fromName', 'Brother Store');
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="me">Send as Me (hello@passiveincome.work.gd)</option>
                        <option value="brother">Send as Brother (support@passiveincome.work.gd)</option>
                      </select>
                      <div className="text-[10px] text-blue-800 flex items-center justify-between">
                        <span>
                          Active From:{' '}
                          <strong className="font-mono">
                            {selectedNode.data.emailSenderPersona === 'brother'
                              ? 'support@passiveincome.work.gd'
                              : 'hello@passiveincome.work.gd'}
                          </strong>
                        </span>
                        <a
                          href="/dashboard/settings/email"
                          className="underline hover:text-blue-900 font-bold"
                        >
                          Domain DNS
                        </a>
                      </div>
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
                        <span>Open Rich Editor</span>
                      </button>
                    </div>

                    <textarea
                      rows={5}
                      value={selectedNode.data.message || ''}
                      onChange={(e) => handleUpdateNodeData('message', e.target.value)}
                      placeholder="Type your message... supports {{first_name}}, {{company}}, etc."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-sans text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Personalization variable helpers */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500">Insert Quick Token:</span>
                    <div className="flex flex-wrap gap-1">
                      {['{{first_name}}', '{{company}}', '{{phone}}'].map((tok) => (
                        <button
                          key={tok}
                          type="button"
                          onClick={() => {
                            const cur = selectedNode.data.message || '';
                            handleUpdateNodeData('message', `${cur} ${tok} `);
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

              {/* 4. TRIGGER NODE SETTINGS */}
              {selectedNode.type === 'trigger' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-900 text-sm">Trigger Settings</h4>
                    <p className="text-[11px] text-slate-500">
                      Determine when this automation sequence fires.
                    </p>
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
                      <option value="trigger_whatsapp_reply">WhatsApp Inbound Message</option>
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
                        onChange={(e) => handleUpdateNodeData('triggerKeyword', e.target.value)}
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
          /* Empty Inspector State */
          <aside className="w-72 bg-white border-l border-slate-200 p-6 hidden lg:flex flex-col items-center justify-center text-center text-slate-400 shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3 text-slate-400">
              <Sliders className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-bold text-slate-700 mb-1">No Node Selected</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-[200px]">
              Click any node card on the canvas to configure wait delays, message content, or conditions.
            </p>
          </aside>
        )}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL: EMBEDDED RICH EMAIL EDITOR */}
      {/* ---------------------------------------------------------------------- */}
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

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL: SIMULATE / TEST RUN WORKFLOW */}
      {/* ---------------------------------------------------------------------- */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Simulate Workflow Execution</h3>
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
                <label className="block font-bold text-slate-700 mb-1">Simulated Lead Phone</label>
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
    </div>
  );
};

export default AutomationBuilderUI;
