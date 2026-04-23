// v2/components/layout.js — Topbar + sidebar for v2 spaces.
// Builds chrome from JS (no HTML partials) to keep the rebuild self-contained.
// Space nav is declared per-space below. Applies Guard.canAccessSpace() to
// hide spaces the current role can't reach.
// Deps: Utils, Auth, Guard, DB (for Bell notifications).

const Layout = (() => {
  // ─── Space + nav config ────────────────────────────────────────
  // href is relative from v2/spaces/<space>/ — callers pass a prefix.
  const SPACES = [
    { key: 'sales',      label: 'Sales',      href: '../sales/sales.html' },
    { key: 'operations', label: 'Operations', href: '../operations/operations.html' },
    { key: 'payments',   label: 'Payments',   href: '../payments/payments.html' }
  ]

  const NAV_BY_SPACE = {
    sales: [
      { id: 'dashboard', label: 'Dashboard', href: 'sales.html' },
      { id: 'deals',     label: 'Deals',     href: 'sales.html?page=deals' },
      { id: 'clients',   label: 'Clients',   href: 'sales.html?page=clients' },
      { id: 'vendors',   label: 'Vendors',   href: 'sales.html?page=vendors' },
      { id: 'products',  label: 'Products',  href: 'sales.html?page=products' }
    ],
    operations: [
      { id: 'log',       label: 'Log session', href: 'operations.html' },
      { id: 'sessions',  label: 'Sessions',    href: 'operations.html?tab=sessions' },
      { id: 'myclients', label: 'My clients',  href: 'operations.html?tab=clients' },
      { id: 'profile',   label: 'Profile',     href: 'operations.html?tab=profile' }
    ],
    payments: [
      { id: 'transactions', label: 'Transactions',    href: 'payments.html' },
      { id: 'income',       label: 'Expected income', href: 'payments.html?tab=income' },
      { id: 'bills',        label: 'Vendor bills',    href: 'payments.html?tab=bills' },
      { id: 'history',      label: 'History',         href: 'payments.html?tab=history' },
      { id: 'balances',     label: 'Balances',        href: 'payments.html?tab=balances' },
      { id: 'matching',     label: 'Vendor matching', href: 'payments.html?tab=matching' },
      { id: 'registry',     label: 'Registry',        href: 'payments.html?tab=registry' }
    ]
  }

  // ─── init ──────────────────────────────────────────────────────
  function init({ space, pageTitle, rootSelector = '#layout-root' } = {}) {
    Auth.init()
    const root = document.querySelector(rootSelector)
    if (!root) {
      console.error(`[Layout] root not found: ${rootSelector}`)
      return
    }
    while (root.firstChild) root.removeChild(root.firstChild)

    root.appendChild(_buildTopbar(pageTitle))
    root.appendChild(_buildSidebar(space))
    root.appendChild(_buildMain())

    document.title = pageTitle ? `${pageTitle} — HSos` : 'HSos'
    document.body.dataset.role = Auth.getRole()

    Auth.onChange(() => {
      document.body.dataset.role = Auth.getRole()
      _applyRoleVisibility(space)
    })
    _applyRoleVisibility(space)
    Bell.init()
  }

  function mainEl() {
    return document.querySelector('.v2-main') || null
  }

  function appContentEl() {
    return document.querySelector('.v2-app-content') || null
  }

  // ─── Topbar ────────────────────────────────────────────────────
  function _buildTopbar(pageTitle) {
    const bar = document.createElement('header')
    bar.className = 'v2-topbar'

    const brand = document.createElement('div')
    brand.className = 'v2-topbar-brand'
    brand.textContent = 'HSos'
    bar.appendChild(brand)

    const title = document.createElement('div')
    title.className = 'v2-topbar-title'
    title.id = 'v2-topbar-title'
    title.textContent = pageTitle || ''
    bar.appendChild(title)

    const right = document.createElement('div')
    right.className = 'v2-topbar-right'

    right.appendChild(_buildRolePicker())
    right.appendChild(Bell.el())
    bar.appendChild(right)
    return bar
  }

  function _buildRolePicker() {
    const wrap = document.createElement('div')
    wrap.className = 'v2-role-picker'
    const sel = document.createElement('select')
    sel.className = 'fi'
    sel.setAttribute('aria-label', 'Role')
    for (const r of Auth.VALID_ROLES) {
      const o = document.createElement('option')
      o.value = r
      o.textContent = r.charAt(0).toUpperCase() + r.slice(1)
      if (r === Auth.getRole()) o.selected = true
      sel.appendChild(o)
    }
    sel.addEventListener('change', e => Auth.setRole(e.target.value))
    wrap.appendChild(sel)
    return wrap
  }

  // ─── Sidebar ───────────────────────────────────────────────────
  function _buildSidebar(activeSpace) {
    const sb = document.createElement('nav')
    sb.className = 'v2-sidebar'
    sb.setAttribute('aria-label', 'Main navigation')

    // Space switcher
    const switcher = document.createElement('div')
    switcher.className = 'v2-space-switcher'
    for (const s of SPACES) {
      const a = document.createElement('a')
      a.className = 'v2-space-btn'
      a.dataset.space = s.key
      a.href = s.href
      a.textContent = s.label
      if (s.key === activeSpace) a.classList.add('v2-space-btn-active')
      switcher.appendChild(a)
    }
    sb.appendChild(switcher)

    // Space-specific nav
    const items = NAV_BY_SPACE[activeSpace] || []
    const nav = document.createElement('div')
    nav.className = 'v2-sb-nav'
    for (const it of items) {
      const a = document.createElement('a')
      a.className = 'v2-sb-link'
      a.dataset.navId = it.id
      a.href = it.href
      a.textContent = it.label
      nav.appendChild(a)
    }
    sb.appendChild(nav)
    _markCurrentSidebarLink(nav)
    return sb
  }

  function _markCurrentSidebarLink(nav) {
    const here = window.location.pathname.split('/').pop() || ''
    const hereParams = new URLSearchParams(window.location.search)
    for (const link of nav.querySelectorAll('.v2-sb-link')) {
      const url = new URL(link.getAttribute('href'), window.location.href)
      const linkPage = url.pathname.split('/').pop()
      if (linkPage !== here) continue
      const tabKey = url.searchParams.get('tab') || url.searchParams.get('page')
      const hereTab = hereParams.get('tab') || hereParams.get('page')
      if ((tabKey || null) === (hereTab || null)) link.classList.add('v2-sb-link-active')
    }
  }

  function _buildMain() {
    const main = document.createElement('main')
    main.className = 'v2-main'
    const content = document.createElement('div')
    content.className = 'v2-app-content'
    content.id = 'v2-app-content'
    main.appendChild(content)
    return main
  }

  function _applyRoleVisibility(currentSpace) {
    for (const btn of document.querySelectorAll('.v2-space-btn')) {
      const s = btn.dataset.space
      btn.style.display = Guard.canAccessSpace(s) ? '' : 'none'
    }
    // If the user navigated to a space they can't access, the page-level
    // Guard.space() call will have already redirected — nothing to do here.
  }

  // ─── Bell (notifications dropdown) ─────────────────────────────
  const Bell = (() => {
    let _container = null
    let _items = []
    let _open = false

    function el() {
      if (_container && document.body.contains(_container)) return _container
      _container = document.createElement('div')
      _container.className = 'v2-bell'

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'v2-bell-btn btn btn-ghost btn-sm'
      btn.setAttribute('aria-label', 'Notifications')
      btn.textContent = '🔔'

      const badge = document.createElement('span')
      badge.className = 'v2-bell-badge'
      badge.style.display = 'none'
      btn.appendChild(badge)

      const dropdown = document.createElement('div')
      dropdown.className = 'v2-bell-dropdown'
      dropdown.style.display = 'none'

      _container.append(btn, dropdown)
      btn.addEventListener('click', toggle)
      document.addEventListener('click', e => {
        if (!_container.contains(e.target)) hide()
      })
      return _container
    }

    async function init() {
      try {
        _items = await DB.getNotifications()
        _updateBadge()
      } catch (err) {
        console.error('[Bell] load failed', err)
      }
    }

    async function toggle() {
      _open = !_open
      const dropdown = _container.querySelector('.v2-bell-dropdown')
      dropdown.style.display = _open ? 'block' : 'none'
      if (_open) {
        try { _items = await DB.getNotifications() } catch (err) { console.error('[Bell]', err) }
        _render()
        localStorage.setItem('hsos_v2_bell_last_seen', String(Date.now()))
        _updateBadge()
      }
    }

    function hide() {
      _open = false
      if (_container) {
        const dropdown = _container.querySelector('.v2-bell-dropdown')
        if (dropdown) dropdown.style.display = 'none'
      }
    }

    function _render() {
      const dropdown = _container.querySelector('.v2-bell-dropdown')
      while (dropdown.firstChild) dropdown.removeChild(dropdown.firstChild)
      if (!_items.length) {
        const empty = document.createElement('div')
        empty.className = 'v2-bell-empty'
        empty.textContent = 'No notifications'
        dropdown.appendChild(empty)
        return
      }
      for (const it of _items) dropdown.appendChild(_renderItem(it))
    }

    function _renderItem(a) {
      const row = document.createElement('div')
      row.className = 'v2-bell-item'
      const icon = document.createElement('span')
      icon.className = 'v2-bell-icon'
      icon.textContent = a.type === 'reminder' ? '🔔' : a.origin === 'integration' ? '⚡' : '📌'
      const body = document.createElement('div')
      body.className = 'v2-bell-body'
      const preview = (a.body || '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
      body.textContent = preview || '(no body)'
      row.append(icon, body)

      if (a.type === 'reminder' && a.status === 'pending') {
        const actions = document.createElement('div')
        actions.className = 'v2-bell-actions'
        const doneBtn = document.createElement('button')
        doneBtn.type = 'button'
        doneBtn.className = 'btn btn-sm'
        doneBtn.textContent = 'Done'
        doneBtn.addEventListener('click', () => _patch(a.id, 'done'))
        const dismissBtn = document.createElement('button')
        dismissBtn.type = 'button'
        dismissBtn.className = 'btn btn-ghost btn-sm'
        dismissBtn.textContent = 'Dismiss'
        dismissBtn.addEventListener('click', () => _patch(a.id, 'dismissed'))
        actions.append(doneBtn, dismissBtn)
        row.appendChild(actions)
      }
      return row
    }

    async function _patch(id, status) {
      try { await DB.updateActivity(id, { status }) }
      catch (err) { Utils.showToast(err.message || 'Update failed', 'error'); return }
      _items = _items.map(it => it.id === id ? { ...it, status } : it)
      _render()
      _updateBadge()
    }

    function _updateBadge() {
      if (!_container) return
      const badge = _container.querySelector('.v2-bell-badge')
      const lastSeen = Number(localStorage.getItem('hsos_v2_bell_last_seen') || 0)
      const count = _items.reduce((n, a) => {
        if (a.type === 'reminder' && a.status === 'pending') return n + 1
        if (a.origin === 'integration' && new Date(a.created_at).getTime() > lastSeen) return n + 1
        return n
      }, 0)
      badge.textContent = count > 99 ? '99+' : String(count)
      badge.style.display = count > 0 ? '' : 'none'
    }

    return { el, init }
  })()

  return { init, mainEl, appContentEl, SPACES, NAV_BY_SPACE }
})()

window.Layout = Layout
