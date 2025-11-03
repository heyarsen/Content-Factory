# Railway Frontend Deployment Setup

## ✅ Configuration Complete

The backend is now configured to serve the frontend as static files. The build process will:

1. Build the frontend React app
2. Copy it to `backend/public`
3. Build the backend
4. Serve everything from one Railway service

## Environment Variables Needed

Add these to your Railway project:

### Frontend Build Variables

Add these before building (they're used at build time):

```
VITE_SUPABASE_URL=https://okgerovytptsrylpweqo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZ2Vyb3Z5dHB0c3J5bHB3ZXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNTM2ODgsImV4cCI6MjA3NzcyOTY4OH0.fxAyzlUBoWglY6QKnlyOR32m2-_OPNUJAJUR33mNWic
```

**Important**: After your first deploy, get your Railway URL and add:
```
VITE_API_URL=https://your-railway-app.railway.app
```

Then redeploy so the frontend can connect to the API.

### Backend Variables (if not already set)

```
SUPABASE_URL=https://okgerovytptsrylpweqo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase Dashboard>
UPLOADPOST_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImluZm9zcG9sb2sub2ZmaWNlQGdtYWlsLmNvbSIsImV4cCI6NDkxMjQzMzIxNiwianRpIjoiNDA2NDI2ZTUtNWUxNi00Mjc5LThmYzQtZDUzMDlhNTQwNzIwIn0.EylwU51ZDhLFIXBL6hf49pdxCLAiwTY6tf_SW-6FktA
HEYGEN_KEY=<your key>
NODE_ENV=production
CORS_ORIGIN=https://your-railway-app.railway.app
```

## Deployment Steps

1. **Add all environment variables** in Railway dashboard
2. **Deploy/Redeploy** your service
3. **Wait for build to complete** (it will build both frontend and backend)
4. **Visit your Railway URL** - you should see the frontend interface!

## How It Works

- Frontend is built and copied to `backend/public/`
- Backend serves static files from `/public` for all routes except `/api/*`
- API routes work at `/api/auth`, `/api/videos`, etc.
- Frontend routes work at `/`, `/dashboard`, `/videos`, etc.

## Troubleshooting

- **Frontend not showing**: Check that `VITE_API_URL` is set to your Railway URL and redeploy
- **API calls failing**: Make sure `CORS_ORIGIN` matches your Railway URL exactly
- **Build fails**: Check that all VITE_* variables are set before the build phase

