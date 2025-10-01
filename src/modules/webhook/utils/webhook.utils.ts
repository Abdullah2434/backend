import * as crypto from "crypto";

// ==================== WEBHOOK UTILITIES ====================

export const generateWebhookId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString("hex");
  return `wh_${timestamp}_${random}`;
};

export const generateEventId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(3).toString("hex");
  return `evt_${timestamp}_${random}`;
};

// ==================== VALIDATION UTILITIES ====================

export const isValidStripeSignature = (signature: string): boolean => {
  if (!signature || typeof signature !== "string") return false;
  const validPrefixes = ["t=", "v1="];
  return validPrefixes.some((prefix) => signature.startsWith(prefix));
};

export const isValidEventId = (eventId: string): boolean => {
  if (!eventId || typeof eventId !== "string") return false;
  return eventId.startsWith("evt_") && eventId.length > 10;
};

export const isValidEventType = (eventType: string): boolean => {
  if (!eventType || typeof eventType !== "string") return false;

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

// ==================== SANITIZATION UTILITIES ====================

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

// ==================== FORMATTING UTILITIES ====================

export const formatEventType = (eventType: string): string => {
  return eventType.replace(/\./g, " ").replace(/_/g, " ");
};

export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp * 1000).toISOString();
};

export const formatProcessingTime = (
  startTime: number,
  endTime: number
): string => {
  const duration = endTime - startTime;
  return `${duration}ms`;
};

export const formatEventId = (eventId: string): string => {
  if (eventId.length <= 12) return eventId;
  return `${eventId.slice(0, 8)}...${eventId.slice(-4)}`;
};

// ==================== MASKING UTILITIES ====================

export const maskSignature = (signature: string): string => {
  if (signature.length <= 10) return signature;
  return `${signature.slice(0, 10)}...${signature.slice(-4)}`;
};

export const maskEventId = (eventId: string): string => {
  if (eventId.length <= 12) return eventId;
  return `${eventId.slice(0, 8)}...${eventId.slice(-4)}`;
};

export const maskCustomerId = (customerId: string): string => {
  if (customerId.length <= 12) return customerId;
  return `${customerId.slice(0, 8)}...${customerId.slice(-4)}`;
};

// ==================== LOGGING UTILITIES ====================

export const logWebhookEvent = (event: string, data: any): void => {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    data: sanitizeWebhookData(data),
  };
  console.log("🔗 Webhook Event:", JSON.stringify(logData, null, 2));
};

export const logWebhookError = (error: Error, context?: any): void => {
  const logData = {
    error: error.message,
    stack: error.stack,
    context: sanitizeWebhookData(context),
    timestamp: new Date().toISOString(),
  };
  console.error("🔗 Webhook Error:", JSON.stringify(logData, null, 2));
};

export const logWebhookSecurity = (event: string, data: any): void => {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    data: sanitizeWebhookData(data),
    severity: "security",
  };
  console.warn("🔒 Webhook Security:", JSON.stringify(logData, null, 2));
};

export const logWebhookProcessing = (
  eventId: string,
  eventType: string,
  processingTime: number
): void => {
  const logData = {
    eventId: maskEventId(eventId),
    eventType,
    processingTime: `${processingTime}ms`,
    timestamp: new Date().toISOString(),
  };
  console.log("⚡ Webhook Processing:", JSON.stringify(logData, null, 2));
};

// ==================== CONFIGURATION UTILITIES ====================

export const getWebhookConfig = () => {
  return {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    apiVersion: "2023-10-16",
    endpointSecret: process.env.STRIPE_WEBHOOK_ENDPOINT_SECRET || "",
    tolerance: parseInt(process.env.WEBHOOK_TOLERANCE || "300"), // 5 minutes
    enableLogging: process.env.WEBHOOK_ENABLE_LOGGING === "true",
    enableRetry: process.env.WEBHOOK_ENABLE_RETRY === "true",
    maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || "3"),
    retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || "1000"), // 1 second
    rateLimitWindow: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW || "60000"), // 1 minute
    rateLimitMax: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX || "100"),
  };
};

export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === "development";
};

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === "production";
};

// ==================== VALIDATION UTILITIES ====================

export const validateInput = (
  input: any,
  rules: any
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  for (const [field, rule] of Object.entries(rules)) {
    const value = input[field];
    const fieldRule = rule as any;

    if (fieldRule.required && (!value || value.toString().trim() === "")) {
      errors.push(`${field} is required`);
      continue;
    }

    if (value && fieldRule.minLength && value.length < fieldRule.minLength) {
      errors.push(
        `${field} must be at least ${fieldRule.minLength} characters`
      );
    }

    if (value && fieldRule.maxLength && value.length > fieldRule.maxLength) {
      errors.push(
        `${field} must be less than ${fieldRule.maxLength} characters`
      );
    }

    if (value && fieldRule.pattern && !fieldRule.pattern.test(value)) {
      errors.push(`${field} format is invalid`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ==================== WEBHOOK SPECIFIC UTILITIES ====================

export const extractEventType = (
  eventType: string
): {
  category: string;
  action: string;
  resource: string;
} => {
  const parts = eventType.split(".");
  return {
    category: parts[0] || "",
    action: parts[1] || "",
    resource: parts[2] || "",
  };
};

export const isRetryableError = (error: Error): boolean => {
  const retryableErrors = [
    "ECONNRESET",
    "ENOTFOUND",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "WebhookError",
    "ProcessingError",
  ];

  return retryableErrors.some(
    (errorType) =>
      error.name.includes(errorType) || error.message.includes(errorType)
  );
};

export const calculateRetryDelay = (
  attempt: number,
  baseDelay: number = 1000
): number => {
  const maxDelay = 30000; // 30 seconds
  const delay = baseDelay * Math.pow(2, attempt - 1);
  return Math.min(delay, maxDelay);
};

export const shouldRetry = (
  attempt: number,
  maxRetries: number,
  error: Error
): boolean => {
  if (attempt >= maxRetries) return false;
  return isRetryableError(error);
};

export const generateWebhookHash = async (
  webhookData: any
): Promise<string> => {
  const webhookString = JSON.stringify(webhookData);
  return crypto.createHash("sha256").update(webhookString).digest("hex");
};

export const generateWebhookMetadata = (webhookData: any): any => {
  return {
    timestamp: new Date().toISOString(),
    source: "webhook",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  };
};

export const formatWebhookResponse = (
  success: boolean,
  message: string,
  data?: any
) => {
  return {
    success,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
};

export const getEventPriority = (eventType: string): number => {
  const priorities: Record<string, number> = {
    "payment_intent.succeeded": 1,
    "invoice.payment_succeeded": 1,
    "customer.subscription.created": 2,
    "customer.subscription.updated": 2,
    "checkout.session.completed": 3,
    "payment_intent.payment_failed": 4,
    "invoice.payment_failed": 4,
    "customer.subscription.deleted": 5,
  };

  return priorities[eventType] || 10;
};

export const isHighPriorityEvent = (eventType: string): boolean => {
  return getEventPriority(eventType) <= 2;
};

export const formatEventSummary = (event: any): string => {
  const { type, id, created } = event;
  const timestamp = new Date(created * 1000).toISOString();
  return `${type} (${maskEventId(id)}) at ${timestamp}`;
};
