import User from "../models/User";
import { VoiceEnergyLevel, MusicEnergyLevel } from "../constants/voiceEnergy";
import { UserVideoSettingsData } from "../types/services/userVideoSettings.types";

// ==================== USER UTILITIES ====================
/**
 * Find user by email
 */
export async function findUserByEmail(email: string) {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

/**
 * Find user by email (returns null if not found)
 */
export async function findUserByEmailOrNull(email: string) {
  return await User.findOne({ email });
}

// ==================== DATA TRANSFORMATION ====================
/**
 * Build update data object for user video settings
 */
export function buildUpdateData(data: UserVideoSettingsData) {
  const updateData: any = {
    prompt: data.prompt,
    avatar: data.avatar,
    titleAvatar: data.titleAvatar,
    conclusionAvatar: data.conclusionAvatar,
    bodyAvatar: data.bodyAvatar,
    name: data.name,
    position: data.position,
    companyName: data.companyName,
    license: data.license,
    tailoredFit: data.tailoredFit,
    socialHandles: data.socialHandles,
    city: data.city,
    preferredTone: data.preferredTone,
    callToAction: data.callToAction,
    gender: data.gender,
    email: data.email,
    voiceEnergy: data.voiceEnergy,
    musicEnergy: data.musicEnergy,
    selectedMusicTrackId: data.selectedMusicTrackId,
    selectedVoiceId: data.selectedVoiceId,
    preset: data.preset,
    selectedVoicePreset: data.selectedVoicePreset,
    selectedMusicPreset: data.selectedMusicPreset,
    customVoiceMusic: data.customVoiceMusic,
  };
  
  // Explicitly include language if provided (even if empty string or null)
  if (data.language !== undefined) {
    updateData.language = data.language || null;
  }
  
  return updateData;
}

/**
 * Build new settings data object
 */
export function buildNewSettingsData(
  userId: any, // mongoose.Types.ObjectId
  data: UserVideoSettingsData
) {
  return {
    userId,
    email: data.email,
    prompt: data.prompt,
    avatar: data.avatar,
    titleAvatar: data.titleAvatar,
    conclusionAvatar: data.conclusionAvatar,
    bodyAvatar: data.bodyAvatar,
    name: data.name,
    position: data.position,
    companyName: data.companyName,
    license: data.license,
    tailoredFit: data.tailoredFit,
    socialHandles: data.socialHandles,
    city: data.city,
    preferredTone: data.preferredTone,
    callToAction: data.callToAction,
    gender: data.gender,
    language: data.language,
    voiceEnergy: data.voiceEnergy,
    musicEnergy: data.musicEnergy,
    selectedMusicTrackId: data.selectedMusicTrackId,
    selectedVoiceId: data.selectedVoiceId,
    preset: data.preset,
    selectedVoicePreset: data.selectedVoicePreset,
    selectedMusicPreset: data.selectedMusicPreset,
    customVoiceMusic: data.customVoiceMusic,
  };
}

// ==================== VALIDATION ====================
/**
 * Validate energy level
 */
export function isValidEnergyLevel(
  level: string
): level is VoiceEnergyLevel | MusicEnergyLevel {
  return ["high", "mid", "low"].includes(level);
}

/**
 * Validate music track matches energy level
 */
export function validateMusicTrackEnergy(
  trackEnergy: string | undefined,
  expectedEnergy: MusicEnergyLevel
): boolean {
  return trackEnergy === expectedEnergy;
}

// ==================== DEFAULT VALUES ====================
/**
 * Get default voice energy level
 */
export function getDefaultVoiceEnergy(): VoiceEnergyLevel {
  return "mid";
}

/**
 * Get default music energy level
 */
export function getDefaultMusicEnergy(): MusicEnergyLevel {
  return "mid";
}

