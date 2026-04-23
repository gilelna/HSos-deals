# HSos — Clean Rebuild Prompt for Claude Code

> Paste this entire prompt into Claude Code. It has full filesystem access.
> Do NOT start building until you have read all referenced files.

---

## Step 0 — Read first

Before writing a single line of code, read these files in full:
- `SPEC.md` — entities, spaces, UI flows
- `AUDIT.md` — what exists, what's broken, what's duplicated
- `SCHEMA.md` — authoritative DB schema
- `RULES.md` — coding conventions

---

## Goal

Rebuild HSos from scratch using the **same stack** (Vanilla JS + HTML + Supabase) but with a clean, modular architecture. Do NOT copy old code — rewrite everything based on SPEC.md. Preserve all logic, flows, and UX patterns described in the spec.

The old code stays untouched in its current location. Build the new version in a new folder: `v2/`

---

## Architecture

```
v2/
├── core/
│   ├── env.js           → Supabase client init (demo + production keys)
│   ├── db.js            → ALL Supabase queries — single source of truth
│   ├── auth.js          → Role management (Admin / Manager / Vendor)
│   ├── guard.js         → guardSpace(space) + guardAction(action, role)
│   ├── audit.js         → logAudit(entity_type, entity_id, action, changes)
│   ├── router.js        → URL-state router (register, open, back, dispatch)
│   └── utils.js         → esc(), formatDate(), formatCurrency(), initials(), showToast(), showConfirm()
│
├── components/
│   ├── layout.js        → Sidebar + topbar init (LAYOUT object)
│   ├── panel.js         → Unified side panel (PanelManager — open, close, push, pop)
│   ├── modal.js         → Modal factory (open, close, confirm)
│   ├── badges.js        → All badge/pill HTML builders (Badges.*)
│   ├── table.js         → Reusable table: sort, filter, paginate, export CSV
│   └── form.js          → Form field builder + validation helpers
│
├── shared/
│   ├── constants.js     → All shared constants: STAGES, BILLING_STATUS, PAYMENT_TYPES,
│   │                      VENDOR_TYPES, TASK_TYPES, GATEWAY_LABELS, TAX_TREATMENTS,
│   │                      DEFAULT_CATEGORIES — ONE definition, used everywhere
│   └── state.js         → Tiny global state bus: State.set(key, val), State.get(key), State.on(key, fn)
│
├── spaces/
│   ├── sales/
│   │   ├── sales.html
│   │   ├── sales-init.js       → bootstrap, routing, page switching
│   │   ├── sales-dashboard.js  → KPIs, mini kanban, coaches list
│   │   ├── sales-deals.js      → Deals kanban + list view + filters
│   │   ├── sales-deal-modal.js → New deal 3-step wizard
│   │   ├── sales-clients.js    → Clients list + add panel + AC import
│   │   ├── sales-vendors.js    → Vendors list + detail panel
│   │   └── sales-products.js   → Products + plans admin
│   │
│   ├── operations/
│   │   ├── operations.html
│   │   └── operations.js       → Session logging, bills, my clients, profile tab
│   │
│   └── payments/
│       ├── payments.html
│       ├── payments-init.js
│       ├── payments-transactions.js  → Transaction table + filters + bulk actions
│       ├── payments-income.js        → Expected income / pipeline view
│       ├── payments-bills.js         → Vendor bills workflow
│       ├── payments-history.js       → Payment history
│       ├── payments-balances.js      → Account balances
│       ├── payments-vendors.js       → Vendor matching + rules
│       └── payments-registry.js      → Master data CRUD (companies, accounts, categories, tags)
│
├── profiles/
│   ├── vendor-profile.html + vendor-profile.js
│   └── client-profile.html  + client-profile.js
│
├── shared.css      → Global design system (copy + clean from current shared.css)
├── index.html      → App shell + nav
└── login.html      → Auth page
```

---

## Core Layer Rules

### `core/auth.js`
```js
// Role stored in sessionStorage
// API:
Auth.getRole()              // → 'admin' | 'manager' | 'vendor'
Auth.setRole(role)          // sets + broadcasts, no reload
Auth.getVendorId()          // → vendor id if role=vendor, else null
Auth.init()                 // reads sessionStorage, sets demo vendor picker if needed
```

### `core/guard.js`
```js
// Called at top of every page init
Guard.space(space)          // redirects to index if role lacks access
Guard.action(action, role)  // returns true/false — use to show/hide UI elements
// Space access matrix:
// admin   → all spaces
// manager → sales, operations (no financials)
// vendor  → operations only (own data only)
```

### `core/audit.js`
```js
// Every write in db.js MUST call this after success
Audit.log({
  entity_type,   // 'deal' | 'client' | 'vendor' | 'session' | 'bill' | 'transaction'
  entity_id,
  action,        // 'create' | 'update' | 'delete' | 'status_change'
  changes,       // { before: {...}, after: {...} } — only changed fields
  performed_by   // Auth.getRole() + vendor_id if applicable
})
// Writes to audit_log table in Supabase
// Also writes to activities table for user-visible log
```

### `core/db.js`
- Every Supabase query lives here. No `_sb.from()` calls anywhere else.
- Every write function calls `Audit.log()` after success.
- Canonical plan field names (no aliases):
  - `payment_type` (not `plan_type`)
  - `installments_count` (not `installments`)
  - `payment_link_url` (not `link_url`)
- Vendor status: query only `is_active` (ignore legacy `active` field)
- Vendor id type: vendors.id is `text`. vendor_clients.vendor_id is `uuid`. Use `_toUUID(id)` helper for that join only.
- Error handling: every function throws a shaped error `{ code, message, detail }` — never raw Supabase errors.

### `core/utils.js`
- `formatCurrency(amount, currency)` — single function, replaces all `fmt()` variants
- `formatDate(d)` — single function, replaces all date formatter variants
- `showToast(msg, type)` — `type`: `info | success | warn | error`
- `showConfirm(msg, onConfirm, opts)` — styled confirm, never `window.confirm()`
- `esc(v)`, `escHtml(v)`, `escHtmlAttr(v)` — XSS prevention

---

## Component Rules

### `components/panel.js`
- One unified right side-panel for ALL entity types
- Stack-based navigation with breadcrumbs
- Field-level inline edit with dirty state bar
- `Panel.open(type, id)` → loads entity data → renders panel
- `Panel.push(type, id)` → pushes onto stack (back button appears)
- `Panel.close()` → clears stack + state
- Edit state stored in a JS object `_pendingEdits`, NOT in DOM data attributes

### `components/table.js`
- Config-driven reusable table
- `Table.create({ columns, rows, filters, onRowClick, exportFilename })`
- Built-in: sort by column, text search, pagination (25/50/100), CSV export
- Used by ALL tabular views — no ad-hoc pagination globals

### `components/badges.js`
- ALL status/type badges go through here — no inline badge HTML anywhere else
- `Badges.make(label, opts)` — core builder
- `Badges.dealStatus(status)`, `Badges.billingStatus(status)`, `Badges.vendorType(type)`
- `Badges.txStatus(status)`, `Badges.direction(dir)`, `Badges.cadence(c)`
- Source of truth for vendor type colors/labels (not deals-vendors.js)

### `components/form.js`
- `Form.input({ id, label, type, value, required })` → returns HTML string
- `Form.select({ id, label, options, value })` → returns HTML string
- `Form.validate(formEl)` → returns `{ valid: bool, errors: [] }`

---

## Shared Constants (`shared/constants.js`)

Define ONCE, use everywhere via `<script src="../shared/constants.js">`:

```js
const DEAL_STAGES = ['lead', 'qualified', 'active', 'delivered', 'closed']
const BILLING_STATUS = ['pending', 'link_sent', 'invoiced', 'partial', 'paid', 'overdue']
const VENDOR_TYPES = ['coach', 'contractor', 'team_member', 'merchant']
const PAYMENT_TYPES = ['one_payment', 'installments', 'subscription']
const GATEWAY_LABELS = { thrivecart: 'ThriveCart', green_invoice: 'Green Invoice', wise: 'Wise', bank_transfer: 'Bank Transfer', manual: 'Manual' }
const TAX_TREATMENTS = [/* 13 values from SPEC */]
const DEFAULT_CATEGORIES = [/* from SPEC */]
const VENDOR_TYPE_COLORS = { coach: 'blue', contractor: 'purple', team_member: 'green', merchant: 'amber' }
```

---

## Space: Sales (`spaces/sales/`)

### Pages
1. **Dashboard** — KPI cards (active deals, revenue, pipeline value), mini kanban (3-col), coaches list
2. **Deals** — Kanban view (5 stages) + list toggle. Filter by: stage, vendor, billing status, search. Click deal → Panel.open('deal', id)
3. **Clients** — Searchable list. Add client panel. Import from ActiveCampaign (paste JSON → review → import). Click client → Panel.open('client', id)
4. **Vendors** — List by type. Click → Panel.open('vendor', id). Panel tabs: Profile / Rates / Clients
5. **Products** — Product cards by program. Click → expand plans. Inline add/edit/archive product + plans.

### New Deal Modal (3 steps)
- Step 1: Select or create client (search existing / quick-create)
- Step 2: Select product + plan (dropdown chained: product → plans)
- Step 3: Deal details (price, currency, VAT, payment processor, notes)
- On save: create deal → if product has sessions_included, auto-create package → assign vendor to client

### Panel: Deal
Tabs: Overview | Sessions | Packages | Documents | Activity
Fields editable inline: price, currency, sales_status, billing_status, payment_link, notes, vendor, product/plan (locked after first session)

### Panel: Client
Tabs: Overview | Deals | Sessions | Documents | Activity
Editable: name, email, phone, kind, company_name, source, notes, country

### Panel: Vendor
Tabs: Profile | Rates | Clients | Activity
Editable: name, email, currency, payout_currency, paying_company, entity, tags

---

## Space: Operations (`spaces/operations/`)

Vendor-facing workload view. Role guard: vendor sees own data only.

### Tabs
1. **Log Session** — Client picker (vendor's assigned clients) + form: date, duration, task type, notes. Recent sessions list below.
2. **Sessions** — Month picker. Summary card (hours, earnings). Unpaid sessions table + bill management. History sub-tab.
3. **My Clients** — Assigned clients with package progress bars.
4. **Profile** — Loads vendor-profile page inline.

### Bill Flow
- One draft bill per vendor at a time
- Draft → Submitted → Approved → Ready to Pay → Paid
- Rejected: locked, vendor creates new draft
- Bill lines = unbilled sessions (billed=false) for that vendor

---

## Space: Payments (`spaces/payments/`)

Admin/Finance only. Guard: redirect vendors.

### Tabs
1. **Transactions** — Full transaction ledger. Filters: type, account, month, category, entity, needs_review, deleted, search. Bulk classify: category + tax_treatment + entity + tags. Click row → Panel.open('transaction', id)
2. **Expected Income** — Pipeline view: pending deals grouped by billing status. Package progress.
3. **Vendor Bills** — Bills grouped by vendor. Needs review / Unpaid work / Ready to pay sections. Approve / Reject / Mark Paid actions.
4. **History** — Paid bills + matched transactions.
5. **Balances** — Account balance snapshots. Add/edit monthly balances.
6. **Vendor Matching** — Vendor defaults, unmatched merchants, match rules.
7. **Registry** — CRUD for: companies, accounts, exchange rates, transaction categories, transaction tags, system settings. Inline cell editing.

---

## Profile Pages

### `vendor-profile.html`
Sections: Hero (name, type, avatar, status) | Rates table | Bills list | Documents | Activity log
Role-aware: vendor sees read-only, admin sees full edit

### `client-profile.html`
Sections: Hero | Deals list | Sessions history | Packages | Documents | Reminders | Activity log
Role-aware: vendor sees sessions only (no financials)

---

## Event Binding Rule

Use `addEventListener` ONLY. No `onclick=""` attributes in HTML.
Exception: dynamically rendered list items may use event delegation on the container.

```js
// Good — event delegation
container.addEventListener('click', e => {
  const row = e.target.closest('[data-id]')
  if (row) openDeal(row.dataset.id)
})

// Bad
// <button onclick="openDeal('123')">
```

---

## Error Handling Rule

Every async operation must:
1. Show a loading state before the call
2. On error: `showToast(err.message, 'error')` + `console.error`
3. On success: clear loading state
4. Never silently swallow errors

---

## Build Order

Build in this exact order. Commit after each phase.

**Phase 1 — Core layer**
`core/env.js` → `core/utils.js` → `core/auth.js` → `core/guard.js` → `core/audit.js` → `core/db.js` → `core/router.js`

**Phase 2 — Components + shared**
`shared/constants.js` → `shared/state.js` → `components/badges.js` → `components/table.js` → `components/form.js` → `components/panel.js` → `components/modal.js` → `components/layout.js`

**Phase 3 — Sales space**
`sales.html` → `sales-init.js` → `sales-deals.js` → `sales-deal-modal.js` → `sales-clients.js` → `sales-vendors.js` → `sales-products.js` → `sales-dashboard.js`

**Phase 4 — Operations space**
`operations.html` → `operations.js`

**Phase 5 — Payments space**
`payments.html` → `payments-init.js` → `payments-transactions.js` → `payments-bills.js` → `payments-income.js` → `payments-history.js` → `payments-balances.js` → `payments-vendors.js` → `payments-registry.js`

**Phase 6 — Profile pages**
`vendor-profile.html/js` → `client-profile.html/js`

**Phase 7 — Shell**
`index.html` → `login.html` → `shared.css` (clean copy of current styles)

---

## Definition of Done (per phase)

- All functions described in this prompt exist and are callable
- No `console.log` statements (only `console.error` for caught errors)
- No `window.confirm()` or `window.alert()` — use `showConfirm()` and `showToast()`
- No direct `_sb.from()` calls outside `core/db.js`
- No duplicate constant definitions — all from `shared/constants.js`
- Every write goes through `Audit.log()`
- Event binding via `addEventListener` only
- Commit message format: `rebuild: phase N — description`

---

Start with Phase 1. Do not skip ahead.
