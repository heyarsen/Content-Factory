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

// Seed minimal demo users
const createDemoUsers = ()=>{
  const demoUser = { id:'demo-user-id', firstName:'Demo', lastName:'User', email:'demo@contentfactory.com', username:'demouser', password:'demo123', role:'USER', createdAt:new Date().toISOString(), emailVerified:true, status:'ACTIVE' };
  const demoWorkspace = { id:'demo-workspace-id', name:'Demo Workspace', slug:'demo-workspace', ownerId: demoUser.id, plan:'FREE', status:'ACTIVE', createdAt:new Date().toISOString() };
  users.set(demoUser.email, demoUser); workspaces.set(demoWorkspace.id, demoWorkspace);
};

const generateToken = (userId, workspaceId)=>`token_${userId}_${workspaceId}_${Date.now()}`;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

const authenticateToken = (req,res,next)=>{
  const token = (req.headers['authorization']||'').split(' ')[1];
  if (!token) return res.status(401).json({ error:'Access token required' });
  const session = sessions.get(token);
  if (!session || session.expiresAt < new Date()) return res.status(401).json({ error:'Invalid or expired token' });
  const user = users.get(session.userEmail);
  const workspace = Array.from(workspaces.values()).find(w=>w.ownerId===user?.id);
  if (!user || !workspace) return res.status(401).json({ error:'Unauthorized' });
  req.user=user; req.workspace=workspace; next();
};

// Social accounts
app.get('/api/social-accounts', authenticateToken, async (req,res)=>{
  try{
    let accounts = socialAccounts.get(req.user.id) || [];
    if (process.env.UPLOADPOST_KEY){
      try{ accounts = await uploadPost.getAccounts(req.user.id); socialAccounts.set(req.user.id, accounts);}catch{}
    }
    res.json({ success:true, accounts });
  }catch{ res.status(500).json({ error:'Failed to fetch social accounts' }); }
});

app.post('/api/social-accounts/connect', authenticateToken, async (req,res)=>{
  try{
    const FE = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (process.env.UPLOADPOST_KEY){
      // Reuse or create profile once, then mint JWT for linking
      await uploadPost.ensureUser({ id:req.user.id, email:req.user.email, firstName:req.user.firstName, lastName:req.user.lastName });
      const jwt = await uploadPost.generateJWT(req.user.id);
      const connectUrl = `https://uploadpost.io/connect?jwt=${encodeURIComponent(jwt)}&redirect_uri=${encodeURIComponent(FE + '/?connected=success')}`;
      return res.json({ success:true, auth_url: connectUrl });
    }
    // Demo fallback page on same origin to avoid about:blank
    return res.json({ success:true, auth_url: FE + '/demo/social-connect.html', demo:true });
  }catch(e){ return res.status(502).json({ success:false, error:`Upload-Post error: ${e.message}` }); }
});

// Demo page so popup has valid origin
app.get('/demo/social-connect.html', (req,res)=>{
  res.setHeader('Content-Type','text/html');
  res.end(`<!doctype html><meta charset="utf-8"><title>Demo Connect</title><style>body{font-family:system-ui;padding:24px;text-align:center} .sp{width:40px;height:40px;border:4px solid #eee;border-top:4px solid #6366f1;border-radius:50%;animation:spin 1s linear infinite;margin:16px auto}@keyframes spin{to{transform:rotate(360deg)}}</style><h2>Connecting demo accounts…</h2><div class="sp"></div><script>setTimeout(()=>{ try{ window.opener && window.opener.postMessage({ type:'demo_connect_success' },'*'); }catch(e){} window.close(); }, 1200);</script>`);
});

// SPA fallback
app.get('*', (req,res)=>{ res.sendFile(path.join(__dirname, 'dist/index.html')); });

app.listen(PORT, ()=>{ createDemoUsers(); console.log(`🚀 Server on :${PORT}`); });

export default app;
