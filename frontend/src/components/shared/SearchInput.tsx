import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

interface SearchInputProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  loading?: boolean
  debounceMs?: number
  className?: string
}

export function SearchInput({
  value: controlledValue,
  onChange,
  placeholder = 'Search…',
  loading = false,
  debounceMs = 300,
  className,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(controlledValue ?? '')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isControlled = controlledValue !== undefined

  const debouncedOnChange = useCallback(
    (val: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => onChange(val), debounceMs)
    },
    [onChange, debounceMs],
  )

  useEffect(() => {
    if (isControlled) setLocalValue(controlledValue)
  }, [controlledValue, isControlled])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setLocalValue(val)
    debouncedOnChange(val)
  }

  function handleClear() {
    setLocalValue('')
    onChange('')
  }

  return (
    <div className={clsx('relative flex items-center', className)}>
      <span className="absolute left-3 text-[#676687] pointer-events-none">
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
      </span>
      <input
        type="search"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full h-9 bg-white border border-[#BABACE] rounded-md pl-9 pr-8 text-sm text-[#12122C] placeholder-[#BABACE] outline-none focus:border-[#3F4CFF] focus:shadow-[0_0_0_3px_rgba(63,76,255,0.16)] transition-all"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-2 text-[#676687] hover:text-[#12122C] p-0.5 rounded"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
