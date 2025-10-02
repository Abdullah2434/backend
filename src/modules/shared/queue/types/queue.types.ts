// ==================== QUEUE CONFIGURATION TYPES ====================

export interface QueueConfig {
  name: string;
  connection: RedisConnectionConfig;
  defaultJobOptions?: JobOptions;
  settings?: QueueSettings;
}

export interface RedisConnectionConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number | null; // BullMQ requires null
  lazyConnect?: boolean;
  // Additional BullMQ-optimized settings
  connectTimeout?: number;
  commandTimeout?: number;
  retryDelayOnClusterDown?: number;
  enableReadyCheck?: boolean;
  // Additional timeout settings
  keepAlive?: number;
  family?: number;
}

export interface JobOptions {
  delay?: number;
  attempts?: number;
  backoff?: BackoffOptions;
  removeOnComplete?: number | boolean;
  removeOnFail?: number | boolean;
  priority?: number;
  jobId?: string;
  jobTimeout?: number; // Timeout for individual jobs in milliseconds
}

export interface BackoffOptions {
  type: "fixed" | "exponential";
  delay: number;
}

export interface QueueSettings {
  stalledInterval?: number;
  maxStalledCount?: number;
  retryProcessDelay?: number;
}

// ==================== QUEUE JOB TYPES ====================

export interface QueueJobData {
  [key: string]: any;
}

export interface QueueJobResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  retryCount?: number;
}

export interface QueueJobProgress {
  progress: number; // 0-100
  message: string;
  data?: any;
}

// ==================== PHOTO AVATAR QUEUE TYPES ====================

export interface PhotoAvatarJobData extends QueueJobData {
  imagePath: string;
  age_group: string;
  name: string;
  gender: string;
  userId: string;
  ethnicity: string;
  mimeType: string;
}

export interface PhotoAvatarJobResult extends QueueJobResult {
  avatarId?: string;
  avatarUrl?: string;
  status?: "pending" | "training" | "ready" | "failed";
}

export interface PhotoAvatarProgress extends QueueJobProgress {
  step: "upload" | "create_group" | "train" | "complete";
  status: "progress" | "success" | "error";
}

// ==================== QUEUE WORKER TYPES ====================

export interface QueueWorkerConfig {
  name: string;
  queueName: string;
  connection: RedisConnectionConfig;
  concurrency?: number;
  settings?: WorkerSettings;
}

export interface WorkerSettings {
  stalledInterval?: number;
  maxStalledCount?: number;
  retryProcessDelay?: number;
}

export interface QueueWorker {
  name: string;
  isRunning: boolean;
  isPaused: boolean;
  concurrency: number;
  processed: number;
  failed: number;
  stalled: number;
}

// ==================== QUEUE MONITORING TYPES ====================

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface QueueHealthStatus {
  status: "healthy" | "unhealthy" | "degraded";
  connection: boolean;
  stats: QueueStats;
  workers: QueueWorker[];
  uptime: number;
  lastActivity?: Date;
}

export interface QueueMetrics {
  queueName: string;
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  lastJobProcessed?: Date;
  lastJobFailed?: Date;
  consecutiveFailures: number;
}

// ==================== QUEUE ERROR TYPES ====================

export class QueueError extends Error {
  public readonly queueName: string;
  public readonly jobId?: string;
  public readonly isRetryable: boolean;

  constructor(
    queueName: string,
    message: string,
    jobId?: string,
    isRetryable: boolean = true
  ) {
    super(message);
    this.name = "QueueError";
    this.queueName = queueName;
    this.jobId = jobId;
    this.isRetryable = isRetryable;
  }
}

export class QueueWorkerError extends Error {
  public readonly workerName: string;
  public readonly queueName: string;

  constructor(workerName: string, queueName: string, message: string) {
    super(message);
    this.name = "QueueWorkerError";
    this.workerName = workerName;
    this.queueName = queueName;
  }
}

// ==================== QUEUE LOGGING TYPES ====================

export interface QueueLogEntry {
  timestamp: Date;
  queueName: string;
  workerName?: string;
  jobId?: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  data?: any;
  duration?: number;
  success?: boolean;
}

// ==================== QUEUE NOTIFICATION TYPES ====================

export interface QueueNotificationConfig {
  enabled: boolean;
  onJobComplete: boolean;
  onJobFail: boolean;
  onWorkerError: boolean;
  channels: ("email" | "webhook" | "log")[];
  recipients?: string[];
  webhookUrl?: string;
}

export interface QueueNotificationData {
  queueName: string;
  jobId?: string;
  workerName?: string;
  event: "job_complete" | "job_fail" | "worker_error";
  data?: any;
  error?: string;
  timestamp: Date;
}

// ==================== QUEUE REGISTRY TYPES ====================

export interface QueueRegistry {
  [queueName: string]: {
    queue: any; // BullMQ Queue instance
    config: QueueConfig;
    workers: QueueWorker[];
    metrics: QueueMetrics;
  };
}

export interface QueueRegistration {
  config: QueueConfig;
  workerConfig?: QueueWorkerConfig;
  processor?: (job: any) => Promise<QueueJobResult>;
}

// ==================== QUEUE UTILITY TYPES ====================

export interface QueueCleanupOptions {
  maxAge?: number; // in milliseconds
  maxCount?: number;
  grace?: number; // grace period in milliseconds
}

export interface QueueBulkOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: string[];
}

// ==================== QUEUE JOB PRIORITY TYPES ====================

export enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 20,
}

export interface PriorityJobOptions extends JobOptions {
  priority: JobPriority;
}

// ==================== QUEUE RETRY TYPES ====================

export interface RetryConfig {
  maxAttempts: number;
  backoffType: "fixed" | "exponential";
  backoffDelay: number;
  maxBackoffDelay?: number;
}

export interface RetryResult {
  shouldRetry: boolean;
  delay: number;
  attempt: number;
  maxAttempts: number;
}

// ==================== QUEUE BATCH TYPES ====================

export interface BatchJobData {
  jobs: Array<{
    name: string;
    data: QueueJobData;
    options?: JobOptions;
  }>;
}

export interface BatchJobResult {
  success: boolean;
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  results: Array<{
    jobName: string;
    success: boolean;
    result?: any;
    error?: string;
  }>;
}
