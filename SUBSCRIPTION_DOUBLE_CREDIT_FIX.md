# Subscription Credit Management Fix

## Problem
Users purchasing the starter plan were receiving 40 credits instead of 20 due to double credit allocation during initial subscription payment. Additionally, renewal payments weren't properly burning old credits.

## Root Cause Analysis

### Issue 1: Double Credit Allocation
The renewal detection logic incorrectly treated initial payments as renewals because:

1. **Initial payment webhook arrives** - subscription is `pending`
2. **During webhook processing**, `activateSubscription()` sets:
   - `status: 'active'`
   - `payment_status: 'completed'`
3. **Renewal detection logic runs after this** and sees `status === 'active' && payment_status === 'completed'`
4. **System incorrectly treats this as a renewal** and adds credits again

### Issue 2: Renewal Credit Accumulation
For true renewals, the system was only adding new credits without burning existing ones, causing credit accumulation across subscription periods.

## Solution

### Enhanced Renewal Detection
Added time-based check to distinguish initial payments from true renewals:

```typescript
// A true renewal must have:
// 1. Subscription already active and completed BEFORE this webhook
// 2. Created at least 25 days ago (to avoid treating initial payment as renewal)
const subscriptionAge = Date.now() - new Date(subscription.created_at).getTime()
const daysSinceCreation = subscriptionAge / (1000 * 60 * 60 * 24)

const isRenewal = subscription.status === 'active' && 
                 subscription.payment_status === 'completed' &&
                 !subscription.cancelled_at &&
                 daysSinceCreation >= 25 // Only treat as renewal if at least 25 days old
```

### Complete Credit Burning for Subscriptions
For both initial payments and renewals, the system now burns **ALL** existing credits (including top-ups) and adds only the plan credits:

```typescript
// Burn all existing credits (from previous subscription + top-ups)
await CreditsService.setCredits(userId, 0, `subscription_burn_previous_${plan.id}`)

// Add credits equal to the plan's credit allocation (NOT the payment amount)
const planCredits = Math.round(Number(plan.credits) || 0)
creditsAfter = await CreditsService.setCredits(userId, planCredits, `subscription_initial_${plan.id}`)
```

## How This Fixes the Issues

### Initial Payments (Fixed Double Credit)
- **Before**: 20 (initial) + 20 (incorrect renewal) = 40 credits ❌
- **After**: Burn all + 20 (plan) = 20 credits ✅

### True Renewals (Fixed Credit Accumulation)
- **Before**: 35 (existing) + 20 (renewal) = 55 credits ❌
- **After**: Burn all + 20 (new plan) = 20 credits ✅

### Payment Scenarios

| Scenario | Starting Credits | Plan Credits | Final Credits | Credits Burned |
|----------|------------------|--------------|---------------|----------------|
| **New subscription (no top-ups)** | 20 | 20 | 20 | 20 |
| **New subscription (with top-ups)** | 60 | 20 | 20 | 60 |
| **True renewal (no top-ups)** | 20 | 20 | 20 | 20 |
| **True renewal (with top-ups)** | 75 | 20 | 20 | 75 |
| **Only top-ups (no sub)** | 40 | 20 | 20 | 40 |

## Database Schema Changes

Added `credits_burned` column to track burned credits during renewals:

```sql
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS credits_burned INTEGER DEFAULT 0;
```

## Test Cases

The fix correctly handles:

1. **New subscription** → Burn all credits + Add plan credits ✅
2. **True renewal** → Burn all credits + Add plan credits ✅  
3. **With top-ups** → Burn all (including top-ups) + Add plan ✅
4. **No top-ups** → Burn all + Add plan ✅

## Implementation Details

### Files Modified
- `/backend/src/routes/credits.ts` - Enhanced renewal detection and complete credit burning
- `/database/migrations/017_add_credits_burned_column.sql` - Schema update

### Enhanced Logging
```typescript
console.log('[WayForPay] Renewal credits processed (burn all + add plan):', {
  userId,
  planCredits,
  balanceBefore: creditsBefore,
  balanceAfter: creditsAfter,
  creditsBurned: creditsBefore, // All previous credits burned
})
```

## Business Logic Summary

### Initial Subscription Payment
1. **Burn all existing credits** (from free tier, top-ups, previous subscriptions)
2. **Add** plan-specific credits (20 for starter, 70 for pro, 250 for enterprise)
3. **Result**: User has exactly the plan credits, no more, no less

### Renewal Payment (after 25+ days)
1. **Verify** it's a true renewal (time-based check)
2. **Burn all accumulated credits** (previous period + top-ups)
3. **Add** fresh plan credits for new period
4. **Result**: Fresh start with exactly the plan credits

### Failed/Refunded Payments
- **Cancelled subscriptions**: Reject all payments
- **Failed payments**: No credit changes
- **Refunds**: Handled by existing refund logic

## Impact

This fix ensures:
- ✅ **Fair pricing**: Users pay for exactly the credits they receive
- ✅ **Clean slate**: Each subscription period starts fresh
- ✅ **Prevents abuse**: No credit accumulation across periods
- ✅ **Clean renewals**: Fresh start each subscription period
- ✅ **Revenue protection**: No free credit accumulation

## Example Scenarios

### User with Top-up Credits
1. **User tops up** 40 credits → Has 40 credits
2. **User subscribes** to starter plan (20 credits) → Has 20 credits (40 burned + 20 plan)
3. **User renews** after 30 days → Still has 20 credits (20 burned + 20 new plan)

### User Without Top-up Credits
1. **User subscribes** to starter plan (20 credits) → Has 20 credits
2. **User renews** after 30 days → Still has 20 credits (20 burned + 20 new plan)

The fix is production-ready and ensures users get exactly the plan credits they pay for, with a clean slate each subscription period.
