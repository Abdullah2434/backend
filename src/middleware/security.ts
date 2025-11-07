import { Request, Response, NextFunction } from 'express'

/**
 * Strip all HTML tags from a string (server-safe)
 */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

/**
 * Enhanced input sanitization for form fields
 */
export function sanitizeInput(
  input: string,
  type: 'text' | 'email' | 'phone' | 'name' | 'company' | 'url' = 'text'
): string {
  if (!input) return ''

  let sanitized = input.trim()

  // Remove HTML tags
  sanitized = stripHtmlTags(sanitized)

  // Type-specific sanitization
  switch (type) {
    case 'email':
      // Email: Allow only valid email characters
      sanitized = sanitized.replace(/[^a-zA-Z0-9@._-]/g, '')
      break
      
    case 'phone':
      // Phone: Allow only numbers, spaces, +, -, (, )
      sanitized = sanitized.replace(/[^0-9\s+()-]/g, '')
      break
      
    case 'name':
      // Name: Allow letters, spaces, hyphens, apostrophes
      sanitized = sanitized.replace(/[^a-zA-Z\s'-]/g, '')
      break
      
    case 'company':
      // Company: Allow alphanumeric, spaces, common punctuation
      sanitized = sanitized.replace(/[^a-zA-Z0-9\s&.,'-]/g, '')
      break
      
    case 'url':
      // URL: Basic URL character sanitization
      sanitized = sanitized.replace(/[^a-zA-Z0-9:/?#[\]@!$&'()*+,;=._~-]/g, '')
      break
      
    case 'text':
    default:
      // General text: Remove most special characters but keep basic punctuation
      sanitized = sanitized.replace(/[<>\"'&]/g, '')
      break
  }

  // Limit length
  const maxLengths = {
    email: 254,
    phone: 20,
    name: 100,
    company: 200,
    url: 2048,
    text: 500
  }

  const maxLength = maxLengths[type] || maxLengths.text
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }

  return sanitized
}

/**
 * Sanitize request body recursively
 */
export function sanitizeRequestBody(body: any, endpoint: string): any {
  if (!body || typeof body !== 'object') {
    return body
  }

  const sanitized: any = {}

  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      // Skip length limits for TTS fields (hook, body, conclusion) - they can be very long
      const isTTSField = ['hook', 'body', 'conclusion'].includes(key.toLowerCase())
      
      if (isTTSField) {
        // For TTS fields, only remove HTML tags and dangerous characters, but don't limit length
        let cleaned = value.trim()
        cleaned = stripHtmlTags(cleaned)
        cleaned = cleaned.replace(/[<>\"'&]/g, '')
        sanitized[key] = cleaned
        continue
      }
      
      // Determine sanitization type based on field name
      let sanitizationType: Parameters<typeof sanitizeInput>[1] = 'text'
      
      if (key.toLowerCase().includes('email')) {
        sanitizationType = 'email'
      } else if (key.toLowerCase().includes('phone')) {
        sanitizationType = 'phone'
      } else if (key.toLowerCase().includes('name')) {
        sanitizationType = 'name'
      } else if (key.toLowerCase().includes('company')) {
        sanitizationType = 'company'
      } else if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) {
        sanitizationType = 'url'
      }

      sanitized[key] = sanitizeInput(value, sanitizationType)
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeRequestBody(value, endpoint)
    } else {
      // Keep non-string values as-is (numbers, booleans, etc.)
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Security headers middleware
 */
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-XSS-Protection', '1; mode=block')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('X-Request-ID', generateRequestId())
    res.setHeader('X-Timestamp', new Date().toISOString())
    
    next()
  }
}

/**
 * Request validation middleware
 */
export function validateRequest() {
  return (req: Request, res: Response, next: NextFunction) => {
    const { path, url } = req
    
    // Block common attack patterns
    const suspiciousPatterns = [
      /\.\.\//, // Path traversal
      /<script>/i, // XSS attempts in URL
      /union.*select/i, // SQL injection attempts
      /wp-admin/, // WordPress admin access attempts
      /\.env/, // Environment file access attempts
      /\.git/, // Git directory access attempts
      /phpMyAdmin/i, // phpMyAdmin access attempts
    ]
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(path) || pattern.test(url)) {
        console.log(`🔒 Blocked suspicious request: ${req.method} ${path}`)
        return res.status(403).json({
          success: false,
          message: 'Forbidden'
        })
      }
    }
    
    // Block requests with suspicious headers
    const userAgent = (req.headers['user-agent'] || '').toLowerCase()
    const suspiciousUserAgents = [
      'sqlmap',
      'nikto',
      'masscan',
      'nmap',
      'burp',
      'havij'
    ]
    
    for (const agent of suspiciousUserAgents) {
      if (userAgent.includes(agent)) {
        console.log(`🔒 Blocked suspicious user agent: ${userAgent}`)
        return res.status(403).json({
          success: false,
          message: 'Forbidden'
        })
      }
    }
    
    next()
  }
}

/**
 * Input sanitization middleware
 */
export function sanitizeInputs() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeRequestBody(req.body, req.path)
    }
    next()
  }
}

/**
 * Generate a simple UUID-like string
 */
function generateRequestId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}
