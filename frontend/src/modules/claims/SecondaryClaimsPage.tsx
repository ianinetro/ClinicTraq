import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, differenceInDays } from 'date-fns'
import { FileText, DollarSign, ArrowRight } from 'lucide-react'
import { PageHeader } from '../../components/shell/PageHeader'
import { Table, type ColumnDef } from '../../components/ui/Table'
import { KPICard } from '../../components/ui/KPICard'
import { apiClient } from '../../services/api'

interface ClaimRow {
  id: string
  claimNumber: string
  patientFirstName: string
  patientLastName: string
  primaryPayerName: string | null
  dateOfService: string | null
  totalPaid: number
  balance: number
  paidAt: string | null
  // computed
  daysSincePrimary?: number
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function agingColor(days: number): string {
  if (days > 60) return 'var(--bb-status-danger)'
  if (days > 30) return 'var(--bb-status-warning)'
  return 'var(--bb-text-secondary)'
}

export function SecondaryClaimsPage() {
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery<ClaimRow[]>({
    queryKey: ['claims', 'secondary-candidates'],
    queryFn: async () => {
      const res = await apiClient.get('/claims', { params: { status: 'paid', limit: 100 } })
      const items: ClaimRow[] = res.data?.items ?? res.data ?? []
      // Client-side filter: primary has paid but a balance remains
      return items
        .filter((c) => (c.totalPaid ?? 0) > 0 && (c.balance ?? 0) > 0)
        .map((c) => ({
          ...c,
          daysSincePrimary: c.paidAt
            ? differenceInDays(new Date(), new Date(c.paidAt))
            : undefined,
        }))
    },
  })

  const rows: ClaimRow[] = data ?? []

  const summary = useMemo(() => {
    const totalBalance = rows.reduce((s, r) => s + (r.balance ?? 0), 0)
    return { count: rows.length, totalBalance }
  }, [rows])

  const columns: ColumnDef<ClaimRow>[] = [
    {
      id: 'claimNumber',
      header: 'Claim #',
      width: '130px',
      cell: (row) => (
        <Link
          to={`/claims/${row.id}`}
          className="text-sm font-mono font-medium hover:underline"
          style={{ color: 'var(--bb-brand-blue)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {row.claimNumber}
        </Link>
      ),
    },
    {
      id: 'patient',
      header: 'Patient Name',
      cell: (row) => (
        <span className="text-sm font-medium" style={{ color: 'var(--bb-text-primary)' }}>
          {row.patientLastName}, {row.patientFirstName}
        </span>
      ),
    },
    {
      id: 'primaryPayer',
      header: 'Primary Payer',
      cell: (row) => (
        <span className="text-sm" style={{ color: 'var(--bb-text-secondary)' }}>
          {row.primaryPayerName ?? '—'}
        </span>
      ),
    },
    {
      id: 'dos',
      header: 'DOS',
      width: '110px',
      cell: (row) => (
        <span className="text-sm tabular-nums" style={{ color: 'var(--bb-text-secondary)' }}>
          {row.dateOfService ? format(new Date(row.dateOfService), 'MM/dd/yyyy') : '—'}
        </span>
      ),
    },
    {
      id: 'primaryPaid',
      header: 'Primary Paid',
      align: 'right',
      width: '120px',
      cell: (row) => (
        <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--bb-status-success)' }}>
          {fmt(row.totalPaid ?? 0)}
        </span>
      ),
    },
    {
      id: 'balance',
      header: 'Balance Due',
      align: 'right',
      width: '120px',
      cell: (row) => (
        <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--bb-status-danger)' }}>
          {fmt(row.balance ?? 0)}
        </span>
      ),
    },
    {
      id: 'aging',
      header: 'Days Since Primary',
      align: 'right',
      width: '155px',
      cell: (row) => {
        const days = row.daysSincePrimary
        if (days == null) return <span className="text-sm" style={{ color: 'var(--bb-text-secondary)' }}>—</span>
        return (
          <span
            className="text-sm font-semibold tabular-nums"
            style={{ color: agingColor(days) }}
          >
            {days}d
          </span>
        )
      },
    },
    {
      id: 'action',
      header: '',
      width: '140px',
      cell: (row) => (
        <button
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
          style={{
            background: 'var(--bb-brand-blue)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/claims/${row.id}`)
          }}
        >
          Bill Secondary
          <ArrowRight size={12} />
        </button>
      ),
    },
  ]

  const hasError = !!error
  const isEmpty = !isLoading && !hasError && rows.length === 0

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Secondary Claims"
        description="Claims paid by primary with remaining patient or secondary payer balance"
      />

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 16 }}>
        <KPICard
          label="Total Claims"
          value={summary.count}
          subtitle="awaiting secondary billing"
          icon={<FileText size={18} />}
        />
        <KPICard
          label="Total Balance"
          value={fmt(summary.totalBalance)}
          subtitle="pending secondary recovery"
          icon={<DollarSign size={18} />}
        />
      </div>

      {/* Table */}
      {isEmpty || hasError ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-lg"
          style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)' }}
        >
          <FileText size={36} style={{ color: 'var(--bb-text-secondary)', opacity: 0.4, marginBottom: 12 }} />
          <p className="text-base font-semibold" style={{ color: 'var(--bb-text-primary)' }}>
            No secondary claims pending
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--bb-text-secondary)' }}>
            {hasError
              ? 'Failed to load claims. Please try again.'
              : 'All primary-paid claims have been fully resolved.'}
          </p>
        </div>
      ) : (
        <Table<ClaimRow>
          columns={columns}
          data={rows}
          loading={isLoading}
          error={hasError ? 'Failed to load claims.' : undefined}
          total={rows.length}
          getRowId={(row) => row.id}
          onRowClick={(row) => navigate(`/claims/${row.id}`)}
          emptyTitle="No secondary claims pending"
          emptyDescription="All primary-paid claims have been fully resolved."
        />
      )}
    </div>
  )
}
