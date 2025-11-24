/**
 * Trends service constants
 */

export const DEFAULT_TREND_COUNT = 10;
export const MIN_TREND_COUNT = 1;
export const MAX_TREND_COUNT = 20;
export const SUPER_FAST_MAX_COUNT = 3;
export const FAST_MAX_COUNT = 5;
export const TEMPLATE_BASED_THRESHOLD = 5;

export const TOPIC_REAL_ESTATE = "real_estate";
export const LOCATION_AMERICA = "America";

/**
 * Content moderation error keywords
 */
export const CONTENT_MODERATION_KEYWORDS = [
  "CONTENT_MODERATION_ERROR",
  "inappropriate",
  "racism",
  "nudity",
  "vulgar",
] as const;

/**
 * Validation error keywords
 */
export const VALIDATION_ERROR_KEYWORDS = [
  "VALIDATION_ERROR",
  "not related to real estate",
  "not real estate related",
] as const;

/**
 * OpenAI API URLs
 */
export const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
export const OPENAI_MODERATION_URL = "https://api.openai.com/v1/moderations";

/**
 * Cache duration in milliseconds (1 hour)
 */
export const CACHE_DURATION = 60 * 60 * 1000;
