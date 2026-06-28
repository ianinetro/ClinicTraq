import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Building2, Users, FileText, DollarSign, AlertTriangle,
  TrendingUp, ArrowRight, Search, RefreshCw, BarChart3,
  CheckCircle2, Clock, XCircle,
} from 'lucide-react'
import { apiClient as api } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'

interface ClinicKPI {
  id: string
  name: string
  address?: string
  is_active: boolean
  stats: {
    active_patients: number
    open_claims: number
    claims_this_month: number
    total_ar: number
    denials_open: number
    avg_days_ar: number
    last_activity?: string
  }
}

interface WorkspaceSummary {
  clinics: ClinicKPI[]
  totals: {
    total_ar: number
    open_claims: number
    denials_open: number
    active_patients: number
  }
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function useWorkspaces() {
  return useQuery<WorkspaceSummary>({
    queryKey: ['billing-workspaces'],
    queryFn: async () => {
      try {
        const res = await api.get('/billing/workspaces')
        return res.data
      } catch {
        // Fallback: load clinics list and compute minimal stats
        const clinicsRes = await api.get('/org/clinics', { params: { limit: 100 } })
        const items = Array.isArray(clinicsRes.data)
          ? clinicsRes.data
          : clinicsRes.data?.items ?? []
        const clinics: ClinicKPI[] = items.map((c: { id: string; name: string; address?: string; is_active?: boolean }) => ({
          id: c.id,
          name: c.name,
          address: c.address,
          is_active: c.is_active ?? true,
          stats: {
            active_patients: 0,
            open_claims: 0,
            claims_this_month: 0,
            total_ar: 0,
            denials_open: 0,
            avg_days_ar: 0,
          },
        }))
        return {
          clinics,
          totals: { total_ar: 0, open_claims: 0, denials_open: 0, active_patients: 0 },
        }
      }
    },
    staleTime: 60_000,
  })
}

function AggregateBanner({ totals }: { totals: WorkspaceSummary['totals'] }) {
  const cards = [
    { label: 'Total A/R', value: fmt(totals.total_ar), icon: DollarSign, color: '#0410BD', bg: '#EFF0FF' },
    { label: 'Open Claims', value: totals.open_claims.toLocaleString(), icon: FileText, color: '#D97706', bg: '#FFF7ED' },
    { label: 'Open Denials', value: totals.denials_open.toLocaleString(), icon: XCircle, color: '#DC2626', bg: '#FEF2F2' },
    { label: 'Active Patients', value: totals.active_patients.toLocaleString(), icon: Users, color: '#16A34A', bg: '#ECFDF5' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
      {cards.map(c => (
        <div key={c.label} style={{
          background: 'white', border: '1px solid #E3E3F1', borderRadius: 10,
          padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <c.icon size={20} style={{ color: c.color }} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#12122C' }}>{c.value}</div>
            <div style={{ fontSize: 12, color: '#676687', marginTop: 1 }}>{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ClinicCard({ clinic }: { clinic: ClinicKPI }) {
  const navigate = useNavigate()
  const setActiveClinic = useAuthStore(s => s.setActiveClinic)
  const s = clinic.stats

  function openWorkspace() {
    setActiveClinic(clinic.id)
    navigate('/dashboard')
  }

  const arColor = s.avg_days_ar > 90 ? '#DC2626' : s.avg_days_ar > 60 ? '#D97706' : '#16A34A'

  return (
    <div style={{
      background: 'white', border: '1px solid #E3E3F1', borderRadius: 12,
      padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EFF0FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={18} style={{ color: '#0410BD' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#12122C' }}>{clinic.name}</div>
              {clinic.address && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{clinic.address}</div>}
            </div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99,
            background: clinic.is_active ? '#ECFDF5' : '#F3F4F6',
            color: clinic.is_active ? '#16A34A' : '#9CA3AF',
          }}>
            {clinic.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, padding: '14px 18px' }}>
        {[
          { label: 'Patients', value: s.active_patients.toLocaleString(), icon: Users, color: '#0410BD' },
          { label: 'Open Claims', value: s.open_claims.toLocaleString(), icon: FileText, color: '#D97706' },
          { label: 'Denials', value: s.denials_open.toLocaleString(), icon: AlertTriangle, color: '#DC2626' },
        ].map(k => (
          <div key={k.label} style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
              <k.icon size={15} style={{ color: k.color }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#12122C' }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* AR + avg days */}
      <div style={{ padding: '0 18px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Total A/R</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#12122C' }}>{fmt(s.total_ar)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Avg Days A/R</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: arColor }}>{s.avg_days_ar || '—'}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ borderTop: '1px solid #F3F4F6', padding: '10px 14px', display: 'flex', gap: 8 }}>
        <button
          onClick={openWorkspace}
          style={{
            flex: 1, height: 34, background: '#0410BD', color: 'white',
            border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          Open Workspace <ArrowRight size={13} />
        </button>
        <button
          onClick={() => { setActiveClinic(clinic.id); navigate('/ar') }}
          style={{
            width: 34, height: 34, background: '#F9FAFB', color: '#374151',
            border: '1px solid #E3E3F1', borderRadius: 7, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="A/R Aging"
        >
          <BarChart3 size={15} />
        </button>
        <button
          onClick={() => { setActiveClinic(clinic.id); navigate('/work-queue') }}
          style={{
            width: 34, height: 34, background: '#F9FAFB', color: '#374151',
            border: '1px solid #E3E3F1', borderRadius: 7, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Work Queue"
        >
          <Clock size={15} />
        </button>
        <button
          onClick={() => { setActiveClinic(clinic.id); navigate('/claims') }}
          style={{
            width: 34, height: 34, background: '#F9FAFB', color: '#374151',
            border: '1px solid #E3E3F1', borderRadius: 7, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Claims"
        >
          <CheckCircle2 size={15} />
        </button>
      </div>
    </div>
  )
}

export function WorkspaceManagerPage() {
  const [search, setSearch] = useState('')
  const { data, isLoading, error, refetch, isFetching } = useWorkspaces()

  const filtered = (data?.clinics ?? []).filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#12122C', letterSpacing: '-0.5px' }}>
              BillerBay Workspace
            </div>
            <div style={{ fontSize: 14, color: '#676687', marginTop: 4 }}>
              Manage billing operations across all your clinic workspaces
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              style={{
                height: 36, padding: '0 14px', background: 'white',
                border: '1px solid #E3E3F1', borderRadius: 8,
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: 'pointer', fontSize: 13, color: '#374151',
              }}
            >
              <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Aggregate KPIs */}
      {data && <AggregateBanner totals={data.totals} />}

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          background: 'white', border: '1px solid #E3E3F1', borderRadius: 8, padding: '0 12px',
        }}>
          <Search size={15} style={{ color: '#9CA3AF', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clinics…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#12122C', height: 36, background: 'transparent' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#676687' }}>
          <TrendingUp size={14} />
          {filtered.length} clinic{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
          padding: 16, color: '#DC2626', fontSize: 14, marginBottom: 20,
        }}>
          Could not load workspace data. Check that the backend is running.
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 12, height: 240, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Building2 size={40} style={{ color: '#E3E3F1', margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>No clinics found</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>
            {search ? 'Try a different search term' : 'No clinics are assigned to your billing company yet'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {filtered.map(clinic => (
            <ClinicCard key={clinic.id} clinic={clinic} />
          ))}
        </div>
      )}
    </div>
  )
}
