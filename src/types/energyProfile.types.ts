// ==================== ENERGY PROFILE TYPES ====================

import { VoiceEnergyLevel, MusicEnergyLevel } from "../constants/voiceEnergy";

/**
 * Energy profile response data
 */
export interface EnergyProfileResponse {
  voiceEnergy: VoiceEnergyLevel;
  musicEnergy: MusicEnergyLevel;
  customVoiceMusic: boolean;
  selectedMusicTrackId?: string;
}

/**
 * Preset configuration with description
 */
export interface PresetConfiguration {
  energyLevel: string;
  title: string;
  voiceDescription: string;
  musicDescription: string;
  bestFor: string;
}

/**
 * Energy profile data from service
 */
export interface EnergyProfileData {
  voiceEnergy: VoiceEnergyLevel;
  musicEnergy: MusicEnergyLevel;
  selectedMusicTrack?: any;
  customVoiceMusic: boolean;
  voiceParams: any;
}

