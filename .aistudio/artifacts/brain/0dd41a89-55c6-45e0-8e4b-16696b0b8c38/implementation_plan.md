# FlowPilot: Ultimate Universal Webhook Gateway & Live Inspector

Comprehensive implementation plan for FlowPilot's Universal Inbound Webhook Gateway, featuring real-time payload logging, flexible JSON field mapping to CRM contacts, one-click replay, and an interactive in-browser simulator.

---

## User Review & Critical Decisions

Based on your confirmed preferences:
- **Primary Capabilities**: Full-suite inbound gateway with UI logs, dynamic payload field mapper, and instant CRM/automation triggers.
- **Platform Compatibility**: Universal ingestion supporting any external platform (Stripe, Shopify, PayPal, Zapier, Make, WooCommerce, Typeform, Tally, custom cURL, and mobile apps).
- **Live Tester & Inspector**: Complete dashboard suite with real-time request logs, expandable raw JSON payload/header viewer, one-click payload replay, and preset simulators.

---

## 1. Overview & Core Concept

Currently, FlowPilot supports a dedicated WhatsApp webhook and direct Resend email API. To scale into a complete marketing automation and CRM hub, FlowPilot requires a **Universal Inbound Webhook Gateway** that allows any third-party app or payment gateway to push customer events into the workspace.

### Core Features
1. **Universal Endpoint**:
   - Production URL: `https://[your-domain]/api/webhook/gateway`
   - Authentication via Bearer token, query token (`?token=flowpilot_sec_...`), or custom header (`X-FlowPilot-Secret`).
   - Accepts any `application/json` or `application/x-www-form-urlencoded` payload.
2. **Dynamic JSON Field Mapper**:
   - Maps arbitrary incoming keys (`data.customer.email`, `client_email`, `customer.name`, `event_type`, `amount_total`) to FlowPilot contact properties (Full Name, Email, Phone, Stage, Tags, Deal Value / LTV, and List Segment).
   - Automatically enrols the matched contact into corresponding active workflows.
3. **Live Request Inspector & Audit Log**:
   - Real-time log table showing HTTP status, response time, timestamp, source IP, user-agent, and event type.
   - Expandable drawer displaying full request headers, query parameters, and beautified raw JSON body.
   - **One-Click Replay**: Re-trigger any historical payload to re-execute automations and field parsing without leaving the UI.
4. **Interactive In-Browser Webhook Simulator**:
   - Built-in test sandbox with presets for **Stripe** (`payment_intent.succeeded`), **Shopify** (`orders/create`), **Zapier** (`new_lead`), **Typeform** (`form_response`), and **Custom JSON**.
   - Live "Dispatch Test Webhook" button that hits the local endpoint and displays the parsing result, matched contact, and triggered workflow trace in real time.
   - Instant cURL snippet generator with copy-to-clipboard for quick terminal testing.

---

## 2. User Experience & Visual Design

Following the established FlowPilot $99/mo SaaS design system:
- **Deep Royal Blue (`#2563EB`)**: Primary interactive actions, cURL copy badges, active tab states.
- **Slate Neutrals (`#0F172A`, `#F8FAFC`, `#E2E8F0`)**: Clean card containers, hairline borders, high-contrast typography.
- **Zero-Pill Architecture**: Clean unboxed status markers, micro status dots (solid 6px emerald/amber/ruby pips), and monospaced code blocks.
- **Tabbed Layout**:
  - `Overview & Credentials`: Endpoint URL, copyable verification token, quick cURL snippet, and gateway switch.
  - `Live Request Inspector`: High-density tabular log with filter by status (`200 OK`, `400 Bad Request`), search, and payload viewer.
  - `Field Mapping & Triggers`: Key-value mapping interface to pair JSON dot-notation paths with CRM contact fields and target workflow sequences.
  - `Interactive Sandbox`: Test payload console with template picker, JSON editor, and execution response trace.

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Rationale |
| :--- | :--- | :--- |
| **Authentication Strategy** | Multi-vector: Header `X-FlowPilot-Secret`, Bearer Token, or `?token=` query param | Ensures seamless integration with platforms that don't allow custom headers (e.g. basic webhooks from Typeform or PayPal). |
| **Log Storage & Performance** | In-memory circular buffer (last 100 requests) backed by persistent snapshot | Instant sub-millisecond retrieval and replay in the UI without overloading Firestore write quotas on high-frequency webhook bursts. |
| **Payload Extraction** | Nested path resolution (e.g. `data.object.customer_details.email`) with fallback heuristics | Allows effortless mapping of complex payloads from Stripe and Shopify without writing custom regex. |
| **Contact Upsert Logic** | Match by Email or Phone, then merge tags and accumulate LTV | Prevents duplicate contacts while tracking ongoing lifetime value and automated list enrollment. |

---

## 4. Technical Architecture & Component Hierarchy

```
FlowPilot Workspace (App.tsx)
 ├── Navigation Bar
 │    └── "Webhooks & Gateway" (Tab ID: 'webhooks')
 └── Main Content Controller
      └── WebhookGatewayView.tsx
           ├── EndpointCredentialsCard (URL, Token, cURL Generator)
           ├── Subview Switcher:
           │    ├── [Logs & Inspector] -> WebhookLogsTable & PayloadDrawer
           │    │    ├── Request Status Dot & Latency (ms)
           │    │    ├── Raw JSON Inspector & Headers
           │    │    └── "Replay Payload" Action
           │    ├── [Field Mapper] -> WebhookFieldMapper
           │    │    ├── Path Matcher (e.g. data.customer.email -> Contact Email)
           │    │    └── Automation Trigger Selector (Run workflow on event)
           │    └── [Sandbox & Simulator] -> WebhookSimulator
           │         ├── Preset Picker (Stripe / Shopify / Zapier / Custom)
           │         ├── Live JSON Payload Editor
           │         └── "Dispatch Simulation" Execution Trace
           │
Backend Layer (serverCore.ts & routes/webhookGateway.ts)
 ├── POST /api/webhook/gateway (Universal Inbound Ingestion)
 ├── GET  /api/webhook/gateway/logs (Fetch Recent Requests)
 ├── POST /api/webhook/gateway/simulate (In-memory Payload Test)
 ├── POST /api/webhook/gateway/replay/:logId (Re-run Recorded Request)
 └── CRM Contact Upsert & Automation Engine Trigger
```

---

## 5. Implementation Steps

1. **Backend Endpoint & Engine (`serverCore.ts`)**:
   - Register `/api/webhook/gateway` with token authentication, nested path resolver, contact upsertion, and in-memory log buffer.
   - Register auxiliary routes: `/api/webhook/gateway/logs`, `/api/webhook/gateway/simulate`, `/api/webhook/gateway/replay/:logId`.
2. **Data Types & Navigation (`src/types.ts`, `src/App.tsx`)**:
   - Add `'webhooks'` to `ActiveTab` type union.
   - Add `WebhookGatewayView` import and tab entry in `navItems` with `Radio` / `Webhook` icon.
3. **Build Frontend Webhook Gateway Suite (`src/components/WebhookGatewayView.tsx`)**:
   - Endpoint credentials with copy buttons.
   - Live Request Inspector with JSON drawer and Replay button.
   - Visual Field Mapping interface.
   - Interactive Sandbox with Stripe, Shopify, Zapier, and Custom presets.
4. **Verification & Testing**:
   - Validate TypeScript compilation (`compile_applet`) and linting (`lint_applet`).
   - Test live ingestion via test simulator and verify contact creation and activity log updates.
