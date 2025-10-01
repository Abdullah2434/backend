import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import {
  validateRegistration,
  validateLogin,
  validateGoogleLogin,
  validateForgotPassword,
  validateResetPassword,
  validateProfileUpdate,
  validateEmailVerification,
  validateResendVerification,
  validateToken,
  handleValidationErrors,
} from "../validation/auth.validation";
import {
  authenticate,
  createRateLimit,
  securityHeaders,
  requestLogger,
  errorHandler,
  requestSizeLimit,
} from "../middleware/auth.middleware";

const router = Router();

// ==================== SECURITY MIDDLEWARE ====================
router.use(securityHeaders);
router.use(requestLogger);
router.use(requestSizeLimit("10mb"));

// ==================== RATE LIMITING ====================
const loginRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  "Too many login attempts, please try again later"
);

const registerRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  3, // 3 attempts
  "Too many registration attempts, please try again later"
);

const passwordResetRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  3, // 3 attempts
  "Too many password reset attempts, please try again later"
);

const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  "Too many requests, please try again later"
);

// ==================== PUBLIC ROUTES ====================

// Authentication routes
router.post(
  "/register",
  registerRateLimit,
  validateRegistration,
  handleValidationErrors,
  authController.register
);

router.post(
  "/login",
  loginRateLimit,
  validateLogin,
  handleValidationErrors,
  authController.login
);

router.post(
  "/google",
  generalRateLimit,
  validateGoogleLogin,
  handleValidationErrors,
  authController.googleLogin
);

// Password reset routes
router.post(
  "/forgot-password",
  passwordResetRateLimit,
  validateForgotPassword,
  handleValidationErrors,
  authController.forgotPassword
);

router.post(
  "/reset-password",
  passwordResetRateLimit,
  validateResetPassword,
  handleValidationErrors,
  authController.resetPassword
);

// Email verification routes
router.get(
  "/verify-email",
  generalRateLimit,
  validateEmailVerification,
  handleValidationErrors,
  authController.verifyEmail
);

router.post(
  "/resend-verification",
  generalRateLimit,
  validateResendVerification,
  handleValidationErrors,
  authController.resendVerification
);

// Utility routes

router.post(
  "/validate-token",
  generalRateLimit,
  validateToken,
  handleValidationErrors,
  authController.validateToken
);

// ==================== PROTECTED ROUTES ====================

// User profile routes
router.get("/me", generalRateLimit, authenticate, authController.me);

router.put(
  "/profile",
  generalRateLimit,
  authenticate,
  validateProfileUpdate,
  handleValidationErrors,
  authController.updateProfile
);

router.post("/logout", generalRateLimit, authenticate, authController.logout);

// ==================== ERROR HANDLING ====================
router.use(errorHandler);

export default router;
