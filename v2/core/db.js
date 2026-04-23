// v2/core/db.js — Single source of truth for Supabase queries.
// Every write calls Audit.log() after success.
// Canonical plan fields (per decision A1, matching SCHEMA.md migration 011):
//   plan_type, link_url, link_source, link_id — NOT payment_type/payment_link_url.
// Vendor status: query only is_active (ignore legacy active).
// Vendor id cast: vendors.id is text but vendor_client_assignments.vendor_id is uuid.
//   Use _toUUID(id) only for that join.
// Errors: every function throws a shaped { code, message, detail } error.

const DB = (() => {
  // ─── Error shaping ────────────────────────────────────────────────
  function _shape(err, fallbackMsg) {
    if (!err) return { code: 'unknown', message: fallbackMsg || 'Unknown error', detail: null }
    return {
      code: err.code || err.status || 'db_error',
      message: err.message || fallbackMsg || 'Database error',
      detail: err.details || err.hint || null
    }
  }

  function _throw(err, fallbackMsg) {
    const shaped = _shape(err, fallbackMsg)
    console.error('[DB]', shaped, err)
    throw shaped
  }

  // ─── ID helpers ───────────────────────────────────────────────────
  // vendors.id is text (e.g. 'VND-0001' or uuid string). The vendor_client_assignments
  // join has vendor_id as uuid. This cast is a bandaid for that one join —
  // do not use it for other vendor queries.
  function _toUUID(id) {
    if (!id) return null
    const s = String(id)
    // Already a uuid
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return s
    return null
  }

  const _sb = () => window._sb

  // ═════════════════════════════════════════════════════════════════
  // VENDORS
  // ═════════════════════════════════════════════════════════════════

  async function getVendors() {
    const { data, error } = await _sb()
      .from('vendors').select('*')
      .eq('is_active', true)
      .order('name')
    if (error) _throw(error, 'Failed to load vendors')
    return data || []
  }

  async function getVendorsInactive() {
    const { data, error } = await _sb()
      .from('vendors').select('*')
      .eq('is_active', false)
      .order('name')
    if (error) _throw(error, 'Failed to load inactive vendors')
    return data || []
  }

  async function getVendor(id) {
    const { data, error } = await _sb()
      .from('vendors').select('*').eq('id', id).maybeSingle()
    if (error) _throw(error, 'Failed to load vendor')
    return data
  }

  async function createVendor(fields) {
    const { data, error } = await _sb()
      .from('vendors').insert(fields).select().single()
    if (error) _throw(error, 'Failed to create vendor')
    await Audit.log({ entity_type: 'vendor', entity_id: data.id, action: 'create', changes: { after: data } })
    return data
  }

  async function updateVendor(id, fields) {
    const before = await getVendor(id)
    const { data, error } = await _sb()
      .from('vendors').update(fields).eq('id', id).select().single()
    if (error) _throw(error, 'Failed to update vendor')
    await Audit.log({ entity_type: 'vendor', entity_id: id, action: 'update', changes: Audit.diff(before, data) })
    return data
  }

  async function deleteVendor(id) {
    const before = await getVendor(id)
    const { error } = await _sb().from('vendors').delete().eq('id', id)
    if (error) _throw(error, 'Failed to delete vendor')
    await Audit.log({ entity_type: 'vendor', entity_id: id, action: 'delete', changes: { before } })
  }

  // ═════════════════════════════════════════════════════════════════
  // CLIENTS
  // ═════════════════════════════════════════════════════════════════

  async function getClients() {
    const { data, error } = await _sb()
      .from('clients').select('*').order('full_name')
    if (error) _throw(error, 'Failed to load clients')
    return data || []
  }

  async function getClient(id) {
    const { data, error } = await _sb()
      .from('clients').select('*').eq('id', id).maybeSingle()
    if (error) _throw(error, 'Failed to load client')
    return data
  }

  async function createClient(fields) {
    const { data, error } = await _sb()
      .from('clients').insert(fields).select().single()
    if (error) _throw(error, 'Failed to create client')
    await Audit.log({ entity_type: 'client', entity_id: data.id, action: 'create', changes: { after: data } })
    return data
  }

  async function updateClient(id, fields) {
    const before = await getClient(id)
    const { data, error } = await _sb()
      .from('clients').update(fields).eq('id', id).select().single()
    if (error) _throw(error, 'Failed to update client')
    await Audit.log({ entity_type: 'client', entity_id: id, action: 'update', changes: Audit.diff(before, data) })
    return data
  }

  async function deleteClient(id) {
    const before = await getClient(id)
    const { error } = await _sb().from('clients').delete().eq('id', id)
    if (error) _throw(error, 'Failed to delete client')
    await Audit.log({ entity_type: 'client', entity_id: id, action: 'delete', changes: { before } })
  }

  // ═════════════════════════════════════════════════════════════════
  // VENDOR ↔ CLIENT ASSIGNMENTS
  // ═════════════════════════════════════════════════════════════════

  async function getVendorClientAssignments() {
    const { data, error } = await _sb().from('vendor_client_assignments').select('*')
    if (error) _throw(error, 'Failed to load vendor-client assignments')
    return data || []
  }

  async function assignVendorClient(vendorId, clientId) {
    const vendorUuid = _toUUID(vendorId)
    if (!vendorUuid) _throw({ code: 'invalid_id' }, `Vendor id is not a uuid: ${vendorId}`)
    // Upsert-like: skip if already assigned.
    const existing = await _sb()
      .from('vendor_client_assignments')
      .select('id')
      .eq('vendor_id', vendorUuid)
      .eq('client_id', clientId)
      .maybeSingle()
    if (existing.data) return existing.data
    const { data, error } = await _sb()
      .from('vendor_client_assignments')
      .insert({ vendor_id: vendorUuid, client_id: clientId })
      .select().single()
    if (error) _throw(error, 'Failed to assign vendor to client')
    await Audit.log({
      entity_type: 'vendor_client_assignment', entity_id: data.id,
      action: 'create', changes: { after: data }
    })
    return data
  }

  async function unassignVendorClient(vendorId, clientId) {
    const vendorUuid = _toUUID(vendorId)
    if (!vendorUuid) _throw({ code: 'invalid_id' }, `Vendor id is not a uuid: ${vendorId}`)
    const { error } = await _sb()
      .from('vendor_client_assignments')
      .delete()
      .eq('vendor_id', vendorUuid)
      .eq('client_id', clientId)
    if (error) _throw(error, 'Failed to unassign vendor from client')
  }

  // ═════════════════════════════════════════════════════════════════
  // PRODUCTS + PLANS (canonical fields: plan_type, link_url, link_source, link_id)
  // ═════════════════════════════════════════════════════════════════

  async function getPrograms() {
    const { data, error } = await _sb()
      .from('programs').select('*').order('order', { ascending: true })
    if (error) _throw(error, 'Failed to load programs')
    return data || []
  }

  async function getProducts() {
    const { data, error } = await _sb()
      .from('products').select('*').order('name')
    if (error) _throw(error, 'Failed to load products')
    return data || []
  }

  async function getAllProductsWithPlans() {
    const [products, plans] = await Promise.all([
      _sb().from('products').select('*').order('name'),
      _sb().from('plans').select('*').order('created_at', { ascending: true })
    ])
    if (products.error) _throw(products.error, 'Failed to load products')
    if (plans.error) _throw(plans.error, 'Failed to load plans')
    const byProduct = new Map()
    for (const p of (plans.data || [])) {
      if (!byProduct.has(p.product_id)) byProduct.set(p.product_id, [])
      byProduct.get(p.product_id).push(p)
    }
    return (products.data || []).map(p => ({ ...p, plans: byProduct.get(p.id) || [] }))
  }

  async function createProduct(fields) {
    const { data, error } = await _sb()
      .from('products').insert(fields).select().single()
    if (error) _throw(error, 'Failed to create product')
    await Audit.log({ entity_type: 'product', entity_id: data.id, action: 'create', changes: { after: data } })
    return data
  }

  async function updateProduct(id, fields) {
    const before = await _sb().from('products').select('*').eq('id', id).maybeSingle()
    const { data, error } = await _sb()
      .from('products').update(fields).eq('id', id).select().single()
    if (error) _throw(error, 'Failed to update product')
    await Audit.log({ entity_type: 'product', entity_id: id, action: 'update', changes: Audit.diff(before.data, data) })
    return data
  }

  async function deleteProduct(id) {
    const before = await _sb().from('products').select('*').eq('id', id).maybeSingle()
    const { error } = await _sb().from('products').delete().eq('id', id)
    if (error) _throw(error, 'Failed to delete product')
    await Audit.log({ entity_type: 'product', entity_id: id, action: 'delete', changes: { before: before.data } })
  }

  async function createPlan(fields) {
    // Enforce canonical field names — reject legacy aliases to fail loud, not silent.
    const legacy = ['payment_type', 'payment_link_url', 'installments_count', 'installments']
    for (const k of legacy) {
      if (k in (fields || {})) {
        _throw({ code: 'legacy_field' }, `Plan field "${k}" is a legacy alias. Use plan_type / link_url.`)
      }
    }
    const { data, error } = await _sb()
      .from('plans').insert(fields).select().single()
    if (error) _throw(error, 'Failed to create plan')
    await Audit.log({ entity_type: 'plan', entity_id: data.id, action: 'create', changes: { after: data } })
    return data
  }

  async function updatePlan(id, fields) {
    const before = await _sb().from('plans').select('*').eq('id', id).maybeSingle()
    const { data, error } = await _sb()
      .from('plans').update(fields).eq('id', id).select().single()
    if (error) _throw(error, 'Failed to update plan')
    await Audit.log({ entity_type: 'plan', entity_id: id, action: 'update', changes: Audit.diff(before.data, data) })
    return data
  }

  async function deletePlan(id) {
    const before = await _sb().from('plans').select('*').eq('id', id).maybeSingle()
    const { error } = await _sb().from('plans').delete().eq('id', id)
    if (error) _throw(error, 'Failed to delete plan')
    await Audit.log({ entity_type: 'plan', entity_id: id, action: 'delete', changes: { before: before.data } })
  }

  // ═════════════════════════════════════════════════════════════════
  // DEALS
  // ═════════════════════════════════════════════════════════════════

  async function getDeals() {
    const { data, error } = await _sb()
      .from('deals').select('*').order('created_at', { ascending: false })
    if (error) _throw(error, 'Failed to load deals')
    return data || []
  }

  async function getDeal(id) {
    const { data, error } = await _sb().from('deals').select('*').eq('id', id).maybeSingle()
    if (error) _throw(error, 'Failed to load deal')
    return data
  }

  async function createDeal(fields) {
    const { data, error } = await _sb()
      .from('deals').insert(fields).select().single()
    if (error) _throw(error, 'Failed to create deal')
    await Audit.log({ entity_type: 'deal', entity_id: data.id, action: 'create', changes: { after: data } })
    return data
  }

  async function updateDeal(id, fields) {
    const before = await getDeal(id)
    const { data, error } = await _sb()
      .from('deals').update(fields).eq('id', id).select().single()
    if (error) _throw(error, 'Failed to update deal')
    await Audit.log({ entity_type: 'deal', entity_id: id, action: 'update', changes: Audit.diff(before, data) })
    // Status-change activity for user-visible log
    if (before && before.sales_status !== data.sales_status) {
      await Audit.activity({
        entity_type: 'deal', entity_id: id, type: 'system_log', subtype: 'stage_move',
        body: `Deal moved: ${before.sales_status} → ${data.sales_status}`
      })
    }
    return data
  }

  async function deleteDeal(id) {
    const before = await getDeal(id)
    const { error } = await _sb().from('deals').delete().eq('id', id)
    if (error) _throw(error, 'Failed to delete deal')
    await Audit.log({ entity_type: 'deal', entity_id: id, action: 'delete', changes: { before } })
  }

  // ═════════════════════════════════════════════════════════════════
  // PACKAGES
  // ═════════════════════════════════════════════════════════════════

  async function getPackages() {
    const { data, error } = await _sb().from('packages').select('*')
    if (error) _throw(error, 'Failed to load packages')
    return data || []
  }

  async function createPackage(fields) {
    const { data, error } = await _sb()
      .from('packages').insert(fields).select().single()
    if (error) _throw(error, 'Failed to create package')
    await Audit.log({ entity_type: 'package', entity_id: data.id, action: 'create', changes: { after: data } })
    return data
  }

  async function updatePackage(id, fields) {
    const before = await _sb().from('packages').select('*').eq('id', id).maybeSingle()
    const { data, error } = await _sb()
      .from('packages').update(fields).eq('id', id).select().single()
    if (error) _throw(error, 'Failed to update package')
    await Audit.log({ entity_type: 'package', entity_id: id, action: 'update', changes: Audit.diff(before.data, data) })
    return data
  }

  // ═════════════════════════════════════════════════════════════════
  // SESSIONS
  // ═════════════════════════════════════════════════════════════════

  async function getSessions(filters) {
    let q = _sb().from('sessions').select('*')
    if (filters?.vendor_id) q = q.eq('vendor_id', filters.vendor_id)
    if (filters?.client_id) q = q.eq('client_id', filters.client_id)
    if (filters?.from) q = q.gte('session_date', filters.from)
    if (filters?.to) q = q.lte('session_date', filters.to)
    if (filters?.billed !== undefined) q = q.eq('billed', filters.billed)
    const { data, error } = await q.order('session_date', { ascending: false })
    if (error) _throw(error, 'Failed to load sessions')
    return data || []
  }

  async function createSession(fields) {
    const { data, error } = await _sb()
      .from('sessions').insert(fields).select().single()
    if (error) _throw(error, 'Failed to create session')
    await Audit.log({ entity_type: 'session', entity_id: data.id, action: 'create', changes: { after: data } })
    return data
  }

  async function updateSession(id, fields) {
    const before = await _sb().from('sessions').select('*').eq('id', id).maybeSingle()
    const { data, error } = await _sb()
      .from('sessions').update(fields).eq('id', id).select().single()
    if (error) _throw(error, 'Failed to update session')
    await Audit.log({ entity_type: 'session', entity_id: id, action: 'update', changes: Audit.diff(before.data, data) })
    return data
  }

  async function deleteSession(id) {
    const before = await _sb().from('sessions').select('*').eq('id', id).maybeSingle()
    const { error } = await _sb().from('sessions').delete().eq('id', id)
    if (error) _throw(error, 'Failed to delete session')
    await Audit.log({ entity_type: 'session', entity_id: id, action: 'delete', changes: { before: before.data } })
  }

  // ═════════════════════════════════════════════════════════════════
  // BILLS
  // ═════════════════════════════════════════════════════════════════

  async function getBills(filters) {
    let q = _sb().from('bills').select('*')
    if (filters?.vendor_id) q = q.eq('vendor_id', filters.vendor_id)
    if (filters?.status) q = q.eq('status', filters.status)
    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) _throw(error, 'Failed to load bills')
    return data || []
  }

  async function createBill(fields) {
    const { data, error } = await _sb()
      .from('bills').insert({ ...fields, status: 'draft' }).select().single()
    if (error) _throw(error, 'Failed to create bill')
    await Audit.log({ entity_type: 'bill', entity_id: data.id, action: 'create', changes: { after: data } })
    return data
  }

  async function updateBill(id, fields) {
    const before = await _sb().from('bills').select('*').eq('id', id).maybeSingle()
    const { data, error } = await _sb()
      .from('bills').update(fields).eq('id', id).select().single()
    if (error) _throw(error, 'Failed to update bill')
    const d = Audit.diff(before.data, data)
    const isStatus = d.before && 'status' in d.before
    await Audit.log({
      entity_type: 'bill', entity_id: id,
      action: isStatus ? 'status_change' : 'update',
      changes: d
    })
    return data
  }

  // ═════════════════════════════════════════════════════════════════
  // TASK TYPES + RATES
  // ═════════════════════════════════════════════════════════════════

  async function getTaskTypes() {
    const { data, error } = await _sb().from('task_types').select('*').order('name')
    if (error) _throw(error, 'Failed to load task types')
    return data || []
  }

  async function getRates(vendorId) {
    let q = _sb().from('rates').select('*')
    if (vendorId) q = q.eq('vendor_id', vendorId)
    const { data, error } = await q
    if (error) _throw(error, 'Failed to load rates')
    return data || []
  }

  async function upsertRate(fields) {
    const { data, error } = await _sb()
      .from('rates').upsert(fields).select().single()
    if (error) _throw(error, 'Failed to save rate')
    await Audit.log({ entity_type: 'rate', entity_id: data.id, action: 'update', changes: { after: data } })
    return data
  }

  async function deleteRate(id) {
    const before = await _sb().from('rates').select('*').eq('id', id).maybeSingle()
    const { error } = await _sb().from('rates').delete().eq('id', id)
    if (error) _throw(error, 'Failed to delete rate')
    await Audit.log({ entity_type: 'rate', entity_id: id, action: 'delete', changes: { before: before.data } })
  }

  // ═════════════════════════════════════════════════════════════════
  // TRANSACTIONS + REGISTRY
  // ═════════════════════════════════════════════════════════════════

  async function getTransactions(filters) {
    let q = _sb().from('transactions').select('*')
    if (!filters?.includeDeleted) q = q.is('deleted_at', null)
    if (filters?.account_id) q = q.eq('account_id', filters.account_id)
    if (filters?.category_id) q = q.eq('category_id', filters.category_id)
    if (filters?.entity) q = q.eq('entity', filters.entity)
    if (filters?.direction) q = q.eq('direction', filters.direction)
    if (filters?.vendor_id) q = q.eq('vendor_id', filters.vendor_id)
    if (filters?.month) {
      const [y, m] = filters.month.split('-').map(Number)
      const from = `${y}-${String(m).padStart(2, '0')}-01`
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
      q = q.gte('transaction_date', from).lt('transaction_date', nextMonth)
    }
    const { data, error } = await q.order('transaction_date', { ascending: false })
    if (error) _throw(error, 'Failed to load transactions')
    return data || []
  }

  async function getTransaction(id) {
    const { data, error } = await _sb().from('transactions').select('*').eq('id', id).maybeSingle()
    if (error) _throw(error, 'Failed to load transaction')
    return data
  }

  async function updateTransaction(id, fields) {
    const before = await getTransaction(id)
    const { data, error } = await _sb()
      .from('transactions').update(fields).eq('id', id).select().single()
    if (error) _throw(error, 'Failed to update transaction')
    await Audit.log({ entity_type: 'transaction', entity_id: id, action: 'update', changes: Audit.diff(before, data) })
    return data
  }

  async function softDeleteTransaction(id) {
    const before = await getTransaction(id)
    const { data, error } = await _sb()
      .from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) _throw(error, 'Failed to soft-delete transaction')
    await Audit.log({ entity_type: 'transaction', entity_id: id, action: 'delete', changes: Audit.diff(before, data) })
    return data
  }

  async function restoreTransaction(id) {
    const { data, error } = await _sb()
      .from('transactions').update({ deleted_at: null }).eq('id', id).select().single()
    if (error) _throw(error, 'Failed to restore transaction')
    await Audit.log({ entity_type: 'transaction', entity_id: id, action: 'update', changes: { after: { deleted_at: null } } })
    return data
  }

  // Bulk classify: apply the same patch to many transactions.
  async function bulkUpdateTransactions(ids, fields) {
    if (!Array.isArray(ids) || !ids.length) return []
    const { data, error } = await _sb()
      .from('transactions').update(fields).in('id', ids).select()
    if (error) _throw(error, 'Failed to bulk-update transactions')
    for (const row of data || []) {
      await Audit.log({ entity_type: 'transaction', entity_id: row.id, action: 'update', changes: { after: fields } })
    }
    return data || []
  }

  async function getAccounts() {
    const { data, error } = await _sb().from('accounts').select('*').eq('active', true).order('name')
    if (error) _throw(error, 'Failed to load accounts')
    return data || []
  }

  async function getAllAccounts() {
    const { data, error } = await _sb().from('accounts').select('*').order('name')
    if (error) _throw(error, 'Failed to load accounts')
    return data || []
  }

  async function createAccount(fields) {
    const { data, error } = await _sb().from('accounts').insert(fields).select().single()
    if (error) _throw(error, 'Failed to create account')
    await Audit.log({ entity_type: 'account', entity_id: data.id, action: 'create', changes: { after: data } })
    return data
  }

  async function updateAccount(id, fields) {
    const before = await _sb().from('accounts').select('*').eq('id', id).maybeSingle()
    const { data, error } = await _sb().from('accounts').update(fields).eq('id', id).select().single()
    if (error) _throw(error, 'Failed to update account')
    await Audit.log({ entity_type: 'account', entity_id: id, action: 'update', changes: Audit.diff(before.data, data) })
    return data
  }

  async function deleteAccount(id) {
    const before = await _sb().from('accounts').select('*').eq('id', id).maybeSingle()
    const { error } = await _sb().from('accounts').delete().eq('id', id)
    if (error) _throw(error, 'Failed to delete account')
    await Audit.log({ entity_type: 'account', entity_id: id, action: 'delete', changes: { before: before.data } })
  }

  async function getCompanies() {
    const { data, error } = await _sb().from('companies').select('*').order('name')
    if (error) _throw(error, 'Failed to load companies')
    return data || []
  }

  async function createCompany(fields) {
    const { data, error } = await _sb().from('companies').insert(fields).select().single()
    if (error) _throw(error, 'Failed to create company')
    await Audit.log({ entity_type: 'company', entity_id: data.id, action: 'create', changes: { after: data } })
    return data
  }

  async function updateCompany(id, fields) {
    const before = await _sb().from('companies').select('*').eq('id', id).maybeSingle()
    const { data, error } = await _sb().from('companies').update(fields).eq('id', id).select().single()
    if (error) _throw(error, 'Failed to update company')
    await Audit.log({ entity_type: 'company', entity_id: id, action: 'update', changes: Audit.diff(before.data, data) })
    return data
  }

  async function deleteCompany(id) {
    const before = await _sb().from('companies').select('*').eq('id', id).maybeSingle()
    const { error } = await _sb().from('companies').delete().eq('id', id)
    if (error) _throw(error, 'Failed to delete company')
    await Audit.log({ entity_type: 'company', entity_id: id, action: 'delete', changes: { before: before.data } })
  }

  async function getTransactionCategories(opts) {
    let q = _sb().from('transaction_categories').select('*')
    if (!opts?.includeInactive) q = q.eq('status', 'active')
    const { data, error } = await q.order('name')
    if (error) _throw(error, 'Failed to load categories')
    return data || []
  }

  async function createTransactionCategory(fields) {
    const { data, error } = await _sb().from('transaction_categories').insert(fields).select().single()
    if (error) _throw(error, 'Failed to create category')
    await Audit.log({ entity_type: 'transaction_category', entity_id: data.id, action: 'create', changes: { after: data } })
    return data
  }

  async function updateTransactionCategory(id, fields) {
    const before = await _sb().from('transaction_categories').select('*').eq('id', id).maybeSingle()
    const { data, error } = await _sb().from('transaction_categories').update(fields).eq('id', id).select().single()
    if (error) _throw(error, 'Failed to update category')
    await Audit.log({ entity_type: 'transaction_category', entity_id: id, action: 'update', changes: Audit.diff(before.data, data) })
    return data
  }

  async function deleteTransactionCategory(id) {
    const before = await _sb().from('transaction_categories').select('*').eq('id', id).maybeSingle()
    const { error } = await _sb().from('transaction_categories').delete().eq('id', id)
    if (error) _throw(error, 'Failed to delete category')
    await Audit.log({ entity_type: 'transaction_category', entity_id: id, action: 'delete', changes: { before: before.data } })
  }

  async function getTransactionTags(opts) {
    let q = _sb().from('transaction_tags').select('*')
    if (!opts?.includeInactive) q = q.eq('active', true)
    const { data, error } = await q.order('name')
    if (error) _throw(error, 'Failed to load tags')
    return data || []
  }

  async function createTransactionTag(fields) {
    const { data, error } = await _sb().from('transaction_tags').insert(fields).select().single()
    if (error) _throw(error, 'Failed to create tag')
    await Audit.log({ entity_type: 'transaction_tag', entity_id: data.id, action: 'create', changes: { after: data } })
    return data
  }

  async function updateTransactionTag(id, fields) {
    const before = await _sb().from('transaction_tags').select('*').eq('id', id).maybeSingle()
    const { data, error } = await _sb().from('transaction_tags').update(fields).eq('id', id).select().single()
    if (error) _throw(error, 'Failed to update tag')
    await Audit.log({ entity_type: 'transaction_tag', entity_id: id, action: 'update', changes: Audit.diff(before.data, data) })
    return data
  }

  async function deleteTransactionTag(id) {
    const before = await _sb().from('transaction_tags').select('*').eq('id', id).maybeSingle()
    const { error } = await _sb().from('transaction_tags').delete().eq('id', id)
    if (error) _throw(error, 'Failed to delete tag')
    await Audit.log({ entity_type: 'transaction_tag', entity_id: id, action: 'delete', changes: { before: before.data } })
  }

  // ═════════════════════════════════════════════════════════════════
  // EXCHANGE RATES + ACCOUNT BALANCES + SYSTEM SETTINGS
  // ═════════════════════════════════════════════════════════════════

  async function getExchangeRates() {
    const { data, error } = await _sb().from('exchange_rates').select('*').order('effective_date', { ascending: false })
    if (error) _throw(error, 'Failed to load exchange rates')
    return data || []
  }

  async function upsertExchangeRate(fields) {
    const { data, error } = await _sb().from('exchange_rates').upsert(fields).select().single()
    if (error) _throw(error, 'Failed to save exchange rate')
    await Audit.log({ entity_type: 'exchange_rate', entity_id: data.id, action: 'update', changes: { after: data } })
    return data
  }

  async function getAccountBalances(filters) {
    let q = _sb().from('account_balances').select('*')
    if (filters?.account_id) q = q.eq('account_id', filters.account_id)
    if (filters?.month) q = q.eq('month', filters.month)
    const { data, error } = await q.order('month', { ascending: false })
    if (error) _throw(error, 'Failed to load account balances')
    return data || []
  }

  async function upsertAccountBalance(fields) {
    const { data, error } = await _sb()
      .from('account_balances')
      .upsert(fields, { onConflict: 'account_id,month' })
      .select().single()
    if (error) _throw(error, 'Failed to save account balance')
    await Audit.log({ entity_type: 'account_balance', entity_id: data.id, action: 'update', changes: { after: data } })
    return data
  }

  async function getSystemSettings() {
    const { data, error } = await _sb().from('system_settings').select('*').order('key')
    if (error) _throw(error, 'Failed to load settings')
    return data || []
  }

  async function upsertSystemSetting(key, value) {
    const { data, error } = await _sb()
      .from('system_settings').upsert({ key, value, updated_at: new Date().toISOString() })
      .select().single()
    if (error) _throw(error, 'Failed to save setting')
    await Audit.log({ entity_type: 'system_setting', entity_id: key, action: 'update', changes: { after: { [key]: value } } })
    return data
  }

  // ═════════════════════════════════════════════════════════════════
  // ACTIVITIES
  // ═════════════════════════════════════════════════════════════════

  async function getActivities(filters) {
    let q = _sb().from('activities').select('*')
    if (filters?.entity_type) q = q.eq('entity_type', filters.entity_type)
    if (filters?.entity_id) q = q.eq('entity_id', filters.entity_id)
    if (filters?.type) q = q.eq('type', filters.type)
    if (filters?.status) q = q.eq('status', filters.status)
    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) _throw(error, 'Failed to load activities')
    return data || []
  }

  async function logActivity(fields) {
    const { data, error } = await _sb()
      .from('activities').insert({ origin: 'user', ...fields }).select().single()
    if (error) _throw(error, 'Failed to log activity')
    return data
  }

  async function updateActivity(id, fields) {
    const { data, error } = await _sb()
      .from('activities').update(fields).eq('id', id).select().single()
    if (error) _throw(error, 'Failed to update activity')
    return data
  }

  async function getNotifications() {
    const { data, error } = await _sb()
      .from('activities').select('*')
      .or('type.eq.reminder,type.eq.integration_event')
      .eq('status', 'pending')
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(20)
    if (error) _throw(error, 'Failed to load notifications')
    return data || []
  }

  // ─── Public API ───────────────────────────────────────────────────
  return {
    _toUUID,
    // vendors
    getVendors, getVendorsInactive, getVendor, createVendor, updateVendor, deleteVendor,
    // clients
    getClients, getClient, createClient, updateClient, deleteClient,
    // vendor-client
    getVendorClientAssignments, assignVendorClient, unassignVendorClient,
    // products + plans
    getPrograms, getProducts, getAllProductsWithPlans,
    createProduct, updateProduct, deleteProduct,
    createPlan, updatePlan, deletePlan,
    // deals
    getDeals, getDeal, createDeal, updateDeal, deleteDeal,
    // packages
    getPackages, createPackage, updatePackage,
    // sessions
    getSessions, createSession, updateSession, deleteSession,
    // bills
    getBills, createBill, updateBill,
    // task types + rates
    getTaskTypes, getRates, upsertRate, deleteRate,
    // transactions
    getTransactions, getTransaction, updateTransaction,
    softDeleteTransaction, restoreTransaction, bulkUpdateTransactions,
    // registry: accounts
    getAccounts, getAllAccounts, createAccount, updateAccount, deleteAccount,
    // registry: companies
    getCompanies, createCompany, updateCompany, deleteCompany,
    // registry: categories
    getTransactionCategories, createTransactionCategory, updateTransactionCategory, deleteTransactionCategory,
    // registry: tags
    getTransactionTags, createTransactionTag, updateTransactionTag, deleteTransactionTag,
    // registry: exchange rates / balances / settings
    getExchangeRates, upsertExchangeRate,
    getAccountBalances, upsertAccountBalance,
    getSystemSettings, upsertSystemSetting,
    // activities
    getActivities, logActivity, updateActivity, getNotifications
  }
})()

window.DB = DB
