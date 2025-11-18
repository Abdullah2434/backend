import { z } from "zod";

// ==================== USER CONNECTED ACCOUNT VALIDATIONS ====================

export const accountTypeParamSchema = z.object({
  type: z.string().min(1, "Account type is required"),
});

export const socialbuAccountIdParamSchema = z.object({
  socialbuAccountId: z
    .string()
    .min(1, "SocialBu account ID is required")
    .refine(
      (val) => !isNaN(parseInt(val, 10)),
      "SocialBu account ID must be a valid number"
    ),
});

