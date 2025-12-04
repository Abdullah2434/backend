/**
 * Constants for ElevenLabs TTS service
 */

// ==================== ELEVENLABS API CONFIGURATION ====================
export const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
export const API_KEY = process.env.ELEVENLABS_API_KEY;

// ==================== S3 CONFIGURATION ====================
export const VOICE_S3_BUCKET = "voice-elven-lab-audio";
export const DEFAULT_VOICE_AUDIO_URL_EXPIRY_SECONDS = 604800; // 7 days

// ==================== MODEL CHARACTER LIMITS ====================
// Character limits per model (from ElevenLabs documentation)
export const MODEL_CHARACTER_LIMITS: Record<string, number> = {
  "eleven_multilingual_v1": 10000,
  "eleven_multilingual_v2": 10000,
  "eleven_turbo_v2": 30000,
  "eleven_turbo_v2_5": 40000,
  "eleven_flash_v2": 30000,
  "eleven_flash_v2_5": 40000,
  "eleven_english_v1": 10000,
  "eleven_english_v2": 10000,
} as const;

// Default limit for unknown models
export const DEFAULT_CHARACTER_LIMIT = 10000;

// ==================== MODEL SELECTION THRESHOLDS ====================
export const TURBO_V2_5_THRESHOLD = 10000; // Use turbo_v2_5 for text > 10k chars
export const TURBO_V2_THRESHOLD = 5000; // Use turbo_v2 for text > 5k chars
export const WORD_BOUNDARY_MIN_RATIO = 0.7; // Minimum 70% of maxLength for word boundary split

// ==================== DEFAULT VALUES ====================
export const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
export const DEFAULT_MODEL = "eleven_multilingual_v2";
export const DEFAULT_TEXT_NORMALIZATION = "auto" as const;

