import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, FileX, ShieldAlert, XCircle, Ban, Unlink,
  CircleDollarSign, Copy, Clock, UserCheck, Timer, Archive, ClipboardList,
  UserPlus, AlarmClock,
} from 'lucide-react'
import { PageHeader } from '../../components/shell/PageHeader'
import { KPICard } from '../../components/ui/KPICard'
import { Table, type ColumnDef } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Drawer } from '../../components/ui/Drawer'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PHIField } from '../../components/shared/PHIField'
import { useWorkQueue, useWorkQueueSummary } from '../../services/queries'
import { api } from '../../services/api'
import { useToast } from '../../components/ui/Toast'
import type { WorkItem, WorkQueueSummary } from '../../types'

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

export function DashboardPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
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
      cell: (row) => <span className="text-sm text-[#676687]">{row.payerName ?? '—'}</span>,
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (row) => row.amount != null ? (
        <span className="text-sm tabular-nums">${row.amount.toFixed(2)}</span>
      ) : <span className="text-[#BABACE]">—</span>,
    },
    {
      id: 'age',
      header: 'Age',
      align: 'right',
      sortable: true,
      cell: (row) => (
        <span className={`text-sm tabular-nums ${row.ageInDays > 30 ? 'text-[#B91C1C]' : row.ageInDays > 14 ? 'text-[#B45309]' : 'text-[#676687]'}`}>
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
          <Button
            size="xs"
            variant="secondary"
            onClick={() => handleAssign(row)}
          >
            Assign
          </Button>
          <Button
            size="xs"
            variant="tertiary"
            onClick={() => handleSnooze(row)}
          >
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

  const totalOpen = summary ? Object.values(summary as unknown as Record<string, number>).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        eyebrow="Billing Operations"
        title="Work Queue"
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
              <span className="text-sm text-[#676687]">Filtered:</span>
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
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Issue</p>
              <p className="text-sm text-[#12122C]">{selectedItem.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Priority</p>
                <StatusBadge status={selectedItem.priority} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Status</p>
                <StatusBadge status={selectedItem.status} />
              </div>
            </div>
            {selectedItem.patient && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Patient</p>
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
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Payer</p>
                <p className="text-sm">{selectedItem.payerName}</p>
              </div>
            )}
            {selectedItem.amount != null && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Amount</p>
                <p className="text-sm tabular-nums">${selectedItem.amount.toFixed(2)}</p>
              </div>
            )}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Age</p>
              <p className={`text-sm ${selectedItem.ageInDays > 30 ? 'text-[#B91C1C] font-semibold' : ''}`}>
                {selectedItem.ageInDays} days
              </p>
            </div>
            {selectedItem.nextAction && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Next Action</p>
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
