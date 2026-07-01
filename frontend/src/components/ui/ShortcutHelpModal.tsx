import { useEffect, useState } from 'react'

interface ShortcutRow {
  keys: string[]
  description: string
}

interface ShortcutSection {
  title: string
  rows: ShortcutRow[]
}

const SECTIONS: ShortcutSection[] = [
  {
    title: 'Navigation',
    rows: [
      { keys: ['Ctrl', 'K'], description: 'Command palette' },
      { keys: ['?'], description: 'This help' },
      { keys: ['J'], description: 'Next row' },
      { keys: ['K'], description: 'Previous row' },
    ],
  },
  {
    title: 'Actions',
    rows: [
      { keys: ['Ctrl', 'S'], description: 'Save' },
      { keys: ['Esc'], description: 'Close / Cancel' },
      { keys: ['Enter'], description: 'Open selected row' },
    ],
  },
  {
    title: 'Claims',
    rows: [
      { keys: ['B'], description: 'Bill visit' },
      { keys: ['S'], description: 'Submit claim' },
      { keys: ['V'], description: 'Validate claim' },
    ],
  },
  {
    title: 'Table',
    rows: [
      { keys: ['Space'], description: 'Select row' },
      { keys: ['Shift', 'Click'], description: 'Range select' },
      { keys: ['Ctrl', 'A'], description: 'Select all' },
    ],
  },
]

function KeyChip({ label }: { label: string }) {
  return (
    <kbd
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        border: '1px solid var(--bb-border)',
        borderRadius: '4px',
        padding: '2px 8px',
        fontSize: '0.75rem',
        color: 'var(--bb-text-primary)',
        background: 'var(--bb-surface-app)',
        lineHeight: '1.4',
        display: 'inline-block',
      }}
    >
      {label}
    </kbd>
  )
}

function Section({ section }: { section: ShortcutSection }) {
  return (
    <div>
      <h3
        style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--bb-text-secondary)',
          marginBottom: '10px',
        }}
      >
        {section.title}
      </h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {section.rows.map((row) => (
          <li
            key={row.description}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              {row.keys.map((k, i) => (
                <span key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {i > 0 && (
                    <span style={{ color: 'var(--bb-text-secondary)', fontSize: '0.75rem' }}>+</span>
                  )}
                  <KeyChip label={k} />
                </span>
              ))}
            </span>
            <span style={{ color: 'var(--bb-text-secondary)', fontSize: '0.8125rem', textAlign: 'right' }}>
              {row.description}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ShortcutHelpModal({ open: openProp }: { open?: boolean } = {}) {
  const [open, setOpen] = useState(openProp ?? false)

  useEffect(() => {
    if (openProp !== undefined) setOpen(openProp)
  }, [openProp])

  useEffect(() => {
    function onEvent() {
      setOpen(true)
    }
    function onEscape() {
      setOpen(false)
    }
    window.addEventListener('app:shortcuts-help', onEvent)
    window.addEventListener('app:escape', onEscape)
    return () => {
      window.removeEventListener('app:shortcuts-help', onEvent)
      window.removeEventListener('app:escape', onEscape)
    }
  }, [])

  if (!open) return null

  return (
    /* Overlay */
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(18, 18, 44, 0.55)',
        backdropFilter: 'blur(2px)',
      }}
    >
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bb-surface-card)',
          borderRadius: '12px',
          boxShadow: '0 24px 64px rgba(18,18,44,0.22)',
          width: '100%',
          maxWidth: '620px',
          margin: '16px',
          padding: '28px 32px 32px',
          border: '1px solid var(--bb-border)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--bb-text-primary)',
            }}
          >
            Keyboard Shortcuts
          </h2>
          <button
            aria-label="Close"
            onClick={() => setOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--bb-text-secondary)',
              fontSize: '1.25rem',
              lineHeight: 1,
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            ×
          </button>
        </div>

        {/* Two-column grid of sections */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '28px 40px',
          }}
        >
          {SECTIONS.map((section) => (
            <Section key={section.title} section={section} />
          ))}
        </div>
      </div>
    </div>
  )
}
