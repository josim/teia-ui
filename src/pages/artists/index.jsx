import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Page, Container } from '@atoms/layout'
import { Button } from '@atoms/button'
import { Loading } from '@atoms/loading'
import { Checkbox } from '@atoms/input'
import Identicon from '@atoms/identicons'
import { HashToURL } from '@utils'
import { useArtistsPage } from '@data/swr'
import useSettings from '@hooks/use-settings'
import {
  METADATA_ACCESSIBILITY_HAZARDS_PHOTOSENS,
  METADATA_CONTENT_RATING_MATURE,
} from '@constants'
import styles from './index.module.scss'

const SLIDE_SIZE = 3
const HINT_PX = 40 // full height of the scroll-for-next-page bar

// Resized webp via imgproxy; raw display_uri can be many MB per image.
const thumbUrl = (token) =>
  token.teia_meta?.preview_uri && import.meta.env.VITE_IMGPROXY
    ? `${import.meta.env.VITE_IMGPROXY}${token.teia_meta.preview_uri}`
    : HashToURL(token.display_uri)

// `filters`: [{ label, hide: token => bool, active }]. A token matched by an
// active filter renders as a blank tile with its own reveal button.
function Carousel({ tokens, filters }) {
  const [slide, setSlide] = useState(0)
  // token_ids revealed on this card, one image at a time.
  const [revealed, setRevealed] = useState(() => new Set())

  const hiddenLabels = (token) =>
    revealed.has(token.token_id)
      ? []
      : filters.filter((f) => f.active && f.hide(token)).map((f) => f.label)

  if (!tokens.length) {
    // Same footprint as a slide, so the card stays full height.
    return (
      <div className={styles.placeholder}>
        <div className={styles.placeholder_strip}>
          <div className={styles.slide}>
            <div className={styles.blank} />
            <div className={styles.blank} />
            <div className={styles.blank} />
          </div>
          <div className={styles.placeholder_label}>no creations</div>
        </div>
        <div className={styles.controls}>&nbsp;</div>
      </div>
    )
  }

  const slides = Math.ceil(tokens.length / SLIDE_SIZE)
  const safeSlide = Math.min(slide, slides - 1)
  const visible = tokens.slice(
    safeSlide * SLIDE_SIZE,
    safeSlide * SLIDE_SIZE + SLIDE_SIZE
  )

  return (
    <div className={styles.carousel}>
      <div className={styles.slide}>
        {visible.map((token) => {
          const labels = hiddenLabels(token)
          return labels.length ? (
            <div key={token.token_id} className={styles.hidden_tile}>
              <Button
                shadow_box
                onClick={() =>
                  setRevealed((r) => new Set(r).add(token.token_id))
                }
              >
                Show {labels.join(' / ')}
              </Button>
            </div>
          ) : (
            <Link key={token.token_id} to={`/objkt/${token.token_id}`}>
              <img
                className={styles.thumb}
                src={thumbUrl(token)}
                alt={token.name}
                loading="lazy"
              />
            </Link>
          )
        })}
      </div>
      {/* Always rendered so every card is the same height. */}
      <div className={styles.controls}>
        {slides > 1 ? (
          <>
            <button
              type="button"
              onClick={() => setSlide((i) => (i - 1 + slides) % slides)}
              aria-label="Previous creations"
            >
              ‹
            </button>
            <span>
              {safeSlide + 1} / {slides}
            </span>
            <button
              type="button"
              onClick={() => setSlide((i) => (i + 1) % slides)}
              aria-label="Next creations"
            >
              ›
            </button>
          </>
        ) : (
          <span>&nbsp;</span>
        )}
      </div>
    </div>
  )
}

export default function ArtistsPage() {
  // Each entry is the (cursor, excluded artists) pair that produced a page;
  // the last entry is the current page. Previous just pops.
  const [history, setHistory] = useState([{ before: null, exclude: [] }])
  const current = history[history.length - 1]
  const { data, error } = useArtistsPage(current.before, current.exclude)
  const page = history.length - 1

  const [showPhotosensitive, setShowPhotosensitive] = useState(false)
  const [showNsfw, setShowNsfw] = useState(false)
  const { photosensitiveMap, nsfwMap } = useSettings()
  const filters = [
    {
      label: 'Photosensitive',
      active: !showPhotosensitive,
      hide: (token) =>
        photosensitiveMap.get(token.token_id) === 1 ||
        token.teia_meta?.accessibility?.hazards?.includes(
          METADATA_ACCESSIBILITY_HAZARDS_PHOTOSENS
        ),
    },
    {
      label: 'NSFW',
      active: !showNsfw,
      hide: (token) =>
        nsfwMap.get(token.token_id) === 1 ||
        token.teia_meta?.content_rating === METADATA_CONTENT_RATING_MATURE,
    },
  ]

  const nextPage = () => {
    setHistory((h) => [
      ...h,
      {
        before: data.cursor,
        exclude: [...current.exclude, ...data.artists.map((a) => a.address)],
      },
    ])
    window.scrollTo(0, 0)
  }
  const prevPage = () => {
    setHistory((h) => h.slice(0, -1))
    window.scrollTo(0, 0)
  }

  // At the bottom, scrolling down slides a hint bar in proportionally;
  // once it is fully extended, advance to the next page.
  const [pull, setPull] = useState(0) // 0..1
  const pullRef = useRef(0)
  const nextRef = useRef(nextPage)
  nextRef.current = nextPage
  const hasMore = data?.hasMore
  useEffect(() => {
    if (!hasMore) return
    // Total wheel travel needed, and a per-tick cap so smooth-scroll momentum
    // (one huge delta) can't fill the bar in a single event.
    const PULL_PX = 900
    const TICK_MAX = 120
    // Tolerance covers the hint bar's own height as it expands.
    const atBottom = () =>
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - HINT_PX - 2
    const update = (v) => {
      pullRef.current = v
      setPull(v)
    }
    const onWheel = (e) => {
      if (!atBottom() || e.deltaY <= 0) return update(0)
      const next = Math.min(
        1,
        pullRef.current + Math.min(e.deltaY, TICK_MAX) / PULL_PX
      )
      update(next === 1 ? 0 : next)
      if (next === 1) nextRef.current()
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [hasMore])

  return (
    <Page title="Artists">
      <Container>
        <div className={styles.page}>
          <h1 className={styles.heading}>Artists</h1>
          <p className={styles.subheading}>
            Artists by most recent mint, with their latest creations.
          </p>

          <div className={styles.controls}>
            <Checkbox
              checked={showPhotosensitive}
              onCheck={setShowPhotosensitive}
              label="Show photosensitive creations"
            />
            <Checkbox
              checked={showNsfw}
              onCheck={setShowNsfw}
              label="Show NSFW creations"
            />
          </div>

          {error && <p className={styles.empty}>Error: {error.message}</p>}
          {!data && !error && (
            <div className={styles.loading}>
              <Loading message="Loading artists" />
            </div>
          )}

          {data && (
            <div className={styles.grid}>
              {data.artists.map((artist) => (
                <div key={artist.address} className={styles.card}>
                  <div className={styles.header}>
                    <Identicon
                      className={styles.identicon}
                      address={artist.address}
                      logo={artist.identicon}
                    />
                    <div className={styles.info}>
                      <Link
                        className={styles.name}
                        to={`/${encodeURIComponent(artist.name)}`}
                      >
                        {artist.name}
                      </Link>
                      <p className={styles.description}>{artist.description}</p>
                    </div>
                  </div>
                  <Carousel tokens={artist.tokens} filters={filters} />
                </div>
              ))}
            </div>
          )}

          {data && (page > 0 || data.hasMore) && (
            <div className={styles.pager}>
              <Button small disabled={page === 0} onClick={prevPage}>
                Previous
              </Button>
              <span className={styles.pageInfo}>Page {page + 1}</span>
              <Button small disabled={!data.hasMore} onClick={nextPage}>
                Next
              </Button>
            </div>
          )}
          <div className={styles.hint} style={{ height: pull * HINT_PX }}>
            <div
              className={styles.hint_progress}
              style={{ width: `${pull * 100}%` }}
            />
            <span>Scroll for next page</span>
          </div>
        </div>
      </Container>
    </Page>
  )
}
