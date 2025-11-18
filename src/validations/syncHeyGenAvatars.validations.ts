import { z } from "zod";

/**
 * Validation schema for HeyGen avatar from API (for sync)
 */
export const syncHeyGenAvatarSchema = z.object({
  avatar_id: z.string().optional(),
});

/**
 * Validation schema for HeyGen avatars API response (for sync)
 */
export const syncHeyGenAvatarsAPIResponseSchema = z.object({
  data: z
    .object({
      avatars: z.array(syncHeyGenAvatarSchema).optional(),
      talking_photos: z.array(syncHeyGenAvatarSchema).optional(),
    })
    .optional(),
});

/**
 * Cron schedule constants for HeyGen avatars sync
 */
export const HEYGEN_AVATARS_SYNC_SCHEDULE = "3 */12 * * *"; // Every 12 hours at minute 3

