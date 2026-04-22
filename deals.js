// deals.js — HSos Sales space
// Depends on: db.js, app.js

// ─── rich text editor (Quill) instances ──────────────────────
let _ndNotesQuill = null   // New deal modal

function _initNdNotesQuill() {
  if (!_ndNotesQuill) {
    _ndNotesQuill = new Quill('#nd-notes-editor', {
      theme: 'snow',
      placeholder: 'Add notes…',
      modules: { toolbar: [['bold','italic','underline'],[{list:'ordered'},{list:'bullet'}],['link'],['clean']] },
    })
  }
  _ndNotesQuill.root.innerHTML = ''
}

function _quillValue(q) {
  if (!q) return null
  const html = q.root.innerHTML
  return html === '<p><br></p>' ? null : html
}

// ─── state ────────────────────────────────────────────────────
let _deals    = []
let _clients  = []
let _vendors  = []
let _products = []

let _page     = 'deals'
let _view     = 'kanban'
let _search   = ''
let _filters  = new Set()        // 'overdue' | 'active' | 'unpaid'
let _fVendor  = ''               // vendor filter id
let _fProduct = ''               // product filter id
let _fBilling = ''               // billing_status filter

// products page
let _editProductId = null        // null = new
let _programsWithProducts = []
let _productsPageLoaded = false
let _productsPageLoading = false
let _collapsedPrograms = new Set()
let _productInlineEdit = { id: null, draft: null }
let _planInlineEdit = { productId: null, planId: null, isNew: false, draft: null }

// clients page
let _clientSearch = ''
let _selClientId  = null

// vendors page
let _selVendorId     = null
let _vendorTab       = 'profile'
let _vendorPaychecks = []
let _vendorsInactive = []  // archived vendors
let _vendorListTab   = 'active' // 'active' | 'archived'
let _vendorEditMode  = false    // profile panel edit/view toggle
let _vendorEditSnapshot = null  // original values for cancel revert
let _companies       = []
let _routerDispatching = false
let _routerRegistered  = false

let _vendorSearch  = ''
let _fVendorType   = ''   // 'coach' | 'contractor' | 'team_member' | 'subscription' | 'software_saas' | ''
let _fVendorCurrency = '' // 'EUR' | 'USD' | 'ILS' | 'GBP' | ''
let _fVendorManager  = '' // vendor id | ''

const STAGES = [
  { key: 'lead',      label: 'Lead',      color: '#aaa' },
  { key: 'qualified', label: 'Qualified', color: 'var(--blue)' },
  { key: 'active',    label: 'Active',    color: 'var(--green)' },
  { key: 'delivered', label: 'Delivered', color: 'var(--purple)' },
  { key: 'closed',    label: 'Closed',    color: 'var(--mu2)' },
]

const BILLING_COLORS = {
  pending:  'var(--mu2)',
  invoiced: 'var(--blue)',
  partial:  'var(--gold)',
  paid:     'var(--green)',
  overdue:  'var(--red)',
}

const PAYMENT_STATUS_META = {
  pending:  { icon: '⏳', color: 'var(--amber)',  bg: 'var(--amber-bg)',  label: 'pending' },
  initiated:{ icon: '🔄', color: 'var(--blue)',   bg: 'var(--blue-bg)',   label: 'initiated' },
  partial:  { icon: '🔄', color: 'var(--gold)',   bg: 'var(--gold-bg)',   label: 'partial' },
  paid:     { icon: '✅', color: 'var(--green)',  bg: 'var(--green-bg)',  label: 'paid' },
  refunded: { icon: '↩️', color: 'var(--mu2)',    bg: 'var(--bg)',        label: 'refunded' },
  failed:   { icon: '❌', color: 'var(--red)',    bg: 'var(--red-bg)',    label: 'failed' },
}

const GATEWAY_LABELS = {
  green_invoice: 'Green Invoice',
  thrivecart:    'ThriveCart',
  wise:          'Wise',
  stripe:        'Stripe',
  paypal:        'PayPal',
  manual:        'Manual',
}

// Returns HTML for a payment_status badge (or empty string if status is null/unknown)
function paymentStatusBadge(status) {
  if (!status) return ''
  const m = PAYMENT_STATUS_META[status]
  if (!m) return ''
  return `<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:1px 6px;border-radius:10px;background:${m.bg};color:${m.color};font-family:var(--font-mono);font-weight:500">${m.icon} ${m.label}</span>`
}

const SYM = { EUR: '€', USD: '$', GBP: '£', ILS: '₪', CHF: '₣' }
const fmt = (p, c) => `${SYM[c] || c}${Number(p).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const finalAmt = (price, vat, mode) => {
  const p = parseFloat(price) || 0, v = parseFloat(vat) || 0
  return mode === 'excl' ? p * (1 + v / 100) : p
}

// ─── schema detection ─────────────────────────────────────────
// Probes whether add-product-plans.sql has been applied by doing a
// zero-row select on the product_plans table. Sets window._plansSchemaReady.
async function _detectPlansSchema() {
  try {
    const { error } = await _sb.from('product_plans').select('id').limit(0)
    window._plansSchemaReady = !error
  } catch {
    window._plansSchemaReady = false
  }
}

// ─── init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  if (!guardSpace('operations', 'workload.html')) return
  // Detect whether the product-plans migration has been applied.
  // Silently sets window._plansSchemaReady so deal creation can include
  // product_plan_id / payment_link without causing PGRST204 errors.
  _detectPlansSchema()
  registerRouterHandlers()
  await loadData()

  // Restore page + view from URL params
  const _initParams = new URLSearchParams(window.location.search)
  const _initPage   = _initParams.get('page') || 'dashboard'
  const _initView   = _initParams.get('view') || 'kanban'
  const _hasEntity  = !!_initParams.get('entity')

  if (!_hasEntity) {
    // No entity deep-link — restore page/view
    setView(_initView, { pushUrl: false })
    switchPage(_initPage, null, { pushUrl: false })
  } else {
    setView(_initView, { pushUrl: false })
  }

  if (window.Router) Router.dispatch()
  document.addEventListener('click', e => {
    if (!e.target.closest('.mod-wrap'))
      document.getElementById('mod-dd')?.classList.remove('open')
    // close edit modal on overlay click
    if (e.target === document.getElementById('modal-new-deal'))
      closeNewDeal()
    if (e.target === document.getElementById('modal-product'))
      closeProductModal()
    // close vendor-clients dropdown on outside click
    const vcDd = document.getElementById('vc-cs-dropdown')
    if (vcDd && vcDd.style.display !== 'none' && !e.target.closest('#vc-cs-wrap'))
      vcDd.style.display = 'none'
  })
})

async function loadData() {
  try {
    const [deals, clients, vendors, vendorsInactive, products, companies] = await Promise.all([
      getDeals(),
      getClients(),
      getVendors(),
      getVendorsInactive().catch(() => []),
      getProducts(),
      getCompanies().catch(() => []),
    ])
    _deals           = deals
    _clients         = clients
    _vendors         = vendors
    _vendorsInactive = vendorsInactive
    _products        = products
    _companies       = companies
    render()
  } catch(e) {
    console.error('[HSos] deals loadData error:', e)
    showToast('Failed to load data — check console', 'warn')
  }
}

// ─── module dropdown ──────────────────────────────────────────

function toggleModDD() {
  document.getElementById('mod-dd').classList.toggle('open')
}
window.toggleModDD = toggleModDD

// ─── page switching ───────────────────────────────────────────

function switchPage(name, linkEl, { pushUrl = true } = {}) {
  if (window.Router && !_routerDispatching) {
    const { entity } = Router.getParams()
    const leavingEntityView =
      (entity === 'deal' && name !== 'deals') ||
      (entity === 'vendor' && name !== 'vendors')
    if (leavingEntityView) Router.close()
  }

  _page = name

  if (pushUrl && !_routerDispatching) {
    const qs = new URLSearchParams(window.location.search)
    qs.set('page', name)
    if (name === 'deals') qs.set('view', _view); else qs.delete('view')
    qs.delete('entity'); qs.delete('id'); qs.delete('from')
    history.pushState({}, '', `${window.location.pathname}?${qs}`)
  }

  // Update sidebar active link
  document.querySelectorAll('.sb-link').forEach(a => a.classList.remove('cur'))
  document.getElementById('nav-' + name)?.classList.add('cur')

  // Update space cover title
  const pageTitles = { dashboard: 'Operations', deals: 'Deals', clients: 'Clients', vendors: 'Vendors', products: 'Products' }
  const titleEl = document.getElementById('cover-title')
  if (titleEl) titleEl.textContent = pageTitles[name] || name.charAt(0).toUpperCase() + name.slice(1)
  const eyebrowEl = document.getElementById('cover-eyebrow')
  if (eyebrowEl) eyebrowEl.textContent = `Operations · ${window.Role?.get() || 'Admin'}`

  const toolbar = document.getElementById('deals-toolbar')
  toolbar.style.display = name === 'deals' ? 'flex' : 'none'

  const pages = ['dashboard', 'deals-kanban', 'deals-list', 'clients', 'vendors', 'products']
  pages.forEach(p => document.getElementById(`page-${p}`)?.classList.add('hidden'))

  if (name === 'deals') {
    document.getElementById(_view === 'kanban' ? 'page-deals-kanban' : 'page-deals-list').classList.remove('hidden')
    render()
  } else if (name === 'dashboard') {
    document.getElementById('page-dashboard').classList.remove('hidden')
    renderDashboard()
  } else {
    document.getElementById(`page-${name}`)?.classList.remove('hidden')
    if (name === 'clients')  renderClients()
    if (name === 'vendors')  renderVendors()
    if (name === 'products') {
      // Always reset to list view when navigating to products page
      document.getElementById('products-list-view')?.classList.remove('hidden')
      document.getElementById('plans-detail-view')?.classList.add('hidden')
      initProductsPage()
    }
  }
}
window.switchPage = switchPage

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

  Router.register('deal', ({ id }) => {
    runWithRouterDispatch(() => {
      openEditDeal(id)
    })
  })

  Router.register('vendor', ({ id }) => {
    runWithRouterDispatch(() => {
      openVendorDetail(id)
    })
  })

  Router.register('client', ({ id, from }) => {
    runWithRouterDispatch(() => {
      showClientDetail(id, null, from || 'list')
    })
  })

  document.addEventListener('router:close', () => {
    runWithRouterDispatch(() => {
      clearVendorDetail()
    })
  })

  window.addEventListener('popstate', () => {
    const qs = new URLSearchParams(window.location.search)
    const entity = qs.get('entity')
    if (entity) return  // router handles entity popstate
    const pg = qs.get('page') || 'dashboard'
    const vw = qs.get('view') || 'kanban'
    runWithRouterDispatch(() => {
      if (pg === 'deals') {
        setView(vw, { pushUrl: false })
        switchPage('deals', null, { pushUrl: false })
      } else {
        switchPage(pg, null, { pushUrl: false })
      }
    })
  })
}

// ─── view / filter / search ───────────────────────────────────

function setView(v, { pushUrl = true } = {}) {
  _view = v
  document.getElementById('page-deals-kanban').classList.toggle('hidden', v !== 'kanban')
  document.getElementById('page-deals-list').classList.toggle('hidden',   v !== 'list')
  document.getElementById('vb-kanban').classList.toggle('btn-primary', v === 'kanban')
  document.getElementById('vb-list').classList.toggle('btn-primary',   v === 'list')
  if (pushUrl && !_routerDispatching && _page === 'deals') {
    const qs = new URLSearchParams(window.location.search)
    qs.set('page', 'deals')
    qs.set('view', v)
    qs.delete('entity'); qs.delete('id'); qs.delete('from')
    history.pushState({}, '', `${window.location.pathname}?${qs}`)
  }
  renderDeals()
}
window.setView = setView

function toggleFilter(f, btn) {
  if (_filters.has(f)) { _filters.delete(f); btn.classList.remove('btn-primary') }
  else                 { _filters.add(f);    btn.classList.add('btn-primary') }
  renderDeals()
}
window.toggleFilter = toggleFilter

function setSearch(v) { _search = v.toLowerCase(); renderDeals() }
window.setSearch = setSearch

function setFilterVendor(v) { _fVendor = v; renderDeals() }
window.setFilterVendor = setFilterVendor

function setFilterProduct(v) { _fProduct = v; renderDeals() }
window.setFilterProduct = setFilterProduct

function setFilterBilling(v) { _fBilling = v; renderDeals() }
window.setFilterBilling = setFilterBilling

// ─── master render ────────────────────────────────────────────

function render() {
  renderDeals()
  // Populate filter dropdowns
  const vSel = document.getElementById('filter-vendor')
  const pSel = document.getElementById('filter-product')
  if (vSel) {
    vSel.innerHTML = `<option value="">All vendors</option>` +
      _vendors.map(v => `<option value="${v.id}"${_fVendor === v.id ? ' selected' : ''}>${v.full_name}</option>`).join('')
  }
  if (pSel) {
    pSel.innerHTML = `<option value="">All products</option>` +
      _products.map(p => `<option value="${p.id}"${_fProduct === p.id ? ' selected' : ''}>${p.name}</option>`).join('')
  }
}

// ─── operations dashboard ────────────────────────────────────

let _dashData = null  // cached dashboard supplemental data

async function renderDashboard() {
  renderDashMetrics()
  renderDashKanban()
  // Fetch supplemental data (packages, sessions, bills) in parallel
  try {
    const [allVendors, allPackages, allBills] = await Promise.all([
      // All active vendors (already in _vendors, just use it)
      Promise.resolve(_vendors),
      // Active packages for sessions-remaining info
      getPackages({ status: 'active' }).catch(() => []),
      // Draft/submitted bills awaiting approval
      getAllBills({ status: 'draft' }).catch(() => []),
    ])
    // Also get unpaid (no bill) sessions count per vendor
    const { data: unbilledSessions } = await _sb
      .from('sessions')
      .select('vendor_id')
      .is('bill_id', null)
      .not('task_type_id', 'is', null)
    _dashData = {
      allPackages,
      draftBills: allBills,
      unbilledSessions: unbilledSessions || [],
    }
    // Re-render kanban now that we have package data (adds "Package almost empty" flags)
    renderDashKanbanWithPackages()
    renderDashCoaches()
    renderDashClients()
    renderDashMetricsAttention()
  } catch(e) {
    console.error('[Dashboard]', e)
  }
}

function renderDashMetrics() {
  // Active deals — status != 'completed' (using sales_status)
  const activeDeals = _deals.filter(d => d.sales_status !== 'completed' && d.sales_status !== 'closed')
  const leadDeals   = _deals.filter(d => d.sales_status === 'lead')

  // Active clients — DB field is `active` (boolean)
  const activeClients = _clients.filter(c => c.active === true)
  // Count unique coaches who have active clients
  const coaches = _vendors.filter(v => v.vendor_type === 'coach' && (v.active || v.is_active))
  const contractors = _vendors.filter(v => v.vendor_type === 'contractor' && (v.active || v.is_active))

  _el('dm-active-deals').textContent     = activeDeals.length
  _el('dm-active-deals-sub').textContent = `${leadDeals.length} leads pending`

  _el('dm-active-clients').textContent   = activeClients.length
  // Count coaches serving active clients (vendors that have vendor_clients with active clients)
  const coachesWithClients = coaches.filter(v => (v.clients || []).length > 0)
  _el('dm-active-clients-sub').textContent = `across ${coachesWithClients.length} coaches`

  _el('dm-coaches').textContent    = coaches.length
  _el('dm-coaches-sub').textContent = `${contractors.length} contractors`
}

function renderDashMetricsAttention() {
  if (!_dashData) return

  // Flag: deals with no vendor
  const noVendorDeals = _deals.filter(d =>
    d.sales_status !== 'completed' && d.sales_status !== 'closed' && !d.primary_vendor_id
  )
  // Flag: packages with 1-2 sessions remaining
  const almostEmptyPkgs = _dashData.allPackages.filter(p => {
    const rem = (p.sessions_remaining != null) ? p.sessions_remaining : Math.max(0, (p.total_sessions || 0) - (p.sessions_used || 0))
    return rem >= 1 && rem <= 2
  })
  // Flag: vendors with draft bills awaiting approval
  const vendorsWithDraftBills = new Set(_dashData.draftBills.map(b => b.vendor_id))

  // Breakdown: clients = deals with no coach; coaches = vendors with draft bill; bills = draft bills count
  const flaggedClients = noVendorDeals.length
  const flaggedCoaches = vendorsWithDraftBills.size
  const flaggedBills   = _dashData.draftBills.length + almostEmptyPkgs.length

  const total = flaggedClients + flaggedCoaches + flaggedBills
  const card  = document.getElementById('dm-attention-card')

  _el('dm-attention').textContent = total
  _el('dm-attention-sub').textContent = `${flaggedClients} clients · ${flaggedCoaches} coaches · ${flaggedBills} bills`

  if (total > 0) {
    card.classList.add('alert')
  } else {
    card.classList.remove('alert')
  }
}

function renderDashKanban() {
  const DASH_STAGES = ['lead', 'active', 'completed']
  const stageMap = { lead: [], active: [], completed: [] }

  for (const d of _deals) {
    const s = d.sales_status
    if (stageMap[s]) stageMap[s].push(d)
    else if (s === 'delivered') stageMap.completed.push(d)
    // qualified / closed skipped in compact view
  }

  for (const stage of DASH_STAGES) {
    const col   = document.getElementById(`dk-${stage}`)
    const count = document.getElementById(`dkh-${stage}-count`)
    const items = stageMap[stage]
    if (!col) continue
    if (count) count.textContent = items.length

    if (!items.length) {
      col.innerHTML = `<div style="font-size:11px;color:var(--mu2);padding:8px 2px">No deals</div>`
      continue
    }

    col.innerHTML = items.slice(0, 8).map(d => {
      const client  = d.clients?.full_name || '—'
      const product = d.products?.name || 'Custom'
      const hasVendor = !!d.primary_vendor_id
      const pkg = null  // package data not available until supplemental load

      const flags = []
      if (!hasVendor && stage === 'active') flags.push('No coach assigned')

      return `<div class="dash-kanban-card${flags.length ? ' flagged' : ''}" onclick="openEditDeal('${d.id}',event)">
        <div class="dash-kc-client">${escHtml(client)}</div>
        <div class="dash-kc-product">${escHtml(product)}</div>
        ${flags.map(f => `<div class="dash-kc-flag">${escHtml(f)}</div>`).join('')}
      </div>`
    }).join('')
  }
}

function renderDashKanbanWithPackages() {
  if (!_dashData) return
  const DASH_STAGES = ['lead', 'active', 'completed']
  const stageMap = { lead: [], active: [], completed: [] }
  for (const d of _deals) {
    const s = d.sales_status
    if (stageMap[s]) stageMap[s].push(d)
    else if (s === 'delivered') stageMap.completed.push(d)
  }
  // Build package map by client_id
  const pkgByClient = {}
  for (const pkg of _dashData.allPackages) {
    if (!pkgByClient[pkg.client_id]) pkgByClient[pkg.client_id] = pkg
  }
  for (const stage of DASH_STAGES) {
    const col   = document.getElementById(`dk-${stage}`)
    if (!col) continue
    const items = stageMap[stage]
    if (!items.length) continue
    col.innerHTML = items.slice(0, 8).map(d => {
      const pkg = pkgByClient[d.client_id] || null
      return _dashKanbanCardWithPackage(d, pkg)
    }).join('')
  }
}

function _dashKanbanCardWithPackage(d, pkg) {
  const client  = d.clients?.full_name || '—'
  const product = d.products?.name || 'Custom'
  const hasVendor = !!d.primary_vendor_id

  const flags = []
  if (!hasVendor && d.sales_status === 'active') flags.push('No coach assigned')
  if (pkg) {
    const rem = pkg.sessions_remaining
    if (rem != null && rem >= 1 && rem <= 2) flags.push('Package almost empty')
  }

  return `<div class="dash-kanban-card${flags.length ? ' flagged' : ''}" onclick="openEditDeal('${d.id}',event)">
    <div class="dash-kc-client">${escHtml(client)}</div>
    <div class="dash-kc-product">${escHtml(product)}</div>
    ${d.sales_status === 'active' && pkg ? `<div class="dash-kc-sessions">${pkg.sessions_remaining} sessions left</div>` : ''}
    ${flags.map(f => `<div class="dash-kc-flag">${escHtml(f)}</div>`).join('')}
  </div>`
}

function renderDashCoaches() {
  const el = document.getElementById('dash-coaches-rows')
  if (!el) return

  const coaches = _vendors.filter(v => v.vendor_type === 'coach' && (v.active || v.is_active))
  if (!coaches.length) {
    el.innerHTML = `<div class="dash-widget-empty">No coaches found</div>`
    return
  }

  // Map: vendor_id → count of unbilled sessions
  const unbilledByVendor = {}
  for (const s of (_dashData?.unbilledSessions || [])) {
    if (s.vendor_id) unbilledByVendor[s.vendor_id] = (unbilledByVendor[s.vendor_id] || 0) + 1
  }

  const draftBillVendors = new Set((_dashData?.draftBills || []).map(b => b.vendor_id))

  el.innerHTML = coaches.map(v => {
    const name     = v.full_name || v.name || '—'
    const initStr  = initials(name)
    const bg       = avatarBg(name)
    const fg       = avatarFg(name)
    const clientCt = (v.clients || []).length
    const subject  = v.subject || v.specialty || ''

    const badges = []
    const unbilled = unbilledByVendor[v.id] || 0
    if (unbilled > 0) {
      badges.push(`<span class="dash-badge dash-badge-amber">${unbilled} pending session${unbilled !== 1 ? 's' : ''}</span>`)
    }
    if (draftBillVendors.has(v.id)) {
      badges.push(`<span class="dash-badge dash-badge-blue">bill to approve</span>`)
    }
    if (!badges.length) {
      const isActive = v.active || v.is_active
      badges.push(isActive
        ? `<span class="dash-badge dash-badge-green">active</span>`
        : `<span class="dash-badge dash-badge-gray">paused</span>`)
    }

    return `<div class="dash-widget-row" onclick="openDashboardVendor('${v.id}')">
      <div class="av av-sm" style="background:${bg};color:${fg};flex-shrink:0">${escHtml(initStr)}</div>
      <div class="dash-wr-info">
        <div class="dash-wr-name">${escHtml(name)}</div>
        <div class="dash-wr-sub">${clientCt} client${clientCt !== 1 ? 's' : ''}${subject ? ' · ' + escHtml(subject) : ''}</div>
      </div>
      <div class="dash-wr-badges">${badges.join('')}</div>
    </div>`
  }).join('')
}

function renderDashClients() {
  const el = document.getElementById('dash-clients-rows')
  if (!el) return

  const activeClients = _clients.filter(c => c.status === 'active' || c.active === true)
  if (!activeClients.length) {
    el.innerHTML = `<div class="dash-widget-empty">No active clients</div>`
    return
  }

  // Map: client_id → package
  const pkgByClient = {}
  for (const pkg of (_dashData?.allPackages || [])) {
    if (!pkgByClient[pkg.client_id]) pkgByClient[pkg.client_id] = pkg
  }

  // Map: client_id → vendor name (from vendor_clients in _vendors)
  const coachByClient = {}
  for (const v of _vendors) {
    for (const c of (v.clients || [])) {
      if (c?.id) coachByClient[c.id] = v.full_name || v.name
    }
  }

  // Map: client_id → deals (for product name)
  const dealByClient = {}
  for (const d of _deals) {
    if (!dealByClient[d.client_id] && d.sales_status !== 'closed') {
      dealByClient[d.client_id] = d
    }
  }

  el.innerHTML = activeClients.slice(0, 10).map(c => {
    const name   = c.full_name || '—'
    const bg     = avatarBg(name)
    const fg     = avatarFg(name)
    const initStr = initials(name)
    const coach  = coachByClient[c.id] || null
    const deal   = dealByClient[c.id] || null
    const product = deal?.products?.name || null
    const pkg    = pkgByClient[c.id] || null

    let badge = ''
    if (pkg) {
      const rem = pkg.sessions_remaining != null ? pkg.sessions_remaining : Math.max(0, (pkg.total_sessions || 0) - (pkg.sessions_used || 0))
      if (rem <= 2) {
        badge = `<span class="dash-badge dash-badge-red">${rem} session${rem !== 1 ? 's' : ''} left</span>`
      }
    }
    if (!badge) {
      // Check for unpaid sessions: session with no package
      // (we use the _dashData.unbilledSessions but those are per vendor; skip for now — just show status)
      const status = c.status || (c.active ? 'active' : 'paused')
      badge = status === 'active'
        ? `<span class="dash-badge dash-badge-green">active</span>`
        : `<span class="dash-badge dash-badge-gray">paused</span>`
    }

    const sub = [product, coach ? `w/ ${coach}` : null].filter(Boolean).join(' · ')

    return `<div class="dash-widget-row" onclick="openDashboardClient('${c.id}')">
      <div class="av av-sm" style="background:${bg};color:${fg};flex-shrink:0">${escHtml(initStr)}</div>
      <div class="dash-wr-info">
        <div class="dash-wr-name">${escHtml(name)}</div>
        ${sub ? `<div class="dash-wr-sub">${escHtml(sub)}</div>` : ''}
      </div>
      <div class="dash-wr-badges">${badge}</div>
    </div>`
  }).join('')
}

async function openDashboardVendor(vendorId) {
  openVendorDetail(vendorId)
}
window.openDashboardVendor = openDashboardVendor

function _renderClientDetailPanel(clientId) {
  const detail = document.getElementById('client-detail')
  const client = _clients.find(c => c.id === clientId)
  if (!detail || !client) return

  const deals = _deals.filter(d => d.client_id === clientId)
  const activeDeal = deals.find(d => d.sales_status && d.sales_status !== 'closed') || deals[0] || null
  const pkg = (_dashData?.allPackages || []).find(p => p.client_id === clientId && (p.status === 'active' || !p.status)) || null

  detail.innerHTML = `
    <div style="padding:20px;border-bottom:1px solid var(--border2)">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="av av-lg" style="background:${avatarBg(client.full_name)};color:${avatarFg(client.full_name)}">${initials(client.full_name)}</div>
        <div style="min-width:0">
          <div style="font-size:17px;font-weight:600;color:var(--ink)">${escHtml(client.full_name || '—')}</div>
          <div style="font-size:11px;color:var(--mu)">${escHtml(client.email || 'No email')}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        ${activeDeal ? `<span class="pill" style="font-size:10px">${escHtml(activeDeal.sales_status || 'active')}</span>` : '<span class="pill" style="font-size:10px">No active deal</span>'}
        ${pkg ? `<span class="pill" style="font-size:10px">${pkg.sessions_remaining ?? Math.max(0, (pkg.total_sessions || 0) - (pkg.sessions_used || 0))} sessions left</span>` : '<span class="pill" style="font-size:10px">No active package</span>'}
      </div>
      <button class="btn btn-sm" style="margin-top:12px" onclick="showClientDetail('${clientId}', null, 'clients-panel')">Open full profile</button>
    </div>
    <div class="scroll" style="padding:14px 16px">
      <div style="font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);margin-bottom:8px">Deals</div>
      <div class="block">
        <table class="tbl">
          <thead><tr><th>Product</th><th>Status</th><th>Billing</th><th></th></tr></thead>
          <tbody>
            ${deals.length ? deals.slice(0, 8).map(d => `
              <tr>
                <td>${escHtml(d.products?.name || 'Custom')}</td>
                <td>${escHtml(d.sales_status || '—')}</td>
                <td>${escHtml(d.billing_status || '—')}</td>
                <td><button class="btn btn-sm btn-ghost" style="padding:2px 7px;font-size:11px" onclick="openEditDeal('${d.id}',event)">Edit</button></td>
              </tr>`).join('') : `<tr><td colspan="4" style="text-align:center;color:var(--mu2);padding:16px">No deals yet</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`
}

function openDashboardClient(clientId) {
  showClientDetail(clientId, null, 'dashboard')
}
window.openDashboardClient = openDashboardClient

function _el(id) { return document.getElementById(id) }

function filteredDeals() {
  let d = [..._deals]
  if (_search) {
    d = d.filter(deal => {
      const cn = (deal.clients?.full_name || '').toLowerCase()
      const pn = (deal.products?.name || '').toLowerCase()
      const vn = (deal.vendors?.full_name || '').toLowerCase()
      return cn.includes(_search) || pn.includes(_search) || vn.includes(_search)
    })
  }
  if (_filters.has('overdue')) d = d.filter(x => x.billing_status === 'overdue')
  if (_filters.has('active'))  d = d.filter(x => x.sales_status === 'active')
  if (_filters.has('unpaid'))  d = d.filter(x => !['paid'].includes(x.billing_status))
  if (_fVendor)  d = d.filter(x => x.primary_vendor_id === _fVendor)
  if (_fProduct) d = d.filter(x => x.product_id === _fProduct)
  if (_fBilling) d = d.filter(x => x.billing_status === _fBilling)
  return d
}

// ─── kanban ───────────────────────────────────────────────────

function renderDeals() {
  if (_view === 'kanban') renderKanban()
  else renderList()
}

function renderKanban() {
  const el = document.getElementById('page-deals-kanban')
  const deals = filteredDeals()
  if (!deals.length && !_deals.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">◻</div><div>No deals yet</div></div>`
    return
  }
  el.innerHTML = STAGES.map(stage => {
    const cols = deals.filter(d => d.sales_status === stage.key)
    return `
      <div class="kanban-col" style="min-width:240px">
        <div class="kanban-col-head">
          <span style="display:flex;align-items:center;gap:6px">
            <span style="width:7px;height:7px;border-radius:50%;background:${stage.color};flex-shrink:0"></span>
            ${stage.label}
          </span>
          <span style="font-size:11px">${cols.length}</span>
        </div>
        ${cols.map(d => kanbanCard(d)).join('')}
      </div>
    `
  }).join('')
}

function kanbanCard(d) {
  const client    = d.clients?.full_name || '—'
  const product   = d.products?.name || 'Custom'
  const vendorObj = d.vendors || null
  const vendorName = vendorObj?.full_name || null
  const price     = d.price != null ? fmt(finalAmt(d.price, d.vat_pct, d.vat_mode), d.currency) : null
  const bColor    = BILLING_COLORS[d.billing_status] || 'var(--mu2)'
  const created   = d.created_at ? formatDate(d.created_at) : ''

  const vendorAvatarHtml = vendorObj
    ? vendorObj.profile_picture_url
      ? `<img src="${escHtml(vendorObj.profile_picture_url)}" style="width:16px;height:16px;border-radius:50%;object-fit:cover;flex-shrink:0">`
      : `<div class="av" style="background:${avatarBg(vendorName)};color:${avatarFg(vendorName)};width:16px;height:16px;font-size:7px;flex-shrink:0">${initials(vendorName)}</div>`
    : ''

  return `
    <div class="kanban-card" onclick="openEditDeal('${d.id}',event)">
      <div style="margin-bottom:4px">
        <div style="font-size:13px;font-weight:600;color:var(--ink);line-height:1.3">${product}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <div class="av" style="background:${avatarBg(client)};color:${avatarFg(client)};width:18px;height:18px;font-size:8px;flex-shrink:0">${initials(client)}</div>
        <span style="font-size:12px;color:var(--mu);cursor:pointer;text-decoration:underline;text-underline-offset:2px"
          onclick="openClientFromCard('${d.client_id}',event)">${escHtml(client)}</span>
      </div>
      ${vendorName ? `
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:6px">
        ${vendorAvatarHtml}
        <span style="font-size:11px;color:var(--mu2)">by ${escHtml(vendorName)}</span>
      </div>` : ''}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
        <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 7px;border-radius:20px;background:${bColor}18;color:${bColor};font-weight:500;border:1px solid ${bColor}40">
          ${d.billing_status || '—'}
        </span>
        ${price ? `<span style="font-size:12px;font-family:var(--font-mono);color:var(--ink);font-weight:600">${price}</span>` : ''}
      </div>
      ${created ? `<div style="font-size:10px;color:var(--mu2);margin-top:6px;font-family:var(--font-mono)">${created}</div>` : ''}
    </div>
  `
}

function openClientFromCard(clientId, e) {
  e.stopPropagation()
  showClientDetail(clientId, null, 'kanban')
}
window.openClientFromCard = openClientFromCard

// ─── list view ────────────────────────────────────────────────

function renderList() {
  const tbody = document.getElementById('deals-list-body')
  const deals = filteredDeals()
  if (!deals.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--mu2);padding:24px">No deals found</td></tr>`
    return
  }
  tbody.innerHTML = deals.map(d => {
    const client  = d.clients?.full_name || '—'
    const product = d.products?.name || 'Custom'
    const vendor  = d.vendors?.full_name || '—'
    const price   = d.price != null ? fmt(finalAmt(d.price, d.vat_pct, d.vat_mode), d.currency) : '—'
    const stage   = STAGES.find(s => s.key === d.sales_status)
    const bColor  = BILLING_COLORS[d.billing_status] || 'var(--mu2)'
    return `
      <tr onclick="openEditDeal('${d.id}',event)" style="cursor:pointer">
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="av av-sm" style="background:${avatarBg(client)};color:${avatarFg(client)}">${initials(client)}</div>
            ${client}
          </div>
        </td>
        <td style="font-weight:500">${product}</td>
        <td style="color:var(--mu)">${vendor}</td>
        <td class="mono">${price}</td>
        <td><span style="display:inline-flex;align-items:center;gap:4px;font-size:12px"><span style="width:6px;height:6px;border-radius:50%;background:${stage?.color || 'var(--mu2)'};flex-shrink:0"></span>${d.sales_status}</span></td>
        <td><span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 7px;border-radius:20px;background:${bColor}18;color:${bColor};font-weight:500;border:1px solid ${bColor}40">${d.billing_status}</span></td>
        <td class="mono" style="font-size:11px">${d.payment_processor || '—'}</td>
      </tr>
    `
  }).join('')
}

// ─── deal edit modal ──────────────────────────────────────────

function openEditDeal(id, e) {
  e?.stopPropagation()
  if (window.Router && !_routerDispatching) {
    Router.open({ entity: 'deal', id, view: 'panel', from: _view === 'list' ? 'list' : 'kanban' })
    return
  }
  window.PanelManager?.open('deal', id)
}
window.openEditDeal = openEditDeal


async function _autoCreatePackage(dealId, clientId, vendorId, product) {
  // Check if package already exists for this deal
  const { data: existing } = await _sb
    .from('packages').select('id').eq('deal_id', dealId).maybeSingle()
  if (existing) return  // already exists

  const totalSessions = product.sessions_included || 10
  await createPackage({
    deal_id:       dealId,
    client_id:     clientId,
    vendor_id:     vendorId,
    total_sessions: totalSessions,
    sessions_used:  0,
    status:         'active',
  })
  showToast(`Package created: ${totalSessions} sessions`)
}

async function _autoAssignVendorClient(vendorId, clientId) {
  // Check junction table
  const { data: existing } = await _sb
    .from('vendor_clients')
    .select('vendor_id')
    .eq('vendor_id', vendorId)
    .eq('client_id', clientId)
    .maybeSingle()
  if (existing) return  // already assigned

  await assignClientToVendor(vendorId, clientId)
  // Update local vendor clients list silently
  const v = _vendors.find(x => x.id === vendorId)
  const c = _clients.find(x => x.id === clientId)
  if (v && c) {
    if (!v.clients) v.clients = []
    if (!v.clients.find(x => x.id === clientId)) v.clients.push(c)
  }
}


// ─── new deal modal ───────────────────────────────────────────

let _ndSelClient     = null
let _ndCsOpen        = false
let _ndCsSearch      = ''
let _ndCsFocused     = -1
let _ndQcOpen        = false
let _ndQcName        = ''
let _ndQcEmail       = ''
let _ndSelectedPlan  = null  // selected product_plan record
let _ndCurrentStep   = 1

function _ndGoToStep(step) {
  _ndCurrentStep = step
  ;[1, 2, 3].forEach(n => {
    const el = document.getElementById(`nd-step-${n}`)
    if (el) el.style.display = n === step ? '' : 'none'
    const tab = document.getElementById(`nd-tab-${n}`)
    if (tab) {
      tab.style.color = n === step ? 'var(--ink)' : 'var(--mu2)'
      tab.style.borderBottom = n === step ? '2px solid var(--ink)' : '2px solid transparent'
    }
  })
}

async function ndStep1Next() {
  const productId = document.getElementById('nd-product').value
  if (!productId) {
    // Skip plan step if no product — go straight to details
    _ndSelectedPlan = null
    _ndGoToStep(3)
    _prefillStep3FromPlan(null)
    return
  }
  const country = document.getElementById('nd-country').value || null
  _ndGoToStep(2)
  await _ndLoadPlans(productId, country)
}
window.ndStep1Next = ndStep1Next

function ndStepBack(toStep) {
  _ndGoToStep(toStep)
}
window.ndStepBack = ndStepBack

async function _ndLoadPlans(productId, country) {
  const loading = document.getElementById('nd-plans-loading')
  const list    = document.getElementById('nd-plans-list')
  const noPlans = document.getElementById('nd-no-plans')
  const nextBtn = document.getElementById('nd-step2-next')

  loading.style.display = 'block'
  list.innerHTML = ''
  noPlans.style.display = 'none'
  nextBtn.disabled = true
  _ndSelectedPlan = null

  try {
    const plans = await getProductPlans(productId, country)
    loading.style.display = 'none'

    if (!plans.length) {
      noPlans.style.display = 'block'
      nextBtn.disabled = false
      return
    }

    list.innerHTML = plans.map((p, i) => {
      const isDefault = p.is_default
      const gatewayColors = {
        green_invoice: 'var(--green)', stripe: 'var(--blue)',
        thrivecart: 'var(--purple)', wise: 'var(--amber)',
      }
      const gColor = gatewayColors[p.collection_gateway] || 'var(--mu2)'
      const installLabel = p.installments > 1
        ? `${p.installments} × ${Math.round(p.price / p.installments)} ${p.currency}`
        : `${p.price} ${p.currency}`
      const countryLabel = p.target_customer_country ? `🌍 ${p.target_customer_country}` : '🌐 Default'
      return `
        <div class="nd-plan-card" id="nd-plan-${p.id}"
          onclick="ndSelectPlan('${p.id}')"
          style="border:2px solid var(--border);border-radius:var(--r);padding:12px 14px;cursor:pointer;transition:border-color .1s">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-size:13px;font-weight:600">${p.plan_name}</div>
            <div style="display:flex;align-items:center;gap:6px">
              ${isDefault ? `<span style="font-size:10px;background:var(--gold-bg);color:var(--gold);border:1px solid var(--gold-border);padding:1px 8px;border-radius:10px;font-family:var(--font-mono)">default</span>` : ''}
              <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${gColor}20;color:${gColor};font-family:var(--font-mono);font-weight:500">${p.collection_gateway}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:16px;font-size:12px;color:var(--mu)">
            <span>💰 ${installLabel}</span>
            <span>${countryLabel}</span>
            ${p.collection_gateway_link ? `<span style="color:var(--blue-text)">🔗 Has link</span>` : ''}
            ${p.vendors ? `<span>👤 ${p.vendors.full_name}</span>` : ''}
          </div>
          ${p.plan_code ? `<div style="font-size:10px;font-family:var(--font-mono);color:var(--mu2);margin-top:4px">${p.plan_code}</div>` : ''}
        </div>
      `
    }).join('')

    // Auto-select the first (highest priority) plan
    if (plans[0]) ndSelectPlan(plans[0].id, plans[0])
  } catch(e) {
    loading.style.display = 'none'
    noPlans.style.display = 'block'
    noPlans.textContent = 'Failed to load plans — you can still create a manual deal.'
    nextBtn.disabled = false
    console.error('[HSos] _ndLoadPlans error:', e)
  }
}

function ndSelectPlan(planId, planObj) {
  // Deselect all
  document.querySelectorAll('.nd-plan-card').forEach(c => {
    c.style.borderColor = 'var(--border)'
    c.style.background  = ''
  })
  // Highlight selected
  const card = document.getElementById(`nd-plan-${planId}`)
  if (card) { card.style.borderColor = 'var(--ink)'; card.style.background = 'var(--bg)' }
  // Find plan object from the DOM list (we may not have planObj if called from onclick)
  _ndSelectedPlan = planObj || null
  document.getElementById('nd-step2-next').disabled = false
}
window.ndSelectPlan = ndSelectPlan

function ndStep2Next() {
  _ndGoToStep(3)
  _prefillStep3FromPlan(_ndSelectedPlan)
}
window.ndStep2Next = ndStep2Next

function _prefillStep3FromPlan(plan) {
  // Vendor
  const vendorSel = document.getElementById('nd-vendor')
  if (vendorSel) {
    vendorSel.innerHTML = `<option value="">— Vendor —</option>` +
      _vendors.map(v => `<option value="${v.id}"${plan?.vendor_id === v.id ? ' selected' : ''}>${v.full_name}</option>`).join('')
  }
  // Price + currency
  if (plan) {
    const priceEl = document.getElementById('nd-price')
    const curEl   = document.getElementById('nd-currency')
    if (priceEl) priceEl.value = plan.price || ''
    if (curEl)   curEl.value   = plan.currency || 'EUR'
  }
  calcNdVat()
  requestAnimationFrame(() => _initNdNotesQuill())

  // Plan summary banner
  const summary     = document.getElementById('nd-plan-summary')
  const summaryName = document.getElementById('nd-plan-summary-name')
  const summaryDet  = document.getElementById('nd-plan-summary-detail')
  if (plan && summary) {
    summary.style.display = 'block'
    summaryName.textContent = plan.plan_name || ''
    const installLabel = plan.installments > 1
      ? `${plan.installments} installments × ${Math.round(plan.price / plan.installments)} ${plan.currency}`
      : `${plan.price} ${plan.currency}`
    summaryDet.textContent = `${plan.collection_gateway} · ${installLabel}${plan.plan_code ? ' · ' + plan.plan_code : ''}`
  } else if (summary) {
    summary.style.display = 'none'
  }

  // Payment link row
  const linkRow = document.getElementById('nd-payment-link-row')
  const linkEl  = document.getElementById('nd-payment-link')
  if (plan?.collection_gateway_link && linkRow && linkEl) {
    linkRow.style.display = 'block'
    linkEl.value = plan.collection_gateway_link
  } else if (linkRow) {
    linkRow.style.display = 'none'
  }
}

function copyNdPaymentLink() {
  const val = document.getElementById('nd-payment-link')?.value
  if (val) { navigator.clipboard.writeText(val); showToast('Link copied') }
}
window.copyNdPaymentLink = copyNdPaymentLink

// Customer email lookup (debounced)
let _ndEmailTimer = null
async function onNdCustomerEmailInput(val) {
  clearTimeout(_ndEmailTimer)
  const hint = document.getElementById('nd-customer-hint')
  if (!val || !val.includes('@')) { if (hint) hint.textContent = ''; return }
  _ndEmailTimer = setTimeout(async () => {
    try {
      const existing = await getCustomerByEmail(val)
      if (hint) {
        hint.textContent = existing
          ? `✓ Known customer: ${existing.full_name}${existing.country ? ' · ' + existing.country : ''}`
          : '+ Will create new customer record on deal creation'
        hint.style.color = existing ? 'var(--green-text)' : 'var(--mu2)'
        // Auto-fill country if known
        if (existing?.country) {
          const sel = document.getElementById('nd-country')
          if (sel) sel.value = existing.country
        }
      }
    } catch { if (hint) hint.textContent = '' }
  }, 400)
}
window.onNdCustomerEmailInput = onNdCustomerEmailInput

function openNewDeal() {
  _ndSelClient = null; _ndCsOpen = false; _ndCsSearch = ''; _ndCsFocused = -1
  _ndSelectedPlan = null

  // Reset step
  _ndGoToStep(1)

  // Reset step 3 fields (they may not exist yet if we haven't gone to step 3)
  const priceEl   = document.getElementById('nd-price')
  const vatEl     = document.getElementById('nd-vat')
  const vatPrevEl = document.getElementById('nd-vat-preview')
  if (priceEl)   priceEl.value = ''
  if (vatEl)     vatEl.value   = ''
  if (vatPrevEl) vatPrevEl.textContent = ''

  // Populate product select (step 1)
  document.getElementById('nd-product').innerHTML = `<option value="">— Product (optional) —</option>` +
    _products.map(p => `<option value="${p.id}">${p.name}</option>`).join('')

  // Reset customer email hint
  const hint = document.getElementById('nd-customer-hint')
  const emailEl = document.getElementById('nd-customer-email')
  if (hint)    hint.textContent = ''
  if (emailEl) emailEl.value   = ''
  const countrySel = document.getElementById('nd-country')
  if (countrySel) countrySel.value = ''

  _renderNdCs()
  document.getElementById('modal-new-deal').classList.add('open')
}
window.openNewDeal = openNewDeal

function closeNewDeal() {
  document.getElementById('modal-new-deal').classList.remove('open')
}
window.closeNewDeal = closeNewDeal

function _ndBuildCsTrigger() {
  if (_ndSelClient) {
    return `
      <div class="cs-trigger" onclick="ndCsToggle()">
        <div class="av" style="background:${avatarBg(_ndSelClient.full_name)};color:${avatarFg(_ndSelClient.full_name)};width:20px;height:20px;font-size:9px;flex-shrink:0">${initials(_ndSelClient.full_name)}</div>
        <span style="flex:1;color:var(--ink)">${_ndSelClient.full_name}</span>
        <span onclick="ndCsClear(event)" style="color:var(--mu2);font-size:14px;line-height:1;cursor:pointer;padding:0 2px">×</span>
      </div>
    `
  }
  return `
    <div class="cs-trigger" onclick="ndCsToggle()">
      <span style="color:var(--mu2);flex:1">Select client…</span>
      <span style="color:var(--mu2);font-size:10px">▾</span>
    </div>
  `
}

function _ndBuildCsDropdown() {
  if (!_ndCsOpen) return ''
  const filtered = _ndCsSearch
    ? _clients.filter(c => c.full_name.toLowerCase().includes(_ndCsSearch.toLowerCase()) || (c.email || '').toLowerCase().includes(_ndCsSearch.toLowerCase()))
    : _clients
  return `
    <div class="cs-dropdown">
      <div style="padding:6px 8px;border-bottom:1px solid var(--border2)">
        <input class="fi" style="height:30px;font-size:12px" placeholder="Search…" id="nd-cs-search"
          oninput="ndCsSearch(this.value)" onkeydown="ndCsKeydown(event)"
          value="${_ndCsSearch}" autocomplete="off">
      </div>
      <div class="cs-list">
        ${filtered.length ? filtered.map((c, i) => `
          <div class="cs-item${_ndSelClient?.id === c.id ? ' cs-sel' : ''}${_ndCsFocused === i ? ' cs-focused' : ''}"
            onclick="ndCsSelect('${c.id}')">
            <div class="av" style="background:${avatarBg(c.full_name)};color:${avatarFg(c.full_name)};width:20px;height:20px;font-size:9px;flex-shrink:0">${initials(c.full_name)}</div>
            <div>
              <div style="font-size:13px;color:var(--ink)">${c.full_name}</div>
              ${c.email ? `<div style="font-size:11px;color:var(--mu2)">${c.email}</div>` : ''}
            </div>
          </div>
        `).join('') : `
          <div style="padding:10px 12px">
            <div style="font-size:12px;color:var(--mu2);margin-bottom:8px">No clients found${_ndCsSearch ? ' for "' + escHtml(_ndCsSearch) + '"' : ''}</div>
            ${_ndQcOpen ? `
              <div style="display:flex;flex-direction:column;gap:6px">
                <input class="fi" id="nd-qc-name" type="text" placeholder="Full name *" style="height:30px;font-size:12px"
                  value="${escHtml(_ndQcName)}" oninput="_ndQcName=this.value">
                <input class="fi" id="nd-qc-email" type="email" placeholder="Email (optional)" style="height:30px;font-size:12px"
                  value="${escHtml(_ndQcEmail)}" oninput="_ndQcEmail=this.value">
                <div style="display:flex;gap:6px">
                  <button class="btn btn-primary btn-sm" onclick="ndQcSubmit(event)" style="flex:1">Create & select</button>
                  <button class="btn btn-sm" onclick="ndQcCancel(event)">Cancel</button>
                </div>
              </div>
            ` : `
              <button class="btn btn-sm" onclick="ndQcOpen(event)" style="width:100%;font-size:12px">+ Create new client</button>
            `}
          </div>
        `}
      </div>
    </div>
  `
}

function _renderNdCs() {
  const wrap = document.getElementById('nd-cs-wrap')
  if (!wrap) return
  wrap.innerHTML = _ndBuildCsTrigger() + _ndBuildCsDropdown()
  if (_ndCsOpen) document.getElementById('nd-cs-search')?.focus()
}

function ndCsToggle() { _ndCsOpen = !_ndCsOpen; _ndCsFocused = -1; _renderNdCs() }
window.ndCsToggle = ndCsToggle

function ndCsClear(e) { e.stopPropagation(); _ndSelClient = null; _ndCsOpen = false; _ndCsSearch = ''; _renderNdCs() }
window.ndCsClear = ndCsClear

function ndCsSearch(v) { _ndCsSearch = v; _ndCsFocused = -1; _ndQcOpen = false; _ndQcName = v; _ndQcEmail = ''; _renderNdCs() }
window.ndCsSearch = ndCsSearch

function ndCsSelect(id) { _ndSelClient = _clients.find(c => c.id === id) || null; _ndCsOpen = false; _ndCsSearch = ''; _renderNdCs() }
window.ndCsSelect = ndCsSelect

function ndCsKeydown(e) {
  const filtered = _ndCsSearch
    ? _clients.filter(c => c.full_name.toLowerCase().includes(_ndCsSearch.toLowerCase()) || (c.email || '').toLowerCase().includes(_ndCsSearch.toLowerCase()))
    : _clients
  if (e.key === 'ArrowDown') { e.preventDefault(); _ndCsFocused = Math.min(_ndCsFocused + 1, filtered.length - 1); _renderNdCs() }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _ndCsFocused = Math.max(_ndCsFocused - 1, -1); _renderNdCs() }
  else if (e.key === 'Enter') { e.preventDefault(); if (_ndCsFocused >= 0 && filtered[_ndCsFocused]) ndCsSelect(filtered[_ndCsFocused].id) }
  else if (e.key === 'Escape') { _ndCsOpen = false; _renderNdCs() }
}
window.ndCsKeydown = ndCsKeydown

function ndQcOpen(e) {
  e?.stopPropagation()
  _ndQcOpen = true
  _renderNdCs()
  setTimeout(() => document.getElementById('nd-qc-name')?.focus(), 40)
}
window.ndQcOpen = ndQcOpen

function ndQcCancel(e) {
  e?.stopPropagation()
  _ndQcOpen = false; _ndQcName = ''; _ndQcEmail = ''
  _renderNdCs()
}
window.ndQcCancel = ndQcCancel

async function ndQcSubmit(e) {
  e?.stopPropagation()
  const name  = (document.getElementById('nd-qc-name')?.value  || _ndQcName).trim()
  const email = (document.getElementById('nd-qc-email')?.value || _ndQcEmail).trim()
  if (!name) { showToast('Name is required', 'warn'); return }
  try {
    const newClient = await createClient({ full_name: name, email: email || null, source: 'manual', active: true })
    _clients.push(newClient)
    _clients.sort((a, b) => a.full_name.localeCompare(b.full_name))
    _ndQcOpen = false; _ndQcName = ''; _ndQcEmail = ''
    ndCsSelect(newClient.id)
    showToast(`${newClient.full_name} created`, 'success')
  } catch (err) {
    showToast('Failed to create: ' + err.message, 'warn')
  }
}
window.ndQcSubmit = ndQcSubmit

function onNdProductChange(id) {
  const p = _products.find(x => x.id === id)
  if (p) {
    document.getElementById('nd-price').value = p.base_price || ''
    if (p.currency) document.getElementById('nd-currency').value = p.currency
    calcNdVat()
  }
}
window.onNdProductChange = onNdProductChange

function calcNdVat() {
  const price = parseFloat(document.getElementById('nd-price').value) || 0
  const vat   = parseFloat(document.getElementById('nd-vat').value) || 0
  const cur   = document.getElementById('nd-currency').value
  const final = price * (1 + vat / 100)
  const prev  = document.getElementById('nd-vat-preview')
  if (price > 0) {
    prev.textContent = vat > 0
      ? `Base: ${fmt(price, cur)} + VAT (${vat}%): ${fmt(price * vat / 100, cur)} = Final: ${fmt(final, cur)}`
      : `Final: ${fmt(price, cur)}`
  } else {
    prev.textContent = ''
  }
}
window.calcNdVat = calcNdVat

async function submitNewDeal() {
  const clientId  = _ndSelClient?.id || null
  const vendorId  = document.getElementById('nd-vendor')?.value
  const productId = document.getElementById('nd-product').value
  const price     = parseFloat(document.getElementById('nd-price')?.value) || null
  const currency  = document.getElementById('nd-currency')?.value || 'EUR'
  const vatPct    = parseFloat(document.getElementById('nd-vat')?.value) || 0
  const sales     = document.getElementById('nd-sales')?.value || 'lead'
  const billing   = document.getElementById('nd-billing')?.value || 'pending'
  const notes     = _quillValue(_ndNotesQuill)

  if (!clientId) { showToast('Select a client', 'warn'); return }

  try {
    const fields = {
      client_id:         clientId,
      primary_vendor_id: vendorId || null,
      product_id:        productId || null,
      price,
      currency,
      vat_pct:           vatPct,
      vat_mode:          'excl',
      sales_status:      sales,
      billing_status:    billing,
      notes,
    }
    // These columns require migrations/add-product-plans.sql to be applied first.
    // Only include them if the migration has run (checked by feature flag on window).
    if (window._plansSchemaReady) {
      fields.product_plan_id = _ndSelectedPlan?.id || null
      fields.payment_link    = _ndSelectedPlan?.collection_gateway_link || null
    }
    const newDeal = await createDeal(fields)
    closeNewDeal()
    showToast('Deal created')

    // Auto-create package if applicable
    const product = _products.find(p => p.id === productId)
    if (product?.type === 'package' && vendorId && clientId) {
      await _autoCreatePackage(newDeal.id, clientId, vendorId, product)
    }

    // Auto-assign vendor to client
    if (vendorId && clientId) {
      await _autoAssignVendorClient(vendorId, clientId)
    }

    await loadData()
  } catch(e) {
    console.error('[HSos] createDeal error:', e)
    showToast('Failed to create deal — check console', 'warn')
  }
}
window.submitNewDeal = submitNewDeal

// ─── clients page ─────────────────────────────────────────────

function setClientsSearch(v) {
  _clientSearch = v.toLowerCase()
  renderClients()
}
window.setClientsSearch = setClientsSearch

function renderClients() {
  const list = document.getElementById('clients-list')
  let clients = [..._clients]
  if (_clientSearch) clients = clients.filter(c => c.full_name.toLowerCase().includes(_clientSearch))

  list.innerHTML = clients.map(c => {
    const deals = _deals.filter(d => d.client_id === c.id)
    return `
      <div class="client-list-item${_selClientId === c.id ? ' sel' : ''}" onclick="showClientDetail('${c.id}',event)" style="position:relative">
        <div class="av av-sm" style="background:${avatarBg(c.full_name)};color:${avatarFg(c.full_name)}">${initials(c.full_name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.full_name)}</div>
          <div style="font-size:11px;color:var(--mu2)">${deals.length} deal${deals.length !== 1 ? 's' : ''}</div>
        </div>
        <button class="client-del-btn" onclick="deleteClientFromList('${c.id}',event)" title="Delete client"
          style="display:none;position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--red);font-size:14px;padding:2px 4px;line-height:1">&#x2715;</button>
      </div>
    `
  }).join('') || `<div style="padding:24px;text-align:center;color:var(--mu2)">No clients found</div>`

  // Show/hide delete button on hover
  list.querySelectorAll('.client-list-item').forEach(row => {
    const btn = row.querySelector('.client-del-btn')
    row.addEventListener('mouseenter', () => { if (btn) btn.style.display = '' })
    row.addEventListener('mouseleave', () => { if (btn) btn.style.display = 'none' })
  })
}

function showClientDetail(clientId, e, from = 'list') {
  e?.stopPropagation()
  const source = from || 'list'
  if (window.Router && !_routerDispatching) {
    Router.open({
      entity: 'client',
      id: clientId,
      view: 'panel',
      from: source,
    })
    return
  }
  window.PanelManager?.open('client', clientId)
}

window.showClientDetail = showClientDetail

// ─── add client panel ─────────────────────────────────────────

function openAddClientPanel() {
  // Reset form
  document.getElementById('ac-name').value    = ''
  document.getElementById('ac-email').value   = ''
  document.getElementById('ac-phone').value   = ''
  document.getElementById('ac-notes').value   = ''
  document.getElementById('ac-source').value  = 'manual'
  document.getElementById('ac-company').value = ''
  document.querySelector('input[name="ac-kind"][value="private"]').checked = true
  document.getElementById('ac-company-row').style.display = 'none'

  document.getElementById('add-client-overlay').style.display = 'block'
  document.getElementById('add-client-panel').style.display   = 'flex'
  setTimeout(() => document.getElementById('ac-name').focus(), 50)
}
window.openAddClientPanel = openAddClientPanel

function closeAddClientPanel() {
  document.getElementById('add-client-overlay').style.display = 'none'
  document.getElementById('add-client-panel').style.display   = 'none'
}
window.closeAddClientPanel = closeAddClientPanel

function acToggleCompany(val) {
  document.getElementById('ac-company-row').style.display = val === 'corporate' ? 'block' : 'none'
}
window.acToggleCompany = acToggleCompany

async function submitAddClient() {
  const name = document.getElementById('ac-name').value.trim()
  if (!name) { showToast('Full name is required', 'warn'); return }

  const kind = document.querySelector('input[name="ac-kind"]:checked')?.value || 'private'
  const fields = {
    full_name:   name,
    email:       document.getElementById('ac-email').value.trim()   || null,
    phone:       document.getElementById('ac-phone').value.trim()   || null,
    client_kind: kind,
    company:     kind === 'corporate' ? (document.getElementById('ac-company').value.trim() || null) : null,
    source:      document.getElementById('ac-source').value,
    notes:       document.getElementById('ac-notes').value.trim()   || null,
    active:      true,
  }

  try {
    const newClient = await createClient(fields)
    _clients.push(newClient)
    _clients.sort((a, b) => a.full_name.localeCompare(b.full_name))
    closeAddClientPanel()
    renderClients()
    showToast(`${newClient.full_name} added`, 'success')
    // Auto-navigate to the new client's profile
    showClientDetail(newClient.id, null, 'list')
  } catch (err) {
    showToast('Failed to create client: ' + err.message, 'warn')
  }
}
window.submitAddClient = submitAddClient

async function deleteClientFromList(clientId, e) {
  e?.stopPropagation()
  const client = _clients.find(c => c.id === clientId)
  if (!client) return
  const activeDeals = _deals.filter(d => d.client_id === clientId)
  const dealWarning = activeDeals.length
    ? ` This client has ${activeDeals.length} deal${activeDeals.length !== 1 ? 's' : ''} that will also be deleted.`
    : ''
  showConfirm(
    `Delete "${client.full_name}"? This cannot be undone.${dealWarning}`,
    async () => {
      try {
        await deleteClient(clientId)
        _clients = _clients.filter(c => c.id !== clientId)
        _deals   = _deals.filter(d => d.client_id !== clientId)
        if (_selClientId === clientId) _selClientId = null
        renderClients()
        renderDeals()
        showToast(`${client.full_name} deleted`)
      } catch(err) {
        console.error('[HSos] deleteClientFromList error:', err)
        showToast('Delete failed — check console', 'warn')
      }
    }
  )
}
window.deleteClientFromList = deleteClientFromList

// ─── AC import panel ──────────────────────────────────────────

let _acParsed = [] // [{first_name, last_name, email, phone, tags[], _status, _existing}]

function openAcImportPanel() {
  document.getElementById('ac-paste-input').value = ''
  document.getElementById('ac-parse-error').style.display = 'none'
  _showAcStep(1)
  document.getElementById('ac-import-overlay').style.display = 'block'
  document.getElementById('ac-import-panel').style.display   = 'flex'
}
window.openAcImportPanel = openAcImportPanel

function closeAcImportPanel() {
  document.getElementById('ac-import-overlay').style.display = 'none'
  document.getElementById('ac-import-panel').style.display   = 'none'
  _acParsed = []
}
window.closeAcImportPanel = closeAcImportPanel

function _showAcStep(n) {
  document.getElementById('ac-step-1').style.display = n === 1 ? 'flex' : 'none'
  document.getElementById('ac-step-2').style.display = n === 2 ? 'flex' : 'none'
  document.getElementById('ac-import-title').textContent = n === 1 ? 'Import from ActiveCampaign' : 'Review & Import'
  document.getElementById('ac-import-sub').textContent   = n === 1 ? 'Paste contact data to import' : 'Review parsed contacts before importing'
}

function _acParseJSON(raw) {
  const arr = JSON.parse(raw)
  if (!Array.isArray(arr)) throw new Error('Expected a JSON array')
  return arr.map(r => ({
    first_name: (r.first_name || r.firstName || r['First Name'] || '').trim(),
    last_name:  (r.last_name  || r.lastName  || r['Last Name']  || '').trim(),
    email:      (r.email      || r['Email']   || '').trim().toLowerCase(),
    phone:      (r.phone      || r['Phone']   || '').trim(),
    tags:       Array.isArray(r.tags) ? r.tags : (r.tags ? String(r.tags).split(',').map(t => t.trim()) : []),
    external_id:(r.id || r.contact_id || '').toString().trim() || null,
  }))
}

function _acParseCSV(raw) {
  const lines = raw.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row')
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1).map(line => {
    const vals = line.split(',')
    const row  = {}
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim() })
    const tagsRaw = row.tags || ''
    return {
      first_name:  row.first_name  || '',
      last_name:   row.last_name   || '',
      email:       (row.email      || '').toLowerCase(),
      phone:       row.phone       || '',
      tags:        tagsRaw ? tagsRaw.split(';').map(t => t.trim()).filter(Boolean) : [],
      external_id: row.id || row.contact_id || null,
    }
  })
}

function acParseAndReview() {
  const raw = document.getElementById('ac-paste-input').value.trim()
  const errEl = document.getElementById('ac-parse-error')
  errEl.style.display = 'none'

  if (!raw) { errEl.textContent = 'Paste some data first'; errEl.style.display = 'block'; return }

  let rows = []
  try {
    rows = raw.startsWith('[') || raw.startsWith('{') ? _acParseJSON(raw) : _acParseCSV(raw)
  } catch (err) {
    errEl.textContent = 'Parse error: ' + err.message
    errEl.style.display = 'block'
    return
  }

  if (!rows.length) { errEl.textContent = 'No contacts found in pasted data'; errEl.style.display = 'block'; return }

  // Dedup against existing clients by email
  const existingByEmail = {}
  _clients.forEach(c => { if (c.email) existingByEmail[c.email.toLowerCase()] = c })

  _acParsed = rows.map(r => {
    const full = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || 'Unknown'
    const existing = r.email ? existingByEmail[r.email.toLowerCase()] : null
    return { ...r, _fullName: full, _existing: existing || null, _merge: !!existing, _selected: true }
  })

  _renderAcReviewTable()
  _showAcStep(2)
}
window.acParseAndReview = acParseAndReview

function _renderAcReviewTable() {
  const tbody = document.getElementById('ac-review-tbody')
  const countEl = document.getElementById('ac-review-count')
  const selected = _acParsed.filter(r => r._selected).length
  countEl.textContent = `${selected} / ${_acParsed.length} selected`

  tbody.innerHTML = _acParsed.map((r, i) => {
    const isDup = !!r._existing
    const statusHtml = isDup
      ? `<div style="font-size:11px;color:var(--amber-text)">Duplicate</div>
         <label style="font-size:10px;display:flex;align-items:center;gap:4px;margin-top:2px;cursor:pointer">
           <input type="checkbox" ${r._merge ? 'checked' : ''} onchange="acToggleMerge(${i},this.checked)"> merge
         </label>`
      : `<span style="font-size:11px;color:var(--green-text)">New</span>`

    return `<tr style="opacity:${r._selected ? '1' : '0.4'}">
      <td><input type="checkbox" ${r._selected ? 'checked' : ''} onchange="acToggleRow(${i},this.checked)"></td>
      <td style="font-weight:500;font-size:13px">${escHtml(r._fullName)}</td>
      <td style="font-family:var(--font-mono);font-size:11px;color:var(--mu)">${escHtml(r.email || '—')}</td>
      <td style="font-size:12px">${escHtml(r.phone || '—')}</td>
      <td style="font-size:11px;color:var(--mu2)">${(r.tags || []).map(t => `<span class="pill" style="background:var(--bg)">${escHtml(t)}</span>`).join(' ')}</td>
      <td>${statusHtml}</td>
    </tr>`
  }).join('')
}

function acToggleRow(i, checked) {
  _acParsed[i]._selected = checked
  _renderAcReviewTable()
  // Sync select-all checkbox
  const allSelected = _acParsed.every(r => r._selected)
  document.getElementById('ac-select-all').checked = allSelected
}
window.acToggleRow = acToggleRow

function acToggleMerge(i, checked) {
  _acParsed[i]._merge = checked
}
window.acToggleMerge = acToggleMerge

function acToggleSelectAll(checked) {
  _acParsed.forEach(r => { r._selected = checked })
  _renderAcReviewTable()
}
window.acToggleSelectAll = acToggleSelectAll

function acBackToStep1() { _showAcStep(1) }
window.acBackToStep1 = acBackToStep1

async function acImportSelected() {
  const toProcess = _acParsed.filter(r => r._selected)
  if (!toProcess.length) { showToast('Select at least one contact', 'warn'); return }

  let imported = 0, merged = 0, skipped = 0, errors = 0

  for (const r of toProcess) {
    try {
      if (r._existing && r._merge) {
        // Merge: only fill empty fields
        const updates = {}
        const ex = r._existing
        if (!ex.phone && r.phone)      updates.phone      = r.phone
        if (!ex.client_kind)           updates.client_kind = 'private'
        if (!ex.external_id && r.external_id) updates.external_id = r.external_id
        if (Object.keys(updates).length) await updateClient(ex.id, updates)
        merged++
      } else if (!r._existing) {
        // New client
        const created = await createClient({
          full_name:   r._fullName,
          email:       r.email  || null,
          phone:       r.phone  || null,
          source:      'activecampaign',
          external_id: r.external_id || null,
          active:      true,
        })
        _clients.push(created)
        imported++
      } else {
        skipped++
      }
    } catch (_) {
      errors++
    }
  }

  _clients.sort((a, b) => a.full_name.localeCompare(b.full_name))
  closeAcImportPanel()
  renderClients()

  const parts = []
  if (imported) parts.push(`${imported} imported`)
  if (merged)   parts.push(`${merged} merged`)
  if (skipped)  parts.push(`${skipped} skipped`)
  if (errors)   parts.push(`${errors} errors`)
  showToast(parts.join(', '), errors ? 'warn' : 'success')
}
window.acImportSelected = acImportSelected

// ─── vendors page ─────────────────────────────────────────────

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
    // Show billing interval from notes or just —
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

  // Update tab counts
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

  // Group by vendor_type
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
  // snapshot current values for cancel
  _vendorEditSnapshot = { ...v }
  _vendorEditMode = true
  renderVendorDetail()
}
window.enterVendorEditMode = enterVendorEditMode

function cancelVendorEdit() {
  // No in-memory mutations happen during edit mode — just exit edit mode
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

  // Avatar HTML
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

  // View-mode helpers
  const viewRow = (label, val) => `
    <div class="sp-row">
      <span class="sp-row-label">${label}</span>
      <span class="sp-row-val">${val || '<span style="color:var(--mu2)">—</span>'}</span>
    </div>`

  // Edit-mode helpers
  const sec = (title) => `<div style="font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.12em;color:var(--mu2);margin:18px 0 10px;padding-bottom:4px;border-bottom:1px solid var(--border2)">${title}</div>`
  const row2 = (a, b) => `<div class="form-row" style="margin-bottom:10px">${a}${b}</div>`
  const fi = (id, label, val, type='text', extra='') =>
    `<div class="fg"><label class="fl">${label}</label><input class="fi" id="${id}" type="${type}" value="${escHtml(val || '')}" ${extra}></div>`

  if (!em) {
    // ── View mode ──
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

  // ── Edit mode ──
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
  // Latest bill section
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
  // strip undefined
  Object.keys(fields).forEach(k => fields[k] === undefined && delete fields[k])

  try {
    await updateVendor(id, fields)
    // update in-memory in the right pool
    const activeIdx = _vendors.findIndex(v => v.id === id)
    const archiveIdx = _vendorsInactive.findIndex(v => v.id === id)

    const wasActive = activeIdx !== -1
    const isNowActive = fields.active !== false

    if (wasActive && isNowActive) {
      _vendors[activeIdx] = { ..._vendors[activeIdx], ...fields }
    } else if (wasActive && !isNowActive) {
      // moved to archive
      const moved = { ..._vendors[activeIdx], ...fields }
      _vendors.splice(activeIdx, 1)
      _vendorsInactive.push(moved)
      _vendorListTab = 'archived'
    } else if (!wasActive && isNowActive) {
      // reactivated
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

  // Populate paying company dropdown from loaded companies
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

// ─── delete vendor ────────────────────────────────────────────

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

// ─── avatar upload ────────────────────────────────────────────

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

// ─── vendor-clients dropdown helpers ─────────────────────────

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

// ─── products page ────────────────────────────────────────────

async function initProductsPage(force = false) {
  if (_productsPageLoading) return
  if (_productsPageLoaded && !force) {
    renderProducts()
    return
  }

  const container = document.getElementById('products-container')
  if (container) {
    container.innerHTML = `
      <div class="products-page-head">
        <h1 class="products-page-title">Products</h1>
        <button class="btn btn-primary btn-sm" onclick="openProductModal(null)">+ New Product</button>
      </div>
      <div class="products-page-loading">Loading products…</div>
    `
  }

  _productsPageLoading = true
  try {
    _programsWithProducts = await getProductsWithPlans()
    _productsPageLoaded = true
    _productInlineEdit = { id: null, draft: null }
    _planInlineEdit = { productId: null, planId: null, isNew: false, draft: null }
    renderProducts()
  } catch (e) {
    console.error('[HSos] initProductsPage error:', e)
    showToast(`Failed to load products: ${e.message || e}`, 'warn')
    if (container) {
      container.innerHTML = `
        <div class="products-page-head">
          <h1 class="products-page-title">Products</h1>
          <button class="btn btn-primary btn-sm" onclick="openProductModal(null)">+ New Product</button>
        </div>
        <div class="products-page-empty">Failed to load products</div>
      `
    }
  } finally {
    _productsPageLoading = false
  }
}

function _formatProductBasePrice(product) {
  if (product?.base_price == null) return '—'
  const currency = product.base_currency || product.currency || ''
  return `${Number(product.base_price).toLocaleString('en', { maximumFractionDigits: 2 })} ${currency}`.trim()
}

function _getPlanTypeMeta(plan) {
  const type = plan?.payment_type || ''
  if (type === 'one-payment') return { label: 'One payment', cls: 'one-time' }
  if (type === 'installments') {
    const count = parseInt(plan?.installments_count, 10)
    return { label: `${Number.isFinite(count) ? count : '—'} payments`, cls: 'installment' }
  }
  if (type === 'subscription') return { label: 'Subscription', cls: 'subscription' }
  return { label: type || '—', cls: 'manual' }
}

function _truncateUrl(url, max = 30) {
  if (!url) return '—'
  return url.length > max ? `${url.slice(0, max)}...` : url
}

function _findProductInPrograms(productId) {
  for (const program of (_programsWithProducts || [])) {
    const product = (program.products || []).find(p => p.id === productId)
    if (product) return product
  }
  return null
}

function _renderPlanDisplayRow(product, plan) {
  const meta = _getPlanTypeMeta(plan)
  const amount = plan?.amount == null
    ? '—'
    : Number(plan.amount).toLocaleString('en', { maximumFractionDigits: 2 })
  const currency = plan?.currency || '—'
  const url = plan?.payment_link_url || ''
  const pid = escHtmlAttr(product.id)
  const planId = escHtmlAttr(plan.id)

  return `
    <tr>
      <td>
        <span class="products-plan-pill ${meta.cls}">${meta.label}</span>
      </td>
      <td class="products-plan-amount">${amount}</td>
      <td>${escHtml(currency)}</td>
      <td>
        ${url
          ? `<a class="products-plan-link" href="${escHtmlAttr(url)}" target="_blank" rel="noopener">${escHtml(_truncateUrl(url))}</a>`
          : '—'}
      </td>
      <td>
        <button class="products-text-link" onclick="startPlanInlineEdit('${pid}','${planId}')">Edit</button>
      </td>
    </tr>
  `
}

function _renderPlanEditRow(product, isNew = false) {
  const draft = _planInlineEdit.draft || {}
  const pid = escHtmlAttr(product.id)
  const planId = escHtmlAttr(_planInlineEdit.planId || '')
  const showInstallments = draft.payment_type === 'installments'
  const currency = draft.currency || product.base_currency || product.currency || 'USD'

  return `
    <tr class="products-plan-edit-row">
      <td>
        <select class="fi fsel products-inline-select" onchange="setPlanInlineField('payment_type', this.value)">
          ${['one-payment','installments','subscription'].map(type =>
            `<option value="${type}"${(draft.payment_type || 'one-payment') === type ? ' selected' : ''}>${type}</option>`
          ).join('')}
        </select>
        ${showInstallments ? `
          <select class="fi fsel products-inline-select" onchange="setPlanInlineField('installments_count', this.value)">
            <option value="">— # payments —</option>
            ${Array.from({length: 36}, (_, i) => i + 1).map(n =>
              `<option value="${n}"${String(draft.installments_count) === String(n) ? ' selected' : ''}>${n}</option>`
            ).join('')}
          </select>` : ''}
      </td>
      <td>
        <input
          class="fi products-inline-input"
          type="number"
          step="0.01"
          value="${escHtml(draft.amount ?? '')}"
          oninput="setPlanInlineField('amount', this.value)"
        >
      </td>
      <td>
        <select class="fi fsel products-inline-select" onchange="setPlanInlineField('currency', this.value)">
          ${['USD','ILS','EUR','GBP'].map(c =>
            `<option value="${c}"${currency === c ? ' selected' : ''}>${c}</option>`
          ).join('')}
        </select>
      </td>
      <td>
        <input
          class="fi products-inline-input"
          type="text"
          value="${escHtml(draft.payment_link_url || '')}"
          placeholder="https://..."
          oninput="setPlanInlineField('payment_link_url', this.value)"
        >
      </td>
      <td class="products-actions-cell">
        <button class="products-text-link" onclick="savePlanInlineEdit('${pid}','${isNew ? '' : planId}')">Save</button>
        <button class="products-text-link" onclick="cancelPlanInlineEdit()">Cancel</button>
      </td>
    </tr>
  `
}

function _renderProductPlanArea(product) {
  const plans = [...(product.plans || [])]
  const isEditingInThisProduct = _planInlineEdit.productId === product.id
  const isAddingInThisProduct = isEditingInThisProduct && _planInlineEdit.isNew

  const rows = plans.map(plan => {
    const isEditingThisPlan = isEditingInThisProduct && !_planInlineEdit.isNew && _planInlineEdit.planId === plan.id
    return isEditingThisPlan ? _renderPlanEditRow(product, false) : _renderPlanDisplayRow(product, plan)
  }).join('')

  const addRow = isAddingInThisProduct ? _renderPlanEditRow(product, true) : ''

  if (!plans.length && !isAddingInThisProduct) {
    return `
      <div class="products-plan-empty">
        No plans — <button class="products-text-link" onclick="startAddPlanInline('${escHtmlAttr(product.id)}')">Add plan</button>
      </div>
      <div class="products-card-subfooter">
        <button class="products-text-link" onclick="startAddPlanInline('${escHtmlAttr(product.id)}')">Add plan</button>
      </div>
    `
  }

  return `
    <div class="products-plans-table-wrap">
      <table class="products-plans-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Amount</th>
            <th>Currency</th>
            <th>Payment Link</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows}${addRow}
        </tbody>
      </table>
    </div>
    <div class="products-card-subfooter">
      ${isAddingInThisProduct
        ? ''
        : `<button class="products-text-link" onclick="startAddPlanInline('${escHtmlAttr(product.id)}')">Add plan</button>`}
    </div>
  `
}

function renderProducts() {
  const container = document.getElementById('products-container')
  if (!container) return

  const programs = [...(_programsWithProducts || [])]
    .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
    .map(program => ({
      ...program,
      products: [...(program.products || [])]
        .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
    }))

  if (!programs.length) {
    container.innerHTML = `
      <div class="products-page-head">
        <h1 class="products-page-title">Products</h1>
        <button class="btn btn-primary btn-sm" onclick="openProductModal(null)">+ New Product</button>
      </div>
      <div class="products-page-empty">No programs</div>
    `
    return
  }

  container.innerHTML = `
    <div class="products-page-head">
      <h1 class="products-page-title">Products</h1>
      <button class="btn btn-primary btn-sm" onclick="openProductModal(null)">+ New Product</button>
    </div>
    <div class="products-programs">
      ${programs.map(program => {
        const products = program.products || []
        const count = products.length
        const isCollapsed = _collapsedPrograms.has(program.id)
        return `
          <section class="products-program-section">
            <div class="products-program-head">
              <div class="products-program-title-wrap">
                <h2 class="products-program-title">${escHtml(program.name || 'Untitled program')}</h2>
                <span class="products-program-count">${count} product${count === 1 ? '' : 's'}</span>
              </div>
              <button class="products-program-toggle" onclick="toggleProgramSection('${escHtmlAttr(program.id)}')">
                ${isCollapsed ? '▸' : '▾'}
              </button>
            </div>
            <div class="products-program-body${isCollapsed ? ' hidden' : ''}">
              ${count
                ? `<div class="products-cards-grid">
                    ${products.map(product => {
                      const isEditingProduct = _productInlineEdit.id === product.id
                      const draft = _productInlineEdit.draft || {}
                      return `
                        <article class="products-card">
                          <div class="products-card-head">
                            <div class="products-card-name">
                              ${isEditingProduct
                                ? `<input
                                    class="fi products-inline-input"
                                    type="text"
                                    value="${escHtml(draft.name || '')}"
                                    oninput="setProductInlineField('name', this.value)"
                                  >`
                                : escHtml(product.name || '—')}
                            </div>
                            <div class="products-card-price">
                              ${isEditingProduct
                                ? `
                                  <input
                                    class="fi products-inline-input products-inline-price"
                                    type="number"
                                    step="0.01"
                                    value="${escHtml(draft.base_price ?? '')}"
                                    oninput="setProductInlineField('base_price', this.value)"
                                  >
                                  <select
                                    class="fi fsel products-inline-select products-inline-currency"
                                    onchange="setProductInlineField('base_currency', this.value)"
                                  >
                                    ${['USD','ILS','EUR','GBP'].map(c =>
                                      `<option value="${c}"${(draft.base_currency || 'USD') === c ? ' selected' : ''}>${c}</option>`
                                    ).join('')}
                                  </select>`
                                : escHtml(_formatProductBasePrice(product))}
                            </div>
                          </div>

                          ${_renderProductPlanArea(product)}

                          <div class="products-card-footer">
                            ${isEditingProduct
                              ? `
                                <button class="products-text-link" onclick="saveProductInlineEdit('${escHtmlAttr(product.id)}')">Save</button>
                                <button class="products-text-link" onclick="cancelProductInlineEdit()">Cancel</button>
                              `
                              : `<button class="products-text-link" onclick="startProductInlineEdit('${escHtmlAttr(product.id)}')">Edit product</button>`}
                          </div>
                        </article>
                      `
                    }).join('')}
                  </div>`
                : `<div class="products-program-empty">No products yet</div>`}
            </div>
          </section>
        `
      }).join('')}
    </div>
  `
}

function toggleProgramSection(programId) {
  if (!programId) return
  if (_collapsedPrograms.has(programId)) _collapsedPrograms.delete(programId)
  else _collapsedPrograms.add(programId)
  renderProducts()
}
window.toggleProgramSection = toggleProgramSection

function startProductInlineEdit(productId) {
  const product = _findProductInPrograms(productId)
  if (!product) return
  _productInlineEdit = {
    id: productId,
    draft: {
      name: product.name || '',
      base_price: product.base_price ?? '',
      base_currency: product.base_currency || product.currency || 'USD',
    },
  }
  renderProducts()
}
window.startProductInlineEdit = startProductInlineEdit

function setProductInlineField(field, value) {
  if (!_productInlineEdit.id) return
  _productInlineEdit = {
    ..._productInlineEdit,
    draft: {
      ...(_productInlineEdit.draft || {}),
      [field]: value,
    }
  }
}
window.setProductInlineField = setProductInlineField

function cancelProductInlineEdit() {
  _productInlineEdit = { id: null, draft: null }
  renderProducts()
}
window.cancelProductInlineEdit = cancelProductInlineEdit

async function saveProductInlineEdit(productId) {
  const product = _findProductInPrograms(productId)
  if (!product) return

  const draft = _productInlineEdit.draft || {}
  const name = String(draft.name || '').trim()
  const basePriceRaw = String(draft.base_price ?? '').trim()
  const basePrice = basePriceRaw === '' ? null : Number(basePriceRaw)
  const baseCurrency = String(draft.base_currency || '').trim() || 'USD'

  if (!name) {
    showToast('Product name is required', 'warn')
    return
  }
  if (basePriceRaw !== '' && !Number.isFinite(basePrice)) {
    showToast('Base price must be a number', 'warn')
    return
  }

  const currencyField = Object.prototype.hasOwnProperty.call(product, 'base_currency') ? 'base_currency' : 'currency'
  const fields = { name, base_price: basePrice, [currencyField]: baseCurrency }

  try {
    const updated = await updateProduct(productId, fields)
    const i = _products.findIndex(p => p.id === productId)
    if (i !== -1) _products[i] = { ..._products[i], ...updated }
    showToast('Product updated')
    await initProductsPage(true)
  } catch (e) {
    console.error('[HSos] saveProductInlineEdit error:', e)
    showToast(`Failed to update product: ${e.message || e}`, 'warn')
  }
}
window.saveProductInlineEdit = saveProductInlineEdit

function startPlanInlineEdit(productId, planId) {
  const product = _findProductInPrograms(productId)
  const plan = (product?.plans || []).find(p => p.id === planId)
  if (!product || !plan) return

  _planInlineEdit = {
    productId,
    planId,
    isNew: false,
    draft: {
      payment_type: plan.payment_type || 'one-payment',
      amount: plan.amount ?? '',
      currency: plan.currency || product.base_currency || product.currency || 'USD',
      payment_link_url: plan.payment_link_url || '',
      installments_count: plan.installments_count ?? '',
    },
  }
  renderProducts()
}
window.startPlanInlineEdit = startPlanInlineEdit

function startAddPlanInline(productId) {
  const product = _findProductInPrograms(productId)
  if (!product) return
  _planInlineEdit = {
    productId,
    planId: null,
    isNew: true,
    draft: {
      payment_type: 'one-payment',
      amount: '',
      currency: product.base_currency || product.currency || 'USD',
      payment_link_url: '',
      installments_count: '',
    },
  }
  renderProducts()
}
window.startAddPlanInline = startAddPlanInline

function setPlanInlineField(field, value) {
  if (!_planInlineEdit.productId) return
  const nextDraft = {
    ...(_planInlineEdit.draft || {}),
    [field]: value,
  }
  if (field === 'payment_type' && value !== 'installments') {
    nextDraft.installments_count = ''
  }
  _planInlineEdit = { ..._planInlineEdit, draft: nextDraft }
  if (field === 'payment_type') renderProducts()
}
window.setPlanInlineField = setPlanInlineField

function cancelPlanInlineEdit() {
  _planInlineEdit = { productId: null, planId: null, isNew: false, draft: null }
  renderProducts()
}
window.cancelPlanInlineEdit = cancelPlanInlineEdit

function _defaultPlanName(type, installmentsCount) {
  if (type === 'one_time') return 'One payment'
  if (type === 'installment') return `${installmentsCount || '—'} payments`
  if (type === 'subscription') return 'Subscription'
  return 'Manual'
}

async function savePlanInlineEdit(productId) {
  if (_planInlineEdit.productId !== productId) return
  const draft = _planInlineEdit.draft || {}

  const paymentType = String(draft.payment_type || 'one_time')
  const amountRaw = String(draft.amount ?? '').trim()
  const amount = amountRaw === '' ? null : Number(amountRaw)
  const currency = String(draft.currency || 'USD').trim() || 'USD'
  const paymentLink = String(draft.payment_link_url || '').trim() || null
  const installmentsRaw = String(draft.installments_count ?? '').trim()
  const installmentsCount = paymentType === 'installments'
    ? (installmentsRaw === '' ? null : parseInt(installmentsRaw, 10))
    : null

  if (amountRaw !== '' && !Number.isFinite(amount)) {
    showToast('Amount must be a number', 'warn')
    return
  }
  if (paymentType === 'installment' && (!Number.isFinite(installmentsCount) || installmentsCount < 2)) {
    showToast('Installments count must be 2 or more', 'warn')
    return
  }

  const fields = {
    payment_type: paymentType,
    amount,
    currency,
    payment_link_url: paymentLink,
    installments_count: installmentsCount,
  }

  try {
    if (_planInlineEdit.isNew) {
      await insertPlan({
        ...fields,
        product_id: productId,
        name: _defaultPlanName(paymentType, installmentsCount),
      })
      showToast('Plan added')
    } else {
      await updatePlan(_planInlineEdit.planId, fields)
      showToast('Plan updated')
    }
    await initProductsPage(true)
  } catch (e) {
    console.error('[HSos] savePlanInlineEdit error:', e)
    showToast(`Failed to save plan: ${e.message || e}`, 'warn')
  }
}
window.savePlanInlineEdit = savePlanInlineEdit

// ─── product modal ────────────────────────────────────────────

function openProductModal(id, e) {
  e?.stopPropagation()
  if (id && window.PanelManager?.open) {
    window.PanelManager.open('product', id)
    return
  }
  _editProductId = id
  const p = id ? _products.find(x => x.id === id) : null

  const body = document.getElementById('product-modal-body')
  const title = document.getElementById('product-modal-title')
  title.textContent = id ? 'Edit Product' : 'New Product'

  // Parse payment_links jsonb — could be object or array of {url,label}
  let plText = ''
  if (p?.payment_links) {
    try {
      plText = typeof p.payment_links === 'string' ? p.payment_links : JSON.stringify(p.payment_links, null, 2)
    } catch { plText = '' }
  }

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="fg">
        <label class="fl">Name</label>
        <input class="fi" id="pm-name" value="${p?.name || ''}" placeholder="Product name">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="fg">
          <label class="fl">Type</label>
          <select class="fi fsel" id="pm-type" onchange="onPmTypeChange(this.value)">
            ${['session','package','workshop','custom'].map(t => `<option value="${t}"${p?.type === t ? ' selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="fg">
          <label class="fl">Category</label>
          <input class="fi" id="pm-category" value="${p?.category || ''}" placeholder="e.g. fitness, coaching">
        </div>
        <div class="fg">
          <label class="fl">Base price</label>
          <input class="fi" type="number" id="pm-price" value="${p?.base_price != null ? p.base_price : ''}" placeholder="0">
        </div>
        <div class="fg">
          <label class="fl">Currency</label>
          <select class="fi fsel" id="pm-currency">
            ${['EUR','USD','ILS','GBP'].map(c => `<option value="${c}"${(p?.currency || 'EUR') === c ? ' selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="fg" id="pm-sessions-wrap" style="${p?.type === 'package' ? '' : 'display:none'}">
        <label class="fl">Default sessions (package)</label>
        <input class="fi" type="number" id="pm-sessions" value="${p?.default_package_sessions || ''}" placeholder="e.g. 10">
      </div>
      <div class="fg">
        <label class="fl">Payment links (JSON)</label>
        <textarea class="fi" id="pm-links" rows="3" placeholder='{"stripe":"https://...","checkout":"https://..."}'>${plText}</textarea>
        <div style="font-size:10px;color:var(--mu2);margin-top:3px">JSON object or array of {"url":"…","label":"…"}</div>
      </div>
      <div class="fg">
        <label class="fl">Notes</label>
        <textarea class="fi" id="pm-notes" rows="2">${p?.notes || ''}</textarea>
      </div>
    </div>
  `

  document.getElementById('pm-delete-btn').style.display = id ? 'block' : 'none'
  document.getElementById('modal-product').classList.add('open')
}
window.openProductModal = openProductModal

function closeProductModal() {
  document.getElementById('modal-product').classList.remove('open')
  _editProductId = null
}
window.closeProductModal = closeProductModal

function onPmTypeChange(type) {
  const wrap = document.getElementById('pm-sessions-wrap')
  if (wrap) wrap.style.display = type === 'package' ? '' : 'none'
}
window.onPmTypeChange = onPmTypeChange

async function saveProductModal() {
  const name     = document.getElementById('pm-name').value.trim()
  const type     = document.getElementById('pm-type').value
  const category = document.getElementById('pm-category').value.trim() || null
  const price    = parseFloat(document.getElementById('pm-price').value) || null
  const currency = document.getElementById('pm-currency').value
  const sessions = type === 'package' ? (parseInt(document.getElementById('pm-sessions').value) || null) : null
  const notes    = document.getElementById('pm-notes').value.trim() || null
  const linksRaw = document.getElementById('pm-links').value.trim()

  if (!name) { showToast('Product name required', 'warn'); return }

  let payment_links = null
  if (linksRaw) {
    try {
      payment_links = JSON.parse(linksRaw)
    } catch {
      showToast('Payment links must be valid JSON', 'warn')
      return
    }
  }

  const fields = { name, type, category, base_price: price, currency, default_package_sessions: sessions, notes, payment_links }

  try {
    if (_editProductId) {
      const updated = await updateProduct(_editProductId, fields)
      const i = _products.findIndex(p => p.id === _editProductId)
      if (i !== -1) _products[i] = { ..._products[i], ...updated }
      showToast('Product saved')
    } else {
      const created = await createProduct({ ...fields, active: true })
      _products.push(created)
      showToast('Product created')
    }
    closeProductModal()
    if (_page === 'products') await initProductsPage(true)
  } catch(e) {
    console.error('[HSos] saveProductModal error:', e)
    showToast('Save failed — check console', 'warn')
  }
}
window.saveProductModal = saveProductModal

async function deleteProductModal() {
  if (!_editProductId) return
  const p = _products.find(x => x.id === _editProductId)
  showConfirm(`Delete product "${p?.name}"? This cannot be undone.`, async () => {
    try {
      await deleteProduct(_editProductId)
      _products = _products.filter(x => x.id !== _editProductId)
      closeProductModal()
      if (_page === 'products') await initProductsPage(true)
      showToast('Product deleted')
    } catch(e) {
      console.error('[HSos] deleteProductModal error:', e)
      showToast('Delete failed — check console', 'warn')
    }
  })
}
window.deleteProductModal = deleteProductModal

// ─── plans page (product_plans) ───────────────────────────────

let _plansProductId  = null
let _plans           = []

const GATEWAY_META = {
  green_invoice: 'Green Invoice',
  thrivecart:    'ThriveCart',
  wise:          'Wise',
  stripe:        'Stripe',
}

async function openPlansView(productId, e) {
  e?.stopPropagation()
  _plansProductId = productId
  const product = _products.find(p => p.id === productId)

  document.getElementById('plans-product-name').textContent = product?.name || '—'
  document.getElementById('plans-product-meta').textContent =
    [product?.type, product?.category].filter(Boolean).join(' · ') || ''

  document.getElementById('products-list-view').classList.add('hidden')
  document.getElementById('plans-detail-view').classList.remove('hidden')

  await reloadPlans()
}
window.openPlansView = openPlansView

function closePlansView() {
  _plansProductId = null
  _plans = []
  document.getElementById('plans-detail-view').classList.add('hidden')
  document.getElementById('products-list-view').classList.remove('hidden')
}
window.closePlansView = closePlansView

async function reloadPlans() {
  const container = document.getElementById('plans-container')
  container.innerHTML = '<div style="color:var(--mu2);font-size:12px;padding:8px">Loading…</div>'
  try {
    _plans = await getAllProductPlans(_plansProductId)
    renderPlans()
  } catch (err) {
    console.error(err)
    container.innerHTML = '<div style="color:var(--red-text);font-size:12px;padding:8px">Failed to load plans</div>'
  }
}

function renderPlans() {
  const container = document.getElementById('plans-container')
  if (!_plans.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--mu2)">
        No plans yet — click <strong>+ Add Plan</strong> to create one.
      </div>`
    return
  }

  container.innerHTML = `
    <div class="block">
      <table class="tbl">
        <thead>
          <tr>
            <th>Plan name</th>
            <th>Gateway</th>
            <th>Price</th>
            <th>Installments</th>
            <th>Country</th>
            <th>Vendor</th>
            <th>Default</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${_plans.map(plan => `
            <tr style="${!plan.active ? 'opacity:0.45' : ''}">
              <td style="font-weight:500">
                ${plan.plan_name}${!plan.active ? ' <span style="font-size:10px;color:var(--mu2)">(inactive)</span>' : ''}
                ${plan.collection_gateway_link ? `
                  <a href="${escHtmlAttr(plan.collection_gateway_link)}" target="_blank" rel="noopener"
                     style="margin-left:6px;color:var(--blue-text);font-size:11px;text-decoration:none" title="${escHtmlAttr(plan.collection_gateway_link)}">🔗</a>
                  <button class="btn btn-sm" style="margin-left:2px;padding:1px 5px;font-size:10px"
                    onclick="event.stopPropagation();navigator.clipboard.writeText('${escHtmlAttr(plan.collection_gateway_link)}').then(()=>showToast('Link copied'))">⎘</button>
                ` : ''}
              </td>
              <td style="font-size:12px;color:var(--mu)">${GATEWAY_META[plan.collection_gateway] || plan.collection_gateway}</td>
              <td class="mono">${fmt(plan.price, plan.currency)}</td>
              <td class="mono">${plan.installments > 1 ? plan.installments + 'x' : '1x'}</td>
              <td style="font-size:12px;color:var(--mu)">${plan.target_customer_country || '—'}</td>
              <td style="font-size:12px;color:var(--mu)">${plan.vendors?.full_name || '—'}</td>
              <td>${plan.is_default ? '<span class="pill active" style="font-size:10px">default</span>' : ''}</td>
              <td style="text-align:right">
                <button class="btn btn-sm" onclick="openPlanModal('${plan.id}',event)">Edit</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`
}

function openPlanModal(id, e) {
  e?.stopPropagation()
  window.PanelManager?.open('plan', id)
}
window.openPlanModal = openPlanModal
