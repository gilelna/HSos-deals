// v2/spaces/sales/sales-dashboard.js — Dashboard: KPIs, mini kanban, coaches list.

const SalesDashboard = (() => {
  function render(mount) {
    const wrap = document.createElement('div')
    wrap.className = 'v2-dashboard'
    mount.appendChild(wrap)
    _paint(wrap)
    State.on('sales.deals',   () => _paint(wrap))
    State.on('sales.clients', () => _paint(wrap))
    State.on('sales.vendors', () => _paint(wrap))
  }

  function _paint(wrap) {
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild)
    wrap.appendChild(_buildKpis())
    wrap.appendChild(_buildMiniKanban())
    wrap.appendChild(_buildCoaches())
  }

  function _buildKpis() {
    const deals = State.get('sales.deals') || []
    const clients = State.get('sales.clients') || []
    const vendors = State.get('sales.vendors') || []

    const activeDeals = deals.filter(d => ['qualified', 'active', 'delivered'].includes(d.sales_status))
    const wonDeals = deals.filter(d => d.billing_status === 'paid')
    const pipelineValue = activeDeals.reduce((n, d) => n + (Number(d.price) || 0), 0)
    const revenue = wonDeals.reduce((n, d) => n + (Number(d.price) || 0), 0)
    const coaches = vendors.filter(v => v.vendor_type === 'coach').length

    const kpis = [
      { label: 'Active deals',     value: String(activeDeals.length) },
      { label: 'Revenue (paid)',   value: Utils.formatCurrency(revenue, 'USD') },
      { label: 'Pipeline value',   value: Utils.formatCurrency(pipelineValue, 'USD') },
      { label: 'Clients',          value: String(clients.length) },
      { label: 'Coaches',          value: String(coaches) }
    ]

    const grid = document.createElement('section')
    grid.className = 'v2-kpi-grid'
    for (const k of kpis) {
      const card = document.createElement('div')
      card.className = 'v2-kpi-card'
      const label = document.createElement('div')
      label.className = 'v2-kpi-label'
      label.textContent = k.label
      const value = document.createElement('div')
      value.className = 'v2-kpi-value'
      value.textContent = k.value
      card.append(label, value)
      grid.appendChild(card)
    }
    return grid
  }

  function _buildMiniKanban() {
    const section = document.createElement('section')
    section.className = 'v2-dash-mini-kanban'
    const h = document.createElement('h2')
    h.textContent = 'Pipeline'
    section.appendChild(h)

    const deals = State.get('sales.deals') || []
    const clients = State.get('sales.clients') || []
    const clientById = new Map(clients.map(c => [c.id, c]))

    const cols = ['lead', 'qualified', 'active']
    const grid = document.createElement('div')
    grid.className = 'v2-mini-kanban-grid'
    for (const stage of cols) {
      const col = document.createElement('div')
      col.className = 'v2-mini-kanban-col'
      const head = document.createElement('header')
      head.className = 'v2-mini-kanban-head'
      const stageDeals = deals.filter(d => d.sales_status === stage)
      head.textContent = `${Const.DEAL_STAGE_LABELS[stage]} (${stageDeals.length})`
      col.appendChild(head)
      const list = document.createElement('div')
      list.className = 'v2-mini-kanban-list'
      for (const d of stageDeals.slice(0, 5)) {
        const row = document.createElement('button')
        row.type = 'button'
        row.className = 'v2-mini-kanban-card v2-row-clickable'
        const client = clientById.get(d.client_id)
        row.textContent = `${client?.full_name || '(no client)'} — ${Utils.formatCurrency(d.price, d.currency)}`
        row.addEventListener('click', () => Router.open({ entity: 'deal', id: d.id }))
        list.appendChild(row)
      }
      if (stageDeals.length > 5) {
        const more = document.createElement('div')
        more.className = 'v2-kanban-more'
        more.textContent = `+ ${stageDeals.length - 5} more`
        list.appendChild(more)
      }
      col.appendChild(list)
      grid.appendChild(col)
    }
    section.appendChild(grid)
    return section
  }

  function _buildCoaches() {
    const section = document.createElement('section')
    section.className = 'v2-dash-coaches'
    const h = document.createElement('h2')
    h.textContent = 'Coaches'
    section.appendChild(h)

    const vendors = State.get('sales.vendors') || []
    const coaches = vendors.filter(v => v.vendor_type === 'coach')
    if (!coaches.length) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'No coaches yet'
      section.appendChild(empty)
      return section
    }
    const grid = document.createElement('div')
    grid.className = 'v2-coach-grid'
    for (const v of coaches) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'v2-coach-card'
      card.textContent = v.name || v.full_name || v.id
      card.addEventListener('click', () => Router.open({ entity: 'vendor', id: v.id }))
      grid.appendChild(card)
    }
    section.appendChild(grid)
    return section
  }

  return { render }
})()

window.SalesDashboard = SalesDashboard
