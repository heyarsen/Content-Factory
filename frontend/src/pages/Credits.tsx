import { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { useCredits } from '../hooks/useCredits'
import { useNotifications } from '../contexts/NotificationContext'
import { Coins, CheckCircle2, XCircle, Clock, ArrowUpRight, ArrowDownRight, History } from 'lucide-react'
import api from '../lib/api'

interface CreditPackage {
  id: string
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

export function Credits() {
  const { credits, unlimited, loading: creditsLoading, refreshCredits } = useCredits()
  const { addNotification } = useNotifications()
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [loadingPackages, setLoadingPackages] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(true)
  const [activeTab, setActiveTab] = useState<'topup' | 'history'>('topup')

  useEffect(() => {
    loadPackages()
    loadTransactionHistory()
    
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

  const loadPackages = async () => {
    try {
      setLoadingPackages(true)
      const response = await api.get('/api/credits/packages')
      setPackages(response.data.packages || [])
    } catch (error: any) {
      console.error('Failed to load packages:', error)
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load credit packages',
      })
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

  const handlePurchase = async (packageId: string) => {
    try {
      setPurchasing(packageId)
      const response = await api.post('/api/credits/topup', { packageId })
      
      if (response.data.invoiceUrl) {
        // Redirect to WayForPay payment page
        window.location.href = response.data.invoiceUrl
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

  const checkPaymentStatus = async (orderReference: string) => {
    try {
      const response = await api.get(`/api/credits/check-status/${orderReference}`)
      
      if (response.data.status === 'Approved') {
        addNotification({
          type: 'success',
          title: 'Payment Successful',
          message: 'Payment successful! Credits have been added to your account.',
        })
        refreshCredits()
        loadTransactionHistory()
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

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Credits</h1>
            <p className="mt-2 text-slate-600">Manage your credits and view transaction history</p>
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

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('topup')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'topup'
                ? 'border-b-2 border-brand-500 text-brand-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Buy Credits
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'history'
                ? 'border-b-2 border-brand-500 text-brand-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Transaction History
            </div>
          </button>
        </div>

        {/* Top-up Tab */}
        {activeTab === 'topup' && (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Choose a Credit Package</h2>
            {loadingPackages ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {packages.map((pkg) => (
                  <Card key={pkg.id} className="p-6">
                    <div className="flex flex-col">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-slate-900">{pkg.display_name}</h3>
                        {pkg.description && (
                          <p className="mt-1 text-sm text-slate-600">{pkg.description}</p>
                        )}
                      </div>
                      <div className="mb-4 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-900">{pkg.credits}</span>
                        <span className="text-sm text-slate-500">credits</span>
                      </div>
                      <div className="mb-6 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-brand-600">${pkg.price_usd.toFixed(2)}</span>
                        <span className="text-sm text-slate-500">USD</span>
                      </div>
                      <Button
                        onClick={() => handlePurchase(pkg.id)}
                        disabled={purchasing === pkg.id}
                        className="w-full"
                        variant="primary"
                      >
                        {purchasing === pkg.id ? 'Processing...' : 'Buy Now'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
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
        )}
      </div>
    </Layout>
  )
}

