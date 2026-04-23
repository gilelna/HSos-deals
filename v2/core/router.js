// v2/core/router.js — URL-state router.
// URL shape: ?entity=<type>&id=<id>&view=<view>&from=<source>
// Handlers are registered per entity type; dispatch() calls the matching handler
// with the URL params. open() pushes state + dispatches.
// Deps: none.

const Router = (() => {
  const _handlers = new Map()
  let _dispatching = false

  function register(entity, fn) {
    if (typeof fn !== 'function') {
      console.error(`[Router] handler for "${entity}" must be a function`)
      return
    }
    if (_handlers.has(entity)) {
      console.error(`[Router] handler for "${entity}" already registered — replacing`)
    }
    _handlers.set(entity, fn)
  }

  function getParams() {
    const p = new URLSearchParams(window.location.search)
    const out = {}
    for (const [k, v] of p) out[k] = v
    return out
  }

  function _buildQuery(params) {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(params || {})) {
      if (v !== null && v !== undefined && v !== '') p.set(k, String(v))
    }
    const s = p.toString()
    return s ? `?${s}` : ''
  }

  function open({ entity, id, view, from }) {
    if (!entity) { console.error('[Router] open() requires entity'); return }
    if (!id) { console.error(`[Router] open("${entity}") requires id`); return }
    const url = window.location.pathname + _buildQuery({ entity, id, view, from })
    if (_dispatching) return
    window.history.pushState({ entity, id, view, from }, '', url)
    dispatch()
  }

  function replace({ entity, id, view, from }) {
    const url = window.location.pathname + _buildQuery({ entity, id, view, from })
    window.history.replaceState({ entity, id, view, from }, '', url)
  }

  function back() {
    window.history.back()
  }

  function closeAll() {
    const url = window.location.pathname
    window.history.pushState({}, '', url)
    dispatch()
  }

  function dispatch() {
    if (_dispatching) return
    _dispatching = true
    try {
      const params = getParams()
      if (!params.entity) return
      const fn = _handlers.get(params.entity)
      if (!fn) {
        console.error(`[Router] no handler for entity "${params.entity}"`)
        return
      }
      fn(params)
    } finally {
      _dispatching = false
    }
  }

  function init() {
    window.addEventListener('popstate', () => dispatch())
  }

  return { register, open, replace, back, closeAll, dispatch, getParams, init }
})()

window.Router = Router
