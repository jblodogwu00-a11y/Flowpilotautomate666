import { getPendingFollowUpJobs, updateJobStatus } from './db.js';
import { sendWhatsAppViaEvolution, buildEvolutionInstanceName } from '../evolutionApi.js';
import { FollowUpJobRecord } from './types.js';

export interface FollowUpCronSummary {
  timestamp: string;
  processedCount: number;
  sentCount: number;
  failedCount: number;
  jobsProcessed: Array<{
    jobId: string;
    leadPhone: string;
    status: 'sent' | 'failed';
    messagePreview: string;
    error?: string;
  }>;
}

/**
 * Runs the follow-up drip job processor:
 * - Finds all followUpJobs where nextActionAt <= now and status == 'pending'
 * - Sends WhatsApp message exclusively via Evolution API (sendWhatsAppViaEvolution)
 * - Updates job status to 'sent' or 'failed' cleanly
 */
export async function runFollowUpCron(): Promise<FollowUpCronSummary> {
  const pendingJobs = await getPendingFollowUpJobs();
  const summary: FollowUpCronSummary = {
    timestamp: new Date().toISOString(),
    processedCount: pendingJobs.length,
    sentCount: 0,
    failedCount: 0,
    jobsProcessed: [],
  };

  if (pendingJobs.length === 0) {
    return summary;
  }

  console.log(`[FollowUp Cron] Processing ${pendingJobs.length} pending drip jobs at ${summary.timestamp}`);

  for (const job of pendingJobs) {
    try {
      const targetUser = job.userId || 'default_workspace';
      const cleanPhone = job.leadPhone;
      const messageText = job.message;

      // Dispatch exclusively via Evolution API for this user's instance
      const instanceName = buildEvolutionInstanceName(targetUser);
      const evoRes = await sendWhatsAppViaEvolution(instanceName, cleanPhone, messageText);

      if (evoRes.ok) {
        await updateJobStatus(job.id, 'sent');
        summary.sentCount++;
        summary.jobsProcessed.push({
          jobId: job.id,
          leadPhone: job.leadPhone,
          status: 'sent',
          messagePreview: messageText.slice(0, 80),
        });
        console.log(`[FollowUp Cron] ✓ Sent drip follow-up to ${cleanPhone} via ${instanceName} (Job ID: ${job.id})`);
      } else {
        const reason = evoRes.error || evoRes.detail || `Instance ${instanceName} is disconnected.`;
        console.warn(`[FollowUp Cron] Notice for job ${job.id} (${cleanPhone}): ${reason}`);
        await updateJobStatus(job.id, 'failed', reason);
        summary.failedCount++;
        summary.jobsProcessed.push({
          jobId: job.id,
          leadPhone: job.leadPhone,
          status: 'failed',
          messagePreview: messageText.slice(0, 80),
          error: reason,
        });
      }
    } catch (err: any) {
      const reason = err?.message || 'Unexpected follow-up dispatch failure';
      console.warn(`[FollowUp Cron] Notice sending job ${job.id} to ${job.leadPhone}: ${reason}`);
      await updateJobStatus(job.id, 'failed', reason);
      summary.failedCount++;
      summary.jobsProcessed.push({
        jobId: job.id,
        leadPhone: job.leadPhone,
        status: 'failed',
        messagePreview: job.message.slice(0, 80),
        error: reason,
      });
    }
  }

  return summary;
}

let cronInterval: NodeJS.Timeout | null = null;

/**
 * Starts the automatic 60-second follow-up runner daemon on the Node server
 */
export function startFollowUpCronDaemon(): void {
  if (cronInterval) return;

  console.log('[FollowUp Cron] Starting automated 60-second drip follow-up runner');
  
  // Initial check after 5 seconds
  setTimeout(() => {
    runFollowUpCron().catch((err) => console.error('[FollowUp Cron] Initial run error:', err));
  }, 5000);

  // Recurring every 60 seconds (1 minute)
  cronInterval = setInterval(() => {
    runFollowUpCron().catch((err) => console.error('[FollowUp Cron] Scheduled run error:', err));
  }, 60 * 1000);
}

export function stopFollowUpCronDaemon(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log('[FollowUp Cron] Stopped drip follow-up runner');
  }
}
