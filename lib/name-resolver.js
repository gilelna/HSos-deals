// lib/name-resolver.js — HSos-specific FK → UUID resolution registry.
// This is the ONLY file with HSos-domain knowledge about FK columns.

/**
 * Maps FK column names to their lookup tables and label fields.
 * Add a new entry here whenever a new FK column needs name resolution.
 */
const RESOLVERS = {
  vendor_id:          { table: 'vendors',   labelField: 'name' },
  client_id:          { table: 'clients',   labelField: 'name' },
  paying_company_id:  { table: 'companies', labelField: 'name' },
  company_id:         { table: 'companies', labelField: 'name' },
  deal_id:            { table: 'deals',     labelField: 'name' },
  account_id:         { table: 'accounts',  labelField: 'name' },
}

/**
 * In-memory lookup cache: { "table:labelField": Map<nameLower, uuid> }
 */
const _cache = {}

/**
 * Pre-load all resolver lookup tables needed for a given set of FK column names.
 * Call once after schema is fetched, before resolving any rows.
 *
 * @param {string[]} fkColumnNames  e.g. ['vendor_id', 'client_id']
 */
async function preloadResolvers(fkColumnNames) {
  const needed = fkColumnNames
    .map(c => RESOLVERS[c])
    .filter(Boolean)

  // Deduplicate by table+labelField
  const seen = new Set()
  const unique = needed.filter(r => {
    const key = `${r.table}:${r.labelField}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  await Promise.all(unique.map(async ({ table, labelField }) => {
    const key = `${table}:${labelField}`
    if (_cache[key]) return  // already loaded

    const rows = await DBAdapter.fetchLookup(table, ['id', labelField])
    const map  = new Map()
    for (const row of rows) {
      if (row[labelField]) map.set(String(row[labelField]).toLowerCase(), row.id)
    }
    _cache[key] = map
  }))
}

/**
 * Resolve a human-readable name to a UUID for a given FK column.
 *
 * @param {string} columnName  e.g. 'vendor_id'
 * @param {string} nameValue   e.g. 'John Smith'
 * @returns {{ id: string|null, error: string|null }}
 */
function resolveFK(columnName, nameValue) {
  const resolver = RESOLVERS[columnName]
  if (!resolver) {
    // No registered resolver — pass through as-is (warn at column-map step)
    return { id: nameValue, error: null }
  }

  const key = `${resolver.table}:${resolver.labelField}`
  const map = _cache[key]
  if (!map) return { id: null, error: `Lookup table not loaded for "${columnName}"` }

  const lower = String(nameValue).toLowerCase()
  const id    = map.get(lower)

  if (!id) {
    return {
      id: null,
      error: `"${nameValue}" not found in ${resolver.table}`,
    }
  }

  return { id, error: null }
}

/**
 * Return resolver config for a column name, or null if not registered.
 */
function getResolver(columnName) {
  return RESOLVERS[columnName] || null
}

/**
 * Clear the lookup cache (useful when changing DB environments).
 */
function clearResolverCache() {
  for (const k of Object.keys(_cache)) delete _cache[k]
}
