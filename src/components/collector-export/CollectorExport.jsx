import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { validateAddress, ValidationResult } from '@taquito/utils'
import { Button } from '@atoms/button'
import { SimpleInput } from '@atoms/input'
import { Identicon } from '@atoms/identicons'
import { useUserProfiles } from '@data/roles'
import {
  fetchArtistSales,
  fetchArtistHolders,
  applyFilters,
} from '@data/collector-export'
import {
  toCSV,
  toJSON,
  downloadFile,
  copyToClipboard,
} from '@utils/export-file'
import styles from './CollectorExport.module.scss'

const WALLETS_KEY = (address) => `teia:collector-export:wallets:${address}`

const loadWallets = (address) => {
  try {
    const raw = localStorage.getItem(WALLETS_KEY(address))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const SALES_DISPLAY = [
  { key: 'address', header: 'address' },
  { key: 'name', header: 'name' },
  { key: 'editions_bought', header: 'editions' },
  { key: 'tez_spent', header: 'tez_spent' },
  { key: 'token_ids', header: 'token' },
  { key: 'first_purchase', header: 'first_purchase' },
  { key: 'last_purchase', header: 'last_purchase' },
]

const SALES_DOWNLOAD = [
  { key: 'address', header: 'address' },
  { key: 'name', header: 'name' },
  { key: 'editions_bought', header: 'editions_bought' },
  { key: 'tez_spent', header: 'tez_spent' },
  { key: 'distinct_tokens', header: 'distinct_tokens' },
  { key: 'token_ids', header: 'token_ids' },
  { key: 'first_purchase', header: 'first_purchase' },
  { key: 'last_purchase', header: 'last_purchase' },
]

const HOLDERS_DISPLAY = [
  { key: 'address', header: 'address' },
  { key: 'name', header: 'name' },
  { key: 'editions_held', header: 'editions' },
  { key: 'token_ids', header: 'tokens' },
]

const HOLDERS_DOWNLOAD = [
  { key: 'address', header: 'address' },
  { key: 'name', header: 'name' },
  { key: 'editions_held', header: 'editions_held' },
  { key: 'distinct_tokens', header: 'distinct_tokens' },
  { key: 'token_ids', header: 'token_ids' },
]

// Rows rendered in the on-screen preview, full list on the export
// To be adjusted, showing all results might be too long
const PREVIEW = 100

const SORTS = {
  sales: [
    { key: 'tez_spent', label: 'Tez spent' },
    { key: 'editions_bought', label: 'Editions bought' },
  ],
  holders: [
    { key: 'editions_held', label: 'Editions held' },
    { key: 'distinct_tokens', label: 'Distinct tokens' },
  ],
}

const num = (v) => {
  if (v === '' || v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

const parseTokenIds = (s) =>
  s
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)

/**
 * Export panel shown at the top of the Activity tab.
 */
export default function CollectorExport({ artistAddress }) {
  const [open, setOpen] = useState(false)

  const [wallets, setWallets] = useState(() => loadWallets(artistAddress))
  const [walletInput, setWalletInput] = useState('')
  const [walletError, setWalletError] = useState('')

  const [basis, setBasis] = useState('sales')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [market, setMarket] = useState('both')
  const [tokenIds, setTokenIds] = useState('')
  const [minTez, setMinTez] = useState('')
  const [maxTez, setMaxTez] = useState('')
  const [minEditions, setMinEditions] = useState('')
  const [maxEditions, setMaxEditions] = useState('')
  const [limit, setLimit] = useState('')
  const [sortKey, setSortKey] = useState('tez_spent')

  const [rows, setRows] = useState(null)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const artists = useMemo(
    () => [artistAddress, ...wallets],
    [artistAddress, wallets]
  )

  const displayColumns = basis === 'holders' ? HOLDERS_DISPLAY : SALES_DISPLAY
  const downloadColumns =
    basis === 'holders' ? HOLDERS_DOWNLOAD : SALES_DOWNLOAD

  // Fetch Avatars
  const visibleAddresses = useMemo(
    () => (rows ? rows.slice(0, PREVIEW).map((r) => r.address) : []),
    [rows]
  )
  const { data: profiles = {} } = useUserProfiles(visibleAddresses)

  const renderCell = (col, row) => {
    switch (col.key) {
      case 'address':
        return (
          <span className={styles.identity}>
            <Identicon
              address={row.address}
              logo={profiles[row.address]?.logo}
              className={styles.avatar}
            />
            <Link to={`/tz/${row.address}`} className={styles.link}>
              {row.address}
            </Link>
          </span>
        )
      case 'name':
        return row.name ? (
          <Link to={`/tz/${row.address}`} className={styles.link}>
            {row.name}
          </Link>
        ) : (
          ''
        )
      case 'token_ids': {
        const ids = row.token_ids
          ? row.token_ids.split(' ').filter(Boolean)
          : []
        return ids.map((id, i) => (
          <Fragment key={id}>
            {i > 0 && ' '}
            <Link to={`/objkt/${id}`} className={styles.link}>
              #{id}
            </Link>
          </Fragment>
        ))
      }
      case 'first_purchase':
      case 'last_purchase': {
        const ophash =
          col.key === 'first_purchase'
            ? row.first_purchase_ophash
            : row.last_purchase_ophash
        return ophash ? (
          <a
            href={`https://tzkt.io/${ophash}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            {row[col.key]}
          </a>
        ) : (
          String(row[col.key] ?? '')
        )
      }
      default:
        return String(row[col.key] ?? '')
    }
  }

  const persistWallets = (next) => {
    setWallets(next)
    try {
      localStorage.setItem(WALLETS_KEY(artistAddress), JSON.stringify(next))
    } catch {
      /* ignore quota / private-mode failures */
    }
  }

  const addWallet = () => {
    const addr = walletInput.trim()
    if (!addr) return
    if (validateAddress(addr) !== ValidationResult.VALID) {
      setWalletError('Not a valid tz / KT address')
      return
    }
    if (addr === artistAddress || wallets.includes(addr)) {
      setWalletError('Wallet already included')
      return
    }
    persistWallets([...wallets, addr])
    setWalletInput('')
    setWalletError('')
  }

  const removeWallet = (addr) =>
    persistWallets(wallets.filter((w) => w !== addr))

  const changeBasis = (next) => {
    setBasis(next)
    setSortKey(SORTS[next][0].key)
    setRows(null)
  }

  const generate = async () => {
    setLoading(true)
    setError('')
    setCopied(false)
    setProgress(0)
    try {
      const ids = parseTokenIds(tokenIds)
      const fetched =
        basis === 'holders'
          ? await fetchArtistHolders({
              artists,
              tokenIds: ids,
              onProgress: setProgress,
            })
          : await fetchArtistSales({
              artists,
              tokenIds: ids,
              // Parse the date-picker values in local time and span the full
              // end day (start-of-day `from` … end-of-day `to`), so the range
              // matches what the artist selected instead of UTC midnight.
              from: from
                ? new Date(`${from}T00:00:00`).toISOString()
                : undefined,
              to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
              market,
              onProgress: setProgress,
            })

      const filtered = applyFilters(fetched, {
        sortKey,
        minTez: basis === 'sales' ? num(minTez) : undefined,
        maxTez: basis === 'sales' ? num(maxTez) : undefined,
        minEditions: num(minEditions),
        maxEditions: num(maxEditions),
        limit: num(limit),
        basis,
      })

      // Round tez to token precision for a clean export.
      const clean = filtered.map((r) =>
        r.tez_spent != null
          ? { ...r, tez_spent: Number(r.tez_spent.toFixed(6)) }
          : r
      )
      setRows(clean)
    } catch (e) {
      setError(e?.message || 'Failed to load collectors')
      setRows(null)
    } finally {
      setLoading(false)
    }
  }

  const filename = (ext) => `teia-collectors-${basis}.${ext}`

  const exportCSV = () =>
    downloadFile(
      filename('csv'),
      toCSV(rows, downloadColumns),
      'text/csv;charset=utf-8'
    )
  const exportJSON = () =>
    downloadFile(
      filename('json'),
      toJSON(rows, downloadColumns),
      'application/json'
    )
  const copy = async () => {
    const ok = await copyToClipboard(toCSV(rows, downloadColumns))
    setCopied(ok)
    setError(
      ok ? '' : 'Couldn’t copy to clipboard — use CSV/JSON export instead.'
    )
  }

  if (!open) {
    return (
      <div className={styles.panel}>
        <button className={styles.header} onClick={() => setOpen(true)}>
          Export collectors ▾
        </button>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <button className={styles.header} onClick={() => setOpen(false)}>
        Export collectors ▴
      </button>

      <div className={styles.body}>
        {/* Wallets */}
        <fieldset className={styles.group}>
          <legend>Wallets</legend>
          <div className={styles.chips}>
            <span className={styles.chip}>{artistAddress} (this profile)</span>
            {wallets.map((w) => (
              <span key={w} className={styles.chip}>
                {w}
                <button
                  className={styles.chipRemove}
                  onClick={() => removeWallet(w)}
                  aria-label={`Remove ${w}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div className={styles.walletAdd}>
            <SimpleInput
              type="text"
              placeholder="Add another wallet (tz… / KT…)"
              value={walletInput}
              onChange={(v) => {
                setWalletInput(v)
                setWalletError('')
              }}
            />
            <Button small onClick={addWallet}>
              Add
            </Button>
          </div>
          {walletError && <p className={styles.error}>{walletError}</p>}
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Report</legend>
          <label className={styles.field}>
            <span>Basis</span>
            <select value={basis} onChange={(e) => changeBasis(e.target.value)}>
              <option value="sales">Sales (who bought)</option>
              <option value="holders">Holders snapshot (who owns now)</option>
            </select>
          </label>

          {basis === 'sales' && (
            <>
              <label className={styles.field}>
                <span>From</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>To</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Market</span>
                <select
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                >
                  <option value="both">Primary + secondary</option>
                  <option value="primary">Primary only</option>
                  <option value="secondary">Secondary only</option>
                </select>
              </label>
            </>
          )}

          <label className={styles.field}>
            <span>Token IDs</span>
            <input
              type="text"
              placeholder="optional, e.g. 12345 67890"
              value={tokenIds}
              onChange={(e) => setTokenIds(e.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Refine</legend>
          {basis === 'sales' && (
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Min tez</span>
                <input
                  type="number"
                  min="0"
                  value={minTez}
                  onChange={(e) => setMinTez(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Max tez</span>
                <input
                  type="number"
                  min="0"
                  value={maxTez}
                  onChange={(e) => setMaxTez(e.target.value)}
                />
              </label>
            </div>
          )}
          <div className={styles.row}>
            <label className={styles.field}>
              <span>Min editions</span>
              <input
                type="number"
                min="0"
                value={minEditions}
                onChange={(e) => setMinEditions(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Max editions</span>
              <input
                type="number"
                min="0"
                value={maxEditions}
                onChange={(e) => setMaxEditions(e.target.value)}
              />
            </label>
          </div>
          <div className={styles.row}>
            <label className={styles.field}>
              <span>Sort by</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              >
                {SORTS[basis].map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Top N</span>
              <input
                type="number"
                min="1"
                placeholder="all"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <div className={styles.actions}>
          <Button shadow_box onClick={generate} disabled={loading}>
            {loading ? 'Loading…' : 'Generate'}
          </Button>
        </div>

        {loading && (
          <div className={styles.progress}>
            <span>Fetching… {progress.toLocaleString()} rows</span>
            <div className={styles.progressBar} />
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {rows && (
          <div className={styles.result}>
            <div className={styles.resultHead}>
              <span>
                {rows.length} collector{rows.length === 1 ? '' : 's'}
              </span>
              <div className={styles.exports}>
                <Button small onClick={exportCSV} disabled={!rows.length}>
                  CSV
                </Button>
                <Button small onClick={exportJSON} disabled={!rows.length}>
                  JSON
                </Button>
                <Button small onClick={copy} disabled={!rows.length}>
                  {copied ? 'Copied ✓' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {displayColumns.map((c) => (
                      <th key={c.key}>{c.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, PREVIEW).map((r) => (
                    <tr key={r.address}>
                      {displayColumns.map((c) => (
                        <td key={c.key}>{renderCell(c, r)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > PREVIEW && (
                <p className={styles.more}>
                  Showing first {PREVIEW} of {rows.length} — export for the full
                  list.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
