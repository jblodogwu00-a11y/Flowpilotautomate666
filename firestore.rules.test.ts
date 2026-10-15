/**
 * Phase 0 TDD: Firestore Security Rules Verification Specification
 * Verifies that all "Dirty Dozen" adversarial payloads return PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Contact Create',
    operation: 'create',
    path: '/contacts/contact_1',
    auth: { uid: 'uid_attacker', email: 'attacker@example.com', email_verified: true },
    payload: {
      workspaceId: 'uid_victim',
      ownerId: 'uid_victim',
      fullName: 'Spoofed Lead',
      email: 'lead@example.com',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Workspace Update',
    operation: 'update',
    path: '/workspaces/uid_owner',
    auth: { uid: 'uid_owner', email: 'owner@example.com', email_verified: true },
    payload: {
      name: 'Updated Name',
      isEnterpriseFree: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Admin Spoofing',
    operation: 'get',
    path: '/workspaces/uid_victim',
    auth: { uid: 'uid_spoof', email: 'jonajukej777@gmail.com', email_verified: false },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Orphaned Write without Parent Workspace',
    operation: 'create',
    path: '/contacts/contact_orphan',
    auth: { uid: 'uid_no_workspace', email: 'nows@example.com', email_verified: true },
    payload: {
      workspaceId: 'uid_no_workspace',
      ownerId: 'uid_no_workspace',
      fullName: 'Orphan Contact',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'ID Poisoning Attack',
    operation: 'create',
    path: '/contacts/bad$id!@#',
    auth: { uid: 'uid_owner', email: 'owner@example.com', email_verified: true },
    payload: {
      workspaceId: 'uid_owner',
      ownerId: 'uid_owner',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Denial-of-Wallet String Overflow',
    operation: 'create',
    path: '/campaigns/camp_overflow',
    auth: { uid: 'uid_owner', email: 'owner@example.com', email_verified: true },
    payload: {
      workspaceId: 'uid_owner',
      ownerId: 'uid_owner',
      messageBody: 'x'.repeat(2000),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Unbounded Array Overflow on Contact Tags',
    operation: 'create',
    path: '/contacts/contact_tags',
    auth: { uid: 'uid_owner', email: 'owner@example.com', email_verified: true },
    payload: {
      workspaceId: 'uid_owner',
      ownerId: 'uid_owner',
      tags: Array.from({ length: 15 }, (_, i) => `tag_${i}`),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/automations/auto_forged_time',
    auth: { uid: 'uid_owner', email: 'owner@example.com', email_verified: true },
    payload: {
      workspaceId: 'uid_owner',
      ownerId: 'uid_owner',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immortal Field Mutation',
    operation: 'update',
    path: '/contacts/contact_1',
    auth: { uid: 'uid_owner', email: 'owner@example.com', email_verified: true },
    payload: {
      ownerId: 'uid_other',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Terminal State Re-opening Bypass',
    operation: 'update',
    path: '/tasks/task_completed',
    auth: { uid: 'uid_owner', email: 'owner@example.com', email_verified: true },
    payload: {
      status: 'pending',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Cross-Tenant PII Read',
    operation: 'get',
    path: '/users/uid_victim/private/default',
    auth: { uid: 'uid_attacker', email: 'attacker@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unfiltered Cross-Tenant List Scraping',
    operation: 'list',
    path: '/contacts',
    auth: { uid: 'uid_attacker', email: 'attacker@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
