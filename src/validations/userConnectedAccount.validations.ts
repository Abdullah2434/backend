import { z } from "zod";
import { ValidationError } from "../types";

// ==================== VALIDATION SCHEMAS ====================

/**
 * Account type route parameter validation schema
 */
export const accountTypeParamSchema = z.object({
  type: z.string().min(1, "Account type is required"),
});

/**
 * SocialBu account ID route parameter validation schema
 */
export const socialbuAccountIdParamSchema = z.object({
  socialbuAccountId: z
    .string()
    .min(1, "SocialBu account ID is required")
    .refine(
      (val) => !isNaN(parseInt(val, 10)),
      "SocialBu account ID must be a valid number"
    ),
});

// ==================== TYPE INFERENCES ====================

export type AccountTypeParamData = z.infer<typeof accountTypeParamSchema>;
export type SocialbuAccountIdParamData = z.infer<
  typeof socialbuAccountIdParamSchema
>;

// ==================== VALIDATION RESULT INTERFACES ====================

export interface AccountTypeParamValidationResult {
  success: boolean;
  data?: AccountTypeParamData;
  errors?: ValidationError[];
}

export interface SocialbuAccountIdParamValidationResult {
  success: boolean;
  data?: SocialbuAccountIdParamData;
  errors?: ValidationError[];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate account type route parameter
 */
export function validateAccountTypeParam(
  data: unknown
): AccountTypeParamValidationResult {
  const validationResult = accountTypeParamSchema.safeParse(data);

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
 * Validate SocialBu account ID route parameter
 */
export function validateSocialbuAccountIdParam(
  data: unknown
): SocialbuAccountIdParamValidationResult {
  const validationResult = socialbuAccountIdParamSchema.safeParse(data);

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

