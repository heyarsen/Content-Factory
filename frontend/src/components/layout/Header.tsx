import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'
import { Bell, LogOut, Menu, Search, Settings, User, ChevronDown } from 'lucide-react'
import { useMemo, useState, useRef, useEffect } from 'react'

interface HeaderProps {
  onToggleSidebar: () => void
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const greetingName = useMemo(() => {
    if (!user?.email) return 'Creator'
    const [name] = user.email.split('@')
    return name.charAt(0).toUpperCase() + name.slice(1)
  }, [user?.email])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
    setDropdownOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-12">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/60 bg-white/70 text-slate-600 shadow-sm backdrop-blur transition hover:border-brand-200 hover:text-brand-600 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden md:block">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Workspace</p>
            <p className="mt-1 text-xl font-semibold text-primary">Welcome back, {greetingName}</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3 md:gap-5">
          <div className="relative hidden flex-1 max-w-md items-center lg:flex">
            <Search className="pointer-events-none absolute left-4 h-4 w-4 text-slate-300" />
            <input
              type="text"
              placeholder="Quick search (Cmd+K)"
              className="w-full rounded-2xl border border-transparent bg-white/80 py-3 pl-11 pr-4 text-sm text-slate-600 shadow-inner outline-none transition focus:border-brand-200 focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <button
            type="button"
            className="relative hidden h-12 w-12 items-center justify-center rounded-2xl border border-white/60 bg-white/70 text-slate-400 shadow-sm backdrop-blur transition hover:border-brand-200 hover:text-brand-600 sm:flex"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 inline-flex h-2.5 w-2.5 rounded-full bg-brand-500" />
          </button>

          {/* User Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="hidden items-center gap-3 rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm text-slate-500 shadow-sm backdrop-blur transition hover:border-brand-200 hover:text-brand-600 md:flex"
            >
              <div className="hidden flex-col leading-tight sm:flex">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Account</span>
                <span className="font-semibold text-primary">{user?.email}</span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="py-2">
                  <div className="px-4 py-2 text-xs font-medium text-slate-400">SETTINGS</div>
                  <button
                    onClick={() => {
                      navigate('/profile')
                      setDropdownOpen(false)
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <User className="h-4 w-4" />
                    Profile Settings
                  </button>
                  <button
                    onClick={() => {
                      navigate('/preferences')
                      setDropdownOpen(false)
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <Settings className="h-4 w-4" />
                    Preferences
                  </button>
                  <div className="my-1 border-t border-slate-200" />
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

          <Button variant="ghost" size="md" onClick={handleSignOut} className="gap-2 rounded-2xl px-4 py-3 text-sm font-semibold md:hidden">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  )
}

