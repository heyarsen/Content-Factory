import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Proxy to avoid CORS for upload-post.com
router.get('/uploadpost/users/get/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const r = await fetch(`https://api.upload-post.com/api/uploadposts/users/get/${username}`, {
      method: 'GET',
      headers: {
        Authorization: `Apikey ${process.env.UPLOADPOST_API_KEY}`,
        Accept: 'application/json',
      },
    });
    const text = await r.text();
    res.status(r.status).set({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }).send(text);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/uploadpost/users/generate-jwt', async (req, res) => {
  try {
    const { username } = req.body;
    const r = await fetch('https://api.upload-post.com/api/uploadposts/users/generate-jwt', {
      method: 'POST',
      headers: {
        Authorization: `Apikey ${process.env.UPLOADPOST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    });
    const text = await r.text();
    res.status(r.status).set({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }).send(text);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
