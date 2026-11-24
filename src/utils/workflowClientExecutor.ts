import {
  Automation,
  ChannelType,
  UserPrivateProfile,
  Workspace,
} from '../types';
import {
  deliverChannelMessage,
  MessageDeliveryReceipt,
  personalizeAutomationMessage,
} from '../services/messageDeliveryService';
import { formatRichMessageForChannel } from './richMessageFormat';

export function matchesKeywordExpression(
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
    if (mode === 'startswith' || mode === 'starts_with') {
      return lowerInbound.startsWith(token);
    }
    return lowerInbound.includes(token);
  });
}

export interface WorkflowTraceStep {
  step: number;
  nodeId: string;
  type: string;
  label?: string;
  keyword?: string;
  matched?: boolean;
  branchTaken?: string;
  wait?: string;
  status?: string;
  channel?: ChannelType;
  recipient?: string;
  messagePreview?: string;
  deliveryStatus?: string;
  providerUsed?: string;
  detailMessage?: string;
}

export interface ClientWorkflowRunResult {
  executed: boolean;
  reason?: string;
  stepsExecuted: number;
  trace: WorkflowTraceStep[];
  receipts: MessageDeliveryReceipt[];
}

export interface ClientWorkflowGraphNode {
  id: string;
  type?: string;
  data?: Record<string, any>;
}

export interface ClientWorkflowGraphEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export function parseWorkflowGraphNodesAndEdges(
  flowGraphJson?: string
): { nodes: ClientWorkflowGraphNode[]; edges: ClientWorkflowGraphEdge[] } {
  if (!flowGraphJson) return { nodes: [], edges: [] };
  try {
    const parsed = JSON.parse(flowGraphJson);
    const rawNodes: any[] = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
    const rawEdges: any[] = Array.isArray(parsed?.edges) ? parsed.edges : [];

    // Support Format A (React Flow nodes + edges)
    if (rawNodes.length > 0 && (rawEdges.length > 0 || rawNodes[0]?.position)) {
      return { nodes: rawNodes, edges: rawEdges };
    }

    // Support Format B (Legacy sequential list without explicit edges)
    const nodes: ClientWorkflowGraphNode[] = [];
    const edges: ClientWorkflowGraphEdge[] = [];
    rawNodes.forEach((ln, idx) => {
      const id = ln.id || `legacy_${idx}`;
      const cat = ln.category;
      if (cat === 'trigger') {
        nodes.push({
          id,
          type: 'trigger',
          data: {
            nodeType:
              ln.subType === 'form_submission'
                ? 'trigger_form_submission'
                : ln.subType === 'whatsapp_keyword'
                ? 'trigger_keyword'
                : 'trigger_whatsapp_reply',
            label: ln.title || 'Trigger',
            triggerKeyword: ln.config?.conditionValue || '',
          },
        });
      } else if (cat === 'condition') {
        nodes.push({
          id,
          type: 'condition',
          data: {
            nodeType: 'condition_message_contains',
            keyword: ln.config?.conditionValue || 'price',
          },
        });
      } else if (cat === 'delay') {
        nodes.push({
          id,
          type: 'delay',
          data: {
            nodeType: 'delay_wait',
            delayValue: Number(ln.config?.waitDuration || 5),
            delayUnit: ln.config?.waitDurationUnit || 'Minutes',
          },
        });
      } else {
        const sub = String(ln.subType || '');
        nodes.push({
          id,
          type: 'action',
          data: {
            nodeType: sub.includes('email')
              ? 'action_send_email'
              : sub.includes('sms')
              ? 'action_send_sms'
              : 'action_send_whatsapp',
            message: ln.config?.messageTemplate || '',
            emailSubject: ln.config?.subject || '',
          },
        });
      }
      if (idx > 0) {
        const prev = rawNodes[idx - 1];
        edges.push({
          id: `legacy_e_${idx}`,
          source: prev.id || `legacy_${idx - 1}`,
          target: id,
          ...(ln.branchPath === 'yes'
            ? { sourceHandle: 'true' }
            : ln.branchPath === 'no'
            ? { sourceHandle: 'false' }
            : {}),
        });
      }
    });
    return { nodes, edges };
  } catch {
    return { nodes: [], edges: [] };
  }
}

export async function executeClientWorkflowGraph(params: {
  automationName: string;
  automationId?: string;
  nodes: ClientWorkflowGraphNode[];
  edges: ClientWorkflowGraphEdge[];
  inboundText: string;
  triggerChannel?: ChannelType;
  bypassKeywordTriggerCheck?: boolean;
  deliverLive?: boolean;
  lead: {
    fullName?: string;
    email?: string;
    phone?: string;
    company?: string;
    listName?: string;
  };
  workspace?: Workspace;
  privateProfile?: UserPrivateProfile;
  userId?: string;
}): Promise<ClientWorkflowRunResult> {
  const { nodes, edges, inboundText, lead } = params;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return {
      executed: false,
      reason: 'Workflow has no configured nodes.',
      stepsExecuted: 0,
      trace: [],
      receipts: [],
    };
  }

  const startNode =
    nodes.find((n) => {
      const nt = String(n.data?.nodeType || n.type || '');
      return n.type === 'trigger' || nt.startsWith('trigger_');
    }) || nodes[0];

  const startNodeType = String(startNode?.data?.nodeType || startNode?.type || '');

  // If this is a keyword-triggered workflow and we are matching real inbound traffic, check keyword
  if (
    !params.bypassKeywordTriggerCheck &&
    (startNodeType === 'trigger_keyword' || startNodeType === 'whatsapp_keyword')
  ) {
    const kw = String(
      startNode.data?.triggerKeyword || startNode.data?.keyword || ''
    ).trim();
    if (kw && !matchesKeywordExpression(inboundText, kw, startNode.data?.matchType || 'contains')) {
      return {
        executed: false,
        reason: `Inbound message did not match trigger keyword "${kw}".`,
        stepsExecuted: 0,
        trace: [
          {
            step: 1,
            nodeId: startNode.id,
            type: 'trigger',
            label: startNode.data?.label || 'Keyword Trigger',
            keyword: kw,
            matched: false,
            status: 'skipped_no_match',
          },
        ],
        receipts: [],
      };
    }
  }

  const trace: WorkflowTraceStep[] = [];
  const receipts: MessageDeliveryReceipt[] = [];
  const visited = new Set<string>();
  const queue: ClientWorkflowGraphNode[] = [startNode];

  const effectiveWorkspace: Workspace | undefined = params.workspace
    ? {
        ...params.workspace,
        ownerId: params.userId || params.workspace.ownerId,
      }
    : params.userId
    ? {
        id: 'default_workspace',
        ownerId: params.userId,
        name: 'FlowPilot Workspace',
        category: 'smb',
        timezone: 'UTC',
        currency: 'USD',
        senderName: 'FlowPilot Operator',
        whatsappConnected: false,
        smsConnected: false,
        emailConnected: false,
        notifyNewLeads: true,
        notifyCampaigns: true,
        createdAt: '',
        updatedAt: '',
      }
    : undefined;

  while (queue.length > 0 && trace.length < 30) {
    const current = queue.shift()!;
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);

    const rawType = String(current.type || '');
    const nodeType = String(current.data?.nodeType || rawType || '');

    if (rawType === 'trigger' || nodeType.startsWith('trigger_')) {
      trace.push({
        step: trace.length + 1,
        nodeId: current.id,
        type: 'trigger',
        label: current.data?.label || nodeType,
        recipient: lead.phone || lead.email,
      });
      for (const edge of edges.filter((e) => e.source === current.id)) {
        const nextNode = nodes.find((n) => n.id === edge.target);
        if (nextNode) queue.push(nextNode);
      }
      continue;
    }

    if (
      rawType === 'condition' ||
      nodeType === 'condition' ||
      nodeType === 'condition_message_contains' ||
      nodeType.startsWith('condition_')
    ) {
      const kw = String(
        current.data?.keyword || current.data?.triggerKeyword || 'price'
      ).trim();
      const matched = kw
        ? matchesKeywordExpression(inboundText, kw, current.data?.matchType || 'contains')
        : true;

      trace.push({
        step: trace.length + 1,
        nodeId: current.id,
        type: 'condition',
        keyword: kw,
        matched,
        branchTaken: matched ? 'true (Yes)' : 'false (No)',
      });

      const outEdges = edges.filter((e) => e.source === current.id);
      const matchingEdges = outEdges.filter((e) => {
        const h = String(e.sourceHandle || '').toLowerCase();
        if (matched) return h === 'true' || h === 'yes' || !h;
        return h === 'false' || h === 'no';
      });
      for (const edge of matchingEdges) {
        const nextNode = nodes.find((n) => n.id === edge.target);
        if (nextNode) queue.push(nextNode);
      }
      continue;
    }

    if (rawType === 'delay' || nodeType === 'delay_wait' || nodeType.startsWith('delay')) {
      trace.push({
        step: trace.length + 1,
        nodeId: current.id,
        type: 'delay',
        wait: `${current.data?.delayValue || 5} ${current.data?.delayUnit || 'Minutes'}`,
        status: 'scheduled_in_queue',
      });
      // Do not dispatch synchronous messages past a Wait node during live trigger run
      continue;
    }

    if (nodeType === 'action_end' || nodeType === 'action_end_flow') {
      trace.push({
        step: trace.length + 1,
        nodeId: current.id,
        type: 'action_end',
        status: 'completed',
      });
      break;
    }

    // Action dispatch (WhatsApp, Email, SMS)
    const actionChannel: ChannelType =
      nodeType === 'action_send_email'
        ? 'email'
        : nodeType === 'action_send_sms'
        ? 'sms'
        : 'whatsapp';

    const rawMsg =
      current.data?.message ||
      `Hi {{first_name}}! Thanks for reaching out to ${params.automationName}.`;

    const personalized = personalizeAutomationMessage(rawMsg, {
      fullName: lead.fullName || 'Lead Contact',
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
      listName: lead.listName || 'General Contacts',
      senderName: effectiveWorkspace?.senderName,
      automationId: params.automationId,
    });
    const formattedBody = formatRichMessageForChannel(personalized, actionChannel);

    const targetRecipient =
      actionChannel === 'email'
        ? (lead.email || '').trim()
        : (lead.phone || '').trim();

    let receipt: MessageDeliveryReceipt | undefined;
    let deliveryStatus = 'simulated_only';

    if (params.deliverLive !== false) {
      if (!targetRecipient) {
        deliveryStatus = 'skipped_missing_recipient';
      } else {
        receipt = await deliverChannelMessage({
          channel: actionChannel,
          to: targetRecipient,
          leadName: lead.fullName || 'Lead Contact',
          subject:
            actionChannel === 'email'
              ? personalizeAutomationMessage(
                  current.data?.emailSubject || params.automationName,
                  {
                    fullName: lead.fullName || 'Lead Contact',
                    email: lead.email || '',
                    phone: lead.phone || '',
                    listName: lead.listName || 'General Contacts',
                  }
                )
              : undefined,
          body: formattedBody,
          listName: lead.listName || 'General Contacts',
          source: 'automation_workflow',
          workspace: effectiveWorkspace,
          privateProfile: params.privateProfile,
        });
        receipts.push(receipt);
        deliveryStatus = receipt.status;
      }
    }

    trace.push({
      step: trace.length + 1,
      nodeId: current.id,
      type: nodeType || 'action',
      channel: actionChannel,
      recipient: targetRecipient || '(none)',
      messagePreview: formattedBody,
      deliveryStatus,
      ...(receipt
        ? {
            providerUsed: receipt.providerUsed,
            detailMessage: receipt.detailMessage,
          }
        : {}),
    });

    for (const edge of edges.filter((e) => e.source === current.id)) {
      const nextNode = nodes.find((n) => n.id === edge.target);
      if (nextNode) queue.push(nextNode);
    }
  }

  return {
    executed: true,
    stepsExecuted: trace.length,
    trace,
    receipts,
  };
}

export function doesAutomationMatchInboundMessage(
  auto: Automation,
  channel: ChannelType,
  inboundText: string,
  listName?: string
): boolean {
  if (auto.status !== 'active') return false;

  if (
    listName &&
    auto.targetList &&
    auto.targetList.toLowerCase() !== 'general contacts' &&
    auto.targetList.trim().toLowerCase() !== listName.trim().toLowerCase()
  ) {
    return false;
  }

  const { nodes } = parseWorkflowGraphNodesAndEdges(auto.flowGraphJson);
  if (nodes.length === 0) {
    if (auto.triggerType === 'whatsapp_keyword') {
      return auto.triggerDetail
        ? matchesKeywordExpression(inboundText, auto.triggerDetail, 'contains')
        : true;
    }
    return false;
  }

  const startNode =
    nodes.find((n) => {
      const nt = String(n.data?.nodeType || n.type || '');
      return n.type === 'trigger' || nt.startsWith('trigger_');
    }) || nodes[0];

  const startType = String(startNode?.data?.nodeType || startNode?.type || '');
  if (startType === 'trigger_form_submission') return false;
  if (startType === 'trigger_whatsapp_reply' && channel !== 'whatsapp') return false;
  if (startType === 'trigger_email_reply' && channel !== 'email') return false;

  if (startType === 'trigger_keyword' || startType === 'whatsapp_keyword') {
    const kw = String(
      startNode.data?.triggerKeyword || startNode.data?.keyword || auto.triggerDetail || ''
    ).trim();
    return kw ? matchesKeywordExpression(inboundText, kw, startNode.data?.matchType || 'contains') : true;
  }

  if (startType === 'trigger_whatsapp_reply' || startType === 'trigger_email_reply') {
    return true;
  }

  // Also trigger if the workflow contains a condition node whose keyword matches this inbound message
  return nodes.some((n) => {
    const t = String(n.data?.nodeType || n.type || '');
    if (t === 'condition' || t === 'condition_message_contains' || n.type === 'condition') {
      const kw = String(n.data?.keyword || n.data?.triggerKeyword || '').trim();
      return kw ? matchesKeywordExpression(inboundText, kw, n.data?.matchType || 'contains') : false;
    }
    return false;
  });
}
