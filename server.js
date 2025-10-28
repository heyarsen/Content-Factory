import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Basic middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.1.0'
  });
});

// Basic API endpoints for testing
app.get('/api/test', (req, res) => {
  res.json({ message: 'Content Factory API is running!' });
});

// Legacy endpoints for backward compatibility
app.post('/api/connect-accounts', (req, res) => {
  res.json({ message: 'Account connection endpoint - to be implemented with authentication' });
});

app.get('/api/accounts/:username', (req, res) => {
  res.json({ message: 'Account details endpoint - to be implemented with authentication' });
});

app.post('/api/create-video', (req, res) => {
  const { topic, style, duration } = req.body;
  
  if (!topic) {
    return res.status(400).json({ 
      success: false, 
      error: 'Video topic is required' 
    });
  }
  
  // Simulate video creation
  const videoId = `video_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  
  res.json({ 
    success: true,
    video_id: videoId,
    message: 'Video creation started',
    data: {
      video_id: videoId,
      topic,
      style: style || 'casual',
      duration: duration || 60,
      status: 'generating',
      created_at: new Date().toISOString()
    }
  });
});

app.get('/api/video-status/:id', (req, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ 
      success: false, 
      error: 'Video ID is required' 
    });
  }
  
  // Simulate random status progression
  const statuses = ['generating', 'processing', 'completed', 'failed'];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  
  const response = {
    success: true,
    video_id: id,
    status: randomStatus,
    data: {
      status: randomStatus,
      video_id: id,
      updated_at: new Date().toISOString()
    }
  };
  
  // Add video URL if completed
  if (randomStatus === 'completed') {
    response.data.video_url = `https://example.com/videos/${id}.mp4`;
    response.video_url = response.data.video_url;
  }
  
  res.json(response);
});

app.post('/api/post-video', (req, res) => {
  const { username, video_url, caption, platforms } = req.body;
  
  if (!username || !video_url || !platforms || platforms.length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Username, video URL, and platforms are required' 
    });
  }
  
  res.json({ 
    success: true,
    message: `Video posted to ${platforms.length} platforms successfully`,
    data: {
      platforms,
      posted_at: new Date().toISOString(),
      post_id: `post_${Date.now()}`
    }
  });
});

// Enhanced video management endpoints
app.delete('/api/videos/:id', (req, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ 
      success: false, 
      error: 'Video ID is required' 
    });
  }
  
  // In a real implementation, this would delete from database
  // For now, we just confirm the deletion request
  res.json({ 
    success: true,
    message: 'Video deleted successfully',
    video_id: id,
    deleted_at: new Date().toISOString()
  });
});

app.post('/api/videos/bulk-delete', (req, res) => {
  const { video_ids } = req.body;
  
  if (!video_ids || !Array.isArray(video_ids) || video_ids.length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Array of video IDs is required' 
    });
  }
  
  // In a real implementation, this would delete multiple videos from database
  res.json({ 
    success: true,
    message: `${video_ids.length} videos deleted successfully`,
    deleted_count: video_ids.length,
    video_ids,
    deleted_at: new Date().toISOString()
  });
});

app.get('/api/videos', (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    status, 
    search, 
    sort_by = 'created_at', 
    sort_order = 'desc' 
  } = req.query;
  
  // In a real implementation, this would query the database
  // For now, return a mock response
  res.json({
    success: true,
    data: {
      videos: [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0,
        total_pages: 0
      },
      filters: {
        status: status || null,
        search: search || null,
        sort_by,
        sort_order
      }
    }
  });
});

app.post('/api/videos/clear-all', (req, res) => {
  // In a real implementation, this would clear all videos for a user
  res.json({ 
    success: true,
    message: 'All videos cleared successfully',
    cleared_at: new Date().toISOString()
  });
});

// Video analytics endpoint
app.get('/api/videos/analytics', (req, res) => {
  const { timeframe = '30d' } = req.query;
  
  // Mock analytics data
  res.json({
    success: true,
    data: {
      timeframe,
      total_videos: 0,
      completed_videos: 0,
      posted_videos: 0,
      failed_videos: 0,
      average_duration: 0,
      popular_styles: [],
      platform_distribution: {},
      daily_stats: [],
      generated_at: new Date().toISOString()
    }
  });
});

// Error handling for video operations
app.use('/api/videos/*', (err, req, res, next) => {
  console.error('Video operation error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Video operation failed',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Catch-all handler for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Content Factory Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log('\n📝 API Endpoints:');
  console.log('  GET  /api/health - Health check');
  console.log('  GET  /api/test - Test endpoint');
  console.log('  POST /api/create-video - Create new video');
  console.log('  GET  /api/video-status/:id - Get video status');
  console.log('  POST /api/post-video - Post video to social media');
  console.log('  DELETE /api/videos/:id - Delete single video');
  console.log('  POST /api/videos/bulk-delete - Delete multiple videos');
  console.log('  GET  /api/videos - List videos with filters');
  console.log('  POST /api/videos/clear-all - Clear all videos');
  console.log('  GET  /api/videos/analytics - Get video analytics');
  console.log('\n🔧 Next steps:');
  console.log('1. Set up database: npx prisma migrate dev --name init');
  console.log('2. Generate Prisma client: npx prisma generate');
  console.log('3. Set environment variables in .env file');
  console.log('4. Restart server to enable full functionality\n');
});

export default app;