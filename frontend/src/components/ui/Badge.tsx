import React from 'react'

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'active' | 'inactive' | 'failed'

interface BadgeProps {
  variant?: Variant
  children: React.ReactNode
  size?: string  // kept for compat, ignored
}

const styles: Record<Variant, React.CSSProperties> = {
  success: { background: 'var(--bb-status-success-bg)', color: 'var(--bb-status-success)' },
  warning: { background: 'var(--bb-status-warning-bg)', color: 'var(--bb-status-warning)' },
  danger: { background: 'var(--bb-status-danger-bg)', color: 'var(--bb-status-danger)' },
  info: { background: 'var(--bb-status-info-bg)', color: 'var(--bb-status-info)' },
  default: { background: 'var(--bb-border)', color: 'var(--bb-text-secondary)' },
  active: { background: 'var(--bb-status-success-bg)', color: 'var(--bb-status-success)' },
  inactive: { background: 'var(--bb-border)', color: 'var(--bb-text-secondary)' },
  failed: { background: 'var(--bb-status-danger-bg)', color: 'var(--bb-status-danger)' },
}

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span style={{
      ...styles[variant],
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 100,
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}
