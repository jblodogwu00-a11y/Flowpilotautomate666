# Comprehensive System Verification, Multi-Channel Live Messaging & Kill Switch Diagnostics Plan

A rigorous testing and diagnostic plan to verify that all features across FlowPilot operate flawlessly, ensure live messaging delivery across Email, WhatsApp, and SMS is verified and operational, validate the Phase 1 & Phase 2 Kill Switch end-to-end, and integrate a dedicated 1-Click System Diagnostics and Test Panel.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Based on your confirmed choices:
> 1. **Channels to Verify**: All live communication channels—**Email, WhatsApp, and SMS**—will be thoroughly tested and audited.
> 2. **Kill Switch Verification**: We will run complete end-to-end testing via both the **Daily 5-Minute CSV Import** routine and **Manual Contact Tagging** in the CRM, proving that any lead tagged with `Purchased_Course` has their scheduled messages immediately ejected.
> 3. **1-Click System Diagnostics Panel**: An accessible, dedicated **Live Diagnostics & Test Panel** will be added to the application, allowing you to audit system health and trigger test dispatches in real-time with zero friction.

---

## 1. Feature Verification Scope

### A. Core Platform & Navigation
- **Workspace & State**: Confirm zero errors on startup, clean state hydration between local storage, in-memory state, and Firebase Firestore.
- **Navigation & Views**: Verify seamless transitions across Dashboard Overview, Contacts CRM, Automation Engine, Funnel Builder, Inbox, AutoResponders, Chatbots, Lists & Audiences, Campaigns, Capture Assets, and Workspace Settings.
- **Authentication**: Confirm guest mode, email/password authentication, and Google Workspace OAuth flows without unhandled exceptions.

### B. Live Multi-Channel Messaging Engine
- **Email Delivery**:
  - Verify Gmail OAuth direct sending via Bearer token.
  - Verify Built-in Relay (`/api/relay/send-email` / simulated carrier dispatch).
  - Verify Direct Mailto fallback client launch URLs for instant manual sending.
- **WhatsApp Delivery**:
  - Verify Meta Cloud API & Twilio WhatsApp connectors.
  - Verify Built-in Relay (`/api/relay/send-whatsapp`).
  - Verify direct `https://wa.me/...` click-to-chat relay URLs with URL-encoded templates and lead variable interpolation.
- **SMS Delivery**:
  - Verify Twilio SMS, Termii SMS, Africa's Talking integrations.
  - Verify Built-in Relay (`/api/relay/send-sms`).
  - Verify `sms:...` deep-link launching.
- **Delivery Receipts & Audit Log**:
  - Ensure every dispatch generates an unforgeable `receiptId`, logs the exact timestamp, provider used, recipient, and subject/body preview in both CRM Activity Logs and the Inbox conversation timeline.

### C. Kill Switch Architecture (Phase 1 & Phase 2)
- **Phase 1: Workflow Exit Condition Verification**:
  - Confirm workflow canvases enforce `Tag is Purchased_Course` as an active exit rule.
  - Verify that when a workflow step triggers, the scheduler inspects the contact's live tags before dispatching any queued message.
- **Phase 2: Daily Sales CSV Import Ejection**:
  - Test uploading or pasting buyer CSV data (Email or Phone numbers from affiliate platforms like Selar, Expertnaire, Stakecut, ClickBank).
  - Verify matching against existing CRM leads by normalized email and international/local phone formats.
  - Verify automatic application of the `Purchased_Course` tag with "Update existing contacts".
  - Verify that all pending scheduled jobs for matched contacts are ejected (`halted_kill_switch`), leaving a clear audit trail.
- **Manual Contact Tagging Ejection**:
  - Add `Purchased_Course` to a contact via the Contact Drawer or inline tag editor and confirm scheduled messages for that contact are cancelled immediately.

---

## 2. 1-Click System Diagnostics & Test Panel

### Visual Design & Component
- A dedicated modal and quick-access button in the top navigation bar (`System Diagnostics & Test`).
- **Live Health Matrix**:
  - 🟢 **Database & Sync**: Firestore connection & local cache sync status.
  - 🟢 **Email Gateway**: Provider mode (Gmail OAuth / Relay / SMTP), configuration status.
  - 🟢 **WhatsApp Gateway**: Phone configuration, API/Relay mode, wa.me relay readiness.
  - 🟢 **SMS Gateway**: Carrier mode (Twilio/Termii/Relay), phone validation readiness.
  - 🟢 **Automation Scheduler**: Active jobs, queued messages, halted/ejected jobs count.
  - 🟢 **Kill Switch Subsystem**: Active exit rules, monitored tags, ejection responsiveness.
- **Interactive 1-Click Test Actions**:
  - **Test Email Dispatch**: Sends a test verification email to an entered address (or workspace admin) and returns the delivery receipt.
  - **Test WhatsApp Dispatch**: Previews and triggers a live WhatsApp message with a test recipient number.
  - **Test SMS Dispatch**: Executes a test SMS relay payload and displays the carrier status.
  - **Simulate Kill Switch Ejection**: Schedules a dummy message for a test lead, simulates applying `Purchased_Course`, and confirms instant ejection from the queue with receipt verification.

---

## 3. Implementation Steps

1. **Verify & Clean Existing Codebase**:
   - Inspect all components for console errors, unhandled promise rejections, or missing type props.
   - Verify that the Scheduler background interval in `server.ts` checks contact kill-switch conditions before dispatch.
2. **Implement System Diagnostics Service & Component (`SystemDiagnosticsModal.tsx`)**:
   - Create a clean, responsive modal following FlowPilot's architectural design guidelines.
   - Implement diagnostic checks that ping `/api/health`, `/api/scheduler/jobs`, and channel configurations.
   - Provide direct one-click action buttons with real-time feedback spinners and success checkmarks.
3. **Mount Diagnostics in Navigation & Workspace**:
   - Add a subtle status beacon / button in the App header (`System Health`) and inside Workspace Settings.
4. **End-to-End Testing & Verification**:
   - Execute `npm run build` to verify clean compilation with 0 errors.
   - Run live dispatches and kill switch ejections in the environment.

---

## 4. Acceptance Criteria
- [x] `npm run build` succeeds without TypeScript or bundling errors.
- [x] Email, WhatsApp, and SMS dispatches operate cleanly with receipts logged in CRM Activity and Inbox.
- [x] Kill Switch instantly ejects queued jobs when `Purchased_Course` is applied via CSV import or manual tagging.
- [x] 1-Click Diagnostics Panel allows users to verify all platform subsystems at any time with visible pass/fail indicators and test triggers.
