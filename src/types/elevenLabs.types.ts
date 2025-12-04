// ==================== ELEVENLABS TYPES ====================

/**
 * Voice settings configuration
 */
export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
}

/**
 * Cloned voice access validation result
 */
export interface ClonedVoiceAccessResult {
  user: any;
  voiceSettings: VoiceSettings | null;
}

/**
 * ElevenLabs model type
 */
export type ElevenLabsModel =
  | "eleven_multilingual_v1"
  | "eleven_multilingual_v2"
  | "eleven_turbo_v2"
  | "eleven_turbo_v2_5"
  | "eleven_flash_v2"
  | "eleven_flash_v2_5"
  | "eleven_english_v1"
  | "eleven_english_v2";

/**
 * Energy category type
 */
export type EnergyCategory = "low" | "medium" | "high";

/**
 * Gender type
 */
export type Gender = "male" | "female" | "unknown";

/**
 * Voice response with custom flag
 */
export interface VoiceResponse {
  voice_id: string;
  name: string;
  gender?: string;
  description?: string;
  energy?: string;
  preview_url?: string;
  userId?: string;
  isCustom: boolean;
}

/**
 * Voice details response
 */
export interface VoiceDetailsResponse {
  voice_id: string;
  preview_url?: string;
  name: string;
  energy?: string;
  description?: string;
}

/**
 * Text-to-speech response
 */
export interface TextToSpeechResponse {
  hook_url: string;
  body_url: string;
  conclusion_url: string;
  model_id?: string;
}

/**
 * Custom voice creation response
 */
export interface CustomVoiceResponse {
  voice_id: string;
  name: string;
  description?: string;
  gender?: string;
  category: string;
  energy?: string;
  preview_url?: string;
}

/**
 * Voice filter query parameters
 */
export interface VoiceFilterQuery {
  energyCategory?: EnergyCategory;
  gender?: Gender;
}

