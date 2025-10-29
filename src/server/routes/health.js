import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Health check endpoint
router.get('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      database: {
        status: 'connected',
        responseTime: `${responseTime}ms`
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      },
      services: {
        database: 'healthy',
        auth: 'healthy',
        api: 'healthy'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      error: 'Database connection failed',
      database: {
        status: 'disconnected',
        error: error.message
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      },
      services: {
        database: 'unhealthy',
        auth: 'unknown',
        api: 'degraded'
      }
    });
  }
});

// Detailed health check with more information
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();
  const checks = {};
  
  try {
    // Database check
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'healthy',
      responseTime: `${Date.now() - dbStart}ms`
    };
    
    // Check user count
    const userCount = await prisma.user.count();
    checks.database.userCount = userCount;
    
    // Check workspace count
    const workspaceCount = await prisma.workspace.count();
    checks.database.workspaceCount = workspaceCount;
    
    // Check active sessions
    const activeSessionCount = await prisma.session.count({
      where: {
        expiresAt: {
          gt: new Date()
        }
      }
    });
    checks.database.activeSessionCount = activeSessionCount;
    
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: error.message
    };
  }
  
  // Environment checks
  checks.environment = {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    nodeEnv: process.env.NODE_ENV,
    jwtSecretSet: !!process.env.JWT_SECRET,
    databaseUrlSet: !!process.env.DATABASE_URL,
    frontendUrlSet: !!process.env.FRONTEND_URL
  };
  
  // Memory usage
  const memUsage = process.memoryUsage();
  checks.memory = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024),
    unit: 'MB'
  };
  
  const responseTime = Date.now() - startTime;
  const overallStatus = checks.database.status === 'healthy' ? 'healthy' : 'unhealthy';
  
  res.status(overallStatus === 'healthy' ? 200 : 503).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '2.0.0',
    uptime: process.uptime(),
    responseTime: `${responseTime}ms`,
    checks
  });
});

export default router;