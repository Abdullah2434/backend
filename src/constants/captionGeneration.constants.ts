/**
 * Constants for caption generation service
 */

// ==================== OPENAI API CONFIGURATION ====================
export const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const OPENAI_MODEL = "gpt-3.5-turbo";
export const OPENAI_MAX_TOKENS = 1000;
export const OPENAI_TEMPERATURE = 0.7;

// ==================== PLATFORM CHARACTER LIMITS ====================
export const PLATFORM_CHAR_LIMITS = {
  INSTAGRAM: 2200,
  FACEBOOK: 63206,
  LINKEDIN: 3000,
  TWITTER: 280,
  TIKTOK: 150,
  YOUTUBE: 5000,
} as const;

// ==================== DEFAULT LANGUAGE ====================
export const DEFAULT_CAPTION_LANGUAGE = "English";

// ==================== SYSTEM PROMPT ====================
export const CAPTION_GENERATION_SYSTEM_PROMPT =
  "You are a professional social media marketing expert specializing in real estate content. Create engaging, platform-specific captions that drive engagement and conversions.";

