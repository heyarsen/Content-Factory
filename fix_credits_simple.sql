-- Simple fix script for user credits (no preferred_language column)
-- Run this in Supabase SQL editor

-- 1. Check current user_profiles table structure
SELECT column_name, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Find users without profiles
SELECT 
    u.id,
    u.email,
    u.created_at,
    up.credits,
    up.role
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.id
WHERE up.id IS NULL
ORDER BY u.created_at DESC;

-- 3. Find users with 0 credits
SELECT 
    u.id,
    u.email,
    u.created_at,
    up.credits,
    up.role
FROM auth.users u
JOIN user_profiles up ON u.id = up.id
WHERE up.credits = 0 OR up.credits IS NULL
ORDER BY u.created_at DESC;

-- 4. Manually create profiles for users without them (with 3 credits)
INSERT INTO user_profiles (id, credits, role)
SELECT 
    u.id,
    3 as credits,
    'user' as role
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO UPDATE SET
    credits = GREATEST(user_profiles.credits, 3);

-- 5. Update users with 0 credits to have 3 credits
UPDATE user_profiles 
SET credits = 3 
WHERE credits = 0 OR credits IS NULL;

-- 6. Verify the fix
SELECT 
    u.id,
    u.email,
    u.created_at,
    up.credits,
    up.role
FROM auth.users u
JOIN user_profiles up ON u.id = up.id
WHERE u.created_at > NOW() - INTERVAL '1 day'
ORDER BY u.created_at DESC;

-- 7. Check the trigger function
SELECT proname, prosrc FROM pg_proc WHERE proname = 'create_user_profile';
