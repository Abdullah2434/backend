// ==================== CRON MODULE EXPORTS ====================

// Main service
export {
  CronService,
  default as CronServiceDefault,
} from "./services/cron.service";

// Scheduler service
export { CronSchedulerService } from "./services/cron-scheduler.service";

// Job creators
export {
  createAvatarStatusCheckJob,
  createFetchDefaultAvatarsJob,
  createFetchDefaultVoicesJob,
} from "./jobs/avatar-cron.jobs";

export {
  createGenerateTopicDataJob,
  createCleanupTopicDataJob,
} from "./jobs/topic-cron.jobs";

// Types
export * from "./types/cron.types";

// Utilities
export * from "./utils/cron.utils";

// ==================== CRON MODULE CONFIGURATION ====================

export const cronModuleConfig = {
  name: "Cron Module",
  version: "1.0.0",
  description:
    "Modular cron job scheduler with monitoring, retry logic, and health checks",
  services: ["CronSchedulerService", "CronService"],
  features: [
    "Job scheduling with cron expressions",
    "Automatic retry with exponential backoff",
    "Health monitoring and metrics",
    "Comprehensive logging",
    "Job dependency management",
    "Notification system",
    "Performance metrics",
    "Graceful error handling",
    "Timezone support",
    "Job enable/disable functionality",
  ],
  jobs: [
    "avatar-status-check",
    "fetch-default-avatars",
    "fetch-default-voices",
    "generate-topic-data",
    "cleanup-topic-data",
  ],
  dependencies: ["node-cron", "axios", "mongoose"],
};

// ==================== CONVENIENCE EXPORTS ====================

// Create a singleton instance for easy importing
import { CronService } from "./services/cron.service";

const cronService = new CronService();

// Export commonly used functions for backward compatibility
export const initializeCronService = () => cronService.initialize();
export const stopCronService = () => cronService.stop();
export const executeAvatarStatusCheck = () =>
  cronService.executeAvatarStatusCheck();
export const executeFetchDefaultAvatars = () =>
  cronService.executeFetchDefaultAvatars();
export const executeFetchDefaultVoices = () =>
  cronService.executeFetchDefaultVoices();
export const executeGenerateTopicData = () =>
  cronService.executeGenerateTopicData();
export const executeCleanupTopicData = () =>
  cronService.executeCleanupTopicData();

// Export the singleton instance
export { cronService };
