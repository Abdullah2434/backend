import { Router } from "express";
import {
  getCronHealth,
  resetCronStats,
} from "../../controllers/cronHealth.controller";

const router = Router();

/**
 * @route GET /api/v1/cron/health
 * @desc Get cron job health status
 * @access Public
 */
router.get("/health", getCronHealth);

/**
 * @route POST /api/v1/cron/reset-stats
 * @desc Reset cron job statistics
 * @access Public
 */
router.post("/reset-stats", resetCronStats);

export default router;
