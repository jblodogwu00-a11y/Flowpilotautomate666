import { runFollowUpCron } from '../../../../src/lib/automation/followupCron.js';

/**
 * Next.js API Route Handler for Cron trigger
 * GET /api/cron/followup or POST /api/cron/followup
 * 
 * Runs every minute to dispatch pending drip follow-up messages via Baileys WhatsApp socket.
 */
export async function GET(request?: Request) {
  try {
    const summary = await runFollowUpCron();
    return Response.json({
      ok: true,
      ...summary,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err.message || 'Follow-up cron execution failed' },
      { status: 500 }
    );
  }
}

export async function POST(request?: Request) {
  return GET(request);
}
