// v2/core/auth.js — Role management backed by sessionStorage.
// Roles (per rebuild decision B2): 'admin' | 'manager' | 'vendor' — finance folded into admin.
// Depends on: nothing. (Utils optional for toast on errors.)

const Auth = (() => {
  const ROLE_KEY = 'hsos_role'
  const VENDOR_KEY = 'hsos_vendor_id'
  const VALID_ROLES = ['admin', 'manager', 'vendor']
  const DEFAULT_ROLE = 'admin'
  const EVENT = 'hsos:role-changed'

  function getRole() {
    const r = sessionStorage.getItem(ROLE_KEY)
    return VALID_ROLES.includes(r) ? r : DEFAULT_ROLE
  }

  function setRole(role) {
    if (!VALID_ROLES.includes(role)) {
      console.error(`[Auth] invalid role: ${role}`)
      return false
    }
    const prev = getRole()
    sessionStorage.setItem(ROLE_KEY, role)
    if (role !== 'vendor') sessionStorage.removeItem(VENDOR_KEY)
    _applyBodyAttr()
    if (prev !== role) {
      window.dispatchEvent(new CustomEvent(EVENT, { detail: { role, prev } }))
    }
    return true
  }

  function getVendorId() {
    if (getRole() !== 'vendor') return null
    return sessionStorage.getItem(VENDOR_KEY) || null
  }

  function setVendorId(id) {
    if (!id) { sessionStorage.removeItem(VENDOR_KEY); return }
    sessionStorage.setItem(VENDOR_KEY, String(id))
  }

  function onChange(fn) {
    window.addEventListener(EVENT, e => fn(e.detail.role, e.detail.prev))
  }

  function _applyBodyAttr() {
    if (document.body) document.body.dataset.role = getRole()
  }

  function init() {
    _applyBodyAttr()
  }

  return {
    getRole, setRole,
    getVendorId, setVendorId,
    onChange, init,
    VALID_ROLES
  }
})()

window.Auth = Auth
