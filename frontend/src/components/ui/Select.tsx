import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { Label } from './Label'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  required?: boolean
  options: { value: string; label: string }[]
  placeholder?: string
  containerClassName?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, required, options, placeholder, containerClassName, className, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className={clsx('flex flex-col gap-1', containerClassName)}>
        {label && <Label htmlFor={selectId} required={required}>{label}</Label>}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={clsx(
              'w-full h-10 bg-white border rounded-[4px] text-sm text-[#12122C] pl-3 pr-9 appearance-none',
              'transition-all duration-150 outline-none cursor-pointer',
              'focus:border-[#3F4CFF] focus:shadow-[0_0_0_3px_rgba(63,76,255,0.16)]',
              error
                ? 'border-[#DC2626] shadow-[0_0_0_3px_rgba(220,38,38,0.12)]'
                : 'border-[#BABACE]',
              props.disabled && 'bg-[#EFF0FF] text-[#BABACE] cursor-not-allowed',
              className,
            )}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#676687] pointer-events-none"
          />
        </div>
        {error && <p className="text-xs text-[#B91C1C]">{error}</p>}
        {helperText && !error && <p className="text-xs text-[#676687]">{helperText}</p>}
      </div>
    )
  },
)

Select.displayName = 'Select'
