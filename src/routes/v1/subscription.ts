import { Router } from "express";
import * as subscriptionCtrl from "../../modules/subscription/controllers/subscription.controller";
import * as paymentCtrl from "../../modules/subscription/controllers/payment.controller";
import * as billingCtrl from "../../modules/subscription/controllers/billing.controller";

const router = Router();

// SUBSCRIPTION ROUTES
// Get all available plans (public)
router.get("/plans", subscriptionCtrl.getPlans);

// Get current subscription (public - works with and without auth)
router.get("/current", subscriptionCtrl.getCurrentSubscription);

// Subscription management (requires auth)
router.post("/create", subscriptionCtrl.createSubscription);
router.put("/update", subscriptionCtrl.updateSubscription);
router.post("/cancel", subscriptionCtrl.cancelSubscription);
router.get("/usage", subscriptionCtrl.getUsage);
router.post("/sync-from-stripe", subscriptionCtrl.syncFromStripe);

// PAYMENT ROUTES (requires auth)
router.get("/payment-methods", paymentCtrl.getPaymentMethods);
router.post("/payment-methods", paymentCtrl.addPaymentMethod);
router.put("/payment-methods/default", paymentCtrl.setDefaultPaymentMethod);
router.delete("/payment-methods", paymentCtrl.removePaymentMethod);
router.post("/payment-intent", paymentCtrl.createPaymentIntent);

// BILLING ROUTES (requires auth)
router.get("/billing-history", billingCtrl.getBillingHistory);
router.get("/billing-summary", billingCtrl.getBillingSummary);
router.post("/billing/sync-from-stripe", billingCtrl.syncBillingFromStripe);

export default router;
