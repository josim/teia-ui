import { CURATIONS_CONTRACT, CURATIONS_OLD_CONTRACT } from '@constants'
import type { Curation, V1Curation } from './types'

const TZKT_API = import.meta.env.VITE_TZKT_API
const MAX_PAGE_SIZE = 10000
const BASE = `${TZKT_API}/v1/contracts/${CURATIONS_CONTRACT}/bigmaps/curations/keys`
const PUBLIC = 'value.hidden=false&value.moderated=false'
export const ADMIN_RECENT_LIMIT = 50

interface RawCurationValue {
  owner: string
  current_cid: string
  hidden: boolean
  moderated: boolean
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
  moderated: v.moderated,
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
    `${BASE}?${PUBLIC}&select=key,value&${sortParam(order)}&offset=${offset}&limit=${limit}`
  )
  return rows.map((r) => toCuration(r.key, r.value))
}

export async function fetchAllCurations(
  order: CurationOrder = 'desc'
): Promise<Curation[]> {
  const rows = await getJson<Row[]>(
    `${BASE}?${PUBLIC}&select=key,value&${sortParam(order)}&limit=${MAX_PAGE_SIZE}`
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
 * Hidden / moderated ones are included only when `includeHidden` is set (the
 * owner viewing their own profile).
 */
export async function fetchCurationsByOwner(
  address: string,
  includeHidden = false
): Promise<Curation[]> {
  const rows = await getJson<Row[]>(
    `${BASE}?value.owner=${address}${
      includeHidden ? '' : `&${PUBLIC}`
    }&select=key,value&sort.desc=id&limit=${MAX_PAGE_SIZE}`
  )
  return rows.map((r) => toCuration(r.key, r.value))
}

/** Moderation console: latest curations regardless of hidden/moderated. */
export async function fetchCurationsAdmin(): Promise<Curation[]> {
  const rows = await getJson<Row[]>(
    `${BASE}?select=key,value&sort.desc=id&limit=${ADMIN_RECENT_LIMIT}`
  )
  return rows.map((r) => toCuration(r.key, r.value))
}

// ---------------------------------------------------------------------------
// Curations Migration
// ---------------------------------------------------------------------------

/**
 * The owner's non-hidden curations on the v1 contract, with `migratedTo` set
 * when a the new version `curation_created` event by the same owner carries the same CID
 */
export async function fetchV1CurationsForMigration(
  address: string
): Promise<V1Curation[]> {
  const [rows, events] = await Promise.all([
    getJson<Row[]>(
      `${TZKT_API}/v1/contracts/${CURATIONS_OLD_CONTRACT}/bigmaps/curations/keys?value.owner=${address}&value.hidden=false&select=key,value&sort.asc=id&limit=${MAX_PAGE_SIZE}`
    ),
    getJson<{ payload: { cid: string; curation_id: string } }[]>(
      `${TZKT_API}/v1/contracts/events?contract=${CURATIONS_CONTRACT}&tag=curation_created&payload.owner=${address}&select=payload&limit=${MAX_PAGE_SIZE}`
    ),
  ])
  const migrated = new Map<string, number>()
  for (const e of events) {
    if (!migrated.has(e.payload.cid)) {
      migrated.set(e.payload.cid, Number(e.payload.curation_id))
    }
  }
  return rows.map((r) => ({
    id: Number(r.key),
    owner: r.value.owner,
    cid: r.value.current_cid,
    migratedTo: migrated.get(r.value.current_cid),
  }))
}
