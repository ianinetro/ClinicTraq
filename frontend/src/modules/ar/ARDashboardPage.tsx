import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, TrendingUp, AlertCircle, DollarSign, Clock, Filter } from 'lucide-react'
import { PageHeader } from '../../components/shell/PageHeader'

interface ARBucket {
  bucket: string
  count: number
  amount: number
  pct: number
}

interface ARSummary {
  total_ar: number
  current: number
  days_30: number
  days_60: number
  days_90: number
  days_120_plus: number
  avg_days_outstanding: number
  buckets: ARBucket[]
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: authHeaders() })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

function useARSummary() {
  return useQuery<ARSummary>({
    queryKey: ['ar-summary'],
    queryFn: () => apiFetch('/api/v1/ar/summary'),
    retry: false,
  })
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const BUCKET_COLORS = ['#0410BD', '#16A34A', '#D97706', '#DC2626', '#7C3AED']

export function ARDashboardPage() {
  const [filterPayer, setFilterPayer] = useState('')
  const { data, isLoading, error } = useARSummary()

  const buckets: ARBucket[] = data?.buckets ?? [
    { bucket: 'Current (0–30)', count: 0, amount: data?.current ?? 0, pct: 0 },
    { bucket: '31–60 days', count: 0, amount: data?.days_30 ?? 0, pct: 0 },
    { bucket: '61–90 days', count: 0, amount: data?.days_60 ?? 0, pct: 0 },
    { bucket: '91–120 days', count: 0, amount: data?.days_90 ?? 0, pct: 0 },
    { bucket: '120+ days', count: 0, amount: data?.days_120_plus ?? 0, pct: 0 },
  ]

  const totalAR = data?.total_ar ?? 0

  const statCards = [
    { label: 'Total A/R', value: fmt(totalAR), icon: DollarSign, color: '#0410BD', bg: '#EFF0FF' },
    { label: 'Avg Days Outstanding', value: data ? `${Math.round(data.avg_days_outstanding)} days` : '—', icon: Clock, color: '#D97706', bg: '#FFF7ED' },
    { label: 'Aging > 90 Days', value: fmt((data?.days_90 ?? 0) + (data?.days_120_plus ?? 0)), icon: AlertCircle, color: '#DC2626', bg: '#FEF2F2' },
    { label: 'Current (0-30 days)', value: fmt(data?.current ?? 0), icon: TrendingUp, color: '#16A34A', bg: '#ECFDF5' },
  ]

  return (
    <div className="p-6 space-y-6" style={{ maxWidth: 1100 }}>
      <PageHeader
        title="A/R Aging"
        description="Accounts receivable aging analysis across all payers"
      />

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={20} style={{ color: s.color }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#12122C' }}>{isLoading ? '…' : s.value}</div>
              <div style={{ fontSize: 12, color: '#676687', marginTop: 1 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 16, color: '#DC2626', fontSize: 14 }}>
          A/R summary endpoint not available — check that the backend /ar/summary endpoint is configured.
        </div>
      )}

      {/* Aging buckets */}
      <div style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, padding: '20px 24px' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#12122C', marginBottom: 20 }}>Aging Breakdown</div>
        {isLoading ? (
          <div style={{ color: '#9CA3AF', fontSize: 14 }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {buckets.map((b, i) => {
              const pct = totalAR > 0 ? (b.amount / totalAR) * 100 : b.pct
              return (
                <div key={b.bucket}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{b.bucket}</span>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      {b.count > 0 && <span style={{ fontSize: 12, color: '#9CA3AF' }}>{b.count} claims</span>}
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#12122C' }}>{fmt(b.amount)}</span>
                      <span style={{ fontSize: 12, color: '#676687', width: 40, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div style={{ height: 8, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: BUCKET_COLORS[i] ?? '#9CA3AF', borderRadius: 99, transition: 'width 0.6s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Table placeholder */}
      <div style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E3E3F1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#12122C' }}>Aged Claims</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={14} style={{ color: '#9CA3AF' }} />
            <select
              value={filterPayer}
              onChange={e => setFilterPayer(e.target.value)}
              style={{ height: 32, border: '1px solid #BABACE', borderRadius: 7, padding: '0 8px', fontSize: 13, color: '#12122C', background: 'white', outline: 'none' }}
            >
              <option value="">All Payers</option>
              <option value="medicare">Medicare</option>
              <option value="medicaid">Medicaid</option>
              <option value="commercial">Commercial</option>
              <option value="self">Self Pay</option>
            </select>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Claim #', 'Patient', 'Payer', 'DOS', 'Billed', 'Balance', 'Age', 'Bucket'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E3E3F1' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={8} style={{ padding: '40px 0', textAlign: 'center' }}>
                <BarChart3 size={32} style={{ color: '#E3E3F1', margin: '0 auto 10px', display: 'block' }} />
                <div style={{ fontSize: 14, fontWeight: 500, color: '#12122C' }}>Aged claims list</div>
                <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>
                  Connect the /ar/claims backend endpoint to populate this table.
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
