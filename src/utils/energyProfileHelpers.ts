import { Request } from "express";
import { AuthenticatedRequest } from "../types";

// ==================== HELPER FUNCTIONS ====================

/**
 * Get user email from authenticated request
 */
export function getUserEmail(req: AuthenticatedRequest | Request): string | null {
  return (req as AuthenticatedRequest).user?.email || null;
}

/**
 * Format energy profile response data
 */
export function formatEnergyProfileResponse(settings: any) {
  return {
    voiceEnergy: settings.voiceEnergy,
    musicEnergy: settings.musicEnergy,
    customVoiceMusic: settings.customVoiceMusic,
    selectedMusicTrackId: settings.selectedMusicTrackId,
  };
}

