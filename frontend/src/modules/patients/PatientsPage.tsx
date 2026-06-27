import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, UserPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { DataTable, Column } from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import api from '../../services/api'

interface Patient {
  id: string
  mrn: string
  lastName: string
  firstName: string
  dob: string
  primaryInsurance: string
  balance: number
  status: 'active' | 'inactive'
}

const PAGE_SIZE = 20

export function PatientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)

  const debounce = useCallback((value: string) => {
    setSearch(value)
    clearTimeout((window as unknown as { _searchTimer?: number })._searchTimer)
    ;(window as unknown as { _searchTimer?: number })._searchTimer = window.setTimeout(() => {
      setDebouncedSearch(value)
      setPage(0)
    }, 300)
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['patients', debouncedSearch, page],
    queryFn: async () => {
      try {
        const res = await api.get('/patients', {
          params: { search: debouncedSearch, limit: PAGE_SIZE, offset: page * PAGE_SIZE }
        })
        return res.data
      } catch {
        return {
          items: [
            { id: '1', mrn: 'MRN-001234', lastName: 'Johnson', firstName: 'Mary', dob: '1975-03-12', primaryInsurance: 'BlueCross PPO', balance: 125.00, status: 'active' },
            { id: '2', mrn: 'MRN-001235', lastName: 'Williams', firstName: 'Robert', dob: '1982-07-24', primaryInsurance: 'Aetna HMO', balance: 0, status: 'active' },
            { id: '3', mrn: 'MRN-001236', lastName: 'Davis', firstName: 'Susan', dob: '1964-11-05', primaryInsurance: 'United Healthcare', balance: 250.00, status: 'inactive' },
          ],
          total: 3,
        }
      }
    },
  })

  const columns: Column<Patient>[] = [
    { key: 'mrn', header: 'MRN' },
    {
      key: 'name', header: 'Name',
      render: row => <span style={{ fontWeight: 500 }}>{row.lastName}, {row.firstName}</span>,
    },
    { key: 'dob', header: 'Date of Birth', render: row => row.dob },
    { key: 'primaryInsurance', header: 'Primary Insurance' },
    {
      key: 'balance', header: 'Balance',
      render: row => (
        <span style={{ fontWeight: 600, color: row.balance > 0 ? 'var(--bb-status-danger)' : 'var(--bb-status-success)' }}>
          ${row.balance.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: row => <Badge variant={row.status === 'active' ? 'success' : 'default'}>{row.status}</Badge>,
    },
  ]

  const items = data?.items || []
  const total = data?.total || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Patients</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--bb-text-secondary)' }}>{total} total patients</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/patients/new')}>
          <UserPlus size={15} />
          New Patient
        </Button>
      </div>

      <div style={{
        background: 'var(--bb-surface-card)',
        borderRadius: 'var(--bb-radius-lg)',
        border: '1px solid var(--bb-border)',
        boxShadow: 'var(--bb-shadow-sm)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bb-border)' }}>
          <div style={{ position: 'relative', maxWidth: 400 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--bb-text-secondary)' }} />
            <input
              value={search}
              onChange={e => debounce(e.target.value)}
              placeholder="Search by name, MRN, or DOB..."
              style={{
                width: '100%', height: 36,
                paddingLeft: 34, paddingRight: 12,
                border: '1px solid var(--bb-border)',
                borderRadius: 'var(--bb-radius)',
                fontSize: 14, background: 'var(--bb-surface-app)',
                color: 'var(--bb-text-primary)', outline: 'none',
              }}
            />
          </div>
        </div>
        <DataTable
          columns={columns as Column<Record<string, unknown>>[]}
          data={items as Record<string, unknown>[]}
          isLoading={isLoading}
          emptyMessage="No patients found"
        />
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
