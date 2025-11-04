-- Create First Admin Account
-- Run this SQL in your Supabase SQL Editor after creating a user account
-- 
-- Instructions:
-- 1. First, sign up a user account through the app (or create one in Supabase Auth)
-- 2. Note the user's email address
-- 3. Run this script, replacing 'YOUR_USER_EMAIL@example.com' with the actual email
--
-- Alternatively, you can find the user ID in Supabase Dashboard > Authentication > Users
-- and use the user ID directly instead of email

-- Method 1: Assign admin role by email
-- Replace 'YOUR_USER_EMAIL@example.com' with the actual email
DO $$
DECLARE
  target_user_id UUID;
  admin_role_id UUID;
BEGIN
  -- Find user by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'YOUR_USER_EMAIL@example.com';
  
  -- Check if user exists
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email YOUR_USER_EMAIL@example.com not found';
  END IF;
  
  -- Get admin role ID
  SELECT id INTO admin_role_id
  FROM roles
  WHERE name = 'admin';
  
  -- Check if admin role exists
  IF admin_role_id IS NULL THEN
    RAISE EXCEPTION 'Admin role not found. Please run admin_setup.sql first.';
  END IF;
  
  -- Assign admin role (ignore if already exists)
  INSERT INTO user_roles (user_id, role_id)
  VALUES (target_user_id, admin_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
  
  RAISE NOTICE 'Admin role assigned successfully';
END $$;

-- Method 2: Assign admin role by user ID directly
-- Uncomment and replace 'USER_ID_HERE' with the actual UUID
/*
DO $$
DECLARE
  target_user_id UUID := 'USER_ID_HERE';
  admin_role_id UUID;
BEGIN
  -- Get admin role ID
  SELECT id INTO admin_role_id
  FROM roles
  WHERE name = 'admin';
  
  IF admin_role_id IS NULL THEN
    RAISE EXCEPTION 'Admin role not found. Please run admin_setup.sql first.';
  END IF;
  
  -- Assign admin role
  INSERT INTO user_roles (user_id, role_id)
  VALUES (target_user_id, admin_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
  
  RAISE NOTICE 'Admin role assigned successfully';
END $$;
*/

-- Verify admin assignment
-- Run this to see all admin users:
SELECT 
  u.email,
  u.created_at,
  r.name as role_name
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.name = 'admin';

