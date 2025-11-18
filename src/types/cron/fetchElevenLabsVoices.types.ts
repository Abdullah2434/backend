/**
 * Types for fetchElevenLabsVoices cron job
 */

export interface ElevenLabsVoicesSyncResult {
  success: boolean;
  duration: number;
  error?: string;
}

export interface ElevenLabsVoicesSyncConfig {
  maxRetries: number;
  retryInitialDelayMs: number;
  overallTimeoutMs: number;
}

