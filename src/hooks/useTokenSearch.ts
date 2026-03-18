import { useState, useRef, useCallback } from 'react'
import { searchTokensForEmbed } from '@data/api'

interface TokenSearchResult {
  tokens: any[]
  artists: { user_address: string; name: string }[]
}

export function useTokenSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TokenSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [artistTokens, setArtistTokens] = useState<any[] | null>(null)
  const [selectedArtist, setSelectedArtist] = useState<{
    user_address: string
    name: string
  } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((q: string) => {
    setQuery(q)
    setArtistTokens(null)
    setSelectedArtist(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!q.trim()) {
        setResults(null)
        return
      }
      setLoading(true)
      try {
        setResults(await searchTokensForEmbed(q))
      } catch {
        setResults({ tokens: [], artists: [] })
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  const selectArtist = useCallback(
    async (artist: { user_address: string; name: string }) => {
      setLoading(true)
      setSelectedArtist(artist)
      try {
        const res = await searchTokensForEmbed(artist.user_address)
        setArtistTokens(res.tokens)
      } catch {
        setArtistTokens([])
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const clearArtist = useCallback(() => {
    setArtistTokens(null)
    setSelectedArtist(null)
  }, [])

  const reset = useCallback(() => {
    setQuery('')
    setResults(null)
    setArtistTokens(null)
    setSelectedArtist(null)
    setLoading(false)
  }, [])

  return {
    query,
    results,
    loading,
    artistTokens,
    selectedArtist,
    search,
    selectArtist,
    clearArtist,
    reset,
    tokensToShow: artistTokens || results?.tokens || [],
    artists: artistTokens ? [] : results?.artists || [],
  }
}
