# Unified Entity Editing System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline field editing to every entity panel in `panel-manager.js` so clicking a value opens an input, a Save button appears when dirty, and all existing separate edit modals are removed.

**Architecture:** All edit state (`state.editing`, `state.edits`) lives inside the existing `panel-manager.js` IIFE. Each entity render function is extended to emit `.editable` fields. A shared event delegation layer catches field clicks and wires inputs. Two new entity types (product, plan) are added to the panel, and all existing modal-based edit flows in `deals.js`, `deals.html`, and `vendor-profile.*` are replaced with `PanelManager.open()` calls.

**Tech Stack:** Vanilla JS (ES2020), inline HTML strings, Supabase via `global.*` db functions from `db.js`, existing CSS classes from `shared.css`.

---

## File Map

| File | Change |
|------|--------|
| `panel-manager.js` | Edit state, field click handler, save/discard flow, product+plan loaders + renderers, remove old vendor Edit-button redirect |
| `shared.css` | Add `.ep-field`, `.ep-field-value.editable`, `.ep-field-value.editing`, `.pm-save-btn`, `.pm-dirty-bar`, `.pm-fk-picker` styles |
| `deals.js` | Remove `openEditDeal`/`saveEditDeal`/`_renderEditDealModal`, product/plan modal functions; rewire callers to `PanelManager.open()` |
| `deals.html` | Remove `#modal-edit-deal`, `#modal-product`, `#modal-plan` HTML blocks |
| `vendor-profile.js` | Remove `openVendorEditModal`, `saveVendorEditModal`; rewire edit icon to `PanelManager.open('vendor', id)` |
| `vendor-profile.html` | Remove vendor edit overlay HTML |
| `db.js` | Add `getProduct(id)` and `getPlan(id)` single-record fetch functions |

---

## Task 1: CSS — editable field styles

**Files:**
- Modify: `shared.css` (append at end of file)

- [ ] **Step 1: Add styles**

Append to the bottom of `shared.css`:

```css
/* Panel entity editable fields */
.ep-field { display: contents; }

.ep-field-value.editable { cursor: pointer; }
.ep-field-value.editable:hover { background: var(--bg); border-radius: 3px; }

.ep-field-value.editing input,
.ep-field-value.editing select,
.ep-field-value.editing textarea {
  width: 100%;
  border: 1px solid var(--blue, #3b82f6);
  border-radius: var(--r);
  padding: 4px 8px;
  font-size: 13px;
  font-family: var(--font-sans);
  background: var(--surface);
  color: var(--ink);
  outline: none;
}
.ep-field-value.editing textarea { resize: vertical; min-height: 60px; }

/* Save button in panel header */
.pm-save-btn {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: var(--r);
  background: var(--ink);
  color: var(--surface);
  border: none;
  cursor: pointer;
  white-space: nowrap;
}
.pm-save-btn:disabled { opacity: .5; cursor: default; }

/* Dirty nav-guard bar */
.pm-dirty-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--yellow-bg, #fef9c3);
  border-bottom: 1px solid var(--yellow, #ca8a04);
  font-size: 12px;
  color: var(--ink);
}
.pm-dirty-bar button { font-size: 12px; padding: 2px 8px; }

/* FK searchable dropdown */
.pm-fk-picker {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 300;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  min-width: 220px;
  max-height: 240px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 12px rgba(0,0,0,.1);
}
.pm-fk-picker input {
  border: none;
  border-bottom: 1px solid var(--border);
  padding: 7px 10px;
  font-family: var(--font-sans);
  font-size: 12px;
  outline: none;
}
.pm-fk-picker-list { overflow-y: auto; flex: 1; }
.pm-fk-picker-item {
  padding: 7px 10px;
  font-size: 12px;
  cursor: pointer;
}
.pm-fk-picker-item:hover { background: var(--bg); }
.pm-fk-picker-item.selected { font-weight: 600; }
```

- [ ] **Step 2: Verify no regressions**

Open any page that uses the panel, open a vendor panel — no visual regressions. The new classes have no effect yet.

- [ ] **Step 3: Commit**

```bash
git add shared.css
git commit -m "style: add panel editable field and save button styles"
```

---

## Task 2: Edit state in panel-manager.js

**Files:**
- Modify: `panel-manager.js` lines 4–9 (state object), `closePanel` (~line 1093), breadcrumb handler (~line 108)

- [ ] **Step 1: Extend `state` with editing fields**

Replace the `state` object (lines 5–9):

```js
  const state = {
    stack: [],
    token: 0,
    open: false,
    editing: false,
    edits: {},
  }
```

- [ ] **Step 2: Add `resetEditState` and `showDirtyBar` helpers**

Add immediately after the `state` declaration:

```js
  function resetEditState() {
    state.editing = false
    state.edits = {}
  }

  function showDirtyBar(onDiscard) {
    if (!els.body) return
    const existing = els.body.querySelector('.pm-dirty-bar')
    if (existing) return
    const bar = document.createElement('div')
    bar.className = 'pm-dirty-bar'
    const discardBtn = document.createElement('button')
    discardBtn.className = 'btn btn-sm'
    discardBtn.textContent = 'Discard'
    const keepBtn = document.createElement('button')
    keepBtn.className = 'btn btn-sm btn-ghost'
    keepBtn.textContent = 'Keep editing'
    const label = document.createElement('span')
    label.textContent = '\u26A0 Unsaved changes'
    bar.appendChild(label)
    bar.appendChild(discardBtn)
    bar.appendChild(keepBtn)
    discardBtn.addEventListener('click', () => { bar.remove(); onDiscard() })
    keepBtn.addEventListener('click', () => bar.remove())
    els.body.prepend(bar)
  }
```

- [ ] **Step 3: Call `resetEditState()` in `closePanel`**

In `closePanel` (~line 1093), add as first line of function body:

```js
  function closePanel(opts = {}) {
    if (!state.open && !els.panel) return
    resetEditState()
    closeVendorClassificationEditor({ commit: false })
    // ... rest unchanged
```

- [ ] **Step 4: Guard breadcrumb navigation with dirty check**

In `initDom`, replace the breadcrumb click handler (~lines 108–116):

```js
    panel.addEventListener('click', e => {
      const crumbBtn = e.target.closest('[data-pm-crumb-index]')
      if (!crumbBtn) return
      e.preventDefault()
      const idx = Number(crumbBtn.getAttribute('data-pm-crumb-index'))
      if (!Number.isInteger(idx) || idx < 0 || idx >= state.stack.length - 1) return
      if (Object.keys(state.edits).length) {
        showDirtyBar(() => {
          resetEditState()
          state.stack = state.stack.slice(0, idx + 1)
          renderCurrent()
        })
        return
      }
      resetEditState()
      state.stack = state.stack.slice(0, idx + 1)
      renderCurrent()
    })
```

Also guard the Esc key handler (~line 118–120):

```js
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.open) {
        if (Object.keys(state.edits).length) {
          showDirtyBar(() => { resetEditState(); closePanel() })
          return
        }
        closePanel()
      }
    })
```

Also guard the overlay click (~line 105):

```js
    overlay.addEventListener('click', () => {
      if (Object.keys(state.edits).length) {
        showDirtyBar(() => { resetEditState(); closePanel() })
        return
      }
      closePanel()
    })
```

- [ ] **Step 5: Commit**

```bash
git add panel-manager.js
git commit -m "feat(panel): add edit state, resetEditState, showDirtyBar, dirty guards"
```

---

## Task 3: Save button in panel header

**Files:**
- Modify: `panel-manager.js` — `initDom` HTML template, `els` object, `renderBreadcrumbs`

- [ ] **Step 1: Add `saveBtn` to the `els` object**

Replace the `els` object (lines 27–34):

```js
  const els = {
    overlay: null,
    panel: null,
    crumbs: null,
    entityHead: null,
    body: null,
    fullLink: null,
    saveBtn: null,
  }
```

- [ ] **Step 2: Add save button placeholder in panel HTML**

In `initDom`, update the `panel-manager-head-actions` div (around line 85–88):

```js
        <div class="panel-manager-head-actions">
          <button class="pm-save-btn" id="pm-save-btn" style="display:none">Save</button>
          <a class="panel-manager-full" id="panel-manager-full" data-allow-navigation="true" href="#">Open full profile \u2192</a>
          <button class="panel-manager-close" id="panel-manager-close" aria-label="Close">\u00d7</button>
        </div>
```

- [ ] **Step 3: Cache save button and wire click in `initDom`**

After `els.fullLink = panel.querySelector('#panel-manager-full')` (~line 103):

```js
    els.saveBtn = panel.querySelector('#pm-save-btn')
    els.saveBtn.addEventListener('click', async () => {
      const entry = currentEntry()
      if (!entry || !Object.keys(state.edits).length) return
      await commitEdits(entry)
    })
```

- [ ] **Step 4: Add `updateSaveBtn`, `commitEdits`, `showSaveError`, `removeSaveError` functions**

Add these functions after `showDirtyBar`:

```js
  function updateSaveBtn() {
    if (!els.saveBtn) return
    const dirty = Object.keys(state.edits).length > 0
    els.saveBtn.style.display = dirty ? '' : 'none'
  }

  async function commitEdits(entry) {
    if (!els.saveBtn) return
    els.saveBtn.disabled = true
    els.saveBtn.textContent = 'Saving\u2026'
    removeSaveError()
    try {
      const fields = { ...state.edits }
      if (entry.type === 'vendor') {
        if (typeof global.updateVendor !== 'function') throw new Error('updateVendor() not available')
        if ('is_active' in fields) fields.is_active = fields.is_active === 'true'
        await global.updateVendor(entry.id, fields)
      } else if (entry.type === 'client') {
        if (typeof global.updateClient !== 'function') throw new Error('updateClient() not available')
        if ('active' in fields) fields.active = fields.active === 'true'
        await global.updateClient(entry.id, fields)
      } else if (entry.type === 'deal') {
        if (typeof global.updateDeal !== 'function') throw new Error('updateDeal() not available')
        await global.updateDeal(entry.id, fields)
      } else if (entry.type === 'package') {
        if (typeof global.updatePackage !== 'function') throw new Error('updatePackage() not available')
        await global.updatePackage(entry.id, fields)
      } else if (entry.type === 'product') {
        if (typeof global.updateProductFull !== 'function') throw new Error('updateProductFull() not available')
        await global.updateProductFull(entry.id, fields)
      } else if (entry.type === 'plan') {
        if (typeof global.updatePlanFull !== 'function') throw new Error('updatePlanFull() not available')
        await global.updatePlanFull(entry.id, fields)
      } else {
        throw new Error('No save handler for type: ' + entry.type)
      }
      resetEditState()
      updateSaveBtn()
      await renderCurrent()
    } catch (err) {
      showSaveError(err && err.message ? err.message : 'Save failed')
    } finally {
      if (els.saveBtn) {
        els.saveBtn.disabled = false
        els.saveBtn.textContent = 'Save'
      }
    }
  }

  function showSaveError(msg) {
    removeSaveError()
    if (!els.body) return
    const el = document.createElement('div')
    el.id = 'pm-save-error'
    el.style.cssText = 'padding:6px 12px;font-size:12px;color:var(--red-text,#dc2626);background:var(--red-bg,#fef2f2);border-bottom:1px solid var(--red,#dc2626)'
    el.textContent = msg
    els.body.prepend(el)
  }

  function removeSaveError() {
    const el = document.getElementById('pm-save-error')
    if (el) el.remove()
  }
```

- [ ] **Step 5: Commit**

```bash
git add panel-manager.js
git commit -m "feat(panel): add save button, commitEdits, save error display"
```

---

## Task 4: Field click interaction — inline input activation

**Files:**
- Modify: `panel-manager.js` — add field click delegation and `activateFieldEdit` in `initDom`

- [ ] **Step 1: Add `activateFieldEdit` function**

Add after `removeSaveError`:

```js
  function activateFieldEdit(fieldEl, fieldKey) {
    if (fieldEl.querySelector('.ep-field-value.editing')) return
    const valueEl = fieldEl.querySelector('.ep-field-value')
    if (!valueEl) return

    const currentVal = state.edits[fieldKey] !== undefined
      ? state.edits[fieldKey]
      : (fieldEl.getAttribute('data-current') !== null ? fieldEl.getAttribute('data-current') : valueEl.textContent.trim())

    const inputType = fieldEl.getAttribute('data-input-type') || 'text'
    const options = fieldEl.getAttribute('data-options')

    valueEl.classList.remove('editable')
    valueEl.classList.add('editing')

    let input
    if (inputType === 'textarea') {
      input = document.createElement('textarea')
      input.setAttribute('data-field', fieldKey)
      input.value = currentVal || ''
    } else if (inputType === 'select' && options) {
      const opts = JSON.parse(options)
      input = document.createElement('select')
      input.setAttribute('data-field', fieldKey)
      opts.forEach(o => {
        const val = typeof o === 'string' ? o : o.value
        const label = typeof o === 'string' ? o : (o.label || o.value)
        const opt = document.createElement('option')
        opt.value = val
        opt.textContent = label
        if (val === String(currentVal || '')) opt.selected = true
        input.appendChild(opt)
      })
    } else if (inputType === 'number') {
      input = document.createElement('input')
      input.type = 'number'
      input.setAttribute('data-field', fieldKey)
      input.value = currentVal !== null && currentVal !== undefined ? currentVal : ''
    } else {
      input = document.createElement('input')
      input.type = 'text'
      input.setAttribute('data-field', fieldKey)
      input.value = currentVal !== null && currentVal !== undefined ? currentVal : ''
    }

    valueEl.textContent = ''
    valueEl.appendChild(input)
    input.focus()
    if (input.select) input.select()

    const onChange = () => {
      state.edits[fieldKey] = input.value
      state.editing = true
      updateSaveBtn()
    }
    input.addEventListener('input', onChange)
    input.addEventListener('change', onChange)
  }
```

- [ ] **Step 2: Add field click delegation in `initDom`**

After the existing `[data-panel-type][data-panel-id]` click handler (after line 129), add:

```js
    panel.addEventListener('click', e => {
      const valueEl = e.target.closest('.ep-field-value.editable')
      if (!valueEl) return
      const fieldEl = valueEl.closest('[data-field]')
      if (!fieldEl) return
      const fieldKey = fieldEl.getAttribute('data-field')
      if (!fieldKey) return
      const inputType = fieldEl.getAttribute('data-input-type') || 'text'
      if (inputType === 'fk') {
        const currentId = state.edits[fieldKey] !== undefined
          ? state.edits[fieldKey]
          : (fieldEl.getAttribute('data-current') || '')
        let items = []
        try { items = JSON.parse(fieldEl.getAttribute('data-fk-items') || '[]') } catch(_) {}
        const fkType = fieldEl.getAttribute('data-fk-type') || ''
        openFkPicker(valueEl, fieldKey, items, currentId, (id, label) => {
          state.edits[fieldKey] = id
          state.editing = true
          updateSaveBtn()
          valueEl.innerHTML = ''
          if (id && label) {
            const btn = document.createElement('button')
            btn.className = 'ep-link'
            btn.setAttribute('data-panel-type', fkType)
            btn.setAttribute('data-panel-id', id)
            btn.textContent = label
            valueEl.appendChild(btn)
          } else {
            const span = document.createElement('span')
            span.className = 'ep-muted'
            span.textContent = '\u2014'
            valueEl.appendChild(span)
          }
          valueEl.classList.remove('editing')
        })
        return
      }
      activateFieldEdit(fieldEl, fieldKey)
    })
```

- [ ] **Step 3: Commit**

```bash
git add panel-manager.js
git commit -m "feat(panel): field click activates inline input editing"
```

---

## Task 5: FK relation picker

**Files:**
- Modify: `panel-manager.js` — add `openFkPicker`, `closeFkPicker`, outside-click handler

- [ ] **Step 1: Add `openFkPicker` and `closeFkPicker`**

Add after `activateFieldEdit`:

```js
  function openFkPicker(anchorEl, fieldKey, items, currentId, onSelect) {
    closeFkPicker()
    const picker = document.createElement('div')
    picker.className = 'pm-fk-picker'
    picker.id = 'pm-fk-picker'

    const searchInput = document.createElement('input')
    searchInput.placeholder = 'Search\u2026'
    searchInput.autocomplete = 'off'

    const list = document.createElement('div')
    list.className = 'pm-fk-picker-list'

    const renderList = filter => {
      const lower = (filter || '').toLowerCase()
      const filtered = lower ? items.filter(it => (it.label || '').toLowerCase().includes(lower)) : items
      list.textContent = ''
      if (!filtered.length) {
        const empty = document.createElement('div')
        empty.className = 'pm-fk-picker-item'
        empty.style.color = 'var(--mu)'
        empty.textContent = 'No results'
        list.appendChild(empty)
        return
      }
      filtered.forEach(it => {
        const item = document.createElement('div')
        item.className = 'pm-fk-picker-item' + (it.id === currentId ? ' selected' : '')
        item.setAttribute('data-fk-id', it.id)
        item.setAttribute('data-fk-label', it.label)
        item.textContent = it.label
        list.appendChild(item)
      })
    }

    searchInput.addEventListener('input', () => renderList(searchInput.value))
    list.addEventListener('click', e => {
      const item = e.target.closest('.pm-fk-picker-item[data-fk-id]')
      if (!item) return
      onSelect(item.getAttribute('data-fk-id'), item.getAttribute('data-fk-label'))
      closeFkPicker()
    })

    picker.appendChild(searchInput)
    picker.appendChild(list)
    renderList('')

    anchorEl.style.position = 'relative'
    anchorEl.appendChild(picker)
    searchInput.focus()
  }

  function closeFkPicker() {
    const el = document.getElementById('pm-fk-picker')
    if (el) el.remove()
  }
```

- [ ] **Step 2: Wire outside-click to close picker**

In `initDom`, after the field click handler added in Task 4:

```js
    document.addEventListener('mousedown', e => {
      const picker = document.getElementById('pm-fk-picker')
      if (!picker) return
      if (!picker.contains(e.target)) closeFkPicker()
    })
```

- [ ] **Step 3: Commit**

```bash
git add panel-manager.js
git commit -m "feat(panel): add FK searchable picker"
```

---

## Task 6: Helper functions `editableField` and `editableFkField`

**Files:**
- Modify: `panel-manager.js` — add two helper functions after `renderPackageBody`

These helpers produce the HTML for editable rows used in `.ep-kv` grids.

- [ ] **Step 1: Add helper functions**

Add after `renderPackageBody` (around line 617):

```js
  function editableField(label, fieldKey, value, inputType, options) {
    const optionsAttr = options ? ' data-options=\'' + JSON.stringify(options) + '\'' : ''
    const displayVal = (value !== null && value !== undefined && value !== '')
      ? esc(String(value))
      : '<span class="ep-muted">\u2014</span>'
    return '<div class="ep-k">' + esc(label) + '</div>' +
      '<div class="ep-v">' +
        '<div class="ep-field" data-field="' + esc(fieldKey) + '" data-input-type="' + esc(inputType || 'text') + '" data-current="' + esc(value !== null && value !== undefined ? String(value) : '') + '"' + optionsAttr + '>' +
          '<span class="ep-field-value editable">' + displayVal + '</span>' +
        '</div>' +
      '</div>'
  }

  function editableFkField(label, fieldKey, entityType, entityId, entityLabel, fkItems) {
    const itemsAttr = ' data-fk-items=\'' + JSON.stringify(fkItems || []) + '\''
    let displayVal
    if (entityId) {
      displayVal = '<button class="ep-link" data-panel-type="' + esc(entityType) + '" data-panel-id="' + esc(entityId) + '">' + esc(entityLabel || '\u2014') + '</button>'
    } else {
      displayVal = '<span class="ep-muted">\u2014</span>'
    }
    return '<div class="ep-k">' + esc(label) + '</div>' +
      '<div class="ep-v">' +
        '<div class="ep-field" data-field="' + esc(fieldKey) + '" data-input-type="fk" data-fk-type="' + esc(entityType) + '" data-current="' + esc(entityId || '') + '"' + itemsAttr + '>' +
          '<span class="ep-field-value editable">' + displayVal + '</span>' +
        '</div>' +
      '</div>'
  }
```

- [ ] **Step 2: Commit**

```bash
git add panel-manager.js
git commit -m "feat(panel): add editableField and editableFkField helpers"
```

---

## Task 7: Rewrite `renderDealBody` with editable fields

**Files:**
- Modify: `panel-manager.js` — `loadDealModel` (~line 292), `renderDealBody` (~line 355)

- [ ] **Step 1: Extend `loadDealModel` to fetch FK options**

Replace `loadDealModel` (~line 292–298):

```js
  async function loadDealModel(id) {
    const [deal, packages, clients, vendors, products] = await Promise.all([
      global.getDeal(id),
      typeof global.getPackages === 'function' ? global.getPackages({ deal_id: id }) : Promise.resolve([]),
      typeof global.getClients === 'function' ? global.getClients().catch(() => []) : Promise.resolve([]),
      typeof global.getVendors === 'function' ? global.getVendors().catch(() => []) : Promise.resolve([]),
      typeof global.getProducts === 'function' ? global.getProducts().catch(() => []) : Promise.resolve([]),
    ])
    return {
      deal,
      packages: packages || [],
      clientOptions: (clients || []).map(c => ({ id: c.id, label: c.full_name || c.id })),
      vendorOptions: (vendors || []).map(v => ({ id: v.id, label: v.full_name || v.name || v.id })),
      productOptions: (products || []).map(p => ({ id: p.id, label: p.name || p.id })),
    }
  }
```

- [ ] **Step 2: Rewrite `renderDealBody`**

Replace the entire `renderDealBody` function (~lines 355–427):

```js
  function renderDealBody(model) {
    const deal = model && model.deal ? model.deal : {}
    const packages = model && model.packages ? model.packages : []
    const client = deal.clients || {}
    const vendor = deal.vendors || {}
    const reminders = Array.isArray(deal.deal_reminders) ? deal.deal_reminders : []
    const docs = Array.isArray(deal.deal_documents) ? deal.deal_documents : []
    const clientOpts = (model && model.clientOptions) || []
    const vendorOpts = (model && model.vendorOptions) || []
    const productOpts = (model && model.productOptions) || []

    const SALES = [
      { value: 'lead', label: 'Lead' }, { value: 'qualified', label: 'Qualified' },
      { value: 'active', label: 'Active' }, { value: 'delivered', label: 'Delivered' },
      { value: 'closed', label: 'Closed' },
    ]
    const BILLING = [
      { value: 'pending', label: 'Pending' }, { value: 'invoiced', label: 'Invoiced' },
      { value: 'partial', label: 'Partial' }, { value: 'paid', label: 'Paid' },
      { value: 'overdue', label: 'Overdue' },
    ]
    const CURRENCIES = ['USD', 'EUR', 'ILS', 'GBP'].map(c => ({ value: c, label: c }))
    const VAT_MODES = [{ value: 'excl', label: 'Excl.' }, { value: 'incl', label: 'Incl.' }]
    const PROCESSORS = ['ThriveCart', 'Green Invoice', 'Stripe', 'Manual', 'PayPal'].map(p => ({ value: p, label: p }))

    const kv = [
      editableFkField('Client', 'client_id', 'client', client.id, client.full_name, clientOpts),
      editableFkField('Vendor', 'primary_vendor_id', 'vendor', vendor.id, vendor.full_name || vendor.name, vendorOpts),
      editableFkField('Product', 'product_id', 'product', deal.product_id, deal.products && deal.products.name, productOpts),
      editableField('Sales status', 'sales_status', deal.sales_status, 'select', SALES),
      editableField('Billing status', 'billing_status', deal.billing_status, 'select', BILLING),
      editableField('Price', 'price', deal.price, 'number'),
      editableField('Currency', 'currency', deal.currency, 'select', CURRENCIES),
      editableField('VAT %', 'vat_pct', deal.vat_pct, 'number'),
      editableField('VAT mode', 'vat_mode', deal.vat_mode, 'select', VAT_MODES),
      editableField('Discount', 'discount', deal.discount, 'text'),
      editableField('Processor', 'payment_processor', deal.payment_processor, 'select', PROCESSORS),
      editableField('Payment link', 'payment_link', deal.payment_link, 'text'),
    ].join('')

    const packageRows = packages.length
      ? '<table class="tbl ep-mini-table"><thead><tr><th>Sessions</th><th>Used</th><th>Status</th></tr></thead><tbody>' +
        packages.map(p => '<tr><td>' + esc(String(p.total_sessions || 0)) + '</td><td>' + esc(String(p.sessions_used || 0)) + '</td><td>' + statusBadge(p.status || 'active') + '</td></tr>').join('') +
        '</tbody></table>'
      : '<div class="ep-muted">No packages</div>'

    const reminderRows = reminders.length
      ? '<ul class="ep-list">' + reminders.map(r => '<li>' + statusBadge(r.done ? 'done' : 'pending') + ' ' + esc(r.text || 'Reminder') + '</li>').join('') + '</ul>'
      : '<div class="ep-muted">No reminders</div>'

    const docRows = docs.length
      ? '<ul class="ep-list">' + docs.map(d => '<li>' + (d.url ? '<a class="ep-link-anchor" href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.name || d.title || 'Document') + '</a>' : esc(d.name || d.title || 'Document')) + '</li>').join('') + '</ul>'
      : '<div class="ep-muted">No documents</div>'

    return '<div class="ep-card"><div class="ep-section-title">Deal</div><div class="ep-kv">' + kv + '</div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Notes</div>' +
        '<div class="ep-field" data-field="notes" data-input-type="textarea" data-current="' + esc(deal.notes || '') + '">' +
          '<span class="ep-field-value editable">' + (deal.notes ? esc(deal.notes) : '<span class="ep-muted">No notes</span>') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="ep-card"><div class="ep-section-title">Packages</div>' + packageRows + '</div>' +
      '<div class="ep-card"><div class="ep-section-title">Reminders</div>' + reminderRows + '</div>' +
      '<div class="ep-card"><div class="ep-section-title">Documents</div>' + docRows + '</div>'
  }
```

- [ ] **Step 3: Commit**

```bash
git add panel-manager.js
git commit -m "feat(panel): deal panel fields are inline-editable"
```

---

## Task 8: Rewrite `renderVendorBody` with editable fields

**Files:**
- Modify: `panel-manager.js` — `renderVendorBody` (~line 429)

The classification card (`txd-card`) with category/tax/B-P/tags stays exactly as-is. Only the core cards get editable fields.

- [ ] **Step 1: Replace the top cards in `renderVendorBody`**

In `renderVendorBody`, replace everything from the `return` statement down to but NOT including the `<div class="txd-card"` line (~line 484). Replace with:

```js
    return '<div class="ep-card"><div class="ep-row-head">' +
        avatar(vendor.full_name || vendor.name || 'Vendor', vendor.profile_picture_url || vendor.avatar_url || null, 'lg') +
        '<div style="flex:1"><div class="ep-name">' + esc(vendor.full_name || vendor.name || '\u2014') + '</div>' +
        '<div class="ep-badges">' + vendorTypeBadge(vendor.vendor_type) + ' ' + statusBadge(vendor.status, vendor.active !== false && vendor.is_active !== false) + '</div></div>' +
      '</div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Core</div><div class="ep-kv">' +
        editableField('Name', 'full_name', vendor.full_name || vendor.name, 'text') +
        editableField('Email', 'email', vendor.email, 'text') +
        editableField('Phone', 'phone', vendor.phone, 'text') +
        editableField('Type', 'vendor_type', vendor.vendor_type, 'select', [
          { value: 'coach', label: 'Coach' },
          { value: 'contractor', label: 'Contractor' },
          { value: 'team_member', label: 'Team member' },
          { value: 'merchant', label: 'Merchant' },
        ]) +
        editableField('Payout currency', 'payout_currency', vendor.payout_currency || vendor.preferred_currency || vendor.currency, 'select', [
          { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' },
          { value: 'ILS', label: 'ILS' }, { value: 'GBP', label: 'GBP' },
        ]) +
        editableField('Active', 'is_active', (vendor.is_active !== false) ? 'true' : 'false', 'select', [
          { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' },
        ]) +
      '</div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Notes</div>' +
        '<div class="ep-field" data-field="notes" data-input-type="textarea" data-current="' + esc(vendor.notes || '') + '">' +
          '<span class="ep-field-value editable">' + (vendor.notes ? esc(vendor.notes) : '<span class="ep-muted">No notes</span>') + '</span>' +
        '</div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Task Type Rates</div>' +
        (rates.length
          ? '<ul class="ep-list">' + rates.map(r => '<li>' + esc(r.task_type_name || r.task_type || 'Task') + ' \u00b7 ' + esc(fmtMoney(r.rate, r.currency || vendor.preferred_currency || 'USD')) + '</li>').join('') + '</ul>'
          : '<div class="ep-muted">No rates set</div>') +
      '</div>' +
      '<div class="ep-card"><div class="ep-section-title">Assigned Clients (' + clients.length + ')</div>' +
        (clients.length
          ? '<ul class="ep-list">' + clients.map(c => '<li>' + entityLink('client', c.id, c.full_name || '\u2014') + '</li>').join('') + '</ul>'
          : '<div class="ep-muted">No assigned clients</div>') +
      '</div>'
    // NOTE: txd-card classification block follows unchanged (keep as-is from original)
```

Then append the original `txd-card` classification block unchanged.

- [ ] **Step 2: Remove the old vendor Edit button redirect handler from `initDom`**

Delete the entire `#pm-v-edit-btn` click handler block from `initDom` (lines 223–235):

```js
    // DELETE this entire block:
    panel.addEventListener('click', e => {
      const editBtn = e.target.closest('#pm-v-edit-btn')
      ...
    })
```

- [ ] **Step 3: Commit**

```bash
git add panel-manager.js
git commit -m "feat(panel): vendor core fields editable, remove Edit redirect button"
```

---

## Task 9: Rewrite `renderClientBody` with editable fields

**Files:**
- Modify: `panel-manager.js` — `renderClientBody` (~line 531)

- [ ] **Step 1: Rewrite `renderClientBody`**

Replace `renderClientBody` (~lines 531–574):

```js
  function renderClientBody(model) {
    const client = model && model.client ? model.client : {}
    const deals = (model && model.deals) || []
    const vendors = (model && model.vendors) || []
    const activeDeal = pickActiveDeal(deals)
    const activePackage = pickActivePackage((model && model.packages) || [])
    const assignedVendor = vendors[0] || (activeDeal && activeDeal.vendors) || null

    const sessionsLeft = activePackage
      ? (activePackage.sessions_remaining != null
          ? activePackage.sessions_remaining
          : Math.max(0, (activePackage.total_sessions || 0) - (activePackage.sessions_used || 0)))
      : '\u2014'
    const packageName = activePackage
      ? (activePackage.plan_name || (activePackage.total_sessions || 0) + '-session package')
      : '\u2014'

    const kv = [
      editableField('Name', 'full_name', client.full_name, 'text'),
      editableField('Email', 'email', client.email, 'text'),
      editableField('Phone', 'phone', client.phone, 'text'),
      editableField('Kind', 'client_kind', client.client_kind, 'select', [
        { value: 'private', label: 'Private' },
        { value: 'corporate', label: 'Corporate' },
      ]),
      editableField('Company', 'company', client.company, 'text'),
      editableField('Source', 'source', client.source, 'select', [
        { value: 'activecampaign', label: 'ActiveCampaign' },
        { value: 'referral', label: 'Referral' },
        { value: 'website', label: 'Website' },
        { value: 'other', label: 'Other' },
      ]),
      editableField('Active', 'active', (client.active !== false) ? 'true' : 'false', 'select', [
        { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' },
      ]),
    ].join('')

    const vendorEl = assignedVendor
      ? entityLink('vendor', assignedVendor.id, assignedVendor.full_name || assignedVendor.name || '\u2014')
      : '<span class="ep-muted">Not assigned</span>'

    const dealRows = deals.length
      ? '<ul class="ep-list">' + deals.map(d => '<li>' + entityLink('deal', d.id, (d.products && d.products.name) || 'Deal') + '</li>').join('') + '</ul>'
      : '<div class="ep-muted">No deals</div>'

    return '<div class="ep-card"><div class="ep-section-title">Core</div><div class="ep-kv">' + kv + '</div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Notes</div>' +
        '<div class="ep-field" data-field="notes" data-input-type="textarea" data-current="' + esc(client.notes || '') + '">' +
          '<span class="ep-field-value editable">' + (client.notes ? esc(client.notes) : '<span class="ep-muted">No notes</span>') + '</span>' +
        '</div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Assigned Vendor</div><div class="ep-v">' + vendorEl + '</div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Active Package</div><div class="ep-kv">' +
        '<div class="ep-k">Package</div><div class="ep-v">' + esc(packageName) + '</div>' +
        '<div class="ep-k">Sessions left</div><div class="ep-v">' + esc(String(sessionsLeft)) + '</div>' +
      '</div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Deals</div>' + dealRows + '</div>'
  }
```

- [ ] **Step 2: Commit**

```bash
git add panel-manager.js
git commit -m "feat(panel): client panel fields are inline-editable"
```

---

## Task 10: Rewrite `renderPackageBody` with editable fields

**Files:**
- Modify: `panel-manager.js` — `renderPackageBody` (~line 576)

- [ ] **Step 1: Rewrite `renderPackageBody`**

Replace `renderPackageBody` (~lines 576–617):

```js
  function renderPackageBody(model) {
    const pkg = (model && model.package) ? model.package : {}
    const deal = (model && model.deal) || null
    const total = Number(pkg.total_sessions || 0)
    const used = Number(pkg.sessions_used || 0)
    const left = pkg.sessions_remaining != null
      ? Number(pkg.sessions_remaining || 0)
      : Math.max(0, total - used)
    const packageName = pkg.plan_name || (total || 0) + '-session package'
    const productName = (deal && deal.products && deal.products.name) || pkg.product_name || '\u2014'
    const vendor = pkg.vendors || null

    const statusKv = [
      editableField('Sales status', 'sales_status', pkg.sales_status, 'select', [
        { value: 'lead', label: 'Lead' }, { value: 'active', label: 'Active' },
        { value: 'delivered', label: 'Delivered' }, { value: 'closed', label: 'Closed' },
      ]),
      editableField('Billing status', 'billing_status', pkg.billing_status, 'select', [
        { value: 'pending', label: 'Pending' }, { value: 'invoiced', label: 'Invoiced' },
        { value: 'partial', label: 'Partial' }, { value: 'paid', label: 'Paid' },
        { value: 'overdue', label: 'Overdue' },
      ]),
    ].join('')

    const vendorEl = vendor
      ? entityLink('vendor', vendor.id, vendor.full_name || vendor.name || '\u2014')
      : '<span class="ep-muted">Not assigned</span>'
    const dealEl = deal
      ? entityLink('deal', deal.id, (deal.products && deal.products.name) || ('Deal #' + deal.id))
      : '<span class="ep-muted">No linked deal</span>'

    return '<div class="ep-card"><div class="ep-row-head"><div>' +
        '<div class="ep-name">' + esc(packageName) + '</div>' +
        '<div class="ep-sub">' + esc(productName) + '</div>' +
      '</div></div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Sessions</div><div class="ep-kv">' +
        '<div class="ep-k">Total</div><div class="ep-v">' + esc(String(total)) + '</div>' +
        '<div class="ep-k">Used</div><div class="ep-v">' + esc(String(used)) + '</div>' +
        '<div class="ep-k">Left</div><div class="ep-v">' + esc(String(left)) + '</div>' +
      '</div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Status</div><div class="ep-kv">' + statusKv + '</div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Notes</div>' +
        '<div class="ep-field" data-field="notes" data-input-type="textarea" data-current="' + esc(pkg.notes || '') + '">' +
          '<span class="ep-field-value editable">' + (pkg.notes ? esc(pkg.notes) : '<span class="ep-muted">No notes</span>') + '</span>' +
        '</div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Assigned Vendor</div><div class="ep-v">' + vendorEl + '</div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Linked Deal</div><div class="ep-v">' + dealEl + '</div></div>'
  }
```

- [ ] **Step 2: Commit**

```bash
git add panel-manager.js
git commit -m "feat(panel): package panel fields are inline-editable"
```

---

## Task 11: Add product and plan entities to panel-manager

**Files:**
- Modify: `db.js` — add `getProduct(id)` and `getPlan(id)`
- Modify: `panel-manager.js` — `SUPPORTED_TYPES`, `fallbackLabel`, loaders, renderers, `renderCurrent`

- [ ] **Step 1: Add `getProduct` and `getPlan` to db.js**

In `db.js`, after `getAllProductsWithPlans` (after line 292), add:

```js
async function getProduct(id) {
  const { data, error } = await _sb.from('products').select('*, plans(*)').eq('id', id).single()
  if (error) throw error
  return data
}

async function getPlan(id) {
  const { data, error } = await _sb.from('plans').select('*, products(*)').eq('id', id).single()
  if (error) throw error
  return data
}
```

Check if `db.js` has a block that exposes functions on `window` (search for `window.getVendor` or similar). If it does, also add:

```js
window.getProduct = getProduct
window.getPlan = getPlan
```

If `db.js` has no such block (functions are plain globals, no window assignments), skip this sub-step.

- [ ] **Step 2: Update `SUPPORTED_TYPES` in panel-manager.js**

Replace line 3:

```js
  const SUPPORTED_TYPES = new Set(['vendor', 'client', 'deal', 'transaction', 'package', 'product', 'plan'])
```

- [ ] **Step 3: Update `fallbackLabel`**

Replace `fallbackLabel` (~line 61–67):

```js
  function fallbackLabel(type, id) {
    if (type === 'vendor') return 'Vendor ' + id
    if (type === 'client') return 'Client ' + id
    if (type === 'deal') return 'Deal #' + id
    if (type === 'package') return 'Package ' + id
    if (type === 'product') return 'Product ' + id
    if (type === 'plan') return 'Plan ' + id
    return 'Transaction'
  }
```

- [ ] **Step 4: Add `loadProductModel` and `loadPlanModel`**

Add after `loadPackageModel`:

```js
  async function loadProductModel(id) {
    const product = await global.getProduct(id)
    return { product: product || {}, plans: (product && product.plans) || [] }
  }

  async function loadPlanModel(id) {
    const plan = await global.getPlan(id)
    const product = (plan && plan.products) || null
    return { plan: plan || {}, product }
  }
```

- [ ] **Step 5: Add `renderProductBody` and `renderPlanBody`**

Add after `renderPackageBody` (before `editableField`):

```js
  function renderProductBody(model) {
    const product = (model && model.product) ? model.product : {}
    const plans = (model && model.plans) || []
    const links = Array.isArray(product.links) ? product.links : []

    const kv = [
      editableField('Name', 'name', product.name, 'text'),
      editableField('Category', 'category', product.category, 'text'),
      editableField('Status', 'status', product.status, 'select', [
        { value: 'active', label: 'Active' },
        { value: 'draft', label: 'Draft' },
        { value: 'archived', label: 'Archived' },
      ]),
      editableField('Currency', 'currency', product.currency, 'select', [
        { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' },
        { value: 'ILS', label: 'ILS' }, { value: 'GBP', label: 'GBP' },
      ]),
      editableField('Price min', 'price_min', product.price_min, 'number'),
      editableField('Price max', 'price_max', product.price_max, 'number'),
    ].join('')

    const planRows = plans.length
      ? '<ul class="ep-list">' + plans.map(p => '<li><button class="ep-link" data-panel-type="plan" data-panel-id="' + esc(p.id) + '">' + esc(p.name || 'Plan') + '</button> \u00b7 ' + esc(fmtMoney(p.amount, p.currency)) + '</li>').join('') + '</ul>'
      : '<div class="ep-muted">No plans</div>'

    const linkRows = links.length
      ? '<ul class="ep-list">' + links.map(l => '<li><a class="ep-link-anchor" href="' + esc(l.url || '') + '" target="_blank" rel="noopener">' + esc(l.label || l.url || 'Link') + '</a></li>').join('') + '</ul>'
      : '<div class="ep-muted">No links</div>'

    return '<div class="ep-card"><div class="ep-section-title">Product</div><div class="ep-kv">' + kv + '</div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Description</div>' +
        '<div class="ep-field" data-field="description" data-input-type="textarea" data-current="' + esc(product.description || '') + '">' +
          '<span class="ep-field-value editable">' + (product.description ? esc(product.description) : '<span class="ep-muted">No description</span>') + '</span>' +
        '</div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Plans</div>' + planRows + '</div>' +
      '<div class="ep-card"><div class="ep-section-title">Links</div>' + linkRows + '</div>'
  }

  function renderPlanBody(model) {
    const plan = (model && model.plan) ? model.plan : {}
    const product = (model && model.product) || null
    const rawType = String(plan.plan_type || '').toLowerCase()
    const isInstallment = rawType.includes('payment') || rawType.includes('installment')

    const kv = [
      editableField('Name', 'name', plan.name, 'text'),
      editableField('Type', 'plan_type', plan.plan_type, 'select', [
        { value: 'One payment', label: 'One payment' },
        { value: '3 payments', label: '3 payments' },
        { value: 'Subscription', label: 'Subscription' },
      ]),
      editableField('Amount', 'amount', plan.amount, 'number'),
      editableField('Currency', 'currency', plan.currency, 'select', [
        { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' },
        { value: 'ILS', label: 'ILS' }, { value: 'GBP', label: 'GBP' },
      ]),
      isInstallment ? editableField('Installments', 'installments_count', plan.installments_count, 'number') : '',
      editableField('Status', 'status', plan.status, 'select', [
        { value: 'active', label: 'Active' },
        { value: 'draft', label: 'Draft' },
        { value: 'archived', label: 'Archived' },
      ]),
      editableField('Source', 'link_source', plan.link_source, 'select', [
        { value: 'ThriveCart', label: 'ThriveCart' },
        { value: 'Green Invoice', label: 'Green Invoice' },
        { value: 'Stripe', label: 'Stripe' },
        { value: 'Manual', label: 'Manual' },
      ]),
      editableField('Link URL', 'link_url', plan.link_url, 'text'),
    ].join('')

    const productEl = product
      ? entityLink('product', product.id, product.name || '\u2014')
      : '<span class="ep-muted">\u2014</span>'

    return '<div class="ep-card"><div class="ep-section-title">Plan</div><div class="ep-kv">' + kv + '</div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Description</div>' +
        '<div class="ep-field" data-field="description" data-input-type="textarea" data-current="' + esc(plan.description || '') + '">' +
          '<span class="ep-field-value editable">' + (plan.description ? esc(plan.description) : '<span class="ep-muted">No description</span>') + '</span>' +
        '</div></div>' +
      '<div class="ep-card"><div class="ep-section-title">Product</div><div class="ep-v">' + productEl + '</div></div>'
  }
```

- [ ] **Step 6: Update `renderCurrent` to handle product and plan**

In `renderCurrent`, find the model-loading if/else chain (~line 1030–1042) and add after the package branch:

```js
      } else if (entry.type === 'product') {
        model = await loadProductModel(entry.id)
        entry.label = (model.product && model.product.name) || fallbackLabel(entry.type, entry.id)
      } else if (entry.type === 'plan') {
        model = await loadPlanModel(entry.id)
        entry.label = (model.plan && model.plan.name) || fallbackLabel(entry.type, entry.id)
        if (state.stack.length === 1 && model.product && model.product.id) {
          state.stack.unshift({
            type: 'product',
            id: model.product.id,
            label: model.product.name || fallbackLabel('product', model.product.id),
          })
        }
```

Then in the render dispatch block (after the package `if` block), add:

```js
      if (entry.type === 'product') {
        els.body.innerHTML = renderProductBody(model)
        return
      }
      if (entry.type === 'plan') {
        els.body.innerHTML = renderPlanBody(model)
        return
      }
```

- [ ] **Step 7: Commit**

```bash
git add panel-manager.js db.js
git commit -m "feat(panel): add product and plan entities with inline editing"
```

---

## Task 12: Remove deal edit modal from deals.js and deals.html

**Files:**
- Modify: `deals.js` (~lines 895–1260)
- Modify: `deals.html` (~line 311)

- [ ] **Step 1: Simplify `openEditDeal` in deals.js**

Replace `openEditDeal` (lines 895–924):

```js
function openEditDeal(id, e) {
  e && e.stopPropagation()
  if (window.PanelManager && window.PanelManager.open) {
    window.PanelManager.open('deal', id)
  }
}
window.openEditDeal = openEditDeal
```

- [ ] **Step 2: Delete dead functions from deals.js**

Delete entirely from `deals.js`:
- `closeEditDeal` function and its `window.closeEditDeal = closeEditDeal` line
- `_renderEditDealModal` function
- `saveEditDeal` function and its `window.saveEditDeal = saveEditDeal` line

Also delete the `_editDealId`, `_edSelClient`, `_edCsOpen`, `_edCsSearch`, `_edCsFocused` variable declarations if they only served the modal.

- [ ] **Step 3: Remove `#modal-edit-deal` from deals.html**

In `deals.html`, find the block starting with `<div id="modal-edit-deal"` (~line 311) and delete it entirely (the whole modal div including its overlay).

- [ ] **Step 4: Commit**

```bash
git add deals.js deals.html
git commit -m "refactor: remove deal edit modal, all deal editing via panel"
```

---

## Task 13: Remove product/plan modals from deals.js and deals.html

**Files:**
- Modify: `deals.js` (~lines 3675–4000)
- Modify: `deals.html` (~lines 471–510)

- [ ] **Step 1: Rewire product open to PanelManager**

Find the function in `deals.js` that calls `document.getElementById('modal-product').classList.add('open')` (~line 3682). The product `id` is already in scope there. Replace the function body with:

```js
  if (window.PanelManager && window.PanelManager.open) {
    window.PanelManager.open('product', productId)
  }
```

Where `productId` is the variable holding the product's id at that call site. Read the surrounding code to confirm the variable name.

- [ ] **Step 2: Rewire plan open to PanelManager**

Same: find the function calling `document.getElementById('modal-plan').classList.add('open')` (~line 3949). Replace with:

```js
  if (window.PanelManager && window.PanelManager.open) {
    window.PanelManager.open('plan', planId)
  }
```

- [ ] **Step 3: Delete product/plan modal open/close/save functions from deals.js**

Delete all functions that reference `modal-product` or `modal-plan`. These include open, close, and submit/save handlers (~4–6 functions).

- [ ] **Step 4: Remove `#modal-product` and `#modal-plan` from deals.html**

Delete both modal HTML blocks (~lines 471–510).

- [ ] **Step 5: Commit**

```bash
git add deals.js deals.html
git commit -m "refactor: remove product/plan modals, edit via panel"
```

---

## Task 14: Remove vendor edit modal from vendor-profile

**Files:**
- Modify: `vendor-profile.js` (~lines 228–284)
- Modify: `vendor-profile.html`

- [ ] **Step 1: Replace `openVendorEditModal` in vendor-profile.js**

Replace the entire `openVendorEditModal` function with:

```js
function openVendorEditModal() {
  if (window.PanelManager && window.PanelManager.open && _vendorId) {
    window.PanelManager.open('vendor', _vendorId)
  }
}
```

- [ ] **Step 2: Delete `saveVendorEditModal` and `closeVendorEditModal`**

Delete these functions entirely from `vendor-profile.js`.

- [ ] **Step 3: Remove vendor edit overlay from vendor-profile.html**

Find and delete the `<div id="vendor-edit-overlay" ...>` block from `vendor-profile.html`.

- [ ] **Step 4: Commit**

```bash
git add vendor-profile.js vendor-profile.html
git commit -m "refactor: remove vendor edit modal, edit via panel"
```

---

## Task 15: Smoke test all entity panels

Manual verification — no automated test framework in this codebase.

- [ ] **Step 1: Test deal panel edit**

1. Open `deals.html` in a browser
2. Click any deal card or list row — panel should open
3. Click the Price field value — number input appears in place
4. Change the value — Save button appears in panel header
5. Click Save — button shows "Saving…", panel refreshes with new value, Save button disappears
6. Check browser console for errors

- [ ] **Step 2: Test dirty guard on close**

1. Open a deal in the panel, edit any field
2. Click the overlay or press Esc — dirty bar appears: "⚠ Unsaved changes / Discard / Keep editing"
3. Click "Keep editing" — bar dismisses, panel stays open
4. Press Esc — bar appears again
5. Click "Discard" — panel closes, no changes saved

- [ ] **Step 3: Test dirty guard on breadcrumb**

1. Open a deal, click the Client link — stack now shows Client breadcrumb
2. Edit a client field
3. Click the Deal breadcrumb — dirty bar appears
4. Click Discard — navigates back to deal, edits lost

- [ ] **Step 4: Test FK picker on deal**

1. Open a deal panel
2. Click the Client field value — FK picker dropdown with search opens
3. Type a few characters — list filters
4. Click a result — field updates to new client name, Save button appears
5. Save — DB updated, panel refreshes

- [ ] **Step 5: Test vendor panel**

1. Click a vendor anywhere that opens the panel
2. Panel opens with Name, Email, Phone, etc. as editable fields
3. Edit Name — Save — refreshes with new name
4. Classification section (Category / Tax / B-P / Tags + "Save classification") still works independently

- [ ] **Step 6: Test product and plan panels**

1. In `deals.html` products tab, click a product row — product panel opens
2. Edit Name or Status — Save — refreshes
3. Click a plan link inside product panel — plan panel opens, breadcrumb shows Product › Plan
4. Edit Amount — Save — refreshes

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: smoke test verified — unified entity editing complete"
```
