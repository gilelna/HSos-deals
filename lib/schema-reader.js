// lib/schema-reader.js — Column classification layer.
// Calls DBAdapter.getColumns() and enriches each column with a classification.
// No Supabase code here — DB-agnostic.

/**
 * @typedef {Object} ColumnDef
 * @property {string}       column_name
 * @property {string}       data_type
 * @property {string}       is_nullable     'YES' | 'NO'
 * @property {string|null}  column_default
 * @property {string}       classification  'system'|'fk'|'required'|'number'|'boolean'|'date'|'array'|'text'
 * @property {boolean}      required
 * @property {boolean}      skip            true = hidden from user (system columns)
 * @property {string|null}  resolverKey     same as column_name for FK columns
 */

/**
 * Fetch and classify all columns for a table.
 * @param {string} tableName
 * @returns {Promise<ColumnDef[]>}
 */
async function getTableSchema(tableName) {
  const raw = await DBAdapter.getColumns(tableName)
  return raw.map(classifyColumn)
}

/**
 * Classify a single raw column descriptor from information_schema.
 * @param {{ column_name, data_type, is_nullable, column_default }} col
 * @returns {ColumnDef}
 */
function classifyColumn(col) {
  const { column_name, data_type, is_nullable, column_default } = col
  const name = column_name.toLowerCase()

  // ── System: always skip ────────────────────────────────────────────────────
  if (name === 'id' || name.endsWith('_at') ||
      name === '_imported_via' || name === '_import_batch_id') {
    return { ...col, classification: 'system', required: false, skip: true, resolverKey: null }
  }

  // ── FK: ends with _id (but not exactly 'id'), or uuid type ────────────────
  const isFKByName = name.endsWith('_id')
  const isFKByType = (data_type === 'uuid') && name !== 'id'
  if (isFKByName || isFKByType) {
    const required = is_nullable === 'NO' && !column_default
    return { ...col, classification: 'fk', required, skip: false, resolverKey: column_name }
  }

  const required = is_nullable === 'NO' && !column_default

  // ── Numeric ────────────────────────────────────────────────────────────────
  const NUMERIC = new Set([
    'int2', 'int4', 'int8', 'integer', 'bigint', 'smallint',
    'numeric', 'decimal', 'float4', 'float8', 'real', 'double precision',
  ])
  if (NUMERIC.has(data_type)) {
    return { ...col, classification: 'number', required, skip: false, resolverKey: null }
  }

  // ── Boolean ────────────────────────────────────────────────────────────────
  if (data_type === 'boolean') {
    return { ...col, classification: 'boolean', required, skip: false, resolverKey: null }
  }

  // ── Date / Timestamp ───────────────────────────────────────────────────────
  const DATE_TYPES = new Set([
    'date', 'timestamp', 'timestamp without time zone',
    'timestamp with time zone', 'timestamptz',
  ])
  if (DATE_TYPES.has(data_type)) {
    return { ...col, classification: 'date', required, skip: false, resolverKey: null }
  }

  // ── Array ──────────────────────────────────────────────────────────────────
  if (data_type === 'ARRAY' || data_type.startsWith('_')) {
    return { ...col, classification: 'array', required, skip: false, resolverKey: null }
  }

  // ── Enum / USER-DEFINED — treat as text, flag as enum ─────────────────────
  if (data_type === 'USER-DEFINED') {
    return { ...col, classification: 'enum', required, skip: false, resolverKey: null }
  }

  // ── Text (default) ─────────────────────────────────────────────────────────
  return { ...col, classification: 'text', required, skip: false, resolverKey: null }
}

/**
 * Validate a raw string cell value against its column classification.
 * @param {string} value
 * @param {ColumnDef} colDef
 * @returns {string|null}  null if valid, error string if invalid
 */
function validateCell(value, colDef) {
  const isEmpty = value === '' || value == null

  if (colDef.required && isEmpty) {
    return `"${colDef.column_name}" is required`
  }
  if (isEmpty) return null

  switch (colDef.classification) {
    case 'number':
      if (isNaN(Number(value))) return `"${value}" is not a valid number for ${colDef.column_name}`
      break
    case 'boolean': {
      const l = String(value).toLowerCase()
      if (!['true', 'false', 'yes', 'no', '1', '0'].includes(l))
        return `"${value}" is not a valid boolean (use true/false/yes/no/1/0)`
      break
    }
    case 'date':
      if (isNaN(new Date(value).getTime()))
        return `"${value}" is not a valid date for ${colDef.column_name}`
      break
  }
  return null
}

/**
 * Coerce a raw string cell value to its JS type for DB insertion.
 */
function coerceCell(value, colDef) {
  if (value === '' || value == null) return null
  switch (colDef.classification) {
    case 'number':  return Number(value)
    case 'boolean': {
      const l = String(value).toLowerCase()
      return l === 'true' || l === 'yes' || l === '1'
    }
    case 'date':    return new Date(value).toISOString()
    case 'array':   return value.split(',').map(s => s.trim()).filter(Boolean)
    default:        return value
  }
}
