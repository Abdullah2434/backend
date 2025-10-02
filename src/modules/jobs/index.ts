import { cronManager } from "./managers/cron.manager";
import { queueManager } from "./managers/queue.manager";
import { syncAvatarsAndVoices } from "./cron/avatar-sync.job";
import { checkAvatarStatus } from "./cron/avatar-status-check.job";
import { processPhotoAvatar } from "./workers/photo-avatar.worker";
import { logger } from "../../core/utils/logger";
import { PhotoAvatarJobData } from "./types/job.types";

/**
 * Initialize all background jobs and cron tasks
 */
export function initializeJobs(): void {
  logger.info("Initializing background jobs and cron tasks...");

  // Initialize queues and workers
  initializeQueues();

  // Initialize cron jobs
  initializeCronJobs();

  logger.info("Background jobs and cron tasks initialized successfully");
}

/**
 * Initialize queue-based jobs
 */
function initializeQueues(): void {
  // Create photo avatar queue
  const photoAvatarQueue = queueManager.createQueue("photo-avatar");

  // Create photo avatar worker
  queueManager.createWorker<PhotoAvatarJobData>(
    "photo-avatar",
    processPhotoAvatar,
    {
      concurrency: 1, // Process one at a time
      limiter: {
        max: 5, // Max 5 jobs
        duration: 60000, // per minute
      },
    }
  );

  logger.info("Queue-based jobs initialized");
}

/**
 * Initialize cron-based jobs
 */
function initializeCronJobs(): void {
  // Avatar and voice sync - every Tuesday at 2:55 PM
  cronManager.registerJob(
    {
      name: "avatar-voice-sync",
      schedule: "55 14 * * 2",
      enabled: true,
      timeout: 300000, // 5 minutes
    },
    syncAvatarsAndVoices
  );

  // Avatar status check - every 5 minutes
  cronManager.registerJob(
    {
      name: "avatar-status-check",
      schedule: "*/5 * * * *",
      enabled: true,
      timeout: 120000, // 2 minutes
    },
    checkAvatarStatus
  );

  logger.info("Cron-based jobs initialized");
}

/**
 * Shutdown all jobs gracefully
 */
export async function shutdownJobs(): Promise<void> {
  logger.info("Shutting down background jobs...");

  // Stop all cron jobs
  cronManager.stopAll();

  // Close all queues and workers
  await queueManager.close();

  logger.info("Background jobs shutdown complete");
}

// Export managers for external use
export { cronManager } from "./managers/cron.manager";
export { queueManager } from "./managers/queue.manager";

// Export types
export * from "./types/job.types";
