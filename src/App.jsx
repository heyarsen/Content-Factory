import React, { useState, useEffect } from ‘react’;
import { Video, Plus, Instagram, Youtube, Facebook, Loader2, CheckCircle, XCircle, Clock } from ‘lucide-react’;

// REPLACE THESE WITH YOUR MAKE.COM WEBHOOK URLs
const WEBHOOKS = {
storeSocial: ‘https://hook.us1.make.com/YOUR_STORE_SOCIAL_WEBHOOK’,
generateVideo: ‘https://hook.us1.make.com/YOUR_GENERATE_VIDEO_WEBHOOK’,
checkStatus: ‘https://hook.us1.make.com/YOUR_CHECK_STATUS_WEBHOOK’
};

const App = () => {
const [currentUser] = useState(‘user_’ + Date.now());
const [activeTab, setActiveTab] = useState(‘create’);
const [videos, setVideos] = useState([]);
const [connectedAccounts, setConnectedAccounts] = useState([]);
const [isLoading, setIsLoading] = useState(false);
const [videoForm, setVideoForm] = useState({
topic: ‘’,
style: ‘casual’,
duration: 60,
avatar_id: ‘default_avatar’,
voice_id: ‘default_voice’
});

useEffect(() => {
loadVideos();
loadConnectedAccounts();
}, []);

const loadVideos = async () => {
try {
const result = await window.storage.get(`videos_${currentUser}`);
if (result) {
setVideos(JSON.parse(result.value));
}
} catch (error) {
console.log(‘No videos found’);
}
};

const loadConnectedAccounts = async () => {
try {
const result = await window.storage.get(`accounts_${currentUser}`);
if (result) {
setConnectedAccounts(JSON.parse(result.value));
}
} catch (error) {
console.log(‘No accounts found’);
}
};

const saveVideos = async (updatedVideos) => {
await window.storage.set(`videos_${currentUser}`, JSON.stringify(updatedVideos));
setVideos(updatedVideos);
};

const saveConnectedAccounts = async (accounts) => {
await window.storage.set(`accounts_${currentUser}`, JSON.stringify(accounts));
setConnectedAccounts(accounts);
};

const connectSocialAccount = async (platform) => {
setIsLoading(true);
try {
const mockToken = `${platform}_token_${Date.now()}`;

```
  const response = await fetch(WEBHOOKS.storeSocial, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: currentUser,
      platform: platform,
      access_token: mockToken,
      refresh_token: `refresh_${mockToken}`,
      expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    })
  });

  const data = await response.json();
  
  if (data.success) {
    const newAccount = {
      platform,
      connected_at: new Date().toISOString(),
      status: 'active'
    };
    const updated = [...connectedAccounts, newAccount];
    await saveConnectedAccounts(updated);
    alert(`${platform} connected successfully!`);
  }
} catch (error) {
  console.error('Error connecting account:', error);
  alert('Failed to connect account. Check console.');
} finally {
  setIsLoading(false);
}
```

};

const createVideo = async () => {
if (!videoForm.topic.trim()) {
alert(‘Please enter a topic’);
return;
}

```
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
    await saveVideos(updated);
    
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
  alert('Failed to create video. Check console and webhook URL.');
} finally {
  setIsLoading(false);
}
```

};

const refreshVideoStatus = async (videoId) => {
const updatedVideos = videos.map(v => {
if (v.video_id === videoId && v.status === ‘generating’) {
return {
…v,
status: ‘completed’,
video_url: `https://example.com/videos/${videoId}.mp4`,
completed_at: new Date().toISOString()
};
}
return v;
});
await saveVideos(updatedVideos);
};

const getStatusIcon = (status) => {
switch (status) {
case ‘pending’:
case ‘generating’:
return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
case ‘completed’:
return <CheckCircle className="w-5 h-5 text-green-500" />;
case ‘posted’:
return <CheckCircle className="w-5 h-5 text-purple-500" />;
case ‘failed’:
return <XCircle className="w-5 h-5 text-red-500" />;
default:
return <Clock className="w-5 h-5 text-gray-400" />;
}
};

const getSocialIcon = (platform) => {
switch (platform.toLowerCase()) {
case ‘instagram’:
return <Instagram className="w-5 h-5" />;
case ‘youtube’:
return <Youtube className="w-5 h-5" />;
case ‘facebook’:
return <Facebook className="w-5 h-5" />;
case ‘tiktok’:
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
User: {currentUser.substring(0, 12)}…
</div>
</div>
</div>
</header>

```
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

        <div className="grid gap-4 mb-8">
          {['Instagram', 'TikTok', 'YouTube', 'Facebook'].map((platform) => {
            const isConnected = connectedAccounts.some(
              (acc) => acc.platform.toLowerCase() === platform.toLowerCase()
            );

            return (
              <div key={platform} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-gray-100 p-3 rounded-lg">
                      {getSocialIcon(platform)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{platform}</h3>
                      <p className="text-sm text-gray-500">
                        {isConnected ? 'Connected' : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => !isConnected && connectSocialAccount(platform)}
                    disabled={isConnected || isLoading}
                    className={`py-2 px-6 rounded-lg font-medium transition-colors ${
                      isConnected
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400'
                    }`}
                  >
                    {isConnected ? 'Connected ✓' : 'Connect'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> In production, clicking "Connect" would redirect you to the platform's OAuth page. 
            This demo simulates the connection for testing.
          </p>
        </div>
      </div>
    )}
  </main>
</div>
```

);
};

export default App;
