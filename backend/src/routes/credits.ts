import { Router, Response, Request } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { CreditsService } from '../services/creditsService.js'
import { SubscriptionService } from '../services/subscriptionService.js'
import { WayForPayService } from '../services/wayforpayService.js'
import { supabase } from '../lib/supabase.js'
import dotenv from 'dotenv'

dotenv.config()

const router = Router()

// Initialize WayForPay (use test credentials by default for testing)
// Test credentials from: https://wiki.wayforpay.com/view/852472
const initializeWayForPay = () => {
  const merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT || 'test_merch_n1'
  const merchantSecretKey = process.env.WAYFORPAY_MERCHANT_SECRET_KEY || 'flk3409refn54t54t*FNJRET'
  const merchantDomainName = process.env.WAYFORPAY_MERCHANT_DOMAIN || 'test.merchant.com'
  
  console.log('[WayForPay] Initializing with merchant account:', merchantAccount)
  console.log('[WayForPay] Using test mode:', merchantAccount === 'test_merch_n1')
  
  WayForPayService.initialize({
    merchantAccount,
    merchantSecretKey,
    merchantDomainName,
    apiUrl: process.env.WAYFORPAY_API_URL || 'https://api.wayforpay.com/api',
  })
}

// Initialize on module load
initializeWayForPay()

/**
 * GET /api/credits
 * Get user's current credits
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const credits = await CreditsService.getUserCredits(userId)
    res.json({ credits, unlimited: credits === null })
  } catch (error: any) {
    console.error('Get credits error:', error)
    res.status(500).json({ error: 'Failed to get credits' })
  }
})

/**
 * GET /api/credits/subscription-status
 * Get user's subscription status
 */
router.get('/subscription-status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const subscription = await SubscriptionService.getUserSubscription(userId)
    const hasSubscription = subscription !== null
    res.json({ hasSubscription, subscription })
  } catch (error: any) {
    console.error('Get subscription status error:', error)
    res.status(500).json({ error: 'Failed to get subscription status' })
  }
})

/**
 * GET /api/credits/plans
 * Get available subscription plans
 */
router.get('/plans', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const plans = await SubscriptionService.getPlans()
    res.json({ plans })
  } catch (error: any) {
    console.error('Get plans error:', error)
    res.status(500).json({ error: 'Failed to get plans' })
  }
})

/**
 * POST /api/credits/subscribe
 * Purchase a subscription plan
 */
router.post('/subscribe', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { planId } = req.body

    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' })
    }

    // Get plan details
    const plan = await SubscriptionService.getPlan(planId)
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' })
    }

    // Get user info for payment
    const { data: user } = await supabase.auth.admin.getUserById(userId)
    if (!user || !user.user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Create unique order reference
    const orderReference = `subscription_${userId}_${Date.now()}`

    // Create pending subscription
    await SubscriptionService.createSubscription(userId, planId, orderReference, 'pending')

    // Create WayForPay purchase request
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    const purchaseResponse = await WayForPayService.createPurchase({
      orderReference,
      amount: parseFloat(plan.price_usd.toString()),
      currency: 'USD',
      productName: `Subscription: ${plan.display_name}`,
      clientAccountId: userId,
      clientEmail: user.user.email || undefined,
      returnUrl: `${baseUrl}/credits?status=success&order=${orderReference}`,
      serviceUrl: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/credits/webhook`,
    })

    if (purchaseResponse.reasonCode !== 0) {
      return res.status(400).json({ 
        error: purchaseResponse.reason || 'Failed to create purchase' 
      })
    }

    res.json({
      orderReference,
      invoiceUrl: purchaseResponse.invoiceUrl,
      qrCode: purchaseResponse.qrCode,
    })
  } catch (error: any) {
    console.error('Top-up error:', error)
    res.status(500).json({ error: error.message || 'Failed to initiate top-up' })
  }
})

/**
 * POST /api/credits/webhook
 * WayForPay payment callback webhook
 * Note: This endpoint does NOT require authentication as it's called by WayForPay
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const callbackData = req.body

    // Verify signature
    if (!WayForPayService.verifyCallback(callbackData)) {
      console.error('[WayForPay] Invalid callback signature')
      return res.status(400).json({ error: 'Invalid signature' })
    }

    const orderReference = callbackData.orderReference
    const transactionStatus = callbackData.transactionStatus

    // Check if this is a subscription or top-up
    const isSubscription = orderReference.startsWith('subscription_')
    
    if (isSubscription) {
      // Handle subscription payment
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('*, user_id')
        .eq('payment_id', orderReference)
        .single()

      if (!subscription) {
        console.error('[WayForPay] Subscription not found:', orderReference)
        return res.status(404).json({ error: 'Subscription not found' })
      }

      const userId = subscription.user_id

      // Update subscription status
      await supabase
        .from('user_subscriptions')
        .update({
          payment_status: transactionStatus === 'Approved' ? 'completed' : 'failed',
        })
        .eq('id', subscription.id)

      // If payment approved, activate subscription
      if (transactionStatus === 'Approved') {
        await SubscriptionService.activateSubscription(userId, orderReference)
      }
    } else {
      // Handle top-up payment (legacy support)
      const { data: transaction } = await supabase
        .from('credit_transactions')
        .select('*, user_id')
        .eq('payment_id', orderReference)
        .eq('type', 'topup')
        .single()

      if (!transaction) {
        console.error('[WayForPay] Transaction not found:', orderReference)
        return res.status(404).json({ error: 'Transaction not found' })
      }

      const userId = transaction.user_id

      // Update transaction status
      await supabase
        .from('credit_transactions')
        .update({
          payment_status: transactionStatus === 'Approved' ? 'completed' : 'failed',
        })
        .eq('id', transaction.id)

      // If payment approved, add credits
      if (transactionStatus === 'Approved') {
        const balanceBefore = await CreditsService.getUserCredits(userId)
        const packageId = transaction.operation?.replace('topup_', '') || ''
        const packageData = await CreditsService.getPackage(packageId)
        
        if (packageData) {
          // Add credits (skip transaction log since we already have one)
          const balanceAfter = await CreditsService.addCredits(
            userId,
            packageData.credits,
            `topup_${packageData.id}`,
            true // Skip transaction log
          )

          // Update the original transaction with final balance and status
          await supabase
            .from('credit_transactions')
            .update({
              balance_after: balanceAfter,
              amount: packageData.credits,
              payment_status: 'completed',
            })
            .eq('id', transaction.id)
        }
      }
    }

    res.json({ status: 'ok' })
  } catch (error: any) {
    console.error('[WayForPay] Webhook error:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

/**
 * GET /api/credits/check-status/:orderReference
 * Check payment status
 */
router.get('/check-status/:orderReference', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { orderReference } = req.params
    const userId = req.userId!

    // Verify transaction belongs to user
    const { data: transaction } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('payment_id', orderReference)
      .eq('user_id', userId)
      .single()

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' })
    }

    // Check status with WayForPay
    const statusResponse = await WayForPayService.checkStatus(orderReference)

    // Update transaction if status changed
    if (statusResponse.orderStatus === 'Approved' && transaction.payment_status !== 'completed') {
      const packageId = transaction.operation?.replace('topup_', '') || ''
      const packageData = await CreditsService.getPackage(packageId)
      
      if (packageData) {
        const balanceBefore = await CreditsService.getUserCredits(userId)
        const balanceAfter = await CreditsService.addCredits(
          userId,
          packageData.credits,
          `topup_${packageData.id}`,
          true // Skip transaction log since we already have one
        )

        await supabase
          .from('credit_transactions')
          .update({
            payment_status: 'completed',
            balance_after: balanceAfter,
            balance_before: balanceBefore,
            amount: packageData.credits,
          })
          .eq('id', transaction.id)
      }
    }

    res.json({
      orderReference: statusResponse.orderReference,
      status: statusResponse.orderStatus,
      amount: statusResponse.amount,
      currency: statusResponse.currency,
    })
  } catch (error: any) {
    console.error('Check status error:', error)
    res.status(500).json({ error: error.message || 'Failed to check status' })
  }
})

/**
 * GET /api/credits/history
 * Get user's credit transaction history
 */
router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    const transactions = await CreditsService.getTransactionHistory(userId, limit, offset)
    res.json({ transactions })
  } catch (error: any) {
    console.error('Get history error:', error)
    res.status(500).json({ error: 'Failed to get transaction history' })
  }
})

export default router

