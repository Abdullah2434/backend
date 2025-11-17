import { z } from "zod";

// ==================== MUSIC VALIDATIONS ====================

export const uploadMusicTrackSchema = z.object({
  name: z.string().min(1, "Name is required"),
  energyCategory: z.enum(["high", "mid", "low"], {
    errorMap: () => ({
      message: "energyCategory must be 'high', 'mid', or 'low'",
    }),
  }),
  duration: z
    .string()
    .min(1, "Duration is required")
    .refine(
      (val) => !isNaN(parseInt(val)) && parseInt(val) > 0,
      "Duration must be a positive number"
    ),
  artist: z.string().optional(),
  source: z.string().optional(),
  license: z.string().optional(),
  genre: z.string().optional(),
});

export const getMusicTracksByEnergySchema = z.object({
  energyCategory: z.enum(["high", "mid", "low"], {
    errorMap: () => ({
      message: "Invalid energy category. Must be 'high', 'mid', or 'low'",
    }),
  }),
});

export const getMusicTrackByIdSchema = z.object({
  trackId: z.string().min(1, "trackId is required"),
});

export const streamMusicPreviewSchema = z.object({
  trackId: z.string().min(1, "trackId is required"),
});

export const deleteMusicTrackSchema = z.object({
  trackId: z.string().min(1, "trackId is required"),
});

