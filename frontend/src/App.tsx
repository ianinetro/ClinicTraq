import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { AppShell } from './components/shell/AppShell'
import { LoginPage } from './modules/auth/LoginPage'
import { DashboardPage } from './modules/dashboard/DashboardPage'
import { PatientsPage } from './modules/patients/PatientsPage'
import { PatientDetailPage } from './modules/patients/PatientDetailPage'
import { VisitsPage } from './modules/visits/VisitsPage'
import { VisitComposerPage } from './modules/visits/VisitComposerPage'
import { VisitDetailPage } from './modules/visits/VisitDetailPage'
import { ClaimsPage } from './modules/claims/ClaimsPage'
import { ClaimDetailPage } from './modules/claims/ClaimDetailPage'
import { PaymentsPage } from './modules/payments/PaymentsPage'
import { SettingsPage } from './modules/settings/SettingsPage'
import { ToastProvider } from './components/ui/Toast'

function AuthGuard() {
  const token = localStorage.getItem('ct_token')
  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AuthGuard />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'patients', element: <PatientsPage /> },
          { path: 'patients/:id', element: <PatientDetailPage /> },
          { path: 'visits', element: <VisitsPage /> },
          { path: 'visits/new', element: <VisitComposerPage /> },
          { path: 'visits/:id', element: <VisitDetailPage /> },
          { path: 'claims', element: <ClaimsPage /> },
          { path: 'claims/:id', element: <ClaimDetailPage /> },
          { path: 'payments/*', element: <PaymentsPage /> },
          { path: 'settings/*', element: <SettingsPage /> },
        ],
      },
    ],
  },
])

export default function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  )
}
