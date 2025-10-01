// ==================== VIDEO MODULE EXPORTS ====================

// Types
export * from "./types/video.types";

// Controllers
export {
  gallery,
  deleteVideo,
  download,
  updateStatus,
  createVideo,
  generateVideo,
  downloadProxy,
  getAvatars,
  getVoices,
  createPhotoAvatar,
  checkPendingWorkflows,
  trackExecution,
  getAllTopics,
  getTopicByType,
  getTopicById,
} from "./controllers/video.controller";

// Services
export { default as VideoModuleService } from "./services/video.service";

// Middleware
export {
  createVideoRateLimit,
  videoGeneralRateLimit,
  videoUploadRateLimit,
  videoDownloadRateLimit,
  videoCreationRateLimit,
  authenticate,
  optionalAuth,
  securityHeaders,
  requestSizeLimit,
  createPhotoAvatarUpload,
  requestLogger,
  errorHandler,
  corsOptions,
  sanitizeInput,
  requestId,
  validateContentType,
  validateVideoOwnership,
  requireEmailVerification,
} from "./middleware/video.middleware";

// Validation
export {
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
  validateVideoId,
  validateTitle,
  validateEmail,
  validateExecutionId,
  validateVideoUrl,
  validateStatus,
  validateVideoData,
  sanitizeTitle,
  sanitizeEmail,
  sanitizeUrl,
} from "./validation/video.validation";

// Routes
export { default as videoRoutes } from "./routes/video.routes";

// Utils
export {
  generateVideoId,
  generateExecutionId,
  generateRequestId,
  isValidVideoId,
  isValidTitle,
  isValidEmail,
  isValidExecutionId,
  isValidVideoUrl,
  isValidStatus,
  isValidMongoId,
  sanitizeTitle as sanitizeTitleUtil,
  sanitizeEmail as sanitizeEmailUtil,
  sanitizeUrl as sanitizeUrlUtil,
  sanitizeText,
  sanitizeInput as sanitizeInputUtil,
  formatVideoTitle,
  formatVideoStatus,
  formatFileSize,
  formatDuration,
  maskEmail,
  maskVideoId,
  formatDate,
  formatDateReadable,
  getTimeAgo,
  logVideoEvent,
  logVideoError,
  logVideoSecurity,
  getVideoConfig,
  isDevelopment,
  isProduction,
  validateInput,
  extractVideoIdFromUrl,
  isValidVideoMimeType,
  isValidImageMimeType,
  getVideoThumbnail,
  calculateVideoHash,
  generateVideoMetadata,
} from "./utils/video.utils";

// ==================== MODULE CONFIGURATION ====================

export const videoModuleConfig = {
  name: "video",
  version: "1.0.0",
  description: "Video creation, management, and processing module",
  routes: {
    prefix: "/api/video",
    public: [
      "POST /download",
      "POST /status",
      "POST /create",
      "POST /generate-video",
      "GET /topics",
      "GET /topics/id/:id",
      "GET /topics/:topic",
      "POST /track-execution",
    ],
    protected: [
      "GET /gallery",
      "POST /delete",
      "GET /download-proxy",
      "GET /avatars",
      "GET /voices",
      "POST /photo-avatar",
      "GET /pending-workflows/:userId",
    ],
  },
  features: [
    "Video gallery management",
    "Video creation and generation",
    "Video download and processing",
    "Avatar and voice management",
    "Photo avatar creation",
    "Workflow tracking",
    "Topic management",
    "Status updates",
    "File upload handling",
    "Webhook integration",
  ],
  security: {
    rateLimiting: true,
    inputValidation: true,
    securityHeaders: true,
    requestLogging: true,
    errorHandling: true,
    inputSanitization: true,
    contentTypeValidation: true,
    authentication: true,
    fileUploadValidation: true,
  },
};
