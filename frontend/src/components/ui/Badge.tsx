import { clsx } from 'clsx'

type BadgeVariant =
  | 'active' | 'inactive' | 'pending' | 'in-progress' | 'completed'
  | 'failed' | 'warning' | 'draft' | 'submitted' | 'overdue'
  | 'blocked' | 'info' | 'success' | 'denied' | 'paid' | 'needs-review'

type BadgeSize = 'sm' | 'md'

interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  active:       'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]',
  success:      'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]',
  paid:         'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]',
  completed:    'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]',
  inactive:     'bg-[#F2F2F8] text-[#676687] border border-[#E3E3F1]',
  draft:        'bg-[#F2F2F8] text-[#676687] border border-[#E3E3F1]',
  pending:      'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]',
  warning:      'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]',
  'in-progress':'bg-[#D9FCFF] text-[#007998] border border-[#94F2FA]',
  submitted:    'bg-[#D9FCFF] text-[#007998] border border-[#94F2FA]',
  'needs-review':'bg-[#D9FCFF] text-[#007998] border border-[#94F2FA]',
  info:         'bg-[#D9FCFF] text-[#007998] border border-[#94F2FA]',
  failed:       'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]',
  denied:       'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]',
  blocked:      'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]',
  overdue:      'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]',
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[11px] px-1.5 py-0.5 font-600',
  md: 'text-xs px-2 py-0.5 font-medium',
}

export function Badge({ variant = 'inactive', size = 'md', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium leading-none',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
    >
      {children}
    </span>
  )
}
