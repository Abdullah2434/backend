import { z } from "zod";

// ==================== DYNAMIC POST VALIDATIONS ====================

// User context schema
export const userContextSchema = z.object({
  name: z.string().optional(),
  position: z.string().optional(),
  companyName: z.string().optional(),
  city: z.string().optional(),
  socialHandles: z.string().optional(),
});

// Generate dynamic posts request body schema
export const generateDynamicPostsSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  keyPoints: z.string().min(1, "Key points are required"),
  platforms: z.array(z.string()).optional(),
  userContext: userContextSchema.optional(),
});

// Test dynamic posts request body schema
export const testDynamicPostsSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  keyPoints: z.string().min(1, "Key points are required"),
  platforms: z.union([z.array(z.string()), z.string()]).optional(),
  userContext: userContextSchema.optional(),
});

// Get post history query schema
export const getPostHistoryQuerySchema = z.object({
  platform: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "Limit must be a positive number",
    }),
});

// Get post analytics query schema
export const getPostAnalyticsQuerySchema = z.object({
  platform: z.string().optional(),
  days: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 30))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "Days must be a positive number",
    }),
});

// Get templates query schema
export const getTemplatesQuerySchema = z.object({
  platform: z.string().optional(),
  variant: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : undefined))
    .refine((val) => val === undefined || !isNaN(val), {
      message: "Variant must be a number",
    }),
});

// Re-export scheduleIdParamSchema from videoSchedule validations
export { scheduleIdParamSchema } from "./videoSchedule.validations";

