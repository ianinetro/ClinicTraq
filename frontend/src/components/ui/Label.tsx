import { clsx } from 'clsx'
import type { LabelHTMLAttributes } from 'react'

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

export function Label({ children, required, className, ...props }: LabelProps) {
  return (
    <label
      className={clsx(
        'block text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1',
        className,
      )}
      {...props}
    >
      {children}
      {required && <span className="text-[#B91C1C] ml-0.5">*</span>}
    </label>
  )
}
