import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import AuthService from "../../modules/auth/services/auth.service";

const authService = new AuthService();

// ==================== AUTHENTICATION MIDDLEWARE ====================

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Access token is required",
      });
      return;
    }

    const token = authHeader.slice(7);
    const payload = authService.verifyToken(token);

    if (!payload) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired access token",
      });
      return;
    }

    const user = await authService.getCurrentUser(token);
    if (!user) {
      res.status(401).json({
        success: false,
        message: "User not found",
      });
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
  } catch (error: any) {
    console.error("Authentication error:", error);
    res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ==================== SECURITY HEADERS MIDDLEWARE ====================

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

// ==================== RATE LIMITING MIDDLEWARE ====================

export const createRateLimiter = (options?: {
  windowMs?: number;
  max?: number;
  message?: string;
}) => {
  return rateLimit({
    windowMs: options?.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options?.max || 100, // limit each IP to 100 requests per windowMs
    message: {
      success: false,
      message: options?.message || "Too many requests, please try again later",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      console.log("Rate limit exceeded:", {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        timestamp: new Date().toISOString(),
      });

      res.status(429).json({
        success: false,
        message:
          options?.message || "Rate limit exceeded. Please try again later.",
      });
    },
  });
};

// Default rate limiters
export const generalRateLimit = createRateLimiter();
export const strictRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
});
export const apiRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
});

// ==================== ERROR HANDLING MIDDLEWARE ====================

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("Error:", {
    url: req.url,
    method: req.method,
    error: error.message,
    stack: error.stack,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  let statusCode = 500;
  let message = "Internal server error";

  if ((error as any).statusCode) {
    statusCode = (error as any).statusCode;
  }

  if ((error as any).message) {
    message = error.message;
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
};

// ==================== VALIDATION ERROR HANDLER ====================

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // This is typically handled by express-validator in the validation layer
  next();
};

// ==================== REQUEST LOGGING MIDDLEWARE ====================

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  console.log("Request received:", {
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

    console.log("Request completed:", {
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

// ==================== REQUEST SIZE LIMIT MIDDLEWARE ====================

export const requestSizeLimit = (maxSize: number = 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers["content-length"] || "0");

    if (contentLength > maxSize) {
      res.status(413).json({
        success: false,
        message: "Request size too large",
      });
      return;
    }

    next();
  };
};

// ==================== CONTENT TYPE VALIDATION MIDDLEWARE ====================

export const validateContentType = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contentType = req.headers["content-type"];

  // Validate content type for POST/PUT requests
  if (
    (req.method === "POST" || req.method === "PUT") &&
    contentType &&
    !contentType.includes("application/json") &&
    !contentType.includes("multipart/form-data")
  ) {
    res.status(400).json({
      success: false,
      message: "Content-Type must be application/json or multipart/form-data",
    });
    return;
  }

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
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
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

// ==================== REQUEST ID MIDDLEWARE ====================

export const requestId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = `req_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  (req as any).requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
};

// ==================== INPUT SANITIZATION MIDDLEWARE ====================

export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }
  next();
};

function sanitizeObject(obj: any): any {
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

function sanitizeString(str: string): string {
  return str.trim().replace(/[<>]/g, "").replace(/\s+/g, " ");
}
