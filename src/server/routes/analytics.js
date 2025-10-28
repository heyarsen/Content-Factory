import express from 'express';
import { PrismaClient } from '@prisma/client';
import { validateWorkspaceAccess } from '../middleware/workspace.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get workspace analytics overview
router.get('/workspace/:workspaceId/overview', validateWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceId } = req.params;
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
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    // Get video metrics
    const videoMetrics = await prisma.videoAnalytics.aggregate({
      where: {
        video: { workspaceId },
        date: { gte: startDate }
      },
      _sum: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        reach: true
      },
      _count: true
    });

    // Get post metrics
    const postMetrics = await prisma.postAnalytics.aggregate({
      where: {
        post: { workspaceId },
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

    // Get top performing videos
    const topVideos = await prisma.video.findMany({
      where: { workspaceId },
      include: {
        analytics: {
          where: { date: { gte: startDate } },
          orderBy: { views: 'desc' }
        },
        user: { select: { firstName: true, lastName: true, username: true } }
      },
      orderBy: {
        analytics: {
          _count: 'desc'
        }
      },
      take: 5
    });

    // Get platform performance
    const platformPerformance = await prisma.post.groupBy({
      by: ['platform'],
      where: { workspaceId },
      _count: true,
      _avg: {
        analytics: {
          engagement: true,
          reach: true
        }
      }
    });

    res.json({
      period,
      videoMetrics: {
        totalViews: videoMetrics._sum.views || 0,
        totalLikes: videoMetrics._sum.likes || 0,
        totalComments: videoMetrics._sum.comments || 0,
        totalShares: videoMetrics._sum.shares || 0,
        totalReach: videoMetrics._sum.reach || 0,
        totalVideos: videoMetrics._count
      },
      postMetrics: {
        totalImpressions: postMetrics._sum.impressions || 0,
        totalReach: postMetrics._sum.reach || 0,
        totalEngagement: postMetrics._sum.engagement || 0,
        totalClicks: postMetrics._sum.clicks || 0,
        totalSaves: postMetrics._sum.saves || 0
      },
      topVideos,
      platformPerformance
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get video analytics details
router.get('/video/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
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

    const analytics = await prisma.videoAnalytics.findMany({
      where: {
        videoId,
        date: { gte: startDate }
      },
      orderBy: { date: 'asc' }
    });

    const summary = await prisma.videoAnalytics.aggregate({
      where: {
        videoId,
        date: { gte: startDate }
      },
      _sum: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        reach: true
      }
    });

    res.json({
      analytics,
      summary: {
        totalViews: summary._sum.views || 0,
        totalLikes: summary._sum.likes || 0,
        totalComments: summary._sum.comments || 0,
        totalShares: summary._sum.shares || 0,
        totalReach: summary._sum.reach || 0
      }
    });
  } catch (error) {
    console.error('Video analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch video analytics' });
  }
});

// Get analytics trends
router.get('/workspace/:workspaceId/trends', validateWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { metric = 'views', period = 'week' } = req.query;
    
    const startDate = new Date();
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 1;
    startDate.setDate(startDate.getDate() - days);

    const trends = await prisma.videoAnalytics.groupBy({
      by: ['date'],
      where: {
        video: { workspaceId },
        date: { gte: startDate }
      },
      _sum: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        reach: true
      },
      orderBy: { date: 'asc' }
    });

    const data = trends.map(item => ({
      date: item.date,
      value: item._sum[metric] || 0
    }));

    res.json({ metric, period, data });
  } catch (error) {
    console.error('Analytics trends error:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// Export analytics data
router.get('/workspace/:workspaceId/export', validateWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { startDate, endDate, format = 'json' } = req.query;
    
    const whereClause = {
      video: { workspaceId }
    };
    
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = new Date(startDate);
      if (endDate) whereClause.date.lte = new Date(endDate);
    }

    const analytics = await prisma.videoAnalytics.findMany({
      where: whereClause,
      include: {
        video: {
          select: {
            title: true,
            topic: true,
            style: true,
            user: {
              select: { firstName: true, lastName: true, username: true }
            }
          }
        }
      },
      orderBy: { date: 'desc' }
    });

    if (format === 'csv') {
      const csv = [
        'Date,Video Title,Topic,Style,Creator,Views,Likes,Comments,Shares,Reach',
        ...analytics.map(item => [
          item.date.toISOString().split('T')[0],
          item.video.title,
          item.video.topic,
          item.video.style,
          `${item.video.user.firstName || ''} ${item.video.user.lastName || ''}`.trim() || item.video.user.username,
          item.views,
          item.likes,
          item.comments,
          item.shares,
          item.reach
        ].join(','))
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv');
      return res.send(csv);
    }

    res.json({ analytics });
  } catch (error) {
    console.error('Analytics export error:', error);
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

export default router;