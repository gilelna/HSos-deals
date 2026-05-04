# HSos — CHANGELOG.md
_Reverse chronological. One entry per session._

---

## 2026-05-03 — Admin user-management page

### Added
- **`admin/users.html` + `admin/users.js`** — new page reachable from the avatar dropdown ("Manage users", admin-only). Standard HSos shell (operations sidebar). Single table: User (full name + email), Role, Vendor, Status (active-session indicator), Joined.
  - **Inline role edit** via a `<select>` per row (admin/manager/finance/vendor). On change → `updateProfileRole(userId, newRole)` → optimistic update with a transient `…` → `✓` checkmark on success. Failure reverts the select and toasts the error code (`cannot_demote_self`, `forbidden_admin_only`, or the raw RPC message).
  - **Vendor cell** — when `profiles.vendor_id` is set, shows the joined `vendors.name` as a clickable link that opens the vendor side panel via `SidePanel.open('vendor', { id })`. Empty state: em-dash.
  - **Status cell** — colored dot + relative-time label derived from `auth.users.last_sign_in_at`: green/"active" (<24h), amber/"Nd ago" (<30d), gray/"never" or older. Clarifies what "active session" means in practice — Supabase only exposes the most recent sign-in timestamp, not a live-session signal.
  - **Row click (outside the role select)** → vendor side panel when the user has `vendor_id`; otherwise an inline overlay card with name + email + role + a note that no vendor is linked.
  - **Admin gate** — defense in depth: `LAYOUT._runAuthGate` populates `__hsosAuth`; the page then redirects non-admins to `/index.html` before any data fetch, AND the underlying RPCs reject non-admin callers server-side (RAISE EXCEPTION `forbidden_admin_only`).
- **`schema/user_management_rpc.sql`** (new, **NOT applied**) — two SECURITY DEFINER RPCs.
  - `get_user_management_rows()` returns one row per profile, joined with `auth.users.last_sign_in_at` and `vendors.name`. Required because the anon Supabase client cannot read `auth.users` directly under standard RLS — the function gates access to admin callers via `auth.uid()` lookup against `public.profiles.system_role`.
  - `update_profile_role(target_user_id, new_role)` — flips `profiles.system_role`, refuses self-demotion (`cannot_demote_self`).
  - Both `REVOKE FROM PUBLIC` and `GRANT EXECUTE TO authenticated`.
- **`db.js`** — `getAllProfiles()` and `updateProfileRole(userId, newRole)` thin wrappers around the two RPCs. Both throw on error (RPC `RAISE EXCEPTION` surfaces as `error.message` in supabase-js).

### Changed
- **`components/user-menu.js`** — added an admin-only "Manage users" link to the avatar dropdown, between the identity block and the Sign out button. Visibility is gated on `__hsosAuth.profile.system_role === 'admin'`. The link uses the existing `.um-btn` style; an `a.um-btn { text-decoration: none }` rule was added to `shared.css` so the anchor matches the button siblings visually.
- **`shared.css`** — new `/* ─── user management page ─── */` block: `.um-role-wrap`, `.um-role-select`, `.um-role-check`, `.um-dot` + variants (`-green/-amber/-gray`), `.um-status-label`, `.um-overlay`, `.um-profile-card` and supporting elements.

### Schema
- ⚠️ `schema/user_management_rpc.sql` must be applied to demo (`pqkzffgpkpovternesmt`) and production (`wmqmonjnmgtoilxfqqkv`) before the page can render rows. Without it, `getAllProfiles()` will throw `function public.get_user_management_rows() does not exist`.
- No table-level changes. `profiles` already has `system_role`, `vendor_id (uuid)`, `full_name`, `email`, `created_at` from migrations 015 + 016 (verified against demo DB).

### Notes
- **Manual QA TODO** (Gil, after applying the RPC SQL on demo):
  1. Sign in as admin → click avatar → dropdown shows "Manage users" → click → land on `/admin/users.html` with topbar/sidebar.
  2. Confirm the row for `gil@hadarshemesh.com` shows Role=admin, vendor=— or vendor name link, Status=green/active.
  3. Insert a profile row with `system_role='vendor'` and a `vendor_id` for a known vendor → reload → confirm the vendor name renders as a blue underlined link → click it → vendor side panel opens.
  4. Click the row (not the link) for a user without `vendor_id` → small overlay card with name/email/role.
  5. Change a user's role from `vendor` to `manager` → ✓ checkmark briefly → reload page → role persists.
  6. Try to change your own role away from `admin` → select reverts and a red toast shows "You cannot demote yourself from admin."
  7. Sign in as a non-admin (manager/finance/vendor) → click avatar → confirm "Manage users" link is NOT in the dropdown. Hit `/admin/users.html` directly → redirected to `/index.html`. (And in the unlikely case the redirect is bypassed, the RPC rejects with `forbidden_admin_only`.)
- **Auto-provisioning** is still a known follow-up — without `schema/add_users_roles.sql` (or an upsert in `auth.js`), new sign-ins land on "Access pending" until an admin manually inserts a `profiles` row. Once auto-provisioning lands, the new admin user-management page is the natural place to assign roles to those auto-created rows.

---

## 2026-05-03 — Central auth gate / demo bypass removed

### Changed
- **`components/layout.js`** — full rewrite. Added `LAYOUT._runAuthGate()` at the top of `LAYOUT.init()`. Three branches: no session → full-page sign-in screen + never-resolving Promise; session + missing/role-null profile → full-page "Access pending" screen + never-resolving Promise; session + valid profile → caches `{ session, user, profile }` on `window.__hsosAuth` and continues. Both gate screens replace `document.body` so page-specific JS that runs in parallel finds no mount points. `applyRoleRestrictions()` now reads from `__hsosAuth.profile.system_role` and also hides `#role-selector` for non-admins.
- **`app.js`** — full rewrite of the role layer. `Role.get()` no longer defaults to `'Admin'`. `Role.real()` returns the real `system_role`; `Role.get()` returns the admin's preview override (sessionStorage `hsos_role_preview`) or the real role. `Role.set()` is admin-only. `renderRoleSelector()` only renders the pill bar for the real admin. `guardSpace()` becomes a no-op until `__hsosAuth` is populated, preventing premature redirects on pages that call it from their own `DOMContentLoaded` handler. `DEMO.vendor` / `showVendorPicker()` retained for workload.js compatibility — the picker is reframed as "Admin preview — view workload as this vendor" when invoked by an admin.
- **`auth.js`** — `redirectTo` now computed from `window.location.origin` (was hardcoded to the production host). Works on localhost and on Cloudways without code edits.
- **`components/user-menu.js`** — simplified. Reads cached `__hsosAuth` instead of re-fetching session/user/profile; demo "not signed in" branch removed (by the time USER_MENU runs, the user is authenticated). Dropdown now also shows the role.
- **`index.html`** — embedded `<head>` gate also fetches `getProfile(session.user.id)` and renders an inline "Access pending" card if the profile is missing or has a null role. The `auth-header` reads role from the profile, not from sessionStorage.

### Added
- **`shared.css`** — `/* ─── auth gate screens ─── */` block: `.hsos-gate`, `.hsos-gate-card`, `.hsos-gate-logo`, `.hsos-gate-title`, `.hsos-gate-sub`, `.hsos-gate-btn`, `.hsos-gate-btn-ghost`, `.hsos-gate-error`.

### Removed
- Demo-mode default role of `'Admin'` from `Role.get()`.
- Demo-mode "Sign in with Google" branch from the avatar dropdown (`USER_MENU._renderDropdown` no-session path) — gate runs first, so by the time USER_MENU initializes, the user is authenticated.
- Hardcoded `https://os.hadarshemesh.com/index.html` from `auth.js` `signInWithGoogle()`.
- Stale `sessionStorage.getItem('hsos_role')` fallback in `index.html` (replaced by `profile.system_role`).

### Schema
- No DB changes. The `schema/add_users_roles.sql` from the prior session remains NOT applied — auto-creation of `profiles` rows on first sign-in is still a follow-up.

### Notes
- **Localhost OAuth:** add `http://localhost:<port>` (or whatever local origin you serve from) to Supabase's Auth → URL Configuration → "Additional Redirect URLs" allowlist. The redirect URL is now computed at runtime, but Supabase still validates against the allowlist.
- **Cold-start race:** page-specific JS (e.g., `deals-init.js`, `payments.js`) that calls `guardSpace()` from its own `DOMContentLoaded` runs before the gate resolves. `guardSpace()` returns `true` (no-redirect) until `__hsosAuth` is populated; the gate may still replace the body, hiding any premature renders. Once the gate resolves and the user is authorized, the page's remaining init proceeds normally.

---

## 2026-05-03 — Avatar dropdown + role-switcher session gate

### Added
- `components/user-menu.js` — new module, exposes `window.USER_MENU`. On `init()` it resolves auth state once via `HSOS_AUTH.getSession() / getUser()` + `getProfile(user.id)`, then renders the avatar initials, paints the dropdown contents, and applies the role-switcher visibility gate. Click avatar (or Enter/Space) toggles the dropdown; click-outside or Esc closes. When signed in: shows name (`user_metadata.full_name || .name || email`) + email, "Sign out" button. When no session (demo): shows "Not signed in / Demo mode" + "Sign in with Google" button (calls `HSOS_AUTH.signInWithGoogle()`).
- `components/topbar.html` — wrapped `.tb-av` in a `.um-wrap` positioning container, gave the avatar `id="user-menu-avatar"`, made it a keyboard-focusable `role="button"`, and added the empty `#user-menu-dropdown` sibling.
- `shared.css` — new `/* ─── user menu (avatar dropdown) ─── */` block (`.um-wrap`, `.um-dropdown`, `.um-row`, `.um-identity`, `.um-name`, `.um-email`, `.um-divider`, `.um-btn`, `.um-btn-google`).

### Changed
- `components/layout.js` — `LAYOUT.init()` now calls `USER_MENU.init()` after `BELL.init()` (defensive: only if `window.USER_MENU` is defined). Stale "Phase 2" comment in `applyRoleRestrictions()` replaced with a pointer to `USER_MENU._applyRoleSwitcherGate()`, which is now the single source of truth for role-selector visibility.
- 15 active pages (`deals.html`, `payments.html`, `workload.html`, `overdue.html`, `reconcile.html`, `balances.html`, `products.html`, `contractors.html`, `recurring.html`, `income.html`, `vendor-profile.html`, `client-profile.html`, `activity-log.html`, `import.html`, `deal.html`) — added `<script src="auth.js">` after `cache.js` and `<script src="components/user-menu.js">` immediately before `components/layout.js`. `index.html` was already wiring `auth.js` independently and is not affected.

### Behavior
- **Avatar dropdown** is available on every page that uses `LAYOUT.init()`.
- **Role switcher visibility rule** (per task): no session → switcher shown (demo mode preserved); session + `profiles.system_role === 'admin'` → shown; session + any other role (or missing profile row) → hidden.
- Defensive: if `HSOS_AUTH` or `getProfile()` are unavailable, `USER_MENU` falls through to the no-session branch — switcher stays visible, dropdown shows the Google sign-in button (no-op without `HSOS_AUTH`).

### Notes
- `profiles` is empty in demo (0 rows), so until the auth-trigger from `schema/add_users_roles.sql` (or an equivalent `profiles` upsert on first sign-in) is wired, signed-in users with no profile row will get `system_role = null` → switcher hidden. That matches the "only admins see the switcher" intent and is the safe default.
- Display name is read from `auth.user_metadata` first (already populated by Google), not from `profiles.full_name`. Once profile auto-creation lands, this can be flipped to `profiles` first.

---

## 2026-05-03 — Google OAuth login + index.html gate

### Added
- `auth.js` — Supabase Google OAuth wrapper. Exposes `window.HSOS_AUTH` with `signInWithGoogle / signOut / getSession / getUser / onAuthStateChange / isEmailAllowed / enforceAllowedEmail`. `ALLOWED_EMAILS = ['gil@hadarshemesh.com']`; non-allowed emails get signed out immediately. Post-login `redirectTo` is hardcoded to `https://os.hadarshemesh.com/index.html` per spec.
- `login.js` (paired with `login.html`) — handles the sign-in click, surfaces `?error=` params, and redirects already-signed-in users straight to `index.html`.
- `schema/add_users_roles.sql` — `public.users` (id ↔ auth.users, email, name, role check vendor|manager|admin) + `handle_new_user()` trigger on `auth.users`. **Not applied** — overlaps with the existing `profiles` table (system_role enum) and needs reconciliation before running.

### Changed
- `login.html` — replaced the dark-theme standalone (which referenced a missing `supabase-client.js`) with a light, shared-css card matching the rest of the app. Single "Sign in with Google" button; existing-session check redirects to `index.html`; URL `?error=` surfaced inline.
- `index.html` — auth gate added in `<head>`: loads `db.js` + `auth.js`, then a `window.__hsosAuthReady` IIFE checks `getSession()` and `enforceAllowedEmail()`; missing/disallowed sessions redirect to `login.html` before body paint. Replaced the in-page "Continue with Google" button (which referenced a missing `getCurrentUser()` / `signInWithGoogle()` from a non-existent `supabase-client.js`) with an `#auth-header` strip rendering the user's name + role + a "Sign out" button. Title changed to "HSos — Home".
- `shared.css` — appended `/* === LOGIN PAGE === */` block (`.login-shell`, `.login-card`, `.login-logo`, `.login-divider`, `.login-btn-google`, `.login-error`, `.login-foot`) and `/* === AUTH HEADER ===*/` block (`.tb-auth*` classes for future topbar reuse on gated pages).

### Schema
- No DB changes applied this session.
- `schema/add_users_roles.sql` is staged for a follow-up session — the spec asks for a `public.users` table, but `public.profiles` already exists (system_role enum, FK to auth.users). Decide whether to merge or run as-is.

### Notes
- `redirectTo` is the production URL — local OAuth testing requires editing `auth.js` temporarily.
- Other gated pages (deals.html, payments.html, etc.) are NOT yet wired to the auth gate. This session only gates `index.html` per the task spec.

---

## 2026-05-02 — Open Invoices workflow page

### Added
- `overdue.html` (82 lines) — standalone Payments-space shell for the Open Invoices workflow. Cover with 4 metric cards, filter pill bar, card list root.
- `overdue.js` (304 lines) — loads deals via `getDeals({billing_status})` for overdue/pending/invoiced (3 calls merged), filters out closed/lead sales_status, sorts oldest-first. Per-card actions: Send reminder (stub toast), Mark paid (`updateDeal` + cache invalidate + optimistic remove), Open in Green Invoice (toast with `gi_client_id`/`gi_invoice_series` refs).

### Changed
- `STATUS.md` — added Open Invoices section + manual QA steps; bumped "last updated" header.

### Schema
- No DB schema changes.
- **Gaps surfaced (no fix applied):** spec assumed `clients.green_invoice_url`, `deals.invoice_number`, `deals.due_date` — none exist. Used `gi_invoice_series` for invoice refs and `created_at` for age. Real GI "open" requires either a URL pattern decision or a stored URL field.

---

## 2026-05-02 — Rules update

- Added Rule 11: schema-first verification before write operations

---

## 2026-05-02 — Account balances standalone page

### Added
- `balances.html` — standalone Payments-space account balance snapshot page.
- `balances.js` — balances tab logic promoted from `payments.js`: account/company/balance loading, transaction-net enrichment, expected closing, delta coloring, inline actual-closing edits via `upsertAccountBalance()`, and snapshot deletion via `deleteAccountBalance()`.

### Changed
- Payments sidebar `Balances` link now opens `balances.html`.
- `getAccountBalances()` detects the demo database's older `date/balance/balance_type` schema before applying year filters, avoiding a 400 on `month` when migration 006 has not been applied.
- `STATUS.md` marks balances as promoted to standalone.

### Schema
- No DB schema changes.

---

## 2026-05-02 — Reconcile workflow page (Phase 1)

### Added
- `reconcile.html` — new standalone page (Payments space). Two tabs (Deals, Bills), two-column layout (open items ↔ unmatched transactions), sticky action bar that appears once both sides have a selection. Inline `<style>` is page-local layout only; all colors via shared.css CSS vars.
- `reconcile.js` — page logic (424 lines). Auto-suggests matches on load: for each open deal/bill, finds unmatched transactions where |amount diff| < 5% AND tx date within 30d of created_at, with direction filter (deals → tx.direction='in', bills → 'out'). Manual override by clicking any pair. Search filter, three action buttons per match (Match + mark paid / Match + reconciled / Match + issue receipt via GI — third only when client has `green_invoice_client_id`). Deep-link via `?highlight=<dealId>` auto-selects + scroll-into-view.
- `db.js matchTransactionToDeal(txId, dealId, status='matched')` — sets `transactions.linked_entity_type='deal'`, `linked_entity_id=dealId`, `status`; sets `deals.billing_status='paid'`; invalidates `deal:` and `deals:` cache prefixes.
- `db.js matchTransactionToBill(txId, billId, status='matched')` — sets `transactions.linked_entity_type='paycheck'`, `linked_entity_id=billId`, `status`. (Bill `status` enum has no terminal "paid via tx" state distinct from `paid`, so we don't auto-flip it here — finance bumps it through the existing `markBillPaidV2` flow.)
- `payments.js eiMatchTx(dealId)` — redirects to `reconcile.html?highlight=<dealId>`. Wired into the Expected Income action cell: non-thrivecart rows now show a "Match" button (was "—").

### Schema
- No DB schema changes. Confirmed `transactions.linked_entity_type` / `linked_entity_id` and `clients.green_invoice_client_id` exist on demo. (Spec referred to `clients.green_invoice_id`; actual column is `green_invoice_client_id`.)

### Files touched
- new: `reconcile.html`, `reconcile.js`
- modified: `db.js` (+30 lines, two new exports in Transactions section), `payments.js` (+7 lines, eiMatchTx + EI action cell)

### Branch
- `qa-pass-2026-04-27`

---

## 2026-04-27 — Performance pass (Deal panel, Clients, Vendors)

### Added
- `cache.js`: shared client-side cache with 5-minute TTL, in-flight guard, eviction at >150 entries, and `Cache.readThrough(key, fetcher)` helper. Loaded between `db.js` and `app.js` in all 12 active HTML pages.
- `db.js getDeal(id)`: read-through cache (`deal:<id>`) with explicit-column select (drops 5 unused gateway-ref cols).
- `db.js getClients()` / `getClient(id)`: read-through cache (`clients:list`, `client:<id>`); list select drops `notes` and customer FK fields.
- `db.js getVendors()` / `getVendorsInactive()` / `getVendor(id)`: read-through cache (`vendors:list:active`, `vendors:list:inactive`, `vendor:<id>`).
- `createDeal/updateDeal/deleteDeal`, `createClient/updateClient/deleteClient`, `createVendor/updateVendor/deleteVendor`: invalidate detail key + list key after every successful write.
- `deals-kanban.js _wirePrefetchOnce()`: delegated `mouseover` listener on kanban + list containers warms `deal:<id>` cache on hover (skipped if already cached or in-flight).
- Skeleton UI: `.skeleton-shimmer` + `.skeleton-stack` + `.skeleton-row` styles in `shared.css`. Side-panel renders 5 skeleton lines instead of "Loading…" while data resolves. `renderClientsSkeleton()` and `renderVendorsSkeleton()` paint 8 placeholder rows during initial `loadData()`.
- `data-deal-id` attribute on every kanban card and deals list row, enabling delegated hover-prefetch.

### Changed
- `components/side-panel.js openPanel()`: `<div class="sp2-empty">Loading…</div>` placeholder replaced with skeleton stack.
- `deals-init.js loadData()`: paints `renderClientsSkeleton()` + `renderVendorsSkeleton()` before awaiting fetches.

### Skipped (audit findings)
- **Migration 018 (indexes)**: not needed — verified against demo DB on 2026-04-27 that `idx_clients_active`, `idx_deals_sales_status`, `idx_deals_billing_status`, `idx_vendor_hours_vendor` already exist; `vendor_hours.paycheck_id` does not exist (no FK to paychecks on that table).
- **Step 2A "parallelize sequential awaits"**: not needed — `panel-manager.js loadDealModel()`, `client-profile.js loadAll()`, and `vendor-profile.js loadAll()` already use `Promise.all`.
- **Vendor select-column trim**: every column on `vendors` is consumed somewhere (or is a generated column the code reads); no real bandwidth saving.
- **Clients list/detail "split"**: already structurally split via `getClients()` vs `getClient(id)`; refined by trimming `notes` from the list select.

### Files touched
- new: `cache.js`
- modified: `db.js`, `components/side-panel.js`, `deals-kanban.js`, `deals-clients.js`, `deals-vendors.js`, `deals-init.js`, `shared.css`
- modified (script tag insert only): `deals.html`, `client-profile.html`, `vendor-profile.html`, `products.html`, `payments.html`, `activity-log.html`, `workload.html`, `deal.html`, `import.html`, `income.html`, `contractors.html`, `recurring.html`

### Branch
- `qa-pass-2026-04-27`

---

## 2026-04-27 — Deals & Payments QA pass

### Fixed
- `components/side-panel.js`: `sales_status` enum mismatch (`proposal`, `churned` invalid) replaced with canonical DB values `lead | qualified | active | delivered | closed`. PATCH calls now succeed.

### Added
- `components/panel-editor.js`: inline-edit framework for entity side panels. Hybrid save mode (blur for text, explicit Save for money/date/relation). Toast feedback on every save.
- Deal / Vendor / Client side panels: all listed fields editable inline.
- Operations dashboard: hero cards clickable to filtered views; new Needs Attention strip with up to 8 actionable items.
- `db.js getNeedsAttentionItems()`: returns overdue bills, ready-to-pay bills, stale deals, expiring packages.
- Kanban: Full/Condensed view toggle, persisted to localStorage `hsos.kanban.cardView`.
- `?filter=` URL param parsing in `deals-init.js` (deals/vendors filters wired) and `payments.js` (bills filter parsed, TODO: apply).
- shared.css: `--gold-text` CSS variable (was referenced by `partial` billing badge but undefined).

### Changed
- Side panel width: hardcoded 420px/480px → `clamp(300px, 30vw, 500px)` via shared `--sp-width` CSS custom property.
- Side-panel + condensed Kanban status pills now use `.badge[data-status="..."]` from shared.css (single source of truth for status colors).
- Notes field on side panel now toasts on save (no longer silent).

### Branch
- Work landed on `qa-pass-2026-04-27`. Pre-session WIP captured on `main` as commit `c67b2fc` (wip: pre-QA-pass session snapshot).

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
