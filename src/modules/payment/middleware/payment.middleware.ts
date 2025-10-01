import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import {
  PaymentResponse,
  PaymentError,
  RateLimitError,
  AuthenticationError,
} from "../types/payment.types";
import AuthService from "../../auth/services/auth.service";

const authService = new AuthService();

// ==================== RATE LIMITING ====================

export const createPaymentRateLimit = (
  windowMs: number = 15 * 60 * 1000,
  max: number = 10
) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: "Too many payment requests. Please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const response: PaymentResponse = {
        success: false,
        message: "Too many payment requests. Please try again later.",
      };
      res.status(429).json(response);
    },
  });
};

// Default rate limits
export const paymentGeneralRateLimit = createPaymentRateLimit(
  15 * 60 * 1000,
  10
); // 10 requests per 15 minutes
export const paymentSetupRateLimit = createPaymentRateLimit(5 * 60 * 1000, 5); // 5 setup intents per 5 minutes
export const paymentUpdateRateLimit = createPaymentRateLimit(5 * 60 * 1000, 10); // 10 updates per 5 minutes

// ==================== AUTHENTICATION MIDDLEWARE ====================

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const response: PaymentResponse = {
        success: false,
        message: "Access token is required",
      };
      res.status(401).json(response);
      return;
    }

    const token = authHeader.slice(7);
    const payload = authService.verifyToken(token);

    if (!payload) {
      const response: PaymentResponse = {
        success: false,
        message: "Invalid or expired access token",
      };
      res.status(401).json(response);
      return;
    }

    const user = await authService.getCurrentUser(token);
    if (!user) {
      const response: PaymentResponse = {
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
    const response: PaymentResponse = {
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
  const maxSize = 1024 * 1024; // 1MB for payment operations

  if (contentLength > maxSize) {
    const response: PaymentResponse = {
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

    console.log("💳 Payment API Request:", JSON.stringify(logData, null, 2));
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
  console.error("💳 Payment API Error:", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: req.user?._id,
    timestamp: new Date().toISOString(),
  });

  let statusCode = 500;
  let message = "Internal server error";

  if (error instanceof PaymentError) {
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
  }

  const response: PaymentResponse = {
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
      service: "payment",
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
    `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      const response: PaymentResponse = {
        success: false,
        message: "Content-Type must be application/json",
      };
      res.status(400).json(response);
      return;
    }
  }

  next();
};

// ==================== PAYMENT SPECIFIC MIDDLEWARE ====================

export const validatePaymentOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const paymentMethodId = req.params.paymentMethodId;
    const userId = req.user?._id;

    if (!paymentMethodId || !userId) {
      const response: PaymentResponse = {
        success: false,
        message: "Payment method ID and user authentication required",
      };
      res.status(400).json(response);
      return;
    }

    // This would typically check database for payment method ownership
    // For now, we'll just continue
    next();
  } catch (error) {
    const response: PaymentResponse = {
      success: false,
      message: "Failed to validate payment method ownership",
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
