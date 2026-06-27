import { Eye, EyeOff } from 'lucide-react'
import { clsx } from 'clsx'
import { usePHIReveal } from '../../hooks/usePHIReveal'
import { api } from '../../services/api'

type PHIFieldType = 'name' | 'dob' | 'ssn' | 'phone' | 'email' | 'address' | 'generic'

interface PHIFieldProps {
  value: string
  fieldName: string
  patientId: string
  fieldType?: PHIFieldType
  revealDuration?: number
  className?: string
  inline?: boolean
}

function maskValue(value: string, fieldType: PHIFieldType): string {
  switch (fieldType) {
    case 'name':
      return '••••• •••••'
    case 'dob':
      return '••/••/••••'
    case 'ssn': {
      const last4 = value.slice(-4)
      return `•••-••-${last4}`
    }
    case 'phone':
      return '(•••) •••-••••'
    case 'email':
      return '•••••@•••••.•••'
    case 'address':
      return '•••• ••••• ••, •• •••••'
    default:
      return '•'.repeat(Math.min(value.length || 8, 12))
  }
}

export function PHIField({
  value, fieldName, patientId, fieldType = 'generic', revealDuration = 30, className, inline = false,
}: PHIFieldProps) {
  const { revealed, timeRemaining, reveal, hide } = usePHIReveal(revealDuration)

  async function handleReveal() {
    if (revealed) {
      hide()
      return
    }
    // Non-blocking audit log
    api.audit.phiReveal(patientId, fieldName).catch(() => {})
    reveal()
  }

  const displayValue = revealed ? value : maskValue(value, fieldType)

  if (inline) {
    return (
      <span className={clsx('inline-flex items-center gap-1', className)}>
        <span className={clsx('font-mono text-sm', !revealed && 'text-[#BABACE] tracking-wider')}>
          {displayValue}
        </span>
        <button
          onClick={handleReveal}
          aria-label={revealed ? `Hide ${fieldName}` : `Reveal ${fieldName}`}
          className="text-[#676687] hover:text-[#0410BD] transition-colors p-0.5 rounded"
        >
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        {revealed && (
          <span className="text-[10px] text-[#676687]">Hiding in {timeRemaining}s</span>
        )}
      </span>
    )
  }

  return (
    <div className={clsx('flex flex-col gap-0.5', className)}>
      <div className="flex items-center gap-1.5">
        <span className={clsx(
          'text-sm',
          revealed ? 'text-[#12122C]' : 'text-[#BABACE] tracking-wider font-mono',
        )}>
          {displayValue}
        </span>
        <button
          onClick={handleReveal}
          aria-label={revealed ? `Hide ${fieldName}` : `Reveal ${fieldName}`}
          className="text-[#676687] hover:text-[#0410BD] transition-colors p-0.5 rounded hover:bg-[#EFF0FF]"
        >
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {revealed && (
        <p className="text-[10px] text-[#676687]">Hiding in {timeRemaining}s</p>
      )}
    </div>
  )
}
