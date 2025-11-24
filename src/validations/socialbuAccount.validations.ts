import { z } from "zod";
import { ValidationError } from "../types";

// ==================== VALIDATION SCHEMAS ====================

/**
 * Account ID route parameter validation schema
 */
export const accountIdParamSchema = z.object({
  accountId: z
    .string()
    .min(1, "Account ID is required")
    .refine(
      (val) => !isNaN(parseInt(val, 10)),
      "Invalid account ID format. Must be a valid number"
    ),
});

// ==================== TYPE INFERENCES ====================

export type AccountIdParamData = z.infer<typeof accountIdParamSchema>;

// ==================== VALIDATION RESULT INTERFACES ====================

export interface AccountIdParamValidationResult {
  success: boolean;
  data?: AccountIdParamData;
  errors?: ValidationError[];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate account ID route parameter
 */
export function validateAccountIdParam(
  data: unknown
): AccountIdParamValidationResult {
  const validationResult = accountIdParamSchema.safeParse(data);

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

