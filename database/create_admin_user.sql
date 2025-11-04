-- Create Admin User Script
-- Replace 'YOUR_ADMIN_EMAIL' with the email of the user you want to make admin
-- Replace 'YOUR_USER_ID' with the UUID of the user from auth.users table

-- Step 1: Find your user ID (run this first to get the user ID)
-- SELECT id, email FROM auth.users WHERE email = 'YOUR_ADMIN_EMAIL';

-- Step 2: Assign admin role to user (replace YOUR_USER_ID with the ID from step 1)
-- INSERT INTO user_roles (user_id, role_id)
-- SELECT 
--   'YOUR_USER_ID'::UUID,
--   id
-- FROM roles
-- WHERE name = 'admin'
-- ON CONFLICT (user_id, role_id) DO NOTHING;

-- Example: If your admin email is admin@example.com and user ID is 123e4567-e89b-12d3-a456-426614174000
-- INSERT INTO user_roles (user_id, role_id)
-- SELECT 
--   '123e4567-e89b-12d3-a456-426614174000'::UUID,
--   id
-- FROM roles
-- WHERE name = 'admin'
-- ON CONFLICT (user_id, role_id) DO NOTHING;

