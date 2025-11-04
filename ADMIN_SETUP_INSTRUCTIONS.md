# How to Create an Admin Account

## Quick Setup Guide

### Step 1: Set Up Admin System (One-Time Setup)

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Run the `database/admin_setup.sql` file:
   - This creates the `roles` and `user_roles` tables
   - Sets up the `is_admin()` and `get_user_roles()` functions
   - Configures RLS policies

### Step 2: Create a User Account

You need to have a user account first. You can either:

**Option A: Sign up through the app**
- Go to your app's signup page
- Create a new account with your email
- Verify your email if required

**Option B: Create in Supabase Dashboard**
- Go to **Authentication** → **Users**
- Click **"Add user"** → **"Create new user"**
- Enter email and password
- Click **"Create user"**

### Step 3: Assign Admin Role

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy and paste this SQL (replace the email with your actual email):

```sql
DO $$
DECLARE
  target_user_id UUID;
  admin_role_id UUID;
BEGIN
  -- Find user by email (REPLACE THIS EMAIL)
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'your-email@example.com';
  
  -- Check if user exists
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email not found';
  END IF;
  
  -- Get admin role ID
  SELECT id INTO admin_role_id
  FROM roles
  WHERE name = 'admin';
  
  -- Check if admin role exists
  IF admin_role_id IS NULL THEN
    RAISE EXCEPTION 'Admin role not found. Please run admin_setup.sql first.';
  END IF;
  
  -- Assign admin role
  INSERT INTO user_roles (user_id, role_id)
  VALUES (target_user_id, admin_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
  
  RAISE NOTICE 'Admin role assigned successfully';
END $$;
```

3. **Replace `'your-email@example.com'`** with your actual email address
4. Click **"Run"** or press `Cmd/Ctrl + Enter`

### Step 4: Verify Admin Access

1. **Log out** of the app (if you're logged in)
2. **Log back in** with the admin account
3. You should now see **"Admin Panel"** in the sidebar
4. Click it to access `/admin`

---

## Alternative: Using User ID Directly

If you prefer to use the user ID instead of email:

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Find your user and copy the **User UUID**
3. Use this SQL (replace `USER_ID_HERE` with the actual UUID):

```sql
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
```

---

## Verify All Admins

To see all users with admin role:

```sql
SELECT 
  u.email,
  u.created_at,
  r.name as role_name
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.name = 'admin';
```

---

## Troubleshooting

**Error: "Admin role not found"**
- Make sure you ran `admin_setup.sql` first
- Check that the `roles` table exists and has an 'admin' role

**Error: "User with email not found"**
- Make sure the user account exists
- Check the email spelling (case-sensitive in some cases)
- Verify the user in Supabase Dashboard → Authentication → Users

**Admin Panel not showing in sidebar**
- Log out and log back in after assigning admin role
- Check browser console for errors
- Verify the admin check endpoint: `/api/admin/check` returns `{ isAdmin: true }`

