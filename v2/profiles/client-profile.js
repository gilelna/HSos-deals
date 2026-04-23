// v2/profiles/client-profile.js — Standalone client profile page.
// URL: client-profile.html?id=<clientId>&readonly=1
// Sections: Hero | Details | Deals | Sessions | Packages | Reminders | Activity
// Role-aware: vendor sees Hero + Sessions + Packages only (no financials).

const ClientProfile = (() => {
  let _client = null
  let _readonlyOverride = false

  async function start() {
    if (!Guard.space('profiles')) return
    Layout.init({ space: 'sales', pageTitle: 'Client profile' })

    const params = Router.getParams()
    const id = params.id
    _readonlyOverride = params.readonly === '1'
    if (!id) { _showError('No client id in URL'); return }

    try {
      _client = await DB.getClient(id)
      if (!_client) { _showError(`Client ${id} not found`); return }
      _paint()
    } catch (err) {
      console.error('[ClientProfile]', err)
      _showError(err.message || 'Failed to load client')
    }
  }

  function _canEdit() {
    if (_readonlyOverride) return false
    if (Auth.getRole() === 'vendor') return false
    return Guard.action('client.edit')
  }

  function _isVendorView() {
    return Auth.getRole() === 'vendor'
  }

  function _paint() {
    const mount = document.getElementById('profile-mount')
    if (!mount) return
    while (mount.firstChild) mount.removeChild(mount.firstChild)

    mount.appendChild(_hero())
    if (!_isVendorView()) mount.appendChild(_details())
    if (!_isVendorView()) mount.appendChild(_dealsSection())
    mount.appendChild(_sessionsSection())
    mount.appendChild(_packagesSection())
    if (!_isVendorView()) mount.appendChild(_remindersSection())
    if (!_isVendorView()) mount.appendChild(_activitySection())
  }

  // ─── Hero ──────────────────────────────────────────────────────
  function _hero() {
    const section = document.createElement('section')
    section.className = 'v2-profile-hero'

    const avatar = document.createElement('div')
    avatar.className = 'v2-ops-avatar v2-profile-avatar'
    avatar.textContent = Utils.initials(_client.full_name || _client.id)
    section.appendChild(avatar)

    const meta = document.createElement('div')
    meta.className = 'v2-profile-meta'

    const name = document.createElement('h1')
    name.className = 'v2-profile-name'
    name.textContent = _client.full_name || _client.id
    meta.appendChild(name)

    const chips = document.createElement('div')
    chips.className = 'v2-profile-chips'
    if (_client.kind) chips.insertAdjacentHTML('beforeend', Badges.make(_client.kind, { color: _client.kind === 'corporate' ? 'purple' : 'blue' }))
    if (_client.country) chips.insertAdjacentHTML('beforeend', Badges.make(_client.country, { color: 'grey' }))
    if (_client.active === false) chips.insertAdjacentHTML('beforeend', Badges.make('Inactive', { color: 'grey' }))
    meta.appendChild(chips)

    if (_client.email) {
      const e = document.createElement('div')
      e.className = 'v2-mu'
      e.textContent = _client.email
      meta.appendChild(e)
    }
    section.appendChild(meta)
    return section
  }

  // ─── Details ───────────────────────────────────────────────────
  function _details() {
    const section = document.createElement('section')
    section.className = 'v2-profile-section'
    const h = document.createElement('h2')
    h.textContent = 'Details'
    section.appendChild(h)

    const fields = [
      ['full_name', 'Full name'],
      ['email', 'Email'],
      ['phone', 'Phone'],
      ['kind', 'Kind'],
      ['company_name', 'Company'],
      ['source', 'Source'],
      ['country', 'Country'],
      ['notes', 'Notes']
    ]
    const editable = _canEdit()
    for (const [key, label] of fields) {
      section.appendChild(_field(label, _client[key], editable ? () => _editField(key, label) : null))
    }
    return section
  }

  async function _editField(key, label) {
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'fi'
    input.value = _client[key] || ''
    const m = Modal.open({
      title: `Edit ${label}`, size: 'sm', body: input,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Save', variant: 'primary', onClick: async () => {
          try {
            _client = await DB.updateClient(_client.id, { [key]: input.value.trim() || null })
            m.close()
            _paint()
            Utils.showToast('Saved', 'success')
          } catch (err) { Utils.showToast(err.message || 'Save failed', 'error') }
        } }
      ]
    })
  }

  // ─── Deals ─────────────────────────────────────────────────────
  function _dealsSection() {
    const section = document.createElement('section')
    section.className = 'v2-profile-section'
    const h = document.createElement('h2')
    h.textContent = 'Deals'
    section.appendChild(h)

    const body = document.createElement('div')
    body.textContent = 'Loading deals…'
    section.appendChild(body)

    Promise.all([DB.getDeals(), DB.getAllProductsWithPlans()]).then(([deals, products]) => {
      body.textContent = ''
      const mine = deals.filter(d => d.client_id === _client.id)
      if (!mine.length) { body.textContent = 'No deals for this client.'; return }
      const productById = new Map(products.map(p => [p.id, p]))
      Table.create({
        container: body,
        columns: [
          { key: '_product', label: 'Product' },
          { key: 'price', label: 'Price', render: d => Utils.formatCurrency(d.price, d.currency) },
          { key: 'sales_status', label: 'Stage', raw: true, render: d => Badges.dealStatus(d.sales_status) },
          { key: 'billing_status', label: 'Billing', raw: true, render: d => Badges.billingStatus(d.billing_status) },
          { key: 'created_at', label: 'Created', render: d => Utils.formatDate(d.created_at) }
        ],
        rows: mine.map(d => ({ ...d, _product: productById.get(d.product_id)?.name || '' })),
        exportFilename: `client-${_client.id}-deals.csv`,
        pageSize: 25
      })
    }).catch(err => { body.textContent = err.message || 'Failed to load deals' })
    return section
  }

  // ─── Sessions ──────────────────────────────────────────────────
  function _sessionsSection() {
    const section = document.createElement('section')
    section.className = 'v2-profile-section'
    const h = document.createElement('h2')
    h.textContent = 'Sessions'
    section.appendChild(h)

    const body = document.createElement('div')
    body.textContent = 'Loading sessions…'
    section.appendChild(body)

    Promise.all([
      DB.getSessions({ client_id: _client.id }),
      DB.getTaskTypes(),
      DB.getVendors()
    ]).then(([sessions, tts, vendors]) => {
      body.textContent = ''
      if (!sessions.length) { body.textContent = 'No sessions yet.'; return }
      const ttById = new Map(tts.map(t => [t.id, t]))
      const vendorById = new Map(vendors.map(v => [v.id, v]))
      Table.create({
        container: body,
        columns: [
          { key: 'session_date', label: 'Date', render: s => Utils.formatDate(s.session_date) },
          { key: '_task', label: 'Task' },
          { key: '_vendor', label: 'Vendor' },
          { key: 'duration_min', label: 'Minutes' },
          { key: 'status', label: 'Status', raw: true, render: s => Badges.sessionStatus(s.status) }
        ],
        rows: sessions.map(s => ({
          ...s,
          _task: ttById.get(s.task_type_id)?.name || '',
          _vendor: vendorById.get(s.vendor_id)?.name || ''
        })),
        exportFilename: `client-${_client.id}-sessions.csv`,
        pageSize: 50
      })
    }).catch(err => { body.textContent = err.message || 'Failed to load sessions' })
    return section
  }

  // ─── Packages ──────────────────────────────────────────────────
  function _packagesSection() {
    const section = document.createElement('section')
    section.className = 'v2-profile-section'
    const h = document.createElement('h2')
    h.textContent = 'Packages'
    section.appendChild(h)

    const body = document.createElement('div')
    body.textContent = 'Loading packages…'
    section.appendChild(body)

    DB.getPackages().then(pkgs => {
      body.textContent = ''
      const mine = pkgs.filter(p => p.client_id === _client.id)
      if (!mine.length) { body.textContent = 'No packages.'; return }
      const list = document.createElement('div')
      list.className = 'v2-pkg-list'
      for (const p of mine) list.appendChild(_packageCard(p))
      body.appendChild(list)
    }).catch(err => { body.textContent = err.message || 'Failed' })
    return section
  }

  function _packageCard(p) {
    const card = document.createElement('article')
    card.className = 'v2-pkg-card'
    const used = Number(p.sessions_used) || 0
    const total = Number(p.sessions_total) || 0
    const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0

    const top = document.createElement('div')
    top.className = 'v2-pkg-top'
    const label = document.createElement('span')
    label.textContent = `${used}/${total} sessions`
    const status = document.createElement('span')
    status.insertAdjacentHTML('afterbegin', Badges.make(p.status, { color: p.status === 'active' ? 'green' : 'grey' }))
    top.append(label, status)
    card.appendChild(top)

    const bar = document.createElement('div')
    bar.className = 'v2-progress-bar'
    const fill = document.createElement('div')
    fill.className = 'v2-progress-fill'
    fill.style.width = `${pct}%`
    bar.appendChild(fill)
    card.appendChild(bar)
    return card
  }

  // ─── Reminders (admin/manager only) ────────────────────────────
  function _remindersSection() {
    const section = document.createElement('section')
    section.className = 'v2-profile-section'
    const h = document.createElement('h2')
    h.textContent = 'Reminders'
    section.appendChild(h)

    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'btn btn-sm'
    add.textContent = 'Add reminder'
    add.addEventListener('click', () => _openReminderEditor(null))
    section.appendChild(add)

    const body = document.createElement('div')
    body.textContent = 'Loading reminders…'
    section.appendChild(body)

    DB.getActivities({ entity_type: 'client', entity_id: _client.id, type: 'reminder' }).then(rows => {
      body.textContent = ''
      if (!rows.length) { body.textContent = 'No reminders.'; return }
      const list = document.createElement('ul')
      list.className = 'v2-panel-list'
      for (const r of rows) list.appendChild(_reminderRow(r))
      body.appendChild(list)
    }).catch(err => { body.textContent = err.message || 'Failed to load reminders' })
    return section
  }

  function _reminderRow(r) {
    const li = document.createElement('li')
    li.className = `v2-reminder-row v2-reminder-${r.status || 'pending'}`

    const due = document.createElement('span')
    due.className = 'v2-panel-when'
    due.textContent = r.due_at ? `${Utils.formatDate(r.due_at)} — ` : ''
    const body = document.createElement('span')
    body.textContent = r.body || '(no body)'
    li.append(due, body)

    if (r.status === 'pending') {
      const actions = document.createElement('span')
      actions.className = 'v2-reminder-actions'
      const done = document.createElement('button')
      done.type = 'button'
      done.className = 'btn btn-sm'
      done.textContent = 'Done'
      done.addEventListener('click', async () => {
        try { await DB.updateActivity(r.id, { status: 'done' }); _paint(); Utils.showToast('Marked done', 'success') }
        catch (err) { Utils.showToast(err.message || 'Failed', 'error') }
      })
      const dismiss = document.createElement('button')
      dismiss.type = 'button'
      dismiss.className = 'btn btn-ghost btn-sm'
      dismiss.textContent = 'Dismiss'
      dismiss.addEventListener('click', async () => {
        try { await DB.updateActivity(r.id, { status: 'dismissed' }); _paint(); Utils.showToast('Dismissed', 'success') }
        catch (err) { Utils.showToast(err.message || 'Failed', 'error') }
      })
      actions.append(done, dismiss)
      li.appendChild(actions)
    } else {
      li.appendChild(Object.assign(document.createElement('span'), { className: 'v2-mu', textContent: ` (${r.status})` }))
    }
    return li
  }

  function _openReminderEditor(existing) {
    const form = document.createElement('form')
    form.noValidate = true
    form.addEventListener('submit', e => e.preventDefault())

    form.insertAdjacentHTML('beforeend', Form.textarea({
      id: 'body', label: 'Reminder', required: true, rows: 3, value: existing?.body || ''
    }))
    form.insertAdjacentHTML('beforeend', Form.input({
      id: 'due_at', label: 'Due date', type: 'date',
      value: existing?.due_at ? existing.due_at.slice(0, 10) : ''
    }))

    const m = Modal.open({
      title: existing ? 'Edit reminder' : 'Add reminder',
      size: 'md',
      body: form,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Save', variant: 'primary', onClick: async () => {
          const { valid, errors, values } = Form.validate(form)
          if (!valid) { Form.showErrors(form, errors); return }
          const payload = {
            entity_type: 'client',
            entity_id: _client.id,
            type: 'reminder',
            body: values.body,
            due_at: values.due_at ? new Date(values.due_at).toISOString() : null,
            status: 'pending'
          }
          try {
            if (existing) await DB.updateActivity(existing.id, payload)
            else await DB.logActivity(payload)
            m.close()
            Utils.showToast('Reminder saved', 'success')
            _paint()
          } catch (err) { Utils.showToast(err.message || 'Save failed', 'error') }
        } }
      ]
    })
  }

  // ─── Activity ──────────────────────────────────────────────────
  function _activitySection() {
    const section = document.createElement('section')
    section.className = 'v2-profile-section'
    const h = document.createElement('h2')
    h.textContent = 'Activity log'
    section.appendChild(h)

    const body = document.createElement('div')
    body.textContent = 'Loading activity…'
    section.appendChild(body)

    DB.getActivities({ entity_type: 'client', entity_id: _client.id }).then(rows => {
      body.textContent = ''
      const nonReminders = rows.filter(r => r.type !== 'reminder')
      if (!nonReminders.length) { body.textContent = 'No activity yet.'; return }
      const list = document.createElement('ul')
      list.className = 'v2-panel-list'
      for (const a of nonReminders) {
        const li = document.createElement('li')
        const when = document.createElement('span')
        when.className = 'v2-panel-when'
        when.textContent = Utils.formatDate(a.created_at) + ' — '
        const text = document.createElement('span')
        text.textContent = a.body || a.subtype || a.type
        li.append(when, text)
        list.appendChild(li)
      }
      body.appendChild(list)
    }).catch(err => { body.textContent = err.message || 'Failed to load activity' })
    return section
  }

  // ─── Helpers ───────────────────────────────────────────────────
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

  function _showError(msg) {
    const mount = document.getElementById('profile-mount')
    if (!mount) return
    while (mount.firstChild) mount.removeChild(mount.firstChild)
    const box = document.createElement('div')
    box.className = 'v2-empty'
    box.textContent = msg
    mount.appendChild(box)
  }

  document.addEventListener('DOMContentLoaded', start)
  return { start }
})()

window.ClientProfile = ClientProfile
