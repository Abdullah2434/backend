import { Router } from "express";
import authRoutes from "./v1/auth";
import videoRoutes from "./v1/video";
import webhookRoutes from "./v1/webhook";
import subscriptionRoutes from "./v1/subscription";
import paymentMethodsRoutes from "./v1/payment-methods";
import contactRoutes from "./v1/contact";
import trendsRoutes from "./v1/trends";
import socialbuRoutes from "./v1/socialbu";

const router = Router();

// Health check route
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API is healthy",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
router.use("/auth", authRoutes);
router.use("/video", videoRoutes);
router.use("/subscription", subscriptionRoutes);
router.use("/payment-methods", paymentMethodsRoutes);
router.use("/contact", contactRoutes);
router.use("/trends", trendsRoutes);

// SocialBu Routes (consolidated)
router.use("/socialbu", socialbuRoutes);

// Webhook Routes (should be last to avoid conflicts)
router.use("/webhook", webhookRoutes);

export default router;
