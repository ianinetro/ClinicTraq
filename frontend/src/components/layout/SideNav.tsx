import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Calendar, FileText,
  DollarSign, AlertCircle, Settings, Building2,
  BarChart3, ClipboardList, X, Stethoscope, Briefcase,
  MonitorCheck,
} from 'lucide-react'
import { useAuthStore, type UserContext } from '../../stores/authStore'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const BILLING_GROUP: NavGroup = {
  title: 'Billing Operations',
  items: [
    { to: '/billing/workspaces', label: 'Workspaces', icon: Briefcase },
    { to: '/patients', label: 'Patients', icon: Users },
    { to: '/claims', label: 'Claims', icon: FileText },
    { to: '/payments', label: 'Payments', icon: DollarSign },
    { to: '/ar', label: 'A/R Aging', icon: BarChart3 },
    { to: '/work-queue', label: 'Work Queue', icon: AlertCircle },
    { to: '/admin/clinics', label: 'All Clinics', icon: Building2 },
  ],
}

const CLINICAL_GROUP: NavGroup = {
  title: 'Clinical',
  items: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/patients', label: 'My Patients', icon: Users },
    { to: '/visits', label: 'Visits', icon: Calendar },
    { to: '/visits/new', label: 'New Visit', icon: Stethoscope },
    { to: '/work-queue', label: 'Work Queue', icon: AlertCircle },
  ],
}

const FRONT_OFFICE_GROUP: NavGroup = {
  title: 'Front Office',
  items: [
    { to: '/frontdesk', label: 'Front Desk', icon: MonitorCheck },
    { to: '/patients', label: 'Patients', icon: Users },
    { to: '/visits', label: 'Visits', icon: Calendar },
    { to: '/claims', label: 'Claims', icon: FileText },
    { to: '/work-queue', label: 'Work Queue', icon: AlertCircle },
  ],
}

const CLINIC_ADMIN_GROUP: NavGroup = {
  title: 'Clinic Admin',
  items: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/patients', label: 'Patients', icon: Users },
    { to: '/visits', label: 'Visits', icon: Calendar },
    { to: '/claims', label: 'Claims', icon: FileText },
    { to: '/payments', label: 'Payments', icon: DollarSign },
    { to: '/work-queue', label: 'Work Queue', icon: AlertCircle },
    { to: '/organization', label: 'Organization', icon: Building2 },
  ],
}

const SUPERUSER_GROUPS: NavGroup[] = [
  BILLING_GROUP,
  {
    title: 'Clinical',
    items: [
      { to: '/frontdesk', label: 'Front Desk', icon: MonitorCheck },
      { to: '/patients', label: 'Patients', icon: Users },
      { to: '/visits', label: 'Visits', icon: Calendar },
    ],
  },
  {
    title: 'Clinic Admin',
    items: [
      { to: '/organization', label: 'Organization', icon: Building2 },
    ],
  },
]

const BOTTOM_ITEMS: NavItem[] = [
  { to: '/settings', label: 'Settings', icon: Settings },
]

const SUPERUSER_BOTTOM_ITEMS: NavItem[] = [
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/admin/clinics', label: 'Admin', icon: ClipboardList },
]

interface SideNavProps {
  isOpen: boolean
  onClose: () => void
}

function resolveGroups(user: UserContext | null): NavGroup[] {
  if (!user) return []

  const { role, billingRole, clinicRole, mgmtRole } = user

  // Superuser sees everything
  if (role === 'superuser') return SUPERUSER_GROUPS

  // BillerBay billing/mgmt staff
  if (
    billingRole === 'billing_admin' ||
    billingRole === 'billing_manager' ||
    mgmtRole === 'mgmt_admin'
  ) return [BILLING_GROUP]

  // Clinical staff
  if (
    clinicRole === 'doctor' ||
    clinicRole === 'nurse' ||
    clinicRole === 'medical_assistant'
  ) return [CLINICAL_GROUP]

  // Front desk
  if (clinicRole === 'front_desk') return [FRONT_OFFICE_GROUP]

  // Clinic admin/supervisor
  if (clinicRole === 'admin' || clinicRole === 'supervisor') return [CLINIC_ADMIN_GROUP]

  // Fallback: show clinical group
  return [CLINICAL_GROUP]
}

function resolveBottomItems(user: UserContext | null): NavItem[] {
  if (!user) return BOTTOM_ITEMS
  if (user.role === 'superuser') return SUPERUSER_BOTTOM_ITEMS
  return BOTTOM_ITEMS
}

const groupHeaderStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'rgba(78,110,255,0.8)',
  padding: '12px 12px 4px',
}

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: 'rgba(255,255,255,0.07)',
  margin: '8px 12px',
}

function NavItemLink({ item, onClose }: { item: NavItem; onClose: () => void }) {
  return (
    <NavLink
      key={item.to}
      to={item.to}
      onClick={onClose}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        borderRadius: 'var(--bb-radius)',
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: 500,
        color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
        background: isActive ? 'rgba(4,16,189,0.35)' : 'transparent',
        borderLeft: isActive ? '3px solid var(--bb-brand-blue)' : '3px solid transparent',
        transition: 'all 0.15s',
      })}
    >
      {({ isActive }) => (
        <>
          <item.icon
            size={17}
            style={{ color: isActive ? 'var(--bb-brand-blue)' : 'rgba(255,255,255,0.55)', flexShrink: 0 }}
          />
          {item.label}
        </>
      )}
    </NavLink>
  )
}

export function SideNav({ isOpen, onClose }: SideNavProps) {
  const user = useAuthStore(s => s.user)
  const groups = resolveGroups(user)
  const bottomItems = resolveBottomItems(user)

  return (
    <>
      <aside style={{
        position: 'fixed', left: 0, top: 0, bottom: 0,
        width: 240, zIndex: 50,
        background: 'var(--bb-brand-ink)',
        display: 'flex', flexDirection: 'column',
        transition: 'transform 0.25s',
        transform: isOpen ? 'translateX(0)' : 'translateX(-240px)',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>
              ClinicTraq
            </div>
            <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, marginTop: 2, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
              by BillerBay
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ display: 'none', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav groups */}
        <nav style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column' }}>
          {groups.map((group, gi) => (
            <div key={group.title}>
              {gi > 0 && <div style={dividerStyle} />}
              <div style={groupHeaderStyle}>{group.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.items.map(item => (
                  <NavItemLink key={`${group.title}-${item.to}`} item={item} onClose={onClose} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '8px 8px 12px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {bottomItems.map(item => (
              <NavItemLink key={item.to} item={item} onClose={onClose} />
            ))}
          </div>
          <div style={{ padding: '10px 12px 0', color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
            v0.0.1
          </div>
        </div>
      </aside>
    </>
  )
}
