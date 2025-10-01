import { Request, Response, NextFunction } from "express";
import {
  WebhookResponse,
  WebhookError,
  SignatureError,
} from "../types/webhook.types";

// ==================== VALIDATION FUNCTIONS ====================

export const validateWebhookSignature = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const signature = req.headers["stripe-signature"] as string;

    if (!signature) {
      const response: WebhookResponse = {
        success: false,
        message: "Missing Stripe signature header",
      };
      res.status(400).json(response);
      return;
    }

    if (!Buffer.isBuffer(req.body)) {
      const response: WebhookResponse = {
        success: false,
        message: "Invalid request body format",
      };
      res.status(400).json(response);
      return;
    }

    // Signature validation will be done in the service layer
    next();
  } catch (error) {
    const response: WebhookResponse = {
      success: false,
      message: "Signature validation failed",
    };
    res.status(400).json(response);
  }
};

export const validateWebhookBody = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!Buffer.isBuffer(req.body)) {
      const response: WebhookResponse = {
        success: false,
        message: "Request body must be a Buffer",
      };
      res.status(400).json(response);
      return;
    }

    if (req.body.length === 0) {
      const response: WebhookResponse = {
        success: false,
        message: "Request body cannot be empty",
      };
      res.status(400).json(response);
      return;
    }

    next();
  } catch (error) {
    const response: WebhookResponse = {
      success: false,
      message: "Body validation failed",
    };
    res.status(400).json(response);
  }
};

export const validateWebhookHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const requiredHeaders = ["stripe-signature", "content-type"];
    const missingHeaders: string[] = [];

    for (const header of requiredHeaders) {
      if (!req.headers[header]) {
        missingHeaders.push(header);
      }
    }

    if (missingHeaders.length > 0) {
      const response: WebhookResponse = {
        success: false,
        message: `Missing required headers: ${missingHeaders.join(", ")}`,
      };
      res.status(400).json(response);
      return;
    }

    next();
  } catch (error) {
    const response: WebhookResponse = {
      success: false,
      message: "Header validation failed",
    };
    res.status(400).json(response);
  }
};

// ==================== CUSTOM VALIDATORS ====================

export const isValidStripeSignature = (signature: string): boolean => {
  if (!signature || typeof signature !== "string") return false;

  // Stripe signatures start with "t=" or "v1="
  const validPrefixes = ["t=", "v1="];
  return validPrefixes.some((prefix) => signature.startsWith(prefix));
};

export const isValidEventId = (eventId: string): boolean => {
  if (!eventId || typeof eventId !== "string") return false;

  // Stripe event IDs start with "evt_"
  return eventId.startsWith("evt_") && eventId.length > 10;
};

export const isValidEventType = (eventType: string): boolean => {
  if (!eventType || typeof eventType !== "string") return false;

  // Common Stripe event types
  const validEventTypes = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "payment_method.attached",
    "payment_method.detached",
  ];

  return validEventTypes.includes(eventType);
};

export const isValidTimestamp = (timestamp: number): boolean => {
  if (typeof timestamp !== "number" || isNaN(timestamp)) return false;

  const now = Date.now() / 1000;
  const maxAge = 300; // 5 minutes

  return timestamp > now - maxAge && timestamp < now + 60;
};

export const isValidWebhookEvent = (event: any): boolean => {
  if (!event || typeof event !== "object") return false;

  return (
    isValidEventId(event.id) &&
    isValidEventType(event.type) &&
    isValidTimestamp(event.created) &&
    event.data &&
    typeof event.data === "object" &&
    event.data.object
  );
};

// ==================== VALIDATION UTILITIES ====================

export const validateWebhookData = (
  data: any
): {
  isValid: boolean;
  errors: Array<{ field: string; message: string; value?: any }>;
} => {
  const errors: Array<{ field: string; message: string; value?: any }> = [];

  if (data.signature && !isValidStripeSignature(data.signature)) {
    errors.push({
      field: "signature",
      message: "Invalid Stripe signature format",
      value: data.signature,
    });
  }

  if (data.eventId && !isValidEventId(data.eventId)) {
    errors.push({
      field: "eventId",
      message: "Invalid Stripe event ID format",
      value: data.eventId,
    });
  }

  if (data.eventType && !isValidEventType(data.eventType)) {
    errors.push({
      field: "eventType",
      message: "Invalid or unsupported event type",
      value: data.eventType,
    });
  }

  if (data.timestamp && !isValidTimestamp(data.timestamp)) {
    errors.push({
      field: "timestamp",
      message: "Invalid or expired timestamp",
      value: data.timestamp,
    });
  }

  if (data.event && !isValidWebhookEvent(data.event)) {
    errors.push({
      field: "event",
      message: "Invalid webhook event structure",
      value: data.event,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ==================== SANITIZATION FUNCTIONS ====================

export const sanitizeWebhookData = (data: any): any => {
  if (typeof data === "string") {
    return data.trim();
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeWebhookData);
  }

  if (data && typeof data === "object") {
    const sanitized: any = {};
    for (const key in data) {
      if (key !== "metadata" && key !== "object") {
        sanitized[key] = sanitizeWebhookData(data[key]);
      } else {
        sanitized[key] = data[key];
      }
    }
    return sanitized;
  }

  return data;
};

// ==================== ERROR HANDLING ====================

export const handleValidationError = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof WebhookError) {
    const response: WebhookResponse = {
      success: false,
      message: error.message,
    };
    res.status(error.statusCode).json(response);
    return;
  }

  if (error instanceof SignatureError) {
    const response: WebhookResponse = {
      success: false,
      message: "Invalid webhook signature",
    };
    res.status(400).json(response);
    return;
  }

  const response: WebhookResponse = {
    success: false,
    message: "Validation error",
  };
  res.status(400).json(response);
};

// ==================== EXPORT ALL VALIDATION FUNCTIONS ====================
