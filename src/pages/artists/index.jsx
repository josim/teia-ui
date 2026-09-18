import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Page, Container } from '@atoms/layout'
import { Button } from '@atoms/button'
import { Loading } from '@atoms/loading'
import { Checkbox, Input } from '@atoms/input'
import Identicon from '@atoms/identicons'
import { HashToURL } from '@utils'
import { useArtistsPage, ARTIST_IMAGE_MIMES } from '@data/swr'
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
// First frame of a GIF without downloading the whole file. The CDN honours
// Range requests; we fetch roughly one byte per pixel (measured: 60/60 recent
// GIFs decode a complete first frame at that size), decode with the strict
// createImageBitmap so a partial frame never paints, and retry once at 4x.
const GIF_MIN_BYTES = 128 * 1024
const GIF_MAX_BYTES = 4 * 1024 * 1024
const GIF_THUMB_PX = 400 // canvas cap; native-size canvases x150 tiles blow GPU memory

// Decode a few GIFs at a time: each decoded frame is native size in memory,
// and 150 at once takes the tab down.
const GIF_CONCURRENCY = 4
let gifActive = 0
const gifQueue = []
function gifSlot() {
  return new Promise((resolve) => {
    const run = () => {
      gifActive++
      resolve(() => {
        gifActive--
        gifQueue.shift()?.()
      })
    }
    gifActive < GIF_CONCURRENCY ? run() : gifQueue.push(run)
  })
}

function gifHeadBytes(token) {
  const [w, h] = (token.formats?.[0]?.dimensions?.value || '0x0')
    .split('x')
    .map(Number)
  return Math.min(GIF_MAX_BYTES, Math.max(GIF_MIN_BYTES, w * h))
}

async function fetchGifFrame(url, bytes) {
  const res = await fetch(url, { headers: { Range: `bytes=0-${bytes - 1}` } })
  return createImageBitmap(await res.blob())
}

function GifThumb({ token, fallback }) {
  const ref = useRef(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let alive = true
    let release
    const url = HashToURL(token.display_uri)
    const head = gifHeadBytes(token)
    gifSlot()
      .then((r) => {
        release = r
        if (!alive) return null
        return fetchGifFrame(url, head).catch(() =>
          fetchGifFrame(url, Math.min(GIF_MAX_BYTES * 2, head * 4))
        )
      })
      .then((bm) => {
        if (!bm || !alive) return
        const scale = Math.min(1, GIF_THUMB_PX / Math.max(bm.width, bm.height))
        canvas.width = Math.round(bm.width * scale)
        canvas.height = Math.round(bm.height * scale)
        canvas.getContext('2d').drawImage(bm, 0, 0, canvas.width, canvas.height)
        bm.close()
      })
      .catch(() => alive && setFailed(true))
      .finally(() => release?.())
    return () => {
      alive = false
    }
  }, [token])
  if (failed) return fallback
  return <canvas ref={ref} className={styles.thumb} title={token.name} />
}

const FILETYPES = [
  { label: 'Image', mimes: ARTIST_IMAGE_MIMES },
  { label: 'GIF', mimes: ['image/gif'] },
  { label: 'Video', mimes: ['video/mp4', 'video/quicktime', 'video/webm'] },
  { label: 'Audio', mimes: ['audio/mpeg', 'audio/wav', 'audio/ogg'] },
  { label: 'SVG', mimes: ['image/svg+xml'] },
  { label: 'Interactive', mimes: ['application/x-directory'] },
  { label: 'PDF', mimes: ['application/pdf'] },
  { label: 'Text', mimes: ['text/plain', 'text/markdown'] },
]
const YEARS = Array.from(
  { length: new Date().getFullYear() - 2021 + 1 },
  (_, i) => 2021 + i
)
const LICENSES = [
  { label: 'None', value: 'none' },
  { label: 'CC BY', value: 'cc-by-4.0' },
  { label: 'CC BY-NC', value: 'cc-by-nc-4.0' },
  { label: 'CC BY-SA', value: 'cc-by-sa-4.0' },
]
const MARKETS = ['All', 'Primary', 'Secondary']
const EMPTY_FILTERS = {
  types: [],
  years: [],
  licenses: [],
  market: 'All',
  tag: '',
}

// Filter state -> Hasura tokens_bool_exp. Primary/secondary only narrows to
// "has an active listing" here; the seller split happens client-side.
function toBoolExp(f) {
  const and = []
  if (f.types.length)
    and.push({ mime_type: { _in: f.types.flatMap((t) => t.mimes) } })
  if (f.years.length)
    and.push({
      _or: f.years.map((y) => ({
        minted_at: { _gte: `${y}-01-01`, _lt: `${y + 1}-01-01` },
      })),
    })
  if (f.licenses.length) and.push({ rights: { _in: f.licenses } })
  if (f.market !== 'All') and.push({ listings: { status: { _eq: 'active' } } })
  if (f.tag) and.push({ tags: { tag: { _ilike: `%${f.tag}%` } } })
  return and.length ? { _and: and } : {}
}

const toggleIn = (list, item) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item]

function Chips({ options, selected, onToggle, labelOf = (o) => o }) {
  return (
    <div className={styles.chips}>
      {options.map((o) => (
        <button
          key={labelOf(o)}
          type="button"
          className={selected.includes(o) ? styles.chip_active : styles.chip}
          onClick={() => onToggle(o)}
        >
          {labelOf(o)}
        </button>
      ))}
    </div>
  )
}

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
          ) : ARTIST_IMAGE_MIMES.includes(token.mime_type) ? (
            <Link key={token.token_id} to={`/objkt/${token.token_id}`}>
              <img
                className={styles.thumb}
                src={thumbUrl(token)}
                alt={token.name}
                loading="lazy"
              />
            </Link>
          ) : token.mime_type === 'image/gif' ? (
            <Link key={token.token_id} to={`/objkt/${token.token_id}`}>
              <GifThumb
                token={token}
                fallback={<div className={styles.hidden_tile}>GIF</div>}
              />
            </Link>
          ) : (
            <Link
              key={token.token_id}
              to={`/objkt/${token.token_id}`}
              className={styles.hidden_tile}
            >
              {FILETYPES.find((t) => t.mimes.includes(token.mime_type))
                ?.label ?? token.mime_type}
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
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [applied, setApplied] = useState({ search: '', filters: {} })
  useEffect(() => {
    const t = setTimeout(() => {
      setApplied({ search: search.trim(), filters: toBoolExp(filters) })
      setHistory([{ before: null, exclude: [] }])
    }, 300)
    return () => clearTimeout(t)
  }, [search, filters])
  const { data, error } = useArtistsPage(
    current.before,
    current.exclude,
    applied.search,
    applied.filters
  )
  const setF = (key, value) => setFilters((f) => ({ ...f, [key]: value }))
  const activeCount =
    filters.types.length +
    filters.years.length +
    filters.licenses.length +
    (filters.market !== 'All') +
    (filters.tag ? 1 : 0)

  // Primary/secondary split needs a column compare Hasura can't do server-side.
  const marketFilter = (token) => {
    if (filters.market === 'All') return true
    const own = token.listings.some((l) => l.seller_address === token.artist)
    return filters.market === 'Primary' ? own : token.listings.length && !own
  }
  const page = history.length - 1

  const [showPhotosensitive, setShowPhotosensitive] = useState(false)
  const [showNsfw, setShowNsfw] = useState(false)
  const { photosensitiveMap, nsfwMap } = useSettings()
  const hazardFilters = [
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

          <Input
            className={styles.search}
            name="artist-search"
            value={search}
            onChange={setSearch}
            placeholder="Search artists by name"
            label="Search"
          />
          <div className={styles.filter_bar}>
            <Button small onClick={() => setShowFilters((v) => !v)}>
              {showFilters ? '▴' : '▾'} Filters
              {activeCount ? ` (${activeCount})` : ''}
            </Button>
            {activeCount > 0 && (
              <Button small onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear
              </Button>
            )}
          </div>
          {showFilters && (
            <div className={styles.filters}>
              <div className={styles.filter_row}>
                <span className={styles.filter_label}>Filetype</span>
                <Chips
                  options={FILETYPES}
                  selected={filters.types}
                  labelOf={(t) => t.label}
                  onToggle={(t) => setF('types', toggleIn(filters.types, t))}
                />
              </div>
              <div className={styles.filter_row}>
                <span className={styles.filter_label}>Year</span>
                <Chips
                  options={YEARS}
                  selected={filters.years}
                  labelOf={String}
                  onToggle={(y) => setF('years', toggleIn(filters.years, y))}
                />
              </div>
              <div className={styles.filter_row}>
                <span className={styles.filter_label}>License</span>
                <Chips
                  options={LICENSES.map((l) => l.value)}
                  selected={filters.licenses}
                  labelOf={(v) => LICENSES.find((l) => l.value === v).label}
                  onToggle={(v) =>
                    setF('licenses', toggleIn(filters.licenses, v))
                  }
                />
              </div>
              <div className={styles.filter_row}>
                <span className={styles.filter_label}>Market</span>
                <Chips
                  options={MARKETS}
                  selected={[filters.market]}
                  onToggle={(m) => setF('market', m)}
                />
              </div>
              <div className={styles.filter_row}>
                <span className={styles.filter_label}>Tag</span>
                <input
                  className={styles.tag_input}
                  value={filters.tag}
                  onChange={(e) =>
                    setF('tag', e.target.value.replace(/^#/, ''))
                  }
                  placeholder="e.g. glitch"
                />
              </div>
            </div>
          )}
          <div className={styles.toggles}>
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
                  <Carousel
                    tokens={artist.tokens
                      .map((t) => ({ ...t, artist: artist.address }))
                      .filter(marketFilter)}
                    filters={hazardFilters}
                  />
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
          <div
            className={styles.hint}
            style={{ height: pull > 0 ? HINT_PX : 0 }}
          >
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
