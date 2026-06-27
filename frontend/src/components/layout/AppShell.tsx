import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { SideNav } from './SideNav'
import { TopNav } from './TopNav'
import { ToastProvider } from '../ui/Toast'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/patients': 'Patients',
  '/visits': 'Visits',
  '/claims': 'Claims',
  '/payments': 'Payments',
  '/work-queue': 'Work Queue',
  '/settings': 'Settings',
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'ClinicTraq'

  return (
    <ToastProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SideNav isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div style={{ flex: 1, marginLeft: 240, display: 'flex', flexDirection: 'column' }}>
          <TopNav onMenuClick={() => setSidebarOpen(v => !v)} pageTitle={title} />
          <main style={{
            flex: 1,
            marginTop: 56,
            padding: '24px',
            background: 'var(--bb-surface-app)',
            minHeight: 'calc(100vh - 56px)',
          }}>
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
