import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Search,
  Users,
  FileText,
  Calendar,
  DollarSign,
  Loader2,
  UserPlus,
  CalendarPlus,
  FilePlus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ClipboardList,
  Stethoscope,
  Building2,
  ArrowRight,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useNavigate } from 'react-router-dom'
import { useSearch } from '../../services/queries'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

type ResultType = 'patient' | 'claim' | 'visit' | 'payment' | 'provider' | 'payer'

interface SearchResult {
  id: string
  type: ResultType
  title: string
  subtitle?: string
  path: string
}

interface QuickAction {
  label: string
  path: string
  icon: React.ElementType
  description: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'New Patient',        path: '/patients/new',                   icon: UserPlus,      description: 'Register a patient' },
  { label: 'New Visit',          path: '/visits/new',                     icon: CalendarPlus,  description: 'Open an encounter' },
  { label: 'New Claim',          path: '/claims/new',                     icon: FilePlus,      description: 'Start a claim' },
  { label: 'Add Payment',        path: '/payments',                       icon: DollarSign,    description: 'Post a payment' },
  { label: 'Ready to Submit',    path: '/billing?tab=ready_to_submit',    icon: CheckCircle,   description: 'Claims awaiting send' },
  { label: 'Rejected Claims',    path: '/billing?tab=rejected',           icon: XCircle,       description: 'Review rejections' },
  { label: 'Unmatched ERA',      path: '/billing?tab=unmatched_era',      icon: AlertTriangle, description: 'ERA exceptions' },
  { label: 'Work Queue',         path: '/work-queue',                     icon: ClipboardList, description: 'Open task queue' },
]

const RECENT_KEY = 'ct_recent_nav'
const MAX_RECENT = 5

const TYPE_META: Record<ResultType, { icon: React.ElementType; label: string; colorClass: string; bgClass: string }> = {
  patient:  { icon: Users,        label: 'Patient',  colorClass: 'text-[--bb-status-info]',    bgClass: 'bg-[--bb-status-info-bg]' },
  visit:    { icon: Calendar,     label: 'Visit',    colorClass: 'text-[--bb-text-secondary]',  bgClass: 'bg-[--bb-surface-app]' },
  claim:    { icon: FileText,     label: 'Claim',    colorClass: 'text-[--bb-brand-blue]',      bgClass: 'bg-[--bb-surface-app]' },
  payment:  { icon: DollarSign,   label: 'Payment',  colorClass: 'text-[--bb-status-success]',  bgClass: 'bg-[--bb-status-success-bg]' },
  provider: { icon: Stethoscope,  label: 'Provider', colorClass: 'text-[--bb-status-warning]',  bgClass: 'bg-[--bb-status-warning-bg]' },
  payer:    { icon: Building2,    label: 'Payer',    colorClass: 'text-[--bb-text-secondary]',  bgClass: 'bg-[--bb-surface-app]' },
}

const GROUP_ORDER: ResultType[] = ['patient', 'visit', 'claim', 'payment', 'provider', 'payer']

const RESULT_PATHS: Record<ResultType, (id: string) => string> = {
  patient:  (id) => `/patients/${id}`,
  visit:    (id) => `/visits/${id}`,
  claim:    (id) => `/claims/${id}`,
  payment:  ()   => `/payments`,
  provider: ()   => `/settings/providers/rendering`,
  payer:    ()   => `/settings/payers`,
}

function getRecentNav(): Array<{ label: string; path: string }> {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  } catch {
    return []
  }
}

function pushRecentNav(label: string, path: string) {
  const existing = getRecentNav().filter((r) => r.path !== path)
  const next = [{ label, path }, ...existing].slice(0, MAX_RECENT)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

// ── Flat list of navigable items for keyboard indexing ──────────────────────
interface FlatItem {
  id: string
  label: string
  path: string
  kind: 'quick' | 'recent' | 'result'
  resultType?: ResultType
  subtitle?: string
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()

  const trimmed = query.trim()
  const isSearching = trimmed.length >= 2

  const { data: searchData, isLoading } = useSearch(isSearching ? trimmed : '')

  // Build grouped results from API response
  const rawResults: SearchResult[] = (searchData?.results ?? []).map((r: SearchResult) => ({
    ...r,
    path: RESULT_PATHS[r.type]?.(r.id) ?? `/${r.type}s/${r.id}`,
  }))

  const grouped: Map<ResultType, SearchResult[]> = new Map()
  for (const type of GROUP_ORDER) {
    const items = rawResults.filter((r) => r.type === type)
    if (items.length) grouped.set(type, items)
  }

  // Build flat list for keyboard nav
  const recentNav = getRecentNav()

  const flatItems: FlatItem[] = isSearching
    ? rawResults.map((r) => ({
        id: `result-${r.id}`,
        label: r.title,
        path: r.path,
        kind: 'result' as const,
        resultType: r.type,
        subtitle: r.subtitle,
      }))
    : [
        ...QUICK_ACTIONS.map((a) => ({
          id: `quick-${a.path}`,
          label: a.label,
          path: a.path,
          kind: 'quick' as const,
        })),
        ...recentNav.map((r) => ({
          id: `recent-${r.path}`,
          label: r.label,
          path: r.path,
          kind: 'recent' as const,
        })),
      ]

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelectedIdx(0)
  }, [trimmed])

  // Scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  const selectItem = useCallback(
    (item: FlatItem) => {
      pushRecentNav(item.label, item.path)
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
        setSelectedIdx((i) => Math.min(i + 1, flatItems.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = flatItems[selectedIdx]
        if (item) selectItem(item)
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, flatItems, selectedIdx, selectItem, onClose])

  if (!open) return null

  // ── flat index counter for keyboard highlight ──────────────────────────────
  let flatIdx = 0

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop — dark, no blur so the panel pops */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(10,10,26,0.72)' }}
        onClick={onClose}
      />

      {/* Panel — solid white, strong shadow, no transparency */}
      <div
        className="relative w-full max-w-[580px] overflow-hidden flex flex-col"
        style={{
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 48px rgba(4,16,189,0.18), 0 2px 12px rgba(0,0,0,0.14)',
          maxHeight: 'min(560px, 74vh)',
          border: '1px solid #d4d4e8',
        }}
      >
        {/* ── Search bar ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 flex-shrink-0" style={{ borderBottom: '1px solid #e8e8f0', padding: '14px 18px' }}>
          {isLoading
            ? <Loader2 size={18} className="animate-spin flex-shrink-0" style={{ color: '#0410BD' }} />
            : <Search size={18} className="flex-shrink-0" style={{ color: '#0410BD' }} />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients, claims, visits, providers…"
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 15, color: '#12122C', border: 'none' }}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="flex-shrink-0"
              style={{ background: '#f0f0f8', border: 'none', borderRadius: 6, padding: '2px 8px', fontSize: 12, color: '#6B6B8A', cursor: 'pointer' }}
              tabIndex={-1}
            >
              Clear
            </button>
          )}
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div ref={scrollRef} className="overflow-y-auto flex-1 min-h-0">

          {/* ── NO QUERY: Quick Actions + Recent ─────────────────────────── */}
          {!isSearching && (
            <>
              {/* Quick Actions — two-column rows */}
              <div style={{ padding: '10px 10px 4px' }}>
                <p style={{ padding: '0 8px 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9898b8' }}>
                  Quick Actions
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  {QUICK_ACTIONS.map((action) => {
                    const Icon = action.icon
                    const myIdx = flatIdx++
                    const isSelected = myIdx === selectedIdx
                    return (
                      <button
                        key={action.path}
                        ref={isSelected ? (selectedRef as React.RefObject<HTMLButtonElement>) : undefined}
                        onClick={() => selectItem({ id: `quick-${action.path}`, label: action.label, path: action.path, kind: 'quick' })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 12px', borderRadius: 8,
                          background: isSelected ? '#0410BD' : 'transparent',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f4f4fb' }}
                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <span style={{
                          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                          background: isSelected ? 'rgba(255,255,255,0.18)' : '#eeeeff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon size={14} style={{ color: isSelected ? '#fff' : '#0410BD' }} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: isSelected ? '#fff' : '#12122C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {action.label}
                          </div>
                          <div style={{ fontSize: 11, color: isSelected ? 'rgba(255,255,255,0.7)' : '#9898b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {action.description}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Recent navigation */}
              {recentNav.length > 0 && (
                <div className="px-3 pt-1 pb-2">
                  <p className="px-1 py-2 text-[11px] font-semibold uppercase tracking-widest text-[--bb-text-secondary]">
                    Recent
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {recentNav.map((item) => {
                      const myIdx = flatIdx++
                      const isSelected = myIdx === selectedIdx
                      return (
                        <button
                          key={item.path}
                          ref={isSelected ? (selectedRef as React.RefObject<HTMLButtonElement>) : undefined}
                          onClick={() => selectItem({ id: `recent-${item.path}`, label: item.label, path: item.path, kind: 'recent' })}
                          className={clsx(
                            'flex items-center gap-2.5 rounded-[--bb-radius-sm] px-2.5 py-2 text-left transition-colors',
                            isSelected ? 'bg-[--bb-surface-app]' : 'hover:bg-[--bb-surface-app]',
                          )}
                        >
                          <ArrowRight size={12} className="text-[--bb-text-secondary] flex-shrink-0" />
                          <span className="text-sm text-[--bb-text-primary] truncate">{item.label}</span>
                          <span className="ml-auto text-[11px] text-[--bb-text-secondary] truncate max-w-[140px]">{item.path}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {recentNav.length === 0 && (
                <div className="px-4 pb-3 pt-1 text-[12px] text-[--bb-text-secondary]">
                  Recent navigation will appear here.
                </div>
              )}
            </>
          )}

          {/* ── WITH QUERY: Grouped search results ───────────────────────── */}
          {isSearching && (
            <>
              {isLoading && (
                <div className="flex items-center justify-center py-10 gap-2 text-sm text-[--bb-text-secondary]">
                  <Loader2 size={16} className="animate-spin" />
                  Searching…
                </div>
              )}

              {!isLoading && rawResults.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-sm text-[--bb-text-secondary]">No results for <span className="text-[--bb-text-primary] font-medium">"{trimmed}"</span></p>
                  <p className="text-xs text-[--bb-text-secondary] mt-1">Try a patient name, claim ID, or DOS</p>
                </div>
              )}

              {!isLoading && rawResults.length > 0 && (
                <div className="py-1.5">
                  {GROUP_ORDER.map((type) => {
                    const items = grouped.get(type)
                    if (!items) return null
                    const meta = TYPE_META[type]
                    const Icon = meta.icon
                    return (
                      <div key={type}>
                        {/* Group header */}
                        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                          <Icon size={12} className={meta.colorClass} />
                          <span className="text-[11px] font-semibold uppercase tracking-widest text-[--bb-text-secondary]">
                            {meta.label}s
                          </span>
                          <span
                            className={clsx(
                              'ml-1 inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
                              meta.colorClass,
                              meta.bgClass,
                            )}
                          >
                            {items.length}
                          </span>
                        </div>

                        {/* Result rows */}
                        {items.map((result) => {
                          const myIdx = flatIdx++
                          const isSelected = myIdx === selectedIdx
                          return (
                            <button
                              key={result.id}
                              ref={isSelected ? (selectedRef as React.RefObject<HTMLButtonElement>) : undefined}
                              onClick={() =>
                                selectItem({
                                  id: `result-${result.id}`,
                                  label: result.title,
                                  path: result.path,
                                  kind: 'result',
                                  resultType: result.type,
                                  subtitle: result.subtitle,
                                })
                              }
                              className={clsx(
                                'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                                isSelected ? 'bg-[--bb-surface-app]' : 'hover:bg-[--bb-surface-app]',
                              )}
                            >
                              {/* Type icon spot */}
                              <span className={clsx('flex-shrink-0 w-7 h-7 rounded-[--bb-radius-sm] flex items-center justify-center', meta.bgClass)}>
                                <Icon size={13} className={meta.colorClass} />
                              </span>

                              {/* Title + subtitle */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[--bb-text-primary] truncate">{result.title}</p>
                                {result.subtitle && (
                                  <p className="text-[12px] text-[--bb-text-secondary] truncate">{result.subtitle}</p>
                                )}
                              </div>

                              {/* Type chip */}
                              <span
                                className={clsx(
                                  'flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
                                  meta.colorClass,
                                  meta.bgClass,
                                )}
                              >
                                {meta.label}
                              </span>

                              {/* Enter hint on selected */}
                              {isSelected && (
                                <span className="flex-shrink-0 text-[10px] text-[--bb-text-secondary] bg-[--bb-border] rounded px-1 py-0.5 font-mono">
                                  ↵
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-4 py-2 border-t border-[--bb-border] bg-[--bb-surface-app]">
          <div className="flex items-center gap-3 text-[11px] text-[--bb-text-secondary]">
            <span className="flex items-center gap-1">
              <kbd className="bg-[--bb-surface-card] border border-[--bb-border] rounded px-1 py-0.5 font-mono text-[10px]">↑</kbd>
              <kbd className="bg-[--bb-surface-card] border border-[--bb-border] rounded px-1 py-0.5 font-mono text-[10px]">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-[--bb-surface-card] border border-[--bb-border] rounded px-1 py-0.5 font-mono text-[10px]">↵</kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-[--bb-surface-card] border border-[--bb-border] rounded px-1 py-0.5 font-mono text-[10px]">esc</kbd>
              close
            </span>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-[--bb-text-secondary]">
            <kbd className="bg-[--bb-surface-card] border border-[--bb-border] rounded px-1 py-0.5 font-mono text-[10px]">Ctrl</kbd>
            <kbd className="bg-[--bb-surface-card] border border-[--bb-border] rounded px-1 py-0.5 font-mono text-[10px]">K</kbd>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
