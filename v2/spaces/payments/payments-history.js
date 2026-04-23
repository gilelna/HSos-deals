// v2/spaces/payments/payments-history.js — History of paid bills + matched/reconciled transactions.

const PayHistory = (() => {
  function render(mount) {
    const wrap = document.createElement('div')
    wrap.className = 'v2-pay-history'
    mount.appendChild(wrap)
    _reload(wrap)
  }

  async function _reload(wrap) {
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild)
    const loading = document.createElement('div')
    loading.className = 'v2-empty'
    loading.textContent = 'Loading history…'
    wrap.appendChild(loading)
    try {
      const [bills, transactions] = await Promise.all([
        DB.getBills({ status: 'paid' }),
        DB.getTransactions({})
      ])
      loading.remove()
      wrap.appendChild(_billsSection(bills))
      wrap.appendChild(_txSection(transactions.filter(t => t.status === 'matched' || t.status === 'reconciled')))
    } catch (err) {
      loading.textContent = err.message || 'Failed to load'
    }
  }

  function _billsSection(bills) {
    const section = document.createElement('section')
    section.className = 'v2-pay-history-section'
    const h = document.createElement('h2')
    h.textContent = `Paid bills (${bills.length})`
    section.appendChild(h)

    if (!bills.length) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'No paid bills yet.'
      section.appendChild(empty)
      return section
    }

    const vendors = State.get('pay.vendors') || []
    const vendorById = new Map(vendors.map(v => [v.id, v]))

    const tblMount = document.createElement('div')
    section.appendChild(tblMount)
    Table.create({
      container: tblMount,
      columns: [
        { key: 'paid_at', label: 'Paid', render: b => Utils.formatDate(b.paid_at) },
        { key: '_vendor', label: 'Vendor' },
        { key: 'total_amount', label: 'Amount', render: b => Utils.formatCurrency(b.total_amount, b.currency) },
        { key: 'payment_method', label: 'Method' },
        { key: 'payment_reference', label: 'Reference' }
      ],
      rows: bills.map(b => ({ ...b, _vendor: vendorById.get(b.vendor_id)?.name || b.vendor_id })),
      exportFilename: 'paid-bills.csv',
      pageSize: 50
    })
    return section
  }

  function _txSection(txs) {
    const section = document.createElement('section')
    section.className = 'v2-pay-history-section'
    const h = document.createElement('h2')
    h.textContent = `Matched transactions (${txs.length})`
    section.appendChild(h)

    if (!txs.length) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'No matched transactions.'
      section.appendChild(empty)
      return section
    }

    const accounts = State.get('pay.accounts') || []
    const accountById = new Map(accounts.map(a => [a.id, a]))

    const tblMount = document.createElement('div')
    section.appendChild(tblMount)
    Table.create({
      container: tblMount,
      columns: [
        { key: 'transaction_date', label: 'Date', render: t => Utils.formatDate(t.transaction_date) },
        { key: 'direction', label: 'Dir', raw: true, render: t => Badges.direction(t.direction) },
        { key: 'amount', label: 'Amount', render: t => Utils.formatCurrency(t.amount, t.currency) },
        { key: 'counterparty_name', label: 'Counterparty' },
        { key: '_account', label: 'Account' },
        { key: 'status', label: 'Status', raw: true, render: t => Badges.txStatus(t.status) }
      ],
      rows: txs.map(t => ({ ...t, _account: accountById.get(t.account_id)?.name || '' })),
      exportFilename: 'matched-transactions.csv',
      pageSize: 50
    })
    return section
  }

  return { render }
})()

window.PayHistory = PayHistory
