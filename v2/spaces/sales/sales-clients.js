// v2/spaces/sales/sales-clients.js — Clients page + Panel handler.
// List (with deal count), add client, AC import, panel detail.

const SalesClients = (() => {
  function render(mount) {
    const header = document.createElement('header')
    header.className = 'v2-page-header'
    const title = document.createElement('h1')
    title.textContent = 'Clients'
    header.appendChild(title)

    const controls = document.createElement('div')
    controls.className = 'v2-page-controls'

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn-primary'
    addBtn.textContent = 'Add client'
    addBtn.addEventListener('click', _openAddClient)
    controls.appendChild(addBtn)

    const importBtn = document.createElement('button')
    importBtn.type = 'button'
    importBtn.className = 'btn'
    importBtn.textContent = 'Import from AC'
    importBtn.addEventListener('click', _openAcImport)
    controls.appendChild(importBtn)

    header.appendChild(controls)
    mount.appendChild(header)

    const body = document.createElement('div')
    body.className = 'v2-clients-body'
    mount.appendChild(body)

    _paintList(body)
    State.on('sales.clients', () => _paintList(body))
    State.on('sales.deals',   () => _paintList(body))
  }

  function _paintList(container) {
    while (container.firstChild) container.removeChild(container.firstChild)
    const clients = State.get('sales.clients') || []
    const deals = State.get('sales.deals') || []
    const dealCount = new Map()
    for (const d of deals) dealCount.set(d.client_id, (dealCount.get(d.client_id) || 0) + 1)

    const rows = clients.map(c => ({
      ...c,
      _deals: dealCount.get(c.id) || 0
    }))
    Table.create({
      container,
      columns: [
        { key: 'full_name',    label: 'Name' },
        { key: 'email',        label: 'Email' },
        { key: 'phone',        label: 'Phone' },
        { key: 'client_kind',  label: 'Kind' },
        { key: 'company',      label: 'Company' },
        { key: '_deals',       label: 'Deals' }
      ],
      rows,
      onRowClick: c => Router.open({ entity: 'client', id: c.id }),
      exportFilename: 'clients.csv',
      pageSize: 50
    })
  }

  // ─── Add client ────────────────────────────────────────────────
  function _openAddClient() {
    const form = document.createElement('form')
    form.noValidate = true
    form.addEventListener('submit', e => e.preventDefault())
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'full_name', label: 'Full name', required: true }))
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'email', label: 'Email', type: 'email' }))
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'phone', label: 'Phone' }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'client_kind', label: 'Kind',
      options: [{ value: 'private', label: 'Private' }, { value: 'corporate', label: 'Corporate' }],
      value: 'private'
    }))
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'company', label: 'Company (if corporate)' }))
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'source', label: 'Source' }))

    const m = Modal.open({
      title: 'Add client',
      size: 'md',
      body: form,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Create', variant: 'primary', onClick: async () => {
          const { valid, errors, values } = Form.validate(form)
          if (!valid) { Form.showErrors(form, errors); return }
          try {
            const created = await DB.createClient(values)
            const clients = State.get('sales.clients') || []
            State.set('sales.clients', [created, ...clients])
            m.close()
            Utils.showToast('Client created', 'success')
          } catch (err) {
            Utils.showToast(err.message || 'Failed to create', 'error')
          }
        } }
      ]
    })
  }

  // ─── AC import (paste JSON or CSV) ─────────────────────────────
  function _openAcImport() {
    const wrap = document.createElement('div')
    wrap.className = 'v2-ac-import'

    const hint = document.createElement('div')
    hint.className = 'v2-form-hint'
    hint.textContent = 'Paste ActiveCampaign contacts as JSON array or CSV with a header row.'
    wrap.appendChild(hint)

    const textarea = document.createElement('textarea')
    textarea.className = 'fi'
    textarea.rows = 10
    textarea.placeholder = 'Paste JSON or CSV here…'
    wrap.appendChild(textarea)

    const review = document.createElement('div')
    review.className = 'v2-ac-review'
    wrap.appendChild(review)

    let parsed = []

    const m = Modal.open({
      title: 'Import from ActiveCampaign',
      size: 'lg',
      body: wrap,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Parse & review', variant: 'ghost', onClick: () => {
          const text = textarea.value.trim()
          if (!text) { Utils.showToast('Paste something first', 'warn'); return }
          try {
            parsed = _parseAc(text)
          } catch (err) {
            Utils.showToast(err.message || 'Parse failed', 'error')
            return
          }
          _paintReview(review, parsed)
        } },
        { label: 'Import selected', variant: 'primary', onClick: async () => {
          const selected = parsed.filter(r => r._selected && r.full_name)
          if (!selected.length) { Utils.showToast('Nothing to import', 'warn'); return }
          try {
            const created = []
            for (const r of selected) {
              const { _selected, ...fields } = r
              const c = await DB.createClient(fields)
              created.push(c)
            }
            const clients = State.get('sales.clients') || []
            State.set('sales.clients', [...created, ...clients])
            m.close()
            Utils.showToast(`Imported ${created.length} clients`, 'success')
          } catch (err) {
            Utils.showToast(err.message || 'Import failed', 'error')
          }
        } }
      ]
    })
  }

  function _parseAc(text) {
    // Try JSON first, then CSV
    let rows = null
    try {
      const parsed = JSON.parse(text)
      rows = Array.isArray(parsed) ? parsed : parsed.contacts || parsed.data || []
    } catch (_) {
      rows = _parseCsv(text)
    }
    if (!Array.isArray(rows) || !rows.length) throw new Error('No rows found')
    return rows.map(r => ({
      full_name: r.full_name || r.name || [r.first_name, r.last_name].filter(Boolean).join(' '),
      email: r.email || '',
      phone: r.phone || '',
      client_kind: 'private',
      source: 'activecampaign',
      _selected: true
    }))
  }

  function _parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    return lines.slice(1).map(l => {
      const cells = l.split(',')
      const obj = {}
      headers.forEach((h, i) => { obj[h] = (cells[i] || '').trim() })
      return obj
    })
  }

  function _paintReview(container, rows) {
    while (container.firstChild) container.removeChild(container.firstChild)
    if (!rows.length) return
    const head = document.createElement('div')
    head.className = 'v2-ac-review-head'
    head.textContent = `${rows.length} contacts — toggle to exclude`
    container.appendChild(head)
    const list = document.createElement('div')
    list.className = 'v2-ac-review-list'
    rows.forEach((r, i) => {
      const row = document.createElement('label')
      row.className = 'v2-ac-review-row'
      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.checked = !!r._selected
      cb.addEventListener('change', e => { rows[i]._selected = e.target.checked })
      const name = document.createElement('span')
      name.textContent = `${r.full_name || '(no name)'} — ${r.email || ''}`
      row.append(cb, name)
      list.appendChild(row)
    })
    container.appendChild(list)
  }

  // ─── Panel handler ─────────────────────────────────────────────
  const panelHandler = {
    async load(id) { return await DB.getClient(id) },
    render(entity, ctx) {
      return {
        title: entity.full_name || '(unnamed)',
        subtitle: entity.email || '',
        tabs: [
          { label: 'Overview', content: _overview(entity, ctx) },
          { label: 'Deals',    content: _deals(entity) },
          { label: 'Activity', content: _activity(entity) }
        ]
      }
    },
    async save(id, edits) {
      const updated = await DB.updateClient(id, edits)
      const clients = State.get('sales.clients') || []
      State.set('sales.clients', clients.map(c => c.id === id ? updated : c))
      return updated
    }
  }

  function _overview(client, ctx) {
    const wrap = document.createElement('div')
    const eff = { ...client, ...(ctx.pendingEdits || {}) }
    const canEdit = Guard.action('client.edit') && ctx.canEdit

    const fields = [
      ['full_name', 'Name'],
      ['email', 'Email'],
      ['phone', 'Phone'],
      ['client_kind', 'Kind'],
      ['company', 'Company'],
      ['source', 'Source'],
      ['notes', 'Notes']
    ]
    for (const [key, label] of fields) {
      wrap.appendChild(_field(label, eff[key], () => {
        if (!canEdit) return
        _promptText(label, eff[key] || '', v => Panel.edit(key, v || null))
      }))
    }

    if (Guard.action('client.delete')) {
      const del = document.createElement('button')
      del.type = 'button'
      del.className = 'btn btn-ghost v2-panel-danger'
      del.textContent = 'Delete client'
      del.addEventListener('click', () => {
        Utils.showConfirm(`Delete ${client.full_name}? This cannot be undone.`, async () => {
          try {
            await DB.deleteClient(client.id)
            const clients = State.get('sales.clients') || []
            State.set('sales.clients', clients.filter(c => c.id !== client.id))
            Panel.close()
            Utils.showToast('Client deleted', 'success')
          } catch (err) {
            Utils.showToast(err.message || 'Failed to delete', 'error')
          }
        }, { confirmLabel: 'Delete', danger: true })
      })
      wrap.appendChild(del)
    }
    return wrap
  }

  function _deals(client) {
    const wrap = document.createElement('div')
    const deals = (State.get('sales.deals') || []).filter(d => d.client_id === client.id)
    if (!deals.length) { wrap.textContent = 'No deals for this client.'; return wrap }
    const products = State.get('sales.products') || []
    for (const d of deals) {
      const prod = products.find(p => p.id === d.product_id)
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'v2-panel-list-row'
      row.textContent = `${prod?.name || 'Deal'} — ${Utils.formatCurrency(d.price, d.currency)} — ${d.sales_status}`
      row.addEventListener('click', () => Panel.push('deal', d.id))
      wrap.appendChild(row)
    }
    return wrap
  }

  function _activity(client) {
    const wrap = document.createElement('div')
    wrap.textContent = 'Loading activity…'
    DB.getActivities({ entity_type: 'client', entity_id: client.id }).then(rows => {
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
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'fi'
    input.value = value
    const m = Modal.open({
      title,
      size: 'sm',
      body: input,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Set', variant: 'primary', onClick: () => { onSave(input.value); m.close() } }
      ]
    })
  }

  return { render, panelHandler }
})()

window.SalesClients = SalesClients
