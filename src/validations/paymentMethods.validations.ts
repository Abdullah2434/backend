import { z } from "zod";

// ==================== PAYMENT METHODS VALIDATIONS ====================

export const updatePaymentMethodSchema = z.object({
  setupIntentId: z.string().min(1, "Setup intent ID is required"),
  setAsDefault: z.boolean().optional().default(false),
});

export const setDefaultPaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, "Payment method ID is required"),
});

export const removePaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, "Payment method ID is required"),
});

