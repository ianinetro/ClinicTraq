import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { LoginPage } from './modules/auth/LoginPage'
import { DashboardPage } from './modules/dashboard/DashboardPage'
import { PatientsPage } from './modules/patients/PatientsPage'
import { PatientDetailPage } from './modules/patients/PatientDetailPage'
import { NewPatientPage } from './modules/patients/NewPatientPage'
import { VisitsPage } from './modules/visits/VisitsPage'
import { VisitDetailPage } from './modules/visits/VisitDetailPage'
import { VisitComposerPage } from './modules/visits/VisitComposerPage'
import { ClaimsPage } from './modules/claims/ClaimsPage'
import { ClaimDetailPage } from './modules/claims/ClaimDetailPage'
import { ClaimComposerPage } from './modules/claims/ClaimComposerPage'
import { PaymentsPage } from './modules/payments/PaymentsPage'
import { ERAReviewPage } from './modules/payments/ERAReviewPage'
import { WorkQueuePage } from './modules/work-queue/WorkQueuePage'
import { SettingsPage } from './modules/settings/SettingsPage'
import { OrgManagementPage } from './modules/organization/OrgManagementPage'
import { FrontDeskDashboardPage } from './modules/frontdesk/FrontDeskDashboardPage'
import { CheckInPage } from './modules/frontdesk/CheckInPage'
import { SchedulerPage } from './modules/frontdesk/SchedulerPage'
import { VitalsPage } from './modules/clinical/VitalsPage'
import { ProviderNotePage } from './modules/clinical/ProviderNotePage'
import { AppointmentsPage } from './modules/frontdesk/AppointmentsPage'

const AdminClinicsPage = lazy(() =>
  import('./modules/admin/AdminClinicsPage').then(m => ({ default: m.AdminClinicsPage }))
)
const ARDashboardPage = lazy(() =>
  import('./modules/ar/ARDashboardPage').then(m => ({ default: m.ARDashboardPage }))
)
const WorkspaceManagerPage = lazy(() =>
  import('./modules/billing/WorkspaceManagerPage').then(m => ({ default: m.WorkspaceManagerPage }))
)

const Fallback = () => <div style={{ padding: 40, color: '#9CA3AF', textAlign: 'center' }}>Loading…</div>

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
            <ErrorBoundary>
              <AppShell />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Patients */}
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/new" element={<NewPatientPage />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />

        {/* Visits */}
        <Route path="/visits" element={<VisitsPage />} />
        <Route path="/visits/new" element={<VisitComposerPage />} />
        <Route path="/visits/:id" element={<VisitDetailPage />} />

        {/* Claims */}
        <Route path="/claims" element={<ClaimsPage />} />
        <Route path="/claims/new" element={<ClaimComposerPage />} />
        <Route path="/claims/:id" element={<ClaimDetailPage />} />

        {/* Payments */}
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/payments/era/:id" element={<ERAReviewPage />} />

        {/* Work Queue */}
        <Route path="/work-queue" element={<WorkQueuePage />} />

        {/* Appointments */}
        <Route path="/appointments" element={<AppointmentsPage />} />

        {/* Front Desk */}
        <Route path="/frontdesk" element={<FrontDeskDashboardPage />} />
        <Route path="/frontdesk/schedule" element={<FrontDeskDashboardPage />} />
        <Route path="/frontdesk/checkin" element={<CheckInPage />} />
        <Route path="/frontdesk/scheduler" element={<SchedulerPage />} />

        {/* Clinical */}
        <Route path="/visits/:id/vitals" element={<VitalsPage />} />
        <Route path="/visits/:id/note" element={<ProviderNotePage />} />

        {/* Billing Workspace Manager */}
        <Route path="/billing/workspaces" element={<Suspense fallback={<Fallback />}><WorkspaceManagerPage /></Suspense>} />

        {/* Admin / Settings */}
        <Route path="/settings/*" element={<SettingsPage />} />
        <Route path="/organization" element={<OrgManagementPage />} />
        <Route path="/admin/clinics" element={<Suspense fallback={<Fallback />}><AdminClinicsPage /></Suspense>} />
        <Route path="/ar" element={<Suspense fallback={<Fallback />}><ARDashboardPage /></Suspense>} />
      </Route>
    </Routes>
  )
}
