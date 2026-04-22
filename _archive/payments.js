// payments.js — HSos Payments (Manager view)
// Vendor bill review and approval — connected to Supabase via db.js

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

let currentTab       = 'vendor-bills'
let vendorSummaries  = []
let selectedVendorId = null
let vendorDetail     = null
let selectedDraftIds = new Set()
let mgrTaskTypes     = []   // loaded once for edit modals

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function fmt(n)      { return '$' + Number(n || 0).toFixed(2) }
function fmtHours(h) { return h === 1 ? '1h' : (h || 0) + 'h' }

function formatDateShort(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function sessionAmount(s) { return (s.hours || 0) * (s.rate_usd || 0) }

function vendorTypeLabel(t) {
  return { coach: 'Coach', contractor: 'Contractor', team_member: 'Team Member' }[t] || (t || '—')
}

function billAmount(bill) {
  if (!bill) return 0
  return bill.total_amount || (bill.sessions || []).reduce((sum, s) => sum + sessionAmount(s), 0)
}

function unbilledTotal(sessions) {
  return (sessions || []).reduce((sum, s) => sum + sessionAmount(s), 0)
}

function noteCell(notes) {
  if (!notes) return `<span style="color:var(--mu2)">—</span>`
  const safe = notes.replace(/"/g, '&quot;')
  return `<span style="font-size:11px;color:var(--mu);max-width:130px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${safe}">${notes}</span>`
}

// ═══════════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════════

function switchTab(tab) {
  currentTab = tab
  document.querySelectorAll('.tb-nav a').forEach(a => a.classList.remove('cur'))
  document.getElementById('nav-' + tab)?.classList.add('cur')
  if (tab === 'vendor-bills') {
    document.getElementById('tab-vendor-bills').classList.remove('hidden')
    document.getElementById('tab-history').classList.add('hidden')
    renderVendorBillsTab()
  } else {
    document.getElementById('tab-vendor-bills').classList.add('hidden')
    document.getElementById('tab-history').classList.remove('hidden')
    renderHistoryTab()
  }
}
window.switchTab = switchTab

// ═══════════════════════════════════════════════════════════════
// VENDOR BILLS TAB — LIST VIEW
// ═══════════════════════════════════════════════════════════════

function renderVendorBillsTab() { renderVendorList() }

function renderVendorList() {
  const needsReview = []
  const noBill      = []
  const readyToPay  = []

  vendorSummaries.forEach(({ vendor, bill, unbilled }) => {
    if (bill && ['draft', 'submitted'].includes(bill.status)) {
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
    const when = bill.submitted_at
      ? `Submitted ${formatDateShort(bill.submitted_at)}`
      : `Created ${formatDateShort(bill.created_at)}`
    return renderVendorCard(vendor, { label: 'Draft Bill', amount: fmt(billAmount(bill)), meta: `${n} sessions · ${when}`, color: 'amber' })
  }).join('')

  document.getElementById('nobill-list').innerHTML = noBill.map(({ vendor, unbilled }) =>
    renderVendorCard(vendor, {
      label: 'No bill yet',
      amount: fmt(unbilledTotal(unbilled)),
      meta: `${unbilled.length} sessions · No draft submitted`,
      color: 'gray',
    })
  ).join('')

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
  selectedVendorId = vendorId
  selectedDraftIds.clear()
  const summary = vendorSummaries.find(x => x.vendor.id === vendorId)
  if (!summary) return

  document.getElementById('vendor-list-view').classList.add('hidden')
  document.getElementById('vendor-detail-view').classList.remove('hidden')
  document.getElementById('vendor-detail-name').textContent  = summary.vendor.full_name
  document.getElementById('vendor-detail-email').textContent = summary.vendor.email || ''
  document.getElementById('draft-bill-section').style.display  = 'none'
  document.getElementById('unbilled-section').style.display    = 'none'

  try {
    vendorDetail = await getVendorDetailForManager(vendorId)
    renderVendorDetail()
  } catch (err) {
    console.error(err)
    showToast('Failed to load vendor detail', 'warn')
  }
}
window.openVendorDetail = openVendorDetail
window.selectVendor     = openVendorDetail

function renderVendorDetail() {
  if (!vendorDetail) return
  const { draftBill, unbilledSessions, history } = vendorDetail

  // Draft bill
  if (draftBill) {
    document.getElementById('draft-bill-section').style.display = 'block'
    const sessions = draftBill.sessions || []
    selectedDraftIds.clear()
    sessions.forEach(s => selectedDraftIds.add(s.id))
    document.getElementById('draft-total').textContent = fmt(billAmount(draftBill))
    const when = draftBill.submitted_at
      ? `Submitted ${formatDateShort(draftBill.submitted_at)}`
      : `Created ${formatDateShort(draftBill.created_at)}`
    document.getElementById('draft-meta').textContent = `${sessions.length} sessions · ${when}`
    renderDraftSessions(sessions)
  } else {
    document.getElementById('draft-bill-section').style.display = 'none'
  }

  // Unbilled
  if (unbilledSessions.length > 0) {
    document.getElementById('unbilled-section').style.display = 'block'
    document.getElementById('unbilled-sessions').innerHTML = unbilledSessions.map(s => `
      <tr>
        <td>${formatDateShort(s.session_date)}</td>
        <td>${s.client_name || '—'}</td>
        <td style="font-size:12px">${s.task_type_name || '—'}</td>
        <td class="mono">${fmtHours(s.hours)}</td>
        <td style="text-align:right" class="mono">${fmt(sessionAmount(s))}</td>
        <td>${noteCell(s.notes)}</td>
        <td style="text-align:center">
          <button class="btn btn-sm btn-ghost" style="padding:2px 6px" onclick="openMgrEditModal('${s.id}')">✎</button>
        </td>
      </tr>`).join('')
  } else {
    document.getElementById('unbilled-section').style.display = 'none'
  }

  // History
  const histDiv = document.getElementById('vendor-history')
  if (!history.length) {
    histDiv.innerHTML = '<div style="font-size:12px;color:var(--mu2)">No payment history yet</div>'
  } else {
    histDiv.innerHTML = history.map(bill => `
      <div class="block" style="margin-bottom:12px">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border2);display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--green-text)">
              ${bill.status === 'paid' ? '✅ Paid ' + formatDateShort(bill.paid_at) : '✅ Approved'}
            </div>
            <div style="font-size:11px;color:var(--mu);margin-top:2px">${(bill.sessions||[]).length} sessions</div>
          </div>
          <div style="font-family:var(--font-mono);font-size:16px;font-weight:600;color:var(--green-text)">${fmt(billAmount(bill))}</div>
        </div>
      </div>`).join('')
  }
}

function renderDraftSessions(sessions) {
  document.getElementById('draft-sessions').innerHTML = sessions.map(s => {
    const checked = selectedDraftIds.has(s.id) ? 'checked' : ''
    return `
      <tr>
        <td><input type="checkbox" ${checked} onchange="toggleDraftSession('${s.id}')"></td>
        <td>${formatDateShort(s.session_date)}</td>
        <td>${s.client_name || '—'}</td>
        <td style="font-size:12px">${s.task_type_name || '—'}</td>
        <td class="mono">${fmtHours(s.hours)}</td>
        <td style="text-align:right" class="mono">${fmt(sessionAmount(s))}</td>
        <td>${noteCell(s.notes)}</td>
        <td style="text-align:center">
          <button class="btn btn-sm btn-ghost" style="padding:2px 6px" onclick="openMgrEditModal('${s.id}')">✎</button>
        </td>
      </tr>`
  }).join('')

  const selectedTotal = sessions
    .filter(s => selectedDraftIds.has(s.id))
    .reduce((sum, s) => sum + sessionAmount(s), 0)
  document.getElementById('draft-total').textContent = fmt(selectedTotal)
}

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

function rejectBill() { document.getElementById('reject-modal').classList.add('open') }
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
  } catch (err) { showToast('Failed to update', 'warn') }
}
window.markPaid = markPaid

function backToVendorList() {
  selectedVendorId = null
  selectedDraftIds.clear()
  vendorDetail = null
  document.getElementById('vendor-list-view').classList.remove('hidden')
  document.getElementById('vendor-detail-view').classList.add('hidden')
  renderVendorList()
}
window.backToVendorList = backToVendorList

// ═══════════════════════════════════════════════════════════════
// MANAGER EDIT SESSION MODAL
// ═══════════════════════════════════════════════════════════════

function _findSessionAnywhere(sessionId) {
  if (!vendorDetail) return null
  const inDraft    = (vendorDetail.draftBill?.sessions || []).find(s => s.id === sessionId)
  const inUnbilled = vendorDetail.unbilledSessions.find(s => s.id === sessionId)
  return inDraft || inUnbilled || null
}

function openMgrEditModal(sessionId) {
  const s = _findSessionAnywhere(sessionId)
  if (!s) return

  const sel = document.getElementById('mgr-edit-task-type')
  sel.innerHTML = '<option value="">— Select —</option>' +
    mgrTaskTypes.map(t => `<option value="${t.id}"${t.id === s.task_type_id ? ' selected' : ''}>${t.name}</option>`).join('')

  document.getElementById('mgr-edit-session-id').value    = sessionId
  document.getElementById('mgr-edit-date').value          = s.session_date || ''
  document.getElementById('mgr-edit-duration').value      = String(s.hours || 1)
  document.getElementById('mgr-edit-notes').value         = s.notes || ''
  document.getElementById('mgr-edit-vendor-label').textContent =
    document.getElementById('vendor-detail-name').textContent
  document.getElementById('mgr-edit-modal').classList.add('open')
}
window.openMgrEditModal = openMgrEditModal

function closeMgrEditModal() {
  document.getElementById('mgr-edit-modal').classList.remove('open')
}
window.closeMgrEditModal = closeMgrEditModal

function onMgrEditTaskTypeChange() {}
window.onMgrEditTaskTypeChange = onMgrEditTaskTypeChange

async function saveMgrEditSession() {
  const id          = document.getElementById('mgr-edit-session-id').value
  const taskTypeId  = document.getElementById('mgr-edit-task-type').value
  const hours       = parseFloat(document.getElementById('mgr-edit-duration').value)
  const sessionDate = document.getElementById('mgr-edit-date').value
  const notes       = document.getElementById('mgr-edit-notes').value
  if (!taskTypeId) { showToast('Select a task type', 'warn'); return }

  const rateUsd = mgrTaskTypes.find(t => t.id === taskTypeId)?.rate_usd || 0
  const saveBtn = document.querySelector('#mgr-edit-modal .btn-primary')
  saveBtn.disabled = true; saveBtn.textContent = 'Saving…'
  try {
    await updateSessionV2(id, { sessionDate, hours, taskTypeId, rateUsd, notes })
    closeMgrEditModal()
    vendorDetail = await getVendorDetailForManager(selectedVendorId)
    renderVendorDetail()
    showToast('Session updated')
  } catch (err) {
    console.error(err)
    showToast(err.message || 'Failed to save', 'warn')
  } finally {
    saveBtn.disabled = false; saveBtn.textContent = 'Save'
  }
}
window.saveMgrEditSession = saveMgrEditSession

// ═══════════════════════════════════════════════════════════════
// HISTORY TAB — monthly dashboard + collapsible bills
// ═══════════════════════════════════════════════════════════════

async function renderHistoryTab() {
  const dashDiv = document.getElementById('history-dashboard')
  const listDiv = document.getElementById('all-history')
  dashDiv.innerHTML = ''
  listDiv.innerHTML = '<div style="color:var(--mu2);font-size:12px;padding:8px 0">Loading…</div>'

  try {
    const bills = await getPaidBillsAllVendors()

    if (!bills.length) {
      listDiv.innerHTML = '<div style="color:var(--mu2);font-size:12px;padding:8px 0">No paid bills yet</div>'
      return
    }

    // ── Monthly dashboard ─────────────────────────────────────
    // Group by YYYY-MM
    const byMonth = {}
    bills.forEach(bill => {
      const ym = (bill.paid_at || bill.created_at || '').slice(0, 7)
      if (!byMonth[ym]) byMonth[ym] = { total: 0, count: 0 }
      byMonth[ym].total += Number(bill.total_amount || 0)
      byMonth[ym].count++
    })
    const months = Object.keys(byMonth).sort().reverse()
    const maxTotal = Math.max(...months.map(m => byMonth[m].total))

    dashDiv.innerHTML = `
      <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:16px;margin-bottom:4px">
        ${months.map(ym => {
          const d      = byMonth[ym]
          const label  = new Date(ym + '-02').toLocaleDateString('en', { month: 'short', year: '2-digit' })
          const barPct = maxTotal > 0 ? Math.max(6, Math.round(d.total / maxTotal * 64)) : 6
          return `
            <div class="hist-month-card" onclick="filterHistoryMonth('${ym}')" id="hmc-${ym}"
                 style="flex-shrink:0;width:72px;padding:10px 8px;border-radius:var(--r-lg);border:1px solid var(--border);background:var(--surface);cursor:pointer;text-align:center;transition:all .1s">
              <div style="font-size:10px;font-family:var(--font-mono);color:var(--mu2);margin-bottom:6px">${label}</div>
              <div style="height:${barPct}px;background:var(--blue);border-radius:2px;margin-bottom:6px;min-height:4px"></div>
              <div style="font-size:11px;font-weight:600;color:var(--ink);font-family:var(--font-mono)">${fmt(d.total)}</div>
              <div style="font-size:9px;color:var(--mu2);margin-top:2px">${d.count} bill${d.count === 1 ? '' : 's'}</div>
            </div>`
        }).join('')}
      </div>`

    // ── Bills list (collapsible) ───────────────────────────────
    window._historyBills  = bills
    window._historyFilter = null
    renderHistoryList(bills)

  } catch (err) {
    console.error(err)
    listDiv.innerHTML = '<div style="color:var(--red-text);font-size:12px;padding:8px 0">Failed to load history</div>'
  }
}

function filterHistoryMonth(ym) {
  // Toggle: click same month again to clear filter
  if (window._historyFilter === ym) {
    window._historyFilter = null
    document.querySelectorAll('.hist-month-card').forEach(el => {
      el.style.background = 'var(--surface)'
      el.style.borderColor = 'var(--border)'
    })
    renderHistoryList(window._historyBills || [])
    return
  }
  window._historyFilter = ym
  document.querySelectorAll('.hist-month-card').forEach(el => {
    const isActive = el.id === `hmc-${ym}`
    el.style.background   = isActive ? 'var(--blue-bg)'    : 'var(--surface)'
    el.style.borderColor  = isActive ? 'var(--blue-text)'  : 'var(--border)'
  })
  const filtered = (window._historyBills || []).filter(b =>
    (b.paid_at || b.created_at || '').startsWith(ym)
  )
  renderHistoryList(filtered)
}
window.filterHistoryMonth = filterHistoryMonth

function renderHistoryList(bills) {
  const div = document.getElementById('all-history')
  if (!bills.length) {
    div.innerHTML = '<div style="color:var(--mu2);font-size:12px;padding:8px 0">No bills for this period</div>'
    return
  }
  div.innerHTML = bills.map((bill, i) => {
    const sessions = bill.sessions || []
    const uid = 'hb-' + i
    return `
      <div class="block" style="margin-bottom:12px">
        <!-- Collapsible header -->
        <div style="padding:14px 16px;cursor:pointer;display:flex;align-items:center;justify-content:space-between"
             onclick="toggleHistoryBill('${uid}')">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
              <div style="font-size:14px;font-weight:600;color:var(--ink)">${bill.vendor_name || '—'}</div>
            </div>
            <div style="font-size:11px;color:var(--green-text)">✅ Paid ${formatDateShort(bill.paid_at)}</div>
            <div style="font-size:10px;color:var(--mu);margin-top:2px">${sessions.length} session${sessions.length === 1 ? '' : 's'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--green-text)">${fmt(bill.total_amount)}</div>
            <span id="${uid}-chevron" style="color:var(--mu2);font-size:12px;transition:transform .15s">▼</span>
          </div>
        </div>
        <!-- Collapsible body (hidden by default) -->
        <div id="${uid}-body" style="display:none;border-top:1px solid var(--border2)">
          <table class="tbl">
            <thead><tr><th>Date</th><th>Client</th><th>Task type</th><th>Hours</th><th style="text-align:right">Amount</th><th>Notes</th></tr></thead>
            <tbody>
              ${sessions.map(s => `
                <tr>
                  <td>${formatDateShort(s.session_date)}</td>
                  <td>${s.client_name || '—'}</td>
                  <td style="font-size:12px">${s.task_type_name || '—'}</td>
                  <td class="mono">${fmtHours(s.hours)}</td>
                  <td style="text-align:right" class="mono">${fmt(sessionAmount(s))}</td>
                  <td>${noteCell(s.notes)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`
  }).join('')
}

function toggleHistoryBill(uid) {
  const body    = document.getElementById(uid + '-body')
  const chevron = document.getElementById(uid + '-chevron')
  const open    = body.style.display === 'none'
  body.style.display    = open ? 'block' : 'none'
  chevron.style.transform = open ? 'rotate(180deg)' : ''
}
window.toggleHistoryBill = toggleHistoryBill

// ═══════════════════════════════════════════════════════════════
// MODULE DROPDOWN
// ═══════════════════════════════════════════════════════════════

function toggleModDD() { document.getElementById('mod-dd').classList.toggle('open') }
window.toggleModDD = toggleModDD
document.addEventListener('click', e => {
  if (!e.target.closest('.mod-wrap')) document.getElementById('mod-dd')?.classList.remove('open')
})

// ── db.js globals referenced here (defined in db.js, loaded before this file) ──
/* global approveBillV2, rejectBillV2, markBillPaidV2, getVendorBillsForManager,
          getVendorDetailForManager, getPaidBillsAllVendors, updateSessionV2,
          getTaskTypes, showToast, DEMO */

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
  try {
    ;[vendorSummaries, mgrTaskTypes] = await Promise.all([
      getVendorBillsForManager(),
      getTaskTypes(null),
    ])
  } catch (err) {
    console.error('[HSos] payments init failed:', err)
    showToast('Failed to load data — check console', 'warn')
  }
  switchTab('vendor-bills')
})
