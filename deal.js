// deal.js — standalone full deal page

function escDeal(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtDealDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDealMoney(amount, currency) {
  if (amount == null || amount === '') return '—'
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  const sym = { USD: '$', EUR: '€', ILS: '₪', GBP: '£' }[currency] || ''
  return `${sym}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`.trim()
}

function dealStatusBadge(status, active) {
  const raw = status || (active === false ? 'inactive' : 'active')
  const cls = raw === 'active' || raw === true ? 'active' : raw === 'inactive' || raw === false ? 'inactive' : 'neutral'
  const label = raw === true ? 'active' : raw === false ? 'inactive' : String(raw)
  return `<span class="ep-badge ep-badge-status ${cls}">${escDeal(label)}</span>`
}

function dealEntityLink(type, id, label) {
  if (!id) return `<span class="ep-muted">${escDeal(label || '—')}</span>`
  return `<button class="ep-link" data-panel-type="${escDeal(type)}" data-panel-id="${escDeal(id)}">${escDeal(label || '—')}</button>`
}

function renderStandaloneDealBody(model) {
  const deal = model?.deal || {}
  const packages = model?.packages || []
  const client = deal.clients || {}
  const vendor = deal.vendors || {}
  const reminders = Array.isArray(deal.deal_reminders) ? deal.deal_reminders : []
  const docs = Array.isArray(deal.deal_documents) ? deal.deal_documents : []

  const rows = [
    ['Client', dealEntityLink('client', client.id, client.full_name || '—')],
    ['Vendor', dealEntityLink('vendor', vendor.id, vendor.full_name || '—')],
    ['Product', escDeal(deal.products?.name || '—')],
    ['Sales status', dealStatusBadge(deal.sales_status || '—')],
    ['Billing status', dealStatusBadge(deal.billing_status || '—')],
    ['Price', escDeal(fmtDealMoney(deal.price, deal.currency))],
    ['VAT', deal.vat_pct != null ? `${escDeal(deal.vat_pct)}% (${escDeal(deal.vat_mode || '—')})` : '—'],
    ['Start', escDeal(fmtDealDate(deal.start_date || deal.created_at))],
    ['End', escDeal(fmtDealDate(deal.end_date))],
    ['Origin', escDeal(deal.origin || '—')],
    ['Processor', escDeal(deal.payment_processor || '—')],
  ]

  return `
    <div class="ep-card">
      <div class="ep-kv">
        ${rows.map(([k, v]) => `<div class="ep-k">${escDeal(k)}</div><div class="ep-v">${v}</div>`).join('')}
      </div>
    </div>

    ${deal.payment_link ? `
    <div class="ep-card">
      <div class="ep-section-title">Payment Link</div>
      <a class="ep-link-anchor" href="${escDeal(deal.payment_link)}" target="_blank" rel="noopener">${escDeal(deal.payment_link)}</a>
    </div>` : ''}

    <div class="ep-card">
      <div class="ep-section-title">Notes</div>
      <div class="ep-text">${deal.notes ? escDeal(deal.notes) : '<span class="ep-muted">No notes</span>'}</div>
    </div>

    <div class="ep-card">
      <div class="ep-section-title">Packages</div>
      ${packages.length ? `
        <table class="tbl ep-mini-table">
          <thead><tr><th>Sessions</th><th>Used</th><th>Status</th></tr></thead>
          <tbody>
            ${packages.map(p => `<tr><td>${escDeal(String(p.total_sessions || 0))}</td><td>${escDeal(String(p.sessions_used || 0))}</td><td>${dealStatusBadge(p.status || 'active')}</td></tr>`).join('')}
          </tbody>
        </table>` : '<div class="ep-muted">No packages</div>'}
    </div>

    <div class="ep-card">
      <div class="ep-section-title">Reminders</div>
      ${reminders.length
        ? `<ul class="ep-list">${reminders.map(r => `<li>${dealStatusBadge(r.done ? 'done' : 'pending')} ${escDeal(r.text || 'Reminder')}</li>`).join('')}</ul>`
        : '<div class="ep-muted">No reminders</div>'}
    </div>

    <div class="ep-card">
      <div class="ep-section-title">Documents</div>
      ${docs.length
        ? `<ul class="ep-list">${docs.map(d => `<li>${d.url ? `<a class="ep-link-anchor" href="${escDeal(d.url)}" target="_blank" rel="noopener">${escDeal(d.name || d.title || 'Document')}</a>` : escDeal(d.name || d.title || 'Document')}</li>`).join('')}</ul>`
        : '<div class="ep-muted">No documents</div>'}
    </div>
  `
}

async function initDealPage() {
  const mount = document.getElementById('deal-page-root')
  if (!mount) return

  const id = new URLSearchParams(window.location.search).get('id')
  if (!id) {
    mount.innerHTML = '<div class="ep-error">Missing deal id. Use deal.html?id=&lt;id&gt;.</div>'
    return
  }

  mount.innerHTML = '<div class="ep-loading">Loading deal…</div>'

  try {
    if (typeof getDeal !== 'function') {
      throw new Error('getDeal() is not available')
    }

    const [deal, packages] = await Promise.all([
      getDeal(id),
      typeof getPackages === 'function' ? getPackages({ deal_id: id }) : Promise.resolve([]),
    ])

    const title = deal?.products?.name || deal?.clients?.full_name || 'Deal'
    mount.innerHTML = `
      <div class="block" style="padding:18px 20px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px">
          <div>
            <div style="font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.12em;color:var(--mu2)">Deal</div>
            <div style="font-size:20px;font-weight:700;color:var(--ink)">${escDeal(title)}</div>
          </div>
          <a class="btn btn-sm" href="deals.html?page=deals&entity=deal&id=${encodeURIComponent(id)}" data-allow-navigation="true">Open in Operations</a>
        </div>
        <div class="entity-standalone">${renderStandaloneDealBody({ deal, packages: packages || [] })}</div>
      </div>
    `
  } catch (err) {
    mount.innerHTML = `<div class="ep-error">${escDeal(err?.message || 'Failed to load deal')}</div>`
  }
}

window.initDealPage = initDealPage

document.addEventListener('DOMContentLoaded', async () => {
  await LAYOUT.init('Deal Profile', 'operations')
  initDealPage()
})
