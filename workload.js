// workload.js — HSos Workload module logic
// Depends on: supabase-client.js (loaded before this file)

// ── Data (loaded from Supabase) ───────────────────────────────────────────────
let VENDOR_PROFILE  = null   // current vendor's profile from DB
let STUDENTS        = []     // clients assigned to this vendor
let SESSIONS        = []     // recent vendor_hours for this month
let VENDOR_PAYCHECKS = []    // paychecks for this vendor

const SERVICE_TYPE_META = {
  coaching:   { icon: '🎓', color: '#4caf82', colorBg: '#1a2e24' },
  consulting: { icon: '💼', color: '#5a9de0', colorBg: '#1a2233' },
  editing:    { icon: '✏️', color: '#a07de0', colorBg: '#221a33' },
  design:     { icon: '🎨', color: '#e0a040', colorBg: '#2e2210' },
  admin:      { icon: '📋', color: '#e05a5a', colorBg: '#2e1a1a' },
  other:      { icon: '⚡', color: '#3dbfb0', colorBg: '#0f2826' },
}

function getVendorServices() {
  const rates = VENDOR_PROFILE?.rates || []
  if (rates.length === 0) return []
  return rates.map(r => {
    const meta = SERVICE_TYPE_META[r.session_type] || SERVICE_TYPE_META.other
    const name = r.session_type.charAt(0).toUpperCase() + r.session_type.slice(1)
    return {
      id:      r.session_type,
      name,
      icon:    meta.icon,
      color:   meta.color,
      colorBg: meta.colorBg,
      desc:    `€${r.rate}/hr`,
      rate:    r.rate,
    }
  })
}

let currentPage = 'workload';
let selectedStudent = null;
let selectedEntity = null;   // {kind:'student'|'service', data:{...}}
let entityTab = 'students';
let sessionsViewMode = 'table'; // 'table' | 'calendar'
let calendarMonth = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
let OPS_CLIENTS = []         // all operational clients with meta
let OPS_VENDORS = []         // all vendors for assignment dropdowns
let OPS_FILTERS = { search:'', vendorId:'', active:'all', payment:'all' }
let selectedOpsClientId = null
let selectedOpsClientDetail = null
let opsClientEditMode = false
let pendingOpsClientId = null

const MONEY_SYMBOL = { EUR:'€', USD:'$', GBP:'£', ILS:'₪', CHF:'₣' }

// ── Data mapping helpers ───────────────────────────────────────
function mapClient(c) {
  const colors = ['#4caf82','#5a9de0','#c06edd','#e0a040','#e05a5a','#3dbfb0','#a07de0']
  const bgs    = ['#1a2e24','#1a2233','#2a1a33','#2e2210','#2e1a1a','#0f2826','#221a33']
  // Prefer full_name; fallback to name
  const displayName = c.full_name || c.name || ''
  const idx = (displayName.charCodeAt(0) || 0) % colors.length
  const deals = c.deals || []
  const vendors = c.vendors || []
  const totalValue = c.totalValue != null
    ? c.totalValue
    : deals.reduce((sum, d) => sum + (parseFloat(d.price) || 0), 0)
  const paidValue = c.paidValue != null
    ? c.paidValue
    : deals
      .filter(d => (d.billing_status || d.billing) === 'paid')
      .reduce((sum, d) => sum + (parseFloat(d.price) || 0), 0)
  const dealCount = c.dealCount != null ? c.dealCount : deals.length
  const activeDealCount = c.activeDealCount != null
    ? c.activeDealCount
    : deals.filter(d => (d.sales_status || d.fulfillment_stage || d.fulfillment) === 'active').length
  return {
    ...c,
    name:             displayName,
    initials:         displayName.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2),
    color:            colors[idx],
    colorBg:          bgs[idx],
    paymentStatus:    c.payment_status || c.paymentStatus || 'active',
    packageSize:      c.package_size      || 0,
    sessionsUsed:     c.sessions_used     || c.lessons_used || 0,
    sessionsRemaining:(c.package_size     || 0) - (c.sessions_used || c.lessons_used || 0),
    vendors,
    dealCount,
    activeDealCount,
    totalValue,
    paidValue,
    outstandingValue: c.outstandingValue != null ? c.outstandingValue : (totalValue - paidValue),
    isActive:         c.active !== false,
    clientKind:       c.client_kind || c.clientKind || 'private',
    // TEMP COMPAT aliases for any remaining references
    lessonsUsed:      c.sessions_used     || c.lessons_used || 0,
    lessonsRemaining: (c.package_size     || 0) - (c.sessions_used || c.lessons_used || 0),
    sessions:         [],  // loaded separately if needed
  }
}

function mapSession(s) {
  // entity_name is not a real DB column — it's stored as a JSON prefix in notes: "entity:Name||rest"
  let entityName = s.entity_name || null
  let cleanNotes = s.notes || null
  if (!entityName && s.notes && s.notes.startsWith('entity:')) {
    const sepIdx = s.notes.indexOf('||')
    if (sepIdx !== -1) {
      entityName = s.notes.slice(7, sepIdx)
      cleanNotes = s.notes.slice(sepIdx + 2) || null
    } else {
      entityName = s.notes.slice(7)
      cleanNotes = null
    }
  }
  return {
    ...s,
    date:   s.session_date || s.date,
    entity: entityName || '—',
    notes:  cleanNotes,
    type:   s.session_type,
    hours:  parseFloat(s.duration_hours ?? s.hours),
  }
}

function mapPaycheck(pc) {
  return {
    ...pc,
    totalHours:  parseFloat(pc.total_hours),
    paymentDate: pc.payment_date,
  }
}

// ── Load data from Supabase ────────────────────────────────────
async function loadData() {
  try {
    const user = await requireAuth()
    if (!user) return

    // Resolve vendor ID: check selector override first, then auth profile, then legacy override
    let vendorId = null
    const profile = await getProfile()
    const selectorOverride = localStorage.getItem('HSOS_SELECTED_VENDOR_ID')
    if (selectorOverride) {
      vendorId = selectorOverride
    } else if (profile?.vendor_id) {
      vendorId = profile.vendor_id
    } else {
      vendorId = localStorage.getItem('HSOS_ACTIVE_VENDOR_ID') || null
    }

    if (!vendorId) {
      // No vendor resolved — show vendor picker if vendors are available
      try {
        const allVendors = await getVendors()
        if (allVendors && allVendors.length > 0) {
          renderVendorPicker(allVendors)
        } else {
          showToast('No vendor profile found. Add a vendor in the Sales module first.', 'warn')
        }
      } catch (e) {
        showToast('No vendor profile linked to this account', 'warn')
      }
      return
    }
    const now = new Date()
    const currentMonth = now.toISOString().slice(0, 7) // 'YYYY-MM'

    const [vendor, clientsMeta, allVendors, sessions, paychecks] = await Promise.all([
      getVendor(vendorId),
      getClientsWithMeta(),
      getVendors(),
      getVendorHours(vendorId, currentMonth),
      getVendorPaychecks(vendorId),
    ])

    const vendorDisplayName = vendor.full_name || vendor.name || ''
    VENDOR_PROFILE = {
      ...vendor,
      name:         vendorDisplayName,
      initials:     vendorDisplayName.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2),
      calLink:      vendor.cal_link,
      salaryMethod: vendor.salary_method,
      // Future fields — read if present, no error if absent
      nickname:     vendor.nickname     || null,
      vendorType:   vendor.vendor_type  || null,
      contractUrl:  vendor.contract_url || vendor.contract_link || null,
    }

    // STUDENTS = clients assigned to this vendor (internal state variable; data is client records)
    // vendor.clients is the aligned name from getVendor; vendor.students is the legacy alias
    const assignedIds = new Set((vendor.clients || vendor.students || []).map(c => typeof c === 'object' ? c.id : c))
    STUDENTS = clientsMeta
      .filter(c => assignedIds.has(c.id))
      .map(mapClient)

    OPS_CLIENTS = clientsMeta.map(mapClient)
    OPS_VENDORS = allVendors.map(v => ({
      id: v.id,
      name: v.full_name || v.name || '',
      nickname: v.nickname || null,
    }))

    SESSIONS = sessions.map(mapSession)
    VENDOR_PAYCHECKS = paychecks.map(mapPaycheck)

    // Update topbar name/initials
    const nameEl = document.getElementById('topbar-vendor-name')
    const avEl   = document.getElementById('topbar-av')
    if (nameEl) nameEl.textContent = VENDOR_PROFILE.name || 'Vendor'
    if (avEl)   avEl.textContent   = VENDOR_PROFILE.initials || '?'

    // Render vendor selector (always show for now — role check placeholder)
    renderVendorSelector(allVendors, vendorId)

    // Update summary stats
    populateSessionTypeDropdown()
    updateSummaryStats()
    renderEntityPicker()
    renderSessions()
    renderStudentList()
    renderOpsVendorFilter()
    if (currentPage === 'payments') renderPayments()
    if (currentPage === 'clients') renderStudentList()
    if (selectedOpsClientId) await selectStudent(selectedOpsClientId, { keepPage: true })
    if (pendingOpsClientId) {
      await openOpsClientFromNavigation(pendingOpsClientId)
      pendingOpsClientId = null
    }

  } catch(err) {
    showToast('Failed to load: ' + err.message, 'warn')
  }
}

function updateSummaryStats() {
  const now = new Date()
  const thisMonth = now.toISOString().slice(0, 7)
  const monthSessions = SESSIONS.filter(s => (s.date || s.session_date || '').startsWith(thisMonth))
  const totalHours = monthSessions.reduce((sum, s) => sum + (s.hours || 0), 0)
  const uniqueStudents = new Set(monthSessions.filter(s => s.client_id).map(s => s.client_id)).size

  // update the summary pills in the right panel of workload view
  const pills = document.querySelectorAll('#page-workload .sum-val')
  if (pills[0]) pills[0].textContent = totalHours
  if (pills[1]) pills[1].textContent = monthSessions.length
  if (pills[2]) pills[2].textContent = uniqueStudents
}

// ── Vendor picker (admin override when no auth profile is linked) ─────────────
function renderVendorPicker(vendors) {
  const mainEl = document.querySelector('.main') || document.body
  let picker = document.getElementById('vendor-picker-overlay')
  if (!picker) {
    picker = document.createElement('div')
    picker.id = 'vendor-picker-overlay'
    picker.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999'
    mainEl.appendChild(picker)
  }
  const opts = vendors.map(v =>
    `<button onclick="selectActiveVendor('${v.id}')" style="width:100%;padding:10px 14px;background:var(--sf2);border:1px solid var(--b);border-radius:6px;color:var(--tx);font-family:inherit;font-size:13px;cursor:pointer;text-align:left;margin-bottom:6px">
      <strong>${v.full_name || v.name}</strong>
      ${v.nickname ? `<span style="color:var(--mu2);font-size:11px;margin-left:6px">(${v.nickname})</span>` : ''}
    </button>`
  ).join('')
  picker.innerHTML = `
    <div style="background:var(--sf);border:1px solid var(--b);border-radius:10px;padding:24px;min-width:320px;max-width:400px">
      <div style="font-size:13px;font-weight:600;color:var(--tx);margin-bottom:6px">Choose Vendor View</div>
      <div style="font-size:11px;color:var(--mu2);margin-bottom:16px">No account session detected. Select a vendor to view their workload.</div>
      ${opts}
    </div>`
}

function selectActiveVendor(vendorId) {
  localStorage.setItem('HSOS_ACTIVE_VENDOR_ID', vendorId)
  const picker = document.getElementById('vendor-picker-overlay')
  if (picker) picker.remove()
  loadData()
}

// ── Vendor selector (topbar toggle) ──────────────────────────
function renderVendorSelector(vendors, activeId) {
  const wrap = document.getElementById('vendor-sel-wrap')
  const label = document.getElementById('vendor-sel-label')
  const dd = document.getElementById('vendor-sel-dd')
  if (!wrap || !label || !dd) return

  wrap.style.display = 'flex'

  const active = vendors.find(v => v.id === activeId)
  label.textContent = active ? (active.nickname || active.full_name || active.name || '—') : '—'

  dd.innerHTML = vendors.map(v => {
    const isCur = v.id === activeId
    const name = v.full_name || v.name || ''
    return `<div class="vendor-sel-opt${isCur ? ' cur' : ''}" onclick="setSelectedVendor('${v.id}')">
      <div style="font-size:12px;font-weight:500">${esc(name)}</div>
      ${v.nickname ? `<div style="font-size:10px;color:var(--mu2)">${esc(v.nickname)}</div>` : ''}
    </div>`
  }).join('')
}

function toggleVendorSelDd() {
  document.getElementById('vendor-sel-dd').classList.toggle('open')
}

function setSelectedVendor(vendorId) {
  localStorage.setItem('HSOS_SELECTED_VENDOR_ID', vendorId)
  document.getElementById('vendor-sel-dd').classList.remove('open')
  loadData()
}


// ── Sessions view toggle ──────────────────────────────────────
function setSessionsView(mode, btn) {
  sessionsViewMode = mode
  document.querySelectorAll('.vt-btn').forEach(b => b.classList.remove('cur'))
  if (btn) btn.classList.add('cur')
  const tableView = document.getElementById('sessions-table-view')
  const calView = document.getElementById('sessions-calendar-view')
  if (mode === 'table') {
    if (tableView) tableView.style.display = ''
    if (calView)   calView.style.display = 'none'
  } else {
    if (tableView) tableView.style.display = 'none'
    if (calView) {
      calView.style.display = ''
      renderCalendar()
    }
  }
}

function changeMonth(delta) {
  const [y, m] = calendarMonth.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  calendarMonth = d.toISOString().slice(0, 7)
  renderCalendar()
}

function renderCalendar() {
  const calView = document.getElementById('sessions-calendar-view')
  if (!calView) return

  const [year, month1] = calendarMonth.split('-').map(Number)
  const month = month1 - 1 // 0-indexed
  const now = new Date()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })

  // Build day→sessions map for this calendar month
  const dayMap = {}
  SESSIONS.forEach(s => {
    const dateStr = s.date || ''
    if (!dateStr.startsWith(calendarMonth)) return
    const dayNum = parseInt(dateStr.slice(8, 10), 10)
    if (!dayNum) return
    if (!dayMap[dayNum]) dayMap[dayNum] = []
    dayMap[dayNum].push(s)
  })

  const typeColors = {
    coaching:   { color: '#5a9de0', bg: '#EBF3F6' },
    consulting: { color: '#4caf82', bg: '#E6F4F1' },
    admin:      { color: '#e0a040', bg: '#FBF3E8' },
    editing:    { color: '#a07de0', bg: '#F0EAFB' },
    design:     { color: '#c06edd', bg: '#F5E8FA' },
    other:      { color: '#888',    bg: '#F0F0F0' },
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  let html = `
    <div class="cal-nav">
      <button class="btn-icon" onclick="changeMonth(-1)">←</button>
      <span class="cal-month-label">${monthLabel}</span>
      <button class="btn-icon" onclick="changeMonth(1)">→</button>
    </div>
    <div class="cal-grid">
    ${days.map(d => `<div class="cal-dow">${d}</div>`).join('')}`

  // Empty cells before month start
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-cell empty"></div>`

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = calendarMonth === now.toISOString().slice(0, 7) && d === now.getDate()
    const sessions = dayMap[d] || []
    const totalHours = sessions.reduce((s, x) => s + (x.hours || 0), 0)

    const sessionTags = sessions.slice(0, 3).map(s => {
      const col = typeColors[s.type] || typeColors.other
      const label = s.entity !== '—' ? s.entity.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : s.type.slice(0, 2).toUpperCase()
      const tooltip = `${s.entity} • ${s.start_time || 'All day'} • ${s.hours}h • ${s.type}${s.notes ? '\n' + s.notes : ''}`
      return `<div class="cal-tag" style="background:${col.bg};color:${col.color}" title="${esc(tooltip)}" onclick="event.stopPropagation();openSessionDetail('${s.id}')">${esc(label)}</div>`
    }).join('')

    html += `<div class="cal-cell${isToday ? ' today' : ''}${sessions.length ? ' has-sessions' : ''}">
      <div class="cal-day-num">${d}</div>
      ${totalHours ? `<div class="cal-hours">${totalHours}h</div>` : ''}
      <div class="cal-tags">${sessionTags}</div>
    </div>`
  }

  html += '</div>'
  calView.innerHTML = html
}

// ── Session type dropdown ─────────────────────────────────────
function populateSessionTypeDropdown() {
  const typeSelect = document.getElementById('lf-type')
  if (!typeSelect) return
  const rates = VENDOR_PROFILE?.rates || []
  if (rates.length === 0) return // keep HTML defaults
  typeSelect.innerHTML = rates.map(r => {
    const name = r.session_type.charAt(0).toUpperCase() + r.session_type.slice(1)
    return `<option value="${r.session_type}">${name}</option>`
  }).join('')
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  const now = new Date();
  document.getElementById('lf-date').value = now.toISOString().slice(0,10);
  // Round to nearest hour
  const rounded = new Date(now);
  rounded.setMinutes(0, 0, 0);
  document.getElementById('lf-time').value = rounded.toTimeString().slice(0,5);

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('wl-date-label').textContent = `${months[now.getMonth()]} ${now.getFullYear()}`;
  document.getElementById('wl-month-label').textContent = `${months[now.getMonth()]} ${now.getFullYear()}`;

  setFormEnabled(false);
  renderEntityPicker();
  renderSessions();
  renderStudentList();
  renderOpsVendorFilter();
}

// ── Form enabled/disabled ─────────────────────────────────────
function setFormEnabled(on) {
  document.getElementById('se-body').classList.toggle('disabled', !on);
  document.getElementById('se-footer').classList.toggle('disabled', !on);
}

// ── Module menu ───────────────────────────────────────────────
function toggleMod() {
  document.getElementById('mod-dd').classList.toggle('open');
}
function goModule(m) {
  document.getElementById('mod-dd').classList.remove('open');
  if(m === 'deals')    window.open('deals.html','_self');
  else if(m === 'payments') window.open('payments.html','_self');
  else if(m === 'portal')   window.open('clients-portal.html','_self');
  else showToast(`${m.charAt(0).toUpperCase()+m.slice(1)} — coming soon`, 'info');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.logo-wrap')) document.getElementById('mod-dd').classList.remove('open')
  if (!e.target.closest('.vendor-sel-wrap')) document.getElementById('vendor-sel-dd')?.classList.remove('open')
})

// ── Page switching ────────────────────────────────────────────
function switchPage(page, btn) {
  if (page === 'students') page = 'clients'
  currentPage = page;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('cur'));
  const targetBtn = btn || document.querySelector(`.nav-btn[data-page="${page}"]`)
  if (targetBtn) targetBtn.classList.add('cur');
  const pw = document.getElementById('page-workload');
  const ps = document.getElementById('page-clients');
  const pp = document.getElementById('page-payments');
  if(page === 'workload') {
    pw.classList.remove('hidden'); pw.style.display='flex';
    ps.classList.add('hidden');    ps.style.display='none';
    pp.classList.add('hidden');    pp.style.display='none';
  } else if(page === 'clients') {
    pw.classList.add('hidden');    pw.style.display='none';
    ps.classList.remove('hidden'); ps.style.display='flex';
    pp.classList.add('hidden');    pp.style.display='none';
    renderStudentList();
    renderOpsClientDetail();
  } else {
    pw.classList.add('hidden');    pw.style.display='none';
    ps.classList.add('hidden');    ps.style.display='none';
    pp.classList.remove('hidden'); pp.style.display='flex';
    renderPayments();
  }
}

// ── Entity picker ─────────────────────────────────────────────
function switchEntityTab(tab, btn) {
  entityTab = tab;
  document.querySelectorAll('.ep-tab').forEach(b => b.classList.remove('cur'));
  btn.classList.add('cur');
  renderEntityPicker();
}

function renderEntityPicker() {
  const grid = document.getElementById('ep-grid');
  if(entityTab === 'students') {
    grid.innerHTML = STUDENTS.map(s => {
      const isSel = selectedEntity && selectedEntity.kind==='student' && selectedEntity.data.id===s.id;
      return `<div class="ep-item${isSel?' sel':''}" onclick="pickEntity('student','${s.id}')">
        <div class="ep-av" style="background:${s.colorBg};color:${s.color}">${s.initials}</div>
        <div style="flex:1;min-width:0">
          <div class="ep-name">${s.name}</div>
          <div class="ep-sub">${s.sessionsRemaining}/${s.packageSize} left</div>
        </div>
        <div class="ep-check">${isSel?'✓':''}</div>
      </div>`;
    }).join('');
  } else {
    const vendorServices = getVendorServices()
    grid.innerHTML = vendorServices.length
      ? vendorServices.map(sv => {
          const isSel = selectedEntity && selectedEntity.kind==='service' && selectedEntity.data.id===sv.id;
          return `<div class="ep-item${isSel?' sel':''}" onclick="pickEntity('service','${sv.id}')">
            <div class="ep-svc-icon" style="background:${sv.colorBg};color:${sv.color}">${sv.icon}</div>
            <div style="flex:1;min-width:0">
              <div class="ep-name">${sv.name}</div>
              <div class="ep-sub">${sv.desc}</div>
            </div>
            <div class="ep-check">${isSel?'✓':''}</div>
          </div>`;
        }).join('')
      : `<div style="padding:14px;text-align:center;color:var(--mu2);font-size:12px">No service rates configured</div>`
  }
}

function pickEntity(kind, id) {
  const data = kind==='student'
    ? STUDENTS.find(s=>s.id===id)
    : getVendorServices().find(s=>s.id===id);
  if(selectedEntity && selectedEntity.data.id===id) {
    clearEntity(); return;
  }
  selectedEntity = {kind, data};
  document.getElementById('ep-selected-label').textContent = data.name;
  // update chip in form header
  const chip = document.getElementById('se-chip');
  if(kind==='student') {
    chip.innerHTML = `<span class="se-entity-chip"><span class="chip-av" style="background:${data.colorBg};color:${data.color}">${data.initials}</span>${data.name}</span>`;
  } else {
    chip.innerHTML = `<span class="se-entity-chip"><span class="chip-svc" style="background:${data.colorBg}">${data.icon}</span>${data.name}</span>`;
  }
  chip.style.display = 'inline';
  // set type default based on kind
  const typeEl = document.getElementById('lf-type');
  if(kind==='service') {
    typeEl.value = data.id; // service id === session_type
  } else {
    // for students, pick first non-admin type if available
    const firstOpt = typeEl.options[0]
    if(typeEl.value==='admin' && firstOpt) typeEl.value = firstOpt.value
  }
  setFormEnabled(true);
  renderEntityPicker();
}

function clearEntity() {
  selectedEntity = null;
  document.getElementById('ep-selected-label').textContent = '—';
  document.getElementById('se-chip').style.display = 'none';
  setFormEnabled(false);
  renderEntityPicker();
}

// ── Sessions table ────────────────────────────────────────────
function renderSessions() {
  const tbody = document.getElementById('sessions-tbody');
  const typeClass = {coaching:'private',consulting:'group',admin:'service',editing:'service',design:'service',other:'service'};
  if (tbody) {
    tbody.innerHTML = SESSIONS.map(s => `<tr class="session-row" onclick="openSessionDetail('${s.id}')" title="Click to view/edit">
      <td class="mono" style="color:var(--mu);font-size:11px">${s.date}</td>
      <td style="font-weight:500">${esc(s.entity)}</td>
      <td><span class="type-pill ${typeClass[s.type]||'service'}">${s.type}</span></td>
      <td style="color:var(--mu)">${s.hours}h</td>
    </tr>`).join('');
  }
  if (sessionsViewMode === 'calendar') renderCalendar()
}

// ── Submit session ────────────────────────────────────────────
async function submitSession() {
  if (!selectedEntity) { showToast('Select a student or service first', 'info'); return; }
  const date = document.getElementById('lf-date').value;
  const dur  = parseFloat(document.getElementById('lf-dur').value);
  const type = document.getElementById('lf-type').value;
  if (!date) { showToast('Please enter a date', 'info'); return; }

  const vendorId = localStorage.getItem('HSOS_SELECTED_VENDOR_ID')
    || (await getProfile().catch(() => null))?.vendor_id
    || localStorage.getItem('HSOS_ACTIVE_VENDOR_ID')
    || null
  if (!vendorId) { showToast('Vendor profile not found', 'warn'); return; }

  // Block if selected month is sealed
  const sessionMonth = date.slice(0, 7)
  const sealedForMonth = await getPaychecks({ vendor_id: vendorId, month: sessionMonth }).catch(() => [])
  if (sealedForMonth.length > 0) {
    showToast('Cannot log session: This month is sealed. Sessions will be added to next report.', 'warn')
    return
  }

  // Block student sessions with no active deal
  if (selectedEntity.kind === 'student') {
    const clientDeals = await getDeals({ client_id: selectedEntity.data.id, sales_status: 'active' }).catch(() => [])
    if (clientDeals.length === 0) {
      showToast('Cannot log session: No active deal for this client. Contact your manager.', 'warn')
      return
    }
  }

  const userNotes = document.getElementById('lf-notes').value.trim()
  // Encode entity name into notes since vendor_hours has no entity_name column
  const encodedNotes = userNotes
    ? `entity:${selectedEntity.data.name}||${userNotes}`
    : `entity:${selectedEntity.data.name}`

  const sessionData = {
    vendor_id:      vendorId,
    client_id:      selectedEntity.kind === 'student' ? selectedEntity.data.id : null,
    session_date:   date,
    session_type:   type,
    duration_hours: dur,
    notes:          encodedNotes,
  }

  try {
    await logVendorHour(sessionData)
    await loadData()
    showToast(`Session logged — ${selectedEntity.data.name}, ${dur}h`, 'success')
    clearEntity()
  } catch(err) {
    showToast('Error logging session: ' + err.message, 'warn')
  }
}

function esc(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function fmtMoney(value, currency = 'EUR') {
  const symbol = MONEY_SYMBOL[currency] || `${currency} `
  return `${symbol}${Number(value || 0).toLocaleString('en', { maximumFractionDigits: 2 })}`
}

function normalizePaymentStatus(status) {
  if (!status) return 'active'
  const s = String(status).toLowerCase()
  if (s.includes('overdue')) return 'overdue'
  if (s.includes('pending') || s.includes('invoiced') || s.includes('partial')) return 'pending'
  if (s.includes('inactive')) return 'inactive'
  if (s.includes('paid')) return 'paid'
  return 'active'
}

function getVendorLabel(vendor) {
  if (!vendor) return 'Unassigned'
  return vendor.nickname || vendor.full_name || vendor.name || 'Assigned'
}

function renderOpsVendorFilter() {
  const sel = document.getElementById('ops-filter-vendor')
  if (!sel) return
  const current = OPS_FILTERS.vendorId || ''
  sel.innerHTML = '<option value="">All vendors</option>' + OPS_VENDORS
    .map(v => `<option value="${v.id}">${esc(v.name)}</option>`)
    .join('')
  sel.value = current
}

function setOpsClientsSearch(value) {
  OPS_FILTERS.search = value || ''
  renderStudentList()
}

function setOpsVendorFilter(value) {
  OPS_FILTERS.vendorId = value || ''
  renderStudentList()
}

function setOpsActiveFilter(value) {
  OPS_FILTERS.active = value || 'all'
  renderStudentList()
}

function setOpsPaymentFilter(value) {
  OPS_FILTERS.payment = value || 'all'
  renderStudentList()
}

function filteredOpsClients() {
  const q = OPS_FILTERS.search.trim().toLowerCase()
  // Resolve which vendor to scope to: explicit filter > active vendor profile
  const activeVendorId = VENDOR_PROFILE?.id || null
  return OPS_CLIENTS.filter(c => {
    if (q) {
      const blob = [c.name, c.email, c.phone, c.company, c.source].filter(Boolean).join(' ').toLowerCase()
      if (!blob.includes(q)) return false
    }
    if (OPS_FILTERS.vendorId) {
      // Explicit vendor filter selected from dropdown
      const hasVendor = (c.vendors || []).some(v => v.id === OPS_FILTERS.vendorId)
      if (!hasVendor) return false
    } else if (activeVendorId) {
      // Default: scope to current vendor's assigned clients
      const hasVendor = (c.vendors || []).some(v => v.id === activeVendorId)
      if (!hasVendor) return false
    }
    if (OPS_FILTERS.active === 'active' && !c.isActive) return false
    if (OPS_FILTERS.active === 'inactive' && c.isActive) return false
    const pay = normalizePaymentStatus(c.paymentStatus)
    if (OPS_FILTERS.payment !== 'all' && pay !== OPS_FILTERS.payment) return false
    return true
  })
}

// ── Clients list (Operations > Clients view) ─────────────────
function renderStudentList() {
  const list = document.getElementById('ops-clients-list')
  if (!list) return
  const rows = filteredOpsClients()
  const countEl = document.getElementById('ops-clients-count')
  if (countEl) countEl.textContent = `${rows.length}`

  list.innerHTML = rows.map(c => {
    const isCur = selectedOpsClientId === c.id
    const vendor = (c.vendors || [])[0]
    const pay = normalizePaymentStatus(c.paymentStatus)
    const levelLine = [c.level, c.company].filter(Boolean).join(' · ') || (c.clientKind === 'corporate' ? 'Corporate' : 'Private')
    return `<div class="ops-client-card${isCur ? ' cur' : ''}" onclick="selectStudent('${c.id}')">
      <div class="ops-client-av" style="background:${c.colorBg};color:${c.color}">${esc(c.initials)}</div>
      <div class="ops-client-main">
        <div class="ops-client-name">${esc(c.name)}</div>
        <div class="ops-client-sub">${esc(levelLine)}</div>
        <div class="ops-client-meta">
          <span class="badge ${pay}"><span class="bdot"></span>${esc(c.isActive ? 'active' : 'inactive')}</span>
          <span class="ops-vendor-mini"><span class="ops-vendor-mini-dot"></span>${esc(getVendorLabel(vendor))}</span>
        </div>
      </div>
    </div>`
  }).join('') || `<div style="padding:20px;text-align:center;color:var(--mu2);font-size:12px;background:#FFFFFF">No clients found</div>`
}

async function selectStudent(id, options = {}) {
  selectedOpsClientId = id
  selectedStudent = OPS_CLIENTS.find(c => c.id === id) || null
  opsClientEditMode = false
  if (!options.keepPage) switchPage('clients')
  renderStudentList()
  renderOpsClientDetail(true)

  try {
    selectedOpsClientDetail = await getClientDetail(id)
    renderOpsClientDetail(false)
  } catch (err) {
    showToast('Failed to load client detail: ' + err.message, 'warn')
    selectedOpsClientDetail = null
    renderOpsClientDetail(false)
  }
}

function renderOpsClientDetail(isLoading = false) {
  const empty = document.getElementById('ops-client-empty')
  const detailWrap = document.getElementById('ops-client-detail')
  const body = document.getElementById('ops-client-detail-body')
  if (!empty || !detailWrap || !body) return

  if (!selectedOpsClientId) {
    empty.style.display = 'flex'
    detailWrap.classList.add('hidden')
    return
  }

  empty.style.display = 'none'
  detailWrap.classList.remove('hidden')

  if (isLoading || !selectedOpsClientDetail) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">⌛</div><div style="font-size:12px">Loading client details...</div></div>`
    return
  }

  const base = OPS_CLIENTS.find(c => c.id === selectedOpsClientId) || mapClient(selectedOpsClientDetail)
  const detail = selectedOpsClientDetail
  const vendors = (detail.vendor_clients || [])
    .map(vc => vc.vendors || OPS_VENDORS.find(v => v.id === vc.vendor_id))
    .filter(Boolean)
  const sessions =(detail.sessions || []).slice().sort((a, b) => (b.session_date || '').localeCompare(a.session_date || '')).slice(0, 5)
  const deals = (detail.deals || []).slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  const activeDeals = deals.filter(d => {
    const st = (d.sales_status || d.fulfillment_stage || '').toLowerCase()
    return st && st !== 'closed'
  })
  const payment = normalizePaymentStatus(base.paymentStatus)

  if (opsClientEditMode) {
    body.innerHTML = `
      <div class="ops-sec">
        <div class="ops-sec-hd"><span class="ops-sec-title">Edit Client</span></div>
        <div class="ops-inline-edit">
          <div class="fg ff"><label class="fl">Full name</label><input class="fi" id="ops-edit-name" value="${esc(base.name)}"></div>
          <div class="fg"><label class="fl">Email</label><input class="fi" id="ops-edit-email" value="${esc(base.email || '')}"></div>
          <div class="fg"><label class="fl">Phone</label><input class="fi" id="ops-edit-phone" value="${esc(base.phone || '')}"></div>
          <div class="fg"><label class="fl">Client kind</label>
            <select class="fsel" id="ops-edit-kind">
              <option value="private"${(base.clientKind || 'private') === 'private' ? ' selected' : ''}>Private</option>
              <option value="corporate"${(base.clientKind || 'private') === 'corporate' ? ' selected' : ''}>Corporate</option>
            </select>
          </div>
          <div class="fg"><label class="fl">Company</label><input class="fi" id="ops-edit-company" value="${esc(base.company || '')}"></div>
          <div class="fg"><label class="fl">Source</label><input class="fi" id="ops-edit-source" value="${esc(base.source || '')}"></div>
          <div class="fg"><label class="fl">Status</label>
            <select class="fsel" id="ops-edit-active">
              <option value="true"${base.isActive ? ' selected' : ''}>Active</option>
              <option value="false"${!base.isActive ? ' selected' : ''}>Inactive</option>
            </select>
          </div>
          <div class="fg ff"><label class="fl">Notes</label><textarea class="fi" id="ops-edit-notes" style="min-height:76px;resize:vertical">${esc(base.notes || '')}</textarea></div>
        </div>
        <div class="ops-inline-edit-actions">
          <button class="btn-ghost" onclick="opsClientEditMode=false;renderOpsClientDetail()">Cancel</button>
          <button class="btn-primary" onclick="saveOpsClientEdits()">Save</button>
        </div>
      </div>`
    return
  }

  body.innerHTML = `
    <div class="ops-detail-card">
      <div class="ops-detail-av" style="background:${base.colorBg};color:${base.color}">${esc(base.initials)}</div>
      <div style="flex:1">
        <div class="ops-detail-name">${esc(base.name)}</div>
        <div class="ops-detail-contact">${esc(base.email || 'No email')}</div>
        <div class="ops-detail-contact">${esc(base.phone || 'No phone')}</div>
        <div style="margin-top:7px"><span class="badge ${payment}"><span class="bdot"></span>${esc(payment)}</span></div>
      </div>
    </div>

    <div class="ops-detail-sections">
      <div class="ops-sec">
        <div class="ops-sec-hd"><span class="ops-sec-title">Details</span></div>
        <div class="ops-row"><span class="ops-row-l">Client kind</span><span class="ops-row-r">${esc(base.clientKind || 'private')}</span></div>
        <div class="ops-row"><span class="ops-row-l">Company</span><span class="ops-row-r">${esc(base.company || '—')}</span></div>
        <div class="ops-row"><span class="ops-row-l">Source</span><span class="ops-row-r">${esc(base.source || '—')}</span></div>
        <div class="ops-row"><span class="ops-row-l">Active</span><span class="ops-row-r">${base.isActive ? 'Yes' : 'No'}</span></div>
      </div>

      <div class="ops-sec">
        <div class="ops-sec-hd"><span class="ops-sec-title">Assigned Vendors</span></div>
        <div class="ops-vendors-wrap">
          ${vendors.length ? vendors.map(v => `<span class="ops-vendor-chip">👤 ${esc(getVendorLabel(v))}</span>`).join('') : `<span style="font-size:11px;color:var(--mu2)">No vendors assigned</span>`}
        </div>
        <div style="font-size:11px;color:var(--mu2);margin-top:4px;padding:0 2px">Vendor assignment is managed in Sales → Vendors.</div>
      </div>

      <div class="ops-sec">
        <div class="ops-sec-hd"><span class="ops-sec-title">Recent Sessions (${sessions.length})</span></div>
        <table class="ops-table">
          <thead><tr><th>Date</th><th>Type</th><th>Vendor</th><th>Status</th></tr></thead>
          <tbody>
            ${sessions.length ? sessions.map(s => {
              const vendorName = s.vendors?.full_name || OPS_VENDORS.find(v => v.id === s.vendor_id)?.name || '—'
              return `<tr>
                <td class="mono" style="font-size:11px;color:var(--mu)">${esc(s.session_date || '—')}</td>
                <td>${esc(s.session_type || '—')}</td>
                <td>${esc(vendorName)}</td>
                <td>${esc(s.status || 'done')}</td>
              </tr>`
            }).join('') : `<tr><td colspan="4" style="text-align:center;color:var(--mu2)">No sessions yet</td></tr>`}
          </tbody>
        </table>
      </div>

      <div class="ops-sec">
        <div class="ops-sec-hd"><span class="ops-sec-title">Active Deals (${activeDeals.length})</span></div>
        <table class="ops-table">
          <thead><tr><th>ID</th><th>Product</th><th>Status</th></tr></thead>
          <tbody>
            ${activeDeals.length ? activeDeals.slice(0, 6).map(d => `<tr>
              <td class="mono" style="font-size:11px;color:var(--mu)">#${esc(d.id)}</td>
              <td>${esc(d.products?.name || 'Custom')}</td>
              <td>${esc(d.sales_status || d.fulfillment_stage || '—')}</td>
            </tr>`).join('') : `<tr><td colspan="3" style="text-align:center;color:var(--mu2)">No active deals</td></tr>`}
          </tbody>
        </table>
      </div>

      <div class="ops-actions">
        <button class="btn-sm" onclick="opsClientEditMode=true;renderOpsClientDetail()">Edit Client</button>
        <button class="ops-link-btn" onclick="viewClientInSales()">View in Sales</button>
      </div>
    </div>`
}

async function saveOpsClientEdits() {
  if (!selectedOpsClientId) return
  const full_name = document.getElementById('ops-edit-name')?.value.trim() || ''
  if (!full_name) {
    showToast('Client name is required', 'info')
    return
  }
  const payload = {
    full_name,
    email: document.getElementById('ops-edit-email')?.value.trim() || null,
    phone: document.getElementById('ops-edit-phone')?.value.trim() || null,
    client_kind: document.getElementById('ops-edit-kind')?.value || 'private',
    company: document.getElementById('ops-edit-company')?.value.trim() || null,
    source: document.getElementById('ops-edit-source')?.value.trim() || null,
    notes: document.getElementById('ops-edit-notes')?.value.trim() || null,
    active: document.getElementById('ops-edit-active')?.value === 'true',
  }

  try {
    const updated = await updateClient(selectedOpsClientId, payload)
    opsClientEditMode = false
    if (isDummyMode()) {
      OPS_CLIENTS = OPS_CLIENTS.map(c => c.id === selectedOpsClientId ? mapClient({ ...c, ...updated, ...payload }) : c)
      selectedOpsClientDetail = { ...selectedOpsClientDetail, ...payload }
      renderStudentList()
      renderOpsClientDetail()
    } else {
      await loadData()
    }
    showToast('Client updated', 'success')
  } catch (err) {
    showToast('Failed to update client: ' + err.message, 'warn')
  }
}

async function assignSelectedVendorToClient() {
  const selectEl = document.getElementById('ops-assign-vendor')
  const vendorId = selectEl?.value
  if (!selectedOpsClientId || !vendorId) {
    showToast('Select a vendor first', 'info')
    return
  }
  try {
    await assignClientToVendor(vendorId, selectedOpsClientId)
    if (isDummyMode()) {
      const vendor = OPS_VENDORS.find(v => v.id === vendorId)
      if (vendor && selectedOpsClientDetail) {
        const current = selectedOpsClientDetail.vendor_clients || []
        selectedOpsClientDetail.vendor_clients = [...current, { vendor_id: vendorId, vendors: vendor }]
        OPS_CLIENTS = OPS_CLIENTS.map(c => c.id === selectedOpsClientId ? { ...c, vendors: [...(c.vendors || []), vendor] } : c)
      }
      renderStudentList()
      renderOpsClientDetail()
    } else {
      await loadData()
    }
    showToast('Vendor assigned', 'success')
  } catch (err) {
    showToast('Failed to assign vendor: ' + err.message, 'warn')
  }
}

async function unassignVendorFromClient(vendorId) {
  if (!selectedOpsClientId || !vendorId) return
  try {
    await unassignClientFromVendor(vendorId, selectedOpsClientId)
    if (isDummyMode()) {
      if (selectedOpsClientDetail) {
        selectedOpsClientDetail.vendor_clients = (selectedOpsClientDetail.vendor_clients || [])
          .filter(vc => (vc.vendor_id || vc.vendors?.id) !== vendorId)
      }
      OPS_CLIENTS = OPS_CLIENTS.map(c => c.id === selectedOpsClientId
        ? { ...c, vendors: (c.vendors || []).filter(v => v.id !== vendorId) }
        : c
      )
      renderStudentList()
      renderOpsClientDetail()
    } else {
      await loadData()
    }
    showToast('Vendor unassigned', 'info')
  } catch (err) {
    showToast('Failed to unassign vendor: ' + err.message, 'warn')
  }
}

function viewClientInSales() {
  if (!selectedOpsClientId) return
  window.open(`deals.html?page=clients&clientId=${encodeURIComponent(selectedOpsClientId)}`, '_self')
}

function openOpsClientModal() {
  document.getElementById('ops-new-full-name').value = ''
  document.getElementById('ops-new-email').value = ''
  document.getElementById('ops-new-phone').value = ''
  document.getElementById('ops-new-kind').value = 'private'
  document.getElementById('ops-new-company').value = ''
  document.getElementById('ops-new-source').value = ''
  document.getElementById('ops-new-notes').value = ''
  toggleOpsNewCompany('private')
  document.getElementById('ops-client-modal').classList.add('open')
}

function closeOpsClientModal() {
  document.getElementById('ops-client-modal').classList.remove('open')
}

function toggleOpsNewCompany(kind) {
  const wrap = document.getElementById('ops-new-company-wrap')
  if (!wrap) return
  wrap.style.display = kind === 'corporate' ? 'block' : 'none'
}

async function submitOpsClient() {
  const full_name = document.getElementById('ops-new-full-name')?.value.trim()
  if (!full_name) {
    showToast('Full name is required', 'info')
    return
  }

  const payload = {
    full_name,
    email: document.getElementById('ops-new-email')?.value.trim() || null,
    phone: document.getElementById('ops-new-phone')?.value.trim() || null,
    client_kind: document.getElementById('ops-new-kind')?.value || 'private',
    company: document.getElementById('ops-new-company')?.value.trim() || null,
    source: document.getElementById('ops-new-source')?.value || null,
    notes: document.getElementById('ops-new-notes')?.value.trim() || null,
    active: true,
  }

  try {
    const created = await createClient(payload)
    closeOpsClientModal()
    switchPage('clients')
    if (isDummyMode()) {
      const localClient = mapClient({
        ...created,
        ...payload,
        deals: [],
        vendors: [],
        dealCount: 0,
        totalValue: 0,
      })
      OPS_CLIENTS = [localClient, ...OPS_CLIENTS]
      selectedOpsClientId = localClient.id
      selectedOpsClientDetail = { ...localClient, vendor_clients: [], deals: [], sessions: [] }
      renderStudentList()
      renderOpsClientDetail()
    } else {
      await loadData()
      await selectStudent(created.id, { keepPage: true })
    }
    showToast('Client created', 'success')
    setTimeout(() => document.getElementById('ops-assign-vendor')?.focus(), 0)
  } catch (err) {
    showToast('Failed to create client: ' + err.message, 'warn')
  }
}

async function openOpsClientFromNavigation(clientId) {
  if (!clientId) return
  switchPage('clients')
  const found = OPS_CLIENTS.find(c => c.id === clientId)
  if (!found) {
    showToast('Client not found in Operations list', 'info')
    return
  }
  await selectStudent(clientId, { keepPage: true })
}

// ── Student (client) profile panel ───────────────────────────
function openCp(id) {
  const s = STUDENTS.find(x => x.id === id) || OPS_CLIENTS.find(x => x.id === id);
  if(!s) return;
  document.getElementById('cp-body').innerHTML = `
    <div class="sp-av-row">
      <div class="sp-av" style="background:${s.colorBg};color:${s.color}">${s.initials}</div>
      <div>
        <div class="sp-name">${s.name}</div>
        ${s.company ? `<div class="sp-detail">${s.company}</div>` : ''}
        <div class="sp-detail">${s.email}</div>
      </div>
    </div>
    <div class="sp-sec">
      <div class="sp-sec-t">Details</div>
      <div class="sp-row"><span class="sp-rl">Level</span><span>${s.level}</span></div>
      <div class="sp-row"><span class="sp-rl">Package</span><span class="mono">${s.sessionsRemaining}/${s.packageSize} remaining</span></div>
      <div class="sp-row"><span class="sp-rl">Status</span><span class="badge ${s.paymentStatus}"><span class="bdot"></span>${s.paymentStatus}</span></div>
    </div>
    <div class="sp-sec">
      <div class="sp-sec-t">Integrations</div>
      <div class="int-row"><div class="int-l"><div class="int-d" style="background:#e05a5a"></div>ActiveCampaign</div><span class="ist conn">connected</span></div>
      <div class="int-row"><div class="int-l"><div class="int-d" style="background:#5a9de0"></div>Stripe</div><span class="ist ${s.paymentStatus==='active'?'conn':'pend'}">${s.paymentStatus==='active'?'connected':'pending'}</span></div>
      <div class="int-row"><div class="int-l"><div class="int-d" style="background:#e0a040"></div>Mighty Network</div><span class="ist na">not set</span></div>
    </div>
    <div class="sp-sec">
      <div class="sp-sec-t">Quick actions</div>
      <div style="padding:8px;display:flex;flex-direction:column;gap:5px">
        <button class="sp-btn" onclick="showToast('Opening ActiveCampaign…','info')">↗ Open in ActiveCampaign</button>
        <button class="sp-btn" onclick="showToast('Opening Stripe…','info')">↗ View in Stripe</button>
      </div>
    </div>`;
  document.getElementById('cp-ov').classList.add('open');
  document.getElementById('cp-panel').classList.add('open');
}
function closeCp() {
  document.getElementById('cp-ov').classList.remove('open');
  document.getElementById('cp-panel').classList.remove('open');
}

// ── Vendor profile panel ──────────────────────────────────────
function openVendorProfile() {
  const v = VENDOR_PROFILE || {};
  document.getElementById('vp-body').innerHTML = `
    <div class="vp-hero">
      <div class="vp-av">${v.initials}</div>
      <div>
        <div class="vp-name">${v.name}</div>
        <div class="vp-role">${v.role}</div>
        <div class="vp-email">${v.email}</div>
      </div>
    </div>

    <div class="sp-sec">
      <div class="sp-sec-t">Personal Details</div>
      <div class="sp-row"><span class="sp-rl">Phone</span><span class="mono">${v.phone}</span></div>
      <div class="sp-row"><span class="sp-rl">Email</span><span class="mono">${v.email}</span></div>
      <div class="sp-row"><span class="sp-rl">Role</span><span>${v.role}</span></div>
    </div>

    <div class="sp-sec">
      <div class="sp-sec-t">Bank &amp; Payment</div>
      <div class="sp-row"><span class="sp-rl">Bank</span><span>${v.bank}</span></div>
      <div class="sp-row"><span class="sp-rl">IBAN</span><span class="mono" style="font-size:10px">${v.iban}</span></div>
    </div>

    <div class="sp-sec">
      <div class="sp-sec-t">My Rates</div>
      <div class="readonly-note" style="border-radius:0;border-left:none;border-right:none;border-top:none">🔒 Set by admin. Contact your admin to request changes.</div>
      ${v.rates.map(r=>`
      <div class="rate-row">
        <span class="rate-type">${r.type}</span>
        <span class="rate-val">${r.currency} ${r.rate}/hr</span>
      </div>`).join('')}
    </div>

    <div class="sp-sec">
      <div class="sp-sec-t">Calendar</div>
      <div class="sp-row"><span class="sp-rl">Booking link</span><span class="mono" style="color:var(--bl)">${v.calLink}</span></div>
    </div>

    <div style="padding:4px 0 2px">
      <div class="readonly-note" style="border-radius:var(--rs);border:1px solid var(--b)">To edit your profile, contact your admin or use the admin panel.</div>
    </div>`;
  document.getElementById('vp-ov').classList.add('open');
  document.getElementById('vp-panel').classList.add('open');
}
function closeVendorProfile() {
  document.getElementById('vp-ov').classList.remove('open');
  document.getElementById('vp-panel').classList.remove('open');
}

const PC_LABELS_W = {draft:'Draft',ready:'Ready for payment',pending:'Pending',paid:'Paid'}

// ── Payments ──────────────────────────────────────────────────

async function renderPayments() {
  const now = new Date()
  const currentMonth = now.toISOString().slice(0, 7)
  const currentPaycheck = VENDOR_PAYCHECKS.find(pc => pc.month === currentMonth)
  const isSealed = !!currentPaycheck

  const userRole = await getUserRole().catch(() => null)
  const canSeal = userRole === 'manager' || userRole === 'admin'

  // Summary pills
  const paid = VENDOR_PAYCHECKS.filter(x => x.status === 'paid')
  const totalPaid = paid.reduce((s, x) => s + (x.amount || 0), 0)
  const pendingPcs = VENDOR_PAYCHECKS.filter(x => x.status !== 'paid')
  document.getElementById('pay-summary').innerHTML = `
    <div class="sum-pill"><div class="sum-val">€${totalPaid.toLocaleString()}</div><div class="sum-lbl">Total received</div></div>
    <div class="sum-pill"><div class="sum-val">${VENDOR_PAYCHECKS.reduce((s, x) => s + (x.totalHours || 0), 0)}h</div><div class="sum-lbl">Total hours logged</div></div>
    <div class="sum-pill"><div class="sum-val" style="color:var(--am)">${pendingPcs.length}</div><div class="sum-lbl">Pending paychecks</div></div>`

  // Current month calc box
  const monthLabel = now.toLocaleDateString('en', { month: 'long', year: 'numeric' })
  let calcHtml = ''

  if (!isSealed) {
    // Calculate live from sessions
    const monthSessions = SESSIONS.filter(s => (s.date || '').startsWith(currentMonth))
    const breakdown = {}
    let liveTotal = 0
    monthSessions.forEach(s => {
      const rateObj = (VENDOR_PROFILE?.rates || []).find(r => r.session_type === s.type)
      const rate = parseFloat(rateObj?.rate || 0)
      const amount = (s.hours || 0) * rate
      if (!breakdown[s.type]) breakdown[s.type] = { hours: 0, rate, amount: 0 }
      breakdown[s.type].hours += s.hours || 0
      breakdown[s.type].amount += amount
      liveTotal += amount
    })
    const rowsHtml = Object.entries(breakdown).length
      ? Object.entries(breakdown).map(([type, b]) => `
          <tr>
            <td>${type}</td>
            <td class="mono">${b.hours}h</td>
            <td class="mono">€${b.rate}</td>
            <td class="mono">€${(b.amount || 0).toLocaleString()}</td>
          </tr>`).join('')
      : `<tr><td colspan="4" style="text-align:center;color:var(--mu2)">No sessions this month yet</td></tr>`

    calcHtml = `
      <div class="current-calc-box">
        <div class="calc-header">
          <span class="calc-title">${monthLabel} — OPEN</span>
          ${canSeal ? `<button class="btn-primary-sm" onclick="sealCurrentMonth()">Seal &amp; Generate Report</button>` : ''}
        </div>
        <table class="calc-table">
          <thead><tr><th>Type</th><th>Hours</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="calc-total">Total: €${liveTotal.toLocaleString()}</div>
      </div>`
  } else {
    const canRecalc = canSeal && currentPaycheck.status !== 'paid'
    calcHtml = `
      <div class="current-calc-box sealed">
        <div class="calc-header">
          <span class="calc-title">${monthLabel} — SEALED ✓</span>
          ${canRecalc ? `<button class="btn-secondary-sm" onclick="recalcCurrentMonth('${currentPaycheck.id}')">Recalculate</button>` : ''}
        </div>
        <div class="paycheck-summary">
          <div>Paycheck <span class="mono">#${currentPaycheck.id.slice(0, 8)}</span></div>
          <div>Status: <span class="pc-pill ${currentPaycheck.status}">${PC_LABELS_W[currentPaycheck.status] || currentPaycheck.status}</span></div>
          <div>Amount: €${(currentPaycheck.amount || 0).toLocaleString()} (${currentPaycheck.totalHours}h)</div>
        </div>
      </div>`
  }

  // Insert/replace calc box before the block
  const payPage = document.getElementById('page-payments')
  const existingCalc = payPage.querySelector('.current-calc-box')
  if (existingCalc) existingCalc.remove()
  const calcDiv = document.createElement('div')
  calcDiv.innerHTML = calcHtml
  const blockEl = payPage.querySelector('.block')
  if (blockEl) payPage.insertBefore(calcDiv.firstElementChild, blockEl)

  // Paycheck history table
  document.getElementById('pay-tbody').innerHTML = VENDOR_PAYCHECKS.map(pc => {
    const [y, m] = pc.month.split('-')
    const label = new Date(+y, +m - 1, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })
    return `<tr>
      <td style="font-weight:500">${label}</td>
      <td class="mono" style="color:var(--mu)">${pc.totalHours}h</td>
      <td class="mono" style="color:var(--ac)">€${(pc.amount || 0).toLocaleString()}</td>
      <td style="color:var(--mu)">${pc.currency}</td>
      <td><span class="pc-pill ${pc.status}">${PC_LABELS_W[pc.status] || pc.status}</span></td>
      <td class="mono" style="color:var(--mu2);font-size:11px">${pc.paymentDate || '—'}</td>
      <td><button class="btn-sm" onclick="viewPaycheckDetail('${pc.id}')">View</button></td>
    </tr>`
  }).join('')

  // Hide legacy generate button (replaced by seal button in calc box)
  const genWrap = document.getElementById('pay-gen-btn-wrap')
  if (genWrap) genWrap.style.display = 'none'
}

async function sealCurrentMonth() {
  const vendorId = VENDOR_PROFILE?.id
  if (!vendorId) { showToast('No vendor profile loaded', 'warn'); return }
  const month = new Date().toISOString().slice(0, 7)
  try {
    await sealMonthPaycheck(vendorId, month)
    await loadData()
    showToast('Month sealed & paycheck generated', 'success')
  } catch (err) {
    showToast('Error sealing month: ' + err.message, 'warn')
  }
}

async function recalcCurrentMonth(paycheckId) {
  try {
    await recalculatePaycheck(paycheckId)
    await loadData()
    showToast('Paycheck recalculated', 'success')
  } catch (err) {
    showToast('Error recalculating: ' + err.message, 'warn')
  }
}

function viewPaycheckDetail(paycheckId) {
  const pc = VENDOR_PAYCHECKS.find(p => p.id === paycheckId)
  if (!pc) return

  let breakdown = {}
  try { breakdown = pc.breakdown || JSON.parse(pc.notes || '{}') } catch {}

  const breakdownHtml = Object.entries(breakdown).length
    ? Object.entries(breakdown).map(([type, b]) => `
        <tr>
          <td>${type}</td>
          <td class="mono">${b.hours}h</td>
          <td class="mono">€${b.rate}</td>
          <td class="mono">€${(b.amount || 0).toLocaleString()}</td>
        </tr>`).join('')
    : `<tr><td colspan="4" style="text-align:center;color:var(--mu2)">No breakdown data</td></tr>`

  const [y, m] = pc.month.split('-')
  const monthLabel = new Date(+y, +m - 1, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })

  // Remove any existing paycheck modal first
  document.querySelectorAll('.pc-modal-ov, .pc-modal-panel').forEach(el => el.remove())

  const ovEl = document.createElement('div')
  ovEl.className = 'modal-overlay pc-modal-ov'
  ovEl.onclick = closePaycheckModal

  const panelEl = document.createElement('div')
  panelEl.className = 'modal-panel pc-modal-panel'
  panelEl.innerHTML = `
    <div class="modal-header">
      <span>Paycheck — ${monthLabel}</span>
      <button onclick="closePaycheckModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="pc-detail-meta">
        <div>Status: <span class="pc-pill ${pc.status}">${PC_LABELS_W[pc.status] || pc.status}</span></div>
        <div>Total: <strong>€${(pc.amount || 0).toLocaleString()}</strong> (${pc.totalHours}h)</div>
        ${pc.paymentDate ? `<div>Paid on: ${pc.paymentDate}</div>` : ''}
      </div>
      <table class="calc-table">
        <thead><tr><th>Type</th><th>Hours</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>${breakdownHtml}</tbody>
      </table>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closePaycheckModal()">Close</button>
    </div>`

  document.body.appendChild(ovEl)
  document.body.appendChild(panelEl)
  // Trigger open animation
  requestAnimationFrame(() => {
    ovEl.classList.add('open')
    panelEl.classList.add('open')
  })
}

function closePaycheckModal() {
  document.querySelectorAll('.pc-modal-ov, .pc-modal-panel').forEach(el => el.remove())
}

async function handleGeneratePaycheck() {
  // Legacy: delegate to sealCurrentMonth
  await sealCurrentMonth()
}

// ── Session detail modal ──────────────────────────────────────
let editingSession = null

async function openSessionDetail(sessionId) {
  editingSession = SESSIONS.find(s => s.id === sessionId)
  if (!editingSession) return

  // Populate type dropdown from vendor rates
  const typeSelect = document.getElementById('edit-type')
  if (VENDOR_PROFILE?.rates?.length) {
    typeSelect.innerHTML = VENDOR_PROFILE.rates.map(r => {
      const name = r.session_type.charAt(0).toUpperCase() + r.session_type.slice(1)
      return `<option value="${r.session_type}">${name}</option>`
    }).join('')
  } else {
    typeSelect.innerHTML = `
      <option value="coaching">Coaching</option>
      <option value="consulting">Consulting</option>
      <option value="admin">Admin</option>
      <option value="editing">Editing</option>
      <option value="design">Design</option>
      <option value="other">Other</option>`
  }

  document.getElementById('edit-entity-label').textContent = editingSession.entity || '—'
  document.getElementById('edit-date').value = editingSession.date || ''
  document.getElementById('edit-time').value = editingSession.start_time || ''
  document.getElementById('edit-duration').value = editingSession.hours || 1
  document.getElementById('edit-type').value = editingSession.type || ''
  document.getElementById('edit-status').value = editingSession.status || 'done'
  document.getElementById('edit-notes').value = editingSession.notes || ''

  // Permission check: vendor can only edit current month
  const sessionMonth = (editingSession.date || '').slice(0, 7)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const userRole = await getUserRole().catch(() => null)
  const canEdit = userRole === 'manager' || userRole === 'admin' || sessionMonth === currentMonth

  const inputs = document.querySelectorAll('#session-modal input, #session-modal select, #session-modal textarea')
  inputs.forEach(el => el.disabled = !canEdit)
  document.getElementById('session-modal-footer').style.display = canEdit ? '' : 'none'

  document.getElementById('session-modal-ov').classList.add('open')
  document.getElementById('session-modal').classList.add('open')
}

async function saveSessionEdit() {
  if (!editingSession) return
  const data = {
    date:           document.getElementById('edit-date').value,
    start_time:     document.getElementById('edit-time').value || null,
    hours:          parseFloat(document.getElementById('edit-duration').value),
    session_type:   document.getElementById('edit-type').value,
    status:         document.getElementById('edit-status').value,
    notes:          document.getElementById('edit-notes').value || null,
  }
  try {
    await updateVendorHour(editingSession.id, data)
    await loadData()
    closeSessionModal()
    showToast('Session updated', 'success')
  } catch (err) {
    showToast('Error saving session: ' + err.message, 'warn')
  }
}

function closeSessionModal() {
  document.getElementById('session-modal-ov').classList.remove('open')
  document.getElementById('session-modal').classList.remove('open')
  editingSession = null
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.className = 'toast ' + type;
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

function readOpsRouteContext() {
  const params = new URLSearchParams(window.location.search)
  const pageParam = (params.get('page') || '').toLowerCase()
  if (['workload','clients','students','payments'].includes(pageParam)) {
    currentPage = pageParam === 'students' ? 'clients' : pageParam
  }
  const clientId = params.get('clientId')
  if (clientId) pendingOpsClientId = clientId
}

document.addEventListener('DOMContentLoaded', async () => {
  readOpsRouteContext()
  // Still run init() for UI setup (date/time fields)
  init()
  if (currentPage !== 'workload') switchPage(currentPage)
  const modal = document.getElementById('ops-client-modal')
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeOpsClientModal()
    })
  }
  await loadData()
})
