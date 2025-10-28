import React, { useState, useEffect } from 'react';
import { Video, Plus, Instagram, Youtube, Facebook, Loader2, CheckCircle, XCircle, Clock, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';

const WEBHOOKS = {
  storeSocial: 'https://hook.eu2.make.com/00i9rjwdtt2np4brm8mm7p8hla9rix78',
  generateVideo: 'https://hook.eu2.make.com/5efo29nninirjgj06nh69jq7lt6piiva',
  checkStatus: 'https://hook.eu2.make.com/1ejgvywznrgfbs4iaijt2xdlzf62n7w5'
};

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
      if (saved) {
        setVideos(JSON.parse(saved));
      }
    } catch (error) {
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
    } catch (error) {
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

  const connectSocialAccount = async () => {
    setIsLoading(true);
    
    try {
      let username = uploadPostUser?.username;
      
      if (!username) {
        username = Math.random().toString(36).substring(2, 10);
        console.log('Creating upload-post user:', username);
      }

      // Call Make.com webhook to handle upload-post API
      const response = await fetch(WEBHOOKS.storeSocial, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect_accounts',
          user_id: currentUser,
          username: username
        })
      });

      const data = await response.json();
      console.log('Connection response:', data);
      
      if (data.success && data.access_url) {
        saveUploadPostUser({ username, created: true });
        
        window.open(data.access_url, '_blank', 'width=800,height=600');
        
        alert(
          'A new window has opened for you to connect your social media accounts.\n\n' +
          'After connecting your accounts:\n' +
          '1. Close that window\n' +
          '2. Click "Refresh Accounts" button below\n\n' +
          'Your connected accounts will appear here.'
        );
      } else {
        alert('Failed to generate connection link. Please check Make.com logs.');
      }
    } catch (error) {
      console.error('Error connecting account:', error);
      alert('Failed to connect account. Check console.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkConnectedAccounts = async (username) => {
    if (!username) {
      const userData = loadUploadPostUser();
      if (!userData?.username) {
        console.log('No username available');
        return;
      }
      username = userData.username;
    }
    
    setIsLoading(true);
    try {
      console.log('Checking accounts for:', username);
      
      // Call Make.com webhook to get accounts
      const response = await fetch(WEBHOOKS.checkStatus, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_accounts',
          username: username
        })
      });

      const data = await response.json();
      console.log('Get accounts response:', data);
      
      if (data.success && data.accounts) {
        const connected = data.accounts.map(account => ({
          platform: account.platform,
          connected_at: account.connected_at || new Date().toISOString(),
          status: 'active',
          account_name: account.name || account.username || account.platform,
          details: account
        }));
        
        saveConnectedAccounts(connected);
        
        if (connected.length > 0) {
          alert(`Successfully found ${connected.length} connected account(s)!`);
        } else {
          alert('No social accounts connected yet. Click "Connect Accounts" to add some.');
        }
      }
    } catch (error) {
      console.error('Error checking accounts:', error);
      alert('Failed to check accounts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const createVideo = async () => {
    if (!videoForm.topic.trim()) {
      alert('Please enter a topic');
      return;
    }

    if (connectedAccounts.length === 0) {
      alert('Please connect at least one social media account first');
      return;
    }

    setIsLoading(true);
    
    try {
      const videoId = `vid_${Date.now()}`;
      
      const response = await fetch(WEBHOOKS.generateVideo, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser,
          video_id: videoId,
          uploadpost_username: uploadPostUser?.username,
          ...videoForm
        })
      });

      const data = await response.json();
      
      if (data.success) {
        const newVideo = {
          video_id: videoId,
          topic: videoForm.topic,
          style: videoForm.style,
          duration: videoForm.duration,
          status: 'generating',
          created_at: new Date().toISOString(),
          heygen_video_id: data.heygen_video_id
        };
        
        const updated = [newVideo, ...videos];
        saveVideos(updated);
        
        setVideoForm({
          topic: '',
          style: 'casual',
          duration: 60,
          avatar_id: 'default_avatar',
          voice_id: 'default_voice'
        });
        
        setActiveTab('videos');
        alert('Video generation started!');
      }
    } catch (error) {
      console.error('Error creating video:', error);
      alert('Failed to create video.');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshVideoStatus = async (videoId) => {
    const updatedVideos = videos.map(v => {
      if (v.video_id === videoId && v.status === 'generating') {
        return {
          ...v,
          status: 'completed',
          video_url: `https://example.com/videos/${videoId}.mp4`,
          completed_at: new Date().toISOString()
        };
      }
      return v;
    });
    saveVideos(updatedVideos);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
      case 'generating':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'posted':
        return <CheckCircle className="w-5 h-5 text-purple-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getSocialIcon = (platform) => {
    const lowerPlatform = platform.toLowerCase();
    switch (lowerPlatform) {
      case 'instagram':
        return <Instagram className="w-5 h-5" />;
      case 'youtube':
        return <Youtube className="w-5 h-5" />;
      case 'facebook':
        return <Facebook className="w-5 h-5" />;
      case 'tiktok':
      case 'tik_tok':
        return <Video className="w-5 h-5" />;
      default:
        return <Video className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-2.5 rounded-xl shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Video Factory</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500 hidden sm:block">
                {currentUser.substring(0, 15)}...
              </div>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 mb-6 inline-flex">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'create'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Create
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'videos'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Videos <span className="ml-1.5 text-xs opacity-60">({videos.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'accounts'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Accounts <span className="ml-1.5 text-xs opacity-60">({connectedAccounts.length})</span>
          </button>
        </div>

        {activeTab === 'create' && (
          <div className="max-w-3xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Create video</h2>
              <p className="text-gray-600">Generate AI-powered videos and post to your social media</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Video topic
                  </label>
                  <textarea
                    value={videoForm.topic}
                    onChange={(e) => setVideoForm({ ...videoForm, topic: e.target.value })}
                    placeholder="Describe what your video should be about..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Style</label>
                    <select
                      value={videoForm.style}
                      onChange={(e) => setVideoForm({ ...videoForm, style: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    >
                      <option value="casual">Casual</option>
                      <option value="professional">Professional</option>
                      <option value="energetic">Energetic</option>
                      <option value="educational">Educational</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Duration
                    </label>
                    <input
                      type="number"
                      value={videoForm.duration}
                      onChange={(e) => setVideoForm({ ...videoForm, duration: parseInt(e.target.value) })}
                      min="15"
                      max="180"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Seconds (15-180)</p>
                  </div>
                </div>
              </div>
            </div>

            {connectedAccounts.length > 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-sm font-medium text-green-900">
                    Connected to {connectedAccounts.length} account(s): {connectedAccounts.map(a => a.platform).join(', ')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Connect accounts first:</strong> Go to the Accounts tab to connect your social media
                </p>
              </div>
            )}

            <button
              onClick={createVideo}
              disabled={isLoading || connectedAccounts.length === 0}
              className="w-full bg-gray-900 text-white py-3.5 px-6 rounded-lg font-semibold text-sm hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  <span>Generate video</span>
                </>
              )}
            </button>
          </div>
        )}

        {activeTab === 'videos' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Your videos</h2>
                <p className="text-gray-600 text-sm">Manage and track your generated videos</p>
              </div>
              <button
                onClick={loadVideos}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center space-x-2 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>

            {videos.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Video className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No videos yet</h3>
                <p className="text-gray-600 text-sm mb-6">Create your first AI-generated video to get started</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="inline-flex items-center px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create video
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {videos.map((video) => (
                  <div key={video.video_id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          {getStatusIcon(video.status)}
                          <span className="text-sm font-medium text-gray-900 capitalize">{video.status}</span>
                          {video.status === 'generating' && (
                            <span className="text-xs text-gray-500">Processing...</span>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 mb-2">{video.topic}</h3>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span className="font-medium">{video.style}</span>
                          <span>•</span>
                          <span>{video.duration}s</span>
                          <span>•</span>
                          <span>{new Date(video.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {video.status === 'generating' && (
                        <button
                          onClick={() => refreshVideoStatus(video.video_id)}
                          className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
                        >
                          Check status
                        </button>
                      )}
                    </div>
                    
                    {video.video_url && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <a
                          href={video.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm font-medium text-gray-900 hover:text-gray-700"
                        >
                          View video
                          <ExternalLink className="w-4 h-4 ml-1.5" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'accounts' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Social accounts</h2>
              <p className="text-gray-600">Connect your social media accounts to post videos</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Upload-Post Connection</h3>
                  <p className="text-sm text-gray-600">
                    Securely connect your social media accounts
                  </p>
                  {uploadPostUser?.username && (
                    <p className="text-xs text-gray-500 mt-1">
                      Profile: {uploadPostUser.username}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => checkConnectedAccounts(uploadPostUser?.username)}
                    disabled={isLoading || !uploadPostUser?.username}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh accounts</span>
                  </button>
                  <button
                    onClick={connectSocialAccount}
                    disabled={isLoading}
                    className="px-5 py-2.5 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors shadow-sm"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4" />
                        <span>Connect accounts</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {connectedAccounts.length > 0 ? (
              <div className="grid gap-4">
                {connectedAccounts.map((account, index) => (
                  <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center">
                          {getSocialIcon(account.platform)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 capitalize text-sm">
                            {account.platform.replace('_', ' ')}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {account.account_name || 'Connected'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Since {new Date(account.connected_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium text-xs flex items-center space-x-1.5">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ExternalLink className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No accounts connected</h3>
                <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">
                  Connect your social media accounts to start posting AI-generated videos
                </p>
                <button
                  onClick={connectSocialAccount}
                  disabled={isLoading}
                  className="inline-flex items-center px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Connect accounts
                </button>
              </div>
            )}

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-xs font-bold">i</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-1">How it works</p>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Click "Connect accounts" to open upload-post.com</li>
                    <li>Authorize your social media accounts (Instagram, TikTok, etc.)</li>
                    <li>Return here and click "Refresh accounts"</li>
                    <li>Your connected accounts will appear and you can start creating videos!</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
