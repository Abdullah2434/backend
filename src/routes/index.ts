import { Router } from "express";
import authRoutes from "./v1/auth";
import videoRoutes from "./v1/video";
import webhookRoutes from "./v1/webhook";
import subscriptionRoutes from "./v1/subscription";
import paymentMethodsRoutes from "./v1/payment-methods";

const router = Router();

router.use("/auth", authRoutes);
router.use("/video", videoRoutes);
router.use("/webhook", webhookRoutes);
router.use("/subscription", subscriptionRoutes);
router.use("/payment-methods", paymentMethodsRoutes);

export default router;
