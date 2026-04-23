// v2/components/panel.js — Unified right-side panel for all entity types.
// Stack-based navigation. Edit state lives in a JS object, never in DOM attrs.
//
// Usage:
//   Panel.registerType('deal', {
//     load(id) { return DB.getDeal(id) },                    // returns entity
//     render(entity, ctx) { return { title, subtitle, tabs } }
//     save(id, edits) { return DB.updateDeal(id, edits) }    // optional
//   })
//   Panel.open('deal', dealId)
//
// Public API:
//   Panel.registerType(type, handler)
//   Panel.open(type, id)         — clears stack, opens fresh
//   Panel.push(type, id)         — pushes onto stack (back button appears)
//   Panel.pop()                  — goes back
//   Panel.close()                — clears stack + UI
//   Panel.edit(fieldKey, value)  — records a pending edit
//   Panel.save()                 — commits pending edits via handler.save
//   Panel.discard()              — clears pending edits, re-renders
//
// Deps: Utils (toast/confirm), Auth (role for handler.render context).

const Panel = (() => {
  const _types = new Map()
  const _stack = []        // [{ type, id, entity }]
  let _pendingEdits = {}   // { fieldKey: newValue } for the top-of-stack entity
  let _root = null

  function registerType(type, handler) {
    if (!type || typeof handler?.load !== 'function') {
      console.error('[Panel] registerType requires type and handler.load')
      return
    }
    _types.set(type, handler)
  }

  function _ensureRoot() {
    if (_root && document.body.contains(_root)) return _root
    _root = document.createElement('aside')
    _root.className = 'v2-panel'
    _root.setAttribute('role', 'complementary')
    _root.setAttribute('aria-hidden', 'true')
    document.body.appendChild(_root)

    // Backdrop
    const backdrop = document.createElement('div')
    backdrop.className = 'v2-panel-backdrop'
    backdrop.addEventListener('click', () => close())
    document.body.appendChild(backdrop)
    _root._backdrop = backdrop

    // Escape to close
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && _stack.length) close()
    })
    return _root
  }

  async function open(type, id) {
    if (!_types.has(type)) {
      console.error(`[Panel] unknown type: ${type}`)
      Utils.showToast(`Unknown panel type: ${type}`, 'error')
      return
    }
    _stack.length = 0
    _pendingEdits = {}
    await _loadAndRender(type, id)
  }

  async function push(type, id) {
    if (!_types.has(type)) {
      console.error(`[Panel] unknown type: ${type}`)
      return
    }
    if (_hasPending()) {
      Utils.showConfirm(
        'You have unsaved changes. Discard them?',
        () => { _pendingEdits = {}; _loadAndRender(type, id) },
        { confirmLabel: 'Discard', danger: true }
      )
      return
    }
    _pendingEdits = {}
    await _loadAndRender(type, id)
  }

  async function pop() {
    if (_stack.length <= 1) { close(); return }
    if (_hasPending()) {
      Utils.showConfirm(
        'You have unsaved changes. Discard them?',
        async () => { _pendingEdits = {}; _stack.pop(); await _renderTop() },
        { confirmLabel: 'Discard', danger: true }
      )
      return
    }
    _stack.pop()
    await _renderTop()
  }

  function close() {
    if (_hasPending()) {
      Utils.showConfirm(
        'You have unsaved changes. Discard and close?',
        () => { _pendingEdits = {}; _forceClose() },
        { confirmLabel: 'Discard', danger: true }
      )
      return
    }
    _forceClose()
  }

  function _forceClose() {
    _stack.length = 0
    _pendingEdits = {}
    if (!_root) return
    _root.classList.remove('v2-panel-open')
    _root.setAttribute('aria-hidden', 'true')
    if (_root._backdrop) _root._backdrop.classList.remove('v2-panel-backdrop-open')
    while (_root.firstChild) _root.removeChild(_root.firstChild)
  }

  async function _loadAndRender(type, id) {
    const handler = _types.get(type)
    const root = _ensureRoot()
    _showLoading()
    try {
      const entity = await handler.load(id)
      if (!entity) {
        Utils.showToast(`Not found: ${type} ${id}`, 'error')
        _forceClose()
        return
      }
      _stack.push({ type, id, entity })
      await _renderTop()
      root.classList.add('v2-panel-open')
      root.setAttribute('aria-hidden', 'false')
      if (root._backdrop) root._backdrop.classList.add('v2-panel-backdrop-open')
    } catch (err) {
      console.error('[Panel] load failed', err)
      Utils.showToast(err.message || 'Failed to load', 'error')
      _forceClose()
    }
  }

  function _showLoading() {
    const root = _ensureRoot()
    while (root.firstChild) root.removeChild(root.firstChild)
    const body = document.createElement('div')
    body.className = 'v2-panel-loading'
    body.textContent = 'Loading…'
    root.appendChild(body)
    root.classList.add('v2-panel-open')
    root.setAttribute('aria-hidden', 'false')
    if (root._backdrop) root._backdrop.classList.add('v2-panel-backdrop-open')
  }

  async function _renderTop() {
    const top = _stack[_stack.length - 1]
    if (!top) { _forceClose(); return }
    const handler = _types.get(top.type)
    const ctx = {
      role: Auth.getRole(),
      canEdit: typeof handler.save === 'function',
      stackDepth: _stack.length,
      pendingEdits: { ..._pendingEdits }
    }
    let view
    try {
      view = await handler.render(top.entity, ctx)
    } catch (err) {
      console.error('[Panel] render failed', err)
      Utils.showToast(err.message || 'Render error', 'error')
      return
    }
    _paint(view, top, handler)
  }

  function _paint(view, top, handler) {
    const root = _ensureRoot()
    while (root.firstChild) root.removeChild(root.firstChild)

    // ─── Header ──────────────────────────────────────────────
    const header = document.createElement('header')
    header.className = 'v2-panel-header'

    if (_stack.length > 1) {
      const back = document.createElement('button')
      back.type = 'button'
      back.className = 'v2-panel-back btn btn-ghost btn-sm'
      back.textContent = '‹ Back'
      back.addEventListener('click', () => pop())
      header.appendChild(back)
    }

    const titleWrap = document.createElement('div')
    titleWrap.className = 'v2-panel-titles'
    const title = document.createElement('h2')
    title.className = 'v2-panel-title'
    title.textContent = view?.title || ''
    titleWrap.appendChild(title)
    if (view?.subtitle) {
      const sub = document.createElement('div')
      sub.className = 'v2-panel-subtitle'
      sub.textContent = view.subtitle
      titleWrap.appendChild(sub)
    }
    header.appendChild(titleWrap)

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'v2-panel-close btn btn-ghost btn-sm'
    closeBtn.setAttribute('aria-label', 'Close')
    closeBtn.textContent = '×'
    closeBtn.addEventListener('click', () => close())
    header.appendChild(closeBtn)

    root.appendChild(header)

    // ─── Tabs (optional) ────────────────────────────────────
    const tabs = Array.isArray(view?.tabs) ? view.tabs : null
    let activeTabIdx = 0
    let body = document.createElement('div')
    body.className = 'v2-panel-body'

    if (tabs) {
      const tabBar = document.createElement('nav')
      tabBar.className = 'v2-panel-tabs'
      const tabBtns = []
      tabs.forEach((t, i) => {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'v2-panel-tab'
        b.textContent = t.label || ''
        b.addEventListener('click', () => {
          activeTabIdx = i
          tabBtns.forEach((btn, j) => btn.classList.toggle('v2-panel-tab-active', i === j))
          _paintTab(body, t)
        })
        tabBar.appendChild(b)
        tabBtns.push(b)
      })
      tabBtns[0].classList.add('v2-panel-tab-active')
      root.appendChild(tabBar)
      root.appendChild(body)
      _paintTab(body, tabs[0])
    } else {
      root.appendChild(body)
      _paintSection(body, view?.body)
    }

    // ─── Dirty bar ──────────────────────────────────────────
    if (_hasPending() && handler && typeof handler.save === 'function') {
      const bar = document.createElement('div')
      bar.className = 'v2-panel-dirty'

      const msg = document.createElement('span')
      msg.textContent = `${Object.keys(_pendingEdits).length} unsaved change${Object.keys(_pendingEdits).length === 1 ? '' : 's'}`
      bar.appendChild(msg)

      const actions = document.createElement('span')
      actions.className = 'v2-panel-dirty-actions'

      const discardBtn = document.createElement('button')
      discardBtn.type = 'button'
      discardBtn.className = 'btn btn-ghost btn-sm'
      discardBtn.textContent = 'Discard'
      discardBtn.addEventListener('click', () => discard())

      const saveBtn = document.createElement('button')
      saveBtn.type = 'button'
      saveBtn.className = 'btn btn-primary btn-sm'
      saveBtn.textContent = 'Save'
      saveBtn.addEventListener('click', () => save())

      actions.append(discardBtn, saveBtn)
      bar.appendChild(actions)
      root.appendChild(bar)
    }
  }

  function _paintTab(body, tab) {
    while (body.firstChild) body.removeChild(body.firstChild)
    _paintSection(body, tab?.content)
  }

  function _paintSection(container, content) {
    if (!content) return
    if (content instanceof Node) {
      container.appendChild(content)
      return
    }
    if (typeof content === 'string') {
      // Handler opted into string content — it's responsible for escaping.
      container.insertAdjacentHTML('afterbegin', content)
      return
    }
    if (Array.isArray(content)) {
      for (const part of content) _paintSection(container, part)
    }
  }

  function edit(fieldKey, value) {
    _pendingEdits[fieldKey] = value
    _renderTop()
  }

  function discard() {
    if (!_hasPending()) return
    _pendingEdits = {}
    _renderTop()
  }

  async function save() {
    const top = _stack[_stack.length - 1]
    if (!top) return
    const handler = _types.get(top.type)
    if (typeof handler?.save !== 'function') {
      Utils.showToast('This entity is not editable from the panel', 'warn')
      return
    }
    if (!_hasPending()) return
    const edits = { ..._pendingEdits }
    try {
      const updated = await handler.save(top.id, edits)
      if (updated) top.entity = updated
      _pendingEdits = {}
      Utils.showToast('Saved', 'success')
      await _renderTop()
    } catch (err) {
      console.error('[Panel] save failed', err)
      Utils.showToast(err.message || 'Save failed', 'error')
    }
  }

  function current() {
    const top = _stack[_stack.length - 1]
    return top ? { type: top.type, id: top.id } : null
  }

  function _hasPending() {
    return Object.keys(_pendingEdits).length > 0
  }

  return {
    registerType, open, push, pop, close,
    edit, save, discard, current
  }
})()

window.Panel = Panel
