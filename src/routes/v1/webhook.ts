import { Router } from "express";
import * as ctrl from "../../controllers/webhook.controller";
import { handleStripeWebhook } from "../../controllers/stripe-webhook.controller";

const router = Router();

router.post("/video-complete", ctrl.videoComplete);
router.post("/workflow-error", ctrl.handleWorkflowError);
router.post("/stripe", handleStripeWebhook);

export default router;
