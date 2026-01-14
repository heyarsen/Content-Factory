# How to Create an Admin Account

## Quick Setup Guide

### Step 1: Set Up Admin System (One-Time Setup)

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Run the `database/admin_setup.sql` file:
   - This ensures `user_profiles.role` exists
   - Sets up the `is_admin()` helper function (optional)

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

### Step 3: Assign Admin Role (recommended)

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy and paste this SQL (replace the email with your actual email):

```sql
-- Replace with your email
UPDATE user_profiles up
SET role = 'admin'
FROM auth.users u
WHERE up.id = u.id
  AND u.email = 'your-email@example.com';
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
UPDATE user_profiles
SET role = 'admin'
WHERE id = 'USER_ID_HERE';
```

---

## Verify All Admins

To see all users with admin role:

```sql
SELECT u.email, up.role
FROM auth.users u
JOIN user_profiles up ON up.id = u.id
WHERE up.role = 'admin';
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
- Verify the admin check endpoint: `/api/admin/check` returns `{ isAdmin: true }`

