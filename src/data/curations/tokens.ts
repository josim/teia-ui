import useSWR from 'swr'
import { request, gql } from 'graphql-request'
import { BaseTokenFieldsFragment } from '@data/api'
import type { CurationToken } from './types'

const TOKENS_BY_REF = gql`
  ${BaseTokenFieldsFragment}
  query CurationTokens($conds: [tokens_bool_exp!]) {
    tokens(where: { _or: $conds }) {
      ...baseTokenFields
    }
  }
`

/** Fetch every token referenced by a curation. */
export async function fetchCurationTokens(
  refs: CurationToken[]
): Promise<any[]> {
  if (!refs.length) return []

  const conds = refs.map((r) => ({
    _and: [
      { fa2_address: { _eq: r.fa2_address } },
      { token_id: { _eq: r.token_id } },
    ],
  }))

  const data = await request(
    import.meta.env.VITE_TEIA_GRAPHQL_API,
    TOKENS_BY_REF,
    { conds }
  )

  const byRef = new Map<string, any>()
  for (const token of data.tokens ?? []) {
    byRef.set(`${token.fa2_address}:${token.token_id}`, token)
  }

  return refs
    .map((r) => byRef.get(`${r.fa2_address}:${r.token_id}`))
    .filter(Boolean)
    .map((token) => ({
      ...token,
      key: `${token.fa2_address}:${token.token_id}`,
    }))
}

export function useCurationTokens(refs: CurationToken[] | undefined) {
  const key = refs?.length
    ? `curations:tokens:${refs
        .map((r) => `${r.fa2_address}:${r.token_id}`)
        .join(',')}`
    : null
  return useSWR(key, () => fetchCurationTokens(refs as CurationToken[]), {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })
}

const CARD_TOKEN_QUERY = gql`
  query CurationCardToken($fa2: String!, $id: String!) {
    tokens(
      where: { fa2_address: { _eq: $fa2 }, token_id: { _eq: $id } }
      limit: 1
    ) {
      fa2_address
      token_id
      display_uri
      thumbnail_uri
    }
  }
`

/**
 * The fallback cover for a curation card that has
 * neither a cover_image nor a stored cover_thumbnail.
 */
export function useCurationCardToken(ref: CurationToken | undefined) {
  return useSWR(
    ref ? `curations:cardtoken:${ref.fa2_address}:${ref.token_id}` : null,
    async () => {
      const data = await request(
        import.meta.env.VITE_TEIA_GRAPHQL_API,
        CARD_TOKEN_QUERY,
        { fa2: ref!.fa2_address, id: ref!.token_id }
      )
      return data.tokens?.[0] ?? null
    },
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  )
}
