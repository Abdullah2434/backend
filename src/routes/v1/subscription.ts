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
  debugWebhook,
} from "../../controllers/subscription.controller";

const router = Router();

// Get all available plans (public)
router.get("/plans", getPlans);

// Subscription management (requires auth)
router.get("/current", getCurrentSubscription);
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

// Sync subscription from Stripe (requires auth)
router.post("/sync-from-stripe", syncSubscriptionFromStripe);

// Debug endpoint (requires auth)
router.post("/debug-webhook", debugWebhook);

export default router;
