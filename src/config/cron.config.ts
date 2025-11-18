/**
 * Centralized configuration for cron jobs
 * Defines timeouts, batch sizes, retry policies, and execution limits
 */

export interface CronJobConfig {
  overallTimeoutMs: number;
  apiTimeoutMs: number;
  databaseTimeoutMs: number;
  batchSize?: number;
  maxRetries: number;
  retryInitialDelayMs: number;
  delayBetweenBatchesMs: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: CronJobConfig = {
  overallTimeoutMs: 15 * 60 * 1000, // 15 minutes
  apiTimeoutMs: 60000, // 60 seconds
  databaseTimeoutMs: 30000, // 30 seconds
  batchSize: 5,
  maxRetries: 3,
  retryInitialDelayMs: 1000, // 1 second
  delayBetweenBatchesMs: 1000, // 1 second
};

/**
 * Job-specific configurations
 */
export const CRON_CONFIGS: Record<string, CronJobConfig> = {
  "scheduled-video-processor": {
    overallTimeoutMs: 15 * 60 * 1000, // 15 minutes
    apiTimeoutMs: 60000, // 60 seconds
    databaseTimeoutMs: 30000, // 30 seconds
    batchSize: 3,
    maxRetries: 3,
    retryInitialDelayMs: 1000,
    delayBetweenBatchesMs: 1000,
  },
  "subscription-sync": {
    overallTimeoutMs: 30 * 60 * 1000, // 30 minutes
    apiTimeoutMs: 30000, // 30 seconds (Stripe API)
    databaseTimeoutMs: 30000, // 30 seconds
    batchSize: 10,
    maxRetries: 3,
    retryInitialDelayMs: 1000,
    delayBetweenBatchesMs: 2000, // 2 seconds
  },
  "elevenlabs-voices-sync": {
    overallTimeoutMs: 10 * 60 * 1000, // 10 minutes
    apiTimeoutMs: 60000, // 60 seconds
    databaseTimeoutMs: 30000, // 30 seconds
    batchSize: undefined, // No batching needed
    maxRetries: 3,
    retryInitialDelayMs: 1000,
    delayBetweenBatchesMs: 1000,
  },
  "heygen-avatars-sync": {
    overallTimeoutMs: 15 * 60 * 1000, // 15 minutes
    apiTimeoutMs: 60000, // 60 seconds
    databaseTimeoutMs: 30000, // 30 seconds
    batchSize: 10,
    maxRetries: 3,
    retryInitialDelayMs: 1000,
    delayBetweenBatchesMs: 1000,
  },
  "avatar-status-check": {
    overallTimeoutMs: 10 * 60 * 1000, // 10 minutes
    apiTimeoutMs: 30000, // 30 seconds per avatar
    databaseTimeoutMs: 30000, // 30 seconds
    batchSize: 5,
    maxRetries: 2,
    retryInitialDelayMs: 1000,
    delayBetweenBatchesMs: 1000,
  },
  "fetch-default-avatars": {
    overallTimeoutMs: 15 * 60 * 1000, // 15 minutes
    apiTimeoutMs: 60000, // 60 seconds
    databaseTimeoutMs: 30000, // 30 seconds
    batchSize: 10,
    maxRetries: 3,
    retryInitialDelayMs: 1000,
    delayBetweenBatchesMs: 1000,
  },
  "generate-topic-data": {
    overallTimeoutMs: 20 * 60 * 1000, // 20 minutes
    apiTimeoutMs: 120000, // 120 seconds (OpenAI API)
    databaseTimeoutMs: 30000, // 30 seconds
    batchSize: undefined, // No batching needed
    maxRetries: 3,
    retryInitialDelayMs: 2000, // 2 seconds
    delayBetweenBatchesMs: 2000,
  },
};

/**
 * Get configuration for a specific cron job
 * @param jobName Name of the cron job
 * @returns Configuration object
 */
export function getCronConfig(jobName: string): CronJobConfig {
  return CRON_CONFIGS[jobName] || DEFAULT_CONFIG;
}

