// adapters/supabase-adapter.js — ALL Supabase-specific code lives here.
// Everything else in the importer calls DBAdapter methods only.
// Uses the _sb client already created in db.js.

// Tables to hide from the entity dropdown
const _EXCLUDED_TABLES = new Set([
  'import_logs',
  'schema_migrations',
  'spatial_ref_sys',
])

const DBAdapter = {

  /**
   * Fetch all public user-facing table names from information_schema.
   * @returns {Promise<string[]>}
   */
  async getTables() {
    const { data, error } = await _sb.rpc('get_public_tables')
    if (error) throw new Error(`Could not load tables: ${error.message}`)
    return (data || [])
      .map(r => r.table_name)
      .filter(n => !_EXCLUDED_TABLES.has(n))
  },

  /**
   * Fetch raw column metadata for a table via RPC.
   * @param {string} tableName
   * @returns {Promise<Array<{column_name, data_type, is_nullable, column_default}>>}
   */
  async getColumns(tableName) {
    const { data, error } = await _sb.rpc('get_table_columns', { p_table: tableName })
    if (error) throw new Error(`Could not load schema for "${tableName}": ${error.message}`)
    return data || []
  },

  /**
   * Fetch id + labelField rows from a lookup table (for FK resolution).
   * @param {string} tableName
   * @param {string} labelField  defaults to 'name'
   * @returns {Promise<Array<{id: string, [label]: string}>>}
   */
  async fetchLookup(tableName, labelField = 'name') {
    const { data, error } = await _sb
      .from(tableName)
      .select(`id, ${labelField}`)
      .order(labelField)

    if (error) throw new Error(`Lookup failed for "${tableName}": ${error.message}`)
    return data || []
  },

  /**
   * Check which rows already exist in DB based on dedupeKeys.
   * Returns Set of processedRows indices (0-based) that are duplicates.
   * @param {string}   tableName
   * @param {Object[]} rows        array of plain objects
   * @param {string[]} dedupeKeys
   * @returns {Promise<Set<number>>}
   */
  async checkDuplicates(tableName, rows, dedupeKeys) {
    const dupes = new Set()
    if (!dedupeKeys || dedupeKeys.length === 0) return dupes

    await Promise.all(rows.map(async (row, i) => {
      // Skip rows that are missing all dedupeKey values
      const hasAny = dedupeKeys.some(k => row[k] != null && row[k] !== '')
      if (!hasAny) return

      let query = _sb.from(tableName).select('id')
      for (const key of dedupeKeys) {
        if (row[key] != null && row[key] !== '') {
          query = query.eq(key, row[key])
        }
      }

      const { data, error } = await query.limit(1)
      if (!error && data && data.length > 0) dupes.add(i)
    }))

    return dupes
  },

  /**
   * Insert rows (no conflict handling).
   * @param {string}   tableName
   * @param {Object[]} rows
   */
  async insertRows(tableName, rows) {
    return _sb.from(tableName).insert(rows)
  },

  /**
   * Upsert rows (update on conflict).
   * @param {string}   tableName
   * @param {Object[]} rows
   * @param {string}   conflictColumn  defaults to 'id'
   */
  async upsertRows(tableName, rows, conflictColumn = 'id') {
    return _sb.from(tableName).upsert(rows, { onConflict: conflictColumn })
  },

  /**
   * Write an entry to import_logs.
   * @param {Object} entry
   */
  async logImport(entry) {
    const { error } = await _sb.from('import_logs').insert(entry)
    if (error) console.warn('[ImportLog] Failed to write import log:', error.message)
  },

  /**
   * Fetch recent import log entries (newest first).
   * @param {number} limit  default 10
   * @returns {Promise<Object[]>}
   */
  async getRecentImports(limit = 10) {
    const { data, error } = await _sb
      .from('import_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('[ImportLog] Could not load recent imports:', error.message)
      return []
    }
    return data || []
  },
}
