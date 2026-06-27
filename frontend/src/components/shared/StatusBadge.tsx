import { Badge } from '../ui/Badge'
import type { ClaimStatus } from '../../types'

type AllStatus =
  | ClaimStatus
  | 'active' | 'inactive' | 'scheduled' | 'checked-in' | 'in-progress'
  | 'completed' | 'cancelled' | 'no-show'
  | 'unapplied' | 'partial' | 'applied' | 'reconciled' | 'void'
  | 'critical' | 'high' | 'medium' | 'low'
  | 'open' | 'snoozed' | 'resolved'
  | 'matched' | 'unmatched' | 'posted' | 'skipped'

type BadgeVariant = 'active' | 'inactive' | 'pending' | 'in-progress' | 'completed' | 'failed' | 'warning' | 'draft' | 'submitted' | 'overdue' | 'blocked' | 'info' | 'success' | 'denied' | 'paid' | 'needs-review'

const statusMap: Partial<Record<AllStatus, BadgeVariant>> = {
  // Patient statuses
  active: 'active',
  inactive: 'inactive',

  // Visit statuses
  scheduled: 'pending',
  'checked-in': 'in-progress',
  'in-progress': 'in-progress',
  completed: 'completed',
  cancelled: 'inactive',
  'no-show': 'warning',

  // Claim statuses
  draft: 'draft',
  'validation-failed': 'failed',
  ready: 'info',
  submitted: 'submitted',
  acknowledged: 'in-progress',
  pending: 'pending',
  paid: 'paid',
  denied: 'denied',
  rejected: 'failed',
  appealed: 'warning',
  void: 'inactive',

  // Payment statuses
  unapplied: 'warning',
  partial: 'in-progress',
  applied: 'success',
  reconciled: 'completed',

  // Priority
  critical: 'overdue',
  high: 'warning',
  medium: 'pending',
  low: 'info',

  // Work queue
  open: 'pending',
  snoozed: 'inactive',
  resolved: 'completed',

  // ERA
  matched: 'success',
  unmatched: 'warning',
  posted: 'completed',
  skipped: 'inactive',
}

const statusLabels: Partial<Record<AllStatus, string>> = {
  'validation-failed': 'Validation Failed',
  'checked-in': 'Checked In',
  'in-progress': 'In Progress',
  'no-show': 'No Show',
}

interface StatusBadgeProps {
  status: AllStatus | string
  size?: 'sm' | 'md'
  className?: string
}

export function StatusBadge({ status, size, className }: StatusBadgeProps) {
  const variant = statusMap[status as AllStatus] ?? 'inactive'
  const label = statusLabels[status as AllStatus] ?? status.charAt(0).toUpperCase() + status.slice(1)
  return <Badge variant={variant} size={size} className={className}>{label}</Badge>
}
