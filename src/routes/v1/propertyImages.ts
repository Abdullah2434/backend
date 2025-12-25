import { Router } from "express";
import {
  uploadPropertyImages,
  uploadPropertyImagesMiddleware,
  forwardPropertyWebhook,
  uploadMusicVideo,
  uploadPropertyVideoMiddleware,
} from "../../controllers/propertyImages.controller";

const router = Router();

// Multipart/form-data: field "images" for files, "payload" (JSON string) for metadata
router.post("/property-images", uploadPropertyImagesMiddleware, uploadPropertyImages);

// JSON body: forward property data to webhook
router.post("/property-webhook", forwardPropertyWebhook);

// Multipart/form-data: music video with startImage and restImages
router.post("/music-video", uploadPropertyVideoMiddleware, uploadMusicVideo);

export default router;

