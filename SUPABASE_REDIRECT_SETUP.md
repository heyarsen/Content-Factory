# Supabase Redirect URL Configuration

## Problem
Email verification links are redirecting to `localhost:3000` instead of your production domain.

## Solution

### Step 1: Update Railway Environment Variables

Add/Update in Railway dashboard:
```
CORS_ORIGIN=https://app.contentfabrica.com
FRONTEND_URL=https://app.contentfabrica.com
```

### Step 2: Configure Supabase Dashboard

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. Add these **Redirect URLs**:

```
https://app.contentfabrica.com
https://app.contentfabrica.com/login
https://app.contentfabrica.com/reset-password
https://app.contentfabrica.com/social/callback
```

5. Click **Save**

### Step 3: Update Site URL (Optional but Recommended)

In **Authentication** → **URL Configuration**:
- Set **Site URL** to: `https://app.contentfabrica.com`

### Step 4: Redeploy Backend

After updating environment variables, redeploy your Railway service so the new `CORS_ORIGIN` is used.

## Verification

After these steps:
1. Try signing up again
2. Check the verification email
3. The link should now redirect to `https://app.contentfabrica.com/login` instead of `localhost`

## Troubleshooting

- **Still seeing localhost**: Clear your browser cache or try incognito mode
- **Redirect not working**: Make sure the exact URLs are added in Supabase dashboard (including https://)
- **CORS errors**: Ensure `CORS_ORIGIN` in Railway matches your domain exactly

