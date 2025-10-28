import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// In-memory storage for demo purposes (replace with database in production)
const users = new Map();
const sessions = new Map();
const workspaces = new Map();
const videos = new Map();
const socialAccounts = new Map();

class UploadPostAPI {
  constructor() {
    this.apiKey = process.env.UPLOADPOST_KEY;
    this.baseURL = 'https://api.upload-post.com/api';
  }
  authHeaders(json=true){
    const h = { 'Authorization': `Apikey ${this.apiKey}` };
    return json ? { ...h, 'Content-Type': 'application/json' } : h;
  }
  async getUser(userId){
    const res = await fetch(`${this.baseURL}/uploadposts/users?user_id=${encodeURIComponent(userId)}`, { headers: this.authHeaders(false) });
    if (!res.ok) return null;
    const data = await res.json();
    const list = data?.profiles || data?.users || [];
    return list[0] || null;
  }
  async ensureUser(user){
    const exists = await this.getUser(user.id);
    if (exists) return exists;
    const res = await fetch(`${this.baseURL}/uploadposts/users`, { method: 'POST', headers: this.authHeaders(), body: JSON.stringify({ user_id: user.id, email: user.email, name: `${user.firstName||''} ${user.lastName||''}`.trim() }) });
    if (!res.ok){ const err = await res.json().catch(()=>({message:`HTTP ${res.status}`})); throw new Error(err.message); }
    return await res.json();
  }
  async generateJWT(userId){
    const res = await fetch(`${this.baseURL}/uploadposts/users/generate-jwt`, { method:'POST', headers: this.authHeaders(), body: JSON.stringify({ user_id: userId })});
    if (!res.ok){ const err = await res.json().catch(()=>({message:`HTTP ${res.status}`})); throw new Error(err.message); }
    const data = await res.json();
    return data.jwt || data.token;
  }
  async getAccounts(userId){
    const res = await fetch(`${this.baseURL}/uploadposts/users?user_id=${encodeURIComponent(userId)}`, { headers: this.authHeaders(false) });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.profiles || data?.users || [];
    return list.map(p=>({ id: p.profile_id||p.id, platform: (p.platform||'').toLowerCase(), username: p.username||p.handle, displayName: p.display_name||p.name, isConnected: p.is_active!==false, profileImage: p.profile_image||p.avatar_url, connectedAt: p.connected_at||p.created_at }));
  }
}

const uploadPost = new UploadPostAPI();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.upload-post.com"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', 
  credentials: true 
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// Utility functions
const generateToken = (userId, workspaceId) => {
  return jwt.sign(
    { userId, workspaceId, timestamp: Date.now() },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12);
};

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = Array.from(users.values()).find(u => u.id === decoded.userId);
    const workspace = workspaces.get(decoded.workspaceId);
    
    if (!user || !workspace) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = user;
    req.workspace = workspace;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Seed demo users
const createDemoUsers = async () => {
  const hashedPassword = await hashPassword('demo123');
  const demoUser = {
    id: 'demo-user-id',
    firstName: 'Demo',
    lastName: 'User',
    email: 'demo@contentfabrica.com',
    username: 'demouser',
    password: hashedPassword,
    role: 'USER',
    createdAt: new Date().toISOString(),
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
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, username } = req.body;
    
    // Validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (users.has(email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Create user
    const hashedPassword = await hashPassword(password);
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const workspaceId = `workspace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const user = {
      id: userId,
      firstName,
      lastName,
      email,
      username: username || email.split('@')[0],
      password: hashedPassword,
      role: 'USER',
      createdAt: new Date().toISOString(),
      emailVerified: false,
      status: 'ACTIVE'
    };
    
    const workspace = {
      id: workspaceId,
      name: `${firstName}'s Workspace`,
      slug: `${firstName.toLowerCase()}-workspace`,
      ownerId: userId,
      plan: 'FREE',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    
    users.set(email, user);
    workspaces.set(workspaceId, workspace);
    
    const token = generateToken(userId, workspaceId);
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    
    res.status(201).json({
      success: true,
      token,
      user: userWithoutPassword,
      workspace
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const user = users.get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await comparePassword(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Account is not active' });
    }
    
    const workspace = Array.from(workspaces.values()).find(w => w.ownerId === user.id);
    if (!workspace) {
      return res.status(500).json({ error: 'No workspace found for user' });
    }
    
    const token = generateToken(user.id, workspace.id);
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      token,
      user: userWithoutPassword,
      workspace
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
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

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// Social accounts routes
app.get('/api/social-accounts', authenticateToken, async (req, res) => {
  try {
    let accounts = socialAccounts.get(req.user.id) || [];
    if (process.env.UPLOADPOST_KEY) {
      try {
        accounts = await uploadPost.getAccounts(req.user.id);
        socialAccounts.set(req.user.id, accounts);
      } catch (error) {
        console.error('UploadPost API error:', error);
      }
    }
    res.json({ success: true, accounts });
  } catch (error) {
    console.error('Social accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch social accounts' });
  }
});

app.post('/api/social-accounts/connect', authenticateToken, async (req, res) => {
  try {
    const FE = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (process.env.UPLOADPOST_KEY) {
      await uploadPost.ensureUser({
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      });
      const jwt = await uploadPost.generateJWT(req.user.id);
      const connectUrl = `https://uploadpost.io/connect?jwt=${encodeURIComponent(jwt)}&redirect_uri=${encodeURIComponent(FE + '/?connected=success')}`;
      return res.json({ success: true, auth_url: connectUrl });
    }
    // Demo fallback
    return res.json({ success: true, auth_url: FE + '/demo/social-connect.html', demo: true });
  } catch (error) {
    console.error('Social connect error:', error);
    return res.status(502).json({ success: false, error: `Upload-Post error: ${error.message}` });
  }
});

// Demo social connect page
app.get('/demo/social-connect.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html><meta charset="utf-8"><title>Demo Connect</title><style>body{font-family:system-ui;padding:24px;text-align:center;background:#f9fafb;color:#111827} .container{max-width:400px;margin:0 auto;background:white;padding:32px;border-radius:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1)} .spinner{width:40px;height:40px;border:4px solid #e5e7eb;border-top:4px solid #6366f1;border-radius:50%;animation:spin 1s linear infinite;margin:16px auto} h2{color:#1f2937;margin-bottom:16px} @keyframes spin{to{transform:rotate(360deg)}}</style><div class="container"><h2>Connecting demo accounts…</h2><div class="spinner"></div><p>This is a demo environment. In production, you would connect to real social media accounts.</p></div><script>setTimeout(()=>{ try{ window.opener && window.opener.postMessage({ type:'demo_connect_success' },'*'); }catch(e){} window.close(); }, 2000);</script>`);
});

// Basic API routes for demo
app.get('/api/videos/workspace/:id', authenticateToken, (req, res) => {
  const workspaceVideos = Array.from(videos.values()).filter(v => v.workspaceId === req.params.id);
  res.json({ success: true, videos: workspaceVideos });
});

app.get('/api/workspaces', authenticateToken, (req, res) => {
  const userWorkspaces = Array.from(workspaces.values()).filter(w => w.ownerId === req.user.id);
  res.json({ success: true, workspaces: userWorkspaces });
});

app.get('/api/workspaces/:id', authenticateToken, (req, res) => {
  const workspace = workspaces.get(req.params.id);
  if (!workspace || workspace.ownerId !== req.user.id) {
    return res.status(404).json({ error: 'Workspace not found' });
  }
  res.json({ success: true, workspace });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback - must be last
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, async () => {
  await createDemoUsers();
  console.log(`🚀 Content Fabrica Server running on port ${PORT}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
});

export default app;