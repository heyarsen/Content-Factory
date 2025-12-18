import { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { useCredits } from '../hooks/useCredits'
import { useNotifications } from '../contexts/NotificationContext'
import { Coins, CheckCircle2, XCircle, Clock, ArrowUpRight, ArrowDownRight, History, Crown, AlertCircle } from 'lucide-react'
import api from '../lib/api'
import { useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()
  const { credits, unlimited, loading: creditsLoading, refreshCredits } = useCredits()
  const { addNotification } = useNotifications()
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
      checkPaymentStatus(orderRef)
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
        title: 'Error',
        message: 'Failed to load subscription plans',
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
      setTransactions(response.data.transactions || [])
    } catch (error: any) {
      console.error('Failed to load transaction history:', error)
    } finally {
      setLoadingTransactions(false)
    }
  }

  const submitWayForPayForm = (paymentUrl: string, fields: Record<string, string>) => {
    // WayForPay hosted checkout expects a POSTed HTML form
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
    try {
      setPurchasing(planId)
      const response = await api.post('/api/credits/subscribe', { planId })
      
      if (response.data.paymentUrl && response.data.paymentFields) {
        submitWayForPayForm(response.data.paymentUrl, response.data.paymentFields)
      } else {
        addNotification({
          type: 'error',
          title: 'Payment Error',
          message: 'Failed to initiate payment',
        })
      }
    } catch (error: any) {
      console.error('Purchase error:', error)
      addNotification({
        type: 'error',
        title: 'Purchase Error',
        message: error.response?.data?.error || 'Failed to initiate purchase',
      })
      setPurchasing(null)
    }
  }

  const handleTopUp = async (packageId: string) => {
    try {
      if (!hasSubscription) {
        addNotification({
          type: 'warning',
          title: 'Subscription Required',
          message: 'You need an active subscription before you can top up credits.',
        })
        return
      }

      setToppingUp(packageId)
      const response = await api.post('/api/credits/topup', { packageId })

      if (response.data.paymentUrl && response.data.paymentFields) {
        submitWayForPayForm(response.data.paymentUrl, response.data.paymentFields)
      } else {
        addNotification({
          type: 'error',
          title: 'Payment Error',
          message: 'Failed to initiate top-up payment',
        })
      }
    } catch (error: any) {
      console.error('Top up error:', error)
      addNotification({
        type: 'error',
        title: 'Top Up Error',
        message: error.response?.data?.error || 'Failed to initiate top-up',
      })
    } finally {
      setToppingUp(null)
    }
  }

  const checkPaymentStatus = async (orderReference: string) => {
    try {
      const response = await api.get(`/api/credits/check-status/${orderReference}`)
      
      // Backend may return either WayForPay orderStatus (e.g. 'Approved') or our normalized 'completed'
      const status = response.data.status
      if (status === 'Approved' || status === 'completed') {
        addNotification({
          type: 'success',
          title: 'Payment Successful',
          message: 'Subscription activated! Credits have been added to your account.',
        })
        refreshCredits()
        loadTransactionHistory()
        loadSubscriptionStatus()
      } else {
        addNotification({
          type: 'info',
          title: 'Payment Processing',
          message: 'Payment is being processed. Please check back in a moment.',
        })
      }
    } catch (error: any) {
      console.error('Status check error:', error)
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
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const currentPlan = plans.find(p => p.id === subscription?.plan_id)

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Credits & Subscription</h1>
            <p className="mt-2 text-slate-600">Manage your subscription and view credit history</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
            <Coins className="h-6 w-6 text-amber-500" />
            <div>
              <p className="text-xs text-slate-500">Current Balance</p>
              <p className="text-2xl font-bold text-slate-900">
                {creditsLoading ? '...' : unlimited ? 'Unlimited' : credits ?? 0}
                {!unlimited && <span className="ml-2 text-sm font-normal text-slate-500">credits</span>}
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
                  <p className="text-sm font-semibold text-slate-700">Active Subscription</p>
                  <p className="text-lg font-bold text-slate-900">{currentPlan?.display_name || 'Subscription'}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {subscription.credits_remaining} credits remaining
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate('/credits')}
                variant="primary"
              >
                Manage Subscription
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6 border-amber-200 bg-amber-50">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-semibold text-slate-900">No Active Subscription</p>
                <p className="text-sm text-slate-600 mt-1">
                  You need an active subscription to use platform features. Choose a plan below to get started.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Subscription Plans */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            {hasSubscription ? 'Change Subscription Plan' : 'Choose a Subscription Plan'}
          </h2>
          {loadingPlans ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => {
                const isCurrentPlan = subscription?.plan_id === plan.id
                return (
                  <Card key={plan.id} className={`p-6 ${isCurrentPlan ? 'border-brand-500 bg-brand-50' : ''}`}>
                    <div className="flex flex-col">
                      {isCurrentPlan && (
                        <div className="mb-3 flex items-center gap-2 text-brand-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs font-semibold uppercase">Current Plan</span>
                        </div>
                      )}
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-slate-900">{plan.display_name}</h3>
                        {plan.description && (
                          <p className="mt-1 text-sm text-slate-600">{plan.description}</p>
                        )}
                      </div>
                      <div className="mb-4 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-900">{plan.credits}</span>
                        <span className="text-sm text-slate-500">credits</span>
                      </div>
                      <div className="mb-6 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-brand-600">${plan.price_usd.toFixed(2)}</span>
                        <span className="text-sm text-slate-500">USD</span>
                      </div>
                      <Button
                        onClick={() => handlePurchase(plan.id)}
                        disabled={purchasing === plan.id || isCurrentPlan}
                        className="w-full"
                        variant={isCurrentPlan ? "ghost" : "primary"}
                      >
                        {isCurrentPlan ? 'Current Plan' : purchasing === plan.id ? 'Processing...' : hasSubscription ? 'Switch Plan' : 'Subscribe Now'}
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
          <h2 className="mb-2 text-xl font-semibold text-slate-900">Top up credits</h2>
          <p className="mb-4 text-sm text-slate-600">
            {hasSubscription
              ? 'Buy additional credits for your active subscription.'
              : 'Top-ups are available after you purchase a subscription.'}
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
                    <div className="text-lg font-bold text-slate-900">{pkg.credits} credits</div>
                    <div className="text-sm text-slate-600">{pkg.description || pkg.display_name}</div>
                    <div className="text-xl font-bold text-brand-600">${pkg.price_usd.toFixed(2)}</div>
                    <Button
                      onClick={() => handleTopUp(pkg.id)}
                      disabled={!hasSubscription || toppingUp === pkg.id}
                      variant={!hasSubscription ? 'ghost' : 'secondary'}
                      className="w-full"
                    >
                      {!hasSubscription ? 'Subscribe first' : toppingUp === pkg.id ? 'Processing...' : 'Top up'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Transaction History</h2>
          {loadingTransactions ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <Card className="p-12 text-center">
              <History className="mx-auto h-12 w-12 text-slate-400" />
              <p className="mt-4 text-slate-600">No transactions yet</p>
              <p className="mt-2 text-sm text-slate-500">Your credit transactions will appear here</p>
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
                          className={`font-semibold ${
                            transaction.type === 'topup' || transaction.type === 'refund'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {transaction.type === 'topup' || transaction.type === 'refund' ? '+' : '-'}
                          {Math.abs(transaction.amount)} credits
                        </p>
                        {transaction.balance_after !== null && (
                          <p className="text-xs text-slate-500">
                            Balance: {transaction.balance_after} credits
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
    </Layout>
  )
}
