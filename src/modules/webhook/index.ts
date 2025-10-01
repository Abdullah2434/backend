import webhookRoutes from "./routes/webhook.routes";

// ==================== WEBHOOK MODULE EXPORTS ====================

export { webhookRoutes };

// ==================== MODULE CONFIGURATION ====================

export const webhookModuleConfig = {
  name: "webhook",
  version: "1.0.0",
  description: "Webhook processing module with Stripe integration",
  routes: {
    prefix: "/api/webhook",
    public: [
      "GET /health",
      "GET /test",
      "GET /config",
      "POST /stripe",
      "POST /process",
      "POST /verify",
      "GET /event/:eventId/status",
      "POST /event/:eventId/processed",
    ],
    protected: [],
  },
  features: [
    "Stripe webhook signature verification",
    "Event processing and deduplication",
    "Rate limiting and security",
    "Comprehensive logging",
    "Error handling and retry logic",
    "Health monitoring",
    "Event status tracking",
  ],
  dependencies: ["stripe", "express", "express-rate-limit"],
  environment: {
    required: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    optional: [
      "STRIPE_WEBHOOK_ENDPOINT_SECRET",
      "WEBHOOK_TOLERANCE",
      "WEBHOOK_ENABLE_LOGGING",
      "WEBHOOK_ENABLE_RETRY",
      "WEBHOOK_MAX_RETRIES",
      "WEBHOOK_RETRY_DELAY",
      "WEBHOOK_RATE_LIMIT_WINDOW",
      "WEBHOOK_RATE_LIMIT_MAX",
    ],
  },
  security: {
    rateLimiting: {
      general: "100 requests per minute",
      stripe: "200 requests per minute",
    },
    headers: [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "X-XSS-Protection",
      "Referrer-Policy",
      "Permissions-Policy",
    ],
    validation: [
      "Stripe signature verification",
      "Request body validation",
      "Content type validation",
      "Request size limits",
    ],
  },
  monitoring: {
    healthCheck: "/api/webhook/health",
    logging: "Comprehensive event and error logging",
    metrics: "Processing time and success rate tracking",
  },
};

// ==================== DEFAULT EXPORT ====================

export default {
  routes: webhookRoutes,
  config: webhookModuleConfig,
};
