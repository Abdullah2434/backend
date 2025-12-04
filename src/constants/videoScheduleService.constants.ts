/**
 * Constants for VideoSchedule services
 */

// ==================== API CONFIGURATION ====================
export const API_BASE_URL =
  process.env.API_BASE_URL || "https://backend.edgeairealty.com";
export const CREATE_VIDEO_ENDPOINT = "/api/video/create";
export const GENERATE_VIDEO_ENDPOINT = "/api/video/generate-video";

// ==================== TIMING CONSTANTS ====================
export const PROCESSING_BUFFER_MINUTES = 30;
export const PROCESSING_BUFFER_MS = PROCESSING_BUFFER_MINUTES * 60 * 1000;
export const MIN_SCHEDULE_BUFFER_MINUTES = 40;
export const MIN_SCHEDULE_BUFFER_MS = MIN_SCHEDULE_BUFFER_MINUTES * 60 * 1000;
export const BATCH_DELAY_MS = 2000;
export const CHUNK_DELAY_MS = 1000;
export const API_CALL_DELAY_MS = 2000;

// ==================== SCHEDULE CONFIGURATION ====================
export const DEFAULT_SCHEDULE_DURATION_MONTHS = 1;
export const CHUNK_SIZE = 5;
export const MAX_ATTEMPTS = 10;
export const MAX_IMMEDIATE_POSTS = 10;
export const CAPTION_BATCH_SIZE = 3;

// ==================== FREQUENCY VALUES ====================
export const FREQUENCY_ONCE_WEEK = "once_week";
export const FREQUENCY_TWICE_WEEK = "twice_week";
export const FREQUENCY_THREE_WEEK = "three_week";
export const FREQUENCY_DAILY = "daily";

// ==================== VALID DAYS ====================
export const VALID_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

// ==================== TIME FORMAT ====================
export const TIME_FORMAT_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

// ==================== STATUS VALUES ====================
export const STATUS_PENDING = "pending";
export const STATUS_PROCESSING = "processing";
export const STATUS_COMPLETED = "completed";
export const STATUS_FAILED = "failed";
export const STATUS_READY = "ready";

// ==================== CAPTION STATUS ====================
export const CAPTION_STATUS_PENDING = "pending";
export const CAPTION_STATUS_READY = "ready";
export const CAPTION_STATUS_FAILED = "failed";

// ==================== SOCIAL MEDIA PLATFORMS ====================
export const SOCIAL_MEDIA_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "twitter",
  "tiktok",
  "youtube",
] as const;

// ==================== ERROR MESSAGES ====================
export const ERROR_MESSAGES = {
  SCHEDULE_NOT_FOUND: "Schedule not found",
  SCHEDULE_NOT_ACTIVE: "Schedule not found or not active",
  USER_ALREADY_HAS_SCHEDULE: "User already has an active video schedule",
  USER_SETTINGS_NOT_FOUND: "User video settings not found. Please complete your profile first.",
  POST_INDEX_OUT_OF_RANGE: "Post index out of range",
  POST_NOT_FOUND: "Post not found",
  CAN_ONLY_EDIT_PENDING: "Can only edit pending posts",
  INVALID_POST_ID_FORMAT: "Invalid post ID format",
  TREND_NOT_FOUND: "Trend not found",
  VIDEO_ALREADY_PROCESSING: "Video is already being processed",
  VIDEO_ALREADY_COMPLETED: "Video is already completed",
  CANNOT_PROCESS_STATUS: "Cannot process video with status",
  EXPECTED_PENDING: "Expected: pending",
  SUBSCRIPTION_REQUIRED: "Active subscription required. Your subscription has expired or is not active.",
  VIDEO_LIMIT_REACHED: "Video limit reached",
  CREATE_VIDEO_API_FAILED: "Create Video API failed",
  GENERATE_VIDEO_API_FAILED: "Generate Video API failed",
  FAILED_TO_GENERATE_TRENDS: "Failed to generate trends",
  TREND_MISSING_FIELDS: "Trend is missing required fields",
  INVALID_TIME_FORMAT: "Invalid time format",
  INVALID_DAY: "Invalid day",
  ONCE_WEEK_REQUIREMENTS: "Once a week requires exactly 1 day and 1 time",
  TWICE_WEEK_REQUIREMENTS: "Twice a week requires exactly 2 days and 2 times",
  THREE_WEEK_REQUIREMENTS: "Three times a week requires exactly 3 days and 3 times",
  DAILY_REQUIREMENTS: "Daily requires exactly 1 time and no specific days",
} as const;

// ==================== DEFAULT VALUES ====================
export const DEFAULT_ZIP_CODE = 90014;
export const DEFAULT_ZIP_KEYPOINTS = "new bars and restaurants";
export const DEFAULT_CAPTION_FALLBACK = "Real Estate Update - Check out the latest market insights!";
export const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
export const DEFAULT_MUSIC_URL_EXPIRY = 604800; // 7 days in seconds

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
};

// ==================== VOICE PRESET SETTINGS ====================
export const VOICE_PRESET_LOW = {
  stability: 0.70,
  similarity_boost: 0.8,
  style: 0.0,
  use_speaker_boost: true,
  speed: 0.85,
} as const;

export const VOICE_PRESET_MEDIUM = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
  speed: 1.0,
} as const;

export const VOICE_PRESET_HIGH = {
  stability: 0.35,
  similarity_boost: 0.7,
  style: 0.0,
  use_speaker_boost: true,
  speed: 1.1,
} as const;

// ==================== EMAIL SUBJECTS ====================
export const EMAIL_SUBJECTS = {
  SCHEDULE_CREATED: (totalVideos: number) => `🎬 Your Video Schedule is Ready! ${totalVideos} videos scheduled`,
  VIDEO_PROCESSING: (videoTitle: string) => `🎬 Video Processing Started: ${videoTitle}`,
  VIDEO_GENERATED: (isLastVideo: boolean, videoTitle: string) =>
    isLastVideo
      ? `🎉 Final Video Generated! Your schedule is complete`
      : `✅ Video Generated: ${videoTitle}`,
  SUBSCRIPTION_EXPIRED: "⚠️ Scheduled Video Failed: Subscription Required",
  VIDEO_LIMIT_REACHED: "⚠️ Scheduled Video Failed: Video Limit Reached",
} as const;

// ==================== FRONTEND URLS ====================
export const FRONTEND_URL = process.env.FRONTEND_URL || "https://www.edgeairealty.com";
export const SUPPORT_EMAIL = "support@edgeai.com";
export const EDGEAI_WEBSITE_URL = "https://www.edgeairealty.com/";
export const CREATE_VIDEO_URL = "https://www.edgeairealty.com/create-video";

// ==================== HTTP STATUS CODES ====================
export const HTTP_STATUS_SUCCESS_MIN = 200;
export const HTTP_STATUS_SUCCESS_MAX = 299;

// ==================== AWS S3 CONFIGURATION ====================
export const AWS_REGION = process.env.AWS_REGION || "us-east-1";
export const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || "";
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || "";
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";

