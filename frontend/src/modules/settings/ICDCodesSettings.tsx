import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, BookOpen } from 'lucide-react'
import { Input } from '../../components/ui/Input'
import { apiClient } from '../../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface IcdCode {
  code: string
  description: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-t border-[--bb-border]">
          <td className="px-4 py-3">
            <div className="h-4 w-20 rounded bg-[#E0E0EF] animate-pulse" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-72 rounded bg-[#E0E0EF] animate-pulse" />
          </td>
          <td className="px-4 py-3">
            <div className="h-6 w-14 rounded bg-[#E0E0EF] animate-pulse" />
          </td>
        </tr>
      ))}
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ICDCodesSettings() {
  const [inputValue, setInputValue] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const debouncedQuery = useDebounce(inputValue.trim(), 300)
  const isReady = debouncedQuery.length >= 2

  const { data: results = [], isFetching } = useQuery<IcdCode[]>({
    queryKey: ['icd10-search', debouncedQuery],
    queryFn: async () => {
      const res = await apiClient.get<IcdCode[]>('/icd10/search', {
        params: { q: debouncedQuery, limit: 100 },
      })
      return res.data
    },
    enabled: isReady,
    staleTime: 1000 * 60 * 5,
  })

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 1500)
    })
  }

  const showSkeleton = isReady && isFetching && results.length === 0
  const showEmpty = isReady && !isFetching && results.length === 0
  const showResults = isReady && results.length > 0

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF0FF]">
          <BookOpen size={18} className="text-[--bb-brand-blue]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[--bb-brand-ink]">Diagnosis Codes (ICD-10)</h2>
          <p className="mt-0.5 text-sm text-[--bb-text-secondary]">
            Search the ICD-10-CM code set to look up diagnosis codes for claims and visit documentation.
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="max-w-lg">
        <Input
          placeholder="Search by code or description (e.g. E11, diabetes)…"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          prefix={<Search size={15} className="text-[--bb-text-secondary]" />}
          autoFocus
        />
      </div>

      {/* Results table */}
      <div className="rounded-lg border border-[--bb-border] bg-[--bb-surface-card] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="bg-[--bb-surface-app]">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[--bb-text-secondary] w-32">
                  Code
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[--bb-text-secondary]">
                  Description
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[--bb-text-secondary] w-24">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--bb-border]">
              {showSkeleton && <SkeletonRows />}

              {!isReady && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-[--bb-text-secondary]">
                      <Search size={22} className="opacity-40" />
                      <span className="text-sm">Type to search ICD-10 codes</span>
                      <span className="text-xs text-[--bb-text-secondary] opacity-70">
                        Enter at least 2 characters to begin
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {showEmpty && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-[--bb-text-secondary]">
                      <BookOpen size={22} className="opacity-40" />
                      <span className="text-sm">No codes found for &ldquo;{debouncedQuery}&rdquo;</span>
                      <span className="text-xs opacity-70">Try a different term or code prefix</span>
                    </div>
                  </td>
                </tr>
              )}

              {showResults &&
                results.map(item => (
                  <tr key={item.code} className="hover:bg-[--bb-surface-app] transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-bold text-sm text-[--bb-brand-blue]">
                        {item.code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-[--bb-text-primary]">
                      {item.description}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleCopy(item.code)}
                        className="h-6 px-2 rounded text-xs font-medium border border-[--bb-border] bg-transparent text-[--bb-text-secondary] hover:border-[--bb-brand-blue] hover:text-[--bb-brand-blue] hover:bg-[#EFF0FF] transition-colors"
                      >
                        {copiedCode === item.code ? 'Copied!' : 'Copy'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {showResults && (
          <div className="px-4 py-2 border-t border-[--bb-border] bg-[--bb-surface-app] text-xs text-[--bb-text-secondary]">
            {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{debouncedQuery}&rdquo;
          </div>
        )}
      </div>
    </div>
  )
}
