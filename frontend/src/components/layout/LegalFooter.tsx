import { Link } from 'react-router-dom'
import { useLanguage } from '../../contexts/LanguageContext'

interface LegalFooterProps {
  className?: string
}

export function LegalFooter({ className }: LegalFooterProps) {
  const { t } = useLanguage()

  return (
    <footer
      className={`border-t border-slate-200 bg-white/80 py-6 text-sm text-slate-500${className ? ` ${className}` : ''}`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-8 lg:px-14">
        <span>© {new Date().getFullYear()} AI SMM</span>
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/public-offer" className="text-slate-500 transition hover:text-slate-900">
            {t('legal.links.public_offer')}
          </Link>
          <Link to="/privacy-policy" className="text-slate-500 transition hover:text-slate-900">
            {t('legal.links.privacy_policy')}
          </Link>
        </div>
      </div>
    </footer>
  )
}
