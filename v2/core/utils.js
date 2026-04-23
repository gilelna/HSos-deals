// v2/core/utils.js — Cross-cutting helpers. No DB, no Auth dependencies.

const Utils = (() => {
  // ─── Escape helpers ───────────────────────────────────────────────
  function esc(v) {
    if (v === null || v === undefined) return ''
    return String(v)
  }

  function escHtml(v) {
    return esc(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function escHtmlAttr(v) {
    return escHtml(v)
  }

  // ─── Currency ─────────────────────────────────────────────────────
  const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', ILS: '₪' }

  function formatCurrency(amount, currency) {
    if (amount === null || amount === undefined || amount === '') return ''
    const n = Number(amount)
    if (!Number.isFinite(n)) return ''
    const sym = CURRENCY_SYMBOLS[currency] || (currency ? currency + ' ' : '$')
    const body = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return (n < 0 ? '-' : '') + sym + body
  }

  // ─── Dates ────────────────────────────────────────────────────────
  function formatDate(d) {
    if (!d) return ''
    const dt = d instanceof Date ? d : new Date(d)
    if (Number.isNaN(dt.getTime())) return ''
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function formatMonth(ym) {
    if (!ym) return ''
    const [y, m] = String(ym).split('-').map(Number)
    if (!y || !m) return ''
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  }

  // ─── Avatars / initials ───────────────────────────────────────────
  function initials(name) {
    if (!name) return '?'
    const parts = String(name).trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // ─── Toast ────────────────────────────────────────────────────────
  function _toastContainer() {
    let c = document.getElementById('v2-toast-container')
    if (!c) {
      c = document.createElement('div')
      c.id = 'v2-toast-container'
      c.className = 'v2-toast-container'
      document.body.appendChild(c)
    }
    return c
  }

  function showToast(msg, type) {
    const kind = ['info', 'success', 'warn', 'error'].includes(type) ? type : 'info'
    const el = document.createElement('div')
    el.className = `v2-toast v2-toast-${kind}`
    el.textContent = msg
    _toastContainer().appendChild(el)
    setTimeout(() => el.classList.add('v2-toast-in'), 10)
    const ttl = kind === 'error' ? 6000 : 3500
    setTimeout(() => {
      el.classList.remove('v2-toast-in')
      setTimeout(() => el.remove(), 300)
    }, ttl)
  }

  // ─── Confirm ──────────────────────────────────────────────────────
  function showConfirm(msg, onConfirm, opts) {
    const { confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = opts || {}

    const overlay = document.createElement('div')
    overlay.className = 'v2-confirm-overlay'

    const box = document.createElement('div')
    box.className = 'v2-confirm-box'
    box.setAttribute('role', 'dialog')
    box.setAttribute('aria-modal', 'true')

    const msgEl = document.createElement('div')
    msgEl.className = 'v2-confirm-msg'
    msgEl.textContent = msg

    const actions = document.createElement('div')
    actions.className = 'v2-confirm-actions'

    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'btn btn-ghost v2-confirm-cancel'
    cancelBtn.textContent = cancelLabel

    const okBtn = document.createElement('button')
    okBtn.type = 'button'
    okBtn.className = `btn v2-confirm-ok ${danger ? 'btn-danger' : 'btn-primary'}`
    okBtn.textContent = confirmLabel

    actions.append(cancelBtn, okBtn)
    box.append(msgEl, actions)
    overlay.appendChild(box)
    document.body.appendChild(overlay)

    function close() { overlay.remove() }
    cancelBtn.addEventListener('click', close)
    okBtn.addEventListener('click', () => {
      close()
      try { onConfirm && onConfirm() } catch (err) { console.error(err) }
    })
    overlay.addEventListener('click', e => { if (e.target === overlay) close() })
  }

  return {
    esc, escHtml, escHtmlAttr,
    formatCurrency, formatDate, formatMonth,
    initials,
    showToast, showConfirm
  }
})()

window.Utils = Utils
