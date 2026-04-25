// v2/spaces/operations/operations-profile.js — Inline vendor profile tab.
// Vendor role: read-only. Admin/manager: inline edit via modal prompts.
// Sections: Hero | Details | Rates | Recent bills.

const OpsProfile = (() => {
  function render(mount) {
    const vendor = State.get('ops.vendor')
    if (!vendor) { mount.textContent = 'No vendor selected.'; return }

    const wrap = document.createElement('div')
    wrap.className = 'v2-ops-profile'
    wrap.append(_hero(vendor), _details(vendor), _rates(vendor), _recentBills(vendor))
    mount.appendChild(wrap)
  }

  function _hero(v) {
    const section = document.createElement('section')
    section.className = 'v2-ops-profile-hero'

    const avatar = document.createElement('div')
    avatar.className = 'v2-ops-avatar'
    avatar.textContent = Utils.initials(v.name || v.full_name || v.id)
    section.appendChild(avatar)

    const meta = document.createElement('div')
    meta.className = 'v2-ops-profile-meta'

    const name = document.createElement('h2')
    name.className = 'v2-ops-profile-name'
    name.textContent = v.name || v.full_name || v.id
    meta.appendChild(name)

    const typeRow = document.createElement('div')
    typeRow.className = 'v2-ops-profile-chips'
    typeRow.insertAdjacentHTML('beforeend', Badges.vendorType(v.vendor_type))
    if (v.is_active === false) typeRow.insertAdjacentHTML('beforeend', Badges.make('Inactive', { color: 'grey' }))
    meta.appendChild(typeRow)

    if (v.email) {
      const email = document.createElement('div')
      email.className = 'v2-mu'
      email.textContent = v.email
      meta.appendChild(email)
    }
    section.appendChild(meta)
    return section
  }

  function _details(v) {
    const section = document.createElement('section')
    section.className = 'v2-ops-profile-details'

    const h = document.createElement('h3')
    h.textContent = 'Details'
    section.appendChild(h)

    const canEdit = Guard.action('vendor.edit')
    const fields = [
      ['name', 'Name'],
      ['email', 'Email'],
      ['phone', 'Phone'],
      ['currency', 'Currency'],
      ['payout_currency', 'Payout currency'],
      ['paying_company', 'Paying company'],
      ['entity', 'Entity'],
      ['iban', 'IBAN']
    ]
    for (const [key, label] of fields) {
      section.appendChild(_field(label, v[key], canEdit ? () => _editField(v, key, label) : null))
    }

    // Tags (comma-joined inline editor)
    section.appendChild(_field('Tags', (v.tags || []).join(', '), canEdit ? () => _editTags(v) : null))
    return section
  }

  async function _editField(vendor, key, label) {
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'fi'
    input.value = vendor[key] || ''
    const m = Modal.open({
      title: `Edit ${label}`, size: 'sm', body: input,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Save', variant: 'primary', onClick: async () => {
          try {
            const updated = await DB.updateVendor(vendor.id, { [key]: input.value.trim() || null })
            State.set('ops.vendor', updated)
            m.close()
            Utils.showToast('Saved', 'success')
          } catch (err) { Utils.showToast(err.message || 'Save failed', 'error') }
        } }
      ]
    })
    setTimeout(() => input.focus(), 10)
  }

  async function _editTags(vendor) {
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'fi'
    input.value = (vendor.tags || []).join(', ')
    const m = Modal.open({
      title: 'Edit tags (comma-separated)', size: 'sm', body: input,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Save', variant: 'primary', onClick: async () => {
          const tags = input.value.split(',').map(s => s.trim()).filter(Boolean)
          try {
            const updated = await DB.updateVendor(vendor.id, { tags })
            State.set('ops.vendor', updated)
            m.close()
            Utils.showToast('Saved', 'success')
          } catch (err) { Utils.showToast(err.message || 'Save failed', 'error') }
        } }
      ]
    })
  }

  function _rates(v) {
    const section = document.createElement('section')
    section.className = 'v2-ops-profile-rates'

    const head = document.createElement('div')
    head.className = 'v2-section-head'
    const h = document.createElement('h3')
    h.textContent = 'Rates'
    head.appendChild(h)

    const canEdit = Guard.action('vendor.edit')
    if (canEdit) {
      const addBtn = document.createElement('button')
      addBtn.type = 'button'
      addBtn.className = 'btn btn-sm'
      addBtn.textContent = '+ Add rate'
      addBtn.addEventListener('click', () => _openRateModal(v.id, null))
      head.appendChild(addBtn)
    }
    section.appendChild(head)

    const body = document.createElement('div')
    body.className = 'v2-ops-profile-rates-body'
    body.textContent = 'Loading rates…'
    section.appendChild(body)

    _paintRates(body, v.id, canEdit)
    return section
  }

  function _paintRates(body, vendorId, canEdit) {
    while (body.firstChild) body.removeChild(body.firstChild)
    body.textContent = 'Loading rates…'
    DB.getRates(vendorId).then(rates => {
      body.textContent = ''
      if (!rates.length) {
        body.textContent = 'No rates configured.'
        return
      }
      const tblMount = document.createElement('div')
      body.appendChild(tblMount)
      Table.create({
        container: tblMount,
        columns: [
          { key: 'name', label: 'Name', render: r => r.name || '(unnamed)' },
          { key: 'amount', label: 'Amount', render: r => Utils.formatCurrency(r.amount ?? r.rate, r.currency) },
          { key: 'currency', label: 'Currency' },
          { key: '_default', label: 'Default', raw: true,
            render: r => r.is_default ? Badges.make('Default', { color: 'green' }) : '' },
          ...(canEdit ? [{ key: '_actions', label: '', raw: true, render: r => _rowActions(r) }] : [])
        ],
        rows: rates,
        pageSize: 25
      })
      if (canEdit) _wireRowActions(tblMount, vendorId, body, rates)
    }).catch(err => { body.textContent = err.message || 'Failed to load rates' })
  }

  function _rowActions(r) {
    return `<button type="button" class="btn btn-xs" data-act="edit" data-id="${r.id}">Edit</button>` +
           `<button type="button" class="btn btn-xs" data-act="del" data-id="${r.id}">Delete</button>`
  }

  function _wireRowActions(mount, vendorId, body, rates) {
    mount.addEventListener('click', e => {
      const btn = e.target.closest('button[data-act]')
      if (!btn) return
      const id = btn.dataset.id
      const rate = rates.find(r => r.id === id)
      if (!rate) return
      if (btn.dataset.act === 'edit') _openRateModal(vendorId, rate, () => _paintRates(body, vendorId, true))
      else if (btn.dataset.act === 'del') _confirmDeleteRate(rate, () => _paintRates(body, vendorId, true))
    })
  }

  function _openRateModal(vendorId, existing, onSaved) {
    const form = document.createElement('form')
    form.noValidate = true
    form.addEventListener('submit', e => e.preventDefault())
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'rate_name', label: 'Name', value: existing?.name || '', required: true }))
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'rate_amount', label: 'Amount (per hour)', type: 'number', value: existing?.amount ?? existing?.rate ?? '', required: true, min: '0', step: '0.01' }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'rate_currency', label: 'Currency', required: true,
      value: existing?.currency || 'USD',
      options: [
        { value: 'USD', label: 'USD' },
        { value: 'EUR', label: 'EUR' },
        { value: 'ILS', label: 'ILS' },
        { value: 'GBP', label: 'GBP' }
      ]
    }))

    const m = Modal.open({
      title: existing ? 'Edit rate' : 'Add rate',
      size: 'sm',
      body: form,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Save', variant: 'primary', onClick: async () => {
          const { valid, errors, values } = Form.validate(form)
          if (!valid) { Form.showErrors(form, errors); return }
          const amount = Number(values.rate_amount)
          if (!Number.isFinite(amount) || amount < 0) {
            Utils.showToast('Amount must be a non-negative number', 'warn'); return
          }
          const fields = {
            vendor_id: vendorId,
            name: values.rate_name.trim(),
            amount,
            currency: values.rate_currency
          }
          if (existing) fields.id = existing.id
          try {
            await DB.upsertRate(fields)
            m.close()
            Utils.showToast('Rate saved', 'success')
            onSaved && onSaved()
          } catch (err) { Utils.showToast(err.message || 'Failed to save rate', 'error') }
        } }
      ]
    })
  }

  function _confirmDeleteRate(rate, onDone) {
    Utils.showConfirm(`Delete rate "${rate.name || rate.id}"?`, async () => {
      try {
        await DB.deleteRate(rate.id)
        Utils.showToast('Rate deleted', 'success')
        onDone && onDone()
      } catch (err) { Utils.showToast(err.message || 'Failed to delete rate', 'error') }
    }, { danger: true, confirmLabel: 'Delete' })
  }

  function _recentBills(v) {
    const section = document.createElement('section')
    section.className = 'v2-ops-profile-bills'
    const h = document.createElement('h3')
    h.textContent = 'Recent bills'
    section.appendChild(h)

    const bills = (State.get('ops.bills') || [])
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)

    if (!bills.length) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'No bills yet.'
      section.appendChild(empty)
      return section
    }

    const list = document.createElement('ul')
    list.className = 'v2-panel-list'
    for (const b of bills) {
      const li = document.createElement('li')
      const when = document.createElement('span')
      when.className = 'v2-panel-when'
      when.textContent = `${Utils.formatDate(b.created_at)} — `
      const amount = document.createElement('span')
      amount.textContent = `${Utils.formatCurrency(b.total_amount, b.currency)} — `
      li.append(when, amount)
      li.insertAdjacentHTML('beforeend', Badges.billStatus(b.status))
      list.appendChild(li)
    }
    section.appendChild(list)
    return section
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

  return { render }
})()

window.OpsProfile = OpsProfile
