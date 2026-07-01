import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { DollarSign, Users, TrendingDown, Send } from 'lucide-react'
import { PageHeader } from '../../components/shell/PageHeader'
import { Table, type ColumnDef } from '../../components/ui/Table'
import { KPICard } from '../../components/ui/KPICard'
import { apiClient } from '../../services/api'

interface PatientBalanceRow {
  id: string
  accountNumber: string
  firstName: string
  lastName: string
  lastVisitDate: string | null
  primaryPayerName: string | null
  totalCharges: number
  totalPaid: number
  totalAdjustments: number
  balance: number
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function PatientBalancePage() {
  const { data, isLoading, error } = useQuery<PatientBalanceRow[]>({
    queryKey: ['patients', 'has_balance'],
    queryFn: async () => {
      const res = await apiClient.get('/patients', { params: { has_balance: true, limit: 100 } })
      const items = res.data?.items ?? res.data ?? []
      return items
    },
  })

  const rows: PatientBalanceRow[] = data ?? []

  const summary = useMemo(() => {
    const total = rows.reduce((s, r) => s + (r.balance ?? 0), 0)
    const count = rows.length
    const avg = count > 0 ? total / count : 0
    return { total, count, avg }
  }, [rows])

  const columns: ColumnDef<PatientBalanceRow>[] = [
    {
      id: 'name',
      header: 'Patient Name',
      cell: (row) => (
        <Link
          to={`/patients/${row.id}`}
          className="text-sm font-medium hover:underline"
          style={{ color: 'var(--bb-brand-blue)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {row.lastName}, {row.firstName}
        </Link>
      ),
    },
    {
      id: 'accountNumber',
      header: 'Account #',
      width: '120px',
      cell: (row) => (
        <span className="text-sm font-mono" style={{ color: 'var(--bb-text-secondary)' }}>
          {row.accountNumber}
        </span>
      ),
    },
    {
      id: 'lastVisitDate',
      header: 'Last Visit',
      width: '110px',
      cell: (row) => (
        <span className="text-sm tabular-nums" style={{ color: 'var(--bb-text-secondary)' }}>
          {row.lastVisitDate ? format(new Date(row.lastVisitDate), 'MM/dd/yyyy') : '—'}
        </span>
      ),
    },
    {
      id: 'insurance',
      header: 'Insurance',
      cell: (row) => (
        <span className="text-sm" style={{ color: 'var(--bb-text-secondary)' }}>
          {row.primaryPayerName ?? '—'}
        </span>
      ),
    },
    {
      id: 'charges',
      header: 'Charges',
      align: 'right',
      width: '110px',
      cell: (row) => (
        <span className="text-sm tabular-nums" style={{ color: 'var(--bb-text-primary)' }}>
          {fmt(row.totalCharges ?? 0)}
        </span>
      ),
    },
    {
      id: 'paid',
      header: 'Paid',
      align: 'right',
      width: '100px',
      cell: (row) => (
        <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--bb-status-success)' }}>
          {fmt(row.totalPaid ?? 0)}
        </span>
      ),
    },
    {
      id: 'adjustments',
      header: 'Adjustments',
      align: 'right',
      width: '120px',
      cell: (row) => (
        <span className="text-sm tabular-nums" style={{ color: 'var(--bb-text-secondary)' }}>
          {fmt(row.totalAdjustments ?? 0)}
        </span>
      ),
    },
    {
      id: 'balance',
      header: 'Balance',
      align: 'right',
      width: '110px',
      cell: (row) => (
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: (row.balance ?? 0) > 0 ? 'var(--bb-status-danger)' : 'var(--bb-text-primary)' }}
        >
          {fmt(row.balance ?? 0)}
        </span>
      ),
    },
    {
      id: 'action',
      header: '',
      width: '140px',
      cell: () => (
        <button
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
          style={{
            background: 'var(--bb-surface-app)',
            color: 'var(--bb-brand-blue)',
            border: '1px solid var(--bb-border)',
          }}
          onClick={(e) => {
            e.stopPropagation()
            alert('Statement feature coming soon')
          }}
        >
          <Send size={12} />
          Send Statement
        </button>
      ),
    },
  ]

  const hasError = !!error
  const isEmpty = !isLoading && !hasError && rows.length === 0

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Patient Balances"
        description="Patients with outstanding account balances"
      />

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 16 }}>
        <KPICard
          label="Total Outstanding"
          value={fmt(summary.total)}
          subtitle="across all patients"
          icon={<DollarSign size={18} />}
        />
        <KPICard
          label="Patient Count"
          value={summary.count}
          subtitle="with a balance due"
          icon={<Users size={18} />}
        />
        <KPICard
          label="Avg Balance"
          value={fmt(summary.avg)}
          subtitle="per patient"
          icon={<TrendingDown size={18} />}
        />
      </div>

      {/* Table */}
      {isEmpty || hasError ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-lg"
          style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)' }}
        >
          <DollarSign size={36} style={{ color: 'var(--bb-text-secondary)', opacity: 0.4, marginBottom: 12 }} />
          <p className="text-base font-semibold" style={{ color: 'var(--bb-text-primary)' }}>
            No outstanding patient balances
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--bb-text-secondary)' }}>
            {hasError ? 'Failed to load patient balances. Please try again.' : 'All accounts are current.'}
          </p>
        </div>
      ) : (
        <Table<PatientBalanceRow>
          columns={columns}
          data={rows}
          loading={isLoading}
          error={hasError ? 'Failed to load patient balances.' : undefined}
          total={rows.length}
          getRowId={(row) => row.id}
          emptyTitle="No outstanding patient balances"
          emptyDescription="All accounts are current."
        />
      )}
    </div>
  )
}
