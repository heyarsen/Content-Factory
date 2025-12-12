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
   */
  static async getUserCredits(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('credits')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('[Credits] Error fetching user credits:', error)
      // If profile doesn't exist, create it with default credits
      try {
        const { data: newProfile } = await supabase
          .from('user_profiles')
          .insert({ id: userId, credits: 20 })
          .select('credits')
          .single()
        return newProfile?.credits ?? 20
      } catch (createError) {
        console.error('[Credits] Error creating user profile:', createError)
        return 20
      }
    }

    return data?.credits ?? 20
  }

  /**
   * Check if user has enough credits for an operation
   */
  static async hasEnoughCredits(userId: string, cost: number): Promise<boolean> {
    const credits = await this.getUserCredits(userId)
    return credits >= cost
  }

  /**
   * Deduct credits from user account
   * Returns the new credit balance
   */
  static async deductCredits(userId: string, cost: number, operation: string): Promise<number> {
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
        .insert({ id: userId, credits: 20 })
        .select('credits')
        .single()
      
      if (!newProfile) {
        throw new Error('Failed to check credits')
      }
      
      const currentCredits = newProfile.credits
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
      
      console.log(`[Credits] Deducted ${cost} credits from user ${userId} for ${operation}. New balance: ${newCredits}`)
      return data.credits
    }

    const currentCredits = currentUser?.credits ?? 20

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

    console.log(`[Credits] Deducted ${cost} credits from user ${userId} for ${operation}. New balance: ${newCredits}`)
    return data.credits
  }

  /**
   * Add credits to user account (for admin operations or refunds)
   */
  static async addCredits(userId: string, amount: number, reason?: string): Promise<number> {
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
        .insert({ id: userId, credits: 20 })
        .select('credits')
        .single()
      
      if (!newProfile) {
        throw new Error('Failed to check credits')
      }
      
      const currentCredits = newProfile.credits
      const newCredits = currentCredits + amount
      
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
      
      console.log(`[Credits] Added ${amount} credits to user ${userId}${reason ? ` (${reason})` : ''}. New balance: ${newCredits}`)
      return data.credits
    }

    const currentCredits = currentUser?.credits ?? 20
    const newCredits = currentCredits + amount

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

    console.log(`[Credits] Added ${amount} credits to user ${userId}${reason ? ` (${reason})` : ''}. New balance: ${newCredits}`)
    return data.credits
  }

  /**
   * Check credits and deduct if sufficient
   * Throws error if insufficient credits
   */
  static async checkAndDeduct(userId: string, cost: number, operation: string): Promise<number> {
    const hasEnough = await this.hasEnoughCredits(userId, cost)
    if (!hasEnough) {
      const credits = await this.getUserCredits(userId)
      throw new Error(`Insufficient credits. You have ${credits} credits but need ${cost} credits for ${operation}.`)
    }

    return await this.deductCredits(userId, cost, operation)
  }
}

