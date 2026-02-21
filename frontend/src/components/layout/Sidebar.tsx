import { Fragment } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  Share2,
  Sparkles,
  Calendar,
  SlidersHorizontal,
  BarChart3,
  MessagesSquare,
  Search,
  X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCredits } from '../../hooks/useCredits'
import { useLanguage } from '../../contexts/LanguageContext'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth()
  const { credits, subscription, unlimited, loading: creditsLoading } = useCredits()
  const { t } = useLanguage()

  const location = useLocation()

  console.log('[Sidebar] User check:', { user: user?.email, role: user?.role, isAdmin: user?.role === 'admin' })

  const navigation = [
    { label: 'Content Studio', to: '/planning', icon: Calendar, hint: 'Calendar, uploads, AI videos, automation' },
    { label: 'Social Accounts', to: '/social', icon: Share2, match: (pathname: string) => pathname === '/social' },
    { label: 'Analytics', to: '/analytics', icon: BarChart3 },
    { label: 'Trend Searcher', to: '/trend-searcher', icon: Search },
  ]

  const secondaryNavigation = [
    { label: 'Workspace Preferences', to: '/preferences', icon: SlidersHorizontal },
  ]

  const adminNavigation = [
    { label: t('common.admin_dashboard') || 'Admin Dashboard', to: '/admin', icon: BarChart3 },
    { label: t('common.admin_support') || 'Admin Support', to: '/admin/support', icon: MessagesSquare },
  ]

  return (
    <Fragment>
      <div
        className={`fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform transition-all duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
          } ${!isOpen ? 'pointer-events-none lg:pointer-events-auto' : ''}`}
      >
        <div
          className="flex h-screen flex-col border-r border-white/60 bg-white/80 px-6 py-8 backdrop-blur-xl shadow-[0_25px_70px_-35px_rgba(15,23,42,0.35)]"
        >
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-400 text-white shadow-md">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide text-slate-500 uppercase">AI SMM</p>
                <p className="text-lg font-bold text-primary">Creator Studio</p>
              </div>
            </Link>
            <button
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 lg:hidden touch-manipulation active:scale-95 shadow-sm"
              aria-label="Close menu"
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-10 flex flex-1 flex-col gap-2 overflow-y-auto">
            {navigation.map(({ label, to, icon: Icon, hint, match }) => {
              const isActive = match ? match(location.pathname) : location.pathname === to || location.pathname.startsWith(to + '/')
              return (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={`group relative flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 touch-manipulation active:scale-[0.98] ${isActive
                    ? 'bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent text-brand-600'
                    : 'text-slate-500 hover:bg-white hover:text-primary'
                    }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 ${isActive
                      ? 'border-brand-200 bg-white text-brand-600 shadow-sm'
                      : 'border-transparent bg-slate-100 text-slate-500 group-hover:border-slate-200'
                      }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate">{label}</span>
                    {hint && <span className="block text-xs font-medium text-slate-400">{hint}</span>}
                  </div>
                  {isActive && (
                    <span className="absolute inset-y-2 right-0 w-1.5 rounded-full bg-brand-500" />
                  )}
                </NavLink>
              )
            })}

            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('common.settings')}</p>
              {secondaryNavigation.map(({ label, to, icon: Icon }) => {
                const isActive = location.pathname === to || location.pathname.startsWith(to + '/')
                return (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={onClose}
                    className={`group relative flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 touch-manipulation active:scale-[0.98] ${isActive
                      ? 'bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent text-brand-600'
                      : 'text-slate-500 hover:bg-white hover:text-primary'
                      }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 ${isActive
                        ? 'border-brand-200 bg-white text-brand-600 shadow-sm'
                        : 'border-transparent bg-slate-100 text-slate-500 group-hover:border-slate-200'
                        }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span>{label}</span>
                  </NavLink>
                )
              })}
            </div>

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
                      className={`group relative flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 touch-manipulation active:scale-[0.98] ${isActive
                        ? 'bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent text-brand-600'
                        : 'text-slate-500 hover:bg-white hover:text-primary'
                        }`}
                    >
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 ${isActive
                          ? 'border-brand-200 bg-white text-brand-600 shadow-sm'
                          : 'border-transparent bg-slate-100 text-slate-500 group-hover:border-slate-200'
                          }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span>{label}</span>
                      {isActive && (
                        <span className="absolute inset-y-2 right-0 w-1.5 rounded-full bg-brand-500" />
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
              className="group block rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-md transition-all hover:border-brand-200 hover:shadow-lg hover:from-brand-50/50 hover:to-white"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${credits !== null && credits < 5 && !unlimited ? 'bg-amber-100 text-amber-600' : 'bg-brand-100 text-brand-600'}`}>
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-600">
                      {creditsLoading ? t('loading.loading') : (subscription?.plan_name || t('sidebar.free_plan'))}
                    </p>
                    <p className="text-base font-bold text-primary leading-tight">
                      {creditsLoading ? '—' : (unlimited ? t('sidebar.unlimited') : `${credits ?? 0}`)}
                      {!unlimited && (
                        <span className="ml-1 text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                          {t('sidebar.credits')}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {!creditsLoading && !unlimited && subscription?.credits_included && (
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[10px] text-slate-400">/ {subscription.credits_included}</p>
                  </div>
                )}
              </div>

              {/* Minimal Progress Bar */}
              {!creditsLoading && !unlimited && subscription?.credits_included && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-brand-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, ((credits ?? 0) / subscription.credits_included) * 100)}%` }}
                  />
                </div>
              )}

              {/* Compact Action Button */}
              {!creditsLoading && !unlimited && (
                <div className="mt-2">
                  {!subscription || subscription.status !== 'active' ? (
                    <button className="w-full rounded-md bg-amber-600 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 shadow-md">
                      {t('sidebar.buy_subscription')}
                    </button>
                  ) : credits !== null && credits < 5 ? (
                    <button className="w-full rounded-md bg-brand-600 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700">
                      {t('sidebar.top_up')}
                    </button>
                  ) : null}
                </div>
              )}
            </Link>
          </div>
        </div>
      </aside>
    </Fragment>
  )
}
