import { ReactNode, useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="relative flex min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="relative flex min-h-screen flex-1 flex-col lg:pl-72">
        <Header onToggleSidebar={() => setSidebarOpen((open) => !open)} />
        <main className="relative z-0 flex-1 px-6 pb-12 pt-8 sm:px-8 lg:px-14">
          <div className="mx-auto w-full max-w-6xl space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

