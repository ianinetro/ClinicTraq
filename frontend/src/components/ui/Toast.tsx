import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  duration?: number
}

type AddToastOpts = Omit<Toast, 'id' | 'title'> & { title?: string; message?: string }

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void
  addToast: (opts: AddToastOpts) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
  addToast: () => {},
  dismiss: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

const variantConfig: Record<ToastVariant, { icon: React.ElementType; classes: string }> = {
  success: { icon: CheckCircle2, classes: 'border-l-[#16A34A] text-[#16A34A]' },
  error:   { icon: AlertCircle,  classes: 'border-l-[#DC2626] text-[#DC2626]' },
  warning: { icon: AlertTriangle, classes: 'border-l-[#D97706] text-[#D97706]' },
  info:    { icon: Info,          classes: 'border-l-[#0410BD] text-[#0410BD]' },
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const cfg = variantConfig[toast.variant]
  const Icon = cfg.icon

  useEffect(() => {
    const duration = toast.duration ?? 4000
    if (duration <= 0) return
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [toast.duration, onDismiss])

  return (
    <div
      className={clsx(
        'flex items-start gap-3 bg-white border border-[#E3E3F1] border-l-4 rounded-lg shadow-lg px-4 py-3 w-80 pointer-events-auto',
        cfg.classes,
      )}
    >
      <Icon size={18} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#12122C]">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-[#676687] mt-0.5">{toast.description}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 text-[#BABACE] hover:text-[#676687] transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...opts, id }])
  }, [])

  const addToast = useCallback((opts: AddToastOpts) => {
    const id = Math.random().toString(36).slice(2)
    const title = opts.title ?? opts.message ?? ''
    const { message: _message, ...rest } = opts
    setToasts((prev) => [...prev, { ...rest, title, id }])
  }, [])

  return (
    <ToastContext.Provider value={{ toast, addToast, dismiss }}>
      {children}
      {createPortal(
        <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-[100] pointer-events-none">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
