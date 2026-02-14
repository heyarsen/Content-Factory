import dotenv from 'dotenv'
import path from 'path'
import { supabase } from '../lib/supabase.js'
import { logAdminAction } from '../services/adminAuditService.js'

dotenv.config({ path: path.resolve(process.cwd(), '../.env') })

const SCRIPT_FLAG = process.env.ENABLE_ADMIN_MIGRATION_SCRIPT === 'true'
const actorId = process.env.ADMIN_MIGRATION_ACTOR_ID

if (!SCRIPT_FLAG) {
  console.error('Admin migration script is disabled. Set ENABLE_ADMIN_MIGRATION_SCRIPT=true to run.')
  process.exit(1)
}

if (!actorId) {
  console.error('Missing ADMIN_MIGRATION_ACTOR_ID for audit logging.')
  process.exit(1)
}

const requiredActorId = actorId

const requestMetadata = {
  source: 'internal_script',
  requestId: process.env.ADMIN_MIGRATION_REQUEST_ID || null,
  triggeredBy: process.env.ADMIN_MIGRATION_TRIGGERED_BY || null,
  reason: process.env.ADMIN_MIGRATION_REASON || 'subscription plan migration',
}

async function run(): Promise<void> {
  await logAdminAction({
    actorId: requiredActorId,
    action: 'admin_migration.subscription_plans.started',
    targetType: 'subscription_plans',
    metadata: requestMetadata,
  })

  const { error: freePlanError } = await supabase
    .from('subscription_plans')
    .update({ is_active: false })
    .eq('id', 'plan_free')

  if (freePlanError) {
    throw new Error(`Failed to deactivate free plan: ${freePlanError.message}`)
  }

  const { error: premiumPlanError } = await supabase
    .from('subscription_plans')
    .upsert(
      {
        id: 'plan_4',
        name: 'premium',
        credits: 150,
        price_usd: 70.0,
        display_name: 'Premium Plan',
        description: '150 credits per month - ongoing until canceled',
        sort_order: 3,
      },
      { onConflict: 'id' }
    )

  if (premiumPlanError) {
    throw new Error(`Failed to upsert premium plan: ${premiumPlanError.message}`)
  }

  const { error: enterprisePlanError } = await supabase
    .from('subscription_plans')
    .update({ sort_order: 4 })
    .eq('id', 'plan_3')

  if (enterprisePlanError) {
    throw new Error(`Failed to update enterprise plan sort order: ${enterprisePlanError.message}`)
  }

  const { data: plans, error: plansError } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('sort_order', { ascending: true })

  if (plansError) {
    throw new Error(`Failed to verify subscription plans: ${plansError.message}`)
  }

  await logAdminAction({
    actorId: requiredActorId,
    action: 'admin_migration.subscription_plans.completed',
    targetType: 'subscription_plans',
    metadata: {
      ...requestMetadata,
      updatedPlanIds: ['plan_free', 'plan_4', 'plan_3'],
      totalPlans: plans?.length ?? 0,
    },
  })

  console.log('✅ Subscription plans migration completed successfully.')
}

run().catch(async (error: any) => {
  await logAdminAction({
    actorId: requiredActorId,
    action: 'admin_migration.subscription_plans.failed',
    targetType: 'subscription_plans',
    metadata: {
      ...requestMetadata,
      error: error?.message || String(error),
    },
  })

  console.error('❌ Subscription plans migration failed:', error)
  process.exit(1)
})
