import { Router } from "express";
import * as subscriptionController from "../controllers/subscription.controller";
import { authenticate } from "../../../core/middlewares/auth";
import { apiRateLimiter, loginRateLimiter } from "../../../core/middlewares/rate-limiting";

const router = Router();

// Rate limiting
const subscriptionPublicRateLimit = loginRateLimiter.middleware();
const subscriptionGeneralRateLimit = apiRateLimiter.middleware();
const subscriptionPaymentRateLimit = apiRateLimiter.middleware();

// ==================== PUBLIC ROUTES ====================

// Get all available plans (public)
router.get("/plans", subscriptionPublicRateLimit, subscriptionController.getPlans);

// Get current subscription (public - works with and without auth)
router.get("/current", subscriptionPublicRateLimit, subscriptionController.getCurrentSubscription);

// ==================== PROTECTED ROUTES (authentication required) ====================

// Subscription management
router.post("/create", subscriptionGeneralRateLimit, authenticate, subscriptionController.createSubscription);
router.post("/cancel", subscriptionGeneralRateLimit, authenticate, subscriptionController.cancelSubscription);
router.post("/reactivate", subscriptionGeneralRateLimit, authenticate, subscriptionController.reactivateSubscription);

// Payment methods
router.get("/payment-methods", subscriptionGeneralRateLimit, authenticate, subscriptionController.getPaymentMethods);

// Video limit check
router.get("/video-limit", subscriptionGeneralRateLimit, authenticate, subscriptionController.checkVideoLimit);

// Payment intents
router.post("/payment-intent", subscriptionPaymentRateLimit, authenticate, subscriptionController.createPaymentIntent);
router.post("/confirm-payment-intent", subscriptionPaymentRateLimit, authenticate, subscriptionController.confirmPaymentIntent);
router.get("/payment-intent/:id/status", subscriptionGeneralRateLimit, authenticate, subscriptionController.getPaymentIntentStatus);

// Plan changes
router.post("/change-plan", subscriptionGeneralRateLimit, authenticate, subscriptionController.changePlan);
router.get("/plan-change-options", subscriptionGeneralRateLimit, authenticate, subscriptionController.getPlanChangeOptions);

// Billing history
router.get("/billing-history", subscriptionGeneralRateLimit, authenticate, subscriptionController.getBillingHistory);
router.get("/billing-summary", subscriptionGeneralRateLimit, authenticate, subscriptionController.getBillingSummary);

// Sync subscription from Stripe
router.post("/sync-from-stripe", subscriptionGeneralRateLimit, authenticate, subscriptionController.syncSubscriptionFromStripe);

// Debug endpoint
router.post("/debug-webhook", subscriptionGeneralRateLimit, authenticate, subscriptionController.debugWebhook);

export default router;