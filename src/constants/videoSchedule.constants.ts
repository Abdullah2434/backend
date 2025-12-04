/**
 * Constants for video schedule controller
 */

// ==================== DATE CONSTANTS ====================
export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const DEFAULT_DURATION = "1 month";

// ==================== VIDEO STATUSES ====================
export const VIDEO_STATUSES = {
  COMPLETED: "completed",
  PENDING: "pending",
  PROCESSING: "processing",
  FAILED: "failed",
} as const;

