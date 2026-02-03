export type OnboardingState = {
  dismissed: boolean
  stepIndex: number
}

export const ONBOARDING_STORAGE_KEY = 'cf-onboarding-v2'
export const ONBOARDING_STEP_KEY = 'cf-onboarding-active-step'

export const getOnboardingState = (): OnboardingState | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const stored = window.localStorage.getItem(ONBOARDING_STORAGE_KEY)
  if (!stored) {
    return null
  }

  try {
    const parsed = JSON.parse(stored) as OnboardingState
    return {
      dismissed: Boolean(parsed.dismissed),
      stepIndex: Number.isFinite(parsed.stepIndex) ? parsed.stepIndex : 0,
    }
  } catch (error) {
    console.warn('Failed to parse onboarding state:', error)
    return null
  }
}

export const isOnboardingActive = (): boolean => {
  const state = getOnboardingState()
  return Boolean(state && !state.dismissed)
}

export const getOnboardingActiveStep = (): string | null => {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(ONBOARDING_STEP_KEY)
}

export const setOnboardingActiveStep = (stepId: string | null) => {
  if (typeof window === 'undefined') {
    return
  }

  if (stepId) {
    window.localStorage.setItem(ONBOARDING_STEP_KEY, stepId)
  } else {
    window.localStorage.removeItem(ONBOARDING_STEP_KEY)
  }
}
