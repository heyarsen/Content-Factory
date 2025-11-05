import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'
import { Bell, LogOut, Menu, User } from 'lucide-react'
import { useMemo, useState, useRef, useEffect } from 'react'

interface HeaderProps {
  onToggleSidebar: () => void
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)

  const greetingName = useMemo(() => {
    if (!user?.email) return 'Creator'
    const [name] = user.email.split('@')
    return name.charAt(0).toUpperCase() + name.slice(1)
  }, [user?.email])

  // Close notification dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
    }

    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [notificationsOpen])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
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

        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3 md:gap-5">
          {/* Notifications */}
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative flex h-12 w-12 min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-white/60 bg-white/70 text-slate-400 shadow-sm backdrop-blur transition hover:border-brand-200 hover:text-brand-600 touch-manipulation"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 inline-flex h-2.5 w-2.5 rounded-full bg-brand-500" />
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-80 sm:max-w-80 rounded-xl border border-slate-200 bg-white shadow-lg z-50">
                <div className="p-4">
                  <div className="mb-2 text-sm font-semibold text-slate-900">Notifications</div>
                  <div className="text-sm text-slate-500">
                    No new notifications
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Account Button - Mobile */}
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex h-12 w-12 min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-white/60 bg-white/70 text-slate-500 shadow-sm backdrop-blur transition hover:border-brand-200 hover:text-brand-600 touch-manipulation md:hidden"
            aria-label="Account"
          >
            <User className="h-5 w-5" />
          </button>

          {/* Account Button - Desktop */}
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="hidden items-center gap-3 rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm text-slate-500 shadow-sm backdrop-blur transition hover:border-brand-200 hover:text-brand-600 md:flex min-h-[44px] touch-manipulation"
          >
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Account</span>
              <span className="font-semibold text-primary">{user?.email}</span>
            </div>
            <User className="h-4 w-4" />
          </button>

          <Button variant="ghost" size="md" onClick={handleSignOut} className="hidden gap-2 rounded-2xl px-4 py-3 text-sm font-semibold md:flex min-h-[44px]">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  )
}

