import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  Video, Plus, Instagram, Youtube, Facebook, Loader2, CheckCircle, XCircle, 
  Clock, ExternalLink, Settings, BarChart3, Calendar, Users, TrendingUp,
  RefreshCw, Play, LogIn, UserPlus, LogOut, Home, Sparkles, Zap
} from 'lucide-react';

// ... trimmed unchanged code above ...

  const refreshAccountStatus = async () => {
    if (!uploadPostProfile?.username) {
      alert('No profile found. Please connect accounts first.');
      return;
    }

    setLoading(true);
    setDebugInfo(`Checking accounts for: ${uploadPostProfile.username}`);
    
    try {
      // Call our server-side proxy to bypass CORS
      const response = await fetch(`/api/proxy/uploadpost/users/get/${uploadPostProfile.username}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
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

// ... rest of file unchanged ...
