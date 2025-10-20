import { Router } from "express";
import * as ctrl from "../../controllers/performanceTracking.controller";

const router = Router();

// Get performance statistics for a user
router.get("/stats", ctrl.getPerformanceStats);

// Get content recommendations based on performance data
router.get("/recommendations/:platform", ctrl.getContentRecommendations);

// Update post engagement data
router.post("/engagement", ctrl.updatePostEngagement);

// Record performance metrics for a post
router.post("/metrics", ctrl.recordPerformanceMetrics);

export default router;

