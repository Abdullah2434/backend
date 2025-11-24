import { z } from "zod";
import { ValidationError } from "../types";

// ==================== VALIDATION SCHEMAS ====================

/**
 * Update payment method validation schema
 */
export const updatePaymentMethodSchema = z.object({
  setupIntentId: z.string().min(1, "Setup intent ID is required"),
  setAsDefault: z.boolean().optional().default(false),
});

/**
 * Set default payment method route parameter schema
 */
export const setDefaultPaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, "Payment method ID is required"),
});

/**
 * Remove payment method route parameter schema
 */
export const removePaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, "Payment method ID is required"),
});

// ==================== TYPE INFERENCES ====================

export type UpdatePaymentMethodData = z.infer<typeof updatePaymentMethodSchema>;
export type SetDefaultPaymentMethodData = z.infer<
  typeof setDefaultPaymentMethodSchema
>;
export type RemovePaymentMethodData = z.infer<
  typeof removePaymentMethodSchema
>;

// ==================== VALIDATION RESULT INTERFACES ====================

export interface UpdatePaymentMethodValidationResult {
  success: boolean;
  data?: UpdatePaymentMethodData;
  errors?: ValidationError[];
}

export interface SetDefaultPaymentMethodValidationResult {
  success: boolean;
  data?: SetDefaultPaymentMethodData;
  errors?: ValidationError[];
}

export interface RemovePaymentMethodValidationResult {
  success: boolean;
  data?: RemovePaymentMethodData;
  errors?: ValidationError[];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate update payment method request data
 */
export function validateUpdatePaymentMethod(
  data: unknown
): UpdatePaymentMethodValidationResult {
  const validationResult = updatePaymentMethodSchema.safeParse(data);

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
 * Validate set default payment method route parameter
 */
export function validateSetDefaultPaymentMethod(
  data: unknown
): SetDefaultPaymentMethodValidationResult {
  const validationResult = setDefaultPaymentMethodSchema.safeParse(data);

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
 * Validate remove payment method route parameter
 */
export function validateRemovePaymentMethod(
  data: unknown
): RemovePaymentMethodValidationResult {
  const validationResult = removePaymentMethodSchema.safeParse(data);

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

