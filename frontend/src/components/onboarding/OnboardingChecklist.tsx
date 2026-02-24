import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronDown, ChevronUp, PartyPopper, Circle } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { useLanguage } from '../../contexts/LanguageContext'

export interface OnboardingChecklistStep {
  id: string
  title: string
  path: string
  completed: boolean
}

interface OnboardingChecklistProps {
  steps: OnboardingChecklistStep[]
  accountAgeDays: number | null
  isNewUser: boolean
  allCompleted: boolean
  hidden: boolean
  onHide: () => Promise<void>
}

export function OnboardingChecklist({
  steps,
  accountAgeDays,
  isNewUser,
  allCompleted,
  hidden,
  onHide,
}: OnboardingChecklistProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { t } = useLanguage()

  const completedCount = useMemo(() => steps.filter((step) => step.completed).length, [steps])

  if (!isNewUser || hidden) {
    return null
  }

  const handleHide = async () => {
    try {
      setIsSaving(true)
      await onHide()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-brand-200/70 bg-gradient-to-br from-white to-brand-50/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">{t('onboarding.getting_started')}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{t('onboarding.checklist_title')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {allCompleted
              ? t('onboarding.completed_setup')
              : t('onboarding.steps_complete', { completed: completedCount, total: steps.length }) + (accountAgeDays !== null ? t('onboarding.day_label', { day: accountAgeDays + 1 }) : '')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setIsCollapsed((prev) => !prev)}>
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          {allCompleted && (
            <Button size="sm" variant="secondary" onClick={handleHide} disabled={isSaving}>
              {isSaving ? t('onboarding.hiding') : t('onboarding.hide')}
            </Button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="mt-4 space-y-2">
          {allCompleted && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <PartyPopper className="h-4 w-4" />
              {t('onboarding.all_milestones_complete')}
            </div>
          )}

          {steps.map((step) => (
            <Link
              key={step.id}
              to={step.path}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:border-brand-300"
            >
              <span className="text-sm text-slate-700">{step.title}</span>
              {step.completed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300" />
              )}
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}
