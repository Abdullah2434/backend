import { Router } from "express";
import * as subscriptionController from "../controllers/subscription.controller";
import {
  validateCreateSubscription,
  validateCancelSubscription,
  validateChangePlan,
  validateCreatePaymentIntent,
  validateConfirmPaymentIntent,
  validatePaymentIntentStatus,
  handleValidationErrors,
} from "../validation/subscription.validation";
import {
  subscriptionGeneralRateLimit,
  subscriptionCreateRateLimit,
  subscriptionPaymentRateLimit,
  subscriptionPublicRateLimit,
  authenticate,
  optionalAuth,
  securityHeaders,
  requestLogger,
  errorHandler,
  requestSizeLimit,
  sanitizeInput,
  requestId,
  validateContentType,
  validateSubscriptionOwnership,
  checkSubscriptionStatus,
  checkVideoLimit,
} from "../middleware/subscription.middleware";

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

// Apply content type validation to POST/PUT routes
router.use(validateContentType);

// Apply request size limit to all routes
router.use(requestSizeLimit);

// ==================== PUBLIC ROUTES ====================

// Get all available plans (public)
router.get(
  "/plans",
  subscriptionPublicRateLimit,
  subscriptionController.getPlans
);

// Get current subscription (public - works with and without auth)
router.get(
  "/current",
  subscriptionPublicRateLimit,
  optionalAuth,
  subscriptionController.getCurrentSubscription
);

// Health check
router.get("/health", subscriptionController.healthCheck);

// ==================== PROTECTED ROUTES (authentication required) ====================

// Subscription management
router.post(
  "/create",
  subscriptionCreateRateLimit,
  authenticate,
  validateCreateSubscription,
  handleValidationErrors,
  subscriptionController.createSubscription
);

router.post(
  "/cancel",
  subscriptionGeneralRateLimit,
  authenticate,
  validateCancelSubscription,
  handleValidationErrors,
  validateSubscriptionOwnership,
  subscriptionController.cancelSubscription
);

router.post(
  "/reactivate",
  subscriptionGeneralRateLimit,
  authenticate,
  validateSubscriptionOwnership,
  subscriptionController.reactivateSubscription
);

// Payment methods
router.get(
  "/payment-methods",
  subscriptionGeneralRateLimit,
  authenticate,
  subscriptionController.getPaymentMethods
);

// Video limit check
router.get(
  "/video-limit",
  subscriptionGeneralRateLimit,
  authenticate,
  checkVideoLimit,
  subscriptionController.checkVideoLimit
);

// Payment intents
router.post(
  "/payment-intent",
  subscriptionPaymentRateLimit,
  authenticate,
  validateCreatePaymentIntent,
  handleValidationErrors,
  subscriptionController.createPaymentIntent
);

router.post(
  "/confirm-payment-intent",
  subscriptionPaymentRateLimit,
  authenticate,
  validateConfirmPaymentIntent,
  handleValidationErrors,
  subscriptionController.confirmPaymentIntent
);

router.get(
  "/payment-intent/:id/status",
  subscriptionGeneralRateLimit,
  authenticate,
  validatePaymentIntentStatus,
  handleValidationErrors,
  subscriptionController.getPaymentIntentStatus
);

// Plan changes
router.post(
  "/change-plan",
  subscriptionGeneralRateLimit,
  authenticate,
  validateChangePlan,
  handleValidationErrors,
  validateSubscriptionOwnership,
  checkSubscriptionStatus(["active", "trialing"]),
  subscriptionController.changePlan
);

router.get(
  "/plan-change-options",
  subscriptionGeneralRateLimit,
  authenticate,
  validateSubscriptionOwnership,
  subscriptionController.getPlanChangeOptions
);

// Billing history
router.get(
  "/billing-history",
  subscriptionGeneralRateLimit,
  authenticate,
  subscriptionController.getBillingHistory
);

router.get(
  "/billing-summary",
  subscriptionGeneralRateLimit,
  authenticate,
  subscriptionController.getBillingSummary
);

// Sync subscription from Stripe
router.post(
  "/sync-from-stripe",
  subscriptionGeneralRateLimit,
  authenticate,
  validateSubscriptionOwnership,
  subscriptionController.syncSubscriptionFromStripe
);

// Debug endpoint
router.post(
  "/debug-webhook",
  subscriptionGeneralRateLimit,
  authenticate,
  subscriptionController.debugWebhook
);

// ==================== ERROR HANDLING ====================

// Global error handler for subscription routes
router.use(errorHandler);

export default router;
