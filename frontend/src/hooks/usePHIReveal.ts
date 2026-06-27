import { useState, useEffect, useRef, useCallback } from 'react'

interface PHIRevealState {
  revealed: boolean
  timeRemaining: number
  reveal: () => void
  hide: () => void
}

export function usePHIReveal(duration = 30): PHIRevealState {
  const [revealed, setRevealed] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(duration)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const hide = useCallback(() => {
    clearTimers()
    setRevealed(false)
    setTimeRemaining(duration)
  }, [clearTimers, duration])

  const reveal = useCallback(() => {
    setRevealed(true)
    setTimeRemaining(duration)
    clearTimers()

    let remaining = duration
    intervalRef.current = setInterval(() => {
      remaining -= 1
      setTimeRemaining(remaining)
      if (remaining <= 0) {
        clearTimers()
        setRevealed(false)
        setTimeRemaining(duration)
      }
    }, 1000)
  }, [duration, clearTimers])

  useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  return { revealed, timeRemaining, reveal, hide }
}
