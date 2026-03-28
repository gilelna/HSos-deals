// supabase-client.js
// Shared Supabase client for HSos Deals & Payments.
// All operations use the real Supabase client connected to the active environment.
// Schema reference: hsos-schema.sql
// Include via: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const sb = window.initSupabaseClient
  ? window.initSupabaseClient()
  : supabase.createClient(
      'https://wmqmonjnmgtoilxfqqkv.supabase.co',
      'sb_publishable_ujPTzw0beGD6fJ-V2PfNwg_mHgsoify'
    )

// DEBUG_DB: set window.DEBUG_DB = true in browser console to log all DB operations
function dbLog(op, payload, result) {
  if (window.DEBUG_DB) {
    console.groupCollapsed('[HSos DB] ' + op)
    if (payload !== undefined) console.log('payload:', payload)
    if (result  !== undefined) console.log('result:', result)
    console.groupEnd()
  }
}
function dbError(op, error) {
  console.error('[HSos DB] ' + op + ' FAILED', error)
}

// ─── AUTH HELPERS ────────────────────────────────────────────────────────────

async function requireAuth() {
  // AUTH BYPASS: returns true during current build phase (no Google OAuth yet).
  return true
}

async function getCurrentUser() {
  const { data: { user } } = await sb.auth.getUser()
  return user || null
}

async function signInWithGoogle() {
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/deals.html' }
  })
  if (error) throw error
  return data
}

async function signOut() {
  const { error } = await sb.auth.signOut()
  if (error) throw error
  window.location.href = 'login.html'
}

// ─── CLIENTS ─────────────────────────────────────────────────────────────────
// Schema: id, customer_id, full_name, email, phone, client_kind, company, source, notes, active

async function getClients() {
  const { data, error } = await sb
    .from('clients')
    .select('*')
    .order('full_name', { nullsFirst: false })
  if (error) throw error
  return data
}

async function getClient(id) {
  const { data, error } = await sb
    .from('clients')
    .select('*, vendor_clients(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

function normalizeClientVendor(vendor) {
  if (!vendor) return null
  return {
    id: vendor.id || null,
    full_name: vendor.full_name || '',
    nickname: vendor.nickname || null,
    email: vendor.email || null,
  }
}

function deriveClientPaymentStatus(client, deals) {
  if (client?.payment_status) return client.payment_status
  const billingStatuses = (deals || []).map(d => d.billing_status).filter(Boolean)
  if (billingStatuses.includes('overdue')) return 'overdue'
  if (billingStatuses.some(s => s !== 'paid')) return 'pending'
  if (billingStatuses.includes('paid')) return 'active'
  if (client?.active === false) return 'inactive'
  return 'active'
}

function withClientMeta(client, vendors, deals) {
  const normalizedDeals = deals || []
  const totalValue = normalizedDeals.reduce((sum, d) => sum + (parseFloat(d.price) || 0), 0)
  const paidValue = normalizedDeals
    .filter(d => d.billing_status === 'paid')
    .reduce((sum, d) => sum + (parseFloat(d.price) || 0), 0)
  const activeDealCount = normalizedDeals.filter(d => d.sales_status === 'active').length

  return {
    ...client,
    vendors,
    deals: normalizedDeals,
    dealCount: normalizedDeals.length,
    totalValue,
    paidValue,
    outstandingValue: totalValue - paidValue,
    activeDealCount,
    payment_status: deriveClientPaymentStatus(client, normalizedDeals),
  }
}

async function getClientsWithMeta() {
  const query = await sb
    .from('clients')
    .select(`
      *,
      vendor_clients(
        vendor_id,
        vendors(id, full_name, nickname, email)
      ),
      deals(
        id,
        price,
        currency,
        sales_status,
        billing_status
      )
    `)
    .order('full_name', { nullsFirst: false })

  if (!query.error) {
    return (query.data || []).map(client => {
      const vendors = (client.vendor_clients || [])
        .map(vc => normalizeClientVendor(vc.vendors))
        .filter(Boolean)
      return withClientMeta(client, vendors, client.deals || [])
    })
  }

  // Fallback: stitch manually
  const [clients, vendors, deals] = await Promise.all([
    getClients(),
    getVendors(),
    getDeals(),
  ])
  return clients
    .map(client => {
      const assignedVendors = vendors
        .filter(v => (v.clients || []).some(c => (c?.id || c) === client.id))
        .map(v => normalizeClientVendor(v))
        .filter(Boolean)
      return withClientMeta(client, assignedVendors, deals.filter(d => d.client_id === client.id))
    })
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
}

async function getClientDetail(clientId) {
  const detailQuery = await sb
    .from('clients')
    .select(`
      *,
      vendor_clients(
        vendor_id,
        vendors(id, full_name, nickname, email)
      ),
      deals(
        *,
        products(name),
        primary_vendor:vendors!deals_primary_vendor_id_fkey(full_name)
      ),
      sessions(
        id,
        session_date,
        session_type,
        status,
        notes,
        vendor_id,
        vendors(full_name)
      )
    `)
    .eq('id', clientId)
    .single()

  if (!detailQuery.error) return detailQuery.data

  // Fallback: stitch manually
  const { data: client, error: clientErr } = await sb
    .from('clients').select('*').eq('id', clientId).single()
  if (clientErr) throw clientErr

  const vendorJoinQuery = await sb
    .from('vendor_clients')
    .select('vendor_id, vendors(id, full_name, nickname, email)')
    .eq('client_id', clientId)

  const vendorLinks = vendorJoinQuery.error ? [] : (vendorJoinQuery.data || [])

  const dealsQuery = await sb
    .from('deals')
    .select('*, products(name)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  const sessionsQuery = await sb
    .from('sessions')
    .select('id, session_date, session_type, status, notes, vendor_id, vendors(full_name)')
    .eq('client_id', clientId)
    .order('session_date', { ascending: false })

  return {
    ...client,
    vendor_clients: vendorLinks,
    deals: dealsQuery.data || [],
    sessions: sessionsQuery.data || [],
  }
}

async function createClient(data) {
  const payload = {
    full_name:   data.full_name   || data.fullName || data.name || '',
    email:       data.email       || null,
    phone:       data.phone       || null,
    client_kind: data.client_kind || data.clientKind || 'private',
    company:     data.company     || null,
    source:      data.source      || null,
    notes:       data.notes       || null,
    active:      typeof data.active === 'boolean' ? data.active : true,
  }
  const { data: created, error } = await sb
    .from('clients').insert(payload).select().single()
  if (error) { dbError('createClient', error); throw error }
  dbLog('createClient', payload, created)
  return created
}

async function updateClient(id, data) {
  const payload = {}
  if ('full_name' in data || 'fullName' in data || 'name' in data)
    payload.full_name = data.full_name || data.fullName || data.name
  if ('email'       in data) payload.email       = data.email
  if ('phone'       in data) payload.phone       = data.phone
  if ('client_kind' in data || 'clientKind' in data)
    payload.client_kind = data.client_kind || data.clientKind
  if ('company' in data) payload.company = data.company
  if ('source'  in data) payload.source  = data.source
  if ('notes'   in data) payload.notes   = data.notes
  if ('active'  in data) payload.active  = data.active

  const { data: updated, error } = await sb
    .from('clients').update(payload).eq('id', id).select().single()
  if (error) throw error
  return updated
}

// ─── VENDORS ─────────────────────────────────────────────────────────────────
// Schema: id, full_name, nickname, email, phone, vendor_type, payment_method,
//         payment_id, iban, preferred_currency, contract_url, active, notes

async function getVendors() {
  const { data, error } = await sb
    .from('vendors')
    .select('*, rates(*), vendor_clients(client_id, clients(*))')
    .order('full_name', { nullsFirst: false })
  if (error) throw error

  return data.map(vendor => ({
    ...vendor,
    preferred_currency: vendor.preferred_currency || null,
    clients: (vendor.vendor_clients || []).map(vc => vc.clients).filter(Boolean),
    vendor_clients: undefined,
  }))
}

async function getVendor(id) {
  const { data, error } = await sb
    .from('vendors')
    .select('*, rates(*), vendor_clients(client_id, clients(*))')
    .eq('id', id)
    .single()
  if (error) throw error

  return {
    ...data,
    preferred_currency: data.preferred_currency || null,
    clients: (data.vendor_clients || []).map(vc => vc.clients).filter(Boolean),
    vendor_clients: undefined,
  }
}

async function createVendor(data) {
  const { data: created, error } = await sb
    .from('vendors').insert(data).select().single()
  if (error) throw error
  return created
}

async function updateVendor(id, data) {
  const { data: updated, error } = await sb
    .from('vendors').update(data).eq('id', id).select().single()
  if (error) throw error
  return updated
}

// ─── RATES ───────────────────────────────────────────────────────────────────
// Schema: id, vendor_id, session_type (enum), rate, currency, effective_date, notes
// session_type enum values: coaching, consulting, editing, design, admin, other

async function getRates(vendorId) {
  const { data, error } = await sb
    .from('rates').select('*').eq('vendor_id', vendorId)
  if (error) throw error
  return data
}

async function upsertRate(vendorId, rateData) {
  const payload = { ...rateData, vendor_id: vendorId }
  // Map 'type' → 'session_type' (schema column name)
  if (payload.type !== undefined && payload.session_type === undefined) {
    payload.session_type = payload.type
    delete payload.type
  }
  const { data, error } = await sb
    .from('rates')
    .upsert(payload)
    .select().single()
  if (error) throw error
  return data
}

async function deleteRate(id) {
  const { error } = await sb.from('rates').delete().eq('id', id)
  if (error) throw error
}

// ─── VENDOR-CLIENT ASSIGNMENTS ───────────────────────────────────────────────

async function assignClientToVendor(vendorId, clientId) {
  const { data, error } = await sb
    .from('vendor_clients')
    .insert({ vendor_id: vendorId, client_id: clientId })
    .select().single()
  if (error) throw error
  return data
}

async function unassignClientFromVendor(vendorId, clientId) {
  const { error } = await sb
    .from('vendor_clients')
    .delete()
    .eq('vendor_id', vendorId)
    .eq('client_id', clientId)
  if (error) throw error
}

async function assignStudentToVendor(vendorId, clientId)     { return assignClientToVendor(vendorId, clientId) }
async function unassignStudentFromVendor(vendorId, clientId) { return unassignClientFromVendor(vendorId, clientId) }

// ─── PRODUCTS ────────────────────────────────────────────────────────────────
// Schema: id, name, type (enum), base_price, currency, units, notes, active, payment_links

async function getProducts() {
  const { data, error } = await sb
    .from('products').select('*').order('name')
  if (error) throw error
  return data
}

// ─── DEALS ───────────────────────────────────────────────────────────────────
// Schema: id, client_id, primary_vendor_id, owner_vendor_id, product_id,
//         price, currency, vat_pct, vat_mode, discount, sales_status,
//         billing_status, payment_processor, notes, created_at, updated_at
// NOTE: NO vendor_id, manager_id, fulfillment_stage, vat, or processor columns.

async function getDeals(filters = {}) {
  let query = sb
    .from('deals')
    .select(`
      *,
      clients(*),
      primary_vendor:vendors!deals_primary_vendor_id_fkey(*),
      owner_vendor:vendors!deals_owner_vendor_id_fkey(*),
      products(*)
    `)
    .order('created_at', { ascending: false })

  if (filters.client_id)       query = query.eq('client_id', filters.client_id)
  if (filters.sales_status)    query = query.eq('sales_status', filters.sales_status)
  if (filters.billing_status)  query = query.eq('billing_status', filters.billing_status)

  const { data, error } = await query
  if (error) throw error

  // Normalise join aliases so downstream code using d.vendors / d.managers still works
  return (data || []).map(d => ({
    ...d,
    vendors:  d.primary_vendor || null,
    managers: d.owner_vendor   || null,
    primary_vendor: undefined,
    owner_vendor:   undefined,
  }))
}

async function getDeal(id) {
  const { data, error } = await sb
    .from('deals')
    .select(`
      *,
      clients(*),
      primary_vendor:vendors!deals_primary_vendor_id_fkey(*),
      owner_vendor:vendors!deals_owner_vendor_id_fkey(*),
      products(*),
      deal_documents(*),
      deal_reminders(*)
    `)
    .eq('id', id)
    .single()
  if (error) throw error

  return {
    ...data,
    vendors:  data.primary_vendor || null,
    managers: data.owner_vendor   || null,
    primary_vendor: undefined,
    owner_vendor:   undefined,
  }
}

async function createDeal(data) {
  // Map legacy field names → real schema column names
  const payload = {
    client_id:         data.client_id,
    primary_vendor_id: data.primary_vendor_id || data.vendor_id || null,
    owner_vendor_id:   data.owner_vendor_id   || data.manager_id || null,
    product_id:        data.product_id        || null,
    price:             data.price             || null,
    currency:          data.currency          || 'EUR',
    vat_pct:           data.vat_pct           ?? data.vat ?? 0,
    vat_mode:          data.vat_mode          || 'excl',
    discount:          data.discount          || null,
    sales_status:      data.sales_status      || data.fulfillment_stage || 'lead',
    billing_status:    data.billing_status    || 'pending',
    payment_processor: data.payment_processor || data.processor || null,
    notes:             data.notes             || null,
  }

  const { data: created, error } = await sb
    .from('deals').insert(payload).select().single()
  if (error) { dbError('createDeal', error); throw error }
  dbLog('createDeal', payload, created)

  await addDealActivity(created.id, 'Deal created')
  return created
}

async function updateDeal(id, data) {
  const payload = {}
  const fieldMap = {
    client_id:         v => v,
    primary_vendor_id: v => v,
    owner_vendor_id:   v => v,
    product_id:        v => v,
    price:             v => v,
    currency:          v => v,
    vat_pct:           v => v,
    vat_mode:          v => v,
    discount:          v => v,
    sales_status:      v => v,
    billing_status:    v => v,
    payment_processor: v => v,
    notes:             v => v,
  }
  // Accept real column names
  for (const [col, fn] of Object.entries(fieldMap)) {
    if (col in data) payload[col] = fn(data[col])
  }
  // Accept legacy aliases
  if ('vat'       in data && !('vat_pct'           in payload)) payload.vat_pct           = data.vat
  if ('processor' in data && !('payment_processor' in payload)) payload.payment_processor = data.processor
  if ('vendor_id' in data && !('primary_vendor_id' in payload)) payload.primary_vendor_id = data.vendor_id
  if ('manager_id' in data && !('owner_vendor_id'  in payload)) payload.owner_vendor_id   = data.manager_id
  if ('fulfillment_stage' in data && !('sales_status' in payload)) payload.sales_status   = data.fulfillment_stage

  const { data: updated, error } = await sb
    .from('deals').update(payload).eq('id', id).select().single()
  if (error) throw error
  return updated
}

async function setDealBilling(id, billing_status) {
  const { data: updated, error } = await sb
    .from('deals').update({ billing_status }).eq('id', id).select().single()
  if (error) throw error
  await addDealActivity(id, `Billing: ${billing_status}`)
  return updated
}

async function setDealSalesStatus(id, sales_status) {
  const { data: updated, error } = await sb
    .from('deals').update({ sales_status }).eq('id', id).select().single()
  if (error) throw error
  await addDealActivity(id, `Moved to ${sales_status}`)
  return updated
}

async function setDealFulfillment(id, stage) { return setDealSalesStatus(id, stage) }

async function addDealDocument(dealId, doc) {
  const { data, error } = await sb
    .from('deal_documents')
    .insert({ ...doc, deal_id: dealId })
    .select().single()
  if (error) throw error
  return data
}

async function addDealActivity(dealId, text) {
  // deal_activity table is not in the schema — skip silently if it doesn't exist
  try {
    const { data, error } = await sb
      .from('deal_activity')
      .insert({ deal_id: dealId, text })
      .select().single()
    if (error) return null
    return data
  } catch { return null }
}

async function updateDealNotes(dealId, notes) {
  const { data, error } = await sb
    .from('deals').update({ notes }).eq('id', dealId).select().single()
  if (error) throw error
  return data
}

async function addDealReminder(dealId, text) {
  const { data, error } = await sb
    .from('deal_reminders')
    .insert({ deal_id: dealId, text, done: false })
    .select().single()
  if (error) throw error
  return data
}

async function toggleDealReminder(id, done) {
  const { data, error } = await sb
    .from('deal_reminders').update({ done }).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ─── SESSIONS ────────────────────────────────────────────────────────────────
// Schema: id, deal_id, vendor_id, client_id, session_date, start_time,
//         duration_min, session_type (enum), status (enum), notes

async function getSessions(filters = {}) {
  let query = sb
    .from('sessions')
    .select('*')
    .order('session_date', { ascending: false })

  if (filters.client_id)    query = query.eq('client_id', filters.client_id)
  if (filters.vendor_id)    query = query.eq('vendor_id', filters.vendor_id)
  if (filters.status)       query = query.eq('status', filters.status)
  if (filters.session_type) query = query.eq('session_type', filters.session_type)

  const { data, error } = await query
  if (error) throw error
  return data
}

async function updateSession(id, data) {
  const { data: updated, error } = await sb
    .from('sessions').update(data).eq('id', id).select().single()
  if (error) throw error
  return updated
}

async function getLessons(filters = {}) { return getSessions(filters) }
async function updateLesson(id, data)   { return updateSession(id, data) }

// ─── VENDOR HOURS ────────────────────────────────────────────────────────────
// Schema: id, vendor_id, deal_id, session_id, date, hours, session_type (enum),
//         rate, notes, synced
// NOTE: NO client_id, session_date, duration_hours, entity_name columns.

async function getVendorHours(vendorId, month) {
  // month is 'YYYY-MM' string; column is 'date' (not 'session_date')
  const { data, error } = await sb
    .from('vendor_hours')
    .select('*')
    .eq('vendor_id', vendorId)
    .gte('date', `${month}-01`)
    .lte('date', `${month}-31`)
    .order('date', { ascending: false })
  if (error) throw error
  return data
}

async function logVendorHour(data) {
  // Map from UI field names → real schema column names
  const payload = {
    vendor_id:    data.vendor_id,
    deal_id:      data.deal_id      || null,
    session_id:   data.session_id   || null,
    date:         data.date         || data.session_date,
    hours:        data.hours        != null ? data.hours : data.duration_hours,
    session_type: data.session_type || null,
    rate:         data.rate         || null,
    notes:        data.notes        || null,
  }
  const { data: created, error } = await sb
    .from('vendor_hours').insert(payload).select().single()
  if (error) { dbError('logVendorHour', error); throw error }
  dbLog('logVendorHour', payload, created)
  return created
}

async function updateVendorHour(id, data) {
  // Map UI field names → real schema column names
  const payload = {}
  if ('date'         in data) payload.date         = data.date
  if ('start_time'   in data) payload.start_time   = data.start_time
  if ('hours'        in data) payload.hours        = data.hours
  if ('session_type' in data) payload.session_type = data.session_type
  if ('status'       in data) payload.status       = data.status
  if ('notes'        in data) payload.notes        = data.notes

  const { data: updated, error } = await sb
    .from('vendor_hours').update(payload).eq('id', id).select().single()
  if (error) { dbError('updateVendorHour', error); throw error }
  dbLog('updateVendorHour', payload, updated)
  return updated
}

// ─── PAYCHECKS ───────────────────────────────────────────────────────────────
// Schema: id, vendor_id, month, total_hours, amount, currency, status, payment_date, notes

async function getPaychecks(filters = {}) {
  let query = sb
    .from('paychecks')
    .select('*, vendors(*)')
    .order('month', { ascending: false })

  if (filters.vendor_id) query = query.eq('vendor_id', filters.vendor_id)
  if (filters.month)     query = query.eq('month', filters.month)
  if (filters.status)    query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) throw error
  return data
}

async function getVendorPaychecks(vendorId) {
  const { data, error } = await sb
    .from('paychecks').select('*').eq('vendor_id', vendorId).order('month', { ascending: false })
  if (error) throw error
  return data
}

async function updatePaycheck(id, data) {
  const { data: updated, error } = await sb
    .from('paychecks').update(data).eq('id', id).select().single()
  if (error) throw error
  return updated
}

async function generatePaycheck(vendorId, month) {
  // month = 'YYYY-MM'
  const [hours, vendor] = await Promise.all([
    getVendorHours(vendorId, month),
    getVendor(vendorId),
  ])

  const rates = vendor.rates || []
  const breakdown = {}
  let totalAmount = 0

  hours.forEach(h => {
    const type = h.session_type || 'other'
    const rateObj = rates.find(r => r.session_type === type)
    const rate = parseFloat(rateObj?.rate || 0)
    const amount = (h.hours || 0) * rate

    if (!breakdown[type]) breakdown[type] = { hours: 0, rate, amount: 0 }
    breakdown[type].hours += h.hours || 0
    breakdown[type].amount += amount
    totalAmount += amount
  })

  const totalHours = hours.reduce((s, h) => s + (parseFloat(h.hours) || 0), 0)

  const { data: created, error } = await sb.from('paychecks').insert({
    vendor_id:   vendorId,
    month,
    total_hours: totalHours,
    amount:      totalAmount,
    currency:    vendor.preferred_currency || 'EUR',
    status:      'draft',
    notes:       JSON.stringify(breakdown),
  }).select().single()

  if (error) { dbError('generatePaycheck', error); throw error }
  dbLog('generatePaycheck', { vendorId, month, totalHours, totalAmount }, created)
  return created
}

async function sealMonthPaycheck(vendorId, month) {
  const existing = await getPaychecks({ vendor_id: vendorId, month })
  if (existing.length > 0) throw new Error('Month already sealed')

  const [hours, vendor] = await Promise.all([
    getVendorHours(vendorId, month),
    getVendor(vendorId),
  ])

  const rates = vendor.rates || []
  const breakdown = {}
  let totalHours = 0
  let totalAmount = 0

  hours.forEach(h => {
    const type = h.session_type || 'other'
    const rateObj = rates.find(r => r.session_type === type)
    const rate = parseFloat(rateObj?.rate || 0)
    const amount = (h.hours || 0) * rate
    if (!breakdown[type]) breakdown[type] = { hours: 0, rate, amount: 0 }
    breakdown[type].hours += h.hours || 0
    breakdown[type].amount += amount
    totalHours += h.hours || 0
    totalAmount += amount
  })

  const { data: created, error } = await sb.from('paychecks').insert({
    vendor_id:   vendorId,
    month,
    total_hours: totalHours,
    amount:      totalAmount,
    currency:    vendor.preferred_currency || 'EUR',
    breakdown:   breakdown,
    status:      'ready',
    notes:       JSON.stringify(breakdown),
  }).select().single()

  if (error) { dbError('sealMonthPaycheck', error); throw error }
  dbLog('sealMonthPaycheck', { vendorId, month }, created)
  return created
}

async function recalculatePaycheck(paycheckId) {
  const { data: paycheck, error: fetchErr } = await sb
    .from('paychecks').select('*').eq('id', paycheckId).single()
  if (fetchErr) throw fetchErr

  if (paycheck.status === 'paid') throw new Error('Cannot recalculate: Paycheck already paid')

  const [hours, vendor] = await Promise.all([
    getVendorHours(paycheck.vendor_id, paycheck.month),
    getVendor(paycheck.vendor_id),
  ])

  const rates = vendor.rates || []
  const breakdown = {}
  let totalHours = 0
  let totalAmount = 0

  hours.forEach(h => {
    const type = h.session_type || 'other'
    const rateObj = rates.find(r => r.session_type === type)
    const rate = parseFloat(rateObj?.rate || 0)
    const amount = (h.hours || 0) * rate
    if (!breakdown[type]) breakdown[type] = { hours: 0, rate, amount: 0 }
    breakdown[type].hours += h.hours || 0
    breakdown[type].amount += amount
    totalHours += h.hours || 0
    totalAmount += amount
  })

  const { data: updated, error } = await sb.from('paychecks').update({
    total_hours: totalHours,
    amount:      totalAmount,
    breakdown:   breakdown,
    notes:       JSON.stringify(breakdown),
  }).eq('id', paycheckId).select().single()

  if (error) { dbError('recalculatePaycheck', error); throw error }
  dbLog('recalculatePaycheck', { paycheckId }, updated)
  return updated
}

async function advancePaycheckStatus(id) {
  const { data: current, error: fetchError } = await sb
    .from('paychecks').select('status').eq('id', id).single()
  if (fetchError) throw fetchError

  const statusFlow = { draft: 'ready', ready: 'pending', pending: 'paid' }
  const nextStatus = statusFlow[current.status]
  if (!nextStatus) throw new Error(`Cannot advance from status: ${current.status}`)

  const updates = { status: nextStatus }
  if (nextStatus === 'paid') updates.payment_date = new Date().toISOString().slice(0, 10)

  const { data: updated, error } = await sb
    .from('paychecks').update(updates).eq('id', id).select().single()
  if (error) throw error
  return updated
}

// ─── PROFILES ────────────────────────────────────────────────────────────────

async function getProfile() {
  const user = await getCurrentUser()
  if (!user) return null
  const { data, error } = await sb
    .from('profiles').select('*').eq('id', user.id).single()
  if (error) throw error
  return data
}

async function getUserRole() {
  try {
    const profile = await getProfile()
    return profile?.system_role || profile?.role || null
  } catch { return null }
}

// ─── MANAGERS (legacy compat) ────────────────────────────────────────────────
// The managers table doesn't exist in the real schema.
// Returns empty array so callers don't crash.

async function getManagers() {
  return []
}

// ─── REAL-TIME ────────────────────────────────────────────────────────────────

function subscribeToDeals(callback) {
  return sb.channel('deals-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, callback)
    .subscribe()
}

function subscribeToPaychecks(callback) {
  return sb.channel('paychecks-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'paychecks' }, callback)
    .subscribe()
}
