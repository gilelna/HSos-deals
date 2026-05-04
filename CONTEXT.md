# HSos Project Context
Generated: 2026-05-02

## File inventory

### Reference docs
| File | Lines |
|------|-------|
| RULES.md | — |
| STATUS.md | — |
| SCHEMA.md | — |
| AUDIT.md | — |
| CHANGELOG.md | — |
| ROADMAP.md | — |
| SPEC.md | — |
| HSOS_SCHEMA.sql | 665 |
| hsos-schema.sql | 1065 |

### Core layer
| File | Lines | Role |
|------|-------|------|
| db.js | 2098 | Single Supabase query layer (the only `_sb.from(...)` site) |
| app.js | 353 | Role/toast/avatar/escape utilities |
| router.js | 132 | URL-state router |
| cache.js | 60 | 5-min TTL read-through cache |
| env-config.js | 152 | Demo/production switcher |
| env-keys.js | 9 | Anon-key holder |
| shared.css | 4101 | Single global stylesheet |
| index.html | 430 | Landing |
| login.html | 218 | Login (demo bypass) |
| env-toggle.html | 170 | Env toggle UI |
| profile.js | 158 | Inline name editor |
| panel-manager.js | 1892 | Legacy unified side panel (still used in places) |
| registry.js | 932 | Master-data admin (companies, accounts, categories, tags) |

### Operations / Sales space
| File | Lines | Role |
|------|-------|------|
| deals.html | 707 | Operations shell (dashboard / deals / clients / vendors / products) |
| deals.js | 23 | Quill editor for new-deal modal |
| deals-init.js | 248 | Page boot, routing, page switching |
| deals-state.js | 87 | Globals + constants |
| deals-dashboard.js | 390 | Dashboard view |
| deals-kanban.js | 214 | Filtering + kanban + list view |
| deals-modal.js | 562 | 3-step new-deal modal |
| deals-clients.js | 343 | Clients list + AC import |
| deals-vendors.js | 925 | Vendors list + detail |
| deals-products.js | 766 | Products admin (inline CRUD) |
| client-profile.html | 254 | Standalone client profile |
| client-profile.js | 720 | Client profile logic |
| vendor-profile.html | 242 | Standalone vendor profile |
| vendor-profile.js | 777 | Vendor profile logic |
| products.html | 83 | Products showcase |
| products.js | 513 | Products showcase logic |
| activity-log.html | 114 | Activity log viewer |
| activity-log.js | 91 | Activity table + Markdown |
| deal.html / deal.js | 42 / 151 | Legacy single-deal page |

### Workload space
| File | Lines | Role |
|------|-------|------|
| workload.html | 367 | Vendor workload shell |
| workload.js | 1116 | Sessions + bills + clients tabs |

### Payments space (monolith)
| File | Lines | Role |
|------|-------|------|
| payments.html | 882 | Payments shell — 7 tabs |
| payments.js | 4511 | All payments logic (transactions, EI, bills, history, registry, balances, vendor manager) |
| payments-state.js | 37 | Classification constants (duplicated in payments.js) |

### Components
| File | Lines | Role |
|------|-------|------|
| components/layout.js | 367 | LAYOUT + BELL (topbar/sidebar + notifications) |
| components/badges.js | 177 | Status/type badge generator |
| components/icons.js | 180 | Inline SVG icons + entity colour ramps |
| components/panel-editor.js | 186 | Inline-edit framework |
| components/side-panel.js | 1015 | New side panel (sp2-* namespace) |
| components/table-framework.js | 177 | Reusable table controller |
| components/topbar.html | 41 | Topbar shell |
| components/sidebar.html | 19 | Sidebar shell |
| components/page-shell.html | 70 | Reference template |

### Importer
| File | Lines | Role |
|------|-------|------|
| import.html | 243 | 4-step CSV canvas wizard |
| import.js | 650 | Wizard controller |
| import.css | 525 | Wizard styles |
| imports/import.js | 778 | Older import implementation |
| adapters/supabase-adapter.js | 130 | DBAdapter wrapper used by importer |
| lib/csv-parser.js | 108 | CSV parser |
| lib/importer-core.js | 333 | Step1–4 importer logic |
| lib/name-resolver.js | 98 | FK name → id resolver |
| lib/schema-reader.js | 136 | Live information_schema reader |

### Other surfaces
| File | Lines | Role |
|------|-------|------|
| clients-portal.html | 943 | External client-facing portal (stub/disabled) |
| contractors.html | 401 | Contractors view |
| recurring.html | 472 | Recurring view |
| income.html | 443 | Income view |

### Migrations & seeds
| File | Lines |
|------|-------|
| migrations/004_products_plans_transactions.sql | 163 |
| migrations/005_transaction_tags.sql | 49 |
| migrations/006_account_balances_monthly_snapshots.sql | 28 |
| migrations/007_transactions_account_id.sql | 26 |
| migrations/008_tx_drawer_dedup_audit.sql | 60 |
| migrations/009_classification_columns.sql | 27 |
| migrations/010_vendor_merchant_cadence.sql | 47 |
| migrations/011_products_plans_new_columns.sql | 61 |
| migrations/012_plans_missing_columns.sql | 16 |
| migrations/013_rename_tag_rpc.sql | 19 |
| migrations/014_rates_name_column.sql | 6 |
| migrations/015_profiles_role_foundation.sql | 27 |
| migrations/016_activities_foundation.sql | 44 |
| migrations/016_seed_companies_accounts.sql | 38 |
| migrations/017_products_type_column_and_011_reapply.sql | 62 |
| migrations/PRODUCTION_SCHEMA.sql | 887 |
| migrations/PRODUCTION_SETUP.sql | 931 |
| migrations/add-product-plans.sql | 215 |
| migrations/create-import-logs.sql | 39 |
| migrations/seed-sample-plans.sql | 269 |
| seeds/001_demo_products_plans_transactions.sql | 797 |
| seeds/002_production_programs_products_plans.sql | 323 |
| seeds/seed_demo_data.sql | 90 |

### Excluded from active inventory
- `_archive/`, `_design-book/`, `mockups/`, `docs/`, `node_modules/` — not in active scan
- `v2/` — parallel rebuild tree (separate effort, not the live app)

---

## What exists (from STATUS.md)

**Live and working:**
- Operations dashboard with hero cards (clickable, filtered) + Needs Attention strip (up to 8 actionable items)
- Operations: deals (kanban + list + 5 stages), clients, vendors, products — all CRUD + inline edit
- Workload: vendor session logging (V2 task-based, locked USD rate), bills (draft → submitted → withdraw), client list with package progress, profile-in-iframe
- Payments — Transactions tab: 1,175+ rows, classification layer (category, tax, B/P, tags), bulk edit, advanced filters, pagination, CSV export, account/provider chips
- Payments — Expected Income tab: open deals filtered to pending / link_sent / invoiced / partial / overdue, with badges
- Payments — Vendor Bills tab: per-vendor list, draft → submitted → approved → paid lifecycle (V2)
- Payments — History tab: paid bills
- Payments — Vendor Manager tab: vendor defaults (category/tax/B/P/cadence) + unmatched merchant assignment with similar-tx wildcard match
- Payments — Balances tab: monthly opening/closing per account, transactions net, expected closing, delta reconciliation
- Vendor profile + Client profile: hero, stats, deals, packages, payments, tags, reminders, docs, details panel
- Products page: hero bands, floating plan cards, deep linking, prd_uid / plan_uid auto-assignment
- Activity Log: filterable table, inline Markdown
- Side panel (sp2-): new component for client/deal/vendor/session/bill/product/plan
- Cache layer: read-through with 5-min TTL, hover prefetch on kanban, skeleton UI
- Role system: Admin/Manager/Finance/Vendor with `guardSpace()` + sidebar restrictions
- Env switcher: demo (pqkzffgpkpovternesmt) ↔ production (wmqmonjnmgtoilxfqqkv)
- Activities + bell: profiles, activities table, notification bell with unread count
- CSV Canvas (`import.html`): live-schema 4-step importer (paste → map → preview → import)

**DB state (demo):** 33 vendors, 32 clients, 35 deals, 153 sessions, 35 bills (1 submitted / 1 approved / 19 paid / 7 returned), 16 packages, 18 products, 66 plans, 2,060 transactions, 17 accounts, 28 categories, 44 tags, 4 fee rules, 15 classification rules, 45 transaction imports, 1 account_balance row.

---

## What's missing (gaps)

**From ROADMAP Phase 1 (still pending):**
- 🟡 Reconcile UI — `eiMatchTx()` is a stub. No UI exists to match transactions to deals/bills.
- 🟡 CSV import per provider (Brex, Mizrahi, Wise, PayPal, Santander, Green Invoice). The generic CSV Canvas exists, but provider-specific parsers / column maps are not preset.
- 🟡 Client name links in Expected Income → client-profile.html
- 🟡 Client name links in workload.js → client-profile.html

**From STATUS follow-ups:**
- Cross-app counter audit (payments summary, vendor profile stats, client profile stats, workload alert-bar) — make all clickable to filtered views
- BILL_OPTIONS audit — side-panel bill cycle (draft/approved/rejected/ready_to_pay/paid) drifts from real `bills.status` enum (draft/submitted/approved/paid/returned)
- Bills tab status filter wiring — `?filter=submitted/ready_to_pay` parsed but not applied
- Role gating on Needs Attention strip
- Kanban full-card billing pill — still uses inline hex BILLING_COLORS
- Vendor "Rates" inline edit (out of scope this session)
- Client "Assigned vendor" inline edit (requires join-table editor)

**Schema mismatches (from AUDIT.md):**
- `stripe_payment_link`, `owner_vendor_id`, `discount` on deals — in schema, no UI field
- `actual_amount_paid`, `payment_date` on paychecks — in schema, no UI
- `paid_from_account_id`, `finance_notes` on bills — in schema, no UI
- `payment_type` vs `plan_type` ambiguity on plans
- `installments` vs `installments_count` ambiguity on plans
- Vendors `active` vs `is_active` dual-status
- `billing_status` enum missing `link_sent` in DB but referenced in code

**P&L / dashboard:**
- No P&L per-company dashboard exists. Operations dashboard shows deal/client metrics, not money.

---

## DB schema summary (from SCHEMA.md + db.js)

### Two PK generations
- **Old (uuid PK):** clients, deals, vendors, sessions, bills, packages, rates, paychecks, programs, products, plans, transactions, packages, task_types, customers, deal_reminders, deal_documents, vendor_clients, vendor_client_assignments, vendor_hours, profiles, activities, audit_log, exchange_rates, account_balances, documents
- **New (text PK):** companies, accounts, transaction_categories, transaction_tags, transaction_imports, classification_rules, fee_rules, system_settings

⚠️ Vendors id is `uuid`, but `vendor_clients.vendor_id` is also uuid — `_toUUID()` helper exists in db.js for older code paths.

### Core flows

**Deals → Sessions → Bills:**
- `deals` (uuid) ← `client_id`, `primary_vendor_id`, `product_id`, `plan_id`
- `packages` (uuid) ← deal_id, sessions_total, sessions_used (auto-derived status)
- `sessions` (uuid) ← vendor_id, client_id, deal_id, package_id, task_type_id, rate_usd (locked at creation), bill_id
- `bills` (uuid) ← vendor_id; status: draft / submitted / approved / paid / returned; total_amount NOT NULL CHECK > 0

**Transactions:**
- `transactions` (uuid) ← account_id (text), import_id, vendor_id, plan_id, category_id, classification fields (tax_treatment, entity, tags[], payment_cadence)
- direction: in / out · status: unmatched / matched / reconciled
- `linked_entity_type` (deal | paycheck | expense) + `linked_entity_id` — reconcile target
- soft delete via `deleted_at`; `duplicate_of` for dedup

**Master data:**
- `companies` (3) — com_us / com_il / com_es
- `accounts` (17) — bank/card/paypal/stripe/wise/other, per-company, per-currency
- `transaction_categories` (28) with `tax_category` mapping
- `account_balances` — monthly opening/closing snapshot per account
- `exchange_rates` — per-month USD/ILS/EUR rates

**Activities & profiles:**
- `profiles` (uuid) ← auth.users; system_role enum (admin/manager/finance/vendor); vendor_id FK
- `activities` (uuid) — entity_type/entity_id polymorphic; type=note/reminder/system_log/integration_event; due_at + status for reminders

### Key enums
- billing_status: pending / invoiced / partial / paid / overdue (DB) — `link_sent` missing in DB but referenced in some UI
- sales_status: lead / qualified / active / delivered / closed
- vendor_type: coach / contractor / team_member / subscription / software_saas / merchant
- session_status: planned / done / cancelled / no_show
- package_status: active / completed / cancelled
- payment_cadence (text check): recurring / project_based / one_time

---

## Payments space status

**Architecture:** Single 4,511-line monolith (`payments.js`) backed by 882-line `payments.html` shell. Seven tabs all live in this one file:

| Tab | DOM id | Loader | Status |
|-----|--------|--------|--------|
| Transactions | `#tab-transactions` | `loadTransactions()` | ✅ Done |
| Expected Income | `#tab-expected-income` | `loadExpectedIncome()` | ✅ Done — but `eiMatchTx()` reconcile button is stub |
| Vendor Bills | `#tab-vendor-bills` | (inline render) | ✅ Done — `?filter=` URL param parsed but not applied |
| History | `#tab-history` | (inline render) | ✅ Done |
| Registry | `#tab-registry` | `registry.js` controller | ✅ Done |
| Balances | `#tab-balances` | `loadBalances()` | ✅ Done — delta reconciliation working |
| Vendor Manager | `#tab-vendors` | `loadVendorManager()` | ✅ Done — defaults + merchant assign |

**Specific gaps in payments space:**
1. **Reconcile UI** — no flow to match a transaction to a deal/bill. `eiMatchTx()` referenced but unimplemented. transactions.linked_entity_id never gets populated.
2. **Provider-specific CSV imports** — generic Canvas exists, no per-provider presets (Wise, Mizrahi, PayPal, Brex, Santander, Green Invoice).
3. **Bills status filter** — flat status-filtered view does not exist; filter param parsed and stashed only.
4. **No P&L dashboard per company** — current dashboard is sales-focused.
5. **No overdue invoices page** — overdue billing_status is filterable in Expected Income, but no dedicated workflow page.
6. **No standalone bills approval page** — vendor bills are in a tab inside payments, not a focused workflow page.
7. **`payments-state.js` ↔ `payments.js`** — `DEFAULT_CATEGORIES` + `TAX_TREATMENTS` were duplicated; duplicate removed in commit f595ceb (payments-state.js is now sole source).

---

## Six workflow pages needed

Based on the scan, all six pages are **not standalone files**. The functionality is partially built into the `payments.html` tab shell. Standalone-page status:

| # | Page | Standalone file | Status | Notes |
|---|------|-----------------|--------|-------|
| 1 | reconcile.html | ❌ does not exist | **MISSING** | No UI exists; `eiMatchTx()` is a stub. Reconcile is the highest unmet need in ROADMAP Phase 1. |
| 2 | overdue.html | ❌ does not exist | **MISSING** | Filtered view exists (Expected Income with `billing_status=overdue`), but no dedicated page with action workflow. |
| 3 | bills.html | ❌ does not exist | **PARTIAL** (as tab) | Per-vendor bill list inside `payments.html#tab-vendor-bills`. Approval lifecycle works (`approveBillV2`, `rejectBillV2`, `markBillPaidV2`). No flat status-filtered standalone page. |
| 4 | balances.html | ❌ does not exist | **PARTIAL** (as tab) | `payments.html#tab-balances` — fully working: opening, closing, transactions net, expected closing, delta with red/amber/green dots. Modal CRUD works. Could be promoted to standalone page largely as-is. |
| 5 | dashboard.html | ❌ does not exist | **MISSING** | Operations dashboard exists (`deals.html`, sales-focused). No P&L / financial dashboard per company. |
| 6 | import.html | ✅ EXISTS | **PARTIAL** | Generic CSV Canvas (`import.html` + `import.js` + `lib/*` + `adapters/supabase-adapter.js`). 4-step wizard: paste → map → preview → import. Schema-driven (no hardcoded columns). Missing: per-provider presets and the per-account routing the spec implies. |

**Estimated scope per missing page:**

| Page | Scope estimate | Reasoning |
|------|----------------|-----------|
| reconcile.html | **Large (300+)** | Match algorithm, candidate UI, side-by-side amounts, write-back to `transactions.linked_entity_*` and bump status to matched/reconciled. Touches transactions + deals + bills. |
| overdue.html | **Small–Medium (100–250)** | Most logic already exists in EI tab — extract + add per-row action buttons (Resend link, Mark paid, Open client, Add note). |
| bills.html (flat) | **Medium (150–300)** | New shell + status filter + reuse approval modals already in payments.js + vendor-profile.js. |
| balances.html | **Small (~100)** | Lift the existing tab as-is into a standalone page. Mostly HTML-shell + script-tag work. |
| dashboard.html (P&L) | **Large (300–500)** | Per-company aggregate of transactions in/out, by category, by month; expense vs income summary; vendor payouts; gross/net revenue. New aggregator queries needed. |
| import.html (per-provider) | **Medium (150–300)** | Add provider preset dropdown + saved column mapping + provider-specific cleanup (e.g., Wise multi-currency, Mizrahi date format). |

---

## db.js functions inventory

### Vendors
- `getVendors()` — active, hydrated with rates + clients
- `getVendorsInactive()` — inactive
- `getLatestBillForVendor(vendorId)`
- `getVendor(id)` / `getVendorById(id)` — single, hydrated
- `_mapVendor(v)` — internal aliasing helper
- `createVendor(fields)` / `updateVendor(id, fields)` / `deleteVendor(id)`
- `getVendorsForPayments(role)` — gated by team_member visibility
- `getVendorBills(vendorId)` / `getBillWithSessions(billId)`

### Rates / task types
- `getRates(vendorId)` / `getDefaultRate(vendorId)` / `upsertRate(vendorId, data)` / `deleteRate(id)`
- `getVendorRatesAsTaskTypes(vendorId)` — V2 billing rate lookup

### Vendor ↔ Client
- `assignClientToVendor(vendorId, clientId)` / `unassignClientFromVendor(vendorId, clientId)`
- `getVendorClientsForClient(clientId)`
- `getVendorClientsWithPackages(vendorId)`
- `getVendorClientAssignments(filters)` / `createVendorClientAssignment(fields)` / `closeVendorClientAssignment(id, opts)`

### Clients
- `getClients()` / `getClient(id)` / `createClient(fields)` / `updateClient(id, fields)` / `deleteClient(id)`

### Customers (external buyer layer)
- `searchCustomers(emailQuery)` / `getCustomerByEmail(email)` / `createCustomer(data)` / `updateCustomer(id, fields)` / `getClientByCustomerId(customerId)`

### Products / Plans
- `getProducts()` / `getProductsWithPlans()` / `getAllProductsWithPlans()` (flat)
- `getProduct(id)` / `getPlan(id)`
- `createProductFull(fields)` / `updateProductFull(id, fields)` / `deleteProductFull(id)` (cascades plans)
- `createPlanFull(fields)` / `updatePlanFull(id, fields)` / `deletePlanFull(id)`
- `getDealsForPlan(planId)` — used to gate plan archive
- Legacy: `createProduct`, `updateProduct`, `deleteProduct`, `updatePlan`, `insertPlan`
- Legacy product_plans: `getProductPlans`, `getAllProductPlans`, `getPlanById`, `createProductPlan`, `updateProductPlan`, `deleteProductPlan`
- `createDealWithPlan({ planId, clientId, overrides })` — webhook entry point

### Deals
- `getDeals(filters)` / `getDeal(id)` (cached, explicit-column select)
- `createDeal(fields)` / `updateDeal(id, fields)` / `deleteDeal(id)`
- `addDealReminder(dealId, text, dueDate)` / `toggleDealReminder(id, done)`
- `_hydrateDealsRelations(deals)` — internal join enrichment

### Sessions (V2 task-based)
- `getSessions(filters)` / `createSession(fields)` / `updateSession(id, fields)`
- `logSessionV2({ vendorId, clientId, ... })` — task-based logger
- `updateSessionV2(sessionId, fields)` / `deleteSessionV2(sessionId)`
- `getVendorSessionsV2(vendorId)` / `getUnpaidSessionsV2(vendorId)`
- `_hydrateSessionRates(sessions)` / `_toUUID(val)`

### Packages
- `getPackages(filters)` / `getPackage(id)` / `getPackagesForDeal(dealId)`
- `createPackage(fields)` / `updatePackage(id, fields)` (auto status from sessions_used vs total)
- `adjustPackageSessions(packageId, delta)`
- `_mapPackage(p, liveSessionCount)` — derived fields

### Bills (V2)
- `getAllBills(filters)` / `getVendorBillsForManager()` / `getVendorDetailForManager(vendorId)`
- `getDraftBillV2(vendorId)` / `getRejectedBillV2(vendorId)` / `getPaidBillsV2(vendorId)` / `getPaidBillsAllVendors()`
- `createDraftBillV2({ vendorId, sessionIds, totalAmount })`
- `submitDraftBillV2(billId)` / `withdrawBillV2(billId)`
- `approveBillV2(billId, selectedSessionIds)` / `rejectBillV2(billId, notes)` / `markBillPaidV2(billId)`
- `_mapBillV2(bill)`

### Paychecks
- `getPaychecks(filters)` / `upsertPaycheck(fields)` / `updatePaycheck(id, fields)`

### Documents
- `uploadDocumentFile(file, entityType, entityId)` / `uploadVendorAvatar(vendorId, file)` / `deleteDocumentFile(path)`
- `getDocuments(entityType, entityId)` / `createDocument(fields)` / `updateDocument(id, fields)` / `deleteDocument(id)`

### Companies / Accounts (text PK)
- `getCompanies()` / `updateCompanyField(id, field, value)` / `createCompany(fields)` / `deleteCompany(id)`
- `getAccounts()` / `updateAccountField(id, field, value)` / `createAccount(fields)` / `deleteAccount(id)`

### Transactions
- `getTransactions({ includeDeleted })` — joined to accounts, soft-delete filtered
- `createTransaction(fields)` / `updateTransaction(id, fields)`

### Exchange rates
- `getExchangeRates()` / `updateExchangeRateField(id, field, value)` / `createExchangeRate(fields)` / `deleteExchangeRate(id)`

### Balances
- `getAccountBalances(accountId, year)` / `upsertAccountBalance(fields)` / `deleteAccountBalance(id)`
- `getTransactionSumByAccountMonth(accountId, month)` → `{ total_in, total_out, net }`

### Settings + lookups
- `getSystemSettings()` / `updateSystemSetting(key, value)`
- `getTransactionCategories()` / `updateTransactionCategoryField(id, field, value)` / `createTransactionCategory(fields)` / `deleteTransactionCategory(id)`
- `getTransactionTags()` / `updateTransactionTagField(id, field, value)` / `createTransactionTag(fields)` / `deleteTransactionTag(id)` / `_replaceTagInAllTables(oldTag, newTag)`

### Activities & profiles
- `logActivity({ entity_type, entity_id, type, ... })`
- `getActivities({ type, status, search })` / `getClientReminders(clientId)` / `getNotifications()` / `updateActivity(id, fields)`
- `getProfile(userId)` / `upsertProfile(fields)` / `getRoleFromDB()` (Phase 2 stub)

### Dashboard
- `getNeedsAttentionItems({ limit })` — overdue bills + ready bills + stale deals + expiring packages
- `_formatBillAmount(amount, currency)`

---

## Rules summary (from RULES.md)

The 10 most important conventions to follow when working in this codebase:

1. **No frameworks, no build step.** Plain HTML + Vanilla JS only. Files are served directly.
2. **One CSS file: `shared.css`.** No per-page CSS, no inline `<style>`. Use CSS variables (`--ink`, `--mu`, `--green-bg`, etc.) — never hardcode hex.
3. **All Supabase queries go through `db.js`.** Never call `_sb.from(...)` directly from a page module. Use `_sb` only inside db.js.
4. **Cache + invalidate.** Hot reads use `Cache.readThrough(key, fetcher)` from `cache.js`. Every write on deals/clients/vendors must invalidate both detail and list keys.
5. **Two PK generations exist.** Old uuid tables and new text tables. Do NOT add cross-PK FK constraints without explicit type cast. Use `gen_random_uuid()::text` for new text-PK ids.
6. **Schema discipline.** After every schema change run `NOTIFY pgrst, 'reload schema';`. Use `if not exists` / `on conflict do nothing` / `drop constraint if exists`. Verify columns exist via information_schema before assuming.
7. **One page = one .html + one .js** (kebab-case names). Script load order: supabase → env-keys → env-config → db → cache → app → router → [page].js → registry (if used). No script blocks in HTML body except src= tags at bottom.
8. **No `position: fixed`** anywhere. No `alert()` / `confirm()` for destructive actions — use modal overlays. Toasts via `showToast(msg, type)`.
9. **Always read the four reference files first** (STATUS.md, SCHEMA.md, CHANGELOG.md, RULES.md) and update STATUS + SCHEMA + CHANGELOG when done.
10. **Use Promise.all** for independent fetches on panel/page open. Use **explicit `select()` columns** for hot reads (`getDeal` is the canonical example, with a comment naming consumers). Skeleton-paint before await.
