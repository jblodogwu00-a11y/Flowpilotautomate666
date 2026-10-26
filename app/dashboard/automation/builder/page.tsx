'use client';

import React from 'react';
import { AutomationWorkflowBuilder } from '../../../../src/components/AutomationWorkflowBuilder';

/**
 * Next.js Page Route for Automation Workflow Builder
 * Path: /dashboard/automation/builder
 */
export default function AutomationBuilderPage() {
  return (
    <div className="w-full h-full min-h-screen bg-slate-50 dark:bg-[#090D16]">
      <AutomationWorkflowBuilder />
    </div>
  );
}
