import React from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: { value: string; label: string }[]
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, style, ...props }, ref) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {label && (
          <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-text-primary)' }}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          style={{
            height: 36,
            padding: '0 12px',
            border: `1px solid ${error ? 'var(--bb-status-danger)' : 'var(--bb-border)'}`,
            borderRadius: 'var(--bb-radius)',
            fontSize: 14,
            color: 'var(--bb-text-primary)',
            background: 'var(--bb-surface-card)',
            outline: 'none',
            width: '100%',
            cursor: 'pointer',
            ...style,
          }}
          {...props}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {error && <span style={{ fontSize: 12, color: 'var(--bb-status-danger)' }}>{error}</span>}
        {hint && !error && <span style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>{hint}</span>}
      </div>
    )
  }
)
Select.displayName = 'Select'
