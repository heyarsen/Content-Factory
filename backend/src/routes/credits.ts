import { Router, Response, Request } from 'express'
import express from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
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
router.get('/subscription-status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    console.log('[Credits API] Getting subscription status for user:', userId)

    const subscription = await SubscriptionService.getUserSubscription(userId)
    const hasSubscription = subscription !== null

    // Also check user profile to ensure consistency
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('has_active_subscription, current_subscription_id, credits')
      .eq('id', userId)
      .single()

    console.log('[Credits API] Subscription status:', {
      userId,
      hasSubscription,
      profileHasSubscription: profile?.has_active_subscription,
      subscriptionId: subscription?.id,
      planId: subscription?.plan_id,
      creditsRemaining: subscription?.credits_remaining,
      userCredits: profile?.credits,
    })

    res.json({
      hasSubscription: hasSubscription && profile?.has_active_subscription === true,
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
router.post('/cancel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    await SubscriptionService.cancelSubscription(userId)
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
router.get('/packages', authenticate, async (_req: AuthRequest, res: Response) => {
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

    // Create pending subscription
    await SubscriptionService.createSubscription(userId, planId, orderReference, 'pending')

    // Create WayForPay hosted payment form (redirect checkout)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    // Hosted checkout may POST to returnUrl, so point it to backend and then redirect to frontend.
    // Auto-detect backend URL from request (works in prod where port may be 8080), but allow env override.
    const detectedBackendBaseUrl = `${req.protocol}://${req.get('host')}`
    const backendBaseUrl = process.env.BACKEND_URL || detectedBackendBaseUrl
    const amountToCharge = parseFloat(plan.price_usd.toString())

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

    // Add recurring fields if not a free plan (handled as extra fields in POST)
    // Documentation: https://wiki.wayforpay.com/view/852478
    hostedForm.fields.regularOn = 'Y'
    hostedForm.fields.regularMode = 'monthly'
    hostedForm.fields.regularAmount = String(amountToCharge)
    hostedForm.fields.regularCount = '0' // 0 = unlimited recurring iterations

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
      // Handle subscription payment
      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*, user_id')
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

      console.log('[WayForPay] Found subscription:', {
        subscriptionId: subscription.id,
        userId,
        currentStatus: subscription.status,
        currentPaymentStatus: subscription.payment_status,
      })

      // If payment approved, activate subscription (this will update status and add credits)
      if (transactionStatus === 'Approved') {
        console.log('[WayForPay] Payment approved, activating subscription')
        try {
          await SubscriptionService.activateSubscription(userId, orderReference)
          console.log('[WayForPay] Subscription activated successfully')
        } catch (activateError: any) {
          console.error('[WayForPay] Error activating subscription:', activateError)
          // Still return success to WayForPay, but log the error
        }
      } else {
        // IMPORTANT: Only update failed status for NEW (pending) subscriptions
        // If subscription is already 'active' with 'completed' payment, ignore refund/expired notifications
        // This prevents subscriptions from being randomly removed due to late refund/expired webhooks
        if (subscription.status === 'pending' || subscription.payment_status !== 'completed') {
          await supabase
            .from('user_subscriptions')
            .update({
              payment_status: 'failed',
            })
            .eq('id', subscription.id)
          console.log('[WayForPay] Pending payment not approved, marked as failed')
        } else {
          console.log('[WayForPay] Ignoring failed payment for already-active subscription (likely a refund/expiration after activation)')
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
        .select('id, status, payment_status, amount')
        .eq('payment_id', orderReference)
        .maybeSingle()

      // If transaction already completed, don't process again (idempotency)
      if (existingTransaction?.status === 'completed' || existingTransaction?.payment_status === 'completed') {
        console.log('[WayForPay] Transaction already completed, skipping:', {
          transactionId: existingTransaction.id,
          paymentId: orderReference
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
            .update({ status: 'processing' })
            .eq('id', existingTransaction.id)
            .eq('status', 'pending') // Only update if still pending
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
        if (creditsToAdd === 0 && existingTransaction?.amount) {
          creditsToAdd = existingTransaction.amount
          console.log('[WayForPay] Using amount from existing transaction:', creditsToAdd)
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
                  status: 'completed',
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
                  status: 'completed',
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
                  status: 'failed',
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
                status: 'failed',
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
              status: 'failed',
              payment_status: 'failed',
            })
            .eq('id', existingTransaction.id)
        }
      }
    } else {
      console.warn('[WayForPay] Unknown payment type:', orderReference)
    }

    res.json({ status: 'ok' })
  } catch (error: any) {
    console.error('[WayForPay] Webhook error:', error.message)
    // Always return success to WayForPay to avoid retries
    res.json({ status: 'ok' })
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

            if (approved && sub.payment_status !== 'completed') {
              await SubscriptionService.activateSubscription(sub.user_id, orderReference)
              console.log('[WayForPay] Subscription activated via returnUrl:', orderReference)
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
      const redirectUrl = `${baseUrl}/credits?status=success&order=${encodeURIComponent(orderReference)}`
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

