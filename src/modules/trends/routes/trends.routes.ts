import { Router } from "express";
import {
  getRealEstateTrends,
  generateTrends,
  getTrendCategories,
  validateTrendRequest,
  healthCheck,
} from "../controllers/trends.controller";
import {
  authenticate,
  rateLimitMiddleware,
  handleValidationErrors,
  errorHandler,
  logTrendsRequest,
  validateTrendsHeaders,
  setSecurityHeaders,
  corsMiddleware,
  requestSizeLimit,
  cacheControl,
} from "../middleware/trends.middleware";
import {
  validateTrendGeneration,
  validateTrendQuery,
} from "../validation/trends.validation";

const router = Router();

// ==================== MIDDLEWARE STACK ====================

// Apply middleware to all routes
router.use(setSecurityHeaders);
router.use(corsMiddleware);
router.use(requestSizeLimit);
router.use(cacheControl);
router.use(logTrendsRequest);
router.use(validateTrendsHeaders);
router.use(rateLimitMiddleware);

// ==================== PUBLIC ROUTES ====================

// Health check endpoint
router.get("/health", healthCheck);

// Get trend categories
router.get("/categories", getTrendCategories);

// Get real estate trends (legacy endpoint)
router.get("/real-estate", getRealEstateTrends);

// Generate trends with query parameters
router.get("/", validateTrendQuery, generateTrends);

// ==================== PROTECTED ROUTES ====================

// Apply authentication to protected routes
router.use(authenticate);

// Generate trends with request body
router.post("/generate", validateTrendGeneration, generateTrends);

// Validate trend request
router.post("/validate", validateTrendGeneration, validateTrendRequest);

// ==================== ERROR HANDLING ====================

// Apply error handler to all routes
router.use(errorHandler);

export default router;
