import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, X, Calendar, Hash } from 'lucide-react'
import { format } from 'date-fns'
import { Table, type ColumnDef } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { usePatients } from '../../services/queries'
import type { Patient } from '../../types'

function isDobish(v: string) {
  return /^\d{1,2}(\/(\d{0,2}(\/\d{0,4})?)?)?$/.test(v.trim())
}
function normaliseDob(v: string): string {
  const parts = v.split('/')
  if (parts.length >= 2 && parts.every(p => /^\d{0,4}$/.test(p))) {
    return parts.map((p, i) => (i < 2 && p.length === 1 ? p.padStart(2, '0') : p)).join('/')
  }
  return v
}

export function PatientsPage() {
  const navigate = useNavigate()
  const [inputValue, setInputValue] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const searchTerm = inputValue.trim().length >= 1
    ? (isDobish(inputValue) ? normaliseDob(inputValue) : inputValue)
    : undefined

  const { data: suggestData, isFetching: suggestFetching } = usePatients({
    search: searchTerm,
    page: 1,
    pageSize: 8,
    enabled: inputValue.trim().length >= 1,
  })
  const suggestions = suggestData?.items ?? []

  const committedTerm = committedSearch.trim().length >= 1
    ? (isDobish(committedSearch) ? normaliseDob(committedSearch) : committedSearch)
    : undefined

  const { data, isLoading, error } = usePatients({
    search: committedTerm,
    page,
    pageSize: 25,
    enabled: committedSearch.trim().length >= 1,
  })

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setShowSuggestions(false)
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
    // Live-update table too
    setCommittedSearch(v)
    setPage(1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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
        setShowSuggestions(false)
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
      cell: (row) => <span className="text-sm font-mono text-[--bb-text-secondary]">{row.accountNumber}</span>,
    },
    {
      id: 'name',
      header: 'Name',
      cell: (row) => (
        <span className="text-sm font-medium text-[--bb-text-primary]">{row.firstName} {row.lastName}</span>
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

  const hasSearch = committedSearch.trim().length >= 1

  const searchBox = (
    <div style={{ position: 'relative', maxWidth: 440 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bb-surface-card)',
        border: '1px solid var(--bb-border)',
        borderRadius: 8,
        padding: '0 12px',
      }}>
        <Search size={15} style={{ color: 'var(--bb-text-secondary)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={inputValue}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue.trim().length >= 1 && setShowSuggestions(true)}
          placeholder="Search by name, DOB, MRN, or account #…"
          autoComplete="off"
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 14, color: 'var(--bb-text-primary)', padding: '9px 0',
          }}
        />
        {suggestFetching && inputValue && (
          <div style={{
            width: 13, height: 13, border: '2px solid var(--bb-border)',
            borderTopColor: 'var(--bb-brand-blue)', borderRadius: '50%',
            animation: 'spin 0.6s linear infinite', flexShrink: 0,
          }} />
        )}
        {inputValue && (
          <button onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--bb-text-secondary)' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div ref={dropdownRef} style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)',
          borderRadius: 8, boxShadow: 'var(--bb-shadow-md)', zIndex: 50, overflow: 'hidden',
        }}>
          {suggestions.map((p, i) => (
            <button
              key={p.id}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={e => { e.preventDefault(); navigate(`/patients/${p.id}`) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 14px',
                background: activeIdx === i ? 'var(--bb-surface-app)' : 'none',
                border: 'none', borderTop: i > 0 ? '1px solid var(--bb-border)' : 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
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
                      <Calendar size={11} />{format(new Date(p.dateOfBirth), 'MM/dd/yyyy')}
                    </span>
                  )}
                  {p.accountNumber && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Hash size={11} />{p.accountNumber}
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
        </div>
      )}

      {showSuggestions && !suggestFetching && inputValue.trim().length >= 1 && suggestions.length === 0 && (
        <div ref={dropdownRef} style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)',
          borderRadius: 8, boxShadow: 'var(--bb-shadow-md)', zIndex: 50,
          padding: '14px 16px', fontSize: 13, color: 'var(--bb-text-secondary)',
        }}>
          No patients match "{inputValue}"
        </div>
      )}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bb-surface-app)' }}>
      {/* Sticky white header card */}
      <div style={{ background: 'var(--bb-surface-card)', borderBottom: '1px solid var(--bb-border)', padding: '28px 32px 0' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--bb-text-primary)', margin: 0 }}>Patients</h1>
              <p style={{ fontSize: 13, color: 'var(--bb-text-secondary)', marginTop: 4 }}>Search and manage patient records</p>
            </div>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus size={15} />}
              onClick={() => navigate('/patients/new')}
            >
              New Patient
            </Button>
          </div>
          {/* Search in header */}
          <div style={{ paddingBottom: 20 }}>
            {searchBox}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px' }}>
        <div style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <Table<Patient>
            columns={columns}
            data={data?.items ?? []}
            loading={isLoading && hasSearch}
            error={error ? 'Failed to load patients.' : undefined}
            total={data?.total ?? 0}
            page={page}
            pageSize={25}
            onPageChange={setPage}
            onRowClick={(row) => navigate(`/patients/${row.id}`)}
            getRowId={(row) => row.id}
            emptyTitle={hasSearch ? `No patients found for "${committedSearch}"` : 'Search to find patients'}
            emptyDescription={hasSearch ? 'Try a different name, DOB, MRN, or account number.' : 'Enter a name, date of birth, MRN, or account number above.'}
          />
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
