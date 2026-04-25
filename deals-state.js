// deals-state.js — shared state, constants, and utilities

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

const GATEWAY_LABELS = {
  green_invoice: 'Green Invoice',
  thrivecart:    'ThriveCart',
  wise:          'Wise',
  stripe:        'Stripe',
  paypal:        'PayPal',
  manual:        'Manual',
}

const SYM = { EUR: '€', USD: '$', GBP: '£', ILS: '₪', CHF: '₣' }
const fmt = (p, c) => `${SYM[c] || c}${Number(p).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const finalAmt = (price, vat, mode) => {
  const p = parseFloat(price) || 0, v = parseFloat(vat) || 0
  return mode === 'excl' ? p * (1 + v / 100) : p
}

// ─── schema detection ─────────────────────────────────────────
async function _detectPlansSchema() {
  try {
    const { error } = await _sb.from('plans').select('id').limit(0)
    window._plansSchemaReady = !error
  } catch {
    window._plansSchemaReady = false
  }
}
