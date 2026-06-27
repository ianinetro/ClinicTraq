import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Wrench } from 'lucide-react'
import { PageHeader } from '../../components/shell/PageHeader'
import { Table, type ColumnDef } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Drawer } from '../../components/ui/Drawer'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PHIField } from '../../components/shared/PHIField'
import { useClaims } from '../../services/queries'
import type { Claim } from '../../types'

export function ClaimRepairQueue() {
  const navigate = useNavigate()
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useClaims({
    status: 'rejected,denied',
    page,
    pageSize: 25,
  })

  const columns: ColumnDef<Claim>[] = [
    {
      id: 'claimNumber',
      header: 'Claim #',
      width: '120px',
      cell: (row) => <span className="font-mono text-sm text-[#0410BD]">{row.claimNumber}</span>,
    },
    {
      id: 'patient',
      header: 'Patient',
      cell: (row) => row.patient ? (
        <PHIField value={`${row.patient.firstName} ${row.patient.lastName}`} />
      ) : <span className="text-[#BABACE]">—</span>,
    },
    {
      id: 'payer',
      header: 'Payer',
      cell: (row) => <span className="text-sm">{row.payerName}</span>,
    },
    {
      id: 'rejectionReason',
      header: 'Reason',
      cell: (row) => (
        <span className="text-sm text-[#B91C1C]">
          {row.validationErrors?.[0]?.message ?? 'See claim detail'}
        </span>
      ),
    },
    {
      id: 'age',
      header: 'Age',
      width: '70px',
      cell: (row) => {
        const days = row.dos ? Math.floor((Date.now() - new Date(row.dos).getTime()) / 86400000) : 0
        return (
          <span className={`text-sm tabular-nums ${days > 30 ? 'text-[#B91C1C] font-semibold' : 'text-[#676687]'}`}>
            {days}d
          </span>
        )
      },
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
          variant="primary"
          leftIcon={<Wrench size={11} />}
          onClick={(e) => { e.stopPropagation(); setSelectedClaim(row); setDrawerOpen(true) }}
        >
          Fix
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        eyebrow="Claims"
        title="Repair Queue"
        description="Rejected and denied claims needing correction"
      />

      <Table<Claim>
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        total={data?.total ?? 0}
        page={page}
        pageSize={25}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/claims/${row.id}`)}
        getRowId={(row) => row.id}
        emptyTitle="No claims in repair queue"
        emptyDescription="All claims are current."
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Fix Claim"
        width={520}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)}>Close</Button>
            <Button variant="primary" size="sm" onClick={() => selectedClaim && navigate(`/claims/${selectedClaim.id}`)}>
              Open Full Editor
            </Button>
          </>
        }
      >
        {selectedClaim && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Claim</p>
              <p className="font-mono font-bold">{selectedClaim.claimNumber}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-2">Issues to Fix</p>
              {selectedClaim.validationErrors?.map(e => (
                <div key={e.id} className="bg-[#FEF2F2] border border-[#FECACA] rounded p-2.5 mb-2">
                  <p className="text-xs font-semibold text-[#B91C1C]">{e.message}</p>
                  {e.suggestion && <p className="text-xs text-[#676687] mt-0.5">{e.suggestion}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
