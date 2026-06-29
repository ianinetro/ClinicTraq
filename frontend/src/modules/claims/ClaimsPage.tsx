import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Send, RefreshCw, Plus } from 'lucide-react'
import { PageHeader } from '../../components/shell/PageHeader'
import { Table, type ColumnDef } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { SearchInput } from '../../components/shared/SearchInput'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PHIField } from '../../components/shared/PHIField'
import { useClaims } from '../../services/queries'
import { api } from '../../services/api'
import { useToast } from '../../components/ui/Toast'
import { ConfirmModal } from '../../components/ui/Modal'
import type { Claim } from '../../types'


export function ClaimsPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)
  const [batchSubmitting, setBatchSubmitting] = useState(false)

  const { data, isLoading, error, refetch } = useClaims({
    search: search || undefined,
    status: statusFilter || undefined,
    page,
    pageSize: 25,
  })

  async function handleBatchSubmit() {
    setBatchSubmitting(true)
    try {
      await api.claims.batchSubmit(Array.from(selectedIds))
      addToast({ variant: 'success', message: `${selectedIds.size} claims submitted.` })
      setSelectedIds(new Set())
      setBatchConfirmOpen(false)
      refetch()
    } catch {
      addToast({ variant: 'error', message: 'Batch submission failed. Please try again.' })
    } finally {
      setBatchSubmitting(false)
    }
  }

  const columns: ColumnDef<Claim>[] = [
    {
      id: 'claimNumber',
      header: 'Claim #',
      width: '120px',
      sortable: true,
      cell: (row) => (
        <span className="text-sm font-mono text-[#0410BD] hover:underline cursor-pointer">
          {row.claimNumber}
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
      id: 'dos',
      header: 'DOS',
      sortable: true,
      width: '100px',
      cell: (row) => (
        <span className="text-sm tabular-nums text-[#676687]">
          {row.dos ? format(new Date(row.dos), 'MM/dd/yy') : '—'}
        </span>
      ),
    },
    {
      id: 'payer',
      header: 'Payer',
      cell: (row) => <span className="text-sm text-[#12122C]">{row.payerName}</span>,
    },
    {
      id: 'totalCharges',
      header: 'Charges',
      align: 'right',
      sortable: true,
      cell: (row) => (
        <span className="text-sm tabular-nums">${(row.totalCharges ?? 0).toFixed(2)}</span>
      ),
    },
    {
      id: 'totalPaid',
      header: 'Paid',
      align: 'right',
      cell: (row) => (
        <span className="text-sm tabular-nums text-[#047857]">
          {(row.totalPaid ?? 0) > 0 ? `$${(row.totalPaid ?? 0).toFixed(2)}` : '—'}
        </span>
      ),
    },
    {
      id: 'balance',
      header: 'Balance',
      align: 'right',
      cell: (row) => (
        <span className={`text-sm tabular-nums font-medium ${row.balance > 0 ? 'text-[#B91C1C]' : 'text-[#676687]'}`}>
          ${(row.balance ?? 0).toFixed(2)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <div className="relative group">
          <StatusBadge status={row.status} size="sm" />
          {/* CPT/DX tooltip on hover */}
          {row.claimLines && row.claimLines.length > 0 && (
            <div className="absolute left-0 top-full mt-1 z-30 hidden group-hover:block bg-[#12122C] text-white text-xs rounded-lg p-3 shadow-xl min-w-56 pointer-events-none">
              <p className="font-semibold mb-1.5 text-[#A2A8FF]">CPT Codes</p>
              {row.claimLines.slice(0, 5).map((line, i) => (
                <div key={i} className="flex gap-2 mb-0.5">
                  <span className="font-mono text-[#94F2FA]">{line.cptCode}</span>
                  <span className="text-white/60 text-[10px] truncate">{line.cptDescription}</span>
                  {line.modifiers.filter(Boolean).length > 0 && (
                    <span className="text-[#A2A8FF] font-mono">{line.modifiers.filter(Boolean).join(' ')}</span>
                  )}
                </div>
              ))}
              {row.visit?.diagnoses && row.visit.diagnoses.length > 0 && (
                <>
                  <p className="font-semibold mt-2 mb-1 text-[#A2A8FF]">DX Codes</p>
                  {row.visit.diagnoses.slice(0, 4).map((dx, i) => (
                    <div key={i} className="flex gap-2 mb-0.5">
                      <span className="font-mono text-[#94F2FA]">{dx.code}</span>
                      <span className="text-white/60 text-[10px] truncate">{dx.description}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'validation',
      header: 'Validation',
      cell: (row) => {
        const v = row.validationStatus
        const map = { passed: 'active', warnings: 'warning', failed: 'failed', unchecked: 'inactive' } as const
        const label = { passed: 'Passed', warnings: 'Warnings', failed: 'Failed', unchecked: 'Not Run' }
        return <Badge variant={map[v] ?? 'inactive'} size="sm">{label[v] ?? v}</Badge>
      },
    },
    {
      id: 'actions',
      header: '',
      width: '80px',
      cell: (row) => (
        <Button
          size="xs"
          variant="secondary"
          onClick={(e) => { e.stopPropagation(); navigate(`/claims/${row.id}`) }}
        >
          Open
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Claims"
        description="Manage and submit insurance claims"
        primaryAction={{
          label: 'New Claim',
          icon: <Plus size={15} />,
          onClick: () => navigate('/claims/new'),
        }}
      />

      <Table<Claim>
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        error={error ? 'Failed to load claims.' : undefined}
        total={data?.total ?? 0}
        page={page}
        pageSize={25}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/claims/${row.id}`)}
        getRowId={(row) => row.id}
        multiSelect
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyTitle="No claims found"
        emptyDescription="Claims will appear here once visits are billed."
        toolbar={
          <div className="flex items-center gap-3 w-full">
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              placeholder="Search claims…"
              className="w-72"
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="h-9 border border-[#BABACE] rounded-md text-sm px-2 text-[#12122C] bg-white outline-none focus:border-[#3F4CFF]"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="submitted">Submitted</option>
              <option value="paid">Paid</option>
              <option value="denied">Denied</option>
              <option value="rejected">Rejected</option>
            </select>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="secondary" leftIcon={<RefreshCw size={13} />} onClick={() => refetch()}>
                Refresh
              </Button>
              {selectedIds.size > 0 && (
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<Send size={13} />}
                  onClick={() => setBatchConfirmOpen(true)}
                >
                  Submit {selectedIds.size} Claims
                </Button>
              )}
            </div>
          </div>
        }
      />

      <ConfirmModal
        open={batchConfirmOpen}
        onClose={() => setBatchConfirmOpen(false)}
        onConfirm={handleBatchSubmit}
        title={`Submit ${selectedIds.size} Claims`}
        message={`You are about to electronically submit ${selectedIds.size} claims to their respective payers. This action cannot be undone.`}
        confirmLabel="Submit Claims"
        loading={batchSubmitting}
      />
    </div>
  )
}
