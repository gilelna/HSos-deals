# HSos — STATUS.md
_Living handoff file. Update at end of every session._
Last updated: 2026-04-22 (Activities foundation + UI — migration 016, activity log, bell, reminders)

---

## Project identity
HSos is an internal ops platform for a coaching/tutoring business (Hadar Shemesh / Accent's Way).
Stack: Plain HTML + Vanilla JS + Supabase/Postgres + Cloudways hosting.
Three companies: com_us (LLC, USD), com_il (LTD, ILS), com_es (Autonomo, EUR).
No framework. No build step. Files served directly.

---

## Current working state

### Pages
| Page | File | Status |
|------|------|--------|
| Operations dashboard (home) | deals.html + deals.js | ✅ Live — metrics, compact kanban, coaches + clients widgets |
| Operations (deals, clients, vendors, products) | deals.html + deals.js | ✅ Working |
| Workload (vendor session logging, bills) | workload.html + workload.js | ✅ Working |
| Payments — Transactions tab | payments.html + payments.js | ✅ Working — classification layer added (category, tax, B/P, tags) |
| Payments — Expected Income tab | payments.html + payments.js | ✅ Working |
| Payments — Vendor Bills tab | payments.html + payments.js | ✅ Working |
| Payments — History tab | payments.html + payments.js | ✅ Working |
| Payments — Vendor Manager tab | payments.html + payments.js | ✅ Working — vendor defaults + unmatched merchant assignment |
| Payments — Balances tab | payments.html + payments.js | ✅ New — monthly opening/closing snapshots per account, delta reconciliation |
| Vendor profile | vendor-profile.html + vendor-profile.js | ✅ New — hero with overlay, stats, assigned clients, bills, docs |
| Client profile | client-profile.html + client-profile.js | ✅ Rebuilt — hero with overlay, stats, deals/packages, payments, tags, docs, details panel |
| Products | products.html + products.js | ✅ New — hero bands, floating plan cards, product + plan modals, deep linking |
| Activity Log | activity-log.html + activity-log.js | ✅ New — full activity table, type/status filters, inline Markdown |
| Import | import.html + import.js | 🟡 Exists |

### Known broken right now (2026-04-22 — post UI fixes)
- Demo DB: migration 016 (activities + profiles patch) not yet run — must be run manually at https://pqkzffgpkpovternesmt.supabase.co

### Fixed 2026-04-22 (UI bug fixes)
- `workload.html`: Sessions tab (`#tab-work`) had `overflow-y:auto` creating an inner scroll trap — removed, page now scrolls as one unit
- `workload.js`: Profile tab showed double hero (workload cover + vendor-profile hero) — `switchTab()` now hides `.space-cover` and `.alert-bar` when `tab=profile`
- `payments.js`: Vendor Bills tab — bill card `onclick` was calling `openVendorDetail()` which routed to vendor panel. Added `openBillDetail()` that always opens the inline bill detail view. Vendor name in card is now a separate `<a>` link to `vendor-profile.html`
- `components/layout.js`: Operations sidebar — added "Vendor Bills" link under a "Payments" section heading, pointing to `payments.html?tab=vendor-bills`. Link has `.admin-manager-only` class; `applyRoleRestrictions()` hides it for Finance/Vendor roles
- `vendor-profile.js`: Bills list rows had no click handler — added `onclick="openBillDetailModal()"` to each row. Added `openBillDetailModal()` function that fetches bill+sessions via new `getBillWithSessions()` and shows a DOM-built overlay with session table, status, notes, and (for admin) Approve/Return/Mark Paid actions
- `vendor-profile.js`: Paying company showed raw `company_id` FK — `loadAll()` now fetches `companies.name` by the vendor's `company_id` and stores it in `_companyName`; `renderMeta()` uses `_companyName` first
- `db.js`: Added `getBillWithSessions(billId)` — fetches bill with joined sessions+client names

### Known broken right now (2026-04-21 — post Bills QA)
- None — all bill-related SELECT queries return 200

### Fixed in Bills QA audit (2026-04-21)
- `db.js`: `vendors.preferred_currency` doesn't exist — column is `payout_currency`. Fixed in all 6 call sites: `getBill` (removed/merged), `getPendingBills` (removed), `getAllBills`, `getProductPlans`, `getAllProductPlans`, `getPlanById`
- `db.js`: Dead V1 bill functions removed: `getBill`, `getBillSessions`, `createBill`, `updateBill`, `submitBill`, `approveBill` (V1), `returnBill`, `markBillPaid`, `deleteBill`, `getPendingBills`
- `db.js`: `approveBillV2` had stale comment claiming a `bills_total_amount_check` constraint (doesn't exist). Was passing `null` for $0 bills — fixed to pass `0` (column is NOT NULL)
- `workload.js`: `renderHistory()` had dead `paid` variable and stale comment — removed
- Production DB: seeded 1 draft bill (vendor Kayla, 3 sessions × $22 = $66) + tested full lifecycle draft→submitted→approved→paid, all transitions succeed

### Known broken right now (2026-04-12 — post QA)
- `deals` FK on primary_vendor_id/owner_vendor_id removed (uuid/text type mismatch) — known, low priority

### Fixed in QA audit (2026-04-12)
- `payments.js` loadTransactions() was using `window.DB?.client` → confirmed already fixed (`window._sb`)
- `db.js` now correctly exposes `window._sb = _sb` (line 9)
- `db.js` duplicate function declarations removed: `getCompanies`, `createCompany`, `getAccounts`, `createAccount`, `getExchangeRates`, `createExchangeRate`, `updateExchangeRate`, `deleteExchangeRate`
- `payments.js` Expected Income filter now includes `partial` and `overdue` billing statuses + excludes `closed`/`lead` sales_status
- 10 packages had stale `sessions_used` — synced to live session count
- 27 deals had `product_id` pointing to non-existent products — nulled out
- All vendors were `contractor` — updated: 6 coach, 3 team_member, 9 contractor

### DB schema state
- Old tables (uuid PKs): clients, deals, vendors, sessions, bills, packages, rates, product_plans, customers, task_types, deal_reminders, deal_documents, vendor_client_assignments, paychecks, exchange_rates, documents
- New tables (text PKs, added 2026-04-12): companies, accounts, transaction_categories, classification_rules, fee_rules, transaction_imports, transactions, products, plans, activities
- account_balances: recreated 2026-04-13 — text PK, FK to accounts.id, columns: month, opening_balance, closing_balance, currency, notes. UNIQUE(account_id, month).
- transactions.account_id: codebase now expects canonical text FK to `accounts.id` + joined account relation (`account:accounts(...)`); migration 007 updated accordingly for both demo + production.
- transactions: classification columns added (migration 009) — category_id (FK→transaction_categories), tax_treatment, entity (check: business/private), tags[]
- vendors: classification columns added (migration 009) — category_id, tax_treatment, entity, tags[], match_patterns[]
- vendors: id is text. Generated columns: full_name (→ name), active (→ is_active), email (text col)
- products: id is text. Generated column: active (→ status = 'active')
- origin enum added. billing_status has 'link_sent' added.
- deals: origin + billing_type columns added

---

## Architecture

### Files
```
db.js         — Supabase client (_sb) + all query functions. Exposes window._sb.
app.js        — Shared: role selector, vendor picker, toast, formatters
shared.css    — Single CSS file for all pages
router.js     — URL-based deep linking (entity/tab/view params)
registry.js   — Companies + accounts + exchange rates registry panel
```

### Component-based layout (added 2026-04-12)
```
components/topbar.html   — Shared topbar (logo, env toggle, role selector, avatar)
components/sidebar.html  — Shared sidebar shell (space selector only)
components/layout.js     — LAYOUT.init(pageTitle, space) loads both components,
                           injects the correct nav section for the space, sets active states
components/page-shell.html — Reference template for new pages
```

- All active pages (deals, payments, workload, import, client-profile) refactored to use layout containers
- Each page has `<div id="layout-topbar">` and `<div id="layout-sidebar">` filled by `LAYOUT.init()`
- Nav sections are injected per-space (operations/workload/payments) — no duplicate IDs
- Env toggle loaded dynamically into topbar by layout.js
- Role selector rendered by `renderRoleSelector()` (app.js) after topbar loads
- `clients-portal.html` not refactored — disabled/stub page with different layout

### Design system (shared.css)
- Colors: --gold, --green, --blue, --amber, --red, --purple + bg/text variants
- Fonts: DM Serif Display (titles), DM Sans (body), DM Mono (mono/numbers)
- Layout: .app → .topbar + .app-body → .sidebar + .app-content
- Components: .block, .btn, .tbl, .badge, .fg/.fl/.fi (form groups)
- Space cover: 140px gradient banner per space
- Alert bar: 4 contextual metric cards below cover

### Auth (demo mode)
- Bypassed entirely
- Role: 4-pill selector (Admin/Manager/Finance/Vendor) in topbar → sessionStorage `hsos_role`
- Vendor identity: sessionStorage `DEMO.vendor` → vendor picker via avatar click
- Role enforcement: `canAccessSpace(space)` + `guardSpace(space)` in app.js
  - vendor → workload only
  - manager → operations + workload (no payments)
  - admin/finance → all spaces
- Sidebar space buttons hidden per role via `LAYOUT.applyRoleRestrictions()`
- Phase 2: getRoleFromDB() in db.js will feed real role from profiles table after Google OAuth

---

## Environments
- Demo: pqkzffgpkpovternesmt.supabase.co — schema + seed data
- Production: wmqmonjnmgtoilxfqqkv.supabase.co — same schema, empty
- Single shared schema — every migration runs on both
- Schema file: migrations/PRODUCTION_SCHEMA.sql

## Supabase
Demo DB: pqkzffgpkpovternesmt.supabase.co
Production DB: wmqmonjnmgtoilxfqqkv.supabase.co
RLS: anon policies on all tables (demo mode — full read/write for anon)
Key enums: billing_status (pending/link_sent/invoiced/partial/paid/overdue), sales_status, vat_mode, origin, payment_processor

## Env switcher
- `env-config.js` defines `getEnvConfig()`, `getCurrentEnv()`, `switchEnvironment()`
- `db.js` initializes `_sb` via `getEnvConfig()` — no hardcoded credentials
- `env-config.js` loads before `db.js` in all active HTML pages: deals.html, workload.html, payments.html, client-profile.html, import.html
- Toggle UI: `env-toggle.html` component injected into topbar via `LAYOUT.init()`
- Environment persisted in `localStorage` key `HSOS_ENV` ('demo' | 'production')

## Production DB
- Migration script: migrations/PRODUCTION_SETUP.sql
- Complete consolidated schema — all tables in dependency order, no seed data, no RLS
- Status: schema ready, empty, awaiting RLS policies + data import
- Tables: clients, vendors, deals, sessions, bills, packages, task_types, products, plans,
  product_plans, programs, customers, rates, vendor_clients, vendor_client_assignments,
  vendor_hours, paychecks, payments, invoices, deal_documents, deal_reminders, documents,
  companies, accounts, exchange_rates, account_balances, system_settings,
  transaction_categories, transaction_tags, transactions, import_logs

---

## Seed: Demo products / plans / transactions
- File: seeds/001_demo_products_plans_transactions.sql
- Sources: ThriveCart catalog (TC ids as external_id), Green Invoice samples, Mizrachi bank samples, Wise samples
- Counts: programs=7, products=18, plans=66, transactions=26
- All transactions: status=unmatched, ready for reconciliation UI

---

## Schema: Products / Plans / Transactions
- Added: programs, products (uuid-PK), plans (uuid-PK), transactions (uuid-PK) tables
- Altered: deals (product_id, plan_id, agreed_price, agreed_currency, origin, external_id), packages (product_id, sessions_total)
- Migration file: migrations/004_products_plans_transactions.sql
- **Warning:** text-PK `products`, `plans`, `transactions` tables may already exist from 2026-04-12 session — resolve naming collision before applying
- Migration 011 (2026-04-16): adds new UI columns to products + plans; auto-uid triggers for PRD-XXXX / PLN-XXXX; ✅ applied to demo, ⚠️ run on production

---

## Immediate next steps
0. **ROLE RESTRICTIONS (done)**: profiles table (migration 015), guardSpace() in app.js, sidebar role restrictions in layout.js, page guards in deals.js + payments.js + products.js
1. **DB MIGRATION 010 (BOTH ENVS)**: run `migrations/010_vendor_merchant_cadence.sql` on demo + production — adds `merchant` to vendor_type enum, `payment_cadence` to vendors + transactions, verifies `vendor_id` on transactions
2. **DB MIGRATION 008+009 (DEMO)**: run `migrations/008_tx_drawer_dedup_audit.sql` and `migrations/009_classification_columns.sql` on demo if not yet applied
3. Wire client name clicks in workload.js → `client-profile.html?id=<id>` (currently no link exists)
4. Wire client name clicks in payments.js Expected Income → same client profile URL
5. Wire vendor name clicks in Operations/Payments → `vendor-profile.html?id=<id>`
6. Reconcile path: match transactions to deals (UI pending — `eiMatchTx` is a stub)
7. **DEMO DB**: run `migrations/006_account_balances_monthly_snapshots.sql` on demo (pqkzffgpkpovternesmt) via Supabase dashboard SQL editor — MCP only covers production

## DB health (post QA audit)
| Table | Count | Status |
|-------|-------|--------|
| vendors | 18 (6 coach, 3 team_member, 9 contractor) | ✅ |
| clients | 32 (29 active) | ✅ |
| task_types | 14 | ✅ |
| deals | 28 | ✅ |
| packages | 14 | ✅ sessions_used synced |
| sessions | 123 (34 with task_type, 84 billed) | ✅ |
| bills | 28 (1 submitted, 1 approved, 19 paid, 7 returned) | ✅ |
| transactions | 1,175 (26 seed + 1,149 imported 2026-04-13) | ✅ |
| companies | 3 | ✅ |
| accounts | 18 | ✅ |
| transaction_categories | 28 | ✅ |
| transactions.category_id / tax_treatment / entity / tags | — | ✅ columns present (migration 009) |
| transactions.payment_cadence / vendor_id | — | ⚠️ pending migration 010 |
| vendors.category_id / tax_treatment / entity / tags / match_patterns | — | ✅ columns present (migration 009) |
| vendors.payment_cadence / merchant vendor_type | — | ⚠️ pending migration 010 |

## Products page (rebuilt 2026-04-16)
- Hero band per product (bg image + category color overlay), floating plan cards in flex row
- Two modals: product edit (logo, details, price range, links) + plan edit (type, amount, payment link, duplicate)
- Deep linking: `products.html?plan=PLN-XXXX` scrolls + highlights target plan card
- DB: migration 011 adds logo_url, category, status, price_min/max, currency, links, prd_uid to products; plan_uid, plan_type, status, description, link_source, link_id to plans
- DB: getAllProductsWithPlans(), createProductFull(), updateProductFull(), deleteProductFull(), createPlanFull(), updatePlanFull(), deletePlanFull() added to db.js
