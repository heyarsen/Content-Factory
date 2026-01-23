-- Check user subscriptions
SELECT 
    u.id as user_id,
    u.email,
    up.role,
    up.has_active_subscription as profile_has_subscription,
    us.id as subscription_id,
    us.status as subscription_status,
    us.payment_status,
    us.created_at,
    us.started_at,
    us.expires_at
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.id
LEFT JOIN user_subscriptions us ON u.id = us.user_id
ORDER BY us.created_at DESC;

-- Check specifically for any active or pending subscriptions
SELECT 
    user_id,
    status,
    payment_status,
    COUNT(*) as count
FROM user_subscriptions
WHERE status IN ('active', 'pending')
GROUP BY user_id, status, payment_status
ORDER BY user_id;
