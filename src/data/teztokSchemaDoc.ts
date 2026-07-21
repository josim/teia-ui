// Curated schema reference for the TezTok GraphQL API, for use in AI agent system prompts.
// Endpoint: https://teztok.teia.rocks/v1/graphql (POST, application/json, {query, variables, operationName})
// Hasura-generated, read-only, indexes Tezos NFT activity across HEN/Teia/OBJKT/fx(hash)/Versum contracts.
// Prices are integers in mutez (1 tez = 1_000_000). token_id is a String (not int). Verified against the live endpoint 2026-07-21.

export const TEZTOK_SCHEMA_DOC = `
# TezTok GraphQL API (Hasura, read-only)
Endpoint: https://teztok.teia.rocks/v1/graphql — POST { query, variables, operationName }
Prices are mutez integers (1 tez = 1_000_000). token_id is a String. Addresses are Tezos tz1/tz2/tz3/KT1.

## Tables

### tokens (root: tokens, tokens_aggregate, tokens_by_pk(fa2_address, token_id))
One row per NFT (multi-edition FA2 token), aggregated across marketplaces.
Key columns: fa2_address(!), token_id(!), name, description, artist_address, mime_type,
artifact_uri, display_uri, thumbnail_uri, metadata_uri, metadata_status(!), editions, burned_editions,
minted_at, mint_price, price (current lowest active listing price), sales_count, sales_volume,
first_sales_price, last_sales_price, last_sale_at, highest_sales_price, lowest_sales_price,
highest_offer_price, royalties_total, symbol, platform, is_verified_artist, tags, attributes(jsonb).
Relations: artist_profile -> teia_users, events[], holdings[], listings[], offers[], tags[],
royalty_receivers[], signatures[], teia_meta -> teia_tokens_meta.

### events (root: events, events_aggregate, events_by_pk(id))
Append-only log of every on-chain action touching a token or marketplace (mints, sales, swaps,
asks, offers, transfers, burns...). This is the source of truth for activity/history feeds.
Key columns: id(!), opid(!), ophash, level(!), timestamp(!), type (e.g. HEN_MINT, TEIA_SWAP,
TEIA_COLLECT, OBJKT_ASK_V3, OBJKT_FULFILL_ASK_V3, OBJKT_OFFER_V3_2, FA2_TRANSFER),
implements (coarse category: "SALE", "MINT", etc — filter on this for sales, not \`type\`),
fa2_address, token_id, price, amount, editions, currency,
buyer_address, seller_address, from_address, to_address, holder_address, bidder_address,
swap_id, ask_id, offer_id, bid_id, auction_id, start_price, end_price, start_time, end_time, metadata(jsonb).
Relations: token -> tokens, buyer_profile/seller_profile/from_profile/to_profile -> teia_users.
Gotcha: a single logical sale can appear once with implements="SALE" — always filter
\`implements: {_eq: "SALE"}\` to count/sum sales, don't filter on \`type\` (too many marketplace-specific values).

### holdings (root: holdings, holdings_aggregate, holdings_by_pk)
Current ownership: how much of a token each address holds right now (materialized, not a log).
Key columns: fa2_address(!), token_id(!), holder_address(!), amount(!), first_received_at, last_received_at.
Relations: token -> tokens, holder_profile -> teia_users.
Filter \`amount: {_gt: "0"}\` to exclude zero-balance rows left over from past transfers.

### listings (root: listings, listings_aggregate)
Every swap/ask ever created (any marketplace), current + historical, keyed by status.
Key columns: type (e.g. HEN_SWAP_V2, OBJKT_ASK_V3), status(!) ("active" | "sold" | "cancelled" | ...),
fa2_address(!), token_id(!), contract_address(!), seller_address(!), price(!), amount(!), amount_left(!),
start_price, end_price, currency, swap_id, ask_id, offer_id, created_at(!), end_time.
Relations: token -> tokens, seller_profile -> teia_users.
For "currently for sale", always filter \`status: {_eq: "active"}\`.

### offers (root: offers, offers_aggregate)
Every bid/offer ever placed on a token, current + historical.
Key columns: type, status(!) ("active" | "fulfilled" | "cancelled" | ...), fa2_address(!), token_id(!),
contract_address(!), buyer_address(!), price(!), amount, currency, offer_id, bid_id, created_at(!).
Relations: token -> tokens.

### tags (root: tags, tags_by_pk)
Token tag join table. No separate token_tags table — this IS the join.
Key columns: fa2_address(!), token_id(!), tag(!). Relation: token -> tokens.

### teia_users (root: teia_users, teia_users_by_pk)
Profile info keyed by address (Teia's user/name registry; not a generic "tzprofiles" table).
Key columns: user_address(!), name, metadata_uri, is_split (true if this address is a Teia split/collab
contract), split_contract -> teia_split_contracts, metadata -> token_metadata { data(jsonb), status, uri }.

### teia_split_contracts / teia_shareholders / teia_signatures
Teia collaboration (revenue-split) contracts. teia_split_contracts has administrator_address,
contract_address, contract_profile -> teia_users, shareholders[] -> teia_shareholders
(shareholder_address, shares, holder_type). teia_signatures tracks which shareholders signed a token.

### teia_tokens_meta
Teia-specific token flags: accessibility, content_rating, is_signed, preview_uri. Joined via tokens.teia_meta.

### token_metadata
Raw off-chain metadata cache: uri(!), status(!), data(jsonb). Joined via teia_users.metadata; not queried directly.

## Hasura query syntax reminders
- where: { field: { _eq | _neq | _gt | _gte | _lt | _lte | _in | _nin | _ilike | _like } }
- combine: { _and: [...] } / { _or: [...] } (top-level object fields are implicitly ANDed)
- _ilike uses SQL wildcards: \`%term%\` for substring, \`term%\` for prefix — escape user-typed % _ \\ first
- nested filter through a relation: { token: { artist_address: { _eq: $addr } } }
- order_by: { field: asc|desc }, or array for multiple: [{ level: desc }, { opid: desc }]
- limit / offset for pagination
- aggregate pattern: \`things_aggregate(where: {...}) { aggregate { count sum { price } avg { price } max { price } } }\`
- no native GROUP BY on non-aggregate root fields — for "top N holders/collectors" query holdings/events
  rows directly (order_by + limit), don't expect a grouped aggregate.

## Example queries (verified against the live endpoint)

**Tokens by creator:**
\`\`\`graphql
query TokensByCreator($address: String!) {
  tokens(where: { artist_address: { _eq: $address }, editions: { _gt: "0" } }, order_by: { minted_at: desc }, limit: 20) {
    fa2_address token_id name price mime_type editions minted_at sales_count
  }
}
\`\`\`

**Sales (events) for an address in a date range:**
\`\`\`graphql
query SalesForAddress($address: String!, $from: timestamptz!, $to: timestamptz!) {
  events(
    where: {
      implements: { _eq: "SALE" }
      _or: [{ buyer_address: { _eq: $address } }, { seller_address: { _eq: $address } }]
      timestamp: { _gte: $from, _lte: $to }
    }
    order_by: { timestamp: desc }
    limit: 50
  ) {
    timestamp type price token_id fa2_address buyer_address seller_address ophash
  }
}
\`\`\`

**Current listings by seller:**
\`\`\`graphql
query ActiveListingsBySeller($address: String!) {
  listings(where: { seller_address: { _eq: $address }, status: { _eq: "active" } }, order_by: { created_at: desc }) {
    type price amount amount_left fa2_address token_id created_at
  }
}
\`\`\`

**Holdings of a wallet:**
\`\`\`graphql
query HoldingsOfWallet($address: String!) {
  holdings(where: { holder_address: { _eq: $address }, amount: { _gt: "0" } }, order_by: { last_received_at: desc }) {
    fa2_address token_id amount last_received_at
    token { name price mime_type artist_address }
  }
}
\`\`\`

**Top collectors of an artist (largest single holdings, not summed per holder):**
\`\`\`graphql
query TopCollectorsOfArtist($artist: String!) {
  holdings(
    where: { token: { artist_address: { _eq: $artist } }, amount: { _gt: "0" } }
    order_by: { amount: desc }
    limit: 10
  ) {
    holder_address amount token_id
  }
}
\`\`\`

**Count of tokens by an artist (aggregate pattern):**
\`\`\`graphql
query TokenCountByArtist($address: String!) {
  tokens_aggregate(where: { artist_address: { _eq: $address } }) {
    aggregate { count }
  }
}
\`\`\`
`
