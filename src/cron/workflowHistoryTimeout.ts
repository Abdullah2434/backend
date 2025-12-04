// Load environment variables first
import dotenv from "dotenv";
dotenv.config();

import cron from "node-cron";
import WorkflowHistory from "../models/WorkflowHistory";
import { connectMongo } from "../config/mongoose";
import CronMonitoringService from "../services/cronMonitoring.service";
import {
  executeWithOverallTimeout,
  withDatabaseTimeout,
} from "../utils/cronHelpers";
import { getCronConfig } from "../config/cron.config";
import {
  CRON_JOB_NAME,
  CRON_SCHEDULE,
} from "../constants/workflowHistoryTimeoutCron.constants";

// ==================== SERVICE INSTANCE ====================
const cronMonitor = CronMonitoringService.getInstance();

// ==================== MAIN FUNCTION ====================
/**
 * Mark stale pending workflow histories as failed
 * Finds all records where status is "pending" and createdAt is more than 40 minutes old
 */
export async function markStaleWorkflowsAsFailed(): Promise<{
  updated: number;
}> {
  const config = getCronConfig(CRON_JOB_NAME);

  try {
    // Connect to MongoDB
    await connectMongo();

    // Get current UTC time
    const currentUtcTime = new Date();
    const currentTimeMs = currentUtcTime.getTime();

    // Threshold: 40 minutes in milliseconds
    const thresholdMs = 40 * 60 * 1000; // 40 minutes = 2,400,000 ms

    // Calculate cutoff time: currentTime - 40 minutes
    // Logic: If createdAt < cutoffTime, then (currentTime - createdAt) > 40 minutes
    const cutoffTime = new Date(currentTimeMs - thresholdMs);

    // Find stale pending workflows first to log details
    // Query: status="pending" AND createdAt < cutoffTime
    // This means: (currentTime - createdAt) > 40 minutes
    const staleWorkflows = await withDatabaseTimeout(
      WorkflowHistory.find({
        status: "pending",
        createdAt: { $lt: cutoffTime }, // createdAt < (currentTime - 40min) means age > 40min
      })
        .select("executionId createdAt status")
        .lean(),
      config.databaseTimeoutMs
    );

    if (staleWorkflows.length > 0) {
     
      staleWorkflows.forEach((workflow: any) => {
        const createdAtMs = new Date(workflow.createdAt).getTime();
        const ageMs = currentTimeMs - createdAtMs; // currentTime - createdAt
        const ageMinutes = Math.floor(ageMs / (60 * 1000));
        const ageSeconds = Math.floor((ageMs % (60 * 1000)) / 1000);
        const exceedsThreshold = ageMs > thresholdMs;

    
      });
    }

    // Update stale pending workflows with database timeout
    // Query: status="pending" AND createdAt < cutoffTime
    // This means: (currentTime - createdAt) > 40 minutes
    const errorMessage = "Video processing timeout - exceeded 40 minutes";
    const updateResult = await withDatabaseTimeout(
      WorkflowHistory.updateMany(
        {
          status: "pending",
          createdAt: { $lt: cutoffTime }, // createdAt < (currentTime - 40min) means (currentTime - createdAt) > 40min
        },
        {
          $set: {
            status: "failed",
            completedAt: currentUtcTime,
            errorMessage: errorMessage,
          },
        }
      ),
      config.databaseTimeoutMs
    );

    const updatedCount = updateResult.modifiedCount || 0;

    if (updatedCount > 0) {
      console.log(
        `✅ Marked ${updatedCount} stale workflow history record(s) as failed`
      );
    } else {
      console.log("ℹ️ No stale workflow histories found");
    }

    return {
      updated: updatedCount,
    };
  } catch (error: any) {
    console.error(
      "❌ Error marking stale workflows as failed:",
      error?.message || error
    );
    throw error;
  }
}

/**
 * Start cron job to mark stale workflow histories as failed
 * Runs every 7 minutes
 */
export function startWorkflowHistoryTimeoutCron() {
  // Initialize monitoring
  cronMonitor.startMonitoring(CRON_JOB_NAME);
  const config = getCronConfig(CRON_JOB_NAME);

  // Run every 7 minutes
  cron.schedule(CRON_SCHEDULE, async () => {
    const startTime = Date.now();
    cronMonitor.markJobStarted(CRON_JOB_NAME);

    try {
      await executeWithOverallTimeout(
        CRON_JOB_NAME,
        markStaleWorkflowsAsFailed(),
        config.overallTimeoutMs
      );

      const duration = Date.now() - startTime;
      console.log(
        `✅ Workflow history timeout cron job completed in ${duration}ms`
      );
      cronMonitor.markJobCompleted(CRON_JOB_NAME, duration, true);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(
        `❌ Workflow history timeout cron job failed after ${duration}ms:`,
        error?.message || "Unknown error"
      );
      cronMonitor.markJobFailed(
        CRON_JOB_NAME,
        error?.message || "Unknown error"
      );
    }
  });

  console.log(
    `⏰ Workflow history timeout cron job started - running every 7 minutes (schedule: ${CRON_SCHEDULE})`
  );
}

// For manual run/testing
if (require.main === module) {
  markStaleWorkflowsAsFailed()
    .then((result) => {
      console.log("✅ Manual workflow history timeout check completed", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Manual workflow history timeout check failed:", error);
      process.exit(1);
    });
}
