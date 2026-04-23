// v2/spaces/payments/payments-bills.js — Admin/finance view of vendor bills.
// Three sections: Needs review (submitted) | Unpaid work (draft — vendor side,
// shown here for visibility only) | Ready to pay (approved). Actions:
//   approve, return, mark paid.

const PayBills = (() => {
  function render(mount) {
    const wrap = document.createElement('div')
    wrap.className = 'v2-pay-bills'
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
      const bills = await DB.getBills()
      loading.remove()

      const vendors = State.get('pay.vendors') || []
      const vendorById = new Map(vendors.map(v => [v.id, v]))

      wrap.appendChild(_section(
        'Needs review',
        'Submitted by vendor — waiting for approval.',
        bills.filter(b => b.status === 'submitted'),
        vendorById,
        ['approve', 'return']
      ))
      wrap.appendChild(_section(
        'Ready to pay',
        'Approved — ready to be paid out.',
        bills.filter(b => b.status === 'approved'),
        vendorById,
        ['paid', 'return']
      ))
      wrap.appendChild(_section(
        'In-flight drafts',
        'Drafts being built by vendors (read-only from here).',
        bills.filter(b => b.status === 'draft'),
        vendorById,
        []
      ))
      wrap.appendChild(_section(
        'Returned',
        'Locked — the vendor needs to create a fresh draft.',
        bills.filter(b => b.status === 'returned'),
        vendorById,
        []
      ))

      State.set('pay.bills', bills)
    } catch (err) {
      loading.textContent = err.message || 'Failed to load bills'
    }
  }

  function _section(title, hint, bills, vendorById, actions) {
    const section = document.createElement('section')
    section.className = 'v2-pay-bills-section'

    const h = document.createElement('h2')
    h.textContent = `${title} (${bills.length})`
    section.appendChild(h)

    if (hint) {
      const sub = document.createElement('div')
      sub.className = 'v2-mu'
      sub.textContent = hint
      section.appendChild(sub)
    }

    if (!bills.length) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'Nothing here.'
      section.appendChild(empty)
      return section
    }

    const list = document.createElement('div')
    list.className = 'v2-pay-bills-list'
    for (const b of bills) list.appendChild(_billRow(b, vendorById, actions))
    section.appendChild(list)
    return section
  }

  function _billRow(b, vendorById, actions) {
    const row = document.createElement('div')
    row.className = `v2-pay-bill-row v2-pay-bill-${b.status}`

    const left = document.createElement('div')
    left.className = 'v2-pay-bill-left'
    const vendorName = vendorById.get(b.vendor_id)?.name || b.vendor_id
    const vendorEl = document.createElement('div')
    vendorEl.className = 'v2-pay-bill-vendor'
    vendorEl.textContent = vendorName
    const amount = document.createElement('div')
    amount.className = 'v2-pay-bill-amount'
    amount.textContent = Utils.formatCurrency(b.total_amount, b.currency)
    const when = document.createElement('div')
    when.className = 'v2-mu'
    when.textContent = _timeline(b)
    left.append(vendorEl, amount, when)

    const status = document.createElement('div')
    status.insertAdjacentHTML('afterbegin', Badges.billStatus(b.status))

    const rightActions = document.createElement('div')
    rightActions.className = 'v2-pay-bill-actions'
    for (const a of actions) rightActions.appendChild(_mkActionBtn(a, b))

    row.append(left, status, rightActions)
    return row
  }

  function _timeline(b) {
    const parts = []
    if (b.submitted_at) parts.push(`Submitted ${Utils.formatDate(b.submitted_at)}`)
    if (b.approved_at)  parts.push(`Approved ${Utils.formatDate(b.approved_at)}`)
    if (b.returned_at)  parts.push(`Returned ${Utils.formatDate(b.returned_at)}`)
    if (b.paid_at)      parts.push(`Paid ${Utils.formatDate(b.paid_at)}`)
    if (!parts.length)  parts.push(`Created ${Utils.formatDate(b.created_at)}`)
    return parts.join(' · ')
  }

  function _mkActionBtn(action, bill) {
    const labelMap = { approve: 'Approve', return: 'Return', paid: 'Mark paid' }
    const variantMap = { approve: 'primary', return: 'ghost', paid: 'primary' }
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `btn btn-${variantMap[action] || 'ghost'}`
    b.textContent = labelMap[action]
    b.addEventListener('click', async () => {
      b.disabled = true
      try {
        if (action === 'approve') await _approve(bill)
        else if (action === 'return') await _return(bill)
        else if (action === 'paid') await _markPaid(bill)
      } catch (err) {
        console.error('[PayBills]', err)
        Utils.showToast(err.message || 'Action failed', 'error')
      } finally {
        b.disabled = false
      }
    })
    return b
  }

  async function _approve(bill) {
    if (!Guard.action('bill.approve')) { Utils.showToast('Not allowed', 'error'); return }
    await DB.updateBill(bill.id, { status: 'approved', approved_at: new Date().toISOString() })
    Utils.showToast('Bill approved', 'success')
    const wrap = document.querySelector('.v2-pay-bills')
    if (wrap) _reload(wrap)
  }

  async function _return(bill) {
    if (!Guard.action('bill.approve')) { Utils.showToast('Not allowed', 'error'); return }
    Utils.showConfirm(
      'Return this bill to the vendor? Its sessions will be freed so the vendor can start a new draft.',
      async () => {
        try {
          const sessions = await DB.getSessions({})
          const attached = sessions.filter(s => s.bill_id === bill.id)
          await Promise.all(attached.map(s => DB.updateSession(s.id, { bill_id: null, billed: false })))
          await DB.updateBill(bill.id, { status: 'returned', returned_at: new Date().toISOString() })
          Utils.showToast('Bill returned', 'success')
          const wrap = document.querySelector('.v2-pay-bills')
          if (wrap) _reload(wrap)
        } catch (err) { Utils.showToast(err.message || 'Return failed', 'error') }
      },
      { confirmLabel: 'Return', danger: true }
    )
  }

  async function _markPaid(bill) {
    if (!Guard.action('bill.pay')) { Utils.showToast('Not allowed', 'error'); return }
    await DB.updateBill(bill.id, { status: 'paid', paid_at: new Date().toISOString() })
    Utils.showToast('Bill marked paid', 'success')
    const wrap = document.querySelector('.v2-pay-bills')
    if (wrap) _reload(wrap)
  }

  return { render }
})()

window.PayBills = PayBills
