import { Router } from "express";
import * as paymentController from "../controllers/payment.controller";
import {
  validateCreateSetupIntent,
  validateUpdatePaymentMethod,
  validateSetDefaultPaymentMethod,
  validateRemovePaymentMethod,
  handleValidationErrors,
} from "../validation/payment.validation";
import {
  paymentGeneralRateLimit,
  paymentSetupRateLimit,
  paymentUpdateRateLimit,
  authenticate,
  securityHeaders,
  requestLogger,
  errorHandler,
  requestSizeLimit,
  sanitizeInput,
  requestId,
  validateContentType,
  validatePaymentOwnership,
} from "../middleware/payment.middleware";

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

// ==================== PROTECTED ROUTES (authentication required) ====================

// Get all payment methods for user
router.get(
  "/",
  paymentGeneralRateLimit,
  authenticate,
  paymentController.getPaymentMethods
);

// Create setup intent for adding/updating payment method
router.post(
  "/setup-intent",
  paymentSetupRateLimit,
  authenticate,
  validateCreateSetupIntent,
  handleValidationErrors,
  paymentController.createSetupIntent
);

// Update payment method (confirm SetupIntent)
router.post(
  "/update",
  paymentUpdateRateLimit,
  authenticate,
  validateUpdatePaymentMethod,
  handleValidationErrors,
  paymentController.updatePaymentMethod
);

// Set payment method as default
router.post(
  "/:paymentMethodId/set-default",
  paymentGeneralRateLimit,
  authenticate,
  validateSetDefaultPaymentMethod,
  handleValidationErrors,
  validatePaymentOwnership,
  paymentController.setDefaultPaymentMethod
);

// Remove payment method
router.delete(
  "/:paymentMethodId",
  paymentGeneralRateLimit,
  authenticate,
  validateRemovePaymentMethod,
  handleValidationErrors,
  validatePaymentOwnership,
  paymentController.removePaymentMethod
);

// Get payment stats
router.get(
  "/stats",
  paymentGeneralRateLimit,
  authenticate,
  paymentController.getPaymentStats
);

// Get customer information
router.get(
  "/customer",
  paymentGeneralRateLimit,
  authenticate,
  paymentController.getCustomer
);

// Health check
router.get("/health", paymentController.healthCheck);

// ==================== ERROR HANDLING ====================

// Global error handler for payment routes
router.use(errorHandler);

export default router;
