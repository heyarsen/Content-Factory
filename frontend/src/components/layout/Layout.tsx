import { ReactNode, useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { useAuth } from '../../contexts/AuthContext'
import { useCreditsContext } from '../../contexts/CreditContext'
import { AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../contexts/LanguageContext'

export function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()
  const { credits, unlimited, subscription, loading: creditsLoading } = useCreditsContext()
  const { t } = useLanguage()

  const hasSubscription = user && (
    user.role === 'admin' ||
    (subscription && ['active', 'pending'].includes(subscription.status))
  )
  const safeCanCreate = hasSubscription || (credits !== null && credits > 0) || unlimited
  const showBanner = user && !creditsLoading && !safeCanCreate
  return (
    <div className="relative flex min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="relative flex min-h-screen flex-1 flex-col lg:pl-72">
        <Header onToggleSidebar={() => setSidebarOpen((open) => !open)} />

        {showBanner && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 sm:px-8 lg:px-14">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
                <AlertCircle className="h-4 w-4" />
                <span>{t('credits.no_active_sub') || 'Active subscription required to access all features.'}</span>
              </div>
              <Link
                to="/credits"
                className="whitespace-nowrap rounded-lg bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700 transition-colors shadow-sm"
              >
                {t('sidebar.buy_subscription') || 'Subscribe Now'}
              </Link>
            </div>
          </div>
        )}

        <main className="relative z-0 flex-1 px-4 pb-12 pt-8 sm:px-8 lg:px-14">
          <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
