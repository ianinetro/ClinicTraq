import { useEffect } from 'react'
import { useCommandPalette } from '../hooks/useCommandPalette'

function isEditableElement(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

function dispatch(name: string) {
  window.dispatchEvent(new CustomEvent(name))
}

export function useKeyboardShortcuts() {
  const { openPalette } = useCommandPalette()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      const inEditable = isEditableElement(document.activeElement)

      // Ctrl+K / Cmd+K — command palette
      if (meta && e.key === 'k') {
        e.preventDefault()
        openPalette()
        return
      }

      // Ctrl+S / Cmd+S — save
      if (meta && e.key === 's') {
        e.preventDefault()
        dispatch('app:save')
        return
      }

      // Escape
      if (e.key === 'Escape') {
        dispatch('app:escape')
        return
      }

      // Keys that must not fire when inside an input/textarea/select
      if (inEditable) return

      // ? — shortcut help modal
      if (e.key === '?') {
        dispatch('app:shortcuts-help')
        return
      }

      // J — next row
      if (e.key === 'j' || e.key === 'J') {
        dispatch('app:row-next')
        return
      }

      // K — previous row
      if (e.key === 'k' || e.key === 'K') {
        dispatch('app:row-prev')
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openPalette])
}
