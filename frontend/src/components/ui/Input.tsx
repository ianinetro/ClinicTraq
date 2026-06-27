import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { Label } from './Label'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  prefix?: ReactNode
  suffix?: ReactNode
  required?: boolean
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, prefix, suffix, required, containerClassName, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className={clsx('flex flex-col gap-1', containerClassName)}>
        {label && <Label htmlFor={inputId} required={required}>{label}</Label>}
        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute left-3 text-[#676687] flex items-center pointer-events-none">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'w-full h-10 bg-white border rounded-[4px] text-sm text-[#12122C] placeholder-[#BABACE]',
              'transition-all duration-150 outline-none',
              'focus:border-[#3F4CFF] focus:shadow-[0_0_0_3px_rgba(63,76,255,0.16)]',
              error
                ? 'border-[#DC2626] shadow-[0_0_0_3px_rgba(220,38,38,0.12)]'
                : 'border-[#BABACE]',
              props.disabled && 'bg-[#EFF0FF] text-[#BABACE] cursor-not-allowed',
              prefix ? 'pl-9' : 'pl-3',
              suffix ? 'pr-9' : 'pr-3',
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 text-[#676687] flex items-center">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-[#B91C1C]">{error}</p>}
        {helperText && !error && <p className="text-xs text-[#676687]">{helperText}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'
