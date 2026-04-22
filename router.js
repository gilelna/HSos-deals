// router.js — shared URL-state router for HSos pages
;(function initRouter(global) {
  const FILE_PAGE_PATH = {
    operations: 'deals.html',
    workload: 'workload.html',
    payments: 'payments.html',
  }

  const PAGE_ALIASES = {
    operations: ['operations', 'deals', 'deals.html', 'client-profile', 'client-profile.html'],
    workload: ['workload', 'workload.html'],
    payments: ['payments', 'payments.html'],
  }

  function normalizePathname(pathname) {
    return String(pathname || '')
      .replace(/^\/+|\/+$/g, '')
      .toLowerCase()
  }

  function prefersHtmlPaths() {
    return /\.html$/i.test(window.location.pathname || '')
  }

  function resolvePageFromPath(pathname) {
    const normalized = normalizePathname(pathname)
    if (!normalized) return 'operations'
    for (const [page, aliases] of Object.entries(PAGE_ALIASES)) {
      if (aliases.includes(normalized)) return page
    }
    const segment = normalized.split('/').pop()
    for (const [page, aliases] of Object.entries(PAGE_ALIASES)) {
      if (aliases.includes(segment)) return page
    }
    return 'operations'
  }

  function pathForPage(page) {
    const target = page || resolvePageFromPath(window.location.pathname)
    if (prefersHtmlPaths()) return FILE_PAGE_PATH[target] || window.location.pathname
    return `/${target}`
  }

  function toUrl({ page, path, entity, id, view, from }) {
    const basePath = path || (page ? pathForPage(page) : window.location.pathname)
    const qs = new URLSearchParams()
    if (entity) qs.set('entity', entity)
    if (id) qs.set('id', id)
    if (view) qs.set('view', view)
    if (from) qs.set('from', from)
    const query = qs.toString()
    return query ? `${basePath}?${query}` : basePath
  }

  const Router = {
    handlers: {},

    getPage() {
      return resolvePageFromPath(window.location.pathname)
    },

    pathForPage,

    getParams() {
      const p = new URLSearchParams(window.location.search)
      return {
        entity: p.get('entity'),
        id: p.get('id'),
        view: p.get('view') || 'drawer',
        from: p.get('from') || 'list',
      }
    },

    urlFor({ page, path, entity, id, view = 'drawer', from = 'list' }) {
      return toUrl({ page, path, entity, id, view, from })
    },

    pageUrl(page, { entity, id, view = 'drawer', from = 'list' } = {}) {
      return toUrl({ page, entity, id, view, from })
    },

    open({ entity, id, view = 'drawer', from = 'list' }) {
      if (!entity || !id) return
      const cur = Router.getParams()
      if (cur.entity === entity && cur.id === String(id)) return
      const url = toUrl({ entity, id, view, from })
      window.history.pushState({ entity, id, view, from }, '', url)
      Router.dispatch()
    },

    navigate({ page, path, entity, id, view = 'drawer', from = 'list' }) {
      window.location.href = toUrl({ page, path, entity, id, view, from })
    },

    back() {
      window.history.back()
    },

    close() {
      window.history.pushState({}, '', window.location.pathname)
      Router.dispatch()
    },

    dispatch() {
      const { entity, id, view, from } = Router.getParams()
      if (entity && id) {
        const fn = Router.handlers[entity]
        if (typeof fn === 'function') {
          fn({ id, entity, view, from })
          return
        }
      }
      Router.closeAll()
    },

    register(entity, fn) {
      Router.handlers[entity] = fn
    },

    unregister(entity) {
      delete Router.handlers[entity]
    },

    closeAll() {
      document.dispatchEvent(new CustomEvent('router:close'))
    },
  }

  global.Router = Router
  window.addEventListener('popstate', () => Router.dispatch())
  document.addEventListener('DOMContentLoaded', () => Router.dispatch())
})(window)
