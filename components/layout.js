// components/layout.js — Shared layout loader for HSos
// Handles loading topbar + sidebar components and initializing shared layout behavior.
//
// Auth gate: LAYOUT.init() now blocks on a real Supabase auth session
// before any page-specific UI is rendered. There is no demo bypass.
//   - No session              → full-page "Sign in with Google" screen, init() never resolves.
//   - Session, no profile row → full-page "Access pending" screen, init() never resolves.
//   - Session + profile row with non-null system_role → init() proceeds.
// The resolved auth state is cached on window.__hsosAuth = { session, user, profile }.

const NAV_HTML = {
  operations: `
    <div class="sb-nav">
      <div class="sb-section-label">Operations</div>
      <a class="sb-link" id="nav-dashboard" href="deals.html">Home</a>
      <a class="sb-link" id="nav-deals"     href="deals.html?page=deals">Deals</a>
      <a class="sb-link" id="nav-clients"   href="deals.html?page=clients">Clients</a>
      <a class="sb-link" id="nav-vendors"   href="deals.html?page=vendors">Vendors</a>
      <a class="sb-link" id="nav-products"  href="products.html">Products</a>
      <div class="sb-section-label" style="margin-top:8px">Payments</div>
      <a class="sb-link admin-manager-only" id="nav-vendor-bills-ops" href="payments.html?tab=vendor-bills">Vendor Bills</a>
      <div class="sb-section-label" style="margin-top:8px">Tools</div>
      <a class="sb-link" href="import.html">Import</a>
    </div>`,
  workload: `
    <div class="sb-nav">
      <div class="sb-section-label">Workload</div>
      <a class="sb-link" id="nav-log"      href="workload.html">Log session</a>
      <a class="sb-link" id="nav-sessions" href="workload.html?tab=work">Sessions</a>
      <a class="sb-link" id="nav-clients"  href="workload.html?tab=clients">My clients</a>
      <a class="sb-link" id="nav-profile"  href="workload.html?tab=profile">Profile</a>
      <div class="sb-section-label" style="margin-top:8px">Tools</div>
      <a class="sb-link" href="import.html">Import</a>
    </div>`,
  payments: `
    <div class="sb-nav">
      <div class="sb-section-label">Money Flow</div>
      <a class="sb-link" id="nav-transactions"    href="payments.html">Transactions</a>
      <a class="sb-link" id="nav-income"          href="income.html">Income</a>
      <a class="sb-link" id="nav-recurring"       href="recurring.html">Recurring Services</a>
      <a class="sb-link" id="nav-contractors"     href="contractors.html">Contractors &amp; Coaches</a>
      <div class="sb-section-label" style="margin-top:8px">Manage</div>
      <a class="sb-link" id="nav-expected-income" href="payments.html?tab=expected-income">Expected Income</a>
      <a class="sb-link" id="nav-overdue"         href="overdue.html">Open Invoices</a>
      <a class="sb-link" id="nav-vendor-bills"    href="payments.html?tab=vendor-bills">Vendor Bills</a>
      <a class="sb-link" id="nav-history"         href="payments.html?tab=history">History</a>
      <a class="sb-link" id="nav-registry"        href="payments.html?tab=registry">Registry</a>
      <a class="sb-link" id="nav-balances"        href="balances.html">Balances</a>
      <a class="sb-link" id="nav-vendors"         href="payments.html?tab=vendors">Vendor Manager</a>
      <a class="sb-link" id="nav-activity-log"    href="activity-log.html">Activity Log</a>
      <div class="sb-section-label" style="margin-top:8px">Tools</div>
      <a class="sb-link" href="import.html">Import</a>
    </div>`
}

// A Promise that never resolves — used to halt `await LAYOUT.init(...)`
// when the auth gate fails, so page-specific code that awaits init()
// never proceeds to its data-loading / render stage.
const NEVER = new Promise(() => {})

const LAYOUT = {
  async loadComponent(containerId, componentPath) {
    const el = document.getElementById(containerId)
    if (!el) return
    const res = await fetch(componentPath)
    if (!res.ok) { console.error('[LAYOUT] Failed to load:', componentPath, res.status); return }
    el.innerHTML = await res.text()
  },

  setActiveSpace(space) {
    if (!space) return
    const navContainer = document.getElementById('sb-nav-container')
    if (navContainer && NAV_HTML[space]) {
      navContainer.innerHTML = NAV_HTML[space]
    }
    const btn = document.getElementById(`space-btn-${space}`)
    if (btn) btn.classList.add('cur')
  },

  setActiveSidebarLink() {
    const filename = window.location.pathname.split('/').pop() || 'index.html'
    document.querySelectorAll('.sb-link').forEach(link => {
      const href = link.getAttribute('href') || ''
      const linkFile = href.split('?')[0].split('/').pop()
      if (linkFile && linkFile === filename && !href.includes('?')) {
        link.classList.add('cur')
      }
    })
  },

  setPageTitle(title) {
    const el = document.getElementById('topbar-page-title')
    if (el) el.textContent = title
    document.title = `${title} — HSos`
  },

  // ── Auth gate ──────────────────────────────────────────────
  // Resolves to { ok: true, session, user, profile } when allowed,
  // or paints a full-page screen and returns NEVER otherwise.
  async _runAuthGate() {
    if (!window.HSOS_AUTH || typeof getProfile !== 'function') {
      this._renderSignInScreen('Auth layer unavailable')
      return NEVER
    }

    let session = null
    let user = null
    let profile = null

    try {
      session = await window.HSOS_AUTH.getSession()
    } catch (err) {
      this._renderSignInScreen(err?.message || 'Session check failed')
      return NEVER
    }

    if (!session) {
      this._renderSignInScreen()
      return NEVER
    }

    try {
      user = await window.HSOS_AUTH.getUser()
    } catch (_) { user = null }

    if (!user?.id) {
      this._renderSignInScreen('Could not load user')
      return NEVER
    }

    try {
      profile = await getProfile(user.id)
    } catch (err) {
      this._renderPendingScreen(user, err?.message || 'Profile lookup failed')
      return NEVER
    }

    if (!profile || !profile.system_role) {
      this._renderPendingScreen(user)
      return NEVER
    }

    window.__hsosAuth = { session, user, profile }
    return { ok: true, session, user, profile }
  },

  async init(pageTitle, space) {
    const gate = await this._runAuthGate()
    if (!gate || gate.ok !== true) return

    await Promise.all([
      this.loadComponent('layout-topbar', '/components/topbar.html'),
      this.loadComponent('layout-sidebar', '/components/sidebar.html')
    ])

    const envContainer = document.getElementById('env-toggle-container')
    if (envContainer) {
      const res = await fetch('/env-toggle.html')
      if (res.ok) envContainer.innerHTML = await res.text()
      if (typeof initEnvToggle === 'function') initEnvToggle()
    }

    if (typeof renderRoleSelector === 'function') renderRoleSelector()

    this.setActiveSpace(space)
    this.setActiveSidebarLink()
    this.applyRoleRestrictions()
    if (pageTitle) this.setPageTitle(pageTitle)
    BELL.init()
    if (window.USER_MENU?.init) USER_MENU.init()
    this.setRandomCoverPhoto()
    this.initCoverShrink()
  },

  setRandomCoverPhoto() {
    const coverBgs = document.querySelectorAll('.space-cover__bg')
    if (!coverBgs.length) return

    const coverImages = [
      'accounts.png', 'class.png', 'client.png', 'clients.png',
      'company.png', 'create.png', 'flow.png', 'payments.png',
      'products.png', 'sales.png', 'team.png', 'vendors.png',
      'welcome.jpg', 'workload.png'
    ]

    const picked = coverImages[Math.floor(Math.random() * coverImages.length)]
    const imageUrl = `url('/files/${encodeURIComponent(picked)}')`
    coverBgs.forEach(bg => { bg.style.backgroundImage = imageUrl })
  },

  // Sidebar role restrictions — driven by profiles.system_role.
  applyRoleRestrictions() {
    const role = (window.__hsosAuth?.profile?.system_role || '').toLowerCase()

    const spaceRules = {
      'space-btn-operations': role === 'admin' || role === 'finance' || role === 'manager',
      'space-btn-workload':   true,
      'space-btn-payments':   role === 'admin' || role === 'finance',
    }
    Object.entries(spaceRules).forEach(([id, visible]) => {
      const btn = document.getElementById(id)
      if (btn) btn.style.display = visible ? '' : 'none'
    })

    const canManage = role === 'admin' || role === 'manager'
    document.querySelectorAll('.admin-manager-only').forEach(el => {
      el.style.display = canManage ? '' : 'none'
    })

    const switcher = document.getElementById('role-selector')
    if (switcher) switcher.style.display = (role === 'admin') ? '' : 'none'
  },

  initCoverShrink() {
    const cover = document.querySelector('.space-cover')
    if (!cover) return

    const onScroll = (e) => {
      cover.classList.toggle('shrunk', e.target.scrollTop > 40)
    }

    const attach = () => {
      document.querySelectorAll('.app-content .scroll, .app-content [style*="overflow-y"]').forEach(el => {
        el.removeEventListener('scroll', onScroll)
        el.addEventListener('scroll', onScroll, { passive: true })
      })
    }
    attach()

    const appContent = document.querySelector('.app-content')
    if (appContent) {
      const observer = new MutationObserver(attach)
      observer.observe(appContent, { childList: true, subtree: true })
    }
  },

  // ── Gate screens ─────────────────────────────────────────────
  // Both screens replace the entire <body> content so page-specific
  // mount points (.app-content, kanban containers, etc.) no longer
  // exist — page-specific JS that runs in parallel will silently no-op.

  _resetBody() {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild)
    document.body.className = 'hsos-gate-body'
  },

  _googleSvg() {
    // Static markup, no user data. innerHTML is fine here.
    const span = document.createElement('span')
    span.style.display = 'inline-flex'
    span.style.alignItems = 'center'
    span.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A8.96 8.96 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>'
    return span
  },

  _renderSignInScreen(errorMsg) {
    this._resetBody()

    const shell = document.createElement('div')
    shell.className = 'hsos-gate'

    const card = document.createElement('div')
    card.className = 'hsos-gate-card'

    const logo = document.createElement('div')
    logo.className = 'hsos-gate-logo'
    logo.textContent = 'HSos'

    const title = document.createElement('div')
    title.className = 'hsos-gate-title'
    title.textContent = 'Sign in to continue'

    const sub = document.createElement('div')
    sub.className = 'hsos-gate-sub'
    sub.textContent = 'Use your authorized Google account.'

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'hsos-gate-btn'
    btn.appendChild(this._googleSvg())
    const lbl = document.createElement('span')
    lbl.textContent = 'Sign in with Google'
    btn.appendChild(lbl)
    btn.addEventListener('click', () => {
      window.HSOS_AUTH.signInWithGoogle().catch(err => {
        const e = document.getElementById('hsos-gate-error')
        if (e) e.textContent = err?.message || 'Sign in failed'
      })
    })

    const err = document.createElement('div')
    err.id = 'hsos-gate-error'
    err.className = 'hsos-gate-error'
    if (errorMsg) err.textContent = errorMsg

    card.appendChild(logo)
    card.appendChild(title)
    card.appendChild(sub)
    card.appendChild(btn)
    card.appendChild(err)
    shell.appendChild(card)
    document.body.appendChild(shell)
  },

  _renderPendingScreen(user, errorMsg) {
    this._resetBody()

    const shell = document.createElement('div')
    shell.className = 'hsos-gate'

    const card = document.createElement('div')
    card.className = 'hsos-gate-card'

    const logo = document.createElement('div')
    logo.className = 'hsos-gate-logo'
    logo.textContent = 'HSos'

    const title = document.createElement('div')
    title.className = 'hsos-gate-title'
    title.textContent = 'Access pending'

    const sub = document.createElement('div')
    sub.className = 'hsos-gate-sub'
    const email = user?.email || ''
    sub.textContent = email
      ? `Signed in as ${email}. Waiting for an admin to assign your role.`
      : 'Waiting for an admin to assign your role.'

    const out = document.createElement('button')
    out.type = 'button'
    out.className = 'hsos-gate-btn hsos-gate-btn-ghost'
    out.textContent = 'Sign out'
    out.addEventListener('click', () => {
      window.HSOS_AUTH.signOut().catch(() => { /* swallow */ })
    })

    card.appendChild(logo)
    card.appendChild(title)
    card.appendChild(sub)
    card.appendChild(out)

    if (errorMsg) {
      const err = document.createElement('div')
      err.className = 'hsos-gate-error'
      err.textContent = errorMsg
      card.appendChild(err)
    }

    shell.appendChild(card)
    document.body.appendChild(shell)
  },
}

window.LAYOUT = LAYOUT

// ─── BELL notification dropdown ──────────────────────────────

function _bellStripMd(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

const BELL = {
  _open: false,
  _items: [],

  _lastSeen() {
    return parseInt(localStorage.getItem('hsos_bell_last_seen') || '0', 10)
  },

  _markSeen() {
    localStorage.setItem('hsos_bell_last_seen', String(Date.now()))
  },

  _unreadCount(items) {
    const lastSeen = this._lastSeen()
    let count = 0
    for (const a of items) {
      if (a.type === 'reminder' && a.status === 'pending') count++
      if (a.origin === 'integration' && new Date(a.created_at).getTime() > lastSeen) count++
    }
    return count
  },

  _fmtDue(ts) {
    if (!ts) return null
    const d = new Date(ts)
    const diff = d - new Date()
    if (diff < 0)        return `<span style="color:var(--red-text)">overdue ${d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</span>`
    if (diff < 86400000) return `<span style="color:var(--amber-text)">due today</span>`
    return `due ${d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}`
  },

  _icon(a) {
    if (a.type === 'reminder')      return '🔔'
    if (a.origin === 'integration') return '⚡'
    return '📌'
  },

  async _load() {
    const list = document.getElementById('bell-list')
    if (!list) return
    list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--mu2);font-size:12px">Loading…</div>'
    try {
      if (typeof getNotifications !== 'function') throw new Error('getNotifications not available')
      this._items = await getNotifications()
    } catch (err) {
      list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--red-text);font-size:12px">Failed to load</div>'
      return
    }
    this._render()
    this._updateBadge()
  },

  _render() {
    const list = document.getElementById('bell-list')
    if (!list) return

    if (!this._items.length) {
      list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--mu2);font-size:12px">No notifications</div>'
      return
    }

    list.innerHTML = this._items.map(a => {
      const stripped  = _bellStripMd(a.body || '')
      const preview   = stripped.slice(0, 80) + (stripped.length > 80 ? '…' : '')
      const dueStr    = this._fmtDue(a.due_at)
      const isPending = a.type === 'reminder' && a.status === 'pending'
      const entityCtx = a.meta?.context
        ? Object.entries(a.meta.context).filter(([,v]) => v).map(([k]) => k.replace('_id','')).join(', ')
        : ''
      return `
        <div style="padding:10px 16px;border-bottom:1px solid var(--border2);display:flex;gap:10px;align-items:flex-start">
          <span style="font-size:16px;flex-shrink:0;line-height:1.4">${this._icon(a)}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;color:var(--ink);line-height:1.4;word-break:break-word">${preview || '(no body)'}</div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:4px;flex-wrap:wrap">
              ${dueStr    ? `<span style="font-size:10px">${dueStr}</span>` : ''}
              ${entityCtx ? `<span style="font-size:10px;color:var(--mu);font-family:var(--font-mono)">${entityCtx}</span>` : ''}
            </div>
            ${isPending ? `
              <div style="display:flex;gap:6px;margin-top:6px">
                <button style="font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:var(--green-bg);color:var(--green-text);cursor:pointer"
                        onclick="BELL.patchItem('${a.id}','done')">Done</button>
                <button style="font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--mu);cursor:pointer"
                        onclick="BELL.patchItem('${a.id}','dismissed')">Dismiss</button>
              </div>` : ''}
          </div>
        </div>`
    }).join('')
  },

  _updateBadge() {
    const badge = document.getElementById('bell-badge')
    if (!badge) return
    const count = this._unreadCount(this._items)
    badge.textContent = count > 99 ? '99+' : String(count)
    badge.style.display = count > 0 ? 'flex' : 'none'
  },

  async toggle() {
    const dropdown = document.getElementById('bell-dropdown')
    if (!dropdown) return
    this._open = !this._open
    dropdown.style.display = this._open ? 'flex' : 'none'
    if (this._open) {
      await this._load()
      this._markSeen()
    }
  },

  close() {
    const dropdown = document.getElementById('bell-dropdown')
    if (dropdown) dropdown.style.display = 'none'
    this._open = false
  },

  async patchItem(id, newStatus) {
    try {
      await updateActivity(id, { status: newStatus })
    } catch (err) {
      console.error('[BELL] patch failed', err)
      return
    }
    this._items = this._items.map(a => a.id === id ? { ...a, status: newStatus } : a)
    this._render()
    this._updateBadge()
  },

  async markAllDone() {
    const pending = this._items.filter(a => a.type === 'reminder' && a.status === 'pending')
    await Promise.all(pending.map(a => updateActivity(a.id, { status: 'done' }).catch(err => console.error('[BELL] patch failed', err))))
    this._items = this._items.map(a =>
      a.type === 'reminder' && a.status === 'pending' ? { ...a, status: 'done' } : a
    )
    this._render()
    this._updateBadge()
  },

  async init() {
    try {
      if (typeof getNotifications !== 'function') return
      this._items = await getNotifications()
      this._updateBadge()
    } catch (_) { /* non-fatal */ }

    document.addEventListener('click', e => {
      const container = document.getElementById('bell-container')
      const dropdown  = document.getElementById('bell-dropdown')
      if (!container || !dropdown) return
      if (!container.contains(e.target) && !dropdown.contains(e.target)) {
        this.close()
      }
    })
  },
}

window.BELL = BELL
