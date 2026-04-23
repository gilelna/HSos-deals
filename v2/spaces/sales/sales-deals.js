// v2/spaces/sales/sales-deals.js — Deals page (kanban + list) + Panel handler.
// Filters: search, stage, vendor, billing status. "New deal" opens the 3-step modal.

const SalesDeals = (() => {
  const STAGE_CAP = 12 // card cap per kanban column

  // ─── Page render ───────────────────────────────────────────────
  function render(mount) {
    mount.appendChild(_buildHeader())
    const views = document.createElement('div')
    views.className = 'v2-deals-views'
    mount.appendChild(views)

    const viewState = { view: 'kanban', search: '', stage: '', vendor: '', billing: '' }
    _paintControls(mount.querySelector('.v2-deals-header'), viewState, () => _paintView(views, viewState))
    _paintView(views, viewState)

    // Re-paint when state.deals changes (after a create/delete)
    State.on('sales.deals', () => _paintView(views, viewState))
  }

  function _buildHeader() {
    const header = document.createElement('header')
    header.className = 'v2-page-header v2-deals-header'
    const title = document.createElement('h1')
    title.textContent = 'Deals'
    header.appendChild(title)
    return header
  }

  function _paintControls(header, viewState, repaint) {
    // Remove prior controls if the page re-mounts
    for (const old of header.querySelectorAll('.v2-deals-controls')) old.remove()

    const bar = document.createElement('div')
    bar.className = 'v2-deals-controls'

    // View toggle
    const viewToggle = document.createElement('div')
    viewToggle.className = 'v2-view-toggle'
    for (const v of ['kanban', 'list']) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `btn btn-sm ${viewState.view === v ? 'btn-primary' : 'btn-ghost'}`
      b.textContent = v === 'kanban' ? 'Kanban' : 'List'
      b.addEventListener('click', () => {
        viewState.view = v
        _paintControls(header, viewState, repaint)
        repaint()
      })
      viewToggle.appendChild(b)
    }
    bar.appendChild(viewToggle)

    // Search
    const search = document.createElement('input')
    search.type = 'search'
    search.className = 'fi'
    search.placeholder = 'Search deals…'
    search.value = viewState.search
    let t = null
    search.addEventListener('input', e => {
      clearTimeout(t)
      t = setTimeout(() => { viewState.search = e.target.value; repaint() }, 150)
    })
    bar.appendChild(search)

    // Stage filter
    const stageSel = document.createElement('select')
    stageSel.className = 'fi'
    _fillOptions(stageSel, [{ value: '', label: 'All stages' }].concat(
      Const.DEAL_STAGES.map(s => ({ value: s, label: Const.DEAL_STAGE_LABELS[s] }))
    ), viewState.stage)
    stageSel.addEventListener('change', e => { viewState.stage = e.target.value; repaint() })
    bar.appendChild(stageSel)

    // Vendor filter
    const vendors = State.get('sales.vendors') || []
    const venSel = document.createElement('select')
    venSel.className = 'fi'
    _fillOptions(venSel, [{ value: '', label: 'All vendors' }].concat(
      vendors.map(v => ({ value: v.id, label: v.name || v.full_name || v.id }))
    ), viewState.vendor)
    venSel.addEventListener('change', e => { viewState.vendor = e.target.value; repaint() })
    bar.appendChild(venSel)

    // Billing filter
    const bilSel = document.createElement('select')
    bilSel.className = 'fi'
    _fillOptions(bilSel, [{ value: '', label: 'All billing' }].concat(
      Const.BILLING_STATUS.map(s => ({ value: s, label: Const.BILLING_STATUS_LABELS[s] }))
    ), viewState.billing)
    bilSel.addEventListener('change', e => { viewState.billing = e.target.value; repaint() })
    bar.appendChild(bilSel)

    // New deal
    const newBtn = document.createElement('button')
    newBtn.type = 'button'
    newBtn.className = 'btn btn-primary'
    newBtn.textContent = 'New deal'
    newBtn.addEventListener('click', () => SalesDealModal.open())
    bar.appendChild(newBtn)

    header.appendChild(bar)
  }

  function _fillOptions(sel, options, current) {
    while (sel.firstChild) sel.removeChild(sel.firstChild)
    for (const o of options) {
      const opt = document.createElement('option')
      opt.value = o.value
      opt.textContent = o.label
      if (String(o.value) === String(current)) opt.selected = true
      sel.appendChild(opt)
    }
  }

  function _paintView(mount, viewState) {
    while (mount.firstChild) mount.removeChild(mount.firstChild)
    const filtered = _filteredDeals(viewState)
    if (viewState.view === 'kanban') mount.appendChild(_renderKanban(filtered))
    else mount.appendChild(_renderList(filtered))
  }

  function _filteredDeals(viewState) {
    const deals = State.get('sales.deals') || []
    const q = viewState.search.trim().toLowerCase()
    const clients = State.get('sales.clients') || []
    const clientById = new Map(clients.map(c => [c.id, c]))

    return deals.filter(d => {
      if (viewState.stage && d.sales_status !== viewState.stage) return false
      if (viewState.vendor && d.primary_vendor_id !== viewState.vendor) return false
      if (viewState.billing && d.billing_status !== viewState.billing) return false
      if (q) {
        const c = clientById.get(d.client_id)
        const hay = [c?.full_name, c?.email, d.notes, d.payment_link].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }

  // ─── Kanban ────────────────────────────────────────────────────
  function _renderKanban(deals) {
    const wrap = document.createElement('div')
    wrap.className = 'v2-kanban'
    for (const stage of Const.DEAL_STAGES) {
      const col = document.createElement('section')
      col.className = 'v2-kanban-col'

      const h = document.createElement('header')
      h.className = 'v2-kanban-col-header'
      const title = document.createElement('span')
      title.className = 'v2-kanban-col-title'
      title.textContent = Const.DEAL_STAGE_LABELS[stage]
      const stageDeals = deals.filter(d => d.sales_status === stage)
      const count = document.createElement('span')
      count.className = 'v2-kanban-col-count'
      count.textContent = String(stageDeals.length)
      h.append(title, count)
      col.appendChild(h)

      const list = document.createElement('div')
      list.className = 'v2-kanban-list'
      const visible = stageDeals.slice(0, STAGE_CAP)
      for (const d of visible) list.appendChild(_kanbanCard(d))
      if (stageDeals.length > STAGE_CAP) {
        const more = document.createElement('div')
        more.className = 'v2-kanban-more'
        more.textContent = `+ ${stageDeals.length - STAGE_CAP} more`
        list.appendChild(more)
      }
      col.appendChild(list)
      wrap.appendChild(col)
    }
    return wrap
  }

  function _kanbanCard(d) {
    const clients = State.get('sales.clients') || []
    const products = State.get('sales.products') || []
    const client = clients.find(c => c.id === d.client_id)
    const product = products.find(p => p.id === d.product_id)

    const card = document.createElement('article')
    card.className = 'v2-kanban-card v2-row-clickable'
    card.dataset.id = d.id
    card.addEventListener('click', () => Router.open({ entity: 'deal', id: d.id }))

    const name = document.createElement('div')
    name.className = 'v2-kanban-card-name'
    name.textContent = client?.full_name || '(no client)'
    card.appendChild(name)

    if (product?.name) {
      const prod = document.createElement('div')
      prod.className = 'v2-kanban-card-product'
      prod.textContent = product.name
      card.appendChild(prod)
    }

    const meta = document.createElement('div')
    meta.className = 'v2-kanban-card-meta'
    const price = document.createElement('span')
    price.textContent = Utils.formatCurrency(d.price, d.currency) || ''
    meta.appendChild(price)
    if (d.billing_status) meta.insertAdjacentHTML('beforeend', Badges.billingStatus(d.billing_status))
    card.appendChild(meta)
    return card
  }

  // ─── List ──────────────────────────────────────────────────────
  function _renderList(deals) {
    const clients = State.get('sales.clients') || []
    const products = State.get('sales.products') || []
    const vendors = State.get('sales.vendors') || []
    const clientById = new Map(clients.map(c => [c.id, c]))
    const productById = new Map(products.map(p => [p.id, p]))
    const vendorById = new Map(vendors.map(v => [v.id, v]))

    const rows = deals.map(d => ({
      ...d,
      _clientName: clientById.get(d.client_id)?.full_name || '',
      _productName: productById.get(d.product_id)?.name || '',
      _vendorName: vendorById.get(d.primary_vendor_id)?.name || ''
    }))

    const container = document.createElement('div')
    Table.create({
      container,
      columns: [
        { key: '_clientName',  label: 'Client' },
        { key: '_productName', label: 'Product' },
        { key: '_vendorName',  label: 'Vendor' },
        { key: 'price',        label: 'Price', render: d => Utils.formatCurrency(d.price, d.currency) },
        { key: 'sales_status',   label: 'Stage',    raw: true, render: d => Badges.dealStatus(d.sales_status) },
        { key: 'billing_status', label: 'Billing',  raw: true, render: d => Badges.billingStatus(d.billing_status) }
      ],
      rows,
      onRowClick: d => Router.open({ entity: 'deal', id: d.id }),
      exportFilename: 'deals.csv',
      pageSize: 50
    })
    return container
  }

  // ─── Panel handler ─────────────────────────────────────────────
  const panelHandler = {
    async load(id) {
      return await DB.getDeal(id)
    },
    render(entity, ctx) {
      const clients = State.get('sales.clients') || []
      const products = State.get('sales.products') || []
      const vendors = State.get('sales.vendors') || []
      const client = clients.find(c => c.id === entity.client_id)
      const product = products.find(p => p.id === entity.product_id)
      const vendor = vendors.find(v => v.id === entity.primary_vendor_id)

      return {
        title: client?.full_name || '(no client)',
        subtitle: product?.name || '—',
        tabs: [
          { label: 'Overview', content: _overviewTab(entity, ctx, { client, product, vendor }) },
          { label: 'Sessions', content: _sessionsTab(entity) },
          { label: 'Packages', content: _packagesTab(entity) },
          { label: 'Activity', content: _activityTab(entity) }
        ]
      }
    },
    async save(id, edits) {
      const updated = await DB.updateDeal(id, edits)
      const deals = State.get('sales.deals') || []
      State.set('sales.deals', deals.map(d => d.id === id ? updated : d))
      return updated
    }
  }

  function _overviewTab(deal, ctx, refs) {
    const wrap = document.createElement('div')
    wrap.className = 'v2-panel-overview'
    const effective = { ...deal, ...(ctx.pendingEdits || {}) }
    const canEdit = Guard.action('deal.edit') && ctx.canEdit

    wrap.appendChild(_field('Price', Utils.formatCurrency(effective.price, effective.currency), () => {
      if (!canEdit) return null
      _promptText('Edit price', effective.price || '', v => Panel.edit('price', Number(v) || 0))
    }))
    wrap.appendChild(_field('Stage', effective.sales_status, () => {
      if (!canEdit) return null
      _promptSelect('Stage', Const.DEAL_STAGES, effective.sales_status, v => Panel.edit('sales_status', v))
    }))
    wrap.appendChild(_field('Billing', effective.billing_status, () => {
      if (!canEdit) return null
      _promptSelect('Billing status', Const.BILLING_STATUS, effective.billing_status, v => Panel.edit('billing_status', v))
    }))
    wrap.appendChild(_field('Payment link', effective.payment_link, () => {
      if (!canEdit) return null
      _promptText('Payment link', effective.payment_link || '', v => Panel.edit('payment_link', v))
    }))
    wrap.appendChild(_field('Vendor', refs.vendor?.name || '—'))
    return wrap
  }

  function _sessionsTab(deal) {
    const wrap = document.createElement('div')
    wrap.textContent = 'Loading sessions…'
    DB.getSessions({ /* no deal filter yet */ }).then(rows => {
      wrap.textContent = ''
      const dealSessions = rows.filter(s => s.deal_id === deal.id)
      if (!dealSessions.length) {
        wrap.textContent = 'No sessions logged for this deal yet.'
        return
      }
      const list = document.createElement('ul')
      list.className = 'v2-panel-list'
      for (const s of dealSessions) {
        const li = document.createElement('li')
        li.textContent = `${Utils.formatDate(s.session_date)} — ${s.hours || 0}h`
        list.appendChild(li)
      }
      wrap.appendChild(list)
    }).catch(err => {
      wrap.textContent = err.message || 'Failed to load sessions'
    })
    return wrap
  }

  function _packagesTab(deal) {
    const wrap = document.createElement('div')
    wrap.textContent = 'Loading packages…'
    DB.getPackages().then(pkgs => {
      wrap.textContent = ''
      const forDeal = pkgs.filter(p => p.deal_id === deal.id)
      if (!forDeal.length) { wrap.textContent = 'No packages for this deal.'; return }
      const list = document.createElement('ul')
      list.className = 'v2-panel-list'
      for (const p of forDeal) {
        const li = document.createElement('li')
        const tot = p.sessions_total ?? p.total_sessions ?? 0
        li.textContent = `${p.sessions_used || 0}/${tot} sessions — ${p.status}`
        list.appendChild(li)
      }
      wrap.appendChild(list)
    }).catch(err => wrap.textContent = err.message || 'Failed')
    return wrap
  }

  function _activityTab(deal) {
    const wrap = document.createElement('div')
    wrap.textContent = 'Loading activity…'
    DB.getActivities({ entity_type: 'deal', entity_id: deal.id }).then(rows => {
      wrap.textContent = ''
      if (!rows.length) { wrap.textContent = 'No activity yet.'; return }
      const list = document.createElement('ul')
      list.className = 'v2-panel-list'
      for (const a of rows) {
        const li = document.createElement('li')
        const when = document.createElement('span')
        when.className = 'v2-panel-when'
        when.textContent = Utils.formatDate(a.created_at) + ' — '
        const body = document.createElement('span')
        body.textContent = a.body || a.subtype || a.type
        li.append(when, body)
        list.appendChild(li)
      }
      wrap.appendChild(list)
    }).catch(err => wrap.textContent = err.message || 'Failed')
    return wrap
  }

  function _field(label, value, onEdit) {
    const row = document.createElement('div')
    row.className = 'v2-panel-field'
    const l = document.createElement('div')
    l.className = 'v2-panel-field-label'
    l.textContent = label
    const v = document.createElement('div')
    v.className = 'v2-panel-field-value'
    v.textContent = value || '—'
    if (typeof onEdit === 'function') {
      v.classList.add('v2-panel-field-editable')
      v.addEventListener('click', onEdit)
    }
    row.append(l, v)
    return row
  }

  function _promptText(title, value, onSave) {
    const wrap = document.createElement('div')
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'fi'
    input.value = value
    wrap.appendChild(input)
    const m = Modal.open({
      title,
      size: 'sm',
      body: wrap,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Set', variant: 'primary', onClick: () => { onSave(input.value); m.close() } }
      ]
    })
  }

  function _promptSelect(title, options, value, onSave) {
    const wrap = document.createElement('div')
    const sel = document.createElement('select')
    sel.className = 'fi'
    for (const o of options) {
      const opt = document.createElement('option')
      opt.value = o
      opt.textContent = o
      if (o === value) opt.selected = true
      sel.appendChild(opt)
    }
    wrap.appendChild(sel)
    const m = Modal.open({
      title,
      size: 'sm',
      body: wrap,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Set', variant: 'primary', onClick: () => { onSave(sel.value); m.close() } }
      ]
    })
  }

  return { render, panelHandler }
})()

window.SalesDeals = SalesDeals
