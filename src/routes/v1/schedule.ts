import { Router } from "express";
import * as ctrl from "../../controllers/schedule.controller";

const router = Router();

// Schedule routes - simplified endpoint for pending posts
router.get("/", ctrl.getPendingSchedulePosts);
router.get("/:scheduleId/post/:postId", ctrl.getSchedulePost);
router.put("/:scheduleId/post/:postId", ctrl.editSchedulePost);
router.delete("/:scheduleId/post/:postId", ctrl.deleteSchedulePost);
router.delete("/:scheduleId", ctrl.deleteEntireSchedule);

export default router;
