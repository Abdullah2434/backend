import cron from "node-cron";
import VideoScheduleService from "../services/videoSchedule.service";
import VideoSchedule from "../models/VideoSchedule";
import UserVideoSettings from "../models/UserVideoSettings";
import TimezoneService from "../utils/timezone";
import CronMonitoringService from "../services/cronMonitoring.service";
import { startSubscriptionSync } from "./syncSubscriptions";

const videoScheduleService = new VideoScheduleService();
const cronMonitor = CronMonitoringService.getInstance();

// Performance monitoring
let lastExecution: Date | null = null;
let executionCount = 0;
let isProcessing = false;

/**
 * Enhanced scheduled video processor with performance monitoring and error recovery
 */
export function startScheduledVideoProcessor() {
  // Initialize monitoring
  cronMonitor.startMonitoring("scheduled-video-processor");

  // Run every 5 minutes with improved error handling
  cron.schedule("*/5 * * * *", async () => {
    const startTime = Date.now();
    const currentUTC = TimezoneService.getCurrentUTC();

    // Prevent overlapping executions
    if (isProcessing) {
      console.warn(
        "⚠️ Previous cron execution still running, skipping this cycle"
      );
      return;
    }

    isProcessing = true;
    executionCount++;
    lastExecution = new Date();

    // Mark job as started
    cronMonitor.markJobStarted("scheduled-video-processor");

    console.log(
      `🔄 Processing scheduled videos (Execution #${executionCount})...`
    );
    console.log(`🌍 Current UTC time: ${currentUTC.toISOString()}`);
    console.log(
      `📊 Memory usage: ${Math.round(
        process.memoryUsage().heapUsed / 1024 / 1024
      )}MB`
    );
    console.log(`⏰ Cron job started at: ${new Date().toISOString()}`);
    console.log(
      `📋 Checking for videos scheduled within the next 30 minutes (processing 30 minutes early)...`
    );

    try {
      // Add timeout protection
      const timeout = setTimeout(() => {
        console.error("⏰ Cron job timeout after 10 minutes");
        isProcessing = false;
      }, 10 * 60 * 1000); // 10 minutes timeout

      // Get all pending videos that are due for processing
      console.log(`🔍 Step 1: Fetching pending videos from database...`);
      const schedules = await videoScheduleService.getPendingVideos();
      console.log(`📋 Found ${schedules.length} schedules with pending videos`);

      if (schedules.length > 0) {
        console.log(`📊 Schedule details:`);
        schedules.forEach((schedule, index) => {
          console.log(`  ${index + 1}. Schedule ID: ${schedule._id}`);
          console.log(`     User ID: ${schedule.userId}`);
          console.log(`     Timezone: ${schedule.timezone}`);
          console.log(
            `     Pending trends: ${
              schedule.generatedTrends.filter((t) => t.status === "pending")
                .length
            }`
          );
        });
      }

      if (schedules.length === 0) {
        console.log("✅ No pending videos to process");
        clearTimeout(timeout);
        isProcessing = false;
        return;
      }

      // Process schedules in batches to prevent blocking
      const batchSize = 3; // Process 3 schedules at a time
      const batches = [];

      for (let i = 0; i < schedules.length; i += batchSize) {
        batches.push(schedules.slice(i, i + batchSize));
      }

      console.log(
        `📦 Processing ${batches.length} batches of ${batchSize} schedules each`
      );

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length}`);

        // Process batch in parallel with error isolation
        console.log(
          `🔄 Step 2: Processing batch ${batchIndex + 1} with ${
            batch.length
          } schedules...`
        );
        const batchPromises = batch.map(async (schedule, scheduleIndex) => {
          try {
            console.log(
              `  📋 Processing schedule ${scheduleIndex + 1}/${batch.length}: ${
                schedule._id
              }`
            );
            return await processScheduleWithTimeout(schedule);
          } catch (error) {
            console.error(
              `❌ Error processing schedule ${schedule._id}:`,
              error
            );
            return {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.allSettled(batchPromises);

        const successful = batchResults.filter(
          (r) => r.status === "fulfilled" && r.value?.success
        ).length;
        const failed = batchResults.filter(
          (r) => r.status === "rejected" || !r.value?.success
        ).length;

        console.log(
          `📦 Batch ${
            batchIndex + 1
          } completed: ${successful} successful, ${failed} failed`
        );

        // Add small delay between batches to prevent overwhelming the system
        if (batchIndex < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Scheduled video processing completed in ${duration}ms`);
      console.log(
        `📊 Memory usage after processing: ${Math.round(
          process.memoryUsage().heapUsed / 1024 / 1024
        )}MB`
      );

      // Mark job as completed
      cronMonitor.markJobCompleted("scheduled-video-processor", duration, true);

      clearTimeout(timeout);
    } catch (error) {
      console.error("❌ Error in scheduled video processor:", error);

      // Mark job as failed
      cronMonitor.markJobFailed(
        "scheduled-video-processor",
        error instanceof Error ? error.message : "Unknown error"
      );

      // Retry mechanism for critical failures
      setTimeout(async () => {
        try {
          console.log("🔄 Retrying failed cron execution...");
          await retryFailedProcessing();
        } catch (retryError) {
          console.error("❌ Retry failed:", retryError);
        }
      }, 60000); // Retry after 1 minute
    } finally {
      isProcessing = false;
    }
  });

  console.log(
    "⏰ Enhanced scheduled video processor started - running every 5 minutes"
  );
}

/**
 * Process a single schedule with timeout protection
 */
async function processScheduleWithTimeout(
  schedule: any
): Promise<{ success: boolean; processed: number }> {
  return new Promise(async (resolve) => {
    const timeout = setTimeout(() => {
      console.error(`⏰ Timeout processing schedule ${schedule._id}`);
      resolve({ success: false, processed: 0 });
    }, 5 * 60 * 1000); // 5 minutes timeout per schedule

    try {
      console.log(
        `📅 Processing schedule for user ${schedule.userId} in timezone: ${schedule.timezone}`
      );
      console.log(`🔍 Step 3: Analyzing schedule trends...`);
      console.log(
        `  📊 Total trends in schedule: ${schedule.generatedTrends.length}`
      );
      console.log(`  ⏰ Current time: ${new Date().toISOString()}`);

      // Get user video settings
      const userSettings = await UserVideoSettings.findOne({
        userId: schedule.userId,
      });

      if (!userSettings) {
        console.error(
          `❌ User settings not found for schedule ${schedule._id}`
        );
        clearTimeout(timeout);
        resolve({ success: false, processed: 0 });
        return;
      }

      let processedCount = 0;

      // Process each pending trend in this schedule
      for (let i = 0; i < schedule.generatedTrends.length; i++) {
        const trend = schedule.generatedTrends[i];

        // Check if this trend is due for processing
        const now = new Date();
        const scheduledTime = new Date(trend.scheduledFor);
        const timeDiff = scheduledTime.getTime() - now.getTime();

        // Process if it's time (30 minutes before scheduled time) and still pending
        const minutesUntil = Math.round(timeDiff / (1000 * 60));
        console.log(`  📋 Trend ${i}: "${trend.description}"`);
        console.log(`     ⏰ Scheduled for: ${scheduledTime.toISOString()}`);
        console.log(`     📊 Status: ${trend.status}`);
        console.log(`     ⏱️ Minutes until: ${minutesUntil}`);
        console.log(
          `     ✅ Should process: ${
            timeDiff <= 30 * 60 * 1000 &&
            timeDiff >= -15 * 60 * 1000 &&
            trend.status === "pending"
          }`
        );

        if (
          timeDiff <= 30 * 60 * 1000 && // 30 minutes before scheduled time
          timeDiff >= -15 * 60 * 1000 && // 15 minutes after (grace period)
          trend.status === "pending"
        ) {
          console.log(
            `🎬 Step 4: Starting video processing for: "${trend.description}"`
          );
          console.log(`  📋 Schedule ID: ${schedule._id}`);
          console.log(`  📋 Trend Index: ${i}`);
          console.log(
            `  ⏰ Time until scheduled: ${minutesUntil} minutes (processing 30 minutes early)`
          );

          try {
            await videoScheduleService.processScheduledVideo(
              schedule._id.toString(),
              i,
              userSettings
            );
            processedCount++;
          } catch (error) {
            console.error(
              `❌ Error processing video ${i} for schedule ${schedule._id}:`,
              error
            );
          }
        }
      }

      clearTimeout(timeout);
      resolve({ success: true, processed: processedCount });
    } catch (error) {
      console.error(`❌ Error processing schedule ${schedule._id}:`, error);
      clearTimeout(timeout);
      resolve({ success: false, processed: 0 });
    }
  });
}

/**
 * Retry failed processing for critical schedules
 */
async function retryFailedProcessing(): Promise<void> {
  try {
    console.log("🔄 Retrying failed processing...");

    // Find schedules that might have failed
    const failedSchedules = await VideoSchedule.find({
      isActive: true,
      "generatedTrends.status": "processing",
      "generatedTrends.scheduledFor": {
        $lt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      },
    });

    if (failedSchedules.length > 0) {
      console.log(
        `🔄 Found ${failedSchedules.length} schedules that may have failed`
      );

      for (const schedule of failedSchedules) {
        // Reset failed trends to pending
        schedule.generatedTrends.forEach((trend: any) => {
          if (
            trend.status === "processing" &&
            new Date(trend.scheduledFor).getTime() < Date.now() - 30 * 60 * 1000
          ) {
            trend.status = "pending";
          }
        });

        await schedule.save();
        console.log(`🔄 Reset failed trends for schedule ${schedule._id}`);
      }
    }
  } catch (error) {
    console.error("❌ Error in retry processing:", error);
  }
}

/**
 * Clean up old completed schedules - DISABLED (keeping schedules for history)
 */
export function startScheduleCleanup() {
  // Schedule cleanup is disabled to keep all schedules for historical purposes
  console.log(
    "⏰ Schedule cleanup is disabled - keeping all schedules for history"
  );
}

/**
 * Enhanced trend generation with better error handling
 */
export function startTrendGeneration() {
  cron.schedule("0 1 * * *", async () => {
    const startTime = Date.now();
    console.log("📊 Generating trends for upcoming schedules...");

    try {
      // Find active schedules that need more trends
      const activeSchedules = await VideoSchedule.find({
        isActive: true,
        endDate: { $gt: new Date() },
      }).limit(10); // Limit to prevent overwhelming

      console.log(
        `📊 Found ${activeSchedules.length} active schedules to check`
      );

      let processedSchedules = 0;

      for (const schedule of activeSchedules) {
        try {
          const pendingTrends = schedule.generatedTrends.filter(
            (t: any) => t.status === "pending"
          );

          // If we have less than 3 pending trends, generate more
          if (pendingTrends.length < 3) {
            console.log(
              `📈 Generating additional trends for schedule ${schedule._id}`
            );

            const {
              generateRealEstateTrends,
            } = require("../services/trends.service");
            const newTrends = await generateRealEstateTrends();

            // Add new trends to the schedule
            const additionalTrends = newTrends
              .slice(0, 5)
              .map((trend: any) => ({
                ...trend,
                scheduledFor: new Date(
                  Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000
                ), // Random time in next week
                status: "pending",
              }));

            schedule.generatedTrends.push(...additionalTrends);
            await schedule.save();

            console.log(
              `✅ Added ${additionalTrends.length} new trends to schedule ${schedule._id}`
            );
            processedSchedules++;
          }
        } catch (error) {
          console.error(
            `❌ Error generating trends for schedule ${schedule._id}:`,
            error
          );
        }
      }

      const duration = Date.now() - startTime;
      console.log(
        `✅ Trend generation completed in ${duration}ms - processed ${processedSchedules} schedules`
      );
    } catch (error) {
      console.error("❌ Error in trend generation:", error);
    }
  });

  console.log("⏰ Enhanced trend generation started - running daily at 1 AM");
}

/**
 * Health check cron job - runs every 5 minutes
 */
export function startHealthCheck() {
  cron.schedule("*/5 * * * *", () => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    console.log(
      `🏥 Health Check - Memory: ${Math.round(
        memUsage.heapUsed / 1024 / 1024
      )}MB, CPU: ${cpuUsage.user + cpuUsage.system}ms`
    );

    if (lastExecution) {
      const timeSinceLastExecution = Date.now() - lastExecution.getTime();
      if (timeSinceLastExecution > 20 * 60 * 1000) {
        // 20 minutes
        console.warn("⚠️ No cron execution in the last 20 minutes");
      }
    }

    // Check if processing is stuck
    if (isProcessing) {
      console.warn("⚠️ Cron job appears to be stuck in processing state");
    }
  });

  console.log("⏰ Health check started - running every 5 minutes");
}

// Export all cron jobs
export function startAllCronJobs() {
  startScheduledVideoProcessor();
  startScheduleCleanup();
  startTrendGeneration();
  startHealthCheck();

  console.log("🚀 All enhanced cron jobs started successfully");
}
