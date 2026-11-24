import { getWorkflowById, createFollowUpJob } from './db.js';
import { WorkflowRecord, DelayUnit, FollowUpJobRecord } from './types.js';
import { sendWhatsAppViaEvolution, buildEvolutionInstanceName } from '../evolutionApi.js';
import { sendCustomDomainEmail } from '../customDomainEmail.js';

export interface WorkflowExecutionResult {
  workflowId: string;
  workflowName: string;
  executed: boolean;
  reason?: string;
  immediateActionsDispatched: Array<{
    nodeId: string;
    actionType: string;
    message: string;
    delivered: boolean;
    errorDetail?: string;
  }>;
  scheduledJobs: FollowUpJobRecord[];
}

export function htmlToWhatsAppTextServer(input: string): string {
  const raw = String(input || '');
  if (!raw.trim()) return '';
  if (!/<\/?[a-z][\s\S]*>/i.test(raw)) {
    return raw.trim();
  }
  let out = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '');

  out = out.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, inner) => {
    const clean = inner.replace(/<[^>]+>/g, '').trim();
    return clean ? `\n*${clean}*\n` : '\n';
  });
  out = out.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href: string, inner: string) => {
      const label = inner.replace(/<[^>]+>/g, '').trim();
      const url = href.trim();
      if (!url || url.startsWith('javascript:')) return label;
      return !label || label === url ? url : `${label} (${url})`;
    }
  );
  out = out.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _t, inner) => {
    const clean = inner.replace(/\*/g, '').trim();
    return clean ? `*${clean}*` : '';
  });
  out = out.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _t, inner) => {
    const clean = inner.trim();
    return clean ? `_${clean}_` : '';
  });
  out = out.replace(/<(del|s|strike)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _t, inner) => {
    const clean = inner.trim();
    return clean ? `~${clean}~` : '';
  });
  out = out.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    const clean = inner.trim();
    return clean ? `\n• ${clean}` : '';
  });
  out = out
    .replace(/<\/?(ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<br\b[^>]*\/?>/gi, '\n')
    .replace(/<\/(p|div|blockquote|tr)>/gi, '\n\n')
    .replace(/<(p|div|blockquote|tr)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return out;
}

export function htmlToPlainTextServer(input: string): string {
  return htmlToWhatsAppTextServer(input)
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,!?])/g, '$1$2')
    .replace(/~([^~\n]+)~/g, '$1')
    .trim();
}

export function matchesKeywordRule(
  inboundText: string,
  rawRule: string,
  matchType: string = 'contains'
): boolean {
  const mode = String(matchType || 'contains').toLowerCase();
  if (mode === 'any_inbound' || mode === 'any') {
    return true;
  }
  const lowerInbound = String(inboundText || '').toLowerCase().trim();
  const tokens = String(rawRule || '')
    .split(',')
    .map((t) => t.toLowerCase().trim())
    .filter(Boolean);

  if (tokens.length === 0) return false;

  return tokens.some((token) => {
    if (mode === 'exact') return lowerInbound === token;
    if (mode === 'startswith' || mode === 'starts_with') return lowerInbound.startsWith(token);
    return lowerInbound.includes(token);
  });
}

function personalizeWorkflowText(
  template: string,
  ctx: { leadName?: string; leadPhone?: string; leadEmail?: string; listName?: string }
): string {
  const fullName = (ctx.leadName || '').trim() || 'Friend';
  const firstName = fullName.split(/\s+/)[0] || 'Friend';
  const listName = (ctx.listName || '').trim() || 'General Contacts';
  return String(template || '')
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*full_name\s*\}\}/gi, fullName)
    .replace(/\{\{\s*list_name\s*\}\}/gi, listName)
    .replace(/\{\{\s*email\s*\}\}/gi, ctx.leadEmail || '')
    .replace(/\{\{\s*phone\s*\}\}/gi, ctx.leadPhone || '');
}

/**
 * Convert user configured value and unit to milliseconds
 * Minutes: Minutes * 60 * 1000
 * Hours: Hours * 3600 * 1000
 * Days: Days * 86400 * 1000
 */
export function calculateDelayMilliseconds(value: number, unit: DelayUnit): number {
  const safeValue = Math.max(1, Number(value) || 1);
  switch (unit) {
    case 'Hours':
      return safeValue * 3600 * 1000;
    case 'Days':
      return safeValue * 86400 * 1000;
    case 'Minutes':
    default:
      return safeValue * 60 * 1000;
  }
}

/**
 * Executes a visual automation workflow starting from trigger nodes,
 * following connected edges through conditions, immediate actions, and delay wait drip nodes.
 */
export async function executeWorkflow(
  workflowId: string,
  leadPhone: string,
  leadMessage: string,
  options: {
    userId?: string;
    workflowOverride?: WorkflowRecord;
    sock?: any;
    leadEmail?: string;
    leadName?: string;
    channel?: 'whatsapp' | 'email' | 'sms';
    listName?: string;
    bypassTriggerCheck?: boolean;
  } = {}
): Promise<WorkflowExecutionResult> {
  const workflow = options.workflowOverride || (await getWorkflowById(workflowId));

  if (!workflow) {
    return {
      workflowId,
      workflowName: 'Unknown',
      executed: false,
      reason: `Workflow not found with ID ${workflowId}`,
      immediateActionsDispatched: [],
      scheduledJobs: [],
    };
  }

  if (!workflow.enabled) {
    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      executed: false,
      reason: 'Workflow is disabled',
      immediateActionsDispatched: [],
      scheduledJobs: [],
    };
  }

  let nodes: any[] = [];
  let edges: any[] = [];
  try {
    nodes = JSON.parse(workflow.nodesJson || '[]');
    edges = JSON.parse(workflow.edgesJson || '[]');
  } catch {
    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      executed: false,
      reason: 'Failed to parse workflow nodes/edges JSON',
      immediateActionsDispatched: [],
      scheduledJobs: [],
    };
  }

  if (!Array.isArray(nodes) || nodes.length === 0) {
    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      executed: false,
      reason: 'Workflow contains no nodes',
      immediateActionsDispatched: [],
      scheduledJobs: [],
    };
  }

  const nodesById = new Map<string, any>();
  for (const n of nodes) {
    if (n && n.id) nodesById.set(n.id, n);
  }

  const outgoingEdges = new Map<string, any[]>();
  for (const e of edges) {
    if (!e || !e.source || !e.target) continue;
    const list = outgoingEdges.get(e.source) || [];
    list.push(e);
    outgoingEdges.set(e.source, list);
  }

  const triggerNodes = nodes.filter((n) => {
    const t = n.data?.nodeType || n.type || '';
    return t.startsWith('trigger_') || t === 'trigger';
  });

  const startNodes = triggerNodes.length > 0 ? triggerNodes : [nodes[0]];

  const result: WorkflowExecutionResult = {
    workflowId: workflow.id,
    workflowName: workflow.name,
    executed: true,
    immediateActionsDispatched: [],
    scheduledJobs: [],
  };

  const cleanMsg = String(leadMessage || '').trim();
  const inboundChannel = options.channel || 'whatsapp';
  const recipientEmail =
    (options.leadEmail || '').trim() ||
    (leadPhone && leadPhone.includes('@') ? leadPhone.trim() : '');
  const personalizeCtx = {
    leadName: options.leadName,
    leadPhone,
    leadEmail: recipientEmail,
    listName: options.listName,
  };

  let matchedAtLeastOneStart = false;

  for (const startNode of startNodes) {
    const nodeType = startNode.data?.nodeType || startNode.type || '';

    if (!options.bypassTriggerCheck) {
      if (nodeType === 'trigger_form_submission') {
        continue;
      }
      if (nodeType === 'trigger_email_reply' && inboundChannel !== 'email') {
        continue;
      }
      if (
        (nodeType === 'trigger_keyword' || nodeType === 'whatsapp_keyword') &&
        startNode.data?.triggerKeyword
      ) {
        const kw = String(startNode.data.triggerKeyword || startNode.data?.keyword || '');
        if (!matchesKeywordRule(cleanMsg, kw, startNode.data?.matchType || 'contains')) {
          continue;
        }
      }
    }

    matchedAtLeastOneStart = true;

    const queue: string[] = (outgoingEdges.get(startNode.id) || []).map((e) => e.target);
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const currentNode = nodesById.get(currentId);
      if (!currentNode) continue;

      const rawType = String(currentNode.type || '');
      const type = String(currentNode.data?.nodeType || rawType || '');

      // CONDITION: Message Contains (supports both React Flow type='condition' and nodeType='condition_message_contains')
      if (
        type === 'condition' ||
        type === 'condition_message_contains' ||
        type.startsWith('condition_') ||
        rawType === 'condition'
      ) {
        const keyword = String(
          currentNode.data?.keyword || currentNode.data?.triggerKeyword || ''
        ).trim();
        const matches = keyword
          ? matchesKeywordRule(cleanMsg, keyword, currentNode.data?.matchType || 'contains')
          : true;

        const branchEdges = outgoingEdges.get(currentId) || [];
        for (const edge of branchEdges) {
          const handle = String(edge.sourceHandle || '').toLowerCase();
          if ((handle === 'true' || handle === 'yes') && matches) {
            queue.push(edge.target);
          } else if ((handle === 'false' || handle === 'no') && !matches) {
            queue.push(edge.target);
          } else if (!handle && matches) {
            queue.push(edge.target);
          }
        }
        continue;
      }

      // DELAY NODE: Wait Node with Minutes, Hours, Days drip
      if (type === 'delay_wait' || type === 'delay' || type.startsWith('delay')) {
        const delayValue = Math.max(1, Number(currentNode.data?.delayValue) || 5);
        const delayUnit: DelayUnit = (currentNode.data?.delayUnit as DelayUnit) || 'Minutes';

        const nextEdges = outgoingEdges.get(currentId) || [];
        for (const edge of nextEdges) {
          const nextNode = nodesById.get(edge.target);
          if (nextNode) {
            const nextType = nextNode.data?.nodeType || nextNode.type || '';
            const rawMsg =
              nextNode.data?.message || 'Hello from your scheduled Follow-Up automation!';
            const personalizedJobMsg = personalizeWorkflowText(rawMsg, personalizeCtx);

            const job = await createFollowUpJob({
              workflowId: workflow.id,
              userId: workflow.userId || options.userId,
              leadPhone: leadPhone || recipientEmail,
              delayValue,
              delayUnit,
              message:
                nextType === 'action_send_whatsapp'
                  ? htmlToWhatsAppTextServer(personalizedJobMsg)
                  : personalizedJobMsg,
              actionType: nextType,
            });

            result.scheduledJobs.push(job);
          }
        }
        continue;
      }

      // ACTION: Send WhatsApp Message (Immediate)
      if (type === 'action_send_whatsapp') {
        const rawTemplate = currentNode.data?.message || 'Thank you for reaching out!';
        const personalized = personalizeWorkflowText(rawTemplate, personalizeCtx);
        const messageText = htmlToWhatsAppTextServer(personalized);
        const targetUser = workflow.userId || options.userId || 'default_workspace';

        let delivered = false;
        let errorDetail: string | undefined;
        if (!leadPhone || leadPhone.includes('@')) {
          errorDetail = 'Valid WhatsApp phone number is missing for this lead.';
        } else {
          try {
            const instanceName = buildEvolutionInstanceName(targetUser);
            const evoRes = await sendWhatsAppViaEvolution(instanceName, leadPhone, messageText);
            if (evoRes.ok) {
              delivered = true;
              console.log(
                `[Workflow Runner] Auto responded to ${leadPhone} via Evolution (${instanceName}) · Workflow "${workflow.name}" (Node: ${currentId})`
              );
            } else {
              errorDetail = evoRes.detail || evoRes.error || 'Evolution WhatsApp delivery failed';
              console.warn(
                `[Workflow Runner] Could not send WhatsApp to ${leadPhone} (${instanceName}): ${errorDetail}`
              );
            }
          } catch (sendErr: any) {
            errorDetail = sendErr?.message || String(sendErr);
            console.warn(
              `[Workflow Runner] WhatsApp dispatch notice for ${leadPhone}:`,
              errorDetail
            );
          }
        }

        result.immediateActionsDispatched.push({
          nodeId: currentId,
          actionType: type,
          message: messageText,
          delivered,
          ...(errorDetail ? { errorDetail } : {}),
        });

        const nextEdges = outgoingEdges.get(currentId) || [];
        for (const e of nextEdges) {
          queue.push(e.target);
        }
        continue;
      }

      // ACTION: Send Email
      if (type === 'action_send_email') {
        const targetOwnerId = workflow.userId || options.userId || '';
        const rawTemplate = currentNode.data?.message || '';
        const personalizedHtml = personalizeWorkflowText(rawTemplate, personalizeCtx);
        const subject = personalizeWorkflowText(
          currentNode.data?.emailSubject || `Update from ${workflow.name}`,
          personalizeCtx
        );
        let delivered = false;
        let errorDetail: string | undefined;

        if (!recipientEmail || !recipientEmail.includes('@')) {
          errorDetail = 'Valid recipient email address is missing for this lead.';
        } else if (!targetOwnerId) {
          errorDetail = 'Authenticated workspace owner ID is required to send custom domain email.';
        } else {
          try {
            await sendCustomDomainEmail({
              ownerId: targetOwnerId,
              to: recipientEmail,
              subject,
              html: personalizedHtml,
              text: htmlToPlainTextServer(personalizedHtml),
            });
            delivered = true;
          } catch (err: any) {
            errorDetail = err?.message || 'Email dispatch blocked';
            console.warn('[Workflow Runner] Email dispatch blocked/notice:', errorDetail);
            delivered = false;
          }
        }

        result.immediateActionsDispatched.push({
          nodeId: currentId,
          actionType: type,
          message: personalizedHtml,
          delivered,
          ...(errorDetail ? { errorDetail } : {}),
        });
        const nextEdges = outgoingEdges.get(currentId) || [];
        for (const e of nextEdges) {
          queue.push(e.target);
        }
        continue;
      }

      // ACTION: End Flow
      if (type === 'action_end_flow' || type === 'action_end') {
        break;
      }

      // General fallback: traverse next edges
      const nextEdges = outgoingEdges.get(currentId) || [];
      for (const e of nextEdges) {
        queue.push(e.target);
      }
    }
  }

  if (!matchedAtLeastOneStart) {
    result.executed = false;
    result.reason = 'No trigger node matched the inbound channel or keyword.';
  }

  return result;
}
