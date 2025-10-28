import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Railway provides PORT, but fallback to common ports
const PORT = process.env.PORT || process.env.port || 8080;

console.log('=================================');
console.log('Starting Video Generator Server');
console.log('=================================');
console.log('Environment:', process.env.NODE_ENV);
console.log('PORT from env:', process.env.PORT);
console.log('Using PORT:', PORT);
console.log('Directory:', __dirname);

// Check dist folder
const distPath = path.join(__dirname, 'dist');
console.log('Dist path:', distPath);
console.log('Dist exists:', fs.existsSync(distPath));

if (fs.existsSync(distPath)) {
  const files = fs.readdirSync(distPath);
  console.log('Dist contents:', files);
} else {
  console.error('ERROR: dist folder not found!');
  process.exit(1);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// API endpoint to test if server is responding
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

// Serve static files from dist
app.use(express.static(distPath, {
  maxAge: '1d',
  etag: true
}));

// Handle all routes - SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  console.log('Request for:', req.path);
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error('index.html not found at:', indexPath);
    res.status(404).send('Application not found. Build may have failed.');
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('=================================');
  console.log(`✅ Server started successfully!`);
  console.log(`   Listening on: http://0.0.0.0:${PORT}`);
  console.log(`   Health check: http://0.0.0.0:${PORT}/health`);
  console.log('=================================');
});

server.on('error', (error) => {
  console.error('❌ Server failed to start:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
