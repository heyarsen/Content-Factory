import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'
import {
  getOnboardingState,
  ONBOARDING_STORAGE_KEY,
  setOnboardingActiveStep,
} from '../../lib/onboarding'

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
  helper?: string
}

type TargetRect = {
  top: number
  left: number
  width: number
  height: number
}

const steps: TourStep[] = [
  {
    id: 'sidebar-social',
    title: 'Open Social Accounts',
    description: 'Start in the sidebar. Click Social Accounts to connect your channels.',
    targetSelector: '[data-tour-id="social"]',
    ctaLabel: 'Go to Social Accounts',
    ctaLink: '/social',
    helper: 'Guided tours usually begin with navigation so you always know where to go next.',
  },
  {
    id: 'social-sample',
    title: 'Review the sample project',
    description: 'Here is a sample workspace with connected channels so you can visualize the outcome.',
    targetSelector: '[data-tour-id="social-sample"]',
    ctaLabel: 'Continue',
    ctaLink: '/social',
    helper: 'We use sample data so you can learn without changing anything real.',
  },
  {
    id: 'social-connect',
    title: 'Connect a channel',
    description: 'Click a Connect button to link your first social profile.',
    targetSelector: '[data-tour-id="social-connect"]',
    ctaLabel: 'Connect social media',
    ctaLink: '/social',
    helper: 'Most tours highlight the next click so you never lose your place.',
  },
  {
    id: 'sidebar-automation',
    title: 'Open Automation',
    description: 'Next, go to Automation to build a recurring content plan.',
    targetSelector: '[data-tour-id="automation"]',
    ctaLabel: 'Go to Automation',
    ctaLink: '/planning',
    helper: 'Scheduling is the core of a guided flow, so we move here right after connecting.',
  },
  {
    id: 'automation-sample-plan',
    title: 'See the sample plan',
    description: 'We preloaded a sample plan so you can see how your schedule will look.',
    targetSelector: '[data-tour-id="sample-plan"]',
    ctaLabel: 'Continue',
    ctaLink: '/planning',
    helper: 'Sample plans show how timing, topics, and triggers align.',
  },
  {
    id: 'automation-create-plan',
    title: 'Create a plan',
    description: 'Click Create Plan to open a pre-filled example you can follow.',
    targetSelector: '[data-tour-id="create-plan"]',
    ctaLabel: 'Open Create Plan',
    ctaLink: '/planning',
    helper: 'Coachmarks point at the primary call-to-action to reduce confusion.',
  },
  {
    id: 'plan-name',
    title: 'Name the plan',
    description: 'Give your plan a clear name so your team knows the campaign.',
    targetSelector: '[data-tour-id="plan-name"]',
    ctaLabel: 'Next',
    ctaLink: '/planning',
  },
  {
    id: 'plan-dates',
    title: 'Set the date range',
    description: 'Pick a start and end date to define the sprint.',
    targetSelector: '[data-tour-id="plan-dates"]',
    ctaLabel: 'Next',
    ctaLink: '/planning',
  },
  {
    id: 'plan-videos-per-day',
    title: 'Choose how many videos',
    description: 'Set how many videos you want to publish each day.',
    targetSelector: '[data-tour-id="plan-videos-per-day"]',
    ctaLabel: 'Next',
    ctaLink: '/planning',
  },
  {
    id: 'plan-video-slot',
    title: 'Define topics + post times',
    description: 'Add the topic and time for each video slot.',
    targetSelector: '[data-tour-id="plan-video-slot-0"]',
    ctaLabel: 'Next',
    ctaLink: '/planning',
  },
  {
    id: 'plan-trigger-time',
    title: 'Set the trigger time',
    description: 'Pick when automation should generate scripts and videos.',
    targetSelector: '[data-tour-id="plan-trigger-time"]',
    ctaLabel: 'Next',
    ctaLink: '/planning',
  },
  {
    id: 'sidebar-manual',
    title: 'Go to Manual Creation',
    description: 'Finish by creating a single video manually.',
    targetSelector: '[data-tour-id="manual"]',
    ctaLabel: 'Go to Manual Creation',
    ctaLink: '/create',
  },
  {
    id: 'manual-topic',
    title: 'Pick a topic',
    description: 'Write a punchy topic so the AI understands your video goal.',
    targetSelector: '[data-tour-id="manual-topic"]',
    ctaLabel: 'Next',
    ctaLink: '/create',
  },
  {
    id: 'manual-description',
    title: 'Add context',
    description: 'Add a few supporting details so the script hits your key points.',
    targetSelector: '[data-tour-id="manual-description"]',
    ctaLabel: 'Next',
    ctaLink: '/create',
  },
  {
    id: 'manual-style',
    title: 'Choose a style',
    description: 'Select a visual style to match the vibe of your brand.',
    targetSelector: '[data-tour-id="manual-style"]',
    ctaLabel: 'Next',
    ctaLink: '/create',
  },
  {
    id: 'manual-generate',
    title: 'Generate your first video',
    description: 'Click Generate to launch the video and watch it appear in your library.',
    targetSelector: '[data-tour-id="manual-generate"]',
    ctaLabel: 'Finish',
    ctaLink: '/create',
  },
]

const sampleHighlights = [
  'Sample project: “Lumen Fitness Launch”',
  '3 videos/day · 2-week sprint · Auto-posting enabled',
  'Next publish window: Tomorrow at 9:00 AM',
]

export function OnboardingPanel() {
  const [state, setState] = useState<OnboardingState>({ dismissed: false, stepIndex: 0 })
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight })

  useEffect(() => {
    const parsed = getOnboardingState()
    if (!parsed) {
      return
    }

    setState({
      dismissed: Boolean(parsed.dismissed),
      stepIndex: Number.isFinite(parsed.stepIndex) ? parsed.stepIndex : 0,
    })
  }, [])

  useEffect(() => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state))
    if (state.dismissed) {
      setOnboardingActiveStep(null)
    }
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
  const isFirstStep = state.stepIndex === 0

  useEffect(() => {
    if (!step || state.dismissed) {
      return
    }

    setOnboardingActiveStep(step.id)
    window.dispatchEvent(
      new CustomEvent('onboarding:step', { detail: { stepId: step.id } }),
    )
  }, [step, state.dismissed])

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
    const panelHeight = 340
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
    <div className="fixed inset-0 z-50 pointer-events-none">
      {targetRect && (
        <div
          className="absolute rounded-2xl border-2 border-brand-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.55)] transition-all pointer-events-none"
          style={{
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
          }}
        />
      )}

      <div
        className="absolute max-w-[360px] space-y-4 rounded-2xl border border-white/20 bg-white/95 p-5 shadow-2xl pointer-events-auto"
        style={panelPosition}
      >
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-[0.2em] text-brand-500">Guided Tour</span>
          <span>{progress}% complete</span>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">{step.title}</h2>
          <p className="text-sm text-slate-600">{step.description}</p>
          {step.helper && (
            <p className="rounded-xl border border-brand-100 bg-brand-50/70 px-3 py-2 text-xs text-brand-700">
              {step.helper}
            </p>
          )}
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
          {step.ctaLink && (
            <Link to={step.ctaLink} className="flex-1 min-w-[150px]">
              <Button className="w-full" size="sm">
                {step.ctaLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}
          <div className="flex flex-1 gap-2 min-w-[150px]">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  stepIndex: Math.max(prev.stepIndex - 1, 0),
                }))
              }
              className="flex-1"
              disabled={isFirstStep}
            >
              Back
            </Button>
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
