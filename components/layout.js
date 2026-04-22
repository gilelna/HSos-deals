// components/layout.js — Shared layout loader for HSos
// Handles loading topbar + sidebar components and initializing shared layout behavior.

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
      <a class="sb-link" id="nav-vendor-bills"    href="payments.html?tab=vendor-bills">Vendor Bills</a>
      <a class="sb-link" id="nav-history"         href="payments.html?tab=history">History</a>
      <a class="sb-link" id="nav-registry"        href="payments.html?tab=registry">Registry</a>
      <a class="sb-link" id="nav-balances"        href="payments.html?tab=balances">Balances</a>
      <a class="sb-link" id="nav-vendors"         href="payments.html?tab=vendors">Vendor Manager</a>
      <a class="sb-link" id="nav-activity-log"    href="activity-log.html">Activity Log</a>
      <div class="sb-section-label" style="margin-top:8px">Tools</div>
      <a class="sb-link" href="import.html">Import</a>
    </div>`
}

const LAYOUT = {
  // Load a component's HTML into a container element by ID
  async loadComponent(containerId, componentPath) {
    const el = document.getElementById(containerId)
    if (!el) return
    const res = await fetch(componentPath)
    if (!res.ok) { console.error('[LAYOUT] Failed to load:', componentPath, res.status); return }
    el.innerHTML = await res.text()
  },

  // Inject the correct nav section for the active space and mark the space button active
  // space: 'operations' | 'workload' | 'payments'
  setActiveSpace(space) {
    if (!space) return
    // Inject the correct nav HTML into the nav container
    const navContainer = document.getElementById('sb-nav-container')
    if (navContainer && NAV_HTML[space]) {
      navContainer.innerHTML = NAV_HTML[space]
    }
    // Mark the active space button
    const btn = document.getElementById(`space-btn-${space}`)
    if (btn) btn.classList.add('cur')
  },

  // Set the active sidebar nav link based on current page filename
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

  // Set page title in topbar placeholder and <title> tag
  setPageTitle(title) {
    const el = document.getElementById('topbar-page-title')
    if (el) el.textContent = title
    document.title = `${title} — HSos`
  },

  // Initialize the full layout:
  //   pageTitle  — shown in topbar and <title>
  //   space      — 'operations' | 'workload' | 'payments' (controls which sidebar nav is shown)
  async init(pageTitle, space) {
    await Promise.all([
      this.loadComponent('layout-topbar', '/components/topbar.html'),
      this.loadComponent('layout-sidebar', '/components/sidebar.html')
    ])

    // Load env-toggle into its container inside the topbar component
    const envContainer = document.getElementById('env-toggle-container')
    if (envContainer) {
      const res = await fetch('/env-toggle.html')
      if (res.ok) envContainer.innerHTML = await res.text()
      // Init toggle UI — functions live in env-config.js (not in the injected HTML)
      if (typeof initEnvToggle === 'function') initEnvToggle()
    }

    // Render role selector (app.js defines renderRoleSelector)
    if (typeof renderRoleSelector === 'function') renderRoleSelector()

    this.setActiveSpace(space)
    this.setActiveSidebarLink()
    // Apply role-based sidebar restrictions
    this.applyRoleRestrictions()
    if (pageTitle) this.setPageTitle(pageTitle)
    this.setRandomCoverPhoto()
    this.initCoverShrink()
  },

  setRandomCoverPhoto() {
    const coverBgs = document.querySelectorAll('.space-cover__bg')
    if (!coverBgs.length) return

    const coverImages = [
      'accounts.png',
      'class.png',
      'client.png',
      'clients.png',
      'company.png',
      'create.png',
      'flow.png',
      'payments.png',
      'products.png',
      'sales.png',
      'team.png',
      'vendors.png',
      'welcome.jpg',
      'workload.png'
    ]

    const picked = coverImages[Math.floor(Math.random() * coverImages.length)]
    const imageUrl = `url('/files/${encodeURIComponent(picked)}')`
    coverBgs.forEach(bg => { bg.style.backgroundImage = imageUrl })
  },

  applyRoleRestrictions() {
    const role = (typeof Role !== 'undefined' ? Role.get() : 'admin').toLowerCase()

    // Space selector buttons: hide spaces the role cannot access
    const spaceRules = {
      'space-btn-operations': role === 'admin' || role === 'finance' || role === 'manager',
      'space-btn-workload':   true, // everyone can see workload
      'space-btn-payments':   role === 'admin' || role === 'finance',
    }
    Object.entries(spaceRules).forEach(([id, visible]) => {
      const btn = document.getElementById(id)
      if (btn) btn.style.display = visible ? '' : 'none'
    })

    // Admin/Manager-only nav items (e.g. Vendor Bills in Operations sidebar)
    const canManage = role === 'admin' || role === 'manager'
    document.querySelectorAll('.admin-manager-only').forEach(el => {
      el.style.display = canManage ? '' : 'none'
    })

    // Role selector: hide the switcher for non-admin in future (currently always shown for demo)
    // In Phase 2: if role !== 'admin' && role !== 'finance', hide the pill selector
    // For now: leave visible (demo mode)
  },

  initCoverShrink() {
    const cover = document.querySelector('.space-cover')
    if (!cover) return

    // Hook scroll on every .scroll and overflow-y element inside app-content.
    // We use a shared handler — any scroll > 40px triggers shrink.
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

    // Re-attach whenever new nodes are added to app-content (handles dynamically injected tabs)
    const appContent = document.querySelector('.app-content')
    if (appContent) {
      const observer = new MutationObserver(attach)
      observer.observe(appContent, { childList: true, subtree: true })
    }
  }
}

window.LAYOUT = LAYOUT
