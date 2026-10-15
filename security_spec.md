# FlowPilot Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Tenant Isolation & Master Gate Invariant**: Every workspace document `/workspaces/{workspaceId}` must have `workspaceId == request.auth.uid` and `ownerId == request.auth.uid`. Every dependent record (`contacts`, `automations`, `campaigns`, `assets`, `chatbots`, `tasks`, `activities`, and `/workspaces/{workspaceId}/members/{memberId}`) cannot exist without an existing parent `/workspaces/{workspaceId}` owned by `request.auth.uid`.
2. **Verified Identity Invariant**: All reads and writes require `request.auth != null` and `request.auth.token.email_verified == true`.
3. **PII Split Isolation Invariant**: Personal Identifiable Information (`email`, `replyToEmail`, `phone`, `mailingAddress`, `whatsappPhoneId`, `smsSenderId`) is isolated inside `/users/{userId}/private/{profileId}` and readable/writable strictly by `request.auth.uid == userId`.
4. **Strict Key & Schema Invariant**: Every `create` and `update` must pass `isValid[Entity](incoming())`, enforcing `hasAll` and `hasOnly` on document keys, bounded string lengths, bounded list lengths, and valid enum values.
5. **Temporal & Immutable Field Invariant**: `createdAt` and `updatedAt` must equal `request.time` on `create`. On `update`, `ownerId`, `workspaceId`, and `createdAt` are immutable, and `updatedAt` must equal `request.time`.
6. **Terminal State Locking Invariant**: Once a `TaskItem` reaches `status == 'completed'`, or an `Automation` / `CaptureAsset` / `ChatbotFlow` reaches `status == 'archived'`, subsequent non-admin updates are rejected.
7. **Zero-Cost List Query Invariant**: Every `allow list` rule enforces `resource.data.ownerId == request.auth.uid` without calling `get()` or `exists()`.

---

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Identity Spoofing on Contact Create)**: Authenticated user `uid_attacker` creates a contact with `ownerId: "uid_victim"` and `workspaceId: "uid_victim"`. -> **PERMISSION_DENIED**
2. **Payload 2 (Shadow Field Injection on Workspace Update)**: Owner updates `/workspaces/uid_1` adding unauthorized field `isEnterpriseFree: true`. -> **PERMISSION_DENIED**
3. **Payload 3 (Unverified Email Admin Spoofing)**: User with `email: "jonajukej777@gmail.com"` but `email_verified: false` attempts to read another user's workspace. -> **PERMISSION_DENIED**
4. **Payload 4 (Orphaned Write without Parent Workspace)**: User `uid_no_ws` attempts to create `/contacts/c_1` when `/workspaces/uid_no_ws` does not exist. -> **PERMISSION_DENIED**
5. **Payload 5 (ID Poisoning Attack)**: User attempts to create `/contacts/invalid$id!with*bad^chars` or a 500-char ID. -> **PERMISSION_DENIED**
6. **Payload 6 (Denial-of-Wallet String Overflow)**: User creates a Campaign with `messageBody` containing a 10,000-character string (limit is 1000). -> **PERMISSION_DENIED**
7. **Payload 7 (Unbounded Array Overflow on Contact Tags)**: User creates a Contact with 25 tags in `tags` array (limit is 10). -> **PERMISSION_DENIED**
8. **Payload 8 (Client Timestamp Forgery)**: User creates an Automation with a backdated `createdAt` timestamp (`request.time - 1 day`). -> **PERMISSION_DENIED**
9. **Payload 9 (Immortal Field Mutation)**: User updates a Contact changing `ownerId` or `createdAt` to a new value. -> **PERMISSION_DENIED**
10. **Payload 10 (Terminal State Re-opening Bypass)**: Non-admin user attempts to update a TaskItem whose existing `status` is already `'completed'`. -> **PERMISSION_DENIED**
11. **Payload 11 (Cross-Tenant PII Read)**: Authenticated user `uid_attacker` attempts `get` on `/users/uid_victim/private/default`. -> **PERMISSION_DENIED**
12. **Payload 12 (Unfiltered Cross-Tenant List Scraping)**: Authenticated user `uid_attacker` runs an unfiltered `list` query across `/contacts` without filtering `ownerId == request.auth.uid`. -> **PERMISSION_DENIED**
