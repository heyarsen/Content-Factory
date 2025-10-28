import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const UPLOADPOST_API = 'https://api.upload-post.com/api/uploadposts';
const HEYGEN_API = 'https://api.heygen.com/v1';

const UPLOADPOST_KEY = 'YOUR_UPLOADPOST_API_KEY';
const HEYGEN_KEY = 'YOUR_HEYGEN_API_KEY';

// Create / connect UploadPost user
app.post('/api/connect-accounts', async (req, res) => {
  try {
    const { username } = req.body;

    // 1. Create or get user
    const userRes = await fetch(`${UPLOADPOST_API}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `ApiKey ${UPLOADPOST_KEY}`
      },
      body: JSON.stringify({ username })
    });
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
        redirect_url: 'http://localhost:3000',
        logo_image: 'https://yourfrontend.com/logo.png',
        redirect_button_text: 'Return to App',
        platforms: ['instagram', 'tiktok', 'youtube']
      })
    });
    const jwtData = await jwtRes.json();

    res.json({ success: true, access_url: jwtData.data.access_url, username: userData.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get connected accounts
app.get('/api/accounts/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const response = await fetch(`${UPLOADPOST_API}/users/${username}/socials`, {
      headers: {
        Authorization: `ApiKey ${UPLOADPOST_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create HeyGen video
app.post('/api/create-video', async (req, res) => {
  try {
    const videoRes = await fetch(`${HEYGEN_API}/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': HEYGEN_KEY
      },
      body: JSON.stringify(req.body)
    });
    const data = await videoRes.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get HeyGen video status
app.get('/api/video-status/:id', async (req, res) => {
  try {
    const videoId = req.params.id;
    const videoRes = await fetch(`${HEYGEN_API}/videos/${videoId}`, {
      headers: { 'X-API-Key': HEYGEN_KEY }
    });
    const data = await videoRes.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(4000, () => console.log('Server running on port 4000'));
