/**
 * Types for ElevenLabs TTS service
 */

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
}

export interface TextToSpeechOptions {
  // Either text (single field) OR hook/body/conclusion (three fields)
  text?: string;
  hook?: string;
  body?: string;
  conclusion?: string;
  voice_id: string;
  output_format?: string;
  model_id?: string; // Optional: Override model (e.g., "eleven_turbo_v2_5" for 40k chars, "eleven_flash_v2_5" for 40k chars)
  voice_settings?: VoiceSettings; // Optional: Voice settings for cloned voices
  apply_text_normalization?: "auto" | "on" | "off"; // Optional: Text normalization mode
  seed?: number | null; // Optional: Seed for deterministic sampling
  pronunciation_dictionary_locators?: Array<{
    pronunciation_dictionary_id: string;
    version_id?: string | null;
  }> | null; // Optional: Pronunciation dictionary locators
}

export interface SpeechResult {
  url: string;
  buffer: Buffer; // Include buffer for concatenation
  model_id: string;
  contentType: string;
}

export interface TextLengths {
  hook: number;
  body: number;
  conclusion: number;
}

export interface PronunciationDictionaryLocator {
  pronunciation_dictionary_id: string;
  version_id?: string | null;
}

