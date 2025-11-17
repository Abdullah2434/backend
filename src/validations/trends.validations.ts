import { z } from "zod";

// ==================== TRENDS VALIDATIONS ====================

export const getCityBasedTrendsSchema = z.object({
  city: z.string().min(1, "City is required"),
  position: z.string().min(1, "Position is required"),
  count: z
    .union([z.string(), z.number()])
    .transform((val) => {
      const num = typeof val === "string" ? parseInt(val, 10) : val;
      return Math.min(Math.max(num || 10, 1), 20);
    })
    .optional()
    .default(10),
  fast: z.boolean().optional().default(false),
  super_fast: z.boolean().optional().default(false),
});

export const generateContentFromDescriptionSchema = z.object({
  description: z.string().min(1, "Description is required"),
  city: z.string().optional(),
});

