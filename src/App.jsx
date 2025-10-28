import React, { useState, useEffect } from 'react';
import { 
  Video, Plus, Instagram, Youtube, Facebook, Loader2, CheckCircle, XCircle, 
  Clock, ExternalLink, RefreshCw, Sparkles, Send, Settings, 
  TrendingUp, Users, Zap, Eye, BarChart3, Globe, X as TwitterIcon,
  MessageCircle, AlertCircle, ChevronRight, Play, Download,
  Home, ShoppingBag, User, CreditCard, Package, 
  Star, Search, Edit, MoreHorizontal, Calendar, Maximize2
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

  const [activeTab, setActiveTab] = useState('analytics');
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

  // API functions (keeping existing logic)
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

  // Stats calculations
  const stats = {
    totalVideos: videos.length,
    completedVideos: videos.filter(v => v.status === 'completed' || v.status === 'posted').length,
    postedVideos: videos.filter(v => v.status === 'posted').length,
    connectedPlatforms: connectedAccounts.length
  };

  return (
    <div className="flex h-screen bg-gray-50">
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

      {/* Sidebar - Exact Shopify Style */}
      <div className="w-64 bg-gray-800 text-white flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-green-500 w-8 h-8 rounded flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg">Content Factory</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          {[
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'create', label: 'Create Video', icon: Plus },
            { id: 'videos', label: 'Videos', icon: Video, badge: videos.length },
            { id: 'accounts', label: 'Connected Accounts', icon: Globe },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors mb-1 ${
                activeTab === item.id 
                  ? 'bg-gray-700 text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center space-x-3">
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="bg-gray-600 text-xs px-2 py-1 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-xs font-semibold">{currentUser.slice(-2).toUpperCase()}</span>
            </div>
            <div>
              <p className="text-sm font-medium">Content Factory</p>
              <p className="text-xs text-gray-400">{currentUser}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-semibold text-gray-900">
                {activeTab === 'analytics' && 'Analytics'}
                {activeTab === 'create' && 'Create Video'}
                {activeTab === 'videos' && 'Videos'}
                {activeTab === 'accounts' && 'Connected Accounts'}
                {activeTab === 'settings' && 'Settings'}
              </h1>
              {activeTab === 'analytics' && (
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>Last 30 days</span>
                  <span>Compare to: May 7-Jun 5, 2024</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <Search className="w-5 h-5 text-gray-400" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <Edit className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {/* Analytics Tab - Exact Shopify Style */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Top Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Videos */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Total Videos</h3>
                    <button className="text-gray-400 hover:text-gray-600">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-bold text-gray-900">{stats.totalVideos}</span>
                    <span className="text-sm font-medium text-green-600">+20%</span>
                  </div>
                  <div className="mt-4">
                    <div className="h-12 bg-gradient-to-r from-blue-50 to-blue-100 rounded flex items-end px-2">
                      <div className="flex space-x-1 items-end w-full">
                        {[0.3, 0.6, 0.4, 0.8, 0.5, 0.9, 0.7, 0.6, 0.8, 0.9, 1.0, 0.7].map((height, i) => (
                          <div key={i} className="bg-blue-500 w-2 rounded-t" style={{height: `${height * 32}px`}}></div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>Jun 6</span>
                      <span>Jun 14</span>
                      <span>Jun 22</span>
                      <span>Jul 5</span>
                    </div>
                  </div>
                </div>

                {/* Completed Videos */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Completed Videos</h3>
                    <button className="text-gray-400 hover:text-gray-600">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-bold text-gray-900">{stats.completedVideos}</span>
                    <span className="text-sm font-medium text-green-600">+5%</span>
                  </div>
                  <div className="mt-4">
                    <div className="h-12 bg-gradient-to-r from-green-50 to-green-100 rounded flex items-end px-2">
                      <div className="flex space-x-1 items-end w-full">
                        {[0.2, 0.4, 0.3, 0.6, 0.4, 0.7, 0.5, 0.4, 0.6, 0.7, 0.8, 0.5].map((height, i) => (
                          <div key={i} className="bg-green-500 w-2 rounded-t" style={{height: `${height * 32}px`}}></div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>Jun 6</span>
                      <span>Jun 14</span>
                      <span>Jun 22</span>
                      <span>Jul 5</span>
                    </div>
                  </div>
                </div>

                {/* Sessions by Device Type (Donut Chart) */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Platforms by Usage</h3>
                    <button className="text-gray-400 hover:text-gray-600">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-center mt-4">
                    <div className="relative w-32 h-32">
                      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="3"
                        />
                        {/* Instagram - 40% */}
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="3"
                          strokeDasharray="40, 100"
                        />
                        {/* YouTube - 30% */}
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="3"
                          strokeDasharray="30, 100"
                          strokeDashoffset="-40"
                        />
                        {/* TikTok - 20% */}
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3"
                          strokeDasharray="20, 100"
                          strokeDashoffset="-70"
                        />
                        {/* Others - 10% */}
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#8b5cf6"
                          strokeWidth="3"
                          strokeDasharray="10, 100"
                          strokeDashoffset="-90"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-lg font-bold text-gray-900">{stats.connectedPlatforms}K</div>
                          <div className="text-xs text-gray-500">+8%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span>Instagram</span>
                      </div>
                      <span className="font-medium">40%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span>YouTube</span>
                      </div>
                      <span className="font-medium">30%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span>TikTok</span>
                      </div>
                      <span className="font-medium">20%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        <span>Others</span>
                      </div>
                      <span className="font-medium">10%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Platform Performance */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-600">Platform Performance</h3>
                    <button className="text-gray-400 hover:text-gray-600">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    {[
                      { name: 'Instagram', value: '$11.6K', growth: '20%', color: 'bg-gradient-to-r from-purple-500 to-pink-500' },
                      { name: 'YouTube', value: '$7.5K', growth: '5%', color: 'bg-red-500' },
                      { name: 'TikTok', value: '$2.1K', growth: '20%', color: 'bg-black' },
                      { name: 'Facebook', value: '$987', growth: '10%', color: 'bg-blue-600' },
                      { name: 'Twitter', value: '$261', growth: '12%', color: 'bg-black' }
                    ].map((platform, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded ${platform.color}`}></div>
                          <span className="font-medium text-gray-900">{platform.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">{platform.value}</div>
                          <div className="text-sm text-green-600">+{platform.growth}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Video Performance by Topic */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-600">Top Video Topics</h3>
                    <button className="text-gray-400 hover:text-gray-600">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    {[
                      { topic: 'Business Tips', views: '$10K', growth: '8%' },
                      { topic: 'Tech Reviews', views: '$9.75K', growth: '2%' },
                      { topic: 'Tutorial', views: '$7.5K', growth: '4%' },
                      { topic: 'Lifestyle', views: '$8.5K', growth: '12%' },
                      { topic: 'Entertainment', views: '$6K', growth: '6%' }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-full max-w-32">
                            <div className="text-sm font-medium text-gray-900 mb-1">{item.topic}</div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full" 
                                style={{width: `${60 + index * 10}%`}}
                              ></div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">{item.views}</div>
                          <div className="text-sm text-green-600">+{item.growth}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create Video Tab */}
          {activeTab === 'create' && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-lg border border-gray-200 p-8">
                <div className="text-center mb-8">
                  <div className="bg-gradient-to-r from-purple-500 to-blue-500 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
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
                      className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all"
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
                        className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                        className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      >
                        <option value={30}>30 seconds - Quick & Punchy</option>
                        <option value={60}>1 minute - Perfect for Social</option>
                        <option value={90}>1.5 minutes - Detailed</option>
                        <option value={120}>2 minutes - In-depth</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={createVideo}
                    disabled={isLoading || !videoForm.topic.trim()}
                    className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 transition-all"
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
          )}

          {/* Videos Tab */}
          {activeTab === 'videos' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Videos</h2>
                  <p className="text-gray-600 mt-1">{videos.length} videos created</p>
                </div>
                <button
                  onClick={() => setActiveTab('create')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center space-x-2 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Video</span>
                </button>
              </div>

              {videos.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                  <div className="bg-gray-100 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-6">
                    <Video className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No videos yet</h3>
                  <p className="text-gray-600 mb-6">Create your first AI-generated video to get started with automated content creation.</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all"
                  >
                    Create Your First Video
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900">All Videos</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {videos.map((video, index) => (
                      <div key={video.local_id || index} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {getStatusIcon(video.status)}
                            <div>
                              <h3 className="font-medium text-gray-900">{video.topic}</h3>
                              <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                <span>Style: {video.style}</span>
                                <span>Duration: {video.duration}s</span>
                                <span>{new Date(video.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              video.status === 'generating' ? 'bg-blue-100 text-blue-800' :
                              video.status === 'completed' ? 'bg-green-100 text-green-800' :
                              video.status === 'posted' ? 'bg-purple-100 text-purple-800' :
                              video.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {video.status}
                            </span>
                            <button
                              onClick={() => refreshVideoStatus(video.video_id)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                              title="Refresh status"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            {video.video_url && (
                              <a
                                href={video.video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                                title="View video"
                              >
                                <Play className="w-4 h-4" />
                              </a>
                            )}
                            {video.status === 'completed' && video.video_url && (
                              <button
                                onClick={() => postVideoToSocial(video)}
                                disabled={isLoading}
                                className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-1 transition-all"
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
                </div>
              )}
            </div>
          )}

          {/* Connected Accounts Tab */}
          {activeTab === 'accounts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Connected Accounts</h2>
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
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Connect Account</span>
                  </button>
                </div>
              </div>

              {connectedAccounts.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                  <div className="bg-gray-100 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-6">
                    <Globe className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No accounts connected</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Connect your social media accounts to start posting videos automatically across multiple platforms.
                  </p>
                  <button
                    onClick={connectSocialAccount}
                    disabled={isLoading}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all"
                  >
                    {isLoading ? 'Connecting...' : 'Connect Your First Account'}
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900">Connected Platforms</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {connectedAccounts.map((account, index) => (
                      <div key={index} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`p-2 rounded text-white ${
                              account.platform.toLowerCase() === 'instagram' ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                              account.platform.toLowerCase() === 'youtube' ? 'bg-red-500' :
                              account.platform.toLowerCase() === 'facebook' ? 'bg-blue-600' :
                              account.platform.toLowerCase() === 'tiktok' ? 'bg-black' :
                              'bg-gray-500'
                            }`}>
                              {getSocialIcon(account.platform)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 capitalize">{account.platform}</h3>
                              <p className="text-sm text-gray-600">{account.account_name}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
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
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Application Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Default Video Style</label>
                    <select className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option>Casual & Friendly</option>
                      <option>Professional & Business</option>
                      <option>Energetic & Dynamic</option>
                      <option>Educational & Informative</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Default Duration</label>
                    <select className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option>30 seconds</option>
                      <option>1 minute</option>
                      <option>1.5 minutes</option>
                      <option>2 minutes</option>
                    </select>
                  </div>
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                    Save Settings
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;