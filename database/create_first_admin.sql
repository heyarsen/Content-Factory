-- Create First Admin Account
-- Run this SQL in your Supabase SQL Editor after creating a user account

-- Instructions:
-- 1. Sign up a user account through the app
-- 2. Run this script, replacing 'YOUR_USER_EMAIL@example.com' with the actual email

DO $$
DECLARE
  target_email TEXT := 'YOUR_USER_EMAIL@example.com'; -- REPLACE THIS
  target_user_id UUID;
BEGIN
  -- Find user by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = target_email;
  
  -- Check if user exists
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', target_email;
  END IF;
  
  -- Update user_profiles (modern RBAC system)
  UPDATE user_profiles 
  SET role = 'admin'
  WHERE id = target_user_id;
  
  RAISE NOTICE 'Admin role assigned successfully to %', target_email;
END $$;

-- Verify admin assignment
SELECT 
  u.email,
  p.role
FROM auth.users u
JOIN user_profiles p ON u.id = p.id
WHERE p.role = 'admin';

