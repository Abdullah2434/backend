import { Router } from "express";
import multer from "multer";
import { textToSpeech, getVoices, getVoiceById, syncVoices, addCustomVoiceEndpoint } from "../../controllers/elevenLabs.controller";

const router = Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "/tmp/");
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `voice-${uniqueSuffix}-${file.originalname}`);
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
});

router.get("/voices", getVoices);
router.get("/voices/:voice_id", getVoiceById);
router.post("/text-to-speech", textToSpeech);
router.post("/sync-voices", syncVoices);
router.post("/voices/add", upload.single("files") as any, addCustomVoiceEndpoint);

export default router;

