// v2/spaces/payments/payments-vendors.js — Vendor matching tab.
// Sections: Vendor defaults (category/tax/entity per vendor), unmatched
// merchants (counterparties not yet linked to a vendor), and match-pattern rules.

const PayVendors = (() => {
  function render(mount) {
    const wrap = document.createElement('div')
    wrap.className = 'v2-pay-matching'
    mount.appendChild(wrap)
    _reload(wrap)
  }

  async function _reload(wrap) {
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild)
    const loading = document.createElement('div')
    loading.className = 'v2-empty'
    loading.textContent = 'Loading…'
    wrap.appendChild(loading)

    try {
      const transactions = await DB.getTransactions({})
      loading.remove()
      wrap.appendChild(_vendorDefaultsSection())
      wrap.appendChild(_unmatchedSection(transactions))
      wrap.appendChild(_matchRulesSection())
    } catch (err) {
      loading.textContent = err.message || 'Failed to load'
    }
  }

  function _vendorDefaultsSection() {
    const section = document.createElement('section')
    section.className = 'v2-pay-matching-section'
    const h = document.createElement('h2')
    h.textContent = 'Vendor defaults'
    section.appendChild(h)

    const vendors = State.get('pay.vendors') || []
    const cats = State.get('pay.categories') || []
    const catById = new Map(cats.map(c => [c.id, c]))

    if (!vendors.length) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'No vendors yet.'
      section.appendChild(empty)
      return section
    }

    const tblMount = document.createElement('div')
    section.appendChild(tblMount)
    Table.create({
      container: tblMount,
      columns: [
        { key: 'name', label: 'Vendor' },
        { key: 'vendor_type', label: 'Type', raw: true, render: v => Badges.vendorType(v.vendor_type) },
        { key: '_category', label: 'Default category', render: v => catById.get(v.category_id)?.name || '—' },
        { key: 'tax_treatment', label: 'Tax', raw: true, render: v => Badges.taxTreatment(v.tax_treatment) },
        { key: 'entity', label: 'Entity' },
        { key: 'payment_cadence', label: 'Cadence', raw: true, render: v => Badges.cadence(v.payment_cadence) }
      ],
      rows: vendors,
      onRowClick: v => _openVendorDefaults(v),
      exportFilename: 'vendor-defaults.csv',
      pageSize: 50
    })
    return section
  }

  function _openVendorDefaults(vendor) {
    const cats = State.get('pay.categories') || []
    const form = document.createElement('form')
    form.noValidate = true
    form.addEventListener('submit', e => e.preventDefault())

    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'category_id', label: 'Default category',
      options: [{ value: '', label: '— none —' }].concat(cats.map(c => ({ value: c.id, label: c.name }))),
      value: vendor.category_id || ''
    }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'tax_treatment', label: 'Default tax treatment',
      options: [{ value: '', label: '— none —' }].concat(
        Const.TAX_TREATMENTS.map(t => ({ value: t, label: Const.TAX_TREATMENT_LABELS[t] }))
      ),
      value: vendor.tax_treatment || ''
    }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'entity', label: 'Entity',
      options: [
        { value: '', label: '— none —' },
        { value: 'business', label: 'Business' },
        { value: 'private', label: 'Private' }
      ],
      value: vendor.entity || ''
    }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'payment_cadence', label: 'Cadence',
      options: [{ value: '', label: '— none —' }].concat(
        Const.PAYMENT_CADENCES.map(c => ({ value: c, label: Const.PAYMENT_CADENCE_LABELS[c] }))
      ),
      value: vendor.payment_cadence || ''
    }))
    form.insertAdjacentHTML('beforeend', Form.input({
      id: 'match_patterns', label: 'Match patterns (comma-separated aliases)',
      value: (vendor.match_patterns || []).join(', ')
    }))

    const m = Modal.open({
      title: `Defaults for ${vendor.name}`,
      size: 'md',
      body: form,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Save', variant: 'primary', onClick: async () => {
          const { values } = Form.validate(form)
          const patch = {
            category_id: values.category_id || null,
            tax_treatment: values.tax_treatment || null,
            entity: values.entity || null,
            payment_cadence: values.payment_cadence || null,
            match_patterns: values.match_patterns
              ? values.match_patterns.split(',').map(s => s.trim()).filter(Boolean)
              : []
          }
          try {
            await DB.updateVendor(vendor.id, patch)
            const vendors = State.get('pay.vendors') || []
            State.set('pay.vendors', vendors.map(v => v.id === vendor.id ? { ...v, ...patch } : v))
            m.close()
            Utils.showToast('Saved', 'success')
            const wrap = document.querySelector('.v2-pay-matching')
            if (wrap) _reload(wrap)
          } catch (err) {
            Utils.showToast(err.message || 'Save failed', 'error')
          }
        } }
      ]
    })
  }

  function _unmatchedSection(transactions) {
    const section = document.createElement('section')
    section.className = 'v2-pay-matching-section'
    const h = document.createElement('h2')
    h.textContent = 'Unmatched counterparties'
    section.appendChild(h)

    // Group by counterparty where vendor_id is null
    const groups = new Map()
    for (const t of transactions) {
      if (t.vendor_id) continue
      const key = (t.counterparty_name || '(unknown)').trim()
      if (!groups.has(key)) groups.set(key, { name: key, count: 0, total: 0, currency: t.currency, lastDate: t.transaction_date })
      const g = groups.get(key)
      g.count++
      g.total += Number(t.amount) || 0
      if (new Date(t.transaction_date) > new Date(g.lastDate)) g.lastDate = t.transaction_date
    }
    const rows = [...groups.values()].sort((a, b) => b.count - a.count)

    if (!rows.length) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'All counterparties matched.'
      section.appendChild(empty)
      return section
    }

    const tblMount = document.createElement('div')
    section.appendChild(tblMount)
    Table.create({
      container: tblMount,
      columns: [
        { key: 'name', label: 'Counterparty' },
        { key: 'count', label: '# Transactions' },
        { key: 'total', label: 'Total', render: r => Utils.formatCurrency(r.total, r.currency) },
        { key: 'lastDate', label: 'Last seen', render: r => Utils.formatDate(r.lastDate) }
      ],
      rows,
      onRowClick: r => _openMatchToVendor(r),
      exportFilename: 'unmatched-counterparties.csv',
      pageSize: 50
    })
    return section
  }

  function _openMatchToVendor(group) {
    const vendors = State.get('pay.vendors') || []
    const form = document.createElement('form')
    form.noValidate = true
    form.addEventListener('submit', e => e.preventDefault())

    const hint = document.createElement('div')
    hint.className = 'v2-mu'
    hint.textContent = `Pick a vendor to assign to all transactions with counterparty "${group.name}". This also appends the name to that vendor's match_patterns.`
    form.appendChild(hint)

    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'vendor_id', label: 'Assign to vendor', required: true,
      options: [{ value: '', label: '— choose —' }].concat(vendors.map(v => ({ value: v.id, label: v.name }))),
      value: ''
    }))

    const m = Modal.open({
      title: 'Match counterparty to vendor',
      size: 'md',
      body: form,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Match', variant: 'primary', onClick: async () => {
          const { values } = Form.validate(form)
          if (!values.vendor_id) { Utils.showToast('Pick a vendor', 'warn'); return }
          try {
            // Update every unmatched tx with this counterparty
            const txs = await DB.getTransactions({})
            const targets = txs.filter(t => !t.vendor_id && (t.counterparty_name || '').trim() === group.name)
            if (targets.length) {
              await DB.bulkUpdateTransactions(targets.map(t => t.id), { vendor_id: values.vendor_id, status: 'matched' })
            }
            // Append to match_patterns
            const vendor = vendors.find(v => v.id === values.vendor_id)
            if (vendor) {
              const existing = Array.isArray(vendor.match_patterns) ? vendor.match_patterns : []
              if (!existing.includes(group.name)) {
                await DB.updateVendor(vendor.id, { match_patterns: [...existing, group.name] })
              }
            }
            Utils.showToast(`Matched ${targets.length} transactions`, 'success')
            m.close()
            const wrap = document.querySelector('.v2-pay-matching')
            if (wrap) _reload(wrap)
          } catch (err) {
            Utils.showToast(err.message || 'Match failed', 'error')
          }
        } }
      ]
    })
  }

  function _matchRulesSection() {
    const section = document.createElement('section')
    section.className = 'v2-pay-matching-section'
    const h = document.createElement('h2')
    h.textContent = 'Match patterns by vendor'
    section.appendChild(h)

    const vendors = State.get('pay.vendors') || []
    const withPatterns = vendors.filter(v => Array.isArray(v.match_patterns) && v.match_patterns.length)
    if (!withPatterns.length) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'No vendors have match patterns yet.'
      section.appendChild(empty)
      return section
    }

    const list = document.createElement('ul')
    list.className = 'v2-panel-list'
    for (const v of withPatterns) {
      const li = document.createElement('li')
      const name = document.createElement('strong')
      name.textContent = v.name
      const patterns = document.createElement('span')
      patterns.className = 'v2-mu'
      patterns.textContent = ` — ${v.match_patterns.join(', ')}`
      li.append(name, patterns)
      list.appendChild(li)
    }
    section.appendChild(list)
    return section
  }

  return { render }
})()

window.PayVendors = PayVendors
