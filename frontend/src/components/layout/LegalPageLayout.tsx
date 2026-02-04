import { ReactNode } from 'react'
import { LegalFooter } from './LegalFooter'

interface LegalPageLayoutProps {
  title: string
  children: ReactNode
}

export function LegalPageLayout({ title, children }: LegalPageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{title}</h1>
          <div className="mt-8">{children}</div>
        </div>
      </main>
      <LegalFooter className="bg-slate-50" />
    </div>
  )
}
