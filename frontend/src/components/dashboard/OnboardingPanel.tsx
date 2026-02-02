import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'

const STORAGE_KEY = 'cf-onboarding-v2'

type OnboardingState = {
  dismissed: boolean
  stepIndex: number
}

type TourStep = {
  id: string
  title: string
  description: string
  targetSelector: string
  ctaLabel: string
  ctaLink: string
}

type TargetRect = {
  top: number
  left: number
  width: number
  height: number
}

const steps: TourStep[] = [
  {
    id: 'connect',
    title: 'Connect social media',
    description: 'Click the Social Accounts tab to link your channels and unlock auto-publishing.',
    targetSelector: '[data-tour-id="social"]',
    ctaLabel: 'Open Social Accounts',
    ctaLink: '/social',
  },
  {
    id: 'automation',
    title: 'Set up automation',
    description: 'Automation creates a recurring schedule so your posts never miss a beat.',
    targetSelector: '[data-tour-id="automation"]',
    ctaLabel: 'Build a plan',
    ctaLink: '/planning',
  },
  {
    id: 'manual',
    title: 'Try manual creation',
    description: 'Generate a single video manually to see prompts, voice, and pacing in action.',
    targetSelector: '[data-tour-id="manual"]',
    ctaLabel: 'Start a manual video',
    ctaLink: '/create',
  },
]

const sampleHighlights = [
  'Weekly Reel Sprint (3 videos/week · 14 days)',
  'Preloaded scripts + distribution-ready clips',
  'Next publish window: Tomorrow 9:00 AM',
]

export function OnboardingPanel() {
  const [state, setState] = useState<OnboardingState>({ dismissed: false, stepIndex: 0 })
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight })

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return
    }

    try {
      const parsed = JSON.parse(stored) as OnboardingState
      setState({
        dismissed: Boolean(parsed.dismissed),
        stepIndex: Number.isFinite(parsed.stepIndex) ? parsed.stepIndex : 0,
      })
    } catch (error) {
      console.warn('Failed to parse onboarding state:', error)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    const updateRect = () => {
      const step = steps[state.stepIndex]
      if (!step) {
        setTargetRect(null)
        return
      }

      const element = document.querySelector(step.targetSelector) as HTMLElement | null
      if (!element) {
        setTargetRect(null)
        return
      }

      const rect = element.getBoundingClientRect()
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      })
    }

    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
      updateRect()
    }

    updateRect()
    updateViewport()

    window.addEventListener('resize', updateViewport)
    window.addEventListener('scroll', updateRect, true)

    return () => {
      window.removeEventListener('resize', updateViewport)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [state.stepIndex])

  const step = steps[state.stepIndex]
  const isLastStep = state.stepIndex === steps.length - 1

  const progress = useMemo(() => {
    return Math.round(((state.stepIndex + 1) / steps.length) * 100)
  }, [state.stepIndex])

  const panelPosition = useMemo(() => {
    if (!targetRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }

    const panelWidth = 360
    const panelHeight = 260
    const padding = 16

    let left = Math.min(Math.max(targetRect.left, padding), viewport.width - panelWidth - padding)
    let top = targetRect.top + targetRect.height + 16

    if (top + panelHeight > viewport.height) {
      top = Math.max(padding, targetRect.top - panelHeight - 16)
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
      transform: 'none',
    }
  }, [targetRect, viewport])

  if (state.dismissed || !step) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50">
      {targetRect && (
        <div
          className="absolute rounded-2xl border-2 border-brand-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.55)] transition-all"
          style={{
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
          }}
        />
      )}

      <div
        className="absolute max-w-[360px] space-y-4 rounded-2xl border border-white/20 bg-white/95 p-5 shadow-2xl"
        style={panelPosition}
      >
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-[0.2em] text-brand-500">Onboarding</span>
          <span>{progress}% complete</span>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">{step.title}</h2>
          <p className="text-sm text-slate-600">{step.description}</p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Sample project ready</p>
          <ul className="mt-2 space-y-1">
            {sampleHighlights.map((highlight) => (
              <li key={highlight} className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to={step.ctaLink} className="flex-1 min-w-[150px]">
            <Button className="w-full" size="sm">
              {step.ctaLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setState((prev) =>
                isLastStep
                  ? { ...prev, dismissed: true }
                  : { ...prev, stepIndex: Math.min(prev.stepIndex + 1, steps.length - 1) }
              )
            }
            className="flex-1"
          >
            {isLastStep ? 'Finish tour' : 'Next step'}
          </Button>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-brand-500" />
            <span>{state.stepIndex + 1} of {steps.length}</span>
          </div>
          <button
            className="font-semibold text-slate-500 hover:text-slate-700"
            onClick={() => setState((prev) => ({ ...prev, dismissed: true }))}
          >
            Skip tour
          </button>
        </div>

      </div>
    </div>
  )
}
