import cron from "node-cron";
import { fetchAndSyncElevenLabsVoices } from "../services/elevenLabs";
import CronMonitoringService from "../services/cronMonitoring.service";
import {
  executeWithOverallTimeout,
  retryWithBackoff,
} from "../utils/cronHelpers";
import { getCronConfig } from "../config/cron.config";
import { envConfigSchema } from "../validations/fetchElevenLabsVoices.validations";
import {
  ElevenLabsVoicesSyncResult,
  ElevenLabsVoicesSyncConfig,
} from "../types/cron/fetchElevenLabsVoices.types";
import {
  CRON_JOB_NAME,
  CRON_SCHEDULE,
} from "../constants/fetchElevenLabsVoicesCron.constants";

// ==================== SERVICE INSTANCE ====================
const cronMonitor = CronMonitoringService.getInstance();

// ==================== HELPER FUNCTIONS ====================
/**
 * Validate environment configuration
 */
function validateEnvironmentConfig(): { valid: boolean; error?: string } {
  const validationResult = envConfigSchema.safeParse(process.env);

  if (!validationResult.success) {
    const errors = validationResult.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    return { valid: false, error: `Environment validation failed: ${errors}` };
  }

  return { valid: true };
}

/**
 * Execute sync with retry and timeout
 */
async function executeSyncWithRetry(
  config: ElevenLabsVoicesSyncConfig
): Promise<void> {
  await executeWithOverallTimeout(
    CRON_JOB_NAME,
    retryWithBackoff(
      () => fetchAndSyncElevenLabsVoices(),
      config.maxRetries,
      config.retryInitialDelayMs
    ),
    config.overallTimeoutMs
  );
}

/**
 * Run ElevenLabs voices sync with monitoring and error handling
 */
async function runSyncJob(): Promise<ElevenLabsVoicesSyncResult> {
  const startTime = Date.now();
  const config = getCronConfig(CRON_JOB_NAME);

  // Validate environment configuration
  const envValidation = validateEnvironmentConfig();
  if (!envValidation.valid) {
    const duration = Date.now() - startTime;
    const error = envValidation.error || "Environment validation failed";
    console.error(`❌ ${error}`);
    return {
      success: false,
      duration,
      error,
    };
  }

  try {
    await executeSyncWithRetry({
      maxRetries: config.maxRetries,
      retryInitialDelayMs: config.retryInitialDelayMs,
      overallTimeoutMs: config.overallTimeoutMs,
    });

    const duration = Date.now() - startTime;
    console.log(`✅ ElevenLabs voices sync job completed in ${duration}ms`);
    return {
      success: true,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error?.message || "Unknown error";
    console.error(
      `❌ ElevenLabs voices sync job failed after ${duration}ms:`,
      errorMessage
    );
    return {
      success: false,
      duration,
      error: errorMessage,
    };
  }
}

// ==================== EXPORTED FUNCTIONS ====================
/**
 * Run ElevenLabs voices sync once immediately
 */
export async function startElevenLabsVoicesSync(): Promise<ElevenLabsVoicesSyncResult> {
  return await runSyncJob();
}

/**
 * Start cron job to sync ElevenLabs voices
 * Runs at 11:03 AM and 11:03 PM (every 12 hours)
 */
export function startElevenLabsVoicesSyncCron() {
  // Initialize monitoring
  cronMonitor.startMonitoring(CRON_JOB_NAME);
  const config = getCronConfig(CRON_JOB_NAME);

  // Validate environment before starting cron
  const envValidation = validateEnvironmentConfig();
  if (!envValidation.valid) {
    console.error(`❌ Cannot start cron job: ${envValidation.error}`);
    return;
  }

  // Run at 11:03 AM and 11:03 PM (every 12 hours): 3 11,23 * * *
  cron.schedule(CRON_SCHEDULE, async () => {
    const startTime = Date.now();
    cronMonitor.markJobStarted(CRON_JOB_NAME);

    try {
      await executeSyncWithRetry({
        maxRetries: config.maxRetries,
        retryInitialDelayMs: config.retryInitialDelayMs,
        overallTimeoutMs: config.overallTimeoutMs,
      });

      const duration = Date.now() - startTime;
      console.log(
        `✅ ElevenLabs voices sync cron job completed in ${duration}ms`
      );
      cronMonitor.markJobCompleted(CRON_JOB_NAME, duration, true);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error?.message || "Unknown error";
      console.error(
        `❌ ElevenLabs voices sync cron job failed after ${duration}ms:`,
        errorMessage
      );
      cronMonitor.markJobFailed(CRON_JOB_NAME, errorMessage);
    }
  });

  console.log(
    `⏰ ElevenLabs voices sync cron job started - running at 11:03 AM and 11:03 PM (every 12 hours) (schedule: ${CRON_SCHEDULE})`
  );
}

// For manual run/testing
if (require.main === module) {
  (async () => {
    try {
      const result = await startElevenLabsVoicesSync();

      if (result.success) {
        console.log("✅ Manual sync completed successfully");
        process.exit(0);
      } else {
        console.error("❌ Manual sync failed:", result.error);
        process.exit(1);
      }
    } catch (error: any) {
      console.error(
        "❌ Manual sync failed with exception:",
        error?.message || error
      );
      process.exit(1);
    }
  })();
}
