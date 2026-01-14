-- Assign Admin Role (Correct Method)
-- Run this in Supabase SQL Editor

-- 1. Replace with your email
DO $$
DECLARE
  target_email TEXT := 'YOUR_EMAIL_HERE'; -- CHANGE THIS
  target_user_id UUID;
BEGIN
  -- Find user ID
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', target_email;
  END IF;

  -- Update user_profiles
  UPDATE user_profiles
  SET role = 'admin'
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    -- Try to insert if profile doesn't exist (triggers should handle this usually, but safe fallback)
    INSERT INTO user_profiles (id, role)
    VALUES (target_user_id, 'admin');
  END IF;

  RAISE NOTICE 'Admin role successfully assigned to %', target_email;
END $$;
