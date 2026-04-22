// lib/importer-core.js — DB-agnostic import orchestration.
// Calls: DBAdapter, parseCSV, getTableSchema, classifyColumn,
//        validateCell, coerceCell, resolveFK, preloadResolvers, getResolver.

/**
 * Master session state. Mutated in-place as wizard advances.
 */
const ImportState = {
  tableName:     null,   // selected DB table
  csvText:       '',
  headers:       [],     // string[] — raw CSV headers
  rawRows:       [],     // string[][] — raw CSV data rows
  delimiter:     ',',    // detected delimiter: ',' or '\t'
  schema:        [],     // ColumnDef[] — classified columns
  dedupeBy:      [],     // string[] — columns chosen by user for dedup

  batchAction:  'skip',  // global default for dupes: 'skip'|'update'
  dupeAction:   {},      // { [rowIdx]: 'skip'|'update' } — per-row overrides

  reset() {
    this.tableName   = null
    this.csvText     = ''
    this.headers     = []
    this.rawRows     = []
    this.schema      = []
    this.dedupeBy    = []
    this.batchAction = 'skip'
    this.dupeAction  = {}
  },
}

// ─── Step 1 — Parse CSV + fetch schema ───────────────────────────────────────

/**
 * Parse CSV text, fetch live schema for the table.
 * @param {string} tableName
 * @param {string} csvText
 * @param {string[]|null} fallbackFields  optional ColumnDef[] if schema fetch fails
 * @returns {Promise<{ headers: string[], schema: ColumnDef[] }>}
 */
async function step1_parse(tableName, csvText, fallbackFields) {
  const { headers, rows, delimiter } = parseCSV(csvText)
  if (headers.length === 0) throw new Error('No data found — check your CSV or spreadsheet paste')

  let schema
  try {
    schema = await getTableSchema(tableName)
  } catch (err) {
    if (fallbackFields && fallbackFields.length > 0) {
      schema = fallbackFields
      console.warn('[Importer] Schema read failed, using fallback:', err.message)
    } else {
      throw err
    }
  }

  ImportState.tableName  = tableName
  ImportState.csvText    = csvText
  ImportState.headers    = headers
  ImportState.rawRows    = rows
  ImportState.delimiter  = delimiter
  ImportState.schema     = schema

  return { headers, schema }
}

// ─── Step 2 — Auto-map CSV headers to schema columns ─────────────────────────

/**
 * Auto-match CSV headers to schema columns.
 * @param {string[]}    headers
 * @param {ColumnDef[]} schema
 * @returns {Array<{ csvHeader: string, colDef: ColumnDef|null, confidence: 'exact'|'fuzzy'|'none' }>}
 */
function step2_autoMap(headers, schema) {
  const mappable = schema.filter(c => !c.skip)

  return headers.map(csvHeader => {
    const norm = _normalise(csvHeader)

    // Exact match (case-insensitive, spaces→underscores)
    let match = mappable.find(c => _normalise(c.column_name) === norm)
    if (match) return { csvHeader, colDef: match, confidence: 'exact' }

    // Fuzzy match (strip all separators)
    match = mappable.find(c => _loose(c.column_name) === _loose(csvHeader))
    if (match) return { csvHeader, colDef: match, confidence: 'fuzzy' }

    return { csvHeader, colDef: null, confidence: 'none' }
  })
}

function _normalise(s) { return String(s).toLowerCase().trim().replace(/\s+/g, '_') }
function _loose(s)     { return String(s).toLowerCase().replace(/[\s_\-]/g, '') }

// ─── Step 3 — Process rows (validate, resolve FKs) ───────────────────────────

/**
 * @typedef {Object} ProcessedRow
 * @property {Object}   data          mapped field values (coerced)
 * @property {string[]} errors        blocking errors
 * @property {string[]} warnings      non-blocking warnings
 * @property {'ready'|'warn'|'error'|'dupe'} status
 * @property {number}   csvRowIndex   0-based index in rawRows
 */

/**
 * Pre-load FK resolver caches, then process every raw row:
 * validate, coerce, and resolve FK names → UUIDs.
 *
 * @param {Array<{csvHeader, colDef, confidence}>} mapping
 * @param {string[][]} rawRows
 * @returns {Promise<ProcessedRow[]>}
 */
async function step3_processRows(mapping, rawRows) {
  // Preload FK resolver lookup tables
  const fkCols = mapping
    .filter(m => m.colDef && m.colDef.classification === 'fk')
    .map(m => m.colDef.column_name)
  await preloadResolvers(fkCols)

  // Collect required schema columns that aren't covered by any mapping entry.
  // These will fail at DB insert time if not caught here.
  const mappedColNames = new Set(
    mapping.filter(m => m.colDef).map(m => m.colDef.column_name)
  )
  const unmappedRequired = ImportState.schema.filter(
    c => !c.skip && c.required && !mappedColNames.has(c.column_name)
  )

  return rawRows.map((row, csvRowIndex) => {
    const data     = {}
    const errors   = []
    const warnings = []

    // ── Check required columns that aren't in the CSV at all ──────────────
    for (const col of unmappedRequired) {
      errors.push(`"${col.column_name}" is required but not mapped — add this column to your CSV or map it`)
    }

    // ── Process mapped columns ────────────────────────────────────────────
    for (let c = 0; c < mapping.length; c++) {
      const { csvHeader, colDef, confidence } = mapping[c]
      if (!colDef) continue  // user chose "Ignore"

      const rawVal = (row[c] ?? '').trim()

      if (confidence === 'fuzzy') {
        warnings.push(`"${csvHeader}" fuzzy-matched to "${colDef.column_name}"`)
      }

      if (colDef.classification === 'fk') {
        if (rawVal === '') {
          if (colDef.required) errors.push(`"${colDef.column_name}" is required`)
          data[colDef.column_name] = null
          continue
        }
        const resolver = getResolver(colDef.column_name)
        if (!resolver) {
          warnings.push(`FK "${colDef.column_name}" has no resolver — importing value as-is`)
          data[colDef.column_name] = rawVal
          continue
        }
        const { id, error: fkErr } = resolveFK(colDef.column_name, rawVal)
        if (fkErr) {
          errors.push(fkErr)
          data[colDef.column_name] = null
        } else {
          data[colDef.column_name] = id
        }
        continue
      }

      const valErr = validateCell(rawVal, colDef)
      if (valErr) {
        errors.push(valErr)
        data[colDef.column_name] = null
        continue
      }

      data[colDef.column_name] = coerceCell(rawVal, colDef)
    }

    const status = errors.length   > 0 ? 'error'
                 : warnings.length > 0 ? 'warn'
                 : 'ready'

    return { data, errors, warnings, status, csvRowIndex }
  })
}

/**
 * Check DB for duplicates among processed rows.
 * @param {ProcessedRow[]} processedRows
 * @param {string}         tableName
 * @param {string[]}       dedupeBy
 * @returns {Promise<Set<number>>}  indices into processedRows
 */
async function step3_checkDupes(processedRows, tableName, dedupeBy) {
  const rows = processedRows.map(r => r.data)
  return DBAdapter.checkDuplicates(tableName, rows, dedupeBy)
}

// ─── Step 4 — Execute import ──────────────────────────────────────────────────

/**
 * Insert / upsert rows according to their dupe status and the user's choices.
 *
 * @param {ProcessedRow[]}  processedRows
 * @param {Set<number>}     dupeSet
 * @param {{[i]:string}}    dupeAction      per-row 'skip'|'update'
 * @param {string}          batchAction     global default
 * @param {string}          tableName
 * @param {ColumnDef[]}     schemaColumns   full classified schema
 * @param {{[csv]:string}}  columnMapping   snapshot for log
 * @param {Function}        onProgress      (done, total, status) => void
 * @returns {Promise<{imported, skipped, failed, failedRows: Object[], batchId: string}>}
 */
async function step4_import(
  processedRows, dupeSet, dupeAction, batchAction,
  tableName, schemaColumns, columnMapping, onProgress,
) {
  const batchId = _uuid()
  const total   = processedRows.length
  let imported  = 0, skipped = 0, failed = 0
  const failedRows = []

  // Detect fingerprint columns
  const colNames  = schemaColumns.map(c => c.column_name)
  const hasVia    = colNames.includes('_imported_via')
  const hasBatch  = colNames.includes('_import_batch_id')

  for (let i = 0; i < processedRows.length; i++) {
    const row = processedRows[i]

    if (row.status === 'error') {
      failed++
      failedRows.push({ csvRowIndex: row.csvRowIndex, reasons: row.errors, data: row.data })
      onProgress?.(i + 1, total, 'failed')
      await _delay(10)
      continue
    }

    const isDupe  = dupeSet && dupeSet.has(i)
    const action  = isDupe ? (dupeAction[i] ?? batchAction) : 'insert'

    if (action === 'skip') {
      skipped++
      onProgress?.(i + 1, total, 'skipped')
      await _delay(10)
      continue
    }

    const payload = { ...row.data }
    if (hasVia)   payload._imported_via    = 'csv_canvas'
    if (hasBatch) payload._import_batch_id = batchId

    try {
      let result
      if (action === 'update') {
        result = await DBAdapter.upsertRows(tableName, [payload])
      } else {
        result = await DBAdapter.insertRows(tableName, [payload])
      }
      if (result.error) throw result.error
      imported++
      onProgress?.(i + 1, total, 'imported')
    } catch (err) {
      failed++
      failedRows.push({
        csvRowIndex: row.csvRowIndex,
        reasons: [err.message || String(err)],
        data: row.data,
      })
      onProgress?.(i + 1, total, 'failed')
    }

    await _delay(10)
  }

  // Write audit log
  try {
    await DBAdapter.logImport({
      entity_type:   tableName,
      table_name:    tableName,
      batch_id:      batchId,
      rows_total:    total,
      rows_imported: imported,
      rows_skipped:  skipped,
      rows_failed:   failed,
      column_mapping: columnMapping,
      imported_by:   'demo',
    })
  } catch (e) {
    console.warn('[Importer] Log write failed:', e)
  }

  return { imported, skipped, failed, failedRows, batchId }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function _uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function _delay(ms) { return new Promise(r => setTimeout(r, ms)) }

/**
 * Build column_mapping snapshot: { "CSV Header": "db_column" }
 */
function buildMappingSnapshot(mapping) {
  const out = {}
  for (const { csvHeader, colDef } of mapping) {
    if (colDef) out[csvHeader] = colDef.column_name
  }
  return out
}

/**
 * Build failed-rows CSV for download.
 */
function failedRowsToCSV(failedRows, csvHeaders, rawRows) {
  const headers = [...csvHeaders, '_errors']
  const rows    = failedRows.map(fr => {
    const orig = rawRows[fr.csvRowIndex] || []
    return [...orig, fr.reasons.join('; ')]
  })
  return rowsToCSV(headers, rows)
}
