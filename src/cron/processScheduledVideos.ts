import cron from "node-cron";
import VideoScheduleService from "../services/videoSchedule.service";
import VideoSchedule, { IVideoSchedule } from "../models/VideoSchedule";
import UserVideoSettings, {
  IUserVideoSettings,
} from "../models/UserVideoSettings";
import TimezoneService from "../utils/timezone";
import CronMonitoringService from "../services/cronMonitoring.service";
import {
  executeWithOverallTimeout,
  withDatabaseTimeout,
  retryWithBackoff,
  processInBatches,
} from "../utils/cronHelpers";
import { getCronConfig } from "../config/cron.config";
import {
  VALID_TREND_STATUSES,
  VALID_SCHEDULE_STATUSES,
  TREND_PROCESSING_WINDOW,
  RETRY_PROCESSING,
  TREND_GENERATION,
  HEALTH_CHECK,
  CRON_SCHEDULES,
} from "../validations/processScheduledVideos.validations";
import {
  ProcessScheduleResult,
  ProcessTrendResult,
  ScheduledVideoProcessorSummary,
  RetryFailedProcessingResult,
  TrendGenerationResult,
  HealthCheckData,
  ProcessScheduledVideosConfig,
  TrendTimeWindow,
  GeneratedTrend,
  ScheduleWithTrends,
  UserSettings,
} from "../types/cron/processScheduledVideos.types";

// ==================== CONSTANTS ====================
const CRON_JOB_NAME = "scheduled-video-processor";
const TREND_GENERATION_JOB_NAME = "trend-generation";

// ==================== SERVICE INSTANCES ====================
const videoScheduleService = new VideoScheduleService();
const cronMonitor = CronMonitoringService.getInstance();

// ==================== PERFORMANCE MONITORING ====================
let lastExecution: Date | null = null;
let executionCount = 0;
let isProcessing = false;

// ==================== HELPER FUNCTIONS ====================
/**
 * Check if a trend is due for processing based on time window
 */
function isTrendDueForProcessing(
  scheduledTime: Date,
  timeWindow: TrendTimeWindow
): boolean {
  const now = new Date();
  const timeDiff = scheduledTime.getTime() - now.getTime();
  const minutesBefore = timeWindow.minutesBefore * 60 * 1000;
  const minutesAfter = timeWindow.minutesAfter * 60 * 1000;

  return (
    timeDiff <= minutesBefore && // Within processing window before
    timeDiff >= -minutesAfter && // Within grace period after
    true
  );
}

/**
 * Validate trend status
 */
function isValidTrendStatus(status: string): boolean {
  return VALID_TREND_STATUSES.includes(status as any);
}

/**
 * Validate schedule status
 */
function isValidScheduleStatus(status: string): boolean {
  return VALID_SCHEDULE_STATUSES.includes(status as any);
}

/**
 * Check if processing is already in progress
 */
function checkProcessingLock(): boolean {
  if (isProcessing) {
    console.warn(
      "⚠️ Scheduled video processor is already running, skipping this execution"
    );
    return true;
  }
  return false;
}

/**
 * Set processing lock
 */
function setProcessingLock(value: boolean): void {
  isProcessing = value;
}

/**
 * Update execution tracking
 */
function updateExecutionTracking(): void {
  executionCount++;
  lastExecution = new Date();
}

/**
 * Process a single trend within a schedule
 */
async function processTrend(
  schedule: ScheduleWithTrends,
  trendIndex: number,
  userSettings: UserSettings,
  config: ProcessScheduledVideosConfig
): Promise<ProcessTrendResult> {
  const trend = schedule.generatedTrends[trendIndex];

  if (!trend) {
    return {
      success: false,
      trendIndex,
      error: "Trend not found",
    };
  }

  // Validate trend status
  if (!isValidTrendStatus(trend.status)) {
    return {
      success: false,
      trendIndex,
      error: `Invalid trend status: ${trend.status}`,
    };
  }

  // Check if trend is due for processing
  const timeWindow: TrendTimeWindow = {
    minutesBefore: TREND_PROCESSING_WINDOW.MINUTES_BEFORE,
    minutesAfter: TREND_PROCESSING_WINDOW.MINUTES_AFTER,
  };

  if (!isTrendDueForProcessing(new Date(trend.scheduledFor), timeWindow)) {
    return {
      success: false,
      trendIndex,
      error: "Trend is not due for processing yet",
    };
  }

  // Only process if status is pending
  if (trend.status !== "pending") {
    return {
      success: false,
      trendIndex,
      error: `Trend status is ${trend.status}, expected pending`,
    };
  }

  try {
    // Use retry with backoff for processing
    await retryWithBackoff(
      () =>
        videoScheduleService.processScheduledVideo(
          schedule._id.toString(),
          trendIndex,
          userSettings
        ),
      config.maxRetries,
      config.retryInitialDelayMs
    );

    return {
      success: true,
      trendIndex,
    };
  } catch (error: any) {
    console.error(
      `❌ Error processing trend ${trendIndex} in schedule ${schedule._id}:`,
      error?.message || error
    );
    return {
      success: false,
      trendIndex,
      error: error?.message || "Unknown error",
    };
  }
}

/**
 * Process a single schedule with timeout protection
 */
async function processScheduleWithTimeout(
  schedule: ScheduleWithTrends,
  config: ProcessScheduledVideosConfig
): Promise<ProcessScheduleResult> {
  try {
    // Get user video settings with database timeout
    const userSettings = await withDatabaseTimeout(
      UserVideoSettings.findOne({
        userId: schedule.userId,
      }),
      config.databaseTimeoutMs
    );

    if (!userSettings) {
      console.warn(
        `⚠️ User settings not found for schedule ${schedule._id}`
      );
      return {
        success: false,
        processed: 0,
        scheduleId: schedule._id.toString(),
        error: "User settings not found",
      };
    }

    let processedCount = 0;
    const errors: string[] = [];

    // Process each pending trend in this schedule
    for (let i = 0; i < schedule.generatedTrends.length; i++) {
      const result = await processTrend(
        schedule,
        i,
        userSettings as UserSettings,
        config
      );

      if (result.success) {
        processedCount++;
      } else if (result.error) {
        errors.push(`Trend ${i}: ${result.error}`);
      }
    }

    return {
      success: processedCount > 0,
      processed: processedCount,
      scheduleId: schedule._id.toString(),
      error: errors.length > 0 ? errors.join("; ") : undefined,
    };
  } catch (error: any) {
    console.error(
      `❌ Error processing schedule ${schedule._id}:`,
      error?.message || error
    );
    return {
      success: false,
      processed: 0,
      scheduleId: schedule._id.toString(),
      error: error?.message || "Unknown error",
    };
  }
}

/**
 * Retry failed processing for critical schedules
 */
async function retryFailedProcessing(): Promise<RetryFailedProcessingResult> {
  const config = getCronConfig(CRON_JOB_NAME);
  const errors: string[] = [];
  let retriedCount = 0;

  try {
    // Find failed schedules with database timeout
    const failedSchedules = await withDatabaseTimeout(
      VideoSchedule.find({
        isActive: true,
        "generatedTrends.status": "processing",
        "generatedTrends.scheduledFor": {
          $lt: new Date(Date.now() - RETRY_PROCESSING.STUCK_THRESHOLD_MS),
        },
      }),
      config.databaseTimeoutMs
    );

    if (failedSchedules.length === 0) {
      return { retriedCount: 0, errors: [] };
    }

    console.log(`🔄 Retrying ${failedSchedules.length} failed schedule(s)`);

    for (const schedule of failedSchedules) {
      try {
        // Reset failed trends to pending
        let resetCount = 0;
        schedule.generatedTrends.forEach((trend: GeneratedTrend) => {
          if (
            trend.status === "processing" &&
            new Date(trend.scheduledFor).getTime() <
              Date.now() - RETRY_PROCESSING.STUCK_THRESHOLD_MS
          ) {
            trend.status = "pending";
            resetCount++;
          }
        });

        if (resetCount > 0) {
          await withDatabaseTimeout(schedule.save(), config.databaseTimeoutMs);
          retriedCount++;
        }
      } catch (error: any) {
        const errorMsg = `Error retrying schedule ${schedule._id}: ${error?.message || "Unknown error"}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    return { retriedCount, errors };
  } catch (error: any) {
    const errorMsg = `Error in retry processing: ${error?.message || "Unknown error"}`;
    console.error(`❌ ${errorMsg}`);
    errors.push(errorMsg);
    return { retriedCount, errors };
  }
}

// ==================== MAIN FUNCTIONS ====================
/**
 * Enhanced scheduled video processor with performance monitoring and error recovery
 */
export function startScheduledVideoProcessor() {
  // Initialize monitoring
  cronMonitor.startMonitoring(CRON_JOB_NAME);
  const config = getCronConfig(CRON_JOB_NAME);

  // Run every 5 minutes with improved error handling
  cron.schedule(CRON_SCHEDULES.VIDEO_PROCESSOR, async () => {
    const startTime = Date.now();
    const currentUTC = TimezoneService.getCurrentUTC();

    // Prevent overlapping executions
    if (checkProcessingLock()) {
      return;
    }

    setProcessingLock(true);
    updateExecutionTracking();

    // Mark job as started
    cronMonitor.markJobStarted(CRON_JOB_NAME);

    try {
      // Execute with overall timeout protection
      await executeWithOverallTimeout(
        CRON_JOB_NAME,
        (async () => {
          // Get pending videos with database timeout
          const schedules = await withDatabaseTimeout(
            videoScheduleService.getPendingVideos(),
            config.databaseTimeoutMs
          );

          if (schedules.length === 0) {
            console.log("ℹ️ No pending schedules to process");
            return;
          }

          console.log(`📋 Found ${schedules.length} schedule(s) to process`);

          // Process schedules in batches using helper function
          const results = await processInBatches(
            schedules as ScheduleWithTrends[],
            config.batchSize!,
            async (schedule: ScheduleWithTrends) => {
              try {
                return await processScheduleWithTimeout(schedule, {
                  maxRetries: config.maxRetries,
                  retryInitialDelayMs: config.retryInitialDelayMs,
                  overallTimeoutMs: config.overallTimeoutMs,
                  databaseTimeoutMs: config.databaseTimeoutMs,
                  batchSize: config.batchSize!,
                  delayBetweenBatchesMs: config.delayBetweenBatchesMs!,
                  apiTimeoutMs: config.apiTimeoutMs,
                });
              } catch (error: any) {
                console.error(
                  `❌ Error processing schedule ${schedule._id}:`,
                  error?.message || error
                );
                return {
                  success: false,
                  processed: 0,
                  scheduleId: schedule._id.toString(),
                  error: error?.message || "Unknown error",
                };
              }
            },
            config.delayBetweenBatchesMs
          );

          // Calculate summary
          const processedSchedules = results.filter((r) => r.success).length;
          const totalTrendsProcessed = results.reduce(
            (sum, r) => sum + r.processed,
            0
          );
          const errors = results
            .filter((r) => r.error)
            .map((r) => r.error!)
            .filter((e) => e);

          if (processedSchedules > 0) {
            console.log(
              `✅ Processed ${processedSchedules}/${schedules.length} schedule(s), ${totalTrendsProcessed} trend(s)`
            );
          }
          if (errors.length > 0) {
            console.warn(`⚠️ Encountered ${errors.length} error(s)`);
          }
        })(),
        config.overallTimeoutMs
      );

      const duration = Date.now() - startTime;
      console.log(
        `✅ Scheduled video processor completed in ${duration}ms`
      );

      // Mark job as completed
      cronMonitor.markJobCompleted(CRON_JOB_NAME, duration, true);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error?.message || "Unknown error";
      console.error(
        `❌ Scheduled video processor failed after ${duration}ms:`,
        errorMessage
      );

      // Mark job as failed
      cronMonitor.markJobFailed(CRON_JOB_NAME, errorMessage);

      // Retry mechanism for critical failures with exponential backoff
      setTimeout(async () => {
        try {
          await retryWithBackoff(
            () => retryFailedProcessing(),
            config.maxRetries,
            config.retryInitialDelayMs
          );
        } catch (retryError: any) {
          console.error(
            "❌ Retry failed:",
            retryError?.message || retryError
          );
        }
      }, config.retryInitialDelayMs);
    } finally {
      setProcessingLock(false);
    }
  });

  console.log(
    `⏰ Scheduled video processor cron job started - running every 5 minutes (schedule: ${CRON_SCHEDULES.VIDEO_PROCESSOR})`
  );
}

/**
 * Clean up old completed schedules - DISABLED (keeping schedules for history)
 */
export function startScheduleCleanup() {
  // Schedule cleanup is disabled to keep all schedules for historical purposes
  console.log("ℹ️ Schedule cleanup is disabled (keeping schedules for history)");
}

/**
 * Enhanced trend generation with better error handling
 */
export function startTrendGeneration() {
  cronMonitor.startMonitoring(TREND_GENERATION_JOB_NAME);
  const config = getCronConfig("generate-topic-data"); // Use similar config

  cron.schedule(CRON_SCHEDULES.TREND_GENERATION, async () => {
    const startTime = Date.now();
    cronMonitor.markJobStarted(TREND_GENERATION_JOB_NAME);

    try {
      await executeWithOverallTimeout(
        TREND_GENERATION_JOB_NAME,
        (async () => {
          // Find active schedules that need more trends with database timeout
          const activeSchedules = await withDatabaseTimeout(
            VideoSchedule.find({
              isActive: true,
              endDate: { $gt: new Date() },
            }).limit(TREND_GENERATION.MAX_SCHEDULES_TO_PROCESS),
            config.databaseTimeoutMs
          );

          let processedSchedules = 0;
          let totalTrendsAdded = 0;
          const errors: string[] = [];

          for (const schedule of activeSchedules) {
            try {
              const pendingTrends = schedule.generatedTrends.filter(
                (t: GeneratedTrend) => t.status === "pending"
              );

              // If we have less than minimum pending trends, generate more
              if (pendingTrends.length < TREND_GENERATION.MIN_PENDING_TRENDS) {
                const {
                  generateRealEstateTrends,
                } = require("../services/trends.service");

                // Use retry with backoff for trend generation
                const newTrends: GeneratedTrend[] = await retryWithBackoff(
                  () => generateRealEstateTrends(),
                  config.maxRetries,
                  config.retryInitialDelayMs
                );

                // Add new trends to the schedule
                const additionalTrends = newTrends
                  .slice(0, TREND_GENERATION.MAX_TRENDS_TO_ADD)
                  .map((trend: GeneratedTrend) => ({
                    ...trend,
                    scheduledFor: new Date(
                      Date.now() + Math.random() * TREND_GENERATION.RANDOM_WEEK_MS
                    ), // Random time in next week
                    status: "pending" as const,
                  }));

                schedule.generatedTrends.push(...additionalTrends);
                await withDatabaseTimeout(
                  schedule.save(),
                  config.databaseTimeoutMs
                );
                processedSchedules++;
                totalTrendsAdded += additionalTrends.length;
              }
            } catch (error: any) {
              const errorMsg = `Error generating trends for schedule ${schedule._id}: ${error?.message || "Unknown error"}`;
              console.error(`❌ ${errorMsg}`);
              errors.push(errorMsg);
            }
          }

          const duration = Date.now() - startTime;
          console.log(
            `✅ Trend generation completed in ${duration}ms, processed ${processedSchedules} schedule(s), added ${totalTrendsAdded} trend(s)`
          );
          cronMonitor.markJobCompleted(TREND_GENERATION_JOB_NAME, duration, true);
        })(),
        config.overallTimeoutMs
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error?.message || "Unknown error";
      console.error(
        `❌ Error in trend generation after ${duration}ms:`,
        errorMessage
      );
      cronMonitor.markJobFailed(TREND_GENERATION_JOB_NAME, errorMessage);
    }
  });

  console.log(
    `⏰ Trend generation cron job started - running daily at 1:00 AM (schedule: ${CRON_SCHEDULES.TREND_GENERATION})`
  );
}

/**
 * Health check cron job - runs every 5 minutes
 */
export function startHealthCheck() {
  cron.schedule(CRON_SCHEDULES.HEALTH_CHECK, () => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const healthData: HealthCheckData = {
      memoryUsage: memUsage,
      cpuUsage: cpuUsage,
      isProcessing,
      executionCount,
    };

    if (lastExecution) {
      const timeSinceLastExecution =
        Date.now() - lastExecution.getTime();
      healthData.timeSinceLastExecution = timeSinceLastExecution;

      if (timeSinceLastExecution > HEALTH_CHECK.NO_EXECUTION_THRESHOLD_MS) {
        console.warn(
          `⚠️ No cron execution in the last ${Math.round(timeSinceLastExecution / 60000)} minutes`
        );
      }
    }

    // Check if processing is stuck
    if (isProcessing) {
      console.warn("⚠️ Cron job appears to be stuck in processing state");
    }

    // Log memory usage if high
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    if (memUsageMB > 500) {
      console.warn(
        `⚠️ High memory usage: ${Math.round(memUsageMB)} MB`
      );
    }
  });

  console.log(
    `⏰ Health check cron job started - running every 5 minutes (schedule: ${CRON_SCHEDULES.HEALTH_CHECK})`
  );
}

// Export all cron jobs
export function startAllCronJobs() {
  startScheduledVideoProcessor();
  startScheduleCleanup();
  startTrendGeneration();
  startHealthCheck();
  console.log("✅ All cron jobs started");
}
