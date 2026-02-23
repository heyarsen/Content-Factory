import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import api from '../lib/api'
import { useAuth } from './AuthContext'

const NOTIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const DEFAULT_TOAST_DURATION = 5000

const getStorageKey = (userId?: string) => `notifications:${userId || 'guest'}`

const parseStoredNotifications = (value: string | null): Notification[] => {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is Notification => {
      return (
        typeof item?.id === 'string' &&
        ['success', 'error', 'info', 'warning'].includes(item?.type) &&
        typeof item?.title === 'string' &&
        typeof item?.message === 'string' &&
        typeof item?.read === 'boolean' &&
        typeof item?.createdAt === 'number'
      )
    })
  } catch {
    return []
  }
}

const pruneExpiredNotifications = (items: Notification[], now = Date.now()) => {
  const cutoff = now - NOTIFICATION_RETENTION_MS
  return items.filter((notification) => notification.createdAt >= cutoff)
}

export interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
  duration?: number
  read: boolean
  link?: string
  createdAt: number
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void
  removeNotification: (id: string) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  unreadCount: number
  unreadSupportCount: number
  refreshSupportCount: () => Promise<void>
  markAllSupportAsRead: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [toastQueue, setToastQueue] = useState<Notification[]>([])
  const [unreadSupportCount, setUnreadSupportCount] = useState(0)
  const { user } = useAuth()

  const unreadCount = notifications.filter(n => !n.read).length

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
    const id = Math.random().toString(36).substring(7)
    const newNotification: Notification = {
      ...notification,
      id,
      read: false,
      createdAt: Date.now()
    }
    setNotifications((prev) => [newNotification, ...prev]) // Add to top

    if (notification.duration !== 0) {
      setToastQueue((prev) => [newNotification, ...prev])
      setTimeout(() => {
        setToastQueue((prev) => prev.filter((toast) => toast.id !== id))
      }, notification.duration || DEFAULT_TOAST_DURATION)
    }

    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.svg',
      })
    }
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    setToastQueue((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const key = getStorageKey(user?.id)
    const storedNotifications = parseStoredNotifications(localStorage.getItem(key))
    const activeNotifications = pruneExpiredNotifications(storedNotifications)

    setNotifications(activeNotifications)
    setToastQueue([])

    if (activeNotifications.length !== storedNotifications.length) {
      localStorage.setItem(key, JSON.stringify(activeNotifications))
    }
  }, [user?.id])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const key = getStorageKey(user?.id)
    const activeNotifications = pruneExpiredNotifications(notifications)

    if (activeNotifications.length !== notifications.length) {
      setNotifications(activeNotifications)
      return
    }

    localStorage.setItem(key, JSON.stringify(activeNotifications))
  }, [notifications, user?.id])

  const refreshSupportCount = async () => {
    if (!user) return

    try {
      let query = supabase
        .from('support_messages')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)

      if (user.role === 'admin') {
        // Admins see unread messages FROM users
        query = query.eq('is_admin_reply', false)
      } else {
        // Users see unread messages FROM admins
        query = query.eq('is_admin_reply', true)
      }

      const { count, error } = await query

      if (!error && count !== null) {
        setUnreadSupportCount(count)
      }
    } catch (err) {
      console.warn('Failed to fetch unread support count', err)
    }
  }

  const markAllSupportAsRead = async () => {
    if (!user) return

    try {
      const endpoint = user.role === 'admin' ? '/api/admin/tickets/mark-all-read' : '/api/support/tickets/mark-all-read'
      await api.post(endpoint)
      setUnreadSupportCount(0)
    } catch (err) {
      console.warn('Failed to mark all support messages as read', err)
    }
  }

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(console.error)
    }
  }, [])

  // We need current location to decide whether to show toast
  // Since we are inside Router, we can use window.location or useLocation if available
  // But useLocation needs to be imported. 
  // For simplicity and safety inside a context that might be used differently, 
  // checking window.location.pathname is essentially safe enough for this purpose
  // or we can just rely on the fact that if they are looking at the chat, they see it.

  useEffect(() => {
    if (!user) {
      setUnreadSupportCount(0)
      return
    }

    refreshSupportCount()

    // Real-time subscription
    const channelName = `support_notifications_${user.id}`
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes
          schema: 'public',
          table: 'support_messages',
        },
        (payload: any) => {
          // Always refresh count
          refreshSupportCount()

          // If it's a new message from someone else (admin)
          if (payload.eventType === 'INSERT' && payload.new) {
            const newMessage = payload.new as any
            if (newMessage.sender_id !== user.id) {
              // Check if we are NOT on the support page
              if (!window.location.pathname.includes('/support')) {
                addNotification({
                  type: 'info',
                  title: 'New Support Message',
                  message: newMessage.message ? (newMessage.message.length > 50 ? newMessage.message.substring(0, 50) + '...' : newMessage.message) : 'You have a new reply.',
                  duration: 5000,
                  link: '/support'
                })
              }
            }
          }
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') console.log(`Notification Subscription status: ${status}`)
      })

    return () => {
      subscription.unsubscribe()
    }
  }, [user?.id, addNotification])

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      markAsRead,
      markAllAsRead,
      unreadCount,
      unreadSupportCount,
      refreshSupportCount,
      markAllSupportAsRead
    }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toastQueue.slice(0, 5).map((notification) => (
          <NotificationToast key={notification.id} {...notification} onClose={() => setToastQueue((prev) => prev.filter((toast) => toast.id !== notification.id))} />
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

function NotificationToast({ type, title, message, onClose }: Notification & { onClose: () => void }) {
  const bgColors = {
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  }

  return (
    <div className={`pointer-events-auto flex w-80 items-start justify-between rounded-lg border p-4 shadow-lg transition-all ${bgColors[type]}`}>
      <div>
        <h4 className="font-semibold">{title}</h4>
        <p className="mt-1 text-sm opacity-90">{message}</p>
      </div>
      <button onClick={onClose} className="ml-4 text-current opacity-50 hover:opacity-100">
        ×
      </button>
    </div>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
