import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  Video, Plus, Instagram, Youtube, Facebook, Loader2, CheckCircle, XCircle, 
  Clock, ExternalLink, Settings, BarChart3, Calendar, Users, TrendingUp,
  RefreshCw, Play, LogIn, UserPlus, LogOut, Home, Sparkles, Zap
} from 'lucide-react';

// Configuration
const WEBHOOKS = {
  storeSocial: 'https://hook.eu2.make.com/00i9rjwdtt2np4brm8mm7p8hla9rix78',
  generateVideo: 'https://hook.eu2.make.com/5efo29nninirjgj06nh69jq7lt6piiva',
  checkStatus: 'https://hook.eu2.make.com/1ejgvywznrgfbs4iaijt2xdlzf62n7w5'
};

const UPLOADPOST_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImluZm9zcG9sb2sub2ZmaWNlQGdtYWlsLmNvbSIsImV4cCI6NDkxMjQzMzIxNiwianRpIjoiNDA2NDI2ZTUtNWUxNi00Mjc5LThmYzQtZDUzMDlhNTQwNzIwIn0.EylwU51ZDhLFIXBL6hf49pdxCLAiwTY6tf_SW-6FktA';

// User Context for proper authentication
const UserContext = createContext();
const useUser = () => useContext(UserContext);

// User Provider Component
const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [uploadPostProfile, setUploadPostProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing user session
    const savedUser = localStorage.getItem('cf_user');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      loadUserData(userData.id);
    }
    setLoading(false);
  }, []);

  const loadUserData = async (userId) => {
    try {
      // Load connected accounts
      const accounts = localStorage.getItem(`cf_accounts_${userId}`);
      if (accounts) {
        setConnectedAccounts(JSON.parse(accounts));
      }

      // Load upload-post profile
      const profile = localStorage.getItem(`cf_uploadpost_${userId}`);
      if (profile) {
        setUploadPostProfile(JSON.parse(profile));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const saveUserData = () => {
    if (user) {
      localStorage.setItem(`cf_accounts_${user.id}`, JSON.stringify(connectedAccounts));
      if (uploadPostProfile) {
        localStorage.setItem(`cf_uploadpost_${user.id}`, JSON.stringify(uploadPostProfile));
      }
    }
  };

  useEffect(() => {
    saveUserData();
  }, [connectedAccounts, uploadPostProfile, user]);

  const login = async (email, password) => {
    // Simulate login - replace with real authentication
    const userData = {
      id: `user_${Date.now()}`,
      email,
      name: email.split('@')[0],
      created_at: new Date().toISOString()
    };
    
    setUser(userData);
    localStorage.setItem('cf_user', JSON.stringify(userData));
    await loadUserData(userData.id);
    return userData;
  };

  const signup = async (email, password, name) => {
    // Simulate signup - replace with real authentication
    const userData = {
      id: `user_${Date.now()}`,
      email,
      name,
      created_at: new Date().toISOString()
    };
    
    setUser(userData);
    localStorage.setItem('cf_user', JSON.stringify(userData));
    return userData;
  };

  const logout = () => {
    setUser(null);
    setConnectedAccounts([]);
    setUploadPostProfile(null);
    localStorage.removeItem('cf_user');
  };

  const updateConnectedAccounts = (accounts) => {
    setConnectedAccounts(accounts);
  };

  const updateUploadPostProfile = (profile) => {
    setUploadPostProfile(profile);
  };

  return (
    <UserContext.Provider value={{
      user,
      connectedAccounts,
      uploadPostProfile,
      loading,
      login,
      signup,
      logout,
      updateConnectedAccounts,
      updateUploadPostProfile
    }}>
      {children}
    </UserContext.Provider>
  );
};

// Authentication Component
const AuthModal = ({ isOpen, onClose, mode, setMode }) => {
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);
  const { login, signup } = useUser();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
      } else {
        await signup(formData.email, formData.password, formData.name);
      }
      onClose();
    } catch (error) {
      alert(`${mode} failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-gray-600 mt-1">
              {mode === 'login' ? 'Sign in to your account' : 'Get started with Content Factory'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Your full name"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-4 rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center justify-center"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
              <button
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-blue-600 hover:text-blue-700 font-medium ml-1"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

// Modern Navigation Component
const Navigation = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useUser();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'create', label: 'Create Video', icon: Play },
    { id: 'videos', label: 'My Videos', icon: Video },
    { id: 'accounts', label: 'Social Accounts', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp }
  ];

  return (
    <nav className="w-64 bg-white border-r border-gray-200 min-h-screen">
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Content Factory</h1>
            <p className="text-xs text-gray-500">Pro Plan</p>
          </div>
        </div>

        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                  activeTab === item.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
};

// Stats Card Component
const StatsCard = ({ title, value, change, icon: Icon, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600'
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {change && <p className="text-sm text-green-600 mt-1">{change}</p>}
        </div>
        <div className={`p-3 rounded-2xl ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

// Social Account Manager Component with Fixed API Calls
const SocialAccountManager = () => {
  const { user, connectedAccounts, uploadPostProfile, updateConnectedAccounts, updateUploadPostProfile } = useUser();
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  // Use the original approach that was working before
  const connectSocialAccounts = async () => {
    if (!user) return;

    setLoading(true);
    setDebugInfo('Starting connection process...');
    
    try {
      // Use a simple unique identifier for the user
      const timestamp = Date.now().toString();
      const randomId = Math.random().toString(36).substring(2, 8);
      const username = `user${randomId}`;
      
      setDebugInfo(`Creating username: ${username}`);
      
      // Create user with upload-post.com
      const createResponse = await fetch('https://api.upload-post.com/api/uploadposts/users', {
        method: 'POST',
        headers: {
          'Authorization': `ApiKey ${UPLOADPOST_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });

      const createData = await createResponse.json();
      setDebugInfo(`Create response: ${JSON.stringify(createData)}`);
      
      let profileCreated = false;
      
      if (createData.success) {
        profileCreated = true;
      } else if (createData.message && createData.message.includes('already exists')) {
        profileCreated = true;
        setDebugInfo('User already exists, continuing...');
      } else {
        throw new Error(createData.message || 'Failed to create profile');
      }
      
      if (profileCreated) {
        // Save profile info
        const profile = { username, created: true, user_id: user.id };
        updateUploadPostProfile(profile);
        
        // Generate JWT for connecting accounts
        setDebugInfo('Generating JWT...');
        
        const jwtResponse = await fetch('https://api.upload-post.com/api/uploadposts/users/generate-jwt', {
          method: 'POST',
          headers: {
            'Authorization': `Apikey ${UPLOADPOST_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username })
        });

        const jwtData = await jwtResponse.json();
        setDebugInfo(`JWT response: ${JSON.stringify(jwtData)}`);
        
        if (jwtData.success && jwtData.access_url) {
          const confirmed = confirm(
            'You will be redirected to upload-post.com to connect your social media accounts.\n\n' +
            'After connecting, return here and click "Refresh Status".\n\n' +
            'Click OK to continue.'
          );
          
          if (confirmed) {
            window.open(jwtData.access_url, '_blank');
            setDebugInfo('Opened connection page. Please connect your accounts and return here.');
          }
        } else {
          throw new Error('Failed to generate connection link');
        }
      }
    } catch (error) {
      console.error('Connection error:', error);
      setDebugInfo(`Error: ${error.message}`);
      alert(`Connection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const refreshAccountStatus = async () => {
    if (!uploadPostProfile?.username) {
      alert('No profile found. Please connect accounts first.');
      return;
    }

    setLoading(true);
    setDebugInfo(`Checking accounts for: ${uploadPostProfile.username}`);
    
    try {
      const response = await fetch(`https://api.upload-post.com/api/uploadposts/users/get/${uploadPostProfile.username}`, {
        method: 'GET',
        headers: {
          'Authorization': `Apikey ${UPLOADPOST_API_KEY}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setDebugInfo(`API Response: ${JSON.stringify(data, null, 2)}`);
      
      if (data.success && data.profile) {
        const socialAccounts = data.profile.social_accounts || {};
        const connected = [];
        
        Object.keys(socialAccounts).forEach(platform => {
          const accountData = socialAccounts[platform];
          if (accountData && accountData !== null) {
            connected.push({
              platform: platform.toLowerCase(),
              connected_at: new Date().toISOString(),
              status: 'active',
              username: accountData.username || accountData.name || 'Connected',
              user_id: user.id,
              details: accountData
            });
          }
        });
        
        updateConnectedAccounts(connected);
        
        if (connected.length > 0) {
          setDebugInfo(`Successfully found ${connected.length} connected account(s)!`);
          alert(`Successfully found ${connected.length} connected account(s)!`);
        } else {
          setDebugInfo('No connected accounts found in profile.');
          alert('No connected accounts found. Please make sure you\'ve connected your accounts on upload-post.com first.');
        }
      } else {
        setDebugInfo(`API returned success=false: ${data.message || 'Unknown error'}`);
        throw new Error(data.message || 'Failed to get profile data');
      }
    } catch (error) {
      console.error('Refresh error:', error);
      setDebugInfo(`Refresh failed: ${error.message}`);
      alert(`Refresh failed: ${error.message}\n\nPlease check the console for more details.`);
    } finally {
      setLoading(false);
    }
  };

  const getSocialIcon = (platform) => {
    const icons = {
      instagram: Instagram,
      youtube: Youtube,
      facebook: Facebook,
      tiktok: Video
    };
    const Icon = icons[platform.toLowerCase()] || Video;
    return <Icon className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6">
      {/* Connection Panel */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Social Media Connection</h3>
            <p className="text-sm text-gray-600 mt-1">
              Connect your social media accounts to start publishing videos
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={refreshAccountStatus}
              disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-all"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Status
            </button>
            <button
              onClick={connectSocialAccounts}
              disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 border border-transparent rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Connect Accounts
            </button>
          </div>
        </div>

        {uploadPostProfile && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-blue-800">
              <strong>Profile:</strong> {uploadPostProfile.username}
            </p>
          </div>
        )}
        
        {/* Debug Info Panel (for troubleshooting) */}
        {debugInfo && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
            <p className="text-xs text-gray-600">
              <strong>Debug:</strong> {debugInfo}
            </p>
          </div>
        )}
      </div>

      {/* Connected Accounts */}
      {connectedAccounts.length > 0 ? (
        <div className="grid gap-4">
          {connectedAccounts.map((account, index) => (
            <div key={index} className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gray-50 rounded-xl">
                    {getSocialIcon(account.platform)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 capitalize">{account.platform}</h3>
                    <p className="text-sm text-gray-500">@{account.username}</p>
                    <p className="text-xs text-gray-400">
                      Connected {new Date(account.connected_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-700">Connected</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No connected accounts</h3>
          <p className="text-gray-600 mb-6">Connect your social media accounts to start publishing videos automatically</p>
          <button
            onClick={connectSocialAccounts}
            disabled={loading}
            className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 border border-transparent rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Connect Your First Account
          </button>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h4 className="font-medium text-amber-900 mb-1">How it works</h4>
            <p className="text-sm text-amber-800">
              1. Click "Connect Accounts" to create your upload-post.com profile<br/>
              2. A new tab will open - connect your social media accounts there<br/>
              3. Return here and click "Refresh Status" to sync your accounts<br/>
              4. Start creating and publishing videos automatically!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Video Creation Component
const VideoCreator = () => {
  const { user, connectedAccounts } = useUser();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    topic: '',
    style: 'casual',
    duration: 60,
    avatar_id: 'default_avatar',
    voice_id: 'default_voice'
  });

  const createVideo = async () => {
    if (!formData.topic.trim()) {
      alert('Please enter a video topic');
      return;
    }

    if (connectedAccounts.length === 0) {
      alert('Please connect at least one social media account first');
      return;
    }

    setLoading(true);
    try {
      const videoId = `vid_${Date.now()}`;
      
      const response = await fetch(WEBHOOKS.generateVideo, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          video_id: videoId,
          ...formData
        })
      });

      if (response.ok) {
        alert('Video generation started! Check your videos tab for progress.');
        setFormData({ ...formData, topic: '' });
      } else {
        alert('Failed to start video generation. Please try again.');
      }
    } catch (error) {
      console.error('Error creating video:', error);
      alert('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-100 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Video</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Video Topic / Script
            </label>
            <textarea
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="Describe your video topic or paste your script here..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Style</label>
              <select
                value={formData.style}
                onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="casual">Casual & Friendly</option>
                <option value="professional">Professional</option>
                <option value="energetic">Energetic & Fun</option>
                <option value="educational">Educational</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (seconds)
              </label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 60 })}
                min="15"
                max="180"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {connectedAccounts.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="font-medium text-green-800">Connected Accounts</p>
              </div>
              <p className="text-sm text-green-700">
                Video will be automatically posted to: {connectedAccounts.map(a => a.platform).join(', ')}
              </p>
            </div>
          )}

          {connectedAccounts.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <p className="font-medium text-amber-800">No Connected Accounts</p>
              </div>
              <p className="text-sm text-amber-700">
                Connect your social media accounts first to automatically publish your videos.
              </p>
            </div>
          )}

          <button
            onClick={createVideo}
            disabled={loading || !formData.topic.trim()}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-6 rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Creating Video...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Generate Video</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const { user, loading, connectedAccounts } = useUser();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authModal, setAuthModal] = useState({ isOpen: false, mode: 'login' });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        {/* Landing Page */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl mx-auto mb-8 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Create Viral Videos with
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> AI</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
              Generate engaging video content automatically and publish to all your social media platforms. 
              Turn your ideas into viral videos in minutes.
            </p>

            <div className="flex items-center justify-center space-x-4 mb-16">
              <button
                onClick={() => setAuthModal({ isOpen: true, mode: 'signup' })}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg"
              >
                Get Started Free
              </button>
              <button
                onClick={() => setAuthModal({ isOpen: true, mode: 'login' })}
                className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-2xl font-semibold text-lg hover:border-gray-400 transition-all"
              >
                Sign In
              </button>
            </div>

            {/* Feature Grid */}
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  icon: Zap,
                  title: 'AI-Powered Generation',
                  description: 'Create professional videos from simple text prompts using advanced AI technology.'
                },
                {
                  icon: Users,
                  title: 'Multi-Platform Publishing',
                  description: 'Automatically post to Instagram, YouTube, TikTok, and Facebook with one click.'
                },
                {
                  icon: TrendingUp,
                  title: 'Analytics & Growth',
                  description: 'Track performance and optimize your content strategy with detailed insights.'
                }
              ].map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                    <p className="text-gray-600">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <AuthModal
          isOpen={authModal.isOpen}
          onClose={() => setAuthModal({ ...authModal, isOpen: false })}
          mode={authModal.mode}
          setMode={(mode) => setAuthModal({ ...authModal, mode })}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">Content Factory</h1>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                Pro Plan
              </span>
            </div>
            <div className="text-sm text-gray-600">
              Welcome, {user.name}!
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Content */}
        <main className="flex-1 p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h2>
                <p className="text-gray-600">Overview of your video generation and social media activity</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                  title="Connected Accounts"
                  value={connectedAccounts?.length || 0}
                  change="+1 this week"
                  icon={Users}
                  color="blue"
                />
                <StatsCard
                  title="Videos Created"
                  value="12"
                  change="+4 this week"
                  icon={Video}
                  color="purple"
                />
                <StatsCard
                  title="Total Views"
                  value="25.4K"
                  change="+12% vs last week"
                  icon={TrendingUp}
                  color="green"
                />
                <StatsCard
                  title="Engagement"
                  value="4.8%"
                  change="+0.5% vs last week"
                  icon={BarChart3}
                  color="orange"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => setActiveTab('create')}
                      className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl hover:from-blue-100 hover:to-purple-100 transition-all"
                    >
                      <div className="flex items-center space-x-3">
                        <Play className="w-5 h-5 text-blue-600" />
                        <span className="font-medium text-gray-900">Create New Video</span>
                      </div>
                      <span className="text-sm text-gray-500">→</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('accounts')}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all"
                    >
                      <div className="flex items-center space-x-3">
                        <Users className="w-5 h-5 text-gray-600" />
                        <span className="font-medium text-gray-900">Manage Accounts</span>
                      </div>
                      <span className="text-sm text-gray-500">→</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-xl">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-green-800">Video "How to cook pasta" posted to Instagram</span>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-xl">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <span className="text-sm text-blue-800">Video "Travel tips" is generating...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'create' && <VideoCreator />}

          {activeTab === 'videos' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">My Videos</h2>
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No videos yet</h3>
                <p className="text-gray-500 mb-6">Your generated videos will appear here</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 px-6 rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 transition-all"
                >
                  Create Your First Video
                </button>
              </div>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Social Accounts</h2>
                <p className="text-gray-600">Connect and manage your social media accounts</p>
              </div>
              <SocialAccountManager />
            </div>
          )}

          {activeTab === 'analytics' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Analytics</h2>
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics coming soon</h3>
                <p className="text-gray-500">Detailed performance metrics will be available here</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// Root App with Provider
const AppWithProvider = () => {
  return (
    <UserProvider>
      <App />
    </UserProvider>
  );
};

export default AppWithProvider;