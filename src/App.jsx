import React, { useState, useEffect } from 'react';
import { Video, Plus, Instagram, Youtube, Facebook, Loader2, CheckCircle, XCircle, Clock, ExternalLink, RefreshCw, Sparkles, Send } from 'lucide-react';

// Use your backend API endpoints
const API_BASE = window.location.origin;

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

      const response = await fetch(`${API_BASE}/api/connect-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to connect accounts');
      }

      saveUploadPostUser({ username: data.username });

      if (data.access_url) {
        window.open(data.access_url, '_blank', 'width=800,height=600');
        alert('A window opened to connect your social accounts. Click "Refresh Accounts" when done.');
      } else {
        throw new Error('No connection URL returned');
      }

    } catch (err) {
      console.error('Connect accounts error:', err);
      alert(`Failed to connect accounts: ${err.message}`);
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
      const response = await fetch(`${API_BASE}/api/accounts/${username}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load accounts');
      }

      if (data.data?.accounts && data.data.accounts.length > 0) {
        const formattedAccounts = data.data.accounts.map(acc => ({
          platform: acc.platform,
          account_name: acc.name || acc.username || acc.account_name,
          connected_at: acc.connected_at || new Date().toISOString(),
          status: 'active',
          details: acc
        }));
        saveConnectedAccounts(formattedAccounts);
        alert(`Found ${formattedAccounts.length} connected accounts.`);
      } else {
        setConnectedAccounts([]);
        alert('No connected accounts found.');
      }
    } catch (err) {
      console.error('Check accounts error:', err);
      alert(`Error loading accounts: ${err.message}`);
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
    const localVideoId = `vid_${Date.now()}`;

    try {
      const response = await fetch(`${API_BASE}/api/create-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(videoForm)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create video');
      }

      if (data.data?.video_id || data.video_id) {
        const newVideo = {
          ...videoForm,
          local_id: localVideoId,
          video_id: data.data?.video_id || data.video_id,
          status: 'generating',
          created_at: new Date().toISOString(),
          video_url: null
        };
        saveVideos([newVideo, ...videos]);
        setActiveTab('videos');
        setVideoForm({ 
          topic: '', 
          style: 'casual', 
          duration: 60, 
          avatar_id: 'default_avatar', 
          voice_id: 'default_voice' 
        });
        alert('Video generation started!');
      } else {
        throw new Error('No video ID returned from API');
      }

    } catch (err) {
      console.error('Create video error:', err);
      alert(`Error generating video: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------
  // Refresh video status
  // -------------------------------
  const refreshVideoStatus = async (videoId) => {
    try {
      const response = await fetch(`${API_BASE}/api/video-status/${videoId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get video status');
      }

      const updated = videos.map(v =>
        v.video_id === videoId ? { 
          ...v, 
          status: data.data?.status || data.status || 'unknown',
          video_url: data.data?.video_url || data.video_url || data.url
        } : v
      );
      saveVideos(updated);

    } catch (err) {
      console.error('Refresh video status error:', err);
      alert(`Failed to refresh video status: ${err.message}`);
    }
  };

  // -------------------------------
  // Post video to social media
  // -------------------------------
  const postVideoToSocial = async (video) => {
    if (!video.video_url) {
      alert('Video URL not available yet. Please wait for generation to complete.');
      return;
    }

    if (!uploadPostUser?.username) {
      alert('No connected user found. Please connect your accounts first.');
      return;
    }

    const selectedPlatforms = connectedAccounts
      .filter(acc => acc.status === 'active')
      .map(acc => acc.platform);

    if (selectedPlatforms.length === 0) {
      alert('No active social accounts found.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/post-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: uploadPostUser.username,
          video_url: video.video_url,
          caption: `Check out this AI-generated video about: ${video.topic}`,
          platforms: selectedPlatforms
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to post video');
      }

      if (data.success) {
        // Update video status to posted
        const updated = videos.map(v =>
          v.video_id === video.video_id ? { ...v, status: 'posted' } : v
        );
        saveVideos(updated);
        
        const successCount = data.results.filter(r => r.success).length;
        const totalCount = data.results.length;
        alert(`Video posted to ${successCount}/${totalCount} platforms successfully!`);
      }

    } catch (err) {
      console.error('Post video error:', err);
      alert(`Error posting video: ${err.message}`);
    } finally {
      setIsLoading(false);
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'generating': return 'text-blue-600 bg-blue-50';
      case 'completed': return 'text-green-600 bg-green-50';
      case 'posted': return 'text-purple-600 bg-purple-50';
      case 'failed': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // -------------------------------
  // Render UI
  // -------------------------------
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Content Factory</h1>
                <p className="text-sm text-gray-500">AI-powered video creation</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              User: {currentUser}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex space-x-1 bg-white p-1 rounded-lg border">
          {[{ id: 'create', label: 'Create Video', icon: Plus }, 
            { id: 'videos', label: 'My Videos', icon: Video }, 
            { id: 'accounts', label: 'Social Accounts', icon: Instagram }].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors flex-1 justify-center ${
                activeTab === tab.id 
                  ? 'bg-blue-500 text-white shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {/* Create Video Tab */}
        {activeTab === 'create' && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Video</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Video Topic
                </label>
                <textarea
                  value={videoForm.topic}
                  onChange={(e) => setVideoForm({...videoForm, topic: e.target.value})}
                  placeholder="e.g., How to start a successful online business"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Style
                  </label>
                  <select
                    value={videoForm.style}
                    onChange={(e) => setVideoForm({...videoForm, style: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="casual">Casual</option>
                    <option value="professional">Professional</option>
                    <option value="energetic">Energetic</option>
                    <option value="educational">Educational</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (seconds)
                  </label>
                  <select
                    value={videoForm.duration}
                    onChange={(e) => setVideoForm({...videoForm, duration: parseInt(e.target.value)})}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={90}>1.5 minutes</option>
                    <option value={120}>2 minutes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Avatar
                  </label>
                  <select
                    value={videoForm.avatar_id}
                    onChange={(e) => setVideoForm({...videoForm, avatar_id: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="default_avatar">Default Avatar</option>
                    <option value="professional_avatar">Professional Avatar</option>
                    <option value="friendly_avatar">Friendly Avatar</option>
                  </select>
                </div>
              </div>

              <button
                onClick={createVideo}
                disabled={isLoading || !videoForm.topic.trim()}
                className="w-full bg-blue-500 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Creating...</span></>
                ) : (
                  <><Plus className="w-4 h-4" /><span>Create Video</span></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Videos Tab */}
        {activeTab === 'videos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">My Videos</h2>
              <span className="text-sm text-gray-500">{videos.length} videos</span>
            </div>

            {videos.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No videos yet</h3>
                <p className="text-gray-500 mb-4">Create your first AI-generated video to get started.</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-600"
                >
                  Create Video
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {videos.map((video, index) => (
                  <div key={video.local_id || index} className="bg-white rounded-lg shadow-sm border p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {getStatusIcon(video.status)}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(video.status)}`}>
                            {video.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(video.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="font-medium text-gray-900 mb-1">{video.topic}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>Style: {video.style}</span>
                          <span>Duration: {video.duration}s</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => refreshVideoStatus(video.video_id)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md"
                          title="Refresh status"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        {video.video_url && (
                          <a
                            href={video.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md"
                            title="View video"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {video.status === 'completed' && video.video_url && (
                          <button
                            onClick={() => postVideoToSocial(video)}
                            disabled={isLoading}
                            className="bg-green-500 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-green-600 disabled:opacity-50 flex items-center space-x-1"
                          >
                            <Send className="w-3 h-3" />
                            <span>Post</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Accounts Tab */}
        {activeTab === 'accounts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Social Accounts</h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => uploadPostUser?.username && checkConnectedAccounts(uploadPostUser.username)}
                  disabled={isLoading || !uploadPostUser?.username}
                  className="bg-gray-500 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-600 disabled:opacity-50 flex items-center space-x-1"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={connectSocialAccount}
                  disabled={isLoading}
                  className="bg-blue-500 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Connect Account</span>
                </button>
              </div>
            </div>

            {connectedAccounts.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                <Instagram className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts connected</h3>
                <p className="text-gray-500 mb-4">Connect your social media accounts to start posting videos.</p>
                <button
                  onClick={connectSocialAccount}
                  disabled={isLoading}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-600 disabled:opacity-50"
                >
                  {isLoading ? 'Connecting...' : 'Connect Accounts'}
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {connectedAccounts.map((account, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-sm border p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gray-50 rounded-lg">
                        {getSocialIcon(account.platform)}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 capitalize">{account.platform}</h3>
                        <p className="text-sm text-gray-500">{account.account_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 bg-green-50 text-green-600 rounded-full text-xs font-medium">
                        Connected
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(account.connected_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;