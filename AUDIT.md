# HSos Deals & Payments — Codebase Audit

> Generated: 2026-04-23. Pure documentation — no code was changed.

---

## Table of Contents

1. [File Inventory](#file-inventory)
2. [File-by-File Analysis](#file-by-file-analysis)
3. [Cross-Cutting Issues](#cross-cutting-issues)
4. [Dead Code & Duplicates](#dead-code--duplicates)
5. [Naming Inconsistencies](#naming-inconsistencies)
6. [Schema Mismatches](#schema-mismatches)

---

## File Inventory

| File | Size | Lines | Responsibility |
|------|------|-------|----------------|
| `db.js` | 64 KB | ~1700 | Supabase data layer — all DB access |
| `app.js` | 12 KB | 354 | Cross-page utilities: roles, toast, avatar, escape |
| `router.js` | 3.7 KB | 133 | Client-side URL-state router |
| `panel-manager.js` | 68 KB | ~1500 | Unified entity detail side-panel |
| `registry.js` | 38 KB | ~1000 | Master data admin (companies, accounts, categories, tags) |
| `shared.css` | 87 KB | 2941 | Global stylesheet — all CSS |
| `deals.html` | 34 KB | — | Operations space HTML |
| `deals.js` | 744 B | 24 | Quill editor init for new deal modal |
| `deals-init.js` | 7.7 KB | 229 | Operations page: DOMContentLoaded, routing, page switching |
| `deals-state.js` | 4.1 KB | 105 | Shared state & constants for operations space |
| `deals-dashboard.js` | 13.4 KB | 336 | Dashboard view rendering |
| `deals-kanban.js` | 6.2 KB | 130 | Deals filtering, kanban, and list view |
| `deals-modal.js` | 19 KB | ~500 | New deal 3-step modal |
| `deals-products.js` | 28.8 KB | ~800 | Products admin page (inline CRUD) |
| `deals-clients.js` | 13.3 KB | ~320 | Clients list, AC import, detail panel |
| `deals-vendors.js` | 40.6 KB | ~1100 | Vendors list, detail panel, profile editing |
| `payments.html` | 45.7 KB | — | Payments space HTML |
| `payments.js` | 187 KB | 4526 | Payments space — all logic in one file |
| `payments-state.js` | 3 KB | ~50 | Classification constants for payments space |
| `products.html` | 14 KB | — | Products showcase HTML |
| `products.js` | 26 KB | ~650 | Products showcase (card/stack view) |
| `workload.html` | 18.6 KB | 365 | Vendor workload HTML |
| `workload.js` | 44.5 KB | 1100 | Vendor workload: session logging, bills, clients |
| `vendor-profile.html` | 10.6 KB | 244 | Standalone vendor profile HTML |
| `vendor-profile.js` | 29.2 KB | 772 | Vendor profile logic: hero, bills, rates, docs |
| `client-profile.html` | 11.4 KB | 252 | Standalone client profile HTML |
| `client-profile.js` | 26.3 KB | 719 | Client profile logic: deals, reminders, tags, docs |
| `activity-log.html` | 5.2 KB | — | Activity log viewer HTML |
| `activity-log.js` | 3.4 KB | ~80 | Activity log renderer + Markdown filter |
| `components/layout.js` | — | ~368 | LAYOUT + BELL: topbar/sidebar + notification bell |
| `components/badges.js` | — | 178 | Badge HTML builder library |
| `components/table-framework.js` | — | 177 | Reusable table filter/pagination/export controller |
| `env-config.js` | 5.3 KB | — | Supabase client init (two environments) |
| `env-keys.js` | 405 B | — | Environment key selection |
| `env-toggle.html` | 3.5 KB | — | UI for switching demo/production |
| `profile.js` | 6.5 KB | — | Inline name editing utility |
| `index.html` | 12.4 KB | — | App home/landing |
| `login.html` | 6.7 KB | — | Login page |
| `deal.html / deal.js` | — | — | Legacy single-deal page (pre-panel era) |

---

## File-by-File Analysis

### `db.js` — Database Layer

**What it does:** Single source of truth for all Supabase queries. Exposes named async functions for every entity. No direct DB calls should exist outside this file.

**Key functions:**
- `getVendors()` / `getVendorsInactive()` / `getVendor(id)` — Vendor listing with hydrated rates and vendor_clients
- `_hydrateVendors(vendors)` — Enriches vendor array with rates[] and clients[] via parallel queries + Maps
- `getRates()` / `upsertRate()` / `deleteRate()` — Vendor rate management
- `getClients()` / `getClient(id)` / `createClient()` / `updateClient()` / `deleteClient()` — Client CRUD
- `getProducts()` / `getAllProductsWithPlans()` / `createProductFull()` / `updateProductFull()` — Product CRUD (joins programs, plans)
- `getDeals()` / `getDeal(id)` / `createDeal()` / `updateDeal()` / `deleteDeal()` — Deal CRUD with reminders + documents
- `getSessions()` / `createSession()` / `updateSession()` / `logSessionV2()` — Session management
- `getTransactions()` / `createTransaction()` / `updateTransaction()` — Financial transactions
- `getActivities()` / `logActivity()` / `getClientReminders()` / `getNotifications()` — Activity log
- `createDraftBillV2()` / `approveBillV2()` / `submitBillV2()` — Bill lifecycle

**Issues:**
- Vendor IDs: `vendors.id` is `text` but `vendor_clients.vendor_id` is `uuid` — workaround via `_toUUID()` helper at line 708. This is a known schema inconsistency.
- `active` vs `is_active` — both fields checked on vendors throughout (dual-status logic in `_withVendorActiveFilter()`).
- No standardized error shape. All functions throw raw Supabase error objects; callers handle inconsistently (some toast, some console.error only).

---

### `app.js` — Shared Utilities

**What it does:** Cross-page helpers used by every module.

**Key functions:**
- `Role.get()` / `Role.set(r)` / `Role.init()` — sessionStorage-backed role management
- `canAccessSpace(space)` / `guardSpace(space, redirect)` — Access control enforcement
- `showToast(msg, type)` — Auto-dismiss toast (`info | warn | error`)
- `showConfirm(msg, onConfirm, opts)` — Styled confirmation overlay (replaces `window.confirm()`)
- `esc(v)` / `escHtml(v)` / `escHtmlAttr(v)` — HTML entity escaping (XSS prevention)
- `initials(name)` / `avatarBg(name)` / `avatarFg(name)` — Avatar utilities (deterministic hash)
- `formatDate(d)` / `formatMonth(ym)` — Date formatting helpers
- `DEMO.vendor` getter/setter — Demo vendor identity (sessionStorage)
- `showVendorPicker()` — Modal vendor selector for demo/admin mode

**Issues:**
- `Role.set()` triggers `location.reload()` — loses all unsaved state.
- `showVendorPicker()` creates DOM elements imperatively with no cleanup if called twice.
- Avatar color palette has only 6 colors — collision likely for more than ~6 vendors.

---

### `router.js` — URL-State Router

**What it does:** Lightweight client-side router. Reads/writes URL query params to navigate between entity detail views. Handler-based: each entity type registers a function to call when that entity is opened.

**Key API:**
- `Router.register(entity, fn)` — Register handler (e.g., `Router.register('deal', ({id}) => openDeal(id))`)
- `Router.open({entity, id, view, from})` — Push URL state + dispatch handler
- `Router.dispatch()` — Execute handler for current URL state
- `Router.back()` / `Router.closeAll()` — Navigation helpers
- `Router.getParams()` — Parse current query string

**Issues:**
- No validation on entity or id. Passing undefined silently navigates to broken state.
- All params are strings — numeric IDs are not coerced.
- No guard against double-registering the same entity handler.

---

### `panel-manager.js` — Side Panel System

**What it does:** Unified right-side panel for viewing and inline-editing any entity (vendor, client, deal, transaction, package, product, plan). Stack-based navigation with breadcrumbs.

**Key API (window.PanelManager):**
- `PanelManager.open(type, id)` — Load entity data and render panel
- `PanelManager.close()` — Close panel and clear state
- Field-level edit: click a field → input appears → `commitEdits(entry)` saves accumulated edits
- FK picker: select related entities via searchable dropdown

**Issues:**
- 68 KB single-file IIFE with no internal submodule organization.
- Field edit state stored in DOM via `data-*` attributes rather than a state object — fragile.
- FK picker assumes all items have `.id` and `.label` — no type safety.
- Dirty state bar not cleared on panel close if navigation happens before save.
- No undo for individual field edits — only "discard all" option.

---

### `registry.js` — Master Data Administration

**What it does:** CRUD interface for all lookup/master data: companies, accounts, exchange rates, opening balances, transaction categories, tags, system settings. All editing is inline table-cell activation.

**Key functions:**
- `load()` — Parallel fetch of all 7 entity types
- `render()` — Delegates to per-section renderers
- `_startEdit(cellDiv)` / `_commitEdit(input)` / `_keyEdit(e, input)` — Inline cell edit lifecycle
- `_saveField(entityType, id, field, value)` — DB commit + optimistic UI update
- `renderCompanies()` / `renderAccounts()` / `renderExchangeRates()` / `renderCategories()` / `renderTags()` etc.
- Cell builders: `cellText()` / `cellSelect()` / `cellPill()` / `cellDel()`

**Issues:**
- Single large IIFE with no pagination — could break with many rows.
- Tab navigation tightly coupled to `#reg-section-*` IDs in HTML.
- Cell state managed in DOM attributes — no central state model.

---

### `deals.js` — Quill Editor Wrapper

**What it does:** Minimal file. Initializes and manages the Quill rich-text editor instance for the new deal modal notes field.

**Key functions:**
- `_initNdNotesQuill()` — Init/reset Quill on step 3 of new deal modal
- `_quillValue(q)` — Extract HTML from Quill, return null for empty paragraphs

**Issues:**
- Magic string: detects empty state by checking for `<p><br></p>` — fragile across Quill versions.
- Could be merged into `deals-modal.js`; file boundary adds no meaningful isolation.

---

### `deals-init.js` — Operations Entry Point

**What it does:** DOMContentLoaded handler for `deals.html`. Loads initial data, registers Router handlers, wires page switching, sets up event delegation.

**Key functions:**
- `loadData()` — Parallel load of deals, clients, vendors (active + inactive), products, companies
- `switchPage(name, linkEl, opts)` — Switches between dashboard / deals / clients / vendors / products pages. Updates URL.
- `setView(v, opts)` — Toggle between kanban and list view on deals page
- `registerRouterHandlers()` — Registers Router handlers for `deal`, `vendor`, `client` entities

**Issues:**
- `_routerDispatching` boolean flag used as cross-module mutex to prevent URL conflicts during programmatic navigation — conceptually fragile.
- `loadData()` has no loading indicator and fails silently (errors go to console only).
- URL query string management is partially duplicated with `router.js`.

---

### `deals-state.js` — Operations State & Constants

**What it does:** Declares all shared state variables and constants used across the operations space modules.

**State:**
- Deals: `_deals`, `_clients`, `_vendors`, `_products`
- View: `_page`, `_view`, `_search`, `_filters`, `_fVendor`, `_fProduct`, `_fBilling`
- Products: `_editProductId`, `_programsWithProducts`, `_collapsedPrograms`, `_productInlineEdit`, `_planInlineEdit`
- Clients: `_clientSearch`, `_selClientId`
- Vendors: `_selVendorId`, `_vendorTab`, `_vendorPaychecks`, `_vendorsInactive`, `_vendorEditMode`, `_vendorEditSnapshot`, `_companies`, `_vendorSearch`, `_fVendorType`, `_fVendorCurrency`, `_fVendorManager`
- Routing: `_routerDispatching`, `_routerRegistered`

**Constants:** `STAGES`, `BILLING_COLORS`, `PAYMENT_STATUS_META`, `GATEWAY_LABELS`, `SYM`

**Utilities:** `fmt(price, currency)`, `finalAmt(price, vat, mode)`, `paymentStatusBadge(status)`, `_detectPlansSchema()`

**Issues:**
- Mixes state for different pages (deals page, products page, clients page, vendors page) in a single flat namespace — no lifecycle reset between page switches.
- Magic strings for filter keys (`'overdue'`, `'active'`, `'unpaid'`) defined inline rather than as constants.

---

### `deals-dashboard.js` — Operations Dashboard

**What it does:** Renders the dashboard view: KPI metrics, mini kanban, coaches list, active clients list, and right-side detail panel.

**Key functions:**
- `renderDashboard()` — Orchestrates all dashboard renders; fetches fresh data on each call
- `renderDashMetrics()` — KPI cards (active deals, leads pending, clients, coaches)
- `renderDashKanban()` / `renderDashKanbanWithPackages()` — Two nearly-identical kanban column renderers
- `renderDashCoaches()` — Coach list with client count and status
- `renderDashClients()` — Active clients list with coach, product, package info
- `_renderClientDetailPanel()` — Right-side client detail panel

**Issues:**
- Stage list hardcoded as `['lead', 'active', 'completed']` — inconsistent with `STAGES` constant which has 5 stages (`lead, qualified, active, delivered, closed`).
- `renderDashKanban()` and `renderDashKanbanWithPackages()` are nearly identical — the "with packages" variant should replace the base version.
- `_dashData` is a module-level cache object but there is no invalidation mechanism.
- Async errors silently swallowed in try/catch blocks (only `console.error`).

---

### `deals-kanban.js` — Deals Filter, Kanban & List Views

**What it does:** Filtering logic for deals, plus two view renderers: kanban columns and sortable list table.

**Key functions:**
- `filteredDeals()` — Applies search, status toggles, and dropdown filters to `_deals`
- `renderDeals()` — Delegates to kanban or list view based on `_view`
- `renderKanban()` — 5-column kanban (lead, qualified, active, delivered, closed)
- `kanbanCard(d)` — Single deal card with client avatar, product, vendor, price, billing status
- `renderList()` — Sortable table view
- `openClientFromCard()` — Opens client detail from kanban card

**Issues:**
- All matching deals rendered at once — no pagination or virtualization.
- Kanban cards capped at 8 per stage without any "show more" UI.
- `filteredDeals()` recalculates from scratch on every call — no memoization.

---

### `deals-modal.js` — New Deal Modal

**What it does:** 3-step wizard for creating a new deal: (1) select customer + product, (2) select plan, (3) fill deal details. Includes quick-create client inline.

**Key functions:**
- `ndStep1Next()` — Validates customer + product, loads plans for step 2
- `_renderNdCs()` — Customer search dropdown with quick-add form
- `_ndLoadPlans(productId, country)` — Fetch and display available plans for step 2
- `ndSelectPlan()` — Visual highlight of selected plan
- `_prefillStep3FromPlan(plan)` — Auto-fills price, currency, payment link from selected plan
- `calcNdVat()` — Live VAT calculation
- `ndSubmit()` — Creates deal, auto-creates package if applicable, auto-assigns vendor-client
- `_autoCreatePackage(dealId, planId)` — Creates package record if plan has sessions_included
- `_autoAssignVendorClient(clientId, vendorId)` — Ensures vendor-client relationship exists

**Issues:**
- `_ndEmailTimer` debounce timer is a module-level global — not cancelled on modal close, can fire after modal has been dismissed.
- Quick-client creation leaks internal state into data attributes on the option element.
- `onNdCustomerEmailInput()` silently updates the customer's country without explicit user action.
- No validation that the selected customer is assigned to a vendor (required for deal creation to be meaningful).

---

### `deals-products.js` — Products Admin Page

**What it does:** Full CRUD for products, plans, and programs with inline table editing. One product or plan is editable at a time.

**Key functions:**
- `initProductsPage(force)` — Load programs/products/plans hierarchy; skip if already loaded
- `renderProducts()` — Main renderer; groups by program, collapse/expand support
- `startProductInlineEdit(id)` / `saveProductInlineEdit()` / `cancelProductInlineEdit()` — Product inline edit lifecycle
- `startPlanInlineEdit(productId, planId)` / `savePlanInlineEdit()` / `cancelPlanInlineEdit()` — Plan inline edit lifecycle
- `_renderPlanEditRow(product, isNew)` — Editable plan row with inputs

**Issues:**
- `base_currency` vs `currency` field name resolution (line 383) — products table uses one, plans use the other, with inline logic to pick the right key.
- Installment count `<select>` generates 36 `<option>` elements inline — hardcoded, not scalable.
- No field-level error display — validation failures show toast only, without highlighting the bad field.

---

### `deals-clients.js` — Clients Page

**What it does:** Searchable client list with detail panel. Also provides bulk import from ActiveCampaign (paste JSON or CSV).

**Key functions:**
- `renderClients()` — Filtered list with search; shows deal count per client
- `showClientDetail(clientId, e, from)` — Open detail via Router → PanelManager → inline fallback chain
- `openAddClientPanel()` / `submitAddClient()` — Manual client creation form
- `openAcImportPanel()` / `acParseAndReview()` / `acImportSelected()` — AC bulk import flow
- `_acParseJSON(data)` / `_acParseCSV(data)` — Parse either format
- `deleteClientFromList(id)` — Confirm-then-delete; warns if client has deals

**Issues:**
- AC import CSV parsing relies on flexible header aliases and case-insensitivity — may fail silently on format changes.
- No email format validation during import.
- Delete only warns about deal count, does not show which deals will be orphaned.

---

### `deals-vendors.js` — Vendors Page

**What it does:** Vendor list with type-grouped display, filtering, and a detail panel with three tabs: Profile, Payments, Clients. Supports inline profile editing and avatar upload.

**Key functions (22 exposed on window):**
- `renderVendors()` — Groups by TYPE_ORDER; renders header rows + vendor rows
- `openVendorDetail(id)` — Loads paychecks; routes to panel or inline detail
- `_renderVendorProfileTab()` — View mode vs. edit mode profile
- `enterVendorEditMode()` / `saveVendorProfile(id)` / `cancelVendorEdit()` — Edit lifecycle
- `_renderVendorPaymentsTab()` — Bill history, payment methods
- `_renderVendorClientsTab()` — Client assignment with searchable picker
- `triggerAvatarUpload(vendorId)` / `onAvatarFileChange(event)` — Avatar upload

**Issues:**
- Dynamic `<input type="file">` created on each `triggerAvatarUpload()` call — never removed from DOM (accumulates).
- Edit snapshot (for cancel/revert) only captures top-level vendor fields — does not include nested rates or client assignments.
- Manager filter dropdown rebuilt by scanning all vendors on every filter change — linear scan.

---

### `payments.js` — Payments Space (Monolithic)

**What it does:** Entire payments space in a single 4526-line, 187 KB file. Covers 7 tabs: Transactions, Expected Income, Vendor Bills, History, Registry, Balances, Vendor Manager.

**Major sections (by `===` comment headers):**
1. Classification constants (lines 4–104) — duplicates `payments-state.js`
2. Audit log write helper (lines 106–127)
3. State declarations (lines 129–157) — ~30 globals
4. UI helpers + cover shrink on scroll (lines 162–264)
5. Tab switching + URL state (lines 265–717)
6. Transaction filtering + rendering (lines 789–1305) — paginated table
7. Bulk operations — multi-select, bulk classify (lines 1307–1403)
8. Transaction detail inline edit panel (lines 1404–1513)
9. Vendor summaries + unbilled sessions (lines 1514–1693)
10. Vendor detail panel (lines 1695–2216)
11. Expected income rendering (lines 2219–2560)
12. Account balances (lines 2562–3005)
13. History / audit log (lines 3006–3657)
14. Modal system — transaction & vendor creation (lines 3658–3891)
15. Registry integration + deferred lookups (lines 3892–4150)
16. DOMContentLoaded + page init (lines 4151–4526)

**Issues:**
- File size makes the module unmaintainable. The deals space solved this by splitting into 7 files — payments has not been migrated yet.
- Classification constants duplicated from `payments-state.js` (lines 4–80 in payments.js vs. the whole of payments-state.js).
- ~30 module-level globals with overlapping names (`txAllRows`, `txPage`, `txSelectedIds`, `selectedDraftIds`, `selectedUnbilledIds`, `vendorSummaries`, etc.).
- `_routerDispatching` flag used here (same pattern as deals-init.js) — cross-file coordination via global.
- Transaction pagination state (`txPage`, `txPageSize`) has no corresponding loading indicator.
- Inline edit state for transactions manipulates DOM nodes directly rather than a state object.
- `popstate` listener on line ~670 does not fully restore all filter state on back-navigation.

---

### `payments-state.js` — Payments Constants

**What it does:** Defines `DEFAULT_CATEGORIES`, `TAX_TREATMENTS`, and `DEFAULT_TAG_POOL` as local defaults. Exports `loadClassificationLookups()` to hydrate from DB (falling back to these defaults).

**Issues:**
- `DEFAULT_CATEGORIES` and `TAX_TREATMENTS` are also defined in `payments.js` lines 4–80. One copy is a dead duplicate — they are identical.

---

### `products.js` — Products Showcase

**What it does:** Read-only card/stack view of products and plans. Separate from `deals-products.js` (admin CRUD view). Supports deep-link via `?plan=X` URL param.

**Key functions:**
- `initProducts()` — Load and render
- `renderStack()` — Grid of product cards
- `renderProductSection(product)` — Hero header per product
- `renderPlansArea(product)` / `renderPlanCard(plan, product)` — Plan cards
- `handleDeepLink()` — Scroll to + highlight plan from URL param

**Issues:**
- Duplicate plan-type detection: checks both `payment_type` and `plan_type` field names — schema ambiguity not resolved.
- `formatPlanSource()` is called but not defined in this file — assumes global scope (likely panel-manager or registry provides it).
- Category overlay colors are hardcoded in a `CATEGORY_OVERLAY` map — not CSS-variable-driven.

---

### `workload.js` — Vendor Workload

**What it does:** Vendor-facing session logging and billing UI. 4 tabs: Log Session, Sessions (bills), My Clients, Profile (iframe).

**Key functions:**
- `loadVendorData()` — Parallel Promise.all of 8 queries; updates state + cover widgets
- `renderLogTab()` — Client picker grid + session form + recent sessions table
- `renderWorkTab()` — Month summary, task breakdown, unpaid sessions, bills
- `renderClientsTab()` — Assigned clients with package progress
- `renderProfileTab()` — Loads `vendor-profile.html` into iframe
- `logSessionV2()` — Submit new session form
- `createDraftBill()` / `submitDraftBill()` / `withdrawDraftBill()` — Bill lifecycle
- `openEditModal(sessionId)` / `saveEditSession()` / `deleteSessionFromModal()` — Session edit modal

**Patterns:**
- Admin users can switch vendor context via a vendor picker at the top of the log form.
- Sessions locked once bill is approved/paid — edit/delete buttons hidden, save blocked.

**Issues:**
- `onEditTaskTypeChange()` function is defined but is a no-op (empty body).
- Profile tab loads vendor profile in an iframe — any data changes in the iframe are invisible to the parent page state.
- No error recovery UI — data load failures show a toast and leave stale data on screen.

---

### `vendor-profile.js` — Vendor Profile Logic

**What it does:** Renders the standalone vendor profile page. Shows hero, stats, assigned clients, bill history, rates, documents. Supports admin edit and vendor read-only modes.

**Key functions:**
- `loadAll()` — Parallel load of all vendor data
- `renderHero()` — Avatar, name, type badges, quick links
- `renderStats()` — Sessions this month, unbilled count, last payout, YTD
- `renderClientsList()` — Clients with package info (async per-client detail load)
- `renderBillsList()` — Bills grouped by status
- `openBillDetailModal(billId)` — Bill approval/return/paid flow (admin only)
- `openRateModal(rateId)` / `saveRateModal()` — Rate CRUD
- `openDocUpload()` / `saveDoc()` / `renderDocs()` — Document management
- `applyReadOnlyMode()` — Hides edit UI for vendor-role viewers

**Patterns:**
- `_updateVendorWithSchemaFallback()` — Retries failed updates with missing columns stripped. Handles live schema evolution gracefully.
- URL params: `id=<vendorId>`, `readonly=1`, `from=workload` (suppresses layout shell when embedded as iframe).

---

### `client-profile.js` — Client Profile Logic

**What it does:** Standalone client profile: deals, packages, payment history, tags, reminders, documents, details side panel.

**Key functions:**
- `loadAll()` — Parallel load: client, deals, packages, sessions, docs, tags, vendor assignments
- `renderDealsList()` — Deals grouped by status with package info
- `renderPaymentsList()` — Paid deals with amount and payment method
- `renderTags()` / `switchTagsTab()` / `removeTag()` — Tag display + delete (HSos tags only)
- `renderReminders()` / `saveReminder()` / `patchReminder()` — Reminder CRUD with Markdown body
- `toggleDetailsPanel()` / `renderDetailsPanel()` — Side panel: contact info + external platform links
- `initNameEdit()` — Inline name editing via `profile.js`
- `renderDocs()` / `openDocUpload()` / `saveDoc()` — Document management

**Issues:**
- External platform URLs (ActiveCampaign, ThriveCart, Mighty Networks, Freshdesk) are hardcoded base URLs — not admin-configurable.
- Tags are split by origin (AC tags, MN tags, HSos tags) but only HSos tags are deletable — no UI cue that others are read-only.

---

### `activity-log.js` — Activity Log Viewer

**What it does:** Reads all activities from DB, renders them in a filterable table with Markdown body rendering.

**Key functions:**
- `renderMd(text)` — Minimal inline Markdown (bold, italic, links, bare URLs)
- `renderActivityTable()` — Filters by search/type/status and renders tbody
- `initActivityLog()` — Await layout init, load data, render

**Issues:**
- `entityLabel(row)` truncates entity_id to 8 chars — not useful to humans. Should resolve to entity name via a lookup.
- No link from activity to the actual entity — can't navigate to the deal or client from the log.

---

### `components/layout.js` — Layout Component

**What it does:** Loads topbar and sidebar HTML components, applies role-based nav restrictions, initializes the notification bell.

**API (window.LAYOUT):**
- `LAYOUT.init(pageTitle, space)` — Main setup
- `LAYOUT.setActiveSpace(space)` / `LAYOUT.setActiveSidebarLink()` — Nav state
- `LAYOUT.applyRoleRestrictions()` — Hides nav items per role
- `LAYOUT.initCoverShrink()` — Scroll-based cover shrink

**window.BELL:**
- Loads `getNotifications()` from db.js
- Shows reminder + integration event bubbles
- Done/Dismiss inline actions

---

### `components/badges.js` — Badge Library

**What it does:** Centralized HTML badge/chip generator. All status/type badges should go through this.

**API (window.Badges):**
- `Badges.make(label, opts)` — Core builder
- Convenience: `vendorType()`, `txStatus()`, `billingStatus()`, `category()`, `taxTreatment()`, `tag()`, `direction()`, `cadence()`

**Issues:**
- Some modules still build status badges manually via inline string templates instead of calling `Badges.*`. Not all badge generation is centralized.

---

### `components/table-framework.js` — Table Utility

**What it does:** Reusable stateful table controller. Config-driven: plug in rows + a filter callback, get pagination + sort + CSV export.

**API:** `TableFramework.create(config)` → returns controller with `applyFilters()`, `getPage()`, `renderPagination()`, `exportCSV()`, `pushUrl()`, `restoreUrl()`.

**Issues:**
- Only used by some pages — several other tables implement their own ad-hoc pagination globals.

---

### `shared.css` — Global Stylesheet

**Structure:**
1. CSS custom properties (colors, spacing, fonts, shadows)
2. Layout primitives (.app, .app-body, .sidebar, .main)
3. Topbar and cover/hero styles
4. Component library: buttons, inputs, modals, tables, kanban, avatars, pills, badges
5. Space-specific overrides (operations, workload, payments, products)
6. Panel manager styles (.panel-manager-*)
7. Registry table styles (.reg-*)
8. Responsive media queries (appended at end)

**Key variables:** `--ink`, `--mu`, `--mu2`, `--green`, `--blue`, `--red`, `--amber`, `--purple`, `--font-sans`, `--shadow`, plus per-space gradient pairs.

**Issues:**
- 2941 lines in a single file with no preprocessor — difficult to navigate and modify safely.
- Responsive styles are an afterthought (appended at the end rather than co-located with components).
- Several hardcoded pixel values outside the variable system.
- No dark mode support.
- `position: fixed` is prohibited per RULES.md but may appear in some places (worth auditing).

---

## Cross-Cutting Issues

### 1. Global State Without Lifecycle

Every page module declares module-level globals (`_deals`, `_clients`, `txAllRows`, etc.) that are never reset when the user navigates away. State from a previous page visit can bleed into the next.

### 2. `_routerDispatching` Mutex Pattern

Three files (`deals-init.js`, `deals-modal.js`, `deals-vendors.js`, `payments.js`) all check and set the same `_routerDispatching` boolean to prevent URL-state conflicts during programmatic navigation. This is an implicit cross-module coordination mechanism with no formal ownership or documentation.

### 3. Inconsistent Error Handling

| Pattern | Where Used |
|---------|-----------|
| `throw error` (caller must catch) | All `db.js` functions |
| `showToast(..., 'error')` + `console.error` | Most CRUD callers |
| Silent `try/catch` with only `console.error` | Dashboard, deal load |
| No error handling at all | Some filter/render paths |

No consistent error recovery UI (spinners, retry buttons, disabled states during async ops).

### 4. Multiple Panel/Modal Systems

The codebase has at least four distinct systems for showing detail views or edit forms:

| System | Where |
|--------|-------|
| `PanelManager` (IIFE) | panel-manager.js |
| Inline side panel (ad hoc HTML swap) | deals-vendors.js, deals-clients.js, workload.js |
| Modal overlays (fixed `#modal-*` elements) | deals.html, payments.html |
| Router + PanelManager chain | deals-init.js, workload.js |

No unified component model — code decides which system to use inconsistently.

### 5. Template Literal Rendering

All list/table/panel HTML is constructed via string template literals and assigned to `.innerHTML`. There is no VDOM, diffing, or component abstraction. Every state change triggers a full re-render of the affected region.

### 6. Vendor Type Metadata Defined in Multiple Places

`TYPE_LABELS`, `TYPE_ORDER`, `TYPE_PILL_COLOR` (vendor types) are defined in `deals-vendors.js`. `Badges.vendorType()` in `badges.js` also defines its own color/label mapping. These two maps are independent and could drift.

### 7. `fmt()` Function Name Collision

Two functions named `fmt` exist with different signatures:
- `deals-state.js`: `fmt(price, currency)` → formatted currency string with symbol
- `payments.js` and `workload.js`: `fmt(n)` → `$X.XX` (USD only)

Both are module-scoped so no runtime collision, but the naming is confusing.

---

## Dead Code & Duplicates

| Issue | Location | Severity |
|-------|----------|----------|
| `DEFAULT_CATEGORIES` + `TAX_TREATMENTS` defined twice | `payments-state.js` AND `payments.js` lines 4–80 | High |
| `GATEWAY_LABELS` defined twice | `deals-state.js` AND `deals-products.js` | Medium |
| `renderDashKanban()` nearly identical to `renderDashKanbanWithPackages()` | `deals-dashboard.js` | Medium |
| `onEditTaskTypeChange()` is empty no-op | `workload.js` | Low |
| `deals.js` (24 lines) could be merged into `deals-modal.js` | `deals.js` | Low |
| `formatPlanSource()` called in `products.js` but not defined there | `products.js` | Medium (runtime risk) |
| `deal.html` / `deal.js` (legacy single-deal page) | root | Low |
| `_detectPlansSchema()` runtime schema check | `deals-state.js` | Low (migration artifact) |

---

## Naming Inconsistencies

| Aspect | Inconsistency |
|--------|---------------|
| Currency formatter | `fmt(price, currency)` in deals vs `fmt(n)` in payments/workload |
| Date formatter | `formatDate(d)` in app.js vs `formatDateShort(d)` in payments.js + workload.js |
| Vendor status field | `active` (old table) vs `is_active` (new table) — both checked in db.js |
| Plan type field | `payment_type` vs `plan_type` — both checked in products.js |
| Plan link field | `link_url` vs `payment_link_url` — both referenced across files |
| Installment count field | `installments` vs `installments_count` |
| Function prefixes | Some use underscore prefix (`_renderX`, `_loadX`) for private helpers; many don't |
| Global function exposure | `deals-vendors.js` exposes 22 functions on `window`; other modules expose none or few |
| Event binding | Mix of `onclick="fn()"` attributes (most pages) and `addEventListener` (badges.js, registry.js) |
| Badge rendering | Some modules call `Badges.billingStatus()` etc.; others build badge HTML inline |

---

## Schema Mismatches

Documented fully in `docs/SCHEMA-AUDIT.md`. Critical gaps:

| Field | Table | Status |
|-------|-------|--------|
| `stripe_payment_link` | `deals` | Queried in db.js, not shown in any UI |
| `owner_vendor_id` | `deals` | In schema, no UI field |
| `discount` | `deals` | In schema, no UI field |
| `actual_amount_paid` | `paychecks` | In schema, no UI field |
| `payment_date` | `paychecks` | In schema, no UI field |
| `paid_from_account_id` | `bills` | In schema, no UI field |
| `finance_notes` | `bills` | In schema, no UI field |
| `payment_type` vs `plan_type` | `plans` | Ambiguous field name used inconsistently |
| `installments` vs `installments_count` | `plans` | Two field names used for same concept |
| Vendor `id` type | `vendors` | `text` but `vendor_clients.vendor_id` is `uuid` — runtime cast required |
| Vendor status | `vendors` | Both `active` and `is_active` present, both checked |

Migrations 008, 009, 010, and 015 are listed in SCHEMA.md as **not yet run** — UI code in some places may already assume the columns they add exist.
