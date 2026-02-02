import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Sparkles, Wand2, Calendar, Video } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'

const STORAGE_KEY = 'cf-onboarding-v1'

type OnboardingState = {
  dismissed: boolean
  completed: Record<string, boolean>
}

const steps = [
  {
    id: 'quick-create',
    title: 'Generate your first 15-second video',
    description: 'Use Quick Create for a fast, polished short that fits social timelines.',
    ctaLabel: 'Open Quick Create',
    ctaLink: '/quick-create',
    icon: Sparkles,
  },
  {
    id: 'planning',
    title: 'Build a weekly plan',
    description: 'Schedule recurring topics and auto-generate content so you never miss a post.',
    ctaLabel: 'Open Video Planning',
    ctaLink: '/planning',
    icon: Calendar,
  },
  {
    id: 'library',
    title: 'Review the video library',
    description: 'Track every render, download assets, and schedule when you are ready to post.',
    ctaLabel: 'Open Library',
    ctaLink: '/videos',
    icon: Video,
  },
  {
    id: 'distribution',
    title: 'Connect social distribution',
    description: 'Link your channels to auto-post shorts as soon as they render.',
    ctaLabel: 'Connect Accounts',
    ctaLink: '/distribution',
    icon: Wand2,
  },
]

export function OnboardingPanel() {
  const [state, setState] = useState<OnboardingState>({ dismissed: false, completed: {} })

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return
    }
    try {
      const parsed = JSON.parse(stored) as OnboardingState
      setState({
        dismissed: Boolean(parsed.dismissed),
        completed: parsed.completed || {},
      })
    } catch (error) {
      console.warn('Failed to parse onboarding state:', error)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const completedCount = useMemo(
    () => steps.filter((step) => state.completed[step.id]).length,
    [state.completed]
  )

  const progress = Math.round((completedCount / steps.length) * 100)

  if (state.dismissed) {
    return null
  }

  return (
    <Card className="relative overflow-hidden border border-white/50 bg-gradient-to-br from-white via-white to-brand-50 p-6 sm:p-8 shadow-[0_45px_90px_-60px_rgba(79,70,229,0.5)]">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-100/60 blur-3xl" />
      <div className="absolute -left-20 bottom-0 h-40 w-40 rounded-full bg-sky-100/50 blur-3xl" />
      <div className="relative z-10 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">
              <Sparkles className="h-4 w-4" />
              Welcome
            </p>
            <h2 className="text-2xl font-semibold text-slate-900">Your Content Factory onboarding</h2>
            <p className="text-sm text-slate-500">
              Follow these steps to launch a consistent short-form pipeline in minutes.
            </p>
          </div>
          <Button
            variant="ghost"
            className="self-start text-slate-400 hover:text-slate-600"
            onClick={() => setState((prev) => ({ ...prev, dismissed: true }))}
          >
            Dismiss
          </Button>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{completedCount}/{steps.length} steps completed</span>
            <span>{progress}% ready</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-400 via-brand-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {steps.map((step) => {
            const isComplete = Boolean(state.completed[step.id])
            const Icon = step.icon
            return (
              <div
                key={step.id}
                className="flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${isComplete ? 'border-emerald-200 bg-emerald-50 text-emerald-500' : 'border-brand-100 bg-brand-50 text-brand-500'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
                      {isComplete && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{step.description}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={step.ctaLink}>
                    <Button variant="secondary" size="sm">
                      {step.ctaLabel}
                    </Button>
                  </Link>
                  <Button
                    variant={isComplete ? 'ghost' : 'primary'}
                    size="sm"
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        completed: {
                          ...prev.completed,
                          [step.id]: !isComplete,
                        },
                      }))
                    }
                  >
                    {isComplete ? 'Mark as not done' : 'Mark as done'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
