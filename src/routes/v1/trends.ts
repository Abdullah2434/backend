import { Router } from "express";
import {
  getRealEstateTrends,
  getCityBasedTrends,
  generateContentFromDescription,
} from "../../controllers/trends.controller";

const router = Router();

// Public endpoint for real estate trends
router.get("/real-estate", getRealEstateTrends);

// City-based trends endpoint
router.post("/city", getCityBasedTrends);

// Generate content from description endpoint
router.post("/description", generateContentFromDescription);

export default router;
