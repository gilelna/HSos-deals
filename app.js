// app.js — HSos shared application layer
// Loaded on every page after db.js + auth.js
//
// Auth model: there is no demo bypass. Every page using LAYOUT.init()
// must have a real Supabase session and a profiles row with a non-null
// system_role. The gate runs in components/layout.js (LAYOUT._runAuthGate)
// and caches { session, user, profile } on window.__hsosAuth before any
// of the helpers below are used.

// ─── role enforcement ────────────────────────────────────────
// Effective role = system_role from profiles. Admin can *preview* as
// another role within the session (sessionStorage 'hsos_role_preview');
// non-admin previews are ignored. The Role pill switcher only renders
// when the real role is admin.

const ROLES = ['Admin', 'Manager', 'Finance', 'Vendor']

const Role = {
  // The user's real role from profiles.system_role (lowercase).
  // Returns '' when called before LAYOUT._runAuthGate completes.
  real() {
    return (window.__hsosAuth?.profile?.system_role || '').toLowerCase()
  },

  // The role currently driving the UI. For admin: any preview override
  // (sessionStorage 'hsos_role_preview') if set, else 'Admin'. For all
  // other roles: always the real role — preview is ignored.
  get() {
    const real = this.real()
    if (real !== 'admin') return capitalize(real || '')
    const preview = sessionStorage.getItem('hsos_role_preview')
    if (preview && ROLES.includes(preview)) return preview
    return 'Admin'
  },

  // Admin-only preview override. No-op for non-admin. Reloads the page
  // so role-conditional rendering picks up the new value.
  set(r) {
    if (this.real() !== 'admin') return
    if (!ROLES.includes(r)) return
    const previous = sessionStorage.getItem('hsos_role_preview') || 'Admin'
    if (r === 'Admin') {
      sessionStorage.removeItem('hsos_role_preview')
    } else {
      sessionStorage.setItem('hsos_role_preview', r)
    }
    if (r !== previous) window.location.reload()
  },

  init() {
    document.body.dataset.role = (this.get() || '').toLowerCase()
  },
}
window.Role = Role

function capitalize(s) {
  if (!s) return ''
  return s[0].toUpperCase() + s.slice(1).toLowerCase()
}

// Returns true if the current effective role can access the given space.
// space: 'operations' | 'workload' | 'payments'
function canAccessSpace(space) {
  const role = Role.get().toLowerCase()
  if (role === 'admin' || role === 'finance') return true
  if (role === 'manager') return space === 'operations' || space === 'workload'
  if (role === 'vendor')  return space === 'workload'
  return false
}
window.canAccessSpace = canAccessSpace

// Call on DOMContentLoaded in each page to guard access. Sends
// unauthorized users to redirectTo. If the auth gate hasn't completed
// yet (window.__hsosAuth not populated), returns true without
// redirecting — the gate in layout.js will own the final UI state by
// replacing document.body if the user isn't authorized. Skipping the
// premature redirect prevents an authed admin from being kicked to
// workload.html on a slow network.
function guardSpace(requiredSpace, redirectTo = 'workload.html') {
  if (!window.__hsosAuth) return true
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
  // Only the real admin gets the switcher pill rendered. For everyone
  // else clear the container; layout.js also hides #role-selector via
  // display:none so this is belt-and-braces.
  if (Role.real() !== 'admin') {
    while (el.firstChild) el.removeChild(el.firstChild)
    return
  }
  el.setAttribute('role', 'group')
  el.setAttribute('aria-label', 'Active role (preview)')
  while (el.firstChild) el.removeChild(el.firstChild)
  const cur = Role.get()
  ROLES.forEach(r => {
    const b = document.createElement('button')
    b.className = 'role-btn' + (r === cur ? ' cur' : '')
    b.dataset.role = r
    b.setAttribute('aria-pressed', r === cur ? 'true' : 'false')
    b.setAttribute('aria-label', `Preview as ${r}`)
    b.textContent = r
    b.addEventListener('click', () => Role.set(r))
    el.appendChild(b)
  })
}
window.renderRoleSelector = renderRoleSelector

document.addEventListener('DOMContentLoaded', () => {
  // Role.init reads window.__hsosAuth, which isn't populated until the
  // gate resolves. layout.js calls Role.init() implicitly via render
  // sequencing; this is just for any pages that don't use LAYOUT.init.
  Role.init()
})

// ─── vendor identity (post-auth) ──────────────────────────────
// `DEMO` is kept for backward compatibility with workload.js. The
// vendor identity is now seeded from profiles.vendor_id when present.
// The picker stays as an admin-only "view as vendor" override.

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

// Show vendor picker. Returns a Promise that resolves with the picked
// vendor (or null on cancel).
async function showVendorPicker(opts = {}) {
  return new Promise(async (resolve) => {
    let vendors = []
    try { vendors = await getVendors() } catch (e) {
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
    sub.textContent = Role.real() === 'admin'
      ? 'Admin preview — view workload as this vendor'
      : 'Pick the vendor to log work for'

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

// Update topbar with current vendor name. Used by workload.js for its
// vendor-identity hero. The avatar dropdown is owned by USER_MENU.
function updateTopbarUser(vendor) {
  const nameEl = document.querySelector('.tb-user-name')
  if (nameEl) nameEl.textContent = vendor?.full_name || '—'
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
  title.textContent = msg
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
