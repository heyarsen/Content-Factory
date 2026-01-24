import { ReactNode, useState, useEffect } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { useAuth } from '../../contexts/AuthContext'

export function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, refreshSubscriptionStatus } = useAuth()
  const [backendProjectId, setBackendProjectId] = useState<string>('WAITING...')

  // Get Local Project ID
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const localProjectId = supabaseUrl.split('//')[1]?.split('.')[0] || 'UNKNOWN'

  // Listen for custom 401 detail events from api.ts
  useEffect(() => {
    const handle401Detail = (e: any) => {
      if (e.detail?.projectId) setBackendProjectId(e.detail.projectId)
    }
    window.addEventListener('api-401-detail', handle401Detail)
    return () => window.removeEventListener('api-401-detail', handle401Detail)
  }, [])

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

      {/* PROJECT SYNC DEBUG BOX V7 */}
      <div className="fixed bottom-4 right-4 z-50 bg-black/95 text-white p-4 rounded-xl text-[10px] font-mono max-w-xs shadow-2xl border-2 border-brand-500/50 backdrop-blur-xl">
        <div className="mb-3 border-b border-white/10 pb-2">
          <div className="flex justify-between items-center text-brand-400 font-bold mb-1">
            <span>LOCAL ID:</span>
            <span>{localProjectId}</span>
          </div>
          <div className="flex justify-between items-center font-bold">
            <span className={backendProjectId !== localProjectId && backendProjectId !== 'WAITING...' ? 'text-red-500' : 'text-green-400'}>
              BACKEND ID:
            </span>
            <span>{backendProjectId}</span>
          </div>
          {backendProjectId !== localProjectId && backendProjectId !== 'WAITING...' && (
            <div className="text-[8px] text-red-500 animate-pulse mt-1">⚠️ PROJECT MISMATCH DETECTED!</div>
          )}
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
          <button
            onClick={() => refreshSubscriptionStatus()}
            className="w-full mt-2 bg-brand-600 hover:bg-brand-500 py-1 rounded text-[8px] font-bold transition-colors"
          >
            FORCE SYNC REFRESH
          </button>
        </div>
      </div>
    </div>
  )
}
