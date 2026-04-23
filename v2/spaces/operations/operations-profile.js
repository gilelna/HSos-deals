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
    const h = document.createElement('h3')
    h.textContent = 'Rates'
    section.appendChild(h)

    const body = document.createElement('div')
    body.textContent = 'Loading rates…'
    section.appendChild(body)

    DB.getRates(v.id).then(rates => {
      body.textContent = ''
      if (!rates.length) {
        body.textContent = 'No rates set. Ask an admin to configure rates for your session types.'
        return
      }
      const list = document.createElement('ul')
      list.className = 'v2-panel-list'
      for (const r of rates) {
        const li = document.createElement('li')
        const label = r.name || r.session_type || '(unknown)'
        li.textContent = `${label} — ${Utils.formatCurrency(r.rate, r.currency)}`
        list.appendChild(li)
      }
      body.appendChild(list)
    }).catch(err => { body.textContent = err.message || 'Failed to load rates' })

    return section
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
