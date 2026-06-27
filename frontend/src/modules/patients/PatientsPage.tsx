import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageHeader } from '../../components/shell/PageHeader'
import { Table, type ColumnDef } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { SearchInput } from '../../components/shared/SearchInput'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PHIField } from '../../components/shared/PHIField'
import { usePatients } from '../../services/queries'
import type { Patient } from '../../types'

export function PatientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading, error } = usePatients({
    search: search || undefined,
    status: statusFilter || undefined,
    page,
    pageSize: 25,
  })

  const columns: ColumnDef<Patient>[] = [
    {
      id: 'accountNumber',
      header: 'Account #',
      width: '110px',
      cell: (row) => (
        <span className="text-sm font-mono text-[#676687]">{row.accountNumber}</span>
      ),
    },
    {
      id: 'name',
      header: 'Name',
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
      id: 'dob',
      header: 'Date of Birth',
      cell: (row) => (
        <PHIField
          value={row.dateOfBirth}
          fieldName="Date of Birth"
          patientId={row.id}
          fieldType="dob"
          inline
        />
      ),
    },
    {
      id: 'insurance',
      header: 'Insurance',
      cell: (_row) => (
        <span className="text-sm text-[#676687]">—</span>
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
      width: '80px',
      cell: (row) => (
        <Button
          size="xs"
          variant="secondary"
          onClick={(e) => { e.stopPropagation(); navigate(`/patients/${row.id}`) }}
        >
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Patients"
        description="Search and manage patient records"
        primaryAction={{
          label: 'New Patient',
          icon: <Plus size={15} />,
          onClick: () => navigate('/patients/new'),
        }}
      />

      <Table<Patient>
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        error={error ? 'Failed to load patients.' : undefined}
        total={data?.total ?? 0}
        page={page}
        pageSize={25}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/patients/${row.id}`)}
        getRowId={(row) => row.id}
        emptyTitle="No patients found"
        emptyDescription="Try adjusting your search or filters."
        toolbar={
          <div className="flex items-center gap-3 w-full">
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              placeholder="Search patients…"
              className="w-72"
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="h-9 border border-[#BABACE] rounded-md text-sm px-2 text-[#12122C] bg-white outline-none focus:border-[#3F4CFF]"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        }
      />
    </div>
  )
}
