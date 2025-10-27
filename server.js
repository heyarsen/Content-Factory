import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

console.log('=================================');
console.log('Starting Content Factory Server');
console.log('=================================');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Using PORT:', PORT);
console.log('Directory:', __dirname);

// Check for build files
const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(__dirname, 'index.html');

console.log('Checking for build files...');
console.log('Dist path:', distPath, 'exists:', fs.existsSync(distPath));
console.log('Index path:', indexPath, 'exists:', fs.existsSync(indexPath));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    port: PORT,
    timestamp: new Date().toISOString(),
    build: fs.existsSync(distPath) ? 'dist found' : 'using fallback'
  });
});

// API test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Content Factory API is working!',
    version: '2.0.0'
  });
});

// Serve static files
if (fs.existsSync(distPath)) {
  console.log('✅ Serving from dist folder');
  app.use(express.static(distPath, { maxAge: '1d' }));
  
  // SPA fallback for dist
  app.get('*', (req, res) => {
    const indexFile = path.join(distPath, 'index.html');
    if (fs.existsSync(indexFile)) {
      res.sendFile(indexFile);
    } else {
      res.status(404).send('Build files not found');
    }
  });
} else if (fs.existsSync(indexPath)) {
  console.log('⚠️  Serving from root index.html (development mode)');
  app.use(express.static(__dirname));
  
  app.get('*', (req, res) => {
    res.sendFile(indexPath);
  });
} else {
  console.log('❌ No build files found, serving error page');
  
  app.get('*', (req, res) => {
    res.status(503).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Content Factory - Building...</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .loader { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 50px; height: 50px; animation: spin 2s linear infinite; margin: 20px auto; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <h1>Content Factory</h1>
        <div class="loader"></div>
        <p>Application is building... Please refresh in a moment.</p>
        <p><a href="/health">Check Health</a></p>
      </body>
      </html>
    `);
  });
}

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Start server with better error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('=================================');
  console.log(`✅ Content Factory Server Started!`);
  console.log(`   URL: http://0.0.0.0:${PORT}`);
  console.log(`   Health: http://0.0.0.0:${PORT}/health`);
  console.log(`   Mode: ${fs.existsSync(distPath) ? 'Production' : 'Development'}`);
  console.log('=================================');
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
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});