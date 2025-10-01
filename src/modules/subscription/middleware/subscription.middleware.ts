import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import {
  SubscriptionResponse,
  SubscriptionError,
  RateLimitError,
  AuthenticationError,
} from "../types/subscription.types";
import AuthService from "../../auth/services/auth.service";

const authService = new AuthService();

// ==================== RATE LIMITING ====================

export const createSubscriptionRateLimit = (
  windowMs: number = 15 * 60 * 1000,
  max: number = 10
) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: "Too many subscription requests. Please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const response: SubscriptionResponse = {
        success: false,
        message: "Too many subscription requests. Please try again later.",
      };
      res.status(429).json(response);
    },
  });
};

// Default rate limits
export const subscriptionGeneralRateLimit = createSubscriptionRateLimit(
  15 * 60 * 1000,
  10
); // 10 requests per 15 minutes
export const subscriptionCreateRateLimit = createSubscriptionRateLimit(
  5 * 60 * 1000,
  3
); // 3 subscriptions per 5 minutes
export const subscriptionPaymentRateLimit = createSubscriptionRateLimit(
  5 * 60 * 1000,
  5
); // 5 payment intents per 5 minutes
export const subscriptionPublicRateLimit = createSubscriptionRateLimit(
  1 * 60 * 1000,
  20
); // 20 requests per minute for public endpoints

// ==================== AUTHENTICATION MIDDLEWARE ====================

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const response: SubscriptionResponse = {
        success: false,
        message: "Access token is required",
      };
      res.status(401).json(response);
      return;
    }

    const token = authHeader.slice(7);
    const payload = authService.verifyToken(token);

    if (!payload) {
      const response: SubscriptionResponse = {
        success: false,
        message: "Invalid or expired access token",
      };
      res.status(401).json(response);
      return;
    }

    const user = await authService.getCurrentUser(token);
    if (!user) {
      const response: SubscriptionResponse = {
        success: false,
        message: "User not found",
      };
      res.status(401).json(response);
      return;
    }

    // Add user to request object
    req.user = {
      _id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    next();
  } catch (error) {
    const response: SubscriptionResponse = {
      success: false,
      message: "Authentication failed",
    };
    res.status(401).json(response);
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const payload = authService.verifyToken(token);

      if (payload) {
        const user = await authService.getCurrentUser(token);
        if (user) {
          req.user = {
            _id: user._id.toString(),
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          };
        }
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

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
  const maxSize = 1024 * 1024; // 1MB for subscription operations

  if (contentLength > maxSize) {
    const response: SubscriptionResponse = {
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
      userId: req.user?._id,
      timestamp: new Date().toISOString(),
    };

    console.log(
      "💳 Subscription API Request:",
      JSON.stringify(logData, null, 2)
    );
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
  console.error("💳 Subscription API Error:", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: req.user?._id,
    timestamp: new Date().toISOString(),
  });

  let statusCode = 500;
  let message = "Internal server error";

  if (error instanceof SubscriptionError) {
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
    message = "Authentication required";
  } else if (error.name === "AuthorizationError") {
    statusCode = 403;
    message = "Insufficient permissions";
  } else if (error.name === "NotFoundError") {
    statusCode = 404;
    message = "Resource not found";
  } else if (error.name === "StripeError") {
    statusCode = 502;
    message = "Payment processing error";
  } else if (error.name === "PlanError") {
    statusCode = 400;
    message = "Invalid subscription plan";
  } else if (error.name === "PaymentError") {
    statusCode = 402;
    message = "Payment processing failed";
  }

  const response: SubscriptionResponse = {
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
      service: "subscription",
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
    `subscription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      const response: SubscriptionResponse = {
        success: false,
        message: "Content-Type must be application/json",
      };
      res.status(400).json(response);
      return;
    }
  }

  next();
};

// ==================== SUBSCRIPTION SPECIFIC MIDDLEWARE ====================

export const validateSubscriptionOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      const response: SubscriptionResponse = {
        success: false,
        message: "User authentication required",
      };
      res.status(400).json(response);
      return;
    }

    // This would typically check database for subscription ownership
    // For now, we'll just continue
    next();
  } catch (error) {
    const response: SubscriptionResponse = {
      success: false,
      message: "Failed to validate subscription ownership",
    };
    res.status(500).json(response);
  }
};

export const requireEmailVerification = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // This would typically check if user's email is verified
  // For now, we'll just continue
  next();
};

export const checkSubscriptionStatus = (
  allowedStatuses: string[] = ["active", "trialing"]
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?._id;

      if (!userId) {
        const response: SubscriptionResponse = {
          success: false,
          message: "User authentication required",
        };
        res.status(401).json(response);
        return;
      }

      // This would typically check the user's subscription status
      // For now, we'll just continue
      next();
    } catch (error) {
      const response: SubscriptionResponse = {
        success: false,
        message: "Failed to check subscription status",
      };
      res.status(500).json(response);
    }
  };
};

export const checkVideoLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      const response: SubscriptionResponse = {
        success: false,
        message: "User authentication required",
      };
      res.status(401).json(response);
      return;
    }

    // This would typically check the user's video limit
    // For now, we'll just continue
    next();
  } catch (error) {
    const response: SubscriptionResponse = {
      success: false,
      message: "Failed to check video limit",
    };
    res.status(500).json(response);
  }
};
