import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationContext'
import { Bell, Menu, User, X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { useMemo, useState, useRef, useEffect } from 'react'

interface HeaderProps {
  onToggleSidebar: () => void
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotifications()
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

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
      <div className="flex h-16 w-full items-center justify-between px-6 sm:px-8 lg:px-14">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-brand-400 hover:text-brand-500 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden md:block">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Workspace</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">Welcome back, {greetingName}</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
          {/* Notifications */}
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-brand-400 hover:text-brand-500 touch-manipulation"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 inline-flex h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-white" />
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-96 sm:max-w-96 rounded-xl border border-slate-200 bg-white shadow-lg z-50 max-h-[80vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Notifications</div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <div className="text-sm text-slate-500">No notifications</div>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {notifications.map((notification) => {
                        const iconMap = {
                          success: CheckCircle2,
                          error: AlertCircle,
                          info: Info,
                          warning: AlertTriangle,
                        }
                        const Icon = iconMap[notification.type]
                        const iconColors = {
                          success: 'text-emerald-500',
                          error: 'text-rose-500',
                          info: 'text-blue-500',
                          warning: 'text-amber-500',
                        }

                        return (
                          <div
                            key={notification.id}
                            className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                              !notification.read ? 'bg-blue-50/50' : ''
                            }`}
                            onClick={() => {
                              if (!notification.read) {
                                markAsRead(notification.id)
                              }
                              if (notification.link) {
                                navigate(notification.link)
                                setNotificationsOpen(false)
                              }
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColors[notification.type]}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className={`text-sm font-medium ${!notification.read ? 'text-slate-900' : 'text-slate-700'}`}>
                                      {notification.title}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">{notification.message}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                      {new Date(notification.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                  {!notification.read && (
                                    <span className="inline-flex h-2 w-2 rounded-full bg-brand-500 shrink-0 mt-1" />
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeNotification(notification.id)
                                }}
                                className="shrink-0 text-slate-400 hover:text-slate-600"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Account Button - Mobile */}
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-brand-400 hover:text-brand-500 touch-manipulation md:hidden"
            aria-label="Account"
          >
            <User className="h-5 w-5" />
          </button>

          {/* Account Button - Desktop */}
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm transition hover:border-brand-400 hover:text-brand-500 md:flex min-h-[44px] touch-manipulation"
          >
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Account</span>
              <span className="font-semibold text-slate-900">{user?.email}</span>
            </div>
            <User className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}

