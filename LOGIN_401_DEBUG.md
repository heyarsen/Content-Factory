# Debugging 401 Login Error

## Current Issue
Getting 401 Unauthorized when attempting to log in at `https://app.contentfabrica.com/api/auth/login`

## What 401 Means
A 401 response means the request reached the backend, but authentication failed. This is different from a connection error.

## Common Causes

### 1. Invalid Credentials (Most Common)
- **Symptom**: 401 with "Invalid email or password"
- **Solution**: 
  - Verify email and password are correct
  - Check for typos or extra spaces
  - Try resetting password if unsure

### 2. Email Not Verified
- **Symptom**: 401 with "Please verify your email"
- **Solution**:
  - Check inbox for verification email
  - Check spam folder
  - Request new verification email
  - In Supabase dashboard, manually verify email if needed

### 3. API URL Configuration
- **Symptom**: Request going to wrong URL
- **Current**: `https://app.contentfabrica.com/` (frontend URL)
- **Expected**: Backend API URL (e.g., `https://your-backend.railway.app` or `https://api.contentfabrica.com`)
- **Solution**:
  - Check `VITE_API_URL` environment variable in frontend
  - Should point to backend URL, not frontend URL
  - Update in deployment environment variables

### 4. Rate Limiting
- **Symptom**: 429 or 401 after multiple failed attempts
- **Current Limit**: 10 requests per 15 minutes per IP
- **Solution**: Wait 15 minutes or check backend logs

### 5. Supabase Configuration
- **Symptom**: Backend can't connect to Supabase
- **Check**:
  - `SUPABASE_URL` is set correctly
  - `SUPABASE_SERVICE_ROLE_KEY` is set correctly
  - Supabase project is active
  - Network connectivity to Supabase

## Debugging Steps

### Step 1: Check Browser Console
Look for the detailed error logs we added:
```javascript
[Auth] Sign in error: {
  message: '...',
  response: { data: { error: '...' } },
  status: 401,
  ...
}
```

### Step 2: Check Backend Logs
Look for these log messages:
```
[Auth] Login request received: { ... }
[Auth] Login attempt for email: ...
[Auth] Supabase URL: Set/Missing
[Auth] Service role key: Set/Missing
[Auth] Login failed for ...: { message: '...', ... }
```

### Step 3: Verify API URL
1. Check frontend environment variable `VITE_API_URL`
2. Should be backend URL, not frontend URL
3. If frontend and backend are on same domain, ensure backend routes are properly configured

### Step 4: Test Backend Directly
```bash
curl -X POST https://your-backend-url/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword"}'
```

### Step 5: Check Supabase Dashboard
1. Go to Supabase Dashboard
2. Check Authentication > Users
3. Verify user exists
4. Check if email is confirmed
5. Check if user is blocked

## Quick Fixes

### Fix 1: Update API URL
If frontend and backend are on different domains:
```env
# Frontend .env
VITE_API_URL=https://your-backend.railway.app
```

If frontend and backend are on same domain:
```env
# Frontend .env  
VITE_API_URL=https://app.contentfabrica.com
```
(Backend should serve API routes at `/api/*`)

### Fix 2: Verify Email in Supabase
1. Go to Supabase Dashboard
2. Authentication > Users
3. Find your user
4. Click "Confirm Email" if not confirmed

### Fix 3: Reset Password
1. Use "Forgot Password" feature
2. Check email for reset link
3. Set new password
4. Try logging in again

### Fix 4: Check Backend Environment Variables
Ensure these are set in backend:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CORS_ORIGIN=https://app.contentfabrica.com
```

## Expected Behavior

### Successful Login
1. Frontend sends POST to `/api/auth/login`
2. Backend validates credentials with Supabase
3. Backend returns `{ access_token, refresh_token, user }`
4. Frontend stores token and redirects to dashboard

### Failed Login
1. Frontend sends POST to `/api/auth/login`
2. Backend validates credentials with Supabase
3. Supabase returns error (invalid credentials, etc.)
4. Backend returns 401 with error message
5. Frontend displays error message to user

## Next Steps

1. **Check browser console** for detailed error logs
2. **Check backend logs** for authentication attempts
3. **Verify API URL** is pointing to correct backend
4. **Test credentials** directly in Supabase dashboard
5. **Check email verification** status
6. **Verify backend environment variables** are set correctly

## Improved Error Messages

The code now provides more detailed error messages:
- Invalid credentials: "Invalid email or password. Please check your credentials and try again."
- Email not verified: "Please verify your email before signing in. Check your inbox for a verification link."
- Rate limited: "Too many login attempts. Please try again in a few minutes."
- Network error: "Unable to connect to authentication service. Please check your connection and try again."

Check the browser console for the full error details to identify the exact issue.

