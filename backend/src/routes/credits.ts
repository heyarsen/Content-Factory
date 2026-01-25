import { Router, Response, Request } from 'express'
import express from 'express'
import { authenticate, AuthRequest, requireSubscription } from '../middleware/auth.js'
import { CreditsService } from '../services/creditsService.js'
import { SubscriptionService } from '../services/subscriptionService.js'
import { WayForPayService } from '../services/wayforpayService.js'
import { supabase } from '../lib/supabase.js'
import dotenv from 'dotenv'

dotenv.config()

const router = Router()

// Middleware for webhook: accept raw text and try to parse as JSON
// This handles WayForPay sending raw JSON without proper Content-Type
const webhookBodyParser = express.text({ type: '*/*' })

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
    const subscription = await SubscriptionService.getUserSubscription(userId)

    // Check if subscription object has the nested plan
    const planName = (subscription as any)?.plan?.display_name || (subscription as any)?.plan?.name || null

    res.json({
      credits,
      unlimited: credits === null,
      subscription: subscription ? {
        ...subscription,
        plan_name: planName
      } : null
    })
  } catch (error: any) {
    console.error('Get credits error:', error)
    res.status(500).json({ error: 'Failed to get credits' })
  }
})

/**
 * GET /api/credits/subscription-status
 * Get user's subscription status
 */
router.get('/subscription-status', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    console.log('[Credits API] Getting subscription status for user:', userId)

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, has_active_subscription, current_subscription_id, credits')
      .eq('id', userId)
      .single()

    const subscription = await SubscriptionService.getUserSubscription(userId)

    const hasSubscription = (profile?.role === 'admin') ||
      (profile?.has_active_subscription === true) ||
      (subscription !== null)

    console.log('[Credits API] Subscription status:', {
      userId,
      hasSubscription,
      role: profile?.role,
      profileHasSubscription: profile?.has_active_subscription,
      subscriptionId: subscription?.id,
      planId: subscription?.plan_id,
      creditsRemaining: (subscription as any)?.credits_remaining,
      userCredits: profile?.credits,
    })

    res.json({
      hasSubscription,
      subscription
    })
  } catch (error: any) {
    console.error('[Credits API] Get subscription status error:', error)
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
 * POST /api/credits/cancel
 * Cancel the active subscription
 */
router.post('/cancel', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { RecurringPaymentService } = await import('../services/recurringPaymentService.js')
    await RecurringPaymentService.cancelSubscription(userId)
    res.json({ message: 'Subscription cancelled successfully' })
  } catch (error: any) {
    console.error('Cancel subscription error:', error)
    res.status(500).json({ error: error.message || 'Failed to cancel subscription' })
  }
})

/**
 * GET /api/credits/packages
 * Get available credit top-up packages
 */
router.get('/packages', authenticate, requireSubscription, async (_req: AuthRequest, res: Response) => {
  try {
    const packages = await CreditsService.getCreditPackages()
    res.json({ packages })
  } catch (error: any) {
    console.error('Get packages error:', error)
    res.status(500).json({ error: 'Failed to get packages' })
  }
})

/**
 * POST /api/credits/topup
 * Purchase a credit package (requires active subscription)
 */
router.post('/topup', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { packageId } = req.body

    if (!packageId) {
      return res.status(400).json({ error: 'Package ID is required' })
    }

    // Require active subscription before allowing topups
    const hasSub = await SubscriptionService.hasActiveSubscription(userId)
    if (!hasSub) {
      return res.status(402).json({ error: 'You need an active subscription before you can top up credits.' })
    }

    const pkg = await CreditsService.getPackage(packageId)
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' })
    }

    // Get user info for payment
    const { data: user } = await supabase.auth.admin.getUserById(userId)
    if (!user || !user.user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const orderReference = `topup_${userId}_${Date.now()}`

    const balanceBefore = await CreditsService.getUserCredits(userId)
    await CreditsService.createTransaction(
      userId,
      'topup',
      pkg.credits,
      balanceBefore,
      balanceBefore,
      `topup_${pkg.id}`,
      `Top up ${pkg.credits} credits (${pkg.description || pkg.display_name || ''})`,
      orderReference,
      'pending'
    )

    // Create hosted payment form
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    // Hosted checkout may POST to returnUrl, so point it to backend and then redirect to frontend.
    // Auto-detect backend URL from request (works in prod where port may be 8080), but allow env override.
    const detectedBackendBaseUrl = `${req.protocol}://${req.get('host')}`
    const backendBaseUrl = process.env.BACKEND_URL || detectedBackendBaseUrl
    // Use test price for topups
    const amountToCharge = 0.1

    const hostedForm = WayForPayService.createHostedPaymentForm({
      orderReference,
      amount: amountToCharge,
      currency: 'USD',
      productName: `Credits: ${pkg.display_name}`,
      clientAccountId: userId,
      clientEmail: user.user.email || undefined,
      // Include order reference in query so we can redirect even if WayForPay posts multipart/form-data
      returnUrl: `${backendBaseUrl}/api/credits/return?order=${encodeURIComponent(orderReference)}`,
      // Webhook must be reachable by WayForPay; prefer env override, otherwise use detected backend URL
      serviceUrl: `${process.env.BACKEND_URL || backendBaseUrl}/api/credits/webhook`,
    })

    res.json({
      orderReference,
      paymentUrl: hostedForm.paymentUrl,
      paymentFields: hostedForm.fields,
    })
  } catch (error: any) {
    console.error('Topup error:', error)
    res.status(500).json({ error: error.message || 'Failed to initiate top-up' })
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

    // Cancel any existing active subscription on Wayforpay before creating a new one
    try {
      const { RecurringPaymentService } = await import('../services/recurringPaymentService.js')
      await RecurringPaymentService.cancelSubscription(userId)
      console.log('[Credits API] Existing subscription cancelled (if any) before new purchase')
    } catch (cancelError) {
      console.warn('[Credits API] Non-critical error while cancelling existing subscription:', cancelError)
      // We continue as the user might not have a wayforpay record yet or it might be already cancelled
    }

    // Create pending subscription
    await SubscriptionService.createSubscription(userId, planId, orderReference, 'pending')

    // Create WayForPay hosted payment form (redirect checkout)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    // Hosted checkout may POST to returnUrl, so point it to backend and then redirect to frontend.
    // Auto-detect backend URL from request (works in prod where port may be 8080), but allow env override.
    const detectedBackendBaseUrl = `${req.protocol}://${req.get('host')}`
    const backendBaseUrl = process.env.BACKEND_URL || detectedBackendBaseUrl
    // Use test price for subscriptions
    const amountToCharge = 0.1

    // Block free plan from this route - it should be handled via the cancel/switch logic on frontend
    if (planId === 'plan_free') {
      return res.status(400).json({ error: 'Free plan cannot be subscribed to. Use cancellation to switch to free plan.' })
    }

    const hostedForm = WayForPayService.createHostedPaymentForm({
      orderReference,
      amount: amountToCharge,
      currency: 'USD',
      productName: `Subscription: ${plan.display_name}`,
      clientAccountId: userId,
      clientEmail: user.user.email || undefined,
      // IMPORTANT: WayForPay hosted checkout may POST to returnUrl. A SPA route can't handle POST reliably.
      // Route returnUrl to backend and then 302 redirect to frontend with query params.
      // Include order reference in query so we can redirect even if WayForPay posts multipart/form-data
      returnUrl: `${backendBaseUrl}/api/credits/return?order=${encodeURIComponent(orderReference)}`,
      // Webhook must be reachable by WayForPay; prefer env override, otherwise use detected backend URL
      serviceUrl: `${process.env.BACKEND_URL || backendBaseUrl}/api/credits/webhook`,
    })

    // Add recurring fields for subscription payments
    // Documentation: https://wiki.wayforpay.com/en/view/852102
    hostedForm.fields.regularOn = '1' // When passing value = 1, the checkbox "make payment regular" is enabled, the regularAmount field is locked for editing
    hostedForm.fields.regularMode = 'monthly' // Frequency of regular charges
    hostedForm.fields.regularAmount = String(amountToCharge) // Amount of regular payment
    hostedForm.fields.regularBehavior = 'preset' // So that the client cannot edit the parameters of the regular payment on the payment page
    // Set dateNext to 1 month from now for first regular payment
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    hostedForm.fields.dateNext = nextMonth.toLocaleDateString('en-GB').replace(/\//g, '.') // Format: DD.MM.YYYY
    // Set dateEnd to very far future (100 years from now) for ongoing subscription
    const expirationDate = new Date()
    expirationDate.setFullYear(expirationDate.getFullYear() + 100)
    hostedForm.fields.dateEnd = expirationDate.toLocaleDateString('en-GB').replace(/\//g, '.') // Format: DD.MM.YYYY

    res.json({
      orderReference,
      paymentUrl: hostedForm.paymentUrl,
      paymentFields: hostedForm.fields,
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
router.post('/webhook', webhookBodyParser, async (req: any, res: Response) => {
  try {
    let callbackData: any = {}

    // Try multiple ways to extract the callback data since WayForPay might send it differently
    if (typeof req.body === 'string' && req.body.length > 0) {
      // Body is a raw string, try to parse as JSON
      try {
        callbackData = JSON.parse(req.body)
        console.log('[WayForPay] Parsed callback data from raw string body')
      } catch (e) {
        console.warn('[WayForPay] Failed to parse body as JSON string:', (e as any).message)
        callbackData = {}
      }
    } else if (typeof req.body === 'object' && req.body !== null) {
      // Body is already an object
      callbackData = req.body

      // If it's an object with a single key that looks like JSON, try to parse it
      const keys = Object.keys(callbackData)
      if (keys.length === 1 && keys[0].startsWith('{')) {
        try {
          callbackData = JSON.parse(keys[0])
          console.log('[WayForPay] Parsed callback data from first key')
        } catch (e) {
          console.warn('[WayForPay] Failed to parse first key as JSON:', (e as any).message)
        }
      }
    }

    console.log('[WayForPay] Webhook received:', {
      orderReference: callbackData.orderReference,
      transactionStatus: callbackData.transactionStatus,
      amount: callbackData.amount,
      currency: callbackData.currency,
    })

    // Verify signature (now more lenient)
    if (callbackData.merchantSignature && !WayForPayService.verifyCallback(callbackData)) {
      console.error('[WayForPay] Invalid callback signature', {
        orderReference: callbackData.orderReference,
      })
      // Continue processing even if signature is invalid (for debugging)
    }

    const orderReference = callbackData.orderReference
    const transactionStatus = callbackData.transactionStatus

    if (!orderReference) {
      console.error('[WayForPay] No orderReference in webhook data')
      return res.json({ status: 'ok' })
    }

    // Check if this is a subscription or top-up
    const isSubscription = orderReference.startsWith('subscription_')
    const isTopup = orderReference.startsWith('topup_')

    console.log('[WayForPay] Processing webhook:', {
      orderReference,
      transactionStatus,
      isSubscription,
      isTopup,
    })

    if (isSubscription) {
      // Handle subscription payment (initial or renewal)
      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*, user_id, plan:subscription_plans(*)')
        .eq('payment_id', orderReference)
        .maybeSingle()

      if (subError) {
        console.error('[WayForPay] Error fetching subscription:', subError)
        return res.json({ status: 'ok' })
      }

      if (!subscription) {
        console.error('[WayForPay] Subscription not found:', orderReference)
        return res.json({ status: 'ok' })
      }

      const userId = subscription.user_id
      const plan = subscription.plan as any

      console.log('[WayForPay] Found subscription:', {
        subscriptionId: subscription.id,
        userId,
        currentStatus: subscription.status,
        currentPaymentStatus: subscription.payment_status,
        cancelledAt: subscription.cancelled_at,
        transactionStatus,
      })

      // Check for duplicate payment processing FIRST (before any other logic)
      const { data: existingPayment } = await supabase
        .from('subscription_payment_history')
        .select('*')
        .eq('payment_id', orderReference)
        .eq('transaction_status', 'Approved')
        .maybeSingle()

      if (existingPayment) {
        console.log('[WayForPay] Duplicate payment detected, skipping:', {
          orderReference,
          existingPaymentId: existingPayment.id,
          processedAt: existingPayment.created_at,
        })
        return res.json({ status: 'duplicate', message: 'Payment already processed' })
      }

      // Determine if this is a renewal vs initial payment
      // A true renewal must have:
      // 1. Subscription already active and completed BEFORE this webhook
      // 2. Created at least 15 days ago (to avoid treating initial payment as renewal)
      const subscriptionAge = Date.now() - new Date(subscription.created_at).getTime()
      const daysSinceCreation = subscriptionAge / (1000 * 60 * 60 * 24)

      const isRenewal = subscription.status === 'active' &&
        subscription.payment_status === 'completed' &&
        !subscription.cancelled_at && // Exclude cancelled subscriptions
        daysSinceCreation >= 15 // Only treat as renewal if subscription is at least 15 days old

      // Check if this payment has already been processed
      if (subscription.payment_status === 'completed' && subscription.status === 'active') {
        console.log('[WayForPay] Payment already processed, ignoring duplicate webhook:', {
          orderReference,
          subscriptionId: subscription.id,
          currentStatus: subscription.status,
          currentPaymentStatus: subscription.payment_status,
          daysSinceCreation,
        })
        return res.json({ message: 'Payment already processed' })
      }

      // Reject payments for cancelled subscriptions
      if (subscription.cancelled_at) {
        console.log('[WayForPay] Rejecting payment for cancelled subscription:', {
          subscriptionId: subscription.id,
          userId,
          cancelledAt: subscription.cancelled_at,
          transactionStatus,
        })

        // Record rejected payment in history
        await supabase.rpc('record_subscription_payment', {
          p_subscription_id: subscription.id,
          p_payment_id: orderReference,
          p_payment_type: 'renewal',
          p_transaction_status: 'Rejected',
          p_amount: parseFloat(callbackData.amount) || 0.1,
          p_currency: callbackData.currency || 'USD',
          p_error_message: 'Subscription was cancelled, payment rejected',
          p_metadata: {
            orderReference,
            transactionStatus,
            cancelledAt: subscription.cancelled_at,
            rejectionReason: 'subscription_cancelled',
          }
        })

        return res.json({ status: 'rejected', reason: 'Subscription cancelled' })
      }

      if (isRenewal) {
        console.log('[WayForPay] Processing monthly renewal payment:', {
          subscriptionId: subscription.id,
          transactionStatus,
          daysSinceCreation: Math.round(daysSinceCreation * 100) / 100,
        })
      } else {
        console.log('[WayForPay] Processing initial subscription payment:', {
          subscriptionId: subscription.id,
          transactionStatus,
          daysSinceCreation: Math.round(daysSinceCreation * 100) / 100,
          currentStatus: subscription.status,
          currentPaymentStatus: subscription.payment_status,
        })
      }

      // Handle payment status according to WayForPay documentation
      // Valid statuses: Approved, Declined, Expired, Refunded, InProcessing, WaitingAuthComplete, Pending
      const isApproved = transactionStatus === 'Approved'
      const isDeclined = transactionStatus === 'Declined'
      const isExpired = transactionStatus === 'Expired'
      const isRefunded = transactionStatus === 'Refunded' || transactionStatus === 'Voided'
      const isFailed = isDeclined || isExpired || isRefunded

      if (isApproved) {
        console.log('[WayForPay] Payment approved, processing subscription')
        try {
          const { CreditsService } = await import('../services/creditsService.js')
          let creditsBefore = null
          let creditsAfter = null
          let creditsAdded = null

          if (isRenewal) {
            // Handle successful renewal - burn all credits and add new ones based on subscription plan
            console.log('[WayForPay] Renewal approved, burning all credits and adding new subscription credits')

            creditsBefore = await CreditsService.getUserCredits(userId)

            // Burn all existing credits (from previous subscription + top-ups)
            await CreditsService.setCredits(userId, 0, `subscription_renewal_burn_${plan.id}_${Date.now()}`)

            // Add credits equal to the plan's credit allocation (NOT the payment amount)
            // Ensure planCredits is an integer to prevent database errors
            const planCredits = Math.round(Number(plan.credits) || 0)
            creditsAfter = await CreditsService.setCredits(userId, planCredits, `subscription_renewal_${plan.id}_${Date.now()}`)
            creditsAdded = planCredits

            console.log('[WayForPay] Renewal credits processed (burn all + add plan):', {
              userId,
              planCredits,
              balanceBefore: creditsBefore,
              balanceAfter: creditsAfter,
              creditsBurned: creditsBefore, // All previous credits burned
            })

            // Update subscription with renewal info
            await supabase
              .from('user_subscriptions')
              .update({
                payment_status: 'completed',
                credits_included: creditsAdded, // Use plan credit allocation
                credits_remaining: creditsAfter,
                credits_burned: creditsBefore, // Track all credits burned
                updated_at: new Date().toISOString(),
              })
              .eq('id', subscription.id)

            // Update user profile to ensure sync
            await supabase
              .from('user_profiles')
              .update({
                has_active_subscription: true,
                current_subscription_id: subscription.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', userId)

            console.log('[WayForPay] Subscription renewal processed successfully')
          } else {
            // Handle initial subscription activation
            creditsBefore = await CreditsService.getUserCredits(userId)

            // Check if user has had any previous subscriptions (cancelled or completed)
            const { data: previousSubscriptions } = await supabase
              .from('user_subscriptions')
              .select('id, status, created_at')
              .eq('user_id', userId)
              .neq('id', subscription.id) // Exclude current subscription
              .limit(1)

            const isFirstEverSubscription = !previousSubscriptions || previousSubscriptions.length === 0

            if (isFirstEverSubscription) {
              // First subscription ever - preserve top-up credits
              const topupCredits = await CreditsService.getTopupCredits(userId)
              const currentCredits = creditsBefore ?? 0
              const subscriptionCreditsToBurn = Math.max(0, currentCredits - topupCredits)

              // Burn only subscription credits, preserve top-up credits
              if (subscriptionCreditsToBurn > 0) {
                await CreditsService.setCredits(userId, topupCredits, `subscription_burn_previous_${plan.id}`)
              }

              // Add credits equal to the plan's credit allocation
              const planCredits = Math.round(Number(plan.credits) || 0)
              await SubscriptionService.activateSubscription(userId, orderReference)
              creditsAfter = await CreditsService.setCredits(userId, topupCredits + planCredits, `subscription_initial_${plan.id}`)
              creditsAdded = planCredits

              console.log('[WayForPay] First subscription activated with preserved top-up credits:', {
                userId,
                planCredits,
                topupCredits,
                balanceBefore: currentCredits,
                balanceAfter: creditsAfter,
                subscriptionCreditsBurned: subscriptionCreditsToBurn,
                topupCreditsPreserved: topupCredits,
                isFirstEverSubscription,
              })
            } else {
              // Not the first subscription - burn all credits (user cancelled before)
              console.log('[WayForPay] Not first subscription, burning all credits:', {
                userId,
                previousSubscriptionsCount: previousSubscriptions?.length || 0,
              })

              // Burn all existing credits (from previous subscription + top-ups)
              await CreditsService.setCredits(userId, 0, `subscription_burn_all_${plan.id}`)

              // Add credits equal to the plan's credit allocation
              const planCredits = Math.round(Number(plan.credits) || 0)
              await SubscriptionService.activateSubscription(userId, orderReference)
              creditsAfter = await CreditsService.setCredits(userId, planCredits, `subscription_initial_${plan.id}`)
              creditsAdded = planCredits

              console.log('[WayForPay] Subscription activated with all credits burned:', {
                userId,
                planCredits,
                balanceBefore: creditsBefore,
                balanceAfter: creditsAfter,
                creditsBurned: creditsBefore,
                isFirstEverSubscription: false,
              })
            }
          }

          // Record payment history
          await supabase.rpc('record_subscription_payment', {
            p_subscription_id: subscription.id,
            p_payment_id: orderReference,
            p_payment_type: isRenewal ? 'renewal' : 'initial',
            p_transaction_status: 'Approved',
            p_amount: parseFloat(callbackData.amount) || 0.1,
            p_currency: callbackData.currency || 'USD',
            p_credits_before: creditsBefore,
            p_credits_after: creditsAfter,
            p_credits_added: creditsAdded,
            p_error_message: null,
            p_metadata: {
              orderReference,
              transactionStatus,
              merchantAccount: callbackData.merchantAccount,
              authCode: callbackData.authCode,
              cardPan: callbackData.cardPan,
              processingDate: new Date().toISOString(),
              creditsBurned: isRenewal ? null : 'all_previous', // Only for initial subscriptions
              creditsAdded: creditsAdded, // Plan credit allocation
              planCredits: plan.credits, // Track plan's intended credit amount
              paymentAmount: parseFloat(callbackData.amount) || 0.1, // Track what user actually paid
            }
          })

          console.log('[WayForPay] Payment history recorded successfully')
        } catch (activateError: any) {
          console.error('[WayForPay] Error processing subscription:', activateError)

          // Record failed payment history
          try {
            await supabase.rpc('record_subscription_payment', {
              p_subscription_id: subscription.id,
              p_payment_id: orderReference,
              p_payment_type: isRenewal ? 'renewal' : 'initial',
              p_transaction_status: 'Approved',
              p_amount: parseFloat(callbackData.amount) || 0.1,
              p_currency: callbackData.currency || 'USD',
              p_error_message: activateError.message,
              p_metadata: {
                orderReference,
                transactionStatus,
                error: 'processing_failed',
                processingDate: new Date().toISOString()
              }
            })
          } catch (historyError: any) {
            console.error('[WayForPay] Failed to record payment history:', historyError)
          }
        }
      } else {
        // Handle declined/failed payment according to WayForPay documentation
        console.log('[WayForPay] Payment declined/failed:', {
          transactionStatus,
          isDeclined,
          isExpired,
          isRefunded,
          isRenewal,
          subscriptionId: subscription.id,
        })

        try {
          const { CreditsService } = await import('../services/creditsService.js')
          let creditsBefore = null
          let creditsAfter = null

          // Terminal failure statuses from WayForPay
          const terminalFailures = ['Declined', 'Expired', 'Refunded', 'Voided']
          const isTerminalFailure = terminalFailures.includes(transactionStatus)

          if (isRenewal && isTerminalFailure) {
            // For renewals: cancel subscription and burn credits on terminal failure
            console.log(`[WayForPay] Renewal payment ${transactionStatus}, cancelling subscription and burning credits`)

            creditsBefore = await CreditsService.getUserCredits(userId)

            // Cancel subscription
            await supabase
              .from('user_subscriptions')
              .update({
                status: 'cancelled',
                payment_status: 'failed',
                cancelled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', subscription.id)

            // Update user profile
            await supabase
              .from('user_profiles')
              .update({
                has_active_subscription: false,
                current_subscription_id: null
              })
              .eq('id', userId)

            // Burn all credits
            await CreditsService.setCredits(userId, 0, `subscription_renewal_failed_${transactionStatus}_${plan.id}_${Date.now()}`)
            creditsAfter = 0

            console.log(`[WayForPay] Subscription cancelled and credits burned due to ${transactionStatus}`)
          } else if (isRenewal) {
            // Renewal is not a terminal failure yet (e.g. InProcessing, WaitingAuthComplete)
            console.log(`[WayForPay] Renewal payment status: ${transactionStatus}, no cancellation yet`)
          } else {
            // For initial payments: only update status if still pending and it's a failure
            if (isFailed && (subscription.status === 'pending' || subscription.payment_status !== 'completed')) {
              await supabase
                .from('user_subscriptions')
                .update({
                  payment_status: 'failed',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', subscription.id)
              console.log('[WayForPay] Pending initial payment failed activation')
            } else {
              console.log(`[WayForPay] Ignoring ${transactionStatus} for initial activation (already active or non-failure)`)
            }
          }

          // Record failed payment history
          await supabase.rpc('record_subscription_payment', {
            p_subscription_id: subscription.id,
            p_payment_id: orderReference,
            p_payment_type: isRenewal ? 'renewal' : 'initial',
            p_transaction_status: transactionStatus,
            p_amount: parseFloat(callbackData.amount) || 0.1,
            p_currency: callbackData.currency || 'USD',
            p_credits_before: creditsBefore,
            p_credits_after: creditsAfter,
            p_credits_added: null,
            p_error_message: `Payment ${transactionStatus}: ${callbackData.reason || 'Unknown reason'}`,
            p_metadata: {
              orderReference,
              transactionStatus,
              merchantAccount: callbackData.merchantAccount,
              authCode: callbackData.authCode,
              cardPan: callbackData.cardPan,
              reasonCode: callbackData.reasonCode,
              reason: callbackData.reason,
              processingDate: new Date().toISOString()
            }
          })

          console.log('[WayForPay] Failed payment history recorded')
        } catch (cancelError: any) {
          console.error('[WayForPay] Error handling failed payment:', cancelError)
        }
      }
    } else if (isTopup) {
      // Handle top-up payment
      console.log('[WayForPay] Processing topup for:', orderReference)

      // Extract user ID from orderReference (format: topup_userId_timestamp)
      const parts = orderReference.split('_')
      if (parts.length < 3) {
        console.error('[WayForPay] Invalid topup reference format:', orderReference)
        return res.json({ status: 'ok' })
      }

      const userId = parts[1]

      console.log('[WayForPay] Topup user ID:', userId, 'Status:', transactionStatus)

      // Check if transaction already exists and lock it
      const { data: existingTransaction, error: fetchError } = await supabase
        .from('credit_transactions')
        .select('id, payment_status, amount')
        .eq('payment_id', orderReference)
        .maybeSingle()

      if (fetchError) {
        console.error('[WayForPay] Error fetching existing transaction:', {
          orderReference,
          fetchError
        })
      } else {
        console.log('[WayForPay] Transaction lookup result:', {
          orderReference,
          found: !!existingTransaction,
          transaction: existingTransaction
        })
      }

      // If transaction already completed, don't process again (idempotency)
      if (existingTransaction?.payment_status === 'completed' || existingTransaction?.payment_status === 'processing') {
        console.log('[WayForPay] Transaction already completed or processing, skipping:', {
          transactionId: existingTransaction.id,
          paymentId: orderReference,
          paymentStatus: existingTransaction.payment_status
        })
        return res.json({ status: 'ok' })
      }

      // If payment approved, add credits immediately
      if (transactionStatus === 'Approved') {
        console.log('[WayForPay] Topup payment approved, adding credits immediately')

        // CRITICAL: Atomically mark transaction as processing before adding credits
        // This prevents race conditions where multiple webhook calls process the same topup
        if (existingTransaction) {
          const { data: updated, error: updateError } = await supabase
            .from('credit_transactions')
            .update({ payment_status: 'processing' })
            .eq('id', existingTransaction.id)
            .eq('payment_status', 'pending') // Only update if still pending
            .select('id')
            .maybeSingle()

          if (!updated) {
            console.log('[WayForPay] Transaction is already being processed or completed, skipping')
            return res.json({ status: 'ok' })
          }
        }

        // Find the package by amount from callback
        const amount = parseFloat(callbackData.amount) || 0
        console.log('[WayForPay] Payment amount:', amount)

        // Try to find matching package from database by price
        const { data: matchingPackage } = await supabase
          .from('credit_packages')
          .select('credits, price_usd')
          .eq('is_active', true)
          .order('price_usd', { ascending: true })
          .limit(10)

        let creditsToAdd = 0

        if (matchingPackage && matchingPackage.length > 0) {
          // Find closest matching package by price (with 10% tolerance)
          const tolerance = amount * 0.1
          const closestPackage = matchingPackage.find(pkg => {
            const pkgPrice = parseFloat(pkg.price_usd.toString())
            return Math.abs(pkgPrice - amount) <= tolerance
          })

          if (closestPackage) {
            creditsToAdd = closestPackage.credits
            console.log('[WayForPay] Matched package by price:', {
              amount,
              packagePrice: closestPackage.price_usd,
              credits: creditsToAdd
            })
          }
        }

        // Fallback: use the amount from the existing transaction
        if (creditsToAdd === 0) {
          if (existingTransaction?.amount) {
            creditsToAdd = existingTransaction.amount
            console.log('[WayForPay] Using credits from existing transaction:', {
              transactionId: existingTransaction.id,
              credits: creditsToAdd
            })
          } else {
            console.warn('[WayForPay] No existing transaction with amount found:', {
              existingTransaction: existingTransaction ? {
                id: existingTransaction.id,
                payment_status: existingTransaction.payment_status,
                amount: existingTransaction.amount
              } : null
            })
          }
        }

        if (creditsToAdd > 0) {
          try {
            const balanceBefore = await CreditsService.getUserCredits(userId)
            const balanceAfter = await CreditsService.addCredits(
              userId,
              creditsToAdd,
              `topup_payment_${orderReference}`,
              false // Create transaction log
            )

            console.log('[WayForPay] Credits added successfully:', {
              userId,
              creditsAdded: creditsToAdd,
              balanceBefore,
              balanceAfter,
            })

            // Update or create transaction record
            if (existingTransaction) {
              await supabase
                .from('credit_transactions')
                .update({
                  payment_status: 'completed',
                  balance_after: balanceAfter,
                })
                .eq('id', existingTransaction.id)
            } else {
              // Create new transaction record
              await supabase
                .from('credit_transactions')
                .insert({
                  user_id: userId,
                  type: 'topup',
                  amount: creditsToAdd,
                  balance_before: balanceBefore,
                  balance_after: balanceAfter,
                  payment_id: orderReference,
                  payment_status: 'completed',
                })
            }
          } catch (creditsError: any) {
            console.error('[WayForPay] Error adding credits:', creditsError)
            // Mark as failed if credit addition failed
            if (existingTransaction) {
              await supabase
                .from('credit_transactions')
                .update({
                  payment_status: 'failed',
                })
                .eq('id', existingTransaction.id)
            }
            // Still return success to WayForPay so it doesn't retry
          }
        } else {
          console.warn('[WayForPay] Could not determine credits to add, amount:', amount)
          // Mark as failed since we couldn't find credits to add
          if (existingTransaction) {
            await supabase
              .from('credit_transactions')
              .update({
                payment_status: 'failed',
              })
              .eq('id', existingTransaction.id)
          }
        }
      } else {
        // Payment not approved, mark transaction as failed
        console.log('[WayForPay] Topup payment not approved:', transactionStatus)

        if (existingTransaction) {
          await supabase
            .from('credit_transactions')
            .update({
              payment_status: 'failed',
            })
            .eq('id', existingTransaction.id)
        }
      }
    } else {
      console.warn('[WayForPay] Unknown payment type:', orderReference)
    }

    // Build and send acknowledgement response to WayForPay
    const responseData = WayForPayService.buildWebhookResponse(orderReference)
    console.log('[WayForPay] Sending webhook acknowledgement:', responseData)
    res.json(responseData)
  } catch (error: any) {
    console.error('[WayForPay] Webhook error:', error.message)
    // Even on error, try to acknowledge if we have an order reference
    const orderReference = req.body?.orderReference || req.query?.orderReference
    if (orderReference) {
      return res.json(WayForPayService.buildWebhookResponse(orderReference))
    }
    res.json({ status: 'error', message: error.message })
  }
})

/**
 * GET/POST /api/credits/return
 * WayForPay returns the user back to returnUrl. In hosted checkout this can be a POST.
 * A SPA/static host often cannot handle POST to a route, so we terminate the POST here
 * and redirect the browser to the frontend with query params (GET).
 */
router.all('/return', async (req: Request, res: Response) => {
  try {
    // Redirect back to frontend as a GET. In many deployments, frontend is served by this same server.
    // Prefer explicit FRONTEND_URL, otherwise use detected origin from this request (host/port).
    const detectedOrigin = `${req.protocol}://${req.get('host')}`
    const baseUrl = process.env.FRONTEND_URL || detectedOrigin
    const orderReference =
      (req.body && (req.body.orderReference || req.body.order_reference)) ||
      (req.query && (req.query.orderReference || req.query.order_reference || req.query.order))

    const transactionStatus =
      (req.body && (req.body.transactionStatus || req.body.transaction_status)) ||
      (req.query && (req.query.transactionStatus || req.query.transaction_status))

    console.log('[WayForPay] ReturnUrl hit:', {
      method: req.method,
      orderReference,
      transactionStatus,
    })

    if (typeof orderReference === 'string' && orderReference.length > 0) {
      // Best-effort activation right here to avoid relying on webhook (often not reachable) and
      // to avoid requiring frontend auth for check-status.
      try {
        if (orderReference.startsWith('subscription_')) {
          const { data: sub } = await supabase
            .from('user_subscriptions')
            .select('id, user_id, status, payment_status')
            .eq('payment_id', orderReference)
            .maybeSingle()

          if (sub) {
            const statusResp = await WayForPayService.checkStatus(orderReference)
            const approved =
              statusResp?.orderStatus === 'Approved' ||
              statusResp?.transactionStatus === 'Approved' ||
              statusResp?.transactionStatus === 'approved'

            console.log('[WayForPay] ReturnUrl activation check:', {
              orderReference,
              subscriptionId: sub.id,
              currentStatus: sub.status,
              currentPaymentStatus: sub.payment_status,
              approved,
              orderStatus: (statusResp as any)?.orderStatus,
              transactionStatus: (statusResp as any)?.transactionStatus,
            })

            // Handle successful payment
            if (approved && sub.payment_status !== 'completed') {
              await SubscriptionService.activateSubscription(sub.user_id, orderReference)
              console.log('[WayForPay] Subscription activated via returnUrl:', orderReference)
            }
            // Handle cancelled/failed payment
            else if (!approved && sub.payment_status === 'pending') {
              const failedStatus = (statusResp as any)?.transactionStatus || 'failed'
              await supabase
                .from('user_subscriptions')
                .update({
                  status: 'failed',
                  payment_status: 'failed',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', sub.id)

              console.log('[WayForPay] Subscription marked as failed via returnUrl:', {
                orderReference,
                subscriptionId: sub.id,
                failedStatus,
              })
            }
          } else {
            console.warn('[WayForPay] No subscription found for returnUrl orderReference:', orderReference)
          }
        }
      } catch (activationError: any) {
        console.error('[WayForPay] ReturnUrl activation error:', activationError)
        // Continue redirect regardless
      }

      // We always redirect as GET so frontend can show status and refresh state.
      // Determine status based on transaction status
      let status = 'success'
      if (transactionStatus && ['Declined', 'Expired', 'Refunded', 'Voided', 'failed', 'cancelled'].includes(String(transactionStatus))) {
        status = 'failed'
      }
      const redirectUrl = `${baseUrl}/credits?status=${status}&order=${encodeURIComponent(orderReference)}`
      return res.redirect(302, redirectUrl)
    }

    return res.redirect(302, `${baseUrl}/credits?status=success`)
  } catch (error: any) {
    console.error('[WayForPay] ReturnUrl handler error:', error)
    return res.status(500).send('Return handler failed')
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

    // Check status with WayForPay
    const statusResponse = await WayForPayService.checkStatus(orderReference)

    // Check if this is a subscription or top-up
    const isSubscription = orderReference.startsWith('subscription_')

    if (isSubscription) {
      // Handle subscription status check
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('payment_id', orderReference)
        .eq('user_id', userId)
        .maybeSingle()

      if (!subscription) {
        console.log('[Credits API] Subscription not found for order:', orderReference)
        return res.status(404).json({ error: 'Subscription not found' })
      }

      console.log('[Credits API] Checking subscription status:', {
        orderReference,
        orderStatus: statusResponse.orderStatus,
        currentPaymentStatus: subscription.payment_status,
        currentSubscriptionStatus: subscription.status,
      })

      if (statusResponse.orderStatus === 'Approved' && subscription.payment_status !== 'completed') {
        await SubscriptionService.activateSubscription(userId, orderReference)

        // Fetch updated subscription after activation
        const { data: updatedSub } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('payment_id', orderReference)
          .single()

        const credits = await CreditsService.getUserCredits(userId)

        return res.json({
          status: statusResponse.orderStatus,
          subscription: updatedSub,
          credits,
          completed: true
        })
      }

      const credits = await CreditsService.getUserCredits(userId)
      return res.json({
        status: statusResponse.orderStatus,
        subscription,
        credits,
        completed: subscription.payment_status === 'completed'
      })
    } else {
      // Handle top-up status check
      const { data: transaction } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('payment_id', orderReference)
        .eq('user_id', userId)
        .maybeSingle()

      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' })
      }

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

          return res.json({
            status: statusResponse.orderStatus,
            credits: balanceAfter,
            completed: true
          })
        }
      }

      const credits = await CreditsService.getUserCredits(userId)
      return res.json({
        status: statusResponse.orderStatus,
        credits,
        completed: transaction.payment_status === 'completed'
      })
    }
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

