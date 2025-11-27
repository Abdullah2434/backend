/**
 * Constants for Video Service
 */

// ==================== VIDEO STATUSES ====================
export const VIDEO_STATUS_PROCESSING = "processing";
export const VIDEO_STATUS_READY = "ready";
export const VIDEO_STATUS_FAILED = "failed";

// ==================== VIDEO ID & SECURITY ====================
export const VIDEO_ID_PREFIX = "video_";
export const SECRET_KEY_BYTES = 32;
export const VIDEO_ID_RANDOM_BYTES = 8;

// ==================== DOWNLOAD URL ====================
export const DOWNLOAD_URL_EXPIRY_SECONDS = 3600; // 1 hour

// ==================== DEFAULT VALUES ====================
export const DEFAULT_VIDEO_STATUS = VIDEO_STATUS_PROCESSING;
export const DEFAULT_CONTENT_TYPE = "video/mp4";
export const DEFAULT_VIDEO_TITLE = "My Video";
export const DEFAULT_VIDEO_EXTENSION = ".mp4";

// ==================== USER CONTEXT DEFAULTS ====================
export const DEFAULT_USER_NAME = "Real Estate Professional";
export const DEFAULT_USER_POSITION = "Real Estate Professional";
export const DEFAULT_COMPANY_NAME = "Real Estate Company";
export const DEFAULT_CITY = "Your City";
export const DEFAULT_SOCIAL_HANDLES = "@realestate";

// ==================== HTTP HEADERS ====================
export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

// ==================== ERROR MESSAGES ====================
export const ERROR_MESSAGES = {
  USER_NOT_FOUND: "User not found",
  VIDEO_LIMIT_REACHED:
    "Video limit reached. You can create up to 30 videos per month. Your subscription will renew monthly.",
  FAILED_TO_DOWNLOAD_VIDEO: "Failed to download video",
} as const;

