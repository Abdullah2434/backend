// ==================== AUTH MODULE EXPORTS ====================

// Types
export * from "./types/auth.types";

// Controllers
export {
  register,
  login,
  googleLogin,
  me,
  updateProfile,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  validateToken,
} from "./controllers/auth.controller";

// Services
export { default as AuthService } from "./services/auth.service";

// Middleware
export {
  authenticate,
  optionalAuth,
  requireEmailVerification,
  createRateLimit,
  securityHeaders,
  requestLogger,
  errorHandler,
  corsOptions,
  requestSizeLimit,
} from "./middleware/auth.middleware";

// Validation
export {
  validateRegistration,
  validateLogin,
  validateGoogleLogin,
  validateForgotPassword,
  validateResetPassword,
  validateProfileUpdate,
  validateEmailVerification,
  validateResendVerification,
  validateToken as validateTokenInput,
  validateResetToken,
  validateDebugPasswordHash,
  handleValidationErrors,
  validatePasswordStrength,
  validateEmailFormat,
  validateName,
  validatePhone,
  sanitizeInput,
  sanitizeEmail,
  sanitizeName,
  sanitizePhone,
} from "./validation/auth.validation";

// Routes
export { default as authRoutes } from "./routes/auth.routes";

// Utils
export {
  hashPassword,
  comparePassword,
  generateRandomPassword,
  generateSecureToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  hashToken,
  isValidEmail,
  normalizeEmail,
  isDisposableEmail,
  checkPasswordStrength,
  isValidName,
  sanitizeName as sanitizeNameUtil,
  isValidPhone,
  sanitizePhone as sanitizePhoneUtil,
  formatPhone,
  formatUserResponse,
  sanitizeUserData,
  isTokenExpired,
  getTokenExpiry,
  formatDate,
  generateCSRFToken,
  generateSessionId,
  maskEmail,
  maskPhone,
  validateInput,
  isValidUUID,
  isValidObjectId,
  logAuthEvent,
  logSecurityEvent,
  getAuthConfig,
  isDevelopment,
  isProduction,
} from "./utils/auth.utils";

// ==================== MODULE CONFIGURATION ====================

export const authModuleConfig = {
  name: "auth",
  version: "1.0.0",
  description: "Authentication and authorization module",
  routes: {
    prefix: "/api/auth",
    public: [
      "POST /register",
      "POST /login",
      "POST /google",
      "POST /forgot-password",
      "POST /reset-password",
      "POST /validate-reset-token",
      "GET /verify-email",
      "POST /resend-verification",
      "GET /check-email",
      "POST /check-email-verification",
      "POST /validate-token",
    ],
    protected: [
      "GET /me",
      "PUT /profile",
      "POST /logout",
      "POST /clear-expired-tokens",
    ],
    debug: ["POST /debug-password-hash"],
  },
  features: [
    "User registration and login",
    "Google OAuth integration",
    "Email verification",
    "Password reset",
    "Profile management",
    "JWT token management",
    "Rate limiting",
    "Input validation",
    "Security headers",
    "Request logging",
    "Error handling",
  ],
  security: {
    rateLimiting: true,
    inputValidation: true,
    securityHeaders: true,
    requestLogging: true,
    errorHandling: true,
    passwordHashing: true,
    tokenExpiration: true,
  },
};
