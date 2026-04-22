// badges.js — Reusable badge/chip component with optional icon prefix
// All badge functions return HTML strings.
// Icon map is extensible — add entries to BADGE_ICONS as needed.

window.Badges = (function () {

  // ── Icon prefix map ────────────────────────────────────────────────
  // Key can be a category ID, vendor type, status, tag, or any string.
  const BADGE_ICONS = {
    // Vendor types
    coach:        '🎓',
    contractor:   '🔧',
    team_member:  '👤',
    merchant:     '🏪',

    // Transaction status
    reconciled:   '✓',
    matched:      '⟷',
    unmatched:    '?',
    settled:      '✓',
    pending:      '…',
    review:       '⚠',
    duplicate:    '⚠',

    // Directions
    in:   '↓',
    out:  '↑',

    // Billing status
    paid:       '✓',
    invoiced:   '📄',
    link_sent:  '🔗',
    overdue:    '!',
    partial:    '½',

    // B/P entity
    business: 'B',
    private:  'P',

    // Categories (subset — add more as needed)
    ca_income:                '↓',
    ca_softwaresaasrecurring: '♾',
    ca_flights:               '✈',
    ca_restaurantscafes:      '☕',
    ca_bankfees:              '🏦',
    ca_paymentprocessingfees: '💳',
    ca_contractorsfreelancers:'🔧',
    ca_advertisingmarketing:  '📣',
    ca_trainingeducation:     '📚',
    ca_medicalhealth:         '🏥',
    ca_taxesincometaxvatetc:  '🏛',
    ca_insurance:             '🛡',
    ca_homehousehold:         '🏠',
    ca_groceries:             '🛒',
    ca_travelexpenses:        '🧳',
    ca_electronicsequipment:  '💻',
  }

  // ── Core badge builder ─────────────────────────────────────────────
  // Returns an HTML string.
  // opts: { bg, color, size, mono, icon, noIcon, extraClass }
  function make(label, opts = {}) {
    const { bg = 'var(--bg)', color = 'var(--ink)', size = 11, mono = false,
            icon = null, noIcon = false, extraClass = '' } = opts
    const iconKey = (icon || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '_') : ''))
    const prefix  = !noIcon && BADGE_ICONS[iconKey] ? `<span class="badge-icon">${BADGE_ICONS[iconKey]}</span>` : ''
    const font    = mono ? 'font-family:var(--font-mono);' : ''
    return `<span class="badge ${extraClass}" style="background:${bg};color:${color};font-size:${size}px;${font}">${prefix}${label}</span>`
  }

  // ── Convenience builders ───────────────────────────────────────────

  function vendorType(type) {
    const map = {
      coach:       { label: 'Coach',       bg: 'var(--green-bg)',  color: 'var(--green-text)' },
      contractor:  { label: 'Contractor',  bg: 'var(--blue-bg)',   color: 'var(--blue-text)'  },
      team_member: { label: 'Team',        bg: 'var(--amber-bg)',  color: 'var(--amber-text)' },
      merchant:    { label: 'Merchant',    bg: 'var(--border)',    color: 'var(--mu)'          },
    }
    const m = map[type]
    if (!m) return ''
    return make(m.label, { bg: m.bg, color: m.color, icon: type, mono: true, extraClass: 'vendor-type-badge' })
  }

  function txStatus(status) {
    const map = {
      reconciled: { bg: 'var(--green-bg)',  color: 'var(--green-text)' },
      matched:    { bg: 'var(--blue-bg)',   color: 'var(--blue-text)'  },
      unmatched:  { bg: 'var(--amber-bg)',  color: 'var(--amber-text)' },
      deleted:    { bg: 'var(--red-bg)',    color: 'var(--red-text)'   },
    }
    const m = map[status] || { bg: 'var(--bg)', color: 'var(--mu)' }
    return make(status || '—', { ...m, icon: status, mono: true, extraClass: 'tx-status-badge' })
  }

  function incomeStatus(status) {
    const map = {
      settled:    { bg: 'var(--green-bg)',  color: 'var(--green-text)' },
      matched:    { bg: 'var(--blue-bg)',   color: 'var(--blue-text)'  },
      unmatched:  { bg: 'var(--amber-bg)',  color: 'var(--amber-text)' },
      reconciled: { bg: 'var(--bg)',        color: 'var(--mu)',  border: '1px solid var(--border)' },
    }
    const m = map[status] || { bg: 'var(--bg)', color: 'var(--mu)' }
    return make(status || '—', { ...m, icon: status, mono: true, extraClass: 'inc-status-badge' })
  }

  function billingStatus(status) {
    const map = {
      pending:    { bg: 'var(--amber-bg)',  color: 'var(--amber-text)' },
      link_sent:  { bg: 'var(--blue-bg)',   color: 'var(--blue-text)'  },
      invoiced:   { bg: '#ede8f5',          color: '#5b3fa0'            },
      partial:    { bg: 'var(--blue-bg)',   color: 'var(--blue-text)'  },
      paid:       { bg: 'var(--green-bg)',  color: 'var(--green-text)' },
      overdue:    { bg: 'var(--red-bg)',    color: 'var(--red-text)'   },
    }
    const m = map[status] || { bg: 'var(--bg)', color: 'var(--mu)' }
    return make(status || '—', { ...m, icon: status, mono: true, extraClass: 'billing-status-badge' })
  }

  function category(label, opts = {}) {
    return make(label, {
      bg: 'var(--bg)', color: 'var(--ink)',
      extraClass: 'cl-cat-pill',
      noIcon: true,    // categories shown by name only — icon in pills is noisy
      ...opts,
    })
  }

  function taxTreatment(tax) {
    if (!tax) return ''
    const colorMap = {
      non_deductible: { bg: 'var(--red-bg)',   color: 'var(--red-text)'   },
      mixed_review:   { bg: 'var(--amber-bg)', color: 'var(--amber-text)' },
    }
    const m = colorMap[tax] || { bg: 'var(--blue-bg)', color: 'var(--blue-text)' }
    return make(tax.replace(/_/g, ' '), { ...m, mono: true, noIcon: true, extraClass: 'cl-tax-badge ' + tax })
  }

  function tag(label) {
    return `<span class="cl-tag">${label}</span>`
  }

  function direction(dir) {
    const isIn = dir === 'in'
    return make(isIn ? 'IN' : 'OUT', {
      bg: isIn ? 'var(--green-bg)' : 'var(--red-bg)',
      color: isIn ? 'var(--green-text)' : 'var(--red-text)',
      mono: true, icon: dir, extraClass: 'tx-direction-badge ' + dir,
    })
  }

  function cadence(c) {
    if (!c) return ''
    const label = { recurring: 'Recurring', project_based: 'Project-based', one_time: 'One-time' }[c] || c
    return make(label, { bg: 'var(--blue-bg)', color: 'var(--blue-text)', mono: true, noIcon: true, extraClass: 'rec-cadence' })
  }

  // ── Register icon ──────────────────────────────────────────────────
  function registerIcon(key, icon) {
    BADGE_ICONS[key] = icon
  }

  return {
    make,
    vendorType,
    txStatus,
    incomeStatus,
    billingStatus,
    category,
    taxTreatment,
    tag,
    direction,
    cadence,
    registerIcon,
    BADGE_ICONS,
  }
})()
