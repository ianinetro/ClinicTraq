import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, UserPlus, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { apiClient as api } from '../../services/api'

interface Patient {
  id: string
  mrn: string
  lastName: string
  firstName: string
  dob: string
  sex?: string
  gender?: string
  primaryInsurance: string
  balance: number
  status: 'active' | 'inactive'
  lastVisit?: string
  phone?: string
}

const PAGE_SIZE = 25

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

function calcAge(dob: string) {
  if (!dob) return ''
  const d = new Date(dob)
  const diff = Date.now() - d.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}

const MOCK_PATIENTS: Patient[] = [
  { id: '1', mrn: 'MRN-001234', lastName: 'Johnson', firstName: 'Mary', dob: '1975-03-12', sex: 'female', primaryInsurance: 'BlueCross PPO', balance: 125.00, status: 'active', lastVisit: '2026-06-26', phone: '(555) 210-3344' },
  { id: '2', mrn: 'MRN-001235', lastName: 'Williams', firstName: 'Robert', dob: '1982-07-24', sex: 'male', primaryInsurance: 'Aetna HMO', balance: 0, status: 'active', lastVisit: '2026-06-25', phone: '(555) 480-7712' },
  { id: '3', mrn: 'MRN-001236', lastName: 'Davis', firstName: 'Susan', dob: '1964-11-05', sex: 'female', primaryInsurance: 'United Healthcare', balance: 250.00, status: 'inactive', lastVisit: '2026-05-10' },
  { id: '4', mrn: 'MRN-001237', lastName: 'Brown', firstName: 'James', dob: '1990-01-28', sex: 'male', primaryInsurance: 'Cigna PPO', balance: 0, status: 'active', lastVisit: '2026-06-28', phone: '(555) 901-2233' },
  { id: '5', mrn: 'MRN-001238', lastName: 'Garcia', firstName: 'Elena', dob: '1955-08-17', sex: 'female', primaryInsurance: 'Medicare', balance: 75.00, status: 'active', lastVisit: '2026-06-20' },
  { id: '6', mrn: 'MRN-001239', lastName: 'Martinez', firstName: 'Carlos', dob: '1978-12-01', sex: 'male', primaryInsurance: 'Medicaid', balance: 0, status: 'active', lastVisit: '2026-06-15' },
]

type StatusFilter = 'all' | 'active' | 'inactive' | 'balance'

export function PatientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const debounce = useCallback((value: string) => {
    setSearch(value)
    clearTimeout((window as unknown as { _searchTimer?: number })._searchTimer)
    ;(window as unknown as { _searchTimer?: number })._searchTimer = window.setTimeout(() => {
      setDebouncedSearch(value)
      setPage(0)
    }, 300)
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['patients', debouncedSearch, page, statusFilter],
    queryFn: async () => {
      try {
        const res = await api.get('/patients', {
          params: { search: debouncedSearch, limit: PAGE_SIZE, offset: page * PAGE_SIZE, status: statusFilter !== 'all' ? statusFilter : undefined }
        })
        return res.data
      } catch {
        let items = MOCK_PATIENTS
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase()
          items = items.filter(p =>
            p.firstName.toLowerCase().includes(q) ||
            p.lastName.toLowerCase().includes(q) ||
            p.mrn.toLowerCase().includes(q)
          )
        }
        if (statusFilter === 'active') items = items.filter(p => p.status === 'active')
        if (statusFilter === 'inactive') items = items.filter(p => p.status === 'inactive')
        if (statusFilter === 'balance') items = items.filter(p => p.balance > 0)
        return { items, total: items.length }
      }
    },
  })

  const items: Patient[] = data?.items || []
  const total: number = data?.total || 0

  const filterChips: { key: StatusFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'All Patients' },
    { key: 'active', label: 'Active' },
    { key: 'inactive', label: 'Inactive' },
    { key: 'balance', label: 'Has Balance' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--bb-text-primary)' }}>Patients</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--bb-text-secondary)' }}>{total} {statusFilter === 'all' ? 'total' : statusFilter} patients</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/patients/new')}>
          <UserPlus size={15} />
          New Patient
        </Button>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {filterChips.map(chip => (
          <button
            key={chip.key}
            onClick={() => { setStatusFilter(chip.key); setPage(0) }}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: `1.5px solid ${statusFilter === chip.key ? 'var(--bb-brand-blue)' : 'var(--bb-border)'}`,
              background: statusFilter === chip.key ? '#EFF0FF' : 'var(--bb-surface-card)',
              color: statusFilter === chip.key ? 'var(--bb-brand-blue)' : 'var(--bb-text-secondary)',
              fontSize: 13,
              fontWeight: statusFilter === chip.key ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div style={{
        background: 'var(--bb-surface-card)',
        borderRadius: 'var(--bb-radius-lg)',
        border: '1px solid var(--bb-border)',
        boxShadow: 'var(--bb-shadow-sm)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bb-border)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--bb-text-secondary)' }} />
            <input
              value={search}
              onChange={e => debounce(e.target.value)}
              placeholder="Search by name, MRN, phone..."
              style={{
                width: '100%', height: 36,
                paddingLeft: 34, paddingRight: 12,
                border: '1px solid var(--bb-border)',
                borderRadius: 'var(--bb-radius)',
                fontSize: 14, background: 'var(--bb-surface-app)',
                color: 'var(--bb-text-primary)', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--bb-text-secondary)' }}>
            <Filter size={14} />
            {total} records
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--bb-text-secondary)', fontSize: 14 }}>Loading patients…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--bb-text-secondary)', fontSize: 14 }}>No patients found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bb-surface-app)' }}>
                {['Patient', 'MRN', 'Age / DOB', 'Insurance', 'Balance', 'Last Visit', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)', borderBottom: '1px solid var(--bb-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((p, i) => {
                const isFemale = p.sex?.toLowerCase() === 'female' || p.gender?.toLowerCase() === 'female'
                const avatarBg = isFemale ? '#7C3AED' : '#0410BD'
                const age = calcAge(p.dob)
                return (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/patients/${p.id}`)}
                    style={{
                      cursor: 'pointer',
                      background: i % 2 === 0 ? 'white' : 'var(--bb-surface-app)',
                      borderBottom: '1px solid var(--bb-border)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#EFF0FF')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : 'var(--bb-surface-app)')}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: avatarBg, color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, flexShrink: 0,
                        }}>
                          {initials(p.firstName, p.lastName)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--bb-text-primary)' }}>{p.lastName}, {p.firstName}</div>
                          {p.phone && <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>{p.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, color: 'var(--bb-brand-blue)' }}>{p.mrn}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      <div style={{ fontWeight: 500 }}>{age} yrs</div>
                      <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>{p.dob}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--bb-text-secondary)' }}>{p.primaryInsurance}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: p.balance > 0 ? 'var(--bb-status-danger)' : 'var(--bb-status-success)' }}>
                        ${p.balance.toFixed(2)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--bb-text-secondary)' }}>{p.lastVisit || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={p.status === 'active' ? 'success' : 'default'}>{p.status}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {total > PAGE_SIZE && (
          <div style={{
            padding: '12px 20px', borderTop: '1px solid var(--bb-border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 13, color: 'var(--bb-text-secondary)',
          }}>
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <Button variant="secondary" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
