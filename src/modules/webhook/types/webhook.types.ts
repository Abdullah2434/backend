// ==================== WEBHOOK MODULE TYPES ====================

import { Request, Response } from "express";
import Stripe from "stripe";

// ==================== REQUEST TYPES ====================

export interface WebhookRequest extends Request {
  body: Buffer;
  headers: {
    "stripe-signature": string;
    "content-type": string;
    [key: string]: string | string[] | undefined;
  };
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  data?: any;
}

// ==================== WEBHOOK EVENT TYPES ====================

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
  livemode: boolean;
  pending_webhooks: number;
  request?: {
    id: string;
    idempotency_key: string | null;
  };
}

export interface WebhookEventData {
  eventId: string;
  eventType: string;
  objectId: string;
  objectType: string;
  livemode: boolean;
  created: Date;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

// ==================== STRIPE WEBHOOK TYPES ====================

export interface StripeWebhookEventData {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
  livemode: boolean;
  pending_webhooks: number;
  request?: {
    id: string;
    idempotency_key: string | null;
  };
}

export interface StripeCheckoutSessionData {
  id: string;
  customer?: string;
  subscription?: string;
  payment_intent?: string;
  metadata: Record<string, string>;
  mode: "payment" | "setup" | "subscription";
  status: "open" | "complete" | "expired";
}

export interface StripeSubscriptionData {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  trial_start?: number;
  trial_end?: number;
  metadata: Record<string, string>;
  items: {
    data: Array<{
      price: {
        id: string;
        unit_amount: number;
        currency: string;
        recurring: {
          interval: string;
        };
      };
    }>;
  };
}

export interface StripeInvoiceData {
  id: string;
  customer: string;
  subscription?: string;
  payment_intent?: string;
  amount_paid: number;
  amount_due: number;
  currency: string;
  status: string;
  metadata: Record<string, string>;
}

export interface StripePaymentIntentData {
  id: string;
  customer?: string;
  amount: number;
  currency: string;
  status: string;
  metadata: Record<string, string>;
}

// ==================== WEBHOOK HANDLER TYPES ====================

export interface WebhookHandler {
  eventType: string;
  handler: (event: StripeWebhookEventData) => Promise<void>;
  description: string;
  enabled: boolean;
}

export interface WebhookHandlerResult {
  success: boolean;
  eventId: string;
  eventType: string;
  processedAt: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export interface WebhookProcessingResult {
  processed: boolean;
  eventId: string;
  eventType: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

// ==================== CONFIGURATION TYPES ====================

export interface WebhookConfig {
  stripeSecretKey: string;
  webhookSecret: string;
  apiVersion: string;
  endpointSecret: string;
  tolerance: number;
  enableLogging: boolean;
  enableRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  rateLimitWindow: number;
  rateLimitMax: number;
}

// ==================== ERROR TYPES ====================

export class WebhookError extends Error {
  statusCode: number;
  code: string;
  eventId?: string;
  eventType?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "WEBHOOK_ERROR",
    eventId?: string,
    eventType?: string
  ) {
    super(message);
    this.name = "WebhookError";
    this.statusCode = statusCode;
    this.code = code;
    this.eventId = eventId;
    this.eventType = eventType;
  }
}

export class ValidationError extends WebhookError {
  field?: string;

  constructor(
    message: string,
    field?: string,
    statusCode: number = 400,
    code: string = "VALIDATION_ERROR"
  ) {
    super(message, statusCode, code);
    this.field = field;
  }
}

export class SignatureError extends WebhookError {
  constructor(message: string = "Invalid webhook signature") {
    super(message, 400, "SIGNATURE_ERROR");
  }
}

export class ProcessingError extends WebhookError {
  constructor(
    message: string = "Webhook processing failed",
    eventId?: string,
    eventType?: string
  ) {
    super(message, 500, "PROCESSING_ERROR", eventId, eventType);
  }
}

export class RateLimitError extends WebhookError {
  constructor(
    message: string = "Too many webhook requests. Please try again later."
  ) {
    super(message, 429, "RATE_LIMIT_ERROR");
  }
}

// ==================== UTILITY TYPES ====================

export interface WebhookStats {
  totalEvents: number;
  processedEvents: number;
  failedEvents: number;
  successRate: number;
  lastProcessedAt?: Date;
  eventsByType: Array<{
    type: string;
    count: number;
    successRate: number;
  }>;
}

export interface WebhookAnalytics {
  eventsByHour: Array<{
    hour: string;
    count: number;
  }>;
  eventsByType: Array<{
    type: string;
    count: number;
    successRate: number;
  }>;
  averageProcessingTime: number;
  errorRate: number;
}

export interface WebhookMiddlewareConfig {
  rateLimitWindow: number;
  rateLimitMax: number;
  enableLogging: boolean;
  enableAnalytics: boolean;
  requireSignature: boolean;
  enableRetry: boolean;
}

// ==================== VALIDATION TYPES ====================

export interface WebhookValidationRules {
  signature: {
    required: boolean;
    pattern: RegExp;
  };
  eventType: {
    required: boolean;
    allowedTypes: string[];
  };
  eventId: {
    required: boolean;
    pattern: RegExp;
  };
  timestamp: {
    required: boolean;
    maxAge: number;
  };
}

// ==================== RETRY TYPES ====================

export interface WebhookRetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  maxRetryDelay: number;
  retryableErrors: string[];
}

export interface WebhookRetryAttempt {
  attempt: number;
  timestamp: Date;
  error: string;
  nextRetryAt?: Date;
}

// ==================== LOGGING TYPES ====================

export interface WebhookLogEntry {
  id: string;
  eventId: string;
  eventType: string;
  timestamp: Date;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  metadata?: Record<string, any>;
  processingTime?: number;
  success: boolean;
}

export interface WebhookLogConfig {
  enableLogging: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
  logFormat: "json" | "text";
  includeMetadata: boolean;
  includeProcessingTime: boolean;
}

// ==================== EXPORT ALL TYPES ====================
