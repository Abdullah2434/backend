import { z } from "zod";

// ==================== SOCIALBU ACCOUNT VALIDATIONS ====================

export const accountIdParamSchema = z.object({
  accountId: z
    .string()
    .min(1, "Account ID is required")
    .refine(
      (val) => !isNaN(parseInt(val, 10)),
      "Invalid account ID format. Must be a valid number"
    ),
});

