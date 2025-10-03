import { Router } from "express";
import authRoutes from "./v1/auth";
import videoRoutes from "./v1/video";
import webhookRoutes from "./v1/webhook";
import subscriptionRoutes from "./v1/subscription";
import paymentMethodsRoutes from "./v1/payment-methods";
import contactRoutes from "./v1/contact";
import trendsRoutes from "./v1/trends";
import socialbuRoutes from "./v1/socialbu";
import socialbuMediaRoutes from "./v1/socialbu-media";
import socialbuAccountRoutes from "./v1/socialbu-account";
import userSettingsRoutes from "./v1/user-settings";

const router = Router();

router.use("/auth", authRoutes);
router.use("/video", videoRoutes);
router.use("/webhook", webhookRoutes);
router.use("/subscription", subscriptionRoutes);
router.use("/payment-methods", paymentMethodsRoutes);
router.use("/contact", contactRoutes);
router.use("/trends", trendsRoutes);
router.use("/socialbu", socialbuRoutes);
router.use("/socialbu-media", socialbuMediaRoutes);
router.use("/socialbu-account", socialbuAccountRoutes);
router.use("/user-settings", userSettingsRoutes);
router.use("/webhook", webhookRoutes);

export default router;
