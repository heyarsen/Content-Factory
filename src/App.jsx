import React, { useState, useEffect } from 'react';
import { Video, Plus, Instagram, Youtube, Facebook, Loader2, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';

const WEBHOOKS = {
  storeSocial: 'https://hook.eu2.make.com/00i9rjwdtt2np4brm8mm7p8hla9rix78',
  generateVideo: 'https://hook.eu2.make.com/5efo29nninirjgj06nh69jq7lt6piiva',
  checkStatus: 'https://hook.eu2.make.com/1ejgvywznrgfbs4iaijt2xdlzf62n7w5'
};

const UPLOADPOST_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImluZm9zcG9sb2sub2ZmaWNlQGdtYWlsLmNvbSIsImV4cCI6NDkxMjQzMzIxNiwianRpIjoiNDA2NDI2ZTUtNWUxNi00Mjc5LThmYzQtZDUzMDlhNTQwNzIwIn0.EylwU51ZDhLFIXBL6hf49pdxCLAiwTY6tf_SW-6FktA';

const App = () => {
  const [currentUser] = useState('user_' + Date.now());
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
    loadConnectedAccounts();
    loadUploadPostUser();
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

  const loadConnectedAccounts = () => {
    try {
      const saved = localStorage.getItem(`accounts_${currentUser}`);
      if (saved) {
        setConnectedAccounts(JSON.parse(saved));
      }
    } catch (error) {
      console.log('No accounts found');
    }
  };

  const loadUploadPostUser = () => {
    try {
      const saved = localStorage.getItem(`uploadpost_user_${currentUser}`);
      if (saved) {
        setUploadPostUser(JSON.parse(saved));
      }
    } catch (error) {
      console.log('No upload-post user found');
    }
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

  const createUploadPostUser = async () => {
    try {
      // Try different username formats - upload-post might have specific requirements
      const timestamp = Date.now().toString();
      const randomId = Math.random().toString(36).substring(2, 8);
      const username = `user${randomId}`;
      
      console.log('Creating upload-post user:', username);
      
      // Try with both username formats
      let response = await fetch('https://api.upload-post.com/api/uploadposts/users/create', {
        method: 'POST',
        headers: {
          'Authorization': `Apikey ${UPLOADPOST_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });

      let data = await response.json();
      console.log('Create user response:', data);
      
      // If failed, maybe try with email format
      if (!data.success && data.message && data.message.includes('pattern')) {
        console.log('Trying with email format...');
        const email = `${username}@tempmail.com`;
        
        response = await fetch('https://api.upload-post.com/api/uploadposts/users/create', {
          method: 'POST',
          headers: {
            'Authorization': `Apikey ${UPLOADPOST_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            username,
            email 
          })
        });
        
        data = await response.json();
        console.log('Create user with email response:', data);
      }
      
      if (data.success) {
        saveUploadPostUser({ username, created: true });
        return username;
      } else {
        console.error('Failed to create user:', data);
        alert(`Error creating profile: ${data.message || 'Unknown error'}\n\nPlease check console for details.`);
      }
    } catch (error) {
      console.error('Error creating upload-post user:', error);
      alert(`Network error: ${error.message}`);
    }
    return null;
  };

  const connectSocialAccount = async () => {
    setIsLoading(true);
    
    try {
      // First, try to use existing username or create simple one
      let username = uploadPostUser?.username;
      
      if (!username) {
        // Generate a simple username
        const randomId = Math.random().toString(36).substring(2, 10);
        username = randomId; // Just use simple alphanumeric
        
        console.log('Attempting to create/use username:', username);
        
        // Try to create user, but don't fail if user already exists
        try {
          const createResponse = await fetch('https://api.upload-post.com/api/uploadposts/users', {
            method: 'POST',
            headers: {
              'Authorization': `ApiKey ${UPLOADPOST_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
          });
          
          const createData = await createResponse.json();
          console.log('Create response:', createData);
          
          if (createData.success) {
            saveUploadPostUser({ username, created: true });
          } else if (createData.message && createData.message.includes('already exists')) {
            // User already exists, that's fine
            console.log('User already exists, continuing...');
            saveUploadPostUser({ username, created: true });
          } else {
            // Real error
            console.error('Error creating user:', createData);
            alert(`Failed to create user profile: ${createData.message || 'Unknown error'}`);
            setIsLoading(false);
            return;
          }
        } catch (createError) {
          console.error('Error in create request:', createError);
          alert(`Network error: ${createError.message}`);
          setIsLoading(false);
          return;
        }
      }

      // Now generate JWT for connecting accounts
      console.log('Generating JWT for:', username);

      console.log('Generating JWT for:', username);
      
      const response = await fetch('https://api.upload-post.com/api/uploadposts/users/generate-jwt', {
        method: 'POST',
        headers: {
          'Authorization': `Apikey ${UPLOADPOST_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });

      const data = await response.json();
      console.log('JWT response:', data);
      
      if (data.success && data.access_url) {
        const confirmed = confirm(
          'You will be redirected to upload-post.com to connect your social media accounts.\n\n' +
          'After connecting, you can close that tab and return here.\n\n' +
          'Click OK to continue.'
        );
        
        if (confirmed) {
          window.open(data.access_url, '_blank');
          
          setTimeout(() => {
            checkConnectedAccounts(username);
          }, 5000);
        }
      } else {
        alert('Failed to generate connection link. Please try again.');
      }
    } catch (error) {
      console.error('Error connecting account:', error);
      alert('Failed to connect account. Check console.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkConnectedAccounts = async (username) => {
    try {
      console.log('Checking accounts for:', username);
      
      const response = await fetch(`https://api.upload-post.com/api/uploadposts/users/get/${username}`, {
        method: 'GET',
        headers: {
          'Authorization': `Apikey ${UPLOADPOST_API_KEY}`
        }
      });

      const data = await response.json();
      console.log('Get user response:', data);
      
      if (data.success && data.profile) {
        const socialAccounts = data.profile.social_accounts || {};
        const connected = [];
        
        Object.keys(socialAccounts).forEach(platform => {
          if (socialAccounts[platform] && socialAccounts[platform] !== null) {
            connected.push({
              platform,
              connected_at: new Date().toISOString(),
              status: 'active',
              details: socialAccounts[platform]
            });
          }
        });
        
        if (connected.length > 0) {
          saveConnectedAccounts(connected);
          alert(`Successfully connected ${connected.length} account(s)!`);
        }
      }
    } catch (error) {
      console.error('Error checking accounts:', error);
    }
  };

  const refreshAccounts = async () => {
    if (!uploadPostUser?.username) {
      alert('No user profile found. Please connect accounts first.');
      return;
    }
    
    setIsLoading(true);
    await checkConnectedAccounts(uploadPostUser.username);
    setIsLoading(false);
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
        alert('Video generation started! Check Make.com for progress.');
      }
    } catch (error) {
      console.error('Error creating video:', error);
      alert('Failed to create video. Check console and Make.com webhook.');
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
    switch (platform.toLowerCase()) {
      case 'instagram':
        return <Instagram className="w-5 h-5" />;
      case 'youtube':
        return <Youtube className="w-5 h-5" />;
      case 'facebook':
        return <Facebook className="w-5 h-5" />;
      case 'tiktok':
        return <Video className="w-5 h-5" />;
      default:
        return <Video className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-600 p-2 rounded-lg">
                <Video className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Video Generator</h1>
            </div>
            <div className="text-sm text-gray-500">
              User: {currentUser.substring(0, 12)}...
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'create' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Create Video
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'videos' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            My Videos ({videos.length})
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'accounts' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Social Accounts ({connectedAccounts.length})
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'create' && (
          <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Video</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video Topic / Script
                </label>
                <textarea
                  value={videoForm.topic}
                  onChange={(e) => setVideoForm({ ...videoForm, topic: e.target.value })}
                  placeholder="Enter your video topic or script here..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Style</label>
                  <select
                    value={videoForm.style}
                    onChange={(e) => setVideoForm({ ...videoForm, style: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="casual">Casual</option>
                    <option value="professional">Professional</option>
                    <option value="energetic">Energetic</option>
                    <option value="educational">Educational</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (seconds)
                  </label>
                  <input
                    type="number"
                    value={videoForm.duration}
                    onChange={(e) => setVideoForm({ ...videoForm, duration: parseInt(e.target.value) })}
                    min="15"
                    max="180"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Connected Accounts:</strong> {connectedAccounts.length > 0 
                    ? connectedAccounts.map(a => a.platform).join(', ')
                    : 'None - Please connect accounts first'}
                </p>
              </div>

              <button
                onClick={createVideo}
                disabled={isLoading || connectedAccounts.length === 0}
                className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    <span>Generate Video</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'videos' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">My Videos</h2>
              <button
                onClick={loadVideos}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                Refresh
              </button>
            </div>

            {videos.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No videos yet</h3>
                <p className="text-gray-500 mb-6">Create your first video to get started</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="bg-purple-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-purple-700"
                >
                  Create Video
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {videos.map((video) => (
                  <div key={video.video_id} className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {getStatusIcon(video.status)}
                          <span className="font-medium text-gray-900 capitalize">{video.status}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{video.topic}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>Style: {video.style}</span>
                          <span>•</span>
                          <span>{video.duration}s</span>
                          <span>•</span>
                          <span>{new Date(video.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {video.status === 'generating' && (
                        <button
                          onClick={() => refreshVideoStatus(video.video_id)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Check Status
                        </button>
                      )}
                    </div>
                    
                    {video.video_url && (
                      <div className="mt-4 pt-4 border-t">
                        <a
                          href={video.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:text-purple-700 font-medium text-sm"
                        >
                          View Video →
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
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Connect Social Media</h2>

            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Upload-Post Connection</h3>
                  <p className="text-sm text-gray-600">
                    Connect your social media accounts through upload-post.com
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={refreshAccounts}
                    disabled={isLoading}
                    className="py-2 px-4 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Refresh Status
                  </button>
                  <button
                    onClick={connectSocialAccount}
                    disabled={isLoading}
                    className="py-2 px-6 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 flex items-center space-x-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-5 h-5" />
                        <span>Connect Accounts</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {connectedAccounts.length > 0 && (
              <div className="grid gap-4 mb-8">
                {connectedAccounts.map((account, index) => (
                  <div key={index} className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="bg-gray-100 p-3 rounded-lg">
                          {getSocialIcon(account.platform)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 capitalize">{account.platform}</h3>
                          <p className="text-sm text-gray-500">
                            Connected on {new Date(account.connected_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="bg-green-100 text-green-700 py-2 px-4 rounded-lg font-medium">
                        Connected ✓
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>How it works:</strong> Click "Connect Accounts" to open upload-post.com in a new tab. 
                Connect your social media accounts there, then click "Refresh Status" to sync them here.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
