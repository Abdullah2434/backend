// ==================== VIDEO SCHEDULE CONSTANTS ====================

export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const DEFAULT_DURATION = "1 month";

// Video statuses
export const VIDEO_STATUSES = {
  COMPLETED: "completed",
  PENDING: "pending",
  PROCESSING: "processing",
  FAILED: "failed",
} as const;

// Valid days
export const VALID_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

// Valid frequencies
export const VALID_FREQUENCIES = [
  "once_week",
  "twice_week",
  "three_week",
  "daily",
] as const;

