import { useState } from 'react'
import { Bell, HelpCircle, Search, ChevronDown, LogOut, User } from 'lucide-react'
import { useCommandPalette } from '../../hooks/useCommandPalette'
import { useKeyboard } from '../../hooks/useKeyboard'
import { useNavigate } from 'react-router-dom'

export function TopNav() {
  const { openPalette } = useCommandPalette()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const navigate = useNavigate()

  useKeyboard({ key: 'k', meta: true, handler: openPalette })

  function handleSignOut() {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    navigate('/login')
  }

  return (
    <header className="h-14 bg-[#12122C] flex items-center px-5 gap-4 flex-shrink-0 z-30">
      {/* Wordmark */}
      <div className="flex-shrink-0">
        <span className="text-white font-bold text-lg tracking-tight">
          Clinic<span className="text-[#00CBDE]">Traq</span>
        </span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md mx-auto">
        <button
          onClick={openPalette}
          className="w-full flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white/60 rounded-md px-3 h-8 text-sm transition-colors"
          aria-label="Open search"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Search patients, claims, visits…</span>
          <kbd className="text-xs bg-white/10 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1 ml-auto">
        <button className="relative p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#00CBDE] rounded-full" />
        </button>
        <button className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors">
          <HelpCircle size={18} />
        </button>

        {/* User menu */}
        <div className="relative ml-1">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-2 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[#0410BD] flex items-center justify-center text-xs font-semibold text-white">
              U
            </div>
            <ChevronDown size={14} />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-[#E3E3F1] py-1 w-48 z-50">
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#12122C] hover:bg-[#EFF0FF]">
                  <User size={14} className="text-[#676687]" />
                  Profile
                </button>
                <hr className="border-[#E3E3F1] my-1" />
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#B91C1C] hover:bg-[#FEF2F2]"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
