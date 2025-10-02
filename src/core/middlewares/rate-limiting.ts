import { Request, Response, NextFunction } from "express";
import { RateLimitConfig } from "../../types";

interface RateLimitData {
  count: number;
  resetTime: number;
}

// In-memory storage for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, RateLimitData>();

export class ServerRateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if request is rate limited
   */
  isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const data = rateLimitStore.get(identifier);

    if (!data) {
      // First request
      rateLimitStore.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return false;
    }

    // Check if window has reset
    if (now > data.resetTime) {
      rateLimitStore.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return false;
    }

    // Increment count
    data.count++;

    // Check if limit exceeded
    if (data.count > this.config.max) {
      return true;
    }

    return false;
  }

  /**
   * Create Express middleware
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIP =
        (req.headers["x-forwarded-for"] as string) ||
        (req.headers["x-real-ip"] as string) ||
        req.ip ||
        "anonymous";

      if (this.isRateLimited(clientIP)) {
        const data = rateLimitStore.get(clientIP);
        const retryAfter = data
          ? Math.ceil((data.resetTime - Date.now()) / 1000)
          : 60;

        console.log(
          `🔒 Rate limited: ${req.method} ${req.path} from ${clientIP}`
        );

        return res.status(429).json({
          success: false,
          message: this.config.message,
          retryAfter,
        });
      }

      next();
    };
  }
}

// Rate limiting configurations for DEVELOPMENT (increased limits)
export const rateLimitConfigs = {
  login: {
    windowMs: 5 * 60 * 1000, // 5 minutes (reduced from 15)
    max: 20, // 20 attempts per window (increased from 5)
    message: "Too many login attempts. Please try again in 5 minutes.",
  },
  register: {
    windowMs: 10 * 60 * 1000, // 10 minutes (reduced from 1 hour)
    max: 10, // 10 registrations per 10 minutes (increased from 3 per hour)
    message: "Too many registration attempts. Please try again in 10 minutes.",
  },
  passwordReset: {
    windowMs: 5 * 60 * 1000, // 5 minutes (reduced from 30)
    max: 10, // 10 password reset attempts per window (increased from 3)
    message: "Too many password reset attempts. Please try again in 5 minutes.",
  },
  general: {
    windowMs: 30 * 1000, // 30 seconds (reduced from 1 minute)
    max: 50, // 50 requests per 30 seconds (increased from 20 per minute)
    message: "Too many requests. Please try again later.",
  },
  api: {
    windowMs: 30 * 1000, // 30 seconds (reduced from 1 minute)
    max: 200, // 200 requests per 30 seconds (increased from 60 per minute)
    message: "API rate limit exceeded. Please try again later.",
  },
};

// Create rate limiters
export const loginRateLimiter = new ServerRateLimiter(rateLimitConfigs.login);
export const registerRateLimiter = new ServerRateLimiter(
  rateLimitConfigs.register
);
export const passwordResetRateLimiter = new ServerRateLimiter(
  rateLimitConfigs.passwordReset
);
export const generalAuthRateLimiter = new ServerRateLimiter(
  rateLimitConfigs.general
);
export const apiRateLimiter = new ServerRateLimiter(rateLimitConfigs.api);

/**
 * Get appropriate rate limiter for the route
 */
export function getRateLimiter(pathname: string): ServerRateLimiter {
  if (pathname.includes("/login")) {
    return loginRateLimiter;
  }
  if (pathname.includes("/register")) {
    return registerRateLimiter;
  }
  if (
    pathname.includes("/forgot-password") ||
    pathname.includes("/reset-password")
  ) {
    return passwordResetRateLimiter;
  }
  if (pathname.startsWith("/api/auth/")) {
    return generalAuthRateLimiter;
  }
  return apiRateLimiter;
}
