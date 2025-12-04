/**
 * Types for ElevenLabs Voice service
 */

export interface ElevenLabsApiVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  labels?: {
    gender?: string;
    age?: string;
    descriptive?: string;
    use_case?: string;
    language?: string;
  };
  preview_url: string;
  high_quality_base_model_ids?: string[];
  verified_languages?: Array<{
    language: string;
    model_id: string;
    accent: string;
    locale: string;
    preview_url: string;
  }>;
}

export interface VoiceForEnergyDetection {
  name: string;
  category?: string;
  description?: string;
  gender?: string;
  age?: string;
  labels?: { descriptive?: string; use_case?: string };
}

export interface EnergyDetectionResult {
  energy: "low" | "medium" | "high";
  conclusion: string;
}

export interface AddCustomVoiceParams {
  files: Express.Multer.File[];
  name: string;
  description?: string;
  language?: string;
  gender?: string;
  userId: string;
}

export interface VerifiedLanguageEn {
  language: string;
  model_id: string;
  accent: string;
  locale: string;
  preview_url: string;
}

