import { Queue } from "bullmq";
import { QueueConfigService } from "./queue-config.service";
import {
  PhotoAvatarJobData,
  PhotoAvatarJobResult,
  JobOptions,
  QueueStats,
  QueueMetrics,
  QueueError,
  JobPriority,
} from "../types/queue.types";

export class PhotoAvatarQueueService {
  private queue!: Queue;
  private configService: QueueConfigService;
  private metrics: QueueMetrics;
  private startTime: Date;

  constructor() {
    this.configService = QueueConfigService.getInstance();
    this.startTime = new Date();

    // Initialize metrics
    this.metrics = {
      queueName: "photo-avatar",
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      averageProcessingTime: 0,
      consecutiveFailures: 0,
    };

    this.initializeQueue();
  }

  private initializeQueue(): void {
    const config = this.configService.getQueueConfig("photo-avatar");
    if (!config) {
      throw new QueueError("photo-avatar", "Queue configuration not found");
    }

    this.queue = new Queue("photo-avatar", {
      connection: config.connection,
      defaultJobOptions: config.defaultJobOptions,
    });

    this.setupEventHandlers();
    console.log("✅ Photo Avatar Queue initialized");
  }

  private setupEventHandlers(): void {
    // Note: BullMQ event handlers are set up differently
    // These will be handled by the worker service instead
    console.log("📊 Photo Avatar Queue event handlers configured");
  }

  private updateMetrics(success: boolean, processingTime?: number): void {
    this.metrics.totalJobs++;

    if (success) {
      this.metrics.successfulJobs++;
      this.metrics.consecutiveFailures = 0;
      this.metrics.lastJobProcessed = new Date();

      if (processingTime) {
        const totalTime =
          this.metrics.averageProcessingTime * (this.metrics.totalJobs - 1) +
          processingTime;
        this.metrics.averageProcessingTime = totalTime / this.metrics.totalJobs;
      }
    } else {
      this.metrics.failedJobs++;
      this.metrics.consecutiveFailures++;
      this.metrics.lastJobFailed = new Date();
    }
  }

  // ==================== JOB MANAGEMENT ====================

  public async addPhotoAvatarJob(
    jobData: PhotoAvatarJobData,
    options?: Partial<JobOptions>
  ): Promise<string> {
    try {
      const jobOptions = this.configService.createJobOptions(
        "photo-avatar",
        options
      );

      const job = await this.queue.add(
        "process-photo-avatar",
        jobData,
        jobOptions
      );

      console.log(
        `📸 Photo avatar job added: ${job.id} for user ${jobData.userId}`
      );
      return job.id || "";
    } catch (error: any) {
      console.error("Failed to add photo avatar job:", error.message);
      throw new QueueError(
        "photo-avatar",
        `Failed to add job: ${error.message}`
      );
    }
  }

  public async addHighPriorityPhotoAvatarJob(
    jobData: PhotoAvatarJobData,
    options?: Partial<JobOptions>
  ): Promise<string> {
    const highPriorityOptions = {
      ...options,
      priority: JobPriority.HIGH,
    };

    return this.addPhotoAvatarJob(jobData, highPriorityOptions);
  }

  public async addBulkPhotoAvatarJobs(
    jobsData: PhotoAvatarJobData[],
    options?: Partial<JobOptions>
  ): Promise<string[]> {
    try {
      const jobOptions = this.configService.createJobOptions(
        "photo-avatar",
        options
      );

      const jobs = await Promise.all(
        jobsData.map((jobData) =>
          this.queue.add("process-photo-avatar", jobData, jobOptions)
        )
      );

      const jobIds = jobs.map((job) => job.id || "");
      console.log(`📸 Bulk photo avatar jobs added: ${jobIds.length} jobs`);

      return jobIds;
    } catch (error: any) {
      console.error("Failed to add bulk photo avatar jobs:", error.message);
      throw new QueueError(
        "photo-avatar",
        `Failed to add bulk jobs: ${error.message}`
      );
    }
  }

  // ==================== JOB QUERYING ====================

  public async getJob(jobId: string) {
    try {
      return await this.queue.getJob(jobId);
    } catch (error: any) {
      console.error(`Failed to get job ${jobId}:`, error.message);
      return null;
    }
  }

  public async getJobState(jobId: string): Promise<string | null> {
    try {
      const job = await this.getJob(jobId);
      return job ? await job.getState() : null;
    } catch (error: any) {
      console.error(`Failed to get job state ${jobId}:`, error.message);
      return null;
    }
  }

  public async getJobProgress(jobId: string): Promise<number | null> {
    try {
      const job = await this.getJob(jobId);
      return job ? (typeof job.progress === "number" ? job.progress : 0) : null;
    } catch (error: any) {
      console.error(`Failed to get job progress ${jobId}:`, error.message);
      return null;
    }
  }

  public async getJobResult(
    jobId: string
  ): Promise<PhotoAvatarJobResult | null> {
    try {
      const job = await this.getJob(jobId);
      return job ? job.returnvalue : null;
    } catch (error: any) {
      console.error(`Failed to get job result ${jobId}:`, error.message);
      return null;
    }
  }

  // ==================== JOB CONTROL ====================

  public async pauseJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.getJob(jobId);
      if (job) {
        await job.updateProgress(0);
        console.log(`⏸️ Photo avatar job paused: ${jobId}`);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error(`Failed to pause job ${jobId}:`, error.message);
      return false;
    }
  }

  public async resumeJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.getJob(jobId);
      if (job) {
        await job.updateProgress(50);
        console.log(`▶️ Photo avatar job resumed: ${jobId}`);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error(`Failed to resume job ${jobId}:`, error.message);
      return false;
    }
  }

  public async removeJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.getJob(jobId);
      if (job) {
        await job.remove();
        console.log(`🗑️ Photo avatar job removed: ${jobId}`);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error(`Failed to remove job ${jobId}:`, error.message);
      return false;
    }
  }

  public async retryJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.getJob(jobId);
      if (job) {
        await job.retry();
        console.log(`🔄 Photo avatar job retried: ${jobId}`);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error(`Failed to retry job ${jobId}:`, error.message);
      return false;
    }
  }

  // ==================== QUEUE MANAGEMENT ====================

  public async pauseQueue(): Promise<void> {
    try {
      await this.queue.pause();
      console.log("⏸️ Photo avatar queue paused");
    } catch (error: any) {
      console.error("Failed to pause queue:", error.message);
      throw new QueueError(
        "photo-avatar",
        `Failed to pause queue: ${error.message}`
      );
    }
  }

  public async resumeQueue(): Promise<void> {
    try {
      await this.queue.resume();
      console.log("▶️ Photo avatar queue resumed");
    } catch (error: any) {
      console.error("Failed to resume queue:", error.message);
      throw new QueueError(
        "photo-avatar",
        `Failed to resume queue: ${error.message}`
      );
    }
  }

  public async cleanQueue(
    grace: number = 5000,
    status:
      | "completed"
      | "failed"
      | "active"
      | "waiting"
      | "delayed" = "completed"
  ): Promise<number> {
    try {
      const cleaned = await this.queue.clean(grace, 100, status);
      console.log(
        `🧹 Photo avatar queue cleaned: ${cleaned.length} ${status} jobs removed`
      );
      return cleaned.length;
    } catch (error: any) {
      console.error("Failed to clean queue:", error.message);
      throw new QueueError(
        "photo-avatar",
        `Failed to clean queue: ${error.message}`
      );
    }
  }

  public async emptyQueue(): Promise<void> {
    try {
      await this.queue.obliterate({ force: true });
      console.log("🗑️ Photo avatar queue emptied");
    } catch (error: any) {
      console.error("Failed to empty queue:", error.message);
      throw new QueueError(
        "photo-avatar",
        `Failed to empty queue: ${error.message}`
      );
    }
  }

  // ==================== STATISTICS ====================

  public async getQueueStats(): Promise<QueueStats> {
    try {
      const waiting = await this.queue.getWaiting();
      const active = await this.queue.getActive();
      const completed = await this.queue.getCompleted();
      const failed = await this.queue.getFailed();
      const delayed = await this.queue.getDelayed();

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused: await this.queue.isPaused(),
      };
    } catch (error: any) {
      console.error("Failed to get queue stats:", error.message);
      throw new QueueError(
        "photo-avatar",
        `Failed to get stats: ${error.message}`
      );
    }
  }

  public getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  public getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  // ==================== HEALTH CHECK ====================

  public async healthCheck(): Promise<{
    status: "healthy" | "unhealthy" | "degraded";
    connection: boolean;
    stats: QueueStats;
    metrics: QueueMetrics;
    uptime: number;
  }> {
    try {
      const stats = await this.getQueueStats();
      const metrics = this.getMetrics();
      const uptime = this.getUptime();

      // Determine health status
      let status: "healthy" | "unhealthy" | "degraded" = "healthy";

      if (metrics.consecutiveFailures > 5) {
        status = "unhealthy";
      } else if (metrics.consecutiveFailures > 2 || stats.failed > 10) {
        status = "degraded";
      }

      return {
        status,
        connection: true, // If we can get stats, connection is working
        stats,
        metrics,
        uptime,
      };
    } catch (error: any) {
      console.error("Queue health check failed:", error.message);
      return {
        status: "unhealthy",
        connection: false,
        stats: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: false,
        },
        metrics: this.metrics,
        uptime: this.getUptime(),
      };
    }
  }

  // ==================== UTILITY METHODS ====================

  public getQueue(): Queue {
    return this.queue;
  }

  public async close(): Promise<void> {
    try {
      await this.queue.close();
      console.log("🔒 Photo avatar queue closed");
    } catch (error: any) {
      console.error("Failed to close queue:", error.message);
    }
  }

  public async waitUntilReady(): Promise<void> {
    try {
      await this.queue.waitUntilReady();
      console.log("✅ Photo avatar queue ready");
    } catch (error: any) {
      console.error("Failed to wait for queue ready:", error.message);
      throw new QueueError("photo-avatar", `Queue not ready: ${error.message}`);
    }
  }
}

export default PhotoAvatarQueueService;
