/**
 * Constants for video controller
 */

// ==================== VIDEO STATUSES ====================
export const VALID_VIDEO_STATUSES = ["processing", "ready", "failed"] as const;

export type VideoStatus = typeof VALID_VIDEO_STATUSES[number];

// ==================== LANGUAGE MAPPING ====================
export const LANGUAGE_MAP: Record<string, string> = {
  english: "en",
  spanish: "es",
  french: "fr",
  german: "de",
  italian: "it",
  portuguese: "pt",
  chinese: "zh",
  japanese: "ja",
  korean: "ko",
} as const;

// ==================== PLATFORMS ====================
export const SOCIAL_MEDIA_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "twitter",
  "tiktok",
  "youtube",
] as const;

// ==================== DEFAULT VALUES ====================
export const DEFAULT_LANGUAGE = "English";
export const DEFAULT_ENERGY_LEVEL = "mid";
export const DEFAULT_VIDEO_CONTENT_TYPE = "video/mp4";
export const ESTIMATED_COMPLETION_MINUTES = 15;

// ==================== ERROR MESSAGES ====================
export const ERROR_MESSAGES = {
  ACCESS_TOKEN_REQUIRED: "Access token is required",
  INVALID_ACCESS_TOKEN: "Invalid or expired access token",
  USER_NOT_FOUND: "User not found",
  VIDEO_NOT_FOUND: "Video not found",
  UNAUTHORIZED: "Unauthorized to perform this action",
  INTERNAL_SERVER_ERROR: "Internal server error",
} as const;

