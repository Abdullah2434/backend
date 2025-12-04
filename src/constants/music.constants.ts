// ==================== MUSIC CONSTANTS ====================

/**
 * Maximum file size for music uploads (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Preview URL expiration time in seconds (1 hour)
 */
export const PREVIEW_URL_EXPIRATION = 3600;

/**
 * Valid energy categories for music tracks
 */
export const VALID_ENERGY_CATEGORIES = ["high", "mid", "low"] as const;

/**
 * Default AWS region
 */
export const DEFAULT_AWS_REGION = "us-east-1";

/**
 * Audio MIME type prefix
 */
export const AUDIO_MIME_TYPE_PREFIX = "audio/";

