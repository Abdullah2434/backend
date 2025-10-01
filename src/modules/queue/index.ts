// ==================== QUEUE MODULE EXPORTS ====================

// Main service
export {
  QueueService,
  default as QueueServiceDefault,
} from "./services/queue.service";

// Configuration service
export { QueueConfigService } from "./services/queue-config.service";

// Queue services
export { PhotoAvatarQueueService } from "./services/photo-avatar-queue.service";

// Worker services
export { PhotoAvatarWorkerService } from "./workers/photo-avatar-worker.service";

// Types
export * from "./types/queue.types";

// Utilities
export * from "./utils/queue.utils";

// ==================== QUEUE MODULE CONFIGURATION ====================

export const queueModuleConfig = {
  name: "Queue Module",
  version: "1.0.0",
  description:
    "Modular queue system with Redis/BullMQ integration for background job processing",
  services: [
    "QueueConfigService",
    "QueueService",
    "PhotoAvatarQueueService",
    "PhotoAvatarWorkerService",
  ],
  features: [
    "Redis-based job queues",
    "Background job processing",
    "Job retry with exponential backoff",
    "Queue monitoring and metrics",
    "Worker health checks",
    "Job priority management",
    "Bulk job operations",
    "Queue cleanup and maintenance",
    "Real-time progress tracking",
    "Comprehensive error handling",
    "WebSocket notifications",
    "Performance analytics",
  ],
  queues: ["photo-avatar"],
  workers: ["photo-avatar-worker"],
  dependencies: ["bullmq", "redis", "axios", "mongoose"],
};

// ==================== CONVENIENCE EXPORTS ====================

// Create a singleton instance for easy importing
import { QueueService } from "./services/queue.service";

const queueService = QueueService.getInstance();

// Export commonly used functions for backward compatibility
export const initializeQueueService = () => queueService.initialize();
export const stopQueueService = () => queueService.stop();

// Photo Avatar Queue convenience functions
export const addPhotoAvatarJob = (jobData: any, priority?: any) =>
  queueService.addPhotoAvatarJob(jobData, priority);
export const addHighPriorityPhotoAvatarJob = (jobData: any) =>
  queueService.addHighPriorityPhotoAvatarJob(jobData);
export const addBulkPhotoAvatarJobs = (jobsData: any[], priority?: any) =>
  queueService.addBulkPhotoAvatarJobs(jobsData, priority);
export const getPhotoAvatarJob = (jobId: string) =>
  queueService.getPhotoAvatarJob(jobId);
export const getPhotoAvatarJobState = (jobId: string) =>
  queueService.getPhotoAvatarJobState(jobId);
export const getPhotoAvatarJobProgress = (jobId: string) =>
  queueService.getPhotoAvatarJobProgress(jobId);
export const getPhotoAvatarJobResult = (jobId: string) =>
  queueService.getPhotoAvatarJobResult(jobId);

// Queue management functions
export const pauseQueue = (queueName: string) =>
  queueService.pauseQueue(queueName);
export const resumeQueue = (queueName: string) =>
  queueService.resumeQueue(queueName);
export const cleanQueue = (queueName: string, grace?: number, status?: any) =>
  queueService.cleanQueue(queueName, grace, status);
export const emptyQueue = (queueName: string) =>
  queueService.emptyQueue(queueName);

// Worker management functions
export const pauseWorker = (workerName: string) =>
  queueService.pauseWorker(workerName);
export const resumeWorker = (workerName: string) =>
  queueService.resumeWorker(workerName);
export const stopWorker = (workerName: string) =>
  queueService.stopWorker(workerName);

// Monitoring functions
export const getQueueStats = (queueName?: string) =>
  queueService.getQueueStats(queueName);
export const getQueueMetrics = (queueName?: string) =>
  queueService.getQueueMetrics(queueName);
export const getWorkerInfo = (workerName?: string) =>
  queueService.getWorkerInfo(workerName);
export const healthCheck = () => queueService.healthCheck();
export const getQueueSummary = () => queueService.getQueueSummary();

// Export the singleton instance
export { queueService };
