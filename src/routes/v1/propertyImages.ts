import { Router, RequestHandler } from "express";
import {
  uploadPropertyImages,
  uploadPropertyImagesMiddleware,
  forwardPropertyWebhook,
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

export default router;
