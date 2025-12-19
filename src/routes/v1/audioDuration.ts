import { Router } from "express";
import { getAudioDuration } from "../../controllers/audioDuration.controller";
import { mergeAudioFiles } from "../../controllers/audioMerge.controller";

const router = Router();

// POST endpoint to get audio duration from URL
router.post("/duration", getAudioDuration);

// POST endpoint to merge multiple audio files from URLs
router.post("/merge", mergeAudioFiles);

export default router;

