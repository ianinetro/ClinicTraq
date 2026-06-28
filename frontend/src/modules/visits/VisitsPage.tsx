import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, ChevronRight, Search, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { apiClient as api } from '../../services/api'

interface Visit {
  id: string
  visitDate: string
  patientName: string
  provider: string
  procedureCodes: string
  diagnosisCodes: string
  status: string
  billingStatus: string
  billedAmount: number
}

type StatusFilter = 'all' | 'Scheduled' | 'Completed' | 'Cancelled' | 'In Progress'

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (s === 'Completed') return 'success'
  if (s === 'Scheduled') return 'info'
  if (s === 'In Progress') return 'warning'
  if (s === 'Cancelled') return 'danger'
  return 'default'
}

const billingVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (s === 'Billed') return 'success'
  if (s === 'Ready to Bill') return 'warning'
  if (s === 'Unbilled') return 'default'
  if (s === 'Denied') return 'danger'
  return 'default'
}

const MOCK_VISITS: Visit[] = [
  { id: '1', visitDate: '2026-06-28', patientName: 'Brown, James', provider: 'Dr. Smith', procedureCodes: '99213', diagnosisCodes: 'J06.9', status: 'Scheduled', billingStatus: 'Unbilled', billedAmount: 0 },
  { id: '2', visitDate: '2026-06-26', patientName: 'Johnson, Mary', provider: 'Dr. Smith', procedureCodes: '99213, 85025', diagnosisCodes: 'M54.5, M79.3', status: 'Completed', billingStatus: 'Billed', billedAmount: 185.00 },
  { id: '3', visitDate: '2026-06-25', patientName: 'Williams, Robert', provider: 'Dr. Johnson', procedureCodes: '99202', diagnosisCodes: 'Z00.00', status: 'Completed', billingStatus: 'Ready to Bill', billedAmount: 0 },
  { id: '4', visitDate: '2026-06-25', patientName: 'Davis, Susan', provider: 'Dr. Smith', procedureCodes: '99214, 93000', diagnosisCodes: 'I10, E11.9', status: 'Completed', billingStatus: 'Billed', billedAmount: 320.00 },
  { id: '5', visitDate: '2026-06-20', patientName: 'Garcia, Elena', provider: 'Dr. Johnson', procedureCodes: '99214', diagnosisCodes: 'G43.909', status: 'Completed', billingStatus: 'Denied', billedAmount: 200.00 },
  { id: '6', visitDate: '2026-06-28', patientName: 'Martinez, Carlos', provider: 'Dr. Smith', procedureCodes: '99213, 97110', diagnosisCodes: 'M54.5', status: 'In Progress', billingStatus: 'Unbilled', billedAmount: 0 },
]

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Scheduled', label: 'Scheduled' },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'Completed', label: 'Completed' },
  { key: 'Cancelled', label: 'Cancelled' },
]

export function VisitsPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [provider, setProvider] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['visits', statusFilter, provider, search],
    queryFn: async () => {
      try {
        const res = await api.get('/visits', { params: { status: statusFilter !== 'all' ? statusFilter : undefined, provider } })
        return res.data
      } catch {
        let items = MOCK_VISITS
        if (statusFilter !== 'all') items = items.filter(v => v.status === statusFilter)
        if (provider) items = items.filter(v => v.provider.toLowerCase().includes(provider.toLowerCase()))
        if (search) {
          const q = search.toLowerCase()
          items = items.filter(v => v.patientName.toLowerCase().includes(q) || v.procedureCodes.toLowerCase().includes(q))
        }
        return { items, total: items.length }
      }
    },
  })

  const items: Visit[] = data?.items || []
  const readyToBill = items.filter(v => v.billingStatus === 'Ready to Bill').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--bb-text-primary)' }}>Visits</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--bb-text-secondary)' }}>Encounter management</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/visits/new')}>
          <Plus size={14} />
          New Visit
        </Button>
      </div>

      {readyToBill > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <Calendar size={14} color="#D97706" />
          <span style={{ color: '#92400E', fontWeight: 500 }}>{readyToBill} visit{readyToBill !== 1 ? 's' : ''} ready to bill</span>
          <button onClick={() => setStatusFilter('Completed')} style={{ marginLeft: 'auto', color: '#D97706', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, textDecoration: 'underline', fontWeight: 500 }}>
            View
          </button>
        </div>
      )}

      <div style={{ background: 'var(--bb-surface-card)', borderRadius: 'var(--bb-radius-lg)', border: '1px solid var(--bb-border)', boxShadow: 'var(--bb-shadow-sm)', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bb-border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {STATUS_CHIPS.map(chip => (
              <button
                key={chip.key}
                onClick={() => setStatusFilter(chip.key)}
                style={{
                  padding: '5px 12px', borderRadius: 16,
                  border: `1.5px solid ${statusFilter === chip.key ? 'var(--bb-brand-blue)' : 'var(--bb-border)'}`,
                  background: statusFilter === chip.key ? '#EFF0FF' : 'transparent',
                  color: statusFilter === chip.key ? 'var(--bb-brand-blue)' : 'var(--bb-text-secondary)',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--bb-text-secondary)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search patient, CPT…"
                style={{ height: 34, paddingLeft: 30, paddingRight: 12, border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius)', fontSize: 13, background: 'var(--bb-surface-app)', color: 'var(--bb-text-primary)', outline: 'none', width: 220 }}
              />
            </div>
            <Select
              options={[{ value: '', label: 'All Providers' }, { value: 'Dr. Smith', label: 'Dr. Smith' }, { value: 'Dr. Johnson', label: 'Dr. Johnson' }]}
              value={provider}
              onChange={e => setProvider(e.target.value)}
              style={{ width: 160, height: 34 }}
            />
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--bb-text-secondary)', fontSize: 14 }}>Loading visits…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--bb-text-secondary)', fontSize: 14 }}>No visits found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bb-surface-app)' }}>
                {['Visit Date', 'Patient', 'Provider', 'CPT Codes', 'Diagnoses', 'Visit Status', 'Billing', 'Billed', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)', borderBottom: '1px solid var(--bb-border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((v, i) => (
                <tr
                  key={v.id}
                  style={{ background: i % 2 === 0 ? 'white' : 'var(--bb-surface-app)', borderBottom: '1px solid var(--bb-border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#EFF0FF')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : 'var(--bb-surface-app)')}
                  onClick={() => navigate(`/visits/${v.id}`)}
                >
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 500 }}>{v.visitDate}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, fontSize: 14 }}>{v.patientName}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--bb-text-secondary)' }}>{v.provider}</td>
                  <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--bb-brand-blue)' }}>{v.procedureCodes}</td>
                  <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 12 }}>{v.diagnosisCodes}</td>
                  <td style={{ padding: '11px 14px' }}><Badge variant={statusVariant(v.status)}>{v.status}</Badge></td>
                  <td style={{ padding: '11px 14px' }}><Badge variant={billingVariant(v.billingStatus)}>{v.billingStatus}</Badge></td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: v.billedAmount > 0 ? 'var(--bb-text-primary)' : 'var(--bb-text-secondary)' }}>
                    {v.billedAmount > 0 ? `$${v.billedAmount.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '11px 14px' }}><ChevronRight size={14} color="var(--bb-text-secondary)" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
