import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, CheckCircle2, Lock, Sparkles, Video, Wand2, type LucideIcon } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'

const STORAGE_KEY = 'cf-onboarding-v1'

type OnboardingState = {
  dismissed: boolean
  completed: Record<string, boolean>
}

type OnboardingStep = {
  id: string
  title: string
  description: string
  ctaLabel: string
  icon: LucideIcon
} & (
  | {
      ctaType: 'modal'
    }
  | {
      ctaType: 'link'
      ctaLink: string
    }
)

const steps: OnboardingStep[] = [
  {
    id: 'distribution',
    title: 'Connect social media',
    description: 'Link your channels now so every render can publish instantly.',
    ctaLabel: 'Connect accounts',
    ctaType: 'link',
    ctaLink: '/distribution',
    icon: Wand2,
  },
  {
    id: 'planning',
    title: 'Make a weekly plan',
    description: 'See how your plan auto-queues topics, video counts, and publish timing.',
    ctaLabel: 'Preview plan setup',
    ctaType: 'modal',
    icon: Calendar,
  },
  {
    id: 'manual',
    title: 'Manual generation',
    description: 'Kick off a single video to test prompts, voice, and pacing.',
    ctaLabel: 'Open Quick Create',
    ctaType: 'link',
    ctaLink: '/quick-create',
    icon: Sparkles,
  },
  {
    id: 'library',
    title: 'My videos tab',
    description: 'Review every render, download assets, and schedule when you are ready to post.',
    ctaLabel: 'Open My Videos',
    ctaType: 'link',
    ctaLink: '/videos',
    icon: Video,
  },
]

const starterVideos = [
  { title: '3 hooks for viral Reels', status: 'Rendered · 24s' },
  { title: 'Before/after transformation', status: 'Scheduled · Tomorrow 9:00 AM' },
  { title: 'Quick tip: 5-second story arc', status: 'Drafted · Needs voiceover' },
]

export function OnboardingPanel() {
  const [state, setState] = useState<OnboardingState>({ dismissed: false, completed: {} })
  const [isPlanModalOpen, setPlanModalOpen] = useState(false)

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
    <>
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
                Connect channels, preview a plan, and ship your first shorts with a starter project already loaded.
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

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-4">
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
                      {step.ctaType === 'modal' ? (
                        <Button variant="secondary" size="sm" onClick={() => setPlanModalOpen(true)}>
                          {step.ctaLabel}
                        </Button>
                      ) : (
                        <Link to={step.ctaLink}>
                          <Button variant="secondary" size="sm">
                            {step.ctaLabel}
                          </Button>
                        </Link>
                      )}
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

            <div className="space-y-4">
              <div className="rounded-2xl border border-brand-100 bg-white/90 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Starter project</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">Weekly Reel Sprint</h3>
                    <p className="mt-1 text-xs text-slate-500">Preloaded with a plan, scripts, and distribution-ready clips.</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-600">Aha ready</span>
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-xs font-semibold text-slate-700">Plan cadence</p>
                    <p className="mt-1 text-sm text-slate-600">3 videos/week · 14 days · Auto-research enabled</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-xs font-semibold text-slate-700">Next trigger</p>
                    <p className="mt-1 text-sm text-slate-600">Tomorrow at 9:00 AM · Shorts + Reels</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-xs font-semibold text-slate-700">First videos</p>
                    <ul className="mt-2 space-y-2 text-xs text-slate-500">
                      {starterVideos.map((video) => (
                        <li key={video.title} className="flex items-center justify-between">
                          <span className="text-slate-700">{video.title}</span>
                          <span>{video.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  <Lock className="h-4 w-4" />
                  Preview mode
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  The plan builder is locked while you explore. Open the preview to see how a launch-ready plan looks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={isPlanModalOpen}
        onClose={() => setPlanModalOpen(false)}
        title="Plan creation preview"
        size="lg"
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4 text-sm text-slate-600">
            This preview shows what you will complete when you create your real plan. Fields are locked so you can focus
            on the structure.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Input
                label="Plan name"
                value="Weekly Reel Sprint"
                disabled
                readOnly
              />
              <p className="text-xs text-slate-500">
                Give your plan a clear name so teammates know the goal at a glance.
              </p>
            </div>
            <div className="space-y-2">
              <Input
                label="Amount of videos"
                value="3 videos per week"
                disabled
                readOnly
              />
              <p className="text-xs text-slate-500">
                Choose how many videos you want to auto-generate each week.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Input
                label="Trigger time"
                value="Every Monday, Wednesday, Friday at 9:00 AM"
                disabled
                readOnly
              />
              <p className="text-xs text-slate-500">
                Set a consistent trigger so your team always knows when new drafts arrive.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Next step: confirm and launch</p>
              <p className="text-xs text-slate-500">When you are ready, unlock the builder and save your first plan.</p>
            </div>
            <Button variant="secondary" onClick={() => setPlanModalOpen(false)}>
              Close preview
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
