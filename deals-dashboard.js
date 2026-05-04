// deals-dashboard.js — operations dashboard

let _dashData = null  // cached dashboard supplemental data

async function renderDashboard() {
  renderDashMetrics()
  renderDashKanban()
  try {
    const [allVendors, allPackages, allBills] = await Promise.all([
      Promise.resolve(_vendors),
      getPackages({ status: 'active' }).catch(() => []),
      getAllBills({ status: 'draft' }).catch(() => []),
    ])
    const { data: unbilledSessions } = await _sb
      .from('sessions')
      .select('vendor_id')
      .is('bill_id', null)
      .not('task_type_id', 'is', null)
    _dashData = {
      allPackages,
      draftBills: allBills,
      unbilledSessions: unbilledSessions || [],
    }
    renderDashKanbanWithPackages()
    renderDashCoaches()
    renderDashClients()
    renderDashMetricsAttention()
    renderNeedsAttention()
  } catch(e) {
    console.error('[Dashboard]', e)
  }
}

async function renderNeedsAttention() {
  const section = document.getElementById('needs-attention')
  const strip   = document.getElementById('needs-attention-strip')
  const countEl = document.getElementById('needs-attention-count')
  if (!section || !strip) return

  let items = []
  try {
    items = await getNeedsAttentionItems({ limit: 8 })
  } catch (err) {
    console.error('[Dashboard] needs-attention', err)
    items = []
  }

  if (!items.length) {
    section.style.display = 'none'
    return
  }
  section.style.display = ''
  if (countEl) countEl.textContent = String(items.length)

  // Build items via DOM APIs (no innerHTML with interpolation).
  strip.textContent = ''
  items.forEach(it => {
    const card = document.createElement('div')
    card.className = 'na-item'
    card.dataset.kind = it.kind
    card.dataset.id   = it.id

    const title = document.createElement('div')
    title.className = 'na-item-title'
    title.textContent = it.title
    card.appendChild(title)

    const sub = document.createElement('div')
    sub.className = 'na-item-sub'
    sub.textContent = it.sub
    card.appendChild(sub)

    card.addEventListener('click', () => {
      const kind = card.dataset.kind
      const id   = card.dataset.id
      if (!kind || !id) return
      if (kind === 'overdue_bill' || kind === 'ready_bill') {
        if (window.SidePanel) window.SidePanel.open('bill', { id })
      } else if (kind === 'stale_deal' || kind === 'expiring_package') {
        if (window.SidePanel) window.SidePanel.open('deal', { id })
      }
    })

    strip.appendChild(card)
  })
}

function renderDashMetrics() {
  const activeDeals = _deals.filter(d => d.sales_status !== 'completed' && d.sales_status !== 'closed')
  const leadDeals   = _deals.filter(d => d.sales_status === 'lead')

  const activeClients = _clients.filter(c => c.active === true)
  const coaches = _vendors.filter(v => v.vendor_type === 'coach' && (v.active || v.is_active))
  const contractors = _vendors.filter(v => v.vendor_type === 'contractor' && (v.active || v.is_active))

  _el('dm-active-deals').textContent     = activeDeals.length
  _el('dm-active-deals-sub').textContent = `${leadDeals.length} leads pending`

  _el('dm-active-clients').textContent   = activeClients.length
  const coachesWithClients = coaches.filter(v => (v.clients || []).length > 0)
  _el('dm-active-clients-sub').textContent = `across ${coachesWithClients.length} coaches`

  _el('dm-coaches').textContent    = coaches.length
  _el('dm-coaches-sub').textContent = `${contractors.length} contractors`
}

function renderDashMetricsAttention() {
  if (!_dashData) return

  const noVendorDeals = _deals.filter(d =>
    d.sales_status !== 'completed' && d.sales_status !== 'closed' && !d.primary_vendor_id
  )
  const almostEmptyPkgs = _dashData.allPackages.filter(p => {
    const rem = (p.sessions_remaining != null) ? p.sessions_remaining : Math.max(0, (p.sessions_total || 0) - (p.sessions_used || 0))
    return rem >= 1 && rem <= 2
  })
  const vendorsWithDraftBills = new Set(_dashData.draftBills.map(b => b.vendor_id))

  const flaggedClients = noVendorDeals.length
  const flaggedCoaches = vendorsWithDraftBills.size
  const flaggedBills   = _dashData.draftBills.length + almostEmptyPkgs.length

  const total = flaggedClients + flaggedCoaches + flaggedBills
  const card  = document.getElementById('dm-attention-card')

  _el('dm-attention').textContent = total
  _el('dm-attention-sub').textContent = `${flaggedClients} clients · ${flaggedCoaches} coaches · ${flaggedBills} bills`

  if (total > 0) {
    card.classList.add('alert')
  } else {
    card.classList.remove('alert')
  }
}

function renderDashKanban() {
  const DASH_STAGES = ['lead', 'active', 'completed']
  const stageMap = { lead: [], active: [], completed: [] }

  for (const d of _deals) {
    const s = d.sales_status
    if (stageMap[s]) stageMap[s].push(d)
    else if (s === 'delivered') stageMap.completed.push(d)
  }

  for (const stage of DASH_STAGES) {
    const col   = document.getElementById(`dk-${stage}`)
    const count = document.getElementById(`dkh-${stage}-count`)
    const items = stageMap[stage]
    if (!col) continue
    if (count) count.textContent = items.length

    if (!items.length) {
      col.innerHTML = `<div style="font-size:11px;color:var(--mu2);padding:8px 2px">No deals</div>`
      continue
    }

    col.innerHTML = items.slice(0, 8).map(d => {
      const client  = d.clients?.full_name || '—'
      const product = d.products?.name || 'Custom'
      const hasVendor = !!d.primary_vendor_id

      const flags = []
      if (!hasVendor && stage === 'active') flags.push('No coach assigned')

      return `<div class="dash-kanban-card${flags.length ? ' flagged' : ''}" onclick="openEditDeal('${d.id}',event)">
        <div class="dash-kc-client">${escHtml(client)}</div>
        <div class="dash-kc-product">${escHtml(product)}</div>
        ${flags.map(f => `<div class="dash-kc-flag">${escHtml(f)}</div>`).join('')}
      </div>`
    }).join('')
  }
}

function renderDashKanbanWithPackages() {
  if (!_dashData) return
  const DASH_STAGES = ['lead', 'active', 'completed']
  const stageMap = { lead: [], active: [], completed: [] }
  for (const d of _deals) {
    const s = d.sales_status
    if (stageMap[s]) stageMap[s].push(d)
    else if (s === 'delivered') stageMap.completed.push(d)
  }
  const pkgByClient = {}
  for (const pkg of _dashData.allPackages) {
    if (!pkgByClient[pkg.client_id]) pkgByClient[pkg.client_id] = pkg
  }
  for (const stage of DASH_STAGES) {
    const col   = document.getElementById(`dk-${stage}`)
    if (!col) continue
    const items = stageMap[stage]
    if (!items.length) continue
    col.innerHTML = items.slice(0, 8).map(d => {
      const pkg = pkgByClient[d.client_id] || null
      return _dashKanbanCardWithPackage(d, pkg)
    }).join('')
  }
}

function _dashKanbanCardWithPackage(d, pkg) {
  const client  = d.clients?.full_name || '—'
  const product = d.products?.name || 'Custom'
  const hasVendor = !!d.primary_vendor_id

  const flags = []
  if (!hasVendor && d.sales_status === 'active') flags.push('No coach assigned')
  if (pkg) {
    const rem = pkg.sessions_remaining
    if (rem != null && rem >= 1 && rem <= 2) flags.push('Package almost empty')
  }

  return `<div class="dash-kanban-card${flags.length ? ' flagged' : ''}" onclick="openEditDeal('${d.id}',event)">
    <div class="dash-kc-client">${escHtml(client)}</div>
    <div class="dash-kc-product">${escHtml(product)}</div>
    ${d.sales_status === 'active' && pkg ? `<div class="dash-kc-sessions">${pkg.sessions_remaining} sessions left</div>` : ''}
    ${flags.map(f => `<div class="dash-kc-flag">${escHtml(f)}</div>`).join('')}
  </div>`
}

function renderDashCoaches() {
  const el = document.getElementById('dash-coaches-rows')
  if (!el) return

  const coaches = _vendors.filter(v => v.vendor_type === 'coach' && (v.active || v.is_active))
  if (!coaches.length) {
    el.innerHTML = `<div class="dash-widget-empty">No coaches found</div>`
    return
  }

  const unbilledByVendor = {}
  for (const s of (_dashData?.unbilledSessions || [])) {
    if (s.vendor_id) unbilledByVendor[s.vendor_id] = (unbilledByVendor[s.vendor_id] || 0) + 1
  }

  const draftBillVendors = new Set((_dashData?.draftBills || []).map(b => b.vendor_id))

  el.innerHTML = coaches.map(v => {
    const name     = v.full_name || v.name || '—'
    const initStr  = initials(name)
    const bg       = avatarBg(name)
    const fg       = avatarFg(name)
    const clientCt = (v.clients || []).length
    const subject  = v.subject || v.specialty || ''

    const badges = []
    const unbilled = unbilledByVendor[v.id] || 0
    if (unbilled > 0) {
      badges.push(`<span class="dash-badge dash-badge-amber">${unbilled} pending session${unbilled !== 1 ? 's' : ''}</span>`)
    }
    if (draftBillVendors.has(v.id)) {
      badges.push(`<span class="dash-badge dash-badge-blue">bill to approve</span>`)
    }
    if (!badges.length) {
      const isActive = v.active || v.is_active
      badges.push(isActive
        ? `<span class="dash-badge dash-badge-green">active</span>`
        : `<span class="dash-badge dash-badge-gray">paused</span>`)
    }

    return `<div class="dash-widget-row" onclick="openDashboardVendor('${v.id}')">
      <div class="av av-sm" style="background:${bg};color:${fg};flex-shrink:0">${escHtml(initStr)}</div>
      <div class="dash-wr-info">
        <div class="dash-wr-name">${escHtml(name)}</div>
        <div class="dash-wr-sub">${clientCt} client${clientCt !== 1 ? 's' : ''}${subject ? ' · ' + escHtml(subject) : ''}</div>
      </div>
      <div class="dash-wr-badges">${badges.join('')}</div>
    </div>`
  }).join('')
}

function renderDashClients() {
  const el = document.getElementById('dash-clients-rows')
  if (!el) return

  const activeClients = _clients.filter(c => c.status === 'active' || c.active === true)
  if (!activeClients.length) {
    el.innerHTML = `<div class="dash-widget-empty">No active clients</div>`
    return
  }

  const pkgByClient = {}
  for (const pkg of (_dashData?.allPackages || [])) {
    if (!pkgByClient[pkg.client_id]) pkgByClient[pkg.client_id] = pkg
  }

  const coachByClient = {}
  for (const v of _vendors) {
    for (const c of (v.clients || [])) {
      if (c?.id) coachByClient[c.id] = v.full_name || v.name
    }
  }

  const dealByClient = {}
  for (const d of _deals) {
    if (!dealByClient[d.client_id] && d.sales_status !== 'closed') {
      dealByClient[d.client_id] = d
    }
  }

  el.innerHTML = activeClients.slice(0, 10).map(c => {
    const name   = c.full_name || '—'
    const bg     = avatarBg(name)
    const fg     = avatarFg(name)
    const initStr = initials(name)
    const coach  = coachByClient[c.id] || null
    const deal   = dealByClient[c.id] || null
    const product = deal?.products?.name || null
    const pkg    = pkgByClient[c.id] || null

    let badge = ''
    if (pkg) {
      const rem = pkg.sessions_remaining != null ? pkg.sessions_remaining : Math.max(0, (pkg.sessions_total || 0) - (pkg.sessions_used || 0))
      if (rem <= 2) {
        badge = `<span class="dash-badge dash-badge-red">${rem} session${rem !== 1 ? 's' : ''} left</span>`
      }
    }
    if (!badge) {
      const status = c.status || (c.active ? 'active' : 'paused')
      badge = status === 'active'
        ? `<span class="dash-badge dash-badge-green">active</span>`
        : `<span class="dash-badge dash-badge-gray">paused</span>`
    }

    const sub = [product, coach ? `w/ ${coach}` : null].filter(Boolean).join(' · ')

    return `<div class="dash-widget-row" onclick="openDashboardClient('${c.id}')">
      <div class="av av-sm" style="background:${bg};color:${fg};flex-shrink:0">${escHtml(initStr)}</div>
      <div class="dash-wr-info">
        <div class="dash-wr-name">${escHtml(name)}</div>
        ${sub ? `<div class="dash-wr-sub">${escHtml(sub)}</div>` : ''}
      </div>
      <div class="dash-wr-badges">${badge}</div>
    </div>`
  }).join('')
}

async function openDashboardVendor(vendorId) {
  openVendorDetail(vendorId)
}
window.openDashboardVendor = openDashboardVendor

function _renderClientDetailPanel(clientId) {
  const detail = document.getElementById('client-detail')
  const client = _clients.find(c => c.id === clientId)
  if (!detail || !client) return

  const deals = _deals.filter(d => d.client_id === clientId)
  const activeDeal = deals.find(d => d.sales_status && d.sales_status !== 'closed') || deals[0] || null
  const pkg = (_dashData?.allPackages || []).find(p => p.client_id === clientId && (p.status === 'active' || !p.status)) || null

  detail.innerHTML = `
    <div style="padding:20px;border-bottom:1px solid var(--border2)">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="av av-lg" style="background:${avatarBg(client.full_name)};color:${avatarFg(client.full_name)}">${initials(client.full_name)}</div>
        <div style="min-width:0">
          <div style="font-size:17px;font-weight:600;color:var(--ink)">${escHtml(client.full_name || '—')}</div>
          <div style="font-size:11px;color:var(--mu)">${escHtml(client.email || 'No email')}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        ${activeDeal ? `<span class="pill" style="font-size:10px">${escHtml(activeDeal.sales_status || 'active')}</span>` : '<span class="pill" style="font-size:10px">No active deal</span>'}
        ${pkg ? `<span class="pill" style="font-size:10px">${pkg.sessions_remaining ?? Math.max(0, (pkg.sessions_total || 0) - (pkg.sessions_used || 0))} sessions left</span>` : '<span class="pill" style="font-size:10px">No active package</span>'}
      </div>
      <button class="btn btn-sm" style="margin-top:12px" onclick="showClientDetail('${clientId}', null, 'clients-panel')">Open full profile</button>
    </div>
    <div class="scroll" style="padding:14px 16px">
      <div style="font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);margin-bottom:8px">Deals</div>
      <div class="block">
        <table class="tbl">
          <thead><tr><th>Product</th><th>Status</th><th>Billing</th><th></th></tr></thead>
          <tbody>
            ${deals.length ? deals.slice(0, 8).map(d => `
              <tr onclick="openEditDeal('${d.id}',event)" style="cursor:pointer">
                <td>${escHtml(d.products?.name || 'Custom')}</td>
                <td>${escHtml(d.sales_status || '—')}</td>
                <td>${escHtml(d.billing_status || '—')}</td>
                <td><button class="btn btn-sm btn-ghost" style="padding:2px 7px;font-size:11px" onclick="event.stopPropagation();openEditDeal('${d.id}',event)">Edit</button></td>
              </tr>`).join('') : `<tr><td colspan="4" style="text-align:center;color:var(--mu2);padding:16px">No deals yet</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`
}

function openDashboardClient(clientId) {
  showClientDetail(clientId, null, 'dashboard')
}
window.openDashboardClient = openDashboardClient

function _el(id) { return document.getElementById(id) }
