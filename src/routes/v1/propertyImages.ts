import { Router, RequestHandler } from "express";
import {
  analyseListingImage,
  analyseListingImageMiddleware,
  listingCreateVideo,
  createTourVideo,
  uploadTourVideoMiddleware,
  createAnimatedVideo,
} from "../../controllers/propertyImages.controller";

const router = Router();

// Multipart/form-data: field "images" for files, "payload" (JSON string) for metadata
router.post(
  "/analyse-listing-image",
  analyseListingImageMiddleware as unknown as RequestHandler,
  analyseListingImage
);

// JSON body: create listing video from property data
router.post("/listing-create-video", listingCreateVideo);

// Multipart/form-data: tour video with startImage and restImages
router.post("/tour-video", uploadTourVideoMiddleware, createTourVideo);

// JSON body: create animated video
router.post("/animated-video", createAnimatedVideo);

export default router;
