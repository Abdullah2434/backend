import { Request, Response, NextFunction } from "express";
import {
  AuthResponse,
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from "../types/auth.types";
import AuthService from "../services/auth.service";

// ==================== VALIDATION MIDDLEWARE ====================

// ==================== AUTHENTICATION MIDDLEWARE ====================

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const response: AuthResponse = {
      success: false,
      message: "Access token is required",
    };
    res.status(401).json(response);
    return;
  }

  const token = authHeader.slice(7);

  if (!token) {
    const response: AuthResponse = {
      success: false,
      message: "Access token is required",
    };
    res.status(401).json(response);
    return;
  }

  // Verify token and attach user to request
  const authService = new AuthService();

  authService
    .getCurrentUser(token)
    .then((user) => {
      if (!user) {
        const response: AuthResponse = {
          success: false,
          message: "Invalid or expired access token",
        };
        res.status(401).json(response);
        return;
      }

      // Attach user to request object
      (req as any).user = user;
      next();
    })
    .catch((error) => {
      console.error("Authentication error:", error);
      const response: AuthResponse = {
        success: false,
        message: "Authentication failed",
      };
      res.status(500).json(response);
    });
};

// ==================== OPTIONAL AUTHENTICATION MIDDLEWARE ====================

export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  if (!token) {
    next();
    return;
  }

  const authService = new AuthService();

  authService
    .getCurrentUser(token)
    .then((user) => {
      if (user) {
        (req as any).user = user;
      }
      next();
    })
    .catch(() => {
      // Ignore errors for optional auth
      next();
    });
};

// ==================== EMAIL VERIFICATION MIDDLEWARE ====================

export const requireEmailVerification = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const user = (req as any).user;

  if (!user) {
    const response: AuthResponse = {
      success: false,
      message: "Authentication required",
    };
    res.status(401).json(response);
    return;
  }

  if (!user.isEmailVerified) {
    const response: AuthResponse = {
      success: false,
      message: "Email verification required",
      data: {
        requiresVerification: true,
        email: user.email,
      },
    };
    res.status(403).json(response);
    return;
  }

  next();
};

// ==================== RATE LIMITING MIDDLEWARE ====================

export const createRateLimit = (
  windowMs: number,
  max: number,
  message: string
) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || "unknown";
    const now = Date.now();

    // Clean up expired entries
    for (const [ip, data] of requests.entries()) {
      if (now > data.resetTime) {
        requests.delete(ip);
      }
    }

    const current = requests.get(key);

    if (!current) {
      requests.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (now > current.resetTime) {
      requests.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (current.count >= max) {
      const response: AuthResponse = {
        success: false,
        message: message,
      };
      res.status(429).json(response);
      return;
    }

    current.count++;
    next();
  };
};

// ==================== SECURITY MIDDLEWARE ====================

export const securityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Remove sensitive headers
  res.removeHeader("X-Powered-By");

  // Add security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  next();
};

// ==================== REQUEST LOGGING MIDDLEWARE ====================

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();
  const user = (req as any).user;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      userId: user?._id || "anonymous",
    };

    if (res.statusCode >= 400) {
      console.error("Request failed:", logData);
    } else {
      console.log("Request completed:", logData);
    }
  });

  next();
};

// ==================== ERROR HANDLING MIDDLEWARE ====================

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("Auth module error:", error);

  let statusCode = 500;
  let message = "Internal server error";

  if (error instanceof AuthenticationError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error instanceof ValidationError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error instanceof NotFoundError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
  } else if (error.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
  } else if (error.code === 11000) {
    statusCode = 409;
    message = "Resource already exists";
  }

  const response: AuthResponse = {
    success: false,
    message: message,
  };

  res.status(statusCode).json(response);
};

// ==================== CORS MIDDLEWARE ====================

export const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void
  ) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }

    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://yourdomain.com",
      "https://www.yourdomain.com",
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

// ==================== REQUEST SIZE LIMIT MIDDLEWARE ====================

export const requestSizeLimit = (limit: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get("Content-Length") || "0");
    const limitBytes = parseInt(limit.replace(/[^\d]/g, "")) * 1024 * 1024; // Convert MB to bytes

    if (contentLength > limitBytes) {
      const response: AuthResponse = {
        success: false,
        message: "Request entity too large",
      };
      res.status(413).json(response);
      return;
    }

    next();
  };
};
