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

    return (data || []).filter(plan => plan.is_active !== false && plan.id !== 'plan_free')
  }

  /**
   * Expire subscriptions that have passed their expires_at date
   * NOTE: This function is deprecated as subscriptions are now ongoing until canceled
   */
  static async expireSubscriptions(): Promise<void> {
    console.log('[Subscription] expireSubscriptions called but subscriptions are now ongoing until canceled')
    // No-op - subscriptions no longer expire
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

    return null
  }

  /**
   * Check if user has active subscription
   */
  static async hasActiveSubscription(userId: string): Promise<boolean> {
    // First check user_profiles table for cached subscription status
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, has_active_subscription')
      .eq('id', userId)
      .maybeSingle()

    // Optimization: Trust user_profiles table for cached subscription status if it's true
    // OR if user is an admin
    if (!profileError) {
      if (profile?.has_active_subscription) {
        return true
      }
      if (profile?.role === 'admin') {
        return true
      }
    }

    // Fallback: Check user_subscriptions table directly for the LATEST record
    const { data: latestSub, error: subError } = await supabase
      .from('user_subscriptions')
      .select('id, status, payment_status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // If latest is active or pending, it's considered active
    const hasActiveSub = !!latestSub && ['active', 'pending'].includes(latestSub.status)

    if (profileError || subError) {
      console.warn('[Subscription] Subscription lookup fallback encountered an error', {
        userId,
        profileError: profileError?.message,
        subError: subError?.message,
      })
    }

    return hasActiveSub
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
        expires_at: null, // No expiration - ongoing until canceled
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

      // Add credits to user account (Add to existing balance)
      const { CreditsService } = await import('./creditsService.js')
      const balanceAfter = await CreditsService.addCredits(userId, plan.credits, `subscription_${planId}`)

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
   * NOTE: Credits are now added in the webhook handler, so this function only updates status
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

    // Update subscription status (NO CREDIT CHANGES - handled in webhook)
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'active',
        payment_status: 'completed',
      })
      .eq('id', subscription.id)

    if (updateError) {
      console.error('[Subscription] Error updating subscription status:', updateError)
      throw new Error('Failed to update subscription status')
    }

    // Update user profile (NO CREDIT CHANGES - handled in webhook)
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

    console.log('[Subscription] Subscription status updated successfully (no credit changes)')
  }

  /**
   * Cancel user's active subscription
   */
  static async cancelSubscription(userId: string): Promise<void> {
    console.log('[Subscription] Cancelling subscription for user:', userId)

    const { data: subscription, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (fetchError || !subscription) {
      console.error('[Subscription] No active subscription found:', { userId, error: fetchError })
      throw new Error('No active subscription found')
    }

    // Update subscription status to cancelled
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)

    if (updateError) {
      console.error('[Subscription] Error cancelling subscription:', updateError)
      throw new Error('Failed to cancel subscription')
    }

    // Update user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        has_active_subscription: false,
        current_subscription_id: null,
      })
      .eq('id', userId)

    if (profileError) {
      console.error('[Subscription] Error updating user profile:', profileError)
      throw new Error('Failed to update user profile')
    }

    // Burn all credits when subscription is cancelled
    const { CreditsService } = await import('./creditsService.js')
    const creditsBefore = await CreditsService.getUserCredits(userId)
    await CreditsService.setCredits(userId, 0, `subscription_cancelled_${subscription.id}`)

    console.log('[Subscription] Credits burned due to cancellation:', {
      userId,
      subscriptionId: subscription.id,
      creditsBurned: creditsBefore,
    })

    // Cancel all pending scheduled posts
    console.log('[Subscription] Cancelling all pending scheduled posts for user:', userId)
    const { data: cancelledPosts, error: cancelPostsError } = await supabase
      .from('scheduled_posts')
      .update({
        status: 'cancelled',
        error_message: 'Subscription cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .in('status', ['pending', 'scheduled'])
      .select('id, platform, video_id')

    if (cancelPostsError) {
      console.error('[Subscription] Error cancelling scheduled posts:', cancelPostsError)
      // Don't throw - we still want to complete the cancellation
    } else {
      console.log('[Subscription] Cancelled scheduled posts:', {
        userId,
        postsCount: cancelledPosts?.length || 0,
        posts: cancelledPosts,
      })
    }

    console.log('[Subscription] Subscription cancelled successfully:', { userId, subscriptionId: subscription.id })
  }
}
