import React, { useState, useEffect } from 'react';
import { Video, Plus, Instagram, Youtube, Facebook, Loader2, CheckCircle, XCircle, Clock, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';

// Replace with your real API endpoints
const UPLOADPOST_API = 'https://api.upload-post.com/api/uploadposts';
const HEYGEN_API = 'https://api.heygen.com/v1';

const App = () => {
  const [currentUser] = useState(() => {
    const saved = localStorage.getItem('app_user_id');
    if (saved) return saved;
    const newId = 'user_' + Date.now();
    localStorage.setItem('app_user_id', newId);
    return newId;
  });

  const [activeTab, setActiveTab] = useState('create');
  const [videos, setVideos] = useState([]);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadPostUser, setUploadPostUser] = useState(null);
  const [videoForm, setVideoForm] = useState({
    topic: '',
    style: 'casual',
    duration: 60,
    avatar_id: 'default_avatar',
    voice_id: 'default_voice'
  });

  useEffect(() => {
    loadVideos();
    const userData = loadUploadPostUser();
    if (userData?.username) {
      checkConnectedAccounts(userData.username);
    }
  }, []);

  const loadVideos = () => {
    try {
      const saved = localStorage.getItem(`videos_${currentUser}`);
      if (saved) setVideos(JSON.parse(saved));
    } catch {
      console.log('No videos found');
    }
  };

  const loadUploadPostUser = () => {
    try {
      const saved = localStorage.getItem(`uploadpost_user_${currentUser}`);
      if (saved) {
        const userData = JSON.parse(saved);
        setUploadPostUser(userData);
        return userData;
      }
    } catch {
      console.log('No upload-post user found');
    }
    return null;
  };

  const saveVideos = (updatedVideos) => {
    localStorage.setItem(`videos_${currentUser}`, JSON.stringify(updatedVideos));
    setVideos(updatedVideos);
  };

  const saveConnectedAccounts = (accounts) => {
    localStorage.setItem(`accounts_${currentUser}`, JSON.stringify(accounts));
    setConnectedAccounts(accounts);
  };

  const saveUploadPostUser = (userData) => {
    localStorage.setItem(`uploadpost_user_${currentUser}`, JSON.stringify(userData));
    setUploadPostUser(userData);
  };

  // -------------------------------
  // Connect social account
  // -------------------------------
  const connectSocialAccount = async () => {
    setIsLoading(true);
    try {
      let username = uploadPostUser?.username || `user_${Math.random().toString(36).substring(2, 10)}`;

      // 1️⃣ Create or get UploadPost user
      const userRes = await fetch(`${UPLOADPOST_API}/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'ApiKey YOUR_UPLOADPOST_API_KEY' 
        },
        body: JSON.stringify({ username })
      });
      const userData = await userRes.json();
      if (!userData.username) throw new Error('Failed to create user');
      saveUploadPostUser(userData);

      // 2️⃣ Get social connect URL
      const connectRes = await fetch(`${UPLOADPOST_API}/users/generate-jwt`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'ApiKey YOUR_UPLOADPOST_API_KEY' 
        },
        body: JSON.stringify({
          username: userData.username,
          redirect_url: 'https://yourfrontend.com/callback',
          logo_image: 'https://yourfrontend.com/logo.png',
          redirect_button_text: 'Return to App',
          platforms: ['instagram', 'tiktok']
        })
      });
      const connectData = await connectRes.json();

      if (connectData.data?.access_url) {
        window.open(connectData.data.access_url, '_blank', 'width=800,height=600');
        alert('A window opened to connect your social accounts. Click "Refresh Accounts" when done.');
      } else throw new Error('No connection URL returned');

    } catch (err) {
      console.error(err);
      alert('Failed to connect accounts.');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------
  // Check connected accounts
  // -------------------------------
  const checkConnectedAccounts = async (username) => {
    if (!username) return alert('No username found.');
    setIsLoading(true);
    try {
      const res = await fetch(`${UPLOADPOST_API}/users/${username}/socials`, {
        headers: { 
          'Authorization': 'ApiKey YOUR_UPLOADPOST_API_KEY',
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.data?.accounts) {
        saveConnectedAccounts(data.data.accounts.map(acc => ({
          platform: acc.platform,
          account_name: acc.name || acc.username,
          connected_at: acc.connected_at || new Date().toISOString(),
          status: 'active',
          details: acc
        })));
        alert(`Found ${data.data.accounts.length} connected accounts.`);
      } else {
        alert('No connected accounts.');
      }
    } catch (err) {
      console.error(err);
      alert('Error loading accounts.');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------
  // Create video
  // -------------------------------
  const createVideo = async () => {
    if (!videoForm.topic.trim()) return alert('Enter a topic.');
    if (connectedAccounts.length === 0) return alert('Connect at least one social account first.');

    setIsLoading(true);
    const videoId = `vid_${Date.now()}`;

    try {
      const res = await fetch(`${HEYGEN_API}/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'YOUR_HEYGEN_API_KEY'
        },
        body: JSON.stringify({
          topic: videoForm.topic,
          style: videoForm.style,
          duration: videoForm.duration,
          avatar_id: videoForm.avatar_id,
          voice_id: videoForm.voice_id
        })
      });
      const data = await res.json();

      if (data.id) {
        const newVideo = {
          ...videoForm,
          video_id: data.id,
          status: 'generating',
          created_at: new Date().toISOString(),
          video_url: null
        };
        saveVideos([newVideo, ...videos]);
        setActiveTab('videos');
        setVideoForm({ topic: '', style: 'casual', duration: 60, avatar_id: 'default_avatar', voice_id: 'default_voice' });
        alert('Video generation started!');
      } else throw new Error('Video creation failed');

    } catch (err) {
      console.error(err);
      alert('Error generating video.');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------
  // Refresh video status
  // -------------------------------
  const refreshVideoStatus = async (videoId) => {
    try {
      const res = await fetch(`${HEYGEN_API}/videos/${videoId}`, {
        headers: { 'X-API-Key': 'YOUR_HEYGEN_API_KEY' }
      });
      const data = await res.json();

      const updated = videos.map(v =>
        v.video_id === videoId ? { ...v, status: data.status, video_url: data.url } : v
      );
      saveVideos(updated);

    } catch (err) {
      console.error(err);
      alert('Failed to refresh video status.');
    }
  };

  // -------------------------------
  // Helpers
  // -------------------------------
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
      case 'generating': return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'posted': return <CheckCircle className="w-5 h-5 text-purple-500" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getSocialIcon = (platform) => {
    const lower = platform.toLowerCase();
    switch (lower) {
      case 'instagram': return <Instagram className="w-5 h-5" />;
      case 'youtube': return <Youtube className="w-5 h-5" />;
      case 'facebook': return <Facebook className="w-5 h-5" />;
      case 'tiktok': return <Video className="w-5 h-5" />;
      default: return <Video className="w-5 h-5" />;
    }
  };

  // -------------------------------
  // Render UI (same as your original)
  // -------------------------------
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ... all your JSX UI code stays unchanged ... */}
      {/* Just the API calls are replaced */}
    </div>
  );
};

export default App;
