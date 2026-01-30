import { supabase } from './backend/src/lib/supabase.js'
import fs from 'fs'
import path from 'path'

async function runMigration() {
  try {
    console.log('Running migration 030_update_subscription_plans.sql...')
    
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'database/migrations/030_update_subscription_plans.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL })
    
    if (error) {
      console.error('Migration failed:', error)
      process.exit(1)
    }
    
    console.log('Migration completed successfully!')
    
    // Verify the changes
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order', { ascending: true })
    
    if (plansError) {
      console.error('Error verifying plans:', plansError)
    } else {
      console.log('Updated subscription plans:')
      plans.forEach(plan => {
        console.log(`- ${plan.display_name}: ${plan.credits} credits for $${plan.price_usd}`)
      })
    }
    
  } catch (error) {
    console.error('Error running migration:', error)
    process.exit(1)
  }
}

runMigration()
