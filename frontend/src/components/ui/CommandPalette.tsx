import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search, Users, FileText, Calendar, DollarSign, ArrowRight, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useNavigate } from 'react-router-dom'
import { useSearch } from '../../services/queries'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

type ResultType = 'patient' | 'claim' | 'visit' | 'payment'

interface SearchResult {
  id: string
  type: ResultType
  title: string
  subtitle?: string
  path: string
}

const typeConfig: Record<ResultType, { icon: React.ElementType; label: string; color: string }> = {
  patient: { icon: Users,      label: 'Patient', color: 'text-[#007998]' },
  claim:   { icon: FileText,   label: 'Claim',   color: 'text-[#0410BD]' },
  visit:   { icon: Calendar,   label: 'Visit',   color: 'text-[#676687]' },
  payment: { icon: DollarSign, label: 'Payment', color: 'text-[#047857]' },
}

const quickActions = [
  { label: 'New Visit', path: '/visits/new', icon: Calendar },
  { label: 'Patients',  path: '/patients',   icon: Users },
  { label: 'Claims',    path: '/claims',     icon: FileText },
  { label: 'Payments',  path: '/payments',   icon: DollarSign },
]

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const { data: searchData, isLoading } = useSearch(query)

  const results: SearchResult[] = searchData?.results ?? []

  const items: Array<{ id: string; title: string; path: string; type?: ResultType; subtitle?: string }> =
    query.length >= 2
      ? results
      : quickActions.map((a) => ({ id: a.path, type: undefined, title: a.label, path: a.path }))

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const selectItem = useCallback(
    (item: { path: string }) => {
      navigate(item.path)
      onClose()
    },
    [navigate, onClose],
  )

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((i) => Math.min(i + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = items[selectedIdx]
        if (item) selectItem(item)
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, items, selectedIdx, selectItem, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-[#E3E3F1] w-full max-w-lg overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E3E3F1]">
          {isLoading
            ? <Loader2 size={18} className="text-[#676687] animate-spin flex-shrink-0" />
            : <Search size={18} className="text-[#676687] flex-shrink-0" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0) }}
            placeholder="Search patients, claims, visits…"
            className="flex-1 text-sm text-[#12122C] outline-none placeholder-[#BABACE] bg-transparent"
          />
          <kbd className="text-xs text-[#BABACE] bg-[#F2F2F8] px-1.5 py-0.5 rounded font-mono">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {items.length === 0 && query.length >= 2 && (
            <div className="py-8 text-center text-sm text-[#676687]">No results for "{query}"</div>
          )}
          {!query && (
            <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#676687]">
              Quick Actions
            </p>
          )}
          {query.length >= 2 && results.length > 0 && (
            <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#676687]">
              Results
            </p>
          )}
          {items.map((item, idx) => {
            const cfg = item.type ? typeConfig[item.type] : null
            const Icon = cfg?.icon ?? ArrowRight
            return (
              <button
                key={item.id ?? idx}
                onClick={() => selectItem(item)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                  idx === selectedIdx ? 'bg-[#EFF0FF]' : 'hover:bg-[#F2F2F8]',
                )}
              >
                <span className={clsx('flex-shrink-0', cfg?.color ?? 'text-[#676687]')}>
                  <Icon size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#12122C] truncate">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-xs text-[#676687] truncate">{item.subtitle}</p>
                  )}
                </div>
                {cfg && (
                  <span className="text-xs text-[#BABACE] flex-shrink-0">{cfg.label}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
