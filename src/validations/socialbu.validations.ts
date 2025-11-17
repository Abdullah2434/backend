import { z } from "zod";

// ==================== SOCIALBU VALIDATIONS ====================

export const saveTokenSchema = z.object({
  authToken: z.string().min(1, "Auth token is required"),
  id: z.union([z.string(), z.number()]).transform((val) => typeof val === "string" ? parseInt(val, 10) : val),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Email must be a valid email address"),
  verified: z.boolean().optional().default(false),
});

export const connectAccountSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  postback_url: z.string().url("Postback URL must be a valid URL").optional(),
  account_id: z.string().optional(),
  user_id: z.string().optional(), // Optional since we can get it from auth
});

export const getPostsSchema = z.object({
  type: z.string().optional(),
  account_id: z.union([z.string(), z.number()]).optional(),
  limit: z.union([z.string(), z.number()]).optional(),
  offset: z.union([z.string(), z.number()]).optional(),
});

export const getInsightsSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  metrics: z.union([z.string(), z.array(z.string())]).optional(),
});

export const getScheduledPostsSchema = z.object({
  user_id: z.string().optional(), // Optional since we can get it from auth
});

