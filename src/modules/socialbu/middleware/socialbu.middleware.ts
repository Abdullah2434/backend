import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import {
  SocialBuResponse,
  SocialBuError,
  AuthenticationError,
} from "../types/socialbu.types";
import {
  logSocialBuEvent,
  logSocialBuError,
  getSocialBuConfig,
  maskAuthToken,
  maskAccountId,
  maskMediaId,
} from "../utils/socialbu.utils";

// ==================== RATE LIMITING ====================

export const createSocialBuRateLimit = (
  windowMs: number = 60 * 1000,
  max: number = 100
) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: "Too many SocialBu requests. Please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const response: SocialBuResponse = {
        success: false,
        message: "Too many SocialBu requests. Please try again later.",
      };
      res.status(429).json(response);
    },
  });
};

// Default rate limits
export const socialBuGeneralRateLimit = createSocialBuRateLimit(60 * 1000, 100); // 100 requests per minute
export const socialBuApiRateLimit = createSocialBuRateLimit(60 * 1000, 200); // 200 API calls per minute
export const socialBuWebhookRateLimit = createSocialBuRateLimit(60 * 1000, 50); // 50 webhooks per minute

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
  const maxSize = 10 * 1024 * 1024; // 10MB for media uploads

  if (contentLength > maxSize) {
    const response: SocialBuResponse = {
      success: false,
      message: "Request payload too large. Maximum size is 10MB.",
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
      userId: (req as any).user?._id,
      timestamp: new Date().toISOString(),
    };

    console.log("📱 SocialBu API Request:", JSON.stringify(logData, null, 2));
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
  console.error("📱 SocialBu API Error:", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: (req as any).user?._id,
    timestamp: new Date().toISOString(),
  });

  let statusCode = 500;
  let message = "Internal server error";

  if (error instanceof SocialBuError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
  } else if (error.name === "RateLimitError") {
    statusCode = 429;
    message = "Too many requests";
  } else if (error.name === "AuthenticationError") {
    statusCode = 401;
    message = "Authentication failed";
  } else if (error.name === "ApiError") {
    statusCode = 500;
    message = "SocialBu API error";
  } else if (error.name === "MediaError") {
    statusCode = 500;
    message = "Media processing error";
  } else if (error.name === "AccountError") {
    statusCode = 500;
    message = "Account management error";
  }

  const response: SocialBuResponse = {
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
      "https://api.socialbu.com",
      "https://socialbu.com",
      process.env.FRONTEND_URL || "http://localhost:3000",
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-SocialBu-Token",
  ],
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
      service: "socialbu",
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
    `socialbu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      const response: SocialBuResponse = {
        success: false,
        message: "Content-Type must be application/json",
      };
      res.status(400).json(response);
      return;
    }
  }

  next();
};

// ==================== SOCIALBU SPECIFIC MIDDLEWARE ====================

export const validateSocialBuToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = req.headers["x-socialbu-token"] as string;

    if (!token) {
      logSocialBuEvent("missing_token", {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      const response: SocialBuResponse = {
        success: false,
        message: "SocialBu token is required",
      };
      res.status(401).json(response);
      return;
    }

    // Additional token validation will be done in the service layer
    next();
  } catch (error) {
    logSocialBuError(error as Error, { action: "validateSocialBuToken" });
    const response: SocialBuResponse = {
      success: false,
      message: "Token validation failed",
    };
    res.status(401).json(response);
  }
};

export const logSocialBuRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = req.headers["x-socialbu-token"] as string;

  logSocialBuEvent("socialbu_request_received", {
    token: token ? maskAuthToken(token) : undefined,
    contentType: req.headers["content-type"],
    contentLength: req.headers["content-length"],
    userAgent: req.headers["user-agent"],
    ip: req.ip,
    userId: (req as any).user?._id,
  });

  next();
};

export const requireAuthentication = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!(req as any).user) {
    const response: SocialBuResponse = {
      success: false,
      message: "Authentication required",
    };
    res.status(401).json(response);
    return;
  }

  next();
};

export const socialBuSecurity = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log security-relevant information
  const securityData = {
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    token: req.headers["x-socialbu-token"]
      ? maskAuthToken(req.headers["x-socialbu-token"] as string)
      : undefined,
    userId: (req as any).user?._id,
    timestamp: new Date().toISOString(),
  };

  logSocialBuEvent("socialbu_security_check", securityData);
  next();
};

// ==================== ACCOUNT OWNERSHIP VALIDATION ====================

export const validateAccountOwnership = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const userId = (req as any).user?._id;
    const accountId = req.params.accountId;

    if (!userId) {
      const response: SocialBuResponse = {
        success: false,
        message: "User authentication required",
      };
      res.status(401).json(response);
      return;
    }

    // Store userId in request for use in controllers
    (req as any).userId = userId;
    next();
  } catch (error) {
    logSocialBuError(error as Error, { action: "validateAccountOwnership" });
    const response: SocialBuResponse = {
      success: false,
      message: "Account ownership validation failed",
    };
    res.status(500).json(response);
  }
};

// ==================== MEDIA OWNERSHIP VALIDATION ====================

export const validateMediaOwnership = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const userId = (req as any).user?._id;
    const mediaId = req.params.mediaId;

    if (!userId) {
      const response: SocialBuResponse = {
        success: false,
        message: "User authentication required",
      };
      res.status(401).json(response);
      return;
    }

    // Store userId in request for use in controllers
    (req as any).userId = userId;
    next();
  } catch (error) {
    logSocialBuError(error as Error, { action: "validateMediaOwnership" });
    const response: SocialBuResponse = {
      success: false,
      message: "Media ownership validation failed",
    };
    res.status(500).json(response);
  }
};

// ==================== WEBHOOK SECURITY ====================

export const validateWebhookSignature = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const signature = req.headers["x-socialbu-signature"] as string;
    const config = getSocialBuConfig();

    if (!signature) {
      logSocialBuEvent("missing_webhook_signature", {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      const response: SocialBuResponse = {
        success: false,
        message: "Webhook signature is required",
      };
      res.status(401).json(response);
      return;
    }

    // Additional signature validation will be done in the service layer
    next();
  } catch (error) {
    logSocialBuError(error as Error, { action: "validateWebhookSignature" });
    const response: SocialBuResponse = {
      success: false,
      message: "Webhook signature validation failed",
    };
    res.status(401).json(response);
  }
};
