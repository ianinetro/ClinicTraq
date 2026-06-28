import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Building2, Users, FileText, DollarSign,
  TrendingUp, ArrowRight, Search, RefreshCw, BarChart3,
  Clock, XCircle,
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

function ClinicRow({ clinic, isFirst }: { clinic: ClinicKPI; isFirst: boolean }) {
  const navigate = useNavigate()
  const setActiveClinic = useAuthStore(s => s.setActiveClinic)
  const s = clinic.stats

  function openWorkspace() {
    setActiveClinic(clinic.id)
    navigate('/dashboard')
  }

  const lastActivity = s.last_activity
    ? new Date(s.last_activity).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  return (
    <div style={{
      background: 'var(--bb-surface-card)',
      borderTop: isFirst ? 'none' : '1px solid var(--bb-border)',
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      {/* Clinic name + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220, flex: '0 0 auto' }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#EFF0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Building2 size={16} style={{ color: 'var(--bb-brand-blue)' }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--bb-text-primary)', lineHeight: 1.3 }}>{clinic.name}</div>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 99,
            background: clinic.is_active ? '#ECFDF5' : '#F3F4F6',
            color: clinic.is_active ? '#16A34A' : '#9CA3AF',
          }}>
            {clinic.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Inline stat pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 99,
          background: '#EFF0FF', color: 'var(--bb-brand-blue)',
          display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
        }}>
          <DollarSign size={12} /> {fmt(s.total_ar)} AR
        </span>
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 99,
          background: '#FFF7ED', color: '#D97706',
          display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
        }}>
          <FileText size={12} /> {s.open_claims.toLocaleString()} Open Claims
        </span>
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 99,
          background: '#ECFDF5', color: '#16A34A',
          display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
        }}>
          <Users size={12} /> {s.active_patients.toLocaleString()} Patients
        </span>
      </div>

      {/* Last activity */}
      <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 1 }}>Last Activity</span>
        {lastActivity}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
        <button
          onClick={openWorkspace}
          style={{
            height: 32, padding: '0 14px', background: 'var(--bb-brand-blue)', color: 'white',
            border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          Open <ArrowRight size={12} />
        </button>
        <button
          onClick={() => { setActiveClinic(clinic.id); navigate('/ar') }}
          style={{
            height: 32, padding: '0 10px', background: 'white', color: '#374151',
            border: '1px solid var(--bb-border)', borderRadius: 7, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
          }}
        >
          <BarChart3 size={13} /> AR Aging
        </button>
        <button
          onClick={() => { setActiveClinic(clinic.id); navigate('/work-queue') }}
          style={{
            height: 32, padding: '0 10px', background: 'white', color: '#374151',
            border: '1px solid var(--bb-border)', borderRadius: 7, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
          }}
        >
          <Clock size={13} /> Work Queue
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
    <div>
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
        <div style={{ border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg, 10px)', overflow: 'hidden' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              background: 'white',
              borderTop: i === 1 ? 'none' : '1px solid var(--bb-border)',
              padding: '14px 20px', height: 64, animation: 'pulse 1.5s infinite',
            }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Building2 size={40} style={{ color: 'var(--bb-border)', margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--bb-text-primary)' }}>No clinics found</div>
          <div style={{ fontSize: 13, color: 'var(--bb-text-secondary)', marginTop: 4 }}>
            {search ? 'Try a different search term' : 'No clinics are assigned to your billing company yet'}
          </div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg, 10px)', overflow: 'hidden' }}>
          {filtered.map((clinic, idx) => (
            <ClinicRow key={clinic.id} clinic={clinic} isFirst={idx === 0} />
          ))}
        </div>
      )}
    </div>
  )
}
