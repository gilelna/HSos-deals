// v2/core/guard.js — Space + action access control.
// Matrix (3-role model, per decision B2):
//   admin   → sales, operations, payments (full)
//   manager → sales, operations (no financials)
//   vendor  → operations only (own data only)
// Depends on: Auth.

const Guard = (() => {
  const SPACE_ACCESS = {
    sales:      ['admin', 'manager'],
    operations: ['admin', 'manager', 'vendor'],
    payments:   ['admin'],
    profiles:   ['admin', 'manager', 'vendor']  // vendor view is read-only of own profile
  }

  // Action names are free-form strings used by UI to hide/show elements.
  // Keep the list here so roles stay auditable in one place.
  const ACTION_ACCESS = {
    'deal.edit':          ['admin', 'manager'],
    'deal.delete':        ['admin'],
    'client.edit':        ['admin', 'manager'],
    'client.delete':      ['admin'],
    'vendor.edit':        ['admin'],
    'vendor.delete':      ['admin'],
    'product.edit':       ['admin'],
    'session.log':        ['admin', 'manager', 'vendor'],
    'session.edit.own':   ['admin', 'manager', 'vendor'],
    'session.edit.any':   ['admin', 'manager'],
    'bill.submit':        ['admin', 'manager', 'vendor'],
    'bill.approve':       ['admin'],
    'bill.pay':           ['admin'],
    'transaction.edit':   ['admin'],
    'registry.edit':      ['admin']
  }

  function canAccessSpace(space) {
    const role = Auth.getRole()
    const allowed = SPACE_ACCESS[space]
    return Array.isArray(allowed) && allowed.includes(role)
  }

  function space(spaceName, opts) {
    const { redirectTo = '../../index.html' } = opts || {}
    if (canAccessSpace(spaceName)) return true
    window.location.replace(redirectTo)
    return false
  }

  function action(actionName, role) {
    const who = role || Auth.getRole()
    const allowed = ACTION_ACCESS[actionName]
    if (!allowed) {
      console.error(`[Guard] unknown action: ${actionName}`)
      return false
    }
    return allowed.includes(who)
  }

  return { space, action, canAccessSpace, SPACE_ACCESS, ACTION_ACCESS }
})()

window.Guard = Guard
