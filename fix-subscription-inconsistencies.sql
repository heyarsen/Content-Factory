-- Fix subscription inconsistencies SQL script
-- This script checks and fixes any mismatches between user_profiles and user_subscriptions

-- First, let's see the current state
SELECT 
    'Current active subscriptions by status:' as info;

SELECT 
    status,
    payment_status,
    COUNT(*) as count
FROM user_subscriptions 
WHERE status IN ('active', 'pending')
GROUP BY status, payment_status
ORDER BY status, payment_status;

-- Check for inconsistencies
SELECT 
    'Inconsistencies found:' as info;

SELECT 
    up.id as user_id,
    up.has_active_subscription as profile_has_active,
    COUNT(us.id) as active_sub_count,
    STRING_AGG(us.status || ':' || us.payment_status, ', ') as subscription_details
FROM user_profiles up
LEFT JOIN user_subscriptions us ON up.id = us.user_id 
    AND (us.status = 'active' OR us.status = 'pending')
GROUP BY up.id, up.has_active_subscription
HAVING 
    (up.has_active_subscription = true AND COUNT(us.id) = 0) OR
    (up.has_active_subscription = false AND COUNT(us.id) > 0)
ORDER BY up.id;

-- Fix users who have active subscriptions but profile shows false
UPDATE user_profiles 
SET has_active_subscription = true,
    current_subscription_id = sub.latest_sub_id
FROM (
    SELECT 
        us.user_id,
        MAX(us.id) as latest_sub_id
    FROM user_subscriptions us
    WHERE us.status IN ('active', 'pending')
    GROUP BY us.user_id
) sub
WHERE user_profiles.id = sub.user_id 
    AND user_profiles.has_active_subscription = false;

-- Fix users who have no active subscriptions but profile shows true
UPDATE user_profiles 
SET has_active_subscription = false,
    current_subscription_id = NULL
WHERE id IN (
    SELECT up.id
    FROM user_profiles up
    LEFT JOIN user_subscriptions us ON up.id = us.user_id 
        AND (us.status = 'active' OR us.status = 'pending')
    WHERE up.has_active_subscription = true 
    GROUP BY up.id
    HAVING COUNT(us.id) = 0
);

-- Show the results after fixes
SELECT 
    'Results after fixes:' as info;

SELECT 
    up.id as user_id,
    up.has_active_subscription as profile_has_active,
    COUNT(us.id) as active_sub_count,
    CASE 
        WHEN up.has_active_subscription = true AND COUNT(us.id) > 0 THEN '✅ Consistent'
        WHEN up.has_active_subscription = false AND COUNT(us.id) = 0 THEN '✅ Consistent'
        ELSE '❌ Inconsistent'
    END as status
FROM user_profiles up
LEFT JOIN user_subscriptions us ON up.id = us.user_id 
    AND (us.status = 'active' OR us.status = 'pending')
GROUP BY up.id, up.has_active_subscription
ORDER BY up.id;

-- Summary
SELECT 
    'Summary:' as info;

SELECT 
    'Total users with active subscriptions in user_subscriptions:' as description,
    COUNT(DISTINCT us.user_id) as count
FROM user_subscriptions us
WHERE us.status IN ('active', 'pending');

SELECT 
    'Total users with has_active_subscription = true in profiles:' as description,
    COUNT(*) as count
FROM user_profiles 
WHERE has_active_subscription = true;

SELECT 
    'Users with consistent subscription status:' as description,
    COUNT(*) as count
FROM (
    SELECT 
        up.id,
        up.has_active_subscription,
        COUNT(us.id) as active_sub_count
    FROM user_profiles up
    LEFT JOIN user_subscriptions us ON up.id = us.user_id 
        AND (us.status = 'active' OR us.status = 'pending')
    GROUP BY up.id, up.has_active_subscription
    HAVING 
        (up.has_active_subscription = true AND COUNT(us.id) > 0) OR
        (up.has_active_subscription = false AND COUNT(us.id) = 0)
) consistent;
