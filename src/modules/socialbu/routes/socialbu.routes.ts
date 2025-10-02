import { Router } from "express";
import { authenticate } from "../../../core/middlewares/auth";
import { apiRateLimiter, loginRateLimiter } from "../../../core/middlewares/rate-limiting";
import * as socialBuController from "../controllers/socialbu.controller";

const router = Router();

// Use existing rate limiters
const socialBuGeneralRateLimit = loginRateLimiter.middleware();
const socialBuApiRateLimit = apiRateLimiter.middleware();

// ==================== AUTHENTICATION ROUTES ====================

// Manual login (for testing)
router.post(
  "/login",
  socialBuGeneralRateLimit,
  socialBuController.manualLogin
);

// Save token manually (for initial setup)
router.post(
  "/save-token",
  socialBuGeneralRateLimit,
  socialBuController.saveToken
);

// Test authentication
router.get(
  "/test-auth",
  authenticate,
  socialBuGeneralRateLimit,
  socialBuController.testAuth
);

// Test SocialBu API connection
router.get(
  "/test-connection",
  socialBuGeneralRateLimit,
  socialBuController.testConnection
);

// ==================== ACCOUNT ROUTES ====================

// Get all SocialBu accounts (requires authentication)
router.get(
  "/accounts",
  authenticate,
  socialBuApiRateLimit,
  socialBuController.getAccounts
);

// Get public accounts (no authentication required)
router.get(
  "/accounts/public",
  socialBuGeneralRateLimit,
  socialBuController.getAccountsPublic
);

// Connect new social media account
router.post(
  "/accounts/connect",
  authenticate,
  socialBuApiRateLimit,
  socialBuController.connectAccount
);

export { router as socialBuRoutes };