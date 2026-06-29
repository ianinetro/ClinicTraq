import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, FileX, ShieldAlert, XCircle, Ban, Unlink,
  CircleDollarSign, Copy, Clock, UserCheck, Timer, Archive, ClipboardList,
  UserPlus, AlarmClock, Users, FileText, MessageSquare, ListChecks,
  CalendarCheck, CheckSquare, ShieldCheck, DollarSign, PlusCircle,
  CalendarPlus,
} from 'lucide-react'
import { PageHeader } from '../../components/shell/PageHeader'
import { KPICard } from '../../components/ui/KPICard'
import { Table, type ColumnDef } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Drawer } from '../../components/ui/Drawer'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PHIField } from '../../components/shared/PHIField'
import { useWorkQueue, useWorkQueueSummary, useVisits, usePatients } from '../../services/queries'
import { api } from '../../services/api'
import { useToast } from '../../components/ui/Toast'
import { useAuthStore } from '../../stores/authStore'
import type { WorkItem, WorkQueueSummary, Visit, Patient } from '../../types'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value: string | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(value: string | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function greetingWord(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formattedToday(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// KPI tile data for billing dashboard
// ---------------------------------------------------------------------------

const kpiDefs: {
  key: keyof WorkQueueSummary
  label: string
  icon: React.ElementType
  accentColor: string
  filterType: string
}[] = [
  { key: 'visitMissingInsurance', label: 'Visit Missing Insurance', icon: AlertTriangle, accentColor: '#B45309', filterType: 'visit-missing-insurance' },
  { key: 'visitChargesNoClaim', label: 'Visit Charges No Claim', icon: FileX, accentColor: '#B45309', filterType: 'visit-charges-no-claim' },
  { key: 'claimValidationFailed', label: 'Claim Validation Failed', icon: ShieldAlert, accentColor: '#B91C1C', filterType: 'claim-validation-failed' },
  { key: 'claimRejected', label: 'Claim Rejected', icon: XCircle, accentColor: '#B91C1C', filterType: 'claim-rejected' },
  { key: 'claimDenied', label: 'Claim Denied', icon: Ban, accentColor: '#B91C1C', filterType: 'claim-denied' },
  { key: 'eraUnmatched', label: 'ERA Unmatched', icon: Unlink, accentColor: '#007998', filterType: 'era-unmatched' },
  { key: 'paymentUnapplied', label: 'Payment Unapplied', icon: CircleDollarSign, accentColor: '#007998', filterType: 'payment-unapplied' },
  { key: 'secondaryClaimNeeded', label: 'Secondary Claim Needed', icon: Copy, accentColor: '#676687', filterType: 'secondary-claim-needed' },
  { key: 'noPay', label: 'No Payer Response', icon: Clock, accentColor: '#676687', filterType: 'no-payer-response' },
  { key: 'patientBalance', label: 'Patient Balance Remaining', icon: UserCheck, accentColor: '#047857', filterType: 'patient-balance-remaining' },
  { key: 'nearTfl', label: 'Near TFL', icon: Timer, accentColor: '#DC2626', filterType: 'near-tfl' },
  { key: 'staleClaim', label: 'Stale Claims', icon: Archive, accentColor: '#676687', filterType: 'stale-claim' },
  { key: 'missingSuperBill', label: 'Missing Superbills', icon: ClipboardList, accentColor: '#B45309', filterType: 'missing-superbill' },
]

const priorityColors: Record<string, string> = {
  critical: 'text-[#B91C1C] font-semibold',
  high: 'text-[#B45309] font-semibold',
  medium: 'text-[#676687]',
  low: 'text-[#BABACE]',
}

// ---------------------------------------------------------------------------
// BillingDashboard
// ---------------------------------------------------------------------------

function BillingDashboard() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { user } = useAuthStore()
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data: summary, isLoading: summaryLoading } = useWorkQueueSummary()
  const { data: workQueue, isLoading: queueLoading } = useWorkQueue({
    type: typeFilter,
    page,
    pageSize: 25,
  })

  const columns: ColumnDef<WorkItem>[] = [
    {
      id: 'priority',
      header: 'Priority',
      sortable: true,
      width: '90px',
      cell: (row) => (
        <span className={priorityColors[row.priority] ?? ''}>
          {row.priority.charAt(0).toUpperCase() + row.priority.slice(1)}
        </span>
      ),
    },
    {
      id: 'patient',
      header: 'Patient',
      cell: (row) => row.patient ? (
        <PHIField
          value={`${row.patient.firstName} ${row.patient.lastName}`}
          fieldName="Patient Name"
          patientId={row.patientId}
          fieldType="name"
          inline
        />
      ) : <span className="text-[#BABACE]">—</span>,
    },
    {
      id: 'type',
      header: 'Issue',
      cell: (row) => <span className="text-sm text-[#12122C]">{row.description}</span>,
    },
    {
      id: 'payer',
      header: 'Payer',
      cell: (row) => <span className="text-sm text-[#6B6B8A]">{row.payerName ?? '—'}</span>,
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (row) => row.amount != null ? (
        <span className="text-sm tabular-nums">${(row.amount ?? 0).toFixed(2)}</span>
      ) : <span className="text-[#BABACE]">—</span>,
    },
    {
      id: 'age',
      header: 'Age',
      align: 'right',
      sortable: true,
      cell: (row) => (
        <span className={`text-sm tabular-nums ${row.ageInDays > 30 ? 'text-[#B91C1C]' : row.ageInDays > 14 ? 'text-[#B45309]' : 'text-[#6B6B8A]'}`}>
          {row.ageInDays}d
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      id: 'actions',
      header: '',
      width: '120px',
      cell: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="xs" variant="secondary" onClick={() => handleAssign(row)}>Assign</Button>
          <Button size="xs" variant="tertiary" onClick={() => handleSnooze(row)}>
            <AlarmClock size={12} />
          </Button>
        </div>
      ),
    },
  ]

  async function handleAssign(item: WorkItem) {
    try {
      await api.workQueue.assign(item.id, 'me')
      addToast({ variant: 'success', message: 'Item assigned successfully.' })
    } catch {
      addToast({ variant: 'error', message: 'Failed to assign item.' })
    }
  }

  async function handleSnooze(item: WorkItem) {
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    try {
      await api.workQueue.snooze(item.id, until)
      addToast({ variant: 'success', message: 'Item snoozed for 24 hours.' })
    } catch {
      addToast({ variant: 'error', message: 'Failed to snooze item.' })
    }
  }

  function handleRowClick(item: WorkItem) {
    setSelectedItem(item)
    setDrawerOpen(true)
  }

  const totalOpen = summary
    ? Object.values(summary).filter((v): v is number => typeof v === 'number').reduce((a, b) => a + b, 0)
    : 0


  const displayName = user?.name ?? 'there'

  return (
    <div className="p-6 space-y-6">
      {/* Welcome header */}
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6B6B8A] mb-1">
            Billing Operations
          </p>
          <h1 className="text-2xl font-[650] text-[#12122C] leading-8">
            {greetingWord()}, {displayName}
          </h1>
          <p className="text-sm text-[#6B6B8A] mt-0.5">{formattedToday()}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-[#6B6B8A]">{totalOpen} open items</p>
        </div>
      </div>

      <PageHeader
        eyebrow="Work Queue"
        title="Open Items"
        description={`${totalOpen} open items across all categories`}
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {kpiDefs.map((kpi) => (
          <KPICard
            key={kpi.key}
            label={kpi.label}
            value={summaryLoading ? '—' : (summary?.[kpi.key] ?? 0)}
            loading={summaryLoading}
            accentColor={kpi.accentColor}
            onClick={() => setTypeFilter(typeFilter === kpi.filterType ? undefined : kpi.filterType)}
            className={typeFilter === kpi.filterType ? 'ring-2 ring-[#0410BD]' : ''}
          />
        ))}
      </div>

      {/* Work Queue Table */}
      <Table<WorkItem>
        columns={columns}
        data={workQueue?.items ?? []}
        loading={queueLoading}
        total={workQueue?.total ?? 0}
        page={page}
        pageSize={25}
        onPageChange={setPage}
        onRowClick={handleRowClick}
        getRowId={(row) => row.id}
        emptyTitle="No open work items"
        emptyDescription="All billing items are up to date."
        toolbar={
          typeFilter ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#6B6B8A]">Filtered:</span>
              <span className="text-sm font-medium text-[#0410BD]">
                {kpiDefs.find(k => k.filterType === typeFilter)?.label}
              </span>
              <Button size="xs" variant="tertiary" onClick={() => setTypeFilter(undefined)}>
                Clear filter
              </Button>
            </div>
          ) : null
        }
      />

      {/* Detail Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Work Item Detail"
        width={480}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)}>Close</Button>
            {selectedItem?.claimId && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => { navigate(`/claims/${selectedItem.claimId}`); setDrawerOpen(false) }}
              >
                View Claim
              </Button>
            )}
            {selectedItem?.visitId && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => { navigate(`/visits/${selectedItem.visitId}`); setDrawerOpen(false) }}
              >
                View Visit
              </Button>
            )}
          </>
        }
      >
        {selectedItem && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6B8A] mb-1">Issue</p>
              <p className="text-sm text-[#12122C]">{selectedItem.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6B8A] mb-1">Priority</p>
                <StatusBadge status={selectedItem.priority} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6B8A] mb-1">Status</p>
                <StatusBadge status={selectedItem.status} />
              </div>
            </div>
            {selectedItem.patient && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6B8A] mb-1">Patient</p>
                <PHIField
                  value={`${selectedItem.patient.firstName} ${selectedItem.patient.lastName}`}
                  fieldName="Patient Name"
                  patientId={selectedItem.patientId}
                  fieldType="name"
                />
              </div>
            )}
            {selectedItem.payerName && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6B8A] mb-1">Payer</p>
                <p className="text-sm">{selectedItem.payerName}</p>
              </div>
            )}
            {selectedItem.amount != null && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6B8A] mb-1">Amount</p>
                <p className="text-sm tabular-nums">${(selectedItem.amount ?? 0).toFixed(2)}</p>
              </div>
            )}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6B8A] mb-1">Age</p>
              <p className={`text-sm ${selectedItem.ageInDays > 30 ? 'text-[#B91C1C] font-semibold' : ''}`}>
                {selectedItem.ageInDays} days
              </p>
            </div>
            {selectedItem.nextAction && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6B8A] mb-1">Next Action</p>
                <p className="text-sm">{selectedItem.nextAction}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => handleAssign(selectedItem)}>
                <UserPlus size={14} />
                Assign to Me
              </Button>
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => handleSnooze(selectedItem)}>
                <AlarmClock size={14} />
                Snooze 24h
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DoctorDashboard
// ---------------------------------------------------------------------------

function DoctorDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const today = todayISO()

  // Today's visits
  const { data: todayVisitsData, isLoading: visitsLoading } = useVisits({
    status: undefined,
    page: 1,
    pageSize: 50,
  })

  // Recent patients
  const { data: patientsData, isLoading: patientsLoading } = usePatients({
    page: 1,
    pageSize: 10,
  })

  // Filter visits to today
  const todayVisits = (todayVisitsData?.items ?? [] as Visit[]).filter(
    (v) => v.visitDate?.slice(0, 10) === today
  )
  const openCharts = todayVisits.filter((v) => v.status === 'in-progress' || v.status === 'checked-in').length

  // Build last name for greeting
  const lastName = user?.name?.split(' ').slice(-1)[0] ?? user?.name ?? 'Doctor'

  const visitColumns: ColumnDef<Visit>[] = [
    {
      id: 'time',
      header: 'Time',
      width: '80px',
      cell: (row) => (
        <span className="text-sm tabular-nums text-[#6B6B8A]">{formatTime(row.visitDate)}</span>
      ),
    },
    {
      id: 'patient',
      header: 'Patient',
      cell: (row) => row.patient ? (
        <PHIField
          value={`${row.patient.firstName} ${row.patient.lastName}`}
          fieldName="Patient Name"
          patientId={row.patientId}
          fieldType="name"
          inline
        />
      ) : <span className="text-[#BABACE]">—</span>,
    },
    {
      id: 'dob',
      header: 'DOB',
      width: '110px',
      cell: (row) => (
        <span className="text-sm text-[#6B6B8A]">
          {row.patient?.dateOfBirth ? formatDate(row.patient.dateOfBirth) : '—'}
        </span>
      ),
    },
    {
      id: 'visitType',
      header: 'Visit Type',
      cell: (row) => <span className="text-sm text-[#12122C]">{row.visitType ?? '—'}</span>,
    },
    {
      id: 'chiefComplaint',
      header: 'Chief Complaint',
      cell: (row) => (
        <span className="text-sm text-[#6B6B8A] truncate max-w-[180px] block">
          {row.notes ?? '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      id: 'action',
      header: '',
      width: '100px',
      cell: (row) => (
        <Button
          size="xs"
          variant="secondary"
          onClick={(e) => { e.stopPropagation(); navigate(`/visits/${row.id}`) }}
        >
          Open Chart
        </Button>
      ),
    },
  ]

  const patientColumns: ColumnDef<Patient>[] = [
    {
      id: 'name',
      header: 'Patient Name',
      cell: (row) => (
        <PHIField
          value={`${row.firstName} ${row.lastName}`}
          fieldName="Patient Name"
          patientId={row.id}
          fieldType="name"
          inline
        />
      ),
    },
    {
      id: 'mrn',
      header: 'MRN',
      width: '120px',
      cell: (row) => <span className="text-sm tabular-nums text-[#6B6B8A]">{row.accountNumber}</span>,
    },
    {
      id: 'dob',
      header: 'DOB',
      width: '110px',
      cell: (row) => (
        <span className="text-sm text-[#6B6B8A]">{formatDate(row.dateOfBirth)}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6B6B8A] mb-1">
            Clinical Dashboard
          </p>
          <h1 className="text-2xl font-[650] text-[#12122C] leading-8">
            {greetingWord()}, Dr. {lastName}
          </h1>
          <p className="text-sm text-[#6B6B8A] mt-0.5">{formattedToday()}</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<PlusCircle size={14} />}
          onClick={() => navigate('/visits/new')}
        >
          New Visit
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Today's Patients"
          value={visitsLoading ? '—' : todayVisits.length}
          icon={<Users size={18} />}
        />
        <KPICard
          label="Open Charts"
          value={visitsLoading ? '—' : openCharts}
          icon={<FileText size={18} />}
        />
        <KPICard
          label="Pending Orders"
          value="—"
          icon={<ListChecks size={18} />}
        />
        <KPICard
          label="Messages"
          value="—"
          icon={<MessageSquare size={18} />}
        />
      </div>

      {/* Today's Patients */}
      <div
        className="rounded-[--bb-radius-lg] border border-[#E0E0EF] bg-[#FFFFFF]"
        style={{ boxShadow: 'var(--bb-shadow-sm)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E0E0EF]">
          <h2 className="text-sm font-semibold text-[#12122C]">Today's Patients</h2>
          <span className="text-xs text-[#6B6B8A]">{todayVisits.length} scheduled</span>
        </div>
        <Table<Visit>
          columns={visitColumns}
          data={todayVisits}
          loading={visitsLoading}
          total={todayVisits.length}
          page={1}
          pageSize={50}
          onPageChange={() => undefined}
          getRowId={(row) => row.id}
          onRowClick={(row) => navigate(`/visits/${row.id}`)}
          emptyTitle="No visits today"
          emptyDescription="No patients are scheduled for today."
        />
      </div>

      {/* Recent Patients */}
      <div
        className="rounded-[--bb-radius-lg] border border-[#E0E0EF] bg-[#FFFFFF]"
        style={{ boxShadow: 'var(--bb-shadow-sm)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E0E0EF]">
          <h2 className="text-sm font-semibold text-[#12122C]">Recent Patients</h2>
          <Button size="xs" variant="tertiary" onClick={() => navigate('/patients')}>
            View all
          </Button>
        </div>
        <Table<Patient>
          columns={patientColumns}
          data={patientsData?.items ?? []}
          loading={patientsLoading}
          total={patientsData?.total ?? 0}
          page={1}
          pageSize={10}
          onPageChange={() => undefined}
          getRowId={(row) => row.id}
          onRowClick={(row) => navigate(`/patients/${row.id}`)}
          emptyTitle="No recent patients"
          emptyDescription="No patient records found."
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FrontDeskDashboard
// ---------------------------------------------------------------------------

function FrontDeskDashboard() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { user } = useAuthStore()
  const today = todayISO()

  const { data: visitsData, isLoading: visitsLoading } = useVisits({
    page: 1,
    pageSize: 100,
  })

  const todayVisits = (visitsData?.items ?? [] as Visit[]).filter(
    (v) => v.visitDate?.slice(0, 10) === today
  )

  const scheduledCount = todayVisits.filter((v) => v.status === 'scheduled').length
  const checkedInCount = todayVisits.filter((v) => v.status === 'checked-in' || v.status === 'in-progress').length

  async function handleCheckIn(visit: Visit) {
    try {
      await api.visits.update(visit.id, { status: 'in_progress' })
      addToast({ variant: 'success', message: 'Patient checked in.' })
    } catch {
      addToast({ variant: 'error', message: 'Failed to check in patient.' })
    }
  }

  const displayName = user?.name ?? 'there'

  const scheduleColumns: ColumnDef<Visit>[] = [
    {
      id: 'time',
      header: 'Time',
      width: '80px',
      cell: (row) => (
        <span className="text-sm tabular-nums text-[#6B6B8A]">{formatTime(row.visitDate)}</span>
      ),
    },
    {
      id: 'patient',
      header: 'Patient',
      cell: (row) => row.patient ? (
        <PHIField
          value={`${row.patient.firstName} ${row.patient.lastName}`}
          fieldName="Patient Name"
          patientId={row.patientId}
          fieldType="name"
          inline
        />
      ) : <span className="text-[#BABACE]">—</span>,
    },
    {
      id: 'apptType',
      header: 'Appointment Type',
      cell: (row) => <span className="text-sm text-[#12122C]">{row.visitType ?? '—'}</span>,
    },
    {
      id: 'provider',
      header: 'Provider',
      cell: (row) => row.provider ? (
        <span className="text-sm text-[#6B6B8A]">
          Dr. {row.provider.lastName}
        </span>
      ) : <span className="text-[#BABACE]">—</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      id: 'action',
      header: '',
      width: '100px',
      cell: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {row.status === 'scheduled' ? (
            <Button
              size="xs"
              variant="primary"
              onClick={() => void handleCheckIn(row)}
            >
              Check In
            </Button>
          ) : (
            <Button
              size="xs"
              variant="secondary"
              onClick={() => navigate(`/visits/${row.id}`)}
            >
              View
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6B6B8A] mb-1">
          Front Desk
        </p>
        <h1 className="text-2xl font-[650] text-[#12122C] leading-8">
          {greetingWord()}, {displayName}
        </h1>
        <p className="text-sm text-[#6B6B8A] mt-0.5">{formattedToday()}</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Scheduled Today"
          value={visitsLoading ? '—' : scheduledCount}
          icon={<CalendarCheck size={18} />}
        />
        <KPICard
          label="Checked In"
          value={visitsLoading ? '—' : checkedInCount}
          icon={<CheckSquare size={18} />}
        />
        <KPICard
          label="Pending Eligibility"
          value="—"
          icon={<ShieldCheck size={18} />}
        />
        <KPICard
          label="New Patients This Week"
          value="—"
          icon={<UserPlus size={18} />}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-[#12122C] mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickActionCard
            icon={<UserPlus size={24} />}
            label="Register New Patient"
            description="Add a new patient to the system"
            onClick={() => navigate('/patients/new')}
          />
          <QuickActionCard
            icon={<CalendarPlus size={24} />}
            label="Schedule Appointment"
            description="Book a new visit"
            onClick={() => navigate('/visits/new')}
          />
          <QuickActionCard
            icon={<ShieldCheck size={24} />}
            label="Verify Eligibility"
            description="Check insurance coverage"
            onClick={() => addToast({ variant: 'info', message: 'Eligibility check coming soon.' })}
          />
          <QuickActionCard
            icon={<DollarSign size={24} />}
            label="Collect Copay"
            description="Record a patient payment"
            onClick={() => addToast({ variant: 'info', message: 'Copay collection coming soon.' })}
          />
        </div>
      </div>

      {/* Today's Schedule */}
      <div
        className="rounded-[--bb-radius-lg] border border-[#E0E0EF] bg-[#FFFFFF]"
        style={{ boxShadow: 'var(--bb-shadow-sm)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E0E0EF]">
          <h2 className="text-sm font-semibold text-[#12122C]">Today's Schedule</h2>
          <span className="text-xs text-[#6B6B8A]">{todayVisits.length} appointments</span>
        </div>
        <Table<Visit>
          columns={scheduleColumns}
          data={todayVisits}
          loading={visitsLoading}
          total={todayVisits.length}
          page={1}
          pageSize={100}
          onPageChange={() => undefined}
          getRowId={(row) => row.id}
          onRowClick={(row) => navigate(`/visits/${row.id}`)}
          emptyTitle="No appointments today"
          emptyDescription="The schedule is clear for today."
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// QuickActionCard (used by FrontDeskDashboard)
// ---------------------------------------------------------------------------

interface QuickActionCardProps {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}

function QuickActionCard({ icon, label, description, onClick }: QuickActionCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-3 p-4 rounded-[--bb-radius-lg] bg-[#FFFFFF] border border-[#E0E0EF] hover:border-[#0410BD] hover:bg-[#F5F6FF] transition-colors text-left w-full"
      style={{ boxShadow: 'var(--bb-shadow-sm)' }}
    >
      <span className="text-[#0410BD]">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-[#12122C]">{label}</p>
        <p className="text-xs text-[#6B6B8A] mt-0.5">{description}</p>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// DashboardPage — role router
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const { user } = useAuthStore()

  const isBillerBay = !!(user?.billingRole || user?.mgmtRole || user?.role === 'superuser')
  const isDoctor = user?.clinicRole === 'doctor' || user?.clinicRole === 'nurse'
  const isFrontDesk = user?.clinicRole === 'front_desk' || user?.clinicRole === 'medical_assistant'

  if (isBillerBay || (!isDoctor && !isFrontDesk)) return <BillingDashboard />
  if (isDoctor) return <DoctorDashboard />
  return <FrontDeskDashboard />
}

