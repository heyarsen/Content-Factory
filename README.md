# AI Video Generation Platform

A production-ready SaaS platform for AI-powered video generation with social media integration.

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: Supabase (PostgreSQL + Auth)
- **External APIs**: HeyGen API (video generation), Upload-post.com API (social media posting)
- **Deployment**: Railway

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- HeyGen API key
- Upload-post.com API key

### Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```

3. Set up Supabase:
   - Create a Supabase project
   - Run the database schema SQL (see Database Schema section)
   - Get your Supabase URL and anon key

4. Configure environment variables:

   **Frontend** (`frontend/.env.local`):
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_API_URL=http://localhost:3001
   ```

   **Backend** (`backend/.env`):
   ```
   PORT=3001
   NODE_ENV=development
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   HEYGEN_KEY=your_heygen_api_key
   UPLOADPOST_KEY=your_upload_post_api_key
   CORS_ORIGIN=http://localhost:5173
   ```

5. Start development servers:
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev

   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

### Database Schema

Run this SQL in your Supabase SQL editor:

```sql
-- Videos table
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  script TEXT,
  style TEXT NOT NULL CHECK (style IN ('casual', 'professional', 'energetic', 'educational')),
  duration INTEGER NOT NULL CHECK (duration >= 15 AND duration <= 180),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  heygen_video_id TEXT,
  video_url TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social accounts table
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'facebook')),
  platform_account_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Scheduled posts table
CREATE TABLE scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'facebook')),
  scheduled_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed', 'cancelled')),
  upload_post_id TEXT,
  posted_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX idx_scheduled_posts_user_id ON scheduled_posts(user_id);
CREATE INDEX idx_scheduled_posts_video_id ON scheduled_posts(video_id);
CREATE INDEX idx_scheduled_posts_status ON scheduled_posts(status);

-- Enable Row Level Security
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for videos
CREATE POLICY "Users can view own videos" ON videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own videos" ON videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own videos" ON videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own videos" ON videos FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for social_accounts
CREATE POLICY "Users can view own social accounts" ON social_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own social accounts" ON social_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own social accounts" ON social_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own social accounts" ON social_accounts FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for scheduled_posts
CREATE POLICY "Users can view own scheduled posts" ON scheduled_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scheduled posts" ON scheduled_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scheduled posts" ON scheduled_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scheduled posts" ON scheduled_posts FOR DELETE USING (auth.uid() = user_id);
```

## Railway Deployment

### Backend Deployment

1. Connect your GitHub repository to Railway
2. Create a new project in Railway
3. **Important**: In Railway project settings, set the **Root Directory** to `backend`
4. Add environment variables in Railway dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `HEYGEN_KEY`
   - `UPLOADPOST_KEY`
   - `CORS_ORIGIN` (your frontend URL - e.g., `https://your-frontend.vercel.app`)
   - `NODE_ENV=production`
   - `PORT` (Railway will set this automatically, but you can override if needed)
5. Railway will automatically detect the Node.js project and deploy using the `nixpacks.toml` configuration

### Alternative: If Root Directory is Not Set

If you can't set the root directory to `backend`, Railway will use the root `nixpacks.toml` which will automatically `cd` into the backend directory for all operations.

### Frontend Deployment (Optional - Vercel/Netlify)

For the frontend, deploy separately to Vercel or Netlify:
1. Connect the repository
2. Set root directory to `frontend`
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_URL` (your Railway backend URL)

## Features

- Email/password authentication with email verification
- Password reset flow
- Social media account connection (Instagram, TikTok, YouTube, Facebook)
- AI video generation via HeyGen API
- Video management and preview
- Automated social media posting
- Post scheduling

