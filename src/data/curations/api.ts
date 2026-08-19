import { CURATIONS_CONTRACT } from '@constants'
import type { Curation } from './types'

const TZKT_API = import.meta.env.VITE_TZKT_API
const MAX_PAGE_SIZE = 10000
const BASE = `${TZKT_API}/v1/contracts/${CURATIONS_CONTRACT}/bigmaps/curations/keys`

interface RawCurationValue {
  owner: string
  current_cid: string
  hidden: boolean
  version_count: string
}

type Row = { key: string; value: RawCurationValue }

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TzKT error: ${res.status}`)
  return res.json()
}

const toCuration = (key: string, v: RawCurationValue): Curation => ({
  id: Number(key),
  owner: v.owner,
  cid: v.current_cid,
  hidden: v.hidden,
})

export type CurationOrder = 'desc' | 'asc'
const sortParam = (order: CurationOrder) =>
  order === 'asc' ? 'sort.asc=id' : 'sort.desc=id'

/** Manage Curation Pages */
export async function fetchCurationsPage({
  offset = 0,
  limit = 24,
  order = 'desc',
}: { offset?: number; limit?: number; order?: CurationOrder } = {}): Promise<
  Curation[]
> {
  const rows = await getJson<Row[]>(
    `${BASE}?value.hidden=false&select=key,value&${sortParam(order)}&offset=${offset}&limit=${limit}`
  )
  return rows.map((r) => toCuration(r.key, r.value))
}

export async function fetchAllCurations(
  order: CurationOrder = 'desc'
): Promise<Curation[]> {
  const rows = await getJson<Row[]>(
    `${BASE}?value.hidden=false&select=key,value&${sortParam(order)}&limit=${MAX_PAGE_SIZE}`
  )
  return rows.map((r) => toCuration(r.key, r.value))
}

export async function fetchCuration(id: number): Promise<Curation | null> {
  const res = await fetch(`${BASE}/${id}`)
  if (res.status === 204 || res.status === 404) return null
  if (!res.ok) throw new Error(`Curation ${id}: HTTP ${res.status}`)
  const body = await res.json()
  const value: RawCurationValue | null = body?.value ?? body ?? null
  return value?.current_cid ? toCuration(String(id), value) : null
}

/**
 * Hidden ones are included only when `includeHidden` is set (the owner viewing their own profile).
 */
export async function fetchCurationsByOwner(
  address: string,
  includeHidden = false
): Promise<Curation[]> {
  const rows = await getJson<Row[]>(
    `${BASE}?value.owner=${address}${
      includeHidden ? '' : '&value.hidden=false'
    }&select=key,value&sort.desc=id&limit=${MAX_PAGE_SIZE}`
  )
  return rows.map((r) => toCuration(r.key, r.value))
}
