import fs from 'fs';
import path from 'path';
import { WorkflowRecord, FollowUpJobRecord, DelayUnit } from './types.js';

const DATA_DIR = path.join(process.cwd(), '.data');
const WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows_store.json');
const JOBS_FILE = path.join(DATA_DIR, 'followup_jobs_store.json');

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Non-fatal
  }
}

// In-memory caches for fast read/writes
const workflowsMap = new Map<string, WorkflowRecord>();
const jobsMap = new Map<string, FollowUpJobRecord>();

function loadWorkflowsFromDisk(): void {
  ensureDataDir();
  try {
    if (fs.existsSync(WORKFLOWS_FILE)) {
      const raw = fs.readFileSync(WORKFLOWS_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        workflowsMap.clear();
        for (const w of list) {
          if (w && w.id) {
            workflowsMap.set(w.id, w);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Automation DB] Error loading workflows from disk:', err);
  }
}

function flushWorkflowsToDisk(): void {
  ensureDataDir();
  try {
    const list = Array.from(workflowsMap.values());
    fs.writeFileSync(WORKFLOWS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Automation DB] Error saving workflows to disk:', err);
  }
}

function loadJobsFromDisk(): void {
  ensureDataDir();
  try {
    if (fs.existsSync(JOBS_FILE)) {
      const raw = fs.readFileSync(JOBS_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        jobsMap.clear();
        for (const j of list) {
          if (j && j.id) {
            jobsMap.set(j.id, j);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Automation DB] Error loading follow-up jobs from disk:', err);
  }
}

function flushJobsToDisk(): void {
  ensureDataDir();
  try {
    const list = Array.from(jobsMap.values());
    fs.writeFileSync(JOBS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Automation DB] Error saving follow-up jobs to disk:', err);
  }
}

// Initial load
loadWorkflowsFromDisk();
loadJobsFromDisk();

/**
 * WORKFLOWS CRUD OPERATIONS
 */
export async function getWorkflowById(workflowId: string): Promise<WorkflowRecord | null> {
  loadWorkflowsFromDisk();
  return workflowsMap.get(workflowId) || null;
}

export async function getWorkflowsForUser(userId: string): Promise<WorkflowRecord[]> {
  loadWorkflowsFromDisk();
  const cleanId = (userId || 'default_workspace').trim();
  const all = Array.from(workflowsMap.values());
  const userList = all.filter((w) => w.userId === cleanId || w.userId === 'default_workspace' || cleanId === 'admin');
  return userList.length > 0 ? userList : all;
}

export async function saveWorkflow(workflow: Partial<WorkflowRecord> & { name: string; userId?: string }): Promise<WorkflowRecord> {
  const id = workflow.id || `wf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const existing = workflowsMap.get(id);

  const record: WorkflowRecord = {
    id,
    userId: workflow.userId || existing?.userId || 'default_workspace',
    name: workflow.name || 'Untitled Workflow',
    nodesJson: workflow.nodesJson || existing?.nodesJson || '[]',
    edgesJson: workflow.edgesJson || existing?.edgesJson || '[]',
    enabled: workflow.enabled ?? (existing ? existing.enabled : true),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  workflowsMap.set(id, record);
  flushWorkflowsToDisk();
  return record;
}

export async function deleteWorkflow(workflowId: string): Promise<boolean> {
  const deleted = workflowsMap.delete(workflowId);
  if (deleted) {
    flushWorkflowsToDisk();
  }
  return deleted;
}

/**
 * FOLLOW-UP DRIP JOBS CRUD OPERATIONS
 */
export async function createFollowUpJob(params: {
  workflowId: string;
  userId?: string;
  leadPhone: string;
  delayValue: number;
  delayUnit: DelayUnit;
  message: string;
  actionType?: string;
}): Promise<FollowUpJobRecord> {
  const now = Date.now();
  const { delayValue, delayUnit } = params;

  // Convert unit to milliseconds:
  // Minutes: Minutes * 60 * 1000
  // Hours: Hours * 3600 * 1000
  // Days: Days * 86400 * 1000
  let delayMs = delayValue * 60 * 1000;
  if (delayUnit === 'Hours') {
    delayMs = delayValue * 3600 * 1000;
  } else if (delayUnit === 'Days') {
    delayMs = delayValue * 86400 * 1000;
  }

  const nextActionAt = now + delayMs;
  const id = `job_${now}_${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = new Date().toISOString();

  const job: FollowUpJobRecord = {
    id,
    workflowId: params.workflowId,
    userId: params.userId || 'default_workspace',
    leadPhone: params.leadPhone,
    nextActionAt,
    delayValue,
    delayUnit,
    message: params.message,
    actionType: params.actionType || 'action_send_whatsapp',
    status: 'pending',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  jobsMap.set(id, job);
  flushJobsToDisk();
  console.log(`[FollowUp Job] Scheduled job ${id} for ${params.leadPhone} in ${delayValue} ${delayUnit} (Action at ${new Date(nextActionAt).toISOString()})`);
  return job;
}

export async function getPendingFollowUpJobs(): Promise<FollowUpJobRecord[]> {
  loadJobsFromDisk();
  const now = Date.now();
  return Array.from(jobsMap.values()).filter(
    (job) => job.status === 'pending' && job.nextActionAt <= now
  );
}

export async function getAllFollowUpJobs(userId?: string): Promise<FollowUpJobRecord[]> {
  loadJobsFromDisk();
  const all = Array.from(jobsMap.values()).sort((a, b) => b.nextActionAt - a.nextActionAt);
  if (!userId) return all;
  return all.filter((j) => j.userId === userId || j.userId === 'default_workspace');
}

export async function updateJobStatus(
  jobId: string,
  status: 'sent' | 'failed' | 'cancelled',
  error?: string
): Promise<FollowUpJobRecord | null> {
  const job = jobsMap.get(jobId);
  if (!job) return null;

  job.status = status;
  job.updatedAt = new Date().toISOString();
  if (status === 'sent') {
    job.sentAt = new Date().toISOString();
  }
  if (error) {
    job.error = error;
  }

  jobsMap.set(jobId, job);
  flushJobsToDisk();
  return job;
}
