import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, Video, BarChart3, Globe, TrendingUp, UserCheck, UserX,
  Eye, Play, Send, Clock, CheckCircle, XCircle, AlertTriangle,
  Calendar, Download, Filter, Search, MoreHorizontal, Settings,
  Shield, Database, Activity, Zap, RefreshCw, Crown
} from 'lucide-react';

const AdminDashboard = () => {
  const { apiCall, user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [adminStats, setAdminStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [timeRange, setTimeRange] = useState('30d');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadAdminData();
    }
  }, [user, timeRange]);

  const showNotification = (message, type = 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'info' }), 5000);
  };

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadAdminStats(),
        loadAllUsers(),
        loadAllVideos()
      ]);
    } catch (error) {
      console.error('Error loading admin data:', error);
      showNotification('Failed to load admin data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAdminStats = async () => {
    try {
      const response = await apiCall(`/api/admin/stats?timeRange=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAdminStats(data.stats);
        }
      } else {
        console.error('Failed to load admin stats:', response.status);
      }
    } catch (error) {
      console.error('Error loading admin stats:', error);
    }
  };

  const loadAllUsers = async () => {
    try {
      const response = await apiCall('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUsers(data.users || []);
        }
      } else {
        console.error('Failed to load users:', response.status);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadAllVideos = async () => {
    try {
      const response = await apiCall('/api/admin/videos');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVideos(data.videos || []);
        }
      } else {
        console.error('Failed to load videos:', response.status);
      }
    } catch (error) {
      console.error('Error loading videos:', error);
    }
  };

  const updateUserStatus = async (userId, status) => {
    try {
      const response = await apiCall(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUsers(prev => prev.map(u => 
            u.id === userId ? { ...u, status } : u
          ));
          showNotification(`User ${status.toLowerCase()} successfully`, 'success');
        }
      } else {
        const data = await response.json();
        showNotification(data.error || 'Failed to update user status', 'error');
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      showNotification('Error updating user status', 'error');
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await apiCall(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUsers(prev => prev.filter(u => u.id !== userId));
          showNotification('User deleted successfully', 'success');
        }
      } else {
        const data = await response.json();
        showNotification(data.error || 'Failed to delete user', 'error');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showNotification('Error deleting user', 'error');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.username?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || user.status?.toLowerCase() === filterStatus.toLowerCase();
    
    return matchesSearch && matchesFilter;
  });

  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'INACTIVE': return <Clock className="w-4 h-4 text-gray-500" />;
      case 'SUSPENDED': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getVideoStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'GENERATING': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'COMPLETED': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'PUBLISHED': return <Send className="w-4 h-4 text-purple-500" />;
      case 'FAILED': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg border border-gray-200">
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

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
             notification.type === 'error' ? <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" /> :
             <Activity className="w-5 h-5 text-blue-500 mt-0.5" />}
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

      <div className="flex h-screen">
        {/* Admin Sidebar */}
        <div className="w-64 bg-gray-900 text-white flex flex-col">
          {/* Admin Header */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="bg-red-600 w-8 h-8 rounded flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-semibold text-lg">Admin Panel</span>
                <p className="text-xs text-gray-400">Content Factory</p>
              </div>
            </div>
          </div>

          {/* Admin Navigation */}
          <nav className="flex-1 p-2">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'users', label: 'Users', icon: Users, badge: users.length },
              { id: 'videos', label: 'All Videos', icon: Video, badge: videos.length },
              { id: 'analytics', label: 'Platform Analytics', icon: TrendingUp },
              { id: 'system', label: 'System Health', icon: Database },
              { id: 'settings', label: 'Admin Settings', icon: Settings }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors mb-1 ${
                  activeTab === item.id 
                    ? 'bg-gray-800 text-white' 
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-gray-700 text-xs px-2 py-1 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Admin User Info */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-xs font-semibold">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-red-400">Administrator</p>
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
                  {activeTab === 'overview' && 'Platform Overview'}
                  {activeTab === 'users' && 'User Management'}
                  {activeTab === 'videos' && 'All Videos'}
                  {activeTab === 'analytics' && 'Platform Analytics'}
                  {activeTab === 'system' && 'System Health'}
                  {activeTab === 'settings' && 'Admin Settings'}
                </h1>
                {isLoading && (
                  <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
                )}
              </div>
              <div className="flex items-center space-x-3">
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="1y">Last year</option>
                </select>
                <button
                  onClick={loadAdminData}
                  disabled={isLoading}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Top Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Total Users</h3>
                      <Users className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-3xl font-bold text-gray-900">{adminStats?.totalUsers || users.length}</span>
                      <span className="text-sm font-medium text-green-600">+{adminStats?.newUsersThisPeriod || 0}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Active users: {adminStats?.activeUsers || users.filter(u => u.status === 'ACTIVE').length}</p>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Total Videos</h3>
                      <Video className="w-5 h-5 text-purple-500" />
                    </div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-3xl font-bold text-gray-900">{adminStats?.totalVideos || videos.length}</span>
                      <span className="text-sm font-medium text-green-600">+{adminStats?.newVideosThisPeriod || 0}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Completed: {videos.filter(v => v.status === 'COMPLETED' || v.status === 'PUBLISHED').length}</p>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Platform Usage</h3>
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    </div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-3xl font-bold text-gray-900">{adminStats?.totalSessions || '0'}</span>
                      <span className="text-sm font-medium text-green-600">+12%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Avg session: {adminStats?.avgSessionTime || '15min'}</p>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Revenue</h3>
                      <BarChart3 className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-3xl font-bold text-gray-900">${adminStats?.revenue || '0'}</span>
                      <span className="text-sm font-medium text-green-600">+{adminStats?.revenueGrowth || '0'}%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">MRR: ${adminStats?.mrr || '0'}</p>
                  </div>
                </div>

                {/* User Status Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">User Status Distribution</h3>
                    <div className="space-y-3">
                      {[
                        { status: 'ACTIVE', count: users.filter(u => u.status === 'ACTIVE').length, color: 'bg-green-500' },
                        { status: 'INACTIVE', count: users.filter(u => u.status === 'INACTIVE').length, color: 'bg-gray-500' },
                        { status: 'SUSPENDED', count: users.filter(u => u.status === 'SUSPENDED').length, color: 'bg-red-500' }
                      ].map(item => (
                        <div key={item.status} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                            <span className="font-medium text-gray-900 capitalize">{item.status.toLowerCase()}</span>
                          </div>
                          <span className="text-sm text-gray-600">{item.count} users</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Video Status Distribution</h3>
                    <div className="space-y-3">
                      {[
                        { status: 'GENERATING', count: videos.filter(v => v.status === 'GENERATING').length, color: 'bg-blue-500' },
                        { status: 'COMPLETED', count: videos.filter(v => v.status === 'COMPLETED').length, color: 'bg-green-500' },
                        { status: 'PUBLISHED', count: videos.filter(v => v.status === 'PUBLISHED').length, color: 'bg-purple-500' },
                        { status: 'FAILED', count: videos.filter(v => v.status === 'FAILED').length, color: 'bg-red-500' }
                      ].map(item => (
                        <div key={item.status} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                            <span className="font-medium text-gray-900 capitalize">{item.status.toLowerCase()}</span>
                          </div>
                          <span className="text-sm text-gray-600">{item.count} videos</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recent Users */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Users</h3>
                  <div className="space-y-4">
                    {users.slice(0, 5).map(user => (
                      <div key={user.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <span className="text-xs font-semibold">
                              {user.firstName?.[0]}{user.lastName?.[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                            <p className="text-sm text-gray-600">Last active: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}</p>
                          </div>
                        </div>
                        {getStatusIcon(user.status)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                {/* Search and Filter */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-64">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Filter className="w-4 h-4 text-gray-400" />
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">All Users ({filteredUsers.length})</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                          <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                          <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                          <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Videos</th>
                          <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredUsers.map(user => {
                          const userVideoCount = videos.filter(v => v.userId === user.id).length;
                          return (
                            <tr key={user.id} className="hover:bg-gray-50">
                              <td className="py-4 px-6">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                    <span className="text-xs font-semibold">
                                      {user.firstName?.[0]}{user.lastName?.[0]}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                                    <p className="text-sm text-gray-600">{user.email}</p>
                                    <p className="text-xs text-gray-500">@{user.username}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex items-center space-x-2">
                                  {getStatusIcon(user.status)}
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    user.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                    user.status === 'INACTIVE' ? 'bg-gray-100 text-gray-800' :
                                    user.status === 'SUSPENDED' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {user.status?.toLowerCase()}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-600">
                                {new Date(user.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-600">
                                {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-600">
                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                  {userVideoCount} videos
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex items-center space-x-2">
                                  {user.status === 'ACTIVE' ? (
                                    <button
                                      onClick={() => updateUserStatus(user.id, 'SUSPENDED')}
                                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                                    >
                                      Suspend
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => updateUserStatus(user.id, 'ACTIVE')}
                                      className="text-green-600 hover:text-green-800 text-sm font-medium"
                                    >
                                      Activate
                                    </button>
                                  )}
                                  {user.role !== 'ADMIN' && (
                                    <button
                                      onClick={() => deleteUser(user.id)}
                                      className="text-red-600 hover:text-red-800 text-sm font-medium ml-2"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Videos Tab */}
            {activeTab === 'videos' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">All Videos ({videos.length})</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Video</th>
                          <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                          <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                          <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {videos.map(video => {
                          const videoUser = users.find(u => u.id === video.userId);
                          return (
                            <tr key={video.id} className="hover:bg-gray-50">
                              <td className="py-4 px-6">
                                <div>
                                  <p className="font-medium text-gray-900">{video.title}</p>
                                  <p className="text-sm text-gray-600">{video.topic}</p>
                                  <p className="text-xs text-gray-500 capitalize">{video.style?.toLowerCase()}</p>
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                {videoUser ? (
                                  <div>
                                    <p className="font-medium text-gray-900">{videoUser.firstName} {videoUser.lastName}</p>
                                    <p className="text-sm text-gray-600">{videoUser.email}</p>
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-500">Unknown user</span>
                                )}
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex items-center space-x-2">
                                  {getVideoStatusIcon(video.status)}
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    video.status === 'GENERATING' ? 'bg-blue-100 text-blue-800' :
                                    video.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                    video.status === 'PUBLISHED' ? 'bg-purple-100 text-purple-800' :
                                    video.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {video.status?.toLowerCase()}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-600">
                                {new Date(video.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-600">
                                {video.duration}s
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* System Health Tab */}
            {activeTab === 'system' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Server Status</h3>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">Online</p>
                    <p className="text-xs text-gray-500 mt-1">Uptime: 99.9%</p>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">API Response</h3>
                      <Zap className="w-5 h-5 text-yellow-500" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">125ms</p>
                    <p className="text-xs text-gray-500 mt-1">Average response time</p>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Storage Usage</h3>
                      <Database className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">45%</p>
                    <p className="text-xs text-gray-500 mt-1">Memory usage</p>
                  </div>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Settings</h3>
                  <p className="text-gray-600">Admin configuration options will be available here.</p>
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Analytics</h3>
                  <p className="text-gray-600">Detailed analytics and reports will be available here.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;