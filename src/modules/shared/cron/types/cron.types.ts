// ==================== CRON JOB TYPES ====================

export interface CronJobConfig {
  name: string;
  schedule: string;
  enabled: boolean;
  description: string;
  timeout?: number; // in milliseconds
  retries?: number;
  retryDelay?: number; // in milliseconds
}

export interface CronJobResult {
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  error?: string;
  data?: any;
  retryCount?: number;
}

export interface CronJob {
  config: CronJobConfig;
  execute: () => Promise<CronJobResult>;
  onSuccess?: (result: CronJobResult) => void;
  onError?: (error: Error, result: CronJobResult) => void;
  onRetry?: (error: Error, attempt: number) => void;
}

// ==================== CRON SCHEDULER TYPES ====================

export interface CronSchedulerConfig {
  timezone?: string;
  maxConcurrentJobs?: number;
  defaultTimeout?: number;
  defaultRetries?: number;
  defaultRetryDelay?: number;
  enableLogging?: boolean;
  enableMetrics?: boolean;
}

export interface CronSchedulerStatus {
  isRunning: boolean;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  uptime: number;
  lastActivity?: Date;
}

// ==================== CRON JOB CATEGORIES ====================

export enum CronJobCategory {
  AVATAR = "avatar",
  VOICE = "voice",
  TOPIC = "topic",
  CLEANUP = "cleanup",
  SYNC = "sync",
  HEALTH = "health",
  NOTIFICATION = "notification",
}

export interface CronJobMetadata {
  category: CronJobCategory;
  priority: "low" | "medium" | "high" | "critical";
  tags: string[];
  dependencies?: string[]; // Other job names this job depends on
}

// ==================== CRON LOGGING TYPES ====================

export interface CronLogEntry {
  timestamp: Date;
  jobName: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  data?: any;
  duration?: number;
  success?: boolean;
}

export interface CronMetrics {
  jobName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  lastExecution?: Date;
  lastSuccess?: Date;
  lastFailure?: Date;
  consecutiveFailures: number;
}

// ==================== CRON HEALTH TYPES ====================

export interface CronHealthStatus {
  status: "healthy" | "unhealthy" | "degraded";
  scheduler: CronSchedulerStatus;
  jobs: Array<{
    name: string;
    status: "healthy" | "unhealthy" | "unknown";
    lastExecution?: Date;
    lastSuccess?: Date;
    lastFailure?: Date;
    consecutiveFailures: number;
  }>;
  uptime: number;
  lastCheck: Date;
}

// ==================== CRON ERROR TYPES ====================

export class CronJobError extends Error {
  public readonly jobName: string;
  public readonly retryCount: number;
  public readonly isRetryable: boolean;

  constructor(
    jobName: string,
    message: string,
    retryCount: number = 0,
    isRetryable: boolean = true
  ) {
    super(message);
    this.name = "CronJobError";
    this.jobName = jobName;
    this.retryCount = retryCount;
    this.isRetryable = isRetryable;
  }
}

export class CronSchedulerError extends Error {
  public readonly schedulerName: string;

  constructor(schedulerName: string, message: string) {
    super(message);
    this.name = "CronSchedulerError";
    this.schedulerName = schedulerName;
  }
}

// ==================== CRON NOTIFICATION TYPES ====================

export interface CronNotificationConfig {
  enabled: boolean;
  onFailure: boolean;
  onSuccess: boolean;
  onRetry: boolean;
  channels: ("email" | "webhook" | "log")[];
  recipients?: string[];
  webhookUrl?: string;
}

export interface CronNotificationData {
  jobName: string;
  result: CronJobResult;
  error?: Error;
  retryCount?: number;
  timestamp: Date;
}

// ==================== CRON JOB REGISTRY TYPES ====================

export interface CronJobRegistry {
  [jobName: string]: CronJob;
}

export interface CronJobRegistration {
  job: CronJob;
  metadata: CronJobMetadata;
  notificationConfig?: CronNotificationConfig;
}

// ==================== CRON EXECUTION CONTEXT TYPES ====================

export interface CronExecutionContext {
  jobName: string;
  startTime: Date;
  attempt: number;
  maxRetries: number;
  timeout: number;
  metadata: Record<string, any>;
}

export interface CronExecutionResult {
  context: CronExecutionContext;
  result: CronJobResult;
  metrics: CronMetrics;
}
