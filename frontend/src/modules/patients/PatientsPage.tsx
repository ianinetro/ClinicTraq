import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, X, Calendar, Hash } from 'lucide-react'
import { format } from 'date-fns'
import { PageHeader } from '../../components/shell/PageHeader'
import { Table, type ColumnDef } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { usePatients } from '../../services/queries'
import type { Patient } from '../../types'

// Normalise a DOB partial to something the backend search can handle.
// "5/6" → "05/06", "5/6/2025" → "05/06/2025", raw text passes through.
function normaliseDob(v: string): string {
  const parts = v.split('/')
  if (parts.length >= 2 && parts.every(p => /^\d{0,4}$/.test(p))) {
    return parts.map((p, i) => (i < 2 && p.length === 1 ? p.padStart(2, '0') : p)).join('/')
  }
  return v
}

function isDobish(v: string) {
  return /^\d{1,2}(\/(\d{0,2}(\/\d{0,4})?)?)?$/.test(v.trim())
}

export function PatientsPage() {
  const navigate = useNavigate()

  // inputValue  = what the user is currently typing (drives suggestions)
  // committedSearch = what the table actually queries (set on enter / suggestion pick)
  const [inputValue, setInputValue] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Suggestions query — fires after 1 char
  const suggestionQuery = inputValue.trim().length >= 1
  const { data: suggestData, isFetching: suggestFetching } = usePatients({
    search: suggestionQuery ? (isDobish(inputValue) ? normaliseDob(inputValue) : inputValue) : undefined,
    page: 1,
    pageSize: 8,
    enabled: suggestionQuery,
  })
  const suggestions = suggestData?.items ?? []

  // Table query — only when committed
  const tableEnabled = committedSearch.trim().length >= 1
  const { data, isLoading, error } = usePatients({
    search: tableEnabled ? (isDobish(committedSearch) ? normaliseDob(committedSearch) : committedSearch) : undefined,
    page,
    pageSize: 25,
    enabled: tableEnabled,
  })

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const commit = useCallback((val: string) => {
    setCommittedSearch(val)
    setPage(1)
    setShowSuggestions(false)
    setActiveIdx(-1)
  }, [])

  function handleInputChange(v: string) {
    setInputValue(v)
    setShowSuggestions(v.trim().length >= 1)
    setActiveIdx(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions) {
      if (e.key === 'Enter') commit(inputValue)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        navigate(`/patients/${suggestions[activeIdx].id}`)
      } else {
        commit(inputValue)
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  function clear() {
    setInputValue('')
    setCommittedSearch('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const columns: ColumnDef<Patient>[] = [
    {
      id: 'accountNumber',
      header: 'Account #',
      width: '110px',
      cell: (row) => (
        <span className="text-sm font-mono text-[--bb-text-secondary]">{row.accountNumber}</span>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      cell: (row) => (
        <span className="text-sm font-medium text-[--bb-text-primary]">
          {row.firstName} {row.lastName}
        </span>
      ),
    },
    {
      id: 'dob',
      header: 'Date of Birth',
      cell: (row) => (
        <span className="text-sm tabular-nums text-[--bb-text-secondary]">
          {row.dateOfBirth ? format(new Date(row.dateOfBirth), 'MM/dd/yyyy') : '—'}
        </span>
      ),
    },
    {
      id: 'insurance',
      header: 'Insurance',
      cell: (_row) => <span className="text-sm text-[--bb-text-secondary]">—</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      id: 'actions',
      header: '',
      width: '80px',
      cell: (row) => (
        <Button
          size="xs"
          variant="secondary"
          onClick={(e) => { e.stopPropagation(); navigate(`/patients/${row.id}`) }}
        >
          View
        </Button>
      ),
    },
  ]

  const hasResults = tableEnabled && !isLoading

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Patients"
        description="Search and manage patient records"
        primaryAction={{
          label: 'New Patient',
          icon: <Plus size={15} />,
          onClick: () => navigate('/patients/new'),
        }}
      />

      {/* Search bar — always visible, never moves */}
      <div style={{ position: 'relative', maxWidth: 480 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bb-surface-card)',
          border: '1px solid var(--bb-border)',
          borderRadius: 8,
          padding: '0 12px',
          boxShadow: showSuggestions && suggestions.length ? 'var(--bb-shadow-md)' : undefined,
        }}>
          <Search size={15} style={{ color: 'var(--bb-text-secondary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={inputValue}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => inputValue.trim().length >= 1 && setShowSuggestions(true)}
            placeholder="Search by name, DOB (MM/DD/YYYY), MRN, or account #…"
            autoComplete="off"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 14, color: 'var(--bb-text-primary)', padding: '10px 0',
            }}
          />
          {suggestFetching && inputValue && (
            <div style={{
              width: 14, height: 14, border: '2px solid var(--bb-border)',
              borderTopColor: 'var(--bb-brand-blue)', borderRadius: '50%',
              animation: 'spin 0.6s linear infinite', flexShrink: 0,
            }} />
          )}
          {inputValue && (
            <button
              onClick={clear}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--bb-text-secondary)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)',
              borderRadius: 8, boxShadow: 'var(--bb-shadow-md)', zIndex: 50,
              overflow: 'hidden',
            }}
          >
            {suggestions.map((p, i) => (
              <button
                key={p.id}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={e => { e.preventDefault(); navigate(`/patients/${p.id}`) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '9px 14px', background: activeIdx === i ? 'var(--bb-surface-app)' : 'none',
                  border: 'none', borderTop: i > 0 ? '1px solid var(--bb-border)' : 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--bb-brand-blue)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {(p.firstName?.[0] ?? '').toUpperCase()}{(p.lastName?.[0] ?? '').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.firstName} {p.lastName}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)', display: 'flex', gap: 10, marginTop: 1 }}>
                    {p.dateOfBirth && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Calendar size={11} />
                        {format(new Date(p.dateOfBirth), 'MM/dd/yyyy')}
                      </span>
                    )}
                    {p.accountNumber && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Hash size={11} />
                        {p.accountNumber}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, padding: '2px 6px', borderRadius: 4,
                  background: 'var(--bb-surface-app)', color: 'var(--bb-text-secondary)',
                  border: '1px solid var(--bb-border)', flexShrink: 0,
                }}>
                  {p.status}
                </span>
              </button>
            ))}
            {/* See all results row */}
            <button
              onMouseDown={e => { e.preventDefault(); commit(inputValue) }}
              style={{
                width: '100%', padding: '9px 14px', background: activeIdx === suggestions.length ? 'var(--bb-surface-app)' : 'var(--bb-surface-app)',
                border: 'none', borderTop: '1px solid var(--bb-border)', cursor: 'pointer',
                fontSize: 13, color: 'var(--bb-brand-blue)', fontWeight: 500, textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Search size={13} />
              See all results for "{inputValue}"
              {suggestData?.total != null && suggestData.total > 8 && (
                <span style={{ color: 'var(--bb-text-secondary)', fontWeight: 400 }}>
                  — {suggestData.total} matches
                </span>
              )}
            </button>
          </div>
        )}

        {/* No suggestions hint */}
        {showSuggestions && !suggestFetching && inputValue.trim().length >= 1 && suggestions.length === 0 && (
          <div
            ref={dropdownRef}
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)',
              borderRadius: 8, boxShadow: 'var(--bb-shadow-md)', zIndex: 50,
              padding: '14px 16px', fontSize: 13, color: 'var(--bb-text-secondary)',
            }}
          >
            No patients match "{inputValue}"
            {isDobish(inputValue) && (
              <div style={{ marginTop: 4, fontSize: 12 }}>
                Tip: enter dates as MM/DD/YYYY — e.g. 5/6/2025 or just 05 for May birthdays
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results table */}
      {tableEnabled ? (
        <Table<Patient>
          columns={columns}
          data={data?.items ?? []}
          loading={isLoading}
          error={error ? 'Failed to load patients.' : undefined}
          total={data?.total ?? 0}
          page={page}
          pageSize={25}
          onPageChange={setPage}
          onRowClick={(row) => navigate(`/patients/${row.id}`)}
          getRowId={(row) => row.id}
          emptyTitle={`No patients found for "${committedSearch}"`}
          emptyDescription="Try a different name, DOB, MRN, or account number."
        />
      ) : (
        !hasResults && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '64px 0', gap: 12,
            color: 'var(--bb-text-secondary)',
          }}>
            <Search size={36} style={{ opacity: 0.3 }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--bb-text-primary)', marginBottom: 4 }}>Find a Patient</div>
              <div style={{ fontSize: 13 }}>Search by name, date of birth, MRN, or account number</div>
            </div>
            <Button variant="primary" leftIcon={<Plus size={15} />} onClick={() => navigate('/patients/new')}>
              New Patient
            </Button>
          </div>
        )
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
