// v2/core/audit.js — Writes to audit_log (system trail) and optionally activities (user-visible).
// Called from db.js after every successful write.
// Depends on: window._sb (from core/env.js), Auth.

const Audit = (() => {
  // Compute changed-only diff from before/after snapshots.
  // Returns { before, after } where both only contain keys that differ.
  function diff(before, after) {
    const out = { before: {}, after: {} }
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
    for (const k of keys) {
      const b = before ? before[k] : undefined
      const a = after ? after[k] : undefined
      if (JSON.stringify(b) !== JSON.stringify(a)) {
        out.before[k] = b === undefined ? null : b
        out.after[k] = a === undefined ? null : a
      }
    }
    return out
  }

  function _performedBy() {
    const role = Auth.getRole()
    const vendorId = Auth.getVendorId()
    return vendorId ? `${role}:${vendorId}` : role
  }

  async function log(entry) {
    const { entity_type, entity_id, action, changes } = entry || {}
    if (!entity_type || !action) {
      console.error('[Audit] missing entity_type or action', entry)
      return
    }
    const row = {
      entity_type,
      entity_id: entity_id ? String(entity_id) : null,
      action,
      changes: changes || {},
      performed_by: _performedBy()
    }
    try {
      const { error } = await window._sb.from('audit_log').insert(row)
      if (error) throw error
    } catch (err) {
      // Audit failures must not block the calling write — log and move on.
      console.error('[Audit] audit_log insert failed', err)
    }
  }

  // User-visible event. Separate from audit_log — goes into activities.
  // Activities are rendered in bell + activity log pages. entity_id must be uuid
  // (clients, deals, vendors, sessions are uuid PKs). Skip silently if not uuid.
  async function activity({ entity_type, entity_id, type, subtype, body, meta }) {
    if (!entity_type || !type) {
      console.error('[Audit] activity missing entity_type or type')
      return
    }
    const row = {
      entity_type,
      entity_id: entity_id || null,
      type,
      subtype: subtype || null,
      body: body || null,
      origin: 'system',
      meta: meta || {}
    }
    try {
      const { error } = await window._sb.from('activities').insert(row)
      if (error) throw error
    } catch (err) {
      console.error('[Audit] activity insert failed', err)
    }
  }

  return { log, activity, diff }
})()

window.Audit = Audit
