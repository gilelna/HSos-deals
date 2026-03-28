// dummy-data.js
// Hardcoded mock data for HSos Deals & Payments.
// Load BEFORE supabase-client.js and set localStorage.setItem('HSOS_DATA_MODE', 'dummy').
// No modules, exports, or imports — plain browser script only.

;(function () {
  'use strict'

  // ─── RAW DATA ──────────────────────────────────────────────────────────────

  var PROFILE = {
    id: 'profile-vendor-1',
    vendor_id: 'vendor-1',
    email: 'maya@example.com',
    full_name: 'Maya Levi',
    name: 'Maya Levi',
    system_role: 'vendor',
    role: 'vendor',
    salary_method: 'bank',
    bank: 'Leumi',
    iban: 'IL12 0108 0000 0001 2345 678',
    phone: '+972-50-111-2222',
    cal_link: 'https://cal.example.com/maya',
    contract_url: 'https://docs.example.com/maya-contract',
    contract_link: 'https://docs.example.com/maya-contract',
    nickname: 'Maya',
    vendor_type: 'tutor',
    preferred_currency: 'ILS',
    currency: 'ILS',
  }

  var CLIENTS = [
    {
      id: 'client-1',
      full_name: 'Avi Cohen',
      name: 'Avi Cohen',
      company: 'Cohen Consulting',
      email: 'avi@cohen.com',
      payment_status: 'paid',
      package_size: 10,
      sessions_used: 4,
      lessons_used: 4,
      level: 'B2',
    },
    {
      id: 'client-2',
      full_name: 'Dana Shapiro',
      name: 'Dana Shapiro',
      company: '',
      email: 'dana@shapiro.io',
      payment_status: 'pending',
      package_size: 20,
      sessions_used: 12,
      lessons_used: 12,
      level: 'C1',
    },
    {
      id: 'client-3',
      full_name: 'Tom Goldberg',
      name: 'Tom Goldberg',
      company: 'Goldberg Ltd.',
      email: 'tom@goldberg.com',
      payment_status: 'overdue',
      package_size: 5,
      sessions_used: 5,
      lessons_used: 5,
      level: 'A2',
    },
    {
      id: 'client-4',
      full_name: 'Noa Ben-David',
      name: 'Noa Ben-David',
      company: 'TechFlow Ltd.',
      email: 'noa@techflow.io',
      payment_status: 'pending',
      package_size: 8,
      sessions_used: 2,
      lessons_used: 2,
      level: 'B1',
    },
    {
      id: 'client-5',
      full_name: 'Eitan Perl',
      name: 'Eitan Perl',
      company: '',
      email: 'eitan@perl.me',
      payment_status: 'paid',
      package_size: 10,
      sessions_used: 10,
      lessons_used: 10,
      level: 'C2',
    },
  ]

  var RATES_V1 = [
    { id: 'rate-1a', vendor_id: 'vendor-1', session_type: 'Private', type: 'Private', rate: 150, amount: 150, currency: 'ILS' },
    { id: 'rate-1b', vendor_id: 'vendor-1', session_type: 'Group',   type: 'Group',   rate: 80,  amount: 80,  currency: 'ILS' },
    { id: 'rate-1c', vendor_id: 'vendor-1', session_type: 'Service', type: 'Service', rate: 200, amount: 200, currency: 'ILS' },
  ]

  var RATES_V2 = [
    { id: 'rate-2a', vendor_id: 'vendor-2', session_type: 'Private',     type: 'Private',     rate: 120, amount: 120, currency: 'USD' },
    { id: 'rate-2b', vendor_id: 'vendor-2', session_type: 'Office Hour', type: 'Office Hour', rate: 60,  amount: 60,  currency: 'USD' },
  ]

  var VENDORS = [
    {
      id: 'vendor-1',
      full_name: 'Maya Levi',
      name: 'Maya Levi',
      email: 'maya@example.com',
      phone: '+972-50-111-2222',
      role: 'vendor',
      vendor_type: 'tutor',
      nickname: 'Maya',
      bank: 'Leumi',
      iban: 'IL12 0108 0000 0001 2345 678',
      currency: 'ILS',
      preferred_currency: 'ILS',
      salary_method: 'bank',
      payment_method: 'bank',
      payment_id: 'IL12 0108 0000 0001 2345 678',
      cal_link: 'https://cal.example.com/maya',
      contract_url: 'https://docs.example.com/maya-contract',
      contract_link: 'https://docs.example.com/maya-contract',
      notes: 'Senior tutor, specializes in Business English.',
      rates: RATES_V1,
      clients: [
        { id: 'client-1', full_name: 'Avi Cohen',    name: 'Avi Cohen',    email: 'avi@cohen.com',   package_size: 10, sessions_used: 4,  lessons_used: 4,  payment_status: 'paid',    level: 'B2', company: 'Cohen Consulting' },
        { id: 'client-2', full_name: 'Dana Shapiro', name: 'Dana Shapiro', email: 'dana@shapiro.io', package_size: 20, sessions_used: 12, lessons_used: 12, payment_status: 'pending', level: 'C1', company: '' },
        { id: 'client-4', full_name: 'Noa Ben-David', name: 'Noa Ben-David', email: 'noa@techflow.io', package_size: 8, sessions_used: 2, lessons_used: 2, payment_status: 'pending', level: 'B1', company: 'TechFlow Ltd.' },
      ],
      students: ['client-1', 'client-2', 'client-4'],
    },
    {
      id: 'vendor-2',
      full_name: 'Ron Bar',
      name: 'Ron Bar',
      email: 'ron@example.com',
      phone: '+1-415-222-3333',
      role: 'vendor',
      vendor_type: 'consultant',
      nickname: 'Ron',
      bank: 'Chase',
      iban: '',
      currency: 'USD',
      preferred_currency: 'USD',
      salary_method: 'paypal',
      payment_method: 'paypal',
      payment_id: 'ron@paypal.example.com',
      cal_link: 'https://cal.example.com/ron',
      contract_url: 'https://docs.example.com/ron-contract',
      contract_link: 'https://docs.example.com/ron-contract',
      notes: 'Part-time consultant.',
      rates: RATES_V2,
      clients: [
        { id: 'client-3', full_name: 'Tom Goldberg', name: 'Tom Goldberg', email: 'tom@goldberg.com', package_size: 5, sessions_used: 5, lessons_used: 5, payment_status: 'overdue', level: 'A2', company: 'Goldberg Ltd.' },
        { id: 'client-5', full_name: 'Eitan Perl', name: 'Eitan Perl', email: 'eitan@perl.me', package_size: 10, sessions_used: 10, lessons_used: 10, payment_status: 'paid', level: 'C2', company: '' },
      ],
      students: ['client-3', 'client-5'],
    },
  ]

  var MANAGERS = [
    { id: 'manager-1', name: 'Hila Stern', role: 'admin', slack: '@hila', webhook: true },
    { id: 'manager-2', name: 'Eyal Dror',  role: 'ops',   slack: '@eyal', webhook: false },
  ]

  var PRODUCTS = [
    {
      id: 'product-1',
      name: 'English Private Package',
      type: 'package',
      price: 1500,
      currency: 'ILS',
      units: '10 sessions',
      notes: 'Standard individual tutoring package.',
    },
    {
      id: 'product-2',
      name: 'Business English Workshop',
      type: 'workshop',
      price: 800,
      currency: 'USD',
      units: '1 event',
      notes: 'Half-day group workshop.',
    },
  ]

  var DEALS = [
    {
      id: 'deal-1',
      client_id: 'client-1',
      primary_vendor_id: 'vendor-1',
      vendor_id: 'vendor-1',
      owner_vendor_id: 'vendor-1',
      manager_id: 'manager-1',
      product_id: 'product-1',
      price: 1500,
      currency: 'ILS',
      vat: 17,
      vat_mode: 'excl',
      sales_status: 'active',
      fulfillment_stage: 'active',
      billing_status: 'invoiced',
      processor: 'green-invoice',
      notes: 'Client requested morning sessions.',
      clients: { id: 'client-1', full_name: 'Avi Cohen', name: 'Avi Cohen' },
      vendors: { id: 'vendor-1', full_name: 'Maya Levi', name: 'Maya Levi' },
      managers: { id: 'manager-1', name: 'Hila Stern' },
      products: { id: 'product-1', name: 'English Private Package' },
      deal_documents: [
        { id: 'doc-1', deal_id: 'deal-1', type: 'invoice', name: 'Invoice #001', date: '2026-02-01', url: 'https://docs.example.com/inv001' },
      ],
      deal_activity: [
        { id: 'act-1a', deal_id: 'deal-1', text: 'Deal created',          created_at: '2026-01-10T09:00:00Z' },
        { id: 'act-1b', deal_id: 'deal-1', text: 'Moved to active',       created_at: '2026-01-15T11:30:00Z' },
        { id: 'act-1c', deal_id: 'deal-1', text: 'Billing: invoiced',     created_at: '2026-02-01T08:00:00Z' },
      ],
      deal_reminders: [
        { id: 'rem-1', deal_id: 'deal-1', text: 'Follow up on payment', done: false },
      ],
      created_at: '2026-01-10T09:00:00Z',
    },
    {
      id: 'deal-2',
      client_id: 'client-2',
      primary_vendor_id: 'vendor-1',
      vendor_id: 'vendor-1',
      owner_vendor_id: 'vendor-1',
      manager_id: 'manager-1',
      product_id: 'product-1',
      price: 3000,
      currency: 'ILS',
      vat: 17,
      vat_mode: 'excl',
      sales_status: 'delivered',
      fulfillment_stage: 'delivered',
      billing_status: 'paid',
      processor: 'stripe',
      notes: '',
      clients: { id: 'client-2', full_name: 'Dana Shapiro', name: 'Dana Shapiro' },
      vendors: { id: 'vendor-1', full_name: 'Maya Levi', name: 'Maya Levi' },
      managers: { id: 'manager-1', name: 'Hila Stern' },
      products: { id: 'product-1', name: 'English Private Package' },
      deal_documents: [],
      deal_activity: [
        { id: 'act-2a', deal_id: 'deal-2', text: 'Deal created',      created_at: '2025-11-01T10:00:00Z' },
        { id: 'act-2b', deal_id: 'deal-2', text: 'Moved to delivered', created_at: '2026-01-20T14:00:00Z' },
        { id: 'act-2c', deal_id: 'deal-2', text: 'Billing: paid',     created_at: '2026-01-25T09:00:00Z' },
      ],
      deal_reminders: [],
      created_at: '2025-11-01T10:00:00Z',
    },
    {
      id: 'deal-3',
      client_id: 'client-3',
      primary_vendor_id: 'vendor-2',
      vendor_id: 'vendor-2',
      owner_vendor_id: 'vendor-2',
      manager_id: 'manager-2',
      product_id: 'product-2',
      price: 800,
      currency: 'USD',
      vat: 0,
      vat_mode: 'excl',
      sales_status: 'lead',
      fulfillment_stage: 'lead',
      billing_status: 'pending',
      processor: 'wise',
      notes: 'Needs contract signed first.',
      clients: { id: 'client-3', full_name: 'Tom Goldberg', name: 'Tom Goldberg' },
      vendors: { id: 'vendor-2', full_name: 'Ron Bar', name: 'Ron Bar' },
      managers: { id: 'manager-2', name: 'Eyal Dror' },
      products: { id: 'product-2', name: 'Business English Workshop' },
      deal_documents: [],
      deal_activity: [
        { id: 'act-3a', deal_id: 'deal-3', text: 'Deal created', created_at: '2026-03-01T08:00:00Z' },
      ],
      deal_reminders: [
        { id: 'rem-3', deal_id: 'deal-3', text: 'Send contract draft', done: false },
      ],
      created_at: '2026-03-01T08:00:00Z',
    },
    {
      id: 'deal-4',
      client_id: 'client-4',
      primary_vendor_id: 'vendor-1',
      vendor_id: 'vendor-1',
      owner_vendor_id: 'vendor-1',
      manager_id: 'manager-1',
      product_id: 'product-1',
      price: 1500,
      currency: 'ILS',
      vat: 17,
      vat_mode: 'excl',
      sales_status: 'qualified',
      fulfillment_stage: 'qualified',
      billing_status: 'pending',
      processor: 'green-invoice',
      notes: 'Interested in 2-month package.',
      clients: { id: 'client-4', full_name: 'Noa Ben-David', name: 'Noa Ben-David' },
      vendors: { id: 'vendor-1', full_name: 'Maya Levi', name: 'Maya Levi' },
      managers: { id: 'manager-1', name: 'Hila Stern' },
      products: { id: 'product-1', name: 'English Private Package' },
      deal_documents: [],
      deal_activity: [
        { id: 'act-4a', deal_id: 'deal-4', text: 'Deal created', created_at: '2026-03-05T10:00:00Z' },
        { id: 'act-4b', deal_id: 'deal-4', text: 'Moved to qualified', created_at: '2026-03-08T09:00:00Z' },
      ],
      deal_reminders: [],
      created_at: '2026-03-05T10:00:00Z',
    },
    {
      id: 'deal-5',
      client_id: 'client-5',
      primary_vendor_id: 'vendor-2',
      vendor_id: 'vendor-2',
      owner_vendor_id: 'vendor-2',
      manager_id: 'manager-2',
      product_id: 'product-2',
      price: 800,
      currency: 'USD',
      vat: 0,
      vat_mode: 'excl',
      sales_status: 'closed',
      fulfillment_stage: 'closed',
      billing_status: 'paid',
      processor: 'stripe',
      notes: 'Package completed successfully.',
      clients: { id: 'client-5', full_name: 'Eitan Perl', name: 'Eitan Perl' },
      vendors: { id: 'vendor-2', full_name: 'Ron Bar', name: 'Ron Bar' },
      managers: { id: 'manager-2', name: 'Eyal Dror' },
      products: { id: 'product-2', name: 'Business English Workshop' },
      deal_documents: [
        { id: 'doc-5', deal_id: 'deal-5', type: 'invoice', name: 'Invoice #005', date: '2026-02-15', url: 'https://docs.example.com/inv005' },
      ],
      deal_activity: [
        { id: 'act-5a', deal_id: 'deal-5', text: 'Deal created', created_at: '2025-12-01T10:00:00Z' },
        { id: 'act-5b', deal_id: 'deal-5', text: 'Moved to closed', created_at: '2026-02-10T14:00:00Z' },
        { id: 'act-5c', deal_id: 'deal-5', text: 'Billing: paid', created_at: '2026-02-15T09:00:00Z' },
      ],
      deal_reminders: [],
      created_at: '2025-12-01T10:00:00Z',
    },
  ]

  var SESSIONS = [
    {
      id: 'session-1',
      vendor_id: 'vendor-1',
      client_id: 'client-1',
      session_date: '2026-03-20',
      session_type: 'Private',
      entity_name: 'Avi Cohen',
      duration_hours: 1,
      status: 'done',
      notes: '',
    },
    {
      id: 'session-2',
      vendor_id: 'vendor-1',
      client_id: 'client-2',
      session_date: '2026-03-22',
      session_type: 'Private',
      entity_name: 'Dana Shapiro',
      duration_hours: 1.5,
      status: 'done',
      notes: 'Covered business idioms.',
    },
    {
      id: 'session-3',
      vendor_id: 'vendor-2',
      client_id: 'client-3',
      session_date: '2026-03-24',
      session_type: 'Group',
      entity_name: 'Tom Goldberg',
      duration_hours: 2,
      status: 'done',
      notes: '',
    },
    {
      id: 'session-4',
      vendor_id: 'vendor-1',
      client_id: 'client-4',
      session_date: '2026-03-21',
      session_type: 'Private',
      entity_name: 'Noa Ben-David',
      duration_hours: 1,
      status: 'done',
      notes: 'First onboarding session.',
    },
    {
      id: 'session-5',
      vendor_id: 'vendor-1',
      client_id: 'client-4',
      session_date: '2026-03-26',
      session_type: 'Private',
      entity_name: 'Noa Ben-David',
      duration_hours: 1,
      status: 'done',
      notes: '',
    },
  ]

  // vendor_hours — payout/work tracking records (separate from sessions)
  var VENDOR_HOURS = [
    {
      id: 'vh-1',
      vendor_id: 'vendor-1',
      client_id: 'client-1',
      session_date: '2026-03-20',
      session_type: 'Private',
      entity_name: 'Avi Cohen',
      duration_hours: 1,
      notes: '',
    },
    {
      id: 'vh-2',
      vendor_id: 'vendor-1',
      client_id: 'client-2',
      session_date: '2026-03-22',
      session_type: 'Private',
      entity_name: 'Dana Shapiro',
      duration_hours: 1.5,
      notes: '',
    },
    {
      id: 'vh-3',
      vendor_id: 'vendor-2',
      client_id: 'client-3',
      session_date: '2026-03-24',
      session_type: 'Group',
      entity_name: 'Tom Goldberg',
      duration_hours: 2,
      notes: '',
    },
    {
      id: 'vh-4',
      vendor_id: 'vendor-1',
      client_id: null,
      session_date: '2026-02-15',
      session_type: 'Service',
      entity_name: 'Curriculum prep',
      duration_hours: 3,
      notes: 'Prep work for Q1 clients.',
    },
    {
      id: 'vh-5',
      vendor_id: 'vendor-1',
      client_id: 'client-4',
      session_date: '2026-03-21',
      session_type: 'Private',
      entity_name: 'Noa Ben-David',
      duration_hours: 1,
      notes: '',
    },
    {
      id: 'vh-6',
      vendor_id: 'vendor-1',
      client_id: 'client-4',
      session_date: '2026-03-26',
      session_type: 'Private',
      entity_name: 'Noa Ben-David',
      duration_hours: 1,
      notes: '',
    },
  ]

  var PAYCHECKS = [
    {
      id: 'paycheck-1',
      vendor_id: 'vendor-1',
      month: '2026-03',
      total_hours: 4.5,
      rate: 150,
      amount: 675,
      currency: 'ILS',
      status: 'ready',
      payment_date: null,
      notes: '',
      vendors: { id: 'vendor-1', full_name: 'Maya Levi', name: 'Maya Levi' },
    },
    {
      id: 'paycheck-2',
      vendor_id: 'vendor-2',
      month: '2026-03',
      total_hours: 2,
      rate: 120,
      amount: 240,
      currency: 'USD',
      status: 'draft',
      payment_date: null,
      notes: '',
      vendors: { id: 'vendor-2', full_name: 'Ron Bar', name: 'Ron Bar' },
    },
    {
      id: 'paycheck-3',
      vendor_id: 'vendor-1',
      month: '2026-02',
      total_hours: 8,
      rate: 150,
      amount: 1200,
      currency: 'ILS',
      status: 'paid',
      payment_date: '2026-03-05',
      notes: 'Feb payroll — transferred via bank.',
      vendors: { id: 'vendor-1', full_name: 'Maya Levi', name: 'Maya Levi' },
    },
  ]

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value))
  }

  // Returns true if session_date starts with 'YYYY-MM'
  function matchesMonth(record, month) {
    if (!month) return true
    return typeof record.session_date === 'string' && record.session_date.slice(0, 7) === month
  }

  // ─── WINDOW ATTACHMENT ────────────────────────────────────────────────────

  window.HSOS_DUMMY = {

    getProfile: async function () {
      return clone(PROFILE)
    },

    getClients: async function () {
      return clone(CLIENTS)
    },

    getClient: async function (id) {
      var found = CLIENTS.find(function (c) { return c.id === id }) || null
      return clone(found)
    },

    getVendors: async function () {
      return clone(VENDORS)
    },

    getVendor: async function (id) {
      var found = VENDORS.find(function (v) { return v.id === id }) || null
      return clone(found)
    },

    getRates: async function (vendorId) {
      var all = RATES_V1.concat(RATES_V2)
      return clone(all.filter(function (r) { return r.vendor_id === vendorId }))
    },

    getManagers: async function () {
      return clone(MANAGERS)
    },

    getProducts: async function () {
      return clone(PRODUCTS)
    },

    getDeals: async function (filters) {
      filters = filters || {}
      var result = DEALS.filter(function (d) {
        if (filters.sales_status && d.sales_status !== filters.sales_status) return false
        if (filters.fulfillment_stage && d.fulfillment_stage !== filters.fulfillment_stage) return false
        if (filters.billing_status && d.billing_status !== filters.billing_status) return false
        if (filters.search) {
          var q = filters.search.toLowerCase()
          var clientName = (d.clients && (d.clients.full_name || d.clients.name) || '').toLowerCase()
          var productName = (d.products && d.products.name || '').toLowerCase()
          if (!clientName.includes(q) && !productName.includes(q)) return false
        }
        return true
      })
      return clone(result)
    },

    getDeal: async function (id) {
      var found = DEALS.find(function (d) { return d.id === id }) || null
      return clone(found)
    },

    getSessions: async function (filters) {
      filters = filters || {}
      var result = SESSIONS.filter(function (s) {
        if (filters.vendor_id  && s.vendor_id  !== filters.vendor_id)  return false
        if (filters.client_id  && s.client_id  !== filters.client_id)  return false
        if (filters.status     && s.status     !== filters.status)     return false
        if (filters.session_type && s.session_type !== filters.session_type) return false
        return true
      })
      return clone(result)
    },

    getVendorHours: async function (vendorId, month) {
      var result = VENDOR_HOURS.filter(function (h) {
        if (h.vendor_id !== vendorId) return false
        return matchesMonth(h, month)
      })
      return clone(result)
    },

    getPaychecks: async function (filters) {
      filters = filters || {}
      var result = PAYCHECKS.filter(function (p) {
        if (filters.vendor_id && p.vendor_id !== filters.vendor_id) return false
        if (filters.month     && p.month     !== filters.month)     return false
        if (filters.status    && p.status    !== filters.status)    return false
        return true
      })
      return clone(result)
    },

    getVendorPaychecks: async function (vendorId) {
      var result = PAYCHECKS.filter(function (p) { return p.vendor_id === vendorId })
      return clone(result)
    },

    // ── WRITE METHODS (mutable in-memory CRUD for demo) ──────────

    createClient: async function (data) {
      var id = 'client-' + Date.now()
      var record = Object.assign({ id: id }, data)
      CLIENTS.push(record)
      return clone(record)
    },

    updateClient: async function (id, data) {
      var idx = CLIENTS.findIndex(function (c) { return c.id === id })
      if (idx !== -1) {
        CLIENTS[idx] = Object.assign({}, CLIENTS[idx], data)
        return clone(CLIENTS[idx])
      }
      return clone(Object.assign({ id: id }, data))
    },

    createDeal: async function (data) {
      var id = 'deal-' + Date.now()
      var clientId = data.client_id
      var vendorId = data.primary_vendor_id || data.vendor_id
      var productId = data.product_id
      var client  = CLIENTS.find(function (c) { return c.id === clientId }) || null
      var vendor  = VENDORS.find(function (v) { return v.id === vendorId }) || null
      var product = PRODUCTS.find(function (p) { return p.id === productId }) || null
      var record = Object.assign({
        id: id,
        clients:  client  ? { id: client.id,  full_name: client.full_name  || client.name,  name: client.full_name  || client.name  } : null,
        vendors:  vendor  ? { id: vendor.id,  full_name: vendor.full_name  || vendor.name,  name: vendor.full_name  || vendor.name  } : null,
        products: product ? { id: product.id, name: product.name } : null,
        fulfillment_stage: data.sales_status || data.fulfillment_stage || 'lead',
        deal_documents: [],
        deal_activity:  [{ id: 'act-' + Date.now(), deal_id: id, text: 'Deal created', created_at: new Date().toISOString() }],
        deal_reminders: [],
        created_at: new Date().toISOString(),
      }, data)
      DEALS.push(record)
      return clone(record)
    },

    updateDeal: async function (id, data) {
      var idx = DEALS.findIndex(function (d) { return d.id === id })
      if (idx !== -1) {
        DEALS[idx] = Object.assign({}, DEALS[idx], data)
        return clone(DEALS[idx])
      }
      return clone(Object.assign({ id: id }, data))
    },

    setDealBilling: async function (id, billing_status) {
      var idx = DEALS.findIndex(function (d) { return d.id === id })
      if (idx !== -1) {
        DEALS[idx].billing_status = billing_status
        DEALS[idx].billing = billing_status
        return clone(DEALS[idx])
      }
      return { id: id, billing_status: billing_status }
    },

    setDealSalesStatus: async function (id, sales_status) {
      var idx = DEALS.findIndex(function (d) { return d.id === id })
      if (idx !== -1) {
        DEALS[idx].sales_status = sales_status
        DEALS[idx].fulfillment_stage = sales_status
        return clone(DEALS[idx])
      }
      return { id: id, sales_status: sales_status }
    },

    updateDealNotes: async function (id, notes) {
      var idx = DEALS.findIndex(function (d) { return d.id === id })
      if (idx !== -1) {
        DEALS[idx].notes = notes
        return clone(DEALS[idx])
      }
      return { id: id, notes: notes }
    },

    logVendorHour: async function (data) {
      var id = 'vh-' + Date.now()
      var record = Object.assign({ id: id }, data)
      VENDOR_HOURS.push(record)
      // Also add to SESSIONS for workload view
      SESSIONS.push(Object.assign({ id: 'session-' + Date.now(), status: 'done' }, data))
      return clone(record)
    },

    createVendor: async function (data) {
      var id = 'vendor-' + Date.now()
      var record = Object.assign({ id: id, rates: [], clients: [], students: [] }, data)
      VENDORS.push(record)
      return clone(record)
    },

    updateVendor: async function (id, data) {
      var idx = VENDORS.findIndex(function (v) { return v.id === id })
      if (idx !== -1) {
        VENDORS[idx] = Object.assign({}, VENDORS[idx], data)
        return clone(VENDORS[idx])
      }
      return clone(Object.assign({ id: id }, data))
    },

    upsertRate: async function (vendorId, rateData) {
      var vendor = VENDORS.find(function (v) { return v.id === vendorId })
      if (vendor) {
        if (!vendor.rates) vendor.rates = []
        var existIdx = rateData.id ? vendor.rates.findIndex(function (r) { return r.id === rateData.id }) : -1
        var record = Object.assign({ id: rateData.id || 'rate-' + Date.now(), vendor_id: vendorId }, rateData)
        if (existIdx !== -1) vendor.rates[existIdx] = record
        else vendor.rates.push(record)
        return clone(record)
      }
      return clone(Object.assign({ vendor_id: vendorId }, rateData))
    },

    advancePaycheckStatus: async function (id) {
      var idx = PAYCHECKS.findIndex(function (p) { return p.id === id })
      if (idx === -1) throw new Error('Paycheck not found: ' + id)
      var flow = { draft: 'ready', ready: 'pending', pending: 'paid' }
      var next = flow[PAYCHECKS[idx].status]
      if (!next) throw new Error('Cannot advance from status: ' + PAYCHECKS[idx].status)
      PAYCHECKS[idx].status = next
      if (next === 'paid') PAYCHECKS[idx].payment_date = new Date().toISOString().slice(0, 10)
      return clone(PAYCHECKS[idx])
    },

    updatePaycheck: async function (id, data) {
      var idx = PAYCHECKS.findIndex(function (p) { return p.id === id })
      if (idx !== -1) {
        PAYCHECKS[idx] = Object.assign({}, PAYCHECKS[idx], data)
        return clone(PAYCHECKS[idx])
      }
      return clone(Object.assign({ id: id }, data))
    },

    assignClientToVendor: async function (vendorId, clientId) {
      var vendor = VENDORS.find(function (v) { return v.id === vendorId })
      var client = CLIENTS.find(function (c) { return c.id === clientId })
      if (vendor && client) {
        if (!vendor.clients) vendor.clients = []
        if (!vendor.students) vendor.students = []
        var alreadyAssigned = vendor.clients.some(function (c) { return (c.id || c) === clientId })
        if (!alreadyAssigned) {
          vendor.clients.push({ id: client.id, full_name: client.full_name || client.name, name: client.full_name || client.name })
          vendor.students.push(clientId)
        }
      }
      return { vendor_id: vendorId, client_id: clientId }
    },

    unassignClientFromVendor: async function (vendorId, clientId) {
      var vendor = VENDORS.find(function (v) { return v.id === vendorId })
      if (vendor) {
        vendor.clients  = (vendor.clients  || []).filter(function (c) { return (c.id || c) !== clientId })
        vendor.students = (vendor.students || []).filter(function (s) { return s !== clientId })
      }
      return null
    },

    addDealReminder: async function (dealId, text) {
      var id = 'rem-' + Date.now()
      var reminder = { id: id, deal_id: dealId, text: text, done: false }
      var deal = DEALS.find(function (d) { return d.id === dealId })
      if (deal) {
        if (!deal.deal_reminders) deal.deal_reminders = []
        deal.deal_reminders.push(reminder)
      }
      return clone(reminder)
    },

    toggleDealReminder: async function (id, done) {
      for (var i = 0; i < DEALS.length; i++) {
        var reminders = DEALS[i].deal_reminders || []
        var rem = reminders.find(function (r) { return r.id === id })
        if (rem) { rem.done = done; return clone(rem) }
      }
      return { id: id, done: done }
    },

  }

})()
