import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaInstagram, 
  FaTiktok, 
  FaYoutube, 
  FaFacebook, 
  FaTwitter, 
  FaLinkedin,
  FaPlus,
  FaTrash,
  FaSync,
  FaExternalLinkAlt,
  FaCheck,
  FaTimes,
  FaExclamationTriangle
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';

const platformIcons = {
  INSTAGRAM: FaInstagram,
  instagram: FaInstagram,
  TIKTOK: FaTiktok,
  tiktok: FaTiktok,
  YOUTUBE: FaYoutube,
  youtube: FaYoutube,
  FACEBOOK: FaFacebook,
  facebook: FaFacebook,
  TWITTER: FaTwitter,
  twitter: FaTwitter,
  x: FaTwitter,
  LINKEDIN: FaLinkedin,
  linkedin: FaLinkedin,
  THREADS: FaTwitter,
  threads: FaTwitter
};

const platformColors = {
  INSTAGRAM: '#E4405F',
  instagram: '#E4405F',
  TIKTOK: '#000000',
  tiktok: '#000000',
  YOUTUBE: '#FF0000',
  youtube: '#FF0000',
  FACEBOOK: '#1877F2',
  facebook: '#1877F2',
  TWITTER: '#1DA1F2',
  twitter: '#1DA1F2',
  x: '#1DA1F2',
  LINKEDIN: '#0A66C2',
  linkedin: '#0A66C2',
  THREADS: '#000000',
  threads: '#000000'
};

const SocialAccountsManager = ({ workspaceId, onAccountsUpdate }) => {
  const { apiCall } = useAuth();
  const [socialAccounts, setSocialAccounts] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [connectionUrl, setConnectionUrl] = useState(null);

  useEffect(() => {
    if (workspaceId) {
      fetchSocialAccounts();
      fetchPlatforms();
    }
  }, [workspaceId]);

  const fetchSocialAccounts = async () => {
    try {
      setError(null);
      console.log('Fetching social accounts for workspace:', workspaceId);
      
      const response = await apiCall(`/api/social-accounts/workspace/${workspaceId}`);

      if (response.ok) {
        const data = await response.json();
        console.log('Social accounts response:', data);
        setSocialAccounts(data.socialAccounts || []);
        onAccountsUpdate?.(data.socialAccounts || []);
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch social accounts:', errorData);
        setError(errorData.error || 'Failed to fetch social accounts');
      }
    } catch (error) {
      console.error('Error fetching social accounts:', error);
      setError('Failed to fetch social accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlatforms = async () => {
    try {
      const response = await apiCall('/api/social-accounts/platforms');
      if (response.ok) {
        const data = await response.json();
        setPlatforms(data.platforms);
      }
    } catch (error) {
      console.error('Error fetching platforms:', error);
    }
  };

  const handleConnectAccounts = async () => {
    if (selectedPlatforms.length === 0) {
      setError('Please select at least one platform');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const response = await apiCall('/api/social-accounts/connect', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId,
          platforms: selectedPlatforms,
          redirectUrl: `${window.location.origin}/workspace/${workspaceId}/settings/social-accounts`,
          logoImage: `${window.location.origin}/logo.png`
        })
      });

      if (response.ok) {
        const data = await response.json();
        setConnectionUrl(data.connectionUrl);
        // Open connection URL in new tab
        window.open(data.connectionUrl, '_blank', 'width=600,height=700');
        setShowConnectModal(false);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to generate connection URL');
      }
    } catch (error) {
      console.error('Error connecting accounts:', error);
      setError('Failed to connect social accounts');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSyncAccounts = async () => {
    setIsSyncing(true);
    setError(null);

    try {
      // For demo, just refresh the accounts
      await fetchSocialAccounts();
    } catch (error) {
      console.error('Error syncing accounts:', error);
      setError('Failed to sync social accounts');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectAccount = async (accountId) => {
    if (!confirm('Are you sure you want to disconnect this social account?')) {
      return;
    }

    try {
      const response = await apiCall(`/api/social-accounts/${accountId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchSocialAccounts(); // Refresh the list
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to disconnect account');
      }
    } catch (error) {
      console.error('Error disconnecting account:', error);
      setError('Failed to disconnect social account');
    }
  };

  const togglePlatformSelection = (platformId) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Connected Accounts
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage your social media connections
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleSyncAccounts}
            disabled={isSyncing}
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center space-x-2 transition-colors"
          >
            <FaSync className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowConnectModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 flex items-center space-x-2 transition-all"
          >
            <FaPlus className="w-4 h-4" />
            <span>Connect Account</span>
          </button>
        </div>
      </div>

      {/* Upload-Post API Key Warning */}
      {!process.env.UPLOADPOST_KEY && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl flex items-start space-x-3">
          <FaExclamationTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">Demo Mode</p>
            <p className="text-amber-700 dark:text-amber-300">
              Upload-Post API key not configured. Showing demo social accounts. Add your UPLOADPOST_KEY to .env to connect real accounts.
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 rounded-xl">
          {error}
        </div>
      )}

      {/* Connected Platforms */}
      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Connected Platforms</h4>
        
        {socialAccounts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <FaPlus className="w-12 h-12 mx-auto" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No social accounts connected
            </h4>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Connect your social media accounts to start publishing content
            </p>
            <button
              onClick={() => setShowConnectModal(true)}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all"
            >
              Connect Your First Account
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {socialAccounts.map((account) => {
              const platform = account.platform.toLowerCase();
              const Icon = platformIcons[platform] || FaExternalLinkAlt;
              const color = platformColors[platform] || '#6B7280';
              
              return (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-700/50"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                      <Icon className="w-6 h-6" style={{ color }} />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white capitalize">
                        {platform}
                      </h4>
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <span>{account.displayName || account.username || 'Connected Account'}</span>
                        {account.isConnected !== false ? (
                          <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                            <FaCheck className="w-3 h-3" />
                            <span>Connected</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
                            <span>Invalid Date</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {account.profileImage && (
                      <img
                        src={account.profileImage}
                        alt={account.displayName || account.username}
                        className="w-8 h-8 rounded-full"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <button
                      onClick={() => handleDisconnectAccount(account.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Disconnect account"
                    >
                      <FaTrash className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect Modal */}
      <AnimatePresence>
        {showConnectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowConnectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Connect Social Media Accounts
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Select the platforms you want to connect. You'll be redirected to authorize each platform.
                </p>

                <div className="space-y-3 mb-6">
                  {platforms.map((platform) => {
                    const Icon = platformIcons[platform.id.toLowerCase()];
                    const isSelected = selectedPlatforms.includes(platform.id);
                    
                    return (
                      <div
                        key={platform.id}
                        onClick={() => togglePlatformSelection(platform.id)}
                        className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex-shrink-0 mr-3">
                          {Icon ? <Icon className="w-6 h-6" style={{ color: platform.color }} /> : <FaExternalLinkAlt className="w-6 h-6" />}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {platform.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {platform.description}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? 'border-purple-500 bg-purple-500'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            {isSelected && <FaCheck className="w-3 h-3 text-white" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowConnectModal(false)}
                    className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConnectAccounts}
                    disabled={isConnecting || selectedPlatforms.length === 0}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all"
                  >
                    {isConnecting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <FaExternalLinkAlt className="w-4 h-4" />
                        <span>Connect Selected</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SocialAccountsManager;