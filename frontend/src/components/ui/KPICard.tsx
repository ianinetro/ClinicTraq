import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: string
  trendUp?: boolean
  icon?: React.ReactNode
}

export function KPICard({ title, value, subtitle, trend, trendUp, icon }: KPICardProps) {
  return (
    <div style={{
      background: 'var(--bb-surface-card)',
      borderRadius: 'var(--bb-radius-lg)',
      padding: '20px',
      boxShadow: 'var(--bb-shadow-sm)',
      border: '1px solid var(--bb-border)',
      flex: 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
        {icon && (
          <span style={{ color: 'var(--bb-brand-blue)', opacity: 0.8 }}>{icon}</span>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--bb-text-primary)', marginBottom: 6 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {trend && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            fontSize: 12, fontWeight: 600,
            color: trendUp ? 'var(--bb-status-success)' : 'var(--bb-status-danger)',
          }}>
            {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend}
          </span>
        )}
        {subtitle && <span style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>{subtitle}</span>}
      </div>
    </div>
  )
}
