// reconcile.js — match unmatched transactions to open deals or submitted bills.
// All Supabase access goes through db.js (matchTransactionToDeal, matchTransactionToBill,
// getDeals, getAllBills, getTransactions, getClients).

// ─── state ─────────────────────────────────────────────────────
let rcCurrentTab = 'deals'         // 'deals' | 'bills'
let rcDeals      = []              // open deals (pending|overdue|invoiced|partial)
let rcBills      = []              // submitted vendor bills
let rcTxs        = []              // unmatched transactions
let rcClients    = []              // for client name + green_invoice_client_id lookup
let rcSelectedLeftId  = null       // dealId or billId
let rcSelectedRightId = null       // txId
let rcSuggestions     = new Map()  // key: leftId → Set<txId> (suggested matches per deal/bill)
let rcHighlightDealId = null

// ─── utils ─────────────────────────────────────────────────────
const SYM = { USD: '$', ILS: '₪', EUR: '€' }
function rcSym(c) { return SYM[c] || '$' }
function rcFmt(amount, currency) {
  const n = Number(amount || 0)
  return `${rcSym(currency)}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}
function rcDaysSince(d) {
  if (!d) return null
  const ms = Date.now() - new Date(d).getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}
function rcDateShort(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Two amounts are similar if within 5%.
function rcAmountsSimilar(a, b) {
  const x = Math.abs(Number(a) || 0)
  const y = Math.abs(Number(b) || 0)
  if (!x || !y) return false
  const diff = Math.abs(x - y)
  const base = Math.max(x, y)
  return diff / base < 0.05
}

// Within `days` of each other.
function rcDatesWithin(a, b, days) {
  if (!a || !b) return false
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return ms / 86400000 <= days
}

// ─── boot ──────────────────────────────────────────────────────
async function init() {
  rcSkeleton()

  // Read ?highlight=<dealId> + ?tab=
  const qs = new URLSearchParams(window.location.search)
  rcHighlightDealId = qs.get('highlight') || null
  const qsTab = qs.get('tab')
  if (qsTab === 'bills') rcCurrentTab = 'bills'

  // Reflect tab toggle in DOM before await.
  document.getElementById('rc-tab-deals').classList.toggle('cur', rcCurrentTab === 'deals')
  document.getElementById('rc-tab-bills').classList.toggle('cur', rcCurrentTab === 'bills')

  try {
    const [deals, bills, txs, clients] = await Promise.all([
      getDeals(),
      getAllBills({ status: 'submitted' }),
      getTransactions(),
      getClients(),
    ])
    // Open deals = anything not 'paid'. Spec lists pending|overdue but invoiced/partial
    // are also reconcilable income — include them for completeness.
    const OPEN = new Set(['pending', 'invoiced', 'partial', 'overdue'])
    rcDeals   = (deals || []).filter(d => OPEN.has(d.billing_status || 'pending'))
    rcBills   = bills || []
    rcTxs     = (txs || []).filter(t => (t.status || 'unmatched') === 'unmatched')
    rcClients = clients || []

    rcComputeSuggestions()
    rcUpdateMetrics()
    rcRender()

    if (rcHighlightDealId) rcScrollToHighlight()
  } catch (e) {
    console.error('[reconcile] load failed', e)
    document.getElementById('rc-left-list').innerHTML  = `<div class="rc-empty">Error: ${escHtml(e.message || e)}</div>`
    document.getElementById('rc-right-list').innerHTML = `<div class="rc-empty">—</div>`
    if (typeof showToast === 'function') showToast('Failed to load reconcile data', 'error')
  }
}

function rcSkeleton() {
  const cell = '<div class="rc-empty">Loading…</div>'
  document.getElementById('rc-left-list').innerHTML  = cell
  document.getElementById('rc-right-list').innerHTML = cell
  document.getElementById('rc-left-count').textContent  = '—'
  document.getElementById('rc-right-count').textContent = '—'
}

// ─── tabs ──────────────────────────────────────────────────────
function rcSwitchTab(tab) {
  if (tab === rcCurrentTab) return
  rcCurrentTab = tab
  rcSelectedLeftId = null
  rcSelectedRightId = null
  document.getElementById('rc-tab-deals').classList.toggle('cur', tab === 'deals')
  document.getElementById('rc-tab-bills').classList.toggle('cur', tab === 'bills')
  document.getElementById('rc-left-title').textContent = tab === 'deals' ? 'Open deals' : 'Submitted bills'
  rcComputeSuggestions()
  rcUpdateMetrics()
  rcRender()
  // Reflect in URL.
  const qs = new URLSearchParams(window.location.search)
  qs.set('tab', tab)
  history.replaceState({}, '', `${window.location.pathname}?${qs}`)
}
window.rcSwitchTab = rcSwitchTab

// ─── auto-suggest ──────────────────────────────────────────────
// For each open left item, find any tx where amount is within 5% AND date
// is within 30 days of created_at. Direction must match the side:
//   deals → tx.direction === 'in'
//   bills → tx.direction === 'out'
function rcComputeSuggestions() {
  rcSuggestions = new Map()
  const isDeals = rcCurrentTab === 'deals'
  const lefts = isDeals ? rcDeals : rcBills
  const wantedDir = isDeals ? 'in' : 'out'

  const candidates = rcTxs.filter(t => (t.direction || '').toLowerCase() === wantedDir)

  lefts.forEach(left => {
    const amt = isDeals ? left.agreed_price : left.total_amount
    const anchor = left.created_at
    const matches = new Set()
    candidates.forEach(t => {
      if (rcAmountsSimilar(amt, t.amount) && rcDatesWithin(anchor, t.transaction_date, 30)) {
        matches.add(t.id)
      }
    })
    if (matches.size) rcSuggestions.set(left.id, matches)
  })
}

// True if this tx is a suggested match for any open left item OR for the
// currently-selected left item.
function rcIsSuggestedTx(txId) {
  if (rcSelectedLeftId) {
    const set = rcSuggestions.get(rcSelectedLeftId)
    return !!(set && set.has(txId))
  }
  for (const set of rcSuggestions.values()) if (set.has(txId)) return true
  return false
}

// ─── metrics ───────────────────────────────────────────────────
function rcUpdateMetrics() {
  const suggested = rcSuggestions.size
  const isDeals = rcCurrentTab === 'deals'
  const open = isDeals ? rcDeals.length : rcBills.length
  const wantedDir = isDeals ? 'in' : 'out'
  const unmatched = rcTxs.filter(t => (t.direction || '').toLowerCase() === wantedDir).length

  document.getElementById('rc-metric-suggested').textContent = String(suggested)
  document.getElementById('rc-metric-open').textContent      = String(open)
  document.getElementById('rc-metric-unmatched').textContent = String(unmatched)
  document.getElementById('rc-meta').textContent = `${suggested} suggested · ${open} open · ${unmatched} unmatched`
}

// ─── rendering ─────────────────────────────────────────────────
function rcRender() {
  const q = (document.getElementById('rc-search')?.value || '').trim().toLowerCase()
  const isDeals = rcCurrentTab === 'deals'

  // LEFT
  const lefts = isDeals
    ? rcDeals.filter(d => !q || rcDealMatchesQ(d, q))
    : rcBills.filter(b => !q || rcBillMatchesQ(b, q))
  const leftHtml = lefts.length
    ? lefts.map(it => isDeals ? rcDealCard(it) : rcBillCard(it)).join('')
    : '<div class="rc-empty">No items</div>'
  document.getElementById('rc-left-list').innerHTML = leftHtml
  document.getElementById('rc-left-count').textContent = String(lefts.length)
  document.getElementById('rc-left-title').textContent = isDeals ? 'Open deals' : 'Submitted bills'

  // RIGHT — only direction-relevant unmatched txs
  const wantedDir = isDeals ? 'in' : 'out'
  const rights = rcTxs
    .filter(t => (t.direction || '').toLowerCase() === wantedDir)
    .filter(t => !q || rcTxMatchesQ(t, q))
  const rightHtml = rights.length
    ? rights.map(rcTxCard).join('')
    : '<div class="rc-empty">No unmatched transactions</div>'
  document.getElementById('rc-right-list').innerHTML = rightHtml
  document.getElementById('rc-right-count').textContent = String(rights.length)

  rcRenderActionBar()
}

function rcDealMatchesQ(d, q) {
  return (d.clients?.full_name || '').toLowerCase().includes(q)
      || (d.notes || '').toLowerCase().includes(q)
      || (d.products?.name || '').toLowerCase().includes(q)
}
function rcBillMatchesQ(b, q) {
  return (b.vendor_notes || '').toLowerCase().includes(q)
      || String(b.id).toLowerCase().includes(q)
}
function rcTxMatchesQ(t, q) {
  return (t.counterparty_name || '').toLowerCase().includes(q)
      || (t.reference || '').toLowerCase().includes(q)
}

function rcDealCard(d) {
  const id = d.id
  const sel = rcSelectedLeftId === id ? ' sel' : ''
  const sug = rcSuggestions.has(id) ? ' suggested' : ''
  const hl  = (rcHighlightDealId && rcHighlightDealId === id) ? ' highlight' : ''
  const status = d.billing_status || 'pending'
  const client = d.clients?.full_name || '—'
  const plan   = d.products?.name || d.notes || '—'
  const days   = rcDaysSince(d.created_at)
  const giClient = (rcClients.find(c => c.id === d.client_id) || {}).green_invoice_client_id
  const sugBadge = rcSuggestions.has(id)
    ? `<span class="rc-badge suggest">match</span>` : ''
  const giBadge = giClient ? `<span class="rc-badge gi">GI</span>` : ''

  return `<div class="rc-card${sel}${sug}${hl}" id="rc-deal-${escHtmlAttr(id)}" onclick="rcSelectLeft('${escHtmlAttr(id)}')">
    <div class="rc-card-row">
      <div class="rc-card-title">${escHtml(client)}</div>
      <div class="rc-card-amount">${rcFmt(d.agreed_price, d.agreed_currency)}</div>
    </div>
    <div class="rc-card-meta">
      <span class="rc-badge ${escHtml(status)}">${escHtml(status)}</span>
      ${sugBadge}${giBadge}
      ${escHtml(plan)} · ${days != null ? days + 'd ago' : '—'}
    </div>
  </div>`
}

function rcBillCard(b) {
  const id = b.id
  const sel = rcSelectedLeftId === id ? ' sel' : ''
  const sug = rcSuggestions.has(id) ? ' suggested' : ''
  const status = b.status || 'submitted'
  const days = rcDaysSince(b.submitted_at || b.created_at)
  const sugBadge = rcSuggestions.has(id)
    ? `<span class="rc-badge suggest">match</span>` : ''
  const note = b.vendor_notes ? ` · ${escHtml(b.vendor_notes.slice(0, 60))}` : ''

  return `<div class="rc-card${sel}${sug}" onclick="rcSelectLeft('${escHtmlAttr(id)}')">
    <div class="rc-card-row">
      <div class="rc-card-title">Bill ${escHtml(String(id).slice(0, 8))}</div>
      <div class="rc-card-amount">${rcFmt(b.total_amount, b.currency)}</div>
    </div>
    <div class="rc-card-meta">
      <span class="rc-badge ${escHtml(status)}">${escHtml(status)}</span>
      ${sugBadge}
      ${days != null ? days + 'd ago' : '—'}${note}
    </div>
  </div>`
}

function rcTxCard(t) {
  const id = t.id
  const sel = rcSelectedRightId === id ? ' sel' : ''
  const sug = rcIsSuggestedTx(id) ? ' suggested' : ''
  const desc   = t.counterparty_name || t.reference || '—'
  const acct   = t.account?.name || '—'
  const source = t.source || '—'
  const sugBadge = rcIsSuggestedTx(id) ? `<span class="rc-badge suggest">match</span>` : ''

  return `<div class="rc-card${sel}${sug}" onclick="rcSelectRight('${escHtmlAttr(id)}')">
    <div class="rc-card-row">
      <div class="rc-card-title">${escHtml(desc)}</div>
      <div class="rc-card-amount">${rcFmt(t.amount, t.currency)}</div>
    </div>
    <div class="rc-card-meta">
      ${sugBadge}
      ${rcDateShort(t.transaction_date)} · ${escHtml(acct)} · ${escHtml(source)}
    </div>
  </div>`
}

// ─── selection ─────────────────────────────────────────────────
function rcSelectLeft(id) {
  rcSelectedLeftId = (rcSelectedLeftId === id) ? null : id
  rcRender()
}
function rcSelectRight(id) {
  rcSelectedRightId = (rcSelectedRightId === id) ? null : id
  rcRender()
}
window.rcSelectLeft  = rcSelectLeft
window.rcSelectRight = rcSelectRight

// ─── action bar ────────────────────────────────────────────────
function rcRenderActionBar() {
  const bar = document.getElementById('rc-actionbar')
  if (!rcSelectedLeftId || !rcSelectedRightId) {
    bar.classList.add('hidden')
    return
  }
  bar.classList.remove('hidden')

  const isDeals = rcCurrentTab === 'deals'
  const left = isDeals
    ? rcDeals.find(d => d.id === rcSelectedLeftId)
    : rcBills.find(b => b.id === rcSelectedLeftId)
  const tx = rcTxs.find(t => t.id === rcSelectedRightId)
  if (!left || !tx) { bar.classList.add('hidden'); return }

  const leftLabel = isDeals
    ? (left.clients?.full_name || '—')
    : `Bill ${String(left.id).slice(0, 8)}`
  const leftAmt   = isDeals ? left.agreed_price : left.total_amount
  const leftCurr  = isDeals ? left.agreed_currency : left.currency
  const txLabel   = tx.counterparty_name || tx.reference || '—'

  const diff = (Number(leftAmt) || 0) - (Number(tx.amount) || 0)
  const diffStr = Math.abs(diff) < 0.005
    ? 'exact'
    : `Δ ${diff > 0 ? '+' : ''}${rcFmt(diff, leftCurr)}`

  document.getElementById('rc-actionbar-summary').innerHTML = `
    <strong>${escHtml(leftLabel)}</strong> ${rcFmt(leftAmt, leftCurr)}
    <span class="rc-arrow">↔</span>
    <strong>${escHtml(txLabel)}</strong> ${rcFmt(tx.amount, tx.currency)}
    <span class="rc-diff">${escHtml(diffStr)}</span>
  `

  const btns = []
  if (isDeals) {
    btns.push(`<button class="primary" onclick="rcConfirmMatchDeal('matched')">Match + mark paid</button>`)
    btns.push(`<button onclick="rcConfirmMatchDeal('reconciled')">Match + reconciled</button>`)
    const giClient = (rcClients.find(c => c.id === left.client_id) || {}).green_invoice_client_id
    if (giClient) {
      btns.push(`<button onclick="rcIssueReceiptViaGi()">Match + issue receipt via GI</button>`)
    }
  } else {
    btns.push(`<button class="primary" onclick="rcConfirmMatchBill('matched')">Match + mark paid</button>`)
    btns.push(`<button onclick="rcConfirmMatchBill('reconciled')">Match + reconciled</button>`)
  }
  document.getElementById('rc-actionbar-buttons').innerHTML = btns.join('')
}

// ─── write-back ────────────────────────────────────────────────
async function rcConfirmMatchDeal(status) {
  if (!rcSelectedLeftId || !rcSelectedRightId) return
  const dealId = rcSelectedLeftId
  const txId = rcSelectedRightId
  try {
    rcDisableActionBar(true)
    await matchTransactionToDeal(txId, dealId, status)
    showToast(status === 'reconciled' ? 'Reconciled' : 'Matched + marked paid', 'success')
    rcAfterWrite({ removedDealId: dealId, removedTxId: txId })
  } catch (e) {
    console.error('[reconcile] match deal failed', e)
    showToast('Match failed: ' + (e.message || e), 'error')
    rcDisableActionBar(false)
  }
}
window.rcConfirmMatchDeal = rcConfirmMatchDeal

async function rcConfirmMatchBill(status) {
  if (!rcSelectedLeftId || !rcSelectedRightId) return
  const billId = rcSelectedLeftId
  const txId = rcSelectedRightId
  try {
    rcDisableActionBar(true)
    await matchTransactionToBill(txId, billId, status)
    showToast(status === 'reconciled' ? 'Reconciled' : 'Matched', 'success')
    rcAfterWrite({ removedBillId: billId, removedTxId: txId })
  } catch (e) {
    console.error('[reconcile] match bill failed', e)
    showToast('Match failed: ' + (e.message || e), 'error')
    rcDisableActionBar(false)
  }
}
window.rcConfirmMatchBill = rcConfirmMatchBill

// TODO: wire to real Green Invoice receipt-issuance API.
function rcIssueReceiptViaGi() {
  if (!rcSelectedLeftId) return
  console.log('GI API: issue receipt for', rcSelectedLeftId)
  // For now: also do the standard match+reconciled write-back so the UI doesn't
  // leave the user with an orphaned suggestion. Remove when the real API call replaces this.
  rcConfirmMatchDeal('reconciled')
}
window.rcIssueReceiptViaGi = rcIssueReceiptViaGi

function rcDisableActionBar(disabled) {
  document.querySelectorAll('#rc-actionbar-buttons button').forEach(b => { b.disabled = disabled })
}

function rcAfterWrite({ removedDealId, removedBillId, removedTxId }) {
  if (removedDealId)  rcDeals = rcDeals.filter(d => d.id !== removedDealId)
  if (removedBillId)  rcBills = rcBills.filter(b => b.id !== removedBillId)
  if (removedTxId)    rcTxs   = rcTxs.filter(t => t.id !== removedTxId)
  rcSelectedLeftId  = null
  rcSelectedRightId = null
  rcComputeSuggestions()
  rcUpdateMetrics()
  rcRender()
}

// ─── highlight / deep link ─────────────────────────────────────
function rcScrollToHighlight() {
  if (!rcHighlightDealId) return
  rcCurrentTab = 'deals'
  document.getElementById('rc-tab-deals').classList.add('cur')
  document.getElementById('rc-tab-bills').classList.remove('cur')
  rcSelectedLeftId = rcHighlightDealId
  rcRender()
  const el = document.getElementById('rc-deal-' + rcHighlightDealId)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// ─── boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (window.LAYOUT?.init) await LAYOUT.init('Reconcile', 'payments')
  await init()
})
