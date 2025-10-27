import React, { useState, useEffect } from 'react';
import { 
  Video, Plus, Instagram, Youtube, Facebook, Loader2, CheckCircle, XCircle, 
  Clock, ExternalLink, Settings, BarChart3, Calendar, Users, TrendingUp,
  RefreshCw, Play, AlertTriangle, Zap
} from 'lucide-react';

const App = () => {
  const [currentUser] = useState('user_' + Date.now());
  const [activeTab, setActiveTab] = useState('accounts');
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadConnectedAccounts();
  }, []);

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

  const saveConnectedAccounts = (accounts) => {
    localStorage.setItem(`accounts_${currentUser}`, JSON.stringify(accounts));
    setConnectedAccounts(accounts);
  };

  // Manual account connection (bypassing API)
  const connectSocialAccount = () => {
    setError(null);
    
    const confirmed = confirm(
      'Due to upload-post.com API limitations, we\'ll use manual connection.\n\n' +
      'Steps:\n' +
      '1. Open upload-post.com in a new tab\n' +
      '2. Sign up/login and connect your accounts\n' +
      '3. Return here to manually add them\n\n' +
      'Click OK to continue.'
    );
    
    if (confirmed) {
      window.open('https://app.upload-post.com/login', '_blank');
      
      // Show manual add dialog after a delay
      setTimeout(() => {
        addAccountsManually();
      }, 3000);
    }
  };

  const addAccountsManually = () => {
    const platforms = ['Instagram', 'YouTube', 'TikTok', 'Facebook'];
    const newAccounts = [];
    
    platforms.forEach(platform => {
      if (confirm(`Did you connect ${platform}? Click OK if yes, Cancel if no.`)) {
        const username = prompt(`Enter your ${platform} username:`) || `@${platform.toLowerCase()}_user`;
        
        newAccounts.push({
          platform: platform.toLowerCase(),
          connected_at: new Date().toISOString(),
          status: 'active',
          username: username,
          user_id: currentUser,
          manual: true
        });
      }
    });
    
    if (newAccounts.length > 0) {
      const updated = [...connectedAccounts, ...newAccounts];
      saveConnectedAccounts(updated);
      alert(`Successfully added ${newAccounts.length} account(s)!`);
    }
  };

  const refreshAccounts = () => {
    setError(null);
    
    const confirmed = confirm(
      'Manual refresh: Have you connected new accounts?\n\n' +
      'Click OK to add them manually.'
    );
    
    if (confirmed) {
      addAccountsManually();
    }
  };

  const removeAccount = (index) => {
    if (confirm('Remove this account?')) {
      const updated = connectedAccounts.filter((_, i) => i !== index);
      saveConnectedAccounts(updated);
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg">
                <Video className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Content Factory</h1>
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
            onClick={() => setActiveTab('accounts')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'accounts' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Social Accounts ({connectedAccounts.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'create' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Create Video
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'accounts' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Social Media Accounts</h2>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-900">Connection Error</h4>
                    <p className="text-sm text-red-800 mt-1">{error}</p>
                    <button
                      onClick={() => setError(null)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium mt-2"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Connection Panel */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Connect Your Accounts</h3>
                  <p className="text-sm text-gray-600">
                    Connect your social media accounts to automatically publish videos
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={refreshAccounts}
                    disabled={isLoading}
                    className="py-2 px-4 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 inline ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh Status
                  </button>
                  <button
                    onClick={connectSocialAccount}
                    disabled={isLoading}
                    className="py-2 px-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4 mr-2" />
                    )}
                    Connect Accounts
                  </button>
                </div>
              </div>
            </div>

            {/* Connected Accounts List */}
            {connectedAccounts.length > 0 ? (
              <div className="grid gap-4">
                {connectedAccounts.map((account, index) => (
                  <div key={index} className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="bg-gray-100 p-3 rounded-lg">
                          {getSocialIcon(account.platform)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 capitalize">{account.platform}</h3>
                          <p className="text-sm text-gray-500">{account.username}</p>
                          <p className="text-xs text-gray-400">
                            Connected {new Date(account.connected_at).toLocaleDateString()}
                            {account.manual && ' (Manual)'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          Connected
                        </span>
                        <button
                          onClick={() => removeAccount(index)}
                          className="text-red-400 hover:text-red-600 p-1"
                          title="Remove account"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No connected accounts</h3>
                <p className="text-gray-500 mb-6">
                  Connect your social media accounts to start publishing videos automatically
                </p>
                <button
                  onClick={connectSocialAccount}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 px-6 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all"
                >
                  Connect Your First Account
                </button>
              </div>
            )}

            {/* Help Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-6">
              <div className="flex items-start space-x-3">
                <Zap className="w-6 h-6 text-blue-600 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">How to connect accounts</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>1. Click "Connect Accounts" above</p>
                    <p>2. Sign up/login to upload-post.com</p>
                    <p>3. Connect your social media accounts there</p>
                    <p>4. Return here and confirm your connections</p>
                    <p>5. Start creating videos that post automatically!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Video</h2>
            
            {connectedAccounts.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Connect accounts first</h3>
                <p className="text-gray-500 mb-4">You need to connect social media accounts before creating videos</p>
                <button
                  onClick={() => setActiveTab('accounts')}
                  className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to Social Accounts
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Video Topic / Script
                  </label>
                  <textarea
                    placeholder="Enter your video topic or script here..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Style</label>
                    <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option>Casual</option>
                      <option>Professional</option>
                      <option>Energetic</option>
                      <option>Educational</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                    <input
                      type="number"
                      defaultValue={60}
                      min={15}
                      max={180}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">Ready to publish</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Video will be posted to: {connectedAccounts.map(a => a.platform).join(', ')}
                  </p>
                </div>

                <button className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all flex items-center justify-center space-x-2">
                  <Play className="w-5 h-5" />
                  <span>Generate Video</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;