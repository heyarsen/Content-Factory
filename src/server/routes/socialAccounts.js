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
    const response = await fetch(`${this.baseURL}/api/uploadposts/users`, {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to create user profile: ${response.status}`);
    }

    return await response.json();
  }

  async generateJWTUrl(username, options = {}) {
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

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to generate JWT URL: ${response.status}`);
    }

    return await response.json();
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
      const error = await response.json();
      throw new Error(error.message || `Failed to get user profile: ${response.status}`);
    }

    return await response.json();
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
    const { error, value } = connectAccountSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { workspaceId, platforms, redirectUrl, logoImage } = value;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required' });
    }

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

    // Check if profile exists, create if it doesn't
    let profileExists = await uploadPostAPI.getUserProfile(profileId);
    if (!profileExists) {
      await uploadPostAPI.createUserProfile(profileId);
    }

    // Generate JWT URL for account connection
    const jwtResponse = await uploadPostAPI.generateJWTUrl(profileId, {
      redirect_url: redirectUrl,
      logo_image: logoImage,
      platforms: platforms,
      connect_title: 'Connect Your Social Media Accounts',
      connect_description: 'Link your social media accounts to start publishing content from Content Factory.',
      redirect_button_text: 'Return to Content Factory'
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        userId: req.user.id,
        action: 'SOCIAL_CONNECTION_INITIATED',
        description: 'Started social media account connection process',
        metadata: { workspaceId, platforms, profileId }
      }
    });

    res.json({
      connectionUrl: jwtResponse.access_url,
      duration: jwtResponse.duration,
      profileId
    });
  } catch (error) {
    console.error('Connect social accounts error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate connection URL' });
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