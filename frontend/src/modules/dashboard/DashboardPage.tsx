import { useQuery } from '@tanstack/react-query'
import { Users, FileText, AlertCircle, DollarSign, TrendingUp, Clock, CheckCircle2, XCircle, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiClient as api } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'

interface Stats {
  todayVisits: number
  claimsThisWeek: number
  paymentsToday: number
  workQueueOpen: number
  arAging: { '0-30': number; '31-60': number; '61-90': number; '90+': number }
  claimsByStatus: { submitted: number; pending: number; denied: number; paid: number }
  recentActivity: { id: string; description: string; user: string; time: string; type: string }[]
  queueSummary: { type: string; count: number; priority: 'high' | 'medium' | 'low' }[]
}

const MOCK: Stats = {
  todayVisits: 24,
  claimsThisWeek: 147,
  paymentsToday: 18420,
  workQueueOpen: 12,
  arAging: { '0-30': 48200, '31-60': 23400, '61-90': 11800, '90+': 6500 },
  claimsByStatus: { submitted: 42, pending: 28, denied: 9, paid: 68 },
  recentActivity: [
    { id: '1', description: 'Claim #A10042 submitted to BlueCross', user: 'Dr. Smith', time: '5 min ago', type: 'submit' },
    { id: '2', description: 'ERA file imported: 32 payments posted', user: 'System', time: '22 min ago', type: 'payment' },
    { id: '3', description: 'Patient Mary Johnson registered', user: 'Front Desk', time: '1 hr ago', type: 'patient' },
    { id: '4', description: 'Denial worked: Claim #A10038 resubmitted', user: 'J. Martinez', time: '2 hr ago', type: 'denial' },
    { id: '5', description: 'Visit note finalized for Robert Williams', user: 'Dr. Johnson', time: '3 hr ago', type: 'visit' },
    { id: '6', description: 'Eligibility verified: Susan Davis (Aetna)', user: 'System', time: '4 hr ago', type: 'eligibility' },
  ],
  queueSummary: [
    { type: 'Denial Follow-up', count: 4, priority: 'high' },
    { type: 'Missing Information', count: 2, priority: 'high' },
    { type: 'Authorization Required', count: 3, priority: 'medium' },
    { type: 'Claim Resubmission', count: 2, priority: 'medium' },
    { type: 'Patient Statements', count: 1, priority: 'low' },
  ],
}

const STATUS_COLORS: Record<string, string> = {
  Paid: '#16A34A', Submitted: '#0410BD', Pending: '#D97706', Denied: '#DC2626',
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  submit: <FileText size={14} color="#0410BD" />,
  payment: <DollarSign size={14} color="#16A34A" />,
  patient: <Users size={14} color="#007998" />,
  denial: <RotateCcw size={14} color="#D97706" />,
  visit: <CheckCircle2 size={14} color="#16A34A" />,
  eligibility: <AlertCircle size={14} color="#676687" />,
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#DC2626', medium: '#D97706', low: '#007998',
}

export function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)

  const { data = MOCK } = useQuery<Stats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      try { return (await api.get('/dashboard/stats')).data } catch { return MOCK }
    },
    staleTime: 60_000,
  })

  const statusEntries = Object.entries({
    Paid: data.claimsByStatus.paid,
    Submitted: data.claimsByStatus.submitted,
    Pending: data.claimsByStatus.pending,
    Denied: data.claimsByStatus.denied,
  })
  const totalClaims = statusEntries.reduce((s, [, v]) => s + v, 0)
  const totalAR = Object.values(data.arAging).reduce((s, v) => s + v, 0)

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#676687', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Dashboard</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#12122C', letterSpacing: '-0.3px' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0] ?? 'Admin'}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#676687' }}>{today}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/work-queue')} style={{
            height: 36, padding: '0 16px', background: data.workQueueOpen > 0 ? '#DC2626' : '#0410BD',
            color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <AlertCircle size={14} />
            {data.workQueueOpen} open task{data.workQueueOpen !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { title: "Today's Visits", value: data.todayVisits, trend: '+3 vs yesterday', up: true, icon: <Users size={18} />, path: '/visits', color: '#0410BD' },
          { title: 'Claims This Week', value: data.claimsThisWeek, trend: '+12% vs last week', up: true, icon: <FileText size={18} />, path: '/claims', color: '#007998' },
          { title: 'Payments Today', value: `$${data.paymentsToday.toLocaleString()}`, trend: '+8%', up: true, icon: <DollarSign size={18} />, path: '/payments', color: '#16A34A' },
          { title: 'Work Queue', value: data.workQueueOpen, trend: data.workQueueOpen > 5 ? 'Needs attention' : 'Looks good', up: data.workQueueOpen <= 5, icon: <AlertCircle size={18} />, path: '/work-queue', color: data.workQueueOpen > 5 ? '#DC2626' : '#16A34A' },
        ].map(kpi => (
          <div key={kpi.title} onClick={() => navigate(kpi.path)} style={{
            background: 'white', border: '1px solid #E3E3F1', borderRadius: 10,
            padding: '18px 20px', cursor: 'pointer', transition: 'box-shadow 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(18,18,44,0.10)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#676687', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.title}</span>
              <span style={{ color: kpi.color, opacity: 0.85 }}>{kpi.icon}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#12122C', marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>{kpi.value}</div>
            <div style={{ fontSize: 12, color: kpi.up ? '#16A34A' : '#DC2626', display: 'flex', alignItems: 'center', gap: 3 }}>
              <TrendingUp size={11} /> {kpi.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Main 2-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* AR Aging */}
        <div style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#12122C' }}>AR Aging Summary</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#676687' }}>Total outstanding: ${totalAR.toLocaleString()}</p>
            </div>
            <button onClick={() => navigate('/claims')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#0410BD', fontWeight: 500 }}>View claims →</button>
          </div>
          {Object.entries(data.arAging).map(([bucket, amt]) => {
            const pct = totalAR ? (amt / totalAR) * 100 : 0
            const color = bucket === '90+' ? '#DC2626' : bucket === '61-90' ? '#D97706' : bucket === '31-60' ? '#F59E0B' : '#16A34A'
            return (
              <div key={bucket} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                  <span style={{ color: '#12122C', fontWeight: 500 }}>{bucket} days</span>
                  <span style={{ color: '#12122C', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${amt.toLocaleString()}</span>
                </div>
                <div style={{ height: 7, background: '#F2F2F8', borderRadius: 4 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ fontSize: 11, color: '#676687', marginTop: 2 }}>{pct.toFixed(0)}% of total</div>
              </div>
            )
          })}
        </div>

        {/* Claims by status */}
        <div style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#12122C' }}>Claims by Status</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#676687' }}>{totalClaims} claims this period</p>
            </div>
            <button onClick={() => navigate('/claims')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#0410BD', fontWeight: 500 }}>View all →</button>
          </div>
          {statusEntries.map(([label, value]) => {
            const pct = totalClaims ? (value / totalClaims) * 100 : 0
            return (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                  <span style={{ fontWeight: 500, color: '#12122C' }}>{label}</span>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ color: STATUS_COLORS[label], fontWeight: 600 }}>{value}</span>
                    <span style={{ color: '#BABACE', width: 36, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div style={{ height: 7, background: '#F2F2F8', borderRadius: 4 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: STATUS_COLORS[label], borderRadius: 4, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom 2-col */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Work Queue Summary */}
        <div style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#12122C' }}>Open Work Queue</h3>
            <button onClick={() => navigate('/work-queue')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#0410BD', fontWeight: 500 }}>Work queue →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.queueSummary.map(item => (
              <div key={item.type} onClick={() => navigate('/work-queue')} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', background: '#F2F2F8', borderRadius: 8, cursor: 'pointer',
                border: `1px solid transparent`,
                transition: 'border-color 0.12s',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#E3E3F1')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLORS[item.priority], flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#12122C' }}>{item.type}</span>
                </div>
                <span style={{
                  minWidth: 22, height: 22, borderRadius: 11, background: PRIORITY_COLORS[item.priority],
                  color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#12122C' }}>Recent Activity</h3>
            <Clock size={14} color="#676687" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {data.recentActivity.map((event, i) => (
              <div key={event.id} style={{
                padding: '10px 0', borderBottom: i < data.recentActivity.length - 1 ? '1px solid #F2F2F8' : 'none',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <div style={{ marginTop: 1, flexShrink: 0, width: 20, height: 20, borderRadius: 6, background: '#F2F2F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {ACTIVITY_ICONS[event.type]}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#12122C', lineHeight: 1.4 }}>{event.description}</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 3, fontSize: 11, color: '#676687' }}>
                    <span>{event.user}</span>
                    <span>·</span>
                    <span>{event.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick action alerts */}
      {data.claimsByStatus.denied > 0 && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <XCircle size={18} color="#DC2626" />
            <span style={{ fontSize: 14, color: '#12122C', fontWeight: 500 }}>
              {data.claimsByStatus.denied} denied claim{data.claimsByStatus.denied !== 1 ? 's' : ''} need attention
            </span>
          </div>
          <button onClick={() => navigate('/claims?status=Denied')} style={{
            height: 32, padding: '0 14px', background: '#DC2626', color: 'white',
            border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Review denials
          </button>
        </div>
      )}
    </div>
  )
}
