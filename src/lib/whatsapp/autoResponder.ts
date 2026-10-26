import { proto } from '@whiskeysockets/baileys';
import { extractMessageText, SpamCooldownCache, globalSpamCache } from './listener.js';
import { getWorkflowsForUser } from '../automation/db.js';
import { executeWorkflow, WorkflowExecutionResult } from '../automation/runner.js';

export interface AutoResponderWorkflowOptions {
  userId?: string;
  cooldownMs?: number;
  spamCache?: SpamCooldownCache;
  onWorkflowExecuted?: (result: WorkflowExecutionResult) => void | Promise<void>;
}

/**
 * Attaches to Baileys WhatsApp socket and executes enabled visual workflows
 * when an inbound lead message arrives.
 * 
 * Logic:
 * - Listens on sock.ev.on('messages.upsert')
 * - Skips fromMe and status@broadcast
 * - Extracts message text across all types (text, captions, buttons, lists)
 * - Checks 5-minute spam cooldown cache
 * - Queries enabled workflows for user
 * - Calls executeWorkflow(workflow.id, leadPhone, leadMessage)
 */
export function startAutoResponderWorkflowListener(
  sock: any,
  options: AutoResponderWorkflowOptions = {}
): () => void {
  if (!sock || !sock.ev) {
    throw new Error('Valid Baileys socket is required to startAutoResponderWorkflowListener');
  }

  const userId = options.userId || sock._flowpilot_userId || sock.id || 'default_workspace';
  const cooldownMs = options.cooldownMs ?? (5 * 60 * 1000); // 5 min default
  const spamCache = options.spamCache || globalSpamCache;

  console.log(`[WhatsApp Workflow Listener] Attached listener for user ${userId}`);

  const handleMessagesUpsert = async (upsert: { messages: proto.IWebMessageInfo[]; type?: string }) => {
    try {
      const messages = upsert.messages;
      if (!Array.isArray(messages) || messages.length === 0) return;

      const msg = messages[0];
      if (!msg || !msg.message) return;
      if (msg.key?.fromMe) return; // Ignore own messages

      const leadPhone = msg.key?.remoteJid;
      if (!leadPhone || leadPhone === 'status@broadcast') return;

      // Extract text content
      const leadMessage = extractMessageText(msg.message);
      if (!leadMessage) return;

      // Anti-spam check
      if (spamCache.isCoolingDown(leadPhone, cooldownMs)) {
        return;
      }

      // 1. Fetch all enabled workflows for this user
      const userWorkflows = await getWorkflowsForUser(userId);
      const activeWorkflows = userWorkflows.filter((w) => w.enabled);

      if (activeWorkflows.length === 0) {
        return;
      }

      const lowerMessage = leadMessage.toLowerCase().trim();

      // 2. Evaluate workflows
      for (const workflow of activeWorkflows) {
        let shouldTrigger = false;

        let nodes: any[] = [];
        try {
          nodes = JSON.parse(workflow.nodesJson || '[]');
        } catch {
          continue;
        }

        // Check if any trigger node matches
        for (const node of nodes) {
          const type = node.data?.nodeType || node.type || '';

          if (type === 'trigger_whatsapp_reply') {
            shouldTrigger = true;
            break;
          }

          if (type === 'trigger_keyword') {
            const kw = String(node.data?.triggerKeyword || node.data?.keyword || '').toLowerCase().trim();
            if (kw && lowerMessage.includes(kw)) {
              shouldTrigger = true;
              break;
            }
          }

          if (type === 'condition_message_contains') {
            const kw = String(node.data?.keyword || '').toLowerCase().trim();
            if (kw && lowerMessage.includes(kw)) {
              shouldTrigger = true;
              break;
            }
          }
        }

        if (shouldTrigger) {
          console.log(`[WhatsApp Workflow Listener] Triggering workflow "${workflow.name}" for lead ${leadPhone}`);
          
          const result = await executeWorkflow(workflow.id, leadPhone, leadMessage, {
            userId,
            workflowOverride: workflow,
            sock,
          });

          // Record in anti-spam cache
          spamCache.recordReply(leadPhone);

          if (typeof options.onWorkflowExecuted === 'function') {
            try {
              await options.onWorkflowExecuted(result);
            } catch (cbErr) {
              console.warn('[WhatsApp Workflow Listener] onWorkflowExecuted callback error:', cbErr);
            }
          }

          break; // Trigger first matching workflow
        }
      }
    } catch (err: any) {
      console.error('[WhatsApp Workflow Listener] Inbound message handling error:', err.message);
    }
  };

  sock.ev.on('messages.upsert', handleMessagesUpsert);

  return () => {
    try {
      sock.ev.off('messages.upsert', handleMessagesUpsert);
      console.log(`[WhatsApp Workflow Listener] Detached listener for user ${userId}`);
    } catch {
      // Non-fatal
    }
  };
}
