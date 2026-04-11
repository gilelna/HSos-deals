// payments-v2.js — HSos Payments V2 (Manager view)
// Vendor bill review and approval — connected to Supabase via db.js

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

let currentTab         = 'vendor-bills'
let vendorSummaries    = []   // [{ vendor, bill, unbilled }]
let selectedVendorId   = null
let vendorDetail       = null // { draftBill, unbilledSessions, history }
let selectedDraftIds   = new Set()
let selectedUnbilledIds = new Set()   // manager-side unbilled session selection
let _routerDispatching = false
let _routerRegistered  = false

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function fmt(n)       { return '$' + Number(n || 0).toFixed(2) }
function fmtHours(h)  { return h === 1 ? '1h' : (h || 0) + 'h' }

function formatDateShort(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function sessionAmount(s) {
  return (s.hours || 0) * (s.rate_usd || 0)
}

function vendorTypeLabel(t) {
  return { coach: 'Coach', contractor: 'Contractor', team_member: 'Team Member' }[t] || t
}

function billAmount(bill) {
  if (!bill) return 0
  // If total_amount is stored, use it; otherwise sum sessions
  if (bill.total_amount) return bill.total_amount
  return (bill.sessions || []).reduce((sum, s) => sum + sessionAmount(s), 0)
}

function unbilledAmount(sessions) {
  return (sessions || []).reduce((sum, s) => sum + sessionAmount(s), 0)
}

// ═══════════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════════

function switchTab(tab, { pushUrl = true } = {}) {
  if (window.Router && !_routerDispatching) {
    const { entity } = Router.getParams()
    const leavingEntityView = entity === 'vendor' && tab !== 'vendor-bills'
    if (leavingEntityView) Router.close()
  }

  currentTab = tab

  // Update cover
  const tabTitles = { 'vendor-bills': 'Vendor Bills', history: 'History', registry: 'Registry' }
  const titleEl = document.getElementById('cover-title')
  if (titleEl) titleEl.textContent = tabTitles[tab] || tab
  const eyebrowEl = document.getElementById('cover-eyebrow')
  if (eyebrowEl) eyebrowEl.textContent = `Payments · ${window.Role?.get() || 'Finance'}`

  // Update sidebar active link
  document.querySelectorAll('.sb-link').forEach(a => a.classList.remove('cur'))
  document.getElementById('nav-' + tab)?.classList.add('cur')

  if (pushUrl && !_routerDispatching) {
    const qs = new URLSearchParams(window.location.search)
    qs.set('tab', tab)
    qs.delete('entity'); qs.delete('id'); qs.delete('from')
    history.pushState({}, '', `${window.location.pathname}?${qs}`)
  }

  document.querySelectorAll('.tb-nav a').forEach(a => a.classList.remove('cur'))
  document.getElementById('nav-' + tab)?.classList.add('cur')

  const allTabs = ['tab-vendor-bills', 'tab-history', 'tab-registry']
  allTabs.forEach(id => document.getElementById(id)?.classList.add('hidden'))

  if (tab === 'vendor-bills') {
    document.getElementById('tab-vendor-bills').classList.remove('hidden')
    renderVendorBillsTab()
  } else if (tab === 'registry') {
    document.getElementById('tab-registry').classList.remove('hidden')
    window.Registry?.load()
  } else {
    document.getElementById('tab-history').classList.remove('hidden')
    renderHistoryTab()
  }
}
window.switchTab = switchTab

function runWithRouterDispatch(fn) {
  _routerDispatching = true
  try {
    return fn()
  } finally {
    _routerDispatching = false
  }
}

async function runWithRouterDispatchAsync(fn) {
  _routerDispatching = true
  try {
    return await fn()
  } finally {
    _routerDispatching = false
  }
}

function registerRouterHandlers() {
  if (!window.Router || _routerRegistered) return
  _routerRegistered = true

  Router.register('vendor', ({ id }) => {
    runWithRouterDispatchAsync(async () => {
      switchTab('vendor-bills')
      await openVendorDetail(id)
    })
  })

  document.addEventListener('router:close', () => {
    runWithRouterDispatch(() => {
      backToVendorList()
      closeRejectModal()
    })
  })

  window.addEventListener('popstate', () => {
    const qs = new URLSearchParams(window.location.search)
    if (qs.get('entity')) return  // router handles entity popstate
    const tab = qs.get('tab') || 'vendor-bills'
    runWithRouterDispatch(() => switchTab(tab, { pushUrl: false }))
  })
}

// ═══════════════════════════════════════════════════════════════
// VENDOR BILLS TAB — LIST VIEW
// ═══════════════════════════════════════════════════════════════

function renderVendorBillsTab() {
  renderVendorList()
}

function renderVendorList() {
  const needsReview = []
  const noBill      = []
  const readyToPay  = []

  vendorSummaries.forEach(({ vendor, bill, unbilled }) => {
    if (bill && (bill.status === 'draft' || bill.status === 'submitted')) {
      needsReview.push({ vendor, bill })
    } else if (bill && bill.status === 'approved') {
      readyToPay.push({ vendor, bill })
    } else if (unbilled.length > 0) {
      noBill.push({ vendor, unbilled })
    }
  })

  document.getElementById('review-count').textContent = needsReview.length
  document.getElementById('ready-count').textContent  = readyToPay.length
  document.getElementById('nobill-count').textContent = noBill.length

  document.getElementById('review-list').innerHTML = needsReview.map(({ vendor, bill }) => {
    const n = (bill.sessions || []).length
    const submitted = bill.submitted_at
      ? `Submitted ${formatDateShort(bill.submitted_at)}`
      : `Created ${formatDateShort(bill.created_at)}`
    return renderVendorCard(vendor, {
      label: 'Draft Bill',
      amount: fmt(billAmount(bill)),
      meta: `${n} sessions · ${submitted}`,
      color: 'amber',
    })
  }).join('')

  document.getElementById('nobill-list').innerHTML = noBill.map(({ vendor, unbilled }) => {
    const total = unbilledAmount(unbilled)
    return renderVendorCard(vendor, {
      label: 'No bill yet',
      amount: fmt(total),
      meta: `${unbilled.length} sessions · No draft submitted`,
      color: 'gray',
    })
  }).join('')

  document.getElementById('ready-list').innerHTML = readyToPay.map(({ vendor, bill }) => {
    const n = (bill.sessions || []).length
    return renderVendorCard(vendor, {
      label: 'Approved — Ready to pay',
      amount: fmt(billAmount(bill)),
      meta: `${n} sessions · Approved ${formatDateShort(bill.approved_at)}`,
      color: 'green',
      extraBtn: `<button class="btn btn-sm" style="margin-left:8px;background:var(--green);color:#fff;border-color:var(--green)" onclick="event.stopPropagation();markPaid('${bill.id}')">Mark as Paid</button>`,
    })
  }).join('')
}

function renderVendorCard(vendor, opts) {
  const colors = {
    amber: { bg: 'var(--amber-bg)', text: 'var(--amber-text)' },
    gray:  { bg: 'var(--bg)',       text: 'var(--mu)' },
    green: { bg: 'var(--green-bg)', text: 'var(--green-text)' },
  }
  const c = colors[opts.color] || colors.gray

  return `
    <div class="block" style="margin-bottom:12px;cursor:pointer" onclick="openVendorDetail('${vendor.id}')">
      <div style="padding:14px 16px;display:flex;align-items:center;justify-content:space-between">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <div style="font-size:14px;font-weight:600;color:var(--ink)">${vendor.full_name}</div>
            <span style="font-size:9px;font-family:var(--font-mono);padding:2px 6px;border-radius:10px;background:${c.bg};color:${c.text}">${vendorTypeLabel(vendor.vendor_type)}</span>
          </div>
          <div style="font-size:11px;color:${c.text};margin-bottom:2px">${opts.label}</div>
          <div style="font-size:10px;color:var(--mu)">${opts.meta}</div>
        </div>
        <div style="text-align:right;display:flex;align-items:center">
          <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:${c.text}">${opts.amount}</div>
          ${opts.extraBtn || ''}
        </div>
      </div>
    </div>`
}

// ═══════════════════════════════════════════════════════════════
// VENDOR DETAIL VIEW
// ═══════════════════════════════════════════════════════════════

async function openVendorDetail(vendorId) {
  if (window.Router && !_routerDispatching) {
    Router.open({ entity: 'vendor', id: vendorId, view: 'panel', from: 'list' })
    return
  }

  selectedVendorId = vendorId
  selectedDraftIds.clear()
  selectedUnbilledIds.clear()

  const summary = vendorSummaries.find(x => x.vendor.id === vendorId)
  if (!summary) return

  document.getElementById('vendor-list-view').classList.add('hidden')
  document.getElementById('vendor-detail-view').classList.remove('hidden')
  document.getElementById('vendor-detail-name').textContent  = summary.vendor.full_name
  document.getElementById('vendor-detail-email').textContent = summary.vendor.email || ''

  // Show loading state
  document.getElementById('draft-bill-section').style.display = 'none'
  document.getElementById('unbilled-section').style.display   = 'none'

  try {
    vendorDetail = await getVendorDetailForManager(vendorId)
    renderVendorDetail()
  } catch (err) {
    console.error(err)
    showToast('Failed to load vendor detail', 'warn')
  }
}
window.openVendorDetail = openVendorDetail

// Keep old name for inline onclick compatibility
window.selectVendor = openVendorDetail

function renderVendorDetail() {
  if (!vendorDetail) return
  const { draftBill, unbilledSessions, history } = vendorDetail

  // Draft bill section
  if (draftBill) {
    document.getElementById('draft-bill-section').style.display = 'block'
    const sessions = draftBill.sessions || []
    selectedDraftIds.clear()
    sessions.forEach(s => selectedDraftIds.add(s.id))

    document.getElementById('draft-total').textContent = fmt(billAmount(draftBill))
    const submitted = draftBill.submitted_at
      ? `Submitted ${formatDateShort(draftBill.submitted_at)}`
      : `Created ${formatDateShort(draftBill.created_at)}`
    document.getElementById('draft-meta').textContent = `${sessions.length} sessions · ${submitted}`
    renderDraftSessions(sessions)
  } else {
    document.getElementById('draft-bill-section').style.display = 'none'
  }

  // Unbilled sessions
  if (unbilledSessions.length > 0) {
    document.getElementById('unbilled-section').style.display = 'block'
    selectedUnbilledIds = new Set(unbilledSessions.map(s => s.id))
    renderUnbilledSessions(unbilledSessions, draftBill)
  } else {
    document.getElementById('unbilled-section').style.display = 'none'
  }

  // History
  const histDiv = document.getElementById('vendor-history')
  if (!history.length) {
    histDiv.innerHTML = '<div style="font-size:12px;color:var(--mu2)">No payment history yet</div>'
  } else {
    histDiv.innerHTML = history.map((bill, i) => {
      const label = bill.status === 'approved' ? 'Approved' : 'Paid ' + formatDateShort(bill.paid_at)
      const sessions = bill.sessions || []
      const sessionRows = sessions.map(s => `
        <tr>
          <td>${formatDateShort(s.session_date)}</td>
          <td>${s.client_name || '—'}</td>
          <td style="font-size:12px">${s.task_type_name || '—'}</td>
          <td class="mono">${fmtHours(s.hours)}</td>
          <td style="text-align:right" class="mono">${fmt(sessionAmount(s))}</td>
        </tr>`).join('')
      return `
        <div class="block" style="margin-bottom:12px">
          <div style="padding:14px 16px;display:flex;align-items:center;justify-content:space-between;cursor:pointer"
               onclick="toggleHistoryBill('hist-${i}')">
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--green-text)">✅ ${label}</div>
              <div style="font-size:11px;color:var(--mu);margin-top:2px">${sessions.length} sessions</div>
            </div>
            <div style="display:flex;align-items:center;gap:12px">
              <div style="font-family:var(--font-mono);font-size:16px;font-weight:600;color:var(--green-text)">${fmt(billAmount(bill))}</div>
              <span id="hist-chevron-${i}" style="font-size:11px;color:var(--mu)">▾</span>
            </div>
          </div>
          <div id="hist-${i}" style="display:none;border-top:1px solid var(--border2)">
            <table class="tbl">
              <thead><tr><th>Date</th><th>Client</th><th>Task type</th><th>Hours</th><th style="text-align:right">Amount</th></tr></thead>
              <tbody>${sessionRows || '<tr><td colspan="5" style="color:var(--mu2);text-align:center;padding:12px">No sessions logged</td></tr>'}</tbody>
            </table>
          </div>
        </div>`
    }).join('')
  }
}

function renderDraftSessions(sessions) {
  const tbody = document.getElementById('draft-sessions')
  tbody.innerHTML = sessions.map(s => {
    const checked = selectedDraftIds.has(s.id) ? 'checked' : ''
    return `
      <tr>
        <td><input type="checkbox" ${checked} onchange="toggleDraftSession('${s.id}')"></td>
        <td>${formatDateShort(s.session_date)}</td>
        <td>${s.client_name || '—'}</td>
        <td style="font-size:12px">${s.task_type_name || '—'}</td>
        <td class="mono">${fmtHours(s.hours)}</td>
        <td style="text-align:right" class="mono">${fmt(sessionAmount(s))}</td>
      </tr>`
  }).join('')

  const selectedTotal = sessions
    .filter(s => selectedDraftIds.has(s.id))
    .reduce((sum, s) => sum + sessionAmount(s), 0)
  document.getElementById('draft-total').textContent = fmt(selectedTotal)
}

function toggleHistoryBill(id) {
  const el      = document.getElementById(id)
  const idx     = id.replace('hist-', '')
  const chevron = document.getElementById('hist-chevron-' + idx)
  if (!el) return
  const open = el.style.display === 'none'
  el.style.display = open ? '' : 'none'
  if (chevron) chevron.textContent = open ? '▴' : '▾'
}
window.toggleHistoryBill = toggleHistoryBill

function renderUnbilledSessions(sessions, draftBill) {
  // If vendor already has a draft/submitted bill, just show plain list (no checkboxes)
  const hasDraft = !!draftBill
  const checkCol = document.getElementById('unbilled-check-col')
  if (checkCol) checkCol.style.display = hasDraft ? 'none' : ''
  const tbody = document.getElementById('unbilled-sessions')
  tbody.innerHTML = sessions.map(s => {
    if (hasDraft) {
      return `
        <tr>
          <td>${formatDateShort(s.session_date)}</td>
          <td>${s.client_name || '—'}</td>
          <td style="font-size:12px">${s.task_type_name || '—'}</td>
          <td class="mono">${fmtHours(s.hours)}</td>
          <td style="text-align:right" class="mono">${fmt(sessionAmount(s))}</td>
        </tr>`
    }
    const checked = selectedUnbilledIds.has(s.id) ? 'checked' : ''
    return `
      <tr>
        <td style="width:30px"><input type="checkbox" ${checked} onchange="toggleUnbilledSession('${s.id}')"></td>
        <td>${formatDateShort(s.session_date)}</td>
        <td>${s.client_name || '—'}</td>
        <td style="font-size:12px">${s.task_type_name || '—'}</td>
        <td class="mono">${fmtHours(s.hours)}</td>
        <td style="text-align:right" class="mono">${fmt(sessionAmount(s))}</td>
      </tr>`
  }).join('')

  // Update "Create draft" button total
  const btn = document.getElementById('manager-create-draft-btn')
  if (btn) {
    if (hasDraft) {
      btn.style.display = 'none'
      return
    }
    btn.style.display = ''
    const total = sessions
      .filter(s => selectedUnbilledIds.has(s.id))
      .reduce((sum, s) => sum + sessionAmount(s), 0)
    btn.textContent = `Create Draft Bill — ${fmt(total)}`
    btn.disabled = selectedUnbilledIds.size === 0
  }
}

function toggleUnbilledSession(id) {
  if (selectedUnbilledIds.has(id)) selectedUnbilledIds.delete(id)
  else selectedUnbilledIds.add(id)
  renderUnbilledSessions(vendorDetail?.unbilledSessions || [], vendorDetail?.draftBill || null)
}
window.toggleUnbilledSession = toggleUnbilledSession

async function managerCreateDraftBill() {
  if (!selectedVendorId) return
  if (selectedUnbilledIds.size === 0) { showToast('Select at least one session', 'warn'); return }
  const sessions  = vendorDetail?.unbilledSessions || []
  const selected  = sessions.filter(s => selectedUnbilledIds.has(s.id))
  const total     = selected.reduce((sum, s) => sum + sessionAmount(s), 0)
  if (!confirm(`Create a draft bill of ${fmt(total)} for ${selected.length} session(s)?`)) return
  try {
    await createDraftBillV2({ vendorId: selectedVendorId, sessionIds: Array.from(selectedUnbilledIds), totalAmount: total })
    showToast('Draft bill created')
    vendorDetail = await getVendorDetailForManager(selectedVendorId)
    renderVendorDetail()
    await reloadAll()
  } catch (err) {
    console.error(err)
    showToast(err.message || 'Failed to create bill', 'warn')
  }
}
window.managerCreateDraftBill = managerCreateDraftBill

function toggleDraftSession(id) {
  if (selectedDraftIds.has(id)) selectedDraftIds.delete(id)
  else selectedDraftIds.add(id)
  renderDraftSessions(vendorDetail?.draftBill?.sessions || [])
}
window.toggleDraftSession = toggleDraftSession

function selectAllDraft() {
  const sessions = vendorDetail?.draftBill?.sessions || []
  sessions.forEach(s => selectedDraftIds.add(s.id))
  renderDraftSessions(sessions)
}
window.selectAllDraft = selectAllDraft

function unselectAllDraft() {
  selectedDraftIds.clear()
  renderDraftSessions(vendorDetail?.draftBill?.sessions || [])
}
window.unselectAllDraft = unselectAllDraft

function addMoreSessions() {
  showToast('Use vendor\'s Operations page to log sessions', 'info')
}
window.addMoreSessions = addMoreSessions

async function approveBill() {
  const bill = vendorDetail?.draftBill
  if (!bill) return
  if (selectedDraftIds.size === 0) { showToast('Select at least one session', 'warn'); return }
  if (!confirm('Approve this bill?')) return

  try {
    await approveBillV2(bill.id, Array.from(selectedDraftIds))
    showToast('Bill approved')
    await reloadAll()
    backToVendorList()
  } catch (err) {
    console.error(err)
    showToast(err.message || 'Failed to approve', 'warn')
  }
}
window.approveBill = approveBill

function rejectBill() {
  document.getElementById('reject-modal').classList.add('open')
}
window.rejectBill = rejectBill

function closeRejectModal() {
  document.getElementById('reject-modal').classList.remove('open')
  document.getElementById('reject-notes').value = ''
}
window.closeRejectModal = closeRejectModal

async function confirmReject() {
  const notes = document.getElementById('reject-notes').value.trim()
  if (!notes) { showToast('Please provide rejection notes', 'warn'); return }

  const bill = vendorDetail?.draftBill
  if (!bill) return

  try {
    await rejectBillV2(bill.id, notes)
    showToast('Bill returned to vendor')
    closeRejectModal()
    await reloadAll()
    backToVendorList()
  } catch (err) {
    console.error(err)
    showToast(err.message || 'Failed to reject bill', 'warn')
  }
}
window.confirmReject = confirmReject

async function markPaid(billId) {
  if (!confirm('Mark this bill as paid?')) return
  try {
    await markBillPaidV2(billId)
    showToast('Bill marked as paid')
    await reloadAll()
    renderVendorList()
  } catch (err) {
    showToast('Failed to update', 'warn')
  }
}
window.markPaid = markPaid

function backToVendorList() {
  selectedVendorId = null
  selectedDraftIds.clear()
  vendorDetail = null
  document.getElementById('vendor-list-view').classList.remove('hidden')
  document.getElementById('vendor-detail-view').classList.add('hidden')
  renderVendorList()
  if (window.Router && !_routerDispatching && Router.getParams().entity === 'vendor') {
    Router.close()
  }
}
window.backToVendorList = backToVendorList

// ═══════════════════════════════════════════════════════════════
// HISTORY TAB
// ═══════════════════════════════════════════════════════════════

async function renderHistoryTab() {
  const div = document.getElementById('all-history')
  div.innerHTML = '<div style="color:var(--mu2);font-size:12px;padding:8px">Loading…</div>'
  try {
    const bills = await getPaidBillsAllVendors()
    if (!bills.length) {
      div.innerHTML = '<div style="color:var(--mu2);font-size:12px;padding:8px">No paid bills yet</div>'
      return
    }
    div.innerHTML = bills.map(bill => `
      <div class="block" style="margin-bottom:16px">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border2)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div>
              <div style="font-size:14px;font-weight:600;color:var(--ink)">${bill.vendor_name || '—'}</div>
              <div style="font-size:11px;color:var(--green-text)">✅ Paid ${formatDateShort(bill.paid_at)}</div>
            </div>
            <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--green-text)">${fmt(bill.total_amount)}</div>
          </div>
          <div style="font-size:10px;color:var(--mu)">${(bill.sessions||[]).length} sessions</div>
        </div>
        <table class="tbl">
          <thead><tr><th>Date</th><th>Client</th><th>Task type</th><th>Hours</th><th style="text-align:right">Amount</th></tr></thead>
          <tbody>
            ${(bill.sessions||[]).map(s => `
              <tr>
                <td>${formatDateShort(s.session_date)}</td>
                <td>${s.client_name || '—'}</td>
                <td style="font-size:12px">${s.task_type_name || '—'}</td>
                <td class="mono">${fmtHours(s.hours)}</td>
                <td style="text-align:right" class="mono">${fmt(sessionAmount(s))}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('')
  } catch (err) {
    console.error(err)
    div.innerHTML = '<div style="color:var(--red-text);font-size:12px;padding:8px">Failed to load history</div>'
  }
}

// ═══════════════════════════════════════════════════════════════
// MODULE DROPDOWN
// ═══════════════════════════════════════════════════════════════

function toggleModDD() {
  document.getElementById('mod-dd').classList.toggle('open')
}
window.toggleModDD = toggleModDD

document.addEventListener('click', e => {
  if (!e.target.closest('.mod-wrap')) document.getElementById('mod-dd')?.classList.remove('open')
})

// ═══════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════

async function reloadAll() {
  vendorSummaries = await getVendorBillsForManager()
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  registerRouterHandlers()
  try {
    await reloadAll()
  } catch (err) {
    console.error('[HSos] payments init failed:', err)
    showToast('Failed to load data — check console', 'warn')
  }
  const _initTab = new URLSearchParams(window.location.search).get('tab') || 'vendor-bills'
  switchTab(_initTab, { pushUrl: false })
  if (window.Router) Router.dispatch()
})
