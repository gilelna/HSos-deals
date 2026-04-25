// vendor-profile.js — HSos Vendor Profile page
// URL: vendor-profile.html?id=<vendorId>

// ─── State ────────────────────────────────────────────────────

let _vendor      = null
let _vendorId    = null
let _rates       = []
let _bills       = []
let _clients     = []
let _sessions    = []
let _docs        = []
let _companyName = null
let _ratesOpen   = false
let _readOnly    = false

// ─── Init ─────────────────────────────────────────────────────

async function initVendorProfile() {
  const params = new URLSearchParams(location.search)
  _vendorId = params.get('id')
  const role = (window.Role?.get?.() || sessionStorage.getItem('hsos_role') || '').toLowerCase()
  _readOnly = params.get('readonly') === '1'

  initProfileBg()
  initProfileHeroShrink()

  if (!_vendorId) {
    showErrorState('No vendor ID in URL. Use vendor-profile.html?id=<id>')
    return
  }

  await loadAll()
}
window.initVendorProfile = initVendorProfile

async function loadAll() {
  try {
    const [vendor, rates, bills, docs] = await Promise.all([
      getVendor(_vendorId),
      getRates(_vendorId),
      getVendorBills(_vendorId),
      getDocuments('vendor', _vendorId),
    ])

    _vendor  = vendor
    _rates   = rates || []
    _bills   = bills || []
    _docs    = docs  || []

    // Fetch paying company name
    const companyId = vendor?.company_id || vendor?.paying_company_id
    if (companyId) {
      const { data: co } = await _sb.from('companies').select('name').eq('id', companyId).maybeSingle()
      _companyName = co?.name || companyId
    } else {
      _companyName = null
    }

    // Fetch clients via vendor_clients join
    const { data: vcRows } = await _sb
      .from('vendor_clients')
      .select('client_id, clients(id, full_name, email, active)')
      .eq('vendor_id', _vendorId)
    _clients = (vcRows || []).map(r => r.clients).filter(Boolean)

    // Sessions for stats
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10)
    const { data: sess } = await _sb
      .from('sessions')
      .select('id, session_date, bill_id, status, hours, rate_usd, task_type_id')
      .eq('vendor_id', _vendorId)
      .gte('session_date', monthStart)
    _sessions = sess || []

    renderHero()
    renderStats()
    renderClientsList()
    renderBillsList()
    renderDocs()
    applyReadOnlyMode()
  } catch (e) {
    console.error('[VendorProfile]', e)
    showErrorState(e.message)
  }
}

// ─── Hero ─────────────────────────────────────────────────────

function renderHero() {
  const v = _vendor
  if (!v) return

  // Overlay
  setProfileOverlay(v.vendor_type || 'contractor')

  // Breadcrumb
  document.getElementById('bc-name').textContent = v.full_name || '—'

  // Avatar
  const av = document.getElementById('prof-avatar')
  const bg = avatarBg(v.full_name); const fg = avatarFg(v.full_name)
  av.style.background = bg
  av.style.color = fg
  av.textContent = initials(v.full_name)

  // Name
  document.getElementById('prof-name').textContent = v.full_name || '—'

  // Sub-line
  const parts = [v.email, v.phone].filter(Boolean)
  document.getElementById('prof-subline').textContent = parts.join(' · ') || ' '

  // Log session link
  document.getElementById('log-session-btn').href = `workload.html?vendor=${_vendorId}`

  // Badges
  renderBadges()

  // Quick links
  renderQLinks()

  // Meta strip
  renderMeta()
}

function applyReadOnlyMode() {
  const nameEditBtn = document.querySelector('.prof-name-edit')
  if (nameEditBtn) nameEditBtn.style.display = _readOnly ? 'none' : ''

  const newBillBtn = document.querySelector('.prof-actions .primary')
  if (newBillBtn) newBillBtn.style.display = _readOnly ? 'none' : ''

  const docsAddBtn = document.querySelector('.prof-section-head button[onclick="openDocUpload()"]')
  if (docsAddBtn) docsAddBtn.style.display = _readOnly ? 'none' : ''
}

function renderBadges() {
  const v = _vendor
  const el = document.getElementById('prof-badges')

  const status  = (v.active || v.is_active) ? 'active' : 'inactive'
  const type    = v.vendor_type || 'contractor'
  const curr    = v.preferred_currency || v.payout_currency || '—'
  const rail    = v.payment_method || v.payout_rail || '—'
  const country = v.country || '—'
  const cnt     = _clients.length
  const cntTxt  = `${cnt} client${cnt !== 1 ? 's' : ''}`

  // Primary rate (default if marked, else first by name)
  const pRate = _rates.find(r => r.is_default) || _rates[0] || null
  const rateStr = pRate ? `${pRate.currency || curr} ${Number(pRate.amount ?? pRate.rate ?? 0)} / hour` : null

  const badges = [
    { label: status,  cls: status === 'active' ? 'active' : '' },
    { label: type },
    { label: curr },
    { label: rail },
    { label: cntTxt },
    { label: country },
  ]
  if (rateStr) badges.push({ label: rateStr, hasEdit: true })

  el.innerHTML = badges.map(b => `
    <span class="prof-badge ${b.cls || ''}">
      ${escHtml(b.label)}
      ${b.hasEdit ? `<button class="prof-badge-edit" onclick="openRateEdit(event)" title="Edit rate">✎</button>` : ''}
    </span>
  `).join('')
}

function renderQLinks() {
  const v = _vendor
  const el = document.getElementById('prof-qlinks')

  const links = []
  if (v.slack_channel_url) links.push({ label: 'Slack channel',    url: v.slack_channel_url,    color: '#4A154B' })
  if (v.calendar_url)      links.push({ label: 'Google Calendar',  url: v.calendar_url,          color: '#1A73E8' })
  if (v.whatsapp_url || v.phone) {
    const waUrl = v.whatsapp_url || `https://wa.me/${(v.phone || '').replace(/\D/g, '')}`
    links.push({ label: 'WhatsApp', url: waUrl, color: '#25D366' })
  }

  if (!links.length) { el.innerHTML = ''; return }
  el.innerHTML = links.map(l => `
    <a class="prof-qlink" href="${escHtml(l.url)}" target="_blank" rel="noopener">
      <span class="prof-qlink-dot" style="background:${l.color}"></span>
      ${escHtml(l.label)}
    </a>
  `).join('')
}

function renderMeta() {
  const v = _vendor
  const el = document.getElementById('prof-meta')

  const company = _companyName || v.company_id || v.paying_company || '—'
  const currRail = [v.preferred_currency, v.payout_rail].filter(Boolean).join(' via ') || '—'
  const since = v.created_at ? formatDate(v.created_at) : '—'

  el.innerHTML = [
    { label: 'Paying company', val: company },
    { label: 'Payout', val: currRail },
    { label: 'Working since', val: since },
  ].map(m => `
    <div class="prof-meta-item">
      <div class="prof-meta-label">${escHtml(m.label)}</div>
      <div class="prof-meta-val">${escHtml(m.val)}</div>
    </div>
  `).join('')
}

// ─── Vendor edit modal ───────────────────────────────────────

function _extractMissingColumn(error) {
  const msg = String(error?.message || '')
  const match = msg.match(/Could not find the '([^']+)' column/i)
  return match?.[1] || null
}

async function _updateVendorWithSchemaFallback(fields) {
  const payload = { ...(fields || {}) }
  let retries = 0
  while (true) {
    try {
      return await updateVendor(_vendorId, payload)
    } catch (err) {
      const missing = _extractMissingColumn(err)
      if (!missing || !(missing in payload) || retries > 8) throw err
      delete payload[missing]
      retries += 1
      console.warn(`[vendor-profile] dropped missing vendor column "${missing}"`)
    }
  }
}

function openVendorEditModal() {
  if (_readOnly || !_vendor) return
  if (window.PanelManager?.open && _vendorId) {
    window.PanelManager.open('vendor', _vendorId)
  }
}
window.openVendorEditModal = openVendorEditModal

// ─── Stats ────────────────────────────────────────────────────

function renderStats() {
  const now = new Date()

  // Sessions this month
  const monthSessions = _sessions.length
  const pendingLog = _sessions.filter(s => !s.task_type_id).length
  document.getElementById('stat-sessions-month').textContent = monthSessions
  document.getElementById('stat-sessions-pending').textContent = `${pendingLog} pending log`

  // Unbilled
  const unbilled = _sessions.filter(s => !s.bill_id && s.task_type_id).length
  document.getElementById('stat-unbilled').textContent = unbilled

  // Last payout (paid bill)
  const paid = _bills.filter(b => b.status === 'paid').sort((a,b) => (b.paid_at||'').localeCompare(a.paid_at||''))
  const lastPaid = paid[0]
  if (lastPaid) {
    const curr = _vendor?.preferred_currency || _vendor?.payout_currency || ''
    document.getElementById('stat-last-payout').textContent = `${curr} ${Number(lastPaid.total_amount||0).toLocaleString()}`
    document.getElementById('stat-last-payout-date').textContent = formatDate(lastPaid.paid_at)
  }

  // YTD
  const year = now.getFullYear()
  const ytdBills = _bills.filter(b => b.status === 'paid' && (b.paid_at||'').startsWith(year))
  const ytdTotal = ytdBills.reduce((s, b) => s + (b.total_amount || 0), 0)
  const curr = _vendor?.preferred_currency || _vendor?.payout_currency || ''
  document.getElementById('stat-ytd').textContent = `${curr} ${ytdTotal.toLocaleString()}`
  document.getElementById('stat-ytd-sub').textContent = `${ytdBills.length} payout${ytdBills.length !== 1 ? 's' : ''}`
}

// ─── Clients list ─────────────────────────────────────────────

function renderClientsList() {
  const el = document.getElementById('clients-list')
  if (!_clients.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--mu2);font-size:12px">No clients assigned.</div>'
    return
  }

  // Find active packages per client
  el.innerHTML = _clients.map(c => {
    const bg = avatarBg(c.full_name); const fg = avatarFg(c.full_name)
    return `
      <div class="prof-list-row" onclick="openClientPanelFromVendorProfile('${c.id}')">
        <div class="av av-sm" style="background:${bg};color:${fg}">${initials(c.full_name)}</div>
        <div class="prof-list-main">
          <div class="prof-list-name">${escHtml(c.full_name)}</div>
          <div class="prof-list-sub" id="client-pkg-${c.id}">Loading…</div>
        </div>
        <div class="prof-list-right">
          <span class="pill ${c.active ? 'active' : 'cancelled'}">${c.active ? 'active' : 'inactive'}</span>
          <span style="color:var(--mu2);font-size:13px">›</span>
        </div>
      </div>
    `
  }).join('')

  // Load package info per client
  _clients.forEach(async c => {
    try {
      const pkgs = await getPackages({ client_id: c.id, vendor_id: _vendorId, status: 'active' })
      const sub = document.getElementById(`client-pkg-${c.id}`)
      if (!sub) return
      if (pkgs.length) {
        const p = pkgs[0]
        sub.textContent = `${escHtml(p.plan_name || 'Package')} · ${p.sessions_remaining} sessions left`
      } else {
        sub.textContent = 'No active package'
      }
    } catch (_) {}
  })
}

function openClientPanelFromVendorProfile(clientId) {
  if (!clientId) return
  window.PanelManager?.open('client', clientId)
}
window.openClientPanelFromVendorProfile = openClientPanelFromVendorProfile

// ─── Bills list ───────────────────────────────────────────────

function renderBillsList() {
  const el = document.getElementById('bills-list')
  if (!_bills.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--mu2);font-size:12px">No bills yet.</div>'
    return
  }

  el.innerHTML = _bills.map(b => {
    const month = b.created_at ? new Date(b.created_at).toLocaleDateString('en', { month: 'short', year: 'numeric' }) : '—'
    const curr = _vendor?.preferred_currency || _vendor?.payout_currency || ''
    const amt = b.total_amount ? `${curr} ${Number(b.total_amount).toLocaleString()}` : '—'
    const date = formatDate(b.paid_at || b.approved_at || b.submitted_at || b.created_at)
    return `
      <div class="prof-list-row" style="cursor:pointer" onclick="openBillDetailModal('${b.id}')">
        <div class="prof-list-main">
          <div class="prof-list-name">${escHtml(b.id?.slice(0,8) || '—')} · ${month}</div>
          <div class="prof-list-sub">${date}</div>
        </div>
        <div class="prof-list-right">
          <span class="prof-list-amt">${escHtml(amt)}</span>
          <span class="pill ${b.status}">${b.status}</span>
          <span style="color:var(--mu2);font-size:13px">›</span>
        </div>
      </div>
    `
  }).join('')
}

async function openBillDetailModal(billId) {
  if (!billId) return
  const role = (window.Role?.get?.() || sessionStorage.getItem('hsos_role') || '').toLowerCase()
  const isAdmin = role === 'admin' || role === 'finance' || role === 'manager'

  let bill
  try {
    bill = await getBillWithSessions(billId)
  } catch (e) {
    showToast('Failed to load bill detail', 'warn')
    return
  }

  const curr = _vendor?.preferred_currency || _vendor?.payout_currency || ''
  const sessions = bill.sessions || []
  const fmtAmt = n => curr + ' ' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  const fmtHrs  = h => h === 1 ? '1h' : (h || 0) + 'h'

  const rows = sessions.map(s =>
    '<tr>' +
    '<td>' + fmtDate(s.session_date) + '</td>' +
    '<td>' + escHtml(s.client_name || '—') + '</td>' +
    '<td style="font-size:11px">' + escHtml(s.task_type_name || '—') + '</td>' +
    '<td style="font-family:var(--font-mono)">' + fmtHrs(s.hours) + '</td>' +
    '<td style="text-align:right;font-family:var(--font-mono)">' + fmtAmt((s.hours||0)*(s.rate_usd||0)) + '</td>' +
    '</tr>'
  ).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--mu2);padding:16px">No sessions</td></tr>'

  // Build modal using DOM
  const existing = document.getElementById('bill-detail-overlay')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.className = 'overlay open'
  overlay.id = 'bill-detail-overlay'

  const panel = document.createElement('div')
  panel.style.cssText = 'background:var(--surface);border-radius:var(--r-lg);width:600px;padding:24px;max-height:85vh;display:flex;flex-direction:column'

  // Header
  const header = document.createElement('div')
  header.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px'
  const titleDiv = document.createElement('div')
  const titleEl = document.createElement('div')
  titleEl.style.cssText = 'font-size:17px;font-weight:600;margin-bottom:4px'
  titleEl.textContent = 'Bill Detail'
  const billIdEl = document.createElement('div')
  billIdEl.style.cssText = 'font-size:11px;font-family:var(--font-mono);color:var(--mu)'
  billIdEl.textContent = bill.id
  titleDiv.appendChild(titleEl)
  titleDiv.appendChild(billIdEl)
  const amtDiv = document.createElement('div')
  amtDiv.style.cssText = 'text-align:right'
  const amtEl = document.createElement('div')
  amtEl.style.cssText = 'font-family:var(--font-mono);font-size:22px;font-weight:700'
  amtEl.textContent = fmtAmt(bill.total_amount)
  const statusBadge = document.createElement('span')
  statusBadge.className = 'pill ' + bill.status
  statusBadge.style.marginTop = '4px'
  statusBadge.textContent = bill.status
  amtDiv.appendChild(amtEl)
  amtDiv.appendChild(statusBadge)
  header.appendChild(titleDiv)
  header.appendChild(amtDiv)

  // Body
  const body = document.createElement('div')
  body.style.cssText = 'overflow-y:auto;flex:1'
  const tblWrap = document.createElement('div')
  tblWrap.className = 'block'
  tblWrap.innerHTML = '<table class="tbl"><thead><tr><th>Date</th><th>Client</th><th>Task type</th><th>Hours</th><th style="text-align:right">Amount</th></tr></thead><tbody>' + rows + '</tbody></table>'
  body.appendChild(tblWrap)

  if (bill.finance_notes) {
    const notesDiv = document.createElement('div')
    notesDiv.style.cssText = 'margin-top:12px;padding:12px;background:var(--red-bg);border-radius:var(--r)'
    const notesLabel = document.createElement('div')
    notesLabel.style.cssText = 'font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.1em;color:var(--red-text);margin-bottom:4px'
    notesLabel.textContent = 'Return notes'
    const notesText = document.createElement('div')
    notesText.style.cssText = 'font-size:12px;color:var(--ink)'
    notesText.textContent = bill.finance_notes
    notesDiv.appendChild(notesLabel)
    notesDiv.appendChild(notesText)
    body.appendChild(notesDiv)
  }

  // Footer
  const footer = document.createElement('div')
  footer.style.cssText = 'margin-top:16px;display:flex;align-items:center;justify-content:space-between;gap:8px'

  if (isAdmin && !_readOnly) {
    const actionsDiv = document.createElement('div')
    actionsDiv.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap'
    if (bill.status === 'submitted') {
      const approveBtn = document.createElement('button')
      approveBtn.className = 'btn btn-primary btn-sm'
      approveBtn.textContent = 'Approve'
      approveBtn.onclick = () => _profileBillApprove(bill.id)
      actionsDiv.appendChild(approveBtn)
      const returnBtn = document.createElement('button')
      returnBtn.className = 'btn btn-sm'
      returnBtn.style.cssText = 'color:var(--red-text);border-color:var(--red-bg)'
      returnBtn.textContent = 'Return'
      returnBtn.onclick = () => _profileBillReturn(bill.id)
      actionsDiv.appendChild(returnBtn)
    }
    if (bill.status === 'approved') {
      const paidBtn = document.createElement('button')
      paidBtn.className = 'btn btn-primary btn-sm'
      paidBtn.textContent = 'Mark as Paid'
      paidBtn.onclick = () => _profileBillMarkPaid(bill.id)
      actionsDiv.appendChild(paidBtn)
    }
    footer.appendChild(actionsDiv)
  }

  const closeBtn = document.createElement('button')
  closeBtn.className = 'btn'
  closeBtn.style.marginLeft = 'auto'
  closeBtn.textContent = 'Close'
  closeBtn.onclick = () => overlay.remove()
  footer.appendChild(closeBtn)

  panel.appendChild(header)
  panel.appendChild(body)
  panel.appendChild(footer)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)
}
window.openBillDetailModal = openBillDetailModal

async function _profileBillApprove(billId) {
  const bill = await getBillWithSessions(billId)
  const allIds = (bill.sessions || []).map(s => s.id)
  showConfirm('Approve this bill?', async () => {
    try {
      await approveBillV2(billId, allIds)
      document.getElementById('bill-detail-overlay')?.remove()
      showToast('Bill approved')
      _bills = await getVendorBills(_vendorId)
      renderBillsList()
      renderStats()
    } catch (e) { showToast('Failed: ' + e.message, 'warn') }
  }, { confirmLabel: 'Approve' })
}
window._profileBillApprove = _profileBillApprove

async function _profileBillReturn(billId) {
  const notes = prompt('Return notes (optional):') || ''
  showConfirm('Return this bill to the vendor?', async () => {
    try {
      await rejectBillV2(billId, notes)
      document.getElementById('bill-detail-overlay')?.remove()
      showToast('Bill returned')
      _bills = await getVendorBills(_vendorId)
      renderBillsList()
      renderStats()
    } catch (e) { showToast('Failed: ' + e.message, 'warn') }
  }, { confirmLabel: 'Return' })
}
window._profileBillReturn = _profileBillReturn

async function _profileBillMarkPaid(billId) {
  showConfirm('Mark this bill as paid?', async () => {
    try {
      await markBillPaidV2(billId)
      document.getElementById('bill-detail-overlay')?.remove()
      showToast('Bill marked as paid')
      _bills = await getVendorBills(_vendorId)
      renderBillsList()
      renderStats()
    } catch (e) { showToast('Failed: ' + e.message, 'warn') }
  }, { confirmLabel: 'Mark paid' })
}
window._profileBillMarkPaid = _profileBillMarkPaid
// ─── Rates card ───────────────────────────────────────────────

function toggleRatesCard() {
  _ratesOpen = !_ratesOpen
  const card = document.getElementById('rates-card')
  card.classList.toggle('hidden', !_ratesOpen)
  if (_ratesOpen) renderRatesCard()
}
window.toggleRatesCard = toggleRatesCard

function renderRatesCard() {
  const card = document.getElementById('rates-card')
  while (card.firstChild) card.removeChild(card.firstChild)

  const head = document.createElement('div')
  head.className = 'prof-rates-head'
  const title = document.createElement('div')
  title.className = 'prof-rates-title'
  title.textContent = _rates.length ? 'Rate Sheet' : 'Rates'
  const closeBtn = document.createElement('button')
  closeBtn.className = 'prof-rates-close'
  closeBtn.textContent = '✕'
  closeBtn.addEventListener('click', toggleRatesCard)
  head.append(title, closeBtn)
  card.appendChild(head)

  if (!_rates.length) {
    const empty = document.createElement('div')
    empty.className = 'prof-rates-row'
    empty.style.color = 'var(--mu2)'
    empty.textContent = 'No rates configured.'
    card.appendChild(empty)
  } else {
    const body = document.createElement('div')
    body.className = 'prof-rates-body'
    for (const r of _rates) {
      const row = document.createElement('div')
      row.className = 'prof-rates-row'

      const left = document.createElement('div')
      const nameEl = document.createElement('div')
      nameEl.className = 'prof-rates-type'
      nameEl.textContent = r.name || 'Standard'
      left.appendChild(nameEl)
      if (r.is_default) {
        const def = document.createElement('div')
        def.className = 'prof-rates-date'
        def.textContent = 'Default'
        left.appendChild(def)
      }

      const right = document.createElement('div')
      right.style.cssText = 'display:flex;align-items:center;gap:8px'
      const amt = document.createElement('div')
      amt.className = 'prof-rates-amt'
      amt.textContent = `${r.currency || 'USD'} ${Number(r.amount ?? r.rate ?? 0).toLocaleString()}`
      right.appendChild(amt)
      if (!_readOnly) {
        const editBtn = document.createElement('button')
        editBtn.className = 'btn btn-sm'
        editBtn.textContent = 'Edit'
        editBtn.addEventListener('click', () => openRateModal(r.id))
        right.appendChild(editBtn)
      }

      row.append(left, right)
      body.appendChild(row)
    }
    card.appendChild(body)
  }

  if (!_readOnly) {
    const footer = document.createElement('div')
    footer.style.cssText = 'padding:10px 12px;border-top:1px solid var(--border2)'
    const addBtn = document.createElement('button')
    addBtn.className = 'btn btn-sm btn-primary'
    addBtn.textContent = '+ Add rate'
    addBtn.addEventListener('click', () => openRateModal())
    footer.appendChild(addBtn)
    card.appendChild(footer)
  }
}

function openRateEdit(e) {
  e.stopPropagation()
  if (_readOnly) return
  openRateModal(_rates[0]?.id || null)
}
window.openRateEdit = openRateEdit

function openRateModal(rateId = null) {
  if (_readOnly) return
  const existing = rateId ? _rates.find(r => r.id === rateId) : null
  document.getElementById('re-id').value = existing?.id || ''
  document.getElementById('re-title').textContent = existing ? 'Edit Rate' : 'Add Rate'
  document.getElementById('re-type').value = existing?.name || ''
  document.getElementById('re-rate').value = existing?.amount ?? existing?.rate ?? ''
  document.getElementById('re-currency').value = existing?.currency || (_vendor?.preferred_currency || _vendor?.payout_currency || 'USD')
  document.getElementById('re-delete-btn').style.display = existing ? '' : 'none'
  document.getElementById('rate-edit-overlay').classList.add('open')
}
window.openRateModal = openRateModal

function closeRateModal() {
  document.getElementById('rate-edit-overlay')?.classList.remove('open')
}
window.closeRateModal = closeRateModal

async function saveRateModal() {
  const id = document.getElementById('re-id').value || undefined
  const name = document.getElementById('re-type').value.trim()
  const amount = parseFloat(document.getElementById('re-rate').value)
  const currency = document.getElementById('re-currency').value || 'USD'

  if (!name) { showToast('Name is required', 'warn'); return }
  if (isNaN(amount) || amount < 0) { showToast('Amount must be a non-negative number', 'warn'); return }

  const payload = { id, name, amount, currency }
  try {
    await upsertRate(_vendorId, payload)
    _rates = await getRates(_vendorId)
    renderRatesCard()
    closeRateModal()
    showToast(id ? 'Rate updated' : 'Rate added')
  } catch (err) {
    showToast('Failed to save rate: ' + err.message, 'warn')
  }
}
window.saveRateModal = saveRateModal

async function deleteRateFromModal() {
  const id = document.getElementById('re-id').value
  if (!id) return
  try {
    await deleteRate(id)
    _rates = _rates.filter(r => r.id !== id)
    renderRatesCard()
    closeRateModal()
    showToast('Rate deleted')
  } catch (err) {
    showToast('Failed to delete rate: ' + err.message, 'warn')
  }
}
window.deleteRateFromModal = deleteRateFromModal

// ─── New bill ─────────────────────────────────────────────────

function openNewBill() {
  location.href = `workload.html?vendor=${_vendorId}&tab=work`
}
window.openNewBill = openNewBill

// ─── Comms ────────────────────────────────────────────────────

function switchCommsTab(tab) {
  document.querySelectorAll('#comms-tabs .det-tab').forEach(t => {
    t.classList.toggle('cur', t.dataset.tab === tab)
  })
}
window.switchCommsTab = switchCommsTab

// ─── Docs ─────────────────────────────────────────────────────

function renderDocs() {
  const grid = document.getElementById('docs-grid')
  if (!_docs.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--mu2);font-size:12px">No documents yet.</div>'
    return
  }
  grid.innerHTML = ''
  _docs.forEach(doc => {
    grid.appendChild(renderDocCard(doc, async (d) => {
      try {
        if (d.storage_path && !d.storage_path.startsWith('http')) {
          await deleteDocumentFile(d.storage_path)
        }
        await deleteDocument(d.id)
        _docs = _docs.filter(x => x.id !== d.id)
        renderDocs()
        showToast('Document deleted')
      } catch (e) {
        showToast('Failed to delete: ' + e.message, 'warn')
      }
    }))
  })
}

function openDocUpload() {
  if (_readOnly) return
  document.getElementById('doc-upload-overlay').classList.add('open')
}
window.openDocUpload = openDocUpload

function closeDocUpload() {
  document.getElementById('doc-upload-overlay').classList.remove('open')
  document.getElementById('doc-title').value = ''
  document.getElementById('doc-url').value   = ''
  document.getElementById('doc-file').value  = ''
}
window.closeDocUpload = closeDocUpload

async function saveDoc() {
  const title = document.getElementById('doc-title').value.trim()
  const url   = document.getElementById('doc-url').value.trim()
  const file  = document.getElementById('doc-file').files[0]

  if (!title) { showToast('Title is required', 'warn'); return }

  try {
    let storagePath = null, publicUrl = null
    if (file) {
      const res = await uploadDocumentFile(file, 'vendor', _vendorId)
      storagePath = res.path
      publicUrl   = res.url
    }
    const doc = await createDocument({
      entity_type:  'vendor',
      entity_id:    _vendorId,
      title,
      type:         file ? 'file' : 'url',
      url:          publicUrl || url || null,
      storage_path: storagePath,
      filename:     file?.name || null,
    })
    _docs.unshift(doc)
    renderDocs()
    closeDocUpload()
    showToast('Document saved')
  } catch (e) {
    showToast('Failed: ' + e.message, 'warn')
  }
}
window.saveDoc = saveDoc

// ─── Error state ──────────────────────────────────────────────

function showErrorState(msg) {
  document.getElementById('prof-name').textContent = 'Error'
  document.getElementById('prof-subline').textContent = msg
  document.getElementById('prof-body').innerHTML =
    `<div class="empty"><div class="empty-icon">⚠</div><div>${escHtml(msg)}</div></div>`
}
