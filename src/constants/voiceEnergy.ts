export const VOICE_ENERGY_PRESETS = {
  high: {
    stability: 0.3,
    similarity_boost: 0.75,
    style: 0.6,
    use_speaker_boost: true,
    speed: 1.15,
    emotion_tags: "[excited] [enthusiastic]",
  },
  mid: {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.4,
    use_speaker_boost: true,
    speed: 1.0,
    emotion_tags: "",
  },
  low: {
    stability: 0.7,
    similarity_boost: 0.75,
    style: 0.2,
    use_speaker_boost: true,
    speed: 0.9,
    emotion_tags: "[calm] [professional]",
  },
} as const;

export type VoiceEnergyLevel = keyof typeof VOICE_ENERGY_PRESETS;
export type MusicEnergyLevel = "high" | "mid" | "low";

export interface VoiceEnergyParams {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
  emotion_tags: string;
}

export const ENERGY_PROFILE_DESCRIPTIONS = {
  high: {
    title: "HIGH ENERGY",
    voiceDescription: "Upbeat & enthusiastic delivery (1.15x speed)",
    musicDescription: "Energetic & motivating background",
    bestFor: "Open houses, new listings, exciting announcements",
  },
  mid: {
    title: "MID ENERGY",
    voiceDescription: "Professional & conversational tone (1.0x speed)",
    musicDescription: "Smooth & engaging background",
    bestFor: "Property tours, market analysis, general updates",
  },
  low: {
    title: "LOW ENERGY",
    voiceDescription: "Calm & authoritative delivery (0.9x speed)",
    musicDescription: "Subtle & sophisticated background",
    bestFor: "Luxury properties, financial advice, testimonials",
  },
} as const;
