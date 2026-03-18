import { useRef, useEffect, useState } from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { useTokenSearch } from '@hooks/useTokenSearch'
import { fetchObjktDetails } from '@data/api'
import { useUserStore } from '@context/userStore'
import { HashToURL } from '@utils'
import { walletPreview } from '@utils/string'
import styles from '../index.module.scss'

function TokenSearchInline({ onSelect }) {
  const {
    query,
    loading,
    search,
    tokensToShow,
    artists,
    selectedArtist,
    selectArtist,
    clearArtist,
  } = useTokenSearch()
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className={styles.token_search_inline} contentEditable={false}>
      <input
        ref={inputRef}
        className={styles.token_search_input}
        type="text"
        placeholder="Search token ID, name, or artist..."
        value={query}
        onChange={(e) => search(e.target.value)}
      />
      {loading && (
        <div className={styles.token_search_status}>Searching...</div>
      )}

      {selectedArtist && (
        <button
          type="button"
          className={styles.token_search_back}
          onClick={clearArtist}
        >
          &larr; Back to results
        </button>
      )}

      {artists.length > 0 && (
        <div className={styles.token_search_section}>
          <div className={styles.token_search_label}>Artists</div>
          {artists.map((artist) => (
            <button
              type="button"
              key={artist.user_address}
              className={styles.token_search_item}
              onClick={() => selectArtist(artist)}
            >
              <span style={{ fontWeight: 600 }}>{artist.name}</span>
              <span style={{ fontSize: '11px', opacity: 0.6 }}>
                {artist.user_address.slice(0, 8)}...
              </span>
            </button>
          ))}
        </div>
      )}

      {tokensToShow.length > 0 && (
        <div className={styles.token_search_section}>
          {!selectedArtist && (
            <div className={styles.token_search_label}>Tokens</div>
          )}
          {selectedArtist && (
            <div className={styles.token_search_label}>
              Tokens by {selectedArtist.name}
            </div>
          )}
          {tokensToShow.map((token) => {
            const thumbUrl = token.display_uri
              ? HashToURL(token.display_uri, 'CDN', { size: 'small' })
              : ''
            return (
              <button
                type="button"
                key={token.token_id}
                className={styles.token_search_item}
                onClick={() => onSelect(token)}
              >
                {thumbUrl && (
                  <img
                    className={styles.token_search_thumb}
                    src={thumbUrl}
                    alt=""
                    loading="lazy"
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.token_search_name}>
                    {token.name || 'Untitled'}
                  </div>
                  <div className={styles.token_search_artist}>
                    {token.artist_profile?.name ||
                      walletPreview(token.artist_address)}
                  </div>
                </div>
                <span style={{ fontSize: '11px', opacity: 0.6, flexShrink: 0 }}>
                  #{token.token_id}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {!loading &&
        query &&
        tokensToShow.length === 0 &&
        artists.length === 0 && (
          <div className={styles.token_search_status}>No results found</div>
        )}
    </div>
  )
}

function TokenBlockPreview({ block }) {
  const {
    tokenId,
    name,
    artistName,
    artist,
    mimeType,
    displayUri,
    artifactUri,
  } = block.props
  const [listings, setListings] = useState([])
  const [showListings, setShowListings] = useState(false)
  const collect = useUserStore((st) => st.collect)
  const address = useUserStore((st) => st.address)

  useEffect(() => {
    if (!tokenId) return
    fetchObjktDetails(tokenId).then((nft) => {
      if (nft?.listings?.length) {
        setListings(nft.listings.filter((l) => l.amount_left > 0))
      }
    })
  }, [tokenId])

  const mime = mimeType || ''
  let previewUri = displayUri || ''
  if (mime.startsWith('image/')) previewUri = artifactUri || displayUri || ''

  let media
  if (mime.startsWith('video/') && artifactUri) {
    media = (
      <video
        src={HashToURL(artifactUri)}
        className={styles.token_block_media}
        muted
        loop
        autoPlay
        playsInline
      />
    )
  } else if (mime === 'image/gif' && artifactUri) {
    media = (
      <img
        src={HashToURL(artifactUri)}
        alt=""
        className={styles.token_block_media}
      />
    )
  } else if (previewUri) {
    media = (
      <img
        src={HashToURL(previewUri, 'CDN', { size: 'small' })}
        alt=""
        className={styles.token_block_media}
      />
    )
  }

  return (
    <div className={styles.token_block_preview} contentEditable={false}>
      {media}
      <div className={styles.token_block_info}>
        <a href={`/objkt/${tokenId}`} className={styles.token_block_name}>
          {name || `#${tokenId}`}
        </a>
        {(artistName || artist) && (
          <span className={styles.token_block_artist}>
            by {artistName || walletPreview(artist)}
          </span>
        )}
      </div>
      {listings.length > 0 && (
        <div className={styles.token_block_collect}>
          {!address ? (
            <span className={styles.token_block_collect_hint}>
              Connect wallet to collect
            </span>
          ) : listings.length === 1 ? (
            <button
              type="button"
              className={styles.token_block_collect_btn}
              onClick={() => collect(listings[0])}
            >
              Collect for {listings[0].price / 1e6} tez
            </button>
          ) : (
            <>
              <button
                type="button"
                className={styles.token_block_collect_btn}
                onClick={() => setShowListings(!showListings)}
              >
                Collect ({listings.length} listings)
              </button>
              {showListings && (
                <div className={styles.token_block_listings}>
                  {listings.map((l) => (
                    <button
                      type="button"
                      key={l.swap_id || l.ask_id || l.offer_id}
                      className={styles.token_block_listing_row}
                      onClick={() => collect(l)}
                    >
                      {l.price / 1e6} tez —{' '}
                      {l.seller_profile?.name ||
                        walletPreview(l.seller_address)}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export const TokenEmbedBlock = createReactBlockSpec(
  {
    type: 'teiaToken',
    propSchema: {
      tokenId: { default: '' },
      fa2: { default: 'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton' },
      name: { default: '' },
      artist: { default: '' },
      artistName: { default: '' },
      mimeType: { default: '' },
      displayUri: { default: '' },
      artifactUri: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => {
      if (!props.block.props.tokenId) {
        return (
          <TokenSearchInline
            onSelect={(token) => {
              props.editor.updateBlock(props.block, {
                props: {
                  tokenId: String(token.token_id),
                  fa2:
                    token.fa2_address || 'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton',
                  name: token.name || '',
                  artist: token.artist_address || '',
                  artistName: token.artist_profile?.name || '',
                  mimeType: token.mime_type || '',
                  displayUri: token.display_uri || '',
                  artifactUri: token.artifact_uri || '',
                },
              })
            }}
          />
        )
      }

      return <TokenBlockPreview block={props.block} />
    },
  }
)
