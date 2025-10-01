import trendsRoutes from "./routes/trends.routes";

// ==================== ROUTE EXPORTS ====================

export { trendsRoutes };

// ==================== MODULE CONFIGURATION ====================

export const trendsModuleConfig = {
  name: "trends",
  version: "1.0.0",
  description: "Trends generation and analysis module",
  routes: {
    prefix: "/api/trends",
    public: ["GET /health", "GET /categories", "GET /real-estate", "GET /"],
    protected: ["POST /generate", "POST /validate"],
  },
  features: [
    "Real estate trend generation",
    "Custom trend generation",
    "Trend category management",
    "Request validation",
    "Rate limiting and security",
    "Comprehensive logging",
    "Error handling",
    "Health monitoring",
  ],
  dependencies: ["express", "express-rate-limit", "express-validator"],
  environment: {
    required: [],
    optional: [
      "TRENDS_API_KEY",
      "TRENDS_API_URL",
      "TRENDS_DEFAULT_LOCATION",
      "TRENDS_DEFAULT_LIMIT",
      "TRENDS_ENABLE_CACHING",
      "TRENDS_CACHE_EXPIRY",
      "TRENDS_RATE_LIMIT_WINDOW",
      "TRENDS_RATE_LIMIT_MAX",
    ],
  },
  security: {
    rateLimiting: {
      general: "100 requests per 15 minutes",
    },
    headers: [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "X-XSS-Protection",
      "Referrer-Policy",
      "Permissions-Policy",
    ],
    validation: [
      "Request body validation",
      "Content type validation",
      "Request size limits",
    ],
  },
  monitoring: {
    healthCheck: "/api/trends/health",
    logging: "Comprehensive request and error logging",
    metrics: "Processing time and success rate tracking",
  },
};

// ==================== DEFAULT EXPORT ====================

export default {
  routes: trendsRoutes,
  config: trendsModuleConfig,
};
