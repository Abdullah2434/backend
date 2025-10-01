import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import {
  TrendsRequest,
  TrendsResponse,
  TrendsError,
  RateLimitError,
} from "../types/trends.types";
import {
  logTrendsEvent,
  logTrendsError,
  getTrendsConfig,
} from "../utils/trends.utils";

// ==================== AUTHENTICATION MIDDLEWARE ====================

export const authenticate = (
  req: TrendsRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // For trends, we might want to make it public or require basic auth
    // This is a placeholder for future authentication logic
    const apiKey = req.headers["x-api-key"] as string;
    const config = getTrendsConfig();

    if (config.apiKey && config.apiKey !== apiKey) {
      logTrendsEvent("authentication_failed", {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        apiKey: apiKey ? "***" : "missing",
      });

      const response: TrendsResponse = {
        success: false,
        message: "Invalid API key",
      } as any;

      res.status(401).json(response);
      return;
    }

    // Add user info to request if available
    if (apiKey) {
      req.user = {
        _id: "api_user",
        email: "api@trends.com",
        firstName: "API",
        lastName: "User",
      };
    }

    next();
  } catch (error: any) {
    logTrendsError(error, { action: "authenticate" });
    const response: TrendsResponse = {
      success: false,
      message: "Authentication error",
    } as any;
    res.status(500).json(response);
  }
};

// ==================== RATE LIMITING MIDDLEWARE ====================

export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logTrendsEvent("rate_limit_exceeded", {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      timestamp: new Date().toISOString(),
    });

    res.status(429).json({
      success: false,
      message: "Rate limit exceeded. Please try again later.",
    });
  },
});

// ==================== VALIDATION ERROR HANDLER ====================

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // This middleware is handled by express-validator in the validation layer
  next();
};

// ==================== ERROR HANDLER MIDDLEWARE ====================

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logTrendsError(error, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  let statusCode = 500;
  let message = "Internal server error";

  if (error.name === "TrendsError") {
    statusCode = (error as any).statusCode || 500;
    message = error.message;
  } else if (error.name === "RateLimitError") {
    statusCode = 429;
    message = error.message;
  }

  const response: TrendsResponse = {
    success: false,
    message,
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
  } as any;

  res.status(statusCode).json(response);
};

// ==================== REQUEST LOGGING MIDDLEWARE ====================

export const logTrendsRequest = (
  req: TrendsRequest,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  logTrendsEvent("trends_request_received", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    timestamp: new Date().toISOString(),
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function (body: any) {
    const processingTime = Date.now() - startTime;

    logTrendsEvent("trends_request_completed", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      processingTime,
      success: res.statusCode < 400,
    });

    return originalJson.call(this, body);
  };

  next();
};

// ==================== HEADER VALIDATION MIDDLEWARE ====================

export const validateTrendsHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contentType = req.headers["content-type"];
  const userAgent = req.headers["user-agent"];

  // Validate content type for POST requests
  if (
    req.method === "POST" &&
    contentType &&
    !contentType.includes("application/json")
  ) {
    const response: TrendsResponse = {
      success: false,
      message: "Content-Type must be application/json",
    } as any;

    res.status(400).json(response);
    return;
  }

  // Validate user agent
  if (!userAgent || userAgent.length < 10) {
    logTrendsEvent("invalid_user_agent", {
      ip: req.ip,
      userAgent: userAgent || "missing",
    });
  }

  next();
};

// ==================== SECURITY HEADERS MIDDLEWARE ====================

export const setSecurityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Set security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );

  next();
};

// ==================== CORS MIDDLEWARE ====================

export const corsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-API-Key"
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  next();
};

// ==================== REQUEST SIZE LIMIT MIDDLEWARE ====================

export const requestSizeLimit = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contentLength = parseInt(req.headers["content-length"] || "0");
  const maxSize = 1024 * 1024; // 1MB

  if (contentLength > maxSize) {
    const response: TrendsResponse = {
      success: false,
      message: "Request size too large",
    } as any;

    res.status(413).json(response);
    return;
  }

  next();
};

// ==================== COMPRESSION MIDDLEWARE ====================

export const compressionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Set compression headers
  res.setHeader("Content-Encoding", "gzip");
  res.setHeader("Vary", "Accept-Encoding");

  next();
};

// ==================== CACHE CONTROL MIDDLEWARE ====================

export const cacheControl = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Set cache control headers
  if (req.method === "GET") {
    res.setHeader("Cache-Control", "public, max-age=300"); // 5 minutes
  } else {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  }

  next();
};
