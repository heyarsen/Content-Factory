import axios from 'axios'
import { WayForPayService } from './wayforpayService.js'
import { supabase } from '../lib/supabase.js'

/**
 * WayForPay Recurring Payment Management Service
 * Documentation: https://wiki.wayforpay.com/en/view/852526
 */

export interface RecurringPaymentStatus {
  reasonCode: number
  reason: string
  orderReference: string
  mode: string
  status: 'Active' | 'Suspended' | 'Created' | 'Removed' | 'Confirmed' | 'Completed'
  amount: number
  currency: string
  email: string
  dateBegin: number
  dateEnd: number
  lastPayedDate?: number
  lastPayedStatus?: string
  nextPaymentDate?: number
}

export class RecurringPaymentService {
  /**
   * Get recurring payment status
   * Documentation: https://wiki.wayforpay.com/en/view/852526
   */
  static async getRecurringStatus(orderReference: string): Promise<RecurringPaymentStatus | null> {
    try {
      // Use environment variables directly since getConfig is private
      const merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT || 'test_merch_n1'
      const merchantSecretKey = process.env.WAYFORPAY_MERCHANT_SECRET_KEY || 'flk3409refn54t54t*FNJRET'
      const apiUrl = process.env.WAYFORPAY_API_URL || 'https://api.wayforpay.com/api'
      
      const requestBody = {
        requestType: 'STATUS',
        merchantAccount,
        merchantPassword: merchantSecretKey, // Note: Some APIs use password instead of signature
        orderReference,
      }

      console.log('[RecurringPayment] Checking status:', { orderReference })

      const response = await axios.post(
        `${apiUrl}/status`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      const data = response.data
      console.log('[RecurringPayment] Status response:', {
        orderReference,
        status: data.status,
        reasonCode: data.reasonCode,
      })

      return data as RecurringPaymentStatus
    } catch (error: any) {
      console.error('[RecurringPayment] Status check error:', error.response?.data || error.message)
      return null
    }
  }

  /**
   * Suspend recurring payment
   * Documentation: https://wiki.wayforpay.com/en/view/852506
   */
  static async suspendRecurringPayment(orderReference: string): Promise<boolean> {
    try {
      // Use environment variables directly since getConfig is private
      const merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT || 'test_merch_n1'
      const merchantSecretKey = process.env.WAYFORPAY_MERCHANT_SECRET_KEY || 'flk3409refn54t54t*FNJRET'
      const apiUrl = process.env.WAYFORPAY_API_URL || 'https://api.wayforpay.com/api'
      
      const requestBody = {
        requestType: 'SUSPEND',
        merchantAccount,
        merchantPassword: merchantSecretKey,
        orderReference,
      }

      console.log('[RecurringPayment] Suspending:', { orderReference })

      const response = await axios.post(
        `${apiUrl}/suspend`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      const data = response.data
      const success = data.reasonCode === 4100 && data.reason === 'Ok'

      console.log('[RecurringPayment] Suspend response:', {
        orderReference,
        success,
        reasonCode: data.reasonCode,
        reason: data.reason,
      })

      return success
    } catch (error: any) {
      console.error('[RecurringPayment] Suspend error:', error.response?.data || error.message)
      return false
    }
  }

  /**
   * Resume recurring payment
   * Documentation: https://wiki.wayforpay.com/en/view/852513
   */
  static async resumeRecurringPayment(orderReference: string): Promise<boolean> {
    try {
      // Use environment variables directly since getConfig is private
      const merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT || 'test_merch_n1'
      const merchantSecretKey = process.env.WAYFORPAY_MERCHANT_SECRET_KEY || 'flk3409refn54t54t*FNJRET'
      const apiUrl = process.env.WAYFORPAY_API_URL || 'https://api.wayforpay.com/api'
      
      const requestBody = {
        requestType: 'RESUME',
        merchantAccount,
        merchantPassword: merchantSecretKey,
        orderReference,
      }

      console.log('[RecurringPayment] Resuming:', { orderReference })

      const response = await axios.post(
        `${apiUrl}/resume`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      const data = response.data
      const success = data.reasonCode === 4100 && data.reason === 'Ok'

      console.log('[RecurringPayment] Resume response:', {
        orderReference,
        success,
        reasonCode: data.reasonCode,
        reason: data.reason,
      })

      return success
    } catch (error: any) {
      console.error('[RecurringPayment] Resume error:', error.response?.data || error.message)
      return false
    }
  }

  /**
   * Delete recurring payment
   * Documentation: https://wiki.wayforpay.com/en/view/852521
   */
  static async deleteRecurringPayment(orderReference: string): Promise<boolean> {
    try {
      // Use environment variables directly since getConfig is private
      const merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT || 'test_merch_n1'
      const merchantSecretKey = process.env.WAYFORPAY_MERCHANT_SECRET_KEY || 'flk3409refn54t54t*FNJRET'
      const apiUrl = process.env.WAYFORPAY_API_URL || 'https://api.wayforpay.com/api'
      
      const requestBody = {
        requestType: 'REMOVE',
        merchantAccount,
        merchantPassword: merchantSecretKey,
        orderReference,
      }

      console.log('[RecurringPayment] Deleting:', { orderReference })

      const response = await axios.post(
        `${apiUrl}/remove`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      const data = response.data
      const success = data.reasonCode === 4100 && data.reason === 'Ok'

      console.log('[RecurringPayment] Delete response:', {
        orderReference,
        success,
        reasonCode: data.reasonCode,
        reason: data.reason,
      })

      return success
    } catch (error: any) {
      console.error('[RecurringPayment] Delete error:', error.response?.data || error.message)
      return false
    }
  }

  /**
   * Cancel subscription and delete recurring payment
   * This should be called when user cancels subscription
   */
  static async cancelSubscription(userId: string): Promise<boolean> {
    try {
      console.log('[RecurringPayment] Cancelling subscription for user:', userId)

      // Get user's active subscription
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      if (!subscription) {
        console.log('[RecurringPayment] No active subscription found for user:', userId)
        return false
      }

      // Try to delete recurring payment from WayForPay
      let recurringDeleted = false
      if (subscription.payment_id) {
        recurringDeleted = await this.deleteRecurringPayment(subscription.payment_id)
      }

      // Update subscription status in database
      await supabase
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id)

      // Update user profile
      await supabase
        .from('user_profiles')
        .update({
          has_active_subscription: false,
          current_subscription_id: null,
        })
        .eq('id', userId)

      // Burn credits
      const { CreditsService } = await import('./creditsService.js')
      await CreditsService.setCredits(userId, 0, `subscription_cancelled_${subscription.plan_id}`)

      console.log('[RecurringPayment] Subscription cancelled:', {
        userId,
        subscriptionId: subscription.id,
        paymentId: subscription.payment_id,
        recurringDeleted,
      })

      return true
    } catch (error: any) {
      console.error('[RecurringPayment] Cancel subscription error:', error)
      return false
    }
  }

  /**
   * Check and sync recurring payment status
   * Can be called periodically to ensure consistency
   */
  static async syncRecurringStatus(orderReference: string): Promise<void> {
    try {
      const status = await this.getRecurringStatus(orderReference)
      if (!status) {
        return
      }

      // Update subscription in database based on recurring status
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('payment_id', orderReference)
        .single()

      if (!subscription) {
        return
      }

      // If recurring payment is removed/deleted, cancel subscription
      if (status.status === 'Removed' && subscription.status === 'active') {
        console.log('[RecurringPayment] Recurring payment removed, cancelling subscription:', orderReference)
        
        await supabase
          .from('user_subscriptions')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id)

        await supabase
          .from('user_profiles')
          .update({
            has_active_subscription: false,
            current_subscription_id: null,
          })
          .eq('id', subscription.user_id)

        // Burn credits
        const { CreditsService } = await import('./creditsService.js')
        await CreditsService.setCredits(subscription.user_id, 0, `recurring_removed_${subscription.plan_id}`)
      }

      console.log('[RecurringPayment] Status synced:', {
        orderReference,
        status: status.status,
        subscriptionStatus: subscription.status,
      })
    } catch (error: any) {
      console.error('[RecurringPayment] Sync status error:', error)
    }
  }
}
