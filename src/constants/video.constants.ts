// ==================== VIDEO CONSTANTS ====================

export const VALID_VIDEO_STATUSES = ["processing", "ready", "failed"] as const;

export const DEFAULT_LANGUAGE = "English";

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

export const VALID_ENERGY_LEVELS = ["high", "mid", "low"] as const;

export const DEFAULT_ENERGY_LEVEL = "mid";

export const ESTIMATED_COMPLETION_MINUTES = 15;

export const TEMP_DIR = "/tmp";

export const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "twitter",
  "tiktok",
  "youtube",
] as const;

