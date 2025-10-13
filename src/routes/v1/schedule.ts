import { Router } from "express";
import * as ctrl from "../../controllers/schedule.controller";

const router = Router();

// Schedule routes - simplified endpoint for pending posts
router.get("/", ctrl.getPendingSchedulePosts);
router.get("/:scheduleId/post/:postIndex", ctrl.getSchedulePost);
router.put("/:scheduleId/post/:postIndex", ctrl.editSchedulePost);
router.put("/:scheduleId/frequency", ctrl.updateScheduleFrequency);
router.delete("/:scheduleId/post/:postIndex", ctrl.deleteSchedulePost);
router.delete("/:scheduleId", ctrl.deleteEntireSchedule);

export default router;
