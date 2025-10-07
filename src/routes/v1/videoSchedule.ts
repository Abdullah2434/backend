import { Router } from "express";
import * as ctrl from "../../controllers/videoSchedule.controller";

const router = Router();

// Video schedule routes
router.post("/schedule", ctrl.createSchedule);
router.get("/schedule", ctrl.getSchedule);
router.get("/schedule/details", ctrl.getScheduleDetails);
router.get("/schedule/stats", ctrl.getScheduleStats);
router.put("/schedule/:scheduleId", ctrl.updateSchedule);
router.delete("/schedule/:scheduleId", ctrl.deactivateSchedule);

export default router;
