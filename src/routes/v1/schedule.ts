import { Router } from "express";
import * as ctrl from "../../controllers/schedule.controller";

const router = Router();

// Schedule routes - simplified endpoint for pending posts
router.get("/", ctrl.getPendingSchedulePosts as any);
router.get("/:scheduleId/post/:postId", ctrl.getSchedulePost as any);
router.put("/:scheduleId/post/:postId", ctrl.editSchedulePost as any);
router.delete("/:scheduleId/post/:postId", ctrl.deleteSchedulePost as any);
router.delete("/:scheduleId", ctrl.deleteEntireSchedule as any);

export default router;
