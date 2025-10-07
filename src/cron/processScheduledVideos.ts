import cron from "node-cron";
import VideoScheduleService from "../services/videoSchedule.service";
import VideoSchedule from "../models/VideoSchedule";
import UserVideoSettings from "../models/UserVideoSettings";
import TimezoneService from "../utils/timezone";

const videoScheduleService = new VideoScheduleService();

/**
 * Process scheduled videos - runs every 15 minutes
 */
export function startScheduledVideoProcessor() {
  // Run every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    const currentUTC = TimezoneService.getCurrentUTC();
    console.log("🔄 Processing scheduled videos...");
    console.log("🌍 Current UTC time:", currentUTC.toISOString());

    try {
      // Get all pending videos that are due for processing
      const schedules = await videoScheduleService.getPendingVideos();

      console.log(`📋 Found ${schedules.length} schedules with pending videos`);

      for (const schedule of schedules) {
        try {
          console.log(
            `📅 Processing schedule for user ${schedule.userId} in timezone: ${schedule.timezone}`
          );

          // Get user video settings
          const userSettings = await UserVideoSettings.findOne({
            userId: schedule.userId,
          });

          if (!userSettings) {
            console.error(
              `❌ User settings not found for schedule ${schedule._id}`
            );
            continue;
          }

          // Process each pending trend in this schedule
          for (let i = 0; i < schedule.generatedTrends.length; i++) {
            const trend = schedule.generatedTrends[i];

            // Check if this trend is due for processing
            const now = new Date();
            const scheduledTime = new Date(trend.scheduledFor);
            const timeDiff = scheduledTime.getTime() - now.getTime();

            // Process if it's time (30 minutes before scheduled time) and still pending
            if (
              timeDiff <= 30 * 60 * 1000 && // 30 minutes before
              timeDiff >= -15 * 60 * 1000 && // 15 minutes after (grace period)
              trend.status === "pending"
            ) {
              console.log(
                `🎬 Processing scheduled video: ${trend.description} for schedule ${schedule._id}`
              );

              await videoScheduleService.processScheduledVideo(
                schedule._id.toString(),
                i,
                userSettings
              );
            }
          }
        } catch (error) {
          console.error(`❌ Error processing schedule ${schedule._id}:`, error);
          // Log error (no WebSocket notification)
          console.error(
            `❌ Schedule processing error for user ${schedule.userId}:`,
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      }

      console.log("✅ Scheduled video processing completed");
    } catch (error) {
      console.error("❌ Error in scheduled video processor:", error);
    }
  });

  console.log(
    "⏰ Scheduled video processor started - running every 15 minutes"
  );
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
 * Generate trends for upcoming schedules - runs daily at 1 AM
 */
export function startTrendGeneration() {
  cron.schedule("0 1 * * *", async () => {
    console.log("📊 Generating trends for upcoming schedules...");

    try {
      // Find active schedules that need more trends
      const activeSchedules = await VideoSchedule.find({
        isActive: true,
        endDate: { $gt: new Date() },
      });

      for (const schedule of activeSchedules) {
        const pendingTrends = schedule.generatedTrends.filter(
          (t: any) => t.status === "pending"
        );

        // If we have less than 3 pending trends, generate more
        if (pendingTrends.length < 3) {
          console.log(
            `📈 Generating additional trends for schedule ${schedule._id}`
          );

          try {
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
          } catch (error) {
            console.error(
              `❌ Error generating trends for schedule ${schedule._id}:`,
              error
            );
          }
        }
      }

      console.log("✅ Trend generation completed");
    } catch (error) {
      console.error("❌ Error in trend generation:", error);
    }
  });

  console.log("⏰ Trend generation started - running daily at 1 AM");
}

// Export all cron jobs
export function startAllCronJobs() {
  startScheduledVideoProcessor();
  startScheduleCleanup();
  startTrendGeneration();
}
