import socialBuRoutes from "./routes/socialbu.routes";

// ==================== SOCIALBU MODULE EXPORTS ====================

export { socialBuRoutes };

// ==================== MODULE CONFIGURATION ====================

export const socialBuModuleConfig = {
  name: "socialbu",
  version: "1.0.0",
  description: "SocialBu integration module for social media management",
  routes: {
    prefix: "/api/socialbu",
    public: [
      "GET /health",
      "GET /config",
      "POST /login",
      "POST /save-token",
      "GET /token",
      "POST /validate-token",
      "POST /refresh-token",
      "POST /logout",
    ],
    protected: [
      "GET /accounts",
      "POST /accounts/connect",
      "DELETE /accounts/:accountId",
    ],
  },
  features: [
    "SocialBu API authentication",
    "Token management and validation",
    "Account connection and management",
    "Media upload and processing",
    "Webhook handling",
    "Rate limiting and security",
    "Comprehensive logging",
    "Error handling and retry logic",
    "Health monitoring",
  ],
  dependencies: ["axios", "express", "express-rate-limit", "express-validator"],
  environment: {
    required: ["SOCIALBU_API_KEY", "SOCIALBU_API_URL"],
    optional: [
      "SOCIALBU_EMAIL",
      "SOCIALBU_PASSWORD",
      "SOCIALBU_WEBHOOK_SECRET",
      "SOCIALBU_TIMEOUT",
      "SOCIALBU_RETRY_ATTEMPTS",
      "SOCIALBU_RETRY_DELAY",
      "SOCIALBU_ENABLE_LOGGING",
      "SOCIALBU_ENABLE_WEBHOOKS",
      "SOCIALBU_RATE_LIMIT_WINDOW",
      "SOCIALBU_RATE_LIMIT_MAX",
    ],
  },
  security: {
    rateLimiting: {
      general: "100 requests per minute",
      api: "200 requests per minute",
      webhook: "50 requests per minute",
    },
    headers: [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "X-XSS-Protection",
      "Referrer-Policy",
      "Permissions-Policy",
    ],
    validation: [
      "Input sanitization",
      "Content type validation",
      "Request size limits",
      "Token validation",
      "Authentication checks",
    ],
  },
  monitoring: {
    healthCheck: "/api/socialbu/health",
    logging: "Comprehensive event and error logging",
    metrics: "API call tracking and performance monitoring",
  },
  platforms: [
    "YouTube",
    "TikTok",
    "Instagram",
    "Facebook",
    "Twitter",
    "LinkedIn",
  ],
  mediaTypes: [
    "video/mp4",
    "video/avi",
    "video/mov",
    "video/wmv",
    "video/flv",
    "video/webm",
    "video/mkv",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ],
};

// ==================== DEFAULT EXPORT ====================

export default {
  routes: socialBuRoutes,
  config: socialBuModuleConfig,
};
