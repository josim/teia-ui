import { useEffect, useRef, useState } from 'react'
import styles from './index.module.scss'

const DEFAULT_COLOR = '#f0f0f0'

function getBannerTextColor(hex) {
  const value = hex?.replace('#', '')
  if (!value || value.length !== 6) return '#191919'

  const [r, g, b] = [0, 2, 4].map((offset) =>
    parseInt(value.slice(offset, offset + 2), 16)
  )
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#191919' : '#ffffff'
}

function makeId() {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
  return `event-${Date.now()}`
}

function normalizeUrl(value) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

const TEIA_SEARCH_URL = 'https://teia.art/search?term='

function searchTermFromLink(link) {
  if (!link?.startsWith(TEIA_SEARCH_URL)) return ''
  return decodeURIComponent(link.slice(TEIA_SEARCH_URL.length))
}

function initialDraft(event) {
  const searchTerm = searchTermFromLink(event?.link)

  return {
    id: event?.id || makeId(),
    title: event?.title || '',
    subtitle: event?.subtitle || '',
    description: event?.description || '',
    linkMode: searchTerm ? 'search' : 'url',
    link: searchTerm ? '' : event?.link || '',
    searchTerm,
    screenshot: event?.screenshot || '',
    bannerColor: event?.bannerColor || DEFAULT_COLOR,
  }
}

export default function EventEditorDialog({ event, onClose, onSave }) {
  const dialogRef = useRef(null)
  const [draft, setDraft] = useState(() => initialDraft(event))
  const [expanded, setExpanded] = useState(Boolean(event?.link))
  const [hasPreviewed, setHasPreviewed] = useState(Boolean(event?.link))
  const [previewState, setPreviewState] = useState('idle')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined

    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  const validLink =
    draft.linkMode === 'search'
      ? draft.searchTerm.trim() &&
        `${TEIA_SEARCH_URL}${encodeURIComponent(draft.searchTerm.trim())}`
      : normalizeUrl(draft.link)
  const textColor = getBannerTextColor(draft.bannerColor)

  const update = (field) => (eventValue) => {
    setDraft((current) => ({ ...current, [field]: eventValue }))
    if (field === 'link' || field === 'searchTerm') setPreviewState('idle')
  }

  const openPreview = () => {
    if (!validLink) return
    setExpanded(true)
    setHasPreviewed(true)
    setPreviewState('loading')
  }

  const save = (submitEvent) => {
    submitEvent.preventDefault()
    if (!draft.title.trim() || !validLink) return
    const { linkMode, searchTerm, ...event } = draft
    onSave({ ...event, title: draft.title.trim(), link: validLink })
  }

  const textFields = (
    <>
      <label className={styles.field}>
        <span>Title</span>
        <input
          value={draft.title}
          onChange={(event) => update('title')(event.target.value)}
          placeholder="Event title"
          required
        />
      </label>
      <label className={styles.field}>
        <span>Subtitle</span>
        <textarea
          value={draft.subtitle}
          onChange={(event) => update('subtitle')(event.target.value)}
          placeholder="A short description"
          rows={3}
        />
      </label>
      <label className={styles.field}>
        <span>Description</span>
        <textarea
          value={draft.description}
          onChange={(event) => update('description')(event.target.value)}
          placeholder="What is this event about?"
          rows={4}
        />
      </label>
      {hasPreviewed && (
        <label className={styles.color_field}>
          <span>Banner Color</span>
          <input
            type="color"
            value={draft.bannerColor}
            onChange={(event) => update('bannerColor')(event.target.value)}
            title="Choose banner color"
          />
        </label>
      )}
      <div className={styles.field}>
        <div className={styles.link_mode}>
          <span>Link</span>
          <div className={styles.switcher} role="group" aria-label="Link type">
            <button
              type="button"
              className={draft.linkMode === 'url' ? styles.switcher_active : ''}
              onClick={() => update('linkMode')('url')}
            >
              URL
            </button>
            <button
              type="button"
              className={
                draft.linkMode === 'search' ? styles.switcher_active : ''
              }
              onClick={() => update('linkMode')('search')}
            >
              Teia search
            </button>
          </div>
        </div>
        {draft.linkMode === 'search' ? (
          <input
            value={draft.searchTerm}
            onChange={(event) => update('searchTerm')(event.target.value)}
            placeholder="objkt4objkt"
            aria-label="Teia search term"
            required
          />
        ) : (
          <input
            type="url"
            value={draft.link}
            onChange={(event) => update('link')(event.target.value)}
            placeholder="https://example.com"
            aria-label="Event link"
            required
          />
        )}
        {draft.linkMode === 'url' ? (
          <span className={styles.link_warning}>
            Not all websites will work as iframes
          </span>
        ) : (
          validLink && <span className={styles.link_preview}>{validLink}</span>
        )}
      </div>
      <label className={styles.field}>
        <span>Screenshot URL</span>
        <input
          type="url"
          value={draft.screenshot}
          onChange={(event) => update('screenshot')(event.target.value)}
          placeholder="https://example.com/screenshot.png"
        />
      </label>
    </>
  )

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.dialog} ${expanded ? styles.dialog_expanded : ''}`}
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault()
        onClose()
      }}
    >
      <form className={styles.dialog_panel} onSubmit={save}>
        {!expanded ? (
          <>
            <div className={styles.dialog_header}>
              <h2 className={styles.dialog_title}>Event Form</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close event editor"
              >
                ×
              </button>
            </div>
            <div className={styles.dialog_form}>
              {textFields}
              <p className={styles.helper}>
                Add the event website, then open its preview to choose the
                banner color.
              </p>
              <div className={styles.dialog_actions}>
                <button type="button" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={openPreview}
                  disabled={!validLink}
                >
                  Open preview
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.expanded_layout}>
            <aside className={styles.sidebar}>
              <div className={styles.sidebar_header}>
                <h2 className={styles.dialog_title}>Event details</h2>
                <button
                  type="button"
                  className={styles.details_toggle}
                  onClick={() => setExpanded(false)}
                >
                  Edit Details
                </button>
              </div>
              <div className={styles.sidebar_body}>{textFields}</div>
              <div
                className={`${styles.sidebar_footer} ${styles.dialog_actions}`}
              >
                <button type="button" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!draft.title.trim() || !validLink}
                >
                  Submit Event
                </button>
              </div>
            </aside>
            <div className={styles.preview_pane}>
              <div
                className={styles.dialog_header}
                style={{ backgroundColor: draft.bannerColor, color: textColor }}
              >
                <div className={styles.dialog_summary}>
                  <h2 className={styles.display_title}>
                    {draft.title || 'Add title'}
                  </h2>
                  <p className={styles.display_subtitle}>
                    {draft.subtitle || 'Add subtitle'}
                  </p>
                  {draft.description && (
                    <p className={styles.display_description}>
                      {draft.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close event editor"
                >
                  ×
                </button>
              </div>
              {validLink ? (
                <iframe
                  src={validLink}
                  title={`${draft.title || 'Event'} website preview`}
                  className={styles.iframe}
                  onLoad={() => setPreviewState('ready')}
                />
              ) : (
                <div className={styles.preview_error}>
                  {draft.linkMode === 'search'
                    ? 'Enter a Teia search term to preview it.'
                    : 'Enter a valid website link to preview it.'}
                </div>
              )}
              {previewState === 'loading' && (
                <p className={styles.preview_status}>Loading preview…</p>
              )}
            </div>
          </div>
        )}
      </form>
    </dialog>
  )
}
