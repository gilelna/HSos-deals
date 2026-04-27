// components/side-panel.js — unified entity side panel (300px, slides from right)
//
// Public API (exposed on window):
//   openPanel(entityType, entityData)   — entityData may be a full row or { id }
//   closePanel()
//
// Renders into <div id="side-panel-root"> appended to <body>. Independent of
// the older root panel-manager.js. All user-supplied strings are routed
// through esc() before being assembled into HTML strings (matches the
// existing project convention in panel-manager.js).

;(function (global) {
  'use strict'

  // ─── color ramps per entity type ───────────────────────────────────
  const RAMPS = {
    client:  { bg: '#EEEDFE', border: '#CECBF6', text: '#26215C', eyebrow: '#534AB7' },
    deal:    { bg: '#E1F5EE', border: '#9FE1CB', text: '#04342C', eyebrow: '#0F6E56' },
    vendor:  { bg: '#FAEEDA', border: '#FAC775', text: '#412402', eyebrow: '#854F0B' },
    session: { bg: '#EEEDFE', border: '#CECBF6', text: '#26215C', eyebrow: '#534AB7' },
    bill:    { bg: '#EAF3DE', border: '#C0DD97', text: '#173404', eyebrow: '#3B6D11' },
    product: { bg: '#F1EFE8', border: '#D3D1C7', text: '#2C2C2A', eyebrow: '#5F5E5A' },
    plan:    { bg: '#E1F5EE', border: '#9FE1CB', text: '#04342C', eyebrow: '#0F6E56' },
  }

  // ─── status pill palettes ──────────────────────────────────────────
  const PILLS = {
    billing: {
      draft:       { bg: '#F1EFE8', color: '#5F5E5A' },
      invoiced:    { bg: '#E6F1FB', color: '#185FA5' },
      paid:        { bg: '#EAF3DE', color: '#3B6D11' },
      pending:     { bg: '#FAEEDA', color: '#854F0B' },
      overdue:     { bg: '#FCEBEB', color: '#A32D2D' },
      installment: { bg: '#EEEDFE', color: '#3C3489' },
      cancelled:   { bg: '#FBEAF0', color: '#72243E' },
    },
    sales: {
      lead:      { bg: '#F1EFE8', color: '#5F5E5A' },  // mu/grey
      qualified: { bg: '#FAEEDA', color: '#854F0B' },  // amber
      active:    { bg: '#EAF3DE', color: '#3B6D11' },  // green
      delivered: { bg: '#EEEDFE', color: '#3C3489' },  // purple
      closed:    { bg: '#E6F1FB', color: '#185FA5' },  // blue
    },
    bill: {
      draft:        { bg: '#F1EFE8', color: '#5F5E5A' },
      approved:     { bg: '#EAF3DE', color: '#3B6D11' },
      rejected:     { bg: '#FCEBEB', color: '#A32D2D' },
      ready_to_pay: { bg: '#E1F5EE', color: '#0F6E56' },
      paid:         { bg: '#EAF3DE', color: '#3B6D11' },
    },
  }

  const BILLING_OPTIONS = ['draft','pending','invoiced','installment','paid','overdue','cancelled']
  const SALES_OPTIONS   = ['lead','qualified','active','delivered','closed']
  // TODO(next session): audit BILL_OPTIONS against actual bills.status enum
  // (DB has draft/submitted/approved/paid/returned per STATUS.md). Current
  // values may not all be valid transitions; updateStatus only handles
  // approved/rejected/paid via dedicated db.js functions.
  const BILL_OPTIONS    = ['draft','approved','rejected','ready_to_pay','paid']

  // ─── inline SVG icons ──────────────────────────────────────────────
  const ICON_ATTR = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'

  const EYEBROW_ICON = {
    client:  `<svg ${ICON_ATTR}><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 16 0v1"/></svg>`,
    deal:    `<svg ${ICON_ATTR}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1"/></svg>`,
    vendor:  `<svg ${ICON_ATTR}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M12 12v4"/><path d="M10 14h4"/></svg>`,
    session: `<svg ${ICON_ATTR}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/></svg>`,
    bill:    `<svg ${ICON_ATTR}><path d="M4 3v18l3-2 3 2 3-2 3 2 3-2 1 2V3l-1 2-3-2-3 2-3-2-3 2-3-2z"/><path d="M8 9h8"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>`,
    product: `<svg ${ICON_ATTR}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg>`,
    plan:    `<svg ${ICON_ATTR}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1"/></svg>`,
  }

  const SECTION_ICON = {
    notes:     `<svg ${ICON_ATTR}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/></svg>`,
    reminders: `<svg ${ICON_ATTR}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    documents: `<svg ${ICON_ATTR}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
  }

  // ─── module state ──────────────────────────────────────────────────
  const state = {
    open: false,
    type: null,
    entity: null,
    relations: {},
    saving: false,
    fetchToken: 0,
  }

  // ─── relation option loaders (for select fields) ─────────────────
  async function loadClientOptions() {
    if (!global.getClients) return []
    try {
      const rows = await global.getClients()
      return (rows || []).map(c => ({ value: c.id, label: c.full_name || c.name || c.id }))
    } catch (err) {
      console.warn('[side-panel] loadClientOptions failed', err)
      return []
    }
  }
  async function loadVendorOptions() {
    if (!global.getVendors) return []
    try {
      const rows = await global.getVendors()
      return (rows || []).map(v => ({ value: v.id, label: v.full_name || v.name || v.id }))
    } catch (err) {
      console.warn('[side-panel] loadVendorOptions failed', err)
      return []
    }
  }

  let els = null

  // ─── helpers ───────────────────────────────────────────────────────
  function esc(s) {
    if (s == null) return ''
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c])
  }

  function fmtDate(v) {
    if (!v) return '—'
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  function fmtMoney(amount, currency) {
    if (amount == null || amount === '') return '—'
    const n = Number(amount)
    if (Number.isNaN(n)) return '—'
    const cur = (currency || 'USD').toUpperCase()
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n)
    } catch (_) {
      return cur + ' ' + n.toFixed(2)
    }
  }

  function entityTitle(type, e) {
    if (!e) return ''
    if (type === 'client')  return e.full_name || e.name || e.id
    if (type === 'vendor')  return e.full_name || e.name || e.id
    if (type === 'deal') {
      // Deals don't have a name column. Display the joined product name,
      // falling back to the client's full name, then deal_uid, never UUID.
      return (e.products && e.products.name)
          || (e.clients && e.clients.full_name)
          || e.deal_uid
          || e.title
          || e.id
    }
    if (type === 'session') return e.title || ('Session ' + (e.session_date || ''))
    if (type === 'bill')    return e.bill_number || ('Bill ' + (e.id || ''))
    if (type === 'product') return e.name || e.id
    if (type === 'plan')    return e.name || e.plan_uid || e.id
    return e.name || e.title || e.id || ''
  }

  function entityEyebrowSub(type, e) {
    if (!e) return ''
    if (type === 'client')  return e.email || e.phone || ''
    if (type === 'vendor')  return e.vendor_type ? e.vendor_type.replace(/_/g, ' ') : ''
    if (type === 'deal')    return e.deal_uid || ''
    if (type === 'session') return fmtDate(e.session_date) + (e.hours ? ` · ${e.hours}h` : '')
    if (type === 'bill')    return e.vendor_name || e.vendors?.full_name || ''
    if (type === 'product') return e.prd_uid || e.category || ''
    if (type === 'plan')    return e.plan_uid || ''
    return ''
  }

  function entityFullPageHref(type, e) {
    if (!e || !e.id) return null
    if (type === 'client')  return 'client-profile.html?id=' + encodeURIComponent(e.id)
    if (type === 'vendor')  return 'vendor-profile.html?id=' + encodeURIComponent(e.id)
    if (type === 'deal')    return 'deal.html?id=' + encodeURIComponent(e.id)
    if (type === 'product') return 'products.html?id=' + encodeURIComponent(e.id)
    if (type === 'plan')    return 'products.html?plan=' + encodeURIComponent(e.plan_uid || e.id)
    return null
  }

  function pill(palette, value, opts) {
    opts = opts || {}
    const safeValue = value || ''
    const clickable = opts.clickable ? ' sp2-pill-click' : ''
    const dataAttrs = opts.clickable
      ? ' data-palette="' + esc(palette) + '" data-status="' + esc(safeValue) + '" data-field="' + esc(opts.field || '') + '"'
      : ' data-status="' + esc(safeValue) + '"'
    // Coloring sourced from .badge[data-status] in shared.css. The
    // `sp2-pill` class keeps the click cursor + size for the side-panel
    // context. PILLS palette retained for any legacy lookups but no longer
    // drives inline color.
    return '<span class="badge sp2-pill' + clickable + '"' + dataAttrs + '>' + esc(safeValue || '—') + '</span>'
  }

  // ─── DOM scaffold (built with safe DOM APIs, not innerHTML) ────────
  function ensureRoot() {
    if (els && document.body.contains(els.root)) return els

    const root = document.createElement('div')
    root.id = 'side-panel-root'

    const backdrop = document.createElement('div')
    backdrop.className = 'sp2-backdrop'
    backdrop.dataset.sp2Close = '1'

    const panel = document.createElement('aside')
    panel.className = 'sp2-panel'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-hidden', 'true')

    const header = document.createElement('div')
    header.className = 'sp2-header'

    const fullLink = document.createElement('a')
    fullLink.className = 'sp2-full-link'
    fullLink.href = '#'
    fullLink.target = '_blank'
    fullLink.rel = 'noopener'
    fullLink.textContent = 'Open full profile →'

    const closeBtn = document.createElement('button')
    closeBtn.className = 'sp2-close'
    closeBtn.dataset.sp2Close = '1'
    closeBtn.setAttribute('aria-label', 'Close')
    closeBtn.textContent = '×'

    const eyebrow = document.createElement('div')
    eyebrow.className = 'sp2-eyebrow'

    const title = document.createElement('div')
    title.className = 'sp2-title'
    title.textContent = '—'

    const pills = document.createElement('div')
    pills.className = 'sp2-pills'

    header.appendChild(fullLink)
    header.appendChild(closeBtn)
    header.appendChild(eyebrow)
    header.appendChild(title)
    header.appendChild(pills)

    const body = document.createElement('div')
    body.className = 'sp2-body'

    panel.appendChild(header)
    panel.appendChild(body)
    root.appendChild(backdrop)
    root.appendChild(panel)
    document.body.appendChild(root)

    els = { root, backdrop, panel, header, eyebrow, title, pills, body, fullLink, closeBtn }

    root.addEventListener('click', e => {
      if (e.target.closest('[data-sp2-close]')) closePanel()
    })

    return els
  }

  function applyHeaderRamp(type) {
    const r = RAMPS[type] || RAMPS.client
    const h = els.header
    h.style.background   = r.bg
    h.style.borderBottom = '1px solid ' + r.border
    h.style.color        = r.text
    els.eyebrow.style.color = r.eyebrow
  }

  // ─── data resolution ───────────────────────────────────────────────
  async function resolveEntity(type, data) {
    if (!data) return null
    if (typeof data === 'string') data = { id: data }
    if (!data.id) return data

    const looksFull = (
      (type === 'client'  && (data.full_name || data.name)) ||
      (type === 'vendor'  && (data.full_name || data.name)) ||
      // For deals, only treat as hydrated when the joined relations we render
      // (clients, vendors, products) are present — otherwise re-fetch so the
      // header title and Client/Vendor fields don't fall back to UUIDs.
      (type === 'deal'    && data.clients && (data.vendors || data.products)) ||
      (type === 'session' && data.session_date) ||
      (type === 'bill'    && (data.bill_number || data.total_amount != null)) ||
      (type === 'product' && data.name) ||
      (type === 'plan'    && (data.name || data.plan_uid))
    )
    if (looksFull) return data

    try {
      if (type === 'client'  && global.getClient)  return await global.getClient(data.id)
      if (type === 'vendor'  && global.getVendor)  return await global.getVendor(data.id)
      if (type === 'deal'    && global.getDeal)    return await global.getDeal(data.id)
      if (type === 'package' && global.getPackage) return await global.getPackage(data.id)
      if (type === 'product' && global.getProduct) return await global.getProduct(data.id)
      if (type === 'plan'    && global.getPlan)    return await global.getPlan(data.id)
      if (type === 'bill'    && global.getBillWithSessions) return await global.getBillWithSessions(data.id)
    } catch (err) {
      console.error('[side-panel] fetch failed', type, data.id, err)
    }
    return data
  }

  async function loadRelations(type, e) {
    const out = {}
    if (!e) return out
    try {
      if (type === 'deal' && global.getPackagesForDeal && e.id) {
        out.package = await global.getPackagesForDeal(e.id)
      }
      if (type === 'session' && e.client_id && global.getClient) {
        out.client = await global.getClient(e.client_id)
      }
      if (type === 'bill' && e.vendor_id && global.getVendor) {
        out.vendor = await global.getVendor(e.vendor_id)
      }
    } catch (err) {
      console.warn('[side-panel] relation load failed', err)
    }
    return out
  }

  // ─── header rendering ─────────────────────────────────────────────
  function renderHeader(type, e) {
    const icon = EYEBROW_ICON[type] || ''
    const sub  = entityEyebrowSub(type, e)
    // build eyebrow as innerHTML with all textual values escaped + icon string
    // is a static literal (not user-controlled).
    let eyebrowHtml = '<span class="sp2-eyebrow-icon">' + icon + '</span>' +
                      '<span class="sp2-eyebrow-type">' + esc(type) + '</span>'
    if (sub) {
      eyebrowHtml += '<span class="sp2-eyebrow-sep">·</span>' +
                     '<span class="sp2-eyebrow-sub">' + esc(sub) + '</span>'
    }
    els.eyebrow.innerHTML = eyebrowHtml
    els.title.textContent = entityTitle(type, e)

    const pills = []
    if (type === 'deal') {
      if (e.sales_status)   pills.push(pill('sales',   e.sales_status,   { clickable: true, field: 'sales_status' }))
      if (e.billing_status) pills.push(pill('billing', e.billing_status, { clickable: true, field: 'billing_status' }))
    } else if (type === 'bill') {
      if (e.status) pills.push(pill('bill', e.status, { clickable: true, field: 'status' }))
    } else if (type === 'client') {
      const active = e.active === true || e.active === 'true'
      pills.push('<span class="sp2-pill" style="background:' + (active ? '#EAF3DE' : '#F1EFE8') + ';color:' + (active ? '#3B6D11' : '#5F5E5A') + '">' + (active ? 'active' : 'inactive') + '</span>')
    } else if (type === 'vendor') {
      const active = e.is_active !== false
      pills.push('<span class="sp2-pill" style="background:' + (active ? '#EAF3DE' : '#F1EFE8') + ';color:' + (active ? '#3B6D11' : '#5F5E5A') + '">' + (active ? 'active' : 'inactive') + '</span>')
      if (e.vendor_type) pills.push('<span class="sp2-pill" style="background:#F1EFE8;color:#5F5E5A">' + esc(e.vendor_type) + '</span>')
    } else if (type === 'product' || type === 'plan' || type === 'session') {
      if (e.status) pills.push('<span class="sp2-pill" style="background:#F1EFE8;color:#5F5E5A">' + esc(e.status) + '</span>')
    }
    els.pills.innerHTML = pills.join('')

    const href = entityFullPageHref(type, e)
    if (href) {
      els.fullLink.href = href
      els.fullLink.style.display = ''
    } else {
      els.fullLink.style.display = 'none'
    }
  }

  // ─── body rendering ────────────────────────────────────────────────
  function fieldsRowHtml(fields) {
    const cells = fields.map(f => {
      const value = f.html != null ? f.html : esc(f.value || '—')
      return '<div class="sp2-field">' +
               '<div class="sp2-field-label">' + esc(f.label) + '</div>' +
               '<div class="sp2-field-value">' + value + '</div>' +
             '</div>'
    }).join('')
    return '<div class="sp2-fields-row">' + cells + '</div>'
  }

  function inlineFieldsBlock(rows) {
    const blocks = rows.filter(r => r && r.length).map(r => fieldsRowHtml(r)).join('')
    return blocks ? '<div class="sp2-section">' + blocks + '</div>' : ''
  }

  function packageBlockHtml(pkg) {
    if (!pkg) return ''
    const total = Number(pkg.sessions_total || 0)
    const used  = Number(pkg.sessions_used || 0)
    const pct   = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
    const remaining = Math.max(0, total - used)
    const status = pkg.status || 'active'
    const name = pkg.product_name || pkg.name || 'Package'
    return '<div class="sp2-section">' +
             '<div class="sp2-pkg-row">' +
               '<div class="sp2-pkg-name">' + esc(name) + '</div>' +
               '<span class="sp2-pill" style="background:#F1EFE8;color:#5F5E5A">' + esc(status) + '</span>' +
             '</div>' +
             '<div class="sp2-pkg-bar-row">' +
               '<div class="sp2-pkg-bar"><div class="sp2-pkg-bar-fill" style="width:' + pct + '%"></div></div>' +
               '<div class="sp2-pkg-count">' + used + ' / ' + total + ' sessions</div>' +
             '</div>' +
             '<div class="sp2-pkg-remaining">' + remaining + ' sessions remaining</div>' +
           '</div>'
  }

  function notesBlock(entity) {
    const value = entity && entity.notes ? entity.notes : ''
    return '<div class="sp2-section sp2-section-inverted">' +
             '<div class="sp2-section-head">' +
               '<span class="sp2-section-icon">' + SECTION_ICON.notes + '</span>' +
               '<span class="sp2-section-label">Notes</span>' +
             '</div>' +
             '<textarea class="sp2-notes" data-sp2-notes placeholder="Add notes…">' + esc(value) + '</textarea>' +
           '</div>'
  }

  function remindersBlock(list) {
    const items = (list || []).map(r => (
      '<div class="sp2-reminder">' +
        '<span class="sp2-reminder-dot' + (r.done ? ' is-done' : '') + '"></span>' +
        '<span class="sp2-reminder-text' + (r.done ? ' is-done' : '') + '">' + esc(r.text || '') + '</span>' +
        '<span class="sp2-reminder-date">' + (r.due_date ? esc(fmtDate(r.due_date)) : '') + '</span>' +
      '</div>'
    )).join('')
    const empty = items ? '' : '<div class="sp2-empty">No reminders</div>'
    return '<div class="sp2-section sp2-section-inverted">' +
             '<div class="sp2-section-head">' +
               '<span class="sp2-section-icon">' + SECTION_ICON.reminders + '</span>' +
               '<span class="sp2-section-label">Reminders</span>' +
               '<a class="sp2-section-action" href="#" data-sp2-add-reminder>+ Add</a>' +
             '</div>' +
             items + empty +
           '</div>'
  }

  function documentsBlock(list) {
    const items = (list || []).map(d => (
      '<div class="sp2-doc">' +
        '<span class="sp2-doc-icon">' + SECTION_ICON.documents + '</span>' +
        '<span class="sp2-doc-name">' + esc(d.name || d.file_name || 'Document') + '</span>' +
        (d.url ? '<a class="sp2-doc-link" href="' + esc(d.url) + '" target="_blank" rel="noopener">↗</a>' : '') +
      '</div>'
    )).join('')
    return '<div class="sp2-section">' +
             '<div class="sp2-section-head">' +
               '<span class="sp2-section-icon">' + SECTION_ICON.documents + '</span>' +
               '<span class="sp2-section-label">Documents</span>' +
             '</div>' +
             items +
             '<div class="sp2-upload">Drop file or paste link</div>' +
           '</div>'
  }

  function inlineFieldsFor(type, e, rel) {
    if (type === 'client') {
      return [
        [ { label: 'Email', value: e.email }, { label: 'Phone', value: e.phone } ],
        [ { label: 'Country', value: e.country }, { label: 'Company', value: e.company } ],
      ]
    }
    if (type === 'vendor') {
      return [
        [ { label: 'Email', value: e.email }, { label: 'Phone', value: e.phone } ],
        [ { label: 'Type', value: e.vendor_type }, { label: 'Currency', value: e.payout_currency } ],
      ]
    }
    if (type === 'deal') {
      const clientName = (e.clients && (e.clients.full_name || e.clients.name))
                       || e.client_name
                       || '—'
      const vendorName = (e.vendors && (e.vendors.full_name || e.vendors.name))
                       || e.primary_vendor_name
                       || '—'
      return [
        [ { label: 'Client', value: clientName },
          { label: 'Vendor', value: vendorName } ],
        [ { label: 'Amount', html: esc(fmtMoney(e.agreed_price, e.agreed_currency)) },
          { label: 'Started', value: fmtDate(e.start_date) } ],
      ]
    }
    if (type === 'session') {
      return [
        [ { label: 'Date', value: fmtDate(e.session_date) },
          { label: 'Hours', value: e.hours ? String(e.hours) : '—' } ],
        [ { label: 'Client', value: (rel && rel.client && rel.client.name) || e.client_name || e.client_id },
          { label: 'Rate', html: esc(fmtMoney(e.rate_usd, 'USD')) } ],
      ]
    }
    if (type === 'bill') {
      return [
        [ { label: 'Vendor', value: (rel && rel.vendor && rel.vendor.full_name) || e.vendor_name || e.vendor_id },
          { label: 'Total', html: esc(fmtMoney(e.total_amount, e.currency || 'USD')) } ],
        [ { label: 'Period', value: e.period || (fmtDate(e.period_start) + ' – ' + fmtDate(e.period_end)) },
          { label: 'Sessions', value: Array.isArray(e.sessions) ? String(e.sessions.length) : '—' } ],
      ]
    }
    if (type === 'product') {
      return [[ { label: 'Category', value: e.category }, { label: 'Status', value: e.status } ]]
    }
    if (type === 'plan') {
      return [
        [ { label: 'Type', value: e.plan_type }, { label: 'Amount', html: esc(fmtMoney(e.amount, e.currency)) } ],
        [ { label: 'Rail', value: e.payment_rail || '—' }, { label: 'Status', value: e.status || '—' } ],
      ]
    }
    return []
  }

  // ─── DOM mounters for editable panels (deal / vendor / client) ─────
  async function mountDealFields(e) {
    const section = document.createElement('div')
    section.className = 'sp2-section'

    const row1 = document.createElement('div'); row1.className = 'sp2-fields-row'; section.appendChild(row1)
    const clientCell = document.createElement('div'); clientCell.className = 'sp2-field'; row1.appendChild(clientCell)
    const vendorCell = document.createElement('div'); vendorCell.className = 'sp2-field'; row1.appendChild(vendorCell)

    const row2 = document.createElement('div'); row2.className = 'sp2-fields-row'; section.appendChild(row2)
    const amountCell = document.createElement('div'); amountCell.className = 'sp2-field'; row2.appendChild(amountCell)
    const dateCell   = document.createElement('div'); dateCell.className   = 'sp2-field'; row2.appendChild(dateCell)

    const [clientOpts, vendorOpts] = await Promise.all([loadClientOptions(), loadVendorOptions()])

    global.PanelEditor.field({
      container: clientCell, label: 'Client', value: e.client_id,
      type: 'select', saveMode: 'explicit', options: clientOpts,
      format: () => (e.clients && (e.clients.full_name || e.clients.name)) || e.client_name || '—',
      onSave: async (next) => {
        const updated = await global.updateDeal(e.id, { client_id: next })
        if (updated) Object.assign(e, updated)
        else e.client_id = next
        return updated
      },
    })

    global.PanelEditor.field({
      container: vendorCell, label: 'Vendor', value: e.primary_vendor_id,
      type: 'select', saveMode: 'explicit', options: vendorOpts,
      format: () => (e.vendors && (e.vendors.full_name || e.vendors.name)) || e.primary_vendor_name || '—',
      onSave: async (next) => {
        const updated = await global.updateDeal(e.id, { primary_vendor_id: next })
        if (updated) Object.assign(e, updated)
        else e.primary_vendor_id = next
        return updated
      },
    })

    global.PanelEditor.field({
      container: amountCell, label: 'Amount', value: e.agreed_price,
      type: 'money', saveMode: 'explicit', currency: e.agreed_currency || 'USD',
      onSave: async (next) => {
        const updated = await global.updateDeal(e.id, { agreed_price: next })
        if (updated) Object.assign(e, updated)
        else e.agreed_price = next
        return updated
      },
    })

    // Deals table has no editable start_date column on demo (verified via
    // information_schema). Show created_at read-only as the closest "when"
    // signal. If a real start_date column is added later, swap this for an
    // editable PanelEditor.field.
    const createdLabel = document.createElement('div')
    createdLabel.className = 'pe-field-label'
    createdLabel.textContent = 'Created'
    const createdDisp = document.createElement('div')
    createdDisp.className = 'pe-field-display'
    createdDisp.style.cursor = 'default'
    createdDisp.textContent = fmtDate(e.created_at)
    const createdWrap = document.createElement('div'); createdWrap.className = 'pe-field'
    createdWrap.appendChild(createdLabel); createdWrap.appendChild(createdDisp)
    dateCell.appendChild(createdWrap)

    return section
  }

  function mountVendorFields(e) {
    const section = document.createElement('div'); section.className = 'sp2-section'

    const row1 = document.createElement('div'); row1.className = 'sp2-fields-row'; section.appendChild(row1)
    const nameCell  = document.createElement('div'); nameCell.className  = 'sp2-field'; row1.appendChild(nameCell)
    const emailCell = document.createElement('div'); emailCell.className = 'sp2-field'; row1.appendChild(emailCell)

    const row2 = document.createElement('div'); row2.className = 'sp2-fields-row'; section.appendChild(row2)
    const typeCell = document.createElement('div'); typeCell.className = 'sp2-field'; row2.appendChild(typeCell)
    const curCell  = document.createElement('div'); curCell.className  = 'sp2-field'; row2.appendChild(curCell)

    // Vendors: full_name is a generated column (→ name). Write to `name`;
    // full_name updates automatically.
    global.PanelEditor.field({
      container: nameCell, label: 'Name', value: e.name || e.full_name || '',
      type: 'text', saveMode: 'blur',
      onSave: async (next) => {
        const updated = await global.updateVendor(e.id, { name: next })
        if (updated) Object.assign(e, updated)
        else { e.name = next; e.full_name = next }
        return updated
      },
    })

    global.PanelEditor.field({
      container: emailCell, label: 'Email', value: e.email || '',
      type: 'email', saveMode: 'blur',
      onSave: async (next) => {
        const updated = await global.updateVendor(e.id, { email: next })
        if (updated) Object.assign(e, updated)
        else e.email = next
        return updated
      },
    })

    global.PanelEditor.field({
      container: typeCell, label: 'Type', value: e.vendor_type || '',
      type: 'select', saveMode: 'explicit',
      options: [
        { value: 'coach',       label: 'Coach' },
        { value: 'contractor',  label: 'Contractor' },
        { value: 'team_member', label: 'Team member' },
        { value: 'merchant',    label: 'Merchant' },
      ],
      onSave: async (next) => {
        const updated = await global.updateVendor(e.id, { vendor_type: next })
        if (updated) Object.assign(e, updated)
        else e.vendor_type = next
        return updated
      },
    })

    global.PanelEditor.field({
      container: curCell, label: 'Currency', value: e.payout_currency || '',
      type: 'select', saveMode: 'explicit',
      options: [
        { value: 'USD', label: 'USD' },
        { value: 'EUR', label: 'EUR' },
        { value: 'ILS', label: 'ILS' },
        { value: 'GBP', label: 'GBP' },
      ],
      onSave: async (next) => {
        const updated = await global.updateVendor(e.id, { payout_currency: next })
        if (updated) Object.assign(e, updated)
        else e.payout_currency = next
        return updated
      },
    })

    // TODO: re-add Phone + Payout method fields when those columns land on
    // the vendors table. The existing schema has neither (verified via
    // information_schema on demo 2026-04-27).

    return section
  }

  function mountClientFields(e) {
    const section = document.createElement('div'); section.className = 'sp2-section'

    const row1 = document.createElement('div'); row1.className = 'sp2-fields-row'; section.appendChild(row1)
    const nameCell  = document.createElement('div'); nameCell.className  = 'sp2-field'; row1.appendChild(nameCell)
    const emailCell = document.createElement('div'); emailCell.className = 'sp2-field'; row1.appendChild(emailCell)

    const row2 = document.createElement('div'); row2.className = 'sp2-fields-row'; section.appendChild(row2)
    const statusCell = document.createElement('div'); statusCell.className = 'sp2-field'; row2.appendChild(statusCell)
    const vendorCell = document.createElement('div'); vendorCell.className = 'sp2-field'; row2.appendChild(vendorCell)

    global.PanelEditor.field({
      container: nameCell, label: 'Name', value: e.full_name || e.name || '',
      type: 'text', saveMode: 'blur',
      onSave: async (next) => {
        const updated = await global.updateClient(e.id, { full_name: next })
        if (updated) Object.assign(e, updated)
        else e.full_name = next
        return updated
      },
    })

    global.PanelEditor.field({
      container: emailCell, label: 'Email', value: e.email || '',
      type: 'email', saveMode: 'blur',
      onSave: async (next) => {
        const updated = await global.updateClient(e.id, { email: next })
        if (updated) Object.assign(e, updated)
        else e.email = next
        return updated
      },
    })

    global.PanelEditor.field({
      container: statusCell, label: 'Status', value: e.active === true ? 'active' : 'inactive',
      type: 'select', saveMode: 'explicit',
      options: [
        { value: 'active',   label: 'active' },
        { value: 'inactive', label: 'inactive' },
      ],
      onSave: async (next) => {
        const updated = await global.updateClient(e.id, { active: next === 'active' })
        if (updated) Object.assign(e, updated)
        else e.active = next === 'active'
        return updated
      },
    })

    // Assigned vendor: clients table has no direct column for this — assignments
    // live in vendor_client_assignments. Read-only placeholder for this session;
    // editing requires modifying the join table (follow-up).
    const labelEl = document.createElement('div')
    labelEl.className = 'pe-field-label'
    labelEl.textContent = 'Assigned vendor'
    const dispEl = document.createElement('div')
    dispEl.className = 'pe-field-display'
    dispEl.style.cursor = 'default'
    dispEl.textContent = '—'
    const wrap = document.createElement('div'); wrap.className = 'pe-field'
    wrap.appendChild(labelEl); wrap.appendChild(dispEl)
    vendorCell.appendChild(wrap)

    return section
  }

  function mountNotesField(type, e) {
    const section = document.createElement('div')
    section.className = 'sp2-section sp2-section-inverted'

    const head = document.createElement('div')
    head.className = 'sp2-section-head'

    // Build the icon span using parseHTMLFragment so an SVG literal can mount
    // without setting innerHTML directly. SECTION_ICON.notes is a static
    // literal defined at module top — not user content.
    const iconSpan = document.createElement('span')
    iconSpan.className = 'sp2-section-icon'
    const tpl = document.createElement('template')
    tpl.innerHTML = SECTION_ICON.notes
    iconSpan.appendChild(tpl.content.cloneNode(true))

    const labelSpan = document.createElement('span')
    labelSpan.className = 'sp2-section-label'
    labelSpan.textContent = 'Notes'

    head.appendChild(iconSpan)
    head.appendChild(labelSpan)
    section.appendChild(head)

    const cell = document.createElement('div')
    section.appendChild(cell)

    const updaters = {
      deal:    global.updateDeal,
      client:  global.updateClient,
      vendor:  global.updateVendor,
      session: global.updateSession,
    }
    const updater = updaters[type]
    if (!updater) return section

    global.PanelEditor.field({
      container: cell, label: '', value: e.notes || '',
      type: 'textarea', saveMode: 'blur',
      onSave: async (next) => {
        const updated = await updater(e.id, { notes: next })
        if (updated) Object.assign(e, updated)
        else e.notes = next
        return updated
      },
    })
    return section
  }

  // appendHtmlSection: parses an HTML string built by remindersBlock /
  // documentsBlock / packageBlockHtml (which esc() user values internally,
  // matching the project's existing convention) and appends the first
  // resulting element. Uses <template> so untrusted content cannot execute
  // — template parsing does not run scripts or load resources.
  function appendHtmlSection(parent, html) {
    if (!html) return
    const tpl = document.createElement('template')
    tpl.innerHTML = html
    const first = tpl.content.firstElementChild
    if (first) parent.appendChild(first)
  }

  function renderBody(type, e, rel) {
    if (!e) {
      els.body.textContent = ''
      const empty = document.createElement('div'); empty.className = 'sp2-empty'; empty.textContent = 'No data'
      els.body.appendChild(empty)
      return
    }
    els.body.textContent = ''

    if (type === 'deal') {
      const placeholder = document.createElement('div')
      placeholder.className = 'sp2-section'
      const placeholderInner = document.createElement('div')
      placeholderInner.className = 'sp2-empty'
      placeholderInner.textContent = '…'
      placeholder.appendChild(placeholderInner)
      els.body.appendChild(placeholder)

      mountDealFields(e).then(section => {
        if (placeholder.parentNode) placeholder.parentNode.replaceChild(section, placeholder)
      })

      // Hide package section entirely when the deal has no package — no empty state.
      if (rel.package) appendHtmlSection(els.body, packageBlockHtml(rel.package))
      els.body.appendChild(mountNotesField(type, e))
      appendHtmlSection(els.body, remindersBlock(rel.reminders))
      appendHtmlSection(els.body, documentsBlock(rel.documents))
    } else if (type === 'vendor') {
      els.body.appendChild(mountVendorFields(e))
      els.body.appendChild(mountNotesField(type, e))
      appendHtmlSection(els.body, remindersBlock(rel.reminders))
      appendHtmlSection(els.body, documentsBlock(rel.documents))
    } else if (type === 'client') {
      els.body.appendChild(mountClientFields(e))
      els.body.appendChild(mountNotesField(type, e))
      appendHtmlSection(els.body, remindersBlock(rel.reminders))
      appendHtmlSection(els.body, documentsBlock(rel.documents))
    } else {
      // session / bill / product / plan: legacy HTML path.
      // sections[] are built by helpers that esc() all user values.
      const sections = [
        inlineFieldsBlock(inlineFieldsFor(type, e, rel)),
        notesBlock(e),
        remindersBlock(rel.reminders),
        documentsBlock(rel.documents),
      ].filter(Boolean)
      const tpl = document.createElement('template')
      tpl.innerHTML = sections.join('')
      while (tpl.content.firstChild) els.body.appendChild(tpl.content.firstChild)
      wireBodyEvents(type, e)
    }
    wireHeaderPillClicks(type, e)
  }

  // ─── interactions ──────────────────────────────────────────────────
  function wireHeaderPillClicks(type, entity) {
    els.pills.querySelectorAll('.sp2-pill-click').forEach(p => {
      p.addEventListener('click', e => {
        e.stopPropagation()
        const palette = p.dataset.palette
        const field   = p.dataset.field
        const current = p.dataset.status
        const options = palette === 'billing' ? BILLING_OPTIONS
                       : palette === 'sales'  ? SALES_OPTIONS
                       : palette === 'bill'   ? BILL_OPTIONS
                       : []
        if (!options.length) return
        openStatusMenu(p, options, current, async next => {
          if (next === current) return
          await updateStatus(type, entity, field, next)
        })
      })
    })
  }

  // Floating dropdown anchored to a pill. One menu open at a time.
  let _statusMenuEl = null
  let _statusMenuCleanup = null
  function closeStatusMenu() {
    if (_statusMenuEl && _statusMenuEl.parentNode) _statusMenuEl.parentNode.removeChild(_statusMenuEl)
    _statusMenuEl = null
    if (_statusMenuCleanup) { _statusMenuCleanup(); _statusMenuCleanup = null }
  }
  function openStatusMenu(anchor, options, current, onSelect) {
    closeStatusMenu()
    const menu = document.createElement('div')
    menu.className = 'sp2-status-menu'
    options.forEach(opt => {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'sp2-status-menu-item' + (opt === current ? ' is-current' : '')
      item.dataset.status = opt
      // Reuse the .badge[data-status] palette so menu chips match the pill.
      const chip = document.createElement('span')
      chip.className = 'badge'
      chip.dataset.status = opt
      chip.textContent = opt
      item.appendChild(chip)
      item.addEventListener('click', ev => {
        ev.stopPropagation()
        closeStatusMenu()
        onSelect(opt)
      })
      menu.appendChild(item)
    })
    document.body.appendChild(menu)
    const rect = anchor.getBoundingClientRect()
    menu.style.top  = (rect.bottom + 4) + 'px'
    menu.style.left = rect.left + 'px'
    _statusMenuEl = menu

    const onDocClick = ev => {
      if (!menu.contains(ev.target) && ev.target !== anchor) closeStatusMenu()
    }
    const onEsc = ev => { if (ev.key === 'Escape') closeStatusMenu() }
    setTimeout(() => document.addEventListener('click', onDocClick), 0)
    document.addEventListener('keydown', onEsc)
    _statusMenuCleanup = () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }

  async function updateStatus(type, entity, field, next) {
    if (!entity || !entity.id || state.saving) return
    state.saving = true
    try {
      let updated
      if (type === 'deal' && global.updateDeal) {
        updated = await global.updateDeal(entity.id, { [field]: next })
      } else if (type === 'bill') {
        if (next === 'approved' && global.approveBillV2)      updated = await global.approveBillV2(entity.id)
        else if (next === 'rejected' && global.rejectBillV2)  updated = await global.rejectBillV2(entity.id, '')
        else if (next === 'paid' && global.markBillPaidV2)    updated = await global.markBillPaidV2(entity.id)
      }
      if (updated) Object.assign(entity, updated)
      else entity[field] = next
      renderHeader(type, entity)
    } catch (err) {
      console.error('[side-panel] status update failed', err)
      if (typeof global.toast === 'function') global.toast('Status update failed', 'error')
    } finally {
      state.saving = false
    }
  }

  function wireBodyEvents(type, entity) {
    const notes = els.body.querySelector('[data-sp2-notes]')
    if (notes) {
      notes.addEventListener('blur', async () => {
        const value = notes.value
        if (!entity || value === (entity.notes || '')) return
        try {
          if (type === 'deal'    && global.updateDeal)    await global.updateDeal(entity.id, { notes: value })
          else if (type === 'client'  && global.updateClient)  await global.updateClient(entity.id, { notes: value })
          else if (type === 'vendor'  && global.updateVendor)  await global.updateVendor(entity.id, { notes: value })
          else if (type === 'session' && global.updateSession) await global.updateSession(entity.id, { notes: value })
          entity.notes = value
        } catch (err) {
          console.error('[side-panel] notes save failed', err)
          if (typeof global.toast === 'function') global.toast('Could not save notes', 'error')
        }
      })
    }
  }

  // ─── ESC key handling ──────────────────────────────────────────────
  function onKeydown(e) {
    if (e.key === 'Escape' && state.open) closePanel()
  }

  // ─── public API ────────────────────────────────────────────────────
  async function openPanel(entityType, entityData) {
    if (!entityType || (!RAMPS[entityType] && entityType !== 'package')) {
      console.warn('[side-panel] unknown entity type', entityType)
      return
    }
    ensureRoot()
    state.open = true
    state.type = entityType
    state.entity = null
    state.relations = {}
    const myToken = ++state.fetchToken

    applyHeaderRamp(entityType)
    els.title.textContent = 'Loading…'
    els.eyebrow.innerHTML = '<span class="sp2-eyebrow-type">' + esc(entityType) + '</span>'
    els.pills.innerHTML = ''
    els.body.innerHTML  = '<div class="sp2-empty">Loading…</div>'
    els.fullLink.style.display = 'none'

    document.body.classList.add('sp2-open')
    requestAnimationFrame(() => {
      els.root.classList.add('is-open')
      els.panel.setAttribute('aria-hidden', 'false')
    })
    document.addEventListener('keydown', onKeydown)

    const entity = await resolveEntity(entityType, entityData)
    if (myToken !== state.fetchToken) return
    state.entity = entity
    if (!entity) {
      els.body.innerHTML = '<div class="sp2-empty">Could not load data</div>'
      return
    }

    const relations = await loadRelations(entityType, entity)
    if (myToken !== state.fetchToken) return
    state.relations = relations

    renderHeader(entityType, entity)
    renderBody(entityType, entity, relations)
  }

  function closePanel() {
    if (!els) return
    state.open = false
    state.type = null
    state.entity = null
    state.relations = {}
    state.fetchToken++
    els.root.classList.remove('is-open')
    els.panel.setAttribute('aria-hidden', 'true')
    document.body.classList.remove('sp2-open')
    document.removeEventListener('keydown', onKeydown)
  }

  global.SidePanel = { open: openPanel, close: closePanel }
  global.openPanel = openPanel
  global.closePanel = closePanel
})(typeof window !== 'undefined' ? window : globalThis)
