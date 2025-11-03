import express from 'express';
import { PrismaClient } from '@prisma/client';
import { validateWorkspaceAccess } from '../middleware/workspace.js';
import { authenticateToken } from '../middleware/auth.js';
import fetch from 'node-fetch';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const connectAccountSchema = Joi.object({
  workspaceId: Joi.string().required(),
  platforms: Joi.array().items(Joi.string().valid('tiktok', 'instagram', 'linkedin', 'youtube', 'facebook', 'x', 'threads')).optional(),
  redirectUrl: Joi.string().uri().optional(),
  logoImage: Joi.string().uri().optional()
});

// UploadPost API helper class
class UploadPostAPI {
  constructor() {
    this.apiKey = process.env.UPLOADPOST_KEY;
    this.baseURL = 'https://api.upload-post.com';
  }

  async createUserProfile(username) {
    try {
      const response = await fetch(`${this.baseURL}/api/uploadposts/users`, {
        method: 'POST',
        headers: {
          'Authorization': `ApiKey ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });

      if (!response.ok) {
        let errorMessage = `Failed to create user profile: ${response.status}`;
        try {
          const error = await response.json();
          errorMessage = error.message || error.error || errorMessage;
        } catch (e) {
          // Response is not JSON, use status text
          errorMessage = `${errorMessage} - ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        throw new Error('Request timeout: UploadPost API did not respond in time');
      }
      throw error;
    }
  }

  async generateJWTUrl(username, options = {}) {
    try {
      console.log('Generating JWT URL for profile:', username);
      console.log('UploadPost API Key exists:', !!this.apiKey);
      console.log('UploadPost API Key length:', this.apiKey ? this.apiKey.length : 0);
      
      const response = await fetch(`${this.baseURL}/api/uploadposts/users/generate-jwt`, {
        method: 'POST',
        headers: {
          'Authorization': `ApiKey ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          ...options
        })
      });

      console.log('UploadPost API response status:', response.status);

      if (!response.ok) {
        let errorMessage = `Failed to generate JWT URL: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
          console.error('UploadPost API error response:', errorData);
        } catch (e) {
          // Response is not JSON
          const text = await response.text();
          console.error('UploadPost API error (non-JSON):', text);
          errorMessage = `${errorMessage} - ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('UploadPost API success, connection URL received');
      return data;
    } catch (error) {
      console.error('UploadPost generateJWTUrl error:', error);
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        throw new Error('Request timeout: UploadPost API did not respond in time');
      }
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        throw new Error('Cannot connect to UploadPost API. Please check your network connection.');
      }
      throw error;
    }
  }

  async getUserProfiles() {
    const response = await fetch(`${this.baseURL}/api/uploadposts/users`, {
      method: 'GET',
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to get user profiles: ${response.status}`);
    }

    return await response.json();
  }

  async getUserProfile(username) {
    try {
      const response = await fetch(`${this.baseURL}/api/uploadposts/users/${username}`, {
        method: 'GET',
        headers: {
          'Authorization': `ApiKey ${this.apiKey}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        let errorMessage = `Failed to get user profile: ${response.status}`;
        try {
          const error = await response.json();
          errorMessage = error.message || error.error || errorMessage;
        } catch (e) {
          errorMessage = `${errorMessage} - ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      if (error.message && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async deleteUserProfile(username) {
    const response = await fetch(`${this.baseURL}/api/uploadposts/users`, {
      method: 'DELETE',
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to delete user profile: ${response.status}`);
    }

    return await response.json();
  }

  async getFacebookPages(profile = null) {
    const url = profile 
      ? `${this.baseURL}/api/uploadposts/facebook/pages?profile=${profile}`
      : `${this.baseURL}/api/uploadposts/facebook/pages`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to get Facebook pages: ${response.status}`);
    }

    return await response.json();
  }
}

const uploadPostAPI = new UploadPostAPI();

// Helper function to generate unique profile ID
function generateUploadPostProfileId(userId, workspaceId) {
  return `cf_${userId}_${workspaceId}`;
}

// Get workspace social accounts
router.get('/workspace/:workspaceId', validateWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    
    const socialAccounts = await prisma.socialAccount.findMany({
      where: {
        workspaceId,
        isConnected: true
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            avatar: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get latest connection status from UploadPost
    for (const account of socialAccounts) {
      try {
        const profileData = await uploadPostAPI.getUserProfile(account.uploadPostProfileId);
        if (profileData && profileData.profile) {
          const platformData = profileData.profile.social_accounts[account.platform.toLowerCase()];
          if (platformData && typeof platformData === 'object') {
            account.displayName = platformData.display_name || account.displayName;
            account.username = platformData.username || account.username;
            account.profileImage = platformData.social_images || account.profileImage;
          }
        }
      } catch (error) {
        console.warn(`Failed to sync account ${account.id}:`, error.message);
      }
    }

    res.json({ socialAccounts });
  } catch (error) {
    console.error('Get social accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch social accounts' });
  }
});

// Generate connection URL for social accounts
router.post('/connect', authenticateToken, async (req, res) => {
  try {
    console.log('🔗 Connect social accounts request received');
    console.log('User ID:', req.user?.id);
    
    const { error, value } = connectAccountSchema.validate(req.body);
    if (error) {
      console.error('Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { workspaceId, platforms, redirectUrl, logoImage } = value;
    console.log('Workspace ID:', workspaceId);
    console.log('Platforms:', platforms);

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required' });
    }

    // Check if UploadPost API key is configured
    if (!process.env.UPLOADPOST_KEY) {
      console.error('❌ UPLOADPOST_KEY is not configured');
      return res.status(500).json({ 
        error: 'Social media integration is not configured. Please contact support.',
        code: 'UPLOADPOST_KEY_MISSING'
      });
    }

    console.log('✅ UPLOADPOST_KEY is configured');

    // Verify workspace access
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!member || member.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Access denied to workspace' });
    }

    const profileId = generateUploadPostProfileId(req.user.id, workspaceId);

    try {
      // Check if profile exists, create if it doesn't
      let profileExists = null;
      try {
        profileExists = await uploadPostAPI.getUserProfile(profileId);
      } catch (profileError) {
        // Profile doesn't exist, we'll create it
        console.log('Profile does not exist, creating new profile:', profileId);
      }

      if (!profileExists) {
        try {
          await uploadPostAPI.createUserProfile(profileId);
          console.log('Created new UploadPost profile:', profileId);
        } catch (createError) {
          console.error('Failed to create UploadPost profile:', createError);
          // Continue anyway, profile might already exist
        }
      }

      // Generate JWT URL for account connection
      const jwtResponse = await uploadPostAPI.generateJWTUrl(profileId, {
        redirect_url: redirectUrl || `${req.protocol}://${req.get('host')}/workspace/${workspaceId}/settings/social-accounts`,
        logo_image: logoImage || `${req.protocol}://${req.get('host')}/logo.png`,
        platforms: platforms || [],
        connect_title: 'Connect Your Social Media Accounts',
        connect_description: 'Link your social media accounts to start publishing content from Content Factory.',
        redirect_button_text: 'Return to Content Factory'
      });

      if (!jwtResponse || !jwtResponse.access_url) {
        throw new Error('UploadPost API did not return a valid connection URL');
      }

      // Create activity log
      try {
        await prisma.activity.create({
          data: {
            userId: req.user.id,
            action: 'SOCIAL_CONNECTION_INITIATED',
            description: 'Started social media account connection process',
            metadata: { workspaceId, platforms, profileId }
          }
        });
      } catch (activityError) {
        // Log activity error but don't fail the request
        console.warn('Failed to create activity log:', activityError);
      }

      return res.json({
        success: true,
        connectionUrl: jwtResponse.access_url,
        duration: jwtResponse.duration,
        profileId
      });
    } catch (uploadPostError) {
      console.error('UploadPost API error:', uploadPostError);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to generate connection URL';
      let statusCode = 500;

      if (uploadPostError.message) {
        if (uploadPostError.message.includes('401') || uploadPostError.message.includes('Unauthorized')) {
          errorMessage = 'UploadPost API authentication failed. Please check API key configuration.';
          statusCode = 500;
        } else if (uploadPostError.message.includes('403') || uploadPostError.message.includes('Forbidden')) {
          errorMessage = 'UploadPost API access denied. Please check API permissions.';
          statusCode = 500;
        } else if (uploadPostError.message.includes('404')) {
          errorMessage = 'UploadPost API endpoint not found.';
          statusCode = 500;
        } else {
          errorMessage = uploadPostError.message;
        }
      }

      return res.status(statusCode).json({ 
        error: errorMessage,
        code: 'UPLOADPOST_API_ERROR',
        details: process.env.NODE_ENV === 'development' ? uploadPostError.message : undefined
      });
    }
  } catch (error) {
    console.error('Connect social accounts error:', error);
    console.error('Error stack:', error.stack);
    
    // Ensure we always return a response
    const errorMessage = error?.message || 'Failed to generate connection URL';
    const statusCode = error?.statusCode || 500;
    
    return res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      code: 'INTERNAL_ERROR'
    });
  }
});

// Sync connected accounts from UploadPost
router.post('/sync/:workspaceId', validateWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const profileId = generateUploadPostProfileId(req.user.id, workspaceId);

    // Get current connected accounts from UploadPost
    const profileData = await uploadPostAPI.getUserProfile(profileId);
    if (!profileData || !profileData.profile) {
      return res.status(404).json({ error: 'No social media profile found' });
    }

    const connectedAccounts = profileData.profile.social_accounts;
    const syncedAccounts = [];

    // Process each connected account
    for (const [platform, accountData] of Object.entries(connectedAccounts)) {
      if (!accountData || typeof accountData !== 'object') continue;

      const platformEnum = platform.toUpperCase();
      
      // Check if platform is supported
      const supportedPlatforms = ['INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'FACEBOOK', 'LINKEDIN', 'TWITTER', 'THREADS'];
      if (!supportedPlatforms.includes(platformEnum)) continue;

      try {
        // Upsert social account
        const socialAccount = await prisma.socialAccount.upsert({
          where: {
            userId_workspaceId_platform: {
              userId: req.user.id,
              workspaceId,
              platform: platformEnum === 'TWITTER' ? 'TWITTER' : platformEnum
            }
          },
          update: {
            displayName: accountData.display_name,
            username: accountData.username,
            profileImage: accountData.social_images,
            isConnected: true,
            uploadPostProfileId: profileId,
            metadata: accountData,
            updatedAt: new Date()
          },
          create: {
            platform: platformEnum === 'TWITTER' ? 'TWITTER' : platformEnum,
            platformUserId: accountData.username || accountData.display_name || 'unknown',
            displayName: accountData.display_name,
            username: accountData.username,
            profileImage: accountData.social_images,
            isConnected: true,
            uploadPostProfileId: profileId,
            metadata: accountData,
            userId: req.user.id,
            workspaceId
          }
        });

        syncedAccounts.push(socialAccount);

        // Create notification
        await prisma.notification.create({
          data: {
            userId: req.user.id,
            type: 'SOCIAL_ACCOUNT_CONNECTED',
            title: 'Social Account Connected',
            message: `Your ${platform} account has been successfully connected!`,
            data: { platform, accountId: socialAccount.id, workspaceId }
          }
        });
      } catch (error) {
        console.error(`Failed to sync ${platform} account:`, error);
      }
    }

    // Create activity log
    await prisma.activity.create({
      data: {
        userId: req.user.id,
        action: 'SOCIAL_ACCOUNTS_SYNCED',
        description: `Synced ${syncedAccounts.length} social media accounts`,
        metadata: { 
          workspaceId, 
          profileId,
          syncedPlatforms: syncedAccounts.map(acc => acc.platform)
        }
      }
    });

    res.json({ 
      message: 'Social accounts synced successfully',
      syncedAccounts: syncedAccounts.length,
      accounts: syncedAccounts
    });
  } catch (error) {
    console.error('Sync social accounts error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync social accounts' });
  }
});

// Disconnect social account
router.delete('/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    
    const socialAccount = await prisma.socialAccount.findUnique({
      where: { id: accountId },
      include: { workspace: true }
    });

    if (!socialAccount) {
      return res.status(404).json({ error: 'Social account not found' });
    }

    // Check workspace access
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: socialAccount.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Mark as disconnected instead of deleting
    const updatedAccount = await prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        isConnected: false,
        updatedAt: new Date()
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: socialAccount.userId,
        type: 'SOCIAL_ACCOUNT_DISCONNECTED',
        title: 'Social Account Disconnected',
        message: `Your ${socialAccount.platform} account has been disconnected`,
        data: { platform: socialAccount.platform, workspaceId: socialAccount.workspaceId }
      }
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        userId: req.user.id,
        action: 'SOCIAL_ACCOUNT_DISCONNECTED',
        description: `Disconnected ${socialAccount.platform} account`,
        metadata: { 
          accountId,
          platform: socialAccount.platform,
          workspaceId: socialAccount.workspaceId
        }
      }
    });

    res.json({ 
      message: 'Social account disconnected successfully',
      account: updatedAccount
    });
  } catch (error) {
    console.error('Disconnect social account error:', error);
    res.status(500).json({ error: 'Failed to disconnect social account' });
  }
});

// Get Facebook pages for a connected account
router.get('/facebook/pages/:workspaceId', validateWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const profileId = generateUploadPostProfileId(req.user.id, workspaceId);

    // Check if Facebook account is connected
    const facebookAccount = await prisma.socialAccount.findUnique({
      where: {
        userId_workspaceId_platform: {
          userId: req.user.id,
          workspaceId,
          platform: 'FACEBOOK'
        }
      }
    });

    if (!facebookAccount || !facebookAccount.isConnected) {
      return res.status(404).json({ error: 'Facebook account not connected' });
    }

    const pagesData = await uploadPostAPI.getFacebookPages(profileId);
    
    res.json({
      pages: pagesData.pages || [],
      success: pagesData.success
    });
  } catch (error) {
    console.error('Get Facebook pages error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch Facebook pages' });
  }
});

// Get available platforms for connection
router.get('/platforms', (req, res) => {
  const platforms = [
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Share photos and stories',
      icon: 'instagram',
      color: '#E4405F'
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      description: 'Upload short videos',
      icon: 'tiktok',
      color: '#000000'
    },
    {
      id: 'youtube',
      name: 'YouTube',
      description: 'Upload and manage videos',
      icon: 'youtube',
      color: '#FF0000'
    },
    {
      id: 'facebook',
      name: 'Facebook',
      description: 'Post updates and media',
      icon: 'facebook',
      color: '#1877F2'
    },
    {
      id: 'x',
      name: 'X (Twitter)',
      description: 'Post tweets and media',
      icon: 'twitter',
      color: '#1DA1F2'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      description: 'Professional networking',
      icon: 'linkedin',
      color: '#0A66C2'
    },
    {
      id: 'threads',
      name: 'Threads',
      description: 'Text-based conversations',
      icon: 'threads',
      color: '#000000'
    }
  ];

  res.json({ platforms });
});

export default router;