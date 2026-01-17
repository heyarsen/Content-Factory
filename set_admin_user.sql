-- Update user role to admin
UPDATE user_profiles 
SET role = 'admin' 
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'heyarsen@icloud.com'
);

-- Verify the change
SELECT id, email, (SELECT role FROM user_profiles WHERE id = auth.users.id) as role 
FROM auth.users 
WHERE email = 'heyarsen@icloud.com';
