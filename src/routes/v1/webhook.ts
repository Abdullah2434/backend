import { Router } from "express";
import * as ctrl from "../../controllers/webhook.controller";
import { handleStripeWebhook, handleStripeWebhookGet } from "../../controllers/stripe-webhook.controller";
import {
  testWebhook,
  handleSocialBuWebhook,
  getUserSocialBuAccounts,
  removeUserSocialBuAccount,
} from "../../controllers/webhooksocialbu.controller";
const router = Router();

router.post("/video-complete", ctrl.videoComplete);
router.post("/caption-complete", ctrl.captionComplete);
router.post("/scheduled-video-complete", ctrl.scheduledVideoComplete);
router.post("/workflow-error", ctrl.handleWorkflowError);
router.get("/stripe", handleStripeWebhookGet); // GET handler for verification/testing
router.post("/stripe", handleStripeWebhook); // POST handler for actual webhooks
router.post("/test", testWebhook); // Test webhook endpoint
router.post("/socialbu", handleSocialBuWebhook); // Handle SocialBu account webhooks

// User SocialBu account management routes
router.get("/users/:userId/socialbu-accounts", getUserSocialBuAccounts); // Get user's SocialBu accounts
router.delete("/users/:userId/socialbu-accounts", removeUserSocialBuAccount); // Remove SocialBu account from user

export default router;
