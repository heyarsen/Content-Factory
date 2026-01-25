-- SIMPLE CREDIT FIX - Run this in Supabase SQL Editor
-- This will give 3 credits to all users who need them

-- Give 3 credits to users without profiles
INSERT INTO user_profiles (id, credits, role)
SELECT 
    u.id,
    3 as credits,
    'user' as role
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO UPDATE SET
    credits = GREATEST(user_profiles.credits, 3);

-- Update users with 0 credits to have 3 credits  
UPDATE user_profiles 
SET credits = 3 
WHERE credits = 0 OR credits IS NULL;

-- Check if it worked - you should see your account with 3 credits here
SELECT 
    u.email,
    u.created_at,
    up.credits
FROM auth.users u
JOIN user_profiles up ON u.id = up.id
WHERE u.created_at > NOW() - INTERVAL '2 days'
ORDER BY u.created_at DESC;
