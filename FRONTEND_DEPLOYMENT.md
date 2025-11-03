# Frontend Deployment Guide

## Quick Deploy to Vercel (Recommended)

### Step 1: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New Project"
3. Import your repository
4. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### Step 2: Add Environment Variables

In Vercel project settings → Environment Variables, add:

```
VITE_SUPABASE_URL=https://okgerovytptsrylpweqo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZ2Vyb3Z5dHB0c3J5bHB3ZXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNTM2ODgsImV4cCI6MjA3NzcyOTY4OH0.fxAyzlUBoWglY6QKnlyOR32m2-_OPNUJAJUR33mNWic
VITE_API_URL=https://your-railway-backend-url.railway.app
```

**Replace `your-railway-backend-url.railway.app` with your actual Railway backend URL**

### Step 3: Deploy

Click "Deploy" and wait for the build to complete. Vercel will give you a URL like `https://your-app.vercel.app`

### Step 4: Update Railway CORS

1. Go to your Railway backend project
2. Add/Update environment variable:
   ```
   CORS_ORIGIN=https://your-app.vercel.app
   ```
3. Redeploy the backend

---

## Alternative: Deploy to Netlify

1. Go to [netlify.com](https://netlify.com) and sign in
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub repository
4. Configure:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
5. Add environment variables (same as Vercel)
6. Deploy

---

## Alternative: Build Locally and Serve from Backend

If you want to serve the frontend from the same domain as your backend:

1. Build the frontend locally:
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. Copy the `frontend/dist` folder to `backend/public`

3. Update backend to serve static files (we can add this if you want)

**Note**: This approach is less recommended for production as it couples frontend and backend deployments.

---

## After Deployment

1. Visit your frontend URL (e.g., `https://your-app.vercel.app`)
2. You should see the login page
3. Create an account and start using the platform!

## Troubleshooting

- **CORS errors**: Make sure `CORS_ORIGIN` in Railway matches your frontend URL exactly
- **API connection errors**: Check that `VITE_API_URL` in frontend points to your Railway backend URL
- **Auth not working**: Verify Supabase keys are correct in both frontend and backend

