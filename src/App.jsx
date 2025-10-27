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

// User Context
const UserContext = createContext();
const useUser = () => useContext(UserContext);

const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [uploadPostProfile, setUploadPostProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
      const accounts = localStorage.getItem(`cf_accounts_${userId}`);
      if (accounts) setConnectedAccounts(JSON.parse(accounts));
      const profile = localStorage.getItem(`cf_uploadpost_${userId}`);
      if (profile) setUploadPostProfile(JSON.parse(profile));
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

  useEffect(() => { saveUserData(); }, [connectedAccounts, uploadPostProfile, user]);

  const login = async (email, password) => {
    const userData = {
      id: `user_${Date.now()}`,
      email, name: email.split('@')[0],
      created_at: new Date().toISOString()
    };
    setUser(userData);
    localStorage.setItem('cf_user', JSON.stringify(userData));
    await loadUserData(userData.id);
    return userData;
  };

  const signup = async (email, password, name) => {
    const userData = { id: `user_${Date.now()}`, email, name, created_at: new Date().toISOString() };
    setUser(userData);
    localStorage.setItem('cf_user', JSON.stringify(userData));
    return userData;
  };

  const logout = () => {
    setUser(null); setConnectedAccounts([]); setUploadPostProfile(null);
    localStorage.removeItem('cf_user');
  };

  return (
    <UserContext.Provider value={{
      user, connectedAccounts, uploadPostProfile, loading, login, signup, logout,
      updateConnectedAccounts: setConnectedAccounts,
      updateUploadPostProfile: setUploadPostProfile
    }}>
      {children}
    </UserContext.Provider>
  );
};

const AuthModal = ({ isOpen, onClose, mode, setMode }) => {
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);
  const { login, signup } = useUser();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') await login(formData.email, formData.password);
      else await signup(formData.email, formData.password, formData.name);
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">✕</button>
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <input type="text" required value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl" placeholder="Your name" />
            )}
            <input type="email" required value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl" placeholder="you@example.com" />
            <input type="password" required value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl" placeholder="••••••••" />
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-4 rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center justify-center">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
          <div className="mt-6 text-center">
            <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-blue-600 hover:text-blue-700 font-medium">
              {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

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
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                  activeTab === item.id ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-700 hover:bg-gray-50'
                }`}>
                <Icon className="w-5 h-5 mr-3" />{item.label}
              </button>
            );
          })}
        </div>
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">{user?.name?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <button onClick={logout}
            className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
            <LogOut className="w-4 h-4 mr-3" />Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
};

const StatsCard = ({ title, value, change, icon: Icon, color = 'blue' }) => {
  const colors = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', purple: 'bg-purple-50 text-purple-600', orange: 'bg-orange-50 text-orange-600' };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {change && <p className="text-sm text-green-600 mt-1">{change}</p>}
        </div>
        <div className={`p-3 rounded-2xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

const SocialAccountManager = () => {
  const { user, connectedAccounts, uploadPostProfile, updateConnectedAccounts, updateUploadPostProfile } = useUser();
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  const connectSocialAccounts = async () => {
    if (!user) return;
    setLoading(true);
    setDebugInfo('Starting connection...');
    
    try {
      const username = `user${Math.random().toString(36).substring(2, 8)}`;
      setDebugInfo(`Creating username: ${username}`);
      
      // USING DIRECT /api PATH NOW
      const createResponse = await fetch('/api/uploadpost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const createData = await createResponse.json();
      setDebugInfo(`Create response: ${createResponse.status} - ${JSON.stringify(createData)}`);
      
      let profileCreated = createData.success || (createData.message && createData.message.includes('already exists'));
      
      if (profileCreated) {
        updateUploadPostProfile({ username, created: true, user_id: user.id });
        setDebugInfo('Generating JWT...');
        
        const jwtResponse = await fetch('/api/uploadpost/users/generate-jwt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        });

        const jwtData = await jwtResponse.json();
        setDebugInfo(`JWT response: ${jwtResponse.status} - ${JSON.stringify(jwtData)}`);
        
        if (jwtData.success && jwtData.access_url) {
          if (confirm('Open upload-post.com to connect your social accounts?\n\nAfter connecting, return here and click Refresh Status.')) {
            window.open(jwtData.access_url, '_blank');
            setDebugInfo('Connection page opened. Connect your accounts and return here.');
          }
        } else {
          throw new Error(jwtData.message || 'Failed to generate connection link');
        }
      } else {
        throw new Error(createData.message || 'Failed to create profile');
      }
    } catch (error) {
      console.error('Connection error:', error);
      setDebugInfo(`ERROR: ${error.message}`);
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
      console.log('🔄 Calling refresh API for:', uploadPostProfile.username);
      
      // USING DIRECT /api PATH - NO MORE /proxy
      const response = await fetch(`/api/uploadpost/users/get/${uploadPostProfile.username}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', [...response.headers.entries()]);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Response body:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ API Response:', data);
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
              user_id: user.id
            });
          }
        });
        
        updateConnectedAccounts(connected);
        setDebugInfo(`✅ Found ${connected.length} connected account(s)!`);
        
        if (connected.length > 0) {
          alert(`🎉 Successfully found ${connected.length} connected account(s)!`);
        } else {
          alert('No connected accounts found. Please connect your accounts on upload-post.com first.');
        }
      } else {
        setDebugInfo(`❌ API returned success=false: ${data.message || 'Unknown error'}`);
        throw new Error(data.message || 'Failed to get profile data');
      }
    } catch (error) {
      console.error('❌ Refresh error:', error);
      setDebugInfo(`❌ Refresh failed: ${error.message}`);
      alert(`Refresh failed: ${error.message}\n\nCheck console and debug info below.`);
    } finally {
      setLoading(false);
    }
  };

  const getSocialIcon = (platform) => {
    const icons = { instagram: Instagram, youtube: Youtube, facebook: Facebook, tiktok: Video };
    const Icon = icons[platform.toLowerCase()] || Video;
    return <Icon className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Social Media Connection</h3>
            <p className="text-sm text-gray-600 mt-1">Connect your accounts to publish videos</p>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={refreshAccountStatus} disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh Status
            </button>
            <button onClick={connectSocialAccounts} disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
              Connect Accounts
            </button>
          </div>
        </div>

        {uploadPostProfile && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-blue-800"><strong>Profile:</strong> {uploadPostProfile.username}</p>
          </div>
        )}
        
        {debugInfo && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-mono text-gray-600">{debugInfo}</p>
          </div>
        )}
      </div>

      {connectedAccounts.length > 0 ? (
        <div className="grid gap-4">
          {connectedAccounts.map((account, index) => (
            <div key={index} className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gray-50 rounded-xl">{getSocialIcon(account.platform)}</div>
                  <div>
                    <h3 className="font-semibold text-gray-900 capitalize">{account.platform}</h3>
                    <p className="text-sm text-gray-500">@{account.username}</p>
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
          <p className="text-gray-600 mb-6">Connect social media accounts to publish videos automatically</p>
          <button onClick={connectSocialAccounts} disabled={loading}
            className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50">
            <Plus className="w-4 h-4 mr-2" />Connect Your First Account
          </button>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
        <div className="flex items-start space-x-3">
          <Zap className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-900 mb-1">How it works</h4>
            <p className="text-sm text-amber-800">
              1. Click "Connect Accounts" → opens upload-post.com<br/>
              2. Connect your Instagram/TikTok/YouTube there<br/>
              3. Return here and click "Refresh Status"<br/>
              4. Your accounts will appear and videos will auto-publish!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const VideoCreator = () => {
  const { user, connectedAccounts } = useUser();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ topic: '', style: 'casual', duration: 60 });

  const createVideo = async () => {
    if (!formData.topic.trim()) return alert('Please enter a video topic');
    if (connectedAccounts.length === 0) return alert('Please connect at least one social media account first');

    setLoading(true);
    try {
      const response = await fetch(WEBHOOKS.generateVideo, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, video_id: `vid_${Date.now()}`, ...formData })
      });
      if (response.ok) {
        alert('Video generation started!');
        setFormData({ ...formData, topic: '' });
      } else alert('Failed to start video generation');
    } catch (error) {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-100 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Video</h2>
        <div className="space-y-6">
          <textarea value={formData.topic} onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            placeholder="Describe your video topic..." rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500" />
          <div className="grid grid-cols-2 gap-4">
            <select value={formData.style} onChange={(e) => setFormData({ ...formData, style: e.target.value })}
              className="px-4 py-3 border border-gray-300 rounded-xl">
              <option value="casual">Casual</option>
              <option value="professional">Professional</option>
              <option value="energetic">Energetic</option>
            </select>
            <input type="number" value={formData.duration} min="15" max="180"
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 60 })}
              className="px-4 py-3 border border-gray-300 rounded-xl" />
          </div>
          {connectedAccounts.length > 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-700">✅ Will post to: {connectedAccounts.map(a => a.platform).join(', ')}</p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-700">⚠️ Connect accounts first to auto-publish videos</p>
            </div>
          )}
          <button onClick={createVideo} disabled={loading || !formData.topic.trim()}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-6 rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center space-x-2">
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Creating...</span></> : <><Sparkles className="w-5 h-5" /><span>Generate Video</span></>}
          </button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const { user, loading, connectedAccounts } = useUser();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authModal, setAuthModal] = useState({ isOpen: false, mode: 'login' });

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl mx-auto mb-8 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Create Viral Videos with<span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> AI</span>
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
            Generate engaging video content automatically and publish to all your social media platforms.
          </p>
          <div className="flex items-center justify-center space-x-4">
            <button onClick={() => setAuthModal({ isOpen: true, mode: 'signup' })}
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:from-blue-600 hover:to-purple-700 shadow-lg">
              Get Started Free
            </button>
            <button onClick={() => setAuthModal({ isOpen: true, mode: 'login' })}
              className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-2xl font-semibold text-lg hover:border-gray-400">
              Sign In
            </button>
          </div>
        </div>
        <AuthModal isOpen={authModal.isOpen} onClose={() => setAuthModal({ ...authModal, isOpen: false })} mode={authModal.mode} setMode={(mode) => setAuthModal({ ...authModal, mode })} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">Content Factory</h1>
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Pro Plan</span>
          </div>
          <div className="text-sm text-gray-600">Welcome, {user.name}!</div>
        </div>
      </header>

      <div className="flex">
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h2>
                <p className="text-gray-600">Overview of your video generation activity</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard title="Connected Accounts" value={connectedAccounts?.length || 0} icon={Users} color="blue" />
                <StatsCard title="Videos Created" value="12" icon={Video} color="purple" />
                <StatsCard title="Total Views" value="25.4K" icon={TrendingUp} color="green" />
                <StatsCard title="Engagement" value="4.8%" icon={BarChart3} color="orange" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button onClick={() => setActiveTab('create')}
                      className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl hover:from-blue-100 hover:to-purple-100">
                      <div className="flex items-center space-x-3">
                        <Play className="w-5 h-5 text-blue-600" />
                        <span className="font-medium text-gray-900">Create New Video</span>
                      </div>
                    </button>
                    <button onClick={() => setActiveTab('accounts')}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100">
                      <div className="flex items-center space-x-3">
                        <Users className="w-5 h-5 text-gray-600" />
                        <span className="font-medium text-gray-900">Manage Accounts</span>
                      </div>
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                  <div className="bg-green-50 rounded-xl p-3">
                    <span className="text-sm text-green-800">Ready to create your first video!</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'create' && <VideoCreator />}
          {activeTab === 'videos' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No videos yet</h3>
              <button onClick={() => setActiveTab('create')}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 px-6 rounded-xl font-medium hover:from-blue-600 hover:to-purple-700">
                Create Your First Video
              </button>
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
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics coming soon</h3>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const AppWithProvider = () => (
  <UserProvider>
    <App />
  </UserProvider>
);

export default AppWithProvider;