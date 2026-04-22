// import.js — HSos CSV Canvas Importer controller.
// Drives the 4-step wizard. All DB calls go through DBAdapter.

// ─── Entity metadata (defaults only — user overrides dedupeBy in Step 2 UI) ──
const ENTITY_META = {
  vendors:   { dedupeBy: ['email', 'name'] },
  companies: { dedupeBy: ['name'] },
  accounts:  { dedupeBy: ['name'] },
  clients:   { dedupeBy: ['name'] },
  deals:     { dedupeBy: ['name'] },
  sessions:  { dedupeBy: ['vendor_id', 'client_id', 'date'] },
  bills:     { dedupeBy: ['vendor_id'] },
  products:  { dedupeBy: ['name'] },
  rates:     { dedupeBy: ['vendor_id'] },
  // unknown tables fall back to ['id'] — shown with notice
}

// Fallback field lists used if information_schema is unavailable
const ENTITY_FALLBACKS = {
  vendors: [
    { column_name: 'name',            data_type: 'text', classification: 'text',     required: true,  skip: false, resolverKey: null },
    { column_name: 'email',           data_type: 'text', classification: 'text',     required: false, skip: false, resolverKey: null },
    { column_name: 'payout_currency', data_type: 'text', classification: 'text',     required: false, skip: false, resolverKey: null },
  ],
}

// ─── Session state ────────────────────────────────────────────────────────────

let _step          = 1
let _mapping       = []      // { csvHeader, colDef|null, confidence }[]
let _processedRows = []      // ProcessedRow[]
let _dupeSet       = new Set()
let _lastResult    = null

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await _loadTableDropdown()
  _loadRecentImports()
})

async function _loadTableDropdown() {
  const sel    = document.getElementById('table-select')
  const errEl  = document.getElementById('table-load-err')

  try {
    const tables = await DBAdapter.getTables()
    sel.innerHTML = ''
    for (const t of tables) {
      const opt   = document.createElement('option')
      opt.value   = t
      opt.textContent = t
      sel.appendChild(opt)
    }
  } catch (err) {
    errEl.textContent = `Could not load tables: ${err.message}`
    errEl.classList.remove('hidden')
    sel.innerHTML = '<option value="">— unavailable —</option>'
    document.getElementById('btn-parse').disabled = true
  }
}

// ─── Step navigation ──────────────────────────────────────────────────────────

/**
 * Navigate to step n. Steps > _step are not accessible forward
 * (user must click through), but any completed step can be revisited.
 */
function goToStep(n) {
  for (let i = 1; i <= 4; i++) {
    const card = document.getElementById(`step-${i}`)
    const ind  = document.getElementById(`si-${i}`)
    const num  = document.getElementById(`sn-${i}`)
    if (card) card.classList.toggle('hidden', i !== n)
    if (ind) {
      ind.classList.remove('active', 'done')
      if (i < n)      ind.classList.add('done')
      else if (i === n) ind.classList.add('active')
    }
    if (num) {
      if (i < n) num.innerHTML = '✓'
      else       num.textContent = String(i)
    }
  }
  _step = n
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/**
 * Clicking a step indicator goes BACK to that step only (not forward).
 */
function clickStep(n) {
  if (n < _step) goToStep(n)
}

// ─── Step 1 — Parse ───────────────────────────────────────────────────────────

async function onParse() {
  const tableName = document.getElementById('table-select').value
  const csvText   = document.getElementById('csv-textarea').value.trim()
  const hint      = document.getElementById('parse-hint')
  const btn       = document.getElementById('btn-parse')

  if (!tableName) { hint.textContent = 'Select a table first.'; return }
  if (!csvText)   { hint.textContent = 'Paste some CSV first.'; return }

  btn.disabled = true
  hint.textContent = 'Reading schema…'
  _clearError()

  try {
    const fallback = ENTITY_FALLBACKS[tableName] || null
    const { headers, schema } = await step1_parse(tableName, csvText, fallback)

    _mapping = step2_autoMap(headers, schema)
    _renderMapper(_mapping, schema)
    _renderRequiredWarning(schema, _mapping)
    _renderDedupeCheckboxes(tableName, schema, _mapping)

    const delimLabel = ImportState.delimiter === '\t' ? 'tab-separated' : 'comma-separated'
    hint.textContent = `${headers.length} column${headers.length !== 1 ? 's' : ''}, ${ImportState.rawRows.length} row${ImportState.rawRows.length !== 1 ? 's' : ''} · ${delimLabel}`
    goToStep(2)
  } catch (err) {
    _showError(err.message)
    hint.textContent = ''
  } finally {
    btn.disabled = false
  }
}

// ─── Step 2 — Column Mapper ───────────────────────────────────────────────────

function _renderMapper(mapping, schema) {
  const mappable = schema.filter(c => !c.skip)
  const tbody    = document.getElementById('mapper-body')
  tbody.innerHTML = ''

  mapping.forEach((m, idx) => {
    const tr = document.createElement('tr')

    // CSV column name
    const tdName = _td(`<span class="imp-col-name">${_esc(m.csvHeader)}</span>`)

    // Maps-to dropdown
    const tdMap = document.createElement('td')
    const sel   = document.createElement('select')
    sel.className   = 'fi fsel imp-map-sel'
    sel.id          = `map-sel-${idx}`
    sel.style.maxWidth = '200px'
    sel.onchange    = () => _onMapChange(idx, sel, schema)

    const ignOpt = new Option('— Ignore —', '')
    sel.appendChild(ignOpt)

    for (const col of mappable) {
      const opt = new Option(col.column_name, col.column_name)
      if (m.colDef && col.column_name === m.colDef.column_name) opt.selected = true
      sel.appendChild(opt)
    }

    const noteDiv = document.createElement('div')
    noteDiv.id    = `map-note-${idx}`
    _renderFKNote(noteDiv, m.colDef)

    tdMap.appendChild(sel)
    tdMap.appendChild(noteDiv)

    // Type badge
    const tdType = document.createElement('td')
    tdType.id    = `map-type-${idx}`
    _updateTypeTd(tdType, m.colDef)

    // Confidence badge
    const tdConf = document.createElement('td')
    tdConf.id    = `map-conf-${idx}`
    tdConf.innerHTML = _confBadge(m.confidence)

    // Extra notes (empty, FK note is below dropdown)
    const tdNote = _td('')
    tdNote.id    = `map-extra-${idx}`

    tr.append(tdName, tdMap, tdType, tdConf, tdNote)
    tbody.appendChild(tr)
  })
}

function _onMapChange(idx, sel, schema) {
  const colDef = schema.find(c => c.column_name === sel.value) || null
  _mapping[idx].colDef = colDef

  _updateTypeTd(document.getElementById(`map-type-${idx}`), colDef)
  document.getElementById(`map-conf-${idx}`).innerHTML = _confBadge(colDef ? 'exact' : 'none')
  _renderFKNote(document.getElementById(`map-note-${idx}`), colDef)

  _renderRequiredWarning(schema, _mapping)
  _renderDedupeCheckboxes(ImportState.tableName, ImportState.schema, _mapping)
}

/**
 * Show a warning banner listing required schema columns that aren't mapped yet.
 * These would fail at DB insert — user needs to know before hitting Preview.
 */
function _renderRequiredWarning(schema, mapping) {
  let el = document.getElementById('required-warning')
  if (!el) {
    el = document.createElement('div')
    el.id = 'required-warning'
    el.className = 'imp-req-warning hidden'
    // Insert before the mapper table
    const tbl = document.querySelector('.imp-map-tbl')
    tbl.parentNode.insertBefore(el, tbl)
  }

  const mappedColNames = new Set(
    mapping.filter(m => m.colDef).map(m => m.colDef.column_name)
  )
  const missing = schema.filter(c => !c.skip && c.required && !mappedColNames.has(c.column_name))

  if (missing.length === 0) {
    el.classList.add('hidden')
    return
  }

  el.classList.remove('hidden')
  el.innerHTML = `<strong>⚠ Required fields not mapped:</strong> ${missing.map(c =>
    `<span class="imp-req-chip">${_esc(c.column_name)}<span class="imp-req-chip-type">${c.classification}</span></span>`
  ).join(' ')}
  <div style="font-size:11px;margin-top:4px;color:var(--amber-text)">These rows will fail at import unless you map these columns or add them to your CSV.</div>`
}

function _updateTypeTd(td, colDef) {
  if (!colDef) {
    td.innerHTML = `<span style="color:var(--mu2);font-size:11px">—</span>`
    return
  }
  const req = colDef.required ? `<span class="imp-req-dot" title="Required"></span>` : ''
  td.innerHTML = `<span class="imp-type-badge imp-type-${colDef.classification}">${colDef.classification}</span>${req}`
}

function _renderFKNote(el, colDef) {
  if (!colDef || colDef.classification !== 'fk') { el.innerHTML = ''; return }
  const r = getResolver(colDef.column_name)
  if (r) {
    el.innerHTML = `<div class="imp-fk-note">resolves name → ID via <strong>${r.table}</strong></div>`
  } else {
    el.innerHTML = `<div class="imp-fk-warn">⚠ No resolver — value imported as-is</div>`
  }
}

function _confBadge(conf) {
  if (conf === 'exact') return `<span class="imp-conf imp-conf-exact">✓ exact</span>`
  if (conf === 'fuzzy') return `<span class="imp-conf imp-conf-fuzzy">~ fuzzy</span>`
  return `<span class="imp-conf imp-conf-none">✗ none</span>`
}

// ─── Step 2 — DedupeBy checkboxes ─────────────────────────────────────────────

function _renderDedupeCheckboxes(tableName, schema, mapping) {
  const wrap   = document.getElementById('dedup-checkboxes')
  const notice = document.getElementById('dedup-notice')
  wrap.innerHTML = ''
  notice.classList.add('hidden')

  // Mappable non-system columns that are currently mapped
  const activeMapped = mapping
    .filter(m => m.colDef && !m.colDef.skip)
    .map(m => m.colDef.column_name)

  // All non-system schema columns (for checkbox universe)
  const candidates = schema.filter(c => !c.skip)

  if (candidates.length === 0) {
    notice.textContent = 'No mappable fields — dedup disabled.'
    notice.classList.remove('hidden')
    return
  }

  // Get default dedupeBy from ENTITY_META
  const meta      = ENTITY_META[tableName]
  const defaults  = meta ? meta.dedupeBy : ['id']

  if (!meta) {
    notice.textContent = 'Unknown table — defaulting to "id". Check the dedup fields below.'
    notice.classList.remove('hidden')
  }

  for (const col of candidates) {
    const isDefault = defaults.includes(col.column_name)
    const isMapped  = activeMapped.includes(col.column_name)

    const label = document.createElement('label')
    label.className = 'dedup-check-label' + (isMapped ? '' : ' dedup-check-unmapped')
    label.title = isMapped ? '' : 'This column is not currently mapped — may not deduplicate correctly'

    const cb   = document.createElement('input')
    cb.type    = 'checkbox'
    cb.value   = col.column_name
    cb.id      = `dedup-${col.column_name}`
    cb.checked = isDefault

    const typeSpan = document.createElement('span')
    typeSpan.className = 'dedup-type'
    typeSpan.textContent = col.classification

    label.append(cb, document.createTextNode(' ' + col.column_name + ' '), typeSpan)
    if (!isMapped) {
      const warn = document.createElement('span')
      warn.className   = 'dedup-warn-icon'
      warn.textContent = ' ⚠'
      label.appendChild(warn)
    }
    wrap.appendChild(label)
  }
}

/**
 * Read current dedupeBy selection from checkboxes.
 * @returns {string[]}
 */
function _getDedupeBy() {
  return [...document.querySelectorAll('#dedup-checkboxes input[type=checkbox]:checked')]
    .map(cb => cb.value)
}

// ─── Step 3 — Preview ─────────────────────────────────────────────────────────

async function onPreview() {
  const btn = document.getElementById('btn-preview')
  btn.disabled = true
  _clearError()

  // Snapshot current mapping from selects
  _mapping = _mapping.map((m, idx) => {
    const sel    = document.getElementById(`map-sel-${idx}`)
    const colDef = ImportState.schema.find(c => c.column_name === sel?.value) || null
    return { ...m, colDef }
  })

  // Read user's dedupeBy selection
  ImportState.dedupeBy = _getDedupeBy()

  try {
    _processedRows = await step3_processRows(_mapping, ImportState.rawRows)
    _dupeSet       = await step3_checkDupes(_processedRows, ImportState.tableName, ImportState.dedupeBy)

    // Tag dupe rows (don't override error rows)
    _dupeSet.forEach(i => {
      if (_processedRows[i].status !== 'error') _processedRows[i].status = 'dupe'
    })

    _renderPreview(_processedRows, _mapping)
    goToStep(3)
  } catch (err) {
    _showError('Preview failed: ' + err.message)
  } finally {
    btn.disabled = false
  }
}

function _renderPreview(rows, mapping) {
  const activeCols = mapping.filter(m => m.colDef)

  // Summary counts
  let nReady = 0, nWarn = 0, nError = 0, nDupe = 0
  rows.forEach(r => {
    if      (r.status === 'ready') nReady++
    else if (r.status === 'warn')  nWarn++
    else if (r.status === 'error') nError++
    else if (r.status === 'dupe')  nDupe++
  })

  document.getElementById('summary-bar').innerHTML = [
    `<span class="sum-ok">✓ ${nReady} ready</span>`,
    nDupe  ? `<span class="sum-dupe">≈ ${nDupe} duplicate${nDupe > 1 ? 's' : ''}</span>` : '',
    nError ? `<span class="sum-err">✗ ${nError} error${nError > 1 ? 's' : ''}</span>` : '',
    nWarn  ? `<span class="sum-warn">⚠ ${nWarn} warning${nWarn > 1 ? 's' : ''}</span>` : '',
  ].join('')

  // Dupe batch panel
  const dupePanel = document.getElementById('dupe-panel')
  if (nDupe > 0) {
    document.getElementById('dupe-panel-title').textContent =
      `≈ ${nDupe} duplicate${nDupe > 1 ? 's' : ''} found`
    dupePanel.classList.remove('hidden')
    // Reset batch button highlights
    document.getElementById('btn-skip-all').classList.toggle('btn-gold', ImportState.batchAction === 'skip')
    document.getElementById('btn-update-all').classList.toggle('btn-gold', ImportState.batchAction === 'update')
  } else {
    dupePanel.classList.add('hidden')
  }

  // Import button count (all non-error rows)
  const willImport = nReady + nWarn + nDupe
  document.getElementById('btn-import-count').textContent = willImport

  // Table header
  document.getElementById('preview-thead').innerHTML = `<tr>
    <th style="width:24px"></th>
    ${activeCols.map(m => `<th>${_esc(m.colDef.column_name)}</th>`).join('')}
    ${nDupe > 0 ? '<th style="width:120px">Action</th>' : ''}
  </tr>`

  // Table rows
  const tbody = document.getElementById('preview-tbody')
  tbody.innerHTML = ''

  rows.forEach((row, i) => {
    const tr  = document.createElement('tr')
    tr.id     = `prev-row-${i}`
    tr.className = `imp-row-${row.status}`

    // Status dot
    const tip = [...row.errors, ...row.warnings].join('\n') ||
      (row.status === 'dupe' ? 'Duplicate found in DB' : 'Ready to import')
    const tdSt = _td(`<span class="imp-dot imp-dot-${row.status}" data-tip="${_esc(tip)}"></span>`)
    tr.appendChild(tdSt)

    // Data cells
    for (const m of activeCols) {
      const td  = document.createElement('td')
      const val = row.data[m.colDef.column_name]
      td.textContent = val == null ? '' : String(val)
      if (row.errors.some(e => e.includes(`"${m.colDef.column_name}"`))) {
        td.style.color = 'var(--red-text)'
      }
      tr.appendChild(td)
    }

    // Dupe action toggle
    if (nDupe > 0) {
      const tdDupe = document.createElement('td')
      tdDupe.id    = `dupe-cell-${i}`
      if (row.status === 'dupe') tdDupe.innerHTML = _dupeToggleHTML(i)
      tr.appendChild(tdDupe)
    }

    tbody.appendChild(tr)
  })
}

function _dupeToggleHTML(i) {
  const action = ImportState.dupeAction[i] ?? ImportState.batchAction
  return `<div class="imp-dupe-toggle">
    <button class="btn btn-sm ${action === 'skip'   ? 'imp-dt-skip-active'   : ''}" onclick="setRowDupeAction(${i},'skip')">Skip</button>
    <button class="btn btn-sm ${action === 'update' ? 'imp-dt-update-active' : ''}" onclick="setRowDupeAction(${i},'update')">Update</button>
  </div>`
}

function setBatchAction(action) {
  ImportState.batchAction = action
  _dupeSet.forEach(i => {
    if (ImportState.dupeAction[i] === undefined) {
      const cell = document.getElementById(`dupe-cell-${i}`)
      if (cell) cell.innerHTML = _dupeToggleHTML(i)
    }
  })
  document.getElementById('btn-skip-all').classList.toggle('btn-gold',   action === 'skip')
  document.getElementById('btn-update-all').classList.toggle('btn-gold', action === 'update')
}

function setRowDupeAction(i, action) {
  ImportState.dupeAction[i] = action
  const cell = document.getElementById(`dupe-cell-${i}`)
  if (cell) cell.innerHTML = _dupeToggleHTML(i)
}

// ─── Step 4 — Import ─────────────────────────────────────────────────────────

async function onImport() {
  goToStep(4)
  document.getElementById('progress-area').style.display      = ''
  document.getElementById('result-card').classList.add('hidden')
  document.getElementById('failed-area').classList.add('hidden')
  document.getElementById('step4-actions').style.display      = 'none'
  document.getElementById('step4-title').textContent          = 'Importing…'
  document.getElementById('progress-bar').style.width         = '0%'
  document.getElementById('pc-imported').textContent          = '✓ 0'
  document.getElementById('pc-skipped').textContent           = '⊘ 0'
  document.getElementById('pc-failed').textContent            = '✗ 0'

  const total = _processedRows.length
  let imported = 0, skipped = 0, failed = 0

  function onProgress(done, t, status) {
    if (status === 'imported') imported++
    if (status === 'skipped')  skipped++
    if (status === 'failed')   failed++
    const pct = Math.round((done / t) * 100)
    document.getElementById('progress-bar').style.width = pct + '%'
    document.getElementById('pc-imported').textContent  = `✓ ${imported}`
    document.getElementById('pc-skipped').textContent   = `⊘ ${skipped}`
    document.getElementById('pc-failed').textContent    = `✗ ${failed}`
  }

  const mappingSnapshot = buildMappingSnapshot(_mapping)

  try {
    _lastResult = await step4_import(
      _processedRows,
      _dupeSet,
      ImportState.dupeAction,
      ImportState.batchAction,
      ImportState.tableName,
      ImportState.schema,
      mappingSnapshot,
      onProgress,
    )
  } catch (err) {
    _showError('Import crashed: ' + err.message)
    return
  }

  _renderResult(_lastResult)
  _loadRecentImports()
}

function _renderResult(result) {
  document.getElementById('step4-title').textContent = 'Import complete'

  const card = document.getElementById('result-card')
  card.classList.remove('hidden')
  document.getElementById('result-stats').innerHTML = `
    <span style="color:var(--green-text)">✓ ${result.imported} imported</span>
    <span style="color:var(--mu)">⊘ ${result.skipped} skipped</span>
    <span style="color:var(--red-text)">✗ ${result.failed} failed</span>
  `
  document.getElementById('result-batch').textContent = `Batch ID: ${result.batchId}`

  if (result.failedRows.length > 0) {
    document.getElementById('failed-area').classList.remove('hidden')
    document.getElementById('failed-title').textContent =
      `${result.failedRows.length} row${result.failedRows.length > 1 ? 's' : ''} failed:`
    document.getElementById('failed-list').innerHTML = result.failedRows
      .map(fr => `<div>Row ${fr.csvRowIndex + 2}: ${_esc(fr.reasons.join('; '))}</div>`)
      .join('')
  }

  document.getElementById('step4-actions').style.display = 'flex'
}

// ─── Failed CSV download ──────────────────────────────────────────────────────

function downloadFailed() {
  if (!_lastResult || !_lastResult.failedRows.length) return
  const csv  = failedRowsToCSV(_lastResult.failedRows, ImportState.headers, ImportState.rawRows)
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `failed-rows-${_lastResult.batchId}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// ─── Reset ────────────────────────────────────────────────────────────────────

function resetImporter() {
  ImportState.reset()
  _mapping       = []
  _processedRows = []
  _dupeSet       = new Set()
  _lastResult    = null

  document.getElementById('csv-textarea').value     = ''
  document.getElementById('parse-hint').textContent = ''
  document.getElementById('mapper-body').innerHTML  = ''
  _clearError()
  clearResolverCache()
  goToStep(1)
}

// ─── Recent imports ───────────────────────────────────────────────────────────

async function _loadRecentImports() {
  const tbody = document.getElementById('recent-tbody')
  try {
    const logs = await DBAdapter.getRecentImports(10)
    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--mu2)">No imports yet.</td></tr>'
      return
    }
    tbody.innerHTML = logs.map((log, i) => `
      <tr onclick="showMappingDetail(${i})" style="cursor:pointer"
          data-mapping="${_esc(JSON.stringify(log.column_mapping || {}))}">
        <td>${_esc(log.table_name)}</td>
        <td>${log.rows_total ?? '—'}</td>
        <td style="color:var(--green-text)">${log.rows_imported ?? '—'}</td>
        <td style="color:var(--mu)">${log.rows_skipped ?? '—'}</td>
        <td style="color:var(--red-text)">${log.rows_failed ?? '—'}</td>
        <td style="color:var(--mu)">${_timeAgo(log.created_at)}</td>
      </tr>
    `).join('')
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--mu2)">Could not load recent imports.</td></tr>'
  }
}

function showMappingDetail(idx) {
  const row = document.getElementById('recent-tbody').querySelectorAll('tr')[idx]
  if (!row) return

  const wrap    = document.getElementById('mapping-detail-wrap')
  const content = document.getElementById('mapping-detail-content')
  let mapping   = {}

  try { mapping = JSON.parse(row.dataset.mapping || '{}') } catch (_) {}

  const entries = Object.entries(mapping)
  content.innerHTML = entries.length
    ? entries.map(([csv, db]) => `<div><span class="imp-map-csv">${_esc(csv)}</span> → <span class="imp-map-db">${_esc(db)}</span></div>`).join('')
    : '<div style="color:var(--mu2)">(no mapping recorded)</div>'

  wrap.classList.remove('hidden')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _td(html) {
  const td = document.createElement('td')
  td.innerHTML = html
  return td
}

function _showError(msg) {
  const el = document.getElementById('error-banner')
  el.textContent = msg
  el.classList.remove('hidden')
}

function _clearError() {
  document.getElementById('error-banner').classList.add('hidden')
}

function _esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function _timeAgo(iso) {
  if (!iso) return '—'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)               return 'just now'
  if (s < 3600)             return `${Math.floor(s / 60)}m ago`
  if (s < 86400)            return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 2)        return 'Yesterday'
  return `${Math.floor(s / 86400)} days ago`
}
