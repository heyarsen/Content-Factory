import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Card } from './Card'
import { Button } from './Button'
import { useAuth } from '../../contexts/AuthContext'
import { useCreditsContext } from '../../contexts/CreditContext'
import { useLanguage } from '../../contexts/LanguageContext'

// Russian pluralization helper
const getRussianPlural = (count: number): string => {
    const lastDigit = count % 10
    const lastTwoDigits = count % 100

    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
        return 'ов'
    }

    if (lastDigit === 1) {
        return ''
    }

    if (lastDigit >= 2 && lastDigit <= 4) {
        return 'а'
    }

    return 'ов'
}

// Ukrainian pluralization helper (same rules as Russian)
const getUkrainianPlural = (count: number): string => {
    const lastDigit = count % 10
    const lastTwoDigits = count % 100

    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
        return 'ів'
    }

    if (lastDigit === 1) {
        return ''
    }

    if (lastDigit >= 2 && lastDigit <= 4) {
        return 'и'
    }

    return 'ів'
}

// German pluralization helper
const getGermanPlural = (count: number): string => {
    return count === 1 ? '' : 'n'
}

// Spanish pluralization helper
const getSpanishPlural = (count: number): string => {
    return count === 1 ? '' : 's'
}

// Get pluralization based on language
const getPluralization = (language: string, count: number): string => {
    switch (language) {
        case 'ru':
            return getRussianPlural(count)
        case 'uk':
            return getUkrainianPlural(count)
        case 'de':
            return getGermanPlural(count)
        case 'es':
            return getSpanishPlural(count)
        default:
            return count === 1 ? '' : 's' // English fallback
    }
}

export function CreditBanner() {
    const { t, language } = useLanguage()
    const { user, loading: authLoading } = useAuth()
    const { credits, unlimited, subscription, loading: creditsLoading } = useCreditsContext()

    // During loading, don't show the banner at all to avoid flickering
    if (authLoading || creditsLoading) return null

    const hasSubscription = !!(user?.role === 'admin' || (subscription && ['active', 'pending'].includes(subscription.status)))
    const hasTrialCredits = credits !== null && credits > 0

    // Only show banner if user has NO subscription AND is NOT unlimited (trial/free users)
    if (hasSubscription || unlimited) return null

    return (
        <Card className="border-amber-200 bg-amber-50 p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-amber-800">
                <div className="flex items-center gap-4">
                    <Sparkles className="h-6 w-6 text-amber-500 shrink-0" />
                    <div>
                        <h3 className="font-semibold text-amber-900">
                            {hasTrialCredits
                                ? t('common.credits_available', { count: credits })
                                : t('common.trial_credits_ended_title')}
                        </h3>
                        <p className="text-sm opacity-90">
                            {hasTrialCredits
                                ? t('common.credits_message', {
                                    count: credits,
                                    plural: getPluralization(language, credits)
                                })
                                : t('common.trial_credits_ended_message')
                            }
                        </p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
                    {hasTrialCredits && (
                        <Link to="/quick-create" className="w-full sm:w-auto">
                            <Button variant="primary" className="w-full bg-blue-600 hover:bg-blue-700 text-white border-none shadow-md">
                                {t('common.generate_video') || 'Generate video'}
                            </Button>
                        </Link>
                    )}
                    <Link to="/credits" className="w-full sm:w-auto">
                        <Button variant="primary" className="w-full bg-amber-600 hover:bg-amber-700 text-white border-none shadow-md">
                            {t('common.buy_subscription') || 'Buy subscription'}
                        </Button>
                    </Link>
                </div>
            </div>
        </Card>
    )
}
