import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Page } from '@atoms/layout'
import { Loading } from '@atoms/loading'
import EventEditorDialog from '@components/events/EventEditorDialog'
import Tour, { TourLink } from '@components/tour'
import { useEvents } from '@hooks/use-events'
import styles from './index.module.scss'

function getBannerTextColor(hex) {
  const value = hex?.replace('#', '')
  if (!value || value.length !== 6) return '#191919'

  const [r, g, b] = [0, 2, 4].map((offset) =>
    parseInt(value.slice(offset, offset + 2), 16)
  )
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#191919' : '#ffffff'
}

// The form's own steps live in EventEditorDialog (it opens as a modal, above
// anything rendered here).
const EVENTS_TOUR = [
  {
    target: 'add-event',
    text: 'Click "+ Add event" to open the event form.',
    next: false,
    align: 'right',
  },
]

/**
 * Events page backed by the normalized GET /events feed. The request is
 * currently mocked in the data layer while the backend endpoint is developed.
 */
export default function Events() {
  const [editingEvent, setEditingEvent] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [localEvents, setLocalEvents] = useState([])
  const dialogRef = useRef(null)
  const { events, error, isLoading } = useEvents()
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    setLocalEvents(events)
  }, [events])

  useEffect(() => {
    if (!selectedEvent) return undefined

    const dialog = dialogRef.current
    dialog?.showModal()

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        dialog?.close()
        setSelectedEvent(null)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      if (dialog?.open) dialog.close()
    }
  }, [selectedEvent])

  const saveEvent = (event) => {
    setLocalEvents((current) => {
      const existing = current.findIndex((item) => item.id === event.id)
      if (existing === -1) return [...current, event]
      return current.map((item, index) => (index === existing ? event : item))
    })
    setEditingEvent(null)
    // Submitting finishes the add-event tour.
    if (params.get('tour') === 'events') {
      params.delete('tour')
      setParams(params)
    }
  }

  return (
    <Page title="Events">
      {!editingEvent && <Tour name="events" steps={EVENTS_TOUR} />}
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.header_top}>
            <h1 className={styles.headline}>Events</h1>
            <div className={styles.header_actions}>
              <button
                type="button"
                data-tour="add-event"
                onClick={() => setEditingEvent({})}
              >
                + Add event
              </button>
              <TourLink name="events" title="How to add an event" />
            </div>
          </div>
          <p className={styles.intro}>
            Teia community events, initiatives, and announcements.
          </p>
        </header>

        {!isLoading && !error && (
          <div className={styles.event_list}>
            {localEvents.map((event) => (
              <article className={styles.event_card} key={event.id}>
                <div className={styles.card_content}>
                  <div className={styles.card_copy}>
                    <h2>{event.title}</h2>
                    <p className={styles.subtitle}>{event.subtitle}</p>
                    <p>{event.description}</p>
                    <a href={event.link} target="_blank" rel="noreferrer">
                      Visit event site ↗
                    </a>
                  </div>
                  <button
                    type="button"
                    className={styles.preview}
                    onClick={() => setSelectedEvent(event)}
                    aria-label={`Preview ${event.title}`}
                  >
                    <img src={event.screenshot} alt="" loading="lazy" />
                    <span>Preview</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {error && (
          <p className={styles.error} role="alert">
            Could not load events: {error.message}
          </p>
        )}

        {isLoading && <Loading message="Loading events" />}
      </div>

      {selectedEvent && (
        <dialog
          ref={dialogRef}
          className={styles.dialog}
          onCancel={() => setSelectedEvent(null)}
        >
          <div className={styles.dialog_panel}>
            <div
              className={styles.dialog_header}
              style={{
                backgroundColor: selectedEvent.bannerColor,
                color: getBannerTextColor(selectedEvent.bannerColor),
              }}
            >
              <div className={styles.dialog_summary}>
                <h2>{selectedEvent.title}</h2>
                <p>{selectedEvent.subtitle}</p>
                <span>{selectedEvent.description}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                aria-label="Close preview"
                style={{ color: getBannerTextColor(selectedEvent.bannerColor) }}
              >
                ×
              </button>
            </div>
            <iframe
              src={selectedEvent.link}
              title={`${selectedEvent.title} preview`}
              className={styles.iframe}
            />
          </div>
        </dialog>
      )}

      {editingEvent && (
        <EventEditorDialog
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={saveEvent}
        />
      )}
    </Page>
  )
}
