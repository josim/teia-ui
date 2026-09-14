import useSWR from 'swr'
import { EVENTS_API_PATH, fetchEvents } from '@data/events/api'

/** Read the normalized events feed through the same SWR boundary as calendar. */
export function useEvents() {
  const { data, error, mutate } = useSWR(EVENTS_API_PATH, fetchEvents)

  return {
    events: data ?? [],
    error,
    isLoading: !data && !error,
    refresh: mutate,
  }
}
