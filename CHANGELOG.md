# HSos — CHANGELOG.md
_Reverse chronological. One entry per session._

---

## 2026-04-22 — Activities foundation + UI

### DB (migration 016)
- `profiles` patched: added `email`, `slack_user_id`, `updated_at`
- `activities` table created with 6 indexes (entity, type, due_at, created_at DESC, status, origin)
- FK: `activities.created_by → profiles(id) ON DELETE SET NULL`
- Status: ✅ Production — ⚠️ Demo needs manual run

### db.js
- Added: `logActivity`, `getActivities`, `getClientReminders`, `getNotifications`, `updateActivity`

### New: activity-log.html + activity-log.js
- Full-width table sorted by created_at DESC
- Filter bar: body search, type dropdown, status dropdown
- Inline Markdown renderer (bold, italic, URLs — no external libs)
- Added to Payments sidebar nav

### components/topbar.html
- Bell icon (SVG) with red unread badge

### components/layout.js
- `BELL` object: dropdown, badge count, per-item Done/Dismiss, markAllDone (race-safe)
- Unread count = pending reminders + unseen integration events (localStorage hsos_bell_last_seen)
- `BELL.init()` called from `LAYOUT.init()`
- Activity Log link added to Payments sidebar nav

### client-profile.html + client-profile.js
- Reminders widget after Tags block
- List with Markdown body, due_at, overdue red highlight, status badge
- Inline add form: textarea (Markdown hint) + datetime picker
- Per-row: Mark as done | Dismiss
- `loadReminders()` called from `loadAll()`

---

## 2026-04-21 — Bills QA + db.js refactor

### db.js
- Fixed `vendors.preferred_currency` → `payout_currency` in all 6 PostgREST join selects (`getProductPlans`, `getAllProductPlans`, `getPlanById`, and in the now-removed `getBill`/`getPendingBills`). Column never existed; every bill or product-plan query with a vendor join was returning a PostgREST 400.
- Removed dead V1 bill functions: `getBill`, `getBillSessions`, `createBill`, `updateBill`, `submitBill`, `approveBill` (V1 signature), `returnBill`, `markBillPaid`, `deleteBill`, `getPendingBills` — all superseded by the V2 layer. Callers verified: none in workload.js or payments.js.
- `getAllBills` kept (used by deals.js dashboard) — vendor join removed (caller doesn't need it); now selects `*` only.
- `approveBillV2`: removed stale `bills_total_amount_check` comment + fixed `total_amount: total || null` → `total_amount: total`. Column is NOT NULL; passing null caused insert failure on $0-rate bills.

### workload.js
- `renderHistory()`: removed dead `paid` variable and stale placeholder comment.

### DB (production)
- Seeded: 1 draft bill for vendor Kayla Nicole Belush (3 sessions × $22 = $66 USD).
- Tested full bill lifecycle: draft → submitted → approved → paid. All transitions succeed.
- All FK paths confirmed: `sessions.bill_id → bills`, `sessions.client_id → clients`, `sessions.vendor_id → vendors`, `bills.vendor_id → vendors`.

---

## 2026-04-18 — Role restriction foundation

### app.js
- Added `canAccessSpace(space)` — returns true if current role can access the space
- Added `guardSpace(space, redirectTo)` — redirects unauthorized users, called on page init
- Added Phase 2 hook comments explaining the sessionStorage → DB transition path

### components/layout.js
- Added `LAYOUT.applyRoleRestrictions()` — hides sidebar space buttons per role
- Called automatically in `LAYOUT.init()`

### deals.js, payments.js, products.js (products.html inline init)
- Added `guardSpace()` call at top of page init
- vendor → redirected to workload.html
- manager → redirected from payments to workload.html

### workload.js
- Added comment: Workload is accessible to all roles. No guardSpace() call needed.

### db.js
- Added `getProfile(userId)` — fetches profile row by auth user id
- Added `upsertProfile(fields)` — creates/updates profile row
- Added `getRoleFromDB()` — Phase 2 stub; returns null in demo mode

### migrations/015_profiles_role_foundation.sql
- Drops + recreates `profiles` table with correct shape
- Columns: id (uuid), role (system_role), vendor_id (→ vendors), full_name, email, created_at, updated_at
- RLS: anon_all policy (open for demo)
- Status: ⚠️ NOT YET RUN — run on both demo and production

---

## 2026-04-16 — Products page rebuild

### New files
- `products.html` — rebuilt from scratch: hero bands, floating plan cards, product + plan modals
- `products.js` — page logic: render stack, product modal, plan modal, deep linking

### DB changes (migration 011 — applied to demo; run on production too)
- `products`: added `logo_url`, `category`, `status` (default `active`), `price_min`, `price_max`, `currency`, `links` (jsonb), `prd_uid`
- `plans`: added `plan_uid`, `plan_type`, `status` (default `active`), `description`, `link_source`, `link_id`
- Sequences `plan_uid_seq` + `prd_uid_seq` auto-generate `PLN-XXXX` / `PRD-XXXX` on insert via triggers

### db.js
- Added `getAllProductsWithPlans()` — flat list (no programs grouping) with plans attached
- Added `createProductFull()`, `updateProductFull()`, `deleteProductFull()` (cascades plans)
- Added `createPlanFull()`, `updatePlanFull()`, `deletePlanFull()`

### shared.css
- Replaced old `.products-*` block with new `.prd-*` system (hero bands, plan cards, modal base)
- Added `.modal-box` / `.modal-head` / `.modal-body` / `.modal-foot` shared modal pattern
- Added `.source-pills`, `.logo-upload-row`, `.links-list`, `.plan-link-row`, `.prd-plan-card` etc.

---

## 2026-04-14 — Vendor model + Transactions UI overhaul

### DB changes (migration 010 — run on both envs)
- Migration `010_vendor_merchant_cadence.sql`: adds `merchant` to `vendor_type` enum, adds `payment_cadence` to `vendors` + `transactions`
- `db.js`: `getTransactions()` select updated — added `payment_cadence`, removed stale `category` (raw text) + `import_id` fallback; select is now a single clean string
- `db.js`: added `getVendorById` alias for `getVendor`

### payments.js
- `canSeeTeamFinancials()` added — gates `team_member` rows in `renderTransactions()` and `renderVendorList()` to admin/finance roles only
- `vendorTypeBadge(type)` added — renders colored type pill next to vendor names in tx rows and Vendor Manager
- `vendorTypeLabel()` updated to include `merchant`
- Vendor Quick Panel fully rebuilt: module-level `_vqpState`, two states (known/unknown vendor), editable fields (category, tax, B/P, vendor type, cadence), X-only close (no outside-click dismiss)
- `vqpSaveVendor()` — saves vendor defaults + applies classification to current transaction
- `vqpSaveNewVendor()` — creates new vendor + links to transaction
- `vqpOpenSidebar()` / `vqpMergeToExisting()` added
- `vmSaveCadence(sel)` added — inline cadence save in Vendor Manager
- Vendor Manager: `payment_cadence` column added (inline select, saves on change)
- Transactions: cover shrinks on scroll (`cover-shrunk` class, scroll listener attached once via `_attachCoverShrink()`)
- Transactions: alert bar reduced to 3 cards — Total transactions, Unclassified, Out this month
- Pagination: uses `#tx-table-block` ID for reliable insertion after table

### shared.css
- Added `.cover-shrunk` styles (shrinking space cover)
- Added `.vendor-type-badge` styles

### payments.html
- Table wrapper given `id="tx-table-block"` + `class="block"` for pagination anchor
- Alert cards reduced from 4 to 3 (tx-focused: total, unclassified, out-this-month)
- Vendor Manager table header: added Cadence column (`colspan` updated to 9)

---

## 2026-04-13 — Classification columns + wildcard merchant assign

### DB changes
- Migration `009_classification_columns.sql` created and applied to production via MCP
- `transactions`: added `category_id` (FK→transaction_categories), `tax_treatment`, `entity` (check: business/private), `tags text[]`
- `vendors`: added `category_id`, `tax_treatment`, `entity`, `tags text[]`, `match_patterns text[]`
- All `ADD COLUMN IF NOT EXISTS` — safe to re-run; run on demo DB manually via SQL editor
- `NOTIFY pgrst, 'reload schema'` included

### payments.js
- Added `extractKeyword(name)` helper — strips legal suffixes (Ltd, LLC, SL, SA, GmbH, Inc, BV, NV, SAS, SARL, OÜ, AB, AS), returns first meaningful word
- `assignMerchant()`: after exact-name assign, checks for similar transactions via `ILIKE '%keyword%'`; if found, shows confirm dialog with count before bulk-assigning; audit log includes `similar_count` and `keyword`
- Exact assign now uses `.is('vendor_id', null)` filter (only reassigns unmatched transactions)

---

## 2026-04-13 — Transactions Account FK Alignment

### Changed
- `hsos-schema.sql` `transactions.account_id` aligned to `text REFERENCES accounts(id) ON DELETE SET NULL` (accounts table remains unchanged); `deleted_at` and `duplicate_of` kept as nullable transaction lifecycle fields.
- Added explicit migration helper statements in `hsos-schema.sql` footer:
  `DROP COLUMN account_id` → re-add as text FK, plus `ADD COLUMN IF NOT EXISTS deleted_at` and `duplicate_of`.
- `migrations/007_transactions_account_id.sql` updated to Path 1 migration (text FK, preserves only canonical `accounts.id` values, nulls non-matching legacy strings) and keeps `transactions_account_id_idx`.
- `db.js`:
  `getAccounts()` now returns `id, name, provider, company_id, company:companies(name)` (for UI dropdowns).
  Added `getTransactions({ includeDeleted })` with `account:accounts(...)` join and `deleted_at IS NULL` default filter.
  Updated transaction-dependent checks to ignore soft-deleted rows.
- `payments.js`:
  Transactions load now uses `getTransactions()` from `db.js` (joined account object).
  Account rendering switched from raw `account_id/source` strings to account relation display (`transaction.account?.name`).
  Account filter dropdown now loads from `getAccounts()` (canonical `accounts.id` text values).
  Provider chips (`Wise/Brex/Mizrahi`) now filter by `account.provider` instead of old account-id prefixes.
  Added explicit `⚠️ Unassigned` account state in vendor quick panel / new merchant flow when `account_id` is null.
  Removed account label fallback to `transaction.source`.

## 2026-04-13 — Account Balances Tab

### Added
- **`account_balances` table** — recreated with new schema: text PK, FK to `accounts.id`, columns `month` (date, first of month), `opening_balance`, `closing_balance` (nullable), `currency`, `notes`, `UNIQUE(account_id, month)`. Migration: `migrations/006_account_balances_monthly_snapshots.sql`. Applied to production via MCP; demo requires manual run via Supabase dashboard.
- **4 new db.js functions**: `getAccountBalances(accountId, year)`, `upsertAccountBalance({...})`, `deleteAccountBalance(id)`, `getTransactionSumByAccountMonth(accountId, month)` → returns `{ total_in, total_out, net }`
- **Balances tab** in Payments sidebar (after Registry) — `nav-balances` in layout.js
- **`loadBalances()`** in payments.js: account selector + year filter, table with 8 columns (Month, Opening, Closing actual, Transactions Net, Expected Closing, Delta, Notes, Actions). Delta cell: green if 0, amber if <5% of closing, red if large; `—` if no closing entered yet.
- **Balance Snapshot modal**: Add/Edit with account select, month picker, opening/closing balance, currency, notes. Save via `upsertAccountBalance()`.
- **Inline delete confirmation** modal (no native confirm/alert).
- **Alert bar card**: "Unreconciled accounts" — count of current-month snapshots where closing_balance is null or delta ≠ 0. Updates on tab load and after each save/delete.

### Changed
- `registry.js` `renderOpeningBalances()` updated to display new schema columns (read-only view; editing managed from Balances tab). `_addBalanceRow` and `_saveFieldRaw` updated accordingly. Removed unused `isUuid` helper.
- `hsos-schema.sql` `account_balances` definition updated to match new schema.
- `switchTab()` wired for `'balances'` → `loadBalances()`.
- Alert bar "Awaiting receipt" placeholder replaced with "Unreconciled accounts" card.

---

## 2026-04-12 — Transaction Classification System

### Added
- **Classification layer** on Transactions table: `category_id`, `tax_treatment`, `entity` (B/P), `tags` columns
- **Inline cell editors**: click any classification cell to open a searchable dropdown or tag popover in place; Tab moves to next cell, Enter confirms, Escape cancels
- **B/P toggle pill**: click to cycle Business ↔ Private per row; auto-sets on category pick
- **Tag editor**: popover with chip removal, autocomplete from TAG_POOL, free-text entry
- **Needs-review indicator**: amber 3px left border on rows with no `category_id` AND no `entity`
- **Advanced filter bar** above transactions: Account, Month, Category, Entity, ⚠ Needs Review toggle
- **Multi-select + Bulk edit bar**: checkbox column + select-all header; fixed bottom bar slides up when rows selected; bulk-apply Category / Tax / B/P / Tags to all selected rows in one Supabase call
- **Vendor Manager tab** (new sidebar link): two sections — Vendor Defaults (inline classification + alias editor per vendor, Save button per row) and Unmatched Merchants (assign to vendor or create new, pulls defaults onto matching transactions)
- **JS constants** hardcoded: `CATEGORIES` (28 entries), `TAX_TREATMENTS` (13 keys), `TAG_POOL` (42 tags)
- Auto-fill `tax_treatment` from category pick (user can override)

### Changed
- `loadTransactions` now selects `category_id, tax_treatment, entity, tags` columns
- `renderTransactions` adds 4 new columns + checkbox col (10 cols total); `needs_review` filter now checks `category_id IS NULL` instead of `status='unmatched'`
- `tx-row-review` changed from amber background fill to 3px amber left border

---

## 2026-04-12 — Full QA Audit

### Bugs fixed
- `db.js`: Removed duplicate function declarations for `getCompanies`, `createCompany`, `getAccounts`, `createAccount`, `getExchangeRates`, `createExchangeRate`, `updateExchangeRate`, `deleteExchangeRate` (first occurrences removed, registry versions kept)
- `payments.js`: Expected Income filter expanded from `['pending','link_sent','invoiced']` to also include `'partial'` and `'overdue'`; added `.not('sales_status','in','("closed","lead")')` exclusion
- `payments.js`: Added badge color entries for `partial` and `overdue` billing statuses

### Data fixed
- 10 packages had stale `sessions_used` out of sync with actual session records — synced to live count
- 27 deals had `product_id` pointing to product IDs that don't exist in `products` — nulled out
- All 18 vendors were `contractor` type — updated to: 6 `coach`, 3 `team_member`, 9 `contractor`

### Data seeded
- Created 1 `submitted` bill for Vendor 02 (3 sessions, $140) to enable bill approval workflow testing
- Created `seeds/seed_demo_data.sql` — idempotent seed file covering vendor types, sessions_used sync, product_id cleanup

### Verified working
- DB: all 34 required tables present, RLS anon policies in place for core tables (core tables have RLS off; anon policies on deals, clients, sessions, bills, vendors, etc.)
- `db.js` line 9: `window._sb = _sb` — confirmed present
- `payments.js`: `loadTransactions()` uses `window._sb` — confirmed
- Transactions tab: 26 rows load
- Expected Income: 15 open deals (pending/invoiced/partial/overdue, active/qualified/delivered)
- Vendor Bills: 1 submitted bill visible, 1 approved ready-to-pay
- History: 19 paid bills
- Bill approval workflow functions wired: `approveBillV2`, `rejectBillV2`, `markBillPaidV2`
- Session logging: `logSessionV2` called correctly in workload.js
- Draft bill: `createDraftBillV2` / `submitDraftBillV2` / `withdrawBillV2` all present and wired

### Client profile consistency (Phase 3)
- `client-profile.html` is a full standalone page with tabs: Overview, Deals, Sessions, Packages
- `deals.js` navigates to it via `showClientDetail(clientId)` → `window.location.href = 'client-profile.html?entity=client&id=...'`
- `workload.js` has NO client click handler — clients are not clickable from Operations
- `payments.js` has NO client click handler — clients in Expected Income are not linked
- **Action needed**: add client name links in workload.js and payments.js

### Reconcile path (Phase 2.8)
- `transactions.linked_entity_type` and `linked_entity_id` columns exist (uuid type)
- No UI exists for reconciliation yet — `eiMatchTx()` is a stub
- All 26 existing transactions have `status='unmatched'` and no `linked_entity_id`

### Still broken / pending
- Client name not clickable from Operations or Payments spaces
- Reconcile UI not built (eiMatchTx stub)
- `partial`/`overdue` badge CSS vars (`--gold-bg`, `--red-bg`) should be verified in shared.css
- 89 sessions have no `task_type_id` — these are legacy sessions from old logging flow

---

## 2026-04-12 — Schema: Programs / Products / Plans / Transactions (migration 004)

### DB changes
- Dropped old text-PK tables: products, plans, transactions
- Created new uuid-PK tables: programs, products, plans, transactions
- programs: id, name, slug, description, logo_url, audience_segment, active
- products: id, program_id→programs, name, description, sessions_included, vendor_type, base_price, base_currency, active
- plans: id, product_id→products, name, payment_type, installments_count, amount, currency, payment_rail, payment_link_url, external_id, active
- transactions: id, source, direction, external_id, status, amount, currency, exchange_rate, amount_ils, counterparty_name, counterparty_account, reference, event_type, transaction_date, settled_date, installment_index, linked_entity_type, linked_entity_id, plan_id→plans, tax_category, category, tags, raw_data
- deals: added product_id, plan_id, agreed_price, agreed_currency, origin (check: manual/thrivecart/green_invoice/other), external_id
- packages: added product_id, sessions_total
- Migration file: migrations/004_products_plans_transactions.sql
- notify pgrst reload schema

---

## 2026-04-12 — Payments schema + Transactions layer

### DB changes (run in Supabase SQL Editor)
- Added new tables with text PKs: companies, accounts, transaction_categories, classification_rules, fee_rules, transaction_imports, transactions, products (new), plans (merged from offers)
- Seeded: 3 companies, 18 accounts, 28 transaction categories, 15 classification rules, 4 fee rules
- vendors.id changed to text. Added generated columns: full_name (→ name), active (→ is_active). Added email column.
- products.id is text. Added generated column: active (→ status = 'active')
- origin enum created (manual/thrivecart/stripe/other)
- billing_status enum: added 'link_sent'
- deals: added origin column + billing_type column
- Removed FK constraints on deals (primary_vendor_id, owner_vendor_id) — uuid/text mismatch
- notify pgrst reload schema

### payments.html
- Added 2 new sidebar nav links: Transactions + Expected Income
- Added tab divs: #tab-transactions + #tab-expected-income
- Default tab: transactions (was vendor-bills)

### payments.js
- Added Transactions tab: loadTransactions(), renderTransactions(), setTxFilter(), updateTxMetrics()
- Added Expected Income tab: loadExpectedIncome(), renderExpectedIncome(), updateEiMetrics()
- BUG: loadTransactions() uses `window.DB?.client` — must change to `window._sb`

### db.js
- TODO: add `window._sb = _sb` after createClient line

---

## 2026-04-11 — UI shell redesign

### shared.css
- Sidebar navigation replaces horizontal tabs
- Space selector with colored dots at top of sidebar
- Space cover: 140px gradient banner
- Alert bar: 4 metric cards below cover

### All pages
- Sidebar HTML added to deals.html, workload.html, payments.html

---

## 2026-04-xx — Bills model (restaurant pattern)

### DB
- bills table: draft/submitted/returned/approved/paid
- sessions: added billed, bill_id, task_type_id, rate_usd, hours

### workload.js
- Task-based session logging with locked USD rate
- Draft bill creation and submission (vendor side)

### payments.js
- Manager bill approval: draft → approved → paid
- Rejection with notes + fresh draft flow
- One active bill per vendor enforced

---

## Foundation

### db.js
- Clean Supabase query layer, no dummy mode
- All queries: vendors, clients, deals, sessions, bills, packages, rates, products, companies, accounts, exchange_rates, documents, vendor_client_assignments, product_plans, customers

### deals.js
- Deals kanban + list, clients, vendors, products
- Payment plan routing via product_plans
- Vendor reassignment modal
