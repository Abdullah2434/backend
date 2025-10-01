import { Router } from "express";
import * as contactController from "../controllers/contact.controller";
import {
  validateContactForm,
  handleValidationErrors,
} from "../validation/contact.validation";
import {
  contactFormRateLimit,
  contactHealthRateLimit,
  securityHeaders,
  requestLogger,
  errorHandler,
  requestSizeLimit,
  sanitizeInput,
  requestId,
  validateContentType,
} from "../middleware/contact.middleware";

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

// Contact form submission
router.post(
  "/",
  contactFormRateLimit,
  validateContactForm,
  handleValidationErrors,
  contactController.submitContactForm
);

// Health check endpoint
router.get("/health", contactHealthRateLimit, contactController.healthCheck);

// Contact statistics (public for now, could be protected later)
router.get("/stats", contactHealthRateLimit, contactController.getContactStats);

// ==================== ERROR HANDLING ====================

// Global error handler for contact routes
router.use(errorHandler);

export default router;
