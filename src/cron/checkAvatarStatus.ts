import DefaultAvatar, { IDefaultAvatar } from "../models/avatar";
import axios, { AxiosResponse } from "axios";
import dotenv from "dotenv";
import { connectMongo } from "../config/mongoose";
import { notificationService } from "../services/notification.service";
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
  avatarStatusResponseSchema,
  avatarDocumentSchema,
  VALID_AVATAR_STATUSES,
  avatarStatusCheckResultSchema,
} from "../validations/avatarStatus.validations";

// ==================== CONSTANTS ====================
dotenv.config();

const CRON_JOB_NAME = "avatar-status-check";
const CRON_SCHEDULE = "*/2 * * * *"; // Every 2 minutes
const AVATAR_STATUS_PENDING = "pending";
const AVATAR_STATUS_READY = "ready";
const NOTIFICATION_STATUS_SUCCESS = "success";
const NOTIFICATION_TYPE_READY = "ready";

const API_KEY = process.env.HEYGEN_API_KEY;
const STATUS_URL = `${process.env.HEYGEN_BASE_URL}/photo_avatar/train/status`;

// ==================== TYPES ====================
interface AvatarStatusCheckResult {
  updated: boolean;
  avatarId: string;
  error?: boolean;
}

interface AvatarStatusAPIResponse {
  status?: string;
  error?: any;
}

interface ProcessAvatarStatusCheckConfig {
  apiTimeoutMs: number;
  databaseTimeoutMs: number;
}

// ==================== SERVICE INSTANCE ====================
const cronMonitor = CronMonitoringService.getInstance();

// ==================== HELPER FUNCTIONS ====================
/**
 * Validate avatar data before processing using Zod schema
 */
function validateAvatar(avatar: any): { valid: boolean; avatarId?: string } {
  const validationResult = avatarDocumentSchema.safeParse(avatar);

  if (!validationResult.success) {
    console.warn("Invalid avatar:", validationResult.error.errors);
    return { valid: false };
  }

  const avatarId = validationResult.data.avatar_id;
  if (!avatarId || avatarId.trim().length === 0) {
    console.warn("Invalid avatar: missing or empty avatar_id");
    return { valid: false };
  }

  return { valid: true, avatarId };
}

/**
 * Validate API response using Zod schema
 */
function validateAPIResponse(responseData: any): {
  status?: string;
  error?: string;
} {
  const validationResult = avatarStatusResponseSchema.safeParse(responseData);

  if (!validationResult.success) {
    console.warn("Invalid API response format:", validationResult.error.errors);
    return { error: "Invalid API response format" };
  }

  const status = validationResult.data?.data?.status;
  if (status && !VALID_AVATAR_STATUSES.includes(status as any)) {
    console.warn(`Invalid avatar status received: ${status}`);
    return { error: `Invalid avatar status: ${status}` };
  }

  return { status };
}

/**
 * Check avatar status from HeyGen API
 */
async function checkAvatarStatusFromAPI(
  avatarId: string,
  apiTimeoutMs: number
): Promise<AvatarStatusAPIResponse> {
  try {
    if (!API_KEY) {
      console.error("HEYGEN_API_KEY is not configured");
      return { error: "API key not configured" };
    }

    if (!STATUS_URL || STATUS_URL.includes("undefined")) {
      console.error("HEYGEN_BASE_URL is not configured");
      return { error: "API base URL not configured" };
    }

    const response: AxiosResponse = await axios.get(
      `${STATUS_URL}/${avatarId}`,
      {
        headers: {
          accept: "application/json",
          "X-Api-Key": API_KEY,
        },
        ...withApiTimeout(apiTimeoutMs),
      }
    );

    // Validate API response
    const validatedResponse = validateAPIResponse(response.data);
    if (validatedResponse.error) {
      return { error: validatedResponse.error };
    }

    return {
      status: validatedResponse.status,
    };
  } catch (error: any) {
    console.error(
      `Error fetching avatar status from API for ${avatarId}:`,
      error?.response?.status || error?.message || error
    );
    return {
      error: error?.response?.status || error?.message || "Unknown API error",
    };
  }
}

/**
 * Update avatar status in database
 */
async function updateAvatarStatus(
  avatar: IDefaultAvatar,
  newStatus: string,
  databaseTimeoutMs: number
): Promise<boolean> {
  try {
    // Validate status
    if (!VALID_AVATAR_STATUSES.includes(newStatus as any)) {
      console.error(`Invalid status to update: ${newStatus}`);
      return false;
    }

    avatar.status = newStatus as any;
    await withDatabaseTimeout(avatar.save(), databaseTimeoutMs);
    return true;
  } catch (error: any) {
    console.error(
      `Error updating avatar status in database for ${avatar.avatar_id}:`,
      error?.message || error
    );
    return false;
  }
}

/**
 * Send notification to user when avatar is ready
 */
function notifyUserAvatarReady(avatar: IDefaultAvatar): void {
  if (!avatar.userId) {
    return;
  }

  try {
    const avatarName = avatar.avatar_name || "Avatar";
    const avatarId = avatar.avatar_id;
    const previewImageUrl = avatar.preview_image_url || "";

    notificationService.notifyPhotoAvatarProgress(
      avatar.userId.toString(),
      NOTIFICATION_TYPE_READY,
      NOTIFICATION_STATUS_SUCCESS,
      {
        message: "Your avatar training is complete and ready to use!",
        avatarName,
        avatarId,
        previewImageUrl,
      }
    );
  } catch (error: any) {
    console.error(
      `Error sending notification for avatar ${avatar.avatar_id}:`,
      error?.message || error
    );
  }
}

/**
 * Process a single avatar status check
 */
async function processAvatarStatusCheck(
  avatar: IDefaultAvatar,
  config: ProcessAvatarStatusCheckConfig
): Promise<AvatarStatusCheckResult> {
  // Validate avatar
  const validation = validateAvatar(avatar);
  if (!validation.valid) {
    return {
      updated: false,
      avatarId: validation.avatarId || avatar?.avatar_id || "unknown",
      error: true,
    };
  }

  const avatarId = validation.avatarId!;

  try {
    // Check status from API
    const statusResult = await checkAvatarStatusFromAPI(
      avatarId,
      config.apiTimeoutMs
    );

    if (statusResult.error) {
      return { updated: false, avatarId, error: true };
    }

    // Update status if ready
    if (statusResult.status === AVATAR_STATUS_READY) {
      const updateSuccess = await updateAvatarStatus(
        avatar,
        AVATAR_STATUS_READY,
        config.databaseTimeoutMs
      );

      if (updateSuccess) {
        // Send notification to user
        notifyUserAvatarReady(avatar);

        const result: AvatarStatusCheckResult = { updated: true, avatarId };
        // Validate result schema
        avatarStatusCheckResultSchema.parse(result);
        return result;
      } else {
        return { updated: false, avatarId, error: true };
      }
    }

    return { updated: false, avatarId };
  } catch (error: any) {
    console.error(
      `Error processing avatar status check for ${avatarId}:`,
      error?.message || error
    );
    return { updated: false, avatarId, error: true };
  }
}

// ==================== MAIN FUNCTION ====================
/**
 * Check pending avatars and update their status
 */
export async function checkPendingAvatarsAndUpdate() {
  const config = getCronConfig(CRON_JOB_NAME);

  try {
    await connectMongo();

    // Get pending avatars with database timeout
    const pendingAvatars = await withDatabaseTimeout(
      DefaultAvatar.find({ status: AVATAR_STATUS_PENDING }),
      config.databaseTimeoutMs
    );

    if (pendingAvatars.length === 0) {
      console.log("ℹ️ No pending avatars to check");
      return {
        total: 0,
        updated: 0,
        errors: 0,
      };
    }

    console.log(`📋 Found ${pendingAvatars.length} pending avatar(s) to check`);

    // Process avatars in batches
    const results = await processInBatches(
      pendingAvatars,
      config.batchSize!,
      async (avatar: IDefaultAvatar) => {
        return await processAvatarStatusCheck(avatar, {
          apiTimeoutMs: config.apiTimeoutMs,
          databaseTimeoutMs: config.databaseTimeoutMs,
        });
      },
      config.delayBetweenBatchesMs
    );

    // Log summary
    const updatedCount = results.filter((r) => r.updated).length;
    const errorCount = results.filter((r) => r.error).length;

    if (updatedCount > 0) {
      console.log(`✅ Updated ${updatedCount} avatar(s) to ready status`);
    }
    if (errorCount > 0) {
      console.warn(
        `⚠️ Encountered ${errorCount} error(s) while checking avatars`
      );
    }

    const summary = {
      total: pendingAvatars.length,
      updated: updatedCount,
      errors: errorCount,
    };

    return summary;
  } catch (error: any) {
    console.error("❌ Error checking avatar status:", error?.message || error);
    throw error;
  }
}

/**
 * Start cron job to check avatar status every 2 minutes
 */
export function startAvatarStatusCheckCron() {
  // Initialize monitoring
  cronMonitor.startMonitoring(CRON_JOB_NAME);
  const config = getCronConfig(CRON_JOB_NAME);

  // Run every 2 minutes
  cron.schedule(CRON_SCHEDULE, async () => {
    const startTime = Date.now();
    cronMonitor.markJobStarted(CRON_JOB_NAME);

    try {
      await executeWithOverallTimeout(
        CRON_JOB_NAME,
        checkPendingAvatarsAndUpdate(),
        config.overallTimeoutMs
      );

      const duration = Date.now() - startTime;
      console.log(`✅ Avatar status check cron job completed in ${duration}ms`);
      cronMonitor.markJobCompleted(CRON_JOB_NAME, duration, true);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(
        `❌ Avatar status check cron job failed after ${duration}ms:`,
        error?.message || "Unknown error"
      );
      cronMonitor.markJobFailed(
        CRON_JOB_NAME,
        error?.message || "Unknown error"
      );
    }
  });

  console.log(
    `⏰ Avatar status check cron job started - running every 2 minutes (schedule: ${CRON_SCHEDULE})`
  );
}

// For manual run/testing
if (require.main === module) {
  checkPendingAvatarsAndUpdate()
    .then((result) => {
      console.log("✅ Manual avatar status check completed", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Manual avatar status check failed:", error);
      process.exit(1);
    });
}
