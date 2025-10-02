import { CronSchedulerService } from "./cron-scheduler.service";
import {
  createAvatarStatusCheckJob,
  createFetchDefaultAvatarsJob,
  createFetchDefaultVoicesJob,
} from "../jobs/avatar-cron.jobs";
import {
  createGenerateTopicDataJob,
  createCleanupTopicDataJob,
} from "../jobs/topic-cron.jobs";
import {
  CronJobRegistration,
  CronJobCategory,
  CronSchedulerConfig,
  CronHealthStatus,
  CronSchedulerStatus,
  CronMetrics,
  CronLogEntry,
} from "../types/cron.types";
import {
  createCronJobMetadata,
  createNotificationConfig,
} from "../utils/cron.utils";

export class CronService {
  private scheduler: CronSchedulerService;
  private isInitialized: boolean = false;

  constructor(config?: Partial<CronSchedulerConfig>) {
    this.scheduler = new CronSchedulerService(config);
  }

  public initialize(): void {
    if (this.isInitialized) {
      console.log("Cron service is already initialized");
      return;
    }

    this.registerAllJobs();
    this.scheduler.start();
    this.isInitialized = true;

    console.log("✅ Cron service initialized successfully");
  }

  public stop(): void {
    if (!this.isInitialized) {
      console.log("Cron service is not initialized");
      return;
    }

    this.scheduler.stop();
    this.isInitialized = false;

    console.log("Cron service stopped");
  }

  private registerAllJobs(): void {
    // ==================== AVATAR JOBS ====================

    // Avatar status check job
    this.registerJob({
      job: createAvatarStatusCheckJob(),
      metadata: createCronJobMetadata(CronJobCategory.AVATAR, "high", [
        "avatar",
        "status",
        "monitoring",
      ]),
      notificationConfig: createNotificationConfig(
        true,
        true, // onFailure
        false, // onSuccess
        true, // onRetry
        ["log"]
      ),
    });

    // Fetch default avatars job
    this.registerJob({
      job: createFetchDefaultAvatarsJob(),
      metadata: createCronJobMetadata(CronJobCategory.AVATAR, "medium", [
        "avatar",
        "sync",
        "weekly",
      ]),
      notificationConfig: createNotificationConfig(
        true,
        true, // onFailure
        true, // onSuccess
        true, // onRetry
        ["log"]
      ),
    });

    // Fetch default voices job
    this.registerJob({
      job: createFetchDefaultVoicesJob(),
      metadata: createCronJobMetadata(CronJobCategory.VOICE, "medium", [
        "voice",
        "sync",
        "weekly",
      ]),
      notificationConfig: createNotificationConfig(
        true,
        true, // onFailure
        true, // onSuccess
        true, // onRetry
        ["log"]
      ),
    });

    // ==================== TOPIC JOBS ====================

    // Generate topic data job (disabled by default)
    this.registerJob({
      job: createGenerateTopicDataJob(),
      metadata: createCronJobMetadata(CronJobCategory.TOPIC, "low", [
        "topic",
        "generation",
        "weekly",
      ]),
      notificationConfig: createNotificationConfig(
        true,
        true, // onFailure
        false, // onSuccess
        true, // onRetry
        ["log"]
      ),
    });

    // Cleanup topic data job
    this.registerJob({
      job: createCleanupTopicDataJob(),
      metadata: createCronJobMetadata(CronJobCategory.CLEANUP, "medium", [
        "cleanup",
        "maintenance",
        "weekly",
      ]),
      notificationConfig: createNotificationConfig(
        true,
        true, // onFailure
        false, // onSuccess
        true, // onRetry
        ["log"]
      ),
    });

    console.log("All cron jobs registered successfully");
  }

  private registerJob(registration: CronJobRegistration): void {
    this.scheduler.registerJob(registration);
  }

  // ==================== PUBLIC METHODS ====================

  public async executeJob(jobName: string) {
    return await this.scheduler.executeJob(jobName);
  }

  public getStatus(): CronSchedulerStatus {
    return this.scheduler.getStatus();
  }

  public getMetrics(jobName?: string): CronMetrics | Map<string, CronMetrics> {
    return this.scheduler.getMetrics(jobName);
  }

  public getLogs(limit?: number): CronLogEntry[] {
    return this.scheduler.getLogs(limit);
  }

  public healthCheck(): CronHealthStatus {
    return this.scheduler.healthCheck();
  }

  public getJobs() {
    return this.scheduler.getJobs();
  }

  // ==================== CONVENIENCE METHODS ====================

  public async executeAvatarStatusCheck() {
    return await this.executeJob("avatar-status-check");
  }

  public async executeFetchDefaultAvatars() {
    return await this.executeJob("fetch-default-avatars");
  }

  public async executeFetchDefaultVoices() {
    return await this.executeJob("fetch-default-voices");
  }

  public async executeGenerateTopicData() {
    return await this.executeJob("generate-topic-data");
  }

  public async executeCleanupTopicData() {
    return await this.executeJob("cleanup-topic-data");
  }

  // ==================== JOB MANAGEMENT ====================

  public enableJob(jobName: string): void {
    const jobs = this.scheduler.getJobs();
    const job = jobs[jobName];

    if (job) {
      job.config.enabled = true;
      console.log(`Job '${jobName}' enabled`);
    } else {
      console.warn(`Job '${jobName}' not found`);
    }
  }

  public disableJob(jobName: string): void {
    const jobs = this.scheduler.getJobs();
    const job = jobs[jobName];

    if (job) {
      job.config.enabled = false;
      console.log(`Job '${jobName}' disabled`);
    } else {
      console.warn(`Job '${jobName}' not found`);
    }
  }

  public isJobEnabled(jobName: string): boolean {
    const jobs = this.scheduler.getJobs();
    const job = jobs[jobName];
    return job ? job.config.enabled : false;
  }

  public getJobSchedule(jobName: string): string | null {
    const jobs = this.scheduler.getJobs();
    const job = jobs[jobName];
    return job ? job.config.schedule : null;
  }

  // ==================== UTILITY METHODS ====================

  public getJobSummary(): string {
    const status = this.getStatus();
    const metrics = this.getMetrics() as Map<string, CronMetrics>;

    let summary = `📊 **Cron Service Summary**\n`;
    summary += `Status: ${status.isRunning ? "🟢 Running" : "🔴 Stopped"}\n`;
    summary += `Total Jobs: ${status.totalJobs}\n`;
    summary += `Active Jobs: ${status.activeJobs}\n`;
    summary += `Completed: ${status.completedJobs}\n`;
    summary += `Failed: ${status.failedJobs}\n`;
    summary += `Uptime: ${this.formatUptime(status.uptime)}\n\n`;

    summary += `**Job Details:**\n`;
    for (const [jobName, jobMetrics] of metrics) {
      const successRate = (
        (jobMetrics.successfulExecutions / jobMetrics.totalExecutions) *
        100
      ).toFixed(1);
      const status = jobMetrics.consecutiveFailures > 3 ? "❌" : "✅";
      summary += `${status} ${jobName}: ${successRate}% success rate\n`;
    }

    return summary;
  }

  private formatUptime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

export default CronService;
