import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  MessageSquare,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { POPULAR_WHATSAPP_TEMPLATES, WhatsAppTemplateLibraryItem } from './WhatsAppCatalog';

interface WhatsAppTemplatesViewProps {
  userId?: string;
  userEmail?: string;
  onBackToDashboard?: () => void;
  onNavigateToConnect?: () => void;
}

export const WhatsAppTemplatesView: React.FC<WhatsAppTemplatesViewProps> = ({
  onBackToDashboard,
  onNavigateToConnect,
}) => {
  const [templates, setTemplates] = useState<WhatsAppTemplateLibraryItem[]>(() => {
    try {
      const stored = localStorage.getItem('flowpilot_wa_templates');
      if (stored) return JSON.parse(stored);
    } catch {}
    return POPULAR_WHATSAPP_TEMPLATES;
  });

  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState<'MARKETING' | 'UTILITY' | 'WELCOME'>('MARKETING');
  const [newBody, setNewBody] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const saveTemplates = (items: WhatsAppTemplateLibraryItem[]) => {
    setTemplates(items);
    try {
      localStorage.setItem('flowpilot_wa_templates', JSON.stringify(items));
    } catch {}
  };

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel || !newBody) return;

    const newItem: WhatsAppTemplateLibraryItem = {
      id: `tpl_${Date.now()}`,
      name: newName || newLabel.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      label: newLabel,
      category: newCategory,
      body: newBody,
    };

    saveTemplates([newItem, ...templates]);
    setNewName('');
    setNewLabel('');
    setNewBody('');
    setShowAddModal(false);
  };

  const handleDeleteTemplate = (id: string) => {
    saveTemplates(templates.filter((t) => t.id !== id));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="p-1.5 -ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <FileText className="w-6 h-6" />
              </span>
              WhatsApp Message Templates
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Create and organize instant reusable message templates for your WhatsApp QR automations and broadcasts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onNavigateToConnect && (
            <button
              onClick={onNavigateToConnect}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              WhatsApp QR Connect
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/20 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className="p-5 rounded-2xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {tpl.category}
                </span>
                <button
                  onClick={() => handleDeleteTemplate(tpl.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  title="Delete template"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {tpl.label}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-sans whitespace-pre-wrap leading-relaxed p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                {tpl.body}
              </p>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Ready for QR Workflows
              </span>
              <code>{tpl.name}</code>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Create New WhatsApp Template
            </h3>
            <form onSubmit={handleCreateTemplate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Template Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Member Welcome"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="MARKETING">Marketing & Promotions</option>
                  <option value="UTILITY">Utility & Orders</option>
                  <option value="WELCOME">Welcome & Onboarding</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Message Body
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Hi {{name}}, welcome to {{business}}! Let us know if you need help."
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Available tags: <code>{'{{name}}'}</code>, <code>{'{{business}}'}</code>, <code>{'{{link}}'}</code>
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
