import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import {
  generateDynamicPosts,
  getPostHistory,
  getPostAnalytics,
  getTemplates,
  testDynamicPosts,
  enhanceScheduleWithDynamicPosts,
} from "../../controllers/dynamicPost.controller";

const router = Router();

// Dynamic Post Generation Routes
router.post("/generate", authenticate, generateDynamicPosts);
router.get("/history", authenticate, getPostHistory);
router.get("/analytics", authenticate, getPostAnalytics);
router.get("/templates", getTemplates);

// Test endpoint (no auth required for testing)
router.post("/test", testDynamicPosts);

// Schedule enhancement
router.post(
  "/enhance-schedule/:scheduleId",
  authenticate,
  enhanceScheduleWithDynamicPosts
);

export default router;
