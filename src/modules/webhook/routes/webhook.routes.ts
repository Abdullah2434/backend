import { Router } from "express";
import * as webhookController from "../controllers/webhook.controller";
import {
  videoComplete,
  handleWorkflowError,
} from "../controllers/webhook-legacy.controller";
import {
  validateWebhookSignature,
  validateWebhookBody,
  validateWebhookHeaders,
  handleValidationError,
} from "../validation/webhook.validation";
import {
  webhookGeneralRateLimit,
  webhookStripeRateLimit,
  securityHeaders,
  requestLogger,
  errorHandler,
  requestSizeLimit,
  sanitizeInput,
  requestId,
  validateContentType,
  validateStripeSignature,
  logWebhookRequest,
  requireRawBody,
  webhookSecurity,
} from "../middleware/webhook.middleware";

const router = Router();

// ==================== MIDDLEWARE SETUP ====================

// Apply security headers to all routes
router.use(securityHeaders);

// Apply request ID to all routes
router.use(requestId);

// Apply request logging to all routes
router.use(requestLogger);

// Apply input sanitization to all routes
router.use(sanitizeInput);

// Apply content type validation to POST routes
router.use(validateContentType);

// Apply request size limit to all routes
router.use(requestSizeLimit);

// Apply webhook security checks
router.use(webhookSecurity);

// ==================== PUBLIC ROUTES ====================

// Health check
router.get("/health", webhookController.getWebhookStatus);

// Webhook test endpoint
router.get(
  "/test",
  webhookGeneralRateLimit,
  webhookController.handleWebhookTest
);

// Get webhook configuration (safe info only)
router.get(
  "/config",
  webhookGeneralRateLimit,
  webhookController.getWebhookConfig
);

// ==================== STRIPE WEBHOOK ROUTES ====================

// Main Stripe webhook endpoint
router.post(
  "/stripe",
  webhookStripeRateLimit,
  validateWebhookHeaders,
  validateWebhookBody,
  requireRawBody,
  validateStripeSignature,
  logWebhookRequest,
  webhookController.handleStripeWebhook
);

// ==================== WEBHOOK MANAGEMENT ROUTES ====================

// Process webhook event manually
router.post(
  "/process",
  webhookGeneralRateLimit,
  validateWebhookBody,
  webhookController.processWebhookEvent
);

// Verify webhook signature
router.post(
  "/verify",
  webhookGeneralRateLimit,
  validateWebhookBody,
  webhookController.verifyWebhookSignature
);

// Check event processing status
router.get(
  "/event/:eventId/status",
  webhookGeneralRateLimit,
  webhookController.checkEventStatus
);

// Mark event as processed
router.post(
  "/event/:eventId/processed",
  webhookGeneralRateLimit,
  webhookController.markEventProcessed
);

// ==================== LEGACY WEBHOOK ROUTES ====================

// Video completion webhook
router.post(
  "/video-complete",
  webhookGeneralRateLimit,
  validateWebhookBody,
  videoComplete
);

// Workflow error webhook
router.post(
  "/workflow-error",
  webhookGeneralRateLimit,
  validateWebhookBody,
  handleWorkflowError
);

// ==================== ERROR HANDLING ====================

// Global error handler for webhook routes
router.use(errorHandler);

// Validation error handler
router.use(handleValidationError);

export default router;
