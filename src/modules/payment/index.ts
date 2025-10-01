// ==================== PAYMENT MODULE EXPORTS ====================

// Types
export * from "./types/payment.types";

// Controllers
export {
  getPaymentMethods,
  createSetupIntent,
  updatePaymentMethod,
  setDefaultPaymentMethod,
  removePaymentMethod,
  getPaymentStats,
  getCustomer,
  healthCheck,
} from "./controllers/payment.controller";

// Services
export { default as PaymentService } from "./services/payment.service";

// Middleware
export {
  createPaymentRateLimit,
  paymentGeneralRateLimit,
  paymentSetupRateLimit,
  paymentUpdateRateLimit,
  authenticate,
  securityHeaders,
  requestSizeLimit,
  requestLogger,
  errorHandler,
  corsOptions,
  sanitizeInput,
  requestId,
  validateContentType,
  validatePaymentOwnership,
  requireEmailVerification,
} from "./middleware/payment.middleware";

// Validation
export {
  validateCreateSetupIntent,
  validateUpdatePaymentMethod,
  validateSetDefaultPaymentMethod,
  validateRemovePaymentMethod,
  handleValidationErrors,
  validatePaymentMethodId,
  validateSetupIntentId,
  validateReturnUrl,
  validatePaymentData,
  sanitizeUrl,
} from "./validation/payment.validation";

// Routes
export { default as paymentRoutes } from "./routes/payment.routes";

// Utils
export {
  generatePaymentId,
  generateSetupIntentId,
  generateCustomerId,
  isValidPaymentMethodId,
  isValidSetupIntentId,
  isValidCustomerId,
  isValidReturnUrl,
  isValidEmail,
  sanitizeUrl as sanitizeUrlUtil,
  sanitizeEmail,
  sanitizeString,
  sanitizeInput as sanitizeInputUtil,
  formatCardNumber,
  formatExpiryDate,
  formatCardBrand,
  formatAmount,
  formatDate,
  formatDateReadable,
  getTimeAgo,
  maskEmail,
  maskPaymentMethodId,
  maskCardNumber,
  logPaymentEvent,
  logPaymentError,
  logPaymentSecurity,
  getPaymentConfig,
  isDevelopment,
  isProduction,
  validateInput,
  extractPaymentMethodIdFromUrl,
  isValidCardBrand,
  isValidExpiryMonth,
  isValidExpiryYear,
  isCardExpired,
  calculateCardHash,
  generatePaymentMetadata,
} from "./utils/payment.utils";

// ==================== MODULE CONFIGURATION ====================

export const paymentModuleConfig = {
  name: "payment",
  version: "1.0.0",
  description: "Payment methods management and Stripe integration module",
  routes: {
    prefix: "/api/payment-methods",
    public: ["GET /health"],
    protected: [
      "GET /",
      "POST /setup-intent",
      "POST /update",
      "POST /:paymentMethodId/set-default",
      "DELETE /:paymentMethodId",
      "GET /stats",
      "GET /customer",
    ],
  },
  features: [
    "Payment methods management",
    "Stripe integration",
    "Setup intents for secure payment method collection",
    "Default payment method management",
    "Customer management",
    "Payment statistics",
    "Health monitoring",
    "Rate limiting",
    "Input validation",
    "Security headers",
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
    paymentOwnershipValidation: true,
  },
};
