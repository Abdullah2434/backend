import mongoose from 'mongoose'
import { DatabaseConfig } from '../types'

let cached: typeof mongoose | null = null

export async function connectMongo() {
  if (cached) return cached
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is required')
  mongoose.set('strictQuery', true)
  
  // Connection pooling configuration for production scalability
  cached = await mongoose.connect(uri, {
    bufferCommands: true,
    serverSelectionTimeoutMS: 10000, // How long to try selecting a server
    socketTimeoutMS: 45000, // How long to wait for socket operations
    
    // Connection Pool Settings
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || 10, // Maximum number of connections in the pool
    minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE) || 2, // Minimum number of connections to maintain
    maxIdleTimeMS: Number(process.env.MONGODB_MAX_IDLE_TIME_MS) || 30000, // Close idle connections after 30s
    
    // Connection Timeout
    connectTimeoutMS: 10000, // How long to wait for initial connection
    
    // Retry Settings
    retryWrites: true, // Retry write operations on network errors
    retryReads: true, // Retry read operations on network errors
    
    // Heartbeat Settings
    heartbeatFrequencyMS: 10000, // How often to check server status
    
    // Additional Options
    compressors: ['zlib'], // Enable compression for network traffic
  })
  
  // Handle connection events
  mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB connected successfully')
  })
  
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err)
  })
  
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected')
  })
  
  // Log connection pool status
  if (process.env.NODE_ENV !== 'production') {
    mongoose.connection.on('open', () => {
      const poolSize = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
      console.log(`📊 MongoDB connection pool status: ${poolSize}`)
    })
  }
  
  return cached
}


