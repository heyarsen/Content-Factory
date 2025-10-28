import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import winston from 'winston';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Routes
import authRoutes from './src/server/routes/auth.js';
import userRoutes from './src/server/routes/users.js';
import workspaceRoutes from './src/server/routes/workspaces.js';
import videoRoutes from './src/server/routes/videos.js';
import analyticsRoutes from './src/server/routes/analytics.js';
import calendarRoutes from './src/server/routes/calendar.js';
import postRoutes from './src/server/routes/posts.js';
import notificationRoutes from './src/server/routes/notifications.js';

// Middleware
import { authenticateToken } from './src/server/middleware/auth.js';
import { validateWorkspaceAccess } from './src/server/middleware/workspace.js';
import { errorHandler } from './src/server/middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'content-factory' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'dist')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/workspaces', authenticateToken, workspaceRoutes);
app.use('/api/videos', authenticateToken, videoRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/calendar', authenticateToken, calendarRoutes);
app.use('/api/posts', authenticateToken, postRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({ 
      status: 'unhealthy', 
      error: 'Database connection failed' 
    });
  }
});

// Socket.IO for real-time features
io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.id}`);
  
  socket.on('join-workspace', (workspaceId) => {
    socket.join(`workspace-${workspaceId}`);
    logger.info(`User ${socket.id} joined workspace ${workspaceId}`);
  });
  
  socket.on('leave-workspace', (workspaceId) => {
    socket.leave(`workspace-${workspaceId}`);
    logger.info(`User ${socket.id} left workspace ${workspaceId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.id}`);
  });
});

// Analytics data collection cron job
cron.schedule('0 0 * * *', async () => {
  logger.info('Running daily analytics collection...');
  try {
    // Collect video analytics
    const videos = await prisma.video.findMany({
      where: { status: 'COMPLETED' },
      include: { posts: true }
    });
    
    for (const video of videos) {
      // Simulate analytics data collection
      // In real implementation, this would fetch from social media APIs
      const analyticsData = {
        views: Math.floor(Math.random() * 10000),
        likes: Math.floor(Math.random() * 1000),
        comments: Math.floor(Math.random() * 100),
        shares: Math.floor(Math.random() * 500),
        reach: Math.floor(Math.random() * 15000)
      };
      
      await prisma.videoAnalytics.upsert({
        where: {
          videoId_date: {
            videoId: video.id,
            date: new Date()
          }
        },
        update: analyticsData,
        create: {
          videoId: video.id,
          date: new Date(),
          ...analyticsData
        }
      });
    }
    
    logger.info('Daily analytics collection completed');
  } catch (error) {
    logger.error('Analytics collection failed:', error);
  }
});

// Notification cleanup cron job
cron.schedule('0 2 * * *', async () => {
  logger.info('Cleaning up old notifications...');
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
        read: true
      }
    });
    
    logger.info('Notification cleanup completed');
  } catch (error) {
    logger.error('Notification cleanup failed:', error);
  }
});

// Error handling middleware
app.use(errorHandler);

// Serve React app for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

// Graceful shutdowns
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    prisma.$disconnect();
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  logger.info(`🚀 Content Factory Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});

// Export for testing
export { app, io, prisma };