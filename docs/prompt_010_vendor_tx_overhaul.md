# HSos — Claude Code Task: Transactions Page + Vendor System Overhaul

## Mandatory: read before writing any code
1. RULES.md
2. SCHEMA.md
3. STATUS.md
4. CHANGELOG.md (last 80 lines)

---

## Context

Working files: `payments.html` + `payments.js`
Design system: `shared.css` (use existing CSS vars only, no new color vars)
DB layer: `db.js` (all queries go through named functions here)

---

## Part A — DB Migration (run FIRST, before any UI work)

Run `migrations/010_vendor_merchant_cadence.sql` on BOTH Supabase projects:
- Demo: pqkzffgpkpovternesmt.supabase.co
- Production: wmqmonjnmgtoilxfqqkv.supabase.co

Then also run `migrations/008_tx_drawer_dedup_audit.sql` and
`migrations/009_classification_columns.sql` on both if not yet applied
(check by running: `select column_name from information_schema.columns where table_name = 'transactions'`
and verifying `deleted_at`, `category_id`, `entity`, `tags`, `payment_cadence`, `vendor_id` exist).

After migrations: add `getVendorById(id)` and `updateVendor(id, fields)` to db.js if not present.

---

## Part B — db.js: update getTransactions select

In `db.js`, find `getTransactions()`. The select string must include `payment_cadence` and `vendor_id`.
Replace the select string with:

```js
const txSelect = 'id, transaction_date, counterparty_name, source, account_id, ' +
  'account:accounts(id, name, provider, company_id), direction, amount, currency, ' +
  'status, event_type, category_id, tax_treatment, entity, tags, payment_cadence, ' +
  'reference, external_id, exchange_rate, amount_ils, settled_date, ' +
  'deleted_at, duplicate_of, vendor_id, raw_data'
```

Remove the `category` column (raw text) — it no longer exists. Remove `import_id` fallback
logic only if `import_id` column is confirmed to exist after migration 008.

---

## Part C — Transactions Page: Layout fixes

### C1. Shrinking header on scroll

The space cover (`#space-cover` or `.space-cover`) should shrink when the user scrolls
the transactions table area. Implement with IntersectionObserver or scroll listener:

```js
// After renderTransactions() runs, attach scroll shrink
const content = document.querySelector('.app-content') // or whichever scrolls
const cover = document.querySelector('.space-cover')
if (content && cover) {
  content.addEventListener('scroll', () => {
    cover.classList.toggle('cover-shrunk', content.scrollTop > 60)
  }, { passive: true })
}
```

In shared.css, add (at the bottom, under a comment `/* Shrinking cover */`):
```css
.space-cover.cover-shrunk { padding-block: 10px; min-height: 0; transition: all .25s ease; }
.space-cover.cover-shrunk .cover-title { font-size: 16px; }
.space-cover.cover-shrunk .alert-bar { display: none; }
```

### C2. Reduce alert cards to 3 max on Transactions tab

In `updateAlertBarTx()` (or wherever transaction metric cards are built), keep only:
1. Total transactions (count)
2. Unclassified (needs_review count)
3. Total out this month (sum of direction='out')

Remove any other cards. Keep the HTML structure but reduce the rendered cards.

### C3. Pagination — move to bottom

The pagination bar (`#tx-pagination`) currently renders above or within the table block.
Move it to render AFTER the table block, outside the scrollable table container.
In `renderTxPagination()`, find where `el` is inserted and change to:

```js
const tableBlock = document.querySelector('#tab-transactions .block') // or similar
if (tableBlock) tableBlock.after(el)
```

---

## Part D — Vendor badge (vendor_type pill)

Every place a vendor name appears, add a small type badge next to it.

Add this helper to payments.js:

```js
function vendorTypeBadge(type) {
  const map = {
    coach:       ['Coach',       'var(--green-bg)',  'var(--green-text)'],
    contractor:  ['Contractor',  'var(--blue-bg)',   'var(--blue-text)'],
    team_member: ['Team',        'var(--amber-bg)',  'var(--amber-text)'],
    merchant:    ['Merchant',    'var(--border)',    'var(--mu)'],
  }
  const [label, bg, color] = map[type] || ['—', 'var(--border)', 'var(--mu)']
  return `<span class="vendor-type-badge" style="background:${bg};color:${color}">${label}</span>`
}
```

Add to shared.css:
```css
.vendor-type-badge {
  display: inline-block; padding: 1px 6px; border-radius: 4px;
  font-size: 10px; font-weight: 600; letter-spacing: .02em;
  vertical-align: middle; margin-left: 4px;
}
```

Apply in:
- `renderTransactions()` rows → vendor cell: `${vn}${vendorTypeBadge(knownVendor.vendor_type)}`
- `renderVMVendors()` rows → name cell
- Vendor Quick Panel title area

---

## Part E — Vendor Quick Panel: full rebuild

The existing `openVendorQuickPanel()` function needs a full rewrite.
Replace it entirely with the spec below.

### Panel behavior
- Opens on click of vendor name in transaction row
- Closes ONLY via the X button (not on outside click)
- Stays open while editing dropdowns/pickers inside
- Position: anchored near clicked element (existing positioning logic is fine)

### Panel content — two states

**State A: Known vendor** (tx.vendor_id is set)

```html
<div class="vqp">
  <button class="vqp-close" onclick="closeVendorQuickPanel()">×</button>
  <div class="vqp-header">
    <div class="vqp-name">{vendor name}</div>
    {vendorTypeBadge(vendor.vendor_type)}
  </div>

  <!-- Editable fields (inline, same pattern as tx table inline editors) -->
  <div class="vqp-field">
    <label>Category</label>
    <!-- category inline picker (reuse existing vqpOpenCat logic) -->
  </div>
  <div class="vqp-field">
    <label>Tax</label>
    <!-- tax inline picker -->
  </div>
  <div class="vqp-field">
    <label>B/P</label>
    <!-- BP toggle pill -->
  </div>
  <div class="vqp-field">
    <label>Tags</label>
    <!-- tag chips + input -->
  </div>
  <div class="vqp-field">
    <label>Vendor Type</label>
    <select id="vqp-type-sel">
      <option value="coach">Coach</option>
      <option value="contractor">Contractor</option>
      <option value="team_member">Team Member</option>
      <option value="merchant">Merchant</option>
    </select>
  </div>
  <div class="vqp-field">
    <label>Purchase type</label>
    <select id="vqp-cadence-sel">
      <option value="">—</option>
      <option value="recurring">Recurring</option>
      <option value="project_based">Project-based</option>
      <option value="one_time">One-time</option>
    </select>
  </div>

  <!-- Actions -->
  <div class="vqp-actions">
    <button class="btn btn-sm btn-primary" onclick="vqpSaveVendor('{vendorId}','{txId}')">
      Save + Apply to this transaction
    </button>
    <button class="btn btn-sm" onclick="vqpOpenSidebar('{vendorId}')">
      More ›
    </button>
  </div>

  <div class="vqp-note">
    Saving updates this vendor's defaults and applies classification to all future matches.
  </div>
</div>
```

**State B: Unknown vendor** (tx.vendor_id is null — new merchant)

Same editable fields as above, plus:
- Input for canonical vendor name (pre-filled with counterparty_name)
- Two action buttons:
  - **"Save as New Vendor"** → inserts vendor row, assigns to this transaction, applies to all future matching counterparty_name
  - **"Add to Existing"** → opens sidebar with search to merge into existing vendor (sets alias)

### vqpSaveVendor(vendorId, txId) logic

```js
async function vqpSaveVendor(vendorId, txId) {
  const fields = {
    category_id:     _vqpState.catId || null,
    tax_treatment:   _vqpState.tax || null,
    entity:          _vqpState.entity || null,
    tags:            _vqpState.tags || [],
    vendor_type:     document.getElementById('vqp-type-sel')?.value || null,
    payment_cadence: document.getElementById('vqp-cadence-sel')?.value || null,
  }

  // 1. Save vendor defaults
  await window._sb.from('vendors').update(fields).eq('id', vendorId)

  // 2. Apply classification to current transaction
  await window._sb.from('transactions').update({
    category_id:     fields.category_id,
    tax_treatment:   fields.tax_treatment,
    entity:          fields.entity,
    tags:            fields.tags,
    payment_cadence: fields.payment_cadence,
    vendor_id:       vendorId,
  }).eq('id', txId)

  showToast('Vendor saved + classification applied', 'info')
  closeVendorQuickPanel()
  await loadTransactions()
}
```

### vqpOpenSidebar(vendorId) logic

Opens the transaction drawer (existing sidebar) with a "vendor" tab pre-selected,
OR switches to the Vendor Manager tab and scrolls to that vendor row.
Use whichever pattern already exists in the codebase.

---

## Part F — _vqpState and panel lifecycle

Panel local state object (attach to panel element or module-level):
```js
let _vqpState = { catId: '', tax: '', entity: '', tags: [], vendorId: null, txId: null }
```

**Remove** the outside-click close listener. The panel must only close via X button.

---

## Part G — Vendor Manager tab: add payment_cadence column

In `renderVMVendors()`, add a "Cadence" column after the Type column:

```js
// In table header:
<th>Cadence</th>

// In each vendor row:
<td>
  <select class="vm-cadence-sel" data-vid="${v.id}" onchange="vmSaveCadence(this)">
    <option value="">—</option>
    <option value="recurring" ${v.payment_cadence==='recurring'?'selected':''}>Recurring</option>
    <option value="project_based" ${v.payment_cadence==='project_based'?'selected':''}>Project-based</option>
    <option value="one_time" ${v.payment_cadence==='one_time'?'selected':''}>One-time</option>
  </select>
</td>
```

Add `vmSaveCadence(sel)`:
```js
async function vmSaveCadence(sel) {
  const vid = sel.dataset.vid
  await window._sb.from('vendors').update({ payment_cadence: sel.value }).eq('id', vid)
  showToast('Saved', 'info')
}
```

---

## Part H — team_member financial visibility (role gate)

In any function that renders vendor bills, paychecks, or transactions linked to a
`team_member` vendor, add a role check:

```js
function canSeeTeamFinancials() {
  const role = window.Role?.get() || sessionStorage.getItem('hsos_role') || 'admin'
  return ['admin', 'finance'].includes(role)
}
```

In `renderTransactions()`, filter out rows where `tx.vendor?.vendor_type === 'team_member'`
when `!canSeeTeamFinancials()`.

In vendor bills / paychecks render functions, wrap team_member rows with:
```js
if (v.vendor_type === 'team_member' && !canSeeTeamFinancials()) continue
```

---

## Part I — After all changes

1. Update `STATUS.md`:
   - Mark migration 010 as run (after you run it)
   - Update DB schema state — add `payment_cadence`, `vendor_id` to transactions columns list
   - Update immediate next steps

2. Add entry to `CHANGELOG.md`:
   ```
   ## [2026-04-14] Vendor model + Transactions UI overhaul
   - Migration 010: merchant vendor_type, payment_cadence on vendors + transactions
   - Vendor quick panel rebuilt: editable fields, X-only close, type + cadence selects
   - Vendor type badge added across all vendor displays
   - Transactions layout: shrinking cover on scroll, pagination moved to bottom, 3 metric cards
   - team_member financial data gated to admin/finance roles
   - Vendor Manager: cadence column added
   ```

3. Update `SCHEMA.md` migration log: mark 010 as ✅ Both envs (after running)
