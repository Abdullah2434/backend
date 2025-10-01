import { QueueConfigService } from "./queue-config.service";
import { PhotoAvatarQueueService } from "./photo-avatar-queue.service";
import { PhotoAvatarWorkerService } from "../workers/photo-avatar-worker.service";
import {
  QueueRegistry,
  QueueHealthStatus,
  QueueStats,
  QueueMetrics,
  QueueLogEntry,
  PhotoAvatarJobData,
  PhotoAvatarJobResult,
  JobPriority,
} from "../types/queue.types";
import {
  createHealthReport,
  formatDuration,
  calculateSuccessRate,
  getQueueStatus,
} from "../utils/queue.utils";

export class QueueService {
  private static instance: QueueService;
  private configService: QueueConfigService;
  private queues: QueueRegistry = {};
  private workers: Map<string, any> = new Map();
  private isInitialized: boolean = false;
  private startTime: Date;

  // Specific queue services
  private photoAvatarQueue!: PhotoAvatarQueueService;
  private photoAvatarWorker!: PhotoAvatarWorkerService;

  private constructor() {
    this.configService = QueueConfigService.getInstance();
    this.startTime = new Date();
  }

  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log("Queue service is already initialized");
      return;
    }

    try {
      // Initialize photo avatar queue and worker
      await this.initializePhotoAvatarQueue();

      // Start all workers
      await this.startAllWorkers();

      this.isInitialized = true;
      console.log("✅ Queue service initialized successfully");
    } catch (error: any) {
      console.error("Failed to initialize queue service:", error.message);
      throw error;
    }
  }

  private async initializePhotoAvatarQueue(): Promise<void> {
    try {
      // Initialize photo avatar queue
      this.photoAvatarQueue = new PhotoAvatarQueueService();
      await this.photoAvatarQueue.waitUntilReady();

      // Initialize photo avatar worker
      this.photoAvatarWorker = new PhotoAvatarWorkerService();
      await this.photoAvatarWorker.start();

      // Register in registry
      this.queues["photo-avatar"] = {
        queue: this.photoAvatarQueue.getQueue(),
        config: this.configService.getQueueConfig("photo-avatar")!,
        workers: [this.photoAvatarWorker.getWorkerInfo()],
        metrics: this.photoAvatarQueue.getMetrics(),
      };

      this.workers.set("photo-avatar-worker", this.photoAvatarWorker);

      console.log("✅ Photo Avatar Queue and Worker initialized");
    } catch (error: any) {
      console.error("Failed to initialize photo avatar queue:", error.message);
      throw error;
    }
  }

  private async startAllWorkers(): Promise<void> {
    try {
      for (const [workerName, worker] of this.workers) {
        if (worker.start && typeof worker.start === "function") {
          await worker.start();
          console.log(`✅ Worker started: ${workerName}`);
        }
      }
    } catch (error: any) {
      console.error("Failed to start workers:", error.message);
      throw error;
    }
  }

  // ==================== PHOTO AVATAR QUEUE METHODS ====================

  public async addPhotoAvatarJob(
    jobData: PhotoAvatarJobData,
    priority: JobPriority = JobPriority.NORMAL
  ): Promise<string> {
    if (!this.photoAvatarQueue) {
      throw new Error("Photo avatar queue not initialized");
    }

    const options = { priority };
    return await this.photoAvatarQueue.addPhotoAvatarJob(jobData, options);
  }

  public async addHighPriorityPhotoAvatarJob(
    jobData: PhotoAvatarJobData
  ): Promise<string> {
    if (!this.photoAvatarQueue) {
      throw new Error("Photo avatar queue not initialized");
    }

    return await this.photoAvatarQueue.addHighPriorityPhotoAvatarJob(jobData);
  }

  public async addBulkPhotoAvatarJobs(
    jobsData: PhotoAvatarJobData[],
    priority: JobPriority = JobPriority.NORMAL
  ): Promise<string[]> {
    if (!this.photoAvatarQueue) {
      throw new Error("Photo avatar queue not initialized");
    }

    const options = { priority };
    return await this.photoAvatarQueue.addBulkPhotoAvatarJobs(
      jobsData,
      options
    );
  }

  public async getPhotoAvatarJob(jobId: string) {
    if (!this.photoAvatarQueue) {
      throw new Error("Photo avatar queue not initialized");
    }

    return await this.photoAvatarQueue.getJob(jobId);
  }

  public async getPhotoAvatarJobState(jobId: string): Promise<string | null> {
    if (!this.photoAvatarQueue) {
      throw new Error("Photo avatar queue not initialized");
    }

    return await this.photoAvatarQueue.getJobState(jobId);
  }

  public async getPhotoAvatarJobProgress(
    jobId: string
  ): Promise<number | null> {
    if (!this.photoAvatarQueue) {
      throw new Error("Photo avatar queue not initialized");
    }

    return await this.photoAvatarQueue.getJobProgress(jobId);
  }

  public async getPhotoAvatarJobResult(
    jobId: string
  ): Promise<PhotoAvatarJobResult | null> {
    if (!this.photoAvatarQueue) {
      throw new Error("Photo avatar queue not initialized");
    }

    return await this.photoAvatarQueue.getJobResult(jobId);
  }

  // ==================== QUEUE MANAGEMENT ====================

  public async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues[queueName];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    if (queueName === "photo-avatar") {
      await this.photoAvatarQueue.pauseQueue();
    }
  }

  public async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues[queueName];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    if (queueName === "photo-avatar") {
      await this.photoAvatarQueue.resumeQueue();
    }
  }

  public async cleanQueue(
    queueName: string,
    grace: number = 5000,
    status:
      | "completed"
      | "failed"
      | "active"
      | "waiting"
      | "delayed" = "completed"
  ): Promise<number> {
    const queue = this.queues[queueName];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    if (queueName === "photo-avatar") {
      return await this.photoAvatarQueue.cleanQueue(grace, status);
    }

    return 0;
  }

  public async emptyQueue(queueName: string): Promise<void> {
    const queue = this.queues[queueName];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    if (queueName === "photo-avatar") {
      await this.photoAvatarQueue.emptyQueue();
    }
  }

  // ==================== WORKER MANAGEMENT ====================

  public async pauseWorker(workerName: string): Promise<void> {
    const worker = this.workers.get(workerName);
    if (!worker) {
      throw new Error(`Worker ${workerName} not found`);
    }

    if (worker.pause && typeof worker.pause === "function") {
      await worker.pause();
    }
  }

  public async resumeWorker(workerName: string): Promise<void> {
    const worker = this.workers.get(workerName);
    if (!worker) {
      throw new Error(`Worker ${workerName} not found`);
    }

    if (worker.resume && typeof worker.resume === "function") {
      await worker.resume();
    }
  }

  public async stopWorker(workerName: string): Promise<void> {
    const worker = this.workers.get(workerName);
    if (!worker) {
      throw new Error(`Worker ${workerName} not found`);
    }

    if (worker.stop && typeof worker.stop === "function") {
      await worker.stop();
    }
  }

  // ==================== STATISTICS AND MONITORING ====================

  public async getQueueStats(
    queueName?: string
  ): Promise<QueueStats | Map<string, QueueStats>> {
    if (queueName) {
      const queue = this.queues[queueName];
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }

      if (queueName === "photo-avatar") {
        return await this.photoAvatarQueue.getQueueStats();
      }

      throw new Error(`Queue ${queueName} not implemented`);
    }

    // Return stats for all queues
    const allStats = new Map<string, QueueStats>();

    for (const [name, queue] of Object.entries(this.queues)) {
      if (name === "photo-avatar") {
        allStats.set(name, await this.photoAvatarQueue.getQueueStats());
      }
    }

    return allStats;
  }

  public getQueueMetrics(
    queueName?: string
  ): QueueMetrics | Map<string, QueueMetrics> {
    if (queueName) {
      const queue = this.queues[queueName];
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }

      return queue.metrics;
    }

    // Return metrics for all queues
    const allMetrics = new Map<string, QueueMetrics>();

    for (const [name, queue] of Object.entries(this.queues)) {
      allMetrics.set(name, queue.metrics);
    }

    return allMetrics;
  }

  public getWorkerInfo(workerName?: string): any {
    if (workerName) {
      const worker = this.workers.get(workerName);
      if (!worker) {
        throw new Error(`Worker ${workerName} not found`);
      }

      if (workerName === "photo-avatar-worker") {
        return this.photoAvatarWorker.getWorkerInfo();
      }

      return worker;
    }

    // Return info for all workers
    const allWorkers: any = {};

    for (const [name, worker] of this.workers) {
      if (name === "photo-avatar-worker") {
        allWorkers[name] = this.photoAvatarWorker.getWorkerInfo();
      } else {
        allWorkers[name] = worker;
      }
    }

    return allWorkers;
  }

  // ==================== HEALTH CHECK ====================

  public async healthCheck(): Promise<QueueHealthStatus> {
    try {
      const queueStats = new Map<string, QueueStats>();
      const queueMetrics = new Map<string, QueueMetrics>();
      const workers: any[] = [];

      // Get stats and metrics for all queues
      for (const [name, queue] of Object.entries(this.queues)) {
        if (name === "photo-avatar") {
          const stats = await this.photoAvatarQueue.getQueueStats();
          const metrics = this.photoAvatarQueue.getMetrics();
          queueStats.set(name, stats);
          queueMetrics.set(name, metrics);
        }
      }

      // Get worker info
      for (const [name, worker] of this.workers) {
        if (name === "photo-avatar-worker") {
          workers.push(this.photoAvatarWorker.getWorkerInfo());
        } else {
          workers.push(worker);
        }
      }

      // Determine overall health
      const healthReport = createHealthReport(queueMetrics);
      let overallStatus: "healthy" | "unhealthy" | "degraded" = "healthy";

      if (healthReport.overallHealth === "unhealthy") {
        overallStatus = "unhealthy";
      } else if (healthReport.overallHealth === "degraded") {
        overallStatus = "degraded";
      }

      return {
        status: overallStatus,
        connection: true, // If we can get stats, connection is working
        stats: queueStats.get("photo-avatar") || {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: false,
        },
        workers,
        uptime: Date.now() - this.startTime.getTime(),
        lastActivity: new Date(),
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
        workers: [],
        uptime: Date.now() - this.startTime.getTime(),
      };
    }
  }

  // ==================== UTILITY METHODS ====================

  public getQueueNames(): string[] {
    return Object.keys(this.queues);
  }

  public getWorkerNames(): string[] {
    return Array.from(this.workers.keys());
  }

  public getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  public getQueueSummary(): string {
    const queueNames = this.getQueueNames();
    const workerNames = this.getWorkerNames();
    const uptime = formatDuration(this.getUptime());

    let summary = `📊 **Queue Service Summary**\n`;
    summary += `Status: ${this.isInitialized ? "🟢 Running" : "🔴 Stopped"}\n`;
    summary += `Queues: ${queueNames.length} (${queueNames.join(", ")})\n`;
    summary += `Workers: ${workerNames.length} (${workerNames.join(", ")})\n`;
    summary += `Uptime: ${uptime}\n\n`;

    // Add queue-specific metrics
    for (const [name, queue] of Object.entries(this.queues)) {
      const metrics = queue.metrics;
      const successRate = calculateSuccessRate(metrics);
      const status = getQueueStatus(metrics);
      const statusEmoji =
        status === "healthy" ? "✅" : status === "unhealthy" ? "❌" : "⚠️";

      summary += `${statusEmoji} **${name}**: ${
        metrics.totalJobs
      } jobs, ${successRate.toFixed(1)}% success rate\n`;
    }

    return summary;
  }

  public async stop(): Promise<void> {
    if (!this.isInitialized) {
      console.log("Queue service is not initialized");
      return;
    }

    try {
      // Stop all workers
      for (const [workerName, worker] of this.workers) {
        if (worker.stop && typeof worker.stop === "function") {
          await worker.stop();
          console.log(`🛑 Worker stopped: ${workerName}`);
        }
      }

      // Close all queues
      for (const [queueName, queue] of Object.entries(this.queues)) {
        if (queueName === "photo-avatar") {
          await this.photoAvatarQueue.close();
        }
        console.log(`🔒 Queue closed: ${queueName}`);
      }

      this.isInitialized = false;
      console.log("Queue service stopped");
    } catch (error: any) {
      console.error("Failed to stop queue service:", error.message);
      throw error;
    }
  }
}

export default QueueService;
