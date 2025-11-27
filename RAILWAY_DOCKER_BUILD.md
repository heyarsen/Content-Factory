# Railway Docker Build Setup

## Important: Environment Variables for Build

When using Dockerfile, Railway needs to pass build-time environment variables as **build arguments**. 

### Required Build Arguments

In Railway, you need to set these as **build arguments** (not just environment variables):

1. Go to your Railway project → Settings → Variables
2. Add these variables (they will be used both at build time and runtime):

```
VITE_SUPABASE_URL=https://okgerovytptsrylpweqo.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_API_URL=https://your-railway-app.railway.app
```

**Note**: Railway automatically passes all environment variables as build arguments, so you don't need to do anything special. Just make sure these variables are set in Railway.

### After First Deploy

1. Deploy once to get your Railway URL
2. Update `VITE_API_URL` to your Railway URL: `https://your-app.railway.app`
3. Redeploy so the frontend knows where the API is

### Troubleshooting Blank Page

If you see a blank page:

1. **Check Railway logs** - Look for:
   - "✅ Serving frontend from" (means frontend was found)
   - "❌ Frontend build not found" (means frontend wasn't built/copied)

2. **Check browser console** - Open DevTools (F12) and look for:
   - JavaScript errors
   - Failed network requests
   - Missing environment variables

3. **Verify environment variables** - Make sure all VITE_* variables are set in Railway

4. **Check the /health endpoint** - Visit `https://your-app.railway.app/health` to verify the backend is running

5. **Check static files** - Visit `https://your-app.railway.app/index.html` directly to see if the file is being served

