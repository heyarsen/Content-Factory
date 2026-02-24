import { Sparkles, Wand2, Clock3 } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { useLanguage } from '../../contexts/LanguageContext'

function PlaceholderAvatar({ palette, accent, label }: { palette: string; accent: string; label: string }) {
  return (
    <div className={`relative h-40 overflow-hidden rounded-2xl bg-gradient-to-br ${palette}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,rgba(255,255,255,0.34),transparent_52%)]" />
      <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/20" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="mx-auto h-16 w-16 rounded-full border-2 border-white/45 bg-white/25" />
        <div className={`mt-3 text-center text-xs font-medium uppercase tracking-[0.2em] ${accent}`}>
          {label}
        </div>
      </div>
    </div>
  )
}

export function AvatarsPreview() {
  const { t } = useLanguage()
  const avatarCards = [
    {
      name: t('avatars.cards.nova.name'),
      tone: t('avatars.cards.nova.tone'),
      palette: 'from-violet-400 via-indigo-500 to-blue-500',
      accent: 'text-violet-100',
      status: t('avatars.cards.nova.status'),
    },
    {
      name: t('avatars.cards.atlas.name'),
      tone: t('avatars.cards.atlas.tone'),
      palette: 'from-emerald-400 via-teal-500 to-cyan-500',
      accent: 'text-emerald-100',
      status: t('avatars.cards.atlas.status'),
    },
    {
      name: t('avatars.cards.lyra.name'),
      tone: t('avatars.cards.lyra.tone'),
      palette: 'from-amber-400 via-orange-500 to-rose-500',
      accent: 'text-orange-100',
      status: t('avatars.cards.lyra.status'),
    },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <Card className="border-brand-100/70 bg-gradient-to-br from-white via-white to-brand-50/60 p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
              <Sparkles className="h-3.5 w-3.5" />
              {t('avatars.studio_preview')}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">{t('avatars.preview_title')}</h1>
            <p className="max-w-2xl text-sm text-slate-600 sm:text-base">{t('avatars.preview_library_desc')}</p>
          </div>

          <Button
            disabled
            variant="secondary"
            className="w-full border-slate-200/80 bg-slate-100 text-slate-400 shadow-none hover:border-slate-200 hover:bg-slate-100 hover:text-slate-400 sm:w-auto"
          >
            {t('common.coming_soon')}
          </Button>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {avatarCards.map((avatar) => (
          <Card key={avatar.name} className="space-y-4 p-4 sm:p-5">
            <PlaceholderAvatar palette={avatar.palette} accent={avatar.accent} label={t('avatars.preview_mockup')} />
            <div>
              <h2 className="text-lg font-semibold text-primary">{avatar.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{avatar.tone}</p>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Wand2 className="h-3.5 w-3.5" />
                {avatar.status}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <Clock3 className="h-3.5 w-3.5" />
                {t('avatars.in_queue')}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
