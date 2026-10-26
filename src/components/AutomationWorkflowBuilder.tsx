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
} from 'lucide-react';
import { DelayUnit, WorkflowNodeType, WorkflowRecord, FollowUpJobRecord } from '../lib/automation/types';

// ============================================================================
// CUSTOM NODE COMPONENTS FOR CANVAS
// ============================================================================

export type FlowCustomNode = Node<Record<string, any>>;

const TriggerNodeComponent = ({ data, selected }: NodeProps<FlowCustomNode>) => {
  const isKeyword = data.nodeType === 'trigger_keyword';
  const isEmail = data.nodeType === 'trigger_email_reply';

  return (
    <div
      className={`min-w-[240px] rounded-xl bg-white dark:bg-slate-900 border-2 shadow-md transition-all ${
        selected
          ? 'border-emerald-500 shadow-emerald-500/20 shadow-lg'
          : 'border-emerald-200 dark:border-emerald-800/80 hover:border-emerald-400'
      }`}
    >
      <div className="px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-100 dark:border-emerald-900/60 rounded-t-lg flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          Trigger
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 font-medium">
          Start
        </span>
      </div>
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          {isEmail ? (
            <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          )}
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {data.label || 'WhatsApp Inbound Message'}
          </span>
        </div>
        {isKeyword && (
          <div className="mt-2 text-xs bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <span className="text-slate-400">Keyword:</span>
            <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
              "{data.triggerKeyword || 'price'}"
            </span>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-emerald-500 border-2 !border-white dark:!border-slate-900"
      />
    </div>
  );
};

const ConditionNodeComponent = ({ data, selected }: NodeProps<FlowCustomNode>) => {
  return (
    <div
      className={`min-w-[240px] rounded-xl bg-white dark:bg-slate-900 border-2 shadow-md transition-all ${
        selected
          ? 'border-indigo-500 shadow-indigo-500/20 shadow-lg'
          : 'border-indigo-200 dark:border-indigo-800/80 hover:border-indigo-400'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-indigo-500 border-2 !border-white dark:!border-slate-900"
      />
      <div className="px-3.5 py-2.5 bg-indigo-50 dark:bg-indigo-950/60 border-b border-indigo-100 dark:border-indigo-900/60 rounded-t-lg flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
          <Split className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          Condition
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-200/60 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-200 font-medium">
          Branch
        </span>
      </div>
      <div className="p-3.5">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
          Message Contains
        </span>
        <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white font-mono bg-indigo-50/50 dark:bg-indigo-950/40 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-900/40">
          "{data.keyword || 'price'}"
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Yes (Matches)
          </span>
          <span className="text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            No
          </span>
        </div>
      </div>
      {/* Two outputs: True (Left) and False (Right) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: '25%' }}
        className="w-3 h-3 !bg-emerald-500 border-2 !border-white dark:!border-slate-900"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: '75%' }}
        className="w-3 h-3 !bg-rose-500 border-2 !border-white dark:!border-slate-900"
      />
    </div>
  );
};

const DelayNodeComponent = ({ data, selected }: NodeProps<FlowCustomNode>) => {
  const value = data.delayValue || 5;
  const unit: string = (data.delayUnit as string) || 'Minutes';

  return (
    <div
      className={`min-w-[240px] rounded-xl bg-white dark:bg-slate-900 border-2 shadow-md transition-all ${
        selected
          ? 'border-amber-500 shadow-amber-500/20 shadow-lg'
          : 'border-amber-200 dark:border-amber-800/80 hover:border-amber-400'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-amber-500 border-2 !border-white dark:!border-slate-900"
      />
      <div className="px-3.5 py-2.5 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-100 dark:border-amber-900/60 rounded-t-lg flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          Delay Drip
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/60 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 font-medium">
          Timer
        </span>
      </div>
      <div className="p-3.5">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
          Wait Duration
        </span>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
            {value}
          </span>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {unit}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          Holds follow-up until {value} {unit.toLowerCase()} elapse
        </p>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-amber-500 border-2 !border-white dark:!border-slate-900"
      />
    </div>
  );
};

const ActionNodeComponent = ({ data, selected }: NodeProps<FlowCustomNode>) => {
  const isEnd = data.nodeType === 'action_end_flow';
  const isEmail = data.nodeType === 'action_send_email';

  return (
    <div
      className={`min-w-[240px] rounded-xl bg-white dark:bg-slate-900 border-2 shadow-md transition-all ${
        selected
          ? isEnd
            ? 'border-slate-500 shadow-slate-500/20 shadow-lg'
            : 'border-blue-500 shadow-blue-500/20 shadow-lg'
          : isEnd
          ? 'border-slate-300 dark:border-slate-700 hover:border-slate-400'
          : 'border-blue-200 dark:border-blue-800/80 hover:border-blue-400'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={`w-3 h-3 border-2 !border-white dark:!border-slate-900 ${
          isEnd ? '!bg-slate-500' : '!bg-blue-500'
        }`}
      />
      <div
        className={`px-3.5 py-2.5 border-b rounded-t-lg flex items-center justify-between ${
          isEnd
            ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
            : 'bg-blue-50 dark:bg-blue-950/60 border-blue-100 dark:border-blue-900/60'
        }`}
      >
        <span
          className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
            isEnd
              ? 'text-slate-700 dark:text-slate-300'
              : 'text-blue-700 dark:text-blue-300'
          }`}
        >
          {isEnd ? (
            <X className="w-3.5 h-3.5" />
          ) : isEmail ? (
            <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          ) : (
            <Send className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          )}
          {isEnd ? 'End' : 'Action'}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 font-medium">
          {isEnd ? 'Exit' : 'Dispatch'}
        </span>
      </div>
      <div className="p-3.5">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          {data.label || (isEnd ? 'End Flow' : 'Send WhatsApp Message')}
        </div>
        {!isEnd && (
          <div className="mt-2 text-xs bg-slate-50 dark:bg-slate-800/50 p-2 rounded text-slate-600 dark:text-slate-300 line-clamp-2 border border-slate-100 dark:border-slate-800">
            {data.message || 'Thank you for reaching out! Here is your requested info...'}
          </div>
        )}
      </div>
      {!isEnd && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-blue-500 border-2 !border-white dark:!border-slate-900"
        />
      )}
    </div>
  );
};

// ============================================================================
// MAIN AUTOMATION WORKFLOW BUILDER VIEW
// ============================================================================

interface AutomationWorkflowBuilderProps {
  userId?: string;
  initialWorkflowId?: string;
  onBack?: () => void;
  onSaved?: (workflow: WorkflowRecord) => void;
}

export const AutomationWorkflowBuilder: React.FC<AutomationWorkflowBuilderProps> = ({
  userId = 'default_workspace',
  initialWorkflowId,
  onBack,
  onSaved,
}) => {
  // Top bar state
  const [workflowId, setWorkflowId] = useState<string>(initialWorkflowId || `wf_${Date.now()}`);
  const [workflowName, setWorkflowName] = useState<string>('WhatsApp Lead Drip Flow');
  const [enabled, setEnabled] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Modals & Panels
  const [selectedNode, setSelectedNode] = useState<FlowCustomNode | null>(null);
  const [testModalOpen, setTestModalOpen] = useState<boolean>(false);
  const [queueModalOpen, setQueueModalOpen] = useState<boolean>(false);
  const [testPhone, setTestPhone] = useState<string>('2348012345678');
  const [testLeadMessage, setTestLeadMessage] = useState<string>('Hello! What is your price?');
  const [testRunning, setTestRunning] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [followUpJobs, setFollowUpJobs] = useState<FollowUpJobRecord[]>([]);

  // Node types registration for React Flow
  const nodeTypes = useMemo(
    () => ({
      triggerNode: TriggerNodeComponent as any,
      conditionNode: ConditionNodeComponent as any,
      delayNode: DelayNodeComponent as any,
      actionNode: ActionNodeComponent as any,
    }),
    []
  );

  // Initial starter workflow nodes
  const initialNodes: FlowCustomNode[] = useMemo(
    () => [
      {
        id: 'node-1',
        type: 'triggerNode',
        position: { x: 300, y: 50 },
        data: {
          label: 'WhatsApp Reply',
          nodeType: 'trigger_whatsapp_reply',
          triggerKeyword: '',
        },
      },
      {
        id: 'node-2',
        type: 'conditionNode',
        position: { x: 300, y: 190 },
        data: {
          label: 'Message Contains',
          nodeType: 'condition_message_contains',
          keyword: 'price',
        },
      },
      {
        id: 'node-3',
        type: 'actionNode',
        position: { x: 140, y: 350 },
        data: {
          label: 'Send WhatsApp Message',
          nodeType: 'action_send_whatsapp',
          message: 'Hi! Our price is N15,000. Pay here: https://pay.flowpilot.app',
        },
      },
      {
        id: 'node-4',
        type: 'delayNode',
        position: { x: 140, y: 500 },
        data: {
          label: 'Wait Node',
          nodeType: 'delay_wait',
          delayValue: 5,
          delayUnit: 'Minutes' as DelayUnit,
        },
      },
      {
        id: 'node-5',
        type: 'actionNode',
        position: { x: 140, y: 670 },
        data: {
          label: 'Send WhatsApp Message',
          nodeType: 'action_send_whatsapp',
          message: 'Just following up! Did you get the payment link? Let me know if you have questions.',
        },
      },
      {
        id: 'node-6',
        type: 'actionNode',
        position: { x: 480, y: 350 },
        data: {
          label: 'End Flow',
          nodeType: 'action_end_flow',
        },
      },
    ],
    []
  );

  const initialEdges: Edge[] = useMemo(
    () => [
      { id: 'e1-2', source: 'node-1', target: 'node-2', animated: true },
      { id: 'e2-3', source: 'node-2', target: 'node-3', sourceHandle: 'true', animated: true },
      { id: 'e2-6', source: 'node-2', target: 'node-6', sourceHandle: 'false' },
      { id: 'e3-4', source: 'node-3', target: 'node-4', animated: true },
      { id: 'e4-5', source: 'node-4', target: 'node-5', animated: true },
    ],
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowCustomNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Load existing workflow if ID is provided
  useEffect(() => {
    if (!initialWorkflowId) return;

    fetch(`/api/workflows/${encodeURIComponent(initialWorkflowId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.workflow) {
          setWorkflowId(data.workflow.id);
          setWorkflowName(data.workflow.name);
          setEnabled(Boolean(data.workflow.enabled));
          try {
            const parsedNodes = JSON.parse(data.workflow.nodesJson);
            const parsedEdges = JSON.parse(data.workflow.edgesJson);
            if (Array.isArray(parsedNodes) && parsedNodes.length > 0) setNodes(parsedNodes);
            if (Array.isArray(parsedEdges)) setEdges(parsedEdges);
          } catch {
            // Non-fatal
          }
        }
      })
      .catch((err) => console.warn('Failed to load workflow:', err));
  }, [initialWorkflowId, setNodes, setEdges]);

  // Connect edges
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  // Click on node to show settings panel
  const onNodeClick = useCallback((_: React.MouseEvent, node: FlowCustomNode) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Add node from left sidebar
  const handleAddNode = (nodeType: WorkflowNodeType, label: string) => {
    const id = `node-${Date.now().toString(36)}`;
    const posY = nodes.length > 0 ? Math.max(...nodes.map((n) => n.position.y)) + 120 : 100;
    const posX = 300;

    let category = 'actionNode';
    let defaultData: any = { label, nodeType };

    if (nodeType.startsWith('trigger_')) {
      category = 'triggerNode';
      defaultData = { label, nodeType, triggerKeyword: '' };
    } else if (nodeType.startsWith('condition_')) {
      category = 'conditionNode';
      defaultData = { label, nodeType, keyword: 'price', matchType: 'contains' };
    } else if (nodeType === 'delay_wait') {
      category = 'delayNode';
      defaultData = { label: 'Wait Node', nodeType, delayValue: 5, delayUnit: 'Minutes' as DelayUnit };
    } else if (nodeType === 'action_end_flow') {
      category = 'actionNode';
      defaultData = { label: 'End Flow', nodeType };
    } else {
      category = 'actionNode';
      defaultData = { label, nodeType, message: 'Hi there, thank you for contacting us!' };
    }

    const newNode: Node = {
      id,
      type: category,
      position: { x: posX, y: posY },
      data: defaultData,
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNode(newNode);
  };

  // Update selected node data
  const updateSelectedNodeData = (updates: Record<string, any>) => {
    if (!selectedNode) return;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          const nextData = { ...node.data, ...updates };
          setSelectedNode({ ...node, data: nextData });
          return { ...node, data: nextData };
        }
        return node;
      })
    );
  };

  // Delete selected node
  const handleDeleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  // Save workflow to backend DB table workflows
  const handleSaveWorkflow = async () => {
    setSaving(true);
    setSaveSuccessNotice(null);

    const payload = {
      id: workflowId,
      userId,
      name: workflowName.trim() || 'Untitled Workflow',
      nodesJson: JSON.stringify(nodes),
      edgesJson: JSON.stringify(edges),
      enabled,
    };

    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setSaveSuccessNotice('Workflow saved successfully!');
        if (onSaved && data.workflow) {
          onSaved(data.workflow);
        }
        setTimeout(() => setSaveSuccessNotice(null), 3000);
      } else {
        alert(data.error || 'Failed to save workflow');
      }
    } catch (err: any) {
      alert(`Network error saving workflow: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Load Follow-Up Drip Queue
  const fetchFollowUpQueue = async () => {
    try {
      const res = await fetch('/api/followup-jobs');
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.jobs)) {
          setFollowUpJobs(data.jobs);
        }
      }
    } catch {
      // Non-fatal
    }
  };

  // Execute test run
  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestRunning(true);
    setTestResult(null);

    // Save current workflow first
    await handleSaveWorkflow();

    try {
      const res = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          leadPhone: testPhone,
          leadMessage: testLeadMessage,
          userId,
        }),
      });

      const data = await res.json();
      setTestResult(data);
      fetchFollowUpQueue();
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTestRunning(false);
    }
  };

  // Trigger Follow-up Cron manually
  const handleTriggerCronNow = async () => {
    try {
      const res = await fetch('/api/cron/followup', { method: 'POST' });
      const data = await res.json();
      alert(`Cron Executed! Processed: ${data.processedCount || 0}, Sent: ${data.sentCount || 0}`);
      fetchFollowUpQueue();
    } catch (err: any) {
      alert(`Cron error: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] bg-slate-50 dark:bg-[#090D16] overflow-hidden -m-6 sm:-m-8">
      {/* ==================================================================== */}
      {/* 1. TOP BAR                                                           */}
      {/* ==================================================================== */}
      <header className="h-16 px-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Back to Automations"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <Sparkles className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="text-base sm:text-lg font-bold bg-transparent text-slate-900 dark:text-white border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:outline-none px-1 py-0.5 rounded transition-all max-w-[280px] sm:max-w-md"
              placeholder="Workflow Name..."
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Enable / Disable Toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {enabled ? 'Active' : 'Disabled'}
            </span>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`transition-colors ${enabled ? 'text-emerald-500' : 'text-slate-400'}`}
              title={enabled ? 'Click to disable workflow' : 'Click to enable workflow'}
            >
              {enabled ? (
                <ToggleRight className="w-6 h-6" />
              ) : (
                <ToggleLeft className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* Drip Queue Inspector */}
          <button
            onClick={() => {
              fetchFollowUpQueue();
              setQueueModalOpen(true);
            }}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
          >
            <Clock className="w-4 h-4" />
            Drip Queue
          </button>

          {/* Test Run Flow */}
          <button
            onClick={() => setTestModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Test Flow
          </button>

          {/* Save Workflow */}
          <button
            onClick={handleSaveWorkflow}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Workflow'}
          </button>
        </div>
      </header>

      {/* Save Notice banner */}
      {saveSuccessNotice && (
        <div className="bg-emerald-500 text-white text-xs font-semibold px-4 py-1.5 text-center flex items-center justify-center gap-1.5 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          {saveSuccessNotice}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. THREE-PANE BUILDER LAYOUT (SIDEBAR | CANVAS | SETTINGS)           */}
      {/* ==================================================================== */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT SIDEBAR: NODE LIBRARY */}
        <aside className="w-64 sm:w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 z-10 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Node Library
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Click any node to place it directly onto your canvas.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* 1. Triggers */}
            <div>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-2">
                Triggers
              </span>
              <div className="space-y-2">
                <button
                  onClick={() => handleAddNode('trigger_whatsapp_reply', 'WhatsApp Reply')}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-all flex items-center gap-2.5 group"
                >
                  <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                    <MessageSquare className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      WhatsApp Reply
                    </span>
                    <span className="text-[10px] text-slate-400 block">Lead messages via WhatsApp</span>
                  </div>
                </button>

                <button
                  onClick={() => handleAddNode('trigger_keyword', 'Keyword Trigger')}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-all flex items-center gap-2.5 group"
                >
                  <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                    <Zap className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      Keyword Trigger
                    </span>
                    <span className="text-[10px] text-slate-400 block">Matches specific inbound word</span>
                  </div>
                </button>

                <button
                  onClick={() => handleAddNode('trigger_email_reply', 'Email Reply')}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-all flex items-center gap-2.5 group"
                >
                  <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      Email Reply
                    </span>
                    <span className="text-[10px] text-slate-400 block">Lead replies via email</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Conditions */}
            <div>
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block mb-2">
                Conditions
              </span>
              <div className="space-y-2">
                <button
                  onClick={() => handleAddNode('condition_message_contains', 'Message Contains')}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-all flex items-center gap-2.5 group"
                >
                  <span className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    <Split className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      Message Contains
                    </span>
                    <span className="text-[10px] text-slate-400 block">Branch on keywords e.g. price</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. Delay Node (Minutes, Hours, Days) */}
            <div>
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-2">
                Delay & Drip
              </span>
              <div className="space-y-2">
                <button
                  onClick={() => handleAddNode('delay_wait', 'Wait Node')}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-all flex items-center gap-2.5 group"
                >
                  <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                    <Clock className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block group-hover:text-amber-600 dark:group-hover:text-amber-400">
                      Wait Node
                    </span>
                    <span className="text-[10px] text-slate-400 block">Drip: Minutes, Hours, Days</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 4. Actions */}
            <div>
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-2">
                Actions
              </span>
              <div className="space-y-2">
                <button
                  onClick={() => handleAddNode('action_send_whatsapp', 'Send WhatsApp Message')}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-all flex items-center gap-2.5 group"
                >
                  <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                    <Send className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      Send WhatsApp Message
                    </span>
                    <span className="text-[10px] text-slate-400 block">Automated WhatsApp reply</span>
                  </div>
                </button>

                <button
                  onClick={() => handleAddNode('action_send_email', 'Send Email')}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-all flex items-center gap-2.5 group"
                >
                  <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      Send Email
                    </span>
                    <span className="text-[10px] text-slate-400 block">Deliver via connected email</span>
                  </div>
                </button>

                <button
                  onClick={() => handleAddNode('action_end_flow', 'End Flow')}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-2.5 group"
                >
                  <span className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    <X className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      End Flow
                    </span>
                    <span className="text-[10px] text-slate-400 block">Halt workflow execution</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER: REACT FLOW CANVAS */}
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
            className="bg-slate-50 dark:bg-[#080C14]"
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#94a3b833" />
            <Controls className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 !rounded-xl !shadow-sm" />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === 'triggerNode') return '#10b981';
                if (n.type === 'conditionNode') return '#6366f1';
                if (n.type === 'delayNode') return '#f59e0b';
                return '#3b82f6';
              }}
              className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 !rounded-xl"
            />
          </ReactFlow>

          {/* Quick Help Overlay */}
          <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] px-3 py-1.5 rounded-lg shadow-sm pointer-events-none">
            💡 Tip: Drag handles to connect nodes. Click any node to configure its inputs.
          </div>
        </main>

        {/* RIGHT SETTINGS PANEL */}
        {selectedNode ? (
          <aside className="w-80 sm:w-88 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 z-10 shadow-lg animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Node Settings
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  ID: {selectedNode.id}
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-5">
              {/* Common: Label */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Node Label
                </label>
                <input
                  type="text"
                  value={selectedNode.data?.label || ''}
                  onChange={(e) => updateSelectedNodeData({ label: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* SPECIFIC SETTINGS: DELAY NODE */}
              {selectedNode.type === 'delayNode' && (
                <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-4">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-xs uppercase tracking-wider">
                    <Clock className="w-4 h-4" />
                    Configure Drip Delay
                  </div>

                  {/* 2 Inputs: Number Input & Unit Dropdown */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Delay Value
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={selectedNode.data?.delayValue ?? 5}
                        onChange={(e) =>
                          updateSelectedNodeData({
                            delayValue: Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                        className="w-full text-sm font-bold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-center"
                        placeholder="5"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Time Unit
                      </label>
                      <select
                        value={selectedNode.data?.delayUnit || 'Minutes'}
                        onChange={(e) =>
                          updateSelectedNodeData({ delayUnit: e.target.value as DelayUnit })
                        }
                        className="w-full text-xs font-semibold px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="Minutes">Minutes</option>
                        <option value="Hours">Hours</option>
                        <option value="Days">Days</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                      Quick Drip Presets
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { val: 5, unit: 'Minutes' as DelayUnit },
                        { val: 30, unit: 'Minutes' as DelayUnit },
                        { val: 2, unit: 'Hours' as DelayUnit },
                        { val: 1, unit: 'Days' as DelayUnit },
                        { val: 3, unit: 'Days' as DelayUnit },
                      ].map((preset) => (
                        <button
                          key={`${preset.val}-${preset.unit}`}
                          type="button"
                          onClick={() =>
                            updateSelectedNodeData({
                              delayValue: preset.val,
                              delayUnit: preset.unit,
                            })
                          }
                          className="px-2 py-1 text-[11px] font-medium rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 hover:bg-amber-100 text-amber-800 dark:text-amber-200 text-center"
                        >
                          {preset.val} {preset.unit}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-800 dark:text-amber-300/80 leading-relaxed">
                    When this node is hit, FlowPilot creates a scheduled follow-up job and automatically sends the next connected message after{' '}
                    <strong>
                      {selectedNode.data?.delayValue || 5} {selectedNode.data?.delayUnit || 'Minutes'}
                    </strong>
                    .
                  </p>
                </div>
              )}

              {/* SPECIFIC SETTINGS: SEND MESSAGE NODE */}
              {selectedNode.type === 'actionNode' &&
                selectedNode.data?.nodeType !== 'action_end_flow' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center justify-between">
                        <span>Message Text</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {(selectedNode.data?.message || '').length} chars
                        </span>
                      </label>
                      <textarea
                        rows={5}
                        value={selectedNode.data?.message || ''}
                        onChange={(e) => updateSelectedNodeData({ message: e.target.value })}
                        className="w-full text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
                        placeholder="Type message to send to lead..."
                      />
                    </div>

                    {/* Personalization chips */}
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                        Insert Placeholders
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {['{{name}}', '{{phone}}', '{{email}}', '{{company}}'].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              const curr = selectedNode.data?.message || '';
                              updateSelectedNodeData({ message: `${curr} ${tag}` });
                            }}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-mono"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              {/* SPECIFIC SETTINGS: CONDITION NODE */}
              {selectedNode.type === 'conditionNode' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Trigger Keyword
                    </label>
                    <input
                      type="text"
                      value={selectedNode.data?.keyword || ''}
                      onChange={(e) => updateSelectedNodeData({ keyword: e.target.value })}
                      className="w-full text-xs font-mono font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. price, demo, discount"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    If lead message contains this keyword, the workflow follows the <strong>green True branch</strong>. Otherwise it proceeds down the <strong>red False branch</strong>.
                  </p>
                </div>
              )}

              {/* SPECIFIC SETTINGS: TRIGGER KEYWORD */}
              {selectedNode.data?.nodeType === 'trigger_keyword' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Match Keyword
                  </label>
                  <input
                    type="text"
                    value={selectedNode.data?.triggerKeyword || ''}
                    onChange={(e) => updateSelectedNodeData({ triggerKeyword: e.target.value })}
                    className="w-full text-xs font-mono font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. order, quote, help"
                  />
                </div>
              )}

              {/* Delete Node Button */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleDeleteSelectedNode}
                  className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Node
                </button>
              </div>
            </div>
          </aside>
        ) : (
          <aside className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 hidden lg:flex flex-col shrink-0 p-5 text-center items-center justify-center text-slate-400 dark:text-slate-500">
            <Layers className="w-10 h-10 stroke-[1.5] mb-2 opacity-50" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Select any node on the canvas to customize its settings, delay drip time, or message content.
            </p>
          </aside>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 3. TEST RUN FLOW MODAL                                               */}
      {/* ==================================================================== */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                  <Play className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Test Run Workflow
                </h3>
              </div>
              <button
                onClick={() => setTestModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRunTest} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Lead Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="2348012345678"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Simulated Inbound Message
                </label>
                <textarea
                  rows={3}
                  required
                  value={testLeadMessage}
                  onChange={(e) => setTestLeadMessage(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="Hi, how much is this product?"
                />
              </div>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    testResult.ok && testResult.result?.executed
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {testResult.ok && testResult.result?.executed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    )}
                    {testResult.ok && testResult.result?.executed
                      ? 'Workflow Executed Successfully!'
                      : 'Workflow Execution Stopped'}
                  </div>

                  {testResult.result && (
                    <div className="space-y-1 font-mono text-[11px]">
                      <div>
                        Immediate Actions:{' '}
                        <strong>
                          {testResult.result.immediateActionsDispatched?.length || 0}
                        </strong>
                      </div>
                      <div>
                        Scheduled Drip Jobs:{' '}
                        <strong>{testResult.result.scheduledJobs?.length || 0}</strong>
                      </div>
                      {testResult.result.scheduledJobs?.length > 0 && (
                        <div className="text-amber-700 dark:text-amber-300">
                          Next Drip Action:{' '}
                          {new Date(
                            testResult.result.scheduledJobs[0].nextActionAt
                          ).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  )}

                  {testResult.error && <div>{testResult.error}</div>}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={testRunning}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  {testRunning ? 'Simulating...' : 'Simulate Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. DRIP QUEUE INSPECTOR MODAL                                        */}
      {/* ==================================================================== */}
      {queueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600">
                  <Clock className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Follow-Up Drip Queue (Cron Engine)
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Runs every 60 seconds automatically on the server
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTriggerCronNow}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                >
                  Run Cron Now
                </button>
                <button
                  onClick={() => setQueueModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 flex-1 overflow-y-auto">
              {followUpJobs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No follow-up drip jobs scheduled yet. Test a flow with a Wait Node to queue jobs!
                </div>
              ) : (
                <div className="space-y-3">
                  {followUpJobs.map((job) => {
                    const isPending = job.status === 'pending';
                    const isDue = job.nextActionAt <= Date.now();

                    return (
                      <div
                        key={job.id}
                        className={`p-3.5 rounded-xl border text-xs ${
                          isPending
                            ? isDue
                              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
                              : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                            +{job.leadPhone.replace(/[^0-9]/g, '')}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              isPending
                                ? isDue
                                  ? 'bg-amber-200 text-amber-900'
                                  : 'bg-blue-200 text-blue-900'
                                : 'bg-emerald-200 text-emerald-900'
                            }`}
                          >
                            {isPending ? (isDue ? 'Due Now' : 'Scheduled') : 'Sent'}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mb-2 font-sans line-clamp-2">
                          "{job.message}"
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>
                            Drip: {job.delayValue} {job.delayUnit}
                          </span>
                          <span>
                            Trigger At: {new Date(job.nextActionAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
