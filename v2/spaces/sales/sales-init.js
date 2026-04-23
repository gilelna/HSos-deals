// v2/spaces/sales/sales-init.js — Sales space bootstrap.
// Loads initial data, sets up Layout + Panel + Router, switches between pages.

const SalesInit = (() => {
  const PAGES = ['dashboard', 'deals', 'clients', 'vendors', 'products']

  async function start() {
    if (!Guard.space('sales')) return
    Layout.init({ space: 'sales', pageTitle: 'Sales' })
    _registerPanelTypes()
    _registerRouterHandlers()
    Router.init()

    const params = Router.getParams()
    const page = PAGES.includes(params.page) ? params.page : 'dashboard'

    try {
      await _loadInitialData()
      await _switchPage(page)
    } catch (err) {
      console.error('[SalesInit] start failed', err)
      Utils.showToast(err.message || 'Failed to load sales space', 'error')
    }

    // If the URL points to a panel entity (?entity=deal&id=...), dispatch it.
    if (params.entity) Router.dispatch()
  }

  async function _loadInitialData() {
    const [deals, clients, vendors, products, programs, taskTypes] = await Promise.all([
      DB.getDeals(), DB.getClients(), DB.getVendors(),
      DB.getAllProductsWithPlans(), DB.getPrograms(), DB.getTaskTypes()
    ])
    State.set('sales.deals', deals)
    State.set('sales.clients', clients)
    State.set('sales.vendors', vendors)
    State.set('sales.products', products)
    State.set('sales.programs', programs)
    State.set('sales.taskTypes', taskTypes)
  }

  async function _switchPage(page) {
    const mount = Layout.appContentEl()
    if (!mount) return
    while (mount.firstChild) mount.removeChild(mount.firstChild)
    mount.dataset.page = page

    if (page === 'dashboard') return SalesDashboard.render(mount)
    if (page === 'deals')     return SalesDeals.render(mount)
    if (page === 'clients')   return SalesClients.render(mount)
    if (page === 'vendors')   return SalesVendors.render(mount)
    if (page === 'products')  return SalesProducts.render(mount)
  }

  function _registerRouterHandlers() {
    Router.register('deal',    ({ id }) => id && Panel.open('deal', id))
    Router.register('client',  ({ id }) => id && Panel.open('client', id))
    Router.register('vendor',  ({ id }) => id && Panel.open('vendor', id))
    Router.register('product', ({ id }) => id && Panel.open('product', id))
  }

  function _registerPanelTypes() {
    Panel.registerType('deal',    SalesDeals.panelHandler)
    Panel.registerType('client',  SalesClients.panelHandler)
    Panel.registerType('vendor',  SalesVendors.panelHandler)
    Panel.registerType('product', SalesProducts.panelHandler)
  }

  // Space-switcher links in the sidebar send the user between spaces;
  // page-switcher links stay within sales and swap the content.
  function _wirePageLinks() {
    document.addEventListener('click', e => {
      const a = e.target.closest('.v2-sb-link[data-nav-id]')
      if (!a) return
      const href = a.getAttribute('href') || ''
      const url = new URL(href, window.location.href)
      const here = window.location.pathname.split('/').pop()
      const target = url.pathname.split('/').pop()
      if (here !== target) return // different page → let the browser navigate
      e.preventDefault()
      const page = url.searchParams.get('page') || 'dashboard'
      const p = PAGES.includes(page) ? page : 'dashboard'
      window.history.pushState({}, '', url.pathname + url.search)
      _switchPage(p)
    })
    window.addEventListener('popstate', () => {
      const page = Router.getParams().page || 'dashboard'
      if (PAGES.includes(page)) _switchPage(page)
    })
  }

  // ─── Go ────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    _wirePageLinks()
    start()
  })

  return { start }
})()

window.SalesInit = SalesInit
