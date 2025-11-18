import { z } from "zod";

/**
 * Validation schema for SocialBu webhook payload
 */
export const socialBuWebhookSchema = z.object({
  account_action: z
    .string()
    .min(1, "account_action is required")
    .refine(
      (val) => ["added", "updated", "removed"].includes(val),
      "account_action must be one of: added, updated, removed"
    ),
  account_id: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
    .refine((val) => !isNaN(val) && val > 0, "account_id must be a positive number"),
  account_type: z.string().min(1, "account_type is required"),
  account_name: z.string().min(1, "account_name is required"),
});

/**
 * Validation schema for user_id query parameter
 */
export const userIdQuerySchema = z.object({
  user_id: z.string().optional(),
});

/**
 * Validation schema for userId path parameter
 */
export const userIdParamSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

/**
 * Validation schema for removing SocialBu account
 */
export const removeSocialBuAccountSchema = z.object({
  accountId: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
    .refine((val) => !isNaN(val) && val > 0, "accountId must be a positive number"),
});

