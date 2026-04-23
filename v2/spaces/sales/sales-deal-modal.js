// v2/spaces/sales/sales-deal-modal.js — 3-step new-deal wizard.
// Step 1: choose or create client
// Step 2: choose product + plan (product→plan chained)
// Step 3: fill deal details (price, currency, VAT, processor, notes)
// On save: create deal; auto-create package if product.type=PACKAGE; auto-assign vendor.

const SalesDealModal = (() => {
  let _modal = null
  let _state = null   // { step, clientId, productId, planId, fields, vendors }

  function open() {
    _state = {
      step: 1,
      clientId: null,
      productId: null,
      planId: null,
      vendorId: null,
      fields: {
        price: '',
        currency: 'USD',
        vat: 0,
        vat_mode: 'excl',
        payment_processor: 'stripe',
        payment_link: '',
        notes: ''
      }
    }
    _modal = Modal.open({
      title: 'New deal — step 1 of 3',
      size: 'md',
      body: _renderStep(),
      actions: _footer()
    })
  }

  function _rePaint() {
    if (!_modal) return
    _modal.setTitle(`New deal — step ${_state.step} of 3`)
    _modal.setBody(_renderStep())
    // Replace footer
    const old = _modal.box.querySelector('footer.v2-modal-footer')
    if (old) old.remove()
    const footer = document.createElement('footer')
    footer.className = 'v2-modal-footer'
    for (const a of _footer()) footer.appendChild(_button(a))
    _modal.box.appendChild(footer)
  }

  function _footer() {
    const actions = []
    actions.push({ label: 'Cancel', variant: 'ghost', onClick: () => _modal.close() })
    if (_state.step > 1) {
      actions.push({ label: 'Back', variant: 'ghost', onClick: () => { _state.step--; _rePaint() } })
    }
    if (_state.step < 3) {
      actions.push({ label: 'Next', variant: 'primary', onClick: () => _nextStep() })
    } else {
      actions.push({ label: 'Create deal', variant: 'primary', onClick: () => _submit() })
    }
    return actions
  }

  function _button({ label, variant = 'ghost', onClick }) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `btn btn-${variant}`
    b.textContent = label
    b.addEventListener('click', async () => {
      b.disabled = true
      try { await onClick() } catch (err) {
        console.error('[DealModal]', err); Utils.showToast(err.message || 'Action failed', 'error')
      } finally { b.disabled = false }
    })
    return b
  }

  function _nextStep() {
    if (_state.step === 1 && !_state.clientId) {
      Utils.showToast('Pick or create a client first', 'warn')
      return
    }
    if (_state.step === 2 && (!_state.productId || !_state.planId)) {
      Utils.showToast('Pick a product and plan', 'warn')
      return
    }
    if (_state.step === 2) {
      // Prefill step 3 from the selected plan.
      const products = State.get('sales.products') || []
      const prod = products.find(p => p.id === _state.productId)
      const plan = (prod?.plans || []).find(p => p.id === _state.planId)
      if (plan) {
        _state.fields.price = plan.amount || ''
        _state.fields.currency = plan.currency || prod.currency || 'USD'
        if (plan.link_url) _state.fields.payment_link = plan.link_url
      }
    }
    _state.step++
    _rePaint()
  }

  function _renderStep() {
    if (_state.step === 1) return _stepClient()
    if (_state.step === 2) return _stepProduct()
    return _stepDetails()
  }

  // ─── Step 1: Client ───────────────────────────────────────────
  function _stepClient() {
    const wrap = document.createElement('div')
    wrap.className = 'v2-deal-step'

    const search = document.createElement('input')
    search.type = 'search'
    search.className = 'fi'
    search.placeholder = 'Search existing clients…'
    wrap.appendChild(search)

    const list = document.createElement('div')
    list.className = 'v2-deal-client-list'
    wrap.appendChild(list)

    const quickHeader = document.createElement('div')
    quickHeader.className = 'v2-deal-quick-header'
    quickHeader.textContent = 'Or create a new client'
    wrap.appendChild(quickHeader)

    const quickForm = document.createElement('div')
    quickForm.className = 'v2-deal-quick-form'
    quickForm.insertAdjacentHTML('afterbegin', Form.input({ id: 'newClientName', label: 'Full name', required: true }))
    quickForm.insertAdjacentHTML('beforeend', Form.input({ id: 'newClientEmail', label: 'Email', type: 'email' }))
    const createBtn = document.createElement('button')
    createBtn.type = 'button'
    createBtn.className = 'btn btn-sm'
    createBtn.textContent = 'Create client'
    createBtn.addEventListener('click', async () => {
      const name = quickForm.querySelector('#newClientName').value.trim()
      const email = quickForm.querySelector('#newClientEmail').value.trim()
      if (!name) { Utils.showToast('Name is required', 'warn'); return }
      try {
        const client = await DB.createClient({ full_name: name, email: email || null, kind: 'private' })
        const clients = State.get('sales.clients') || []
        State.set('sales.clients', [client, ...clients])
        _state.clientId = client.id
        _repaintClientList(list, search.value, _state.clientId)
        Utils.showToast('Client created', 'success')
      } catch (err) {
        Utils.showToast(err.message || 'Failed to create', 'error')
      }
    })
    quickForm.appendChild(createBtn)
    wrap.appendChild(quickForm)

    search.addEventListener('input', e => _repaintClientList(list, e.target.value, _state.clientId))
    _repaintClientList(list, '', _state.clientId)
    return wrap
  }

  function _repaintClientList(list, q, selectedId) {
    const clients = State.get('sales.clients') || []
    const needle = (q || '').trim().toLowerCase()
    const matches = clients.filter(c => {
      if (!needle) return true
      const hay = [c.full_name, c.email, c.company_name].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(needle)
    }).slice(0, 20)

    while (list.firstChild) list.removeChild(list.firstChild)
    if (!matches.length) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'No matches'
      list.appendChild(empty)
      return
    }
    for (const c of matches) {
      const row = document.createElement('button')
      row.type = 'button'
      row.className = `v2-deal-client-row${c.id === selectedId ? ' v2-selected' : ''}`
      row.textContent = c.full_name + (c.email ? ` — ${c.email}` : '')
      row.addEventListener('click', () => {
        _state.clientId = c.id
        _repaintClientList(list, q, _state.clientId)
      })
      list.appendChild(row)
    }
  }

  // ─── Step 2: Product + plan ───────────────────────────────────
  function _stepProduct() {
    const wrap = document.createElement('div')
    wrap.className = 'v2-deal-step'

    const products = State.get('sales.products') || []
    const prodSel = document.createElement('select')
    prodSel.className = 'fi'
    const blank = document.createElement('option')
    blank.value = ''
    blank.textContent = '— Choose product —'
    prodSel.appendChild(blank)
    for (const p of products) {
      if (p.status === 'archived') continue
      const o = document.createElement('option')
      o.value = p.id
      o.textContent = p.name
      if (p.id === _state.productId) o.selected = true
      prodSel.appendChild(o)
    }

    const prodLabel = document.createElement('label')
    prodLabel.className = 'fl'
    prodLabel.textContent = 'Product'
    wrap.append(prodLabel, prodSel)

    const planWrap = document.createElement('div')
    planWrap.className = 'v2-deal-plan-wrap'
    wrap.appendChild(planWrap)

    function repaintPlans() {
      while (planWrap.firstChild) planWrap.removeChild(planWrap.firstChild)
      const prod = products.find(p => p.id === _state.productId)
      if (!prod) return
      const plans = (prod.plans || []).filter(p => p.status !== 'archived')
      if (!plans.length) {
        const empty = document.createElement('div')
        empty.className = 'v2-empty'
        empty.textContent = 'No plans for this product'
        planWrap.appendChild(empty)
        return
      }
      const label = document.createElement('label')
      label.className = 'fl'
      label.textContent = 'Plan'
      planWrap.appendChild(label)
      for (const plan of plans) {
        const card = document.createElement('button')
        card.type = 'button'
        card.className = `v2-deal-plan-card${plan.id === _state.planId ? ' v2-selected' : ''}`
        const name = document.createElement('div')
        name.className = 'v2-deal-plan-name'
        name.textContent = plan.name || plan.plan_type || '(unnamed)'
        const meta = document.createElement('div')
        meta.className = 'v2-deal-plan-meta'
        const price = Utils.formatCurrency(plan.amount, plan.currency)
        meta.textContent = `${plan.plan_type || 'One payment'}${price ? ' · ' + price : ''}`
        card.append(name, meta)
        card.addEventListener('click', () => {
          _state.planId = plan.id
          repaintPlans()
        })
        planWrap.appendChild(card)
      }
    }

    prodSel.addEventListener('change', e => {
      _state.productId = e.target.value || null
      _state.planId = null
      repaintPlans()
    })
    repaintPlans()
    return wrap
  }

  // ─── Step 3: Details ──────────────────────────────────────────
  function _stepDetails() {
    const wrap = document.createElement('div')
    wrap.className = 'v2-deal-step'

    const form = document.createElement('form')
    form.noValidate = true
    form.addEventListener('submit', e => e.preventDefault())

    const f = _state.fields
    const vendors = State.get('sales.vendors') || []

    form.insertAdjacentHTML('beforeend', Form.input({ id: 'price', label: 'Price', type: 'number', value: f.price, required: true, step: '0.01' }))
    form.insertAdjacentHTML('beforeend', Form.select({ id: 'currency', label: 'Currency', options: Const.CURRENCIES.map(c => ({ value: c, label: c })), value: f.currency }))
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'vat', label: 'VAT %', type: 'number', value: f.vat, step: '0.01' }))
    form.insertAdjacentHTML('beforeend', Form.select({ id: 'vat_mode', label: 'VAT mode', options: Const.VAT_MODES.map(v => ({ value: v, label: v })), value: f.vat_mode }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'payment_processor', label: 'Payment processor',
      options: Const.PAYMENT_PROCESSORS.map(p => ({ value: p, label: Const.PAYMENT_PROCESSOR_LABELS[p] })),
      value: f.payment_processor
    }))
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'payment_link', label: 'Payment link', value: f.payment_link }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'vendor', label: 'Assign vendor',
      options: [{ value: '', label: '— none —' }].concat(
        vendors.map(v => ({ value: v.id, label: v.name || v.id }))
      ),
      value: _state.vendorId || ''
    }))
    form.insertAdjacentHTML('beforeend', Form.textarea({ id: 'notes', label: 'Notes', value: f.notes, rows: 4 }))
    wrap.appendChild(form)

    // Bind changes back to _state
    form.addEventListener('input', e => {
      const t = e.target
      if (!t.name) return
      if (t.name === 'vendor') _state.vendorId = t.value || null
      else if (t.name in _state.fields) _state.fields[t.name] = t.type === 'number' ? (t.value === '' ? '' : Number(t.value)) : t.value
    })
    return wrap
  }

  // ─── Submit ───────────────────────────────────────────────────
  async function _submit() {
    const f = _state.fields
    if (f.price === '' || Number(f.price) <= 0) { Utils.showToast('Price is required', 'warn'); return }

    const products = State.get('sales.products') || []
    const prod = products.find(p => p.id === _state.productId)

    const fields = {
      client_id: _state.clientId,
      product_id: _state.productId,
      product_plan_id: _state.planId,
      primary_vendor_id: _state.vendorId || null,
      price: Number(f.price),
      currency: f.currency,
      vat: Number(f.vat) || 0,
      vat_mode: f.vat_mode,
      payment_processor: f.payment_processor,
      payment_link: f.payment_link || null,
      notes: f.notes || null,
      sales_status: 'lead',
      billing_status: 'pending',
      origin: 'manual'
    }

    try {
      const deal = await DB.createDeal(fields)
      // Auto-create package if product.type=PACKAGE
      if (prod?.type === 'PACKAGE' && Number(prod.sessions_included) > 0) {
        await DB.createPackage({
          deal_id: deal.id,
          client_id: deal.client_id,
          vendor_id: deal.primary_vendor_id,
          sessions_total: Number(prod.sessions_included),
          sessions_used: 0,
          sessions_remaining: Number(prod.sessions_included),
          status: 'active'
        }).catch(err => console.error('[DealModal] package create failed', err))
      }
      // Auto-assign vendor → client (skip if vendor id isn't a uuid — DB.assignVendorClient will throw)
      if (deal.primary_vendor_id) {
        try { await DB.assignVendorClient(deal.primary_vendor_id, deal.client_id) }
        catch (err) { console.error('[DealModal] vendor-client assign skipped', err) }
      }
      // Update cached deals list
      const deals = State.get('sales.deals') || []
      State.set('sales.deals', [deal, ...deals])

      _modal.close()
      Utils.showToast('Deal created', 'success')
      Router.open({ entity: 'deal', id: deal.id })
    } catch (err) {
      Utils.showToast(err.message || 'Failed to create deal', 'error')
    }
  }

  return { open }
})()

window.SalesDealModal = SalesDealModal
