import cron from "node-cron";
import WorkflowHistory from "../models/WorkflowHistory";
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
    // Calculate cutoff time: 40 minutes ago (UTC)
    const cutoffTime = new Date(Date.now() - 40 * 60 * 1000);

    console.log(
      `🔍 Checking for stale workflow histories older than ${cutoffTime.toISOString()}`
    );

    // Find and update stale pending workflows with database timeout
    const updateResult = await withDatabaseTimeout(
      WorkflowHistory.updateMany(
        {
          status: "pending",
          createdAt: { $lt: cutoffTime },
        },
        {
          $set: {
            status: "failed",
            failedAt: new Date(),
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
      cronMonitor.markJobFailed(CRON_JOB_NAME, error?.message || "Unknown error");
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

