import React, { useState, useEffect } from 'react';
import { 
  Video, Plus, Instagram, Youtube, Facebook, Loader2, CheckCircle, XCircle, 
  Clock, ExternalLink, RefreshCw, Sparkles, Send, Settings, 
  TrendingUp, Users, Zap, Eye, BarChart3, Globe, X as TwitterIcon,
  MessageCircle, AlertCircle, ChevronRight, Play, Download
} from 'lucide-react';

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

  const [activeTab, setActiveTab] = useState('dashboard');
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
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });

  useEffect(() => {
    loadVideos();
    const userData = loadUploadPostUser();
    if (userData?.username) {
      checkConnectedAccounts(userData.username);
    }
  }, []);

  const showNotification = (message, type = 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'info' }), 5000);
  };

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

  // Connect social account
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
        window.open(data.access_url, '_blank', 'width=800,height=700,scrollbars=yes,resizable=yes');
        showNotification('Connection window opened! Complete the setup and click "Refresh Accounts" when done.', 'info');
      } else {
        throw new Error('No connection URL returned');
      }

    } catch (err) {
      console.error('Connect accounts error:', err);
      showNotification(`Failed to connect accounts: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Check connected accounts
  const checkConnectedAccounts = async (username) => {
    if (!username) {
      showNotification('No username found.', 'error');
      return;
    }
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
          account_name: acc.name || acc.username || acc.display_name,
          connected_at: acc.connected_at || new Date().toISOString(),
          status: 'active',
          details: acc,
          avatar: acc.social_images
        }));
        saveConnectedAccounts(formattedAccounts);
        showNotification(`Found ${formattedAccounts.length} connected accounts!`, 'success');
      } else {
        setConnectedAccounts([]);
        showNotification('No connected accounts found. Connect your social media accounts to get started.', 'info');
      }
    } catch (err) {
      console.error('Check accounts error:', err);
      showNotification(`Error loading accounts: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Create video
  const createVideo = async () => {
    if (!videoForm.topic.trim()) {
      showNotification('Please enter a video topic.', 'error');
      return;
    }
    if (connectedAccounts.length === 0) {
      showNotification('Connect at least one social account first.', 'error');
      return;
    }

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
        showNotification('Video generation started! Check the videos tab for progress.', 'success');
      } else {
        throw new Error('No video ID returned from API');
      }

    } catch (err) {
      console.error('Create video error:', err);
      showNotification(`Error generating video: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh video status
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
      showNotification('Video status updated!', 'success');

    } catch (err) {
      console.error('Refresh video status error:', err);
      showNotification(`Failed to refresh video status: ${err.message}`, 'error');
    }
  };

  // Post video to social media
  const postVideoToSocial = async (video) => {
    if (!video.video_url) {
      showNotification('Video URL not available yet. Please wait for generation to complete.', 'error');
      return;
    }

    if (!uploadPostUser?.username) {
      showNotification('No connected user found. Please connect your accounts first.', 'error');
      return;
    }

    const selectedPlatforms = connectedAccounts
      .filter(acc => acc.status === 'active')
      .map(acc => acc.platform);

    if (selectedPlatforms.length === 0) {
      showNotification('No active social accounts found.', 'error');
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
          caption: `Check out this AI-generated video about: ${video.topic} #AI #ContentCreation #VideoMarketing`,
          platforms: selectedPlatforms
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to post video');
      }

      if (data.success) {
        const updated = videos.map(v =>
          v.video_id === video.video_id ? { ...v, status: 'posted' } : v
        );
        saveVideos(updated);
        showNotification(`Video posted to ${selectedPlatforms.length} platforms successfully! 🎉`, 'success');
      }

    } catch (err) {
      console.error('Post video error:', err);
      showNotification(`Error posting video: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper functions
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
      case 'generating': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'posted': return <CheckCircle className="w-4 h-4 text-purple-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSocialIcon = (platform) => {
    const lower = platform.toLowerCase();
    const iconClass = "w-5 h-5";
    switch (lower) {
      case 'instagram': return <Instagram className={iconClass} />;
      case 'youtube': return <Youtube className={iconClass} />;
      case 'facebook': return <Facebook className={iconClass} />;
      case 'tiktok': return <Video className={iconClass} />;
      case 'x': 
      case 'twitter': return <TwitterIcon className={iconClass} />;
      case 'threads': return <MessageCircle className={iconClass} />;
      default: return <Video className={iconClass} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'generating': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'posted': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPlatformColor = (platform) => {
    const lower = platform.toLowerCase();
    switch (lower) {
      case 'instagram': return 'bg-gradient-to-r from-purple-500 to-pink-500';
      case 'youtube': return 'bg-red-500';
      case 'facebook': return 'bg-blue-600';
      case 'tiktok': return 'bg-black';
      case 'x':
      case 'twitter': return 'bg-black';
      case 'threads': return 'bg-black';
      default: return 'bg-gray-500';
    }
  };

  // Stats calculations
  const stats = {
    totalVideos: videos.length,
    completedVideos: videos.filter(v => v.status === 'completed' || v.status === 'posted').length,
    postedVideos: videos.filter(v => v.status === 'posted').length,
    connectedPlatforms: connectedAccounts.length
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg shadow-lg border ${
          notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-start space-x-3">
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" /> :
             notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" /> :
             <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />}
            <div className="flex-1">
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
            <button 
              onClick={() => setNotification({ show: false, message: '', type: 'info' })}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-3 rounded-xl shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Content Factory</h1>
                <p className="text-gray-500">AI-powered video creation & distribution</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Logged in as</p>
                <p className="text-sm font-medium text-gray-900">{currentUser}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">{currentUser.slice(-2).toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'create', label: 'Create Video', icon: Plus },
              { id: 'videos', label: 'My Videos', icon: Video },
              { id: 'accounts', label: 'Connected Accounts', icon: Globe }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id 
                    ? 'border-purple-500 text-purple-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Videos</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalVideos}</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Video className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Completed</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.completedVideos}</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Posted</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.postedVideos}</p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <Send className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Platforms</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.connectedPlatforms}</p>
                  </div>
                  <div className="bg-orange-100 p-3 rounded-lg">
                    <Globe className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button
                  onClick={() => setActiveTab('create')}
                  className="p-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl text-white hover:from-purple-600 hover:to-blue-600 transition-all transform hover:scale-105"
                >
                  <Plus className="w-8 h-8 mb-3" />
                  <h3 className="text-lg font-semibold mb-1">Create Video</h3>
                  <p className="text-purple-100 text-sm">Generate AI-powered content</p>
                </button>
                <button
                  onClick={() => setActiveTab('accounts')}
                  className="p-6 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl text-white hover:from-green-600 hover:to-teal-600 transition-all transform hover:scale-105"
                >
                  <Globe className="w-8 h-8 mb-3" />
                  <h3 className="text-lg font-semibold mb-1">Connect Accounts</h3>
                  <p className="text-green-100 text-sm">Link social media platforms</p>
                </button>
                <button
                  onClick={() => setActiveTab('videos')}
                  className="p-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl text-white hover:from-orange-600 hover:to-red-600 transition-all transform hover:scale-105"
                >
                  <BarChart3 className="w-8 h-8 mb-3" />
                  <h3 className="text-lg font-semibold mb-1">View Analytics</h3>
                  <p className="text-orange-100 text-sm">Track video performance</p>
                </button>
              </div>
            </div>

            {/* Recent Videos */}
            {videos.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Recent Videos</h2>
                    <button
                      onClick={() => setActiveTab('videos')}
                      className="text-purple-600 hover:text-purple-700 font-medium text-sm flex items-center space-x-1"
                    >
                      <span>View all</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {videos.slice(0, 3).map((video, index) => (
                      <div key={video.local_id || index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          {getStatusIcon(video.status)}
                          <div>
                            <h3 className="font-medium text-gray-900">{video.topic}</h3>
                            <p className="text-sm text-gray-500">{new Date(video.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(video.status)}`}>
                          {video.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create Video Tab */}
        {activeTab === 'create' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-8">
                <div className="text-center mb-8">
                  <div className="bg-gradient-to-r from-purple-500 to-blue-500 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Create AI Video</h2>
                  <p className="text-gray-600">Generate engaging content with AI in seconds</p>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      What's your video about?
                    </label>
                    <textarea
                      value={videoForm.topic}
                      onChange={(e) => setVideoForm({...videoForm, topic: e.target.value})}
                      placeholder="e.g., How to start a successful online business, 10 productivity tips for entrepreneurs, Latest trends in digital marketing..."
                      className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all"
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-3">
                        Video Style
                      </label>
                      <select
                        value={videoForm.style}
                        onChange={(e) => setVideoForm({...videoForm, style: e.target.value})}
                        className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      >
                        <option value="casual">Casual & Friendly</option>
                        <option value="professional">Professional & Business</option>
                        <option value="energetic">Energetic & Dynamic</option>
                        <option value="educational">Educational & Informative</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-3">
                        Duration
                      </label>
                      <select
                        value={videoForm.duration}
                        onChange={(e) => setVideoForm({...videoForm, duration: parseInt(e.target.value)})}
                        className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      >
                        <option value={30}>30 seconds - Quick & Punchy</option>
                        <option value={60}>1 minute - Perfect for Social</option>
                        <option value={90}>1.5 minutes - Detailed</option>
                        <option value={120}>2 minutes - In-depth</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-3">
                        Avatar
                      </label>
                      <select
                        value={videoForm.avatar_id}
                        onChange={(e) => setVideoForm({...videoForm, avatar_id: e.target.value})}
                        className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      >
                        <option value="default_avatar">Default Avatar</option>
                        <option value="professional_avatar">Professional Avatar</option>
                        <option value="friendly_avatar">Friendly Avatar</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-3">
                        Voice
                      </label>
                      <select
                        value={videoForm.voice_id}
                        onChange={(e) => setVideoForm({...videoForm, voice_id: e.target.value})}
                        className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      >
                        <option value="default_voice">Default Voice</option>
                        <option value="professional_voice">Professional Voice</option>
                        <option value="friendly_voice">Friendly Voice</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={createVideo}
                    disabled={isLoading || !videoForm.topic.trim()}
                    className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white py-4 px-6 rounded-xl font-semibold hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 transition-all transform hover:scale-105 disabled:transform-none"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Creating Your Video...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        <span>Generate AI Video</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Videos Tab */}
        {activeTab === 'videos' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">My Videos</h2>
                <p className="text-gray-600 mt-1">{videos.length} videos created</p>
              </div>
              <button
                onClick={() => setActiveTab('create')}
                className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-600 hover:to-blue-600 flex items-center space-x-2 transition-all"
              >
                <Plus className="w-5 h-5" />
                <span>New Video</span>
              </button>
            </div>

            {videos.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                <div className="bg-gray-100 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6">
                  <Video className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No videos yet</h3>
                <p className="text-gray-600 mb-6">Create your first AI-generated video to get started with automated content creation.</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-600 hover:to-blue-600 transition-all"
                >
                  Create Your First Video
                </button>
              </div>
            ) : (
              <div className="grid gap-6">
                {videos.map((video, index) => (
                  <div key={video.local_id || index} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            {getStatusIcon(video.status)}
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(video.status)}`}>
                              {video.status}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(video.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">{video.topic}</h3>
                          <div className="flex items-center space-x-6 text-sm text-gray-500">
                            <span className="flex items-center space-x-1">
                              <Settings className="w-4 h-4" />
                              <span>Style: {video.style}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>Duration: {video.duration}s</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => refreshVideoStatus(video.video_id)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            title="Refresh status"
                          >
                            <RefreshCw className="w-5 h-5" />
                          </button>
                          {video.video_url && (
                            <a
                              href={video.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex items-center space-x-1"
                              title="View video"
                            >
                              <Play className="w-5 h-5" />
                            </a>
                          )}
                          {video.status === 'completed' && video.video_url && (
                            <button
                              onClick={() => postVideoToSocial(video)}
                              disabled={isLoading}
                              className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-4 py-2 rounded-lg font-medium hover:from-green-600 hover:to-teal-600 disabled:opacity-50 flex items-center space-x-2 transition-all"
                            >
                              <Send className="w-4 h-4" />
                              <span>Post to Social</span>
                            </button>
                          )}
                        </div>
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
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Connected Accounts</h2>
                <p className="text-gray-600 mt-1">Manage your social media connections</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => uploadPostUser?.username && checkConnectedAccounts(uploadPostUser.username)}
                  disabled={isLoading || !uploadPostUser?.username}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center space-x-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={connectSocialAccount}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-2 rounded-lg font-medium hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 flex items-center space-x-2 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Connect Account</span>
                </button>
              </div>
            </div>

            {connectedAccounts.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                <div className="bg-gray-100 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6">
                  <Globe className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No accounts connected</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Connect your social media accounts to start posting videos automatically across multiple platforms.
                </p>
                <button
                  onClick={connectSocialAccount}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 transition-all"
                >
                  {isLoading ? 'Connecting...' : 'Connect Your First Account'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {connectedAccounts.map((account, index) => (
                  <div key={index} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-center space-x-4 mb-4">
                        <div className={`p-3 rounded-xl text-white ${getPlatformColor(account.platform)}`}>
                          {getSocialIcon(account.platform)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 capitalize">{account.platform}</h3>
                          <p className="text-sm text-gray-600">{account.account_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          Connected
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(account.connected_at).toLocaleDateString()}
                        </span>
                      </div>
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