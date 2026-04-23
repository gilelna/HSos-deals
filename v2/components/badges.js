// v2/components/badges.js — Unified badge/pill HTML builders.
// ALL status/type pills go through here. No inline badge HTML in page modules.
// Deps: Utils (escHtml, escHtmlAttr), Const.

const Badges = (() => {
  const COLORS = ['blue', 'green', 'amber', 'red', 'purple', 'grey']

  // Core builder. All convenience functions funnel into this.
  // opts = { color, title, dot }
  function make(label, opts) {
    const { color = 'grey', title, dot = false } = opts || {}
    const safeColor = COLORS.includes(color) ? color : 'grey'
    const titleAttr = title ? ` title="${Utils.escHtmlAttr(title)}"` : ''
    const dotHtml = dot ? `<span class="v2-pill-dot"></span>` : ''
    return `<span class="v2-pill v2-pill-${safeColor}"${titleAttr}>${dotHtml}${Utils.escHtml(label)}</span>`
  }

  function dealStatus(status) {
    const color = { lead: 'grey', qualified: 'blue', active: 'blue', delivered: 'purple', closed: 'green' }[status] || 'grey'
    const label = Const.DEAL_STAGE_LABELS[status] || status || '—'
    return make(label, { color })
  }

  function billingStatus(status) {
    const color = Const.BILLING_STATUS_COLORS[status] || 'grey'
    const label = Const.BILLING_STATUS_LABELS[status] || status || '—'
    return make(label, { color, dot: true })
  }

  function vendorType(type) {
    const color = Const.VENDOR_TYPE_COLORS[type] || 'grey'
    const label = Const.VENDOR_TYPE_LABELS[type] || type || '—'
    return make(label, { color })
  }

  function billStatus(status) {
    const color = { draft: 'grey', submitted: 'amber', approved: 'blue', paid: 'green', returned: 'red' }[status] || 'grey'
    const label = Const.BILL_STATUS_LABELS[status] || status || '—'
    return make(label, { color })
  }

  function txStatus(status) {
    const color = { unmatched: 'amber', matched: 'blue', reconciled: 'green', deleted: 'red' }[status] || 'grey'
    return make(status || '—', { color })
  }

  function direction(dir) {
    const color = dir === 'in' ? 'green' : dir === 'out' ? 'red' : 'grey'
    const label = dir === 'in' ? 'In' : dir === 'out' ? 'Out' : '—'
    return make(label, { color })
  }

  function cadence(c) {
    const color = { recurring: 'purple', project_based: 'blue', one_time: 'grey' }[c] || 'grey'
    const label = Const.PAYMENT_CADENCE_LABELS[c] || c || '—'
    return make(label, { color })
  }

  function sessionStatus(s) {
    const color = { planned: 'blue', done: 'green', cancelled: 'grey', no_show: 'red' }[s] || 'grey'
    return make(s || '—', { color })
  }

  function tag(name, color) {
    const c = COLORS.includes(color) ? color : 'grey'
    return make(name, { color: c })
  }

  function category(name) {
    return make(name || '—', { color: 'blue' })
  }

  function taxTreatment(value) {
    const label = Const.TAX_TREATMENT_LABELS[value] || value || '—'
    const color = value === 'income' ? 'green' : value === 'non_deductible' ? 'red' : 'grey'
    return make(label, { color })
  }

  return {
    make,
    dealStatus, billingStatus, vendorType, billStatus,
    txStatus, direction, cadence, sessionStatus,
    tag, category, taxTreatment
  }
})()

window.Badges = Badges
