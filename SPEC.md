# HSos Deals & Payments — System Specification

> Generated: 2026-04-23. Describes the system as it exists — not as it should be.
> Authoritative DB schema lives in SCHEMA.md. This document maps entities ↔ UI ↔ files.

---

## Table of Contents

1. [Entities & Fields](#entities--fields)
2. [Spaces & Pages](#spaces--pages)
3. [File Responsibility Map](#file-responsibility-map)
4. [Naming Conventions](#naming-conventions)
5. [Violations & Inconsistencies](#violations--inconsistencies)

---

## Entities & Fields

All entities use **snake_case** column names. PKs are either UUID (old tables) or `text` (new tables, generated via `gen_random_uuid()::text`).

### Table Generation Reference

| Generation | PK Type | Tables |
|-----------|---------|--------|
| Old | `uuid` | clients, deals, vendors, sessions, bills, packages, rates, product_plans, customers, task_types, deal_reminders, deal_documents, vendor_client_assignments, paychecks, exchange_rates, documents |
| New | `text` | companies, accounts, transaction_categories, transaction_tags, transactions, products, plans, programs, import_logs, account_balances, system_settings, audit_log, activities |

---

### `vendors`

Core entity for coaches, contractors, team members, and merchants.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | Used as FK elsewhere but `vendor_clients.vendor_id` is uuid — type mismatch, cast required |
| `name` | text | Short display name |
| `full_name` | text | |
| `vendor_type` | enum | `coach \| contractor \| team_member \| merchant` |
| `active` | boolean | Legacy status field |
| `is_active` | boolean | Newer status field — both checked in db.js |
| `email` | text | |
| `phone` | text | |
| `currency` | text | Working currency (EUR, USD, etc.) |
| `payout_currency` | text | Currency used for payouts |
| `paying_company` | text | Paying company name (FK to companies?) |
| `paying_company_id` | uuid | FK to companies (not always shown in UI) |
| `category_id` | text | FK to transaction_categories |
| `tax_treatment` | text | Default tax treatment for transactions |
| `entity` | text | `business \| private` |
| `tags` | text[] | Tag array |
| `match_patterns` | text[] | Auto-match patterns for transaction classification |
| `preferred_currency` | text | Preferred display currency |
| `nickname` | text | Not shown in UI |
| `contract_url` | text | Not shown in UI (HIGH PRIORITY: see MISSING-UI-ELEMENTS.md) |
| `service_types` | text[] | Not shown in UI |
| `payment_id` | text | Payment account ID |
| `iban` | text | Bank IBAN |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Profile picture:** Stored via Supabase Storage; URL exposed as `profile_picture_url` (virtual/computed, not a direct column).

---

### `clients`

People or organizations being coached/served.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `full_name` | text | Display name |
| `email` | text | |
| `phone` | text | |
| `kind` | text | `private \| corporate` |
| `company_name` | text | Shown when kind=corporate |
| `source` | text | Acquisition source |
| `notes` | text | |
| `active` | boolean | Activity status |
| `country` | text | |
| `customer_id` | text | External ID (e.g. ThriveCart) |
| `created_at` | timestamptz | |

---

### `deals`

A deal links a client to a product + plan, tracks billing and sales progress.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `client_id` | uuid | FK → clients |
| `product_id` | text | FK → products |
| `product_plan_id` | uuid | FK → product_plans |
| `primary_vendor_id` | text | FK → vendors |
| `owner_vendor_id` | text | FK → vendors — "deal owner" second vendor, no UI |
| `price` | numeric | |
| `currency` | text | |
| `payment_link` | text | Generic payment link |
| `stripe_payment_link` | text | Specific Stripe link — no UI (HIGH PRIORITY) |
| `payment_status` | text | `pending \| link_sent \| invoiced \| partial \| paid \| overdue` |
| `sales_status` | text | `lead \| qualified \| active \| delivered \| closed` |
| `billing_status` | text | See payment_status alias/overlap |
| `origin` | text | `manual \| thrivecart \| stripe \| other` |
| `discount` | numeric | Discount amount — no UI |
| `gi_client_id` | text | Green Invoice client ID — no UI |
| `gi_invoice_series` | text | Green Invoice series — no UI |
| `stripe_customer_id` | text | Stripe customer ID — no UI |
| `wise_iban` | text | Wise IBAN — no UI |
| `wise_bank_ref` | text | Wise bank reference — no UI |
| `thrive_ref` | text | ThriveCart reference — no UI |
| `vat` | numeric | VAT amount |
| `vat_mode` | text | `excl \| incl` |
| `notes` | text | Rich text (Quill HTML) |
| `payment_processor` | text | Shown as free-text input, should be enum select |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Not shown in UI |

---

### `products`

Coaching programs or services offered.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | |
| `name` | text | |
| `category` | text | Business/Mindset/Health/etc. |
| `status` | text | `active \| draft \| archived` |
| `type` | text | `PROGRAM \| PACKAGE` |
| `sessions_included` | integer | Non-null when type=PACKAGE |
| `description` | text | |
| `currency` | text | Base currency |
| `price_min` | numeric | |
| `price_max` | numeric | |
| `units` | text | Price unit suffix — not shown in UI |
| `payment_links` | jsonb | Clickable links — shown as raw JSON textarea instead of clickable list |
| `active` | boolean | Not surfaced in UI filter |
| `program_id` | text | FK → programs |
| `created_at` | timestamptz | |

---

### `plans`

Pricing variants of a product.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | |
| `product_id` | text | FK → products |
| `name` | text | |
| `status` | text | `active \| draft \| archived` |
| `payment_type` | text | `one_payment \| installments \| subscription` — also seen as `plan_type` in older code |
| `amount` | numeric | |
| `currency` | text | |
| `installments_count` | integer | Used when payment_type=installments — also seen as `installments` in older code |
| `description` | text | |
| `payment_link_url` | text | Payment link URL — also seen as `link_url` in older code |
| `payment_link_source` | text | `thrivecart \| green_invoice \| wise \| bank_transfer \| manual` |
| `payment_link_id` | text | External ID on the payment processor |
| `created_at` | timestamptz | |

---

### `programs`

Grouping containers for products.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | |
| `name` | text | |
| `order` | integer | Display order |
| `created_at` | timestamptz | |

---

### `sessions`

Individual coaching/work sessions logged by vendors.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `vendor_id` | text | FK → vendors |
| `client_id` | uuid | FK → clients |
| `session_date` | date | |
| `start_time` | time | Not shown in workload UI |
| `hours` | numeric | |
| `duration_min` | integer | |
| `task_type_id` | uuid | FK → task_types |
| `rate_usd` | numeric | Rate at time of session |
| `notes` | text | |
| `status` | text | `planned \| done \| cancelled \| no_show` |
| `billed` | boolean | Whether included in a bill |
| `bill_id` | uuid | FK → bills (if billed) |
| `deal_id` | uuid | FK → deals |
| `package_id` | uuid | FK → packages |

---

### `bills`

Vendor payment requests. One active bill (draft or submitted) per vendor at a time.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `vendor_id` | text | FK → vendors |
| `status` | text | `draft \| submitted \| approved \| paid \| returned` |
| `total_amount` | numeric | |
| `currency` | text | |
| `vendor_notes` | text | Not shown in UI |
| `finance_notes` | text | Not shown in UI |
| `payment_method` | text | Not shown in UI |
| `payment_reference` | text | Not shown in UI |
| `paid_from_account_id` | text | FK → accounts — not shown in UI |
| `created_at` | timestamptz | |
| `submitted_at` | timestamptz | |
| `approved_at` | timestamptz | |
| `paid_at` | timestamptz | |
| `returned_at` | timestamptz | |

---

### `packages`

Session bundles linked to a deal. Track session progress against an included count.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `deal_id` | uuid | FK → deals |
| `client_id` | uuid | FK → clients |
| `vendor_id` | text | FK → vendors |
| `sessions_total` | integer | |
| `sessions_used` | integer | |
| `sessions_remaining` | integer | Computed |
| `status` | text | `active \| completed \| expired` |
| `expiry_date` | date | |
| `updated_at` | timestamptz | Not shown in UI |

---

### `rates`

Vendor-specific task type rates.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `vendor_id` | text | FK → vendors |
| `task_type_id` | uuid | FK → task_types |
| `rate` | numeric | |
| `currency` | text | |
| `effective_date` | date | |

No rate management UI for admins in the operations space. Rates only visible in vendor-profile.js.

---

### `task_types`

Lookup table for session task types (e.g., "1:1 Coaching", "Group Session").

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `name` | text | |
| `default_rate` | numeric | |
| `currency` | text | |

14 rows. No management UI — must be edited directly in DB.

---

### `transactions`

Financial transactions (bank imports + manual entries).

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | |
| `source` | text | Import source (wise, brex, etc.) |
| `direction` | text | `in \| out` |
| `amount` | numeric | |
| `currency` | text | |
| `counterparty_name` | text | |
| `transaction_date` | date | |
| `account_id` | text | FK → accounts |
| `vendor_id` | text | FK → vendors |
| `category_id` | text | FK → transaction_categories |
| `tax_treatment` | text | Enum (13 values) |
| `entity` | text | `business \| private` |
| `tags` | text[] | |
| `payment_cadence` | text | `recurring \| project_based \| one_time` (pending migration 010) |
| `deleted_at` | timestamptz | Soft delete |
| `duplicate_of` | text | FK → transactions (self-ref) |
| `raw_data` | jsonb | Original import data |
| `status` | text | `unmatched \| matched \| reconciled \| deleted` |
| `event_type` | text | |
| `reference` | text | |
| `external_id` | text | |
| `exchange_rate` | numeric | |
| `amount_ils` | numeric | Amount in ILS |
| `settled_date` | date | |
| `linked_entity_type` | text | `deal \| bill \| paycheck` |
| `linked_entity_id` | text | FK to linked entity |

---

### `accounts`

Bank/payment accounts.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | |
| `name` | text | |
| `type` | text | |
| `currency` | text | |
| `institution` | text | |
| `active` | boolean | |

---

### `companies`

Business entities (e.g., the paying company for vendors).

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | |
| `name` | text | |
| `country` | text | |
| `vat_number` | text | |
| `active` | boolean | |

---

### `paychecks`

Payroll records for vendors.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `vendor_id` | text | FK → vendors |
| `amount` | numeric | |
| `currency` | text | |
| `base_amount_usd` | numeric | Not shown in UI |
| `payout_amount` | numeric | Not shown in UI |
| `payout_currency` | text | Not shown in UI |
| `exchange_rate_id` | uuid | Not shown in UI |
| `company_id` | text | FK → companies |
| `actual_amount_paid` | numeric | Critical for reconciliation — not shown in UI |
| `payment_date` | date | Not shown in UI |
| `notes` | text | Not shown in UI |
| `status` | text | |
| `bill_id` | uuid | FK → bills |

---

### `activities`

Unified activity/event log. Covers notes, reminders, system events, integration events.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `entity_type` | text | `client \| deal \| vendor \| session \| paycheck \| invoice \| global` |
| `entity_id` | uuid | FK to entity; null only for global type |
| `type` | text | `note \| reminder \| system_log \| integration_event` |
| `subtype` | text | `status_change \| stage_move \| payment_sent \| slack_sent \| ac_tag_added` |
| `body` | text | Plain Markdown (bold, italic, links only) |
| `created_by` | uuid | FK → profiles |
| `origin` | text | `user \| system \| integration` |
| `due_at` | timestamptz | Reminders only |
| `status` | text | `pending \| done \| dismissed` (reminders only) |
| `meta` | jsonb | Custom metadata |
| `created_at` | timestamptz | |

---

### `profiles`

User identity and role. Linked to Supabase Auth (Phase 2 OAuth).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Will match auth.users.id post-OAuth |
| `role` | enum | `admin \| manager \| finance \| vendor` |
| `vendor_id` | text | FK → vendors (vendor-role only) |
| `full_name` | text | |
| `email` | text | |
| `slack_user_id` | text | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

### `deal_reminders`

Reminders attached to deals.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `deal_id` | uuid | FK → deals |
| `body` | text | |
| `due_date` | date | |
| `done` | boolean | |
| `created_at` | timestamptz | |

Queried in `db.js` via `_hydrateDealsRelations()` but **never rendered** in any UI.

---

### `deal_documents`

Documents attached to deals.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `deal_id` | uuid | FK → deals |
| `name` | text | |
| `url` | text | |
| `created_at` | timestamptz | |

---

### `vendor_clients` / `vendor_client_assignments`

Many-to-many join: which vendors serve which clients.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `vendor_id` | uuid | Note: this is uuid, but vendors.id is text — type mismatch |
| `client_id` | uuid | FK → clients |
| `assigned_at` | timestamptz | |

---

### `transaction_categories`

User-configurable expense/income categories.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | |
| `name` | text | |
| `type` | text | `income \| expense` |
| `tax_treatment` | text | Default tax treatment |
| `active` | boolean | |

27 default categories. Managed in Registry tab.

---

### `transaction_tags`

User-configurable transaction tags.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | |
| `name` | text | |
| `color` | text | |
| `active` | boolean | |

35 default tags. Managed in Registry tab. Tags can be renamed via `rename_tag` RPC.

---

### `exchange_rates`

Currency exchange rates.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `from_currency` | text | |
| `to_currency` | text | |
| `rate` | numeric | |
| `effective_date` | date | |

---

### `account_balances`

Monthly account balance snapshots.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | |
| `account_id` | text | FK → accounts |
| `month` | text | `YYYY-MM` |
| `opening_balance` | numeric | |
| `closing_balance` | numeric | |
| `currency` | text | |
| `notes` | text | |

---

### `system_settings`

Key-value system configuration.

| Column | Type | Notes |
|--------|------|-------|
| `key` | text (PK) | |
| `value` | text | |
| `updated_at` | timestamptz | |

---

### `import_logs`

Records of transaction import batches.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | |
| `source` | text | |
| `account_id` | text | FK → accounts |
| `file_name` | text | |
| `row_count` | integer | |
| `imported_at` | timestamptz | |

---

### `audit_log`

System-generated audit trail for entity changes.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | |
| `entity_type` | text | |
| `entity_id` | text | |
| `action` | text | |
| `changes` | jsonb | Before/after snapshot |
| `performed_by` | text | |
| `created_at` | timestamptz | |

---

## Spaces & Pages

The application has three main spaces, each accessed via the sidebar.

---

### Operations Space (`deals.html`)

Entry point: `deals-init.js`. Loaded scripts in order:
`supabase.js → env-keys.js → env-config.js → db.js → app.js → router.js → components/layout.js → panel-manager.js → deals-state.js → deals-dashboard.js → deals-kanban.js → deals-modal.js → deals-clients.js → deals-vendors.js → deals-products.js → deals-init.js → deals.js`

**Pages (sidebar navigation):**

| Page | DOM Element | Module | Description |
|------|-------------|--------|-------------|
| Dashboard | `#page-dashboard` | `deals-dashboard.js` | KPI metrics, mini kanban, coaches list, active clients |
| Deals | `#page-deals-kanban` / `#page-deals-list` | `deals-kanban.js` | Deals filtered view in kanban or list layout |
| Clients | `#page-clients` | `deals-clients.js` | Searchable client list + detail panel |
| Vendors | `#page-vendors` | `deals-vendors.js` | Vendor list + detail panel (profile / payments / clients tabs) |
| Products | `#page-products` | `deals-products.js` | Products + plans admin with inline editing |

**Modals (in `deals.html`):**

| Modal | ID | Trigger | Steps |
|-------|----|---------|-|
| New Deal | `#modal-new-deal` | "New Deal" button | 3-step wizard: customer, plan, deal details |
| Product Edit | `#modal-product` | Product row actions | Edit product fields + links |
| Add Client | slide-in panel | "Add Client" button | Form: name, email, phone, kind, company, source |
| Add Vendor | slide-in panel | "Add Vendor" button | Form: name, type, email, currency, payout, etc. |
| AC Import | slide-in panel | "Import from AC" | 2-step: paste JSON/CSV → review + import |

---

### Workload Space (`workload.html`)

Entry point: `workload.js`. Loaded scripts:
`supabase.js → env-keys.js → env-config.js → db.js → app.js → router.js → components/layout.js → panel-manager.js → workload.js`

**Tabs:**

| Tab | ID | Module | Description |
|-----|----|--------|-------------|
| Log Session | `#tab-log` | `workload.js` | Client picker + session form + recent sessions table |
| Sessions | `#tab-work` | `workload.js` | Month summary, task breakdown, unpaid sessions, bill management |
| My Clients | `#tab-clients` | `workload.js` | Vendor's assigned clients with package progress |
| Profile | `#tab-profile` | `workload.js` / iframe | Loads `vendor-profile.html` in iframe |

**Sessions sub-tabs:** Unpaid | History

**Modal:**
- `#edit-session-modal` — Edit/delete session (date, duration, task type, client, notes)

---

### Payments Space (`payments.html`)

Entry point: `payments.js` (monolithic). Loaded scripts:
`supabase.js → env-keys.js → env-config.js → db.js → app.js → router.js → components/layout.js → components/badges.js → panel-manager.js → payments-state.js → payments.js → registry.js`

> Note: The HTML references split files (`payments-tabs.js`, `payments-transactions.js`, etc.) but as of audit date the actual logic is in the monolithic `payments.js`. The split files listed in `payments.html` may be a planned refactor not yet completed, or the HTML references may not match the current file structure.

**Tabs:**

| Tab | ID | Description |
|-----|----|-------------|
| Transactions | `#tab-transactions` | Paginated transaction table with bulk classification |
| Expected Income | `#tab-expected-income` | Pipeline: pending deals, packages, billing status |
| Vendor Bills | `#tab-vendor-bills` | Bills by vendor: needs review, unpaid work, ready to pay |
| History | `#tab-history` | All payment history |
| Registry | `#tab-registry` | Master data admin (companies, accounts, categories, tags, etc.) |
| Balances | `#tab-balances` | Account balance snapshots |
| Vendor Manager | `#tab-vendors` | Vendor matching: defaults, unmatched merchants, rules |

**Transaction filter dimensions:**
- Type: All / Income / Expenses / Transfers / Needs Review / [per-account chips] / Duplicates
- Account dropdown
- Month picker
- Category dropdown
- Entity (Business / Private)
- Needs Review toggle
- Show Deleted toggle
- Text search

**Bulk operations:** Select transactions → set category, tax treatment, entity (B/P), tags → Apply

**Modals:**
- Reject Bill — reason textarea
- Balance Snapshot — account, month, opening/closing balance, currency, notes
- Vendor Quick Panel — dynamic vendor info card

---

### Standalone Profile Pages

These pages are accessed via deep links from other spaces (or via iframe from workload).

| Page | URL | Access |
|------|-----|--------|
| Vendor Profile | `vendor-profile.html?id=<id>` | Admin/Finance/Manager: full edit. Vendor: read-only |
| Client Profile | `client-profile.html?id=<id>` | All roles (vendor view hides financials) |
| Activity Log | `activity-log.html` | All roles — read-only viewer |
| Products Showcase | `products.html` | Operations / Workload access |

---

### Other Pages

| Page | File | Role |
|------|------|------|
| Home / App shell | `index.html` | Entry point + nav |
| Login | `login.html` | Auth |
| Environment Toggle | `env-toggle.html` | Demo / Production switch |
| Import | `import.html` + `import.js` | Transaction batch import |
| Income (legacy?) | `income.html` | Unknown — may be superseded by payments |
| Recurring (legacy?) | `recurring.html` | Unknown — may be superseded by payments |
| Contractors | `contractors.html` | Unknown — may be subset of vendors view |
| Clients Portal | `clients-portal.html` | Client-facing portal (separate concern) |

---

## File Responsibility Map

```
HSos-deals_and_payments/
│
├── LAYER: Infrastructure
│   ├── env-config.js       → Supabase client init; exposes window._sb
│   ├── env-keys.js         → Key selection (demo vs production)
│   ├── env-toggle.html     → UI for env switching
│   ├── router.js           → URL-state router; entity deep-link navigation
│   └── app.js              → Role management, toast, confirm, avatar, escape utils
│
├── LAYER: Data
│   └── db.js               → ALL Supabase queries; single source of truth for DB access
│
├── LAYER: Components
│   ├── components/layout.js        → Topbar/sidebar setup, LAYOUT + BELL objects
│   ├── components/badges.js        → Badge HTML builder library (Badges.*)
│   ├── components/table-framework.js → Reusable table filter/pagination/export
│   └── shared.css                  → ALL CSS; global design system
│
├── LAYER: Cross-page UI
│   └── panel-manager.js    → Unified entity detail side-panel (PanelManager.open)
│
├── SPACE: Operations (deals.html)
│   ├── deals.html          → HTML shell; modal skeletons; script loading order
│   ├── deals-state.js      → Shared state variables + constants for this space
│   ├── deals-init.js       → DOMContentLoaded, data load, page switching, Router setup
│   ├── deals-dashboard.js  → Dashboard page rendering
│   ├── deals-kanban.js     → Deals filter logic + kanban/list view rendering
│   ├── deals-modal.js      → New deal 3-step modal
│   ├── deals-products.js   → Products admin page (inline CRUD)
│   ├── deals-clients.js    → Clients page (list + import + detail)
│   ├── deals-vendors.js    → Vendors page (list + detail panel + profile edit)
│   └── deals.js            → Quill editor wrapper for new deal modal
│
├── SPACE: Workload (workload.html)
│   ├── workload.html       → HTML shell; tabs; modal
│   └── workload.js         → All workload logic: sessions, bills, clients, profile tab
│
├── SPACE: Payments (payments.html)
│   ├── payments.html       → HTML shell; 7 tabs; modals
│   ├── payments-state.js   → Classification constants (categories, tax treatments, tags)
│   ├── payments.js         → All payments logic (monolithic 4526 lines)
│   └── registry.js         → Registry tab: master data admin CRUD
│
├── STANDALONE PAGES
│   ├── vendor-profile.html / vendor-profile.js → Vendor profile + bill management
│   ├── client-profile.html / client-profile.js → Client profile + reminders + tags
│   ├── activity-log.html / activity-log.js     → Activity log viewer
│   └── products.html / products.js             → Products showcase (read-only card view)
│
├── UTILITIES
│   ├── profile.js          → Inline name editing utility (shared by profile pages)
│   └── import.html / import.js / import.css → Transaction batch import tool
│
└── DOCUMENTATION
    ├── SCHEMA.md           → Authoritative DB schema + migration status
    ├── RULES.md            → Coding rules + naming conventions + stack constraints
    ├── CHANGELOG.md        → Change history
    ├── STATUS.md           → Current development status
    ├── ROADMAP.md          → Feature roadmap
    └── docs/
        ├── SCHEMA-AUDIT.md         → DB columns vs. UI field coverage matrix
        ├── MISSING-UI-ELEMENTS.md  → Missing fields ranked by priority
        ├── PAYMENT-ROUTING.md      → Payment flow documentation
        └── MISSING-UI-ELEMENTS.md  → Field gap analysis
```

---

## Naming Conventions

### Currently Defined (per RULES.md)

| Thing | Convention | Compliance |
|-------|-----------|------------|
| DB columns | snake_case | ✅ Consistent |
| CSS classes | kebab-case | ✅ Mostly consistent |
| JS function names | camelCase | ✅ Mostly consistent |
| JS constants | UPPER_SNAKE_CASE | ✅ Consistent |
| File names | kebab-case | ✅ Consistent |
| HTML element IDs | kebab-case | ✅ Consistent |
| Module-private vars | `_camelCase` (underscore prefix) | ⚠️ Inconsistent — some modules omit the prefix |

### Observed Patterns

**Global function exposure:**
- `deals-vendors.js` exposes 22 functions on `window.*` for use from HTML `onclick=` attributes
- Other modules expose few or none — no consistent pattern for which functions become global
- `deals-clients.js` exposes: `renderClients`, `showClientDetail`, `openAddClientPanel`, `closeAddClientPanel`, `submitAddClient`, `openAcImportPanel`, `acParseAndReview`, `acImportSelected`, `deleteClientFromList`, `setClientsSearch`
- `deals-modal.js` exposes: `ndStep1Next`, `ndStep2Next`, `ndSubmit`, `ndCsToggle`, `ndCsSearch`, `ndCsSelect`, `ndCsKeydown`, `ndQcOpen`, `ndQcSubmit`, `calcNdVat`, `openNdCustomerEmailInput`, `onNdCustomerEmailInput`

**Prefix conventions for functions:**
- `render*` — Pure rendering functions that return HTML or write to DOM (e.g., `renderDeals`, `renderDashboard`)
- `open*` — Functions that open a panel, modal, or detail view (e.g., `openVendorDetail`, `openAddClientPanel`)
- `init*` — Page/component initialization (e.g., `initProducts`, `initVendorProfile`)
- `switch*` — Tab or view switching (e.g., `switchPage`, `switchTab`, `switchVendorTab`)
- `_render*` / `_load*` — Private helpers (underscore prefix, not always consistent)
- `nd*` — New Deal modal functions (e.g., `ndSubmit`, `ndSelectPlan`, `ndCsToggle`)
- `ac*` — ActiveCampaign import functions (e.g., `acParseAndReview`, `acImportSelected`)
- `vc*` — Vendor-Client assignment functions (e.g., `vcCsToggle`, `vcCsFilter`)

**Event binding patterns (mixed):**
- HTML `onclick="fn()"` attributes — used throughout deals.html, workload.html for dynamic content
- `element.addEventListener(...)` — used in registry.js, badges.js, and static page-level setup
- Both patterns used in the same page — no consistent approach

---

## Violations & Inconsistencies

### RULES.md Violations

| Rule | Violation | Location |
|------|-----------|----------|
| "One CSS file: shared.css. No per-page CSS. No inline `<style>` blocks." | `activity-log.html` contains inline `<style>` block | activity-log.html |
| "No `console.log` statements" | Various files likely retain console.error and console.log calls | Multiple |
| "No native `alert()` or `confirm()`" | Some older paths may still use native confirm — not fully audited | Multiple |
| "ALL Supabase queries through db.js functions" | payments.js appears to have some direct `_sb.from()` calls in older sections | payments.js |
| "Do not hardcode vendor/product IDs or real data in JS" | External platform URLs (AC, ThriveCart, etc.) hardcoded in client-profile.js | client-profile.js |

### Schema Violations

| Field | Issue |
|-------|-------|
| `vendor_clients.vendor_id` | Type is `uuid` but `vendors.id` is `text` — FK constraint would fail without cast |
| `vendors.active` + `vendors.is_active` | Two fields for same concept; db.js checks both |
| Plans: `payment_type` vs `plan_type` | Inconsistent field name used in different code paths |
| Plans: `installments` vs `installments_count` | Two field names for same concept in different code paths |
| Plans: `link_url` vs `payment_link_url` | Two field names for same concept in different code paths |
| `billing_status` vs `payment_status` | Both appear on deals — unclear if they are the same concept or different |

### State Management Violations

| Issue | Impact |
|-------|--------|
| No state reset between page switches | Stale `_deals`, `_clients`, `_vendors` can persist across navigation |
| `_routerDispatching` used as cross-module mutex | Race condition possible; no formal ownership |
| `_ndEmailTimer` not cancelled on modal close | Debounce can fire after modal is dismissed, mutating state unexpectedly |
| Multiple `_dashData` caches with no invalidation | Dashboard can show stale data after deal/client updates |

### UI Consistency Violations

| Issue | Location |
|-------|----------|
| Badge rendering: mix of `Badges.*` calls and inline HTML strings | Multiple modules |
| Currency formatting: `fmt(price, currency)` vs `fmt(n)` — different signatures | deals-state.js vs payments.js / workload.js |
| Date formatting: `formatDate()` vs `formatDateShort()` | app.js vs payments.js / workload.js |
| Dashboard kanban stages: 3 hardcoded vs. 5-stage `STAGES` constant | deals-dashboard.js |
| Vendor type metadata: defined in `deals-vendors.js` AND `badges.js` independently | Both files |
| `GATEWAY_LABELS` / payment source labels defined in both `deals-state.js` and `deals-products.js` | Both files |
| `DEFAULT_CATEGORIES` + `TAX_TREATMENTS` defined in both `payments-state.js` and `payments.js` | Both files |

### Missing Migrations (per SCHEMA.md)

| Migration | Status | Impact |
|-----------|--------|--------|
| 008 | Not run | Unknown — check SCHEMA.md |
| 009 | Not run | Unknown — check SCHEMA.md |
| 010 | Not run | `payment_cadence` enum not yet active in DB; UI code may already use it |
| 015 | Not run | Unknown — check SCHEMA.md |

Code in `payments.js` and `deals-state.js` may reference columns added by these migrations, causing silent query failures on demo/production where migrations haven't been applied.
