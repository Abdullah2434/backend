import crypto from 'crypto'
import { Request, Response, NextFunction } from 'express'

interface CSRFTokenData {
  token: string
  expires: number
}

// In-memory storage for CSRF tokens (use Redis in production)
const csrfTokenStore = new Map<string, CSRFTokenData>()

export class ServerCSRFProtection {
  private static TOKEN_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours
  private static SECRET_KEY = process.env.CSRF_SECRET || 'default-csrf-secret-key'

  /**
   * Generate a new CSRF token
   */
  static generateToken(): string {
    const timestamp = Date.now().toString()
    const random = crypto.randomBytes(16).toString('hex')
    const payload = `${timestamp}-${random}`
    
    const hmac = crypto.createHmac('sha256', this.SECRET_KEY)
    hmac.update(payload)
    const signature = hmac.digest('hex')
    
    const token = `${payload}.${signature}`
    
    // Store token with expiry
    csrfTokenStore.set(token, {
      token,
      expires: Date.now() + this.TOKEN_EXPIRY
    })
    
    return token
  }

  /**
   * Validate a CSRF token
   */
  static validateToken(token: string): boolean {
    try {
      if (!token) return false
      
      // Check if token exists in store
      const tokenData = csrfTokenStore.get(token)
      if (!tokenData) return false
      
      // Check if token has expired
      if (Date.now() > tokenData.expires) {
        csrfTokenStore.delete(token)
        return false
      }
      
      // Parse token
      const parts = token.split('.')
      if (parts.length !== 2) return false
      
      const [payload, signature] = parts
      
      // Verify signature
      const hmac = crypto.createHmac('sha256', this.SECRET_KEY)
      hmac.update(payload)
      const expectedSignature = hmac.digest('hex')
      
      return signature === expectedSignature
    } catch (error) {
      console.error('CSRF token validation error:', error)
      return false
    }
  }

  /**
   * Clean up expired tokens
   */
  static cleanup(): void {
    const now = Date.now()
    for (const [token, data] of csrfTokenStore.entries()) {
      if (now > data.expires) {
        csrfTokenStore.delete(token)
      }
    }
  }

  /**
   * Express middleware for CSRF protection
   */
  static middleware(excludePaths: string[] = []) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip CSRF for GET requests
      if (req.method === 'GET') {
        return next()
      }

      // Skip CSRF for excluded paths
      if (excludePaths.some(path => req.path.startsWith(path))) {
        return next()
      }

      const csrfToken = req.headers['x-csrf-token'] as string
      
      if (!csrfToken || !ServerCSRFProtection.validateToken(csrfToken)) {
        console.log(`🔒 CSRF validation failed for ${req.method} ${req.path}`)
        return res.status(403).json({
          success: false,
          message: 'CSRF token validation failed'
        })
      }

      next()
    }
  }
}

/**
 * Generate CSRF token endpoint
 */
export async function generateCSRFToken(): Promise<{ token: string; expires: number }> {
  const token = ServerCSRFProtection.generateToken()
  return {
    token,
    expires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  }
}

// Cleanup expired tokens every hour
setInterval(() => {
  ServerCSRFProtection.cleanup()
}, 60 * 60 * 1000)
