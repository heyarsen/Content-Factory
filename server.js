import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';

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

// Upload-Post API helper - ensure reuse of existing profile and proper JWT connect URL
class UploadPostAPI {
  constructor() {
    this.apiKey = process.env.UPLOADPOST_KEY;
    this.baseURL = 'https://api.upload-post.com/api';
  }

  headers() {
    return {
      'Authorization': `Apikey ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async getUser(userId){
    const res = await fetch(`${this.baseURL}/uploadposts/users?user_id=${encodeURIComponent(userId)}`, { headers: { 'Authorization': `Apikey ${this.apiKey}` }});
    if (!res.ok) return null;
    const data = await res.json();
    const profiles = data?.profiles || data?.users || [];
    return profiles.length ? profiles[0] : null;
  }

  async ensureUser(user){
    // Reuse if exists, otherwise create once
    const existing = await this.getUser(user.id);
    if (existing) return existing;
    const res = await fetch(`${this.baseURL}/uploadposts/users`, {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ user_id: user.id, email: user.email, name: `${user.firstName} ${user.lastName}`.trim() })
    });
    if (!res.ok){
      const err = await res.json().catch(()=>({message:`HTTP ${res.status}`}));
      throw new Error(err.message);
    }
    return await res.json();
  }

  async generateJWT(userId){
    const res = await fetch(`${this.baseURL}/uploadposts/users/generate-jwt`, { method:'POST', headers: this.headers(), body: JSON.stringify({ user_id: userId })});
    if (!res.ok){
      const err = await res.json().catch(()=>({message:`HTTP ${res.status}`}));
      throw new Error(err.message);
    }
    const data = await res.json();
    return data.jwt || data.token;
  }

  async getConnectedAccounts(userId){
    const res = await fetch(`${this.baseURL}/uploadposts/users?user_id=${encodeURIComponent(userId)}`, { headers: { 'Authorization': `Apikey ${this.apiKey}` }});
    if (!res.ok) return [];
    const data = await res.json();
    const profiles = data?.profiles || data?.users || [];
    // Map to UI shape (platform accounts)
    return profiles.map(p=>({
      id: p.profile_id || p.id,
      platform: (p.platform||'').toLowerCase(),
      username: p.username || p.handle,
      displayName: p.display_name || p.name,
      isConnected: p.is_active !== false,
      profileImage: p.profile_image || p.avatar_url,
      connectedAt: p.connected_at || p.created_at
    }));
  }
}

const uploadPost = new UploadPostAPI();

// Seed demo data (unchanged abridged)...
const createDemoUsers = () => {
  const demoUser = { id:'demo-user-id', firstName:'Demo', lastName:'User', email:'demo@contentfactory.com', username:'demouser', password:'demo123', role:'USER', createdAt:new Date().toISOString(), lastLoginAt:null, emailVerified:true, status:'ACTIVE' };
  const demoWorkspace = { id:'demo-workspace-id', name:'Demo Workspace', slug:'demo-workspace', ownerId: demoUser.id, plan:'FREE', status:'ACTIVE', createdAt:new Date().toISOString() };
  users.set(demoUser.email, demoUser); workspaces.set(demoWorkspace.id, demoWorkspace);
  const adminUser = { id:'admin-user-id', firstName:'Admin', lastName:'User', email:'admin@contentfactory.com', username:'admin', password:'admin123', role:'ADMIN', createdAt:new Date().toISOString(), lastLoginAt:null, emailVerified:true, status:'ACTIVE' };
  const adminWorkspace = { id:'admin-workspace-id', name:'Admin Workspace', slug:'admin-workspace', ownerId: adminUser.id, plan:'ENTERPRISE', status:'ACTIVE', createdAt:new Date().toISOString() };
  users.set(adminUser.email, adminUser); workspaces.set(adminWorkspace.id, adminWorkspace);
};

const generateToken = (userId, workspaceId) => `token_${userId}_${workspaceId}_${Date.now()}`;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

const authenticateToken = (req,res,next)=>{
  const token = (req.headers['authorization']||'').split(' ')[1];
  if (!token) return res.status(401).json({ error:'Access token required' });
  const session = sessions.get(token);
  if (!session || session.expiresAt < new Date()){ sessions.delete(token); return res.status(401).json({ error:'Invalid or expired token' }); }
  const user = users.get(session.userEmail);
  const workspace = Array.from(workspaces.values()).find(w=>w.ownerId===user?.id);
  if (!user || !workspace) return res.status(401).json({ error:'Unauthorized' });
  req.user=user; req.workspace=workspace; req.token=token; next();
};

// Minimal health/auth routes omitted for brevity...

// Social accounts — FIX connect flow: reuse profile, real HTTPS connect URL, no about:blank
app.get('/api/social-accounts', authenticateToken, async (req,res)=>{
  try{
    let accounts = socialAccounts.get(req.user.id) || [];
    if (process.env.UPLOADPOST_KEY){
      try{ accounts = await uploadPost.getConnectedAccounts(req.user.id); socialAccounts.set(req.user.id, accounts);}catch(e){/* fallback to cache */}
    }
    res.json({ success:true, accounts });
  }catch(e){ res.status(500).json({ error:'Failed to fetch social accounts' }); }
});

app.post('/api/social-accounts/connect', authenticateToken, async (req,res)=>{
  try{
    const FE = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (!FE) return res.status(400).json({ success:false, error:'FRONTEND_URL not configured' });

    if (process.env.UPLOADPOST_KEY){
      try{
        // Ensure profile exists only once
        await uploadPost.ensureUser({ id: req.user.id, email: req.user.email, firstName: req.user.firstName, lastName: req.user.lastName });
        // Generate short-lived JWT for linking
        const jwt = await uploadPost.generateJWT(req.user.id);
        // Use official connect URL — opens account linking UI
        const url = `https://uploadpost.io/connect?jwt=${encodeURIComponent(jwt)}&redirect_uri=${encodeURIComponent(FE+'/?connected=success')}`;
        return res.json({ success:true, auth_url: url, message:'Open the popup to link your social accounts.' });
      }catch(err){
        // If Upload-Post returns that profile exists, we still generate JWT and proceed
        try{ const jwt = await uploadPost.generateJWT(req.user.id); const url = `https://uploadpost.io/connect?jwt=${encodeURIComponent(jwt)}&redirect_uri=${encodeURIComponent(FE+'/?connected=success')}`; return res.json({ success:true, auth_url:url, message:'Open the popup to link your social accounts.' }); }catch(inner){
          return res.status(502).json({ success:false, error:`Upload-Post error: ${inner.message}` });
        }
      }
    }

    // Demo fallback with real HTTPS intermediate page to avoid about:blank
    const demoUrl = `${FE}/demo/social-connect.html`;
    return res.json({ success:true, auth_url: demoUrl, message:'Demo mode: linking simulated accounts.' , demo:true });
  }catch(e){ return res.status(500).json({ error:'Failed to initiate social account connection' }); }
});

// Serve a tiny demo connector page so popups are HTTPS/HTTP, not data: URLs
app.get('/demo/social-connect.html', (req,res)=>{
  res.setHeader('Content-Type','text/html');
  res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Demo Connect</title><style>body{font-family:system-ui;padding:24px;text-align:center} .sp{width:40px;height:40px;border:4px solid #eee;border-top:4px solid #6366f1;border-radius:50%;animation:spin 1s linear infinite;margin:16px auto}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><h2>Connecting demo accounts…</h2><div class="sp"></div><script>setTimeout(()=>{ try{ window.opener && window.opener.postMessage({ type:'demo_connect_success' },'*'); }catch(e){} window.close(); }, 1200);</script></body></html>`);
});

// SPA fallback
app.get('*', (req,res)=>{ res.sendFile(path.join(__dirname, 'dist/index.html')); });

app.listen(PORT, ()=>{ createDemoUsers(); console.log(`🚀 Server on :${PORT}`); });

export default app;
