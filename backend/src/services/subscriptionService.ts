import { supabase } from '../lib/supabase.js'

export interface SubscriptionPlan {
  id: string
  name: string
  credits: number
  price_usd: number
  display_name: string
  description: string | null
  is_active: boolean
  sort_order: number
}

export interface UserSubscription {
  id: string
  user_id: string
  plan_id: string
  status: 'active' | 'expired' | 'cancelled'
  credits_included: number
  credits_remaining: number
  payment_id: string | null
  payment_status: string | null
  started_at: string
  expires_at: string | null
  cancelled_at: string | null
}

export class SubscriptionService {
  /**
   * Get all active subscription plans
   */
  static async getPlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[Subscription] Error fetching plans:', error)
      return []
    }

    return (data || []).filter(plan => plan.is_active !== false)
  }

  /**
   * Expire subscriptions that have passed their expires_at date
   */
  static async expireSubscriptions(): Promise<void> {
    const now = new Date().toISOString()

    // 1. Find subscriptions that just expired
    const { data: expiredSubs, error: findError } = await supabase
      .from('user_subscriptions')
      .select('id, user_id, plan_id')
      .eq('status', 'active')
      .lt('expires_at', now)

    if (findError) {
      console.error('[Subscription] Error finding expired subscriptions:', findError)
      return
    }

    if (!expiredSubs || expiredSubs.length === 0) {
      return
    }

    console.log(`[Subscription] Expiring ${expiredSubs.length} subscriptions`)

    for (const sub of expiredSubs) {
      try {
        // Update subscription status
        await supabase
          .from('user_subscriptions')
          .update({ status: 'expired' })
          .eq('id', sub.id)

        // Update user profile
        await supabase
          .from('user_profiles')
          .update({ has_active_subscription: false })
          .eq('id', sub.user_id)

        // Reset credits to 0 (or a base amount)
        const { CreditsService } = await import('./creditsService.js')
        await CreditsService.setCredits(sub.user_id, 0, `subscription_expired_${sub.plan_id}`)

        console.log(`[Subscription] Expired subscription ${sub.id} for user ${sub.user_id}`)
      } catch (error) {
        console.error(`[Subscription] Error processing expiry for sub ${sub.id}:`, error)
      }
    }
  }
  /**
   * Get plan by ID
   */
  static async getPlan(planId: string): Promise<SubscriptionPlan | null> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return null
    }

    return data
  }

  /**
   * Get user's active subscription
   */
  static async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    console.log('[Subscription] Fetching active subscription for user:', userId)

    // First, try to get active subscription with completed payment
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('payment_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[Subscription] Error fetching user subscription:', error)
      return null
    }

    if (data) {
      return data as any as UserSubscription
    }

    // If not found, check if there's any active subscription with failed payment status
    // This can happen if a refund/expired webhook arrives after activation.
    // These subscriptions should still be considered active if they were activated before.
    const { data: failedPaymentSub } = await supabase
      .from('user_subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('payment_status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (failedPaymentSub) {
      console.warn('[Subscription] Found active subscription with failed payment status (likely late refund webhook):', {
        userId,
        subscriptionId: failedPaymentSub.id,
        paymentStatus: failedPaymentSub.payment_status,
      })
      // IMPORTANT: Return the subscription anyway since it was activated and user paid.
      // The failed status is from a late refund/expiration webhook that shouldn't affect
      // the subscription that's already active.
      return failedPaymentSub as any as UserSubscription
    }

    console.log('[Subscription] No active subscription records found for user:', userId)
    return null
  }

  /**
   * Check if user has active subscription
   */
  static async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId)
    return subscription !== null
  }

  /**
   * Create a new subscription
   */
  static async createSubscription(
    userId: string,
    planId: string,
    orderReference: string,
    paymentStatus: string = 'pending'
  ): Promise<UserSubscription> {
    const plan = await this.getPlan(planId)
    if (!plan) {
      throw new Error('Plan not found')
    }

    // Cancel any existing active subscriptions
    await supabase
      .from('user_subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'active')

    // Create new subscription with status based on payment status
    // If payment is pending, subscription status should be 'pending' (not 'active')
    const subscriptionStatus = paymentStatus === 'completed' ? 'active' : 'pending'

    console.log('[Subscription] Creating subscription:', {
      userId,
      planId,
      orderReference,
      paymentStatus,
      subscriptionStatus,
      credits: plan.credits,
    })

    const { data, error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        status: subscriptionStatus,
        credits_included: plan.credits,
        credits_remaining: plan.credits,
        payment_id: orderReference,
        payment_status: paymentStatus,
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days for monthly subscription
      })
      .select()
      .single()

    if (error) {
      console.error('[Subscription] Error creating subscription:', error)
      throw new Error('Failed to create subscription')
    }

    // Update user profile and add credits only if payment is completed
    if (paymentStatus === 'completed') {
      console.log('[Subscription] Payment completed, activating subscription and adding credits')

      await supabase
        .from('user_profiles')
        .update({
          has_active_subscription: true,
          current_subscription_id: data.id,
        })
        .eq('id', userId)

      // Add credits to user account (Reset to plan amount)
      const { CreditsService } = await import('./creditsService.js')
      const balanceAfter = await CreditsService.setCredits(userId, plan.credits, `subscription_${planId}`)

      console.log('[Subscription] Credits added:', {
        userId,
        creditsAdded: plan.credits,
        balanceAfter,
      })
    } else {
      console.log('[Subscription] Payment pending, subscription created but not activated yet')
    }

    return data
  }

  /**
   * Activate subscription after payment
   */
  static async activateSubscription(
    userId: string,
    orderReference: string
  ): Promise<void> {
    console.log('[Subscription] Activating subscription:', { userId, orderReference })

    const { data: subscription, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('payment_id', orderReference)
      .eq('user_id', userId)
      .single()

    if (fetchError || !subscription) {
      console.error('[Subscription] Subscription not found:', { orderReference, error: fetchError })
      throw new Error('Subscription not found')
    }

    const plan = subscription.plan as SubscriptionPlan
    if (!plan) {
      console.error('[Subscription] Plan not found for subscription:', subscription.plan_id)
      throw new Error('Plan not found')
    }

    console.log('[Subscription] Found subscription:', {
      subscriptionId: subscription.id,
      planId: plan.id,
      credits: plan.credits,
      currentStatus: subscription.status,
      currentPaymentStatus: subscription.payment_status,
    })

    // Check if credits were already added for this specific payment
    const { data: existingTransaction } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('payment_id', orderReference)
      .limit(1)
      .maybeSingle()

    const creditsAlreadyAdded = !!existingTransaction

    console.log('[Subscription] Credits check:', {
      creditsAlreadyAdded,
      transactionId: existingTransaction?.id,
    })

    // Update subscription status
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'active',
        payment_status: 'completed',
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days for monthly subscription
      })
      .eq('id', subscription.id)

    if (updateError) {
      console.error('[Subscription] Error updating subscription status:', updateError)
      throw new Error('Failed to update subscription status')
    }

    // Update user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        has_active_subscription: true,
        current_subscription_id: subscription.id,
      })
      .eq('id', userId)

    if (profileError) {
      console.error('[Subscription] Error updating user profile:', profileError)
      throw new Error('Failed to update user profile')
    }

    // Add credits if not already added
    if (!creditsAlreadyAdded) {
      console.log('[Subscription] Adding credits to user account:', {
        userId,
        credits: plan.credits,
        operation: `subscription_${plan.id}`,
      })

      const { CreditsService } = await import('./creditsService.js')
      const balanceBefore = await CreditsService.getUserCredits(userId)
      const balanceAfter = await CreditsService.setCredits(userId, plan.credits, `subscription_${plan.id}`)

      console.log('[Subscription] Credits reset to plan amount successfully:', {
        userId,
        planCredits: plan.credits,
        balanceBefore,
        balanceAfter,
      })
    } else {
      console.log('[Subscription] Credits already added, skipping')
    }

    console.log('[Subscription] Subscription activated successfully')
  }

  /**
   * Cancel an active subscription
   */
  static async cancelSubscription(userId: string): Promise<void> {
    console.log('[Subscription] Cancelling subscription for user:', userId)

    // 1. Update subscription status
    const { data: sub, error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('status', 'active')
      .select('id, plan_id')
      .single()

    if (updateError) {
      console.error('[Subscription] Error cancelling subscription:', updateError)
      throw new Error('Failed to cancel subscription')
    }

    // 2. Update user profile
    await supabase
      .from('user_profiles')
      .update({ has_active_subscription: false })
      .eq('id', userId)

    // 3. Burn all credits
    const { CreditsService } = await import('./creditsService.js')
    await CreditsService.setCredits(userId, 0, `subscription_cancelled_${sub.plan_id}`)

    console.log('[Subscription] Subscription cancelled successfully for user:', userId)
  }
}

