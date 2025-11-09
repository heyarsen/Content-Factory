# Login Timeout Troubleshooting Guide

## Current Issue
Login attempts are failing with:
```
401 Unauthorized
Error: "Unable to connect to authentication service. The connection timed out. This might be a temporary network issue. Please try again in a few moments."
```

This indicates the backend cannot establish a connection to Supabase within the timeout period (90 seconds with 3 retry attempts).

## Immediate Diagnostic Steps

### Step 1: Check Health Endpoint
Visit: `https://app.contentfabrica.com/health`

Expected response:
```json
{
  "status": "ok",
  "supabase": {
    "reachable": true,
    "status": 200,
    "url": "https://your-project.supabase.co"
  }
}
```

If `reachable: false`, note the error message and error code.

### Step 2: Check Detailed Diagnostics
Visit: `https://app.contentfabrica.com/diagnostics/supabase`

This will show:
- Environment variable status
- Connectivity tests to Supabase REST API
- Connectivity tests to Supabase Auth API
- DNS resolution status
- Detailed error codes and timing

### Step 3: Check Railway Backend Logs
Look for these log messages:
```
[Auth] Using anon key for authentication with 90s timeout
[Auth] Connection timeout on attempt 1/3, retrying in 2000ms...
[Auth] Connection timeout on attempt 2/3, retrying in 4000ms...
[Auth] Connection timeout on attempt 3/3
[Auth] CRITICAL: Backend cannot connect to Supabase (connection timeout)!
```

## Common Causes and Solutions

### Cause 1: Supabase Project Paused
**Check:**
1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Check if your project shows "Paused" status
3. If paused, click "Restore" to reactivate

**Solution:** Restore the Supabase project if it's paused.

### Cause 2: Incorrect Supabase URL
**Check:**
1. Railway Dashboard → Your Backend Service → Variables
2. Verify `SUPABASE_URL` matches your Supabase project URL
3. Should be: `https://your-project-id.supabase.co`
4. No trailing slashes

**Solution:** Update `SUPABASE_URL` in Railway if incorrect.

### Cause 3: Missing or Incorrect API Keys
**Check:**
1. Railway Dashboard → Variables
2. Verify both keys are set:
   - `SUPABASE_ANON_KEY` (required for login)
   - `SUPABASE_SERVICE_ROLE_KEY` (required for admin operations)
3. Get keys from: Supabase Dashboard → Settings → API

**Solution:** 
- Add missing keys
- Verify keys are correct (no extra spaces, complete keys)

### Cause 4: Network Connectivity Issue
**Symptoms:**
- Health check shows `reachable: false`
- Diagnostics show connection timeout errors
- Error code: `UND_ERR_CONNECT_TIMEOUT`

**Possible Causes:**
- Railway region has connectivity issues to Supabase
- Firewall blocking outbound HTTPS connections
- DNS resolution problems

**Solutions:**
1. **Try Different Railway Region:**
   - Railway Dashboard → Your Service → Settings
   - Change deployment region
   - Redeploy

2. **Check Railway Network Settings:**
   - Verify outbound HTTPS (port 443) is allowed
   - Check if any firewall rules are blocking connections

3. **Verify Supabase Project Region:**
   - Supabase Dashboard → Settings → General
   - Note the region
   - Try deploying Railway service in the same region

### Cause 5: Supabase Rate Limiting
**Check:**
- Supabase Dashboard → Settings → API
- Check if you're hitting rate limits
- Look for any warnings or restrictions

**Solution:** Wait a few minutes and try again, or upgrade Supabase plan if needed.

## Verification Checklist

- [ ] Health endpoint shows `supabase.reachable: true`
- [ ] Diagnostics endpoint shows all tests passing
- [ ] `SUPABASE_URL` is set correctly in Railway
- [ ] `SUPABASE_ANON_KEY` is set correctly in Railway
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set correctly in Railway
- [ ] Supabase project is active (not paused)
- [ ] Backend logs show retry attempts (not immediate failure)
- [ ] No firewall blocking outbound HTTPS connections

## Quick Fixes

### Fix 1: Restart Backend Service
1. Railway Dashboard → Your Service
2. Click "Redeploy" or "Restart"
3. Wait for deployment to complete
4. Try login again

### Fix 2: Verify Environment Variables
1. Railway Dashboard → Variables
2. Check all three Supabase variables are set
3. Copy values from Supabase Dashboard to ensure accuracy
4. Redeploy after changes

### Fix 3: Test Supabase Connectivity Manually
From Railway's shell or a test script:
```bash
curl -I https://your-project-id.supabase.co/rest/v1/
curl -I https://your-project-id.supabase.co/auth/v1/health
```

Both should return HTTP 200 or 404 (not timeout).

## Expected Behavior After Fix

**Successful Login:**
```
[Auth] Using anon key for authentication with 90s timeout
[Auth] Login successful for user@example.com
```

**Timeout with Retry (should eventually succeed):**
```
[Auth] Connection timeout on attempt 1/3, retrying in 2000ms...
[Auth] Connection timeout on attempt 2/3, retrying in 4000ms...
[Auth] Login successful for user@example.com
```

## Still Not Working?

If all checks pass but login still fails:

1. **Check Supabase Status:**
   - Visit: https://status.supabase.com/
   - Check for ongoing issues

2. **Contact Support:**
   - Railway Support: Check network connectivity
   - Supabase Support: Verify project accessibility

3. **Temporary Workaround:**
   - Wait 5-10 minutes and try again
   - Connection issues are often temporary

## Related Files

- `backend/src/routes/auth.ts` - Authentication with retry logic
- `backend/src/lib/supabase.ts` - Supabase client configuration
- `backend/src/server.ts` - Health check and diagnostics endpoints
- `CONNECTION_TIMEOUT_TROUBLESHOOTING.md` - General connection timeout guide

