import { z } from "zod";

/**
 * Validation schema for trend status
 */
export const trendStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
]);

/**
 * Validation schema for schedule status
 */
export const scheduleStatusSchema = z.enum(["processing", "ready", "failed"]);

/**
 * Validation schema for schedule frequency
 */
export const scheduleFrequencySchema = z.enum([
  "once_week",
  "twice_week",
  "three_week",
  "daily",
]);

/**
 * Valid trend statuses
 */
export const VALID_TREND_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

/**
 * Valid schedule statuses
 */
export const VALID_SCHEDULE_STATUSES = [
  "processing",
  "ready",
  "failed",
] as const;

/**
 * Time window constants for trend processing
 */
export const TREND_PROCESSING_WINDOW = {
  MINUTES_BEFORE: 30, // Process 30 minutes before scheduled time
  MINUTES_AFTER: 120, // Grace period: 2 hours (120 minutes) after scheduled time
} as const;

/**
 * Retry processing constants
 */
export const RETRY_PROCESSING = {
  STUCK_THRESHOLD_MS: 30 * 60 * 1000, // 30 minutes
} as const;

/**
 * Trend generation constants
 */
export const TREND_GENERATION = {
  MIN_PENDING_TRENDS: 3,
  MAX_TRENDS_TO_ADD: 5,
  MAX_SCHEDULES_TO_PROCESS: 10,
  RANDOM_WEEK_MS: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
} as const;

/**
 * Health check constants
 */
export const HEALTH_CHECK = {
  NO_EXECUTION_THRESHOLD_MS: 20 * 60 * 1000, // 20 minutes
} as const;

/**
 * Cron schedule constants
 */
export const CRON_SCHEDULES = {
  VIDEO_PROCESSOR: "*/5 * * * *", // Every 5 minutes
  TREND_GENERATION: "0 1 * * *", // Daily at 1:00 AM
  HEALTH_CHECK: "*/5 * * * *", // Every 5 minutes
} as const;

