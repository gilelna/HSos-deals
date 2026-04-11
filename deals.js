// deals.js — HSos Sales space
// Depends on: db.js, app.js

// ─── rich text editor (Quill) instances ──────────────────────
let _edNotesQuill = null   // Edit deal modal
let _ndNotesQuill = null   // New deal modal

function _initEdNotesQuill(initialHtml) {
  if (!_edNotesQuill) {
    _edNotesQuill = new Quill('#ed-notes-editor', {
      theme: 'snow',
      placeholder: 'Add notes…',
      modules: { toolbar: [['bold','italic','underline'],[{list:'ordered'},{list:'bullet'}],['link'],['clean']] },
    })
  }
  _edNotesQuill.root.innerHTML = initialHtml || ''
}

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

// deal edit modal
let _editDealId = null

// client selector in edit modal
let _edCsOpen    = false
let _edCsSearch  = ''
let _edCsFocused = -1
let _edSelClient = null

// products page
let _editProductId = null        // null = new

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
  // Detect whether the product-plans migration has been applied.
  // Silently sets window._plansSchemaReady so deal creation can include
  // product_plan_id / payment_link without causing PGRST204 errors.
  _detectPlansSchema()
  registerRouterHandlers()
  await loadData()

  // Restore page + view from URL params
  const _initParams = new URLSearchParams(window.location.search)
  const _initPage   = _initParams.get('page') || 'deals'
  const _initView   = _initParams.get('view') || 'kanban'
  const _hasEntity  = !!_initParams.get('entity')

  if (!_hasEntity) {
    // No entity deep-link — restore page/view
    setView(_initView, { pushUrl: false })
    if (_initPage !== 'deals') {
      switchPage(_initPage, null, { pushUrl: false })
    }
  } else {
    setView(_initView, { pushUrl: false })
  }

  if (window.Router) Router.dispatch()
  document.addEventListener('click', e => {
    if (!e.target.closest('.mod-wrap'))
      document.getElementById('mod-dd')?.classList.remove('open')
    // close edit modal on overlay click
    if (e.target === document.getElementById('modal-edit-deal'))
      closeEditDeal()
    if (e.target === document.getElementById('modal-new-deal'))
      closeNewDeal()
    if (e.target === document.getElementById('modal-product'))
      closeProductModal()
    // close CS dropdown on outside click
    if (_edCsOpen && !e.target.closest('#ed-cs-wrap'))
      _edCsClose()
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
  const pageTitles = { deals: 'Deals', clients: 'Clients', vendors: 'Vendors', products: 'Products' }
  const titleEl = document.getElementById('cover-title')
  if (titleEl) titleEl.textContent = pageTitles[name] || name.charAt(0).toUpperCase() + name.slice(1)
  const eyebrowEl = document.getElementById('cover-eyebrow')
  if (eyebrowEl) eyebrowEl.textContent = `Sales · ${window.Role?.get() || 'Admin'}`

  const toolbar = document.getElementById('deals-toolbar')
  toolbar.style.display = name === 'deals' ? 'flex' : 'none'

  const pages = ['deals-kanban', 'deals-list', 'clients', 'vendors', 'products']
  pages.forEach(p => document.getElementById(`page-${p}`)?.classList.add('hidden'))

  if (name === 'deals') {
    document.getElementById(_view === 'kanban' ? 'page-deals-kanban' : 'page-deals-list').classList.remove('hidden')
    render()
  } else {
    document.getElementById(`page-${name}`)?.classList.remove('hidden')
    if (name === 'clients')  renderClients()
    if (name === 'vendors')  renderVendors()
    if (name === 'products') {
      // Always reset to list view when navigating to products page
      document.getElementById('products-list-view')?.classList.remove('hidden')
      document.getElementById('plans-detail-view')?.classList.add('hidden')
      renderProducts()
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

  Router.register('deal', ({ id, from }) => {
    runWithRouterDispatch(() => {
      const navDeals = document.getElementById('nav-deals')
      switchPage('deals', navDeals)
      if (from === 'list' || from === 'kanban') setView(from)
      openEditDeal(id)
    })
  })

  Router.register('vendor', ({ id }) => {
    runWithRouterDispatchAsync(async () => {
      const navVendors = document.getElementById('nav-vendors')
      switchPage('vendors', navVendors)
      await openVendorDetail(id)
    })
  })

  Router.register('client', ({ id, from }) => {
    const url = Router.urlFor({
      path: 'client-profile.html',
      entity: 'client',
      id,
      view: 'page',
      from: from || 'list',
    })
    window.location.href = url
  })

  document.addEventListener('router:close', () => {
    runWithRouterDispatch(() => {
      closeEditDeal()
      clearVendorDetail()
    })
  })

  window.addEventListener('popstate', () => {
    const qs = new URLSearchParams(window.location.search)
    const entity = qs.get('entity')
    if (entity) return  // router handles entity popstate
    const pg = qs.get('page') || 'deals'
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
    Router.open({
      entity: 'deal',
      id,
      view: 'modal',
      from: _view === 'list' ? 'list' : 'kanban',
    })
    return
  }

  _editDealId = id
  const deal = _deals.find(d => d.id === id)
  if (!deal) return

  // Init client selector state
  _edSelClient = _clients.find(c => c.id === deal.client_id) || null
  _edCsOpen    = false
  _edCsSearch  = ''
  _edCsFocused = -1

  _renderEditDealModal(deal)
  document.getElementById('modal-edit-deal').classList.add('open')
}
window.openEditDeal = openEditDeal

function closeEditDeal() {
  _editDealId = null
  document.getElementById('modal-edit-deal').classList.remove('open')
  if (window.Router && !_routerDispatching && Router.getParams().entity === 'deal') {
    Router.close()
  }
}
window.closeEditDeal = closeEditDeal

function _renderEditDealModal(deal) {
  const body = document.getElementById('edit-deal-body')

  // ── Payment info blocks ──────────────────────────────────────
  // Payment link section (only if link exists)
  const paymentLinkHtml = deal.payment_link ? `
    <div style="background:var(--blue-bg);border:1px solid var(--blue);border-radius:var(--r);padding:10px 12px;margin-bottom:4px">
      <div style="font-size:10px;font-family:var(--font-mono);color:var(--blue-text);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Payment Link</div>
      <div style="display:flex;align-items:center;gap:6px">
        <a href="${escHtmlAttr(deal.payment_link)}" target="_blank" rel="noopener"
           style="font-size:11px;font-family:var(--font-mono);color:var(--blue-text);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none"
           title="${escHtmlAttr(deal.payment_link)}">${escHtml(deal.payment_link)}</a>
        <button class="btn btn-sm" style="flex-shrink:0;padding:3px 8px;font-size:11px"
          onclick="copyDealLink('${escHtmlAttr(deal.payment_link)}')">Copy</button>
        <a href="${escHtmlAttr(deal.payment_link)}" target="_blank" rel="noopener"
           class="btn btn-sm" style="flex-shrink:0;padding:3px 8px;font-size:11px;text-decoration:none">Open ↗</a>
      </div>
    </div>` : ''

  // Paid details (only when payment_status === 'paid')
  const paidHtml = (deal.payment_status === 'paid' && deal.paid_at) ? (() => {
    const amt = deal.paid_amount != null
      ? `${SYM[deal.paid_currency] || deal.paid_currency || ''}${Number(deal.paid_amount).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : null
    return `
      <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--green-text);background:var(--green-bg);border:1px solid var(--green);border-radius:var(--r);padding:8px 12px;margin-bottom:4px">
        <span>✅</span>
        <span>${amt ? `Paid ${amt}` : 'Paid'} on ${formatDate(deal.paid_at)}</span>
      </div>`
  })() : ''

  // Gateway / payment method badge
  const gatewayHtml = deal.payment_method ? (() => {
    const label = GATEWAY_LABELS[deal.payment_method] || deal.payment_method
    return `<span style="font-size:10px;font-family:var(--font-mono);padding:2px 8px;border-radius:10px;background:var(--bg);border:1px solid var(--border);color:var(--mu)">${label}</span>`
  })() : ''

  body.innerHTML = `
    ${paidHtml}
    ${paymentLinkHtml}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="fg" style="grid-column:1/-1">
        <label class="fl">Client</label>
        <div class="cs-wrap" id="ed-cs-wrap">
          ${_edBuildCsTrigger()}
          ${_edBuildCsDropdown()}
        </div>
      </div>
      <div class="fg">
        <label class="fl">Vendor</label>
        <select class="fi fsel" id="ed-vendor">
          <option value="">— None —</option>
          ${_vendors.map(v => `<option value="${v.id}"${deal.primary_vendor_id === v.id ? ' selected' : ''}>${v.full_name}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <label class="fl">Product</label>
        <select class="fi fsel" id="ed-product" onchange="onEdProductChange(this.value)">
          <option value="">— Custom —</option>
          ${_products.map(p => `<option value="${p.id}"${deal.product_id === p.id ? ' selected' : ''}>${p.name}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <label class="fl">Price</label>
        <input class="fi" type="number" id="ed-price" value="${deal.price != null ? deal.price : ''}" placeholder="0" oninput="calcEdVat()">
      </div>
      <div class="fg">
        <label class="fl">Currency</label>
        <select class="fi fsel" id="ed-currency" onchange="calcEdVat()">
          ${['EUR','USD','ILS','GBP'].map(c => `<option value="${c}"${deal.currency === c ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <label class="fl">VAT %</label>
        <input class="fi" type="number" id="ed-vat" value="${deal.vat_pct || ''}" placeholder="0" oninput="calcEdVat()">
      </div>
      <div class="fg">
        <label class="fl">VAT mode</label>
        <select class="fi fsel" id="ed-vatmode" onchange="calcEdVat()">
          <option value="excl"${deal.vat_mode !== 'incl' ? ' selected' : ''}>+ on top</option>
          <option value="incl"${deal.vat_mode === 'incl' ? ' selected' : ''}>included</option>
        </select>
      </div>
      <div class="fg" style="grid-column:1/-1">
        <div id="ed-vat-preview" style="font-family:var(--font-mono);font-size:11px;color:var(--mu2);background:var(--bg);padding:8px 10px;border-radius:var(--r);display:none"></div>
      </div>
      <div class="fg">
        <label class="fl">Sales status</label>
        <select class="fi fsel" id="ed-sales">
          ${STAGES.map(s => `<option value="${s.key}"${deal.sales_status === s.key ? ' selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <label class="fl">Billing status</label>
        <select class="fi fsel" id="ed-billing">
          ${['pending','invoiced','partial','paid','overdue'].map(s => `<option value="${s}"${deal.billing_status === s ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="fg" style="grid-column:1/-1">
        <label class="fl">
          Payment processor
          ${gatewayHtml}
        </label>
        <input class="fi" id="ed-processor" value="${deal.payment_processor || ''}" placeholder="stripe, thrivecart, wise…">
      </div>
      <div class="fg" style="grid-column:1/-1">
        <label class="fl">Notes</label>
        <div id="ed-notes-editor"></div>
      </div>
    </div>
    <div id="ed-reminders-section" style="margin-top:12px">
      <div style="font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.14em;color:var(--mu2);margin-bottom:8px">Reminders</div>
      <div id="ed-reminders-list"></div>
      <div style="display:flex;gap:6px;margin-top:8px" id="ed-reminder-add-row">
        <input class="fi" id="ed-reminder-text" style="flex:1;height:32px;font-size:12px" placeholder="Add reminder…" onkeydown="if(event.key==='Enter')addEdReminder()">
        <input type="date" class="fi" id="ed-reminder-date" style="width:130px;height:32px;font-size:12px">
        <button class="btn btn-sm" onclick="addEdReminder()" style="height:32px">+ Add</button>
      </div>
    </div>
    <div style="font-size:10px;color:var(--mu2);font-family:var(--font-mono);margin-top:8px">Created ${formatDate(deal.created_at)}</div>
  `
  calcEdVat()
  requestAnimationFrame(() => {
    _initEdNotesQuill(deal.notes || '')
    _renderEdReminders(deal.deal_reminders || [])
  })
}

// ── helpers used inside the modal HTML ───────────────────────

function escHtmlAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function copyDealLink(url) {
  navigator.clipboard.writeText(url).then(() => showToast('Link copied'))
}
window.copyDealLink = copyDealLink

// ─── client selector inside edit modal ───────────────────────

function _edBuildCsTrigger() {
  if (_edSelClient) {
    return `
      <div class="cs-trigger" onclick="edCsToggle()">
        <div class="av" style="background:${avatarBg(_edSelClient.full_name)};color:${avatarFg(_edSelClient.full_name)};width:20px;height:20px;font-size:9px;flex-shrink:0">${initials(_edSelClient.full_name)}</div>
        <span style="flex:1;color:var(--ink)">${_edSelClient.full_name}</span>
        <span onclick="edCsClear(event)" style="color:var(--mu2);font-size:14px;line-height:1;cursor:pointer;padding:0 2px">×</span>
      </div>
    `
  }
  return `
    <div class="cs-trigger" onclick="edCsToggle()">
      <span style="color:var(--mu2);flex:1">Select client…</span>
      <span style="color:var(--mu2);font-size:10px">▾</span>
    </div>
  `
}

function _edBuildCsDropdown() {
  if (!_edCsOpen) return ''
  const filtered = _edCsSearch
    ? _clients.filter(c => c.full_name.toLowerCase().includes(_edCsSearch.toLowerCase()) || (c.email || '').toLowerCase().includes(_edCsSearch.toLowerCase()))
    : _clients
  return `
    <div class="cs-dropdown">
      <div style="padding:6px 8px;border-bottom:1px solid var(--border2)">
        <input class="fi" style="height:30px;font-size:12px" placeholder="Search…" id="ed-cs-search"
          oninput="edCsSearch(this.value)" onkeydown="edCsKeydown(event)"
          value="${_edCsSearch}" autocomplete="off">
      </div>
      <div class="cs-list">
        ${filtered.length ? filtered.map((c, i) => `
          <div class="cs-item${_edSelClient?.id === c.id ? ' cs-sel' : ''}${_edCsFocused === i ? ' cs-focused' : ''}"
            onclick="edCsSelect('${c.id}')">
            <div class="av" style="background:${avatarBg(c.full_name)};color:${avatarFg(c.full_name)};width:20px;height:20px;font-size:9px;flex-shrink:0">${initials(c.full_name)}</div>
            <div>
              <div style="font-size:13px;color:var(--ink)">${c.full_name}</div>
              ${c.email ? `<div style="font-size:11px;color:var(--mu2)">${c.email}</div>` : ''}
            </div>
          </div>
        `).join('') : `<div style="padding:12px;text-align:center;font-size:12px;color:var(--mu2)">No clients found</div>`}
      </div>
    </div>
  `
}

function _edRenderCs() {
  const wrap = document.getElementById('ed-cs-wrap')
  if (!wrap) return
  wrap.innerHTML = _edBuildCsTrigger() + _edBuildCsDropdown()
  if (_edCsOpen) {
    const inp = document.getElementById('ed-cs-search')
    inp?.focus()
  }
}

function edCsToggle() { _edCsOpen = !_edCsOpen; _edCsFocused = -1; _edRenderCs() }
window.edCsToggle = edCsToggle

function edCsClear(e) {
  e.stopPropagation()
  _edSelClient = null; _edCsOpen = false; _edCsSearch = ''; _edCsFocused = -1
  _edRenderCs()
}
window.edCsClear = edCsClear

function edCsSearch(v) { _edCsSearch = v; _edCsFocused = -1; _edRenderCs() }
window.edCsSearch = edCsSearch

function edCsSelect(id) {
  _edSelClient = _clients.find(c => c.id === id) || null
  _edCsOpen = false; _edCsSearch = ''; _edCsFocused = -1
  _edRenderCs()
}
window.edCsSelect = edCsSelect

function _edCsClose() { _edCsOpen = false; _edCsFocused = -1; _edRenderCs() }

function edCsKeydown(e) {
  const filtered = _edCsSearch
    ? _clients.filter(c => c.full_name.toLowerCase().includes(_edCsSearch.toLowerCase()) || (c.email || '').toLowerCase().includes(_edCsSearch.toLowerCase()))
    : _clients
  if (e.key === 'ArrowDown') { e.preventDefault(); _edCsFocused = Math.min(_edCsFocused + 1, filtered.length - 1); _edRenderCs() }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _edCsFocused = Math.max(_edCsFocused - 1, -1); _edRenderCs() }
  else if (e.key === 'Enter') { e.preventDefault(); if (_edCsFocused >= 0 && filtered[_edCsFocused]) edCsSelect(filtered[_edCsFocused].id) }
  else if (e.key === 'Escape') _edCsClose()
}
window.edCsKeydown = edCsKeydown

// ─── edit modal VAT + product autofill ───────────────────────

function onEdProductChange(id) {
  const p = _products.find(x => x.id === id)
  if (p) {
    if (p.base_price) document.getElementById('ed-price').value = p.base_price
    if (p.currency)   document.getElementById('ed-currency').value = p.currency
    calcEdVat()
  }
}
window.onEdProductChange = onEdProductChange

function calcEdVat() {
  const price = parseFloat(document.getElementById('ed-price')?.value) || 0
  const vat   = parseFloat(document.getElementById('ed-vat')?.value) || 0
  const cur   = document.getElementById('ed-currency')?.value || 'EUR'
  const mode  = document.getElementById('ed-vatmode')?.value || 'excl'
  const prev  = document.getElementById('ed-vat-preview')
  if (!prev) return
  if (price > 0 && vat > 0) {
    const final  = mode === 'excl' ? price * (1 + vat / 100) : price
    const base   = mode === 'incl' ? price / (1 + vat / 100) : price
    const vatAmt = mode === 'excl' ? price * vat / 100 : price - base
    prev.style.display = 'block'
    prev.textContent = mode === 'excl'
      ? `Base: ${fmt(price, cur)} + VAT (${vat}%): ${fmt(vatAmt, cur)} = Final: ${fmt(final, cur)}`
      : `Final: ${fmt(price, cur)} (incl. VAT ${vat}% = ${fmt(vatAmt, cur)})`
  } else {
    prev.style.display = 'none'
  }
}
window.calcEdVat = calcEdVat

// ─── save deal ────────────────────────────────────────────────

async function saveEditDeal() {
  if (!_editDealId) return
  const clientId  = _edSelClient?.id || null
  const vendorId  = document.getElementById('ed-vendor').value || null
  const productId = document.getElementById('ed-product').value || null
  const price     = parseFloat(document.getElementById('ed-price').value) || null
  const currency  = document.getElementById('ed-currency').value
  const vatPct    = parseFloat(document.getElementById('ed-vat').value) || 0
  const vatMode   = document.getElementById('ed-vatmode').value
  const sales     = document.getElementById('ed-sales').value
  const billing   = document.getElementById('ed-billing').value
  const processor = document.getElementById('ed-processor').value.trim() || null
  const notes     = _quillValue(_edNotesQuill)

  if (!clientId) { showToast('Select a client', 'warn'); return }

  const fields = {
    client_id:         clientId,
    primary_vendor_id: vendorId,
    product_id:        productId,
    price,
    currency,
    vat_pct:           vatPct,
    vat_mode:          vatMode,
    sales_status:      sales,
    billing_status:    billing,
    payment_processor: processor,
    notes,
  }

  try {
    await updateDeal(_editDealId, fields)

    // Update local state
    const i = _deals.findIndex(d => d.id === _editDealId)
    if (i !== -1) {
      const client  = _clients.find(c => c.id === clientId)
      const vendor  = _vendors.find(v => v.id === vendorId)
      const product = _products.find(p => p.id === productId)
      _deals[i] = { ..._deals[i], ...fields, clients: client || null, vendors: vendor || null, products: product || null }
    }

    // Auto-create package if product.type === 'package'
    const product = _products.find(p => p.id === productId)
    if (product?.type === 'package' && vendorId && clientId) {
      await _autoCreatePackage(_editDealId, clientId, vendorId, product)
    }

    // Auto-assign vendor to client
    if (vendorId && clientId) {
      await _autoAssignVendorClient(vendorId, clientId)
    }

    closeEditDeal()
    renderDeals()
    showToast('Deal saved')
  } catch(e) {
    console.error('[HSos] saveEditDeal error:', e)
    showToast('Save failed — check console', 'warn')
  }
}
window.saveEditDeal = saveEditDeal

// ─── deal reminders ───────────────────────────────────────────

function _renderEdReminders(reminders) {
  const list = document.getElementById('ed-reminders-list')
  if (!list) return
  if (!reminders.length) {
    list.innerHTML = `<div style="font-size:12px;color:var(--mu2);padding:4px 0">No reminders yet</div>`
    return
  }
  // Sort: undone first, then by due_date ascending (nulls last)
  const sorted = [...reminders].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const ad = a.due_date || '9999'
    const bd = b.due_date || '9999'
    return ad.localeCompare(bd)
  })
  list.innerHTML = sorted.map(r => {
    const overdue = !r.done && r.due_date && r.due_date < new Date().toISOString().slice(0, 10)
    const dueLbl = r.due_date
      ? `<span style="font-size:10px;font-family:var(--font-mono);color:${overdue ? 'var(--red-text)' : 'var(--mu2)'}">${overdue ? '⚠️ ' : ''}Due: ${r.due_date}</span>`
      : ''
    return `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid var(--border2)">
        <input type="checkbox" ${r.done ? 'checked' : ''}
          style="margin-top:2px;flex-shrink:0;cursor:pointer"
          onchange="toggleEdReminder('${r.id}', this.checked)">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;${r.done ? 'text-decoration:line-through;color:var(--mu2)' : 'color:var(--ink)'}">${escHtml(r.text)}</div>
          ${dueLbl}
        </div>
      </div>
    `
  }).join('')
}

async function addEdReminder() {
  if (!_editDealId) return
  const textEl = document.getElementById('ed-reminder-text')
  const dateEl = document.getElementById('ed-reminder-date')
  const text   = textEl?.value.trim()
  if (!text) { textEl?.focus(); return }
  const due_date = dateEl?.value || null
  try {
    const reminder = await addDealReminder(_editDealId, text, due_date)
    // Push into local deal state
    const deal = _deals.find(d => d.id === _editDealId)
    if (deal) {
      if (!deal.deal_reminders) deal.deal_reminders = []
      deal.deal_reminders.push(reminder)
      _renderEdReminders(deal.deal_reminders)
    }
    textEl.value = ''
    if (dateEl) dateEl.value = ''
  } catch(e) {
    console.error('[HSos] addEdReminder error:', e)
    showToast('Could not add reminder', 'warn')
  }
}
window.addEdReminder = addEdReminder

async function toggleEdReminder(id, done) {
  try {
    await toggleDealReminder(id, done)
    const deal = _deals.find(d => d.id === _editDealId)
    if (deal?.deal_reminders) {
      const r = deal.deal_reminders.find(x => x.id === id)
      if (r) r.done = done
      _renderEdReminders(deal.deal_reminders)
    }
  } catch(e) {
    console.error('[HSos] toggleEdReminder error:', e)
    showToast('Could not update reminder', 'warn')
  }
}
window.toggleEdReminder = toggleEdReminder

async function _autoCreatePackage(dealId, clientId, vendorId, product) {
  // Check if package already exists for this deal
  const { data: existing } = await _sb
    .from('packages').select('id').eq('deal_id', dealId).maybeSingle()
  if (existing) return  // already exists

  const totalSessions = product.default_package_sessions || 10
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

// ─── delete deal ──────────────────────────────────────────────

async function deleteEditDeal() {
  if (!_editDealId) return
  const deal = _deals.find(d => d.id === _editDealId)
  if (!confirm(`Delete deal for "${deal?.clients?.full_name || 'this client'}"? This cannot be undone.`)) return
  try {
    await deleteDeal(_editDealId)
    _deals = _deals.filter(d => d.id !== _editDealId)
    closeEditDeal()
    renderDeals()
    showToast('Deal deleted')
  } catch(e) {
    console.error('[HSos] deleteEditDeal error:', e)
    showToast('Delete failed — check console', 'warn')
  }
}
window.deleteEditDeal = deleteEditDeal

// ─── new deal modal ───────────────────────────────────────────

let _ndSelClient     = null
let _ndCsOpen        = false
let _ndCsSearch      = ''
let _ndCsFocused     = -1
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
        `).join('') : `<div style="padding:12px;text-align:center;font-size:12px;color:var(--mu2)">No clients found</div>`}
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

function ndCsSearch(v) { _ndCsSearch = v; _ndCsFocused = -1; _renderNdCs() }
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
      <div class="client-list-item${_selClientId === c.id ? ' sel' : ''}" onclick="showClientDetail('${c.id}',event)">
        <div class="av av-sm" style="background:${avatarBg(c.full_name)};color:${avatarFg(c.full_name)}">${initials(c.full_name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.full_name}</div>
          <div style="font-size:11px;color:var(--mu2)">${deals.length} deal${deals.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
    `
  }).join('') || `<div style="padding:24px;text-align:center;color:var(--mu2)">No clients found</div>`
}

function showClientDetail(clientId, e, from = 'list') {
  e?.stopPropagation()
  const source = from || 'list'
  if (window.Router) {
    const url = Router.urlFor({
      path: 'client-profile.html',
      entity: 'client',
      id: clientId,
      view: 'page',
      from: source,
    })
    window.location.href = url
    return
  }
  window.location.href = `client-profile.html?entity=client&id=${encodeURIComponent(clientId)}&view=page&from=${encodeURIComponent(source)}`
}

window.showClientDetail = showClientDetail

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
  if (_fVendorCurrency) v = v.filter(x => (x.preferred_currency || 'EUR') === _fVendorCurrency)
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
  const curr = v.preferred_currency || v.currency || 'EUR'
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
  if (window.Router && !_routerDispatching) {
    Router.open({ entity: 'vendor', id, view: 'panel', from: 'list' })
    return
  }

  _selVendorId = id
  _vendorTab = 'profile'
  _vendorEditMode = false
  _vendorEditSnapshot = null
  // Switch to correct tab if vendor is in archived pool
  if (_vendors.find(x => x.id === id)) _vendorListTab = 'active'
  else if (_vendorsInactive.find(x => x.id === id)) _vendorListTab = 'archived'
  renderVendors()
  _vendorPaychecks = await getPaychecks({ vendor_id: id }).catch(() => [])
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
            : `<button class="btn btn-sm" onclick="enterVendorEditMode()">Edit</button>`
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
    const curr = v.preferred_currency || v.currency || 'EUR'
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
        <input class="fi" id="ve-currency" value="${escHtml(v.preferred_currency || v.currency || '')}">
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
    <div class="block">
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
            <tr>
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
          <div class="av av-sm" style="background:${avatarBg(c.full_name)};color:${avatarFg(c.full_name)}">${initials(c.full_name)}</div>
          <div style="font-size:13px;flex:1">${escHtml(c.full_name)}</div>
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

function renderProducts() {
  const container = document.getElementById('products-container')
  if (!container) return

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-family:var(--font-serif);font-size:22px;font-weight:700">Products</div>
      <button class="btn btn-primary btn-sm" onclick="openProductModal(null)">+ New Product</button>
    </div>
    <div class="block">
      <table class="tbl">
        <thead>
          <tr>
            <th>Product</th>
            <th>Type</th>
            <th>Category</th>
            <th>Base Price</th>
            <th>Sessions</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${_products.length ? _products.map(p => {
            const price = p.base_price != null ? fmt(p.base_price, p.currency || 'EUR') : '—'
            return `
              <tr>
                <td style="font-weight:500">${p.name}</td>
                <td><span class="pill ${p.type || ''}" style="font-size:10px">${p.type || '—'}</span></td>
                <td style="color:var(--mu);font-size:12px">${p.category || '—'}</td>
                <td class="mono">${price}</td>
                <td class="mono">${p.type === 'package' ? (p.default_package_sessions || '—') : '—'}</td>
                <td style="text-align:right;display:flex;gap:6px;justify-content:flex-end">
                  <button class="btn btn-sm" onclick="openPlansView('${p.id}',event)">Plans</button>
                  <button class="btn btn-sm" onclick="openProductModal('${p.id}',event)">Edit</button>
                </td>
              </tr>
            `
          }).join('') : `<tr><td colspan="6" style="text-align:center;color:var(--mu2);padding:24px">No products</td></tr>`}
        </tbody>
      </table>
    </div>
  `
}

// ─── product modal ────────────────────────────────────────────

function openProductModal(id, e) {
  e?.stopPropagation()
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
    renderProducts()
  } catch(e) {
    console.error('[HSos] saveProductModal error:', e)
    showToast('Save failed — check console', 'warn')
  }
}
window.saveProductModal = saveProductModal

async function deleteProductModal() {
  if (!_editProductId) return
  const p = _products.find(x => x.id === _editProductId)
  if (!confirm(`Delete product "${p?.name}"? This cannot be undone.`)) return
  try {
    await deleteProduct(_editProductId)
    _products = _products.filter(x => x.id !== _editProductId)
    closeProductModal()
    renderProducts()
    showToast('Product deleted')
  } catch(e) {
    console.error('[HSos] deleteProductModal error:', e)
    showToast('Delete failed — check console', 'warn')
  }
}
window.deleteProductModal = deleteProductModal

// ─── plans page (product_plans) ───────────────────────────────

let _plansProductId  = null
let _plans           = []
let _editPlanId      = null

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
              <td style="font-weight:500">${plan.plan_name}${!plan.active ? ' <span style="font-size:10px;color:var(--mu2)">(inactive)</span>' : ''}</td>
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
  _editPlanId = id
  const plan = id ? _plans.find(p => p.id === id) : null

  document.getElementById('plan-modal-title').textContent = id ? 'Edit Plan' : 'New Plan'
  document.getElementById('plan-delete-btn').style.display = id ? 'block' : 'none'

  document.getElementById('plan-modal-body').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="fg" style="grid-column:1/-1">
          <label class="fl">Plan name</label>
          <input class="fi" id="plm-name" value="${plan?.plan_name || ''}" placeholder="e.g. IL Standard, US Monthly">
        </div>
        <div class="fg">
          <label class="fl">Gateway</label>
          <select class="fi fsel" id="plm-gateway">
            ${['green_invoice','thrivecart','wise','stripe'].map(g =>
              `<option value="${g}"${plan?.collection_gateway === g ? ' selected' : ''}>${GATEWAY_META[g]}</option>`
            ).join('')}
          </select>
        </div>
        <div class="fg">
          <label class="fl">Gateway product ID</label>
          <input class="fi" id="plm-gateway-pid" value="${plan?.collection_gateway_product_id || ''}" placeholder="optional">
        </div>
        <div class="fg" style="grid-column:1/-1">
          <label class="fl">Payment link</label>
          <input class="fi" id="plm-gateway-link" value="${plan?.collection_gateway_link || ''}" placeholder="https://…">
        </div>
        <div class="fg">
          <label class="fl">Price</label>
          <input class="fi" type="number" id="plm-price" value="${plan?.price != null ? plan.price : ''}" placeholder="0">
        </div>
        <div class="fg">
          <label class="fl">Currency</label>
          <select class="fi fsel" id="plm-currency">
            ${['EUR','USD','ILS','GBP'].map(c =>
              `<option value="${c}"${(plan?.currency || 'EUR') === c ? ' selected' : ''}>${c}</option>`
            ).join('')}
          </select>
        </div>
        <div class="fg">
          <label class="fl">Installments</label>
          <input class="fi" type="number" id="plm-installments" min="1" value="${plan?.installments ?? 1}" placeholder="1">
        </div>
        <div class="fg">
          <label class="fl">Target country</label>
          <input class="fi" id="plm-country" value="${plan?.target_customer_country || ''}" placeholder="IL / US / EU / leave blank">
        </div>
        <div class="fg">
          <label class="fl">Target currency (display)</label>
          <input class="fi" id="plm-target-currency" value="${plan?.target_currency || ''}" placeholder="ILS / USD / …">
        </div>
        <div class="fg">
          <label class="fl">Vendor payout currency</label>
          <select class="fi fsel" id="plm-vendor-payout">
            <option value="">— none —</option>
            ${['ILS','USD','EUR'].map(c =>
              `<option value="${c}"${plan?.vendor_payout_currency === c ? ' selected' : ''}>${c}</option>`
            ).join('')}
          </select>
        </div>
        <div class="fg">
          <label class="fl">Vendor</label>
          <select class="fi fsel" id="plm-vendor">
            <option value="">— none —</option>
            ${_vendors.map(v =>
              `<option value="${v.id}"${plan?.vendor_id === v.id ? ' selected' : ''}>${v.full_name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="fg">
          <label class="fl">Priority</label>
          <input class="fi" type="number" id="plm-priority" value="${plan?.priority ?? 0}" placeholder="0 = highest">
        </div>
        <div class="fg" style="grid-column:1/-1;display:flex;align-items:center;gap:8px;padding-top:4px">
          <input type="checkbox" id="plm-default" ${plan?.is_default ? 'checked' : ''}>
          <label for="plm-default" class="fl" style="margin:0;cursor:pointer">Default plan for this product</label>
        </div>
        <div class="fg" style="grid-column:1/-1;display:flex;align-items:center;gap:8px">
          <input type="checkbox" id="plm-active" ${(plan?.active ?? true) ? 'checked' : ''}>
          <label for="plm-active" class="fl" style="margin:0;cursor:pointer">Active</label>
        </div>
      </div>
    </div>`

  document.getElementById('modal-plan').classList.add('open')
}
window.openPlanModal = openPlanModal

function closePlanModal() {
  document.getElementById('modal-plan').classList.remove('open')
  _editPlanId = null
}
window.closePlanModal = closePlanModal

async function savePlanModal() {
  const name        = document.getElementById('plm-name').value.trim()
  const gateway     = document.getElementById('plm-gateway').value
  const gatewayPid  = document.getElementById('plm-gateway-pid').value.trim() || null
  const gatewayLink = document.getElementById('plm-gateway-link').value.trim() || null
  const price       = parseFloat(document.getElementById('plm-price').value) || 0
  const currency    = document.getElementById('plm-currency').value
  const installments = parseInt(document.getElementById('plm-installments').value) || 1
  const country     = document.getElementById('plm-country').value.trim() || null
  const targetCur   = document.getElementById('plm-target-currency').value.trim() || null
  const vendorPayout = document.getElementById('plm-vendor-payout').value || null
  const vendorId    = document.getElementById('plm-vendor').value || null
  const priority    = parseInt(document.getElementById('plm-priority').value) || 0
  const isDefault   = document.getElementById('plm-default').checked
  const active      = document.getElementById('plm-active').checked

  if (!name) { showToast('Plan name required', 'warn'); return }
  if (!price) { showToast('Price required', 'warn'); return }

  const fields = {
    plan_name:                    name,
    collection_gateway:           gateway,
    collection_gateway_product_id: gatewayPid,
    collection_gateway_link:      gatewayLink,
    price,
    currency,
    installments,
    target_customer_country:      country,
    target_currency:              targetCur,
    vendor_payout_currency:       vendorPayout,
    vendor_id:                    vendorId,
    priority,
    is_default:                   isDefault,
    active,
    product_id:                   _plansProductId,
  }

  try {
    if (_editPlanId) {
      await updateProductPlan(_editPlanId, fields)
      showToast('Plan saved')
    } else {
      await createProductPlan(fields)
      showToast('Plan created')
    }
    closePlanModal()
    await reloadPlans()
  } catch (err) {
    console.error('[HSos] savePlanModal error:', err)
    showToast('Save failed — check console', 'warn')
  }
}
window.savePlanModal = savePlanModal

async function deletePlanModal() {
  if (!_editPlanId) return
  const plan = _plans.find(p => p.id === _editPlanId)
  if (!confirm(`Delete plan "${plan?.plan_name}"?`)) return
  try {
    await deleteProductPlan(_editPlanId)
    closePlanModal()
    await reloadPlans()
    showToast('Plan deleted')
  } catch (err) {
    console.error('[HSos] deletePlanModal error:', err)
    showToast('Delete failed — check console', 'warn')
  }
}
window.deletePlanModal = deletePlanModal
