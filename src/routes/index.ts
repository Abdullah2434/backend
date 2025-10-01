import { Router } from "express";
import { authRoutes } from "../modules/auth";
import { videoRoutes } from "../modules/video";
import { webhookRoutes } from "../modules/webhook";
import { subscriptionRoutes } from "../modules/subscription";
import { paymentRoutes } from "../modules/payment";
import { contactRoutes } from "../modules/contact";
import { trendsRoutes } from "../modules/trends";
import { socialBuRoutes } from "../modules/socialbu";

const router = Router();

router.use("/auth", authRoutes);
router.use("/video", videoRoutes);
router.use("/webhook", webhookRoutes);
router.use("/subscription", subscriptionRoutes);
router.use("/payment-methods", paymentRoutes);
router.use("/contact", contactRoutes);
router.use("/trends", trendsRoutes);
router.use("/socialbu", socialBuRoutes);

export default router;
