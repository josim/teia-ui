import { useState, useRef, useEffect, useCallback } from 'react'
import { tokenToEmbed } from '@data/messaging/token-search'
import { useTokenSearch } from '@hooks/useTokenSearch'
import { HashToURL } from '@utils'
import styles from './index.module.scss'

const MAX_EMBEDS = 4

export default function TokenEmbedPicker({ onSelect, embedCount = 0 }) {
  const [open, setOpen] = useState(false)
  const {
    query,
    loading,
    results,
    selectedArtist,
    tokensToShow,
    artists,
    search,
    selectArtist,
    clearArtist,
    reset,
  } = useTokenSearch()
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  const atLimit = embedCount >= MAX_EMBEDS

  const handleClickOutside = useCallback((e) => {
    if (containerRef.current && !containerRef.current.contains(e.target)) {
      setOpen(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      inputRef.current?.focus()
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, handleClickOutside])

  const handleTokenSelect = useCallback(
    (token) => {
      onSelect(tokenToEmbed(token))
    },
    [onSelect]
  )

  const handleButtonClick = () => {
    setOpen(!open)
    reset()
  }

  return (
    <div ref={containerRef} className={styles.container}>
      <button
        type="button"
        onClick={handleButtonClick}
        title="Embed token"
        className={`${styles.trigger} ${embedCount > 0 ? styles.active : ''}`}
      >
        🖼
      </button>
      {open && (
        <div className={styles.dropdown}>
          <input
            ref={inputRef}
            className={styles.search_input}
            type="text"
            placeholder="Token ID, artist name, or address..."
            value={query}
            onChange={(e) => search(e.target.value)}
          />
          <div className={styles.search_hint}>
            Search by token ID, tz address, or name
            {embedCount > 0 && ` · ${embedCount}/${MAX_EMBEDS} attached`}
          </div>

          {atLimit && (
            <div className={styles.loading}>
              Maximum of {MAX_EMBEDS} embeds reached
            </div>
          )}

          {loading && <div className={styles.loading}>Searching...</div>}

          {!loading && results && (
            <div className={styles.results}>
              {selectedArtist && (
                <button
                  type="button"
                  className={styles.back_btn}
                  onClick={clearArtist}
                >
                  &larr; Back to results
                </button>
              )}

              {selectedArtist && (
                <div className={styles.section_label}>
                  Tokens by {selectedArtist.name}
                </div>
              )}

              {!selectedArtist && artists.length > 0 && (
                <>
                  <div className={styles.section_label}>Artists</div>
                  {artists.map((artist) => (
                    <button
                      type="button"
                      key={artist.user_address}
                      className={styles.artist_item}
                      onClick={() => selectArtist(artist)}
                    >
                      <span className={styles.artist_name}>{artist.name}</span>
                      <span className={styles.artist_address}>
                        {artist.user_address.slice(0, 8)}...
                      </span>
                    </button>
                  ))}
                </>
              )}

              {tokensToShow.length > 0 && (
                <>
                  {!selectedArtist && (
                    <div className={styles.section_label}>Tokens</div>
                  )}
                  {tokensToShow.map((token) => {
                    const thumbUrl = token.display_uri
                      ? HashToURL(token.display_uri, 'CDN', { size: 'small' })
                      : ''
                    const artistName =
                      token.artist_profile?.name ||
                      token.artist_address?.slice(0, 8) + '...'
                    return (
                      <button
                        type="button"
                        key={token.token_id}
                        className={styles.token_item}
                        onClick={() => handleTokenSelect(token)}
                        disabled={atLimit}
                      >
                        {thumbUrl && (
                          <img
                            className={styles.token_thumb}
                            src={thumbUrl}
                            alt=""
                            loading="lazy"
                          />
                        )}
                        <div className={styles.token_info}>
                          <div className={styles.token_name}>
                            {token.name || 'Untitled'}
                          </div>
                          <div className={styles.token_artist}>
                            {artistName}
                          </div>
                        </div>
                        <span className={styles.token_id}>
                          #{token.token_id}
                        </span>
                      </button>
                    )
                  })}
                </>
              )}

              {tokensToShow.length === 0 && artists.length === 0 && (
                <div className={styles.empty}>No results found</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
