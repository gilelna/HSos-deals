# HSos — RULES.md
_Non-negotiable conventions. Every AI model working on this project MUST read this first._

---

## Before you write any code
1. Read STATUS.md — understand current state and what's broken
2. Read SCHEMA.md — authoritative DB schema, enums, vendor model, migration log
3. Read CHANGELOG.md — understand what changed recently
4. Read this file — understand the rules
5. When done: update STATUS.md + SCHEMA.md (if schema changed) + add entry to CHANGELOG.md

---

## Stack rules
- Plain HTML + Vanilla JS ONLY. No React, Vue, Svelte, no build step, no npm.
- One CSS file: shared.css. No per-page CSS. No inline <style> blocks.
- One DB layer: db.js. ALL Supabase queries go through db.js functions.
- Supabase client is `_sb` in db.js. Exposed as `window._sb = _sb`.
- Never use fetch() for Supabase. Always use `_sb.from(...)` or `_sb.rpc(...)`.

## File rules
- Each page = one .html + one .js (deals.html + deals.js, etc.)
- Script load order in HTML body (bottom): supabase.js → db.js → app.js → router.js → [page].js → registry.js (if used)
- No <script> blocks in HTML body except src= tags at bottom.
- No per-page CSS files. All CSS in shared.css.

## DB rules — CRITICAL
### Two generations of tables with different PK types:
**Old tables (uuid PKs):** clients, deals, vendors, sessions, bills, packages, rates, product_plans, customers, task_types, deal_reminders, deal_documents, vendor_client_assignments, paychecks, exchange_rates, documents
**New tables (text PKs):** companies, accounts, transaction_categories, classification_rules, fee_rules, transaction_imports, transactions, products, plans

### DO NOT:
- Add FK constraints between old uuid tables and new text tables without explicit type cast
- Drop any table with data without explicit user confirmation
- Assume a column exists — always verify with `select column_name from information_schema.columns where table_name = 'x'`
- Use uuid() for new table IDs — use gen_random_uuid()::text

### DO:
- Run `notify pgrst, 'reload schema';` after every schema change
- Use `on conflict do nothing` on seed inserts
- Use `if not exists` on create table/index
- Use `drop constraint if exists` before adding constraints

## Naming conventions
- DB columns: snake_case
- CSS classes: kebab-case
- JS functions: camelCase
- JS constants: UPPER_SNAKE_CASE
- File names: kebab-case.html / kebab-case.js

## Enum values
**Authoritative source: SCHEMA.md. Keep in sync.**
- billing_status: pending | link_sent | invoiced | partial | paid | overdue
- sales_status: lead | qualified | active | delivered | closed
- origin: manual | thrivecart | stripe | other
- payment_processor: stripe | wise | thrive | other
- vat_mode: excl | incl
- vendor_type: coach | contractor | team_member | merchant  ← merchant pending migration 010
- transaction entity: business | private
- payment_cadence: recurring | project_based | one_time  ← pending migration 010

## UI/UX rules
- Use CSS variables ALWAYS, never hardcode hex colors:
  --green/--green-bg/--green-text, --blue/--blue-bg/--blue-text,
  --amber/--amber-bg/--amber-text, --red/--red-bg/--red-text,
  --ink (primary text), --mu (muted), --mu2 (more muted),
  --border, --border2, --surface (white), --bg (off-white)
- Status indicators: dots (8px circles). green=done/matched, amber=pending/review, red=error
- Tables: class="tbl"
- Buttons: class="btn" + modifiers: btn-sm, btn-primary, btn-ghost
- Form: .fg (group) + .fl (label) + .fi (input/select/textarea)
- Cards/blocks: class="block"
- No native alert() or confirm() for destructive actions — use modal overlays
- Toasts: showToast(message, type) where type = 'info' | 'warn' | 'error'

## Payments space rules
- Vendor payout flow: Sessions → Draft Bill → Submitted → Approved → Paid
- One active bill per vendor at a time (draft or submitted)
- Returned bills are locked — vendor creates fresh draft, never edits returned bill
- Transactions: direction = 'in' (money received) or 'out' (money sent)
- Transfers between accounts: include=false (excluded from P&L)
- transaction_kind drives P&L inclusion and classification UI

## Performance patterns
- All list and entity-detail fetches go through `cache.js` (`window.Cache`) via the `Cache.readThrough(key, fetcher)` helper in `db.js`. Don't bypass — even one direct uncached `_sb.from(...).select(...)` for a hot entity defeats the read-through.
- Every write (`update`, `insert`, `delete`) on `deals` / `clients` / `vendors` MUST invalidate both the detail key and the list key adjacent to the successful write. Pattern: `Cache.invalidate('deal:' + id)` + `Cache.invalidate('deals:list')`.
- Use `Promise.all` for any multi-fetch on panel/page open. Sequential awaits where independent are a regression.
- Use **explicit `select()` columns** for hot entity fetches that the panel renders (`getDeal` is the canonical example). Add a comment above the column list naming the consumers; update both when consumer fields change.
- Panel open paints skeleton (`.skeleton-stack` + `.skeleton-shimmer`) before awaiting data. List pages paint 8 skeleton rows via `render*Skeleton()` helpers before `loadData()` resolves.
- Hover-prefetch entity rows with delegated `mouseover` on the list container, gated by `Cache.get(key) || Cache.isInFlight(key)` to prevent double-fetch.
- `cache.js` evicts the oldest 30 entries when size > 150 — leave it in place.

## Role system
- 4 roles: Admin | Manager | Finance | Vendor
- Stored: sessionStorage key `hsos_role`
- Applied: `document.body.dataset.role = role`
- CSS visibility: `[data-role="vendor"] .manager-only { display: none }`
- Vendor identity: sessionStorage `DEMO.vendor` = vendor uuid

## What NOT to do
- Do not add new npm packages or CDN imports without noting in CHANGELOG
- Do not create new utility functions that duplicate existing ones in app.js
- Do not add console.log statements that aren't removed before committing
- Do not change shared.css layout primitives (.app, .sidebar, .topbar, .app-body) without understanding the full cascade
- Do not use position:fixed anywhere (breaks layout)
- Do not hardcode vendor IDs, product IDs, or any real data in JS
