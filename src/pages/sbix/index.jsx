import { useState, useRef, useCallback } from 'react'
import { Page } from '@atoms/layout'
import { Button } from '@atoms/button'
import { Loading } from '@atoms/loading'
import styles from './index.module.scss'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
// In dev, use Vite proxy to avoid CORS. In prod, hit the API directly.
const SCAN_URL = import.meta.env.DEV
  ? '/api/sbix/scan-public'
  : 'https://certify.sbix.io/api/v1/scan-public'

const ALERT_COLORS = {
  EXACT_COPY: '#e53e3e',
  COPY: '#e53e3e',
  SIMILAR: '#d69e2e',
  ORIGINAL: '#38a169',
}

async function scanFile(file) {
  const form = new FormData()
  form.append('file', file)

  const resp = await fetch(SCAN_URL, { method: 'POST', body: form })

  if (!resp.ok) {
    throw new Error(`API returned ${resp.status}`)
  }

  const json = await resp.json()
  if (!json.success) {
    throw new Error('API returned success: false')
  }

  return json.data
}

export default function SbixTest() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const handleFile = useCallback((f) => {
    if (!f) return
    if (f.size > MAX_FILE_SIZE) {
      setError(`File too large (${(f.size / 1e6).toFixed(1)} MB). Max 5 MB.`)
      return
    }
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError(null)
  }, [])

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      const f = e.dataTransfer?.files?.[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  const handleScan = useCallback(async () => {
    if (!file || scanning) return
    setScanning(true)
    setError(null)
    setResult(null)

    try {
      const data = await scanFile(file)
      setResult(data)
    } catch (e) {
      setError(e.message || 'Scan failed')
    } finally {
      setScanning(false)
    }
  }, [file, scanning])

  const handleReset = useCallback(() => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  return (
    <Page title="SBIX Copy Detection Test">
      <div className={styles.container}>
        <h1 className={styles.headline}>SBIX Copy Detection</h1>
        <p className={styles.subtitle}>
          Upload an image to test the copy-detection API. Max 5 MB.
        </p>

        {/* Drop zone / file picker */}
        <div
          className={styles.dropzone}
          role="button"
          tabIndex={0}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
        >
          {preview ? (
            <img src={preview} alt="Preview" className={styles.preview} />
          ) : (
            <span>Drop an image here or click to select</span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        {file && (
          <div className={styles.fileInfo}>
            {file.name} ({(file.size / 1024).toFixed(0)} KB)
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          {file && (
            <>
              <Button shadow_box onClick={handleScan} disabled={scanning}>
                {scanning ? 'Scanning...' : 'Scan'}
              </Button>
              <Button shadow_box onClick={handleReset} disabled={scanning}>
                Clear
              </Button>
            </>
          )}
        </div>

        {scanning && <Loading message="Scanning image..." />}

        {error && <div className={styles.error}>{error}</div>}

        {/* Results */}
        {result && (
          <div className={styles.results}>
            <div className={styles.resultHeader}>
              <span
                className={styles.alertBadge}
                style={{ background: ALERT_COLORS[result.alert] || '#888' }}
              >
                {result.alert}
              </span>
              <span className={styles.similarity}>
                {result.similarity_percent}% similarity
              </span>
            </div>

            <div className={styles.dbSize}>
              Scanned against {result.db_size?.toLocaleString()} references
            </div>

            {result.matches?.length > 0 && (
              <div className={styles.matches}>
                <div className={styles.matchesTitle}>
                  Matches ({result.matches.length})
                </div>
                {result.matches.map((m, i) => (
                  <div key={i} className={styles.matchRow}>
                    <div className={styles.matchInfo}>
                      <span className={styles.matchFilename}>
                        {m.filename || 'Untitled'}
                      </span>
                      <span
                        className={styles.matchAlert}
                        style={{
                          color: ALERT_COLORS[m.alert] || '#888',
                        }}
                      >
                        {m.alert} &middot; {m.similarity_percent}%
                      </span>
                      <span className={styles.matchProof}>{m.proof_id}</span>
                    </div>
                    {m.verify_url && (
                      <a
                        href={m.verify_url}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.matchLink}
                      >
                        Verify
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Page>
  )
}
