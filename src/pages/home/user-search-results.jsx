import useSWR from 'swr'
import get from 'lodash/get'
import uniqBy from 'lodash/uniqBy'
import { fetchGraphQL } from '@data/api'
import { useSearchParams, Link } from 'react-router-dom'
import laggy from '@utils/swr-laggy-middleware'
import styles from '@style'
import { Identicon } from '@atoms/identicons'
import { Line } from '@atoms/line'
import { gql } from 'graphql-request'
import { useCallback, useMemo, useRef } from 'react'
import { useVirtualList } from '@hooks/use-virtual-list'

// 32px icon + 2x10px padding + 1px line; wrapped descriptions get measured.
const ROW_ESTIMATE = 53
// ~7 rows fit the 400px container; mount about one screen more, split
// above/below, so fast scrolling rarely shows blank space.
const OVERSCAN = 6
const SKELETON_ROWS = 8

function SkeletonRows() {
  return Array.from({ length: SKELETON_ROWS }, (_, i) => (
    <div key={i} className={styles.subjkt_result} aria-hidden="true">
      <div className={styles.flex}>
        <div className={styles.user_box}>
          <span className={`${styles.subjkt_icon} ${styles.skeleton}`} />
          <span
            className={`${styles.skeleton} ${styles.skeleton_name}`}
            style={{ width: `${45 + ((i * 37) % 40)}%` }}
          />
        </div>
        <div className={styles.description}>
          <span
            className={`${styles.skeleton} ${styles.skeleton_text}`}
            style={{ width: `${30 + ((i * 53) % 60)}%` }}
          />
        </div>
      </div>
      <Line />
    </div>
  ))
}

function UserSearchResults() {
  const [searchParams] = useSearchParams()
  const searchTerm = searchParams.get('term') || ''

  const { data, isLagging } = useSWR(
    ['subjkts-search', searchTerm],
    async (ns, term) => {
      const result = await fetchGraphQL(
        gql`
          query getSubjkts($subjkt: String!) {
            teia_users(where: { name: { _ilike: $subjkt } }) {
              user_address
              name
              metadata {
                data
              }
            }
          }
        `,
        'getSubjkts',
        {
          subjkt: `%${term}%`,
        }
      )

      return result.data
    },
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      use: [laggy],
    }
  )

  const holders = useMemo(
    () =>
      uniqBy(get(data, 'teia_users') || [], ({ name }) => name).filter(
        ({ name }) => name
      ),
    [data]
  )

  // laggy keeps the previous term's rows around; don't show them as results.
  if (!data || isLagging) {
    return (
      <div className={styles.container} aria-busy="true">
        <SkeletonRows />
      </div>
    )
  }

  if (!holders.length) {
    return null
  }

  // Keyed by term so measurements and scroll position reset per search.
  return <VirtualSubjkts key={searchTerm} holders={holders} />
}

function VirtualSubjkts({ holders }) {
  const scrollRef = useRef(null)
  const getKey = useCallback((i) => holders[i].name, [holders])
  const { items, totalSize, measureElement } = useVirtualList({
    count: holders.length,
    getKey,
    estimateSize: ROW_ESTIMATE,
    overscan: OVERSCAN,
    scrollRef,
  })

  return (
    <div ref={scrollRef} className={styles.container}>
      <div className={styles.virtual_spacer} style={{ height: totalSize }}>
        {items.map(({ index, key, start }) => {
          const { user_address, name, metadata } = holders[index]
          return (
            <div
              key={key}
              ref={measureElement}
              data-index={index}
              className={`${styles.subjkt_result} ${styles.virtual_row}`}
              style={{ transform: `translateY(${start}px)` }}
            >
              <div className={styles.flex}>
                <Link
                  className={styles.user_box}
                  to={`/${encodeURIComponent(name)}`}
                >
                  {metadata.data && (
                    <Identicon
                      className={styles.subjkt_icon}
                      address={user_address}
                      logo={metadata.data?.identicon}
                    />
                  )}
                  <p className={styles.user}>{name}</p>
                </Link>{' '}
                <p className={styles.description}>
                  {get(metadata, 'data.description')}
                </p>
              </div>
              <Line key={`${name}-line`} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default UserSearchResults
