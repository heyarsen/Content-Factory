import { Fragment } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  Clapperboard,
  LayoutDashboard,
  Share2,
  Sparkles,
  Zap,
  Calendar,
  User,
  Settings,
  BarChart3,
  MessagesSquare,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

import { useCredits } from '../../hooks/useCredits'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navigation = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Create Video', to: '/create', icon: Zap },
  // { label: 'Prompts', to: '/prompts', icon: Sparkles },
  { label: 'Video Planning', to: '/planning', icon: Calendar },
  { label: 'My Videos', to: '/videos', icon: Clapperboard },
  { label: 'Social Accounts', to: '/social', icon: Share2 },
  { label: 'Avatars', to: '/avatars', icon: User },
  { label: 'Preferences', to: '/preferences', icon: Settings },
]

const adminNavigation = [
  { label: 'Admin Dashboard', to: '/admin', icon: BarChart3 },
  { label: 'Admin Support', to: '/admin/support', icon: MessagesSquare },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth()
  const { credits, subscription, unlimited } = useCredits()

  const location = useLocation()

  return (
    <Fragment>
      <div
        className={`fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        onClick={onClose}
      />

      <aside
        className={`fixed z-40 inset-y-0 left-0 w-72 transform transition-all duration-300 lg:fixed lg:translate-x-0`}
      >
        <div
          className={`flex h-screen flex-col border-r border-white/60 bg-white/80 px-6 py-8 backdrop-blur-xl shadow-[0_25px_70px_-35px_rgba(15,23,42,0.35)] transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
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

          <nav className="mt-10 flex flex-1 flex-col gap-2 overflow-y-auto">
            {navigation.map(({ label, to, icon: Icon }) => {
              const isActive = location.pathname === to || location.pathname.startsWith(to + '/')
              return (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={`group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 ${isActive
                    ? 'bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent text-brand-600'
                    : 'text-slate-500 hover:bg-white hover:text-primary'
                    }`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 ${isActive
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

            {user?.role === 'admin' && (
              <div className="mt-6 flex flex-col gap-2">
                <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Administration</p>
                {adminNavigation.map(({ label, to, icon: Icon }) => {
                  const isActive = location.pathname === to || location.pathname.startsWith(to + '/')
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={onClose}
                      className={`group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 ${isActive
                        ? 'bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent text-brand-600'
                        : 'text-slate-500 hover:bg-white hover:text-primary'
                        }`}
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 ${isActive
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
              </div>
            )}


          </nav>

          <div className="mt-auto px-2 pb-2">
            <Link
              to="/credits"
              onClick={onClose}
              className="group block rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm transition-all hover:border-brand-200 hover:shadow-md hover:from-brand-50/50 hover:to-white"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${credits !== null && credits < 5 && !unlimited ? 'bg-amber-100 text-amber-600' : 'bg-brand-100 text-brand-600'}`}>
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      {subscription?.plan_name || 'Free Plan'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {unlimited ? 'Unlimited' : `${credits ?? 0} credits`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Bar (Visual flair) */}
              {!unlimited && subscription?.credits_included && (
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-brand-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, ((credits ?? 0) / subscription.credits_included) * 100)}%` }}
                  />
                </div>
              )}

              {/* Top Up Button */}
              {credits !== null && credits < 5 && !unlimited && (
                <button className="mt-3 w-full rounded-xl bg-brand-600 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700">
                  Top Up Credits
                </button>
              )}
            </Link>
          </div>
        </div>
      </aside>
    </Fragment>
  )
}

