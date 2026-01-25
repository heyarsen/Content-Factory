-- Debug script to check and fix user credits
-- Run this in Supabase SQL editor

-- 1. Check if user_profiles table has the preferred_language column
SELECT column_name, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check existing users without profiles
SELECT 
    u.id,
    u.email,
    u.created_at,
    up.credits,
    up.preferred_language,
    up.role
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.id
WHERE up.id IS NULL
ORDER BY u.created_at DESC;

-- 3. Check users with 0 credits
SELECT 
    u.id,
    u.email,
    u.created_at,
    up.credits,
    up.preferred_language,
    up.role
FROM auth.users u
JOIN user_profiles up ON u.id = up.id
WHERE up.credits = 0 OR up.credits IS NULL
ORDER BY u.created_at DESC;

-- 4. Manually create profiles for users without them (with 3 credits)
INSERT INTO user_profiles (id, credits, preferred_language, role)
SELECT 
    u.id,
    3 as credits,
    'en' as preferred_language,
    'user' as role
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO UPDATE SET
    credits = GREATEST(user_profiles.credits, 3),
    preferred_language = COALESCE(user_profiles.preferred_language, 'en');

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
    up.preferred_language,
    up.role
FROM auth.users u
JOIN user_profiles up ON u.id = up.id
WHERE u.created_at > NOW() - INTERVAL '1 day'
ORDER BY u.created_at DESC;
