/**
 * Types for syncHeyGenAvatars cron job
 */

export interface SyncHeyGenAvatar {
  avatar_id?: string;
  [key: string]: any;
}

export interface SyncHeyGenAvatarsAPIResponse {
  data?: {
    avatars?: SyncHeyGenAvatar[];
    talking_photos?: SyncHeyGenAvatar[];
  };
}

export interface SyncHeyGenAvatarsResult {
  success: boolean;
  heygenAvatarCount: number;
  databaseAvatarCount: number;
  deletedCount: number;
  deletedAvatarIds: string[];
  error?: string;
}

export interface SyncHeyGenAvatarsConfig {
  maxRetries: number;
  retryInitialDelayMs: number;
  overallTimeoutMs: number;
  databaseTimeoutMs: number;
  apiTimeoutMs: number;
  batchSize: number;
  delayBetweenBatchesMs: number;
}

