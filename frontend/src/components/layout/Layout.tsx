import { ReactNode, useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { Info } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, refreshSubscriptionStatus } = useAuth()

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

      {/* NUCLEAR DEBUG OVERLAY - VERSION 3 */}
      <div className="fixed bottom-4 right-4 z-50 bg-black/90 text-white p-4 rounded-lg text-[10px] font-mono max-w-xs overflow-auto shadow-2xl border border-brand-500/50 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-2">
          <strong className="flex items-center gap-2 text-brand-400"><Info size={12} /> DB DEBUG V3</strong>
          <button
            onClick={async () => {
              const res = await refreshSubscriptionStatus()
              alert(`REFRESHED!\nActive: ${res.hasActiveSubscription}\nReason: ${res.debugReason}`)
            }}
            className="bg-brand-500 hover:bg-brand-600 px-2 py-0.5 rounded uppercase font-bold text-[9px]"
          >
            REFRESH
          </button>
        </div>
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between">
            <span>Email:</span>
            <span className="text-slate-300 truncate ml-1">{user?.email}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>ACTIVE:</span>
            <span className={user?.hasActiveSubscription ? 'text-green-400' : 'text-red-400'}>
              {String(user?.hasActiveSubscription).toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Reason:</span>
            <span className="text-cyan-400">{user?.debugReason || 'EMPTY'}</span>
          </div>
          <div className="mt-2 text-[8px] text-slate-500 border-t border-white/5 pt-2">
            <div>Latest Sub:</div>
            <pre className="mt-1 bg-white/5 p-1 rounded max-h-20 overflow-y-auto text-[7px] text-slate-400">
              {user?.rawLatestSub ? JSON.stringify(user.rawLatestSub, null, 2) : 'NONE'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
