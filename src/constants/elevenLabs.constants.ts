/**
 * ElevenLabs API constants
 */

export const ELEVEN_LABS_MODELS = [
  "eleven_multilingual_v1",
  "eleven_multilingual_v2",
  "eleven_turbo_v2",
  "eleven_turbo_v2_5",
  "eleven_flash_v2",
  "eleven_flash_v2_5",
  "eleven_english_v1",
  "eleven_english_v2",
] as const;

export const MODEL_CHARACTER_LIMITS: Record<string, string> = {
  eleven_multilingual_v1: "10,000 characters",
  eleven_multilingual_v2: "10,000 characters",
  eleven_turbo_v2: "30,000 characters",
  eleven_turbo_v2_5: "40,000 characters",
  eleven_flash_v2: "30,000 characters",
  eleven_flash_v2_5: "40,000 characters",
  eleven_english_v1: "10,000 characters",
  eleven_english_v2: "10,000 characters",
};

export const VALID_ENERGY_CATEGORIES = ["low", "medium", "high"] as const;
export const VALID_GENDERS = ["male", "female", "unknown"] as const;

export const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
export const DEFAULT_LANGUAGE = "en";

