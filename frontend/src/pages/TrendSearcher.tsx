import { Send, Search, TrendingUp, FileText, Zap, Target, BarChart2, CheckCircle, ArrowRight } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useLanguage } from '../contexts/LanguageContext'

const TELEGRAM_BOT_URL = import.meta.env.VITE_TRENDSEARCHER_TELEGRAM_URL?.trim() || 'https://t.me/TrendWatcher_SMM_bot'
const hasTelegramUrl = /^https?:\/\//i.test(TELEGRAM_BOT_URL)

const features = [
  {
    icon: Search,
    titleKey: 'trend_searcher.feature_search_title',
    titleFallback: 'Viral Video Search',
    descKey: 'trend_searcher.feature_search_desc',
    descFallback: 'Find the most viral YouTube Shorts on any topic. The bot analyzes videos with 1M+ views published in the last 30 days.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: BarChart2,
    titleKey: 'trend_searcher.feature_analysis_title',
    titleFallback: 'Deep Virality Analysis',
    descKey: 'trend_searcher.feature_analysis_desc',
    descFallback: 'AI breaks down why each video went viral — hook structure, emotional triggers, editing pace, and audience psychology.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: FileText,
    titleKey: 'trend_searcher.feature_script_title',
    titleFallback: 'AI Script Generation',
    descKey: 'trend_searcher.feature_script_desc',
    descFallback: 'Generate a full production-ready script inspired by viral content — with visual cues, sound recommendations, and pacing notes.',
    color: 'bg-green-50 text-green-600',
  },
  {
    icon: TrendingUp,
    titleKey: 'trend_searcher.feature_trends_title',
    titleFallback: 'Real-Time Trends',
    descKey: 'trend_searcher.feature_trends_desc',
    descFallback: 'Stay ahead of the curve. Search any niche — fitness, finance, tech, beauty — and get fresh viral content every time.',
    color: 'bg-orange-50 text-orange-600',
  },
]

const benefits = [
  { key: 'trend_searcher.benefit_1', fallback: 'Save hours of manual research every week' },
  { key: 'trend_searcher.benefit_2', fallback: 'Never run out of content ideas' },
  { key: 'trend_searcher.benefit_3', fallback: 'Understand what makes content go viral in your niche' },
  { key: 'trend_searcher.benefit_4', fallback: 'Get production-ready scripts, not just ideas' },
  { key: 'trend_searcher.benefit_5', fallback: 'Works for any language and any niche' },
  { key: 'trend_searcher.benefit_6', fallback: '10 free script generations to get started' },
]

const steps = [
  {
    number: '01',
    titleKey: 'trend_searcher.step1_title',
    titleFallback: 'Open the Bot',
    descKey: 'trend_searcher.step1_desc',
    descFallback: 'Click the button below to open TrendWatcher in Telegram. No registration required — just press Start.',
  },
  {
    number: '02',
    titleKey: 'trend_searcher.step2_title',
    titleFallback: 'Enter Your Topic',
    descKey: 'trend_searcher.step2_desc',
    descFallback: 'Type any topic or niche — "fitness motivation", "crypto news", "cooking hacks". The bot searches YouTube instantly.',
  },
  {
    number: '03',
    titleKey: 'trend_searcher.step3_title',
    titleFallback: 'Pick a Viral Video',
    descKey: 'trend_searcher.step3_desc',
    descFallback: 'Browse the list of viral videos with view counts and engagement stats. Select any video to see the full AI analysis.',
  },
  {
    number: '04',
    titleKey: 'trend_searcher.step4_title',
    titleFallback: 'Generate Your Script',
    descKey: 'trend_searcher.step4_desc',
    descFallback: 'Hit "Create Script" and get a complete, production-ready script with visual directions and audio cues in seconds.',
  },
]

export function TrendSearcher() {
  const { t } = useLanguage()

  const handleOpenTelegram = () => {
    if (!hasTelegramUrl) return
    window.open(TELEGRAM_BOT_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">

        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-500 p-8 text-white shadow-2xl md:p-12">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
                <Zap className="h-4 w-4" />
                <span>{t('trend_searcher.badge') || 'AI-Powered Trend Intelligence'}</span>
              </div>
              <h1 className="text-3xl font-bold leading-tight md:text-4xl">
                TrendWatcher
              </h1>
              <p className="max-w-lg text-base text-white/85 md:text-lg">
                {t('trend_searcher.hero_desc') || 'Find viral YouTube Shorts, understand why they work, and generate ready-to-film scripts — all in Telegram.'}
              </p>
            </div>
            <div className="flex-shrink-0">
              <Button
                onClick={handleOpenTelegram}
                disabled={!hasTelegramUrl}
                className="flex items-center gap-2 bg-slate-900 !text-white hover:bg-slate-800 shadow-lg px-6 py-3 text-base font-semibold"
              >
                <Send className="h-5 w-5" />
                {t('trend_searcher.open_telegram') || 'Open in Telegram'}
              </Button>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div>
          <h2 className="mb-6 text-xl font-bold text-slate-800">
            {t('trend_searcher.features_title') || 'What TrendWatcher Can Do'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map(({ icon: Icon, titleKey, titleFallback, descKey, descFallback, color }) => (
              <Card key={titleKey} className="flex gap-4 p-5">
                <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{t(titleKey) || titleFallback}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t(descKey) || descFallback}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div>
          <h2 className="mb-6 text-xl font-bold text-slate-800">
            {t('trend_searcher.how_it_works_title') || 'How It Works'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {steps.map(({ number, titleKey, titleFallback, descKey, descFallback }) => (
              <Card key={number} className="relative overflow-hidden p-5">
                <div className="absolute right-4 top-3 text-5xl font-black text-slate-100 select-none">
                  {number}
                </div>
                <div className="relative space-y-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600 text-sm font-bold">
                    {number}
                  </div>
                  <h3 className="font-semibold text-slate-800">{t(titleKey) || titleFallback}</h3>
                  <p className="text-sm text-slate-500">{t(descKey) || descFallback}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600">
              <Target className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">
              {t('trend_searcher.benefits_title') || 'Why Use TrendWatcher'}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {benefits.map(({ key, fallback }) => (
              <div key={key} className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                <span className="text-sm text-slate-600">{t(key) || fallback}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* CTA */}
        <Card className="flex flex-col items-center gap-5 p-8 text-center bg-gradient-to-br from-slate-50 to-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
            <Send className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-800">
              {t('trend_searcher.cta_title') || 'Ready to Find Your Next Viral Idea?'}
            </h2>
            <p className="text-slate-500 max-w-sm mx-auto">
              {t('trend_searcher.cta_desc') || 'Start with 10 free script generations. No credit card required.'}
            </p>
          </div>
          <Button
            onClick={handleOpenTelegram}
            disabled={!hasTelegramUrl}
            className="flex items-center gap-2 px-8 py-3 text-base font-semibold"
          >
            {t('trend_searcher.open_telegram') || 'Open TrendWatcher in Telegram'}
            <ArrowRight className="h-5 w-5" />
          </Button>
          {!hasTelegramUrl && (
            <p className="text-sm text-slate-400">{t('trend_searcher.link_coming_soon') || 'Telegram link will be available soon.'}</p>
          )}
        </Card>

      </div>
    </Layout>
  )
}
