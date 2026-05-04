// Shared client-side cache + in-flight guard.
// Loaded in HTML after db.js, before app.js. No DB calls live here.
// See RULES.md "Performance Patterns" for the read-through / invalidate-on-write contract.

(function () {
  const _store = new Map()        // key → { data, ts }
  const _inFlight = new Set()     // keys currently being fetched
  const TTL_MS = 5 * 60 * 1000    // 5 minutes

  window.Cache = {
    get(key) {
      const entry = _store.get(key)
      if (!entry) return null
      if (Date.now() - entry.ts > TTL_MS) { _store.delete(key); return null }
      return entry.data
    },
    set(key, data) {
      if (_store.size > 150) {
        // evict oldest 30 entries
        const sorted = [..._store.entries()].sort((a, b) => a[1].ts - b[1].ts)
        sorted.slice(0, 30).forEach(([k]) => _store.delete(k))
      }
      _store.set(key, { data, ts: Date.now() })
    },
    invalidate(key) { _store.delete(key) },
    invalidatePrefix(prefix) {
      for (const k of _store.keys()) { if (k.startsWith(prefix)) _store.delete(k) }
    },
    isInFlight(key) { return _inFlight.has(key) },
    markInFlight(key) { _inFlight.add(key) },
    clearInFlight(key) { _inFlight.delete(key) },

    // Read-through helper used by db.js wrappers.
    // Coalesces concurrent calls for the same key onto a single fetch.
    async readThrough(key, fetcher) {
      const cached = window.Cache.get(key)
      if (cached !== null) return cached
      if (window.Cache.isInFlight(key)) {
        await new Promise((resolve, reject) => {
          let tries = 0
          const t = setInterval(() => {
            if (!window.Cache.isInFlight(key)) { clearInterval(t); resolve() }
            else if (++tries > 60) { clearInterval(t); reject(new Error('cache wait timeout')) }
          }, 50)
        })
        const after = window.Cache.get(key)
        if (after !== null) return after
        // in-flight finished but didn't populate (error path) — fall through to refetch
      }
      window.Cache.markInFlight(key)
      try {
        const data = await fetcher()
        window.Cache.set(key, data)
        return data
      } finally {
        window.Cache.clearInFlight(key)
      }
    },
  }
})()
