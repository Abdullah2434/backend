/**
 * Constants for ElevenLabs Voice service
 */

import OpenAI from "openai";

// ==================== ELEVENLABS API CONFIGURATION ====================
export const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/voices?show_all=true";
export const ELEVENLABS_ADD_VOICE_URL = "https://api.elevenlabs.io/v1/voices/add";
export const ELEVENLABS_EDIT_VOICE_URL = "https://api.elevenlabs.io/v1/voices";
export const API_KEY = process.env.ELEVENLABS_API_KEY;

// ==================== OPENAI CONFIGURATION ====================
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==================== ENERGY DETECTION CONFIGURATION ====================
export const ENERGY_DETECTION_MODEL = "gpt-4o-mini";
export const ENERGY_DETECTION_TEMPERATURE = 0.3;
export const ENERGY_DETECTION_MAX_TOKENS = 200;

// ==================== DEFAULT VALUES ====================
export const DEFAULT_LANGUAGE = "en";
export const DEFAULT_CATEGORY = "custom";
export const DEFAULT_GENDER = "unknown";
export const DEFAULT_AGE = "unknown";
export const DEFAULT_ACCENT = "american";
export const DEFAULT_LOCALE = "en-US";
export const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

// ==================== VALIDATION ====================
export const VALID_ENERGY_LEVELS = ["low", "medium", "high"] as const;
export const CLONED_CATEGORY = "cloned";

