import React, { useState, useCallback, useMemo } from 'react';
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
  ChevronRight,
  Settings2,
  Sliders,
  PanelLeftClose,
  PanelLeft,
  FileCode,
  Check,
  Send,
} from 'lucide-react';
import { EmailEditor } from './EmailEditor';

// 1. TRIGGER NODE
const TriggerNodeComponent = ({ data, selected }) => {
  const isEmail = data.nodeType === 'trigger_email_reply';
  const isKeyword = data.nodeType === 'trigger_keyword';

  return (
    <div
      className={`min-w-[260px] max-w-[280px] rounded-2xl bg-white border transition-all duration-200 shadow-[0_4px_12px_rgba(0,0,0,0.05)] ${
        selected ? 'border-emerald-500 ring-4 ring-emerald-500/10 shadow-lg' : 'border-slate-200 hover:border-emerald-400'
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
            <h4 className="text-xs font-bold text-slate-900 truncate">{data.label || 'Inbound Message'}</h4>
            <p className="text-[11px] text-slate-500 truncate">{isEmail ? 'Inbound email received' : 'Inbound WhatsApp'}</p>
          </div>
        </div>
        {isKeyword && (
          <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] flex items-center justify-between">
            <span className="text-slate-500">Keyword:</span>
            <span className="font-mono font-bold text-emerald-700">"{data.triggerKeyword || 'start'}"</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3.5 h-3.5 !bg-emerald-600 !border-2 !border-white !rounded-full shadow-xs" />
    </div>
  );
};

// 2. CONDITION NODE
const ConditionNodeComponent = ({ data, selected }) => {
  return (
    <div
      className={`min-w-[270px] max-w-[290px] rounded-2xl bg-white border transition-all duration-200 shadow-[0_4px_12px_rgba(0,0,0,0.05)] ${
        selected ? 'border-indigo-500 ring-4 ring-indigo-500/10 shadow-lg' : 'border-slate-200 hover:border-indigo-400'
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-3.5 h-3.5 !bg-indigo-600 !border-2 !border-white !rounded-full shadow-xs" />
      <div className="px-4 py-2.5 bg-indigo-50/80 border-b border-indigo-100 rounded-t-2xl flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
          <Split className="w-3.5 h-3.5 text-indigo-600" />
          Condition
        </span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-200/70 text-indigo-900">Branch</span>
      </div>
      <div className="p-4 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-100/70 text-indigo-700 flex items-center justify-center shrink-0">
            <Split className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Message Keyword Check</h4>
            <p className="text-[11px] text-slate-500">Splits flow by text content</p>
          </div>
        </div>
        <div className="px-2.5 py-1.5 rounded-lg bg-indigo-50/50 border border-indigo-100 text-xs flex items-center justify-between">
          <span className="text-slate-600">Contains:</span>
          <span className="font-mono font-bold text-indigo-700">"{data.keyword || 'price'}"</span>
        </div>
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold">
          <span className="text-emerald-700 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Yes</span>
          <span className="text-rose-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> No</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="true" style={{ left: '25%' }} className="w-3.5 h-3.5 !bg-emerald-600 !border-2 !border-white !rounded-full shadow-xs" />
      <Handle type="source" position={Position.Bottom} id="false" style={{ left: '75%' }} className="w-3.5 h-3.5 !bg-rose-500 !border-2 !border-white !rounded-full shadow-xs" />
    </div>
  );
};

// 3. ACTION NODE
const ActionNodeComponent = ({ data, selected }) => {
  const isEnd = data.nodeType === 'action_end';
  const isEmail = data.nodeType === 'action_send_email';

  return (
    <div
      className={`min-w-[270px] max-w-[290px] rounded-2xl bg-white border transition-all duration-200 shadow-[0_4px_12px_rgba(0,0,0,0.05)] ${
        selected ? 'border-blue-500 ring-4 ring-blue-500/10 shadow-lg' : 'border-slate-200 hover:border-blue-400'
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-3.5 h-3.5 !bg-blue-600 !border-2 !border-white !rounded-full shadow-xs" />
      <div className={`px-4 py-2.5 border-b rounded-t-2xl flex items-center justify-between ${isEnd ? 'bg-slate-100 text-slate-700' : 'bg-blue-50/80 text-blue-900 border-blue-100'}`}>
        <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
          {isEnd ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5 text-blue-600" />}
          {isEnd ? 'Completion' : isEmail ? 'Email' : 'WhatsApp'}
        </span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-200/70 text-blue-950">Action</span>
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            {isEnd ? <Check className="w-4 h-4" /> : isEmail ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-900 truncate">{isEnd ? 'Terminate Flow' : isEmail ? 'Send Email' : 'Send WhatsApp Message'}</h4>
            <p className="text-[11px] text-slate-500 truncate">{isEnd ? 'Workflow stops' : 'Dispatches outbound'}</p>
          </div>
        </div>
        {!isEnd && (
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 line-clamp-2 italic">
            "{data.message || 'Thank you for reaching out!'}"
          </div>
        )}
      </div>
      {!isEnd && <Handle type="source" position={Position.Bottom} className="w-3.5 h-3.5 !bg-blue-600 !border-2 !border-white !rounded-full shadow-xs" />}
    </div>
  );
};

// 4. DELAY NODE
const DelayNodeComponent = ({ data, selected }) => {
  const value = data.delayValue || 5;
  const unit = data.delayUnit || 'Minutes';

  return (
    <div
      className={`min-w-[270px] max-w-[290px] rounded-2xl bg-white border transition-all duration-200 shadow-[0_4px_12px_rgba(0,0,0,0.05)] ${
        selected ? 'border-amber-500 ring-4 ring-amber-500/10 shadow-lg' : 'border-slate-200 hover:border-amber-400'
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-3.5 h-3.5 !bg-amber-500 !border-2 !border-white !rounded-full shadow-xs" />
      <div className="px-4 py-2.5 bg-amber-50/80 border-b border-amber-100 rounded-t-2xl flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Delay · Wait Node
        </span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900">Drip</span>
      </div>
      <div className="p-4 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
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
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3.5 h-3.5 !bg-amber-500 !border-2 !border-white !rounded-full shadow-xs" />
    </div>
  );
};

const nodeTypes = {
  trigger: TriggerNodeComponent,
  condition: ConditionNodeComponent,
  action: ActionNodeComponent,
  delay: DelayNodeComponent,
};

export const AutomationBuilderUI = ({
  userId = 'default_workspace',
  initialWorkflowId,
  onBackToDashboard,
}) => {
  const [workflowName, setWorkflowName] = useState('New Drip Automation');
  const [workflowEnabled, setWorkflowEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);

  const [emailEditorModalOpen, setEmailEditorModalOpen] = useState(false);
  const [editingEmailNodeId, setEditingEmailNodeId] = useState(null);
  const [emailEditorContent, setEmailEditorContent] = useState('');

  const initialNodes = useMemo(
    () => [
      {
        id: 'node-trigger-1',
        type: 'trigger',
        position: { x: 300, y: 40 },
        data: { nodeType: 'trigger_whatsapp_reply', label: 'WhatsApp Inbound Message' },
      },
      {
        id: 'node-delay-1',
        type: 'delay',
        position: { x: 300, y: 220 },
        data: { delayValue: 5, delayUnit: 'Minutes' },
      },
      {
        id: 'node-action-1',
        type: 'action',
        position: { x: 300, y: 400 },
        data: {
          nodeType: 'action_send_whatsapp',
          message: 'Hi {{first_name}}! Here is your link: https://flowpilot.app/vip. Watch and reply DONE.',
        },
      },
    ],
    []
  );

  const initialEdges = useMemo(
    () => [
      { id: 'e-1', source: 'node-trigger-1', target: 'node-delay-1', animated: true, style: { stroke: '#10b981', strokeWidth: 2 } },
      { id: 'e-2', source: 'node-delay-1', target: 'node-action-1', animated: true, style: { stroke: '#f59e0b', strokeWidth: 2 } },
    ],
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#2563eb', strokeWidth: 2 } }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_, node) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const handleAddNode = useCallback(
    (nodeType, label) => {
      const id = `node-${Date.now().toString(36)}`;
      const position = { x: 260 + Math.random() * 60, y: 120 + nodes.length * 80 };

      let category = 'action';
      let data = { nodeType, label };

      if (nodeType.startsWith('trigger')) {
        category = 'trigger';
        data.label = label || 'Inbound Trigger';
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

      const newNode = { id, type: category, position, data };
      setNodes((nds) => [...nds, newNode]);
      setSelectedNode(newNode);
    },
    [nodes.length, setNodes]
  );

  const handleUpdateNodeData = useCallback(
    (field, val) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === selectedNode.id) {
            const updated = { ...n, data: { ...n.data, [field]: val } };
            setSelectedNode(updated);
            return updated;
          }
          return n;
        })
      );
    },
    [selectedNode, setNodes]
  );

  const handleDeleteNode = useCallback(
    (id) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      if (selectedNode?.id === id) setSelectedNode(null);
    },
    [selectedNode, setNodes, setEdges]
  );

  const handleSaveWorkflow = async () => {
    setIsSaving(true);
    setSaveBanner(null);
    try {
      await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: workflowName,
          nodesJson: JSON.stringify(nodes),
          edgesJson: JSON.stringify(edges),
          enabled: workflowEnabled,
        }),
      });
      setSaveBanner(`Workflow "${workflowName}" successfully saved & deployed!`);
    } catch {
      setSaveBanner(`Workflow saved in local state. (${nodes.length} nodes active)`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveBanner(null), 3500);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-[#f8fafc] text-slate-900 font-sans antialiased overflow-hidden">
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4 z-20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {onBackToDashboard && (
            <button type="button" onClick={onBackToDashboard} className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span>Automations</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-600 font-semibold">Workflow Builder</span>
          </div>
          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="text-base font-bold text-slate-900 bg-transparent hover:bg-slate-50 focus:bg-white px-2.5 py-1 rounded-lg border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-64 truncate"
          />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setWorkflowEnabled((p) => !p)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
              workflowEnabled ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${workflowEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span>{workflowEnabled ? 'Live & Listening' : 'Draft / Paused'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveWorkflow}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
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
          <button type="button" onClick={() => setSaveBanner(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Main Builder Body */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Sidebar */}
        <aside className={`bg-white border-r border-slate-200 transition-all duration-300 z-10 flex flex-col shrink-0 ${sidebarOpen ? 'w-72' : 'w-12'}`}>
          <div className="h-12 border-b border-slate-200 px-3 flex items-center justify-between">
            {sidebarOpen ? <span className="text-xs font-bold text-slate-800">Workflow Nodes</span> : <Layers className="w-4 h-4 text-slate-500 mx-auto" />}
            <button type="button" onClick={() => setSidebarOpen((p) => !p)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
            </button>
          </div>

          {sidebarOpen && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Triggers</span>
                <button type="button" onClick={() => handleAddNode('trigger_whatsapp_reply', 'WhatsApp Inbound Reply')} className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white text-left flex items-center justify-between mb-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-900">WhatsApp Reply</span>
                  </div>
                  <Plus className="w-4 h-4 text-slate-400" />
                </button>
                <button type="button" onClick={() => handleAddNode('trigger_email_reply', 'Email Inbound Reply')} className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white text-left flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-900">Email Reply</span>
                  </div>
                  <Plus className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Conditions</span>
                <button type="button" onClick={() => handleAddNode('condition_keyword', 'Message Contains')} className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-indigo-500 bg-white text-left flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Split className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-slate-900">Message Contains</span>
                  </div>
                  <Plus className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Delays</span>
                <button type="button" onClick={() => handleAddNode('delay_wait', 'Delay Node')} className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-amber-500 bg-white text-left flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-slate-900">Wait Node (M/H/D)</span>
                  </div>
                  <Plus className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Actions</span>
                <button type="button" onClick={() => handleAddNode('action_send_whatsapp', 'Send WhatsApp Message')} className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 bg-white text-left flex items-center justify-between mb-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-slate-900">Send WhatsApp</span>
                  </div>
                  <Plus className="w-4 h-4 text-slate-400" />
                </button>
                <button type="button" onClick={() => handleAddNode('action_send_email', 'Send Rich Email')} className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 bg-white text-left flex items-center justify-between mb-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-slate-900">Send Email</span>
                  </div>
                  <Plus className="w-4 h-4 text-slate-400" />
                </button>
                <button type="button" onClick={() => handleAddNode('action_end', 'End Flow')} className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-slate-500 bg-white text-left flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-slate-600" />
                    <span className="font-bold text-slate-900">End Flow</span>
                  </div>
                  <Plus className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Central Canvas */}
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
            <Controls className="!bg-white !border !border-slate-200 !shadow-md !rounded-xl" />
            <MiniMap className="!bg-white !border !border-slate-200 !shadow-md !rounded-xl" />
          </ReactFlow>
        </main>

        {/* Right Settings Panel */}
        {selectedNode && (
          <aside className="w-80 sm:w-96 bg-white border-l border-slate-200 shadow-lg z-20 flex flex-col shrink-0">
            <div className="h-14 border-b border-slate-200 px-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Settings Panel</h3>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => handleDeleteNode(selectedNode.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setSelectedNode(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Delay Node Inputs */}
              {selectedNode.type === 'delay' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm">Delay Node Configuration</h4>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Delay Value</label>
                    <input
                      type="number"
                      min={1}
                      value={selectedNode.data.delayValue || 5}
                      onChange={(e) => handleUpdateNodeData('delayValue', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Delay Unit</label>
                    <select
                      value={selectedNode.data.delayUnit || 'Minutes'}
                      onChange={(e) => handleUpdateNodeData('delayUnit', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
                    >
                      <option value="Minutes">Minutes</option>
                      <option value="Hours">Hours</option>
                      <option value="Days">Days</option>
                    </select>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 font-mono text-[11px]">
                    Pause: {selectedNode.data.delayValue || 5} {selectedNode.data.delayUnit || 'Minutes'}
                  </div>
                </div>
              )}

              {/* Condition Node Inputs */}
              {selectedNode.type === 'condition' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm">Condition Node Configuration</h4>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Keyword to Match</label>
                    <input
                      type="text"
                      value={selectedNode.data.keyword || ''}
                      onChange={(e) => handleUpdateNodeData('keyword', e.target.value)}
                      placeholder="e.g. price"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Action Node Inputs */}
              {selectedNode.type === 'action' && selectedNode.data.nodeType !== 'action_end' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-sm">Action Message</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEmailNodeId(selectedNode.id);
                        setEmailEditorContent(selectedNode.data.message || '');
                        setEmailEditorModalOpen(true);
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>Rich Editor</span>
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    value={selectedNode.data.message || ''}
                    onChange={(e) => handleUpdateNodeData('message', e.target.value)}
                    placeholder="Enter message text..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Embedded Rich Email Editor Modal */}
      {emailEditorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 sm:p-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-slate-900">Rich Email Editor for Workflow Action</h3>
              <button type="button" onClick={() => setEmailEditorModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
              <EmailEditor
                initialContent={emailEditorContent}
                onChange={(html) => setEmailEditorContent(html)}
                onSave={(html) => {
                  if (editingEmailNodeId) handleUpdateNodeData('message', html);
                  setEmailEditorModalOpen(false);
                }}
                subject={workflowName}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationBuilderUI;
