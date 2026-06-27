import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './modules/auth/LoginPage'
import { DashboardPage } from './modules/dashboard/DashboardPage'
import { PatientsPage } from './modules/patients/PatientsPage'
import { PatientDetailPage } from './modules/patients/PatientDetailPage'
import { VisitsPage } from './modules/visits/VisitsPage'
import { VisitDetailPage } from './modules/visits/VisitDetailPage'
import { ClaimsPage } from './modules/claims/ClaimsPage'
import { ClaimDetailPage } from './modules/claims/ClaimDetailPage'
import { PaymentsPage } from './modules/payments/PaymentsPage'
import { WorkQueuePage } from './modules/work-queue/WorkQueuePage'
import { SettingsPage } from './modules/settings/SettingsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route path="/visits" element={<VisitsPage />} />
        <Route path="/visits/:id" element={<VisitDetailPage />} />
        <Route path="/claims" element={<ClaimsPage />} />
        <Route path="/claims/:id" element={<ClaimDetailPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/work-queue" element={<WorkQueuePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
