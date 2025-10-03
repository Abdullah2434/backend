import { Router } from "express";
import * as ctrl from "../../controllers/user-settings.controller";

const router = Router();

// User video settings routes
router.get("/user-settings", ctrl.getUserVideoSettings);
router.post("/user-settings", ctrl.saveUserVideoSettings);

export default router;
