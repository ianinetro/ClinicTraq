import { useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface PHIFieldProps {
  value: string
  label?: string
  onReveal?: () => void
  // Extended props used by some pages (kept for compatibility)
  fieldName?: string
  patientId?: string
  fieldType?: string
  inline?: boolean
  className?: string
}

export function PHIField({ value, label, onReveal }: PHIFieldProps) {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (!revealed) return
    const timer = setTimeout(() => setRevealed(false), 30000)
    return () => clearTimeout(timer)
  }, [revealed])

  const maskedValue = value.replace(/[^-* ]/g, '*')

  const handleReveal = () => {
    setRevealed(true)
    onReveal?.()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <span style={{ fontSize: 12, color: 'var(--bb-text-secondary)', fontWeight: 500 }}>{label}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontFamily: revealed ? 'inherit' : 'monospace',
          fontSize: 14, color: 'var(--bb-text-primary)',
          background: 'var(--bb-surface-app)',
          padding: '4px 8px', borderRadius: 'var(--bb-radius-sm)',
          border: '1px solid var(--bb-border)',
        }}>
          {revealed ? value : maskedValue}
        </span>
        <button
          onClick={revealed ? () => setRevealed(false) : handleReveal}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--bb-brand-blue)', display: 'flex', alignItems: 'center',
            gap: 4, fontSize: 12, padding: '4px 8px',
          }}
        >
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
          {revealed ? 'Hide' : 'Reveal'}
        </button>
      </div>
    </div>
  )
}
