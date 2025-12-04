import { Router } from "express";
import {
  setPresetProfile,
  setCustomVoiceMusic,
  getCurrentProfile,
  getPresetConfigurations,
} from "../../controllers/energyProfile.controller";

const router = Router();

// All routes require authentication
router.post("/preset", setPresetProfile as any);
router.post("/custom", setCustomVoiceMusic as any);
router.get("/current", getCurrentProfile as any);
router.get("/presets", getPresetConfigurations as any);

export default router;
