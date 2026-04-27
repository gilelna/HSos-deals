// deals-kanban.js — deals filtering, kanban, and list view

const KANBAN_VIEW_KEY = 'hsos.kanban.cardView'
function kanbanViewMode() {
  try {
    const v = localStorage.getItem(KANBAN_VIEW_KEY)
    return v === 'condensed' ? 'condensed' : 'full'
  } catch (_) { return 'full' }
}
function setKanbanViewMode(v) {
  try { localStorage.setItem(KANBAN_VIEW_KEY, v === 'condensed' ? 'condensed' : 'full') } catch (_) {}
}

function filteredDeals() {
  let d = [..._deals]
  if (_search) {
    d = d.filter(deal => {
      const cn = (deal.clients?.full_name || '').toLowerCase()
      const pn = (deal.products?.name || '').toLowerCase()
      const vn = (deal.vendors?.full_name || '').toLowerCase()
      return cn.includes(_search) || pn.includes(_search) || vn.includes(_search)
    })
  }
  if (_filters.has('overdue')) d = d.filter(x => x.billing_status === 'overdue')
  if (_filters.has('active'))  d = d.filter(x => x.sales_status === 'active')
  if (_filters.has('unpaid'))  d = d.filter(x => !['paid'].includes(x.billing_status))
  if (_filters.has('stale')) {
    const cutoff = Date.now() - 14 * 86400000
    d = d.filter(x => ['lead','qualified'].includes(x.sales_status) &&
                       x.updated_at && new Date(x.updated_at).getTime() < cutoff)
  }
  if (_filters.has('expiring')) {
    // Show only deals whose package is at >=80% utilization. Package data is
    // populated on _dashData by renderDashboard; falls through silently if
    // not loaded yet.
    const pkgList = (window._dashData && window._dashData.allPackages) || []
    const expiringDealIds = new Set(
      pkgList.filter(p => {
        const total = Number(p.sessions_total || 0)
        const used  = Number(p.sessions_used  || 0)
        return total > 0 && used / total >= 0.8 && p.status === 'active'
      }).map(p => p.deal_id)
    )
    d = d.filter(x => expiringDealIds.has(x.id))
  }
  if (_fVendor)  d = d.filter(x => x.primary_vendor_id === _fVendor)
  if (_fProduct) d = d.filter(x => x.product_id === _fProduct)
  if (_fBilling) d = d.filter(x => x.billing_status === _fBilling)
  return d
}

function renderDeals() {
  if (_view === 'kanban') renderKanban()
  else renderList()
}

function renderKanban() {
  const el = document.getElementById('page-deals-kanban')
  const deals = filteredDeals()
  if (!deals.length && !_deals.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">◻</div><div>No deals yet</div></div>`
    return
  }
  const view = kanbanViewMode()
  const toggleHtml = `
    <div class="kanban-view-toggle">
      <button class="ktv-btn ${view === 'full' ? 'is-active' : ''}" data-ktv="full">Full</button>
      <button class="ktv-btn ${view === 'condensed' ? 'is-active' : ''}" data-ktv="condensed">Condensed</button>
    </div>
  `

  const colsHtml = STAGES.map(stage => {
    const cols = deals.filter(d => d.sales_status === stage.key)
    return `
      <div class="kanban-col" style="min-width:240px">
        <div class="kanban-col-head">
          <span style="display:flex;align-items:center;gap:6px">
            <span style="width:7px;height:7px;border-radius:50%;background:${stage.color};flex-shrink:0"></span>
            ${stage.label}
          </span>
          <span style="font-size:11px">${cols.length}</span>
        </div>
        ${cols.map(d => view === 'condensed' ? kanbanCardCondensed(d) : kanbanCard(d)).join('')}
      </div>
    `
  }).join('')

  // Output already escaped via escHtml() in card builders (existing pattern).
  el.replaceChildren()
  const tpl = document.createElement('template')
  tpl.innerHTML = toggleHtml + `<div class="kanban-cols">${colsHtml}</div>`
  while (tpl.content.firstChild) el.appendChild(tpl.content.firstChild)

  el.querySelectorAll('.ktv-btn').forEach(b => {
    b.addEventListener('click', () => {
      setKanbanViewMode(b.dataset.ktv)
      renderKanban()
    })
  })
}

function kanbanCardCondensed(d) {
  // Click anywhere opens the deal panel via openEditDeal.
  const client = d.clients?.full_name || '—'
  const price  = d.agreed_price != null ? fmt(finalAmt(d.agreed_price, d.vat_pct, d.vat_mode), d.agreed_currency) : ''
  const status = d.sales_status || ''
  return `
    <div class="kanban-card kanban-card-condensed" onclick="openEditDeal('${d.id}',event)">
      <span class="kc-name">${escHtml(client)}</span>
      <span class="badge kc-stage" data-status="${escHtml(status)}">${escHtml(status)}</span>
      ${price ? `<span class="kc-price">${price}</span>` : ''}
    </div>
  `
}

function kanbanCard(d) {
  const client    = d.clients?.full_name || '—'
  const product   = d.products?.name || 'Custom'
  const vendorObj = d.vendors || null
  const vendorName = vendorObj?.full_name || null
  const price     = d.agreed_price != null ? fmt(finalAmt(d.agreed_price, d.vat_pct, d.vat_mode), d.agreed_currency) : null
  const bColor    = BILLING_COLORS[d.billing_status] || 'var(--mu2)'
  const created   = d.created_at ? formatDate(d.created_at) : ''

  const vendorAvatarHtml = vendorObj
    ? vendorObj.profile_picture_url
      ? `<img src="${escHtml(vendorObj.profile_picture_url)}" style="width:16px;height:16px;border-radius:50%;object-fit:cover;flex-shrink:0">`
      : `<div class="av" style="background:${avatarBg(vendorName)};color:${avatarFg(vendorName)};width:16px;height:16px;font-size:7px;flex-shrink:0">${initials(vendorName)}</div>`
    : ''

  return `
    <div class="kanban-card" onclick="openEditDeal('${d.id}',event)">
      <div style="margin-bottom:4px">
        <div style="font-size:13px;font-weight:600;color:var(--ink);line-height:1.3">${product}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <div class="av" style="background:${avatarBg(client)};color:${avatarFg(client)};width:18px;height:18px;font-size:8px;flex-shrink:0">${initials(client)}</div>
        <span style="font-size:12px;color:var(--mu);cursor:pointer;text-decoration:underline;text-underline-offset:2px"
          onclick="openClientFromCard('${d.client_id}',event)">${escHtml(client)}</span>
      </div>
      ${vendorName ? `
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:6px">
        ${vendorAvatarHtml}
        <span style="font-size:11px;color:var(--mu2)">by ${escHtml(vendorName)}</span>
      </div>` : ''}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
        <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 7px;border-radius:20px;background:${bColor}18;color:${bColor};font-weight:500;border:1px solid ${bColor}40">
          ${d.billing_status || '—'}
        </span>
        ${price ? `<span style="font-size:12px;font-family:var(--font-mono);color:var(--ink);font-weight:600">${price}</span>` : ''}
      </div>
      ${created ? `<div style="font-size:10px;color:var(--mu2);margin-top:6px;font-family:var(--font-mono)">${created}</div>` : ''}
    </div>
  `
}

function openClientFromCard(clientId, e) {
  e.stopPropagation()
  showClientDetail(clientId, null, 'kanban')
}
window.openClientFromCard = openClientFromCard

function renderList() {
  const tbody = document.getElementById('deals-list-body')
  const deals = filteredDeals()
  if (!deals.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--mu2);padding:24px">No deals found</td></tr>`
    return
  }
  tbody.innerHTML = deals.map(d => {
    const client  = d.clients?.full_name || '—'
    const product = d.products?.name || 'Custom'
    const vendor  = d.vendors?.full_name || '—'
    const price   = d.agreed_price != null ? fmt(finalAmt(d.agreed_price, d.vat_pct, d.vat_mode), d.agreed_currency) : '—'
    const stage   = STAGES.find(s => s.key === d.sales_status)
    const bColor  = BILLING_COLORS[d.billing_status] || 'var(--mu2)'
    return `
      <tr onclick="openEditDeal('${d.id}',event)" style="cursor:pointer">
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="av av-sm" style="background:${avatarBg(client)};color:${avatarFg(client)}">${initials(client)}</div>
            ${client}
          </div>
        </td>
        <td style="font-weight:500">${product}</td>
        <td style="color:var(--mu)">${vendor}</td>
        <td class="mono">${price}</td>
        <td><span style="display:inline-flex;align-items:center;gap:4px;font-size:12px"><span style="width:6px;height:6px;border-radius:50%;background:${stage?.color || 'var(--mu2)'};flex-shrink:0"></span>${d.sales_status}</span></td>
        <td><span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 7px;border-radius:20px;background:${bColor}18;color:${bColor};font-weight:500;border:1px solid ${bColor}40">${d.billing_status}</span></td>
        <td class="mono" style="font-size:11px">${d.payment_processor || '—'}</td>
      </tr>
    `
  }).join('')
}
