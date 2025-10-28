# Content-Factory
# Video Generator Platform

AI-powered video generation platform with social media integration.

## Features

- 🎥 AI video generation with HeyGen
- 📱 Social media integration (Instagram, TikTok, YouTube, Facebook)
- 🔗 Upload-post.com OAuth connection
- 📊 Video status tracking
- 🎨 Modern Shopify-like UI

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Create `.env` file (optional):
```env
VITE_UPLOADPOST_API_KEY=your_api_key_here
```

### 3. Development
```bash
npm run dev
```

Open http://localhost:5173

### 4. Build for Production
```bash
npm run build
```

### 5. Deploy to Railway

1. Connect GitHub repository
2. Railway auto-detects Node.js
3. Set environment variables in Railway dashboard
4. Deploy!

## Make.com Integration

The app uses Make.com webhooks for:

1. **Store Social Credentials**: `https://hook.eu2.make.com/00i9rjwdtt2np4brm8mm7p8hla9rix78`
2. **Generate Video**: `https://hook.eu2.make.com/5efo29nninirjgj06nh69jq7lt6piiva`
3. **Check Status**: `https://hook.eu2.make.com/1ejgvywznrgfbs4iaijt2xdlzf62n7w5`

## Architecture

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Express.js (serves static files)
- **Automation**: Make.com scenarios
- **Video Generation**: HeyGen API
- **Social Media**: Upload-post.com API
- **Deployment**: Railway

## API Integration

### Upload-Post.com
```javascript
// Create user
POST https://api.upload-post.com/api/uploadposts/users
Authorization: ApiKey YOUR_KEY

// Generate JWT for OAuth
POST https://api.upload-post.com/api/uploadposts/generate-jwt
Authorization: ApiKey YOUR_KEY

// Get user profile
GET https://api.upload-post.com/api/uploadposts/users/{username}
Authorization: ApiKey YOUR_KEY
```

### HeyGen (via Make.com)

Handled through Make.com webhook

## Project Structure
