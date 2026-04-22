// lib/csv-parser.js — Delimiter-auto-detecting parser.
// Supports: tab-separated (spreadsheet paste), comma-separated (CSV files).
// No external dependencies.

/**
 * Detect the delimiter used in the text.
 * Tabs win if the first non-empty line contains any tab character —
 * that's the universal signal for a spreadsheet paste.
 * Falls back to comma.
 *
 * @param {string} text
 * @returns {',' | '\t'}
 */
function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find(l => l.trim() !== '') || ''
  return firstLine.includes('\t') ? '\t' : ','
}

/**
 * Parse delimited text into { headers, rows, delimiter }.
 * Handles: quoted fields with delimiters/newlines inside, empty fields,
 * whitespace trimming per cell, fully-empty rows skipped.
 *
 * @param {string} text
 * @returns {{ headers: string[], rows: string[][], delimiter: string }}
 */
function parseCSV(text) {
  const delimiter = detectDelimiter(text)
  const allRows   = _tokenise(text, delimiter)
  const nonEmpty  = allRows.filter(row => row.some(cell => cell.trim() !== ''))

  if (nonEmpty.length === 0) return { headers: [], rows: [], delimiter }

  const headers = nonEmpty[0].map(h => h.trim())
  const rows    = nonEmpty.slice(1).map(row => {
    const padded = [...row]
    while (padded.length < headers.length) padded.push('')
    return padded.map(c => c.trim())
  })

  return { headers, rows, delimiter }
}

/**
 * Low-level tokeniser. Handles quoted fields containing the delimiter or newlines.
 *
 * @param {string} text
 * @param {string} delim  single character delimiter
 * @returns {string[][]}
 */
function _tokenise(text, delim) {
  const result = []
  let row  = []
  let cell = ''
  let inQ  = false
  let i    = 0

  while (i < text.length) {
    const ch   = text[i]
    const next = text[i + 1]

    if (inQ) {
      if (ch === '"' && next === '"') { cell += '"'; i += 2; continue }
      if (ch === '"')                 { inQ = false; i++;    continue }
      cell += ch; i++; continue
    }

    if (ch === '"') { inQ = true; i++; continue }

    if (ch === delim) {
      row.push(cell); cell = ''; i++; continue
    }

    if (ch === '\r' && next === '\n') {
      row.push(cell); result.push(row); row = []; cell = ''; i += 2; continue
    }

    if (ch === '\n' || ch === '\r') {
      row.push(cell); result.push(row); row = []; cell = ''; i++; continue
    }

    cell += ch; i++
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell)
    result.push(row)
  }

  return result
}

/**
 * Convert rows back to CSV (used for failed-row download).
 *
 * @param {string[]}   headers
 * @param {string[][]} rows
 * @returns {string}
 */
function rowsToCSV(headers, rows) {
  const escape = v => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"'
      : s
  }
  return [headers, ...rows].map(row => row.map(escape).join(',')).join('\n')
}
