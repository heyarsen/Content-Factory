import { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { useCredits } from '../hooks/useCredits'
import { useNotifications } from '../contexts/NotificationContext'
import { Coins, CheckCircle2, XCircle, Clock, ArrowUpRight, ArrowDownRight, History, Crown, AlertCircle } from 'lucide-react'
import api from '../lib/api'
import { Modal } from '../components/ui/Modal'
import { useLanguage } from '../contexts/LanguageContext'

interface SubscriptionPlan {
  id: string
  name: string
  credits: number
  price_usd: number
  display_name: string
  description: string | null
}

interface CreditTransaction {
  id: string
  type: 'topup' | 'deduction' | 'refund' | 'adjustment'
  amount: number
  balance_before: number | null
  balance_after: number | null
  operation: string | null
  description: string | null
  payment_status: string | null
  created_at: string
}

interface CreditPackage {
  id: string
  credits: number
  price_usd: number
  display_name: string
  description: string | null
}

interface UserSubscription {
  id: string
  plan_id: string
  status: string
  credits_remaining: number
  started_at: string
}

export function Credits() {
  const { credits, unlimited, loading: creditsLoading, refreshCredits } = useCredits()
  const { addNotification } = useNotifications()
  const { t } = useLanguage()
  const { refreshSubscriptionStatus } = useAuth()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(true)
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [hasSubscription, setHasSubscription] = useState(false)
  const [loadingSubscription, setLoadingSubscription] = useState(true)
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [loadingPackages, setLoadingPackages] = useState(true)
  const [toppingUp, setToppingUp] = useState<string | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)

  useEffect(() => {
    loadPlans()
    loadPackages()
    loadTransactionHistory()
    loadSubscriptionStatus()

    // Check for payment status in URL params
    const params = new URLSearchParams(window.location.search)
    const status = params.get('status')
    const orderRef = params.get('order')

    if (status === 'success' && orderRef) {
      // Start aggressive polling immediately after returning from payment
      checkPaymentStatusAggressive(orderRef)
      // Clean up URL
      window.history.replaceState({}, '', '/credits')
    }
  }, [])

  const loadPlans = async () => {
    try {
      setLoadingPlans(true)
      const response = await api.get('/api/credits/plans')
      setPlans(response.data.plans || [])
    } catch (error: any) {
      console.error('Failed to load plans:', error)
      addNotification({
        type: 'error',
        title: t('common.error'),
        message: t('credits.load_plans_failed'),
      })
    } finally {
      setLoadingPlans(false)
    }
  }

  const loadSubscriptionStatus = async () => {
    try {
      setLoadingSubscription(true)
      const response = await api.get('/api/credits/subscription-status')
      setHasSubscription(response.data.hasSubscription || false)
      setSubscription(response.data.subscription || null)
    } catch (error: any) {
      console.error('Failed to load subscription status:', error)
    } finally {
      setLoadingSubscription(false)
    }
  }

  const loadPackages = async () => {
    try {
      setLoadingPackages(true)
      const response = await api.get('/api/credits/packages')
      setPackages(response.data.packages || [])
    } catch (error: any) {
      console.error('Failed to load packages:', error)
    } finally {
      setLoadingPackages(false)
    }
  }

  const loadTransactionHistory = async () => {
    try {
      setLoadingTransactions(true)
      const response = await api.get('/api/credits/history', {
        params: { limit: 100 },
      })
      // Filter out failed topups - don't show them in the UI
      const filteredTransactions = (response.data.transactions || []).filter(
        (tx: CreditTransaction) => !(tx.type === 'topup' && tx.payment_status === 'failed')
      )
      setTransactions(filteredTransactions)
    } catch (error: any) {
      console.error('Failed to load transaction history:', error)
    } finally {
      setLoadingTransactions(false)
    }
  }

  const submitWayForPayForm = (paymentUrl: string, fields: Record<string, string>) => {
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = paymentUrl
    form.style.display = 'none'

    Object.entries(fields || {}).forEach(([name, value]) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value ?? ''
      form.appendChild(input)
    })

    document.body.appendChild(form)
    form.submit()
  }

  const handlePurchase = async (planId: string) => {
    // If switching to free plan, show confirmation modal
    if (planId === 'plan_free' && hasSubscription) {
      setPendingPlanId('plan_free')
      setShowCancelModal(true)
      return
    }

    // If switching plans while having an active one, show confirmation modal
    if (hasSubscription && planId !== subscription?.plan_id) {
      setPendingPlanId(planId)
      setShowCancelModal(true)
      return
    }

    await executePurchase(planId)
  }

  const executePurchase = async (planId: string) => {
    try {
      setPurchasing(planId)
      const response = await api.post('/api/credits/subscribe', { planId })

      if (response.data.type === 'free' || response.data.success) {
        addNotification({
          type: 'success',
          title: t('credits.plan_activated'),
          message: response.data.message || t('credits.plan_activated_msg'),
        })
        refreshCredits()
        loadSubscriptionStatus()
        setPurchasing(null)
      } else if (response.data.paymentUrl && response.data.paymentFields) {
        submitWayForPayForm(response.data.paymentUrl, response.data.paymentFields)
      } else {
        addNotification({
          type: 'error',
          title: t('credits.payment_error'),
          message: t('credits.initiate_payment_failed'),
        })
        setPurchasing(null)
      }
    } catch (error: any) {
      console.error('Purchase error:', error)
      addNotification({
        type: 'error',
        title: t('credits.purchase_error'),
        message: error.response?.data?.error || t('credits.initiate_purchase_failed'),
      })
      setPurchasing(null)
    }
  }

  const handleTopUp = async (packageId: string) => {
    try {
      if (!hasSubscription) {
        addNotification({
          type: 'warning',
          title: t('credits.sub_required_title'),
          message: t('credits.sub_required_msg'),
        })
        return
      }

      setToppingUp(packageId)
      const response = await api.post('/api/credits/topup', { packageId })

      if (response.data.paymentUrl && response.data.paymentFields) {
        // Don't clear loading state - let the redirect happen while button stays in loading state
        submitWayForPayForm(response.data.paymentUrl, response.data.paymentFields)
      } else {
        // Only clear loading state if payment initiation failed
        addNotification({
          type: 'error',
          title: t('credits.payment_error'),
          message: t('credits.initiate_topup_failed'),
        })
        setToppingUp(null)
      }
    } catch (error: any) {
      console.error('Top up error:', error)
      addNotification({
        type: 'error',
        title: t('credits.topup_error'),
        message: error.response?.data?.error || t('credits.initiate_topup_failed'),
      })
      setToppingUp(null)
    }
  }

  const handleCancelClick = () => {
    setPendingPlanId('cancel')
    setShowCancelModal(true)
  }

  const handleConfirmCancel = async () => {
    setShowCancelModal(false)

    if (pendingPlanId === 'cancel' || pendingPlanId === 'plan_free') {
      await executeCancel()
    } else if (pendingPlanId) {
      await executePurchase(pendingPlanId)
    }

    setPendingPlanId(null)
  }

  const executeCancel = async () => {
    try {
      setPurchasing('cancel')
      await api.post('/api/credits/cancel')
      addNotification({
        type: 'success',
        title: t('credits.sub_cancelled'),
        message: t('credits.sub_cancelled_msg'),
      })
      refreshCredits()
      loadSubscriptionStatus()
    } catch (error: any) {
      console.error('Cancel error:', error)
      addNotification({
        type: 'error',
        title: t('common.error'),
        message: error.response?.data?.error || t('credits.cancel_failed'),
      })
    } finally {
      setPurchasing(null)
    }
  }

  const checkPaymentStatus = async (orderReference: string, attempts = 0) => {
    try {
      const response = await api.get(`/api/credits/check-status/${orderReference}`)
      const { status, completed } = response.data

      if (status === 'Approved' || status === 'completed' || completed) {
        addNotification({
          type: 'success',
          title: t('credits.payment_success'),
          message: t('credits.sub_activated_msg'),
        })
        refreshCredits()
        loadTransactionHistory()
        loadSubscriptionStatus()
      } else if (attempts < 5) {
        // If not approved yet, try again in 3 seconds (up to 5 times)
        setTimeout(() => checkPaymentStatus(orderReference, attempts + 1), 3000)

        // Only show "processing" on the first attempt
        if (attempts === 0) {
          addNotification({
            type: 'info',
            title: t('credits.payment_processing'),
            message: t('credits.payment_processing_msg'),
          })
        }
      } else {
        // Final attempt failed to get Approved
        addNotification({
          type: 'warning',
          title: t('credits.payment_processing'),
          message: t('credits.payment_processing_msg_long') || t('credits.payment_processing_msg'),
        })
      }
    } catch (error: any) {
      console.error('Status check error:', error)
    }
  }

  const checkPaymentStatusAggressive = async (orderReference: string, attempts = 0) => {
    try {
      const response = await api.get(`/api/credits/check-status/${orderReference}`)
      const { status, completed } = response.data

      if (status === 'Approved' || status === 'completed' || completed) {
        // Payment successful - show success and refresh data immediately
        addNotification({
          type: 'success',
          title: t('credits.payment_success'),
          message: t('credits.credits_added_immediately'),
        })
        // Refresh immediately
        await refreshCredits()
        await refreshSubscriptionStatus() // Refresh auth context subscription status
        await loadTransactionHistory()
        await loadSubscriptionStatus()
      } else if (attempts < 10) {
        // Aggressive polling: check every 1 second for up to 10 seconds
        setTimeout(() => checkPaymentStatusAggressive(orderReference, attempts + 1), 1000)

        // Only show "processing" on the first attempt
        if (attempts === 0) {
          addNotification({
            type: 'info',
            title: t('credits.payment_processing'),
            message: t('credits.payment_processing_msg'),
          })
        }
      } else {
        // Final attempt - switch to standard polling
        addNotification({
          type: 'warning',
          title: t('credits.payment_processing'),
          message: t('credits.please_wait_processing'),
        })
        // Continue with slower polling
        checkPaymentStatus(orderReference, 0)
      }
    } catch (error: any) {
      console.error('Status check error:', error)
      // Retry even on error
      if (attempts < 10) {
        setTimeout(() => checkPaymentStatusAggressive(orderReference, attempts + 1), 1000)
      }
    }
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'topup':
        return <ArrowUpRight className="h-4 w-4 text-green-600" />
      case 'deduction':
        return <ArrowDownRight className="h-4 w-4 text-red-600" />
      case 'refund':
        return <ArrowUpRight className="h-4 w-4 text-blue-600" />
      default:
        return <Coins className="h-4 w-4 text-slate-600" />
    }
  }

  const getTransactionStatusIcon = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-600" />
      default:
        return null
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const { language } = useLanguage()
    return date.toLocaleDateString(language === 'en' ? 'en-US' : language === 'ru' ? 'ru-RU' : language === 'uk' ? 'uk-UA' : language === 'es' ? 'es-ES' : 'de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const currentPlan = plans.find((p: SubscriptionPlan) => p.id === subscription?.plan_id)

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('credits.title')}</h1>
            <p className="mt-2 text-slate-600">{t('credits.subtitle')}</p>
            {hasSubscription && subscription?.status === 'active' && (
              <div className="mt-2 flex items-center gap-4">
                <button
                  onClick={handleCancelClick}
                  disabled={purchasing === 'cancel'}
                  className="text-sm text-red-600 hover:text-red-700 font-medium underline"
                >
                  {t('credits.cancel_subscription')}
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
            <Coins className="h-6 w-6 text-amber-500" />
            <div>
              <p className="text-xs text-slate-500">{t('credits.current_balance')}</p>
              <p className="text-2xl font-bold text-slate-900">
                {creditsLoading ? '...' : unlimited ? t('credits.unlimited') : credits ?? 0}
                {!unlimited && <span className="ml-2 text-sm font-normal text-slate-500">{t('credits.credits_unit')}</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Subscription Status */}
        {loadingSubscription ? (
          <Skeleton className="h-24" />
        ) : hasSubscription && subscription ? (
          <Card className="p-6 bg-gradient-to-r from-brand-50 to-indigo-50 border-brand-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-white">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">{t('credits.active_subscription')}</p>
                  <p className="text-lg font-bold text-slate-900">{currentPlan?.display_name || 'Subscription'}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {subscription.credits_remaining !== undefined ? t('credits.remaining_credits').replace('{count}', subscription.credits_remaining.toString()) : t('credits.plan_active')}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => {
                  const plansElement = document.getElementById('subscription-plans')
                  plansElement?.scrollIntoView({ behavior: 'smooth' })
                }}
                variant="primary"
              >
                {t('credits.change_plan')}
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6 border-amber-200 bg-amber-50">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-semibold text-slate-900">{t('credits.no_active_sub')}</p>
                <p className="text-sm text-slate-600 mt-1">
                  {t('credits.no_active_sub_desc')}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Subscription Plans */}
        <div id="subscription-plans">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            {hasSubscription ? t('credits.change_sub_plan') : t('credits.choose_sub_plan')}
          </h2>
          {loadingPlans ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-4">
              {plans.map((plan: SubscriptionPlan) => {
                const isCurrentPlan = (subscription?.plan_id === plan.id && subscription?.status === 'active') || (!hasSubscription && plan.id === 'plan_free')
                return (
                  <Card key={plan.id} className={`p-6 ${isCurrentPlan ? 'border-brand-500 bg-brand-50' : ''}`}>
                    <div className="flex flex-col h-full">
                      {isCurrentPlan && (
                        <div className="mb-3 flex items-center gap-2 text-brand-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs font-semibold uppercase">{t('credits.current_plan_label')}</span>
                        </div>
                      )}
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-slate-900">{plan.display_name}</h3>
                        {plan.description && (
                          <p className="mt-1 text-sm text-slate-600 leading-snug">{plan.description}</p>
                        )}
                      </div>
                      <div className="mb-4 mt-auto">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-slate-900">
                            {plan.id === 'plan_free' ? '3' : plan.credits}
                          </span>
                          <span className="text-sm text-slate-500">{t('credits.credits_unit')}</span>
                        </div>
                        {plan.id === 'plan_free' && (
                          <p className="mt-1 text-[10px] text-slate-500 italic">
                            {t('credits.new_accounts_only')}
                          </p>
                        )}
                      </div>
                      <div className="mb-6 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-brand-600">${plan.price_usd.toFixed(2)}</span>
                        <span className="text-sm text-slate-500">USD</span>
                      </div>
                      <Button
                        onClick={() => plan.id === 'plan_free' ? handleCancelClick() : handlePurchase(plan.id)}
                        disabled={purchasing === plan.id || isCurrentPlan}
                        className="w-full mt-auto"
                        variant={isCurrentPlan ? "ghost" : "primary"}
                      >
                        {isCurrentPlan ? t('credits.current_plan_label') : purchasing === plan.id ? t('credits.processing') : hasSubscription ? t('credits.switch_plan') : t('credits.subscribe_now')}
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Credit Top-ups */}
        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-900">{t('credits.top_up_title')}</h2>
          <p className="mb-4 text-sm text-slate-600">
            {hasSubscription
              ? t('credits.top_up_active_sub')
              : t('credits.top_up_sub_required')}
          </p>

          {loadingPackages ? (
            <div className="grid gap-4 md:grid-cols-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-36" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-5">
              {packages.map((pkg) => (
                <Card key={pkg.id} className={`p-4 ${!hasSubscription ? 'opacity-60' : ''}`}>
                  <div className="flex flex-col gap-2">
                    <div className="text-lg font-bold text-slate-900">{pkg.credits} {t('credits.credits_unit')}</div>
                    <div className="text-sm text-slate-600">{pkg.description || pkg.display_name}</div>
                    <div className="text-xl font-bold text-brand-600">${pkg.price_usd.toFixed(2)}</div>
                    <Button
                      onClick={() => handleTopUp(pkg.id)}
                      disabled={!hasSubscription || toppingUp === pkg.id}
                      variant={!hasSubscription ? 'ghost' : 'secondary'}
                      className="w-full"
                    >
                      {!hasSubscription ? t('credits.subscribe_first') : toppingUp === pkg.id ? t('credits.processing') : t('credits.top_up_btn')}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-slate-900">{t('credits.history_title')}</h2>
          {loadingTransactions ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <Card className="p-12 text-center">
              <History className="mx-auto h-12 w-12 text-slate-400" />
              <p className="mt-4 text-slate-600">{t('credits.no_transactions')}</p>
              <p className="mt-2 text-sm text-slate-500">{t('credits.history_empty_desc')}</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <Card key={transaction.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                        {getTransactionIcon(transaction.type)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {transaction.description || transaction.operation || transaction.type}
                        </p>
                        <p className="text-sm text-slate-500">{formatDate(transaction.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p
                          className={`font-semibold ${transaction.type === 'topup' || transaction.type === 'refund' || (transaction.type === 'adjustment' && transaction.amount > 0)
                            ? 'text-green-600'
                            : 'text-red-600'
                            }`}
                        >
                          {(transaction.type === 'topup' || transaction.type === 'refund' || (transaction.type === 'adjustment' && transaction.amount > 0)) ? '+' : ''}
                          {transaction.amount} {t('credits.credits_unit')}
                        </p>
                        {transaction.balance_after !== null && (
                          <p className="text-xs text-slate-500">
                            {t('credits.balance_after').replace('{count}', transaction.balance_after.toString())}
                          </p>
                        )}
                      </div>
                      {transaction.payment_status && getTransactionStatusIcon(transaction.payment_status)}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false)
          setPendingPlanId(null)
        }}
        title={t('credits.confirm_cancel_title')}
      >
        <div className="space-y-6">
          <p className="text-slate-600">
            {t('credits.confirm_cancel_msg')}
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCancelModal(false)
                setPendingPlanId(null)
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmCancel}
            >
              {t('credits.continue')}
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
