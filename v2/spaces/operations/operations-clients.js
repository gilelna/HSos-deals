// v2/spaces/operations/operations-clients.js — My clients tab.
// Lists the active vendor's assigned clients with package progress bars.

const OpsClients = (() => {
  function render(mount) {
    const clients = State.get('ops.clients') || []
    const packages = State.get('ops.packages') || []
    const sessions = State.get('ops.sessions') || []

    if (!clients.length) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'No clients assigned yet.'
      mount.appendChild(empty)
      return
    }

    const pkgByClient = new Map()
    for (const p of packages) {
      if (p.status !== 'active') continue
      if (!pkgByClient.has(p.client_id)) pkgByClient.set(p.client_id, [])
      pkgByClient.get(p.client_id).push(p)
    }

    const sessCountByClient = new Map()
    for (const s of sessions) {
      sessCountByClient.set(s.client_id, (sessCountByClient.get(s.client_id) || 0) + 1)
    }

    const grid = document.createElement('div')
    grid.className = 'v2-ops-clients-grid'
    for (const c of clients) grid.appendChild(_card(c, pkgByClient.get(c.id) || [], sessCountByClient.get(c.id) || 0))
    mount.appendChild(grid)
  }

  function _card(client, pkgs, sessionsLogged) {
    const card = document.createElement('article')
    card.className = 'v2-ops-client-card'

    const head = document.createElement('header')
    head.className = 'v2-ops-client-card-head'

    const name = document.createElement('div')
    name.className = 'v2-ops-client-card-name'
    name.textContent = client.full_name || client.id
    head.appendChild(name)

    if (client.email) {
      const email = document.createElement('div')
      email.className = 'v2-ops-client-card-email'
      email.textContent = client.email
      head.appendChild(email)
    }
    card.appendChild(head)

    const stats = document.createElement('div')
    stats.className = 'v2-ops-client-card-stats'
    stats.appendChild(_statChip('Sessions logged', String(sessionsLogged)))
    card.appendChild(stats)

    if (pkgs.length) {
      const pkgWrap = document.createElement('div')
      pkgWrap.className = 'v2-ops-client-pkgs'
      for (const p of pkgs) pkgWrap.appendChild(_packageRow(p))
      card.appendChild(pkgWrap)
    } else {
      const none = document.createElement('div')
      none.className = 'v2-ops-client-no-pkg'
      none.textContent = 'No active package'
      card.appendChild(none)
    }

    return card
  }

  function _packageRow(pkg) {
    const row = document.createElement('div')
    row.className = 'v2-ops-pkg-row'

    const used = Number(pkg.sessions_used) || 0
    const total = Number(pkg.sessions_total) || Number(pkg.total_sessions) || 0
    const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0

    const top = document.createElement('div')
    top.className = 'v2-ops-pkg-top'
    const label = document.createElement('span')
    label.textContent = `Package ${used}/${total}`
    const right = document.createElement('span')
    right.className = 'v2-mu'
    right.textContent = total > 0 ? `${pct}%` : '—'
    top.append(label, right)
    row.appendChild(top)

    const bar = document.createElement('div')
    bar.className = 'v2-progress-bar'
    const fill = document.createElement('div')
    fill.className = 'v2-progress-fill'
    fill.style.width = `${pct}%`
    bar.appendChild(fill)
    row.appendChild(bar)

    return row
  }

  function _statChip(label, value) {
    const chip = document.createElement('div')
    chip.className = 'v2-stat-chip'
    const v = document.createElement('span')
    v.className = 'v2-stat-chip-value'
    v.textContent = value
    const l = document.createElement('span')
    l.className = 'v2-stat-chip-label'
    l.textContent = label
    chip.append(v, l)
    return chip
  }

  return { render }
})()

window.OpsClients = OpsClients
