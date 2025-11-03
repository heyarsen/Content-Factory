# Railway Environment Variables Setup

## Required Environment Variables

Add these environment variables in your Railway project dashboard:

### Supabase Configuration
```
SUPABASE_URL=https://okgerovytptsrylpweqo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Important:** 
- You provided the anon key, but the backend needs the **SERVICE_ROLE_KEY**
- Get it from: Supabase Dashboard > Settings > API > service_role (secret key)
- The service_role key has admin privileges and should be kept secret

### Upload Post API
```
UPLOADPOST_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImluZm9zcG9sb2sub2ZmaWNlQGdtYWlsLmNvbSIsImV4cCI6NDkxMjQzMzIxNiwianRpIjoiNDA2NDI2ZTUtNWUxNi00Mjc5LThmYzQtZDUzMDlhNTQwNzIwIn0.EylwU51ZDhLFIXBL6hf49pdxCLAiwTY6tf_SW-6FktA
```

### HeyGen API
```
HEYGEN_KEY=your_heygen_api_key_here
```

### Server Configuration
```
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-url.vercel.app
PORT=3001
```

## How to Add Environment Variables in Railway

1. Go to your Railway project dashboard
2. Click on your service
3. Go to the **Variables** tab
4. Click **New Variable**
5. Add each variable one by one
6. After adding all variables, redeploy your service

## Quick Copy-Paste for Railway

```
SUPABASE_URL=https://okgerovytptsrylpweqo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase Dashboard>
UPLOADPOST_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImluZm9zcG9sb2sub2ZmaWNlQGdtYWlsLmNvbSIsImV4cCI6NDkxMjQzMzIxNiwianRpIjoiNDA2NDI2ZTUtNWUxNi00Mjc5LThmYzQtZDUzMDlhNTQwNzIwIn0.EylwU51ZDhLFIXBL6hf49pdxCLAiwTY6tf_SW-6FktA
HEYGEN_KEY=<add your key>
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-url.vercel.app
```

