import { Router } from "express";
import * as userSettingsCtrl from "../../modules/user-settings/controllers/user-settings.controller";
import { validateRequest } from "../../core/middleware";
import {
  getUserVideoSettingsSchema,
  saveUserVideoSettingsSchema,
} from "../../modules/user-settings/validation/user-settings.validation";

const router = Router();

// User video settings routes
router.get(
  "/user-settings",
  validateRequest(getUserVideoSettingsSchema),
  userSettingsCtrl.getUserVideoSettings
);

router.post(
  "/user-settings",
  validateRequest(saveUserVideoSettingsSchema),
  userSettingsCtrl.saveUserVideoSettings
);

export default router;
