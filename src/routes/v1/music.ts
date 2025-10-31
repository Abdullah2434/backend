import { Router } from "express";
import {
  uploadMusicTrack,
  getAllMusicTracks,
  getMusicTracksByEnergy,
  getMusicTrackById,
  streamMusicPreview,
  deleteMusicTrack,
  getMusicTracksStats,
  upload,
} from "../../controllers/music.controller";

const router = Router();

// Public GET endpoints
router.get("/tracks", getAllMusicTracks);
router.get("/tracks/:energyCategory", getMusicTracksByEnergy);
router.get("/track/:trackId", getMusicTrackById);
router.get("/track/:trackId/preview", streamMusicPreview);
router.get("/stats", getMusicTracksStats);

// Protected POST/DELETE endpoints (admin operations)
router.post("/upload", upload.single("audioFile") as any, uploadMusicTrack);
router.delete("/track/:trackId", deleteMusicTrack);

export default router;
