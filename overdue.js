// overdue.js — Open Invoices workflow page
// Lists deals with billing_status IN (overdue, pending, invoiced), oldest first.
// Per-row actions: Send reminder (stub toast), Mark paid, Open in Green Invoice.

const OV_STATUSES = ['overdue', 'pending', 'invoiced']
const SYM = { USD: '$', ILS: '₪', EUR: '€' }

let ovDeals            = []
let ovFilter           = 'all'
let _routerDispatching = false
let _routerRegistered  = false

function runWithRouterDispatch(fn) {
  _routerDispatching = true
  try { return fn() } finally { _routerDispatching = false }
}

function ovRegisterRouter() {
  if (!window.Router || _routerRegistered) return
  _routerRegistered = true

  Router.register('client', ({ id }) => {
    runWithRouterDispatch(() => {
      if (window.SidePanel?.open) { window.SidePanel.open('client', { id }); return }
      window.PanelManager?.open('client', id)
    })
  })

  Router.register('deal', ({ id }) => {
    runWithRouterDispatch(() => {
      if (window.SidePanel?.open) { window.SidePanel.open('deal', { id }); return }
      window.PanelManager?.open('deal', id)
    })
  })
}

// ── helpers ──────────────────────────────────────────────────────────────────
function ovFmtAmount(n, cur) {
  const sym = SYM[cur] || ''
  const v   = Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return sym + v
}
function ovDaysSince(iso) {
  if (!iso) return 0
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}
function ovStatusBadge(status) {
  const map = {
    overdue:  { bg: 'var(--red-bg)',    fg: 'var(--red-text)' },
    pending:  { bg: 'var(--amber-bg)',  fg: 'var(--amber-text)' },
    invoiced: { bg: 'var(--purple-bg)', fg: 'var(--purple-text)' },
  }
  const c = map[status] || { bg: 'var(--bg)', fg: 'var(--mu)' }
  const safe = escHtml(status)
  return '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:' + c.bg + ';color:' + c.fg + ';font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.05em">' + safe + '</span>'
}

// ── data ─────────────────────────────────────────────────────────────────────
async function ovLoad() {
  try {
    const lists = await Promise.all(
      OV_STATUSES.map(s => getDeals({ billing_status: s }))
    )
    const merged = [].concat(...lists)
      .filter(d => d.sales_status !== 'closed' && d.sales_status !== 'lead')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    ovDeals = merged
    ovUpdateMetrics()
    ovRender()
  } catch (err) {
    console.error('[overdue] load', err)
    const root = document.getElementById('ov-list')
    if (root) {
      root.textContent = ''
      const div = document.createElement('div')
      div.style.cssText = 'padding:40px;text-align:center;color:var(--red-text);font-size:13px'
      div.textContent = 'Failed to load: ' + (err.message || String(err))
      root.appendChild(div)
    }
  }
}

// ── metrics ──────────────────────────────────────────────────────────────────
function ovUpdateMetrics() {
  const sum = arr => arr.reduce((s, d) => s + Number(d.agreed_price || 0), 0)
  const overdue  = ovDeals.filter(d => d.billing_status === 'overdue')
  const pending  = ovDeals.filter(d => d.billing_status === 'pending')
  const invoiced = ovDeals.filter(d => d.billing_status === 'invoiced')

  const fmt = (arr) => arr.length
    ? arr.length + ' · ' + ovFmtAmount(sum(arr), arr[0]?.agreed_currency || 'USD')
    : '0'

  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v }
  setText('ov-metric-overdue',  fmt(overdue))
  setText('ov-metric-pending',  fmt(pending))
  setText('ov-metric-invoiced', fmt(invoiced))
  setText('ov-metric-total',    fmt(ovDeals))
}

// ── filter ───────────────────────────────────────────────────────────────────
function ovSetFilter(f) {
  ovFilter = f
  document.querySelectorAll('#ov-filter-bar [data-pill]').forEach(b => {
    b.classList.toggle('btn-primary', b.dataset.pill === f)
  })
  ovRender()
}
window.ovSetFilter = ovSetFilter

// ── render ───────────────────────────────────────────────────────────────────
function ovRender() {
  const root = document.getElementById('ov-list')
  if (!root) return

  const rows = ovFilter === 'all'
    ? ovDeals
    : ovDeals.filter(d => d.billing_status === ovFilter)

  const badge = document.getElementById('ov-count-badge')
  if (badge) badge.textContent = rows.length + ' deal' + (rows.length === 1 ? '' : 's')

  root.textContent = ''

  if (!rows.length) {
    const empty = document.createElement('div')
    empty.style.cssText = 'padding:40px;text-align:center;color:var(--mu2);font-size:13px'
    empty.textContent = 'No open invoices in this view.'
    root.appendChild(empty)
    return
  }

  rows.forEach(d => root.appendChild(ovBuildCard(d)))
}

function ovBuildCard(d) {
  const status      = d.billing_status || 'pending'
  const days        = ovDaysSince(d.created_at)
  const ageLabel    = status === 'overdue' ? days + 'd overdue' : 'Open ' + days + 'd'
  const clientName  = d.clients?.full_name || '—'
  const clientId    = d.clients?.id || ''
  const productName = d.products?.name || d.notes || 'Untitled deal'
  const invSeries   = d.gi_invoice_series || ''
  const payMethod   = d.payment_method || ''
  const dealId      = d.id

  const card = document.createElement('div')
  card.className = 'block'
  card.style.cssText = 'padding:16px 20px;margin-bottom:10px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center'

  // Left column
  const left = document.createElement('div')

  const headRow = document.createElement('div')
  headRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:4px'

  if (clientId) {
    const btn = document.createElement('button')
    btn.className = 'ep-link'
    btn.style.cssText = 'font-size:14px;font-weight:600;color:var(--ink)'
    btn.textContent = clientName
    btn.addEventListener('click', () => ovOpenClient(clientId))
    headRow.appendChild(btn)
  } else {
    const span = document.createElement('span')
    span.style.cssText = 'font-size:14px;font-weight:600;color:var(--ink)'
    span.textContent = clientName
    headRow.appendChild(span)
  }

  const statusEl = document.createElement('span')
  statusEl.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.05em'
  const badgeColors = {
    overdue:  ['var(--red-bg)',    'var(--red-text)'],
    pending:  ['var(--amber-bg)',  'var(--amber-text)'],
    invoiced: ['var(--purple-bg)', 'var(--purple-text)'],
  }
  const [bg, fg] = badgeColors[status] || ['var(--bg)', 'var(--mu)']
  statusEl.style.background = bg
  statusEl.style.color = fg
  statusEl.textContent = status
  headRow.appendChild(statusEl)

  if (payMethod) {
    const pm = document.createElement('span')
    pm.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:10px;background:var(--bg);color:var(--mu);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.05em'
    pm.textContent = payMethod
    headRow.appendChild(pm)
  }
  left.appendChild(headRow)

  const subRow = document.createElement('div')
  subRow.style.cssText = 'display:flex;align-items:center;gap:14px;flex-wrap:wrap'

  const dealBtn = document.createElement('button')
  dealBtn.className = 'ep-link'
  dealBtn.style.cssText = 'font-size:13px;color:var(--mu)'
  dealBtn.textContent = productName
  dealBtn.addEventListener('click', () => ovOpenDeal(dealId))
  subRow.appendChild(dealBtn)

  const ageEl = document.createElement('span')
  ageEl.style.cssText = 'font-size:11px;color:var(--mu)'
  ageEl.textContent = ageLabel
  subRow.appendChild(ageEl)

  if (invSeries) {
    const invWrap = document.createElement('div')
    invWrap.style.cssText = 'font-size:11px;color:var(--mu);font-family:var(--font-mono)'
    invWrap.appendChild(document.createTextNode('Invoice '))
    const invVal = document.createElement('span')
    invVal.style.color = 'var(--ink)'
    invVal.textContent = invSeries
    invWrap.appendChild(invVal)
    subRow.appendChild(invWrap)
  }
  left.appendChild(subRow)
  card.appendChild(left)

  // Right column
  const right = document.createElement('div')
  right.style.cssText = 'display:flex;align-items:center;gap:16px'

  const amtBlock = document.createElement('div')
  amtBlock.style.cssText = 'text-align:right'
  const amtEl = document.createElement('div')
  amtEl.style.cssText = 'font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--ink)'
  amtEl.textContent = ovFmtAmount(d.agreed_price, d.agreed_currency)
  amtBlock.appendChild(amtEl)
  const curEl = document.createElement('div')
  curEl.style.cssText = 'font-size:10px;color:var(--mu);font-family:var(--font-mono)'
  curEl.textContent = d.agreed_currency || ''
  amtBlock.appendChild(curEl)
  right.appendChild(amtBlock)

  const actions = document.createElement('div')
  actions.style.cssText = 'display:flex;gap:6px'

  const remBtn = document.createElement('button')
  remBtn.className = 'btn btn-sm'
  remBtn.textContent = 'Send reminder'
  remBtn.addEventListener('click', () => ovSendReminder(dealId))
  actions.appendChild(remBtn)

  const paidBtn = document.createElement('button')
  paidBtn.className = 'btn btn-sm btn-primary'
  paidBtn.textContent = 'Mark paid'
  paidBtn.addEventListener('click', () => ovMarkPaid(dealId))
  actions.appendChild(paidBtn)

  if (d.gi_client_id) {
    const giBtn = document.createElement('button')
    giBtn.className = 'btn btn-sm'
    giBtn.textContent = 'Open in Green Invoice'
    giBtn.addEventListener('click', () => ovOpenGreenInvoice(dealId))
    actions.appendChild(giBtn)
  }
  right.appendChild(actions)
  card.appendChild(right)

  return card
}

// ── actions ──────────────────────────────────────────────────────────────────
function ovOpenClient(clientId) {
  if (!clientId) return
  if (window.Router && !_routerDispatching) {
    Router.open({ entity: 'client', id: clientId, view: 'panel', from: 'overdue' })
    return
  }
  if (window.SidePanel?.open) { window.SidePanel.open('client', { id: clientId }); return }
  window.PanelManager?.open('client', clientId)
}
window.ovOpenClient = ovOpenClient

function ovOpenDeal(dealId) {
  if (!dealId) return
  if (window.Router && !_routerDispatching) {
    Router.open({ entity: 'deal', id: dealId, view: 'panel', from: 'overdue' })
    return
  }
  if (window.SidePanel?.open) { window.SidePanel.open('deal', { id: dealId }); return }
  window.PanelManager?.open('deal', dealId)
}
window.ovOpenDeal = ovOpenDeal

async function ovSendReminder(dealId) {
  // Stub: actual reminder/email integration not built. Surface intent via toast.
  showToast('Reminder queued (stub) — integration pending', 'info')
}
window.ovSendReminder = ovSendReminder

async function ovMarkPaid(dealId) {
  if (!dealId) return
  const deal = ovDeals.find(d => d.id === dealId)
  const label = deal?.clients?.full_name || 'this deal'
  if (!window.confirm('Mark "' + label + '" as paid?')) return
  try {
    await updateDeal(dealId, { billing_status: 'paid' })
    if (window.Cache) {
      Cache.invalidate('deal:' + dealId)
      Cache.invalidate('deals:list')
    }
    ovDeals = ovDeals.filter(d => d.id !== dealId)
    ovUpdateMetrics()
    ovRender()
    showToast('Marked as paid', 'success')
  } catch (err) {
    console.error('[overdue] markPaid', err)
    showToast('Failed: ' + (err.message || err), 'error')
  }
}
window.ovMarkPaid = ovMarkPaid

function ovOpenGreenInvoice(dealId) {
  // No external URL column exists on clients/deals. Surface gi refs so finance can copy.
  const d = ovDeals.find(x => x.id === dealId)
  if (!d) return
  const ref = [d.gi_client_id, d.gi_invoice_series].filter(Boolean).join(' / ')
  showToast(ref ? 'GI ref: ' + ref : 'No Green Invoice ref on this deal', 'info')
}
window.ovOpenGreenInvoice = ovOpenGreenInvoice

// ── boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (window.LAYOUT?.init) window.LAYOUT.init('Open Invoices', 'payments')
  ovRegisterRouter()
  ovSetFilter('all')
  ovLoad()
})
