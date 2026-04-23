// v2/spaces/payments/payments-balances.js — Monthly account balance snapshots.
// Table grouped by account; add/edit snapshots via modal.

const PayBalances = (() => {
  function render(mount) {
    const wrap = document.createElement('div')
    wrap.className = 'v2-pay-balances'
    mount.appendChild(wrap)

    const header = document.createElement('div')
    header.className = 'v2-page-subheader'
    const h = document.createElement('h2')
    h.textContent = 'Account balances'
    header.appendChild(h)

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn-primary'
    addBtn.textContent = 'Add snapshot'
    addBtn.addEventListener('click', () => _openEditSnapshot(null, () => _reload(wrap)))
    header.appendChild(addBtn)
    wrap.appendChild(header)

    const body = document.createElement('div')
    body.className = 'v2-pay-balances-body'
    wrap.appendChild(body)
    _reload(wrap)
  }

  async function _reload(wrap) {
    const body = wrap.querySelector('.v2-pay-balances-body')
    while (body.firstChild) body.removeChild(body.firstChild)
    const loading = document.createElement('div')
    loading.className = 'v2-empty'
    loading.textContent = 'Loading balances…'
    body.appendChild(loading)

    try {
      const balances = await DB.getAccountBalances({})
      loading.remove()
      if (!balances.length) {
        const empty = document.createElement('div')
        empty.className = 'v2-empty'
        empty.textContent = 'No snapshots yet.'
        body.appendChild(empty)
        return
      }

      const accounts = State.get('pay.accounts') || []
      const accountById = new Map(accounts.map(a => [a.id, a]))

      Table.create({
        container: body,
        columns: [
          { key: 'month', label: 'Month', render: b => _monthLabel(b.month) },
          { key: '_account', label: 'Account' },
          { key: 'opening_balance', label: 'Opening', render: b => Utils.formatCurrency(b.opening_balance, b.currency) },
          { key: 'closing_balance', label: 'Closing', render: b => Utils.formatCurrency(b.closing_balance, b.currency) },
          { key: 'currency', label: 'Currency' },
          { key: 'notes', label: 'Notes' }
        ],
        rows: balances.map(b => ({ ...b, _account: accountById.get(b.account_id)?.name || b.account_id })),
        onRowClick: b => _openEditSnapshot(b, () => _reload(wrap)),
        exportFilename: 'account-balances.csv',
        pageSize: 50
      })
    } catch (err) {
      loading.textContent = err.message || 'Failed to load'
    }
  }

  function _openEditSnapshot(existing, after) {
    const isNew = !existing
    const accounts = State.get('pay.accounts') || []
    const form = document.createElement('form')
    form.noValidate = true
    form.addEventListener('submit', e => e.preventDefault())

    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'account_id', label: 'Account', required: true,
      options: accounts.map(a => ({ value: a.id, label: a.name })),
      value: existing?.account_id || (accounts[0]?.id || '')
    }))
    // DB stores month as a DATE (first-of-month). Bind to an <input type=month>.
    form.insertAdjacentHTML('beforeend', Form.input({
      id: 'month', label: 'Month', type: 'month', required: true, value: _monthInputValue(existing?.month)
    }))
    form.insertAdjacentHTML('beforeend', Form.input({
      id: 'opening_balance', label: 'Opening balance', type: 'number', step: '0.01',
      value: existing?.opening_balance ?? ''
    }))
    form.insertAdjacentHTML('beforeend', Form.input({
      id: 'closing_balance', label: 'Closing balance', type: 'number', step: '0.01',
      value: existing?.closing_balance ?? ''
    }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'currency', label: 'Currency', required: true,
      options: Const.CURRENCIES.map(c => ({ value: c, label: c })),
      value: existing?.currency || 'USD'
    }))
    form.insertAdjacentHTML('beforeend', Form.textarea({ id: 'notes', label: 'Notes', rows: 2, value: existing?.notes || '' }))

    const m = Modal.open({
      title: isNew ? 'Add balance snapshot' : 'Edit balance snapshot',
      size: 'md',
      body: form,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: isNew ? 'Create' : 'Save', variant: 'primary', onClick: async () => {
          const { valid, errors, values } = Form.validate(form)
          if (!valid) { Form.showErrors(form, errors); return }
          if (!/^\d{4}-\d{2}$/.test(values.month)) {
            Form.showErrors(form, [{ id: 'month', label: 'Month', message: 'Pick a month' }])
            return
          }
          const payload = {
            account_id: values.account_id,
            month: `${values.month}-01`,  // DB column is DATE; store first-of-month
            opening_balance: values.opening_balance === '' ? null : Number(values.opening_balance),
            closing_balance: values.closing_balance === '' ? null : Number(values.closing_balance),
            currency: values.currency,
            notes: values.notes || null
          }
          try {
            await DB.upsertAccountBalance(payload)
            Utils.showToast('Saved', 'success')
            m.close()
            after && after()
          } catch (err) {
            Utils.showToast(err.message || 'Save failed', 'error')
          }
        } }
      ]
    })
  }

  // ─── Month helpers (DB stores month as DATE, UI uses YYYY-MM) ──
  function _monthInputValue(dbValue) {
    if (!dbValue) return ''
    // dbValue is either '2026-04' (legacy text) or '2026-04-01' (date).
    return String(dbValue).slice(0, 7)
  }

  function _monthLabel(dbValue) {
    return Utils.formatMonth(_monthInputValue(dbValue))
  }

  return { render }
})()

window.PayBalances = PayBalances
