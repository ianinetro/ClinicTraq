import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Eye, DollarSign } from 'lucide-react'
import { PageHeader } from '../../components/shell/PageHeader'
import { PostPaymentModal } from './PostPaymentModal'
import { Table, type ColumnDef } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
// Badge is available but not currently used directly
// import { Badge } from '../../components/ui/Badge'
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs'
import { SearchInput } from '../../components/shared/SearchInput'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { usePayments, useERAFiles } from '../../services/queries'
import type { Payment, ERAFile } from '../../types'

export function PaymentsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [eraPage, setEraPage] = useState(1)
  const [eraUploading, setEraUploading] = useState(false)

  function handleERAImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.835,.edi,.txt'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setEraUploading(true)
      try {
        const rawContent = await file.text()
        const { apiClient } = await import('../../services/api')
        await apiClient.post('/payments/era/upload', { file_name: file.name, raw_content: rawContent })
        alert(`ERA file "${file.name}" uploaded successfully. Review the ERA Files tab.`)
      } catch {
        alert('ERA upload failed. Please check the file format and try again.')
      } finally {
        setEraUploading(false)
      }
    }
    input.click()
  }

  const { data: paymentsData, isLoading: paymentsLoading } = usePayments({
    search: search || undefined,
    page,
    pageSize: 25,
  })

  const { data: eraData, isLoading: eraLoading } = useERAFiles({ page: eraPage, pageSize: 25 })
  const [showPostPayment, setShowPostPayment] = useState(false)

  const paymentColumns: ColumnDef<Payment>[] = [
    {
      id: 'paymentNumber',
      header: 'Payment #',
      width: '130px',
      cell: (row) => <span className="font-mono text-sm">{row.paymentNumber}</span>,
    },
    {
      id: 'payerName',
      header: 'Payer / Patient',
      cell: (row) => (
        <span className="text-sm text-[#12122C]">{row.payerName ?? 'Patient'}</span>
      ),
    },
    {
      id: 'checkNumber',
      header: 'Check #',
      cell: (row) => <span className="font-mono text-sm text-[#676687]">{row.checkNumber ?? '—'}</span>,
    },
    {
      id: 'checkDate',
      header: 'Check Date',
      sortable: true,
      cell: (row) => (
        <span className="text-sm tabular-nums text-[#676687]">
          {row.checkDate ? format(new Date(row.checkDate), 'MM/dd/yyyy') : '—'}
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      cell: (row) => <span className="text-sm font-medium tabular-nums">${(row.amount ?? 0).toFixed(2)}</span>,
    },
    {
      id: 'appliedAmount',
      header: 'Applied',
      align: 'right',
      cell: (row) => (
        <span className="text-sm tabular-nums text-[#047857]">${(row.appliedAmount ?? 0).toFixed(2)}</span>
      ),
    },
    {
      id: 'unappliedAmount',
      header: 'Unapplied',
      align: 'right',
      cell: (row) => (
        <span className={`text-sm tabular-nums font-medium ${row.unappliedAmount > 0 ? 'text-[#B45309]' : 'text-[#676687]'}`}>
          ${(row.unappliedAmount ?? 0).toFixed(2)}
        </span>
      ),
    },
    {
      id: 'method',
      header: 'Method',
      cell: (row) => <span className="text-sm text-[#676687] capitalize">{row.paymentMethod}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
  ]

  const eraColumns: ColumnDef<ERAFile>[] = [
    {
      id: 'filename',
      header: 'Filename',
      cell: (row) => <span className="text-sm font-mono text-[#0410BD]">{row.filename}</span>,
    },
    {
      id: 'payerName',
      header: 'Payer',
      cell: (row) => <span className="text-sm">{row.payerName}</span>,
    },
    {
      id: 'checkNumber',
      header: 'Check #',
      cell: (row) => <span className="font-mono text-sm text-[#676687]">{row.checkNumber ?? '—'}</span>,
    },
    {
      id: 'totalAmount',
      header: 'Total',
      align: 'right',
      cell: (row) => <span className="text-sm tabular-nums font-medium">${(row.totalAmount ?? 0).toFixed(2)}</span>,
    },
    {
      id: 'matched',
      header: 'Matched',
      align: 'right',
      cell: (row) => (
        <span className="text-sm tabular-nums">
          <span className="text-[#047857]">{row.matchedCount}</span>
          <span className="text-[#676687]">/{row.matchedCount + row.unmatchedCount}</span>
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      id: 'importedAt',
      header: 'Imported',
      cell: (row) => (
        <span className="text-sm text-[#676687] tabular-nums">
          {row.importedAt ? format(new Date(row.importedAt), 'MM/dd/yyyy HH:mm') : '—'}
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
          leftIcon={<Eye size={12} />}
          onClick={(e) => { e.stopPropagation(); navigate(`/payments/era/${row.id}`) }}
        >
          Review
        </Button>
      ),
    },
  ]

  return (
    <div className="p-4 space-y-3">
      <PageHeader
        title="Payments"
        description="Track insurance and patient payments, import ERA files"
        primaryAction={{
          label: 'Post Payment',
          icon: <DollarSign size={15} />,
          onClick: () => setShowPostPayment(true),
        }}
        secondaryAction={{
          label: eraUploading ? 'Uploading…' : 'Import ERA',
          onClick: handleERAImport,
        }}
      />

      <Tabs defaultTab="all">
        <TabList>
          <Tab id="all">All Payments</Tab>
          <Tab id="era">ERA Files</Tab>
          <Tab id="unapplied">Unapplied</Tab>
        </TabList>

        <TabPanel id="all" className="pt-4">
          <Table<Payment>
            columns={paymentColumns}
            data={paymentsData?.items ?? []}
            loading={paymentsLoading}
            total={paymentsData?.total ?? 0}
            page={page}
            pageSize={25}
            onPageChange={setPage}
            getRowId={(row) => row.id}
            emptyTitle="No payments found"
            emptyDescription="Payment records will appear here once posted."
            toolbar={
              <SearchInput
                value={search}
                onChange={(v) => { setSearch(v); setPage(1) }}
                placeholder="Search payments…"
                className="w-72"
              />
            }
          />
        </TabPanel>

        <TabPanel id="era" className="pt-4">
          <Table<ERAFile>
            columns={eraColumns}
            data={eraData?.items ?? []}
            loading={eraLoading}
            total={eraData?.total ?? 0}
            page={eraPage}
            pageSize={25}
            onPageChange={setEraPage}
            getRowId={(row) => row.id}
            emptyTitle="No ERA files imported"
            emptyDescription="Import an ERA file to start posting payments."
            emptyAction={{ label: 'Import ERA', onClick: handleERAImport }}
          />
        </TabPanel>

        <TabPanel id="unapplied" className="pt-4">
          <Table<Payment>
            columns={paymentColumns}
            data={(paymentsData?.items ?? [] as Payment[]).filter((p) => p.unappliedAmount > 0)}
            loading={paymentsLoading}
            total={0}
            getRowId={(row) => row.id}
            emptyTitle="No unapplied payments"
            emptyDescription="All payments have been fully applied."
          />
        </TabPanel>
      </Tabs>

      {showPostPayment && (
        <PostPaymentModal
          onClose={() => setShowPostPayment(false)}
          onSuccess={() => setShowPostPayment(false)}
        />
      )}
    </div>
  )
}
