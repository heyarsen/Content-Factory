# Connection Timeout Troubleshooting Guide

## Problem: Connection Timeout Errors

If you're seeing errors like:
```
ConnectTimeoutError: Connect Timeout Error
code: 'UND_ERR_CONNECT_TIMEOUT'
```

This means the backend cannot establish a connection to Supabase within the timeout period.

## Common Causes

### 1. Network Connectivity Issues
- Railway's network might have connectivity issues to Supabase
- Firewall or security group blocking outbound connections
- DNS resolution problems

### 2. Supabase URL Issues
- Incorrect Supabase URL
- Supabase project might be paused or deleted
- Regional connectivity issues

### 3. Railway Configuration
- Railway region might have poor connectivity to Supabase's region
- Network timeout settings too restrictive

## Solutions

### Solution 1: Verify Supabase URL and Project Status

1. **Check Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Verify the project is active (not paused)
   - Check the project URL matches your `SUPABASE_URL` environment variable

2. **Verify URL Format**
   - Should be: `https://your-project-id.supabase.co`
   - No trailing slashes
   - Using HTTPS (not HTTP)

### Solution 2: Test Connectivity from Railway

1. **Check Health Endpoint**
   - Visit: `https://your-backend-url.railway.app/health`
   - Look for `supabase.reachable: false` in the response
   - Check the error message for details

2. **Check Backend Logs**
   - Look for connection timeout errors
   - Check if retries are happening
   - Note the error codes (e.g., `UND_ERR_CONNECT_TIMEOUT`)

### Solution 3: Increase Timeout Settings

The backend now uses:
- **90 second timeout** for authentication requests
- **Automatic retry** with exponential backoff (3 attempts)
- **Retry delays**: 2s, 4s, 8s

If timeouts persist, you may need to:
1. Check Railway's network configuration
2. Verify Supabase project is in a reachable region
3. Consider using a different Railway region

### Solution 4: Check Railway Network Settings

1. **Verify Outbound Connections**
   - Railway should allow outbound HTTPS connections
   - Check if any firewall rules are blocking connections

2. **Check Railway Region**
   - Try deploying to a different Railway region
   - Some regions may have better connectivity to Supabase

### Solution 5: Verify Environment Variables

Ensure all required variables are set:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Debugging Steps

### Step 1: Check Health Endpoint
```bash
curl https://your-backend-url.railway.app/health
```

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

If `reachable: false`, check the error message.

### Step 2: Check Backend Logs

Look for these log messages:
```
[Auth] Using anon key for authentication with 90s timeout
[Auth] Connection timeout on attempt 1/3, retrying in 2000ms...
[Auth] CRITICAL: Backend cannot connect to Supabase (connection timeout)!
```

### Step 3: Test Supabase Connectivity

From Railway's shell or a test script:
```bash
curl -I https://your-project-id.supabase.co/rest/v1/
```

Should return HTTP 200 or 404 (not timeout).

## Temporary Workarounds

If connectivity issues persist:

1. **Wait and Retry**
   - Connection timeouts might be temporary
   - The backend now retries automatically (3 attempts)
   - Wait a few minutes and try again

2. **Check Supabase Status**
   - Visit: https://status.supabase.com/
   - Check if there are any ongoing issues

3. **Contact Support**
   - Railway Support: Check network connectivity issues
   - Supabase Support: Verify project accessibility

## Prevention

To prevent future timeout issues:

1. **Monitor Health Endpoint**
   - Set up monitoring for `/health` endpoint
   - Alert if `supabase.reachable: false`

2. **Use Connection Pooling**
   - Supabase client handles connection pooling automatically
   - Multiple requests reuse connections

3. **Implement Circuit Breaker**
   - Consider implementing a circuit breaker pattern
   - Fail fast if Supabase is unreachable

## Expected Behavior

After implementing the fixes:

1. **Successful Login**:
   ```
   [Auth] Using anon key for authentication with 90s timeout
   [Auth] Login successful for user@example.com
   ```

2. **Timeout with Retry**:
   ```
   [Auth] Connection timeout on attempt 1/3, retrying in 2000ms...
   [Auth] Connection timeout on attempt 2/3, retrying in 4000ms...
   [Auth] Login successful for user@example.com
   ```

3. **Permanent Failure**:
   ```
   [Auth] Connection timeout on attempt 3/3
   [Auth] CRITICAL: Backend cannot connect to Supabase (connection timeout)!
   ```

## Related Files

- `backend/src/routes/auth.ts` - Authentication with retry logic
- `backend/src/lib/supabase.ts` - Supabase client configuration
- `backend/src/server.ts` - Health check endpoint
- `SUPABASE_KEYS_SETUP.md` - Supabase keys setup guide

