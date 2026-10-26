export type DelayUnit = 'Minutes' | 'Hours' | 'Days';

export type WorkflowNodeType = 
  | 'trigger_whatsapp_reply'
  | 'trigger_email_reply'
  | 'trigger_keyword'
  | 'condition_message_contains'
  | 'action_send_whatsapp'
  | 'action_send_email'
  | 'action_end_flow'
  | 'delay_wait';

export interface WorkflowNodeData {
  label: string;
  nodeType: WorkflowNodeType;
  // Delay node properties
  delayValue?: number;
  delayUnit?: DelayUnit;
  // Message node properties
  message?: string;
  emailSubject?: string;
  // Condition node properties
  keyword?: string;
  matchType?: 'contains' | 'exact' | 'starts_with';
  // Trigger properties
  triggerKeyword?: string;
  [key: string]: any;
}

export interface WorkflowRecord {
  id: string;
  userId: string;
  name: string;
  nodesJson: string; // JSON serialized nodes array
  edgesJson: string; // JSON serialized edges array
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpJobRecord {
  id: string;
  workflowId: string;
  userId: string;
  leadPhone: string;
  nextActionAt: number; // Unix timestamp in ms
  delayValue: number;
  delayUnit: DelayUnit;
  message: string;
  actionType: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sentAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
