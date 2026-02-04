import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'

const router = Router()

// Temporary admin endpoint to run migration
// This should be removed after running the migration
router.post('/update-subscription-plans', async (req: any, res: Response) => {
  try {
    console.log('🔄 Updating subscription plans...')
    
    // Deactivate free plan
    const { error: freePlanError } = await supabase
      .from('subscription_plans')
      .update({ is_active: false })
      .eq('id', 'plan_free')
    
    if (freePlanError) {
      console.error('Error deactivating free plan:', freePlanError)
      return res.status(500).json({ error: 'Failed to deactivate free plan', details: freePlanError })
    }
    
    // Add new $70 premium plan
    const { error: premiumPlanError } = await supabase
      .from('subscription_plans')
      .upsert({
        id: 'plan_4',
        name: 'premium',
        credits: 150,
        price_usd: 70.00,
        display_name: 'Premium Plan',
        description: '150 credits per month - ongoing until canceled',
        sort_order: 3
      }, {
        onConflict: 'id'
      })
    
    if (premiumPlanError) {
      console.error('Error adding premium plan:', premiumPlanError)
      return res.status(500).json({ error: 'Failed to add premium plan', details: premiumPlanError })
    }
    
    // Update enterprise plan sort order
    const { error: enterprisePlanError } = await supabase
      .from('subscription_plans')
      .update({ sort_order: 4 })
      .eq('id', 'plan_3')
    
    if (enterprisePlanError) {
      console.error('Error updating enterprise plan:', enterprisePlanError)
      return res.status(500).json({ error: 'Failed to update enterprise plan', details: enterprisePlanError })
    }
    
    // Verify the changes
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order', { ascending: true })
    
    if (plansError) {
      console.error('Error verifying plans:', plansError)
      return res.status(500).json({ error: 'Failed to verify plans', details: plansError })
    }
    
    console.log('✅ Subscription plans updated successfully!')
    
    res.json({
      success: true,
      message: 'Subscription plans updated successfully',
      plans: plans
    })
    
  } catch (error: any) {
    console.error('Error updating subscription plans:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
