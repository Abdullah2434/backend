import * as cron from "node-cron";
import { logger } from "../../../core/utils/logger";
import {
  JobConfig,
  JobStatus,
  JobResult,
  CronJobHandler,
} from "../types/job.types";

/**
 * Cron Manager
 * Manages scheduled background jobs using node-cron
 */
class CronManager {
  private static instance: CronManager;
  private jobs: Map<string, ReturnType<typeof cron.schedule>> = new Map();
  private jobStatuses: Map<string, JobStatus> = new Map();
  private jobHandlers: Map<string, CronJobHandler> = new Map();

  private constructor() {}

  public static getInstance(): CronManager {
    if (!CronManager.instance) {
      CronManager.instance = new CronManager();
    }
    return CronManager.instance;
  }

  /**
   * Register a cron job
   */
  registerJob(
    config: JobConfig,
    handler: CronJobHandler
  ): ReturnType<typeof cron.schedule> | null {
    if (!config.enabled) {
      logger.info(`Job ${config.name} is disabled, skipping registration`);
      return null;
    }

    if (!config.schedule) {
      logger.warn(`Job ${config.name} has no schedule defined`);
      return null;
    }

    if (this.jobs.has(config.name)) {
      logger.warn(`Job ${config.name} is already registered`);
      return this.jobs.get(config.name)!;
    }

    // Validate cron schedule
    if (!cron.validate(config.schedule)) {
      logger.error(
        `Invalid cron schedule for job ${config.name}: ${config.schedule}`
      );
      return null;
    }

    // Store handler
    this.jobHandlers.set(config.name, handler);

    // Initialize job status
    this.jobStatuses.set(config.name, {
      jobName: config.name,
      status: "idle",
      runCount: 0,
      failureCount: 0,
    });

    // Create cron job
    const task = cron.schedule(config.schedule, async () => {
      await this.executeJob(config.name, handler, config);
    });

    this.jobs.set(config.name, task);
    logger.info(
      `Cron job registered: ${config.name} (schedule: ${config.schedule})`
    );

    return task;
  }

  /**
   * Execute a job
   */
  private async executeJob(
    jobName: string,
    handler: CronJobHandler,
    config: JobConfig
  ): Promise<void> {
    const status = this.jobStatuses.get(jobName);
    if (!status) return;

    if (status.status === "running") {
      logger.warn(`Job ${jobName} is already running, skipping this execution`);
      return;
    }

    // Update status to running
    status.status = "running";
    status.lastRun = new Date();
    this.jobStatuses.set(jobName, status);

    logger.info(`Starting cron job: ${jobName}`);
    const startTime = Date.now();

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = config.timeout
        ? setTimeout(() => controller.abort(), config.timeout)
        : null;

      // Execute handler
      const result = await handler(controller.signal);

      if (timeoutId) clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      // Update status to completed
      status.status = "completed";
      status.lastResult = { ...result, duration };
      status.runCount++;

      logger.info(`Cron job completed: ${jobName}`, {
        duration,
        result: result.message,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Update status to failed
      status.status = "failed";
      status.lastResult = {
        success: false,
        message: "Job execution failed",
        error: errorMessage,
        duration,
      };
      status.failureCount++;

      logger.error(`Cron job failed: ${jobName}`, {
        duration,
        error: errorMessage,
      });
    } finally {
      // Reset to idle after a short delay
      setTimeout(() => {
        status.status = "idle";
        this.jobStatuses.set(jobName, status);
      }, 1000);
    }
  }

  /**
   * Run a job manually (one-time execution)
   */
  async runJobManually(jobName: string): Promise<JobResult> {
    const handler = this.jobHandlers.get(jobName);

    if (!handler) {
      const error = `Job ${jobName} not found`;
      logger.error(error);
      return {
        success: false,
        message: error,
      };
    }

    const status = this.jobStatuses.get(jobName);
    if (status && status.status === "running") {
      const message = `Job ${jobName} is already running`;
      logger.warn(message);
      return {
        success: false,
        message,
      };
    }

    logger.info(`Manually executing job: ${jobName}`);
    const startTime = Date.now();

    try {
      const result = await handler();
      const duration = Date.now() - startTime;

      return { ...result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(`Manual job execution failed: ${jobName}`, {
        duration,
        error: errorMessage,
      });

      return {
        success: false,
        message: "Job execution failed",
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Stop a specific job
   */
  stopJob(jobName: string): boolean {
    const task = this.jobs.get(jobName);

    if (!task) {
      logger.warn(`Job ${jobName} not found`);
      return false;
    }

    task.stop();
    logger.info(`Cron job stopped: ${jobName}`);

    return true;
  }

  /**
   * Start a specific job
   */
  startJob(jobName: string): boolean {
    const task = this.jobs.get(jobName);

    if (!task) {
      logger.warn(`Job ${jobName} not found`);
      return false;
    }

    task.start();
    logger.info(`Cron job started: ${jobName}`);

    return true;
  }

  /**
   * Get status of a specific job
   */
  getJobStatus(jobName: string): JobStatus | undefined {
    return this.jobStatuses.get(jobName);
  }

  /**
   * Get status of all jobs
   */
  getAllJobStatuses(): JobStatus[] {
    return Array.from(this.jobStatuses.values());
  }

  /**
   * Stop all jobs
   */
  stopAll(): void {
    logger.info("Stopping all cron jobs...");

    for (const [name, task] of this.jobs.entries()) {
      task.stop();
      logger.info(`Cron job stopped: ${name}`);
    }
  }

  /**
   * Destroy all jobs
   */
  destroyAll(): void {
    logger.info("Destroying all cron jobs...");

    for (const [name, task] of this.jobs.entries()) {
      task.stop();
      logger.info(`Cron job destroyed: ${name}`);
    }

    this.jobs.clear();
    this.jobStatuses.clear();
    this.jobHandlers.clear();

    logger.info("All cron jobs destroyed");
  }
}

export const cronManager = CronManager.getInstance();
