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
    version: '2.0.0'
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
  res.json({ message: 'Video creation endpoint - to be implemented with authentication' });
});

app.get('/api/video-status/:id', (req, res) => {
  res.json({ message: 'Video status endpoint - to be implemented with authentication' });
});

app.post('/api/post-video', (req, res) => {
  res.json({ message: 'Video posting endpoint - to be implemented with authentication' });
});

// Catch-all handler for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

// Error handling middleware
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
  console.log('\n📝 Next steps:');
  console.log('1. Set up database: npx prisma migrate dev --name init');
  console.log('2. Generate Prisma client: npx prisma generate');
  console.log('3. Set environment variables in .env file');
  console.log('4. Restart server to enable full functionality\n');
});

export default app;