import { Router } from "express";
import * as videoController from "../controllers/video.controller";
import {
  validateVideoDelete,
  validateVideoDownload,
  validateVideoStatus,
  validateVideoCreate,
  validateVideoGenerate,
  validateVideoDownloadProxy,
  validatePhotoAvatar,
  validatePendingWorkflows,
  validateTrackExecution,
  validateTopicByType,
  validateTopicById,
  handleValidationErrors,
} from "../validation/video.validation";
import {
  videoGeneralRateLimit,
  videoUploadRateLimit,
  videoDownloadRateLimit,
  videoCreationRateLimit,
  authenticate,
  optionalAuth,
  securityHeaders,
  requestLogger,
  errorHandler,
  requestSizeLimit,
  sanitizeInput,
  requestId,
  validateContentType,
  createPhotoAvatarUpload,
  validateVideoOwnership,
} from "../middleware/video.middleware";

const router = Router();

// ==================== MIDDLEWARE SETUP ====================

// Apply security headers to all routes
router.use(securityHeaders);

// Apply request ID to all routes
router.use(requestId);

// Apply request logging to all routes
router.use(requestLogger);

// Apply input sanitization to all routes
router.use(sanitizeInput);

// Apply content type validation to POST/PUT routes
router.use(validateContentType);

// Apply request size limit to all routes
router.use(requestSizeLimit);

// ==================== PROTECTED ROUTES (authentication required) ====================

// Video gallery
router.get(
  "/gallery",
  videoGeneralRateLimit,
  authenticate,
  videoController.gallery
);

// Video deletion
router.post(
  "/delete",
  videoGeneralRateLimit,
  authenticate,
  validateVideoDelete,
  handleValidationErrors,
  validateVideoOwnership,
  videoController.deleteVideo
);

// Video download proxy
router.get(
  "/download-proxy",
  videoDownloadRateLimit,
  authenticate,
  validateVideoDownloadProxy,
  handleValidationErrors,
  videoController.downloadProxy
);

// Avatar management
router.get(
  "/avatars",
  videoGeneralRateLimit,
  authenticate,
  videoController.getAvatars
);

// Voice management
router.get(
  "/voices",
  videoGeneralRateLimit,
  authenticate,
  videoController.getVoices
);

// Photo avatar creation
router.post(
  "/photo-avatar",
  videoUploadRateLimit,
  authenticate,
  createPhotoAvatarUpload.single("image"),
  validatePhotoAvatar,
  handleValidationErrors,
  videoController.createPhotoAvatar
);

// Pending workflows check
router.get(
  "/pending-workflows/:userId",
  videoGeneralRateLimit,
  authenticate,
  validatePendingWorkflows,
  handleValidationErrors,
  videoController.checkPendingWorkflows
);

// ==================== PUBLIC ROUTES (no authentication required) ====================

// Video download
router.post(
  "/download",
  videoDownloadRateLimit,
  validateVideoDownload,
  handleValidationErrors,
  videoController.download
);

// Video status update
router.post(
  "/status",
  videoGeneralRateLimit,
  validateVideoStatus,
  handleValidationErrors,
  videoController.updateStatus
);

// Video creation via webhook
router.post(
  "/create",
  videoCreationRateLimit,
  validateVideoCreate,
  handleValidationErrors,
  videoController.createVideo
);

// Video generation
router.post(
  "/generate-video",
  videoCreationRateLimit,
  validateVideoGenerate,
  handleValidationErrors,
  videoController.generateVideo
);

// Topic routes
router.get("/topics", videoGeneralRateLimit, videoController.getAllTopics);

router.get(
  "/topics/id/:id",
  videoGeneralRateLimit,
  validateTopicById,
  handleValidationErrors,
  videoController.getTopicById
);

router.get(
  "/topics/:topic",
  videoGeneralRateLimit,
  validateTopicByType,
  handleValidationErrors,
  videoController.getTopicByType
);

// Execution tracking
router.post(
  "/track-execution",
  videoGeneralRateLimit,
  validateTrackExecution,
  handleValidationErrors,
  videoController.trackExecution
);

// ==================== ERROR HANDLING ====================

// Global error handler for video routes
router.use(errorHandler);

export default router;
