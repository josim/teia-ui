// SWR hooks for curations.

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import useSWRInfinite from 'swr/infinite'
import {
  fetchAllCurations,
  fetchCuration,
  fetchCurationsAdmin,
  fetchCurationsByOwner,
  fetchCurationsPage,
  fetchV1CurationsForMigration,
} from './api'
import type { CurationOrder } from './api'
import { fetchCurationContent } from './ipfs'
import { useGateRoles, useUserProfiles } from '@data/roles'
import type { Curation, CurationContent, CurationUserRoles, V1Curation } from './types'

export const CURATIONS_PAGE_SIZE = 24

export const curationsPageKey = (order: CurationOrder, index: number) =>
  `curations:page:${order}:${index}`

/** Public curations with "load more" pagination. */
export function useCurationsInfinite(order: CurationOrder = 'desc') {
  const { data, error, size, setSize } = useSWRInfinite<Curation[]>(
    (index, prev) =>
      prev && prev.length < CURATIONS_PAGE_SIZE
        ? null
        : curationsPageKey(order, index),
    (key: string) => {
      const index = Number(key.split(':')[3])
      return fetchCurationsPage({
        offset: index * CURATIONS_PAGE_SIZE,
        limit: CURATIONS_PAGE_SIZE,
        order,
      })
    },
    { revalidateOnFocus: false, revalidateFirstPage: false, dedupingInterval: 15_000 }
  )

  const pages = data ?? []
  const curations = pages.flat()
  const isLoadingInitial = !data && !error
  const isLoadingMore =
    isLoadingInitial || (size > 0 && !!data && typeof data[size - 1] === 'undefined')
  const reachedEnd =
    !!data && data.length > 0 && data[data.length - 1].length < CURATIONS_PAGE_SIZE

  return {
    curations,
    error,
    isLoadingInitial,
    isLoadingMore,
    reachedEnd,
    loadMore: () => setSize(size + 1),
  }
}

/** A single curation by id. */
export function useCuration(id: number | undefined) {
  const { data, error, mutate } = useSWR<Curation | null>(
    id == null || Number.isNaN(id) ? null : ['curations:one', id],
    () => fetchCuration(id as number),
    { revalidateOnFocus: false }
  )
  return {
    curation: data ?? undefined,
    error,
    isLoading: data === undefined && !error,
    mutate,
  }
}

/** Moderation console list (latest, including hidden + moderated). */
export function useCurationsAdmin() {
  const { data, error, mutate } = useSWR<Curation[]>(
    'curations:admin',
    fetchCurationsAdmin,
    { revalidateOnFocus: false }
  )
  return { curations: data ?? [], error, isLoading: !data && !error, mutate }
}

/** The synced wallet's v1 curations + which ones already exist on v2. */
export function useV1Migration(address: string | undefined) {
  const { data, error, mutate } = useSWR<V1Curation[]>(
    address ? ['curations:v3-migration', address] : null,
    () => fetchV1CurationsForMigration(address as string),
    { revalidateOnFocus: false }
  )
  const curations = data ?? []
  return {
    curations,
    pending: curations.filter((c) => c.migratedTo == null),
    error,
    isLoading: address ? !data && !error : false,
    mutate,
  }
}

/** Curations owned by `address` */
export function useCurationsByOwner(
  address: string | undefined,
  includeHidden = false
) {
  const { data, error, mutate } = useSWR<Curation[]>(
    address ? ['curations:owner', address, includeHidden] : null,
    () => fetchCurationsByOwner(address as string, includeHidden),
    { revalidateOnFocus: false }
  )
  return {
    curations: data ?? [],
    error,
    isLoading: address ? !data && !error : false,
    mutate,
  }
}

export function useCurationContent(cid: string | undefined) {
  return useSWR<CurationContent>(
    cid ? `curations:content:${cid}` : null,
    () => fetchCurationContent(cid as string),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )
}

/** Current user's curation capabilities (moderator / multisig). */
export function useCurationRoles(address: string | undefined): {
  data?: CurationUserRoles
} {
  const { data } = useGateRoles(address)
  return {
    data: data && {
      isModerator: data.isModerator,
      isMultisig: data.isMultisig,
      canModerate: data.canModerate,
      canCreate: Boolean(address),
    },
  }
}

const docPromiseCache = new Map<string, Promise<CurationContent | null>>()
function loadCurationDoc(cid: string): Promise<CurationContent | null> {
  let p = docPromiseCache.get(cid)
  if (!p) {
    p = fetchCurationContent(cid).catch(() => null)
    docPromiseCache.set(cid, p)
  }
  return p
}

/**
 * Client-side search over the public curations.  
 * title/description/tags/owner-name live in IPFS.
 */
export function useCurationSearch(query: string, order: CurationOrder = 'desc') {
  const q = query.trim().toLowerCase()
  const active = q.length > 0

  const { data: all, error } = useSWR<Curation[]>(
    active ? ['curations:all', order] : null,
    () => fetchAllCurations(order),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  )

  const cidSig = useMemo(
    () => (all ? [...new Set(all.map((c) => c.cid))].sort().join(',') : ''),
    [all]
  )

  const [docs, setDocs] = useState<Map<string, CurationContent | null>>(new Map())
  const [loaded, setLoaded] = useState(0)

  useEffect(() => {
    if (!cidSig) return
    let cancelled = false
    const cids = cidSig.split(',')
    setLoaded(0)
    const acc = new Map<string, CurationContent | null>()
    let idx = 0
    let done = 0
    const CONCURRENCY = 8
    const pump = () => {
      if (cancelled || idx >= cids.length) return
      const cid = cids[idx++]
      loadCurationDoc(cid).then((doc) => {
        if (cancelled) return
        acc.set(cid, doc)
        done += 1
        setLoaded(done)
        if (done === cids.length) setDocs(new Map(acc))
        pump()
      })
    }
    for (let k = 0; k < Math.min(CONCURRENCY, cids.length); k++) pump()
    return () => {
      cancelled = true
    }
  }, [cidSig])

  const owners = useMemo(
    () => (all ? [...new Set(all.map((c) => c.owner))] : []),
    [all]
  )
  const { data: profiles = {} } = useUserProfiles(owners)

  const results = useMemo(() => {
    if (!active || !all || docs.size === 0) return []
    return all.filter((c) => {
      const doc = docs.get(c.cid)
      const hay = [
        doc?.title,
        doc?.description,
        (doc?.tags || []).join(' '),
        c.owner,
        profiles[c.owner]?.alias,
        String(c.id),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [active, all, docs, profiles, q])

  const total = all?.length ?? 0
  const isLoading = active && (!all || (total > 0 && docs.size === 0))

  return { results, error, isLoading, progress: { loaded, total } }
}
