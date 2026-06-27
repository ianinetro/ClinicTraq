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

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default'

const statusMap: Partial<Record<AllStatus, BadgeVariant>> = {
  // Patient statuses
  active: 'success',
  inactive: 'default',

  // Visit statuses
  scheduled: 'info',
  'checked-in': 'warning',
  'in-progress': 'warning',
  completed: 'success',
  cancelled: 'default',
  'no-show': 'warning',

  // Claim statuses
  draft: 'default',
  'validation-failed': 'danger',
  ready: 'info',
  submitted: 'info',
  acknowledged: 'warning',
  pending: 'warning',
  paid: 'success',
  denied: 'danger',
  rejected: 'danger',
  appealed: 'warning',
  void: 'default',

  // Payment statuses
  unapplied: 'warning',
  partial: 'warning',
  applied: 'success',
  reconciled: 'success',

  // Priority
  critical: 'danger',
  high: 'warning',
  medium: 'warning',
  low: 'info',

  // Work queue
  open: 'warning',
  snoozed: 'default',
  resolved: 'success',

  // ERA
  matched: 'success',
  unmatched: 'warning',
  posted: 'success',
  skipped: 'default',
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

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = statusMap[status as AllStatus] ?? 'default'
  const label = statusLabels[status as AllStatus] ?? status.charAt(0).toUpperCase() + status.slice(1)
  return <Badge variant={variant}>{label}</Badge>
}
