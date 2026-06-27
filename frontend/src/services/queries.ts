import { useQuery } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

interface SearchResult {
  id: string
  type: 'patient' | 'claim' | 'visit' | 'payment'
  title: string
  subtitle?: string
  path: string
}

interface SearchResponse {
  results: SearchResult[]
}

async function fetchSearch(query: string): Promise<SearchResponse> {
  const token = localStorage.getItem('ct_token')
  const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => fetchSearch(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })
}
