import { Router } from "express";
import * as ctrl from "../../controllers/dynamicCaption.controller";

const router = Router();

// Generate dynamic captions for a video topic
router.post("/generate", ctrl.generateDynamicCaptions);

// Get user's post history for a specific platform
router.get("/history/:platform", ctrl.getUserPostHistory);

// Get available templates for a platform
router.get("/templates/:platform", ctrl.getPlatformTemplates);

// Test the dynamic caption generation system
router.post("/test", ctrl.testDynamicSystem);

export default router;
