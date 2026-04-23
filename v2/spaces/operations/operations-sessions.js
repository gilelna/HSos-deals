// v2/spaces/operations/operations-sessions.js — Sessions tab.
// Top: month picker + summary (hours / earnings).
// Middle: unpaid sessions table + bill management.
// Bottom: "History" sub-tab (all past sessions).
//
// Bill flow (4 DB states + "Ready to pay" is a UI grouping for approved-unpaid):
//   draft → submitted → approved → paid
//   (returned = locked; vendor must start fresh)

const OpsSessions = (() => {
  const SUB = ['current', 'history']

  function render(mount) {
    const wrap = document.createElement('div')
    wrap.className = 'v2-ops-sessions'
    mount.appendChild(wrap)

    const subBar = document.createElement('nav')
    subBar.className = 'v2-subtabs'
    let active = 'current'
    for (const s of SUB) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'v2-tab'
      b.dataset.sub = s
      b.textContent = s === 'current' ? 'This month + unpaid' : 'History'
      b.addEventListener('click', () => {
        active = s
        for (const btn of subBar.querySelectorAll('.v2-tab')) {
          btn.classList.toggle('v2-tab-active', btn.dataset.sub === s)
        }
        _paintSub(body, active)
      })
      subBar.appendChild(b)
    }
    subBar.querySelector(`[data-sub="current"]`).classList.add('v2-tab-active')
    wrap.appendChild(subBar)

    const body = document.createElement('div')
    body.className = 'v2-ops-sessions-body'
    wrap.appendChild(body)
    _paintSub(body, active)
  }

  function _paintSub(mount, sub) {
    while (mount.firstChild) mount.removeChild(mount.firstChild)
    if (sub === 'current') _paintCurrent(mount)
    else _paintHistory(mount)
  }

  // ─── Current: month picker + unpaid + bill flow ────────────────
  function _paintCurrent(mount) {
    const now = new Date()
    let ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const header = document.createElement('div')
    header.className = 'v2-ops-month-header'

    const monthInput = document.createElement('input')
    monthInput.type = 'month'
    monthInput.className = 'fi v2-ops-month-input'
    monthInput.value = ym
    monthInput.addEventListener('change', e => { ym = e.target.value; _repaintCurrent() })
    header.appendChild(monthInput)

    const summary = document.createElement('div')
    summary.className = 'v2-ops-month-summary'
    header.appendChild(summary)

    mount.appendChild(header)

    // Active bill banner + actions
    const billBanner = document.createElement('div')
    billBanner.className = 'v2-ops-bill-banner'
    mount.appendChild(billBanner)

    // Unpaid sessions table
    const unpaidWrap = document.createElement('div')
    unpaidWrap.className = 'v2-ops-unpaid'
    mount.appendChild(unpaidWrap)

    function _repaintCurrent() {
      _paintSummary(summary, ym)
      _paintBillBanner(billBanner, _repaintCurrent)
      _paintUnpaid(unpaidWrap)
    }
    _repaintCurrent()
  }

  function _paintSummary(container, ym) {
    const sessions = State.get('ops.sessions') || []
    const [y, m] = ym.split('-').map(Number)
    const monthly = sessions.filter(s => {
      const d = new Date(s.session_date)
      return d.getFullYear() === y && d.getMonth() + 1 === m
    })
    const hours = monthly.reduce((n, s) => n + (Number(s.hours) || 0), 0)
    const earnings = monthly.reduce((n, s) => n + (Number(s.rate_usd) || 0), 0)

    while (container.firstChild) container.removeChild(container.firstChild)
    container.appendChild(_kpi('Sessions', String(monthly.length)))
    container.appendChild(_kpi('Hours', hours.toFixed(1)))
    container.appendChild(_kpi('Earnings (est.)', Utils.formatCurrency(earnings, 'USD')))
  }

  function _paintBillBanner(container, repaintAfter) {
    while (container.firstChild) container.removeChild(container.firstChild)

    const vendor = State.get('ops.vendor')
    const bills = State.get('ops.bills') || []
    const active = _activeBill(bills)

    if (!active) {
      // No active bill → offer to create a draft from unbilled sessions
      const box = document.createElement('div')
      box.className = 'v2-ops-bill-empty'
      const msg = document.createElement('span')
      msg.textContent = 'No active bill. Create a draft from your unbilled sessions.'
      box.appendChild(msg)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'btn btn-primary'
      btn.textContent = 'Create draft bill'
      btn.addEventListener('click', () => _createDraft(vendor.id, repaintAfter))
      box.appendChild(btn)
      container.appendChild(box)
      return
    }

    // Active bill banner
    const box = document.createElement('div')
    box.className = `v2-ops-bill-active v2-ops-bill-${active.status}`

    const title = document.createElement('div')
    title.className = 'v2-ops-bill-title'
    title.textContent = `Bill — ${Const.BILL_STATUS_LABELS[active.status] || active.status} — ${Utils.formatCurrency(active.total_amount, active.currency)}`
    box.appendChild(title)
    box.insertAdjacentHTML('beforeend', Badges.billStatus(active.status))

    const actions = document.createElement('div')
    actions.className = 'v2-ops-bill-actions'

    if (active.status === 'draft') {
      actions.appendChild(_mkBtn('Submit for approval', 'primary', () => _submitDraft(active, repaintAfter)))
      actions.appendChild(_mkBtn('Withdraw', 'ghost', () => _withdrawDraft(active, repaintAfter)))
    } else if (active.status === 'submitted') {
      actions.appendChild(_mkBtn('Withdraw', 'ghost', () => _withdrawDraft(active, repaintAfter)))
      if (Guard.action('bill.approve')) {
        actions.appendChild(_mkBtn('Approve', 'primary', () => _approveBill(active, repaintAfter)))
        actions.appendChild(_mkBtn('Return', 'ghost', () => _returnBill(active, repaintAfter)))
      }
    } else if (active.status === 'approved') {
      const tag = document.createElement('span')
      tag.className = 'v2-pill v2-pill-blue'
      tag.textContent = 'Ready to pay'
      actions.appendChild(tag)
      if (Guard.action('bill.pay')) {
        actions.appendChild(_mkBtn('Mark paid', 'primary', () => _markPaid(active, repaintAfter)))
      }
    } else if (active.status === 'returned') {
      const note = document.createElement('div')
      note.className = 'v2-ops-bill-note'
      note.textContent = 'This bill was returned. It is locked — start a new draft to retry.'
      box.appendChild(note)
      actions.appendChild(_mkBtn('Start new draft', 'primary', () => _createDraft(State.get('ops.vendor').id, repaintAfter)))
    }
    box.appendChild(actions)
    container.appendChild(box)
  }

  function _activeBill(bills) {
    // Priority: draft > submitted > approved > returned (if no newer). Paid
    // bills never count as "active" for this vendor.
    const order = { draft: 4, submitted: 3, approved: 2, returned: 1 }
    const candidates = bills.filter(b => b.status !== 'paid')
    if (!candidates.length) return null
    return candidates.slice().sort((a, b) => (order[b.status] || 0) - (order[a.status] || 0))[0]
  }

  function _paintUnpaid(container) {
    while (container.firstChild) container.removeChild(container.firstChild)
    const sessions = (State.get('ops.sessions') || []).filter(s => !s.billed)
    const clients = State.get('ops.clients') || []
    const taskTypes = State.get('ops.taskTypes') || []
    const clientById = new Map(clients.map(c => [c.id, c]))
    const ttById = new Map(taskTypes.map(t => [t.id, t]))

    const h = document.createElement('h2')
    h.className = 'v2-ops-unpaid-title'
    h.textContent = `Unbilled sessions (${sessions.length})`
    container.appendChild(h)

    if (!sessions.length) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'Nothing to bill — all sessions are on a bill already.'
      container.appendChild(empty)
      return
    }

    const tblMount = document.createElement('div')
    container.appendChild(tblMount)
    Table.create({
      container: tblMount,
      columns: [
        { key: 'session_date', label: 'Date', render: s => Utils.formatDate(s.session_date) },
        { key: '_client',      label: 'Client' },
        { key: '_task',        label: 'Task' },
        { key: 'duration_min', label: 'Minutes' },
        { key: 'rate_usd',     label: 'Est.', render: s => Utils.formatCurrency(s.rate_usd, 'USD') }
      ],
      rows: sessions.map(s => ({
        ...s,
        _client: clientById.get(s.client_id)?.full_name || '(unknown)',
        _task: ttById.get(s.task_type_id)?.name || '(unknown)'
      })),
      exportFilename: 'unbilled-sessions.csv',
      pageSize: 50
    })
  }

  // ─── History ───────────────────────────────────────────────────
  function _paintHistory(mount) {
    const sessions = (State.get('ops.sessions') || []).slice().sort(_byDateDesc)
    const clients = State.get('ops.clients') || []
    const taskTypes = State.get('ops.taskTypes') || []
    const clientById = new Map(clients.map(c => [c.id, c]))
    const ttById = new Map(taskTypes.map(t => [t.id, t]))

    if (!sessions.length) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'No sessions yet.'
      mount.appendChild(empty)
      return
    }

    Table.create({
      container: mount,
      columns: [
        { key: 'session_date', label: 'Date', render: s => Utils.formatDate(s.session_date) },
        { key: '_client',      label: 'Client' },
        { key: '_task',        label: 'Task' },
        { key: 'duration_min', label: 'Minutes' },
        { key: 'rate_usd',     label: 'Est.', render: s => Utils.formatCurrency(s.rate_usd, 'USD') },
        { key: 'billed',       label: 'Billed', raw: true, render: s => s.billed ? Badges.make('Billed', { color: 'green' }) : Badges.make('Unbilled', { color: 'amber' }) }
      ],
      rows: sessions.map(s => ({
        ...s,
        _client: clientById.get(s.client_id)?.full_name || '(unknown)',
        _task: ttById.get(s.task_type_id)?.name || '(unknown)'
      })),
      exportFilename: 'session-history.csv',
      pageSize: 50
    })
  }

  // ─── Bill actions ──────────────────────────────────────────────
  async function _createDraft(vendorId, after) {
    // Collect unbilled sessions to compute total
    const sessions = (State.get('ops.sessions') || []).filter(s => !s.billed)
    if (!sessions.length) { Utils.showToast('No unbilled sessions to bill', 'warn'); return }

    const total = sessions.reduce((n, s) => n + (Number(s.rate_usd) || 0), 0)
    const currency = 'USD'

    try {
      const bill = await DB.createBill({ vendor_id: vendorId, total_amount: Number(total.toFixed(2)), currency })
      // Attach sessions to the draft bill
      await Promise.all(sessions.map(s => DB.updateSession(s.id, { bill_id: bill.id, billed: true })))
      Utils.showToast('Draft bill created', 'success')
      await OpsInit.refresh()
      after && after()
    } catch (err) {
      Utils.showToast(err.message || 'Failed to create draft', 'error')
    }
  }

  async function _submitDraft(bill, after) {
    try {
      await DB.updateBill(bill.id, { status: 'submitted', submitted_at: new Date().toISOString() })
      Utils.showToast('Bill submitted', 'success')
      await OpsInit.refresh()
      after && after()
    } catch (err) {
      Utils.showToast(err.message || 'Submit failed', 'error')
    }
  }

  async function _withdrawDraft(bill, after) {
    Utils.showConfirm(
      'Withdraw this bill? Its sessions will be returned to the unbilled list.',
      async () => {
        try {
          // Detach sessions first
          const sessions = (State.get('ops.sessions') || []).filter(s => s.bill_id === bill.id)
          await Promise.all(sessions.map(s => DB.updateSession(s.id, { bill_id: null, billed: false })))
          // Delete the bill row (no DB.deleteBill yet — use returned+note approach)
          // For now, we mark the bill as returned so history is preserved.
          await DB.updateBill(bill.id, { status: 'returned', returned_at: new Date().toISOString() })
          Utils.showToast('Bill withdrawn', 'success')
          await OpsInit.refresh()
          after && after()
        } catch (err) {
          Utils.showToast(err.message || 'Withdraw failed', 'error')
        }
      },
      { confirmLabel: 'Withdraw', danger: true }
    )
  }

  async function _approveBill(bill, after) {
    try {
      await DB.updateBill(bill.id, { status: 'approved', approved_at: new Date().toISOString() })
      Utils.showToast('Bill approved', 'success')
      await OpsInit.refresh()
      after && after()
    } catch (err) {
      Utils.showToast(err.message || 'Approve failed', 'error')
    }
  }

  async function _returnBill(bill, after) {
    Utils.showConfirm(
      'Return this bill? The vendor will need to start a new draft.',
      async () => {
        try {
          // Detach sessions so the vendor can re-bill them.
          const sessions = (State.get('ops.sessions') || []).filter(s => s.bill_id === bill.id)
          await Promise.all(sessions.map(s => DB.updateSession(s.id, { bill_id: null, billed: false })))
          await DB.updateBill(bill.id, { status: 'returned', returned_at: new Date().toISOString() })
          Utils.showToast('Bill returned', 'success')
          await OpsInit.refresh()
          after && after()
        } catch (err) {
          Utils.showToast(err.message || 'Return failed', 'error')
        }
      },
      { confirmLabel: 'Return', danger: true }
    )
  }

  async function _markPaid(bill, after) {
    try {
      await DB.updateBill(bill.id, { status: 'paid', paid_at: new Date().toISOString() })
      Utils.showToast('Bill marked paid', 'success')
      await OpsInit.refresh()
      after && after()
    } catch (err) {
      Utils.showToast(err.message || 'Mark paid failed', 'error')
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────
  function _mkBtn(label, variant, onClick) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `btn btn-${variant}`
    b.textContent = label
    b.addEventListener('click', async () => {
      b.disabled = true
      try { await onClick() } catch (err) {
        console.error('[OpsSessions]', err)
        Utils.showToast(err.message || 'Action failed', 'error')
      } finally { b.disabled = false }
    })
    return b
  }

  function _kpi(label, value) {
    const card = document.createElement('div')
    card.className = 'v2-kpi-card'
    const l = document.createElement('div')
    l.className = 'v2-kpi-label'
    l.textContent = label
    const v = document.createElement('div')
    v.className = 'v2-kpi-value'
    v.textContent = value
    card.append(l, v)
    return card
  }

  function _byDateDesc(a, b) {
    return new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
  }

  return { render }
})()

window.OpsSessions = OpsSessions
