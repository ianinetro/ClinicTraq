import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: number
}

export function Modal({ isOpen, onClose, title, children, footer, maxWidth = 600 }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(18,18,44,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bb-surface-card)',
          borderRadius: 'var(--bb-radius-lg)',
          boxShadow: 'var(--bb-shadow-md)',
          width: '100%', maxWidth,
          maxHeight: '90vh', overflow: 'auto',
        }}
      >
        {title && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--bb-border)',
          }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-text-secondary)', display: 'flex', padding: 4 }}>
              <X size={18} />
            </button>
          </div>
        )}
        <div style={{ padding: '20px' }}>{children}</div>
        {footer && (
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--bb-border)',
            display: 'flex', justifyContent: 'flex-end', gap: 8,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
