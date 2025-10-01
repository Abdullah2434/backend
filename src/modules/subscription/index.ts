// ==================== SUBSCRIPTION MODULE EXPORTS ====================

// Types
export * from "./types/subscription.types";

// Controllers
export {
  getPlans,
  getCurrentSubscription,
  createSubscription,
  cancelSubscription,
  reactivateSubscription,
  getPaymentMethods,
  checkVideoLimit,
  createPaymentIntent,
  confirmPaymentIntent,
  getPaymentIntentStatus,
  changePlan,
  getPlanChangeOptions,
  getBillingHistory,
  getBillingSummary,
  syncSubscriptionFromStripe,
  debugWebhook,
  healthCheck,
} from "./controllers/subscription.controller";

// Services
export { default as SubscriptionService } from "./services/subscription.service";
export { default as SubscriptionPlansService } from "./services/subscription-plans.service";
export { default as SubscriptionManagementService } from "./services/subscription-management.service";
export { default as SubscriptionBillingService } from "./services/subscription-billing.service";

// Middleware
export {
  createSubscriptionRateLimit,
  subscriptionGeneralRateLimit,
  subscriptionCreateRateLimit,
  subscriptionPaymentRateLimit,
  subscriptionPublicRateLimit,
  authenticate,
  optionalAuth,
  securityHeaders,
  requestSizeLimit,
  requestLogger,
  errorHandler,
  corsOptions,
  sanitizeInput,
  requestId,
  validateContentType,
  validateSubscriptionOwnership,
  requireEmailVerification,
  checkSubscriptionStatus,
  checkVideoLimit as checkVideoLimitMiddleware,
} from "./middleware/subscription.middleware";

// Validation
export {
  validateCreateSubscription,
  validateCancelSubscription,
  validateChangePlan,
  validateCreatePaymentIntent,
  validateConfirmPaymentIntent,
  validatePaymentIntentStatus,
  handleValidationErrors,
  validatePlanId,
  validatePaymentMethodId,
  validatePaymentIntentId,
  validateAmount,
  validateCurrency,
  validateCouponCode,
  validateSubscriptionData,
  sanitizeString,
} from "./validation/subscription.validation";

// Routes
export { default as subscriptionRoutes } from "./routes/subscription.routes";

// Utils
export {
  generateSubscriptionId,
  generateBillingId,
  generateInvoiceId,
  isValidPlanId,
  isValidSubscriptionId,
  isValidPaymentIntentId,
  isValidCustomerId,
  isValidAmount,
  isValidCurrency,
  isValidCouponCode,
  sanitizeString as sanitizeStringUtil,
  sanitizeInput as sanitizeInputUtil,
  formatAmount,
  formatDate,
  formatDateReadable,
  getTimeAgo,
  formatSubscriptionStatus,
  formatPlanName,
  maskEmail,
  maskSubscriptionId,
  maskPaymentIntentId,
  logSubscriptionEvent,
  logSubscriptionError,
  logSubscriptionSecurity,
  getSubscriptionConfig,
  isDevelopment,
  isProduction,
  validateInput,
  calculateProration,
  calculateTrialEndDate,
  isTrialActive,
  isSubscriptionActive,
  isSubscriptionCanceled,
  getDaysUntilRenewal,
  getDaysUntilTrialEnd,
  calculateSubscriptionHash,
  generateSubscriptionMetadata,
  formatSubscriptionFeatures,
  getPlanComparison,
  calculateChurnRate,
  calculateMRR,
  calculateARPU,
} from "./utils/subscription.utils";

// ==================== MODULE CONFIGURATION ====================

export const subscriptionModuleConfig = {
  name: "subscription",
  version: "1.0.0",
  description:
    "Subscription management and billing module with Stripe integration",
  routes: {
    prefix: "/api/subscription",
    public: ["GET /plans", "GET /current", "GET /health"],
    protected: [
      "POST /create",
      "POST /cancel",
      "POST /reactivate",
      "GET /payment-methods",
      "GET /video-limit",
      "POST /payment-intent",
      "POST /confirm-payment-intent",
      "GET /payment-intent/:id/status",
      "POST /change-plan",
      "GET /plan-change-options",
      "GET /billing-history",
      "GET /billing-summary",
      "POST /sync-from-stripe",
      "POST /debug-webhook",
    ],
  },
  features: [
    "Subscription plans management",
    "Subscription lifecycle management",
    "Stripe integration",
    "Payment intent handling",
    "Billing history and summary",
    "Video limit tracking",
    "Plan change management",
    "Payment methods management",
    "Health monitoring",
    "Rate limiting",
    "Input validation",
    "Security headers",
    "Webhook handling",
  ],
  security: {
    rateLimiting: true,
    inputValidation: true,
    securityHeaders: true,
    requestLogging: true,
    errorHandling: true,
    inputSanitization: true,
    contentTypeValidation: true,
    authentication: true,
    subscriptionOwnershipValidation: true,
    subscriptionStatusValidation: true,
    videoLimitValidation: true,
  },
};
