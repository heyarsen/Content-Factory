import { Send, CheckCircle, ArrowRight, Zap } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useLanguage } from '../contexts/LanguageContext'

const TELEGRAM_BOT_URL = 'https://t.me/Aismmagentbot'

const features = [
  {
    emoji: '🎬',
    titleKey: 'ai_smm_agent.f1_title',
    titleFallback: 'AI Video Generation',
    descKey: 'ai_smm_agent.f1_body',
    descFallback: 'Create stunning videos with Sora 2 and Veo 3.1. From script to finished video in minutes, in 83 languages.',
    tagKey: 'ai_smm_agent.f1_tag',
    tagFallback: 'from 50 credits',
    highlight: true,
  },
  {
    emoji: '📸',
    titleKey: 'ai_smm_agent.f2_title',
    titleFallback: 'AI Photo Generation',
    descKey: 'ai_smm_agent.f2_body',
    descFallback: 'Professional images with Nana Banana Pro and Nana Banana 2. Photorealistic quality for any social media.',
    tagKey: 'ai_smm_agent.f2_tag',
    tagFallback: 'from 10 credits',
    highlight: false,
  },
  {
    emoji: '📤',
    titleKey: 'ai_smm_agent.f3_title',
    titleFallback: 'Auto-Posting',
    descKey: 'ai_smm_agent.f3_body',
    descFallback: 'Publish to Instagram, TikTok, YouTube, Facebook, X, LinkedIn, Threads, and Pinterest with one click.',
    tagKey: 'ai_smm_agent.f3_tag',
    tagFallback: '10 credits / platform',
    highlight: false,
  },
  {
    emoji: '📊',
    titleKey: 'ai_smm_agent.f4_title',
    titleFallback: 'Deep Analytics',
    descKey: 'ai_smm_agent.f4_body',
    descFallback: 'Analyze any Instagram, TikTok, or YouTube account. Get engagement rates, best posts, and AI recommendations.',
    tagKey: 'ai_smm_agent.f4_tag',
    tagFallback: '50 credits',
    highlight: false,
  },
  {
    emoji: '👀',
    titleKey: 'ai_smm_agent.f5_title',
    titleFallback: 'Competitor Monitoring',
    descKey: 'ai_smm_agent.f5_body',
    descFallback: 'Track competitors 24/7. Compare metrics, find their strengths, and discover growth opportunities.',
    tagKey: 'ai_smm_agent.f5_tag',
    tagFallback: '50 credits',
    highlight: false,
  },
  {
    emoji: '🤖',
    titleKey: 'ai_smm_agent.f6_title',
    titleFallback: 'SMM Strategist',
    descKey: 'ai_smm_agent.f6_body',
    descFallback: 'Your personal AI consultant. Get tailored strategies, content ideas, and growth plans for your brand.',
    tagKey: 'ai_smm_agent.f6_tag',
    tagFallback: '1 credit / request',
    highlight: false,
  },
  {
    emoji: '✍️',
    titleKey: 'ai_smm_agent.f7_title',
    titleFallback: 'AI Copywriter',
    descKey: 'ai_smm_agent.f7_body',
    descFallback: 'Professional captions for posts, Reels scripts, Stories text, threads, and carousels. Ready to publish.',
    tagKey: 'ai_smm_agent.f7_tag',
    tagFallback: '20 credits',
    highlight: false,
  },
  {
    emoji: '🔥',
    titleKey: 'ai_smm_agent.f8_title',
    titleFallback: 'Trend Analysis',
    descKey: 'ai_smm_agent.f8_body',
    descFallback: 'Find viral videos in your niche. Get analysis of why they went viral and AI-generated scripts based on trends.',
    tagKey: 'ai_smm_agent.f8_tag',
    tagFallback: 'included',
    highlight: false,
  },
]

const steps = [
  {
    number: '1',
    titleKey: 'ai_smm_agent.step1_title',
    titleFallback: 'Open the bot',
    descKey: 'ai_smm_agent.step1_body',
    descFallback: 'Click the button below and press Start in Telegram. You will receive 100 free credits as a welcome bonus.',
  },
  {
    number: '2',
    titleKey: 'ai_smm_agent.step2_title',
    titleFallback: 'Choose a feature',
    descKey: 'ai_smm_agent.step2_body',
    descFallback: 'Generate content, analyze accounts, write captions, or connect your social media for auto-posting.',
  },
  {
    number: '3',
    titleKey: 'ai_smm_agent.step3_title',
    titleFallback: 'Publish and grow',
    descKey: 'ai_smm_agent.step3_body',
    descFallback: 'AI handles the heavy lifting. You focus on your business while your social media grows on autopilot.',
  },
]

const reportItems = [
  { key: 'ai_smm_agent.report_item1', fallback: 'Follower growth and engagement trends' },
  { key: 'ai_smm_agent.report_item2', fallback: 'Best and worst performing content' },
  { key: 'ai_smm_agent.report_item3', fallback: 'Competitor comparison charts' },
  { key: 'ai_smm_agent.report_item4', fallback: 'AI-generated recommendations' },
]

const pricingRows = [
  { key: 'ai_smm_agent.price_r1', fallback: 'Account Analytics', cost: '50' },
  { key: 'ai_smm_agent.price_r2', fallback: 'PDF Report', cost: '+100' },
  { key: 'ai_smm_agent.price_r3', fallback: 'Photo (Nana Banana Pro)', cost: '20' },
  { key: 'ai_smm_agent.price_r4', fallback: 'Photo (Nana Banana 2)', cost: '10' },
  { key: 'ai_smm_agent.price_r5', fallback: 'Video (Sora 2)', cost: '50' },
  { key: 'ai_smm_agent.price_r6', fallback: 'Video (Veo 3.1)', cost: '60' },
  { key: 'ai_smm_agent.price_r7', fallback: 'Auto-Post (per platform)', cost: '10' },
  { key: 'ai_smm_agent.price_r8', fallback: 'AI Copywriter', cost: '20' },
  { key: 'ai_smm_agent.price_r9', fallback: 'SMM Strategist', cost: '1' },
  { key: 'ai_smm_agent.price_r10', fallback: 'Competitor Monitoring', cost: '50' },
]

const creditPacks = [
  { credits: '100', price: '$1', popular: false },
  { credits: '600', price: '$5', popular: true },
  { credits: '1300', price: '$10', popular: false },
]

const platforms = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'X (Twitter)', 'LinkedIn', 'Threads', 'Pinterest']

export default function AiSmmAgentPage() {
  const { t } = useLanguage()

  const handleOpenTelegram = () => {
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
                <span>{t('ai_smm_agent.badge') || 'Telegram Bot'}</span>
              </div>
              <h1 className="text-3xl font-bold leading-tight md:text-4xl">
                {t('ai_smm_agent.hero_title') || 'Your personal AI team for social media'}
              </h1>
              <p className="max-w-lg text-base text-white/85 md:text-lg">
                {t('ai_smm_agent.hero_sub') || 'Generate photos and videos, write captions, analyze competitors, and auto-post to 8 platforms. All from one Telegram bot.'}
              </p>
              <div className="flex flex-wrap gap-6 pt-2">
                <div className="text-center">
                  <div className="text-2xl font-black">8</div>
                  <div className="text-xs text-white/70">{t('ai_smm_agent.stat_platforms') || 'platforms'}</div>
                </div>
                <div className="w-px bg-white/20" />
                <div className="text-center">
                  <div className="text-2xl font-black">83</div>
                  <div className="text-xs text-white/70">{t('ai_smm_agent.stat_languages') || 'languages'}</div>
                </div>
                <div className="w-px bg-white/20" />
                <div className="text-center">
                  <div className="text-2xl font-black">24/7</div>
                  <div className="text-xs text-white/70">{t('ai_smm_agent.stat_monitoring') || 'monitoring'}</div>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0">
              <Button
                onClick={handleOpenTelegram}
                className="flex items-center gap-2 bg-slate-900 !text-white hover:bg-slate-800 shadow-lg px-6 py-3 text-base font-semibold"
              >
                <Send className="h-5 w-5" />
                {t('ai_smm_agent.cta_start') || 'Open in Telegram'}
              </Button>
            </div>
          </div>
        </div>

        {/* Platforms Bar */}
        <Card className="p-5">
          <p className="mb-4 text-center text-sm font-semibold text-slate-500 uppercase tracking-wider">
            {t('ai_smm_agent.platforms_label') || 'Auto-post to all major platforms'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {platforms.map((platform) => (
              <span
                key={platform}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-medium text-slate-600"
              >
                {platform}
              </span>
            ))}
          </div>
        </Card>

        {/* Features Grid */}
        <div>
          <h2 className="mb-2 text-xl font-bold text-slate-800">
            {t('ai_smm_agent.features_title') || 'Everything you need in one bot'}
          </h2>
          <p className="mb-6 text-sm text-slate-500">
            {t('ai_smm_agent.features_sub') || 'Powerful AI tools that replace an entire SMM team.'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map(({ emoji, titleKey, titleFallback, descKey, descFallback, tagKey, tagFallback, highlight }) => (
              <Card
                key={titleKey}
                className={`flex flex-col gap-3 p-5 ${highlight ? 'border-brand-200 bg-gradient-to-br from-brand-50/60 to-white' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{emoji}</span>
                    <h3 className="font-semibold text-slate-800">{t(titleKey) || titleFallback}</h3>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
                    {t(tagKey) || tagFallback}
                  </span>
                </div>
                <p className="text-sm text-slate-500">{t(descKey) || descFallback}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div>
          <h2 className="mb-2 text-xl font-bold text-slate-800">
            {t('ai_smm_agent.steps_title') || 'Start in 3 simple steps'}
          </h2>
          <p className="mb-6 text-sm text-slate-500">
            {t('ai_smm_agent.steps_sub') || 'No registration. No downloads. Just Telegram.'}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
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

        {/* PDF Reports */}
        <Card className="p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="flex-1 space-y-4">
              <h2 className="text-xl font-bold text-slate-800">
                {t('ai_smm_agent.reports_title') || 'Professional PDF Reports'}
              </h2>
              <p className="text-sm text-slate-500">
                {t('ai_smm_agent.reports_body') || 'Get detailed analytics reports with charts, engagement metrics, best and worst posts analysis, and AI-powered recommendations.'}
              </p>
              <ul className="space-y-2">
                {reportItems.map(({ key, fallback }) => (
                  <li key={key} className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                    <span className="text-sm text-slate-600">{t(key) || fallback}</span>
                  </li>
                ))}
              </ul>
              <Button onClick={handleOpenTelegram} className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                {t('ai_smm_agent.reports_cta') || 'Get your report'}
              </Button>
            </div>
            <div className="flex-shrink-0 w-full md:w-56">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-600">AI SMM</span>
                  <span className="text-xs text-slate-400">{t('ai_smm_agent.report_mock_title') || 'Analytics Report'}</span>
                </div>
                <div className="mb-3 flex items-end gap-1 h-16">
                  {[40, 65, 85, 55, 70, 90].map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-t-sm ${i === 2 || i === 5 ? 'bg-brand-500' : 'bg-slate-200'}`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div>
                    <div className="text-sm font-bold text-slate-800">4.2%</div>
                    <div className="text-[10px] text-slate-400">ER</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">12.5K</div>
                    <div className="text-[10px] text-slate-400">{t('ai_smm_agent.report_followers') || 'Followers'}</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-green-600">+23%</div>
                    <div className="text-[10px] text-slate-400">{t('ai_smm_agent.report_growth') || 'Growth'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Pricing */}
        <div>
          <h2 className="mb-2 text-xl font-bold text-slate-800">
            {t('ai_smm_agent.pricing_title') || 'Simple credit-based pricing'}
          </h2>
          <p className="mb-6 text-sm text-slate-500">
            {t('ai_smm_agent.pricing_sub') || 'Pay only for what you use. No hidden fees. Start with 100 free credits.'}
          </p>
          <Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 text-left font-semibold text-slate-600">
                    {t('ai_smm_agent.price_col_feature') || 'Feature'}
                  </th>
                  <th className="px-5 py-3 text-right font-semibold text-slate-600">
                    {t('ai_smm_agent.price_col_cost') || 'Credits'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pricingRows.map(({ key, fallback, cost }, i) => (
                  <tr key={key} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-5 py-2.5 text-slate-700">{t(key) || fallback}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-brand-600">{cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {creditPacks.map(({ credits, price, popular }) => (
              <Card
                key={credits}
                className={`relative flex flex-col items-center gap-1 p-4 text-center ${popular ? 'border-brand-300 bg-gradient-to-br from-brand-50 to-white' : ''}`}
              >
                {popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-0.5 text-[10px] font-bold text-white">
                    {t('ai_smm_agent.pack_popular') || 'Popular'}
                  </span>
                )}
                <div className="text-2xl font-black text-slate-800">{credits}</div>
                <div className="text-xs text-slate-500">{t('ai_smm_agent.pack_credits') || 'credits'}</div>
                <div className="text-lg font-bold text-brand-600">{price}</div>
              </Card>
            ))}
          </div>
        </div>

        {/* Referral */}
        <Card className="flex flex-col items-center gap-4 p-8 text-center bg-gradient-to-br from-amber-50 to-white border-amber-200">
          <span className="text-4xl">🎁</span>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-800">
              {t('ai_smm_agent.referral_title') || 'Invite friends, earn credits'}
            </h2>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {t('ai_smm_agent.referral_body') || 'Share your referral link and get 300 credits for each friend who joins. Your friend gets 100 bonus credits too.'}
            </p>
          </div>
          <Button onClick={handleOpenTelegram} variant="secondary" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            {t('ai_smm_agent.referral_cta') || 'Get your referral link'}
          </Button>
        </Card>

        {/* Final CTA */}
        <Card className="flex flex-col items-center gap-5 p-8 text-center bg-gradient-to-br from-slate-50 to-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
            <Send className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-800">
              {t('ai_smm_agent.final_title') || 'Ready to automate your social media?'}
            </h2>
            <p className="text-slate-500 max-w-sm mx-auto">
              {t('ai_smm_agent.final_sub') || 'Start for free with 100 credits. No credit card required.'}
            </p>
          </div>
          <Button
            onClick={handleOpenTelegram}
            className="flex items-center gap-2 px-8 py-3 text-base font-semibold"
          >
            {t('ai_smm_agent.final_cta') || 'Launch AI SMM Agent'}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Card>

      </div>
    </Layout>
  )
}
