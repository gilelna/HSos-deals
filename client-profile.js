// client-profile.js — HSos Client Profile page
// URL: client-profile.html?id=<clientId>

// ─── External platform URL patterns ──────────────────────────
// Change these constants if platform base URLs change.

const PLATFORM_URLS = {
  activecampaign:  id => id ? `https://accentway.activehosted.com/app/contacts/${id}` : null,
  thrivecart:      id => id ? `https://thrivecart.com/admin/customers/${id}` : null,
  mighty_networks: id => id ? `https://mightynetworks.com/members/${id}` : null,
  freshdesk:       id => id ? `https://accentway.freshdesk.com/contacts/${id}` : null,
}

// Minimal Markdown renderer — application data only, entities escaped first
function renderMd(text) {
  if (!text) return ''
  let s = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  s = s.replace(/(^|[^"'>])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
  return s
}

// ─── State ────────────────────────────────────────────────────

let _client      = null
let _clientId    = null
let _deals       = []
let _packages    = []
let _sessions    = []
let _docs        = []
let _tags        = []
let _coach       = null   // primary assigned vendor
let _curTagsTab  = 'all'
let _detailsOpen = false

// ─── Init ─────────────────────────────────────────────────────

let _vendorView = false  // true when role=vendor — hides payment-sensitive sections

async function initClientProfile() {
  const params = new URLSearchParams(location.search)
  _clientId   = params.get('id')
  _vendorView = params.get('role') === 'vendor'

  initProfileBg()
  initProfileHeroShrink()

  if (!_clientId) {
    showErrorState('No client ID in URL. Use client-profile.html?id=<id>')
    return
  }

  await loadAll()

  // After render: hide payment-sensitive sections for vendor view
  if (_vendorView) {
    // Hide the Payment History column from the two-column grid
    const paymentsBlock = document.getElementById('payments-list')?.closest('.block')
    if (paymentsBlock) paymentsBlock.style.display = 'none'
    // Make the Deals column full-width
    const twoCol = document.querySelector('.prof-two-col')
    if (twoCol) twoCol.style.gridTemplateColumns = '1fr'
    // Hide Tags and Payment-related action button
    const tagsBlock = document.getElementById('tags-body')?.closest('.block')
    if (tagsBlock) tagsBlock.style.display = 'none'
    // Hide "+ New deal" action — vendors don't create deals
    document.querySelectorAll('.prof-action-btn').forEach(btn => {
      if (btn.textContent.includes('New deal')) btn.style.display = 'none'
    })
  }
}
window.initClientProfile = initClientProfile

async function loadAll() {
  try {
    const [client, deals, packages, sessions, docs] = await Promise.all([
      getClient(_clientId),
      getDeals({ client_id: _clientId }),
      getPackages({ client_id: _clientId }),
      getSessions({ client_id: _clientId }),
      getDocuments('client', _clientId),
    ])

    _client   = client
    _deals    = deals    || []
    _packages = packages || []
    _sessions = sessions || []
    _docs     = docs     || []

    // Tags from client record
    _tags = (_client.tags || []).map(t => typeof t === 'string' ? { name: t, source: 'hsos' } : t)

    // Primary coach
    const vendors = await getVendorClientsForClient(_clientId)
    _coach = vendors.find(v => v.vendor_type === 'coach') || vendors[0] || null

    renderHero()
    renderStats()
    renderDealsList()
    renderPaymentsList()
    renderTags()
    renderDocs()

    initNameEdit(
      document.getElementById('prof-name'),
      async (name) => {
        await updateClient(_clientId, { full_name: name })
        document.getElementById('bc-name').textContent = name
        showToast('Name updated')
      }
    )
    loadReminders()
  } catch (e) {
    console.error('[ClientProfile]', e)
    showErrorState(e.message)
  }
}

// ─── Hero ─────────────────────────────────────────────────────

function renderHero() {
  const c = _client
  if (!c) return

  // Overlay — determined by product type
  const productType = _deals[0]?.products?.category || _packages[0]?.product_type || 'coaching'
  setProfileOverlay(productType)

  // Breadcrumb
  document.getElementById('bc-name').textContent = c.full_name || '—'

  // Avatar
  const av = document.getElementById('prof-avatar')
  av.style.background = avatarBg(c.full_name)
  av.style.color = avatarFg(c.full_name)
  av.textContent = initials(c.full_name)

  // Name
  document.getElementById('prof-name').textContent = c.full_name || '—'

  // Sub-line
  const parts = [c.email, c.phone].filter(Boolean)
  document.getElementById('prof-subline').textContent = parts.join(' · ') || ' '

  // Badges
  renderBadges()

  // Quick links
  renderQLinks()

  // Meta strip
  renderMeta()
}

function renderBadges() {
  const c = _client
  const el = document.getElementById('prof-badges')

  const status  = c.active ? 'active' : 'inactive'
  const product = _deals[0]?.products?.category || _packages[0]?.product_type || 'coaching'
  const curr    = c.currency || _deals[0]?.currency || '—'
  const country = c.country || '—'

  el.innerHTML = [
    { label: status, cls: c.active ? 'active' : '' },
    { label: product },
    { label: curr },
    { label: country },
  ].map(b => `
    <span class="prof-badge ${b.cls || ''}">${escHtml(b.label)}</span>
  `).join('')
}

function renderQLinks() {
  const c = _client
  const el = document.getElementById('prof-qlinks')

  const acUrl  = PLATFORM_URLS.activecampaign(c.activecampaign_id || c.ac_id)
  const tcUrl  = PLATFORM_URLS.thrivecart(c.thrivecart_id || c.tc_id)
  const mnUrl  = PLATFORM_URLS.mighty_networks(c.mighty_networks_id || c.mn_id)

  const links = []
  if (acUrl) links.push({ label: 'ActiveCampaign ↗', url: acUrl,  color: '#356AE6' })
  if (tcUrl) links.push({ label: 'ThriveCart ↗',     url: tcUrl,  color: '#F27C00' })
  if (mnUrl) links.push({ label: 'Mighty Networks ↗', url: mnUrl, color: '#7B2FBE' })

  // Details pill (toggles panel)
  const detailsPill = `
    <button class="prof-qlink" onclick="toggleDetailsPanel()">
      <span class="prof-qlink-dot" style="background:#8C8880"></span>
      Details
    </button>
  `

  el.innerHTML = links.map(l => `
    <a class="prof-qlink" href="${escHtml(l.url)}" target="_blank" rel="noopener">
      <span class="prof-qlink-dot" style="background:${l.color}"></span>
      ${escHtml(l.label)}
    </a>
  `).join('') + detailsPill
}

function renderMeta() {
  const c = _client
  const el = document.getElementById('prof-meta')

  const coachName = _coach?.full_name || '—'

  // Active package
  const activePkg = _packages.find(p => p.status === 'active')
  const pkgStr = activePkg
    ? `${activePkg.plan_name || 'Package'} (${activePkg.sessions_remaining} left)`
    : '—'

  const since = c.created_at ? formatDate(c.created_at) : '—'

  el.innerHTML = [
    { label: 'Coach', val: coachName },
    { label: 'Current package', val: pkgStr },
    { label: 'Client since', val: since },
  ].map(m => `
    <div class="prof-meta-item">
      <div class="prof-meta-label">${escHtml(m.label)}</div>
      <div class="prof-meta-val">${escHtml(m.val)}</div>
    </div>
  `).join('')
}

// ─── Stats ────────────────────────────────────────────────────

function renderStats() {
  const now      = new Date()
  const monthStr = now.toISOString().slice(0, 7)

  const firstSession = _sessions.reduce((earliest, s) =>
    (!earliest || s.session_date < earliest) ? s.session_date : earliest, null)

  document.getElementById('stat-total-sessions').textContent = _sessions.length

  if (firstSession) {
    document.getElementById('stat-sessions-since').textContent = `since ${formatDate(firstSession)}`
  }

  const monthSessions = _sessions.filter(s => (s.session_date || '').startsWith(monthStr))
  document.getElementById('stat-month-sessions').textContent = monthSessions.length

  const lastSession = _sessions[0]  // ordered desc
  if (lastSession) {
    document.getElementById('stat-last-session').textContent = `last: ${formatDate(lastSession.session_date)}`
  }

  const activePkg = _packages.find(p => p.status === 'active')
  document.getElementById('stat-sessions-left').textContent = activePkg
    ? activePkg.sessions_remaining
    : '—'

  // Total paid across deals
  const paidDeals = _deals.filter(d => ['paid','partial','link_sent','invoiced'].includes(d.billing_status))
  const totalPaid = paidDeals.reduce((s, d) => s + Number(d.price || 0), 0)
  const curr = _client?.currency || ''
  document.getElementById('stat-total-paid').textContent = totalPaid
    ? `${curr} ${totalPaid.toLocaleString()}`
    : '—'
  document.getElementById('stat-packages-count').textContent =
    `${_packages.length} package${_packages.length !== 1 ? 's' : ''}`
}

// ─── Deals & packages list ────────────────────────────────────

function renderDealsList() {
  const el = document.getElementById('deals-list')
  if (!_deals.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--mu2);font-size:12px">No deals yet.</div>'
    return
  }

  el.innerHTML = _deals.map(d => {
    const product = d.products?.name || '—'
    const vendor  = d.vendors?.full_name || '—'
    const curr    = d.currency || ''
    const price   = d.price ? `${curr} ${Number(d.price).toLocaleString()}` : '—'

    // Date range
    const start = d.start_date ? formatDate(d.start_date) : null
    const end   = d.end_date   ? formatDate(d.end_date)   : null
    const dateRange = [start, end].filter(Boolean).join(' – ') || formatDate(d.created_at)

    // Session count from packages belonging to this deal
    const pkgs = _packages.filter(p => p.deal_id === d.id)
    const totalSess = pkgs.reduce((s, p) => s + (p.sessions_total || 0), 0)
    const sessStr = totalSess ? `${totalSess} sessions` : ''

    const sub = [vendor !== '—' ? `w/ ${vendor}` : null, dateRange, sessStr].filter(Boolean).join(' · ')

    return `
      <div class="prof-list-row" onclick="openDealPanelFromClientProfile('${d.id}')">
        <div class="prof-list-main">
          <div class="prof-list-name">${escHtml(product)}</div>
          <div class="prof-list-sub">${escHtml(sub)}</div>
        </div>
        <div class="prof-list-right">
          <span class="prof-list-amt">${escHtml(price)}</span>
          <span class="pill ${d.billing_status}">${d.billing_status}</span>
        </div>
      </div>
    `
  }).join('')
}

function openDealPanelFromClientProfile(dealId) {
  if (!dealId) return
  if (window.SidePanel?.open) { window.SidePanel.open('deal', { id: dealId }); return }
  window.PanelManager?.open('deal', dealId)
}
window.openDealPanelFromClientProfile = openDealPanelFromClientProfile

// ─── Payment history ──────────────────────────────────────────

function renderPaymentsList() {
  const el = document.getElementById('payments-list')
  const paidDeals = _deals.filter(d => ['paid','partial','link_sent','invoiced'].includes(d.billing_status))
  if (!paidDeals.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--mu2);font-size:12px">No payments yet.</div>'
    return
  }

  el.innerHTML = paidDeals.map(d => {
    const product = d.products?.name || '—'
    const curr    = d.currency || ''
    const price   = d.price ? `${curr} ${Number(d.price).toLocaleString()}` : '—'
    const method  = d.payment_processor || d.billing_type || '—'
    const date    = formatDate(d.updated_at || d.created_at)
    const month   = d.updated_at
      ? new Date(d.updated_at).toLocaleDateString('en', { month: 'short', year: 'numeric' })
      : '—'

    return `
      <div class="prof-list-row">
        <div class="prof-list-main">
          <div class="prof-list-name">${escHtml(product)} · ${month}</div>
          <div class="prof-list-sub">${escHtml(method)} · received ${date}</div>
        </div>
        <div class="prof-list-right">
          <span class="prof-list-amt">${escHtml(price)}</span>
          <span class="pill paid">paid</span>
        </div>
      </div>
    `
  }).join('')
}

// ─── Tags ─────────────────────────────────────────────────────

function renderTags() {
  renderTagsForTab(_curTagsTab)
}

function renderTagsForTab(tab) {
  const el = document.getElementById('tags-body')

  const bySource = {}
  for (const t of _tags) {
    const src = (t.source || 'hsos').toLowerCase()
    if (!bySource[src]) bySource[src] = []
    bySource[src].push(t)
  }

  const allSources = Object.keys(bySource)
  const sources = tab === 'all' ? allSources : (bySource[tab] ? [tab] : [])

  if (!sources.length) {
    el.innerHTML = '<span style="color:var(--mu2);font-size:12px">No tags.</span>'
    return
  }

  el.innerHTML = sources.map(src => {
    const tags = bySource[src] || []
    const label = src === 'ac' ? 'ActiveCampaign' : src === 'mn' ? 'Mighty Networks' : 'HSos'
    const isEditable = src === 'hsos'

    return `
      <div class="prof-tags-source-label">${label}</div>
      ${tags.map(t => `
        <span class="prof-tag ${src}">
          ${escHtml(t.name || t)}
          ${isEditable ? `<button class="prof-tag-rm" onclick="removeTag(${JSON.stringify(t.name || t)})" title="Remove">✕</button>` : ''}
        </span>
      `).join('')}
    `
  }).join('')
}

function switchTagsTab(tab) {
  _curTagsTab = tab
  document.querySelectorAll('#tags-tabs .det-tab').forEach(t => {
    t.classList.toggle('cur', t.dataset.tab === tab)
  })
  renderTagsForTab(tab)
}
window.switchTagsTab = switchTagsTab

async function removeTag(tagName) {
  _tags = _tags.filter(t => (t.name || t) !== tagName)
  try {
    const plainTags = _tags.map(t => t.name || t)
    await updateClient(_clientId, { tags: plainTags })
    renderTags()
    showToast('Tag removed')
  } catch (e) {
    showToast('Failed: ' + e.message, 'warn')
  }
}
window.removeTag = removeTag

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
      const res = await uploadDocumentFile(file, 'client', _clientId)
      storagePath = res.path
      publicUrl   = res.url
    }
    const doc = await createDocument({
      entity_type:  'client',
      entity_id:    _clientId,
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

// ─── Details side panel ───────────────────────────────────────

function toggleDetailsPanel() {
  _detailsOpen = !_detailsOpen
  document.getElementById('details-panel').classList.toggle('open', _detailsOpen)
  if (_detailsOpen) renderDetailsPanel()
}
window.toggleDetailsPanel = toggleDetailsPanel

function closeDetailsPanel() {
  _detailsOpen = false
  document.getElementById('details-panel').classList.remove('open')
}
window.closeDetailsPanel = closeDetailsPanel

function renderDetailsPanel() {
  const c = _client
  const el = document.getElementById('details-body')
  if (!c) return

  const contactFields = [
    { label: 'Email',    val: c.email    || '—' },
    { label: 'Phone',    val: c.phone    || '—' },
    { label: 'Country',  val: c.country  || '—' },
    { label: 'City',     val: c.city     || '—' },
    { label: 'Language', val: c.language || '—' },
  ]

  const acId = c.activecampaign_id || c.ac_id
  const tcId = c.thrivecart_id     || c.tc_id
  const mnId = c.mighty_networks_id || c.mn_id
  const fdId = c.freshdesk_id

  const extLinks = [
    { label: 'ActiveCampaign',  id: acId, url: PLATFORM_URLS.activecampaign(acId) },
    { label: 'ThriveCart',      id: tcId, url: PLATFORM_URLS.thrivecart(tcId) },
    { label: 'Mighty Networks', id: mnId, url: PLATFORM_URLS.mighty_networks(mnId) },
    { label: 'Freshdesk',       id: fdId, url: PLATFORM_URLS.freshdesk(fdId) },
  ].filter(l => l.id)

  el.innerHTML = `
    <div class="prof-details-section">
      <div class="prof-details-section-label">Contact</div>
      ${contactFields.map(f => `
        <div class="prof-details-row">
          <span class="prof-details-lbl">${escHtml(f.label)}</span>
          <span class="prof-details-val">${escHtml(f.val)}</span>
        </div>
      `).join('')}
    </div>

    ${extLinks.length ? `
      <div class="prof-details-section">
        <div class="prof-details-section-label">External Platforms</div>
        ${extLinks.map(l => `
          <div class="prof-details-row">
            <span class="prof-details-lbl">${escHtml(l.label)}</span>
            <span class="prof-details-val">
              <a href="${escHtml(l.url)}" target="_blank" rel="noopener">${escHtml(String(l.id))}</a>
            </span>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <div class="prof-details-section">
      <div class="prof-details-section-label">Internal</div>
      <div class="prof-details-row">
        <span class="prof-details-lbl">Client ID</span>
        <span class="prof-details-val" style="font-family:var(--font-mono);font-size:11px">${escHtml(c.id)}</span>
      </div>
    </div>
  `
}

// ─── Actions ─────────────────────────────────────────────────

function openNewSession() {
  location.href = `workload.html?client=${_clientId}`
}
window.openNewSession = openNewSession

function openNewDeal() {
  location.href = `deals.html?new=deal&client=${_clientId}`
}
window.openNewDeal = openNewDeal

// ─── Error state ──────────────────────────────────────────────

function showErrorState(msg) {
  document.getElementById('prof-name').textContent = 'Error'
  document.getElementById('prof-subline').textContent = msg
  document.getElementById('prof-body').innerHTML =
    `<div class="empty"><div class="empty-icon">⚠</div><div>${escHtml(msg)}</div></div>`
}

// ─── Reminders widget ─────────────────────────────────────────

let _reminders = []
let _addReminderOpen = false

function toggleAddReminderForm() {
  _addReminderOpen = !_addReminderOpen
  const form = document.getElementById('add-reminder-form')
  if (form) form.style.display = _addReminderOpen ? 'block' : 'none'
  if (!_addReminderOpen) {
    const bodyEl = document.getElementById('reminder-body')
    const dueEl  = document.getElementById('reminder-due')
    if (bodyEl) bodyEl.value = ''
    if (dueEl)  dueEl.value  = ''
  }
}

function _fmtDueAt(ts) {
  if (!ts) return null
  const d = new Date(ts)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function _isOverdue(ts, status) {
  if (!ts || status !== 'pending') return false
  return new Date(ts) < new Date()
}

function renderReminders() {
  const el = document.getElementById('reminders-list')
  if (!el) return

  if (!_reminders.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--mu2);font-size:12px">No reminders yet.</div>'
    return
  }

  el.innerHTML = _reminders.map(r => {
    const overdue   = _isOverdue(r.due_at, r.status)
    const dueStr    = _fmtDueAt(r.due_at)
    const isPending = r.status === 'pending' || !r.status
    const statusBg    = r.status === 'done'      ? 'var(--green-bg)'  :
                        r.status === 'dismissed' ? 'var(--bg)'        :
                        overdue                  ? 'var(--red-bg)'    : 'var(--amber-bg)'
    const statusColor = r.status === 'done'      ? 'var(--green-text)' :
                        r.status === 'dismissed' ? 'var(--mu)'         :
                        overdue                  ? 'var(--red-text)'   : 'var(--amber-text)'
    return `
      <div style="padding:10px 16px;border-bottom:1px solid var(--border2);${overdue ? 'background:var(--red-bg)' : ''}">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;line-height:1.5">${renderMd(r.body)}</div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:5px;flex-wrap:wrap">
              ${dueStr ? `<span style="font-size:10px;font-family:var(--font-mono);color:${overdue ? 'var(--red-text)' : 'var(--mu)'}">${overdue ? '\u26a0 ' : ''}${dueStr}</span>` : ''}
              <span style="font-size:10px;padding:1px 7px;border-radius:8px;background:${statusBg};color:${statusColor};font-family:var(--font-mono);font-weight:600">${r.status || 'pending'}</span>
            </div>
          </div>
          ${isPending ? `
            <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
              <button style="font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:var(--green-bg);color:var(--green-text);cursor:pointer;white-space:nowrap"
                      onclick="patchReminder('${r.id}','done')">Done</button>
              <button style="font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--mu);cursor:pointer;white-space:nowrap"
                      onclick="patchReminder('${r.id}','dismissed')">Dismiss</button>
            </div>` : ''}
        </div>
      </div>`
  }).join('')
}

async function loadReminders() {
  if (!_clientId) return
  try {
    _reminders = await getClientReminders(_clientId)
  } catch (err) {
    console.error('[Reminders] load failed', err)
  }
  renderReminders()
}

async function saveReminder() {
  const bodyEl  = document.getElementById('reminder-body')
  const dueEl   = document.getElementById('reminder-due')
  const body    = bodyEl?.value?.trim()
  const dueRaw  = dueEl?.value
  if (!body) { showToast('Please enter a reminder note', 'warn'); return }

  try {
    const created = await logActivity({
      entity_type: 'client',
      entity_id:   _clientId,
      type:        'reminder',
      body,
      origin:      'user',
      status:      'pending',
      due_at:      dueRaw ? new Date(dueRaw).toISOString() : null,
    })
    _reminders = [created, ..._reminders].sort((a, b) => {
      if (!a.due_at && !b.due_at) return 0
      if (!a.due_at) return 1
      if (!b.due_at) return -1
      return new Date(a.due_at) - new Date(b.due_at)
    })
    toggleAddReminderForm()
    renderReminders()
    showToast('Reminder saved', 'success')
  } catch (err) {
    console.error('[Reminders] save failed', err)
    showToast('Failed to save reminder', 'error')
  }
}

async function patchReminder(id, newStatus) {
  try {
    await updateActivity(id, { status: newStatus })
    _reminders = _reminders.map(r => r.id === id ? { ...r, status: newStatus } : r)
    renderReminders()
  } catch (err) {
    console.error('[Reminders] patch failed', err)
    showToast('Failed to update reminder', 'error')
  }
}

window.toggleAddReminderForm = toggleAddReminderForm
window.saveReminder           = saveReminder
window.patchReminder          = patchReminder
