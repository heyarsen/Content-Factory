# Login Troubleshooting Guide

This guide helps diagnose and fix login issues.

## Quick Checks

### 1. Backend Server Status
- **Check if backend is running**: Visit `http://localhost:3001/health` (or your API URL)
- **Expected response**: `{"status":"ok","timestamp":"..."}`
- **If not responding**: Start the backend server with `npm run dev` in the `backend` directory

### 2. Frontend API URL Configuration
- **Check environment variable**: Look for `VITE_API_URL` in your `.env` file
- **Default**: `http://localhost:3001`
- **Verify**: Check browser console for `[Auth] API URL: ...` log message

### 3. Backend Environment Variables
Ensure these are set in your backend `.env` file:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CORS_ORIGIN=http://localhost:5173
PORT=3001
```

### 4. Browser Console
Check the browser console (F12) for:
- `[Auth] Attempting to sign in...`
- `[Auth] API URL: ...`
- `[Auth] Login response received: ...`
- Any error messages

### 5. Backend Logs
Check backend terminal for:
- `[Auth] Login attempt for email: ...`
- `[Auth] Supabase URL: Set/Missing`
- `[Auth] Service role key: Set/Missing`
- `[Auth] Login successful/failed: ...`

## Common Issues and Solutions

### Issue: "Unable to connect to server"
**Symptoms**: Network error, connection refused, timeout
**Solutions**:
1. Verify backend server is running on port 3001
2. Check if `VITE_API_URL` matches your backend URL
3. Check firewall/network settings
4. Verify CORS is configured correctly

### Issue: "Invalid email or password"
**Symptoms**: Login fails with authentication error
**Solutions**:
1. Verify email and password are correct
2. Check if email is verified (check inbox for verification email)
3. Try resetting password if needed
4. Check Supabase dashboard for user status

### Issue: "Too many authentication requests"
**Symptoms**: Rate limit error
**Solutions**:
1. Wait 15 minutes and try again
2. Check if multiple login attempts were made
3. Verify rate limiter configuration in `backend/src/middleware/rateLimiter.ts`

### Issue: "Failed to create session"
**Symptoms**: Login succeeds but no session created
**Solutions**:
1. Check Supabase credentials are correct
2. Verify Supabase service is accessible
3. Check backend logs for detailed error messages
4. Verify SUPABASE_SERVICE_ROLE_KEY is set correctly

### Issue: Backend returns 500 error
**Symptoms**: Internal server error
**Solutions**:
1. Check backend logs for error details
2. Verify all environment variables are set
3. Check Supabase connection
4. Verify database is accessible

## Debug Steps

1. **Test Backend Health**
   ```bash
   curl http://localhost:3001/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Test Login Endpoint Directly**
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"testpassword"}'
   ```

3. **Check Environment Variables**
   ```bash
   # Backend
   cd backend
   cat .env | grep SUPABASE
   
   # Frontend
   cd frontend
   cat .env | grep VITE_API_URL
   ```

4. **Check Browser Network Tab**
   - Open browser DevTools (F12)
   - Go to Network tab
   - Try to login
   - Check the `/api/auth/login` request:
     - Status code
     - Request payload
     - Response body
     - Error messages

5. **Check Backend Logs**
   - Look for `[Auth]` prefixed log messages
   - Check for error stack traces
   - Verify Supabase connection status

## Verification Checklist

- [ ] Backend server is running
- [ ] Frontend can reach backend (health check passes)
- [ ] Environment variables are set correctly
- [ ] Supabase credentials are correct
- [ ] CORS is configured properly
- [ ] No rate limiting issues
- [ ] User email is verified (if required)
- [ ] Browser console shows no blocking errors
- [ ] Backend logs show login attempt

## Getting Help

If issues persist, provide:
1. Browser console logs (all `[Auth]` messages)
2. Backend server logs (all `[Auth]` messages)
3. Network tab screenshot of the login request
4. Environment variable status (without sensitive values)
5. Error messages shown to the user

## Recent Changes

The login flow has been updated with:
- Better error handling and logging
- Health check before login attempt
- More detailed error messages
- Improved debugging information
- Better network error detection

