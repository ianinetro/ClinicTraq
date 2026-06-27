import { type ReactNode, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive' | 'tertiary'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children?: ReactNode
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-[#0410BD] text-white hover:bg-[#030EA8] active:bg-[#020D97] focus-visible:ring-2 focus-visible:ring-[#0410BD] focus-visible:ring-offset-2 disabled:bg-[#C7C8E8]',
  secondary:
    'bg-white text-[#12122C] border border-[#E3E3F1] hover:bg-[#EFF0FF] active:bg-[#E3E3F1] focus-visible:ring-2 focus-visible:ring-[#0410BD] focus-visible:ring-offset-2 disabled:opacity-50',
  ghost:
    'text-[#676687] hover:bg-[#EFF0FF] hover:text-[#12122C] focus-visible:ring-2 focus-visible:ring-[#0410BD] focus-visible:ring-offset-2 disabled:opacity-50',
  danger:
    'bg-[#DC2626] text-white hover:bg-[#B91C1C] active:bg-[#991B1B] focus-visible:ring-2 focus-visible:ring-[#DC2626] focus-visible:ring-offset-2 disabled:opacity-50',
  destructive:
    'bg-[#DC2626] text-white hover:bg-[#B91C1C] active:bg-[#991B1B] focus-visible:ring-2 focus-visible:ring-[#DC2626] focus-visible:ring-offset-2 disabled:opacity-50',
  tertiary:
    'text-[#0410BD] hover:bg-[#EFF0FF] focus-visible:ring-2 focus-visible:ring-[#0410BD] focus-visible:ring-offset-2 disabled:opacity-50',
}

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  xs: 'h-6 px-2 text-xs gap-1',
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-base gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors outline-none',
        variantClasses[variant],
        sizeClasses[size],
        (disabled || loading) && 'cursor-not-allowed',
        className,
      )}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin flex-shrink-0" />
      ) : leftIcon ? (
        <span className="flex-shrink-0">{leftIcon}</span>
      ) : null}
      {children}
      {rightIcon && !loading && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  )
}
