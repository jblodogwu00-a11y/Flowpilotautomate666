import { getWorkflowById, createFollowUpJob } from './db.js';
import { WorkflowRecord, DelayUnit, FollowUpJobRecord } from './types.js';
import { sendWhatsAppMessage } from '../../services/whatsappBaileysService.js';

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
  }>;
  scheduledJobs: FollowUpJobRecord[];
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
  } catch (err) {
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

  // Find incoming and outgoing edges per node
  const outgoingEdges = new Map<string, any[]>();
  for (const e of edges) {
    if (!e || !e.source || !e.target) continue;
    const list = outgoingEdges.get(e.source) || [];
    list.push(e);
    outgoingEdges.set(e.source, list);
  }

  // 1. Find trigger nodes (Trigger: WhatsApp Reply, Email Reply, Keyword Trigger)
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

  const lowerMsg = (leadMessage || '').toLowerCase().trim();

  // Process starting paths
  for (const startNode of startNodes) {
    const nodeType = startNode.data?.nodeType || startNode.type || '';

    // If trigger specifies a keyword, verify message matches
    if (nodeType === 'trigger_keyword' && startNode.data?.triggerKeyword) {
      const kw = String(startNode.data.triggerKeyword).toLowerCase().trim();
      if (!lowerMsg.includes(kw)) {
        continue; // Does not match this trigger
      }
    }

    // Traverse along edges
    const queue: string[] = (outgoingEdges.get(startNode.id) || []).map((e) => e.target);
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const currentNode = nodesById.get(currentId);
      if (!currentNode) continue;

      const type = currentNode.data?.nodeType || currentNode.type || '';

      // CONDITION: Message Contains
      if (type === 'condition_message_contains' || type.startsWith('condition_')) {
        const keyword = String(currentNode.data?.keyword || '').toLowerCase().trim();
        const matches = keyword ? lowerMsg.includes(keyword) : true;

        const branchEdges = outgoingEdges.get(currentId) || [];
        for (const edge of branchEdges) {
          // If sourceHandle is specified ('true' vs 'false')
          if (edge.sourceHandle === 'true' && matches) {
            queue.push(edge.target);
          } else if (edge.sourceHandle === 'false' && !matches) {
            queue.push(edge.target);
          } else if (!edge.sourceHandle && matches) {
            queue.push(edge.target);
          }
        }
        continue;
      }

      // DELAY NODE: Wait Node with Minutes, Hours, Days drip
      if (type === 'delay_wait' || type.startsWith('delay_')) {
        const delayValue = Math.max(1, Number(currentNode.data?.delayValue) || 5);
        const delayUnit: DelayUnit = (currentNode.data?.delayUnit as DelayUnit) || 'Minutes';

        // Find subsequent action node to schedule
        const nextEdges = outgoingEdges.get(currentId) || [];
        for (const edge of nextEdges) {
          const nextNode = nodesById.get(edge.target);
          if (nextNode) {
            const nextType = nextNode.data?.nodeType || nextNode.type || '';
            const msg = nextNode.data?.message || 'Hello from your scheduled Follow-Up automation!';

            const job = await createFollowUpJob({
              workflowId: workflow.id,
              userId: workflow.userId || options.userId,
              leadPhone,
              delayValue,
              delayUnit,
              message: msg,
              actionType: nextType,
            });

            result.scheduledJobs.push(job);
          }
        }
        // Delay node schedules downstream nodes into followUpJobs, so halt synchronous execution here
        continue;
      }

      // ACTION: Send WhatsApp Message (Immediate)
      if (type === 'action_send_whatsapp') {
        const messageText = currentNode.data?.message || 'Thank you for reaching out!';
        const targetUser = workflow.userId || options.userId || 'default_workspace';

        let delivered = false;
        try {
          if (options.sock && typeof options.sock.sendMessage === 'function') {
            await options.sock.sendMessage(leadPhone, { text: messageText });
            delivered = true;
          } else {
            const sendRes = await sendWhatsAppMessage(targetUser, leadPhone, messageText);
            delivered = Boolean(sendRes.ok);
          }
          console.log(`[Workflow Runner] Auto responded to ${leadPhone} via Workflow "${workflow.name}" (Node: ${currentId})`);
        } catch (sendErr: any) {
          console.error(`[Workflow Runner] Error sending message to ${leadPhone}:`, sendErr.message);
        }

        result.immediateActionsDispatched.push({
          nodeId: currentId,
          actionType: type,
          message: messageText,
          delivered,
        });

        // Continue to next nodes
        const nextEdges = outgoingEdges.get(currentId) || [];
        for (const e of nextEdges) {
          queue.push(e.target);
        }
        continue;
      }

      // ACTION: Send Email
      if (type === 'action_send_email') {
        result.immediateActionsDispatched.push({
          nodeId: currentId,
          actionType: type,
          message: currentNode.data?.message || '',
          delivered: true,
        });
        const nextEdges = outgoingEdges.get(currentId) || [];
        for (const e of nextEdges) {
          queue.push(e.target);
        }
        continue;
      }

      // ACTION: End Flow
      if (type === 'action_end_flow') {
        break;
      }

      // General fallback: traverse next edges
      const nextEdges = outgoingEdges.get(currentId) || [];
      for (const e of nextEdges) {
        queue.push(e.target);
      }
    }
  }

  return result;
}
