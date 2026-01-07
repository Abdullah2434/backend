import { Router, RequestHandler } from "express";
import {
  uploadPropertyImages,
  uploadPropertyImagesMiddleware,
  forwardPropertyWebhook,
  uploadTourVideo,
  uploadTourVideoMiddleware,
  createNarratedVideo,
} from "../../controllers/propertyImages.controller";

const router = Router();

// Multipart/form-data: field "images" for files, "payload" (JSON string) for metadata
router.post(
  "/analyse-listing-image",
  uploadPropertyImagesMiddleware as unknown as RequestHandler,
  uploadPropertyImages
);

// JSON body: forward property data to webhook
router.post("/listing-create-video", forwardPropertyWebhook);

// Multipart/form-data: tour video with startImage and restImages
router.post("/tour-video", uploadTourVideoMiddleware, uploadTourVideo);

// JSON body: create narrated video
router.post("/narrated-video", createNarratedVideo);

export default router;
