import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { TopNav } from './TopNav'
import { SideNav } from './SideNav'
import { CommandPaletteContext } from '../../hooks/useCommandPalette'
import { CommandPalette } from '../ui/CommandPalette'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { ShortcutHelpModal } from '../ui/ShortcutHelpModal'

export function AppShell() {
  const [cmdOpen, setCmdOpen] = useState(false)
  useKeyboardShortcuts()

  return (
    <CommandPaletteContext.Provider value={{
      open: cmdOpen,
      openPalette: () => setCmdOpen(true),
      closePalette: () => setCmdOpen(false),
    }}>
      <div className="flex flex-col h-screen bg-[#F2F2F8] overflow-hidden">
        <TopNav />
        <div className="flex flex-1 overflow-hidden">
          <SideNav />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <ShortcutHelpModal />
    </CommandPaletteContext.Provider>
  )
}
