import { z } from "zod";

// ==================== ENERGY PROFILE VALIDATIONS ====================

export const setPresetProfileSchema = z.object({
  energyLevel: z.enum(["high", "mid", "low"], {
    errorMap: () => ({
      message: "Invalid energy level. Must be 'high', 'mid', or 'low'",
    }),
  }),
});

export const setCustomVoiceMusicSchema = z.object({
  voiceEnergy: z.enum(["high", "mid", "low"], {
    errorMap: () => ({
      message: "voiceEnergy must be 'high', 'mid', or 'low'",
    }),
  }),
  musicEnergy: z.enum(["high", "mid", "low"], {
    errorMap: () => ({
      message: "musicEnergy must be 'high', 'mid', or 'low'",
    }),
  }),
  selectedMusicTrackId: z.string().optional(),
});

