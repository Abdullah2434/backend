import { Router } from "express";
import {
  getPlans,
  getCurrentSubscription,
  createSubscription,
  cancelSubscription,
  reactivateSubscription,
  getPaymentMethods,
  checkVideoLimit,
  createPaymentIntent,
  confirmPaymentIntent,
  getPaymentIntentStatus,
  changePlan,
  getPlanChangeOptions,
  getBillingHistory,
  getBillingSummary,
  syncSubscriptionFromStripe,
  autoSyncOnPaymentSuccess,
  debugWebhook,
} from "../../controllers/subscription.controller";

const router = Router();

// Get all available plans (public)
router.get("/plans", getPlans);

// Get current subscription (public - works with and without auth)
router.get("/current", getCurrentSubscription);

// Subscription management (requires auth)
router.post("/create", createSubscription);
router.post("/cancel", cancelSubscription);
router.post("/reactivate", reactivateSubscription);
router.get("/payment-methods", getPaymentMethods);
router.get("/video-limit", checkVideoLimit);
router.post("/payment-intent", createPaymentIntent);
router.post("/confirm-payment-intent", confirmPaymentIntent);
router.get("/payment-intent/:id/status", getPaymentIntentStatus);

// Plan changes (requires auth)
router.post("/change-plan", changePlan);
router.get("/plan-change-options", getPlanChangeOptions);

// Billing history (requires auth)
router.get("/billing-history", getBillingHistory);
router.get("/billing-summary", getBillingSummary);

// Sync subscription from Stripe (PRIMARY METHOD - requires auth)
// This creates or updates the subscription record after successful payment
// Call this endpoint from the frontend after successful Stripe checkout
router.post("/sync-from-stripe", syncSubscriptionFromStripe);

// Auto-sync subscription when payment succeeds (AUTOMATIC - requires auth)
// This endpoint automatically syncs subscription when payment intent succeeds
// Call this after payment confirmation on frontend
router.post("/auto-sync-on-success", autoSyncOnPaymentSuccess);

// Debug endpoint (requires auth)
router.post("/debug-webhook", debugWebhook);

export default router;
