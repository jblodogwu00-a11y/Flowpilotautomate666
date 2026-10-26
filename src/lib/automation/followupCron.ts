import { getPendingFollowUpJobs, updateJobStatus } from './db.js';
import { sendWhatsAppMessage, activeSockets } from '../../services/whatsappBaileysService.js';
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
 * - Sends WhatsApp message using Baileys sock.sendMessage or sendWhatsAppMessage
 * - Updates status to 'sent'
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

      // 1. Try sending via active socket directly if available
      const sock = activeSockets.get(targetUser) || activeSockets.get('default_workspace');
      let delivered = false;

      if (sock && typeof sock.sendMessage === 'function') {
        const jid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: messageText });
        delivered = true;
      } else {
        // Fallback to sendWhatsAppMessage service
        const res = await sendWhatsAppMessage(targetUser, cleanPhone, messageText);
        delivered = Boolean(res.ok);
      }

      await updateJobStatus(job.id, 'sent');
      summary.sentCount++;
      summary.jobsProcessed.push({
        jobId: job.id,
        leadPhone: job.leadPhone,
        status: 'sent',
        messagePreview: messageText.slice(0, 80),
      });

      console.log(`[FollowUp Cron] ✓ Sent drip follow-up to ${cleanPhone} (Job ID: ${job.id})`);
    } catch (err: any) {
      console.error(`[FollowUp Cron] ✗ Error sending job ${job.id} to ${job.leadPhone}:`, err.message);
      await updateJobStatus(job.id, 'failed', err.message);
      summary.failedCount++;
      summary.jobsProcessed.push({
        jobId: job.id,
        leadPhone: job.leadPhone,
        status: 'failed',
        messagePreview: job.message.slice(0, 80),
        error: err.message,
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
