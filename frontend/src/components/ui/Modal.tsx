import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen?: boolean
  open?: boolean  // alias for isOpen
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: number
  size?: string  // ignored, kept for compat
}

export function Modal({ isOpen, open, onClose, title, children, footer, maxWidth = 600 }: ModalProps) {
  const isVisible = isOpen ?? open ?? false
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isVisible) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isVisible, onClose])

  if (!isVisible) return null

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

interface ConfirmModalProps {
  isOpen?: boolean
  open?: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
}

export function ConfirmModal({ isOpen, open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', loading }: ConfirmModalProps) {
  const isVisible = isOpen ?? open ?? false
  return (
    <Modal
      isOpen={isVisible}
      onClose={onClose}
      title={title}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 'var(--bb-radius-sm)', border: '1px solid var(--bb-border)', background: 'none', cursor: 'pointer', fontSize: 14 }}>{cancelLabel}</button>
          <button onClick={onConfirm} disabled={loading} style={{ padding: '8px 16px', borderRadius: 'var(--bb-radius-sm)', border: 'none', background: 'var(--bb-brand-blue)', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontSize: 14 }}>
            {loading ? 'Loading…' : confirmLabel}
          </button>
        </div>
      }
    >
      {message ? <p style={{ fontSize: 14, color: 'var(--bb-text-secondary)' }}>{message}</p> : null}
    </Modal>
  )
}
