import { clsx } from 'clsx'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface KPICardProps {
  label: string
  value: string | number
  delta?: number
  deltaLabel?: string
  timeframe?: string
  onClick?: () => void
  loading?: boolean
  className?: string
  accentColor?: string
}

export function KPICard({
  label, value, delta, deltaLabel, timeframe, onClick, loading, className, accentColor
}: KPICardProps) {
  if (loading) {
    return (
      <div className={clsx('bg-white rounded-lg border border-[#E3E3F1] p-4 animate-pulse', className)}>
        <div className="h-3 bg-[#E3E3F1] rounded w-2/3 mb-3" />
        <div className="h-8 bg-[#E3E3F1] rounded w-1/2 mb-2" />
        <div className="h-3 bg-[#E3E3F1] rounded w-1/3" />
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={clsx(
        'bg-white rounded-lg border border-[#E3E3F1] p-4 transition-colors duration-150',
        onClick && 'cursor-pointer hover:bg-[#EFF0FF] hover:border-[#A2A8FF]',
        className,
      )}
      style={accentColor ? { borderTop: `3px solid ${accentColor}` } : undefined}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#12122C] leading-tight tabular-nums">{value}</p>
      {(delta !== undefined || timeframe) && (
        <div className="flex items-center gap-1.5 mt-1">
          {delta !== undefined && (
            <span className={clsx(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              delta > 0 ? 'text-[#B91C1C]' : 'text-[#047857]',
            )}>
              {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(delta)}
            </span>
          )}
          {deltaLabel && <span className="text-xs text-[#676687]">{deltaLabel}</span>}
          {timeframe && <span className="text-xs text-[#676687]">{timeframe}</span>}
        </div>
      )}
    </div>
  )
}
