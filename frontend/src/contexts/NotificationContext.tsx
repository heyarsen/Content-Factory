import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
  duration?: number
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
  unreadSupportCount: number
  refreshSupportCount: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadSupportCount, setUnreadSupportCount] = useState(0)
  const { user } = useAuth()

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substring(7)
    const newNotification = { ...notification, id }
    setNotifications((prev) => [...prev, newNotification])

    if (notification.duration !== 0) {
      setTimeout(() => {
        removeNotification(id)
      }, notification.duration || 5000)
    }

    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
      })
    }
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const refreshSupportCount = async () => {
    if (!user) return

    try {
      const { count, error } = await supabase
        .from('support_messages')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
        .neq('sender_id', user.id) // Messages NOT sent by me

      if (!error && count !== null) {
        setUnreadSupportCount(count)
      }
    } catch (err) {
      console.warn('Failed to fetch unread support count', err)
    }
  }

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(console.error)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setUnreadSupportCount(0)
      return
    }

    refreshSupportCount()

    // Real-time subscription
    const subscription = supabase
      .channel('public:support_messages')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT for new, UPDATE for read status)
          schema: 'public',
          table: 'support_messages',
        },
        () => {
          refreshSupportCount()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user?.id])

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, unreadSupportCount, refreshSupportCount }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {notifications.map((notification) => (
          <NotificationToast key={notification.id} {...notification} onClose={() => removeNotification(notification.id)} />
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
    <div className={`flex w-80 items-start justify-between rounded-lg border p-4 shadow-lg transition-all ${bgColors[type]}`}>
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
