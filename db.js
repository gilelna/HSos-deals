// db.js — HSos database layer
// Initializes Supabase using the active environment from env-config.js.
// env-config.js must be loaded before this file.
// No hardcoded credentials. No dummy mode. Auth is bypassed.

;(function () {
  if (!window.getEnvConfig) throw new Error('[HSos] db.js: env-config.js must be loaded before db.js')
  const config = window.getEnvConfig()
  window._sb = supabase.createClient(config.url, config.anonKey)
})()

const _sb = window._sb

// ─── error handler ───────────────────────────────────────────
window.addEventListener('unhandledrejection', e => {
  console.error('[HSos]', e.reason)
  showToast?.('Something went wrong — check console', 'warn')
})

// ─── vendors ─────────────────────────────────────────────────

function _withVendorActiveFilter(query, isActive) {
  return isActive
    ? query.or('active.eq.true,is_active.eq.true')
    : query.or('active.eq.false,is_active.eq.false')
}

async function _hydrateVendors(vendors) {
  const list = vendors || []
  if (!list.length) return []

  const vendorIds = [...new Set(list.map(v => v.id).filter(Boolean))]
  if (!vendorIds.length) return list.map(_mapVendor)

  const [ratesRes, assignmentsRes] = await Promise.all([
    _sb.from('rates').select('*').in('vendor_id', vendorIds),
    _sb
      .from('vendor_clients')
      .select('vendor_id, client_id, clients(*)')
      .in('vendor_id', vendorIds),
  ])

  if (ratesRes.error) throw ratesRes.error
  if (assignmentsRes.error) throw assignmentsRes.error

  const ratesByVendor = new Map()
  for (const r of ratesRes.data || []) {
    if (!ratesByVendor.has(r.vendor_id)) ratesByVendor.set(r.vendor_id, [])
    ratesByVendor.get(r.vendor_id).push(r)
  }

  const assignmentsByVendor = new Map()
  for (const a of assignmentsRes.data || []) {
    if (!assignmentsByVendor.has(a.vendor_id)) assignmentsByVendor.set(a.vendor_id, [])
    assignmentsByVendor.get(a.vendor_id).push(a)
  }

  return list.map(v => _mapVendor({
    ...v,
    rates: ratesByVendor.get(v.id) || [],
    vendor_clients: assignmentsByVendor.get(v.id) || [],
  }))
}

async function getVendors() {
  const { data, error } = await _withVendorActiveFilter(_sb
    .from('vendors')
    .select('*'), true)
    .order('full_name')
  if (error) throw error
  return _hydrateVendors(data)
}

async function getVendorsInactive() {
  const { data, error } = await _withVendorActiveFilter(_sb
    .from('vendors')
    .select('*'), false)
    .order('full_name')
  if (error) throw error
  return _hydrateVendors(data)
}

async function getLatestBillForVendor(vendorId) {
  const { data, error } = await _sb
    .from('bills')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

async function getVendor(id) {
  const { data, error } = await _sb
    .from('vendors')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  const [vendor] = await _hydrateVendors([data])
  return vendor
}

const getVendorById = getVendor

function _mapVendor(v) {
  return {
    ...v,
    clients: (v.vendor_clients || []).map(vc => vc.clients).filter(Boolean),
    vendor_clients: undefined,
  }
}

async function createVendor(fields) {
  const { data, error } = await _sb.from('vendors').insert(fields).select().single()
  if (error) throw error
  return data
}

async function updateVendor(id, fields) {
  const { data, error } = await _sb.from('vendors').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}

async function deleteVendor(id) {
  const { error } = await _sb.from('vendors').delete().eq('id', id)
  if (error) throw error
}

// ─── rates ───────────────────────────────────────────────────
// DB column is `rate`; UI/docs call it "amount". Read aliases r.amount = r.rate.
// is_default temporarily omitted from SELECT/ORDER/payload while demo
// PostgREST cache catches up. Restore once /rest/v1/rates?select=is_default
// returns 200.

async function getRates(vendorId) {
  const { data, error } = await _sb
    .from('rates')
    .select('id, vendor_id, name, rate, currency')
    .eq('vendor_id', vendorId)
    .order('name', { ascending: true })
  if (error) throw error
  return (data || []).map(r => ({ ...r, amount: r.rate }))
}

async function getDefaultRate(vendorId) {
  if (!vendorId) return null
  const { data, error } = await _sb
    .from('rates')
    .select('id, vendor_id, name, rate, currency')
    .eq('vendor_id', vendorId)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? { ...data, amount: data.rate } : null
}

async function upsertRate(vendorId, rateData) {
  const row = { ...rateData, vendor_id: vendorId }
  if (row.amount != null && row.rate == null) { row.rate = row.amount }
  delete row.amount
  delete row.is_default

  const { data, error } = await _sb.from('rates').upsert(row).select().single()
  if (error) throw error
  return { ...data, amount: data.rate }
}

async function deleteRate(id) {
  const { error } = await _sb.from('rates').delete().eq('id', id)
  if (error) throw error
}

// ─── vendor-client assignments ───────────────────────────────

async function assignClientToVendor(vendorId, clientId) {
  const { data, error } = await _sb
    .from('vendor_clients')
    .insert({ vendor_id: vendorId, client_id: clientId })
    .select().single()
  if (error) throw error
  return data
}

async function unassignClientFromVendor(vendorId, clientId) {
  const { error } = await _sb
    .from('vendor_clients')
    .delete()
    .eq('vendor_id', vendorId)
    .eq('client_id', clientId)
  if (error) throw error
}

async function getVendorClientsForClient(clientId) {
  // vendor_clients.vendor_id is uuid; vendors.id is text — no FK in schema cache.
  // Fetch vendor_ids first, then look up vendors separately.
  const { data: rows, error } = await _sb
    .from('vendor_clients')
    .select('vendor_id')
    .eq('client_id', clientId)
  if (error) throw error
  const ids = (rows || []).map(r => r.vendor_id).filter(Boolean)
  if (!ids.length) return []
  const { data: vendors, error: e2 } = await _sb
    .from('vendors')
    .select('id, full_name, vendor_type')
    .in('id', ids)
  if (e2) throw e2
  return vendors || []
}

// ─── clients ─────────────────────────────────────────────────

async function getClients() {
  const { data, error } = await _sb
    .from('clients')
    .select('*')
    .eq('active', true)
    .order('full_name')
  if (error) throw error
  return data
}

async function getClient(id) {
  const { data, error } = await _sb.from('clients').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

async function createClient(fields) {
  const { data, error } = await _sb.from('clients').insert(fields).select().single()
  if (error) throw error
  return data
}

async function updateClient(id, fields) {
  const { data, error } = await _sb.from('clients').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}

async function deleteClient(id) {
  const { error } = await _sb.from('clients').delete().eq('id', id)
  if (error) throw error
}

// ─── products ────────────────────────────────────────────────

async function getProducts() {
  const { data, error } = await _sb.from('products').select('*').eq('active', true).order('name')
  if (error) throw error
  return data
}

async function getProductsWithPlans() {
  const [programsRes, productsRes, plansRes] = await Promise.all([
    _sb.from('programs').select('*').order('name'),
    _sb.from('products').select('*').order('name'),
    _sb.from('plans').select('*').order('id'),
  ])

  if (programsRes.error) throw programsRes.error
  if (productsRes.error) throw productsRes.error
  if (plansRes.error) throw plansRes.error

  const plansByProduct = new Map()
  for (const plan of (plansRes.data || [])) {
    if (!plan?.product_id) continue
    if (!plansByProduct.has(plan.product_id)) plansByProduct.set(plan.product_id, [])
    plansByProduct.get(plan.product_id).push(plan)
  }

  const productsByProgram = new Map()
  for (const product of (productsRes.data || [])) {
    const programId = product?.program_id
    if (!programId) continue
    if (!productsByProgram.has(programId)) productsByProgram.set(programId, [])
    productsByProgram.get(programId).push({
      ...product,
      plans: plansByProduct.get(product.id) || [],
    })
  }

  return (programsRes.data || []).map(program => ({
    ...program,
    products: productsByProgram.get(program.id) || [],
  }))
}

// ─── products page: flat list with plans ─────────────────────

async function getAllProductsWithPlans() {
  const [productsRes, plansRes] = await Promise.all([
    _sb.from('products').select('*').order('name'),
    _sb.from('plans').select('*').order('created_at', { ascending: true }),
  ])
  if (productsRes.error) throw productsRes.error
  if (plansRes.error) throw plansRes.error

  const plansByProduct = new Map()
  for (const plan of (plansRes.data || [])) {
    if (!plan?.product_id) continue
    if (!plansByProduct.has(plan.product_id)) plansByProduct.set(plan.product_id, [])
    plansByProduct.get(plan.product_id).push(plan)
  }

  return (productsRes.data || []).map(product => ({
    ...product,
    plans: plansByProduct.get(product.id) || [],
  }))
}

async function getProduct(id) {
  const { data, error } = await _sb.from('products').select('*, plans(*)').eq('id', id).single()
  if (error) throw error
  return data
}

async function getPlan(id) {
  const { data, error } = await _sb.from('plans').select('*, products(*)').eq('id', id).single()
  if (error) throw error
  return data
}

async function createProductFull(fields) {
  // fields: name, category, status, description, logo_url, currency, price_min, price_max, links
  const { data, error } = await _sb.from('products').insert(fields).select().single()
  if (error) throw error
  return data
}

async function updateProductFull(id, fields) {
  const { data, error } = await _sb.from('products').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}

async function createPlanFull(fields) {
  // plan_uid assigned by DB trigger.
  const { data, error } = await _sb.from('plans').insert(fields).select().single()
  if (error) throw error
  return data
}

async function updatePlanFull(id, fields) {
  const { data, error } = await _sb.from('plans').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}

async function deletePlanFull(id) {
  const { error } = await _sb.from('plans').delete().eq('id', id)
  if (error) throw error
}

async function deleteProductFull(id) {
  // Delete all plans first, then the product
  const { error: e1 } = await _sb.from('plans').delete().eq('product_id', id)
  if (e1) throw e1
  const { error: e2 } = await _sb.from('products').delete().eq('id', id)
  if (e2) throw e2
}

async function createProduct(fields) {
  const { data, error } = await _sb.from('products').insert(fields).select().single()
  if (error) throw error
  return data
}

async function updateProduct(id, fields) {
  const { data, error } = await _sb.from('products').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}

async function deleteProduct(id) {
  const { error } = await _sb.from('products').delete().eq('id', id)
  if (error) throw error
}

async function updatePlan(id, fields) {
  const { data, error } = await _sb.from('plans').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}

async function insertPlan(fields) {
  const { data, error } = await _sb.from('plans').insert(fields).select().single()
  if (error) throw error
  return data
}

// ─── deals ───────────────────────────────────────────────────

async function _hydrateDealsRelations(deals) {
  const rows = deals || []
  if (!rows.length) return []

  const vendorIds = [...new Set(rows.map(d => d.primary_vendor_id).filter(Boolean))]
  const productIds = [...new Set(rows.map(d => d.product_id).filter(Boolean))]

  const [vendorsRes, productsRes] = await Promise.all([
    vendorIds.length
      ? _sb.from('vendors').select('*').in('id', vendorIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length
      ? _sb.from('products').select('*').in('id', productIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (vendorsRes.error) throw vendorsRes.error
  if (productsRes.error) throw productsRes.error

  const vendorsById = new Map((vendorsRes.data || []).map(v => [v.id, v]))
  const productsById = new Map((productsRes.data || []).map(p => [p.id, p]))

  return rows.map(d => ({
    ...d,
    vendors: d.primary_vendor_id ? (vendorsById.get(d.primary_vendor_id) || null) : null,
    products: d.product_id ? (productsById.get(d.product_id) || null) : null,
  }))
}

async function getDeals(filters = {}) {
  let q = _sb
    .from('deals')
    .select(`
      *,
      clients(*),
      deal_reminders(*),
      deal_documents(*)
    `)
    .order('created_at', { ascending: false })
  if (filters.client_id)         q = q.eq('client_id', filters.client_id)
  if (filters.sales_status)      q = q.eq('sales_status', filters.sales_status)
  if (filters.billing_status)    q = q.eq('billing_status', filters.billing_status)
  if (filters.primary_vendor_id) q = q.eq('primary_vendor_id', filters.primary_vendor_id)
  const { data, error } = await q
  if (error) throw error
  return _hydrateDealsRelations(data)
}

async function getDeal(id) {
  const { data, error } = await _sb
    .from('deals')
    .select(`
      *,
      clients(*),
      deal_documents(*),
      deal_reminders(*)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  const [deal] = await _hydrateDealsRelations([data])
  return deal
}

async function createDeal(fields) {
  const { data, error } = await _sb.from('deals').insert(fields).select().single()
  if (error) throw error
  return data
}

async function updateDeal(id, fields) {
  const { data, error } = await _sb
    .from('deals').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}

async function deleteDeal(id) {
  const { error } = await _sb.from('deals').delete().eq('id', id)
  if (error) throw error
}

async function addDealReminder(dealId, text, dueDate) {
  const { data, error } = await _sb
    .from('deal_reminders')
    .insert({ deal_id: dealId, text, done: false, due_date: dueDate || null })
    .select().single()
  if (error) throw error
  return data
}

async function toggleDealReminder(id, done) {
  const { data, error } = await _sb
    .from('deal_reminders').update({ done }).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ─── sessions ────────────────────────────────────────────────

async function getSessions(filters = {}) {
  let q = _sb.from('sessions').select('*').order('session_date', { ascending: false })
  if (filters.vendor_id)    q = q.eq('vendor_id', filters.vendor_id)
  if (filters.client_id)    q = q.eq('client_id', filters.client_id)
  if (filters.status)       q = q.eq('status', filters.status)
  if (filters.session_type) q = q.eq('session_type', filters.session_type)
  const { data, error } = await q
  if (error) throw error
  return data
}

async function createSession(fields) {
  const { data, error } = await _sb.from('sessions').insert(fields).select().single()
  if (error) throw error
  return data
}

async function updateSession(id, fields) {
  const { data, error } = await _sb
    .from('sessions').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}

// logSession (V1), getVendorSessions (V1), deleteSession (V1) removed — replaced by V2 variants below

async function getVendorClientsWithPackages(vendorId) {
  const { data: assignments, error: e1 } = await _sb
    .from('vendor_clients')
    .select('clients(*)')
    .eq('vendor_id', vendorId)
  if (e1) throw e1

  const clients = (assignments || []).map(a => a.clients).filter(Boolean)

  const [pkgRes, sessRes] = await Promise.all([
    _sb.from('packages').select('*').eq('vendor_id', vendorId).eq('status', 'active'),
    _sb.from('sessions').select('id, client_id').eq('vendor_id', vendorId).not('client_id', 'is', null),
  ])
  if (pkgRes.error) throw pkgRes.error

  const pkgs = pkgRes.data || []
  const sessions = sessRes.data || []

  // Count sessions per client for this vendor
  const sessionCountByClient = {}
  sessions.forEach(s => {
    if (s.client_id) sessionCountByClient[s.client_id] = (sessionCountByClient[s.client_id] || 0) + 1
  })

  return clients.map(c => {
    const pkg = pkgs.find(p => p.client_id === c.id) || null
    if (!pkg) return { ...c, active_package: null }
    const sessions_used = sessionCountByClient[c.id] || 0
    const sessions_remaining = Math.max(0, (pkg.total_sessions || 0) - sessions_used)
    return {
      ...c,
      active_package: { ...pkg, sessions_used, sessions_remaining },
    }
  })
}

// ─── packages ─────────────────────────────────────────────────

async function getPackages(filters = {}) {
  // packages.vendor_id is uuid but vendors.id is text — no FK in schema cache; join manually
  let q = _sb
    .from('packages')
    .select('*, clients(*)')
    .order('created_at', { ascending: false })
  if (filters.vendor_id) q = q.eq('vendor_id', filters.vendor_id)
  if (filters.client_id) q = q.eq('client_id', filters.client_id)
  if (filters.deal_id)   q = q.eq('deal_id', filters.deal_id)
  if (filters.status)    q = q.eq('status', filters.status)
  const { data, error } = await q
  if (error) throw error

  // Fetch vendor names for the unique vendor_ids
  const vendorIds = [...new Set((data || []).map(p => p.vendor_id).filter(Boolean))]
  let vendorMap = {}
  if (vendorIds.length) {
    const { data: vd } = await _sb.from('vendors').select('id, full_name, name').in('id', vendorIds)
    ;(vd || []).forEach(v => { vendorMap[v.id] = v })
  }

  // Attach vendor as nested object to match existing consumers
  const enriched = (data || []).map(p => ({
    ...p,
    vendors: vendorMap[p.vendor_id] || null,
  }))

  // Compute sessions_used live: count sessions per client+vendor pair
  const pairs = [...new Set(enriched.map(p => `${p.client_id}|${p.vendor_id}`))]
  const sessionCounts = {}
  await Promise.all(pairs.map(async pair => {
    const [cid, vid] = pair.split('|')
    const { count } = await _sb.from('sessions').select('id', { count: 'exact', head: true })
      .eq('client_id', cid).eq('vendor_id', vid)
    sessionCounts[pair] = count || 0
  }))

  return enriched.map(p => _mapPackage(p, sessionCounts[`${p.client_id}|${p.vendor_id}`]))
}

async function getPackage(id) {
  const { data, error } = await _sb
    .from('packages')
    .select('*, clients(*), sessions(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  // Attach vendor manually (type mismatch — no FK)
  if (data.vendor_id) {
    const { data: vd } = await _sb.from('vendors').select('*').eq('id', data.vendor_id).maybeSingle()
    data.vendors = vd || null
  }
  const { count } = await _sb.from('sessions').select('id', { count: 'exact', head: true })
    .eq('client_id', data.client_id).eq('vendor_id', data.vendor_id)
  return _mapPackage(data, count || 0)
}

async function createPackage(fields) {
  const { data, error } = await _sb.from('packages').insert(fields).select().single()
  if (error) throw error
  return data
}

async function updatePackage(id, fields) {
  const { data, error } = await _sb
    .from('packages')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

async function adjustPackageSessions(packageId, delta) {
  const { data: pkg, error: e1 } = await _sb
    .from('packages').select('sessions_used, total_sessions').eq('id', packageId).single()
  if (e1) throw e1
  const newUsed   = Math.max(0, (pkg.sessions_used || 0) + delta)
  const newStatus = newUsed >= pkg.total_sessions ? 'completed' : 'active'
  const { data, error } = await _sb
    .from('packages')
    .update({ sessions_used: newUsed, status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', packageId).select().single()
  if (error) throw error
  return _mapPackage(data)
}

function _mapPackage(p, liveSessionCount) {
  const sessions_used = liveSessionCount != null ? liveSessionCount : (p.sessions_used || 0)
  const sessions_remaining = Math.max(0, (p.total_sessions || 0) - sessions_used)
  return {
    ...p,
    sessions_used,
    sessions_remaining,
    client_name: p.clients?.full_name || null,
    vendor_name: p.vendors?.full_name || null,
  }
}

// ─── bills (restaurant model) ────────────────────────────────
// Status flow: draft → submitted → approved → paid
//           or: draft → submitted → returned → draft

// getUnbilledSessions / getUnbilledSessionsSimple (V1) removed — replaced by getUnpaidSessionsV2

async function getVendorBills(vendorId) {
  const { data, error } = await _sb
    .from('bills')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

async function getBillWithSessions(billId) {
  const { data, error } = await _sb
    .from('bills')
    .select('*, sessions(*, clients(full_name))')
    .eq('id', billId)
    .single()
  if (error) throw error
  const sessions = (data.sessions || []).map(s => ({ ...s, client_name: s.clients?.full_name || null }))
  return { ...data, sessions }
}

async function getAllBills(filters = {}) {
  let q = _sb
    .from('bills')
    .select('*')
    .order('created_at', { ascending: false })
  if (filters.status)    q = q.eq('status', filters.status)
  if (filters.vendor_id) q = q.eq('vendor_id', filters.vendor_id)
  const { data, error } = await q
  if (error) throw error
  return data
}

// ─── task types ───────────────────────────────────────────────

// task types that don't require a client (internal / no-client work)
const NO_CLIENT_TASK_TYPES = ['General']

// Build the task-type list for the workload form from the vendor's rates.
// Each rate becomes one option; "General" ($0) is always prepended as the
// catch-all no-client entry. Vendors with no rates get only "General".
async function getVendorRatesAsTaskTypes(vendorId) {
  const GENERAL = { id: 'general', name: 'General', rate_usd: 0, vendor_id: null }
  if (!vendorId) return [GENERAL]

  const { data, error } = await _sb
    .from('rates')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at')
  if (error) throw error

  const fromRates = (data || []).map(r => ({
    id:        r.id,
    name:      r.name || 'Session',
    rate_usd:  parseFloat(r.rate) || 0,
    vendor_id: vendorId,
  }))

  return [GENERAL, ...fromRates]
}

// ─── vendor sessions (v2: task-based) ────────────────────────

const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function _toUUID(val) {
  return (val && _UUID_RE.test(String(val))) ? val : null
}

// New: sessions.rate_id is the canonical FK to rates.id.
// Legacy: older sessions used task_type_id as a soft ref to rates.id.
// Read both, prefer rate_id, fall back to task_type_id for historical rows.
async function _hydrateSessionRates(sessions) {
  const rows = sessions || []
  const rateIds = [...new Set(
    rows.flatMap(s => [s.rate_id, s.task_type_id]).filter(Boolean)
  )]
  let rateMap = {}
  if (rateIds.length) {
    const { data: rates } = await _sb.from('rates').select('id, name, rate').in('id', rateIds)
    ;(rates || []).forEach(r => { rateMap[r.id] = r })
  }
  return rows.map(s => {
    const r = rateMap[s.rate_id] || rateMap[s.task_type_id] || null
    return {
      ...s,
      task_type_name: r?.name || null,
      rate_usd:       s.rate_usd ?? r?.rate ?? 0,
    }
  })
}

async function updateSessionV2(sessionId, { sessionDate, hours, rateId, rateUsd, notes, clientId }) {
  const fields = {
    session_date: sessionDate,
    hours,
    duration_min: Math.round(hours * 60),
    rate_id:      _toUUID(rateId),
    rate_usd:     rateUsd,
    notes:        notes || null,
  }
  if (clientId !== undefined) fields.client_id = _toUUID(clientId)
  const { data, error } = await _sb
    .from('sessions')
    .update(fields)
    .eq('id', sessionId)
    .select('*, clients(full_name)')
    .single()
  if (error) throw error
  const [hydrated] = await _hydrateSessionRates([{ ...data, client_name: data.clients?.full_name || null }])
  return hydrated
}

async function deleteSessionV2(sessionId) {
  // Block if session is in a non-draft/submitted bill
  const { data: s } = await _sb
    .from('sessions').select('bill_id, billed, package_id').eq('id', sessionId).single()
  if (s?.bill_id) {
    const { data: bill } = await _sb
      .from('bills').select('status').eq('id', s.bill_id).single()
    if (bill && !['draft', 'submitted'].includes(bill.status)) {
      throw new Error(`Cannot delete a session in a ${bill.status} bill`)
    }
    // Remove from bill first
    await _sb.from('sessions').update({ billed: false, bill_id: null }).eq('id', sessionId)
  }
  const { error } = await _sb.from('sessions').delete().eq('id', sessionId)
  if (error) throw error

  // Decrement package sessions_used if session had a package
  if (s?.package_id) {
    const { data: pkg } = await _sb
      .from('packages').select('sessions_used, total_sessions, status').eq('id', s.package_id).single()
    if (pkg) {
      const newUsed   = Math.max(0, pkg.sessions_used - 1)
      const newStatus = newUsed < pkg.total_sessions && pkg.status === 'completed' ? 'active' : pkg.status
      await _sb.from('packages')
        .update({ sessions_used: newUsed, status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', s.package_id)
    }
  }
}

async function logSessionV2({ vendorId, clientId, sessionDate, startTime, hours, rateId, rateUsd, notes }) {
  // Find active package for this client+vendor with remaining sessions
  let pkg = null
  if (clientId) {
    const { data: pkgs, error: e1 } = await _sb
      .from('packages')
      .select('*')
      .eq('client_id', clientId)
      .eq('vendor_id', vendorId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
    if (e1) throw e1
    pkg = (pkgs || []).find(p => p.sessions_used < p.total_sessions) || null
  }

  const fields = {
    vendor_id:    _toUUID(vendorId),
    client_id:    _toUUID(clientId),
    session_date: sessionDate,
    start_time:   startTime || null,
    hours,
    duration_min: Math.round(hours * 60),
    rate_id:      _toUUID(rateId),
    rate_usd:     rateUsd,
    notes:        notes || null,
    status:       'done',
    billed:       false,
    bill_id:      null,
    package_id:   _toUUID(pkg?.id),
  }
  const { data, error } = await _sb.from('sessions').insert(fields).select().single()
  if (error) throw error

  // Increment package sessions_used
  if (pkg) {
    const newUsed   = pkg.sessions_used + 1
    const newStatus = newUsed >= pkg.total_sessions ? 'completed' : 'active'
    await _sb.from('packages')
      .update({ sessions_used: newUsed, status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', pkg.id)
  }

  return data
}

async function getVendorSessionsV2(vendorId) {
  const { data, error } = await _sb
    .from('sessions')
    .select('*, clients(full_name)')
    .eq('vendor_id', vendorId)
    .order('session_date', { ascending: false })
  if (error) throw error

  const rows = (data || []).map(s => ({ ...s, client_name: s.clients?.full_name || null }))

  // Fetch bill statuses for sessions that have a bill_id
  const billIds = [...new Set(rows.map(s => s.bill_id).filter(Boolean))]
  let billStatusMap = {}
  if (billIds.length) {
    const { data: bills } = await _sb.from('bills').select('id, status').in('id', billIds)
    ;(bills || []).forEach(b => { billStatusMap[b.id] = b.status })
  }

  const hydrated = await _hydrateSessionRates(rows)
  return hydrated.map(s => ({
    ...s,
    _bill_status: s.bill_id ? (billStatusMap[s.bill_id] || null) : null,
  }))
}

async function getUnpaidSessionsV2(vendorId) {
  const { data, error } = await _sb
    .from('sessions')
    .select('*, clients(full_name)')
    .eq('vendor_id', vendorId)
    .is('bill_id', null)
    .order('session_date', { ascending: false })
  if (error) throw error
  const rows = (data || []).map(s => ({ ...s, client_name: s.clients?.full_name || null }))
  return _hydrateSessionRates(rows)
}

// ─── draft bill (v2 flow) ─────────────────────────────────────
// Status flow: draft → submitted → approved → paid
//           or: draft → submitted → returned (sessions freed)

async function getDraftBillV2(vendorId) {
  const { data, error } = await _sb
    .from('bills')
    .select('*, sessions(*, clients(full_name))')
    .eq('vendor_id', vendorId)
    .in('status', ['draft', 'submitted'])
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  if (!data?.length) return null
  return _mapBillV2(data[0])
}

async function getRejectedBillV2(vendorId) {
  const { data, error } = await _sb
    .from('bills')
    .select('*, sessions(*, clients(full_name))')
    .eq('vendor_id', vendorId)
    .eq('status', 'returned')
    .order('returned_at', { ascending: false })
    .limit(1)
  if (error) throw error
  if (!data?.length) return null
  return _mapBillV2(data[0])
}

async function getPaidBillsV2(vendorId) {
  const { data, error } = await _sb
    .from('bills')
    .select('*, sessions(*, clients(full_name))')
    .eq('vendor_id', vendorId)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
  if (error) throw error
  return Promise.all((data || []).map(_mapBillV2))
}

async function _mapBillV2(bill) {
  const raw = (bill.sessions || []).map(s => ({ ...s, client_name: s.clients?.full_name || null }))
  const sessions = await _hydrateSessionRates(raw)
  return { ...bill, sessions }
}

async function createDraftBillV2({ vendorId, sessionIds, totalAmount }) {
  // Guard: only one active bill per vendor
  const { data: existing } = await _sb
    .from('bills')
    .select('id')
    .eq('vendor_id', vendorId)
    .in('status', ['draft', 'submitted'])
    .maybeSingle()
  if (existing) throw new Error('You already have an active bill. Withdraw it first.')

  const { data: bill, error: e1 } = await _sb
    .from('bills')
    .insert({
      vendor_id:    vendorId,
      status:       'draft',
      total_amount: totalAmount,
      currency:     'USD',
    })
    .select().single()
  if (e1) throw e1

  const { error: e2 } = await _sb
    .from('sessions')
    .update({ billed: true, bill_id: bill.id })
    .in('id', sessionIds)
  if (e2) throw e2

  return bill
}

async function submitDraftBillV2(billId) {
  const { data, error } = await _sb
    .from('bills')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', billId).select().single()
  if (error) throw error
  return data
}

async function withdrawBillV2(billId) {
  // Unbill sessions and delete bill
  const { error: e1 } = await _sb
    .from('sessions').update({ billed: false, bill_id: null }).eq('bill_id', billId)
  if (e1) throw e1
  const { error: e2 } = await _sb.from('bills').delete().eq('id', billId)
  if (e2) throw e2
}

// ─── manager bill actions (v2) ────────────────────────────────

async function getVendorBillsForManager() {
  // All vendors with their active bill state (exclude merchant-only vendors)
  let vendorRes = await _withVendorActiveFilter(_sb
    .from('vendors')
    .select('id, full_name, email, vendor_type')
    .neq('vendor_type', 'merchant'), true)
    .order('full_name')

  // Some environments still miss vendors.email.
  if (vendorRes.error?.code === '42703' && /vendors\.email/.test(vendorRes.error.message || '')) {
    vendorRes = await _withVendorActiveFilter(_sb
      .from('vendors')
      .select('id, full_name, vendor_type')
      .neq('vendor_type', 'merchant'), true)
      .order('full_name')
    if (!vendorRes.error) {
      vendorRes.data = (vendorRes.data || []).map(v => ({ ...v, email: null }))
    }
  }

  if (vendorRes.error) throw vendorRes.error
  const vendors = vendorRes.data || []

  // Active bills (draft/submitted/approved)
  const { data: activeBills, error: e2 } = await _sb
    .from('bills')
    .select('*, sessions(id, hours, rate_usd, task_type_id)')
    .in('status', ['draft', 'submitted', 'approved'])
  if (e2) throw e2

  // Sessions without a bill (unbilled work)
  const { data: unbilledSessions, error: e3 } = await _sb
    .from('sessions')
    .select('id, vendor_id, hours, rate_usd')
    .is('bill_id', null)
  if (e3) throw e3

  return vendors.map(v => {
    const bill = (activeBills || []).find(b => b.vendor_id === v.id) || null
    const unpaid = (unbilledSessions || []).filter(s => s.vendor_id === v.id)
    return { vendor: v, bill, unbilled: unpaid }
  })
}

async function getVendorDetailForManager(vendorId) {
  const [draftRes, unbilledRes, historyRes] = await Promise.all([
    _sb.from('bills')
      .select('*, sessions(*, clients(full_name))')
      .eq('vendor_id', vendorId)
      .in('status', ['draft', 'submitted'])
      .maybeSingle(),
    _sb.from('sessions')
      .select('*, clients(full_name)')
      .eq('vendor_id', vendorId)
      .is('bill_id', null)
      .order('session_date', { ascending: false }),
    _sb.from('bills')
      .select('*, sessions(*, clients(full_name))')
      .eq('vendor_id', vendorId)
      .in('status', ['approved', 'paid'])
      .order('created_at', { ascending: false }),
  ])
  if (draftRes.error) throw draftRes.error
  if (unbilledRes.error) throw unbilledRes.error
  if (historyRes.error) throw historyRes.error

  const unbilledRaw = (unbilledRes.data || []).map(s => ({ ...s, client_name: s.clients?.full_name || null }))
  const [draftBill, unbilledSessions, history] = await Promise.all([
    draftRes.data ? _mapBillV2(draftRes.data) : Promise.resolve(null),
    _hydrateSessionRates(unbilledRaw),
    Promise.all((historyRes.data || []).map(_mapBillV2)),
  ])

  return { draftBill, unbilledSessions, history }
}

async function approveBillV2(billId, selectedSessionIds) {
  // Recalculate total from selected sessions only
  const { data: sessions, error: e0 } = await _sb
    .from('sessions').select('id, hours, rate_usd').in('id', selectedSessionIds)
  if (e0) throw e0
  const total = sessions.reduce((sum, s) => sum + (s.hours || 0) * (s.rate_usd || 0), 0)

  // Sessions that were in the bill but NOT selected → free them
  const { data: billSessions, error: e1 } = await _sb
    .from('sessions').select('id').eq('bill_id', billId)
  if (e1) throw e1
  const deselected = (billSessions || []).map(s => s.id).filter(id => !selectedSessionIds.includes(id))
  if (deselected.length > 0) {
    const { error: e2 } = await _sb
      .from('sessions').update({ billed: false, bill_id: null }).in('id', deselected)
    if (e2) throw e2
  }

  const { data, error: e3 } = await _sb
    .from('bills')
    .update({ status: 'approved', approved_at: new Date().toISOString(), total_amount: total })
    .eq('id', billId).select().single()
  if (e3) throw e3
  return data
}

async function rejectBillV2(billId, notes) {
  // Free all sessions in this bill
  const { error: e1 } = await _sb
    .from('sessions').update({ billed: false, bill_id: null }).eq('bill_id', billId)
  if (e1) throw e1

  const { data, error: e2 } = await _sb
    .from('bills')
    .update({ status: 'returned', returned_at: new Date().toISOString(), finance_notes: notes })
    .eq('id', billId).select().single()
  if (e2) throw e2
  return data
}

async function markBillPaidV2(billId) {
  const { data, error } = await _sb
    .from('bills')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', billId).select().single()
  if (error) throw error
  return data
}

async function getPaidBillsAllVendors() {
  // bills → vendors has no FK in schema cache; fetch separately
  const { data: bills, error } = await _sb
    .from('bills')
    .select('*, sessions(*, clients(full_name))')
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
  if (error) throw error

  const vendorIds = [...new Set((bills || []).map(b => b.vendor_id).filter(Boolean))]
  let vendorMap = {}
  if (vendorIds.length) {
    const { data: vd } = await _sb.from('vendors').select('id, full_name').in('id', vendorIds)
    ;(vd || []).forEach(v => { vendorMap[v.id] = v.full_name })
  }

  return Promise.all((bills || []).map(async b => {
    const raw = (b.sessions || []).map(s => ({ ...s, client_name: s.clients?.full_name || null }))
    const sessions = await _hydrateSessionRates(raw)
    return { ...b, vendor_name: vendorMap[b.vendor_id] || null, sessions }
  }))
}

// ─── vendor filtering for payments ────────────────────────────

async function getVendorsForPayments(role) {
  let q = _withVendorActiveFilter(_sb.from('vendors').select('*'), true).order('full_name')
  // Managers cannot see team_member vendors
  if (role === 'manager') q = q.neq('vendor_type', 'team_member')
  const { data, error } = await q
  if (error) throw error
  return _hydrateVendors(data)
}

// ─── paychecks ────────────────────────────────────────────────

async function getPaychecks(filters = {}) {
  let q = _sb.from('paychecks').select('*').order('month', { ascending: false })
  if (filters.vendor_id) q = q.eq('vendor_id', filters.vendor_id)
  if (filters.status)    q = q.eq('status', filters.status)
  const { data, error } = await q
  if (error) throw error
  return data
}

async function upsertPaycheck(fields) {
  const { data, error } = await _sb.from('paychecks').upsert(fields).select().single()
  if (error) throw error
  return data
}

async function updatePaycheck(id, fields) {
  const { data, error } = await _sb.from('paychecks').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ─── storage uploads ─────────────────────────────────────────

async function uploadDocumentFile(file, entityType, entityId) {
  const ext  = file.name.split('.').pop()
  const path = `${entityType}/${entityId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await _sb.storage.from('documents').upload(path, file, { upsert: false })
  if (error) throw error
  const { data: urlData } = _sb.storage.from('documents').getPublicUrl(path)
  return { path, url: urlData.publicUrl }
}

async function uploadVendorAvatar(vendorId, file) {
  const ext  = file.name.split('.').pop()
  const path = `${vendorId}/${Date.now()}.${ext}`
  const { error } = await _sb.storage.from('vendor-avatars').upload(path, file, { upsert: true })
  if (error) throw error
  const { data: urlData } = _sb.storage.from('vendor-avatars').getPublicUrl(path)
  return urlData.publicUrl
}

async function deleteDocumentFile(path) {
  const { error } = await _sb.storage.from('documents').remove([path])
  if (error) throw error
}

// ─── documents ───────────────────────────────────────────────

async function getDocuments(entityType, entityId) {
  const { data, error } = await _sb
    .from('documents')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

async function createDocument(fields) {
  const { data, error } = await _sb.from('documents').insert(fields).select().single()
  if (error) throw error
  return data
}

async function updateDocument(id, fields) {
  const { data, error } = await _sb.from('documents').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}

async function deleteDocument(id) {
  const { error } = await _sb.from('documents').delete().eq('id', id)
  if (error) throw error
}

// ─── vendor_client_assignments ────────────────────────────────

async function getVendorClientAssignments(filters = {}) {
  // vendor_client_assignments.vendor_id is uuid; vendors.id is text — no FK; join manually
  let q = _sb
    .from('vendor_client_assignments')
    .select('*, clients(id, full_name)')
    .order('valid_from', { ascending: false })
  if (filters.vendor_id) q = q.eq('vendor_id', filters.vendor_id)
  if (filters.client_id) q = q.eq('client_id', filters.client_id)
  const { data, error } = await q
  if (error) throw error

  const rows = data || []
  const vendorIds = [...new Set(rows.map(r => r.vendor_id).filter(Boolean))]
  let vendorMap = {}
  if (vendorIds.length) {
    const { data: vd } = await _sb.from('vendors').select('id, full_name').in('id', vendorIds)
    ;(vd || []).forEach(v => { vendorMap[v.id] = v })
  }
  return rows.map(r => ({ ...r, vendors: vendorMap[r.vendor_id] || null }))
}

async function createVendorClientAssignment(fields) {
  const { data, error } = await _sb
    .from('vendor_client_assignments')
    .insert(fields)
    .select('*, clients(id, full_name)')
    .single()
  if (error) throw error
  // Attach vendor
  if (data?.vendor_id) {
    const { data: vd } = await _sb.from('vendors').select('id, full_name').eq('id', data.vendor_id).maybeSingle()
    data.vendors = vd || null
  }
  return data
}

async function closeVendorClientAssignment(id, { validTo, changedBy, reason }) {
  const { data, error } = await _sb
    .from('vendor_client_assignments')
    .update({ valid_to: validTo, changed_by: changedBy, reason: reason || null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── customers ────────────────────────────────────────────────
// Requires: migrations/add-product-plans.sql applied

async function searchCustomers(emailQuery) {
  const { data, error } = await _sb
    .from('customers')
    .select('*')
    .ilike('email', `%${emailQuery}%`)
    .order('email')
    .limit(10)
  if (error) throw error
  return data
}

async function getCustomerByEmail(email) {
  const { data, error } = await _sb
    .from('customers')
    .select('*')
    .eq('email', email)
    .maybeSingle()
  if (error) throw error
  return data
}

async function createCustomer(customerData) {
  const { data, error } = await _sb
    .from('customers')
    .insert(customerData)
    .select()
    .single()
  if (error) throw error
  return data
}

async function getClientByCustomerId(customerId) {
  const { data, error } = await _sb
    .from('clients')
    .select('id')
    .eq('customer_id_fk', customerId)
    .maybeSingle()
  if (error) throw error
  return data?.id || null
}

async function updateCustomer(id, fields) {
  const { data, error } = await _sb
    .from('customers')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── product_plans ────────────────────────────────────────────

/**
 * Get plans for a product, optionally filtered/sorted by customer country.
 * Returns plans in priority order — default plan first, then country-matching plans.
 * @param {string} productId
 * @param {string|null} customerCountry - ISO country code ('IL', 'US', 'EU') or null
 */
async function getProductPlans(productId, customerCountry = null) {
  const { data, error } = await _sb
    .from('product_plans')
    .select('*')
    .eq('product_id', productId)
    .eq('active', true)
    .order('priority', { ascending: true })
  if (error) throw error

  // Sort: exact country match first, then default (null), then other countries
  return (data || []).sort((a, b) => {
    const aMatch = a.target_customer_country === customerCountry ? 0
      : a.target_customer_country === null ? 1 : 2
    const bMatch = b.target_customer_country === customerCountry ? 0
      : b.target_customer_country === null ? 1 : 2
    if (aMatch !== bMatch) return aMatch - bMatch
    return a.priority - b.priority
  })
}

async function getAllProductPlans(productId) {
  const { data, error } = await _sb
    .from('product_plans')
    .select('*')
    .eq('product_id', productId)
    .order('priority', { ascending: true })
  if (error) throw error
  return data || []
}

async function getPlanById(planId) {
  const { data, error } = await _sb
    .from('product_plans')
    .select('*, vendors(id, full_name, payout_currency), products(id, name, type)')
    .eq('id', planId)
    .single()
  if (error) throw error
  return data
}

async function createProductPlan(fields) {
  const { data, error } = await _sb
    .from('product_plans')
    .insert(fields)
    .select()
    .single()
  if (error) throw error
  return data
}

async function updateProductPlan(id, fields) {
  const { data, error } = await _sb
    .from('product_plans')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

async function deleteProductPlan(id) {
  const { error } = await _sb.from('product_plans').delete().eq('id', id)
  if (error) throw error
}

// ─── createDealWithPlan ───────────────────────────────────────
// Creates a deal linked to a product plan. Copies payment_link and
// vendor from the plan as defaults (can be overridden).

async function createDealWithPlan({ planId, clientId, overrides = {} }) {
  const plan = await getPlanById(planId)
  if (!plan) throw new Error(`Plan ${planId} not found`)

  const fields = {
    client_id:          clientId,
    product_id:         plan.product_id,
    product_plan_id:    plan.id,
    primary_vendor_id:  plan.vendor_id || null,
    price:              plan.price,
    currency:           plan.currency,
    payment_link:       plan.collection_gateway_link || null,
    payment_status:     'pending',
    sales_status:       'lead',
    billing_status:     'pending',
    origin:             'manual',
    ...overrides,
  }

  const { data, error } = await _sb
    .from('deals')
    .insert(fields)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── registry: companies ──────────────────────────────────────

async function getCompanies() {
  const { data, error } = await _sb.from('companies').select('*').order('name')
  if (error) throw error
  return data
}

async function updateCompanyField(id, field, value) {
  const { data, error } = await _sb
    .from('companies').update({ [field]: value }).eq('id', id).select().single()
  if (error) throw error
  return data
}

async function createCompany(fields) {
  const { data, error } = await _sb.from('companies').insert(fields).select().single()
  if (error) throw error
  return data
}

async function deleteCompany(id) {
  const { error } = await _sb.from('companies').delete().eq('id', id)
  if (error) throw error
}

// ─── registry: accounts ───────────────────────────────────────

async function getAccounts() {
  const { data, error } = await _sb
    .from('accounts')
    .select('id, name, provider, currency, account_type, company_id, is_active')
    .order('name')
  if (error) throw error
  return data
}

async function updateAccountField(id, field, value) {
  const { data, error } = await _sb
    .from('accounts').update({ [field]: value }).eq('id', id).select().single()
  if (error) throw error
  return data
}

async function createAccount(fields) {
  const { data, error } = await _sb.from('accounts').insert(fields).select().single()
  if (error) throw error
  return data
}

async function deleteAccount(id) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ''))) {
    const { data: refs, error: refsErr } = await _sb
      .from('account_balances')
      .select('id')
      .eq('account_id', id)
      .limit(1)
    if (refsErr) throw refsErr
    if (refs && refs.length > 0) throw new Error('Cannot delete — account has balance records')
  }
  const { error } = await _sb.from('accounts').delete().eq('id', id)
  if (error) throw error
}

// ─── transactions ─────────────────────────────────────────────

async function getTransactions({ includeDeleted = false } = {}) {
  const baseSelect = 'id, transaction_date, counterparty_name, source, account_id, ' +
    'account:accounts(id, name, provider, company_id), direction, amount, currency, ' +
    'status, event_type, category_id, tax_treatment, entity, tags, payment_cadence, ' +
    'reference, external_id, exchange_rate, amount_ils, settled_date, ' +
    'deleted_at, duplicate_of, vendor_id, raw_data'
  const selectWithLinkedEntity = baseSelect + ', linked_entity_type, linked_entity_id'

  async function runSelect(selectText) {
    let query = _sb
      .from('transactions')
      .select(selectText)
      .order('transaction_date', { ascending: false })
    if (!includeDeleted) query = query.is('deleted_at', null)
    return query
  }

  let { data, error } = await runSelect(selectWithLinkedEntity)
  if (error) {
    const msg = String(error.message || '')
    const missingLinkedCols =
      msg.includes("Could not find the 'linked_entity_type' column") ||
      msg.includes("Could not find the 'linked_entity_id' column")
    if (missingLinkedCols) {
      const fallback = await runSelect(baseSelect)
      data = fallback.data
      error = fallback.error
    }
  }
  if (error) throw error
  return data || []
}

// ─── registry: exchange_rates ─────────────────────────────────

async function getExchangeRates() {
  const { data, error } = await _sb
    .from('exchange_rates')
    .select('*')
    .order('month', { ascending: false })
  if (error) throw error
  return data
}

async function updateExchangeRateField(id, field, value) {
  const { data, error } = await _sb
    .from('exchange_rates').update({ [field]: value }).eq('id', id).select().single()
  if (error) throw error
  return data
}

async function createExchangeRate(fields) {
  const { data, error } = await _sb.from('exchange_rates').insert(fields).select().single()
  if (error) throw error
  return data
}

async function deleteExchangeRate(id) {
  const { error } = await _sb.from('exchange_rates').delete().eq('id', id)
  if (error) throw error
}

// ─── registry: account_balances (monthly snapshots) ──────────

async function getAccountBalances(accountId, year) {
  let q = _sb
    .from('account_balances')
    .select('*')
    .order('month', { ascending: false })
  if (accountId) q = q.eq('account_id', accountId)
  if (year) {
    const from = `${year}-01-01`
    const to   = `${year}-12-31`
    q = q.gte('month', from).lte('month', to)
  }
  const { data, error } = await q
  if (error) {
    // Old schema (pre-migration-006) has 'date' not 'month' — return empty rather than crash
    const msg = String(error.message || '')
    if (msg.includes('account_balances.month') || msg.includes('column') && msg.includes('does not exist')) {
      console.warn('[account_balances] Schema not migrated yet — run migration 006. Returning empty.')
      return []
    }
    throw error
  }
  return data
}

async function upsertAccountBalance({ account_id, month, opening_balance, closing_balance, currency, notes }) {
  const { data, error } = await _sb
    .from('account_balances')
    .upsert(
      { account_id, month, opening_balance, closing_balance, currency, notes },
      { onConflict: 'account_id,month' }
    )
    .select()
    .single()
  if (error) {
    const msg = String(error.message || '')
    if (msg.includes('account_balances.month') || (msg.includes('column') && msg.includes('does not exist'))) {
      throw new Error('DB schema not migrated — run migrations/006_account_balances_monthly_snapshots.sql on this database first.')
    }
    throw error
  }
  return data
}

async function deleteAccountBalance(id) {
  const { error } = await _sb.from('account_balances').delete().eq('id', id)
  if (error) throw error
}

async function getTransactionSumByAccountMonth(accountId, month) {
  // month: 'YYYY-MM-DD' (first day of month)
  const monthStart = month
  const d = new Date(month)
  d.setMonth(d.getMonth() + 1)
  const monthEnd = d.toISOString().slice(0, 10)

  const { data, error } = await _sb
    .from('transactions')
    .select('direction, amount, account:accounts(id, name, provider, company_id)')
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .gte('transaction_date', monthStart)
    .lt('transaction_date', monthEnd)
  if (error) throw error

  let total_in = 0, total_out = 0
  for (const tx of data || []) {
    if (tx.direction === 'in')  total_in  += Number(tx.amount || 0)
    if (tx.direction === 'out') total_out += Number(tx.amount || 0)
  }
  return { total_in, total_out, net: total_in - total_out }
}

// ─── registry: system_settings ───────────────────────────────

async function getSystemSettings() {
  const { data, error } = await _sb
    .from('system_settings').select('*').order('key')
  if (error) throw error
  return data
}

async function updateSystemSetting(key, value) {
  const { data, error } = await _sb
    .from('system_settings')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('key', key).select().single()
  if (error) throw error
  return data
}

// ─── registry: transaction_categories ────────────────────────

async function getTransactionCategories() {
  const { data, error } = await _sb
    .from('transaction_categories')
    .select('*')
    .order('name')
  if (error) throw error
  return data || []
}

async function updateTransactionCategoryField(id, field, value) {
  const { data, error } = await _sb
    .from('transaction_categories')
    .update({ [field]: value })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

async function createTransactionCategory(fields) {
  const { data, error } = await _sb
    .from('transaction_categories')
    .insert(fields)
    .select()
    .single()
  if (error) throw error
  return data
}

async function deleteTransactionCategory(id) {
  const [{ data: txRefs, error: txErr }, { data: vendorRefs, error: vendorErr }] = await Promise.all([
    _sb.from('transactions').select('id').eq('category_id', id).is('deleted_at', null).limit(1),
    _sb.from('vendors').select('id').eq('category_id', id).limit(1),
  ])
  if (txErr) throw txErr
  if (vendorErr) throw vendorErr
  if ((txRefs && txRefs.length) || (vendorRefs && vendorRefs.length)) {
    throw new Error('Cannot delete — category is used by transactions or vendors')
  }

  const { error } = await _sb.from('transaction_categories').delete().eq('id', id)
  if (error) throw error
}

// ─── registry: transaction_tags ───────────────────────────────

function _isMissingTableError(error, tableName) {
  if (!error) return false
  // PostgREST schema-cache miss (table not in schema cache)
  if (error.code === 'PGRST205') return true
  // HTTP 404 from PostgREST when table doesn't exist at all
  if (error.code === '42P01') return true
  if (error.status === 404 || error.statusCode === 404) return true
  const msg = String(error.message || '')
  if (msg.includes(`public.${tableName}`)) return true
  if (msg.includes('relation') && msg.includes('does not exist')) return true
  return false
}

async function getTransactionTags() {
  const { data, error } = await _sb
    .from('transaction_tags')
    .select('*')
    .order('name')
  if (error) {
    // Backward compatibility: table may not exist before migration.
    if (_isMissingTableError(error, 'transaction_tags')) return []
    throw error
  }
  return data || []
}

// _replaceTagInTableRows — uses rename_tag() RPC (migration 013_rename_tag_rpc.sql)
// Single Postgres call updates both transactions and vendors in one round-trip.
async function _replaceTagInAllTables(oldTag, newTag) {
  const { error } = await _sb.rpc('rename_tag', { old_tag: oldTag, new_tag: newTag })
  if (error) {
    // Graceful degradation if RPC not yet deployed: fall back to row-by-row
    if (error.code === 'PGRST202' || String(error.message || '').includes('rename_tag')) {
      console.warn('[db] rename_tag RPC not found — run migrations/013_rename_tag_rpc.sql. Falling back to row-by-row update.')
      for (const tableName of ['transactions', 'vendors']) {
        const { data, err2 } = await _sb.from(tableName).select('id, tags').contains('tags', [oldTag])
        if (err2) throw err2
        for (const row of data || []) {
          const tags    = Array.isArray(row.tags) ? row.tags : []
          const next    = [...new Set(tags.map(t => t === oldTag ? newTag : t).filter(Boolean))]
          const { error: upErr } = await _sb.from(tableName).update({ tags: next }).eq('id', row.id)
          if (upErr) throw upErr
        }
      }
      return
    }
    throw error
  }
}

async function updateTransactionTagField(id, field, value) {
  if (field !== 'name') {
    const { data, error } = await _sb
      .from('transaction_tags')
      .update({ [field]: value })
      .eq('id', id)
      .select()
      .single()
    if (error) {
      if (_isMissingTableError(error, 'transaction_tags')) throw new Error('Missing table: transaction_tags. Run migration 005_transaction_tags.sql')
      throw error
    }
    return data
  }

  const { data: current, error: curErr } = await _sb
    .from('transaction_tags')
    .select('id, name')
    .eq('id', id)
    .single()
  if (curErr) {
    if (_isMissingTableError(curErr, 'transaction_tags')) throw new Error('Missing table: transaction_tags. Run migration 005_transaction_tags.sql')
    throw curErr
  }

  const { data, error } = await _sb
    .from('transaction_tags')
    .update({ name: value })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  const oldName = current?.name
  const newName = data?.name
  if (oldName && newName && oldName !== newName) {
    await _replaceTagInAllTables(oldName, newName)
  }
  return data
}

async function createTransactionTag(fields) {
  const { data, error } = await _sb
    .from('transaction_tags')
    .insert(fields)
    .select()
    .single()
  if (error) {
    if (_isMissingTableError(error, 'transaction_tags')) throw new Error('Missing table: transaction_tags. Run migration 005_transaction_tags.sql')
    throw error
  }
  return data
}

async function deleteTransactionTag(id) {
  const { data: tag, error: tagErr } = await _sb
    .from('transaction_tags')
    .select('id, name')
    .eq('id', id)
    .single()
  if (tagErr) {
    if (_isMissingTableError(tagErr, 'transaction_tags')) throw new Error('Missing table: transaction_tags. Run migration 005_transaction_tags.sql')
    throw tagErr
  }

  const tagName = tag?.name
  if (tagName) {
    const [{ data: txRefs, error: txErr }, { data: vendorRefs, error: vendorErr }] = await Promise.all([
      _sb.from('transactions').select('id').contains('tags', [tagName]).is('deleted_at', null).limit(1),
      _sb.from('vendors').select('id').contains('tags', [tagName]).limit(1),
    ])
    if (txErr) throw txErr
    if (vendorErr) throw vendorErr
    if ((txRefs && txRefs.length) || (vendorRefs && vendorRefs.length)) {
      throw new Error('Cannot delete — tag is used by transactions or vendors')
    }
  }

  const { error } = await _sb.from('transaction_tags').delete().eq('id', id)
  if (error) throw error
}

// ─── profiles (role foundation — Phase 2 auth) ───────────────
// In demo mode these functions are stubs (no logged-in user).
// Phase 2: called on Google OAuth login to get real role + vendor_id.

async function getProfile(userId) {
  if (!userId) return null
  const { data, error } = await _sb
    .from('profiles')
    .select('id, role, vendor_id, full_name, email')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function upsertProfile(fields) {
  // fields: { id, role, vendor_id, full_name, email }
  const { data, error } = await _sb
    .from('profiles')
    .upsert({ ...fields, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

// Phase 2 hook: call this after Google OAuth resolves to get real role.
// In demo mode, returns null (role stays as sessionStorage value).
async function getRoleFromDB() {
  // Placeholder — getCurrentUser() will be wired from Supabase Auth in Phase 2.
  // When auth is live: const user = await getCurrentUser(); return getProfile(user?.id)
  return null
}

// ─── activities ───────────────────────────────────────────────

async function logActivity({ entity_type, entity_id, type, subtype, body,
  created_by, origin = 'system', due_at, status, meta = {} }) {
  const { data, error } = await _sb.from('activities').insert({
    entity_type, entity_id, type, subtype, body,
    created_by, origin, due_at, status, meta,
  }).select().single()
  if (error) throw error
  return data
}

async function getActivities({ type, status, search } = {}) {
  let q = _sb.from('activities').select('*').order('created_at', { ascending: false })
  if (type)   q = q.eq('type', type)
  if (status) q = q.eq('status', status)
  if (search) q = q.ilike('body', `%${search}%`)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

async function getClientReminders(clientId) {
  const { data, error } = await _sb
    .from('activities')
    .select('*')
    .eq('entity_type', 'client')
    .eq('entity_id', clientId)
    .eq('type', 'reminder')
    .order('due_at', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data || []
}

async function getNotifications() {
  const { data, error } = await _sb
    .from('activities')
    .select('*')
    .in('type', ['reminder', 'integration_event'])
    .or('status.eq.pending,origin.eq.integration')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data || []
}

async function updateActivity(id, fields) {
  const { data, error } = await _sb
    .from('activities')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
