import axios, { AxiosResponse } from "axios";
import DefaultAvatar, { IDefaultAvatar } from "../models/avatar";
import { connectMongo } from "../config/mongoose";
import dotenv from "dotenv";
import cron from "node-cron";
import CronMonitoringService from "../services/cronMonitoring.service";
import {
  executeWithOverallTimeout,
  withDatabaseTimeout,
  withApiTimeout,
  processInBatches,
} from "../utils/cronHelpers";
import { getCronConfig } from "../config/cron.config";
import {
  syncHeyGenAvatarsAPIResponseSchema,
  HEYGEN_AVATARS_SYNC_SCHEDULE,
} from "../validations/syncHeyGenAvatars.validations";
import {
  SyncHeyGenAvatar,
  SyncHeyGenAvatarsAPIResponse,
  SyncHeyGenAvatarsResult,
  SyncHeyGenAvatarsConfig,
} from "../types/cron/syncHeyGenAvatars.types";

// ==================== CONSTANTS ====================
dotenv.config();

const CRON_JOB_NAME = "heygen-avatars-sync";
const API_URL = `${process.env.HEYGEN_BASE_URL}/avatars`;
const API_KEY = process.env.HEYGEN_API_KEY;

// ==================== SERVICE INSTANCE ====================
const cronMonitor = CronMonitoringService.getInstance();

// ==================== HELPER FUNCTIONS ====================
/**
 * Validate API configuration
 */
function validateAPIConfig(): { valid: boolean; error?: string } {
  if (!API_KEY) {
    return { valid: false, error: "HEYGEN_API_KEY is not configured" };
  }
  if (!API_URL || API_URL.includes("undefined")) {
    return { valid: false, error: "HEYGEN_BASE_URL is not configured" };
  }
  return { valid: true };
}

/**
 * Extract avatar IDs from HeyGen API response
 * Collects both avatar_id (from avatars) and talking_photo_id (from talking_photos)
 */
function extractAvatarIdsFromAPI(responseData: any): {
  avatarIds: Set<string>;
  error?: string;
} {
  const validationResult =
    syncHeyGenAvatarsAPIResponseSchema.safeParse(responseData);

  if (!validationResult.success) {
    console.error(
      "Invalid API response format:",
      validationResult.error.errors
    );
    return {
      avatarIds: new Set<string>(),
      error: "Invalid API response format",
    };
  }

  const data = validationResult.data?.data || {};
  const videoAvatars = (data.avatars || []) as SyncHeyGenAvatar[];
  const photoAvatars = (data.talking_photos || []) as SyncHeyGenAvatar[];

  const avatarIds = new Set<string>();

  // Add video avatar IDs from avatars array
  for (const avatar of videoAvatars) {
    if (avatar.avatar_id && typeof avatar.avatar_id === "string") {
      avatarIds.add(avatar.avatar_id);
    }
  }

  // Add photo avatar IDs from talking_photos array
  // Check both avatar_id and talking_photo_id fields
  for (const photo of photoAvatars) {
    // Add talking_photo_id if it exists
    const talkingPhotoId = (photo as any).talking_photo_id;
    if (talkingPhotoId && typeof talkingPhotoId === "string") {
      avatarIds.add(talkingPhotoId);
    }

    // Also add avatar_id if it exists (some talking_photos might have both)
    if (photo.avatar_id && typeof photo.avatar_id === "string") {
      avatarIds.add(photo.avatar_id);
    }
  }

  return { avatarIds };
}

/**
 * Identify avatars to delete
 */
function identifyAvatarsToDelete(
  databaseAvatars: IDefaultAvatar[],
  heygenAvatarIds: Set<string>
): string[] {
  const avatarsToDelete: string[] = [];

  for (const avatar of databaseAvatars) {
    if (!heygenAvatarIds.has(avatar.avatar_id)) {
      avatarsToDelete.push(avatar.avatar_id);
    }
  }

  return avatarsToDelete;
}

/**
 * Delete avatars in batches
 */
async function deleteAvatarsInBatches(
  avatarIds: string[],
  config: SyncHeyGenAvatarsConfig
): Promise<number> {
  if (avatarIds.length === 0) {
    return 0;
  }

  let totalDeleted = 0;
  const batches: string[][] = [];

  // Create batches
  for (let i = 0; i < avatarIds.length; i += config.batchSize) {
    batches.push(avatarIds.slice(i, i + config.batchSize));
  }

  // Process each batch
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      const deleteResult = await withDatabaseTimeout(
        DefaultAvatar.deleteMany({
          avatar_id: { $in: batch },
          $or: [{ default: false }, { status: "training" }],
        }),
        config.databaseTimeoutMs
      );
      totalDeleted += deleteResult.deletedCount || 0;

      // Add delay between batches (except for last batch)
      if (i < batches.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, config.delayBetweenBatchesMs)
        );
      }
    } catch (error: any) {
      console.error(`❌ Error deleting avatar batch:`, error?.message || error);
    }
  }

  return totalDeleted;
}

// ==================== MAIN FUNCTION ====================
/**
 * Sync HeyGen avatars with database
 * - Fetches avatar_ids from HeyGen API
 * - Compares with database avatars where:
 *   - default === false, OR
 *   - status === 'training' (regardless of default value)
 * - Deletes avatars that no longer exist in HeyGen
 */
export async function syncHeyGenAvatars(): Promise<SyncHeyGenAvatarsResult> {
  const config = getCronConfig(CRON_JOB_NAME);

  // Validate API configuration
  const configValidation = validateAPIConfig();
  if (!configValidation.valid) {
    console.error(`❌ ${configValidation.error}`);
    return {
      success: false,
      heygenAvatarCount: 0,
      databaseAvatarCount: 0,
      deletedCount: 0,
      deletedAvatarIds: [],
      error: configValidation.error,
    };
  }

  try {
    await connectMongo();

    // Get avatars from HeyGen API with timeout
    const response: AxiosResponse<SyncHeyGenAvatarsAPIResponse> =
      await axios.get(API_URL, {
        headers: {
          accept: "application/json",
          "x-api-key": API_KEY,
        },
        ...withApiTimeout(config.apiTimeoutMs),
      });

    // Extract avatar IDs from API response
    const { avatarIds, error: extractionError } = extractAvatarIdsFromAPI(
      response.data
    );

    if (extractionError) {
      return {
        success: false,
        heygenAvatarCount: 0,
        databaseAvatarCount: 0,
        deletedCount: 0,
        deletedAvatarIds: [],
        error: extractionError,
      };
    }

    // Get avatars to check with database timeout
    const avatarsToCheck = await withDatabaseTimeout(
      DefaultAvatar.find({
        $or: [{ default: false }, { status: "training" }],
      }),
      config.databaseTimeoutMs
    );

    // Identify avatars to delete
    const avatarsToDelete = identifyAvatarsToDelete(avatarsToCheck, avatarIds);

    // Delete avatars in batches
    const totalDeleted = await deleteAvatarsInBatches(avatarsToDelete, {
      maxRetries: config.maxRetries,
      retryInitialDelayMs: config.retryInitialDelayMs,
      overallTimeoutMs: config.overallTimeoutMs,
      databaseTimeoutMs: config.databaseTimeoutMs,
      apiTimeoutMs: config.apiTimeoutMs,
      batchSize: config.batchSize!,
      delayBetweenBatchesMs: config.delayBetweenBatchesMs!,
    });

    if (totalDeleted > 0) {
      console.log(
        `🗑️ Deleted ${totalDeleted} avatar(s) that no longer exist in HeyGen`
      );
    } else {
      console.log(
        "✅ No avatars to delete. All checked avatars exist in HeyGen."
      );
    }

    return {
      success: true,
      heygenAvatarCount: avatarIds.size,
      databaseAvatarCount: avatarsToCheck.length,
      deletedCount: avatarsToDelete.length,
      deletedAvatarIds: avatarsToDelete,
    };
  } catch (error: any) {
    console.error("❌ Error syncing HeyGen avatars:", error?.message || error);

    if (error?.response) {
      console.error("   API Response Status:", error.response.status);
      console.error("   API Response Data:", error.response.data);
    }

    return {
      success: false,
      heygenAvatarCount: 0,
      databaseAvatarCount: 0,
      deletedCount: 0,
      deletedAvatarIds: [],
      error: error?.message || "Unknown error",
    };
  }
}

/**
 * Start cron job to sync HeyGen avatars every 12 hours
 */
export function startHeyGenAvatarSyncCron() {
  // Initialize monitoring
  cronMonitor.startMonitoring(CRON_JOB_NAME);
  const config = getCronConfig(CRON_JOB_NAME);

  // Run every 12 hours: 3 */12 * * * (at minute 3 of every 12 hours)
  cron.schedule(HEYGEN_AVATARS_SYNC_SCHEDULE, async () => {
    const startTime = Date.now();
    cronMonitor.markJobStarted(CRON_JOB_NAME);

    try {
      await executeWithOverallTimeout(
        CRON_JOB_NAME,
        syncHeyGenAvatars(),
        config.overallTimeoutMs
      );

      const duration = Date.now() - startTime;
      console.log(`✅ HeyGen avatars sync cron job completed in ${duration}ms`);
      cronMonitor.markJobCompleted(CRON_JOB_NAME, duration, true);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error?.message || "Unknown error";
      console.error(
        `❌ HeyGen avatars sync cron job failed after ${duration}ms:`,
        errorMessage
      );
      cronMonitor.markJobFailed(CRON_JOB_NAME, errorMessage);
    }
  });

  console.log(
    `⏰ HeyGen avatars sync cron job started - running every 12 hours (schedule: ${HEYGEN_AVATARS_SYNC_SCHEDULE})`
  );
}

// For manual run/testing
if (require.main === module) {
  syncHeyGenAvatars()
    .then((result) => {
      console.log("✅ Manual sync completed:", result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("❌ Manual sync failed:", error);
      process.exit(1);
    });
}
