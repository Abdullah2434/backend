import { Router } from "express";
import * as authCtrl from "../../modules/auth/controllers/auth.controller";
import * as profileCtrl from "../../modules/auth/controllers/profile.controller";
import * as passwordCtrl from "../../modules/auth/controllers/password.controller";
import * as verificationCtrl from "../../modules/auth/controllers/verification.controller";
import {
  loginRateLimiter,
  registerRateLimiter,
  passwordResetRateLimiter,
} from "../../core/middleware";

const router = Router();

// PUBLIC ROUTES (no authentication required)
router.post("/register", registerRateLimiter.middleware(), authCtrl.register);
router.post("/login", loginRateLimiter.middleware(), authCtrl.login);
router.post("/google", authCtrl.googleLogin);
router.get("/check-email", authCtrl.checkEmail);
router.post("/check-email-verification", authCtrl.checkEmailVerification);
router.post("/validate-token", authCtrl.validateToken);

// Password routes
router.post(
  "/forgot-password",
  passwordResetRateLimiter.middleware(),
  passwordCtrl.forgotPassword
);
router.post(
  "/reset-password",
  passwordResetRateLimiter.middleware(),
  passwordCtrl.resetPassword
);
router.get("/validate-reset-token", passwordCtrl.validateResetToken); // GET for email link
router.post("/validate-reset-token", passwordCtrl.validateResetToken); // POST for validation
router.post("/debug-password-hash", passwordCtrl.debugPasswordHash);

// Verification routes
router.get("/verify-email", verificationCtrl.verifyEmail);
router.post("/resend-verification", verificationCtrl.resendVerification);

// PROTECTED ROUTES (authentication required)
router.get("/me", profileCtrl.me);
router.put("/profile", profileCtrl.updateProfile);
router.post("/logout", authCtrl.logout);
router.post("/clear-expired-tokens", authCtrl.clearExpiredTokens);

export default router;
