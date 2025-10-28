import express from 'express';
import { PrismaClient } from '@prisma/client';
import { validateWorkspaceAccess } from '../middleware/workspace.js';
import fetch from 'node-fetch';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createPostSchema = Joi.object({
  platform: Joi.string().valid('INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'FACEBOOK', 'TWITTER', 'LINKEDIN', 'THREADS').required(),
  caption: Joi.string().max(2200),
  scheduledAt: Joi.date(),
  videoId: Joi.string(),
  workspaceId: Joi.string().required()
});

// Helper function to generate unique profile ID
function generateUploadPostProfileId(userId, workspaceId) {
  return `cf_${userId}_${workspaceId}`;
}

// UploadPost API helper
class UploadPostAPI {
  constructor() {
    this.apiKey = process.env.UPLOADPOST_KEY;
    this.baseURL = 'https://api.upload-post.com';
  }

  async uploadVideo(options) {
    const response = await fetch(`${this.baseURL}/api/uploadposts/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to upload video: ${response.status}`);
    }

    return await response.json();
  }

  async uploadPhoto(options) {
    const response = await fetch(`${this.baseURL}/api/uploadposts/photos`, {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to upload photo: ${response.status}`);
    }

    return await response.json();
  }

  async uploadText(options) {
    const response = await fetch(`${this.baseURL}/api/uploadposts/text`, {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to upload text post: ${response.status}`);
    }

    return await response.json();
  }
}

const uploadPostAPI = new UploadPostAPI();

// Get workspace posts
router.get('/workspace/:workspaceId', validateWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { page = 1, limit = 20, platform, status } = req.query;
    
    const where = { workspaceId };
    if (platform) where.platform = platform;
    if (status) where.status = status;

    const posts = await prisma.post.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            avatar: true
          }
        },
        video: {
          select: {
            title: true,
            thumbnailUrl: true,
            videoUrl: true
          }
        },
        analytics: {
          orderBy: { date: 'desc' },
          take: 1
        }
      },
      orderBy: {
        scheduledAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });

    const total = await prisma.post.count({ where });

    res.json({
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Create new post
router.post('/', async (req, res) => {
  try {
    const { error, value } = createPostSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { platform, caption, scheduledAt, videoId, workspaceId } = value;

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

    // Check if social account is connected for this platform
    const socialAccount = await prisma.socialAccount.findUnique({
      where: {
        userId_workspaceId_platform: {
          userId: req.user.id,
          workspaceId,
          platform
        }
      }
    });

    if (!socialAccount || !socialAccount.isConnected) {
      return res.status(400).json({ 
        error: `${platform} account not connected. Please connect your social media accounts first.`,
        code: 'ACCOUNT_NOT_CONNECTED'
      });
    }

    const post = await prisma.post.create({
      data: {
        platform,
        caption,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        videoId,
        workspaceId,
        userId: req.user.id,
        status: scheduledAt ? 'SCHEDULED' : 'DRAFT'
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            avatar: true
          }
        },
        video: {
          select: {
            title: true,
            thumbnailUrl: true,
            videoUrl: true
          }
        }
      }
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        userId: req.user.id,
        action: 'POST_CREATED',
        description: `Created ${platform} post${scheduledAt ? ' and scheduled' : ''}`,
        metadata: { postId: post.id, platform, workspaceId }
      }
    });

    res.status(201).json({ post });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Publish post immediately
router.post('/:postId/publish', async (req, res) => {
  try {
    const { postId } = req.params;
    
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        video: true,
        workspace: true
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check workspace access
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: post.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!member || member.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check social account connection
    const socialAccount = await prisma.socialAccount.findUnique({
      where: {
        userId_workspaceId_platform: {
          userId: post.userId,
          workspaceId: post.workspaceId,
          platform: post.platform
        }
      }
    });

    if (!socialAccount || !socialAccount.isConnected) {
      return res.status(400).json({ 
        error: `${post.platform} account not connected`,
        code: 'ACCOUNT_NOT_CONNECTED'
      });
    }

    // Generate profile ID for UploadPost
    const profileId = generateUploadPostProfileId(post.userId, post.workspaceId);

    // Post to social media via UploadPost API
    try {
      let uploadResponse;
      const baseOptions = {
        user: profileId,
        platforms: [post.platform.toLowerCase()],
        title: post.caption || (post.video ? post.video.title : 'Content Factory Post')
      };

      if (post.video && post.video.videoUrl) {
        // Video post
        uploadResponse = await uploadPostAPI.uploadVideo({
          ...baseOptions,
          video: post.video.videoUrl,
          description: post.caption
        });
      } else if (post.caption) {
        // Text post
        uploadResponse = await uploadPostAPI.uploadText({
          ...baseOptions,
          title: post.caption
        });
      } else {
        throw new Error('No content to publish');
      }

      if (uploadResponse) {
        const updatedPost = await prisma.post.update({
          where: { id: postId },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            platformPostId: uploadResponse.id || uploadResponse.post_id,
            metrics: uploadResponse
          },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                username: true,
                avatar: true
              }
            },
            video: {
              select: {
                title: true,
                thumbnailUrl: true
              }
            }
          }
        });

        // Create notification
        await prisma.notification.create({
          data: {
            userId: post.userId,
            type: 'POST_PUBLISHED',
            title: 'Post Published',
            message: `Your ${post.platform} post has been published successfully!`,
            data: { postId: post.id, platform: post.platform }
          }
        });

        // Create activity log
        await prisma.activity.create({
          data: {
            userId: req.user.id,
            action: 'POST_PUBLISHED',
            description: `Published ${post.platform} post`,
            metadata: { 
              postId: post.id, 
              platform: post.platform,
              workspaceId: post.workspaceId,
              platformPostId: updatedPost.platformPostId
            }
          }
        });

        res.json({ post: updatedPost });
      } else {
        throw new Error('No response from UploadPost API');
      }
    } catch (publishError) {
      console.error('Publish error:', publishError);
      
      await prisma.post.update({
        where: { id: postId },
        data: { status: 'FAILED' }
      });
      
      res.status(400).json({ 
        error: publishError.message || 'Failed to publish to social media',
        code: 'PUBLISH_FAILED'
      });
    }
  } catch (error) {
    console.error('Publish post error:', error);
    res.status(500).json({ error: 'Failed to publish post' });
  }
});

// Update post
router.put('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { caption, scheduledAt, status } = req.body;
    
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check workspace access
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: post.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!member || !['OWNER', 'ADMIN', 'EDITOR'].includes(member.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        ...(caption !== undefined && { caption }),
        ...(scheduledAt !== undefined && { scheduledAt: new Date(scheduledAt) }),
        ...(status !== undefined && { status })
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            avatar: true
          }
        },
        video: {
          select: {
            title: true,
            thumbnailUrl: true
          }
        }
      }
    });

    res.json({ post: updatedPost });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post
router.delete('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check workspace access
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: post.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!member || (!['OWNER', 'ADMIN'].includes(member.role) && post.userId !== req.user.id)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await prisma.post.update({
      where: { id: postId },
      data: { status: 'ARCHIVED' }
    });

    res.json({ message: 'Post archived successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to archive post' });
  }
});

// Get post analytics
router.get('/:postId/analytics', async (req, res) => {
  try {
    const { postId } = req.params;
    const { period = 'week' } = req.query;
    
    const startDate = new Date();
    switch (period) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const analytics = await prisma.postAnalytics.findMany({
      where: {
        postId,
        date: { gte: startDate }
      },
      orderBy: { date: 'asc' }
    });

    const summary = await prisma.postAnalytics.aggregate({
      where: {
        postId,
        date: { gte: startDate }
      },
      _sum: {
        impressions: true,
        reach: true,
        engagement: true,
        clicks: true,
        saves: true
      }
    });

    res.json({
      analytics,
      summary: {
        totalImpressions: summary._sum.impressions || 0,
        totalReach: summary._sum.reach || 0,
        totalEngagement: summary._sum.engagement || 0,
        totalClicks: summary._sum.clicks || 0,
        totalSaves: summary._sum.saves || 0
      }
    });
  } catch (error) {
    console.error('Post analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch post analytics' });
  }
});

// Check available platforms for workspace (connected social accounts)
router.get('/platforms/:workspaceId', validateWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    
    const connectedAccounts = await prisma.socialAccount.findMany({
      where: {
        workspaceId,
        userId: req.user.id,
        isConnected: true
      },
      select: {
        platform: true,
        displayName: true,
        username: true,
        profileImage: true
      }
    });

    const platformsMap = {
      INSTAGRAM: { name: 'Instagram', color: '#E4405F', icon: 'instagram' },
      TIKTOK: { name: 'TikTok', color: '#000000', icon: 'tiktok' },
      YOUTUBE: { name: 'YouTube', color: '#FF0000', icon: 'youtube' },
      FACEBOOK: { name: 'Facebook', color: '#1877F2', icon: 'facebook' },
      TWITTER: { name: 'X (Twitter)', color: '#1DA1F2', icon: 'twitter' },
      LINKEDIN: { name: 'LinkedIn', color: '#0A66C2', icon: 'linkedin' },
      THREADS: { name: 'Threads', color: '#000000', icon: 'threads' }
    };

    const availablePlatforms = connectedAccounts.map(account => ({
      platform: account.platform,
      displayName: account.displayName,
      username: account.username,
      profileImage: account.profileImage,
      ...platformsMap[account.platform]
    }));

    res.json({ platforms: availablePlatforms });
  } catch (error) {
    console.error('Get platforms error:', error);
    res.status(500).json({ error: 'Failed to fetch available platforms' });
  }
});

export default router;