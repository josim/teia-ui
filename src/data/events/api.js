import eventsResponse from './events.json'

export const EVENTS_API_PATH = '/events'

/** Mock GET /events until the backend endpoint is available. */
function mockEventsRequest(path) {
  if (path !== EVENTS_API_PATH) {
    return Promise.resolve(new Response(null, { status: 404 }))
  }

  return Promise.resolve(
    new Response(JSON.stringify(eventsResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

/**
 * Map one API event into the shape consumed by the events page.
 * Rows without the two fields required to identify and display a card are
 * ignored, matching the calendar feed's per-row normalization behavior.
 */
function mapEvent(item) {
  if (!item?.id || !item?.title) return null

  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle ?? '',
    description: item.description ?? '',
    link: item.link ?? '',
    screenshot: item.screenshot ?? '',
    bannerColor: item.bannerColor ?? '#f0f0f0',
  }
}

/**
 * Fetch and normalize GET /events.
 * Replace mockEventsRequest with fetch when the endpoint is available; the
 * hook and page can keep consuming the same mapped event array.
 */
export async function fetchEvents(path = EVENTS_API_PATH) {
  const response = await mockEventsRequest(path)
  if (!response.ok) {
    throw new Error(`Events API ${response.status} ${response.statusText}`)
  }

  const payload = await response.json()
  const events = Array.isArray(payload?.events) ? payload.events : []
  return events.map(mapEvent).filter(Boolean)
}
