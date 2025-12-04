import cron from "node-cron";
import { SubscriptionService } from "../services/payment";
import Subscription from "../models/Subscription";
import CronMonitoringService from "../services/cronMonitoring.service";
import {
  executeWithOverallTimeout,
  withDatabaseTimeout,
  retryWithBackoff,
  processInBatches,
  withTimeout,
} from "../utils/cronHelpers";
import { getCronConfig } from "../config/cron.config";
import { VALID_SYNC_SUBSCRIPTION_STATUSES } from "../validations/syncSubscriptions.validations";
import {
  SubscriptionSyncResult,
  SyncSubscriptionsSummary,
  SyncSubscriptionsConfig,
  ActiveSubscription,
} from "../types/cron/syncSubscriptions.types";
import {
  CRON_JOB_NAME,
  CRON_SCHEDULE,
} from "../constants/syncSubscriptionsCron.constants";

// ==================== SERVICE INSTANCES ====================
const subscriptionService = new SubscriptionService();
const cronMonitor = CronMonitoringService.getInstance();

// ==================== HELPER FUNCTIONS ====================
/**
 * Validate subscription status for sync
 */
function isValidSyncStatus(status: string): boolean {
  return VALID_SYNC_SUBSCRIPTION_STATUSES.includes(status as any);
}

/**
 * Process a single subscription sync
 */
async function processSubscriptionSync(
  localSub: ActiveSubscription,
  config: SyncSubscriptionsConfig
): Promise<SubscriptionSyncResult> {
  try {
    if (!localSub.stripeSubscriptionId) {
      return {
        synced: false,
        updated: false,
        error: false,
        subscriptionId: localSub._id.toString(),
        errorMessage: "Missing stripeSubscriptionId",
      };
    }

    // Sync subscription from Stripe with timeout and retry
    const syncedSubscription = await retryWithBackoff(
      () =>
        withTimeout(
          subscriptionService.syncSubscriptionFromStripe(
            localSub.stripeSubscriptionId!,
            localSub.userId.toString()
          ),
          config.apiTimeoutMs,
          "Stripe API call timed out"
        ),
      config.maxRetries,
      config.retryInitialDelayMs
    );

    // Check if status changed
    const wasUpdated = syncedSubscription.status !== localSub.status;
    return {
      synced: !wasUpdated,
      updated: wasUpdated,
      error: false,
      subscriptionId: localSub.stripeSubscriptionId,
    };
  } catch (error: any) {
    console.error(
      `❌ Error syncing subscription ${localSub.stripeSubscriptionId}:`,
      error?.message || error
    );
    return {
      synced: false,
      updated: false,
      error: true,
      subscriptionId: localSub.stripeSubscriptionId,
      errorMessage: error?.message || "Unknown error",
    };
  }
}

/**
 * Calculate sync summary from results
 */
function calculateSyncSummary(
  results: SubscriptionSyncResult[],
  totalSubscriptions: number
): SyncSubscriptionsSummary {
  const syncedCount = results.filter((r) => r.synced).length;
  const updatedCount = results.filter((r) => r.updated).length;
  const errorCount = results.filter((r) => r.error).length;
  const errors = results
    .filter((r) => r.error && r.errorMessage)
    .map((r) => `${r.subscriptionId}: ${r.errorMessage}`);

  return {
    totalSubscriptions,
    syncedCount,
    updatedCount,
    errorCount,
    errors,
  };
}

// ==================== MAIN FUNCTION ====================
/**
 * Sync all active subscriptions from Stripe
 * This handles recurring payments automatically processed by Stripe
 */
async function syncAllActiveSubscriptions(): Promise<SyncSubscriptionsSummary> {
  const config = getCronConfig(CRON_JOB_NAME);
  const startTime = Date.now();

  try {
    // Get active subscriptions with database timeout
    const activeSubscriptions = await withDatabaseTimeout(
      Subscription.find({
        status: { $in: Array.from(VALID_SYNC_SUBSCRIPTION_STATUSES) },
      }).select("stripeSubscriptionId status userId"),
      config.databaseTimeoutMs
    );

    if (activeSubscriptions.length === 0) {
      console.log("✅ No active subscriptions to sync");
      return {
        totalSubscriptions: 0,
        syncedCount: 0,
        updatedCount: 0,
        errorCount: 0,
        errors: [],
      };
    }

    console.log(
      `📋 Found ${activeSubscriptions.length} active subscription(s) to sync`
    );

    // Process subscriptions in batches
    const results = await processInBatches(
      activeSubscriptions as ActiveSubscription[],
      config.batchSize!,
      async (localSub: ActiveSubscription) => {
        return await processSubscriptionSync(localSub, {
          maxRetries: config.maxRetries,
          retryInitialDelayMs: config.retryInitialDelayMs,
          overallTimeoutMs: config.overallTimeoutMs,
          databaseTimeoutMs: config.databaseTimeoutMs,
          apiTimeoutMs: config.apiTimeoutMs,
          batchSize: config.batchSize!,
          delayBetweenBatchesMs: config.delayBetweenBatchesMs!,
        });
      },
      config.delayBetweenBatchesMs
    );

    // Calculate summary
    const summary = calculateSyncSummary(results, activeSubscriptions.length);

    const duration = Date.now() - startTime;
    console.log(
      `✅ Subscription sync completed in ${duration}ms: ${summary.syncedCount} synced, ${summary.updatedCount} updated, ${summary.errorCount} error(s)`
    );

    if (summary.errors.length > 0) {
      console.warn(
        `⚠️ Encountered ${summary.errors.length} error(s) during sync`
      );
    }

    return summary;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error?.message || "Unknown error";
    console.error(
      `❌ Error in subscription sync cron job after ${duration}ms:`,
      errorMessage
    );
    throw error;
  }
}

/**
 * Start subscription sync cron job
 * Runs every hour to check for recurring payments and subscription updates
 */
export function startSubscriptionSync() {
  // Initialize monitoring
  cronMonitor.startMonitoring(CRON_JOB_NAME);
  const config = getCronConfig(CRON_JOB_NAME);

  // Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00)
  cron.schedule(CRON_SCHEDULE, async () => {
    const startTime = Date.now();
    cronMonitor.markJobStarted(CRON_JOB_NAME);

    try {
      await executeWithOverallTimeout(
        CRON_JOB_NAME,
        syncAllActiveSubscriptions(),
        config.overallTimeoutMs
      );

      const duration = Date.now() - startTime;
      console.log(`✅ Subscription sync cron job completed in ${duration}ms`);
      cronMonitor.markJobCompleted(CRON_JOB_NAME, duration, true);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error?.message || "Unknown error";
      console.error(
        `❌ Subscription sync cron job failed after ${duration}ms:`,
        errorMessage
      );
      cronMonitor.markJobFailed(CRON_JOB_NAME, errorMessage);
    }
  });

  console.log(
    `⏰ Subscription sync cron job started - running every hour (schedule: ${CRON_SCHEDULE})`
  );
}
