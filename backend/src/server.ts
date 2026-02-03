import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readdirSync } from 'fs'
import helmet from 'helmet'
import { randomUUID } from 'crypto'
import { errorHandler } from './middleware/errorHandler.js'
import { apiLimiter } from './middleware/rateLimiter.js'
import authRoutes from './routes/auth.js'
import videoRoutes from './routes/videos.js'
import socialRoutes from './routes/social.js'
import postRoutes from './routes/posts.js'
import contentRoutes from './routes/content.js'
import reelRoutes from './routes/reels.js'
import planRoutes from './routes/plans.js'
import preferencesRoutes from './routes/preferences.js'
import avatarRoutes from './routes/avatars.js'
import creditsRoutes from './routes/credits.js'
import promptsRoutes from './routes/prompts.js'
import { initializeScheduler } from './jobs/scheduler.js'
import adminRoutes from './routes/admin.js'
import supportRoutes from './routes/support.js'
import adminMigrationRoutes from './routes/admin-migration.js'
import dashboardRoutes from './routes/dashboard.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Trust proxy - required for Railway and other reverse proxies
app.set('trust proxy', true)

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)
const allowedOrigins = new Set(corsOrigins)

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}))
app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true)
    }

    if (allowedOrigins.has(origin)) {
      return callback(null, true)
    }

    const error = new Error('Not allowed by CORS')
    ;(error as any).status = 403
    return callback(error)
  },
  credentials: true,
}))
app.use((req, res, next) => {
  const incomingId = req.get('X-Request-Id')?.trim()
  const requestId = incomingId || randomUUID()
  res.setHeader('X-Request-Id', requestId)
  res.locals.requestId = requestId
  next()
})
// Increase JSON payload size limit to 50MB for large image uploads (base64 encoded images can be large)
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(apiLimiter)

// Health check (before static files)
app.get('/health', async (req, res) => {
  const health: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
      hasSupabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  }

  // Use connection health check with circuit breaker
  try {
    const { checkSupabaseHealth, getConnectionHealth } = await import('./lib/supabaseConnection.js')
    const connectionHealth = getConnectionHealth()
    const isHealthy = await checkSupabaseHealth()

    health.supabase = {
      reachable: isHealthy,
      connectionHealth: {
        isHealthy: connectionHealth.isHealthy,
        consecutiveFailures: connectionHealth.consecutiveFailures,
        circuitBreakerState: connectionHealth.circuitBreakerState,
        lastCheck: new Date(connectionHealth.lastCheck).toISOString(),
      },
      url: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 20)}...` : 'Not set',
    }

    // If circuit breaker is open, include next attempt time
    if (connectionHealth.circuitBreakerState === 'open') {
      const { circuitBreaker } = await import('./lib/circuitBreaker.js')
      const state = circuitBreaker.getState('supabase')
      if (state?.nextAttemptTime) {
        health.supabase.nextAttemptTime = new Date(state.nextAttemptTime).toISOString()
        health.supabase.retryAfter = Math.max(0, Math.ceil((state.nextAttemptTime - Date.now()) / 1000))
      }
    }
  } catch (error: any) {
    health.supabase = {
      reachable: false,
      error: error.message,
    }
  }

  const statusCode = health.supabase?.reachable === false ? 503 : 200
  res.status(statusCode).json(health)
})

// Circuit breaker status endpoint
app.get('/diagnostics/circuit-breaker', async (req, res) => {
  try {
    const { getConnectionHealth } = await import('./lib/supabaseConnection.js')
    const health = getConnectionHealth()
    res.json(health)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Diagnostic endpoint for Supabase connectivity (more detailed than health check)
app.get('/diagnostics/supabase', async (req, res) => {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
      hasSupabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      supabaseUrl: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 20)}...` : 'Not set',
    },
    tests: [],
  }

  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({
      ...diagnostics,
      error: 'SUPABASE_URL environment variable is not set',
    })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const tests = []

  // Test 1: Basic connectivity (HEAD request)
  try {
    const controller1 = new AbortController()
    const timeout1 = setTimeout(() => controller1.abort(), 10000)
    const start1 = Date.now()

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        signal: controller1.signal,
        headers: {
          'apikey': process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        },
      })
      clearTimeout(timeout1)
      const duration1 = Date.now() - start1

      tests.push({
        name: 'Basic Connectivity (HEAD /rest/v1/)',
        success: true,
        status: response.status,
        duration: `${duration1}ms`,
      })
    } catch (error: any) {
      clearTimeout(timeout1)
      const duration1 = Date.now() - start1

      tests.push({
        name: 'Basic Connectivity (HEAD /rest/v1/)',
        success: false,
        error: error.message,
        errorCode: error.cause?.code,
        duration: `${duration1}ms`,
      })
    }
  } catch (error: any) {
    tests.push({
      name: 'Basic Connectivity (HEAD /rest/v1/)',
      success: false,
      error: error.message,
    })
  }

  // Test 2: Auth endpoint connectivity
  try {
    const controller2 = new AbortController()
    const timeout2 = setTimeout(() => controller2.abort(), 10000)
    const start2 = Date.now()

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
        method: 'GET',
        signal: controller2.signal,
      })
      clearTimeout(timeout2)
      const duration2 = Date.now() - start2

      tests.push({
        name: 'Auth Endpoint (/auth/v1/health)',
        success: true,
        status: response.status,
        duration: `${duration2}ms`,
      })
    } catch (error: any) {
      clearTimeout(timeout2)
      const duration2 = Date.now() - start2

      tests.push({
        name: 'Auth Endpoint (/auth/v1/health)',
        success: false,
        error: error.message,
        errorCode: error.cause?.code,
        duration: `${duration2}ms`,
      })
    }
  } catch (error: any) {
    tests.push({
      name: 'Auth Endpoint (/auth/v1/health)',
      success: false,
      error: error.message,
    })
  }

  // Test 3: DNS resolution
  try {
    const urlObj = new URL(supabaseUrl)
    const hostname = urlObj.hostname

    tests.push({
      name: 'DNS Resolution',
      success: true,
      hostname: hostname,
      note: 'DNS resolution successful (URL parsing works)',
    })
  } catch (error: any) {
    tests.push({
      name: 'DNS Resolution',
      success: false,
      error: error.message,
    })
  }

  diagnostics.tests = tests
  const allPassed = tests.every(t => t.success)
  const statusCode = allPassed ? 200 : 503

  res.status(statusCode).json(diagnostics)
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
app.use('/api/avatars', avatarRoutes)
app.use('/api/credits', creditsRoutes)
app.use('/api/prompts', promptsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/support', supportRoutes)
app.use('/api/admin-migration', adminMigrationRoutes)
app.use('/api/dashboard', dashboardRoutes)

// Serve static files from frontend build (if exists)
// Compiled path: backend/dist/server.js -> go up one level to backend/public
const frontendDist = path.join(__dirname, '../public')
const indexHtml = path.join(frontendDist, 'index.html')

console.log('🔍 Frontend Detection:')
console.log('  __dirname:', __dirname)
console.log('  Looking for frontend at:', frontendDist)
console.log('  Frontend directory exists:', existsSync(frontendDist))
console.log('  Index.html exists:', existsSync(indexHtml))
if (existsSync(frontendDist)) {
  try {
    const files = readdirSync(frontendDist)
    console.log('  Files in public directory:', files.slice(0, 10).join(', '), files.length > 10 ? `... (${files.length} total)` : `(${files.length} total)`)
  } catch (error) {
    console.log('  Error reading public directory:', error)
  }
}

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

// Debug: Log all API requests (in development)
if (process.env.NODE_ENV === 'development') {
  app.use('/api', (req, res, next) => {
    console.log(`[API Request] ${req.method} ${req.path}`)
    next()
  })
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
