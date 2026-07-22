import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import classnames from 'classnames'
import StatCard from '@pages/admin/StatCard'
import {
  useSalesEvents,
  useSalesRange,
  useSalesHistory,
  aggregateSales,
  stitchAllTime,
  filterSales,
  marketplaceOf,
  marketOf,
  HARD_CAP,
} from '@data/sales-stats'
import { toCSV, toJSON, downloadFile } from '@utils/export-file'
import Chart from './Chart'
import styles from '@style'

const PRIMARY_COLOR = '#e8871a'
const SECONDARY_COLOR = '#0891b2'

// Custom is still being finished.
const WINDOWS = [
  { key: 30, label: '30 days' },
  { key: 90, label: '90 days' },
  { key: 180, label: '6 months' },
  { key: 365, label: '12 months' },
  { key: 'all', label: 'All time', wip: true },
  { key: 'custom', label: 'Custom', wip: true },
]

const MARKETPLACES = [
  { key: 'all', label: 'All' },
  { key: 'teia', label: 'Teia + H=N' },
  { key: 'objkt', label: 'objkt.com' },
]

const WEEKLY_COLUMNS = [
  { key: 'week', header: 'week' },
  { key: 'primary_count', header: 'primary_count' },
  { key: 'primary_volume_tez', header: 'primary_volume_tez' },
  { key: 'secondary_count', header: 'secondary_count' },
  { key: 'secondary_volume_tez', header: 'secondary_volume_tez' },
]

const ROWS_COLUMNS = [
  { key: 'timestamp', header: 'timestamp' },
  { key: 'type', header: 'type' },
  { key: 'marketplace', header: 'marketplace' },
  { key: 'market', header: 'market' },
  { key: 'price_tez', header: 'price_tez' },
  { key: 'seller_address', header: 'seller_address' },
  { key: 'artist_address', header: 'artist_address' },
]

const formatTezVolume = (tez) => `${tez.toLocaleString()} ꜩ`

const todayISODate = () => new Date().toISOString().slice(0, 10)
const dayStartISO = (dateStr) => `${dateStr}T00:00:00.000Z`
const dayEndISO = (dateStr) => `${dateStr}T23:59:59.999Z`

export default function SalesSection() {
  const [windowKey, setWindowKey] = useState(365)
  const [marketplace, setMarketplace] = useState('all')

  const [fromDraft, setFromDraft] = useState('')
  const [toDraft, setToDraft] = useState(todayISODate())
  const [appliedRange, setAppliedRange] = useState(null)
  const [forceLoad, setForceLoad] = useState(false)
  const [progress, setProgress] = useState(null)
  const pendingAutoExportRef = useRef(null)

  const isCustom = windowKey === 'custom'
  const isAllTime = windowKey === 'all'
  const canApply =
    Boolean(fromDraft) && Boolean(toDraft) && fromDraft <= toDraft

  const preset = useSalesEvents({
    onProgress: setProgress,
    enabled: !isCustom,
  })
  const history = useSalesHistory()

  const rangeSince =
    isCustom && appliedRange ? dayStartISO(appliedRange.from) : undefined
  const rangeUntil =
    isCustom && appliedRange ? dayEndISO(appliedRange.to) : undefined
  const range = useSalesRange(rangeSince, rangeUntil, {
    force: forceLoad,
    onProgress: setProgress,
  })

  const since = useMemo(() => {
    if (isCustom) return rangeSince
    if (isAllTime) return undefined
    return new Date(Date.now() - windowKey * 24 * 60 * 60 * 1000).toISOString()
  }, [isCustom, isAllTime, rangeSince, windowKey])
  const until = isCustom ? rangeUntil : undefined

  const rangeTooMany =
    isCustom && range.data && 'tooMany' in range.data
      ? range.data.tooMany
      : null

  const sourceEvents = isCustom
    ? range.data && 'events' in range.data
      ? range.data.events
      : null
    : preset.data ?? null

  const data = useMemo(() => {
    if (isAllTime) {
      if (!history.data || !sourceEvents) return null
      return stitchAllTime(history.data, sourceEvents, marketplace)
    }
    if (!since || !sourceEvents) return null
    return aggregateSales(sourceEvents, { since, until, marketplace })
  }, [isAllTime, history.data, sourceEvents, since, until, marketplace])

  const buildRowsExport = useCallback(() => {
    if (isAllTime || !since || !sourceEvents) return []
    return filterSales(sourceEvents, { since, until, marketplace }).map(
      (e) => ({
        timestamp: e.timestamp,
        type: e.type,
        marketplace: marketplaceOf(e.type),
        market: marketOf(e),
        price_tez: Number(e.price ?? 0) / 1e6,
        seller_address: e.seller_address,
        artist_address: e.token?.artist_address ?? null,
      })
    )
  }, [isAllTime, sourceEvents, since, until, marketplace])

  const selectionFrom =
    isCustom && appliedRange
      ? appliedRange.from
      : isAllTime
      ? history.data?.since ?? ''
      : since?.slice(0, 10)
  const selectionTo =
    isCustom && appliedRange ? appliedRange.to : todayISODate()
  const marketplaceSuffix = marketplace !== 'all' ? `-${marketplace}` : ''
  const weeklyBase = `teia-sales-weekly-${selectionFrom}-${selectionTo}${marketplaceSuffix}`
  const rowsBase = `teia-sales-rows-${selectionFrom}-${selectionTo}${marketplaceSuffix}`

  const weeklyExportRows = data
    ? data.weekly.map((w) => ({
        week: w.week,
        primary_count: w.primaryCount,
        primary_volume_tez: w.primaryVolume,
        secondary_count: w.secondaryCount,
        secondary_volume_tez: w.secondaryVolume,
      }))
    : []

  useEffect(() => {
    if (data) setProgress(null)
  }, [data])

  useEffect(() => {
    const pending = pendingAutoExportRef.current
    if (pending && data && rangeTooMany == null) {
      if (pending.marketplace === marketplace) {
        downloadFile(
          `${rowsBase}.csv`,
          toCSV(buildRowsExport(), ROWS_COLUMNS),
          'text/csv'
        )
      }
      pendingAutoExportRef.current = null
    }
  }, [data, rangeTooMany, rowsBase, marketplace, buildRowsExport])

  const loadError = isCustom
    ? range.error
    : isAllTime
    ? preset.error || history.error
    : preset.error
  const isValidating = isCustom
    ? range.isValidating
    : isAllTime
    ? preset.isValidating || history.isValidating
    : preset.isValidating

  // A failed load invalidates any pending auto-export — otherwise a later
  // silent SWR recovery could fire an unprompted download.
  useEffect(() => {
    if (loadError) pendingAutoExportRef.current = null
  }, [loadError])

  const handleWindowClick = (key) => {
    setWindowKey(key)
    if (key !== 'custom') {
      setForceLoad(false)
      pendingAutoExportRef.current = null
    }
  }

  const handleMarketplaceClick = (key) => {
    pendingAutoExportRef.current = null
    setMarketplace(key)
  }

  const handleApply = () => {
    if (!canApply) return
    if (
      appliedRange &&
      appliedRange.from === fromDraft &&
      appliedRange.to === toDraft
    ) {
      return
    }
    pendingAutoExportRef.current = null
    setForceLoad(false)
    setProgress(null)
    setAppliedRange({ from: fromDraft, to: toDraft })
  }

  const handleLoadAnyway = () => {
    pendingAutoExportRef.current = null
    setProgress(null)
    setForceLoad(true)
  }

  const handleLoadAndExport = () => {
    pendingAutoExportRef.current = { marketplace }
    setProgress(null)
    setForceLoad(true)
  }

  const primaryShare =
    data && data.totalVolume > 0
      ? Math.round((data.primaryVolume / data.totalVolume) * 100)
      : 0

  return (
    <div className={styles.section}>
      <div className={styles.filter_rows}>
        <div className={styles.filter_row}>
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              className={classnames(styles.chip, {
                [styles.chip_active]: windowKey === w.key,
              })}
              disabled={w.wip}
              title={w.wip ? 'Coming soon' : undefined}
              onClick={() => handleWindowClick(w.key)}
            >
              {w.label}
            </button>
          ))}
        </div>

        {isCustom && (
          <div className={styles.filter_row}>
            <input
              type="date"
              className={styles.date_input}
              value={fromDraft}
              max={toDraft || undefined}
              onChange={(e) => setFromDraft(e.target.value)}
              aria-label="From date"
            />
            <span className={styles.muted}>to</span>
            <input
              type="date"
              className={styles.date_input}
              value={toDraft}
              min={fromDraft || undefined}
              onChange={(e) => setToDraft(e.target.value)}
              aria-label="To date"
            />
            <button
              type="button"
              className={styles.chip}
              disabled={!canApply}
              onClick={handleApply}
            >
              Apply
            </button>
          </div>
        )}

        <div className={styles.filter_row}>
          {MARKETPLACES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={classnames(styles.chip, {
                [styles.chip_active]: marketplace === m.key,
              })}
              onClick={() => handleMarketplaceClick(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {rangeTooMany != null && rangeTooMany > HARD_CAP ? (
        <p className={styles.muted}>
          About {rangeTooMany.toLocaleString()} sales in this range — too large
          to load in the browser. Narrow the range to under{' '}
          {HARD_CAP.toLocaleString()} sales.
        </p>
      ) : rangeTooMany != null ? (
        <>
          <p className={styles.muted}>
            About {rangeTooMany.toLocaleString()} sales in this range (~
            {Math.round((rangeTooMany * 190) / 1e6)} MB).
          </p>
          <div className={styles.filter_row}>
            <button
              type="button"
              className={styles.chip}
              onClick={handleLoadAnyway}
            >
              Load anyway
            </button>
            <button
              type="button"
              className={styles.chip}
              onClick={handleLoadAndExport}
            >
              Load & export CSV
            </button>
          </div>
        </>
      ) : !data ? (
        isCustom && !appliedRange ? (
          <p className={styles.muted}>Pick a date range and apply it.</p>
        ) : loadError && !isValidating ? (
          <p className={styles.muted}>Couldn’t load sales stats.</p>
        ) : (
          <p className={styles.muted}>
            Loading sales… {(progress ?? 0).toLocaleString()} rows
          </p>
        )
      ) : (
        <>
          <div className={styles.stats_grid}>
            <StatCard label="Sales" value={data.totalCount} />
            <StatCard
              label="Volume"
              value={formatTezVolume(data.totalVolume)}
            />
            <StatCard
              label="Primary share"
              value={`${primaryShare}%`}
              sublabel="of volume"
            />
          </div>

          <Chart
            title="Weekly volume (ꜩ)"
            data={data.weekly}
            xKey="week"
            series={[
              {
                key: 'primaryVolume',
                label: 'Primary',
                color: PRIMARY_COLOR,
              },
              {
                key: 'secondaryVolume',
                label: 'Secondary',
                color: SECONDARY_COLOR,
              },
            ]}
          />

          <Chart
            title="Weekly sales"
            data={data.weekly}
            xKey="week"
            series={[
              { key: 'primaryCount', label: 'Primary', color: PRIMARY_COLOR },
              {
                key: 'secondaryCount',
                label: 'Secondary',
                color: SECONDARY_COLOR,
              },
            ]}
          />

          <div className={styles.filter_row}>
            <span className={styles.muted}>Export</span>
            <button
              type="button"
              className={styles.chip}
              onClick={() =>
                downloadFile(
                  `${weeklyBase}.csv`,
                  toCSV(weeklyExportRows, WEEKLY_COLUMNS),
                  'text/csv'
                )
              }
            >
              Weekly CSV
            </button>
            <button
              type="button"
              className={styles.chip}
              onClick={() =>
                downloadFile(
                  `${weeklyBase}.json`,
                  toJSON(weeklyExportRows, WEEKLY_COLUMNS),
                  'application/json'
                )
              }
            >
              Weekly JSON
            </button>
            {!isAllTime && (
              <>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() =>
                    downloadFile(
                      `${rowsBase}.csv`,
                      toCSV(buildRowsExport(), ROWS_COLUMNS),
                      'text/csv'
                    )
                  }
                >
                  Rows CSV
                </button>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() =>
                    downloadFile(
                      `${rowsBase}.json`,
                      toJSON(buildRowsExport(), ROWS_COLUMNS),
                      'application/json'
                    )
                  }
                >
                  Rows JSON
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
