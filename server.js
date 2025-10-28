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

// Create demo users (regular + admin) on startup
const createDemoUsers = () => {
  // Regular demo user
  const demoUser = {
    id: 'demo-user-id',
    firstName: 'Demo',
    lastName: 'User',
    email: 'demo@contentfactory.com',
    username: 'demouser',
    password: 'demo123', // NOTE: plain text for demo only
    role: 'USER',
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    emailVerified: true,
    status: 'ACTIVE'
  };
  const demoWorkspace = {
    id: 'demo-workspace-id',
    name: 'Demo Workspace',
    slug: 'demo-workspace',
    ownerId: demoUser.id,
    plan: 'FREE',
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  users.set(demoUser.email, demoUser);
  workspaces.set(demoWorkspace.id, demoWorkspace);

  // Admin user
  const adminUser = {
    id: 'admin-user-id',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@contentfactory.com',
    username: 'admin',
    password: 'admin123', // NOTE: plain text for demo only
    role: 'ADMIN',
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    emailVerified: true,
    status: 'ACTIVE'
  };
  const adminWorkspace = {
    id: 'admin-workspace-id',
    name: 'Admin Workspace',
    slug: 'admin-workspace',
    ownerId: adminUser.id,
    plan: 'ENTERPRISE',
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  users.set(adminUser.email, adminUser);
  workspaces.set(adminWorkspace.id, adminWorkspace);

  // Seed a couple of demo videos for charts and lists
  const seedVideos = [
    {
      id: 'seed-video-1',
      title: 'Welcome to Content Factory',
      topic: 'Quick tour of features',
      description: 'Overview video',
      style: 'PROFESSIONAL',
      duration: 90,
      status: 'COMPLETED',
      workspaceId: demoWorkspace.id,
      userId: demoUser.id,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      videoUrl: 'https://example.com/videos/seed-video-1.mp4',
      thumbnailUrl: ''
    },
    {
      id: 'seed-video-2',
      title: 'Posting to Platforms',
      topic: 'How posting works',
      description: 'Posting tutorial',
      style: 'EDUCATIONAL',
      duration: 60,
      status: 'PUBLISHED',
      workspaceId: demoWorkspace.id,
      userId: demoUser.id,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      videoUrl: 'https://example.com/videos/seed-video-2.mp4',
      thumbnailUrl: ''
    },
    {
      id: 'seed-video-3',
      title: 'Advanced Features Demo',
      topic: 'Advanced platform features',
      description: 'Demo of advanced features',
      style: 'CASUAL',
      duration: 120,
      status: 'GENERATING',
      workspaceId: demoWorkspace.id,
      userId: demoUser.id,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      videoUrl: null,
      thumbnailUrl: ''
    },
    {
      id: 'seed-video-4',
      title: 'Marketing Strategies',
      topic: 'Digital marketing tips',
      description: 'Marketing tutorial',
      style: 'PROFESSIONAL',
      duration: 180,
      status: 'FAILED',
      workspaceId: demoWorkspace.id,
      userId: demoUser.id,
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
      videoUrl: null,
      thumbnailUrl: ''
    }
  ];
  seedVideos.forEach(v => videos.set(v.id, v));

  // Create additional demo users for admin testing
  const additionalUsers = [
    {
      id: 'user-2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      username: 'janesmith',
      password: 'password123',
      role: 'USER',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      lastLoginAt: new Date(Date.now() - 3600000).toISOString(),
      emailVerified: true,
      status: 'ACTIVE'
    },
    {
      id: 'user-3',
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob@example.com',
      username: 'bobjohnson',
      password: 'password123',
      role: 'USER',
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      lastLoginAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      emailVerified: false,
      status: 'INACTIVE'
    },
    {
      id: 'user-4',
      firstName: 'Alice',
      lastName: 'Brown',
      email: 'alice@example.com',
      username: 'alicebrown',
      password: 'password123',
      role: 'USER',
      createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
      lastLoginAt: null,
      emailVerified: true,
      status: 'SUSPENDED'
    }
  ];

  additionalUsers.forEach(user => {
    users.set(user.email, user);
    // Create workspace for each user
    const userWorkspace = {
      id: `ws-${user.id}`,
      name: `${user.firstName}'s Workspace`,
      slug: `${user.username}-workspace`,
      ownerId: user.id,
      plan: 'FREE',
      status: 'ACTIVE',
      createdAt: user.createdAt
    };
    workspaces.set(userWorkspace.id, userWorkspace);

    // Add some videos for these users
    if (user.status === 'ACTIVE') {
      const userVideo = {
        id: `video-${user.id}-1`,
        title: `${user.firstName}'s First Video`,
        topic: 'Getting started with content creation',
        description: 'Introduction video',
        style: 'CASUAL',
        duration: 90,
        status: 'COMPLETED',
        workspaceId: userWorkspace.id,
        userId: user.id,
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        videoUrl: `https://example.com/videos/${user.id}-1.mp4`,
        thumbnailUrl: ''
      };
      videos.set(userVideo.id, userVideo);
    }
  });

  console.log('✅ Seeded demo accounts:');
  console.log('  - User  : demo@contentfactory.com / demo123');
  console.log('  - Admin : admin@contentfactory.com / admin123');
  console.log(`  - Total Users: ${users.size}`);
  console.log(`  - Total Videos: ${videos.size}`);
};

// Helper: token generator (demo)
const generateToken = (userId, workspaceId) => `token_${userId}_${workspaceId}_${Date.now()}`;

// Basic middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static assets (vite build)
app.use(express.static(path.join(__dirname, 'dist')));

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  const session = sessions.get(token);
  if (!session || session.expiresAt < new Date()) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  const user = users.get(session.userEmail);
  const workspace = Array.from(workspaces.values()).find(w => w.ownerId === user?.id);
  if (!user || !workspace) return res.status(401).json({ error: 'Unauthorized' });

  req.user = user; req.workspace = workspace; req.token = token; next();
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(), 
    users: users.size, 
    videos: videos.size,
    sessions: sessions.size
  });
});

// Auth
app.post('/api/auth/register', (req, res) => {
  try {
    const { firstName, lastName, email, username, password, workspaceName } = req.body;
    if (!firstName || !lastName || !email || !username || !password || !workspaceName) return res.status(400).json({ error: 'All fields are required' });
    const lower = email.toLowerCase();
    if (users.has(lower)) return res.status(400).json({ error: 'Email already exists' });

    const userId = `user_${Date.now()}`;
    const wsId = `ws_${Date.now()}`;
    const newUser = { id: userId, firstName, lastName, email: lower, username, password, role: 'USER', createdAt: new Date().toISOString(), status: 'ACTIVE', emailVerified: false, lastLoginAt: null };
    const ws = { id: wsId, name: workspaceName, slug: `${username}-workspace`, ownerId: userId, plan: 'FREE', status: 'ACTIVE', createdAt: new Date().toISOString() };

    users.set(lower, newUser); workspaces.set(wsId, ws);

    const token = generateToken(userId, wsId);
    sessions.set(token, { userId, userEmail: lower, workspaceId: wsId, expiresAt: new Date(Date.now() + 7*24*60*60*1000), createdAt: new Date() });
    newUser.lastLoginAt = new Date().toISOString();
    const { password: _, ...safeUser } = newUser;
    res.status(201).json({ success: true, user: safeUser, workspace: ws, token });
  } catch (e) { res.status(500).json({ error: 'Registration failed' }); }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body; if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const lower = email.toLowerCase();
    const user = users.get(lower); if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid email or password' });
    if (user.status !== 'ACTIVE') return res.status(401).json({ error: 'Account inactive' });

    const workspace = Array.from(workspaces.values()).find(w => w.ownerId === user.id);
    if (!workspace) return res.status(400).json({ error: 'No workspace found' });

    const token = generateToken(user.id, workspace.id);
    sessions.set(token, { userId: user.id, userEmail: lower, workspaceId: workspace.id, expiresAt: new Date(Date.now() + 7*24*60*60*1000), createdAt: new Date() });
    user.lastLoginAt = new Date().toISOString();
    const { password: _, ...safeUser } = user;
    res.json({ success: true, user: safeUser, workspace, token });
  } catch (e) { res.status(500).json({ error: 'Login failed' }); }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  const { password: _, ...safeUser } = req.user; res.json({ success: true, user: safeUser, workspace: req.workspace });
});

app.post('/api/auth/logout', authenticateToken, (req, res) => { sessions.delete(req.token); res.json({ success: true }); });

// Admin APIs
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const allUsers = Array.from(users.values());
    const allVideos = Array.from(videos.values());
    
    // Calculate time-based filters
    const now = new Date();
    let startDate;
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const newUsersThisPeriod = allUsers.filter(u => 
      new Date(u.createdAt) >= startDate
    ).length;

    const newVideosThisPeriod = allVideos.filter(v => 
      new Date(v.createdAt) >= startDate
    ).length;

    const stats = {
      totalUsers: allUsers.length,
      activeUsers: allUsers.filter(u => u.status === 'ACTIVE').length,
      totalVideos: allVideos.length,
      completedVideos: allVideos.filter(v => v.status === 'COMPLETED' || v.status === 'PUBLISHED').length,
      publishedVideos: allVideos.filter(v => v.status === 'PUBLISHED').length,
      sessions: sessions.size,
      newUsersThisPeriod,
      newVideosThisPeriod,
      revenue: 0, // Mock data
      revenueGrowth: 0, // Mock data
      mrr: 0, // Mock data
      totalSessions: sessions.size,
      avgSessionTime: '15min' // Mock data
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const data = Array.from(users.values()).map(u => { 
      const { password, ...rest } = u; 
      return rest; 
    });
    res.json({ success: true, users: data });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.put('/api/admin/users/:id/status', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params; 
    const { status } = req.body;
    
    if (!['ACTIVE','INACTIVE','SUSPENDED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const entry = Array.from(users.entries()).find(([email,u]) => u.id === id);
    if (!entry) return res.status(404).json({ error: 'User not found' });
    
    const [email, u] = entry; 
    u.status = status; 
    users.set(email, u);
    
    const { password, ...rest } = u; 
    res.json({ success: true, user: rest });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const entry = Array.from(users.entries()).find(([email,u]) => u.id === id);
    if (!entry) return res.status(404).json({ error: 'User not found' });
    
    const [email, u] = entry; 
    if (u.role === 'ADMIN') return res.status(403).json({ error: 'Cannot delete admin user' });
    
    users.delete(email);
    
    // delete workspace
    const wsEntry = Array.from(workspaces.entries()).find(([wsId, w]) => w.ownerId === id);
    if (wsEntry) workspaces.delete(wsEntry[0]);
    
    // delete videos
    Array.from(videos.entries()).forEach(([vid, v]) => { 
      if (v.userId === id) videos.delete(vid); 
    });
    
    // delete sessions
    Array.from(sessions.entries()).forEach(([tok, s]) => { 
      if (s.userId === id) sessions.delete(tok); 
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.get('/api/admin/videos', authenticateToken, requireAdmin, (req, res) => {
  try {
    res.json({ success: true, videos: Array.from(videos.values()) });
  } catch (error) {
    console.error('Admin videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// User video APIs
app.get('/api/videos', authenticateToken, (req, res) => {
  try {
    const list = Array.from(videos.values()).filter(v => v.workspaceId === req.workspace.id);
    res.json({ success: true, videos: list });
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

app.post('/api/videos', authenticateToken, (req, res) => {
  try {
    const { title, topic, style, duration, description } = req.body;
    if (!title || !topic) return res.status(400).json({ error: 'Title and topic are required' });
    
    const id = `video_${Date.now()}`;
    const v = { 
      id, 
      title, 
      topic, 
      description: description||'', 
      style: style||'CASUAL', 
      duration: parseInt(duration)||60, 
      status: 'GENERATING', 
      workspaceId: req.workspace.id, 
      userId: req.user.id, 
      createdAt: new Date().toISOString(), 
      updatedAt: new Date().toISOString(), 
      videoUrl: null 
    };
    videos.set(id, v);
    
    // Simulate video generation
    setTimeout(() => { 
      const cur = videos.get(id); 
      if (cur){ 
        cur.status='COMPLETED'; 
        cur.videoUrl=`https://example.com/videos/${id}.mp4`; 
        cur.updatedAt = new Date().toISOString(); 
      } 
    }, 4000);
    
    res.status(201).json({ success: true, video: v });
  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({ error: 'Failed to create video' });
  }
});

app.get('/api/videos/:id/status', authenticateToken, (req, res) => {
  try {
    const v = videos.get(req.params.id); 
    if (!v || v.workspaceId !== req.workspace.id) {
      return res.status(404).json({ error: 'Video not found' });
    }
    res.json({ success: true, video: v });
  } catch (error) {
    console.error('Get video status error:', error);
    res.status(500).json({ error: 'Failed to get video status' });
  }
});

app.delete('/api/videos/:id', authenticateToken, (req, res) => {
  try {
    const v = videos.get(req.params.id); 
    if (!v || v.workspaceId !== req.workspace.id) {
      return res.status(404).json({ error: 'Video not found' });
    }
    videos.delete(req.params.id); 
    res.json({ success: true });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

app.post('/api/videos/bulk-delete', authenticateToken, (req, res) => {
  try {
    const { video_ids } = req.body; 
    if (!Array.isArray(video_ids)) {
      return res.status(400).json({ error: 'video_ids array required' });
    }
    
    let count = 0; 
    video_ids.forEach(id => { 
      const v = videos.get(id); 
      if (v && v.workspaceId === req.workspace.id){ 
        videos.delete(id); 
        count++; 
      }
    });
    
    res.json({ success: true, deletedCount: count });
  } catch (error) {
    console.error('Bulk delete videos error:', error);
    res.status(500).json({ error: 'Failed to delete videos' });
  }
});

app.post('/api/videos/clear-all', authenticateToken, (req, res) => {
  try {
    const toDelete = Array.from(videos.entries()).filter(([id,v]) => v.workspaceId === req.workspace.id);
    toDelete.forEach(([id]) => videos.delete(id)); 
    res.json({ success: true, deletedCount: toDelete.length });
  } catch (error) {
    console.error('Clear all videos error:', error);
    res.status(500).json({ error: 'Failed to clear videos' });
  }
});

// Social accounts (mock)
app.get('/api/social-accounts', authenticateToken, (req, res) => { 
  const accounts = socialAccounts.get(req.user.id) || [];
  res.json({ success: true, accounts }); 
});

app.post('/api/social-accounts/connect', authenticateToken, (req, res) => { 
  res.json({ success: true, auth_url: 'https://auth.example.com/mock' }); 
});

// Posts (mock)
app.post('/api/posts', authenticateToken, (req, res) => { 
  try {
    const { videoId, platforms } = req.body; 
    const v = videos.get(videoId); 
    if (!v) return res.status(404).json({ error: 'Video not found' });
    if (!v.videoUrl) return res.status(400).json({ error: 'Video not ready' }); 
    
    v.status='PUBLISHED'; 
    v.updatedAt=new Date().toISOString(); 
    res.json({ success: true }); 
  } catch (error) {
    console.error('Post video error:', error);
    res.status(500).json({ error: 'Failed to post video' });
  }
});

// Legacy pointers
app.post('/api/connect-accounts', (req,res)=>res.json({ message:'Use /api/social-accounts/connect' }));
app.get('/api/accounts/:username', (req,res)=>res.json({ message:'Use /api/social-accounts' }));
app.post('/api/create-video', (req,res)=>res.json({ message:'Use /api/videos' }));
app.get('/api/video-status/:id', (req,res)=>res.json({ message:'Use /api/videos/:id/status' }));
app.post('/api/post-video', (req,res)=>res.json({ message:'Use /api/posts' }));

// SPA fallback
app.get('*', (req, res) => { 
  res.sendFile(path.join(__dirname, 'dist/index.html')); 
});

// Start server
app.listen(PORT, () => {
  createDemoUsers();
  console.log(`🚀 Server on :${PORT}`);
  console.log('🔐 Accounts: demo@contentfactory.com/demo123 | admin@contentfactory.com/admin123');
  console.log('👑 Admin Panel: Login as admin to access admin dashboard');
  console.log('📊 Features: User management, video analytics, system monitoring');
});

export default app;