// panel-manager.js — unified right-side panel manager
;(function initPanelManager(global) {
  const SUPPORTED_TYPES = new Set(['vendor', 'client', 'deal', 'transaction', 'package'])

  const state = {
    stack: [],
    token: 0,
    open: false,
    editing: false,
    edits: {},
  }

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

  function updateSaveBtn() {
    if (!els.saveBtn) return
    const dirty = Object.keys(state.edits).length > 0
    els.saveBtn.style.display = dirty ? '' : 'none'
  }

  async function commitEdits(entry) {
    if (!els.saveBtn) return
    closeFkPicker()
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
      input.value = currentVal || ''
    } else if (inputType === 'select' && options) {
      const opts = JSON.parse(options)
      input = document.createElement('select')
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
      input.value = currentVal !== null && currentVal !== undefined ? currentVal : ''
    } else {
      input = document.createElement('input')
      input.type = 'text'
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

  const TAX_TREATMENTS = [
    'non_deductible',
    'mixed_review',
    'income',
    'business_payroll_contractors',
    'business_professional_services',
    'business_banking_fees',
    'business_taxes_government',
    'business_insurance',
    'business_software_online',
    'business_travel',
    'business_equipment',
    'business_marketing',
    'business_training',
  ]

  const els = {
    overlay: null,
    panel: null,
    crumbs: null,
    entityHead: null,
    body: null,
    fullLink: null,
    saveBtn: null,
  }

  const vendorClassificationLookup = { categories: [], tags: [] }
  let vendorClassificationEditor = null

  // esc defined globally in app.js — reference it as a local alias so closure calls work
  const esc = window.esc

  function fmtDate(v) {
    if (!v) return '—'
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function fmtMoney(amount, currency) {
    if (amount == null || amount === '') return '—'
    const n = Number(amount)
    if (!Number.isFinite(n)) return '—'
    const sym = { USD: '$', EUR: '€', ILS: '₪', GBP: '£' }[currency] || ''
    return `${sym}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`.trim()
  }

  function normalizeType(type) {
    return String(type || '').toLowerCase()
  }

  function fallbackLabel(type, id) {
    if (type === 'vendor') return `Vendor ${id}`
    if (type === 'client') return `Client ${id}`
    if (type === 'deal') return `Deal #${id}`
    if (type === 'package') return `Package ${id}`
    return 'Transaction'
  }

  function initDom() {
    if (els.panel) return

    const overlay = document.createElement('div')
    overlay.className = 'panel-manager-overlay'
    overlay.id = 'panel-manager-overlay'

    const panel = document.createElement('aside')
    panel.className = 'panel-manager'
    panel.id = 'panel-manager'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    panel.innerHTML = `
      <div class="panel-manager-head">
        <div class="panel-manager-head-row">
          <div class="panel-manager-crumbs" id="panel-manager-crumbs"></div>
          <div class="panel-manager-head-actions">
            <button class="pm-save-btn" id="pm-save-btn" style="display:none">Save</button>
            <a class="panel-manager-full" id="panel-manager-full" data-allow-navigation="true" href="#">Open full profile →</a>
            <button class="panel-manager-close" id="panel-manager-close" aria-label="Close">×</button>
          </div>
        </div>
        <div class="panel-manager-entity-head" id="panel-manager-entity-head"></div>
      </div>
      <div class="panel-manager-body" id="panel-manager-body"></div>
    `

    document.body.appendChild(overlay)
    document.body.appendChild(panel)

    els.overlay = overlay
    els.panel = panel
    els.crumbs = panel.querySelector('#panel-manager-crumbs')
    els.entityHead = panel.querySelector('#panel-manager-entity-head')
    els.body = panel.querySelector('#panel-manager-body')
    els.fullLink = panel.querySelector('#panel-manager-full')
    els.saveBtn = panel.querySelector('#pm-save-btn')
    els.saveBtn.addEventListener('click', async () => {
      const entry = currentEntry()
      if (!entry || !Object.keys(state.edits).length) return
      await commitEdits(entry)
    })

    overlay.addEventListener('click', () => {
      if (Object.keys(state.edits).length) {
        showDirtyBar(() => { resetEditState(); closePanel() })
        return
      }
      closePanel()
    })
    panel.querySelector('#panel-manager-close').addEventListener('click', () => {
      if (Object.keys(state.edits).length) {
        showDirtyBar(() => { resetEditState(); closePanel() })
        return
      }
      closePanel()
    })

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

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.open) {
        if (Object.keys(state.edits).length) {
          showDirtyBar(() => { resetEditState(); closePanel() })
          return
        }
        closePanel()
      }
    })

    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-panel-type][data-panel-id]')
      if (!btn) return
      e.preventDefault()
      const type = btn.getAttribute('data-panel-type')
      const id = btn.getAttribute('data-panel-id')
      open(type, id)
    })

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
        openFkPicker(valueEl, fieldKey, items, currentId, (fkId, fkLabel) => {
          state.edits[fieldKey] = fkId
          state.editing = true
          updateSaveBtn()
          valueEl.textContent = ''
          if (fkId && fkLabel) {
            const fkBtn = document.createElement('button')
            fkBtn.className = 'ep-link'
            fkBtn.setAttribute('data-panel-type', fkType)
            fkBtn.setAttribute('data-panel-id', fkId)
            fkBtn.textContent = fkLabel
            valueEl.appendChild(fkBtn)
          } else {
            const span = document.createElement('span')
            span.className = 'ep-muted'
            span.textContent = '\u2014'
            valueEl.appendChild(span)
          }
          valueEl.classList.remove('editing')
          valueEl.classList.remove('editable')
        })
        return
      }
      activateFieldEdit(fieldEl, fieldKey)
    })

    document.addEventListener('mousedown', e => {
      const picker = document.getElementById('pm-fk-picker')
      if (!picker) return
      if (!picker.contains(e.target)) closeFkPicker()
    })

    document.addEventListener('click', e => {
      const bpBtn = e.target.closest('[data-pm-action="toggle-v-bp"]')
      if (!bpBtn) return
      const cur = bpBtn.getAttribute('data-value') || ''
      const next = cur === 'business' ? 'private' : cur === 'private' ? '' : 'business'
      bpBtn.setAttribute('data-value', next)
      bpBtn.classList.remove('business', 'private')
      if (next) bpBtn.classList.add(next)
      bpBtn.textContent = next === 'business' ? 'Business' : next === 'private' ? 'Private' : '—'
    })

    document.addEventListener('click', e => {
      const catCell = e.target.closest('[data-pm-action="open-vendor-cat"]')
      if (!catCell) return
      if (currentEntry()?.type !== 'vendor') return
      e.preventDefault()
      e.stopPropagation()
      openVendorCategoryPicker(catCell)
    })

    document.addEventListener('click', e => {
      const taxCell = e.target.closest('[data-pm-action="open-vendor-tax"]')
      if (!taxCell) return
      if (currentEntry()?.type !== 'vendor') return
      e.preventDefault()
      e.stopPropagation()
      openVendorTaxPicker(taxCell)
    })

    document.addEventListener('click', e => {
      const tagsCell = e.target.closest('[data-pm-action="open-vendor-tags"]')
      if (!tagsCell) return
      if (currentEntry()?.type !== 'vendor') return
      e.preventDefault()
      e.stopPropagation()
      openVendorTagPicker(tagsCell)
    })

    document.addEventListener('click', async e => {
      const saveBtn = e.target.closest('[data-pm-action="save-vendor-classification"]')
      if (!saveBtn) return
      e.preventDefault()
      const entry = currentEntry()
      if (entry?.type !== 'vendor' || !entry.id) return
      await saveVendorClassification(entry.id, saveBtn)
    })

    document.addEventListener('mousedown', e => {
      if (!vendorClassificationEditor) return
      if (vendorClassificationEditor.el.contains(e.target)) return
      closeVendorClassificationEditor({ commit: true })
    })

    document.addEventListener('click', e => {
      const a = e.target.closest('a[href]')
      if (!a) return
      if (!els.panel || !els.panel.contains(a)) return
      if (a.dataset.allowNavigation === 'true') return
      if (a.target && a.target.toLowerCase() === '_blank') return
      const href = a.getAttribute('href') || ''
      if (!href || href.startsWith('#')) return

      let url
      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return

      const path = url.pathname.toLowerCase()
      const id = url.searchParams.get('id')
      if (path.endsWith('/client-profile.html') && id) {
        e.preventDefault()
        open('client', id)
        return
      }
      if (path.endsWith('/vendor-profile.html') && id) {
        e.preventDefault()
        open('vendor', id)
        return
      }
      if (path.endsWith('/deal.html') && id) {
        e.preventDefault()
        open('deal', id)
      }
    })

    document.addEventListener('router:close', () => {
      closePanel({ skipRouterClose: true })
    })

  }

  function currentEntry() {
    return state.stack[state.stack.length - 1] || null
  }

  function setOpen(opened) {
    if (!els.panel || !els.overlay) return
    state.open = !!opened
    els.panel.classList.toggle('open', !!opened)
    els.overlay.classList.toggle('open', !!opened)
    document.body.classList.toggle('panel-manager-open', !!opened)
  }

  function fullProfileHref(type, id) {
    const safeId = encodeURIComponent(id)
    if (type === 'vendor') return `vendor-profile.html?id=${safeId}`
    if (type === 'client') return `client-profile.html?id=${safeId}`
    if (type === 'deal') return `deal.html?id=${safeId}`
    if (type === 'transaction') return `payments.html?tab=transactions&entity=transaction&id=${safeId}&view=panel`
    return null
  }

  function entityLink(type, id, label) {
    if (!id) return `<span class="ep-muted">${esc(label || '—')}</span>`
    return `<button class="ep-link" data-panel-type="${esc(type)}" data-panel-id="${esc(id)}">${esc(label || '—')}</button>`
  }

  function avatar(name, imageUrl, sizeClass = '') {
    const initialsVal = typeof global.initials === 'function' ? global.initials(name || '') : String(name || '?').slice(0, 2)
    const bg = typeof global.avatarBg === 'function' ? global.avatarBg(name || '') : 'var(--bg)'
    const fg = typeof global.avatarFg === 'function' ? global.avatarFg(name || '') : 'var(--ink)'
    if (imageUrl) {
      return `<div class="ep-avatar ${sizeClass}"><img src="${esc(imageUrl)}" alt="${esc(name || '')}"></div>`
    }
    return `<div class="ep-avatar ${sizeClass}" style="background:${bg};color:${fg}">${esc(initialsVal || '?')}</div>`
  }

  function vendorTypeBadge(type) {
    const key = String(type || '').toLowerCase()
    const label = {
      coach: 'Coach',
      contractor: 'Contractor',
      team_member: 'Team member',
      merchant: 'Merchant',
    }[key] || (type || '—')
    return `<span class="ep-badge ep-badge-type">${esc(label)}</span>`
  }

  function statusBadge(status, active) {
    const raw = status || (active === false ? 'inactive' : 'active')
    const cls = raw === 'active' || raw === true ? 'active' : raw === 'inactive' || raw === false ? 'inactive' : 'neutral'
    const label = raw === true ? 'active' : raw === false ? 'inactive' : String(raw)
    return `<span class="ep-badge ep-badge-status ${cls}">${esc(label)}</span>`
  }

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

  async function loadVendorModel(id) {
    const [vendor, companies, categories, tags] = await Promise.all([
      global.getVendor(id),
      typeof global.getCompanies === 'function' ? global.getCompanies().catch(() => []) : Promise.resolve([]),
      typeof global.getTransactionCategories === 'function'
        ? global.getTransactionCategories().catch(() => [])
        : Promise.resolve([]),
      typeof global.getTransactionTags === 'function'
        ? global.getTransactionTags().catch(() => [])
        : Promise.resolve([]),
    ])
    const activeCategories = (categories || []).filter(c => (c.status || 'active') !== 'inactive')
    const activeTags = (tags || [])
      .filter(t => (t.status || 'active') !== 'inactive')
      .map(t => String(t.name || '').trim())
      .filter(Boolean)
    return {
      vendor,
      companies: companies || [],
      categories: activeCategories,
      tags: [...new Set(activeTags)],
    }
  }

  async function loadClientModel(id) {
    const [client, deals, packages, vendors] = await Promise.all([
      global.getClient(id),
      typeof global.getDeals === 'function' ? global.getDeals({ client_id: id }) : Promise.resolve([]),
      typeof global.getPackages === 'function' ? global.getPackages({ client_id: id }) : Promise.resolve([]),
      typeof global.getVendorClientsForClient === 'function' ? global.getVendorClientsForClient(id) : Promise.resolve([]),
    ])
    return {
      client,
      deals: deals || [],
      packages: packages || [],
      vendors: vendors || [],
    }
  }

  async function loadPackageModel(id) {
    if (typeof global.getPackage !== 'function') {
      throw new Error('getPackage() is not available')
    }
    const pkg = await global.getPackage(id)
    let deal = null
    if (pkg?.deal_id && typeof global.getDeal === 'function') {
      try {
        deal = await global.getDeal(pkg.deal_id)
      } catch (_) {
        deal = null
      }
    }
    return { package: pkg, deal }
  }

  function renderDealBody(model) {
    const deal = model?.deal || {}
    const packages = model?.packages || []
    const client = deal.clients || {}
    const vendor = deal.vendors || {}
    const reminders = Array.isArray(deal.deal_reminders) ? deal.deal_reminders : []
    const docs = Array.isArray(deal.deal_documents) ? deal.deal_documents : []
    const clientOpts = model?.clientOptions || []
    const vendorOpts = model?.vendorOptions || []
    const productOpts = model?.productOptions || []

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
      ? `<table class="tbl ep-mini-table"><thead><tr><th>Sessions</th><th>Used</th><th>Status</th></tr></thead><tbody>${
          packages.map(p => `<tr><td>${esc(String(p.total_sessions || 0))}</td><td>${esc(String(p.sessions_used || 0))}</td><td>${statusBadge(p.status || 'active')}</td></tr>`).join('')
        }</tbody></table>`
      : '<div class="ep-muted">No packages</div>'

    const reminderRows = reminders.length
      ? `<ul class="ep-list">${reminders.map(r => `<li>${statusBadge(r.done ? 'done' : 'pending')} ${esc(r.text || 'Reminder')}</li>`).join('')}</ul>`
      : '<div class="ep-muted">No reminders</div>'

    const docRows = docs.length
      ? `<ul class="ep-list">${docs.map(d => `<li>${d.url ? `<a class="ep-link-anchor" href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name || d.title || 'Document')}</a>` : esc(d.name || d.title || 'Document')}</li>`).join('')}</ul>`
      : '<div class="ep-muted">No documents</div>'

    return `
      <div class="ep-card">
        <div class="ep-row-head">
          ${avatar(client.full_name || 'Client', client.avatar_url || null)}
          <div>
            <div class="ep-name">${esc(deal.products?.name || 'Deal')}</div>
            <div class="ep-sub">${esc(client.full_name || '—')}</div>
          </div>
        </div>
        <div class="ep-kv">${kv}</div>
      </div>
      <div class="ep-card">
        <div class="ep-section-title">Notes</div>
        <div class="ep-field" data-field="notes" data-input-type="textarea" data-current="${esc(deal.notes || '')}">
          <span class="ep-field-value editable">${deal.notes ? esc(deal.notes) : '<span class="ep-muted">No notes</span>'}</span>
        </div>
      </div>
      <div class="ep-card">
        <div class="ep-section-title">Packages</div>
        ${packageRows}
      </div>
      <div class="ep-card">
        <div class="ep-section-title">Reminders</div>
        ${reminderRows}
      </div>
      <div class="ep-card">
        <div class="ep-section-title">Documents</div>
        ${docRows}
      </div>
    `
  }

  function renderVendorBody(model) {
    const vendor = model?.vendor || {}
    const companies = model?.companies || []
    const company = companies.find(c => c.id === vendor.paying_company_id)?.name || vendor.paying_company_id || '—'
    const rates = Array.isArray(vendor.rates) ? vendor.rates : []
    const clients = Array.isArray(vendor.clients) ? vendor.clients : []
    const vendorTags = Array.isArray(vendor.tags) ? vendor.tags : []
    const bpVal = vendor.entity === 'business' || vendor.entity === 'private' ? vendor.entity : ''
    const catName = vendorClassificationLookup.categories.find(c => c.id === vendor.category_id)?.name || ''
    const catHtml = catName
      ? `<span class="cl-cat-pill">${esc(catName)}</span>`
      : '<span class="cl-placeholder">Set…</span>'
    const taxKey = vendor.tax_treatment || ''
    const taxClass = ['non_deductible', 'mixed_review'].includes(taxKey) ? taxKey : ''
    const taxHtml = taxKey
      ? `<span class="cl-tax-badge ${taxClass}">${esc(taxKey.replace(/_/g, ' '))}</span>`
      : '<span class="cl-placeholder">—</span>'
    const tagsHtml = vendorTags.length
      ? vendorTags.map(t => `<span class="cl-tag">${esc(t)}</span>`).join('')
      : '<span class="cl-placeholder">+ Add tags</span>'

    const coreKv = [
      editableField('Name', 'full_name', vendor.full_name || vendor.name, 'text'),
      editableField('Email', 'email', vendor.email, 'text'),
      editableField('Phone', 'phone', vendor.phone, 'text'),
      editableField('Type', 'vendor_type', vendor.vendor_type, 'select', [
        { value: 'coach', label: 'Coach' },
        { value: 'contractor', label: 'Contractor' },
        { value: 'team_member', label: 'Team member' },
        { value: 'merchant', label: 'Merchant' },
      ]),
      editableField('Payout currency', 'payout_currency', vendor.payout_currency || vendor.preferred_currency || vendor.currency, 'select', [
        { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' },
        { value: 'ILS', label: 'ILS' }, { value: 'GBP', label: 'GBP' },
      ]),
      editableField('Active', 'is_active', (vendor.is_active !== false) ? 'true' : 'false', 'select', [
        { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' },
      ]),
    ].join('')

    return `
      <div class="ep-card">
        <div class="ep-row-head">
          ${avatar(vendor.full_name || vendor.name || 'Vendor', vendor.profile_picture_url || vendor.avatar_url || null, 'lg')}
          <div style="flex:1">
            <div class="ep-name">${esc(vendor.full_name || vendor.name || '—')}</div>
            <div class="ep-badges">${vendorTypeBadge(vendor.vendor_type)} ${statusBadge(vendor.status, vendor.active !== false && vendor.is_active !== false)}</div>
          </div>
        </div>
      </div>

      <div class="ep-card">
        <div class="ep-section-title">Core</div>
        <div class="ep-kv">${coreKv}</div>
      </div>

      <div class="ep-card">
        <div class="ep-section-title">Notes</div>
        <div class="ep-field" data-field="notes" data-input-type="textarea" data-current="${esc(vendor.notes || '')}">
          <span class="ep-field-value editable">${vendor.notes ? esc(vendor.notes) : '<span class="ep-muted">No notes</span>'}</span>
        </div>
      </div>

      <div class="ep-card">
        <div class="ep-section-title">Task Type Rates</div>
        ${rates.length
          ? `<ul class="ep-list">${rates.map(r => `<li>${esc(r.task_type_name || r.task_type || 'Task')} · ${esc(fmtMoney(r.rate, r.currency || vendor.preferred_currency || 'USD'))}</li>`).join('')}</ul>`
          : '<div class="ep-muted">No rates set</div>'}
      </div>

      <div class="ep-card">
        <div class="ep-section-title">Assigned Clients (${clients.length})</div>
        ${clients.length
          ? `<ul class="ep-list">${clients.map(c => `<li>${entityLink('client', c.id, c.full_name || '—')}</li>`).join('')}</ul>`
          : '<div class="ep-muted">No assigned clients</div>'}
      </div>

      <div class="txd-card" id="pm-v-cl-section">
        <div class="txd-card-header">Classification</div>
        <div class="txd-cl-grid">
          <div class="txd-cl-cell" data-pm-action="open-vendor-cat">
            <div class="txd-cl-label">Category</div>
            <div id="pm-v-cat-val" class="txd-cl-value" data-value="${esc(vendor.category_id || '')}">
              ${catHtml}
            </div>
          </div>
          <div class="txd-cl-cell" data-pm-action="open-vendor-tax">
            <div class="txd-cl-label">Tax</div>
            <div id="pm-v-tax-val" class="txd-cl-value" data-value="${esc(taxKey)}">
              ${taxHtml}
            </div>
          </div>
          <div class="txd-cl-cell">
            <div class="txd-cl-label">B/P</div>
            <div class="txd-cl-value">
              <button
                class="cl-bp-pill ${bpVal}"
                type="button"
                data-pm-action="toggle-v-bp"
                data-value="${esc(bpVal)}">${bpVal === 'business' ? 'Business' : bpVal === 'private' ? 'Private' : '—'}</button>
            </div>
          </div>
        </div>
        <div class="txd-cl-tags-row" data-pm-action="open-vendor-tags">
          <div class="txd-cl-label" style="margin-bottom:4px">Tags</div>
          <div id="pm-v-tags-val" class="txd-cl-value" data-tags="${esc(JSON.stringify(vendorTags))}">
            ${tagsHtml}
          </div>
        </div>
        <button class="tx-drawer-save-btn" data-pm-action="save-vendor-classification">Save classification</button>
      </div>
    `
  }

  function pickActiveDeal(deals) {
    const list = deals || []
    return list.find(d => !['closed', 'lead'].includes(String(d.sales_status || '').toLowerCase())) || list[0] || null
  }

  function pickActivePackage(packages) {
    const list = packages || []
    return list.find(p => String(p.status || '').toLowerCase() === 'active') || list[0] || null
  }

  function renderClientBody(model) {
    const deals = model?.deals || []
    const vendors = model?.vendors || []
    const activeDeal = pickActiveDeal(deals)
    const activePackage = pickActivePackage(model?.packages || [])
    const assignedVendor = vendors[0] || activeDeal?.vendors || null

    const sessionsLeft = activePackage
      ? (activePackage.sessions_remaining != null
          ? activePackage.sessions_remaining
          : Math.max(0, (activePackage.total_sessions || 0) - (activePackage.sessions_used || 0)))
      : '—'

    const packageName = activePackage
      ? (activePackage.plan_name || `${activePackage.total_sessions || 0}-session package`)
      : '—'

    return `
      <div class="ep-card">
        <div class="ep-section-title">Assigned Vendor</div>
        <div class="ep-v">${assignedVendor ? entityLink('vendor', assignedVendor.id, assignedVendor.full_name || assignedVendor.name || '—') : '<span class="ep-muted">Not assigned</span>'}</div>
      </div>

      <div class="ep-card">
        <div class="ep-section-title">Active Package</div>
        ${activePackage
          ? `<div class="ep-kv">
              <div class="ep-k">Name</div><div class="ep-v">${entityLink('package', activePackage.id, packageName)}</div>
              <div class="ep-k">Sessions left</div><div class="ep-v">${entityLink('package', activePackage.id, String(sessionsLeft))}</div>
            </div>`
          : '<div class="ep-muted">No active package</div>'}
      </div>

      <div class="ep-card">
        <div class="ep-section-title">Deal Summary</div>
        ${activeDeal
          ? `<div class="ep-kv">
              <div class="ep-k">Product</div><div class="ep-v">${entityLink('deal', activeDeal.id, activeDeal.products?.name || 'Deal')}</div>
              <div class="ep-k">Status</div><div class="ep-v">${entityLink('deal', activeDeal.id, `${activeDeal.sales_status || '—'} · ${activeDeal.billing_status || '—'}`)}</div>
            </div>`
          : '<div class="ep-muted">No deals</div>'}
      </div>
    `
  }

  function renderPackageBody(model) {
    const pkg = model?.package || {}
    const deal = model?.deal || null
    const total = Number(pkg.total_sessions || 0)
    const used = Number(pkg.sessions_used || 0)
    const left = pkg.sessions_remaining != null
      ? Number(pkg.sessions_remaining || 0)
      : Math.max(0, total - used)
    const packageName = pkg.plan_name || `${total || 0}-session package`
    const productName = deal?.products?.name || pkg.product_name || '—'
    const vendor = pkg.vendors || null

    return `
      <div class="ep-card">
        <div class="ep-row-head">
          <div>
            <div class="ep-name">${esc(packageName)}</div>
            <div class="ep-sub">${esc(productName)}</div>
          </div>
        </div>
      </div>

      <div class="ep-card">
        <div class="ep-section-title">Sessions</div>
        <div class="ep-kv">
          <div class="ep-k">Total</div><div class="ep-v">${esc(String(total))}</div>
          <div class="ep-k">Used</div><div class="ep-v">${esc(String(used))}</div>
          <div class="ep-k">Left</div><div class="ep-v">${esc(String(left))}</div>
        </div>
      </div>

      <div class="ep-card">
        <div class="ep-section-title">Assigned Vendor</div>
        <div class="ep-v">${vendor ? entityLink('vendor', vendor.id, vendor.full_name || vendor.name || '—') : '<span class="ep-muted">Not assigned</span>'}</div>
      </div>

      <div class="ep-card">
        <div class="ep-section-title">Linked Deal</div>
        <div class="ep-v">${deal ? entityLink('deal', deal.id, deal.products?.name || `Deal #${deal.id}`) : '<span class="ep-muted">No linked deal</span>'}</div>
      </div>
    `
  }

  function editableField(label, fieldKey, value, inputType, options) {
    const optionsAttr = options ? ' data-options="' + esc(JSON.stringify(options)) + '"' : ''
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
    const itemsAttr = ' data-fk-items="' + esc(JSON.stringify(fkItems || [])) + '"'
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

  function parseTagsInput(raw) {
    return [...new Set(
      String(raw || '')
        .split(/[,;\n]/g)
        .map(t => t.trim())
        .filter(Boolean)
    )]
  }

  function closeVendorClassificationEditor({ commit = true } = {}) {
    if (!vendorClassificationEditor) return
    const current = vendorClassificationEditor
    vendorClassificationEditor = null
    if (commit && typeof current.commit === 'function') current.commit()
    if (current.el?.parentNode) current.el.parentNode.removeChild(current.el)
  }

  function renderVendorCategoryValue(catId) {
    const name = vendorClassificationLookup.categories.find(c => c.id === catId)?.name || ''
    return name ? `<span class="cl-cat-pill">${esc(name)}</span>` : '<span class="cl-placeholder">Set…</span>'
  }

  function renderVendorTaxValue(taxVal) {
    const val = String(taxVal || '')
    const taxClass = ['non_deductible', 'mixed_review'].includes(val) ? val : ''
    return val
      ? `<span class="cl-tax-badge ${taxClass}">${esc(val.replace(/_/g, ' '))}</span>`
      : '<span class="cl-placeholder">—</span>'
  }

  function renderVendorTagsValue(tags) {
    return (tags || []).length
      ? tags.map(t => `<span class="cl-tag">${esc(t)}</span>`).join('')
      : '<span class="cl-placeholder">+ Add tags</span>'
  }

  function getVendorTagsFromDom() {
    const tagsEl = document.getElementById('pm-v-tags-val')
    if (!tagsEl) return []
    try {
      const parsed = JSON.parse(tagsEl.dataset.tags || '[]')
      if (Array.isArray(parsed)) return [...new Set(parsed.map(t => String(t).trim()).filter(Boolean))]
    } catch {
      return parseTagsInput(tagsEl.dataset.tags || '')
    }
    return []
  }

  function setVendorCategory(catId, { applyDefaultTax = false } = {}) {
    const catEl = document.getElementById('pm-v-cat-val')
    if (!catEl) return
    const val = String(catId || '')
    catEl.dataset.value = val
    catEl.innerHTML = renderVendorCategoryValue(val)

    if (applyDefaultTax) {
      const cat = vendorClassificationLookup.categories.find(c => c.id === val)
      const taxEl = document.getElementById('pm-v-tax-val')
      if (cat?.tax && taxEl && !String(taxEl.dataset.value || '').trim()) {
        setVendorTax(cat.tax)
      }
    }
  }

  function setVendorTax(taxVal) {
    const taxEl = document.getElementById('pm-v-tax-val')
    if (!taxEl) return
    const val = String(taxVal || '')
    taxEl.dataset.value = val
    taxEl.innerHTML = renderVendorTaxValue(val)
  }

  function setVendorTags(tags) {
    const tagsEl = document.getElementById('pm-v-tags-val')
    if (!tagsEl) return
    const clean = [...new Set((tags || []).map(t => String(t).trim()).filter(Boolean))]
    tagsEl.dataset.tags = JSON.stringify(clean)
    tagsEl.innerHTML = renderVendorTagsValue(clean)
  }

  function openVendorCategoryPicker(anchorCell) {
    closeVendorClassificationEditor()
    const catEl = document.getElementById('pm-v-cat-val')
    if (!anchorCell || !catEl) return
    const selectedId = String(catEl.dataset.value || '')

    const dd = document.createElement('div')
    dd.className = 'cl-dropdown'
    dd.style.cssText = 'position:absolute;top:100%;right:0;left:auto;min-width:220px;z-index:400'
    const inp = document.createElement('input')
    inp.placeholder = 'Search category…'
    const list = document.createElement('div')
    list.className = 'cl-dropdown-list'
    dd.append(inp, list)

    function renderList(q) {
      const query = String(q || '').trim().toLowerCase()
      const items = vendorClassificationLookup.categories.filter(c =>
        !query || String(c.name || '').toLowerCase().includes(query)
      )
      list.innerHTML = items.map(c =>
        `<div class="cl-dropdown-item${c.id === selectedId ? ' sel' : ''}" data-id="${esc(c.id)}">${esc(c.name || c.id)}</div>`
      ).join('')
      list.querySelectorAll('.cl-dropdown-item').forEach(item => {
        item.addEventListener('mousedown', e => {
          e.preventDefault()
          const catId = item.getAttribute('data-id') || ''
          setVendorCategory(catId, { applyDefaultTax: true })
          closeVendorClassificationEditor({ commit: false })
        })
      })
    }

    inp.addEventListener('input', () => renderList(inp.value))
    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeVendorClassificationEditor({ commit: false })
      }
    })

    renderList('')
    anchorCell.style.position = 'relative'
    anchorCell.appendChild(dd)
    vendorClassificationEditor = { el: dd }
    setTimeout(() => inp.focus(), 0)
  }

  function openVendorTaxPicker(anchorCell) {
    closeVendorClassificationEditor()
    const taxEl = document.getElementById('pm-v-tax-val')
    if (!anchorCell || !taxEl) return
    const selectedTax = String(taxEl.dataset.value || '')

    const dd = document.createElement('div')
    dd.className = 'cl-dropdown'
    dd.style.cssText = 'position:absolute;top:100%;right:0;left:auto;min-width:200px;z-index:400'
    const inp = document.createElement('input')
    inp.placeholder = 'Search tax…'
    const list = document.createElement('div')
    list.className = 'cl-dropdown-list'
    dd.append(inp, list)

    function renderList(q) {
      const query = String(q || '').trim().toLowerCase()
      const items = TAX_TREATMENTS.filter(t => !query || t.includes(query))
      list.innerHTML = items.map(t =>
        `<div class="cl-dropdown-item${t === selectedTax ? ' sel' : ''}" data-val="${esc(t)}">${esc(t.replace(/_/g, ' '))}</div>`
      ).join('')
      list.querySelectorAll('.cl-dropdown-item').forEach(item => {
        item.addEventListener('mousedown', e => {
          e.preventDefault()
          setVendorTax(item.getAttribute('data-val') || '')
          closeVendorClassificationEditor({ commit: false })
        })
      })
    }

    inp.addEventListener('input', () => renderList(inp.value))
    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeVendorClassificationEditor({ commit: false })
      }
    })

    renderList('')
    anchorCell.style.position = 'relative'
    anchorCell.appendChild(dd)
    vendorClassificationEditor = { el: dd }
    setTimeout(() => inp.focus(), 0)
  }

  function openVendorTagPicker(anchorCell) {
    closeVendorClassificationEditor()
    if (!anchorCell) return
    let currentTags = getVendorTagsFromDom()

    const pop = document.createElement('div')
    pop.className = 'cl-tag-popover'
    pop.style.cssText = 'position:absolute;top:100%;right:0;left:auto;min-width:240px;z-index:400'

    function commit() {
      setVendorTags(currentTags)
    }

    function renderChips() {
      pop.innerHTML = ''

      const chipsDiv = document.createElement('div')
      chipsDiv.className = 'cl-tag-chips'
      currentTags.forEach(tag => {
        const chip = document.createElement('span')
        chip.className = 'cl-tag'
        chip.innerHTML = `${esc(tag)} <span class="cl-tag-x" data-tag="${esc(tag)}">×</span>`
        chip.querySelector('.cl-tag-x')?.addEventListener('mousedown', e => {
          e.preventDefault()
          const tagVal = e.currentTarget?.getAttribute('data-tag') || ''
          currentTags = currentTags.filter(t => t !== tagVal)
          renderChips()
        })
        chipsDiv.appendChild(chip)
      })
      pop.appendChild(chipsDiv)

      const inputWrap = document.createElement('div')
      inputWrap.className = 'cl-tag-input-wrap'
      const inp = document.createElement('input')
      inp.className = 'cl-tag-input'
      inp.placeholder = 'Add tag…'
      inputWrap.appendChild(inp)
      pop.appendChild(inputWrap)

      const ac = document.createElement('div')
      ac.className = 'cl-tag-ac'
      ac.style.display = 'none'
      inputWrap.appendChild(ac)

      function addTag(tag) {
        const clean = String(tag || '').trim()
        if (!clean || currentTags.includes(clean)) return
        currentTags.push(clean)
        inp.value = ''
        ac.style.display = 'none'
        renderChips()
      }

      inp.addEventListener('input', () => {
        const q = inp.value.toLowerCase().trim()
        if (!q) { ac.style.display = 'none'; return }
        const matches = (vendorClassificationLookup.tags || []).filter(t => {
          const low = String(t || '').toLowerCase()
          return low.includes(q) && !currentTags.includes(String(t))
        })
        if (!matches.length) { ac.style.display = 'none'; return }
        ac.style.display = 'block'
        ac.innerHTML = matches.slice(0, 10).map(t =>
          `<div class="cl-tag-ac-item" data-tag="${esc(t)}">${esc(t)}</div>`
        ).join('')
        ac.querySelectorAll('.cl-tag-ac-item').forEach(item => {
          item.addEventListener('mousedown', e => {
            e.preventDefault()
            addTag(item.getAttribute('data-tag') || '')
          })
        })
      })

      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          addTag(inp.value)
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          closeVendorClassificationEditor({ commit: true })
        }
      })

      setTimeout(() => inp.focus(), 0)
    }

    renderChips()
    anchorCell.style.position = 'relative'
    anchorCell.appendChild(pop)
    vendorClassificationEditor = { el: pop, commit }
  }

  async function saveVendorClassification(vendorId, saveBtn) {
    closeVendorClassificationEditor({ commit: true })
    const catVal = document.getElementById('pm-v-cat-val')
    const taxVal = document.getElementById('pm-v-tax-val')
    const bpBtn = document.querySelector('[data-pm-action="toggle-v-bp"]')
    const tags = getVendorTagsFromDom()
    if (!catVal || !taxVal || !bpBtn) return

    const fields = {
      category_id: catVal.dataset.value || null,
      tax_treatment: taxVal.dataset.value || null,
      entity: (bpBtn.getAttribute('data-value') || '') || null,
      tags,
    }

    const originalText = saveBtn.textContent
    saveBtn.disabled = true
    saveBtn.textContent = 'Saving…'
    try {
      if (typeof global.updateVendor !== 'function') {
        throw new Error('updateVendor() is not available')
      }
      await global.updateVendor(vendorId, fields)
      if (typeof global.showToast === 'function') global.showToast('Vendor classification saved')
      await renderCurrent()
    } catch (err) {
      if (typeof global.showToast === 'function') {
        global.showToast(err?.message || 'Failed to save classification', 'warn')
      }
    } finally {
      saveBtn.disabled = false
      saveBtn.textContent = originalText
    }
  }

  function renderBreadcrumbs() {
    if (!els.crumbs) return
    if (!state.stack.length) {
      els.crumbs.innerHTML = ''
      return
    }

    const bits = state.stack.map((entry, idx) => {
      const isLast = idx === state.stack.length - 1
      const label = esc(entry.label || fallbackLabel(entry.type, entry.id))
      if (isLast) return `<span class="panel-manager-crumb current">${label}</span>`
      return `<button class="panel-manager-crumb" data-pm-crumb-index="${idx}">${label}</button>`
    })

    els.crumbs.innerHTML = bits.join('<span class="panel-manager-crumb-sep">›</span>')
  }

  function setEntityHead(type, model) {
    if (!els.entityHead) return
    if (type !== 'client') {
      els.entityHead.innerHTML = ''
      els.entityHead.classList.remove('show')
      return
    }

    const client = model?.client || {}
    els.entityHead.innerHTML = `
      <div class="pm-client-head">
        ${avatar(client.full_name || 'Client', client.avatar_url || null, 'lg')}
        <div class="pm-client-head-text">
          <div class="pm-client-name">${esc(client.full_name || 'Client')}</div>
          <div class="pm-client-status">${statusBadge(client.status || (client.active === false ? 'inactive' : 'active'))}</div>
        </div>
      </div>
    `
    els.entityHead.classList.add('show')
  }

  function setFullLink(type, id) {
    if (!els.fullLink) return
    const href = fullProfileHref(type, id)
    if (!href) {
      els.fullLink.classList.add('hidden')
      els.fullLink.removeAttribute('href')
      return
    }
    els.fullLink.classList.remove('hidden')
    els.fullLink.href = href
  }

  function setBodyMode(type) {
    if (!els.body || !els.panel) return
    const txMode = type === 'transaction'
    els.body.classList.toggle('transaction-mode', txMode)
    els.panel.classList.toggle('transaction-mode', txMode)
  }

  function showLoading(entry) {
    if (!entry || !els.body) return
    setBodyMode(entry.type)
    setFullLink(entry.type, entry.id)
    renderBreadcrumbs()
    setEntityHead(entry.type, null)
    els.body.innerHTML = `
      <div class="pm-loading-state">
        <span class="pm-spinner" aria-hidden="true"></span>
        <span>Loading ${esc(entry.type)}…</span>
      </div>
    `
  }

  function showError(err) {
    if (!els.body) return
    const msg = err?.message || 'Failed to load panel data'
    els.body.innerHTML = `<div class="pm-error-state">${esc(msg)}</div>`
  }

  async function renderTransactionBody(txId) {
    if (!els.body) return
    els.body.innerHTML = '<div id="tx-drawer-content" class="pm-tx-host"></div>'
    if (typeof global.renderTxDrawer !== 'function') {
      throw new Error('renderTxDrawer() is not available on this page')
    }
    await global.renderTxDrawer(txId)

    const titleEl = document.querySelector('#tx-drawer-content .txd-summary-name')
    const entry = currentEntry()
    if (entry && titleEl?.textContent?.trim()) {
      entry.label = titleEl.textContent.trim()
      renderBreadcrumbs()
    }
  }

  async function renderCurrent() {
    const entry = currentEntry()
    if (!entry) {
      closePanel({ skipRouterClose: true })
      return
    }

    closeVendorClassificationEditor({ commit: false })
    const token = ++state.token
    showLoading(entry)

    try {
      let model = null

      if (entry.type === 'deal') {
        model = await loadDealModel(entry.id)
        entry.label = model?.deal?.products?.name || model?.deal?.clients?.full_name || fallbackLabel(entry.type, entry.id)
      } else if (entry.type === 'vendor') {
        model = await loadVendorModel(entry.id)
        entry.label = model?.vendor?.full_name || model?.vendor?.name || fallbackLabel(entry.type, entry.id)
      } else if (entry.type === 'client') {
        model = await loadClientModel(entry.id)
        entry.label = model?.client?.full_name || fallbackLabel(entry.type, entry.id)
      } else if (entry.type === 'package') {
        model = await loadPackageModel(entry.id)
        const pkg = model?.package || {}
        entry.label = pkg.plan_name || `${pkg.total_sessions || 0}-session package`
      }

      if (token !== state.token) return

      setBodyMode(entry.type)
      setFullLink(entry.type, entry.id)
      renderBreadcrumbs()
      setEntityHead(entry.type, model)

      if (entry.type === 'deal') {
        vendorClassificationLookup.categories = []
        vendorClassificationLookup.tags = []
        els.body.innerHTML = renderDealBody(model)
        return
      }

      if (entry.type === 'vendor') {
        vendorClassificationLookup.categories = (model?.categories || []).map(c => ({
          id: c.id,
          name: c.name || c.id,
          tax: c.tax_category || null,
        }))
        vendorClassificationLookup.tags = [...new Set((model?.tags || []).map(t => String(t).trim()).filter(Boolean))]
        els.body.innerHTML = renderVendorBody(model)
        return
      }

      if (entry.type === 'client') {
        vendorClassificationLookup.categories = []
        vendorClassificationLookup.tags = []
        els.body.innerHTML = renderClientBody(model)
        return
      }

      if (entry.type === 'package') {
        vendorClassificationLookup.categories = []
        vendorClassificationLookup.tags = []
        els.body.innerHTML = renderPackageBody(model)
        return
      }

      vendorClassificationLookup.categories = []
      vendorClassificationLookup.tags = []
      await renderTransactionBody(entry.id)
      if (token !== state.token) return
    } catch (err) {
      if (token !== state.token) return
      showError(err)
    }
  }

  function closePanel(opts = {}) {
    if (!state.open && !els.panel) return
    resetEditState()
    closeVendorClassificationEditor({ commit: false })
    setOpen(false)

    state.stack = []
    vendorClassificationLookup.categories = []
    vendorClassificationLookup.tags = []
    if (els.crumbs) els.crumbs.innerHTML = ''
    if (els.entityHead) {
      els.entityHead.innerHTML = ''
      els.entityHead.classList.remove('show')
    }
    if (els.body) els.body.innerHTML = ''

    if (opts.skipRouterClose) return

    if (global.Router && typeof global.Router.getParams === 'function') {
      const params = global.Router.getParams()
      if (params?.entity) {
        global.Router.close()
      }
    }
  }

  function open(type, id) {
    const normalized = normalizeType(type)
    const safeId = String(id || '')
    if (!SUPPORTED_TYPES.has(normalized) || !safeId) return

    initDom()

    const last = currentEntry()
    if (!last || last.type !== normalized || last.id !== safeId) {
      state.stack.push({
        type: normalized,
        id: safeId,
        label: fallbackLabel(normalized, safeId),
      })
    }

    setOpen(true)
    renderCurrent()
  }

  global.PanelManager = { open }
})(window)
