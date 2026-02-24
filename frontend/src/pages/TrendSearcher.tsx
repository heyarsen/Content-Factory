import { Send } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useLanguage } from '../contexts/LanguageContext'

const trendSearcherTelegramUrl = import.meta.env.VITE_TRENDSEARCHER_TELEGRAM_URL?.trim() || ''
const hasTelegramUrl = /^https?:\/\//i.test(trendSearcherTelegramUrl)

export function TrendSearcher() {
  const { t } = useLanguage()
  const handleOpenTelegram = () => {
    if (!hasTelegramUrl) {
      return
    }

    window.open(trendSearcherTelegramUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <Layout>
      <div className="flex h-[60vh] flex-col items-center justify-center">
        <Card className="flex w-full max-w-md flex-col items-center gap-6 p-8 text-center shadow-xl">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Send className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-800">{t('trend_searcher.available_on_telegram')}</h1>
            {!hasTelegramUrl && (
              <p className="text-sm text-slate-500">{t('trend_searcher.link_coming_soon')}</p>
            )}
          </div>
          <Button onClick={handleOpenTelegram} disabled={!hasTelegramUrl} className="w-full sm:w-auto">
            {t('trend_searcher.open_telegram')}
          </Button>
        </Card>
      </div>
    </Layout>
  )
}
