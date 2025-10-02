import { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { logger } from "../utils/logger";

export const securityHeaders = () => {
  return helmet({
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });
};

export const createRateLimiter = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options.max || 100, // limit each IP to 100 requests per windowMs
    message:
      options.message ||
      "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        message: "Too many requests from this IP, please try again later.",
      });
    },
  });
};

export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes
  message: "Too many API requests from this IP, please try again later.",
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 auth attempts per 15 minutes
  message: "Too many authentication attempts, please try again later.",
});

export const validateRequest = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Basic request validation - only validate if body parsing has happened
    // Skip validation for GET, DELETE, OPTIONS requests
    if (
      req.method === "POST" ||
      req.method === "PUT" ||
      req.method === "PATCH"
    ) {
      // Only validate if body parser has run and body should be present
      // Allow empty body for some routes (webhooks, file uploads)
      if (
        req.path &&
        (req.path.startsWith("/api/webhook") ||
          req.path.includes("/photo-avatar") ||
          req.path.includes("/generate-video"))
      ) {
        return next();
      }
      // For other routes, body validation is done at controller level
    }
    next();
  };
};

export const sanitizeInputs = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Basic input sanitization
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === "string") {
        return obj.trim();
      }
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      if (obj && typeof obj === "object") {
        const sanitized: any = {};
        for (const key in obj) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
        return sanitized;
      }
      return obj;
    };

    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  };
};
