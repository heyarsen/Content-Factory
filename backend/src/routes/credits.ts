import { Router, Response, Request } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { CreditsService } from '../services/creditsService.js'
import { WayForPayService } from '../services/wayforpayService.js'
import { supabase } from '../lib/supabase.js'
import dotenv from 'dotenv'

dotenv.config()

const router = Router()

// Initialize WayForPay (use test credentials if in development)
const initializeWayForPay = () => {
  const merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT || 'test_merchant'
  const merchantSecretKey = process.env.WAYFORPAY_MERCHANT_SECRET_KEY || 'flk3409refn54t54t*FNJRET'
  const merchantDomainName = process.env.WAYFORPAY_MERCHANT_DOMAIN || 'test.merchant.com'
  
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
 * GET /api/credits/packages
 * Get available credit packages
 */
router.get('/packages', authenticate, async (req: AuthRequest, res: Response) => {
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
 * Initiate a credit top-up purchase
 */
router.post('/topup', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { packageId } = req.body

    if (!packageId) {
      return res.status(400).json({ error: 'Package ID is required' })
    }

    // Get package details
    const packageData = await CreditsService.getPackage(packageId)
    if (!packageData) {
      return res.status(404).json({ error: 'Package not found' })
    }

    // Get user info for payment
    const { data: user } = await supabase.auth.admin.getUserById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Create unique order reference
    const orderReference = `topup_${userId}_${Date.now()}`

    // Create pending transaction record
    const balanceBefore = await CreditsService.getUserCredits(userId)
    await CreditsService.createTransaction(
      userId,
      'topup',
      packageData.credits,
      balanceBefore,
      balanceBefore, // Will be updated after payment
      `topup_${packageId}`,
      `Top-up: ${packageData.display_name} (${packageData.credits} credits)`,
      orderReference,
      'pending'
    )

    // Create WayForPay purchase request
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    const purchaseResponse = await WayForPayService.createPurchase({
      orderReference,
      amount: parseFloat(packageData.price_usd.toString()),
      currency: 'USD',
      productName: `Credit Top-up: ${packageData.display_name}`,
      clientAccountId: userId,
      clientEmail: user.user.email,
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

    // Find transaction by order reference
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
      const balanceBefore = await CreditsService.getUserCredits(userId)
      const packageData = await CreditsService.getPackage(transaction.operation?.replace('topup_', '') || '')
      
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

