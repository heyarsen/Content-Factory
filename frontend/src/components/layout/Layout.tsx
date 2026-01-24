import { ReactNode, useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { Info } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, refreshSubscriptionStatus } = useAuth()

  // Get Project ID from URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const projectId = supabaseUrl.split('//')[1]?.split('.')[0] || 'UNKNOWN'

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

      {/* STABILITY DEBUG BOX V6 */}
      <div className="fixed bottom-4 right-4 z-50 bg-black/90 text-white p-4 rounded-lg text-[10px] font-mono max-w-xs shadow-2xl border border-brand-500/50 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-2">
          <strong className="text-brand-400">PROJECT ID: {projectId}</strong>
          <button
            onClick={() => refreshSubscriptionStatus()}
            className="bg-brand-500 px-2 py-0.5 rounded text-[8px]"
          >
            REFRESH
          </button>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Email:</span>
            <span className="truncate ml-2 text-slate-400">{user?.email || 'OFFLINE'}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>ACTIVE:</span>
            <span className={user?.hasActiveSubscription ? 'text-green-400' : 'text-red-400'}>
              {String(user?.hasActiveSubscription).toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Reason:</span>
            <span className="text-cyan-400">{user?.debugReason || 'NONE'}</span>
          </div>
          <div className="mt-2 text-[7px] text-slate-500 pt-1 border-t border-white/5">
            <div>Latest Sub Record:</div>
            <pre className="mt-1 bg-white/5 p-1 rounded max-h-20 overflow-auto text-slate-400">
              {user?.rawLatestSub ? JSON.stringify(user.rawLatestSub, null, 1) : 'ABSENT'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
