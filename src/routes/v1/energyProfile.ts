import { Router } from "express";
import {
  setPresetProfile,
  setCustomVoiceMusic,
  getCurrentProfile,
  getPresetConfigurations,
} from "../../controllers/energyProfile.controller";

const router = Router();

// All routes require authentication
router.post("/preset", setPresetProfile);
router.post("/custom", setCustomVoiceMusic);
router.get("/current", getCurrentProfile);
router.get("/presets", getPresetConfigurations);

export default router;
