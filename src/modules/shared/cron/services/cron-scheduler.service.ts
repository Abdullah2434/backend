import * as cron from "node-cron";
import {
  CronJob,
  CronJobConfig,
  CronJobResult,
  CronSchedulerConfig,
  CronSchedulerStatus,
  CronLogEntry,
  CronMetrics,
  CronHealthStatus,
  CronJobError,
  CronSchedulerError,
  CronJobRegistry,
  CronJobRegistration,
  CronExecutionContext,
  CronExecutionResult,
} from "../types/cron.types";

export class CronSchedulerService {
  private config: CronSchedulerConfig;
  private jobs: CronJobRegistry = {};
  private jobRegistrations: Map<string, CronJobRegistration> = new Map();
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private metrics: Map<string, CronMetrics> = new Map();
  private logs: CronLogEntry[] = [];
  private startTime: Date;
  private isRunning: boolean = false;

  constructor(config?: Partial<CronSchedulerConfig>) {
    this.config = {
      timezone: "UTC",
      maxConcurrentJobs: 5,
      defaultTimeout: 300000, // 5 minutes
      defaultRetries: 3,
      defaultRetryDelay: 60000, // 1 minute
      enableLogging: true,
      enableMetrics: true,
      ...config,
    };
    this.startTime = new Date();
  }

  public registerJob(registration: CronJobRegistration): void {
    const { job, metadata, notificationConfig } = registration;
    const jobName = job.config.name;

    if (this.jobs[jobName]) {
      throw new CronSchedulerError(
        this.constructor.name,
        `Job '${jobName}' is already registered`
      );
    }

    this.jobs[jobName] = job;
    this.jobRegistrations.set(jobName, registration);

    // Initialize metrics
    if (this.config.enableMetrics) {
      this.metrics.set(jobName, {
        jobName,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageDuration: 0,
        consecutiveFailures: 0,
      });
    }

    this.log("info", `Job '${jobName}' registered successfully`, {
      jobName,
      metadata,
    });
  }

  public start(): void {
    if (this.isRunning) {
      this.log("warn", "Scheduler is already running");
      return;
    }

    this.isRunning = true;
    this.startTime = new Date();

    // Schedule all registered jobs
    for (const [jobName, job] of Object.entries(this.jobs)) {
      this.scheduleJob(jobName, job);
    }

    this.log("info", "Cron scheduler started", {
      totalJobs: Object.keys(this.jobs).length,
      timezone: this.config.timezone,
    });
  }

  public stop(): void {
    if (!this.isRunning) {
      this.log("warn", "Scheduler is not running");
      return;
    }

    // Stop all scheduled tasks
    for (const [jobName, task] of this.scheduledTasks) {
      task.stop();
      this.log("info", `Stopped job '${jobName}'`);
    }

    this.scheduledTasks.clear();
    this.isRunning = false;

    this.log("info", "Cron scheduler stopped");
  }

  public async executeJob(jobName: string): Promise<CronExecutionResult> {
    const job = this.jobs[jobName];
    if (!job) {
      throw new CronSchedulerError(
        this.constructor.name,
        `Job '${jobName}' not found`
      );
    }

    const registration = this.jobRegistrations.get(jobName);
    if (!registration) {
      throw new CronSchedulerError(
        this.constructor.name,
        `Job registration for '${jobName}' not found`
      );
    }

    const context: CronExecutionContext = {
      jobName,
      startTime: new Date(),
      attempt: 1,
      maxRetries: job.config.retries || this.config.defaultRetries || 0,
      timeout: job.config.timeout || this.config.defaultTimeout || 300000,
      metadata: {},
    };

    const result = await this.executeJobWithRetry(job, context, registration);
    const metrics = this.metrics.get(jobName);

    return {
      context,
      result,
      metrics: metrics || this.createEmptyMetrics(jobName),
    };
  }

  private async executeJobWithRetry(
    job: CronJob,
    context: CronExecutionContext,
    registration: CronJobRegistration
  ): Promise<CronJobResult> {
    const { jobName, maxRetries, timeout } = context;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        context.attempt = attempt;
        const result = await this.executeJobWithTimeout(job, timeout);

        // Update metrics
        this.updateMetrics(jobName, result, true);

        // Call success callback
        if (job.onSuccess) {
          job.onSuccess(result);
        }

        this.log("info", `Job '${jobName}' executed successfully`, {
          jobName,
          attempt,
          duration: result.duration,
        });

        return result;
      } catch (error: any) {
        lastError = error;
        const result: CronJobResult = {
          success: false,
          startTime: context.startTime,
          endTime: new Date(),
          duration: Date.now() - context.startTime.getTime(),
          error: error.message,
          retryCount: attempt - 1,
        };

        // Update metrics
        this.updateMetrics(jobName, result, false);

        // Call retry callback
        if (attempt <= maxRetries && job.onRetry) {
          job.onRetry(error, attempt);
        }

        // Call error callback
        if (attempt > maxRetries && job.onError) {
          job.onError(error, result);
        }

        this.log("error", `Job '${jobName}' failed (attempt ${attempt})`, {
          jobName,
          attempt,
          error: error.message,
          willRetry: attempt <= maxRetries,
        });

        // Wait before retry
        if (attempt <= maxRetries) {
          const retryDelay =
            job.config.retryDelay || this.config.defaultRetryDelay || 60000;
          await this.sleep(retryDelay);
        }
      }
    }

    // All retries failed
    throw new CronJobError(
      jobName,
      `Job failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
      maxRetries,
      false
    );
  }

  private async executeJobWithTimeout(
    job: CronJob,
    timeout: number
  ): Promise<CronJobResult> {
    const startTime = new Date();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Job execution timed out after ${timeout}ms`));
      }, timeout);

      job
        .execute()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private scheduleJob(jobName: string, job: CronJob): void {
    if (!job.config.enabled) {
      this.log("info", `Job '${jobName}' is disabled, skipping schedule`);
      return;
    }

    const task = cron.schedule(
      job.config.schedule,
      async () => {
        try {
          await this.executeJob(jobName);
        } catch (error: any) {
          this.log("error", `Scheduled execution of job '${jobName}' failed`, {
            jobName,
            error: error.message,
          });
        }
      },
      {
        timezone: this.config.timezone,
      }
    );

    this.scheduledTasks.set(jobName, task);
    task.start();

    this.log(
      "info",
      `Scheduled job '${jobName}' with schedule '${job.config.schedule}'`,
      {
        jobName,
        schedule: job.config.schedule,
      }
    );
  }

  private updateMetrics(
    jobName: string,
    result: CronJobResult,
    success: boolean
  ): void {
    if (!this.config.enableMetrics) return;

    const metrics = this.metrics.get(jobName);
    if (!metrics) return;

    metrics.totalExecutions++;
    metrics.lastExecution = new Date();

    if (success) {
      metrics.successfulExecutions++;
      metrics.lastSuccess = new Date();
      metrics.consecutiveFailures = 0;
    } else {
      metrics.failedExecutions++;
      metrics.lastFailure = new Date();
      metrics.consecutiveFailures++;
    }

    // Update average duration
    const totalDuration =
      metrics.averageDuration * (metrics.totalExecutions - 1) + result.duration;
    metrics.averageDuration = totalDuration / metrics.totalExecutions;
  }

  private createEmptyMetrics(jobName: string): CronMetrics {
    return {
      jobName,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0,
      consecutiveFailures: 0,
    };
  }

  private log(
    level: "info" | "warn" | "error" | "debug",
    message: string,
    data?: any
  ): void {
    if (!this.config.enableLogging) return;

    const logEntry: CronLogEntry = {
      timestamp: new Date(),
      jobName: "scheduler",
      level,
      message,
      data,
    };

    this.logs.push(logEntry);

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    console.log(
      `[CronScheduler] ${level.toUpperCase()}: ${message}`,
      data || ""
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== PUBLIC GETTERS ====================

  public getStatus(): CronSchedulerStatus {
    const totalJobs = Object.keys(this.jobs).length;
    const activeJobs = this.scheduledTasks.size;
    const completedJobs = Array.from(this.metrics.values()).reduce(
      (sum, metrics) => sum + metrics.successfulExecutions,
      0
    );
    const failedJobs = Array.from(this.metrics.values()).reduce(
      (sum, metrics) => sum + metrics.failedExecutions,
      0
    );

    return {
      isRunning: this.isRunning,
      totalJobs,
      activeJobs,
      completedJobs,
      failedJobs,
      uptime: Date.now() - this.startTime.getTime(),
      lastActivity:
        this.logs.length > 0
          ? this.logs[this.logs.length - 1].timestamp
          : undefined,
    };
  }

  public getMetrics(jobName?: string): CronMetrics | Map<string, CronMetrics> {
    if (jobName) {
      return this.metrics.get(jobName) || this.createEmptyMetrics(jobName);
    }
    return new Map(this.metrics);
  }

  public getLogs(limit: number = 100): CronLogEntry[] {
    return this.logs.slice(-limit);
  }

  public getJobs(): CronJobRegistry {
    return { ...this.jobs };
  }

  public healthCheck(): CronHealthStatus {
    const status = this.getStatus();
    const jobHealth = Array.from(this.metrics.entries()).map(
      ([jobName, metrics]) => ({
        name: jobName,
        status:
          metrics.consecutiveFailures > 3
            ? ("unhealthy" as const)
            : ("healthy" as const),
        lastExecution: metrics.lastExecution,
        lastSuccess: metrics.lastSuccess,
        lastFailure: metrics.lastFailure,
        consecutiveFailures: metrics.consecutiveFailures,
      })
    );

    const overallStatus = jobHealth.some((job) => job.status === "unhealthy")
      ? "unhealthy"
      : "healthy";

    return {
      status: overallStatus,
      scheduler: status,
      jobs: jobHealth,
      uptime: status.uptime,
      lastCheck: new Date(),
    };
  }
}

export default CronSchedulerService;
