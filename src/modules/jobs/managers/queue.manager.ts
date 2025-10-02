import { Queue, Worker, Job } from "bullmq";
import { logger } from "../../../core/utils/logger";
import { QueueJobData, JobResult, QueueJobHandler } from "../types/job.types";

/**
 * Queue Manager
 * Manages BullMQ queues and workers for background job processing
 */
class QueueManager {
  private static instance: QueueManager;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private redisConnection: {
    host: string;
    port: number;
    password?: string;
  };

  private constructor() {
    this.redisConnection = {
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    };
  }

  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  /**
   * Create a new queue
   */
  createQueue(queueName: string): Queue {
    if (this.queues.has(queueName)) {
      return this.queues.get(queueName)!;
    }

    const queue = new Queue(queueName, {
      connection: this.redisConnection,
    });

    this.queues.set(queueName, queue);
    logger.info(`Queue created: ${queueName}`);

    return queue;
  }

  /**
   * Create a worker for a queue
   */
  createWorker<T extends QueueJobData = QueueJobData>(
    queueName: string,
    handler: QueueJobHandler<T>,
    options?: {
      concurrency?: number;
      limiter?: {
        max: number;
        duration: number;
      };
    }
  ): Worker {
    if (this.workers.has(queueName)) {
      logger.warn(`Worker already exists for queue: ${queueName}`);
      return this.workers.get(queueName)!;
    }

    const worker = new Worker<T>(
      queueName,
      async (job: Job<T>) => {
        const startTime = Date.now();
        logger.info(`Processing job ${job.id} in queue ${queueName}`, {
          jobId: job.id,
          data: job.data,
        });

        try {
          const result = await handler(job.data);
          const duration = Date.now() - startTime;

          logger.info(`Job ${job.id} completed successfully`, {
            jobId: job.id,
            duration,
            result,
          });

          return { ...result, duration };
        } catch (error) {
          const duration = Date.now() - startTime;
          logger.error(`Job ${job.id} failed`, {
            jobId: job.id,
            duration,
            error: error instanceof Error ? error.message : "Unknown error",
          });

          throw error;
        }
      },
      {
        connection: this.redisConnection,
        concurrency: options?.concurrency || 1,
        limiter: options?.limiter,
      }
    );

    // Setup event listeners
    worker.on("completed", (job) => {
      logger.info(`Worker completed job ${job.id} in queue ${queueName}`);
    });

    worker.on("failed", (job, error) => {
      logger.error(`Worker failed job ${job?.id} in queue ${queueName}`, error);
    });

    worker.on("error", (error) => {
      logger.error(`Worker error in queue ${queueName}`, error);
    });

    this.workers.set(queueName, worker);
    logger.info(`Worker created for queue: ${queueName}`);

    return worker;
  }

  /**
   * Add a job to a queue
   */
  async addJob<T extends QueueJobData = QueueJobData>(
    queueName: string,
    data: T,
    options?: {
      delay?: number;
      priority?: number;
      attempts?: number;
      backoff?: {
        type: "exponential" | "fixed";
        delay: number;
      };
    }
  ): Promise<Job<T>> {
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.add(queueName, data, options);

    logger.info(`Job added to queue ${queueName}`, {
      jobId: job.id,
      data,
    });

    return job;
  }

  /**
   * Get queue instance
   */
  getQueue(queueName: string): Queue | undefined {
    return this.queues.get(queueName);
  }

  /**
   * Get worker instance
   */
  getWorker(queueName: string): Worker | undefined {
    return this.workers.get(queueName);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string) {
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Close all queues and workers
   */
  async close(): Promise<void> {
    logger.info("Closing all queues and workers...");

    // Close workers first
    for (const [name, worker] of this.workers.entries()) {
      await worker.close();
      logger.info(`Worker closed: ${name}`);
    }

    // Then close queues
    for (const [name, queue] of this.queues.entries()) {
      await queue.close();
      logger.info(`Queue closed: ${name}`);
    }

    this.workers.clear();
    this.queues.clear();

    logger.info("All queues and workers closed");
  }
}

export const queueManager = QueueManager.getInstance();
