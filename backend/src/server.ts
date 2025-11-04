import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { errorHandler } from './middleware/errorHandler.js'
import { apiLimiter } from './middleware/rateLimiter.js'
import authRoutes from './routes/auth.js'
import videoRoutes from './routes/videos.js'
import socialRoutes from './routes/social.js'
import postRoutes from './routes/posts.js'
import contentRoutes from './routes/content.js'
import reelRoutes from './routes/reels.js'
import planRoutes from './routes/plans.js'
import adminRoutes from './routes/admin.js'
import preferencesRoutes from './routes/preferences.js'
import { initializeScheduler } from './jobs/scheduler.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Trust proxy - required for Railway and other reverse proxies
app.set('trust proxy', true)

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(apiLimiter)

// Health check (before static files)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes (before static files)
app.use('/api/auth', authRoutes)
app.use('/api/videos', videoRoutes)
app.use('/api/social', socialRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/content', contentRoutes)
app.use('/api/reels', reelRoutes)
app.use('/api/plans', planRoutes)
app.use('/api/preferences', preferencesRoutes)

// Serve static files from frontend build (if exists)
// Compiled path: backend/dist/server.js -> go up one level to backend/public
const frontendDist = path.join(__dirname, '../public')
const indexHtml = path.join(frontendDist, 'index.html')

console.log('Looking for frontend at:', frontendDist)
console.log('__dirname is:', __dirname)
console.log('Frontend exists:', existsSync(frontendDist))
console.log('Index.html exists:', existsSync(indexHtml))

if (existsSync(frontendDist) && existsSync(indexHtml)) {
  app.use(express.static(frontendDist))
  // Handle SPA routing - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes and health check
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next()
    }
    res.sendFile(indexHtml)
  })
  console.log('✅ Serving frontend from', frontendDist)
} else {
  // Fallback if frontend not built - show API info
  app.get('/', (req, res) => {
    res.json({
      message: 'AI Video Generation Platform API',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        auth: '/api/auth',
        videos: '/api/videos',
        social: '/api/social',
        posts: '/api/posts',
      },
      note: 'Frontend build not found at: ' + frontendDist,
      debug: {
        __dirname,
        frontendDist,
        exists: existsSync(frontendDist),
        indexExists: existsSync(indexHtml),
      },
      timestamp: new Date().toISOString(),
    })
  })
  console.log('❌ Frontend build not found, serving API only')
  console.log('Expected path:', frontendDist)
}

// Error handler
app.use(errorHandler)

// Initialize job scheduler (only in production or if explicitly enabled)
if (process.env.NODE_ENV !== 'test' && process.env.ENABLE_SCHEDULER !== 'false') {
  initializeScheduler()
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  if (process.env.NODE_ENV !== 'test' && process.env.ENABLE_SCHEDULER !== 'false') {
    console.log('Job scheduler enabled')
  }
})

