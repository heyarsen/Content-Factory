import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Get upload-post API key from environment
const UPLOADPOST_API_KEY = process.env.UPLOADPOST_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImluZm9zcG9sb2sub2ZmaWNlQGdtYWlsLmNvbSIsImV4cCI6NDkxMjQzMzIxNiwianRpIjoiNDA2NDI2ZTUtNWUxNi00Mjc5LThmYzQtZDUzMDlhNTQwNzIwIn0.EylwU51ZDhLFIXBL6hf49pdxCLAiwTY6tf_SW-6FktA';

// Proxy to avoid CORS for upload-post.com
router.get('/uploadpost/users/get/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const response = await fetch(`https://api.upload-post.com/api/uploadposts/users/get/${username}`, {
      method: 'GET',
      headers: {
        'Authorization': `Apikey ${UPLOADPOST_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    const data = await response.text();
    res.status(response.status)
      .set({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      })
      .send(data);
  } catch (error) {
    console.error('Proxy GET error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create upload-post user
router.post('/uploadpost/users', async (req, res) => {
  try {
    const { username } = req.body;
    const response = await fetch('https://api.upload-post.com/api/uploadposts/users', {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${UPLOADPOST_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    });
    
    const data = await response.text();
    res.status(response.status)
      .set({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      })
      .send(data);
  } catch (error) {
    console.error('Proxy POST users error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate JWT for connection
router.post('/uploadpost/users/generate-jwt', async (req, res) => {
  try {
    const { username } = req.body;
    const response = await fetch('https://api.upload-post.com/api/uploadposts/users/generate-jwt', {
      method: 'POST',
      headers: {
        'Authorization': `Apikey ${UPLOADPOST_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    });
    
    const data = await response.text();
    res.status(response.status)
      .set({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      })
      .send(data);
  } catch (error) {
    console.error('Proxy JWT error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;