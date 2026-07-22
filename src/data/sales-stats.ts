/**
 * Public sales stats (primary vs secondary market) for the DAO Stats page.
 * Pulls SALE events on the HEN FA2 contract from teztok's GraphQL endpoint.
 *
 */
import { useRef } from 'react'
import useSWR from 'swr'
import { gql, request } from 'graphql-request'
import { HEN_CONTRACT_FA2 } from '@constants'
import { fetchAll } from './teztok-paginate'
import { weekStartISO } from './messaging/stats'

const PAGE_SIZE = 10000
const DAYS_BACK = 365
export const MAX_ROWS = 100_000 // soft cap: auto-load threshold for custom ranges
export const HARD_CAP = 500_000 // hard cap: ceiling even with explicit user consent

// Strict total order for keyset paging: level+opid is the on-chain ordering,
// the unique `id` breaks ties within an operation.
const SALES_CURSOR = ['level', 'opid', 'id']

export interface SaleEvent {
  id: string
  level: number
  opid: number
  timestamp: string
  price: string | number | null
  seller_address: string | null
  type: string | null
  token: { artist_address: string | null } | null
}

export interface SalesWeek {
  week: string
  primaryVolume: number
  secondaryVolume: number
  primaryCount: number
  secondaryCount: number
}

export interface SalesStats {
  weekly: SalesWeek[]
  totalCount: number
  totalVolume: number
  primaryCount: number
  primaryVolume: number
  secondaryCount: number
  secondaryVolume: number
}

export type Marketplace = 'all' | 'teia' | 'objkt'

export type SalesRangeResult = { events: SaleEvent[] } | { tooMany: number }

const SALES_QUERY = gql`
  query Sales($where: events_bool_exp!, $limit: Int!) {
    events(
      where: $where
      order_by: [{ level: asc }, { opid: asc }, { id: asc }]
      limit: $limit
    ) {
      id
      level
      opid
      timestamp
      price
      seller_address
      type
      token {
        artist_address
      }
    }
  }
`

const SALES_COUNT_QUERY = gql`
  query SalesCount($where: events_bool_exp!) {
    events_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`

function saleWhere(since: string, until?: string) {
  const timestamp: Record<string, string> = { _gte: since }
  if (until) timestamp._lte = until
  return {
    implements: { _eq: 'SALE' },
    fa2_address: { _eq: HEN_CONTRACT_FA2 },
    timestamp,
  }
}

export function useSalesEvents({
  onProgress,
  enabled = true,
}: { onProgress?: (count: number) => void; enabled?: boolean } = {}) {
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress

  return useSWR<SaleEvent[]>(
    enabled && HEN_CONTRACT_FA2 ? `stats:sales:${HEN_CONTRACT_FA2}` : null,
    () => {
      const since = new Date(
        Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000
      ).toISOString()
      return fetchAll(SALES_QUERY, 'events', saleWhere(since), SALES_CURSOR, {
        pageSize: PAGE_SIZE,
        onProgress: (n: number) => onProgressRef.current?.(n),
      })
    },
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 60_000,
    }
  )
}

/**
 * Custom date-range SALE fetch
 */
export function useSalesRange(
  sinceISO?: string,
  untilISO?: string,
  {
    force = false,
    onProgress,
  }: { force?: boolean; onProgress?: (count: number) => void } = {}
) {
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress

  const key =
    sinceISO && untilISO
      ? `stats:sales-range:${sinceISO}:${untilISO}${force ? ':force' : ''}`
      : null

  return useSWR<SalesRangeResult>(
    key,
    async () => {
      const where = saleWhere(sinceISO as string, untilISO as string)

      if (!force) {
        const countRes = await request<{
          events_aggregate: { aggregate: { count: number } }
        }>(import.meta.env.VITE_TEIA_GRAPHQL_API, SALES_COUNT_QUERY, {
          where,
        })
        const count = countRes.events_aggregate.aggregate.count
        if (count > MAX_ROWS) return { tooMany: count }
      }

      const events = await fetchAll(SALES_QUERY, 'events', where, SALES_CURSOR, {
        pageSize: PAGE_SIZE,
        onProgress: (n: number) => onProgressRef.current?.(n),
        maxRows: force ? HARD_CAP : undefined,
      })
      return { events }
    },
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 60_000,
    }
  )
}

export interface SalesHistoryBucket {
  primaryCount: number
  primaryVolumeMutez: number
  secondaryCount: number
  secondaryVolumeMutez: number
}

export interface SalesHistoryWeek {
  week: string
  teia?: SalesHistoryBucket
  objkt?: SalesHistoryBucket
  other?: SalesHistoryBucket
}

export interface SalesHistory {
  generatedAt: string
  since: string
  boundary: string
  totalRows: number
  weeks: SalesHistoryWeek[]
}

export function useSalesHistory() {
  return useSWR<SalesHistory>(
    'stats:sales-history',
    () => import('./sales-history.json').then((m) => m.default as SalesHistory),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 60_000,
    }
  )
}

export function marketplaceOf(type: string | null): 'teia' | 'objkt' | 'other' {
  if (!type) return 'other'
  if (type.startsWith('TEIA_') || type.startsWith('HEN_')) return 'teia'
  if (type.startsWith('OBJKT_')) return 'objkt'
  return 'other'
}

export function marketOf(e: SaleEvent): 'primary' | 'secondary' {
  const artist = e.token?.artist_address
  return artist && e.seller_address === artist ? 'primary' : 'secondary'
}

function matchesMarketplace(
  type: string | null,
  marketplace: Marketplace
): boolean {
  return marketplace === 'all' || marketplaceOf(type) === marketplace
}

export function filterSales(
  events: SaleEvent[],
  { since, until, marketplace }: { since: string; until?: string; marketplace: Marketplace }
): SaleEvent[] {
  const sinceMs = new Date(since).getTime()
  const untilMs = until ? new Date(until).getTime() : undefined
  return events.filter((e) => {
    const ts = new Date(e.timestamp).getTime()
    if (ts < sinceMs) return false
    if (untilMs !== undefined && ts > untilMs) return false
    return matchesMarketplace(e.type, marketplace)
  })
}

const emptyWeek = (week: string): SalesWeek => ({
  week,
  primaryVolume: 0,
  secondaryVolume: 0,
  primaryCount: 0,
  secondaryCount: 0,
})

function fillWeekGaps(
  byWeek: Map<string, SalesWeek>,
  since: string,
  until?: string
): SalesWeek[] {
  const start = weekStartISO(since)
  const end = weekStartISO(until ?? new Date().toISOString())
  const weeks: SalesWeek[] = []
  for (
    let cursor = new Date(start);
    cursor <= new Date(end);
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  ) {
    const week = cursor.toISOString().slice(0, 10)
    weeks.push(byWeek.get(week) ?? emptyWeek(week))
  }
  return weeks
}

export function aggregateSales(
  events: SaleEvent[],
  {
    since,
    until,
    marketplace,
  }: { since: string; until?: string; marketplace: Marketplace }
): SalesStats {
  const filtered = filterSales(events, { since, until, marketplace })
  const byWeek = new Map<string, SalesWeek>()
  let primaryCount = 0
  let primaryVolume = 0
  let secondaryCount = 0
  let secondaryVolume = 0

  for (const e of filtered) {
    const tez = Number(e.price ?? 0) / 1e6
    const week = weekStartISO(e.timestamp)
    const row = byWeek.get(week) ?? emptyWeek(week)

    if (marketOf(e) === 'primary') {
      row.primaryVolume += tez
      row.primaryCount += 1
      primaryVolume += tez
      primaryCount += 1
    } else {
      row.secondaryVolume += tez
      row.secondaryCount += 1
      secondaryVolume += tez
      secondaryCount += 1
    }
    byWeek.set(week, row)
  }

  const weekly = fillWeekGaps(byWeek, since, until).map((row) => ({
    ...row,
    primaryVolume: Math.round(row.primaryVolume),
    secondaryVolume: Math.round(row.secondaryVolume),
  }))

  return {
    weekly,
    totalCount: filtered.length,
    totalVolume: Math.round(primaryVolume + secondaryVolume),
    primaryCount,
    primaryVolume: Math.round(primaryVolume),
    secondaryCount,
    secondaryVolume: Math.round(secondaryVolume),
  }
}

const emptyHistoryBucket = (): SalesHistoryBucket => ({
  primaryCount: 0,
  primaryVolumeMutez: 0,
  secondaryCount: 0,
  secondaryVolumeMutez: 0,
})

export function stitchAllTime(
  history: SalesHistory,
  liveEvents: SaleEvent[],
  marketplace: Marketplace
): SalesStats {
  const marketplaces: Array<'teia' | 'objkt' | 'other'> =
    marketplace === 'all' ? ['teia', 'objkt', 'other'] : [marketplace]

  const fileWeeks: SalesWeek[] = history.weeks
    .filter((w) => w.week < history.boundary)
    .map((w) => {
      let primaryCount = 0
      let primaryVolume = 0
      let secondaryCount = 0
      let secondaryVolume = 0
      for (const mkt of marketplaces) {
        const b = w[mkt] ?? emptyHistoryBucket()
        primaryCount += b.primaryCount
        primaryVolume += b.primaryVolumeMutez / 1e6
        secondaryCount += b.secondaryCount
        secondaryVolume += b.secondaryVolumeMutez / 1e6
      }
      return {
        week: w.week,
        primaryVolume: Math.round(primaryVolume),
        secondaryVolume: Math.round(secondaryVolume),
        primaryCount,
        secondaryCount,
      }
    })

  const boundaryISO = `${history.boundary}T00:00:00.000Z`

  if (liveEvents.length > 0) {
    const earliestLive = liveEvents.reduce(
      (min, e) => (e.timestamp < min ? e.timestamp : min),
      liveEvents[0].timestamp
    )
    if (earliestLive > boundaryISO) {
      console.warn(
        `sales-history.json is stale: live coverage starts ${earliestLive}, ` +
          `file boundary is ${boundaryISO} — there is a gap between them. ` +
          `Regenerate scripts/build-sales-history.mjs.`
      )
    }
  }

  const live = aggregateSales(liveEvents, { since: boundaryISO, marketplace })

  if (fileWeeks.length > 0 && live.weekly.length > 0) {
    const lastFileWeek = fileWeeks[fileWeeks.length - 1].week
    const firstLiveWeek = live.weekly[0].week
    if (lastFileWeek >= firstLiveWeek) {
      console.error(
        `stitchAllTime: unexpected week overlap — file ends at ${lastFileWeek}, live starts at ${firstLiveWeek}`
      )
    }
  }

  const fileTotals = fileWeeks.reduce(
    (acc, w) => ({
      count: acc.count + w.primaryCount + w.secondaryCount,
      volume: acc.volume + w.primaryVolume + w.secondaryVolume,
      primaryCount: acc.primaryCount + w.primaryCount,
      primaryVolume: acc.primaryVolume + w.primaryVolume,
      secondaryCount: acc.secondaryCount + w.secondaryCount,
      secondaryVolume: acc.secondaryVolume + w.secondaryVolume,
    }),
    {
      count: 0,
      volume: 0,
      primaryCount: 0,
      primaryVolume: 0,
      secondaryCount: 0,
      secondaryVolume: 0,
    }
  )

  return {
    weekly: [...fileWeeks, ...live.weekly],
    totalCount: fileTotals.count + live.totalCount,
    totalVolume: fileTotals.volume + live.totalVolume,
    primaryCount: fileTotals.primaryCount + live.primaryCount,
    primaryVolume: fileTotals.primaryVolume + live.primaryVolume,
    secondaryCount: fileTotals.secondaryCount + live.secondaryCount,
    secondaryVolume: fileTotals.secondaryVolume + live.secondaryVolume,
  }
}
