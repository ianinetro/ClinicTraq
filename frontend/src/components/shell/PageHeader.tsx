import { type ReactNode } from 'react'
import { Button } from '../ui/Button'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  primaryAction?: {
    label: string
    onClick: () => void
    icon?: ReactNode
    loading?: boolean
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  children?: ReactNode
}

export function PageHeader({ eyebrow, title, description, primaryAction, secondaryAction, children }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between px-6 pt-6 pb-4">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#676687] mb-1">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-[650] text-[#12122C] leading-8">{title}</h1>
        {description && (
          <p className="text-sm text-[#676687] mt-1">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 ml-4 mt-0.5">
        {children}
        {secondaryAction && (
          <Button variant="secondary" size="sm" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
        {primaryAction && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={primaryAction.icon}
            loading={primaryAction.loading}
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </Button>
        )}
      </div>
    </div>
  )
}
