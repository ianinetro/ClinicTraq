import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send, Search, AlertTriangle, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { apiClient as api } from '../../services/api'

interface Claim {
  id: string
  claimId: string
  patient: string
  dos: string
  payer: string
  billed: number
  paid: number
  balance: number
  status: string
  ageDays: number
  denialReason?: string
  submitDate?: string
}

type StatusFilter = 'all' | 'Submitted' | 'Pending' | 'Denied' | 'Paid' | 'Draft'

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (s === 'Paid') return 'success'
  if (s === 'Denied') return 'danger'
  if (s === 'Pending') return 'warning'
  if (s === 'Submitted') return 'info'
  return 'default'
}

const agingColor = (days: number) => {
  if (days <= 30) return 'var(--bb-status-success)'
  if (days <= 60) return '#D97706'
  if (days <= 90) return '#EA580C'
  return 'var(--bb-status-danger)'
}

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Draft', label: 'Draft' },
  { key: 'Submitted', label: 'Submitted' },
  { key: 'Pending', label: 'Pending' },
  { key: 'Denied', label: 'Denied' },
  { key: 'Paid', label: 'Paid' },
]

export function ClaimsPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [payer, setPayer] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['claims', statusFilter, payer, search],
    queryFn: async () => {
      const res = await api.get('/claims', { params: { status: statusFilter !== 'all' ? statusFilter : undefined, payer, search: search || undefined } })
      return res.data
    },
  })

  const items: Claim[] = data?.items || []
  const denied = items.filter(c => c.status === 'Denied')
  const totalBilled = items.reduce((s, c) => s + c.billed, 0)
  const totalBalance = items.reduce((s, c) => s + c.balance, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--bb-text-primary)' }}>Claims</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--bb-text-secondary)' }}>Insurance claim lifecycle management</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary">Export</Button>
          <Button variant="primary">
            <Send size={14} />
            Batch Submit
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Claims', value: String(items.length), sub: 'this view' },
          { label: 'Total Billed', value: `$${totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, sub: 'aggregate' },
          { label: 'Outstanding', value: `$${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, sub: 'unpaid balance', danger: totalBalance > 0 },
          { label: 'Denied', value: String(denied.length), sub: 'need attention', danger: denied.length > 0 },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: 'var(--bb-surface-card)',
            border: `1px solid ${kpi.danger ? 'var(--bb-status-danger)' : 'var(--bb-border)'}`,
            borderRadius: 'var(--bb-radius-lg)',
            padding: '16px 20px',
            boxShadow: 'var(--bb-shadow-sm)',
          }}>
            <div style={{ fontSize: 12, color: kpi.danger ? 'var(--bb-status-danger)' : 'var(--bb-text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: kpi.danger ? 'var(--bb-status-danger)' : 'var(--bb-text-primary)', marginTop: 4 }}>{kpi.value}</div>
            <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Denial alert */}
      {denied.length > 0 && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 'var(--bb-radius)', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertTriangle size={16} color="var(--bb-status-danger)" />
          <span style={{ fontSize: 14, color: 'var(--bb-status-danger)', fontWeight: 500 }}>
            {denied.length} denied claim{denied.length !== 1 ? 's' : ''} require attention.
          </span>
          <button
            onClick={() => setStatusFilter('Denied')}
            style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--bb-status-danger)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontWeight: 500 }}
          >
            View denials
          </button>
        </div>
      )}

      <div style={{
        background: 'var(--bb-surface-card)',
        borderRadius: 'var(--bb-radius-lg)',
        border: '1px solid var(--bb-border)',
        boxShadow: 'var(--bb-shadow-sm)',
        overflow: 'hidden',
      }}>
        {/* Toolbar */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bb-border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Status chips */}
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
                placeholder="Search claim, patient, payer…"
                style={{ height: 34, paddingLeft: 30, paddingRight: 12, border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius)', fontSize: 13, background: 'var(--bb-surface-app)', color: 'var(--bb-text-primary)', outline: 'none', width: 240 }}
              />
            </div>
            <Select
              options={[{ value: '', label: 'All Payers' }, { value: 'BlueCross', label: 'BlueCross PPO' }, { value: 'Aetna', label: 'Aetna HMO' }, { value: 'United', label: 'United Healthcare' }, { value: 'Medicare', label: 'Medicare' }, { value: 'Medicaid', label: 'Medicaid' }]}
              value={payer}
              onChange={e => setPayer(e.target.value)}
              style={{ width: 180, height: 34 }}
            />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--bb-text-secondary)', fontSize: 14 }}>Loading claims…</div>
        ) : isError ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--bb-status-danger)', fontSize: 14 }}>Failed to load claims. Check API connection.</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--bb-text-secondary)', fontSize: 14 }}>No claims match this filter</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bb-surface-app)' }}>
                {['Claim ID', 'Patient', 'DOS', 'Payer', 'Billed', 'Paid', 'Balance', 'Age', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)', borderBottom: '1px solid var(--bb-border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((c, i) => (
                <tr
                  key={c.id}
                  style={{ background: i % 2 === 0 ? 'white' : 'var(--bb-surface-app)', borderBottom: '1px solid var(--bb-border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#EFF0FF')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : 'var(--bb-surface-app)')}
                  onClick={() => navigate(`/claims/${c.id}`)}
                >
                  <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--bb-brand-blue)', fontSize: 13 }}>{c.claimId}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 500, fontSize: 14 }}>{c.patient}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--bb-text-secondary)' }}>{c.dos}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--bb-text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.payer}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13 }}>${c.billed.toFixed(2)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: c.paid > 0 ? 'var(--bb-status-success)' : 'var(--bb-text-secondary)', fontWeight: c.paid > 0 ? 600 : 400 }}>
                    {c.paid > 0 ? `$${c.paid.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: c.balance > 0 ? 'var(--bb-status-danger)' : 'var(--bb-status-success)' }}>
                    ${c.balance.toFixed(2)}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: c.ageDays >= 30 ? 600 : 400, color: agingColor(c.ageDays) }}>
                    {c.ageDays}d
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                      {c.denialReason && (
                        <span style={{ fontSize: 11, color: 'var(--bb-status-danger)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.denialReason}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <ChevronRight size={14} color="var(--bb-text-secondary)" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
