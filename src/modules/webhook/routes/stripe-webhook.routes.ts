import { Router } from "express";
import { apiRateLimiter } from "../../../core/middlewares/rate-limiting";
import * as stripeWebhookController from "../controllers/stripe-webhook.controller";

const router = Router();

// Use existing rate limiter
const webhookStripeRateLimit = apiRateLimiter.middleware();

// ==================== STRIPE WEBHOOK ROUTES ====================

// Main Stripe webhook endpoint
router.post(
  "/stripe",
  webhookStripeRateLimit,
  stripeWebhookController.handleStripeWebhook
);

export { router as stripeWebhookRoutes };
