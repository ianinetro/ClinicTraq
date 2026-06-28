import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { PageHeader } from '../../components/shell/PageHeader'
import { Table, type ColumnDef } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { SearchInput } from '../../components/shared/SearchInput'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PHIField } from '../../components/shared/PHIField'
import { useVisits } from '../../services/queries'
import type { Visit } from '../../types'

export function VisitsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading, error } = useVisits({
    search: search || undefined,
    status: statusFilter || undefined,
    page,
    pageSize: 25,
  })

  const columns: ColumnDef<Visit>[] = [
    {
      id: 'visitDate',
      header: 'Visit Date',
      sortable: true,
      width: '120px',
      cell: (row) => (
        <span className="text-sm text-[#12122C] tabular-nums">
          {row.visitDate ? format(new Date(row.visitDate), 'MM/dd/yyyy') : '—'}
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
      id: 'provider',
      header: 'Provider',
      cell: (row) => row.provider ? (
        <span className="text-sm text-[#12122C]">
          {row.provider.firstName} {row.provider.lastName}{row.provider.credentials ? `, ${row.provider.credentials}` : ''}
        </span>
      ) : <span className="text-[#BABACE]">—</span>,
    },
    {
      id: 'visitType',
      header: 'Type',
      cell: (row) => <span className="text-sm text-[#676687]">{row.visitType}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      id: 'totalCharges',
      header: 'Charges',
      align: 'right',
      cell: (row) => (
        <span className="text-sm tabular-nums">
          {row.totalCharges > 0 ? `$${row.totalCharges.toFixed(2)}` : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      width: '80px',
      cell: (row) => (
        <Button
          size="xs"
          variant="secondary"
          onClick={(e) => { e.stopPropagation(); navigate(`/visits/${row.id}`) }}
        >
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Visits"
        description="Manage clinical visits and charge entries"
        primaryAction={{
          label: 'New Visit',
          icon: <Plus size={15} />,
          onClick: () => navigate('/visits/new'),
        }}
      />

      <Table<Visit>
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        error={error ? 'Failed to load visits.' : undefined}
        total={data?.total ?? 0}
        page={page}
        pageSize={25}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/visits/${row.id}`)}
        getRowId={(row) => row.id}
        emptyTitle="No visits found"
        emptyDescription="Try adjusting your search or create a new visit."
        emptyAction={{ label: 'New Visit', onClick: () => navigate('/visits/new') }}
        toolbar={
          <div className="flex items-center gap-3 w-full">
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              placeholder="Search visits…"
              className="w-72"
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="h-9 border border-[#BABACE] rounded-md text-sm px-2 text-[#12122C] bg-white outline-none focus:border-[#3F4CFF]"
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        }
      />
    </div>
  )
}
