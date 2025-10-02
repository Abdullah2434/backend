// ==================== CORE MIDDLEWARES EXPORTS ====================

// Auth middleware
export {
  default as authenticate,
  optionalAuthenticate,
  requiresAuth,
  isPublicRoute,
} from "./auth";

// Rate limiting
export {
  apiRateLimiter,
  loginRateLimiter,
  registerRateLimiter,
  passwordResetRateLimiter,
  generalAuthRateLimiter,
  getRateLimiter,
  rateLimitConfigs,
} from "./rate-limiting";

// Security middleware
export {
  securityHeaders,
  validateRequest,
  sanitizeInputs,
  stripHtmlTags,
  sanitizeInput,
  sanitizeRequestBody,
} from "./security";

// Shared middleware
export {
  authenticate as sharedAuthenticate,
  securityHeaders as sharedSecurityHeaders,
  createRateLimiter,
  generalRateLimit,
  strictRateLimit,
  apiRateLimit,
  errorHandler,
  handleValidationErrors,
  requestLogger,
  requestSizeLimit,
  validateContentType,
  corsMiddleware,
  requestId,
  sanitizeInput as sharedSanitizeInput,
} from "./shared";
