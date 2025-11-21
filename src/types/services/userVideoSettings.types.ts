/**
 * Types for userVideoSettings service
 */

import { VoiceEnergyLevel, MusicEnergyLevel } from "../../constants/voiceEnergy";

export interface AvatarObject {
  avatar_id: string;
  avatarType: string;
}

export interface UserVideoSettingsData {
  prompt: string;
  avatar: string[];
  titleAvatar: AvatarObject | string;
  conclusionAvatar: AvatarObject | string;
  bodyAvatar?: AvatarObject | string;
  name: string;
  position: string;
  companyName: string;
  license: string;
  tailoredFit: string;
  socialHandles: string;
  city: string;
  preferredTone: string;
  callToAction: string;
  gender?: "male" | "female";
  language?: string;
  email: string;
  voiceEnergy?: VoiceEnergyLevel;
  musicEnergy?: MusicEnergyLevel;
  selectedMusicTrackId?: string;
  selectedVoiceId?: string;
  preset?: string;
  selectedVoicePreset?: string;
  selectedMusicPreset?: string;
  customVoiceMusic?: boolean;
}

