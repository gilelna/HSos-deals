# HSos — ROADMAP.md
_Strategic plan. Phases reflect real build priority._
Last updated: 2026-04-22

---

## Phase 1 — Demo DB complete (current)
**Goal:** Every space functional with real Supabase data, no dummy mode.

### Sales ✅ Done
- [x] Deals kanban + list view
- [x] Clients list + profile
- [x] Vendors list + profile
- [x] Products + plans
- [x] Deal panel: inline-edit price/VAT/currency/notes
- [x] Vendor reassignment via modal with warning
- [x] Payment plan routing (product_plans table)
- [x] Deep linking (URL params)

### Operations ✅ Done
- [x] Vendor session logging (task-based, USD rate locked)
- [x] Client assignment per vendor
- [x] Package tracking (sessions_used)
- [x] Draft bill creation (vendor side)
- [x] Bill submit + withdraw
- [ ] Client names clickable → client-profile.html (currently not linked)

### Payments ✅ Core done / 🟡 Reconcile pending
- [x] Bill approval workflow (manager): draft → approved → paid
- [x] Bill rejection with notes → vendor creates fresh draft
- [x] History tab (paid bills)
- [x] Registry tab (companies, accounts, exchange rates)
- [x] Schema: companies, accounts, transaction_categories, classification_rules, transactions tables
- [x] Transactions tab — ledger of all money in/out (26 rows, filter chips working)
- [x] Expected Income tab — open deals pending payment (filter fixed: includes partial/overdue)
- [x] Alert bar wired to real counts
- [ ] Reconcile tab — match transactions to deals/bills (eiMatchTx is still a stub)
- [ ] CSV import per provider (Brex, Mizrahi, Wise, PayPal, Santander, Green Invoice)
- [ ] Client name links in Expected Income → client-profile.html

### Schema still needed
- [x] Fix db.js: expose window._sb ← DONE
- [x] Fix payments.js: use window._sb ← DONE
- [x] Seed transaction_categories ← 28 categories already in DB

---

## Phase 2 — Automation and integrations (upcoming)

### Automation Engine

#### Overview
HSos will include a built-in automation registry — a structured, auditable system for managing all recurring logic, state transitions, notifications, cross-system triggers, and data ingestion jobs. All automations are defined as rows in a Supabase table, visible to admins via a dedicated UI page, and logged on every execution.

#### Core Design

**`automations` table**
```sql
id            uuid primary key
name          text                          -- human-readable label
description   text                          -- what it does in plain language
trigger_type  text                          -- 'scheduled' | 'event' | 'manual' | 'webhook'
trigger_config jsonb                        -- { cron: "0 8 * * *" } or { on: "payment.overdue" }
action_type   text                          -- 'update_status' | 'slack_notify' | 'ac_tag' | 'fetch_external' | 'manual_upload' | 'send_report'
action_config jsonb                         -- action-specific params
enabled       boolean default true
last_run_at   timestamptz
last_run_status text                        -- 'success' | 'error' | 'skipped'
created_at    timestamptz default now()
```

**`automation_logs` table**
```sql
id              uuid primary key
automation_id   uuid references automations(id)
run_at          timestamptz
status          text        -- 'success' | 'error' | 'skipped'
records_affected int
error_message   text
meta            jsonb       -- any debug info
```

#### Automation Taxonomy

| Type | Examples | action_type |
|---|---|---|
| State transitions | pending → overdue after 7 days | `update_status` |
| Notifications | Slack alert on overdue payment | `slack_notify` |
| Cross-system push | Add tag in ActiveCampaign, create task in Monday | `ac_tag`, `monday_task` |
| Data ingestion | Wise rate pull, Stripe failed payments, bank balance snapshot | `fetch_external` |
| Manual upload trigger | Bank Mizrahi CSV (no API) — reminder + import handler | `manual_upload` |
| Scheduled reports | Weekly summary, monthly payroll overview | `send_report` |

#### Execution Layer
- **pg_cron** → triggers scheduled Edge Functions daily/weekly/monthly
- **DB triggers or frontend events** → trigger event-based automations
- **Edge Functions** → execute logic, call external APIs, write results + logs
- **Integration adapters** (one per external service): Slack, ActiveCampaign, Monday, Wise, Stripe, Green Invoice

#### Bank Mizrahi Handling
Mizrahi has no API. The automation still exists in the registry with `action_type: manual_upload`. On schedule, it sends a Slack reminder to the relevant team member to perform the CSV export. The existing CSV Importer handles the rest. The automation log records the reminder as sent.

#### Admin UI — Automations Page
- List of all automations with name, type, status (enabled/disabled), last run, last result
- Toggle enable/disable per automation
- Drill into logs per automation
- Future: inline editor for trigger/action config in human-readable form

#### Phase Sequencing
**Phase 1 (Demo DB — before production lock):**
- Define schema: `automations` + `automation_logs`
- Build Automations page in Admin space (read-only list + toggle)
- Implement first end-to-end automation: payment pending → overdue after N days
- Implement Slack adapter (already planned for notifications)

**Phase 2 (Production):**
- pg_cron jobs wired to Edge Functions
- Data ingestion: Wise exchange rate pull (monthly)
- Data ingestion: Stripe failed payment scan (daily)
- Slack reminder for Mizrahi CSV upload

**Phase 3+:**
- ActiveCampaign adapter (addTag, updateField, triggerAutomation)
- Monday.com adapter
- Green Invoice adapter
- In-UI automation builder (human-language config → table row)
