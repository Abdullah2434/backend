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
  
      return;
    }

    isProcessing = true;
    executionCount++;
    lastExecution = new Date();

    // Mark job as started
    cronMonitor.markJobStarted("scheduled-video-processor");
    try {
      // Add timeout protection
      const timeout = setTimeout(() => {
        isProcessing = false;
      }, 10 * 60 * 1000); // 10 minutes timeout

  
      const schedules = await videoScheduleService.getPendingVideos();
  

      if (schedules.length > 0) {
        schedules.forEach((schedule, index) => {
      
        });
      }

      if (schedules.length === 0) {
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

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
 
  
        const batchPromises = batch.map(async (schedule, scheduleIndex) => {
          try {
        
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

  

        // Add small delay between batches to prevent overwhelming the system
        if (batchIndex < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
        }
      }

      const duration = Date.now() - startTime;
  
      // Mark job as completed
      cronMonitor.markJobCompleted("scheduled-video-processor", duration, true);

      clearTimeout(timeout);
    } catch (error) {
   
      // Mark job as failed
      cronMonitor.markJobFailed(
        "scheduled-video-processor",
        error instanceof Error ? error.message : "Unknown error"
      );

      // Retry mechanism for critical failures
      setTimeout(async () => {
        try {
          await retryFailedProcessing();
        } catch (retryError) {
          console.error("❌ Retry failed:", retryError);
        }
      }, 60000); // Retry after 1 minute
    } finally {
      isProcessing = false;
    }
  });
}

/**
 * Process a single schedule with timeout protection
 */
async function processScheduleWithTimeout(
  schedule: any
): Promise<{ success: boolean; processed: number }> {
  return new Promise(async (resolve) => {
    const timeout = setTimeout(() => {
      resolve({ success: false, processed: 0 });
    }, 5 * 60 * 1000); // 5 minutes timeout per schedule

    try {
  

      // Get user video settings
      const userSettings = await UserVideoSettings.findOne({
        userId: schedule.userId,
      });

      if (!userSettings) {
    
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
  

        if (
          timeDiff <= 30 * 60 * 1000 && // 30 minutes before scheduled time
          timeDiff >= -15 * 60 * 1000 && // 15 minutes after (grace period)
          trend.status === "pending"
        ) {
       
          try {
            await videoScheduleService.processScheduledVideo(
              schedule._id.toString(),
              i,
              userSettings
            );
            processedCount++;
          } catch (error) {
          
          }
        }
      }

      clearTimeout(timeout);
      resolve({ success: true, processed: processedCount });
    } catch (error) {
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

    const failedSchedules = await VideoSchedule.find({
      isActive: true,
      "generatedTrends.status": "processing",
      "generatedTrends.scheduledFor": {
        $lt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      },
    });

    if (failedSchedules.length > 0) {
   
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
 
}

/**
 * Enhanced trend generation with better error handling
 */
export function startTrendGeneration() {
  cron.schedule("0 1 * * *", async () => {
    const startTime = Date.now();

    try {
      // Find active schedules that need more trends
      const activeSchedules = await VideoSchedule.find({
        isActive: true,
        endDate: { $gt: new Date() },
      }).limit(10); // Limit to prevent overwhelming
      let processedSchedules = 0;

      for (const schedule of activeSchedules) {
        try {
          const pendingTrends = schedule.generatedTrends.filter(
            (t: any) => t.status === "pending"
          );

          // If we have less than 3 pending trends, generate more
          if (pendingTrends.length < 3) {
          
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

    } catch (error) {
      console.error("❌ Error in trend generation:", error);
    }
  });
}

/**
 * Health check cron job - runs every 5 minutes
 */
export function startHealthCheck() {
  cron.schedule("*/5 * * * *", () => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();


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
}

// Export all cron jobs
export function startAllCronJobs() {
  startScheduledVideoProcessor();
  startScheduleCleanup();
  startTrendGeneration();
  startHealthCheck();

}
