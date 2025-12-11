/**
 * Constants for dynamic post generation service
 */

// Default platforms
export const DEFAULT_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "twitter",
  "tiktok",
  "youtube",
] as const;

// Topic analysis keywords
export const MARKET_KEYWORDS = [
  "rate",
  "price",
  "inventory",
  "market",
  "housing",
  "mortgage",
  "trend",
  "forecast",
  "drop",
  "rise",
  "increase",
  "decrease",
] as const;

export const TIPS_KEYWORDS = [
  "mistake",
  "tip",
  "how to",
  "strategy",
  "avoid",
  "checklist",
  "guide",
  "step",
  "advice",
  "should",
  "don't",
] as const;

export const LOCAL_KEYWORDS = [
  "neighborhood",
  "community",
  "local",
  "development",
  "area",
  "district",
  "city",
  "downtown",
  "suburb",
] as const;

// Sentiment analysis words
export const POSITIVE_WORDS = [
  "increase",
  "rise",
  "growth",
  "opportunity",
  "benefit",
  "advantage",
  "success",
  "boom",
  "hot",
  "strong",
] as const;

export const NEGATIVE_WORDS = [
  "decrease",
  "drop",
  "fall",
  "decline",
  "crash",
  "crisis",
  "problem",
  "issue",
  "concern",
  "weak",
] as const;

// Hook types
export const AVAILABLE_HOOK_TYPES = [
  "question",
  "bold_statement",
  "story",
  "data",
  "provocative",
] as const;

// Tone options
export const AVAILABLE_TONES = [
  "casual",
  "professional",
  "educational",
  "energetic",
] as const;

// CTA types
export const AVAILABLE_CTA_TYPES = [
  "question",
  "collaborative",
  "action",
  "share",
] as const;

// Post history limits
export const POST_HISTORY_LIMIT = 10;
export const PATTERN_ANALYSIS_LIMIT = 5;
export const RECENT_POSTS_FOR_ANALYSIS = 3;
export const RECENT_VARIANTS_TO_AVOID = 2;
export const RECENT_CTAS_TO_AVOID = 2;

// Content similarity threshold
export const HIGH_SIMILARITY_THRESHOLD = 0.3;

// OpenAI configuration
export const OPENAI_MODEL = "gpt-4";
export const OPENAI_TEMPERATURE = 0.75;
export const OPENAI_MAX_TOKENS = 1500;

// Platform-specific character limits
// These are used for AI generation guidance
// Hard limits are enforced by truncateSocialMediaCaptions utility
export const PLATFORM_CHARACTER_LIMITS = {
  instagram: { min: 150, max: 2000 },
  facebook: { min: 50, max: 5000 },
  linkedin: { min: 150, max: 3000 },
  twitter: { min: 50, max: 280 },
  tiktok: { min: 100, max: 2200 },
  youtube: { min: 300, max: 5000 },
} as const;

// Platform-specific hashtag counts
export const PLATFORM_HASHTAG_COUNTS = {
  instagram: { min: 5, max: 8 },
  facebook: { min: 1, max: 3 },
  linkedin: { min: 3, max: 5 },
  twitter: { min: 2, max: 5 },
  tiktok: { min: 3, max: 5 },
  youtube: { min: 8, max: 12 },
} as const;

