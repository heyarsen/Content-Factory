import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')));

const UPLOADPOST_API = 'https://api.upload-post.com/api/uploadposts';
const HEYGEN_API = 'https://api.heygen.com/v1';

// Use Railway environment variables
const UPLOADPOST_KEY = process.env.UPLOADPOST_KEY;
const HEYGEN_KEY = process.env.HEYGEN_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

if (!UPLOADPOST_KEY || !HEYGEN_KEY) {
  console.warn('⚠️  Missing API keys. Set UPLOADPOST_KEY and HEYGEN_KEY environment variables.');
}

// Create / connect UploadPost user
app.post('/api/connect-accounts', async (req, res) => {
  try {
    const { username } = req.body;

    if (!UPLOADPOST_KEY) {
      return res.status(500).json({ success: false, error: 'UploadPost API key not configured' });
    }

    // 1. Create or get user
    const userRes = await fetch(`${UPLOADPOST_API}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `ApiKey ${UPLOADPOST_KEY}`
      },
      body: JSON.stringify({ username })
    });
    
    if (!userRes.ok) {
      const errorText = await userRes.text();
      throw new Error(`UploadPost API error: ${userRes.status} - ${errorText}`);
    }
    
    const userData = await userRes.json();

    // 2. Generate JWT URL
    const jwtRes = await fetch(`${UPLOADPOST_API}/users/generate-jwt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `ApiKey ${UPLOADPOST_KEY}`
      },
      body: JSON.stringify({
        username: userData.username,
        redirect_url: FRONTEND_URL,
        logo_image: `${FRONTEND_URL}/logo.png`,
        redirect_button_text: 'Return to App',
        platforms: ['instagram', 'tiktok', 'youtube', 'facebook']
      })
    });
    
    if (!jwtRes.ok) {
      const errorText = await jwtRes.text();
      throw new Error(`JWT generation error: ${jwtRes.status} - ${errorText}`);
    }
    
    const jwtData = await jwtRes.json();

    res.json({ 
      success: true, 
      access_url: jwtData.data.access_url, 
      username: userData.username 
    });
  } catch (err) {
    console.error('Connect accounts error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get connected accounts
app.get('/api/accounts/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    if (!UPLOADPOST_KEY) {
      return res.status(500).json({ success: false, error: 'UploadPost API key not configured' });
    }

    const response = await fetch(`${UPLOADPOST_API}/users/${username}/socials`, {
      headers: {
        Authorization: `ApiKey ${UPLOADPOST_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Get accounts error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Get accounts error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create HeyGen video
app.post('/api/create-video', async (req, res) => {
  try {
    if (!HEYGEN_KEY) {
      return res.status(500).json({ success: false, error: 'HeyGen API key not configured' });
    }

    const { topic, style, duration, avatar_id, voice_id } = req.body;
    
    // Create video with HeyGen
    const videoRes = await fetch(`${HEYGEN_API}/video_generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': HEYGEN_KEY
      },
      body: JSON.stringify({
        video_inputs: [{
          character: {
            type: "avatar",
            avatar_id: avatar_id || "default_avatar"
          },
          voice: {
            type: "text",
            input_text: `Create a ${style} ${duration}-second video about: ${topic}`,
            voice_id: voice_id || "default_voice"
          }
        }],
        dimension: {
          width: 1080,
          height: 1920
        },
        aspect_ratio: "9:16"
      })
    });
    
    if (!videoRes.ok) {
      const errorText = await videoRes.text();
      throw new Error(`HeyGen API error: ${videoRes.status} - ${errorText}`);
    }
    
    const data = await videoRes.json();
    res.json(data);
  } catch (err) {
    console.error('Create video error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get HeyGen video status
app.get('/api/video-status/:id', async (req, res) => {
  try {
    const videoId = req.params.id;
    
    if (!HEYGEN_KEY) {
      return res.status(500).json({ success: false, error: 'HeyGen API key not configured' });
    }

    const videoRes = await fetch(`${HEYGEN_API}/video_status?video_id=${videoId}`, {
      headers: { 'X-API-Key': HEYGEN_KEY }
    });
    
    if (!videoRes.ok) {
      const errorText = await videoRes.text();
      throw new Error(`Video status error: ${videoRes.status} - ${errorText}`);
    }
    
    const data = await videoRes.json();
    res.json(data);
  } catch (err) {
    console.error('Video status error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Post video to social media
app.post('/api/post-video', async (req, res) => {
  try {
    const { username, video_url, caption, platforms } = req.body;
    
    if (!UPLOADPOST_KEY) {
      return res.status(500).json({ success: false, error: 'UploadPost API key not configured' });
    }

    if (!video_url) {
      return res.status(400).json({ success: false, error: 'Video URL is required' });
    }

    // Post to each platform
    const results = [];
    
    for (const platform of platforms) {
      try {
        const postRes = await fetch(`${UPLOADPOST_API}/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `ApiKey ${UPLOADPOST_KEY}`
          },
          body: JSON.stringify({
            username: username,
            platform: platform,
            post_type: 'video',
            media_urls: [video_url],
            caption: caption || 'Check out this AI-generated video!',
            schedule_time: null // Post immediately
          })
        });
        
        if (postRes.ok) {
          const postData = await postRes.json();
          results.push({ platform, success: true, post_id: postData.id });
        } else {
          const errorText = await postRes.text();
          results.push({ platform, success: false, error: errorText });
        }
      } catch (platformError) {
        results.push({ platform, success: false, error: platformError.message });
      }
    }
    
    res.json({ success: true, results });
  } catch (err) {
    console.error('Post video error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend URL: ${FRONTEND_URL}`);
  console.log(`🔑 UploadPost API: ${UPLOADPOST_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log(`🎥 HeyGen API: ${HEYGEN_KEY ? '✅ Configured' : '❌ Missing'}`);
});