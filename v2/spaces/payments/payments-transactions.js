// v2/spaces/payments/payments-transactions.js — Transactions ledger.
// Filters: month, account, category, entity, direction, search, includeDeleted.
// Bulk classify: multi-select rows → set category/tax_treatment/entity/tags.
// Row click opens a transaction panel for detail inline edit.

const PayTransactions = (() => {
  const _state = {
    month: _thisMonth(),
    account_id: '',
    category_id: '',
    entity: '',
    direction: '',
    search: '',
    includeDeleted: false,
    rows: [],
    selected: new Set()
  }

  function _thisMonth() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  function render(mount) {
    const wrap = document.createElement('div')
    wrap.className = 'v2-pay-tx'
    mount.appendChild(wrap)

    wrap.appendChild(_renderFilterBar(() => _reload(wrap)))

    const bulkBar = document.createElement('div')
    bulkBar.className = 'v2-pay-tx-bulkbar'
    bulkBar.style.display = 'none'
    wrap.appendChild(bulkBar)

    const body = document.createElement('div')
    body.className = 'v2-pay-tx-body'
    wrap.appendChild(body)

    _ensurePanel()
    _reload(wrap)
  }

  async function _reload(wrap) {
    const body = wrap.querySelector('.v2-pay-tx-body')
    body.textContent = 'Loading…'
    try {
      const rows = await DB.getTransactions({
        month: _state.month || undefined,
        account_id: _state.account_id || undefined,
        category_id: _state.category_id || undefined,
        entity: _state.entity || undefined,
        direction: _state.direction || undefined,
        includeDeleted: _state.includeDeleted
      })
      _state.rows = rows
      _state.selected = new Set()
      _paintTable(body)
      _paintBulkBar(wrap.querySelector('.v2-pay-tx-bulkbar'))
    } catch (err) {
      body.textContent = err.message || 'Failed to load transactions'
    }
  }

  function _renderFilterBar(onChange) {
    const bar = document.createElement('div')
    bar.className = 'v2-pay-tx-filters'

    const monthInput = document.createElement('input')
    monthInput.type = 'month'
    monthInput.className = 'fi'
    monthInput.value = _state.month
    monthInput.addEventListener('change', e => { _state.month = e.target.value; onChange() })
    bar.appendChild(_labeled('Month', monthInput))

    const accounts = State.get('pay.accounts') || []
    const acctSel = _select('Account', [{ value: '', label: 'All accounts' }].concat(
      accounts.map(a => ({ value: a.id, label: a.name }))
    ), _state.account_id, v => { _state.account_id = v; onChange() })
    bar.appendChild(acctSel)

    const cats = State.get('pay.categories') || []
    const catSel = _select('Category', [{ value: '', label: 'All categories' }].concat(
      cats.map(c => ({ value: c.id, label: c.name }))
    ), _state.category_id, v => { _state.category_id = v; onChange() })
    bar.appendChild(catSel)

    const entSel = _select('Entity', [
      { value: '', label: 'All entities' },
      { value: 'business', label: 'Business' },
      { value: 'private', label: 'Private' }
    ], _state.entity, v => { _state.entity = v; onChange() })
    bar.appendChild(entSel)

    const dirSel = _select('Direction', [
      { value: '', label: 'All' },
      { value: 'in', label: 'In' },
      { value: 'out', label: 'Out' }
    ], _state.direction, v => { _state.direction = v; onChange() })
    bar.appendChild(dirSel)

    const search = document.createElement('input')
    search.type = 'search'
    search.className = 'fi'
    search.placeholder = 'Search counterparty / reference…'
    search.value = _state.search
    let t = null
    search.addEventListener('input', e => {
      clearTimeout(t)
      t = setTimeout(() => {
        _state.search = e.target.value
        _paintTable(bar.parentElement.querySelector('.v2-pay-tx-body'))
      }, 150)
    })
    bar.appendChild(_labeled('Search', search))

    const showDeleted = document.createElement('label')
    showDeleted.className = 'v2-pay-tx-showdel'
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = _state.includeDeleted
    cb.addEventListener('change', e => { _state.includeDeleted = e.target.checked; onChange() })
    const txt = document.createElement('span')
    txt.textContent = 'Include deleted'
    showDeleted.append(cb, txt)
    bar.appendChild(showDeleted)

    return bar
  }

  function _filteredRows() {
    const q = _state.search.trim().toLowerCase()
    if (!q) return _state.rows
    return _state.rows.filter(r => {
      const hay = [r.counterparty_name, r.reference, r.external_id, r.event_type].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }

  function _paintTable(container) {
    while (container.firstChild) container.removeChild(container.firstChild)
    const rows = _filteredRows()
    if (!rows.length) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'No transactions match the filters.'
      container.appendChild(empty)
      return
    }

    const accounts = State.get('pay.accounts') || []
    const cats = State.get('pay.categories') || []
    const vendors = State.get('pay.vendors') || []
    const accountById = new Map(accounts.map(a => [a.id, a]))
    const catById = new Map(cats.map(c => [c.id, c]))
    const vendorById = new Map(vendors.map(v => [v.id, v]))

    Table.create({
      container,
      columns: [
        {
          key: '_sel', label: '', sortable: false,
          render: r => {
            const cb = document.createElement('input')
            cb.type = 'checkbox'
            cb.checked = _state.selected.has(r.id)
            cb.addEventListener('change', e => {
              if (e.target.checked) _state.selected.add(r.id)
              else _state.selected.delete(r.id)
              _paintBulkBar(document.querySelector('.v2-pay-tx-bulkbar'))
            })
            return cb
          }
        },
        { key: 'transaction_date', label: 'Date', render: r => Utils.formatDate(r.transaction_date) },
        { key: 'direction', label: 'Dir', raw: true, render: r => Badges.direction(r.direction) },
        { key: 'amount', label: 'Amount', render: r => Utils.formatCurrency(r.amount, r.currency) },
        { key: 'counterparty_name', label: 'Counterparty' },
        { key: '_account', label: 'Account' },
        { key: '_category', label: 'Category', raw: true, render: r => {
          const c = catById.get(r.category_id)
          return c ? Badges.category(c.name) : Badges.make('—', { color: 'grey' })
        } },
        { key: '_vendor', label: 'Vendor' },
        { key: 'entity', label: 'B/P' },
        { key: 'tax_treatment', label: 'Tax', raw: true, render: r => Badges.taxTreatment(r.tax_treatment) },
        { key: 'status', label: 'Status', raw: true, render: r => Badges.txStatus(r.status) }
      ],
      rows: rows.map(r => ({
        ...r,
        _account: accountById.get(r.account_id)?.name || '',
        _vendor: vendorById.get(r.vendor_id)?.name || ''
      })),
      onRowClick: r => _openTxPanel(r.id),
      exportFilename: `transactions-${_state.month || 'all'}.csv`,
      pageSize: 50
    })
  }

  // ─── Bulk bar ──────────────────────────────────────────────────
  function _paintBulkBar(bar) {
    while (bar.firstChild) bar.removeChild(bar.firstChild)
    if (!_state.selected.size) { bar.style.display = 'none'; return }
    bar.style.display = ''

    const count = document.createElement('span')
    count.className = 'v2-pay-tx-bulkcount'
    count.textContent = `${_state.selected.size} selected`
    bar.appendChild(count)

    const cats = State.get('pay.categories') || []
    const tags = State.get('pay.tags') || []

    const catSel = _select('Category', [{ value: '', label: '—' }].concat(
      cats.map(c => ({ value: c.id, label: c.name }))
    ), '', () => {})
    bar.appendChild(catSel)

    const taxSel = _select('Tax treatment', [{ value: '', label: '—' }].concat(
      Const.TAX_TREATMENTS.map(t => ({ value: t, label: Const.TAX_TREATMENT_LABELS[t] }))
    ), '', () => {})
    bar.appendChild(taxSel)

    const entSel = _select('Entity', [
      { value: '', label: '—' },
      { value: 'business', label: 'Business' },
      { value: 'private', label: 'Private' }
    ], '', () => {})
    bar.appendChild(entSel)

    const tagSel = _select('Add tag', [{ value: '', label: '—' }].concat(
      tags.map(t => ({ value: t.name, label: t.name }))
    ), '', () => {})
    bar.appendChild(tagSel)

    const apply = document.createElement('button')
    apply.type = 'button'
    apply.className = 'btn btn-primary'
    apply.textContent = 'Apply to selected'
    apply.addEventListener('click', async () => {
      const patch = {}
      const catVal = catSel.querySelector('select').value
      const taxVal = taxSel.querySelector('select').value
      const entVal = entSel.querySelector('select').value
      const tagVal = tagSel.querySelector('select').value
      if (catVal) patch.category_id = catVal
      if (taxVal) patch.tax_treatment = taxVal
      if (entVal) patch.entity = entVal
      if (Object.keys(patch).length === 0 && !tagVal) {
        Utils.showToast('Pick at least one field to set', 'warn')
        return
      }
      apply.disabled = true
      try {
        const ids = [..._state.selected]
        if (Object.keys(patch).length) await DB.bulkUpdateTransactions(ids, patch)
        // Tags need per-row merging since we append, not overwrite.
        if (tagVal) {
          for (const id of ids) {
            const row = _state.rows.find(r => r.id === id)
            const existing = Array.isArray(row?.tags) ? row.tags : []
            if (!existing.includes(tagVal)) {
              await DB.updateTransaction(id, { tags: [...existing, tagVal] })
            }
          }
        }
        Utils.showToast(`Updated ${ids.length} transactions`, 'success')
        await _reload(bar.parentElement)
      } catch (err) {
        Utils.showToast(err.message || 'Bulk update failed', 'error')
      } finally {
        apply.disabled = false
      }
    })
    bar.appendChild(apply)

    const clear = document.createElement('button')
    clear.type = 'button'
    clear.className = 'btn btn-ghost'
    clear.textContent = 'Clear selection'
    clear.addEventListener('click', () => {
      _state.selected = new Set()
      _paintBulkBar(bar)
      _paintTable(bar.parentElement.querySelector('.v2-pay-tx-body'))
    })
    bar.appendChild(clear)
  }

  // ─── Panel handler (inline edit) ───────────────────────────────
  function _ensurePanel() {
    Panel.registerType('transaction', panelHandler)
  }

  function _openTxPanel(id) {
    Panel.open('transaction', id)
  }

  const panelHandler = {
    async load(id) {
      return await DB.getTransaction(id)
    },
    render(entity, ctx) {
      const accounts = State.get('pay.accounts') || []
      const cats = State.get('pay.categories') || []
      const vendors = State.get('pay.vendors') || []
      const eff = { ...entity, ...(ctx.pendingEdits || {}) }
      const canEdit = Guard.action('transaction.edit') && ctx.canEdit

      const wrap = document.createElement('div')
      wrap.className = 'v2-panel-overview'

      wrap.appendChild(_field('Date', Utils.formatDate(eff.transaction_date)))
      wrap.appendChild(_field('Amount', Utils.formatCurrency(eff.amount, eff.currency)))
      wrap.appendChild(_field('Direction', eff.direction))
      wrap.appendChild(_field('Counterparty', eff.counterparty_name))
      wrap.appendChild(_field('Account', accounts.find(a => a.id === eff.account_id)?.name || '—'))
      wrap.appendChild(_field('Category',
        cats.find(c => c.id === eff.category_id)?.name || '—',
        canEdit ? () => _promptSelect('Category', cats.map(c => ({ value: c.id, label: c.name })), eff.category_id, v => Panel.edit('category_id', v || null)) : null
      ))
      wrap.appendChild(_field('Tax treatment', eff.tax_treatment || '—',
        canEdit ? () => _promptSelect('Tax treatment', Const.TAX_TREATMENTS.map(t => ({ value: t, label: Const.TAX_TREATMENT_LABELS[t] })), eff.tax_treatment, v => Panel.edit('tax_treatment', v || null)) : null
      ))
      wrap.appendChild(_field('Entity', eff.entity || '—',
        canEdit ? () => _promptSelect('Entity', [{ value: 'business', label: 'Business' }, { value: 'private', label: 'Private' }], eff.entity, v => Panel.edit('entity', v || null)) : null
      ))
      wrap.appendChild(_field('Vendor',
        vendors.find(v => v.id === eff.vendor_id)?.name || '—',
        canEdit ? () => _promptSelect('Vendor', [{ value: '', label: '— none —' }].concat(vendors.map(v => ({ value: v.id, label: v.name }))), eff.vendor_id, v => Panel.edit('vendor_id', v || null)) : null
      ))
      wrap.appendChild(_field('Tags', (eff.tags || []).join(', '),
        canEdit ? () => _promptText('Tags (comma-separated)', (eff.tags || []).join(', '), v => Panel.edit('tags', v.split(',').map(s => s.trim()).filter(Boolean))) : null
      ))
      wrap.appendChild(_field('Status', eff.status))

      if (canEdit) {
        const del = document.createElement('button')
        del.type = 'button'
        del.className = 'btn btn-ghost v2-panel-danger'
        del.textContent = eff.deleted_at ? 'Restore' : 'Soft-delete'
        del.addEventListener('click', () => {
          const action = eff.deleted_at ? 'restore' : 'soft-delete'
          Utils.showConfirm(`${eff.deleted_at ? 'Restore' : 'Soft-delete'} this transaction?`, async () => {
            try {
              if (eff.deleted_at) await DB.restoreTransaction(entity.id)
              else await DB.softDeleteTransaction(entity.id)
              Panel.close()
              Utils.showToast(`${action} succeeded`, 'success')
              const wrap = document.querySelector('.v2-pay-tx')
              if (wrap) _reload(wrap)
            } catch (err) { Utils.showToast(err.message || 'Failed', 'error') }
          }, { confirmLabel: eff.deleted_at ? 'Restore' : 'Delete', danger: !eff.deleted_at })
        })
        wrap.appendChild(del)
      }
      return {
        title: eff.counterparty_name || '(no counterparty)',
        subtitle: Utils.formatCurrency(eff.amount, eff.currency),
        body: wrap
      }
    },
    async save(id, edits) {
      const updated = await DB.updateTransaction(id, edits)
      const idx = _state.rows.findIndex(r => r.id === id)
      if (idx >= 0) _state.rows[idx] = updated
      const body = document.querySelector('.v2-pay-tx-body')
      if (body) _paintTable(body)
      return updated
    }
  }

  // ─── Field + prompt helpers ────────────────────────────────────
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
    input.value = value || ''
    const m = Modal.open({
      title, size: 'sm', body: input,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Set', variant: 'primary', onClick: () => { onSave(input.value); m.close() } }
      ]
    })
  }

  function _promptSelect(title, options, value, onSave) {
    const sel = document.createElement('select')
    sel.className = 'fi'
    for (const o of options) {
      const opt = document.createElement('option')
      opt.value = o.value
      opt.textContent = o.label
      if (String(o.value) === String(value)) opt.selected = true
      sel.appendChild(opt)
    }
    const m = Modal.open({
      title, size: 'sm', body: sel,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Set', variant: 'primary', onClick: () => { onSave(sel.value); m.close() } }
      ]
    })
  }

  function _labeled(label, control) {
    const wrap = document.createElement('div')
    wrap.className = 'fg v2-filter-fg'
    const lbl = document.createElement('label')
    lbl.className = 'fl'
    lbl.textContent = label
    wrap.append(lbl, control)
    return wrap
  }

  function _select(label, options, value, onChange) {
    const sel = document.createElement('select')
    sel.className = 'fi'
    for (const o of options) {
      const opt = document.createElement('option')
      opt.value = o.value
      opt.textContent = o.label
      if (String(o.value) === String(value)) opt.selected = true
      sel.appendChild(opt)
    }
    sel.addEventListener('change', e => onChange(e.target.value))
    return _labeled(label, sel)
  }

  return { render }
})()

window.PayTransactions = PayTransactions
