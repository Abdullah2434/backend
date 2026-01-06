import { Router } from "express";
import {
  uploadMusicTrack,
  uploadCustomMusicTrack,
  getAllMusicTracks,
  getMusicTracksByEnergy,
  getMusicTrackById,
  streamMusicPreview,
  deleteMusicTrack,
  getMusicTracksStats,
  getTrendingMusic,
  upload,
} from "../../controllers/music.controller";
import { authenticate } from "../../middleware/auth";

const router = Router();

// Public GET endpoints
router.get("/tracks", getAllMusicTracks);
router.get("/tracks/:energyCategory", getMusicTracksByEnergy);
router.get("/track/:trackId", getMusicTrackById);
router.get("/track/:trackId/preview", streamMusicPreview);
router.get("/stats", getMusicTracksStats);

// Protected GET endpoints (requires authentication)
router.get("/trending", authenticate() as any, getTrendingMusic);

// Protected POST/DELETE endpoints (admin operations)
router.post("/upload", upload.single("audioFile") as any, uploadMusicTrack);
router.post("/upload-custom", upload.single("audioFile") as any, uploadCustomMusicTrack);
router.delete("/track/:trackId", deleteMusicTrack);

export default router;
