// v2/spaces/sales/sales-vendors.js — Vendors page + Panel handler.
// Grouped by vendor_type (coach, contractor, team_member, merchant).
// Panel tabs: Profile | Rates | Clients | Activity.

const SalesVendors = (() => {
  function render(mount) {
    const header = document.createElement('header')
    header.className = 'v2-page-header'
    const title = document.createElement('h1')
    title.textContent = 'Vendors'
    header.appendChild(title)

    const controls = document.createElement('div')
    controls.className = 'v2-page-controls'
    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn-primary'
    addBtn.textContent = 'Add vendor'
    addBtn.addEventListener('click', _openAddVendor)
    controls.appendChild(addBtn)
    header.appendChild(controls)
    mount.appendChild(header)

    const body = document.createElement('div')
    body.className = 'v2-vendors-body'
    mount.appendChild(body)

    _paintList(body)
    State.on('sales.vendors', () => _paintList(body))
  }

  function _paintList(container) {
    while (container.firstChild) container.removeChild(container.firstChild)
    const vendors = State.get('sales.vendors') || []
    for (const type of Const.VENDOR_TYPES) {
      const group = vendors.filter(v => v.vendor_type === type)
      if (!group.length) continue
      const section = document.createElement('section')
      section.className = 'v2-vendor-group'
      const h = document.createElement('h2')
      h.className = 'v2-vendor-group-title'
      h.textContent = `${Const.VENDOR_TYPE_LABELS[type]} (${group.length})`
      section.appendChild(h)
      const grid = document.createElement('div')
      grid.className = 'v2-vendor-grid'
      for (const v of group) grid.appendChild(_vendorCard(v))
      section.appendChild(grid)
      container.appendChild(section)
    }
    const orphans = vendors.filter(v => !Const.VENDOR_TYPES.includes(v.vendor_type))
    if (orphans.length) {
      const section = document.createElement('section')
      section.className = 'v2-vendor-group'
      const h = document.createElement('h2')
      h.className = 'v2-vendor-group-title'
      h.textContent = `Other (${orphans.length})`
      section.appendChild(h)
      const grid = document.createElement('div')
      grid.className = 'v2-vendor-grid'
      for (const v of orphans) grid.appendChild(_vendorCard(v))
      section.appendChild(grid)
      container.appendChild(section)
    }
    if (!vendors.length) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'No vendors yet'
      container.appendChild(empty)
    }
  }

  function _vendorCard(v) {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'v2-vendor-card v2-row-clickable'
    card.dataset.id = v.id
    card.addEventListener('click', () => Router.open({ entity: 'vendor', id: v.id }))

    const name = document.createElement('div')
    name.className = 'v2-vendor-card-name'
    name.textContent = v.name || v.full_name || v.id
    card.appendChild(name)

    const meta = document.createElement('div')
    meta.className = 'v2-vendor-card-meta'
    meta.insertAdjacentHTML('beforeend', Badges.vendorType(v.vendor_type))
    if (v.currency) {
      const cur = document.createElement('span')
      cur.className = 'v2-vendor-card-cur'
      cur.textContent = v.currency
      meta.appendChild(cur)
    }
    card.appendChild(meta)

    if (v.email) {
      const email = document.createElement('div')
      email.className = 'v2-vendor-card-email'
      email.textContent = v.email
      card.appendChild(email)
    }
    return card
  }

  function _openAddVendor() {
    const form = document.createElement('form')
    form.noValidate = true
    form.addEventListener('submit', e => e.preventDefault())
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'name', label: 'Name', required: true }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'vendor_type', label: 'Type',
      options: Const.VENDOR_TYPES.map(t => ({ value: t, label: Const.VENDOR_TYPE_LABELS[t] })),
      value: 'coach'
    }))
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'email', label: 'Email', type: 'email' }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'currency', label: 'Currency',
      options: Const.CURRENCIES.map(c => ({ value: c, label: c })),
      value: 'USD'
    }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'payout_currency', label: 'Payout currency',
      options: Const.CURRENCIES.map(c => ({ value: c, label: c })),
      value: 'USD'
    }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'entity', label: 'Entity',
      options: [{ value: 'business', label: 'Business' }, { value: 'private', label: 'Private' }],
      value: 'business'
    }))

    const m = Modal.open({
      title: 'Add vendor',
      size: 'md',
      body: form,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Create', variant: 'primary', onClick: async () => {
          const { valid, errors, values } = Form.validate(form)
          if (!valid) { Form.showErrors(form, errors); return }
          try {
            const created = await DB.createVendor({ ...values, is_active: true })
            const vendors = State.get('sales.vendors') || []
            State.set('sales.vendors', [created, ...vendors])
            m.close()
            Utils.showToast('Vendor created', 'success')
          } catch (err) {
            Utils.showToast(err.message || 'Failed to create', 'error')
          }
        } }
      ]
    })
  }

  // ─── Panel handler ─────────────────────────────────────────────
  const panelHandler = {
    async load(id) { return await DB.getVendor(id) },
    render(entity, ctx) {
      return {
        title: entity.name || entity.full_name || entity.id,
        subtitle: Const.VENDOR_TYPE_LABELS[entity.vendor_type] || '—',
        tabs: [
          { label: 'Profile',  content: _profile(entity, ctx) },
          { label: 'Rates',    content: _rates(entity) },
          { label: 'Clients',  content: _clients(entity) },
          { label: 'Activity', content: _activity(entity) }
        ]
      }
    },
    async save(id, edits) {
      const updated = await DB.updateVendor(id, edits)
      const vendors = State.get('sales.vendors') || []
      State.set('sales.vendors', vendors.map(v => v.id === id ? updated : v))
      return updated
    }
  }

  function _profile(v, ctx) {
    const wrap = document.createElement('div')
    const eff = { ...v, ...(ctx.pendingEdits || {}) }
    const canEdit = Guard.action('vendor.edit') && ctx.canEdit

    const fields = [
      ['name', 'Name'],
      ['email', 'Email'],
      ['currency', 'Currency'],
      ['payout_currency', 'Payout currency'],
      ['paying_company', 'Paying company'],
      ['entity', 'Entity']
    ]
    for (const [key, label] of fields) {
      wrap.appendChild(_field(label, eff[key], () => {
        if (!canEdit) return
        _promptText(label, eff[key] || '', val => Panel.edit(key, val || null))
      }))
    }
    // Tags (comma-joined inline editor)
    wrap.appendChild(_field('Tags', (eff.tags || []).join(', '), () => {
      if (!canEdit) return
      _promptText('Tags (comma-separated)', (eff.tags || []).join(', '), val => {
        const arr = val.split(',').map(s => s.trim()).filter(Boolean)
        Panel.edit('tags', arr)
      })
    }))
    return wrap
  }

  function _rates(v) {
    const wrap = document.createElement('div')
    wrap.textContent = 'Loading rates…'
    DB.getRates(v.id).then(rates => {
      wrap.textContent = ''
      if (!rates.length) { wrap.textContent = 'No rates configured for this vendor.'; return }
      const list = document.createElement('ul')
      list.className = 'v2-panel-list'
      for (const r of rates) {
        const li = document.createElement('li')
        const label = r.name || r.session_type || '(unknown)'
        li.textContent = `${label} — ${Utils.formatCurrency(r.rate, r.currency)}`
        list.appendChild(li)
      }
      wrap.appendChild(list)
    }).catch(err => wrap.textContent = err.message || 'Failed')
    return wrap
  }

  function _clients(v) {
    const wrap = document.createElement('div')
    wrap.textContent = 'Loading clients…'
    Promise.all([DB.getVendorClientAssignments(), DB.getClients()]).then(([assignments, clients]) => {
      wrap.textContent = ''
      const vendorUuid = DB._toUUID(v.id)
      const myClientIds = new Set(assignments.filter(a => a.vendor_id === vendorUuid).map(a => a.client_id))
      const mine = clients.filter(c => myClientIds.has(c.id))
      if (!mine.length) { wrap.textContent = 'No clients assigned.'; return }
      const list = document.createElement('ul')
      list.className = 'v2-panel-list'
      for (const c of mine) {
        const li = document.createElement('li')
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'v2-panel-list-btn'
        btn.textContent = c.full_name + (c.email ? ` — ${c.email}` : '')
        btn.addEventListener('click', () => Panel.push('client', c.id))
        li.appendChild(btn)
        list.appendChild(li)
      }
      wrap.appendChild(list)
    }).catch(err => wrap.textContent = err.message || 'Failed')
    return wrap
  }

  function _activity(v) {
    const wrap = document.createElement('div')
    wrap.textContent = 'Loading activity…'
    DB.getActivities({ entity_type: 'vendor', entity_id: v.id }).then(rows => {
      wrap.textContent = ''
      if (!rows.length) { wrap.textContent = 'No activity yet.'; return }
      const list = document.createElement('ul')
      list.className = 'v2-panel-list'
      for (const a of rows) {
        const li = document.createElement('li')
        li.textContent = `${Utils.formatDate(a.created_at)} — ${a.body || a.subtype || a.type}`
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
    const val = document.createElement('div')
    val.className = 'v2-panel-field-value'
    val.textContent = value || '—'
    if (typeof onEdit === 'function') {
      val.classList.add('v2-panel-field-editable')
      val.addEventListener('click', onEdit)
    }
    row.append(l, val)
    return row
  }

  function _promptText(title, value, onSave) {
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'fi'
    input.value = value
    const m = Modal.open({
      title, size: 'sm', body: input,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Set', variant: 'primary', onClick: () => { onSave(input.value); m.close() } }
      ]
    })
  }

  return { render, panelHandler }
})()

window.SalesVendors = SalesVendors
