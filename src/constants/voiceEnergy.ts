export const VOICE_ENERGY_PRESETS = {
   low: {
    stability: 0.70, // Lower for more natural variation
    similarity_boost: 0.80, // Higher for better voice match
    style: 0.0, // Lower for more natural delivery
    use_speaker_boost: true,
    speed: 0.85, // Slightly faster but still natural
  },
  medium: {
    stability: 0.5, // Balanced for natural speech
    similarity_boost: 0.75, // Higher for better voice match
    style: 0.0, // Lower for natural delivery
    use_speaker_boost: true,
    speed: 1.0, // Natural pace
  },
  mid: {
    stability: 0.5, // Balanced for natural speech
    similarity_boost: 0.75, // Higher for better voice match
    style: 0.0, // Lower for natural delivery
    use_speaker_boost: true,
    speed: 1.0, // Natural pace
  },
  high: {
    stability: 0.35, // Slightly higher but still allows variation
    similarity_boost: 0.75, // Higher for better voice match
    style: 0.0, // Very low for most natural delivery
    use_speaker_boost: true,
    speed: 1.1, // Slightly slower for emphasis
  },
} as const;

export type VoiceEnergyLevel = keyof typeof VOICE_ENERGY_PRESETS;
export type MusicEnergyLevel = "high" | "mid" | "low" | "custom";

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
