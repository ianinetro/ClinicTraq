import { useState } from 'react'
import { Bell, HelpCircle, Search, ChevronDown, LogOut, User } from 'lucide-react'
import { useCommandPalette } from '../../hooks/useCommandPalette'
import { useKeyboard } from '../../hooks/useKeyboard'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

/** Human-readable label for each role string. */
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  billing_admin: 'Billing Admin',
  billing_member: 'Billing',
  payment_poster: 'Payment Poster',
  practice_admin: 'Practice Admin',
  read_only: 'Read Only',
}

function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

/** Derive initials from a display name or email. */
function getInitials(name: string | undefined, email: string | undefined): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase()
  }
  if (email) return email[0].toUpperCase()
  return 'U'
}

export function TopNav() {
  const { openPalette } = useCommandPalette()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  useKeyboard({ key: 'k', meta: true, handler: openPalette })

  function handleSignOut() {
    logout()
    navigate('/login')
  }

  function handleHelpShortcuts() {
    window.dispatchEvent(new CustomEvent('app:shortcuts-help'))
  }

  const initials = getInitials(user?.name, user?.email)
  const roleLabel = getRoleLabel(user?.role ?? 'read_only')

  return (
    <header className="h-14 bg-[--bb-brand-ink] flex items-center px-5 gap-4 flex-shrink-0 z-30">
      {/* Wordmark */}
      <div className="flex-shrink-0">
        <span className="text-white font-bold text-lg tracking-tight">
          Clinic<span className="text-[--bb-brand-blue] brightness-[2.5]">Traq</span>
        </span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md mx-auto">
        <button
          onClick={openPalette}
          className="w-full flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white/60 rounded-md px-3 h-8 text-sm transition-colors"
          aria-label="Open search (Ctrl+K)"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Search patients, claims, visits…</span>
          <kbd className="text-xs bg-white/10 px-1.5 py-0.5 rounded font-mono hidden sm:inline">⌘K</kbd>
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1 ml-auto">
        {/* Notification bell — static indicator, no live count yet */}
        <button
          className="relative p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </button>

        {/* Shortcuts help */}
        <button
          onClick={handleHelpShortcuts}
          className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          aria-label="Keyboard shortcuts"
        >
          <HelpCircle size={18} />
        </button>

        {/* User menu */}
        <div className="relative ml-1">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-2 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            aria-label="User menu"
            aria-expanded={userMenuOpen}
          >
            <div className="w-7 h-7 rounded-full bg-[--bb-brand-blue] flex items-center justify-center text-xs font-semibold text-white select-none">
              {initials}
            </div>
            <ChevronDown size={14} />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 bg-[--bb-surface-card] rounded-lg shadow-lg border border-[--bb-border] py-1 w-56 z-50">
                {/* Identity block */}
                <div className="px-3 py-2 border-b border-[--bb-border]">
                  {user?.name && (
                    <p className="text-sm font-medium text-[--bb-text-primary] truncate">{user.name}</p>
                  )}
                  {user?.email && (
                    <p className="text-xs text-[--bb-text-secondary] truncate">{user.email}</p>
                  )}
                  <span className="mt-1.5 inline-block text-xs font-medium px-1.5 py-0.5 rounded bg-[--bb-surface-app] text-[--bb-text-secondary] border border-[--bb-border]">
                    {roleLabel}
                  </span>
                </div>

                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[--bb-text-primary] hover:bg-[--bb-surface-app] transition-colors">
                  <User size={14} className="text-[--bb-text-secondary]" />
                  Profile
                </button>
                <hr className="border-[--bb-border] my-1" />
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[--bb-status-danger] hover:bg-[--bb-surface-app] transition-colors"
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
