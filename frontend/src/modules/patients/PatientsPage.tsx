import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { format } from 'date-fns'
import { PageHeader } from '../../components/shell/PageHeader'
import { Table, type ColumnDef } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { SearchInput } from '../../components/shared/SearchInput'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { usePatients } from '../../services/queries'
import type { Patient } from '../../types'

export function PatientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const enabled = search.trim().length >= 2

  const { data, isLoading, error } = usePatients({
    search: search || undefined,
    page,
    pageSize: 25,
    enabled,
  })

  const columns: ColumnDef<Patient>[] = [
    {
      id: 'accountNumber',
      header: 'Account #',
      width: '110px',
      cell: (row) => (
        <span className="text-sm font-mono text-[--bb-text-secondary]">{row.accountNumber}</span>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      cell: (row) => (
        <span className="text-sm font-medium text-[--bb-text-primary]">{row.firstName} {row.lastName}</span>
      ),
    },
    {
      id: 'dob',
      header: 'Date of Birth',
      cell: (row) => (
        <span className="text-sm tabular-nums text-[--bb-text-secondary]">{row.dateOfBirth ? format(new Date(row.dateOfBirth), 'MM/dd/yyyy') : '—'}</span>
      ),
    },
    {
      id: 'insurance',
      header: 'Insurance',
      cell: (_row) => (
        <span className="text-sm text-[--bb-text-secondary]">—</span>
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

      {!enabled ? (
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[--bb-surface-app]">
            <Search size={28} className="text-[--bb-text-secondary]" />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-lg font-semibold text-[--bb-text-primary]">Find a Patient</h2>
            <p className="text-sm text-[--bb-text-secondary]">Search by name, date of birth, MRN, or account number</p>
          </div>
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
            placeholder="Search patients…"
            className="w-full max-w-md"
          />
          <Button
            variant="primary"
            leftIcon={<Plus size={15} />}
            onClick={() => navigate('/patients/new')}
          >
            New Patient
          </Button>
        </div>
      ) : (
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
          emptyTitle={`No patients found for '${search}'`}
          emptyDescription="Try a different name, DOB, MRN, or account number."
          toolbar={
            <div className="flex items-center gap-3 w-full">
              <SearchInput
                value={search}
                onChange={(v) => { setSearch(v); setPage(1) }}
                placeholder="Search patients…"
                className="w-72"
              />
              {data?.total != null && (
                <span className="text-sm text-[--bb-text-secondary]">{data.total} result{data.total !== 1 ? 's' : ''}</span>
              )}
            </div>
          }
        />
      )}
    </div>
  )
}
