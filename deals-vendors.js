// deals-vendors.js — vendors page

const TYPE_LABELS = {
  coach: 'Coach', contractor: 'Contractor', team_member: 'Team Member',
  subscription: 'Subscription', software_saas: 'Software & SaaS',
}
const TYPE_ORDER  = ['coach', 'contractor', 'team_member', 'subscription', 'software_saas']
const TYPE_PILL_COLOR = {
  coach:        'background:var(--green-bg);color:var(--green-text)',
  contractor:   'background:var(--blue-bg);color:var(--blue-text)',
  team_member:  'background:var(--purple-bg);color:var(--purple-text)',
  subscription: 'background:var(--amber-bg);color:var(--amber-text)',
  software_saas:'background:var(--bg);color:var(--mu)',
}

// types that don't need personal/banking fields
const SAAS_TYPES = new Set(['subscription', 'software_saas'])

function _currentRole() {
  return (sessionStorage.getItem('demoRole') || 'admin').toLowerCase()
}

function _canSeePayments() {
  const role = _currentRole()
  return role === 'finance' || role === 'admin'
}

function filteredVendors() {
  const pool = _vendorListTab === 'archived' ? _vendorsInactive : _vendors
  let v = [...pool]
  if (_vendorSearch) {
    const q = _vendorSearch.toLowerCase()
    v = v.filter(x => x.full_name.toLowerCase().includes(q) || (x.email || '').toLowerCase().includes(q))
  }
  if (_fVendorType)     v = v.filter(x => x.vendor_type === _fVendorType)
  if (_fVendorCurrency) v = v.filter(x => (x.preferred_currency || x.payout_currency || 'EUR') === _fVendorCurrency)
  if (_fVendorManager)  v = v.filter(x => x.manager_id === _fVendorManager)
  return v
}

function switchVendorListTab(tab, btn) {
  _vendorListTab = tab
  document.querySelectorAll('#vtab-active, #vtab-archived').forEach(b => b.classList.remove('cur'))
  btn.classList.add('cur')
  clearVendorDetail()
  renderVendors()
}
window.switchVendorListTab = switchVendorListTab

function setVendorSearch(q) { _vendorSearch = q.toLowerCase(); renderVendors() }
function setFilterVendorType(v) { _fVendorType = v; renderVendors() }
function setFilterVendorCurrency(v) { _fVendorCurrency = v; renderVendors() }
function setFilterVendorManager(v) { _fVendorManager = v; renderVendors() }
window.setVendorSearch = setVendorSearch
window.setFilterVendorType = setFilterVendorType
window.setFilterVendorCurrency = setFilterVendorCurrency
window.setFilterVendorManager = setFilterVendorManager

function _vendorAvatar(v, size = 'av-sm') {
  if (v.profile_picture_url) {
    const dimMap = { 'av-xl': '64px', 'av-lg': '44px', 'av-md': '36px', 'av-sm': '28px' }
    const dim = dimMap[size] || '28px'
    return `<img src="${escHtml(v.profile_picture_url)}" style="width:${dim};height:${dim};border-radius:50%;object-fit:cover;flex-shrink:0">`
  }
  return `<div class="av ${size}" style="background:${avatarBg(v.full_name)};color:${avatarFg(v.full_name)}">${initials(v.full_name)}</div>`
}

function _vendorRateDisplay(v) {
  if (SAAS_TYPES.has(v.vendor_type)) {
    return '<span style="color:var(--mu2)">—</span>'
  }
  const rates = v.rates || []
  if (!rates.length) return '<span style="color:var(--mu2)">—</span>'
  const r = rates[0]
  const sym = SYM[r.currency] || ''
  return `<span style="font-family:var(--font-mono);font-size:12px">${sym}${parseFloat(r.rate).toLocaleString('en', { minimumFractionDigits: 0 })} <span style="font-size:10px;color:var(--mu2)">${r.currency || ''}</span></span>`
}

function _vendorRow(v) {
  const isSel = _selVendorId === v.id
  const isSaas = SAAS_TYPES.has(v.vendor_type)
  const clientCount = (v.clients || []).length
  const curr = v.preferred_currency || v.payout_currency || v.currency || 'EUR'
  const typePill = TYPE_LABELS[v.vendor_type]
    ? `<span class="pill" style="${TYPE_PILL_COLOR[v.vendor_type] || ''};font-size:10px">${TYPE_LABELS[v.vendor_type]}</span>`
    : '<span style="color:var(--mu2)">—</span>'

  return `
    <tr onclick="openVendorDetail('${v.id}')" style="${isSel ? 'background:var(--bg);' : ''}cursor:pointer">
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          ${_vendorAvatar(v)}
          <div>
            <div style="font-weight:500">${escHtml(v.full_name)}</div>
            ${v.email ? `<div style="font-size:11px;color:var(--mu2)">${escHtml(v.email)}</div>` : ''}
          </div>
        </div>
      </td>
      <td>${typePill}</td>
      <td><span class="pill" style="background:var(--bg);color:var(--mu);font-size:10px">${escHtml(curr)}</span></td>
      <td>${_vendorRateDisplay(v)}</td>
      <td style="color:var(--mu)">
        ${isSaas ? '<span style="color:var(--mu2)">—</span>' : `${clientCount} client${clientCount !== 1 ? 's' : ''}`}
      </td>
    </tr>
  `
}

function _groupHeaderRow(label, count, colspan = 5) {
  return `
    <tr style="pointer-events:none;user-select:none">
      <td colspan="${colspan}" style="padding:14px 10px 6px;border-bottom:1px solid var(--border2)">
        <span style="font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.12em;color:var(--mu2);font-weight:600">${label}</span>
        <span style="font-size:10px;font-family:var(--font-mono);color:var(--mu2);margin-left:6px">${count}</span>
      </td>
    </tr>
  `
}

function renderVendors() {
  const tbody = document.getElementById('vendors-tbody')
  if (!tbody) return
  const vendors = filteredVendors()

  const activeCount = _vendors.length
  const archivedCount = _vendorsInactive.length
  const activeCountEl = document.getElementById('vtab-active-count')
  const archivedCountEl = document.getElementById('vtab-archived-count')
  if (activeCountEl) activeCountEl.textContent = activeCount
  if (archivedCountEl) archivedCountEl.textContent = archivedCount

  if (!vendors.length) {
    const pool = _vendorListTab === 'archived' ? _vendorsInactive : _vendors
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--mu2);padding:24px">${pool.length ? 'No vendors match filters' : (_vendorListTab === 'archived' ? 'No archived vendors' : 'No vendors')}</td></tr>`
    _syncVendorManagerFilter()
    return
  }

  const grouped = {}
  for (const type of TYPE_ORDER) grouped[type] = []
  grouped._other = []
  for (const v of vendors) {
    if (grouped[v.vendor_type] !== undefined) grouped[v.vendor_type].push(v)
    else grouped._other.push(v)
  }

  let html = ''
  for (const type of TYPE_ORDER) {
    const group = grouped[type]
    if (!group.length) continue
    html += _groupHeaderRow(TYPE_LABELS[type] || type, group.length)
    html += group.map(_vendorRow).join('')
  }
  if (grouped._other.length) {
    html += _groupHeaderRow('Other', grouped._other.length)
    html += grouped._other.map(_vendorRow).join('')
  }

  tbody.innerHTML = html
  _syncVendorManagerFilter()
}

function _syncVendorManagerFilter() {
  const sel = document.getElementById('filter-vendor-manager')
  if (!sel) return
  const cur = sel.value
  const managerIds = new Set(_vendors.filter(v => v.manager_id).map(v => v.manager_id))
  const managers = _vendors.filter(v => managerIds.has(v.id))
  sel.innerHTML = `<option value="">All managers</option>` +
    managers.map(m => `<option value="${m.id}"${cur === m.id ? ' selected' : ''}>${escHtml(m.full_name)}</option>`).join('')
}

async function openVendorDetail(id) {
  if (!id) return
  if (window.Router && !_routerDispatching) {
    Router.open({ entity: 'vendor', id, view: 'panel', from: 'list' })
    return
  }
  if (window.SidePanel?.open) { window.SidePanel.open('vendor', { id }); return }
  if (window.PanelManager?.open) {
    window.PanelManager.open('vendor', id)
    return
  }

  _selVendorId = id
  _vendorTab = 'profile'
  _vendorEditMode = false
  _vendorEditSnapshot = null

  const detail = document.getElementById('vendor-detail')
  if (detail) {
    detail.innerHTML = `<div style="padding:18px;color:var(--mu2);font-size:12px">Loading vendor…</div>`
  }

  try {
    _vendorPaychecks = await getPaychecks({ vendor_id: id })
  } catch (err) {
    console.warn('[VendorDetail] paychecks load failed:', err?.message || err)
    _vendorPaychecks = []
  }

  renderVendors()
  renderVendorDetail()
}
window.openVendorDetail = openVendorDetail

function clearVendorDetail() {
  _selVendorId = null
  _vendorPaychecks = []
  _vendorEditMode = false
  _vendorEditSnapshot = null
  const detail = document.getElementById('vendor-detail')
  if (detail) {
    detail.innerHTML = `<div class="empty"><div class="empty-icon">◻</div><div>Select a vendor</div></div>`
  }
  renderVendors()
  if (window.Router && !_routerDispatching && Router.getParams().entity === 'vendor') {
    Router.close()
  }
}
window.clearVendorDetail = clearVendorDetail

function switchVendorTab(tab, btn) {
  _vendorTab = tab
  _vendorEditMode = false
  _vendorEditSnapshot = null
  document.querySelectorAll('[id^="vdt-"]').forEach(b => b.classList.remove('btn-primary'))
  btn.classList.add('btn-primary')
  renderVendorDetail()
}
window.switchVendorTab = switchVendorTab

function enterVendorEditMode() {
  const v = _currentVendor()
  if (!v) return
  _vendorEditSnapshot = { ...v }
  _vendorEditMode = true
  renderVendorDetail()
}
window.enterVendorEditMode = enterVendorEditMode

function cancelVendorEdit() {
  _vendorEditMode = false
  _vendorEditSnapshot = null
  renderVendorDetail()
}
window.cancelVendorEdit = cancelVendorEdit

function _currentVendor() {
  return [..._vendors, ..._vendorsInactive].find(x => x.id === _selVendorId) || null
}

function renderVendorDetail() {
  const v = _currentVendor()
  if (!v) return
  const detail = document.getElementById('vendor-detail')
  const isSaas = SAAS_TYPES.has(v.vendor_type)
  const canPay = _canSeePayments()
  const isTeamMember = v.vendor_type === 'team_member'
  const showPayTab = !(isTeamMember && !canPay)

  const avatarHtml = `
    <div style="position:relative;display:inline-block;cursor:${_vendorEditMode ? 'pointer' : 'default'}"
      ${_vendorEditMode ? `onclick="triggerAvatarUpload('${v.id}')"` : ''}>
      ${_vendorAvatar(v, 'av-xl')}
      ${_vendorEditMode ? `
        <div style="position:absolute;inset:0;background:rgba(0,0,0,0.4);border-radius:50%;display:flex;align-items:center;justify-content:center;pointer-events:none">
          <span style="color:#fff;font-size:16px">📷</span>
        </div>
        <input type="file" id="ve-avatar-file" accept="image/*" style="display:none" onchange="onAvatarFileChange('${v.id}',this)">
      ` : ''}
    </div>
  `

  detail.innerHTML = `
    <div style="padding:20px 20px 12px;border-bottom:1px solid var(--border2);flex-shrink:0">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        ${avatarHtml}
        <div style="flex:1">
          <div style="font-family:var(--font-serif);font-size:18px;font-weight:700">${escHtml(v.full_name)}</div>
          <div style="font-size:11px;color:var(--mu2);margin-top:2px;font-family:var(--font-mono)">${TYPE_LABELS[v.vendor_type] || v.vendor_type || 'vendor'}</div>
        </div>
        ${_vendorTab === 'profile' ? (
          _vendorEditMode
            ? `<button class="btn btn-sm" onclick="cancelVendorEdit()">Cancel</button>`
            : `<div style="display:flex;gap:4px">
                <button class="btn btn-sm" onclick="enterVendorEditMode()">Edit</button>
                <button class="btn btn-sm" style="color:var(--red);border-color:var(--red)" onclick="deleteCurrentVendor()">Delete</button>
               </div>`
        ) : ''}
      </div>
      <div style="display:flex;gap:4px">
        <button class="btn btn-sm${_vendorTab === 'profile' ? ' btn-primary' : ''}" id="vdt-profile" onclick="switchVendorTab('profile',this)">Profile</button>
        ${showPayTab ? `<button class="btn btn-sm${_vendorTab === 'payments' ? ' btn-primary' : ''}" id="vdt-payments" onclick="switchVendorTab('payments',this)">Payments</button>` : ''}
        <button class="btn btn-sm${_vendorTab === 'clients' ? ' btn-primary' : ''}" id="vdt-clients" onclick="switchVendorTab('clients',this)">Clients</button>
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:16px 20px" id="vendor-detail-body"></div>
    ${_vendorTab === 'profile' && _vendorEditMode ? `
    <div style="padding:12px 20px;border-top:1px solid var(--border2);flex-shrink:0">
      <button class="btn btn-primary btn-sm" onclick="saveVendorProfile('${v.id}')">Save changes</button>
    </div>` : ''}
  `

  const body = document.getElementById('vendor-detail-body')

  if (_vendorTab === 'profile') {
    _renderVendorProfileTab(v, body, isSaas)
  } else if (_vendorTab === 'payments') {
    _renderVendorPaymentsTab(v, body)
  } else if (_vendorTab === 'clients') {
    _renderVendorClientsTab(v, body)
  }
}

function _renderVendorProfileTab(v, body, isSaas) {
  const em = _vendorEditMode

  const viewRow = (label, val) => `
    <div class="sp-row">
      <span class="sp-row-label">${label}</span>
      <span class="sp-row-val">${val || '<span style="color:var(--mu2)">—</span>'}</span>
    </div>`

  const sec = (title) => `<div style="font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.12em;color:var(--mu2);margin:18px 0 10px;padding-bottom:4px;border-bottom:1px solid var(--border2)">${title}</div>`
  const row2 = (a, b) => `<div class="form-row" style="margin-bottom:10px">${a}${b}</div>`
  const fi = (id, label, val, type='text', extra='') =>
    `<div class="fg"><label class="fl">${label}</label><input class="fi" id="${id}" type="${type}" value="${escHtml(val || '')}" ${extra}></div>`

  if (!em) {
    const curr = v.preferred_currency || v.payout_currency || v.currency || 'EUR'
    const rate = (v.rates || []).length
      ? (() => { const r = v.rates[0]; return `${SYM[r.currency]||''}${parseFloat(r.rate).toLocaleString('en')} ${r.currency}` })()
      : null

    body.innerHTML = `
      <div class="sp-section-title" style="margin-top:0">Basic info</div>
      ${viewRow('Email', v.email ? escHtml(v.email) : null)}
      ${viewRow('Phone', v.phone ? escHtml(v.phone) : null)}
      ${viewRow('Currency', curr)}
      ${!isSaas ? viewRow('Date of birth', v.date_of_birth ? formatDate(v.date_of_birth) : null) : ''}
      ${viewRow('Status', v.active !== false
        ? '<span class="pill active">Active</span>'
        : '<span class="pill cancelled">Inactive</span>')}
      ${v.website ? viewRow('Website', `<a href="${escHtml(v.website)}" target="_blank" style="color:var(--blue)">${escHtml(v.website)}</a>`) : ''}

      ${isSaas ? '' : `
        <div class="sp-section-title">Address</div>
        ${viewRow('Street', v.street ? escHtml(v.street) : null)}
        ${viewRow('City', v.city ? `${escHtml(v.city)}${v.zip_code ? ', '+escHtml(v.zip_code) : ''}` : null)}
        ${viewRow('Country', v.country ? escHtml(v.country) : null)}

        <div class="sp-section-title">Banking</div>
        ${viewRow('Bank', v.bank_name ? escHtml(v.bank_name) : null)}
        ${viewRow('IBAN', v.iban ? `<span class="mono" style="font-size:11px">${escHtml(v.iban)}</span>` : null)}
        ${viewRow('SWIFT', v.swift_code ? escHtml(v.swift_code) : null)}
        ${viewRow('Account', v.account_number ? escHtml(v.account_number) : null)}
        ${viewRow('Payment method', v.payment_method ? escHtml(v.payment_method) : null)}
        ${viewRow('Payout currency', v.payout_currency ? escHtml(v.payout_currency) : null)}
      `}

      ${v.notes ? `<div class="sp-section-title">Notes</div><div style="font-size:13px;color:var(--ink);white-space:pre-wrap">${escHtml(v.notes)}</div>` : ''}
    `
    return
  }

  const allManagers = [..._vendors, ..._vendorsInactive].filter(m => m.id !== v.id)

  body.innerHTML = `
    ${sec('Basic info')}
    ${row2(fi('ve-name','Full name', v.full_name), fi('ve-email','Email address', v.email, 'email'))}
    ${row2(fi('ve-phone','Phone number', v.phone), isSaas
      ? fi('ve-website','Website', v.website, 'url')
      : fi('ve-dob','Date of birth', v.date_of_birth, 'date')
    )}
    <div class="form-row" style="margin-bottom:10px">
      <div class="fg">
        <label class="fl">Vendor type</label>
        <select class="fi fsel" id="ve-type">
          ${TYPE_ORDER.map(t => `<option value="${t}"${v.vendor_type===t?' selected':''}>${TYPE_LABELS[t]}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <label class="fl">Status</label>
        <select class="fi fsel" id="ve-active">
          <option value="true"${v.active!==false?' selected':''}>Active</option>
          <option value="false"${v.active===false?' selected':''}>Inactive</option>
        </select>
      </div>
    </div>
    <div class="form-row" style="margin-bottom:10px">
      <div class="fg">
        <label class="fl">Currency</label>
        <input class="fi" id="ve-currency" value="${escHtml(v.preferred_currency || v.payout_currency || v.currency || '')}">
      </div>
      ${!isSaas ? `
      <div class="fg">
        <label class="fl">Manager</label>
        <select class="fi fsel" id="ve-manager">
          <option value="">— none —</option>
          ${allManagers.map(m => `<option value="${m.id}"${v.manager_id===m.id?' selected':''}>${escHtml(m.full_name)}</option>`).join('')}
        </select>
      </div>` : ''}
    </div>
    ${isSaas ? '' : `
      ${row2(fi('ve-nationality','Nationality', v.nationality), fi('ve-tax-id','EIN / SSN / ITIN / National ID', v.tax_id))}

      ${sec('Address')}
      ${fi('ve-street','Street', v.street)}
      <div style="margin-bottom:10px"></div>
      ${fi('ve-address-details','Additional details (apt, floor…)', v.address_details)}
      <div style="margin-bottom:10px"></div>
      ${row2(fi('ve-city','City', v.city), fi('ve-zip','Zip code', v.zip_code))}
      ${row2(fi('ve-state','State / Province', v.state), fi('ve-country','Country', v.country))}
      <div class="fg" style="margin-bottom:10px">
        <label class="fl">Residential address <span style="text-transform:none;letter-spacing:0;font-size:10px;color:var(--mu2)">(full free-text, if different)</span></label>
        <textarea class="fi" id="ve-residential" rows="2">${escHtml(v.residential_address || '')}</textarea>
      </div>

      ${sec('Banking')}
      ${row2(fi('ve-bank-name','Bank name', v.bank_name), fi('ve-account-holder','Account holder name', v.account_holder_name))}
      ${row2(fi('ve-account-number','Account number', v.account_number), fi('ve-routing-number','Routing number', v.routing_number))}
      ${row2(fi('ve-iban','IBAN', v.iban), fi('ve-swift','SWIFT code', v.swift_code))}
      ${row2(fi('ve-branch','Branch number', v.branch_number), fi('ve-payment-id','Payment ID (PayPal / Wise)', v.payment_id))}
      <div class="form-row" style="margin-bottom:10px">
        <div class="fg">
          <label class="fl">Payment method</label>
          <select class="fi fsel" id="ve-payment">
            ${['iban','paypal','wise','bank_transfer','other'].map(t => `<option value="${t}"${v.payment_method===t?' selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="fg">
          <label class="fl">Payout currency</label>
          <select class="fi fsel" id="ve-payout-currency">
            <option value="">— not set —</option>
            ${['EUR','USD','ILS','GBP','MULTI'].map(c => `<option value="${c}"${v.payout_currency===c?' selected':''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row" style="margin-bottom:10px">
        <div class="fg">
          <label class="fl">Paid by (company)</label>
          <select class="fi fsel" id="ve-paying-company">
            <option value="">— not assigned —</option>
            ${_companies.map(c => `<option value="${c.id}"${v.paying_company_id===c.id?' selected':''}>${escHtml(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>
    `}

    ${sec('Notes')}
    <div class="fg">
      <textarea class="fi" id="ve-notes" rows="3">${escHtml(v.notes || '')}</textarea>
    </div>
  `
}

async function _renderVendorPaymentsTab(v, body) {
  let latestBillHtml = ''
  try {
    const bill = await getLatestBillForVendor(v.id)
    if (bill) {
      const amt = bill.total_amount != null ? `${SYM[bill.currency]||''}${parseFloat(bill.total_amount).toLocaleString('en', { minimumFractionDigits: 2 })} ${bill.currency||''}` : '—'
      const dateStr = bill.created_at ? formatDate(bill.created_at.slice(0,10)) : '—'
      latestBillHtml = `
        <div style="background:var(--bg);border-radius:var(--r);padding:12px 14px;margin-bottom:16px">
          <div style="font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.12em;color:var(--mu2);margin-bottom:8px">Latest Bill</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:13px;color:var(--mu)">${dateStr}</span>
            <span class="pill ${bill.status}">${bill.status}</span>
            <span style="font-family:var(--font-mono);font-size:13px;font-weight:500">${amt}</span>
          </div>
          <div style="margin-top:8px">
            <button class="btn btn-sm" onclick="window.location.href='payments.html?bill=${encodeURIComponent(bill.id)}'">Open bill →</button>
          </div>
        </div>
      `
    } else {
      latestBillHtml = `<div style="font-size:12px;color:var(--mu2);margin-bottom:16px">No bills yet</div>`
    }
  } catch {
    latestBillHtml = ''
  }

  const paychecks = _vendorPaychecks
  if (!paychecks.length) {
    body.innerHTML = latestBillHtml + `<div style="color:var(--mu2);font-size:12px;padding:8px 0">No paychecks on record</div>`
    return
  }
  const totalPaid  = paychecks.filter(p => p.status === 'paid').reduce((s, p) => s + (parseFloat(p.actual_amount_paid ?? p.amount) || 0), 0)
  const totalHours = paychecks.reduce((s, p) => s + (parseFloat(p.total_hours ?? p.hours) || 0), 0)
  body.innerHTML = latestBillHtml + `
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <div class="stat-card" style="flex:1;padding:10px 12px">
        <div class="stat-val" style="font-size:22px">${totalPaid.toLocaleString('en', { maximumFractionDigits: 0 })}</div>
        <div class="stat-label">Total paid</div>
      </div>
      <div class="stat-card" style="flex:1;padding:10px 12px">
        <div class="stat-val" style="font-size:22px">${totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)}</div>
        <div class="stat-label">Total hours</div>
      </div>
    </div>
    <div class="block" style="overflow-y:auto;max-height:320px">
      <table class="tbl">
        <thead><tr><th>Month</th><th>Hours</th><th>Amount</th><th>Payout</th><th>Actual paid</th><th>Payment date</th><th>Status</th></tr></thead>
        <tbody>
          ${paychecks.map(p => {
            const amt = p.amount != null ? parseFloat(p.amount) : null
            const actualPaid = p.actual_amount_paid != null ? parseFloat(p.actual_amount_paid) : null
            const payoutAmt  = p.payout_amount    != null ? parseFloat(p.payout_amount)    : null
            const payoutCurr = p.payout_currency  || p.currency || 'EUR'
            const actualCurr = p.payout_currency  || p.currency || 'EUR'

            let actualHtml = '—'
            if (actualPaid != null) {
              const matches = amt != null && Math.abs(actualPaid - amt) < 0.01
              actualHtml = `<span class="mono" style="color:${matches ? 'var(--green)' : 'var(--amber)'}">${SYM[actualCurr] || ''}${actualPaid.toLocaleString('en', { minimumFractionDigits: 2 })}</span>`
            }

            const payoutHtml = payoutAmt != null
              ? `<span class="mono">${SYM[payoutCurr] || ''}${payoutAmt.toLocaleString('en', { minimumFractionDigits: 2 })} <span style="font-size:10px;color:var(--mu2)">${payoutCurr}</span></span>`
              : '—'

            const payDateHtml = p.payment_date
              ? `<span style="font-size:11px;color:var(--mu)">${formatDate(p.payment_date)}</span>`
              : '—'

            return `
            <tr style="cursor:pointer" onclick="openPaycheckDetail(${JSON.stringify(p).replace(/"/g,'&quot;')})">
              <td style="font-size:12px">${formatMonth(p.month)}</td>
              <td class="mono">${(p.total_hours ?? p.hours) ?? '—'}</td>
              <td class="mono">${amt != null ? (SYM[p.currency || 'EUR'] || '') + amt.toLocaleString('en', { minimumFractionDigits: 2 }) + ' <span style="font-size:10px;color:var(--mu2)">' + (p.currency || 'EUR') + '</span>' : '—'}</td>
              <td>${payoutHtml}</td>
              <td>${actualHtml}</td>
              <td>${payDateHtml}</td>
              <td><span class="pill ${p.status}">${p.status}</span></td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
  `
}

function openPaycheckDetail(p) {
  const amt       = p.amount        != null ? parseFloat(p.amount)        : null
  const payout    = p.payout_amount != null ? parseFloat(p.payout_amount) : null
  const actual    = p.actual_amount_paid != null ? parseFloat(p.actual_amount_paid) : null
  const sym       = c => SYM[c] || ''
  const fmtAmt    = (v, c) => v != null ? `${sym(c)}${v.toLocaleString('en', { minimumFractionDigits: 2 })} ${c}` : '—'

  const rows = [
    ['Month',        formatMonth(p.month)],
    ['Hours',        (p.total_hours ?? p.hours) ?? '—'],
    ['Amount',       fmtAmt(amt, p.currency || 'EUR')],
    ['Payout',       fmtAmt(payout, p.payout_currency || p.currency || 'EUR')],
    ['Actual paid',  fmtAmt(actual, p.payout_currency || p.currency || 'EUR')],
    ['Payment date', p.payment_date ? formatDate(p.payment_date) : '—'],
    ['Status',       `<span class="pill ${p.status}">${p.status}</span>`],
    ...(p.notes ? [['Notes', escHtml(p.notes)]] : []),
  ]

  const overlay = document.createElement('div')
  overlay.className = 'overlay open'
  overlay.style.cssText = 'z-index:300'
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:var(--r-lg);width:420px;padding:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-size:17px;font-weight:600">Paycheck — ${formatMonth(p.month)}</div>
        <button class="btn btn-sm" onclick="this.closest('.overlay').remove()">✕</button>
      </div>
      <table style="width:100%;border-collapse:collapse">
        ${rows.map(([label, val]) => `
          <tr>
            <td style="font-size:11px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.08em;color:var(--mu2);padding:7px 0;width:40%;border-bottom:1px solid var(--border2)">${label}</td>
            <td style="font-size:13px;color:var(--ink);padding:7px 0;border-bottom:1px solid var(--border2)">${val}</td>
          </tr>`).join('')}
      </table>
    </div>`
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })
  document.body.appendChild(overlay)
}
window.openPaycheckDetail = openPaycheckDetail

function _renderVendorClientsTab(v, body) {
  const assigned    = v.clients || []
  const assignedIds = new Set(assigned.map(c => c.id))
  const unassigned  = _clients.filter(c => !assignedIds.has(c.id))

  body.innerHTML = `
    <div style="font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);margin-bottom:10px">
      Assigned (${assigned.length})
    </div>
    <div id="vc-assigned-list">
      ${assigned.length ? assigned.map(c => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border2)">
          <div class="av av-sm" style="background:${avatarBg(c.full_name)};color:${avatarFg(c.full_name)};cursor:pointer"
               onclick="showClientDetail('${c.id}',event,'vendor-clients')">${initials(c.full_name)}</div>
          <div style="font-size:13px;flex:1;cursor:pointer;color:var(--ink)"
               onclick="showClientDetail('${c.id}',event,'vendor-clients')">${escHtml(c.full_name)}</div>
          <button class="btn btn-sm" style="color:var(--red);border-color:var(--red-bg);background:var(--red-bg)"
            onclick="unassignClient('${v.id}','${c.id}')">Remove</button>
        </div>
      `).join('') : `<div style="font-size:12px;color:var(--mu2);padding:6px 0 12px">No clients assigned</div>`}
    </div>

    ${unassigned.length ? `
    <div style="margin-top:16px;position:relative" id="vc-cs-wrap">
      <div style="font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);margin-bottom:6px">Add client</div>
      <div class="cs-trigger" id="vc-cs-trigger" onclick="vcCsToggle('${v.id}')">
        <span style="color:var(--mu2);font-size:13px">Search clients…</span>
        <span style="color:var(--mu2);font-size:11px;margin-left:auto">▾</span>
      </div>
      <div class="cs-dropdown" id="vc-cs-dropdown" style="display:none;z-index:200">
        <div style="padding:6px 8px;border-bottom:1px solid var(--border2)">
          <input class="fi" style="height:30px;font-size:12px" placeholder="Search…" id="vc-cs-search"
            oninput="vcCsFilter('${v.id}',this.value)" autocomplete="off">
        </div>
        <div class="cs-list" id="vc-cs-list">
          ${unassigned.map(c => `
            <div class="cs-item" onclick="assignClient('${v.id}','${c.id}')">
              <div class="av av-sm" style="background:${avatarBg(c.full_name)};color:${avatarFg(c.full_name)}">${initials(c.full_name)}</div>
              <div>
                <div class="cs-item-name">${escHtml(c.full_name)}</div>
                ${c.email ? `<div class="cs-item-sub">${escHtml(c.email)}</div>` : ''}
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>` : `<div style="font-size:12px;color:var(--mu2);padding:6px 0;margin-top:16px">All clients already assigned</div>`}
  `
}

function _fiVal(id) {
  const el = document.getElementById(id)
  return el ? (el.value.trim() || null) : null
}

async function saveVendorProfile(id) {
  const isSaas = SAAS_TYPES.has(document.getElementById('ve-type')?.value)
  const fields = {
    full_name:            _fiVal('ve-name'),
    email:                _fiVal('ve-email'),
    phone:                _fiVal('ve-phone'),
    ...(isSaas ? { website: _fiVal('ve-website') } : { date_of_birth: _fiVal('ve-dob') }),
    vendor_type:          _fiVal('ve-type'),
    active:               document.getElementById('ve-active')?.value === 'true',
    manager_id:           _fiVal('ve-manager'),
    currency:             _fiVal('ve-currency'),
    preferred_currency:   _fiVal('ve-currency'),
    notes:                _fiVal('ve-notes'),
    ...(!isSaas ? {
      nationality:          _fiVal('ve-nationality'),
      tax_id:               _fiVal('ve-tax-id'),
      street:               _fiVal('ve-street'),
      address_details:      _fiVal('ve-address-details'),
      city:                 _fiVal('ve-city'),
      zip_code:             _fiVal('ve-zip'),
      state:                _fiVal('ve-state'),
      country:              _fiVal('ve-country'),
      residential_address:  _fiVal('ve-residential'),
      bank_name:            _fiVal('ve-bank-name'),
      account_holder_name:  _fiVal('ve-account-holder'),
      account_number:       _fiVal('ve-account-number'),
      routing_number:       _fiVal('ve-routing-number'),
      iban:                 _fiVal('ve-iban'),
      swift_code:           _fiVal('ve-swift'),
      branch_number:        _fiVal('ve-branch'),
      payment_id:           _fiVal('ve-payment-id'),
      payment_method:       _fiVal('ve-payment'),
      payout_currency:      _fiVal('ve-payout-currency'),
      paying_company_id:    _fiVal('ve-paying-company'),
    } : {}),
  }
  Object.keys(fields).forEach(k => fields[k] === undefined && delete fields[k])

  try {
    await updateVendor(id, fields)
    const activeIdx = _vendors.findIndex(v => v.id === id)
    const archiveIdx = _vendorsInactive.findIndex(v => v.id === id)

    const wasActive = activeIdx !== -1
    const isNowActive = fields.active !== false

    if (wasActive && isNowActive) {
      _vendors[activeIdx] = { ..._vendors[activeIdx], ...fields }
    } else if (wasActive && !isNowActive) {
      const moved = { ..._vendors[activeIdx], ...fields }
      _vendors.splice(activeIdx, 1)
      _vendorsInactive.push(moved)
      _vendorListTab = 'archived'
    } else if (!wasActive && isNowActive) {
      const moved = { ..._vendorsInactive[archiveIdx], ...fields }
      _vendorsInactive.splice(archiveIdx, 1)
      _vendors.push(moved)
      _vendors.sort((a,b) => a.full_name.localeCompare(b.full_name))
      _vendorListTab = 'active'
    } else {
      _vendorsInactive[archiveIdx] = { ..._vendorsInactive[archiveIdx], ...fields }
    }

    _vendorEditMode = false
    _vendorEditSnapshot = null
    renderVendors()
    renderVendorDetail()
    showToast('Vendor saved')
  } catch(e) {
    console.error('[HSos] saveVendorProfile error:', e)
    showToast('Save failed — check console', 'warn')
  }
}
window.saveVendorProfile = saveVendorProfile

// ─── add vendor panel ─────────────────────────────────────────

function openAddVendorPanel() {
  document.getElementById('av-name').value             = ''
  document.getElementById('av-email').value            = ''
  document.getElementById('av-phone').value            = ''
  document.getElementById('av-notes').value            = ''
  document.getElementById('av-type').value             = 'coach'
  document.getElementById('av-currency').value         = 'EUR'
  document.getElementById('av-payout-currency').value  = ''
  document.getElementById('av-status').value           = 'true'

  const sel = document.getElementById('av-paying-company')
  if (sel) {
    sel.options.length = 0
    const placeholder = document.createElement('option')
    placeholder.value = ''
    placeholder.textContent = '— not assigned —'
    sel.appendChild(placeholder)
    ;(_companies || []).forEach(c => {
      const opt = document.createElement('option')
      opt.value = c.id
      opt.textContent = c.name
      sel.appendChild(opt)
    })
  }

  document.getElementById('add-vendor-overlay').style.display = 'block'
  document.getElementById('add-vendor-panel').style.display   = 'flex'
  setTimeout(() => document.getElementById('av-name').focus(), 50)
}
window.openAddVendorPanel = openAddVendorPanel

function closeAddVendorPanel() {
  document.getElementById('add-vendor-overlay').style.display = 'none'
  document.getElementById('add-vendor-panel').style.display   = 'none'
}
window.closeAddVendorPanel = closeAddVendorPanel

async function submitAddVendor() {
  const name = document.getElementById('av-name').value.trim()
  if (!name) { showToast('Full name is required', 'warn'); return }
  const payoutCurrency  = document.getElementById('av-payout-currency').value || null
  const payingCompanyId = document.getElementById('av-paying-company').value  || null
  const fields = {
    full_name:          name,
    vendor_type:        document.getElementById('av-type').value,
    email:              document.getElementById('av-email').value.trim()   || null,
    phone:              document.getElementById('av-phone').value.trim()   || null,
    currency:           document.getElementById('av-currency').value,
    preferred_currency: document.getElementById('av-currency').value,
    payout_currency:    payoutCurrency,
    paying_company_id:  payingCompanyId,
    notes:              document.getElementById('av-notes').value.trim()   || null,
    active:             document.getElementById('av-status').value !== 'false',
  }
  try {
    const newVendor = await createVendor(fields)
    const hydrated  = { ...newVendor, rates: [], clients: [] }
    _vendors.push(hydrated)
    _vendors.sort((a, b) => a.full_name.localeCompare(b.full_name))
    closeAddVendorPanel()
    renderVendors()
    showToast(`${newVendor.full_name} added`, 'success')
    openVendorDetail(newVendor.id)
  } catch (err) {
    console.error('[HSos] submitAddVendor error:', err)
    showToast('Failed to create vendor: ' + err.message, 'warn')
  }
}
window.submitAddVendor = submitAddVendor

async function deleteCurrentVendor() {
  const v = _currentVendor()
  if (!v) return
  showConfirm(
    `Delete "${v.full_name}"? This cannot be undone.`,
    async () => {
      try {
        await deleteVendor(v.id)
        _vendors         = _vendors.filter(x => x.id !== v.id)
        _vendorsInactive = _vendorsInactive.filter(x => x.id !== v.id)
        _selVendorId     = null
        _vendorEditMode  = false
        _vendorEditSnapshot = null
        const detail = document.getElementById('vendor-detail')
        if (detail) detail.innerHTML = `<div class="empty"><div class="empty-icon">◻</div><div>Select a vendor</div></div>`
        renderVendors()
        showToast(`${v.full_name} deleted`)
      } catch(err) {
        console.error('[HSos] deleteCurrentVendor error:', err)
        showToast('Delete failed — check console', 'warn')
      }
    }
  )
}
window.deleteCurrentVendor = deleteCurrentVendor

function triggerAvatarUpload(vendorId) {
  const input = document.getElementById('ve-avatar-file')
  if (input) input.click()
}
window.triggerAvatarUpload = triggerAvatarUpload

async function onAvatarFileChange(vendorId, input) {
  const file = input.files[0]
  if (!file) return
  showToast('Uploading…', 'info')
  try {
    const url = await uploadVendorAvatar(vendorId, file)
    await updateVendor(vendorId, { profile_picture_url: url })
    const allVendors = [..._vendors, ..._vendorsInactive]
    const v = allVendors.find(x => x.id === vendorId)
    if (v) v.profile_picture_url = url
    renderVendorDetail()
    showToast('Avatar updated')
  } catch(e) {
    console.error('[HSos] avatar upload error:', e)
    showToast('Upload failed — check console', 'warn')
  }
}
window.onAvatarFileChange = onAvatarFileChange

function vcCsToggle(vendorId) {
  const dd = document.getElementById('vc-cs-dropdown')
  if (!dd) return
  const open = dd.style.display !== 'none'
  dd.style.display = open ? 'none' : ''
  if (!open) document.getElementById('vc-cs-search')?.focus()
}
window.vcCsToggle = vcCsToggle

function vcCsFilter(vendorId, query) {
  const pool = [..._vendors, ..._vendorsInactive]
  const v = pool.find(x => x.id === vendorId)
  if (!v) return
  const assignedIds = new Set((v.clients || []).map(c => c.id))
  const unassigned  = _clients.filter(c => !assignedIds.has(c.id))
  const q = query.toLowerCase()
  const matches = q
    ? unassigned.filter(c => c.full_name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q))
    : unassigned
  const list = document.getElementById('vc-cs-list')
  if (!list) return
  list.innerHTML = matches.length
    ? matches.map(c => `
        <div class="cs-item" onclick="assignClient('${vendorId}','${c.id}')">
          <div class="av av-sm" style="background:${avatarBg(c.full_name)};color:${avatarFg(c.full_name)}">${initials(c.full_name)}</div>
          <div>
            <div class="cs-item-name">${escHtml(c.full_name)}</div>
            ${c.email ? `<div class="cs-item-sub">${escHtml(c.email)}</div>` : ''}
          </div>
        </div>`).join('')
    : '<div class="cs-empty">No matches</div>'
}
window.vcCsFilter = vcCsFilter

async function assignClient(vendorId, clientId) {
  try {
    await assignClientToVendor(vendorId, clientId)
    const pool = [..._vendors, ..._vendorsInactive]
    const v = pool.find(x => x.id === vendorId)
    const c = _clients.find(x => x.id === clientId)
    if (v && c) {
      if (!v.clients) v.clients = []
      v.clients.push(c)
    }
    renderVendorDetail()
    showToast(`${c?.full_name} assigned`)
  } catch(e) {
    console.error('[HSos] assignClient error:', e)
    showToast('Assign failed — check console', 'warn')
  }
}
window.assignClient = assignClient

async function unassignClient(vendorId, clientId) {
  try {
    await unassignClientFromVendor(vendorId, clientId)
    const pool = [..._vendors, ..._vendorsInactive]
    const v = pool.find(x => x.id === vendorId)
    if (v?.clients) {
      const c = v.clients.find(x => x.id === clientId)
      v.clients = v.clients.filter(x => x.id !== clientId)
      showToast(`${c?.full_name} removed`)
    }
    renderVendorDetail()
  } catch(e) {
    console.error('[HSos] unassignClient error:', e)
    showToast('Remove failed — check console', 'warn')
  }
}
window.unassignClient = unassignClient
