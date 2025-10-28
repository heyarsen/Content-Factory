import express from 'express';
import { PrismaClient } from '@prisma/client';
import { validateWorkspaceAccess } from '../middleware/workspace.js';
import fetch from 'node-fetch';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createVideoSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(1000),
  topic: Joi.string().min(1).max(500).required(),
  style: Joi.string().valid('CASUAL', 'PROFESSIONAL', 'ENERGETIC', 'EDUCATIONAL').default('CASUAL'),
  duration: Joi.number().min(30).max(300).default(60),
  workspaceId: Joi.string().required(),
  settings: Joi.object().default({})
});

// Get workspace videos
router.get('/workspace/:workspaceId', validateWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { page = 1, limit = 20, status, style, search } = req.query;
    
    const where = { workspaceId };
    if (status) where.status = status;
    if (style) where.style = style;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { topic: { contains: search, mode: 'insensitive' } }
      ];
    }

    const videos = await prisma.video.findMany({
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
        posts: {
          select: {
            platform: true,
            status: true,
            publishedAt: true
          }
        },
        analytics: {
          select: {
            views: true,
            likes: true,
            comments: true,
            shares: true
          },
          orderBy: { date: 'desc' },
          take: 1
        },
        _count: {
          select: {
            comments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });

    const total = await prisma.video.count({ where });

    res.json({
      videos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Create new video
router.post('/', async (req, res) => {
  try {
    const { error, value } = createVideoSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { title, description, topic, style, duration, workspaceId, settings } = value;

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

    // Create video record
    const video = await prisma.video.create({
      data: {
        title,
        description,
        topic,
        style,
        duration,
        workspaceId,
        userId: req.user.id,
        settings,
        status: 'GENERATING'
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
      }
    });

    // Start HeyGen video generation
    try {
      const heygenResponse = await fetch('https://api.heygen.com/v1/video_generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HEYGEN_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topic,
          style: style.toLowerCase(),
          duration,
          title
        })
      });

      if (heygenResponse.ok) {
        const heygenData = await heygenResponse.json();
        
        await prisma.video.update({
          where: { id: video.id },
          data: {
            heygenId: heygenData.video_id,
            status: 'GENERATING'
          }
        });
      } else {
        await prisma.video.update({
          where: { id: video.id },
          data: { status: 'FAILED' }
        });
      }
    } catch (heygenError) {
      console.error('HeyGen API error:', heygenError);
      await prisma.video.update({
        where: { id: video.id },
        data: { status: 'FAILED' }
      });
    }

    // Create activity log
    await prisma.activity.create({
      data: {
        userId: req.user.id,
        action: 'VIDEO_CREATED',
        description: `Created video: ${title}`,
        metadata: { videoId: video.id, workspaceId }
      }
    });

    res.status(201).json({ video });
  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({ error: 'Failed to create video' });
  }
});

// Get video details
router.get('/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            avatar: true
          }
        },
        workspace: {
          select: {
            name: true,
            slug: true
          }
        },
        posts: {
          include: {
            analytics: {
              orderBy: { date: 'desc' },
              take: 1
            }
          }
        },
        analytics: {
          orderBy: { date: 'desc' },
          take: 30
        },
        comments: {
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
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check workspace access
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: video.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!member || member.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ video });
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Check video status and update if completed
router.get('/:videoId/status', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    const video = await prisma.video.findUnique({
      where: { id: videoId }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // If video is still generating and has HeyGen ID, check status
    if (video.status === 'GENERATING' && video.heygenId) {
      try {
        const statusResponse = await fetch(`https://api.heygen.com/v1/video_status?video_id=${video.heygenId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.HEYGEN_KEY}`
          }
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          
          if (statusData.status === 'completed') {
            const updatedVideo = await prisma.video.update({
              where: { id: videoId },
              data: {
                status: 'COMPLETED',
                videoUrl: statusData.video_url,
                thumbnailUrl: statusData.thumbnail_url,
                publishedAt: new Date()
              }
            });

            // Create notification
            await prisma.notification.create({
              data: {
                userId: video.userId,
                type: 'VIDEO_COMPLETED',
                title: 'Video Generation Complete',
                message: `Your video "${video.title}" has been generated successfully!`,
                data: { videoId: video.id }
              }
            });

            return res.json({ video: updatedVideo });
          } else if (statusData.status === 'failed') {
            await prisma.video.update({
              where: { id: videoId },
              data: { status: 'FAILED' }
            });
          }
        }
      } catch (heygenError) {
        console.error('HeyGen status check error:', heygenError);
      }
    }

    res.json({ video });
  } catch (error) {
    console.error('Video status error:', error);
    res.status(500).json({ error: 'Failed to check video status' });
  }
});

// Update video
router.put('/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { title, description, settings } = req.body;
    
    const video = await prisma.video.findUnique({
      where: { id: videoId }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check workspace access
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: video.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!member || !['OWNER', 'ADMIN', 'EDITOR'].includes(member.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const updatedVideo = await prisma.video.update({
      where: { id: videoId },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(settings && { settings })
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
      }
    });

    res.json({ video: updatedVideo });
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

// Delete video
router.delete('/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    const video = await prisma.video.findUnique({
      where: { id: videoId }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check workspace access
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: video.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!member || (!['OWNER', 'ADMIN'].includes(member.role) && video.userId !== req.user.id)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'ARCHIVED' }
    });

    res.json({ message: 'Video archived successfully' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: 'Failed to archive video' });
  }
});

export default router;