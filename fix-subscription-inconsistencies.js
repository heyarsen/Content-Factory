#!/usr/bin/env node

// Fix subscription inconsistencies script
// This script checks and fixes any mismatches between user_profiles and user_subscriptions

import { supabase } from '../backend/src/lib/supabase.js'

async function fixSubscriptionInconsistencies() {
  console.log('[Fix] Starting subscription consistency check...')
  
  try {
    // Find all users with active subscriptions in user_subscriptions
    const { data: activeSubscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('user_id, status, payment_status, id')
      .or('status.eq.active,payment_status.eq.completed,status.eq.active,payment_status.eq.failed,status.eq.pending')
    
    if (subError) {
      console.error('[Fix] Error fetching active subscriptions:', subError)
      return
    }
    
    console.log(`[Fix] Found ${activeSubscriptions?.length || 0} active subscription records`)
    
    if (!activeSubscriptions || activeSubscriptions.length === 0) {
      console.log('[Fix] No active subscriptions found, nothing to fix')
      return
    }
    
    // Group by user_id
    const userSubscriptions = {}
    activeSubscriptions.forEach(sub => {
      if (!userSubscriptions[sub.user_id]) {
        userSubscriptions[sub.user_id] = []
      }
      userSubscriptions[sub.user_id].push(sub)
    })
    
    // Check each user's profile
    const userIds = Object.keys(userSubscriptions)
    console.log(`[Fix] Checking ${userIds.length} users for profile consistency`)
    
    for (const userId of userIds) {
      const userSubs = userSubscriptions[userId]
      const hasActiveSub = userSubs.some(sub => 
        sub.status === 'active' || 
        (sub.status === 'active' && sub.payment_status === 'completed') ||
        (sub.status === 'active' && sub.payment_status === 'failed') ||
        sub.status === 'pending'
      )
      
      // Check user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, has_active_subscription, current_subscription_id')
        .eq('id', userId)
        .single()
      
      if (profileError) {
        console.error(`[Fix] Error fetching profile for user ${userId}:`, profileError)
        continue
      }
      
      console.log(`[Fix] User ${userId}:`, {
        hasActiveSub,
        profileHasActive: profile.has_active_subscription,
        subs: userSubs.length
      })
      
      // Fix inconsistency if found
      if (hasActiveSub && !profile.has_active_subscription) {
        console.log(`[Fix] 🔄 Fixing inconsistency for user ${userId}: updating has_active_subscription to true`)
        
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ 
            has_active_subscription: true,
            current_subscription_id: userSubs.find(sub => sub.status === 'active')?.id || null
          })
          .eq('id', userId)
        
        if (updateError) {
          console.error(`[Fix] Error updating profile for user ${userId}:`, updateError)
        } else {
          console.log(`[Fix] ✅ Fixed user ${userId}`)
        }
      } else if (!hasActiveSub && profile.has_active_subscription) {
        console.log(`[Fix] ⚠️  User ${userId} has has_active_subscription=true but no active subscriptions found`)
      } else {
        console.log(`[Fix] ✅ User ${userId} is consistent`)
      }
    }
    
    console.log('[Fix] Subscription consistency check completed')
    
  } catch (error) {
    console.error('[Fix] Unexpected error:', error)
  }
}

// Run the fix
fixSubscriptionInconsistencies().then(() => {
  console.log('[Fix] Script completed')
  process.exit(0)
}).catch(error => {
  console.error('[Fix] Script failed:', error)
  process.exit(1)
})
