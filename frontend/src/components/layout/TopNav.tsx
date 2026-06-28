import { useState } from 'react'
import { Menu, Bell, LogOut, ChevronDown, Building2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/authStore'
import { apiClient as api } from '../../services/api'

interface TopNavProps {
  onMenuClick: () => void
  pageTitle?: string
}

export function TopNav({ onMenuClick, pageTitle }: TopNavProps) {
  const { user, logout, activeClinicId, setActiveClinic } = useAuthStore()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showClinicPicker, setShowClinicPicker] = useState(false)

  // Only fetch clinics for billing/mgmt users who span multiple clinics
  const canSwitchClinic = !!(user?.billingCompanyId || user?.managementGroupId)
  const { data: clinics = [] } = useQuery({
    queryKey: ['org', 'clinics'],
    queryFn: async () => (await api.get('/org/clinics')).data ?? [],
    enabled: canSwitchClinic,
  })
  const activeClinic = (clinics as { id: string; name: string }[]).find(c => c.id === activeClinicId)

  return (
    <header style={{
      position: 'fixed', top: 0, left: 240, right: 0, height: 56, zIndex: 30,
      background: 'var(--bb-surface-card)',
      borderBottom: '1px solid var(--bb-border)',
      display: 'flex', alignItems: 'center',
      padding: '0 20px',
      boxShadow: 'var(--bb-shadow-sm)',
    }}>
      <button
        onClick={onMenuClick}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-text-secondary)', display: 'flex', marginRight: 12, padding: 4 }}
      >
        <Menu size={20} />
      </button>
      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--bb-text-primary)', flex: 1 }}>
        {pageTitle}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Clinic switcher — only visible to billing/mgmt users */}
        {canSwitchClinic && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowClinicPicker(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--bb-surface-app)', border: '1px solid var(--bb-border)',
                borderRadius: 'var(--bb-radius)', padding: '5px 10px',
                cursor: 'pointer', color: 'var(--bb-text-primary)', fontSize: 13,
              }}
            >
              <Building2 size={14} style={{ color: 'var(--bb-brand-blue)' }} />
              <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeClinic?.name ?? 'All Clinics'}
              </span>
              <ChevronDown size={13} style={{ color: 'var(--bb-text-secondary)' }} />
            </button>
            {showClinicPicker && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100,
                background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)',
                borderRadius: 'var(--bb-radius)', boxShadow: 'var(--bb-shadow-md)', minWidth: 200,
              }}>
                <button
                  onClick={() => { setActiveClinic(''); setShowClinicPicker(false) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none',
                    border: 'none', cursor: 'pointer', fontSize: 13,
                    color: !activeClinicId ? 'var(--bb-brand-blue)' : 'var(--bb-text-primary)',
                    fontWeight: !activeClinicId ? 600 : 400,
                  }}
                >
                  All Clinics
                </button>
                {(clinics as { id: string; name: string }[]).map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setActiveClinic(c.id); setShowClinicPicker(false) }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none',
                      border: 'none', borderTop: '1px solid var(--bb-border)', cursor: 'pointer', fontSize: 13,
                      color: activeClinicId === c.id ? 'var(--bb-brand-blue)' : 'var(--bb-text-primary)',
                      fontWeight: activeClinicId === c.id ? 600 : 400,
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-text-secondary)', display: 'flex', padding: 8, borderRadius: 'var(--bb-radius)', position: 'relative' }}>
          <Bell size={18} />
        </button>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDropdown(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: '1px solid var(--bb-border)',
              borderRadius: 'var(--bb-radius)', padding: '6px 12px',
              cursor: 'pointer', color: 'var(--bb-text-primary)',
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--bb-brand-blue)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{user?.name || 'User'}</span>
            <ChevronDown size={14} style={{ color: 'var(--bb-text-secondary)' }} />
          </button>
          {showDropdown && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: 'var(--bb-surface-card)',
              border: '1px solid var(--bb-border)',
              borderRadius: 'var(--bb-radius)',
              boxShadow: 'var(--bb-shadow-md)',
              minWidth: 160, zIndex: 100,
            }}>
              <button
                onClick={() => { setShowDropdown(false); logout() }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--bb-status-danger)',
                  fontSize: 14, textAlign: 'left',
                }}
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
