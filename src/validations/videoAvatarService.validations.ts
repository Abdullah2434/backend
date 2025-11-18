import { z } from "zod";

/**
 * Validation schema for HeyGen submit payload
 */
export const heyGenSubmitPayloadSchema = z.object({
  training_footage_url: z.string().url("training_footage_url must be a valid URL"),
  video_consent_url: z.string().url("video_consent_url must be a valid URL"),
  avatar_name: z.string().min(1, "avatar_name is required"),
  callback_id: z.string().optional(),
  callback_url: z.string().url("callback_url must be a valid URL").optional().or(z.literal("")),
});

/**
 * Validation schema for HeyGen response
 */
export const heyGenResponseSchema = z.object({
  data: z
    .object({
      avatar_id: z.string().optional(),
      avatar_name: z.string().optional(),
      status: z.enum(["processing", "completed", "failed"]).optional(),
      preview_image_url: z.string().optional(),
      preview_video_url: z.string().optional(),
      default_voice_id: z.string().optional(),
    })
    .optional(),
});

/**
 * Validation schema for avatar status
 */
export const avatarStatusSchema = z.enum(["processing", "completed", "failed"]);

/**
 * Validation schema for update avatar status
 */
export const updateAvatarStatusSchema = z.enum(["in_progress", "completed", "failed"]);

/**
 * Valid video avatar statuses
 */
export const VALID_VIDEO_AVATAR_STATUSES = ["processing", "completed", "failed"] as const;

/**
 * Valid update avatar statuses
 */
export const VALID_UPDATE_AVATAR_STATUSES = ["in_progress", "completed", "failed"] as const;

/**
 * Valid file types
 */
export const VALID_FILE_TYPES = ["training_footage", "consent_statement"] as const;

/**
 * Constants
 */
export const POLLING_INTERVAL_MS = 10000; // 10 seconds
export const S3_SIGNED_URL_EXPIRATION_SECONDS = 86400; // 24 hours
export const AVATAR_ID_PREFIX = "avatar_";
export const AVATAR_GROUP_ID_PREFIX = "group_";
export const DEFAULT_VIDEO_AVATAR_STATUS = "training";
export const DEFAULT_VIDEO_AVATAR_TYPE = "video_avatar";

