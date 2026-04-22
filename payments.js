// payments.js — HSos Payments space (Manager / Finance view)
// Depends on: db.js (window._sb), app.js, router.js

// ═══════════════════════════════════════════════════════════════
// CLASSIFICATION CONSTANTS
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CATEGORIES = [
  { id: 'ca_income', name: 'Income', tax: 'income' },
  { id: 'ca_internaltransfer', name: 'Internal Transfer', tax: null },
  { id: 'ca_intercompanytransfer', name: 'Intercompany Transfer', tax: null },
  { id: 'ca_ownerdraw', name: 'Owner Draw', tax: 'non_deductible' },
  { id: 'ca_ownersalary', name: 'Owner Salary', tax: 'business_payroll_contractors' },
  { id: 'ca_teammemberspayroll', name: 'Team Members (Payroll)', tax: 'business_payroll_contractors' },
  { id: 'ca_contractorsfreelancers', name: 'Contractors & Freelancers', tax: 'business_professional_services' },
  { id: 'ca_accountingbookkeeping', name: 'Accounting & Bookkeeping', tax: 'business_professional_services' },
  { id: 'ca_bankfees', name: 'Bank Fees', tax: 'business_banking_fees' },
  { id: 'ca_paymentprocessingfees', name: 'Payment Processing Fees', tax: 'business_banking_fees' },
  { id: 'ca_taxesincometaxvatetc', name: 'Taxes (Income Tax, VAT, etc.)', tax: 'business_taxes_government' },
  { id: 'ca_governmentmunicipalutilities', name: 'Government & Municipal', tax: 'business_taxes_government' },
  { id: 'ca_insurance', name: 'Insurance', tax: 'business_insurance' },
  { id: 'ca_softwaresaasrecurring', name: 'Software & SaaS (Recurring)', tax: 'business_software_online' },
  { id: 'ca_softwareonetime', name: 'Software (One-Time)', tax: 'business_software_online' },
  { id: 'ca_serversinfrastructure', name: 'Servers & Infrastructure', tax: 'business_software_online' },
  { id: 'ca_flights', name: 'Flights', tax: 'business_travel' },
  { id: 'ca_travelexpenses', name: 'Travel Expenses', tax: 'business_travel' },
  { id: 'ca_groceries', name: 'Groceries', tax: 'non_deductible' },
  { id: 'ca_restaurantscafes', name: 'Restaurants & Cafes', tax: 'mixed_review' },
  { id: 'ca_shoppingretail', name: 'Shopping & Retail', tax: 'mixed_review' },
  { id: 'ca_electronicsequipment', name: 'Electronics & Equipment', tax: 'business_equipment' },
  { id: 'ca_homehousehold', name: 'Home & Household', tax: 'non_deductible' },
  { id: 'ca_lifestyleleisure', name: 'Lifestyle & Leisure', tax: 'non_deductible' },
  { id: 'ca_cultureentertainment', name: 'Culture & Entertainment', tax: 'mixed_review' },
  { id: 'ca_trainingeducation', name: 'Training & Education', tax: 'business_training' },
  { id: 'ca_medicalhealth', name: 'Medical & Health', tax: 'non_deductible' },
  { id: 'ca_advertisingmarketing', name: 'Advertising & Marketing', tax: 'business_marketing' },
]

const TAX_TREATMENTS = [
  'non_deductible', 'mixed_review', 'income',
  'business_payroll_contractors', 'business_professional_services',
  'business_banking_fees', 'business_taxes_government', 'business_insurance',
  'business_software_online', 'business_travel', 'business_equipment',
  'business_marketing', 'business_training',
]

const DEFAULT_TAG_POOL = [
  'ai','amazon','car','car rental','CFO','coaching','consulting','design','donation',
  'editor','event','finance','gas','gift','gym','hotel','israel','mac','macbook',
  'marketing','media','one-timer','parking','photography','platform','podcast',
  'public transportation','rent','scheduling','school','server','support','takeaway',
  'taxi','teacher','team','telecom','train','training','travel','utilities','va',
  'website','broadcast and streaming',
]

let CATEGORIES = [...DEFAULT_CATEGORIES]
let TAG_POOL   = [...DEFAULT_TAG_POOL]

function catById(id) { return CATEGORIES.find(c => c.id === id) }
function catName(id) { return catById(id)?.name || '' }

async function loadClassificationLookups({ refreshUi = false } = {}) {
  // Categories
  if (typeof getTransactionCategories === 'function') {
    try {
      const rows = await getTransactionCategories()
      const activeRows = (rows || []).filter(c => (c.status || 'active') !== 'inactive')
      if (activeRows.length) {
        CATEGORIES = activeRows.map(c => ({
          id: c.id,
          name: c.name,
          tax: c.tax_category || null,
        }))
      } else {
        CATEGORIES = [...DEFAULT_CATEGORIES]
      }
    } catch (err) {
      console.warn('[Classification] category lookup failed, using defaults:', err.message || err)
      CATEGORIES = [...DEFAULT_CATEGORIES]
    }
  }

  // Tags
  if (typeof getTransactionTags === 'function') {
    try {
      const rows = await getTransactionTags()
      const activeRows = (rows || []).filter(t => (t.status || 'active') !== 'inactive')
      if (activeRows.length) {
        TAG_POOL = [...new Set(activeRows.map(t => String(t.name || '').trim()).filter(Boolean))]
      } else {
        TAG_POOL = [...DEFAULT_TAG_POOL]
      }
    } catch (err) {
      console.warn('[Classification] tag lookup failed, using defaults:', err.message || err)
      TAG_POOL = [...DEFAULT_TAG_POOL]
    }
  }

  if (refreshUi) {
    populateTxFilterDropdowns({ forceRebuild: true })
    if (!document.getElementById('tab-transactions')?.classList.contains('hidden')) renderTransactions()
    if (!document.getElementById('tab-vendors')?.classList.contains('hidden')) renderVMVendors()
  }
}

// ═══════════════════════════════════════════════════════════════
// AUDIT LOG HELPER  (Part 5)
// ═══════════════════════════════════════════════════════════════

async function writeAuditLog({ entityType, entityId, action, oldData, newData, meta }) {
  const db = window._sb
  if (!db) return
  const changedBy = window.Role?.get() || 'admin'
  try {
    await db.from('audit_log').insert({
      entity_type: entityType,
      entity_id:   String(entityId),
      action,
      changed_by:  changedBy,
      old_data:    oldData  || null,
      new_data:    newData  || null,
      meta:        meta     || null,
    })
  } catch (err) {
    console.warn('[AuditLog] write failed:', err.message)
  }
}

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

let currentTab          = 'transactions'
let vendorSummaries     = []
let selectedVendorId    = null
let vendorDetail        = null
let selectedDraftIds    = new Set()
let selectedUnbilledIds = new Set()
let _routerDispatching  = false
let _routerRegistered   = false

let txAllRows    = []
let txFilter     = 'all'
let txSelectedIds = new Set()
let txFilterState = { account: '', month: '', category: '', entity: '', search: '', needsReview: false }
let txPage       = 0
let txPageSize   = 100
let txShowDeleted = false   // Part 4C
let txAccounts    = []
let txAccountsById = new Map()
let txClients = []
let eiRows    = []

// Bulk bar state
let bulkBPState = '' // '' | 'business' | 'private'
let bulkTagsAdd = []

// ═══════════════════════════════════════════════════════════════
// COVER SHRINK ON SCROLL
// ═══════════════════════════════════════════════════════════════

let _coverShrinkAttached = false
function _attachCoverShrink() {
  if (_coverShrinkAttached) return
  const content = document.querySelector('.app-content')
  const cover   = document.querySelector('.space-cover')
  if (!content || !cover) return
  content.addEventListener('scroll', () => {
    cover.classList.toggle('cover-shrunk', content.scrollTop > 60)
  }, { passive: true })
  _coverShrinkAttached = true
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function canSeeTeamFinancials() {
  const role = window.Role?.get() || sessionStorage.getItem('hsos_role') || 'admin'
  return ['admin', 'finance'].includes(role)
}

function fmt(n)      { return '$' + Number(n || 0).toFixed(2) }
function fmtHours(h) { return h === 1 ? '1h' : (h || 0) + 'h' }
// escHtml / esc defined globally in app.js

function formatDateShort(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function sessionAmount(s) { return (s.hours || 0) * (s.rate_usd || 0) }
function billAmount(bill) {
  if (!bill) return 0
  if (bill.total_amount) return bill.total_amount
  return (bill.sessions || []).reduce((s, x) => s + sessionAmount(x), 0)
}
function unbilledAmount(sessions) {
  return (sessions || []).reduce((s, x) => s + sessionAmount(x), 0)
}

function vendorTypeLabel(t) {
  return { coach: 'Coach', contractor: 'Contractor', team_member: 'Team Member', merchant: 'Merchant' }[t] || t
}

function vendorTypeBadge(type) {
  // Delegate to shared Badges module when available
  if (window.Badges) return window.Badges.vendorType(type)
  const map = {
    coach:       ['Coach',       'var(--green-bg)',  'var(--green-text)'],
    contractor:  ['Contractor',  'var(--blue-bg)',   'var(--blue-text)'],
    team_member: ['Team',        'var(--amber-bg)',  'var(--amber-text)'],
    merchant:    ['Merchant',    'var(--border)',    'var(--mu)'],
  }
  const [label, bg, color] = map[type] || ['—', 'var(--border)', 'var(--mu)']
  return `<span class="vendor-type-badge" style="background:${bg};color:${color}">${label}</span>`
}

function txAccountName(tx) {
  return tx?.account?.name ?? txAccountsById.get(tx?.account_id)?.name ?? '—'
}

function txAccountProvider(tx) {
  return (tx?.account?.provider || txAccountsById.get(tx?.account_id)?.provider || '').toLowerCase()
}

function txAccountStateLabel(tx) {
  return tx?.account_id ? txAccountName(tx) : '⚠️ Unassigned'
}

function txClientById(clientId) {
  if (!clientId) return null
  return txClients.find(c => c.id === clientId) || null
}

function txIncomeClient(tx) {
  if (tx?.direction !== 'in') return null
  if ((tx.linked_entity_type || '').toLowerCase() !== 'client') return null
  return txClientById(tx.linked_entity_id)
}

async function loadTxAccounts() {
  if (typeof getAccounts !== 'function') return
  try {
    txAccounts = await getAccounts()
  } catch (err) {
    console.warn('[Transactions] account lookup failed:', err.message || err)
    txAccounts = []
  }
  txAccountsById = new Map((txAccounts || []).map(a => [a.id, a]))
}

async function loadTxClients() {
  if (typeof getClients !== 'function') return
  try {
    const rows = await getClients()
    txClients = (rows || []).map(c => ({ id: c.id, full_name: c.full_name || '—' }))
      .sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || '')))
  } catch (err) {
    console.warn('[Transactions] clients lookup failed:', err.message || err)
    txClients = []
  }
}

// ═══════════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════════

function switchTab(tab, { pushUrl = true } = {}) {
  if (window.Router && !_routerDispatching) {
    const { entity } = Router.getParams()
    if (entity === 'vendor' && tab !== 'vendor-bills') Router.close()
    if (entity === 'transaction' && tab !== 'transactions') Router.close()
  }

  currentTab = tab

  const tabTitles = {
    'transactions':    'Transactions',
    'expected-income': 'Expected Income',
    'vendor-bills':    'Vendor Bills',
    'history':         'History',
    'registry':        'Registry',
    'balances':        'Account Balances',
    'vendors':         'Vendor Manager',
  }
  const titleEl   = document.getElementById('cover-title')
  const eyebrowEl = document.getElementById('cover-eyebrow')
  if (titleEl)   titleEl.textContent   = tabTitles[tab] || tab
  if (eyebrowEl) eyebrowEl.textContent = `Payments · ${window.Role?.get() || 'Finance'}`

  document.querySelectorAll('.sb-link').forEach(a => a.classList.remove('cur'))
  document.getElementById('nav-' + tab)?.classList.add('cur')

  if (pushUrl && !_routerDispatching) {
    const qs = new URLSearchParams(window.location.search)
    qs.set('tab', tab)
    qs.delete('entity'); qs.delete('id'); qs.delete('from')
    history.replaceState({}, '', `${window.location.pathname}?${qs}`)
  }

  ;['tab-transactions','tab-expected-income','tab-vendor-bills','tab-history','tab-registry','tab-balances','tab-vendors']
    .forEach(id => document.getElementById(id)?.classList.add('hidden'))

  if (tab === 'transactions') {
    document.getElementById('tab-transactions')?.classList.remove('hidden')
    loadTransactions()
  } else if (tab === 'expected-income') {
    document.getElementById('tab-expected-income')?.classList.remove('hidden')
    loadExpectedIncome()
  } else if (tab === 'vendor-bills') {
    document.getElementById('tab-vendor-bills')?.classList.remove('hidden')
    renderVendorList()
  } else if (tab === 'registry') {
    document.getElementById('tab-registry')?.classList.remove('hidden')
    window.Registry?.load()
  } else if (tab === 'balances') {
    document.getElementById('tab-balances')?.classList.remove('hidden')
    loadBalances()
  } else if (tab === 'vendors') {
    document.getElementById('tab-vendors')?.classList.remove('hidden')
    loadVendorManager()
  } else {
    document.getElementById('tab-history')?.classList.remove('hidden')
    renderHistoryTab()
  }
}
window.switchTab = switchTab

function runWithRouterDispatch(fn) {
  _routerDispatching = true
  try { return fn() } finally { _routerDispatching = false }
}
async function runWithRouterDispatchAsync(fn) {
  _routerDispatching = true
  try { return await fn() } finally { _routerDispatching = false }
}

function registerRouterHandlers() {
  if (!window.Router || _routerRegistered) return
  _routerRegistered = true

  Router.register('vendor', ({ id }) => {
    runWithRouterDispatch(() => {
      openVendorDetail(id)
    })
  })

  Router.register('client', ({ id }) => {
    runWithRouterDispatch(() => {
      openClientPanel(id)
    })
  })

  Router.register('deal', ({ id }) => {
    runWithRouterDispatch(() => {
      openDealPanel(id)
    })
  })

  Router.register('transaction', ({ id }) => {
    runWithRouterDispatch(() => {
      openTxDrawer(id)
    })
  })

  document.addEventListener('router:close', () => {
    runWithRouterDispatch(() => {
      closeRejectModal()
    })
  })

  window.addEventListener('popstate', () => {
    const qs = new URLSearchParams(window.location.search)
    if (qs.get('entity')) return
    const tab = qs.get('tab') || 'transactions'
    runWithRouterDispatch(() => switchTab(tab, { pushUrl: false }))
  })
}

// ═══════════════════════════════════════════════════════════════
// TRANSACTIONS TAB
// ═══════════════════════════════════════════════════════════════

async function loadTransactions() {
  const tbody = document.getElementById('tx-tbody')
  if (!tbody) return
  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--mu2);padding:20px">Loading…</td></tr>'

  const db = window._sb
  if (!db) {
    tbody.innerHTML = '<tr><td colspan="10" style="color:var(--red-text);text-align:center;padding:20px">DB not ready — check db.js</td></tr>'
    return
  }

  try {
    if (typeof getTransactions !== 'function') {
      throw new Error('Missing db.js function: getTransactions')
    }
    txAllRows = await getTransactions({ includeDeleted: txShowDeleted })
    await loadTxAccounts()

    // Part 2A: in-memory dedup scan
    _runDedupScan()

    txPage = 0
    populateTxFilterDropdowns()
    renderTransactions()
    updateTxMetrics()
    updateAlertBarTx()
    _attachCoverShrink()
  } catch (err) {
    console.error('[Transactions]', err)
    tbody.innerHTML = `<tr><td colspan="10" style="color:var(--red-text);text-align:center;padding:20px">${err.message}</td></tr>`
  }
}
window.loadTransactions = loadTransactions

function populateTxFilterDropdowns({ forceRebuild = false } = {}) {
  // Accounts — canonical list from accounts table
  const accSel = document.getElementById('txf-account')
  if (accSel) {
    const cur = accSel.value || txFilterState.account
    accSel.innerHTML = '<option value="">All accounts</option>' +
      txAccounts.map(a => `<option value="${a.id}"${a.id === cur ? ' selected' : ''}>${a.name}</option>`).join('')
  }
  // Months
  const months = [...new Set(txAllRows.map(t => {
    if (!t.transaction_date) return null
    const d = new Date(t.transaction_date)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  }).filter(Boolean))].sort().reverse()
  const moSel = document.getElementById('txf-month')
  if (moSel) {
    const cur = moSel.value || txFilterState.month
    moSel.innerHTML = '<option value="">All months</option>' +
      months.map(m => {
        const [y, mo] = m.split('-')
        const label = new Date(+y, +mo-1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
        return `<option value="${m}"${m === cur ? ' selected' : ''}>${label}</option>`
      }).join('')
  }
  // Categories
  const catSel = document.getElementById('txf-category')
  if (catSel && (forceRebuild || catSel.options.length <= 1)) {
    const cur = catSel.value || txFilterState.category
    catSel.innerHTML = '<option value="">All categories</option>' +
      CATEGORIES.map(c => `<option value="${c.id}"${c.id === cur ? ' selected' : ''}>${c.name}</option>`).join('')
  }
  // Also populate bulk bar dropdowns
  const bulkCatSel = document.getElementById('bulk-cat-sel')
  if (bulkCatSel && (forceRebuild || bulkCatSel.options.length <= 1)) {
    const cur = bulkCatSel.value
    bulkCatSel.innerHTML = '<option value="">Category…</option>' +
      CATEGORIES.map(c => `<option value="${c.id}"${c.id === cur ? ' selected' : ''}>${c.name}</option>`).join('')
  }
  const bulkTaxSel = document.getElementById('bulk-tax-sel')
  if (bulkTaxSel && bulkTaxSel.options.length <= 1) {
    bulkTaxSel.innerHTML = '<option value="">Tax…</option>' +
      TAX_TREATMENTS.map(t => `<option value="${t}">${t}</option>`).join('')
  }
}

function setTxFilter(f) {
  txFilter = f
  txPage = 0
  document.querySelectorAll('.tx-chip').forEach(el => el.classList.toggle('cur', el.dataset.filter === f))
  renderTransactions()
  pushTxUrlParams()
}
window.setTxFilter = setTxFilter

function applyTxFilters() {
  txFilterState.account    = document.getElementById('txf-account')?.value || ''
  txFilterState.month      = document.getElementById('txf-month')?.value || ''
  txFilterState.category   = document.getElementById('txf-category')?.value || ''
  txFilterState.entity     = document.getElementById('txf-entity')?.value || ''
  txFilterState.search     = (document.getElementById('txf-search')?.value || '').trim()
  txPage = 0
  renderTransactions()
  pushTxUrlParams()
}
window.applyTxFilters = applyTxFilters

function toggleNeedsReviewFilter() {
  txFilterState.needsReview = !txFilterState.needsReview
  document.getElementById('txf-review-btn')?.classList.toggle('on', txFilterState.needsReview)
  renderTransactions()
  pushTxUrlParams()
}
window.toggleNeedsReviewFilter = toggleNeedsReviewFilter

function renderTransactions() {
  const tbody = document.getElementById('tx-tbody')
  if (!tbody) return
  closeAllCellEditors()

  let rows = txAllRows.filter(tx => {
    if (txFilter === 'in')           return tx.direction === 'in'
    if (txFilter === 'out')          return tx.direction === 'out'
    if (txFilter === 'needs_review') return !tx.category_id
    if (txFilter === 'transfer')     return (tx.event_type || '').includes('transfer')
    if (txFilter === 'dupes')        return tx._isDuplicate  // Part 2C
    // Provider chips match canonical account.provider (wise / brex / mizrahi)
    if (txFilter !== 'all') {
      return txAccountProvider(tx).includes(txFilter)
    }
    return true
  })

  // Role gate: hide team_member transactions from non-admin/finance roles
  if (!canSeeTeamFinancials()) {
    rows = rows.filter(tx => {
      const vendor = tx.vendor_id ? vmVendors.find(v => v.id === tx.vendor_id) : null
      return !vendor || vendor.vendor_type !== 'team_member'
    })
  }

  // Advanced filters — account filter is canonical account_id only
  if (txFilterState.account) {
    rows = rows.filter(t => t.account_id === txFilterState.account)
  }
  if (txFilterState.month) rows = rows.filter(t => {
    if (!t.transaction_date) return false
    const d = new Date(t.transaction_date)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === txFilterState.month
  })
  if (txFilterState.category)    rows = rows.filter(t => t.category_id === txFilterState.category)
  if (txFilterState.entity)      rows = rows.filter(t => t.entity === txFilterState.entity)
  if (txFilterState.search) {
    const q = txFilterState.search.toLowerCase()
    rows = rows.filter(t => {
      const vendor = t.vendor_id ? vmVendors.find(v => v.id === t.vendor_id) : null
      const vendorName = (vendor?.full_name || vendor?.name || '').toLowerCase()
      const descName = String(t.counterparty_name || t.event_type || '').toLowerCase()
      return vendorName.includes(q) || descName.includes(q)
    })
  }
  if (txFilterState.needsReview) rows = rows.filter(t => !t.category_id)

  const total     = rows.length
  const pageSize  = txPageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (txPage >= totalPages) txPage = totalPages - 1
  const start  = txPage * pageSize
  const paged  = rows.slice(start, start + pageSize)

  // Update pagination controls
  renderTxPagination(total, start, paged.length)

  if (!paged.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--mu2);padding:20px">No transactions</td></tr>'
    return
  }

  tbody.innerHTML = paged.map(tx => {
    const isIn      = tx.direction === 'in'
    const needsRev  = !tx.category_id && !tx.entity
    const label     = tx.counterparty_name || tx.event_type || '—'
    const amtStr    = (tx.currency !== 'USD' ? tx.currency + ' ' : '$') + Math.abs(tx.amount || 0).toFixed(2)
    const amtHtml   = isIn
      ? `<span style="color:var(--green-text);font-weight:600">+${amtStr}</span>`
      : `<span style="color:var(--ink)">−${amtStr}</span>`
    const dotColor  = tx.status === 'reconciled' ? 'var(--green)' : tx.status === 'matched' ? 'var(--blue)' : 'var(--amber)'
    const statusLbl = tx.status || '—'
    const checked   = txSelectedIds.has(tx.id) ? 'checked' : ''
    const accountLbl = txAccountName(tx)

    // Classification cells
    const catName   = catById(tx.category_id)?.name || ''
    const catHtml   = catName
      ? `<span class="cl-cat-pill">${catName}</span>`
      : `<span class="cl-placeholder">Set…</span>`

    const taxKey    = tx.tax_treatment || ''
    const taxClass  = ['non_deductible','mixed_review'].includes(taxKey) ? taxKey : ''
    const taxHtml   = taxKey
      ? `<span class="cl-tax-badge ${taxClass}">${taxKey.replace(/_/g,' ')}</span>`
      : `<span class="cl-placeholder">—</span>`

    const ent       = tx.entity || ''
    const bpHtml    = ent
      ? `<button class="cl-bp-pill ${ent}" onclick="toggleBP(event,'${tx.id}')">${ent === 'business' ? 'B' : 'P'}</button>`
      : `<button class="cl-bp-pill" onclick="toggleBP(event,'${tx.id}')">—</button>`

    const tags      = Array.isArray(tx.tags) ? tx.tags : (tx.tags ? [tx.tags] : [])
    const tagsHtml  = tags.length
      ? tags.map(t => `<span class="cl-tag">${t}</span>`).join('')
      : `<span class="cl-placeholder">+</span>`

    // Part 3A: vendor/description cell
    const knownVendor = tx.vendor_id ? vmVendors.find(v => v.id === tx.vendor_id) : null
    let descHtml
    if (knownVendor) {
      const vn = knownVendor.full_name || knownVendor.name || label
      descHtml = `<span class="tx-vendor-known" data-vid="${tx.vendor_id}" onclick="openVendorQuickPanel(event,'${tx.id}',this)">${vn}${vendorTypeBadge(knownVendor.vendor_type)}</span>`
    } else if (tx.counterparty_name) {
      descHtml = `<span class="tx-vendor-unknown" data-name="${tx.counterparty_name.replace(/"/g,'&quot;')}" onclick="openVendorQuickPanel(event,'${tx.id}',this)">${tx.counterparty_name} ✨</span>`
    } else {
      descHtml = label
    }

    const rowCls = [
      needsRev    ? 'tx-row-review' : '',
      tx._isDuplicate ? 'tx-row-dupe' : '',
      tx.deleted_at   ? 'tx-row-deleted' : '',
    ].filter(Boolean).join(' ')
    const dupeIcon = tx._isDuplicate ? '<span class="tx-dupe-icon" title="Possible duplicate">⚠</span>' : ''
    return `<tr class="${rowCls}" data-txid="${tx.id}" style="cursor:pointer">
      <td class="cb-col"><input type="checkbox" ${checked} onchange="txToggleRow('${tx.id}',this)"></td>
      <td style="white-space:nowrap;font-size:12px;color:var(--mu)">${formatDateShort(tx.transaction_date)}${dupeIcon}</td>
      <td style="font-size:13px">${descHtml}</td>
      <td style="font-size:11px;color:var(--mu);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${accountLbl}">${accountLbl}</td>
      <td style="white-space:nowrap;font-size:12px">
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${dotColor};margin-right:5px;vertical-align:middle"></span>${statusLbl}
      </td>
      <td style="text-align:right;font-family:var(--font-mono);font-size:13px">${amtHtml}</td>
      <td class="cl-cell" onclick="openCatEditor(event,'${tx.id}')">${catHtml}</td>
      <td class="cl-cell" onclick="openTaxEditor(event,'${tx.id}')">${taxHtml}</td>
      <td class="cl-cell" style="white-space:nowrap">${bpHtml}</td>
      <td class="cl-cell" onclick="openTagEditor(event,'${tx.id}')">${tagsHtml}</td>
    </tr>`
  }).join('')
}

function renderTxPagination(total, start, count) {
  let el = document.getElementById('tx-pagination')
  if (!el) {
    // Insert pagination bar after the table block
    const tableBlock = document.getElementById('tx-table-block') || document.querySelector('#tab-transactions .block')
    if (!tableBlock) return
    el = document.createElement('div')
    el.id = 'tx-pagination'
    el.style.cssText = 'display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap'
    tableBlock.insertAdjacentElement('afterend', el)
  }

  const pageSize   = txPageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page       = txPage
  const end        = Math.min(start + count, total)

  el.innerHTML = `
    <span style="font-size:12px;color:var(--mu)">${start + 1}–${end} of ${total}</span>
    <button class="btn btn-sm btn-ghost" onclick="txGoPage(${page - 1})" ${page === 0 ? 'disabled' : ''}>← Prev</button>
    <span style="font-size:12px;color:var(--mu)">Page ${page + 1} / ${totalPages}</span>
    <button class="btn btn-sm btn-ghost" onclick="txGoPage(${page + 1})" ${page >= totalPages - 1 ? 'disabled' : ''}>Next →</button>
    <span style="font-size:12px;color:var(--mu);margin-left:8px">Show</span>
    ${[50,100,200].map(n =>
      `<button class="btn btn-sm ${txPageSize === n ? 'btn-primary' : 'btn-ghost'}" onclick="txSetPageSize(${n})">${n}</button>`
    ).join('')}
  `
}

function txGoPage(p) {
  txPage = Math.max(0, p)
  renderTransactions()
  pushTxUrlParams()
}
window.txGoPage = txGoPage

function txSetPageSize(n) {
  txPageSize = n
  txPage = 0
  renderTransactions()
  pushTxUrlParams()
}
window.txSetPageSize = txSetPageSize

// ─── URL param persistence ───────────────────────────────────────

function pushTxUrlParams() {
  const qs = new URLSearchParams(window.location.search)
  qs.set('tab', 'transactions')
  if (txFilter && txFilter !== 'all') qs.set('chip', txFilter)
  else qs.delete('chip')
  if (txFilterState.account)    qs.set('account', txFilterState.account)
  else qs.delete('account')
  if (txFilterState.month)      qs.set('month', txFilterState.month)
  else qs.delete('month')
  if (txFilterState.category)   qs.set('category', txFilterState.category)
  else qs.delete('category')
  if (txFilterState.entity)     qs.set('entity', txFilterState.entity)
  else qs.delete('entity')
  if (txFilterState.search)     qs.set('search', txFilterState.search)
  else qs.delete('search')
  if (txFilterState.needsReview) qs.set('needsReview', '1')
  else qs.delete('needsReview')
  if (txPage > 0)               qs.set('page', txPage)
  else qs.delete('page')
  if (txPageSize !== 100)       qs.set('pageSize', txPageSize)
  else qs.delete('pageSize')
  history.replaceState({}, '', `${window.location.pathname}?${qs}`)
}

function restoreTxUrlParams() {
  const qs = new URLSearchParams(window.location.search)
  const chip = qs.get('chip')
  if (chip) {
    txFilter = chip
    document.querySelectorAll('.tx-chip').forEach(el => el.classList.toggle('cur', el.dataset.filter === chip))
  }
  const account = qs.get('account')
  if (account) {
    txFilterState.account = account
    const sel = document.getElementById('txf-account')
    if (sel) sel.value = account
  }
  const month = qs.get('month')
  if (month) {
    txFilterState.month = month
    const sel = document.getElementById('txf-month')
    if (sel) sel.value = month
  }
  const category = qs.get('category')
  if (category) {
    txFilterState.category = category
    const sel = document.getElementById('txf-category')
    if (sel) sel.value = category
  }
  const entity = qs.get('entity')
  if (entity) {
    txFilterState.entity = entity
    const sel = document.getElementById('txf-entity')
    if (sel) sel.value = entity
  }
  const search = qs.get('search')
  if (search) {
    txFilterState.search = search
    const inp = document.getElementById('txf-search')
    if (inp) inp.value = search
  }
  if (qs.get('needsReview') === '1') {
    txFilterState.needsReview = true
    document.getElementById('txf-review-btn')?.classList.add('on')
  }
  const page = parseInt(qs.get('page'), 10)
  if (!isNaN(page) && page > 0) txPage = page
  const pageSize = parseInt(qs.get('pageSize'), 10)
  if (!isNaN(pageSize) && pageSize > 0) txPageSize = pageSize
}

// ═══════════════════════════════════════════════════════════════
// CELL SELECTION
// ═══════════════════════════════════════════════════════════════

function txToggleRow(id, cb) {
  if (cb.checked) txSelectedIds.add(id)
  else txSelectedIds.delete(id)
  updateBulkBar()
}
window.txToggleRow = txToggleRow

function txSelectAll(cb) {
  const allVisible = Array.from(document.querySelectorAll('#tx-tbody tr[data-txid]'))
    .map(r => r.dataset.txid)
  if (cb.checked) allVisible.forEach(id => txSelectedIds.add(id))
  else allVisible.forEach(id => txSelectedIds.delete(id))
  updateBulkBar()
  // Reflect on individual checkboxes
  document.querySelectorAll('#tx-tbody input[type=checkbox]').forEach(c => { c.checked = cb.checked })
}
window.txSelectAll = txSelectAll

function clearTxSelection() {
  txSelectedIds.clear()
  document.querySelectorAll('#tx-tbody input[type=checkbox]').forEach(c => { c.checked = false })
  const selAll = document.getElementById('tx-select-all')
  if (selAll) selAll.checked = false
  updateBulkBar()
}
window.clearTxSelection = clearTxSelection

function updateBulkBar() {
  const bar     = document.getElementById('bulk-bar')
  const cnt     = document.getElementById('bulk-bar-count')
  const dupeBtn = document.getElementById('bulk-dupe-btn')
  if (!bar) return
  const n = txSelectedIds.size
  if (n > 0) {
    bar.classList.add('open')
    if (cnt) cnt.textContent = `${n} selected`
    if (dupeBtn) dupeBtn.style.display = n >= 2 ? '' : 'none'
  } else {
    bar.classList.remove('open')
  }
}

// ═══════════════════════════════════════════════════════════════
// INLINE SAVE HELPER
// ═══════════════════════════════════════════════════════════════

async function saveTxField(txId, fields) {
  // Optimistic update in txAllRows
  const row = txAllRows.find(t => t.id === txId)
  const oldData = row ? { ...row } : null
  if (row) Object.assign(row, fields)

  const db = window._sb
  if (!db) return
  try {
    const { error } = await db.from('transactions').update(fields).eq('id', txId)
    if (error) throw error
  } catch (err) {
    console.error('[Classification save]', err)
    showToast('Save failed: ' + err.message, 'warn')
  }
  // Re-render just this row's classification cells
  rerenderTxRow(txId)
  updateTxMetrics()

  // Audit log
  writeAuditLog({ entityType: 'transaction', entityId: txId, action: 'classify',
    oldData, newData: fields, meta: { fields: Object.keys(fields) } })

  // Part 1: offer to remember merchant classification
  if (fields.category_id) {
    const tx = txAllRows.find(t => t.id === txId)
    const cpName = tx?.counterparty_name
    if (cpName) {
      try {
        const { data: existing } = await db
          .from('vendors')
          .select('id')
          .eq('vendor_type', 'merchant')
          .or(`name.ilike.${cpName},match_patterns.cs.{${cpName}}`)
          .limit(1)
        if (existing && existing.length > 0) {
          // Silently update existing merchant
          await db.from('vendors').update({
            category_id: tx.category_id,
            tax_treatment: tx.tax_treatment || null,
            entity: tx.entity || null,
          }).eq('id', existing[0].id)
        } else {
          showMerchantRememberBanner(cpName, tx)
        }
      } catch (err) {
        console.warn('[MerchantRemember]', err)
      }
    }
  }
}

function rerenderTxRow(txId) {
  const tx = txAllRows.find(t => t.id === txId)
  if (!tx) return
  const tr = document.querySelector(`#tx-tbody tr[data-txid="${txId}"]`)
  if (!tr) return

  const catName   = catById(tx.category_id)?.name || ''
  const catTd     = tr.querySelector('td:nth-child(7)')
  if (catTd) catTd.innerHTML = catName
    ? `<span class="cl-cat-pill">${catName}</span>`
    : `<span class="cl-placeholder">Set…</span>`

  const taxKey    = tx.tax_treatment || ''
  const taxClass  = ['non_deductible','mixed_review'].includes(taxKey) ? taxKey : ''
  const taxTd     = tr.querySelector('td:nth-child(8)')
  if (taxTd) taxTd.innerHTML = taxKey
    ? `<span class="cl-tax-badge ${taxClass}">${taxKey.replace(/_/g,' ')}</span>`
    : `<span class="cl-placeholder">—</span>`

  const ent       = tx.entity || ''
  const bpTd      = tr.querySelector('td:nth-child(9)')
  if (bpTd) bpTd.innerHTML = ent
    ? `<button class="cl-bp-pill ${ent}" onclick="toggleBP(event,'${tx.id}')">${ent === 'business' ? 'B' : 'P'}</button>`
    : `<button class="cl-bp-pill" onclick="toggleBP(event,'${tx.id}')">—</button>`

  const tags      = Array.isArray(tx.tags) ? tx.tags : (tx.tags ? [tx.tags] : [])
  const tagsTd    = tr.querySelector('td:nth-child(10)')
  if (tagsTd) tagsTd.innerHTML = tags.length
    ? tags.map(t => `<span class="cl-tag">${t}</span>`).join('')
    : `<span class="cl-placeholder">+</span>`

  // Update needs-review border
  const needsRev = !tx.category_id && !tx.entity
  tr.classList.toggle('tx-row-review', needsRev)
}

// ═══════════════════════════════════════════════════════════════
// MERCHANT REMEMBER BANNER
// ═══════════════════════════════════════════════════════════════

function showMerchantRememberBanner(cpName, tx) {
  // Remove any existing merchant banner
  document.getElementById('merchant-remember-banner')?.remove()

  const banner = document.createElement('div')
  banner.id = 'merchant-remember-banner'
  banner.className = 'merchant-banner'
  banner.innerHTML = `
    <span>💾 Remember classification for <strong>${cpName}</strong>?</span>
    <button class="merchant-banner-btn" id="merchant-banner-save">Save</button>
    <button class="merchant-banner-skip" id="merchant-banner-skip">Skip</button>
  `

  const tab = document.getElementById('tab-transactions')
  if (tab) tab.insertAdjacentElement('afterbegin', banner)
  else document.body.appendChild(banner)

  document.getElementById('merchant-banner-skip').onclick = () => banner.remove()
  document.getElementById('merchant-banner-save').onclick = async () => {
    banner.remove()
    const db = window._sb
    if (!db) return
    try {
      await db.from('vendors').insert({
        name: cpName,
        vendor_type: 'merchant',
        category_id: tx.category_id || null,
        tax_treatment: tx.tax_treatment || null,
        entity: tx.entity || null,
        match_patterns: [cpName],
        is_active: true,
      })
      showToast('Merchant saved')
    } catch (err) {
      console.error('[MerchantSave]', err)
      showToast('Failed to save merchant: ' + err.message, 'warn')
    }
  }
}

function showMerchantBulkBanner(names, fields) {
  document.getElementById('merchant-bulk-banner')?.remove()

  const banner = document.createElement('div')
  banner.id = 'merchant-bulk-banner'
  banner.className = 'merchant-banner'
  banner.innerHTML = `
    <span>💾 Save rules for <strong>${names.length}</strong> merchant${names.length > 1 ? 's' : ''}?</span>
    <button class="merchant-banner-btn" id="merchant-bulk-save">Save All</button>
    <button class="merchant-banner-skip" id="merchant-bulk-skip">Dismiss</button>
  `

  const tab = document.getElementById('tab-transactions')
  if (tab) tab.insertAdjacentElement('afterbegin', banner)
  else document.body.appendChild(banner)

  document.getElementById('merchant-bulk-skip').onclick = () => banner.remove()
  document.getElementById('merchant-bulk-save').onclick = async () => {
    banner.remove()
    const db = window._sb
    if (!db) return
    let saved = 0
    for (const name of names) {
      try {
        const { data: existing } = await db
          .from('vendors')
          .select('id')
          .eq('vendor_type', 'merchant')
          .or(`name.ilike.${name},match_patterns.cs.{${name}}`)
          .limit(1)
        if (existing && existing.length > 0) {
          await db.from('vendors').update({
            category_id: fields.category_id || null,
            tax_treatment: fields.tax_treatment || null,
            entity: fields.entity || null,
          }).eq('id', existing[0].id)
        } else {
          await db.from('vendors').insert({
            name,
            vendor_type: 'merchant',
            category_id: fields.category_id || null,
            tax_treatment: fields.tax_treatment || null,
            entity: fields.entity || null,
            match_patterns: [name],
            is_active: true,
          })
        }
        saved++
      } catch (err) {
        console.warn('[MerchantBulkSave]', name, err)
      }
    }
    showToast(`Saved ${saved} merchant rule${saved !== 1 ? 's' : ''}`)
  }
}

// ═══════════════════════════════════════════════════════════════
// INLINE EDITORS
// ═══════════════════════════════════════════════════════════════

let _openEditor = null // { el, txId, type }

function closeAllCellEditors() {
  if (_openEditor) {
    _openEditor.el.remove()
    _openEditor = null
  }
}

// ---------- CATEGORY EDITOR ----------
function openCatEditor(evt, txId) {
  evt.stopPropagation()
  closeAllCellEditors()

  const td = evt.currentTarget
  const tx = txAllRows.find(t => t.id === txId)
  if (!tx) return

  const dd = document.createElement('div')
  dd.className = 'cl-dropdown'
  dd.style.minWidth = '220px'

  const input = document.createElement('input')
  input.placeholder = 'Search category…'
  dd.appendChild(input)

  const list = document.createElement('div')
  list.className = 'cl-dropdown-list'
  dd.appendChild(list)

  let hiIdx = -1

  function renderList(q) {
    const filtered = CATEGORIES.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()))
    list.innerHTML = filtered.map((c, i) => {
      const isSel = c.id === tx.category_id
      return `<div class="cl-dropdown-item${isSel ? ' sel' : ''}" data-id="${c.id}" data-idx="${i}">${c.name}</div>`
    }).join('')
    hiIdx = -1
    list.querySelectorAll('.cl-dropdown-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault()
        selectCategory(txId, item.dataset.id)
      })
    })
  }

  function highlight(newIdx) {
    const items = list.querySelectorAll('.cl-dropdown-item')
    items.forEach(i => i.classList.remove('hi'))
    hiIdx = Math.max(0, Math.min(newIdx, items.length - 1))
    items[hiIdx]?.classList.add('hi')
    items[hiIdx]?.scrollIntoView({ block: 'nearest' })
  }

  input.addEventListener('input', () => renderList(input.value))
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(hiIdx + 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(hiIdx - 1) }
    else if (e.key === 'Enter') {
      const items = list.querySelectorAll('.cl-dropdown-item')
      const item = hiIdx >= 0 ? items[hiIdx] : items[0]
      if (item) selectCategory(txId, item.dataset.id)
    } else if (e.key === 'Escape') { closeAllCellEditors() }
    else if (e.key === 'Tab') {
      e.preventDefault()
      const items = list.querySelectorAll('.cl-dropdown-item')
      const item = hiIdx >= 0 ? items[hiIdx] : items[0]
      if (item) selectCategory(txId, item.dataset.id)
      moveFocusToNextCl(txId, 'category')
    }
  })

  renderList('')

  td.style.position = 'relative'
  td.appendChild(dd)
  _openEditor = { el: dd, txId, type: 'category' }
  input.focus()
}
window.openCatEditor = openCatEditor

function selectCategory(txId, catId) {
  closeAllCellEditors()
  const cat = catById(catId)
  if (!cat) return
  const fields = { category_id: catId }
  // Auto-fill tax if not already set or if user hasn't overridden
  const tx = txAllRows.find(t => t.id === txId)
  if (cat.tax && (!tx?.tax_treatment)) fields.tax_treatment = cat.tax
  saveTxField(txId, fields)
}

// ---------- TAX EDITOR ----------
function openTaxEditor(evt, txId) {
  evt.stopPropagation()
  closeAllCellEditors()

  const td = evt.currentTarget
  const tx = txAllRows.find(t => t.id === txId)
  if (!tx) return

  const dd = document.createElement('div')
  dd.className = 'cl-dropdown'
  dd.style.minWidth = '200px'

  const input = document.createElement('input')
  input.placeholder = 'Search tax…'
  dd.appendChild(input)

  const list = document.createElement('div')
  list.className = 'cl-dropdown-list'
  dd.appendChild(list)

  let hiIdx = -1

  function renderList(q) {
    const filtered = TAX_TREATMENTS.filter(t => !q || t.includes(q.toLowerCase()))
    list.innerHTML = filtered.map((t, i) => {
      const isSel = t === tx.tax_treatment
      return `<div class="cl-dropdown-item${isSel ? ' sel' : ''}" data-val="${t}" data-idx="${i}">${t.replace(/_/g,' ')}</div>`
    }).join('')
    hiIdx = -1
    list.querySelectorAll('.cl-dropdown-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault()
        selectTax(txId, item.dataset.val)
      })
    })
  }

  function highlight(newIdx) {
    const items = list.querySelectorAll('.cl-dropdown-item')
    items.forEach(i => i.classList.remove('hi'))
    hiIdx = Math.max(0, Math.min(newIdx, items.length - 1))
    items[hiIdx]?.classList.add('hi')
    items[hiIdx]?.scrollIntoView({ block: 'nearest' })
  }

  input.addEventListener('input', () => renderList(input.value))
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(hiIdx + 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(hiIdx - 1) }
    else if (e.key === 'Enter') {
      const items = list.querySelectorAll('.cl-dropdown-item')
      const item = hiIdx >= 0 ? items[hiIdx] : items[0]
      if (item) selectTax(txId, item.dataset.val)
    } else if (e.key === 'Escape') { closeAllCellEditors() }
    else if (e.key === 'Tab') {
      e.preventDefault()
      const items = list.querySelectorAll('.cl-dropdown-item')
      const item = hiIdx >= 0 ? items[hiIdx] : items[0]
      if (item) selectTax(txId, item.dataset.val)
      moveFocusToNextCl(txId, 'tax')
    }
  })

  renderList('')
  td.style.position = 'relative'
  td.appendChild(dd)
  _openEditor = { el: dd, txId, type: 'tax' }
  input.focus()
}
window.openTaxEditor = openTaxEditor

function selectTax(txId, val) {
  closeAllCellEditors()
  saveTxField(txId, { tax_treatment: val })
}

// ---------- B/P TOGGLE ----------
function toggleBP(evt, txId) {
  evt.stopPropagation()
  closeAllCellEditors()
  const tx = txAllRows.find(t => t.id === txId)
  if (!tx) return
  const next = tx.entity === 'business' ? 'private' : 'business'
  saveTxField(txId, { entity: next })
}
window.toggleBP = toggleBP

// ---------- TAG EDITOR ----------
function openTagEditor(evt, txId) {
  evt.stopPropagation()
  closeAllCellEditors()

  const td = evt.currentTarget
  const tx = txAllRows.find(t => t.id === txId)
  if (!tx) return

  let currentTags = Array.isArray(tx.tags) ? [...tx.tags] : []

  const pop = document.createElement('div')
  pop.className = 'cl-tag-popover'

  function renderChips() {
    pop.innerHTML = ''
    const chipsDiv = document.createElement('div')
    chipsDiv.className = 'cl-tag-chips'
    currentTags.forEach(tag => {
      const chip = document.createElement('span')
      chip.className = 'cl-tag'
      chip.innerHTML = `${tag} <span class="cl-tag-x" data-tag="${tag}">×</span>`
      chip.querySelector('.cl-tag-x').addEventListener('mousedown', e => {
        e.preventDefault()
        currentTags = currentTags.filter(t => t !== tag)
        renderChips()
      })
      chipsDiv.appendChild(chip)
    })
    pop.appendChild(chipsDiv)

    const inputWrap = document.createElement('div')
    inputWrap.className = 'cl-tag-input-wrap'
    const inp = document.createElement('input')
    inp.className = 'cl-tag-input'
    inp.placeholder = 'Add tag…'
    inputWrap.appendChild(inp)
    pop.appendChild(inputWrap)

    const ac = document.createElement('div')
    ac.className = 'cl-tag-ac'
    ac.style.display = 'none'
    inputWrap.appendChild(ac)

    inp.addEventListener('input', () => {
      const q = inp.value.toLowerCase().trim()
      if (!q) { ac.style.display = 'none'; return }
      const matches = TAG_POOL.filter(t => t.includes(q) && !currentTags.includes(t))
      if (!matches.length) { ac.style.display = 'none'; return }
      ac.style.display = 'block'
      ac.innerHTML = matches.slice(0, 10).map(t =>
        `<div class="cl-tag-ac-item" data-tag="${t}">${t}</div>`
      ).join('')
      ac.querySelectorAll('.cl-tag-ac-item').forEach(item => {
        item.addEventListener('mousedown', e => {
          e.preventDefault()
          addTag(item.dataset.tag)
        })
      })
    })

    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const val = inp.value.trim()
        if (val) addTag(val)
      } else if (e.key === 'Escape') {
        commitTags()
      } else if (e.key === 'Tab') {
        e.preventDefault()
        const val = inp.value.trim()
        if (val) addTag(val)
        commitTags()
        moveFocusToNextCl(txId, 'tags')
      }
    })

    setTimeout(() => inp.focus(), 0)

    function addTag(tag) {
      if (!currentTags.includes(tag)) currentTags.push(tag)
      inp.value = ''
      ac.style.display = 'none'
      renderChips()
    }
  }

  function commitTags() {
    closeAllCellEditors()
    saveTxField(txId, { tags: currentTags })
  }

  renderChips()

  td.style.position = 'relative'
  td.appendChild(pop)
  _openEditor = { el: pop, txId, type: 'tags', commit: commitTags }

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('mousedown', _outsideClickHandler, { once: true })
  }, 0)
}
window.openTagEditor = openTagEditor

function _outsideClickHandler(e) {
  if (_openEditor && !_openEditor.el.contains(e.target)) {
    if (_openEditor.commit) _openEditor.commit()
    else closeAllCellEditors()
  }
}

// Tab navigation between classification cells
function moveFocusToNextCl(txId, currentField) {
  const order = ['category', 'tax', 'bp', 'tags']
  const idx   = order.indexOf(currentField)
  const next  = order[idx + 1]
  if (!next) return

  const tr = document.querySelector(`#tx-tbody tr[data-txid="${txId}"]`)
  if (!tr) return

  // col indices: 7=cat, 8=tax, 9=bp, 10=tags (1-based nth-child)
  const colMap = { category: 7, tax: 8, bp: 9, tags: 10 }
  const td = tr.querySelector(`td:nth-child(${colMap[next]})`)
  if (td) {
    setTimeout(() => {
      if (next === 'bp') toggleBP({ stopPropagation: () => {} }, txId)
      else td.click()
    }, 0)
  }
}

// Close on click outside
document.addEventListener('click', e => {
  if (_openEditor && !_openEditor.el.contains(e.target)) {
    if (_openEditor.commit) _openEditor.commit()
    else closeAllCellEditors()
  }
})

// ═══════════════════════════════════════════════════════════════
// BULK EDIT BAR
// ═══════════════════════════════════════════════════════════════

function cycleBulkBP() {
  const btn = document.getElementById('bulk-bp-btn')
  if (!btn) return
  if (bulkBPState === '') { bulkBPState = 'business'; btn.className = 'bulk-bp-toggle b'; btn.textContent = 'Business' }
  else if (bulkBPState === 'business') { bulkBPState = 'private'; btn.className = 'bulk-bp-toggle p'; btn.textContent = 'Private' }
  else { bulkBPState = ''; btn.className = 'bulk-bp-toggle'; btn.textContent = 'B/P' }
}
window.cycleBulkBP = cycleBulkBP

function openBulkTagEditor() {
  const val = prompt('Add tags (comma separated):')
  if (!val) return
  bulkTagsAdd = val.split(',').map(t => t.trim()).filter(Boolean)
  showToast(`Will add: ${bulkTagsAdd.join(', ')}`, 'info')
}
window.openBulkTagEditor = openBulkTagEditor

async function applyBulkEdit() {
  if (txSelectedIds.size === 0) return
  const ids = Array.from(txSelectedIds)
  const db  = window._sb
  if (!db)  { showToast('DB not ready', 'warn'); return }

  const catId  = document.getElementById('bulk-cat-sel')?.value
  const taxVal = document.getElementById('bulk-tax-sel')?.value

  // Build fields to update
  const fields = {}
  if (catId)  { fields.category_id = catId }
  if (catId && !taxVal) {
    const cat = catById(catId)
    if (cat?.tax) fields.tax_treatment = cat.tax
  }
  if (taxVal) fields.tax_treatment = taxVal
  if (bulkBPState) fields.entity = bulkBPState

  if (Object.keys(fields).length === 0 && bulkTagsAdd.length === 0) {
    showToast('Nothing to apply', 'info'); return
  }

  try {
    if (Object.keys(fields).length > 0) {
      const { error } = await db.from('transactions').update(fields).in('id', ids)
      if (error) throw error
    }

    // Tags: merge per-row
    if (bulkTagsAdd.length > 0) {
      for (const id of ids) {
        const row = txAllRows.find(t => t.id === id)
        const existing = Array.isArray(row?.tags) ? row.tags : []
        const merged   = [...new Set([...existing, ...bulkTagsAdd])]
        await db.from('transactions').update({ tags: merged }).eq('id', id)
        if (row) row.tags = merged
      }
    }

    // Optimistic update in memory
    ids.forEach(id => {
      const row = txAllRows.find(t => t.id === id)
      if (row) Object.assign(row, fields)
    })

    showToast(`Updated ${ids.length} transaction${ids.length > 1 ? 's' : ''}`)

    // Audit log
    writeAuditLog({ entityType: 'transaction', entityId: ids.join(','), action: 'bulk_classify',
      newData: fields, meta: { count: ids.length, fields: Object.keys(fields) } })

    // Offer to save merchant rules for unique counterparties that now have category_id
    if (fields.category_id) {
      const uniqueNames = [...new Set(
        ids.map(id => txAllRows.find(t => t.id === id)?.counterparty_name).filter(Boolean)
      )]
      if (uniqueNames.length) {
        showMerchantBulkBanner(uniqueNames, fields)
      }
    }

    clearTxSelection()
    bulkTagsAdd = []
    bulkBPState = ''
    const btn = document.getElementById('bulk-bp-btn')
    if (btn) { btn.className = 'bulk-bp-toggle'; btn.textContent = 'B/P' }
    renderTransactions()
    updateTxMetrics()
  } catch (err) {
    console.error('[Bulk edit]', err)
    showToast('Bulk save failed: ' + err.message, 'warn')
  }
}
window.applyBulkEdit = applyBulkEdit

// ═══════════════════════════════════════════════════════════════
// CSV EXPORT
// ═══════════════════════════════════════════════════════════════

function exportTxCSV() {
  // Build filtered rows (same logic as renderTransactions, but no paging)
  let rows = txAllRows.filter(tx => {
    if (txFilter === 'in')           return tx.direction === 'in'
    if (txFilter === 'out')          return tx.direction === 'out'
    if (txFilter === 'needs_review') return !tx.category_id
    if (txFilter === 'transfer')     return (tx.event_type || '').includes('transfer')
    if (txFilter !== 'all') {
      return txAccountProvider(tx).includes(txFilter)
    }
    return true
  })
  if (txFilterState.account)    rows = rows.filter(t => t.account_id === txFilterState.account)
  if (txFilterState.month)      rows = rows.filter(t => {
    if (!t.transaction_date) return false
    const d = new Date(t.transaction_date)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === txFilterState.month
  })
  if (txFilterState.category)   rows = rows.filter(t => t.category_id === txFilterState.category)
  if (txFilterState.entity)     rows = rows.filter(t => t.entity === txFilterState.entity)
  if (txFilterState.needsReview) rows = rows.filter(t => !t.category_id)

  const escape = v => {
    const s = (v == null ? '' : String(v)).replace(/"/g, '""')
    return /[",\n]/.test(s) ? `"${s}"` : s
  }
  const header = ['Date','Description','Account','Direction','Amount','Currency','Status','Category','Tax','Entity','Tags']
  const csvRows = [header.join(',')]
  rows.forEach(tx => {
    const tags = Array.isArray(tx.tags) ? tx.tags.join('; ') : (tx.tags || '')
    csvRows.push([
      escape(tx.transaction_date || ''),
      escape(tx.counterparty_name || tx.event_type || ''),
      escape(txAccountName(tx)),
      escape(tx.direction || ''),
      escape(tx.amount != null ? Math.abs(tx.amount).toFixed(2) : ''),
      escape(tx.currency || ''),
      escape(tx.status || ''),
      escape(catName(tx.category_id) || ''),
      escape(tx.tax_treatment || ''),
      escape(tx.entity || ''),
      escape(tags),
    ].join(','))
  })

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const today = new Date().toISOString().slice(0, 10)
  a.href     = url
  a.download = `transactions-${today}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
window.exportTxCSV = exportTxCSV

// ═══════════════════════════════════════════════════════════════
// COLUMN CONFIGURATOR
// ═══════════════════════════════════════════════════════════════

const TX_COL_STORAGE_KEY = 'hsos_tx_columns'
const TX_COL_NAMES = ['date','desc','account','status','amount','category','tax','bp','tags']

function initTxColumns() {
  let saved = {}
  try { saved = JSON.parse(localStorage.getItem(TX_COL_STORAGE_KEY) || '{}') } catch {}
  const table = document.getElementById('tx-table')
  if (!table) return
  TX_COL_NAMES.forEach(col => {
    const visible = saved[col] !== false  // default: visible
    if (!visible) table.classList.add(`hide-col-${col}`)
    // Sync checkbox
    const cb = document.querySelector(`#col-cfg-panel input[data-col="${col}"]`)
    if (cb) cb.checked = visible
  })
}

function toggleTxCol(cb) {
  const col   = cb.dataset.col
  const table = document.getElementById('tx-table')
  if (!table) return
  if (cb.checked) table.classList.remove(`hide-col-${col}`)
  else            table.classList.add(`hide-col-${col}`)
  // Persist
  let saved = {}
  try { saved = JSON.parse(localStorage.getItem(TX_COL_STORAGE_KEY) || '{}') } catch {}
  saved[col] = cb.checked
  localStorage.setItem(TX_COL_STORAGE_KEY, JSON.stringify(saved))
}
window.toggleTxCol = toggleTxCol

function toggleColPanel() {
  document.getElementById('col-cfg-panel')?.classList.toggle('open')
}
window.toggleColPanel = toggleColPanel

// Close col panel on outside click
document.addEventListener('click', e => {
  const wrap = document.getElementById('col-cfg-wrap')
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('col-cfg-panel')?.classList.remove('open')
  }
})

// ═══════════════════════════════════════════════════════════════
// COUNTERPARTY AUTO-CLASSIFY RULES
// ═══════════════════════════════════════════════════════════════

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60)
}

function showRuleBanner(counterparties, catId, taxVal, entityVal) {
  // Remove any existing banner
  document.getElementById('rule-save-banner')?.remove()

  const banner = document.createElement('div')
  banner.id = 'rule-save-banner'
  banner.className = 'rule-banner'
  banner.innerHTML = `
    <span>💾 Save classification rules for <strong>${counterparties.length}</strong> merchant(s)?</span>
    <button class="rule-banner-btn" id="rule-banner-save">Save</button>
    <button class="rule-banner-dismiss" id="rule-banner-dismiss">✕</button>
  `
  document.body.appendChild(banner)

  document.getElementById('rule-banner-dismiss').onclick = () => banner.remove()
  document.getElementById('rule-banner-save').onclick = async () => {
    banner.remove()
    await saveClassificationRules(counterparties, catId, taxVal, entityVal)
  }
}

async function saveClassificationRules(counterparties, catId, taxVal, entityVal) {
  const db = window._sb
  if (!db) { showToast('DB not ready', 'warn'); return }

  const rulesRows = []
  counterparties.forEach(name => {
    const slug = slugify(name)
    if (catId) {
      rulesRows.push({
        id: `rule_${slug}_cat`,
        provider: 'any',
        priority: 10,
        when_field: 'counterparty_name',
        when_op: 'contains',
        when_value: name,
        set_field: 'category_id',
        set_value: catId,
        stop: false,
      })
    }
    if (taxVal) {
      rulesRows.push({
        id: `rule_${slug}_tax`,
        provider: 'any',
        priority: 11,
        when_field: 'counterparty_name',
        when_op: 'contains',
        when_value: name,
        set_field: 'tax_treatment',
        set_value: taxVal,
        stop: false,
      })
    }
    if (entityVal) {
      rulesRows.push({
        id: `rule_${slug}_entity`,
        provider: 'any',
        priority: 12,
        when_field: 'counterparty_name',
        when_op: 'contains',
        when_value: name,
        set_field: 'entity',
        set_value: entityVal,
        stop: false,
      })
    }
  })

  if (!rulesRows.length) return
  try {
    const { error } = await db.from('classification_rules').upsert(rulesRows, { onConflict: 'id' })
    if (error) throw error
    showToast(`Saved ${rulesRows.length} rule(s)`)
  } catch (err) {
    console.error('[ClassificationRules]', err)
    showToast('Failed to save rules: ' + err.message, 'warn')
  }
}

async function applyClassificationRules() {
  const db = window._sb
  if (!db) { showToast('DB not ready', 'warn'); return }

  try {
    const [rulesRes, merchantsRes] = await Promise.all([
      db.from('classification_rules').select('*').order('priority'),
      db.from('vendors').select('id, name, category_id, tax_treatment, entity, match_patterns').eq('vendor_type', 'merchant').eq('is_active', true),
    ])
    if (rulesRes.error) throw rulesRes.error
    if (merchantsRes.error) throw merchantsRes.error

    const rules     = rulesRes.data || []
    const merchants = merchantsRes.data || []

    const unclassified = txAllRows.filter(t => !t.category_id)
    if (!unclassified.length) { showToast('No unclassified transactions', 'info'); return }
    if (!rules.length && !merchants.length) { showToast('No rules found', 'info'); return }

    const updates = [] // { id, fields }
    unclassified.forEach(tx => {
      const name = (tx.counterparty_name || '').toLowerCase()
      if (!name) return
      const fields = {}

      // classification_rules table
      rules.forEach(rule => {
        if (rule.when_field !== 'counterparty_name') return
        let match = false
        if (rule.when_op === 'contains') match = name.includes((rule.when_value || '').toLowerCase())
        else if (rule.when_op === 'equals') match = name === (rule.when_value || '').toLowerCase()
        if (!match) return
        if (rule.set_field && rule.set_value !== undefined) fields[rule.set_field] = rule.set_value
      })

      // merchant vendor match_patterns (only if not already matched by rules)
      if (!fields.category_id) {
        const matched = merchants.find(m =>
          (Array.isArray(m.match_patterns) ? m.match_patterns : []).some(p =>
            name === p.toLowerCase() || name.includes(p.toLowerCase())
          )
        )
        if (matched) {
          if (matched.category_id) fields.category_id = matched.category_id
          if (matched.tax_treatment) fields.tax_treatment = matched.tax_treatment
          if (matched.entity) fields.entity = matched.entity
          fields.vendor_id = matched.id
        }
      }

      if (Object.keys(fields).length) updates.push({ id: tx.id, fields })
    })

    if (!updates.length) { showToast('No matches found', 'info'); return }

    // Count merchant-sourced matches for toast
    const merchantMatchCount = updates.filter(u => u.fields.vendor_id).length
    const merchantIds = new Set(updates.filter(u => u.fields.vendor_id).map(u => u.fields.vendor_id))

    // Batch update in chunks of 50
    const chunkSize = 50
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize)
      // Group by identical field sets for efficiency
      const byFields = {}
      chunk.forEach(u => {
        const key = JSON.stringify(u.fields)
        if (!byFields[key]) byFields[key] = { fields: u.fields, ids: [] }
        byFields[key].ids.push(u.id)
      })
      for (const [, { fields, ids: gids }] of Object.entries(byFields)) {
        const { error } = await db.from('transactions').update(fields).in('id', gids)
        if (error) throw error
        // Update in memory
        gids.forEach(id => {
          const row = txAllRows.find(t => t.id === id)
          if (row) Object.assign(row, fields)
        })
      }
    }

    let toastMsg = `Auto-classified ${updates.length} transaction(s)`
    if (merchantMatchCount > 0) toastMsg += ` (${merchantMatchCount} from ${merchantIds.size} merchant rule${merchantIds.size > 1 ? 's' : ''})`
    showToast(toastMsg)
    renderTransactions()
    updateTxMetrics()
  } catch (err) {
    console.error('[ApplyRules]', err)
    showToast('Failed: ' + err.message, 'warn')
  }
}
window.applyClassificationRules = applyClassificationRules

// ═══════════════════════════════════════════════════════════════
// VENDOR MANAGER TAB
// ═══════════════════════════════════════════════════════════════

let vmVendors  = []
let vmVendorCl = {} // { [vendorId]: { category_id, tax_treatment, entity, tags, aliases } }

async function loadVendorManager() {
  await Promise.all([loadVMVendors(), loadVMUnmatched(), loadVMMerchants()])
}
window.loadVendorManager = loadVendorManager

async function loadVMVendors() {
  const tbody = document.getElementById('vm-vendors-tbody')
  if (!tbody) return
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--mu2);padding:16px">Loading…</td></tr>'

  const db = window._sb
  if (!db) { tbody.innerHTML = '<tr><td colspan="8" style="color:var(--red-text);text-align:center;padding:16px">DB not ready</td></tr>'; return }

  try {
    const { data, error } = await db
      .from('vendors')
      .select('id, full_name, name, vendor_type, category_id, tax_treatment, entity, tags, match_patterns, email')
      .neq('vendor_type', 'merchant')
      .order('full_name')
    if (error) throw error
    vmVendors = data || []
    renderVMVendors()
  } catch (err) {
    console.error('[VendorManager]', err)
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--red-text);text-align:center;padding:16px">${err.message}</td></tr>`
  }
}

function renderVMVendors() {
  const tbody = document.getElementById('vm-vendors-tbody')
  if (!tbody) return

  if (!vmVendors.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--mu2);padding:16px">No vendors</td></tr>'
    return
  }

  tbody.innerHTML = vmVendors.map(v => {
    const catName  = catById(v.category_id)?.name || ''
    const catHtml  = catName
      ? `<span class="cl-cat-pill">${catName}</span>`
      : `<span class="cl-placeholder">Set…</span>`

    const taxKey   = v.tax_treatment || ''
    const taxClass = ['non_deductible','mixed_review'].includes(taxKey) ? taxKey : ''
    const taxHtml  = taxKey
      ? `<span class="cl-tax-badge ${taxClass}">${taxKey.replace(/_/g,' ')}</span>`
      : `<span class="cl-placeholder">—</span>`

    const ent      = v.entity || ''
    const bpHtml   = ent
      ? `<button class="cl-bp-pill ${ent}" onclick="toggleVMBP('${v.id}')">${ent === 'business' ? 'B' : 'P'}</button>`
      : `<button class="cl-bp-pill" onclick="toggleVMBP('${v.id}')">—</button>`

    const tags     = Array.isArray(v.tags) ? v.tags : []
    const tagsHtml = tags.length
      ? tags.map(t => `<span class="cl-tag">${t}</span>`).join('')
      : `<span class="cl-placeholder">+</span>`

    const aliases  = Array.isArray(v.match_patterns) ? v.match_patterns : []
    const aliasHtml = `<span class="cl-cat-pill" style="cursor:pointer" onclick="event.stopPropagation();toggleVMAliases('${v.id}')">${aliases.length} alias${aliases.length !== 1 ? 'es' : ''}</span>`

    return `<tr data-vmid="${v.id}" style="cursor:pointer" onclick="openVendorPanelFromManager(event,'${v.id}')">
      <td style="font-size:13px;font-weight:500">${v.full_name || v.name || '—'}${vendorTypeBadge(v.vendor_type)}</td>
      <td style="font-size:11px;color:var(--mu)">${vendorTypeLabel(v.vendor_type)}</td>
      <td class="cl-cell" onclick="openVMCatEditor(event,'${v.id}')">${catHtml}</td>
      <td class="cl-cell" onclick="openVMTaxEditor(event,'${v.id}')">${taxHtml}</td>
      <td class="cl-cell" style="white-space:nowrap">${bpHtml}</td>
      <td class="cl-cell" onclick="openVMTagEditor(event,'${v.id}')">${tagsHtml}</td>
      <td>
        <select class="vm-cadence-sel" data-vid="${v.id}" onchange="vmSaveCadence(this)" style="height:24px;font-size:11px;border:1px solid var(--border);border-radius:4px;padding:0 4px;background:var(--surface);color:var(--ink)">
          <option value="">—</option>
          <option value="recurring" ${v.payment_cadence==='recurring'?'selected':''}>Recurring</option>
          <option value="project_based" ${v.payment_cadence==='project_based'?'selected':''}>Project-based</option>
          <option value="one_time" ${v.payment_cadence==='one_time'?'selected':''}>One-time</option>
        </select>
      </td>
      <td>${aliasHtml}</td>
      <td><button class="btn btn-sm" onclick="saveVendorDefaults('${v.id}')">Save</button></td>
    </tr>
    <tr id="vm-aliases-${v.id}" style="display:none">
      <td colspan="9" class="vm-alias-list">${renderAliasEditor(v.id, aliases)}</td>
    </tr>`
  }).join('')
}

function openVendorPanelFromManager(evt, vendorId) {
  if (!vendorId) return
  if (evt?.target?.closest('button, select, input, textarea, a')) return
  if (evt?.target?.closest('.cl-cell')) return
  openVendorDetail(vendorId)
}
window.openVendorPanelFromManager = openVendorPanelFromManager

function renderAliasEditor(vendorId, aliases) {
  const rows = aliases.map((a, i) =>
    `<div class="vm-alias-row" data-aidx="${i}">
      <input class="vm-alias-input" value="${a}" data-vendorid="${vendorId}" data-idx="${i}">
      <button class="vm-alias-del" onclick="removeVMAlias('${vendorId}',${i})">×</button>
    </div>`
  ).join('')
  return `<div id="vm-alias-list-${vendorId}">${rows}</div>
    <button class="btn btn-sm" style="margin-top:6px" onclick="addVMAlias('${vendorId}')">+ Add alias</button>`
}

function toggleVMAliases(vendorId) {
  const row = document.getElementById('vm-aliases-' + vendorId)
  if (row) row.style.display = row.style.display === 'none' ? '' : 'none'
}
window.toggleVMAliases = toggleVMAliases

function addVMAlias(vendorId) {
  const v = vmVendors.find(x => x.id === vendorId)
  if (!v) return
  if (!Array.isArray(v.match_patterns)) v.match_patterns = []
  v.match_patterns.push('')
  const listEl = document.getElementById('vm-alias-list-' + vendorId)
  if (listEl) {
    const i = v.match_patterns.length - 1
    const div = document.createElement('div')
    div.className = 'vm-alias-row'
    div.innerHTML = `<input class="vm-alias-input" value="" data-vendorid="${vendorId}" data-idx="${i}">
      <button class="vm-alias-del" onclick="removeVMAlias('${vendorId}',${i})">×</button>`
    listEl.appendChild(div)
    div.querySelector('input').focus()
  }
}
window.addVMAlias = addVMAlias

function removeVMAlias(vendorId, idx) {
  const v = vmVendors.find(x => x.id === vendorId)
  if (!v || !Array.isArray(v.match_patterns)) return
  v.match_patterns.splice(idx, 1)
  const aliasRow = document.getElementById('vm-aliases-' + vendorId)
  if (aliasRow) aliasRow.querySelector('.vm-alias-list').innerHTML = renderAliasEditor(vendorId, v.match_patterns)
}
window.removeVMAlias = removeVMAlias

async function saveVendorDefaults(vendorId) {
  const v = vmVendors.find(x => x.id === vendorId)
  if (!v) return
  const db = window._sb
  if (!db) { showToast('DB not ready', 'warn'); return }

  // Collect match_patterns (aliases) from inputs
  const aliasInputs = document.querySelectorAll(`#vm-alias-list-${vendorId} .vm-alias-input`)
  const match_patterns = Array.from(aliasInputs).map(i => i.value.trim()).filter(Boolean)

  const fields = {
    category_id: v.category_id || null,
    tax_treatment: v.tax_treatment || null,
    entity: v.entity || null,
    tags: v.tags || [],
    match_patterns,
  }

  try {
    const { error } = await db.from('vendors').update(fields).eq('id', vendorId)
    if (error) throw error
    v.match_patterns = match_patterns
    showToast('Vendor saved')
  } catch (err) {
    console.error('[Vendor save]', err)
    showToast('Save failed: ' + err.message, 'warn')
  }
}
window.saveVendorDefaults = saveVendorDefaults

async function vmSaveCadence(sel) {
  const vid = sel.dataset.vid
  const db  = window._sb
  if (!db) { showToast('DB not ready', 'warn'); return }
  try {
    const { error } = await db.from('vendors').update({ payment_cadence: sel.value || null }).eq('id', vid)
    if (error) throw error
    const v = vmVendors.find(x => x.id === vid)
    if (v) v.payment_cadence = sel.value || null
    showToast('Saved', 'info')
  } catch (err) {
    showToast('Save failed: ' + err.message, 'warn')
  }
}
window.vmSaveCadence = vmSaveCadence

function toggleVMBP(vendorId) {
  const v = vmVendors.find(x => x.id === vendorId)
  if (!v) return
  v.entity = v.entity === 'business' ? 'private' : 'business'
  rerenderVMRow(vendorId)
}
window.toggleVMBP = toggleVMBP

function rerenderVMRow(vendorId) {
  // Re-render just the vendor row in place
  const v = vmVendors.find(x => x.id === vendorId)
  if (!v) return
  const tr = document.querySelector(`#vm-vendors-tbody tr[data-vmid="${vendorId}"]`)
  if (!tr) return
  const ent = v.entity || ''
  const bpTd = tr.querySelector('td:nth-child(5)')
  if (bpTd) bpTd.innerHTML = ent
    ? `<button class="cl-bp-pill ${ent}" onclick="toggleVMBP('${v.id}')">${ent === 'business' ? 'B' : 'P'}</button>`
    : `<button class="cl-bp-pill" onclick="toggleVMBP('${v.id}')">—</button>`

  const catName  = catById(v.category_id)?.name || ''
  const catTd = tr.querySelector('td:nth-child(3)')
  if (catTd) catTd.innerHTML = catName
    ? `<span class="cl-cat-pill">${catName}</span>`
    : `<span class="cl-placeholder">Set…</span>`

  const taxKey  = v.tax_treatment || ''
  const taxClass = ['non_deductible','mixed_review'].includes(taxKey) ? taxKey : ''
  const taxTd = tr.querySelector('td:nth-child(4)')
  if (taxTd) taxTd.innerHTML = taxKey
    ? `<span class="cl-tax-badge ${taxClass}">${taxKey.replace(/_/g,' ')}</span>`
    : `<span class="cl-placeholder">—</span>`

  const tags  = Array.isArray(v.tags) ? v.tags : []
  const tagTd = tr.querySelector('td:nth-child(6)')
  if (tagTd) tagTd.innerHTML = tags.length
    ? tags.map(t => `<span class="cl-tag">${t}</span>`).join('')
    : `<span class="cl-placeholder">+</span>`
}

// VM inline editors (same pattern, operate on vmVendors array)
function openVMCatEditor(evt, vendorId) {
  evt.stopPropagation()
  closeAllCellEditors()
  const td = evt.currentTarget
  const v  = vmVendors.find(x => x.id === vendorId)
  if (!v) return

  const dd   = document.createElement('div')
  dd.className = 'cl-dropdown'
  dd.style.minWidth = '220px'
  const inp  = document.createElement('input')
  inp.placeholder = 'Search category…'
  dd.appendChild(inp)
  const list = document.createElement('div')
  list.className = 'cl-dropdown-list'
  dd.appendChild(list)

  function renderList(q) {
    const filtered = CATEGORIES.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()))
    list.innerHTML = filtered.map(c =>
      `<div class="cl-dropdown-item${c.id === v.category_id ? ' sel' : ''}" data-id="${c.id}">${c.name}</div>`
    ).join('')
    list.querySelectorAll('.cl-dropdown-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault()
        v.category_id = item.dataset.id
        const cat = catById(item.dataset.id)
        if (cat?.tax && !v.tax_treatment) v.tax_treatment = cat.tax
        rerenderVMRow(vendorId)
        closeAllCellEditors()
      })
    })
  }
  inp.addEventListener('input', () => renderList(inp.value))
  inp.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllCellEditors()
  })
  renderList('')
  td.style.position = 'relative'
  td.appendChild(dd)
  _openEditor = { el: dd, txId: vendorId, type: 'vm-cat' }
  inp.focus()
}
window.openVMCatEditor = openVMCatEditor

function openVMTaxEditor(evt, vendorId) {
  evt.stopPropagation()
  closeAllCellEditors()
  const td = evt.currentTarget
  const v  = vmVendors.find(x => x.id === vendorId)
  if (!v) return

  const dd   = document.createElement('div')
  dd.className = 'cl-dropdown'
  dd.style.minWidth = '200px'
  const inp  = document.createElement('input')
  inp.placeholder = 'Search tax…'
  dd.appendChild(inp)
  const list = document.createElement('div')
  list.className = 'cl-dropdown-list'
  dd.appendChild(list)

  function renderList(q) {
    const filtered = TAX_TREATMENTS.filter(t => !q || t.includes(q.toLowerCase()))
    list.innerHTML = filtered.map(t =>
      `<div class="cl-dropdown-item${t === v.tax_treatment ? ' sel' : ''}" data-val="${t}">${t.replace(/_/g,' ')}</div>`
    ).join('')
    list.querySelectorAll('.cl-dropdown-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault()
        v.tax_treatment = item.dataset.val
        rerenderVMRow(vendorId)
        closeAllCellEditors()
      })
    })
  }
  inp.addEventListener('input', () => renderList(inp.value))
  inp.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllCellEditors() })
  renderList('')
  td.style.position = 'relative'
  td.appendChild(dd)
  _openEditor = { el: dd, txId: vendorId, type: 'vm-tax' }
  inp.focus()
}
window.openVMTaxEditor = openVMTaxEditor

function openVMTagEditor(evt, vendorId) {
  evt.stopPropagation()
  closeAllCellEditors()
  const td = evt.currentTarget
  const v  = vmVendors.find(x => x.id === vendorId)
  if (!v) return
  let currentTags = Array.isArray(v.tags) ? [...v.tags] : []

  const pop = document.createElement('div')
  pop.className = 'cl-tag-popover'

  function renderChips() {
    pop.innerHTML = ''
    const chipsDiv = document.createElement('div')
    chipsDiv.className = 'cl-tag-chips'
    currentTags.forEach(tag => {
      const chip = document.createElement('span')
      chip.className = 'cl-tag'
      chip.innerHTML = `${tag} <span class="cl-tag-x" data-tag="${tag}">×</span>`
      chip.querySelector('.cl-tag-x').addEventListener('mousedown', e => {
        e.preventDefault()
        currentTags = currentTags.filter(t => t !== tag)
        v.tags = currentTags
        renderChips()
      })
      chipsDiv.appendChild(chip)
    })
    pop.appendChild(chipsDiv)

    const inp = document.createElement('input')
    inp.className = 'cl-tag-input'
    inp.placeholder = 'Add tag…'
    pop.appendChild(inp)
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addTag(inp.value.trim()); inp.value = '' }
      if (e.key === 'Escape') { v.tags = currentTags; rerenderVMRow(vendorId); closeAllCellEditors() }
    })
    setTimeout(() => inp.focus(), 0)

    function addTag(tag) {
      if (tag && !currentTags.includes(tag)) { currentTags.push(tag); v.tags = currentTags; renderChips() }
    }
  }

  renderChips()
  td.style.position = 'relative'
  td.appendChild(pop)
  _openEditor = { el: pop, txId: vendorId, type: 'vm-tags', commit: () => { v.tags = currentTags; rerenderVMRow(vendorId); closeAllCellEditors() } }
}
window.openVMTagEditor = openVMTagEditor

// ── Unmatched Merchants ──

async function loadVMUnmatched() {
  const tbody = document.getElementById('vm-unmatched-tbody')
  if (!tbody) return
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--mu2);padding:16px">Loading…</td></tr>'

  const db = window._sb
  if (!db) { tbody.innerHTML = '<tr><td colspan="4" style="color:var(--red-text);text-align:center;padding:16px">DB not ready</td></tr>'; return }

  try {
    const { data, error } = await db
      .from('transactions')
      .select('counterparty_name, category')
      .is('deleted_at', null)
      .is('vendor_id', null)
      .not('counterparty_name', 'is', null)
    if (error) throw error

    // Group by merchant
    const map = {}
    ;(data || []).forEach(t => {
      const key = (t.counterparty_name || '').trim()
      if (!key) return
      if (!map[key]) map[key] = { name: key, rawCat: t.category, count: 0 }
      map[key].count++
    })
    const merchants = Object.values(map).sort((a, b) => b.count - a.count)

    if (!merchants.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--mu2);padding:16px">No unmatched merchants</td></tr>'
      return
    }

    // Build vendor options
    const vendorOpts = vmVendors.map(v =>
      `<option value="${v.id}">${v.full_name || v.name || v.id}</option>`
    ).join('')

    tbody.innerHTML = merchants.map(m => `<tr>
      <td style="font-size:13px">${m.name}</td>
      <td style="font-size:11px;color:var(--mu)">${m.rawCat || '—'}</td>
      <td style="font-family:var(--font-mono);font-size:12px;color:var(--mu)">${m.count}</td>
      <td>
        <select class="fi fsel" style="height:28px;font-size:11px;max-width:160px" onchange="assignMerchant(this,'${m.name.replace(/'/g,"\\'")}')">
          <option value="">Assign to vendor…</option>
          ${vendorOpts}
          <option value="__new__">+ Create new vendor</option>
        </select>
      </td>
    </tr>`).join('')
  } catch (err) {
    console.error('[UnmatchedMerchants]', err)
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--red-text);text-align:center;padding:16px">${err.message}</td></tr>`
  }
}

function extractKeyword(name) {
  return name
    .replace(/\b(Ltd|LLC|SL|SA|GmbH|Inc|BV|NV|SAS|SARL|OÜ|AB|AS)\b\.?/gi, '')
    .replace(/\s+/g, ' ').trim()
    .split(' ')[0]
}
window.extractKeyword = extractKeyword

async function assignMerchant(sel, merchantName) {
  const vendorId = sel.value
  if (!vendorId) return
  const db = window._sb
  if (!db) { showToast('DB not ready', 'warn'); return }

  if (vendorId === '__new__') {
    const newName = prompt('New vendor name:', merchantName)
    if (!newName) { sel.value = ''; return }
    try {
      const { data, error } = await db.from('vendors').insert({ name: newName, match_patterns: [merchantName], vendor_type: 'contractor' }).select('id').single()
      if (error) throw error
      await db.from('transactions').update({ vendor_id: data.id }).eq('counterparty_name', merchantName)
      showToast(`Vendor "${newName}" created and assigned`)
      await loadVendorManager()
    } catch (err) {
      showToast('Failed: ' + err.message, 'warn')
      sel.value = ''
    }
    return
  }

  try {
    const vendor = vmVendors.find(v => v.id === vendorId)
    const existingAliases = Array.isArray(vendor?.match_patterns) ? vendor.match_patterns : []

    // Step A: add exact merchant name as alias
    if (!existingAliases.includes(merchantName)) {
      await db.from('vendors').update({ match_patterns: [...existingAliases, merchantName] }).eq('id', vendorId)
      if (vendor) vendor.match_patterns = [...existingAliases, merchantName]
    }

    // Step B: build update fields from vendor defaults
    const updateFields = { vendor_id: vendorId }
    if (vendor?.category_id)   updateFields.category_id   = vendor.category_id
    if (vendor?.tax_treatment) updateFields.tax_treatment = vendor.tax_treatment
    if (vendor?.entity)        updateFields.entity        = vendor.entity
    if (Array.isArray(vendor?.tags) && vendor.tags.length) updateFields.tags = vendor.tags

    // Assign exact-name matches
    await db.from('transactions').update(updateFields).is('vendor_id', null).eq('counterparty_name', merchantName)

    // Step C: check for similar merchants via keyword pattern
    const keyword = extractKeyword(merchantName)
    if (keyword && keyword.length >= 3) {
      const pattern = `%${keyword}%`
      const { data: similar } = await db
        .from('transactions')
        .select('id', { count: 'exact' })
        .is('vendor_id', null)
        .ilike('counterparty_name', pattern)
        .neq('counterparty_name', merchantName)
        .limit(1)
      const similarCount = similar?.length || 0
      if (similarCount > 0) {
        // Get actual count
        const { count } = await db
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .is('vendor_id', null)
          .ilike('counterparty_name', pattern)
          .neq('counterparty_name', merchantName)
        if (count > 0) {
          showConfirm(
            `Found ${count} other transaction${count !== 1 ? 's' : ''} with a similar merchant name (matching "${keyword}"). Apply to all?`,
            async () => {
              await db.from('transactions').update(updateFields).is('vendor_id', null).ilike('counterparty_name', pattern)
              showToast(`Assigned "${merchantName}" + ${count} similar → ${vendor?.full_name || vendor?.name || vendorId}`)
              writeAuditLog({ entityType: 'transaction', entityId: merchantName, action: 'assign_vendor',
                meta: { vendor_id: vendorId, counterparty_name: merchantName, similar_count: count, keyword } })
              await loadVMUnmatched()
            },
            { confirmLabel: 'Apply to all', cancelLabel: 'Exact match only' }
          )
          // "Cancel" (exact-match only) path — fall through to the single-match toast below
        }
      }
    }

    showToast(`Assigned "${merchantName}" → ${vendor?.full_name || vendor?.name || vendorId}`)
    writeAuditLog({ entityType: 'transaction', entityId: merchantName, action: 'assign_vendor',
      meta: { vendor_id: vendorId, counterparty_name: merchantName } })
    await loadVMUnmatched()
  } catch (err) {
    showToast('Failed: ' + err.message, 'warn')
    sel.value = ''
  }
}
window.assignMerchant = assignMerchant

// ═══════════════════════════════════════════════════════════════
// MERCHANT RULES SECTION (Part 3)
// ═══════════════════════════════════════════════════════════════

let vmMerchants = []

async function loadVMMerchants() {
  const wrap = document.getElementById('vm-merchants-wrap')
  if (!wrap) return
  const tbody = document.getElementById('vm-merchants-tbody')
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--mu2);padding:16px">Loading…</td></tr>'

  const db = window._sb
  if (!db) return
  try {
    const { data, error } = await db
      .from('vendors')
      .select('id, name, category_id, tax_treatment, entity, match_patterns, is_active')
      .eq('vendor_type', 'merchant')
      .order('name')
    if (error) throw error
    vmMerchants = data || []
    renderVMMerchants()
  } catch (err) {
    console.error('[VMMerchants]', err)
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="color:var(--red-text);text-align:center;padding:16px">${err.message}</td></tr>`
  }
}

function renderVMMerchants() {
  const tbody = document.getElementById('vm-merchants-tbody')
  if (!tbody) return

  // Populate add-form category dropdown
  const addCatSel = document.getElementById('new-merchant-cat')
  if (addCatSel && addCatSel.options.length <= 1) {
    addCatSel.innerHTML = '<option value="">Category…</option>' +
      CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
  }

  if (!vmMerchants.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--mu2);padding:16px">No merchant rules yet</td></tr>'
    return
  }

  tbody.innerHTML = vmMerchants.map(m => {
    const catName  = catById(m.category_id)?.name || ''
    const catHtml  = catName
      ? `<span class="cl-cat-pill">${catName}</span>`
      : `<span class="cl-placeholder">Set…</span>`

    const taxKey   = m.tax_treatment || ''
    const taxClass = ['non_deductible','mixed_review'].includes(taxKey) ? taxKey : ''
    const taxHtml  = taxKey
      ? `<span class="cl-tax-badge ${taxClass}">${taxKey.replace(/_/g,' ')}</span>`
      : `<span class="cl-placeholder">—</span>`

    const ent      = m.entity || ''
    const bpHtml   = ent
      ? `<button class="cl-bp-pill ${ent}" onclick="toggleMerchantBP('${m.id}')">${ent === 'business' ? 'B' : 'P'}</button>`
      : `<button class="cl-bp-pill" onclick="toggleMerchantBP('${m.id}')">—</button>`

    const patterns = Array.isArray(m.match_patterns) ? m.match_patterns : []
    const patHtml  = patterns.length
      ? `<span class="merchant-pat-chips" style="cursor:pointer" onclick="openMerchantPatEditor('${m.id}')">${patterns.map(p => `<span class="cl-tag">${p}</span>`).join('')}</span>`
      : `<span class="cl-placeholder" style="cursor:pointer" onclick="openMerchantPatEditor('${m.id}')">+ add patterns</span>`

    return `<tr data-merchantid="${m.id}">
      <td style="font-size:13px;font-weight:500">${m.name || '—'}</td>
      <td class="cl-cell" onclick="openMerchantCatEditor(event,'${m.id}')">${catHtml}</td>
      <td class="cl-cell" onclick="openMerchantTaxEditor(event,'${m.id}')">${taxHtml}</td>
      <td class="cl-cell" style="white-space:nowrap">${bpHtml}</td>
      <td class="cl-cell">${patHtml}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm" onclick="saveMerchantRule('${m.id}')">Save</button>
        <button class="btn btn-sm" style="margin-left:4px;color:var(--red-text);border-color:var(--red)" onclick="deleteMerchantRule('${m.id}')">Delete</button>
      </td>
    </tr>`
  }).join('')
}

function toggleMerchantBP(merchantId) {
  const m = vmMerchants.find(x => x.id === merchantId)
  if (!m) return
  m.entity = m.entity === 'business' ? 'private' : 'business'
  rerenderMerchantRow(merchantId)
}
window.toggleMerchantBP = toggleMerchantBP

function rerenderMerchantRow(merchantId) {
  const m = vmMerchants.find(x => x.id === merchantId)
  if (!m) return
  const tr = document.querySelector(`#vm-merchants-tbody tr[data-merchantid="${merchantId}"]`)
  if (!tr) return

  const ent    = m.entity || ''
  const bpTd   = tr.querySelector('td:nth-child(4)')
  if (bpTd) bpTd.innerHTML = ent
    ? `<button class="cl-bp-pill ${ent}" onclick="toggleMerchantBP('${m.id}')">${ent === 'business' ? 'B' : 'P'}</button>`
    : `<button class="cl-bp-pill" onclick="toggleMerchantBP('${m.id}')">—</button>`

  const catName  = catById(m.category_id)?.name || ''
  const catTd    = tr.querySelector('td:nth-child(2)')
  if (catTd) catTd.innerHTML = catName
    ? `<span class="cl-cat-pill">${catName}</span>`
    : `<span class="cl-placeholder">Set…</span>`

  const taxKey   = m.tax_treatment || ''
  const taxClass = ['non_deductible','mixed_review'].includes(taxKey) ? taxKey : ''
  const taxTd    = tr.querySelector('td:nth-child(3)')
  if (taxTd) taxTd.innerHTML = taxKey
    ? `<span class="cl-tax-badge ${taxClass}">${taxKey.replace(/_/g,' ')}</span>`
    : `<span class="cl-placeholder">—</span>`
}

function openMerchantCatEditor(evt, merchantId) {
  evt.stopPropagation()
  closeAllCellEditors()
  const td = evt.currentTarget
  const m  = vmMerchants.find(x => x.id === merchantId)
  if (!m) return

  const dd   = document.createElement('div')
  dd.className = 'cl-dropdown'
  dd.style.minWidth = '220px'
  const inp  = document.createElement('input')
  inp.placeholder = 'Search category…'
  dd.appendChild(inp)
  const list = document.createElement('div')
  list.className = 'cl-dropdown-list'
  dd.appendChild(list)

  function renderList(q) {
    const filtered = CATEGORIES.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()))
    list.innerHTML = filtered.map(c =>
      `<div class="cl-dropdown-item${c.id === m.category_id ? ' sel' : ''}" data-id="${c.id}">${c.name}</div>`
    ).join('')
    list.querySelectorAll('.cl-dropdown-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault()
        m.category_id = item.dataset.id
        const cat = catById(item.dataset.id)
        if (cat?.tax && !m.tax_treatment) m.tax_treatment = cat.tax
        rerenderMerchantRow(merchantId)
        closeAllCellEditors()
      })
    })
  }
  inp.addEventListener('input', () => renderList(inp.value))
  inp.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllCellEditors() })
  renderList('')
  td.style.position = 'relative'
  td.appendChild(dd)
  _openEditor = { el: dd, txId: merchantId, type: 'merchant-cat' }
  inp.focus()
}
window.openMerchantCatEditor = openMerchantCatEditor

function openMerchantTaxEditor(evt, merchantId) {
  evt.stopPropagation()
  closeAllCellEditors()
  const td = evt.currentTarget
  const m  = vmMerchants.find(x => x.id === merchantId)
  if (!m) return

  const dd   = document.createElement('div')
  dd.className = 'cl-dropdown'
  dd.style.minWidth = '200px'
  const inp  = document.createElement('input')
  inp.placeholder = 'Search tax…'
  dd.appendChild(inp)
  const list = document.createElement('div')
  list.className = 'cl-dropdown-list'
  dd.appendChild(list)

  function renderList(q) {
    const filtered = TAX_TREATMENTS.filter(t => !q || t.includes(q.toLowerCase()))
    list.innerHTML = filtered.map(t =>
      `<div class="cl-dropdown-item${t === m.tax_treatment ? ' sel' : ''}" data-val="${t}">${t.replace(/_/g,' ')}</div>`
    ).join('')
    list.querySelectorAll('.cl-dropdown-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault()
        m.tax_treatment = item.dataset.val
        rerenderMerchantRow(merchantId)
        closeAllCellEditors()
      })
    })
  }
  inp.addEventListener('input', () => renderList(inp.value))
  inp.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllCellEditors() })
  renderList('')
  td.style.position = 'relative'
  td.appendChild(dd)
  _openEditor = { el: dd, txId: merchantId, type: 'merchant-tax' }
  inp.focus()
}
window.openMerchantTaxEditor = openMerchantTaxEditor

function openMerchantPatEditor(merchantId) {
  closeAllCellEditors()
  const m = vmMerchants.find(x => x.id === merchantId)
  if (!m) return

  const tr = document.querySelector(`#vm-merchants-tbody tr[data-merchantid="${merchantId}"]`)
  if (!tr) return
  const patTd = tr.querySelector('td:nth-child(5)')
  if (!patTd) return

  const patterns = Array.isArray(m.match_patterns) ? [...m.match_patterns] : []
  const ta = document.createElement('textarea')
  ta.className = 'merchant-pat-textarea'
  ta.value = patterns.join(', ')
  ta.placeholder = 'Comma-separated match patterns…'
  ta.rows = 3
  ta.style.cssText = 'width:100%;font-size:12px;font-family:var(--font-sans);padding:5px;border:1px solid var(--ink);border-radius:4px;resize:vertical;outline:none'
  ta.addEventListener('blur', () => {
    m.match_patterns = ta.value.split(',').map(s => s.trim()).filter(Boolean)
    renderVMMerchants()
  })
  ta.addEventListener('keydown', e => {
    if (e.key === 'Escape') { m.match_patterns = patterns; renderVMMerchants() }
  })
  patTd.innerHTML = ''
  patTd.appendChild(ta)
  ta.focus()
}
window.openMerchantPatEditor = openMerchantPatEditor

async function saveMerchantRule(merchantId) {
  const m = vmMerchants.find(x => x.id === merchantId)
  if (!m) return
  const db = window._sb
  if (!db) { showToast('DB not ready', 'warn'); return }
  try {
    const { error } = await db.from('vendors').update({
      name: m.name,
      category_id: m.category_id || null,
      tax_treatment: m.tax_treatment || null,
      entity: m.entity || null,
      match_patterns: m.match_patterns || [],
    }).eq('id', merchantId)
    if (error) throw error
    showToast('Merchant saved')
  } catch (err) {
    console.error('[MerchantSave]', err)
    showToast('Save failed: ' + err.message, 'warn')
  }
}
window.saveMerchantRule = saveMerchantRule

async function deleteMerchantRule(merchantId) {
  showConfirm('Delete this merchant rule?', async () => {
    const db = window._sb
    if (!db) { showToast('DB not ready', 'warn'); return }
    try {
      const { error } = await db.from('vendors').delete().eq('id', merchantId)
      if (error) throw error
      vmMerchants = vmMerchants.filter(m => m.id !== merchantId)
      renderVMMerchants()
      showToast('Merchant deleted')
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'warn')
    }
  })
}
window.deleteMerchantRule = deleteMerchantRule

async function addMerchantRule() {
  const nameInput = document.getElementById('new-merchant-name')
  const catSel    = document.getElementById('new-merchant-cat')
  const name = nameInput?.value.trim()
  if (!name) { showToast('Enter a name', 'info'); return }
  const db = window._sb
  if (!db) { showToast('DB not ready', 'warn'); return }
  const catId = catSel?.value || null
  const cat   = catId ? catById(catId) : null
  try {
    const { data, error } = await db.from('vendors').insert({
      name,
      vendor_type: 'merchant',
      category_id: catId,
      tax_treatment: cat?.tax || null,
      match_patterns: [name],
      is_active: true,
    }).select('id, name, category_id, tax_treatment, entity, match_patterns, is_active').single()
    if (error) throw error
    vmMerchants.push(data)
    renderVMMerchants()
    if (nameInput) nameInput.value = ''
    if (catSel) catSel.value = ''
    showToast('Merchant rule added')
  } catch (err) {
    console.error('[AddMerchant]', err)
    showToast('Failed: ' + err.message, 'warn')
  }
}
window.addMerchantRule = addMerchantRule

// ═══════════════════════════════════════════════════════════════
function updateTxMetrics() {
  const now   = new Date()
  const mo    = now.getMonth()
  const yr    = now.getFullYear()
  const month = txAllRows.filter(tx => {
    const d = new Date(tx.transaction_date)
    return d.getMonth() === mo && d.getFullYear() === yr
  })
  const income   = month.filter(tx => tx.direction === 'in').reduce((s, tx) => s + (tx.amount || 0), 0)
  const expenses = month.filter(tx => tx.direction === 'out').reduce((s, tx) => s + Math.abs(tx.amount || 0), 0)
  const net      = income - expenses
  const unmatched = txAllRows.filter(tx => tx.status === 'unmatched').length

  const el = id => document.getElementById(id)
  if (el('tx-metric-income'))   el('tx-metric-income').textContent   = fmt(income)
  if (el('tx-metric-expenses')) el('tx-metric-expenses').textContent = fmt(expenses)
  if (el('tx-metric-net')) {
    el('tx-metric-net').textContent = (net >= 0 ? '+' : '') + fmt(net)
    el('tx-metric-net').style.color = net >= 0 ? 'var(--green-text)' : 'var(--red-text)'
  }
  if (el('tx-metric-review'))   el('tx-metric-review').textContent   = unmatched
}

function updateAlertBarTx() {
  const now = new Date()
  const mo  = now.getMonth()
  const yr  = now.getFullYear()

  const total        = txAllRows.length
  const unclassified = txAllRows.filter(tx => !tx.category_id).length
  const outMonth     = txAllRows.filter(tx => {
    const d = new Date(tx.transaction_date)
    return tx.direction === 'out' && d.getMonth() === mo && d.getFullYear() === yr
  }).reduce((s, tx) => s + Math.abs(tx.amount || 0), 0)

  const elTotal  = document.getElementById('alert-tx-total')
  const elUnclass = document.getElementById('alert-tx-unclassified')
  const elOut    = document.getElementById('alert-tx-out-month')
  if (elTotal)   elTotal.textContent   = total || '—'
  if (elUnclass) elUnclass.textContent = unclassified || '—'
  if (elOut)     elOut.textContent     = outMonth ? fmt(outMonth) : '—'
}

// ═══════════════════════════════════════════════════════════════
// VENDOR QUICK PANEL
// ═══════════════════════════════════════════════════════════════

let _vqpPanel = null
let _vqpState = { catId: '', tax: '', entity: '', tags: [], vendorId: null, txId: null }

function closeVendorQuickPanel() {
  if (_vqpPanel) { _vqpPanel.remove(); _vqpPanel = null }
}
window.closeVendorQuickPanel = closeVendorQuickPanel

function _vqpEditorFields() {
  return `
    <div class="vqp-field">
      <label>Category</label>
      <div id="vqp-cat-wrap" style="position:relative">
        <span id="vqp-cat-val" style="cursor:pointer;display:inline-block" onclick="vqpOpenCat()">
          <span class="cl-placeholder">Select…</span>
        </span>
      </div>
    </div>
    <div class="vqp-field">
      <label>Tax</label>
      <div id="vqp-tax-wrap" style="position:relative">
        <span id="vqp-tax-val" style="cursor:pointer;display:inline-block" onclick="vqpOpenTax()">
          <span class="cl-placeholder">Select…</span>
        </span>
      </div>
    </div>
    <div class="vqp-field">
      <label>B/P</label>
      <button class="cl-bp-pill" id="vqp-bp-btn" onclick="vqpToggleBP()">—</button>
    </div>
    <div class="vqp-field">
      <label>Vendor Type</label>
      <select id="vqp-type-sel" class="fi" style="height:26px;font-size:12px">
        <option value="">—</option>
        <option value="coach">Coach</option>
        <option value="contractor">Contractor</option>
        <option value="team_member">Team Member</option>
        <option value="merchant">Merchant</option>
      </select>
    </div>
    <div class="vqp-field">
      <label>Purchase type</label>
      <select id="vqp-cadence-sel" class="fi" style="height:26px;font-size:12px">
        <option value="">—</option>
        <option value="recurring">Recurring</option>
        <option value="project_based">Project-based</option>
        <option value="one_time">One-time</option>
      </select>
    </div>`
}

function openVendorQuickPanel(evtOrNull, txId, anchorEl) {
  if (evtOrNull) evtOrNull.stopPropagation()
  closeVendorQuickPanel()

  const tx = txAllRows.find(t => t.id === txId)
  if (!tx) return

  const knownVendor = tx.vendor_id ? vmVendors.find(v => v.id === tx.vendor_id) : null

  // Reset module-level state
  _vqpState = {
    catId:    knownVendor?.category_id   || tx.category_id   || '',
    tax:      knownVendor?.tax_treatment || tx.tax_treatment || '',
    entity:   knownVendor?.entity        || tx.entity        || '',
    tags:     Array.isArray(knownVendor?.tags) ? [...knownVendor.tags] : [],
    vendorId: tx.vendor_id || null,
    txId,
  }

  const panel = document.createElement('div')
  panel.className = 'vendor-quick-panel'
  _vqpPanel = panel

  if (knownVendor) {
    const vn = knownVendor.full_name || knownVendor.name || '—'
    panel.innerHTML = `
      <button class="vqp-close" onclick="closeVendorQuickPanel()">×</button>
      <div class="vqp-header">
        <div class="vqp-name">${vn}</div>
        ${vendorTypeBadge(knownVendor.vendor_type)}
      </div>
      ${_vqpEditorFields()}
      <div class="vqp-actions">
        <button class="btn btn-sm btn-primary" onclick="vqpSaveVendor('${knownVendor.id}','${txId}')">Save + Apply to this transaction</button>
        <button class="btn btn-sm" onclick="vqpOpenSidebar('${knownVendor.id}')">More ›</button>
      </div>
      <div class="vqp-note">Saving updates this vendor's defaults and applies classification to all future matches.</div>`

    // Pre-select current values
    const typeSel    = panel.querySelector('#vqp-type-sel')
    const cadenceSel = panel.querySelector('#vqp-cadence-sel')
    if (typeSel)    typeSel.value    = knownVendor.vendor_type   || ''
    if (cadenceSel) cadenceSel.value = knownVendor.payment_cadence || tx.payment_cadence || ''
  } else {
    // State B: unknown vendor
    const cpName = tx.counterparty_name || ''
    panel.innerHTML = `
      <button class="vqp-close" onclick="closeVendorQuickPanel()">×</button>
      <div class="vqp-header">
        <div class="vqp-name">New vendor</div>
      </div>
      <div class="vqp-field">
        <label>Name</label>
        <input id="vqp-new-name" class="fi" style="height:26px;font-size:12px" value="${cpName.replace(/"/g,'&quot;')}">
      </div>
      ${_vqpEditorFields()}
      <div class="vqp-actions">
        <button class="btn btn-sm btn-primary" onclick="vqpSaveNewVendor('${txId}')">Save as New Vendor</button>
        <button class="btn btn-sm" onclick="vqpShowMergeSearch('${txId}')">Add to Existing</button>
      </div>
      <div id="vqp-merge-search" style="display:none;margin-top:10px;border-top:1px solid var(--border2);padding-top:10px">
        <div style="font-size:11px;color:var(--mu);margin-bottom:6px">Search for an existing vendor:</div>
        <input id="vqp-merge-input" class="fi" placeholder="Type vendor name…"
          style="height:28px;font-size:12px;width:100%;margin-bottom:6px"
          oninput="vqpFilterMergeResults('${txId}')">
        <div id="vqp-merge-results" style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;background:var(--surface)"></div>
      </div>`
  }

  // Position near anchor
  document.body.appendChild(panel)
  if (anchorEl) {
    const rect   = anchorEl.getBoundingClientRect()
    const panelW = 300
    let left = rect.left
    if (left + panelW > window.innerWidth - 16) left = window.innerWidth - panelW - 16
    panel.style.left = left + 'px'
    panel.style.top  = Math.min(rect.bottom + 4, window.innerHeight - 360) + 'px'
  } else {
    panel.style.left = '50%'
    panel.style.top  = '200px'
    panel.style.transform = 'translateX(-50%)'
  }

  _vqpRefreshUI()
}
window.openVendorQuickPanel = openVendorQuickPanel

// VQP inline pickers (operate on module-level _vqpState)
function vqpOpenCat() {
  if (!_vqpPanel) return
  const anchor = document.getElementById('vqp-cat-wrap')
  if (!anchor) return
  const dd   = document.createElement('div'); dd.className = 'cl-dropdown'; dd.style.cssText = 'position:absolute;top:100%;left:0;min-width:200px;z-index:500'
  const inp  = document.createElement('input'); inp.placeholder = 'Search…'
  const list = document.createElement('div'); list.className = 'cl-dropdown-list'
  dd.append(inp, list)
  function renderList(q) {
    list.innerHTML = CATEGORIES.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase())).map(c =>
      `<div class="cl-dropdown-item${c.id === _vqpState.catId ? ' sel' : ''}" data-id="${c.id}">${c.name}</div>`
    ).join('')
    list.querySelectorAll('.cl-dropdown-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault()
        _vqpState.catId = item.dataset.id
        const cat = catById(item.dataset.id)
        if (cat?.tax && !_vqpState.tax) _vqpState.tax = cat.tax
        dd.remove()
        _vqpRefreshUI()
      })
    })
  }
  inp.addEventListener('input', () => renderList(inp.value))
  inp.addEventListener('keydown', e => { if (e.key === 'Escape') dd.remove() })
  renderList('')
  anchor.appendChild(dd)
  inp.focus()
}
window.vqpOpenCat = vqpOpenCat

function vqpOpenTax() {
  if (!_vqpPanel) return
  const anchor = document.getElementById('vqp-tax-wrap')
  if (!anchor) return
  const dd   = document.createElement('div'); dd.className = 'cl-dropdown'; dd.style.cssText = 'position:absolute;top:100%;left:0;min-width:180px;z-index:500'
  const inp  = document.createElement('input'); inp.placeholder = 'Search…'
  const list = document.createElement('div'); list.className = 'cl-dropdown-list'
  dd.append(inp, list)
  function renderList(q) {
    list.innerHTML = TAX_TREATMENTS.filter(t => !q || t.includes(q.toLowerCase())).map(t =>
      `<div class="cl-dropdown-item${t === _vqpState.tax ? ' sel' : ''}" data-val="${t}">${t.replace(/_/g,' ')}</div>`
    ).join('')
    list.querySelectorAll('.cl-dropdown-item').forEach(item => {
      item.addEventListener('mousedown', e => { e.preventDefault(); _vqpState.tax = item.dataset.val; dd.remove(); _vqpRefreshUI() })
    })
  }
  inp.addEventListener('input', () => renderList(inp.value))
  inp.addEventListener('keydown', e => { if (e.key === 'Escape') dd.remove() })
  renderList('')
  anchor.appendChild(dd)
  inp.focus()
}
window.vqpOpenTax = vqpOpenTax

function vqpToggleBP() {
  _vqpState.entity = _vqpState.entity === 'business' ? 'private' : _vqpState.entity === 'private' ? '' : 'business'
  _vqpRefreshUI()
}
window.vqpToggleBP = vqpToggleBP

function _vqpRefreshUI() {
  const s    = _vqpState
  const catN = catById(s.catId)?.name || ''
  const catV = document.getElementById('vqp-cat-val')
  const taxV = document.getElementById('vqp-tax-val')
  const bpB  = document.getElementById('vqp-bp-btn')
  if (catV) catV.innerHTML = catN ? `<span class="cl-cat-pill">${catN}</span>` : '<span class="cl-placeholder">Select…</span>'
  if (taxV) taxV.innerHTML = s.tax ? `<span class="cl-tax-badge">${s.tax.replace(/_/g,' ')}</span>` : '<span class="cl-placeholder">Select…</span>'
  if (bpB)  { bpB.className = 'cl-bp-pill ' + (s.entity || ''); bpB.textContent = s.entity === 'business' ? 'B' : s.entity === 'private' ? 'P' : '—' }
}

async function vqpSaveVendor(vendorId, txId) {
  const db = window._sb
  if (!db) { showToast('DB not ready', 'warn'); return }

  const fields = {
    category_id:     _vqpState.catId || null,
    tax_treatment:   _vqpState.tax   || null,
    entity:          _vqpState.entity || null,
    tags:            _vqpState.tags  || [],
    vendor_type:     document.getElementById('vqp-type-sel')?.value    || null,
    payment_cadence: document.getElementById('vqp-cadence-sel')?.value || null,
  }

  try {
    // 1. Save vendor defaults
    const { error: ve } = await db.from('vendors').update(fields).eq('id', vendorId)
    if (ve) throw ve

    // 2. Apply classification to current transaction
    const txFields = {
      category_id:     fields.category_id,
      tax_treatment:   fields.tax_treatment,
      entity:          fields.entity,
      tags:            fields.tags,
      payment_cadence: fields.payment_cadence,
      vendor_id:       vendorId,
    }
    const { error: te } = await db.from('transactions').update(txFields).eq('id', txId)
    if (te) throw te

    // Update in-memory
    const vendor = vmVendors.find(v => v.id === vendorId)
    if (vendor) Object.assign(vendor, fields)
    const txRow = txAllRows.find(t => t.id === txId)
    if (txRow) Object.assign(txRow, txFields)

    writeAuditLog({ entityType: 'transaction', entityId: txId, action: 'vqp_save_vendor',
      meta: { vendor_id: vendorId, fields: Object.keys(fields) } })

    showToast('Vendor saved + classification applied', 'info')
    closeVendorQuickPanel()
    rerenderTxRow(txId)
    updateTxMetrics()
  } catch (err) {
    showToast('Save failed: ' + err.message, 'warn')
  }
}
window.vqpSaveVendor = vqpSaveVendor

async function vqpSaveNewVendor(txId) {
  const db = window._sb
  if (!db) { showToast('DB not ready', 'warn'); return }

  const nameInput = document.getElementById('vqp-new-name')
  const cpName    = nameInput?.value?.trim() || txAllRows.find(t => t.id === txId)?.counterparty_name || ''
  if (!cpName) { showToast('Vendor name required', 'warn'); return }

  const vendorType = document.getElementById('vqp-type-sel')?.value || 'merchant'
  const cadence    = document.getElementById('vqp-cadence-sel')?.value || null

  try {
    const { data: newV, error } = await db.from('vendors').insert({
      name:            cpName,
      vendor_type:     vendorType,
      category_id:     _vqpState.catId   || null,
      tax_treatment:   _vqpState.tax     || null,
      entity:          _vqpState.entity  || null,
      tags:            _vqpState.tags    || [],
      payment_cadence: cadence,
      match_patterns:  [cpName],
      is_active:       true,
    }).select('id, full_name, name, vendor_type, category_id, tax_treatment, entity, tags, match_patterns, payment_cadence').single()
    if (error) throw error

    vmVendors.push(newV)

    const txFields = {
      vendor_id:       newV.id,
      category_id:     _vqpState.catId   || null,
      tax_treatment:   _vqpState.tax     || null,
      entity:          _vqpState.entity  || null,
      tags:            _vqpState.tags    || [],
      payment_cadence: cadence,
    }
    const { error: te } = await db.from('transactions').update(txFields).eq('id', txId)
    if (te) throw te

    const txRow = txAllRows.find(t => t.id === txId)
    if (txRow) Object.assign(txRow, txFields)

    writeAuditLog({ entityType: 'transaction', entityId: txId, action: 'vqp_new_vendor',
      meta: { vendor_id: newV.id, vendor_name: cpName } })

    showToast('Vendor saved & transaction classified', 'info')
    closeVendorQuickPanel()
    rerenderTxRow(txId)
    updateTxMetrics()
  } catch (err) {
    showToast('Failed: ' + err.message, 'warn')
  }
}
window.vqpSaveNewVendor = vqpSaveNewVendor

function vqpShowMergeSearch(txId) {
  const wrap = document.getElementById('vqp-merge-search')
  if (!wrap) return
  wrap.style.display = 'block'
  document.getElementById('vqp-merge-input')?.focus()
  vqpFilterMergeResults(txId)
}
window.vqpShowMergeSearch = vqpShowMergeSearch

function vqpFilterMergeResults(txId) {
  const input = document.getElementById('vqp-merge-input')
  const results = document.getElementById('vqp-merge-results')
  if (!input || !results) return

  const q = input.value.trim().toLowerCase()
  const matches = vmVendors
    .filter(v => v.vendor_type !== 'merchant')
    .filter(v => !q || (v.full_name || v.name || '').toLowerCase().includes(q))
    .slice(0, 20)

  if (!matches.length) {
    results.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--mu2)">No vendors found</div>'
    return
  }

  results.innerHTML = matches.map(v => {
    const name = v.full_name || v.name || '—'
    const typeBadge = vendorTypeBadge(v.vendor_type)
    return `<div class="vqp-merge-item" onclick="vqpMergeConfirm('${v.id}','${txId}')" data-vid="${v.id}">
      <span style="font-size:12px;font-weight:500">${name}</span>${typeBadge}
    </div>`
  }).join('')
}
window.vqpFilterMergeResults = vqpFilterMergeResults

async function vqpMergeConfirm(vendorId, txId) {
  const vendor = vmVendors.find(v => v.id === vendorId)
  if (!vendor) return
  const db = window._sb
  if (!db) { showToast('DB not ready', 'warn'); return }

  const vn = vendor.full_name || vendor.name || '—'
  const cpName = txAllRows.find(t => t.id === txId)?.counterparty_name || ''

  try {
    // Add counterparty as a match pattern on the existing vendor
    const existingPatterns = Array.isArray(vendor.match_patterns) ? vendor.match_patterns : []
    const newPatterns = cpName && !existingPatterns.some(p => p.toLowerCase() === cpName.toLowerCase())
      ? [...existingPatterns, cpName]
      : existingPatterns

    const txFields = {
      vendor_id:       vendorId,
      category_id:     vendor.category_id    || _vqpState.catId   || null,
      tax_treatment:   vendor.tax_treatment  || _vqpState.tax     || null,
      entity:          vendor.entity         || _vqpState.entity  || null,
    }

    const { error: te } = await db.from('transactions').update(txFields).eq('id', txId)
    if (te) throw te

    if (cpName && newPatterns.length !== existingPatterns.length) {
      await db.from('vendors').update({ match_patterns: newPatterns }).eq('id', vendorId)
      if (vendor) vendor.match_patterns = newPatterns
    }

    const txRow = txAllRows.find(t => t.id === txId)
    if (txRow) Object.assign(txRow, txFields)

    writeAuditLog({ entityType: 'transaction', entityId: txId, action: 'vqp_merge_vendor',
      meta: { vendor_id: vendorId, vendor_name: vn } })

    showToast(`Merged into ${vn}`, 'info')
    closeVendorQuickPanel()
    rerenderTxRow(txId)
    updateTxMetrics()
  } catch (err) {
    showToast('Failed: ' + err.message, 'warn')
  }
}
window.vqpMergeConfirm = vqpMergeConfirm

function vqpOpenSidebar(vendorId) {
  closeVendorQuickPanel()
  switchTab('vendors')
  // Scroll to vendor row if visible
  setTimeout(() => {
    const row = document.querySelector(`#vm-vendors-tbody tr[data-vmid="${vendorId}"]`)
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 300)
}
window.vqpOpenSidebar = vqpOpenSidebar

// Apply vendor classification rules to all unclassified txns with same counterparty_name
async function vqpApplyVendorRules(vendorId) {
  const vendor = vmVendors.find(v => v.id === vendorId)
  if (!vendor) return
  const db = window._sb
  if (!db) return
  const patterns = Array.isArray(vendor.match_patterns) ? vendor.match_patterns : [vendor.name || '']
  const fields = {}
  if (vendor.category_id)   fields.category_id   = vendor.category_id
  if (vendor.tax_treatment) fields.tax_treatment = vendor.tax_treatment
  if (vendor.entity)        fields.entity        = vendor.entity
  if (!Object.keys(fields).length) { showToast('Vendor has no defaults set', 'info'); return }

  const toUpdate = txAllRows.filter(tx => !tx.category_id && tx.counterparty_name &&
    patterns.some(p => tx.counterparty_name.toLowerCase() === p.toLowerCase() ||
      tx.counterparty_name.toLowerCase().includes(p.toLowerCase())))

  if (!toUpdate.length) { showToast('No unclassified matches', 'info'); return }

  try {
    const ids = toUpdate.map(t => t.id)
    await db.from('transactions').update({ ...fields, vendor_id: vendorId }).in('id', ids)
    ids.forEach(id => { const r = txAllRows.find(t => t.id === id); if (r) Object.assign(r, fields, { vendor_id: vendorId }) })
    renderTransactions()
    updateTxMetrics()
    showToast(`Applied to ${ids.length} transaction(s)`)
  } catch (err) {
    showToast('Failed: ' + err.message, 'warn')
  }
}
window.vqpApplyVendorRules = vqpApplyVendorRules

// ═══════════════════════════════════════════════════════════════
// DUPLICATE DETECTION  (Part 2)
// ═══════════════════════════════════════════════════════════════

function _runDedupScan() {
  // Clear previous flags
  txAllRows.forEach(t => { t._isDuplicate = false; t._dupeGroup = [] })

  // Group by: transaction_date + |amount| + currency + account_id
  const groups = {}
  txAllRows.forEach(tx => {
    if (tx.deleted_at) return
    const key = [
      tx.transaction_date || '',
      Math.abs(tx.amount || 0).toFixed(2),
      tx.currency || '',
      tx.account_id || '',
    ].join('|')
    if (!groups[key]) groups[key] = []
    groups[key].push(tx.id)
  })

  Object.values(groups).forEach(ids => {
    if (ids.length < 2) return
    ids.forEach(id => {
      const tx = txAllRows.find(t => t.id === id)
      if (tx) { tx._isDuplicate = true; tx._dupeGroup = ids }
    })
  })
}

// Part 4C: Show deleted toggle
function toggleShowDeleted() {
  txShowDeleted = !txShowDeleted
  document.getElementById('txf-deleted-btn')?.classList.toggle('on', txShowDeleted)
  loadTransactions()
}
window.toggleShowDeleted = toggleShowDeleted

// Part 2D: Bulk mark as duplicate
async function bulkMarkDuplicate() {
  const ids = Array.from(txSelectedIds)
  if (ids.length < 2) { showToast('Select at least 2 transactions', 'info'); return }
  const db = window._sb
  if (!db) return

  // Find the oldest row (smallest transaction_date)
  const selected = ids.map(id => txAllRows.find(t => t.id === id)).filter(Boolean)
  selected.sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date))
  const oldest  = selected[0]
  const others  = selected.slice(1)

  try {
    for (const tx of others) {
      await db.from('transactions').update({ duplicate_of: oldest.id }).eq('id', tx.id)
      const row = txAllRows.find(t => t.id === tx.id)
      if (row) row.duplicate_of = oldest.id
      writeAuditLog({ entityType: 'transaction', entityId: tx.id, action: 'mark_duplicate',
        meta: { duplicate_of: oldest.id } })
    }
    showToast(`Marked ${others.length} transaction(s) as duplicate of ${oldest.counterparty_name || oldest.id}`)
    clearTxSelection()
    _runDedupScan()
    renderTransactions()
  } catch (err) {
    showToast('Failed: ' + err.message, 'warn')
  }
}
window.bulkMarkDuplicate = bulkMarkDuplicate

// ═══════════════════════════════════════════════════════════════
// TRANSACTION DRAWER  (Part 1)
// ═══════════════════════════════════════════════════════════════

let _txDrawerOpenId = null

function openTxDrawer(txId) {
  if (!txId) return
  if (window.Router && !_routerDispatching) {
    Router.open({ entity: 'transaction', id: txId, view: 'panel', from: 'transactions' })
    return
  }
  _txDrawerOpenId = txId
  if (window.PanelManager?.open) {
    window.PanelManager.open('transaction', txId)
    return
  }
  renderTxDrawer(txId)
}
window.openTxDrawer = openTxDrawer

function closeTxDrawer() {
  _txDrawerOpenId = null
  if (window.Router && Router.getParams().entity === 'transaction') {
    Router.close()
  }
}
window.closeTxDrawer = closeTxDrawer

async function renderTxDrawer(txId) {
  const content = document.getElementById('tx-drawer-content')
  if (!content) return
  content.innerHTML = '<div style="color:var(--mu2);font-size:12px;padding:20px 0">Loading…</div>'

  const tx = txAllRows.find(t => t.id === txId)
  if (!tx) { content.innerHTML = '<div style="color:var(--red-text)">Transaction not found</div>'; return }

  const db = window._sb
  let importRecord = null
  let dupeRows = []
  let auditRows = []

  if (db) {
    try {
      const [importRes, dupeRes, auditRes] = await Promise.all([
        tx.import_id
          ? db.from('transaction_imports').select('*').eq('id', tx.import_id).maybeSingle()
          : Promise.resolve({ data: null }),
        db.from('transactions')
          .select('id, transaction_date, amount, counterparty_name, account_id, account:accounts(id, name, provider, company_id)')
          .or(`duplicate_of.eq.${txId},id.eq.${tx.duplicate_of || '00000000-0000-0000-0000-000000000000'}`)
          .is('deleted_at', null)
          .neq('id', txId)
          .limit(5),
        db.from('audit_log')
          .select('*')
          .eq('entity_type', 'transaction')
          .eq('entity_id', txId)
          .order('created_at', { ascending: false })
          .limit(20),
      ])
      importRecord = importRes.data
      dupeRows     = (dupeRes.data || []).filter(r => r.id !== txId)
      auditRows    = auditRes.data || []
    } catch (err) {
      console.warn('[TxDrawer] fetch error:', err.message)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────
  const isIn      = tx.direction === 'in'
  const amtStr    = (tx.currency !== 'USD' ? tx.currency + ' ' : '$') + Math.abs(tx.amount || 0).toFixed(2)
  const dotColor  = tx.status === 'reconciled' ? 'var(--green)' : tx.status === 'matched' ? 'var(--blue)' : 'var(--amber)'
  const hasDupe   = tx._isDuplicate || tx.duplicate_of || dupeRows.length > 0
  const isDeleted = !!tx.deleted_at
  const vendor     = tx.vendor_id ? vmVendors.find(v => v.id === tx.vendor_id) : null
  const vendorName = vendor ? (vendor.full_name || vendor.name) : null
  const incomeClient = txIncomeClient(tx)
  const incomeClientName = incomeClient?.full_name || null

  // ── Build current classification state ──────────────────────
  let drawerCatId  = tx.category_id   || ''
  let drawerTax    = tx.tax_treatment  || ''
  let drawerEntity = tx.entity         || ''
  let drawerTags   = Array.isArray(tx.tags) ? [...tx.tags] : []

  const catName  = catById(drawerCatId)?.name || ''
  const taxClass = ['non_deductible','mixed_review'].includes(drawerTax) ? drawerTax : ''

  let matchHtml = ''
  if (isIn) {
    if (incomeClientName) {
      matchHtml = `
      <div class="txd-vendor-chip">
        <span style="color:var(--mu2);font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.08em">Client</span>
        <button class="tx-vendor-known" style="background:none;border:none;padding:0;cursor:pointer" onclick="event.stopPropagation();openClientPanel('${incomeClient.id}')">${incomeClientName}</button>
      </div>`
    } else {
      matchHtml = `
      <div class="txd-vendor-chip txd-vendor-unmatched">
        <span style="color:var(--mu2);font-size:11px">No client matched</span>
        <button class="btn btn-sm" style="margin-left:8px;height:22px;font-size:11px" onclick="txdOpenClientAssign('${txId}')">Assign client</button>
      </div>
      <div id="tx-drawer-client-assign"></div>`
    }
  } else if (vendorName) {
    matchHtml = `
    <div class="txd-vendor-chip">
      <span style="color:var(--mu2);font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.08em">Vendor</span>
      <button class="tx-vendor-known" style="background:none;border:none;padding:0;cursor:pointer" onclick="event.stopPropagation();openVendorDetail('${vendor.id}')">${vendorName}</button>
      ${vendorTypeBadge(vendor.vendor_type)}
      <button class="btn btn-sm" style="height:22px;font-size:11px" onclick="txdOpenVendorAssign('${txId}')">Reassign</button>
    </div>`
  } else {
    matchHtml = `
    <div class="txd-vendor-chip txd-vendor-unmatched">
      <span style="color:var(--mu2);font-size:11px">No vendor matched</span>
      <button class="btn btn-sm" style="margin-left:8px;height:22px;font-size:11px" onclick="txdOpenVendorAssign('${txId}')">Assign vendor</button>
      <span style="font-size:10px;color:var(--mu2)">reassign available later</span>
    </div>`
  }

  // ── 1. SUMMARY CARD ─────────────────────────────────────────
  let html = `
  <div class="txd-summary-card">
    <div class="txd-summary-top">
      <div class="txd-summary-name">${tx.counterparty_name || tx.event_type || '—'}</div>
    </div>
    <div class="txd-summary-amount-row">
      <span class="txd-summary-amount ${isIn ? 'in' : 'out'}">${isIn ? '+' : '−'}${amtStr}</span>
      <span class="tx-direction-badge ${isIn ? 'in' : 'out'}">${isIn ? 'IN' : 'OUT'}</span>
    </div>
    <div class="txd-summary-meta">
      <span class="txd-summary-dot" style="background:${dotColor}"></span>
      <span>${tx.status || '—'}</span>
      <span class="txd-summary-sep">·</span>
      <span>${tx.transaction_date || '—'}</span>
      <span class="txd-summary-sep">·</span>
      <span>${txAccountName(tx)}</span>
    </div>
    ${matchHtml}
  </div>`

  // ── 2. CLASSIFICATION CARD ───────────────────────────────────
  html += `
  <div class="txd-card" id="tx-drawer-cl-section">
    <div class="txd-card-header">Classification</div>
    <div class="txd-cl-grid">
      <div class="txd-cl-cell" onclick="txdOpenCatPicker('${txId}')">
        <div class="txd-cl-label">Category</div>
        <div id="txd-cat-val" class="txd-cl-value">
          ${catName ? `<span class="cl-cat-pill">${catName}</span>` : '<span class="cl-placeholder">Set…</span>'}
        </div>
      </div>
      <div class="txd-cl-cell" onclick="txdOpenTaxPicker('${txId}')">
        <div class="txd-cl-label">Tax</div>
        <div id="txd-tax-val" class="txd-cl-value">
          ${drawerTax ? `<span class="cl-tax-badge ${taxClass}">${drawerTax.replace(/_/g,' ')}</span>` : '<span class="cl-placeholder">—</span>'}
        </div>
      </div>
      <div class="txd-cl-cell">
        <div class="txd-cl-label">B/P</div>
        <div class="txd-cl-value">
          <button class="cl-bp-pill ${drawerEntity}" id="txd-bp-btn" onclick="txdToggleBP('${txId}')">
            ${drawerEntity === 'business' ? 'Business' : drawerEntity === 'private' ? 'Private' : '—'}
          </button>
        </div>
      </div>
    </div>
    <div class="txd-cl-tags-row" onclick="txdOpenTagPicker('${txId}')">
      <div class="txd-cl-label" style="margin-bottom:4px">Tags</div>
      <div id="txd-tags-val" class="txd-cl-value">
        ${drawerTags.length ? drawerTags.map(t => `<span class="cl-tag">${t}</span>`).join('') : '<span class="cl-placeholder">+ Add tags</span>'}
      </div>
    </div>
    <button class="tx-drawer-save-btn" onclick="txdSaveClassification('${txId}')">Save classification</button>
  </div>`

  // ── 3. DETAILS CARD ─────────────────────────────────────────
  html += `<div class="txd-card">
    <div class="txd-card-header">Details</div>
    ${_dRow('Source', tx.source || '—')}
    ${_dRow('Event type', tx.event_type || '—')}
    ${_dRow('Settled', tx.settled_date || '—')}
    ${tx.currency !== 'USD' ? _dRow('Currency', tx.currency) : ''}
    ${tx.exchange_rate ? _dRow('Exchange rate', tx.exchange_rate) : ''}
    ${tx.amount_ils    ? _dRow('Amount (ILS)', '₪' + Number(tx.amount_ils).toFixed(2)) : ''}
    ${tx.installment_index != null ? _dRow('Installment', tx.installment_index) : ''}
    ${tx.external_id ? _dRow('External ID', `<span style="font-family:var(--font-mono);font-size:11px">${tx.external_id}</span>`) : ''}
    ${importRecord ? `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border2)">
      <div style="font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.07em;color:var(--mu);margin-bottom:6px">Import</div>
      ${_dRow('Provider', importRecord.provider || '—')}
      ${_dRow('Type', importRecord.source_type || '—')}
      ${_dRow('Imported at', importRecord.imported_at ? new Date(importRecord.imported_at).toLocaleString() : '—')}
    </div>` : ''}
  </div>`

  // ── 4. DUPLICATE WARNING ─────────────────────────────────────
  if (hasDupe) {
    html += `<div class="txd-card">
      <div class="tx-drawer-dupe-warn">
        <strong>⚠ Possible duplicate</strong>
        ${dupeRows.length ? '<div style="margin-top:6px">' + dupeRows.map(d =>
          `<div style="font-size:11px;color:var(--amber-text);margin-top:3px">${d.transaction_date} · ${d.counterparty_name || '—'} · ${Math.abs(d.amount||0).toFixed(2)}</div>`
        ).join('') + '</div>' : ''}
      </div>
    </div>`
  }

  // ── 5. RAW DATA ──────────────────────────────────────────────
  html += `<div class="txd-card">
    <div class="txd-card-header" style="display:flex;align-items:center;justify-content:space-between">
      <span>Raw Data</span>
      <button class="tx-drawer-raw-toggle" onclick="txdToggleRaw(this)">▾ Show</button>
    </div>
    <div class="tx-drawer-raw-body" id="txd-raw-body">`

  const raw = tx.raw_data || {}
  if (typeof raw === 'object' && raw !== null) {
    Object.entries(raw).forEach(([k, v]) => {
      html += `<div class="tx-drawer-raw-row">
        <span class="tx-drawer-raw-key">${k}</span>
        <span class="tx-drawer-raw-val">${v == null ? '—' : String(v)}</span>
      </div>`
    })
  }
  html += `</div></div>`

  // ── 6. AUDIT TRAIL ───────────────────────────────────────────
  html += `<div class="txd-card">
    <div class="txd-card-header">Audit Trail</div>`
  if (!auditRows.length) {
    html += '<div style="font-size:12px;color:var(--mu2)">No audit entries yet</div>'
  } else {
    auditRows.forEach(entry => {
      const dt  = new Date(entry.created_at)
      const ds  = dt.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' })
        + ' ' + dt.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
      const meta = entry.meta ? Object.entries(entry.meta).map(([k,v]) => `${k}: ${JSON.stringify(v)}`).join(', ') : ''
      html += `<div class="tx-drawer-audit-item">
        <span class="tx-drawer-audit-dot"></span>
        <span class="tx-drawer-audit-date">${ds}</span>
        <div>
          <span class="tx-drawer-audit-action">${entry.action}</span>
          <span class="tx-drawer-audit-by"> · ${entry.changed_by}</span>
          ${meta ? `<div style="font-size:10px;color:var(--mu);margin-top:1px">${meta}</div>` : ''}
        </div>
      </div>`
    })
  }
  html += `</div>`

  html += `<div class="txd-card" style="display:flex;flex-direction:column;gap:8px">
    <div style="display:flex;justify-content:flex-end">
      ${isDeleted
        ? `<button class="tx-drawer-restore-btn" onclick="txDrawerRestore('${txId}')">Restore transaction</button>`
        : `<button class="tx-drawer-del-btn" onclick="txDrawerShowDeleteConfirm('${txId}')">Delete transaction</button>`}
    </div>
    <div id="tx-drawer-del-confirm"></div>
  </div>`

  content.innerHTML = html

  // Store drawer state for classification pickers
  content._drawerState = { txId, catId: drawerCatId, tax: drawerTax, entity: drawerEntity, tags: drawerTags }
}
window.renderTxDrawer = renderTxDrawer

function _dRow(label, val) {
  return `<div class="tx-drawer-row"><span class="tx-drawer-label">${label}</span><span class="tx-drawer-val">${val}</span></div>`
}

function txdToggleRaw(btn) {
  const body = document.getElementById('txd-raw-body')
  if (!body) return
  const open = body.classList.toggle('open')
  btn.textContent = open ? '▴ Hide' : '▾ Show'
}
window.txdToggleRaw = txdToggleRaw

// ── Drawer inline classification pickers ─────────────────────

function _txdState(txId) {
  const content = document.getElementById('tx-drawer-content')
  return content?._drawerState || null
}

function txdOpenCatPicker(txId) {
  const state = _txdState(txId)
  if (!state) return
  const anchor = document.getElementById('txd-cat-val')
  if (!anchor) return

  const dd = document.createElement('div')
  dd.className = 'cl-dropdown'
  dd.style.cssText = 'position:absolute;top:100%;right:0;left:auto;min-width:220px;z-index:400'

  const inp  = document.createElement('input'); inp.placeholder = 'Search category…'
  const list = document.createElement('div'); list.className = 'cl-dropdown-list'
  dd.append(inp, list)

  function renderList(q) {
    const filtered = CATEGORIES.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()))
    list.innerHTML = filtered.map(c =>
      `<div class="cl-dropdown-item${c.id === state.catId ? ' sel' : ''}" data-id="${c.id}">${c.name}</div>`
    ).join('')
    list.querySelectorAll('.cl-dropdown-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault()
        state.catId = item.dataset.id
        const cat = catById(item.dataset.id)
        if (cat?.tax && !state.tax) state.tax = cat.tax
        dd.remove()
        _txdRefreshClUI(state)
      })
    })
  }
  inp.addEventListener('input', () => renderList(inp.value))
  inp.addEventListener('keydown', e => { if (e.key === 'Escape') dd.remove() })
  renderList('')
  anchor.style.position = 'relative'
  anchor.appendChild(dd)
  inp.focus()
}
window.txdOpenCatPicker = txdOpenCatPicker

function txdOpenTaxPicker(txId) {
  const state = _txdState(txId)
  if (!state) return
  const anchor = document.getElementById('txd-tax-val')
  if (!anchor) return

  const dd = document.createElement('div')
  dd.className = 'cl-dropdown'
  dd.style.cssText = 'position:absolute;top:100%;right:0;left:auto;min-width:200px;z-index:400'

  const inp  = document.createElement('input'); inp.placeholder = 'Search tax…'
  const list = document.createElement('div'); list.className = 'cl-dropdown-list'
  dd.append(inp, list)

  function renderList(q) {
    list.innerHTML = TAX_TREATMENTS.filter(t => !q || t.includes(q.toLowerCase())).map(t =>
      `<div class="cl-dropdown-item${t === state.tax ? ' sel' : ''}" data-val="${t}">${t.replace(/_/g,' ')}</div>`
    ).join('')
    list.querySelectorAll('.cl-dropdown-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault(); state.tax = item.dataset.val; dd.remove(); _txdRefreshClUI(state)
      })
    })
  }
  inp.addEventListener('input', () => renderList(inp.value))
  inp.addEventListener('keydown', e => { if (e.key === 'Escape') dd.remove() })
  renderList('')
  anchor.style.position = 'relative'
  anchor.appendChild(dd)
  inp.focus()
}
window.txdOpenTaxPicker = txdOpenTaxPicker

function txdToggleBP(txId) {
  const state = _txdState(txId)
  if (!state) return
  state.entity = state.entity === 'business' ? 'private' : state.entity === 'private' ? '' : 'business'
  _txdRefreshClUI(state)
}
window.txdToggleBP = txdToggleBP

function txdOpenTagPicker(txId) {
  const state = _txdState(txId)
  if (!state) return
  const anchor = document.getElementById('txd-tags-val')
  if (!anchor) return

  const pop = document.createElement('div')
  pop.className = 'cl-tag-popover'
  pop.style.cssText = 'position:absolute;top:100%;right:0;left:auto;z-index:400'
  let currentTags = [...state.tags]

  function renderChips() {
    pop.innerHTML = ''
    const chipsDiv = document.createElement('div'); chipsDiv.className = 'cl-tag-chips'
    currentTags.forEach(tag => {
      const chip = document.createElement('span'); chip.className = 'cl-tag'
      chip.innerHTML = `${tag} <span class="cl-tag-x" data-tag="${tag}">×</span>`
      chip.querySelector('.cl-tag-x').addEventListener('mousedown', e => {
        e.preventDefault(); currentTags = currentTags.filter(t => t !== tag); renderChips()
      })
      chipsDiv.appendChild(chip)
    })
    pop.appendChild(chipsDiv)
    const inp = document.createElement('input'); inp.className = 'cl-tag-input'; inp.placeholder = 'Add tag…'
    pop.appendChild(inp)
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); if (inp.value.trim()) { if (!currentTags.includes(inp.value.trim())) currentTags.push(inp.value.trim()); inp.value=''; renderChips() } }
      if (e.key === 'Escape') { state.tags = currentTags; pop.remove(); _txdRefreshClUI(state) }
    })
    setTimeout(() => inp.focus(), 0)
  }
  renderChips()

  anchor.style.position = 'relative'
  anchor.appendChild(pop)

  setTimeout(() => {
    function outside(e) { if (!pop.contains(e.target)) { state.tags = currentTags; pop.remove(); _txdRefreshClUI(state); document.removeEventListener('mousedown', outside) } }
    document.addEventListener('mousedown', outside)
  }, 0)
}
window.txdOpenTagPicker = txdOpenTagPicker

function _txdRefreshClUI(state) {
  const catName  = catById(state.catId)?.name || ''
  const taxClass = ['non_deductible','mixed_review'].includes(state.tax) ? state.tax : ''
  const catEl    = document.getElementById('txd-cat-val')
  const taxEl    = document.getElementById('txd-tax-val')
  const bpEl     = document.getElementById('txd-bp-btn')
  const tagsEl   = document.getElementById('txd-tags-val')

  if (catEl)  catEl.innerHTML  = catName ? `<span class="cl-cat-pill">${catName}</span>` : '<span class="cl-placeholder">Set…</span>'
  if (taxEl)  taxEl.innerHTML  = state.tax ? `<span class="cl-tax-badge ${taxClass}">${state.tax.replace(/_/g,' ')}</span>` : '<span class="cl-placeholder">—</span>'
  if (bpEl)  { bpEl.className = 'cl-bp-pill ' + (state.entity || ''); bpEl.textContent = state.entity === 'business' ? 'B' : state.entity === 'private' ? 'P' : '—' }
  if (tagsEl) tagsEl.innerHTML = state.tags.length ? state.tags.map(t => `<span class="cl-tag">${t}</span>`).join('') : '<span class="cl-placeholder">+ Add tags</span>'
}

async function txdSaveClassification(txId) {
  const state = _txdState(txId)
  if (!state) return
  const fields = { category_id: state.catId || null, tax_treatment: state.tax || null, entity: state.entity || null, tags: state.tags }
  await saveTxField(txId, fields)
  showToast('Classification saved')
}
window.txdSaveClassification = txdSaveClassification

// ── Delete confirm / restore ──────────────────────────────────

function txDrawerShowDeleteConfirm(txId) {
  const el = document.getElementById('tx-drawer-del-confirm')
  if (!el) return
  el.innerHTML = `
    <div class="tx-drawer-confirm-del">
      Delete this transaction? This is soft delete — it can be restored.
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-sm" style="background:var(--red);color:#fff;border-color:var(--red)" onclick="txDrawerConfirmDelete('${txId}')">Confirm Delete</button>
        <button class="btn btn-sm" onclick="document.getElementById('tx-drawer-del-confirm').innerHTML=''">Cancel</button>
      </div>
    </div>`
}
window.txDrawerShowDeleteConfirm = txDrawerShowDeleteConfirm

async function txDrawerConfirmDelete(txId) {
  const db = window._sb
  if (!db) return
  const tx = txAllRows.find(t => t.id === txId)
  try {
    const { error } = await db.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', txId)
    if (error) throw error
    writeAuditLog({ entityType: 'transaction', entityId: txId, action: 'delete',
      oldData: tx ? { ...tx } : null, meta: { reason: 'manual' } })
    txAllRows = txAllRows.filter(t => t.id !== txId)
    closeTxDrawer()
    renderTransactions()
    updateTxMetrics()
    showToast('Transaction deleted (soft)')
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'warn')
  }
}
window.txDrawerConfirmDelete = txDrawerConfirmDelete

async function txDrawerRestore(txId) {
  const db = window._sb
  if (!db) return
  try {
    const { error } = await db.from('transactions').update({ deleted_at: null }).eq('id', txId)
    if (error) throw error
    writeAuditLog({ entityType: 'transaction', entityId: txId, action: 'restore' })
    closeTxDrawer()
    await loadTransactions()
    showToast('Transaction restored')
  } catch (err) {
    showToast('Restore failed: ' + err.message, 'warn')
  }
}
window.txDrawerRestore = txDrawerRestore

// ── Assign client from income drawer ─────────────────────────

function txdOpenClientAssign(txId) {
  const host = document.getElementById('tx-drawer-client-assign')
  if (!host) return
  const tx = txAllRows.find(t => t.id === txId)
  if (!tx) return

  if (!txClients.length) {
    host.innerHTML = `<div style="margin-top:8px;padding:10px;border:1px solid var(--border2);border-radius:6px;font-size:11px;color:var(--mu2)">No clients available to match</div>`
    return
  }

  const selected = (tx.linked_entity_type || '').toLowerCase() === 'client' ? (tx.linked_entity_id || '') : ''
  host.innerHTML = `
    <div style="margin-top:8px;padding:10px;border:1px solid var(--border2);border-radius:6px;background:var(--surface)">
      <div style="font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.08em;color:var(--mu2);margin-bottom:6px">Assign Client</div>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="txd-client-select" class="fi" style="height:28px;font-size:12px;flex:1">
          <option value="">Select client…</option>
          ${txClients.map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.full_name || '—'}</option>`).join('')}
        </select>
        <button class="btn btn-sm btn-primary" onclick="txdSaveClientAssign('${txId}')">Save</button>
      </div>
    </div>`
}
window.txdOpenClientAssign = txdOpenClientAssign

async function txdSaveClientAssign(txId) {
  const db = window._sb
  if (!db) { showToast('DB not ready', 'warn'); return }
  const select = document.getElementById('txd-client-select')
  const clientId = select?.value || ''
  if (!clientId) { showToast('Choose a client', 'warn'); return }

  try {
    const { error } = await db
      .from('transactions')
      .update({ linked_entity_type: 'client', linked_entity_id: clientId })
      .eq('id', txId)
    if (error) throw error

    const tx = txAllRows.find(t => t.id === txId)
    if (tx) {
      tx.linked_entity_type = 'client'
      tx.linked_entity_id = clientId
    }

    writeAuditLog({
      entityType: 'transaction',
      entityId: txId,
      action: 'assign_client',
      meta: { client_id: clientId },
    })
    showToast('Client matched', 'info')
    renderTxDrawer(txId)
  } catch (err) {
    showToast('Client match failed: ' + err.message, 'warn')
  }
}
window.txdSaveClientAssign = txdSaveClientAssign

// ── Assign vendor from drawer ────────────────────────────────

function txdOpenVendorAssign(txId) {
  openVendorQuickPanel(null, txId, document.querySelector(`#tx-tbody tr[data-txid="${txId}"] td:nth-child(3)`))
}
window.txdOpenVendorAssign = txdOpenVendorAssign

// ── Row click handler (open drawer) ──────────────────────────

function _txRowClickHandler(e) {
  // Don't open drawer when clicking cl-cell, checkbox, action buttons, or vendor spans
  if (e.target.closest('.cl-cell'))          return
  if (e.target.closest('.cb-col'))           return
  if (e.target.closest('button'))            return
  if (e.target.closest('input'))             return
  if (e.target.closest('.tx-vendor-known'))  return
  if (e.target.closest('.tx-vendor-unknown')) return
  const tr = e.target.closest('tr[data-txid]')
  if (!tr) return
  openTxDrawer(tr.dataset.txid)
}

document.addEventListener('click', e => {
  const tbody = document.getElementById('tx-tbody')
  if (tbody && tbody.contains(e.target)) _txRowClickHandler(e)
})

// Close drawer on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeVendorQuickPanel()
  }
})

// ═══════════════════════════════════════════════════════════════
// EXPECTED INCOME TAB
// ═══════════════════════════════════════════════════════════════

async function loadExpectedIncome() {
  const tbody = document.getElementById('ei-tbody')
  if (!tbody) return
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--mu2);padding:20px">Loading…</td></tr>'

  const db = window._sb
  if (!db) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--red-text);text-align:center;padding:20px">DB not ready</td></tr>'
    return
  }

  try {
    // products FK not in schema cache — fetch separately and join in JS
    const { data, error } = await db
      .from('deals')
      .select(`
        id, billing_status, price, currency, origin, notes, product_id,
        clients ( id, full_name )
      `)
      .in('billing_status', ['pending', 'link_sent', 'invoiced', 'partial', 'overdue'])
      .not('sales_status', 'in', '("closed","lead")')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Fetch product names for the unique product_ids
    const productIds = [...new Set((data || []).map(d => d.product_id).filter(Boolean))]
    let productMap = {}
    if (productIds.length) {
      const { data: prods } = await db.from('products').select('id, name').in('id', productIds)
      ;(prods || []).forEach(p => { productMap[p.id] = p.name })
    }

    eiRows = (data || []).map(d => ({
      ...d,
      products: d.product_id ? { id: d.product_id, name: productMap[d.product_id] || null } : null,
    }))
    renderExpectedIncome()
    updateEiMetrics()
    updateAlertBarEi()
  } catch (err) {
    console.error('[Expected Income]', err)
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--red-text);text-align:center;padding:20px">${err.message}</td></tr>`
  }
}
window.loadExpectedIncome = loadExpectedIncome

function renderExpectedIncome() {
  const tbody = document.getElementById('ei-tbody')
  if (!tbody) return

  if (!eiRows.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--mu2);padding:20px">No open deals</td></tr>'
    return
  }

  const badgeColors = {
    pending:   'var(--amber-bg)',   pending_t:   'var(--amber-text)',
    link_sent: 'var(--blue-bg)',    link_sent_t: 'var(--blue-text)',
    invoiced:  'var(--purple-bg)',  invoiced_t:  'var(--purple-text)',
    partial:   'var(--gold-bg)',  partial_t: 'var(--amber-text)',
    overdue:   'var(--red-bg)',     overdue_t:   'var(--red-text)',
  }

  tbody.innerHTML = eiRows.map(deal => {
    const status    = deal.billing_status || 'pending'
    const isTC      = deal.origin === 'thrivecart'
    const label     = deal.products?.name || deal.notes || '—'
    const bg        = badgeColors[status] || 'var(--bg)'
    const col       = badgeColors[status + '_t'] || 'var(--mu)'
    const badgeHtml = `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${bg};color:${col};font-family:var(--font-mono)">${status.replace('_', ' ')}</span>`
    const actionHtml = isTC
      ? '<span style="font-size:11px;color:var(--mu)">auto-closed</span>'
      : '<span style="font-size:11px;color:var(--mu2)">—</span>'

    const SYM = { USD: '$', ILS: '₪', EUR: '€' }
    const sym = SYM[deal.currency] || '$'
    const clientCell = deal.clients?.id
      ? `<button class="ep-link" onclick="event.stopPropagation();openClientPanel('${deal.clients.id}')">${escHtml(deal.clients?.full_name || '—')}</button>`
      : escHtml(deal.clients?.full_name || '—')
    const dealCell = deal.id
      ? `<button class="ep-link" onclick="event.stopPropagation();openDealPanel('${deal.id}')">${escHtml(label)}</button>`
      : escHtml(label)

    return `<tr>
      <td style="font-size:13px;font-weight:500">${clientCell}</td>
      <td style="font-size:12px;color:var(--mu)">${dealCell}</td>
      <td style="font-size:12px;color:var(--mu)">${deal.origin || 'b2b'}</td>
      <td>${badgeHtml}</td>
      <td style="text-align:right;font-family:var(--font-mono)">${sym}${Number(deal.price || 0).toLocaleString()}</td>
      <td>${actionHtml}</td>
    </tr>`
  }).join('')
}

function updateEiMetrics() {
  const pending  = eiRows.filter(d => d.billing_status === 'pending')
  const linkSent = eiRows.filter(d => d.billing_status === 'link_sent')
  const invoiced = eiRows.filter(d => d.billing_status === 'invoiced')
  const sum      = arr => arr.reduce((s, d) => s + (d.price || 0), 0)
  const el       = id => document.getElementById(id)
  if (el('ei-metric-pending'))       el('ei-metric-pending').textContent       = fmt(sum(pending))
  if (el('ei-metric-pending-count')) el('ei-metric-pending-count').textContent = `${pending.length} deal${pending.length !== 1 ? 's' : ''}`
  if (el('ei-metric-link-sent'))     el('ei-metric-link-sent').textContent     = fmt(sum(linkSent))
  if (el('ei-metric-invoiced'))      el('ei-metric-invoiced').textContent      = fmt(sum(invoiced))
}

function updateAlertBarEi() {
  const total = eiRows.reduce((s, d) => s + (d.price || 0), 0)
  const el = document.getElementById('alert-expected-income')
  if (el) el.textContent = eiRows.length ? fmt(total) : '—'
}

// ═══════════════════════════════════════════════════════════════
// VENDOR BILLS TAB
// ═══════════════════════════════════════════════════════════════

function renderVendorList() {
  const needsReview = []
  const noBill      = []
  const readyToPay  = []

  vendorSummaries.forEach(({ vendor, bill, unbilled }) => {
    if (vendor.vendor_type === 'team_member' && !canSeeTeamFinancials()) return
    if (bill && ['draft','submitted'].includes(bill.status)) needsReview.push({ vendor, bill })
    else if (bill && bill.status === 'approved')             readyToPay.push({ vendor, bill })
    else if (unbilled.length > 0)                           noBill.push({ vendor, unbilled })
  })

  document.getElementById('review-count').textContent = needsReview.length
  document.getElementById('ready-count').textContent  = readyToPay.length
  document.getElementById('nobill-count').textContent = noBill.length

  document.getElementById('review-list').innerHTML = needsReview.map(({ vendor, bill }) =>
    renderVendorCard(vendor, {
      label: 'Draft Bill',
      amount: fmt(billAmount(bill)),
      meta: `${(bill.sessions||[]).length} sessions · ${bill.submitted_at ? 'Submitted ' + formatDateShort(bill.submitted_at) : 'Created ' + formatDateShort(bill.created_at)}`,
      color: 'amber',
    })
  ).join('')

  document.getElementById('nobill-list').innerHTML = noBill.map(({ vendor, unbilled }) =>
    renderVendorCard(vendor, {
      label: 'No bill yet',
      amount: fmt(unbilledAmount(unbilled)),
      meta: `${unbilled.length} sessions · No draft submitted`,
      color: 'gray',
    })
  ).join('')

  document.getElementById('ready-list').innerHTML = readyToPay.map(({ vendor, bill }) =>
    renderVendorCard(vendor, {
      label: 'Approved — Ready to pay',
      amount: fmt(billAmount(bill)),
      meta: `${(bill.sessions||[]).length} sessions · Approved ${formatDateShort(bill.approved_at)}`,
      color: 'green',
      extraBtn: `<button class="btn btn-sm" style="margin-left:8px;background:var(--green);color:#fff;border-color:var(--green)" onclick="event.stopPropagation();markPaid('${bill.id}')">Mark as Paid</button>`,
    })
  ).join('')
}

function renderVendorCard(vendor, opts) {
  const c = { amber: { bg:'var(--amber-bg)',text:'var(--amber-text)' }, gray: { bg:'var(--bg)',text:'var(--mu)' }, green: { bg:'var(--green-bg)',text:'var(--green-text)' } }[opts.color] || { bg:'var(--bg)',text:'var(--mu)' }
  return `<div class="block" style="margin-bottom:12px;cursor:pointer" onclick="openBillDetail('${vendor.id}')">
    <div style="padding:14px 16px;display:flex;align-items:center;justify-content:space-between">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <a style="font-size:14px;font-weight:600;color:var(--ink);text-decoration:underline;text-underline-offset:2px" href="vendor-profile.html?id=${vendor.id}" onclick="event.stopPropagation()">${vendor.full_name || vendor.name || '—'}</a>
          <span style="font-size:9px;font-family:var(--font-mono);padding:2px 6px;border-radius:10px;background:${c.bg};color:${c.text}">${vendorTypeLabel(vendor.vendor_type)}</span>
        </div>
        <div style="font-size:11px;color:${c.text};margin-bottom:2px">${opts.label}</div>
        <div style="font-size:10px;color:var(--mu)">${opts.meta}</div>
      </div>
      <div style="text-align:right;display:flex;align-items:center">
        <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:${c.text}">${opts.amount}</div>
        ${opts.extraBtn || ''}
      </div>
    </div>
  </div>`
}

function openBillDetail(vendorId) {
  if (!vendorId) return
  // Always open the inline bill detail view — never the vendor profile panel
  selectedVendorId = vendorId
  selectedDraftIds.clear()
  selectedUnbilledIds.clear()

  const summary = vendorSummaries.find(x => x.vendor.id === vendorId)
  if (!summary) return

  document.getElementById('vendor-list-view').classList.add('hidden')
  document.getElementById('vendor-detail-view').classList.remove('hidden')
  document.getElementById('vendor-detail-name').textContent  = summary.vendor.full_name || summary.vendor.name || '—'
  document.getElementById('vendor-detail-email').textContent = summary.vendor.email || ''

  document.getElementById('draft-bill-section').style.display = 'none'
  document.getElementById('unbilled-section').style.display   = 'none'

  getVendorDetailForManager(vendorId).then(detail => {
    vendorDetail = detail
    renderVendorDetail()
  }).catch(err => {
    console.error(err)
    showToast('Failed to load bill detail', 'warn')
  })
}
window.openBillDetail = openBillDetail

function openClientPanel(clientId) {
  if (!clientId) return
  if (window.Router && !_routerDispatching) {
    Router.open({ entity: 'client', id: clientId, view: 'panel', from: currentTab || 'payments' })
    return
  }
  window.PanelManager?.open('client', clientId)
}
window.openClientPanel = openClientPanel

function openDealPanel(dealId) {
  if (!dealId) return
  if (window.Router && !_routerDispatching) {
    Router.open({ entity: 'deal', id: dealId, view: 'panel', from: currentTab || 'payments' })
    return
  }
  window.PanelManager?.open('deal', dealId)
}
window.openDealPanel = openDealPanel

// ═══════════════════════════════════════════════════════════════
// VENDOR DETAIL VIEW
// ═══════════════════════════════════════════════════════════════

async function openVendorDetail(vendorId) {
  if (!vendorId) return
  if (window.Router && !_routerDispatching) {
    Router.open({ entity: 'vendor', id: vendorId, view: 'panel', from: 'list' })
    return
  }
  if (window.PanelManager?.open) {
    window.PanelManager.open('vendor', vendorId)
    return
  }
  selectedVendorId = vendorId
  selectedDraftIds.clear()
  selectedUnbilledIds.clear()

  const summary = vendorSummaries.find(x => x.vendor.id === vendorId)
  if (!summary) return

  document.getElementById('vendor-list-view').classList.add('hidden')
  document.getElementById('vendor-detail-view').classList.remove('hidden')
  document.getElementById('vendor-detail-name').textContent  = summary.vendor.full_name || summary.vendor.name || '—'
  document.getElementById('vendor-detail-email').textContent = summary.vendor.email || ''

  document.getElementById('draft-bill-section').style.display = 'none'
  document.getElementById('unbilled-section').style.display   = 'none'

  try {
    vendorDetail = await getVendorDetailForManager(vendorId)
    renderVendorDetail()
  } catch (err) {
    console.error(err)
    showToast('Failed to load vendor detail', 'warn')
  }
}
window.openVendorDetail = openVendorDetail
window.selectVendor = openVendorDetail

function renderVendorDetail() {
  if (!vendorDetail) return
  const { draftBill, unbilledSessions, history } = vendorDetail

  if (draftBill) {
    document.getElementById('draft-bill-section').style.display = 'block'
    const sessions = draftBill.sessions || []
    selectedDraftIds.clear()
    sessions.forEach(s => selectedDraftIds.add(s.id))
    document.getElementById('draft-total').textContent = fmt(billAmount(draftBill))
    document.getElementById('draft-meta').textContent  = `${sessions.length} sessions · ${draftBill.submitted_at ? 'Submitted ' + formatDateShort(draftBill.submitted_at) : 'Created ' + formatDateShort(draftBill.created_at)}`
    renderDraftSessions(sessions)
  } else {
    document.getElementById('draft-bill-section').style.display = 'none'
  }

  if (unbilledSessions.length > 0) {
    document.getElementById('unbilled-section').style.display = 'block'
    selectedUnbilledIds = new Set(unbilledSessions.map(s => s.id))
    renderUnbilledSessions(unbilledSessions, draftBill)
  } else {
    document.getElementById('unbilled-section').style.display = 'none'
  }

  const histDiv = document.getElementById('vendor-history')
  if (!history.length) {
    histDiv.innerHTML = '<div style="font-size:12px;color:var(--mu2)">No payment history yet</div>'
  } else {
    histDiv.innerHTML = history.map((bill, i) => {
      const label    = bill.status === 'approved' ? 'Approved' : 'Paid ' + formatDateShort(bill.paid_at)
      const sessions = bill.sessions || []
      return `<div class="block" style="margin-bottom:12px">
        <div style="padding:14px 16px;display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="toggleHistoryBill('hist-${i}')">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--green-text)">✅ ${label}</div>
            <div style="font-size:11px;color:var(--mu);margin-top:2px">${sessions.length} sessions</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-family:var(--font-mono);font-size:16px;font-weight:600;color:var(--green-text)">${fmt(billAmount(bill))}</div>
            <span id="hist-chevron-${i}" style="font-size:11px;color:var(--mu)">▾</span>
          </div>
        </div>
        <div id="hist-${i}" style="display:none;border-top:1px solid var(--border2)">
          <table class="tbl">
            <thead><tr><th>Date</th><th>Client</th><th>Task type</th><th>Hours</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>${sessions.map(s => `<tr>
              <td>${formatDateShort(s.session_date)}</td>
              <td>${s.client_name || '—'}</td>
              <td style="font-size:12px">${s.task_type_name || '—'}</td>
              <td class="mono">${fmtHours(s.hours)}</td>
              <td style="text-align:right" class="mono">${fmt(sessionAmount(s))}</td>
            </tr>`).join('') || '<tr><td colspan="5" style="color:var(--mu2);text-align:center;padding:12px">No sessions</td></tr>'}</tbody>
          </table>
        </div>
      </div>`
    }).join('')
  }
}

function renderDraftSessions(sessions) {
  const tbody = document.getElementById('draft-sessions')
  tbody.innerHTML = sessions.map(s => `
    <tr>
      <td><input type="checkbox" ${selectedDraftIds.has(s.id) ? 'checked' : ''} onchange="toggleDraftSession('${s.id}')"></td>
      <td>${formatDateShort(s.session_date)}</td>
      <td>${s.client_name || '—'}</td>
      <td style="font-size:12px">${s.task_type_name || '—'}</td>
      <td class="mono">${fmtHours(s.hours)}</td>
      <td style="text-align:right" class="mono">${fmt(sessionAmount(s))}</td>
    </tr>`).join('')
  const total = sessions.filter(s => selectedDraftIds.has(s.id)).reduce((s, x) => s + sessionAmount(x), 0)
  document.getElementById('draft-total').textContent = fmt(total)
}

function renderUnbilledSessions(sessions, draftBill) {
  const hasDraft = !!draftBill
  const checkCol = document.getElementById('unbilled-check-col')
  if (checkCol) checkCol.style.display = hasDraft ? 'none' : ''
  const tbody = document.getElementById('unbilled-sessions')
  tbody.innerHTML = sessions.map(s => hasDraft
    ? `<tr><td>${formatDateShort(s.session_date)}</td><td>${s.client_name||'—'}</td><td style="font-size:12px">${s.task_type_name||'—'}</td><td class="mono">${fmtHours(s.hours)}</td><td style="text-align:right" class="mono">${fmt(sessionAmount(s))}</td></tr>`
    : `<tr><td style="width:30px"><input type="checkbox" ${selectedUnbilledIds.has(s.id)?'checked':''} onchange="toggleUnbilledSession('${s.id}')"></td><td>${formatDateShort(s.session_date)}</td><td>${s.client_name||'—'}</td><td style="font-size:12px">${s.task_type_name||'—'}</td><td class="mono">${fmtHours(s.hours)}</td><td style="text-align:right" class="mono">${fmt(sessionAmount(s))}</td></tr>`
  ).join('')

  const btn = document.getElementById('manager-create-draft-btn')
  if (btn) {
    if (hasDraft) { btn.style.display = 'none'; return }
    btn.style.display = ''
    const total = sessions.filter(s => selectedUnbilledIds.has(s.id)).reduce((s, x) => s + sessionAmount(x), 0)
    btn.textContent = `Create Draft Bill — ${fmt(total)}`
    btn.disabled = selectedUnbilledIds.size === 0
  }
}

function toggleHistoryBill(id) {
  const el = document.getElementById(id)
  const idx = id.replace('hist-','')
  const chevron = document.getElementById('hist-chevron-' + idx)
  if (!el) return
  const open = el.style.display === 'none'
  el.style.display = open ? '' : 'none'
  if (chevron) chevron.textContent = open ? '▴' : '▾'
}
window.toggleHistoryBill = toggleHistoryBill

function toggleDraftSession(id) {
  selectedDraftIds.has(id) ? selectedDraftIds.delete(id) : selectedDraftIds.add(id)
  renderDraftSessions(vendorDetail?.draftBill?.sessions || [])
}
window.toggleDraftSession = toggleDraftSession

function toggleUnbilledSession(id) {
  selectedUnbilledIds.has(id) ? selectedUnbilledIds.delete(id) : selectedUnbilledIds.add(id)
  renderUnbilledSessions(vendorDetail?.unbilledSessions || [], vendorDetail?.draftBill || null)
}
window.toggleUnbilledSession = toggleUnbilledSession

function selectAllDraft() {
  (vendorDetail?.draftBill?.sessions || []).forEach(s => selectedDraftIds.add(s.id))
  renderDraftSessions(vendorDetail?.draftBill?.sessions || [])
}
window.selectAllDraft = selectAllDraft

function unselectAllDraft() {
  selectedDraftIds.clear()
  renderDraftSessions(vendorDetail?.draftBill?.sessions || [])
}
window.unselectAllDraft = unselectAllDraft

function addMoreSessions() { showToast('Use vendor\'s Operations page to log sessions', 'info') }
window.addMoreSessions = addMoreSessions

async function managerCreateDraftBill() {
  if (!selectedVendorId || selectedUnbilledIds.size === 0) { showToast('Select at least one session', 'warn'); return }
  const sessions = vendorDetail?.unbilledSessions || []
  const selected = sessions.filter(s => selectedUnbilledIds.has(s.id))
  const total    = selected.reduce((s, x) => s + sessionAmount(x), 0)
  showConfirm(`Create a draft bill of ${fmt(total)} for ${selected.length} session(s)?`, async () => {
    try {
      await createDraftBillV2({ vendorId: selectedVendorId, sessionIds: Array.from(selectedUnbilledIds), totalAmount: total })
      showToast('Draft bill created')
      vendorDetail = await getVendorDetailForManager(selectedVendorId)
      renderVendorDetail()
      await reloadAll()
    } catch (err) {
      showToast(err.message || 'Failed to create bill', 'warn')
    }
  }, { confirmLabel: 'Create bill' })
}
window.managerCreateDraftBill = managerCreateDraftBill

async function approveBill() {
  const bill = vendorDetail?.draftBill
  if (!bill || selectedDraftIds.size === 0) { showToast('Select at least one session', 'warn'); return }
  showConfirm('Approve this bill?', async () => {
    try {
      await approveBillV2(bill.id, Array.from(selectedDraftIds))
      showToast('Bill approved')
      await reloadAll()
      backToVendorList()
    } catch (err) {
      showToast(err.message || 'Failed to approve', 'warn')
    }
  }, { confirmLabel: 'Approve' })
}
window.approveBill = approveBill

function rejectBill() { document.getElementById('reject-modal').classList.add('open') }
window.rejectBill = rejectBill

function closeRejectModal() {
  document.getElementById('reject-modal').classList.remove('open')
  document.getElementById('reject-notes').value = ''
}
window.closeRejectModal = closeRejectModal

async function confirmReject() {
  const notes = document.getElementById('reject-notes').value.trim()
  if (!notes) { showToast('Please provide rejection notes', 'warn'); return }
  const bill = vendorDetail?.draftBill
  if (!bill) return
  try {
    await rejectBillV2(bill.id, notes)
    showToast('Bill returned to vendor')
    closeRejectModal()
    await reloadAll()
    backToVendorList()
  } catch (err) {
    showToast(err.message || 'Failed to reject bill', 'warn')
  }
}
window.confirmReject = confirmReject

async function markPaid(billId) {
  showConfirm('Mark this bill as paid?', async () => {
    try {
      await markBillPaidV2(billId)
      showToast('Bill marked as paid')
      writeAuditLog({ entityType: 'bill', entityId: billId, action: 'mark_paid' })
      await reloadAll()
      renderVendorList()
    } catch (err) {
      showToast('Failed to update', 'warn')
    }
  }, { confirmLabel: 'Mark paid' })
}
window.markPaid = markPaid

function backToVendorList() {
  selectedVendorId = null
  selectedDraftIds.clear()
  vendorDetail = null
  document.getElementById('vendor-list-view').classList.remove('hidden')
  document.getElementById('vendor-detail-view').classList.add('hidden')
  renderVendorList()
  if (window.Router && !_routerDispatching && Router.getParams().entity === 'vendor') Router.close()
}
window.backToVendorList = backToVendorList

// ═══════════════════════════════════════════════════════════════
// HISTORY TAB
// ═══════════════════════════════════════════════════════════════

async function renderHistoryTab() {
  const div = document.getElementById('all-history')
  div.innerHTML = '<div style="color:var(--mu2);font-size:12px;padding:8px">Loading…</div>'
  try {
    // FIX: bills → vendors FK is missing. Query vendors separately.
    const bills = await getPaidBillsAllVendors()
    if (!bills.length) {
      div.innerHTML = '<div style="color:var(--mu2);font-size:12px;padding:8px">No paid bills yet</div>'
      return
    }
    div.innerHTML = bills.map(bill => `
      <div class="block" style="margin-bottom:16px">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border2)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div>
              <div style="font-size:14px;font-weight:600;color:var(--ink)">${bill.vendor_name || '—'}</div>
              <div style="font-size:11px;color:var(--green-text)">✅ Paid ${formatDateShort(bill.paid_at)}</div>
            </div>
            <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--green-text)">${fmt(bill.total_amount)}</div>
          </div>
          <div style="font-size:10px;color:var(--mu)">${(bill.sessions||[]).length} sessions</div>
        </div>
        <table class="tbl">
          <thead><tr><th>Date</th><th>Client</th><th>Task type</th><th>Hours</th><th style="text-align:right">Amount</th></tr></thead>
          <tbody>${(bill.sessions||[]).map(s => `<tr>
            <td>${formatDateShort(s.session_date)}</td>
            <td>${s.client_name||'—'}</td>
            <td style="font-size:12px">${s.task_type_name||'—'}</td>
            <td class="mono">${fmtHours(s.hours)}</td>
            <td style="text-align:right" class="mono">${fmt(sessionAmount(s))}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`).join('')
  } catch (err) {
    console.error(err)
    div.innerHTML = '<div style="color:var(--red-text);font-size:12px;padding:8px">Failed to load history</div>'
  }
}

// ═══════════════════════════════════════════════════════════════
// BALANCES TAB
// ═══════════════════════════════════════════════════════════════

let _balAccounts   = []   // all accounts from getAccounts()
let _balRows       = []   // current balance rows being displayed
let _balAccountId  = ''   // selected account filter
let _balYear       = ''   // selected year filter
let _balEditId     = null // id of row being edited (null = add new)

async function loadBalances() {
  const tab = document.getElementById('tab-balances')
  if (!tab) return

  tab.innerHTML = `
    <div style="font-family:var(--font-serif);font-size:24px;font-weight:700;margin-bottom:20px">Account Balances</div>
    <div style="color:var(--mu2);font-size:12px;padding:8px">Loading…</div>`

  try {
    _balAccounts = await getAccounts()
    _balAccountId = _balAccountId || (_balAccounts[0]?.id || '')
    _balYear      = _balYear || String(new Date().getFullYear())
    _balRows = await getAccountBalances(_balAccountId || undefined, _balYear || undefined)
    await _enrichBalancesWithTxData(_balRows)
    _renderBalances()
    updateAlertBarBalances()
  } catch (err) {
    tab.innerHTML = `<div style="color:var(--red-text);font-size:12px;padding:8px">${err.message}</div>`
  }
}
window.loadBalances = loadBalances

function _renderBalances() {
  const tab = document.getElementById('tab-balances')
  if (!tab) return

  const now   = new Date()
  const years = []
  for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) years.push(String(y))

  const accountOpts = _balAccounts.map(a =>
    `<option value="${a.id}" ${a.id === _balAccountId ? 'selected' : ''}>${a.name} (${a.currency || ''})</option>`
  ).join('')

  const yearOpts = years.map(y =>
    `<option value="${y}" ${y === _balYear ? 'selected' : ''}>${y}</option>`
  ).join('')

  const tbody = _balRows.map(b => {
    const acc  = _balAccounts.find(a => a.id === b.account_id)
    const sym  = { USD:'$', ILS:'₪', EUR:'€', GBP:'£' }[b.currency || acc?.currency || 'USD'] || ''
    const mo   = b.month ? b.month.slice(0, 7) : '—'
    const open = b.opening_balance != null ? sym + Number(b.opening_balance).toFixed(2) : '—'
    const close = b.closing_balance != null ? sym + Number(b.closing_balance).toFixed(2) : '—'

    // Compute expected closing and delta (requires transaction data already fetched inline)
    const net  = b._net != null ? b._net : null
    const expectedClose = (net != null && b.opening_balance != null) ? b.opening_balance + net : null
    const delta = (b.closing_balance != null && expectedClose != null) ? b.closing_balance - expectedClose : null

    const netHtml = net != null
      ? `<span style="font-family:var(--font-mono);color:${net >= 0 ? 'var(--green-text)' : 'var(--red-text)'}">
           ${net >= 0 ? '+' : ''}${sym}${Math.abs(net).toFixed(2)}</span>`
      : '<span style="color:var(--mu2)">—</span>'

    const expHtml = expectedClose != null
      ? `<span style="font-family:var(--font-mono)">${sym}${expectedClose.toFixed(2)}</span>`
      : '<span style="color:var(--mu2)">—</span>'

    let deltaHtml = '<span style="color:var(--mu2)">—</span>'
    if (delta != null) {
      const abs = Math.abs(delta)
      const pct = b.closing_balance ? abs / Math.abs(b.closing_balance) : 1
      const color = abs === 0 ? 'var(--green-text)' : pct < 0.05 ? 'var(--amber-text)' : 'var(--red-text)'
      deltaHtml = `<span style="font-family:var(--font-mono);color:${color}">${delta >= 0 ? '+' : '−'}${sym}${abs.toFixed(2)}</span>`
    }

    return `<tr>
      <td style="font-family:var(--font-mono);font-size:12px">${mo}</td>
      <td style="font-family:var(--font-mono);font-size:13px">${open}</td>
      <td style="font-family:var(--font-mono);font-size:13px">${close}</td>
      <td>${netHtml}</td>
      <td>${expHtml}</td>
      <td>${deltaHtml}</td>
      <td style="font-size:11px;color:var(--mu)">${b.notes ? b.notes : ''}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-ghost" onclick="openBalModal('${b.id}')">Edit</button>
        <button class="btn btn-sm btn-ghost" style="color:var(--red-text)" onclick="deleteBalRow('${b.id}')">Del</button>
      </td>
    </tr>`
  }).join('')

  tab.innerHTML = `
    <div style="font-family:var(--font-serif);font-size:24px;font-weight:700;margin-bottom:20px">Account Balances</div>

    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      <select class="fi" style="height:32px;font-size:12px;max-width:240px" onchange="balSetAccount(this.value)">
        ${accountOpts}
      </select>
      <select class="fi" style="height:32px;font-size:12px;width:90px" onchange="balSetYear(this.value)">
        ${yearOpts}
      </select>
      <button class="btn btn-sm btn-primary" onclick="openBalModal(null)">+ Add Snapshot</button>
    </div>

    <div class="block" style="overflow-x:auto">
      <table class="tbl">
        <thead>
          <tr>
            <th>Month</th>
            <th>Opening</th>
            <th>Closing (actual)</th>
            <th>Transactions Net</th>
            <th>Expected Closing</th>
            <th>Delta</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${tbody || '<tr><td colspan="8" style="text-align:center;color:var(--mu2);padding:20px">No snapshots yet — click "+ Add Snapshot"</td></tr>'}</tbody>
      </table>
    </div>`
}

async function _enrichBalancesWithTxData(rows) {
  // Fetch transaction sums for each row and attach as _net
  await Promise.all(rows.map(async b => {
    try {
      const result = await getTransactionSumByAccountMonth(b.account_id, b.month)
      b._net = result.net
    } catch {
      b._net = null
    }
  }))
}

async function balSetAccount(accountId) {
  _balAccountId = accountId
  _balRows = await getAccountBalances(_balAccountId || undefined, _balYear || undefined)
  await _enrichBalancesWithTxData(_balRows)
  _renderBalances()
}
window.balSetAccount = balSetAccount

async function balSetYear(year) {
  _balYear = year
  _balRows = await getAccountBalances(_balAccountId || undefined, _balYear || undefined)
  await _enrichBalancesWithTxData(_balRows)
  _renderBalances()
}
window.balSetYear = balSetYear

// ─── Modal ────────────────────────────────────────────────────

function openBalModal(editId) {
  _balEditId = editId || null
  const modal = document.getElementById('bal-modal')
  if (!modal) return

  document.getElementById('bal-modal-title').textContent = _balEditId ? 'Edit Balance Snapshot' : 'Add Balance Snapshot'

  // Populate account select
  const accSel = document.getElementById('bal-modal-account')
  accSel.innerHTML = _balAccounts.map(a =>
    `<option value="${a.id}">${a.name} (${a.currency || ''})</option>`
  ).join('')

  if (_balEditId) {
    const row = _balRows.find(b => b.id === _balEditId)
    if (row) {
      accSel.value = row.account_id
      document.getElementById('bal-modal-month').value    = row.month ? row.month.slice(0, 7) : ''
      document.getElementById('bal-modal-opening').value  = row.opening_balance ?? ''
      document.getElementById('bal-modal-closing').value  = row.closing_balance ?? ''
      document.getElementById('bal-modal-currency').value = row.currency || 'USD'
      document.getElementById('bal-modal-notes').value    = row.notes || ''
    }
  } else {
    // Defaults: selected account, current month
    accSel.value = _balAccountId || (_balAccounts[0]?.id || '')
    const acc = _balAccounts.find(a => a.id === accSel.value)
    const now = new Date()
    document.getElementById('bal-modal-month').value    = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    document.getElementById('bal-modal-opening').value  = ''
    document.getElementById('bal-modal-closing').value  = ''
    document.getElementById('bal-modal-currency').value = acc?.currency || 'USD'
    document.getElementById('bal-modal-notes').value    = ''
  }

  modal.classList.add('open')
}
window.openBalModal = openBalModal

function closeBalModal() {
  document.getElementById('bal-modal')?.classList.remove('open')
  _balEditId = null
}
window.closeBalModal = closeBalModal

async function saveBalSnapshot() {
  const accountId = document.getElementById('bal-modal-account').value
  const monthRaw  = document.getElementById('bal-modal-month').value   // 'YYYY-MM'
  const opening   = document.getElementById('bal-modal-opening').value
  const closing   = document.getElementById('bal-modal-closing').value
  const currency  = document.getElementById('bal-modal-currency').value.trim() || 'USD'
  const notes     = document.getElementById('bal-modal-notes').value.trim() || null

  if (!accountId)        { showToast('Select an account', 'warn'); return }
  if (!monthRaw)         { showToast('Select a month', 'warn'); return }
  if (opening === '')    { showToast('Opening balance is required', 'warn'); return }

  const month = monthRaw + '-01'  // store as first day of month

  try {
    const row = await upsertAccountBalance({
      account_id:      accountId,
      month,
      opening_balance: parseFloat(opening),
      closing_balance: closing !== '' ? parseFloat(closing) : null,
      currency,
      notes,
    })
    closeBalModal()
    showToast('Snapshot saved')
    _balRows = await getAccountBalances(_balAccountId || undefined, _balYear || undefined)
    await _enrichBalancesWithTxData(_balRows)
    _renderBalances()
    updateAlertBarBalances()
  } catch (err) {
    showToast('Failed: ' + err.message, 'error')
  }
}
window.saveBalSnapshot = saveBalSnapshot

async function deleteBalRow(id) {
  const label = _balRows.find(b => b.id === id)?.month?.slice(0, 7) || id
  showConfirm(`Delete balance snapshot for ${label}? This cannot be undone.`, async () => {
    try {
      await deleteAccountBalance(id)
      _balRows = _balRows.filter(b => b.id !== id)
      _renderBalances()
      updateAlertBarBalances()
      showToast('Snapshot deleted')
    } catch (err) {
      showToast('Failed: ' + err.message, 'error')
    }
  })
}
window.deleteBalRow = deleteBalRow

async function updateAlertBarBalances() {
  const el = document.getElementById('alert-unreconciled')
  if (!el) return
  try {
    // Count current-month balances where closing_balance is null or delta != 0
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
    const { data, error } = await window._sb
      .from('account_balances')
      .select('id, account_id, opening_balance, closing_balance, month')
      .eq('month', thisMonth)
    if (error) throw error

    const rows = data || []
    let unrec = 0
    for (const b of rows) {
      if (b.closing_balance == null) { unrec++; continue }
      const txResult = await getTransactionSumByAccountMonth(b.account_id, b.month)
      const expected = (b.opening_balance || 0) + txResult.net
      if (Math.abs(b.closing_balance - expected) > 0.01) unrec++
    }
    el.textContent = unrec || '—'
  } catch {
    el.textContent = '—'
  }
}

// ═══════════════════════════════════════════════════════════════
// MODULE DROPDOWN
// ═══════════════════════════════════════════════════════════════

function toggleModDD() { document.getElementById('mod-dd')?.classList.toggle('open') }
window.toggleModDD = toggleModDD
document.addEventListener('click', e => {
  if (!e.target.closest('.mod-wrap')) document.getElementById('mod-dd')?.classList.remove('open')
})

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

async function reloadAll() {
  vendorSummaries = await getVendorBillsForManager()
}

window.addEventListener('classification:lookup-changed', () => {
  loadClassificationLookups({ refreshUi: true })
})

document.addEventListener('DOMContentLoaded', async () => {
  if (!guardSpace('payments', 'workload.html')) return
  registerRouterHandlers()
  initTxColumns()
  // Restore filter state from URL before loading
  restoreTxUrlParams()
  try {
    // Part 3C: load vmVendors at init so vendor quick panel works on transactions tab
    await Promise.all([reloadAll(), loadClassificationLookups(), loadVMVendorsQuiet(), loadTxClients()])
  } catch (err) {
    console.error('[HSos] payments init failed:', err)
    showToast('Failed to load vendor data', 'warn')
  }
  const initTab = new URLSearchParams(window.location.search).get('tab') || 'transactions'
  switchTab(initTab, { pushUrl: false })
  if (window.Router) Router.dispatch()
})

// Loads vmVendors silently (no table rendering) — used at init
async function loadVMVendorsQuiet() {
  const db = window._sb
  if (!db) return
  try {
    const { data, error } = await db
      .from('vendors')
      .select('id, full_name, name, vendor_type, category_id, tax_treatment, entity, tags, match_patterns, email')
      .neq('vendor_type', 'merchant')
      .order('full_name')
    if (error) throw error
    vmVendors = data || []
  } catch (err) {
    console.warn('[VendorManager] quiet load failed:', err.message)
  }
}
