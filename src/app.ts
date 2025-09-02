import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { json, urlencoded } from 'express'
import mongoose from 'mongoose'
import routes from './routes/index'
import { ApiResponse, HealthResponse } from './types'
import { 
  apiRateLimiter, 
  ServerCSRFProtection, 
  securityHeaders, 
  validateRequest, 
  sanitizeInputs,
  authenticate 
} from './middleware'

const app = express()

// Trust proxy for rate limiting (when behind reverse proxy)
app.set('trust proxy', 1)

// Security middleware (must be first)
app.use(securityHeaders())
app.use(validateRequest())

// Basic Express middleware
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: false }))
// Only use morgan in development
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}

// Body parsing middleware
app.use(json({ limit: '10mb' }))
app.use(urlencoded({ extended: true }))

// Input sanitization (after body parsing)
app.use(sanitizeInputs())

// Rate limiting (for all API routes) - Disable in serverless
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.use('/api', apiRateLimiter.middleware())
}

// CSRF protection (exclude specific paths) - Disable in serverless for now
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.use(ServerCSRFProtection.middleware([
    '/api/video/download',
    '/api/video/status', 
    '/api/webhook'
  ]))
}

// NOTE: Authentication middleware is applied per-route in route files

// Health
app.get('/health', (_req, res) => {
  const healthResponse: ApiResponse = { 
    success: true, 
    message: 'Express backend is running successfully' 
  }
  res.json(healthResponse)
})

// MongoDB status endpoint
app.get('/mongo-status', (_req, res) => {
  const status = {
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
    connected: mongoose.connection.readyState === 1
  }
  
  res.json({
    success: true,
    data: status,
    message: status.connected ? 'MongoDB connected' : 'MongoDB not connected'
  })
})

// DB - Always connect to MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://hrehman:gGcCAnzoQszAmdn4@cluster0.ieng9e7.mongodb.net/edgeai-realty?retryWrites=true&w=majority&appName=Cluster0'

mongoose.connect(mongoUri, {
  bufferCommands: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
}).then(() => {
  console.log('✅ MongoDB connected successfully!')
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err)
  // Don't exit in production/serverless - just log the error
  if (process.env.NODE_ENV === 'development') {
    process.exit(1)
  }
})

// API routes under /api to mirror Next
app.use('/api', routes)

// 404
app.use((_req, res) => {
  const notFoundResponse: ApiResponse = { success: false, message: 'Not Found' }
  res.status(404).json(notFoundResponse)
})

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  const errorResponse: ApiResponse = { 
    success: false, 
    message: err.message || 'Internal server error' 
  }
  res.status(err.status || 500).json(errorResponse)
})

export default app


