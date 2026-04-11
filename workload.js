// workload-v2.js — HSos Operations V2 (Vendor view)
// Task-based billing — connected to Supabase via db.js

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════


let currentTab       = 'log'
let currentWorkTab   = 'unpaid'
let currentVendor    = null
let taskTypes        = []
let allClients       = []  // vendor's assigned clients
let allSessions      = []  // all vendor sessions (for stats/recent)
let unpaidSessions   = []  // sessions with no bill_id
let draftBill        = null
let rejectedBill     = null
let selectedClientId = null
let selectedUnpaid   = new Set()
let _routerDispatching = false
let _routerRegistered  = false

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function fmt(n) { return '$' + Number(n || 0).toFixed(2) }
function fmtHours(h) { return h === 1 ? '1h' : (h || 0) + 'h' }

function formatDateShort(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function getTaskTypeName(id) {
  return taskTypes.find(t => t.id === id)?.name || '—'
}

function getTaskTypeRate(id) {
  return taskTypes.find(t => t.id === id)?.rate_usd || 0
}

function getClientName(id) {
  return allClients.find(c => c.id === id)?.full_name || '—'
}

function sessionAmount(s) {
  return (s.hours || 0) * (s.rate_usd || getTaskTypeRate(s.task_type_id))
}

// Task types that don't require a client
const _NO_CLIENT_TASKS = ['Office Hour', 'General', 'Team Meeting', 'Training', 'Offline work', 'VideoAsk Feedback']

function isNoClientTaskType(taskTypeId) {
  return _NO_CLIENT_TASKS.includes(getTaskTypeName(taskTypeId))
}

// Sessions locked once the bill is approved or paid
function isSessionLocked(s) {
  if (!s.bill_id) return false
  const status = s._bill_status || ''
  return status === 'approved' || status === 'paid'
}

function escAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function noteCell(notes) {
  if (!notes) return `<span style="color:var(--mu2)">—</span>`
  return `<span style="font-size:11px;color:var(--mu);max-width:140px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(notes)}">${notes}</span>`
}

function billStatusPill(status) {
  const map = {
    done:     { cls: 'draft',   label: 'Unpaid' },
    approved: { cls: 'active',  label: 'Approved' },
    paid:     { cls: 'paid',    label: 'Paid' },
    billed:   { cls: 'partial', label: 'In Review' },
  }
  const s = map[status] || { cls: 'draft', label: status }
  return `<span class="pill ${s.cls}">${s.label}</span>`
}

function sessionDisplayStatus(s) {
  if (s.bill_id) return 'billed'
  return 'done'
}

// ═══════════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════════

function switchTab(tab, { pushUrl = true } = {}) {
  if (window.Router && !_routerDispatching) {
    const { entity } = Router.getParams()
    const leavingEntityView =
      (entity === 'client' && tab !== 'clients') ||
      (entity === 'session' && tab !== 'log' && tab !== 'work')
    if (leavingEntityView) Router.close()
  }

  currentTab = tab

  // Update cover
  const tabTitles = { log: 'Log Session', work: 'My Work', clients: 'My Clients', profile: 'Profile' }
  const titleEl = document.getElementById('cover-title')
  if (titleEl) titleEl.textContent = tabTitles[tab] || tab
  const eyebrowEl = document.getElementById('cover-eyebrow')
  if (eyebrowEl) eyebrowEl.textContent = `Operations · ${window.Role?.get() || 'Vendor'}`

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
  document.getElementById('tab-log').classList.toggle('hidden', tab !== 'log')
  document.getElementById('tab-work').classList.toggle('hidden', tab !== 'work')
  document.getElementById('tab-clients').classList.toggle('hidden', tab !== 'clients')
  document.getElementById('tab-profile').classList.toggle('hidden', tab !== 'profile')
  if (tab === 'log')     renderLogTab()
  if (tab === 'work')    renderWorkTab()
  if (tab === 'clients') renderClientsTab()
  if (tab === 'profile') renderProfileTab()
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

function registerRouterHandlers() {
  if (!window.Router || _routerRegistered) return
  _routerRegistered = true

  Router.register('session', ({ id, from }) => {
    runWithRouterDispatch(() => {
      const targetTab = from === 'work' ? 'work' : 'log'
      switchTab(targetTab)
      openEditModal(id)
    })
  })

  Router.register('client', ({ id }) => {
    runWithRouterDispatch(() => {
      switchTab('clients')
      showClientDetail(id)
    })
  })

  document.addEventListener('router:close', () => {
    runWithRouterDispatch(() => {
      closeEditModal()
      clearClientDetail()
    })
  })

  window.addEventListener('popstate', () => {
    const qs = new URLSearchParams(window.location.search)
    if (qs.get('entity')) return  // router handles entity popstate
    const tab = qs.get('tab') || 'log'
    runWithRouterDispatch(() => switchTab(tab, { pushUrl: false }))
  })
}

function switchWorkTab(tab) {
  currentWorkTab = tab
  document.querySelectorAll('.det-tab').forEach(t => t.classList.remove('cur'))
  document.getElementById('work-tab-unpaid').classList.toggle('cur', tab === 'unpaid')
  document.getElementById('work-tab-history').classList.toggle('cur', tab === 'history')
  document.getElementById('work-unpaid').classList.toggle('hidden', tab !== 'unpaid')
  document.getElementById('work-history').classList.toggle('hidden', tab !== 'history')
}
window.switchWorkTab = switchWorkTab

// ═══════════════════════════════════════════════════════════════
// TAB 1: LOG SESSION
// ═══════════════════════════════════════════════════════════════

function renderLogTab() {
  renderClientPicker()
  renderTaskTypeDropdown()
  renderMonthStats()
  renderRecentSessions()
  document.getElementById('f-date').valueAsDate = new Date()
}

function renderClientPicker() {
  const grid = document.getElementById('client-grid')
  const noneSelected = !selectedClientId
  let html = `
    <div class="client-card${noneSelected ? ' sel' : ''}" onclick="selectClient(null)" style="grid-column:1/-1;border-style:dashed">
      <div class="client-card-name" style="color:var(--mu)">No client</div>
      <div class="client-card-pkg" style="color:var(--mu2)">Internal / general task</div>
    </div>`
  html += allClients.map(c => {
    const sel = selectedClientId === c.id ? ' sel' : ''
    const pkg = c.active_package
    const pkgLabel = pkg
      ? `${pkg.sessions_used}/${pkg.total_sessions} sessions`
      : 'No package'
    return `
      <div class="client-card${sel}" onclick="selectClient('${c.id}')">
        <div class="client-card-name">${c.full_name}</div>
        <div class="client-card-pkg">${pkgLabel}</div>
      </div>`
  }).join('')
  grid.innerHTML = html
}

function selectClient(id) {
  selectedClientId = id
  renderClientPicker()
  updatePackageTracker()
  if (!id) {
    const taskId = document.getElementById('f-task-type').value
    if (taskId && !isNoClientTaskType(taskId)) {
      document.getElementById('f-task-type').value = ''
      document.getElementById('f-rate').value = ''
      document.getElementById('f-subtotal').textContent = '$0.00'
    }
  }
}
window.selectClient = selectClient

function updatePackageTracker() {
  const tracker = document.getElementById('package-tracker')
  const client  = allClients.find(c => c.id === selectedClientId)
  const pkg     = client?.active_package

  if (!pkg) { tracker.style.display = 'none'; return }

  tracker.style.display = 'block'
  document.getElementById('pkg-name').textContent = `${pkg.total_sessions}-Session Package`
  const pct = Math.min(100, (pkg.sessions_used / pkg.total_sessions * 100)).toFixed(0)
  document.getElementById('pkg-bar').style.width = pct + '%'
  document.getElementById('pkg-progress').textContent =
    `${pkg.sessions_used}/${pkg.total_sessions} used · ${pkg.sessions_remaining} remaining`
}

function renderTaskTypeDropdown() {
  const sel = document.getElementById('f-task-type')
  sel.innerHTML = '<option value="">— Select task type —</option>' +
    taskTypes.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
}

function onTaskTypeChange() {
  const id   = document.getElementById('f-task-type').value
  const rate = id ? getTaskTypeRate(id) : 0
  document.getElementById('f-rate').value = rate ? fmt(rate) + '/hour' : ''
  updateSubtotal()
  if (id && isNoClientTaskType(id) && selectedClientId) {
    selectedClientId = null
    renderClientPicker()
    updatePackageTracker()
  }
}
window.onTaskTypeChange = onTaskTypeChange

function updateSubtotal() {
  const id    = document.getElementById('f-task-type').value
  const hours = parseFloat(document.getElementById('f-duration').value) || 0
  const rate  = id ? getTaskTypeRate(id) : 0
  document.getElementById('f-subtotal').textContent = fmt(rate * hours)
}

function renderMonthStats() {
  const ym      = new Date().toISOString().slice(0, 7)
  const month   = allSessions.filter(s => (s.session_date || '').startsWith(ym))
  const hours   = month.reduce((sum, s) => sum + (s.hours || 0), 0)
  const clients = new Set(month.filter(s => s.client_id).map(s => s.client_id)).size

  document.getElementById('month-label').textContent =
    new Date().toLocaleDateString('en', { month: 'long', year: 'numeric' })
  document.getElementById('stat-hours').textContent    = hours
  document.getElementById('stat-sessions').textContent = month.length
  document.getElementById('stat-clients').textContent  = clients
}

function renderRecentSessions() {
  const tbody  = document.getElementById('recent-sessions')
  const recent = allSessions.slice(0, 20)

  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--mu2);padding:24px">No sessions yet</td></tr>`
    return
  }

  tbody.innerHTML = recent.map(s => {
    const canEdit = !isSessionLocked(s)
    const editBtn = canEdit
      ? `<button class="btn btn-sm btn-ghost" style="padding:2px 6px" onclick="openEditModal('${s.id}')">✎</button>`
      : `<span style="display:inline-block;width:26px"></span>`
    return `
      <tr>
        <td>${formatDateShort(s.session_date)}</td>
        <td>${s.client_name || (s.client_id ? getClientName(s.client_id) : '—')}</td>
        <td style="font-size:12px">${s.task_type_name || getTaskTypeName(s.task_type_id)}</td>
        <td class="mono">${fmtHours(s.hours)}</td>
        <td class="mono">${fmt(sessionAmount(s))}</td>
        <td>${noteCell(s.notes)}</td>
        <td>${billStatusPill(sessionDisplayStatus(s))}</td>
        <td style="text-align:center">${editBtn}</td>
      </tr>`
  }).join('')
}

// Form submit
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('session-form')?.addEventListener('submit', async e => {
    e.preventDefault()
    if (!currentVendor) { showToast('No vendor selected', 'warn'); return }
    const taskTypeId = document.getElementById('f-task-type').value
    if (!taskTypeId) { showToast('Please select a task type', 'warn'); return }
    if (!selectedClientId && !isNoClientTaskType(taskTypeId)) {
      showToast('Please select a client for this task type', 'warn'); return
    }

    const rateUsd = getTaskTypeRate(taskTypeId)
    const btn = e.target.querySelector('[type=submit]')
    btn.disabled = true
    btn.textContent = 'Saving…'

    try {
      await logSessionV2({
        vendorId:    currentVendor.id,
        clientId:    selectedClientId,
        sessionDate: document.getElementById('f-date').value,
        startTime:   document.getElementById('f-time').value || null,
        hours:       parseFloat(document.getElementById('f-duration').value),
        taskTypeId,
        rateUsd,
        notes:       document.getElementById('f-notes').value || null,
      })

      // Reset form fields (keep date and client)
      document.getElementById('f-task-type').value = ''
      document.getElementById('f-rate').value = ''
      document.getElementById('f-subtotal').textContent = '$0.00'
      document.getElementById('f-notes').value = ''

      await loadVendorData()
      renderLogTab()
      showToast('Session logged')
    } catch (err) {
      console.error(err)
      showToast('Failed to log session', 'warn')
    } finally {
      btn.disabled = false
      btn.textContent = 'Log session'
    }
  })

  document.getElementById('f-duration')?.addEventListener('change', updateSubtotal)
})

// ═══════════════════════════════════════════════════════════════
// TAB 2: MY WORK
// ═══════════════════════════════════════════════════════════════

function renderWorkTab() {
  renderTaskBreakdown()
  renderUnpaidSessions()
  renderDraftBillCard()
  renderRejectedBillCard()
  renderHistory()
}

function renderTaskBreakdown() {
  const ym       = new Date().toISOString().slice(0, 7)
  const month    = allSessions.filter(s => (s.session_date || '').startsWith(ym))
  const byTask   = {}

  month.forEach(s => {
    const key = s.task_type_id
    if (!byTask[key]) byTask[key] = { name: s.task_type_name || getTaskTypeName(key), rate: s.rate_usd || getTaskTypeRate(key), hours: 0, amount: 0 }
    byTask[key].hours  += (s.hours || 0)
    byTask[key].amount += sessionAmount(s)
  })

  const tbody = document.getElementById('task-breakdown')
  tbody.innerHTML = Object.values(byTask).map(row => `
    <tr>
      <td>${row.name}</td>
      <td style="text-align:right" class="mono">${fmt(row.rate)}/h</td>
      <td style="text-align:right" class="mono">${fmtHours(row.hours)}</td>
      <td style="text-align:right" class="mono">${fmt(row.amount)}</td>
    </tr>`).join('')

  const totalHours  = month.reduce((sum, s) => sum + (s.hours || 0), 0)
  const totalAmount = month.reduce((sum, s) => sum + sessionAmount(s), 0)
  document.getElementById('total-hours').textContent  = fmtHours(totalHours)
  document.getElementById('total-amount').textContent = fmt(totalAmount)
  document.getElementById('work-total').textContent   = fmt(totalAmount)
  document.getElementById('work-month').textContent   =
    new Date().toLocaleDateString('en', { month: 'long', year: 'numeric' })
}

function renderUnpaidSessions() {
  const tbody = document.getElementById('unpaid-sessions')
  // Only show sessions not in any bill (and no rejected bill's sessions — they're freed already)
  const free = unpaidSessions

  if (!free.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--mu2);padding:24px">No unpaid sessions</td></tr>`
    document.getElementById('unpaid-total').textContent = ''
    return
  }

  tbody.innerHTML = free.map(s => {
    const checked = selectedUnpaid.has(s.id) ? 'checked' : ''
    const editBtn = `<button class="btn btn-sm btn-ghost" style="padding:2px 6px" onclick="openEditModal('${s.id}')">✎</button>`
    return `
      <tr>
        <td><input type="checkbox" ${checked} onchange="toggleUnpaid('${s.id}')"></td>
        <td>${formatDateShort(s.session_date)}</td>
        <td>${s.client_name || (s.client_id ? getClientName(s.client_id) : '—')}</td>
        <td style="font-size:12px">${s.task_type_name || getTaskTypeName(s.task_type_id)}</td>
        <td class="mono">${fmtHours(s.hours)}</td>
        <td style="text-align:right" class="mono">${fmt(sessionAmount(s))}</td>
        <td>${noteCell(s.notes)}</td>
        <td style="text-align:center">${editBtn}</td>
      </tr>`
  }).join('')

  const total = free.reduce((sum, s) => sum + sessionAmount(s), 0)
  document.getElementById('unpaid-total').textContent = `${free.length} sessions · ${fmt(total)}`
}

function toggleUnpaid(id) {
  if (selectedUnpaid.has(id)) selectedUnpaid.delete(id)
  else selectedUnpaid.add(id)
  renderUnpaidSessions()
}
window.toggleUnpaid = toggleUnpaid

function selectAllUnpaid() {
  unpaidSessions.forEach(s => selectedUnpaid.add(s.id))
  renderUnpaidSessions()
}
window.selectAllUnpaid = selectAllUnpaid

function unselectAllUnpaid() {
  selectedUnpaid.clear()
  renderUnpaidSessions()
}
window.unselectAllUnpaid = unselectAllUnpaid

async function createDraftBill() {
  if (!currentVendor) return
  if (selectedUnpaid.size === 0) { showToast('Select at least one session', 'warn'); return }
  if (draftBill) { showToast('You already have a bill awaiting review', 'warn'); return }

  const ids   = Array.from(selectedUnpaid)
  const sessions = unpaidSessions.filter(s => ids.includes(s.id))
  const total = sessions.reduce((sum, s) => sum + sessionAmount(s), 0)

  const btn = document.getElementById('create-draft-btn')
  btn.disabled = true
  btn.textContent = 'Creating…'

  try {
    await createDraftBillV2({ vendorId: currentVendor.id, sessionIds: ids, totalAmount: total })
    selectedUnpaid.clear()
    await loadVendorData()
    renderWorkTab()
    showToast('Draft bill created — awaiting manager review')
  } catch (err) {
    console.error(err)
    showToast(err.message || 'Failed to create bill', 'warn')
  } finally {
    btn.disabled = false
    btn.textContent = 'Create draft bill from selected'
  }
}
window.createDraftBill = createDraftBill

function renderDraftBillCard() {
  const card = document.getElementById('draft-bill-card')
  if (!draftBill) { card.style.display = 'none'; return }

  card.style.display = 'block'
  document.getElementById('draft-amount').textContent = fmt(draftBill.total_amount)
  const n = (draftBill.sessions || []).length
  const submitted = draftBill.submitted_at
    ? `Submitted ${formatDateShort(draftBill.submitted_at)}`
    : `Created ${formatDateShort(draftBill.created_at)}`
  document.getElementById('draft-info').textContent = `${n} sessions · ${submitted}`
}

function renderRejectedBillCard() {
  const card = document.getElementById('rejected-bill-card')
  if (!rejectedBill) { card.style.display = 'none'; return }

  card.style.display = 'block'
  document.getElementById('rejected-amount').textContent = fmt(rejectedBill.total_amount)
  const n = (rejectedBill.sessions || []).length
  document.getElementById('rejected-info').textContent =
    `${n} sessions · Rejected ${formatDateShort(rejectedBill.returned_at)}`
  document.getElementById('rejected-notes').textContent =
    rejectedBill.finance_notes || 'No notes provided'
}

// ═══════════════════════════════════════════════════════════════
// EDIT SESSION MODAL
// ═══════════════════════════════════════════════════════════════

function openEditModal(sessionId) {
  if (window.Router && !_routerDispatching) {
    Router.open({
      entity: 'session',
      id: sessionId,
      view: 'modal',
      from: currentTab === 'work' ? 'work' : 'log',
    })
    return
  }

  const s = allSessions.find(x => x.id === sessionId)
  if (!s) return
  if (isSessionLocked(s)) { showToast('Cannot edit a session in an approved or paid bill', 'warn'); return }

  const sel = document.getElementById('edit-task-type')
  sel.innerHTML = '<option value="">— Select —</option>' +
    taskTypes.map(t => `<option value="${t.id}"${t.id === s.task_type_id ? ' selected' : ''}>${t.name}</option>`).join('')

  document.getElementById('edit-session-id').value = sessionId
  document.getElementById('edit-date').value        = s.session_date || ''
  document.getElementById('edit-duration').value    = String(s.hours || 1)
  document.getElementById('edit-notes').value       = s.notes || ''
  document.getElementById('edit-session-modal').classList.add('open')
}
window.openEditModal = openEditModal

function closeEditModal() {
  document.getElementById('edit-session-modal')?.classList.remove('open')
  if (window.Router && !_routerDispatching && Router.getParams().entity === 'session') {
    Router.close()
  }
}
window.closeEditModal = closeEditModal

function onEditTaskTypeChange() {}
window.onEditTaskTypeChange = onEditTaskTypeChange

async function saveEditSession() {
  const id          = document.getElementById('edit-session-id').value
  const taskTypeId  = document.getElementById('edit-task-type').value
  const hours       = parseFloat(document.getElementById('edit-duration').value)
  const sessionDate = document.getElementById('edit-date').value
  const notes       = document.getElementById('edit-notes').value
  if (!taskTypeId) { showToast('Select a task type', 'warn'); return }

  const saveBtn = document.querySelector('#edit-session-modal .btn-primary')
  saveBtn.disabled = true; saveBtn.textContent = 'Saving…'
  try {
    await updateSessionV2(id, { sessionDate, hours, taskTypeId, rateUsd: getTaskTypeRate(taskTypeId), notes })
    closeEditModal()
    await loadVendorData()
    if (currentTab === 'log')  renderLogTab()
    if (currentTab === 'work') renderWorkTab()
    showToast('Session updated')
  } catch (err) {
    console.error(err)
    showToast(err.message || 'Failed to save', 'warn')
  } finally {
    saveBtn.disabled = false; saveBtn.textContent = 'Save'
  }
}
window.saveEditSession = saveEditSession

async function deleteSessionFromModal() {
  const id = document.getElementById('edit-session-id').value
  if (!confirm('Delete this session? This cannot be undone.')) return
  try {
    await deleteSessionV2(id)
    closeEditModal()
    await loadVendorData()
    if (currentTab === 'log')  renderLogTab()
    if (currentTab === 'work') renderWorkTab()
    showToast('Session deleted')
  } catch (err) {
    showToast(err.message || 'Failed to delete', 'warn')
  }
}
window.deleteSessionFromModal = deleteSessionFromModal

function editDraftBill() {
  // Opens the same view-bill overlay — vendor can then withdraw and recreate
  // Full session editing is handled via withdraw → re-select
  viewDraftBill()
}
window.editDraftBill = editDraftBill

function viewDraftBill() {
  if (!draftBill) return
  const sessions = draftBill.sessions || []
  const rows = sessions.map(s => `
    <tr>
      <td>${formatDateShort(s.session_date)}</td>
      <td>${s.client_name || '—'}</td>
      <td style="font-size:12px">${s.task_type_name || '—'}</td>
      <td class="mono">${fmtHours(s.hours)}</td>
      <td style="text-align:right" class="mono">${fmt(sessionAmount(s))}</td>
    </tr>`).join('')

  // Reuse reject modal structure with a quick inline detail overlay
  const overlay = document.createElement('div')
  overlay.className = 'overlay open'
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:var(--r-lg);width:560px;padding:24px;max-height:80vh;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-size:17px;font-weight:600">Draft Bill</div>
        <div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:var(--amber-text)">${fmt(draftBill.total_amount)}</div>
      </div>
      <div style="overflow-y:auto;flex:1">
        <div class="block">
          <table class="tbl">
            <thead><tr><th>Date</th><th>Client</th><th>Task type</th><th>Hours</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
      <div style="margin-top:16px;display:flex;justify-content:flex-end">
        <button class="btn" onclick="this.closest('.overlay').remove()">Close</button>
      </div>
    </div>`
  document.body.appendChild(overlay)
}
window.viewDraftBill = viewDraftBill

async function withdrawDraftBill() {
  if (!draftBill) return
  if (!confirm('Withdraw this draft bill? Sessions will be returned to unpaid.')) return
  try {
    await withdrawBillV2(draftBill.id)
    await loadVendorData()
    renderWorkTab()
    showToast('Draft bill withdrawn')
  } catch (err) {
    showToast('Failed to withdraw', 'warn')
  }
}
window.withdrawDraftBill = withdrawDraftBill

async function createNewDraftAfterRejection() {
  // The rejected bill is already in 'returned' status — just reload to clear it
  // (rejection already freed sessions in the DB via rejectBillV2)
  await loadVendorData()
  renderWorkTab()
  switchWorkTab('unpaid')
  showToast('Select sessions to create a new draft')
}
window.createNewDraftAfterRejection = createNewDraftAfterRejection

function renderHistory() {
  const div   = document.getElementById('history-bills')
  const paid  = (allSessions.length ? [] : []) // placeholder; history comes from paidBills
  // We'll use a separate load — paidBills is loaded alongside allSessions
  if (!window._paidBills || !window._paidBills.length) {
    div.innerHTML = '<div style="color:var(--mu2);font-size:12px;padding:8px">No paid bills yet</div>'
    return
  }

  div.innerHTML = window._paidBills.map(bill => {
    const sessions = bill.sessions || []
    return `
      <div class="block" style="margin-bottom:16px">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border2);display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--green-text)">✅ Bill — Paid ${formatDateShort(bill.paid_at)}</div>
            <div style="font-size:11px;color:var(--mu);margin-top:2px">${sessions.length} sessions</div>
          </div>
          <div style="font-family:var(--font-mono);font-size:16px;font-weight:600;color:var(--green-text)">${fmt(bill.total_amount)}</div>
        </div>
        <table class="tbl">
          <thead><tr><th>Date</th><th>Client</th><th>Task type</th><th>Hours</th><th style="text-align:right">Amount</th></tr></thead>
          <tbody>
            ${sessions.map(s => `
              <tr>
                <td>${formatDateShort(s.session_date)}</td>
                <td>${s.client_name || '—'}</td>
                <td style="font-size:12px">${s.task_type_name || '—'}</td>
                <td class="mono">${fmtHours(s.hours)}</td>
                <td style="text-align:right" class="mono">${fmt(sessionAmount(s))}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`
  }).join('')
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: MY CLIENTS
// ═══════════════════════════════════════════════════════════════

function renderClientsTab() {
  const list = document.getElementById('client-list')
  if (!allClients.length) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--mu2)">No clients assigned</div>'
    return
  }
  list.innerHTML = allClients.map(c => {
    const pkg = c.active_package
    return `
      <div class="client-list-item" onclick="showClientDetail('${c.id}')">
        <div style="width:32px;height:32px;border-radius:50%;background:${avatarBg(c.full_name)};color:${avatarFg(c.full_name)};display:flex;align-items:center;justify-content:center;font-size:11px;font-family:var(--font-mono);font-weight:500;flex-shrink:0">
          ${initials(c.full_name)}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500">${c.full_name}</div>
          <div style="font-size:10px;color:var(--mu)">${pkg ? `${pkg.total_sessions}-Session Package` : 'No active package'}</div>
        </div>
        ${pkg ? `<span class="pill" style="font-size:9px">${pkg.sessions_remaining} left</span>` : ''}
      </div>`
  }).join('')
}

function showClientDetail(id) {
  if (window.Router && !_routerDispatching) {
    Router.open({ entity: 'client', id, view: 'panel', from: 'clients' })
    return
  }

  const c        = allClients.find(x => x.id === id)
  if (!c) return
  const pkg      = c?.active_package
  const sessions = allSessions.filter(s => s.client_id === id).slice(0, 10)
  const detail   = document.getElementById('client-detail')

  detail.innerHTML = `
    <div style="padding:20px;border-bottom:1px solid var(--border2)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="width:48px;height:48px;border-radius:50%;background:${avatarBg(c.full_name)};color:${avatarFg(c.full_name)};display:flex;align-items:center;justify-content:center;font-size:16px;font-family:var(--font-mono);font-weight:500">
          ${initials(c.full_name)}
        </div>
        <div>
          <div style="font-size:16px;font-weight:600">${c.full_name}</div>
          <div style="font-size:11px;color:var(--mu);font-family:var(--font-mono)">${c.email || '—'}</div>
        </div>
      </div>
      ${pkg ? (() => {
        const pkgStatusColors = { active: 'var(--green)', completed: 'var(--mu2)', paused: 'var(--amber)', cancelled: 'var(--red)' }
        const pkgStatusBg    = { active: 'var(--green-bg)', completed: 'var(--bg)', paused: 'var(--amber-bg)', cancelled: 'var(--red-bg)' }
        const pkgStatusColor = pkgStatusColors[pkg.status] || 'var(--mu2)'
        const pkgStatusBgC   = pkgStatusBg[pkg.status]    || 'var(--bg)'
        const statusBadge    = pkg.status ? `<span style="font-size:10px;padding:1px 7px;border-radius:10px;background:${pkgStatusBgC};color:${pkgStatusColor};font-family:var(--font-mono)">${pkg.status}</span>` : ''
        const lastUpdated    = pkg.updated_at ? `<div style="font-size:10px;color:var(--mu2);margin-top:4px">Last updated: ${formatDateShort(pkg.updated_at)}</div>` : ''
        return `
        <div style="padding:12px;background:var(--green-bg);border-radius:var(--r);margin-top:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <div style="font-size:11px;color:var(--green-text)">📦 ${pkg.total_sessions}-Session Package</div>
            ${statusBadge}
          </div>
          <div style="height:6px;background:rgba(0,0,0,0.1);border-radius:3px;overflow:hidden;margin-bottom:4px">
            <div style="height:100%;width:${Math.min(100, pkg.sessions_used/pkg.total_sessions*100)}%;background:var(--green)"></div>
          </div>
          <div style="font-size:10px;color:var(--mu)">${pkg.sessions_used}/${pkg.total_sessions} used · ${pkg.sessions_remaining} remaining</div>
          ${lastUpdated}
        </div>`
      })() : ''}
    </div>
    <div class="scroll" style="padding:16px">
      <div style="font-size:11px;font-weight:600;color:var(--mu2);margin-bottom:8px">RECENT SESSIONS</div>
      <div class="block">
        <table class="tbl">
          <thead><tr><th>Date</th><th>Task type</th><th>Hours</th><th>Notes</th><th>Status</th></tr></thead>
          <tbody>
            ${sessions.length ? sessions.map(s => `
              <tr>
                <td>${formatDateShort(s.session_date)}</td>
                <td style="font-size:12px">${s.task_type_name || getTaskTypeName(s.task_type_id)}</td>
                <td class="mono">${fmtHours(s.hours)}</td>
                <td>${noteCell(s.notes)}</td>
                <td>${billStatusPill(sessionDisplayStatus(s))}</td>
              </tr>`).join('')
            : `<tr><td colspan="5" style="text-align:center;color:var(--mu2);padding:16px">No sessions</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`
}
window.showClientDetail = showClientDetail

function clearClientDetail() {
  const detail = document.getElementById('client-detail')
  if (detail) {
    detail.innerHTML = `
      <div class="empty">
        <div class="empty-icon">◻</div>
        <div>Select a client</div>
      </div>
    `
  }
}
window.clearClientDetail = clearClientDetail

// ═══════════════════════════════════════════════════════════════
// TAB 4: MY PROFILE
// ═══════════════════════════════════════════════════════════════

function renderProfileTab() {
  document.getElementById('rate-sheet').innerHTML = taskTypes.map(t => `
    <tr><td>${t.name}</td><td style="text-align:right" class="mono">${fmt(t.rate_usd)}</td></tr>`).join('')
  if (currentVendor) {
    document.getElementById('profile-info').innerHTML = `
      <div class="sp-row"><div class="sp-row-label">Full name</div><div class="sp-row-val">${currentVendor.full_name}</div></div>
      <div class="sp-row"><div class="sp-row-label">Email</div><div class="sp-row-val mono">${currentVendor.email || '—'}</div></div>
      <div class="sp-row"><div class="sp-row-label">Phone</div><div class="sp-row-val mono">${currentVendor.phone || '—'}</div></div>
      <div class="sp-row"><div class="sp-row-label">Type</div><div class="sp-row-val">${currentVendor.vendor_type || '—'}</div></div>`
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

async function loadVendorData() {
  if (!currentVendor) return

  const [sessions, unpaid, draft, rejected, paid, clients, types] = await Promise.all([
    getVendorSessionsV2(currentVendor.id),
    getUnpaidSessionsV2(currentVendor.id),
    getDraftBillV2(currentVendor.id),
    getRejectedBillV2(currentVendor.id),
    getPaidBillsV2(currentVendor.id),
    getVendorClientsWithPackages(currentVendor.id),
    getTaskTypes(currentVendor.id),
  ])

  allSessions    = sessions
  unpaidSessions = unpaid
  draftBill      = draft
  rejectedBill   = rejected
  window._paidBills = paid
  allClients     = clients
  taskTypes      = types
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  registerRouterHandlers()

  // Show vendor picker
  let vendor = DEMO.vendor
  if (!vendor) vendor = await showVendorPicker({ required: true })
  if (!vendor) return

  currentVendor = vendor
  updateTopbarUser(vendor)

  // Wire avatar click to re-pick vendor
  document.querySelector('.tb-av')?.addEventListener('click', async () => {
    const v = await showVendorPicker()
    if (v) {
      currentVendor = v
      selectedClientId = null
      selectedUnpaid.clear()
      draftBill = null
      rejectedBill = null
      await loadVendorData()
      switchTab(currentTab)
    }
  })

  try {
    await loadVendorData()
  } catch (err) {
    console.error('[HSos] loadVendorData failed:', err)
    showToast('Failed to load data — check console', 'warn')
  }

  const _initTab = new URLSearchParams(window.location.search).get('tab') || 'log'
  switchTab(_initTab, { pushUrl: false })
  if (window.Router) Router.dispatch()
})
