import { Router } from "express";
import authRoutes from "./v1/auth";
import videoRoutes from "./v1/video";
import webhookRoutes from "./v1/webhook";
import subscriptionRoutes from "./v1/subscription";

const router = Router();

router.use("/auth", authRoutes);
router.use("/video", videoRoutes);
router.use("/webhook", webhookRoutes);
router.use("/subscription", subscriptionRoutes);

export default router;
