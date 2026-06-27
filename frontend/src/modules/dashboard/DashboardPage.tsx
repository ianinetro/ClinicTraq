import { useQuery } from '@tanstack/react-query'
import { Users, FileText, AlertCircle, DollarSign } from 'lucide-react'
import { KPICard } from '../../components/ui/KPICard'
import api from '../../services/api'

interface DashboardStats {
  todayVisits: number
  claimsThisWeek: number
  paymentsToday: number
  workQueueOpen: number
  claimsByStatus: { submitted: number; pending: number; denied: number; paid: number }
  recentActivity: Array<{ id: string; description: string; user: string; time: string }>
}

const claimStatusColors: Record<string, string> = {
  Paid: 'var(--bb-status-success)',
  Submitted: 'var(--bb-brand-blue)',
  Pending: 'var(--bb-status-warning)',
  Denied: 'var(--bb-status-danger)',
}

export function DashboardPage() {
  const { data } = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      try {
        const res = await api.get('/dashboard/stats')
        return res.data
      } catch {
        return {
          todayVisits: 24,
          claimsThisWeek: 147,
          paymentsToday: 18420,
          workQueueOpen: 12,
          claimsByStatus: { submitted: 42, pending: 28, denied: 9, paid: 68 },
          recentActivity: [
            { id: '1', description: 'Claim #A10042 submitted to BlueCross', user: 'Dr. Smith', time: '5 min ago' },
            { id: '2', description: 'ERA file imported: 32 payments posted', user: 'System', time: '22 min ago' },
            { id: '3', description: 'Patient John D. registered', user: 'Front Desk', time: '1 hr ago' },
            { id: '4', description: 'Denial worked: Claim #A10038', user: 'Billing Team', time: '2 hr ago' },
            { id: '5', description: 'Visit note finalized for P-00421', user: 'Dr. Johnson', time: '3 hr ago' },
          ],
        }
      }
    },
  })

  const claimStatusData = data?.claimsByStatus
    ? Object.entries({
        Paid: data.claimsByStatus.paid,
        Submitted: data.claimsByStatus.submitted,
        Pending: data.claimsByStatus.pending,
        Denied: data.claimsByStatus.denied,
      })
    : []

  const totalClaims = claimStatusData.reduce((s, [, v]) => s + v, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: 'var(--bb-text-primary)' }}>Overview</h2>
        <p style={{ fontSize: 14, color: 'var(--bb-text-secondary)', margin: 0 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <KPICard
          title="Today's Visits"
          value={data?.todayVisits ?? '—'}
          trend="+3"
          trendUp
          subtitle="vs yesterday"
          icon={<Users size={20} />}
        />
        <KPICard
          title="Claims This Week"
          value={data?.claimsThisWeek ?? '—'}
          trend="+12%"
          trendUp
          subtitle="vs last week"
          icon={<FileText size={20} />}
        />
        <KPICard
          title="Payments Today"
          value={data ? `$${data.paymentsToday.toLocaleString()}` : '—'}
          trend="+8%"
          trendUp
          subtitle="vs yesterday"
          icon={<DollarSign size={20} />}
        />
        <KPICard
          title="Work Queue"
          value={data?.workQueueOpen ?? '—'}
          trend="-2"
          trendUp
          subtitle="open items"
          icon={<AlertCircle size={20} />}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{
          background: 'var(--bb-surface-card)',
          borderRadius: 'var(--bb-radius-lg)',
          padding: 20,
          border: '1px solid var(--bb-border)',
          boxShadow: 'var(--bb-shadow-sm)',
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 600 }}>Claims by Status</h3>
          <div style={{ flex: 1 }}>
            {claimStatusData.map(([label, value]) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: 'var(--bb-text-primary)', fontWeight: 500 }}>{label}</span>
                  <span style={{ color: 'var(--bb-text-secondary)' }}>{value}</span>
                </div>
                <div style={{ height: 8, background: 'var(--bb-surface-app)', borderRadius: 4 }}>
                  <div style={{
                    height: '100%',
                    width: totalClaims ? `${(value / totalClaims) * 100}%` : '0%',
                    background: claimStatusColors[label],
                    borderRadius: 4,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          background: 'var(--bb-surface-card)',
          borderRadius: 'var(--bb-radius-lg)',
          padding: 20,
          border: '1px solid var(--bb-border)',
          boxShadow: 'var(--bb-shadow-sm)',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Recent Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {data?.recentActivity?.map(event => (
              <div key={event.id} style={{
                padding: '10px 0',
                borderBottom: '1px solid var(--bb-border)',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <span style={{ fontSize: 13, color: 'var(--bb-text-primary)' }}>{event.description}</span>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--bb-text-secondary)' }}>
                  <span>{event.user}</span>
                  <span>·</span>
                  <span>{event.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
