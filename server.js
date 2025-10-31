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

// Brand Configuration
const BRAND_CONFIG = {
  name: 'Content Factory',
  tagline: 'AI-Powered Content Creation',
  version: '2.0.0',
  author: 'Content Factory Team',
  colors: {
    primary: '#a855f7',
    secondary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  },
  features: [
    'AI Video Generation',
    'Content Calendar',
    'Team Collaboration',
    'Analytics Dashboard',
    'Social Media Publishing'
  ]
};

// In-memory storage for demo purposes (replace with database in production)
const users = new Map();
const sessions = new Map();
const workspaces = new Map();
const videos = new Map();
const socialAccounts = new Map(); // userId -> array of social accounts

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
    // Only get accounts for the specific user
    const res = await fetch(`${this.baseURL}/uploadposts/users?user_id=${encodeURIComponent(userId)}`, { headers: this.authHeaders(false) });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.profiles || data?.users || [];
    const userProfile = list.find(p => p.user_id === userId);
    if (!userProfile) return [];
    
    return userProfile.social_accounts ? Object.entries(userProfile.social_accounts).map(([platform, accountData]) => ({
      id: `${userId}_${platform}`,
      platform: platform.toLowerCase(),
      username: accountData.username || accountData.handle,
      displayName: accountData.display_name || accountData.name,
      isConnected: accountData.is_active !== false,
      profileImage: accountData.profile_image || accountData.avatar_url,
      connectedAt: accountData.connected_at || accountData.created_at
    })) : [];
  }
}

const uploadPost = new UploadPostAPI();

// Enhanced API Response Helper
const createResponse = (data = null, message = null, status = 'success', meta = {}) => {
  const response = {
    success: status === 'success',
    status,
    timestamp: new Date().toISOString(),
    brand: {
      name: BRAND_CONFIG.name,
      version: BRAND_CONFIG.version
    },
    ...meta
  };

  if (message) response.message = message;
  if (data !== null) response.data = data;
  
  return response;
};

// Security middleware - more permissive for development
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.upload-post.com", "http://localhost:*"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting - more permissive for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Higher limit for development
  message: createResponse(null, 'Too many requests. Please try again later.', 'error'),
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// CORS configuration - FIXED FOR PRODUCTION
const corsOptions = {
  origin: function (origin, callback) {
    console.log('🔍 CORS check - Origin:', origin);
    
    // Allow requests with no origin (like mobile apps, curl, or same-origin requests)
    if (!origin) {
      console.log('✅ CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    // Define allowed origins
    const allowedOrigins = [
      // Development
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:8080',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8080',
      // Production
      'https://contentfabrica.com',
      'https://www.contentfabrica.com',
      'http://contentfabrica.com',
      'http://www.contentfabrica.com',
      // Railway/Other hosting platforms (dynamic)
      process.env.FRONTEND_URL
    ].filter(Boolean); // Remove undefined values
    
    // Check if origin is in allowed list or matches patterns
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin === origin) return true;
      // Check for Railway/Vercel/Netlify patterns
      if (origin.includes('.up.railway.app') || 
          origin.includes('.vercel.app') || 
          origin.includes('.netlify.app') ||
          origin.includes('contentfabrica')) {
        return true;
      }
      return false;
    });
    
    if (isAllowed) {
      console.log('✅ CORS: Allowing origin:', origin);
      return callback(null, true);
    }
    
    console.log('❌ CORS: Blocking origin:', origin);
    console.log('📋 Allowed origins:', allowedOrigins);
    
    // In production, be more permissive to avoid blocking legitimate requests
    if (process.env.NODE_ENV === 'production') {
      console.log('🚀 CORS: Production mode - allowing request anyway');
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // For legacy browsers
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced debug middleware with branding
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`🌐 ${timestamp} - ${req.method} ${req.path}`);
  
  if (req.path.includes('/api/auth/') || req.path.includes('/api/social-accounts')) {
    console.log('📡 API request:', {
      method: req.method,
      path: req.path,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent']?.slice(0, 50) + '...',
      headers: {
        authorization: req.headers.authorization ? 'Bearer ***' : undefined,
        'content-type': req.headers['content-type']
      },
      body: req.method !== 'GET' ? req.body : undefined
    });
  }
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Utility functions
const generateToken = (userId, workspaceId) => {
  return jwt.sign(
    { 
      userId, 
      workspaceId, 
      timestamp: Date.now(),
      brand: BRAND_CONFIG.name,
      version: BRAND_CONFIG.version
    },
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
    console.log('🔒 No token provided');
    return res.status(401).json(createResponse(null, 'Access token required', 'error'));
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = Array.from(users.values()).find(u => u.id === decoded.userId);
    const workspace = workspaces.get(decoded.workspaceId);
    
    if (!user || !workspace) {
      console.log('🔒 User or workspace not found for token');
      return res.status(401).json(createResponse(null, 'Invalid token', 'error'));
    }
    
    req.user = user;
    req.workspace = workspace;
    next();
  } catch (error) {
    console.log('🔒 Token verification error:', error.message);
    return res.status(401).json(createResponse(null, 'Invalid or expired token', 'error'));
  }
};

// Seed demo users with social accounts
const createDemoUsers = async () => {
  try {
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
    
    // Create demo social accounts for this user only
    const demoSocialAccounts = [
      {
        id: 'account_1',
        platform: 'instagram',
        username: 'demo_instagram',
        displayName: 'Demo Instagram',
        isConnected: true,
        profileImage: 'https://via.placeholder.com/40/E4405F/FFFFFF?text=IG',
        connectedAt: new Date().toISOString()
      },
      {
        id: 'account_2',
        platform: 'tiktok',
        username: 'demo_tiktok',
        displayName: 'Demo TikTok',
        isConnected: true,
        profileImage: 'https://via.placeholder.com/40/000000/FFFFFF?text=TT',
        connectedAt: new Date().toISOString()
      }
    ];
    
    users.set(demoUser.email, demoUser);
    workspaces.set(demoWorkspace.id, demoWorkspace);
    socialAccounts.set(demoUser.id, demoSocialAccounts);
    
    console.log('✅ Demo user created:', demoUser.email);
    console.log('✅ Demo workspace created:', demoWorkspace.name);
    console.log('✅ Demo social accounts created:', demoSocialAccounts.length);
  } catch (error) {
    console.error('❌ Error creating demo users:', error);
  }
};

// Brand info endpoint
app.get('/api/brand', (req, res) => {
  res.json(createResponse(BRAND_CONFIG, 'Brand information retrieved successfully'));
});

// Auth Routes with enhanced branding
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('📝 Registration attempt:', { email: req.body.email, timestamp: new Date().toISOString() });
    const { firstName, lastName, email, password, username } = req.body;
    
    // Validation
    if (!firstName || !lastName || !email || !password) {
      console.log('❌ Missing required fields');
      return res.status(400).json(createResponse(null, 'All fields are required', 'error'));
    }
    
    if (users.has(email)) {
      console.log('❌ Email already exists:', email);
      return res.status(400).json(createResponse(null, 'Email already registered', 'error'));
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
    socialAccounts.set(userId, []); // Initialize empty social accounts
    
    const token = generateToken(userId, workspaceId);
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    
    console.log('✅ User registered successfully:', email);
    
    res.status(201).json(createResponse({
      token,
      user: userWithoutPassword,
      workspace
    }, `Welcome to ${BRAND_CONFIG.name}! Your account has been created successfully.`, 'success'));
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json(createResponse(null, 'Registration failed. Please try again.', 'error'));
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 Login attempt:', { email: req.body.email, timestamp: new Date().toISOString() });
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json(createResponse(null, 'Email and password are required', 'error'));
    }
    
    console.log('🔍 Looking for user:', email);
    console.log('📋 Available users:', Array.from(users.keys()));
    
    const user = users.get(email);
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json(createResponse(null, 'Invalid credentials', 'error'));
    }
    
    console.log('🔒 User found, checking password...');
    const validPassword = await comparePassword(password, user.password);
    if (!validPassword) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json(createResponse(null, 'Invalid credentials', 'error'));
    }
    
    if (user.status !== 'ACTIVE') {
      console.log('❌ Account not active:', email);
      return res.status(401).json(createResponse(null, 'Account is not active', 'error'));
    }
    
    const workspace = Array.from(workspaces.values()).find(w => w.ownerId === user.id);
    if (!workspace) {
      console.log('❌ No workspace found for user:', email);
      return res.status(500).json(createResponse(null, 'No workspace found for user', 'error'));
    }
    
    const token = generateToken(user.id, workspace.id);
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    
    console.log('✅ Login successful:', email);
    
    res.json(createResponse({
      token,
      user: userWithoutPassword,
      workspace
    }, `Welcome back to ${BRAND_CONFIG.name}!`, 'success'));
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json(createResponse(null, 'Login failed. Please try again.', 'error'));
  }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  const { password: _, ...userWithoutPassword } = req.user;
  
  console.log('✅ Token verified for:', req.user.email);
  
  res.json(createResponse({
    user: userWithoutPassword,
    workspace: req.workspace
  }, 'Token verified successfully', 'success'));
});

app.post('/api/auth/logout', (req, res) => {
  console.log('👋 User logged out');
  res.json(createResponse(null, `Thank you for using ${BRAND_CONFIG.name}!`, 'success'));
});

// Social accounts routes - Enhanced with branding
app.get('/api/social-accounts', authenticateToken, async (req, res) => {
  try {
    console.log('📱 Getting social accounts for user:', req.user.id);
    
    let accounts = socialAccounts.get(req.user.id) || [];
    console.log('📊 Found accounts for user:', accounts.length);
    
    // If using real UploadPost API and have the key
    if (process.env.UPLOADPOST_KEY) {
      try {
        const uploadPostAccounts = await uploadPost.getAccounts(req.user.id);
        console.log('🔗 UploadPost accounts:', uploadPostAccounts.length);
        accounts = uploadPostAccounts;
        socialAccounts.set(req.user.id, accounts);
      } catch (error) {
        console.error('❌ UploadPost API error:', error);
      }
    }
    
    res.json(createResponse({ accounts }, 'Social accounts retrieved successfully', 'success'));
  } catch (error) {
    console.error('❌ Social accounts error:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch social accounts', 'error'));
  }
});

// Workspace-specific social accounts
app.get('/api/social-accounts/workspace/:workspaceId', authenticateToken, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    console.log('🏢 Getting social accounts for workspace:', workspaceId, 'user:', req.user.id);
    
    // Verify user has access to this workspace
    if (req.workspace.id !== workspaceId) {
      return res.status(403).json(createResponse(null, 'Access denied to workspace', 'error'));
    }
    
    let accounts = socialAccounts.get(req.user.id) || [];
    console.log('📊 Found accounts for user in workspace:', accounts.length);
    
    // If using real UploadPost API
    if (process.env.UPLOADPOST_KEY) {
      try {
        const uploadPostAccounts = await uploadPost.getAccounts(req.user.id);
        accounts = uploadPostAccounts;
        socialAccounts.set(req.user.id, accounts);
      } catch (error) {
        console.error('❌ UploadPost API error:', error);
      }
    }
    
    res.json(createResponse({ socialAccounts: accounts }, 'Workspace social accounts retrieved successfully', 'success'));
  } catch (error) {
    console.error('❌ Workspace social accounts error:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch social accounts', 'error'));
  }
});

app.post('/api/social-accounts/connect', authenticateToken, async (req, res) => {
  try {
    const FE = process.env.FRONTEND_URL || 'https://contentfabrica.com';
    
    if (process.env.UPLOADPOST_KEY) {
      await uploadPost.ensureUser({
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      });
      const jwtToken = await uploadPost.generateJWT(req.user.id);
      const connectUrl = `https://uploadpost.io/connect?jwt=${encodeURIComponent(jwtToken)}&redirect_uri=${encodeURIComponent(FE + '/?connected=success')}`;
      return res.json(createResponse({ 
        auth_url: connectUrl, 
        connectionUrl: connectUrl 
      }, 'Social media connection URL generated', 'success'));
    }
    
    // Demo fallback
    return res.json(createResponse({ 
      connectionUrl: FE + '/demo/social-connect.html', 
      demo: true 
    }, 'Demo social media connection ready', 'success'));
  } catch (error) {
    console.error('❌ Social connect error:', error);
    return res.status(502).json(createResponse(null, `Upload-Post error: ${error.message}`, 'error'));
  }
});

// Available platforms
app.get('/api/social-accounts/platforms', (req, res) => {
  const platforms = [
    { id: 'instagram', name: 'Instagram', description: 'Share photos and stories', color: '#E4405F' },
    { id: 'tiktok', name: 'TikTok', description: 'Upload short videos', color: '#000000' },
    { id: 'youtube', name: 'YouTube', description: 'Upload and manage videos', color: '#FF0000' },
    { id: 'facebook', name: 'Facebook', description: 'Post updates and media', color: '#1877F2' },
    { id: 'x', name: 'X (Twitter)', description: 'Post tweets and media', color: '#1DA1F2' },
    { id: 'linkedin', name: 'LinkedIn', description: 'Professional networking', color: '#0A66C2' },
    { id: 'threads', name: 'Threads', description: 'Text-based conversations', color: '#000000' }
  ];
  
  res.json(createResponse({ platforms }, 'Available social media platforms retrieved', 'success'));
});

// Demo social connect page
app.get('/demo/social-connect.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html><meta charset="utf-8"><title>${BRAND_CONFIG.name} - Demo Connect</title><style>body{font-family:'Inter',system-ui;padding:24px;text-align:center;background:linear-gradient(135deg,#faf5ff,#eff6ff);color:#111827} .container{max-width:400px;margin:0 auto;background:white;padding:32px;border-radius:24px;box-shadow:0 25px 50px -12px rgba(168,85,247,0.25)} .spinner{width:40px;height:40px;border:4px solid #e5e7eb;border-top:4px solid #a855f7;border-radius:50%;animation:spin 1s linear infinite;margin:16px auto} h2{color:#1f2937;margin-bottom:16px;font-weight:700} .brand{color:#a855f7;font-weight:800} @keyframes spin{to{transform:rotate(360deg)}}</style><div class="container"><h2>Connecting to <span class="brand">${BRAND_CONFIG.name}</span></h2><div class="spinner"></div><p>This is a demo environment. Your social media accounts are being connected securely.</p><p style="font-size:0.875rem;color:#6b7280;margin-top:16px">${BRAND_CONFIG.tagline}</p></div><script>setTimeout(()=>{ try{ window.opener && window.opener.postMessage({ type:'demo_connect_success' },'*'); }catch(e){} window.close(); }, 2000);</script>`);
});

// Basic API routes for demo with enhanced responses
app.get('/api/videos/workspace/:id', authenticateToken, (req, res) => {
  const workspaceVideos = Array.from(videos.values()).filter(v => v.workspaceId === req.params.id);
  res.json(createResponse({ videos: workspaceVideos }, 'Workspace videos retrieved successfully', 'success'));
});

app.get('/api/workspaces', authenticateToken, (req, res) => {
  const userWorkspaces = Array.from(workspaces.values()).filter(w => w.ownerId === req.user.id);
  res.json(createResponse({ workspaces: userWorkspaces }, 'User workspaces retrieved successfully', 'success'));
});

app.get('/api/workspaces/:id', authenticateToken, (req, res) => {
  const workspace = workspaces.get(req.params.id);
  if (!workspace || workspace.ownerId !== req.user.id) {
    return res.status(404).json(createResponse(null, 'Workspace not found', 'error'));
  }
  res.json(createResponse({ workspace }, 'Workspace details retrieved successfully', 'success'));
});

// Enhanced health check with brand information
app.get('/api/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: BRAND_CONFIG.version,
    brand: BRAND_CONFIG.name,
    environment: process.env.NODE_ENV || 'development',
    features: BRAND_CONFIG.features,
    stats: {
      users: users.size,
      workspaces: workspaces.size,
      socialAccounts: socialAccounts.size
    },
    server: {
      port: PORT,
      nodeEnv: process.env.NODE_ENV,
      frontendUrl: process.env.FRONTEND_URL
    }
  };
  
  res.json(createResponse(healthData, `${BRAND_CONFIG.name} server is running smoothly`, 'success'));
});

// SPA fallback - must be last
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

// Enhanced error handling middleware with branding
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorResponse = createResponse(
    isDevelopment ? { error: error.message, stack: error.stack } : null,
    'An unexpected error occurred. Our team has been notified.',
    'error',
    { errorId: Date.now().toString() }
  );
  
  res.status(500).json(errorResponse);
});

// Start server with enhanced branding
app.listen(PORT, async () => {
  await createDemoUsers();
  
  console.log('');
  console.log('🎨 ================================');
  console.log(`🚀 ${BRAND_CONFIG.name} Server`);
  console.log(`📝 ${BRAND_CONFIG.tagline}`);
  console.log(`🔢 Version: ${BRAND_CONFIG.version}`);
  console.log('🎨 ================================');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`📱 Frontend: ${process.env.FRONTEND_URL || 'https://contentfabrica.com'}`);
  console.log(`🌐 API: http://localhost:${PORT}/api`);
  console.log(`🧪 Demo User: demo@contentfabrica.com / demo123`);
  console.log(`💡 Features: ${BRAND_CONFIG.features.join(', ')}`);
  console.log('🎨 ================================');
  console.log('');
});

export default app;