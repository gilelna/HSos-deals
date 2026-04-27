// deals-init.js — DOMContentLoaded, routing, page switching, render coordination

document.addEventListener('DOMContentLoaded', async () => {
  if (!guardSpace('operations', 'workload.html')) return
  _detectPlansSchema()
  registerRouterHandlers()
  await loadData()

  const _initParams = new URLSearchParams(window.location.search)
  const _initPage   = _initParams.get('page') || 'dashboard'
  const _initView   = _initParams.get('view') || 'kanban'
  const _hasEntity  = !!_initParams.get('entity')

  // Apply ?filter= URL param. Supported values:
  //   deals/kanban view: 'active' | 'stale' | 'expiring'
  //   vendors view:      'coach' | 'contractor' | 'team_member' | 'merchant'
  //   clients view:      'active' (no-op, default state)
  const _filterParam = _initParams.get('filter')
  if (_filterParam) {
    if (_initView === 'kanban' || _initView === 'list' || _initPage === 'deals') {
      if (_filterParam === 'active')   _filters.add('active')
      if (_filterParam === 'stale')    _filters.add('stale')
      if (_filterParam === 'expiring') _filters.add('expiring')
    }
    if (_initPage === 'vendors' && ['coach','contractor','team_member','merchant'].includes(_filterParam)) {
      _fVendorType = _filterParam
    }
  }

  if (!_hasEntity) {
    setView(_initView, { pushUrl: false })
    switchPage(_initPage, null, { pushUrl: false })
  } else {
    setView(_initView, { pushUrl: false })
  }

  if (window.Router) Router.dispatch()
  document.addEventListener('click', e => {
    if (!e.target.closest('.mod-wrap'))
      document.getElementById('mod-dd')?.classList.remove('open')
    if (e.target === document.getElementById('modal-new-deal'))
      closeNewDeal()
    if (e.target === document.getElementById('modal-product'))
      closeProductModal()
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

  document.querySelectorAll('.sb-link').forEach(a => a.classList.remove('cur'))
  document.getElementById('nav-' + name)?.classList.add('cur')

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

function render() {
  renderDeals()
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

function toggleModDD() {
  document.getElementById('mod-dd').classList.toggle('open')
}
window.toggleModDD = toggleModDD
