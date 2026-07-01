import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, FileCode } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { apiClient } from '../../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CPTCode {
  code: string
  description: string
  work_rvu?: number
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CPTCodesSettings() {
  const { addToast } = useToast()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search input 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data: codes = [], isLoading } = useQuery<CPTCode[]>({
    queryKey: ['cpt-search', debouncedSearch],
    queryFn: async () => {
      const res = await apiClient.get<CPTCode[]>('/cpt/search', {
        params: { q: debouncedSearch, limit: 100 },
      })
      return res.data
    },
  })

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      addToast({ variant: 'success', message: `Copied: ${code}` })
    } catch {
      addToast({ variant: 'error', message: 'Failed to copy to clipboard.' })
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <FileCode size={20} className="text-[--bb-brand-blue]" />
          <h2 className="text-xl font-semibold text-[--bb-text-primary]">CPT Codes</h2>
        </div>
        <p className="text-sm text-[--bb-text-secondary] mt-1">
          Browse and search procedure codes (CPT) for use in visits and claims. Click "Use" to copy a code to clipboard.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[--bb-text-secondary] pointer-events-none"
        />
        <Input
          placeholder="Search by code or description…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Table */}
      <div className="bg-[--bb-surface-card] border border-[--bb-border] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-[--bb-surface-app]">
              <tr>
                {['Code', 'Description', 'Work RVU', 'Action'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[--bb-text-secondary] whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[--bb-border]">
              {isLoading ? (
                // Skeleton rows
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <div className="h-4 w-16 bg-[--bb-surface-app] rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-64 bg-[--bb-surface-app] rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-12 bg-[--bb-surface-app] rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-6 w-12 bg-[--bb-surface-app] rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : codes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-[--bb-text-secondary]">
                    No codes found{debouncedSearch ? ` for "${debouncedSearch}"` : ''}.
                  </td>
                </tr>
              ) : (
                codes.map(item => (
                  <tr key={item.code} className="hover:bg-[--bb-surface-app] transition-colors">
                    <td className="px-4 py-3 text-sm font-mono font-bold text-[--bb-text-primary] whitespace-nowrap">
                      {item.code}
                    </td>
                    <td className="px-4 py-3 text-sm text-[--bb-text-primary]">
                      {item.description}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-[--bb-text-secondary]">
                      {item.work_rvu != null ? item.work_rvu.toFixed(2) : (
                        <span className="text-[--bb-border]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleCopy(item.code)}
                      >
                        Use
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && codes.length > 0 && (
          <div className="px-4 py-2 border-t border-[--bb-border] bg-[--bb-surface-app] text-xs text-[--bb-text-secondary]">
            {codes.length} result{codes.length !== 1 ? 's' : ''}
            {debouncedSearch ? ` for "${debouncedSearch}"` : ''}
          </div>
        )}
      </div>
    </div>
  )
}
