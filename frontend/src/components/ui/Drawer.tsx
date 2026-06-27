import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  width?: number | string
  children: ReactNode
  footer?: ReactNode
}

export function Drawer({ open, onClose, title, width = 400, children, footer }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className={clsx(
          'relative ml-auto bg-white shadow-[0_20px_40px_rgba(18,18,44,0.14)] flex flex-col h-full',
          'animate-in slide-in-from-right duration-200',
        )}
        style={{ width: typeof width === 'number' ? `${width}px` : width }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E3E3F1] flex-shrink-0">
          {title && <h3 className="text-base font-semibold text-[#12122C]">{title}</h3>}
          <button
            onClick={onClose}
            className="ml-auto text-[#676687] hover:text-[#12122C] p-1 rounded hover:bg-[#EFF0FF] transition-colors"
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-[#E3E3F1] flex items-center justify-end gap-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
