-- Admin System Setup (CURRENT)
-- The application determines admin status via user_profiles.role = 'admin'

-- 1) Ensure the role column exists (migration 021 does this, but this is safe to re-run)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- 2) Convenience function: is_admin(user_uuid)
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles up
    WHERE up.id = user_uuid
      AND up.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Allow authenticated users to call is_admin()
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO authenticated;

