import { z } from "zod";

/**
 * Validation schema for HeyGen video avatar from API
 */
export const heyGenVideoAvatarSchema = z.object({
  avatar_id: z.string().min(1, "avatar_id is required"),
  avatar_name: z.string().optional(),
  gender: z.string().optional(),
  preview_image_url: z.string().url().optional().or(z.literal("")),
  preview_video_url: z.string().url().optional().or(z.literal("")),
});

/**
 * Validation schema for HeyGen photo avatar (talking photo) from API
 */
export const heyGenPhotoAvatarSchema = z.object({
  talking_photo_id: z.string().min(1, "talking_photo_id is required"),
  talking_photo_name: z.string().optional(),
  preview_image_url: z.string().url().optional().or(z.literal("")),
});

/**
 * Validation schema for HeyGen voice from API
 */
export const heyGenVoiceSchema = z.object({
  voice_id: z.string().min(1, "voice_id is required"),
  language: z.string().min(1, "language is required"),
  gender: z.string().min(1, "gender is required"),
  name: z.string().optional(),
  preview_audio: z.string().url().optional().or(z.literal("")),
});

/**
 * Validation schema for HeyGen avatars API response
 */
export const heyGenAvatarsAPIResponseSchema = z.object({
  data: z
    .object({
      avatars: z.array(heyGenVideoAvatarSchema).optional(),
      talking_photos: z.array(heyGenPhotoAvatarSchema).optional(),
    })
    .optional(),
});

/**
 * Validation schema for HeyGen voices API response
 */
export const heyGenVoicesAPIResponseSchema = z.object({
  data: z
    .object({
      voices: z.array(heyGenVoiceSchema).optional(),
    })
    .optional(),
});

/**
 * Validation schema for processed avatar data
 */
export const processedAvatarSchema = z.object({
  avatar_id: z.string().min(1, "avatar_id is required"),
  avatar_name: z.string().min(1, "avatar_name is required"),
  gender: z.string().min(1, "gender is required"),
  preview_image_url: z.string().url().optional().or(z.literal("")),
  preview_video_url: z.string().url().optional().nullable(),
  avatarType: z.enum(["video_avatar", "photo_avatar"]),
});

/**
 * Valid avatar types
 */
export const VALID_AVATAR_TYPES = ["video_avatar", "photo_avatar"] as const;

/**
 * Default values
 */
export const DEFAULT_AVATAR_NAME = "Unnamed Avatar";
export const DEFAULT_GENDER = "unknown";
export const DEFAULT_AVATAR_STATUS = "ready";

