import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// In-memory storage for demo purposes (replace with database in production)
const users = new Map();
const sessions = new Map();
const workspaces = new Map();
const videos = new Map();
const socialAccounts = new Map();

// Create demo user on startup
const createDemoUser = () => {
  const demoUser = {
    id: 'demo-user-id',
    firstName: 'Demo',
    lastName: 'User',
    email: 'demo@contentfactory.com',
    username: 'demouser',
    password: 'demo123', // In production, this should be hashed
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    emailVerified: true,
    status: 'ACTIVE'
  };
  
  const demoWorkspace = {
    id: 'demo-workspace-id',
    name: 'Demo Workspace',
    slug: 'demo-workspace',
    ownerId: 'demo-user-id',
    plan: 'FREE',
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };
  
  users.set('demo@contentfactory.com', demoUser);
  workspaces.set('demo-workspace-id', demoWorkspace);
  
  // Add some demo social accounts
  socialAccounts.set('demo-user-id', [
    {
      id: 'demo-insta-1',
      platform: 'INSTAGRAM',
      username: 'demo_insta',
      account_name: 'Demo User',
      status: 'active',
      connected_at: new Date().toISOString()
    },
    {
      id: 'demo-youtube-1',
      platform: 'YOUTUBE',
      username: 'demo_youtube',
      account_name: 'Demo Channel',
      status: 'active',
      connected_at: new Date().toISOString()
    }
  ]);
  
  console.log('✅ Demo user created:');
  console.log('   Email: demo@contentfactory.com');
  console.log('   Password: demo123');
};

// Helper function to generate tokens (simplified)
const generateToken = (userId, workspaceId) => {
  return `token_${userId}_${workspaceId}_${Date.now()}`;
};

// Basic middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt < new Date()) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = users.get(session.userEmail);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  const workspace = workspaces.get(session.workspaceId);
  if (!workspace) {
    return res.status(401).json({ error: 'Workspace not found' });
  }

  req.user = user;
  req.workspace = workspace;
  req.token = token;
  next();
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '3.0.0',
    users_count: users.size,
    active_sessions: sessions.size
  });
});

// Authentication Routes
app.post('/api/auth/register', (req, res) => {
  try {
    const { firstName, lastName, email, username, password, workspaceName } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !username || !password || !workspaceName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    if (users.has(email.toLowerCase())) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Create user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const workspaceId = `workspace_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const user = {
      id: userId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      username: username.toLowerCase().trim(),
      password: password, // In production, hash this
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      emailVerified: false,
      status: 'ACTIVE'
    };

    const workspace = {
      id: workspaceId,
      name: workspaceName.trim(),
      slug: username.toLowerCase().trim() + '-workspace',
      ownerId: userId,
      plan: 'FREE',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    users.set(email.toLowerCase(), user);
    workspaces.set(workspaceId, workspace);

    // Generate token
    const token = generateToken(userId, workspaceId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    sessions.set(token, {
      userId,
      userEmail: email.toLowerCase(),
      workspaceId,
      expiresAt,
      createdAt: new Date()
    });

    // Update lastLoginAt
    user.lastLoginAt = new Date().toISOString();

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: userWithoutPassword,
      workspace,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = users.get(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password (in production, use bcrypt.compare)
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check user status
    if (user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Account is inactive. Please contact support.' });
    }

    // Find workspace
    const workspace = Array.from(workspaces.values()).find(w => w.ownerId === user.id);
    if (!workspace) {
      return res.status(400).json({ error: 'No workspace found' });
    }

    // Generate token
    const token = generateToken(user.id, workspace.id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    sessions.set(token, {
      userId: user.id,
      userEmail: email.toLowerCase(),
      workspaceId: workspace.id,
      expiresAt,
      createdAt: new Date()
    });

    // Update lastLoginAt
    user.lastLoginAt = new Date().toISOString();

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      user: userWithoutPassword,
      workspace,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  const { password: _, ...userWithoutPassword } = req.user;
  res.json({
    success: true,
    user: userWithoutPassword,
    workspace: req.workspace
  });
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  try {
    sessions.delete(req.token);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Video Routes
app.get('/api/videos', authenticateToken, (req, res) => {
  try {
    const userVideos = Array.from(videos.values()).filter(v => v.workspaceId === req.workspace.id);
    
    res.json({
      success: true,
      videos: userVideos
    });
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

app.post('/api/videos', authenticateToken, (req, res) => {
  try {
    const { title, topic, style, duration, description } = req.body;

    if (!topic || !title) {
      return res.status(400).json({ error: 'Title and topic are required' });
    }

    const videoId = `video_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const video = {
      id: videoId,
      title: title.trim(),
      topic: topic.trim(),
      description: description?.trim() || '',
      style: style || 'CASUAL',
      duration: parseInt(duration) || 60,
      status: 'GENERATING',
      workspaceId: req.workspace.id,
      userId: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      videoUrl: null,
      thumbnailUrl: null
    };

    videos.set(videoId, video);

    // Simulate video generation
    setTimeout(() => {
      const existingVideo = videos.get(videoId);
      if (existingVideo) {
        existingVideo.status = 'COMPLETED';
        existingVideo.videoUrl = `https://example.com/videos/${videoId}.mp4`;
        existingVideo.thumbnailUrl = `https://example.com/thumbnails/${videoId}.jpg`;
        existingVideo.updatedAt = new Date().toISOString();
      }
    }, 5000); // 5 second simulation

    res.status(201).json({
      success: true,
      message: 'Video creation started',
      video
    });
  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({ error: 'Failed to create video' });
  }
});

app.get('/api/videos/:id/status', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const video = videos.get(id);

    if (!video || video.workspaceId !== req.workspace.id) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({
      success: true,
      video
    });
  } catch (error) {
    console.error('Get video status error:', error);
    res.status(500).json({ error: 'Failed to get video status' });
  }
});

app.delete('/api/videos/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const video = videos.get(id);

    if (!video || video.workspaceId !== req.workspace.id) {
      return res.status(404).json({ error: 'Video not found' });
    }

    videos.delete(id);

    res.json({
      success: true,
      message: 'Video deleted successfully'
    });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

app.post('/api/videos/bulk-delete', authenticateToken, (req, res) => {
  try {
    const { video_ids } = req.body;

    if (!video_ids || !Array.isArray(video_ids) || video_ids.length === 0) {
      return res.status(400).json({ error: 'Video IDs array is required' });
    }

    let deletedCount = 0;
    video_ids.forEach(id => {
      const video = videos.get(id);
      if (video && video.workspaceId === req.workspace.id) {
        videos.delete(id);
        deletedCount++;
      }
    });

    res.json({
      success: true,
      message: `${deletedCount} videos deleted successfully`,
      deletedCount
    });
  } catch (error) {
    console.error('Bulk delete videos error:', error);
    res.status(500).json({ error: 'Failed to delete videos' });
  }
});

app.post('/api/videos/clear-all', authenticateToken, (req, res) => {
  try {
    const userVideos = Array.from(videos.entries()).filter(([id, video]) => video.workspaceId === req.workspace.id);
    
    userVideos.forEach(([id]) => {
      videos.delete(id);
    });

    res.json({
      success: true,
      message: `All ${userVideos.length} videos cleared successfully`,
      deletedCount: userVideos.length
    });
  } catch (error) {
    console.error('Clear all videos error:', error);
    res.status(500).json({ error: 'Failed to clear videos' });
  }
});

// Social Accounts Routes
app.get('/api/social-accounts', authenticateToken, (req, res) => {
  try {
    const accounts = socialAccounts.get(req.user.id) || [];
    
    res.json({
      success: true,
      accounts
    });
  } catch (error) {
    console.error('Get social accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch social accounts' });
  }
});

app.post('/api/social-accounts/connect', authenticateToken, (req, res) => {
  try {
    // Simulate OAuth URL generation
    const authUrl = `https://api.instagram.com/oauth/authorize?client_id=demo&redirect_uri=http://localhost:4000/auth/callback&response_type=code`;

    res.json({
      success: true,
      message: 'Social account connection initiated',
      auth_url: authUrl
    });
  } catch (error) {
    console.error('Connect social account error:', error);
    res.status(500).json({ error: 'Failed to connect social account' });
  }
});

// Posts Routes
app.post('/api/posts', authenticateToken, (req, res) => {
  try {
    const { videoId, caption, platforms } = req.body;

    if (!videoId || !platforms || platforms.length === 0) {
      return res.status(400).json({ error: 'Video ID and platforms are required' });
    }

    const video = videos.get(videoId);
    if (!video || video.workspaceId !== req.workspace.id) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (!video.videoUrl) {
      return res.status(400).json({ error: 'Video URL not available' });
    }

    // Update video status
    video.status = 'PUBLISHED';
    video.updatedAt = new Date().toISOString();

    res.json({
      success: true,
      message: `Video posted to ${platforms.length} platforms successfully`,
      platforms
    });
  } catch (error) {
    console.error('Post video error:', error);
    res.status(500).json({ error: 'Failed to post video' });
  }
});

// Legacy endpoints for backward compatibility
app.post('/api/connect-accounts', (req, res) => {
  res.json({ message: 'Please use /api/social-accounts/connect instead' });
});

app.get('/api/accounts/:username', (req, res) => {
  res.json({ message: 'Please use /api/social-accounts instead' });
});

app.post('/api/create-video', (req, res) => {
  res.json({ message: 'Please use /api/videos instead' });
});

app.get('/api/video-status/:id', (req, res) => {
  res.json({ message: 'Please use /api/videos/:id/status instead' });
});

app.post('/api/post-video', (req, res) => {
  res.json({ message: 'Please use /api/posts instead' });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Content Factory API is running!',
    timestamp: new Date().toISOString(),
    stats: {
      users: users.size,
      workspaces: workspaces.size,
      videos: videos.size,
      sessions: sessions.size
    }
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

// Initialize demo data and start server
app.listen(PORT, () => {
  // Create demo user
  createDemoUser();
  
  console.log(`🚀 Content Factory Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log('\n🔐 Authentication Endpoints:');
  console.log('  POST /api/auth/register - Register new user');
  console.log('  POST /api/auth/login - Login user');
  console.log('  GET  /api/auth/verify - Verify token');
  console.log('  POST /api/auth/logout - Logout user');
  console.log('\n🎥 Video Endpoints:');
  console.log('  GET  /api/videos - List user videos');
  console.log('  POST /api/videos - Create new video');
  console.log('  GET  /api/videos/:id/status - Get video status');
  console.log('  DELETE /api/videos/:id - Delete video');
  console.log('  POST /api/videos/bulk-delete - Delete multiple videos');
  console.log('  POST /api/videos/clear-all - Clear all videos');
  console.log('\n🌐 Social Media Endpoints:');
  console.log('  GET  /api/social-accounts - List connected accounts');
  console.log('  POST /api/social-accounts/connect - Connect social account');
  console.log('  POST /api/posts - Post video to social media');
  console.log('\n🔧 Utility:');
  console.log('  GET  /api/health - Health check');
  console.log('  GET  /api/test - Test endpoint');
  console.log('\n🎯 Ready to use! Try logging in with:');
  console.log('  Email: demo@contentfactory.com');
  console.log('  Password: demo123\n');
});

export default app;