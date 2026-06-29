import { useState, Component } from 'react'
import type { ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { SideNav } from './SideNav'
import { TopNav } from './TopNav'
import { ToastProvider } from '../ui/Toast'

class PageErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(err: Error) {
    return { error: err.message }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: 'var(--bb-status-danger)', fontSize: 14 }}>
          <strong>Page error:</strong> {this.state.error}
          <br />
          <button
            style={{ marginTop: 12, padding: '6px 14px', cursor: 'pointer', fontSize: 13, borderRadius: 6, border: '1px solid var(--bb-border)', background: 'var(--bb-surface-card)' }}
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/patients': 'Patients',
  '/visits': 'Visits',
  '/claims': 'Claims',
  '/payments': 'Payments',
  '/work-queue': 'Work Queue',
  '/organization': 'Organization',
  '/settings': 'Settings',
}

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'ClinicTraq'

  return (
    <ToastProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SideNav isOpen={!sidebarCollapsed} onClose={() => setSidebarCollapsed(false)} />
        <div style={{ flex: 1, marginLeft: sidebarCollapsed ? 0 : 240, transition: 'margin-left 0.25s', display: 'flex', flexDirection: 'column' }}>
          <TopNav onMenuClick={() => setSidebarCollapsed(v => !v)} pageTitle={title} />
          <main style={{
            flex: 1,
            padding: '24px',
            background: 'var(--bb-surface-app)',
            minHeight: 'calc(100vh - 56px)',
          }}>
            <PageErrorBoundary>
              <Outlet />
            </PageErrorBoundary>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
