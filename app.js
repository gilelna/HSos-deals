// app.js — HSos shared application layer
// Loaded on every page after db.js

// ─── role enforcement ────────────────────────────────────────
// DEMO MODE: role is driven by the 4-pill selector → sessionStorage.
// PHASE 2: Role.set() will be called once on login using getRoleFromDB()
//          from db.js. The pill selector will be hidden for non-admin users.
//
// Access rules (enforced in layout.js sidebar + page guards below):
//   admin    → all spaces
//   finance  → all spaces
//   manager  → operations + workload only (no payments)
//   vendor   → workload only (no operations, no payments)

// ─── role selector ────────────────────────────────────────────
const ROLES = ['Admin', 'Manager', 'Finance', 'Vendor']

const Role = {
  get() {
    return sessionStorage.getItem('hsos_role') || 'Admin'
  },
  set(r) {
    const previous = sessionStorage.getItem('hsos_role') || 'Admin'
    sessionStorage.setItem('hsos_role', r)
    if (r !== previous) {
      window.location.reload()
    } else {
      document.body.dataset.role = r.toLowerCase()
      const btns = document.querySelectorAll('.role-btn')
      btns.forEach(b => {
        const active = b.dataset.role === r
        b.classList.toggle('cur', active)
        b.setAttribute('aria-pressed', active ? 'true' : 'false')
      })
    }
  },
  init() {
    const r = Role.get()
    document.body.dataset.role = r.toLowerCase()
  }
}
window.Role = Role

// Returns true if the current role can access the given space.
// space: 'operations' | 'workload' | 'payments'
function canAccessSpace(space) {
  const role = Role.get().toLowerCase()
  if (role === 'admin' || role === 'finance') return true
  if (role === 'manager') return space === 'operations' || space === 'workload'
  if (role === 'vendor')  return space === 'workload'
  return false
}
window.canAccessSpace = canAccessSpace

// Call on DOMContentLoaded in each page to guard access.
// requiredSpace: 'operations' | 'workload' | 'payments'
// redirectTo: page to send unauthorized users to (default: workload.html)
function guardSpace(requiredSpace, redirectTo = 'workload.html') {
  if (!canAccessSpace(requiredSpace)) {
    window.location.replace(redirectTo)
    return false
  }
  return true
}
window.guardSpace = guardSpace

function renderRoleSelector() {
  const el = document.getElementById('role-selector')
  if (!el) return
  el.setAttribute('role', 'group')
  el.setAttribute('aria-label', 'Active role')
  const cur = Role.get()
  el.innerHTML = ROLES.map(r =>
    `<button class="role-btn${r === cur ? ' cur' : ''}" data-role="${r}" aria-pressed="${r === cur ? 'true' : 'false'}" aria-label="Switch to ${r} role" onclick="Role.set('${r}')">${r}</button>`
  ).join('')
}
window.renderRoleSelector = renderRoleSelector

document.addEventListener('DOMContentLoaded', () => {
  Role.init()
  renderRoleSelector()
})

// ─── demo identity ────────────────────────────────────────────
// In demo mode, the current vendor is stored in sessionStorage.
// The vendor picker lets you switch vendor to showcase any role.

const DEMO = {
  get vendor() {
    const s = sessionStorage.getItem('hsos_vendor')
    return s ? JSON.parse(s) : null
  },
  set vendor(v) {
    if (v) sessionStorage.setItem('hsos_vendor', JSON.stringify(v))
    else sessionStorage.removeItem('hsos_vendor')
  },
  clear() { sessionStorage.removeItem('hsos_vendor') }
}
window.DEMO = DEMO

// Show vendor picker. Returns a Promise that resolves when a vendor is picked.
async function showVendorPicker(opts = {}) {
  // opts.required = true means user cannot dismiss without picking
  return new Promise(async (resolve) => {
    let vendors = []
    try { vendors = await getVendors() } catch(e) {
      console.error('[HSos] Could not load vendors:', e)
    }

    const overlay = document.createElement('div')
    overlay.id = 'vpick-overlay'
    overlay.className = 'overlay open'
    overlay.style.zIndex = '1000'

    const box = document.createElement('div')
    box.className = 'vpick-box'
    box.setAttribute('role', 'dialog')
    box.setAttribute('aria-label', 'Select vendor')

    const title = document.createElement('div')
    title.className = 'vpick-title'
    title.textContent = 'Select vendor'

    const sub = document.createElement('div')
    sub.className = 'vpick-sub'
    sub.textContent = 'DEMO MODE — pick who you are'

    const list = document.createElement('div')
    list.className = 'vpick-list'
    list.id = 'vpick-list'

    if (vendors.length === 0) {
      const errDiv = document.createElement('div')
      errDiv.className = 'vpick-error'
      errDiv.textContent = 'No vendors found — check Supabase connection and RLS policies'
      list.appendChild(errDiv)
    } else {
      vendors.forEach(v => {
        const item = document.createElement('div')
        item.className = 'vpick-item'
        item.dataset.id = v.id
        item.setAttribute('tabindex', '0')
        item.setAttribute('role', 'button')
        item.setAttribute('aria-label', v.full_name)

        const av = document.createElement('div')
        av.className = 'vpick-av'
        av.style.background = avatarBg(v.full_name)
        av.style.color = avatarFg(v.full_name)
        av.textContent = initials(v.full_name)

        const info = document.createElement('div')
        const name = document.createElement('div')
        name.className = 'vpick-name'
        name.textContent = v.full_name
        const type = document.createElement('div')
        type.className = 'vpick-type'
        type.textContent = v.vendor_type || 'vendor'
        info.appendChild(name)
        info.appendChild(type)

        item.appendChild(av)
        item.appendChild(info)
        list.appendChild(item)

        const pick = () => {
          DEMO.vendor = v
          overlay.remove()
          updateTopbarUser(v)
          resolve(v)
        }
        item.addEventListener('click', pick)
        item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick() } })
      })
    }

    box.appendChild(title)
    box.appendChild(sub)
    box.appendChild(list)

    if (!opts.required) {
      const cancelBtn = document.createElement('button')
      cancelBtn.className = 'vpick-cancel'
      cancelBtn.textContent = 'Cancel'
      cancelBtn.addEventListener('click', () => { overlay.remove(); resolve(null) })
      box.appendChild(cancelBtn)
    }

    overlay.appendChild(box)
    document.body.appendChild(overlay)
  })
}
window.showVendorPicker = showVendorPicker

// Update topbar with current vendor name and initials
function updateTopbarUser(vendor) {
  const nameEl = document.querySelector('.tb-user-name')
  const avEl   = document.querySelector('.tb-av')
  if (nameEl) nameEl.textContent = vendor?.full_name || '—'
  if (avEl) {
    if (vendor?.profile_picture_url) {
      avEl.textContent = ''
      avEl.style.backgroundImage = `url("${vendor.profile_picture_url.replace(/"/g, '%22')}")`
      avEl.style.backgroundSize = 'cover'
      avEl.style.backgroundPosition = 'center'
    } else {
      avEl.textContent = initials(vendor?.full_name || '')
      avEl.style.backgroundImage = ''
    }
  }
}
window.updateTopbarUser = updateTopbarUser

// ─── toast ───────────────────────────────────────────────────

function showToast(msg, type = 'success') {
  let t = document.getElementById('hsos-toast')
  if (!t) {
    t = document.createElement('div')
    t.id = 'hsos-toast'
    t.setAttribute('role', 'status')
    t.setAttribute('aria-live', 'polite')
    t.setAttribute('aria-atomic', 'true')
    document.body.appendChild(t)
  }
  t.className = `hsos-toast ${type}`
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(t._timer)
  t._timer = setTimeout(() => t.classList.remove('show'), 2800)
}
window.showToast = showToast

// ─── helpers ─────────────────────────────────────────────────

function initials(name = '') {
  return (name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}
window.initials = initials

const _AV_COLORS = [
  { bg: '#E1F5EE', fg: '#085041' },
  { bg: '#EEEDFE', fg: '#3C3489' },
  { bg: '#FAECE7', fg: '#712B13' },
  { bg: '#FAEEDA', fg: '#633806' },
  { bg: '#E6F1FB', fg: '#185FA5' },
  { bg: '#F1EFE8', fg: '#444441' },
]
function avatarColors(name = '') {
  return _AV_COLORS[(name.charCodeAt(0) || 0) % _AV_COLORS.length]
}
function avatarBg(name) { return avatarColors(name).bg }
function avatarFg(name) { return avatarColors(name).fg }
window.avatarBg = avatarBg
window.avatarFg = avatarFg

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatMonth(ym) {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })
}
window.formatDate  = formatDate
window.formatMonth = formatMonth

// ─── HTML escaping ────────────────────────────────────────────
// Authoritative implementations — used by all pages.
// escHtmlAttr: for values inside HTML attribute strings (onclick="…", href="…")
// esc / escHtml: for text content inside HTML tags

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
const escHtml = esc
function escHtmlAttr(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
window.esc         = esc
window.escHtml     = escHtml
window.escHtmlAttr = escHtmlAttr

// ─── confirm dialog ───────────────────────────────────────────
// Replaces native confirm() for destructive actions.
// Usage: showConfirm('Are you sure?', () => doDelete())
// Optional opts: { confirmLabel, cancelLabel }

function showConfirm(msg, onConfirm, opts = {}) {
  const confirmLabel = opts.confirmLabel || 'Confirm'
  const cancelLabel  = opts.cancelLabel  || 'Cancel'

  const overlay = document.createElement('div')
  overlay.className = 'overlay open'

  const box = document.createElement('div')
  box.className = 'modal-box'
  box.style.width = '380px'

  const head = document.createElement('div')
  head.className = 'modal-head'
  const title = document.createElement('div')
  title.className = 'modal-title'
  title.textContent = msg    // textContent — no XSS risk
  head.appendChild(title)

  const foot = document.createElement('div')
  foot.className = 'modal-foot'
  foot.style.justifyContent = 'flex-end'
  const footRight = document.createElement('div')
  footRight.className = 'modal-foot-right'

  const cancelBtn = document.createElement('button')
  cancelBtn.className = 'btn'
  cancelBtn.id = 'sc-cancel'
  cancelBtn.textContent = cancelLabel

  const okBtn = document.createElement('button')
  okBtn.className = 'btn btn-primary'
  okBtn.id = 'sc-ok'
  okBtn.style.cssText = 'background:var(--red);border-color:var(--red);color:#fff'
  okBtn.textContent = confirmLabel

  footRight.appendChild(cancelBtn)
  footRight.appendChild(okBtn)
  foot.appendChild(footRight)
  box.appendChild(head)
  box.appendChild(foot)
  overlay.appendChild(box)
  document.body.appendChild(overlay)

  const cleanup = () => { overlay.remove(); document.removeEventListener('keydown', onKey) }
  okBtn.addEventListener('click', () => { cleanup(); onConfirm() })
  cancelBtn.addEventListener('click', cleanup)
  overlay.addEventListener('click', e => { if (e.target === overlay) cleanup() })

  function onKey(e) {
    if (e.key === 'Escape') cleanup()
    if (e.key === 'Enter')  { cleanup(); onConfirm() }
  }
  document.addEventListener('keydown', onKey)
  setTimeout(() => okBtn.focus(), 0)
}
window.showConfirm = showConfirm
