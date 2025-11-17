/**
 * Types for processScheduledVideos cron job
 */

import { IVideoSchedule } from "../../models/VideoSchedule";
import { IUserVideoSettings } from "../../models/UserVideoSettings";

export interface ProcessScheduleResult {
  success: boolean;
  processed: number;
  error?: string;
  scheduleId?: string;
}

export interface ProcessTrendResult {
  success: boolean;
  trendIndex: number;
  error?: string;
}

export interface ScheduledVideoProcessorSummary {
  totalSchedules: number;
  processedSchedules: number;
  totalTrendsProcessed: number;
  errors: string[];
}

export interface RetryFailedProcessingResult {
  retriedCount: number;
  errors: string[];
}

export interface TrendGenerationResult {
  processedSchedules: number;
  trendsAdded: number;
  errors: string[];
}

export interface HealthCheckData {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  timeSinceLastExecution?: number;
  isProcessing: boolean;
  executionCount: number;
}

export interface ProcessScheduledVideosConfig {
  maxRetries: number;
  retryInitialDelayMs: number;
  overallTimeoutMs: number;
  databaseTimeoutMs: number;
  batchSize: number;
  delayBetweenBatchesMs: number;
  apiTimeoutMs: number;
}

export interface TrendTimeWindow {
  minutesBefore: number; // 30 minutes before scheduled time
  minutesAfter: number; // 15 minutes after (grace period)
}

export interface GeneratedTrend {
  description: string;
  keypoints: string;
  scheduledFor: Date;
  status: "pending" | "processing" | "completed" | "failed";
  [key: string]: any;
}

export type ScheduleWithTrends = IVideoSchedule & {
  generatedTrends: GeneratedTrend[];
};

export type UserSettings = IUserVideoSettings;

