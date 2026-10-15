# Daily Manual CSV Import (Method 4) & Instant Kill Switch Architecture Plan

A dedicated, streamlined 5-minute morning routine inside FlowPilot's Contacts CRM that allows affiliate marketers, digital creators, and agency operators to import daily buyer sales CSV reports (from Selar, Expertnaire, Stakecut, ClickBank, or custom sheets), automatically apply the `Purchased_Course` tag to existing leads, update their records, and instantly trigger the automation Kill Switch to halt ongoing email and WhatsApp pitches and cancel all queued scheduled messages.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Based on your confirmed responses:
> 1. **Primary Input Source**: Custom CSV spreadsheet with buyer email addresses or WhatsApp phone numbers (supporting single-column and multi-column formats).
> 2. **Access Location**: Integrated directly into an **Enhanced CSV Import modal** in Contacts CRM with a dedicated **"Method 4: Daily Sales Import & Kill Switch"** tab and quick-preset mode.
> 3. **Kill Switch Execution**: Upon import, existing contacts are matched by email or phone, the `Purchased_Course` tag is added, and all active automated follow-up sequences and pending queued messages in the scheduler are **instantly halted and cancelled**.

- **Confirmed Decision 1 (Pre-Set Kill Tag)**: The import mode automatically pre-populates `Purchased_Course` as the default applied tag and enables "Update existing contacts" by default.
- **Confirmed Decision 2 (Multi-Channel Cancellation)**: Halts scheduled messages across both Email and WhatsApp instantly via `/api/scheduler/kill-switch`.
- **Confirmed Decision 3 (Real-Time Audit Receipt)**: Generates a clear import summary banner detailing: Total contacts processed, Existing leads updated with `Purchased_Course`, and Number of active automation runs halted.

---

## 1. Overview & Core Concept

### What It Does
Provides an effortless 5-minute daily morning workflow for creators and affiliate marketers:
1. **Phase 1 (Setup Once)**: Automation workflows enforce an explicit Exit / Kill Switch condition (`Tag is Purchased_Course`), which is verified on list creation and workflow execution.
2. **Phase 2 (Daily 5-Minute Routine)**:
   - The user exports yesterday's sales report from their affiliate dashboard (or prepares a 1-column list of buyer emails or WhatsApp phone numbers).
   - In FlowPilot Contacts CRM, they open **Import Contacts** and select the **Daily Sales Import (Method 4)** preset.
   - FlowPilot parses the CSV (or pasted list), auto-maps the column (Email or Phone), applies the `Purchased_Course` tag, and updates the existing contacts in the database.
   - FlowPilot triggers the **Instant Kill Switch Ejection**: Any queued or scheduled workflow messages for those buyer contacts are immediately cancelled, preventing embarrassing or unwanted pitches to people who already bought!

### Target Audience & Persona
- Digital creators selling online courses, masterclasses, and digital products.
- Affiliate marketers running paid ads or email/WhatsApp funnels on platforms like Selar, Expertnaire, Stakecut, ClickBank, Gumroad, or Hotmart.
- Agency operators managing multi-client follow-up campaigns where buyers must be promptly removed from sales pitch automations.

### Key Value
- **Zero Pitch Embarrassment**: Buyers never receive sales pitches after they have already purchased.
- **Speed & Simplicity**: No manual search-and-tagging contact by contact; the daily morning import takes under 2 minutes.
- **Fail-Safe Idempotency**: Safe to import repeatedly; matches by normalized email and phone without creating duplicate contacts.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. DAILY SALES CSV IMPORT WORKFLOW                                          │
│                                                                             │
│ [Contacts CRM] ──> Click [Import Contacts] ──> Select [Method 4: Daily CSV] │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Mode: Daily Sales Import (Method 4)                                     │ │
│ │ ─────────────────────────────────────────────────────────────────────── │ │
│ │ • Pre-configured Tag: [ Purchased_Course ] (Applied to all rows)       │ │
│ │ • Setting: [✓] Update existing contacts (No duplicates created)         │ │
│ │ • Target List: General Contacts (or select VIP Buyers)                  │ │
│ │                                                                         │ │
│ │ Drop .csv file here OR Paste Buyer Emails / Phone Numbers:              │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ buyer1@gmail.com                                                    │ │ │
│ │ │ +2348012345678                                                      │ │ │
│ │ │ buyer3@yahoo.com                                                    │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ Auto-Detected: 3 Buyer Records                                          │ │
│ │ • 2 by Email Address (Matches 2 existing leads in CRM)                 │ │
│ │ • 1 by WhatsApp Phone Number (Matches 1 existing lead in CRM)           │ │
│ │                                                                         │ │
│ │ [Preview & Apply Kill Switch]                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Import & Kill Switch Execution Complete!                                │ │
│ │ • 3 Contacts tagged with #Purchased_Course                              │ │
│ │ • 3 Active automation sequences immediately halted                      │ │
│ │ • 4 Scheduled pitch messages cancelled from delivery queue              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Visual Identity & Theme
- **Canvas & Surface**: Crisp slate dark header (`#0F172A`) paired with clean white and light slate surfaces (`#F8FAFC`, `#FFFFFF`), adhering to the 60-30-10 color discipline.
- **Accents**: Emerald (`#047857`) for verified kill-switch protection and active state, amber (`#D97706`) for kill-switch warnings and halted items.
- **Typography**: Display typography using `Plus Jakarta Sans`, with tabular figures (`tabular-nums font-mono`) for all row counters, phone numbers, and timestamps.
- **Zero-Pill Discipline**: Statuses and column types rendered as clean unboxed typography with typographic separators (`·`).

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Dedicated Tab Preset vs. Generic Import
- **Chosen Approach**: Add a dedicated **"Method 4: Daily Sales (Kill Switch)"** tab inside the existing Contacts CRM Import modal alongside the standard full-CRM import.
- **Why**: Allows operators to follow their exact 5-minute morning routine without having to re-type `Purchased_Course` or remember to check "Update existing contacts" every day.
- **Alternatives Considered**: Creating a completely separate modal would fragment the CRM UI; keeping it in the unified import modal keeps all CSV tools centralized.

### Decision 2: Dual Matching (Email + WhatsApp Phone)
- **Chosen Approach**: Normalize and match incoming rows against existing contacts by both email address (`john@example.com`) and phone/WhatsApp number (`+1...`, `+234...`, last 9 digits).
- **Why**: Many affiliate reports from platforms like Selar and Expertnaire provide only WhatsApp numbers or only emails. Dual matching ensures the existing lead is caught and protected regardless of which identifier the affiliate platform provided.

### Decision 3: Immediate Scheduler Interception
- **Chosen Approach**: When the `Purchased_Course` tag is applied during the import, trigger `/api/scheduler/kill-switch` on the server and evaluate local active workflow runs to immediately cancel all queued jobs for those contacts.
- **Why**: Guarantees that even if a follow-up email or WhatsApp message was scheduled to fire 10 minutes after the morning import, it will be cancelled instantly before it can be delivered.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────────┐
│ FLOWPILOT TECHNICAL ARCHITECTURE                                          │
│                                                                            │
│  [ContactsCrmView.tsx] (Method 4 Import UI)                                │
│          │                                                                 │
│          ├─ Parse CSV / Pasted lines (Auto-detect Email vs Phone)          │
│          ├─ Dual Lookup: findExistingContactByEmailOrPhone(...)            │
│          ├─ Append Tag: [Purchased_Course] to existing or new records      │
│          │                                                                 │
│          ▼                                                                 │
│  [App.tsx (handleBulkImportContacts)]                                      │
│          │                                                                 │
│          ├─ Updates state: setContacts(...)                                │
│          ├─ Syncs Dual-Store: Local/Server State + Cloud Firestore         │
│          ├─ Calls: syncKillSwitchWithServerScheduler(...)                  │
│          │                                                                 │
│          ▼                                                                 │
│  [server.ts (/api/scheduler/kill-switch)]                                  │
│          │                                                                 │
│          ├─ Scans scheduledAutomationJobs for contacts with matching tags  │
│          ├─ Marks status: 'halted_kill_switch'                             │
│          ├─ Cancels queued jobs immediately                                │
│          └─ Returns: { haltedCount, cancelledJobIds }                      │
└────────────────────────────────────────────────────────────────────────────┘
```

### Key Component & State Mutations
1. **`ContactsCrmView.tsx`**:
   - Add a mode switch in the Import Modal: **"Standard CRM Import"** vs **"Method 4: Daily Sales (Kill Switch)"**.
   - When in Method 4 mode:
     - Pre-fills tag `Purchased_Course`.
     - Automatically selects "Update existing contacts".
     - Supports 1-click quick-paste of raw email or phone lists from clipboard.
     - Live preview table shows: Contact Name, Identifier (Email/Phone), Existing Lead Match (`Found in List` vs `New Contact`), and Kill Switch Ready status.
2. **`AutomationEngineCatalog.ts` & `AutomationsView.tsx`**:
   - Ensure the Exit Condition rule `Tag is Purchased_Course` is prominently displayed in the workflow settings and canvas exit condition banner.
   - When importing leads with `Purchased_Course`, active simulations and workflow runs for those contacts are immediately terminated.
3. **`server.ts` & `messageDeliveryService.ts`**:
   - Ensure `/api/scheduler/kill-switch` cancels all queued jobs for any contact whose tags include `Purchased_Course` or matching list kill-switch tags.
   - Return detailed kill-switch execution receipts for logging in CRM activities.
