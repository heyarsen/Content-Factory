import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import proxy from './api/proxy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

console.log('🚀 Starting Content Factory Server...');
console.log('📁 Directory:', __dirname);
console.log('🔑 API Key configured:', process.env.UPLOADPOST_API_KEY ? 'YES' : 'NO (using fallback)');

app.use(express.json());

// Mount proxy on /api and /api/proxy for robustness
console.log('🔗 Mounting API proxy at /api and /api/proxy');
app.use('/api', proxy);
app.use('/api/proxy', proxy);

const distPath = path.join(__dirname, 'dist');
console.log('📦 Dist path:', distPath);
console.log('📦 Dist exists:', fs.existsSync(distPath));

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('❤️ Health check called');
  res.json({ 
    status: 'healthy', 
    time: new Date().toISOString(),
    server: 'Express Node.js',
    proxy: 'mounted at /api & /api/proxy'
  });
});

// Test proxy endpoint
app.get('/api/test-proxy', (req, res) => {
  console.log('🧪 Test proxy endpoint called');
  res.json({ 
    message: 'Proxy router is working!',
    routes: [
      'GET /api/proxy/uploadpost/users/get/:username',
      'GET /api/uploadpost/users/get/:username',
      'POST /api/proxy/uploadpost/users',
      'POST /api/proxy/uploadpost/users/generate-jwt'
    ]
  });
});

// Serve static files
if (fs.existsSync(distPath)) {
  console.log('✅ Serving static files from dist/');
  app.use(express.static(distPath, { maxAge: '1d' }));
  
  // SPA fallback for everything EXCEPT /api/*
  app.get(/^((?!^\/api\/).)*$/, (req, res) => {
    console.log('📄 SPA fallback for:', req.path);
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log('⚠️ No dist folder found, serving build pending message');
  app.get(/^((?!^\/api\/).)*$/, (req, res) => {
    res.send('Build pending... dist folder not found');
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🎉 Content Factory Server Started Successfully!');
  console.log(`📍 URL: http://0.0.0.0:${PORT}`);
  console.log(`❤️ Health: http://0.0.0.0:${PORT}/health`);
  console.log(`🧪 Test: http://0.0.0.0:${PORT}/api/test-proxy`);
  console.log(`🔗 Proxy: http://0.0.0.0:${PORT}/api/uploadpost/users/get/test`);
  console.log('============================================');
});

server.on('error', (error) => {
  console.error('❌ Server startup error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⏹️ Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⏹️ Received SIGINT, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});