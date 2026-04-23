// v2/spaces/payments/payments-income.js — Expected income.
// Pipeline view: pending deals grouped by billing status, with package progress.

const PayIncome = (() => {
  const PIPELINE_STATUSES = ['pending', 'link_sent', 'invoiced', 'partial']

  function render(mount) {
    const wrap = document.createElement('div')
    wrap.className = 'v2-pay-income'
    mount.appendChild(wrap)
    _reload(wrap)
  }

  async function _reload(wrap) {
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild)
    const loading = document.createElement('div')
    loading.className = 'v2-empty'
    loading.textContent = 'Loading expected income…'
    wrap.appendChild(loading)

    try {
      const [deals, clients, products, packages] = await Promise.all([
        DB.getDeals(), DB.getClients(), DB.getAllProductsWithPlans(), DB.getPackages()
      ])
      loading.remove()
      const clientById = new Map(clients.map(c => [c.id, c]))
      const productById = new Map(products.map(p => [p.id, p]))
      const pkgByDeal = new Map()
      for (const p of packages) if (!pkgByDeal.has(p.deal_id)) pkgByDeal.set(p.deal_id, p)

      const pipeline = deals.filter(d => PIPELINE_STATUSES.includes(d.billing_status))

      wrap.appendChild(_summary(pipeline))

      for (const status of PIPELINE_STATUSES) {
        const group = pipeline.filter(d => d.billing_status === status)
        if (!group.length) continue
        wrap.appendChild(_section(status, group, clientById, productById, pkgByDeal))
      }

      if (!pipeline.length) {
        const empty = document.createElement('div')
        empty.className = 'v2-empty'
        empty.textContent = 'Nothing in the pipeline.'
        wrap.appendChild(empty)
      }
    } catch (err) {
      loading.textContent = err.message || 'Failed to load'
    }
  }

  function _summary(deals) {
    const totalByCurrency = {}
    for (const d of deals) {
      const cur = d.currency || 'USD'
      totalByCurrency[cur] = (totalByCurrency[cur] || 0) + (Number(d.price) || 0)
    }
    const section = document.createElement('section')
    section.className = 'v2-kpi-grid'
    for (const [cur, total] of Object.entries(totalByCurrency)) {
      const card = document.createElement('div')
      card.className = 'v2-kpi-card'
      const label = document.createElement('div')
      label.className = 'v2-kpi-label'
      label.textContent = `Pipeline ${cur}`
      const value = document.createElement('div')
      value.className = 'v2-kpi-value'
      value.textContent = Utils.formatCurrency(total, cur)
      card.append(label, value)
      section.appendChild(card)
    }
    const count = document.createElement('div')
    count.className = 'v2-kpi-card'
    const cl = document.createElement('div')
    cl.className = 'v2-kpi-label'
    cl.textContent = 'Deals'
    const cv = document.createElement('div')
    cv.className = 'v2-kpi-value'
    cv.textContent = String(deals.length)
    count.append(cl, cv)
    section.appendChild(count)
    return section
  }

  function _section(status, group, clientById, productById, pkgByDeal) {
    const section = document.createElement('section')
    section.className = 'v2-pay-income-section'
    const h = document.createElement('h2')
    h.textContent = `${Const.BILLING_STATUS_LABELS[status] || status} (${group.length})`
    section.appendChild(h)

    const list = document.createElement('div')
    list.className = 'v2-pay-income-list'
    for (const d of group) {
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'v2-pay-income-row'
      row.addEventListener('click', () => Router.open({ entity: 'deal', id: d.id }))

      const name = document.createElement('div')
      name.className = 'v2-pay-income-name'
      const client = clientById.get(d.client_id)
      const prod = productById.get(d.product_id)
      name.textContent = `${client?.full_name || '(no client)'} — ${prod?.name || 'Deal'}`

      const amount = document.createElement('div')
      amount.className = 'v2-pay-income-amount'
      amount.textContent = Utils.formatCurrency(d.price, d.currency)

      row.append(name, amount)

      const pkg = pkgByDeal.get(d.id)
      const pkgTotal = Number(pkg?.sessions_total) || Number(pkg?.total_sessions) || 0
      if (pkg && pkgTotal > 0) {
        const pkgRow = document.createElement('div')
        pkgRow.className = 'v2-pay-income-pkg'
        const used = Number(pkg.sessions_used) || 0
        const total = pkgTotal
        const pct = Math.min(100, Math.round((used / total) * 100))
        const label = document.createElement('span')
        label.textContent = `Package ${used}/${total}`
        pkgRow.appendChild(label)
        const bar = document.createElement('div')
        bar.className = 'v2-progress-bar'
        const fill = document.createElement('div')
        fill.className = 'v2-progress-fill'
        fill.style.width = `${pct}%`
        bar.appendChild(fill)
        pkgRow.appendChild(bar)
        row.appendChild(pkgRow)
      }

      list.appendChild(row)
    }
    section.appendChild(list)
    return section
  }

  return { render }
})()

window.PayIncome = PayIncome
