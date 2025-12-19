import { Router } from "express";
import { getAudioDuration } from "../../controllers/audioDuration.controller";

const router = Router();

// POST endpoint to get audio duration from URL
router.post("/duration", getAudioDuration);

export default router;

