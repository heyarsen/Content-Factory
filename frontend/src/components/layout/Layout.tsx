```javascript
import { ReactNode, useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import {
  Settings,
  LogOut,
  Menu,
  X,
  CreditCard,
  User,
  Info // Use Info instead of Bug to be safe
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, refreshSubscriptionStatus } = useAuth() // Added refreshSubscriptionStatus

  return (
    <div className="relative flex min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="relative flex min-h-screen flex-1 flex-col lg:pl-72">
        <Header onToggleSidebar={() => setSidebarOpen((open) => !open)} />
        <main className="relative z-0 flex-1 px-4 pb-12 pt-8 sm:px-8 lg:px-14">
          <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-8">
            {children}
          </div>
        </main>
      </div>

      {/* DEBUG OVERLAY - TEMPORARY */}
      <div className="fixed bottom-4 right-4 z-50 bg-black/80 text-white p-4 rounded-lg text-xs font-mono max-w-sm overflow-auto shadow-2xl border border-white/20">
        <div className="flex items-center justify-between mb-2">
          <strong className="flex items-center gap-2"><Info size={14}/> DEBUG INFO</strong>
          <button
            onClick={async () => {
              const res = await refreshSubscriptionStatus()
              alert(`Refreshed!\nActive: ${ res.hasActiveSubscription } \nRole: ${ res.role } `)
            }}
            className="bg-brand-500 hover:bg-brand-600 px-2 py-1 rounded text-[10px] uppercase font-bold"
          >
            Force Refresh
          </button>
        </div>
        <div className="space-y-1">
          <div>ID: {user?.id?.slice(0, 8)}...</div>
          <div>Email: {user?.email}</div>
          <div className={user?.hasActiveSubscription ? 'text-green-400' : 'text-red-400'}>
            Subscription: {String(user?.hasActiveSubscription)}
          </div>
          <div>Role: {user?.role}</div>
        </div>
      </div>
    </div>
  )
}
