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
  Trash2, Filter, CheckSquare, Square, ArrowUpDown, LogOut, Crown,
  Menu, Bell, HelpCircle, Shield
} from 'lucide-react';

const MainApp = () => {
  const { user, workspace, logout, apiCall } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [videos, setVideos] = useState([]);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
        <div className={`fixed top-6 right-6 z-50 max-w-md p-4 rounded-xl shadow-2xl border-l-4 backdrop-blur-sm ${
          notification.type === 'success' ? 'bg-white/95 border-green-400 text-green-800' :
          notification.type === 'error' ? 'bg-white/95 border-red-400 text-red-800' :
          'bg-white/95 border-blue-400 text-blue-800'
        }`}>
          <div className="flex items-start space-x-3">
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" /> :
             notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" /> :
             <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />}
            <div className="flex-1">
              <p className="text-sm font-medium leading-relaxed">{notification.message}</p>
            </div>
            <button 
              onClick={() => setNotification({ show: false, message: '', type: 'info' })}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modals */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center space-x-4 mb-6">
              <div className="bg-red-100 rounded-full p-3">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Delete Video</h3>
            </div>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Are you sure you want to delete this video? This action cannot be undone and will permanently remove all associated data.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-medium hover:bg-gray-200 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteVideo(showDeleteConfirm)}
                className="flex-1 bg-red-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-red-700 transition-all duration-200 shadow-lg hover:shadow-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center space-x-4 mb-6">
              <div className="bg-red-100 rounded-full p-3">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Delete Selected Videos</h3>
            </div>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Are you sure you want to delete {selectedVideos.length} selected videos? This action cannot be undone.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-medium hover:bg-gray-200 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={deleteSelectedVideos}
                className="flex-1 bg-red-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-red-700 transition-all duration-200 shadow-lg hover:shadow-red-200"
              >
                Delete {selectedVideos.length} Videos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-20' : 'w-72'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 shadow-lg`}>
        {/* Logo */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              {!sidebarCollapsed && (
                <div>
                  <span className="font-bold text-xl bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    Content Fabrica
                  </span>
                  <p className="text-xs text-gray-500 font-medium">{workspace?.name}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'create', label: 'Create Video', icon: Plus },
            { id: 'videos', label: 'Videos', icon: Video, badge: videos.length },
            { id: 'accounts', label: 'Accounts', icon: Globe },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                activeTab === item.id 
                  ? 'bg-gradient-to-r from-purple-50 to-blue-50 text-purple-700 shadow-sm border border-purple-100' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <item.icon className={`w-5 h-5 ${
                  activeTab === item.id ? 'text-purple-600' : 'text-gray-400 group-hover:text-gray-600'
                }`} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </div>
              {!sidebarCollapsed && item.badge && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  activeTab === item.id 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-sm font-bold text-white">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">@{user?.username}</p>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
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
        <div className="bg-white border-b border-gray-100 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <h1 className="text-3xl font-bold text-gray-900">
                {activeTab === 'dashboard' && '📊 Dashboard'}
                {activeTab === 'create' && '✨ Create Video'}
                {activeTab === 'videos' && '🎬 Videos'}
                {activeTab === 'accounts' && '🌐 Connected Accounts'}
                {activeTab === 'settings' && '⚙️ Settings'}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200">
                <Bell className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200">
                <HelpCircle className="w-5 h-5" />
              </button>
              <div className="text-sm text-gray-600">
                Welcome back, <span className="font-semibold text-gray-900">{user?.firstName}</span> 👋
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-8 bg-gray-50">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Top Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center">
                      <Video className="w-6 h-6 text-blue-600" />
                    </div>
                    <span className="text-2xl">📹</span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-600">Total Videos</h3>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalVideos}</p>
                    <p className="text-xs text-green-600 font-medium">+12% from last month</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-green-50 w-12 h-12 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <span className="text-2xl">✅</span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-600">Completed</h3>
                    <p className="text-3xl font-bold text-gray-900">{stats.completedVideos}</p>
                    <p className="text-xs text-green-600 font-medium">+8% completion rate</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-purple-50 w-12 h-12 rounded-xl flex items-center justify-center">
                      <Send className="w-6 h-6 text-purple-600" />
                    </div>
                    <span className="text-2xl">🚀</span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-600">Published</h3>
                    <p className="text-3xl font-bold text-gray-900">{stats.publishedVideos}</p>
                    <p className="text-xs text-purple-600 font-medium">Across {stats.connectedPlatforms} platforms</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-orange-50 w-12 h-12 rounded-xl flex items-center justify-center">
                      <Globe className="w-6 h-6 text-orange-600" />
                    </div>
                    <span className="text-2xl">🌐</span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-600">Platforms</h3>
                    <p className="text-3xl font-bold text-gray-900">{stats.connectedPlatforms}</p>
                    <p className="text-xs text-orange-600 font-medium">Social accounts connected</p>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setActiveTab('create')}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl group"
                  >
                    <div className="flex items-center space-x-3">
                      <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      <span className="font-semibold">Create New Video</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('accounts')}
                    className="bg-white border-2 border-gray-200 text-gray-700 p-6 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 group"
                  >
                    <div className="flex items-center space-x-3">
                      <Globe className="w-6 h-6 group-hover:text-purple-600 transition-colors" />
                      <span className="font-semibold">Connect Accounts</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('videos')}
                    className="bg-white border-2 border-gray-200 text-gray-700 p-6 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
                  >
                    <div className="flex items-center space-x-3">
                      <Video className="w-6 h-6 group-hover:text-blue-600 transition-colors" />
                      <span className="font-semibold">View All Videos</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create Video Tab */}
          {activeTab === 'create' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl border border-gray-100 p-10 shadow-sm">
                <div className="text-center mb-10">
                  <div className="bg-gradient-to-r from-purple-600 to-blue-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Sparkles className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">Create AI Video</h2>
                  <p className="text-lg text-gray-600">Transform your ideas into engaging content with AI magic ✨</p>
                </div>
                
                <div className="space-y-8">
                  <div>
                    <label className="block text-lg font-semibold text-gray-900 mb-4">
                      💡 What's your video about?
                    </label>
                    <textarea
                      value={videoForm.topic}
                      onChange={(e) => setVideoForm({...videoForm, topic: e.target.value})}
                      placeholder="e.g., How to start a successful online business, 10 productivity tips for entrepreneurs, Latest trends in digital marketing..."
                      className="w-full p-6 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-purple-100 focus:border-purple-400 resize-none transition-all duration-200 text-lg leading-relaxed"
                      rows={6}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-lg font-semibold text-gray-900 mb-4">
                        🎭 Video Style
                      </label>
                      <select
                        value={videoForm.style}
                        onChange={(e) => setVideoForm({...videoForm, style: e.target.value})}
                        className="w-full p-6 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all duration-200 text-lg"
                      >
                        <option value="CASUAL">😊 Casual & Friendly</option>
                        <option value="PROFESSIONAL">💼 Professional & Business</option>
                        <option value="ENERGETIC">⚡ Energetic & Dynamic</option>
                        <option value="EDUCATIONAL">📚 Educational & Informative</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-lg font-semibold text-gray-900 mb-4">
                        ⏱️ Duration
                      </label>
                      <select
                        value={videoForm.duration}
                        onChange={(e) => setVideoForm({...videoForm, duration: parseInt(e.target.value)})}
                        className="w-full p-6 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all duration-200 text-lg"
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
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-6 px-8 rounded-2xl font-bold text-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-4 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span>Creating Your Masterpiece...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-6 h-6" />
                        <span>Generate AI Video 🚀</span>
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
                  <h2 className="text-2xl font-bold text-gray-900">Your Videos</h2>
                  <p className="text-gray-600 mt-2">{filteredAndSortedVideos.length} of {videos.length} videos</p>
                </div>
                <div className="flex items-center space-x-4">
                  {selectedVideos.length > 0 && (
                    <button
                      onClick={() => setShowBulkDeleteConfirm(true)}
                      className="bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-700 flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-red-200"
                    >
                      <Trash2 className="w-5 h-5" />
                      <span>Delete {selectedVideos.length}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('create')}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <Plus className="w-5 h-5" />
                    <span>New Video</span>
                  </button>
                </div>
              </div>

              {/* Enhanced Filters and Controls */}
              {videos.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  <div className="flex flex-wrap items-center gap-6">
                    {/* Search */}
                    <div className="flex-1 min-w-80">
                      <div className="relative">
                        <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search videos..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-12 pr-6 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all duration-200"
                        />
                      </div>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center space-x-3">
                      <Filter className="w-5 h-5 text-gray-400" />
                      <select
                        value={videoFilter}
                        onChange={(e) => setVideoFilter(e.target.value)}
                        className="border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all duration-200"
                      >
                        <option value="all">All Status</option>
                        <option value="generating">Generating</option>
                        <option value="completed">Completed</option>
                        <option value="published">Published</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>

                    {/* Sort */}
                    <div className="flex items-center space-x-3">
                      <ArrowUpDown className="w-5 h-5 text-gray-400" />
                      <select
                        value={`${sortBy}-${sortOrder}`}
                        onChange={(e) => {
                          const [field, order] = e.target.value.split('-');
                          setSortBy(field);
                          setSortOrder(order);
                        }}
                        className="border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all duration-200"
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
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => 
                            selectedVideos.length === filteredAndSortedVideos.length 
                              ? deselectAllVideos() 
                              : selectAllVideos()
                          }
                          className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl transition-all duration-200"
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
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                  <div className="bg-gray-50 w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-8">
                    <Video className="w-12 h-12 text-gray-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    {videos.length === 0 ? '🎬 No videos yet' : '🔍 No videos match your search'}
                  </h3>
                  <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
                    {videos.length === 0 
                      ? 'Create your first AI-generated video to get started with automated content creation.'
                      : 'Try adjusting your search or filter criteria.'
                    }
                  </p>
                  {videos.length === 0 ? (
                    <button
                      onClick={() => setActiveTab('create')}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      Create Your First Video ✨
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setVideoFilter('all');
                      }}
                      className="bg-gray-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-700 transition-all duration-200 shadow-lg"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                  <div className="px-8 py-6 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">All Videos</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {filteredAndSortedVideos.map((video, index) => {
                      const videoId = video.id;
                      const isSelected = selectedVideos.includes(videoId);
                      
                      return (
                        <div key={videoId || index} className={`px-8 py-6 transition-all duration-200 ${
                          isSelected ? 'bg-purple-50 border-l-4 border-purple-400' : 'hover:bg-gray-50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-6">
                              {/* Selection Checkbox */}
                              <button
                                onClick={() => toggleVideoSelection(videoId)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-6 h-6 text-purple-600" />
                                ) : (
                                  <Square className="w-6 h-6" />
                                )}
                              </button>
                              
                              <div className="flex items-center space-x-4">
                                {getStatusIcon(video.status)}
                                <div>
                                  <h3 className="font-semibold text-gray-900 text-lg">{video.title || video.topic}</h3>
                                  <div className="flex items-center space-x-6 text-sm text-gray-500 mt-2">
                                    <span className="flex items-center space-x-1">
                                      <span>🎭</span>
                                      <span>{video.style}</span>
                                    </span>
                                    <span className="flex items-center space-x-1">
                                      <span>⏱️</span>
                                      <span>{video.duration}s</span>
                                    </span>
                                    <span className="flex items-center space-x-1">
                                      <span>📅</span>
                                      <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <span className={`px-4 py-2 rounded-xl text-sm font-semibold ${
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
                                className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
                                title="Refresh status"
                              >
                                <RefreshCw className="w-5 h-5" />
                              </button>
                              
                              {video.videoUrl && (
                                <a
                                  href={video.videoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-3 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all duration-200"
                                  title="View video"
                                >
                                  <Play className="w-5 h-5" />
                                </a>
                              )}
                              
                              {video.status === 'COMPLETED' && video.videoUrl && (
                                <button
                                  onClick={() => postVideoToSocial(video)}
                                  disabled={isLoading}
                                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                                >
                                  <Send className="w-4 h-4" />
                                  <span>Post</span>
                                </button>
                              )}
                              
                              {/* Delete Button */}
                              <button
                                onClick={() => setShowDeleteConfirm(videoId)}
                                className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
                                title="Delete video"
                              >
                                <Trash2 className="w-5 h-5" />
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
                  <h2 className="text-2xl font-bold text-gray-900">Connected Accounts</h2>
                  <p className="text-gray-600 mt-2">Manage your social media connections</p>
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={loadConnectedAccounts}
                    disabled={isLoading}
                    className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 disabled:opacity-50 flex items-center space-x-2 transition-all duration-200"
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={connectSocialAccount}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Connect Account</span>
                  </button>
                </div>
              </div>

              {connectedAccounts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                  <div className="bg-gray-50 w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-8">
                    <Globe className="w-12 h-12 text-gray-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">🌐 No accounts connected</h3>
                  <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                    Connect your social media accounts to start posting videos automatically across multiple platforms.
                  </p>
                  <button
                    onClick={connectSocialAccount}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    {isLoading ? 'Connecting...' : 'Connect Your First Account ✨'}
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                  <div className="px-8 py-6 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">Connected Platforms</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {connectedAccounts.map((account, index) => (
                      <div key={index} className="px-8 py-6 hover:bg-gray-50 transition-colors duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-6">
                            <div className={`p-4 rounded-xl text-white shadow-lg ${
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
                              <h3 className="font-bold text-gray-900 text-lg capitalize">{account.platform}</h3>
                              <p className="text-gray-600">{account.account_name || account.username}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-6">
                            <span className="px-4 py-2 bg-green-100 text-green-800 rounded-xl text-sm font-semibold">
                              ✅ Connected
                            </span>
                            <span className="text-sm text-gray-500">
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
            <div className="space-y-8">
              <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-6">⚙️ Application Settings</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Default Video Style</label>
                    <select className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all duration-200">
                      <option>😊 Casual & Friendly</option>
                      <option>💼 Professional & Business</option>
                      <option>⚡ Energetic & Dynamic</option>
                      <option>📚 Educational & Informative</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Default Duration</label>
                    <select className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition-all duration-200">
                      <option>30 seconds</option>
                      <option>1 minute</option>
                      <option>1.5 minutes</option>
                      <option>2 minutes</option>
                    </select>
                  </div>
                  <button className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl">
                    Save Settings
                  </button>
                </div>
              </div>
              
              {/* Danger Zone */}
              <div className="bg-white rounded-2xl border-2 border-red-200 p-8 shadow-sm">
                <h3 className="text-xl font-bold text-red-900 mb-6">⚠️ Danger Zone</h3>
                <div className="space-y-6">
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
                    <h4 className="font-bold text-red-900 mb-3">Clear All Videos</h4>
                    <p className="text-red-700 mb-6 leading-relaxed">
                      This will permanently delete all videos from your workspace. This action cannot be undone.
                    </p>
                    <button
                      onClick={clearAllVideos}
                      className="bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-700 transition-all duration-200 shadow-lg hover:shadow-red-200"
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