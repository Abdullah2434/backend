import { Router } from "express";
import * as ctrl from "../../controllers/videoSchedule.controller";

const router = Router();

// Video schedule routes
router.post("/schedule", ctrl.createSchedule as any);
router.get("/schedule", ctrl.getSchedule as any);
router.get("/schedule/details", ctrl.getScheduleDetails as any);
router.get("/schedule/stats", ctrl.getScheduleStats as any);
router.put("/schedule/:scheduleId", ctrl.updateSchedule as any);
router.delete("/schedule/:scheduleId", ctrl.deactivateSchedule as any);

export default router;
