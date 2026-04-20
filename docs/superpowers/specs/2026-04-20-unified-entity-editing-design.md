# Unified Entity Editing System — Design Spec
_Date: 2026-04-20_

## Overview

Replace all scattered edit modals and redirect flows with a single, consistent inline-edit pattern inside the existing `PanelManager` right-side panel. Every entity — vendor, client, deal, package, product, plan, transaction — is read, edited, and navigated from the same panel. No new design system; reuse all existing CSS patterns.

---

## 1. State Model

Two additions to the existing `state` object in `panel-manager.js`:

```js
state.editing = false   // true when any field in the current entry has been modified
state.edits   = {}      // { fieldKey: newValue } — only dirty fields, committed on Save
```

**Edit mode enters** the first time a user modifies a field (`state.edits` becomes non-empty → `state.editing = true`).

**Edit mode exits** on Save (success), Discard, or hard close (✕ with no dirty state).

**Save flow:**
1. Collect `state.edits`
2. Call the appropriate `update*()` function from `db.js`
3. Re-fetch the entity model
4. Re-render the panel body
5. Reset `state.editing = false`, `state.edits = {}`

**Error flow:** Save button re-enables; a red inline error line appears below the panel header. No toast, no modal.

**Dirty-navigation guard:** If `state.edits` is non-empty and the user tries to close, press Esc, click the overlay, or navigate via breadcrumb — show an inline warning bar inside the panel:

```
⚠ Unsaved changes   [Discard]  [Keep editing]
```

No `window.confirm()`. Discard clears `state.edits` and proceeds. Keep editing dismisses the bar.

---

## 2. Field Rendering & Edit Interaction

Entity render functions produce field rows with a consistent structure:

**Read mode:**
```html
<div class="ep-field" data-field="full_name">
  <span class="ep-field-label">Name</span>
  <span class="ep-field-value editable">Christine Yee</span>
</div>
```

Hover on `.ep-field-value.editable` shows edit cursor (copy `.cl-cell:hover` pattern from `payments.html`).

**Edit mode** — clicking an editable value swaps the span to an input in place:
```html
<span class="ep-field-value editing">
  <input type="text" value="Christine Yee" data-field="full_name">
</span>
```

Every `input`/`change` event writes to `state.edits[fieldKey]`.

**Input types by field:**

| Field type | Input |
|---|---|
| Text / email / phone / URL | `<input type="text">` |
| Long text / notes | `<textarea>` |
| Enum (status, type, currency) | `<select>` with hardcoded options |
| FK relation (client, vendor, product) | Searchable inline dropdown — filtered `<input>` + results list, copy `.cl-dropdown` pattern from `payments.html` |
| Tags | Multi-value pill input — copy existing vendor tags pattern in `panel-manager.js` |
| Boolean (active) | Toggle, copy status badge click pattern |
| Numeric | `<input type="number">` |
| Conditional numeric | Rendered only when parent field matches condition (see Plan below) |

**Transaction fields:** Copy the existing `.cl-cell` inline classification pattern exactly. No structural changes to that flow.

---

## 3. Save Button & Header Bar

The Save button lives in the panel header row — same line as breadcrumbs and ✕:

```
[← Vendors]  Christine Yee          [Save]  [✕]
```

- Uses existing `.btn .btn-primary .btn-sm` classes
- Hidden when `state.edits` is empty
- While saving: text = "Saving…", disabled
- On success: disappears, panel re-renders with fresh DB data
- On error: re-enables, inline red error line below header

---

## 4. Entity Field Map

### Vendor
`full_name`, `email`, `phone`, `vendor_type`, `payout_currency`, `is_active`, `notes`, `category_id`, `tax_treatment`, `entity`, `tags`

### Client
`full_name`, `email`, `phone`, `client_kind`, `company`, `source`, `notes`, `active`

### Deal
`client_id` (FK picker), `primary_vendor_id` (FK picker), `product_id` (FK picker), `price`, `currency`, `vat_pct`, `vat_mode`, `discount`, `sales_status`, `billing_status`, `payment_processor`, `payment_link`, `notes`

### Package
`sales_status`, `billing_status`, `notes`
All other package fields (`vendor_id`, `plan_id`, `client_id`, session counts) are read-only — they are derived from the deal and are not edited directly.

### Product
`name`, `description`, `category`, `status`, `price_min`, `price_max`, `currency`, `links` (jsonb — editable as a list of `{label, url}` rows with inline add/remove)

### Plan
`name`, `plan_type`, `amount`, `currency`, `status`, `description`, `link_source`, `link_url`, `installments_count` (numeric — shown only when `plan_type` indicates an installment plan, e.g. "3 payments")

### Transaction
`category_id`, `tax_treatment`, `entity`, `tags` — copy existing inline classification pattern exactly. All other fields read-only.

---

## 5. New Panel Manager Entities

Product and plan are not currently handled by `panel-manager.js`. Add:

- `loadProductModel(id)` — fetches product + its plans
- `loadPlanModel(id)` — fetches plan + parent product (for breadcrumb); opening a plan directly pushes `product → plan` onto the stack so back navigates to the product panel
- Render functions for both, following the same pattern as `renderVendorPanel` / `renderDealPanel`
- `PanelManager.open('product', id)` and `PanelManager.open('plan', id)` as new entry points

---

## 6. Modal Migration

All existing edit modals are removed and replaced by panel-manager entry points.

### Removed
| Modal / function | File | Replacement |
|---|---|---|
| `#modal-edit-deal` | deals.html | `PanelManager.open('deal', id)` |
| `openEditDeal()`, `saveEditDeal()`, `_renderEditDealModal()` | deals.js | deleted |
| `#modal-product`, `#modal-plan` | deals.html | `PanelManager.open('product', id)` / `PanelManager.open('plan', id)` |
| Product/plan modal functions | deals.js | deleted |
| Vendor edit overlay | vendor-profile.html | `PanelManager.open('vendor', id)` |
| `openVendorEditModal()`, `saveVendorEditModal()` | vendor-profile.js | deleted |

### Entry Points Rewired
- "Edit" button in deals list/kanban → `PanelManager.open('deal', id)`
- Product/plan row clicks (deals.html products tab) → `PanelManager.open('product', id)` / `PanelManager.open('plan', id)`
- Vendor edit icon in vendor-profile.html → `PanelManager.open('vendor', id)`
- Coach/vendor card click in index.html → `PanelManager.open('vendor', id)`

### Kept As-Is
- Add-client slide-in panel (creation flow, not editing)
- Add-vendor slide-in panel (creation flow, not editing)
- Transaction inline classification in payments.html (already correct)

---

## 7. Permissions

- Vendor role cannot edit client fields from Workload — existing role check logic applies; editable fields render as non-editable (`.ep-field-value` without `.editable` class) for restricted roles
- Manager/Admin roles get full edit access across all entities

---

## 8. No Schema Changes Required

All editable fields map to existing columns. The only column to confirm is `installments_count` on `plans` — confirmed present in `hsos-schema.sql` line 323.
