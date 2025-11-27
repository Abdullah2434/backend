/**
 * Constants for video avatar controller
 */

// ==================== FILE UPLOAD CONSTANTS ====================
export const TEMP_DIR = "/tmp/";
export const MAX_FILE_SIZE = 1000 * 1024 * 1024; // 1GB
export const MAX_FIELD_SIZE = 1000 * 1024 * 1024; // 1GB
export const MAX_FILES = 10;
export const MAX_FIELDS = 20;
export const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

// ==================== AVATAR CONSTANTS ====================
export const TEMP_AVATAR_ID = "temp-avatar-id";

// ==================== NOTIFICATION STATUSES ====================
export const NOTIFICATION_STATUSES = {
  VALIDATION: "validation",
  PROGRESS: "progress",
  COMPLETED: "completed",
  ERROR: "error",
  FINAL_RESULT: "final_result",
} as const;

