// v2/spaces/operations/operations-init.js — Operations space bootstrap.
// Decides which vendor to show (vendor role uses own id; admin/manager uses a
// picker persisted in sessionStorage). Loads per-vendor data once, then swaps
// between four tabs: log / sessions / clients / profile.
// State keys used across the space:
//   ops.vendor          → { id, name, vendor_type, ... }
//   ops.clients         → clients assigned to the active vendor
//   ops.sessions        → vendor's sessions (current + history)
//   ops.bills           → vendor's bills
//   ops.taskTypes       → lookup (legacy; kept for old session display)
//   ops.rates           → vendor's rates (powers Log session rate selector)
//   ops.packages        → packages where vendor is assigned

const OpsInit = (() => {
  const TABS = ['log', 'sessions', 'clients', 'profile']
  const PICKER_KEY = 'hsos_v2_ops_vendor_id'

  async function start() {
    if (!Guard.space('operations')) return
    Layout.init({ space: 'operations', pageTitle: 'Operations' })

    const role = Auth.getRole()
    let vendorId = null
    if (role === 'vendor') {
      vendorId = Auth.getVendorId()
      if (!vendorId) {
        _showVendorMissing()
        return
      }
    } else {
      vendorId = sessionStorage.getItem(PICKER_KEY) || null
    }

    try {
      // Admin/manager may not have picked a vendor yet — show the picker.
      if (!vendorId) {
        await _showVendorPicker()
        return
      }
      await _loadVendorData(vendorId)
      _mountLayout()
      const params = Router.getParams()
      const tab = TABS.includes(params.tab) ? params.tab : 'log'
      _switchTab(tab)
      window.addEventListener('popstate', () => {
        const p = Router.getParams().tab || 'log'
        if (TABS.includes(p)) _switchTab(p)
      })
    } catch (err) {
      console.error('[OpsInit] start failed', err)
      Utils.showToast(err.message || 'Failed to load operations', 'error')
    }
  }

  async function _loadVendorData(vendorId) {
    const [vendor, taskTypes, rates] = await Promise.all([
      DB.getVendor(vendorId),
      DB.getTaskTypes(),
      DB.getRates(vendorId)
    ])
    if (!vendor) {
      Utils.showToast(`Vendor ${vendorId} not found`, 'error')
      sessionStorage.removeItem(PICKER_KEY)
      throw new Error('vendor not found')
    }
    State.set('ops.vendor', vendor)
    State.set('ops.taskTypes', taskTypes)
    State.set('ops.rates', rates)
    await _refreshVendorScopedData(vendorId)
  }

  async function _refreshVendorScopedData(vendorId) {
    const [sessions, bills, assignments, clients, packages] = await Promise.all([
      DB.getSessions({ vendor_id: vendorId }),
      DB.getBills({ vendor_id: vendorId }),
      DB.getVendorClientAssignments(),
      DB.getClients(),
      DB.getPackages()
    ])
    State.set('ops.sessions', sessions)
    State.set('ops.bills', bills)
    // vendor_client_assignments.vendor_id is uuid; vendors.id is text. Compare strings.
    const vendorUuid = DB._toUUID(vendorId)
    const myClientIds = new Set(
      assignments.filter(a => vendorUuid && a.vendor_id === vendorUuid).map(a => a.client_id)
    )
    State.set('ops.clients', clients.filter(c => myClientIds.has(c.id)))
    State.set('ops.packages', packages.filter(p => p.vendor_id === vendorId))
  }

  function _mountLayout() {
    const mount = Layout.appContentEl()
    if (!mount) return
    while (mount.firstChild) mount.removeChild(mount.firstChild)

    const header = document.createElement('header')
    header.className = 'v2-page-header v2-ops-header'

    const title = document.createElement('h1')
    const vendor = State.get('ops.vendor')
    title.textContent = `Operations — ${vendor?.name || vendor?.id}`
    header.appendChild(title)

    // Admin/manager get a "switch vendor" button
    if (Auth.getRole() !== 'vendor') {
      const controls = document.createElement('div')
      controls.className = 'v2-page-controls'
      const switcher = document.createElement('button')
      switcher.type = 'button'
      switcher.className = 'btn btn-ghost btn-sm'
      switcher.textContent = 'Switch vendor'
      switcher.addEventListener('click', () => _showVendorPicker())
      controls.appendChild(switcher)
      header.appendChild(controls)
    }

    const tabBar = document.createElement('nav')
    tabBar.className = 'v2-tabbar v2-ops-tabs'
    for (const t of TABS) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'v2-tab'
      b.dataset.tab = t
      b.textContent = _tabLabel(t)
      b.addEventListener('click', () => _switchTab(t, { pushUrl: true }))
      tabBar.appendChild(b)
    }

    const body = document.createElement('div')
    body.className = 'v2-ops-body'
    body.id = 'v2-ops-body'

    mount.append(header, tabBar, body)
  }

  function _tabLabel(t) {
    if (t === 'log')      return 'Log session'
    if (t === 'sessions') return 'Sessions'
    if (t === 'clients')  return 'My clients'
    if (t === 'profile')  return 'Profile'
    return t
  }

  function _switchTab(tab, opts) {
    const body = document.getElementById('v2-ops-body')
    if (!body) return
    while (body.firstChild) body.removeChild(body.firstChild)

    for (const b of document.querySelectorAll('.v2-ops-tabs .v2-tab')) {
      b.classList.toggle('v2-tab-active', b.dataset.tab === tab)
    }

    if (tab === 'log')      OpsLog.render(body)
    if (tab === 'sessions') OpsSessions.render(body)
    if (tab === 'clients')  OpsClients.render(body)
    if (tab === 'profile')  OpsProfile.render(body)

    if (opts?.pushUrl) {
      const url = window.location.pathname + `?tab=${encodeURIComponent(tab)}`
      window.history.pushState({ tab }, '', url)
    }
  }

  // ─── Admin/manager vendor picker ──────────────────────────────
  async function _showVendorPicker() {
    const [vendors, assignments] = await Promise.all([
      DB.getVendors(),
      DB.getVendorClientAssignments()
    ])
    // Count active (valid_to IS NULL) clients per vendor
    const clientCount = new Map()
    for (const a of assignments) {
      if (a.valid_to) continue
      clientCount.set(a.vendor_id, (clientCount.get(a.vendor_id) || 0) + 1)
    }
    // Vendors with clients first, then alphabetical
    const sorted = vendors.slice().sort((a, b) => {
      const ca = clientCount.get(a.id) || 0
      const cb = clientCount.get(b.id) || 0
      if (ca !== cb) return cb - ca
      return (a.name || '').localeCompare(b.name || '')
    })

    const body = document.createElement('div')

    const search = document.createElement('input')
    search.type = 'search'
    search.className = 'fi'
    search.placeholder = 'Search vendors…'
    body.appendChild(search)

    const list = document.createElement('div')
    list.className = 'v2-vendor-picker-list'
    body.appendChild(list)

    function repaint(q) {
      const needle = (q || '').toLowerCase()
      const filtered = sorted.filter(v => {
        if (!needle) return true
        const hay = [v.name, v.full_name, v.email, v.id].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(needle)
      })
      while (list.firstChild) list.removeChild(list.firstChild)
      for (const v of filtered.slice(0, 40)) {
        const row = document.createElement('button')
        row.type = 'button'
        row.className = 'v2-vendor-picker-row'
        const cnt = clientCount.get(v.id) || 0
        const clientLabel = cnt === 0 ? 'no clients'
                          : cnt === 1 ? '1 client'
                          : `${cnt} clients`
        row.textContent = `${v.name || v.id} — ${clientLabel}`
        row.addEventListener('click', async () => {
          sessionStorage.setItem(PICKER_KEY, v.id)
          m.close()
          try {
            await _loadVendorData(v.id)
            _mountLayout()
            _switchTab('log')
          } catch (err) {
            Utils.showToast(err.message || 'Failed to load vendor', 'error')
          }
        })
        list.appendChild(row)
      }
      if (!filtered.length) {
        const empty = document.createElement('div')
        empty.className = 'v2-empty'
        empty.textContent = 'No matches'
        list.appendChild(empty)
      }
    }

    let t = null
    search.addEventListener('input', e => {
      clearTimeout(t)
      t = setTimeout(() => repaint(e.target.value), 120)
    })
    repaint('')

    const m = Modal.open({
      title: 'Pick a vendor',
      size: 'md',
      body,
      actions: [{ label: 'Cancel', variant: 'ghost', onClick: () => m.close() }],
      closeOnBackdrop: false
    })
  }

  function _showVendorMissing() {
    const mount = Layout.appContentEl()
    if (!mount) return
    while (mount.firstChild) mount.removeChild(mount.firstChild)
    const box = document.createElement('div')
    box.className = 'v2-empty'
    box.textContent = 'No vendor id bound to this vendor account. Ask an admin to finish setup.'
    mount.appendChild(box)
  }

  // Expose refresh for nested modules (e.g. after logging a session or sending a bill)
  function refresh() {
    const vendor = State.get('ops.vendor')
    if (!vendor) return Promise.resolve()
    return _refreshVendorScopedData(vendor.id)
  }

  document.addEventListener('DOMContentLoaded', start)

  return { start, refresh, switchTab: _switchTab }
})()

window.OpsInit = OpsInit
