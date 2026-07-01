import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  FileText,
  AlertTriangle,
  Send,
  XCircle,
  Ban,
  Layers,
  Clock,
  Users,
  Unlink,
  Hourglass,
  CheckSquare,
  Square,
  RefreshCw,
  UserPlus,
  BellOff,
  InboxIcon,
  AlertCircle,
} from 'lucide-react'
import { apiClient } from '../../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Visit {
  id: string
  patientName: string
  patientId: string
  providerId: string
  providerName: string
  dateOfService: string
  totalCharge: number
  status: string
  createdAt: string
}

interface Claim {
  id: string
  claimNumber: string
  patientName: string
  patientId: string
  payerName: string
  providerId: string
  providerName: string
  dateOfService: string
  totalCharge: number
  balance: number
  status: string
  validationStatus?: string
  submittedAt?: string
  lastActivity?: string
  denialReason?: string
  rejectionCode?: string
  secondaryPayer?: string
  createdAt: string
}

interface Patient {
  id: string
  firstName: string
  lastName: string
  dob: string
  balance: number
  lastVisitDate: string
  primaryPayer: string
  createdAt: string
}

interface EraFile {
  id: string
  checkNumber: string
  payerName: string
  paymentDate: string
  totalPayment: number
  unmatchedCount: number
  status: string
  createdAt: string
}

type QueueItem = Visit | Claim | Patient | EraFile

// ─── Queue configuration ──────────────────────────────────────────────────────

type QueueKey =
  | 'ready_to_bill'
  | 'missing_data'
  | 'ready_to_submit'
  | 'rejected'
  | 'denied'
  | 'secondary_pending'
  | 'ar_followup'
  | 'patient_balances'
  | 'unmatched_era'
  | 'stale_claims'

interface QueueConfig {
  key: QueueKey
  label: string
  icon: React.ElementType
  endpoint: string
  params: Record<string, string | boolean | number>
  actionLabel: string
  actionPath: (item: QueueItem) => string
  emptyMessage: string
}

const QUEUES: QueueConfig[] = [
  {
    key: 'ready_to_bill',
    label: 'Ready to Bill',
    icon: FileText,
    endpoint: '/visits',
    params: { status: 'completed', has_claim: false, limit: 50 },
    actionLabel: 'Bill Now',
    actionPath: (item) => `/visits/${item.id}`,
    emptyMessage: 'All completed visits have been billed.',
  },
  {
    key: 'missing_data',
    label: 'Missing Data',
    icon: AlertTriangle,
    endpoint: '/claims',
    params: { validation_status: 'failed', limit: 50 },
    actionLabel: 'Fix & Submit',
    actionPath: (item) => `/claims/${item.id}`,
    emptyMessage: 'No claims have validation errors.',
  },
  {
    key: 'ready_to_submit',
    label: 'Ready to Submit',
    icon: Send,
    endpoint: '/claims',
    params: { status: 'ready', limit: 50 },
    actionLabel: 'Submit',
    actionPath: (item) => `/claims/${item.id}`,
    emptyMessage: 'No claims are queued for submission.',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    icon: XCircle,
    endpoint: '/claims',
    params: { status: 'rejected', limit: 50 },
    actionLabel: 'Review',
    actionPath: (item) => `/claims/${item.id}`,
    emptyMessage: 'No rejected claims to address.',
  },
  {
    key: 'denied',
    label: 'Denied',
    icon: Ban,
    endpoint: '/claims',
    params: { status: 'denied', limit: 50 },
    actionLabel: 'Appeal',
    actionPath: (item) => `/claims/${item.id}`,
    emptyMessage: 'No denied claims requiring action.',
  },
  {
    key: 'secondary_pending',
    label: 'Secondary Pending',
    icon: Layers,
    endpoint: '/claims',
    params: { status: 'paid', secondary_pending: true, limit: 50 },
    actionLabel: 'Bill Secondary',
    actionPath: (item) => `/claims/${item.id}`,
    emptyMessage: 'No secondary billing pending.',
  },
  {
    key: 'ar_followup',
    label: 'A/R Follow-Up',
    icon: Clock,
    endpoint: '/claims',
    params: { ar_followup: true, limit: 50 },
    actionLabel: 'Follow Up',
    actionPath: (item) => `/claims/${item.id}`,
    emptyMessage: 'No claims require A/R follow-up.',
  },
  {
    key: 'patient_balances',
    label: 'Patient Balances',
    icon: Users,
    endpoint: '/patients',
    params: { has_balance: true, limit: 50 },
    actionLabel: 'Collect',
    actionPath: (item) => `/patients/${item.id}`,
    emptyMessage: 'No outstanding patient balances.',
  },
  {
    key: 'unmatched_era',
    label: 'Unmatched ERA',
    icon: Unlink,
    endpoint: '/payments/era-files',
    params: { status: 'unmatched', limit: 50 },
    actionLabel: 'Match',
    actionPath: (item) => `/payments/era-files/${item.id}`,
    emptyMessage: 'All ERA payments have been matched.',
  },
  {
    key: 'stale_claims',
    label: 'Stale Claims',
    icon: Hourglass,
    endpoint: '/claims',
    params: { stale: true, limit: 50 },
    actionLabel: 'Review',
    actionPath: (item) => `/claims/${item.id}`,
    emptyMessage: 'No stale claims on record.',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(dateStr: string | undefined): number {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

function formatCurrency(amount: number | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AgeBadge({ days }: { days: number }) {
  if (days > 90) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tabular-nums"
        style={{
          background: 'var(--bb-status-danger-bg)',
          color: 'var(--bb-status-danger)',
        }}
      >
        {days}d
      </span>
    )
  }
  if (days >= 60) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tabular-nums"
        style={{
          background: 'var(--bb-status-warning-bg)',
          color: 'var(--bb-status-warning)',
        }}
      >
        {days}d
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tabular-nums"
      style={{
        background: 'var(--bb-status-success-bg)',
        color: 'var(--bb-status-success)',
      }}
    >
      {days}d
    </span>
  )
}

function SkeletonRow() {
  return (
    <tr>
      {[40, 180, 140, 100, 90, 60, 80].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="rounded animate-pulse"
            style={{
              width: `${w}px`,
              height: '14px',
              background: 'var(--bb-border)',
            }}
          />
        </td>
      ))}
    </tr>
  )
}

function EmptyState({ message, unavailable }: { message: string; unavailable?: boolean }) {
  return (
    <tr>
      <td colSpan={8}>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          {unavailable ? (
            <AlertCircle
              size={32}
              style={{ color: 'var(--bb-text-secondary)', opacity: 0.5 }}
            />
          ) : (
            <InboxIcon
              size={32}
              style={{ color: 'var(--bb-text-secondary)', opacity: 0.5 }}
            />
          )}
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--bb-text-secondary)' }}
          >
            {unavailable ? 'Queue data unavailable' : message}
          </p>
          {unavailable && (
            <p className="text-xs" style={{ color: 'var(--bb-text-secondary)', opacity: 0.7 }}>
              The server did not return data for this filter. Try refreshing.
            </p>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Row renderers ────────────────────────────────────────────────────────────

function VisitRow({
  item,
  checked,
  onToggle,
  actionLabel,
  onAction,
}: {
  item: Visit
  checked: boolean
  onToggle: () => void
  actionLabel: string
  onAction: () => void
}) {
  const age = daysSince(item.createdAt)
  return (
    <tr
      className="border-b border-[--bb-border] hover:bg-[--bb-surface-app] transition-colors"
      style={{ cursor: 'default' }}
    >
      <td className="px-4 py-3">
        <button
          onClick={onToggle}
          className="flex items-center justify-center"
          aria-label={checked ? 'Deselect row' : 'Select row'}
          style={{ color: checked ? 'var(--bb-brand-blue)' : 'var(--bb-text-secondary)' }}
        >
          {checked ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
      </td>
      <td className="px-4 py-3 text-sm font-medium text-[--bb-text-primary]">{item.patientName}</td>
      <td className="px-4 py-3 text-sm text-[--bb-text-secondary]">{item.providerName}</td>
      <td className="px-4 py-3 text-sm tabular-nums text-[--bb-text-secondary]">{formatDate(item.dateOfService)}</td>
      <td className="px-4 py-3 text-sm tabular-nums text-[--bb-text-primary] font-medium">{formatCurrency(item.totalCharge)}</td>
      <td className="px-4 py-3"><AgeBadge days={age} /></td>
      <td className="px-4 py-3 text-sm text-[--bb-text-secondary]">No linked claim</td>
      <td className="px-4 py-3 text-right">
        <ActionButton label={actionLabel} onClick={onAction} />
      </td>
    </tr>
  )
}

function ClaimRow({
  item,
  checked,
  onToggle,
  actionLabel,
  onAction,
  ageField,
}: {
  item: Claim
  checked: boolean
  onToggle: () => void
  actionLabel: string
  onAction: () => void
  ageField?: 'submittedAt' | 'lastActivity' | 'createdAt'
}) {
  const dateKey = ageField ?? 'createdAt'
  const age = daysSince(item[dateKey])
  const note =
    item.denialReason ?? item.rejectionCode ?? item.secondaryPayer ?? '—'
  return (
    <tr className="border-b border-[--bb-border] hover:bg-[--bb-surface-app] transition-colors">
      <td className="px-4 py-3">
        <button
          onClick={onToggle}
          className="flex items-center justify-center"
          aria-label={checked ? 'Deselect row' : 'Select row'}
          style={{ color: checked ? 'var(--bb-brand-blue)' : 'var(--bb-text-secondary)' }}
        >
          {checked ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
      </td>
      <td className="px-4 py-3 text-sm font-medium text-[--bb-text-primary]">{item.patientName}</td>
      <td className="px-4 py-3 text-sm text-[--bb-text-secondary]">{item.payerName}</td>
      <td className="px-4 py-3 text-sm tabular-nums text-[--bb-text-secondary]">{formatDate(item.dateOfService)}</td>
      <td className="px-4 py-3 text-sm tabular-nums text-[--bb-text-primary] font-medium">{formatCurrency(item.balance ?? item.totalCharge)}</td>
      <td className="px-4 py-3"><AgeBadge days={age} /></td>
      <td className="px-4 py-3 text-xs text-[--bb-text-secondary] max-w-[160px] truncate" title={note}>{note}</td>
      <td className="px-4 py-3 text-right">
        <ActionButton label={actionLabel} onClick={onAction} />
      </td>
    </tr>
  )
}

function PatientRow({
  item,
  checked,
  onToggle,
  actionLabel,
  onAction,
}: {
  item: Patient
  checked: boolean
  onToggle: () => void
  actionLabel: string
  onAction: () => void
}) {
  const age = daysSince(item.lastVisitDate)
  return (
    <tr className="border-b border-[--bb-border] hover:bg-[--bb-surface-app] transition-colors">
      <td className="px-4 py-3">
        <button
          onClick={onToggle}
          className="flex items-center justify-center"
          aria-label={checked ? 'Deselect row' : 'Select row'}
          style={{ color: checked ? 'var(--bb-brand-blue)' : 'var(--bb-text-secondary)' }}
        >
          {checked ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
      </td>
      <td className="px-4 py-3 text-sm font-medium text-[--bb-text-primary]">{item.firstName} {item.lastName}</td>
      <td className="px-4 py-3 text-sm text-[--bb-text-secondary]">{item.primaryPayer}</td>
      <td className="px-4 py-3 text-sm tabular-nums text-[--bb-text-secondary]">{formatDate(item.lastVisitDate)}</td>
      <td className="px-4 py-3 text-sm tabular-nums text-[--bb-text-primary] font-medium">{formatCurrency(item.balance)}</td>
      <td className="px-4 py-3"><AgeBadge days={age} /></td>
      <td className="px-4 py-3 text-xs text-[--bb-text-secondary]">Patient responsibility</td>
      <td className="px-4 py-3 text-right">
        <ActionButton label={actionLabel} onClick={onAction} />
      </td>
    </tr>
  )
}

function EraRow({
  item,
  checked,
  onToggle,
  actionLabel,
  onAction,
}: {
  item: EraFile
  checked: boolean
  onToggle: () => void
  actionLabel: string
  onAction: () => void
}) {
  const age = daysSince(item.paymentDate)
  return (
    <tr className="border-b border-[--bb-border] hover:bg-[--bb-surface-app] transition-colors">
      <td className="px-4 py-3">
        <button
          onClick={onToggle}
          className="flex items-center justify-center"
          aria-label={checked ? 'Deselect row' : 'Select row'}
          style={{ color: checked ? 'var(--bb-brand-blue)' : 'var(--bb-text-secondary)' }}
        >
          {checked ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
      </td>
      <td className="px-4 py-3 text-sm font-medium text-[--bb-text-primary]">Check #{item.checkNumber}</td>
      <td className="px-4 py-3 text-sm text-[--bb-text-secondary]">{item.payerName}</td>
      <td className="px-4 py-3 text-sm tabular-nums text-[--bb-text-secondary]">{formatDate(item.paymentDate)}</td>
      <td className="px-4 py-3 text-sm tabular-nums text-[--bb-text-primary] font-medium">{formatCurrency(item.totalPayment)}</td>
      <td className="px-4 py-3"><AgeBadge days={age} /></td>
      <td className="px-4 py-3 text-xs text-[--bb-text-secondary]">{item.unmatchedCount} line(s) unmatched</td>
      <td className="px-4 py-3 text-right">
        <ActionButton label={actionLabel} onClick={onAction} />
      </td>
    </tr>
  )
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded transition-colors focus:outline-none focus-visible:ring-2"
      style={{
        background: 'var(--bb-brand-blue)',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--bb-radius-sm)',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bb-brand-blue-hover)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bb-brand-blue)'
      }}
    >
      {label}
    </button>
  )
}

// ─── Queue table component ────────────────────────────────────────────────────

function QueueTable({
  config,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  config: QueueConfig
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (ids: string[]) => void
}) {
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['billing-queue', config.key],
    queryFn: async () => {
      const res = await apiClient.get(config.endpoint, { params: config.params })
      const raw = res.data
      // Handle both array and paginated { items, total } shapes
      const items: QueueItem[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw?.results)
        ? raw.results
        : []
      return items
    },
    retry: false,
    staleTime: 30_000,
  })

  const items = data ?? []
  const allIds = items.map((i) => i.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))

  const columnHeaders = ['Patient / Ref', 'Provider / Payer', 'Date', 'Amount', 'Age', 'Note', '']

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead>
          <tr style={{ borderBottom: '2px solid var(--bb-border)' }}>
            <th className="px-4 py-3 w-10">
              <button
                onClick={() => onToggleAll(allIds)}
                className="flex items-center justify-center"
                aria-label={allSelected ? 'Deselect all' : 'Select all'}
                style={{ color: allSelected ? 'var(--bb-brand-blue)' : 'var(--bb-text-secondary)' }}
              >
                {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
            </th>
            {columnHeaders.map((h, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--bb-text-secondary)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : isError ? (
            <EmptyState message={config.emptyMessage} unavailable />
          ) : items.length === 0 ? (
            <EmptyState message={config.emptyMessage} />
          ) : (
            items.map((item) => {
              const checked = selectedIds.has(item.id)
              const handleAction = () => navigate(config.actionPath(item))
              const handleToggle = () => onToggle(item.id)

              if (config.key === 'ready_to_bill') {
                return (
                  <VisitRow
                    key={item.id}
                    item={item as Visit}
                    checked={checked}
                    onToggle={handleToggle}
                    actionLabel={config.actionLabel}
                    onAction={handleAction}
                  />
                )
              }
              if (config.key === 'patient_balances') {
                return (
                  <PatientRow
                    key={item.id}
                    item={item as Patient}
                    checked={checked}
                    onToggle={handleToggle}
                    actionLabel={config.actionLabel}
                    onAction={handleAction}
                  />
                )
              }
              if (config.key === 'unmatched_era') {
                return (
                  <EraRow
                    key={item.id}
                    item={item as EraFile}
                    checked={checked}
                    onToggle={handleToggle}
                    actionLabel={config.actionLabel}
                    onAction={handleAction}
                  />
                )
              }
              return (
                <ClaimRow
                  key={item.id}
                  item={item as Claim}
                  checked={checked}
                  onToggle={handleToggle}
                  actionLabel={config.actionLabel}
                  onAction={handleAction}
                  ageField={
                    config.key === 'ar_followup' || config.key === 'stale_claims'
                      ? 'submittedAt'
                      : 'createdAt'
                  }
                />
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Count badge (fetches per-queue count) ─────────────────────────────────────

function QueueCountBadge({ config }: { config: QueueConfig }) {
  const { data } = useQuery({
    queryKey: ['billing-queue', config.key],
    queryFn: async () => {
      const res = await apiClient.get(config.endpoint, { params: config.params })
      const raw = res.data
      const items: QueueItem[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw?.results)
        ? raw.results
        : []
      return items
    },
    retry: false,
    staleTime: 30_000,
  })

  const count = data?.length ?? 0
  if (count === 0) return null

  return (
    <span
      className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold tabular-nums"
      style={{
        background: 'var(--bb-brand-blue)',
        color: '#fff',
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

// ─── Bulk action bar ───────────────────────────────────────────────────────────

function BulkActionBar({
  count,
  onSubmit,
  onAssign,
  onSnooze,
  onClear,
}: {
  count: number
  onSubmit: () => void
  onAssign: () => void
  onSnooze: () => void
  onClear: () => void
}) {
  if (count === 0) return null

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg"
      style={{
        background: 'var(--bb-brand-ink)',
        color: '#fff',
        boxShadow: 'var(--bb-shadow-md)',
      }}
    >
      <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
        {count} selected
      </span>
      <div
        className="w-px h-5"
        style={{ background: 'rgba(255,255,255,0.2)' }}
      />
      <button
        onClick={onSubmit}
        className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded transition-colors"
        style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.2)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)')}
      >
        <Send size={13} />
        Submit Selected
      </button>
      <button
        onClick={onAssign}
        className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded transition-colors"
        style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.2)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)')}
      >
        <UserPlus size={13} />
        Assign
      </button>
      <button
        onClick={onSnooze}
        className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded transition-colors"
        style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.2)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)')}
      >
        <BellOff size={13} />
        Snooze
      </button>
      <button
        onClick={onClear}
        className="ml-1 text-xs px-2 py-1 rounded transition-colors"
        style={{ color: 'rgba(255,255,255,0.5)' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#fff')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)')}
        aria-label="Clear selection"
      >
        ✕ Clear
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function BillingPage() {
  const [activeQueue, setActiveQueue] = useState<QueueKey>('ready_to_bill')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const activeConfig = QUEUES.find((q) => q.key === activeQueue)!

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleToggleAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id))
      if (allSelected) {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      }
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
  }, [])

  function handleTabChange(key: QueueKey) {
    setActiveQueue(key)
    setSelectedIds(new Set())
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bb-surface-app)' }}
    >
      {/* Page header */}
      <div
        className="px-8 pt-8 pb-6"
        style={{ borderBottom: '1px solid var(--bb-border)', background: 'var(--bb-surface-card)' }}
      >
        <div className="flex items-start justify-between max-w-screen-2xl mx-auto">
          <div>
            <h1
              className="text-2xl font-bold leading-tight"
              style={{ color: 'var(--bb-text-primary)', textWrap: 'balance' } as React.CSSProperties}
            >
              Billing
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--bb-text-secondary)' }}>
              Your operational billing workbench
            </p>
          </div>
          <button
            className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors"
            style={{
              border: '1px solid var(--bb-border)',
              color: 'var(--bb-text-secondary)',
              background: 'var(--bb-surface-card)',
            }}
            onClick={() => window.location.reload()}
            title="Refresh all queues"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {/* Tab strip */}
        <div
          className="mt-6 flex gap-0 overflow-x-auto max-w-screen-2xl mx-auto"
          style={{ scrollbarWidth: 'none' }}
          role="tablist"
          aria-label="Billing queues"
        >
          {QUEUES.map((q) => {
            const Icon = q.icon
            const isActive = q.key === activeQueue
            return (
              <button
                key={q.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(q.key)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative focus:outline-none focus-visible:ring-2"
                style={{
                  color: isActive ? 'var(--bb-brand-blue)' : 'var(--bb-text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive
                    ? '2px solid var(--bb-brand-blue)'
                    : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                <Icon size={14} />
                {q.label}
                <QueueCountBadge config={q} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Queue table card */}
      <div className="px-8 py-6 max-w-screen-2xl mx-auto">
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: 'var(--bb-surface-card)',
            border: '1px solid var(--bb-border)',
            boxShadow: 'var(--bb-shadow-sm)',
          }}
        >
          {/* Queue title bar */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--bb-border)' }}
          >
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = activeConfig.icon
                return (
                  <Icon
                    size={16}
                    style={{ color: 'var(--bb-brand-blue)' }}
                  />
                )
              })()}
              <span
                className="font-semibold text-sm"
                style={{ color: 'var(--bb-text-primary)' }}
              >
                {activeConfig.label}
              </span>
            </div>
            {selectedIds.size > 0 && (
              <span
                className="text-xs font-medium px-2 py-1 rounded"
                style={{
                  background: 'var(--bb-status-info-bg)',
                  color: 'var(--bb-status-info)',
                }}
              >
                {selectedIds.size} row{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>

          <QueueTable
            config={activeConfig}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            onToggleAll={handleToggleAll}
          />
        </div>
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        count={selectedIds.size}
        onSubmit={() => {
          // TODO: wire to batch submit
          console.log('Submit:', Array.from(selectedIds))
        }}
        onAssign={() => {
          console.log('Assign:', Array.from(selectedIds))
        }}
        onSnooze={() => {
          console.log('Snooze:', Array.from(selectedIds))
        }}
        onClear={() => setSelectedIds(new Set())}
      />
    </div>
  )
}
