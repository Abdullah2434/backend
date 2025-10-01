import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import {
  WebhookResponse,
  WebhookError,
  RateLimitError,
  SignatureError,
} from "../types/webhook.types";
import {
  logWebhookEvent,
  logWebhookError,
  logWebhookSecurity,
  getWebhookConfig,
  maskSignature,
  maskEventId,
} from "../utils/webhook.utils";

// ==================== RATE LIMITING ====================

export const createWebhookRateLimit = (
  windowMs: number = 60 * 1000,
  max: number = 100
) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: "Too many webhook requests. Please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const response: WebhookResponse = {
        success: false,
        message: "Too many webhook requests. Please try again later.",
      };
      res.status(429).json(response);
    },
  });
};

// Default rate limits
export const webhookGeneralRateLimit = createWebhookRateLimit(60 * 1000, 100); // 100 requests per minute
export const webhookStripeRateLimit = createWebhookRateLimit(60 * 1000, 200); // 200 Stripe webhooks per minute

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
  const maxSize = 1024 * 1024; // 1MB for webhook payloads

  if (contentLength > maxSize) {
    const response: WebhookResponse = {
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
      signature: req.headers["stripe-signature"]
        ? maskSignature(req.headers["stripe-signature"] as string)
        : undefined,
      timestamp: new Date().toISOString(),
    };

    console.log("🔗 Webhook API Request:", JSON.stringify(logData, null, 2));
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
  console.error("🔗 Webhook API Error:", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    signature: req.headers["stripe-signature"]
      ? maskSignature(req.headers["stripe-signature"] as string)
      : undefined,
    timestamp: new Date().toISOString(),
  });

  let statusCode = 500;
  let message = "Internal server error";

  if (error instanceof WebhookError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
  } else if (error.name === "RateLimitError") {
    statusCode = 429;
    message = "Too many requests";
  } else if (error.name === "SignatureError") {
    statusCode = 400;
    message = "Invalid webhook signature";
  } else if (error.name === "ProcessingError") {
    statusCode = 500;
    message = "Webhook processing failed";
  }

  const response: WebhookResponse = {
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
      "https://hooks.stripe.com",
      "https://api.stripe.com",
      process.env.FRONTEND_URL || "https://www.edgeairealty.com",
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Stripe-Signature", "X-Requested-With"],
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
  if (req.body && Buffer.isBuffer(req.body)) {
    // For webhook payloads, we don't sanitize the raw body
    // as it needs to be verified with Stripe's signature
    next();
    return;
  }

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
      service: "webhook",
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
    `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
  if (req.method === "POST") {
    const contentType = req.headers["content-type"];
    if (!contentType || !contentType.includes("application/json")) {
      const response: WebhookResponse = {
        success: false,
        message: "Content-Type must be application/json",
      };
      res.status(400).json(response);
      return;
    }
  }

  next();
};

// ==================== WEBHOOK SPECIFIC MIDDLEWARE ====================

export const validateStripeSignature = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const signature = req.headers["stripe-signature"] as string;

    if (!signature) {
      logWebhookSecurity("missing_signature", {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      const response: WebhookResponse = {
        success: false,
        message: "Missing Stripe signature header",
      };
      res.status(400).json(response);
      return;
    }

    // Additional signature validation will be done in the service layer
    next();
  } catch (error) {
    logWebhookError(error as Error, { action: "validateStripeSignature" });
    const response: WebhookResponse = {
      success: false,
      message: "Signature validation failed",
    };
    res.status(400).json(response);
  }
};

export const logWebhookRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const signature = req.headers["stripe-signature"] as string;

  logWebhookEvent("webhook_request_received", {
    signature: signature ? maskSignature(signature) : undefined,
    contentType: req.headers["content-type"],
    contentLength: req.headers["content-length"],
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });

  next();
};

export const requireRawBody = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!Buffer.isBuffer(req.body)) {
    const response: WebhookResponse = {
      success: false,
      message:
        "Request body must be raw buffer for webhook signature verification",
    };
    res.status(400).json(response);
    return;
  }

  next();
};

export const webhookSecurity = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log security-relevant information
  const securityData = {
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    signature: req.headers["stripe-signature"]
      ? maskSignature(req.headers["stripe-signature"] as string)
      : undefined,
    timestamp: new Date().toISOString(),
  };

  logWebhookSecurity("webhook_security_check", securityData);
  next();
};
