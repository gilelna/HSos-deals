// v2/components/table.js — Reusable config-driven table.
// Config: { container, columns, rows, filters, onRowClick, exportFilename, pageSize }
//   columns: [{ key, label, render?(row), sortable?, className?, raw? }]
//     - render may return a string, Node, or null.
//     - raw:true marks a column whose render output is trusted HTML
//       (use for Badges.* output). Callers are responsible for escaping.
//       Without raw, string output is inserted via textContent.
//   filters: [{ key, label, options:[{value,label}] }]  (optional)
// Controller API: setRows(rows), refresh(), exportCSV(), destroy()
// Deps: Utils.

const Table = (() => {
  const PAGE_SIZE_OPTIONS = [25, 50, 100]

  function create(cfg) {
    const container = cfg.container
    if (!container) {
      console.error('[Table] container required')
      return null
    }
    const columns = Array.isArray(cfg.columns) ? cfg.columns : []
    const filters = Array.isArray(cfg.filters) ? cfg.filters : []
    const onRowClick = typeof cfg.onRowClick === 'function' ? cfg.onRowClick : null
    const exportFilename = cfg.exportFilename || 'export.csv'

    let rows = Array.isArray(cfg.rows) ? cfg.rows.slice() : []
    let search = ''
    const filterValues = {}
    let sortKey = null
    let sortDir = 'asc'
    let page = 1
    let pageSize = PAGE_SIZE_OPTIONS.includes(cfg.pageSize) ? cfg.pageSize : 25

    // ─── DOM scaffold ───────────────────────────────────────────
    while (container.firstChild) container.removeChild(container.firstChild)
    container.classList.add('v2-table-wrap')

    const toolbar = document.createElement('div')
    toolbar.className = 'v2-table-toolbar'

    const searchInput = document.createElement('input')
    searchInput.type = 'search'
    searchInput.placeholder = 'Search…'
    searchInput.className = 'v2-table-search fi'
    toolbar.appendChild(searchInput)

    const filterEls = {}
    for (const f of filters) {
      const sel = document.createElement('select')
      sel.className = 'v2-table-filter fi'
      sel.dataset.key = f.key
      const blank = document.createElement('option')
      blank.value = ''
      blank.textContent = f.label ? `All ${f.label}` : 'All'
      sel.appendChild(blank)
      for (const opt of (f.options || [])) {
        const o = document.createElement('option')
        o.value = opt.value
        o.textContent = opt.label
        sel.appendChild(o)
      }
      toolbar.appendChild(sel)
      filterEls[f.key] = sel
    }

    const exportBtn = document.createElement('button')
    exportBtn.type = 'button'
    exportBtn.className = 'btn btn-ghost btn-sm v2-table-export'
    exportBtn.textContent = 'Export CSV'
    toolbar.appendChild(exportBtn)

    const tableEl = document.createElement('table')
    tableEl.className = 'tbl v2-table'
    const thead = document.createElement('thead')
    const theadRow = document.createElement('tr')
    for (const c of columns) {
      const th = document.createElement('th')
      th.textContent = c.label || c.key
      if (c.sortable !== false) {
        th.classList.add('v2-sortable')
        th.dataset.key = c.key
      }
      if (c.className) th.classList.add(c.className)
      theadRow.appendChild(th)
    }
    thead.appendChild(theadRow)
    tableEl.appendChild(thead)

    const tbody = document.createElement('tbody')
    tableEl.appendChild(tbody)

    const footer = document.createElement('div')
    footer.className = 'v2-table-footer'

    const countEl = document.createElement('div')
    countEl.className = 'v2-table-count'
    footer.appendChild(countEl)

    const pagerEl = document.createElement('div')
    pagerEl.className = 'v2-table-pager'
    footer.appendChild(pagerEl)

    const sizeSel = document.createElement('select')
    sizeSel.className = 'v2-table-size fi'
    for (const n of PAGE_SIZE_OPTIONS) {
      const o = document.createElement('option')
      o.value = String(n)
      o.textContent = `${n} / page`
      if (n === pageSize) o.selected = true
      sizeSel.appendChild(o)
    }
    footer.appendChild(sizeSel)

    container.append(toolbar, tableEl, footer)

    // ─── Cell insertion (trusted-html opt-in) ───────────────────
    function _renderCell(td, col, row) {
      const value = typeof col.render === 'function' ? col.render(row) : row[col.key]
      if (value instanceof Node) {
        td.appendChild(value)
        return
      }
      if (value === null || value === undefined) {
        td.textContent = ''
        return
      }
      if (col.raw === true && typeof value === 'string') {
        // Trusted HTML (e.g. Badges output). Callers must escape user data.
        td.insertAdjacentHTML('afterbegin', value)
        return
      }
      td.textContent = String(value)
    }

    // ─── Filtering + sorting ────────────────────────────────────
    function _matchesFilters(row) {
      if (search) {
        const hay = columns.map(c => {
          const v = row[c.key]
          return v === null || v === undefined ? '' : String(v)
        }).join(' ').toLowerCase()
        if (!hay.includes(search.toLowerCase())) return false
      }
      for (const [k, v] of Object.entries(filterValues)) {
        if (v === '' || v === null || v === undefined) continue
        if (String(row[k] ?? '') !== String(v)) return false
      }
      return true
    }

    function _sorted(arr) {
      if (!sortKey) return arr
      const dir = sortDir === 'desc' ? -1 : 1
      return arr.slice().sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey]
        if (av === bv) return 0
        if (av === null || av === undefined) return 1
        if (bv === null || bv === undefined) return -1
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
        return String(av).localeCompare(String(bv)) * dir
      })
    }

    function _filtered() {
      return rows.filter(_matchesFilters)
    }

    // ─── Render ─────────────────────────────────────────────────
    function refresh() {
      const filtered = _sorted(_filtered())
      const total = filtered.length
      const pages = Math.max(1, Math.ceil(total / pageSize))
      if (page > pages) page = pages

      const start = (page - 1) * pageSize
      const pageRows = filtered.slice(start, start + pageSize)

      while (tbody.firstChild) tbody.removeChild(tbody.firstChild)
      if (pageRows.length === 0) {
        const tr = document.createElement('tr')
        const td = document.createElement('td')
        td.colSpan = columns.length
        td.className = 'v2-table-empty'
        td.textContent = 'No rows to show'
        tr.appendChild(td)
        tbody.appendChild(tr)
      } else {
        for (const row of pageRows) {
          const tr = document.createElement('tr')
          if (onRowClick) {
            tr.classList.add('v2-row-clickable')
            tr.addEventListener('click', e => {
              if (e.target.closest('button, a, input, select, textarea')) return
              onRowClick(row, e)
            })
          }
          for (const c of columns) {
            const td = document.createElement('td')
            if (c.className) td.classList.add(c.className)
            _renderCell(td, c, row)
            tr.appendChild(td)
          }
          tbody.appendChild(tr)
        }
      }

      countEl.textContent = `${total} row${total === 1 ? '' : 's'}`
      _renderPager(pages)
      _renderSortIndicators()
    }

    function _renderPager(pages) {
      while (pagerEl.firstChild) pagerEl.removeChild(pagerEl.firstChild)
      if (pages <= 1) return
      const mkBtn = (label, targetPage, disabled) => {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'btn btn-ghost btn-sm'
        b.textContent = label
        b.disabled = !!disabled
        if (!disabled) b.addEventListener('click', () => { page = targetPage; refresh() })
        return b
      }
      pagerEl.appendChild(mkBtn('‹', Math.max(1, page - 1), page === 1))
      const info = document.createElement('span')
      info.className = 'v2-table-pageinfo'
      info.textContent = `Page ${page} of ${pages}`
      pagerEl.appendChild(info)
      pagerEl.appendChild(mkBtn('›', Math.min(pages, page + 1), page === pages))
    }

    function _renderSortIndicators() {
      for (const th of theadRow.querySelectorAll('th.v2-sortable')) {
        th.classList.remove('v2-sort-asc', 'v2-sort-desc')
        if (th.dataset.key === sortKey) {
          th.classList.add(sortDir === 'desc' ? 'v2-sort-desc' : 'v2-sort-asc')
        }
      }
    }

    // ─── CSV export ─────────────────────────────────────────────
    function exportCSV() {
      const rowsOut = _sorted(_filtered())
      const lines = []
      lines.push(columns.map(c => _csv(c.label || c.key)).join(','))
      for (const row of rowsOut) {
        lines.push(columns.map(c => _csv(row[c.key])).join(','))
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = exportFilename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    function _csv(v) {
      if (v === null || v === undefined) return ''
      const s = String(v)
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    // ─── Wiring ─────────────────────────────────────────────────
    let searchTimer = null
    searchInput.addEventListener('input', e => {
      clearTimeout(searchTimer)
      searchTimer = setTimeout(() => {
        search = e.target.value
        page = 1
        refresh()
      }, 150)
    })

    for (const f of filters) {
      filterEls[f.key].addEventListener('change', e => {
        filterValues[f.key] = e.target.value
        page = 1
        refresh()
      })
    }

    exportBtn.addEventListener('click', exportCSV)

    sizeSel.addEventListener('change', e => {
      pageSize = Number(e.target.value)
      page = 1
      refresh()
    })

    theadRow.addEventListener('click', e => {
      const th = e.target.closest('th.v2-sortable')
      if (!th) return
      const key = th.dataset.key
      if (sortKey === key) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc'
      } else {
        sortKey = key
        sortDir = 'asc'
      }
      refresh()
    })

    refresh()

    return {
      setRows(next) { rows = Array.isArray(next) ? next.slice() : []; page = 1; refresh() },
      refresh,
      exportCSV,
      destroy() { while (container.firstChild) container.removeChild(container.firstChild) }
    }
  }

  return { create }
})()

window.Table = Table
