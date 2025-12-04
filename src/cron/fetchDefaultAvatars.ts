import axios, { AxiosResponse } from "axios";
import DefaultAvatar, { IDefaultAvatar } from "../models/avatar";
import DefaultVoice, { IDefaultVoice } from "../models/voice";
import { connectMongo } from "../config/mongoose";
import CronMonitoringService from "../services/cronMonitoring.service";
import {
  executeWithOverallTimeout,
  withDatabaseTimeout,
  withApiTimeout,
  processInBatches,
} from "../utils/cronHelpers";
import { getCronConfig } from "../config/cron.config";
import {
  heyGenAvatarsAPIResponseSchema,
  heyGenVoicesAPIResponseSchema,
  heyGenVoiceSchema,
  processedAvatarSchema,
  VALID_AVATAR_TYPES,
  DEFAULT_AVATAR_NAME,
  DEFAULT_GENDER,
  DEFAULT_AVATAR_STATUS,
} from "../validations/fetchDefaultAvatars.validations";
import {
  HeyGenVideoAvatar,
  HeyGenPhotoAvatar,
  HeyGenVoice,
  HeyGenAvatarsAPIResponse,
  HeyGenVoicesAPIResponse,
  ProcessedAvatar,
  ProcessAvatarResult,
  ProcessVoiceResult,
  FetchAvatarsSummary,
  FetchVoicesSummary,
  ProcessAvatarConfig,
} from "../types/cron/fetchDefaultAvatars.types";
import {
  CRON_JOB_NAME,
  API_KEY,
  AVATARS_API_URL,
  VOICES_API_URL,
} from "../constants/fetchDefaultAvatarsCron.constants";

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
  if (!AVATARS_API_URL) {
    return { valid: false, error: "HEYGEN_BASE_URL is not configured" };
  }
  return { valid: true };
}

/**
 * Validate and transform video avatar from API
 */
function transformVideoAvatar(
  avatar: HeyGenVideoAvatar
): ProcessedAvatar | null {
  const validationResult = processedAvatarSchema.safeParse({
    avatar_id: avatar.avatar_id,
    avatar_name: avatar.avatar_name || DEFAULT_AVATAR_NAME,
    gender: avatar.gender || DEFAULT_GENDER,
    preview_image_url: avatar.preview_image_url || "",
    preview_video_url: avatar.preview_video_url || null,
    avatarType: "video_avatar" as const,
  });

  if (!validationResult.success) {
    console.warn(
      `Invalid video avatar ${avatar.avatar_id}:`,
      validationResult.error.errors
    );
    return null;
  }

  return validationResult.data;
}

/**
 * Validate and transform photo avatar from API
 */
function transformPhotoAvatar(
  photo: HeyGenPhotoAvatar
): ProcessedAvatar | null {
  const validationResult = processedAvatarSchema.safeParse({
    avatar_id: photo.talking_photo_id,
    avatar_name: photo.talking_photo_name || DEFAULT_AVATAR_NAME,
    gender: DEFAULT_GENDER,
    preview_image_url: photo.preview_image_url || "",
    preview_video_url: null,
    avatarType: "photo_avatar" as const,
  });

  if (!validationResult.success) {
    console.warn(
      `Invalid photo avatar ${photo.talking_photo_id}:`,
      validationResult.error.errors
    );
    return null;
  }

  return validationResult.data;
}

/**
 * Process and validate avatars from API response
 */
function processAvatarsFromAPI(responseData: any): ProcessedAvatar[] {
  const validationResult =
    heyGenAvatarsAPIResponseSchema.safeParse(responseData);

  if (!validationResult.success) {
    console.error(
      "Invalid API response format:",
      validationResult.error.errors
    );
    return [];
  }

  const data = validationResult.data?.data || {};
  const videoAvatars = (data.avatars || []) as HeyGenVideoAvatar[];
  const photoAvatars = (data.talking_photos || []) as HeyGenPhotoAvatar[];

  const processedAvatars: ProcessedAvatar[] = [];

  // Transform video avatars
  for (const avatar of videoAvatars) {
    const processed = transformVideoAvatar(avatar);
    if (processed) {
      processedAvatars.push(processed);
    }
  }

  // Transform photo avatars
  for (const photo of photoAvatars) {
    const processed = transformPhotoAvatar(photo);
    if (processed) {
      processedAvatars.push(processed);
    }
  }

  return processedAvatars;
}

/**
 * Process and validate voices from API response
 */
function processVoicesFromAPI(responseData: any): HeyGenVoice[] {
  const validationResult =
    heyGenVoicesAPIResponseSchema.safeParse(responseData);

  if (!validationResult.success) {
    console.error(
      "Invalid API response format:",
      validationResult.error.errors
    );
    return [];
  }

  const voices = (validationResult.data?.data?.voices || []) as HeyGenVoice[];

  // Filter and validate voices with preview_audio
  return voices.filter((voice) => {
    const voiceValidation = heyGenVoiceSchema.safeParse(voice);
    return voiceValidation.success && !!voice.preview_audio;
  });
}

/**
 * Process a single avatar (create or update)
 */
async function processAvatar(
  avatar: ProcessedAvatar,
  config: ProcessAvatarConfig
): Promise<ProcessAvatarResult> {
  try {
    const exists = await withDatabaseTimeout(
      DefaultAvatar.findOne({ avatar_id: avatar.avatar_id }),
      config.databaseTimeoutMs
    );

    if (!exists) {
      await withDatabaseTimeout(
        DefaultAvatar.create({
          ...avatar,
          default: true,
          status: DEFAULT_AVATAR_STATUS,
        }),
        config.databaseTimeoutMs
      );
      return { success: true, avatarId: avatar.avatar_id };
    } else {
      await withDatabaseTimeout(
        DefaultAvatar.updateOne(
          { avatar_id: avatar.avatar_id },
          {
            $set: {
              avatar_name: avatar.avatar_name,
              preview_image_url: avatar.preview_image_url,
              preview_video_url: avatar.preview_video_url,
              avatarType: avatar.avatarType,
            },
          }
        ),
        config.databaseTimeoutMs
      );
      return { success: true, avatarId: avatar.avatar_id };
    }
  } catch (error: any) {
    console.error(
      `❌ Error processing avatar ${avatar.avatar_id}:`,
      error?.message || error
    );
    return {
      success: false,
      avatarId: avatar.avatar_id,
      error: error?.message || "Unknown error",
    };
  }
}

/**
 * Process a single voice (create only)
 */
async function processVoice(
  voice: HeyGenVoice,
  config: ProcessAvatarConfig
): Promise<ProcessVoiceResult> {
  try {
    const exists = await withDatabaseTimeout(
      DefaultVoice.findOne({ voice_id: voice.voice_id }),
      config.databaseTimeoutMs
    );

    if (!exists) {
      await withDatabaseTimeout(
        DefaultVoice.create({
          voice_id: voice.voice_id,
          language: voice.language,
          gender: voice.gender,
          name: voice.name,
          preview_audio: voice.preview_audio,
        }),
        config.databaseTimeoutMs
      );
      return { success: true, voiceId: voice.voice_id };
    }
    return { success: true, voiceId: voice.voice_id };
  } catch (error: any) {
    console.error(
      `❌ Error processing voice ${voice.voice_id}:`,
      error?.message || error
    );
    return {
      success: false,
      voiceId: voice.voice_id,
      error: error?.message || "Unknown error",
    };
  }
}

// ==================== MAIN FUNCTIONS ====================
/**
 * Fetch and store default avatars from HeyGen API
 */
export async function fetchAndStoreDefaultAvatars(): Promise<FetchAvatarsSummary | null> {
  const config = getCronConfig(CRON_JOB_NAME);

  // Validate API configuration
  const configValidation = validateAPIConfig();
  if (!configValidation.valid || !AVATARS_API_URL || !API_KEY) {
    console.error(`❌ ${configValidation.error || "API configuration invalid"}`);
    return null;
  }

  try {
    await connectMongo();

    // Get avatars from HeyGen API with timeout
    const response: AxiosResponse<HeyGenAvatarsAPIResponse> = await axios.get(
      AVATARS_API_URL,
      {
        headers: {
          accept: "application/json",
          "x-api-key": API_KEY,
        },
        ...withApiTimeout(config.apiTimeoutMs),
      }
    );

    // Process and validate avatars
    const processedAvatars = processAvatarsFromAPI(response.data);

    if (processedAvatars.length === 0) {
      console.log("ℹ️ No avatars found in API response");
      return {
        total: 0,
        created: 0,
        updated: 0,
        errors: 0,
      };
    }

    console.log(`📋 Found ${processedAvatars.length} avatar(s) to process`);

    // Process avatars in batches
    const results = await processInBatches(
      processedAvatars,
      config.batchSize!,
      async (avatar: ProcessedAvatar) => {
        return await processAvatar(avatar, {
          apiTimeoutMs: config.apiTimeoutMs,
          databaseTimeoutMs: config.databaseTimeoutMs,
        });
      },
      config.delayBetweenBatchesMs
    );

    // Calculate summary
    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;

    // Check existing vs new (simplified - we don't track this separately in current logic)
    const createdCount = successCount; // Simplified: all successful are either created or updated
    const updatedCount = 0; // We don't differentiate in current implementation

    if (successCount > 0) {
      console.log(`✅ Successfully processed ${successCount} avatar(s)`);
    }
    if (errorCount > 0) {
      console.warn(
        `⚠️ Encountered ${errorCount} error(s) while processing avatars`
      );
    }

    return {
      total: processedAvatars.length,
      created: createdCount,
      updated: updatedCount,
      errors: errorCount,
    };
  } catch (error: any) {
    console.error(
      "❌ Error fetching default avatars:",
      error?.message || error
    );
    throw error;
  }
}

/**
 * Fetch and store default voices from HeyGen API
 */
export async function fetchAndStoreDefaultVoices(): Promise<FetchVoicesSummary | null> {
  const config = getCronConfig(CRON_JOB_NAME);

  // Validate API configuration
  const configValidation = validateAPIConfig();
  if (!configValidation.valid || !VOICES_API_URL || !API_KEY) {
    console.error(`❌ ${configValidation.error || "API configuration invalid"}`);
    return null;
  }

  try {
    await connectMongo();

    // Get voices from HeyGen API with timeout
    const response: AxiosResponse<HeyGenVoicesAPIResponse> = await axios.get(
      VOICES_API_URL,
      {
        headers: {
          accept: "application/json",
          "x-api-key": API_KEY,
        },
        ...withApiTimeout(config.apiTimeoutMs),
      }
    );

    // Process and validate voices
    const validVoices = processVoicesFromAPI(response.data);

    if (validVoices.length === 0) {
      console.log("ℹ️ No valid voices found in API response");
      return {
        total: 0,
        created: 0,
        errors: 0,
      };
    }

    console.log(`📋 Found ${validVoices.length} voice(s) to process`);

    // Process voices in batches
    const results = await processInBatches(
      validVoices,
      config.batchSize!,
      async (voice: HeyGenVoice) => {
        return await processVoice(voice, {
          apiTimeoutMs: config.apiTimeoutMs,
          databaseTimeoutMs: config.databaseTimeoutMs,
        });
      },
      config.delayBetweenBatchesMs
    );

    // Calculate summary
    const createdCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;

    if (createdCount > 0) {
      console.log(`✅ Successfully processed ${createdCount} voice(s)`);
    }
    if (errorCount > 0) {
      console.warn(
        `⚠️ Encountered ${errorCount} error(s) while processing voices`
      );
    }

    return {
      total: validVoices.length,
      created: createdCount,
      errors: errorCount,
    };
  } catch (error: any) {
    console.error("❌ Error fetching default voices:", error?.message || error);
    throw error;
  }
}

// For manual run/testing
if (require.main === module) {
  Promise.all([fetchAndStoreDefaultAvatars(), fetchAndStoreDefaultVoices()])
    .then(([avatarsResult, voicesResult]) => {
      console.log("✅ Manual fetch completed");
      console.log("Avatars:", avatarsResult);
      console.log("Voices:", voicesResult);
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Manual fetch failed:", error);
      process.exit(1);
    });
}
