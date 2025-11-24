import { z } from "zod";
import { ValidationError } from "../types";

// ==================== VALIDATION SCHEMAS ====================

/**
 * Create subscription validation schema
 */
export const createSubscriptionSchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
  paymentMethodId: z.string().min(1, "Payment method ID is required"),
});

/**
 * Create payment intent validation schema
 */
export const createPaymentIntentSchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
});

/**
 * Confirm payment intent validation schema
 */
export const confirmPaymentIntentSchema = z.object({
  paymentIntentId: z.string().min(1, "Payment intent ID is required"),
  paymentMethodId: z.string().min(1, "Payment method ID is required"),
});

/**
 * Payment intent ID route parameter validation schema
 */
export const paymentIntentIdParamSchema = z.object({
  id: z.string().min(1, "Payment intent ID is required"),
});

/**
 * Get payment intent status query validation schema
 */
export const getPaymentIntentStatusQuerySchema = z.object({
  autoSync: z.string().optional(),
});

/**
 * Change plan validation schema
 */
export const changePlanSchema = z.object({
  newPlanId: z.string().min(1, "New plan ID is required"),
});

/**
 * Get billing history query validation schema
 */
export const getBillingHistoryQuerySchema = z.object({
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      const num = typeof val === "string" ? parseInt(val, 10) : val;
      return num && num > 0 ? Math.min(num, 100) : 20; // Max 100, default 20
    }),
  offset: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      const num = typeof val === "string" ? parseInt(val, 10) : val;
      return num && num >= 0 ? num : 0;
    }),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * Sync subscription from Stripe validation schema
 */
export const syncSubscriptionFromStripeSchema = z
  .object({
    stripeSubscriptionId: z.string().optional(),
    paymentIntentId: z.string().optional(),
  })
  .refine(
    (data) => data.stripeSubscriptionId || data.paymentIntentId,
    {
      message:
        "Either stripeSubscriptionId or paymentIntentId is required",
      path: ["stripeSubscriptionId"],
    }
  );

/**
 * Auto sync on payment success validation schema
 */
export const autoSyncOnPaymentSuccessSchema = z.object({
  paymentIntentId: z.string().min(1, "Payment intent ID is required"),
});

/**
 * Debug webhook validation schema
 */
export const debugWebhookSchema = z
  .object({
    paymentIntentId: z.string().optional(),
    subscriptionId: z.string().optional(),
  })
  .refine(
    (data) => data.paymentIntentId || data.subscriptionId,
    {
      message: "Either paymentIntentId or subscriptionId is required",
      path: ["paymentIntentId"],
    }
  );

// ==================== TYPE INFERENCES ====================

export type CreateSubscriptionData = z.infer<typeof createSubscriptionSchema>;
export type CreatePaymentIntentData = z.infer<typeof createPaymentIntentSchema>;
export type ConfirmPaymentIntentData = z.infer<
  typeof confirmPaymentIntentSchema
>;
export type PaymentIntentIdParamData = z.infer<
  typeof paymentIntentIdParamSchema
>;
export type GetPaymentIntentStatusQueryData = z.infer<
  typeof getPaymentIntentStatusQuerySchema
>;
export type ChangePlanData = z.infer<typeof changePlanSchema>;
export type GetBillingHistoryQueryData = z.infer<
  typeof getBillingHistoryQuerySchema
>;
export type SyncSubscriptionFromStripeData = z.infer<
  typeof syncSubscriptionFromStripeSchema
>;
export type AutoSyncOnPaymentSuccessData = z.infer<
  typeof autoSyncOnPaymentSuccessSchema
>;
export type DebugWebhookData = z.infer<typeof debugWebhookSchema>;

// ==================== VALIDATION RESULT INTERFACES ====================

export interface CreateSubscriptionValidationResult {
  success: boolean;
  data?: CreateSubscriptionData;
  errors?: ValidationError[];
}

export interface CreatePaymentIntentValidationResult {
  success: boolean;
  data?: CreatePaymentIntentData;
  errors?: ValidationError[];
}

export interface ConfirmPaymentIntentValidationResult {
  success: boolean;
  data?: ConfirmPaymentIntentData;
  errors?: ValidationError[];
}

export interface PaymentIntentIdParamValidationResult {
  success: boolean;
  data?: PaymentIntentIdParamData;
  errors?: ValidationError[];
}

export interface GetPaymentIntentStatusQueryValidationResult {
  success: boolean;
  data?: GetPaymentIntentStatusQueryData;
  errors?: ValidationError[];
}

export interface ChangePlanValidationResult {
  success: boolean;
  data?: ChangePlanData;
  errors?: ValidationError[];
}

export interface GetBillingHistoryQueryValidationResult {
  success: boolean;
  data?: GetBillingHistoryQueryData;
  errors?: ValidationError[];
}

export interface SyncSubscriptionFromStripeValidationResult {
  success: boolean;
  data?: SyncSubscriptionFromStripeData;
  errors?: ValidationError[];
}

export interface AutoSyncOnPaymentSuccessValidationResult {
  success: boolean;
  data?: AutoSyncOnPaymentSuccessData;
  errors?: ValidationError[];
}

export interface DebugWebhookValidationResult {
  success: boolean;
  data?: DebugWebhookData;
  errors?: ValidationError[];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate create subscription request data
 */
export function validateCreateSubscription(
  data: unknown
): CreateSubscriptionValidationResult {
  const validationResult = createSubscriptionSchema.safeParse(data);

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
 * Validate create payment intent request data
 */
export function validateCreatePaymentIntent(
  data: unknown
): CreatePaymentIntentValidationResult {
  const validationResult = createPaymentIntentSchema.safeParse(data);

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
 * Validate confirm payment intent request data
 */
export function validateConfirmPaymentIntent(
  data: unknown
): ConfirmPaymentIntentValidationResult {
  const validationResult = confirmPaymentIntentSchema.safeParse(data);

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
 * Validate payment intent ID route parameter
 */
export function validatePaymentIntentIdParam(
  data: unknown
): PaymentIntentIdParamValidationResult {
  const validationResult = paymentIntentIdParamSchema.safeParse(data);

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
 * Validate get payment intent status query parameters
 */
export function validateGetPaymentIntentStatusQuery(
  data: unknown
): GetPaymentIntentStatusQueryValidationResult {
  const validationResult = getPaymentIntentStatusQuerySchema.safeParse(data);

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
 * Validate change plan request data
 */
export function validateChangePlan(
  data: unknown
): ChangePlanValidationResult {
  const validationResult = changePlanSchema.safeParse(data);

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
 * Validate get billing history query parameters
 */
export function validateGetBillingHistoryQuery(
  data: unknown
): GetBillingHistoryQueryValidationResult {
  const validationResult = getBillingHistoryQuerySchema.safeParse(data);

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
 * Validate sync subscription from Stripe request data
 */
export function validateSyncSubscriptionFromStripe(
  data: unknown
): SyncSubscriptionFromStripeValidationResult {
  const validationResult = syncSubscriptionFromStripeSchema.safeParse(data);

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
 * Validate auto sync on payment success request data
 */
export function validateAutoSyncOnPaymentSuccess(
  data: unknown
): AutoSyncOnPaymentSuccessValidationResult {
  const validationResult = autoSyncOnPaymentSuccessSchema.safeParse(data);

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
 * Validate debug webhook request data
 */
export function validateDebugWebhook(
  data: unknown
): DebugWebhookValidationResult {
  const validationResult = debugWebhookSchema.safeParse(data);

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

