import { useEffect } from 'react'

interface KeyboardShortcut {
  key: string
  meta?: boolean
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  handler: (e: KeyboardEvent) => void
}

export function useKeyboard({ key, meta, ctrl, shift, alt, handler }: KeyboardShortcut) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (meta && !e.metaKey && !e.ctrlKey) return
      if (ctrl && !e.ctrlKey) return
      if (shift && !e.shiftKey) return
      if (alt && !e.altKey) return
      if (e.key.toLowerCase() !== key.toLowerCase()) return
      e.preventDefault()
      handler(e)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [key, meta, ctrl, shift, alt, handler])
}
