import { Router } from "express";
import * as socialBuController from "../controllers/socialbu.controller";
import {
  testWebhook,
  handleSocialBuWebhook,
  getUserSocialBuAccounts,
  removeUserSocialBuAccount,
} from "../controllers/socialbu-webhook.controller";
import {
  validateLoginRequest,
  validateSaveTokenRequest,
  handleValidationErrors,
} from "../validation/socialbu.validation";
import {
  socialBuGeneralRateLimit,
  socialBuApiRateLimit,
  securityHeaders,
  requestLogger,
  errorHandler,
  requestSizeLimit,
  sanitizeInput,
  requestId,
  validateContentType,
  validateSocialBuToken,
  logSocialBuRequest,
  requireAuthentication,
  socialBuSecurity,
} from "../middleware/socialbu.middleware";

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

// Apply SocialBu security checks
router.use(socialBuSecurity);

// ==================== PUBLIC ROUTES ====================

// Health check
router.get("/health", socialBuController.getStatus);

// Get configuration (safe info only)
router.get("/config", socialBuGeneralRateLimit, socialBuController.getConfig);

// ==================== AUTHENTICATION ROUTES ====================

// Manual login
router.post(
  "/login",
  socialBuGeneralRateLimit,
  validateLoginRequest,
  socialBuController.manualLogin
);

// Save token
router.post(
  "/save-token",
  socialBuGeneralRateLimit,
  validateSaveTokenRequest,
  socialBuController.saveToken
);

// Get token
router.get("/token", socialBuGeneralRateLimit, socialBuController.getToken);

// Validate token
router.post(
  "/validate-token",
  socialBuGeneralRateLimit,
  socialBuController.validateToken
);

// Refresh token
router.post(
  "/refresh-token",
  socialBuGeneralRateLimit,
  socialBuController.refreshToken
);

// Logout
router.post("/logout", socialBuGeneralRateLimit, socialBuController.logout);

// ==================== ACCOUNT MANAGEMENT ROUTES ====================

// Get accounts (requires authentication)
router.get(
  "/accounts",
  socialBuApiRateLimit,
  requireAuthentication,
  socialBuController.getAccounts
);

// Connect account (requires authentication)
router.post(
  "/accounts/connect",
  socialBuApiRateLimit,
  requireAuthentication,
  socialBuController.connectAccount
);

// Disconnect account (requires authentication)
router.delete(
  "/accounts/:accountId",
  socialBuApiRateLimit,
  requireAuthentication,
  socialBuController.disconnectAccount
);

// ==================== WEBHOOK ROUTES ====================

// Test webhook endpoint
router.post("/test", socialBuGeneralRateLimit, testWebhook);

// Handle SocialBu account webhooks
router.post("/webhook", socialBuGeneralRateLimit, handleSocialBuWebhook);

// User SocialBu account management routes
router.get(
  "/users/:userId/accounts",
  socialBuGeneralRateLimit,
  getUserSocialBuAccounts
);
router.delete(
  "/users/:userId/accounts",
  socialBuGeneralRateLimit,
  removeUserSocialBuAccount
);

// ==================== ERROR HANDLING ====================

// Global error handler for SocialBu routes
router.use(errorHandler);

// Validation error handler
router.use(handleValidationErrors);

export default router;
