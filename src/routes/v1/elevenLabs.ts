import { Router } from "express";
import { textToSpeech, getVoices, getVoiceById, syncVoices } from "../../controllers/elevenLabs.controller";

const router = Router();

router.get("/voices", getVoices);
router.get("/voices/:voice_id", getVoiceById);
router.post("/text-to-speech", textToSpeech);
router.post("/sync-voices", syncVoices);

export default router;

