import { Fragment, useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  CalendarCheck,
  Clapperboard,
  LayoutDashboard,
  PenSquare,
  Share2,
  Sparkles,
  Workflow,
  Shield,
  Zap,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navigation = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Quick Create', to: '/quick-create', icon: Zap },
  { label: 'Videos', to: '/videos', icon: Clapperboard },
  { label: 'Generate', to: '/generate', icon: Sparkles },
  { label: 'Content Factory', to: '/content', icon: PenSquare },
  { label: 'Workflows', to: '/workflows', icon: Workflow },
  { label: 'Social Accounts', to: '/social', icon: Share2 },
  { label: 'Scheduled Posts', to: '/posts', icon: CalendarCheck },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const { isAdmin } = useAuth()
  
  // Debug: Log admin status
  useEffect(() => {
    console.log('[Sidebar] Admin status:', isAdmin)
  }, [isAdmin])

  return (
    <Fragment>
      <div
        className={`fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed z-40 inset-y-0 left-0 w-72 transform transition-all duration-300 lg:static lg:translate-x-0 lg:z-auto`}
      >
        <div
          className={`flex h-full flex-col border-r border-white/60 bg-white/80 px-6 py-8 backdrop-blur-xl shadow-[0_25px_70px_-35px_rgba(15,23,42,0.35)] transition-transform duration-300 ${
            isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-400 text-white shadow-md">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide text-slate-500 uppercase">NovaCreate</p>
                <p className="text-lg font-bold text-primary">Creator Studio</p>
              </div>
            </Link>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 lg:hidden"
              aria-label="Close menu"
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <nav className="mt-10 flex flex-1 flex-col gap-2">
            {navigation.map(({ label, to, icon: Icon }) => {
              const isActive = location.pathname.startsWith(to)
              return (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={`group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent text-brand-600'
                      : 'text-slate-500 hover:bg-white hover:text-primary'
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 ${
                      isActive
                        ? 'border-brand-200 bg-white text-brand-600 shadow-sm'
                        : 'border-transparent bg-slate-100 text-slate-500 group-hover:border-slate-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span>{label}</span>
                  {isActive && (
                    <span className="absolute inset-y-0 right-0 w-1 rounded-full bg-brand-500" />
                  )}
                </NavLink>
              )
            })}
            {isAdmin && (
              <NavLink
                to="/admin"
                onClick={onClose}
                className={`group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  location.pathname.startsWith('/admin')
                    ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent text-amber-600'
                    : 'text-slate-500 hover:bg-white hover:text-primary'
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 ${
                    location.pathname.startsWith('/admin')
                      ? 'border-amber-200 bg-white text-amber-600 shadow-sm'
                      : 'border-transparent bg-slate-100 text-slate-500 group-hover:border-slate-200'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                </div>
                <span>Admin Panel</span>
                {location.pathname.startsWith('/admin') && (
                  <span className="absolute inset-y-0 right-0 w-1 rounded-full bg-amber-500" />
                )}
              </NavLink>
            )}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/60 bg-white/70 p-5 text-sm text-slate-500 shadow-inner backdrop-blur">
            <p className="font-semibold text-primary">Need a hand?</p>
            <p className="mt-1 text-xs text-slate-500">Explore the knowledge center for playbooks and best practices.</p>
            <Link
              to="/videos"
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              Go to library
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </aside>
    </Fragment>
  )
}

