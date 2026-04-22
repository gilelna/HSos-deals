// table-framework.js — Reusable table filter/search/pagination/export/URL module
// Usage: const tbl = TableFramework.create(config)
//   config.tableId      — tbody element ID
//   config.paginationId — pagination container ID
//   config.namespace    — URL param namespace (e.g. 'inc', 'rec', 'cc')
//   config.pageSize     — default page size (default 50)
//   config.columns      — array of column defs for CSV export: { key, label, getValue }
//   config.filename     — CSV filename prefix

window.TableFramework = (function () {

  function create(config) {
    const ns       = config.namespace || 'tbl'
    const pageSize = config.pageSize  || 50

    const state = {
      allRows:    [],
      filtered:   [],
      page:       0,
      pageSize,
      sortKey:    null,
      sortDir:    'asc',
      search:     '',
      filters:    {},   // arbitrary key → value
    }

    // ── URL persistence ────────────────────────────────────────────────
    function pushUrl() {
      const qs = new URLSearchParams(window.location.search)
      if (state.search)       qs.set(`${ns}_q`, state.search); else qs.delete(`${ns}_q`)
      Object.entries(state.filters).forEach(([k, v]) => {
        if (v) qs.set(`${ns}_${k}`, v); else qs.delete(`${ns}_${k}`)
      })
      if (state.page > 0) qs.set(`${ns}_page`, state.page); else qs.delete(`${ns}_page`)
      if (state.sortKey) { qs.set(`${ns}_sort`, state.sortKey); qs.set(`${ns}_dir`, state.sortDir) }
      else { qs.delete(`${ns}_sort`); qs.delete(`${ns}_dir`) }
      history.replaceState({}, '', `${window.location.pathname}?${qs}`)
    }

    function restoreUrl(filterKeys = []) {
      const qs = new URLSearchParams(window.location.search)
      const q = qs.get(`${ns}_q`); if (q) state.search = q
      filterKeys.forEach(k => {
        const v = qs.get(`${ns}_${k}`); if (v) state.filters[k] = v
      })
      const page = parseInt(qs.get(`${ns}_page`), 10); if (!isNaN(page) && page > 0) state.page = page
      const sort = qs.get(`${ns}_sort`); if (sort) { state.sortKey = sort; state.sortDir = qs.get(`${ns}_dir`) || 'asc' }
    }

    // ── Filter + sort + paginate ───────────────────────────────────────
    function applyFilters(filterFn) {
      // filterFn(row, { search, filters }) → bool
      state.filtered = state.allRows.filter(row => filterFn(row, { search: state.search, filters: state.filters }))
      if (state.sortKey) {
        state.filtered.sort((a, b) => {
          let av = a[state.sortKey]; let bv = b[state.sortKey]
          if (av == null) av = ''; if (bv == null) bv = ''
          const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
          return state.sortDir === 'desc' ? -cmp : cmp
        })
      }
      state.page = 0
    }

    function getPage() {
      const start = state.page * state.pageSize
      return state.filtered.slice(start, start + state.pageSize)
    }

    function goPage(p) {
      const total = Math.max(1, Math.ceil(state.filtered.length / state.pageSize))
      state.page = Math.max(0, Math.min(p, total - 1))
    }

    function toggleSort(key) {
      if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc'
      else { state.sortKey = key; state.sortDir = 'asc' }
    }

    // ── Pagination renderer ────────────────────────────────────────────
    function renderPagination(onNavigate) {
      const el = document.getElementById(config.paginationId)
      if (!el) return
      const total      = state.filtered.length
      const totalPages = Math.max(1, Math.ceil(total / state.pageSize))
      const page       = state.page
      const start      = page * state.pageSize
      const end        = Math.min(start + state.pageSize, total)

      if (totalPages <= 1 && total <= state.pageSize) {
        el.innerHTML = `<span style="font-size:12px;color:var(--mu2)">${total} record${total !== 1 ? 's' : ''}</span>`
        return
      }

      el.innerHTML = `
        <span style="font-size:12px;color:var(--mu)">${start + 1}–${end} of ${total}</span>
        <button class="btn btn-sm btn-ghost" onclick="(${goPage.toString()})(${page - 1}); (${_triggerNav.toString()})()" ${page === 0 ? 'disabled' : ''}>← Prev</button>
        <span style="font-size:12px;color:var(--mu)">Page ${page + 1} / ${totalPages}</span>
        <button class="btn btn-sm btn-ghost" onclick="(${goPage.toString()})(${page + 1}); (${_triggerNav.toString()})()" ${page >= totalPages - 1 ? 'disabled' : ''}>Next →</button>
      `

      function _triggerNav() { if (onNavigate) onNavigate() }
    }

    // ── Simple pagination — render with callbacks ──────────────────────
    function renderPaginationSimple(onPage) {
      const el = document.getElementById(config.paginationId)
      if (!el) return
      const total      = state.filtered.length
      const totalPages = Math.max(1, Math.ceil(total / state.pageSize))
      const page       = state.page
      const start      = page * state.pageSize
      const end        = Math.min(start + state.pageSize, total)

      if (totalPages <= 1) {
        el.innerHTML = `<span style="font-size:12px;color:var(--mu2)">${total} record${total !== 1 ? 's' : ''}</span>`
        return
      }

      const btns = []
      for (let i = 0; i < totalPages; i++) {
        const active = i === page
        btns.push(`<button onclick="${onPage}(${i})" style="height:26px;padding:0 8px;border-radius:4px;border:1px solid var(--border);background:${active ? 'var(--ink)' : 'var(--surface)'};color:${active ? '#fff' : 'var(--ink)'};font-size:11px;cursor:pointer;font-family:var(--font-sans)">${i + 1}</button>`)
      }
      el.innerHTML = `<span style="font-size:12px;color:var(--mu2)">${total} records &nbsp;</span>` + btns.join(' ')
    }

    // ── CSV export ─────────────────────────────────────────────────────
    function exportCSV(rowsOverride) {
      const rows   = rowsOverride || state.filtered
      const cols   = config.columns || []
      const header = cols.map(c => c.label).join(',')
      const escape = v => {
        const s = (v == null ? '' : String(v)).replace(/"/g, '""')
        return /[",\n]/.test(s) ? `"${s}"` : s
      }
      const csvRows = [header]
      rows.forEach(row => {
        csvRows.push(cols.map(c => escape(c.getValue ? c.getValue(row) : row[c.key] ?? '')).join(','))
      })
      const blob  = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url   = URL.createObjectURL(blob)
      const a     = document.createElement('a')
      const today = new Date().toISOString().slice(0, 10)
      a.href     = url
      a.download = `${config.filename || ns}-${today}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }

    // ── Amount range filter helper ─────────────────────────────────────
    function amountInRange(amount, { amtMin, amtMax } = {}) {
      const n = Math.abs(Number(amount || 0))
      if (amtMin && n < Number(amtMin)) return false
      if (amtMax && n > Number(amtMax)) return false
      return true
    }

    return {
      state,
      applyFilters,
      getPage,
      goPage,
      toggleSort,
      pushUrl,
      restoreUrl,
      renderPagination,
      renderPaginationSimple,
      exportCSV,
      amountInRange,
    }
  }

  return { create }
})()
