// v2/spaces/payments/payments-init.js — Payments bootstrap + tab router.
// Loads shared lookups (accounts, companies, categories, tags, vendors) once,
// then lets each tab request its own entity data on demand.
// State keys used across the space:
//   pay.accounts, pay.companies, pay.categories, pay.tags,
//   pay.vendors, pay.transactions, pay.bills, pay.deals, pay.packages

const PaymentsInit = (() => {
  const TABS = [
    { key: 'transactions', label: 'Transactions', mod: () => PayTransactions },
    { key: 'income',       label: 'Expected income', mod: () => PayIncome },
    { key: 'bills',        label: 'Vendor bills',    mod: () => PayBills },
    { key: 'history',      label: 'History',         mod: () => PayHistory },
    { key: 'balances',     label: 'Balances',        mod: () => PayBalances },
    { key: 'matching',     label: 'Vendor matching', mod: () => PayVendors },
    { key: 'registry',     label: 'Registry',        mod: () => PayRegistry }
  ]

  async function start() {
    if (!Guard.space('payments')) return
    Layout.init({ space: 'payments', pageTitle: 'Payments' })

    try {
      await _loadLookups()
      _mountLayout()
      const params = Router.getParams()
      const tab = _pickTab(params.tab)
      _switchTab(tab)
      window.addEventListener('popstate', () => {
        const t = _pickTab(Router.getParams().tab)
        _switchTab(t)
      })
    } catch (err) {
      console.error('[PaymentsInit] start failed', err)
      Utils.showToast(err.message || 'Failed to load payments space', 'error')
    }
  }

  function _pickTab(val) {
    return TABS.some(t => t.key === val) ? val : 'transactions'
  }

  async function _loadLookups() {
    const [accounts, companies, categories, tags, vendors] = await Promise.all([
      DB.getAllAccounts(),
      DB.getCompanies(),
      DB.getTransactionCategories({ includeInactive: true }),
      DB.getTransactionTags({ includeInactive: true }),
      DB.getVendors()
    ])
    State.set('pay.accounts', accounts)
    State.set('pay.companies', companies)
    State.set('pay.categories', categories)
    State.set('pay.tags', tags)
    State.set('pay.vendors', vendors)
  }

  function _mountLayout() {
    const mount = Layout.appContentEl()
    if (!mount) return
    while (mount.firstChild) mount.removeChild(mount.firstChild)

    const header = document.createElement('header')
    header.className = 'v2-page-header'
    const h1 = document.createElement('h1')
    h1.textContent = 'Payments'
    header.appendChild(h1)
    mount.appendChild(header)

    const tabBar = document.createElement('nav')
    tabBar.className = 'v2-tabbar v2-pay-tabs'
    for (const t of TABS) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'v2-tab'
      b.dataset.tab = t.key
      b.textContent = t.label
      b.addEventListener('click', () => _switchTab(t.key, { pushUrl: true }))
      tabBar.appendChild(b)
    }
    mount.appendChild(tabBar)

    const body = document.createElement('div')
    body.className = 'v2-pay-body'
    body.id = 'v2-pay-body'
    mount.appendChild(body)
  }

  function _switchTab(tabKey, opts) {
    const body = document.getElementById('v2-pay-body')
    if (!body) return
    while (body.firstChild) body.removeChild(body.firstChild)
    for (const b of document.querySelectorAll('.v2-pay-tabs .v2-tab')) {
      b.classList.toggle('v2-tab-active', b.dataset.tab === tabKey)
    }
    const entry = TABS.find(t => t.key === tabKey)
    const mod = entry?.mod()
    if (mod?.render) mod.render(body)
    if (opts?.pushUrl) {
      const url = window.location.pathname + `?tab=${encodeURIComponent(tabKey)}`
      window.history.pushState({ tab: tabKey }, '', url)
    }
  }

  // Re-run load of lookups (after registry CRUD, for example).
  async function reloadLookups() {
    await _loadLookups()
  }

  document.addEventListener('DOMContentLoaded', start)

  return { start, switchTab: _switchTab, reloadLookups }
})()

window.PaymentsInit = PaymentsInit
