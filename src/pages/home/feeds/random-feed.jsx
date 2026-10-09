import { useMemo } from 'react'
import { gql } from 'graphql-request'
import random from 'lodash/random'
import { useLocation } from 'react-router-dom'
import { BaseTokenFieldsFragment } from '@data/api'
import { HEN_CONTRACT_FA2 } from '@constants'
import TokenCollection from '@atoms/token-collection'

// TODO: Fetch last ID from the indexer
export function RandomFeed({ firstId = 196, lastId = 1_592_463, max = 200 }) {
  // New location key on every dice roll -> fresh set of ids.
  const { key: rollKey } = useLocation()
  const tokenIds = useMemo(() => {
    const uniqueIds = new Set()

    while (uniqueIds.size < max) {
      uniqueIds.add(`${random(firstId, lastId)}`)
    }

    return Array.from(uniqueIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstId, lastId, max, rollKey])

  return (
    <TokenCollection
      feeds_menu
      label="Random"
      namespace="random-feed"
      // SWR keys on namespace + swrParams only, so each roll needs its own key.
      swrParams={[rollKey]}
      enableInfinityScroll={false}
      variables={{ tokenIds }}
      maxItems={200}
      query={gql`
        ${BaseTokenFieldsFragment}
        query Objkts($tokenIds: [String!] = "", $limit: Int!, $filters: tokens_bool_exp!) {
          tokens(where: { token_id: { _in: $tokenIds }, editions: { _neq: 0 }, fa2_address: { _eq: "${HEN_CONTRACT_FA2}" }, _and: [$filters] }, limit: $limit) {
            ...baseTokenFields
          }
        }
      `}
    />
  )
}

export default RandomFeed
