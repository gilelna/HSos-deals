// v2/profiles/vendor-profile.js — Standalone vendor profile page.
// URL: vendor-profile.html?id=<vendorId>&readonly=1
// Sections: Hero | Rates | Bills | Documents (placeholder) | Activity log.
// Role-aware: vendor role sees own profile read-only; admin/manager can edit.

const VendorProfile = (() => {
  let _vendor = null
  let _readonlyOverride = false

  async function start() {
    if (!Guard.space('profiles')) return
    Layout.init({ space: 'sales', pageTitle: 'Vendor profile' })

    const params = Router.getParams()
    const id = params.id
    _readonlyOverride = params.readonly === '1'
    if (!id) {
      _showError('No vendor id in URL')
      return
    }

    // Vendor-role users may only view their own profile.
    if (Auth.getRole() === 'vendor' && Auth.getVendorId() && Auth.getVendorId() !== id) {
      _showError('You can only view your own profile.')
      return
    }

    try {
      _vendor = await DB.getVendor(id)
      if (!_vendor) { _showError(`Vendor ${id} not found`); return }
      _paint()
    } catch (err) {
      console.error('[VendorProfile]', err)
      _showError(err.message || 'Failed to load vendor')
    }
  }

  function _canEdit() {
    if (_readonlyOverride) return false
    if (Auth.getRole() === 'vendor') return false
    return Guard.action('vendor.edit')
  }

  function _paint() {
    const mount = document.getElementById('profile-mount')
    if (!mount) return
    while (mount.firstChild) mount.removeChild(mount.firstChild)
    mount.append(_hero(), _details(), _ratesSection(), _billsSection(), _activitySection())
  }

  // ─── Hero ──────────────────────────────────────────────────────
  function _hero() {
    const section = document.createElement('section')
    section.className = 'v2-profile-hero'

    const avatar = document.createElement('div')
    avatar.className = 'v2-ops-avatar v2-profile-avatar'
    avatar.textContent = Utils.initials(_vendor.name || _vendor.full_name || _vendor.id)
    section.appendChild(avatar)

    const meta = document.createElement('div')
    meta.className = 'v2-profile-meta'

    const name = document.createElement('h1')
    name.className = 'v2-profile-name'
    name.textContent = _vendor.name || _vendor.full_name || _vendor.id
    meta.appendChild(name)

    const chips = document.createElement('div')
    chips.className = 'v2-profile-chips'
    chips.insertAdjacentHTML('beforeend', Badges.vendorType(_vendor.vendor_type))
    if (_vendor.is_active === false) chips.insertAdjacentHTML('beforeend', Badges.make('Inactive', { color: 'grey' }))
    if (_vendor.payment_cadence) chips.insertAdjacentHTML('beforeend', Badges.cadence(_vendor.payment_cadence))
    meta.appendChild(chips)

    if (_vendor.email) {
      const e = document.createElement('div')
      e.className = 'v2-mu'
      e.textContent = _vendor.email
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
      ['name', 'Name'],
      ['email', 'Email'],
      ['phone', 'Phone'],
      ['currency', 'Working currency'],
      ['payout_currency', 'Payout currency'],
      ['paying_company', 'Paying company'],
      ['entity', 'Entity'],
      ['iban', 'IBAN'],
      ['payment_id', 'Payment ID'],
      ['nickname', 'Nickname']
    ]
    const editable = _canEdit()
    for (const [key, label] of fields) {
      section.appendChild(_field(label, _vendor[key], editable ? () => _editField(key, label) : null))
    }
    section.appendChild(_field('Tags', (_vendor.tags || []).join(', '), editable ? () => _editTags() : null))
    return section
  }

  async function _editField(key, label) {
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'fi'
    input.value = _vendor[key] || ''
    const m = Modal.open({
      title: `Edit ${label}`, size: 'sm', body: input,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Save', variant: 'primary', onClick: async () => {
          try {
            const updated = await DB.updateVendor(_vendor.id, { [key]: input.value.trim() || null })
            _vendor = updated
            m.close()
            _paint()
            Utils.showToast('Saved', 'success')
          } catch (err) { Utils.showToast(err.message || 'Save failed', 'error') }
        } }
      ]
    })
  }

  async function _editTags() {
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'fi'
    input.value = (_vendor.tags || []).join(', ')
    const m = Modal.open({
      title: 'Edit tags (comma-separated)', size: 'sm', body: input,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Save', variant: 'primary', onClick: async () => {
          const tags = input.value.split(',').map(s => s.trim()).filter(Boolean)
          try {
            _vendor = await DB.updateVendor(_vendor.id, { tags })
            m.close()
            _paint()
            Utils.showToast('Saved', 'success')
          } catch (err) { Utils.showToast(err.message || 'Save failed', 'error') }
        } }
      ]
    })
  }

  // ─── Rates ─────────────────────────────────────────────────────
  function _ratesSection() {
    const section = document.createElement('section')
    section.className = 'v2-profile-section'

    const h = document.createElement('h2')
    h.textContent = 'Rates'
    section.appendChild(h)

    if (_canEdit()) {
      const add = document.createElement('button')
      add.type = 'button'
      add.className = 'btn btn-sm'
      add.textContent = 'Add rate'
      add.addEventListener('click', () => _openRateEditor(null))
      section.appendChild(add)
    }

    const body = document.createElement('div')
    body.textContent = 'Loading rates…'
    section.appendChild(body)

    Promise.all([DB.getRates(_vendor.id), DB.getTaskTypes()]).then(([rates, tts]) => {
      body.textContent = ''
      if (!rates.length) { body.textContent = 'No rates set.'; return }
      const ttById = new Map(tts.map(t => [t.id, t]))

      Table.create({
        container: body,
        columns: [
          { key: '_task',     label: 'Task type' },
          { key: 'rate',      label: 'Rate', render: r => Utils.formatCurrency(r.rate, r.currency) },
          { key: 'currency',  label: 'Currency' },
          { key: 'effective_date', label: 'Effective', render: r => Utils.formatDate(r.effective_date) }
        ],
        rows: rates.map(r => ({ ...r, _task: ttById.get(r.task_type_id)?.name || '(unknown)' })),
        onRowClick: r => _canEdit() ? _openRateEditor(r) : null,
        exportFilename: `rates-${_vendor.id}.csv`,
        pageSize: 25
      })
    }).catch(err => { body.textContent = err.message || 'Failed to load rates' })
    return section
  }

  function _openRateEditor(existing) {
    DB.getTaskTypes().then(tts => {
      const isNew = !existing
      const form = document.createElement('form')
      form.noValidate = true
      form.addEventListener('submit', e => e.preventDefault())

      form.insertAdjacentHTML('beforeend', Form.select({
        id: 'task_type_id', label: 'Task type', required: true,
        options: tts.map(t => ({ value: t.id, label: t.name })),
        value: existing?.task_type_id || tts[0]?.id || ''
      }))
      form.insertAdjacentHTML('beforeend', Form.input({
        id: 'rate', label: 'Rate', type: 'number', required: true, step: '0.01',
        value: existing?.rate ?? ''
      }))
      form.insertAdjacentHTML('beforeend', Form.select({
        id: 'currency', label: 'Currency', required: true,
        options: Const.CURRENCIES.map(c => ({ value: c, label: c })),
        value: existing?.currency || _vendor.currency || 'USD'
      }))
      form.insertAdjacentHTML('beforeend', Form.input({
        id: 'effective_date', label: 'Effective date', type: 'date',
        value: existing?.effective_date || new Date().toISOString().slice(0, 10)
      }))

      const actions = [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: isNew ? 'Create rate' : 'Save rate', variant: 'primary', onClick: async () => {
          const { valid, errors, values } = Form.validate(form)
          if (!valid) { Form.showErrors(form, errors); return }
          const payload = {
            vendor_id: _vendor.id,
            task_type_id: values.task_type_id,
            rate: Number(values.rate),
            currency: values.currency,
            effective_date: values.effective_date || null
          }
          if (existing) payload.id = existing.id
          try {
            await DB.upsertRate(payload)
            m.close()
            Utils.showToast('Rate saved', 'success')
            _paint()
          } catch (err) { Utils.showToast(err.message || 'Save failed', 'error') }
        } }
      ]
      if (existing) {
        actions.splice(1, 0, {
          label: 'Delete', variant: 'ghost', onClick: () => {
            Utils.showConfirm('Delete this rate?', async () => {
              try {
                await DB.deleteRate(existing.id)
                m.close()
                Utils.showToast('Rate deleted', 'success')
                _paint()
              } catch (err) { Utils.showToast(err.message || 'Delete failed', 'error') }
            }, { confirmLabel: 'Delete', danger: true })
          }
        })
      }

      const m = Modal.open({
        title: isNew ? 'Add rate' : 'Edit rate',
        size: 'md',
        body: form,
        actions
      })
    }).catch(err => Utils.showToast(err.message || 'Failed to load task types', 'error'))
  }

  // ─── Bills ─────────────────────────────────────────────────────
  function _billsSection() {
    const section = document.createElement('section')
    section.className = 'v2-profile-section'
    const h = document.createElement('h2')
    h.textContent = 'Bills'
    section.appendChild(h)

    const body = document.createElement('div')
    body.textContent = 'Loading bills…'
    section.appendChild(body)

    DB.getBills({ vendor_id: _vendor.id }).then(bills => {
      body.textContent = ''
      if (!bills.length) { body.textContent = 'No bills yet.'; return }
      Table.create({
        container: body,
        columns: [
          { key: 'created_at', label: 'Created', render: b => Utils.formatDate(b.created_at) },
          { key: 'total_amount', label: 'Amount', render: b => Utils.formatCurrency(b.total_amount, b.currency) },
          { key: 'status', label: 'Status', raw: true, render: b => Badges.billStatus(b.status) },
          { key: 'submitted_at', label: 'Submitted', render: b => Utils.formatDate(b.submitted_at) },
          { key: 'paid_at', label: 'Paid', render: b => Utils.formatDate(b.paid_at) }
        ],
        rows: bills,
        exportFilename: `bills-${_vendor.id}.csv`,
        pageSize: 25
      })
    }).catch(err => { body.textContent = err.message || 'Failed to load bills' })
    return section
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

    DB.getActivities({ entity_type: 'vendor', entity_id: _vendor.id }).then(rows => {
      body.textContent = ''
      if (!rows.length) { body.textContent = 'No activity yet.'; return }
      const list = document.createElement('ul')
      list.className = 'v2-panel-list'
      for (const a of rows) {
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

window.VendorProfile = VendorProfile
