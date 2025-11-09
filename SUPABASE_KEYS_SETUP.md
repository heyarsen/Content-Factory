# Supabase Keys Setup Guide

## Critical: Both Keys Are Required!

The backend **requires both** Supabase keys to function properly:

1. **SUPABASE_ANON_KEY** - Required for user authentication (login, signup)
2. **SUPABASE_SERVICE_ROLE_KEY** - Required for admin operations (database access, bypassing RLS)

## Why Both Keys?

### SUPABASE_ANON_KEY
- Used for user authentication operations (`signInWithPassword`, `signUp`)
- Required for login to work
- Public key (safe to expose in frontend, but backend needs it too)
- Located in: Supabase Dashboard > Settings > API > `anon` `public` key

### SUPABASE_SERVICE_ROLE_KEY
- Used for admin operations (bypassing Row Level Security)
- Required for database operations that need admin privileges
- **Secret key** - Never expose this in frontend code
- Located in: Supabase Dashboard > Settings > API > `service_role` `secret` key

## How to Get Both Keys

1. Go to your Supabase project dashboard
2. Navigate to **Settings** > **API**
3. You'll see two keys:
   - **anon public** - This is your `SUPABASE_ANON_KEY`
   - **service_role secret** - This is your `SUPABASE_SERVICE_ROLE_KEY`

## Setting Up in Railway (Backend)

Add both environment variables in your Railway backend service:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # anon public key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # service_role secret key
```

## Common Issues

### Issue: "Unable to connect to authentication service"
**Cause**: `SUPABASE_ANON_KEY` is missing or incorrect
**Solution**: 
1. Verify `SUPABASE_ANON_KEY` is set in Railway
2. Check that the key is the `anon public` key, not the `service_role` key
3. Redeploy the backend after adding the key

### Issue: Login returns 401 with network error
**Cause**: Backend cannot connect to Supabase
**Solution**:
1. Verify `SUPABASE_URL` is correct
2. Verify both keys are set correctly
3. Check backend logs for connection errors
4. Verify Supabase project is active and accessible

### Issue: Database operations fail
**Cause**: `SUPABASE_SERVICE_ROLE_KEY` is missing or incorrect
**Solution**:
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Railway
2. Check that the key is the `service_role secret` key
3. Redeploy the backend after adding the key

## Verification

After setting both keys, check backend logs on login attempt:
```
[Auth] Supabase URL: Set
[Auth] Service role key: Set (length: XXX)
[Auth] Anon key: Set (length: XXX)
[Auth] Using anon key for authentication
```

If you see "Anon key: Missing", login will fail with a connection error.

## Security Notes

- **SUPABASE_ANON_KEY**: Can be public (used in frontend), but should still be kept secure
- **SUPABASE_SERVICE_ROLE_KEY**: **NEVER** expose in frontend code. This is a secret key with admin privileges.
- Both keys should be stored as environment variables, never hardcoded
- Rotate keys if compromised

## Quick Checklist

- [ ] `SUPABASE_URL` is set and correct
- [ ] `SUPABASE_ANON_KEY` is set (anon public key)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (service_role secret key)
- [ ] Backend has been redeployed after adding keys
- [ ] Backend logs show both keys are "Set"
- [ ] Login works without "Unable to connect" errors

