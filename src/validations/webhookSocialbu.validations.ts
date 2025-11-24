import { z } from "zod";
import { ValidationError } from "../types";
import { VALID_ACCOUNT_ACTIONS } from "../constants/socialbu.constants";

// ==================== VALIDATION SCHEMAS ====================

/**
 * Validation schema for SocialBu webhook payload
 */
export const socialBuWebhookSchema = z.object({
  account_action: z
    .string()
    .min(1, "account_action is required")
    .refine(
      (val) => VALID_ACCOUNT_ACTIONS.includes(val as typeof VALID_ACCOUNT_ACTIONS[number]),
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

// ==================== TYPE INFERENCES ====================

export type SocialBuWebhookData = z.infer<typeof socialBuWebhookSchema>;
export type UserIdQueryData = z.infer<typeof userIdQuerySchema>;
export type UserIdParamData = z.infer<typeof userIdParamSchema>;
export type RemoveSocialBuAccountData = z.infer<typeof removeSocialBuAccountSchema>;

// ==================== VALIDATION RESULT INTERFACES ====================

export interface SocialBuWebhookValidationResult {
  success: boolean;
  data?: SocialBuWebhookData;
  errors?: ValidationError[];
}

export interface UserIdQueryValidationResult {
  success: boolean;
  data?: UserIdQueryData;
  errors?: ValidationError[];
}

export interface UserIdParamValidationResult {
  success: boolean;
  data?: UserIdParamData;
  errors?: ValidationError[];
}

export interface RemoveSocialBuAccountValidationResult {
  success: boolean;
  data?: RemoveSocialBuAccountData;
  errors?: ValidationError[];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate SocialBu webhook request data
 */
export function validateSocialBuWebhook(
  data: unknown
): SocialBuWebhookValidationResult {
  const validationResult = socialBuWebhookSchema.safeParse(data);

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
 * Validate user ID query parameter
 */
export function validateUserIdQuery(
  data: unknown
): UserIdQueryValidationResult {
  const validationResult = userIdQuerySchema.safeParse(data);

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
 * Validate user ID path parameter
 */
export function validateUserIdParam(
  data: unknown
): UserIdParamValidationResult {
  const validationResult = userIdParamSchema.safeParse(data);

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
 * Validate remove SocialBu account request data
 */
export function validateRemoveSocialBuAccount(
  data: unknown
): RemoveSocialBuAccountValidationResult {
  const validationResult = removeSocialBuAccountSchema.safeParse(data);

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

