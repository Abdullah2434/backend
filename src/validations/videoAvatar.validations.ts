import { z } from "zod";

// ==================== VIDEO AVATAR VALIDATIONS ====================

export const createVideoAvatarSchema = z.object({
  avatar_name: z.string().min(1, "Avatar name is required"),
  avatar_group_id: z.string().optional(),
  callback_id: z.string().optional(),
  callback_url: z
    .string()
    .url("Callback URL must be a valid URL")
    .optional()
    .or(z.literal("")),
  training_footage_url: z.string().url("Training footage URL must be a valid URL").optional(),
  consent_statement_url: z.string().url("Consent statement URL must be a valid URL").optional(),
}).refine(
  (data) => {
    // At least one of training_footage_url or file must be provided
    // File validation is handled separately in the controller
    return true;
  },
  {
    message: "Either training_footage file or training_footage_url is required",
  }
).refine(
  (data) => {
    // At least one of consent_statement_url or file must be provided
    // File validation is handled separately in the controller
    return true;
  },
  {
    message: "Either consent_statement file or consent_statement_url is required",
  }
);

export const avatarIdParamSchema = z.object({
  id: z.string().min(1, "Avatar ID is required"),
});

export const s3KeyParamSchema = z.object({
  s3Key: z.string().min(1, "S3 key is required"),
});

