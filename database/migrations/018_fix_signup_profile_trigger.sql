-- Migration: Fix signup profile trigger robustness
-- Prevent "Database error saving new user" if user_profiles insert fails for any reason.

-- Ensure an INSERT policy exists for backend/system inserts (and triggers if needed)
DROP POLICY IF EXISTS "System can create profiles" ON user_profiles;
CREATE POLICY "System can create profiles"
  ON user_profiles
  FOR INSERT
  WITH CHECK (true);

-- Recreate trigger function with exception handling
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO user_profiles (id, credits, preferred_language)
    VALUES (NEW.id, 3, 'en')
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


