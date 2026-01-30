import { supabase } from './backend/src/lib/supabase.js'

async function updateSubscriptionPlans() {
  try {
    console.log('Updating subscription plans...')
    
    // Update free plan description
    const { error: freePlanError } = await supabase
      .from('subscription_plans')
      .update({ description: 'Free plan - no credits included' })
      .eq('id', 'plan_free')
    
    if (freePlanError) {
      console.error('Error updating free plan:', freePlanError)
    } else {
      console.log('✅ Updated free plan description')
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
    } else {
      console.log('✅ Added premium plan ($70 for 150 credits)')
    }
    
    // Update enterprise plan sort order
    const { error: enterprisePlanError } = await supabase
      .from('subscription_plans')
      .update({ sort_order: 4 })
      .eq('id', 'plan_3')
    
    if (enterprisePlanError) {
      console.error('Error updating enterprise plan:', enterprisePlanError)
    } else {
      console.log('✅ Updated enterprise plan sort order')
    }
    
    // Verify the changes
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order', { ascending: true })
    
    if (plansError) {
      console.error('Error verifying plans:', plansError)
    } else {
      console.log('\n📋 Updated subscription plans:')
      plans.forEach(plan => {
        console.log(`- ${plan.display_name}: ${plan.credits} credits for $${plan.price_usd}`)
      })
    }
    
    console.log('\n✅ Subscription plans updated successfully!')
    
  } catch (error) {
    console.error('Error updating subscription plans:', error)
    process.exit(1)
  }
}

updateSubscriptionPlans()
