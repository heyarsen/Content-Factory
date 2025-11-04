-- Admin System Setup
-- Run this SQL in your Supabase SQL Editor to set up admin roles

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Insert admin role
INSERT INTO roles (name, description) 
VALUES ('admin', 'Administrator with full access to the platform')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- Enable Row Level Security
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles (read-only for authenticated users)
DROP POLICY IF EXISTS "Users can view roles" ON roles;
CREATE POLICY "Users can view roles" 
ON roles FOR SELECT 
USING (true);

-- RLS Policies for user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
CREATE POLICY "Users can view own roles" 
ON user_roles FOR SELECT 
USING (auth.uid() = user_id);

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid
    AND r.name = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user roles
CREATE OR REPLACE FUNCTION get_user_roles(user_uuid UUID)
RETURNS TABLE(role_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT r.name
  FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_roles(UUID) TO authenticated;

