import { z } from "zod";

/**
 * Validation schema for avatar status from API response
 */
export const avatarStatusResponseSchema = z.object({
  data: z
    .object({
      status: z.string().optional(),
    })
    .optional(),
});

/**
 * Validation schema for avatar document
 */
export const avatarDocumentSchema = z.object({
  avatar_id: z.string().min(1, "avatar_id is required"),
  avatar_name: z.string().optional(),
  userId: z.any().optional(), // Can be ObjectId or string
  preview_image_url: z.string().optional(),
  status: z.string().optional(),
});

/**
 * Valid avatar statuses
 */
export const VALID_AVATAR_STATUSES = ["pending", "training", "ready", "processing", "completed", "failed"] as const;

/**
 * Validation schema for avatar status check result
 */
export const avatarStatusCheckResultSchema = z.object({
  updated: z.boolean(),
  avatarId: z.string(),
  error: z.boolean().optional(),
});

