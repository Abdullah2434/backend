import { Router } from "express";
import * as ctrl from "../../controllers/webhook.controller";
import { stripeWebhookHandler } from "../../modules/subscription/webhooks/stripe.webhook";
import { socialBuWebhookHandler } from "../../modules/socialbu";

const router = Router();

router.post("/video-complete", ctrl.videoComplete);
router.post("/workflow-error", ctrl.handleWorkflowError);
router.post("/stripe", (req, res) =>
  stripeWebhookHandler.handleWebhook(req, res)
);

// SocialBu webhook
router.post("/socialbu", (req, res) =>
  socialBuWebhookHandler.handleWebhookRequest(req, res)
);

export default router;
