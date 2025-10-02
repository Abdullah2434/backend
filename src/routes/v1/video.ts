import { Router } from "express";
import * as galleryCtrl from "../../modules/video/controllers/gallery.controller";
import * as generationCtrl from "../../modules/video/controllers/generation.controller";
import * as resourcesCtrl from "../../modules/video/controllers/resources.controller";

const router = Router();

// PROTECTED ROUTES (authentication required)
router.get("/gallery", galleryCtrl.getGallery);
router.post("/delete", galleryCtrl.deleteVideo);
router.get("/download-proxy", galleryCtrl.downloadVideoProxy);

// AVATAR & VOICE ROUTES (public - optional authentication for custom resources)
router.get("/avatars", resourcesCtrl.getAvatars);
router.get("/voices", resourcesCtrl.getVoices);
router.post(
  "/photo-avatar",
  generationCtrl.createPhotoAvatarUpload,
  generationCtrl.createPhotoAvatar
);

// WORKFLOW ROUTES (public - no authentication required)
router.get("/pending-workflows/:userId", generationCtrl.checkPendingWorkflows);
router.post("/track-execution", generationCtrl.trackExecution);

// VIDEO GENERATION ROUTES (public - no authentication required)
router.post("/create", generationCtrl.createVideo);
router.post("/generate-video", generationCtrl.generateVideo);
router.post("/download", generationCtrl.downloadVideo);

// VIDEO STATUS ROUTES (public - for webhook callbacks)
router.post("/status", galleryCtrl.updateVideoStatus);

// TOPIC ROUTES (public - no authentication required)
router.get("/topics", resourcesCtrl.getAllTopics);
router.get("/topics/id/:id", resourcesCtrl.getTopicById);
router.get("/topics/:topic", resourcesCtrl.getTopicByType);

export default router;
