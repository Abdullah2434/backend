import {
  QueueConfig,
  RedisConnectionConfig,
  JobOptions,
  QueueSettings,
  RetryConfig,
} from "../types/queue.types";

export class QueueConfigService {
  private static instance: QueueConfigService;
  private configs: Map<string, QueueConfig> = new Map();

  private constructor() {
    this.initializeDefaultConfigs();
  }

  public static getInstance(): QueueConfigService {
    if (!QueueConfigService.instance) {
      QueueConfigService.instance = new QueueConfigService();
    }
    return QueueConfigService.instance;
  }

  private initializeDefaultConfigs(): void {
    // Default Redis connection configuration
    const defaultRedisConfig: RedisConnectionConfig = {
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB) || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: null, // BullMQ requires this to be null
      lazyConnect: true,
      // Additional BullMQ-optimized settings
      connectTimeout: 30000, // Increased to 30 seconds
      commandTimeout: 120000, // Increased to 2 minutes for very long-running operations
      retryDelayOnClusterDown: 300,
      enableReadyCheck: false,
      // Additional timeout settings
      keepAlive: 30000, // Keep connection alive
      family: 4, // Use IPv4
    };

    // Default job options
    const defaultJobOptions: JobOptions = {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: 10,
      removeOnFail: 5,
      priority: 5,
    };

    // Default queue settings
    const defaultQueueSettings: QueueSettings = {
      stalledInterval: 120000, // 2 minutes - increased for long-running photo processing
      maxStalledCount: 1,
      retryProcessDelay: 5000,
    };

    // Photo Avatar Queue Configuration
    this.registerQueueConfig("photo-avatar", {
      name: "photo-avatar",
      connection: defaultRedisConfig,
      defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 5, // More attempts for photo processing
        backoff: {
          type: "exponential",
          delay: 5000, // Longer delay for photo processing
        },
        removeOnComplete: 20,
        removeOnFail: 10,
        priority: 10, // High priority for user-facing operations
        jobTimeout: 600000, // 10 minutes timeout for individual jobs
      },
      settings: {
        ...defaultQueueSettings,
        stalledInterval: 300000, // 5 minutes - increased for very long photo processing
      },
    });

    // Future queue configurations can be added here
    // Example: Video processing queue, email queue, etc.
  }

  public registerQueueConfig(queueName: string, config: QueueConfig): void {
    this.configs.set(queueName, config);
    console.log(`✅ Queue config registered: ${queueName}`);
  }

  public getQueueConfig(queueName: string): QueueConfig | undefined {
    return this.configs.get(queueName);
  }

  public getAllQueueConfigs(): Map<string, QueueConfig> {
    return new Map(this.configs);
  }

  public getRedisConnection(
    queueName: string
  ): RedisConnectionConfig | undefined {
    const config = this.getQueueConfig(queueName);
    return config?.connection;
  }

  public getDefaultJobOptions(queueName: string): JobOptions | undefined {
    const config = this.getQueueConfig(queueName);
    return config?.defaultJobOptions;
  }

  public getQueueSettings(queueName: string): QueueSettings | undefined {
    const config = this.getQueueConfig(queueName);
    return config?.settings;
  }

  public createRetryConfig(
    maxAttempts: number = 3,
    backoffType: "fixed" | "exponential" = "exponential",
    backoffDelay: number = 2000,
    maxBackoffDelay?: number
  ): RetryConfig {
    return {
      maxAttempts,
      backoffType,
      backoffDelay,
      maxBackoffDelay,
    };
  }

  public createJobOptions(
    queueName: string,
    overrides?: Partial<JobOptions>
  ): JobOptions {
    const defaultOptions = this.getDefaultJobOptions(queueName) || {};

    return {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: 10,
      removeOnFail: 5,
      priority: 5,
      ...defaultOptions,
      ...overrides,
    };
  }

  public validateQueueConfig(config: QueueConfig): boolean {
    try {
      // Validate required fields
      if (!config.name) {
        throw new Error("Queue name is required");
      }

      if (!config.connection) {
        throw new Error("Redis connection configuration is required");
      }

      if (!config.connection.host) {
        throw new Error("Redis host is required");
      }

      if (!config.connection.port || config.connection.port <= 0) {
        throw new Error("Valid Redis port is required");
      }

      // Validate job options if provided
      if (config.defaultJobOptions) {
        if (
          config.defaultJobOptions.attempts &&
          config.defaultJobOptions.attempts <= 0
        ) {
          throw new Error("Job attempts must be greater than 0");
        }

        if (
          config.defaultJobOptions.delay &&
          config.defaultJobOptions.delay < 0
        ) {
          throw new Error("Job delay cannot be negative");
        }

        if (
          config.defaultJobOptions.priority &&
          config.defaultJobOptions.priority < 0
        ) {
          throw new Error("Job priority cannot be negative");
        }
      }

      return true;
    } catch (error: any) {
      console.error(
        `Queue config validation failed for ${config.name}:`,
        error.message
      );
      return false;
    }
  }

  public getQueueHealthConfig(): {
    checkInterval: number;
    timeout: number;
    retries: number;
  } {
    return {
      checkInterval: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
      retries: 3,
    };
  }

  public getMonitoringConfig(): {
    metricsRetention: number;
    logRetention: number;
    alertThresholds: {
      failureRate: number;
      processingTime: number;
      queueSize: number;
    };
  } {
    return {
      metricsRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
      logRetention: 24 * 60 * 60 * 1000, // 24 hours
      alertThresholds: {
        failureRate: 0.1, // 10%
        processingTime: 300000, // 5 minutes
        queueSize: 1000,
      },
    };
  }

  public getEnvironmentConfig(): {
    isDevelopment: boolean;
    isProduction: boolean;
    isTest: boolean;
    logLevel: "debug" | "info" | "warn" | "error";
  } {
    const nodeEnv = process.env.NODE_ENV || "development";

    return {
      isDevelopment: nodeEnv === "development",
      isProduction: nodeEnv === "production",
      isTest: nodeEnv === "test",
      logLevel:
        (process.env.QUEUE_LOG_LEVEL as "debug" | "info" | "warn" | "error") ||
        "info",
    };
  }

  public getQueueNames(): string[] {
    return Array.from(this.configs.keys());
  }

  public hasQueueConfig(queueName: string): boolean {
    return this.configs.has(queueName);
  }

  public removeQueueConfig(queueName: string): boolean {
    return this.configs.delete(queueName);
  }

  public getConfigSummary(): {
    totalQueues: number;
    queueNames: string[];
    redisConnections: number;
  } {
    const queueNames = this.getQueueNames();
    const uniqueConnections = new Set(
      queueNames.map((name) => {
        const config = this.getQueueConfig(name);
        return `${config?.connection.host}:${config?.connection.port}`;
      })
    );

    return {
      totalQueues: this.configs.size,
      queueNames,
      redisConnections: uniqueConnections.size,
    };
  }
}

export default QueueConfigService;
