import { supabase } from '../lib/supabase.js'

export class CreditsService {
  // Credit costs for different operations
  static readonly COSTS = {
    VIDEO_GENERATION: 1,
    AVATAR_GENERATION: 5,
    LOOK_GENERATION: 1,
  } as const

  /**
   * Get user's current credits
   * Returns null if user has unlimited credits
   */
  static async getUserCredits(userId: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('credits')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('[Credits] Error fetching user credits:', error)
      // If profile doesn't exist, create it with 0 credits (users must purchase subscription)
      try {
        const { data: newProfile } = await supabase
          .from('user_profiles')
          .insert({ id: userId, credits: 3 })
          .select('credits')
          .single()
        return newProfile?.credits ?? 0
      } catch (createError) {
        console.error('[Credits] Error creating user profile:', createError)
        return 0
      }
    }

    // NULL means unlimited credits
    return data?.credits ?? 0
  }

  /**
   * Set user's credit balance to a specific amount
   * (Used for subscription renewals or resets)
   */
  static async setCredits(userId: string, amount: number, reason?: string): Promise<number | null> {
    console.log(`[Credits] Setting user ${userId} credits to ${amount}. Reason: ${reason}`)

    const { data: currentUser } = await supabase
      .from('user_profiles')
      .select('credits')
      .eq('id', userId)
      .single()

    const currentCredits = currentUser?.credits ?? 0

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        credits: amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('credits')
      .single()

    if (error) {
      console.error('[Credits] Error setting credits:', error)
      throw new Error('Failed to set credits')
    }

    // Log transaction
    await this.createTransaction(
      userId,
      'adjustment',
      amount - currentCredits,
      currentCredits,
      amount,
      reason,
      reason || `Set credits to ${amount}`
    )

    return data.credits
  }

  /**
   * Check if user has active subscription
   */
  static async hasActiveSubscription(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('user_profiles')
      .select('has_active_subscription')
      .eq('id', userId)
      .single()

    return data?.has_active_subscription === true
  }

  /**
   * Check if user has enough credits for an operation
   * Returns true if user has unlimited credits (null)
   * First checks if user has active subscription
   */
  static async hasEnoughCredits(userId: string, cost: number): Promise<{ hasSubscription: boolean; hasCredits: boolean; credits: number | null }> {
    const hasSubscription = await this.hasActiveSubscription(userId)
    const credits = await this.getUserCredits(userId)

    // NULL means unlimited credits
    if (credits === null) {
      return { hasSubscription, hasCredits: true, credits: null }
    }

    return {
      hasSubscription,
      hasCredits: credits >= cost,
      credits,
    }
  }

  /**
   * Create a credit transaction record
   */
  static async createTransaction(
    userId: string,
    type: 'topup' | 'deduction' | 'refund' | 'adjustment',
    amount: number,
    balanceBefore: number | null,
    balanceAfter: number | null,
    operation?: string,
    description?: string,
    paymentId?: string,
    paymentStatus?: string
  ): Promise<void> {
    try {
      const { data, error } = await supabase.from('credit_transactions').insert({
        user_id: userId,
        type,
        amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        operation,
        description,
        payment_id: paymentId,
        payment_status: paymentStatus,
      }).select('id')
      
      if (error) {
        console.error('[Credits] Error creating transaction record:', error)
      } else {
        console.log('[Credits] Transaction created successfully:', {
          userId,
          type,
          amount,
          paymentId,
          paymentStatus,
          transactionId: data?.[0]?.id
        })
      }
    } catch (error) {
      console.error('[Credits] Error creating transaction record:', error)
      // Don't throw - transaction logging shouldn't break the main flow
    }
  }

  /**
   * Get user's credit transaction history
   */
  static async getTransactionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[Credits] Error fetching transaction history:', error)
      return []
    }

    return data || []
  }

  /**
   * Calculate user's top-up credits (credits purchased separately from subscription)
   */
  static async getTopupCredits(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'topup')
      .eq('payment_status', 'completed')

    if (error) {
      console.error('[Credits] Error fetching top-up transactions:', error)
      return 0
    }

    // Sum all top-up amounts (they are stored as positive numbers)
    const topupTotal = data?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0
    
    console.log('[Credits] User top-up credits calculated:', {
      userId,
      topupTotal,
      transactionCount: data?.length || 0
    })

    return topupTotal
  }

  /**
   * Deduct credits from user account
   * Returns the new credit balance (null if unlimited)
   * Does nothing if user has unlimited credits (null)
   */
  static async deductCredits(userId: string, cost: number, operation: string): Promise<number | null> {
    if (cost <= 0) {
      return await this.getUserCredits(userId)
    }

    // Use a transaction-like approach with atomic update
    const { data: currentUser, error: fetchError } = await supabase
      .from('user_profiles')
      .select('credits')
      .eq('id', userId)
      .single()

    if (fetchError) {
      console.error('[Credits] Error fetching user credits for deduction:', fetchError)
      // Try to create profile if it doesn't exist
      const { data: newProfile } = await supabase
        .from('user_profiles')
        .insert({ id: userId, credits: 3 })
        .select('credits')
        .single()

      if (!newProfile) {
        throw new Error('Failed to check credits')
      }

      const currentCredits = newProfile.credits
      // NULL means unlimited, so no deduction needed
      if (currentCredits === null) {
        console.log(`[Credits] User ${userId} has unlimited credits, skipping deduction for ${operation}`)
        return null
      }

      if (currentCredits < cost) {
        throw new Error(`Insufficient credits. You have ${currentCredits} credits but need ${cost} credits for ${operation}.`)
      }

      const newCredits = currentCredits - cost
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ credits: newCredits, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('credits')
        .single()

      if (error) {
        console.error('[Credits] Error deducting credits:', error)
        throw new Error('Failed to deduct credits')
      }

      // Log transaction
      await this.createTransaction(
        userId,
        'deduction',
        -cost,
        currentCredits,
        newCredits,
        operation,
        `Deducted ${cost} credits for ${operation}`
      )

      console.log(`[Credits] Deducted ${cost} credits from user ${userId} for ${operation}. New balance: ${newCredits}`)
      return data.credits
    }

    const currentCredits = currentUser?.credits ?? 0

    // NULL means unlimited credits, so no deduction needed
    if (currentCredits === null) {
      console.log(`[Credits] User ${userId} has unlimited credits, skipping deduction for ${operation}`)
      return null
    }

    if (currentCredits < cost) {
      throw new Error(`Insufficient credits. You have ${currentCredits} credits but need ${cost} credits for ${operation}.`)
    }

    const newCredits = currentCredits - cost

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ credits: newCredits, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('credits')
      .single()

    if (error) {
      console.error('[Credits] Error deducting credits:', error)
      throw new Error('Failed to deduct credits')
    }

    // Log transaction
    await this.createTransaction(
      userId,
      'deduction',
      -cost,
      currentCredits,
      newCredits,
      operation,
      `Deducted ${cost} credits for ${operation}`
    )

    console.log(`[Credits] Deducted ${cost} credits from user ${userId} for ${operation}. New balance: ${newCredits}`)
    return data.credits
  }

  /**
   * Add credits to user account (for admin operations or refunds)
   * Returns the new credit balance (null if unlimited)
   * @param skipTransactionLog - If true, skips creating a transaction record (useful when transaction already exists)
   */
  static async addCredits(userId: string, amount: number, reason?: string, skipTransactionLog: boolean = false): Promise<number | null> {
    if (amount <= 0) {
      return await this.getUserCredits(userId)
    }

    const { data: currentUser, error: fetchError } = await supabase
      .from('user_profiles')
      .select('credits')
      .eq('id', userId)
      .single()

    if (fetchError) {
      console.error('[Credits] Error fetching user credits for addition:', fetchError)
      // Try to create profile if it doesn't exist
      const { data: newProfile } = await supabase
        .from('user_profiles')
        .insert({ id: userId, credits: 3 })
        .select('credits')
        .single()

      if (!newProfile) {
        throw new Error('Failed to check credits')
      }

      const currentCredits = newProfile.credits
      // If unlimited, stay unlimited
      if (currentCredits === null) {
        return null
      }

      const newCredits = (currentCredits ?? 0) + amount

      const { data, error } = await supabase
        .from('user_profiles')
        .update({ credits: newCredits, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('credits')
        .single()

      if (error) {
        console.error('[Credits] Error adding credits:', error)
        throw new Error('Failed to add credits')
      }

      // Log transaction (unless skipped)
      if (!skipTransactionLog) {
        await this.createTransaction(
          userId,
          reason?.includes('topup') ? 'topup' : 'adjustment',
          amount,
          currentCredits,
          newCredits,
          reason,
          reason || `Added ${amount} credits`
        )
      }

      console.log(`[Credits] Added ${amount} credits to user ${userId}${reason ? ` (${reason})` : ''}. New balance: ${newCredits}`)
      return data.credits
    }

    const currentCredits = currentUser?.credits
    // If unlimited, stay unlimited
    if (currentCredits === null) {
      return null
    }

    const newCredits = (currentCredits ?? 0) + amount

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ credits: newCredits, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('credits')
      .single()

    if (error) {
      console.error('[Credits] Error adding credits:', error)
      throw new Error('Failed to add credits')
    }

    // Log transaction (unless skipped)
    if (!skipTransactionLog) {
      await this.createTransaction(
        userId,
        reason?.includes('topup') ? 'topup' : 'adjustment',
        amount,
        currentCredits,
        newCredits,
        reason,
        reason || `Added ${amount} credits`
      )
    }

    console.log(`[Credits] Added ${amount} credits to user ${userId}${reason ? ` (${reason})` : ''}. New balance: ${newCredits}`)
    return data.credits
  }

  /**
   * Check credits and deduct if sufficient
   * Throws error if insufficient credits or no subscription
   * Returns null if user has unlimited credits
   */
  static async checkAndDeduct(userId: string, cost: number, operation: string): Promise<number | null> {
    const checkResult = await this.hasEnoughCredits(userId, cost)

    if (!checkResult.hasCredits) {
      const creditsDisplay = checkResult.credits === null ? 'unlimited' : checkResult.credits.toString()
      throw new Error(`Insufficient credits. You have ${creditsDisplay} credits but need ${cost} credits for ${operation}. You can top up credits or choose a different subscription plan.`)
    }

    // Allow deduction if credits are available, even without a subscription
    // Subscription is only strictly required if they want unlimited or some specific perks, 
    // but for credit-based operations, the balance is what matters.
    return await this.deductCredits(userId, cost, operation)
  }

  /**
   * Get available credit packages
   */
  static async getCreditPackages(): Promise<any[]> {
    const { data, error } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[Credits] Error fetching packages:', error)
      return []
    }

    return data || []
  }

  /**
   * Get package by ID
   */
  static async getPackage(packageId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('id', packageId)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return null
    }

    return data
  }
}

