-- Fix the database trigger to not use preferred_language (since column doesn't exist)
-- Run this in Supabase SQL editor AFTER the fix_credits_simple.sql

-- Update trigger function to remove preferred_language reference
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO user_profiles (id, credits)
    VALUES (NEW.id, 3)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Never block user signup if profile creation fails.
    RAISE LOG 'create_user_profile(): failed to create profile for user %, error: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_user_profile();
