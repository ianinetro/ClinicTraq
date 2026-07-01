import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Calendar, CalendarDays, FileText, DollarSign, Settings, ClipboardList,
  Clipboard, Building2, Layers, BarChart3,
} from 'lucide-react'
import { clsx } from 'clsx'

type NavItem = { path: string; label: string; icon: React.ElementType }
type NavGroup = { heading: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    heading: 'Clinical',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/patients', label: 'Patients', icon: Users },
      { path: '/appointments', label: 'Appointments', icon: CalendarDays },
      { path: '/visits', label: 'Visits', icon: Calendar },
      { path: '/frontdesk', label: 'Front Desk', icon: Clipboard },
    ],
  },
  {
    heading: 'Billing',
    items: [
      { path: '/claims', label: 'Claims', icon: FileText },
      { path: '/billing', label: 'Billing', icon: Layers },
      { path: '/payments', label: 'Payments', icon: DollarSign },
      { path: '/work-queue', label: 'Work Queue', icon: ClipboardList },
      { path: '/ar', label: 'A/R Dashboard', icon: BarChart3 },
    ],
  },
  {
    heading: 'Practice',
    items: [
      { path: '/billing/workspaces', label: 'Workspaces', icon: Building2 },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export function SideNav() {
  return (
    <nav className="w-56 flex-shrink-0 bg-[--bb-surface-card] border-r border-[--bb-border] flex flex-col py-4 z-20">
      <div className="flex-1 px-3">
        {navGroups.map((group) => (
          <div key={group.heading}>
            <p
              className="px-3 mb-1 mt-3 uppercase tracking-widest text-[--bb-text-secondary] opacity-60"
              style={{ fontSize: '10px' }}
            >
              {group.heading}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.path} {...item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  )
}

function NavItem({ path, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 relative',
          isActive
            ? 'bg-[--bb-brand-blue]/10 text-[--bb-brand-blue] font-semibold border-l-[3px] border-l-[--bb-brand-blue] pl-[9px]'
            : 'text-[--bb-text-secondary] hover:bg-[--bb-surface-app] hover:text-[--bb-text-primary]',
        )
      }
    >
      <Icon size={18} className="flex-shrink-0" />
      {label}
    </NavLink>
  )
}
