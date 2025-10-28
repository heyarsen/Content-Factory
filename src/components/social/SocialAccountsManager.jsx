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
  FaTimes
} from 'react-icons/fa';

const platformIcons = {
  INSTAGRAM: FaInstagram,
  TIKTOK: FaTiktok,
  YOUTUBE: FaYoutube,
  FACEBOOK: FaFacebook,
  TWITTER: FaTwitter,
  LINKEDIN: FaLinkedin,
  THREADS: FaTwitter // Using Twitter icon as placeholder for Threads
};

const platformColors = {
  INSTAGRAM: '#E4405F',
  TIKTOK: '#000000',
  YOUTUBE: '#FF0000',
  FACEBOOK: '#1877F2',
  TWITTER: '#1DA1F2',
  LINKEDIN: '#0A66C2',
  THREADS: '#000000'
};

const SocialAccountsManager = ({ workspaceId, onAccountsUpdate }) => {
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
      const response = await fetch(`/api/social-accounts/workspace/${workspaceId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSocialAccounts(data.socialAccounts);
        onAccountsUpdate?.(data.socialAccounts);
      } else {
        setError('Failed to fetch social accounts');
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
      const response = await fetch('/api/social-accounts/platforms');
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
      const response = await fetch('/api/social-accounts/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
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
        window.open(data.connectionUrl, '_blank');
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
      const response = await fetch(`/api/social-accounts/sync/${workspaceId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        await fetchSocialAccounts(); // Refresh the list
        // Show success message
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to sync accounts');
      }
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
      const response = await fetch(`/api/social-accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Social Media Accounts
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Connect your social media accounts to publish content automatically
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleSyncAccounts}
            disabled={isSyncing}
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center space-x-1"
          >
            <FaSync className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => setShowConnectModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <FaPlus className="w-4 h-4" />
            <span>Connect Accounts</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Connected Accounts */}
      <div className="space-y-3">
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
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Connect Your First Account
            </button>
          </div>
        ) : (
          socialAccounts.map((account) => {
            const Icon = platformIcons[account.platform];
            const color = platformColors[account.platform];
            
            return (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Icon className="w-8 h-8" style={{ color }} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {account.platform.charAt(0) + account.platform.slice(1).toLowerCase()}
                    </h4>
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <span>{account.displayName || account.username}</span>
                      {account.isConnected ? (
                        <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                          <FaCheck className="w-3 h-3" />
                          <span>Connected</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
                          <FaTimes className="w-3 h-3" />
                          <span>Disconnected</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {account.profileImage && (
                    <img
                      src={account.profileImage}
                      alt={account.displayName}
                      className="w-8 h-8 rounded-full"
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
          })
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
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4"
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
                    const Icon = platformIcons[platform.id.toUpperCase()];
                    const isSelected = selectedPlatforms.includes(platform.id);
                    
                    return (
                      <div
                        key={platform.id}
                        onClick={() => togglePlatformSelection(platform.id)}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex-shrink-0 mr-3">
                          <Icon className="w-6 h-6" style={{ color: platform.color }} />
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
                              ? 'border-blue-500 bg-blue-500'
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
                    className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConnectAccounts}
                    disabled={isConnecting || selectedPlatforms.length === 0}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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