import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Calendar, FileText,
  DollarSign, AlertCircle, Settings, X
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/visits', label: 'Visits', icon: Calendar },
  { to: '/claims', label: 'Claims', icon: FileText },
  { to: '/payments', label: 'Payments', icon: DollarSign },
  { to: '/work-queue', label: 'Work Queue', icon: AlertCircle },
  { to: '/settings', label: 'Settings', icon: Settings },
]

interface SideNavProps {
  isOpen: boolean
  onClose: () => void
}

export function SideNav({ isOpen, onClose }: SideNavProps) {
  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.5)',
            display: 'none',
          }}
        />
      )}
      <aside style={{
        position: 'fixed', left: 0, top: 0, bottom: 0,
        width: 240, zIndex: 50,
        background: 'var(--bb-surface-nav)',
        display: 'flex', flexDirection: 'column',
        transition: 'transform 0.25s',
      }}>
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>
              ClinicTraq
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>EHR Platform</div>
          </div>
          <button onClick={onClose} style={{ display: 'none', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
        <nav style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                borderRadius: 'var(--bb-radius)',
                textDecoration: 'none',
                fontSize: 14, fontWeight: 500,
                color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
                background: isActive ? 'var(--bb-brand-blue)' : 'transparent',
                transition: 'all 0.15s',
              })}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} style={{ opacity: isActive ? 1 : 0.7 }} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
          v0.0.1
        </div>
      </aside>
    </>
  )
}
