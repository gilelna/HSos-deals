/**
 * HSos Bank Statement Import Script
 * ==================================
 * Reads templates from /imports/templates/*.json
 * Finds matching statement files in /imports/statements/
 * Parses each file according to its template rules
 * Inserts normalized rows into Supabase `transactions` table
 * Writes an audit log to /imports/logs/import_YYYY-MM-DD.json
 *
 * Usage:
 *   node imports/import.js                              — import all accounts
 *   node imports/import.js --account acc_wise_usd      — single account
 *   node imports/import.js --dry-run                   — parse only, no insert
 *
 * Dependencies: @supabase/supabase-js, xlsx, csv-parse
 * Install: cd imports && npm install
 */

'use strict'

const fs   = require('fs')
const path = require('path')
const { parse: csvParse } = require('csv-parse/sync')
const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')

// ─── Configuration ───────────────────────────────────────────────────────────

// Target environment: set HSOS_ENV=production to insert into production DB
// Default is demo DB (safe for testing)
const ENV = process.env.HSOS_ENV || 'demo'

const SUPABASE_CONFIGS = {
  demo: {
    url:     'https://pqkzffgpkpovternesmt.supabase.co',
    // Use service role key from environment variable, fall back to anon key
    // Set SUPABASE_SERVICE_ROLE_KEY in your shell for dedup queries to work without RLS
    key: process.env.SUPABASE_SERVICE_ROLE_KEY_DEMO
      || process.env.SUPABASE_SERVICE_ROLE_KEY
      || 'sb_publishable_aYfTv_dPUhz76X8wp1u0_Q_By9ab8Si',
  },
  production: {
    url:     'https://wmqmonjnmgtoilxfqqkv.supabase.co',
    key: process.env.SUPABASE_SERVICE_ROLE_KEY_PROD
      || process.env.SUPABASE_SERVICE_ROLE_KEY
      || 'sb_publishable_ujPTzw0beGD6fJ-V2PfNwg_mHgsoify',
  },
}

const config     = SUPABASE_CONFIGS[ENV]
const supabase   = createClient(config.url, config.key)

const ROOT_DIR       = path.resolve(__dirname, '..')
const TEMPLATES_DIR  = path.join(__dirname, 'templates')
const STATEMENTS_DIR = path.join(__dirname, 'statements')
const LOGS_DIR       = path.join(__dirname, 'logs')

const BATCH_SIZE = 50

// ─── CLI flags ────────────────────────────────────────────────────────────────

const args         = process.argv.slice(2)
const DRY_RUN      = args.includes('--dry-run')
const accountIdx   = args.indexOf('--account')
const ONLY_ACCOUNT = accountIdx !== -1 ? args[accountIdx + 1] : null

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse a date string to YYYY-MM-DD using the format hint from the template.
 * Handles: DD/MM/YYYY, DD/MM/YY, MM/DD/YYYY, YYYY-MM-DD, YYYY-MM-DD HH:mm:ss
 */
function parseDate(raw, fmt) {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)

  if (fmt === 'DD/MM/YYYY' || fmt === 'DD/MM/YY') {
    const [d, m, y] = s.split('/')
    if (!d || !m || !y) return null
    const year = y.length === 2 ? (parseInt(y) < 50 ? '20' + y : '19' + y) : y
    return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  if (fmt === 'MM/DD/YYYY') {
    const [m, d, y] = s.split('/')
    if (!d || !m || !y) return null
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  if (fmt === 'YYYY-MM-DD HH:mm:ss') {
    return s.substring(0, 10)
  }

  return null
}

/**
 * Parse a numeric amount, handling European comma-decimal format.
 * Always returns a positive number (direction carries the sign).
 */
function parseAmount(raw, decimalSep) {
  if (raw === null || raw === undefined || raw === '') return null
  let s = String(raw).trim().replace(/[^\d.,-]/g, '')
  if (decimalSep === 'comma') {
    // European: 1.234,56 → remove dots, replace comma with dot
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    // Standard: remove commas used as thousand separators
    s = s.replace(/,/g, '')
  }
  const n = parseFloat(s)
  return isNaN(n) ? null : Math.abs(n)
}

/**
 * Determine direction ('in' or 'out') based on the template logic.
 * rawValue = the raw cell value (may be the amount itself, or a direction column value)
 * originalRaw = the original un-abs'd amount (for sign detection)
 */
function resolveDirection(tmpl, row, originalRaw) {
  const logic = tmpl.direction_logic

  if (logic === 'column:Direction' || (logic && logic.startsWith('column:'))) {
    const col = tmpl.direction_column || logic.replace('column:', '')
    const val = String(row[col] || '').trim().toUpperCase()
    if (tmpl.direction_map) {
      const mapped = tmpl.direction_map[val] || tmpl.direction_map[row[col]]
      if (mapped === 'internal') return 'out' // neutrals treated as out (transfer)
      return mapped || 'out'
    }
    return val === 'IN' ? 'in' : val === 'OUT' ? 'out' : 'out'
  }

  if (logic === 'column:Balance Impact') {
    const val = String(row['Balance Impact'] || '').trim()
    if (tmpl.direction_map) return tmpl.direction_map[val] || 'out'
    return val === 'Credit' ? 'in' : 'out'
  }

  // Sign-based logic
  const n = parseFloat(String(originalRaw || '').replace(/,/g, '').replace(/[^\d.-]/g, ''))

  if (logic === 'negative=out,positive=in') return n < 0 ? 'out' : 'in'
  if (logic === 'negative=in,positive=out') return n < 0 ? 'in' : 'out'

  return 'out'
}

/**
 * Detect the original sign of an amount for direction logic.
 * Returns the raw string value from the amount column before abs().
 */
function getRawAmountString(row, amountCol) {
  return String(row[amountCol] || '').trim()
}

/**
 * Resolve a column value, supporting "fixed:VALUE" syntax for constant currencies.
 */
function resolveColumn(row, colSpec) {
  if (!colSpec) return null
  if (colSpec.startsWith('fixed:')) return colSpec.replace('fixed:', '')
  return row[colSpec] !== undefined ? String(row[colSpec] || '').trim() : null
}

/**
 * Check if a row should be skipped based on the template's filter rules.
 */
function shouldSkipRow(tmpl, row) {
  const cols = tmpl.columns

  // Must have a valid amount
  const requireCol = tmpl.filters?.require_column
  if (requireCol && (row[requireCol] === undefined || row[requireCol] === null || row[requireCol] === '')) {
    return true
  }

  // Status filter
  const statusCol = tmpl.filters?.status_column
  const validStatuses = tmpl.filters?.valid_status_values
  if (statusCol && validStatuses) {
    const rowStatus = String(row[statusCol] || '').trim()
    if (!validStatuses.includes(rowStatus)) return true
  }

  // Exclude if contains
  const excludes = tmpl.filters?.exclude_if_contains
  if (excludes) {
    for (const [col, values] of Object.entries(excludes)) {
      const cellVal = String(row[col] || '')
      for (const v of values) {
        if (cellVal.includes(v)) return true
      }
    }
  }

  return false
}

/**
 * Determine event_type from a row using the template's event_type_map (if any).
 */
function resolveEventType(tmpl, row, direction) {
  // PayPal-style type map
  if (tmpl.event_type_map) {
    const typeVal = String(row['Type'] || row[tmpl.columns?.category_hint] || '').trim()
    const mapped = tmpl.event_type_map[typeVal]
    if (mapped && mapped !== 'skip') return mapped
  }

  // Mizrahi bank type map
  if (tmpl.event_type_map) {
    const typeCol = tmpl.columns?.entity_hint
    if (typeCol) {
      const typeVal = String(row[typeCol] || '').trim()
      for (const [key, val] of Object.entries(tmpl.event_type_map)) {
        if (typeVal.includes(key)) return val
      }
    }
  }

  // NEUTRAL Wise rows
  if (row['Direction'] === 'NEUTRAL') return 'transfer_internal'

  // Default by direction
  return direction === 'in' ? 'income_customer' : 'expense_vendor'
}

/**
 * Check if a row is an internal transfer based on the template rule.
 * For Wise: source name == target name (both "Hadar Shemesh ...")
 */
function isInternalTransfer(tmpl, row) {
  if (!tmpl.internal_transfer_rule?.condition) return false

  // Wise rule: both names contain 'Hadar Shemesh' or 'Hadar-Shemesh'
  if (tmpl.account_id.startsWith('acc_wise')) {
    const srcName = String(row['Source name'] || '').toLowerCase()
    const tgtName = String(row['Target name'] || '').toLowerCase()
    if (srcName.includes('hadar') && tgtName.includes('hadar')) return true
    if (row['Direction'] === 'NEUTRAL') return true
  }

  // Mizrahi rule: type matches visa/mastercard payment
  if (tmpl.account_id === 'acc_mizrachi_il') {
    const type = String(row['type'] || '').trim()
    if (/ויזה מקס|מסטרקרד ביזנס/u.test(type)) return true
  }

  return false
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

/**
 * Parse a CSV file into an array of row objects.
 */
function parseCsvFile(filePath) {
  const raw = fs.readFileSync(filePath)
  return csvParse(raw, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    trim: true,
  })
}

/**
 * Parse an XLSX file, returning rows from the specified sheet.
 * Handles multi-section sheets by dynamically detecting header rows.
 * Returns: Array of { _section, _card_type, ...columns }
 */
function parseXlsxFile(filePath, tmpl) {
  const wb    = XLSX.readFile(filePath)
  const sheet = wb.Sheets[tmpl.sheet]

  if (!sheet) {
    console.warn(`  ⚠ Sheet "${tmpl.sheet}" not found in ${path.basename(filePath)}`)
    console.warn(`    Available sheets: ${wb.SheetNames.join(', ')}`)
    return []
  }

  // Convert sheet to array-of-arrays (raw)
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
  const rows = []

  let headers      = null
  let currentCard  = null
  const headerKey  = tmpl.header_detection   // e.g. 'תאריך עסקה'
  const sectionRx  = tmpl.section_filter ? new RegExp(tmpl.section_filter, 'u') : null

  for (const row of raw) {
    // Detect card/section label rows:
    // These are rows where the first cell contains the card description
    // (e.g. "חשבון כרטיס: 140009  שם כרטיס: ויזה מקס זהב עסקי  ...")
    // The row may have null trailing cells but the first cell is the identifier.
    const firstCell = row[0] !== null && row[0] !== undefined ? String(row[0]).trim() : null
    const nonNull   = row.filter(c => c !== null && c !== '')

    if (firstCell && nonNull.length <= 2 && sectionRx) {
      if (sectionRx.test(firstCell)) {
        currentCard = firstCell
        headers = null  // reset headers — they follow after blank row
      } else if (/חשבון כרטיס|שם כרטיס/u.test(firstCell)) {
        // Another card section that doesn't match our filter — stop collecting
        headers = null
        currentCard = null
      }
      continue
    }

    // Skip blank rows
    if (!nonNull.length) continue

    // Detect header row
    if (row.some(c => c !== null && String(c).trim() === headerKey)) {
      headers = row.map(c => (c !== null ? String(c).trim() : null))
      continue
    }

    // Skip rows before first valid header or outside matching section
    if (!headers || !currentCard) continue

    // Build object from headers
    const obj = {}
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i] !== undefined ? row[i] : null
    })
    obj._card_type = currentCard

    rows.push(obj)
  }

  return rows
}

// ─── Row normalizer ───────────────────────────────────────────────────────────

/**
 * Convert a raw parsed row into a normalized transaction object ready for insert.
 * Returns null if the row should be skipped.
 */
function normalizeRow(tmpl, row) {
  // Apply skip filters
  if (shouldSkipRow(tmpl, row)) return null

  // Skip PayPal holds/reversals by type
  if (tmpl.hold_reversal_rule) {
    const rowType = String(row['Type'] || '').trim()
    if (tmpl.hold_reversal_rule.skip_types.includes(rowType)) return null
  }

  const cols = tmpl.columns

  // Dates
  const transaction_date = parseDate(resolveColumn(row, cols.date), tmpl.date_format)
  const settled_date     = cols.settled_date
    ? parseDate(resolveColumn(row, cols.settled_date), tmpl.date_format)
    : null

  // Reject dates that contain non-date text (e.g. Mizrahi opening balance row)
  const rawDate = String(resolveColumn(row, cols.date) || '')
  if (rawDate && !/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$|^\d{4}-\d{2}-\d{2}/.test(rawDate)) return null
  if (!transaction_date) return null  // date is required

  // Amount — get raw string first for direction detection
  const rawAmountStr = getRawAmountString(row, cols.amount)
  const amount       = parseAmount(rawAmountStr, tmpl.decimal_separator)

  if (amount === null || amount === 0) return null  // amount is required

  // Direction
  const direction = resolveDirection(tmpl, row, rawAmountStr)

  // Currency
  const currency = resolveColumn(row, cols.currency) || 'USD'

  // Vendor / counterparty
  let counterparty_name = resolveColumn(row, cols.vendor)
  // Wise: fallback from Target name to Source name
  if (!counterparty_name && tmpl.account_id.startsWith('acc_wise')) {
    counterparty_name = resolveColumn(row, 'Source name')
  }
  // Mizrahi: fallback to description
  if (!counterparty_name && tmpl.account_id === 'acc_mizrachi_il') {
    counterparty_name = resolveColumn(row, cols.description)
  }

  // Reference / description
  const reference = resolveColumn(row, cols.description)

  // Original amount/currency (FX)
  const amount_original   = cols.amount_original ? parseAmount(resolveColumn(row, cols.amount_original), tmpl.decimal_separator) : null
  const currency_original = cols.currency_original ? resolveColumn(row, cols.currency_original) : null
  const exchange_rate_raw = cols.exchange_rate ? resolveColumn(row, cols.exchange_rate) : null
  const exchange_rate     = exchange_rate_raw ? parseFloat(exchange_rate_raw) || null : null

  // Event type
  const isInternal = isInternalTransfer(tmpl, row)
  let event_type = isInternal
    ? 'transfer_internal'
    : resolveEventType(tmpl, row, direction)

  // External ID (PayPal Transaction ID, Wise transfer ID, Brex expense ID)
  let external_id = null
  if (tmpl.account_id === 'acc_paypal_il')            external_id = row['Transaction ID'] || null
  else if (tmpl.account_id.startsWith('acc_wise'))    external_id = row['ID'] || null
  else if (tmpl.account_id.startsWith('acc_brex'))    external_id = row['Expense ID'] || null

  if (external_id) external_id = String(external_id).trim()

  // Source label for the source column
  const sourceMap = {
    acc_mizrachi_il:  'bank',
    acc_wise_usd:     'wise',
    acc_wise_eur:     'wise',
    acc_paypal_il:    'manual',   // 'paypal' not in enum — use manual
    acc_brex_us_6004: 'manual',
    acc_brex_us_2119: 'manual',
    acc_brex_us_1706: 'manual',
    acc_visa_max_ils: 'bank',
    acc_visa_max_usd: 'bank',
  }

  return {
    account_id:         tmpl.account_id,
    source:             sourceMap[tmpl.account_id] || 'manual',
    direction,
    external_id,
    status:             'unmatched',
    amount,
    currency,
    amount_original:    (amount_original && currency_original && currency_original !== currency)
                          ? amount_original : null,
    currency_original:  (amount_original && currency_original && currency_original !== currency)
                          ? currency_original : null,
    exchange_rate:      exchange_rate || null,
    counterparty_name:  counterparty_name || null,
    reference:          reference || null,
    event_type,
    transaction_date,
    settled_date,
    raw_data:           { ...row },
    created_at:         new Date().toISOString(),
  }
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Given an array of normalized rows for one account, fetch existing
 * (account_id, transaction_date, amount, counterparty_name) combos from DB
 * and return only the rows that don't already exist.
 * Returns { toInsert, skippedCount }
 */
async function deduplicateRows(rows) {
  if (!rows.length) return { toInsert: [], skippedCount: 0 }

  // Collect unique keys to check
  const keys = rows.map(r => ({
    account_id:       r.account_id,
    transaction_date: r.transaction_date,
    amount:           r.amount,
    counterparty_name: r.counterparty_name || '',
  }))

  // Query existing rows matching any of these account+date+amount combos
  // (checking all 4 fields in JS after fetching by account+date range is simpler and safe for our volumes)
  const accountId  = rows[0].account_id
  const dates      = [...new Set(rows.map(r => r.transaction_date))]

  const { data: existing, error } = await supabase
    .from('transactions')
    .select('account_id, transaction_date, amount, counterparty_name')
    .eq('account_id', accountId)
    .in('transaction_date', dates)

  if (error) {
    console.warn(`  ⚠ Dedup query failed: ${error.message} — inserting all rows`)
    return { toInsert: rows, skippedCount: 0 }
  }

  // Build a Set of "account|date|amount|counterparty" keys from existing
  const existingSet = new Set(
    (existing || []).map(e =>
      `${e.account_id}|${e.transaction_date}|${e.amount}|${(e.counterparty_name || '')}`
    )
  )

  let skippedCount = 0
  const toInsert = rows.filter(r => {
    const key = `${r.account_id}|${r.transaction_date}|${r.amount}|${(r.counterparty_name || '')}`
    if (existingSet.has(key)) {
      skippedCount++
      return false
    }
    return true
  })

  return { toInsert, skippedCount }
}

// ─── Insert ───────────────────────────────────────────────────────────────────

// Whether the transactions table has account_id column (detected on first insert attempt)
let _hasAccountIdColumn = null

/**
 * Insert rows into transactions table in batches of BATCH_SIZE.
 * Uses upsert with onConflict to avoid duplicates at DB level.
 * If account_id column doesn't exist yet (migration pending), stores it in raw_data only.
 * Returns { inserted, errors }
 */
async function insertRows(rows) {
  let inserted = 0
  let errors   = 0

  // Build DB rows — include account_id if column exists
  function buildDbRow(r, withAccountId) {
    const row = {
      source:           r.source,
      direction:        r.direction,
      external_id:      r.external_id,
      status:           r.status,
      amount:           r.amount,
      currency:         r.currency,
      exchange_rate:    r.exchange_rate,
      counterparty_name: r.counterparty_name,
      reference:        r.reference,
      event_type:       r.event_type,
      transaction_date: r.transaction_date,
      settled_date:     r.settled_date,
      // Always include account_id in raw_data so it can be backfilled later
      raw_data:         { ...r.raw_data, _account_id: r.account_id },
      created_at:       r.created_at,
    }
    if (withAccountId) row.account_id = r.account_id
    return row
  }

  // Detect account_id column on first run
  if (_hasAccountIdColumn === null) {
    const { error: probeErr } = await supabase
      .from('transactions')
      .select('account_id')
      .limit(1)
    _hasAccountIdColumn = !probeErr || !probeErr.message.includes('account_id')
    if (!_hasAccountIdColumn) {
      console.warn(`  ⚠ account_id column missing on this DB — inserting without it.`)
      console.warn(`    Run migrations/007_transactions_account_id.sql on demo DB, then re-run import.`)
    }
  }

  const withAccountId = _hasAccountIdColumn

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map(r => buildDbRow(r, withAccountId))
    // Use plain insert — deduplication is handled in JS before this point
    const { error } = await supabase
      .from('transactions')
      .insert(batch)

    if (error) {
      console.error(`  ✗ Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${error.message}`)
      errors += batch.length
    } else {
      inserted += batch.length
    }
  }

  return { inserted, errors }
}

// ─── File finder ─────────────────────────────────────────────────────────────

/**
 * Find the statement file(s) for a given template.
 * Brex/Wise/PayPal: single file shared across multiple accounts.
 * Mizrahi: single CSV.
 * Visa Max: multiple XLSX files (jan/feb/mar).
 * Returns array of file paths.
 */
function findStatementFiles(tmpl) {
  const files = fs.readdirSync(STATEMENTS_DIR)
  const found = []

  const patterns = {
    acc_mizrachi_il:  f => f.toLowerCase().includes('mizrahi') && f.endsWith('.csv'),
    acc_wise_usd:     f => f.toLowerCase().includes('wise') && f.endsWith('.csv'),
    acc_wise_eur:     f => f.toLowerCase().includes('wise') && f.endsWith('.csv'),
    acc_paypal_il:    f => f.toLowerCase().includes('paypal') && (f.endsWith('.csv') || f.endsWith('.CSV')),
    acc_brex_us_6004: f => f.toLowerCase().includes('brex') && f.endsWith('.csv'),
    acc_brex_us_2119: f => f.toLowerCase().includes('brex') && f.endsWith('.csv'),
    acc_brex_us_1706: f => f.toLowerCase().includes('brex') && f.endsWith('.csv'),
    acc_visa_max_ils: f => f.includes('כל הכרטיסים') && f.endsWith('.xlsx'),
    acc_visa_max_usd: f => f.includes('כל הכרטיסים') && f.endsWith('.xlsx'),
  }

  const matcher = patterns[tmpl.account_id]
  if (!matcher) return []

  for (const f of files) {
    if (matcher(f)) found.push(path.join(STATEMENTS_DIR, f))
  }

  return found.sort()
}

// ─── Main account processor ───────────────────────────────────────────────────

/**
 * Process one template: find file(s), parse, deduplicate, insert.
 * Returns an audit record: { account_id, file, parsed, skipped, inserted, errors }
 */
async function processAccount(tmpl) {
  const result = {
    account_id: tmpl.account_id,
    files:      [],
    parsed:     0,
    skipped:    0,
    inserted:   0,
    errors:     0,
  }

  const files = findStatementFiles(tmpl)
  if (!files.length) {
    console.log(`  ⚠ No statement file found for ${tmpl.account_id}`)
    return result
  }

  result.files = files.map(f => path.basename(f))
  let allNormalized = []

  for (const filePath of files) {
    console.log(`  → Parsing ${path.basename(filePath)} ...`)
    let rawRows = []

    try {
      if (tmpl.file_type === 'xlsx') {
        rawRows = parseXlsxFile(filePath, tmpl)
      } else {
        rawRows = parseCsvFile(filePath)
      }
    } catch (err) {
      console.error(`  ✗ Parse error: ${err.message}`)
      result.errors++
      continue
    }

    // For multi-account files (Brex, Wise), filter to this account's rows
    if (tmpl.row_filter) {
      rawRows = rawRows.filter(r => {
        const val = String(r[tmpl.row_filter.column] || '').trim()
        return val === tmpl.row_filter.value
      })
    }

    console.log(`    Raw rows after filter: ${rawRows.length}`)

    // Normalize each row
    for (const raw of rawRows) {
      const normalized = normalizeRow(tmpl, raw)
      if (normalized) allNormalized.push(normalized)
    }
  }

  result.parsed = allNormalized.length
  console.log(`  ✓ Normalized: ${allNormalized.length} rows`)

  if (!allNormalized.length) return result

  // Deduplication
  const { toInsert, skippedCount } = await deduplicateRows(allNormalized)
  result.skipped = skippedCount
  console.log(`  ✓ After dedup: ${toInsert.length} to insert, ${skippedCount} skipped`)

  if (DRY_RUN) {
    console.log(`  ℹ DRY RUN — no insert performed`)
    result.inserted = 0
    return result
  }

  if (!toInsert.length) return result

  // Insert
  const { inserted, errors } = await insertRows(toInsert)
  result.inserted = inserted
  result.errors  += errors
  console.log(`  ✓ Inserted: ${inserted} | Errors: ${errors}`)

  return result
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n━━━ HSos Import ━━━`)
  console.log(`ENV: ${ENV} | Dry run: ${DRY_RUN} | Account filter: ${ONLY_ACCOUNT || 'all'}\n`)

  // Load all templates
  const templateFiles = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'))
  let templates = templateFiles.map(f => {
    const tmpl = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, f), 'utf8'))
    return tmpl
  })

  // Apply account filter if --account flag used
  if (ONLY_ACCOUNT) {
    templates = templates.filter(t => t.account_id === ONLY_ACCOUNT)
    if (!templates.length) {
      console.error(`✗ No template found for account: ${ONLY_ACCOUNT}`)
      process.exit(1)
    }
  }

  const runAt  = new Date().toISOString()
  const results = []
  let totalInserted = 0

  for (const tmpl of templates) {
    console.log(`\n▶ ${tmpl.account_id} (${tmpl.source_label})`)
    const result = await processAccount(tmpl)
    results.push(result)
    totalInserted += result.inserted

    // Per-account summary line
    console.log(
      `  Summary — parsed: ${result.parsed} | skipped: ${result.skipped} ` +
      `| inserted: ${result.inserted} | errors: ${result.errors}`
    )
  }

  // ─── Write import log ──────────────────────────────────────────────────────
  const today   = runAt.substring(0, 10)
  const logPath = path.join(LOGS_DIR, `import_${today}.json`)
  const logData = { run_at: runAt, dry_run: DRY_RUN, env: ENV, accounts: results }

  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true })
  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2))
  console.log(`\n✓ Log written: ${logPath}`)

  // ─── Insert transaction_imports records ────────────────────────────────────
  if (!DRY_RUN) {
    for (const r of results) {
      if (!r.parsed) continue
      const { error } = await supabase.from('transaction_imports').insert({
        account_id:    r.account_id,
        provider:      r.account_id.split('_').slice(1).join('_'),
        source_type:   'csv_import',
        raw_rows:      r.parsed + r.skipped,
        imported_rows: r.inserted,
        skipped_rows:  r.skipped,
        failed_rows:   r.errors,
        imported_at:   runAt,
        notes:         `Files: ${r.files.join(', ')}`,
      })
      if (error) console.warn(`  ⚠ transaction_imports insert failed for ${r.account_id}: ${error.message}`)
    }
  }

  // ─── Final summary ─────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Total rows inserted: ${totalInserted}`)
  console.log(`Templates written:   ${fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json')).length}`)
  console.log(`import.js:           ✓`)
  console.log(`Log:                 ${logPath}`)
  console.log(`${'─'.repeat(50)}\n`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
