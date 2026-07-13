import { gql, request } from 'graphql-request'

// Collector-export data layer (artist-only Activity-tab feature).
//
// Two report bases over the teztok tables the app already queries:
//   - Sales report   → `events` (implements: "SALE"), grouped by buyer.
//   - Holders report → `holdings` (amount > 0), grouped by holder.
//
// These are on-demand exports (a button press) that fetch the artist's full
// history — no cap. teztok's Hasura has no server-side group-by, so aggregation
// happens client-side here.

const ENDPOINT = import.meta.env.VITE_TEIA_GRAPHQL_API
const PAGE = 500

const ARTIST_SALES_QUERY = gql`
  query ArtistSales($where: events_bool_exp!, $limit: Int!) {
    events(
      where: $where
      order_by: [{ level: asc }, { opid: asc }, { id: asc }]
      limit: $limit
    ) {
      id
      level
      opid
      timestamp
      ophash
      price
      amount
      seller_address
      buyer_address
      buyer_profile {
        name
      }
      token {
        token_id
        fa2_address
        name
        artist_address
      }
    }
  }
`

const ARTIST_HOLDERS_QUERY = gql`
  query ArtistHolders($where: holdings_bool_exp!, $limit: Int!) {
    holdings(
      where: $where
      order_by: [
        { fa2_address: asc }
        { token_id: asc }
        { holder_address: asc }
      ]
      limit: $limit
    ) {
      fa2_address
      token_id
      holder_address
      amount
      holder_profile {
        name
      }
      token {
        token_id
        fa2_address
        name
        artist_address
      }
    }
  }
`

// Cursor columns per query, a strict total order so keyset paging never skips
// or repeats a row. events use (level, opid, id) with the unique PK `id` as a
// tiebreaker; holdings has no surrogate id, so its natural key
// (fa2_address, token_id, holder_address) is used.
const SALES_CURSOR = ['level', 'opid', 'id']
const HOLDERS_CURSOR = ['fa2_address', 'token_id', 'holder_address']

/** Keyset ">" predicate: rows strictly after `last` in `cursor` column order. */
function keysetAfter(cursor, last) {
  return {
    _or: cursor.map((field, i) => ({
      ...Object.fromEntries(
        cursor.slice(0, i).map((g) => [g, { _eq: last[g] }])
      ),
      [field]: { _gt: last[field] },
    })),
  }
}

/**
 * Keyset-paginate `query` on `key` (events|holdings) until the table drains.
 * No cap: each page is an indexed seek past the previous page's last row
 * (`cursor` columns), so this stays fast at any row count. `onProgress`, when
 * given, is called with the running row total after each page.
 */
async function fetchAll(query, key, baseWhere, cursor, onProgress) {
  const rows = []
  let last = null
  for (;;) {
    const where = last
      ? { _and: [baseWhere, keysetAfter(cursor, last)] }
      : baseWhere
    const res = await request(ENDPOINT, query, { where, limit: PAGE })
    const page = res[key] || []
    rows.push(...page)
    onProgress?.(rows.length)
    if (page.length < PAGE) return rows
    last = page[page.length - 1]
  }
}

/**
 * Everyone who bought a token created by `artists`, grouped by buyer.
 *
 * @param {object} opts
 * @param {string[]} opts.artists artist wallet addresses (own + alt wallets)
 * @param {string[]} [opts.tokenIds] restrict to these token ids
 * @param {string} [opts.from] ISO timestamp lower bound (inclusive)
 * @param {string} [opts.to] ISO timestamp upper bound (inclusive)
 * @param {'primary'|'secondary'|'both'} [opts.market] which sales to include
 * @param {(count: number) => void} [opts.onProgress] running fetched-row count
 * @returns {Promise<object[]>} aggregated buyer rows
 */
export async function fetchArtistSales({
  artists,
  tokenIds,
  from,
  to,
  market = 'both',
  onProgress,
}) {
  const where = {
    implements: { _eq: 'SALE' },
    token: { artist_address: { _in: artists } },
  }
  if (tokenIds?.length) where.token.token_id = { _in: tokenIds }
  if (from || to) {
    where.timestamp = {}
    if (from) where.timestamp._gte = from
    if (to) where.timestamp._lte = to
  }
  // Primary = the seller is one of the artist's own wallets (first sale); any
  // other seller is a secondary-market resale. Scoping the query to the
  // requested market keeps the fetch to just those rows.
  if (market === 'primary') where.seller_address = { _in: artists }
  else if (market === 'secondary') where.seller_address = { _nin: artists }

  const rows = await fetchAll(
    ARTIST_SALES_QUERY,
    'events',
    where,
    SALES_CURSOR,
    onProgress
  )

  const byBuyer = new Map()
  for (const ev of rows) {
    const addr = ev.buyer_address
    // Skip contract buyers (marketplace/collab escrow) — not a person-collector.
    if (!addr || addr.startsWith('KT1')) continue
    let row = byBuyer.get(addr)
    if (!row) {
      row = {
        address: addr,
        name: ev.buyer_profile?.name || '',
        editions_bought: 0,
        // `price` is the tez paid for the sale event; matches how the Activity
        // feed already presents SALE rows. teztok leaves `amount` null on ~all
        // SALE events, so each event counts as one edition (see `|| 1` below).
        tez_spent: 0,
        first_purchase: ev.timestamp,
        first_purchase_ophash: ev.ophash,
        last_purchase: ev.timestamp,
        last_purchase_ophash: ev.ophash,
        _tokens: new Set(),
      }
      byBuyer.set(addr, row)
    }
    row.editions_bought += Number(ev.amount) || 1
    row.tez_spent += (Number(ev.price) || 0) / 1e6
    if (ev.token?.token_id) row._tokens.add(ev.token.token_id)
    if (ev.timestamp < row.first_purchase) {
      row.first_purchase = ev.timestamp
      row.first_purchase_ophash = ev.ophash
    }
    if (ev.timestamp > row.last_purchase) {
      row.last_purchase = ev.timestamp
      row.last_purchase_ophash = ev.ophash
    }
    if (!row.name && ev.buyer_profile?.name) row.name = ev.buyer_profile.name
  }

  return [...byBuyer.values()].map(({ _tokens, ...row }) => ({
    ...row,
    distinct_tokens: _tokens.size,
    token_ids: [..._tokens].join(' '),
  }))
}

/**
 * Current holders of tokens created by `artists`, grouped by holder.
 *
 * @param {object} opts
 * @param {string[]} opts.artists artist wallet addresses (own + alt wallets)
 * @param {string[]} [opts.tokenIds] restrict to these token ids
 * @param {(count: number) => void} [opts.onProgress] running fetched-row count
 * @returns {Promise<object[]>} aggregated holder rows
 */
export async function fetchArtistHolders({ artists, tokenIds, onProgress }) {
  const where = {
    amount: { _gt: '0' },
    token: { artist_address: { _in: artists } },
  }
  if (tokenIds?.length) where.token.token_id = { _in: tokenIds }

  const rows = await fetchAll(
    ARTIST_HOLDERS_QUERY,
    'holdings',
    where,
    HOLDERS_CURSOR,
    onProgress
  )

  const byHolder = new Map()
  for (const h of rows) {
    const addr = h.holder_address
    // Skip contract holders (marketplace escrow for listed editions, collab
    // contracts) — a listed edition is still the collector's, but it is held
    // by the market contract here and is not a person to export.
    if (!addr || addr.startsWith('KT1')) continue
    let row = byHolder.get(addr)
    if (!row) {
      row = {
        address: addr,
        name: h.holder_profile?.name || '',
        editions_held: 0,
        _tokens: new Set(),
      }
      byHolder.set(addr, row)
    }
    row.editions_held += Number(h.amount) || 0
    row._tokens.add(h.token?.token_id)
    if (!row.name && h.holder_profile?.name) row.name = h.holder_profile.name
  }

  return [...byHolder.values()].map(({ _tokens, ...row }) => ({
    ...row,
    distinct_tokens: _tokens.size,
    token_ids: [..._tokens].join(' '),
  }))
}

/**
 * Apply the composable min/max/sort/limit filters to aggregated rows.
 *
 * @param {object[]} rows aggregated collector rows
 * @param {object} opts
 * @param {string} opts.sortKey column to sort by
 * @param {number} [opts.minTez] drop rows below this tez_spent
 * @param {number} [opts.maxTez] drop rows above this tez_spent
 * @param {number} [opts.minEditions] drop rows below this edition count
 * @param {number} [opts.maxEditions] drop rows above this edition count
 * @param {number} [opts.limit] keep only the top N after sorting
 * @param {'sales'|'holders'} opts.basis which report (picks the edition field)
 */
export function applyFilters(
  rows,
  { sortKey, minTez, maxTez, minEditions, maxEditions, limit, basis }
) {
  const editionsOf = (r) =>
    basis === 'holders' ? r.editions_held : r.editions_bought

  let out = rows.filter((r) => {
    if (minTez != null && (r.tez_spent ?? 0) < minTez) return false
    if (maxTez != null && (r.tez_spent ?? 0) > maxTez) return false
    if (minEditions != null && editionsOf(r) < minEditions) return false
    if (maxEditions != null && editionsOf(r) > maxEditions) return false
    return true
  })

  out.sort((a, b) => (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0))
  if (limit != null && limit > 0) out = out.slice(0, limit)
  return out
}
