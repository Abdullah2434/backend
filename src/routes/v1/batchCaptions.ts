import { Router } from "express";
import * as ctrl from "../../controllers/batchCaption.controller";

const router = Router();

// Generate captions for multiple topics in batch
router.post("/generate", ctrl.generateBatchCaptions);

// Generate content calendar with captions
router.post("/content-calendar", ctrl.generateContentCalendar);

// Generate platform-specific captions
router.post("/platform-specific", ctrl.generatePlatformSpecificCaptions);

// Get batch generation statistics
router.get("/stats", ctrl.getBatchGenerationStats);

export default router;

