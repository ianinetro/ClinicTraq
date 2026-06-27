import { useState } from 'react'
import { Menu, Bell, LogOut, ChevronDown } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'

interface TopNavProps {
  onMenuClick: () => void
  pageTitle?: string
}

export function TopNav({ onMenuClick, pageTitle }: TopNavProps) {
  const { user, logout } = useAuthStore()
  const [showDropdown, setShowDropdown] = useState(false)

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
