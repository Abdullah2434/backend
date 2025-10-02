export interface JobConfig {
  name: string;
  schedule?: string; // Cron schedule pattern
  enabled: boolean;
  maxRetries?: number;
  timeout?: number; // in milliseconds
}

export interface JobResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  duration?: number; // in milliseconds
}

export interface JobStatus {
  jobName: string;
  status: "idle" | "running" | "completed" | "failed";
  lastRun?: Date;
  nextRun?: Date;
  lastResult?: JobResult;
  runCount: number;
  failureCount: number;
}

export interface QueueJobData {
  userId?: string;
  [key: string]: any;
}

export interface PhotoAvatarJobData extends QueueJobData {
  imagePath: string;
  age_group: string;
  name: string;
  gender: string;
  userId: string;
  ethnicity?: string;
  mimeType?: string;
}

export interface CronJobHandler {
  (signal?: AbortSignal): Promise<JobResult>;
}

export interface QueueJobHandler<T = any> {
  (data: T): Promise<JobResult>;
}
