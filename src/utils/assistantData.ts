import { TEZTOK_SCHEMA_DOC } from '@data/teztokSchemaDoc'

const QUERY_TIMEOUT_MS = 15000
const MAX_RESPONSE_BYTES = 2_000_000
export const MAX_QUERY_LIMIT = 500

export interface QueryResult {
  query: string
  rootField: string
  rows: Record<string, any>[]
}

/** Full result of the last executed query, for the table/export UI. */
let lastQueryResult: QueryResult | null = null
export const getLastQueryResult = () => lastQueryResult
export const clearLastQueryResult = () => {
  lastQueryResult = null
}

/** Table sections parsed from the curated schema doc (### name (root: ...)) */
const SCHEMA_SECTIONS: Record<string, string> = {}
for (const part of TEZTOK_SCHEMA_DOC.split(/^### /m).slice(1)) {
  const name = part.split(/[\s(]/)[0]
  if (name) SCHEMA_SECTIONS[name] = `### ${part.trim()}`
}
export const TEZTOK_TABLE_INDEX = Object.keys(SCHEMA_SECTIONS).join(', ')

export const getSchemaSlice = (table: string) => {
  const key = Object.keys(SCHEMA_SECTIONS).find(
    (k) => k.toLowerCase() === String(table).toLowerCase().trim()
  )
  if (!key)
    return `Unknown table "${table}". Available tables: ${TEZTOK_TABLE_INDEX}`
  return SCHEMA_SECTIONS[key]
}

const validateQuery = (query: string): string | null => {
  const q = query.trim()
  if (!q) return 'Empty query'
  if (/^\s*(mutation|subscription)\b/i.test(q) || /\bmutation\s*[{(]/i.test(q))
    return 'Only read queries are allowed'
  const limits = [...q.matchAll(/limit\s*:\s*(\d+)/g)].map((m) =>
    parseInt(m[1])
  )
  if (limits.length === 0)
    return `Query rejected: add a limit (max ${MAX_QUERY_LIMIT}) to the root field`
  if (limits.some((l) => l > MAX_QUERY_LIMIT))
    return `Query rejected: limit must be ${MAX_QUERY_LIMIT} or lower`
  return null
}

/**
 * Execute a model-authored GraphQL query against the TezTok endpoint. 
 * Read-only endpoint; we still validate (query-only, enforced
 * limit, timeout, response-size cap). Throws with a model-readable message on
 * any failure so the loop can feed it back for a retry.
 */
export async function runTeztokQuery(input: {
  query?: string
}): Promise<string> {
  const query = String(input?.query || '')
  const invalid = validateQuery(query)
  if (invalid) throw new Error(invalid)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS)
  let res
  try {
    res = await fetch(import.meta.env.VITE_TEIA_GRAPHQL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    })
  } catch (e: any) {
    throw new Error(
      e?.name === 'AbortError'
        ? 'Query timed out (15s) — add filters'
        : String(e?.message || e)
    )
  } finally {
    clearTimeout(timer)
  }

  const text = await res.text()
  if (text.length > MAX_RESPONSE_BYTES)
    throw new Error('Result too large — add filters or lower the limit')

  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Endpoint returned invalid JSON (status ${res.status})`)
  }
  if (json.errors?.length)
    throw new Error(
      `GraphQL error: ${json.errors
        .map((e: any) => e.message)
        .join('; ')
        .slice(0, 300)}`
    )

  const data = json.data || {}
  const rootField =
    Object.keys(data).find((k) => Array.isArray(data[k])) ||
    Object.keys(data)[0]
  const rows = Array.isArray(data[rootField]) ? data[rootField] : []
  lastQueryResult = { query, rootField, rows }

  return JSON.stringify(data)
}

/* ---------- export helpers for the results table ---------- */

const flatten = (
  row: Record<string, any>,
  prefix = ''
): Record<string, any> => {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(row)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key))
    } else {
      out[key] = Array.isArray(v) ? JSON.stringify(v) : v
    }
  }
  return out
}

export const toFlatRows = (rows: Record<string, any>[]) =>
  rows.map((r) => flatten(r))

export const toCsv = (rows: Record<string, any>[]): string => {
  if (!rows.length) return ''
  const flat = toFlatRows(rows)
  const cols = [...new Set(flat.flatMap((r) => Object.keys(r)))]
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [
    cols.join(','),
    ...flat.map((r) => cols.map((c) => esc(r[c])).join(',')),
  ].join('\n')
}

export const downloadFile = (name: string, mime: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
