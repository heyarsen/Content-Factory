import React, { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import AuthWrapper from './components/auth/AuthWrapper';
import AdminDashboard from './components/admin/AdminDashboard';
import { useAuth } from './contexts/AuthContext';
import { 
  Video, Plus, Instagram, Youtube, Facebook, Loader2, CheckCircle, XCircle, 
  Clock, ExternalLink, RefreshCw, Sparkles, Send, Settings, 
  TrendingUp, Users, Zap, Eye, BarChart3, Globe, X as TwitterIcon,
  MessageCircle, AlertCircle, ChevronRight, Play, Download,
  Home, ShoppingBag, User, CreditCard, Package, 
  Star, Search, Edit, MoreHorizontal, Calendar, Maximize2, 
  Trash2, Filter, CheckSquare, Square, ArrowUpDown, LogOut, Crown
} from 'lucide-react';

const MainApp = () => {
  const { user, workspace, logout, apiCall } = useAuth();
  const [activeTab, setActiveTab] = useState('analytics');
  const [videos, setVideos] = useState([]);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [videoForm, setVideoForm] = useState({
    topic: '',
    style: 'CASUAL',
    duration: 60,
    avatar_id: 'default_avatar',
    voice_id: 'default_voice'
  });
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });
  
  // Enhanced state for video management
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [videoFilter, setVideoFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    if (user && workspace) {
      loadUserData();
    }
  }, [user, workspace]);

  // Show admin dashboard if user is admin
  if (user?.role === 'ADMIN') {
    return <AdminDashboard />;
  }

  const loadUserData = async () => {
    await Promise.all([
      loadVideos(),
      loadConnectedAccounts()
    ]);
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'info' }), 5000);
  };

  const loadVideos = async () => {
    try {
      const response = await apiCall(`/api/videos?workspaceId=${workspace.id}`);
      if (response.ok) {
        const data = await response.json();
        setVideos(data.videos || []);
      } else {
        console.error('Failed to load videos');
      }
    } catch (error) {
      console.error('Error loading videos:', error);
    }
  };

  const loadConnectedAccounts = async () => {
    try {
      const response = await apiCall(`/api/social-accounts?workspaceId=${workspace.id}`);
      if (response.ok) {
        const data = await response.json();
        setConnectedAccounts(data.accounts || []);
      } else {
        console.error('Failed to load connected accounts');
      }
    } catch (error) {
      console.error('Error loading connected accounts:', error);
    }
  };

  // Enhanced Delete Functions
  const deleteVideo = async (videoId) => {
    try {
      const response = await apiCall(`/api/videos/${videoId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setVideos(prev => prev.filter(v => v.id !== videoId));
        setSelectedVideos(prev => prev.filter(id => id !== videoId));
        setShowDeleteConfirm(null);
        showNotification('Video deleted successfully', 'success');
      } else {
        const data = await response.json();
        showNotification(data.error || 'Failed to delete video', 'error');
      }
    } catch (error) {
      showNotification('Error deleting video', 'error');
    }
  };

  const deleteSelectedVideos = async () => {
    try {
      const response = await apiCall('/api/videos/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ video_ids: selectedVideos })
      });
      
      if (response.ok) {
        setVideos(prev => prev.filter(v => !selectedVideos.includes(v.id)));
        setSelectedVideos([]);
        setShowBulkDeleteConfirm(false);
        showNotification(`${selectedVideos.length} videos deleted successfully`, 'success');
      } else {
        const data = await response.json();
        showNotification(data.error || 'Failed to delete videos', 'error');
      }
    } catch (error) {
      showNotification('Error deleting videos', 'error');
    }
  };

  const clearAllVideos = async () => {
    try {
      const response = await apiCall('/api/videos/clear-all', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: workspace.id })
      });
      
      if (response.ok) {
        setVideos([]);
        setSelectedVideos([]);
        showNotification('All videos cleared', 'success');
      } else {
        const data = await response.json();
        showNotification(data.error || 'Failed to clear videos', 'error');
      }
    } catch (error) {
      showNotification('Error clearing videos', 'error');
    }
  };

  // Video Selection Functions
  const toggleVideoSelection = (videoId) => {
    setSelectedVideos(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  };

  const selectAllVideos = () => {
    const allVideoIds = filteredAndSortedVideos.map(v => v.id);
    setSelectedVideos(allVideoIds);
  };

  const deselectAllVideos = () => {
    setSelectedVideos([]);
  };

  // Filter and Sort Functions
  const filteredAndSortedVideos = videos
    .filter(video => {
      // Filter by status
      if (videoFilter !== 'all' && video.status.toLowerCase() !== videoFilter.toLowerCase()) return false;
      
      // Filter by search query
      if (searchQuery && !video.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !video.topic.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'created_at':
          comparison = new Date(a.createdAt) - new Date(b.createdAt);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'duration':
          comparison = a.duration - b.duration;
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  const connectSocialAccount = async () => {
    setIsLoading(true);
    try {
      const response = await apiCall('/api/social-accounts/connect', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: workspace.id })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        if (data.auth_url) {
          window.open(data.auth_url, '_blank', 'width=800,height=700,scrollbars=yes,resizable=yes');
          showNotification('Connection window opened! Complete the setup and click "Refresh Accounts" when done.', 'info');
        }
      } else {
        showNotification(data.error || 'Failed to connect accounts', 'error');
      }
    } catch (error) {
      showNotification('Error connecting accounts', 'error');
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
    try {
      const response = await apiCall('/api/videos', {
        method: 'POST',
        body: JSON.stringify({
          ...videoForm,
          workspaceId: workspace.id,
          title: videoForm.topic
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setVideos(prev => [data.video, ...prev]);
        setActiveTab('videos');
        setVideoForm({ 
          topic: '', 
          style: 'CASUAL', 
          duration: 60, 
          avatar_id: 'default_avatar', 
          voice_id: 'default_voice' 
        });
        showNotification('Video generation started! Check the videos tab for progress.', 'success');
      } else {
        showNotification(data.error || 'Failed to create video', 'error');
      }
    } catch (error) {
      showNotification('Error creating video', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshVideoStatus = async (videoId) => {
    try {
      const response = await apiCall(`/api/videos/${videoId}/status`);
      
      if (response.ok) {
        const data = await response.json();
        setVideos(prev => prev.map(v =>
          v.id === videoId ? { ...v, ...data.video } : v
        ));
        showNotification('Video status updated!', 'success');
      } else {
        const data = await response.json();
        showNotification(data.error || 'Failed to refresh video status', 'error');
      }
    } catch (error) {
      showNotification('Error refreshing video status', 'error');
    }
  };

  const postVideoToSocial = async (video) => {
    if (!video.videoUrl) {
      showNotification('Video URL not available yet. Please wait for generation to complete.', 'error');
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
      const response = await apiCall('/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          videoId: video.id,
          workspaceId: workspace.id,
          caption: `Check out this AI-generated video about: ${video.topic} #AI #ContentCreation #VideoMarketing`,
          platforms: selectedPlatforms
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setVideos(prev => prev.map(v =>
          v.id === video.id ? { ...v, status: 'PUBLISHED' } : v
        ));
        showNotification(`Video posted to ${selectedPlatforms.length} platforms successfully! 🎉`, 'success');
      } else {
        showNotification(data.error || 'Failed to post video', 'error');
      }
    } catch (error) {
      showNotification('Error posting video', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper functions
  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'GENERATING': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'COMPLETED': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'PUBLISHED': return <CheckCircle className="w-4 h-4 text-purple-500" />;
      case 'FAILED': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSocialIcon = (platform) => {
    const lower = platform?.toLowerCase();
    const iconClass = "w-5 h-5";
    switch (lower) {
      case 'instagram': return <Instagram className={iconClass} />;
      case 'youtube': return <Youtube className={iconClass} />;
      case 'facebook': return <Facebook className={iconClass} />;
      case 'tiktok': return <Video className={iconClass} />;
      case 'twitter': return <TwitterIcon className={iconClass} />;
      case 'linkedin': return <MessageCircle className={iconClass} />;
      default: return <Video className={iconClass} />;
    }
  };

  // Stats calculations
  const stats = {
    totalVideos: videos.length,
    completedVideos: videos.filter(v => v.status === 'COMPLETED' || v.status === 'PUBLISHED').length,
    publishedVideos: videos.filter(v => v.status === 'PUBLISHED').length,
    connectedPlatforms: connectedAccounts.length
  };

  const handleLogout = () => {
    logout();
    showNotification('Successfully logged out', 'success');
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

      {/* Delete Confirmation Modals */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 rounded-full p-2">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Video</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this video? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteVideo(showDeleteConfirm)}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 rounded-full p-2">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Selected Videos</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {selectedVideos.length} selected videos? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteSelectedVideos}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Delete {selectedVideos.length} Videos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-green-500 w-8 h-8 rounded flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-semibold text-lg">Content Factory</span>
              <p className="text-xs text-gray-400">{workspace?.name}</p>
            </div>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-xs font-semibold">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-gray-400">@{user?.username}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-sm text-gray-600">
                Welcome back, <span className="font-medium">{user?.firstName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Top Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Total Videos</h3>
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-bold text-gray-900">{stats.totalVideos}</span>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Completed Videos</h3>
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-bold text-gray-900">{stats.completedVideos}</span>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Published Videos</h3>
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-bold text-gray-900">{stats.publishedVideos}</span>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Connected Platforms</h3>
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-bold text-gray-900">{stats.connectedPlatforms}</span>
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
                        <option value="CASUAL">Casual & Friendly</option>
                        <option value="PROFESSIONAL">Professional & Business</option>
                        <option value="ENERGETIC">Energetic & Dynamic</option>
                        <option value="EDUCATIONAL">Educational & Informative</option>
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
                  <p className="text-gray-600 mt-1">{filteredAndSortedVideos.length} of {videos.length} videos</p>
                </div>
                <div className="flex items-center space-x-3">
                  {selectedVideos.length > 0 && (
                    <button
                      onClick={() => setShowBulkDeleteConfirm(true)}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 flex items-center space-x-2 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete {selectedVideos.length}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('create')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center space-x-2 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Video</span>
                  </button>
                </div>
              </div>

              {/* Enhanced Filters and Controls */}
              {videos.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Search */}
                    <div className="flex-1 min-w-64">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search videos..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center space-x-2">
                      <Filter className="w-4 h-4 text-gray-400" />
                      <select
                        value={videoFilter}
                        onChange={(e) => setVideoFilter(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="all">All Status</option>
                        <option value="generating">Generating</option>
                        <option value="completed">Completed</option>
                        <option value="published">Published</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>

                    {/* Sort */}
                    <div className="flex items-center space-x-2">
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                      <select
                        value={`${sortBy}-${sortOrder}`}
                        onChange={(e) => {
                          const [field, order] = e.target.value.split('-');
                          setSortBy(field);
                          setSortOrder(order);
                        }}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="created_at-desc">Newest First</option>
                        <option value="created_at-asc">Oldest First</option>
                        <option value="title-asc">Title A-Z</option>
                        <option value="title-desc">Title Z-A</option>
                        <option value="status-asc">Status A-Z</option>
                        <option value="duration-desc">Longest First</option>
                        <option value="duration-asc">Shortest First</option>
                      </select>
                    </div>

                    {/* Bulk Selection */}
                    {filteredAndSortedVideos.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => 
                            selectedVideos.length === filteredAndSortedVideos.length 
                              ? deselectAllVideos() 
                              : selectAllVideos()
                          }
                          className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
                        >
                          {selectedVideos.length === filteredAndSortedVideos.length ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                          <span>
                            {selectedVideos.length === filteredAndSortedVideos.length 
                              ? 'Deselect All' 
                              : 'Select All'
                            }
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {filteredAndSortedVideos.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                  <div className="bg-gray-100 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-6">
                    <Video className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {videos.length === 0 ? 'No videos yet' : 'No videos match your search'}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {videos.length === 0 
                      ? 'Create your first AI-generated video to get started with automated content creation.'
                      : 'Try adjusting your search or filter criteria.'
                    }
                  </p>
                  {videos.length === 0 ? (
                    <button
                      onClick={() => setActiveTab('create')}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all"
                    >
                      Create Your First Video
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setVideoFilter('all');
                      }}
                      className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-all"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900">All Videos</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {filteredAndSortedVideos.map((video, index) => {
                      const videoId = video.id;
                      const isSelected = selectedVideos.includes(videoId);
                      
                      return (
                        <div key={videoId || index} className={`px-6 py-4 transition-colors ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              {/* Selection Checkbox */}
                              <button
                                onClick={() => toggleVideoSelection(videoId)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-5 h-5 text-blue-600" />
                                ) : (
                                  <Square className="w-5 h-5" />
                                )}
                              </button>
                              
                              {getStatusIcon(video.status)}
                              <div>
                                <h3 className="font-medium text-gray-900">{video.title || video.topic}</h3>
                                <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                  <span>Style: {video.style}</span>
                                  <span>Duration: {video.duration}s</span>
                                  <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                video.status === 'GENERATING' ? 'bg-blue-100 text-blue-800' :
                                video.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                video.status === 'PUBLISHED' ? 'bg-purple-100 text-purple-800' :
                                video.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {video.status?.toLowerCase()}
                              </span>
                              
                              <button
                                onClick={() => refreshVideoStatus(video.id)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Refresh status"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              
                              {video.videoUrl && (
                                <a
                                  href={video.videoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                  title="View video"
                                >
                                  <Play className="w-4 h-4" />
                                </a>
                              )}
                              
                              {video.status === 'COMPLETED' && video.videoUrl && (
                                <button
                                  onClick={() => postVideoToSocial(video)}
                                  disabled={isLoading}
                                  className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-1 transition-all"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>Post</span>
                                </button>
                              )}
                              
                              {/* Delete Button */}
                              <button
                                onClick={() => setShowDeleteConfirm(videoId)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete video"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
                    onClick={loadConnectedAccounts}
                    disabled={isLoading}
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
                              account.platform?.toLowerCase() === 'instagram' ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                              account.platform?.toLowerCase() === 'youtube' ? 'bg-red-500' :
                              account.platform?.toLowerCase() === 'facebook' ? 'bg-blue-600' :
                              account.platform?.toLowerCase() === 'tiktok' ? 'bg-black' :
                              account.platform?.toLowerCase() === 'twitter' ? 'bg-blue-400' :
                              account.platform?.toLowerCase() === 'linkedin' ? 'bg-blue-700' :
                              'bg-gray-500'
                            }`}>
                              {getSocialIcon(account.platform)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 capitalize">{account.platform}</h3>
                              <p className="text-sm text-gray-600">{account.account_name || account.username}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                              Connected
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(account.connected_at || account.createdAt).toLocaleDateString()}
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
              
              {/* Danger Zone */}
              <div className="bg-white rounded-lg border border-red-200 p-6">
                <h3 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h3>
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-900 mb-2">Clear All Videos</h4>
                    <p className="text-sm text-red-700 mb-4">
                      This will permanently delete all videos from your workspace. This action cannot be undone.
                    </p>
                    <button
                      onClick={clearAllVideos}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
                    >
                      Clear All Videos
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AuthWrapper>
        <MainApp />
      </AuthWrapper>
    </AuthProvider>
  );
};

export default App;