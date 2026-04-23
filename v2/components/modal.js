// v2/components/modal.js — Modal factory.
// Usage:
//   const m = Modal.open({
//     title: 'New deal',
//     size: 'md',                 // sm | md | lg
//     body: nodeOrString,         // string treated as trusted HTML
//     actions: [                  // footer buttons
//       { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
//       { label: 'Save',   variant: 'primary', onClick: async () => {...} }
//     ],
//     onClose: () => {...}
//   })
//   m.close()
//   m.setBody(newNode)
// Deps: Utils (showConfirm for .confirm wrapper).

const Modal = (() => {
  function open(opts) {
    const { title = '', size = 'md', body = '', actions = [], onClose, closeOnBackdrop = true } = opts || {}

    const backdrop = document.createElement('div')
    backdrop.className = 'v2-modal-backdrop'

    const box = document.createElement('div')
    box.className = `v2-modal v2-modal-${['sm', 'md', 'lg'].includes(size) ? size : 'md'}`
    box.setAttribute('role', 'dialog')
    box.setAttribute('aria-modal', 'true')

    // Header
    const header = document.createElement('header')
    header.className = 'v2-modal-header'

    const h = document.createElement('h3')
    h.className = 'v2-modal-title'
    h.textContent = title
    header.appendChild(h)

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'v2-modal-close btn btn-ghost btn-sm'
    closeBtn.setAttribute('aria-label', 'Close')
    closeBtn.textContent = '×'
    header.appendChild(closeBtn)

    // Body
    const bodyEl = document.createElement('div')
    bodyEl.className = 'v2-modal-body'
    _paintBody(bodyEl, body)

    // Footer
    const footer = document.createElement('footer')
    footer.className = 'v2-modal-footer'
    for (const a of (actions || [])) {
      footer.appendChild(_mkButton(a))
    }

    box.append(header, bodyEl)
    if (actions && actions.length) box.appendChild(footer)

    backdrop.appendChild(box)
    document.body.appendChild(backdrop)

    let closed = false
    function close() {
      if (closed) return
      closed = true
      backdrop.remove()
      document.removeEventListener('keydown', onKeyDown)
      if (typeof onClose === 'function') {
        try { onClose() } catch (err) { console.error(err) }
      }
    }
    closeBtn.addEventListener('click', close)
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop && closeOnBackdrop) close()
    })
    function onKeyDown(e) { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKeyDown)

    // Autofocus first focusable
    setTimeout(() => {
      const f = box.querySelector('input, select, textarea, button')
      if (f) f.focus()
    }, 10)

    return {
      close,
      setTitle(t) { h.textContent = t },
      setBody(next) {
        while (bodyEl.firstChild) bodyEl.removeChild(bodyEl.firstChild)
        _paintBody(bodyEl, next)
      },
      box, bodyEl, backdrop
    }
  }

  function confirm(msg, onConfirm, opts) {
    // Thin wrapper around Utils.showConfirm, exposed here so callers don't
    // need to know both APIs exist.
    return Utils.showConfirm(msg, onConfirm, opts)
  }

  function _paintBody(el, content) {
    if (!content) return
    if (content instanceof Node) { el.appendChild(content); return }
    if (typeof content === 'string') {
      // Caller-owned HTML. Callers must escape user data.
      el.insertAdjacentHTML('afterbegin', content)
      return
    }
    if (Array.isArray(content)) {
      for (const part of content) _paintBody(el, part)
    }
  }

  function _mkButton({ label, variant = 'ghost', onClick, type = 'button', disabled = false }) {
    const b = document.createElement('button')
    b.type = type
    b.className = `btn btn-${variant}`
    b.textContent = label || ''
    b.disabled = !!disabled
    if (typeof onClick === 'function') {
      b.addEventListener('click', async e => {
        b.disabled = true
        try { await onClick(e) } catch (err) {
          console.error('[Modal] action error', err)
          Utils.showToast(err.message || 'Action failed', 'error')
        } finally { b.disabled = false }
      })
    }
    return b
  }

  return { open, confirm }
})()

window.Modal = Modal
