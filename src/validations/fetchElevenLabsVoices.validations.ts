import { z } from "zod";

/**
 * Validation schema for cron job configuration
 */
export const cronConfigSchema = z.object({
  maxRetries: z.number().int().min(0).max(10),
  retryInitialDelayMs: z.number().int().min(0),
  overallTimeoutMs: z.number().int().min(1000),
});

/**
 * Validation schema for environment variables
 */
export const envConfigSchema = z.object({
  ELEVENLABS_API_KEY: z.string().min(1, "ELEVENLABS_API_KEY is required"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required").optional(),
});

/**
 * Valid cron schedule patterns
 */
export const VALID_CRON_SCHEDULES = {
  TWICE_DAILY: "3 11,23 * * *", // 11:03 AM and 11:03 PM
} as const;

