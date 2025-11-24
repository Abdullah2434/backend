import { z } from "zod";
import { ValidationError } from "../types";

// ==================== VALIDATION SCHEMAS ====================

/**
 * Create video avatar validation schema
 */
export const createVideoAvatarSchema = z.object({
  avatar_name: z.string().min(1, "Avatar name is required"),
  avatar_group_id: z.string().optional(),
  callback_id: z.string().optional(),
  callback_url: z
    .string()
    .url("Callback URL must be a valid URL")
    .optional()
    .or(z.literal("")),
  training_footage_url: z
    .string()
    .url("Training footage URL must be a valid URL")
    .optional(),
  consent_statement_url: z
    .string()
    .url("Consent statement URL must be a valid URL")
    .optional(),
})
  .refine(
    (data) => {
      // At least one of training_footage_url or file must be provided
      // File validation is handled separately in the controller
      return true;
    },
    {
      message: "Either training_footage file or training_footage_url is required",
    }
  )
  .refine(
    (data) => {
      // At least one of consent_statement_url or file must be provided
      // File validation is handled separately in the controller
      return true;
    },
    {
      message:
        "Either consent_statement file or consent_statement_url is required",
    }
  );

/**
 * Avatar ID route parameter validation schema
 */
export const avatarIdParamSchema = z.object({
  id: z.string().min(1, "Avatar ID is required"),
});

/**
 * S3 key route parameter validation schema
 */
export const s3KeyParamSchema = z.object({
  s3Key: z.string().min(1, "S3 key is required"),
});

// ==================== TYPE INFERENCES ====================

export type CreateVideoAvatarData = z.infer<typeof createVideoAvatarSchema>;
export type AvatarIdParamData = z.infer<typeof avatarIdParamSchema>;
export type S3KeyParamData = z.infer<typeof s3KeyParamSchema>;

// ==================== VALIDATION RESULT INTERFACES ====================

export interface CreateVideoAvatarValidationResult {
  success: boolean;
  data?: CreateVideoAvatarData;
  errors?: ValidationError[];
}

export interface AvatarIdParamValidationResult {
  success: boolean;
  data?: AvatarIdParamData;
  errors?: ValidationError[];
}

export interface S3KeyParamValidationResult {
  success: boolean;
  data?: S3KeyParamData;
  errors?: ValidationError[];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate create video avatar request data
 */
export function validateCreateVideoAvatar(
  data: unknown
): CreateVideoAvatarValidationResult {
  const validationResult = createVideoAvatarSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

/**
 * Validate avatar ID route parameter
 */
export function validateAvatarIdParam(
  data: unknown
): AvatarIdParamValidationResult {
  const validationResult = avatarIdParamSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

/**
 * Validate S3 key route parameter
 */
export function validateS3KeyParam(
  data: unknown
): S3KeyParamValidationResult {
  const validationResult = s3KeyParamSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

