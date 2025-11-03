import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { errorHandler } from './middleware/errorHandler.js'
import { apiLimiter } from './middleware/rateLimiter.js'
import authRoutes from './routes/auth.js'
import videoRoutes from './routes/videos.js'
import socialRoutes from './routes/social.js'
import postRoutes from './routes/posts.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(apiLimiter)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes

app.use('/api/auth', authRoutes)
app.use('/api/videos', videoRoutes)
app.use('/api/social', socialRoutes)
app.use('/api/posts', postRoutes)

// Error handler
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

