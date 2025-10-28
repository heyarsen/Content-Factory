# Content Factory
# AI-Powered Video Generator Platform

Create AI-generated videos and automatically post them to your social media accounts without Make.com dependency.

## Features

- 🎥 AI video generation with HeyGen API
- 📱 Direct social media integration (Instagram, TikTok, YouTube, Facebook)
- 🔗 UploadPost.com OAuth connection for social accounts
- 📊 Real-time video status tracking
- 🎨 Modern, responsive UI
- 🚀 One-click video posting to multiple platforms

## Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:
```env
# Required API Keys
UPLOADPOST_KEY=your_uploadpost_api_key_here
HEYGEN_KEY=your_heygen_api_key_here

# Optional Configuration
FRONTEND_URL=https://your-domain.com
PORT=4000
```

**Getting API Keys:**
- **UploadPost API**: Sign up at [UploadPost.com](https://upload-post.com) and get your API key from the dashboard
- **HeyGen API**: Register at [HeyGen.com](https://heygen.com) and obtain your API key from settings

### 3. Development
```bash
# Start the development server
npm run dev
```

Open http://localhost:5173 in your browser.

### 4. Production Build
```bash
# Build for production
npm run build

# Start production server
npm start
```

### 5. Deploy to Railway

1. **Connect Repository**: Link your GitHub repository to Railway
2. **Auto-Detection**: Railway automatically detects Node.js and uses the correct build commands
3. **Environment Variables**: Set your API keys in Railway dashboard:
   - `UPLOADPOST_KEY`
   - `HEYGEN_KEY`
   - `FRONTEND_URL` (your Railway app URL)
4. **Deploy**: Railway will automatically build and deploy your app

## How It Works

### 1. Connect Social Accounts
- Click "Connect Account" to authorize your social media accounts
- Uses UploadPost.com OAuth flow for secure authentication
- Supports Instagram, TikTok, YouTube, and Facebook

### 2. Create Videos
- Enter your video topic and customize settings
- Choose style (casual, professional, energetic, educational)
- Set duration (30s to 2 minutes)
- Select avatar and voice preferences

### 3. AI Generation
- HeyGen AI generates your video based on the topic
- Real-time status updates (generating → completed)
- Automatic video URL retrieval when ready

### 4. Social Media Posting
- One-click posting to all connected platforms
- Automatic caption generation
- Post status tracking and confirmation

## API Endpoints

### Social Account Management
```http
POST /api/connect-accounts
GET /api/accounts/:username
```

### Video Operations
```http
POST /api/create-video
GET /api/video-status/:id
POST /api/post-video
```

## Architecture

- **Frontend**: React 18 + Vite + TailwindCSS
- **Backend**: Express.js with direct API integration
- **Video Generation**: HeyGen API
- **Social Media**: UploadPost.com API
- **Deployment**: Railway (recommended)
- **Storage**: Local storage for user data

## Direct API Integration (No Make.com)

This version removes all Make.com dependencies and uses direct API calls:

### UploadPost Integration
```javascript
// Create user and get OAuth URL
POST https://api.upload-post.com/api/uploadposts/users
POST https://api.upload-post.com/api/uploadposts/users/generate-jwt

// Get connected accounts
GET https://api.upload-post.com/api/uploadposts/users/{username}/socials

// Post videos
POST https://api.upload-post.com/api/uploadposts/posts
```

### HeyGen Integration
```javascript
// Generate video
POST https://api.heygen.com/v1/video_generate

// Check status
GET https://api.heygen.com/v1/video_status?video_id={id}
```

## Project Structure

```
content-factory/
├── src/
│   ├── App.jsx          # Main React component
│   ├── main.jsx         # React entry point
│   └── index.css        # Styles
├── server.js            # Express server with API endpoints
├── package.json         # Dependencies and scripts
├── vite.config.js       # Vite configuration
└── README.md           # This file
```

## Troubleshooting

### Common Issues

1. **API Key Errors**
   - Ensure environment variables are set correctly
   - Check API key validity on respective platforms
   - Verify key permissions and quotas

2. **Social Account Connection**
   - Make sure FRONTEND_URL is set to your actual domain
   - Check UploadPost dashboard for connection status
   - Clear browser storage if experiencing issues

3. **Video Generation Fails**
   - Verify HeyGen API key and quota
   - Check video topic length and content
   - Review server logs for detailed error messages

4. **Deployment Issues**
   - Ensure all environment variables are set in Railway
   - Check build logs for missing dependencies
   - Verify `package.json` scripts are correct

### Debug Mode

To enable detailed logging, set the environment variable:
```env
NODE_ENV=development
```

This will show detailed API response logs in the server console.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review server logs for error details
3. Ensure all API keys are valid and have proper permissions
4. Open an issue on GitHub with detailed error information