import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import {
  ContactResponse,
  ContactError,
  RateLimitError,
} from "../types/contact.types";

// ==================== RATE LIMITING ====================

export const createContactRateLimit = (
  windowMs: number = 15 * 60 * 1000,
  max: number = 3
) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: "Too many contact form submissions. Please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const response: ContactResponse = {
        success: false,
        message: "Too many contact form submissions. Please try again later.",
      };
      res.status(429).json(response);
    },
  });
};

// Default rate limits
export const contactFormRateLimit = createContactRateLimit(15 * 60 * 1000, 3); // 3 submissions per 15 minutes
export const contactHealthRateLimit = createContactRateLimit(60 * 1000, 10); // 10 requests per minute

// ==================== SECURITY MIDDLEWARE ====================

export const securityHeaders = (
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

export const requestSizeLimit = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contentLength = parseInt(req.headers["content-length"] || "0");
  const maxSize = 1024 * 1024; // 1MB

  if (contentLength > maxSize) {
    const response: ContactResponse = {
      success: false,
      message: "Request payload too large. Maximum size is 1MB.",
    };
    res.status(413).json(response);
    return;
  }

  next();
};

// ==================== REQUEST LOGGING ====================

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();
  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers["user-agent"],
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString(),
    };

    console.log("📧 Contact API Request:", JSON.stringify(logData, null, 2));
    return originalSend.call(this, data);
  };

  next();
};

// ==================== ERROR HANDLING ====================

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("📧 Contact API Error:", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  let statusCode = 500;
  let message = "Internal server error";

  if (error instanceof ContactError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
  } else if (error.name === "RateLimitError") {
    statusCode = 429;
    message = "Too many requests";
  }

  const response: ContactResponse = {
    success: false,
    message,
  };

  res.status(statusCode).json(response);
};

// ==================== CORS CONFIGURATION ====================

export const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL || "https://www.edgeairealty.com",
      "http://localhost:3000",
      "http://localhost:3001",
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: [
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
  ],
};

// ==================== INPUT SANITIZATION ====================

export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.body) {
    // Remove any potential XSS attempts
    const sanitizeString = (str: string): string => {
      return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/javascript:/gi, "")
        .replace(/on\w+\s*=/gi, "")
        .trim();
    };

    const sanitizeObject = (obj: any): any => {
      if (typeof obj === "string") {
        return sanitizeString(obj);
      } else if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      } else if (obj && typeof obj === "object") {
        const sanitized: any = {};
        for (const key in obj) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
        return sanitized;
      }
      return obj;
    };

    req.body = sanitizeObject(req.body);
  }

  next();
};

// ==================== HEALTH CHECK MIDDLEWARE ====================

export const healthCheck = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.path === "/health" || req.path === "/status") {
    const healthData = {
      status: "healthy",
      service: "contact",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || "1.0.0",
    };

    res.status(200).json(healthData);
    return;
  }

  next();
};

// ==================== REQUEST ID MIDDLEWARE ====================

export const requestId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const id =
    req.headers["x-request-id"] ||
    `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.headers["x-request-id"] = id;
  res.setHeader("X-Request-ID", id);
  next();
};

// ==================== CONTENT TYPE VALIDATION ====================

export const validateContentType = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.method === "POST" || req.method === "PUT") {
    const contentType = req.headers["content-type"];
    if (!contentType || !contentType.includes("application/json")) {
      const response: ContactResponse = {
        success: false,
        message: "Content-Type must be application/json",
      };
      res.status(400).json(response);
      return;
    }
  }

  next();
};
