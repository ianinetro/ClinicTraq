import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Calendar, FileText, DollarSign, Settings,
} from 'lucide-react'
import { clsx } from 'clsx'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/patients', label: 'Patients', icon: Users },
  { path: '/visits', label: 'Visits', icon: Calendar },
  { path: '/claims', label: 'Claims', icon: FileText },
  { path: '/payments', label: 'Payments', icon: DollarSign },
]

const bottomItems = [
  { path: '/settings', label: 'Settings', icon: Settings },
]

export function SideNav() {
  return (
    <nav className="w-[248px] flex-shrink-0 bg-white border-r border-[#E3E3F1] flex flex-col py-4 z-20">
      <div className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => (
          <NavItem key={item.path} {...item} />
        ))}
      </div>
      <div className="px-3 space-y-0.5 border-t border-[#E3E3F1] pt-3 mt-3">
        {bottomItems.map((item) => (
          <NavItem key={item.path} {...item} />
        ))}
      </div>
    </nav>
  )
}

function NavItem({ path, label, icon: Icon }: { path: string; label: string; icon: React.ElementType }) {
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150',
          'relative',
          isActive
            ? 'bg-[#EFF0FF] text-[#0410BD] border-l-[3px] border-l-[#0410BD] pl-[9px]'
            : 'text-[#676687] hover:bg-[#EFF0FF] hover:text-[#12122C]',
        )
      }
    >
      <Icon size={18} className="flex-shrink-0" />
      {label}
    </NavLink>
  )
}
