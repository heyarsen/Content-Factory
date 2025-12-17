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

    return data || []
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
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return null
    }

    return data
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

    // Create new subscription
    const { data, error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        credits_included: plan.credits,
        credits_remaining: plan.credits,
        payment_id: orderReference,
        payment_status: paymentStatus,
      })
      .select()
      .single()

    if (error) {
      console.error('[Subscription] Error creating subscription:', error)
      throw new Error('Failed to create subscription')
    }

    // Update user profile only if payment is completed
    if (paymentStatus === 'completed') {
      await supabase
        .from('user_profiles')
        .update({
          has_active_subscription: true,
          current_subscription_id: data.id,
        })
        .eq('id', userId)

      // Add credits to user account only after payment is completed
      const { CreditsService } = await import('./creditsService.js')
      await CreditsService.addCredits(userId, plan.credits, `subscription_${planId}`, true)
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
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('payment_id', orderReference)
      .eq('user_id', userId)
      .single()

    if (!subscription) {
      throw new Error('Subscription not found')
    }

    // Update subscription status
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'active',
        payment_status: 'completed',
      })
      .eq('id', subscription.id)

    // Update user profile
    await supabase
      .from('user_profiles')
      .update({
        has_active_subscription: true,
        current_subscription_id: subscription.id,
      })
      .eq('id', userId)

    // Add credits if not already added
    const plan = subscription.plan as SubscriptionPlan
    const { CreditsService } = await import('./creditsService.js')
    const currentCredits = await CreditsService.getUserCredits(userId)
    
    // Only add credits if they haven't been added yet (check transaction history)
    const { data: existingTransaction } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('operation', `subscription_${plan.id}`)
      .limit(1)
      .single()

    if (!existingTransaction) {
      await CreditsService.addCredits(userId, plan.credits, `subscription_${plan.id}`, false)
    }
  }
}

